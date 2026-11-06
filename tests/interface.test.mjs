import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import * as analytics from '../worker/analytics.mjs';

async function harness(href='https://macro.test/#overview',historyFetch){
 const root=new URL('../',import.meta.url),seed=JSON.parse(readFileSync(new URL('data/snapshot.json',root)));
 const {window,document}=parseHTML(readFileSync(new URL('worker/index.html',root),'utf8'));
 const store=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v))}};
 const localStorage=store(),sessionStorage=store(),location=new URL(href);
 sessionStorage.setItem('macro-last-attempt',String(new Date('2026-11-06T17:00:00Z').getTime()));
 window.macroLens=undefined;window.location=location;window.history={replaceState(_a,_b,url){location.href=String(url)},pushState(_a,_b,url){location.href=String(url)}};
 for(const a of document.querySelectorAll('a'))Object.defineProperty(a,'hash',{get(){return new URL(a.getAttribute('href'),location).hash}});
 for(const s of document.querySelectorAll('select'))Object.defineProperty(s,'value',{get(){return this._value||this.querySelector('option')?.value||''},set(v){this._value=v},configurable:true});
 for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new window.Event('close'))}};
 const errors=[];
 class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-11-06T17:00:00Z']))}static now(){return new Date('2026-11-06T17:00:00Z').getTime()}}
 const context=vm.createContext({window,document,ANALYTICS:analytics,Date:Clock,localStorage,sessionStorage,Response,Blob,URL,Intl,AbortController,AbortSignal,setTimeout,clearTimeout,setInterval:()=>0,
  fetch:async (url,options)=>{if(url==='/api/snapshot')return new Response(JSON.stringify(seed));assert.ok(historyFetch,'Unexpected automatic source check');return historyFetch(url,options,seed)},console:{error:e=>errors.push(String(e)),log(){}}});
 const source=readFileSync(new URL('worker/app.js',root),'utf8').replace(/^import \{([^}]+)\} from '\/analytics\.mjs\?v=\d+';/,'const {$1}=ANALYTICS;');
 vm.runInContext(source,context,{timeout:20000});
 for(let i=0;i<30&&!window.macroLens;i++)await new Promise(r=>setTimeout(r,10));
 assert.deepEqual(errors,[]);assert.ok(window.macroLens,'The interface must finish booting');
 return {window,document,localStorage,location,errors,context,seed,refresh:()=>vm.runInContext('refreshData()',context)};
}

test('English research workspace preserves charts, filters, periods and instrument provenance',async()=>{
 const {window,document,localStorage,location,errors}=await harness();
 assert.equal(window.macroLens.state.ready,235);
 assert.equal(document.querySelectorAll('#stats .stat').length,4);
 assert.equal(document.querySelectorAll('#movers-list .mover-row').length,8);
 assert.equal(document.querySelectorAll('#insight-cards .focus-card').length,3);
 assert.equal(document.querySelectorAll('#sector-ribbon .sector-tile').length,11);
 assert.ok(document.querySelector('#macro-chart polyline'));
 const lead=analytics.pairInsights(seedForLead(),'MTD')[0];
 function seedForLead(){return JSON.parse(readFileSync(new URL('../data/snapshot.json',import.meta.url))).series}
 assert.equal(document.querySelector('#lead-title').textContent,lead.stats.gap>=0?lead.positive:lead.negative);
 assert.equal(document.querySelector('#lead-value').textContent,analytics.number(Math.abs(lead.stats.gap),2));
 assert.equal(document.querySelectorAll('#lead-chart polyline').length,2);
 assert.doesNotMatch(document.querySelector('#insight-cards').textContent,new RegExp(lead.title));
 document.querySelector('#lead-details').click();
 assert.match(document.querySelector('#detail-content').textContent,/Return spread/);
 document.querySelector('#detail-dialog [data-close]').click();
 document.querySelector('a[href="#markets"]').click();
 assert.equal(window.macroLens.state.view,'markets');
 assert.equal(document.querySelector('#overview').hidden,true);
 assert.equal(document.querySelector('#markets').hidden,false);
 assert.equal(document.querySelectorAll('#sector-bars .bar-row').length,11);
 assert.equal(document.querySelectorAll('#country-heatmap .heat-cell').length,38);
 document.querySelector('a[href="#rates"]').click();
 for(const id of ['yield-chart','credit-chart','vix-chart','inflation-chart'])assert.ok(document.querySelector('#'+id+' polyline'));
 document.querySelector('a[href="#relative"]').click();
 assert.equal(document.querySelectorAll('#pair-grid .pair-panel').length,10);
 document.querySelector('[data-pair="0"]').click();
 assert.ok(document.querySelector('#detail-dialog').hasAttribute('open'));
 assert.match(document.querySelector('#detail-content').textContent,/not a significance test/);
 document.querySelector('#detail-dialog [data-close]').click();
 document.querySelector('a[href="#universe"]').click();
 assert.equal(document.querySelectorAll('#universe-body tr').length,45);
 assert.equal(document.querySelectorAll('#private-references .private-ref').length,9);
 document.querySelector('[data-period="YTD"]').click();
 assert.equal(window.macroLens.state.period,'YTD');assert.equal(location.searchParams.get('period'),'YTD');
 const search=document.querySelector('#search');search.value='MTUM';search.dispatchEvent(new window.Event('input',{bubbles:true}));
 assert.equal(document.querySelectorAll('#universe-body tr').length,1);
 assert.match(document.querySelector('#universe-body').textContent,/Momentum SR Variant/);
 assert.equal(location.searchParams.get('q'),'MTUM');
 document.querySelector('#universe-body [data-star]').click();
 assert.match(localStorage.getItem('macro-lens-stars'),/ETF:MTUM/);
 document.querySelector('#universe-body tr').click();
 assert.ok(document.querySelector('#detail-dialog').hasAttribute('open'));assert.ok(document.querySelector('#detail-chart polyline'));
 assert.match(document.querySelector('#detail-content').textContent,/MSCI USA Momentum SR Variant Index/);
 document.querySelector('#detail-dialog [data-close]').click();
 document.querySelector('#open-method').click();assert.ok(document.querySelector('#method-dialog').hasAttribute('open'));
 assert.doesNotMatch(document.body.textContent,/[\u3400-\u9fff]/,'Visible and hidden product copy must be English');
 assert.deepEqual(errors,[]);
});

