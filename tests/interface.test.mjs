import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import * as analytics from '../worker/analytics.mjs';

test('Interface renders real charts and supports period, search, focus list and detail interactions',async()=>{
 const root=new URL('../',import.meta.url);
 const seed=JSON.parse(readFileSync(new URL('data/snapshot.json',root)));
 const {window,document}=parseHTML(readFileSync(new URL('worker/index.html',root),'utf8'));
 const stores=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v))}};
 const localStorage=stores(),sessionStorage=stores();
 for(const dialog of document.querySelectorAll('dialog')){
  dialog.showModal=()=>dialog.setAttribute('open','');
  dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new window.Event('close'))};
 }
 const errors=[];
 class Clock extends Date{
  constructor(...args){super(...(args.length?args:['2026-11-06T17:00:00Z']))}
  static now(){return new Date('2026-11-06T17:00:00Z').getTime()}
 }
 const context=vm.createContext({window,document,ANALYTICS:analytics,Date:Clock,
  localStorage,sessionStorage,Response,Blob,URL,Intl,AbortSignal,
  setTimeout,clearTimeout,setInterval:()=>0,
  IntersectionObserver:class{observe(){}},
  fetch:async url=>{assert.equal(url,'/api/snapshot');return new Response(JSON.stringify(seed))},
  console:{error:e=>errors.push(String(e)),log(){}},
 });
 const source=readFileSync(new URL('worker/app.js',root),'utf8').replace(/^import \{([^}]+)\} from '\/analytics\.mjs';/, 'const {$1}=ANALYTICS;');
 vm.runInContext(source,context,{timeout:20000});
 for(let i=0;i<20&&!window.macroLens;i++)await new Promise(r=>setTimeout(r,10));
 assert.deepEqual(errors,[],'Boot must not silently fall back to an error banner');
 assert.equal(window.macroLens.state.ready,235);
 assert.equal(document.querySelectorAll('#stats .stat').length,4);
 assert.equal(document.querySelectorAll('#sector-bars .bar-row').length,11);
 assert.equal(document.querySelectorAll('#country-heatmap .heat-cell').length,38);
 assert.equal(document.querySelectorAll('#insight-cards .insight-card').length,3);
 assert.ok(document.querySelector('#macro-chart polyline'));
 assert.ok(document.querySelector('#yield-chart polyline'));
 assert.ok(document.querySelector('#credit-chart polyline'));
 assert.equal(document.querySelectorAll('#private-references .private-ref').length,9);
 assert.equal(document.querySelectorAll('#universe-body tr').length,45);
 document.querySelector('[data-period="YTD"]').click();
 assert.equal(window.macroLens.state.period,'YTD');
 assert.ok(document.querySelector('#window-dates').textContent.startsWith('2026-01-01'));
 const search=document.querySelector('#search');search.value='MTUM';
 search.dispatchEvent(new window.Event('input',{bubbles:true}));
 assert.equal(document.querySelectorAll('#universe-body tr').length,1);
 assert.match(document.querySelector('#universe-body').textContent,/Momentum SR Variant/);
 const star=document.querySelector('#universe-body [data-star]');star.click();
 assert.match(localStorage.getItem('macro-lens-stars'),/ETF:MTUM/);
 document.querySelector('#universe-body tr').click();
 assert.ok(document.querySelector('#detail-dialog').hasAttribute('open'));
 assert.ok(document.querySelector('#detail-chart polyline'));
 assert.match(document.querySelector('#detail-content').textContent,/MSCI USA Momentum SR Variant Index/);
 document.querySelector('#detail-dialog [data-close]').click();
 assert.ok(!document.querySelector('#detail-dialog').hasAttribute('open'));
 document.querySelector('#open-method').click();
 assert.ok(document.querySelector('#method-dialog').hasAttribute('open'));
 document.querySelector('#method-dialog [data-close]').click();
 document.querySelector('.insight-card').click();
 assert.ok(document.querySelector('#detail-dialog').hasAttribute('open'));
 assert.match(document.querySelector('#detail-content').textContent,/不是统计显著性|不代表统计显著性/);
 assert.deepEqual(errors,[]);
});
