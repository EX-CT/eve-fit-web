#!/usr/bin/env node
// An `eve-fit`-compatible command line backed by the site's in-browser engine (tools/browser-rpc.mjs), so the
// eve-dogma-bench runners (tools/run_all_suites.sh: run.py --cmd/--batch-cmd, score.py --batch-cmd, run_graphs.py
// --rpc-cmd, evaluate_formats.py --rpc ...) can score the deployed build as if it were a native engine binary.
//   BROWSER_URL=<site-url> BROWSER_ENGINE=wasm-worker tools/browser-engine.mjs calc [FILE] | batch | serve-stdio
// With BROWSER_RPC=http://127.0.0.1:PORT (a running `browser-rpc.mjs <url> <engine> --http PORT`) every call reuses that one
// browser instead of starting Chrome per process (the bench's run.py starts one process per case).
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const url = process.env.BROWSER_URL ?? 'http://127.0.0.1:4173/eve-fit-web/';
const engine = process.env.BROWSER_ENGINE ?? 'wasm-worker';
const rpc = fileURLToPath(new URL('./browser-rpc.mjs', import.meta.url));
const [cmd, file] = process.argv.slice(2);
const run = (args, input) => {
  const c = spawn(process.execPath, [rpc, url, engine, ...args], { stdio: [input == null ? 'inherit' : 'pipe', 'inherit', 'inherit'] });
  if (input != null) { c.stdin.end(input); }
  c.on('exit', (code) => process.exit(code ?? 1));
};
const server = process.env.BROWSER_RPC;
const post = async (path, body) => { const r = await fetch(server + path, { method: 'POST', body }); if (!r.ok) throw new Error(`browser-rpc ${r.status}`); return r.text(); };
if (server) {
  if (cmd === 'batch') process.stdout.write(await post('/batch', readFileSync(0, 'utf8')));
  else if (cmd === 'calc') process.stdout.write(await post('/batch', JSON.stringify(JSON.parse(file && file !== '-' ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8'))) + '\n'));
  else if (cmd === 'serve-stdio') {
    const rl = (await import('node:readline')).createInterface({ input: process.stdin, crlfDelay: Infinity });
    for await (const line of rl) if (line.trim()) process.stdout.write(await post('/rpc', line + '\n'));
  } else { console.error('usage: browser-engine.mjs calc [FILE] | batch | serve-stdio'); process.exit(2); }
  process.exit(0);
}
if (cmd === 'batch') run(['--batch']);
else if (cmd === 'serve-stdio') run([]);
else if (cmd === 'calc') {
  const text = file && file !== '-' ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');
  run(['--batch'], JSON.stringify(JSON.parse(text)) + '\n');
} else {
  console.error('usage: browser-engine.mjs calc [FILE] | batch | serve-stdio   (env BROWSER_URL, BROWSER_ENGINE)');
  process.exit(2);
}
