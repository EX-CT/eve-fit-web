// Graphs window. With an engine that implements the graph RPC (CONTRACT-GRAPHS rev 0.2: `graph_specs` + `graph`),
// the series are engine-computed; otherwise (or on an engine error) they are the UI approximations in fit/graphs.ts.
import { useEffect, useMemo, useState } from 'react';
import { t } from '../i18n';
import type { Dataset } from '../data/dataset';
import type { Engine, FitStats, GraphRequest, GraphResult, GraphSpecs } from '../engine/adapter';
import type { TargetProfile } from '../fit/model';
import * as G from '../fit/graphs';
import { LineChart } from './common';

const KINDS = [
  ['dps', 'DPS vs range'], ['cap', 'Capacitor vs time'], ['regen', 'Regen vs fill %'], ['mobility', 'Speed & distance vs time'],
  ['lock', 'Lock time vs target signature'], ['warp', 'Warp time vs distance'],
  // engine-only graphs (no UI approximation): listed when the engine's graph_specs offers them
  ['app', 'Application profile (best ammo) vs range'], ['ewar', 'EWAR strength vs range'], ['rr', 'Remote repairs vs range'],
] as const;
type K = (typeof KINDS)[number][0];
const ENGINE_ONLY: K[] = ['app', 'ewar', 'rr'];
const AU = 149597870700;
const EWAR_Y = ['neut_gj_s', 'web_pct', 'ecm_strength', 'damp_lock_range_pct', 'td_optimal_pct', 'gd_range_pct', 'tp_sig_pct'];

/** One engine call: request + how to turn its series into chart series (x scale, y scale, display names). */
interface Plan { req: Omit<GraphRequest, 'schema_version' | 'fit'>; xs?: (x: number) => number; map: Partial<Record<string, { name: string; scale?: number }>>; dropZero?: boolean }
interface View { s: G.Series[]; x: string; y: string }

const range = (n: number, a: number, b: number) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const lastX = (s: G.Series[], fallback: number) => Math.max(0, ...s.flatMap((x) => x.points.map((p) => p[0]))) || fallback;

