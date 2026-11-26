window.AL = {};
(function (AL) {
'use strict';
AL.A = window.Android || null;
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
AL.$ = $; AL.$$ = $$;

// ---------- almacenamiento ----------
AL.LS = {
  get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};

// ---------- idioma ----------
AL.pref = AL.LS.get('al_lang', 'auto');
AL.lang = 'es';
AL.applyLang = function () {
  if (AL.pref === 'auto') { var n = (navigator.language || 'en').toLowerCase(); AL.lang = n.indexOf('es') === 0 ? 'es' : 'en'; }
  else AL.lang = AL.pref;
  document.documentElement.lang = AL.lang;
};
AL.applyLang();
AL.L = function (es, en) { return AL.lang === 'es' ? es : en; };
AL.T = function (a) { return AL.lang === 'es' ? a[0] : a[1]; };

// ---------- utilidades ----------
function p2(n) { return (n < 10 ? '0' : '') + n; }
AL.fmtDate = function (t) { var d = new Date(t); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
AL.stamp = function () { var d = new Date(); return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()); };
AL.fmtDur = function (ms) {
  var s = Math.round(ms / 1000);
  if (s < 60) return s + ' s';
  var m = Math.floor(s / 60); s = s % 60;
  if (m < 60) return m + ' min ' + s + ' s';
  return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
};
AL.fmtDist = function (m) { return m == null ? '--' : (m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m < 10000 ? 2 : 1) + ' km'); };
AL.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
AL.hexA = function (h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };
AL.dist = function (a, b) {
  var r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
  var h = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
};
AL.bearing = function (a, b) {
  var r = Math.PI / 180, y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
  var x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
};
AL.card8 = function (deg) {
  var es = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'], en = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return (AL.lang === 'es' ? es : en)[Math.round(deg / 45) % 8];
};

// ---------- calidad ----------
AL.CFG = {
  version: '0.3.1', pollMs: 2000, pointEveryMs: 20000, minMoveM: 25, outageConfirm: 2, maxPoints: 5000, maxOutages: 500,
  thresholds: { rsrp: [-80, -90, -100, -110], sinr: [20, 13, 0, -5], dbm: [-70, -85, -100, -110] }
};
AL.Q = [
  { n: ['Sin señal', 'No signal'], c: '#6b7280' }, { n: ['Muy mala', 'Very poor'], c: '#dc2626' },
  { n: ['Mala', 'Poor'], c: '#f97316' }, { n: ['Regular', 'Fair'], c: '#eab308' },
  { n: ['Buena', 'Good'], c: '#84cc16' }, { n: ['Excelente', 'Excellent'], c: '#16a34a' }
];
AL.qi = function (q) { return AL.Q[q + 1]; };
AL.qn = function (q) { return AL.T(AL.Q[q + 1].n); };
AL.rk = function (v, t) { return v >= t[0] ? 4 : v >= t[1] ? 3 : v >= t[2] ? 2 : v >= t[3] ? 1 : 0; };
AL.quality = function (s, why) {
  if (!s || why) return -1;
  var r = [], T_ = AL.CFG.thresholds;
  if (s.rsrp != null) r.push(AL.rk(s.rsrp, T_.rsrp));
  if (s.sinr != null) r.push(AL.rk(s.sinr, T_.sinr));
  if (!r.length && s.dbm != null) r.push(AL.rk(s.dbm, T_.dbm));
  if (!r.length && s.level >= 0) r.push(Math.min(4, s.level));
  return r.length ? Math.min.apply(null, r) : -1;
};

// ---------- bandas y frecuencias ----------
var LTE = [[1,2110,0,599],[2,1930,600,1199],[3,1805,1200,1949],[4,2110,1950,2399],[5,869,2400,2649],[7,2620,2750,3449],[8,925,3450,3799],
  [12,729,5010,5179],[13,746,5180,5279],[14,758,5280,5379],[17,734,5730,5849],[18,860,5850,5999],[19,875,6000,6149],[20,791,6150,6449],
  [21,1495.9,6450,6599],[25,1930,8040,8689],[26,859,8690,9039],[28,758,9210,9659],[29,717,9660,9769],[30,2350,9770,9869],[32,1452,9920,10359],
  [34,2010,36200,36349],[38,2570,37750,38249],[39,1880,38250,38649],[40,2300,38650,39649],[41,2496,39650,41589],[42,3400,41590,43589],
  [43,3600,43590,45589],[46,5150,46790,54539],[48,3550,55240,56739],[66,2110,66436,67335],[71,617,68586,68935]];
var NRB = [[1,2110,2170],[2,1930,1990],[3,1805,1880],[5,869,894],[7,2620,2690],[8,925,960],[20,791,821],[25,1930,1995],[28,758,803],
  [38,2570,2620],[40,2300,2400],[41,2496,2690],[66,2110,2200],[71,617,652],[78,3300,3800],[77,3300,4200],[79,4400,5000]];
AL.lteBand = function (n) {
  for (var i = 0; i < LTE.length; i++) { var r = LTE[i]; if (n >= r[2] && n <= r[3]) return { band: r[0], f: Math.round((r[1] + 0.1 * (n - r[2])) * 10) / 10 }; }
  return null;
};
AL.nrFreq = function (n) { return n < 600000 ? 0.005 * n : n < 2016667 ? 3000 + 0.015 * (n - 600000) : 24250.08 + 0.06 * (n - 2016667); };
AL.nrBand = function (f) { for (var i = 0; i < NRB.length; i++) if (f >= NRB[i][1] && f <= NRB[i][2]) return NRB[i][0]; return null; };
AL.bandClass = function (f) { return f == null ? null : f < 1000 ? 'low' : f < 2800 ? 'mid' : 'high'; };
AL.clsName = function (c) {
  return c === 'low' ? AL.L('Banda baja: más alcance y mejor en interiores, menos velocidad', 'Low band: longer range and better indoors, lower speed')
    : c === 'mid' ? AL.L('Banda media: equilibrio entre alcance y velocidad', 'Mid band: balance of range and speed')
    : c === 'high' ? AL.L('Banda alta: mucha velocidad, poco alcance', 'High band: high speed, short range') : '';
};
// Devuelve {label, f, cls, ch, tech}
AL.cellFreq = function (c) {
  if (!c) return null;
  var out = { label: '--', f: null, cls: null, ch: null, tech: c.type };
  if (c.type === 'LTE') {
    out.ch = c.earfcn; var b = c.earfcn != null ? AL.lteBand(c.earfcn) : null;
    var bn = (c.bands && c.bands.length) ? c.bands[0] : (b ? b.band : null);
    out.label = bn != null ? 'B' + bn : '--'; out.f = b ? b.f : null;
  } else if (c.type === 'NR') {
    out.ch = c.nrarfcn; if (c.nrarfcn != null) { out.f = Math.round(AL.nrFreq(c.nrarfcn) * 10) / 10; }
    var nb = (c.bands && c.bands.length) ? c.bands[0] : (out.f ? AL.nrBand(out.f) : null);
    out.label = nb != null ? 'n' + nb : '--';
  } else if (c.type === 'WCDMA') {
    out.ch = c.uarfcn; var u = c.uarfcn;
    if (u >= 10562 && u <= 10838) { out.label = 'B1'; out.f = u * 0.2; }
    else if (u >= 4357 && u <= 4458) { out.label = 'B5'; out.f = u * 0.2; }
    else if (u >= 2937 && u <= 3088) { out.label = 'B8'; out.f = u * 0.2 + 340; }
    else out.label = '3G';
  } else if (c.type === 'GSM') {
    out.ch = c.arfcn; var g = c.arfcn;
    if (g >= 1 && g <= 124) { out.label = 'GSM 900'; out.f = 935 + 0.2 * g; }
    else if (g >= 975 && g <= 1023) { out.label = 'GSM 900'; out.f = 925.2 + 0.2 * (g - 975); }
    else if (g >= 128 && g <= 251) { out.label = 'GSM 850'; out.f = 869.2 + 0.2 * (g - 128); }
    else if (g >= 512 && g <= 885) { out.label = 'GSM 1800/1900'; out.f = 1805.2 + 0.2 * (g - 512); }
    else out.label = '2G';
  }
  if (out.f != null) out.f = Math.round(out.f * 10) / 10;
  out.cls = AL.bandClass(out.f);
  return out;
};

// ---------- propagación (Okumura-Hata / COST-231) ----------
function aHm(f, hm) { var lf = Math.log10(f); return (1.1 * lf - 0.7) * hm - (1.56 * lf - 0.8); }
AL.pathLoss = function (f, dKm, hb, hm, env) {
  var lf = Math.log10(f), ld = Math.log10(Math.max(dKm, 0.02)), lhb = Math.log10(hb);
  var fs = 32.44 + 20 * ld + 20 * lf, Lp;
  if (f <= 1500) Lp = 69.55 + 26.16 * lf - 13.82 * lhb - aHm(f, hm) + (44.9 - 6.55 * lhb) * ld;
  else Lp = 46.3 + 33.9 * lf - 13.82 * lhb - aHm(f, hm) + (44.9 - 6.55 * lhb) * ld + (env === 'urban' ? 3 : 0);
  if (env === 'suburban') Lp -= 2 * Math.pow(Math.log10(f / 28), 2) + 5.4;
  if (env === 'rural') Lp -= 4.78 * lf * lf - 18.33 * lf + 40.94;
  return Math.max(fs, Lp);
};
AL.EIRP_RE = 32; // dBm por elemento de recurso (celda macro típica 20 MHz)
AL.rsrpAt = function (f, dKm, env, hb, hm, gain, loss) { return AL.EIRP_RE - AL.pathLoss(f, dKm, hb, hm, env) + gain - loss; };
AL.rangeFor = function (target, f, env, hb, hm, gain, loss) {
  var lo = 0.02, hi = 80;
  if (AL.rsrpAt(f, hi, env, hb, hm, gain, loss) >= target) return hi;
  if (AL.rsrpAt(f, lo, env, hb, hm, gain, loss) < target) return 0;
  for (var i = 0; i < 40; i++) { var mid = (lo + hi) / 2; if (AL.rsrpAt(f, mid, env, hb, hm, gain, loss) >= target) lo = mid; else hi = mid; }
  return lo;
};

// ---------- cables ----------
AL.CABLES = [
  { id: 'RG-58', z: 50, vf: 0.66, od: 4.9, a900: 5.2, a2400: 9.5, note: ['Fino y flexible, pero con mucha pérdida: solo para tramos de 1–3 m.', 'Thin and flexible but very lossy: only for 1–3 m runs.'] },
  { id: 'RG-6 (75 Ω)', z: 75, vf: 0.82, od: 6.9, a900: 2.0, a2400: 3.6, note: ['TV por cable, barato y fácil de conseguir. 75 Ω: aceptable en recepción (SWR≈1.5).', 'Cable-TV coax, cheap and easy to find. 75 Ω: fine for receive (SWR≈1.5).'] },
  { id: 'RG-213', z: 50, vf: 0.66, od: 10.3, a900: 1.7, a2400: 2.9, note: ['Grueso, buena relación precio/pérdida para 5–10 m.', 'Thick, good price/loss for 5–10 m.'] },
  { id: 'LMR-400', z: 50, vf: 0.85, od: 10.3, a900: 1.28, a2400: 2.2, note: ['Estándar para antenas externas: poca pérdida hasta ~15 m.', 'The standard for external antennas: low loss up to ~15 m.'] },
  { id: 'LMR-600', z: 50, vf: 0.87, od: 14.9, a900: 0.82, a2400: 1.45, note: ['Para tramos largos (15–30 m). Rígido y más caro.', 'For long runs (15–30 m). Stiff and pricier.'] },
  { id: 'LMR-200', z: 50, vf: 0.83, od: 5.0, a900: 2.26, a2400: 3.97, note: ['Fino pero de baja pérdida para su tamaño: bueno hasta ~5 m.', 'Thin but low-loss for its size: good up to ~5 m.'] }
];
AL.cableLoss = function (c, f, len) { var p = Math.log(c.a2400 / c.a900) / Math.log(2400 / 900); return c.a900 * Math.pow(f / 900, p) * len / 10; };
AL.CONN_LOSS = 0.3; // dB por conector

// ---------- Wi-Fi ----------
AL.wifiChannel = function (f) { return f >= 2412 && f <= 2484 ? (f === 2484 ? 14 : Math.round((f - 2407) / 5)) : f >= 5000 ? Math.round((f - 5000) / 5) : null; };
})(window.AL);
