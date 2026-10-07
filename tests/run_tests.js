const E = require('../engine.js');
const cases = require('./expected.json');
let pass = 0, fail = 0;
const TOL = 1e-9;
function chk(ok, label, got, want) {
  if (ok) pass++;
  else { fail++; console.error('FAIL', label, 'got', got, 'want', want); }
}
function toMin(clock) { const [h, m] = clock.split(':').map(Number); return h * 60 + m; }
for (const c of cases) {
  if (c.kind === 'dil') {
    const r = E.dilution(c.a, c.b, c.total);
    chk(Math.abs(r.stockMl - c.stock) < TOL && Math.abs(r.waterMl - c.water) < TOL, `dil ${c.a}+${c.b} ${c.total}`, [r.stockMl, r.waterMl], [c.stock, c.water]);
  } else if (c.kind === 'tank') {
    chk(Math.abs(E.tankVolume(c.n35, c.n120).ml - c.ml) < TOL, `tank ${c.n35}/${c.n120}`, E.tankVolume(c.n35, c.n120).ml, c.ml);
  } else if (c.kind === 'chartpt') {
    chk(Math.abs(E.tempFactor(c.temp).factor - c.factor) < c.tol, `chart ${c.temp}`, E.tempFactor(c.temp).factor, c.factor);
  } else if (c.kind === 'temp') {
    chk(Math.abs(E.tempFactor(c.temp).factor - c.factor) < TOL, `temp ${c.temp}`, E.tempFactor(c.temp).factor, c.factor);
  } else if (c.kind === 'adj') {
    const r = E.adjustedTime(c.mins, c.temp, c.stops);
    chk(Math.abs(r.minutes - c.minutes) < TOL && Math.abs(r.tempFactor - c.tf) < TOL && Math.abs(r.pushFactor - c.pm) < TOL,
      `adj ${c.mins} @${c.temp} ${c.stops}`, [r.minutes, r.tempFactor, r.pushFactor], [c.minutes, c.tf, c.pm]);
  } else if (c.kind === 'fix') {
    chk(Math.abs(E.fixTime(c.sec).seconds - c.fixSec) < TOL, `fix ${c.sec}`, E.fixTime(c.sec).seconds, c.fixSec);
  } else if (c.kind === 'tl') {
    const r = E.timeline(c.start, c.dev, c.fix);
    const got = r.steps.map(s => toMin(s.at));
    chk(JSON.stringify(got) === JSON.stringify(c.ats), `tl ${c.start}`, got, c.ats);
  }
}
// error paths
const errs = [
  E.dilution(0, 1, 500).error, E.dilution(1, 1, 0).error, E.dilution(-1, 2, 500).error,
  E.tankVolume(0, 0).error, E.tankVolume(1.5, 0).error, E.tankVolume(-1, 0).error,
  E.tempFactor(17).error, E.tempFactor(25).error, E.tempFactor('x').error,
  E.adjustedTime(0, 20, 0).error, E.adjustedTime(10, 26, 0).error, E.adjustedTime(10, 20, 4).error, E.adjustedTime(10, 20, 0.5).error,
  E.fixTime(0).error, E.timeline(-1, 10, 2).error, E.timeline(800, 0, 2).error, E.timeline(800, 10, 0).error
];
errs.forEach((e, i) => chk(typeof e === 'string' && e.length > 5, 'error path ' + i, e, 'error string'));
// properties: dilution sums to total; wash sequence is the published 5/10/20
for (const [a, b, t] of [[1, 9, 600], [1, 1, 290], [2, 5, 1000]]) {
  const r = E.dilution(a, b, t);
  chk(Math.abs(r.stockMl + r.waterMl - t) < 1e-9, `dil sum ${a}+${b}`, r.stockMl + r.waterMl, t);
}
const w = E.washSequence();
chk(w.steps.map(s => s.inversions).join(',') === '5,10,20', 'wash seq', w.steps.map(s => s.inversions), '5,10,20');
// monotonicity: colder is always longer
let mono = true;
for (let t = 18; t < 24; t += 0.5) if (E.tempFactor(t).factor < E.tempFactor(t + 0.5).factor) mono = false;
chk(mono, 'temp monotonic', mono, true);
console.log(`${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
