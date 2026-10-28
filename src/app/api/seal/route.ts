import { sealCall, sealInput } from "@/lib/ledger";
import { fail, ipOf, ok } from "@/lib/http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    const input = sealInput.parse(await req.json());
    const { call, jobId, resolverKey } = await sealCall({ ...input, admin: undefined, sample: undefined }, ipOf(req));
    return ok({ call, jobId, resolverKey });
  } catch (e) {
    return fail(e);
  }
}
