import { useState } from 'react';
import { t } from '../i18n';
import type { Dataset } from '../data/dataset';
import type { Fit } from '../fit/model';
import type { FitStats } from '../engine/adapter';
import { detectAndParse, exportDna, exportEft, exportEsi, exportMultibuy } from '../fit/formats';

export function ImportExport({ ds, fit, stats, onImport, onClose }: { ds: Dataset; fit: Fit | null; stats: FitStats | null; onImport: (f: Fit) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const totals = Object.fromEntries(Object.entries(stats?.resources?.slots ?? {}).map(([k, v]: any) => [k, v.total]));
  const doImport = () => {
    try {
      // several EFT fits pasted at once (e.g. a Pyfa multi-export): split on "[Ship, Name]" headers
      const lines = text.replace(/\r/g, '').split('\n');
      const heads = lines.map((l, i) => (/^\[[^\],]+,[^\]]*\]\s*$/.test(l.trim()) ? i : -1)).filter((i) => i >= 0);
      const chunks = heads.length > 1 ? heads.map((h, k) => lines.slice(h, heads[k + 1] ?? lines.length).join('\n')) : [text];
      const warns: string[] = [];
      for (const c of chunks) { const r = detectAndParse(ds, c); warns.push(...r.warnings); onImport(r.fit); }
      setMsg(`Imported ${chunks.length} fit(s)${warns.length ? ` with ${warns.length} warning(s): ${warns.join('; ')}` : ''}`);
    } catch (e) { setMsg((e as Error).message); }
  };
  const copy = (s: string) => { setText(s); navigator.clipboard?.writeText(s).then(() => setMsg('copied to clipboard'), () => setMsg('select and copy the text above')); };
  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{t('Import / export')}</h2>
        <textarea className="eft" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Paste an EFT fit ([Ship, Name] …) a DNA string (587:2873;3::) or ESI fitting JSON and press Import.'} />
        <div className="row">
          <button onClick={doImport} disabled={!text.trim()}>{t('Import (EFT / DNA / ESI JSON)')}</button>
          <button disabled={!fit} onClick={() => fit && copy(exportEft(ds, fit, totals))}>{t('Export EFT')}</button>
          <button disabled={!fit} onClick={() => fit && copy(exportDna(fit))}>{t('Export DNA')}</button>
          <button disabled={!fit} onClick={() => fit && copy(exportEsi(ds, fit))}>{t('Export ESI JSON')}</button>
          <button disabled={!fit} onClick={() => fit && copy(exportMultibuy(ds, fit))}>{t('Export multibuy')}</button>
          <button disabled={!fit} onClick={() => fit && copy(`${location.origin}${location.pathname}?dna=${encodeURIComponent(exportDna(fit))}`)}>{t('Share link')}</button>
          <button onClick={onClose}>{t('Close')}</button>
        </div>
        {msg && <p className="muted">{msg}</p>}
      </div>
    </div>
  );
}
