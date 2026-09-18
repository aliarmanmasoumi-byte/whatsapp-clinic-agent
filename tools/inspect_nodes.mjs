// Back up the live workflow, then show exactly what the three WhatsApp nodes
// send today and what data is available to them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const n8nKey = process.env.N8N_API_KEY;
const N8N = process.env.N8N_URL + '/api/v1';
const WF = process.env.N8N_WORKFLOW_ID;

const r = await fetch(`${N8N}/workflows/${WF}`, { headers: { 'X-N8N-API-KEY': n8nKey } });
if (!r.ok) { console.error(`n8n ${r.status}`); process.exit(1); }
const wf = await r.json();

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bak = path.join(DIR, 'backups', `bayton_whatsapp_${stamp}.json`);
fs.mkdirSync(path.dirname(bak), { recursive: true });
fs.writeFileSync(bak, JSON.stringify(wf, null, 1));
console.log(`backed up -> ${path.basename(bak)}  (${wf.nodes.length} nodes, active=${wf.active})\n`);

for (const n of wf.nodes.filter((x) => /whatsApp/i.test(x.type))) {
  console.log(`=== ${n.name}  [${n.type} v${n.typeVersion}] ===`);
  console.log(JSON.stringify(n.parameters, null, 1).slice(0, 1400));
  console.log();
}

// which node feeds each WhatsApp node, so we know what fields are in scope
const inbound = {};
for (const [src, conns] of Object.entries(wf.connections || {})) {
  for (const group of Object.values(conns)) {
    for (const arr of group) for (const c of arr || []) {
      (inbound[c.node] = inbound[c.node] || []).push(src);
    }
  }
}
console.log('upstream of each WhatsApp node:');
for (const n of wf.nodes.filter((x) => /whatsApp/i.test(x.type))) {
  console.log(`  ${n.name.padEnd(30)} <- ${(inbound[n.name] || []).join(', ')}`);
}
