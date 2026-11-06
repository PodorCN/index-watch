import {LABELS,COLORS,pct,number,periodStart,periodStats,computeRows,getAsOf,pairInsights,normalized,chartStart,indicatorChange,expectedCloseDate} from '/analytics.mjs';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?escape(u.href):'#'}catch{return '#'}};
const signClass=v=>Number.isFinite(v)?v>=0?'positive':'negative':'';
const signed=(v,d=2)=>Number.isFinite(v)?`${v>0?'+':''}${v.toFixed(d)}`:'—';
const state={period:'MTD',range:'YTD',data:null,rows:[],pairs:[],asOf:null,query:'',category:'all',status:'daily',
 sort:'mtd',direction:-1,limit:45,refreshing:false,stars:new Set(),version:0};
try{state.stars=new Set(JSON.parse(localStorage.getItem('macro-lens-stars')||'[]').filter(s=>typeof s==='string'))}catch{}
let chartId=0;

function miniSpark(symbol){
 const p=state.data.series[symbol]?.points?.slice(-28)||[];
 if(p.length<2)return '';
 const v=p.map(x=>x[1]),lo=Math.min(...v),span=Math.max(...v)-lo||1;
 const path=v.map((x,i)=>`${(i/(v.length-1)*68).toFixed(2)},${(24-(x-lo)/span*21).toFixed(2)}`).join(' ');
 return `<svg class="spark" viewBox="0 0 70 26" aria-hidden="true"><polyline points="${path}" fill="none" stroke="${v.at(-1)>=v[0]?'#80a992':'#c89476'}" stroke-width="1.6"/></svg>`;
}

