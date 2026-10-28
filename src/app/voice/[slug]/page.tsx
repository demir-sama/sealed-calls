import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { safeLedger } from "@/lib/data";
import { Calibration } from "@/components/Calibration";
import { CallRow } from "@/components/CallRow";
import { VoiceReceipt } from "@/components/Receipt";
import { CountUp, Reveal } from "@/components/bits";
import { kindLabel, verdict } from "@/lib/format";
import { fmt } from "@/lib/scoring";
import { voicesFrom } from "@/lib/ledger";
import { voiceStats } from "@/lib/scoring";
import { ShareBar } from "@/components/ShareBar";

export const revalidate = 30;
export const dynamicParams = true;
export async function generateStaticParams() { return []; }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = `Track record · ${slug}`;
  return { title: t, openGraph: { title: t, images: [`/api/og/voice/${slug}`] }, twitter: { card: "summary_large_image", images: [`/api/og/voice/${slug}`] } };
}

export default async function VoicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = await safeLedger();
  const entry = voicesFrom(l.calls).get(slug);
  if (!entry) notFound();
  const s = voiceStats(entry.voice, entry.calls);
  const calls = [...entry.calls].sort((a, b) => Date.parse(b.seal.deadline) - Date.parse(a.seal.deadline));
  const open = calls.filter((c) => !c.resolution);
  const done = calls.filter((c) => c.resolution);
  const timeline = [...done].sort((a, b) => Date.parse(a.seal.deadline) - Date.parse(b.seal.deadline));
  const a = s.all;
  const stat = (k: string, v: React.ReactNode, sub?: string) => (
    <div className="card p-5"><div className="mono text-[10.5px] uppercase tracking-[0.14em] text-dim">{k}</div><div className="display mt-2 text-5xl font-semibold">{v}</div>{sub && <div className="mt-1 text-xs text-faint">{sub}</div>}</div>
  );
  return (
    <div className="mx-auto max-w-[1240px] px-5 pb-10 pt-12">
      <Link href="/voices" className="mono text-xs text-dim hover:text-paper">← all voices</Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2"><span className="chip">{kindLabel(s.voice.kind)}</span>{s.voice.sample && <span className="chip chip-open" title="A demo persona seeded with real, verifiable calls">sample voice</span>}</div>
          <h1 className="display mt-4 text-[clamp(2.6rem,6vw,5rem)] font-semibold">{s.voice.name}</h1>
          <p className="mt-2 max-w-xl text-dim">{s.total} sealed · {s.resolved} resolved · {s.open} open. Namespace <code className="mono text-xs text-brass">v.{slug}</code> in Walrus Memory.</p>
        </div>
        <ShareBar path={`/voice/${slug}`} image={`/api/og/voice/${slug}?fmt=receipt`} label={`${s.voice.name}'s track record`} />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stat("Brier score", a.brier === null ? "—" : <CountUp to={a.brier} decimals={3} />, "lower is better · 0.25 = coin flip")}
        {stat("Hit rate", a.hit === null ? "—" : <CountUp to={a.hit * 100} suffix="%" />, "stated side came true")}
        {stat("Skill vs 50/50", a.skill === null ? "—" : <span className={a.skill >= 0 ? "text-verdigris" : "text-rust"}>{a.skill >= 0 ? "+" : ""}<CountUp to={a.skill * 100} suffix="%" /></span>, "improvement over always saying 50%")}
        {stat("Live-sealed", s.verified.n === 0 ? "0" : <CountUp to={s.verified.n} />, s.verified.n ? `Brier ${fmt.brier(s.verified.brier)} on calls sealed before the outcome` : "no live-sealed resolved calls yet")}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Reveal className="card p-5 sm:p-7">
          <div className="flex items-baseline justify-between"><h2 className="eyebrow">Calibration</h2><span className="mono text-[11px] text-faint">dashed = perfect</span></div>
          <p className="mb-3 mt-2 text-sm text-dim">When they say 70%, does it happen 70% of the time? Dots above the dashed line = underconfident; below = overconfident.</p>
          <Calibration bins={s.bins} />
          {timeline.length > 0 && (
            <div className="mt-6">
              <div className="eyebrow mb-3">Streak · oldest → newest</div>
              <div className="flex flex-wrap gap-1.5" role="img" aria-label={`${timeline.filter((c) => verdict(c) === "held").length} held and ${timeline.filter((c) => verdict(c) === "broke").length} broke`}>
                {timeline.map((c) => <Link key={c.seal.id} href={`/call/${c.seal.id}`} title={c.seal.claim} className={`h-5 w-5 rounded-full border transition-transform hover:scale-125 ${verdict(c) === "held" ? "border-verdigris/60 bg-verdigris/70" : verdict(c) === "broke" ? "border-rust/60 bg-rust/70" : "border-line bg-white/10"}`} aria-label={c.seal.claim} />)}
              </div>
            </div>
          )}
        </Reveal>
        <Reveal delay={0.1}><VoiceReceipt s={s} /></Reveal>
      </div>

      <section className="mt-14">
        {open.length > 0 && (<><h2 className="eyebrow mb-3">Open &amp; awaiting resolution</h2><div className="card mb-10 divide-y divide-line/60 p-2">{open.map((c) => <CallRow key={c.seal.id} call={c} showVoice={false} />)}</div></>)}
        {done.length > 0 && (<><h2 className="eyebrow mb-3">Resolved</h2><div className="card divide-y divide-line/60 p-2">{done.map((c) => <CallRow key={c.seal.id} call={c} showVoice={false} />)}</div></>)}
      </section>
    </div>
  );
}
