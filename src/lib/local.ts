import type { Call } from "./types";
export interface LocalSeal { id: string; call: Call; resolverKey?: string; jobId?: string; at: number }
const K = "callwax:seals:v1";
export function loadLocal(): LocalSeal[] {
  try { return JSON.parse(localStorage.getItem(K) ?? "[]"); } catch { return []; }
}
export function saveLocal(s: LocalSeal) {
  try {
    const all = loadLocal().filter((x) => x.id !== s.id);
    all.unshift(s);
    localStorage.setItem(K, JSON.stringify(all.slice(0, 60)));
  } catch {}
}
export const getLocal = (id: string) => loadLocal().find((x) => x.id === id);
