/**
 * Sui reads through the Tatum Sui gateway (GraphQL).
 * Uses TATUM_API_KEY (x-api-key) when set; the gateway also answers anonymously at a lower rate.
 */
import type { Anchor } from "./types";

const GQL = process.env.TATUM_SUI_GRAPHQL ?? "https://sui-mainnet.gateway.tatum.io/graphql";
export const BLOB_TYPE = "0xfdc88f7d7cf30afab2f82e8380d11ee8f70efb90e863d1de8616fae1bb09ea77::blob::Blob";

export function tatumMode(): "keyed" | "anonymous" {
  return process.env.TATUM_API_KEY ? "keyed" : "anonymous";
}

// one global queue per server instance keeps us inside the gateway's per-second limit
let chain: Promise<unknown> = Promise.resolve();
const GAP_MS = Number(process.env.TATUM_MIN_GAP_MS ?? (process.env.TATUM_API_KEY ? 340 : 1100));
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => new Promise((r) => setTimeout(r, GAP_MS)),
    () => new Promise((r) => setTimeout(r, GAP_MS)),
  );
  return run;
}

export async function gql<T>(query: string, variables?: Record<string, unknown>, tries = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await throttled(() => gqlOnce<T>(query, variables));
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function gqlOnce<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  {
    {
      const res = await fetch(GQL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.TATUM_API_KEY ? { "x-api-key": process.env.TATUM_API_KEY } : {}),
        },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`tatum ${res.status}`);
      const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
      if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
      return json.data as T;
    }
  }
}

interface CpRaw {
  sequenceNumber: number;
  digest: string;
  timestamp: string;
  networkTotalTransactions: number;
  epoch: { epochId: number; referenceGasPrice: string } | null;
}
const CP_FIELDS = `sequenceNumber digest timestamp networkTotalTransactions epoch { epochId referenceGasPrice }`;

export interface Checkpoint {
  seq: number;
  digest: string;
  ts: string;
  epoch: number;
  totalTransactions: number;
  referenceGasPrice: number;
}
function toCp(c: CpRaw): Checkpoint {
  return {
    seq: c.sequenceNumber,
    digest: c.digest,
    ts: c.timestamp,
    epoch: c.epoch?.epochId ?? -1,
    totalTransactions: c.networkTotalTransactions,
    referenceGasPrice: Number(c.epoch?.referenceGasPrice ?? 0),
  };
}

export async function latestCheckpoint(): Promise<Checkpoint> {
  const d = await gql<{ checkpoint: CpRaw }>(`{ checkpoint { ${CP_FIELDS} } }`);
  return toCp(d.checkpoint);
}

export async function checkpointBySeq(seq: number): Promise<Checkpoint | null> {
  const d = await gql<{ checkpoint: CpRaw | null }>(
    `query($s: UInt53!){ checkpoint(sequenceNumber: $s) { ${CP_FIELDS} } }`,
    { s: seq },
  );
  return d.checkpoint ? toCp(d.checkpoint) : null;
}

export function toAnchor(c: Checkpoint): Anchor {
  return { chain: "sui:mainnet", seq: c.seq, digest: c.digest, ts: c.ts, epoch: c.epoch, via: "tatum-graphql" };
}

