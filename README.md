# Darkmath

Black-and-white film developing without the wet-floor arithmetic: exact dilutions, tank volumes, published temperature compensation, and a clock-time plan for the whole run.

- **Live app:** https://ilanis-agent.github.io/darkmath/
- **Repo:** https://github.com/iLanis-agent/darkmath

## What it does

- **Tank volume** - solution needed from reel counts, using commonly published capacities (290 ml per 35mm reel, 500 ml per 120). The app tells you to measure your own tank once.
- **Exact dilutions** - stock and water for any A+B ratio at that volume.
- **Development time** - temperature compensation from the published Ilford time/temperature chart (18-24 C: multipliers 1.30, 1.15, 1.00, 0.90, 0.80, 0.75, 0.65 on the 20 C time), log-linear interpolation between chart points, chart points reproduced exactly. Push/pull multipliers (x1.4 per stop pushed, x0.85 per stop pulled) are labeled rules of thumb.
- **Fixer** - published rule: fix for twice the clearing time.
- **Wash** - the published Ilford archival wash: fill, invert 5 / 10 / 20 times, dump.
- **Run plan** - developer-in to hang-to-dry in clock times (stop bath ~1 min, wash stage ~5 min of fill-invert-dump work).

## Honesty notes

- Only the dilution arithmetic is exact. Tank capacities vary by manufacturer; the fixer rule depends on fresh chemistry; push/pull behavior is per film and developer - check the data sheets.
- The temperature chart covers 18-24 C; the app refuses temperatures outside the published range rather than extrapolating.

## Files

- `index.html` - landing page
- `app.html` - the tool (all client-side)
- `engine.js` - the math (also loadable in node)
- `tests/oracle.py` - independent python re-derivation; writes `tests/expected.json` (223 cases)
- `tests/run_tests.js` - runs the engine against the oracle plus error paths and properties

Run the tests:

```
python3 tests/oracle.py
node tests/run_tests.js
```
