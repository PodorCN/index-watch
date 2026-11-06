import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {periodStart,periodStats,alignedPair,computeRows,expectedCloseDate,indicatorChange} from '../worker/analytics.mjs';

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
 assert.equal(Object.keys(s.series).length,235);
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
