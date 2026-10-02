# EVE Fit Web

A modern web fitting tool for EVE Online (Vite + React + TypeScript) that aims to reproduce Pyfa's UI features.
It is built on the stateless EXCT engine contract (`calc(FitRequest) -> FitStats`, see
[eve-fit-docs/05-api-schema](https://github.com/EX-CT/eve-fit-docs/blob/main/docs/05-api-schema.md)).

**Live:** https://ex-ct.github.io/eve-fit-web/

中文：基于无状态引擎契约的 EVE 配船网页（复现 Pyfa 界面功能）。引擎通过可切换的适配层调用，可在浏览器内运行（TypeScript / WASM），也可调用本地 HTTP 引擎。数据来自 eve-sde-pipeline 的 Release。界面支持中文（物品名来自数据集，主要界面文字已翻译）。

## Features
- **Market browser and search.** Browse the market-group tree from the dataset. Search names in English or Chinese, with kind filters. "Show info" lists attributes, ship bonus text (traits) and required skills; opened on a fitted module, drone or the ship it adds the engine-computed fitted values (changed values highlighted).
- **Fitting window.**
  - High/mid/low/rig/subsystem/service slots, using totals from the engine and showing empty slots.
  - Module states: offline, online, active, overheated (click for the next state, right-click for the previous).
  - Charges and ammo, filtered by charge group, size and capacity.
  - Mutaplasmids: choose one and set each rolled attribute with a slider.
  - Drones (quantity and number active), fighters (squadron size, launched or not, per-ability toggles with Pyfa's defaults), implants and boosters (each slot holds one; booster side effects can be switched on one at a time), cargo.
  - Per-module spool-up for Triglavian weapons and mutadaptive repairers (overrides the fit default).
  - T3D modes, fit notes.
  - Undo / redo per fit (buttons, Ctrl+Z / Ctrl+Y).
- **Character and skills.** Built-in All 5, All 4 and All 0 characters, plus custom characters with a default level and per-skill levels. Shows which skills the fit requires and which are missing, with a "train required" button. Pilot security status.
- **Damage patterns and target profiles.** Built-in presets, including NPC factions, plus custom ones. Damage patterns feed EHP and RAH adaptation; target profiles feed DPS vs target and the graphs.
- **Projected, fleet and environment.**
  - Projected modules, drones and fighters, each with an amount and a distance.
  - Projected saved fits.
  - Fleet booster fits (command bursts) and manual warfare buffs (any buff ID with a value).
  - System effects and beacons (wormhole, abyssal, Triglavian, incursion, faction warfare, metaliminal storms), and system security.
- **Full stats panel:**
  - resources (CPU, powergrid, calibration, drone bandwidth and bay, fighter bay and tubes, cargo, hardpoints)
  - offense: DPS and volley per damage type and per weapon, vs target
  - defense: HP, resists, EHP, raw/effective/sustained tank
  - capacitor: stability, delta, injectors
  - navigation, targeting (lock times, jam chance), drones
  - violations and engine warnings
- **Graphs:** DPS vs range (turret hit chance, missile application, drones), capacitor vs time, regen vs fill %, speed and distance vs time, lock time vs signature, warp time vs distance.
- **Import and export:** EFT text (including Pyfa-style mutated module blocks `[N] Base` / mutaplasmid / attribute values), DNA, ESI fitting JSON (import and export), multibuy list (export), and share links (`?dna=`, `?eft=`).
- **Fit browser:** saved fits grouped by ship group, search, duplicate/delete, JSON backup and restore of the whole library (fits, characters, profiles). Pasting several EFT fits at once imports them all.
- **Language:** English / 中文 switch for item names (dataset `names_i18n`) and the main UI labels.
- **Options:** factor in reload, default spool-up, RAH adapt/unadapted. Fits, characters and profiles are stored in localStorage.

## Engine adapter (`src/engine/adapter.ts`)
| backend | where it runs | notes |
|---|---|---|
| `ts-worker` | browser (Web Worker) | variant D TypeScript bundle, built in CI from `EX-CT/eve-dogma-lab@variant-d`. It loads the same release dataset |
| `wasm-worker` | browser (Web Worker) | variant F Rust→WASM (C-ABI `calc`), built in CI with the release dataset compiled in |
| `http` | any engine server | `POST {url}/v1/calc`, `GET {url}/v1/meta`; e.g. variant C `serve-http`, through `tools/engine-bridge.mjs` for CORS |

Pick a backend in the header, or with `?engine=ts-worker|wasm-worker|http&http=http://127.0.0.1:8787`.
Adding another engine means writing one class that implements `Engine` (`init`, `calc`). The UI code does not change.

Local HTTP engine for the hosted site:
```bash
node tools/engine-bridge.mjs --upstream http://127.0.0.1:8080                 # variant C: eve-dogma-go serve-http -addr :8080
node tools/engine-bridge.mjs --stdio "eve-dogma --dataset D.json.gz serve-stdio"   # any engine with the JSONL RPC
# then open https://ex-ct.github.io/eve-fit-web/?engine=http&http=http://127.0.0.1:8787
```

## Development
```bash
npm ci
mkdir -p public/data public/engines/d public/engines/f
gh release download -R EX-CT/eve-sde-pipeline -p 'dataset-*.json.gz' -O public/data/dataset.json.gz
# engine D: (in eve-dogma-lab@variant-d/variant-d) npm ci && npm run build:web; copy dist-web/eve-dogma-ts.mjs to public/engines/d/
npm run dev
node tools/smoke.mjs http://127.0.0.1:5173/eve-fit-web/ ts-worker   # headless check
node tools/e2e.mjs http://127.0.0.1:5173/eve-fit-web/ ts-worker     # UI end-to-end (33 checks); engine arg may be 'http&http=http://127.0.0.1:8787'
```

## Deployment
`.github/workflows/pages.yml` runs on push, by hand, and every 6 h:
1. Download the latest `eve-sde-pipeline` release dataset.
2. Build engine D and engine F (WASM).
3. Build the site and run a headless Chrome smoke test (the demo fit must compute), then the UI end-to-end test (`tools/e2e.mjs`: EFT import, projected web, beacon, graphs, booster side effect, fleet buff, EFT/DNA export, custom character, fighter abilities) on the TS and WASM backends.
4. Deploy to GitHub Pages.

## Licence
- UI code: MIT.
- The bundled engines are LGPL-3.0-or-later (EX-CT/eve-dogma-lab, variants D and F). They are loaded as separate files (`engines/`), with their source on GitHub.
- EVE Online data © CCP hf., used under CCP's developer licence (`data/LICENSE.EVE`).
- No Pyfa code is used. Graph formulas come from public EVE mechanics documentation.
