# Interface review

worker/index.html: English copy, semantic navigation, skip link, labeled controls, one dominant lead signal, restrained secondary sections.
worker/styles.css: responsive lead panel and secondary grids, visible focus, reduced motion, tabular numbers, contained tables and dialogs.
worker/app.js: lead selection and metrics use verified pair calculations; the lead is omitted from secondary signals. URL views/filters, English instrument names, keyboard controls and provenance remain intact.
Refresh: progress and cancellation; staged atomic updates; separate observation/check timestamps; truthful cached, unchanged, new-close and fallback feedback.
worker/server.mjs: cache hits and source fallbacks explicitly labeled, without changing source dates or upstream fetch timestamps.

Validation: eight mathematical/data tests, four DOM interaction tests and three history API tests; bundled Worker route/coverage/allowlist validation. Actual browser layout inspection was unavailable because the supported cua_repl.js tool is not exposed. Responsive layout was checked in source only.
