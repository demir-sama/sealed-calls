import { MemWal } from "@mysten-incubation/memwal";
(async()=>{
 const m = MemWal.create({ key: process.env.MEMWAL_PRIVATE_KEY!, accountId: process.env.MEMWAL_ACCOUNT_ID!, serverUrl: process.env.MEMWAL_SERVER_URL!, namespace: "sc-test" });
 const rec = {v:1,type:"seal",id:"sc_abc",voice:"sample",claim:"BTC above 100000 USD on 2027-01-01 00:00 UTC",p:0.62,anchor:{seq:339171196,digest:"BARMLdCjaABNh9j1zZMJDNcvtdKCzhEh6XeRV9uVHnrz"},hash:"a".repeat(64)};
 const text = "SEALED_CALL " + JSON.stringify(rec);
 const t=Date.now();
 const j = await m.rememberAsync(text, "sc-test");
 console.log("accepted", Date.now()-t, JSON.stringify(j));
 for(let i=0;i<30;i++){ const s = await m.getRememberStatus(j.job_id!); console.log(Date.now()-t, s.status); if(s.status==="done"||s.status==="failed") break; await new Promise(r=>setTimeout(r,1500)); }
 const t2=Date.now();
 const q = await m.recall("SEALED_CALL", {limit:100, namespace:"sc-test"} as any);
 console.log("recall", Date.now()-t2, q.total); for (const r of q.results) console.log(r.text.slice(0,250), r.created_at);
 const t3=Date.now(); const l = await m.listMemories({namespace:"sc-test"}); console.log("list", Date.now()-t3, JSON.stringify(l).slice(0,600));
})().catch(e=>{console.error(e);process.exit(1)});
