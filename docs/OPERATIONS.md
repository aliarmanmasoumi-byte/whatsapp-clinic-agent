# Bayton — WhatsApp stack

Everything about the WhatsApp side of the Bayton agent: the number, the two n8n
workflows, the Retell agent, and how to debug it when it breaks.

Last verified end-to-end: **2026-08-26**.

---

## 1. What exists

| Thing | Value |
|---|---|
| Number | **<WHATSAPP_NUMBER>** (Phone Number ID `<WHATSAPP_PHONE_NUMBER_ID>`) |
| Display name | Ambition Clinic |
| WABA ID | `<WABA_ID>` |
| App | WA Cloud API — App ID `<META_APP_ID>` |
| Business portfolio | Ambition AI Agents — `<META_ASSET_ID>` |
| Two-step PIN | `<TWO_STEP_PIN>` (needed to re-register the number) |

Secrets live in `cloude\.env`, never in this folder.

### Why a separate portfolio
The original **"Ambition ai" portfolio (`<META_BUSINESS_ID>`) is RESTRICTED** by Meta
since 12 Jul 2026 — *"Account Integrity — automation that mimics human activity"*.
That block stops you creating WABAs/numbers under it. Rather than appeal, this
stack was built under a clean new portfolio. The same identity could get flagged
again, so: **no sudden bulk sends.**

---

## 2. Architecture

There are **two** n8n workflows plus the original email one. Keep them straight —
mixing them up was the main bug of 2026-08-26.

```
                    ┌───────────────────────────────────────────┐
  patient texts     │  Bayton WhatsApp Agent   <BOT_WORKFLOW_ID> │
  <WHATSAPP_NUMBER> ──► │  WhatsApp Trigger → Parse → AI Agent      │
                    │  (Marta, gpt-5-mini, KB inlined)          │
                    └──────────────────┬────────────────────────┘
                                       │ 7 HTTP tools
                                       │ + header x-webhook-token
                                       ▼
  patient CALLS     ┌───────────────────────────────────────────┐
  the clinic   ──►  │  bayton whatsapp        <BACKEND_WORKFLOW_ID>  │
  (Retell "Laura")  │  webhook 24458e6e-…                       │
                    │  validate → Google Calendar → Sheets      │
                    │  → send WhatsApp confirmation             │
                    └───────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │  bayton        1nLn632hAy9bbjv8   ← ORIGINAL, still live,   │
  │  webhook d95b1141-…                 sends EMAIL. Untouched. │
  └─────────────────────────────────────────────────────────────┘
```

- **Booking webhook**: `${N8N_URL}/webhook/<WEBHOOK_PATH>`
  Requires header **`x-webhook-token: <WEBHOOK_TOKEN>`**.
  The check is inside the Code node **`Code in JavaScript3`**, *not* on the Webhook node.
- **Bot trigger**: `…/webhook/0aad4dca-3c93-469b-84a7-cb441fcf76d3/webhook`
  Note the **`/webhook` suffix** — the bare path 404s.
- Retell agent **"Laura (bayton) - WhatsApp"** `agent_655d3eebf7862c29957bd6df32`
  (LLM `llm_75b4d09ba4f7c516b5485f42f6df`, gpt-5-mini) — already points at the
  booking webhook.
- n8n credentials: `WhatsApp Ambition Clinic` `4nAwxJnkGb3evISc`,
  `WhatsApp Trigger (Ambition)` `1UO6oxd6jwNoREN8`, `OpenAI (Bayton WA)` `aXZuewiQG4hV5Ahv`.

**No patient email anywhere.** Booking collects name → service → time; the phone is
the WhatsApp number and is never asked for. Calendar description is `CODE / phone / service`.

---

## 2b. The inbound phone number (added 2026-08-26)

**`+1 315 818 3970`** (Retell type `custom`, SIP trunk `<TWILIO_TERMINATION_URI>`) is the
inbound number, and it now routes to **`Laura (bayton) - WhatsApp`**
`agent_655d3eebf7862c29957bd6df32`. It used to point at the original email agent
`agent_67c2a5cc35b02c9172e7b84ac2` — PATCH it back there to revert.

⭐ **API gotcha:** `inbound_agent_id` is deprecated and returns
**400 "Deprecated API usage … Phone number single-agent fields"**. Use the array:

