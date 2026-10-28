# Callwax: making predictions keep their word with Walrus Memory and Tatum

*Draft for the Walrus × Tatum "Total Recall" hackathon. Markets & Sports Prediction track. By Demir.*

Every prediction market, sports show and crypto timeline has the same problem: nobody keeps score. A pundit says "ETH to $4k by summer", the summer passes, and the ones who were wrong quietly delete the post.

Callwax is a small notary for that problem. You paste a prediction (yours, a pundit's, a bot's), attach a rule a stranger could check and a deadline, and Callwax **seals** it. The seal can't be back-dated, the call resolves itself where the rule can be checked from public data, and the voice behind it gets a score that is hard to game: **Brier score, hit rate and a calibration curve**. Each call gets a shareable receipt image and an independent **verify** button.

Live: https://sealed-calls-sama-5806.vercel.app · Code: https://github.com/demir-sama/sealed-calls

## What a seal actually is

A seal is three things stacked on each other.

1. **Integrity.** The call (claim, probability, rule, deadline, voice, source) is serialised as canonical JSON and hashed with SHA-256. The seal id is derived from the hash (`sc_` plus ten hex characters). Change one comma and the id changes.
2. **Not before.** Right before writing, Callwax asks the Sui mainnet, through the **Tatum** gateway, for the newest checkpoint and bakes its number, digest and timestamp into the call. Nobody could have produced that body before that checkpoint existed.
3. **Not after.** The call is stored with **Walrus Memory**. Under the hood that is a Walrus blob, and a Walrus blob is a Sui object with a creation checkpoint of its own. That checkpoint is a public upper bound. The "verify" step finds the blob object on Sui, reads its checkpoint through Tatum and shows the window between the two. For one of our sample calls the window was 136 seconds, and the receipt says so.

So a seal proves what was said and that it was said inside a known window. It does not prove who said it. We say that on the receipt and on the About page, because a notary that overclaims is worse than no notary.

## How Walrus Memory is used

Walrus Memory (`@mysten-incubation/memwal`) is the database. There is no other store.

- **Every seal and every resolution is a memory** written with `remember`. Each voice gets its own namespace (`v.<slug>`), so a pundit's track record is a self-contained Walrus memory space.
- **The ledger is re-derived with `recall`.** The leaderboard, voice pages and call pages are built by recalling memories, parsing them, recomputing each hash and dropping anything malformed or tampered. If a memory doesn't hash to its own id, it is never scored.
- **Batches use `rememberBulk`** so that seeding and bulk-resolving fit inside the relayer's rate limit.
- **The learning loop.** While you fill in the seal form, Callwax recalls your own sealed history and tells you whether your stated confidence matches how often you were right at that level, and shows an adjusted probability. The memory isn't a chat log; it's a track record that argues back.

Writes land in 20 to 40 seconds because they are real Walrus writes. The seal screen walks through hash, checkpoint and write while it happens, and the call page says "certifying on Walrus" until the memory is indexed.

## How Tatum is used

- **Sui gateway (GraphQL).** The "not before" checkpoint, the "not after" lookup of the blob object, the live ticker in the header, and resolution of on-chain-metric calls (for example, "Sui will pass checkpoint N by the deadline") all go through the Tatum gateway.
- **Data API.** The oracle layer prefers Tatum's Data API for prices when a `TATUM_API_KEY` is present. I had no key during the build, so the deployed app uses **Coinbase Exchange 1-minute candles** and every resolution record names its source.

## Auto-resolve, and the honest manual path

Three kinds of rule can resolve themselves:

- **Price:** "ETH above $2,490 at Oct 22, 12:00 UTC" resolves from the close of the last 1-minute Coinbase candle at or before the deadline.
- **Sui metric:** read from the checkpoint at the deadline through Tatum.
- **Match result:** read from ESPN's public scoreboard (unofficial, and we say so). Postponed or cancelled matches resolve VOID.

Anything else is a **manual** call. Sealing it returns a one-time resolver key; whoever holds it can resolve the call, and the resolution is itself a sealed memory. That is trust in the sealer, and the About page says so.

## The scoreboard

Brier score is the mean of (probability − outcome)². Saying 90% and being wrong costs 0.81; saying 90% and being right costs 0.01; shrugging at 50% always costs 0.25. We show Brier, hit rate, skill against the 50/50 baseline and a five-bin calibration plot. Calls whose deadline had already passed when they were sealed are labelled **archived** and excluded from the headline "live-sealed" score, because a seal made after the outcome proves nothing about foresight.

The demo data is worldwide: BTC and ETH price lines, Premier League, La Liga, MLS. The sample voices (Calibrated Cass, Overconfident Ollie, Momentum Bot and friends) are demo personas generated by a script and tagged "sample" everywhere. The leaderboard shows the scoring working: Ollie, who is always sure, gets crushed (Brier 0.86); Cass, who prices her doubt, comes out ahead; Coin Flip 50 lands exactly on 0.25.

## What's real and what isn't

- **Real:** about 200 memories on Walrus Mainnet; every seal is a real write with a real Sui anchor; the verify panel runs four live checks (hash, Tatum checkpoint, public Walrus aggregator, Sui blob object); auto-resolve against Coinbase; manual resolve (a wrong key returns 403); receipt images.
- **Labelled demo:** the sample voices. They are not people.

## Honest weaknesses

- **No Tatum API key.** The anonymous gateway allows about one request a second and the Data API needs a key. Caching and de-duping help, but the first verify on a cold serverless instance can take 20+ seconds.
- **Deletable blobs.** MemWal's relayer stores memories as deletable Walrus blobs for a fixed number of epochs (ours run to epoch 57, about seven months). We can't edit a seal, but the account owner could delete or let one expire. Deletion is a public Sui transaction, so a missing seal is visible rather than silent, and anyone holding a receipt can still prove its hash and anchor. The About page says this.
- **Privacy vs. public ledger.** Walrus Memory contents are encrypted, so the readable ledger is served by the app. The hashes are independently checkable, the contents are not publicly readable from Walrus.
- **Thin live history.** Most scored calls are archived backfills, labelled as such.
- **Per-instance cache.** A fresh serverless instance pays for a full recall.
- **ESPN is unofficial**, and one price venue is one price venue.
- **Hobby-plan cron** runs once a day; resolution is also lazy, plus a "check sources" button.

## What I'd build next

Wallet-signed seals so a receipt also proves who said it, longer-lived storage via a self-hosted relayer, and a Tatum-keyed oracle path with several price venues.

*Built by Demir for the Walrus × Tatum Total Recall hackathon. Not financial advice.*
