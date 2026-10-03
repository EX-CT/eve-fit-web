# Test ids

Stable ids for the checks in `tools/e2e.mjs` (`web.e2e.<slug>`, kebab-case). A check prints as
`PASS  web.e2e.<slug>: <description>`; the description may change, the id does not. Map of id to the check name
used before the ids were added (2026-10-03):

| id | old name |
|---|---|
| `web.e2e.eft-share-link-import` | EFT import via ?eft=, ship |
| `web.e2e.drone-dps` | drones dps |
| `web.e2e.weapon-dps-charges` | weapon dps (charges) |
| `web.e2e.armor-tank` | armor tank |
| `web.e2e.mutated-module-import` | mutated module imported |
| `web.e2e.no-violations` | no violations |
| `web.e2e.zh-weapon-names` | zh weapon names |
| `web.e2e.en-weapon-names-restored` | en weapon names restored |
| `web.e2e.projected-web` | projected web slows the ship |
| `web.e2e.environment-beacon` | environment beacon applied |
| `web.e2e.graph-set` | graphs: engine-only graphs offered / graphs: approximation set only (by backend) |
| `web.e2e.graph-backend-label` | graph backend label |
| `web.e2e.graph-{dps,cap,regen,mobility,lock,warp,app,ewar,rr}` | graph <kind> (engine|approx) |
| `web.e2e.graph-lock-time-matches-stats` | engine lock-time graph matches stats |
| `web.e2e.graph-ewar-web-neut` | engine ewar graph has web + neut |
| `web.e2e.graph-cap-within-capacity` | engine capacitor graph within capacity |
| `web.e2e.booster-side-effect` | booster side effect lowers armor HP |
| `web.e2e.undo-redo` | undo / redo |
| `web.e2e.show-info-fitted-values` | show info: fitted attribute values |
| `web.e2e.attribute-override` | attribute override raises weapon dps |
| `web.e2e.attribute-override-removed` | removing the override restores dps |
| `web.e2e.manual-fleet-buff` | manual fleet buff raises shield resist (lower resonance) |
| `web.e2e.eft-export` | EFT export |
| `web.e2e.eft-export-mutated` | mutated module EFT round trip |
| `web.e2e.dna-export` | DNA export |
| `web.e2e.multibuy-export` | multibuy export |
| `web.e2e.esi-json-export` | ESI JSON export |
| `web.e2e.implant-set` | implant set applied (6 Snake + kept RP-905, faster) |
| `web.e2e.sde-npc-damage-profile` | SDE NPC damage profile (Guristas) changes EHP |
| `web.e2e.custom-character` | custom character (all 0) lowers dps |
| `web.e2e.missing-skills` | missing skills reported |
| `web.e2e.per-module-spool` | per-module spool 0% lowers disintegrator dps |
| `web.e2e.esi-json-reimport` | ESI JSON re-import |
| `web.e2e.multi-fit-eft-import` | multi-fit EFT import + fit browser groups |
| `web.e2e.fit-browser-search` | fit browser search |
| `web.e2e.fit-price-esi` | fit price from ESI |
| `web.e2e.fighter-dps` | fighter dps |
| `web.e2e.fighter-abilities` | fighter abilities listed |
| `web.e2e.fighter-ability-toggle` | disabling an attack ability lowers fighter dps |
| `web.e2e.about-graph-engine` | about page: graph engine |
| `web.e2e.about-page` | about page: backend, engine, dataset, links |
| `web.e2e.no-page-errors` | no page errors |

## e2e checks added after the rename (no old name)

| id | description |
|---|---|
| `web.e2e.compare-fits` | compare table of 3 fits with best values marked |
| `web.e2e.formats-provider` | imports / exports run through eve-fit-formats (WASM) |
| `web.e2e.graph-ecm-burst` | ECM burst graph (engine) matches the lock-time formula |
| `web.e2e.graph-ecm-damage` | ECM burst graph, damage dealt before dying |
| `web.e2e.graph-overlay` | dps graph overlays a second fit |
| `web.e2e.graph-target-fit` | damage graph against a target fit (engine) |
| `web.e2e.shipstats-export` | ship stats export (engine stats + formats module) |
| `web.e2e.whatif-apply` | applying a scenario changes the fit; undo restores it |
| `web.e2e.whatif-charges` | what-if ranks compatible charges |
| `web.e2e.whatif-undo` | undo after apply |
| `web.e2e.whatif-variations` | what-if lists module variations with engine dps (T1 below T2) |
| `web.e2e.xml-export` | EVE XML export |
| `web.e2e.xml-reimport` | EVE XML re-import keeps the mutated module |
| `web.e2e.zh-ui` | zh-CN UI (tabs, stats sections, slots, import/export dialog) has no untranslated labels |

## Unit tests (`npm test`, vitest)

