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
Cap Recharger II
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
await clickText('.dialog button', 'Export DNA');
const dna = await p.evaluate(() => document.querySelector('textarea.eft').value);
check('DNA export', /^626:/.test(dna) && dna.endsWith('::'), dna);
await clickText('.dialog button', 'Close');

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
