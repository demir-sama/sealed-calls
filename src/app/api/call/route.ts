import { getCall } from "@/lib/ledger";
import { fail, ok } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!/^sc_[0-9a-f]{10}$/.test(id)) return ok({ error: "bad id" }, { status: 400 });
    const call = await getCall(id);
    if (!call) return ok({ error: "not found" }, { status: 404 });
    return ok({ call });
  } catch (e) {
    return fail(e);
  }
}
