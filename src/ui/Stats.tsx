import type { FitStats } from '../engine/adapter';
import { Bar, Section, fmt, pctFmt } from './common';

const DT = ['em', 'thermal', 'kinetic', 'explosive'] as const;
const DT_SHORT: Record<string, string> = { em: 'EM', thermal: 'Th', kinetic: 'Ki', explosive: 'Ex' };

export function Stats({ st, busy, ms, error }: { st: FitStats | null; busy: boolean; ms: number | null; error: string | null }) {
  if (error) return <div className="stats"><div className="error">Engine error: {error}</div></div>;
  if (!st) return <div className="stats muted">{busy ? 'calculating…' : 'no stats yet'}</div>;
  if (st.error) return <div className="stats"><div className="error">{st.error.code}: {st.error.message} {st.error.path}</div></div>;
  const r = st.resources ?? {}, o = st.offense ?? {}, d = st.defense ?? {}, c = st.capacitor ?? {}, n = st.navigation ?? {}, t = st.targeting ?? {};
  const res = (x: any, l: string) => (x && (x.total || x.used) ? <Bar label={l} used={x.used ?? 0} total={x.total ?? 0} /> : null);
  return (
    <div className="stats">
      <div className="statmeta muted">{st.meta?.engine} · SDE {st.meta?.sde_build}{ms != null ? ` · ${ms.toFixed(1)} ms` : ''}{busy ? ' · …' : ''}</div>
      {(st.violations?.length ?? 0) > 0 && (
        <Section title={`Problems (${st.violations.length})`}>
          <ul className="viol">{st.violations.map((v: any, i: number) => <li key={i}><b>{v.code}</b> {v.message}</li>)}</ul>
        </Section>
      )}
      {(st.warnings?.length ?? 0) > 0 && <Section title="Engine warnings"><ul className="viol warn">{st.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul></Section>}
      <Section title="Resources">
        {res(r.cpu, 'CPU')}{res(r.power, 'Powergrid')}{res(r.calibration, 'Calibration')}
        {res(r.drone_bandwidth, 'Drone bandwidth')}{res(r.drone_bay, 'Drone bay m³')}{res(r.fighter_bay, 'Fighter bay m³')}{res(r.cargo, 'Cargo m³')}
        <div className="kv">
          {r.hardpoints && <span>Turrets {r.hardpoints.turret?.used}/{r.hardpoints.turret?.total}</span>}
          {r.hardpoints && <span>Launchers {r.hardpoints.launcher?.used}/{r.hardpoints.launcher?.total}</span>}
          {r.fighter_tubes?.total?.total ? <span>Tubes {r.fighter_tubes.total.used}/{r.fighter_tubes.total.total}</span> : null}
        </div>
      </Section>
      <Section title="Offense" right={<b>{fmt(o.total?.dps?.total)} dps</b>}>
        <table className="grid"><thead><tr><th></th><th>DPS</th><th>Volley</th></tr></thead><tbody>
          <tr><td>Weapons</td><td className="num">{fmt(o.total?.weapon_dps)}</td><td className="num">{fmt(o.total?.weapon_volley)}</td></tr>
          <tr><td>Drones</td><td className="num">{fmt(o.total?.drone_dps)}</td><td className="num">{fmt(o.total?.drone_volley)}</td></tr>
          {o.total?.fighter_dps ? <tr><td>Fighters</td><td className="num">{fmt(o.total?.fighter_dps)}</td><td className="num">{fmt(o.total?.fighter_volley)}</td></tr> : null}
          <tr><td><b>Total</b></td><td className="num"><b>{fmt(o.total?.dps?.total)}</b></td><td className="num"><b>{fmt(o.total?.volley?.total)}</b></td></tr>
          {o.vs_target_profile && (o.vs_target_profile.dps !== o.total?.dps?.total) && <tr><td>vs target</td><td className="num">{fmt(o.vs_target_profile.dps)}</td><td className="num">{fmt(o.vs_target_profile.volley)}</td></tr>}
        </tbody></table>
        <div className="kv">{DT.map((k) => <span key={k} className={'dt-' + k}>{DT_SHORT[k]} {fmt(o.total?.dps?.[k])}</span>)}</div>
        {(o.weapons ?? []).length > 0 && (
          <table className="grid small"><thead><tr><th>weapon</th><th>dps</th><th>range</th><th>cycle s</th></tr></thead><tbody>
            {o.weapons.map((w: any, i: number) => (
              <tr key={i}><td>{w.name}</td><td className="num">{fmt(w.dps?.total)}</td>
                <td className="num">{w.kind === 'missile' ? `${fmt((w.range_m ?? 0) / 1000)} km` : w.optimal_m != null ? `${fmt(w.optimal_m / 1000)}+${fmt((w.falloff_m ?? 0) / 1000)} km` : '—'}</td>
                <td className="num">{fmt((w.cycle_time_ms ?? 0) / 1000, 2)}</td></tr>
            ))}
          </tbody></table>
        )}
      </Section>
      <Section title="Defense" right={<b>{fmt(d.ehp?.total, 0)} EHP</b>}>
        <table className="grid"><thead><tr><th></th><th>HP</th><th>EHP</th>{DT.map((k) => <th key={k} className={'dt-' + k}>{DT_SHORT[k]}</th>)}</tr></thead><tbody>
          {(['shield', 'armor', 'hull'] as const).map((l) => (
            <tr key={l}><td>{l}</td><td className="num">{fmt(d.hp?.[l], 0)}</td><td className="num">{fmt(d.ehp?.[l], 0)}</td>
              {DT.map((k) => <td key={k} className="num">{d.resonance?.[l]?.[k] != null ? pctFmt(1 - d.resonance[l][k]) : '—'}</td>)}</tr>
          ))}
        </tbody></table>
        {d.tank && (
          <table className="grid small"><thead><tr><th>tank HP/s</th><th>raw</th><th>effective</th><th>sustained</th><th>sust. eff.</th></tr></thead><tbody>
            {(['passive_shield', 'shield_repair', 'armor_repair', 'hull_repair'] as const).map((k) => (
              (d.tank.raw?.[k] || d.tank.effective?.[k]) ? <tr key={k}><td>{k.replace('_', ' ')}</td><td className="num">{fmt(d.tank.raw?.[k])}</td><td className="num">{fmt(d.tank.effective?.[k])}</td>
                <td className="num">{fmt(d.tank.sustained?.[k])}</td><td className="num">{fmt(d.tank.sustained_effective?.[k])}</td></tr> : null
            ))}
          </tbody></table>
        )}
      </Section>
      <Section title="Capacitor" right={<b>{c.stable ? `stable ${fmt(c.stable_percent)}%` : c.depletes_in_s != null ? `lasts ${fmtTime(c.depletes_in_s)}` : ''}</b>}>
        <div className="kv"><span>{fmt(c.capacity, 0)} GJ</span><span>recharge {fmt(c.recharge_time_s)} s</span><span>peak +{fmt(c.peak_recharge_gj_s, 2)} GJ/s</span>
          <span>use −{fmt(c.use_gj_s, 2)} GJ/s</span>{c.injected_gj_s ? <span>injected +{fmt(c.injected_gj_s, 2)}</span> : null}<span>Δ {fmt(c.delta_gj_s, 2)} GJ/s</span></div>
      </Section>
      <Section title="Navigation">
        <div className="kv"><span>{fmt(n.max_velocity)} m/s</span><span>align {fmt(n.align_time_s, 2)} s</span><span>sig {fmt(n.signature_radius, 0)} m</span>
          <span>mass {fmt(n.mass, 0)} kg</span><span>agility {fmt(n.agility, 4)}</span><span>warp {fmt(n.warp_speed_au_s, 2)} AU/s</span>
          {n.warp_scramble_status ? <span>warp core {n.warp_scramble_status > 0 ? '+' : ''}{n.warp_scramble_status}</span> : null}</div>
      </Section>
      <Section title="Targeting">
        <div className="kv"><span>{t.max_targets} targets</span><span>{fmt((t.max_range_m ?? 0) / 1000)} km</span><span>scan res {fmt(t.scan_resolution, 0)} mm</span>
          <span>{t.sensor_type} {fmt(t.sensor_strength, 1)}</span><span>probe size {fmt(t.probe_size, 2)}</span>
          {t.jam_chance_percent ? <span className="bad">jam chance {fmt(t.jam_chance_percent)}%</span> : null}</div>
        {t.lock_time_s && <div className="kv small">{Object.entries(t.lock_time_s).filter(([, v]) => v != null).map(([k, v]) => <span key={k}>{k.replace('sig_', '')}: {fmt(v as number, 2)} s</span>)}</div>}
      </Section>
      <Section title="Drones">
        <div className="kv"><span>active {st.drones?.active}/{st.drones?.max_active}</span><span>control range {fmt((st.drones?.control_range_m ?? 0) / 1000)} km</span></div>
      </Section>
      {st.remote && <Section title="Remote assistance"><div className="kv">{Object.entries(st.remote).map(([k, v]) => <span key={k}>{k}: {fmt(v as number, 2)}</span>)}</div></Section>}
      {st.mining && <Section title="Mining"><div className="kv">{Object.entries(st.mining).map(([k, v]) => <span key={k}>{k}: {fmt(v as number, 3)}</span>)}</div></Section>}
    </div>
  );
}

function fmtTime(s: number) { const m = Math.floor(s / 60); return m ? `${m}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`; }