Test names start with their id (`web.unit.<slug>: <description>`). In CI they run against the eve-fit-formats module
built from the engines.lock pin (`REQUIRE_FORMATS_WASM=1`: the WASM formats tests fail instead of skipping).

| id | file | description |
|---|---|---|
| `web.unit.backend-aliases` | `src/engine/defaults.test.ts` | the retired wasm-g4-worker maps to wasm-worker; unknown ids pass through |
| `web.unit.builtin-dna` | `src/formats/builtin.test.ts` | DNA import assigns charges to compatible modules, export round trip |
| `web.unit.builtin-eft-import` | `src/formats/builtin.test.ts` | slots, charges, /OFFLINE, drones, cargo, empty slots skipped |
| `web.unit.builtin-eft-mutation` | `src/formats/builtin.test.ts` | mutated block resolves to the abyssal type with rolled attributes |
| `web.unit.builtin-eft-roundtrip` | `src/formats/builtin.test.ts` | export -> import keeps every item |
| `web.unit.builtin-eft-unknown-item` | `src/formats/builtin.test.ts` | unknown names are warnings, not errors; unknown ship throws |
| `web.unit.builtin-esi` | `src/formats/builtin.test.ts` | ESI fitting JSON round trip (slots from flags, drone bay) |
| `web.unit.builtin-limits` | `src/formats/builtin.test.ts` | Pyfa-only formats need the eve-fit-formats module |
| `web.unit.builtin-multi-eft` | `src/formats/builtin.test.ts` | a Pyfa multi-export splits into one fit per header |
| `web.unit.compare-best-delta` | `src/fit/metrics.test.ts` | best per direction (high dps, low align) and deltas vs the first fit |
| `web.unit.compare-ties-missing` | `src/fit/metrics.test.ts` | equal values mark no best; all-zero rows dropped; errored stats are missing |
| `web.unit.formats-wasm-active` | `src/formats/wasm.test.ts` | the formats layer uses the WASM module once loaded |
| `web.unit.formats-wasm-dna-esi` | `src/formats/wasm.test.ts` | DNA and ESI JSON exports |
| `web.unit.formats-wasm-eft-export` | `src/formats/wasm.test.ts` | Pyfa EFT export of the structured request, round trip |
| `web.unit.formats-wasm-eft-import` | `src/formats/wasm.test.ts` | lenient EFT import (unknown items skipped), mutation, drones launched |
| `web.unit.formats-wasm-errors` | `src/formats/wasm.test.ts` | unrecognised text and item lists are readable errors |
| `web.unit.formats-wasm-multi-eft` | `src/formats/wasm.test.ts` | several pasted EFT fits import as several fits |
| `web.unit.formats-wasm-shipstats-needs-stats` | `src/formats/wasm.test.ts` | shipstats without engine stats is an error; request has no spool |
| `web.unit.formats-wasm-xml-roundtrip` | `src/formats/wasm.test.ts` | EVE XML export and re-import keep the mutated module |
| `web.unit.graph-cap-stable` | `src/fit/graphs.test.ts` | a fit with no cap use stays full |
| `web.unit.graph-fallback` | `src/engine/defaults.test.ts` | only J borrows F graphs |
| `web.unit.graph-lock-time` | `src/fit/graphs.test.ts` | 40000 / scanRes / asinh(sig)^2, capped at 1800 s |
| `web.unit.graph-turret-chance` | `src/fit/graphs.test.ts` | hit chance 1 in optimal, 0.5 at optimal + falloff, lower with tracking |
| `web.unit.i18n-coverage` | `src/i18n.test.ts` | every t()/tr() literal and every dynamic label key has a zh-CN translation |
| `web.unit.i18n-jsx-literals` | `src/i18n.test.ts` | no untranslated English text nodes or placeholder/title attributes in the UI |
| `web.unit.i18n-switch` | `src/i18n.test.ts` | t() returns Chinese only in zh mode and falls back to the key |
| `web.unit.metric-lock-range-km` | `src/fit/metrics.test.ts` | lock range is reported in km |
| `web.unit.request-missing-projected-fit` | `src/fit/model.test.ts` | a projected fit deleted from the library is dropped |
| `web.unit.request-nested-fits` | `src/fit/model.test.ts` | projected and fleet booster fits nest one level deep only |
| `web.unit.request-shape` | `src/fit/model.test.ts` | a UI fit becomes a contract FitRequest (schema 1, all-5 skills, uniform profile = null) |
| `web.unit.whatif-charges` | `src/fit/whatif.test.ts` | a charge scenario loads every module of that type |
| `web.unit.whatif-offline-remove` | `src/fit/whatif.test.ts` | offline and remove edits, out-of-range indices ignored |
| `web.unit.whatif-variations` | `src/fit/whatif.test.ts` | meta variations of a module, the fitted type excluded, charge kept |
