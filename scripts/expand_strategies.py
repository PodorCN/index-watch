"""Issuer-verified strategy coverage. Prices are collected separately."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ADDITIONS=[
 ('CTA','managed_futures','Managed futures','Simplify','Simplify Managed Futures Strategy ETF','Active systematic futures strategy; no tracking index','active_strategy_proxy','systematic_long_short_futures','https://www.simplify.us/etfs/cta-simplify-managed-futures-strategy-etf','Commodity and interest-rate futures. Holdings and strategy implementation can change.'),
 ('WTMF','managed_futures','Managed futures','WisdomTree','WisdomTree Managed Futures Strategy Fund','Active managed futures strategy; no tracking index','active_strategy_proxy','systematic_long_short_futures','https://www.wisdomtree.com/us/products/alternative/wtmf','Trend exposure across futures markets; may include bitcoin-related exposure. Not an SG CTA Index tracker.'),
 ('BTAL','defensive_strategy','Defensive hedges','AGF Investments','AGF U.S. Market Neutral Anti-Beta Fund','Low-beta minus high-beta US equities; strategy reference','active_strategy_proxy','sector_neutral_long_short','https://www.agf.com/us/products/btal/index.jsp','Long low-beta and short high-beta equities, dollar neutral within sectors. Dollar neutrality does not imply zero market beta.'),
 ('TAIL','defensive_strategy','Defensive hedges','Cambria','Cambria Tail Risk ETF','Active tail-risk strategy; no tracking index','active_strategy_proxy','protective_puts_and_treasuries','https://www.cambriafunds.com/tail','S&P 500 put options and Treasuries. Option decay and duration affect returns; protection is not guaranteed.'),
 ('MNA','arbitrage_strategy','Merger arbitrage','New York Life Investment Management','NYLIM Merger Arbitrage ETF','NYLIM Merger Arbitrage Index','issuer_declared_tracking_benchmark','rules_based_merger_arbitrage','https://www.nylim.com/etf/nylim-merger-arbitrage-etf-mna','Announced takeover targets and applicable acquirer short positions. Deal failures and financing conditions affect returns.'),
 ('QAI','multi_strategy','Multi-strategy','New York Life Investment Management','NYLIM Hedge Multi-Strategy Tracker ETF','NYLIM Hedge Multi-Strategy Index','issuer_declared_tracking_benchmark','liquid_multi_strategy_replication','https://www.nylim.com/etf/nylim-hedge-multi-strategy-tracker-etf-qai','Liquid replication index, not direct hedge-fund ownership and not an HFRI tracker.'),
 ('NTSX','allocation_strategy','Allocation & risk balance','WisdomTree','WisdomTree U.S. Efficient Core Fund','US equities plus Treasury futures; strategy reference','active_strategy_proxy','capital_efficient_equity_treasury_overlay','https://www.wisdomtree.com/us/products/capital-efficient/ntsx','US large-cap equities with a Treasury futures overlay. Leverage, duration and geography differ from a global 60/40 portfolio.'),
 ('RPAR','allocation_strategy','Allocation & risk balance','Evoke Advisors / RPAR','RPAR Risk Parity ETF','Advanced Research Risk Parity Index','issuer_declared_tracking_benchmark','multi_asset_risk_parity','https://www.rparetf.com/rpar','Balances risk across equities, commodities, Treasuries and TIPS. Risk weights differ from capital weights.'),
 ('JEPI','option_strategy','Options & income','J.P. Morgan Asset Management','JPMorgan Equity Premium Income ETF','S&P 500 Index (comparison; not tracked)','active_fund_with_comparison_benchmark','active_equity_option_income','https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-equity-premium-income-etf-46641q332/','Active stock selection and option-related income exposure. Total return, including distributions, is not distribution yield.'),
 ('JEPQ','option_strategy','Options & income','J.P. Morgan Asset Management','JPMorgan Nasdaq Equity Premium Income ETF','Nasdaq-100 Index (comparison; not tracked)','active_fund_with_comparison_benchmark','active_equity_option_income','https://am.jpmorgan.com/us/en/asset-management/adv/products/jpmorgan-nasdaq-equity-premium-income-etf-jepq-46654q203','Active Nasdaq-oriented equity and option-related income exposure. Does not replicate the Nasdaq-100 or a mechanical buy-write index.'),
]

def main():
 path=ROOT/'data/universe.json';rows=json.loads(path.read_text())
 existing={r['record_id'] for r in rows}
 for ticker,category,group,issuer,name,benchmark,relationship,weighting,url,notes in ADDITIONS:
  if 'ETF:'+ticker in existing:continue
  rows.append(dict(record_id='ETF:'+ticker,ticker=ticker,primary_category=category,
   monitoring_role_zh=name,instrument_type='ETF_or_ETP',quote_currency='USD',listing_country='US',
   issuer=issuer,fund_name=name,declared_index_or_reference=benchmark,index_relationship=relationship,
   reported_asset_class='Alternative / multi-asset',inception_date='',exchange='',frequency='daily_trading_days',
   ranking_use='return_candidate',suggested_return_basis='split_and_distribution_adjusted_total_return',
   public_source_url=url,metadata_verification='issuer_product_page_verified_2026-11-07',
   historical_ingestion_status='pending_adjusted_history_check',free_data_plan='Yahoo Finance public adjusted daily history',
   weighting_tag=weighting,alternative_proxy_tickers='',notes=notes+' ETF returns include fees and tracking differences.',
   researched_on='2026-11-07',region_tag='Global' if category in ['managed_futures','multi_strategy','allocation_strategy'] else 'US',
   strategy_group=group,dashboard_identity_note='ETF proxy and index retain distinct identities.'))
 groups={'managed_futures':'Managed futures','option_strategy':'Options & income','allocation_strategy':'Allocation & risk balance',
         'defensive_strategy':'Defensive hedges','arbitrage_strategy':'Merger arbitrage','multi_strategy':'Multi-strategy'}
 for row in rows:
  if row['primary_category'] in groups:row['strategy_group']=groups[row['primary_category']]
 path.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'instruments':len(rows),'strategy_ETFs':sum('strategy_group' in r for r in rows)}))

if __name__=='__main__':main()
