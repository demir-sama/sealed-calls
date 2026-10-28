import "server-only";
import { allStats, getLedger } from "./ledger";
import type { Call } from "./types";

/** Never let a Walrus/relayer hiccup 500 a page; show an honest degraded state instead. */
export async function safeLedger() {
  try {
    const l = await getLedger();
    return { ...l, stats: allStats(l.calls), error: null as string | null };
  } catch (e) {
    return { calls: [] as Call[], voices: [] as string[], recalled: 0, dropped: 0, tookMs: 0, at: new Date().toISOString(), stats: [], error: e instanceof Error ? e.message : String(e) };
  }
}
