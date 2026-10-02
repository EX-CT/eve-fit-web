import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dataset } from './data/dataset';
import { createEngine, type Engine, type FitStats } from './engine/adapter';
import { defaultState, parseDna, parseEft } from './fit/formats';
import { newFit, toRequest, uid, type Fit, type Library } from './fit/model';
import { useAppState } from './store';
import { CharacterEditor } from './ui/Character';
import { EngineSettings } from './ui/EngineSettings';
import { Fitting } from './ui/Fitting';
import { Graphs } from './ui/Graphs';
import { ImportExport } from './ui/ImportExport';
import { ItemInfo, Market } from './ui/Market';
import { Profiles } from './ui/Profiles';
import { Stats } from './ui/Stats';
import { Tabs } from './ui/common';

const DEMO_EFT = `[Rifter, Demo Rifter]
Gyrostabilizer II
Damage Control II
Small Ancillary Armor Repairer, Nanite Repair Paste

5MN Microwarpdrive II
Warp Scrambler II
Stasis Webifier II

200mm AutoCannon II, Republic Fleet EMP S
200mm AutoCannon II, Republic Fleet EMP S
200mm AutoCannon II, Republic Fleet EMP S
[Empty High slot]

Small Projectile Burst Aerator I
Small Projectile Collision Accelerator I
Small Projectile Burst Aerator I

Warrior II x1
`;