export function Graphs({ ds, st, target, engine, request, engineReady }: {
  ds: Dataset; st: FitStats | null; target: TargetProfile | undefined;
  engine?: Engine | null; request?: Record<string, unknown> | null; engineReady?: number;
}) {
  const [k, setK] = useState<K>('dps');
  const [sig, setSig] = useState(target?.signature_radius ?? 125);
  const [vel, setVel] = useState(target?.max_velocity ?? 0);
  const [specs, setSpecs] = useState<GraphSpecs | null>(null);
  const [eng, setEng] = useState<{ key: string; view?: View; error?: string } | null>(null);

  // which graphs the backend computes (graph_specs); null = no graph RPC -> approximations only
  useEffect(() => {
    setSpecs(null);
    let alive = true;
    engine?.graphSpecs?.().then((s) => alive && setSpecs(s), () => {});
    return () => { alive = false; };
  }, [engine, engineReady]);

  const tgt = sig > 0 ? { signature_radius: sig, velocity: vel } : null;
  const approx = useMemo<View | null>(() => {
    if (!st || st.error) return null;
    switch (k) {
      case 'dps': return { s: G.dpsVsRange(ds, st, tgt).map((x) => ({ ...x, points: x.points.map(([d, v]) => [d / 1000, v] as [number, number]) })), x: 'distance km', y: 'DPS' };
      case 'cap': return { s: G.capVsTime(st), x: 'time s', y: 'GJ' };
      case 'regen': return { s: G.regenVsPercent(st), x: 'fill %', y: 'per second' };
      case 'mobility': return { s: G.mobility(st), x: 'time s', y: 'm/s · km' };
      case 'lock': return { s: G.lockTime(st), x: 'target signature m', y: 'seconds' };
      case 'warp': return { s: G.warpTime(st), x: 'distance AU', y: 'seconds' };
      default: return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, st, ds, sig, vel]);

  // engine plans reuse the approximation's x range so both views are comparable
  const plans = useMemo<{ plans: Plan[]; x: string; y: string } | null>(() => {
    if (!st || st.error) return null;
    const profile = { em: 0, thermal: 0, kinetic: 0, explosive: 0, max_velocity: vel, signature_radius: sig > 0 ? sig : null, radius: target?.radius ?? 0, hp: null };
    const dpsFar = (approx && k === 'dps' ? lastX(approx.s, 10) : lastX(G.dpsVsRange(ds, st, tgt), 10000) / 1000) * 1000;
    switch (k) {
      case 'dps': return { x: 'distance km', y: 'DPS', plans: [{ req: { graph: 'damage', target: { profile }, x: { axis: 'distance_m', values: range(121, 0, dpsFar) }, y: ['dps'] }, xs: (x) => x / 1000, map: { dps: { name: 'total dps' } } }] };
      case 'app': return { x: 'distance km', y: 'DPS', plans: [{ req: { graph: 'application_profile', target: { profile }, x: { axis: 'distance_m', values: range(121, 0, dpsFar) }, y: ['dps'] }, xs: (x) => x / 1000, map: { dps: { name: 'best-ammo dps' } } }] };
      case 'cap': return { x: 'time s', y: 'GJ', plans: [{ req: { graph: 'capacitor', x: { axis: 'time_s', values: range(201, 0, approx ? lastX(approx.s, 600) : 600) }, y: ['cap_gj'] }, map: { cap_gj: { name: 'capacitor GJ' } } }] };
      case 'regen': return { x: 'fill %', y: 'per second', plans: [
        { req: { graph: 'capacitor', x: { axis: 'cap_pct', values: range(101, 0, 100) }, y: ['cap_regen_gj_s'] }, map: { cap_regen_gj_s: { name: 'capacitor GJ/s' } } },
        { req: { graph: 'shield_regen', x: { axis: 'shield_pct', values: range(101, 0, 100) }, y: ['shield_regen_hp_s'] }, map: { shield_regen_hp_s: { name: 'shield HP/s' } } }] };
      case 'mobility': return { x: 'time s', y: 'm/s · km', plans: [{ req: { graph: 'mobility', x: { axis: 'time_s', values: range(101, 0, approx ? lastX(approx.s, 25) : 25) }, y: ['speed_mps', 'distance_m'] }, map: { speed_mps: { name: 'speed m/s' }, distance_m: { name: 'distance km', scale: 1e-3 } } }] };
      case 'lock': return { x: 'target signature m', y: 'seconds', plans: [{ req: { graph: 'lock_time', x: { axis: 'tgt_sig_m', values: range(100, 10, 1000) }, y: ['time_s'] }, map: { time_s: { name: 'lock time s' } } }] };
      case 'warp': return { x: 'distance AU', y: 'seconds', plans: [{ req: { graph: 'warp_time', x: { axis: 'distance_m', values: range(100, 0.5, 50).map((au) => au * AU) }, y: ['time_s'] }, xs: (x) => x / AU, map: { time_s: { name: 'warp time s' } } }] };
      case 'ewar': return { x: 'distance km', y: '% · GJ/s · points', plans: [{ req: { graph: 'ewar', x: { axis: 'distance_m', values: range(121, 0, 100000) }, y: EWAR_Y }, xs: (x) => x / 1000, map: Object.fromEntries(EWAR_Y.map((y) => [y, { name: y }])), dropZero: true }] };
      case 'rr': return { x: 'distance km', y: 'HP/s', plans: [{ req: { graph: 'remote_reps', x: { axis: 'distance_m', values: range(121, 0, 100000) }, y: ['rps'] }, xs: (x) => x / 1000, map: { rps: { name: 'remote reps HP/s' } } }] };
      default: return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, st, ds, sig, vel, approx, target?.radius]);

  const engineBacked = !!(specs && plans && plans.plans.every((p) => specs.graphs[p.req.graph]));
  const key = engineBacked ? JSON.stringify([k, request, plans]) : '';
  useEffect(() => {
    if (!engineBacked || !engine?.graph || !request || !plans) { setEng(null); return; }
    let alive = true;
    const t0 = performance.now();
    const timer = setTimeout(() => {
      Promise.all(plans.plans.map((p) => engine.graph!({ schema_version: 1, fit: request, ...p.req }).then((r: GraphResult) => {
        if (r.error || !r.series || !r.x) throw new Error(`${p.req.graph}: ${r.error?.code ?? 'BAD_RESPONSE'} ${r.error?.message ?? ''}`.trim());
        const xs = r.x;
        return Object.entries(p.map).flatMap(([y, m]) => (m ? [{ name: m.name, points: (r.series![y] ?? []).flatMap((v, i) => (v == null ? [] : [[p.xs ? p.xs(xs[i]) : xs[i], v * (m.scale ?? 1)] as [number, number]])) }] : []))
          .filter((s) => s.points.length && (!p.dropZero || s.points.some((q) => q[1] !== 0)));
      }))).then((parts) => {
        if (!alive) return;
        const view = { s: parts.flat(), x: plans.x, y: plans.y };
        setEng({ key, view });
        (window as any).__lastGraph = { kind: k, source: 'engine', series: view.s.map((s) => ({ name: s.name, n: s.points.length, first: s.points[0], last: s.points[s.points.length - 1] })), ms: performance.now() - t0 };
      }, (e) => { if (alive) { setEng({ key, error: (e as Error).message }); (window as any).__lastGraph = { kind: k, source: 'approx', error: (e as Error).message }; } });
    }, 120);
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, engine]);

  if (!st || st.error) return <div className="muted">{t('Compute a fit first.')}</div>;
  const kinds = KINDS.filter(([v]) => !ENGINE_ONLY.includes(v) || (specs && specs.graphs[{ app: 'application_profile', ewar: 'ewar', rr: 'remote_reps' }[v as 'app' | 'ewar' | 'rr']]));
  const engView = eng && eng.key === key ? eng : null;
  const source: 'engine' | 'approx' | 'pending' = engineBacked ? (engView?.view ? 'engine' : engView?.error ? 'approx' : 'pending') : 'approx';
  const view = source === 'engine' ? engView!.view! : approx;
  if (source === 'approx' && !engineBacked) (window as any).__lastGraph = { kind: k, source: 'approx', series: (approx?.s ?? []).map((s) => ({ name: s.name, n: s.points.length })) };
  return (
    <div className="graphs">
      <div className="row">
        <select value={k} onChange={(e) => setK(e.target.value as K)}>{kinds.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {(k === 'dps' || k === 'app') && <>
          <label>target sig <input className="qty wide" type="number" min={0} value={sig} onChange={(e) => setSig(+e.target.value)} /> m</label>
          <label>transversal <input className="qty wide" type="number" min={0} value={vel} onChange={(e) => setVel(+e.target.value)} /> m/s</label>
        </>}
        <span className={`graph-src ${source}`} data-src={source} title={engView?.error ?? ''}>
          {source === 'engine' ? t('engine-computed') : source === 'pending' ? t('engine computing…') : t('UI approximation')}
        </span>
      </div>
      {view ? <LineChart series={view.s} xLabel={view.x} yLabel={view.y} /> : source === 'pending' ? <div className="muted">…</div> : <div className="muted">{t('No data for this graph.')}</div>}
      {source === 'engine'
        ? <p className="hint">Engine-computed via the graph RPC (CONTRACT-GRAPHS rev 0.2{specs?.contract ? `; engine reports “${specs.contract}”` : ''}). The total includes drones; distances are surface-to-surface, the target moves at the given transversal speed.</p>
        : <p className="hint">{engView?.error ? `Engine graph failed (${engView.error}); showing the UI approximation. ` : ''}Graphs are computed in the UI from one engine result with public formulas (turret hit chance, missile application, capacitor/shield regen curves, align and warp profiles), as an approximation of Pyfa's graph window. Backends with the graph RPC (e.g. wasm-g4-worker) compute them in the engine.</p>}
    </div>
  );
}
