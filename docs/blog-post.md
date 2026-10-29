# Callwax: making predictions keep their word with Walrus Memory and Tatum

*Walrus × Tatum "Total Recall" hackathon · Markets & Sports Prediction track · by Demir*

Pundits, bots and crypto timelines share one problem: nobody keeps score. "ETH to $4k by summer" comes and goes, and the wrong calls quietly disappear.

Callwax is a notary for predictions. Paste a call (yours, a pundit's, a bot's), add a rule a stranger could check and a deadline, and Callwax **seals** it. The seal can't be back-dated, the call resolves itself from public data, and the voice behind it gets a score that is hard to game: **Brier score, hit rate and a calibration curve**. Every call has a shareable receipt and an independent **verify** button.

**Live:** https://sealed-calls-sama-5806.vercel.app · **Code:** https://github.com/demir-sama/sealed-calls

## What a seal is

1. **Integrity.** The call is serialised as canonical JSON and hashed with SHA-256; the seal id (`sc_…`) comes from the hash. Change a comma and the id changes.
2. **Not before.** Right before writing, Callwax reads the newest Sui mainnet checkpoint through **Tatum** and bakes it into the call.
3. **Not after.** The call is stored with **Walrus Memory**. Its Walrus blob is a Sui object with its own creation checkpoint, a public upper bound. Verify reads that checkpoint through Tatum and shows the window (136 seconds for one sample call).

A seal proves *what* was said and *when*, within a window. It does not prove *who* said it, and the receipt says so.

## Walrus Memory is the database

- Every seal and resolution is a `remember`, in one namespace per voice (`v.<slug>`), so each track record is its own memory space.
- The ledger, leaderboard and voice pages are rebuilt with `recall`. Each memory's hash is recomputed and anything tampered with is dropped before scoring.
- `rememberBulk` handles batches within the relayer's rate limit.
- **Learning loop:** while you fill in the form, Callwax recalls your own history and tells you whether your confidence matches your hit rate at that level.

Writes take 20–40 seconds because they are real Walrus writes; the UI shows each step instead of faking it.

## Tatum does the chain reads and prices

- **Sui gateway (GraphQL, keyed):** the "not before" checkpoint, the "not after" lookup of the blob object, the live header ticker, and Sui-metric resolutions.
- **Data API:** spot prices come from Tatum's exchange-rate endpoint. Price calls resolved within five minutes of their deadline use Tatum's quote; later ones fall back to the reproducible Coinbase 1-minute candle. Every resolution names its source.

## Resolution and scoring

Price, Sui-metric and match-result rules (ESPN's public scoreboard) resolve automatically; postponed matches resolve VOID. Anything else is a manual call with a one-time resolver key, and that resolution is sealed too.

Brier is the mean of (probability − outcome)². Calling 90% and being wrong costs 0.81; a 50% shrug always costs 0.25. Calls sealed after their deadline are labelled **archived** and kept out of the headline score.

The demo voices (Calibrated Cass, Overconfident Ollie, Coin Flip 50…) are labelled sample personas. They show the scoring working: Ollie, always sure, scores 0.86; Cass, who prices her doubt, wins; Coin Flip lands on 0.25.

## Honest limits

- About 200 real memories on Walrus Mainnet, but most scored calls are archived backfills.
- Walrus blobs from the managed relayer are deletable and expire (epoch 57). Deletion is a public Sui transaction, so it can't happen silently.
- Memory contents are encrypted, so the readable ledger is served by the app; hashes stay independently checkable.
- ESPN is unofficial; the daily Hobby cron is backed by lazy resolution.

**Next:** wallet-signed seals (proving *who*), longer-lived storage, more price venues.

*Not financial advice.*
