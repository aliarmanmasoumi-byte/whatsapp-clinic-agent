# Deployed 2026-08-24

## What went live

A **new** Retell agent. Nothing existing was modified.

| | |
|---|---|
| New agent | `agent_362ab8e5e3b2c54688da5e7200` — **"Laura NULLFIX (bayton) - TEST"** |
| New LLM | `llm_fd267f45a1c08c895246ec3ea9ff` |
| Cloned from | `agent_67c2a5cc35b02c9172e7b84ac2` / `llm_4b3868e14d96789f44f3278da4d2` |
| Phone | **not touched** — `<CLINIC_PHONE_US>` still points at the old agent |

Backups of the source config are in this folder (`BACKUP_live_*_preNullfix.json`).

---

## What's different in the new agent

### 1. The null fix 🔴 the actual reason this exists

The old `appointment` tool required all six parameters:

```
required: ["name","Email","phone","service","action","booking_time"]
```

The new one requires two:

```
required: ["action","booking_time"]
name / Email / phone / service  ->  type: ["string","null"]
```

**Why this and not better prompt wording:** the old agent already had anti-fabrication rules in
three places at once — a `## Never fabricate` section marked "highest priority, overrides
everything below", a PRECONDITION sentence in the tool description, and "Never invent, guess or
use an example/placeholder value" on *every single parameter*. It invented María López anyway.

Prompt text cannot win against a schema that says a field is required. The model must emit a
string, so it emits a plausible one. Removing the requirement is the fix; the prompt wording is
only the backup.

`waitlist_add` got the same treatment: `required` is now `["action","desired_time"]`.

### 2. Prompt additions

- **`## The null rule`** — inserted right after the existing `## Never fabricate` block, telling
  the agent explicitly to pass `null` and ask, now that null is actually accepted.
- **`## Out of hours`** — never `transfer_call` when the clinic is closed (nobody is there to
  pick up), still book normally, 112 for real emergencies, say once that the clinic is closed.

Prompt went from 12,176 → 13,903 chars.

### 3. Two things that were wrong on the live agent, fixed in the copy

Both of these contradict what the project notes claimed, and were found by reading the live
config rather than trusting the notes:

- **Address.** The live prompt still says `Calle Doctor Esquerdo 16`. The real address —
  confirmed by you on 2026-08-16 — is `Calle de las Mártires Concepcionistas 13, Izquierda,
  28006 Madrid`. The new agent has the correct one.
- **Knowledge base.** The live LLM is still attached to `knowledge_base_d7f4cf6a5ec979b1` — the
  old crawl with 125 sources, 85 of them dead URLs and ~57% duplicated boilerplate. The clean
  hand-written `knowledge_base_5a7f2dffe3494ac7` ("bayton-clean-v1", 2 sources) exists but was
  never attached to anything live. The new agent uses the clean one.

> The KB attaches to the **LLM**, not the agent. `knowledge_base_ids` on the agent object is
> silently ignored.

### 4. Unchanged on purpose

Voice (`custom_voice_3f02e539b03866ed04e8fa2d67`), model (`gpt-5-mini`), all turn-taking
settings, `begin_message`, and all 10 tools.

---

## Verified from the server after deploy

```
appointment.required : ["action","booking_time"]
  name / Email / phone / service : ["string","null"]
waitlist_add.required: ["action","desired_time"]
tools count          : 10
null rule present    : true
out-of-hours present : true
address fixed        : true
KB                   : ["knowledge_base_5a7f2dffe3494ac7"]

--- live system ---
phone binding        : agent_67c2a5cc35b02c9172e7b84ac2   (unchanged)
old appointment.req  : ["name","Email","phone","service","action","booking_time"]  (unchanged)
old prompt chars     : 12176   (unchanged)
old KB               : knowledge_base_d7f4cf6a5ec979b1    (unchanged)
```

---

## Test it before it goes anywhere near a phone

Retell dashboard → **Laura NULLFIX (bayton) - TEST** → Test LLM chat.

**The one that matters** — the exact message that caused the bug:

> ¿tienen hueco el lunes a las once?

- ✅ **Pass:** calls `availability`, reports the result, then asks for a name.
- ❌ **Fail:** any call to `appointment` on that turn.

Run it **5 times**. This is a probabilistic failure — one clean run proves nothing.

Then:
- [ ] Book end to end, confirm the 4-digit code comes back and the event is really in the calendar
- [ ] Give a name but no email → it must ask, not invent
- [ ] Ask something in the KB (address, treatments) → the new clean answers
- [ ] Ask a price → it must decline, not invent

## To put it on the phone (only after it passes)

```
PATCH /update-phone-number/<CLINIC_PHONE_US>
{"inbound_agents":[{"weight":1,"agent_id":"agent_362ab8e5e3b2c54688da5e7200"}]}
```

## To roll back

```
PATCH /update-phone-number/<CLINIC_PHONE_US>
{"inbound_agents":[{"weight":1,"agent_id":"agent_67c2a5cc35b02c9172e7b84ac2"}]}
```

