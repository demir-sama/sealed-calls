import { safeLedger } from "@/lib/data";
import { voiceImage } from "@/lib/og";
import { voicesFrom } from "@/lib/ledger";
import { voiceStats } from "@/lib/scoring";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = await safeLedger();
  const e = voicesFrom(l.calls).get(slug);
  if (!e) return new Response("not found", { status: 404 });
  return voiceImage(voiceStats(e.voice, e.calls), new URL(req.url).searchParams.get("fmt"));
}
