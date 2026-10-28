import { resolveDue } from "@/lib/ledger";
import { fail, ok } from "@/lib/http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
let last = 0;
// GET: Vercel cron (Bearer CRON_SECRET) or a public "check now" throttled to once / 20s per instance.
export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization");
    const cron = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
    if (!cron) {
      if (Date.now() - last < 20_000) return ok({ checked: 0, resolved: [], errors: [], throttled: true });
    }
    last = Date.now();
    return ok(await resolveDue(cron ? 12 : 4));
  } catch (e) {
    return fail(e);
  }
}
