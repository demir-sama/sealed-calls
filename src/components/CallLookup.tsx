"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Call } from "@/lib/types";
import { getLocal } from "@/lib/local";
import { CallView } from "./CallView";
import { WaxSeal } from "./WaxSeal";

/** The ledger hasn't indexed this seal yet (Walrus takes ~30 s). Fall back to this browser's copy, then poll. */
export function CallLookup({ id }: { id: string }) {
  const [call, setCall] = useState<Call | null>(null);
  const [state, setState] = useState<"look" | "missing">("look");
  useEffect(() => {
    let alive = true;
    const local = getLocal(id);
    if (local && alive) setCall(local.call);
    let tries = 0;
    const tick = async () => {
      const j = await fetch(`/api/call?id=${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (!alive) return;
      if (j?.call) { setCall(j.call); return; }
      if (++tries > (local ? 30 : 4)) { if (!local) setState("missing"); return; }
      setTimeout(tick, 4000);
    };
    tick();
    return () => { alive = false; };
  }, [id]);
  if (call) return <CallView initial={call} />;
  return (
    <div className="mx-auto max-w-xl px-5 py-32 text-center">
      <div className="mx-auto w-fit opacity-80"><WaxSeal size={110} tone={state === "missing" ? "black" : "red"} /></div>
      {state === "look" ? (<><h1 className="display mt-8 text-4xl font-semibold">Looking in Walrus…</h1><p className="mt-3 text-dim">Seal <code className="mono text-brass">{id}</code> is still being indexed. This usually takes under a minute.</p></>) : (<><h1 className="display mt-8 text-4xl font-semibold">No such seal</h1><p className="mt-3 text-dim">Nothing in the ledger matches <code className="mono text-brass">{id}</code>.</p><Link href="/voices" className="btn btn-ghost mt-8">Browse the ledger</Link></>)}
    </div>
  );
}
