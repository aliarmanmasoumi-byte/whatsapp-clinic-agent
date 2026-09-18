// Switch the three patient-facing WhatsApp sends from free-form text to approved
// UTILITY templates, so a confirmation still arrives when the patient booked by
// PHONE and has never messaged the clinic (free-form only delivers inside the
// 24h window -> error 131047).
//
//   node wire_templates.mjs            dry run: print the new nodes, change nothing
//   node wire_templates.mjs --apply    write it to the live workflow
//
// Node NAMES are preserved, so every connection in the 63-node workflow stays intact.

const TOKEN = process.env.META_ACCESS_TOKEN;
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const n8nKey = process.env.N8N_API_KEY;
const N8N = process.env.N8N_URL + '/api/v1';
const WF = process.env.N8N_WORKFLOW_ID;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const CRED = { whatsAppApi: { id: '4nAwxJnkGb3evISc', name: 'WhatsApp Ambition Clinic' } };

const W = "$('Webhook').item.json.body.args";
// the existing, already-proven recipient expressions — reused verbatim
const toBooking = `(((${W}.phone || '').toString().replace(/[^0-9]/g,'')).length === 9 ? '34' : '') + ((${W}.phone || '').toString().replace(/[^0-9]/g,''))`;
const toFromEvent = (src) => `((((($('${src}').item.json.description || '').split('\\n').map(l => l.trim()).find(l => !l.includes('@') && l.replace(/[^0-9]/g,'').length >= 8) || '').replace(/[^0-9]/g,''))).length === 9 ? '34' : '') + (((($('${src}').item.json.description || '').split('\\n').map(l => l.trim()).find(l => !l.includes('@') && l.replace(/[^0-9]/g,'').length >= 8) || '').replace(/[^0-9]/g,'')))`;

const D = (iso) => `DateTime.fromISO(${iso}).setLocale('es').toFormat("cccc d 'de' LLLL")`;
const T = (iso) => `DateTime.fromISO(${iso}).toFormat("HH:mm")`;

// Meta template payload. Parameter order MUST match {{1}}..{{n}} in the approved body.
const payload = (to, name, params) => `={{ JSON.stringify({
  messaging_product: "whatsapp",
  to: ${to},
  type: "template",
  template: {
    name: "${name}",
    language: { code: "es" },
    components: [{ type: "body", parameters: [${params.map((p) => `{ type: "text", text: String(${p}) }`).join(', ')}] }]
  }
}) }}`;

const httpNode = (old, name, tmpl, params, to) => ({
  ...old,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  parameters: {
    method: 'POST',
    url: `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'whatsAppApi',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: payload(to, tmpl, params),
    options: {},
  },
  credentials: CRED,
});

const r = await fetch(`${N8N}/workflows/${WF}`, { headers: { 'X-N8N-API-KEY': n8nKey } });
const wf = await r.json();
const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));

const plan = [
  { node: 'Send a booking email', tmpl: 'cita_confirmada', to: toBooking,
    params: [`${W}.name`, D(`${W}.booking_time`), T(`${W}.booking_time`), `${W}.service`, `$('Generate code').item.json.appointment_code`] },
  { node: 'Send a message', tmpl: 'booking_rescheduled', to: toFromEvent('Get many events1'),
    params: [`${W}.name`, D(`${W}.booking_time1`), D(`${W}.reschedule_time1`), T(`${W}.reschedule_time1`)] },
  { node: 'Send a message1', tmpl: 'booking_cancelled', to: toFromEvent('Get many events2'),
    params: [`${W}.name`, D(`${W}.time1`), T(`${W}.time1`)] },
];

// sanity: does each parameter list match the approved template's variable count?
const tj = await (await fetch('https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?limit=50&fields=name,status,components', { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
let bad = 0;
for (const p of plan) {
  const t = (tj.data || []).find((x) => x.name === p.tmpl && x.status === 'APPROVED');
  const body = (t?.components || []).find((c) => c.type === 'BODY');
  const want = new Set([...String(body?.text || '').matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])).size;
  const ok = t && want === p.params.length;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${p.node.padEnd(22)} -> ${p.tmpl.padEnd(22)} template wants ${want}, sending ${p.params.length}`);
}
if (bad) { console.error('\nparameter counts do not match — refusing to write.'); process.exit(1); }

const updated = wf.nodes.map((n) => {
  const p = plan.find((x) => x.node === n.name);
  return p ? httpNode(n, n.name, p.tmpl, p.params, p.to) : n;
});

if (!APPLY) {
  console.log('\n--- dry run, nothing written. First node would become: ---');
  console.log(JSON.stringify(updated.find((n) => n.name === 'Send a booking email').parameters, null, 1).slice(0, 1200));
  console.log('\nrun again with --apply to write it.');
  process.exit(0);
}

const put = await fetch(`${N8N}/workflows/${WF}`, {
  method: 'PUT',
  headers: { 'X-N8N-API-KEY': n8nKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: wf.name, nodes: updated, connections: wf.connections, settings: wf.settings }),
});
console.log(`\nPUT ${put.status}`);
if (!put.ok) console.error(String(await put.text()).slice(0, 400));
else {
  const after = await (await fetch(`${N8N}/workflows/${WF}`, { headers: { 'X-N8N-API-KEY': n8nKey } })).json();
  for (const p of plan) {
    const n = after.nodes.find((x) => x.name === p.node);
    console.log(`  ${p.node.padEnd(22)} type=${n.type.split('.').pop().padEnd(12)} template=${/template/.test(JSON.stringify(n.parameters)) ? p.tmpl : 'NOT SET'}`);
  }
  console.log(`  workflow active: ${after.active}, nodes: ${after.nodes.length}`);
}
