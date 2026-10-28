import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { Call, VoiceStats } from "./types";
import { kindLabel, ruleKind, ruleText, shortId, utc, verdict, type Verdict } from "./format";
import { fmt } from "./scoring";

const dir = path.join(process.cwd(), "src/assets/fonts");
let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700; style: "normal" | "italic" }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all(
    ([
      ["Fraunces", "fraunces-latin-600-normal.woff", 600, "normal"],
      ["Fraunces", "fraunces-latin-400-italic.woff", 400, "italic"],
      ["Fraunces", "fraunces-latin-600-italic.woff", 600, "italic"],
      ["Mono", "martian-mono-latin-400-normal.woff", 400, "normal"],
      ["Mono", "martian-mono-latin-700-normal.woff", 700, "normal"],
    ] as const).map(async ([name, f, weight, style]) => {
      const b = await readFile(path.join(dir, f));
      return { name, data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, weight, style };
    }),
  );
  return fonts;
}

const C = { ink: "#0c0a09", paper: "#f3ead8", dim: "#a79f93", wax: "#cf3f26", waxHi: "#ff6b4a", brass: "#c9a45c", green: "#4fb58e", line: "#2a2420", cream: "#f1e8d4", brown: "#1b140d" };
const TONE: Record<Verdict, [string, string]> = {
  open: [C.waxHi, "#6e170a"], due: [C.waxHi, "#6e170a"], held: ["#6fd1a8", "#103d2e"], broke: ["#7a736a", "#0c0a09"], void: ["#e8c87e", "#5b4414"],
};
const LABEL: Record<Verdict, string> = { open: "OPEN", due: "AWAITING", held: "CALL HELD", broke: "CALL BROKE", void: "VOID" };

