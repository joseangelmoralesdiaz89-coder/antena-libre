(function () {
'use strict';

var A = window.Android || null;
function $(s) { return document.querySelector(s); }
function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

// ---------- configuración ----------
var CFG = {
  version: '0.2.0', pollMs: 2000, pointEveryMs: 20000, minMoveM: 25, outageConfirm: 2,
  maxPoints: 5000, maxOutages: 500,
  thresholds: { rsrp: [-80, -90, -100, -110], sinr: [20, 13, 0, -5], dbm: [-70, -85, -100, -110] }
};
var Q = [
  { n: 'Sin señal', c: '#6b7280' }, { n: 'Muy mala', c: '#dc2626' }, { n: 'Mala', c: '#f97316' },
  { n: 'Regular', c: '#eab308' }, { n: 'Buena', c: '#84cc16' }, { n: 'Excelente', c: '#16a34a' }
];
function qi(q) { return Q[q + 1]; }

var REG = {
  IN_SERVICE: 'Registrado (en servicio)', OUT_OF_SERVICE: 'Sin servicio',
  EMERGENCY_ONLY: 'Solo emergencias', POWER_OFF: 'Radio apagada', UNKNOWN: 'Desconocido (falta permiso)'
};

// ---------- almacenamiento ----------
var LS = {
  get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};
var outages = LS.get('al_outages', []);
var points = LS.get('al_points', []);
var cur = null, bad = 0, good = 0, lastPt = null, lastLoc = null, last = { sig: null, loc: null };
var activeTab = 'senal';

// ---------- utilidades ----------
function p2(n) { return (n < 10 ? '0' : '') + n; }
function fmtDate(t) { var d = new Date(t); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
function stamp() { var d = new Date(); return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()); }
function fmtDur(ms) {
  var s = Math.round(ms / 1000);
  if (s < 60) return s + ' s';
  var m = Math.floor(s / 60); s = s % 60;
  if (m < 60) return m + ' min ' + s + ' s';
  return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
}
function dist(a, b) {
  var k = 111320, dx = (a.lon - b.lon) * Math.cos(a.lat * Math.PI / 180) * k, dy = (a.lat - b.lat) * k;
  return Math.sqrt(dx * dx + dy * dy);
}
function hexA(h, a) {
  var n = parseInt(h.slice(1), 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function toast(msg) {
  var t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, 3200);
}
function persist() { LS.set('al_outages', outages); LS.set('al_points', points); }
function fmt(v, d) { return v == null ? '--' : (d ? v.toFixed(d) : String(v)); }

// ---------- calidad ----------
function rk(v, t) { return v >= t[0] ? 4 : v >= t[1] ? 3 : v >= t[2] ? 2 : v >= t[3] ? 1 : 0; }
function quality(s, why) {
  if (!s || why) return -1;
  var r = [], T = CFG.thresholds;
  if (s.rsrp != null) r.push(rk(s.rsrp, T.rsrp));
  if (s.sinr != null) r.push(rk(s.sinr, T.sinr));
  if (!r.length && s.dbm != null) r.push(rk(s.dbm, T.dbm));
  if (!r.length && s.level >= 0) r.push(Math.min(4, s.level));
  if (!r.length) return -1;
  return Math.min.apply(null, r);
}
function outageReason(s) {
  if (!s) return null;
  if (s.airplane) return 'Modo avión';
  if (s.state === 'OUT_OF_SERVICE') return 'Sin servicio (red no registrada)';
  if (s.state === 'POWER_OFF') return 'Radio apagada';
  if (s.state === 'EMERGENCY_ONLY') return 'Solo emergencias';
  if (!s.wifi && !s.internet) return 'Sin conexión de datos';
  return null;
}

// ---------- lectura nativa ----------
function readSignal() { try { return JSON.parse(A.getSignal()); } catch (e) { return null; } }
function readLoc() { try { var l = JSON.parse(A.getLocation()); return (l && l.lat != null) ? l : null; } catch (e) { return null; } }

// ---------- caídas y puntos ----------
function startOutage(why, s, t) {
  var l = last.loc || lastLoc;
  cur = { id: t, start: t, reason: why, lat: l ? l.lat : null, lon: l ? l.lon : null, net: s.net, op: s.operator };
  LS.set('al_open', cur);
}
function endOutage() {
  cur.end = Date.now(); cur.dur = cur.end - cur.start;
  outages.unshift(cur);
  if (outages.length > CFG.maxOutages) outages.length = CFG.maxOutages;
  cur = null; LS.del('al_open'); persist();
}
function closeStale() {
  var o = LS.get('al_open', null);
  if (!o) return;
  var hb = LS.get('al_hb', o.start);
  o.end = Math.max(hb, o.start); o.dur = o.end - o.start; o.reason += ' (la app se cerró)';
  outages.unshift(o); LS.del('al_open'); persist();
}
function maybeSavePoint(s, l, why) {
  if (!l || l.age > 180) return;
  var now = Date.now();
  var moved = !lastPt || dist(lastPt, l) >= CFG.minMoveM;
  var due = !lastPt || now - lastPt.t >= CFG.pointEveryMs;
  if (!moved && !due) return;
  var pt = { t: now, lat: l.lat, lon: l.lon, acc: l.acc, q: quality(s, why), rsrp: s.rsrp, sinr: s.sinr, dbm: s.dbm, net: s.net, op: s.operator, out: !!why };
  points.push(pt);
  if (points.length > CFG.maxPoints) points.splice(0, points.length - CFG.maxPoints);
  lastPt = pt; persist();
}

// ---------- ciclo principal ----------
function tick() {
  if (!A) { render(null, null, null); return; }
  var s = readSignal(), l = readLoc();
  last.sig = s; last.loc = l;
  if (l) lastLoc = l;
  if (!s) { render(null, null, null); return; }
  LS.set('al_hb', Date.now());
  var why = outageReason(s);
  if (why) {
    bad++; good = 0;
    if (!cur && bad >= CFG.outageConfirm) startOutage(why, s, Date.now() - (bad - 1) * CFG.pollMs);
  } else {
    good++; bad = 0;
    if (cur && good >= CFG.outageConfirm) endOutage();
  }
  maybeSavePoint(s, l, why);
  render(s, l, why);
}

// ---------- pestaña Señal ----------
function render(s, l, why) {
  var chip = $('#chip');
  if (!s) {
    chip.textContent = A ? 'Sin datos' : 'Abre la app instalada'; chip.style.background = '#374151';
    $('#qname').textContent = '--';
    $('#qsub').textContent = A ? 'Leyendo señal…' : 'Esta vista necesita la app Android.';
    return;
  }
  var q = quality(s, why), c = qi(q);
  chip.textContent = cur ? 'CAÍDA' : c.n; chip.style.background = cur ? '#dc2626' : c.c;
  $('#qdot').style.background = c.c; $('#qdot').style.boxShadow = '0 0 18px 2px ' + hexA(c.c, .55);
  $('#qname').textContent = c.n;
  var lim = [];
  if (s.rsrp != null) lim.push('RSRP ' + qi(rk(s.rsrp, CFG.thresholds.rsrp)).n);
  if (s.sinr != null) lim.push('SINR ' + qi(rk(s.sinr, CFG.thresholds.sinr)).n);
  $('#qsub').textContent = why ? why : (lim.join(' · ') || (s.dbm != null ? s.dbm + ' dBm' : 'Nivel Android ' + s.level + '/4'));

  var rs = s.rsrp != null ? s.rsrp : s.dbm;
  $('#rsrp').textContent = fmt(rs);
  var pct = rs == null ? 0 : Math.max(0, Math.min(100, (rs + 140) / 96 * 100));
  var bf = $('#barfill'); bf.style.width = pct + '%'; bf.style.background = c.c;
  $('#sinr').textContent = fmt(s.sinr); $('#rsrq').textContent = fmt(s.rsrq);
  $('#net').textContent = s.net + (s.tech && s.tech !== '4G' && s.tech !== '5G' ? '' : '');
  $('#op').textContent = s.operator || '--';
  $('#reg').textContent = REG[s.state] || s.state;
  $('#inet').textContent = s.wifi ? 'Wi‑Fi' : (s.internet ? (s.validated ? 'Datos móviles' : 'Datos (sin validar)') : 'Sin conexión');
  $('#gps').textContent = l ? ('±' + l.acc + ' m' + (l.age > 180 ? ' (antigua)' : '')) : (s.locPerm ? 'Sin fix GPS' : 'Sin permiso');
  var since = Date.now() - 86400000;
  $('#n24').textContent = outages.filter(function (o) { return o.start >= since; }).length + (cur ? 1 : 0);
  $('#npts').textContent = points.length;
  $('#permbox').classList.toggle('hidden', !!(s.locPerm && s.phonePerm));

  var b = $('#banner');
  if (cur) {
    b.classList.remove('hidden');
    b.textContent = 'Caída activa desde ' + fmtDate(cur.start) + ' (' + fmtDur(Date.now() - cur.start) + ') — ' + cur.reason;
  } else b.classList.add('hidden');

  if (activeTab === 'brujula') $('#cRsrp').textContent = rs == null ? '--' : rs + ' dBm';
}

// ---------- pestaña Mapa ----------
var hits = [];
function drawMap() {
  var cv = $('#map'), dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  cv.width = w * dpr; cv.height = h * dpr;
  var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  var f = $('#filter').value;
  var pts = points.filter(function (p) { return f === 'all' || (f === 'out' && p.out) || (f === 'bad' && p.q <= 1); });
  var evs = outages.filter(function (o) { return o.lat != null; });
  hits = [];
  var all = pts.map(function (p) { return [p.lat, p.lon]; }).concat(evs.map(function (o) { return [o.lat, o.lon]; }));
  if (lastLoc) all.push([lastLoc.lat, lastLoc.lon]);
  $('#mapinfo').textContent = pts.length + ' puntos · ' + outages.length + ' caídas';
  if (!all.length) {
    g.fillStyle = '#64748b'; g.font = '14px sans-serif'; g.textAlign = 'center';
    g.fillText('Sin puntos todavía. Camina con la app abierta.', w / 2, h / 2); return;
  }
  var minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  all.forEach(function (a) { minLat = Math.min(minLat, a[0]); maxLat = Math.max(maxLat, a[0]); minLon = Math.min(minLon, a[1]); maxLon = Math.max(maxLon, a[1]); });
  var cy = (minLat + maxLat) / 2, cx = (minLon + maxLon) / 2, kx = Math.cos(cy * Math.PI / 180), pad = 28;
  var spanX = Math.max((maxLon - minLon) * kx, 0.0006), spanY = Math.max(maxLat - minLat, 0.0006);
  var sc = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);
  function pr(lat, lon) { return [w / 2 + (lon - cx) * kx * sc, h / 2 - (lat - cy) * sc]; }

  g.strokeStyle = '#14203a'; g.lineWidth = 1;
  for (var i = 1; i < 6; i++) { g.beginPath(); g.moveTo(w * i / 6, 0); g.lineTo(w * i / 6, h); g.moveTo(0, h * i / 6); g.lineTo(w, h * i / 6); g.stroke(); }

  pts.forEach(function (p) {
    var xy = pr(p.lat, p.lon), col = qi(p.q).c, rg = g.createRadialGradient(xy[0], xy[1], 0, xy[0], xy[1], 20);
    rg.addColorStop(0, hexA(col, .5)); rg.addColorStop(1, hexA(col, 0));
    g.fillStyle = rg; g.beginPath(); g.arc(xy[0], xy[1], 20, 0, 6.2832); g.fill();
  });
  pts.forEach(function (p) {
    var xy = pr(p.lat, p.lon);
    g.fillStyle = qi(p.q).c; g.beginPath(); g.arc(xy[0], xy[1], 3.2, 0, 6.2832); g.fill();
    hits.push({ x: xy[0], y: xy[1], txt: fmtDate(p.t) + ' · ' + qi(p.q).n + (p.rsrp != null ? ' · RSRP ' + p.rsrp : '') + (p.sinr != null ? ' · SINR ' + p.sinr : '') + ' · ' + p.net + (p.out ? ' · CAÍDA' : '') });
  });
  evs.forEach(function (o) {
    var xy = pr(o.lat, o.lon);
    g.strokeStyle = '#ef4444'; g.lineWidth = 2.5; g.beginPath();
    g.moveTo(xy[0] - 6, xy[1] - 6); g.lineTo(xy[0] + 6, xy[1] + 6); g.moveTo(xy[0] + 6, xy[1] - 6); g.lineTo(xy[0] - 6, xy[1] + 6); g.stroke();
    hits.push({ x: xy[0], y: xy[1], txt: 'CAÍDA ' + fmtDate(o.start) + ' · ' + fmtDur(o.dur || 0) + ' · ' + o.reason });
  });
  if (lastLoc) {
    var m = pr(lastLoc.lat, lastLoc.lon);
    g.strokeStyle = '#60a5fa'; g.lineWidth = 2; g.beginPath(); g.arc(m[0], m[1], 8, 0, 6.2832); g.stroke();
    g.fillStyle = '#60a5fa'; g.beginPath(); g.arc(m[0], m[1], 3, 0, 6.2832); g.fill();
  }
  var meters = Math.round((w / sc) * 111320 / 10) * 10;
  g.fillStyle = '#94a3b8'; g.font = '11px sans-serif'; g.textAlign = 'left';
  g.fillText('Ancho ≈ ' + (meters >= 1000 ? (meters / 1000).toFixed(1) + ' km' : meters + ' m'), 8, h - 8);
}
function drawList() {
  var box = $('#outlist'), html = '';
  var list = (cur ? [Object.assign({}, cur, { end: null })] : []).concat(outages.slice(0, 25));
  if (!list.length) html = '<p class="muted small">Sin caídas registradas.</p>';
  list.forEach(function (o) {
    html += '<div class="ol"><b>' + fmtDate(o.start) + '</b> · ' + (o.end ? fmtDur(o.dur) : 'en curso') + '<br><span class="muted">' + o.reason + (o.net ? ' · ' + o.net : '') + (o.lat != null ? ' · con ubicación' : '') + '</span></div>';
  });
  box.innerHTML = html;
}
function legend(el) {
  el.innerHTML = Q.slice().reverse().map(function (x) { return '<span><i style="background:' + x.c + '"></i>' + x.n + '</span>'; }).join('');
}

// ---------- exportación ----------
function csvEsc(v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function toCsv(head, rows) { return head.join(',') + '\n' + rows.map(function (r) { return r.map(csvEsc).join(','); }).join('\n') + '\n'; }
function save(name, mime, text) {
  if (!A) { toast('Solo disponible en la app'); return; }
  var r = A.saveFile(name, mime, text);
  toast(r.indexOf('ERR') === 0 ? 'Error: ' + r : 'Guardado en ' + r);
}
function jsonAll() {
  return JSON.stringify({ app: 'Antena Libre', version: CFG.version, exportado: new Date().toISOString(), caidas: outages, puntos: points }, null, 1);
}
function exportPts() {
  save('antena-libre-puntos-' + stamp() + '.csv', 'text/csv', toCsv(
    ['fecha', 'timestamp', 'lat', 'lon', 'precision_m', 'calidad', 'rsrp_dbm', 'sinr_db', 'dbm', 'red', 'operador', 'caida'],
    points.map(function (p) { return [new Date(p.t).toISOString(), p.t, p.lat, p.lon, p.acc, qi(p.q).n, p.rsrp, p.sinr, p.dbm, p.net, p.op, p.out ? 1 : 0]; })));
}
function exportOut() {
  save('antena-libre-caidas-' + stamp() + '.csv', 'text/csv', toCsv(
    ['inicio', 'fin', 'duracion_s', 'motivo', 'lat', 'lon', 'red', 'operador'],
    outages.map(function (o) { return [new Date(o.start).toISOString(), o.end ? new Date(o.end).toISOString() : '', Math.round((o.dur || 0) / 1000), o.reason, o.lat, o.lon, o.net, o.op]; })));
}

// ---------- brújula ----------
var target = null, bins = [], useTrue = false;
for (var bi = 0; bi < 36; bi++) bins.push(null);
var CARD = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
function buildDial() {
  var s = '', a;
  for (a = 0; a < 360; a += 10) {
    var major = a % 30 === 0;
    s += '<line x1="150" y1="10" x2="150" y2="' + (major ? 32 : 22) + '" transform="rotate(' + a + ' 150 150)" stroke="#64748b" stroke-width="' + (major ? 2 : 1) + '"/>';
  }
  var L = { 0: 'N', 90: 'E', 180: 'S', 270: 'O' };
  for (a = 0; a < 360; a += 30) {
    if (L[a]) s += '<text x="150" y="62" text-anchor="middle" font-size="26" font-weight="800" fill="' + (a === 0 ? '#ef4444' : '#e5e7eb') + '" transform="rotate(' + a + ' 150 150)">' + L[a] + '</text>';
    else s += '<text x="150" y="54" text-anchor="middle" font-size="11" fill="#94a3b8" transform="rotate(' + a + ' 150 150)">' + a + '</text>';
  }
  $('#ticks').innerHTML = s;
}
function compassTick() {
  if (!A || activeTab !== 'brujula') return;
  var o; try { o = JSON.parse(A.getHeading()); } catch (e) { return; }
  if (o.mag == null || o.mag < 0) { $('#hdg').textContent = '--'; $('#card').textContent = 'Sin sensor'; return; }
  var h = (useTrue && o.hasDecl) ? o.trueN : o.mag;
  $('#dial').setAttribute('transform', 'rotate(' + (-h) + ' 150 150)');
  $('#hdg').textContent = Math.round(h) + '°';
  $('#card').textContent = CARD[Math.round(h / 45) % 8];
  $('#decl').textContent = o.hasDecl ? 'Declinación local: ' + (o.decl >= 0 ? '+' : '') + o.decl + '°' : (useTrue ? 'Norte verdadero requiere ubicación; mostrando magnético.' : '');
  var s = last.sig, rs = s ? (s.rsrp != null ? s.rsrp : s.dbm) : null;
  if (rs != null) {
    var b = Math.floor(h / 10) % 36;
    if (bins[b] == null || rs > bins[b]) bins[b] = rs;
  }
  var bestI = -1;
  for (var i = 0; i < 36; i++) if (bins[i] != null && (bestI < 0 || bins[i] > bins[bestI])) bestI = i;
  $('#best').textContent = bestI < 0 ? '--' : bins[bestI] + ' dBm hacia ' + (bestI * 10 + 5) + '° (' + CARD[Math.round((bestI * 10 + 5) / 45) % 8] + ')';
  if (target != null) {
    $('#tgt').classList.remove('hidden'); $('#tgt').setAttribute('transform', 'rotate(' + target + ' 150 150)');
    var d = ((target - h + 540) % 360) - 180, ad = Math.abs(Math.round(d)), el = $('#delta');
    if (ad <= 3) { el.textContent = '✓ Alineado con el objetivo (' + target + '°)'; el.style.color = '#22c55e'; }
    else { el.textContent = (d > 0 ? 'Gira a la derecha ' : 'Gira a la izquierda ') + ad + '°  →  objetivo ' + target + '°'; el.style.color = '#f59e0b'; }
  } else {
    $('#tgt').classList.add('hidden'); var e2 = $('#delta'); e2.style.color = ''; e2.textContent = 'Mantén el teléfono plano y alejado de metales e imanes.';
  }
}
function curHeading() {
  try { var o = JSON.parse(A.getHeading()); if (o.mag < 0) return null; return Math.round((useTrue && o.hasDecl) ? o.trueN : o.mag) % 360; } catch (e) { return null; }
}

// ---------- eventos ----------
function showTab(name) {
  activeTab = name;
  $$('.tab').forEach(function (t) { t.classList.toggle('active', t.id === 'tab-' + name); });
  $$('nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
  if (name === 'mapa') { drawMap(); drawList(); }
}
function bind() {
  $$('nav button').forEach(function (b) { b.addEventListener('click', function () { showTab(b.dataset.tab); }); });
  $$('[data-set]').forEach(function (b) { b.addEventListener('click', function () { if (A) A.openSettings(b.dataset.set); else toast('Solo disponible en la app'); }); });
  $('#btnPerm').addEventListener('click', function () { if (A) A.requestPerms(); });
  $('#awake').addEventListener('change', function (e) { if (A) A.keepScreenOn(e.target.checked); LS.set('al_awake', e.target.checked); });
  $('#filter').addEventListener('change', drawMap);
  $('#map').addEventListener('click', function (e) {
    var r = this.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 28;
    hits.forEach(function (h) { var d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } });
    $('#hit').textContent = best ? best.txt : 'Toca un punto para ver sus detalles.';
  });
  $('#xCsvP').addEventListener('click', exportPts);
  $('#xCsvC').addEventListener('click', exportOut);
  $('#xJson').addEventListener('click', function () { save('antena-libre-' + stamp() + '.json', 'application/json', jsonAll()); });
  $('#xShare').addEventListener('click', function () { if (A) A.shareText('Antena Libre - datos', jsonAll()); else toast('Solo disponible en la app'); });
  var armed = null;
  $('#clear').addEventListener('click', function () {
    var b = this;
    if (!armed) {
      b.textContent = 'Toca otra vez para confirmar el borrado';
      armed = setTimeout(function () { armed = null; b.textContent = 'Borrar historial'; }, 4000); return;
    }
    clearTimeout(armed); armed = null; b.textContent = 'Borrar historial';
    outages = []; points = []; lastPt = null; persist(); drawMap(); drawList(); toast('Historial borrado');
  });
  $$('input[name=north]').forEach(function (r) { r.addEventListener('change', function () { useTrue = r.value === 'true' && r.checked; }); });
  $('#tset').addEventListener('click', function () {
    var v = parseInt($('#tin').value, 10);
    if (isNaN(v)) { toast('Escribe un rumbo de 0 a 359'); return; }
    target = ((v % 360) + 360) % 360;
  });
  $('#tnow').addEventListener('click', function () { var h = curHeading(); if (h == null) toast('Sin lectura de brújula'); else { target = h; $('#tin').value = h; } });
  $('#tbest').addEventListener('click', function () {
    var bi2 = -1; for (var i = 0; i < 36; i++) if (bins[i] != null && (bi2 < 0 || bins[i] > bins[bi2])) bi2 = i;
    if (bi2 < 0) toast('Aún no hay barrido: gira 360° despacio'); else { target = bi2 * 10 + 5; $('#tin').value = target; }
  });
  $('#tclr').addEventListener('click', function () { target = null; for (var i = 0; i < 36; i++) bins[i] = null; $('#tin').value = ''; $('#best').textContent = '--'; });
  window.addEventListener('resize', function () { if (activeTab === 'mapa') drawMap(); });
}

function start() {
  closeStale(); buildDial(); bind(); legend($('#legend')); legend($('#legend2'));
  var aw = LS.get('al_awake', false); $('#awake').checked = aw; if (A && aw) A.keepScreenOn(true);
  tick(); setInterval(tick, CFG.pollMs); setInterval(compassTick, 120);
}

fetch('../app/config.json').then(function (r) { return r.json(); }).then(function (c) {
  for (var k in c) { if (k === 'thresholds') { for (var t in c.thresholds) CFG.thresholds[t] = c.thresholds[t]; } else CFG[k] = c[k]; }
}).catch(function () {}).then(start);
})();
