"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Call } from "@/lib/types";
import { canonical, sha256Hex } from "@/lib/canon";
import { shortId, utc } from "@/lib/format";

interface Report {
  namespace: string;
  hash: { ok: boolean; stored: string; recomputed: string };
  anchor: { ok: boolean; seq: number; digest: string; ts: string; onChainTs: string | null; onChainDigest: string | null };
  walrus: { blobId: string | null; memoryId: string | null; aggregator: { ok: boolean; bytes: number; head: string; url: string; ms: number } | null };
  suiBlob: { objectId: string; blobId: string; size: number; registeredEpoch: number; certifiedEpoch: number | null; endEpoch: number; checkpoint: { seq: number; digest: string; ts: string } | null } | null;
  window: { notBefore: string; notAfter: string; seconds: number } | null;
  resolution: { hash: string; blobId: string | null } | null;
}
type St = "idle" | "run" | "ok" | "warn" | "bad";
interface Item { id: string; title: string; st: St; detail?: React.ReactNode }

const Icon = ({ st }: { st: St }) => st === "ok" ? <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-verdigris text-ink">✓</span> : st === "bad" ? <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rust text-ink">✕</span> : st === "warn" ? <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brass text-ink">!</span> : st === "run" ? <span className="h-7 w-7 shrink-0 animate-spin rounded-full border-2 border-brass border-t-transparent" /> : <span className="h-7 w-7 shrink-0 rounded-full border border-line" />;

export function VerifyPanel({ call, auto = false }: { call: Call; auto?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const ran = useRef(false);
  const { seal, sealMeta } = call;

  const run = useCallback(async () => {
    setBusy(true); setDone(false);
    const base: Item[] = [
      { id: "hash", title: "The text hasn’t changed", st: "run" },
      { id: "anchor", title: "Sui checkpoint exists — the call can’t be older", st: "idle" },
      { id: "walrus", title: "Sealed memory is stored on Walrus", st: "idle" },
      { id: "blob", title: "Walrus blob is registered on Sui — the call can’t be newer", st: "idle" },
    ];
    setItems(base);
    const set = (id: string, patch: Partial<Item>) => setItems((cur) => cur.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    // 1 · recompute in the browser
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _i, hash, ...body } = seal;
    const re = await sha256Hex(canonical(body));
    await new Promise((r) => setTimeout(r, 500));
    set("hash", { st: re === hash ? "ok" : "bad", detail: <><div>Your browser re-hashed the canonical JSON: <code className="mono break-all text-brass">{re.slice(0, 24)}…</code></div><div className="text-faint">{re === hash ? "identical to the sealed hash" : "MISMATCH with " + hash.slice(0, 24)}</div></> });
    set("anchor", { st: "run" });
    let rep: Report | null = null;
    try {
      const r = await fetch(`/api/verify?id=${seal.id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      rep = j;
    } catch (e) {
      set("anchor", { st: "warn", detail: "Server couldn’t finish the Sui/Walrus checks: " + (e instanceof Error ? e.message : e) });
      setBusy(false);
      return;
    }
    const a = rep!.anchor;
    set("anchor", { st: a.ok ? "ok" : "bad", detail: <><div>Checkpoint <b className="mono">#{a.seq.toLocaleString("en-US")}</b> fetched from Sui mainnet via Tatum: digest {a.onChainDigest === a.digest ? "matches" : "DIFFERS"}, timestamp {a.onChainTs ? utc(a.onChainTs) : "—"}.</div><div className="text-faint">Not before: {utc(a.ts)}</div></> });
    await new Promise((r) => setTimeout(r, 350));
    set("walrus", { st: "run" });
    await new Promise((r) => setTimeout(r, 350));
    const w = rep!.walrus;
    if (!w.blobId) set("walrus", { st: "warn", detail: "Still certifying on Walrus — check again in a minute." });
    else if (w.aggregator?.ok) set("walrus", { st: "ok", detail: <><div>Blob <code className="mono break-all text-brass">{w.blobId}</code></div><div className="text-faint">Public aggregator returned {w.aggregator.bytes} bytes in {w.aggregator.ms} ms (encrypted — header {w.aggregator.head.slice(0, 16)}…). Namespace <code className="mono">{rep!.namespace}</code>{w.memoryId ? <>, memory <code className="mono">{shortId(w.memoryId, 8, 6)}</code></> : null}.</div></> });
    else set("walrus", { st: "warn", detail: <>Blob id recorded (<code className="mono">{shortId(w.blobId, 10, 6)}</code>) but the public aggregator didn’t return it just now.</> });
    set("blob", { st: "run" });
    await new Promise((r) => setTimeout(r, 350));
    const b = rep!.suiBlob;
    if (b?.checkpoint) set("blob", { st: "ok", detail: <><div>Sui object <code className="mono break-all text-brass">{b.objectId}</code> — registered epoch {b.registeredEpoch}, certified {b.certifiedEpoch ?? "—"}, stored until epoch {b.endEpoch}.</div><div className="text-faint">Created in checkpoint #{b.checkpoint.seq.toLocaleString("en-US")} at {utc(b.checkpoint.ts)} · not after.</div>{rep!.window && <div className="mt-2 rounded-lg border border-brass/40 bg-brass/10 px-3 py-2 text-paper">Sealed inside a <b>{rep!.window.seconds < 120 ? `${rep!.window.seconds} second` : `${Math.round(rep!.window.seconds / 60)} minute`}</b> window on Sui: {utc(rep!.window.notBefore)} → {utc(rep!.window.notAfter)}</div>}</> });
    else set("blob", { st: "warn", detail: "The Sui Blob object isn’t visible yet (or sits beyond the first 600 objects we scan). The anchor check above still bounds the call from below." });
    setBusy(false); setDone(true);
  }, [seal]);

  useEffect(() => { if (auto && !ran.current && sealMeta.blobId) { ran.current = true; run(); } }, [auto, run, sealMeta.blobId]);

  return (
    <div className="card p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="eyebrow">Independent verification</h2><p className="mt-1 text-sm text-dim">Don’t trust us. Recompute it.</p></div>
        <button className="btn btn-ghost !min-h-[42px] text-sm" onClick={run} disabled={busy}>{busy ? "Checking…" : done ? "Run again" : "Verify now"}</button>
      </div>
      <ol className="mt-5 space-y-3" aria-live="polite">
        {items.length === 0 && (
          <li className="rounded-xl border border-dashed border-line p-5 text-sm text-dim">Runs four checks live: a SHA-256 recompute in <i>your</i> browser, the Sui checkpoint anchor (via Tatum), the Walrus blob on a public aggregator, and the blob’s own Sui object.</li>
        )}
        {items.map((it) => (
          <motion.li key={it.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex gap-4 rounded-xl border border-line p-4">
            <Icon st={it.st} />
            <div className="min-w-0 text-sm"><div className="font-semibold">{it.title}</div>{it.detail && <div className="mt-1.5 space-y-1 text-dim">{it.detail}</div>}</div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
