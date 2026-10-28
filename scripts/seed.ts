/**
 * Seeds the ledger with REAL mainnet Walrus memories from clearly labelled sample/bot voices.
 *   backfill  – mechanical personas run on historical data with no lookahead (calls are flagged "backfill")
 *   live      – calls sealed now, resolved automatically when their deadline passes
 * Usage: NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local scripts/seed.ts <backfill|live>
 */
import { priceAt, fixtures, spotPrice, LEAGUES } from "../src/lib/oracles";
import { resolveMany, sealMany, type SealInput } from "../src/lib/ledger";
import { latestCheckpoint } from "../src/lib/sui";
import { appendFileSync } from "node:fs";

const ADMIN = process.env.ADMIN_KEY!;
let seed = 20261028;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cdf = (x: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
};
const round3 = (x: number) => Number(x.toPrecision(3));
const fmtPrice = (x: number) => (x >= 100 ? x.toLocaleString("en-US", { maximumFractionDigits: 0 }) : x >= 1 ? x.toFixed(2) : x.toFixed(4));
const fmtTs = (d: Date) =>
  d.toLocaleString("en-US", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC";

async function dailyCloses(symbol: string, endIso: string, days = 16): Promise<number[]> {
  const end = new Date(endIso);
  const start = new Date(end.getTime() - days * 86400000);
  let rows: number[][] = [];
  for (let t = 0; t < 6; t++) {
    await sleep(350);
    const r = await fetch(`https://api.exchange.coinbase.com/products/${symbol}-USD/candles?granularity=86400&start=${start.toISOString()}&end=${end.toISOString()}`);
    const j = await r.json();
    if (Array.isArray(j)) {
      rows = j;
      break;
    }
    await sleep(1500 * (t + 1));
  }
  return rows.sort((a, b) => a[0] - b[0]).map((x) => x[4]);
}

type Job = SealInput;
const jobs: Job[] = [];

const VOICES = {
  ollie: { name: "Overconfident Ollie", kind: "pundit" as const, handle: "sample persona · always sure" },
  cass: { name: "Calibrated Cass", kind: "pundit" as const, handle: "sample persona · prices her doubt" },
  mo: { name: "Momentum Bot", kind: "bot" as const, handle: "rule: yesterday's trend continues" },
  con: { name: "Contrarian Bot", kind: "bot" as const, handle: "rule: yesterday's trend reverses" },
  flip: { name: "Coin Flip 50", kind: "bot" as const, handle: "rule: always 50%" },
  home: { name: "Home Edge Bot", kind: "bot" as const, handle: "rule: back the home side" },
};

async function backfillPrices() {
  const assets = ["BTC", "ETH", "SOL", "SUI"];
  const plan: { v: keyof typeof VOICES; n: number }[] = [
    { v: "ollie", n: 12 },
    { v: "cass", n: 12 },
    { v: "mo", n: 10 },
    { v: "con", n: 10 },
    { v: "flip", n: 8 },
  ];
  for (const { v, n } of plan) {
    for (let i = 0; i < n; i++) {
      const asset = assets[(i + Math.floor(rnd() * 3)) % assets.length];
      const day = 7 + Math.floor(rnd() * 20); // Oct 7 … Oct 26
      const deadline = new Date(Date.UTC(2026, 9, day, 12, 0, 0));
      const claimedAt = new Date(deadline.getTime() - 72 * 3600_000);
      const spot = (await priceAt(asset, claimedAt.toISOString())).price;
      const closes = await dailyCloses(asset, claimedAt.toISOString());
      const rets = closes.slice(1).map((c, k) => Math.log(c / closes[k]));
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length) * Math.sqrt(3);
      const trend = closes.length >= 4 ? Math.log(closes[closes.length - 1] / closes[closes.length - 4]) : 0;
      let op: "above" | "below" = "above";
      let k = spot;
      let p = 0.5;
      if (v === "ollie") {
        op = "above";
        k = round3(spot * (1 + pick([0.01, 0.02, 0.03, 0.04])));
        p = pick([0.88, 0.9, 0.92, 0.95]);
      } else if (v === "cass") {
        op = pick(["above", "below"] as const);
        k = round3(spot * (1 + pick([-0.03, -0.015, 0.015, 0.03])));
        const pAbove = 1 - cdf(Math.log(k / spot) / sd);
        p = Math.min(0.95, Math.max(0.05, Math.round((op === "above" ? pAbove : 1 - pAbove) * 100) / 100));
      } else if (v === "mo") {
        op = trend >= 0 ? "above" : "below";
        k = round3(spot);
        p = 0.6;
      } else if (v === "con") {
        op = trend >= 0 ? "below" : "above";
        k = round3(spot);
        p = 0.6;
      } else {
        op = "above";
        k = round3(spot);
        p = 0.5;
      }
      jobs.push({
        voice: VOICES[v],
        claim: `${asset} will be ${op} $${fmtPrice(k)} at ${fmtTs(deadline)}`,
        rule: { type: "price", asset, quote: "USD", op, threshold: k },
        p,
        deadline: deadline.toISOString(),
        claimedAt: claimedAt.toISOString(),
        source: { quote: `Sample voice: ${VOICES[v].handle}. Decision made from data available at ${fmtTs(claimedAt)} (no lookahead).` },
        admin: ADMIN,
        sample: true,
      });
    }
  }
}

