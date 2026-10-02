import { useState } from 'react';
import type { Dataset } from '../data/dataset';
import type { Fit } from '../fit/model';
import type { FitStats } from '../engine/adapter';
import { detectAndParse, exportDna, exportEft } from '../fit/formats';

export function ImportExport({ ds, fit, stats, onImport, onClose }: { ds: Dataset; fit: Fit | null; stats: FitStats | null; onImport: (f: Fit) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const totals = Object.fromEntries(Object.entries(stats?.resources?.slots ?? {}).map(([k, v]: any) => [k, v.total]));
  const doImport = () => {
    try {
      const r = detectAndParse(ds, text);
      onImport(r.fit);
      setMsg(`Imported ${r.fit.name}${r.warnings.length ? ` with ${r.warnings.length} warning(s): ${r.warnings.join('; ')}` : ''}`);
    } catch (e) { setMsg((e as Error).message); }
  };
  const copy = (s: string) => { setText(s); navigator.clipboard?.writeText(s).then(() => setMsg('copied to clipboard'), () => setMsg('select and copy the text above')); };
  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Import / export</h2>
        <textarea className="eft" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Paste an EFT fit ([Ship, Name] …) or a DNA string (587:2873;3::) and press Import.'} />
        <div className="row">
          <button onClick={doImport} disabled={!text.trim()}>Import (EFT / DNA)</button>
          <button disabled={!fit} onClick={() => fit && copy(exportEft(ds, fit, totals))}>Export EFT</button>
          <button disabled={!fit} onClick={() => fit && copy(exportDna(fit))}>Export DNA</button>
          <button disabled={!fit} onClick={() => fit && copy(`${location.origin}${location.pathname}?dna=${encodeURIComponent(exportDna(fit))}`)}>Share link</button>
          <button onClick={onClose}>Close</button>
        </div>
        {msg && <p className="muted">{msg}</p>}
      </div>
    </div>
  );
}
