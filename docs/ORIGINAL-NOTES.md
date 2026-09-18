# Bayton WhatsApp Agent — roadmap

Built 2026-08-24.

> ## ⚠️ The existing system was not touched
> The live agent, the phone number, n8n and the calendar are all exactly as they were.
> A **new** Retell agent and a **new** n8n workflow were created alongside them
> → `06_deployed/DEPLOYED.md`. The workflow is inactive and has no credentials, so it cannot
> run; the phone still points at the old agent.

---

## What this is

The Bayton voice agent already has a working booking engine. This folder is the plan for
putting **WhatsApp** on the same engine, plus the fixes the voice agent needs first.

The key fact that makes it cheap:

> **The n8n workflow knows nothing about phones.** It routes on `body.args.action` and answers
> in plain JSON. Anything that can POST that shape gets the same calendar, the same validation,
> the same 4-digit codes. Zero backend changes.

So WhatsApp is a new *front door*, not a new system.

---

## The folder

| | |
|---|---|
| `01_workflow/` | n8n workflow, import-ready. 27 nodes, links validated. |
| `02_prompts/` | The WhatsApp agent prompt + the voice agent fixes (not applied) |
| `03_templates/` | WhatsApp message templates to submit to Meta |
| `04_setup/` | Meta walkthrough + the clinic call-forwarding runbook |
| `05_cleanup/` | How to remove the invented booking 9016 |
| `06_deployed/` | **What actually went live**, backups, and how to roll back |

---

## Order of work

### 🔴 1. Fix the invented-patient bug — before anything else

The agent fabricated a whole patient and booked a real appointment (code 9016). The cause is
**not** weak prompt wording: `tool_call_strict_mode: true` marks every parameter required, so
the model fills blanks rather than wait for the caller.

This gets worse on WhatsApp, where the model has more room to reason itself into a guess.

**Already built and deployed as a new agent** — `Laura NULLFIX (bayton) - TEST`,
`agent_362ab8e5e3b2c54688da5e7200`. The phone still points at the old one.

→ Test it: `06_deployed/DEPLOYED.md`. Run the trigger message 5 times before moving on.
→ Reasoning, and the manual version: `02_prompts/VOICE_FIXES_not_applied.md`

### 2. Buy the SIM

Prepaid, passport only, ~10€, Lycamobile / Digi / Vodafone. **Do not install WhatsApp on it.**
Instant — you walk out with a working number.

### 3. Register it with Meta 🔑

→ `04_setup/meta_setup.md`

This is the load-bearing test of the whole plan. If Meta accepts the number, the scaling model
works. If it rejects it, stop and change provider — don't buy more numbers first.

### 4. Submit the templates

→ `03_templates/whatsapp_templates.md`

Approval is minutes to ~24h, so submit early and in parallel with everything else. These are
what let notifications leave email.

### 5. Import and wire the workflow

→ `01_workflow/` + steps 6–9 of `04_setup/meta_setup.md`

### 6. Then, and only then, the clinic's phone line

→ `04_setup/clinic_forwarding.md`

Two codes on their handset, all the logic in your panel, cancellable in ten seconds.

---

## Two things worth understanding before you build

### WhatsApp cannot be forwarded

Voice forwards; WhatsApp does not. There is no "if no answer" for a chat. And a number is on
**either** the WhatsApp app **or** the Cloud API — never both.

So if you migrate the clinic's existing WhatsApp number to the API, they lose it from their
phone. For a trial that is fatal.

**Start with a separate number.** Their WhatsApp stays exactly as it is, the AI sits on a new
one, risk is zero. Later, when they trust it, **Chatwoot** on the Hetzner box gives them a real
shared inbox with human takeover — that is the version where their own number can move over.

### The phone number is free on WhatsApp

Meta hands you the sender's number with every message. That removes one of the five required
booking fields *and* one of the fields the agent was inventing. The prompt uses it directly and
never asks.

---

## What this unlocks that voice cannot do

| | Voice | WhatsApp |
|---|---|---|
| Book / reschedule / cancel | ✅ | ✅ |
| Answer clinic questions | ✅ | ✅ |
| **Appointment reminders** | ❌ | ✅ |
| **Waitlist alerts** | email only | ✅ |
| **Written record for the patient** | ❌ | ✅ |

Reminders are the one with real money behind it — no-shows are a dental clinic's largest
invisible cost, and a phone agent structurally cannot push a message.

---

## Still open

- [x] Fix 1 built and deployed as a new agent (the old one untouched)
- [ ] Fix 1 **verified** — 5 clean runs in Test LLM chat
- [x] New n8n API key issued (no expiry) and `.env` updated
- [x] n8n workflow created via API — `<BOT_WORKFLOW_ID>`, **inactive**
- [ ] Credentials attached to it (WhatsApp, OpenAI, Postgres) + prompt pasted in
- [ ] SIM bought
- [ ] **Meta accepts the number** ← everything downstream depends on this
- [ ] Templates approved
- [ ] Workflow imported, prompt pasted, credentials attached
- [ ] Tested end to end from your own phone
- [ ] Zadarma: pick the **$0 / $2** Madrid line, not the **$40 / $6** one; documents were
      `En verificación`
- [ ] Twilio is on Trial across all three accounts — real SMS needs an upgrade. WhatsApp does
      not go through Twilio, so it is not blocked by this.
- [ ] Booking 9016 cleaned up (after Fix 1)
- [ ] Reminder workflow (Schedule Trigger → tomorrow's calendar → template 2) — not built
- [ ] Chatwoot — later, when the clinic commits

---

## Reference

| | |
|---|---|
| Webhook | `${N8N_URL}/webhook/<WEBHOOK_PATH>` |
| Auth header | `x-webhook-token: <WEBHOOK_TOKEN>` |
| Body shape | `{"args":{"action":"...", ...}}` — must be wrapped in `args` |
| Actions | `availability` `book` `reschedule` `canceling` `suggesting` `suggesting2` `waitlist_add` |
| Live voice agent | `agent_1a11451d9f116f6d163c5e17c2` (Marta) |
| Source workflow | `cloude\Bayton Clinic\bayton_workflow_CURRENT.json` |
| Hours | Mon–Thu 10:00–20:00, Fri 10:00–14:00, closed Sat/Sun, 30-min slots, Europe/Madrid |
