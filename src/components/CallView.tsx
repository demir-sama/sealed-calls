"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Call, Outcome } from "@/lib/types";
import { CallReceipt } from "./Receipt";
import { VerifyPanel } from "./VerifyPanel";
import { ShareBar } from "./ShareBar";
import { VerdictChip } from "./CallRow";
import { Rel } from "./bits";
import { getLocal } from "@/lib/local";
import { kindLabel, ruleKind, ruleText, shortId, utc, verdict } from "@/lib/format";

function Timeline({ call }: { call: Call }) {
  const { seal, sealMeta, resolution, resolutionMeta } = call;
  const ev = [
    { t: seal.claimedAt ?? seal.sealedAt, h: seal.claimedAt ? "Originally said" : "Sealed", d: seal.claimedAt ? "Date supplied by the archivist — not verifiable." : `Sui checkpoint #${seal.anchor.seq.toLocaleString("en-US")} pinned`, ok: true },
    ...(seal.claimedAt ? [{ t: seal.sealedAt, h: "Archived on Walrus", d: `Anchored to checkpoint #${seal.anchor.seq.toLocaleString("en-US")} — after the outcome was known`, ok: true }] : []),
    { t: sealMeta.createdAt ?? seal.sealedAt, h: "Memory certified", d: sealMeta.blobId ? `Blob ${shortId(sealMeta.blobId, 8, 6)}` : "Writing to Walrus…", ok: !!sealMeta.blobId },
    { t: seal.deadline, h: "Deadline", d: ruleKind(seal.rule), ok: Date.parse(seal.deadline) < Date.now() },
    { t: resolution?.resolvedAt ?? seal.deadline, h: resolution ? `Resolved ${resolution.outcome.toUpperCase()}` : "Resolution", d: resolution ? `${resolution.method.replace("auto:", "auto · ")}${resolutionMeta?.blobId ? " · blob " + shortId(resolutionMeta.blobId, 6, 4) : ""}` : "Pending", ok: !!resolution },
  ];
  return (
    <ol className="relative space-y-5 border-l border-line pl-6">
      {ev.map((e, i) => (
        <li key={i} className="relative">
          <span className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 ${e.ok ? "border-verdigris bg-verdigris/60" : "border-line bg-ink"}`} />
          <div className="mono text-[11px] text-dim">{utc(e.t)}</div>
          <div className="font-semibold">{e.h}</div>
          <div className="text-sm text-dim">{e.d}</div>
        </li>
      ))}
    </ol>
  );
}

function ResolvePanel({ call, onUpdate }: { call: Call; onUpdate: (c: Call) => void }) {
  const manual = call.seal.rule.type === "manual";
  const due = Date.parse(call.seal.deadline) < Date.now();
  const [key, setKey] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("true");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { const l = getLocal(call.seal.id); if (l?.resolverKey) setKey(l.resolverKey); }, [call.seal.id]);
  if (call.resolution) return null;
  const refresh = async () => { const j = await fetch(`/api/call?id=${call.seal.id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null); if (j?.call) onUpdate(j.call); };
  if (!manual) {
    return (
      <div className="card p-5 sm:p-7">
        <h2 className="eyebrow">Resolution</h2>
        <p className="mt-2 text-sm text-dim">{due ? "The deadline has passed. Callwax resolves this automatically from its named source." : "This call resolves itself after its deadline, straight from its public source."}</p>
        {due && <button className="btn btn-wax mt-4 !min-h-[42px] text-sm" disabled={busy} onClick={async () => { setBusy(true); setMsg(null); const j = await fetch("/api/resolve", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})); await refresh(); setBusy(false); setMsg(j.throttled ? "Checked a moment ago — try again shortly." : j.errors?.length ? "Source didn’t answer yet; retry in a minute." : "Checked. If the source is final, the verdict appears here."); }}>{busy ? "Checking sources…" : "Check sources now"}</button>}
        {msg && <p role="status" className="mt-3 text-sm text-brass">{msg}</p>}
      </div>
    );
  }
  return (
    <div className="card p-5 sm:p-7">
      <h2 className="eyebrow">Resolve with your key</h2>
      <p className="mt-2 text-sm text-dim">{due ? "Only the holder of the resolver key can settle this call." : "Opens after the deadline. Only the holder of the resolver key can settle it."}</p>
      <form className="mt-4 grid gap-3" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setMsg(null);
        const r = await fetch("/api/resolve/manual", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: call.seal.id, key, outcome, note: note || undefined, url: url || undefined }) });
        const j = await r.json(); setBusy(false);
        if (!r.ok) return setMsg(j.error ?? "Failed");
        setMsg("Resolution sealed ✓"); await refresh();
      }}>
        <div><label className="label" htmlFor="rk">Resolver key</label><input id="rk" className="field mono" value={key} onChange={(e) => setKey(e.target.value)} placeholder="rk_…" autoComplete="off" /></div>
        <fieldset><legend className="label">Did the claim come true?</legend><div className="flex gap-2">{(["true", "false", "void"] as Outcome[]).map((o) => <label key={o} className={`tab flex-1 cursor-pointer border text-center ${outcome === o ? "!border-paper !bg-paper !text-ink" : "border-line"}`}><input className="sr-only" type="radio" name="o" checked={outcome === o} onChange={() => setOutcome(o)} />{o === "true" ? "Yes" : o === "false" ? "No" : "Void"}</label>)}</div></fieldset>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="rn">Note</label><input id="rn" className="field" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></div><div><label className="label" htmlFor="ru">Evidence link</label><input id="ru" className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div></div>
        <button className="btn btn-wax" disabled={busy || !due || key.length < 6}>{busy ? "Sealing…" : "Seal the resolution"}</button>
      </form>
      {msg && <p role="status" className="mt-3 text-sm text-brass">{msg}</p>}
    </div>
  );
}

