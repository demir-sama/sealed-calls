/**
 * Walrus Memory (MemWal) layer. Walrus is the database:
 *  - one memory namespace per voice:  "v.<slug>"
 *  - SEALED_CALL <json> and RESOLUTION <json> records are the only source of truth.
 */
import { MemWal } from "@mysten-incubation/memwal";
import { RESOLUTION_PREFIX, SEAL_PREFIX, canonical, resolutionFromBody, sealFromBody, verifySealRecord } from "./canon";
import type { Call, ResolutionBody, ResolutionRecord, SealBody, SealRecord, WalrusMeta } from "./types";

let client: MemWal | null = null;
export function mem(): MemWal {
  if (client) return client;
  const key = process.env.MEMWAL_PRIVATE_KEY;
  const accountId = process.env.MEMWAL_ACCOUNT_ID;
  if (!key || !accountId) throw new Error("MEMWAL_PRIVATE_KEY / MEMWAL_ACCOUNT_ID not configured");
  client = MemWal.create({
    key,
    accountId,
    serverUrl: process.env.MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz",
    namespace: "sealed-calls",
    requestTimeoutMs: 45_000,
    recallTimeoutMs: 45_000,
  });
  return client;
}

export const ownerAddress = () => process.env.SUI_OWNER_ADDRESS ?? "";
export const nsOf = (slug: string) => `v.${slug}`;
export const slugOfNs = (ns: string) => (ns.startsWith("v.") ? ns.slice(2) : null);

export const AGGREGATOR = process.env.WALRUS_AGGREGATOR ?? "https://aggregator.walrus-mainnet.walrus.space";

/** Submit a seal. Returns as soon as the relayer accepted the job (~2s); the blob lands ~25s later. */
export async function writeSeal(seal: SealRecord): Promise<{ jobId: string }> {
  const text = SEAL_PREFIX + canonical(seal);
  const r = await mem().rememberAsync(text, nsOf(seal.voice.slug), { idempotencyKey: "seal:" + seal.hash });
  return { jobId: (r.job_id ?? r.id) as string };
}

export async function writeResolution(res: ResolutionRecord, voiceSlug: string): Promise<{ jobId: string }> {
  const text = RESOLUTION_PREFIX + canonical(res);
  const r = await mem().rememberAsync(text, nsOf(voiceSlug), { idempotencyKey: "res:" + res.sealHash });
  return { jobId: (r.job_id ?? r.id) as string };
}

export async function jobStatus(jobId: string) {
  return mem().getRememberStatus(jobId);
}

export { resolutionFromBody, sealFromBody };
export type { SealBody, ResolutionBody };

/* ---------------- hydrate ledger from Walrus ---------------- */

export interface Hydrated {
  calls: Call[];
  voices: string[];
  recalled: number;
  dropped: number;
  tookMs: number;
  at: string;
}

interface RecalledRow {
  blob_id: string;
  text: string;
  created_at?: string;
}

async function recallAll(ns: string, query: string): Promise<{ rows: RecalledRow[]; dropped: number }> {
  const r = await mem().recall(query, { limit: 100, namespace: ns } as never);
  return { rows: r.results as RecalledRow[], dropped: r.dropped_count ?? 0 };
}

function parsePrefixed<T>(prefix: string, text: string): T | null {
  const t = text.trimStart();
  if (!t.startsWith(prefix)) return null;
  try {
    return JSON.parse(t.slice(prefix.length)) as T;
  } catch {
    return null;
  }
}

