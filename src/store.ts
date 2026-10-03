// Client-side persistence (localStorage): fits, characters, profiles, settings. The engine itself is stateless.
import { useCallback, useEffect, useState } from 'react';
import { BUILTIN_CHARACTERS, BUILTIN_DAMAGE, BUILTIN_TARGETS } from './data/presets';
import type { Library } from './fit/model';
import type { EngineConfig } from './engine/adapter';
import { DEFAULT_BACKEND } from './engine/defaults';

const KEY = 'eve-fit-web:v1';

export interface Settings { engine: EngineConfig; lang: 'en' | 'zh'; activeFitId: string | null }
export interface AppState { lib: Library; settings: Settings }

const base = import.meta.env.BASE_URL;

export function defaultEngineConfig(): EngineConfig {
  const q = new URLSearchParams(location.search);
  return {
    backend: q.get('engine') ?? DEFAULT_BACKEND,
    httpUrl: q.get('http') ?? 'http://127.0.0.1:8080',
    datasetUrl: new URL(`${base}data/dataset.json.gz`, location.href).href,
    engineUrl: new URL(`${base}engines/d/eve-dogma-ts.mjs`, location.href).href,
    wasmUrl: new URL(`${base}engines/f/eve_dogma_f.wasm`, location.href).href,
  };
}

/** A saved backend that equals the default of the build that saved it was never chosen by the user: follow the current default. */
function savedBackend(e: { backend?: string; default_at_save?: string } | undefined): string {
  if (!e?.backend) return DEFAULT_BACKEND;
  return e.backend === (e.default_at_save ?? 'ts-worker') ? DEFAULT_BACKEND : e.backend;
}

function initial(): AppState {
  const lib: Library = { fits: {}, characters: {}, damagePatterns: {}, targetProfiles: {} };
  let settings: Settings = { engine: defaultEngineConfig(), lang: 'en', activeFitId: null };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved) {
      Object.assign(lib, saved.lib ?? {});
      settings = { ...settings, ...saved.settings, engine: { ...defaultEngineConfig(), backend: savedBackend(saved.settings?.engine), httpUrl: saved.settings?.engine?.httpUrl ?? settings.engine.httpUrl } };
      const q = new URLSearchParams(location.search);
      if (q.get('engine')) settings.engine.backend = q.get('engine')!;
      if (q.get('http')) settings.engine.httpUrl = q.get('http')!;
    }
  } catch { /* ignore corrupt storage */ }
  for (const c of BUILTIN_CHARACTERS) lib.characters[c.id] = c;
  for (const d of BUILTIN_DAMAGE) lib.damagePatterns[d.id] = d;
  for (const t of BUILTIN_TARGETS) lib.targetProfiles[t.id] = t;
  return { lib, settings };
}

export function useAppState() {
  const [state, setState] = useState<AppState>(initial);
  useEffect(() => {
    const t = setTimeout(() => {
      const strip = <T extends { builtin?: boolean }>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([, v]) => !v.builtin));
      localStorage.setItem(KEY, JSON.stringify({
        lib: { fits: state.lib.fits, characters: strip(state.lib.characters), damagePatterns: strip(state.lib.damagePatterns), targetProfiles: strip(state.lib.targetProfiles) },
        settings: { ...state.settings, engine: { backend: state.settings.engine.backend, default_at_save: DEFAULT_BACKEND, httpUrl: state.settings.engine.httpUrl } },
      }));
    }, 300);
    return () => clearTimeout(t);
  }, [state]);
  const update = useCallback((f: (s: AppState) => AppState) => setState((s) => f(s)), []);
  return [state, update] as const;
}
