import Link from "next/link";
import { safeLedger } from "@/lib/data";
import { Leaderboard } from "@/components/Leaderboard";
import { Reveal } from "@/components/bits";
import { kindLabel } from "@/lib/format";

export const revalidate = 30;
export const metadata = { title: "Voices", description: "Every voice sealed into Callwax, ranked by Brier score." };

export default async function Voices() {
  const l = await safeLedger();
  const unranked = l.stats.filter((s) => s.resolved < 3).sort((a, b) => b.total - a.total);
  return (
    <div className="mx-auto max-w-[1240px] px-5 pb-10 pt-12">
      <div className="mb-10 max-w-3xl">
        <div className="eyebrow mb-3">The ledger</div>
        <h1 className="display text-[clamp(2.4rem,5.5vw,4.4rem)] font-semibold">Every voice. <em className="text-brass">Every miss.</em></h1>
        <p className="mt-4 text-lg text-dim">Ranked by Brier score — the mean squared gap between what they said and what happened. 0 is perfect foresight; 0.25 is what a coin-flipper scores; higher is worse than guessing.</p>
      </div>
      <Reveal><Leaderboard stats={l.stats} /></Reveal>
      {unranked.length > 0 && (
        <section className="mt-14">
          <h2 className="eyebrow mb-4">Still building a record</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unranked.map((s) => (
              <Link key={s.voice.slug} href={`/voice/${s.voice.slug}`} className="card flex items-center justify-between p-4 transition-colors hover:border-brass/50">
                <div><div className="display text-xl font-semibold">{s.voice.name}</div><div className="mono text-[11px] text-dim">{kindLabel(s.voice.kind)}{s.voice.sample ? " · sample voice" : ""}</div></div>
                <div className="mono text-right text-xs text-dim"><b className="text-paper">{s.total}</b> sealed<br />{s.resolved} resolved</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
