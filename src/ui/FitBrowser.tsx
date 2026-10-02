import { useState } from 'react';
import type { Dataset } from '../data/dataset';
import type { Fit, Library } from '../fit/model';

/** Saved fits grouped by ship group (like Pyfa's fit browser), with search and a JSON backup / restore of the library. */
export function FitBrowser({ ds, lib, activeId, onOpen, onDuplicate, onDelete, onRestore }: {
  ds: Dataset; lib: Library; activeId: string | null;
  onOpen: (id: string) => void; onDuplicate: (f: Fit) => void; onDelete: (id: string) => void; onRestore: (l: Library) => void;
}) {
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const ql = q.trim().toLowerCase();
  const fits = Object.values(lib.fits).filter((f) => !ql || f.name.toLowerCase().includes(ql) || ds.name(f.ship_type_id).toLowerCase().includes(ql) || ds.name(f.ship_type_id, 'en').toLowerCase().includes(ql));
  const groups = new Map<string, Fit[]>();
  for (const f of fits) {
    const g = ds.groupName(ds.type(f.ship_type_id)?.group ?? 0) || 'Other';
    groups.set(g, [...(groups.get(g) ?? []), f]);
  }
  const backup = () => {
    const blob = new Blob([JSON.stringify({ format: 'eve-fit-web-library', version: 1, lib }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `eve-fit-web-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const restore = (file: File) => file.text().then((t) => {
    const j = JSON.parse(t);
    if (j?.format !== 'eve-fit-web-library' || !j.lib?.fits) throw new Error('not an eve-fit-web backup');
    onRestore(j.lib as Library);
    setMsg(`restored ${Object.keys(j.lib.fits).length} fits`);
  }).catch((e) => setMsg(e.message));
  return (
    <div className="fitbrowser">
      <input className="search" placeholder="search fits / ships…" value={q} onChange={(e) => setQ(e.target.value)} />
      {[...groups].sort((a, b) => a[0].localeCompare(b[0])).map(([g, fs]) => (
        <details key={g} open>
          <summary>{g} <span className="muted">({fs.length})</span></summary>
          <ul className="fits">
            {fs.sort((a, b) => ds.name(a.ship_type_id).localeCompare(ds.name(b.ship_type_id)) || a.name.localeCompare(b.name)).map((f) => (
              <li key={f.id} className={f.id === activeId ? 'on' : ''} onClick={() => onOpen(f.id)}>
                <b>{ds.name(f.ship_type_id)}</b> {f.name}
                <span className="right">
                  <button className="mini" title="Duplicate" onClick={(e) => { e.stopPropagation(); onDuplicate(f); }}>⧉</button>
                  <button className="mini" title="Delete" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete fit "${f.name}"?`)) onDelete(f.id); }}>✕</button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ))}
      {fits.length === 0 && <p className="muted">{ql ? 'No fit matches.' : 'Pick a ship in the Market tab to start a new fit.'}</p>}
      <div className="row">
        <button onClick={backup} title="Download all fits, characters and profiles as JSON">Backup library</button>
        <label className="button">Restore… <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} /></label>
      </div>
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
