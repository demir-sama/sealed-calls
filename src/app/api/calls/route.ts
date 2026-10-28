import { allStats, getLedger } from "@/lib/ledger";
import { fail, ok } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const fresh = new URL(req.url).searchParams.get("fresh") === "1";
    const l = await getLedger({ fresh });
    return ok({ ...l, stats: allStats(l.calls) });
  } catch (e) {
    return fail(e);
  }
}
