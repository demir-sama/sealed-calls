/** Canonical JSON (sorted keys, no whitespace) + SHA-256. Works in Node and the browser. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") + "}";
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomHex(bytes = 8): string {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

import type { SealBody, SealRecord, ResolutionBody, ResolutionRecord } from "./types";

/** hash = sha256(canonical(body)); id = "sc_" + first 10 hex of hash */
export async function sealFromBody(body: SealBody): Promise<SealRecord> {
  const hash = await sha256Hex(canonical(body));
  return { id: "sc_" + hash.slice(0, 10), hash, ...body };
}

export async function verifySealRecord(rec: SealRecord): Promise<{ ok: boolean; recomputed: string }> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, hash, ...body } = rec;
  const recomputed = await sha256Hex(canonical(body));
  return { ok: recomputed === hash && id === "sc_" + hash.slice(0, 10), recomputed };
}

export async function resolutionFromBody(body: ResolutionBody): Promise<ResolutionRecord> {
  const hash = await sha256Hex(canonical(body));
  return { hash, ...body };
}

export const SEAL_PREFIX = "SEALED_CALL ";
export const RESOLUTION_PREFIX = "RESOLUTION ";
