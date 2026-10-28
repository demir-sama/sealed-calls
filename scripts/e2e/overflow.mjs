import { chromium } from "@playwright/test";
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2});
for (const path of process.argv.slice(2)) {
const p = await ctx.newPage();
await p.goto("http://localhost:3100"+path, {waitUntil:"networkidle"}); await p.waitForTimeout(1500);
const r = await p.evaluate(()=>{ const out=[]; for (const e of document.querySelectorAll("body *")) { const b=e.getBoundingClientRect(); if (b.right>392 && b.width>0 && getComputedStyle(e).position!=="fixed") out.push(e.tagName+"."+(e.className?.toString?.().slice(0,60))+" r="+Math.round(b.right)); } return {sw:document.documentElement.scrollWidth, bw: document.body.scrollWidth, out: out.slice(0,8)}; });
console.log(path, JSON.stringify(r)); await p.close(); }
await b.close();
