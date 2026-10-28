import { Suspense } from "react";
import { VerifyTool } from "@/components/VerifyTool";
export const metadata = { title: "Verify a seal", description: "Recompute a seal’s hash, check its Sui anchor and its Walrus blob — independently of Callwax." };
export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-10 pt-12">
      <div className="eyebrow mb-3">Don’t trust us</div>
      <h1 className="display text-[clamp(2.4rem,5.5vw,4.2rem)] font-semibold">Verify a <em className="text-wax-hi">seal.</em></h1>
      <p className="mb-10 mt-4 text-lg text-dim">Every seal carries a hash, a Sui checkpoint and a Walrus blob. Check all three, live — or recompute the hash offline.</p>
      <Suspense fallback={<div className="skeleton h-40" />}><VerifyTool /></Suspense>
    </div>
  );
}
