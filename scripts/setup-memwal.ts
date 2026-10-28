/**
 * One-time headless setup of a Walrus Memory account on Mainnet.
 *
 * - generates an owner Sui keypair (kept in .env.local, never printed)
 * - creates the MemWalAccount via the relayer's *sponsored* transaction route
 *   (no SUI needed in the owner wallet)
 * - generates a delegate key and registers it onchain (also sponsored)
 * - writes MEMWAL_* values into .env.local
 *
 * Usage: npx tsx scripts/setup-memwal.ts
 */
import fs from "node:fs";
import path from "node:path";
import { Transaction } from "@mysten/sui/transactions";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { createSponsorAuthorization } from "@mysten-incubation/memwal";
import { generateDelegateKey } from "@mysten-incubation/memwal/account";

const RELAYER = process.env.MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz";
const ENV_PATH = path.join(process.cwd(), ".env.local");
const CLOCK = "0x0000000000000000000000000000000000000000000000000000000000000006";

function readEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(ENV_PATH)) return out;
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
function writeEnv(env: Record<string, string>) {
  fs.writeFileSync(ENV_PATH, Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", { mode: 0o600 });
}

async function sponsored(kp: Ed25519Keypair, client: SuiGrpcClient, tx: Transaction) {
  const sender = kp.toSuiAddress();
  tx.setSender(sender);
  const kind = await tx.build({ client, onlyTransactionKind: true });
  const auth = await createSponsorAuthorization(sender, kind, async (message) => {
    const { signature } = await kp.signPersonalMessage(message);
    return { signature };
  });
  const res = await fetch(`${RELAYER}/sponsor`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transactionBlockKindBytes: Buffer.from(kind).toString("base64"), sender, ...auth }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`sponsor failed ${res.status}: ${text}`);
  const { bytes, digest } = JSON.parse(text) as { bytes: string; digest: string };
  const { signature } = await kp.signTransaction(Buffer.from(bytes, "base64"));
  const ex = await fetch(`${RELAYER}/sponsor/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ digest, sender, signature }),
  });
  const exText = await ex.text();
  if (!ex.ok) throw new Error(`execute failed ${ex.status}: ${exText}`);
  return JSON.parse(exText) as { digest: string };
}

async function main() {
  const cfg = await (await fetch(`${RELAYER}/config`)).json();
  const packageId: string = cfg.packageId;
  const registryId: string = cfg.registryId;
  console.log("relayer network:", cfg.network, "package:", packageId);
  if (cfg.network !== "mainnet") throw new Error("relayer is not mainnet");

  const client = new SuiGrpcClient({ network: "mainnet", baseUrl: "https://fullnode.mainnet.sui.io:443" });
  const env = readEnv();

  if (!env.SUI_OWNER_PRIVATE_KEY) {
    env.SUI_OWNER_PRIVATE_KEY = Ed25519Keypair.generate().getSecretKey();
    writeEnv(env);
    console.log("generated owner key (stored in .env.local)");
  }
  const kp = Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(env.SUI_OWNER_PRIVATE_KEY).secretKey);
  const owner = kp.toSuiAddress();
  env.SUI_OWNER_ADDRESS = owner;
  writeEnv(env);
  console.log("owner address:", owner);

  // does an account already exist for this owner?
  const lookup = await (await fetch(`${RELAYER}/api/accounts/${owner}/delegate-keys`)).json();
  let accountId: string | null = lookup.account_id;
  if (!accountId) {
    const tx = new Transaction();
    tx.moveCall({ target: `${packageId}::account::create_account`, arguments: [tx.object(registryId), tx.object(CLOCK)] });
    const r = await sponsored(kp, client, tx);
    console.log("create_account digest:", r.digest);
    for (let i = 0; i < 15 && !accountId; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const l = await (await fetch(`${RELAYER}/api/accounts/${owner}/delegate-keys`)).json();
      accountId = l.account_id;
    }
    env.MEMWAL_CREATE_ACCOUNT_DIGEST = r.digest;
  }
  if (!accountId) throw new Error("account not visible after create");
  env.MEMWAL_ACCOUNT_ID = accountId;
  writeEnv(env);
  console.log("MEMWAL_ACCOUNT_ID:", accountId);

  if (!env.MEMWAL_PRIVATE_KEY) {
    const d = await generateDelegateKey();
    const tx = new Transaction();
    const publicKey = Array.from(d.publicKey);
    tx.moveCall({
      target: `${packageId}::account::add_delegate_key`,
      arguments: [
        tx.object(accountId),
        tx.object(registryId),
        tx.pure("vector<u8>", publicKey),
        tx.pure("string", "sealed-calls"),
        tx.object(CLOCK),
      ],
    });
    const r = await sponsored(kp, client, tx);
    console.log("add_delegate_key digest:", r.digest);
    env.MEMWAL_PRIVATE_KEY = d.privateKey;
    env.MEMWAL_AGENT_ID = Buffer.from(d.publicKey).toString("hex");
    env.MEMWAL_ADD_DELEGATE_DIGEST = r.digest;
    writeEnv(env);
  }
  env.MEMWAL_SERVER_URL = RELAYER;
  env.MEMWAL_PACKAGE_ID = packageId;
  env.MEMWAL_REGISTRY_ID = registryId;
  writeEnv(env);
  const keys = await (await fetch(`${RELAYER}/api/accounts/${owner}/delegate-keys`)).json();
  console.log("onchain delegate keys:", keys.keys.map((k: any) => `${k.label}:${k.public_key.slice(0, 12)}…`));
  console.log("MEMWAL_AGENT_ID (delegate public key):", env.MEMWAL_AGENT_ID);
}
main().catch((e) => { console.error(e); process.exit(1); });
