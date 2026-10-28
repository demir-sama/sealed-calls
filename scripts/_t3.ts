import { MemWal } from "@mysten-incubation/memwal";
(async()=>{
 const m = MemWal.create({ key: process.env.MEMWAL_PRIVATE_KEY!, accountId: process.env.MEMWAL_ACCOUNT_ID!, serverUrl: process.env.MEMWAL_SERVER_URL!, namespace: "default" });
 let t=Date.now();
 console.log(JSON.stringify(await m.listNamespaces()), Date.now()-t);
 t=Date.now();
 const j = await m.rememberAsync("SEALED_CALL idem test", {namespace:"v.test-voice", idempotencyKey:"idem-1"} as any).catch(e=>e);
 console.log(Date.now()-t, JSON.stringify(j));
 const j2 = await m.rememberAsync("SEALED_CALL idem test CHANGED", {namespace:"v.test-voice", idempotencyKey:"idem-1"} as any).catch(e=>String(e));
 console.log(JSON.stringify(j2));
})().catch(e=>{console.error(e);process.exit(1)});
