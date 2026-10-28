import { ASSETS, LEAGUES } from "./catalog";

export interface ParsedClaim {
  kind: "price" | "sui_metric" | "match" | null;
  asset?: string;
  op?: "above" | "below" | "at_least";
  threshold?: number;
  metric?: "epoch" | "total_transactions" | "reference_gas_price";
  deadline?: string; // ISO
  teams?: string[];
  summary: string;
}

const NAMES: Record<string, string> = { bitcoin: "BTC", btc: "BTC", ethereum: "ETH", ether: "ETH", eth: "ETH", solana: "SOL", sol: "SOL", sui: "SUI", xrp: "XRP", ripple: "XRP", dogecoin: "DOGE", doge: "DOGE", cardano: "ADA", ada: "ADA", chainlink: "LINK", link: "LINK", avalanche: "AVAX", avax: "AVAX", litecoin: "LTC", ltc: "LTC" };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parseMoney(s: string): number | null {
  const m = s.match(/\$?\s*(\d[\d,]*(?:\.\d+)?)\s*([kKmMbB])?(?![a-zA-Z])/);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ""));
  const u = m[2]?.toLowerCase();
  if (u === "k") n *= 1e3;
  if (u === "m") n *= 1e6;
  if (u === "b") n *= 1e9;
  return Number.isFinite(n) ? n : null;
}

function findDate(t: string, now = new Date()): string | undefined {
  let m = t.match(/\b(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0)).toISOString();
  m = t.match(new RegExp(`\\b(${MONTHS.join("|")})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`, "i"));
  if (m) {
    const mo = MONTHS.indexOf(m[1].toLowerCase().slice(0, 3));
    let y = m[3] ? +m[3] : now.getUTCFullYear();
    let d = new Date(Date.UTC(y, mo, +m[2], 12, 0));
    if (!m[3] && d.getTime() < now.getTime()) d = new Date(Date.UTC(y + 1, mo, +m[2], 12, 0));
    return d.toISOString();
  }
  m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join("|")})[a-z]*(?:,?\\s+(\\d{4}))?`, "i"));
  if (m) {
    const mo = MONTHS.indexOf(m[2].toLowerCase().slice(0, 3));
    const y = m[3] ? +m[3] : now.getUTCFullYear();
    let d = new Date(Date.UTC(y, mo, +m[1], 12, 0));
    if (!m[3] && d.getTime() < now.getTime()) d = new Date(Date.UTC(y + 1, mo, +m[1], 12, 0));
    return d.toISOString();
  }
  if (/end of (the )?year|by (the )?end of (20\d\d)|eoy/i.test(t)) {
    const y = (t.match(/end of (?:the )?(20\d\d)/i) ?? [])[1];
    return new Date(Date.UTC(y ? +y : now.getUTCFullYear(), 11, 31, 23, 59)).toISOString();
  }
  return undefined;
}

/** Cheap, transparent heuristics (no LLM): spot an auto-checkable shape inside pasted text. */
export function parseClaim(text: string, now = new Date()): ParsedClaim {
  const t = text.trim();
  if (t.length < 8) return { kind: null, summary: "" };
  const low = t.toLowerCase();
  const deadline = findDate(t, now);
  // price
  let asset: string | undefined;
  for (const [k, v] of Object.entries(NAMES)) if (new RegExp(`\\b${k}\\b`, "i").test(t)) { asset = v; break; }
  const dollar = t.match(/\$\s*\d[\d,]*(?:\.\d+)?\s*(?:[kKmMbB](?![a-zA-Z]))?/) ?? t.match(/\b\d[\d,]*(?:\.\d+)?\s*[kK]\b/);
  if (asset && dollar && /(above|over|exceed|hit|reach|top|surpass|break|higher|more than|at least|below|under|drop|fall|crash|lower|less than|dip)/i.test(t)) {
    const down = /(below|under|drop|fall|crash|lower|less than|dip)/i.test(low) && !/(above|over|exceed|reach|surpass|higher|more than)/i.test(low);
    const th = parseMoney(dollar[0]);
    if (th) return { kind: "price", asset, op: down ? "below" : "above", threshold: th, deadline, summary: `${asset} ${down ? "below" : "above"} $${th.toLocaleString("en-US")}${deadline ? "" : " — add a deadline"}` };
  }
  if (/\bsui\b.*\b(epoch|gas price|transactions|tx)\b|\b(epoch|gas price)\b.*\bsui\b/i.test(t)) {
    const metric = /epoch/i.test(t) ? "epoch" : /gas/i.test(t) ? "reference_gas_price" : "total_transactions";
    const num = t.replace(/\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/g, " ").match(/\d[\d,]*(?:\.\d+)?\s*(?:[kKmMbB](?![a-zA-Z]))?(?:\s*(?:billion|million))?/g)?.map((x) => {
      let v = parseMoney(x) ?? NaN;
      if (/billion/i.test(x)) v *= 1e9;
      if (/million/i.test(x)) v *= 1e6;
      return v;
    }).filter((x) => !Number.isNaN(x) && x > 0 && x !== now.getUTCFullYear()).shift();
    if (num) return { kind: "sui_metric", metric, op: /(below|under|drop|fall|less)/i.test(t) ? "below" : "at_least", threshold: num, deadline, summary: `Sui ${metric.replace(/_/g, " ")} ${/(below|under|drop|fall|less)/i.test(t) ? "below" : "at least"} ${num.toLocaleString("en-US")}` };
  }
  // match
  const vs = t.match(/([A-Z][\w.'’-]*(?:\s[A-Z][\w.'’-]*){0,3})\s+(?:will\s+)?(?:beat|defeat|win against|to beat|vs\.?|v\.?|versus)\s+([A-Z][\w.'’-]*(?:\s[A-Z][\w.'’-]*){0,3})/);
  if (vs || /\b(win|beat|defeat|draw|clean sheet|title)\b/i.test(t) && LEAGUES.some((l) => low.includes(l.name.toLowerCase())))
    return { kind: "match", teams: vs ? [vs[1], vs[2]] : undefined, deadline, summary: vs ? `Match call: ${vs[1]} vs ${vs[2]} — pick the fixture` : "Looks like a sports call — pick the fixture" };
  return { kind: null, deadline, summary: "" };
}

export { ASSETS };
