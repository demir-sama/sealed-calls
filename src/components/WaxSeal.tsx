"use client";
import { useMemo } from "react";

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}
/** A wax blob whose outline is derived from the seal hash – every seal has its own shape. */
function blob(seed: string, r = 46, cx = 60, cy = 60) {
  const R = rng(seed);
  const n = 22;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.93 + R() * 0.09 + (i % 5 === 0 ? 0.04 : 0));
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as const;
  });
  let d = `M ${(pts[0][0] + pts[n - 1][0]) / 2} ${(pts[0][1] + pts[n - 1][1]) / 2}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    d += ` Q ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`;
  }
  return d + " Z";
}

export type WaxTone = "red" | "green" | "black" | "brass";
const TONES: Record<WaxTone, [string, string, string]> = {
  red: ["#ff6b4a", "#cf3f26", "#6e170a"],
  green: ["#6fd1a8", "#2f8a69", "#103d2e"],
  black: ["#7a736a", "#2e2a26", "#0c0a09"],
  brass: ["#e8c87e", "#b08d46", "#5b4414"],
};

export function WaxSeal({ seed = "callwax", size = 120, tone = "red", stamp = false, glyph = "C", ring = true, className = "" }: { seed?: string; size?: number; tone?: WaxTone; stamp?: boolean; glyph?: string; ring?: boolean; className?: string }) {
  const id = "w" + [...(seed + tone + glyph)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7).toString(36);
  const d = useMemo(() => blob(seed), [seed]);
  const [hi, mid, lo] = TONES[tone];
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} role="img" aria-label={`Wax seal, ${tone}`} style={stamp ? { animation: "stamp 0.9s var(--ease-out) both" } : undefined}>
      <defs>
        <radialGradient id={`g${id}`} cx="38%" cy="32%" r="80%">
          <stop offset="0" stopColor={hi} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={lo} />
        </radialGradient>
        <radialGradient id={`s${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <filter id={`f${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000" floodOpacity="0.55" />
        </filter>
        <path id={`c${id}`} d="M 60 60 m -33 0 a 33 33 0 1 1 66 0 a 33 33 0 1 1 -66 0" />
      </defs>
      <g filter={`url(#f${id})`}>
        <path d={d} fill={`url(#g${id})`} />
        <path d={d} fill={`url(#s${id})`} />
      </g>
      {ring && (
        <>
          <circle cx="60" cy="60" r="38" fill="none" stroke={lo} strokeOpacity="0.55" strokeWidth="1.4" />
          <circle cx="60" cy="60" r="38" fill="none" stroke={hi} strokeOpacity="0.35" strokeWidth="0.8" transform="translate(-.6 -.6)" />
          <circle cx="60" cy="60" r="26.5" fill="none" stroke={lo} strokeOpacity="0.5" strokeWidth="1" />
          <text fontFamily="var(--font-martian)" fontSize="6.2" letterSpacing="2.2" fill={lo} fillOpacity="0.8">
            <textPath href={`#c${id}`} startOffset="0">CALLWAX · SEALED ON WALRUS · SUI ANCHORED · </textPath>
          </text>
        </>
      )}
      <text x="60" y="73" textAnchor="middle" fontFamily="var(--font-fraunces)" fontStyle="italic" fontWeight="700" fontSize="40" fill={lo} fillOpacity="0.75" transform="translate(.7 .9)">{glyph}</text>
      <text x="60" y="73" textAnchor="middle" fontFamily="var(--font-fraunces)" fontStyle="italic" fontWeight="700" fontSize="40" fill={hi} fillOpacity="0.5">{glyph}</text>
      <ellipse cx="44" cy="38" rx="14" ry="6" fill="#fff" fillOpacity="0.16" transform="rotate(-28 44 38)" />
    </svg>
  );
}
