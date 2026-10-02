// End-to-end check of the main UI flows against a running site (any engine backend):
//   node tools/e2e.mjs <url> [engine-id]
import puppeteer from 'puppeteer-core';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/eve-fit-web/';
const engine = process.argv[3] ?? 'ts-worker';
const EFT = `[Vexor, E2E Vexor]
Drone Damage Amplifier II
Drone Damage Amplifier II
Medium Armor Repairer II
Energized Adaptive Nano Membrane II
Damage Control II

10MN Afterburner II
Warp Disruptor II
Stasis Webifier II [1]
Omnidirectional Tracking Link II

Drone Link Augmentor II
Small Energy Neutralizer II
Heavy Neutron Blaster II, Void M
Heavy Neutron Blaster II, Void M

Medium Auxiliary Nano Pump I
Medium Auxiliary Nano Pump I
Medium Capacitor Control Circuit I

Hammerhead II x5
Hobgoblin II x5

Inherent Implants 'Noble' Repair Proficiency RP-905
Improved Crash Booster

[1] Stasis Webifier II
  Unstable Stasis Webifier Mutaplasmid
  capacitorNeed 6, cpu 22.5, maxRange 12000, speedFactor -58
`;
const CARRIER = `[Thanatos, E2E Thanatos]

Fighter Support Unit II

Einherji II x9
Firbolg II x9
`;
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 1000 });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };
const stats = () => p.evaluate(() => window.__lastStats);
const waitNew = async (prev) => { await p.waitForFunction((pr) => window.__lastStats && JSON.stringify(window.__lastStats) !== pr, { timeout: 60000 }, JSON.stringify(prev)); return stats(); };
const clickText = (sel, text) => p.evaluate((s, t) => { const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim().startsWith(t)); if (!el) return false; el.click(); return true; }, sel, text);