function Seal({ v, size, glyph = "C" }: { v: Verdict; size: number; glyph?: string }) {
  const [hi, lo] = TONE[v];
  return (
    <div style={{ display: "flex", width: size, height: size, borderRadius: size, alignItems: "center", justifyContent: "center", background: `radial-gradient(circle at 36% 30%, ${hi}, ${lo})`, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>
      <div style={{ display: "flex", width: size * 0.72, height: size * 0.72, borderRadius: size, border: "2px solid rgba(0,0,0,.28)", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces", fontStyle: "italic", fontSize: size * 0.42, color: "rgba(0,0,0,.45)" }}>{glyph}</div>
    </div>
  );
}
function Bars({ hash, h = 54 }: { hash: string; h?: number }) {
  const bars: number[] = [];
  for (let i = 0; i < 40; i++) bars.push(1 + (parseInt(hash[i % hash.length], 16) % 4));
  return <div style={{ display: "flex", alignItems: "stretch", height: h, gap: 3 }}>{bars.map((w, i) => <div key={i} style={{ display: "flex", width: w * 2 + 1, background: i % 2 ? "transparent" : C.brown }} />)}</div>;
}
const Row = ({ k, v, s = 22 }: { k: string; v: string; s?: number }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: s, marginTop: 10 }}><span style={{ opacity: 0.55 }}>{k}</span><span style={{ maxWidth: "62%", textAlign: "right" }}>{v}</span></div>
);
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function render(el: React.ReactElement, w: number, h: number) {
  return new ImageResponse(el, { width: w, height: h, fonts: await loadFonts(), headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" } });
}

/* ---------- call ---------- */
export async function callImage(c: Call, fmtName: string | null) {
  const v = verdict(c);
  const { seal } = c;
  const said = Math.round(seal.p * 100);
  const claim = clip(seal.claim, 150);
  if (fmtName === "receipt") {
    return render(
      <div style={{ display: "flex", width: 1080, height: 1620, background: `radial-gradient(circle at 80% 0%, #3a1610, ${C.ink} 55%)`, alignItems: "center", justifyContent: "center", fontFamily: "Mono" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 820, background: C.cream, color: C.brown, padding: "64px 64px 56px", boxShadow: "0 40px 90px rgba(0,0,0,.7)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginTop: -110 }}><Seal v={v} size={130} /></div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 22, fontSize: 30, fontWeight: 700, letterSpacing: 10 }}>CALLWAX</div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 6, fontSize: 18, opacity: 0.55 }}>{`sealed call · ${seal.mode === "backfill" ? "archived" : "sealed before outcome"}`}</div>
          <div style={{ display: "flex", borderTop: `2px dashed ${C.brown}55`, marginTop: 30 }} />
          <div style={{ display: "flex", fontFamily: "Fraunces", fontWeight: 600, fontSize: 46, lineHeight: 1.18, marginTop: 28 }}>{`“${claim}”`}</div>
          <div style={{ display: "flex", fontSize: 22, opacity: 0.6, marginTop: 14 }}>{`— ${seal.voice.name} (${kindLabel(seal.voice.kind)})${seal.voice.sample ? " · sample voice" : ""}`}</div>
          <div style={{ display: "flex", borderTop: `2px dashed ${C.brown}55`, marginTop: 28 }} />
          <Row k="CONFIDENCE" v={`${said}% it happens`} />
          <Row k="RULE" v={clip(ruleText(seal.rule), 70)} />
          <Row k="DEADLINE" v={utc(seal.deadline)} />
          <Row k="SEALED" v={utc(seal.sealedAt)} />
          <div style={{ display: "flex", borderTop: `2px dashed ${C.brown}55`, marginTop: 26 }} />
          <Row k="SUI CHECKPOINT" v={`#${seal.anchor.seq.toLocaleString("en-US")}`} />
          <Row k="WALRUS BLOB" v={c.sealMeta.blobId ? shortId(c.sealMeta.blobId, 8, 6) : "certifying…"} />
          <Row k="SEAL ID" v={seal.id} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 34 }}>
            <div style={{ display: "flex", fontSize: 18, opacity: 0.5, letterSpacing: 6 }}>OUTCOME</div>
            <div style={{ display: "flex", fontFamily: "Fraunces", fontWeight: 600, fontSize: 70, marginTop: 4, color: v === "held" ? "#1f6b4e" : v === "broke" ? "#7a1d0e" : C.brown }}>{LABEL[v]}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}><Bars hash={seal.hash} /></div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 14, fontSize: 15, opacity: 0.5 }}>{`sha256 ${seal.hash.slice(0, 32)}…`}</div>
        </div>
      </div>,
      1080, 1620,
    );
  }
  return render(
    <div style={{ display: "flex", width: 1200, height: 630, background: `radial-gradient(circle at 85% 0%, #43180f, ${C.ink} 60%)`, color: C.paper, padding: 64, fontFamily: "Mono", position: "relative" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, paddingRight: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}><Seal v="open" size={40} /><span style={{ fontFamily: "Fraunces", fontStyle: "italic", fontSize: 34 }}>Callwax</span><span style={{ marginLeft: 12, fontSize: 15, color: C.brass, letterSpacing: 4 }}>SEALED CALL</span></div>
        <div style={{ display: "flex", fontFamily: "Fraunces", fontWeight: 600, fontSize: claim.length > 90 ? 50 : 62, lineHeight: 1.1 }}>{`“${claim}”`}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 22, color: C.dim }}>
          <span>{`${seal.voice.name} · said ${said}% · due ${utc(seal.deadline)}`}</span>
          <span style={{ fontSize: 17 }}>{`anchored to Sui checkpoint #${seal.anchor.seq.toLocaleString("en-US")} · sealed on Walrus`}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 280, gap: 22 }}>
        <Seal v={v} size={190} />
        <div style={{ display: "flex", fontFamily: "Fraunces", fontWeight: 600, fontSize: 40, color: v === "held" ? C.green : v === "broke" ? "#ff8a6e" : C.brass }}>{LABEL[v]}</div>
        <div style={{ display: "flex", fontSize: 15, color: C.dim }}>{ruleKind(seal.rule)}</div>
      </div>
    </div>,
    1200, 630,
  );
}

