# Voice agent fixes — WRITTEN, NOT APPLIED

Nothing in this file has been pushed to Retell. The live agent is untouched.

Target: **Marta (bayton)** — `agent_1a11451d9f116f6d163c5e17c2` / LLM `llm_aaaac21c54a0c875508fc50e4b86`
(the agent the phone `<CLINIC_PHONE_US>` currently points at)

Current prompt on disk: `cloude\Bayton Clinic\prompts\marta_PROMPT_v3_2026-08-16_cleanKB.txt`

Apply these in one PATCH when you're ready. Back up first:
```
GET /get-retell-llm/llm_aaaac21c54a0c875508fc50e4b86   ->  backups/
```

---

## FIX 1 — the invented patient 🔴

### What happened
On 2026-08-20, one message ("¿tienen hueco el lunes a las once?") made the agent call
`availability` and then immediately `appointment` with a **completely fabricated patient**:

| Field | Invented value |
|---|---|
| name | María López |
| Email | maria.g@example.com |
| phone | 612345678 |
| service | Revisión y limpieza |

It created a **real calendar booking** — code **9016**, Mon 2026-08-24 11:00.

### Why the current prompt didn't stop it
The prompt already says *"ALL FIVE are required — NEVER call the appointment tool while any is missing"*.
It was ignored, because that's a prompt rule fighting a **schema** rule.

`tool_call_strict_mode: true` marks every parameter `required`. The model is handed a schema
that says it *must* produce all five strings. Faced with "produce all five" versus "wait for the
caller", the schema wins — so it fills the blanks with the most plausible-looking values.

**You cannot fix this with prompt wording alone.** The schema has to stop demanding the values.

### The fix — three parts, all three needed

**1a. Make the collectable params nullable in the `appointment` tool schema.**

Change each of `name`, `Email`, `service` from:
```json
{ "type": "string", "description": "..." }
```
to:
```json
{ "type": ["string", "null"], "description": "... Pass null if the caller has not said it yet. NEVER invent a value." }
```

Leave `booking_time` as a plain string (it always comes from the conversation or a tool),
and leave `phone` alone on voice.

> If `tool_call_strict_mode` cannot accept a nullable union on your Retell version,
> the fallback is to set `tool_call_strict_mode: false` for this agent and rely on 1b + 1c.
> Test this before assuming it works.

**1b. Add this block to the prompt**, immediately after `# The golden rule of honesty`:

```
# The anti-invention rule
Before you call `appointment` or `waitlist_add`, check each field one at a time and ask
yourself: "Did the caller actually say this, out loud, on this call?"
- If the answer is no for ANY field, pass null for it and ASK the caller. Do not call the tool
  with a value you were not given.
- Never fill a field with a plausible-sounding placeholder. Not "María López", not
  "maria@example.com", not "612345678", not "Revisión y limpieza".
- A null field is always better than a guessed one. A guessed field books a real appointment
  for a person who does not exist.
- If you are unsure whether they told you something, assume they did not, and ask.
```

**1c. Add one line to the `# Booking an appointment` section**, right after "all are required":

```
If you are about to call `appointment` and any of the five came from your own head rather than
from the caller's mouth, that is a bug — stop, pass null, and ask for it instead.
```

### How to verify the fix
Re-run the exact message that caused it, in Test LLM chat:

> ¿tienen hueco el lunes a las once?

**Pass:** the agent calls `availability`, reports the result, then asks for the name.
**Fail:** any call to `appointment` on that turn.

Run it 5 times — this is a probabilistic failure, one clean run proves nothing.

---

## FIX 2 — `transfer_call` at 3am goes nowhere

### The problem
The prompt currently sends the caller to `transfer_call` (→ `<CLINIC_PHONE_ES>`) for:
- emergencies
- services we don't offer
- upset callers
- unclear intent

Outside 10:00–20:00 Mon–Thu / 10:00–14:00 Fri, **nobody is there**. The caller is transferred
into a line that rings out. That is worse than the agent saying nothing.

This is not currently a live bug because the number is US-based and on a Twilio trial, but it
becomes one the moment the clinic's real line is forwarded to the agent — which is the whole
after-hours plan in `04_setup/clinic_forwarding.md`.

### The fix
Add a `# Out of hours` section to the prompt:

```
# Out of hours
You know the clinic hours and you know the current time. If the clinic is CLOSED right now:
- Booking, rescheduling and cancelling all still work normally. Do them.
- NEVER use `transfer_call` — there is nobody at reception to answer it. Instead say that
  reception will call them back on the next working day, and make sure you have their number.
- For a real medical emergency (severe pain, heavy bleeding, trouble breathing, facial
  swelling, a tooth knocked out by trauma) tell them to hang up and call 112 immediately.
  This does not change out of hours — 112 is always the answer.
- Never tell a caller to "call the clinic" when the clinic is closed.
```

---

## FIX 3 — the greeting doesn't know the clinic is shut

### The problem
`begin_message` is always *"Bayton Dental, soy Marta. ¿En qué puedo ayudarle?"* — at 03:00 on a
Sunday too. It reads as if the desk is staffed.

### The fix
Retell's `begin_message` is a static string, so the honest version has to come from the prompt's
first turn rather than the greeting. Add to `# How you talk`:

```
- If the clinic is closed at the moment of the call, say so in your first reply after the
  greeting, in one short line, and immediately offer what you CAN do:
  "Ahora mismo la clínica está cerrada, pero le puedo dejar la cita agendada sin problema."
  Say it once. Do not repeat it later in the call.
```

---

## Order to apply

1. **Fix 1 first, and verify it**, before anything else goes live. It is the only one that
   creates fake data in a real calendar.
2. Fixes 2 and 3 only start to matter when a real clinic line is forwarded to the agent.
   They can wait for that day, but they should go in before it.

## What NOT to change while you're in there
- Turn-taking settings (responsiveness 0.85, interruption_sensitivity 0.5, backchannel off) —
  these were tuned over a full session, leave them.
- The knowledge base attachment (`knowledge_base_5a7f2dffe3494ac7`).
- The model (`gpt-5-mini`) or the voice (`custom_voice_3f02e539b03866ed04e8fa2d67`).
