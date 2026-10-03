// Entry point of the formats layer for the UI: every import (share links ?eft= / ?dna=, the import dialog, files)
// is text -> FitFormats.parse -> StructuredFit -> UI Fit, and every export is UI Fit -> FitRequest -> FitFormats.export
// -> text. The engines only ever receive structured FitRequests. The active implementation is the eve-fit-formats
// WASM module (EX-CT/eve-dogma, built from the engines.lock pin of engine F); the built-in TypeScript parsers are the
// fallback when that module is not available (and are what the unit tests exercise without a Rust build).
import type { Dataset, Slot } from '../data/dataset';
import { newFit, toRequest, type Fit, type Library } from '../fit/model';
import { builtinFormats } from './builtin';
import { loadFormatsRpc, wasmFormats, type RpcFn } from './wasm';
import type { ExportFormat, ExportOptions, FitFormats, ImportFormat, StructuredFit } from './types';
import { shipstatsRequest } from './types';

export type { ExportFormat, FitFormats, ImportFormat, StructuredFit } from './types';
export { shipstatsRequest } from './types';

let rpc: RpcFn | null = null;
let status: { provider: string; label: string; note?: string } = { provider: 'builtin-ts', label: 'built-in TypeScript parsers' };
const cache = new WeakMap<Dataset, FitFormats>();

/** Load the eve-fit-formats module (once). On failure the built-in parsers stay active and `formatsStatus().note` says why. */
export async function initFormats(url: string | ArrayBuffer | Uint8Array | null): Promise<typeof status> {
  if (!url) { status = { provider: 'builtin-ts', label: 'built-in TypeScript parsers', note: 'no eve-fit-formats module configured' }; return status; }
  try {
    rpc = await loadFormatsRpc(url);
    status = { provider: 'eve-fit-formats', label: 'eve-fit-formats (WASM)' };
  } catch (e) {
    rpc = null;
    status = { provider: 'builtin-ts', label: 'built-in TypeScript parsers', note: `eve-fit-formats unavailable: ${(e as Error).message}` };
  }
  return status;
}
export const formatsStatus = () => status;
/** Raw JSONL RPC of the formats module (eft_parse / eft_export / format_import / format_export), or null. */
export const formatsRpc = () => rpc;

export function formats(ds: Dataset): FitFormats {
  let f = cache.get(ds);
  if (!f || f.id !== status.provider) cache.set(ds, (f = rpc ? wasmFormats(ds, rpc) : builtinFormats(ds)));
  return f;
}

/** StructuredFit -> UI fit with library defaults (character, profiles, options). Drones of an imported fit start
 *  launched (as with the engine's eft_parse and the web's earlier importers) when the format left them all in the bay. */
export function fitFromStructured(sf: StructuredFit): Fit {
  const f = newFit(sf.ship.type_id, sf.name);
  f.mode_type_id = sf.ship.mode_type_id ?? null;
  f.modules = sf.modules.map((m) => ({ type_id: m.type_id, slot: m.slot, state: m.state, charge_type_id: m.charge_type_id ?? null, mutation: m.mutation ?? null }));
  const launch = sf.drones.length > 0 && sf.drones.every((d) => !d.active);
  f.drones = sf.drones.map((d) => ({ ...d, active: launch ? d.quantity : d.active }));
  f.fighters = sf.fighters.map((x) => ({ ...x }));
  f.implants = [...sf.implants];
  f.boosters = sf.boosters.map((b) => ({ ...b }));
  f.cargo = sf.cargo.map((c) => ({ ...c }));
  if (sf.notes) f.notes = sf.notes;
  return f;
}

export interface ImportResult { kind: string; fits: Fit[]; warnings: string[] }
export function importFits(ds: Dataset, text: string, format?: ImportFormat, path?: string): ImportResult {
  const r = formats(ds).parse(text, format, path);
  return { kind: r.kind, fits: r.fits.map(fitFromStructured), warnings: r.warnings };
}
/** One fit from text (share links, the demo fit): the first fit of the text. */
export function importFit(ds: Dataset, text: string, format?: ImportFormat): Fit {
  const r = importFits(ds, text, format);
  if (!r.fits.length) throw new Error('no fit in the text');
  return r.fits[0];
}

export interface ExportExtra { options?: ExportOptions; stats?: unknown; slotTotals?: Partial<Record<Slot, number>> }
/** The FitRequest an export sees (and, through shipstatsRequest, the request whose stats `shipstats` needs). */
export function exportRequest(fit: Fit, lib: Library) { return toRequest(fit, lib); }
export function exportFit(ds: Dataset, fit: Fit, lib: Library, format: ExportFormat, extra: ExportExtra = {}): string {
  const f = formats(ds);
  const opts = f.id === 'builtin-ts' ? { ...(extra.options ?? {}), slotTotals: extra.slotTotals } as unknown as ExportOptions : extra.options;
  return f.export({ name: fit.name, notes: fit.notes, fit: exportRequest(fit, lib), stats: extra.stats }, format, opts);
}
/** shipstats export: engine stats of shipstatsRequest(fit) first, then the formats module renders the text. */
export async function exportShipstats(ds: Dataset, fit: Fit, lib: Library, calc: (req: unknown) => Promise<unknown>): Promise<string> {
  const stats = await calc(shipstatsRequest(exportRequest(fit, lib)));
  if ((stats as { error?: { message?: string } })?.error) throw new Error(`engine: ${(stats as { error: { message?: string } }).error.message}`);
  return exportFit(ds, fit, lib, 'shipstats', { stats });
}
