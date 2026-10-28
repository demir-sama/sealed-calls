import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "./ledger";
import { ZodError } from "zod";

export const ok = (data: unknown, init?: ResponseInit) => NextResponse.json(data, { ...init, headers: { "cache-control": "no-store", ...(init?.headers ?? {}) } });

export function fail(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") }, { status: 400 });
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api]", msg);
  return NextResponse.json({ error: msg.slice(0, 300) }, { status: 500 });
}

export const ipOf = (req: Request) => (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
