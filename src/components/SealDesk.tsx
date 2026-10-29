"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ASSETS, LEAGUES } from "@/lib/catalog";
import { parseClaim, type ParsedClaim } from "@/lib/parse";
import { money, ruleText, utc } from "@/lib/format";
import type { Call, Rule, VoiceKind } from "@/lib/types";
import { CallReceipt } from "./Receipt";
import { SealingOverlay } from "./SealingOverlay";
import { useCheckpoint } from "./Ticker";

type Tab = "price" | "sui_metric" | "sports" | "manual";
interface Fx { id: string; league: string; leagueName: string; date: string; home: { name: string }; away: { name: string }; state: string; detail: string }
const KINDS: [VoiceKind, string][] = [["pundit", "A pundit"], ["friend", "A friend"], ["self", "Me"], ["bot", "A model / bot"]];
const TABS: [Tab, string, string][] = [["price", "Crypto price", "auto"], ["sui_metric", "Sui onchain", "auto"], ["sports", "Match result", "auto"], ["manual", "Anything else", "key"]];
const pad = (n: number) => String(n).padStart(2, "0");
const toInput = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
const fromInput = (s: string) => (s ? new Date(s + ":00Z") : null);
const inHours = (h: number) => new Date(Math.ceil((Date.now() + h * 3600_000) / 600_000) * 600_000);
const SPORT_HOURS: Record<string, number> = { "football/nfl": 4.5, "baseball/mlb": 4.5 };

function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-black/30 p-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className="tab" aria-selected={value === v}>{l}</button>
      ))}
    </div>
  );
}

