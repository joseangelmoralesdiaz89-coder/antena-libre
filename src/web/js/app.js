(function (AL) {
'use strict';
var A = AL.A, $ = AL.$, $$ = AL.$$, tr = AL.L, T = AL.T, LS = AL.LS, CFG = AL.CFG, esc = AL.esc;
var S = AL.S = { sig: null, loc: null, cells: [], cell: null, freq: null, tow: null, why: null, reco: null, tab: 'senal', n: 0, bad: 0, good: 0, cur: null,
  lastPt: null, lastLoc: null, hist: [], target: null, useTrue: false, est: {}, centered: false, mapFilter: 'all', heatN: -1, offline: false };
var bins = []; for (var bi = 0; bi < 36; bi++) bins.push(null);
var D = AL.D = { outages: LS.get('al_outages', []), points: LS.get('al_points', []), towers: LS.get('al_towers', {}), tried: LS.get('al_ttry', {}) };
AL.views = {};

// ---------- utilidades UI ----------
AL.toast = function (m) { var t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(AL.toast.t); AL.toast.t = setTimeout(function () { t.classList.remove('show'); }, 3200); };
function persist() { LS.set('al_outages', D.outages); LS.set('al_points', D.points); }
function fmt(v) { return v == null ? '--' : String(v); }
var cbs = {};
window.__native = function (id, body) { var f = cbs[id]; if (f) { delete cbs[id]; f(body); } };
function native(url, cb) { var id = 'c' + Date.now() + Math.floor(Math.random() * 1e6); cbs[id] = cb; A.fetchUrl(id, url); }

// ---------- lectura nativa ----------
function readSignal() { try { return JSON.parse(A.getSignal()); } catch (e) { return null; } }
function readLoc() { try { var l = JSON.parse(A.getLocation()); return l && l.lat != null ? l : null; } catch (e) { return null; } }
function readCells() { try { return JSON.parse(A.getCells()); } catch (e) { return []; } }
function ck(c) {
  if (!c) return null;
  var id = c.nci != null ? c.nci : (c.ci != null ? c.ci : c.cid);
  return c.type + ':' + (c.mcc || '') + '-' + (c.mnc || '') + '-' + (c.tac != null ? c.tac : (c.lac != null ? c.lac : '')) + '-' + id;
}
function serving(s, cells) {
  var want = s.tech === '5G' ? 'NR' : s.tech === '3G' ? 'WCDMA' : s.tech === '2G' ? 'GSM' : 'LTE';
  var reg = cells.filter(function (c) { return c.reg; });
  return reg.filter(function (c) { return c.type === want; })[0] || reg[0] || null;
}
function outageReason(s) {
  if (!s) return null;
  if (s.airplane) return tr('Modo avión', 'Airplane mode');
  if (s.state === 'OUT_OF_SERVICE') return tr('Sin servicio', 'Out of service');
  if (s.state === 'POWER_OFF') return tr('Radio apagada', 'Radio off');
  if (s.state === 'EMERGENCY_ONLY') return tr('Solo emergencias', 'Emergency only');
  if (!s.wifi && !s.internet) return tr('Sin conexión de datos', 'No data connection');
  return null;
}
var REG = { IN_SERVICE: ['En servicio', 'In service'], OUT_OF_SERVICE: ['Sin servicio', 'Out of service'], EMERGENCY_ONLY: ['Solo emergencias', 'Emergency only'], POWER_OFF: ['Radio apagada', 'Radio off'], UNKNOWN: ['Desconocido', 'Unknown'] };

// ---------- caídas y puntos ----------
function startOutage(why, s, t) {
  var l = S.loc || S.lastLoc;
  S.cur = { id: t, start: t, reason: why, lat: l ? l.lat : null, lon: l ? l.lon : null, net: s.net, op: s.operator };
  LS.set('al_open', S.cur);
}
function endOutage() {
  S.cur.end = Date.now(); S.cur.dur = S.cur.end - S.cur.start;
  D.outages.unshift(S.cur); if (D.outages.length > CFG.maxOutages) D.outages.length = CFG.maxOutages;
  S.cur = null; LS.del('al_open'); persist();
}
function closeStale() {
  var o = LS.get('al_open', null); if (!o) return;
  var hb = LS.get('al_hb', o.start); o.end = Math.max(hb, o.start); o.dur = o.end - o.start; o.reason += tr(' (app cerrada)', ' (app closed)');
  D.outages.unshift(o); LS.del('al_open'); persist();
}
function maybeSavePoint(s, l, why) {
  if (!l || l.age > 180) return;
  var now = Date.now(), lp = S.lastPt;
  if (lp && AL.dist(lp, l) < CFG.minMoveM && now - lp.t < CFG.pointEveryMs) return;
  var f = S.freq;
  var pt = { t: now, lat: l.lat, lon: l.lon, acc: l.acc, q: AL.quality(s, why), rsrp: s.rsrp, sinr: s.sinr, dbm: s.dbm, net: s.net, op: s.operator, out: !!why,
    ck: ck(S.cell), pci: S.cell ? S.cell.pci : null, band: f ? f.label : null, mhz: f ? f.f : null };
  D.points.push(pt); if (D.points.length > CFG.maxPoints) D.points.splice(0, D.points.length - CFG.maxPoints);
  S.lastPt = pt; persist();
}

// ---------- torre: base de datos, TA, mediciones y modelo ----------
function lookupTower(c) {
  var key = LS.get('al_ocid', ''), k = ck(c);
  if (!A || !key || !c || !c.mcc || D.towers[k]) return;
  if (D.tried[k] && Date.now() - D.tried[k] < 6 * 3600 * 1000) return;
  var id = c.nci != null ? c.nci : (c.ci != null ? c.ci : c.cid), lac = c.tac != null ? c.tac : c.lac;
  if (id == null || lac == null) return;
  var radio = { LTE: 'LTE', NR: 'NR', WCDMA: 'UMTS', GSM: 'GSM' }[c.type];
  D.tried[k] = Date.now(); LS.set('al_ttry', D.tried);
  native('https://opencellid.org/cell/get?key=' + encodeURIComponent(key) + '&mcc=' + c.mcc + '&mnc=' + c.mnc + '&lac=' + lac + '&cellid=' + id + '&radio=' + radio + '&format=json', function (body) {
    try {
      var j = JSON.parse(body);
      if (j.lat != null && j.lon != null) { D.towers[k] = { lat: +j.lat, lon: +j.lon, src: 'ocid', range: j.range }; LS.set('al_towers', D.towers); AL.toast(tr('Torre encontrada en la base de datos', 'Tower found in the database')); computeTower(); }
      else if (AL.manual) AL.toast(tr('La celda no está en OpenCelliD', 'Cell not in OpenCelliD') + (j.error ? ': ' + j.error : ''));
    } catch (e) { if (AL.manual) AL.toast(tr('Sin respuesta de OpenCelliD', 'No response from OpenCelliD')); }
  });
}
AL.lookupNow = function () {
  if (!S.cell) { AL.toast(tr('Aún no hay celda detectada', 'No cell detected yet')); return; }
  if (!LS.get('al_ocid', '')) { AL.toast(tr('Falta la clave OpenCelliD (Más → Ajustes)', 'OpenCelliD key missing (More → Settings)')); return; }
  AL.manual = true; delete D.tried[ck(S.cell)]; lookupTower(S.cell);
};
function estimateTower(key) {
  var P = D.points.filter(function (p) { return p.ck === key && p.rsrp != null && !p.out; }).slice(-150), i, j;
  if (P.length < 6) return { err: tr('Faltan mediciones (' + P.length + '/6). Camina con la app abierta.', 'Not enough readings (' + P.length + '/6). Walk around with the app open.') };
  var span = 0; for (i = 0; i < P.length; i++) for (j = i + 1; j < P.length; j++) span = Math.max(span, AL.dist(P[i], P[j]));
  if (span < 120) return { err: tr('Muévete más: necesitas ≥ 120 m entre puntos (llevas ' + Math.round(span) + ' m).', 'Move more: you need ≥ 120 m between points (so far ' + Math.round(span) + ' m).') };
  var cLa = 0, cLo = 0; P.forEach(function (p) { cLa += p.lat; cLo += p.lon; }); cLa /= P.length; cLo /= P.length;
  var ky = 111320, kx = 111320 * Math.cos(cLa * Math.PI / 180), best = null;
  function sse(la, lo) {
    var n = P.length, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0, k;
    for (k = 0; k < n; k++) {
      var dx = (P[k].lon - lo) * kx, dy = (P[k].lat - la) * ky, d = Math.max(25, Math.sqrt(dx * dx + dy * dy)), x = Math.log10(d), y = P[k].rsrp;
      sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y;
    }
    var den = n * sxx - sx * sx; if (den < 1e-9) return null;
    var b = (n * sxy - sx * sy) / den; if (b > -12 || b < -50) return null;
    var a = (sy - b * sx) / n, e = syy - a * sy - b * sxy, sst = syy - sy * sy / n;
    return { e: e, r2: sst > 0 ? 1 - e / sst : 0 };
  }
  function search(la0, lo0, rad, st) {
    for (var a = -st; a <= st; a++) for (var b = -st; b <= st; b++) {
      var la = la0 + a * rad / st / ky, lo = lo0 + b * rad / st / kx, r = sse(la, lo);
      if (r && (!best || r.e < best.e)) best = { e: r.e, lat: la, lon: lo, r2: r.r2 };
    }
  }
  search(cLa, cLo, 6000, 30); if (!best) return { err: tr('Las mediciones no encajan con un modelo de torre.', 'Readings do not fit a tower model.') };
  search(best.lat, best.lon, 400, 12);
  if (best.r2 < 0.3) return { err: tr('Resultado poco fiable (R² ' + best.r2.toFixed(2) + '). Mide en más direcciones.', 'Unreliable result (R² ' + best.r2.toFixed(2) + '). Measure in more directions.') };
  return { lat: best.lat, lon: best.lon, r2: best.r2, n: P.length, src: 'est' };
}
AL.estimateNow = function () {
  if (!S.cell) { AL.toast(tr('Aún no hay celda detectada', 'No cell detected yet')); return; }
  var k = ck(S.cell), r = estimateTower(k);
  if (r.err) { AL.toast(r.err); return; }
  S.est[k] = r; computeTower(); AL.toast(tr('Torre estimada con ' + r.n + ' mediciones (R² ' + r.r2.toFixed(2) + ')', 'Tower estimated from ' + r.n + ' readings (R² ' + r.r2.toFixed(2) + ')'));
  if (AL.views.map) AL.views.map.update(true);
};
function computeTower() {
  var c = S.cell, loc = S.loc || S.lastLoc, s = S.sig; S.tow = null;
  if (!c || !s) return;
  var k = ck(c), t = D.towers[k] || (S.est[k] && S.est[k].lat != null ? S.est[k] : null);
  if (t && loc) { S.tow = { lat: t.lat, lon: t.lon, src: t.src, dist: AL.dist(loc, t), bearing: AL.bearing(loc, t) }; return; }
  if (c.ta != null && c.ta >= 0 && c.ta <= 1282) { S.tow = { src: 'ta', dist: c.ta * 78.12 }; return; }
  var rs = s.rsrp != null ? s.rsrp : null, f = S.freq && S.freq.f;
  if (rs != null && f) S.tow = { src: 'model', dist: AL.rangeFor(rs, f, 'suburban', 30, 1.5, 0, 0) * 1000 };
}
function srcName(t) {
  if (!t) return '';
  return { ocid: tr('base de datos OpenCelliD', 'OpenCelliD database'), est: tr('estimada con tus mediciones', 'estimated from your readings'), ta: tr('timing advance de la red (≈)', 'network timing advance (≈)'), model: tr('modelo por potencia (muy aproximado)', 'power model (very rough)') }[t.src];
}

// ---------- A cuál conectarte ----------
function recommend() {
  var s = S.sig, cur = S.cell, list = [];
  if (!s) return null;
  S.cells.forEach(function (c) {
    if ((c.type !== 'LTE' && c.type !== 'NR') || c.rsrp == null) return;
    var f = AL.cellFreq(c); list.push({ c: c, f: f, cur: cur && ck(c) === ck(cur) });
  });
  list.sort(function (a, b) { return b.c.rsrp - a.c.rsrp; });
  var rs = s.rsrp, pick = null, msg = null;
  if (rs != null && list.length > 1) {
    if (rs <= -105) {
      var lows = list.filter(function (x) { return !x.cur && x.f && x.f.f && x.f.f < 1000 && x.c.rsrp >= -118 && x.c.rsrp >= rs - 6; });
      pick = lows[0] || list.filter(function (x) { return !x.cur && x.c.rsrp > rs + 3; })[0] || null;
      if (pick) msg = tr('Hay una celda mejor para tu situación: ' + pick.f.label + ' (' + pick.c.rsrp + ' dBm). Mira “A cuál conectarte”.', 'A better cell for your situation exists: ' + pick.f.label + ' (' + pick.c.rsrp + ' dBm). See “Which one to connect to”.');
    } else if (rs >= -95 && (s.sinr == null || s.sinr >= 10)) {
      var hi = list.filter(function (x) { return !x.cur && x.f && x.f.f && S.freq && S.freq.f && x.f.f > S.freq.f && x.c.rsrp >= -105; });
      pick = hi[0] || null;
      if (pick) msg = tr('Tu señal es fuerte: ' + pick.f.label + ' (' + pick.f.f + ' MHz) daría más velocidad.', 'Your signal is strong: ' + pick.f.label + ' (' + pick.f.f + ' MHz) would give more speed.');
    }
  }
  return { list: list, pick: pick, msg: msg };
}

// ---------- ciclo principal ----------
function tick() {
  if (!A) { render(); return; }
  S.n++;
  var s = readSignal(), l = readLoc();
  S.sig = s; S.loc = l; if (l) S.lastLoc = l;
  if (S.n % 2 === 1 || !S.cells.length) S.cells = readCells();
  if (s) {
    S.cell = serving(s, S.cells); S.freq = S.cell ? AL.cellFreq(S.cell) : null;
    var rs = s.rsrp != null ? s.rsrp : s.dbm;
    S.hist.push(rs); if (S.hist.length > 90) S.hist.shift();
    LS.set('al_hb', Date.now());
    var why = outageReason(s); S.why = why;
    if (why) { S.bad++; S.good = 0; if (!S.cur && S.bad >= CFG.outageConfirm) startOutage(why, s, Date.now() - (S.bad - 1) * CFG.pollMs); }
    else { S.good++; S.bad = 0; if (S.cur && S.good >= CFG.outageConfirm) endOutage(); }
    maybeSavePoint(s, l, why);
    if (S.cell && S.n % 5 === 1) lookupTower(S.cell);
    computeTower(); S.reco = recommend();
  }
  render();
}

// ---------- hoja “qué es / cómo mejorar” (pulsación larga 3 s) ----------
var HOLD = 3000, timer = null, holdEl = null, sx = 0, sy = 0;
function startHold(el, e) {
  cancelHold(); holdEl = el; sx = e.clientX; sy = e.clientY; el.classList.add('pressing');
  timer = setTimeout(function () { var m = el.dataset.m; cancelHold(); if (A) A.vibrate(40); AL.openSheet(m); }, HOLD);
}
function cancelHold() { if (timer) clearTimeout(timer); timer = null; if (holdEl) holdEl.classList.remove('pressing'); holdEl = null; }
function metricValue(m) {
  var s = S.sig; if (!s) return '--';
  var f = S.freq;
  return { quality: AL.qn(AL.quality(s, S.why)), rsrp: fmt(s.rsrp != null ? s.rsrp : s.dbm) + ' dBm', sinr: fmt(s.sinr) + ' dB', rsrq: fmt(s.rsrq) + ' dB', net: s.net, op: s.operator || '--',
    reg: T(REG[s.state] || REG.UNKNOWN), inet: $('#v-inet') ? $('#v-inet').textContent : '--', gps: S.loc ? '±' + S.loc.acc + ' m' : tr('Sin posición', 'No fix'),
    band: f ? f.label + (f.f ? ' · ' + f.f + ' MHz' : '') : '--', cell: S.cell ? 'ID ' + (S.cell.ci != null ? S.cell.ci : (S.cell.nci != null ? S.cell.nci : (S.cell.cid != null ? S.cell.cid : '--'))) + ' · PCI ' + fmt(S.cell.pci) : '--',
    tower: S.tow ? AL.fmtDist(S.tow.dist) : '--' }[m] || '--';
}
AL.openSheet = function (m) {
  var d = AL.METRICS[m]; if (!d) return;
  var scale = AL.scaleHtml(m);
  var extra = AL.advise({ s: S.sig, why: S.why, cell: S.cell, cells: S.cells, loc: S.loc, tow: S.tow, reco: S.reco }).slice(0, 2);
  var html = '<div class="sh-h"><h3>' + T(d.n) + '</h3><button class="x" data-act="closeSheet">✕</button></div>' +
    '<div class="sh-v">' + esc(metricValue(m)) + '</div><p>' + T(d.what) + '</p>' + scale +
    '<h4>' + tr('Cómo mejorarlo', 'How to improve it') + '</h4><ul>' + d.how.map(function (h) { return '<li>' + T(h) + '</li>'; }).join('') + '</ul>' +
    '<h4>' + tr('Ahora mismo', 'Right now') + '</h4><ul>' + extra.map(function (x) { return '<li>' + esc(x[0]) + '</li>'; }).join('') + '</ul>';
  $('#sheet .sh-c').innerHTML = html; $('#sheet').classList.add('open');
};
AL.closeSheet = function () { $('#sheet').classList.remove('open'); };

// ---------- vista SEÑAL ----------
function tile(m, label) { return '<div class="m" data-m="' + m + '"><button class="i" data-act="info" data-m="' + m + '">i</button><b id="v-' + m + '">--</b><span>' + label + '</span><u></u></div>'; }
AL.views.senal = {
  build: function () {
    $('#v-senal').innerHTML =
      '<div id="banner" class="banner hidden"></div>' +
      '<p class="hint">' + tr('Mantén presionado 3 s cualquier dato para ver qué es y cómo mejorarlo.', 'Press and hold any value for 3 s to see what it is and how to improve it.') + '</p>' +
      '<div class="card hero" data-m="quality"><div id="qdot" class="qdot"></div><div><div id="qname" class="qname">--</div><div id="qsub" class="muted">…</div></div><u></u></div>' +
      '<div class="card" data-m="rsrp"><button class="i" data-act="info" data-m="rsrp">i</button><div class="big"><span id="v-rsrp">--</span><small> dBm · RSRP</small></div><div class="bar"><i id="barfill"></i></div><canvas id="spark" height="46"></canvas><u></u></div>' +
      '<div class="card freq" data-m="band"><button class="i" data-act="info" data-m="band">i</button><div class="muted small">' + tr('Frecuencia / banda', 'Frequency / band') + '</div><div id="v-band" class="fq">--</div><div id="bandSub" class="muted small"></div><u></u></div>' +
      '<div class="grid">' + tile('sinr', 'SINR') + tile('rsrq', 'RSRQ') + tile('net', tr('Red', 'Network')) + tile('op', tr('Operador', 'Carrier')) + tile('reg', tr('Registro', 'Registration')) + tile('inet', 'Internet') + tile('gps', 'GPS') + tile('cell', tr('Celda', 'Cell')) + '</div>' +
      '<div class="card tw" data-m="tower"><button class="i" data-act="info" data-m="tower">i</button><div class="muted small">' + tr('Distancia a la torre', 'Distance to the tower') + '</div><div id="v-tower" class="fq">--</div><div id="towerSub" class="muted small"></div><u></u></div>' +
      '<div id="permbox" class="card warn hidden">' + tr('Faltan permisos de ubicación / teléfono para leer la señal completa.', 'Location / phone permissions are missing for full signal data.') + '<button class="primary" data-act="perms">' + tr('Conceder permisos', 'Grant permissions') + '</button></div>' +
      '<h2>' + tr('Consejos para mejorar ahora', 'Tips to improve now') + '</h2><div id="tips"></div>' +
      '<h2>' + tr('A cuál conectarte', 'Which one to connect to') + '</h2><div id="reco" class="card"></div>' +
      '<h2>' + tr('Acción rápida de red', 'Quick network actions') + '</h2><div class="btns">' +
      '<button data-act="set" data-k="mobile">' + tr('Datos móviles / roaming', 'Mobile data / roaming') + '</button><button data-act="set" data-k="operator">' + tr('Elegir operador', 'Choose carrier') + '</button>' +
      '<button data-act="set" data-k="panel">' + tr('Panel de internet', 'Internet panel') + '</button><button data-act="set" data-k="airplane">' + tr('Modo avión', 'Airplane mode') + '</button></div>';
  },
  update: function () {
    var s = S.sig, chip = $('#chip');
    if (!s) { chip.textContent = A ? tr('Sin datos', 'No data') : tr('Abre la app instalada', 'Open the installed app'); chip.style.background = '#374151'; return; }
    var q = AL.quality(s, S.why), c = AL.qi(q), rs = s.rsrp != null ? s.rsrp : s.dbm;
    chip.textContent = S.cur ? tr('CAÍDA', 'OUTAGE') : AL.qn(q); chip.style.background = S.cur ? '#dc2626' : c.c;
    $('#qdot').style.background = c.c; $('#qdot').style.boxShadow = '0 0 18px 2px ' + AL.hexA(c.c, .55); $('#qname').textContent = AL.qn(q);
    var lim = []; if (s.rsrp != null) lim.push('RSRP ' + AL.qn(AL.rk(s.rsrp, CFG.thresholds.rsrp))); if (s.sinr != null) lim.push('SINR ' + AL.qn(AL.rk(s.sinr, CFG.thresholds.sinr)));
    $('#qsub').textContent = S.why || lim.join(' · ') || (s.dbm != null ? s.dbm + ' dBm' : '—');
    $('#v-rsrp').textContent = fmt(rs); var bf = $('#barfill'); bf.style.width = (rs == null ? 0 : Math.max(0, Math.min(100, (rs + 140) / 96 * 100))) + '%'; bf.style.background = c.c;
    $('#v-sinr').textContent = fmt(s.sinr); $('#v-rsrq').textContent = fmt(s.rsrq); $('#v-net').textContent = s.net; $('#v-op').textContent = s.operator || '--';
    $('#v-reg').textContent = T(REG[s.state] || REG.UNKNOWN);
    $('#v-inet').textContent = s.wifi ? 'Wi‑Fi' : (s.internet ? (s.validated ? tr('Datos móviles', 'Mobile data') : tr('Datos (sin validar)', 'Data (unvalidated)')) : tr('Sin conexión', 'Offline'));
    $('#v-gps').textContent = S.loc ? '±' + S.loc.acc + ' m' : (s.locPerm ? tr('Sin fix', 'No fix') : tr('Sin permiso', 'No permission'));
    var f = S.freq, ce = S.cell;
    $('#v-band').textContent = f ? f.label + (f.f ? ' · ' + f.f + ' MHz' : '') : '--';
    $('#bandSub').textContent = f ? ((f.ch != null ? 'ARFCN ' + f.ch + ' · ' : '') + (ce && ce.bw ? ce.bw / 1000 + ' MHz · ' : '') + AL.clsName(f.cls)) : tr('Concede ubicación para ver la banda', 'Grant location to see the band');
    $('#v-cell').textContent = ce ? (ce.ci != null ? ce.ci : (ce.nci != null ? ce.nci : (ce.cid != null ? ce.cid : '--'))) + (ce.pci != null ? ' · PCI ' + ce.pci : '') : '--';
    var t = S.tow; $('#v-tower').textContent = t ? (t.src === 'ta' || t.src === 'model' ? '≈ ' : '') + AL.fmtDist(t.dist) + (t.bearing != null ? ' · ' + AL.card8(t.bearing) + ' ' + Math.round(t.bearing) + '°' : '') : '--';
    $('#towerSub').textContent = t ? srcName(t) : tr('Pon la clave OpenCelliD en Más → Ajustes o camina para estimarla', 'Add the OpenCelliD key in More → Settings or walk to estimate it');
    $('#permbox').classList.toggle('hidden', !!(s.locPerm && s.phonePerm));
    var bn = $('#banner');
    if (S.cur) { bn.classList.remove('hidden'); bn.textContent = tr('Caída activa desde ', 'Outage since ') + AL.fmtDate(S.cur.start) + ' (' + AL.fmtDur(Date.now() - S.cur.start) + ') — ' + S.cur.reason; } else bn.classList.add('hidden');
    $('#tips').innerHTML = AL.advise({ s: s, why: S.why, cell: ce, cells: S.cells, loc: S.loc, tow: S.tow, reco: S.reco }).slice(0, 4).map(function (x) { return '<div class="tip ' + x[1] + '">' + esc(x[0]) + '</div>'; }).join('');
    var r = S.reco, h = '';
    if (r && r.list.length) {
      h += '<div class="cl">' + r.list.slice(0, 6).map(function (x) {
        return '<div class="cr' + (x.cur ? ' cur' : '') + '"><b>' + x.f.label + '</b><span>' + (x.f.f ? x.f.f + ' MHz' : '') + '</span><span>' + x.c.rsrp + ' dBm' + (x.c.sinr != null ? ' · ' + x.c.sinr + ' dB' : '') + '</span><em>' + (x.cur ? tr('actual', 'current') : (r.pick === x ? '★' : '')) + '</em></div>';
      }).join('') + '</div>';
      h += '<p class="muted small">' + (r.msg || tr('Bandas bajas (700–900 MHz): más alcance. Altas (2600+): más velocidad.', 'Low bands (700–900 MHz): more range. High (2600+): more speed.')) + '</p>';
    } else h += '<p class="muted small">' + tr('Sin celdas vecinas visibles (necesita permiso de ubicación y ubicación activada).', 'No neighbour cells visible (needs location permission and location turned on).') + '</p>';
    h += '<details><summary>' + tr('Cómo hacerlo', 'How to do it') + '</summary><ol>' + AL.HOWBAND.map(function (x) { return '<li>' + T(x) + '</li>'; }).join('') + '</ol><button data-act="dialer">' + tr('Abrir menú de ingeniería (*#*#4636#*#*)', 'Open engineering menu (*#*#4636#*#*)') + '</button></details>';
    $('#reco').innerHTML = h;
    var sp = $('#spark'); if (sp) drawSpark(sp);
  }
};
function drawSpark(cv) {
  var w = cv.clientWidth, h = 46, dpr = window.devicePixelRatio || 1; cv.width = w * dpr; cv.height = h * dpr;
  var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  var v = S.hist; if (v.length < 2) return;
  g.lineWidth = 2; g.lineJoin = 'round';
  for (var i = 1; i < v.length; i++) {
    if (v[i] == null || v[i - 1] == null) continue;
    var q = AL.rk(v[i], CFG.thresholds.rsrp), x0 = (i - 1) / 89 * w, x1 = i / 89 * w, y0 = h - 4 - (Math.max(-140, Math.min(-44, v[i - 1])) + 140) / 96 * (h - 8), y1 = h - 4 - (Math.max(-140, Math.min(-44, v[i])) + 140) / 96 * (h - 8);
    g.strokeStyle = AL.Q[q + 1].c; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
}

// ---------- vista MAPA ----------
var map = null, lay = {}, tiles = {}, curTile = null;
function LF() { return window.L; }
function tileLayer(k) {
  var Lf = LF();
  if (!tiles[k]) tiles[k] = k === 'topo' ? Lf.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, subdomains: 'abc', attribution: '© OpenTopoMap (CC-BY-SA) · © OpenStreetMap' })
    : k === 'sat' ? Lf.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' })
    : Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
  return tiles[k];
}
function listHtml() {
  var list = (S.cur ? [Object.assign({}, S.cur, { end: null })] : []).concat(D.outages.slice(0, 25));
  if (!list.length) return '<p class="muted small">' + tr('Sin caídas registradas.', 'No outages recorded.') + '</p>';
  return list.map(function (o) { return '<div class="ol"><b>' + AL.fmtDate(o.start) + '</b> · ' + (o.end ? AL.fmtDur(o.dur) : tr('en curso', 'ongoing')) + '<br><span class="muted">' + esc(o.reason) + (o.net ? ' · ' + esc(o.net) : '') + (o.lat != null ? tr(' · con ubicación', ' · located') : '') + '</span></div>'; }).join('');
}
AL.views.map = {
  build: function () {
    $('#v-mapa').innerHTML =
      '<div class="row"><select id="mapLayer"><option value="osm">' + tr('Calles (OSM)', 'Streets (OSM)') + '</option><option value="sat">' + tr('Satélite', 'Satellite') + '</option><option value="topo">' + tr('Relieve', 'Terrain') + '</option></select>' +
      '<select id="mapFilter"><option value="all">' + tr('Todos los puntos', 'All points') + '</option><option value="bad">' + tr('Señal mala o peor', 'Poor or worse') + '</option><option value="out">' + tr('Solo caídas', 'Outages only') + '</option></select></div>' +
      '<div id="lmap"></div><canvas id="offcv" class="hidden"></canvas>' +
      '<div id="mapMsg" class="muted small"></div>' +
      '<div class="btns"><button data-act="center">' + tr('Centrar en mí', 'Center on me') + '</button><button data-act="fit">' + tr('Ver todo', 'Fit all') + '</button>' +
      '<button data-act="lookup">' + tr('Buscar torre (base de datos)', 'Find tower (database)') + '</button><button data-act="estimate">' + tr('Estimar con mis mediciones', 'Estimate from my readings') + '</button>' +
      '<button data-act="aim">' + tr('Apuntar brújula a la torre', 'Aim compass at tower') + '</button><button data-act="offline">' + tr('Vista offline / mapa', 'Offline view / map') + '</button></div>' +
      '<div id="hit" class="muted small"></div><div class="legend" id="legend"></div>' +
      '<h2>' + tr('Historial de caídas', 'Outage history') + '</h2><div id="outlist"></div>' +
      '<h2>' + tr('Exportar datos', 'Export data') + '</h2><div class="btns"><button data-act="xp">' + tr('CSV de puntos', 'Points CSV') + '</button><button data-act="xc">' + tr('CSV de caídas', 'Outages CSV') + '</button><button data-act="xj">JSON</button><button data-act="xs">' + tr('Compartir JSON', 'Share JSON') + '</button></div>' +
      '<p class="muted small">' + tr('Se guardan en Descargas. Los mapas necesitan internet; sin él usa la vista offline.', 'Saved in Downloads. Maps need internet; without it use the offline view.') + '</p>' +
      '<button class="danger" data-act="clear">' + tr('Borrar historial', 'Clear history') + '</button>';
    $('#legend').innerHTML = AL.Q.slice().reverse().map(function (x) { return '<span><i style="background:' + x.c + '"></i>' + T(x.n) + '</span>'; }).join('');
    map = null; lay = {}; tiles = {}; S.centered = false; S.heatN = -1;
    $('#mapFilter').value = S.mapFilter;
  },
  show: function () {
    var Lf = LF();
    if (!Lf) { $('#lmap').classList.add('hidden'); S.offline = true; $('#offcv').classList.remove('hidden'); $('#mapMsg').textContent = tr('No se cargó el motor de mapas; mostrando vista offline.', 'Map engine did not load; showing offline view.'); }
    else if (!map) {
      var c = S.lastLoc || { lat: 20, lon: 0 };
      map = Lf.map('lmap', { zoomControl: true }).setView([c.lat, c.lon], S.lastLoc ? 15 : 2);
      curTile = tileLayer($('#mapLayer').value).addTo(map); lay.heat = Lf.layerGroup().addTo(map); lay.out = Lf.layerGroup().addTo(map);
      S.centered = !!S.lastLoc;
    }
    setTimeout(function () { if (map) map.invalidateSize(); AL.views.map.update(true); }, 80);
    $('#outlist').innerHTML = listHtml();
  },
  update: function (force) {
    if (S.tab !== 'mapa') return;
    $('#outlist').innerHTML = listHtml();
    if (S.offline || !map) { drawOffline(); return; }
    var Lf = LF(), loc = S.lastLoc;
    if (loc) {
      if (!lay.me) { lay.acc = Lf.circle([loc.lat, loc.lon], { radius: loc.acc || 20, color: '#3b82f6', weight: 1, fillOpacity: .1 }).addTo(map); lay.me = Lf.circleMarker([loc.lat, loc.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1 }).addTo(map); }
      else { lay.me.setLatLng([loc.lat, loc.lon]); lay.acc.setLatLng([loc.lat, loc.lon]); lay.acc.setRadius(loc.acc || 20); }
      if (!S.centered) { map.setView([loc.lat, loc.lon], 15); S.centered = true; }
    }
    var t = S.tow;
    ['tw', 'line', 'ring'].forEach(function (k) { if (lay[k]) { map.removeLayer(lay[k]); lay[k] = null; } });
    if (t && t.lat != null) {
      lay.tw = Lf.marker([t.lat, t.lon], { icon: Lf.divIcon({ className: '', html: '<div class="twm">📡</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(map).bindTooltip(AL.fmtDist(t.dist) + ' · ' + srcName(t), { permanent: true, direction: 'top', offset: [0, -14] });
      if (loc) lay.line = Lf.polyline([[loc.lat, loc.lon], [t.lat, t.lon]], { color: '#f59e0b', weight: 3, dashArray: '6 6' }).addTo(map);
    } else if (t && t.src === 'ta' && loc) {
      lay.ring = Lf.circle([loc.lat, loc.lon], { radius: t.dist, color: '#f59e0b', weight: 2, dashArray: '6 6', fillOpacity: 0 }).addTo(map);
    }
    var filt = S.mapFilter, n = D.points.length + '|' + D.outages.length + '|' + filt;
    if (force || n !== S.heatN) {
      S.heatN = n; lay.heat.clearLayers(); lay.out.clearLayers();
      D.points.filter(function (p) { return filt === 'all' || (filt === 'out' && p.out) || (filt === 'bad' && p.q <= 1); }).forEach(function (p) {
        var col = AL.qi(p.q).c;
        Lf.circleMarker([p.lat, p.lon], { radius: 7, stroke: false, fillColor: col, fillOpacity: .55 }).addTo(lay.heat).bindTooltip(AL.fmtDate(p.t) + ' · ' + AL.qn(p.q) + (p.rsrp != null ? ' · ' + p.rsrp + ' dBm' : '') + (p.band ? ' · ' + p.band : ''));
      });
      D.outages.filter(function (o) { return o.lat != null; }).forEach(function (o) {
        Lf.marker([o.lat, o.lon], { icon: Lf.divIcon({ className: '', html: '<div class="xm">✖</div>', iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(lay.out).bindTooltip(AL.fmtDate(o.start) + ' · ' + AL.fmtDur(o.dur || 0) + ' · ' + o.reason);
      });
    }
    $('#mapMsg').textContent = (t ? (tr('Torre: ', 'Tower: ') + AL.fmtDist(t.dist) + (t.bearing != null ? ' · ' + AL.card8(t.bearing) + ' ' + Math.round(t.bearing) + '°' : '') + ' · ' + srcName(t)) : tr('Torre aún sin ubicar: usa “Buscar torre” (clave OpenCelliD) o “Estimar”.', 'Tower not located yet: use “Find tower” (OpenCelliD key) or “Estimate”.')) + ' · ' + D.points.length + tr(' puntos', ' points');
  },
  center: function () { if (map && S.lastLoc) map.setView([S.lastLoc.lat, S.lastLoc.lon], 16); else AL.toast(tr('Sin posición GPS', 'No GPS fix')); },
  fit: function () {
    if (!map) return; var pts = D.points.map(function (p) { return [p.lat, p.lon]; });
    if (S.tow && S.tow.lat != null) pts.push([S.tow.lat, S.tow.lon]); if (S.lastLoc) pts.push([S.lastLoc.lat, S.lastLoc.lon]);
    if (pts.length > 1) map.fitBounds(pts, { padding: [30, 30] }); else AL.toast(tr('Aún hay pocos puntos', 'Too few points yet'));
  },
  setLayer: function (k) { if (!map) return; if (curTile) map.removeLayer(curTile); curTile = tileLayer(k).addTo(map); }
};
var hits = [];
function drawOffline() {
  var cv = $('#offcv'); if (!cv || cv.classList.contains('hidden')) return;
  var dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = 320; cv.style.height = h + 'px'; cv.width = w * dpr; cv.height = h * dpr;
  var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); hits = [];
  var f = S.mapFilter, pts = D.points.filter(function (p) { return f === 'all' || (f === 'out' && p.out) || (f === 'bad' && p.q <= 1); }), evs = D.outages.filter(function (o) { return o.lat != null; });
  var all = pts.map(function (p) { return [p.lat, p.lon]; }).concat(evs.map(function (o) { return [o.lat, o.lon]; }));
  if (S.lastLoc) all.push([S.lastLoc.lat, S.lastLoc.lon]); if (S.tow && S.tow.lat != null) all.push([S.tow.lat, S.tow.lon]);
  if (!all.length) { g.fillStyle = '#64748b'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText(tr('Sin puntos todavía', 'No points yet'), w / 2, h / 2); return; }
  var a = 90, b = -90, c = 180, d = -180; all.forEach(function (x) { a = Math.min(a, x[0]); b = Math.max(b, x[0]); c = Math.min(c, x[1]); d = Math.max(d, x[1]); });
  var cy = (a + b) / 2, cx = (c + d) / 2, kx = Math.cos(cy * Math.PI / 180), pad = 30, spX = Math.max((d - c) * kx, 0.0006), spY = Math.max(b - a, 0.0006), sc = Math.min((w - 2 * pad) / spX, (h - 2 * pad) / spY);
  function pr(la, lo) { return [w / 2 + (lo - cx) * kx * sc, h / 2 - (la - cy) * sc]; }
  pts.forEach(function (p) { var xy = pr(p.lat, p.lon), col = AL.qi(p.q).c, rg = g.createRadialGradient(xy[0], xy[1], 0, xy[0], xy[1], 20); rg.addColorStop(0, AL.hexA(col, .5)); rg.addColorStop(1, AL.hexA(col, 0)); g.fillStyle = rg; g.beginPath(); g.arc(xy[0], xy[1], 20, 0, 6.3); g.fill(); });
  pts.forEach(function (p) { var xy = pr(p.lat, p.lon); g.fillStyle = AL.qi(p.q).c; g.beginPath(); g.arc(xy[0], xy[1], 3.2, 0, 6.3); g.fill(); hits.push({ x: xy[0], y: xy[1], t: AL.fmtDate(p.t) + ' · ' + AL.qn(p.q) + (p.rsrp != null ? ' · ' + p.rsrp + ' dBm' : '') }); });
  evs.forEach(function (o) { var xy = pr(o.lat, o.lon); g.strokeStyle = '#ef4444'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(xy[0] - 6, xy[1] - 6); g.lineTo(xy[0] + 6, xy[1] + 6); g.moveTo(xy[0] + 6, xy[1] - 6); g.lineTo(xy[0] - 6, xy[1] + 6); g.stroke(); });
  if (S.tow && S.tow.lat != null) { var tw = pr(S.tow.lat, S.tow.lon); g.font = '20px sans-serif'; g.textAlign = 'center'; g.fillText('📡', tw[0], tw[1] + 7); }
  if (S.lastLoc) { var m = pr(S.lastLoc.lat, S.lastLoc.lon); g.strokeStyle = '#60a5fa'; g.lineWidth = 2; g.beginPath(); g.arc(m[0], m[1], 8, 0, 6.3); g.stroke(); }
}

// ---------- exportación ----------
function csvEsc(v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function toCsv(head, rows) { return head.join(',') + '\n' + rows.map(function (r) { return r.map(csvEsc).join(','); }).join('\n') + '\n'; }
function save(name, mime, text) { if (!A) { AL.toast(tr('Solo disponible en la app', 'Only available in the app')); return; } var r = A.saveFile(name, mime, text); AL.toast(r.indexOf('ERR') === 0 ? r : tr('Guardado en ', 'Saved in ') + r); }
function jsonAll() { return JSON.stringify({ app: 'Antena Libre', version: CFG.version, exportado: new Date().toISOString(), caidas: D.outages, puntos: D.points }, null, 1); }
AL.exp = {
  p: function () { save('antena-libre-puntos-' + AL.stamp() + '.csv', 'text/csv', toCsv(['fecha', 'timestamp', 'lat', 'lon', 'precision_m', 'calidad', 'rsrp_dbm', 'sinr_db', 'dbm', 'red', 'banda', 'mhz', 'pci', 'operador', 'caida'], D.points.map(function (p) { return [new Date(p.t).toISOString(), p.t, p.lat, p.lon, p.acc, AL.qi(p.q).n[0], p.rsrp, p.sinr, p.dbm, p.net, p.band, p.mhz, p.pci, p.op, p.out ? 1 : 0]; }))); },
  c: function () { save('antena-libre-caidas-' + AL.stamp() + '.csv', 'text/csv', toCsv(['inicio', 'fin', 'duracion_s', 'motivo', 'lat', 'lon', 'red', 'operador'], D.outages.map(function (o) { return [new Date(o.start).toISOString(), o.end ? new Date(o.end).toISOString() : '', Math.round((o.dur || 0) / 1000), o.reason, o.lat, o.lon, o.net, o.op]; }))); },
  j: function () { save('antena-libre-' + AL.stamp() + '.json', 'application/json', jsonAll()); },
  s: function () { if (A) A.shareText('Antena Libre', jsonAll()); else AL.toast(tr('Solo disponible en la app', 'Only available in the app')); }
};
var armed = null;
AL.clearHistory = function (btn) {
  if (!armed) { btn.textContent = tr('Toca otra vez para confirmar', 'Tap again to confirm'); armed = setTimeout(function () { armed = null; btn.textContent = tr('Borrar historial', 'Clear history'); }, 4000); return; }
  clearTimeout(armed); armed = null; btn.textContent = tr('Borrar historial', 'Clear history');
  D.outages = []; D.points = []; S.lastPt = null; persist(); S.heatN = -1; AL.views.map.update(true); AL.toast(tr('Historial borrado', 'History cleared'));
};

// ---------- vista BRÚJULA ----------
var CARD = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
AL.views.comp = {
  build: function () {
    $('#v-brujula').innerHTML =
      '<div class="compass"><svg viewBox="0 -14 300 314"><polygon points="150,-12 141,6 159,6" fill="#ef4444"/><g id="dial"><circle cx="150" cy="150" r="140" fill="#0f172a" stroke="#334155" stroke-width="2"/><g id="ticks"></g><g id="tgt" class="hidden"><polygon points="150,2 141,20 159,20" fill="#f59e0b"/></g></g><circle cx="150" cy="150" r="4" fill="#94a3b8"/></svg>' +
      '<div class="readout"><span id="hdg">--</span><small id="card">--</small></div></div><div id="delta" class="delta"></div>' +
      '<div class="row"><label class="chk"><input type="radio" name="north" value="mag" checked> ' + tr('Norte magnético', 'Magnetic north') + '</label><label class="chk"><input type="radio" name="north" value="true"> ' + tr('Norte verdadero', 'True north') + '</label></div><div id="decl" class="muted small"></div>' +
      '<div class="card rows"><div><span>' + tr('Señal ahora (RSRP)', 'Signal now (RSRP)') + '</span><b id="cRsrp">--</b></div><div><span>' + tr('Mejor señal del barrido', 'Best of the sweep') + '</span><b id="best">--</b></div><div><span>' + tr('Rumbo a la torre', 'Bearing to tower') + '</span><b id="cTow">--</b></div></div>' +
      '<h2>' + tr('Rumbo objetivo', 'Target bearing') + '</h2><div class="row"><input id="tin" type="number" inputmode="numeric" min="0" max="359" placeholder="0–359°"><button data-act="tset">' + tr('Fijar', 'Set') + '</button><button data-act="tnow">' + tr('Usar rumbo actual', 'Use current') + '</button></div>' +
      '<div class="btns"><button data-act="aim">' + tr('Apuntar a la torre', 'Aim at tower') + '</button><button data-act="tbest">' + tr('Ir al rumbo de mejor señal', 'Go to best-signal bearing') + '</button><button data-act="tclr">' + tr('Limpiar objetivo y barrido', 'Clear target and sweep') + '</button></div>' +
      '<p class="muted small">' + tr('Mantén el teléfono plano y lejos de metales e imanes. Gira despacio 360°: la app recuerda el mejor RSRP por cada 10° y te dice hacia dónde apuntar.', 'Hold the phone flat, away from metal and magnets. Turn slowly 360°: the app remembers the best RSRP per 10° and tells you where to aim.') + '</p>';
    var s = '', a, Ls = { 0: 'N', 90: 'E', 180: 'S', 270: tr('O', 'W') };
    for (a = 0; a < 360; a += 10) { var mj = a % 30 === 0; s += '<line x1="150" y1="10" x2="150" y2="' + (mj ? 32 : 22) + '" transform="rotate(' + a + ' 150 150)" stroke="#64748b" stroke-width="' + (mj ? 2 : 1) + '"/>'; }
    for (a = 0; a < 360; a += 30) s += Ls[a] ? '<text x="150" y="62" text-anchor="middle" font-size="26" font-weight="800" fill="' + (a === 0 ? '#ef4444' : '#e5e7eb') + '" transform="rotate(' + a + ' 150 150)">' + Ls[a] + '</text>' : '<text x="150" y="54" text-anchor="middle" font-size="11" fill="#94a3b8" transform="rotate(' + a + ' 150 150)">' + a + '</text>';
    $('#ticks').innerHTML = s;
  },
  tick: function () {
    if (!A || S.tab !== 'brujula') return;
    var o; try { o = JSON.parse(A.getHeading()); } catch (e) { return; }
    if (o.mag == null || o.mag < 0) { $('#hdg').textContent = '--'; $('#card').textContent = tr('Sin sensor', 'No sensor'); return; }
    var h = (S.useTrue && o.hasDecl) ? o.trueN : o.mag;
    $('#dial').setAttribute('transform', 'rotate(' + (-h) + ' 150 150)'); $('#hdg').textContent = Math.round(h) + '°'; $('#card').textContent = AL.card8(h);
    $('#decl').textContent = o.hasDecl ? tr('Declinación local: ', 'Local declination: ') + (o.decl >= 0 ? '+' : '') + o.decl + '°' : (S.useTrue ? tr('Norte verdadero requiere ubicación; mostrando magnético.', 'True north needs location; showing magnetic.') : '');
    var s = S.sig, rs = s ? (s.rsrp != null ? s.rsrp : s.dbm) : null; $('#cRsrp').textContent = rs == null ? '--' : rs + ' dBm';
    if (rs != null) { var b = Math.floor(h / 10) % 36; if (bins[b] == null || rs > bins[b]) bins[b] = rs; }
    var bi2 = bestBin(); $('#best').textContent = bi2 < 0 ? '--' : bins[bi2] + ' dBm → ' + (bi2 * 10 + 5) + '° ' + AL.card8(bi2 * 10 + 5);
    $('#cTow').textContent = S.tow && S.tow.bearing != null ? Math.round(S.tow.bearing) + '° ' + AL.card8(S.tow.bearing) : '--';
    var el = $('#delta');
    if (S.target != null) {
      $('#tgt').classList.remove('hidden'); $('#tgt').setAttribute('transform', 'rotate(' + S.target + ' 150 150)');
      var d = ((S.target - h + 540) % 360) - 180, ad = Math.abs(Math.round(d));
      if (ad <= 3) { el.textContent = '✓ ' + tr('Alineado (', 'Aligned (') + S.target + '°)'; el.style.color = '#22c55e'; } else { el.textContent = (d > 0 ? tr('Gira a la derecha ', 'Turn right ') : tr('Gira a la izquierda ', 'Turn left ')) + ad + '° → ' + S.target + '°'; el.style.color = '#f59e0b'; }
    } else { $('#tgt').classList.add('hidden'); el.style.color = ''; el.textContent = tr('Sin objetivo: fija uno o apunta a la torre.', 'No target: set one or aim at the tower.'); }
  }
};
function bestBin() { var b = -1; for (var i = 0; i < 36; i++) if (bins[i] != null && (b < 0 || bins[i] > bins[b])) b = i; return b; }
function curHeading() { try { var o = JSON.parse(A.getHeading()); return o.mag < 0 ? null : Math.round((S.useTrue && o.hasDecl) ? o.trueN : o.mag) % 360; } catch (e) { return null; } }
AL.comp = {
  set: function () { var v = parseInt($('#tin').value, 10); if (isNaN(v)) { AL.toast(tr('Escribe un rumbo 0–359', 'Enter a bearing 0–359')); return; } S.target = ((v % 360) + 360) % 360; },
  now: function () { var h = curHeading(); if (h == null) AL.toast(tr('Sin lectura de brújula', 'No compass reading')); else { S.target = h; $('#tin').value = h; } },
  best: function () { var b = bestBin(); if (b < 0) AL.toast(tr('Aún no hay barrido: gira 360° despacio', 'No sweep yet: turn 360° slowly')); else { S.target = b * 10 + 5; $('#tin').value = S.target; } },
  clr: function () { S.target = null; for (var i = 0; i < 36; i++) bins[i] = null; $('#tin').value = ''; $('#best').textContent = '--'; },
  aim: function () { if (S.tow && S.tow.bearing != null) { S.target = Math.round(S.tow.bearing) % 360; if ($('#tin')) $('#tin').value = S.target; AL.toast(tr('Objetivo: torre a ', 'Target: tower at ') + S.target + '°'); AL.showTab('brujula'); } else AL.toast(tr('Aún no se conoce la ubicación de la torre', 'Tower location not known yet')); }
};

// ---------- pestañas y render ----------
AL.showTab = function (name) {
  S.tab = name;
  $$('.tab').forEach(function (t) { t.classList.toggle('active', t.id === 'v-' + name); });
  $$('nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
  if (name === 'mapa') AL.views.map.show();
  if (name === 'antenas' && AL.views.ant) AL.views.ant.render();
  if (name === 'mas' && AL.views.more) AL.views.more.render();
  $('main').scrollTop = 0;
};
function render() {
  if (S.tab === 'senal') AL.views.senal.update();
  else if (S.tab === 'mapa') AL.views.map.update(false);
  else if (S.tab === 'antenas' && AL.views.ant && AL.views.ant.live) AL.views.ant.live();
  if (!S.sig) AL.views.senal.update();
}
AL.core = { tick: tick, render: render, startHold: startHold, cancelHold: cancelHold, closeStale: closeStale, save: save, native: native, bestBin: bestBin, jsonAll: jsonAll };
AL.sx = function () { return { x: sx, y: sy }; };
})(window.AL);
