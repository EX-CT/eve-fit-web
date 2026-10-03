// About / engine page: which engine computes the numbers, exact versions of engines, dataset and site, and repo links.
import type { Dataset } from '../data/dataset';
import { BACKENDS, type EngineConfig, type FitStats } from '../engine/adapter';
import { DEFAULT_BACKEND } from '../engine/defaults';
import { t } from '../i18n';

export interface BuildInfo { dataset_tag?: string; engine_d?: string; engine_f?: string; engine_g4?: string; web?: string; built_at?: string; run?: string; default_engine?: string }

const GH = 'https://github.com/EX-CT';
const commit = (repo: string, sha?: string) => (sha ? <a href={`${GH}/${repo}/commit/${sha}`}><code>{sha}</code></a> : <span className="muted">n/a</span>);
const local = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { hour12: false, timeZoneName: 'short' }) : '—');

export function About({ cfg, status, st, ds, build }: { cfg: EngineConfig; status: string; st: FitStats | null; ds: Dataset; build: BuildInfo | null }) {
  const be = BACKENDS.find((b) => b.id === cfg.backend);
  const raw: any = ds.raw;
  const rows: [string, React.ReactNode][] = [
    [t('Engine backend'), <><code className="about-backend">{cfg.backend}</code> {be?.label}{cfg.backend === 'http' ? <> · <code>{cfg.httpUrl}</code></> : null}</>],
    [t('Engine status'), <span className="about-status">{status}</span>],
    [t('Engine (reported)'), <span className="about-engine">{st?.meta?.engine ?? '—'}{st?.meta?.sde_build ? ` · SDE ${st.meta.sde_build}` : ''}</span>],
    [t('Default backend'), <code>{build?.default_engine || DEFAULT_BACKEND}</code>],
    ['Engine D (TypeScript)', <>{commit('eve-dogma-lab', build?.engine_d)} · <a href={`${GH}/eve-dogma-lab/tree/variant-d`}>variant-d</a></>],
    ['Engine F (Rust → WASM)', <>{commit('eve-dogma-lab', build?.engine_f)} · <a href={`${GH}/eve-dogma-lab/tree/variant-f`}>variant-f</a></>],
    ['Engine F + graphs (round-2 prototype)', <>{commit('eve-dogma-lab', build?.engine_g4)} · <a href={`${GH}/eve-dogma-lab/tree/graphs-g4`}>graphs-g4</a></>],
    [t('Dataset'), <span className="about-dataset">SDE {raw.sde?.build} ({raw.sde?.release_date?.slice(0, 10)}) · r{raw.dataset_revision ?? 1} · {raw.generator}
      {build?.dataset_tag ? <> · <a href={`${GH}/eve-sde-pipeline/releases/tag/${build.dataset_tag}`}>{build.dataset_tag}</a></> : null}</span>],
    [t('Site build'), <>{commit('eve-fit-web', build?.web)} · {local(build?.built_at)}{build?.run ? <> · <a href={build.run}>CI run</a></> : null}</>],
  ];
  return (
    <div className="about">
      <h4>{t('About this site')}</h4>
      <table className="grid small"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
      <h4>{t('Repositories')}</h4>
      <ul className="about-links">
        <li><a href={`${GH}/eve-fit-web`}>eve-fit-web</a> — {t('this web UI')}</li>
        <li><a href={`${GH}/eve-dogma-rs`}>eve-dogma-rs</a> — {t('reference engine (Rust)')}</li>
        <li><a href={`${GH}/eve-dogma-lab`}>eve-dogma-lab</a> — {t('engine variants')}</li>
        <li><a href={`${GH}/eve-dogma-bench`}>eve-dogma-bench</a> — {t('correctness / speed bench vs Pyfa')}</li>
        <li><a href={`${GH}/eve-sde-pipeline`}>eve-sde-pipeline</a> — {t('SDE dataset and presets')}</li>
        <li><a href={`${GH}/eve-fit-mcp`}>eve-fit-mcp</a> — {t('MCP server for AI agents')}</li>
        <li><a href={`${GH}/eve-fit-docs`}>eve-fit-docs</a> — {t('design docs and licensing')}</li>
      </ul>
      <p className="muted small">EVE Online data © CCP hf. Engines: LGPL-3.0-or-later; this site: MIT. <a href={`${GH}/eve-fit-docs/blob/main/LICENSING.md`}>LICENSING.md</a></p>
    </div>
  );
}