test('Refresh reports same-date cached checks and retained failures without claiming new closes',async()=>{
 const h=await harness(undefined,async(url,_options,seed)=>{
  const p=new URL(url,'https://macro.test').searchParams,s=p.get('symbol'),kind=p.get('kind');
  return new Response(JSON.stringify({...seed[kind][s],cacheStatus:'hit',...(s==='DGS2'?{fallback:true,refreshError:'Source returned HTTP 520'}:{})}));
 });
 const generated=h.seed.generatedAt;await h.refresh();
 assert.match(h.document.querySelector('#refresh-summary').textContent,/No new closes · 246 checked · 1 snapshots retained/);
 assert.match(h.document.querySelector('#refresh-detail-text').textContent,/246 responses from the shared 30-minute cache/);
 assert.match(h.document.querySelector('#refresh-detail-text').textContent,/DGS2: Source returned HTTP 520/);
 const saved=JSON.parse(h.localStorage.getItem('macro-lens-snapshot'));
 assert.equal(saved.generatedAt,generated);assert.ok(saved.lastCheckedAt);
 assert.equal(h.document.querySelector('#refresh').disabled,false);
 assert.equal(h.document.querySelector('#refresh-progress').hidden,true);
});

test('Refresh commits new closes together and cancellation discards partially fetched results',async()=>{
 let deferred=[],hold=true;
 const h=await harness(undefined,async(url,options,seed)=>{
  const p=new URL(url,'https://macro.test').searchParams,s=p.get('symbol'),kind=p.get('kind');
  if(hold&&s!=='IVV')await new Promise((resolve,reject)=>{deferred.push(resolve);options.signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true})});
  const value=structuredClone(seed[kind][s]);
  if(s==='IVV'){value.asOf='2026-11-06';value.points.push(['2026-11-06',value.points.at(-1)[1]*1.005])}
  return new Response(JSON.stringify({...value,cacheStatus:'miss'}));
 });
 const task=h.refresh();
 for(let i=0;i<30&&deferred.length<5;i++)await new Promise(r=>setTimeout(r,1));
 assert.equal(vm.runInContext('state.data.series.IVV.asOf',h.context),'2026-11-05','Partial results must not reach the displayed snapshot');
 h.document.querySelector('#cancel-refresh').click();await task;
 assert.match(h.document.querySelector('#refresh-summary').textContent,/cancelled/);
 assert.equal(h.localStorage.getItem('macro-lens-snapshot'),null);
 assert.equal(vm.runInContext('state.data.series.IVV.asOf',h.context),'2026-11-05');
 assert.equal(h.document.querySelector('#refresh').disabled,false);
 hold=false;await h.refresh();
 assert.match(h.document.querySelector('#refresh-summary').textContent,/1 series with new closes/);
 assert.equal(JSON.parse(h.localStorage.getItem('macro-lens-snapshot')).series.IVV.asOf,'2026-11-06');
});

test('Universe links restore period and search without showing the overview',async()=>{
 const {window,document}=await harness('https://macro.test/?period=YTD&q=MTUM#universe');
 assert.equal(window.macroLens.state.view,'universe');assert.equal(window.macroLens.state.period,'YTD');
 assert.equal(document.querySelector('#overview').hidden,true);assert.equal(document.querySelector('#universe').hidden,false);
 assert.equal(document.querySelectorAll('#universe-body tr').length,1);
 assert.match(document.querySelector('#universe-body').textContent,/MTUM/);
});
