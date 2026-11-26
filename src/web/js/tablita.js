(function (AL) {
'use strict';
var $ = AL.$, tr = AL.L, LS = AL.LS, esc = AL.esc;
var K = { hist: 'al_tab_hist', cfg: 'al_tab_cfg' };
var CAB_IDS = ['RG-6 (75 Ω)', 'RG-58', 'LMR-200', 'LMR-400'];
var DEF = { gain: 12, cable: 'LMR-400', len: 10, coup: 10, freq: null, bw: 260, bh: 200, ant: 'top', dwell: 4, step: 10, ref: null, sweet: 15 };
var TB = AL.tb = { cfg: Object.assign({}, DEF, LS.get(K.cfg, {})), ang: 0, ox: 0, oy: 0, ta: null, run: null, tele: null, stamp: 0, rs: [], best: null, timers: false, drag: null, msg: '' };

// ---------- utilidades ----------
function mean(a) { var s = 0, i; for (i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : null; }
function r1(v) { return Math.round(v * 10) / 10; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function n360(v) { return ((v % 360) + 360) % 360; }
function cab(id) { for (var i = 0; i < AL.CABLES.length; i++) if (AL.CABLES[i].id === id) return AL.CABLES[i]; return AL.CABLES[0]; }
function saveCfg() { LS.set(K.cfg, TB.cfg); }
function fnum(v, d) { return v == null || isNaN(v) ? '--' : Number(v).toFixed(d == null ? 1 : d); }
function toast(m) { if (AL.toast) AL.toast(m); }

// ---------- geometría del teléfono sobre la tablita ----------
function antLocal() { return TB.cfg.ant === 'bottom' ? { x: 0, y: 68 } : TB.cfg.ant === 'center' ? { x: 0, y: 0 } : { x: 0, y: -68 }; }
function handleLocal() { return TB.cfg.ant === 'top' ? { x: 0, y: 87 } : { x: 0, y: -87 }; }
function pickup() { return { x: 0, y: -TB.cfg.bh / 2 + 35 }; }
function rot(v, deg) { var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }; }
function phoneCenter() { var a = rot(antLocal(), TB.ang), p = pickup(); return { x: p.x + TB.ox - a.x, y: p.y + TB.oy - a.y }; }
function dist() { return Math.sqrt(TB.ox * TB.ox + TB.oy * TB.oy); }
function lossDist(d) { return 10 * Math.log10(1 + Math.pow(d / 12, 2)); }
function lossPol(ang) { return Math.min(20, -20 * Math.log10(Math.max(Math.abs(Math.cos(ang * Math.PI / 180)), 0.1))); }
function coupEst() { var a = lossDist(dist()), b = lossPol(TB.ang); return { dist: a, pol: b, total: TB.cfg.coup + a + b }; }

// ---------- frecuencia y presupuesto ----------
function freqInfo() {
  var t = TB.tele, S = AL.S, auto = null;
  if (S && S.freq && S.freq.f) auto = { f: S.freq.f, label: S.freq.label };
  else if (t && t.f) auto = { f: t.f, label: t.band || '' };
  if (TB.cfg.freq) return { f: TB.cfg.freq, label: auto && Math.abs(auto.f - TB.cfg.freq) < 0.05 ? auto.label : tr('manual', 'manual'), manual: true };
  return auto ? { f: auto.f, label: auto.label, manual: false } : { f: 2172.5, label: 'B66', manual: false };
}
function budget() {
  var c = TB.cfg, fi = freqInfo(), cb = cab(c.cable), cl = AL.cableLoss(cb, fi.f, c.len), conn = AL.CONN_LOSS;
  return { f: fi.f, label: fi.label, manual: fi.manual, cb: cb, cl: cl, perM: AL.cableLoss(cb, fi.f, 1), conn: conn, coup: c.coup, gain: c.gain, net: c.gain - cl - conn - c.coup };
}

// ---------- telemetría (AntenaBridge.getTelemetryJson o respaldo) ----------
function readTele() {
  var B = window.AntenaBridge || window.Android, o = null, src = 'sim';
  if (B && typeof B.getTelemetryJson === 'function') { try { o = JSON.parse(B.getTelemetryJson()); src = 'bridge'; } catch (e) { o = null; } }
  if (!o && B && typeof B.getSignal === 'function') { try { o = JSON.parse(B.getSignal()); src = 'signal'; } catch (e) { o = null; } }
  if (o) {
    var rs = o.rsrp != null ? o.rsrp : (o.dbm != null ? o.dbm : null), fq = null;
    if (o.freqMhz) fq = { f: o.freqMhz, label: o.band || '' };
    else if (o.earfcn != null || o.nrarfcn != null) { var cf = AL.cellFreq({ type: o.type || 'LTE', earfcn: o.earfcn, nrarfcn: o.nrarfcn, bands: o.bands }); if (cf && cf.f) fq = { f: cf.f, label: cf.label }; }
    return { rsrp: rs, sinr: o.sinr != null ? o.sinr : null, rsrq: o.rsrq != null ? o.rsrq : null, f: fq ? fq.f : null, band: fq ? fq.label : (o.band || ''), net: o.net || '', src: src };
  }
  var b = budget(), ce = coupEst(), n = (Math.sin(Date.now() / 700) + Math.random() - 0.5) * 0.8;
  var rsim = -105 + b.gain - b.cl - b.conn - ce.total + n;
  return { rsrp: r1(rsim), sinr: r1(clamp(8 + (rsim + 100) / 4, -5, 28)), rsrq: -11, f: 2172.5, band: 'B66', net: '4G LTE', src: 'sim' };
}
function sample() {
  var t = readTele(); TB.tele = t; TB.stamp++;
  if (t.rsrp != null) {
    TB.rs.push(t.rsrp); if (TB.rs.length > 30) TB.rs.shift();
    var w = TB.rs.slice(-3);
    if (w.length === 3 && !TB.run) {
      var av = mean(w);
      if (!TB.best || av > TB.best.rsrp + 0.05) TB.best = { ang: Math.round(TB.ang), x: Math.round(TB.ox), y: Math.round(TB.oy), rsrp: r1(av), sinr: t.sinr, t: Date.now(), from: 'manual' };
    }
  }
}
function trend() {
  var n = TB.rs.length; if (n < 6) return { d: 0, k: 'wait' };
  var a = mean(TB.rs.slice(-3)), b = mean(TB.rs.slice(-6, -3)), d = a - b;
  return { d: d, k: d > 1 ? 'up' : d < -1 ? 'down' : 'flat' };
}

// ---------- alineación guiada ----------
function setTarget(a, x, y) { TB.ta = { ang: a, ox: x, oy: y }; }
function guidedStart() {
  var d = TB.cfg.dwell, st = TB.cfg.step, ang = [], i;
  for (i = 0; i < 360; i += 15) ang.push(i);
  var pos = [[0, 0], [-st, 0], [st, 0], [0, -st], [0, st], [-st, -st], [st, -st], [-st, st], [st, st]];
  TB.run = { phase: 'ang', i: 0, left: d, dwell: d, acc: [], last: TB.stamp, ang: ang, pos: pos, resA: [], resP: [], bestAng: 0, total: ang.length + pos.length, done: 0 };
  TB.ox = 0; TB.oy = 0; setTarget(0, 0, 0); TB.msg = '';
}
function ease() {
  var t = TB.ta; if (!t) return;
  var da = ((t.ang - TB.ang + 540) % 360) - 180;
  TB.ang = Math.abs(da) < 0.6 ? t.ang : n360(TB.ang + da * 0.35);
  TB.ox = Math.abs(t.ox - TB.ox) < 0.3 ? t.ox : TB.ox + (t.ox - TB.ox) * 0.35;
  TB.oy = Math.abs(t.oy - TB.oy) < 0.3 ? t.oy : TB.oy + (t.oy - TB.oy) * 0.35;
}
function pickBest(list) { var b = null, i; for (i = 0; i < list.length; i++) if (list[i].r != null && (!b || list[i].r > b.r)) b = list[i]; return b; }
function finishRun(msg) { TB.run = null; TB.msg = msg; }
function stepRun(dt) {
  var R = TB.run; if (!R) return;
  ease(); R.left -= dt;
  if (R.left <= R.dwell - 1.5 && TB.stamp !== R.last) { R.last = TB.stamp; if (TB.tele && TB.tele.rsrp != null) R.acc.push(TB.tele.rsrp); }
  if (R.left > 0) return;
  var avg = R.acc.length ? mean(R.acc) : null;
  if (R.phase === 'ang') {
    R.resA.push({ v: R.ang[R.i], r: avg }); R.i++; R.done++;
    if (R.i < R.ang.length) setTarget(R.ang[R.i], 0, 0);
    else {
      var ba = pickBest(R.resA);
      if (!ba) { finishRun(tr('Sin lecturas de señal: revisa permisos y vuelve a intentar.', 'No signal readings: check permissions and try again.')); return; }
      R.bestAng = ba.v; R.phase = 'pos'; R.i = 0; setTarget(R.bestAng, R.pos[0][0], R.pos[0][1]);
    }
  } else {
    R.resP.push({ dx: R.pos[R.i][0], dy: R.pos[R.i][1], r: avg }); R.i++; R.done++;
    if (R.i < R.pos.length) setTarget(R.bestAng, R.pos[R.i][0], R.pos[R.i][1]);
    else {
      var bp = null, wp = null, k;
      for (k = 0; k < R.resP.length; k++) { var q = R.resP[k]; if (q.r == null) continue; if (!bp || q.r > bp.r) bp = q; if (!wp || q.r < wp.r) wp = q; }
      if (!bp) { finishRun(tr('Sin lecturas de señal en la fase de posición.', 'No signal readings in the position phase.')); return; }
      setTarget(R.bestAng, bp.dx, bp.dy);
      TB.best = { ang: R.bestAng, x: bp.dx, y: bp.dy, rsrp: r1(bp.r), sinr: TB.tele ? TB.tele.sinr : null, t: Date.now(), from: 'guiada' };
      finishRun(tr('Listo: mejor punto a ' + R.bestAng + '°, X ' + bp.dx + ' mm, Y ' + bp.dy + ' mm → ' + fnum(bp.r) + ' dBm (+' + fnum(bp.r - wp.r) + ' dB sobre el peor). Pulsa “Guardar punto óptimo”.',
        'Done: best point at ' + R.bestAng + '°, X ' + bp.dx + ' mm, Y ' + bp.dy + ' mm → ' + fnum(bp.r) + ' dBm (+' + fnum(bp.r - wp.r) + ' dB over the worst). Tap “Save best point”.'));
      return;
    }
  }
  R.left = R.dwell; R.acc = []; R.last = TB.stamp;
}

// ---------- historial ----------
function hist() { return LS.get(K.hist, []); }
function savePoint() {
  var b = TB.best; if (!b) { toast(tr('Aún no hay una lectura válida', 'No valid reading yet')); return; }
  var fi = freqInfo(), bd = budget(), h = hist();
  h.unshift({ t: Date.now(), ang: b.ang, x: b.x, y: b.y, rsrp: b.rsrp, sinr: b.sinr, band: fi.label, mhz: fi.f, gain: bd.gain, cable: TB.cfg.cable, len: TB.cfg.len, coup: TB.cfg.coup, from: b.from });
  if (h.length > 200) h.length = 200; LS.set(K.hist, h); renderHist();
  toast(tr('Punto óptimo guardado: ' + b.ang + '°, ' + b.x + '/' + b.y + ' mm, ' + fnum(b.rsrp) + ' dBm', 'Best point saved: ' + b.ang + '°, ' + b.x + '/' + b.y + ' mm, ' + fnum(b.rsrp) + ' dBm'));
}
function renderHist() {
  var el = $('#tb-hist'); if (!el) return; var h = hist();
  if (!h.length) { el.innerHTML = '<p class="muted small">' + tr('Aún no hay puntos guardados.', 'No saved points yet.') + '</p>'; return; }
  el.innerHTML = h.slice(0, 10).map(function (p, i) {
    return '<div class="ol"><b>' + AL.fmtDate(p.t) + '</b> · ' + fnum(p.rsrp) + ' dBm' + (p.sinr != null ? ' · SINR ' + p.sinr : '') + '<br><span class="muted">' + p.ang + '° · X ' + p.x + ' / Y ' + p.y + ' mm · ' + esc(p.band || '') + ' ' + fnum(p.mhz) + ' MHz · ' + esc(p.cable) + ' ' + p.len + ' m</span><br><button data-tb-act="use" data-i="' + i + '">' + tr('Usar este punto', 'Use this point') + '</button></div>';
  }).join('');
}

// ---------- consejos ----------
function advice(R) {
  var out = [], c = TB.cfg, lm3 = 3 / Math.max(R.perM, 0.001), cabBest = cab('LMR-400'), clBest = AL.cableLoss(cabBest, R.f, c.len);
  var d10 = lossDist(10), d20 = lossDist(20), mast = AL.pathLoss(R.f, 3, 30, 6, 'suburban') - AL.pathLoss(R.f, 3, 30, 7, 'suburban');
  if (R.net < 0) out.push(['bad', tr('Con este montaje pierdes ' + fnum(-R.net) + ' dB: el móvil recibiría MENOS que sin antena. Acorta el cable o mejora el acople antes de subir nada al mástil.', 'With this setup you lose ' + fnum(-R.net) + ' dB: the phone would get LESS than without the antenna. Shorten the cable or improve the coupling before touching the mast.')]);
  else if (R.net < 6) out.push(['warn', tr('Ganancia neta pequeña (+' + fnum(R.net) + ' dB). Todavía hay margen: mira abajo qué pierde más.', 'Small net gain (+' + fnum(R.net) + ' dB). There is still room: see below what loses most.')]);
  else out.push(['ok', tr('Buen balance: +' + fnum(R.net) + ' dB netos. Protege lo que ganaste: no alargues el cable ni dejes metales cerca.', 'Good balance: +' + fnum(R.net) + ' dB net. Protect it: don’t lengthen the cable or leave metal nearby.')]);
  if (R.cl >= 3) out.push(['warn', tr('El cable se come ' + fnum(R.cl) + ' dB (≈ la mitad de la potencia). Con ' + R.cb.id + ' a ' + fnum(R.f, 0) + ' MHz el límite razonable es ≈ ' + fnum(lm3) + ' m (3 dB).' + (R.cb.id !== 'LMR-400' ? ' Con LMR-400 pasarías a ' + fnum(clBest) + ' dB (ahorras ' + fnum(R.cl - clBest) + ' dB).' : ''), 'The cable eats ' + fnum(R.cl) + ' dB (≈ half the power). With ' + R.cb.id + ' at ' + fnum(R.f, 0) + ' MHz the sensible limit is ≈ ' + fnum(lm3) + ' m (3 dB).' + (R.cb.id !== 'LMR-400' ? ' With LMR-400 you would drop to ' + fnum(clBest) + ' dB (saving ' + fnum(R.cl - clBest) + ' dB).' : ''))]);
  else out.push(['ok', tr('El cable pierde poco (' + fnum(R.cl) + ' dB): no es tu prioridad.', 'Cable loss is small (' + fnum(R.cl) + ' dB): not your priority.')]);
  if (R.coup >= R.cl) out.push(['tip', tr('Tu mayor pérdida es el acople sin conector (' + fnum(R.coup) + ' dB). Ajustar la posición y el giro del móvil en la tablita rinde MÁS que cambiar de cable.', 'Your biggest loss is the connector-less coupling (' + fnum(R.coup) + ' dB). Adjusting the phone position and rotation on the board pays MORE than changing cable.')]);
  else out.push(['tip', tr('Aquí el cable pesa más que el acople: acórtalo o engrosa antes de afinar la tablita.', 'Here the cable weighs more than the coupling: shorten or thicken it before fine-tuning the board.')]);
  out.push(['tip', tr('Comparación práctica: desplazar el móvil 10 mm fuera del punto óptimo cuesta ≈ ' + fnum(d10) + ' dB (20 mm ≈ ' + fnum(d20) + ' dB), más que 1 m de cable (' + fnum(R.perM, 2) + ' dB). Subir 1 m de mástil aporta ≈ ' + fnum(mast) + ' dB en el modelo (en la práctica 0.5–3 dB): hazlo cuando el acople y el cable ya estén afinados.', 'Practical comparison: moving the phone 10 mm off the best spot costs ≈ ' + fnum(d10) + ' dB (20 mm ≈ ' + fnum(d20) + ' dB), more than 1 m of cable (' + fnum(R.perM, 2) + ' dB). Raising the mast 1 m gives ≈ ' + fnum(mast) + ' dB in the model (0.5–3 dB in practice): do it once coupling and cable are tuned.')]);
  if (R.coup > 12) out.push(['warn', tr('Acople alto (' + fnum(R.coup) + ' dB): quita funda gruesa o con metal/imán, acerca la zona de antena del móvil al acoplador (≤ 15 mm) y prueba 0° y 180°.', 'High coupling (' + fnum(R.coup) + ' dB): remove thick or metal/magnet cases, bring the phone’s antenna zone within 15 mm of the coupler and try 0° and 180°.')]);
  if (R.len > 15 && R.cb.id !== 'LMR-400') out.push(['warn', tr('Más de 15 m con ' + R.cb.id + ' casi nunca compensa: usa LMR-400 o mueve el equipo más cerca de la antena.', 'More than 15 m with ' + R.cb.id + ' rarely pays off: use LMR-400 or move the gear closer to the antenna.')]);
  if (TB.cfg.ref != null) {
    var exp = TB.cfg.ref + R.net, live = TB.tele && TB.tele.rsrp != null ? TB.tele.rsrp : null;
    if (live != null) { var df = exp - live; out.push([df > 3 ? 'warn' : 'ok', df > 3 ? tr('Estás ' + fnum(df) + ' dB por debajo de lo esperado (' + fnum(exp) + ' dBm): revisa posición, giro, conectores y metales cerca.', 'You are ' + fnum(df) + ' dB below expected (' + fnum(exp) + ' dBm): check position, rotation, connectors and nearby metal.') : tr('Estás cerca de lo esperado (' + fnum(exp) + ' dBm). Buen ajuste.', 'You are close to the expected value (' + fnum(exp) + ' dBm). Good tuning.')]); }
  }
  return out;
}

// ---------- plano SVG con cotas ----------
function dimH(x1, x2, y, label) { return '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="#f59e0b" stroke-width="1.2"/><line x1="' + x1 + '" y1="' + (y - 4) + '" x2="' + x1 + '" y2="' + (y + 4) + '" stroke="#f59e0b"/><line x1="' + x2 + '" y1="' + (y - 4) + '" x2="' + x2 + '" y2="' + (y + 4) + '" stroke="#f59e0b"/><text x="' + ((x1 + x2) / 2) + '" y="' + (y - 4) + '" fill="#f59e0b" font-size="9.5" text-anchor="middle">' + label + '</text>'; }
function dimV(x, y1, y2, label) { return '<line x1="' + x + '" y1="' + y1 + '" x2="' + x + '" y2="' + y2 + '" stroke="#f59e0b" stroke-width="1.2"/><line x1="' + (x - 4) + '" y1="' + y1 + '" x2="' + (x + 4) + '" y2="' + y1 + '" stroke="#f59e0b"/><line x1="' + (x - 4) + '" y1="' + y2 + '" x2="' + (x + 4) + '" y2="' + y2 + '" stroke="#f59e0b"/><text transform="translate(' + (x - 5) + ',' + ((y1 + y2) / 2) + ') rotate(-90)" fill="#f59e0b" font-size="9.5" text-anchor="middle">' + label + '</text>'; }
function svgTop() {
  var c = TB.cfg, s = 0.9, x0 = 56, y0 = 34, W = c.bw * s, H = c.bh * s, px = x0 + W / 2, py = y0 + 35 * s, sw = c.sweet * s;
  var s1 = '<rect x="' + x0 + '" y="' + y0 + '" width="' + W + '" height="' + H + '" rx="6" fill="#f1f5f9" stroke="#94a3b8"/>';
  s1 += '<rect x="' + (px - 36 * s) + '" y="' + (py - 7 * s) + '" width="' + (72 * s) + '" height="' + (150 * s) + '" rx="8" fill="none" stroke="#60a5fa" stroke-dasharray="4 3"/>';
  s1 += '<rect x="' + (px - 20 * s) + '" y="' + (py - 12 * s) + '" width="' + (40 * s) + '" height="' + (10 * s) + '" fill="#f59e0b" opacity=".55"/>';
  s1 += '<circle cx="' + px + '" cy="' + py + '" r="' + sw + '" fill="rgba(34,197,94,.18)" stroke="#16a34a" stroke-dasharray="3 2"/><circle cx="' + px + '" cy="' + py + '" r="3" fill="#16a34a"/>';
  s1 += '<line x1="' + (px - 10) + '" y1="' + py + '" x2="' + (px + 10) + '" y2="' + py + '" stroke="#16a34a"/><line x1="' + px + '" y1="' + (py - 10) + '" x2="' + px + '" y2="' + (py + 10) + '" stroke="#16a34a"/>';
  s1 += '<text x="' + (px + sw + 4) + '" y="' + (py + 3) + '" fill="#166534" font-size="9">' + tr('Acoplador · zona óptima Ø ', 'Coupler · sweet zone Ø ') + c.sweet * 2 + ' mm</text>';
  s1 += '<text x="' + px + '" y="' + (py + 60) + '" fill="#2563eb" font-size="9" text-anchor="middle">' + tr('móvil (antena arriba)', 'phone (antenna up)') + '</text>';
  s1 += dimH(x0, x0 + W, y0 - 14, (c.bw / 10) + ' cm (' + c.bw + ' mm)') + dimV(x0 - 14, y0, y0 + H, (c.bh / 10) + ' cm (' + c.bh + ' mm)');
  s1 += dimH(x0, px, y0 + H + 16, (c.bw / 20) + ' cm') + dimH(px, x0 + W, y0 + H + 16, (c.bw / 20) + ' cm') + dimV(x0 + W + 14, y0, py, '3.5 cm (35 mm)');
  return '<svg viewBox="0 0 340 ' + (y0 + H + 26) + '" class="ant">' + s1 + '</svg>';
}
function svgSide(R) {
  var s = 0.9, x0 = 40, W = TB.cfg.bw * s, yb = 92, th = 26, lam = 299792.458 / R.f;
  var o = '<rect x="' + x0 + '" y="' + yb + '" width="' + W + '" height="' + th + '" fill="#f1f5f9" stroke="#94a3b8"/>';
  o += '<rect x="' + (x0 + W / 2 - 36) + '" y="' + (yb - 14) + '" width="72" height="9" rx="3" fill="#0f172a" stroke="#60a5fa"/><text x="' + (x0 + W / 2) + '" y="' + (yb - 20) + '" fill="#60a5fa" font-size="9" text-anchor="middle">' + tr('móvil (con funda)', 'phone (with case)') + '</text>';
  o += '<rect x="' + (x0 + W / 2 - 14) + '" y="' + (yb + 6) + '" width="28" height="6" rx="3" fill="#22c55e"/><text x="' + (x0 + W / 2 + 40) + '" y="' + (yb + 13) + '" fill="#22c55e" font-size="9">' + tr('acoplador (lazo/parche)', 'coupler (loop/patch)') + '</text>';
  o += '<path d="M ' + (x0 + W / 2) + ' ' + (yb + 12) + ' L ' + (x0 + W / 2) + ' ' + (yb + 46) + ' q 0 18 -24 18 l -60 0" fill="none" stroke="#94a3b8" stroke-width="3"/><text x="' + (x0 + W / 2 - 100) + '" y="' + (yb + 82) + '" fill="#94a3b8" font-size="9">' + tr('coaxial ' + R.cb.id + ' → antena', 'coax ' + R.cb.id + ' → antenna') + '</text>';
  o += dimV(x0 + W / 2 - 50, yb - 5, yb + 6, '≤ 8 mm') + dimV(x0 + 14, yb, yb + th, '10 mm');
  o += '<text x="' + (x0 + 18) + '" y="' + (yb + 56) + '" fill="#f59e0b" font-size="9">' + tr('Curva mín. ' + fnum(R.cb.od * 10 / 10, 1) + ' cm (10 × Ø)', 'Min. bend ' + fnum(R.cb.od * 10 / 10, 1) + ' cm (10 × Ø)') + '</text>';
  o += '<text x="170" y="14" fill="#94a3b8" font-size="10" text-anchor="middle">' + tr('Vista lateral (alto sin escala)', 'Side view (height not to scale)') + '</text>';
  o += '<text x="170" y="' + (yb + 104) + '" fill="#ef4444" font-size="9.5" text-anchor="middle">' + tr('Sin metal a menos de 1 λ ≈ ' + fnum(lam / 10, 0) + ' cm de la tablita', 'No metal within 1 λ ≈ ' + fnum(lam / 10, 0) + ' cm of the board') + '</text>';
  return '<svg viewBox="0 0 340 214" class="ant">' + o + '</svg>';
}

// ---------- HTML del módulo ----------
function inp(k, v, step, min, max) { return '<input type="number" inputmode="decimal" data-tb="' + k + '" value="' + (v == null ? '' : v) + '" step="' + (step || 'any') + '"' + (min != null ? ' min="' + min + '"' : '') + (max != null ? ' max="' + max + '"' : '') + '>'; }
function sel(k, opts, cur) { return '<select data-tb="' + k + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; }
function html() {
  var c = TB.cfg;
  return '<div id="tb-root">' +
    '<button data-act="antBack">← ' + tr('Volver', 'Back') + '</button>' +
    '<div class="card tb-hero"><h2 class="first" style="margin:0">' + tr('Alineación en tablita y presupuesto de enlace', 'Board alignment and link budget') + '</h2><div class="muted small">' + tr('Sin conector · antena direccional + coaxial + tablita de acople', 'Connector-less · directional antenna + coax + coupling board') + '</div></div>' +
    '<h3>1 · ' + tr('Simulador de alineación', 'Alignment simulator') + '</h3>' +
    '<canvas id="tb-cv"></canvas>' +
    '<div class="muted small" id="tb-help">' + tr('Arrastra el móvil para desplazarlo; arrastra el punto azul del extremo para girarlo. El punto ámbar es la zona de antena del móvil.', 'Drag the phone to move it; drag the blue dot at its end to rotate it. The amber patch is the phone’s antenna zone.') + '</div>' +
    '<div class="tb-grid"><div class="tb-k"><b id="tb-oa">0°</b><span>' + tr('Ángulo', 'Angle') + '</span></div><div class="tb-k"><b id="tb-ox">0</b><span>X mm</span></div><div class="tb-k"><b id="tb-oy">0</b><span>Y mm</span></div><div class="tb-k"><b id="tb-od">0</b><span>' + tr('Dist. mm', 'Dist. mm') + '</span></div></div>' +
    '<div class="tb-grid" style="margin-top:6px"><div class="tb-k"><b id="tb-rsrp">--</b><span>RSRP dBm</span></div><div class="tb-k"><b id="tb-sinr">--</b><span>SINR dB</span></div><div class="tb-k"><b id="tb-trend">●</b><span>' + tr('Tendencia', 'Trend') + '</span></div><div class="tb-k"><b id="tb-coup">--</b><span>' + tr('Acople est.', 'Est. coupling') + '</span></div></div>' +
    '<div class="muted small" id="tb-src" style="margin-top:4px"></div>' +
    '<div class="card" style="margin-top:8px"><label class="muted small">' + tr('Ángulo (0–360°)', 'Angle (0–360°)') + '</label><input type="range" id="tb-sa" min="0" max="360" step="1" value="0"><label class="muted small">X (mm)</label><input type="range" id="tb-sx" min="-80" max="80" step="1" value="0"><label class="muted small">Y (mm)</label><input type="range" id="tb-sy" min="-80" max="80" step="1" value="0">' +
    '<div class="btns" style="margin-top:8px"><button data-tb-act="a-15">−15°</button><button data-tb-act="a+15">+15°</button><button data-tb-act="a0">0°</button><button data-tb-act="a180">180°</button></div>' +
    '<div class="row"><span class="muted small">' + tr('Antena del móvil', 'Phone antenna') + '</span>' + sel('ant', [['top', tr('Arriba', 'Top')], ['bottom', tr('Abajo', 'Bottom')], ['center', tr('Centro', 'Center')]], c.ant) + '<span class="muted small">' + tr('Espera', 'Dwell') + '</span>' + sel('dwell', [[3, '3 s'], [4, '4 s'], [6, '6 s'], [8, '8 s']], c.dwell) + '<span class="muted small">' + tr('Paso', 'Step') + '</span>' + sel('step', [[5, '5 mm'], [10, '10 mm'], [15, '15 mm']], c.step) + '</div></div>' +
    '<div class="tb-prog"><i id="tb-prog"></i></div><div id="tb-step" class="tb-step">' + tr('Pulsa “Iniciar alineación” o mueve el móvil a mano.', 'Tap “Start alignment” or move the phone by hand.') + '</div>' +
    '<div class="btns"><button class="primary" data-tb-act="start" id="tb-start">' + tr('Iniciar alineación', 'Start alignment') + '</button><button data-tb-act="save">' + tr('Guardar punto óptimo', 'Save best point') + '</button></div>' +
    '<div class="card rows"><div><span>' + tr('Mejor punto de esta sesión', 'Best point this session') + '</span><b id="tb-best">--</b></div></div><div class="btns"><button data-tb-act="resetbest">' + tr('Reiniciar mejor', 'Reset best') + '</button><button data-tb-act="share">' + tr('Compartir historial', 'Share history') + '</button></div>' +
    '<h3>' + tr('Historial de puntos óptimos', 'Best-point history') + '</h3><div id="tb-hist"></div><button class="danger" data-tb-act="clearhist" id="tb-clr">' + tr('Borrar historial', 'Clear history') + '</button>' +
    '<h3>2 · ' + tr('Presupuesto de enlace (antena + cable + tablita)', 'Link budget (antenna + cable + board)') + '</h3>' +
    '<div class="card"><div class="tb-f"><div><label>' + tr('Frecuencia MHz', 'Frequency MHz') + '</label>' + inp('freq', c.freq || '', 0.1, 300, 7000) + '</div><div><label>&nbsp;</label><button data-tb-act="auto" style="width:100%">' + tr('Usar banda activa', 'Use active band') + '</button></div>' +
    '<div><label>' + tr('Ganancia antena dBi', 'Antenna gain dBi') + '</label>' + inp('gain', c.gain, 0.5, 0, 30) + '</div><div><label>' + tr('Cable', 'Cable') + '</label>' + sel('cable', CAB_IDS.map(function (i) { return [i, i]; }), c.cable) + '</div>' +
    '<div><label>' + tr('Metros de cable (1–30)', 'Cable meters (1–30)') + '</label>' + inp('len', c.len, 0.5, 1, 30) + '</div><div><label>' + tr('Pérdida de acople dB', 'Coupling loss dB') + '</label>' + inp('coup', c.coup, 0.5, 0, 30) + '</div></div>' +
    '<input type="range" data-tb="lenr" min="1" max="30" step="0.5" value="' + c.len + '" style="margin-top:8px">' +
    '<div class="tb-f" style="margin-top:6px"><div><label>' + tr('RSRP del móvil solo (referencia)', 'RSRP phone alone (reference)') + '</label>' + inp('ref', c.ref == null ? '' : c.ref, 1, -140, -40) + '</div><div><label>&nbsp;</label><button data-tb-act="useref" style="width:100%">' + tr('Usar RSRP actual', 'Use current RSRP') + '</button></div></div></div>' +
    '<div id="tb-out"></div><h3>' + tr('Qué hacer ahora', 'What to do now') + '</h3><div id="tb-adv"></div>' +
    '<h3>3 · ' + tr('Plano y medidas (con regla)', 'Plan and measurements (with a ruler)') + '</h3><div class="card" id="tb-plan"></div>' +
    '</div>';
}
function planHtml(R) {
  var lam = 299792.458 / R.f;
  var steps = [
    [tr('Mide tu móvil con funda: largo y ancho. La tablita debe ser ≥ largo + 5 cm (aquí 26 × 20 cm sirve hasta 15 cm de largo).', 'Measure your phone with its case: length and width. The board must be ≥ length + 5 cm (26 × 20 cm here fits up to 15 cm long).')],
    [tr('Localiza la zona de antena (franja de 1–2 cm junto al borde superior o inferior, cerca de los cortes plásticos del marco). Mide del borde del móvil al centro de esa zona: suele ser 5–10 mm.', 'Find the antenna zone (a 1–2 cm strip near the top or bottom edge, near the plastic frame cuts). Measure from the phone edge to its center: usually 5–10 mm.')],
    [tr('Marca en la tablita el centro del acoplador a 13 cm del borde izquierdo y 3.5 cm del borde superior; traza una cruz y líneas cada 10 mm.', 'Mark the coupler center on the board 13 cm from the left edge and 3.5 cm from the top; draw a cross and lines every 10 mm.')],
    [tr('Coloca el móvil con su zona de antena sobre la cruz. La distancia al centro debe ser ≤ ' + TB.cfg.sweet + ' mm (cota verde).', 'Place the phone with its antenna zone over the cross. The distance to the center must be ≤ ' + TB.cfg.sweet + ' mm (green dimension).')],
    [tr('Separación móvil–acoplador ≤ 8 mm (tablita 3–5 mm + funda ≤ 3 mm). Más separación = más pérdida.', 'Phone-to-coupler gap ≤ 8 mm (board 3–5 mm + case ≤ 3 mm). More gap = more loss.')],
    [tr('Anota el mejor ángulo y X/Y en la app y márcalos con lápiz o cinta para repetirlos.', 'Record the best angle and X/Y in the app and mark them with pencil or tape to repeat them.')]
  ];
  var errs = [
    tr('Cables largos: cada metro de ' + R.cb.id + ' cuesta ' + fnum(R.perM, 2) + ' dB a ' + fnum(R.f, 0) + ' MHz.', 'Long cables: each meter of ' + R.cb.id + ' costs ' + fnum(R.perM, 2) + ' dB at ' + fnum(R.f, 0) + ' MHz.'),
    tr('Metal cerca: mesa, mástil o marco metálico a menos de ' + fnum(lam / 10, 0) + ' cm (1 λ) desvía y absorbe la señal.', 'Nearby metal: table, mast or metal frame closer than ' + fnum(lam / 10, 0) + ' cm (1 λ) detunes and absorbs the signal.'),
    tr('Fundas con metal o imán, anillos/soportes metálicos y bobinas de carga inalámbrica sobre la zona de antena.', 'Cases with metal or magnets, metal rings/stands and wireless-charging coils over the antenna zone.'),
    tr('Curvas cerradas del coaxial: radio mínimo ' + fnum(R.cb.od / 10 * 10, 1) + ' cm (10 × diámetro ' + R.cb.od + ' mm).', 'Tight coax bends: minimum radius ' + fnum(R.cb.od / 10 * 10, 1) + ' cm (10 × diameter ' + R.cb.od + ' mm).'),
    tr('Mover el móvil sin querer: fija topes de 3 mm en los bordes de la tablita.', 'Phone creeping: add 3 mm stops on the board edges.'),
    tr('Medir con la señal oscilando: espera 4–8 s en cada posición y usa el promedio.', 'Measuring while the signal wobbles: wait 4–8 s at each position and use the average.')
  ];
  return svgTop() + svgSide(R) + '<h4>' + tr('Qué medir', 'What to measure') + '</h4><ol>' + steps.map(function (s) { return '<li>' + s[0] + '</li>'; }).join('') + '</ol><h4>' + tr('Errores comunes', 'Common mistakes') + '</h4><ul>' + errs.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul>' +
    '<div class="tw2"><table><tr><th>' + tr('Pieza', 'Part') + '</th><th>' + tr('Medida', 'Size') + '</th></tr><tr><td>' + tr('Tablita (blanca, no metálica)', 'Board (white, non-metallic)') + '</td><td>260 × 200 × 10 mm</td></tr><tr><td>' + tr('Acoplador a bordes', 'Coupler to edges') + '</td><td>130 mm / 35 mm</td></tr><tr><td>' + tr('Zona óptima', 'Sweet zone') + '</td><td>Ø ' + TB.cfg.sweet * 2 + ' mm</td></tr><tr><td>' + tr('Separación total móvil–acoplador', 'Total phone-coupler gap') + '</td><td>≤ 8 mm</td></tr><tr><td>' + tr('Radio de curva del cable', 'Cable bend radius') + '</td><td>≥ ' + fnum(R.cb.od, 0) + ' mm × 10 = ' + fnum(R.cb.od, 0) + ' cm</td></tr><tr><td>' + tr('Distancia a metales (1 λ)', 'Distance to metals (1 λ)') + '</td><td>≥ ' + fnum(lam, 0) + ' mm</td></tr></table></div>';
}
function calc() {
  var R = budget(), out = $('#tb-out'); if (!out) return R;
  var net = R.net, col = net < 0 ? '#ef4444' : net < 6 ? '#f59e0b' : '#22c55e';
  var h = '<div class="card rows"><div><span>' + tr('Frecuencia', 'Frequency') + '</span><b>' + esc(R.label) + ' · ' + fnum(R.f, 1) + ' MHz' + (R.manual ? '' : ' (auto)') + '</b></div>' +
    '<div><span>' + tr('Ganancia de la antena', 'Antenna gain') + '</span><b class="green">+' + fnum(R.gain) + ' dB</b></div>' +
    '<div><span>' + tr('Cable ' + R.cb.id + ' · ' + R.perM.toFixed(2) + ' dB/m × ' + TB.cfg.len + ' m', 'Cable ' + R.cb.id + ' · ' + R.perM.toFixed(2) + ' dB/m × ' + TB.cfg.len + ' m') + '</span><b class="red">−' + fnum(R.cl) + ' dB</b></div>' +
    '<div><span>' + tr('Conector en la antena', 'Connector at the antenna') + '</span><b class="red">−' + fnum(R.conn) + ' dB</b></div>' +
    '<div><span>' + tr('Acople sin conector (tablita)', 'Connector-less coupling (board)') + '</span><b class="red">−' + fnum(R.coup) + ' dB</b></div>' +
    '<div><span><b>' + tr('Balance neto', 'Net balance') + '</b></span><b style="color:' + col + ';font-size:18px">' + (net >= 0 ? '+' : '') + fnum(net) + ' dB</b></div>';
  if (TB.cfg.ref != null) h += '<div><span>' + tr('RSRP esperado (referencia + neto)', 'Expected RSRP (reference + net)') + '</span><b>' + fnum(TB.cfg.ref + net) + ' dBm</b></div><div><span>' + tr('RSRP medido ahora', 'RSRP measured now') + '</span><b id="tb-live">--</b></div>';
  h += '</div>';
  out.innerHTML = h;
  $('#tb-adv').innerHTML = advice(R).map(function (a) { return '<div class="tip ' + a[0] + '">' + a[1] + '</div>'; }).join('');
  $('#tb-plan').innerHTML = planHtml(R);
  return R;
}

// ---------- dibujo y UI ----------
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function geomPx(cv) { var w = cv.clientWidth || 340, h = 270, s = Math.min((w - 16) / TB.cfg.bw, (h - 16) / TB.cfg.bh); return { w: w, h: h, s: s, cx: w / 2, cy: h / 2 }; }
function draw() {
  var cv = $('#tb-cv'); if (!cv || !cv.getContext) return;
  var G = geomPx(cv), dpr = window.devicePixelRatio || 1, c = TB.cfg;
  if (cv.width !== Math.round(G.w * dpr) || cv.height !== Math.round(G.h * dpr)) { cv.width = Math.round(G.w * dpr); cv.height = Math.round(G.h * dpr); }
  var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, G.w, G.h);
  var s = G.s, bx = G.cx - c.bw * s / 2, by = G.cy - c.bh * s / 2;
  g.fillStyle = '#f8fafc'; rr(g, bx, by, c.bw * s, c.bh * s, 10); g.fill();
  g.save(); rr(g, bx, by, c.bw * s, c.bh * s, 10); g.clip();
  g.lineWidth = 1; var m;
  for (m = 0; m <= c.bw; m += 10) { g.strokeStyle = m % 50 === 0 ? '#cbd5e1' : '#e2e8f0'; g.beginPath(); g.moveTo(bx + m * s, by); g.lineTo(bx + m * s, by + c.bh * s); g.stroke(); }
  for (m = 0; m <= c.bh; m += 10) { g.strokeStyle = m % 50 === 0 ? '#cbd5e1' : '#e2e8f0'; g.beginPath(); g.moveTo(bx, by + m * s); g.lineTo(bx + c.bw * s, by + m * s); g.stroke(); }
  g.restore();
  var P = pickup(), px = G.cx + P.x * s, py = G.cy + P.y * s;
  g.setLineDash([5, 4]); g.lineWidth = 1.5; g.strokeStyle = '#16a34a'; g.beginPath(); g.arc(px, py, c.sweet * s, 0, 6.2832); g.stroke();
  g.strokeStyle = '#d97706'; g.beginPath(); g.arc(px, py, c.sweet * 2 * s, 0, 6.2832); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#16a34a'; g.beginPath(); g.arc(px, py, 4, 0, 6.2832); g.fill(); g.strokeStyle = '#16a34a'; g.beginPath(); g.moveTo(px - 9, py); g.lineTo(px + 9, py); g.moveTo(px, py - 9); g.lineTo(px, py + 9); g.stroke();
  g.fillStyle = '#166534'; g.font = '10px sans-serif'; g.textAlign = 'left'; g.fillText(tr('Acoplador', 'Coupler'), px + 8, py - 8);
  // teléfono
  var pc = phoneCenter(), ce = coupEst(), a = antLocal(), hh = handleLocal(), good = ce.total <= c.coup + 3, mid = ce.total <= c.coup + 8, col = good ? '#22c55e' : mid ? '#f59e0b' : '#ef4444';
  g.save(); g.translate(G.cx + pc.x * s, G.cy + pc.y * s); g.rotate(TB.ang * Math.PI / 180);
  g.fillStyle = '#0f172a'; g.strokeStyle = '#3b82f6'; g.lineWidth = 2; rr(g, -36 * s, -75 * s, 72 * s, 150 * s, 9 * s); g.fill(); g.stroke();
  g.fillStyle = '#1e293b'; rr(g, -32 * s, -68 * s, 64 * s, 136 * s, 5 * s); g.fill();
  g.fillStyle = col; g.globalAlpha = .9; g.fillRect((a.x - 20) * s, (a.y - 5) * s, 40 * s, 10 * s); g.globalAlpha = 1;
  g.strokeStyle = '#334155'; g.beginPath(); g.moveTo(0, -75 * s); g.lineTo(0, -69 * s); g.stroke();
  g.fillStyle = '#60a5fa'; g.beginPath(); g.arc(hh.x * s, hh.y * s, 7, 0, 6.2832); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = '#e2e8f0'; g.font = '9px sans-serif'; g.textAlign = 'center'; g.fillText(tr('ANTENA', 'ANTENNA'), a.x * s, (a.y + (a.y <= 0 ? 15 : -8)) * s * 0.9);
  g.restore();
  var aw = rot(a, TB.ang), ax = G.cx + (pc.x + aw.x) * s, ay = G.cy + (pc.y + aw.y) * s;
  g.strokeStyle = '#f59e0b'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(ax, ay); g.lineTo(px, py); g.stroke();
  g.fillStyle = '#0b1220'; g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText(Math.round(TB.ang) + '°  X ' + Math.round(TB.ox) + '  Y ' + Math.round(TB.oy) + ' mm', bx + 8, by + c.bh * s - 8);
}
function setText(id, t) { var e = $(id); if (e) e.textContent = t; }
function setRange(id, v) { var e = $(id); if (e && document.activeElement !== e) e.value = Math.round(v); }
function ui() {
  if (!$('#tb-root')) return;
  setText('#tb-oa', Math.round(TB.ang) + '°'); setText('#tb-ox', Math.round(TB.ox)); setText('#tb-oy', Math.round(TB.oy)); setText('#tb-od', Math.round(dist()));
  setRange('#tb-sa', TB.ang); setRange('#tb-sx', TB.ox); setRange('#tb-sy', TB.oy);
  var t = TB.tele, rs = t ? t.rsrp : null, rEl = $('#tb-rsrp');
  if (rEl) { rEl.textContent = rs == null ? '--' : fnum(rs); rEl.style.color = rs == null ? '' : AL.qi(AL.rk(rs, AL.CFG.thresholds.rsrp)).c; }
  setText('#tb-sinr', t && t.sinr != null ? fnum(t.sinr, 0) : '--');
  var tr_ = trend(), te = $('#tb-trend'); if (te) { te.textContent = (tr_.k === 'up' ? '▲ ' : tr_.k === 'down' ? '▼ ' : '● ') + (tr_.k === 'wait' ? '' : (tr_.d > 0 ? '+' : '') + fnum(tr_.d)); te.style.color = tr_.k === 'up' ? '#22c55e' : tr_.k === 'down' ? '#ef4444' : '#f59e0b'; }
  var ce = coupEst(); setText('#tb-coup', fnum(ce.total) + ' dB');
  setText('#tb-src', t ? (t.src === 'bridge' ? tr('Datos reales: AntenaBridge.getTelemetryJson()', 'Real data: AntenaBridge.getTelemetryJson()') : t.src === 'signal' ? tr('Datos reales de la app (señal)', 'Real app data (signal)') : tr('Modo simulado (sin puente Android): valores de respaldo', 'Simulated mode (no Android bridge): fallback values')) + ' · ' + (t.band || '') + ' ' + (t.f ? t.f + ' MHz' : '') : '');
  setText('#tb-best', TB.best ? TB.best.ang + '° · X ' + TB.best.x + ' / Y ' + TB.best.y + ' mm · ' + fnum(TB.best.rsrp) + ' dBm' : '--');
  var lv = $('#tb-live'); if (lv) lv.textContent = rs == null ? '--' : fnum(rs) + ' dBm';
  var R = TB.run, st = $('#tb-step'), pg = $('#tb-prog'), bt = $('#tb-start');
  if (R) {
    var secs = Math.max(0, Math.ceil(R.left));
    st.textContent = R.phase === 'ang' ? tr('Ángulo ' + (R.i + 1) + '/' + R.ang.length + ': gira el móvil a ' + R.ang[R.i] + '° sobre el acoplador y no lo muevas (' + secs + ' s)', 'Angle ' + (R.i + 1) + '/' + R.ang.length + ': turn the phone to ' + R.ang[R.i] + '° over the coupler and hold still (' + secs + ' s)')
      : tr('Posición ' + (R.i + 1) + '/' + R.pos.length + ': lleva la zona de antena a X ' + R.pos[R.i][0] + ' mm, Y ' + R.pos[R.i][1] + ' mm del acoplador (' + secs + ' s)', 'Position ' + (R.i + 1) + '/' + R.pos.length + ': move the antenna zone to X ' + R.pos[R.i][0] + ' mm, Y ' + R.pos[R.i][1] + ' mm from the coupler (' + secs + ' s)');
    pg.style.width = Math.min(100, (R.done + (1 - R.left / R.dwell)) / R.total * 100) + '%'; if (bt) bt.textContent = tr('Detener alineación', 'Stop alignment');
  } else { if (TB.msg) st.textContent = TB.msg; if (!TB.msg || true) { pg.style.width = TB.msg && TB.msg.indexOf('Sin lecturas') !== 0 && TB.msg.indexOf('No signal') !== 0 ? '100%' : '0%'; } if (bt) bt.textContent = tr('Iniciar alineación', 'Start alignment'); }
  draw();
}
function loop() {
  if (!$('#tb-root') || (AL.S && AL.S.tab !== 'antenas')) return;
  if (TB.run) stepRun(0.2); else if (TB.ta) { ease(); if (Math.abs(TB.ta.ang - TB.ang) < 0.7 && Math.abs(TB.ta.ox - TB.ox) < 0.4 && Math.abs(TB.ta.oy - TB.oy) < 0.4) TB.ta = null; }
  ui();
}
function sampleLoop() { if (!$('#tb-root') || (AL.S && AL.S.tab !== 'antenas')) return; sample(); var lv = $('#tb-live'); if (lv) ui(); }

// ---------- eventos ----------
function stopRun() { if (TB.run) { TB.run = null; TB.msg = tr('Alineación detenida.', 'Alignment stopped.'); } TB.ta = null; }
function onAct(a, el) {
  var c = TB.cfg;
  if (a === 'start') { if (TB.run) { stopRun(); } else { guidedStart(); } }
  else if (a === 'save') savePoint();
  else if (a === 'resetbest') { TB.best = null; TB.rs = []; }
  else if (a === 'a-15') { stopRun(); TB.ang = n360(TB.ang - 15); }
  else if (a === 'a+15') { stopRun(); TB.ang = n360(TB.ang + 15); }
  else if (a === 'a0') { stopRun(); TB.ang = 0; }
  else if (a === 'a180') { stopRun(); TB.ang = 180; }
  else if (a === 'auto') { c.freq = null; saveCfg(); var fi = $('[data-tb="freq"]'); if (fi) fi.value = ''; calc(); }
  else if (a === 'useref') { if (TB.rs.length) { c.ref = r1(mean(TB.rs.slice(-3))); saveCfg(); var ri = $('[data-tb="ref"]'); if (ri) ri.value = c.ref; calc(); toast(tr('Referencia guardada: ' + c.ref + ' dBm (móvil solo)', 'Reference saved: ' + c.ref + ' dBm (phone alone)')); } else toast(tr('Aún no hay lectura', 'No reading yet')); }
  else if (a === 'use') { var p = hist()[parseInt(el.dataset.i, 10)]; if (p) { stopRun(); setTarget(p.ang, p.x, p.y); } }
  else if (a === 'clearhist') { var b = el; if (!TB.armed) { b.textContent = tr('Toca otra vez para confirmar', 'Tap again to confirm'); TB.armed = setTimeout(function () { TB.armed = null; b.textContent = tr('Borrar historial', 'Clear history'); }, 4000); } else { clearTimeout(TB.armed); TB.armed = null; LS.set(K.hist, []); b.textContent = tr('Borrar historial', 'Clear history'); renderHist(); } }
  else if (a === 'share') { var A = window.Android || window.AntenaBridge; if (A && A.shareText) A.shareText('Antena Libre · tablita', JSON.stringify(hist(), null, 1)); else toast(tr('Solo disponible en la app', 'Only available in the app')); }
  ui();
}
function onInput(t) {
  var k = t.dataset.tb, c = TB.cfg, v = parseFloat(t.value);
  if (k === 'ant') { c.ant = t.value; saveCfg(); }
  else if (k === 'dwell') { c.dwell = parseInt(t.value, 10); saveCfg(); }
  else if (k === 'step') { c.step = parseInt(t.value, 10); saveCfg(); }
  else if (k === 'cable') { c.cable = t.value; saveCfg(); }
  else if (k === 'freq') { c.freq = v >= 300 && v <= 7000 ? v : null; saveCfg(); }
  else if (k === 'gain') { if (!(v >= 0 && v <= 30)) return; c.gain = v; saveCfg(); }
  else if (k === 'len') { if (!(v >= 1 && v <= 30)) return; c.len = v; saveCfg(); var lr = $('[data-tb="lenr"]'); if (lr) lr.value = v; }
  else if (k === 'lenr') { c.len = v; saveCfg(); var li = $('[data-tb="len"]'); if (li) li.value = v; }
  else if (k === 'coup') { if (!(v >= 0 && v <= 30)) return; c.coup = v; saveCfg(); }
  else if (k === 'ref') { c.ref = isNaN(v) ? null : v; saveCfg(); }
  calc(); ui();
}
function bindCanvas(cv) {
  function mmAt(e) { var r = cv.getBoundingClientRect(), G = geomPx(cv); return { x: (e.clientX - r.left - G.cx) / G.s, y: (e.clientY - r.top - G.cy) / G.s, s: G.s }; }
  cv.addEventListener('pointerdown', function (e) {
    var m = mmAt(e), pc = phoneCenter(), hh = rot(handleLocal(), TB.ang), hx = pc.x + hh.x, hy = pc.y + hh.y, P = pickup(), aw = rot(antLocal(), TB.ang);
    var pivot = { x: pc.x + aw.x, y: pc.y + aw.y };
    stopRun(); TB.ta = null;
    if (Math.hypot(m.x - hx, m.y - hy) * m.s < 20) { var hl = handleLocal(), al = antLocal(), hv = { x: hl.x - al.x, y: hl.y - al.y }; TB.drag = { mode: 'rot', th: Math.atan2(hv.y, hv.x) * 180 / Math.PI }; }
    else TB.drag = { mode: 'move', gx: m.x - pivot.x, gy: m.y - pivot.y };
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  });
  cv.addEventListener('pointermove', function (e) {
    if (!TB.drag) return; var m = mmAt(e), P = pickup(), d = TB.drag;
    if (d.mode === 'move') { TB.ox = clamp(m.x - d.gx - P.x, -80, 80); TB.oy = clamp(m.y - d.gy - P.y, -80, 80); }
    else { var pc = phoneCenter(), aw = rot(antLocal(), TB.ang), pv = { x: pc.x + aw.x, y: pc.y + aw.y }; TB.ang = n360(Math.atan2(m.y - pv.y, m.x - pv.x) * 180 / Math.PI - d.th); }
    ui();
  });
  ['pointerup', 'pointercancel'].forEach(function (n) { cv.addEventListener(n, function () { TB.drag = null; }); });
}
function mount() {
  var root = $('#tb-root'); if (!root) return;
  var cv = $('#tb-cv'); if (cv) bindCanvas(cv);
  root.addEventListener('click', function (e) { var b = e.target.closest ? e.target.closest('[data-tb-act]') : null; if (b) onAct(b.dataset.tbAct, b); });
  root.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'tb-sa') { stopRun(); TB.ta = null; TB.ang = parseFloat(t.value); ui(); }
    else if (t.id === 'tb-sx') { stopRun(); TB.ta = null; TB.ox = parseFloat(t.value); ui(); }
    else if (t.id === 'tb-sy') { stopRun(); TB.ta = null; TB.oy = parseFloat(t.value); ui(); }
    else if (t.dataset && t.dataset.tb && t.tagName !== 'SELECT') onInput(t);
  });
  root.addEventListener('change', function (e) { var t = e.target; if (t.dataset && t.dataset.tb && t.tagName === 'SELECT') onInput(t); });
  if (!TB.timers) { TB.timers = true; setInterval(loop, 200); setInterval(sampleLoop, 1000); }
  sample(); calc(); renderHist(); ui();
}
AL.tablita = { html: html, mount: mount, api: { calc: calc, advice: advice, budget: budget, start: guidedStart, step: stepRun, sample: sample, save: savePoint, state: TB, coup: coupEst } };
})(window.AL);