The old agent was never modified, so rollback is just repointing the number.

---

## n8n workflow — also deployed (2026-08-25)

A new API key was issued (no expiry) and the workflow was created through the API.

| | |
|---|---|
| Workflow id | `<BOT_WORKFLOW_ID>` |
| Name | **Bayton WhatsApp Agent** |
| Active | **false** — it cannot run or send anything |
| Nodes | 27 (17 functional, 10 sticky sections) |

Verified by re-reading it from the server: all 7 tools present, all 10 sections present, every
connection resolves.

**The existing `bayton` workflow (`1nLn632hAy9bbjv8`, 55 nodes) was not touched** — its
`updatedAt` is still `2026-07-12`, six weeks before this deploy.

### Before it can do anything

1. Attach credentials — WhatsApp API + WhatsApp Trigger (`04_setup/meta_setup.md`, steps 4–6)
2. Paste the prompt into the **AI Agent** node's `systemMessage`, replacing the
   `--- PEGA AQUI EL PROMPT ---` placeholder (`02_prompts/whatsapp_agent_prompt_v1.txt`)
3. Attach an OpenAI credential to the **OpenAI Chat Model** node
4. Attach a Postgres credential to the **Postgres Chat Memory** node
5. Only then set it active

### Also found on the instance

There are seven `WF1`–`WF7` workflows that belong to **Masoumi**, not Bayton — `WF6 -
After-Hours Handler` runs on the path `masoumi-after-hours`. No conflict with anything here.

Worth borrowing later: Masoumi's after-hours handler logs a callback request to Sheets and
emails the admin instead of transferring a call. That is a cleaner answer to the out-of-hours
`transfer_call` problem than the prompt-only fix above.

---

# 2026-08-25 — WhatsApp LIVE on Twilio Sandbox ✅

Meta Cloud API is blocked: the `Ambition ai` portfolio is **Unverified**, so WhatsApp Manager
shows `Account Restricted` and the "Add phone number" button is disabled outright
("Action not available because account is restricted"). Business verification needs company
registration documents, which do not exist until the autónomo application lands.

> Correction to `04_setup/meta_setup.md`: it claimed the unverified 250-conversation tier was
> enough to start. It is not — verification gates adding *any* number, not just messaging.

So the test path moved to the **Twilio WhatsApp Sandbox**, which needs no verification.

| | |
|---|---|
| Workflow | `x6gXoVL9AVoh3R77` — **Bayton WhatsApp Agent (Twilio Sandbox)** — ACTIVE |
| Webhook | `${N8N_URL}/webhook/<WEBHOOK_PATH>` |
| Sandbox number | `+1 415 523 8886`, join code `join higher-welcome` |
| Model | **gpt-4.1-mini** |
| Memory | Simple Memory (buffer), keyed on wa_id |
| Credential | `openAiApi` id `Y3jjeSEYIcreRYdr` |

## Verified working

```
"¿tienen hueco el lunes a las once?"
  -> asks for the service. Books NOTHING. (the invented-patient case)
"quiero cita mañana a las 10"
  -> "necesito tu nombre y apellidos"  - asks, does not invent
"¿dónde estáis?"
  -> the CORRECT address, from the inlined clean KB
"hello, do you do implants?"
  -> switches to English, real treatment list from the KB
```

Round trip: **~1.4s**.

## Three real bugs found and fixed

**1. `gpt-5-mini` cannot drive n8n tool calls.** It returns tool arguments as a JSON *string*
rather than an object, and n8n's `N8nTool.call` rejects it:

```
Received tool input did not match expected schema  ✖ Required → at
output: "{\"required_time\":\"2026-08-31T11:00:00\"}"
```

The arguments were correct — the encoding was not. `gpt-4.1-mini` works and is also ~4x faster
here (1.4s vs 5-7s). This was NOT a schema problem; two rounds were spent rewriting the tool
schemas before the model turned out to be the cause.

**2. `gpt-5-mini` rejects an explicit temperature.** `Unsupported value: 'temperature' does not
support 0.3 with this model. Only the default (1) value is supported.` The `options` object on
the chat model node is now empty.

**3. Replies need no Twilio credential.** n8n answers the webhook with TwiML on the same HTTP
response, so no Account SID or Auth Token is stored anywhere.

## What this does NOT solve

The sandbox is a **shared** Twilio number. The name, avatar and number the patient sees are
Twilio's, and none of them can be changed. Own number + `Bayton Dental` branding still requires
Meta business verification — via the clinic's own documents, per the plan in `00_START_HERE.md`.

## Still to do

- [ ] Simple Memory -> Postgres (buffer memory is lost on n8n restart)
- [ ] Error path lane is not wired on the Twilio variant
- [ ] `<BOT_WORKFLOW_ID>` (Meta variant) still carries the same `$fromAI` tool bodies, still
      inactive — it needs the same model swap before it is ever used
- [ ] Name clash: this prompt says "Marta", the live voice agent says "Laura"
