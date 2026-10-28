import { sealCall, sealStatus, getLedger, allStats } from "../src/lib/ledger";
(async()=>{
 const deadline = new Date("2026-11-10T16:00:00Z").toISOString();
 const r = await sealCall({ voice:{name:"Demir",kind:"self",handle:"@samaisback"}, claim:"I will submit Sealed Calls to the Walrus x Tatum Total Recall hackathon before the deadline.", rule:{type:"manual",rule:"YES if a submission to the Total Recall hackathon form was made before 2026-11-10 18:00 WAT."}, p:0.93, deadline, admin: process.env.ADMIN_KEY });
 console.log(r.call.seal.id, r.call.seal.hash, r.call.seal.anchor, r.jobId, "KEY?", !!r.resolverKey);
 require("fs").appendFileSync(".env.local", `RESOLVER_KEY_${r.call.seal.id}=${r.resolverKey}\n`);
 for(let i=0;i<30;i++){ const s=await sealStatus(r.jobId, r.call.seal.id); console.log(s.status, s.blob_id); if(s.status==="done"||s.status==="failed")break; await new Promise(r=>setTimeout(r,2500)); }
 const l = await getLedger({fresh:true}); console.log(l.voices, l.calls.length, l.recalled, l.tookMs);
 console.log(JSON.stringify(allStats(l.calls),null,1).slice(0,900));
})().catch(e=>{console.error(e);process.exit(1)});
