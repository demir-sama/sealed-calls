# Callwax — demo video script (target 2:30, hard cap 3:00)

Record at 1440×900, dark system theme, browser zoom 100%, no bookmarks bar. Use the live site: https://sealed-calls-sama-5806.vercel.app. Pre-warm every page you will open (Walrus recalls are slow on a cold serverless instance).
Voice: calm, plain, a little dry. No hype words. Say "sample" every time you show a demo voice.

| Time | Shot | Voiceover |
|---|---|---|
| 0:00–0:12 | Home hero (the receipt tilts, wax seal glows). Slow push-in. | "Every pundit, bot and timeline has the same problem: nobody keeps score. Callwax is a notary for predictions: it makes a prediction keep its word." |
| 0:12–0:30 | Scroll to "Three moves": Seal, Anchor, Score. | "You seal a call with a rule and a deadline. It's pinned to a Sui checkpoint and written into Walrus Memory. Then it resolves itself from public data, and the voice gets scored." |
| 0:30–1:15 | **/seal.** Type voice `Demir`, pick "Me". Claim: "ETH will be above $2,600 on Nov 9, 2026." Click "Fill the rule" (threshold 2600 appears). Set deadline, drag probability to 35%. Show the learning-loop hint. Click "Seal it into Walrus". Sealing overlay: three steps tick: hash, Sui checkpoint, Walrus write. Cut to the wax seal stamping: "Sealed. It's on the record." | "Real prediction, real rule. Before anything is written I read the newest Sui mainnet checkpoint through Tatum, and bake it in. That's the 'not before' stamp. The write is a real Walrus Memory write, so it takes twenty to forty seconds. I'm not going to fake that." *(speed-ramp the wait ×4, keep the step ticks visible)* |
| 1:15–1:45 | **Receipt page.** Show the paper receipt, barcode, hash, timeline ("Memory certified" appears). Click "Receipt image" to show the OG card. | "That's the receipt. The id is derived from the SHA-256 of the call; change a comma and it's a different seal. It also exports as an image you can post." |
| 1:45–2:10 | **Verify** on a seal that has been certified for a while (sc_2dfa21bdef). Click "Verify now": four checks go green: hash, Tatum checkpoint, Walrus aggregator, Sui blob object. Highlight "window 136 s". | "Verification doesn't trust us. It recomputes the hash in the browser, checks the anchor through Tatum, fetches the blob from a public Walrus aggregator, and finds the blob's own Sui object. The gap between the two checkpoints is the proof window." |
| 2:10–2:35 | **/voices and /voice/overconfident-ollie** (tagged *sample*). Show leaderboard, Brier bars, calibration plot where Ollie's dots sit far below the diagonal; then Calibrated Cass. | "Resolved calls feed a leaderboard: Brier score, hit rate, calibration. These are labelled sample personas: Ollie is always 90% sure and is wrong; Cass prices her doubt and does better. The whole ledger is rebuilt from Walrus recall, with hashes checked, so a tampered memory is dropped." |
| 2:35–2:55 | **/about**, scroll to "Honest limits": "Who said it", "Deletion & expiry", "Price oracle". | "What it can't prove: who said it, and blobs are deletable for now, though deletion is public on Sui. Prices come from Coinbase candles because I didn't have a Tatum Data API key. It's all written down." |
| 2:55–3:00 | Home hero, logo. | "Callwax. Seal it before you know." |

## Capture checklist
- Seal a fresh call on camera, but also have one already certified (for the verify shot).
- Show the browser URL bar so the live deploy is visible.
- Do not show `.env.local`, resolver keys or any terminal with secrets.
- Optional b-roll: the GitHub repo README with the "How the two sponsors are used" table; the Playwright screenshots in `docs/screens/`.
- Captions on; export 1080p; upload unlisted.
