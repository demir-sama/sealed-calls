import { chromium } from "@playwright/test";
const base = process.env.BASE ?? "http://localhost:3100";
const pages = process.argv.slice(2);
const out = process.env.OUT ?? "/workspace/shots";
const browser = await chromium.launch();
for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: name === "mobile" ? 2 : 1, isMobile: name === "mobile" });
  for (const p of pages) {
    const page = await ctx.newPage();
    const errs = [];
    page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(base + p, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(1800);
    // scroll through to trigger whileInView animations
    const h = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < h; y += 500) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(120); }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1200);
    const slug = (p === "/" ? "home" : p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, ""));
    await page.screenshot({ path: `${out}/${slug}-${name}.png`, fullPage: true });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    console.log(name, p, "h=" + h, sw ? "HORIZONTAL OVERFLOW" : "", errs.length ? "ERR: " + errs.slice(0, 3).join(" | ") : "");
    await page.close();
  }
  await ctx.close();
}
await browser.close();
