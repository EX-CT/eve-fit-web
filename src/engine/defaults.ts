// Default engine backend of the hosted site. To switch it (e.g. after an engine round), change the fallback below or
// set the repository variable DEFAULT_ENGINE (pages.yml passes it as VITE_DEFAULT_ENGINE). Users who never picked a
// backend themselves follow the new default; an explicit choice is kept.
export const DEFAULT_BACKEND: string = (import.meta.env.VITE_DEFAULT_ENGINE as string | undefined) || 'ts-worker';
