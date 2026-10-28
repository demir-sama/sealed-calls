import { resolutionStatus, sealStatus } from "@/lib/ledger";
import { fail, ok } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const job = u.searchParams.get("job") ?? "";
    const id = u.searchParams.get("id") ?? undefined;
    if (!/^[\w-]{8,64}$/.test(job)) return ok({ error: "bad job" }, { status: 400 });
    const kind = u.searchParams.get("kind");
    const s = kind === "resolution" && id ? await resolutionStatus(job, id) : await sealStatus(job, id);
    return ok(s);
  } catch (e) {
    return fail(e);
  }
}
