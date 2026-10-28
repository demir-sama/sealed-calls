"use client";
import { WaxSeal } from "@/components/WaxSeal";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-xl px-5 py-28 text-center">
      <div className="mx-auto w-fit opacity-80"><WaxSeal size={110} tone="black" glyph="!" /></div>
      <h1 className="display mt-8 text-4xl font-semibold">The wax <em className="text-wax-hi">cracked.</em></h1>
      <p className="mt-4 text-dim">Something between us and Walrus or Sui hiccupped. Your sealed calls are safe — try again.</p>
      <p className="mono mt-3 text-xs text-faint">{error.message.slice(0, 140)}</p>
      <button className="btn btn-wax mt-8" onClick={reset}>Try again</button>
    </div>
  );
}
