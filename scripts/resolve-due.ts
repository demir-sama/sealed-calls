// Settle every due auto-checkable call (what the daily cron does, run by hand).
import { resolveDue, getLedger, allStats } from "../src/lib/ledger";
(async () => {
  for (let i = 0; i < 6; i++) {
    const r = await resolveDue(12);
    console.log("round", i, "checked", r.checked, "resolved", r.resolved.length, "errors", r.errors.length, r.errors.slice(0, 2));
    if (!r.checked) break;
    await new Promise((s) => setTimeout(s, 20000));
  }
  const l = await getLedger({ fresh: true });
  console.log("calls", l.calls.length, "resolved", l.calls.filter((c) => c.resolution).length, "memories", l.recalled);
  console.log(allStats(l.calls).map((s) => `${s.voice.slug}:${s.resolved}/${s.total}`).join(" "));
})();
