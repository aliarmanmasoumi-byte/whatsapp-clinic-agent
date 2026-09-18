// Did Meta actually accept the template messages? A 200 from the webhook only
// means the workflow ran — the send happens further down and can fail silently.

const n8nKey = process.env.N8N_API_KEY;
const N8N = process.env.N8N_URL + '/api/v1';

const r = await fetch(`${N8N}/executions?workflowId=${process.env.N8N_WORKFLOW_ID}&limit=4&includeData=true`, { headers: { 'X-N8N-API-KEY': n8nKey } });
const j = await r.json();
const runs = j.data || [];
console.log(`last ${runs.length} executions of "bayton whatsapp"\n`);

for (const e of runs) {
  console.log(`#${e.id}  ${e.status}  ${new Date(e.startedAt).toLocaleTimeString()}`);
  const nodes = e.data?.resultData?.runData || {};
  for (const name of ['Send a booking email', 'Send a message', 'Send a message1']) {
    const nd = nodes[name];
    if (!nd) continue;
    const run = nd[0];
    if (run?.error) {
      console.log(`   ${name}: ERROR ${String(run.error.message || run.error).slice(0, 200)}`);
      continue;
    }
    const out = run?.data?.main?.[0]?.[0]?.json;
    if (!out) { console.log(`   ${name}: ran, no output captured`); continue; }
    const wamid = out.messages?.[0]?.id;
    const wa = out.contacts?.[0]?.wa_id;
    if (wamid) console.log(`   ${name}: ACCEPTED by Meta  wa_id=${wa}  wamid=${String(wamid).slice(-18)}`);
    else console.log(`   ${name}: ${JSON.stringify(out).slice(0, 220)}`);
  }
  const failed = Object.entries(nodes).filter(([, v]) => v?.[0]?.error);
  if (failed.length) console.log(`   failing nodes: ${failed.map(([k]) => k).join(', ')}`);
  console.log();
}
