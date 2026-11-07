export const LABELS = {
 region_global:'Global & regional',region_us:'US equity',region_country:'Countries',factor:'Factors',style:'Style',
 sector_us:'US sectors',sector_global:'Global sectors',industry_theme:'Industries & themes',weighting:'Weighting',
 fixed_income:'Fixed income',option_strategy:'Options',managed_futures:'Managed futures',allocation_strategy:'Allocation',
 defensive_strategy:'Defensive hedges',arbitrage_strategy:'Merger arbitrage',multi_strategy:'Multi-strategy',
 private_markets_listed_proxy:'Listed private-market proxies',private_benchmark:'Private benchmarks',real_assets_listed:'Real assets',
 commodity:'Commodities',fx:'FX',digital_assets:'Digital assets',risk_context:'Risk indicators',
 hedge_fund_benchmark:'Hedge fund benchmarks',index_reference:'Index references'
};
export const COLORS=['#3563e9','#13a08b','#c68939','#8c6dd7','#c95470','#477a91','#73854b','#ad6b45'];
const numeric=(v,d)=>new Intl.NumberFormat('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}).format(v);
export const pct=(v,d=2)=>Number.isFinite(v)?`${v>0?'+':''}${numeric(v,d)}%`:'—';
export const number=(v,d=2)=>Number.isFinite(v)?numeric(v,d):'—';
export const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
export const std=a=>{const m=mean(a);return a.length>1?Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1)):NaN};
export function periodStart(asOf,period){
 const d=new Date(asOf+'T12:00:00Z');
 if(period==='WTD')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
 else if(period==='YTD'){d.setUTCMonth(0);d.setUTCDate(1)}
 else if(period==='QTD'){d.setUTCMonth(Math.floor(d.getUTCMonth()/3)*3);d.setUTCDate(1)}
 else d.setUTCDate(1);
 return d.toISOString().slice(0,10);
}
export function before(points,date){
 for(let i=points.length-1;i>=0;i--)if(points[i][0]<date)return i;
 return -1;
}
export function onOrBefore(points,date){
 for(let i=points.length-1;i>=0;i--)if(points[i][0]<=date)return i;
 return -1;
}
export function periodStats(series,period='MTD',asOf=series?.asOf){
 const p=series?.points;
 if(!p?.length||!asOf)return null;
 const end=onOrBefore(p,asOf),start=before(p,periodStart(asOf,period));
 if(start<0||end<=start)return null;
 // Baseline must genuinely precede the period. New-fund launch returns are not YTD.
 const dayGap=(new Date(periodStart(asOf,period))-new Date(p[start][0]))/86400000;
 if(dayGap>10)return null;
 const logs=[];
 for(let i=Math.max(1,start-62);i<=start;i++)logs.push(Math.log(p[i][1]/p[i-1][1]));
 const logReturn=Math.log(p[end][1]/p[start][1]);
 const vol=std(logs),n=end-start;
 return {return:(Math.exp(logReturn)-1)*100,start:p[start][0],end:p[end][0],observations:n,
         vol:logs.length>=40?vol*Math.sqrt(252)*100:null,
         // Center on the pre-window daily mean so normal cash/bond carry does
         // not masquerade as an unusual price move. This is not a p-value.
         sigma:logs.length>=40&&vol>1e-7?(logReturn-mean(logs)*n)/(vol*Math.sqrt(n)):null,
         expectedReturn:logs.length>=40?(Math.exp(mean(logs)*n)-1)*100:null,
         referenceObservations:logs.length};
}
export function getAsOf(series){
 const dates=Object.values(series).filter(s=>s.points?.length&&s.quality==='ok').map(s=>s.asOf).sort();
 // Most common latest observation avoids one erroneous future bar setting the date.
 const counts=new Map();for(const d of dates)counts.set(d,(counts.get(d)||0)+1);
 return [...counts].sort((a,b)=>b[1]-a[1]||b[0].localeCompare(a[0]))[0]?.[0]||null;
}
export function computeRows(universe,series,period='MTD'){
 const asOf=getAsOf(series);
 return universe.map(u=>{
  const s=u.eligible?series[u.symbol]:null;
  const stats=s?periodStats(s,period,asOf):null;
  const synchronized=!!s&&s.asOf===asOf;
  return {...u,series:s,stats,wtd:s?periodStats(s,'WTD',asOf)?.return:null,
    mtd:s?periodStats(s,'MTD',asOf)?.return:null,ytd:s?periodStats(s,'YTD',asOf)?.return:null,
    asOf:s?.asOf,ready:!!(stats&&synchronized&&s.quality==='ok'),
    status:!u.eligible?'reference':!s?'unavailable':s.quality!=='ok'?'review':!synchronized?'stale':!stats?'short':'ready'}
 });
}
export function alignedPair(a,b,period='MTD',asOf){
 if(!a?.points||!b?.points)return null;
 const endDate=asOf||[a.asOf,b.asOf].sort()[0];
 const bm=new Map(b.points),common=a.points.filter(([d])=>bm.has(d)&&d<=endDate);
 const base=before(common,periodStart(endDate,period));
 if(base<0||common.length-1<=base)return null;
 const first=common[base],last=common.at(-1);
 if((new Date(periodStart(endDate,period))-new Date(first[0]))/86400000>10)return null;
 const ra=last[1]/first[1]-1,rb=bm.get(last[0])/bm.get(first[0])-1;
 const relativeLogs=[];
 for(let i=Math.max(1,base-62);i<=base;i++){
  const [d,v]=common[i],[pd,pv]=common[i-1];
  relativeLogs.push(Math.log(v/pv)-Math.log(bm.get(d)/bm.get(pd)));
 }
 const vol=std(relativeLogs),n=common.length-1-base;
 return {aReturn:ra*100,bReturn:rb*100,gap:(ra-rb)*100,start:first[0],end:last[0],
         sigma:relativeLogs.length>=40&&vol>1e-7?(Math.log((1+ra)/(1+rb))-mean(relativeLogs)*n)/(vol*Math.sqrt(n)):null};
}
export const PAIRS=[
 {a:'RSP',b:'IVV',title:'Equal weight vs cap weight',theme:'Breadth',positive:'Equal weight leads',negative:'Large weights lead',note:'S&P 500 ETF return spread. Equal weighting changes concentration and rebalancing exposure.'},
 {a:'QQQE',b:'QQQ',title:'Nasdaq breadth',theme:'Concentration',positive:'Nasdaq breadth broadens',negative:'Nasdaq leaders dominate',note:'Nasdaq-100 equal-weight versus modified-cap-weight ETF returns.'},
 {a:'IWM',b:'IWB',title:'Small caps vs large caps',theme:'Size',positive:'Small caps outperform',negative:'Large caps outperform',note:'Russell 2000 versus Russell 1000; sector and profitability exposures also differ.'},
 {a:'IWF',b:'IWD',title:'Growth vs value',theme:'Style',positive:'Growth leads value',negative:'Value leads growth',note:'Growth and value ETF returns within the Russell 1000 universe.'},
 {a:'IEMG',b:'URTH',title:'Emerging vs developed',theme:'Regions',positive:'Emerging markets lead',negative:'Developed markets lead',note:'USD returns include FX and differences in country, industry and capitalization coverage.'},
 {a:'TLT',b:'SHY',title:'Long vs short Treasuries',theme:'Duration',positive:'Long duration leads',negative:'Short duration leads',note:'Treasury ETF returns include duration, carry and yield-curve effects.'},
 {a:'HYG',b:'LQD',title:'High yield vs investment grade',theme:'Credit',positive:'High yield outperforms',negative:'Investment grade outperforms',note:'Durations differ. Read alongside OAS; the return spread is not a pure measure of credit risk.'},
 {a:'GLD',b:'IVV',title:'Gold vs US equities',theme:'Cross-asset',positive:'Gold outperforms US equities',negative:'US equities outperform gold',note:'USD gold-trust and equity ETF returns. Price action does not establish a safe-haven or flow narrative.'},
 {a:'RWL',b:'IVV',title:'Revenue vs cap weight',theme:'Weighting',positive:'Revenue weighting leads',negative:'Cap weighting leads',note:'The same S&P 500 constituent universe with different weighting and rebalancing rules.'},
 {a:'DBMF',b:'IVV',title:'Managed futures vs equities',theme:'Trend',positive:'Managed futures outperform',negative:'Equities outperform managed futures',note:'DBMF is an active strategy; it does not replicate the SG CTA Index.'},
 {a:'KMLM',b:'AOR',title:'Systematic trend vs 60/40',theme:'Trend',positive:'Systematic trend leads 60/40',negative:'60/40 leads systematic trend',note:'KMLM tracks the KFA MLM Index. AOR is a global 60/40 allocation proxy; exposures and risk levels differ.'},
 {a:'CTA',b:'AOR',title:'Managed futures vs 60/40',theme:'Trend',positive:'Managed futures lead 60/40',negative:'60/40 leads managed futures',note:'CTA is an active futures strategy. This allocation comparison does not isolate manager skill.'},
 {a:'QYLD',b:'QQQ',title:'Nasdaq buy-write vs Nasdaq-100',theme:'Option income',positive:'Nasdaq buy-write leads',negative:'Nasdaq-100 leads buy-write',note:'Adjusted-close total returns include distributions. Option premia, upside limits and different fees affect the spread.'},
 {a:'XYLD',b:'IVV',title:'S&P buy-write vs S&P 500',theme:'Option income',positive:'S&P buy-write leads',negative:'S&P 500 leads buy-write',note:'XYLD tracks a buy-write index, while IVV tracks equities. The spread is not distribution yield.'},
 {a:'JEPI',b:'IVV',title:'Active equity income vs S&P 500',theme:'Option income',positive:'Active equity income leads',negative:'S&P 500 leads active income',note:'JEPI combines active stock selection and option-related income. It is not a mechanical covered-call index tracker.'},
 {a:'JEPQ',b:'QQQ',title:'Nasdaq income vs Nasdaq-100',theme:'Option income',positive:'Nasdaq income leads',negative:'Nasdaq-100 leads income',note:'JEPQ is actively managed. Equity selection, option exposure and fees all affect the total-return difference.'},
 {a:'BTAL',b:'SGOV',title:'Anti-beta vs T-bills',theme:'Defensive',positive:'Anti-beta leads T-bills',negative:'T-bills lead anti-beta',note:'BTAL holds a long-low-beta, short-high-beta strategy. Cash is an opportunity-cost comparison, not a risk-matched benchmark.'},
 {a:'TAIL',b:'IEF',title:'Tail hedge vs Treasuries',theme:'Defensive',positive:'Tail hedge leads Treasuries',negative:'Treasuries lead tail hedge',note:'TAIL holds puts and Treasuries. IEF has different duration; the spread does not isolate option payoff or hedging efficacy.'},
 {a:'MNA',b:'SGOV',title:'Merger arbitrage vs T-bills',theme:'Arbitrage',positive:'Merger arbitrage leads T-bills',negative:'T-bills lead merger arbitrage',note:'MNA tracks a merger-arbitrage index. Deal risk and liquidity differ from T-bills; the spread is not risk-free alpha.'},
 {a:'QAI',b:'AOR',title:'Multi-strategy vs 60/40',theme:'Multi-strategy',positive:'Multi-strategy leads 60/40',negative:'60/40 leads multi-strategy',note:'QAI is a liquid replication index ETF, not an HFRI tracker. Equity beta and duration differ from AOR.'},
 {a:'RPAR',b:'AOR',title:'Risk parity vs 60/40',theme:'Allocation',positive:'Risk parity leads 60/40',negative:'60/40 leads risk parity',note:'Risk parity and capital-weighted 60/40 have different asset mix, duration and leverage.'},
 {a:'NTSX',b:'AOR',title:'Efficient core vs 60/40',theme:'Allocation',positive:'Efficient core leads 60/40',negative:'60/40 leads efficient core',note:'NTSX uses US equities and Treasury futures; AOR is global. Geography, leverage and duration all affect this allocation comparison.'}
];
export function pairInsights(series,period='MTD',asOf=getAsOf(series)){
 return PAIRS.map(p=>({...p,stats:alignedPair(series[p.a],series[p.b],period,asOf)}))
  .filter(p=>p.stats&&series[p.a]?.asOf===asOf&&series[p.b]?.asOf===asOf
    &&series[p.a]?.quality==='ok'&&series[p.b]?.quality==='ok')
  .map(p=>({...p,score:Math.abs(p.stats.sigma??0),headline:p.stats.gap>=0?p.positive:p.negative}))
  .sort((a,b)=>b.score-a.score);
}
export function selectLeadSignals(pairs,limit=4){
 const families={Breadth:'Equity breadth',Concentration:'Equity breadth',Weighting:'Equity breadth',Size:'Equity style',Style:'Equity style'};
 const selected=[],used=new Set(),comparisons=new Set();
 for(const p of [...pairs].sort((a,b)=>b.score-a.score)){
  if(selected.length>=limit)break;
  if(!Number.isFinite(p.stats?.sigma)||!Number.isFinite(p.stats?.gap)||!Number.isFinite(p.score))continue;
  const family=families[p.theme]||p.theme,key=[p.a,p.b].sort().join('/');
  if(used.has(family)||comparisons.has(key))continue;
  selected.push({...p,family});used.add(family);comparisons.add(key);
 }
 return selected;
}
export function normalized(series,startDate,endDate){
 if(!series?.points)return [];
 const p=series.points.filter(([d])=>!endDate||d<=endDate);
 let base=before(p,startDate);if(base<0)base=0;
 if(!p[base])return [];
 return p.slice(base).map(([d,v])=>[d,v/p[base][1]*100]);
}
export function chartStart(asOf,range='YTD'){
 const d=new Date(asOf+'T12:00:00Z');
 if(range==='YTD'){d.setUTCMonth(0);d.setUTCDate(1)}
 else d.setUTCMonth(d.getUTCMonth()-(range==='1M'?1:range==='6M'?6:3));
 return d.toISOString().slice(0,10);
}
export function indicatorChange(s,period='MTD'){
 if(!s?.points?.length)return null;
 const i=before(s.points,periodStart(s.asOf,period));if(i<0)return null;
 const end=s.points.at(-1),base=s.points[i];
 const scale=s.basis==='percent_rate'?100:1;
 return {value:end[1],change:(end[1]-base[1])*scale,start:base[0],end:end[0],
         unit:s.basis==='percent_rate'?'bp':s.basis==='index_level'?'index pts':'pts'};
}
export function expectedCloseDate(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',
   year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const d=new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
 if(Number(parts.hour)<16||(Number(parts.hour)===16&&Number(parts.minute)<20))d.setUTCDate(d.getUTCDate()-1);
 while([0,6].includes(d.getUTCDay()))d.setUTCDate(d.getUTCDate()-1);
 return d.toISOString().slice(0,10);
}
