"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Cp { seq: number; ts: string; epoch: number; digest: string; totalTransactions: number; tatum?: string }

export function useCheckpoint(every = 9000) {
  const [cp, setCp] = useState<Cp | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    const go = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const r = await fetch("/api/anchor", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const j = await r.json();
        if (alive) { setCp(j); setErr(false); }
      } catch { if (alive) setErr(true); }
    };
    go();
    const t = setInterval(go, every);
    return () => { alive = false; clearInterval(t); };
  }, [every]);
  return { cp, err };
}

export function Ticker() {
  const { cp, err } = useCheckpoint();
  const prev = useRef<number | null>(null);
  useEffect(() => { if (cp) prev.current = cp.seq; }, [cp]);
  return (
    <div className="border-b border-line bg-black/40 backdrop-blur" role="status" aria-live="off">
      <div className="mx-auto flex max-w-[1240px] items-center gap-3 overflow-hidden px-5 py-2 mono text-[11px] tracking-wide text-dim">
        <span className="flex shrink-0 items-center gap-2 text-verdigris">
          <span className="h-1.5 w-1.5 rounded-full bg-verdigris" style={{ animation: "pulse-dot 1.6s infinite" }} />
          SUI MAINNET
        </span>
        <span className="hidden text-faint sm:inline">/</span>
        {cp ? (
          <>
            <span className="shrink-0">checkpoint <AnimatePresence mode="popLayout" initial={false}><motion.b key={cp.seq} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} className="inline-block text-paper tabular-nums">#{cp.seq.toLocaleString("en-US")}</motion.b></AnimatePresence></span>
            <span className="hidden shrink-0 sm:inline">epoch {cp.epoch}</span>
            <span className="hidden shrink-0 md:inline">{cp.totalTransactions.toLocaleString("en-US")} tx</span>
            <span className="hidden shrink-0 lg:inline text-faint">{cp.digest.slice(0, 10)}…</span>
          </>
        ) : (
          <span className="skeleton inline-block h-3 w-44" aria-label={err ? "Sui feed unavailable" : "Loading Sui feed"} />
        )}
        <span className="ml-auto hidden shrink-0 text-faint min-[480px]:inline">{err && !cp ? "feed paused" : "via Tatum gateway"}</span>
      </div>
    </div>
  );
}
