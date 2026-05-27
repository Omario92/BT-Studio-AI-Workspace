/**
 * Smoke-test ComfyUI directly (no BT backend involved).
 *
 *   cd backend
 *   COMFYUI_BASE_URL=https://your-tunnel.trycloudflare.com \
 *   COMFYUI_DEFAULT_WORKFLOW_UPSCALE='{"...":{"inputs":{...}}}' \
 *   npx tsx scratch/comfyui-upscale.smoke.ts ./path/to/source.png
 *
 * Steps:
 *   1. GET  /system_stats           — confirm ComfyUI is reachable
 *   2. POST /upload/image           — upload a local sample image
 *   3. Inject filename into LoadImage node of COMFYUI_DEFAULT_WORKFLOW_UPSCALE
 *   4. POST /prompt                 — submit the workflow
 *   5. Poll /history/:promptId      — until output filename appears
 *   6. Print the /view URL          — visit it in a browser to see the result
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';

const BASE = (process.env.COMFYUI_BASE_URL || '').replace(/\/$/, '');
const WF_RAW = process.env.COMFYUI_DEFAULT_WORKFLOW_UPSCALE || '';
const LOAD_ID = process.env.COMFYUI_UPSCALE_LOAD_IMAGE_NODE_ID || '';
const SAVE_ID = process.env.COMFYUI_UPSCALE_SAVE_IMAGE_NODE_ID || '';
const SAMPLE = process.argv[2];

function die(msg: string): never { console.error(`[smoke] ${msg}`); process.exit(1); }
async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function injectLoadImage(workflow: any, uploadedName: string) {
  if (LOAD_ID && workflow[LOAD_ID]?.inputs) {
    workflow[LOAD_ID].inputs.image = uploadedName; return;
  }
  for (const id of Object.keys(workflow)) {
    const n = workflow[id];
    if (n?.class_type === 'LoadImage' && n?.inputs && 'image' in n.inputs) {
      n.inputs.image = uploadedName; return;
    }
  }
  die('No LoadImage node found. Set COMFYUI_UPSCALE_LOAD_IMAGE_NODE_ID.');
}

function injectSavePrefix(workflow: any, prefix: string) {
  if (SAVE_ID && workflow[SAVE_ID]?.inputs) {
    workflow[SAVE_ID].inputs.filename_prefix = prefix; return;
  }
  for (const id of Object.keys(workflow)) {
    const n = workflow[id];
    if (n?.class_type === 'SaveImage' && n?.inputs) {
      n.inputs.filename_prefix = prefix;
    }
  }
}

async function main() {
  if (!BASE) die('COMFYUI_BASE_URL not set');
  if (!WF_RAW) die('COMFYUI_DEFAULT_WORKFLOW_UPSCALE not set');
  if (!SAMPLE) die('Usage: npx tsx scratch/comfyui-upscale.smoke.ts <path-to-image>');
  if (!fs.existsSync(SAMPLE)) die(`File not found: ${SAMPLE}`);

  console.log(`[smoke] base=${BASE}`);

  // 1) reachability
  const stats = await axios.get(`${BASE}/system_stats`, { timeout: 15000 }).catch(e => die(`/system_stats failed: ${e.message}`));
  console.log(`[smoke] system_stats ok — comfyui_version=${(stats as any).data?.system?.comfyui_version ?? 'unknown'}`);

  // 2) parse workflow
  let workflow: any;
  try { workflow = JSON.parse(WF_RAW); } catch (e: any) { die(`Workflow JSON parse error: ${e.message}`); }

  // 3) upload sample
  const buf = fs.readFileSync(SAMPLE);
  const filename = path.basename(SAMPLE);
  const mime = filename.endsWith('.jpg') || filename.endsWith('.jpeg') ? 'image/jpeg'
              : filename.endsWith('.webp') ? 'image/webp' : 'image/png';
  const G = globalThis as any;
  const form = new G.FormData();
  form.append('image', new G.Blob([buf], { type: mime }), filename);
  form.append('overwrite', 'true');
  const up = await axios.post(`${BASE}/upload/image`, form, { timeout: 60000 });
  const uploadedName = up.data?.name || up.data?.filename;
  if (!uploadedName) die(`/upload/image returned no filename: ${JSON.stringify(up.data)}`);
  console.log(`[smoke] uploaded as ${uploadedName} (${buf.length} bytes)`);

  // 4) inject + submit
  injectLoadImage(workflow, uploadedName);
  const jobId = `smoke_${Date.now()}`;
  injectSavePrefix(workflow, `bt_upscale_${jobId}`);
  const submit = await axios.post(`${BASE}/prompt`, { prompt: workflow, client_id: `bt_${jobId}` });
  const promptId = submit.data?.prompt_id;
  if (!promptId) die(`/prompt returned no prompt_id: ${JSON.stringify(submit.data)}`);
  console.log(`[smoke] prompt enqueued — promptId=${promptId}`);

  // 5) poll
  const deadline = Date.now() + 5 * 60 * 1000;
  let filenameOut = '', subfolder = '', type = 'output';
  while (Date.now() < deadline) {
    await sleep(2000);
    const h = await axios.get(`${BASE}/history/${promptId}`).catch(() => null);
    const history = (h as any)?.data?.[promptId];
    process.stdout.write(`\r[smoke] poll status=${history ? 'done' : 'pending'}   `);
    if (!history) continue;
    const outputs = history.outputs || {};
    for (const id of Object.keys(outputs)) {
      const imgs = outputs[id]?.images;
      if (!imgs?.length) continue;
      const pref = imgs.find((i: any) => (i.type || '').toLowerCase() === 'output') || imgs[0];
      filenameOut = pref.filename; subfolder = pref.subfolder || ''; type = pref.type || 'output';
      break;
    }
    if (filenameOut) break;
  }
  console.log('');

  if (!filenameOut) die('Timed out waiting for output image.');
  const fileUrl = `${BASE}/view?filename=${encodeURIComponent(filenameOut)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
  console.log(`[smoke] ✅ output → ${fileUrl}`);
}

main().catch(e => { console.error('[smoke] ❌', e.message || e); process.exit(1); });