export function CallView({ initial }: { initial: Call }) {
  const [call, setCall] = useState(initial);
  const [n, setN] = useState(0);
  const pending = !call.sealMeta.blobId || (call.resolution && call.resolutionMeta?.status !== "done" && !call.resolutionMeta?.blobId);
  useEffect(() => {
    if (!pending || n > 24) return;
    const t = setTimeout(async () => {
      const j = await fetch(`/api/call?id=${call.seal.id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (j?.call) setCall(j.call);
      setN((x) => x + 1);
    }, 5000);
    return () => clearTimeout(t);
  }, [pending, n, call.seal.id]);

  const { seal, resolution } = call;
  const v = verdict(call);
  return (
    <div className="mx-auto max-w-[1240px] px-5 pb-10 pt-10">
      <Link href={`/voice/${seal.voice.slug}`} className="mono text-xs text-dim hover:text-paper">← {seal.voice.name}</Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14">
        <div className="space-y-8">
          <header>
            <div className="flex flex-wrap items-center gap-2"><VerdictChip v={v} /><span className="chip">{kindLabel(seal.voice.kind)}</span>{seal.voice.sample && <span className="chip chip-open">sample voice</span>}{seal.mode === "backfill" && <span className="chip" title="Deadline had already passed when sealed">archived call</span>}{pending && <span className="chip chip-open"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brass" />certifying on Walrus</span>}</div>
            <h1 className="display mt-5 text-[clamp(1.9rem,4.2vw,3.4rem)] font-semibold leading-[1.08]">“{seal.claim}”</h1>
            <p className="mt-4 text-dim">— <Link className="text-paper underline decoration-line underline-offset-4 hover:decoration-brass" href={`/voice/${seal.voice.slug}`}>{seal.voice.name}</Link>, said <b className="text-paper">{Math.round(seal.p * 100)}%</b> likely · due {utc(seal.deadline)} (<Rel iso={seal.deadline} />)</p>
            {seal.source?.url && <p className="mt-2 text-sm"><a className="text-brass underline-offset-4 hover:underline" href={seal.source.url} target="_blank" rel="noopener noreferrer">Source ↗</a>{seal.source.quote && <span className="text-dim"> · “{seal.source.quote}”</span>}</p>}
          </header>

          <div className="card p-5 sm:p-7">
            <h2 className="eyebrow">The rule</h2>
            <p className="display mt-3 text-2xl">{ruleText(seal.rule)}</p>
            <p className="mt-2 text-sm text-dim">{ruleKind(seal.rule)}</p>
            {resolution && (
              <div className="mt-6 rounded-xl border border-line bg-black/30 p-4">
                <div className="flex items-center justify-between"><span className="eyebrow">Resolution</span><span className={`chip ${resolution.outcome === "true" ? "chip-true" : resolution.outcome === "false" ? "chip-false" : ""}`}>{resolution.outcome === "true" ? "CAME TRUE" : resolution.outcome === "false" ? "DID NOT" : "VOID"}</span></div>
                <dl className="mono mt-3 space-y-1.5 text-[12px]">
                  <div className="flex justify-between gap-4"><dt className="text-dim">resolved</dt><dd>{utc(resolution.resolvedAt)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-dim">method</dt><dd>{resolution.method}</dd></div>
                  {Object.entries(resolution.evidence).filter(([k]) => !["probes", "checkpoint"].includes(k)).map(([k, val]) => (
                    <div key={k} className="flex justify-between gap-4"><dt className="text-dim">{k}</dt><dd className="min-w-0 break-all text-right">{typeof val === "string" && /^https?:/.test(val) ? <a className="text-brass underline" href={val} target="_blank" rel="noopener noreferrer">open source ↗</a> : String(typeof val === "object" ? JSON.stringify(val) : val)}</dd></div>
                  ))}
                  {(resolution.evidence.checkpoint as { seq?: number } | undefined)?.seq && <div className="flex justify-between gap-4"><dt className="text-dim">sui checkpoint</dt><dd>#{(resolution.evidence.checkpoint as { seq: number }).seq.toLocaleString("en-US")}</dd></div>}
                  {resolution.note && <div className="flex justify-between gap-4"><dt className="text-dim">note</dt><dd className="text-right">{resolution.note}</dd></div>}
                </dl>
              </div>
            )}
          </div>

          <ResolvePanel call={call} onUpdate={setCall} />
          <VerifyPanel call={call} />
        </div>

        <div className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          <CallReceipt call={call} />
          <div className="flex justify-center"><ShareBar path={`/call/${seal.id}`} image={`/api/og/call/${seal.id}`} label="this call" /></div>
          <div className="card p-5"><h2 className="eyebrow mb-4">Timeline</h2><Timeline call={call} /></div>
        </div>
      </div>
    </div>
  );
}