```bash
curl -X PATCH https://api.retellai.com/update-phone-number/%2B<CLINIC_PHONE_US>   -H "Authorization: Bearer $RETELL_KEY" -H "Content-Type: application/json"   -d '{"inbound_agents":[{"agent_id":"agent_655d3eebf7862c29957bd6df32","weight":1}]}'
```

Neither the agent nor its LLM is `is_published`, so the **draft runs live on the
phone** — every PATCH is instantly in effect, there is no publish step.

Two gaps were found and fixed on LLM `llm_75b4d09ba4f7c516b5485f42f6df` when the
number was moved (backup: `backups/retell_LLM_Laura-WhatsApp_PRE-KBFIX_20260826.json`):

1. **No knowledge base was attached** — it only had `kb_config`
   (`top_k`/`filter_score`), which is settings without sources. Attached
   `knowledge_base_5a7f2dffe3494ac7` (*bayton-clean-v1*), the same KB the original uses.
2. **Wrong clinic address in the prompt** — "Calle Doctor Esquerdo 16", replaced with
   *calle de las Martires Concepcionistas 13, puerta Izquierda, 28006 Madrid*.
   ⚠️ The **original** agent's prompt still has the wrong address.

**Still open:** no Retell tool sends `lang`, so the workflow always falls back to
`'es'` and an English-speaking caller gets a Spanish WhatsApp confirmation, even
though the prompt and the n8n `textBody` are both bilingual-ready.

---

## 2c. The `consulting` action — "when is my appointment?" (added 2026-08-26)

A real call asked *"¿cuándo es mi cita?"*. There was no tool for it, so Laura fell
back to `transfer_call` — which **also** failed, and the caller hung up. Every
caller asking that very common question hit the same dead end.

`consulting` takes **only a name** and returns the caller's upcoming appointments
for the next 90 days:

```
Switch[consulting] → Get upcoming events → Pick upcoming appointments → Respond Consulting
```

⭐ **It could NOT reuse the cancel branch.** `Get many events2` reads **one day
only** — its `timeMin`/`timeMax` are `startOf`/`endOf` day derived from
`args.time1`. Somebody asking when their appointment is does not know the date,
which is the whole point, so this needed its own **wide forward window**
(`now` .. `+90d`) queried by name.

⭐ Google Calendar's `query` is **fuzzy full-text**, so `Pick upcoming appointments`
re-checks that the name really appears in the event summary. Without that guard a
loose match reads another patient's appointment back to the caller.

Response shape: `{status, count, next, appointments[], message}`, each entry
carrying `when`, `date_spoken`, `time`, `appointment_code`, `service`.
No match returns `APPOINTMENT_NOT_FOUND` — and the prompt says explicitly **not**
to transfer for it.

⭐ **Same-name disambiguation.** Matching on name alone was unsafe: two different
patients sharing a name both came back, and the agent reads the result out loud.
Blocking on `count > 1` was not an option either — one patient legitimately having
two upcoming appointments is normal, and a name cannot tell those apart.

The event description already carries the phone (`CODE: nnnn` / phone / service),
so **the phone is the discriminator**:

| matches | distinct phones | result |
|---|---|---|
| 1+ | 1 | `success` — one person, read them all back |
| 2+ | 2+ | `AMBIGUOUS` — never read aloud; ask for the 4-digit code |

`consulting` takes an optional `appointment_code`; when given it narrows first, so
the retry resolves cleanly. Verified both ways: two patients / two phones →
`AMBIGUOUS`, then name+code → the right single appointment; one patient / two
appointments → `success, count 2`.

Applied by `tools/apply-consulting-lookup.mjs` (n8n) and
`tools/apply-consulting-retell.mjs` (tool + prompt). Both are idempotent and back
up before writing. `smoke-test.mjs --full` now covers it.

---

## 3. Tools

```
node tools/inspect.mjs bot          # config health-check, catches the 2026-08-26 bug class
node tools/inspect.mjs booking
node tools/executions.mjs           # last failed run of the bot, with the failing node
node tools/executions.mjs booking
node tools/executions.mjs 5575      # a specific execution id
node tools/smoke-test.mjs           # read-only: availability + suggesting2
node tools/smoke-test.mjs --full    # book → reschedule → cancel, cleans up after itself
node tools/templates.mjs            # template approval status
node tools/roi-report.mjs           # what the agent was worth — the sales number
node tools/roi-report.mjs --days 7
node tools/roi-report.mjs --from 2026-09-01 --to 2026-09-14
```

