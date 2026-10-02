import { useState } from 'react';
import type { Dataset } from '../data/dataset';
import type { FitStats } from '../engine/adapter';
import type { TargetProfile } from '../fit/model';
import * as G from '../fit/graphs';
import { LineChart } from './common';

const KINDS = [
  ['dps', 'DPS vs range'], ['cap', 'Capacitor vs time'], ['regen', 'Regen vs fill %'], ['mobility', 'Speed & distance vs time'],
  ['lock', 'Lock time vs target signature'], ['warp', 'Warp time vs distance'],
] as const;
type K = (typeof KINDS)[number][0];

export function Graphs({ ds, st, target }: { ds: Dataset; st: FitStats | null; target: TargetProfile | undefined }) {
  const [k, setK] = useState<K>('dps');
  const [sig, setSig] = useState(target?.signature_radius ?? 125);
  const [vel, setVel] = useState(target?.max_velocity ?? 0);
  if (!st || st.error) return <div className="muted">Compute a fit first.</div>;
  const tgt = sig > 0 ? { signature_radius: sig, velocity: vel } : null;
  const graph = (() => {
    switch (k) {
      case 'dps': return { s: G.dpsVsRange(ds, st, tgt).map((x) => ({ ...x, points: x.points.map(([d, v]) => [d / 1000, v] as [number, number]) })), x: 'distance km', y: 'DPS' };
      case 'cap': return { s: G.capVsTime(st), x: 'time s', y: 'GJ' };
      case 'regen': return { s: G.regenVsPercent(st), x: 'fill %', y: 'per second' };
      case 'mobility': return { s: G.mobility(st), x: 'time s', y: 'm/s · km' };
      case 'lock': return { s: G.lockTime(st), x: 'target signature m', y: 'seconds' };
      case 'warp': return { s: G.warpTime(st), x: 'distance AU', y: 'seconds' };
    }
  })();
  return (
    <div className="graphs">
      <div className="row">
        <select value={k} onChange={(e) => setK(e.target.value as K)}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {k === 'dps' && <>
          <label>target sig <input className="qty wide" type="number" min={0} value={sig} onChange={(e) => setSig(+e.target.value)} /> m</label>
          <label>transversal <input className="qty wide" type="number" min={0} value={vel} onChange={(e) => setVel(+e.target.value)} /> m/s</label>
        </>}
      </div>
      <LineChart series={graph.s} xLabel={graph.x} yLabel={graph.y} />
      <p className="hint">Graphs are computed in the UI from one engine result with public formulas (turret hit chance, missile application, capacitor/shield regen curves, align and warp profiles), as an approximation of Pyfa's graph window.</p>
    </div>
  );
}
