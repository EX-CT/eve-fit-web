import { useState } from 'react';
import type { Dataset } from '../data/dataset';
import type { Fit } from '../fit/model';
import { cachedPrices, fetchPrices, type Prices } from '../data/prices';
import { Section } from './common';
import { t } from '../i18n';

const isk = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(2)}b` : v >= 1e6 ? `${(v / 1e6).toFixed(2)}m` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v.toFixed(0)) + ' ISK';

/** Fit value like Pyfa's price panel: ship, fittings (modules + loaded charges), drones/fighters, implants/boosters, cargo. */
export function PriceBox({ ds, fit }: { ds: Dataset; fit: Fit | null }) {
  const [prices, setPrices] = useState<Prices | null>(() => cachedPrices());
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (!fit) return null;
  const load = () => { setLoading(true); setErr(null); fetchPrices().then(setPrices, (e) => setErr(e.message)).finally(() => setLoading(false)); };
  if (!prices) return (
    <Section title={t('Price')}>
      <button className="loadprices" onClick={load} disabled={loading}>{loading ? '…' : t('Load market prices (ESI)')}</button>
      {err && <p className="error">{err}</p>}
    </Section>
  );
  const p = (id: number | null | undefined) => (id ? prices.map.get(id) ?? 0 : 0);
  const chargeQty = (mod: number, ch: number) => {
    const cap = ds.type(mod)?.capacity ?? 0, vol = ds.type(ch)?.volume ?? 0;
    return cap > 0 && vol > 0 ? Math.floor(cap / vol + 1e-9) : 1;
  };
  const rows: [string, number][] = [
    [t('Ship'), p(fit.ship_type_id)],
    [t('Fittings'), fit.modules.reduce((s, m) => s + p(m.mutation ? m.mutation.base_type_id : m.type_id) + (m.mutation ? p(m.mutation.mutaplasmid_type_id) : 0)
      + (m.charge_type_id ? p(m.charge_type_id) * chargeQty(m.type_id, m.charge_type_id) : 0), 0)],
    [t('Drones / fighters'), fit.drones.reduce((s, d) => s + p(d.type_id) * d.quantity, 0) + fit.fighters.reduce((s, f) => s + p(f.type_id) * f.quantity, 0)],
    [t('Implants & boosters'), fit.implants.reduce((s, i) => s + p(i), 0) + fit.boosters.reduce((s, b) => s + p(b.type_id), 0)],
    [t('Cargo'), fit.cargo.reduce((s, c) => s + p(c.type_id) * c.quantity, 0)],
  ];
  const total = rows.reduce((s, [, v]) => s + v, 0);
  return (
    <Section title={t('Price')} right={<b className="pricetotal">{isk(total)}</b>}>
      <div className="kv">{rows.filter(([, v]) => v > 0).map(([k, v]) => <span key={k}>{k} {isk(v)}</span>)}</div>
      <div className="muted small">{t('ESI average prices')} · {new Date(prices.at).toLocaleString()} <button className="mini" onClick={load} title={t('refresh')}>↻</button></div>
    </Section>
  );
}
