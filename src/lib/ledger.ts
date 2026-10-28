import "server-only";
import { z } from "zod";
import { randomHex, resolutionFromBody, sealFromBody, sha256Hex } from "./canon";
import { NotYet, ASSETS, LEAGUES, resolveAuto } from "./oracles";
import { adjustProbability, voiceStats } from "./scoring";
import { slugify } from "./slug";
import { latestCheckpoint, toAnchor } from "./sui";
import type { Call, Outcome, ResolutionBody, SealBody, Voice, VoiceStats } from "./types";
import { hydrateAll, hydrateVoice, jobStatus, listMeta, nsOf, writeResolution, writeSeal, type Hydrated } from "./walrus";

/* ------------------------------ cache ------------------------------ */
const TTL_MS = 25_000;
type G = typeof globalThis & {
  __sc?: { h?: Hydrated; at: number; flight?: Promise<Hydrated>; pending: Map<string, Call>; resolving: Set<string>; hits: Map<string, number[]> };
};
const g = globalThis as G;
g.__sc ??= { at: 0, pending: new Map(), resolving: new Set(), hits: new Map() };
const S = g.__sc;

export async function getLedger(opts: { fresh?: boolean } = {}): Promise<Hydrated & { calls: Call[] }> {
  const age = Date.now() - S.at;
  if (!opts.fresh && S.h && age < TTL_MS) return withPending(S.h);
  if (!S.flight) {
    S.flight = hydrateAll()
      .then((h) => {
        S.h = h;
        S.at = Date.now();
        for (const c of h.calls) S.pending.delete(c.seal.id); // landed in Walrus
        return h;
      })
      .finally(() => {
        S.flight = undefined;
      });
  }
  // stale-while-revalidate: serve stale data instantly when we have some
  if (S.h && !opts.fresh) return withPending(S.h);
  return withPending(await S.flight);
}

function withPending(h: Hydrated): Hydrated {
  const have = new Set(h.calls.map((c) => c.seal.id));
  const extra = [...S.pending.values()].filter((c) => !have.has(c.seal.id));
  return extra.length ? { ...h, calls: [...h.calls, ...extra] } : h;
}

export function invalidate() {
  S.at = 0;
}

export function voicesFrom(calls: Call[]): Map<string, { voice: Voice; calls: Call[] }> {
  const m = new Map<string, { voice: Voice; calls: Call[] }>();
  for (const c of calls) {
    const e = m.get(c.seal.voice.slug) ?? { voice: c.seal.voice, calls: [] };
    e.calls.push(c);
    m.set(c.seal.voice.slug, e);
  }
  return m;
}

export function allStats(calls: Call[]): VoiceStats[] {
  return [...voicesFrom(calls).values()].map((v) => voiceStats(v.voice, v.calls));
}

export async function getCall(id: string): Promise<Call | undefined> {
  const l = await getLedger();
  return l.calls.find((c) => c.seal.id === id) ?? (await getLedger({ fresh: true })).calls.find((c) => c.seal.id === id);
}

/* ------------------------------ sealing ------------------------------ */

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "bad date");
const ruleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("price"),
    asset: z.string().refine((s) => ASSETS.some((a) => a.symbol === s), "unsupported asset"),
    quote: z.literal("USD"),
    op: z.enum(["above", "below"]),
    threshold: z.number().positive().finite(),
  }),
  z.object({
    type: z.literal("sui_metric"),
    metric: z.enum(["epoch", "total_transactions", "reference_gas_price"]),
    op: z.enum(["at_least", "below"]),
    threshold: z.number().nonnegative().finite(),
  }),
  z.object({
    type: z.literal("sports"),
    league: z.string().refine((s) => LEAGUES.some((l) => l.id === s)),
    leagueName: z.string().max(60),
    eventId: z.string().regex(/^\d{4,12}$/),
    home: z.string().max(80),
    away: z.string().max(80),
    pick: z.enum(["home", "draw", "away"]),
    kickoff: iso,
  }),
  z.object({ type: z.literal("manual"), rule: z.string().min(8).max(400) }),
]);

