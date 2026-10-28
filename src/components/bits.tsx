"use client";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView } from "framer-motion";
import { rel } from "@/lib/format";

export function Rel({ iso }: { iso: string }) {
  const [t, setT] = useState("");
  useEffect(() => {
    setT(rel(iso));
    const i = setInterval(() => setT(rel(iso)), 30_000);
    return () => clearInterval(i);
  }, [iso]);
  return <span suppressHydrationWarning>{t || "\u00a0"}</span>;
}

export function CountUp({ to, decimals = 0, suffix = "" }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => setV(x) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref} className="tabular-nums">{v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

export function Reveal({ children, delay = 0, y = 22, className = "" }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

export function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Reveal className="mb-10 max-w-2xl">
      <div className="eyebrow mb-3">{eyebrow}</div>
      <h2 className="display text-[clamp(2rem,4.2vw,3.4rem)] font-semibold">{title}</h2>
      {sub && <p className="mt-4 text-lg text-dim">{sub}</p>}
    </Reveal>
  );
}
