# Macro Lens interface direction

Audience: macro researchers comparing cross-asset returns and unusual relative moves.
Primary job: spot changes, compare the evidence, inspect a symbol.

Tokens: Canvas #f1f4f8; Surface #ffffff; Ink #172b4d; Muted #64748b;
Action #3563e9; Positive #137f69; Negative #c94f60.
Type: IBM Plex Sans for navigation and labels; IBM Plex Mono for financial numbers.
12 / 14 / 18 / 26 px scale. Left alignment, tabular numeric columns.

Layout:
[Logo] [Overview | Markets | Relative | Rates | Universe] [As of] [Refresh]
[Benchmark tape: US equities | Treasuries | Gold | Dollar | VIX]
[View title]                                      [WTD | MTD | YTD]
[Cross-asset chart, 8 columns] [Unusual movers, 4 columns]
[Automatic focus chart] [Automatic focus chart] [Unusual asset chart]

Markets, relative charts, rates and the universe each get a distinct tab.
Methodology, provenance and long index names live in a detail drawer.

Review against the brief: Remove the introductory research essay and numbered
section labels. Keep an as-of date, return basis and source status because they
change how results are interpreted. Give the main comparison chart the most
space; avoid a page of equal-weight promotional cards. English throughout.
No decorative illustrations, unrelated animation, or prose above the data.

Review files: worker/index.html, worker/styles.css, worker/app.js and analytics.mjs.
References: Anthropic frontend-design and Vercel Web Interface Guidelines.
