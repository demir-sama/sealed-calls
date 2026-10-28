import { mem, listVoiceNamespaces } from "../src/lib/walrus";
(async()=>{
 console.log(JSON.stringify(await mem().listNamespaces()));
 const l = await mem().listMemories({}); console.log(l.memories.map((m:any)=>[m.namespace_id,m.status,m.blob_id.slice(0,8)]));
 const r = await mem().recall("SEALED_CALL", {limit:10, namespace:"v.demir"} as any); console.log(JSON.stringify(r).slice(0,500));
})().catch(e=>{console.error(e);process.exit(1)});
