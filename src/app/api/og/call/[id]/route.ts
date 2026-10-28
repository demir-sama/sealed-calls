import { safeLedger } from "@/lib/data";
import { callImage } from "@/lib/og";
import { getCall } from "@/lib/ledger";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await safeLedger();
  const call = await getCall(id).catch(() => undefined);
  if (!call) return new Response("not found", { status: 404 });
  return callImage(call, new URL(req.url).searchParams.get("fmt"));
}