**`roi-report.mjs` is the one that closes a trial.** It reads the booking log
Sheet and splits everything the agent did by whether the clinic was OPEN or
CLOSED at that moment, because the closed-hours bookings are the entire
argument: nobody was there to answer those calls, so without the agent they were
lost. It ends with a ready-to-paste Spanish paragraph for the clinic.

Opening hours are Mon–Thu 10–20, Fri 10–14, closed weekends. Public holidays are
**not** modelled, so the closed-hours figure is a slight under-estimate — that is
deliberate, the number must never be inflated.

It authenticates with a Google service-account key, looked up in
`Bayton Clinic/config/`, `cloude/config/`, then `Masoumi Clinic/config/`
(override with `--key`). If it returns 403, share the Sheet with the key's
`client_email`.

> ⚠ Until a real trial runs, the rows in that Sheet are **your own test
> bookings**. Never show those figures to a clinic as if they were patient
> traffic — run the report over the trial window only.

> ⚠ `smoke-test.mjs --full` sends **3 real WhatsApp messages** to whatever number
> you give it. It defaults to a dummy number for that reason. Passing `<A_REAL_NUMBER>`
> means the owner's phone buzzes three times.

---

## 4. The 24-hour window — the rule that bites

A free-form WhatsApp message only reaches the patient if **they** messaged the
clinic within the last 24 hours. Outside that window Meta returns a perfectly
normal **200 + a wamid, and silently drops the message** (error 131047).

**200 + wamid means "accepted", NOT "delivered".** This was confirmed empirically:
sends with no open window produced zero rows in WABA analytics; the moment the
user texted the clinic first, an identical send arrived instantly.

Consequence: a patient who booked **by phone** has no open window, so their
confirmation needs an approved **template**. Chat bookings are always in-window
and work with plain text.

### Templates
`cita_confirmada` · `booking_cancelled` · `booking_rescheduled` (es, UTILITY) —
submitted 2026-08-26, **still "In review" (PENDING)** as of 2026-08-26 12:50,
checked in WhatsApp Manager. Only `hello_world` is Active, and **`hello_world`
cannot be sent from a real number** (error 131058, test numbers only), so it is
useless for smoke-testing.

Check the live status with `node tools/templates.mjs`, or in
**WhatsApp Manager → Message templates**.

> ⚠️ **`cita_confirmada` has the WRONG clinic address baked in**: its body ends
> with *Calle Doctor Esquerdo 16, Madrid*. The correct address is **Calle de las
> Mártires Concepcionistas 13, Izq., 28006 Madrid**. Fix it (a PENDING template
> can be edited in place via `POST /{template_id}`) before it is ever sent, or
> every phone booking will send patients to the wrong street.

⭐ **Rejection gotcha:** a UTILITY template with a bare `Codigo: {{n}}` line gets
auto-rejected as `INCORRECT_CATEGORY` — Meta's classifier reads a short numeric
value on its own line as an OTP/AUTHENTICATION template. `allow_category_change`
does not help, renaming does not help; the **wording** is what matters. Phrase it
as a sentence instead: `Guarde esta referencia para cualquier gestion: {{5}}`.

⭐ A **REJECTED template can be edited in place** with `POST /{template_id}` — do
that instead of delete+recreate, because after a DELETE the same language is
blocked for well over 5 minutes (`error_subcode 2388023`).

---

## 5. Troubleshooting

**Start here:** `node tools/inspect.mjs bot` then `node tools/executions.mjs`.

