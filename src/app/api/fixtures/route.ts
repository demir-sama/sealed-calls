import { fixtures, LEAGUES } from "@/lib/oracles";
import { fail, ok } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const league = u.searchParams.get("league") ?? "";
    const date = u.searchParams.get("date") ?? "";
    if (!LEAGUES.some((l) => l.id === league) || !/^\d{8}$/.test(date)) return ok({ error: "bad league/date" }, { status: 400 });
    return ok({ fixtures: await fixtures(league, date) });
  } catch (e) {
    return fail(e);
  }
}
