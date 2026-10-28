import Link from "next/link";
import { Reveal, SectionTitle } from "@/components/bits";

export const metadata = { title: "How it works & honest limits", description: "How Callwax seals, anchors, resolves and scores predictions — and exactly what it can’t prove." };

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="grid gap-1 border-b border-line py-4 last:border-0 sm:grid-cols-[220px_1fr] sm:gap-6"><dt className="mono text-[12px] text-brass">{k}</dt><dd className="text-dim">{v}</dd></div>
);

export default function About() {
  return (
    <div className="mx-auto max-w-[1000px] px-5 pb-10 pt-12">
      <div className="eyebrow mb-3">Under the wax</div>
      <h1 className="display text-[clamp(2.4rem,5.5vw,4.4rem)] font-semibold">How it works — <em className="text-brass">and what it can’t prove.</em></h1>
      <p className="mt-5 max-w-2xl text-lg text-dim">Callwax is a notary, not an oracle of truth. Here is exactly what each piece guarantees, and where you still have to use your judgement.</p>

      <section className="mt-16">
        <SectionTitle eyebrow="Where each tool earns its place" title="Walrus Memory × Tatum" />
        <Reveal>
          <dl className="card px-6 py-2">
            <Row k="remember()" v="Every seal and every resolution is one Walrus Memory write. Seals live in a namespace per voice (v.<slug>), so each voice’s ledger is a self-contained Walrus memory space." />
            <Row k="rememberBulk()" v="Used to archive batches of backfilled and bot calls under the relayer’s rate limit, and to resolve many calls in one request." />
            <Row k="recall()" v="The whole app is built on it: the ledger, leaderboard and every track record are re-derived from recalled memories. Hashes are recomputed on read; a tampered or malformed memory is dropped, never scored." />
            <Row k="Learning loop" v="While you seal, Callwax recalls the voice’s own sealed history and tells you whether your stated confidence matches how often you’ve been right at that level." />
            <Row k="Tatum · Sui gateway" v="Before every write we read the newest Sui checkpoint through the Tatum gateway and bake it into the seal (a ‘not before’ stamp). Onchain calls resolve by reading checkpoints at the deadline. Verification looks up the Walrus Blob object on Sui (a ‘not after’ stamp)." />
            <Row k="Tatum · Data API" v="Wired in as the first-choice price oracle whenever a Tatum API key is present. Without one, price calls fall back to Coinbase’s public candles. The resolution record says which source was used." />
          </dl>
        </Reveal>
      </section>

      <section className="mt-20">
        <SectionTitle eyebrow="The three kinds of proof" title="What a seal actually proves" />
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ["Integrity", "SHA-256 over the canonical JSON of the call. Change one character, the hash and the seal id change. Your browser recomputes it on every call page."],
            ["Not before", "The seal embeds a real Sui mainnet checkpoint (number, digest, timestamp). Nobody could have produced it before that checkpoint existed."],
            ["Not after", "The Walrus blob that stores the seal is a Sui object; its creation checkpoint is a public upper bound. The window between the two is shown on every receipt."],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.1}><div className="card h-full p-6"><h3 className="display text-2xl font-semibold text-brass">{t}</h3><p className="mt-3 text-dim">{d}</p></div></Reveal>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <SectionTitle eyebrow="No hand-waving" title="Honest limits" />
        <Reveal>
          <dl className="card px-6 py-2">
            <Row k="Who said it" v="A seal proves what was sealed and when — not that the named pundit said it. Add a source link or quote; the receipt shows it, but it is the sealer’s claim." />
            <Row k="Walrus privacy" v="Memories are encrypted on Walrus. The public aggregator can prove a blob exists and its size, but only the Callwax account (via the MemWal relayer) can read the contents — so the readable ledger is served by us, with hashes anyone can check against a copy of the text." />
            <Row k="Archived calls" v="You can archive a call whose deadline has passed. It is stamped ‘archived’, shown separately, and excluded from the live-sealed score — a seal made after the outcome can’t prove foresight. The original date is whatever the archivist says." />
            <Row k="Price oracle" v="Coinbase Exchange 1-minute candles: the close of the last candle ending at or before the deadline. Public and reproducible, but one venue. Prices at ‘the deadline’ mean that candle, not an index." />
            <Row k="Match oracle" v="ESPN’s public scoreboard API — unofficial, unauthenticated, could change. Postponed or cancelled matches resolve VOID. Extra-time and penalties follow ESPN’s winner flag." />
            <Row k="Manual calls" v="Resolved by whoever holds the resolver key shown once at sealing. That’s trust in the sealer (usually the person who made the bet); the resolution is sealed too, so reversing it is impossible, but fairness isn’t guaranteed." />
            <Row k="Sample voices" v="The voices tagged ‘sample’ are demo personas we generate with scripts: some archive historical price and match calls decided from public data with no lookahead; others seal live calls. They are labelled everywhere and exist to show the scoring working — they are not real people." />
            <Row k="Deletion & expiry" v="Seal blobs are stored as deletable Walrus blobs owned by the Callwax account, for a fixed number of epochs (the ones we wrote ran to epoch 57, about seven months). We can’t edit one, but the owner key could delete or let one expire — and deletion is a public Sui transaction, so a missing seal is visible rather than silent. Anyone who saved a receipt can still prove its hash and Sui anchor. The storage term is set by the managed MemWal relayer, not by Callwax; a self-hosted relayer could pick a longer one." />
            <Row k="Throughput" v="Walrus writes take 20–40 seconds to land and the managed relayer rate-limits writes, so a call page can briefly say ‘certifying’. The app keeps an in-memory copy until Walrus catches up." />
          </dl>
        </Reveal>
      </section>

      <section className="mt-20">
        <SectionTitle eyebrow="The maths" title="Brier, calibration, skill" />
        <Reveal>
          <div className="card space-y-4 p-6 text-dim">
            <p><b className="text-paper">Brier score</b> = mean of (stated probability − outcome)². A voice that says 90% and is wrong scores 0.81 on that call; 90% and right scores 0.01. A perpetual 50% scores 0.25 — so anything above that is worse than shrugging.</p>
            <p><b className="text-paper">Hit rate</b> counts a call as a hit when the voice’s stated side (≥50% = “happens”) came true. <b className="text-paper">Skill</b> = 1 − Brier/0.25: the improvement over always saying 50%.</p>
            <p><b className="text-paper">Calibration</b> groups calls into five confidence bins and plots what they said against how often it happened. Dots on the dashed diagonal mean their 70% really is 70%.</p>
          </div>
        </Reveal>
      </section>

      <div className="mt-20 text-center">
        <Link href="/seal" className="btn btn-wax">Seal a call</Link>
      </div>
    </div>
  );
}