| Symptom | Cause | Fix |
|---|---|---|
| **Bot floods the patient with dozens of identical "solo puedo leer mensajes de texto" messages** | The WhatsApp Trigger (`updates: ["messages"]`) also fires on **status callbacks** (sent/delivered/read) for the bot's OWN outgoing messages. `value.statuses` has no `messages[]`, so `Parse message` gave `type:"unknown"` → `Is a text message?` false → `Respond Unsupported Type` sent a reply → whose delivery receipt re-triggered the workflow → infinite loop (2026-08-26, exec 5760–5789: 30 runs in 6s). | **FIXED**: `Parse message` now returns `[]` (drops the item, no downstream nodes run) whenever `value.messages[0]?.from` is absent — i.e. anything that isn't a genuine inbound message. Status callbacks now no-op silently. |
| `Unsupported value: 'temperature' does not support 0.3` | gpt-5 / reasoning models reject any explicit temperature | delete `options.temperature`, leave `options: {}` |
| Tool calls return `UNAUTHORIZED` | `x-webhook-token` header missing or an empty header row (`values:[{}]`) | set the header on all 7 tool nodes |
| Booking sends an **email** instead of WhatsApp | tools point at `d95b1141-…` (the original workflow) | repoint to `24458e6e-…` |
| Reschedule/cancel fail `MISSING_FIELD` | field names differ from booking: it is **`booking_time1`**, **`reschedule_time1`**, **`time1`** — not `booking_time`/`new_time` | fix the tool JSON bodies |
| Bot never runs at all (0 executions) | `subscribed_apps` empty on the WABA | `POST /{waba}/subscribed_apps` |
| Message accepted but never arrives | 24h window (§4) | have the patient message first, or use a template |
| `(#2200) Callback verification failed` | wrong callback URL | don't register it manually — **n8n registers the Meta callback itself** when a WhatsApp-Trigger workflow is activated |
| n8n API 401 | the key is present in `.env` but `_env.mjs` failed to parse it — the n8n key is a 267-char JWT that sits on the line **below** its `n8n api key :` label | `grab()` now falls through to the next line when the label line is empty; don't "fix" it back to a single-line regex |
| Saving/activating the bot returns **`(#4) Application request limit reached`**, and n8n leaves the workflow **deactivated** (bot goes silent) | Every save of a workflow containing a **WhatsApp Trigger** makes n8n re-register the callback with Meta. Too many saves in a day trips Meta's app rate limit; n8n cannot register, so it deactivates. | Nothing is broken — it is a rolling window. Run `node tools/reactivate-bot.mjs` (retries every 5 min for an hour). **Prevention: batch prompt/config edits into ONE PUT** instead of saving repeatedly. |

**Activation is always a UI step** — the n8n `/activate` API call is blocked by the
permission layer, so a human has to flip the toggle in n8n.

---

## 6. Open items

- [ ] **Templates still PENDING** — once approved, switch the booking workflow's
      whatsApp nodes from free-form text to template sends, so phone bookings get
      a confirmation too.
- [x] ~~Permanent token missing from `.env`~~ — **recovered 2026-08-26** and written
      back to line 64. Verified via `debug_token`: `type: SYSTEM_USER`, app *WA Cloud
      API*, **`expires_at: 0` (never expires)**, scopes `whatsapp_business_management`
      + `whatsapp_business_messaging` + `public_profile`, system user
      `n8n-whatsapp` (`<SYSTEM_USER_ID>`). If it is ever lost again Meta cannot
      re-display it — generate a new one under Business Settings → System Users.
      *(Two tokens exist in the history and they look almost identical — both start
      `<META_TOKEN_PREFIX>`. The 284-char one ending `<TOKEN_SUFFIX>` is the dead 24h temp token;
      the permanent one is 199 chars and ends `FgkQZDZD`.)*
- [ ] **Wrong clinic address in the original email workflow** — `bayton`
      (`1nLn632hAy9bbjv8`) still says *Calle Doctor Esquerdo 16*. The correct
      address is **Calle de las Mártires Concepcionistas 13, Izq., 28006 Madrid**.
      Already fixed in the WhatsApp workflow.
- [ ] Chat memory is **in-RAM** (`Simple Memory`, 20 messages, keyed on wa_id) —
      it resets when n8n restarts. Swap back to Postgres Chat Memory if
      persistence is wanted; needs the Postgres password.
- [ ] Nice-to-have: rebuild templates with an image header and buttons
      (📞 Llamar / 📍 Cómo llegar) once the plain ones are approved.

---

## 7. Files here

```
README.md                    this file
tools/_env.mjs               shared config, reads cloude\.env
tools/inspect.mjs            node-config health check
tools/executions.mjs         run history + error explainer
tools/smoke-test.mjs         end-to-end booking test
tools/templates.mjs          template approval status
backups/                     workflow + Retell JSON snapshots, 2026-08-26
```

The bot's system prompt is versioned with the others:
`..\prompts\marta_PROMPT_v5_20260826_anyLanguage.txt` (v4 = the noEmail one before it)

## 8. Only some numbers can reach the bot — app was Unpublished (FIXED)

**Symptom:** the owner's number gets replies; a different number sends a message
and it never even shows two ticks, and **zero** executions appear in n8n.

