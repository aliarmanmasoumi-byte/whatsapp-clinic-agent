# Forwarding the clinic's line to the agent

Nothing here has been done. This is the runbook for the day the clinic says yes.

---

## The principle: all the logic on YOUR side

Do **not** ask for their operator login, and do not configure schedules inside their account.
You would need them for every future change, and you would be holding their credentials.

```
patient → clinic's own number → [no answer / busy] → your number → PBX → Retell
                                                                    ↑
                                                    every rule lives here, in your panel
```

The clinic does exactly one thing, once: dial two codes.

---

## Why conditional, not scheduled

The obvious approach is a timetable: 10:00–20:00 → humans, otherwise → agent. Don't.
Use **no-answer + busy** forwarding instead, and you get this for free:

| Situation | Who answers |
|---|---|
| Daytime, reception free | a human |
| Daytime, reception on another call | the agent |
| Lunch, someone stepped away | the agent |
| Night, weekend | the agent |
| **Madrid local holidays** | the agent, automatically |

A timetable needs a holiday list that someone has to maintain every year. Conditional
forwarding never needs touching. It also catches the missed midday call, which is the part the
clinic can actually feel in revenue.

## 🚨 Never use `*21*`

`*21*` is **unconditional** — every call goes to the agent, including 11am on a Tuesday.
Patients get a robot when a human was sitting right there. This is the single mistake that
ends a trial.

---

## Step 1 — Find out what line they have

Ask before you go:
- Fixed (91x) or mobile (6xx)?
- Which operator?
- Plain line, or a centralita virtual?

## Step 2 — The safe probe

On their phone, dial:

```
*#61#
```

This **only reads** the current status. It changes nothing. Zero risk.

- **Returns a status message** → the codes work, go to step 3
- **Error, or nothing happens** → codes are disabled on this line, use step 4

## Step 3 — Codes (mobile: reliable; fixed: only if the probe worked)

| Purpose | Code |
|---|---|
| No answer → your number | `*61*YOURNUMBER#` |
| No answer, with ring delay | `*61*YOURNUMBER**20#` (seconds, multiples of 5) |
| Busy → your number | `*67*YOURNUMBER#` |
| Unreachable → your number | `*62*YOURNUMBER#` |
| Check status | `*#61#` · `*#67#` |
| **Cancel** | `##61#` · `##67#` |

20 seconds ≈ 4–5 rings. Long enough that reception gets a fair chance, short enough that the
patient doesn't give up.

## Step 4 — Operator panel (most fibre landlines)

| Operator | Path |
|---|---|
| Movistar | Mi Movistar app → Tu línea fija → Desvíos |
| Vodafone | Mi Vodafone → Mi línea fija → Desvío de llamadas |
| Orange / Jazztel | Área Cliente → Mi línea fija → Desvíos |
| Digi | their app (fewer options) |

They log in, you guide. Never take the password.

---

## Before you go: rehearse on your own SIM

Do not test for the first time on a client's phone.

1. Point your own prepaid SIM at your VoIP number with `*61*`
2. VoIP number → SIP → Retell
3. Call your SIM, let it ring out
4. The agent should pick up

Only when that works end to end do you touch the clinic's phone.

---

## On the day

- [ ] A quiet hour. Not Monday morning.
- [ ] Dial `*#61#` first
- [ ] Set `*61*` with a 20s delay, then `*67*`
- [ ] Test 1: call, let it ring out → agent answers
- [ ] Test 2: call while their line is busy → agent answers
- [ ] Test 3: call and have reception pick up immediately → **the human answers, not the agent**
      (this is the one that proves you didn't set `*21*`)
- [ ] Hand them the cancel codes **on paper**

## The paper you leave behind

> **To switch the assistant off — 10 seconds, any time**
>
> Dial `##61#`, then `##67#`
>
> Everything goes back exactly as it was. No contract, no porting, nothing to undo.

That card is your strongest sales argument. A clinic that knows it can walk away in ten seconds
says yes far more easily than one that thinks it is committing.

---

## Blocked on

Two things must exist first, and neither is done:

1. **A Spanish number bound to Retell.** Zadarma order is started, documents were in
   `En verificación`, and the wrong tier was selected — pick the `$0 connection / $2 monthly`
   Madrid line, not the `$40 / $6` one.
2. **Fix 1 in `02_prompts/VOICE_FIXES_not_applied.md`.** Do not forward a real clinic's patients
   into an agent that still invents bookings.
