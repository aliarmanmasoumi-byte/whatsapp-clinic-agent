# WhatsApp message templates — drafts for Meta approval

Nothing here has been submitted. These are the texts to paste into
**Meta Business Suite → WhatsApp Manager → Message templates → Create template**.

---

## Why templates exist (the 24-hour rule)

WhatsApp splits every message into two kinds:

| | When | Needs a template? | Cost |
|---|---|---|---|
| **Reply** | within 24h of the patient's last message | ❌ no, write anything | free |
| **Business-initiated** | more than 24h later, or first contact | ✅ yes, pre-approved | paid per conversation |

Everything the booking agent says while the patient is chatting is a **reply** — no template
needed, that is why `01_workflow` has none.

Templates are only for the messages **we** start: the confirmation that arrives later, the
reminder the day before, the waitlist alert. Those are exactly the ones replacing email.

**Approval takes minutes to ~24h.** Submit all four at once, early — they are the long pole.

---

## Naming and language

- Category: **UTILITY** for all four (not MARKETING — utility is cheaper and approves faster,
  and these are all transactional).
- Language: create each one **twice**, `es` and `en`. The agent picks by the patient's language.
- Template names must be lowercase with underscores.

---

## 1. `cita_confirmada` / `appointment_confirmed`

Replaces the Gmail confirmation. Sent right after a successful booking.

**Spanish**
```
Hola {{1}}, su cita en Bayton Dental está confirmada.

📅 {{2}}
🦷 {{3}}
🔑 Código: {{4}}

Guarde el código para cualquier cambio. Calle de las Mártires Concepcionistas 13, Izquierda, 28006 Madrid.
```

**English**
```
Hi {{1}}, your appointment at Bayton Dental is confirmed.

📅 {{2}}
🦷 {{3}}
🔑 Code: {{4}}

Keep the code for any changes. Calle de las Mártires Concepcionistas 13, Izquierda, 28006 Madrid.
```

| Var | Fill with | Example |
|---|---|---|
| {{1}} | patient name | María |
| {{2}} | day + time, spelled out | miércoles 27 de agosto, 16:30 |
| {{3}} | service | Revisión y limpieza |
| {{4}} | appointment_id from the tool | 9016 |

---

## 2. `recordatorio_cita` / `appointment_reminder`

**This is the one voice can never do.** Sent ~24h before the appointment.
Worth real money to the clinic — no-shows are their biggest silent cost.

**Spanish**
```
Hola {{1}}, le recordamos su cita en Bayton Dental mañana {{2}}.

Si no puede venir, respóndanos a este mensaje y se la cambiamos. Su código es {{3}}.
```

**English**
```
Hi {{1}}, a reminder of your appointment at Bayton Dental tomorrow {{2}}.

If you can't make it, just reply to this message and we'll move it. Your code is {{3}}.
```

> A reply to this message opens a fresh 24h window — so the patient can reschedule in the same
> thread, with no template and no extra cost. That is the whole point of putting the reminder on
> WhatsApp instead of SMS.

**Needs a separate n8n workflow** (Schedule Trigger → read tomorrow's calendar → send). Not built
yet — it is on the roadmap in `00_START_HERE.md`.

---

## 3. `lista_espera_libre` / `waitlist_slot_free`

Sent when a waitlisted slot frees up. Currently this goes out by email.

**Spanish**
```
Hola {{1}}, se ha liberado el hueco que quería: {{2}}.

Si lo quiere, respóndanos en las próximas horas y se lo asignamos. Su código actual es {{3}}. Por orden de llegada.
```

**English**
```
Hi {{1}}, the slot you wanted has just freed up: {{2}}.

If you still want it, reply in the next few hours and it's yours. Your current code is {{3}}. First come, first served.
```

---

## 4. `cita_cancelada` / `appointment_cancelled`

Confirms a cancellation the clinic made (not one the patient just asked for in-chat — that one
is a normal reply).

**Spanish**
```
Hola {{1}}, su cita del {{2}} en Bayton Dental ha sido cancelada.

Si quiere otra fecha, respóndanos a este mensaje y se la buscamos.
```

**English**
```
Hi {{1}}, your appointment on {{2}} at Bayton Dental has been cancelled.

If you'd like another date, reply to this message and we'll find you one.
```

---

## Rejection traps

Meta rejects templates for reasons that are not obvious. Avoid all of these:

- ❌ **Two variables side by side** — `{{1}} {{2}}` is auto-rejected. Always put a word between them.
- ❌ **Starting or ending the body with a variable.**
- ❌ **Anything that reads like marketing** — "oferta", "descuento", "¡No se lo pierda!"
- ❌ **A URL with a variable in it**, unless you set it up as a proper dynamic button.
- ❌ Placeholder examples that don't look real. Meta asks for a sample of each variable — give
  it `María` and `miércoles 27 de agosto, 16:30`, not `xxx` or `test`.

If one is rejected, the reason appears in WhatsApp Manager. You can edit and resubmit; there is
no penalty.

---

## What replaces what

| Today | After templates |
|---|---|
| Gmail node → patient email (booking) | template 1 |
| Gmail node → patient email (waitlist) | template 3 |
| *nothing* | template 2 — new capability |
| Gmail node → admin alert on error | **keep as email** — that one is for you, not the patient |
