"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { Call } from "@/lib/types";
import { saveLocal } from "@/lib/local";
import { WaxSeal } from "./WaxSeal";

type Phase = 0 | 1 | 2 | 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HEX = "0123456789abcdef";

function ScrambleHash({ final, live }: { final?: string; live: boolean }) {
  const [t, setT] = useState("•".repeat(64));
  useEffect(() => {
    if (!live) { if (final) setT(final); return; }
    const i = setInterval(() => setT(Array.from({ length: 64 }, () => HEX[(Math.random() * 16) | 0]).join("")), 55);
    return () => clearInterval(i);
  }, [live, final]);
  return <code className="mono block break-all text-[11.5px] leading-relaxed text-brass" aria-label={final ? `Hash ${final}` : "Computing hash"}>{t}</code>;
}

export function SealingOverlay({ payload, onClose }: { payload: Record<string, unknown>; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>(0);
  const [call, setCall] = useState<Call | null>(null);
  const [key, setKey] = useState<string | undefined>();
  const [err, setErr] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);
  const dlg = useRef<HTMLDivElement>(null);

  const run = useCallback(async () => {
    setErr(null); setPhase(0); setSlow(false);
    try {
      const [res] = await Promise.all([
        fetch("/api/seal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }),
        sleep(1300),
      ]);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Sealing failed");
      const c: Call = j.call;
      setCall(c); setKey(j.resolverKey);
      saveLocal({ id: c.seal.id, call: c, resolverKey: j.resolverKey, jobId: j.jobId, at: Date.now() });
      setPhase(1);
      await sleep(1500);
      setPhase(2);
      const t0 = Date.now();
      for (;;) {
        await sleep(2500);
        const sr = await fetch(`/api/seal/status?job=${j.jobId}&id=${c.seal.id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
        if (sr?.status === "done") { setCall((p) => (p ? { ...p, sealMeta: { ...p.sealMeta, status: "done", blobId: sr.blob_id } } : p)); break; }
        if (sr?.status === "failed") throw new Error("Walrus rejected the write: " + (sr.error ?? "unknown"));
        if (Date.now() - t0 > 120_000) { setSlow(true); break; }
      }
      setPhase(3);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [payload]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && (phase === 3 || err) && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [phase, err, onClose]);

  useEffect(() => { if (phase === 3) dlg.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [phase]);

  const steps = [
    { t: "Canonicalise & hash", d: "Every field sorted, serialised and SHA-256’d. Change one comma and the hash changes." },
    { t: `Pin Sui checkpoint${call ? " #" + call.seal.anchor.seq.toLocaleString("en-US") : ""}`, d: "Latest mainnet checkpoint, read through the Tatum gateway. The call can’t pre-date it." },
    { t: "Write into Walrus Memory", d: "Encrypted, stored as a Walrus blob owned by the Callwax account, sponsored by the relayer." },
    { t: "Sealed", d: "Receipt issued." },
  ];

  return (
    <motion.div ref={dlg} role="dialog" aria-modal="true" aria-label="Sealing your call" className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="card relative my-8 w-full max-w-xl overflow-hidden p-6 sm:p-9" initial={{ y: 40, scale: 0.97 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 160, damping: 20 }}>
        <div className="relative mx-auto mb-6 grid h-40 w-40 place-items-center">
          {phase === 3 && [0, 1, 2].map((i) => <span key={i} className="absolute inset-4 rounded-full border border-wax-hi/50" style={{ animation: `ripple 1.8s ${i * 0.35}s var(--ease-out) both` }} />)}
          <AnimatePresence mode="popLayout" initial={false}>
            {phase < 3 ? (
              <motion.div key="wait" exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }} className="grid h-28 w-28 place-items-center rounded-full border border-dashed border-brass/50" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 9, ease: "linear" }}>
                <span className="display text-4xl italic text-brass/70">?</span>
              </motion.div>
            ) : (
              <motion.div key="seal" initial={{ opacity: 0, scale: 1.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, ease: [0.2, 0.9, 0.3, 1] }}>
                <WaxSeal seed={call?.seal.hash ?? "x"} size={140} stamp />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {err ? (
          <div role="alert" className="text-center">
            <h2 className="display text-3xl font-semibold text-rust">Couldn’t seal that</h2>
            <p className="mt-3 text-dim">{err}</p>
            <div className="mt-6 flex justify-center gap-3"><button className="btn btn-ghost" onClick={onClose}>Back to the desk</button><button className="btn btn-wax" onClick={() => { started.current = true; run(); }}>Try again</button></div>
          </div>
        ) : (
          <>
            <h2 className="display text-center text-3xl font-semibold sm:text-4xl" aria-live="polite">{phase === 3 ? <>Sealed. <em className="text-wax-hi">It’s on the record.</em></> : "Sealing…"}</h2>
            <ol className="mt-7 space-y-3">
              {steps.slice(0, 3).map((s, i) => {
                const state = phase > i ? "done" : phase === i ? "active" : "todo";
                return (
                  <li key={i} className={`flex gap-4 rounded-xl border p-3.5 transition-colors ${state === "active" ? "border-brass/50 bg-brass/5" : "border-line"} ${state === "todo" ? "opacity-45" : ""}`}>
                    <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${state === "done" ? "bg-verdigris text-ink" : "border border-line mono"}`}>{state === "done" ? "✓" : i + 1}</span>
                    <div className="min-w-0">
                      <div className="font-semibold">{s.t}{state === "active" && <span className="ml-2 inline-block animate-pulse text-brass">…</span>}</div>
                      <div className="text-sm text-dim">{s.d}</div>
                      {i === 0 && <div className="mt-2"><ScrambleHash final={call?.seal.hash} live={phase === 0} /></div>}
                      {i === 1 && call && phase >= 1 && <div className="mono mt-1.5 text-[11px] text-brass">epoch {call.seal.anchor.epoch} · digest {call.seal.anchor.digest.slice(0, 18)}…</div>}
                      {i === 2 && phase === 2 && <div className="mono mt-1.5 text-[11px] text-dim">usually 20–40 s · job accepted by the relayer</div>}
                      {i === 2 && phase === 3 && call?.sealMeta.blobId && <div className="mono mt-1.5 break-all text-[11px] text-brass">blob {call.sealMeta.blobId}</div>}
                      {i === 2 && phase === 3 && slow && <div className="mt-1.5 text-[12px] text-dim">Walrus is still certifying — the seal is queued and will appear on its receipt page.</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
            {phase === 3 && call && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                {key && (
                  <div className="mt-6 rounded-xl border border-wax/50 bg-wax/10 p-4">
                    <div className="eyebrow !text-wax-hi">Resolver key · shown once</div>
                    <p className="mt-2 text-sm text-dim">This call can’t be auto-checked, so only this key can resolve it after the deadline. We store only its hash. Save it now.</p>
                    <div className="mt-3 flex items-center gap-2"><code className="mono flex-1 select-all break-all rounded-lg bg-black/50 px-3 py-2.5 text-sm text-paper">{key}</code><button className="btn btn-ghost !min-h-[42px] !px-4 text-sm" onClick={() => { navigator.clipboard?.writeText(key); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button></div>
                  </div>
                )}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link href={`/call/${call.seal.id}`} className="btn btn-wax">Open the receipt →</Link>
                  <button className="btn btn-ghost" onClick={onClose}>Seal another</button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
