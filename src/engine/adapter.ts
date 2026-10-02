// Engine adapter: the UI talks to a stateless `calc(FitRequest) -> FitStats` function. Backends are swappable at
// runtime (settings panel / ?engine= URL parameter), so the final engine choice does not touch UI code.

export type FitStats = Record<string, any>;

export interface EngineInfo { id: string; label: string; detail?: string }

export interface Engine {
  readonly info: EngineInfo;
  /** resolves when the engine can calculate; returns a human-readable description (engine name, dataset) */
  init(): Promise<string>;
  calc(request: unknown): Promise<FitStats>;
  dispose(): void;
}

export interface EngineConfig { backend: string; httpUrl: string; datasetUrl: string; engineUrl: string; wasmUrl: string }

export const BACKENDS: EngineInfo[] = [
  { id: 'ts-worker', label: 'In-browser: TypeScript engine (variant D) in a Web Worker' },
  { id: 'wasm-worker', label: 'In-browser: Rust→WASM engine (variant F, data compiled in) in a Web Worker' },
  { id: 'http', label: 'Local/remote HTTP engine (POST {url}/v1/calc, e.g. variant C serve-http)' },
];

/** Worker-hosted in-browser engines (the worker owns its own dataset copy). */
class WorkerEngine implements Engine {
  private w: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, { ok: (v: any) => void; err: (e: Error) => void }>();
  readonly info: EngineInfo;
  private readonly initMsg: Record<string, unknown>;
  constructor(info: EngineInfo, initMsg: Record<string, unknown>) { this.info = info; this.initMsg = initMsg; }

  private call(msg: Record<string, unknown>): Promise<any> {
    const id = ++this.seq;
    return new Promise((ok, err) => { this.pending.set(id, { ok, err }); this.w!.postMessage({ ...msg, id }); });
  }
  async init(): Promise<string> {
    this.w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.w.onmessage = (ev) => {
      const { id, result, error } = ev.data;
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      if (error) p.err(new Error(error)); else p.ok(result);
    };
    this.w.onerror = (ev) => { for (const p of this.pending.values()) p.err(new Error(ev.message || 'worker error')); this.pending.clear(); };
    return this.call({ op: 'init', ...this.initMsg });
  }
  calc(request: unknown) { return this.call({ op: 'calc', request }); }
  dispose() { this.w?.terminate(); this.w = null; }
}

class HttpEngine implements Engine {
  readonly info: EngineInfo;
  private readonly base: string;
  constructor(info: EngineInfo, base: string) { this.info = info; this.base = base.replace(/\/+$/, ''); }
  async init() {
    try {
      const r = await fetch(`${this.base}/v1/meta`);
      if (r.ok) { const m = await r.json(); return `${m.engine ?? 'HTTP engine'} · SDE ${m.sde_build ?? '?'} @ ${this.base}`; }
    } catch { /* fall through: try a calc-only server */ }
    const r = await fetch(`${this.base}/healthz`).catch(() => null);
    if (!r || !r.ok) throw new Error(`no engine at ${this.base}: GET /v1/meta failed. Is it running with CORS (tools/engine-bridge.mjs)? From the hosted site, allow the browser's local-network permission prompt.`);
    return `HTTP engine @ ${this.base}`;
  }
  async calc(request: unknown) {
    const r = await fetch(`${this.base}/v1/calc`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
    const body = await r.json().catch(() => ({ error: { code: 'BAD_RESPONSE', message: `HTTP ${r.status}` } }));
    return body;
  }
  dispose() {}
}

export function createEngine(cfg: EngineConfig): Engine {
  const info = BACKENDS.find((b) => b.id === cfg.backend) ?? BACKENDS[0];
  switch (info.id) {
    case 'http': return new HttpEngine(info, cfg.httpUrl);
    case 'wasm-worker': return new WorkerEngine(info, { kind: 'wasm', wasmUrl: cfg.wasmUrl });
    default: return new WorkerEngine(info, { kind: 'ts', engineUrl: cfg.engineUrl, datasetUrl: cfg.datasetUrl });
  }
}
