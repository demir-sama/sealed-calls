import { z } from "zod";
import { recalibrate } from "@/lib/ledger";
import { fail, ok } from "@/lib/http";
export const dynamic = "force-dynamic";
const body = z.object({ voice: z.string().trim().min(1).max(60), p: z.number().min(0.01).max(0.99) });
export async function POST(req: Request) {
  try {
    const b = body.parse(await req.json());
    return ok(await recalibrate(b.voice, b.p));
  } catch (e) {
    return fail(e);
  }
}