/* ---------- voice ---------- */
export async function voiceImage(s: VoiceStats, fmtName: string | null) {
  const st = s.verified.n >= 3 ? s.verified : s.all;
  const skill = st.skill === null ? "—" : (st.skill >= 0 ? "+" : "") + Math.round(st.skill * 100) + "%";
  const tone: Verdict = st.brier === null ? "open" : st.brier <= 0.25 ? "held" : "broke";
  const dots = s.bins.filter((b) => b.n > 0);
  const chart = (w: number, h: number, light = false) => {
    const pad = 14, iw = w - pad * 2, ih = h - pad * 2;
    const X = (v: number) => pad + v * iw, Y = (v: number) => pad + (1 - v) * ih;
    const ink = light ? "#1b140d" : "#f3ead8";
    const pts = dots.map((b) => `${X(b.meanP).toFixed(1)},${Y(b.freq).toFixed(1)}`).join(" ");
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ background: light ? "#e8dec6" : "#14100e", border: `1px solid ${light ? "#c9bb99" : C.line}` }}>
        {[0.25, 0.5, 0.75].map((g) => <line key={"h" + g} x1={X(0)} x2={X(1)} y1={Y(g)} y2={Y(g)} stroke={ink} strokeOpacity="0.12" />)}
        {[0.25, 0.5, 0.75].map((g) => <line key={"v" + g} y1={Y(0)} y2={Y(1)} x1={X(g)} x2={X(g)} stroke={ink} strokeOpacity="0.12" />)}
        <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke={ink} strokeOpacity="0.45" strokeDasharray="6 6" />
        {dots.length > 1 && <polyline points={pts} fill="none" stroke={C.brass} strokeWidth="2.5" />}
        {dots.map((b, i) => <circle key={i} cx={X(b.meanP)} cy={Y(b.freq)} r={6 + Math.min(b.n, 12) * 0.9} fill={C.waxHi} stroke={light ? "#e8dec6" : C.ink} strokeWidth="2.5" />)}
      </svg>
    );
  };
  const title = clip(s.voice.name, 26);
  if (fmtName === "receipt") {
    return render(
      <div style={{ display: "flex", width: 1080, height: 1620, background: `radial-gradient(circle at 80% 0%, #3a1610, ${C.ink} 55%)`, alignItems: "center", justifyContent: "center", fontFamily: "Mono" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 820, background: C.cream, color: C.brown, padding: "64px 64px 56px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginTop: -110 }}><Seal v={tone} size={130} glyph={s.voice.name.slice(0, 1).toUpperCase()} /></div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 22, fontSize: 30, fontWeight: 700, letterSpacing: 10 }}>TRACK RECORD</div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 8, fontFamily: "Fraunces", fontWeight: 600, fontSize: 54 }}>{title}</div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 6, fontSize: 18, opacity: 0.55 }}>{`${kindLabel(s.voice.kind)}${s.voice.sample ? " · sample voice" : ""}`}</div>
          <div style={{ display: "flex", borderTop: `2px dashed ${C.brown}55`, marginTop: 30 }} />
          <Row k="SEALED" v={String(s.total)} s={26} />
          <Row k="RESOLVED" v={String(s.resolved)} s={26} />
          <Row k="BRIER (lower=better)" v={fmt.brier(st.brier)} s={26} />
          <Row k="HIT RATE" v={fmt.pct(st.hit)} s={26} />
          <Row k="SKILL VS 50/50" v={skill} s={26} />
          <div style={{ display: "flex", borderTop: `2px dashed ${C.brown}55`, marginTop: 30 }} />
          <div style={{ display: "flex", justifyContent: "center", marginTop: 26 }}>{chart(420, 420, true)}</div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12, fontSize: 16, opacity: 0.55 }}>said % → happened %  ·  dashed = perfect</div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 26 }}><Bars hash={s.voice.slug.padEnd(40, "a").replace(/[^0-9a-f]/g, "7")} /></div>
        </div>
      </div>,
      1080, 1620,
    );
  }
  return render(
    <div style={{ display: "flex", width: 1200, height: 630, background: `radial-gradient(circle at 85% 0%, #43180f, ${C.ink} 60%)`, color: C.paper, padding: 64, fontFamily: "Mono" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}><Seal v="open" size={40} /><span style={{ fontFamily: "Fraunces", fontStyle: "italic", fontSize: 34 }}>Callwax</span><span style={{ marginLeft: 12, fontSize: 15, color: C.brass, letterSpacing: 4 }}>TRACK RECORD</span></div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontFamily: "Fraunces", fontWeight: 600, fontSize: 76, lineHeight: 1.05 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 20, color: C.dim, marginTop: 10 }}>{`${kindLabel(s.voice.kind)}${s.voice.sample ? " · sample voice" : ""} · ${s.resolved} resolved of ${s.total} sealed`}</div>
        </div>
        <div style={{ display: "flex", gap: 44 }}>
          {[["BRIER", fmt.brier(st.brier)], ["HIT RATE", fmt.pct(st.hit)], ["VS COIN-FLIP", skill]].map(([k, val]) => (
            <div key={k} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "Fraunces", fontWeight: 600, fontSize: 58, color: k === "VS COIN-FLIP" && st.skill !== null && st.skill < 0 ? "#ff8a6e" : C.paper }}>{val}</span>
              <span style={{ fontSize: 14, letterSpacing: 4, color: C.brass }}>{k}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 380 }}>{chart(340, 340)}<span style={{ display: "flex", marginTop: 14, fontSize: 14, color: C.dim }}>calibration · said → happened</span></div>
    </div>,
    1200, 630,
  );
}
