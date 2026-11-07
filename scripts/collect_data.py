"""Build a real, dated seed snapshot; never fill missing prices with invented data."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from urllib.request import Request, urlopen
from pathlib import Path
import csv, gzip, io, json, math, time, zipfile

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'data/universe.json'
NY=ZoneInfo('America/New_York')
NOW=datetime.now(timezone.utc)

def download(url):
    with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'*/*'}),timeout=30) as response:
        body=response.read()
    if body[:2]==b'\x1f\x8b':body=gzip.decompress(body)
    if body[:2]==b'PK':
        with zipfile.ZipFile(io.BytesIO(body)) as z:
            body=z.read(next(n for n in z.namelist() if n.endswith('.csv')))
    return body.decode('utf-8-sig')

def yahoo(symbol):
    cache=ROOT/'data/raw'/f'{symbol}.json'
    if cache.exists():
        old=json.loads(cache.read_text())
        if old.get('fetchedAt','')[:10]==NOW.isoformat()[:10]:return old
    url=f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=2y&interval=1d&events=div%2Csplits&includeAdjustedClose=true'
    try:
        chart=json.loads(download(url))['chart']['result'][0]
        meta=chart['meta'];regular=meta.get('currentTradingPeriod',{}).get('regular',{})
        adjusted=chart['indicators'].get('adjclose',[{}])[0].get('adjclose',[])
        if not adjusted:raise ValueError('No adjusted closing series; price-only fallback deliberately excluded')
        timestamps=chart.get('timestamp',[])
        points=[]
        current_day=datetime.fromtimestamp(regular.get('start',0),NY).date()
        for ts,value in zip(timestamps,adjusted):
            day=datetime.fromtimestamp(ts,NY).date()
            if ts>NOW.timestamp():continue
            if day==current_day and NOW.timestamp()<regular.get('end',0)+900:continue
            if value is not None and math.isfinite(value) and value>0:
                points.append([day.isoformat(),round(value,6)])
        points=sorted(dict(points).items())
        if len(points)<5:raise ValueError('Insufficient completed trading-day observations')
        extreme=max(abs(math.log(points[i][1]/points[i-1][1])) for i in range(1,len(points)))
        out={'symbol':symbol,'points':points,'basis':'adjusted_close_total_return_proxy','source':'Yahoo Finance',
             'sourceUrl':f'https://finance.yahoo.com/quote/{symbol}/history/',
             'fetchedAt':NOW.isoformat(),'asOf':points[-1][0],
             'currency':meta.get('currency','USD'),'observations':len(points),
             'quality':'review_large_daily_gap' if extreme>math.log(1.5) else 'ok'}
        cache.write_text(json.dumps(out,separators=(',',':')))
        return out
    except Exception as e:return {'symbol':symbol,'error':str(e)[:180],'fetchedAt':NOW.isoformat()}

RISK={
 'VIX':('Cboe','https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv','volatility_points'),
 'VVIX':('Cboe','https://cdn.cboe.com/api/global/us_indices/daily_prices/VVIX_History.csv','volatility_points'),
 'VIX9D':('Cboe','https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX9D_History.csv','volatility_points'),
 'OVX':('Cboe','https://cdn.cboe.com/api/global/us_indices/daily_prices/OVX_History.csv','volatility_points'),
 'GVZ':('Cboe','https://cdn.cboe.com/api/global/us_indices/daily_prices/GVZ_History.csv','volatility_points'),
 **{s:('FRED',f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={s}&cosd=2024-01-01',
        'index_level' if s=='DTWEXBGS' else 'percent_rate')
    for s in ['DGS2','DGS10','BAMLH0A0HYM2','BAMLC0A0CM','DTWEXBGS','DFII10','T10YIE']}
}

def risk(symbol):
    source,url,unit=RISK[symbol]
    try:
        rows=list(csv.reader(io.StringIO(download(url))))
        points=[]
        for row in rows[1:]:
            try:
                day=datetime.strptime(row[0],'%m/%d/%Y').date().isoformat() if source=='Cboe' else row[0][:10]
                value=float(row[-1])
                if day>NOW.astimezone(NY).date().isoformat() or day<'2024-01-01':continue
                if math.isfinite(value):points.append([day,value])
            except (ValueError,IndexError):pass
        points=sorted(dict(points).items())
        if not points:raise ValueError('No observations in official file')
        out={'symbol':symbol,'source':source,'sourceUrl':url,'basis':unit,'points':points,
             'asOf':points[-1][0],'fetchedAt':NOW.isoformat(),'quality':'ok'}
        (ROOT/'data/raw'/f'{symbol}_risk.json').write_text(json.dumps(out,separators=(',',':')))
        return out
    except Exception as e:return {'symbol':symbol,'error':str(e)[:180]}

def main():
    (ROOT/'data/raw').mkdir(parents=True,exist_ok=True)
    original=json.loads(SOURCE.read_text())
    previous_path=ROOT/'data/snapshot.json'
    previous=json.loads(previous_path.read_text()) if previous_path.exists() else {}
    compact=[]
    for row in original:
        compact.append({'id':row['record_id'],'symbol':row['ticker'],'name':row['monitoring_role_zh'],
                        'category':row['primary_category'],'fundName':row['fund_name'],
                        'benchmark':row['declared_index_or_reference'],'relationship':row['index_relationship'],
                        'issuer':row['issuer'],'sourceUrl':row['public_source_url'],
                        'weighting':row['weighting_tag'],'frequency':row['frequency'],
                        'notes':row['notes'],'region':row['region_tag'],
                        'eligible':row['record_id'].startswith('ETF:'),
                        'strategyGroup':row.get('strategy_group')})
    symbols=[r['symbol'] for r in compact if r['eligible']]
    output={};errors=[]
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures={pool.submit(yahoo,s):s for s in symbols}
        for i,f in enumerate(as_completed(futures),1):
            result=f.result();s=futures[f]
            if 'error' in result:
                errors.append(result)
                old=previous.get('series',{}).get(s)
                if old and old.get('points'):output[s]={**old,'fallback':True,'refreshError':result['error']}
            else:output[s]=result
            if i%25==0 or 'error' in result:
                print(json.dumps({'completed':i,'total':len(symbols),'symbol':s,'error':result.get('error')}),flush=True)
    risk_output={}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for r in pool.map(risk,RISK):
            old=previous.get('risk',{}).get(r['symbol'])
            risk_output[r['symbol']]={**old,'fallback':True,'refreshError':r['error']} if r.get('error') and old and old.get('points') else r
    snapshot={'generatedAt':NOW.isoformat(),'universe':compact,'series':output,'risk':risk_output,'errors':errors,
              'methodologyVersion':'1.0','universeVersion':'2026-11-07-strategies','baseCurrency':'USD',
              'sources':['Yahoo Finance adjusted historical close','Cboe official daily CSV','FRED official series CSV',
                         'ETF issuer benchmark metadata'],
              'notice':'ETF total-return proxies; completed US trading sessions only; private benchmarks excluded from daily ranking.'}
    (ROOT/'data/snapshot.json').write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':')))
    print(json.dumps({'ETFs':len(output),'errors':len(errors),'asOf':dict(__import__('collections').Counter(r['asOf'] for r in output.values())),
                      'risk':{s:r.get('asOf',r.get('error')) for s,r in risk_output.items()},
                      'qualityReview':[s for s,r in output.items() if r['quality']!='ok'],
                      'bytes':(ROOT/'data/snapshot.json').stat().st_size},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
