import { spotPrice, ASSETS } from "@/lib/oracles";
import { fail, ok } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const symbol = new URL(req.url).searchParams.get("symbol") ?? "BTC";
    if (!ASSETS.some((a) => a.symbol === symbol)) return ok({ error: "unsupported asset" }, { status: 400 });
    return ok(await spotPrice(symbol));
  } catch (e) {
    return fail(e);
  }
}