/** Last checkpoint whose timestamp is <= ts. k-ary search, 16 aliased probes per request. */
export async function checkpointAtOrBefore(ts: string): Promise<{ cp: Checkpoint; probes: number }> {
  const target = Date.parse(ts);
  const latest = await latestCheckpoint();
  if (Date.parse(latest.ts) <= target) return { cp: latest, probes: 1 };
  let probes = 1;
  // checkpoints are ~250ms apart on mainnet → generous bracket for the first guess
  const msBehind = Date.parse(latest.ts) - target;
  let hi = latest.seq; // timestamp(hi) > target
  let lo = Math.max(1, hi - Math.ceil((msBehind / 150) * 1) - 2_000); // want timestamp(lo) <= target
  const K = 16;
  const probe = async (seqs: number[]) => {
    const q = `{ ${seqs.map((s, i) => `c${i}: checkpoint(sequenceNumber: ${s}) { ${CP_FIELDS} }`).join(" ")} }`;
    const d = await gql<Record<string, CpRaw | null>>(q);
    probes += seqs.length;
    return seqs.map((s, i) => ({ s, c: d[`c${i}`] ? toCp(d[`c${i}`] as CpRaw) : null }));
  };
  // ensure lo is at/before target
  for (let k = 0; k < 6; k++) {
    const [r] = await probe([lo]);
    if (r.c && Date.parse(r.c.ts) <= target) break;
    lo = Math.max(1, lo - (hi - lo) * 2 - 1000);
  }
  let best: Checkpoint | null = null;
  while (hi - lo > 1) {
    const step = Math.max(1, Math.floor((hi - lo) / (K + 1)));
    const seqs: number[] = [];
    for (let i = 1; i <= K; i++) {
      const s = lo + step * i;
      if (s < hi) seqs.push(s);
    }
    if (!seqs.length) seqs.push(lo + 1);
    const res = await probe(seqs);
    let newLo = lo;
    let newHi = hi;
    for (const r of res) {
      if (!r.c) continue;
      if (Date.parse(r.c.ts) <= target) {
        if (r.s > newLo) {
          newLo = r.s;
          best = r.c;
        }
      } else if (r.s < newHi) newHi = r.s;
    }
    if (newLo === lo && newHi === hi) break;
    lo = newLo;
    hi = newHi;
  }
  if (!best) {
    const [r] = await probe([lo]);
    best = r.c;
  }
  if (!best) throw new Error("could not locate checkpoint for " + ts);
  return { cp: best, probes };
}

/* ---------- Walrus Blob objects on Sui ---------- */

export function blobIdToDecimal(blobId: string): string {
  const b = Buffer.from(blobId, "base64url");
  let n = 0n;
  for (let i = b.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(b[i]);
  return n.toString();
}

export interface SuiBlobObject {
  objectId: string;
  blobId: string;
  size: number;
  registeredEpoch: number;
  certifiedEpoch: number | null;
  endEpoch: number;
  deletable: boolean;
  /** checkpoint of the tx that created/last touched the Blob object */
  checkpoint: { seq: number; digest: string; ts: string } | null;
}

/** Find the Sui `Blob` object for a Walrus blob id among the owner's objects. */
export async function findBlobObject(owner: string, blobIdDecimal: string): Promise<SuiBlobObject | null> {
  let after: string | null = null;
  for (let page = 0; page < 12; page++) {
    const d: {
      address: {
        objects: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: {
            address: string;
            contents: { json: Record<string, any> } | null; // eslint-disable-line @typescript-eslint/no-explicit-any
          }[];
        };
      } | null;
    } = await gql(
      `query($o: SuiAddress!, $t: String!, $a: String){ address(address:$o){ objects(first: 50, after: $a, filter:{type:$t}){ pageInfo{hasNextPage endCursor} nodes{ address contents{ json } } } } }`,
      { o: owner, t: BLOB_TYPE, a: after },
    );
    const objs = d.address?.objects;
    if (!objs) return null;
    for (const n of objs.nodes) {
      const j = n.contents?.json;
      if (j && String(j.blob_id) === blobIdDecimalNorm(blobIdDecimal)) {
        const tx = await gql<{
          object: { previousTransaction: { effects: { checkpoint: { sequenceNumber: number; digest: string; timestamp: string } | null } } | null } | null;
        }>(`query($a: SuiAddress!){ object(address:$a){ previousTransaction{ effects{ checkpoint{ sequenceNumber digest timestamp } } } } }`, { a: n.address });
        const cp = tx.object?.previousTransaction?.effects?.checkpoint ?? null;
        return {
          objectId: n.address,
          blobId: String(j.blob_id),
          size: Number(j.size),
          registeredEpoch: Number(j.registered_epoch),
          certifiedEpoch: j.certified_epoch == null ? null : Number(j.certified_epoch),
          endEpoch: Number(j.storage?.end_epoch),
          deletable: Boolean(j.deletable),
          checkpoint: cp ? { seq: cp.sequenceNumber, digest: cp.digest, ts: cp.timestamp } : null,
        };
      }
    }
    if (!objs.pageInfo.hasNextPage) return null;
    after = objs.pageInfo.endCursor;
  }
  return null;
}
const blobIdDecimalNorm = (s: string) => s;