function lineChart(id,items,{range='3M',height=240,raw=false,unit='',shade=false,legend=true}={}){
 const el=typeof id==='string'?document.getElementById(id):id;if(!el)return;
 const start=chartStart(state.asOf,range),end=state.asOf;
 let data=items.map((it,i)=>{
  const source=it.points?it:state.data.series[it.symbol];
  const points=source?.points||[];
  return {...it,color:it.color||COLORS[i%COLORS.length],points:raw?points.filter(([d])=>d>=start&&d<=end):normalized(source,start,end)};
 }).filter(it=>it.points.length>1);
 if(!data.length){el.innerHTML='<div class="chart-empty">当前没有足够的已验证历史数据</div>';return}
 const W=720,H=height,L=49,R=17,T=15,B=29,iw=W-L-R,ih=H-T-B;
 const dates=[...new Set(data.flatMap(it=>it.points.map(p=>p[0])))].sort();
 const t0=Date.parse(dates[0]),t1=Date.parse(dates.at(-1));
 const values=data.flatMap(it=>it.points.map(p=>p[1]));
 const min=Math.min(...values),max=Math.max(...values),spread=max-min||Math.abs(max)*.05||1;
 const v0=min-spread*.1,v1=max+spread*.12;
 const x=d=>L+(Date.parse(d)-t0)/(t1-t0||1)*iw,y=v=>T+(v1-v)/(v1-v0)*ih;
 const uid='chart-'+(++chartId);
 const tickNum=raw&&max<10?2:Math.abs(max)>500?0:1;
 let grid='';
 for(let n=0;n<5;n++){
  const v=v0+(v1-v0)*n/4,yy=y(v);
  grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e9ede5" stroke-dasharray="3 4"/><text x="${L-10}" y="${yy+4}" text-anchor="end" fill="#98a28e" font-size="11">${v.toFixed(tickNum)}</text>`;
 }
 const baseline=!raw&&v0<100&&v1>100?`<line x1="${L}" y1="${y(100)}" x2="${W-R}" y2="${y(100)}" stroke="#c6cfc0" stroke-dasharray="3 4"/>`:'';
 let axis='';for(let n=0;n<5;n++){
  const date=dates[Math.round(n*(dates.length-1)/4)];
  axis+=`<text x="${x(date)}" y="${H-5}" text-anchor="${n===0?'start':n===4?'end':'middle'}" fill="#9aa58f" font-size="11">${date.slice(5).replace('-','/')}</text>`;
 }
 const shadeDate=periodStart(state.asOf,state.period);
 const shaded=shade&&shadeDate>=dates[0]&&shadeDate<=dates.at(-1)?`<rect x="${x(shadeDate)}" y="${T}" width="${W-R-x(shadeDate)}" height="${ih}" fill="#e6eddd" opacity=".6"/><text x="${Math.min(x(shadeDate)+5,W-41)}" y="${T+10}" fill="#9aab8b" font-size="9">${state.period}</text>`:'';
 const paths=data.map((it,i)=>`<polyline data-line="${i}" points="${it.points.map(([d,v])=>`${x(d).toFixed(2)},${y(v).toFixed(2)}`).join(' ')}" fill="none" stroke="${it.color}" stroke-width="${height<180?2.1:2.25}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
 el.innerHTML=`<svg id="${uid}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(data.map(it=>it.label||it.symbol).join('、'))}，${escape(dates[0])} 至 ${escape(dates.at(-1))}，${raw?escape(unit):'起点为100'}"><title>${escape(data.map(it=>it.label||it.symbol).join(' / '))}</title>${shaded}${grid}${baseline}${paths}${axis}<line data-crosshair x1="0" y1="${T}" x2="0" y2="${H-B}" stroke="#a6b39c" stroke-dasharray="3 3" opacity="0"/><rect x="${L}" y="${T}" width="${iw}" height="${ih}" fill="transparent" data-hit/></svg>${legend?`<div class="chart-legend">${data.map((it,i)=>`<button type="button" data-legend="${i}" title="点击隐藏或显示曲线" aria-pressed="true"><i class="legend-dot" style="background:${it.color}"></i>${escape(it.label||it.symbol)}</button>`).join('')}</div>`:''}`;
 const svg=el.querySelector('svg'),hit=svg.querySelector('[data-hit]'),cross=svg.querySelector('[data-crosshair]');
 const tip=$('#chart-tooltip');
 hit.addEventListener('pointermove',event=>{
  const rect=svg.getBoundingClientRect(),pos=(event.clientX-rect.left)/rect.width*W;
  const target=t0+Math.max(0,Math.min(1,(pos-L)/iw))*(t1-t0);
  const date=dates.reduce((a,b)=>Math.abs(Date.parse(a)-target)<Math.abs(Date.parse(b)-target)?a:b);
  cross.setAttribute('x1',x(date));cross.setAttribute('x2',x(date));cross.setAttribute('opacity','1');
  tip.innerHTML=`<strong>${date}${raw?'':' · 起点 100'}</strong>${data.map((it,i)=>{
   const v=it.points.find(p=>p[0]===date)?.[1];
   return `<div class="tip-line"><span><i class="legend-dot" style="background:${it.color}"></i>${escape(it.label||it.symbol)}</span><b>${number(v,2)}${raw?' '+escape(unit):''}</b></div>`;
  }).join('')}`;
  tip.hidden=false;tip.style.left=Math.max(6,Math.min(event.clientX+14,window.innerWidth-tip.offsetWidth-10))+'px';
  tip.style.top=Math.max(6,Math.min(event.clientY+14,window.innerHeight-tip.offsetHeight-10))+'px';
 });
 hit.addEventListener('pointerleave',()=>{cross.setAttribute('opacity','0');tip.hidden=true});
 el.querySelectorAll('[data-legend]').forEach(btn=>btn.addEventListener('click',()=>{
  const line=svg.querySelector(`[data-line="${btn.dataset.legend}"]`),off=btn.classList.toggle('legend-off');
  line.style.opacity=off?'0':'1';btn.setAttribute('aria-pressed',String(!off));
 }));
}

function barChart(id,items,{unit='%',relative=false}={}){
 const el=document.getElementById(id),valid=items.filter(it=>Number.isFinite(it.value));
 if(!valid.length){el.innerHTML='<div class="chart-empty">缺少当前窗口的完整数据</div>';return}
 const max=Math.max(.1,...valid.map(it=>Math.abs(it.value)));
 el.innerHTML=valid.map(it=>`<button class="bar-row" data-symbol="${escape(it.symbol||'')}" title="${escape(it.label)} ${signed(it.value)}${unit}"><span class="bar-name">${escape(it.label)}<small>${escape(it.symbol||'')}</small></span><span class="bar-track"><i class="bar-fill" style="background:${it.value>=0?'#7da78f':'#cb8d74'};left:${it.value>=0?'50%':(50-Math.abs(it.value)/max*48)+'%'};width:${Math.abs(it.value)/max*48}%"></i></span><span class="bar-value ${signClass(it.value)}">${signed(it.value)}${unit==='%'?'%':''}</span></button>`).join('');
 el.querySelectorAll('[data-symbol]').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.symbol)));
}

function reanalyze(){
 state.asOf=getAsOf(state.data.series);state.rows=computeRows(state.data.universe,state.data.series,state.period);
 state.pairs=pairInsights(state.data.series,state.period,state.asOf);state.version++;
}
function render(){
 if(!state.data||!state.asOf)return;
 const ready=state.rows.filter(r=>r.ready),sectors=ready.filter(r=>r.category==='sector_us');
 const positives=sectors.filter(r=>r.stats.return>0).length;
 const ivv=state.rows.find(r=>r.symbol==='IVV');
 const daily=state.rows.filter(r=>r.eligible).length;
 const top=state.pairs[0],unusual=state.pairs.filter(p=>p.score>=2).length;
 $('#asof-top').textContent=`数据截至 ${state.asOf} · 日终`;
 $('#window-dates').textContent=`${periodStart(state.asOf,state.period)} → ${state.asOf}`;
 $('#rotation-period').textContent=`${state.period} · 总回报代理`;
 $('#stats').innerHTML=`<div class="stat"><div class="stat-label">美国大盘 <span>IVV · ${state.period}</span></div><div class="stat-value ${signClass(ivv?.stats?.return)}">${pct(ivv?.stats?.return)}</div><div class="stat-foot">S&P 500 总回报代理</div>${miniSpark('IVV')}</div>
 <div class="stat"><div class="stat-label">美股行业广度 <span>${state.period}</span></div><div class="stat-value">${positives}<small> / ${sectors.length} 个行业上涨</small></div><div class="stat-foot">11 个行业 ETF · 不重复计算成份股</div></div>
 <div class="stat"><div class="stat-label">相对分化观察 <span>≥ 2σ 尺度</span></div><div class="stat-value">${unusual}<small> / ${state.pairs.length} 组</small></div><div class="stat-foot">相对此前 63 个交易日波动</div></div>
 <div class="stat"><div class="stat-label">可比较的日频标的 <span>DATA COVERAGE</span></div><div class="stat-value">${ready.length}<small> / ${daily}</small></div><div class="stat-foot">完整基期 · 同步日期 · 通过价格检查</div></div>`;
 $('#brief-title').textContent=top?.headline||'观察市场的分化与共同变化';
 $('#signal-badge').textContent=top?.score>=2?'观察级分化 · ≥2σ':'常规观察';
 $('#brief-copy').textContent=top?`${state.period}，${top.a} 与 ${top.b} 的总回报相差 ${Math.abs(top.stats.gap).toFixed(2)} 个百分点；相对走势偏离此前均值 ${top.score.toFixed(1)} 倍波动尺度。${positives} / ${sectors.length} 个美国行业上涨。建议结合下方图表，确认分化是否持续。`:'当前缺少足够的同步数据，暂不生成自动研究结论。';
 $('#brief-facts').innerHTML=[top?`${top.a} ${pct(top.stats.aReturn)}`:null,top?`${top.b} ${pct(top.stats.bReturn)}`:null,`235 个日频候选`,`${state.period} · USD`].filter(Boolean).map(x=>`<span class="fact-pill">${escape(x)}</span>`).join('');
 renderHero();renderInsights();renderRotation();renderPairs();renderRisk();renderTable();renderPrivate();
 $('#coverage-footer').textContent=`${daily} 个日频候选 · ${state.data.universe.length} 条原始记录 · ${state.asOf}`;
 $('#method-live-status').textContent=`当前快照抓取于 ${new Date(state.data.generatedAt).toLocaleString('zh-CN',{timeZone:'America/Toronto',hour12:false})}（多伦多时间）。当前窗口 ${ready.length}/${daily} 个日频候选可比较。已加载 ${Object.values(state.data.risk).filter(r=>r.points?.length).length} 条风险／宏观指标。`;
}
function renderHero(){
 lineChart('macro-chart',[{symbol:'ACWI',label:'全球股票 ACWI'},{symbol:'TLT',label:'长债 TLT'},
  {symbol:'GLD',label:'黄金 GLD'},{symbol:'HYG',label:'高收益债 HYG'},{symbol:'UUP',label:'美元 UUP'}],{range:state.range,height:274,shade:true});
}
function renderInsights(){
 const selected=[],themes=new Set();
 for(const p of state.pairs){if(!themes.has(p.theme)){selected.push(p);themes.add(p.theme)}if(selected.length===2)break}
 const mover=state.rows.filter(r=>r.ready&&Number.isFinite(r.stats.sigma)).sort((a,b)=>Math.abs(b.stats.sigma)-Math.abs(a.stats.sigma))[0];
 if(!mover&&state.pairs[2])selected.push(state.pairs[2]);
 $('#insight-cards').innerHTML=selected.map((p,i)=>`<article class="insight-card" data-pair="${i}" tabindex="0" role="button" aria-label="查看${escape(p.title)}完整图表"><div class="insight-top"><div class="insight-kicker"><span>0${i+1} / ${escape(p.theme)}</span><span class="signal-label">${p.score.toFixed(1)}σ 尺度</span></div><h3>${escape(p.headline)}</h3><div class="insight-metric"><strong class="${signClass(p.stats.gap)}">${signed(p.stats.gap)}</strong><span>pp · ${state.period} 回报差</span></div></div><div id="insight-chart-${i}" class="mini-chart"></div><div class="insight-footer"><span>过去 3 个月 · 起点 100</span><span>${p.a} / ${p.b} <span>↗</span></span></div></article>`).join('');
 if(mover){
  const parentMap={XES:'XLE',IEZ:'XLE',XOP:'XLE',IEO:'XLE',IXC:'XLE',XBI:'XLV',IBB:'XLV',SOXX:'XLK',SMH:'XLK',KRE:'XLF',KBE:'XLF',ITA:'XLI',XAR:'XLI',XHB:'XLY',ITB:'XLY',QYLD:'QQQ',XYLD:'IVV',RYLD:'IWM'};
  const parent=parentMap[mover.symbol]||(mover.category==='fixed_income'?'AGG':mover.category.startsWith('region_')?'ACWI':'IVV');
  $('#insight-cards').insertAdjacentHTML('beforeend',`<article class="insight-card" data-mover="${escape(mover.symbol)}" tabindex="0" role="button" aria-label="查看全样本异动 ${escape(mover.symbol)}"><div class="insight-top"><div class="insight-kicker"><span>03 / 全样本异动</span><span class="signal-label">${Math.abs(mover.stats.sigma).toFixed(1)}σ 尺度</span></div><h3>${escape(mover.name)}偏离近期常态</h3><div class="insight-metric"><strong class="${signClass(mover.stats.return)}">${pct(mover.stats.return)}</strong><span>${state.period} 总回报</span></div></div><div id="mover-chart" class="mini-chart"></div><div class="insight-footer"><span>扫描全部同步日频标的</span><span>${escape(mover.symbol)} / 参考 ${parent} ↗</span></div></article>`);
  lineChart('mover-chart',[{symbol:mover.symbol,label:mover.symbol},{symbol:parent,label:'参考 '+parent}],{range:'3M',height:155});
  const card=$('[data-mover]');
  card.addEventListener('click',e=>{if(!e.target.closest('[data-legend]'))openDetail(mover.symbol)});
  card.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();openDetail(mover.symbol)}});
 }
 selected.forEach((p,i)=>{
  lineChart('insight-chart-'+i,[{symbol:p.a,label:p.a},{symbol:p.b,label:p.b}],{range:'3M',height:155});
  const card=$(`[data-pair="${i}"]`);
  card.addEventListener('click',e=>{if(!e.target.closest('[data-legend]'))openPair(p)});
  card.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();openPair(p)}});
 });
}
function renderRotation(){
 const ready=state.rows.filter(r=>r.ready);
 barChart('sector-bars',ready.filter(r=>r.category==='sector_us').sort((a,b)=>b.stats.return-a.stats.return)
  .map(r=>({symbol:r.symbol,label:r.name.replace('美国',''),value:r.stats.return})));
 const countries=ready.filter(r=>r.category==='region_country').sort((a,b)=>b.stats.return-a.stats.return);
 const max=Math.max(3,...countries.map(r=>Math.abs(r.stats.return)));
 $('#country-heatmap').innerHTML=countries.map(r=>{
  const strength=Math.min(1,Math.abs(r.stats.return)/max),pos=r.stats.return>=0;
  const color=pos?`rgba(88,149,112,${.09+strength*.3})`:`rgba(194,111,83,${.07+strength*.3})`;
  return `<button class="heat-cell" style="background:${color}" data-symbol="${escape(r.symbol)}" title="${escape(r.name)} · ${r.symbol} · ${state.period} ${pct(r.stats.return)}"><span class="heat-name">${escape(r.name)}<small class="heat-symbol">${r.symbol}</small></span><span class="heat-value ${signClass(r.stats.return)}">${pct(r.stats.return,1)}</span></button>`;
 }).join('');
 $('#country-heatmap').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.symbol)));
 const ivv=state.data.series.IVV;
 const factors=[['MTUM','动量'],['QUAL','行业中性质量'],['VLUE','增强价值'],['USMV','最小波动'],['SIZE','规模倾向'],['LRGF','多因子'],['SPHB','高 Beta'],['HDV','高股息']];
 const pairLookup=(a,b)=>pairFor(a,b);
 barChart('factor-bars',factors.map(([symbol,label])=>({symbol,label,value:pairLookup(symbol,'IVV')?.gap})).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity)),{unit:'pp',relative:true});
 const global=[['ACWI','全球股票'],['URTH','发达市场'],['IEMG','新兴市场'],['IEV','欧洲'],['EWJ','日本'],['GLD','黄金'],['IGF','全球基础设施'],['REET','全球上市地产']];
 barChart('global-bars',global.map(([symbol,label])=>({symbol,label,value:state.rows.find(r=>r.symbol===symbol)?.stats?.return})).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity)));
}
function pairFor(a,b){
 const sa=state.data.series[a],sb=state.data.series[b];
 if(!sa||!sb||sa.asOf!==state.asOf||sb.asOf!==state.asOf||sa.quality!=='ok'||sb.quality!=='ok')return null;
 const x=periodStats(sa,state.period,state.asOf),y=periodStats(sb,state.period,state.asOf);
 if(!x||!y||x.start!==y.start||x.end!==y.end)return null;
 return {gap:x.return-y.return};
}
function renderPairs(){
 $('#pair-grid').innerHTML=state.pairs.map((p,i)=>`<article class="panel pair-card"><button data-pair-index="${i}" title="查看完整对比图"><div class="pair-card-head"><h3>${escape(p.title)}</h3><span class="pair-gap ${signClass(p.stats.gap)}">${signed(p.stats.gap)} <small>pp</small></span></div><div class="pair-labels"><span>${p.a} ${pct(p.stats.aReturn)}</span><span>${p.b} ${pct(p.stats.bReturn)}</span></div><div class="pair-rail"><span style="width:${Math.max(4,Math.min(96,50+p.stats.gap*2.5))}%"></span></div><div class="pair-labels"><span>${escape(p.theme)} · ${p.score.toFixed(1)}σ 尺度</span><span>${p.stats.start} → ${p.stats.end} ↗</span></div><p>${escape(p.note)}</p></button></article>`).join('');
 $('#pair-grid').querySelectorAll('[data-pair-index]').forEach(b=>b.addEventListener('click',()=>openPair(state.pairs[Number(b.dataset.pairIndex)])));
}
function renderRisk(){
 const defs=[['VIX','美股隐含波动 VIX'],['DGS2','美债 2 年'],['DGS10','美债 10 年'],['BAMLH0A0HYM2','高收益信用利差'],['DFII10','美债 10 年实际利率']];
 $('#risk-strip').innerHTML=defs.map(([s,label])=>{
  const data=state.data.risk[s],v=indicatorChange(data,state.period);
  const display=v?data.basis==='percent_rate'&&s.includes('BAML')?`${(v.value*100).toFixed(0)}`:v.value.toFixed(2):'—';
  return `<div class="risk-item"><div class="risk-item-label">${label}</div><div class="risk-item-value">${display}<small>${v?(s.includes('BAML')?'bp':data.basis==='percent_rate'?'%':'点'):''}</small></div><div class="risk-item-foot">${state.period} ${v?signed(v.change,v.unit==='bp'?1:2)+' '+v.unit:'—'} · ${data?.asOf||'未获取'}</div></div>`;
 }).join('');
 const riskItem=(s,label,scale=1)=>({...state.data.risk[s],symbol:s,label:label+` · ${state.data.risk[s]?.asOf||'缺失'}`,
   points:state.data.risk[s]?.points?.map(([d,v])=>[d,v*scale])||[]});
 lineChart('yield-chart',[riskItem('DGS2','2 年'),riskItem('DGS10','10 年')],{range:'6M',height:250,raw:true,unit:'%'});
 lineChart('credit-chart',[riskItem('BAMLH0A0HYM2','高收益 OAS',100),riskItem('BAMLC0A0CM','投资级 OAS',100)],{range:'6M',height:250,raw:true,unit:'bp'});
}

function filteredRows(){
 const query=state.query.toLowerCase();
 return state.rows.filter(r=>{
  if(state.category!=='all'&&r.category!==state.category)return false;
  if(state.status==='daily'&&!r.eligible)return false;
  if(state.status==='ready'&&!r.ready)return false;
  if(state.status==='reference'&&r.eligible)return false;
  if(state.status==='starred'&&!state.stars.has(r.id))return false;
  if(query&&![r.symbol,r.name,r.benchmark,r.fundName,r.region,r.weighting,LABELS[r.category]].join(' ').toLowerCase().includes(query))return false;
  return true;
 }).sort((a,b)=>{
  const av=state.sort==='sigma'?Math.abs(a.stats?.sigma??NaN):a[state.sort],bv=state.sort==='sigma'?Math.abs(b.stats?.sigma??NaN):b[state.sort];
  if(!Number.isFinite(av))return Number.isFinite(bv)?1:a.name.localeCompare(b.name,'zh');
  if(!Number.isFinite(bv))return -1;
  return (av-bv)*state.direction;
 });
}
const statusLabel=r=>({ready:'同步 · 调整后行情',reference:r.frequency?.startsWith('quarterly')?'季度参考基准':'参考指标',unavailable:'暂未获取',stale:'日期滞后',review:'价格跳变待核查',short:'缺少窗口基期'}[r.status]||'—');
function renderTable(){
 const filtered=filteredRows(),shown=filtered.slice(0,state.limit);
 $('#table-count').textContent=`显示 ${shown.length} / ${filtered.length} 条 · ${state.period} 研究窗口`;
 $('#show-more').hidden=shown.length>=filtered.length;
 $('#universe-body').innerHTML=shown.length?shown.map(r=>`<tr tabindex="0" data-record="${escape(r.id)}" aria-label="查看 ${escape(r.symbol||r.name)} 详情"><td><button class="star-button ${state.stars.has(r.id)?'starred':''}" data-star="${escape(r.id)}" aria-label="${state.stars.has(r.id)?'取消关注':'关注'} ${escape(r.symbol||r.name)}">${state.stars.has(r.id)?'★':'☆'}</button></td><td><div class="ticker-cell"><span class="ticker-badge">${escape(r.symbol||'REF')}</span><span class="instrument-name">${escape(r.name)}<small>${escape(r.benchmark)}</small></span></div></td><td class="category-cell">${escape(LABELS[r.category]||r.category)}</td><td class="${signClass(r.wtd)}">${pct(r.wtd)}</td><td class="${signClass(r.mtd)}">${pct(r.mtd)}</td><td class="${signClass(r.ytd)}">${pct(r.ytd)}</td><td>${Number.isFinite(r.stats?.sigma)?`<span class="sigma-badge ${Math.abs(r.stats.sigma)>=2?'elevated':''}">${signed(r.stats.sigma,1)}σ</span>`:'—'}</td><td class="date-cell">${escape(r.asOf||'—')}<br>${escape(statusLabel(r))}</td></tr>`).join(''):'<tr><td colspan="8" class="empty-cell">没有符合条件的标的。试试其他关键词或类别。</td></tr>';
 $('#universe-body').querySelectorAll('[data-record]').forEach(tr=>{
  tr.addEventListener('click',e=>{if(!e.target.closest('[data-star]'))openRecord(tr.dataset.record)});
  tr.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target===tr)openRecord(tr.dataset.record)});
 });
 $('#universe-body').querySelectorAll('[data-star]').forEach(b=>b.addEventListener('click',()=>{
  const id=b.dataset.star;if(state.stars.has(id))state.stars.delete(id);else state.stars.add(id);
  try{localStorage.setItem('macro-lens-stars',JSON.stringify([...state.stars]))}catch{}
  renderTable();
 }));
}
function renderPrivate(){
 $('#private-proxies').innerHTML=['PSP','BIZD'].map(symbol=>{
  const r=state.rows.find(r=>r.symbol===symbol);
  return `<div class="proxy-row"><div><strong>${symbol} · ${escape(r?.name||'')}</strong><br><small>${state.period} · ${r?.asOf||'—'}</small></div><span class="value ${signClass(r?.stats?.return)}">${pct(r?.stats?.return)}</span></div>`;
 }).join('');
 $('#private-references').innerHTML=state.rows.filter(r=>r.category==='private_benchmark').map(r=>`<div class="private-ref"><a href="${safeUrl(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(r.benchmark)} ↗</a><small>${r.frequency.startsWith('quarterly')?'季度':'月度*'}</small></div>`).join('');
}
function openDetail(symbol){const row=state.rows.find(r=>r.symbol===symbol&&r.eligible);if(row)openRecord(row.id)}
function openRecord(id){
 const r=state.rows.find(r=>r.id===id);if(!r)return;
 const rate=state.data.risk[r.symbol];
 const active=r.relationship?.includes('active')||r.relationship?.includes('comparison');
 $('#detail-content').innerHTML=`<div class="eyebrow">${escape(LABELS[r.category]||r.category)} / ${escape(r.symbol||'REFERENCE')}</div><div class="dialog-header"><h2>${escape(r.name)}</h2></div><p class="dialog-subtitle">${escape(r.fundName||r.benchmark)}</p>
 ${r.eligible?`<div class="detail-returns">${[['WTD',r.wtd],['MTD',r.mtd],['YTD',r.ytd]].map(([l,v])=>`<div><label>${l}</label><strong class="${signClass(v)}">${pct(v)}</strong></div>`).join('')}</div><div id="detail-chart" class="line-chart"></div>`:rate?.points?'<div id="detail-chart" class="line-chart"></div>':'<div class="notice">参考基准：尚未验证连续免费日频历史，保留原始发布频率，不生成日频收益排名。</div>'}
 <div class="detail-meta"><div><label>${active?'策略参考基准（非复制目标）':'发行商声明的指数／资产参考'}</label>${escape(r.benchmark)}</div><div><label>数据日期 / 频率</label>${escape(r.asOf||rate?.asOf||'暂无连续历史')} · ${escape(r.frequency)}<br>${escape(statusLabel(r))}</div><div><label>加权方法 / 策略</label>${escape(r.weighting)}</div><div><label>发行商 / 地区</label>${escape(r.issuer)}<br>${escape(r.region==='see_monitoring_role_and_benchmark'?'见指数范围说明':r.region)}</div></div>
 <p class="detail-note">${escape(r.notes)}</p>${r.series?`<p class="detail-note">价格来源：Yahoo Finance adjusted close · 已剔除未结束的交易日 · ${r.series.observations||r.series.points?.length} 个观察。${r.series.fallback?'当前显示保留快照，最新抓取未成功。':''} 抓取时间：${escape(new Date(r.series.fetchedAt).toLocaleString('zh-CN',{timeZone:'America/Toronto',hour12:false}))}（多伦多）。</p>`:''}
 <div class="detail-source"><a href="${safeUrl(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">官方指数／基金资料 ↗</a>${r.series?`<a href="${safeUrl(r.series.sourceUrl)}" target="_blank" rel="noopener noreferrer">历史行情来源 ↗</a>`:''}${rate?.sourceUrl?`<a href="${safeUrl(rate.sourceUrl)}" target="_blank" rel="noopener noreferrer">官方指标历史 ↗</a>`:''}</div>`;
 if(r.series)lineChart('detail-chart',[{symbol:r.symbol,label:r.symbol}],{range:'YTD',height:270,shade:true});
 else if(rate?.points)lineChart('detail-chart',[{...rate,label:r.symbol}],{range:'6M',height:260,raw:true,unit:rate.basis==='percent_rate'?'%':'点'});
 $('#detail-dialog').showModal();
}
function openPair(p){
 $('#detail-content').innerHTML=`<div class="eyebrow">RELATIVE PERFORMANCE / ${escape(p.theme)}</div><div class="dialog-header"><h2>${escape(p.title)}</h2></div><p class="dialog-subtitle">过去 6 个月的调整收盘价轨迹，统一起点 = 100</p><div class="detail-returns"><div><label>${p.a} · ${state.period}</label><strong class="${signClass(p.stats.aReturn)}">${pct(p.stats.aReturn)}</strong></div><div><label>${p.b} · ${state.period}</label><strong class="${signClass(p.stats.bReturn)}">${pct(p.stats.bReturn)}</strong></div><div><label>总回报差</label><strong class="${signClass(p.stats.gap)}">${signed(p.stats.gap)} pp</strong></div></div><div id="detail-chart" class="line-chart"></div><p class="detail-note">${escape(p.note)}</p><div class="notice">${state.period} 回报基期 ${p.stats.start}，终点 ${p.stats.end}。相对波动尺度 ${p.score.toFixed(2)}σ，使用窗口开始之前最多 63 个交易日的相对收益均值与波动；已扣除此前日均收益的累积，不代表统计显著性或预测胜率。</div><div class="detail-source"><a href="https://finance.yahoo.com/quote/${p.a}/history/" target="_blank" rel="noopener noreferrer">${p.a} 历史 ↗</a><a href="https://finance.yahoo.com/quote/${p.b}/history/" target="_blank" rel="noopener noreferrer">${p.b} 历史 ↗</a></div>`;
 lineChart('detail-chart',[{symbol:p.a,label:p.a},{symbol:p.b,label:p.b}],{range:'6M',height:295,shade:true});
 $('#detail-dialog').showModal();
}

async function refreshData({automatic=false}={}){
 if(state.refreshing||!state.data)return;
 if(automatic&&state.asOf>=expectedCloseDate())return;
 let lastAttempt=0;try{lastAttempt=Number(sessionStorage.getItem('macro-last-attempt')||0)}catch{}
 if(automatic&&Date.now()-lastAttempt<3*3600000)return;
 state.refreshing=true;$('#refresh').disabled=true;$('#refresh-icon').classList.add('spinning');
 const message=$('#update-message');message.hidden=false;message.textContent='正在检查公开来源的新完整交易日…';
 try{sessionStorage.setItem('macro-last-attempt',String(Date.now()))}catch{}
 const jobs=[...state.data.universe.filter(r=>r.eligible).map(r=>({symbol:r.symbol,kind:'series'})),
   ...Object.keys(state.data.risk).map(symbol=>({symbol,kind:'risk'}))];
 let i=0,done=0,success=0,failed=0,newer=0;
 const runner=async()=>{while(i<jobs.length){
  const job=jobs[i++];
  try{
   const response=await fetch(`/api/history?symbol=${encodeURIComponent(job.symbol)}&kind=${job.kind}`,{signal:AbortSignal.timeout(28000)});
   if(!response.ok)throw Error('Source unavailable');
   const value=await response.json();
   if(!value.points?.length||value.fallback||value.quality==='review_large_daily_gap')throw Error('No newly verified history');
   const current=(job.kind==='series'?state.data.series:state.data.risk)[job.symbol];
   if(!current?.asOf||value.asOf>=current.asOf){
    if(value.asOf>current?.asOf)newer++;
    (job.kind==='series'?state.data.series:state.data.risk)[job.symbol]=value;
   }
   success++;
  }catch{failed++}
  done++;message.textContent=`正在核对 ${done}/${jobs.length} 个来源 · 成功 ${success} · 保留快照 ${failed}`;
 }};
 await Promise.all(Array.from({length:5},runner));
 if(success){state.data.generatedAt=new Date().toISOString();reanalyze();render();try{localStorage.setItem('macro-lens-snapshot',JSON.stringify(state.data))}catch{}}
 message.textContent=`检查完成：${success} 个来源可读取，${newer} 个序列有新交易日${failed?`；${failed} 个来源暂不可用，保留带日期快照`:''}。资产数据截至 ${state.asOf}。`;
 state.refreshing=false;$('#refresh').disabled=false;$('#refresh-icon').classList.remove('spinning');
}

function wire(){
 $('#periods').addEventListener('click',e=>{
  const b=e.target.closest('[data-period]');if(!b)return;
  state.period=b.dataset.period;state.sort=state.period.toLowerCase();state.limit=45;
  $$('#periods button').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b))});
  reanalyze();render();
 });
 $('#hero-ranges').addEventListener('click',e=>{
  const b=e.target.closest('[data-range]');if(!b)return;state.range=b.dataset.range;
  $$('#hero-ranges button').forEach(x=>x.classList.toggle('selected',x===b));renderHero();
 });
 $('#refresh').addEventListener('click',()=>refreshData());
 ['open-method','footer-method'].forEach(id=>document.getElementById(id).addEventListener('click',()=>$('#method-dialog').showModal()));
 $$('dialog').forEach(d=>{d.querySelector('[data-close]').addEventListener('click',()=>d.close());d.addEventListener('click',e=>{if(e.target===d)d.close()});d.addEventListener('close',()=>{$('#chart-tooltip').hidden=true})});
 $('#search').addEventListener('input',e=>{state.query=e.target.value;state.limit=45;renderTable()});
 $('#category-filter').innerHTML+=[...new Set(state.data.universe.map(r=>r.category))].sort((a,b)=>(LABELS[a]||a).localeCompare(LABELS[b]||b,'zh')).map(c=>`<option value="${c}">${escape(LABELS[c]||c)}</option>`).join('');
 $('#category-filter').addEventListener('change',e=>{state.category=e.target.value;state.limit=45;renderTable()});
 $('#status-filter').addEventListener('change',e=>{state.status=e.target.value;state.limit=45;renderTable()});
 $$('[data-sort]').forEach(b=>b.addEventListener('click',()=>{if(state.sort===b.dataset.sort)state.direction*=-1;else{state.sort=b.dataset.sort;state.direction=-1}renderTable()}));
 $('#show-more').addEventListener('click',()=>{state.limit+=60;renderTable()});
 $('#export-csv').addEventListener('click',()=>{
  const fields=['symbol','name','benchmark','category','wtd','mtd','ytd','asOf','status','sourceUrl'];
  const cell=v=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
  const csv='\uFEFF'+[fields.join(','),...filteredRows().map(r=>fields.map(k=>cell(r[k])).join(','))].join('\r\n');
  const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=`macro-lens-${state.period}-${state.asOf}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
 });
 const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){$$('.nav-item').forEach(a=>a.classList.toggle('active',a.hash==='#'+e.target.id))}},{rootMargin:'-10% 0px -65% 0px'});
 $$('.section').forEach(s=>observer.observe(s));
 setInterval(()=>refreshData({automatic:true}),30*60*1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshData({automatic:true})});
}
async function boot(){
 try{
  const response=await fetch('/api/snapshot');if(!response.ok)throw new Error('快照暂不可读');
  state.data=await response.json();
  try{
   const cached=JSON.parse(localStorage.getItem('macro-lens-snapshot')||'null');
   if(cached?.methodologyVersion===state.data.methodologyVersion&&cached.generatedAt>state.data.generatedAt
     &&cached.universe?.length===state.data.universe.length&&Object.keys(cached.series||{}).length>=200)state.data=cached;
  }catch{}
  reanalyze();wire();render();
  window.macroLens={get state(){return {period:state.period,asOf:state.asOf,ready:state.rows.filter(r=>r.ready).length,total:state.data.universe.length}}};
  refreshData({automatic:true});
 }catch(error){
  $('#error-banner').hidden=false;$('#error-banner').textContent='研究快照暂时无法读取。请刷新页面重试；当前不会显示未经验证的行情。';
  $('#stats').innerHTML='<div class="loading-state">没有加载成功的数据，暂不生成排名。</div>';
  $('#refresh').disabled=true;console.error(error);
 }
}
boot();