**Diagnosis (2026-08-26):** if n8n logs no trigger at all, the message never left
Meta — the bug is not in n8n. The Meta app **`WA Cloud API` (`<META_APP_ID>`)
was still Unpublished (Development)**, where only people with a role on the app
(admin / developer / tester) can exchange messages with the number. Everyone else
is dropped silently, which is exactly the no-tick symptom.

**Fixed 2026-08-26 — the app is now Published.** The only thing blocking Publish
was a missing **Privacy policy URL**; it is set to
`https://baytondental.com/politica-de-privacidad/` (the clinic's real policy page —
patients' data is the clinic's, and the only other candidate,
`app.ambitnhouse.com/privacy`, just serves the platform login page).

> Note the app's **Terms of Service URL** and **User data deletion URL** are still
> placeholder `https://www.facebook.com/`. Worth replacing with real pages: this
> identity already had one portfolio restricted for integrity reasons, and
> placeholder policy links are exactly the sort of thing that gets re-flagged.

### ⛔ Iranian (+98) numbers can never reach it

A retest after publishing still produced no ticks and no execution — because the
test number was **Iranian (+98)**. WhatsApp Cloud API does not exchange messages
with +98 numbers at all, in either direction, and no app or WABA setting changes
that. **Always smoke-test inbound with a non-Iranian number.** If a test shows no
ticks and no n8n execution, check the country code before debugging anything else.

---

## 9. Concurrency — many patients at once

**The chat side scales fine.** Every inbound message is its own n8n execution and
they run in parallel; `Simple Memory` is keyed on `wa_id`, so each patient has a
separate conversation thread with no cross-talk. Patient A never sees patient B's
context.

**Known limits, in the order they will bite:**

1. ✅ **Double-booking race — FIXED 2026-08-26.** The booking workflow used to do
   `Get availability in a calendar1` → `If` → `Create an event`: a check-then-act
   with **no lock**, so two patients confirming the *same* slot seconds apart both
   passed the check, both got an event, and both were told "confirmed".

   The fix is optimistic concurrency, inserted after `Create an event`:

   ```
   Create an event → Verify slot race → Resolve booking race → Race won?
                                                                ├ true  → Respond to Webhook5 → confirmation
                                                                └ false → Delete losing event → Respond Slot Taken Race
   ```

   Every racer re-reads the slot after creating and computes the **same** winner
   deterministically (**lowest Google event id wins**). The loser deletes its own
   event and gets `SLOT_TAKEN`, which the agent turns into alternative times via
   `suggesting`. If the verification read comes back empty the booking is **kept**,
   so a transient Calendar hiccup can never destroy a real appointment.

   Verified live: two simultaneous bookings on one slot → exactly 1 success +
   1 `SLOT_TAKEN`; both executions logged `contenders: 2` and agreed on the winner;
   the loser's event was deleted and no confirmation was sent for it.

2. ⚠️ **`Generate code` collision (residual, accepted).** Two bookings into
   *different* slots in the same second can still draw the same 4-digit code
   (~1/9000). Impact is low — cancel/reschedule also match on name + time — so it
   was left alone rather than adding more nodes to a live workflow.
3. **Chat memory is in-RAM** — an n8n restart drops every in-flight conversation
   at once, for all patients.

   It also used to **never forget**: keyed on `wa_id` alone, a patient who sent
   "Hi" hours later was answered mid-booking ("what service for tomorrow?").
   Fixed 2026-08-26 with a **session timeout**: `Parse message` keeps a per-`wa_id`
   last-seen stamp in workflow static data and bumps a session epoch after
   **60 minutes** idle; `Simple Memory` is now keyed on `wa_id:epoch`, so a new
   conversation starts clean. Entries older than 30 days are pruned so the store
   cannot grow forever. To change the idle window, edit `IDLE_MINUTES` in
   `Parse message`.
4. **OpenAI + Google Calendar rate limits**, then the single n8n process's CPU.
   These are the real ceiling.

**Bottom line:** parallel conversations and parallel bookings are both safe now.

---

## 10. Language

The chat bot answers in **any** language the patient writes in — it's a text LLM,
so the Spanish/English limit inherited from the voice agent was removed (v5).
The KB now separates the two cases: **WhatsApp = any language**, but **in person
and by phone the clinic is Spanish/English**, so the bot never promises a
Persian- or Arabic-speaking dentist at the chair.

One thing is still hardcoded bilingual: the static `Respond Unsupported Type`
node (the "please write it instead" reply for voice notes / images). It never
reaches the model, so it can't translate itself. Fine for now; if it matters,
route non-text through the agent instead of that node.
