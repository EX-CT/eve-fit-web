// EFT text and DNA (ship:mod;qty:...::) import/export, written from the public formats (no Pyfa code).
import type { Dataset, Slot } from '../data/dataset';
import { newFit, type Fit, type FitModule } from './model';

const SLOT_ORDER: Slot[] = ['low', 'mid', 'high', 'rig', 'subsystem', 'service'];
const EMPTY_LABEL: Record<Slot, string> = { low: 'Low', mid: 'Med', high: 'High', rig: 'Rig', subsystem: 'Subsystem', service: 'Service' };

export interface ImportResult { fit: Fit; warnings: string[] }

export function parseEft(ds: Dataset, text: string): ImportResult {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim());
  const warnings: string[] = [];
  const head = lines.findIndex((l) => l.startsWith('['));
  if (head < 0) throw new Error('EFT: missing "[Ship, Name]" header');
  const m = /^\[([^,\]]+)(?:,\s*(.*))?\]$/.exec(lines[head]);
  if (!m) throw new Error('EFT: bad header ' + lines[head]);
  const ship = ds.byExactName(m[1]);
  if (ship == null || !ds.isShip(ship)) throw new Error(`EFT: unknown ship "${m[1]}"`);
  const fit = newFit(ship, (m[2] ?? '').trim() || 'Imported fit');
  for (const raw of lines.slice(head + 1)) {
    if (!raw || /^\[empty .* slot\]$/i.test(raw)) continue;
    if (/^\[\d+\]/.test(raw)) { warnings.push(`mutated module details not supported yet: ${raw}`); continue; }
    let line = raw, offline = false;
    if (/\/offline$/i.test(line)) { offline = true; line = line.replace(/\s*\/offline$/i, ''); }
    line = line.replace(/\s*\[\d+\]$/, '');
    const qm = /^(.*?)\s+x(\d+)$/.exec(line);
    if (qm) {
      const id = ds.byExactName(qm[1]);
      if (id == null) { warnings.push(`unknown item "${qm[1]}"`); continue; }
      const q = +qm[2], k = ds.kind(id);
      if (k === 'drone') fit.drones.push({ type_id: id, quantity: q, active: q });
      else if (k === 'fighter') fit.fighters.push({ type_id: id, quantity: q, active: true });
      else fit.cargo.push({ type_id: id, quantity: q });
      continue;
    }
    const [modName, chargeName] = line.split(',').map((s) => s.trim());
    const id = ds.byExactName(modName);
    if (id == null) { warnings.push(`unknown item "${modName}"`); continue; }
    const k = ds.kind(id);
    if (k === 'implant') { fit.implants.push(id); continue; }
    if (k === 'booster') { fit.boosters.push({ type_id: id }); continue; }
    if (k === 'drone') { fit.drones.push({ type_id: id, quantity: 1, active: 1 }); continue; }
    if (k === 'charge') { fit.cargo.push({ type_id: id, quantity: 1 }); continue; }
    const slot = ds.slot(id);
    if (!slot) { warnings.push(`"${modName}" is not a fittable module`); continue; }
    let charge: number | null = null;
    if (chargeName) { charge = ds.byExactName(chargeName) ?? null; if (charge == null) warnings.push(`unknown charge "${chargeName}"`); }
    fit.modules.push({ type_id: id, slot, state: offline ? 'offline' : defaultState(ds, id), charge_type_id: charge });
  }
  return { fit, warnings };
}

/** Pyfa-like default: modules that can be activated are active, passive ones online */
export function defaultState(ds: Dataset, id: number): FitModule['state'] {
  const t = ds.type(id);
  if (!t) return 'online';
  const activatable = t.effects.some(([e]) => { const c = ds.raw.effects[e]?.category; return c === 1 || c === 2 || c === 3; });
  return activatable ? 'active' : 'online';
}

