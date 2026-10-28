# Callwax — a notary for predictions

> Make every prediction keep its word.

Paste any prediction — a pundit's, a friend's, a model's, your own — with a rule a stranger could check and a deadline.
Callwax **seals** it into [Walrus Memory](https://docs.walrus.site) with a **Sui checkpoint** pinned inside (read through **Tatum**), **auto-resolves** it where the rule is checkable, scores every voice (**Brier score, hit rate, calibration curve**), and hands each one a **shareable receipt image**. Anyone can **verify** a seal independently.

Built for the Walrus × Tatum “Total Recall” hackathon (Markets & Sports Prediction track).

**Live:** https://sealed-calls-sama-5806.vercel.app · **Docs:** [`docs/`](docs) (blog post, demo script, submission answers)

## How the two sponsors are used

| | What it does here |
|---|---|
| **Walrus Memory** (`@mysten-incubation/memwal`) | Every seal and every resolution is a memory. Each voice is its own namespace (`v.<slug>`). The whole ledger, leaderboard and track records are rebuilt from `recall()`; hashes are recomputed on read and malformed or tampered memories are dropped. Batches use `rememberBulk`. |
| **Tatum** (Sui gateway, GraphQL) | The newest checkpoint is read before every seal and baked into it (“not before”). Sui-metric calls resolve from the checkpoint at the deadline. Verification finds the Walrus `Blob` object on Sui and reads its creation checkpoint (“not after”). With `TATUM_API_KEY` the app also prefers Tatum's Data API for prices. |

## Run it

```bash
npm i
cp .env.example .env.local   # fill in – see below
npx tsx --env-file=.env.local scripts/setup-memwal.ts   # one-off: creates a Sui key, MemWal account + delegate key
npm run dev                                              # http://localhost:3000
```

| Env | Meaning |
|---|---|
| `MEMWAL_ACCOUNT_ID` | MemWal account object id (Mainnet) |
| `MEMWAL_PRIVATE_KEY` | delegate key (hex) registered on that account |
| `MEMWAL_SERVER_URL` | managed relayer (`https://relayer.memory.walrus.xyz`) |
| `MEMWAL_PACKAGE_ID`, `MEMWAL_REGISTRY_ID` | MemWal Mainnet package + registry ids |
| `TATUM_API_KEY` | optional — raises Tatum rate limits and enables the Data API oracle |
| `ADMIN_KEY` | optional — lets `scripts/seed.ts` seal labelled sample voices without rate limits |
| `CRON_SECRET` | Vercel cron auth for `/api/resolve` |
| `NEXT_PUBLIC_SITE_URL` | canonical origin for OG images |

Secrets live only in `.env.local` / Vercel env — never in the repo.

## Architecture

```
/seal ──POST /api/seal──▶ build body ─▶ Tatum: latest Sui checkpoint ─▶ SHA-256(canonical JSON) ─▶ MemWal.remember (v.<voice>)
/call/[id], /voice/[slug] ◀── ledger.ts ◀── MemWal.recall per voice (SWR cache, hash-verified)
/api/resolve (cron + “check sources now”) ─▶ oracles: Coinbase 1m candles | Sui via Tatum | ESPN ─▶ sealed resolution memory
/api/verify ─▶ hash recompute · Tatum checkpoint · Walrus aggregator HEAD/GET · Sui Blob object (+creation checkpoint)
/api/og/call/[id], /api/og/voice/[slug] ─▶ next/og receipts (landscape + portrait `?fmt=receipt`)
```

Key files: `src/lib/walrus.ts` (memory I/O), `ledger.ts` (hydration, sealing, resolving), `sui.ts` (Tatum client), `oracles.ts`, `scoring.ts`, `og.tsx`.

## Honest limits

See [/about](src/app/about/page.tsx) in the app. Short version: a seal proves *what* and *when*, not *who said it*; Walrus contents are encrypted so the readable ledger is served by us (hashes are independently checkable); blobs are deletable and time-limited (deletion would be public on Sui); sample voices are labelled demo personas; Tatum's Data API needs a key (Coinbase candles are the fallback); ESPN's API is unofficial.

## Scripts

`scripts/seed.ts` (labelled sample voices; `backfill` and `live` modes) · `scripts/resolve-due.ts` · `scripts/shots.mjs` (Playwright screenshots) · `scripts/e2e/*` (browser flows).
