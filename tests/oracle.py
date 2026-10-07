#!/usr/bin/env python3
# Independent oracle for Darkmath. Re-derives dilution, tank volumes, the
# published Ilford chart interpolation, push/pull rules and fix timing from
# scratch, then checks chart points against the published values exactly.
import json, math

def jsround(x):  # JS Math.round semantics (half up), not python banker's rounding
    return math.floor(x + 0.5)

CHART = [(18, 1.30), (19, 1.15), (20, 1.00), (21, 0.90), (22, 0.80), (23, 0.75), (24, 0.65)]
ML35, ML120 = 290, 500
PUSH, PULL = 1.4, 0.85

def dilute(a, b, total):
    return total * a / (a + b), total * b / (a + b)

def tank(n35, n120):
    return n35 * ML35 + n120 * ML120

def temp_factor(t):
    for i in range(len(CHART) - 1):
        (t0, f0), (t1, f1) = CHART[i], CHART[i + 1]
        if t0 <= t <= t1:
            w = (t - t0) / (t1 - t0)
            return math.exp(math.log(f0) + w * (math.log(f1) - math.log(f0)))
    raise ValueError(t)

def adj(mins, temp, stops):
    mult = PUSH ** stops if stops > 0 else PULL ** (-stops)
    return mins * temp_factor(temp) * mult, temp_factor(temp), mult

cases = []
for a, b in ((1, 0), (1, 1), (1, 3), (1, 9), (2, 5), (1, 14)):
    for total in (290, 500, 600, 1000):
        s, w = dilute(a, b, total)
        cases.append({"kind": "dil", "a": a, "b": b, "total": total, "stock": s, "water": w})
for n35, n120 in ((1, 0), (2, 0), (0, 1), (1, 1), (4, 0), (0, 2), (8, 3)):
    cases.append({"kind": "tank", "n35": n35, "n120": n120, "ml": tank(n35, n120)})
# every published chart point must reproduce exactly; plus dense interpolation grid
for t, f in CHART:
    cases.append({"kind": "chartpt", "temp": t, "factor": f, "tol": 1e-9})
t = 18.0
while t <= 24.0001:
    cases.append({"kind": "temp", "temp": round(t, 2), "factor": temp_factor(round(t, 2))})
    t += 0.25
for mins in (6.5, 8, 10, 12, 15):
    for temp in (18, 20, 21.5, 22, 24):
        for stops in (-2, -1, 0, 1, 2, 3):
            m, tf, pm = adj(mins, temp, stops)
            cases.append({"kind": "adj", "mins": mins, "temp": temp, "stops": stops, "minutes": m, "tf": tf, "pm": pm})
for sec in (30, 45, 60, 75, 90, 120):
    cases.append({"kind": "fix", "sec": sec, "fixSec": sec * 2})
for start, dev, fix in ((0, 9.4, 2), (810, 11.2, 1.5), (1400, 15, 3), (1435, 20, 2.5)):
    t = start
    steps = [t, t + dev, t + dev + 1, t + dev + 1 + fix, t + dev + 1 + fix + 5]
    cases.append({"kind": "tl", "start": start, "dev": dev, "fix": fix,
                  "ats": [jsround(((x % 1440) + 1440) % 1440) % 1440 for x in steps]})
json.dump(cases, open("tests/expected.json", "w"))
print(f"oracle wrote {len(cases)} cases")
