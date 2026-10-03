import { describe, expect, it } from 'vitest';
import { BUILTIN_CHARACTERS, BUILTIN_DAMAGE, BUILTIN_TARGETS } from '../data/presets';
import { newFit, toRequest, type Library } from './model';

const lib = (): Library => ({
  fits: {}, characters: Object.fromEntries(BUILTIN_CHARACTERS.map((c) => [c.id, c])),
  damagePatterns: Object.fromEntries(BUILTIN_DAMAGE.map((d) => [d.id, d])), targetProfiles: Object.fromEntries(BUILTIN_TARGETS.map((t) => [t.id, t])),
});

describe('fit/model toRequest', () => {
  it('web.unit.request-shape: a UI fit becomes a contract FitRequest (schema 1, all-5 skills, uniform profile = null)', () => {
    const f = newFit(587, 'R');
    f.modules.push({ type_id: 2873, slot: 'high', state: 'active', charge_type_id: 21898, spool: 0.5 });
    const r: any = toRequest(f, lib());
    expect(r.schema_version).toBe(1);
    expect(r.ship).toEqual({ type_id: 587, mode_type_id: null });
    expect(r.character.skills.default_level).toBe(5);
    expect(r.modules[0]).toEqual({ type_id: 2873, slot: 'high', state: 'active', charge_type_id: 21898, mutation: null, spool: { type: 'spool_scale', amount: 0.5 } });
    expect(r.damage_pattern).toBeNull();
    expect(r.target_profile).toBeNull();
    expect(r.options.include_attributes).toBe('none');
  });
  it('web.unit.request-nested-fits: projected and fleet booster fits nest one level deep only', () => {
    const l = lib();
    const a = newFit(587, 'A'), b = newFit(603, 'B');
    a.projected.push({ kind: 'fit', fit_id: b.id, amount: 1, distance_m: 5000 });
    b.projected.push({ kind: 'fit', fit_id: a.id, amount: 1, distance_m: 5000 });
    a.fleet.booster_fit_ids.push(b.id);
    l.fits = { [a.id]: a, [b.id]: b };
    const r: any = toRequest(a, l);
    expect(r.projected[0].fit.ship.type_id).toBe(603);
    expect(r.projected[0].fit.projected).toEqual([]);
    expect(r.fleet.booster_fits[0].fleet.booster_fits).toEqual([]);
  });
  it('web.unit.request-missing-projected-fit: a projected fit deleted from the library is dropped', () => {
    const f = newFit(587, 'A');
    f.projected.push({ kind: 'fit', fit_id: 'gone', amount: 1, distance_m: null });
    expect((toRequest(f, lib()) as any).projected).toEqual([]);
  });
});