export default function App() {
  const [state, update] = useAppState();
  const [ds, setDs] = useState<Dataset | null>(null);
  const [loadMsg, setLoadMsg] = useState('loading…');
  const [engineStatus, setEngineStatus] = useState('starting engine…');
  const engineRef = useRef<Engine | null>(null);
  const [engineReady, setEngineReady] = useState(0);
  const [stats, setStats] = useState<FitStats | null>(null);
  const [calcErr, setCalcErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ms, setMs] = useState<number | null>(null);
  const [left, setLeft] = useState<'market' | 'fits' | 'char' | 'profiles'>('market');
  const [center, setCenter] = useState<'fit' | 'graphs'>('fit');
  const [info, setInfo] = useState<number | null>(null);
  const [showIO, setShowIO] = useState(false);
  const [addProjected, setAddProjected] = useState(false);
  const { lib, settings } = state;
  const fit = settings.activeFitId ? lib.fits[settings.activeFitId] ?? null : null;

  // dataset (UI copy) from the pipeline release, deployed with the site
  useEffect(() => {
    Dataset.load(settings.engine.datasetUrl, setLoadMsg).then((d) => { d.lang = settings.lang; setDs(d); }, (e) => setLoadMsg(`failed to load dataset: ${e.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // engine backend (swappable at runtime)
  const ecfg = settings.engine;
  useEffect(() => {
    const eng = createEngine(ecfg);
    engineRef.current = eng;
    setEngineStatus(`starting ${eng.info.id}…`);
    let alive = true;
    eng.init().then((s) => { if (alive) { setEngineStatus(`✔ ${s}`); setEngineReady((n) => n + 1); } }, (e) => alive && setEngineStatus(`✖ ${eng.info.id}: ${e.message}`));
    return () => { alive = false; eng.dispose(); };
  }, [ecfg.backend, ecfg.httpUrl, ecfg.datasetUrl, ecfg.engineUrl, ecfg.wasmUrl]);

  const setLib = useCallback((l: Library) => update((s) => ({ ...s, lib: l })), [update]);
  const setFit = useCallback((f: Fit) => update((s) => ({ ...s, lib: { ...s.lib, fits: { ...s.lib.fits, [f.id]: f } } })), [update]);
  const addFit = useCallback((f: Fit) => update((s) => ({ ...s, lib: { ...s.lib, fits: { ...s.lib.fits, [f.id]: f } }, settings: { ...s.settings, activeFitId: f.id } })), [update]);

  // first visit / ?dna= / ?eft= : seed a fit so the page computes something right away
  useEffect(() => {
    if (!ds) return;
    const q = new URLSearchParams(location.search);
    try {
      if (q.get('dna')) { addFit(parseDna(ds, q.get('dna')!).fit); return; }
      if (q.get('eft')) { addFit(parseEft(ds, q.get('eft')!).fit); return; }
    } catch (e) { console.warn(e); }
    if (!Object.keys(lib.fits).length) addFit(parseEft(ds, DEMO_EFT).fit);
    else if (!fit) update((s) => ({ ...s, settings: { ...s.settings, activeFitId: Object.keys(s.lib.fits)[0] } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds]);

  const request = useMemo(() => (fit ? toRequest(fit, lib) : null), [fit, lib]);
  const reqJson = useMemo(() => JSON.stringify(request), [request]);

  // stateless calc on every change (debounced, latest wins)
  const seq = useRef(0);
  useEffect(() => {
    if (!request || !engineReady || !engineRef.current) return;
    const my = ++seq.current;
    const t = setTimeout(() => {
      setBusy(true);
      const t0 = performance.now();
      engineRef.current!.calc(request).then((r) => {
        if (my !== seq.current) return;
        setStats(r); setCalcErr(null); setMs(performance.now() - t0); setBusy(false);
        (window as any).__lastStats = r;
      }, (e) => { if (my === seq.current) { setCalcErr(e.message); setBusy(false); } });
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqJson, engineReady]);

  const pick = (id: number) => {
    if (!ds) return;
    const k = ds.kind(id);
    if (k === 'ship' || k === 'structure') { addFit(newFit(id, `${ds.name(id, 'en')} fit`)); return; }
    if (!fit) return;
    if (ds.raw.environment?.effect_beacons?.[id]) { setFit({ ...fit, environment: [...new Set([...fit.environment, id])] }); return; }
    if (addProjected && (k === 'module' || k === 'drone' || k === 'fighter')) {
      setFit({ ...fit, projected: [...fit.projected, { kind: k, type_id: id, state: 'active', quantity: k === 'fighter' ? ds.attr(id, 'fighterSquadronMaxSize') ?? 1 : 1, amount: 1, distance_m: 5000 }] });
      return;
    }
    switch (k) {
      case 'module': case 'subsystem': {
        const slot = ds.slot(id);
        if (!slot) return;
        let modules = fit.modules;
        if (slot === 'subsystem') { const sub = ds.attr(id, 'subSystemSlot'); modules = modules.filter((m) => m.slot !== 'subsystem' || ds.attr(m.type_id, 'subSystemSlot') !== sub); }
        setFit({ ...fit, modules: [...modules, { type_id: id, slot, state: defaultState(ds, id), charge_type_id: null }] });
        return;
      }
      case 'charge': {
        const ok = fit.modules.map((m) => ds.chargesFor(m.type_id).includes(id));
        if (ok.some(Boolean)) setFit({ ...fit, modules: fit.modules.map((m, i) => (ok[i] ? { ...m, charge_type_id: id } : m)) });
        else setFit({ ...fit, cargo: [...fit.cargo, { type_id: id, quantity: 1 }] });
        return;
      }
      case 'drone': {
        const ex = fit.drones.findIndex((d) => d.type_id === id);
        if (ex >= 0) setFit({ ...fit, drones: fit.drones.map((d, i) => (i === ex ? { ...d, quantity: d.quantity + 1, active: d.active + 1 } : d)) });
        else setFit({ ...fit, drones: [...fit.drones, { type_id: id, quantity: 1, active: 1 }] });
        return;
      }
      case 'fighter': setFit({ ...fit, fighters: [...fit.fighters, { type_id: id, quantity: ds.attr(id, 'fighterSquadronMaxSize') ?? 1, active: true }] }); return;
      case 'implant': { const s = ds.attr(id, 'implantness'); setFit({ ...fit, implants: [...fit.implants.filter((x) => ds.attr(x, 'implantness') !== s), id] }); return; }
      case 'booster': { const s = ds.attr(id, 'boosterness'); setFit({ ...fit, boosters: [...fit.boosters.filter((x) => ds.attr(x.type_id, 'boosterness') !== s), { type_id: id }] }); return; }
      default: setInfo(id);
    }
  };

  if (!ds) return <div className="loading"><h1>EVE Fit Web</h1><p>{loadMsg}</p></div>;
  const setLang = (l: 'en' | 'zh') => { ds.lang = l; update((s) => ({ ...s, settings: { ...s.settings, lang: l } })); };
  ds.lang = settings.lang;
  return (
    <div className="app">
      <header>
        <h1>EVE Fit Web</h1>
        <span className="muted">SDE {ds.build}{ds.raw.dataset_revision ? ` r${ds.raw.dataset_revision}` : ''}</span>
        <EngineSettings cfg={settings.engine} status={engineStatus} onChange={(c) => update((s) => ({ ...s, settings: { ...s.settings, engine: c } }))} />
        <button onClick={() => setShowIO(true)}>Import / export</button>
        <select value={settings.lang} onChange={(e) => setLang(e.target.value as 'en' | 'zh')}><option value="en">English</option><option value="zh">中文</option></select>
      </header>
      <main>
        <aside className="left">
          <Tabs tabs={[['market', 'Market'], ['fits', `Fits (${Object.keys(lib.fits).length})`], ['char', 'Character'], ['profiles', 'Profiles']]} value={left} onChange={setLeft} />
          {left === 'market' && <Market ds={ds} onPick={pick} onInfo={setInfo} />}
          {left === 'fits' && (
            <ul className="fits">
              {Object.values(lib.fits).sort((a, b) => ds.name(a.ship_type_id).localeCompare(ds.name(b.ship_type_id))).map((f) => (
                <li key={f.id} className={f.id === fit?.id ? 'on' : ''} onClick={() => update((s) => ({ ...s, settings: { ...s.settings, activeFitId: f.id } }))}>
                  <b>{ds.name(f.ship_type_id)}</b> {f.name}
                  <span className="right">
                    <button className="mini" title="Duplicate" onClick={(e) => { e.stopPropagation(); addFit({ ...structuredClone(f), id: uid(), name: f.name + ' (copy)' }); }}>⧉</button>
                    <button className="mini" title="Delete" onClick={(e) => { e.stopPropagation(); const { [f.id]: _x, ...rest } = lib.fits; void _x; update((s) => ({ ...s, lib: { ...s.lib, fits: rest }, settings: { ...s.settings, activeFitId: s.settings.activeFitId === f.id ? null : s.settings.activeFitId } })); }}>✕</button>
                  </span>
                </li>
              ))}
              <li className="muted">Pick a ship in the Market tab to start a new fit.</li>
            </ul>
          )}
          {left === 'char' && <CharacterEditor ds={ds} lib={lib} fit={fit} onLib={setLib} />}
          {left === 'profiles' && <Profiles lib={lib} fit={fit} onLib={setLib} onFit={setFit} />}
        </aside>
        <section className="center">
          <Tabs tabs={[['fit', 'Fit'], ['graphs', 'Graphs']]} value={center} onChange={setCenter} />
          {!fit ? <p className="muted">No fit selected.</p> : center === 'fit'
            ? <Fitting ds={ds} fit={fit} lib={lib} stats={stats} onChange={setFit} onInfo={setInfo} addProjected={addProjected} setAddProjected={setAddProjected} />
            : <Graphs ds={ds} st={stats} target={lib.targetProfiles[fit.target_profile_id]} />}
        </section>
        <aside className="right"><Stats st={stats} busy={busy} ms={ms} error={calcErr} /></aside>
      </main>
      <footer className="muted">
        Engine via a swappable adapter (in-browser TS / WASM worker or HTTP). Data: <a href="https://github.com/EX-CT/eve-sde-pipeline/releases">EX-CT/eve-sde-pipeline</a> release.
        EVE Online data © CCP hf. · <a href="https://github.com/EX-CT/eve-fit-web">source</a>
      </footer>
      {info != null && <ItemInfo ds={ds} id={info} onClose={() => setInfo(null)} />}
      {showIO && <ImportExport ds={ds} fit={fit} stats={stats} onImport={(f) => { addFit(f); setShowIO(false); }} onClose={() => setShowIO(false)} />}
    </div>
  );
}
