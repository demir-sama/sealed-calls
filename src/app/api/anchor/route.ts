import { latestCheckpoint, queueDepth, tatumMode } from "@/lib/sui";
import { fail, ok } from "@/lib/http";
export const dynamic = "force-dynamic";
type Cp = Awaited<ReturnType<typeof latestCheckpoint>>;
let cache: { at: number; v: Cp } | null = null;
let inflight: Promise<Cp> | null = null;
/** Polled by every open tab: one shared in-flight read, 6s cache, and it never queues behind user-initiated work. */
export async function GET() {
  const meta = { via: "tatum-graphql", tatum: tatumMode() };
  try {
    const fresh = cache && Date.now() - cache.at < 6000;
    if (!fresh) {
      if (cache && queueDepth() > 0) return ok({ ...cache.v, ...meta, stale: true });
      inflight ??= latestCheckpoint().finally(() => { inflight = null; });
      cache = { at: Date.now(), v: await inflight };
    }
    return ok({ ...cache!.v, ...meta });
  } catch (e) {
    if (cache) return ok({ ...cache.v, ...meta, stale: true });
    return fail(e);
  }
}