export async function hydrateVoice(slug: string): Promise<{ calls: Call[]; recalled: number; dropped: number }> {
  const ns = nsOf(slug);
  const [seals, ress, meta] = await Promise.all([
    recallAll(ns, "SEALED_CALL prediction claim probability deadline"),
    recallAll(ns, "RESOLUTION outcome evidence resolved"),
    listMeta(ns),
  ]);
  const byBlob = new Map(meta.map((m) => [m.blobId, m]));
  const calls = new Map<string, Call>();
  for (const row of seals.rows) {
    const rec = parsePrefixed<SealRecord>(SEAL_PREFIX, row.text);
    if (!rec || rec.v !== 1) continue;
    const v = await verifySealRecord(rec);
    if (!v.ok) continue; // tampered or malformed → ignored, never scored
    const m = byBlob.get(row.blob_id);
    calls.set(rec.id, {
      seal: rec,
      sealMeta: { status: "done", blobId: row.blob_id, memoryId: m?.memoryId, createdAt: row.created_at ?? m?.createdAt, size: m?.size },
    });
  }
  for (const row of ress.rows) {
    const res = parsePrefixed<ResolutionRecord>(RESOLUTION_PREFIX, row.text);
    if (!res) continue;
    const call = calls.get(res.callId);
    if (!call || call.seal.hash !== res.sealHash) continue;
    const m = byBlob.get(row.blob_id);
    // earliest valid resolution wins
    if (call.resolution && Date.parse(call.resolution.resolvedAt) <= Date.parse(res.resolvedAt)) continue;
    call.resolution = res;
    call.resolutionMeta = { status: "done", blobId: row.blob_id, memoryId: m?.memoryId, createdAt: row.created_at ?? m?.createdAt, size: m?.size };
  }
  return { calls: [...calls.values()], recalled: seals.rows.length + ress.rows.length, dropped: seals.dropped + ress.dropped };
}

export interface MemMeta {
  memoryId: string;
  blobId: string;
  createdAt: string;
  size: number;
  namespace: string;
}

export async function listMeta(namespace?: string): Promise<MemMeta[]> {
  const out: MemMeta[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const page = await mem().listMemories({ cursor, namespace, limit: 500 } as never);
    for (const m of page.memories as unknown as { memory_id: string; blob_id: string; created_at: string; size: number; namespace_id: string }[]) {
      out.push({ memoryId: m.memory_id, blobId: m.blob_id, createdAt: m.created_at, size: m.size, namespace: m.namespace_id });
    }
    if (!page.has_more) break;
    cursor = page.next_cursor ?? undefined;
  }
  return out;
}

export async function listVoiceNamespaces(): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const page = await mem().listNamespaces({ cursor } as never);
    for (const n of page.namespaces) {
      const s = slugOfNs(n.name);
      if (s) out.push(s);
    }
    if (!page.has_more) break;
    cursor = page.next_cursor ?? undefined;
  }
  return out;
}

export async function hydrateAll(): Promise<Hydrated> {
  const t0 = Date.now();
  const voices = await listVoiceNamespaces();
  const calls: Call[] = [];
  let recalled = 0;
  let dropped = 0;
  // 3 at a time to be kind to the relayer
  for (let i = 0; i < voices.length; i += 3) {
    const part = await Promise.all(voices.slice(i, i + 3).map((s) => hydrateVoice(s)));
    for (const p of part) {
      calls.push(...p.calls);
      recalled += p.recalled;
      dropped += p.dropped;
    }
  }
  return { calls, voices, recalled, dropped, tookMs: Date.now() - t0, at: new Date().toISOString() };
}

/* ---------------- raw blob checks ---------------- */

export async function aggregatorProbe(blobId: string): Promise<{ ok: boolean; bytes: number; head: string; url: string; ms: number }> {
  const url = `${AGGREGATOR}/v1/blobs/${blobId}`;
  const t = Date.now();
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return { ok: false, bytes: 0, head: "", url, ms: Date.now() - t };
    const buf = new Uint8Array(await r.arrayBuffer());
    return {
      ok: true,
      bytes: buf.length,
      head: Array.from(buf.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join(""),
      url,
      ms: Date.now() - t,
    };
  } catch {
    return { ok: false, bytes: 0, head: "", url, ms: Date.now() - t };
  }
}
export type { Call, WalrusMeta };
