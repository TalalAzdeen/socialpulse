# SocialPulse 2 — design and delivery plan

Goal: develop the uploaded Arabic RTL Bluesky dashboard into a usable hosted application while retaining the original ontology and local Python entry point.

Selected approach (implementation decision): preserve dependency-free HTML/CSS/JavaScript and add a Cloudflare Worker adapter for Sites. Python remains a local option. A static-only publication would lose the existing proxy; migrating to a large framework adds no benefit to this scope.

Acceptance: real upstream results or explicit errors, validated dates/language/cursor, deduplicated pagination, Arabic/English lexicon with visible limitations, accessible RTL desktop/mobile views, source attribution, comments/media, CSV and JSON exports of the current filtered sample, local saved queries, tests, HTTPS deployment, and GitHub upload when authorized integration permissions permit.

Out of scope: invented data, additional unconnected social networks, paid APIs, accounts/databases, automated collection, and statistical claims about public opinion. Saved queries stay in this browser; posts are not persisted by the app.

## Implementation plan

- [x] Core: `src/core.js`, tested with `node --test tests/core.test.mjs`: lexical boundaries/negation, safe CSV, pagination deduplication, validation, safe URLs and aggregate metrics.
- [x] Hosted API: `worker/index.js`, tested through injected network responses with `node --test tests/api.test.mjs`: fixed upstream hosts, input validation, bounded retry/timeouts, pagination, thread validation, upstream failure transparency, method restrictions, rate limits and security headers.
- [ ] UI: `index.html`, `styles.css`, `app.js`: wire live search/filters, charts, comments, local queries, exports; browser check desktop/mobile and upstream search when available. Port API contract to `server.py` for local use.
- [ ] Delivery: deterministic dependency-free build, full suite, original ontology regenerated with evidence-based states, README and CI. Push Sites source, publish privately, confirm receipt. Upload exact project files to the existing GitHub repository if integration permits; otherwise report the actual 403 and provide a portable source archive.

Review focus: no substring sentiment matches; spreadsheet formula execution; invalid dates and cursors; stale responses on filter changes; upstream errors must never be rendered as successful empty results.

GitHub check: Contents API returned 403 Resource not accessible by integration on 2026-10-30. No successful upload is asserted.

## Delivery outcome

See `docs/DELIVERY.md`. Core/API/UI implementation and 17 automated tests are complete. Sites publication succeeded. Browser visual/live-source verification and GitHub upload remain blocked by authentication and integration permissions respectively. The error-state regression was fixed. No human approval of unseen design documents is claimed; implementation decisions were made under the user’s broad instruction to develop and publish.
