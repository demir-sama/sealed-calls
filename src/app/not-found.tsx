import Link from "next/link";
import { WaxSeal } from "@/components/WaxSeal";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-28 text-center">
      <div className="mx-auto w-fit opacity-80"><WaxSeal size={110} tone="black" glyph="?" /></div>
      <h1 className="display mt-8 text-5xl font-semibold">Nothing sealed <em className="text-wax-hi">here.</em></h1>
      <p className="mt-4 text-dim">That voice or call isn’t in the ledger. If you just sealed it, Walrus can take up to a minute to index it.</p>
      <div className="mt-8 flex justify-center gap-3"><Link href="/voices" className="btn btn-ghost">All voices</Link><Link href="/seal" className="btn btn-wax">Seal a call</Link></div>
    </div>
  );
}
