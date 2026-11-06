import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../worker/server.mjs',import.meta.url),'utf8').replace('export default {','globalThis.worker = {');
function harness({upstream,cache}={}){
 const old={symbol:'IVV',asOf:'2026-11-05',points:[['2026-11-05',100]],quality:'ok'};
 const context=vm.createContext({SEED:{universe:[{symbol:'IVV',eligible:true}],series:{IVV:old},risk:{}},ASSETS:{},Date,Intl,URL,Request,Response,Blob,TextDecoder,Uint8Array,DecompressionStream,AbortSignal,
  caches:cache?{default:cache}:undefined,fetch:upstream||(()=>{throw Error('No upstream request expected')})});
 vm.runInContext(source,context);
 return {context,request:(path='/api/history?symbol=IVV')=>context.worker.fetch(new Request('https://macro.test'+path),{},{}),old};
}

test('A shared cache hit is labeled without changing the source date or fetched timestamp',async()=>{
 const cached={symbol:'IVV',asOf:'2026-11-05',fetchedAt:'2026-11-06T17:00:00Z',points:[['2026-11-05',100]],quality:'ok'};
 const h=harness({cache:{match:async()=>new Response(JSON.stringify(cached))}});
 const response=await h.request(),value=await response.json();
 assert.equal(value.cacheStatus,'hit');assert.equal(value.asOf,cached.asOf);assert.equal(value.fetchedAt,cached.fetchedAt);
 assert.ok(value.checkedAt);assert.equal(response.headers.get('cache-control'),'private, no-cache');
});

test('An unavailable public source retains the dated seed and discloses fallback status',async()=>{
 const h=harness({upstream:async()=>new Response('Unavailable',{status:520})});
 const response=await h.request(),value=await response.json();
 assert.equal(response.status,200);assert.equal(value.cacheStatus,'snapshot');assert.equal(value.fallback,true);
 assert.equal(value.asOf,h.old.asOf);assert.deepEqual(value.points,h.old.points);assert.match(value.refreshError,/520/);
});

test('An upstream success is labeled a miss, and unknown instruments cannot initiate fetches',async()=>{
 const points=Array.from({length:5},(_,i)=>Date.parse(`2026-11-0${i+1}T20:00:00Z`)/1000);
 const chart={chart:{result:[{timestamp:points,meta:{currency:'USD'},indicators:{adjclose:[{adjclose:[100,101,102,103,104]}]}}]}};
 let requests=0;
 const h=harness({upstream:async()=>{requests++;return new Response(JSON.stringify(chart))}});
 const value=await (await h.request()).json();
 assert.equal(value.cacheStatus,'miss');assert.equal(value.asOf,'2026-11-05');assert.equal(value.quality,'ok');
 assert.equal((await h.request('/api/history?symbol=UNKNOWN')).status,400);assert.equal(requests,1);
});
