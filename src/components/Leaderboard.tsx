"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import type { VoiceStats } from "@/lib/types";
import { fmt } from "@/lib/scoring";
import { kindLabel } from "@/lib/format";

export function Leaderboard({ stats, limit, minResolved = 3 }: { stats: VoiceStats[]; limit?: number; minResolved?: number }) {
  const ranked = stats.filter((s) => s.resolved >= minResolved && s.all.brier !== null).sort((a, b) => (a.all.brier! - b.all.brier!));
  const rows = limit ? ranked.slice(0, limit) : ranked;
  const pending = stats.filter((s) => s.resolved < minResolved);
  if (!rows.length) return <p className="text-dim">No voice has {minResolved}+ resolved calls yet.</p>;
  return (
    <div>
      <div role="table" aria-label="Voices ranked by Brier score" className="overflow-hidden rounded-2xl border border-line">
        <div role="row" className="hidden grid-cols-[48px_1.6fr_.7fr_1.6fr_.7fr_.8fr] gap-3 border-b border-line bg-white/[0.03] px-5 py-3 eyebrow !text-dim md:grid">
          <span role="columnheader">#</span><span role="columnheader">Voice</span><span role="columnheader">Resolved</span><span role="columnheader">Brier · lower is better</span><span role="columnheader">Hit rate</span><span role="columnheader">Skill vs coin</span>
        </div>
        {rows.map((s, i) => {
          const b = s.all.brier!;
          const w = Math.min(1, b / 0.5);
          const good = b < 0.25;
          return (
            <motion.div key={s.voice.slug} role="row" initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-30px" }} transition={{ delay: Math.min(i, 8) * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
              <Link href={`/voice/${s.voice.slug}`} className="grid grid-cols-[34px_1fr_auto] items-center gap-x-3 gap-y-2 border-b border-line px-4 py-4 transition-colors last:border-b-0 hover:bg-white/[0.04] md:grid-cols-[48px_1.6fr_.7fr_1.6fr_.7fr_.8fr] md:px-5">
                <span className="display text-2xl italic text-brass" role="cell">{i + 1}</span>
                <span role="cell" className="min-w-0">
                  <span className="display block truncate text-[19px] font-semibold">{s.voice.name}</span>
                  <span className="mono text-[10.5px] text-dim">{kindLabel(s.voice.kind)}{s.voice.sample ? " · sample voice" : ""}</span>
                </span>
                <span role="cell" className="mono text-right text-xs text-dim md:text-left">{s.resolved}<span className="text-faint"> / {s.total}</span></span>
                <span role="cell" className="col-span-3 flex items-center gap-3 md:col-span-1">
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <motion.span className="absolute inset-y-0 left-0 rounded-full" style={{ background: good ? "linear-gradient(90deg,#3f8a70,#74c4a8)" : "linear-gradient(90deg,#8d2d1b,#e2674f)" }} initial={{ width: 0 }} whileInView={{ width: `${(1 - w) * 100 + 4}%` }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.05, duration: 1, ease: [0.16, 1, 0.3, 1] }} />
                  </span>
                  <span className="mono w-14 text-right text-sm font-medium">{fmt.brier(b)}</span>
                </span>
                <span role="cell" className="mono hidden text-sm md:block">{fmt.pct(s.all.hit)}</span>
                <span role="cell" className={`mono hidden text-sm md:block ${(s.all.skill ?? 0) >= 0 ? "text-verdigris" : "text-rust"}`}>{s.all.skill === null ? "—" : `${s.all.skill >= 0 ? "+" : ""}${(s.all.skill * 100).toFixed(0)}%`}</span>
              </Link>
            </motion.div>
          );
        })}
      </div>
      {pending.length > 0 && !limit && <p className="mt-4 text-sm text-dim">{pending.length} more voice{pending.length === 1 ? "" : "s"} {pending.length === 1 ? "needs" : "need"} {minResolved}+ resolved calls to be ranked.</p>}
    </div>
  );
}
