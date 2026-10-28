import { priceAt, spotPrice, fixtures, sportsFinal, resolveAuto, LEAGUES } from "../src/lib/oracles";
(async()=>{
 console.log(await spotPrice("SUI"));
 console.log(await priceAt("BTC","2026-10-28T12:00:00Z"));
 for (const l of LEAGUES){ const f = await fixtures(l.id,"20261031"); console.log(l.id,f.length, f[0]?.name);}
 const past = await fixtures("soccer/eng.1","20261025"); console.log(past.map(p=>p.name+" "+p.home.score+"-"+p.away.score+" "+p.state));
 if(past[0]) console.log(await sportsFinal("soccer/eng.1", past[0].id));
 console.log(await resolveAuto({type:"price",asset:"BTC",quote:"USD",op:"above",threshold:80000},"2026-10-28T12:00:00Z"));
})().catch(e=>{console.error(e);process.exit(1)});
