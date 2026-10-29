/** Outcome oracles: crypto prices, Sui onchain metrics (via Tatum), sports finals. */
import { checkpointAtOrBefore } from "./sui";
import type { Outcome, Rule } from "./types";

import { ASSETS, LEAGUES, productOf } from "./catalog";
export { ASSETS, LEAGUES };

async function jget<T>(url: string, tries = 3): Promise<T> {
  let err: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { cache: "no-store", headers: { accept: "application/json", "user-agent": "sealed-calls/1.0" } });
      if (!r.ok) throw new Error(`${url} → ${r.status}`);
      return (await r.json()) as T;
    } catch (e) {
      err = e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw err instanceof Error ? err : new Error(String(err));
}

/* ---------------- prices ---------------- */

export async function spotPrice(symbol: string): Promise<{ price: number; time: string; source: string }> {
  const tr = await tatumRate(symbol);
  if (tr && Number.isFinite(tr.price) && tr.price > 0) return tr;
  const t = await jget<{ price: string; time: string }>(`https://api.exchange.coinbase.com/products/${productOf(symbol)}/ticker`);
  return { price: Number(t.price), time: t.time, source: "coinbase-exchange-ticker" };
}

/** Max distance between a Tatum quote and a call's deadline for it to resolve the call. */
const TATUM_MAX_SKEW_MS = Number(process.env.TATUM_RATE_MAX_SKEW_MS ?? 5 * 60_000);

/** Tatum spot rate (needs TATUM_API_KEY). */
export async function tatumRate(symbol: string): Promise<{ price: number; time: string; source: string } | null> {
  const key = process.env.TATUM_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://api.tatum.io/v4/data/rate/symbol?symbol=${symbol}&basePair=USD`, {
      headers: { "x-api-key": key },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { value: string; timestamp: number; source: string };
    return { price: Number(j.value), time: new Date(j.timestamp).toISOString(), source: `tatum-rate:${j.source}` };
  } catch {
    return null;
  }
}

/**
 * Price "at T" = close of the last 1-minute candle that ends at or before T (illiquid minutes have no candle,
 * so we look back up to 15 minutes). Reproducible by anyone from the public candle URL.
 */
export async function priceAt(symbol: string, iso: string) {
  const end = Math.floor(Date.parse(iso) / 60000) * 60000;
  const start = end - 15 * 60000;
  const url = `https://api.exchange.coinbase.com/products/${productOf(symbol)}/candles?granularity=60&start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`;
  const rows = await jget<number[][]>(url);
  const row = rows.filter((r) => r[0] * 1000 + 60000 <= end).sort((a, b) => b[0] - a[0])[0];
  if (!row) throw new Error("no candle near " + new Date(end).toISOString());
  const cs = row[0] * 1000;
  return { price: row[4], candleStart: new Date(cs).toISOString(), candleEnd: new Date(cs + 60000).toISOString(), url };
}

/* ---------------- sports ---------------- */

export interface Fixture {
  id: string;
  league: string;
  leagueName: string;
  date: string;
  name: string;
  home: { name: string; logo?: string; score?: string };
  away: { name: string; logo?: string; score?: string };
  state: "pre" | "in" | "post";
  detail: string;
}

interface EspnEvent {
  id: string;
  date: string;
  name: string;
  status: { type: { state: string; completed: boolean; description: string; name: string; detail?: string } };
  competitions: {
    competitors: { homeAway: string; winner?: boolean; score?: string; team: { displayName: string; logo?: string } }[];
  }[];
}

export async function fixtures(league: string, yyyymmdd: string): Promise<Fixture[]> {
  const lg = LEAGUES.find((l) => l.id === league);
  if (!lg) throw new Error("unknown league");
  const d = await jget<{ events?: EspnEvent[] }>(`https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard?dates=${yyyymmdd}`);
  return (d.events ?? []).map((e) => {
    const c = e.competitions[0].competitors;
    const home = c.find((x) => x.homeAway === "home")!;
    const away = c.find((x) => x.homeAway === "away")!;
    return {
      id: e.id,
      league,
      leagueName: lg.name,
      date: e.date,
      name: e.name,
      home: { name: home.team.displayName, logo: home.team.logo, score: home.score },
      away: { name: away.team.displayName, logo: away.team.logo, score: away.score },
      state: e.status.type.state as Fixture["state"],
      detail: e.status.type.detail ?? e.status.type.description,
    };
  });
}

