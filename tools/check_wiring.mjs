// Are the n8n WhatsApp nodes still sending free-form text, or templates?
// And what parameters does each approved template actually expect?

const TOKEN = process.env.META_ACCESS_TOKEN;

const WABA = process.env.WABA_ID;
const N8N = process.env.N8N_URL + '/api/v1';
const n8nKey = process.env.N8N_API_KEY;

// --- template bodies, so we know the parameter count each one needs
const r = await fetch(`https://graph.facebook.com/v21.0/${WABA}/message_templates?limit=50&fields=name,language,status,components`, { headers: { Authorization: `Bearer ${TOKEN}` } });
const tpls = (await r.json()).data || [];
console.log('APPROVED TEMPLATES AND THE PARAMETERS THEY EXPECT\n');
for (const t of tpls.filter((x) => x.status === 'APPROVED' && x.name !== 'hello_world')) {
  const body = (t.components || []).find((c) => c.type === 'BODY');
  const text = String(body?.text || '');
  const vars = [...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]);
  console.log(`${t.name}  (${vars.length} parameter${vars.length === 1 ? '' : 's'}: ${vars.join(', ') || 'none'})`);
  console.log('  ' + text.replace(/\n/g, '\n  ') + '\n');
}

// --- how the workflow currently sends
if (!n8nKey) { console.log('No n8n API key found in .env — skipping the workflow check.'); process.exit(0); }
const wf = await fetch(`${N8N}/workflows/${process.env.N8N_WORKFLOW_ID}`, { headers: { 'X-N8N-API-KEY': n8nKey } });
if (!wf.ok) { console.log(`n8n ${wf.status} — cannot read the workflow.`); process.exit(0); }
const j = await wf.json();
const nodes = (j.nodes || []).filter((n) => /whatsApp/i.test(n.type));
console.log(`\nWHATSAPP NODES IN "${j.name}" (active: ${j.active})\n`);
for (const n of nodes) {
  const p = n.parameters || {};
  const mode = p.messageType || p.operation || '(unset)';
  const usesTemplate = /template/i.test(JSON.stringify(p));
  console.log(`  ${String(n.name).padEnd(30)} messageType=${String(mode).padEnd(12)} template? ${usesTemplate ? 'YES' : 'NO — free-form text'}`);
}
