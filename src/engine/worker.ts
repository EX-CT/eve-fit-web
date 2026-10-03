// Web Worker hosting an in-browser engine so calculations never block the UI.
//  kind 'ts':   variant D bundle (ES module exporting loadDatasetUrl + calc), dataset fetched from datasetUrl.
//  kind 'wasm': variant F wasm32-unknown-unknown module with C-ABI exports alloc/dealloc/calc (data compiled in);
//               an `rpc` export (graphs-g4: methods graph / graph_specs) is used for engine-computed graphs;
//               an `init` export (graphs-g1 wrapper, engines/g1-wasm) receives the dataset bytes first.
/// <reference lib="webworker" />

type CalcFn = (req: unknown) => unknown;
let calcFn: CalcFn | null = null;
/** JSONL-style RPC ({id, method, params} -> {id, result}) when the module exports `rpc` (graph-capable builds). */
let rpcFn: ((method: string, params: unknown) => unknown) | null = null;

async function initTs(engineUrl: string, datasetUrl: string): Promise<string> {
  const mod: any = await import(/* @vite-ignore */ engineUrl);
  const ds = await mod.loadDatasetUrl(datasetUrl);
  calcFn = (req) => mod.calc(ds, req);
  rpcFn = typeof mod.rpc === 'function' ? (method, params) => mod.rpc(ds, method, params) : null;
  const m = mod.meta ? mod.meta(ds) : {};
  return `${m.engine ?? mod.ENGINE ?? 'eve-dogma-ts'} · SDE ${m.sde_build ?? '?'}`;
}

async function initWasm(wasmUrl: string, datasetUrl?: string): Promise<string> {
  const module = await WebAssembly.compileStreaming(fetch(wasmUrl)).catch(async () => WebAssembly.compile(await (await fetch(wasmUrl)).arrayBuffer()));
  let mem: () => WebAssembly.Memory = () => { throw new Error('memory not ready'); };
  const imports: WebAssembly.Imports = WebAssembly.Module.imports(module).some((i) => i.module === 'wasi_snapshot_preview1') ? { wasi_snapshot_preview1: wasiShim(() => mem()) as any } : {};
  const instance = await WebAssembly.instantiate(module, imports);
  mem = () => instance.exports.memory as WebAssembly.Memory;
  const x: any = instance.exports;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const call = (fn: string, s: string) => {
    const inp = enc.encode(s);
    const p = x.alloc(inp.length);
    new Uint8Array(x.memory.buffer, p, inp.length).set(inp);
    const r: bigint = x[fn](p, inp.length);
    x.dealloc(p, inp.length);
    const op = Number(r >> 32n), ol = Number(r & 0xffffffffn);
    const out = dec.decode(new Uint8Array(x.memory.buffer, op, ol));
    x.dealloc(op, ol);
    return out;
  };
  if (typeof x.init === 'function') {
    // engines without compiled-in data (graphs-g1 wrapper): pass the release dataset (.json.gz bytes) once
    if (!datasetUrl) throw new Error('engine needs a dataset URL');
    const gz = new Uint8Array(await (await fetch(datasetUrl)).arrayBuffer());
    const p = x.alloc(gz.length);
    new Uint8Array(x.memory.buffer, p, gz.length).set(gz);
    const r: bigint = x.init(p, gz.length);
    x.dealloc(p, gz.length);
    const op = Number(r >> 32n), ol = Number(r & 0xffffffffn);
    const st = JSON.parse(dec.decode(new Uint8Array(x.memory.buffer, op, ol)));
    x.dealloc(op, ol);
    if (st.error) throw new Error(`${st.error.code}: ${st.error.message}`);
  }
  calcFn = (req) => JSON.parse(call('calc', JSON.stringify(req)));
  rpcFn = typeof x.rpc === 'function' ? (method, params) => {
    const resp = JSON.parse(call('rpc', JSON.stringify({ id: 1, method, params })));
    return resp.result ?? resp.error ?? null;
  } : null;
  let label = 'wasm engine';
  try { const probe: any = calcFn({ schema_version: 1, ship: { type_id: 587 } }); if (probe?.meta?.engine) label = `${probe.meta.engine} (wasm) · SDE ${probe.meta.sde_build}`; } catch { /* ignore */ }
  return label;
}

/** Minimal WASI preview1 imports for wasm32-wasip1 library builds (graphs-g1 wrapper): clock, random, empty
 *  environment, stdout/stderr to the console. No files, no args. */
function wasiShim(mem: () => WebAssembly.Memory) {
  const dv = () => new DataView(mem().buffer);
  return {
    clock_time_get: (_id: number, _prec: bigint, out: number) => { dv().setBigUint64(out, BigInt(Math.round((performance.timeOrigin + performance.now()) * 1e6)), true); return 0; },
    random_get: (buf: number, len: number) => { crypto.getRandomValues(new Uint8Array(mem().buffer, buf, len)); return 0; },
    environ_sizes_get: (count: number, size: number) => { dv().setUint32(count, 0, true); dv().setUint32(size, 0, true); return 0; },
    environ_get: () => 0,
    fd_write: (fd: number, iovs: number, n: number, written: number) => {
      let total = 0, text = '';
      for (let i = 0; i < n; i++) {
        const p = dv().getUint32(iovs + i * 8, true), l = dv().getUint32(iovs + i * 8 + 4, true);
        text += new TextDecoder().decode(new Uint8Array(mem().buffer, p, l)); total += l;
      }
      if (text.trim()) (fd === 2 ? console.warn : console.log)(`[engine fd${fd}] ${text.trimEnd()}`);
      dv().setUint32(written, total, true);
      return 0;
    },
    proc_exit: (code: number) => { throw new Error(`engine exited with code ${code}`); },
  };
}

self.onmessage = async (ev: MessageEvent) => {
  const { id, op } = ev.data;
  try {
    if (op === 'init') {
      const r = ev.data.kind === 'wasm' ? await initWasm(ev.data.wasmUrl, ev.data.datasetUrl) : await initTs(ev.data.engineUrl, ev.data.datasetUrl);
      (self as any).postMessage({ id, result: r });
    } else if (op === 'rpc') {
      if (!rpcFn) throw new Error('engine has no rpc export');
      (self as any).postMessage({ id, result: rpcFn(ev.data.method, ev.data.params) });
    } else if (op === 'calc') {
      if (!calcFn) throw new Error('engine not initialised');
      (self as any).postMessage({ id, result: calcFn(ev.data.request) });
    }
  } catch (e) {
    (self as any).postMessage({ id, error: (e as Error)?.message ?? String(e) });
  }
};
