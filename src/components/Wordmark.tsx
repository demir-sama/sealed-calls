import Link from "next/link";
import { WaxSeal } from "./WaxSeal";
export function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-3" aria-label="Callwax home">
      <span className="transition-transform duration-500 group-hover:rotate-[-12deg] group-hover:scale-110" style={{ display: "inline-flex" }}>
        <WaxSeal size={size} ring={false} seed="wordmark" />
      </span>
      <span className="display text-[26px] font-semibold italic" style={{ letterSpacing: "-0.03em" }}>
        Call<span className="text-wax-hi">wax</span>
      </span>
    </Link>
  );
}
