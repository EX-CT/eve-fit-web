// End-to-end check of the main UI flows against a running site (any engine backend):
//   node tools/e2e.mjs <url> [engine-id]      (url may carry a query, e.g. ...?http=http://127.0.0.1:8787 for engine http)
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
// Check names: stable id `web.e2e.<slug>` + description (docs/test-ids.md maps ids to the old names).
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };
const stats = () => p.evaluate(() => window.__lastStats);
const waitNew = async (prev) => { await p.waitForFunction((pr) => window.__lastStats && JSON.stringify(window.__lastStats) !== pr, { timeout: 60000 }, JSON.stringify(prev)); return stats(); };
const clickText = (sel, text) => p.evaluate((s, t) => { const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim().startsWith(t)); if (!el) return false; el.click(); return true; }, sel, text);

const sep = url.includes("?") ? "&" : "?";
await p.goto(`${url}${sep}engine=${engine}&eft=${encodeURIComponent(EFT)}`, { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction(() => window.__lastStats?.offense, { timeout: 120000 });
// The page must run the backend under test (a malformed URL used to fall back to the default backend silently).
const active = await p.evaluate(() => window.__eveEngine?.info?.id);
if (active !== engine) { console.log(`FAIL  active backend  — wanted ${engine}, page runs ${active}`); await b.close(); process.exit(1); }
let s = await stats();
check('web.e2e.eft-share-link-import: EFT import via ?eft=, ship', s.ship?.name === 'Vexor', s.ship?.name);
check('web.e2e.drone-dps: drones dps', s.offense?.total?.drone_dps > 0, s.offense?.total?.drone_dps);
check('web.e2e.weapon-dps-charges: weapon dps (charges)', s.offense?.total?.weapon_dps > 0, s.offense?.total?.weapon_dps);
check('web.e2e.armor-tank: armor tank', s.defense?.tank?.raw?.armor_repair > 0, s.defense?.tank?.raw?.armor_repair);
check('web.e2e.mutated-module-import: mutated module imported', await p.evaluate(() => document.body.textContent.includes('Abyssal Stasis Webifier')));
check('web.e2e.no-violations: no violations', (s.violations ?? []).length === 0, JSON.stringify(s.violations));
// Chinese mode: weapon names in the stats table come from the dataset (zh), not the engine's English strings
const langSel = async (l) => p.evaluate((v) => { const sel = [...document.querySelectorAll('header select')].find((x) => [...x.options].some((o) => o.value === 'zh')); sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); }, l);
await langSel('zh');
await new Promise((r) => setTimeout(r, 300));
const zhW = await p.evaluate(() => [...document.querySelectorAll('.stats td.wname')].map((x) => x.textContent));
check('web.e2e.zh-weapon-names: zh weapon names', zhW.length > 0 && zhW.every((n) => /[\u4e00-\u9fff]/.test(n) && !n.includes('Heavy Neutron')), zhW.join(' | '));
await langSel('en');
await new Promise((r) => setTimeout(r, 300));
const enW = await p.evaluate(() => [...document.querySelectorAll('.stats td.wname')].map((x) => x.textContent));
check('web.e2e.en-weapon-names-restored: en weapon names restored', enW.some((n) => n.startsWith('Heavy Neutron Blaster II')), enW.join(' | '));

// projected web from the market
const v0 = s.navigation.max_velocity;
await clickText('.tabs button', 'Projected');
await p.evaluate(() => { const c = document.querySelector('.toggle input'); c.click(); });
await p.type('.market .search', 'Stasis Webifier II');
await p.waitForFunction(() => [...document.querySelectorAll('.trow .tname')].some((e) => e.textContent === 'Stasis Webifier II'));
await p.evaluate(() => [...document.querySelectorAll('.trow .tname')].find((e) => e.textContent === 'Stasis Webifier II').click());
s = await waitNew(s);
check('web.e2e.projected-web: projected web slows the ship', s.navigation.max_velocity < v0 * 0.6, `${v0} -> ${s.navigation.max_velocity}`);

// environment beacon (wormhole)
const beacon = await p.evaluate(() => { const sel = [...document.querySelectorAll('select')].find((x) => x.options[0]?.text.startsWith('add system effect')); const o = [...sel.options].find((x) => x.text.startsWith('[wormhole]')); return o?.value; });
const sels = await p.$$('select');
for (const el of sels) { const first = await el.evaluate((x) => x.options[0]?.text); if (first?.startsWith('add system effect')) { await el.select(beacon); break; } }
s = await waitNew(s);
check('web.e2e.environment-beacon: environment beacon applied', s.meta && (await p.evaluate(() => document.body.textContent.includes('wormhole'))), beacon);

// graphs
await clickText('.center .tabs button', 'Graphs');
// Backends with the graph RPC (CONTRACT-GRAPHS 0.2) must render engine-computed series; the others the UI approximation.
// E2E_GRAPH_RPC=1/0 forces it; otherwise wasm-worker (F) has it, and an http engine has it if it answers graph_specs.
const GRAPH_RPC = process.env.E2E_GRAPH_RPC ? process.env.E2E_GRAPH_RPC === '1'
  : ['wasm-j-worker', 'wasm-worker'].includes(engine) || (engine === 'http' && (await p.evaluate(async () => !!(await window.__eveEngine?.graphSpecs?.()))));
const kinds = ['dps', 'cap', 'regen', 'mobility', 'lock', 'warp', ...(GRAPH_RPC ? ['app', 'ewar', 'rr'] : [])];
if (GRAPH_RPC) await p.waitForFunction(() => document.querySelector('.graphs select option[value="app"]'), { timeout: 30000 }).catch(() => {});
const offered = await p.evaluate(() => [...document.querySelectorAll('.graphs select option')].map((o) => o.value));
check(GRAPH_RPC ? 'web.e2e.graph-set: graphs: engine-only graphs offered' : 'web.e2e.graph-set: graphs: approximation set only', GRAPH_RPC ? ['app', 'ewar', 'rr'].every((x) => offered.includes(x)) : !offered.includes('app'), offered.join(','));
for (const g of kinds) {
  await p.select('.graphs select', g);
  const want = GRAPH_RPC ? 'engine' : 'approx';
  const src = await p.waitForFunction((w) => { const e = document.querySelector('.graph-src'); return e && e.dataset.src === w && e.dataset.src; }, { timeout: 30000 }, want).then((h) => h.jsonValue(), () => p.evaluate(() => document.querySelector('.graph-src')?.dataset.src + ' ' + (document.querySelector('.graph-src')?.title ?? '')));
  const n = await p.evaluate(() => document.querySelectorAll('svg.chart polyline').length);
  const lg = await p.evaluate(() => window.__lastGraph);
  if (GRAPH_RPC && g === 'dps') {
    // which backend computed the graph: the engine itself, or its GRAPH_FALLBACK (wasm-j-worker -> wasm-worker)
    const by = await p.evaluate(() => document.querySelector('.graph-src')?.dataset.graphBackend);
    const wantBy = engine === 'wasm-j-worker' ? 'wasm-worker' : engine;
    check('web.e2e.graph-backend-label: graph backend label', by === wantBy, `${by} (fit stats: ${engine})`);
  }
  check(`web.e2e.graph-${g}: graph ${g} (${want})`, n > 0 && src === want && (!GRAPH_RPC || lg?.kind === g), `${n} lines, ${src}${lg?.series ? ', ' + lg.series.map((x) => `${x.name}:${x.n}`).join(' ') : ''}`);
  if (GRAPH_RPC && g === 'lock') {
    // lock time = min(40000 / scanRes / asinh(sig)^2, 1800) at sig 10 m, from the stats of the same engine
    const sr = s.targeting?.scan_resolution, want10 = Math.min(40000 / sr / Math.asinh(10) ** 2, 1800), got = lg?.series?.[0]?.first;
    check('web.e2e.graph-lock-time-matches-stats: engine lock-time graph matches stats', got && Math.abs(got[1] - want10) <= 1e-6 * want10, `${got?.[1]} vs ${want10}`);
  }
  if (GRAPH_RPC && g === 'ewar') check('web.e2e.graph-ewar-web-neut: engine ewar graph has web + neut', ['web_pct', 'neut_gj_s'].every((y) => lg?.series?.some((x) => x.name === y)), lg?.series?.map((x) => x.name).join(','));
  if (GRAPH_RPC && g === 'cap') check('web.e2e.graph-cap-within-capacity: engine capacitor graph within capacity', lg?.series?.[0]?.first?.[1] > 0 && lg.series[0].first[1] <= s.capacitor?.capacity * (1 + 1e-9), `t=0 ${lg?.series?.[0]?.first?.[1]} (after first activations, capsim) of ${s.capacitor?.capacity} GJ`);
}

// booster side effect toggle (armor HP penalty)
await clickText('.center .tabs button', 'Fit');
await clickText('.tabs button', 'Fitting');
const a0 = s.defense?.hp?.armor;
const toggled = await p.evaluate(() => { const l = [...document.querySelectorAll('.subopts label')].find((x) => x.textContent.includes('Armor Hp')); if (!l) return false; l.querySelector('input').click(); return true; });
s = await waitNew(s);
check('web.e2e.booster-side-effect: booster side effect lowers armor HP', toggled && s.defense?.hp?.armor < a0, `${a0} -> ${s.defense?.hp?.armor}`);

// undo / redo
await clickText('header button', '↶ Undo');
s = await waitNew(s);
const aU = s.defense?.hp?.armor;
await clickText('header button', '↷ Redo');
s = await waitNew(s);
check('web.e2e.undo-redo: undo / redo', aU === a0 && s.defense?.hp?.armor < a0, `${a0} -undo-> ${aU} -redo-> ${s.defense?.hp?.armor}`);

// show info on a fitted module -> engine-computed fitted values
await p.evaluate(() => [...document.querySelectorAll('.mod .mname')].find((e) => e.textContent.startsWith('Heavy Neutron Blaster II')).click());
await p.waitForFunction(() => document.querySelector('.dialog table.attrs thead') || document.querySelector('.dialog')?.textContent.includes('unavailable') || document.querySelector('.dialog')?.textContent.includes('did not return'), { timeout: 30000 });
const fi = await p.evaluate(() => ({ head: !!document.querySelector('.dialog table.attrs thead'), changed: document.querySelectorAll('.dialog tr.changed').length, note: document.querySelector('.dialog p.muted')?.textContent }));
check('web.e2e.show-info-fitted-values: show info: fitted attribute values', fi.head && fi.changed > 0, `${fi.changed} changed; ${fi.note}`);
// attribute override (Pyfa-style): damageMultiplier of the blaster type
const wd0 = s.offense?.total?.weapon_dps;
await p.click('.dialog input.editov');
await p.waitForSelector('.dialog input.ovin[data-attr="64"]');
await p.type('.dialog input.ovin[data-attr="64"]', '10');
s = await waitNew(s);
check('web.e2e.attribute-override: attribute override raises weapon dps', s.offense?.total?.weapon_dps > wd0 * 1.5, `${wd0} -> ${s.offense?.total?.weapon_dps}`);
await p.evaluate(() => { const i = document.querySelector('.dialog input.ovin[data-attr="64"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); });
s = await waitNew(s);
check('web.e2e.attribute-override-removed: removing the override restores dps', Math.abs(s.offense?.total?.weapon_dps - wd0) < 1e-6, s.offense?.total?.weapon_dps);
await clickText('.dialog button', 'Close');

// manual fleet buff (shield harmonizing)
await clickText('.tabs button', 'Projected');
const sr0 = s.defense?.resonance?.shield?.em;
const buffId = await p.evaluate(() => [...document.querySelector('select.buffsel').options].find((o) => o.text === 'Shield Burst: Shield Harmonizing: Shield Resistance')?.value);
await p.select('select.buffsel', buffId);
s = await waitNew(s);
check('web.e2e.manual-fleet-buff: manual fleet buff raises shield resist (lower resonance)', s.defense?.resonance?.shield?.em < sr0, `${sr0} -> ${s.defense?.resonance?.shield?.em}`);

// export EFT round trip
await clickText('header button', 'Import / export');
await clickText('.dialog button', 'Export EFT');
const eft = await p.evaluate(() => document.querySelector('textarea.eft').value);
check('web.e2e.eft-export: EFT export', eft.startsWith('[Vexor, E2E Vexor]') && eft.includes('Hammerhead II x5'), eft.split('\n')[0]);
check('web.e2e.eft-export-mutated: mutated module EFT round trip', eft.includes('Stasis Webifier II [1]') && eft.includes('[1] Stasis Webifier II\n  Unstable Stasis Webifier Mutaplasmid\n') && eft.includes('maxRange 12000'), eft.split('\n').slice(-3).join(' / '));
await clickText('.dialog button', 'Export DNA');
const dna = await p.evaluate(() => document.querySelector('textarea.eft').value);
check('web.e2e.dna-export: DNA export', /^626:/.test(dna) && dna.endsWith('::'), dna);
await clickText('.dialog button', 'Export multibuy');
const mb = await p.evaluate(() => document.querySelector('textarea.eft').value);
check('web.e2e.multibuy-export: multibuy export', /^Vexor\n/.test(mb) && mb.includes('Hammerhead II x5') && mb.includes('Heavy Neutron Blaster II x2'), mb.split('\n').length + ' lines');
await clickText('.dialog button', 'Export ESI JSON');
const esi = await p.evaluate(() => document.querySelector('textarea.eft').value);
let ej = null; try { ej = JSON.parse(esi); } catch {}
check('web.e2e.esi-json-export: ESI JSON export', ej?.ship_type_id === 626 && ej.items.some((i) => i.flag === 27 || i.flag === 'HiSlot0') && ej.items.some((i) => i.flag === 87 || i.flag === 'DroneBay'), ej ? ej.items.length + ' items' : esi.slice(0, 80));
// Pyfa formats through the eve-fit-formats module: EVE XML export, ship-stats text (engine stats of the shipstats request)
const prov = await p.evaluate(() => document.querySelector('.formats-provider')?.dataset.provider);
check('web.e2e.formats-provider: imports / exports run through eve-fit-formats (WASM)', prov === 'eve-fit-formats', prov);
let xml = '';
if (await p.$('.dialog button.export-xml')) { await p.click('.dialog button.export-xml'); xml = await p.evaluate(() => document.querySelector('textarea.eft').value); }
check('web.e2e.xml-export: EVE XML export', xml.includes('<fitting name="E2E Vexor">') && xml.includes('base_type="Stasis Webifier II"'), xml.split('\n').length + ' lines');
let ss = '';
if (await p.$('.dialog button.export-shipstats')) {
  await p.click('.dialog button.export-shipstats');
  ss = await p.waitForFunction(() => { const v = document.querySelector('textarea.eft').value; return v && !v.startsWith('<?xml') ? v : null; }, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => '');
}
check('web.e2e.shipstats-export: ship stats export (engine stats + formats module)', /Vexor/.test(ss) && /DPS|dps/.test(ss), ss.split('\n').slice(0, 2).join(' / '));
if (await p.$('.dialog')) await clickText('.dialog button', 'Close');

// implant sets (SDE presets): applying High-grade Snake fills slots 1-6, keeps the slot-7+ implant, raises velocity
await clickText('.center .tabs button', 'Fit');
await clickText('.center .tabs button', 'Fitting');
s = await stats();
const hasSets = await p.evaluate(() => !!document.querySelector('select.implantset option[value="snake.high-grade"]'));
if (hasSets) {
  const v0s = s.navigation?.max_velocity;
  await p.select('select.implantset', 'snake.high-grade');
  s = await waitNew(s);
  const imps = await p.evaluate(() => [...document.querySelectorAll('.bay .mod .mname')].map((x) => x.textContent).filter((n) => /Snake|RP-905/.test(n)));
  check('web.e2e.implant-set: implant set applied (6 Snake + kept RP-905, faster)', imps.filter((n) => n.includes('High-grade Snake')).length === 6 && imps.some((n) => n.includes('RP-905')) && s.navigation?.max_velocity > v0s, `${imps.length} implants; ${v0s} -> ${s.navigation?.max_velocity} m/s`);
} else check('web.e2e.implant-set: implant set applied (6 Snake + kept RP-905, faster)', false, 'no SDE implant sets loaded');
// SDE NPC damage profile in the Profiles tab changes EHP
await clickText('.left .tabs button', 'Profiles');
await p.evaluate(() => document.querySelector('.sdetoggle input')?.click());
const ehp0 = s.defense?.ehp?.total;
const picked = await p.evaluate(() => { const tr = [...document.querySelectorAll('.profiles tr')].find((r) => r.textContent.includes('[NPC] Guristas Pirates')); tr?.querySelector('input[type=radio]')?.click(); return !!tr; });
if (picked) s = await waitNew(s);
check('web.e2e.sde-npc-damage-profile: SDE NPC damage profile (Guristas) changes EHP', picked && s.defense?.ehp?.total !== ehp0, `${ehp0} -> ${s.defense?.ehp?.total}`);
await p.evaluate(() => { const tr = [...document.querySelectorAll('.profiles tr')].find((r) => r.textContent.trim().startsWith('Uniform')); tr?.querySelector('input[type=radio]')?.click(); });
s = await waitNew(s);
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
check('web.e2e.custom-character: custom character (all 0) lowers dps', s.offense.total.dps.total < d5, `${d5} -> ${s.offense.total.dps.total}`);
check('web.e2e.missing-skills: missing skills reported', (s.violations ?? []).some((v) => v.code === 'MISSING_SKILL'));
// per-module spool-up (Triglavian disintegrator)
await p.goto(`${url}${sep}engine=${engine}&eft=${encodeURIComponent('[Vedmak, E2E Vedmak]\n\nHeavy Entropic Disintegrator II, Baryon Exotic Plasma M\n')}`, { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction(() => window.__lastStats?.ship?.name === 'Vedmak', { timeout: 120000 });
s = await stats();
const sp1 = s.offense?.total?.weapon_dps;
await p.select('select.spool', '0');
s = await waitNew(s);
check('web.e2e.per-module-spool: per-module spool 0% lowers disintegrator dps', s.offense?.total?.weapon_dps < sp1, `${sp1} -> ${s.offense?.total?.weapon_dps}`);

// ESI JSON re-import (new fit)
await clickText('header button', 'Import / export');
await p.evaluate((t) => { const ta = document.querySelector('textarea.eft'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(ta, t); ta.dispatchEvent(new Event('input', { bubbles: true })); }, esi);
await clickText('.dialog button', 'Import');
await new Promise((r) => setTimeout(r, 500));
await new Promise((r) => setTimeout(r, 1500));
const imp = await p.evaluate(() => ({ open: !!document.querySelector('.dialog'), msg: document.querySelector('.dialog p.muted')?.textContent ?? '', ship: window.__lastStats?.ship?.name, mods: window.__lastStats?.modules?.length }));
// ESI fitting JSON carries no mutation data: like Pyfa, the import drops the abyssal web (15 -> 14 modules)
check('web.e2e.esi-json-reimport: ESI JSON re-import', !imp.open && imp.ship === 'Vexor' && imp.mods === 14, imp.msg || `${imp.ship}, ${imp.mods} modules`);

// EVE XML re-import (formats module) -> new fit with the mutated web
if (xml) {
  await clickText('header button', 'Import / export');
  await p.evaluate((t) => { const ta = document.querySelector('textarea.eft'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(ta, t); ta.dispatchEvent(new Event('input', { bubbles: true })); }, xml);
  await clickText('.dialog button', 'Import');
  await new Promise((r) => setTimeout(r, 1500));
  const xi = await p.evaluate(() => ({ open: !!document.querySelector('.dialog'), msg: document.querySelector('.dialog p.muted')?.textContent ?? '', ship: window.__lastStats?.ship?.name, mods: window.__lastStats?.modules?.length, abyssal: document.body.textContent.includes('Abyssal Stasis Webifier') }));
  check('web.e2e.xml-reimport: EVE XML re-import keeps the mutated module', !xi.open && xi.ship === 'Vexor' && xi.mods === 15 && xi.abyssal, xi.msg || `${xi.ship}, ${xi.mods} modules`);
} else check('web.e2e.xml-reimport: EVE XML re-import keeps the mutated module', false, 'no XML export');

// multi-fit EFT paste + fit browser grouping
await clickText('header button', 'Import / export');
await p.evaluate((t) => { const ta = document.querySelector('textarea.eft'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(ta, t); ta.dispatchEvent(new Event('input', { bubbles: true })); }, '[Rifter, Multi A]\n200mm AutoCannon II\n\n[Merlin, Multi B]\nLight Neutron Blaster II\n');
await clickText('.dialog button', 'Import');
await new Promise((r) => setTimeout(r, 800));
await clickText('.left .tabs button', 'Fits');
const fb = await p.evaluate(() => ({ groups: [...document.querySelectorAll('.fitbrowser summary')].map((x) => x.textContent), names: [...document.querySelectorAll('.fitbrowser li')].map((x) => x.textContent) }));
check('web.e2e.multi-fit-eft-import: multi-fit EFT import + fit browser groups', fb.names.some((n) => n.includes('Multi A')) && fb.names.some((n) => n.includes('Multi B')) && fb.groups.some((g) => g.startsWith('Frigate')), fb.groups.join(', '));
await p.type('.fitbrowser .search', 'Merlin');
const fbn = await p.evaluate(() => document.querySelectorAll('.fitbrowser li').length);
check('web.e2e.fit-browser-search: fit browser search', fbn === 1, fbn);

// market prices (public ESI, opt-in); skipped when offline
await clickText('.right button', 'Load market prices');
const price = await p.waitForFunction(() => document.querySelector('.pricetotal')?.textContent || document.querySelector('.right .error')?.textContent, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => 'timeout');
check('web.e2e.fit-price-esi: fit price from ESI', /ISK$/.test(price) || /ESI|fetch|timeout/i.test(price), price);

// fighters: abilities
await p.goto(`${url}${sep}engine=${engine}&eft=${encodeURIComponent(CARRIER)}`, { waitUntil: 'networkidle0', timeout: 120000 });
await p.waitForFunction(() => window.__lastStats?.ship?.name === 'Thanatos', { timeout: 120000 });
s = await stats();
const f0 = s.offense?.total?.fighter_dps ?? s.offense?.total?.drone_dps;
check('web.e2e.fighter-dps: fighter dps', f0 > 0, f0);
const ab = await p.evaluate(() => [...document.querySelectorAll('.subopts label')].filter((l) => l.querySelector('input.ability')).map((l) => l.textContent.trim() + (l.querySelector('input').checked ? '*' : '')));
check('web.e2e.fighter-abilities: fighter abilities listed', ab.length >= 4, ab.join(', '));
await p.evaluate(() => { const l = [...document.querySelectorAll('.subopts label')].find((x) => x.querySelector('input.ability')?.checked && x.textContent.includes('Attack')); l.querySelector('input').click(); });
s = await waitNew(s);
const f1 = s.offense?.total?.fighter_dps ?? s.offense?.total?.drone_dps;
check('web.e2e.fighter-ability-toggle: disabling an attack ability lowers fighter dps', f1 < f0, `${f0} -> ${f1}`);
// About / engine page
await clickText('.left .tabs button', 'About');
const ab2 = await p.evaluate(() => ({ be: document.querySelector('.about-backend')?.textContent, eng: document.querySelector('.about-engine')?.textContent ?? '',
  data: document.querySelector('.about-dataset')?.textContent ?? '', links: document.querySelectorAll('.about a').length }));
const abG = await p.evaluate(() => document.querySelector('.about-graphs')?.textContent ?? '');
check('web.e2e.about-graph-engine: about page: graph engine', GRAPH_RPC ? abG.startsWith(engine === 'wasm-j-worker' ? 'wasm-worker' : engine) : abG.startsWith('UI approximation'), abG);
check('web.e2e.about-page: about page: backend, engine, dataset, links', ab2.be === engine && ab2.eng.length > 3 && !ab2.eng.startsWith('—') && ab2.data.includes('3569502') && ab2.links >= 8, JSON.stringify(ab2));
check('web.e2e.no-page-errors: no page errors', errors.length === 0, errors.join(' | '));

await b.close();
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail !== '' ? '  — ' + r.detail : ''}`);
const fails = results.filter((r) => !r.ok).length;
console.log(`${results.length - fails}/${results.length} passed (${engine})`);
process.exit(fails ? 1 : 0);