export function SealDesk() {
  const { cp } = useCheckpoint(12000);
  const [voice, setVoice] = useState("");
  const [kind, setKind] = useState<VoiceKind>("pundit");
  const [claim, setClaim] = useState("");
  const [claimAuto, setClaimAuto] = useState(true);
  const [tab, setTab] = useState<Tab>("price");
  const [asset, setAsset] = useState("BTC");
  const [op, setOp] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState("");
  const [spot, setSpot] = useState<{ price: number; time: string; source?: string } | null>(null);
  const [metric, setMetric] = useState<"epoch" | "total_transactions" | "reference_gas_price">("epoch");
  const [mop, setMop] = useState<"at_least" | "below">("at_least");
  const [mth, setMth] = useState("");
  const [league, setLeague] = useState("soccer/eng.1");
  const [day, setDay] = useState(() => new Date(Date.now() + 86400_000).toISOString().slice(0, 10));
  const [fx, setFx] = useState<Fx[] | null>(null);
  const [fxBusy, setFxBusy] = useState(false);
  const [fxErr, setFxErr] = useState<string | null>(null);
  const [pickFx, setPickFx] = useState<Fx | null>(null);
  const [pick, setPick] = useState<"home" | "draw" | "away">("home");
  const [manual, setManual] = useState("");
  const [p, setP] = useState(0.6);
  const [deadline, setDeadline] = useState(() => toInput(inHours(24)));
  const [archive, setArchive] = useState(false);
  const [claimedAt, setClaimedAt] = useState("");
  const [srcUrl, setSrcUrl] = useState("");
  const [quote, setQuote] = useState("");
  const [suggest, setSuggest] = useState<ParsedClaim | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [touched, setTouched] = useState(false);
  const [recal, setRecal] = useState<{ adjusted: number; n: number; right: number; freq: number | null; recalled: number; namespace: string; ms: number; evidence: { id: string; claim: string; p: number; outcome?: string }[] } | null>(null);
  const [recalBusy, setRecalBusy] = useState(false);
  const claimRef = useRef<HTMLTextAreaElement>(null);

  // paste-and-parse: look for an auto-checkable shape in the claim
  useEffect(() => {
    const t = setTimeout(() => {
      const r = parseClaim(claim);
      setSuggest(r.kind ? r : null);
    }, 350);
    return () => clearTimeout(t);
  }, [claim]);

  const applySuggestion = (s: ParsedClaim) => {
    if (s.kind === "price") { setTab("price"); if (s.asset) setAsset(s.asset); if (s.op === "above" || s.op === "below") setOp(s.op); if (s.threshold) setThreshold(String(s.threshold)); }
    if (s.kind === "sui_metric") { setTab("sui_metric"); if (s.metric) setMetric(s.metric); setMop(s.op === "below" ? "below" : "at_least"); if (s.threshold != null) setMth(String(s.threshold)); }
    if (s.kind === "match") setTab("sports");
    if (s.deadline && new Date(s.deadline).getTime() > Date.now()) setDeadline(toInput(new Date(s.deadline)));
    setClaimAuto(false);
  };

  // spot price hint
  useEffect(() => {
    if (tab !== "price") return;
    let alive = true;
    setSpot(null);
    fetch(`/api/spot?symbol=${asset}`).then((r) => r.json()).then((j) => alive && j.price && setSpot(j)).catch(() => {});
    return () => { alive = false; };
  }, [asset, tab]);

  const dlDate = fromInput(deadline);
  const deadlineISO = dlDate && !Number.isNaN(+dlDate) ? dlDate.toISOString() : "";

  const rule: Rule | null = useMemo(() => {
    if (tab === "price") { const t = parseFloat(threshold); return t > 0 ? { type: "price", asset, quote: "USD", op, threshold: t } : null; }
    if (tab === "sui_metric") { const t = parseFloat(mth); return Number.isFinite(t) && t >= 0 && mth !== "" ? { type: "sui_metric", metric, op: mop, threshold: t } : null; }
    if (tab === "sports") return pickFx ? { type: "sports", league: pickFx.league, leagueName: pickFx.leagueName, eventId: pickFx.id, home: pickFx.home.name, away: pickFx.away.name, pick, kickoff: pickFx.date } : null;
    return manual.trim().length >= 8 ? { type: "manual", rule: manual.trim() } : null;
  }, [tab, asset, op, threshold, metric, mop, mth, pickFx, pick, manual]);

  // sports: deadline follows the fixture
  useEffect(() => {
    if (tab === "sports" && pickFx) setDeadline(toInput(new Date(new Date(pickFx.date).getTime() + (SPORT_HOURS[pickFx.league] ?? 3) * 3600_000)));
  }, [pickFx, tab]);

  // auto-composed claim text until the user writes their own
  useEffect(() => {
    if (!claimAuto || !rule || !deadlineISO) return;
    const when = utc(deadlineISO);
    const txt = rule.type === "price" ? `${asset} will be ${op} $${money(rule.threshold)} at ${when}`
      : rule.type === "sui_metric" ? `Sui ${metric === "epoch" ? "epoch" : metric === "total_transactions" ? "total transactions" : "reference gas price"} will be ${mop === "at_least" ? "at least" : "below"} ${rule.threshold.toLocaleString("en-US")} at ${when}`
      : rule.type === "sports" ? `${pick === "draw" ? "Draw" : pick === "home" ? rule.home : rule.away}${pick === "draw" ? " in" : " win:"} ${rule.home} v ${rule.away} (${rule.leagueName})`
      : "";
    if (txt) setClaim(txt.slice(0, 280));
  }, [rule, claimAuto, deadlineISO, asset, op, metric, mop, pick]);

  const loadFixtures = useCallback(async () => {
    setFxBusy(true); setFxErr(null); setPickFx(null);
    try {
      const r = await fetch(`/api/fixtures?league=${encodeURIComponent(league)}&date=${day.replace(/-/g, "")}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn’t load fixtures");
      setFx((j.fixtures as Fx[]).filter((f) => f.state === "pre"));
    } catch (e) { setFxErr(e instanceof Error ? e.message : String(e)); setFx(null); }
    finally { setFxBusy(false); }
  }, [league, day]);

  // learning loop: recall this voice's sealed history from Walrus and recalibrate the stated probability
  useEffect(() => {
    const name = voice.trim();
    if (name.length < 2) { setRecal(null); return; }
    const t = setTimeout(async () => {
      setRecalBusy(true);
      try {
        const r = await fetch("/api/recalibrate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ voice: name, p }) });
        const j = await r.json();
        if (r.ok) setRecal(j); else setRecal(null);
      } catch { setRecal(null); } finally { setRecalBusy(false); }
    }, 900);
    return () => clearTimeout(t);
  }, [voice, p]);

  const nowMs = Date.now();
  const past = !!deadlineISO && Date.parse(deadlineISO) <= nowMs + 2 * 60_000;
  const problems: string[] = [];
  if (!voice.trim()) problems.push("Whose call is this?");
  if (claim.trim().length < 8) problems.push("Write or paste the prediction (8+ characters).");
  if (!rule) problems.push(tab === "sports" ? "Pick a fixture." : tab === "manual" ? "Say how the call will be judged (8+ characters)." : "Complete the rule above.");
  if (!deadlineISO) problems.push("Set a deadline.");
  else if (!archive && past) problems.push("The deadline must be in the future — or switch on “archive an older call”.");
  if (archive && !past) problems.push("Archived calls need a deadline that has already passed.");
  if (archive && !claimedAt) problems.push("When did they originally make this call?");
  if (archive && tab === "manual") problems.push("Archived calls must use an auto-checkable rule.");
  if (srcUrl && !/^https?:\/\/\S+\.\S+/.test(srcUrl)) problems.push("Source link must start with http(s)://");
  const valid = problems.length === 0;

  const draft: Call | null = useMemo(() => {
    if (!rule || !cp) return null;
    return {
      seal: {
        v: 1, id: "sc_" + "0".repeat(10), hash: "0".repeat(64), nonce: "", p: Math.round(p * 100) / 100, claim: claim || "Your prediction appears here…",
        voice: { slug: "draft", name: voice.trim() || "Someone", kind }, rule, deadline: deadlineISO || new Date().toISOString(), sealedAt: new Date().toISOString(), mode: archive ? "backfill" : "live",
        anchor: { chain: "sui:mainnet", seq: cp.seq, digest: cp.digest, ts: cp.ts, epoch: cp.epoch, via: "tatum-graphql" },
        ...(archive && claimedAt ? { claimedAt: new Date(claimedAt).toISOString() } : {}),
      },
      sealMeta: { status: "pending" },
    };
  }, [rule, cp, p, claim, voice, kind, deadlineISO, archive, claimedAt]);

  const submit = () => {
    setTouched(true);
    if (!valid || !rule) return;
    setPayload({
      voice: { name: voice.trim(), kind },
      claim: claim.trim(), rule, p, deadline: deadlineISO,
      ...(archive ? { claimedAt: new Date(claimedAt + "T12:00:00Z").toISOString() } : {}),
      ...(srcUrl || quote ? { source: { ...(srcUrl ? { url: srcUrl } : {}), ...(quote ? { quote: quote.slice(0, 400) } : {}) } } : {}),
    });
  };

  const pc = Math.round(p * 100);
  const chips: [string, () => void][] = [["+1 h", () => setDeadline(toInput(inHours(1)))], ["+24 h", () => setDeadline(toInput(inHours(24)))], ["+7 days", () => setDeadline(toInput(inHours(24 * 7)))], ["Month end", () => { const d = new Date(); setDeadline(toInput(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59)))); }], ["Year end", () => setDeadline(toInput(new Date(Date.UTC(new Date().getUTCFullYear(), 11, 31, 23, 59))))]];

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
          {/* 1 voice */}
          <section className="card space-y-5 p-5 sm:p-7" aria-labelledby="s1">
            <h2 id="s1" className="eyebrow">1 · Whose call is this?</h2>
            <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
              <div>
                <label className="label" htmlFor="voice">Name or handle</label>
                <input id="voice" className="field" placeholder="e.g. Skeptical Sam, @macro_maven, Me" value={voice} onChange={(e) => setVoice(e.target.value)} maxLength={60} autoComplete="off" />
              </div>
              <div>
                <span className="label" id="kindl">They are</span>
                <Seg<VoiceKind> label="Kind of voice" value={kind} onChange={setKind} options={KINDS} />
              </div>
            </div>
          </section>

          {/* 2 claim */}
          <section className="card space-y-4 p-5 sm:p-7" aria-labelledby="s2">
            <h2 id="s2" className="eyebrow">2 · The prediction, in their words</h2>
            <div>
              <label className="label" htmlFor="claim">Paste it or write it <span className="text-faint">· {claim.length}/280</span></label>
              <textarea id="claim" ref={claimRef} className="field display !text-[20px] !leading-snug" rows={3} maxLength={280} placeholder="“Bitcoin will hit $150k by Dec 31, 2026.”  — paste a tweet, a quote, a bet…" value={claim} onChange={(e) => { setClaim(e.target.value); setClaimAuto(false); }} />
            </div>
            <AnimatePresence>
              {suggest && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brass/40 bg-brass/[0.07] px-4 py-3 text-sm">
                    <span aria-hidden>✦</span>
                    <span className="flex-1 text-paper-2">Looks auto-checkable: <b>{suggest.summary}</b></span>
                    <button type="button" className="btn btn-ghost !min-h-[38px] !px-4 text-sm" onClick={() => applySuggestion(suggest)}>Fill the rule</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <details className="group text-sm text-dim">
              <summary className="cursor-pointer select-none py-1 hover:text-paper">+ Add the source (link or quote)</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="src">Link</label><input id="src" className="field" inputMode="url" placeholder="https://…" value={srcUrl} onChange={(e) => setSrcUrl(e.target.value)} /></div>
                <div><label className="label" htmlFor="quote">Exact quote</label><input id="quote" className="field" maxLength={400} placeholder="Verbatim, if you have it" value={quote} onChange={(e) => setQuote(e.target.value)} /></div>
              </div>
            </details>
          </section>

          {/* 3 rule */}
          <section className="card space-y-5 p-5 sm:p-7" aria-labelledby="s3">
            <h2 id="s3" className="eyebrow">3 · How will anyone know who was right?</h2>
            <div role="tablist" aria-label="Resolution rule" className="flex flex-wrap gap-1.5">
              {TABS.map(([t, l, badge]) => (
                <button key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`} onClick={() => setTab(t)} className="tab border-line" style={tab !== t ? { border: "1px solid var(--line)" } : undefined}>
                  {l} <span className={`mono ml-1 text-[9px] uppercase tracking-wider ${tab === t ? "opacity-60" : "text-brass"}`}>{badge === "auto" ? "auto-resolves" : "your key"}</span>
                </button>
              ))}
            </div>

            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-h-[148px]">
              {tab === "price" && (
                <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1.3fr]">
                  <div><label className="label" htmlFor="asset">Asset</label><select id="asset" className="field" value={asset} onChange={(e) => setAsset(e.target.value)}>{ASSETS.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol} · {a.name}</option>)}</select></div>
                  <div><span className="label">At the deadline it’s</span><Seg<"above" | "below"> label="Direction" value={op} onChange={setOp} options={[["above", "Above"], ["below", "Below"]]} /></div>
                  <div><label className="label" htmlFor="th">Price (USD)</label><input id="th" className="field mono" inputMode="decimal" placeholder={spot ? money(spot.price) : "100000"} value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/[^\d.]/g, ""))} /></div>
                  <p className="text-sm text-dim sm:col-span-3">
                    {spot ? <>Spot now: <button type="button" className="mono text-brass underline decoration-dotted underline-offset-4" onClick={() => setThreshold(String(spot.price))}>${money(spot.price)}</button> ({spot.source?.startsWith("tatum") ? "Tatum" : "Coinbase"}). </> : <span className="skeleton inline-block h-3 w-40 align-middle" />}
                    Resolved from Tatum’s rate if checked within five minutes of the deadline, otherwise from the close of the last Coinbase 1-minute candle at the deadline (public and reproducible).
                  </p>
                </div>
              )}
              {tab === "sui_metric" && (
                <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr_1fr]">
                  <div><label className="label" htmlFor="metric">Sui mainnet metric</label><select id="metric" className="field" value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)}><option value="epoch">Epoch number</option><option value="total_transactions">Total transactions</option><option value="reference_gas_price">Reference gas price (MIST)</option></select></div>
                  <div><span className="label">At the deadline it’s</span><Seg<"at_least" | "below"> label="Comparison" value={mop} onChange={setMop} options={[["at_least", "At least"], ["below", "Below"]]} /></div>
                  <div><label className="label" htmlFor="mth">Value</label><input id="mth" className="field mono" inputMode="numeric" value={mth} onChange={(e) => setMth(e.target.value.replace(/[^\d.]/g, ""))} placeholder={cp ? String(metric === "epoch" ? cp.epoch + 3 : metric === "total_transactions" ? cp.totalTransactions : 1000) : ""} /></div>
                  <p className="text-sm text-dim sm:col-span-3">{cp ? <>Now: epoch <b className="mono text-paper">{cp.epoch}</b> · <b className="mono text-paper">{cp.totalTransactions.toLocaleString("en-US")}</b> tx. </> : null}Resolved by reading the last Sui checkpoint at or before the deadline through the Tatum gateway — the chain itself is the oracle.</p>
                </div>
              )}
              {tab === "sports" && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end">
                    <div><label className="label" htmlFor="league">Competition</label><select id="league" className="field" value={league} onChange={(e) => { setLeague(e.target.value); setFx(null); setPickFx(null); }}>{LEAGUES.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.sport}</option>)}</select></div>
                    <div><label className="label" htmlFor="day">Match day (UTC)</label><input id="day" type="date" className="field" value={day} onChange={(e) => setDay(e.target.value)} /></div>
                    <button type="button" className="btn btn-ghost" onClick={loadFixtures} disabled={fxBusy}>{fxBusy ? "Loading…" : "Find fixtures"}</button>
                  </div>
                  {fxErr && <p role="alert" className="text-sm text-rust">{fxErr}</p>}
                  {fx && fx.length === 0 && <p className="text-sm text-dim">No upcoming fixtures that day. Try another date.</p>}
                  {fx && fx.length > 0 && (
                    <div role="radiogroup" aria-label="Fixture" className="grid max-h-60 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {fx.map((f) => (
                        <button key={f.id} type="button" role="radio" aria-checked={pickFx?.id === f.id} onClick={() => setPickFx(f)} className={`rounded-xl border p-3 text-left transition-all ${pickFx?.id === f.id ? "border-brass bg-brass/10" : "border-line hover:border-paper-dim"}`}>
                          <div className="font-semibold leading-tight">{f.home.name} <span className="text-faint">v</span> {f.away.name}</div>
                          <div className="mono mt-1 text-[11px] text-dim">{utc(f.date)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {pickFx && (
                    <div>
                      <span className="label">The call is</span>
                      <Seg<"home" | "draw" | "away"> label="Pick" value={pick} onChange={setPick} options={[["home", `${pickFx.home.name} win`], ...(LEAGUES.find((l) => l.id === pickFx.league)?.draw ? ([["draw", "Draw"]] as [("draw"), string][]) : []), ["away", `${pickFx.away.name} win`]] as ["home" | "draw" | "away", string][]} />
                    </div>
                  )}
                  <p className="text-sm text-dim">Resolved from the final score on ESPN’s public scoreboard. Deadline is set a few hours after kickoff automatically.</p>
                </div>
              )}
              {tab === "manual" && (
                <div>
                  <label className="label" htmlFor="manual">The resolution rule — written so a stranger could judge it</label>
                  <textarea id="manual" className="field" rows={3} maxLength={400} placeholder="Resolves TRUE if the senator announces her resignation before the deadline, per Reuters or AP." value={manual} onChange={(e) => setManual(e.target.value)} />
                  <p className="mt-2 text-sm text-dim">Callwax can’t check this by itself. You’ll get a one-time <b className="text-paper">resolver key</b> after sealing; only it can resolve the call, and the resolution is sealed with a note and optional evidence link.</p>
                </div>
              )}
            </div>
          </section>

          {/* 4 probability + deadline */}
          <section className="card space-y-6 p-5 sm:p-7" aria-labelledby="s4">
            <h2 id="s4" className="eyebrow">4 · How sure, and by when?</h2>
            <div>
              <div className="flex items-end justify-between"><label className="label !mb-0" htmlFor="p">Chance it happens</label><div className="display text-6xl font-semibold tabular-nums text-wax-hi">{pc}<span className="text-3xl text-dim">%</span></div></div>
              <input id="p" type="range" min={1} max={99} value={pc} onChange={(e) => setP(Number(e.target.value) / 100)} aria-valuetext={`${pc} percent`} />
              <div className="mono flex justify-between text-[10px] uppercase tracking-widest text-faint"><span>No way</span><span>Coin flip</span><span>Certain</span></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1.2fr_2fr] sm:items-end">
              <div><label className="label" htmlFor="deadline">Deadline (UTC)</label><input id="deadline" type="datetime-local" className="field mono" value={deadline} onChange={(e) => setDeadline(e.target.value)} readOnly={tab === "sports" && !!pickFx} /></div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Deadline shortcuts">{chips.map(([l, f]) => <button key={l} type="button" className="chip hover:border-brass hover:text-paper disabled:opacity-40" onClick={f} disabled={tab === "sports" && !!pickFx}>{l}</button>)}</div>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#cf3f26]" checked={archive} onChange={(e) => { setArchive(e.target.checked); if (e.target.checked) setDeadline(toInput(new Date(Date.now() - 3600_000 * 6))); else setDeadline(toInput(inHours(24))); }} />
              <span><b className="text-paper">Archive an older call</b> <span className="text-dim">— someone already made this prediction and its deadline has passed. We’ll resolve it immediately, but it is stamped <i>archived</i> and counted separately from live-sealed calls: you can’t un-ring a bell.</span></span>
            </label>
            {archive && <div><label className="label" htmlFor="claimedAt">When did they make the call?</label><input id="claimedAt" type="date" className="field mono max-w-xs" value={claimedAt} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setClaimedAt(e.target.value)} /></div>}
          </section>

          <div className="space-y-3">
            {touched && !valid && (
              <ul role="alert" className="rounded-xl border border-rust/40 bg-rust/10 p-4 text-sm text-rust">{problems.map((x) => <li key={x}>• {x}</li>)}</ul>
            )}
            <button type="submit" className="btn btn-wax w-full !py-4 text-lg" aria-disabled={!valid}>
              <span aria-hidden>◉</span> Seal it into Walrus
            </button>
            <p className="text-center text-xs text-faint">Public by design. A sealed call can’t be edited — change one character and the hash breaks. Walrus stores it for about seven months.</p>
          </div>
        </form>

        {/* right rail */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="eyebrow">Live preview</div>
          {draft ? <CallReceipt call={draft} draft /> : <div className="receipt mx-auto max-w-[420px] px-6 py-24 text-center"><div className="display text-2xl italic opacity-70">Fill in the rule<br />to see the receipt form.</div></div>}
          {draft && <p className="text-center text-xs text-faint">{ruleText(draft.seal.rule)}</p>}

          <div className="card p-5">
            <div className="flex items-center justify-between"><span className="eyebrow">Recall · learning loop</span>{recalBusy && <span className="mono text-[10px] text-brass">recalling…</span>}</div>
            {!voice.trim() ? (
              <p className="mt-3 text-sm text-dim">Enter a voice and Callwax recalls their sealed history from Walrus Memory, then tells you whether your stated confidence is believable.</p>
            ) : recal ? (
              recal.n === 0 ? (
                <p className="mt-3 text-sm text-dim">No resolved calls near {pc}% for <b className="text-paper">{voice.trim()}</b> yet{recal.recalled ? ` (recalled ${recal.recalled} memories)` : " — a fresh namespace"}. Your seals here set the baseline.</p>
              ) : (
                <div className="mt-3 space-y-3 text-sm">
                  <p className="text-dim">When <b className="text-paper">{voice.trim()}</b> says about {pc}%, it has come out right <b className="text-paper">{recal.right}/{recal.n}</b> times ({Math.round((recal.freq ?? 0) * 100)}%).</p>
                  <div className="flex items-center gap-4"><div><div className="mono text-[10px] uppercase tracking-widest text-faint">Stated</div><div className="display text-3xl">{pc}%</div></div><span aria-hidden className="text-2xl text-brass">→</span><div><div className="mono text-[10px] uppercase tracking-widest text-faint">Track-record adjusted</div><div className={`display text-3xl ${Math.abs(recal.adjusted - p) > 0.05 ? "text-wax-hi" : "text-verdigris"}`}>{Math.round(recal.adjusted * 100)}%</div></div></div>
                  <button type="button" className="btn btn-ghost !min-h-[38px] !px-4 text-sm" onClick={() => setP(Math.min(0.99, Math.max(0.01, recal.adjusted)))}>Use {Math.round(recal.adjusted * 100)}%</button>
                  <div className="mono text-[10px] text-faint">recall({`"${recal.namespace}"`}) · {recal.recalled} memories · {recal.ms} ms</div>
                </div>
              )
            ) : <p className="mt-3 text-sm text-dim">Waiting for Walrus…</p>}
          </div>
        </aside>
      </div>
      <AnimatePresence>{payload && <SealingOverlay payload={payload} onClose={() => { setPayload(null); }} />}</AnimatePresence>
    </>
  );
}