export async function sportsFinal(league: string, eventId: string) {
  const d = await jget<{ header?: { competitions?: EspnEvent["competitions"] & { status: EspnEvent["status"] }[]; } }>(
    `https://site.api.espn.com/apis/site/v2/sports/${league}/summary?event=${eventId}`,
  );
  const comp = (d.header?.competitions as unknown as (EspnEvent["competitions"][0] & { status: EspnEvent["status"] })[])?.[0];
  if (!comp) throw new Error("event not found");
  const st = comp.status.type;
  const home = comp.competitors.find((x) => x.homeAway === "home")!;
  const away = comp.competitors.find((x) => x.homeAway === "away")!;
  return {
    completed: st.completed,
    state: st.state,
    statusName: st.name,
    homeScore: Number(home.score ?? 0),
    awayScore: Number(away.score ?? 0),
    homeWinner: Boolean(home.winner),
    awayWinner: Boolean(away.winner),
    url: `https://site.api.espn.com/apis/site/v2/sports/${league}/summary?event=${eventId}`,
  };
}

/* ---------------- unified auto-resolution ---------------- */

export interface AutoResult {
  outcome: Outcome;
  method: "auto:tatum-rate" | "auto:coinbase-1m" | "auto:sui-checkpoint" | "auto:espn-final";
  evidence: Record<string, unknown>;
}

export class NotYet extends Error {}

export async function resolveAuto(rule: Rule, deadline: string): Promise<AutoResult> {
  const deadlineMs = Date.parse(deadline);
  if (rule.type === "price") {
    if (Date.now() < deadlineMs + 90_000) throw new NotYet("deadline not reached");
    // Prefer Tatum's Data API rate when its quote is close enough to the deadline to stand in for it
    // (Tatum serves the current rate only, so this applies when resolving promptly). Otherwise fall back
    // to the reproducible Coinbase 1-minute candle.
    const tr = await tatumRate(rule.asset);
    if (tr && Number.isFinite(tr.price) && tr.price > 0 && Math.abs(Date.parse(tr.time) - deadlineMs) <= TATUM_MAX_SKEW_MS) {
      const yesT = rule.op === "above" ? tr.price > rule.threshold : tr.price < rule.threshold;
      return {
        outcome: yesT ? "true" : "false",
        method: "auto:tatum-rate",
        evidence: {
          asset: rule.asset,
          observed: tr.price,
          threshold: rule.threshold,
          op: rule.op,
          quotedAt: tr.time,
          skewSeconds: Math.round((Date.parse(tr.time) - deadlineMs) / 1000),
          source: `Tatum Data API exchange rate (${tr.source.replace("tatum-rate:", "")})`,
          reproduce: `https://api.tatum.io/v4/data/rate/symbol?symbol=${rule.asset}&basePair=USD`,
          fallback: "Coinbase Exchange 1-minute candle close",
        },
      };
    }
    const p = await priceAt(rule.asset, deadline);
    const yes = rule.op === "above" ? p.price > rule.threshold : p.price < rule.threshold;
    return {
      outcome: yes ? "true" : "false",
      method: "auto:coinbase-1m",
      evidence: {
        asset: rule.asset,
        observed: p.price,
        threshold: rule.threshold,
        op: rule.op,
        candleStart: p.candleStart,
        candleEnd: p.candleEnd,
        source: "Coinbase Exchange 1-minute candle close",
        reproduce: p.url,
      },
    };
  }
  if (rule.type === "sui_metric") {
    if (Date.now() < deadlineMs + 30_000) throw new NotYet("deadline not reached");
    const { cp, probes } = await checkpointAtOrBefore(deadline);
    const observed =
      rule.metric === "epoch" ? cp.epoch : rule.metric === "total_transactions" ? cp.totalTransactions : cp.referenceGasPrice;
    const yes = rule.op === "at_least" ? observed >= rule.threshold : observed < rule.threshold;
    return {
      outcome: yes ? "true" : "false",
      method: "auto:sui-checkpoint",
      evidence: {
        metric: rule.metric,
        observed,
        threshold: rule.threshold,
        op: rule.op,
        checkpoint: { seq: cp.seq, digest: cp.digest, ts: cp.ts, epoch: cp.epoch },
        source: "Sui mainnet via Tatum gateway (GraphQL)",
        probes,
      },
    };
  }
  if (rule.type === "sports") {
    const f = await sportsFinal(rule.league, rule.eventId);
    if (!f.completed) {
      if (/POSTPONED|CANCELED|CANCELLED|SUSPENDED|ABANDONED/i.test(f.statusName))
        return { outcome: "void", method: "auto:espn-final", evidence: { status: f.statusName, reproduce: f.url } };
      throw new NotYet("match not final");
    }
    const result: "home" | "away" | "draw" = f.homeScore > f.awayScore ? "home" : f.awayScore > f.homeScore ? "away" : f.homeWinner ? "home" : f.awayWinner ? "away" : "draw";
    return {
      outcome: result === rule.pick ? "true" : "false",
      method: "auto:espn-final",
      evidence: {
        score: `${rule.home} ${f.homeScore}–${f.awayScore} ${rule.away}`,
        result,
        pick: rule.pick,
        status: f.statusName,
        source: "ESPN public scoreboard API (unofficial)",
        reproduce: f.url,
      },
    };
  }
  throw new Error("manual rules are resolved by hand");
}
