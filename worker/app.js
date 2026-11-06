import {LABELS,COLORS,pct,number,periodStart,periodStats,computeRows,getAsOf,pairInsights,normalized,chartStart,indicatorChange} from '/analytics.mjs?v=3';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?escape(u.href):'#'}catch{return '#'}};
const signClass=v=>Number.isFinite(v)?v>=0?'positive':'negative':'';
const signed=(v,d=2)=>Number.isFinite(v)?`${v>0?'+':''}${number(v,d)}`:'—';
const date=(s,short=false)=>s?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',...(short?{}:{year:'numeric'}),timeZone:'UTC'}).format(new Date(s.slice(0,10)+'T12:00:00Z')):'—';
const VIEWS={overview:'Market brief',markets:'Market rotation',relative:'Relative performance',rates:'Rates & credit',universe:'Instrument universe'};
const SECTORS={XLK:'Technology',XLF:'Financials',XLV:'Health care',XLE:'Energy',XLC:'Communication',XLY:'Discretionary',XLP:'Staples',XLI:'Industrials',XLB:'Materials',XLU:'Utilities',XLRE:'Real estate'};
const NAMES={IVV:'S&P 500',ACWI:'Global equities',URTH:'Developed markets',IEMG:'Emerging markets',IXUS:'Global ex-US',TLT:'20+Y Treasuries',SHY:'1–3Y Treasuries',IEF:'7–10Y Treasuries',SHV:'0–1Y Treasuries',SGOV:'0–3M Treasuries',BIL:'1–3M T-bills',GLD:'Gold',IAU:'Gold',SLV:'Silver',UUP:'US dollar',HYG:'US high yield',LQD:'US investment grade',AGG:'US aggregate bonds',RSP:'S&P 500 equal weight',QQQ:'Nasdaq-100',QQQE:'Nasdaq-100 equal weight',MTUM:'US momentum',QUAL:'US quality',VLUE:'US value factor',USMV:'US minimum volatility',SIZE:'US size factor',LRGF:'US multifactor',SPHB:'US high beta',HDV:'US high dividend',IWF:'Large-cap growth',IWD:'Large-cap value',IWM:'US small caps',IWB:'US large caps',PSP:'Listed private equity',BIZD:'Listed BDCs',XES:'Oil & gas services',IEZ:'Oil equipment & services',XOP:'Oil & gas exploration',IEO:'Oil & gas producers',XBI:'Biotechnology',IBB:'Biotechnology',SOXX:'Semiconductors',SMH:'Semiconductors',KRE:'Regional banks',KBE:'Banks',ITA:'Aerospace & defense',XAR:'Aerospace & defense',XHB:'Homebuilders',ITB:'Home construction',QYLD:'Nasdaq covered calls',XYLD:'S&P 500 covered calls',RYLD:'Russell 2000 covered calls',DBMF:'Managed futures',KMLM:'Systematic trend',REET:'Global REITs',IGF:'Global infrastructure',IEV:'Europe',EWJ:'Japan'};
function nameFor(u){return SECTORS[u.symbol]||NAMES[u.symbol]||(u.fundName||u.benchmark||u.symbol).replace(/^(?:State Street[® ]*|iShares\s+|Invesco\s+|WisdomTree\s+|Global X\s+|VanEck\s+|SPDR[® ]*|KraneShares\s+|abrdn\s+)+/g,'').replace(/[®™℠]/g,'').replace(/\s+(?:ETF|Fund|Trust)\b/g,'').replace(/\s+/g,' ').trim()}
const state={data:null,rows:[],pairs:[],asOf:null,period:'MTD',range:'YTD',leadRange:'3M',view:'overview',query:'',category:'all',status:'daily',sort:'mtd',direction:-1,limit:45,refreshing:false,stars:new Set()};
try{state.stars=new Set(JSON.parse(localStorage.getItem('macro-lens-stars')||'[]').filter(x=>typeof x==='string'))}catch{}
let chartId=0;
function lineChart(id,items,{range='3M',height=240,raw=false,unit='',shade=false,legend=true,dark=false}={}){
 const el=typeof id==='string'?document.getElementById(id):id;if(!el)return;
 const start=chartStart(state.asOf,range),end=state.asOf;
 let data=items.map((it,i)=>{
  const source=it.points?it:state.data.series[it.symbol];
  const points=source?.points||[];
  return {...it,color:it.color||COLORS[i%COLORS.length],points:raw?points.filter(([d])=>d>=start&&d<=end):normalized(source,start,end)};
 }).filter(it=>it.points.length>1);
 if(!data.length){el.innerHTML='<div class="chart-empty">Insufficient verified history</div>';return}
 const W=720,H=height,L=49,R=17,T=15,B=29,iw=W-L-R,ih=H-T-B;
 const dates=[...new Set(data.flatMap(it=>it.points.map(p=>p[0])))].sort();
 const t0=Date.parse(dates[0]),t1=Date.parse(dates.at(-1));
 const values=data.flatMap(it=>it.points.map(p=>p[1]));
 const min=Math.min(...values),max=Math.max(...values),spread=max-min||Math.abs(max)*.05||1;
 const v0=min-spread*.1,v1=max+spread*.12;
 const x=d=>L+(Date.parse(d)-t0)/(t1-t0||1)*iw,y=v=>T+(v1-v)/(v1-v0)*ih;
 const uid='chart-'+(++chartId);
 const tickNum=raw&&max<10?2:Math.abs(max)>500?0:1;
 const gridColor=dark?'#38515e':'#e8edf5',axisColor=dark?'#aebfbe':'#64748b';
 let grid='';
 for(let n=0;n<5;n++){
  const v=v0+(v1-v0)*n/4,yy=y(v);
  grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="${gridColor}" stroke-dasharray="3 4"/><text x="${L-10}" y="${yy+4}" text-anchor="end" fill="${axisColor}" font-size="11">${v.toFixed(tickNum)}</text>`;
 }
 const baseline=!raw&&v0<100&&v1>100?`<line x1="${L}" y1="${y(100)}" x2="${W-R}" y2="${y(100)}" stroke="${dark?'#66818a':'#d1dbea'}" stroke-dasharray="3 4"/>`:'';
 let axis='';for(let n=0;n<5;n++){
  const date=dates[Math.round(n*(dates.length-1)/4)];
  axis+=`<text x="${x(date)}" y="${H-5}" text-anchor="${n===0?'start':n===4?'end':'middle'}" fill="${axisColor}" font-size="11">${date.slice(5).replace('-','/')}</text>`;
 }
 const shadeDate=[periodStart(state.asOf,state.period),dates[0]].sort().at(-1);
 const shaded=shade&&shadeDate>=dates[0]&&shadeDate<=dates.at(-1)?`<rect x="${x(shadeDate)}" y="${T}" width="${W-R-x(shadeDate)}" height="${ih}" fill="${dark?'#789799':'#eaf0fd'}" opacity="${dark?'.14':'.6'}"/><text x="${Math.min(x(shadeDate)+5,W-41)}" y="${T+10}" fill="${dark?'#b9cfcd':'#8ca4d5'}" font-size="9">${state.period}</text>`:'';
 const paths=data.map((it,i)=>`<polyline data-line="${i}" points="${it.points.map(([d,v])=>`${x(d).toFixed(2)},${y(v).toFixed(2)}`).join(' ')}" fill="none" stroke="${it.color}" stroke-width="${height<180?2.1:2.25}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
 el.innerHTML=`<svg id="${uid}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(data.map(it=>it.label||it.symbol).join(', '))}; ${escape(dates[0])} to ${escape(dates.at(-1))}; ${raw?escape(unit):'Rebased to 100'}"><title>${escape(data.map(it=>it.label||it.symbol).join(' / '))}</title>${shaded}${grid}${baseline}${paths}${axis}<line data-crosshair x1="0" y1="${T}" x2="0" y2="${H-B}" stroke="#9cafcc" stroke-dasharray="3 3" opacity="0"/><rect x="${L}" y="${T}" width="${iw}" height="${ih}" fill="transparent" data-hit/></svg>${legend?`<div class="chart-legend">${data.map((it,i)=>`<button type="button" data-legend="${i}" title="Show or hide series" aria-pressed="true"><i class="legend-dot" style="background:${it.color}"></i>${escape(it.label||it.symbol)}</button>`).join('')}</div>`:''}`;
 const svg=el.querySelector('svg'),hit=svg.querySelector('[data-hit]'),cross=svg.querySelector('[data-crosshair]');
 const tip=$('#chart-tooltip');
 hit.addEventListener('pointermove',event=>{
  const rect=svg.getBoundingClientRect(),pos=(event.clientX-rect.left)/rect.width*W;
  const target=t0+Math.max(0,Math.min(1,(pos-L)/iw))*(t1-t0);
  const date=dates.reduce((a,b)=>Math.abs(Date.parse(a)-target)<Math.abs(Date.parse(b)-target)?a:b);
  cross.setAttribute('x1',x(date));cross.setAttribute('x2',x(date));cross.setAttribute('opacity','1');
  tip.innerHTML=`<strong>${date}${raw?'':' / rebased 100'}</strong>${data.map((it,i)=>{
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



function barChart(id,items,{unit='%'}={}){
 const el=document.getElementById(id),valid=items.filter(it=>Number.isFinite(it.value));
 if(!valid.length){el.innerHTML='<div class="chart-empty">No comparable data for this period.</div>';return}
 const max=Math.max(.1,...valid.map(it=>Math.abs(it.value)));
 el.innerHTML=valid.map(it=>`<button class="bar-row" data-symbol="${escape(it.symbol)}" title="${escape(it.label)} ${signed(it.value)} ${unit}"><span class="bar-name">${escape(it.label)}<small>${escape(it.symbol)}</small></span><span class="bar-track"><i class="bar-fill" style="background:${it.value>=0?'#76ac9c':'#d58a98'};left:${it.value>=0?'50%':(50-Math.abs(it.value)/max*48)+'%'};width:${Math.abs(it.value)/max*48}%"></i></span><span class="bar-value ${signClass(it.value)}">${signed(it.value)}${unit==='%'?'%':''}</span></button>`).join('');
 el.querySelectorAll('[data-symbol]').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.symbol)));
}
function reanalyze(){
 state.data.universe=state.data.universe.map(u=>({...u,name:nameFor(u)}));
 state.asOf=getAsOf(state.data.series);state.rows=computeRows(state.data.universe,state.data.series,state.period);
 state.pairs=pairInsights(state.data.series,state.period,state.asOf);
}
function readURL(){
 const u=new URL(window.location.href),p=u.searchParams;
 state.view=Object.hasOwn(VIEWS,u.hash.slice(1))?u.hash.slice(1):'overview';
 state.period=['WTD','MTD','YTD'].includes(p.get('period'))?p.get('period'):'MTD';
 state.range=['1M','3M','YTD'].includes(p.get('range'))?p.get('range'):'YTD';
 state.query=p.get('q')||'';
 state.category=state.data.universe.some(r=>r.category===p.get('category'))?p.get('category'):'all';
 state.status=['daily','all','ready','reference','starred'].includes(p.get('coverage'))?p.get('coverage'):'daily';
 state.sort=['wtd','mtd','ytd','sigma'].includes(p.get('sort'))?p.get('sort'):state.period.toLowerCase();
}
function syncURL(push=false){
 const u=new URL(window.location.href);u.hash=state.view;
 for(const [k,v,def] of [['period',state.period,'MTD'],['range',state.range,'YTD'],['q',state.query,''],['category',state.category,'all'],['coverage',state.status,'daily'],['sort',state.sort,state.period.toLowerCase()]]){
  if(v===def)u.searchParams.delete(k);else u.searchParams.set(k,v);
 }
 if(push)window.history.pushState({},'',u);else window.history.replaceState({},'',u);
}
function navigate(view,push=true){
 if(!Object.hasOwn(VIEWS,view))return;state.view=view;
 $$('.view').forEach(s=>s.hidden=s.id!==view);
 $$('#main-nav a').forEach(a=>{const active=a.hash==='#'+view;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 $('#view-title').textContent=VIEWS[view];syncURL(push);renderView();
 $('#chart-tooltip').hidden=true;
}
function render(){
 if(!state.asOf)return;
 const ready=state.rows.filter(r=>r.ready),sectors=ready.filter(r=>r.category==='sector_us');
 $('#asof-top').textContent=`As of ${date(state.asOf)}`;
 $('#coverage-footer').textContent=`${ready.length} / 235 comparable instruments`;
 $('#stats').innerHTML=`<div class="stat"><span class="stat-label">S&P 500</span><span class="stat-value ${signClass(state.rows.find(r=>r.symbol==='IVV')?.stats?.return)}">${pct(state.rows.find(r=>r.symbol==='IVV')?.stats?.return)}<small>${state.period}</small></span></div><div class="stat"><span class="stat-label">Sectors positive</span><span class="stat-value">${sectors.filter(r=>r.stats.return>0).length}<small>/ ${sectors.length}</small></span></div><div class="stat"><span class="stat-label">Relative ≥2σ</span><span class="stat-value">${state.pairs.filter(p=>p.score>=2).length}<small>/ ${state.pairs.length} pairs</small></span></div><div class="stat"><span class="stat-label"><i class="coverage-dot"></i>Coverage</span><span class="stat-value">${ready.length}<small>/ 235</small></span></div>`;
 $('#benchmark-tape').innerHTML=[['IVV','US equities'],['TLT','US Treasuries'],['GLD','Gold'],['UUP','US dollar'],['VIX','Equity volatility']].map(([s,label])=>{
  const r=state.rows.find(r=>r.symbol===s&&r.eligible),v=s==='VIX'?indicatorChange(state.data.risk.VIX,state.period):null;
  return `<button class="benchmark-item" data-benchmark="${s}"><span><span class="benchmark-name">${label}</span><span class="benchmark-symbol">${s}</span></span><span class="benchmark-return ${s==='VIX'?'':signClass(r?.stats?.return)}">${s==='VIX'?number(v?.value):pct(r?.stats?.return)}<small>${s==='VIX'?'index level':state.period}</small></span></button>`;
 }).join('');
 $('#benchmark-tape').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.benchmark)));
 $$('#periods button').forEach(b=>{b.classList.toggle('selected',b.dataset.period===state.period);b.setAttribute('aria-pressed',String(b.dataset.period===state.period))});
 $$('[data-window-label]').forEach(e=>e.textContent=state.period+' return');
 const checked=state.data.lastCheckedAt;
 $('#last-checked').textContent=checked?`Checked ${new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}).format(new Date(checked))} ET`:'';
 $('#method-live-status').textContent=`Bundled snapshot: ${date(state.data.generatedAt)}. ${checked?'Last source check: '+new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Toronto'}).format(new Date(checked))+' ET. ':''}${ready.length} comparable daily series. Source checks do not change the observation dates.`;
 renderView();
}
function renderView(){
 if(!state.data)return;
 if(state.view==='overview'){renderLead();renderHero();renderMovers();renderFocus();renderRibbon()}
 else if(state.view==='markets')renderMarkets();
 else if(state.view==='relative')renderPairs();
 else if(state.view==='rates')renderRisk();
 else if(state.view==='universe'){renderTable();renderReferences()}
}
function renderLead(){
 const p=state.pairs[0],story=$('#lead-story');story.hidden=!p;if(!p)return;
 const positive=p.stats.gap>=0;
 const winner=positive?p.a:p.b,laggard=positive?p.b:p.a,colors=['#edcb80','#8abed0'];
 $('#lead-eyebrow').textContent=p.score>=2?'Lead relative signal':'Largest relative deviation';
 $('#lead-period').textContent=state.period;
 $('#lead-title').textContent=positive?p.positive:p.negative;
 $('#lead-value').textContent=number(Math.abs(p.stats.gap),2);
 $('#lead-legs').innerHTML=[winner,laggard].map((symbol,i)=>`<div class="lead-leg"><span class="lead-leg-label"><i class="legend-dot" style="background:${colors[i]}"></i>${escape(symbol)} <small>${i?'Laggard':'Leader'}</small></span><strong>${pct(symbol===p.a?p.stats.aReturn:p.stats.bReturn)}</strong><small>${escape(nameFor(state.rows.find(r=>r.symbol===symbol)||{symbol}))}</small></div>`).join('');
 $('#lead-score').innerHTML=`<span class="lead-score" title="Absolute deviation from the pre-window mean, scaled by relative volatility. Ranking heuristic, not a significance test.">${number(p.score,1)}σ<span>vs prior 63 sessions</span></span>`;
 $('#lead-details').onclick=()=>openPair(p);
 $('#lead-chart-label').textContent=`${winner} / ${laggard} · rebased 100`;
 $('#lead-window').textContent=`${date(p.stats.start,true)} — ${date(p.stats.end,true)}`;
 $$('#lead-ranges button').forEach(b=>{const active=b.dataset.range===state.leadRange;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active))});
 lineChart('lead-chart',[{symbol:winner,label:nameFor(state.rows.find(r=>r.symbol===winner)||{symbol:winner}),color:colors[0]},{symbol:laggard,label:nameFor(state.rows.find(r=>r.symbol===laggard)||{symbol:laggard}),color:colors[1]}],{range:state.leadRange,height:330,dark:true,shade:true});
}
function renderHero(){
 $$('#hero-ranges button').forEach(b=>{b.classList.toggle('selected',b.dataset.range===state.range);b.setAttribute('aria-pressed',String(b.dataset.range===state.range))});
 lineChart('macro-chart',[{symbol:'ACWI',label:'Global equities'},{symbol:'TLT',label:'Treasuries'},{symbol:'GLD',label:'Gold'},{symbol:'HYG',label:'High yield'},{symbol:'UUP',label:'US dollar'}],{range:state.range,height:300,shade:true});
}
function unusual(){return state.rows.filter(r=>r.ready&&Number.isFinite(r.stats.sigma)).sort((a,b)=>Math.abs(b.stats.sigma)-Math.abs(a.stats.sigma))}
function sigma(v){return Number.isFinite(v)?`<span class="sigma ${Math.abs(v)>=2?'elevated':''}">${signed(v,1)}σ</span>`:'<span class="sigma">—</span>'}
function renderMovers(){
 $('#movers-list').innerHTML=unusual().slice(0,8).map(r=>`<button class="mover-row" data-symbol="${r.symbol}" title="${escape(r.name)}"><span class="mover-identity"><span class="mover-symbol">${r.symbol}</span><span class="mover-name">${escape(r.name)}</span></span><span class="mover-return ${signClass(r.stats.return)}">${pct(r.stats.return)}</span>${sigma(r.stats.sigma)}</button>`).join('');
 $('#movers-list').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.symbol)));
}
function renderFocus(){
 const selected=state.pairs.slice(1,3).map(p=>({kind:'pair',title:p.title,a:p.a,b:p.b,value:p.stats.gap,unit:'pp',score:p.stats.sigma,pair:p}));
 const mover=unusual()[0];
 if(mover){const parents={XES:'XLE',IEZ:'XLE',XOP:'XLE',IEO:'XLE',XBI:'XLV',IBB:'XLV',SOXX:'XLK',SMH:'XLK',KRE:'XLF',KBE:'XLF',QYLD:'QQQ',XYLD:'IVV',RYLD:'IWM'};selected.push({kind:'asset',title:mover.name,a:mover.symbol,b:parents[mover.symbol]||(mover.category==='fixed_income'?'AGG':'ACWI'),value:mover.stats.return,unit:'%',score:mover.stats.sigma,row:mover})}
 $('#insight-cards').innerHTML=selected.map((c,i)=>`<article class="panel focus-card"><div class="focus-card-header"><h3><button class="chart-title-button" data-focus="${i}">${escape(c.title)}</button></h3>${sigma(c.score)}</div><div class="focus-metric"><strong class="${signClass(c.value)}">${signed(c.value)}${c.unit==='%'?'%':''}</strong><span>${c.unit==='pp'?'pp spread':state.period+' return'}</span></div><div id="focus-chart-${i}" class="line-chart"></div><div class="focus-footer"><span>${state.period} ${c.kind==='pair'?'relative move':'unusual move'}</span><span>3M context</span></div></article>`).join('');
 selected.forEach((c,i)=>{lineChart('focus-chart-'+i,[{symbol:c.a,label:c.a},{symbol:c.b,label:c.kind==='asset'?'Ref. '+c.b:c.b}],{range:'3M',height:173});$(`[data-focus="${i}"]`).addEventListener('click',()=>c.kind==='pair'?openPair(c.pair):openDetail(c.a))});
}
function renderRibbon(){
 $('#sector-ribbon').innerHTML=state.rows.filter(r=>r.category==='sector_us'&&r.ready).sort((a,b)=>b.stats.return-a.stats.return).map(r=>`<button class="sector-tile" data-symbol="${r.symbol}"><span>${escape(r.name)}</span><strong class="${signClass(r.stats.return)}">${pct(r.stats.return,1)}</strong><small>${r.symbol}</small></button>`).join('');
 $('#sector-ribbon').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.symbol)));
}
function renderMarkets(){
 const ready=state.rows.filter(r=>r.ready);
 barChart('sector-bars',ready.filter(r=>r.category==='sector_us').sort((a,b)=>b.stats.return-a.stats.return).map(r=>({symbol:r.symbol,label:r.name,value:r.stats.return})));
 const countries=ready.filter(r=>r.category==='region_country').sort((a,b)=>b.stats.return-a.stats.return),max=Math.max(3,...countries.map(r=>Math.abs(r.stats.return)));
 $('#country-heatmap').innerHTML=countries.map(r=>`<button class="heat-cell" data-symbol="${r.symbol}" style="background:${r.stats.return>=0?`rgba(83,158,135,${.08+Math.abs(r.stats.return)/max*.24})`:`rgba(207,101,123,${.06+Math.abs(r.stats.return)/max*.23})`}" title="${escape(r.name)}: ${pct(r.stats.return)}"><span class="heat-name">${escape(r.region==='see_monitoring_role_and_benchmark'?r.name:r.region)}</span><span class="heat-value ${signClass(r.stats.return)}">${pct(r.stats.return,1)}</span><span class="heat-symbol">${r.symbol}</span></button>`).join('');
 $('#country-heatmap').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.symbol)));
 const base=state.rows.find(r=>r.symbol==='IVV')?.stats;
 barChart('factor-bars',[['MTUM','Momentum'],['QUAL','Quality'],['VLUE','Value'],['USMV','Minimum volatility'],['SIZE','Size'],['LRGF','Multifactor'],['SPHB','High beta'],['HDV','High dividend']].map(([symbol,label])=>{
  const r=ready.find(r=>r.symbol===symbol),s=r?.stats;return {symbol,label,value:s&&base&&s.start===base.start&&s.end===base.end?s.return-base.return:null};
 }).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity)),{unit:'pp'});
 barChart('global-bars',[['ACWI','Global equities'],['URTH','Developed markets'],['IEMG','Emerging markets'],['IEV','Europe'],['EWJ','Japan'],['GLD','Gold'],['IGF','Infrastructure'],['REET','Listed real estate']].map(([symbol,label])=>({symbol,label,value:ready.find(r=>r.symbol===symbol)?.stats.return})).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity)));
}
function renderPairs(){
 $('#pair-grid').innerHTML=state.pairs.map((p,i)=>`<article class="panel pair-panel"><div class="panel-header"><h2><button class="chart-title-button" data-pair="${i}">${escape(p.title)}</button></h2>${sigma(p.stats.sigma)}</div><div class="focus-metric"><strong class="${signClass(p.stats.gap)}">${signed(p.stats.gap)}</strong><span>pp / ${state.period}</span></div><div class="line-chart" id="pair-chart-${i}"></div></article>`).join('');
 state.pairs.forEach((p,i)=>{lineChart('pair-chart-'+i,[{symbol:p.a,label:p.a},{symbol:p.b,label:p.b}],{range:'3M',height:190});$(`[data-pair="${i}"]`).addEventListener('click',()=>openPair(p))});
}
function renderRisk(){
 const defs=[['VIX','VIX'],['DGS2','2Y Treasury'],['DGS10','10Y Treasury'],['BAMLH0A0HYM2','High-yield OAS'],['DFII10','10Y real yield']];
 $('#risk-strip').innerHTML=defs.map(([s,label])=>{const d=state.data.risk[s],v=indicatorChange(d,state.period),isSpread=s.startsWith('BAML');return `<div class="risk-item"><div class="risk-item-label">${label}</div><div class="risk-item-value">${number(v?isSpread?v.value*100:v.value:null,isSpread?0:2)}<small>${isSpread?'bp':d?.basis==='percent_rate'?'%':'pts'}</small></div><div class="risk-item-foot"><span>${state.period} ${signed(v?.change,1)} ${v?.unit||''}</span><span>${date(d?.asOf,true)}</span></div></div>`}).join('');
 const item=(s,label,m=1)=>({...state.data.risk[s],symbol:s,label:label+' / '+date(state.data.risk[s]?.asOf,true),points:state.data.risk[s]?.points?.map(([d,v])=>[d,v*m])||[]});
 lineChart('yield-chart',[item('DGS2','2Y'),item('DGS10','10Y')],{range:'6M',height:265,raw:true,unit:'%'});
 lineChart('credit-chart',[item('BAMLH0A0HYM2','High yield',100),item('BAMLC0A0CM','Investment grade',100)],{range:'6M',height:265,raw:true,unit:'bp'});
 lineChart('vix-chart',[item('VIX','VIX'),item('VIX9D','VIX9D')],{range:'6M',height:265,raw:true,unit:'pts'});
 lineChart('inflation-chart',[item('DFII10','10Y real yield'),item('T10YIE','10Y breakeven')],{range:'6M',height:265,raw:true,unit:'%'});
}
function filteredRows(){
 const q=state.query.toLowerCase();return state.rows.filter(r=>{
  if(state.category!=='all'&&r.category!==state.category)return false;
  if(state.status==='daily'&&!r.eligible||state.status==='ready'&&!r.ready||state.status==='reference'&&r.eligible||state.status==='starred'&&!state.stars.has(r.id))return false;
  return !q||[r.symbol,r.name,r.benchmark,r.fundName,r.region,r.weighting,LABELS[r.category]].join(' ').toLowerCase().includes(q);
 }).sort((a,b)=>{
  const x=state.sort==='sigma'?Math.abs(a.stats?.sigma??NaN):a[state.sort],y=state.sort==='sigma'?Math.abs(b.stats?.sigma??NaN):b[state.sort];
  if(!Number.isFinite(x))return Number.isFinite(y)?1:a.name.localeCompare(b.name,'en');if(!Number.isFinite(y))return -1;return (x-y)*state.direction;
 });
}
const statusLabel=r=>({ready:'Comparable',reference:'Reference only',unavailable:'Unavailable',stale:'Different observation date',review:'Price gap under review',short:'Period baseline unavailable'}[r.status]||'—');
function renderTable(){
 const filtered=filteredRows(),shown=filtered.slice(0,state.limit);
 $('#table-count').textContent=`${shown.length} of ${filtered.length} instruments`;
 $('#show-more').hidden=shown.length>=filtered.length;
 $$('[data-sort]').forEach(b=>{b.closest('th').setAttribute('aria-sort',b.dataset.sort===state.sort?(state.direction<0?'descending':'ascending'):'none')});
 $('#universe-body').innerHTML=shown.length?shown.map(r=>`<tr tabindex="0" data-record="${escape(r.id)}" aria-label="Open ${escape(r.symbol||r.name)}"><td class="star-col"><button class="star-button ${state.stars.has(r.id)?'starred':''}" data-star="${escape(r.id)}" aria-label="${state.stars.has(r.id)?'Remove':'Add'} ${escape(r.symbol||r.name)} ${state.stars.has(r.id)?'from':'to'} watchlist">${state.stars.has(r.id)?'★':'☆'}</button></td><td><div class="ticker-cell"><span class="ticker-badge" translate="no">${escape(r.symbol||'REF')}</span><span class="instrument-name">${escape(r.name)}<small>${escape(r.benchmark)}</small></span></div></td><td class="category-cell">${escape(LABELS[r.category])}</td>${['wtd','mtd','ytd'].map(p=>`<td class="numeric ${signClass(r[p])}">${pct(r[p])}</td>`).join('')}<td class="numeric">${sigma(r.stats?.sigma)}</td><td class="date-cell" title="${escape(statusLabel(r))}"><i class="status-dot ${r.ready?'':'stale'}"></i>${r.asOf?date(r.asOf,true):r.frequency?.startsWith('quarterly')?'Quarterly':'Reference'}</td><td><button class="detail-link" data-open="${escape(r.id)}" aria-label="Details for ${escape(r.symbol||r.name)}">↗</button></td></tr>`).join(''):'<tr><td colspan="9" class="empty-cell">No matching instruments. Try another filter.</td></tr>';
 $('#universe-body').querySelectorAll('[data-record]').forEach(tr=>{tr.addEventListener('click',e=>{if(!e.target.closest('[data-star]'))openRecord(tr.dataset.record)});tr.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target===tr)openRecord(tr.dataset.record)})});
 $('#universe-body').querySelectorAll('[data-star]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.star;if(state.stars.has(id))state.stars.delete(id);else state.stars.add(id);try{localStorage.setItem('macro-lens-stars',JSON.stringify([...state.stars]))}catch{}renderTable()}));
}
function renderReferences(){
 $('#private-references').innerHTML=state.rows.filter(r=>r.category==='private_benchmark').map(r=>`<div class="private-ref"><a href="${safeUrl(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(r.benchmark)}</a><small>${r.frequency.startsWith('quarterly')?'Quarterly':'Monthly'}</small></div>`).join('');
}
function openDetail(symbol){const r=state.rows.find(r=>r.symbol===symbol&&r.eligible)||state.rows.find(r=>r.symbol===symbol);if(r)openRecord(r.id)}
function openRecord(id){
 const r=state.rows.find(r=>r.id===id);if(!r)return;
 const risk=state.data.risk[r.symbol],active=r.relationship?.includes('active')||r.relationship?.includes('comparison');
 $('#detail-content').innerHTML=`<div class="detail-heading"><span class="ticker-badge">${escape(r.symbol||'REF')}</span><h2>${escape(r.name)}</h2></div><p class="detail-subtitle">${escape(LABELS[r.category])}</p>${r.eligible?`<div class="detail-returns">${[['WTD',r.wtd],['MTD',r.mtd],['YTD',r.ytd]].map(([l,v])=>`<div><label>${l}</label><strong class="${signClass(v)}">${pct(v)}</strong></div>`).join('')}</div><div id="detail-chart" class="line-chart"></div>`:risk?.points?'<div id="detail-chart" class="line-chart"></div>':'<p class="context-note">Reference benchmark. Continuous free history has not been verified.</p>'}<div class="detail-meta"><div><label>${active?'Comparison benchmark, not a replication target':'Index or asset reference'}</label>${escape(r.benchmark)}</div><div><label>Observation / coverage</label>${date(r.asOf||risk?.asOf)} / ${escape(statusLabel(r))}</div><div><label>Weighting or strategy</label>${escape(r.weighting.replaceAll('_',' '))}</div><div><label>Issuer / frequency</label>${escape(r.issuer)} / ${r.eligible?'Daily':r.frequency?.startsWith('quarterly')?'Quarterly':'See source'}</div></div><details class="detail-notes"><summary>Notes</summary><p>${escape(r.notes)}</p>${r.series?`<p>Adjusted close, ${r.series.points.length} observations. ${r.series.fallback?'Dated snapshot retained.':''}</p>`:''}</details><div class="detail-source"><a href="${safeUrl(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">Issuer or index source ↗</a>${r.series?`<a href="${safeUrl(r.series.sourceUrl)}" target="_blank" rel="noopener noreferrer">Price history ↗</a>`:''}${risk?.sourceUrl?`<a href="${safeUrl(risk.sourceUrl)}" target="_blank" rel="noopener noreferrer">Official history ↗</a>`:''}</div>`;
 if(r.series)lineChart('detail-chart',[{symbol:r.symbol,label:r.symbol}],{range:'YTD',height:280,shade:true});
 else if(risk?.points)lineChart('detail-chart',[{...risk,label:r.symbol}],{range:'6M',height:265,raw:true,unit:risk.basis==='percent_rate'?'%':'pts'});
 $('#detail-dialog').showModal();
}
function openPair(p){
 $('#detail-content').innerHTML=`<div class="detail-heading"><h2>${escape(p.title)}</h2></div><p class="detail-subtitle">Common dates / USD ETF returns</p><div class="detail-returns"><div><label>${p.a} / ${state.period}</label><strong class="${signClass(p.stats.aReturn)}">${pct(p.stats.aReturn)}</strong></div><div><label>${p.b} / ${state.period}</label><strong class="${signClass(p.stats.bReturn)}">${pct(p.stats.bReturn)}</strong></div><div><label>Return spread</label><strong class="${signClass(p.stats.gap)}">${signed(p.stats.gap)} pp</strong></div></div><div id="detail-chart" class="line-chart"></div><p class="context-note">${escape(p.note)}</p><details class="detail-notes"><summary>Calculation</summary><p>${date(p.stats.start)} to ${date(p.stats.end)}. Prior-mean-adjusted relative move: ${signed(p.stats.sigma)}σ. Up to 63 pre-window observations; not a significance test.</p></details><div class="detail-source"><a href="https://finance.yahoo.com/quote/${p.a}/history/" target="_blank" rel="noopener noreferrer">${p.a} history ↗</a><a href="https://finance.yahoo.com/quote/${p.b}/history/" target="_blank" rel="noopener noreferrer">${p.b} history ↗</a></div>`;
 lineChart('detail-chart',[{symbol:p.a,label:p.a},{symbol:p.b,label:p.b}],{range:'6M',height:290,shade:true});$('#detail-dialog').showModal();
}
let refreshController;
async function refreshData({automatic=false}={}){
 if(state.refreshing||!state.data||automatic&&document.hidden)return;
 let last=0;try{last=Number(sessionStorage.getItem('macro-last-attempt')||0)}catch{}
 if(automatic&&Date.now()-last<30*60000)return;
 state.refreshing=true;refreshController=new AbortController();
 const controller=refreshController,summary=$('#refresh-summary'),progress=$('#refresh-progress');
 $('#refresh').disabled=true;$('#refresh-icon').classList.add('spinning');$('#update-message').hidden=false;
 $('#cancel-refresh').hidden=false;$('#refresh-details').hidden=true;$('#refresh-details').open=false;
 summary.textContent='Checking latest completed closes…';progress.hidden=false;progress.value=0;
 try{sessionStorage.setItem('macro-last-attempt',String(Date.now()))}catch{}
 const jobs=[...state.data.universe.filter(r=>r.eligible).map(r=>({symbol:r.symbol,kind:'series'})),...Object.keys(state.data.risk).map(symbol=>({symbol,kind:'risk'}))];
 // Commit all accepted histories together; cancellation leaves the displayed snapshot intact.
 const staged={series:{...state.data.series},risk:{...state.data.risk}},issues=[];
 let i=0,done=0,checked=0,newCloses=0,revised=0,cached=0;
 progress.max=jobs.length;$('#refresh-counter').textContent=`0 / ${jobs.length}`;
 const run=async()=>{while(i<jobs.length&&!controller.signal.aborted){
  const job=jobs[i++],previous=state.data[job.kind][job.symbol];
  try{
   const r=await fetch(`/api/history?symbol=${encodeURIComponent(job.symbol)}&kind=${job.kind}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(28000)])});
   if(!r.ok)throw Error(`HTTP ${r.status}`);const v=await r.json();
   if(!v.points?.length||v.fallback||v.quality!=='ok')throw Error(v.refreshError||'Source history unavailable');
   if(previous?.asOf&&v.asOf<previous.asOf)throw Error('Source is older than the displayed history');
   staged[job.kind][job.symbol]=v;checked++;if(v.cacheStatus==='hit')cached++;
   if(!previous?.asOf||v.asOf>previous.asOf)newCloses++;
   else if(JSON.stringify(v.points)!==JSON.stringify(previous.points))revised++;
  }catch(error){
   if(controller.signal.aborted)break;
   issues.push(`${job.symbol}: ${String(error.message).slice(0,120)}. Retained ${previous?.asOf||'unavailable'}.`);
  }
  done++;progress.value=done;$('#refresh-counter').textContent=`${done} / ${jobs.length}`;
  if(done%25===0)summary.textContent=`Checking latest completed closes… ${Math.round(done/jobs.length*100)}%`;
 }};
 try{
  await Promise.all(Array.from({length:5},run));
  if(controller.signal.aborted){summary.textContent='Check cancelled. Previous snapshot retained.';return}
  summary.textContent='Recalculating signals…';
  state.data={...state.data,...staged,lastCheckedAt:new Date().toISOString()};
  reanalyze();render();try{localStorage.setItem('macro-lens-snapshot',JSON.stringify(state.data))}catch{}
  const outcome=newCloses?`${newCloses} series with new closes`:revised?`${revised} histories revised`:'No new closes';
  summary.textContent=`${outcome} · ${checked} checked${issues.length?` · ${issues.length} snapshots retained`:''}`;
  $('#refresh-detail-text').textContent=[`${cached} responses from the shared 30-minute cache. ${revised} same-date histories revised.`,...issues].join('\n');
  $('#refresh-details').hidden=false;
 }catch{
  summary.textContent='Check could not finish. Select Refresh to retry.';
 }finally{
  state.refreshing=false;refreshController=null;$('#refresh').disabled=false;$('#refresh-icon').classList.remove('spinning');
  $('#cancel-refresh').hidden=true;progress.hidden=true;$('#refresh-counter').textContent='';
 }
}
function wire(){
 $$('a[href^="#"]').forEach(a=>{if(Object.hasOwn(VIEWS,a.hash?.slice(1)))a.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate(a.hash.slice(1))})});
 $('#periods').addEventListener('click',e=>{const b=e.target.closest('[data-period]');if(!b)return;state.period=b.dataset.period;if(state.sort!=='sigma')state.sort=state.period.toLowerCase();reanalyze();render();syncURL()});
 $('#hero-ranges').addEventListener('click',e=>{const b=e.target.closest('[data-range]');if(!b)return;state.range=b.dataset.range;renderHero();syncURL()});
 $('#lead-ranges').addEventListener('click',e=>{const b=e.target.closest('[data-range]');if(!b)return;state.leadRange=b.dataset.range;renderLead()});
 $('#refresh').onclick=()=>refreshData();
 $('#cancel-refresh').onclick=()=>refreshController?.abort();
 ['open-method','footer-method'].forEach(id=>document.getElementById(id).addEventListener('click',()=>$('#method-dialog').showModal()));
 $$('dialog').forEach(d=>{d.querySelector('[data-close]').addEventListener('click',()=>d.close());d.addEventListener('click',e=>{if(e.target===d)d.close()});d.addEventListener('close',()=>$('#chart-tooltip').hidden=true)});
 const search=()=>{navigate('universe');$('#search').focus()};$('#search-shortcut').addEventListener('click',search);
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&!$('dialog[open]')){e.preventDefault();search()}});
 $('#category-filter').innerHTML+=[...new Set(state.data.universe.map(r=>r.category))].sort((a,b)=>LABELS[a].localeCompare(LABELS[b],'en')).map(c=>`<option value="${c}">${escape(LABELS[c])}</option>`).join('');
 $('#search').value=state.query;$('#category-filter').value=state.category;$('#status-filter').value=state.status;
 $('#search').addEventListener('input',e=>{state.query=e.target.value;state.limit=45;renderTable();syncURL()});
 $('#category-filter').addEventListener('change',e=>{state.category=e.target.value;state.limit=45;renderTable();syncURL()});
 $('#status-filter').addEventListener('change',e=>{state.status=e.target.value;state.limit=45;renderTable();syncURL()});
 $$('[data-sort]').forEach(b=>b.addEventListener('click',()=>{if(state.sort===b.dataset.sort)state.direction*=-1;else{state.sort=b.dataset.sort;state.direction=-1}renderTable();syncURL()}));
 $('#show-more').addEventListener('click',()=>{state.limit+=60;renderTable()});
 $('#export-csv').addEventListener('click',()=>{
  const fields=['symbol','name','benchmark','category','wtd','mtd','ytd','asOf','status','sourceUrl'];
  const cell=v=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};
  const csv='\uFEFF'+[fields.join(','),...filteredRows().map(r=>fields.map(k=>cell(r[k])).join(','))].join('\r\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=`macro-lens-${state.period}-${state.asOf}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
 });
 window.addEventListener('popstate',()=>{readURL();reanalyze();render();navigate(state.view,false);$('#search').value=state.query;$('#category-filter').value=state.category;$('#status-filter').value=state.status});
 setInterval(()=>refreshData({automatic:true}),30*60*1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshData({automatic:true})});
}
async function boot(){
 try{
  const response=await fetch('/api/snapshot');if(!response.ok)throw Error('Snapshot unavailable');state.data=await response.json();
  try{const c=JSON.parse(localStorage.getItem('macro-lens-snapshot')||'null');if(c?.methodologyVersion===state.data.methodologyVersion&&(c.lastCheckedAt||c.generatedAt)>state.data.generatedAt&&c.universe?.length===259&&Object.keys(c.series||{}).length>=200&&getAsOf(c.series)>=getAsOf(state.data.series))state.data=c}catch{}
  readURL();reanalyze();wire();render();navigate(state.view,false);
  window.macroLens={get state(){return {period:state.period,view:state.view,asOf:state.asOf,ready:state.rows.filter(r=>r.ready).length,total:state.data.universe.length}}};
  refreshData({automatic:true});
 }catch(error){$('#error-banner').hidden=false;$('#error-banner').textContent='Data could not load. Select Refresh to retry.';$('#refresh').onclick=boot;console.error(error)}
}
boot();
