import { getCall } from "@/lib/ledger";
import { verifySealRecord } from "@/lib/canon";
import { checkpointBySeq, findBlobObject, blobIdToDecimal } from "@/lib/sui";
import { aggregatorProbe, ownerAddress, nsOf } from "@/lib/walrus";
import { fail, ok } from "@/lib/http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Independent verification of one seal: hash, Sui anchor (not-before), Walrus blob + Sui Blob object (not-after).
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const call = await getCall(id);
    if (!call) return ok({ error: "No sealed call with that id in the ledger yet." }, { status: 404 });
    const { seal, sealMeta } = call;
    const hash = await verifySealRecord(seal);
    const anchorCp = await checkpointBySeq(seal.anchor.seq).catch(() => null);
    const anchorOk = !!anchorCp && anchorCp.digest === seal.anchor.digest && anchorCp.ts === seal.anchor.ts;
    let agg = null as Awaited<ReturnType<typeof aggregatorProbe>> | null;
    let blob = null as Awaited<ReturnType<typeof findBlobObject>> | null;
    if (sealMeta.blobId) {
      [agg, blob] = await Promise.all([aggregatorProbe(sealMeta.blobId), findBlobObject(ownerAddress(), blobIdToDecimal(sealMeta.blobId)).catch(() => null)]);
    }
    const notAfter = blob?.checkpoint ?? null;
    return ok({
      id,
      namespace: nsOf(seal.voice.slug),
      hash: { ok: hash.ok, stored: seal.hash, recomputed: hash.recomputed },
      anchor: { ok: anchorOk, seq: seal.anchor.seq, digest: seal.anchor.digest, ts: seal.anchor.ts, onChainTs: anchorCp?.ts ?? null, onChainDigest: anchorCp?.digest ?? null },
      walrus: { blobId: sealMeta.blobId ?? null, memoryId: sealMeta.memoryId ?? null, aggregator: agg },
      suiBlob: blob,
      window: notAfter ? { notBefore: seal.anchor.ts, notAfter: notAfter.ts, seconds: Math.round((Date.parse(notAfter.ts) - Date.parse(seal.anchor.ts)) / 1000) } : null,
      resolution: call.resolution ? { hash: call.resolution.hash, blobId: call.resolutionMeta?.blobId ?? null } : null,
    });
  } catch (e) {
    return fail(e);
  }
}
