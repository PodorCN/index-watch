import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {periodStart,periodStats,alignedPair,computeRows,expectedCloseDate,indicatorChange,selectLeadSignals,pairInsights} from '../worker/analytics.mjs';

test('Weekly and monthly bases precede the window, including year boundaries',()=>{
 assert.equal(periodStart('2026-11-05','WTD'),'2026-11-02');
 assert.equal(periodStart('2026-11-05','MTD'),'2026-11-01');
 assert.equal(periodStart('2026-01-02','YTD'),'2026-01-01');
 const s={asOf:'2026-11-05',points:[['2026-10-30',100],['2026-11-02',105],['2026-11-05',110]]};
 assert.ok(Math.abs(periodStats(s,'WTD').return-10)<1e-9);
 assert.equal(periodStats(s,'MTD').start,'2026-10-30');
});
test('New funds and an old isolated baseline do not acquire fabricated YTD returns',()=>{
 assert.equal(periodStats({asOf:'2026-11-05',points:[['2026-06-01',100],['2026-11-05',110]]},'YTD'),null);
 assert.equal(periodStats({asOf:'2026-11-05',points:[['2026-09-01',100],['2026-11-05',110]]},'MTD'),null);
});
test('Pair comparison aligns both start and end to actual common observations',()=>{
 const a={asOf:'2026-11-05',points:[['2026-10-29',100],['2026-10-30',102],['2026-11-02',110],['2026-11-05',120]]};
 const b={asOf:'2026-11-04',points:[['2026-10-29',200],['2026-11-02',210],['2026-11-04',220]]};
 const x=alignedPair(a,b,'MTD');assert.equal(x.start,'2026-10-29');assert.equal(x.end,'2026-11-02');
 assert.ok(Math.abs(x.gap-5)<1e-8);
});
test('Rates are changes in basis points, not percentage asset returns',()=>{
 const x=indicatorChange({basis:'percent_rate',asOf:'2026-11-05',points:[['2026-10-30',4],['2026-11-05',4.1]]});
 assert.ok(Math.abs(x.change-10)<1e-8);assert.equal(x.unit,'bp');
});
test('An unfinished New York session cannot become the expected completed date',()=>{
 assert.equal(expectedCloseDate(new Date('2026-11-06T17:00:00Z')),'2026-11-05');
 assert.equal(expectedCloseDate(new Date('2026-11-06T21:25:00Z')),'2026-11-06');
 assert.equal(expectedCloseDate(new Date('2026-11-08T17:00:00Z')),'2026-11-06');
});
test('The real seed has synchronized, non-fabricated period returns and enough volatility history',()=>{
 const s=JSON.parse(readFileSync(new URL('../data/snapshot.json',import.meta.url)));
 assert.equal(Object.keys(s.series).length,s.universe.filter(r=>r.eligible).length);
 assert.ok(Object.keys(s.series).length>=245);
 const rows=computeRows(s.universe,s.series,'MTD');
 const ivv=rows.find(r=>r.symbol==='IVV');assert.equal(ivv.status,'ready');
 const points=s.series.IVV.points,base=points.filter(p=>p[0]<'2026-11-01').at(-1),end=points.at(-1);
 assert.ok(Math.abs(ivv.mtd-(end[1]/base[1]-1)*100)<1e-8);
 assert.ok(ivv.stats.referenceObservations>=40);
 assert.equal(rows.filter(r=>r.category==='private_benchmark'&&r.ready).length,0);
});
test('Stale and suspicious histories remain outside the default ranking',()=>{
 const s=JSON.parse(readFileSync(new URL('../data/snapshot.json',import.meta.url)));
 s.series.IVV={...s.series.IVV,asOf:'2026-11-04'};
 s.series.IWM={...s.series.IWM,quality:'review_large_daily_gap'};
 const rows=computeRows(s.universe,s.series,'MTD');
 assert.equal(rows.find(r=>r.symbol==='IVV').ready,false);
 assert.equal(rows.find(r=>r.symbol==='IWM').ready,false);
});
test('Ordinary positive carry is centered before calculating unusualness',()=>{
 const points=[];let v=100;const d=new Date('2026-07-01T12:00:00Z');
 while(d.toISOString().slice(0,10)<='2026-11-05'){
  if(![0,6].includes(d.getUTCDay())){
   v*=Math.exp(.00015+(points.length%2===0?.00001:-.00001));
   points.push([d.toISOString().slice(0,10),v]);
  }
  d.setUTCDate(d.getUTCDate()+1);
 }
 const x=periodStats({points,asOf:'2026-11-05'},'MTD');
 assert.ok(x.return>0,'Normal cash carry still has a positive total return');
 assert.ok(Math.abs(x.sigma)<.2,'Normal carry is not a false 20-sigma anomaly');
});

test('Lead selection keeps the largest move, diversifies themes, and never pads invalid signals',()=>{
 const pair=(a,b,theme,score)=>({a,b,theme,score,stats:{sigma:score,gap:1}});
 const candidates=[pair('A','B','Breadth',5),pair('C','D','Concentration',4.9),pair('B','A','Credit',4.8),pair('E','F','Style',4),pair('G','H','Trend',3),pair('I','J','Arbitrage',2),pair('K','L','Allocation',1)];
 const leads=selectLeadSignals(candidates);
 assert.deepEqual(leads.map(p=>p.a),['A','E','G','I']);
 assert.equal(new Set(leads.map(p=>p.family)).size,4);
 assert.equal(selectLeadSignals([{...candidates[0],stats:{sigma:null,gap:1}}]).length,0);
 assert.equal(selectLeadSignals(candidates.slice(0,2)).length,1,'Overlapping equity-breadth themes do not fill the quota');
});

test('Strategy prices, references and lead selection remain valid across all three return windows',()=>{
 const s=JSON.parse(readFileSync(new URL('../data/snapshot.json',import.meta.url)));
 const strategies=s.universe.filter(r=>r.strategyGroup);
 assert.equal(strategies.length,20);
 assert.equal(new Set(strategies.map(r=>r.strategyGroup)).size,6);
 for(const symbol of ['CTA','WTMF','BTAL','TAIL','MNA','QAI','NTSX','RPAR','JEPI','JEPQ']){
  const row=strategies.find(r=>r.symbol===symbol),history=s.series[symbol];
  assert.ok(row?.sourceUrl.startsWith('https://'));assert.equal(history.quality,'ok');
  assert.equal(history.basis,'adjusted_close_total_return_proxy');assert.ok(history.points.length>=250);
 }
 assert.match(strategies.find(r=>r.symbol==='QAI').notes,/not an HFRI tracker/);
 assert.match(strategies.find(r=>r.symbol==='JEPI').relationship,/active/);
 for(const period of ['WTD','MTD','YTD']){
  const leads=selectLeadSignals(pairInsights(s.series,period));
  assert.equal(leads.length,4);assert.equal(new Set(leads.map(p=>p.family)).size,4);
  for(const p of leads){assert.equal(p.stats.end,s.series.IVV.asOf);assert.ok(Number.isFinite(p.stats.sigma));}
 }
});
