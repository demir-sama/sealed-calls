# Submission form answers

Form: https://recall-tatum-walrus.vercel.app · Deadline: Nov 10, 2026, 18:00 WAT (17:00 UTC) · Track: Markets & Sports Prediction

| Field | Answer |
|---|---|
| Name | Demir |
| Email | demirsamahash@gmail.com |
| Project name | Callwax |
| One-line pitch | A notary for predictions: seal a call into Walrus Memory with a Sui checkpoint pinned inside (read via Tatum), auto-resolve it from public data, and score every voice with Brier, hit rate and calibration. |
| Track | Markets & Sports Prediction |
| Live URL | https://sealed-calls-sama-5806.vercel.app |
| Repo | https://github.com/demir-sama/sealed-calls |
| Walrus Memory account ID (`MEMWAL_ACCOUNT_ID`) | `0x9035f986ef7946f93c6c0c09b2f2130784eebe03912b71f00439464ec4ae96ef` (Sui Mainnet) |
| Walrus Memory delegate/agent public key | `ec7a826a4252a36938037905aa28471065be752945abdde7f5b4acbac2f695a5` (the form may call this MEMWAL_AGENT_ID; the private delegate key is never shared) |
| MemWal package | `0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5` |
| Sui owner address | `0x90d1481c4b63acb8b7f7b44f2fee2e24e0ef90bdd116915b1aabfc95e5f3c419` |
| Tatum dashboard / account ID | The dashboard's Account ID field was empty, so the form was given the account segment of the API key (the 24-hex ID after `t-`, never the secret part). Replace it if the organisers want the dashboard value. |
| Tatum API key usage | Active. `TATUM_API_KEY` is set on Vercel (Production and Preview) and `/api/meta` reports `tatum: "keyed"`. Sui reads use the keyed Tatum gateway; spot prices and promptly resolved price calls use Tatum's Data API exchange rate, with Coinbase 1-minute candles as the fallback. |
| Number of memories on Mainnet | about 200 (199 in `v.*` voice namespaces on the last live recall, plus a few early test memories) |
| Video | (record from `docs/video-script.md`, then paste the link) |
| Blog post / write-up | https://github.com/demir-sama/sealed-calls/blob/main/docs/blog-post.md |
| X / social | https://x.com/samaisback  (or https://github.com/demir-sama) |
| LinkedIn (required by the form) | No LinkedIn account; https://x.com/samaisback used instead |

## Long-form answers

**What does it do?**
Callwax seals predictions. You give it a claim, a probability, a rule a stranger could check, and a deadline. It hashes the call (SHA-256 over canonical JSON), pins the newest Sui mainnet checkpoint (read through Tatum) inside it, and writes it to Walrus Memory in a per-voice namespace. At the deadline it resolves itself from public data (Tatum's exchange rate for prices, with Coinbase candles as fallback, ESPN for match results, Sui checkpoints via Tatum for on-chain metrics) or via a one-time resolver key for manual calls. Every voice gets a Brier score, hit rate, skill vs 50/50 and a calibration curve. Every call has a shareable receipt image and a verify button that re-checks hash, anchor, Walrus blob and Sui blob object.

**How does it use Walrus Memory?**
Walrus Memory is the only database. `remember` for each seal and resolution (one namespace per voice), `rememberBulk` for batches, `recall` to rebuild the whole ledger, leaderboard and track records with hash verification on read (tampered memories are dropped), and a learning loop that recalls a voice's own history to tell them whether their stated confidence is calibrated.

**How does it use Tatum?**
Sui gateway (GraphQL): the "not before" checkpoint before every seal, the "not after" checkpoint of the Walrus Blob object during verification, the live header ticker, and resolution of Sui-metric calls. These reads use the keyed gateway. Data API: the live spot price in the seal form comes from Tatum's exchange-rate endpoint, and a price call resolved within five minutes of its deadline uses Tatum's quote (recorded as `auto:tatum-rate`); Tatum only serves the current rate, so later resolutions fall back to the reproducible Coinbase 1-minute candle.

**What's the hardest part / what did you learn?**
Making the proof honest: a hash only proves content, a Sui checkpoint only bounds time, and Walrus Memory writes take 20–40s through the managed relayer. We surfaced that in the UI instead of hiding it, and wrote down what a seal can't prove (who said it; blob deletion is possible but public).

**Known limitations**
Tatum's rate endpoint has no history, so late price resolutions use Coinbase candles; ESPN API is unofficial; blobs are deletable and expire around epoch 57; sample voices are labelled demo personas and most scored calls are archived backfills; cache is per serverless instance; Hobby cron is daily.

**What's next?**
Wallet-signed seals, self-hosted relayer with longer storage, multi-venue Tatum-keyed oracles, follow-a-voice alerts.
