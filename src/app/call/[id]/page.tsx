import type { Metadata } from "next";
import { safeLedger } from "@/lib/data";
import { CallView } from "@/components/CallView";
import { CallLookup } from "@/components/CallLookup";

export const revalidate = 20;
export const dynamicParams = true;
export async function generateStaticParams() { return []; }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const l = await safeLedger();
  const c = l.calls.find((x) => x.seal.id === id);
  const title = c ? `“${c.seal.claim.slice(0, 80)}” — ${c.seal.voice.name}` : `Sealed call ${id}`;
  return { title, openGraph: { title, images: [`/api/og/call/${id}`] }, twitter: { card: "summary_large_image", images: [`/api/og/call/${id}`] } };
}

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await safeLedger();
  const c = l.calls.find((x) => x.seal.id === id);
  return c ? <CallView initial={c} /> : <CallLookup id={id} />;
}
