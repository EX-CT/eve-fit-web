// JSONL RPC over the site's active engine backend, inside headless Chrome:
//   node tools/browser-rpc.mjs <site-url> <engine-id>           < {"id","method","params"} lines   > {"id","result"} lines
//   node tools/browser-rpc.mjs <site-url> <engine-id> --batch   < FitRequest lines                > FitStats lines (bench batch mode)
// Methods: graph, graph_specs, calc. The requests go through the page's Engine adapter (Web Worker + WASM for the
// in-browser backends), i.e. exactly the build that is deployed. Used to run the eve-dogma-bench graphs-round2 suite
// (graphs/run_graphs.py --rpc-cmd) against the browser build.
import puppeteer from 'puppeteer-core';
import readline from 'node:readline';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/eve-fit-web/';
const engine = process.argv[3] ?? 'wasm-worker';
const batch = process.argv.includes('--batch');
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
try {
  const p = await b.newPage();
  await p.goto(`${url}${url.includes('?') ? '&' : '?'}engine=${engine}`, { waitUntil: 'networkidle0', timeout: 120000 });
  await p.waitForFunction((e) => window.__eveEngine?.info?.id === e, { timeout: 120000 }, engine);
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let id = null, out;
    try {
      const m = batch ? { id: null, method: 'calc', params: JSON.parse(line) } : JSON.parse(line);
      id = m.id ?? null;
      const result = await p.evaluate(async (method, params) => {
        const e = window.__eveEngine;
        if (method === 'graph') return e.graph ? e.graph(params) : { error: { code: 'UNKNOWN_METHOD', message: 'backend has no graph RPC' } };
        if (method === 'graph_specs') return e.graphSpecs ? e.graphSpecs() : null;
        if (method === 'calc') return e.calc(params);
        return { error: { code: 'UNKNOWN_METHOD', message: method } };
      }, m.method ?? 'calc', m.params ?? null);
      out = { id, result };
    } catch (e) {
      out = { id, error: { code: 'BROWSER', message: String(e?.message ?? e) } };
    }
    process.stdout.write(JSON.stringify(batch ? out.result ?? out : out) + '\n');
  }
} finally {
  await b.close();
}
