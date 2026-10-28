import type { Call, CalibrationBin, VoiceStats, Voice } from "./types";

export const outcomeNum = (c: Call): 0 | 1 | null =>
  !c.resolution || c.resolution.outcome === "void" ? null : c.resolution.outcome === "true" ? 1 : 0;

export const brierOf = (p: number, o: 0 | 1) => (p - o) ** 2;

function agg(calls: Call[]) {
  const scored = calls.map((c) => ({ p: c.seal.p, o: outcomeNum(c) })).filter((x): x is { p: number; o: 0 | 1 } => x.o !== null);
  if (!scored.length) return { n: 0, brier: null, hit: null, skill: null };
  const brier = scored.reduce((s, x) => s + brierOf(x.p, x.o), 0) / scored.length;
  const hit = scored.filter((x) => (x.p >= 0.5 ? 1 : 0) === x.o).length / scored.length;
  return { n: scored.length, brier, hit, skill: 1 - brier / 0.25 };
}

/** Reliability bins over p = P(claim true). 5 equal-width bins. */
export function calibration(calls: Call[], binCount = 5): CalibrationBin[] {
  const bins: CalibrationBin[] = Array.from({ length: binCount }, (_, i) => ({
    lo: i / binCount,
    hi: (i + 1) / binCount,
    n: 0,
    meanP: 0,
    freq: 0,
  }));
  for (const c of calls) {
    const o = outcomeNum(c);
    if (o === null) continue;
    const i = Math.min(binCount - 1, Math.floor(c.seal.p * binCount));
    bins[i].n++;
    bins[i].meanP += c.seal.p;
    bins[i].freq += o;
  }
  return bins.map((b) => (b.n ? { ...b, meanP: b.meanP / b.n, freq: b.freq / b.n } : b));
}

export function voiceStats(voice: Voice, calls: Call[]): VoiceStats {
  const live = calls.filter((c) => c.seal.mode === "live");
  return {
    voice,
    total: calls.length,
    open: calls.filter((c) => !c.resolution).length,
    resolved: calls.filter((c) => c.resolution).length,
    verified: agg(live),
    all: agg(calls),
    bins: calibration(calls),
  };
}

/**
 * Track-record-adjusted probability: shrink the voice's stated confidence toward how often
 * their calls of similar confidence actually came true. k = prior weight of the stated number.
 */
export function adjustProbability(p: number, history: Call[], k = 4) {
  const side = p >= 0.5;
  const conf = side ? p : 1 - p;
  const near = history
    .map((c) => ({ c, o: outcomeNum(c) }))
    .filter((x): x is { c: Call; o: 0 | 1 } => x.o !== null)
    .filter((x) => Math.abs((x.c.seal.p >= 0.5 ? x.c.seal.p : 1 - x.c.seal.p) - conf) <= 0.15);
  // "right" = the voice's stated side happened
  const right = near.filter((x) => (x.c.seal.p >= 0.5 ? 1 : 0) === x.o).length;
  const n = near.length;
  if (!n) return { adjusted: p, n: 0, right: 0, freq: null as number | null, evidence: [] as Call[] };
  const freq = right / n;
  const adjConf = (n * freq + k * conf) / (n + k);
  const adjusted = side ? adjConf : 1 - adjConf;
  return { adjusted, n, right, freq, evidence: near.map((x) => x.c) };
}

export const fmt = {
  brier: (b: number | null) => (b === null ? "—" : b.toFixed(3)),
  pct: (x: number | null, d = 0) => (x === null ? "—" : (x * 100).toFixed(d) + "%"),
};
