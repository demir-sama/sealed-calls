import { chromium } from "@playwright/test";
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:1440,height:900}});
const p = await ctx.newPage();
p.on("console", m => console.log("C", m.type(), m.text().slice(0,300))); p.on("pageerror", e => console.log("PE", String(e).slice(0,400))); p.on("response", r => r.url().includes("/api/") && console.log(Date.now()%100000,"R", r.status(), r.url()));
await p.goto("http://localhost:3100/call/sc_2dfa21bdef", {waitUntil:"domcontentloaded"}); await p.waitForTimeout(2500);
await p.getByRole("button",{name:/Verify now/}).click();
const t0=Date.now(); await p.getByRole("button",{name:/Run again/}).waitFor({timeout:90000}).catch(e=>console.log("timeout")); console.log("done in", Date.now()-t0);
await p.screenshot({path:"/workspace/shots/verify-panel.png", fullPage:true});
await b.close();
