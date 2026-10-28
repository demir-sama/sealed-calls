"use client";
import { useState } from "react";
export function ShareBar({ path, image, label }: { path: string; image: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn btn-ghost !min-h-[42px] !px-4 text-sm" onClick={async () => { await navigator.clipboard?.writeText(location.origin + path); setDone(true); setTimeout(() => setDone(false), 1800); }}>{done ? "Link copied ✓" : "Copy link"}</button>
      <a className="btn btn-wax !min-h-[42px] !px-4 text-sm" href={`${image}?fmt=receipt`} download={`callwax-${label.replace(/\W+/g, "-")}.png`} target="_blank" rel="noopener" aria-label={`Download receipt image: ${label}`}>Receipt image ↓</a>
    </div>
  );
}