export function exportEft(ds: Dataset, fit: Fit, slotTotals?: Partial<Record<Slot, number>>): string {
  const out: string[] = [`[${ds.name(fit.ship_type_id, 'en')}, ${fit.name}]`];
  for (const s of SLOT_ORDER) {
    const mods = fit.modules.filter((m) => m.slot === s);
    const total = Math.max(slotTotals?.[s] ?? 0, mods.length);
    if (total === 0) continue;
    for (const m of mods) {
      let l = ds.name(m.type_id, 'en');
      if (m.charge_type_id) l += `, ${ds.name(m.charge_type_id, 'en')}`;
      if (m.state === 'offline') l += ' /OFFLINE';
      out.push(l);
    }
    for (let i = mods.length; i < total; i++) out.push(`[Empty ${EMPTY_LABEL[s]} slot]`);
    out.push('');
  }
  const section = (rows: string[]) => { if (rows.length) out.push('', ...rows); };
  section(fit.drones.map((d) => `${ds.name(d.type_id, 'en')} x${d.quantity}`));
  section(fit.fighters.map((f) => `${ds.name(f.type_id, 'en')} x${f.quantity}`));
  section([...fit.implants.map((i) => ds.name(i, 'en')), ...fit.boosters.map((b) => ds.name(b.type_id, 'en'))]);
  section(fit.cargo.map((c) => `${ds.name(c.type_id, 'en')} x${c.quantity}`));
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function parseDna(ds: Dataset, text: string): ImportResult {
  const warnings: string[] = [];
  const s = text.trim().replace(/^fitting:/, '').replace(/^<url=fitting:/, '').replace(/>.*$/, '');
  const parts = s.split(':').filter((p) => p.length);
  const ship = +parts[0];
  if (!ds.isShip(ship)) throw new Error(`DNA: ${parts[0]} is not a ship type`);
  const fit = newFit(ship, `${ds.name(ship, 'en')} (DNA)`);
  const charges: { id: number; q: number }[] = [];
  for (const p of parts.slice(1)) {
    const [idS, qS] = p.split(';');
    const id = +idS.replace(/_$/, ''), q = +(qS ?? 1) || 1;
    const k = ds.kind(id);
    if (!ds.type(id)) { warnings.push(`unknown type ${idS}`); continue; }
    if (k === 'drone') fit.drones.push({ type_id: id, quantity: q, active: q });
    else if (k === 'fighter') fit.fighters.push({ type_id: id, quantity: q, active: true });
    else if (k === 'implant') fit.implants.push(id);
    else if (k === 'booster') fit.boosters.push({ type_id: id });
    else if (k === 'charge') charges.push({ id, q });
    else if (idS.endsWith('_')) fit.cargo.push({ type_id: id, quantity: q });
    else {
      const slot = ds.slot(id);
      if (!slot) { fit.cargo.push({ type_id: id, quantity: q }); continue; }
      for (let i = 0; i < q; i++) fit.modules.push({ type_id: id, slot, state: defaultState(ds, id), charge_type_id: null });
    }
  }
  for (const c of charges) {
    const fits = fit.modules.filter((m) => !m.charge_type_id && ds.chargesFor(m.type_id).includes(c.id));
    for (const m of fits) m.charge_type_id = c.id;
    fit.cargo.push({ type_id: c.id, quantity: c.q });
  }
  return { fit, warnings };
}

export function exportDna(fit: Fit): string {
  const counts = new Map<string, number>();
  const add = (k: string, q: number) => counts.set(k, (counts.get(k) ?? 0) + q);
  for (const s of ['subsystem', 'high', 'mid', 'low', 'rig', 'service'] as Slot[])
    for (const m of fit.modules.filter((x) => x.slot === s)) add(String(m.type_id), 1);
  for (const d of fit.drones) add(String(d.type_id), d.quantity);
  for (const f of fit.fighters) add(String(f.type_id), f.quantity);
  for (const i of fit.implants) add(String(i), 1);
  for (const b of fit.boosters) add(String(b.type_id), 1);
  const charges = new Map<number, number>();
  for (const m of fit.modules) if (m.charge_type_id) charges.set(m.charge_type_id, (charges.get(m.charge_type_id) ?? 0) + 1);
  for (const c of fit.cargo) add(charges.has(c.type_id) ? String(c.type_id) : `${c.type_id}_`, c.quantity);
  for (const [c, n] of charges) if (!fit.cargo.some((x) => x.type_id === c)) add(String(c), n);
  return `${fit.ship_type_id}:` + [...counts].map(([k, q]) => `${k};${q}`).join(':') + '::';
}

export function detectAndParse(ds: Dataset, text: string): ImportResult {
  const t = text.trim();
  if (/^(fitting:)?\d+:/.test(t) || t.startsWith('<url=fitting:')) return parseDna(ds, t);
  return parseEft(ds, t);
}
