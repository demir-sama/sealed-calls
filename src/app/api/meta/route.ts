import { ownerAddress } from "@/lib/walrus";
import { tatumMode } from "@/lib/sui";
import { ok } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  return ok({ owner: ownerAddress(), account: process.env.MEMWAL_ACCOUNT_ID ?? null, package: process.env.MEMWAL_PACKAGE_ID ?? null, relayer: process.env.MEMWAL_SERVER_URL ?? null, tatum: tatumMode() });
}
