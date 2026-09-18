# WhatsApp clinic agent

**A WhatsApp booking assistant for a dental clinic, on the official Meta Cloud API.** A
patient texts the clinic's number; the agent answers in their language, finds a real free
slot, books it, and can reschedule or cancel later in the same thread.

`WhatsApp Cloud API` · `n8n` · `gpt-4.1-mini` · `Postgres` chat memory · `Google Calendar`

Live and verified end to end. Same booking backend as the [voice agent](../dental-voice-agent) —
one calendar, two front doors.

---

## Shape

```
patient texts the clinic
        │
        ▼
 WhatsApp Trigger  ─ verifies x-hub-signature-256
        │
   parse + guard
        │
   AI Agent  (gpt-4.1-mini, knowledge base inlined, Postgres chat memory per thread)
        │  7 HTTP tools, each sending x-webhook-token
        ▼
 booking backend ── availability · book · reschedule · cancel · lookup
        │
        ▼
 Google Calendar          + a WhatsApp template message back to the patient
```

Two workflows, deliberately separate: the **bot** (27 nodes — conversation) and the **booking
backend** (shared with the phone agent). Mixing them up was the single worst day of this build.

---

## Four things that cost real hours

**A dead model key logs zero errored executions.** The `AI Agent` node is configured
`continueErrorOutput`, so when the OpenAI key ran out of credit n8n marked every run
**success**. The bot was completely dead while every diagnostic said it was healthy. If it is
silent, check the model key before you check anything else.

**An unsigned test POST returns 200 and does nothing.** The WhatsApp Trigger verifies
`x-hub-signature-256`, so hand-rolled test requests are accepted and silently dropped —
no execution, no error, no message. Test through the real number or not at all.

**200 + a wamid does not mean delivered.** Outside the 24-hour customer-service window a
free-form message is accepted, given an id, and never shown to anyone (error 131047). After
24 hours only an approved template goes through.

**gpt-5 models reject an explicit `temperature`.** Setting it at all is the error, not the
value.

---

## Layout

```
workflow/    the bot workflow, exported
prompts/     the agent prompt
templates/   the approved message templates and the parameters each expects
setup/       registering the number with Meta, and forwarding from the clinic's own line
tools/       runnable diagnostics — template status, node wiring, last send, one test booking
docs/        operations notes: what exists, how it breaks, and the symptom table
```

```bash
cp .env.example .env
node tools/templates_status.mjs    # what Meta has approved right now
node tools/check_wiring.mjs        # are the nodes sending templates or free-form text?
node tools/check_last_send.mjs     # what the last executions actually sent
```

`tools/test_template_send.mjs` sends exactly one real message and then deletes the calendar
event it made. It defaults to a dummy number on purpose — sending test messages to a real
person's phone without warning them is its own kind of bug.
