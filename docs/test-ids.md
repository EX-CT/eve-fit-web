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
