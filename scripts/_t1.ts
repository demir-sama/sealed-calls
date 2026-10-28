import "dotenv/config";
import { MemWal } from "@mysten-incubation/memwal";
(async()=>{
 const m = MemWal.create({ key: process.env.MEMWAL_PRIVATE_KEY!, accountId: process.env.MEMWAL_ACCOUNT_ID!, serverUrl: process.env.MEMWAL_SERVER_URL!, namespace: "sc-test" } as any);
 console.log(await m.health());
 const t=Date.now();
 const r = await (m as any).rememberAndWait("SEALED CALL test: BTC will close above 100000 USD on 2027-01-01. confidence 0.6");
 console.log(JSON.stringify(r), Date.now()-t,"ms");
 const q = await m.recall("BTC call", 5);
 console.log(JSON.stringify(q).slice(0,800));
})().catch(e=>{console.error(e);process.exit(1)});
