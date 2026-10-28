import { z } from "zod";
import { resolveManual } from "@/lib/ledger";
import { fail, ok } from "@/lib/http";
export const dynamic = "force-dynamic";
const body = z.object({ id: z.string().regex(/^sc_[0-9a-f]{10}$/), key: z.string().min(6).max(80), outcome: z.enum(["true", "false", "void"]), note: z.string().max(500).optional(), url: z.string().url().max(300).optional() });
export async function POST(req: Request) {
  try {
    const b = body.parse(await req.json());
    const { rec, jobId } = await resolveManual(b.id, b.key, b.outcome, b.note, b.url);
    return ok({ resolution: rec, jobId });
  } catch (e) {
    return fail(e);
  }
}
