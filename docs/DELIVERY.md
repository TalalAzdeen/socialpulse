# Delivery evidence — 2026-10-30

- Source revision published: `7150325beaf1fd5b4d2cec3ede73b3f15b79629f`.
- Sites version: `appgprj_6ae499c405248191997b8b6b4af1cc6d~appgver_f52c55cfa034819182823d9b85e7f2db`.
- Deployment: `appgdep_6ae49c7738348191823e056894b8e380`; native status **succeeded**.
- URL: https://socialpulse-nabd-2026.azadeentalal77435569.chatgpt.site
- Audience: owner-private, as created. No public exposure was requested or applied.
- Final tests: 14 Node tests plus 3 Python tests passed; deterministic build and ESM artifact validation passed.
- Independent code review found one Important issue: a failed search lost its error when local filters changed. Fixed with a RED→GREEN regression test; stale-response regression test also passes.
- Live browser: the deployed origin shows the ChatGPT sign-in gate; the cloud browser has no signed-in session. Full visual/mobile and live Bluesky search/thread verification therefore remain **NOT VERIFIED**. Managed preview daemon was unavailable. No authentication bypass was attempted.
- GitHub: `TalalAzdeen/socialpulse` exists and is empty. The authorized Contents create operation returned **403 Resource not accessible by integration**. No successful GitHub upload or GitHub commit is claimed. The code is pushed to the Site's separate source repository.
- Deferred minor: JavaScript accepts the inclusive end date 9999-12-31 as an expanded ISO year while Python rejects overflow. Ordinary supported calendar dates are covered by tests. Source-year bound parity can be tightened later.
- No continuous monitoring or background scheduling is configured.

The source copy includes this receipt after publication; this receipt records the deployment above and does not claim a newer source SHA was deployed.

## GitHub upload follow-up

The prior 403 describes the connector attempt. On 2026-10-30 the user approved switching the browser to TalalAzdeen. Browser upload succeeded for the root files and application/build/test/ontology/hosting directories on main. Initial commit: 1e490c326b5aee5773d3adbb45b8fdbfa566af22. Remaining documentation and CI are being committed in this delivery batch. No connector permission expansion was needed.
