// Market prices from the public ESI endpoint (CORS-enabled, no login): average price, else adjusted price.
// Cached in localStorage for 6 hours. Opt-in from the UI, so the site makes no third-party request by default.
const KEY = 'eve-fit-web-prices';
const TTL = 6 * 3600 * 1000;
export const PRICES_URL = 'https://esi.evetech.net/latest/markets/prices/?datasource=tranquility';

export interface Prices { at: number; map: Map<number, number> }

export function cachedPrices(): Prices | null {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!j || Date.now() - j.at > TTL) return null;
    return { at: j.at, map: new Map(j.p as [number, number][]) };
  } catch { return null; }
}

export async function fetchPrices(): Promise<Prices> {
  const r = await fetch(PRICES_URL);
  if (!r.ok) throw new Error(`ESI prices: HTTP ${r.status}`);
  const rows = (await r.json()) as { type_id: number; average_price?: number; adjusted_price?: number }[];
  const p: [number, number][] = rows.map((x) => [x.type_id, x.average_price || x.adjusted_price || 0]);
  const at = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify({ at, p })); } catch { /* quota: keep in memory only */ }
  return { at, map: new Map(p) };
}
