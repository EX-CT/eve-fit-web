// Web Worker hosting an in-browser engine so calculations never block the UI.
//  kind 'ts':   variant D bundle (ES module exporting loadDatasetUrl + calc), dataset fetched from datasetUrl.
//  kind 'wasm': variant F wasm32-unknown-unknown module with C-ABI exports alloc/dealloc/calc (data compiled in).
/// <reference lib="webworker" />

type CalcFn = (req: unknown) => unknown;
let calcFn: CalcFn | null = null;

async function initTs(engineUrl: string, datasetUrl: string): Promise<string> {
  const mod: any = await import(/* @vite-ignore */ engineUrl);
  const ds = await mod.loadDatasetUrl(datasetUrl);
  calcFn = (req) => mod.calc(ds, req);
  const m = mod.meta ? mod.meta(ds) : {};
  return `${m.engine ?? mod.ENGINE ?? 'eve-dogma-ts'} · SDE ${m.sde_build ?? '?'}`;
}

async function initWasm(wasmUrl: string): Promise<string> {
  const { instance } = await WebAssembly.instantiateStreaming(fetch(wasmUrl), {}).catch(async () => {
    const buf = await (await fetch(wasmUrl)).arrayBuffer();
    return WebAssembly.instantiate(buf, {});
  });
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
  calcFn = (req) => JSON.parse(call('calc', JSON.stringify(req)));
  let label = 'eve-dogma-f (wasm)';
  try { const probe: any = calcFn({ schema_version: 1, ship: { type_id: 587 } }); if (probe?.meta?.engine) label = `${probe.meta.engine} (wasm) · SDE ${probe.meta.sde_build}`; } catch { /* ignore */ }
  return label;
}

self.onmessage = async (ev: MessageEvent) => {
  const { id, op } = ev.data;
  try {
    if (op === 'init') {
      const r = ev.data.kind === 'wasm' ? await initWasm(ev.data.wasmUrl) : await initTs(ev.data.engineUrl, ev.data.datasetUrl);
      (self as any).postMessage({ id, result: r });
    } else if (op === 'calc') {
      if (!calcFn) throw new Error('engine not initialised');
      (self as any).postMessage({ id, result: calcFn(ev.data.request) });
    }
  } catch (e) {
    (self as any).postMessage({ id, error: (e as Error)?.message ?? String(e) });
  }
};
