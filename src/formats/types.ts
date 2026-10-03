// Fit formats layer: every fit that enters the app as text (EFT, DNA, ESI JSON, share links …) is parsed here into
// a StructuredFit, structured JSON with type ids only. The engines accept only structured fits plus skills (format
// parsing is a frontend concern; engine RPC/WASM drops it), so nothing below this layer ever sees fit text.
// The parser behind it is swappable (FitFormats): today the built-in TypeScript parsers (builtin.ts). Later it can
// be the eve-fit-formats WASM package from EX-CT/eve-dogma, which implements the same interface without the UI changing.
import type { Slot } from '../data/dataset';

export type ModState = 'offline' | 'online' | 'active' | 'overheated';
export interface StructuredMutation { base_type_id: number; mutaplasmid_type_id: number; attributes: Record<string, number> }
export interface StructuredModule {
  /** fitted type: for a mutated module the mutaplasmid's output (abyssal) type, with `mutation` naming the base */
  type_id: number; slot: Slot; state: ModState; charge_type_id: number | null; mutation?: StructuredMutation | null;
}
/** A fit as structured JSON. Field names follow the engine contract FitRequest (eve-fit-docs 05-api-schema) where
 *  the two overlap (ship, modules, drones, fighters, implants, boosters, cargo); name / notes are library metadata. */
export interface StructuredFit {
  name: string; notes?: string;
  ship: { type_id: number; mode_type_id?: number | null };
  modules: StructuredModule[];
  drones: { type_id: number; quantity: number; active: number; mutation?: StructuredMutation | null }[];
  fighters: { type_id: number; quantity: number; active: boolean; abilities?: number[] | null }[];
  implants: number[];
  boosters: { type_id: number; side_effects?: number[] }[];
  cargo: { type_id: number; quantity: number }[];
}

/** Import formats (eve-fit-formats `format_import`: Pyfa's detection order for `auto`). The built-in parsers read
 *  eft, dna and esi only. */
export type ImportFormat = 'auto' | 'eft' | 'dna' | 'dna_alt' | 'dna_link' | 'esi' | 'xml' | 'eftcfg';
export type ExportFormat = 'eft' | 'dna' | 'esi' | 'xml' | 'multibuy' | 'shipstats';
export interface ParseResult { /** detected kind, e.g. "EFT", "DNA", "JSON", "XML" */ kind: string; fits: StructuredFit[]; warnings: string[] }
/** What an export sees: the full engine request of the fit (FitRequest JSON: ship, modules … plus character, options),
 *  its name and notes, and for `shipstats` the engine stats of `shipstatsRequest(fit)`. */
export interface ExportInput { name: string; notes?: string; fit: Record<string, unknown>; stats?: unknown }
/** Export switches (eve-fit-formats `options`: implants, mutations, loaded_charges, boosters, cargo, charges, formatting). */
export type ExportOptions = Record<string, boolean>;

/** A fit-format implementation. `parse` throws on input it cannot read; recoverable problems (unknown item names,
 *  bad mutations …) are `warnings` and the item is skipped. Several fits in one text (a Pyfa multi-export, XML)
 *  come back as several `fits`. */
export interface FitFormats {
  readonly id: string;
  readonly label: string;
  readonly importFormats: ImportFormat[];
  readonly exportFormats: ExportFormat[];
  parse(text: string, format?: ImportFormat, path?: string): ParseResult;
  export(input: ExportInput, format: ExportFormat, opts?: ExportOptions): string;
}

/** The request whose stats the `shipstats` export needs (eve-fit-formats `shipstats_request`): all attributes and
 *  no spool-up instead of the fit's spool settings. */
export function shipstatsRequest(req: Record<string, any>): Record<string, unknown> {
  return {
    ...req,
    options: { ...(req.options ?? {}), include_attributes: 'all', default_spool: { type: 'spool_scale', amount: 0 } },
    modules: (req.modules ?? []).map((m: Record<string, unknown>) => ({ ...m, spool: null })),
  };
}