await p.goto(`${url}?engine=${engine}&eft=${encodeURIComponent(EFT)}`, { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction(() => window.__lastStats?.offense, { timeout: 120000 });
let s = await stats();
check('EFT import via ?eft=, ship', s.ship?.name === 'Vexor', s.ship?.name);
check('drones dps', s.offense?.total?.drone_dps > 0, s.offense?.total?.drone_dps);
check('weapon dps (charges)', s.offense?.total?.weapon_dps > 0, s.offense?.total?.weapon_dps);
check('armor tank', s.defense?.tank?.raw?.armor_repair > 0, s.defense?.tank?.raw?.armor_repair);
check('mutated module imported', await p.evaluate(() => document.body.textContent.includes('Abyssal Stasis Webifier')));
check('no violations', (s.violations ?? []).length === 0, JSON.stringify(s.violations));

// projected web from the market
const v0 = s.navigation.max_velocity;
await clickText('.tabs button', 'Projected');
await p.evaluate(() => { const c = document.querySelector('.toggle input'); c.click(); });
await p.type('.market .search', 'Stasis Webifier II');
await p.waitForFunction(() => [...document.querySelectorAll('.trow .tname')].some((e) => e.textContent === 'Stasis Webifier II'));
await p.evaluate(() => [...document.querySelectorAll('.trow .tname')].find((e) => e.textContent === 'Stasis Webifier II').click());
s = await waitNew(s);
check('projected web slows the ship', s.navigation.max_velocity < v0 * 0.6, `${v0} -> ${s.navigation.max_velocity}`);

// environment beacon (wormhole)
const beacon = await p.evaluate(() => { const sel = [...document.querySelectorAll('select')].find((x) => x.options[0]?.text.startsWith('add system effect')); const o = [...sel.options].find((x) => x.text.startsWith('[wormhole]')); return o?.value; });
const sels = await p.$$('select');
for (const el of sels) { const first = await el.evaluate((x) => x.options[0]?.text); if (first?.startsWith('add system effect')) { await el.select(beacon); break; } }
s = await waitNew(s);
check('environment beacon applied', s.meta && (await p.evaluate(() => document.body.textContent.includes('wormhole'))), beacon);

// graphs
await clickText('.center .tabs button', 'Graphs');
for (const g of ['dps', 'cap', 'regen', 'mobility', 'lock', 'warp']) {
  await p.select('.graphs select', g);
  const n = await p.evaluate(() => document.querySelectorAll('svg.chart polyline').length);
  check(`graph ${g}`, n > 0, n);
}

// booster side effect toggle (armor HP penalty)
await clickText('.center .tabs button', 'Fit');
await clickText('.tabs button', 'Fitting');
const a0 = s.defense?.hp?.armor;
const toggled = await p.evaluate(() => { const l = [...document.querySelectorAll('.subopts label')].find((x) => x.textContent.includes('Armor Hp')); if (!l) return false; l.querySelector('input').click(); return true; });
s = await waitNew(s);
check('booster side effect lowers armor HP', toggled && s.defense?.hp?.armor < a0, `${a0} -> ${s.defense?.hp?.armor}`);

// undo / redo
await clickText('header button', '↶ Undo');
s = await waitNew(s);
const aU = s.defense?.hp?.armor;
await clickText('header button', '↷ Redo');
s = await waitNew(s);
check('undo / redo', aU === a0 && s.defense?.hp?.armor < a0, `${a0} -undo-> ${aU} -redo-> ${s.defense?.hp?.armor}`);

// show info on a fitted module -> engine-computed fitted values
await p.evaluate(() => [...document.querySelectorAll('.mod .mname')].find((e) => e.textContent.startsWith('Heavy Neutron Blaster II')).click());
await p.waitForFunction(() => document.querySelector('.dialog table.attrs thead') || document.querySelector('.dialog')?.textContent.includes('unavailable') || document.querySelector('.dialog')?.textContent.includes('did not return'), { timeout: 30000 });
const fi = await p.evaluate(() => ({ head: !!document.querySelector('.dialog table.attrs thead'), changed: document.querySelectorAll('.dialog tr.changed').length, note: document.querySelector('.dialog p.muted')?.textContent }));
check('show info: fitted attribute values', fi.head && fi.changed > 0, `${fi.changed} changed; ${fi.note}`);
// attribute override (Pyfa-style): damageMultiplier of the blaster type
const wd0 = s.offense?.total?.weapon_dps;
await p.click('.dialog input.editov');
await p.waitForSelector('.dialog input.ovin[data-attr="64"]');
await p.type('.dialog input.ovin[data-attr="64"]', '10');
s = await waitNew(s);
check('attribute override raises weapon dps', s.offense?.total?.weapon_dps > wd0 * 1.5, `${wd0} -> ${s.offense?.total?.weapon_dps}`);
await p.evaluate(() => { const i = document.querySelector('.dialog input.ovin[data-attr="64"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); });
s = await waitNew(s);
check('removing the override restores dps', Math.abs(s.offense?.total?.weapon_dps - wd0) < 1e-6, s.offense?.total?.weapon_dps);
await clickText('.dialog button', 'Close');

// manual fleet buff (shield harmonizing)
await clickText('.tabs button', 'Projected');
const sr0 = s.defense?.resonance?.shield?.em;
const buffId = await p.evaluate(() => [...document.querySelector('select.buffsel').options].find((o) => o.text === 'Shield Burst: Shield Harmonizing: Shield Resistance')?.value);
await p.select('select.buffsel', buffId);
s = await waitNew(s);
check('manual fleet buff raises shield resist (lower resonance)', s.defense?.resonance?.shield?.em < sr0, `${sr0} -> ${s.defense?.resonance?.shield?.em}`);

// export EFT round trip
await clickText('header button', 'Import / export');
await clickText('.dialog button', 'Export EFT');
const eft = await p.evaluate(() => document.querySelector('textarea.eft').value);
check('EFT export', eft.startsWith('[Vexor, E2E Vexor]') && eft.includes('Hammerhead II x5'), eft.split('\n')[0]);
check('mutated module EFT round trip', eft.includes('Stasis Webifier II [1]') && eft.includes('[1] Stasis Webifier II\n  Unstable Stasis Webifier Mutaplasmid\n') && eft.includes('maxRange 12000'), eft.split('\n').slice(-3).join(' / '));
await clickText('.dialog button', 'Export DNA');
const dna = await p.evaluate(() => document.querySelector('textarea.eft').value);
check('DNA export', /^626:/.test(dna) && dna.endsWith('::'), dna);
await clickText('.dialog button', 'Export multibuy');
const mb = await p.evaluate(() => document.querySelector('textarea.eft').value);
check('multibuy export', mb.startsWith('Vexor x1') && mb.includes('Hammerhead II x5') && mb.includes('Unstable Stasis Webifier Mutaplasmid x1'), mb.split('\n').length + ' lines');
await clickText('.dialog button', 'Export ESI JSON');
const esi = await p.evaluate(() => document.querySelector('textarea.eft').value);
let ej = null; try { ej = JSON.parse(esi); } catch {}
check('ESI JSON export', ej?.ship_type_id === 626 && ej.items.some((i) => i.flag === 'HiSlot0') && ej.items.some((i) => i.flag === 'DroneBay'), ej ? ej.items.length + ' items' : esi.slice(0, 80));
if (await p.$('.dialog')) await clickText('.dialog button', 'Close');

// character: clone All 5 and drop to level 0 -> less dps
const d5 = s.offense.total.dps.total;
await clickText('.left .tabs button', 'Character');
await clickText('.character button', 'Clone');
await p.evaluate(() => { const sel = [...document.querySelectorAll('.character select')].find((x) => x.closest('label')?.textContent.includes('default level')); sel.value = '0'; sel.dispatchEvent(new Event('change', { bubbles: true })); });
await clickText('.center .tabs button', 'Fit');
const chSel = await p.$('.fithead select[title=Character]');
const cid = await p.evaluate(() => [...document.querySelector('.fithead select[title=Character]').options].find((o) => o.text.includes('(copy)'))?.value);
await chSel.select(cid);
s = await waitNew(s);
check('custom character (all 0) lowers dps', s.offense.total.dps.total < d5, `${d5} -> ${s.offense.total.dps.total}`);
check('missing skills reported', (s.violations ?? []).some((v) => v.code === 'MISSING_SKILL'));
// per-module spool-up (Triglavian disintegrator)
await p.goto(`${url}?engine=${engine}&eft=${encodeURIComponent('[Vedmak, E2E Vedmak]\n\nHeavy Entropic Disintegrator II, Baryon Exotic Plasma M\n')}`, { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction(() => window.__lastStats?.ship?.name === 'Vedmak', { timeout: 120000 });
s = await stats();
const sp1 = s.offense?.total?.weapon_dps;
await p.select('select.spool', '0');
s = await waitNew(s);
check('per-module spool 0% lowers disintegrator dps', s.offense?.total?.weapon_dps < sp1, `${sp1} -> ${s.offense?.total?.weapon_dps}`);

// ESI JSON re-import (new fit)
await clickText('header button', 'Import / export');
await p.evaluate((t) => { const ta = document.querySelector('textarea.eft'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(ta, t); ta.dispatchEvent(new Event('input', { bubbles: true })); }, esi);
await clickText('.dialog button', 'Import');
await new Promise((r) => setTimeout(r, 500));
await new Promise((r) => setTimeout(r, 1500));
const imp = await p.evaluate(() => ({ open: !!document.querySelector('.dialog'), msg: document.querySelector('.dialog p.muted')?.textContent ?? '', ship: window.__lastStats?.ship?.name, mods: window.__lastStats?.modules?.length }));
check('ESI JSON re-import', !imp.open && imp.ship === 'Vexor' && imp.mods === 15, imp.msg || `${imp.ship}, ${imp.mods} modules`);

// multi-fit EFT paste + fit browser grouping
await clickText('header button', 'Import / export');
await p.evaluate((t) => { const ta = document.querySelector('textarea.eft'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(ta, t); ta.dispatchEvent(new Event('input', { bubbles: true })); }, '[Rifter, Multi A]\n200mm AutoCannon II\n\n[Merlin, Multi B]\nLight Neutron Blaster II\n');
await clickText('.dialog button', 'Import');
await new Promise((r) => setTimeout(r, 800));
await clickText('.left .tabs button', 'Fits');
const fb = await p.evaluate(() => ({ groups: [...document.querySelectorAll('.fitbrowser summary')].map((x) => x.textContent), names: [...document.querySelectorAll('.fitbrowser li')].map((x) => x.textContent) }));
check('multi-fit EFT import + fit browser groups', fb.names.some((n) => n.includes('Multi A')) && fb.names.some((n) => n.includes('Multi B')) && fb.groups.some((g) => g.startsWith('Frigate')), fb.groups.join(', '));
await p.type('.fitbrowser .search', 'Merlin');
const fbn = await p.evaluate(() => document.querySelectorAll('.fitbrowser li').length);
check('fit browser search', fbn === 1, fbn);

// fighters: abilities
await p.goto(`${url}?engine=${engine}&eft=${encodeURIComponent(CARRIER)}`, { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction(() => window.__lastStats?.ship?.name === 'Thanatos', { timeout: 120000 });
s = await stats();
const f0 = s.offense?.total?.fighter_dps ?? s.offense?.total?.drone_dps;
check('fighter dps', f0 > 0, f0);
const ab = await p.evaluate(() => [...document.querySelectorAll('.subopts label')].filter((l) => l.querySelector('input.ability')).map((l) => l.textContent.trim() + (l.querySelector('input').checked ? '*' : '')));
check('fighter abilities listed', ab.length >= 4, ab.join(', '));
await p.evaluate(() => { const l = [...document.querySelectorAll('.subopts label')].find((x) => x.querySelector('input.ability')?.checked && x.textContent.includes('Attack')); l.querySelector('input').click(); });
s = await waitNew(s);
const f1 = s.offense?.total?.fighter_dps ?? s.offense?.total?.drone_dps;
check('disabling an attack ability lowers fighter dps', f1 < f0, `${f0} -> ${f1}`);
check('no page errors', errors.length === 0, errors.join(' | '));

await b.close();
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail !== '' ? '  — ' + r.detail : ''}`);
const fails = results.filter((r) => !r.ok).length;
console.log(`${results.length - fails}/${results.length} passed (${engine})`);
process.exit(fails ? 1 : 0);
