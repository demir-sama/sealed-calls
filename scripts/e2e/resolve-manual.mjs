// usage: RK=rk_… node scripts/e2e/resolve-manual.mjs sc_xxx  (resolver key via env, never committed)
import { chromium } from "@playwright/test";
const id = process.argv[2];
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`http://localhost:3100/call/${id}`, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(3000);
await p.fill("#rk", "rk_wrongwrongwrong0000");
await p.getByText("Yes", { exact: true }).first().click();
await p.getByRole("button", { name: /Seal the resolution/ }).click();
await p.waitForTimeout(2500);
console.log("wrong key →", await p.locator("form").innerText().then((t) => t.split("\n").slice(-3).join(" | ")));
await p.screenshot({ path: "/workspace/shots/resolve-wrongkey.png" });
await p.fill("#rk", process.env.RK);
await p.fill("#rn", "Resolved from the UI as part of the end-to-end test.");
await p.getByRole("button", { name: /Seal the resolution/ }).click();
await p.waitForSelector("text=Resolution sealed", { timeout: 120000 });
await p.waitForTimeout(3000);
await p.screenshot({ path: "/workspace/shots/resolve-done.png", fullPage: true });
console.log("ok");
await b.close();
