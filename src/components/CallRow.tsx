import Link from "next/link";
import type { Call } from "@/lib/types";
import { kindLabel, ruleKind, utcShort, verdict, type Verdict } from "@/lib/format";
import { Rel } from "./bits";

export const VerdictChip = ({ v }: { v: Verdict }) => {
  const m = { open: ["chip chip-open", "OPEN"], due: ["chip chip-open", "RESOLVING"], held: ["chip chip-true", "HELD"], broke: ["chip chip-false", "BROKE"], void: ["chip", "VOID"] }[v];
  return <span className={m[0]}>{m[1]}</span>;
};

export function CallRow({ call, showVoice = true }: { call: Call; showVoice?: boolean }) {
  const { seal } = call;
  const v = verdict(call);
  return (
    <Link href={`/call/${seal.id}`} className="group block rounded-2xl border border-transparent px-4 py-4 transition-all hover:border-line hover:bg-white/[0.03] sm:px-5">
      <div className="flex items-start gap-4">
        <div className="mt-1 hidden w-[84px] shrink-0 sm:block"><VerdictChip v={v} /></div>
        <div className="min-w-0 flex-1">
          <p className="display text-[19px] font-medium leading-snug group-hover:text-wax-hi sm:text-[21px]" style={{ letterSpacing: "-0.01em" }}>{seal.claim}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 mono text-[11px] text-dim">
            <span className="sm:hidden"><VerdictChip v={v} /></span>
            {showVoice && <span className="text-paper-2">{seal.voice.name}<span className="text-faint"> · {kindLabel(seal.voice.kind)}</span></span>}
            <span>said {Math.round(seal.p * 100)}%</span>
            <span>{ruleKind(seal.rule)}</span>
            <span className="text-faint">due {utcShort(seal.deadline)} · <Rel iso={seal.deadline} /></span>
          </div>
        </div>
        <span aria-hidden className="mt-2 hidden text-faint transition-transform group-hover:translate-x-1 group-hover:text-paper sm:block">→</span>
      </div>
    </Link>
  );
}
