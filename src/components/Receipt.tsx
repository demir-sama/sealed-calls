import type { Call, VoiceStats } from "@/lib/types";
import { fmt } from "@/lib/scoring";
import { kindLabel, ruleKind, ruleText, shortId, utc, verdict } from "@/lib/format";
import { WaxSeal, type WaxTone } from "./WaxSeal";

export function Barcode({ hash, h = 38 }: { hash: string; h?: number }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; i < Math.min(hash.length, 48); i++) {
    const v = parseInt(hash[i], 16);
    const w = 1 + (v % 4);
    if (i % 2 === 0) bars.push({ x, w });
    x += w + (v > 7 ? 1 : 2);
  }
  return (
    <svg viewBox={`0 0 ${x} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden="true">
      {bars.map((b, i) => <rect key={i} x={b.x} y="0" width={b.w} height={h} fill="#1b140d" />)}
    </svg>
  );
}
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-4"><span className="opacity-60">{k}</span><span className="text-right break-all">{v}</span></div>
);

export const toneOf = (v: ReturnType<typeof verdict>): WaxTone => (v === "held" ? "green" : v === "broke" ? "black" : v === "void" ? "brass" : "red");

export function CallReceipt({ call, draft = false }: { call: Call; draft?: boolean }) {
  const { seal, sealMeta, resolution } = call;
  const v = verdict(call);
  return (
    <article className="receipt relative mx-auto w-full max-w-[420px] px-6 pb-12 pt-8 shadow-2xl" aria-label={draft ? "Draft receipt, not sealed yet" : `Receipt for sealed call ${seal.id}`}>
      {draft && <div aria-hidden className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"><span className="display -rotate-12 border-4 border-[#cf3f26]/70 px-4 py-1 text-5xl font-bold uppercase tracking-widest text-[#cf3f26]/60">Draft</span></div>}
      <div className="flex flex-col items-center text-center">
        <WaxSeal seed={seal.hash} size={96} tone={draft ? "black" : toneOf(v)} stamp={!draft} />
        <div className="mt-3 text-[15px] font-bold tracking-[0.3em]">CALLWAX</div>
        <div className="opacity-60">sealed call · {seal.mode === "backfill" ? "archived (backfill)" : "sealed before the outcome"}</div>
      </div>
      <div className="dash" />
      <div className="text-[15px] font-bold leading-snug">“{seal.claim}”</div>
      <div className="mt-1 opacity-70">— {seal.voice.name} ({kindLabel(seal.voice.kind)}){seal.voice.sample ? " · sample voice" : ""}</div>
      <div className="dash" />
      <Row k="CONFIDENCE" v={<b>{Math.round(seal.p * 100)}% it happens</b>} />
      <Row k="RULE" v={ruleKind(seal.rule)} />
      <div className="mt-1 opacity-80">{ruleText(seal.rule)}</div>
      <Row k="DEADLINE" v={utc(seal.deadline)} />
      <Row k="SEALED" v={utc(seal.sealedAt)} />
      {seal.claimedAt && <Row k="MADE ON" v={utc(seal.claimedAt, false)} />}
      <div className="dash" />
      <Row k="SUI CHECKPOINT" v={`#${seal.anchor.seq.toLocaleString("en-US")}`} />
      <Row k="EPOCH" v={seal.anchor.epoch} />
      <Row k="WALRUS BLOB" v={sealMeta.blobId ? shortId(sealMeta.blobId, 8, 6) : "pending…"} />
      <Row k="SEAL ID" v={seal.id} />
      <div className="dash" />
      <div className="text-center">
        <div className="text-[10px] tracking-[0.25em] opacity-60">{draft ? "NOT SEALED YET" : "OUTCOME"}</div>
        <div className="mt-1 text-[22px] font-bold tracking-wide">
          {draft ? "PREVIEW" : v === "held" ? "CALL HELD" : v === "broke" ? "CALL BROKE" : v === "void" ? "VOID" : v === "due" ? "AWAITING RESOLUTION" : "OPEN"}
        </div>
        {resolution && <div className="opacity-70">{resolution.outcome === "true" ? "claim came true" : resolution.outcome === "false" ? "claim did not come true" : "no outcome"} · {resolution.method.replace("auto:", "auto ")}</div>}
      </div>
      <div className="mt-4"><Barcode hash={seal.hash} /></div>
      <div className="mt-1 text-center text-[9.5px] tracking-wide opacity-60 break-all">sha256 {seal.hash}</div>
    </article>
  );
}

export function VoiceReceipt({ s }: { s: VoiceStats }) {
  const a = s.verified.n > 0 ? s.verified : s.all;
  return (
    <article className="receipt mx-auto w-full max-w-[420px] px-6 pb-12 pt-8 shadow-2xl" aria-label={`Track record receipt for ${s.voice.name}`}>
      <div className="flex flex-col items-center text-center">
        <WaxSeal seed={s.voice.slug} size={84} glyph={s.voice.name.slice(0, 1).toUpperCase()} stamp />
        <div className="mt-3 text-[15px] font-bold tracking-[0.3em]">TRACK RECORD</div>
        <div className="opacity-60">{s.voice.name} · {kindLabel(s.voice.kind)}{s.voice.sample ? " · sample voice" : ""}</div>
      </div>
      <div className="dash" />
      <Row k="SEALED" v={s.total} />
      <Row k="RESOLVED" v={s.resolved} />
      <Row k="OPEN" v={s.open} />
      <div className="dash" />
      <Row k="BRIER (lower=better)" v={<b>{fmt.brier(s.all.brier)}</b>} />
      <Row k="HIT RATE" v={<b>{fmt.pct(s.all.hit)}</b>} />
      <Row k="SKILL vs 50/50" v={<b>{s.all.skill === null ? "—" : (s.all.skill >= 0 ? "+" : "") + (s.all.skill * 100).toFixed(0) + "%"}</b>} />
      {s.verified.n > 0 && s.verified.n !== s.all.n && <Row k="LIVE-SEALED ONLY" v={`${fmt.brier(a.brier)} Brier · n=${a.n}`} />}
      <div className="dash" />
      <div className="text-[10px] tracking-[0.25em] opacity-60">CALIBRATION · SAID → HAPPENED</div>
      <div className="mt-2 space-y-1.5">
        {s.bins.filter((b) => b.n > 0).map((b) => (
          <div key={b.lo} className="flex items-center gap-2">
            <span className="w-14 opacity-70">{Math.round(b.meanP * 100)}%</span>
            <span className="relative h-2.5 flex-1 bg-black/10"><span className="absolute inset-y-0 left-0 bg-[#1b140d]" style={{ width: `${b.freq * 100}%` }} /><span className="absolute -top-0.5 h-3.5 w-[2px] bg-[#cf3f26]" style={{ left: `${b.meanP * 100}%` }} /></span>
            <span className="w-16 text-right">{Math.round(b.freq * 100)}% · n{b.n}</span>
          </div>
        ))}
        {!s.bins.some((b) => b.n > 0) && <div className="opacity-60">nothing resolved yet</div>}
      </div>
      <div className="mt-1 text-[9.5px] opacity-60">red tick = what they said · bar = how often it happened</div>
      <div className="dash" />
      <div className="text-center text-[10px] opacity-60">Every number recomputed from sealed Walrus memories.<br />Unsealed predictions don’t count.</div>
    </article>
  );
}
