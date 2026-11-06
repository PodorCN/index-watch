// ASSETS and SEED are embedded from authored files by scripts/build.py.
const etfSymbols=new Set(SEED.universe.filter(u=>u.eligible).map(u=>u.symbol));
const riskSources={
 VIX:['Cboe','https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv','volatility_points'],
 VVIX:['Cboe','https://cdn.cboe.com/api/global/us_indices/daily_prices/VVIX_History.csv','volatility_points'],
 VIX9D:['Cboe','https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX9D_History.csv','volatility_points'],
 OVX:['Cboe','https://cdn.cboe.com/api/global/us_indices/daily_prices/OVX_History.csv','volatility_points'],
 GVZ:['Cboe','https://cdn.cboe.com/api/global/us_indices/daily_prices/GVZ_History.csv','volatility_points'],
 ...Object.fromEntries(['DGS2','DGS10','BAMLH0A0HYM2','BAMLC0A0CM','DTWEXBGS','DFII10','T10YIE'].map(s=>[
  s,['FRED',`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${s}&cosd=${new Date(Date.now()-86400000*800).toISOString().slice(0,10)}`,s==='DTWEXBGS'?'index_level':'percent_rate']
 ]))
};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-cache','x-content-type-options':'nosniff'}});
const NYDATE=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
function dateNY(ts){
 const p=Object.fromEntries(NYDATE.formatToParts(new Date(ts*1000)).map(p=>[p.type,p.value]));
 return `${p.year}-${p.month}-${p.day}`;
}
async function sourceText(url){
 const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json,text/csv,*/*'},signal:AbortSignal.timeout(16000)});
 if(!response.ok)throw new Error(`Source returned HTTP ${response.status}`);
 let bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes[0]===31&&bytes[1]===139){
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  bytes=new Uint8Array(await new Response(stream).arrayBuffer());
 }
 if(bytes[0]===80&&bytes[1]===75)throw new Error('Source returned an archive instead of the requested single series');
 return new TextDecoder().decode(bytes);
}
async function yahoo(symbol){
 const data=JSON.parse(await sourceText(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d&events=div%2Csplits&includeAdjustedClose=true`));
 const c=data.chart?.result?.[0];if(!c)throw new Error('Missing chart data');
 const adjusted=c.indicators?.adjclose?.[0]?.adjclose;
 if(!adjusted?.length)throw new Error('Adjusted close unavailable; raw prices are not substituted');
 const now=Date.now()/1000,regular=c.meta?.currentTradingPeriod?.regular||{},current=dateNY(regular.start||0),points=[];
 for(let i=0;i<c.timestamp.length;i++){
  const ts=c.timestamp[i],value=adjusted[i],day=dateNY(ts);
  if(ts>now||(day===current&&now<(regular.end||0)+900))continue;
  if(Number.isFinite(value)&&value>0)points.push([day,Math.round(value*1e6)/1e6]);
 }
 const clean=[...new Map(points)].sort((a,b)=>a[0].localeCompare(b[0]));
 if(clean.length<5)throw new Error('Insufficient completed trading days');
 let largest=0;for(let i=1;i<clean.length;i++)largest=Math.max(largest,Math.abs(Math.log(clean[i][1]/clean[i-1][1])));
 return {symbol,points:clean,basis:'adjusted_close_total_return_proxy',source:'Yahoo Finance',
  sourceUrl:`https://finance.yahoo.com/quote/${symbol}/history/`,fetchedAt:new Date().toISOString(),asOf:clean.at(-1)[0],
  currency:c.meta.currency||'USD',observations:clean.length,quality:largest>Math.log(1.5)?'review_large_daily_gap':'ok'};
}
async function risk(symbol){
 const [source,url,basis]=riskSources[symbol],text=await sourceText(url),points=[];
 for(const line of text.trim().split(/\r?\n/).slice(1)){
  const row=line.replace(/^\uFEFF/,'').split(',');
  let date=row[0].replace(/"/g,'').trim(),raw=row.at(-1).replace(/"/g,'').trim();
  if(!raw||raw==='.')continue;
  const value=Number(raw);
  if(source==='Cboe'){
   const p=date.split('/');if(p.length!==3)continue;
   date=`${p[2]}-${p[0].padStart(2,'0')}-${p[1].padStart(2,'0')}`;
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(value)||date>dateNY(Date.now()/1000)||date<'2024-01-01')continue;
  points.push([date,value]);
 }
 const clean=[...new Map(points)].sort((a,b)=>a[0].localeCompare(b[0]));
 if(!clean.length)throw new Error('No numeric observations');
 return {symbol,points:clean,basis,source,sourceUrl:url,fetchedAt:new Date().toISOString(),asOf:clean.at(-1)[0],quality:'ok'};
}
async function history(request,url,ctx){
 const symbol=url.searchParams.get('symbol'),kind=url.searchParams.get('kind')||'series';
 if((kind!=='series'&&kind!=='risk')||(kind==='series'?!etfSymbols.has(symbol):!Object.hasOwn(riskSources,symbol)))return json({error:'Unknown instrument'},400);
 const now=new Date(),parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const bucket=`${parts.year}-${parts.month}-${parts.day}-${Number(parts.hour)>=16?'after':'before'}`;
 const key=new Request(new URL(`/__market_cache_v1/${kind}/${symbol}/${bucket}`,url.origin));
 const cache=globalThis.caches?.default;
 if(cache){try{const cached=await cache.match(key);if(cached)return cached}catch{}}
 try{
  const data=kind==='series'?await yahoo(symbol):await risk(symbol);
  if(data.quality!=='ok')throw new Error('Large historical price gap requires manual review');
  const response=json(data);
  if(cache){
   const cacheResponse=new Response(JSON.stringify(data),{headers:{'content-type':'application/json','cache-control':'public,max-age=1800'}});
   const pending=cache.put(key,cacheResponse);if(ctx?.waitUntil)ctx.waitUntil(pending);else await pending;
  }
  return response;
 }catch(error){
  const old=(kind==='series'?SEED.series:SEED.risk)[symbol];
  if(old?.points?.length)return json({...old,fallback:true,refreshError:String(error.message).slice(0,120),attemptedAt:now.toISOString()});
  return json({symbol,error:'Public source temporarily unavailable',fallback:false},503);
 }
}
export default {
 async fetch(request,env,ctx){
  try{
   const url=new URL(request.url),path=url.pathname;
   if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
   if(path==='/api/snapshot')return json(SEED);
   if(path==='/api/history')return await history(request,url,ctx);
   if(path==='/api/health')return json({ok:true,seedGeneratedAt:SEED.generatedAt,etfSeries:Object.keys(SEED.series).length,universe:SEED.universe.length});
   const asset=ASSETS[path==='/'?'/index.html':path];
   if(!asset)return new Response('Not found',{status:404});
   return new Response(request.method==='HEAD'?null:asset.body,{headers:{
    'content-type':asset.type,'cache-control':path==='/'?'private,no-cache':'private,max-age=1800',
    'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin',
    'permissions-policy':'camera=(), microphone=(), geolocation=()'
   }});
  }catch{return json({error:'The research service is temporarily unavailable'},500)}
 }
};
