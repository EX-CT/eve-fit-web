import { uid, type DamagePattern, type Fit, type Library, type TargetProfile } from '../fit/model';
import { t } from '../i18n';

const DT = ['em', 'thermal', 'kinetic', 'explosive'] as const;

export function Profiles({ lib, fit, onLib, onFit }: { lib: Library; fit: Fit | null; onLib: (l: Library) => void; onFit: (f: Fit) => void }) {
  const dps = Object.values(lib.damagePatterns), tps = Object.values(lib.targetProfiles);
  const saveD = (d: DamagePattern) => onLib({ ...lib, damagePatterns: { ...lib.damagePatterns, [d.id]: d } });
  const saveT = (t: TargetProfile) => onLib({ ...lib, targetProfiles: { ...lib.targetProfiles, [t.id]: t } });
  return (
    <div className="profiles">
      <h4>{t('Damage patterns (incoming damage, for EHP / RAH)')}</h4>
      <table className="grid small"><thead><tr><th></th><th>name</th>{DT.map((k) => <th key={k}>{k}</th>)}<th></th></tr></thead><tbody>
        {dps.map((d) => (
          <tr key={d.id} className={fit?.damage_pattern_id === d.id ? 'sel' : ''}>
            <td><input type="radio" disabled={!fit} checked={fit?.damage_pattern_id === d.id} onChange={() => fit && onFit({ ...fit, damage_pattern_id: d.id })} /></td>
            <td>{d.builtin ? d.name : <input value={d.name} onChange={(e) => saveD({ ...d, name: e.target.value })} />}</td>
            {DT.map((k) => <td key={k}>{d.builtin ? d[k] : <input className="qty" type="number" min={0} value={d[k]} onChange={(e) => saveD({ ...d, [k]: +e.target.value })} />}</td>)}
            <td>{!d.builtin && <button className="mini" onClick={() => { const { [d.id]: _x, ...rest } = lib.damagePatterns; void _x; onLib({ ...lib, damagePatterns: rest }); }}>✕</button>}</td>
          </tr>
        ))}
      </tbody></table>
      <button onClick={() => saveD({ id: uid(), name: 'Custom pattern', em: 25, thermal: 25, kinetic: 25, explosive: 25 })}>+ damage pattern</button>
      <h4>{t('Target profiles (outgoing DPS, graphs)')}</h4>
      <table className="grid small"><thead><tr><th></th><th>name</th>{DT.map((k) => <th key={k}>{k} res</th>)}<th>sig m</th><th>speed</th><th></th></tr></thead><tbody>
        {tps.map((t) => (
          <tr key={t.id}>
            <td><input type="radio" disabled={!fit} checked={fit?.target_profile_id === t.id} onChange={() => fit && onFit({ ...fit, target_profile_id: t.id })} /></td>
            <td>{t.builtin ? t.name : <input value={t.name} onChange={(e) => saveT({ ...t, name: e.target.value })} />}</td>
            {DT.map((k) => <td key={k}>{t.builtin ? `${(t[k] * 100).toFixed(0)}%` : <input className="qty" type="number" min={0} max={100} value={Math.round(t[k] * 100)} onChange={(e) => saveT({ ...t, [k]: +e.target.value / 100 })} />}</td>)}
            <td>{t.builtin ? t.signature_radius ?? '—' : <input className="qty" type="number" value={t.signature_radius ?? ''} onChange={(e) => saveT({ ...t, signature_radius: e.target.value === '' ? null : +e.target.value })} />}</td>
            <td>{t.builtin ? t.max_velocity ?? '—' : <input className="qty" type="number" value={t.max_velocity ?? ''} onChange={(e) => saveT({ ...t, max_velocity: e.target.value === '' ? null : +e.target.value })} />}</td>
            <td>{!t.builtin && <button className="mini" onClick={() => { const { [t.id]: _x, ...rest } = lib.targetProfiles; void _x; onLib({ ...lib, targetProfiles: rest }); }}>✕</button>}</td>
          </tr>
        ))}
      </tbody></table>
      <button onClick={() => saveT({ id: uid(), name: 'Custom target', em: 0.3, thermal: 0.3, kinetic: 0.3, explosive: 0.3, signature_radius: 150, max_velocity: 200, radius: 150 })}>+ target profile</button>
    </div>
  );
}
