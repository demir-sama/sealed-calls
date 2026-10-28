"use client";
import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { Call } from "@/lib/types";
import { CallReceipt } from "./Receipt";
import { WaxSeal } from "./WaxSeal";

export function HeroArt({ call }: { call?: Call }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 120, damping: 16 }), sy = useSpring(my, { stiffness: 120, damping: 16 });
  const rx = useTransform(sy, [-0.5, 0.5], [9, -9]);
  const ry = useTransform(sx, [-0.5, 0.5], [-12, 12]);
  return (
    <div
      ref={ref}
      className="relative mx-auto w-full max-w-[420px] [perspective:1100px]"
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => { mx.set(0); my.set(0); }}
    >
      <div aria-hidden className="absolute -inset-x-0 -inset-y-10 sm:-inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(207,63,38,.35),transparent)] blur-2xl" />
      <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }} initial={{ opacity: 0, y: 60, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: -1.5 }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}>
        {call ? (
          <CallReceipt call={call} />
        ) : (
          <div className="receipt px-6 py-16 text-center"><WaxSeal size={90} stamp /><p className="mt-4">The ledger is warming up…</p></div>
        )}
      </motion.div>
    </div>
  );
}