async function backfillSports() {
  const lg = ["soccer/eng.1", "soccer/esp.1", "soccer/ger.1", "soccer/ita.1", "soccer/usa.1", "basketball/nba"];
  const dates = ["20261024", "20261025", "20261026", "20261027"];
  const got: { league: string; f: Awaited<ReturnType<typeof fixtures>>[number] }[] = [];
  for (const l of lg) for (const d of dates) {
    const fx = await fixtures(l, d).catch(() => []);
    for (const f of fx) if (f.state === "post") got.push({ league: l, f });
  }
  const chosen: typeof got = [];
  while (chosen.length < 9 && got.length) chosen.push(got.splice(Math.floor(rnd() * got.length), 1)[0]);
  for (const { league, f } of chosen) {
    const L = LEAGUES.find((x) => x.id === league)!;
    const kickoff = new Date(f.date);
    jobs.push({
      voice: VOICES.home,
      claim: `${f.home.name} beat ${f.away.name} (${L.name})`,
      rule: { type: "sports", league, leagueName: L.name, eventId: f.id, home: f.home.name, away: f.away.name, pick: "home", kickoff: kickoff.toISOString() },
      p: L.draw ? 0.45 : 0.6,
      deadline: new Date(kickoff.getTime() + 3 * 3600_000).toISOString(),
      claimedAt: new Date(kickoff.getTime() - 48 * 3600_000).toISOString(),
      source: { quote: "Sample voice: rule-based home-side pick, made before kickoff (no lookahead)." },
      admin: ADMIN,
      sample: true,
    });
  }
}

