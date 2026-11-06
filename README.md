# Macro Lens

A private, free-data cross-asset research dashboard. The initial universe has 259
records, including 235 US-listed ETF/ETP candidates. Price history is real, with
unfinished US trading sessions removed. Private benchmarks remain reference
records rather than fabricated daily NAV histories.

The website checks for a new completed trading day when opened and every 30
minutes while open. It reads public Yahoo adjusted-close histories, official Cboe
CSV files, and FRED CSV files through same-origin server routes. Upstream failures
retain a clearly dated seed snapshot. There is no unattended scheduler configured.

## Development

The runtime Worker has no dependencies. Python standard-library scripts collect
and bundle the source. Node is used for checks; `linkedom` is a development-only
DOM test dependency.

```sh
npm ci
python scripts/collect_data.py
python scripts/build.py
node --test tests/*.test.mjs
node scripts/validate-artifact.mjs
```

Edit the authored files under `worker/`. The build produces a single ESM module at
`dist/server/index.js` plus `dist/.openai/hosting.json`. Build outputs and downloaded
raw caches are ignored. The seed and complete input catalogue are tracked to make
the source reproducible. `.openai/hosting.json` holds the existing Site identity;
reuse it for future publications.

## Research conventions

- WTD/MTD/YTD use the last actual close strictly before the period's first day.
- ETF adjusted close is a total-return proxy, not the corresponding official
  index return. Listing currency is USD, with underlying foreign-exchange exposure.
- Unusualness subtracts the pre-window daily log-return mean, then scales by the
  pre-window daily volatility and square root of the number of window sessions.
  Up to 63 observations are used, with at least 40 required. It is a research
  ordering heuristic, not statistical significance or a forecast probability.
- Pair comparisons use common start/end observations. Comparison benchmarks for
  active funds are not replication targets.
- Data gaps, missing bases, suspicious large price jumps and stale observation
  dates exclude an instrument from the default ranking.
- Interest-rate and spread changes use basis points and stay outside asset-return
  rankings. Each macro series retains its own observation date.
- Public data and keyless access do not imply unrestricted redistribution or an
  API service-level guarantee. Observe provider terms and rate limits.

Browser QA was unavailable because this environment did not expose the required
`cua_repl.js` tool. Mathematical tests, DOM interaction tests, Worker route tests
and representative live upstream requests are provided instead.
