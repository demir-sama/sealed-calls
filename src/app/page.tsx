import Link from "next/link";
import { safeLedger } from "@/lib/data";
import { CallRow } from "@/components/CallRow";
import { Leaderboard } from "@/components/Leaderboard";
import { HeroArt } from "@/components/HeroArt";
import { CountUp, Reveal, SectionTitle } from "@/components/bits";
import { WaxSeal } from "@/components/WaxSeal";
import { verdict } from "@/lib/format";

export const revalidate = 30;

const STEPS = [
  { n: "01", t: "Seal it", d: "Paste a pundit’s hot take, a friend’s bet, or your own call. Pick a rule a stranger could check, a probability and a date. The text is hashed and written into Walrus Memory.", g: "S" },
  { n: "02", t: "Anchor it", d: "Before writing, we pin the newest Sui checkpoint (via Tatum). The call can’t be older than that checkpoint — and the Walrus blob’s own Sui object proves it isn’t newer than its birth.", g: "A" },
  { n: "03", t: "Score it", d: "Onchain, price and match calls resolve themselves from named sources. Everything else is resolved by a key only the sealer holds. Brier score and a calibration curve do the rest.", g: "R" },
];

export default async function Home() {
  const l = await safeLedger();
  const resolved = l.calls.filter((c) => c.resolution);
  const hero = [...resolved].filter((c) => !c.seal.voice.sample || true).sort((a, b) => Date.parse(b.resolution!.resolvedAt) - Date.parse(a.resolution!.resolvedAt)).find((c) => verdict(c) === "held" && c.sealMeta.blobId) ?? resolved[0] ?? l.calls[0];
  const recent = [...l.calls].sort((a, b) => Date.parse(b.seal.sealedAt) - Date.parse(a.seal.sealedAt)).slice(0, 7);
  const memories = l.calls.length + resolved.length;
  return (
    <>
      <section className="relative mx-auto grid max-w-[1240px] items-center gap-12 px-5 pb-8 pt-14 lg:grid-cols-[1.25fr_1fr] lg:pt-20">
        <div>
          <Reveal y={10}><div className="eyebrow mb-6 flex items-center gap-3"><span className="h-px w-10 bg-brass" />A notary for predictions</div></Reveal>
          <h1 className="display text-[clamp(2.9rem,7.6vw,6.4rem)] font-semibold">
            <span className="block overflow-hidden"><span className="block animate-[rise_1s_var(--ease-out)_both]">Make every</span></span>
            <span className="block overflow-hidden"><span className="block animate-[rise_1s_var(--ease-out)_.12s_both]">prediction <em className="text-wax-hi">keep</em></span></span>
            <span className="block overflow-hidden"><span className="block animate-[rise_1s_var(--ease-out)_.24s_both]">its word.</span></span>
          </h1>
          <Reveal delay={0.5}>
            <p className="mt-8 max-w-xl text-lg text-dim sm:text-xl">
              Seal any call — a pundit’s, a friend’s, your own — into <b className="font-semibold text-paper">Walrus Memory</b> with a <b className="font-semibold text-paper">Sui</b> timestamp. Callwax resolves what it can check, scores every voice in public, and hands each one a receipt nobody can quietly rewrite.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/seal" className="btn btn-wax">Seal a call <span aria-hidden>→</span></Link>
              <Link href="/voices" className="btn btn-ghost">See who’s been right</Link>
            </div>
            <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-line pt-6">
              {[
                ["Walrus memories", memories],
                ["Voices tracked", l.stats.length],
                ["Calls resolved", resolved.length],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dd className="display text-4xl font-semibold sm:text-5xl"><CountUp to={v as number} /></dd>
                  <dt className="mono mt-1 text-[10.5px] uppercase tracking-[0.14em] text-dim">{k}</dt>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
        <HeroArt call={hero} />
      </section>

      <div aria-hidden className="mx-auto my-20 max-w-[1240px] overflow-hidden px-5">
        <div className="whitespace-nowrap mono text-[12px] uppercase tracking-[0.35em] text-faint [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)]">
          <div className="inline-block animate-[marquee_50s_linear_infinite]">
            {Array.from({ length: 2 }).map((_, k) => (
              <span key={k}>{["no edits", "deletes leave a trace", "no hindsight", "brier-scored", "sui-anchored", "walrus-sealed", "receipts, not vibes"].map((t) => <span key={t} className="mx-6">✦ {t}</span>)}</span>
            ))}
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-[1240px] px-5">
        <SectionTitle eyebrow="How it works" title={<>Three moves. <em className="text-brass">Zero hindsight.</em></>} sub="A prediction is only worth something if you can prove when it was made and what it said. That is all a seal is." />
        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12}>
              <div className="card relative h-full overflow-hidden p-7">
                <div className="absolute -right-6 -top-6 opacity-[0.16]" aria-hidden><WaxSeal size={140} glyph={s.g} ring={false} seed={"step" + s.n} /></div>
                <div className="mono text-xs text-brass">{s.n}</div>
                <h3 className="display mt-3 text-3xl font-semibold">{s.t}</h3>
                <p className="mt-3 text-dim">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-32 max-w-[1240px] px-5">
        <SectionTitle eyebrow="The public ledger" title={<>Who has actually <em className="text-brass">been right?</em></>} sub={l.stats.some((s) => s.voice.sample) ? "Ranked by Brier score over every resolved call. Voices tagged “sample” are demo personas we seeded with real, verifiable calls — see the About page for how they’re generated." : "Ranked by Brier score over every resolved call."} />
        {l.error && <p className="card mb-6 border-rust/40 p-4 text-sm text-rust">The Walrus ledger is slow to answer right now — showing what we have. ({l.error.slice(0, 120)})</p>}
        <Leaderboard stats={l.stats} limit={6} />
        <div className="mt-6 text-right"><Link href="/voices" className="text-brass hover:underline">All voices →</Link></div>
      </section>

      <section className="mx-auto mt-28 grid max-w-[1240px] gap-10 px-5 lg:grid-cols-[1fr_1.6fr]">
        <Reveal>
          <div className="eyebrow mb-3">Fresh seals</div>
          <h2 className="display text-[clamp(2rem,4vw,3.2rem)] font-semibold">Just <em className="text-wax-hi">sealed.</em></h2>
          <p className="mt-4 max-w-md text-dim">Every row is a memory in Walrus. Open one to watch Callwax re-verify it against Sui and the Walrus aggregator, live.</p>
          <Link href="/seal" className="btn btn-wax mt-8">Make your own call</Link>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="card divide-y divide-line/60 p-2">
            {recent.length ? recent.map((c) => <CallRow key={c.seal.id} call={c} />) : <p className="p-6 text-dim">Nothing sealed yet.</p>}
          </div>
        </Reveal>
      </section>
    </>
  );
}
