import { latestCheckpoint, checkpointAtOrBefore, findBlobObject, blobIdToDecimal } from "../src/lib/sui";
(async()=>{
 console.log(await latestCheckpoint());
 let t=Date.now();
 const ts = new Date(Date.now()-3*3600e3).toISOString();
 const r = await checkpointAtOrBefore(ts); console.log(ts, r, Date.now()-t,"ms");
 t=Date.now();
 console.log(await findBlobObject(process.env.SUI_OWNER_ADDRESS!, blobIdToDecimal("LZgM4EUXbEGILd7XGV9IGklK6L5WD4uuser4zH3g6TU")), Date.now()-t);
})().catch(e=>{console.error(e);process.exit(1)});
