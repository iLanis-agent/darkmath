// Darkmath engine: black-and-white film developing chemistry.
// Dilution is exact arithmetic. Tank capacities and fixer rules are commonly
// published values (labeled). Temperature compensation interpolates the
// published Ilford time/temperature chart (labeled, log-linear between chart
// points). Push/pull multipliers are labeled rules of thumb.
// Chart: multiplier on the 20 C time, from Ilford's published
// time/temperature chart (10 min baseline: 18C->13, 19->11.5, 21->9, 22->8,
// 23->7.5, 24->6.5).
var TEMP_CHART = [ [18, 1.30], [19, 1.15], [20, 1.00], [21, 0.90], [22, 0.80], [23, 0.75], [24, 0.65] ];
// commonly published tank solution volumes per reel
var ML_35 = 290;   // per 35mm reel (Paterson-style tanks, published ~290-300)
var ML_120 = 500;  // per 120 reel (published ~490-500)
// labeled rules of thumb
var PUSH_PER_STOP = 1.4;   // multiply dev time by ~1.4 per stop pushed (rule of thumb, varies by film/developer)
var PULL_PER_STOP = 0.85;  // multiply by ~0.85 per stop pulled (rule of thumb)
var FIX_CLEAR_MULT = 2;    // published rule: fix for twice the clearing time

function bad(v) { return !(typeof v === 'number' && isFinite(v)); }

// split a working volume into stock and water for a dilution written as A+B
// (A parts stock, B parts water; 1+0 means use stock straight)
function dilution(ratioA, ratioB, totalMl) {
  if (bad(ratioA) || bad(ratioB) || ratioA <= 0 || ratioB < 0 || bad(totalMl) || totalMl <= 0) {
    return { error: 'Ratio parts and total volume must be positive numbers.' };
  }
  var stock = totalMl * ratioA / (ratioA + ratioB);
  return { stockMl: stock, waterMl: totalMl - stock, ratio: ratioA + '+' + ratioB };
}

// solution needed for n35 35mm reels and n120 120 reels (published capacities)
function tankVolume(n35, n120) {
  if (bad(n35) || bad(n120) || n35 < 0 || n120 < 0 || n35 % 1 || n120 % 1 || (n35 + n120) < 1) {
    return { error: 'Reel counts must be whole numbers with at least one reel.' };
  }
  var ml = n35 * ML_35 + n120 * ML_120;
  return { ml: ml, note: 'Uses commonly published tank capacities (' + ML_35 + ' ml per 35mm reel, ' + ML_120 + ' ml per 120). Check your own tank - fill it with water and measure once.' };
}

// temperature compensation: multiplier from the published chart, log-linear
// interpolation between chart points; the 20 C point is exactly 1.0.
function tempFactor(tempC) {
  if (bad(tempC) || tempC < TEMP_CHART[0][0] || tempC > TEMP_CHART[TEMP_CHART.length - 1][0]) {
    return { error: 'Temperature must be between ' + TEMP_CHART[0][0] + ' and ' + TEMP_CHART[TEMP_CHART.length - 1][0] + ' C (the published chart range).' };
  }
  for (var i = 0; i < TEMP_CHART.length - 1; i++) {
    var t0 = TEMP_CHART[i][0], f0 = TEMP_CHART[i][1];
    var t1 = TEMP_CHART[i + 1][0], f1 = TEMP_CHART[i + 1][1];
    if (tempC >= t0 && tempC <= t1) {
      var w = (tempC - t0) / (t1 - t0);
      var logf = Math.log(f0) + w * (Math.log(f1) - Math.log(f0));
      return { factor: Math.exp(logf), chart: true };
    }
  }
  return { factor: 1, chart: true };
}
function adjustedTime(minAt20, tempC, stops) {
  if (bad(minAt20) || minAt20 <= 0 || bad(stops) || stops < -2 || stops > 3 || stops % 1) {
    return { error: 'Time at 20 C must be positive; push/pull stops must be whole, from -2 to +3.' };
  }
  var tf = tempFactor(tempC);
  if (tf.error) return tf;
  var mult = stops > 0 ? Math.pow(PUSH_PER_STOP, stops) : Math.pow(PULL_PER_STOP, -stops);
  var mins = minAt20 * tf.factor * mult;
  return {
    minutes: mins, tempFactor: tf.factor, pushFactor: mult,
    note: 'Chart multiplier ' + tf.factor.toFixed(3) + ' (published Ilford chart' + (tempC === Math.floor(tempC) && TEMP_CHART.some(function(p){return p[0]===tempC;}) ? ' point' : ', interpolated') + ')' +
      (stops ? '; push/pull multiplier ' + mult.toFixed(2) + ' (rule of thumb - film and developer change this)' : '') + '.'
  };
}
function fixTime(clearingSec) {
  if (bad(clearingSec) || clearingSec <= 0) return { error: 'Clearing time must be positive.' };
  var sec = clearingSec * FIX_CLEAR_MULT;
  return { seconds: sec, minutes: sec / 60, note: 'Published rule: fix for twice the time the film takes to clear. Re-test clearing as the fixer ages.' };
}
// Ilford archival wash (published sequence): fill, invert n times, dump, repeat
function washSequence() {
  return {
    steps: [
      { step: 'Fill with water, 5 inversions, dump', inversions: 5 },
      { step: 'Fill, 10 inversions, dump', inversions: 10 },
      { step: 'Fill, 20 inversions, dump', inversions: 20 }
    ],
    note: 'Published Ilford archival wash: three fill-invert-dump stages (5, 10, 20 inversions) wash fixer with far less water than a running tap.'
  };
}
// full step timeline from a starting clock time (minutes from midnight)
function timeline(startMin, devMin, fixMin) {
  if (bad(startMin) || startMin < 0 || startMin >= 1440 || bad(devMin) || devMin <= 0 || bad(fixMin) || fixMin <= 0) {
    return { error: 'Start time, development and fix times must be valid.' };
  }
  var steps = [
    { name: 'Developer in', at: startMin },
    { name: 'Developer out (stop bath, ~1 min)', at: startMin + devMin },
    { name: 'Fixer in', at: startMin + devMin + 1 },
    { name: 'Fixer out, start Ilford wash', at: startMin + devMin + 1 + fixMin },
    { name: 'Wash done, hang to dry', at: startMin + devMin + 1 + fixMin + 5 }
  ];
  return { steps: steps.map(function (s) { return { name: s.name, at: fmtClock(s.at) }; }) };
}
function fmtClock(mins) {
  var m = Math.round(((mins % 1440) + 1440) % 1440);
  var hh = Math.floor(m / 60), mm = m % 60;
  return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
}

var engine = {
  dilution: dilution, tankVolume: tankVolume, tempFactor: tempFactor,
  adjustedTime: adjustedTime, fixTime: fixTime, washSequence: washSequence,
  timeline: timeline,
  CONST: { TEMP_CHART: TEMP_CHART, ML_35: ML_35, ML_120: ML_120, PUSH_PER_STOP: PUSH_PER_STOP, PULL_PER_STOP: PULL_PER_STOP, FIX_CLEAR_MULT: FIX_CLEAR_MULT }
};
if (typeof module !== 'undefined') module.exports = engine;