async function live() {
  const now = Date.now();
  const mk = (h: number) => new Date(Math.ceil((now + h * 3600_000) / 600_000) * 600_000);
  const assets = ["BTC", "ETH", "SOL", "SUI"];
  const spots: Record<string, number> = {};
  for (const a of assets) spots[a] = (await spotPrice(a)).price;
  for (const h of [1, 3, 6, 12, 24]) {
    for (const a of assets.slice(0, h <= 3 ? 4 : 3)) {
      const dl = mk(h + rnd());
      const s = spots[a];
      const fmtClaim = (op: string, k: number) => `${a} will be ${op} $${fmtPrice(k)} at ${fmtTs(dl)}`;
      const k1 = round3(s);
      const kc = round3(s * (1 + pick([-0.01, 0.01, 0.005, -0.005])));
      jobs.push({ voice: VOICES.mo, claim: fmtClaim("above", k1), rule: { type: "price", asset: a, quote: "USD", op: "above", threshold: k1 }, p: 0.6, deadline: dl.toISOString(), admin: ADMIN, sample: true });
      jobs.push({ voice: VOICES.con, claim: fmtClaim("below", k1), rule: { type: "price", asset: a, quote: "USD", op: "below", threshold: k1 }, p: 0.6, deadline: dl.toISOString(), admin: ADMIN, sample: true });
      if (h >= 3) jobs.push({ voice: VOICES.flip, claim: fmtClaim("above", kc), rule: { type: "price", asset: a, quote: "USD", op: "above", threshold: kc }, p: 0.5, deadline: dl.toISOString(), admin: ADMIN, sample: true });
      if (h >= 6) {
        const kk = round3(s * (1 + pick([0.02, 0.03])));
        jobs.push({ voice: VOICES.ollie, claim: fmtClaim("above", kk), rule: { type: "price", asset: a, quote: "USD", op: "above", threshold: kk }, p: 0.9, deadline: dl.toISOString(), admin: ADMIN, sample: true });
      }
    }
  }
  // Sui onchain metrics through Tatum
  const cp = await latestCheckpoint();
  const in2d = new Date(Date.UTC(2026, 9, 30, 12, 0, 0));
  jobs.push({
    voice: VOICES.cass,
    claim: `Sui mainnet epoch will be at least ${cp.epoch + 2} at ${fmtTs(in2d)}`,
    rule: { type: "sui_metric", metric: "epoch", op: "at_least", threshold: cp.epoch + 2 },
    p: 0.88,
    deadline: in2d.toISOString(),
    admin: ADMIN,
    sample: true,
  });
  const txT = Math.round((cp.totalTransactions + 2 * 86400 * 150) / 1e6) * 1e6;
  jobs.push({
    voice: VOICES.cass,
    claim: `Sui mainnet will have processed over ${(txT / 1e9).toFixed(3)} billion transactions by ${fmtTs(in2d)}`,
    rule: { type: "sui_metric", metric: "total_transactions", op: "at_least", threshold: txT },
    p: 0.6,
    deadline: in2d.toISOString(),
    admin: ADMIN,
    sample: true,
  });
  jobs.push({
    voice: VOICES.ollie,
    claim: `Sui reference gas price will drop below 100 MIST at ${fmtTs(in2d)}`,
    rule: { type: "sui_metric", metric: "reference_gas_price", op: "below", threshold: 100 },
    p: 0.9,
    deadline: in2d.toISOString(),
    admin: ADMIN,
    sample: true,
  });
  // upcoming real fixtures
  const lg = ["soccer/eng.1", "soccer/esp.1", "soccer/ger.1", "soccer/usa.1", "basketball/nba", "soccer/ita.1"];
  const up: { league: string; f: Awaited<ReturnType<typeof fixtures>>[number] }[] = [];
  for (const l of lg) for (const d of ["20261031", "20261101"]) for (const f of await fixtures(l, d).catch(() => [])) if (f.state === "pre") up.push({ league: l, f });
  const chosen: typeof up = [];
  while (chosen.length < 8 && up.length) chosen.push(up.splice(Math.floor(rnd() * up.length), 1)[0]);
  for (const { league, f } of chosen) {
    const L = LEAGUES.find((x) => x.id === league)!;
    const ko = new Date(f.date);
    const dl = new Date(ko.getTime() + 3 * 3600_000);
    jobs.push({
      voice: VOICES.home,
      claim: `${f.home.name} beat ${f.away.name} (${L.name})`,
      rule: { type: "sports", league, leagueName: L.name, eventId: f.id, home: f.home.name, away: f.away.name, pick: "home", kickoff: ko.toISOString() },
      p: L.draw ? 0.45 : 0.6,
      deadline: dl.toISOString(),
      admin: ADMIN,
      sample: true,
    });
    if (jobs.length % 2 === 0)
      jobs.push({
        voice: VOICES.flip,
        claim: `${f.away.name} beat ${f.home.name} away (${L.name})`,
        rule: { type: "sports", league, leagueName: L.name, eventId: f.id, home: f.home.name, away: f.away.name, pick: "away", kickoff: ko.toISOString() },
        p: 0.5,
        deadline: dl.toISOString(),
        admin: ADMIN,
        sample: true,
      });
  }
}

async function run() {
  const mode = process.argv[2];
  if (mode === "backfill") {
    await backfillPrices();
    await backfillSports();
  } else if (mode === "live") await live();
  else throw new Error("mode: backfill | live");
  if (process.env.SKIP_PRICE) for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i].rule.type === "price") jobs.splice(i, 1);
  console.log("jobs:", jobs.length);
  const BATCH = 20;
  const allJobIds: string[] = [];
  for (let i = 0; i < jobs.length; i += BATCH) {
    const part = jobs.slice(i, i + BATCH);
    for (let attempt = 0; ; attempt++) {
      try {
        const { calls, jobIds } = await sealMany(part);
        allJobIds.push(...jobIds);
        appendFileSync(".data/seeded.log", calls.map((c, k) => `${new Date().toISOString()} ${mode} ${c.seal.id} ${jobIds[k]}`).join("\n") + "\n");
        console.log(`sealed batch ${i / BATCH + 1}: ${calls.length} calls`);
        if (mode === "backfill") {
          await sleep(5000);
          const r = await resolveMany(calls);
          console.log(`  resolved ${r.resolved.length} (errors ${r.errors.length})`, r.errors.slice(0, 2));
        }
        break;
      } catch (e) {
        console.log("batch error", attempt, String(e instanceof Error ? e.message : e).slice(0, 200));
        if (attempt >= 4) throw e;
        await sleep(65_000);
      }
    }
    await sleep(35_000);
  }
  console.log("all submitted; job ids:", allJobIds.length);
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
