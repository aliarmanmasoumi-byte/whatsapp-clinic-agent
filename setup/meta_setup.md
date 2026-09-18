# Meta / WhatsApp Cloud API — setup walkthrough

Nothing here has been done. This is the sequence to follow once you have the SIM.

---

## Before you start

**You need a phone number that is NOT on WhatsApp.**

If the number has ever been used in the normal WhatsApp app, delete that account first
(WhatsApp → Settings → Account → Delete my account) and wait a few minutes. A number still
registered on the app **cannot** be added to Cloud API.

This is why the instruction on the prepaid SIM is: buy it, don't install WhatsApp on it.

---

## Step 1 — Business portfolio

1. Go to **business.facebook.com**
2. Create a business portfolio if you don't have one
   - Name: `Ambition AI`
   - Your own email
3. You do **not** need business verification yet — the unverified tier allows up to
   **250 business-initiated conversations per day**, which is far more than one clinic will use.
   Verification only becomes necessary at scale, and it wants company documents you don't have
   until the autónomo application lands.

## Step 2 — Add WhatsApp

1. **developers.facebook.com** → My Apps → Create App
2. Type: **Business**
3. Link it to the portfolio from step 1
4. In the app dashboard: **Add product → WhatsApp → Set up**

Meta gives you a **test number** automatically. Ignore it — it can only message numbers you
manually whitelist, and it disappears. You want your own number.

## Step 3 — Register your number 🔑 THE CRITICAL TEST

WhatsApp → API Setup → **Add phone number**

1. Enter the SIM number in full international format: `+34 6XX XXX XXX`
2. Display name: `Bayton Dental` (this is what patients see — it gets reviewed)
3. Category: `Medical and health`
4. Verification method:
   - **SMS** if it's a physical SIM ✅ this should just work
   - **Voice call** if you ever try this with a VoIP number
5. Enter the 6-digit code

> ### This is the test everything depends on
> If Meta **accepts** the number → the scaling plan works, keep going.
> If Meta **rejects** it → stop and tell me. Some number ranges are blocked and we pick a
> different provider. Do not buy more numbers before this passes.

## Step 4 — Collect the two values

From **WhatsApp → API Setup**:

| Value | Where | Looks like |
|---|---|---|
| **Phone number ID** | under the number you just added | `123456789012345` |
| **WhatsApp Business Account ID** | same page | `987654321098765` |

Then a **permanent** token — the one on screen expires in 24h and is useless:

**Business settings → Users → System users → Add**
- Name: `n8n`
- Role: Admin
- **Assign assets** → your WhatsApp account → full control
- **Generate new token** → select the app → tick `whatsapp_business_messaging`
  and `whatsapp_business_management` → Generate

⚠️ **Copy it immediately.** It is shown once and never again.

## Step 5 — Webhook

WhatsApp → Configuration → Webhook → Edit

| Field | Value |
|---|---|
| Callback URL | the URL n8n shows on the **WhatsApp Trigger** node |
| Verify token | any string you invent — paste the same one into n8n |

Then **Manage** → subscribe to **`messages`**. Only that one.

## Step 6 — Wire n8n

In n8n, create two credentials:

- **WhatsApp API** → the permanent token from step 4
- **WhatsApp Trigger** → the verify token from step 5

Then import `01_workflow/bayton_whatsapp_workflow.json` and attach them.

## Step 7 — Paste the prompt

Open the **AI Agent** node → `systemMessage`. The bottom of the field says
`--- PEGA AQUI EL PROMPT ---`. Replace that placeholder with the full contents of
`02_prompts/whatsapp_agent_prompt_v1.txt`.

Keep the three lines above it (current Madrid time, patient phone, profile name) — the workflow
fills those in on every message and the prompt depends on them.

## Step 8 — Postgres memory table

The **Postgres Chat Memory** node writes to `whatsapp_chat_memory`. n8n creates the table on
first run if the credential has rights. The database is `cloude-db` on the Hetzner box, reachable
from the host at `localhost:5432`.

## Step 9 — Test before anyone real can reach it

Message the number **from your own phone** and walk the whole flow:

- [ ] "hola" → it replies in Spanish, doesn't invent anything
- [ ] "hello" → it switches to English and stays there
- [ ] ask for a specific time → it calls `availability`, reports the truth
- [ ] book end to end → you get a 4-digit code, and the appointment is really in the calendar
- [ ] **it never asks for your phone number** (it already has it)
- [ ] 🔴 **"¿tienen hueco el lunes a las once?"** → it must ask for your name, NOT book anything.
      Run this 5 times. This is the invented-patient bug in a text channel, where it is worse.
- [ ] send a voice note → the polite "please write it" reply
- [ ] message it outside clinic hours → it says the clinic is closed and still books

---

## Costs

- Conversations the **patient** starts: free (first 1,000/month), then ~€0.03–0.05
- Conversations **you** start (templates): ~€0.03–0.05 each
- One clinic will not come close to the free tier ceiling.

The real cost is the LLM, not WhatsApp.
