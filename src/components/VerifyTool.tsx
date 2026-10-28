"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Call, SealRecord } from "@/lib/types";
import { canonical, sha256Hex } from "@/lib/canon";
import { VerifyPanel } from "./VerifyPanel";
import { getLocal } from "@/lib/local";

export function VerifyTool() {
  const sp = useSearchParams();
  const router = useRouter();
  const [id, setId] = useState(sp.get("id") ?? "");
  const [call, setCall] = useState<Call | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [raw, setRaw] = useState("");
  const [rawRes, setRawRes] = useState<{ ok: boolean; got: string; want: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (v: string) => {
    const m = v.trim().match(/sc_[0-9a-f]{10}/);
    if (!m) { setErr("Paste a seal id like sc_e756d099ce, or a Callwax call URL."); setCall(null); return; }
    setBusy(true); setErr(null);
    const local = getLocal(m[0]);
    const j = await fetch(`/api/call?id=${m[0]}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (j?.call) { setCall(j.call); router.replace(`/verify?id=${m[0]}`, { scroll: false }); }
    else if (local) { setCall(local.call); }
    else { setCall(null); setErr("That seal isn’t in the ledger (yet)."); }
  };
  useEffect(() => { const q = sp.get("id"); if (q) load(q); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const checkRaw = async () => {
    try {
      const txt = raw.trim().replace(/^SEALED_CALL\s+/, "");
      const rec = JSON.parse(txt) as SealRecord;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _i, hash, ...body } = rec;
      const got = await sha256Hex(canonical(body));
      setRawRes({ ok: got === hash, got, want: hash });
    } catch { setRawRes({ ok: false, got: "not valid JSON", want: "" }); }
  };

  return (
    <div className="space-y-10">
      <div className="card p-5 sm:p-7">
        <label className="label" htmlFor="vid">Seal id or receipt link</label>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); load(id); }}>
          <input id="vid" className="field mono" value={id} onChange={(e) => setId(e.target.value)} placeholder="sc_e756d099ce" autoComplete="off" spellCheck={false} />
          <button className="btn btn-wax shrink-0" disabled={busy}>{busy ? "Looking…" : "Look up"}</button>
        </form>
        {err && <p role="alert" className="mt-3 text-sm text-rust">{err}</p>}
      </div>
      {call && (<div className="space-y-4"><div className="card p-5"><div className="eyebrow">Found</div><p className="display mt-2 text-2xl">“{call.seal.claim}”</p><p className="mt-1 text-sm text-dim">— {call.seal.voice.name}</p></div><VerifyPanel call={call} auto /></div>)}
      <div className="card p-5 sm:p-7">
        <h2 className="eyebrow">Offline check — paste the raw sealed text</h2>
        <p className="mt-2 text-sm text-dim">Got the JSON from someone (or from decrypting the Walrus blob yourself)? Paste it: your browser recomputes SHA-256 over the canonical form without calling us at all.</p>
        <textarea className="field mono mt-4 !text-xs" rows={5} value={raw} onChange={(e) => { setRaw(e.target.value); setRawRes(null); }} placeholder={'SEALED_CALL {"anchor":{…},"claim":"…","hash":"…","id":"sc_…"}'} spellCheck={false} />
        <button className="btn btn-ghost mt-3" onClick={checkRaw} disabled={!raw.trim()}>Recompute hash</button>
        {rawRes && <p role="status" className={`mono mt-4 break-all text-xs ${rawRes.ok ? "text-verdigris" : "text-rust"}`}>{rawRes.ok ? "✓ intact — recomputed hash equals the sealed hash: " + rawRes.got : "✕ mismatch — got " + rawRes.got + (rawRes.want ? " but record says " + rawRes.want : "")}</p>}
      </div>
    </div>
  );
}
