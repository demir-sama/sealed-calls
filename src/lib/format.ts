import type { Call, Rule } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function utc(iso: string, withTime = true) {
  const d = new Date(iso);
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return withTime ? `${base}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC` : base;
}
export function utcShort(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}Z`;
}
export function rel(iso: string, now = Date.now()) {
  const s = Math.round((Date.parse(iso) - now) / 1000);
  const a = Math.abs(s);
  const u = a < 60 ? [a, "s"] : a < 3600 ? [Math.round(a / 60), "m"] : a < 86400 ? [Math.round(a / 3600), "h"] : a < 86400 * 60 ? [Math.round(a / 86400), "d"] : [Math.round(a / (86400 * 30)), "mo"];
  return s >= 0 ? `in ${u[0]}${u[1]}` : `${u[0]}${u[1]} ago`;
}
export const money = (n: number) => (n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : n >= 1 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toPrecision(3));

export function ruleText(r: Rule): string {
  switch (r.type) {
    case "price":
      return `${r.asset}/USD is ${r.op} $${money(r.threshold)} at the deadline`;
    case "sui_metric": {
      const name = r.metric === "epoch" ? "Sui epoch" : r.metric === "total_transactions" ? "Sui total transactions" : "Sui reference gas price (MIST)";
      return `${name} is ${r.op === "at_least" ? "at least" : "below"} ${r.threshold.toLocaleString("en-US")} at the deadline`;
    }
    case "sports":
      return `${r.leagueName}: ${r.pick === "draw" ? "draw" : (r.pick === "home" ? r.home : r.away) + " win"} — ${r.home} v ${r.away}`;
    case "manual":
      return r.rule;
  }
}
export const ruleKind = (r: Rule) => (r.type === "price" ? "Price · Coinbase 1m" : r.type === "sui_metric" ? "Onchain · Sui via Tatum" : r.type === "sports" ? "Match · ESPN final" : "Manual · resolver key");

export type Verdict = "open" | "due" | "held" | "broke" | "void";
/** "held" = the voice's stated side turned out right (p>=.5 & true, or p<.5 & false) */
export function verdict(c: Call, now = Date.now()): Verdict {
  const o = c.resolution?.outcome;
  if (!o) return Date.parse(c.seal.deadline) < now ? "due" : "open";
  if (o === "void") return "void";
  const said = c.seal.p >= 0.5;
  return (o === "true") === said ? "held" : "broke";
}
export const shortId = (s: string, a = 6, b = 4) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);
export const kindLabel = (k: string) => ({ pundit: "Pundit", friend: "Friend", self: "Self", bot: "Bot" })[k] ?? k;