export const sealInput = z.object({
  voice: z.object({
    name: z.string().trim().min(1).max(60),
    kind: z.enum(["pundit", "friend", "self", "bot"]),
    handle: z.string().trim().max(80).optional(),
  }),
  claim: z.string().trim().min(8).max(280),
  rule: ruleSchema,
  p: z.number().min(0.01).max(0.99),
  deadline: iso,
  claimedAt: iso.optional(),
  source: z.object({ url: z.string().url().max(300).optional(), quote: z.string().max(400).optional() }).optional(),
  admin: z.string().optional(),
  sample: z.boolean().optional(),
});
export type SealInput = z.infer<typeof sealInput>;

function rateLimit(ip: string, max = 12, windowMs = 3600_000) {
  const now = Date.now();
  const arr = (S.hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new HttpError(429, "Slow down: too many seals from this address this hour.");
  arr.push(now);
  S.hits.set(ip, arr);
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const isAdmin = (k?: string) => !!k && !!process.env.ADMIN_KEY && k === process.env.ADMIN_KEY;

export async function sealCall(input: SealInput, ip = "local") {
  const admin = isAdmin(input.admin);
  if (!admin) rateLimit(ip);
  const now = Date.now();
  const deadlineMs = Date.parse(input.deadline);
  const mode: "live" | "backfill" = deadlineMs > now + 2 * 60_000 ? "live" : "backfill";
  if (mode === "live" && deadlineMs > now + 800 * 86400_000) throw new HttpError(400, "Deadline is too far away (max ~2 years).");
  if (mode === "backfill") {
    if (input.rule.type === "manual") throw new HttpError(400, "Backfilled (already-past) calls need an auto-checkable rule: price, Sui metric or sports.");
    if (!input.claimedAt) throw new HttpError(400, "Backfilled calls need the date the voice originally made the call.");
  }
  if (input.claimedAt && Date.parse(input.claimedAt) > now) throw new HttpError(400, "claimedAt is in the future.");
  if (input.rule.type === "sports" && input.rule.pick === "draw" && !LEAGUES.find((l) => l.id === (input.rule as { league: string }).league)?.draw)
    throw new HttpError(400, "That sport has no draws.");

  const slug = slugify(input.voice.name);
  const sample = admin && input.sample ? true : undefined;
  const voice: Voice = { slug, name: input.voice.name, kind: input.voice.kind, ...(input.voice.handle ? { handle: input.voice.handle } : {}), ...(sample ? { sample } : {}) };
  const cp = await latestCheckpoint();
  let resolverKey: string | undefined;
  let resolverKeyHash: string | undefined;
  if (input.rule.type === "manual") {
    resolverKey = "rk_" + randomHex(10);
    resolverKeyHash = await sha256Hex(resolverKey);
  }
  const body: SealBody = {
    v: 1,
    voice,
    claim: input.claim,
    rule: input.rule,
    p: Math.round(input.p * 100) / 100,
    deadline: new Date(deadlineMs).toISOString(),
    sealedAt: new Date().toISOString(),
    mode,
    ...(mode === "backfill" ? { claimedAt: new Date(input.claimedAt!).toISOString() } : {}),
    ...(input.source && (input.source.url || input.source.quote) ? { source: input.source } : {}),
    anchor: toAnchor(cp),
    nonce: randomHex(8),
    ...(resolverKeyHash ? { resolverKeyHash } : {}),
  };
  const seal = await sealFromBody(body);
  const { jobId } = await writeSeal(seal);
  const call: Call = { seal, sealMeta: { status: "pending", jobId } };
  S.pending.set(seal.id, call);
  return { call, jobId, resolverKey };
}

export async function sealStatus(jobId: string, id?: string) {
  const s = await jobStatus(jobId);
  if (s.status === "done" || s.status === "failed") {
    const c = id ? S.pending.get(id) : undefined;
    if (c) c.sealMeta = { ...c.sealMeta, status: s.status === "done" ? "done" : "failed", blobId: s.blob_id };
    if (s.status === "done") invalidate();
  }
  return s;
}

/* ------------------------------ resolution ------------------------------ */

async function commitResolution(call: Call, body: ResolutionBody) {
  const rec = await resolutionFromBody(body);
  try {
    const { jobId } = await writeResolution(rec, call.seal.voice.slug);
    call.resolution = rec;
    call.resolutionMeta = { status: "pending", jobId };
    S.pending.set(call.seal.id, call);
    return { rec, jobId };
  } catch (e) {
    // 409 → another instance already committed a (different-timestamp) resolution for this seal
    if (/409/.test(String(e))) {
      invalidate();
      return null;
    }
    throw e;
  }
}

export async function resolveOne(call: Call) {
  const r = call.seal.rule;
  if (r.type === "manual") return null;
  if (call.resolution || S.resolving.has(call.seal.id)) return null;
  S.resolving.add(call.seal.id);
  try {
    const res = await resolveAuto(r, call.seal.deadline);
    return await commitResolution(call, {
      v: 1,
      callId: call.seal.id,
      sealHash: call.seal.hash,
      voiceSlug: call.seal.voice.slug,
      outcome: res.outcome,
      resolvedAt: new Date().toISOString(),
      method: res.method,
      evidence: res.evidence,
    });
  } catch (e) {
    if (e instanceof NotYet) return null;
    throw e;
  } finally {
    S.resolving.delete(call.seal.id);
  }
}

export async function resolveDue(max = 6) {
  const { calls } = await getLedger({ fresh: true });
  const due = calls
    .filter((c) => !c.resolution && c.seal.rule.type !== "manual" && Date.parse(c.seal.deadline) < Date.now() - 20_000)
    .sort((a, b) => Date.parse(a.seal.deadline) - Date.parse(b.seal.deadline))
    .slice(0, max);
  const done: { id: string; outcome: Outcome }[] = [];
  const errors: { id: string; error: string }[] = [];
  for (const c of due) {
    try {
      const r = await resolveOne(c);
      if (r) done.push({ id: c.seal.id, outcome: r.rec.outcome });
    } catch (e) {
      errors.push({ id: c.seal.id, error: String(e instanceof Error ? e.message : e) });
    }
  }
  return { checked: due.length, resolved: done, errors };
}

export async function resolveManual(id: string, key: string, outcome: Outcome, note?: string, url?: string) {
  const call = await getCall(id);
  if (!call) throw new HttpError(404, "Unknown call");
  if (call.resolution) throw new HttpError(409, "Already resolved");
  if (Date.now() < Date.parse(call.seal.deadline) - 1000) throw new HttpError(400, "The deadline has not passed yet.");
  const keyHash = await sha256Hex(key);
  const okKey = (call.seal.resolverKeyHash && keyHash === call.seal.resolverKeyHash) || isAdmin(key);
  if (!okKey) throw new HttpError(403, "Wrong resolver key.");
  const out = await commitResolution(call, {
    v: 1,
    callId: call.seal.id,
    sealHash: call.seal.hash,
    voiceSlug: call.seal.voice.slug,
    outcome,
    resolvedAt: new Date().toISOString(),
    method: "manual",
    evidence: { resolvedBy: "resolver key holder", ...(url ? { evidenceUrl: url } : {}) },
    ...(note ? { note: note.slice(0, 500) } : {}),
  });
  if (!out) throw new HttpError(409, "Already resolved");
  return out;
}

export async function resolutionStatus(jobId: string, id: string) {
  const s = await jobStatus(jobId);
  if (s.status === "done") {
    const c = S.pending.get(id);
    if (c?.resolutionMeta) c.resolutionMeta = { ...c.resolutionMeta, status: "done", blobId: s.blob_id };
    invalidate();
  }
  return s;
}

/* ------------------------------ learning loop ------------------------------ */

/** Recall the voice's ledger straight from Walrus Memory and recalibrate a stated probability. */
export async function recalibrate(voiceName: string, p: number) {
  const slug = slugify(voiceName);
  const t = Date.now();
  const h = await hydrateVoice(slug);
  const adj = adjustProbability(p, h.calls);
  return {
    slug,
    stated: p,
    adjusted: adj.adjusted,
    n: adj.n,
    right: adj.right,
    freq: adj.freq,
    recalled: h.recalled,
    namespace: nsOf(slug),
    ms: Date.now() - t,
    evidence: adj.evidence.slice(0, 6).map((c) => ({ id: c.seal.id, claim: c.seal.claim, p: c.seal.p, outcome: c.resolution?.outcome, blobId: c.sealMeta.blobId })),
  };
}

export { listMeta };
