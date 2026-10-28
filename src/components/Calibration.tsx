"use client";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import type { CalibrationBin } from "@/lib/types";

/** Reliability diagram: stated probability (x) vs how often it came true (y). Draws itself in when scrolled into view. */
export function Calibration({ bins, height = 300, label = "Calibration curve" }: { bins: CalibrationBin[]; height?: number; label?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const W = 520, H = height, P = { l: 44, r: 16, t: 16, b: 40 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const x = (v: number) => P.l + v * iw;
  const y = (v: number) => P.t + (1 - v) * ih;
  const pts = bins.filter((b) => b.n > 0);
  const path = pts.map((b, i) => `${i ? "L" : "M"} ${x(b.meanP).toFixed(1)} ${y(b.freq).toFixed(1)}`).join(" ");
  const maxN = Math.max(1, ...pts.map((b) => b.n));
  return (
    <figure className="m-0">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${label}. ${pts.length ? pts.map((b) => `Said ${Math.round(b.meanP * 100)} percent, happened ${Math.round(b.freq * 100)} percent over ${b.n} calls.`).join(" ") : "No resolved calls yet."}`}>
        <defs>
          <linearGradient id="calArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c9a45c" stopOpacity="0.28" />
            <stop offset="1" stopColor="#c9a45c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke="rgba(239,230,210,.08)" />
            <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(1)} stroke="rgba(239,230,210,.05)" />
            <text x={P.l - 10} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#8b8270" fontFamily="var(--font-martian)">{Math.round(t * 100)}</text>
            <text x={x(t)} y={H - P.b + 20} textAnchor="middle" fontSize="10" fill="#8b8270" fontFamily="var(--font-martian)">{Math.round(t * 100)}</text>
          </g>
        ))}
        <text x={P.l + iw / 2} y={H - 4} textAnchor="middle" fontSize="10" letterSpacing="1.5" fill="#a79d88" fontFamily="var(--font-martian)">SAID (%)</text>
        <text transform={`translate(12 ${P.t + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize="10" letterSpacing="1.5" fill="#a79d88" fontFamily="var(--font-martian)">HAPPENED (%)</text>
        <motion.line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="#74c4a8" strokeOpacity="0.55" strokeDasharray="5 6" strokeWidth="1.3" initial={{ pathLength: 0 }} animate={inView ? { pathLength: 1 } : {}} transition={{ duration: 1.1, ease: "easeOut" }} />
        <text x={x(0.62)} y={y(0.74)} fontSize="9.5" fill="#74c4a8" fillOpacity="0.8" fontFamily="var(--font-martian)" transform={`rotate(-${(Math.atan(ih / iw) * 180) / Math.PI} ${x(0.62)} ${y(0.74)})`}>perfectly calibrated</text>
        {pts.length > 1 && <motion.path d={`${path} L ${x(pts[pts.length - 1].meanP)} ${y(0)} L ${x(pts[0].meanP)} ${y(0)} Z`} fill="url(#calArea)" initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 1.1, duration: 0.8 }} />}
        {pts.length > 1 && <motion.path d={path} fill="none" stroke="#c9a45c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={inView ? { pathLength: 1 } : {}} transition={{ duration: 1.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }} />}
        {pts.map((b, i) => (
          <motion.g key={i} initial={{ opacity: 0, scale: 0.2 }} animate={inView ? { opacity: 1, scale: 1 } : {}} transition={{ delay: 0.5 + i * 0.22, type: "spring", stiffness: 220, damping: 14 }} style={{ transformOrigin: `${x(b.meanP)}px ${y(b.freq)}px` }}>
            <circle cx={x(b.meanP)} cy={y(b.freq)} r={6 + (b.n / maxN) * 9} fill="#cf3f26" fillOpacity="0.28" />
            <circle cx={x(b.meanP)} cy={y(b.freq)} r="5" fill="#ff6b4a" stroke="#0b0907" strokeWidth="1.5" />
            <text x={x(b.meanP)} y={y(b.freq) - 16} textAnchor="middle" fontSize="9.5" fill="#efe6d2" fontFamily="var(--font-martian)">n={b.n}</text>
          </motion.g>
        ))}
        {!pts.length && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="#8b8270" fontFamily="var(--font-fraunces)" fontStyle="italic">Nothing resolved yet — the curve draws itself once calls land.</text>}
      </svg>
    </figure>
  );
}
