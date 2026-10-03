// JSONL RPC over the site's active engine backend, inside headless Chrome:
//   node tools/browser-rpc.mjs <site-url> <engine-id>           < {"id","method","params"} lines   > {"id","result"} lines
//   node tools/browser-rpc.mjs <site-url> <engine-id> --batch   < FitRequest lines                > FitStats lines (bench batch mode)
//   node tools/browser-rpc.mjs <site-url> <engine-id> --http PORT   one browser kept open; POST /rpc (or /batch) with JSONL
//     request lines, JSONL response lines back (tools/browser-engine.mjs uses it via BROWSER_RPC=http://127.0.0.1:PORT);
//     header `x-prices: <file>` loads that price snapshot first (like `eve-fit --prices FILE`), no header clears it
// Methods: graph, graph_specs, calc (engine), any other engine RPC method (batch, prices_load, ...; WASM backends), and eft_parse / eft_export / format_import / format_export (the page's
// eve-fit-formats WASM module, like `eve-fit serve-stdio`). The requests go through the page's Engine adapter (Web Worker + WASM for the
// in-browser backends), i.e. exactly the build that is deployed. Used to run the eve-dogma-bench graphs-round2 suite
// (graphs/run_graphs.py --rpc-cmd) against the browser build.
import puppeteer from 'puppeteer-core';
import readline from 'node:readline';
import http from 'node:http';
import { readFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/eve-fit-web/';
const engine = process.argv[3] ?? 'wasm-worker';
const batch = process.argv.includes('--batch');
const httpPort = process.argv.includes('--http') ? +process.argv[process.argv.indexOf('--http') + 1] : null;
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(`${url}${url.includes('?') ? '&' : '?'}engine=${engine}`, { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction((e) => window.__eveEngine?.info?.id === e, { timeout: 120000 }, engine);
/** one JSONL line -> one JSONL line (batch: FitRequest -> FitStats; else {id, method, params} -> {id, result}) */
async function handle(line, asBatch) {
  let id = null, out;
  try {
    const m = asBatch ? { id: null, method: 'calc', params: JSON.parse(line) } : JSON.parse(line);
    id = m.id ?? null;
    const result = await p.evaluate(async (method, params) => {
      const e = window.__eveEngine;
      if (method === 'graph') return e.graph ? e.graph(params) : { error: { code: 'UNKNOWN_METHOD', message: 'backend has no graph RPC' } };
      if (method === 'graph_specs') return e.graphSpecs ? e.graphSpecs() : null;
      if (method === 'calc') return e.calc(params);
      // shipstats like `eve-fit serve-stdio`: the engine computes shipstats_request(fit) first (all attributes, no spool-up,
      // full precision), the formats module renders it from the exact stats text
      if (method === 'format_export' && params?.format === 'shipstats' && !params.stats && !params.stats_json && window.__eveFormatsRpc) {
        const f = params.fit ?? {};
        const st = await e.calc({ ...f, options: { ...(f.options ?? {}), include_attributes: 'all', full_precision: true, default_spool: { type: 'spool_scale', amount: 0 } }, modules: (f.modules ?? []).map((m) => ({ ...m, spool: null })) });
        if (st?.error) return st;
        return window.__eveFormatsRpc(method, { ...params, stats_json: JSON.stringify(st) });
      }
      if (['eft_parse', 'eft_export', 'format_import', 'format_export'].includes(method))
        return window.__eveFormatsRpc ? window.__eveFormatsRpc(method, params) : { error: { code: 'UNKNOWN_METHOD', message: `${method}: no eve-fit-formats module` } };
      // anything else (batch, prices_load, ...): the engine's own RPC, response passed through as is
      if (e.rpcRaw) return { __raw: await e.rpcRaw(method, params) };
      return { error: { code: 'UNKNOWN_METHOD', message: method } };
    }, m.method ?? 'calc', m.params ?? null);
    out = result && typeof result === 'object' && '__raw' in result ? { ...result.__raw, id } : { id, result };
  } catch (e) {
    out = { id, error: { code: 'BROWSER', message: String(e?.message ?? e) } };
  }
  return JSON.stringify(asBatch ? out.result ?? out : out);
}
// The engine's market snapshot (L4) is global in the page, while each `browser-engine.mjs` process is its own engine
// session: the request's state is the session's own `prices_load` (RPC, header x-session) if it made one, else its
// `--prices FILE` (header x-prices), else none. It is (re)loaded whenever it differs from what the page holds.
const CLEAR = { key: 'clear', params: { clear: true } };
let pricesNow = 'clear';
const sessionPrices = new Map();
async function usePrices(want) {
  if (want.key === pricesNow) return;
  const params = want.params ?? { snapshot: JSON.parse(readFileSync(want.file, 'utf8')) };
  const r = await p.evaluate(async (pp) => window.__eveEngine.rpcRaw ? window.__eveEngine.rpcRaw('prices_load', pp) : null, params);
  if (r?.error) throw new Error(`prices_load ${want.file ?? ''}: ${r.error.code} ${r.error.message}`);
  pricesNow = want.key;
}
/** after a passed-through RPC `prices_load` that succeeded: that is now this session's state */
function notePricesLoad(session, line, out) {
  try {
    const m = JSON.parse(line);
    if (m.method !== 'prices_load' || JSON.parse(out).error) return;
    const st = { key: `rpc:${JSON.stringify(m.params)}`, params: m.params };
    pricesNow = st.key;
    if (session) sessionPrices.set(session, st);
  } catch { /* not JSON: nothing loaded */ }
}
if (httpPort) {
  let queue = Promise.resolve(); // one page: requests run one after the other
  http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const asBatch = req.url.startsWith('/batch');
      const file = req.headers['x-prices']; // `eve-fit --prices FILE`
      const session = req.headers['x-session'] ?? null;
      queue = queue.then(async () => {
        await usePrices(sessionPrices.get(session) ?? (file ? { key: `file:${file}`, file } : CLEAR));
        const outs = [];
        for (const l of body.split('\n')) if (l.trim()) { const o = await handle(l, asBatch); notePricesLoad(session, l, o); outs.push(o); }
        res.writeHead(200, { 'content-type': 'application/x-ndjson' });
        res.end(outs.map((o) => o + '\n').join(''));
      }).catch((e) => { res.writeHead(500); res.end(String(e)); });
    });
  }).listen(httpPort, '127.0.0.1', () => console.error(`browser-rpc: ${engine} on http://127.0.0.1:${httpPort}`));
  const stop = async () => { await b.close(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
} else {
  try {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
    for await (const line of rl) if (line.trim()) process.stdout.write(await handle(line, batch) + '\n');
  } finally {
    await b.close();
  }
}
