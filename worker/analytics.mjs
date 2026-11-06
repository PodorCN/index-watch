export const LABELS = {
 region_global:'全球与区域',region_us:'美国宽基',region_country:'国家与市场',factor:'因子',style:'成长与价值',
 sector_us:'美国行业',sector_global:'全球行业',industry_theme:'细分行业与主题',weighting:'加权方法',
 fixed_income:'固定收益',option_strategy:'期权策略',managed_futures:'管理期货',allocation_strategy:'资产配置',
 private_markets_listed_proxy:'私募上市代理',private_benchmark:'私募参考基准',real_assets_listed:'上市实物资产',
 commodity:'商品',fx:'外汇',digital_assets:'数字资产',risk_context:'风险指标',
 hedge_fund_benchmark:'对冲基金基准',index_reference:'指数参考'
};
export const COLORS=['#155e63','#bd7749','#426ca9','#8373a0','#789147','#d15b62','#313e51','#b19751'];
export const pct=(v,d=2)=>Number.isFinite(v)?`${v>0?'+':''}${v.toFixed(d)}%`:'—';
export const number=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):'—';
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
 {a:'RSP',b:'IVV',title:'等权 vs 市值加权',theme:'市场广度',positive:'等权领先，表现向更多成份股扩散',negative:'市值加权领先，龙头集中度值得关注',note:'同属 S&P 500；等权与市值加权的实际 ETF 总回报差。'},
 {a:'QQQE',b:'QQQ',title:'Nasdaq 等权 vs 市值',theme:'科技集中度',positive:'Nasdaq 等权领先，科技表现更均衡',negative:'Nasdaq 龙头领先，权重集中效应增强',note:'同属 Nasdaq 100；比较两种加权方法。'},
 {a:'IWM',b:'IWB',title:'小盘 vs 大盘',theme:'风险偏好',positive:'小盘相对走强，风险偏好出现扩散',negative:'大盘相对占优，小盘参与度偏弱',note:'Russell 2000 与 Russell 1000；包含行业及盈利结构差异。'},
 {a:'IWF',b:'IWD',title:'成长 vs 价值',theme:'风格轮动',positive:'成长领先价值，风格差异扩大',negative:'价值领先成长，风格轮动值得跟踪',note:'Russell 1000 内成长／价值的 ETF 实际表现。'},
 {a:'IEMG',b:'URTH',title:'新兴 vs 发达市场',theme:'全球轮动',positive:'新兴市场领先发达市场',negative:'发达市场领先新兴市场',note:'均为美元报价，包含汇率变化及国家行业结构差异。'},
 {a:'TLT',b:'SHY',title:'长久期 vs 短久期',theme:'利率敏感度',positive:'长久期美债跑赢短端',negative:'短久期美债相对抗跌',note:'期限回报差包含久期、票息与曲线形状影响；不是纯利率因果识别。'},
 {a:'HYG',b:'LQD',title:'高收益债 vs 投资级债',theme:'信用与久期',positive:'高收益债领先投资级债',negative:'投资级债领先高收益债',note:'两者久期不同；同时参考 FRED 信用利差，不能把回报差视为纯信用溢价。'},
 {a:'GLD',b:'IVV',title:'黄金 vs 美国股票',theme:'跨资产配置',positive:'黄金相对股票走强',negative:'美国股票相对黄金走强',note:'黄金信托与股票 ETF 的美元总回报代理；不自动归因于避险需求。'},
 {a:'RWL',b:'IVV',title:'收入加权 vs 市值加权',theme:'基本面加权',positive:'收入加权相对领先',negative:'市值加权相对领先收入加权',note:'同一 S&P 500 成份范围，不同权重及再平衡规则。'},
 {a:'DBMF',b:'IVV',title:'管理期货 vs 股票',theme:'策略分散',positive:'管理期货相对股票占优',negative:'股票领先管理期货',note:'DBMF 是主动管理期货策略，比较表现不代表复制 SG CTA 指数。'}
];
export function pairInsights(series,period='MTD',asOf=getAsOf(series)){
 return PAIRS.map(p=>({...p,stats:alignedPair(series[p.a],series[p.b],period,asOf)}))
  .filter(p=>p.stats&&series[p.a]?.asOf===asOf&&series[p.b]?.asOf===asOf
    &&series[p.a]?.quality==='ok'&&series[p.b]?.quality==='ok')
  .map(p=>({...p,score:Math.abs(p.stats.sigma??0),headline:p.stats.gap>=0?p.positive:p.negative}))
  .sort((a,b)=>b.score-a.score);
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
         unit:s.basis==='percent_rate'?'bp':s.basis==='index_level'?'指数点':'点'};
}
export function expectedCloseDate(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',
   year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const d=new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
 if(Number(parts.hour)<16||(Number(parts.hour)===16&&Number(parts.minute)<20))d.setUTCDate(d.getUTCDate()-1);
 while([0,6].includes(d.getUTCDay()))d.setUTCDate(d.getUTCDate()-1);
 return d.toISOString().slice(0,10);
}
