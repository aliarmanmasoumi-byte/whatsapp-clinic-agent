// Current status of the WhatsApp message templates, straight from Meta.

const WABA = process.env.WABA_ID;

// the permanent system-user token
const TOKEN = process.env.META_ACCESS_TOKEN;
if (!TOKEN) { console.error('set META_ACCESS_TOKEN'); process.exit(1); }

const g = async (p) => {
  const r = await fetch(`https://graph.facebook.com/v21.0/${p}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  return { status: r.status, json: await r.json().catch(() => null) };
};

const r = await g(`${WABA}/message_templates?limit=50&fields=name,language,status,category,rejected_reason,quality_score,id,components`);
if (r.status !== 200) { console.error(`Graph error ${r.status}: ${JSON.stringify(r.json).slice(0, 400)}`); process.exit(1); }

const t = r.json.data || [];
console.log(`${t.length} templates on WABA ${WABA}\n`);
console.log('name                     lang   status        category      rejected_reason');
console.log('-'.repeat(84));
for (const x of t) {
  console.log(`${String(x.name).padEnd(25)}${String(x.language).padEnd(7)}${String(x.status).padEnd(14)}${String(x.category).padEnd(14)}${x.rejected_reason && x.rejected_reason !== 'NONE' ? x.rejected_reason : ''}`);
}

const pend = t.filter((x) => x.status === 'PENDING');
const appr = t.filter((x) => x.status === 'APPROVED');
const rej = t.filter((x) => x.status === 'REJECTED');
console.log(`\napproved ${appr.length}   pending ${pend.length}   rejected ${rej.length}`);

const needed = ['cita_confirmada', 'booking_rescheduled', 'booking_cancelled'];
console.log('\nthe three the booking flow needs:');
for (const n of needed) {
  const found = t.find((x) => x.name === n);
  console.log(`  ${n.padEnd(22)} ${found ? found.status + (found.rejected_reason && found.rejected_reason !== 'NONE' ? '  (' + found.rejected_reason + ')' : '') : 'NOT FOUND'}`);
}

// show the body of any rejected one so the wording can be fixed
for (const x of rej) {
  const body = (x.components || []).find((c) => c.type === 'BODY');
  console.log(`\nREJECTED "${x.name}" body:\n  ${String(body?.text || '').replace(/\n/g, '\n  ')}`);
}
