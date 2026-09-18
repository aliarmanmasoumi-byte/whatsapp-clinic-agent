// One booking through the live webhook, to confirm the template wiring works.
// Sends exactly ONE real WhatsApp (the confirmation), then deletes the calendar
// event it created. Authorised by the owner for their own number.

const HOOK = process.env.N8N_BOOKING_WEBHOOK;
const TOKEN_HDR = process.env.WEBHOOK_TOKEN;
const PHONE = process.argv[2] || process.env.TEST_PHONE;

// next Tuesday at 17:30 — well clear of anything real
const d = new Date();
d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7 || 7));
const slot = `${d.toISOString().slice(0, 10)}T17:30:00`;

const call = async (args) => {
  const r = await fetch(HOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-token': TOKEN_HDR },
    body: JSON.stringify({ args }),
  });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, json: j };
};

console.log(`booking ${slot} for ${PHONE} (one real WhatsApp will be sent)\n`);

const book = await call({ action: 'book', name: 'Prueba Plantilla', phone: PHONE, service: 'Limpieza dental', booking_time: slot });
console.log('book ->', book.status, JSON.stringify(book.json).slice(0, 250));

const code = book.json?.appointment_id;
if (!code) { console.error('\nno appointment_id came back — stopping, nothing to clean up.'); process.exit(1); }

console.log('\nwaiting 12s for the WhatsApp send to run…');
await new Promise((r) => setTimeout(r, 12000));

const cancel = await call({ action: 'canceling', name: 'Prueba Plantilla', time1: slot, appointment_id: code });
console.log('cleanup cancel ->', cancel.status, JSON.stringify(cancel.json).slice(0, 200));
console.log('\nNOTE: the cancel also fires the booking_cancelled template, so expect TWO messages:');
console.log('  1. cita_confirmada     (the one being tested)');
console.log('  2. booking_cancelled   (from cleaning the test event up)');
