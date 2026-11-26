(function (AL) {
'use strict';
var A = AL.A, $ = AL.$, $$ = AL.$$, tr = AL.L, T = AL.T, LS = AL.LS, esc = AL.esc, S = AL.S, D = AL.D;
var AS = { f: null, sel: null, cable: 3, len: 5, env: 'rural', hm: 6, D: 0.9 };
var BANDS = [[780, '700 MHz (B28)'], [881.5, '850 MHz (B5)'], [942.5, '900 MHz (B8)'], [1842.5, '1800 MHz (B3)'], [2140, '2100 MHz (B1)'], [2655, '2600 MHz (B7)'], [3500, '3500 MHz (n78)'], [2437, 'Wi‑Fi 2.4 GHz'], [5800, 'Wi‑Fi 5.8 GHz']];
function freqNow() { return AS.f || (S.freq && S.freq.f) || 1842.5; }
function tbl(head, rows) {
  return '<div class="tw2"><table><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>';
}
function opt(v, label, cur) { return '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + label + '</option>'; }

// ================= ANTENAS =================
AL.views.ant = {
  render: function () {
    if (AS.sel === '__tab' && AL.tablita) { $('#v-antenas').innerHTML = AL.tablita.html(); AL.tablita.mount(); return; }
    var h = AS.sel ? detail() : list(); $('#v-antenas').innerHTML = h;
  },
  live: function () {}
};
function freqSelect() {
  var f = freqNow(), o = '', cur = S.freq && S.freq.f;
  if (cur) o += opt(cur, tr('Mi banda actual: ', 'My current band: ') + S.freq.label + ' · ' + cur + ' MHz', f);
  BANDS.forEach(function (b) { o += opt(b[0], b[1], f); });
  return '<div class="row"><select data-ch="freq">' + o + '</select><input data-ch="custom" type="number" inputmode="decimal" placeholder="MHz" style="width:90px"></div><div class="muted small">λ = ' + (299792.458 / f).toFixed(1) + ' mm · ' + f + ' MHz</div>';
}
function tabCard() {
  return '<div class="card ac tbc" data-act="tablita"><div class="ah"><b>' + tr('Alineación en tablita y presupuesto de enlace', 'Board alignment and link budget') + '</b><span class="gn">' + tr('Sin conector', 'No connector') + '</span></div><div class="muted small">' + tr('Simulador de giro y posición, balance antena + cable + acople, plano con cotas e historial de puntos óptimos.', 'Rotation and position simulator, antenna + cable + coupling budget, dimensioned plan and best-point history.') + '</div></div>';
}
function list() {
  var f = freqNow(), h = tabCard() + '<h2 class="first">' + tr('Taller de antenas', 'Antenna workshop') + '</h2><p class="muted small">' + tr('Todas las medidas se calculan para la frecuencia elegida. Las Yagi vienen de una simulación electromagnética propia (método de momentos); el resto, de fórmulas estándar. Valores teóricos: en la práctica cuenta 1–2 dB menos.', 'All dimensions are computed for the chosen frequency. The Yagis come from my own electromagnetic simulation (method of moments); the rest from standard formulas. Theoretical values: in practice expect 1–2 dB less.') + '</p>' + freqSelect();
  AL.ANT.forEach(function (a) {
    var b = a.build(f, { D: AS.D });
    h += '<div class="card ac" data-act="ant" data-id="' + a.id + '"><div class="ah"><b>' + T(a.n) + '</b><span class="gn">' + b.g.toFixed(1) + ' dBi</span></div><div class="muted small">' + T(a.use) + '</div><div class="muted small">' + (b.dir ? tr('Direccional · ', 'Directional · ') : tr('Omnidireccional · ', 'Omnidirectional · ')) + b.bw + '</div></div>';
  });
  h += '<p class="muted small">' + tr('Seguridad: no subas a techos con cables eléctricos cerca, usa arnés y pon la antena a tierra si el mástil es metálico (rayos).', 'Safety: stay away from power lines on roofs, use a harness and ground the mast if metal (lightning).') + '</p>';
  return h;
}
function detail() {
  var a = AL.ANT.filter(function (x) { return x.id === AS.sel; })[0], f = freqNow(), b = a.build(f, { D: AS.D }), h = '';
  h += '<button data-act="antBack">← ' + tr('Volver', 'Back') + '</button><h2 class="first">' + T(a.n) + '</h2>' + freqSelect();
  if (a.id === 'dish') h += '<div class="row"><span class="muted small">D:</span><select data-ch="dish">' + [0.6, 0.9, 1.2, 1.5].map(function (d) { return opt(d, d + ' m', AS.D); }).join('') + '</select></div>';
  h += '<div class="card">' + b.svg + '</div>';
  h += '<h3>' + tr('Rendimiento', 'Performance') + '</h3><div class="card rows"><div><span>' + tr('Ganancia', 'Gain') + '</span><b>' + b.g.toFixed(1) + ' dBi</b></div><div><span>' + tr('Haz', 'Beam') + '</span><b>' + b.bw + '</b></div></div>';
  h += '<h3>' + tr('Medidas exactas', 'Exact dimensions') + '</h3>' + tbl(b.head, b.rows);
  h += '<div class="card rows">' + b.facts.map(function (r) { return '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('') + '</div>';
  h += '<h3>' + tr('Materiales', 'Materials') + '</h3><div class="card"><ul>' + b.mats.map(function (m) { return '<li><b>' + m[0] + ':</b> ' + m[1] + '</li>'; }).join('') + '</ul></div>';
  h += '<h3>' + tr('Construcción', 'Build steps') + '</h3><div class="card"><ol>' + b.steps.map(function (s) { return '<li>' + s[0] + '</li>'; }).join('') + '</ol></div><p class="muted small">' + b.note + '</p>';
  // cable
  var c = AL.CABLES[AS.cable], loss = AL.cableLoss(c, f, AS.len) + 2 * AL.CONN_LOSS, net = b.g - loss;
  h += '<h3>' + tr('Cable: tipo y longitud', 'Cable: type and length') + '</h3><div class="row"><select data-ch="cable">' + AL.CABLES.map(function (x, i) { return opt(i, x.id + ' (' + x.z + ' Ω)', AS.cable); }).join('') + '</select><input data-ch="len" type="number" inputmode="decimal" value="' + AS.len + '" style="width:80px"> m</div>';
  h += tbl([tr('Cable', 'Cable'), 'dB/m', tr('3 dB a', '3 dB at'), 'Ø', 'VF'], AL.CABLES.map(function (x) { var pm = AL.cableLoss(x, f, 1); return [x.id, pm.toFixed(2), (3 / pm).toFixed(1) + ' m', x.od + ' mm', x.vf]; }));
  h += '<div class="card rows"><div><span>' + tr('Pérdida del cable + 2 conectores', 'Cable + 2 connectors loss') + '</span><b>' + loss.toFixed(1) + ' dB</b></div><div><span>' + tr('Ganancia neta (antena − pérdida)', 'Net gain (antenna − loss)') + '</span><b style="color:' + (net < 3 ? '#ef4444' : '#22c55e') + '">' + net.toFixed(1) + ' dB</b></div></div>';
  h += '<p>' + tr('<b>Por qué el cable no puede ser más largo:</b> a ' + f + ' MHz cada metro de ' + c.id + ' se come ' + AL.cableLoss(c, f, 1).toFixed(2) + ' dB, y cada 3 dB es la mitad de la potencia. Con ' + AS.len + ' m pierdes ' + loss.toFixed(1) + ' dB' + (loss >= b.g ? ': ¡más de lo que gana la antena!' : '.') + ' La pérdida crece con la frecuencia y la longitud; por eso la antena va lo más cerca posible del módem o se usa cable más grueso (LMR-400/600). ' + c.note[0], '<b>Why the cable can’t be longer:</b> at ' + f + ' MHz every meter of ' + c.id + ' eats ' + AL.cableLoss(c, f, 1).toFixed(2) + ' dB, and every 3 dB halves the power. With ' + AS.len + ' m you lose ' + loss.toFixed(1) + ' dB' + (loss >= b.g ? ': more than the antenna gains!' : '.') + ' Loss grows with frequency and length, so put the antenna as close to the modem as possible or use thicker cable (LMR-400/600). ' + c.note[1]) + '</p>';
  // alcance
  var base = AL.rangeFor(-110, f, AS.env, 30, 1.5, 0, 0), withA = AL.rangeFor(-110, f, AS.env, 30, AS.hm, net, 0), r100 = AL.rangeFor(-100, f, AS.env, 30, AS.hm, net, 0), r120 = AL.rangeFor(-120, f, AS.env, 30, AS.hm, net, 0);
  h += '<h3>' + tr('¿Hasta dónde llega y qué señal capta?', 'How far does it reach and what signal does it get?') + '</h3><div class="row"><select data-ch="env">' + opt('rural', tr('Rural / abierto', 'Rural / open'), AS.env) + opt('suburban', tr('Suburbano', 'Suburban'), AS.env) + opt('urban', tr('Urbano', 'Urban'), AS.env) + '</select><span class="muted small">' + tr('altura antena', 'antenna height') + '</span><input data-ch="hm" type="number" value="' + AS.hm + '" style="width:64px"> m</div>';
  h += '<div class="card rows"><div><span>' + tr('Móvil solo, RSRP -110 dBm hasta', 'Phone alone, RSRP -110 dBm up to') + '</span><b>' + base.toFixed(1) + ' km</b></div><div><span>' + tr('Con esta antena, -100 dBm (buena) hasta', 'With this antenna, -100 dBm (good) up to') + '</span><b>' + r100.toFixed(1) + ' km</b></div><div><span>' + tr('Con esta antena, -110 dBm (usable) hasta', 'With this antenna, -110 dBm (usable) up to') + '</span><b>' + withA.toFixed(1) + ' km</b></div><div><span>' + tr('Con esta antena, -120 dBm (límite) hasta', 'With this antenna, -120 dBm (limit) up to') + '</span><b>' + r120.toFixed(1) + ' km</b></div></div>';
  var rs = S.sig ? (S.sig.rsrp != null ? S.sig.rsrp : S.sig.dbm) : null;
  if (rs != null) h += '<p>' + tr('<b>Tu caso:</b> hoy tienes ' + rs + ' dBm. Con esta antena y este cable ganarías ≈ ' + net.toFixed(1) + ' dB → ≈ <b>' + Math.round(rs + net) + ' dBm</b>.', '<b>Your case:</b> today you have ' + rs + ' dBm. With this antenna and cable you would gain ≈ ' + net.toFixed(1) + ' dB → ≈ <b>' + Math.round(rs + net) + ' dBm</b>.') + '</p>';
  h += '<p class="muted small">' + tr('Estimación con el modelo Okumura‑Hata/COST‑231, torre de 30 m y potencia típica de macrocelda. Árboles, edificios y la carga de la celda cambian el resultado: úsalo como guía, no como garantía.', 'Estimate using the Okumura‑Hata/COST‑231 model, a 30 m tower and typical macro-cell power. Trees, buildings and cell load change the result: use it as a guide, not a guarantee.') + '</p>';
  h += '<p class="muted small">' + tr('Módems 4G con 2 conectores (MIMO): usa 2 antenas separadas ≥ 1 λ (o cruzadas a 90°) con cables de igual longitud.', '4G modems with 2 connectors (MIMO): use 2 antennas ≥ 1 λ apart (or cross-polarised) with cables of equal length.') + '</p>';
  return h;
}
function antChange(k, v) {
  if (k === 'freq') AS.f = parseFloat(v);
  else if (k === 'custom') { var n = parseFloat(v); if (n >= 300 && n <= 7000) AS.f = n; else return; }
  else if (k === 'dish') AS.D = parseFloat(v);
  else if (k === 'cable') AS.cable = parseInt(v, 10);
  else if (k === 'len') { var l = parseFloat(v); if (!(l >= 0 && l <= 200)) return; AS.len = l; }
  else if (k === 'env') AS.env = v;
  else if (k === 'hm') { var m = parseFloat(v); if (!(m >= 1 && m <= 100)) return; AS.hm = m; }
  AL.views.ant.render();
}

// ================= MÁS =================
var MORE = 'menu', sp = null;
AL.views.more = { render: function () { $('#v-mas').innerHTML = moreHtml(); if (MORE === 'wifi') wifiLoad(); } };
function moreHtml() {
  if (MORE === 'menu') return '<h2 class="first">' + tr('Más herramientas', 'More tools') + '</h2><div class="menu">' +
    [['speed', '⚡', tr('Prueba de velocidad', 'Speed test')], ['wifi', '📶', tr('Analizador Wi‑Fi', 'Wi‑Fi analyzer')], ['gloss', '📖', tr('Glosario técnico', 'Technical glossary')], ['tablita', '📐', tr('Alineación en tablita (sin conector)', 'Board alignment (no connector)')], ['settings', '⚙️', tr('Ajustes', 'Settings')], ['about', 'ℹ️', tr('Acerca de y privacidad', 'About and privacy')]]
      .map(function (m) { return '<button data-act="more" data-k="' + m[0] + '"><span>' + m[1] + '</span>' + m[2] + '</button>'; }).join('') + '</div>';
  var back = '<button data-act="more" data-k="menu">← ' + tr('Volver', 'Back') + '</button>';
  if (MORE === 'gloss') return back + '<h2 class="first">' + tr('Glosario técnico', 'Technical glossary') + '</h2>' + AL.GLOSS.map(function (g) { return '<details><summary>' + g[0] + '</summary><p>' + T([g[1], g[2]]) + '</p></details>'; }).join('') +
    '<h2>' + tr('Colores de calidad', 'Quality colors') + '</h2><div class="legend">' + AL.Q.slice().reverse().map(function (x) { return '<span><i style="background:' + x.c + '"></i>' + T(x.n) + '</span>'; }).join('') + '</div><p class="muted small">' + tr('Calidad = el peor entre RSRP y SINR.', 'Quality = the worse of RSRP and SINR.') + '</p>';
  if (MORE === 'speed') return back + '<h2 class="first">' + tr('Prueba de velocidad', 'Speed test') + '</h2><div class="card rows"><div><span>Ping</span><b id="sp-ping">--</b></div><div><span>Jitter</span><b id="sp-jit">--</b></div><div><span>' + tr('Descarga', 'Download') + '</span><b id="sp-down">--</b></div><div><span>' + tr('Subida', 'Upload') + '</span><b id="sp-up">--</b></div></div><button class="primary" data-act="speed" id="spBtn">' + tr('Iniciar prueba', 'Start test') + '</button><div id="sp-msg" class="muted small"></div><p class="muted small">' + tr('Usa servidores de Cloudflare y consume ≈ 25 MB. Si están bloqueados en tu país, la prueba fallará.', 'Uses Cloudflare servers and ≈ 25 MB. If they are blocked in your country, the test will fail.') + '</p><h3>' + tr('Historial', 'History') + '</h3>' + speedHist();
  if (MORE === 'wifi') return back + '<h2 class="first">Wi‑Fi</h2><div id="wifiBox" class="muted">…</div><button data-act="wifiscan">' + tr('Escanear de nuevo', 'Scan again') + '</button>';
  if (MORE === 'settings') return back + '<h2 class="first">' + tr('Ajustes', 'Settings') + '</h2><div class="card"><label class="muted small">' + tr('Idioma', 'Language') + '</label><select data-ch="lang">' + opt('auto', 'Auto', AL.pref) + opt('es', 'Español', AL.pref) + opt('en', 'English', AL.pref) + '</select></div>' +
    '<div class="card"><label class="muted small">' + tr('Clave OpenCelliD (gratis) para ubicar torres', 'OpenCelliD key (free) to locate towers') + '</label><input id="ocid" type="text" value="' + esc(LS.get('al_ocid', '')) + '" placeholder="pk.xxxxxxxx"><button data-act="saveKey" class="primary">' + tr('Guardar clave', 'Save key') + '</button><p class="muted small">' + tr('Regístrate en <a href="https://opencellid.org/">opencellid.org</a>, entra en tu perfil y copia el “API access token”. Solo se envía el identificador de celda a opencellid.org.', 'Sign up at <a href="https://opencellid.org/">opencellid.org</a>, open your profile and copy the “API access token”. Only the cell identifier is sent to opencellid.org.') + '</p></div>' +
    '<label class="chk"><input type="checkbox" id="awake" ' + (LS.get('al_awake', false) ? 'checked' : '') + '> ' + tr('Mantener pantalla encendida (monitoreo continuo)', 'Keep screen on (continuous monitoring)') + '</label><p class="muted small">' + tr('El registro de caídas y puntos funciona mientras la app esté abierta.', 'Outage and point logging works while the app is open.') + '</p>';
  if (MORE === 'about') return back + '<h2 class="first">Antena Libre v' + AL.CFG.version + '</h2><p>' + tr('App gratuita y sin anuncios para medir, entender y mejorar tu señal móvil en cualquier país.', 'Free, ad-free app to measure, understand and improve your mobile signal in any country.') + '</p>' +
    '<h3>' + tr('Privacidad', 'Privacy') + '</h3><p class="muted">' + tr('Tus mediciones, caídas y ubicaciones se guardan solo en tu teléfono. La app no tiene cuentas ni servidores propios. Se conecta a internet únicamente para: teselas de mapa (OpenStreetMap, OpenTopoMap, Esri), la consulta opcional de torres a OpenCelliD (solo el identificador de celda y tu clave) y la prueba de velocidad (Cloudflare). Puedes borrar todo en Mapa → Borrar historial.', 'Your measurements, outages and locations stay on your phone. The app has no accounts or servers of its own. It goes online only for: map tiles (OpenStreetMap, OpenTopoMap, Esri), the optional tower lookup at OpenCelliD (cell identifier and your key only) and the speed test (Cloudflare). You can erase everything in Map → Clear history.') + '</p>' +
    '<h3>' + tr('Límites', 'Limits') + '</h3><p class="muted">' + tr('Las distancias a torres y alcances son estimaciones. Las medidas de antenas son teóricas (simulación y fórmulas estándar); verifica con tu RSRP. Construir y montar antenas es bajo tu responsabilidad.', 'Tower distances and ranges are estimates. Antenna dimensions are theoretical (simulation and standard formulas); verify with your RSRP. Building and mounting antennas is your responsibility.') + '</p>' +
    '<h3>' + tr('Créditos', 'Credits') + '</h3><p class="muted small">© OpenStreetMap contributors · OpenTopoMap · Esri · Leaflet · OpenCelliD (CC BY-SA 4.0) · Cloudflare</p>';
  return '';
}
function speedHist() {
  var h = LS.get('al_speed', []);
  return h.length ? h.slice(0, 8).map(function (x) { return '<div class="ol"><b>' + AL.fmtDate(x.t) + '</b> · ↓ ' + x.down.toFixed(1) + ' · ↑ ' + (x.up == null ? '--' : x.up.toFixed(1)) + ' Mbps · ' + x.ping.toFixed(0) + ' ms<br><span class="muted">' + esc(x.net || '') + (x.rsrp != null ? ' · ' + x.rsrp + ' dBm' : '') + '</span></div>'; }).join('') : '<p class="muted small">' + tr('Sin pruebas todavía.', 'No tests yet.') + '</p>';
}
async function speedRun() {
  var btn = $('#spBtn'), msg = $('#sp-msg'); btn.disabled = true; msg.textContent = tr('Midiendo ping…', 'Measuring ping…');
  var R = { t: Date.now(), net: S.sig ? S.sig.net : '', rsrp: S.sig ? (S.sig.rsrp != null ? S.sig.rsrp : S.sig.dbm) : null, up: null };
  try {
    var pg = [], i;
    for (i = 0; i < 6; i++) { var t0 = performance.now(); await fetch('https://speed.cloudflare.com/__down?bytes=0&r=' + Math.random(), { cache: 'no-store' }); pg.push(performance.now() - t0); }
    pg.shift(); var avg = pg.reduce(function (a, b) { return a + b; }, 0) / pg.length, jit = 0; for (i = 1; i < pg.length; i++) jit += Math.abs(pg[i] - pg[i - 1]); jit /= (pg.length - 1);
    R.ping = avg; $('#sp-ping').textContent = avg.toFixed(0) + ' ms'; $('#sp-jit').textContent = jit.toFixed(0) + ' ms';
    msg.textContent = tr('Midiendo descarga…', 'Measuring download…');
    var ctl = new AbortController(), t1 = performance.now(), bytes = 0, rd = (await fetch('https://speed.cloudflare.com/__down?bytes=25000000&r=' + Math.random(), { cache: 'no-store', signal: ctl.signal })).body.getReader();
    try { for (;;) { var r = await rd.read(); if (r.done) break; bytes += r.value.length; var dt = (performance.now() - t1) / 1000; $('#sp-down').textContent = (bytes * 8 / dt / 1e6).toFixed(1) + ' Mbps'; if (dt > 8) { ctl.abort(); break; } } } catch (e) {}
    R.down = bytes * 8 / ((performance.now() - t1) / 1000) / 1e6; $('#sp-down').textContent = R.down.toFixed(1) + ' Mbps';
    msg.textContent = tr('Midiendo subida…', 'Measuring upload…');
    try { var t2 = performance.now(); await fetch('https://speed.cloudflare.com/__up', { method: 'POST', body: new Uint8Array(2500000), cache: 'no-store' }); R.up = 2500000 * 8 / ((performance.now() - t2) / 1000) / 1e6; $('#sp-up').textContent = R.up.toFixed(1) + ' Mbps'; } catch (e) { $('#sp-up').textContent = '--'; }
    var h = LS.get('al_speed', []); h.unshift(R); h.length = Math.min(h.length, 30); LS.set('al_speed', h);
    msg.textContent = tr('Listo.', 'Done.');
  } catch (e) { msg.textContent = tr('No se pudo conectar con el servidor de pruebas (¿sin internet o bloqueado?).', 'Could not reach the test server (offline or blocked?).'); }
  btn.disabled = false;
}
function wifiLoad() {
  var box = $('#wifiBox'); if (!box) return;
  if (!A) { box.textContent = tr('Solo disponible en la app', 'Only available in the app'); return; }
  var w; try { w = JSON.parse(A.getWifi()); } catch (e) { w = null; }
  if (!w) { box.textContent = '—'; return; }
  var h = '<div class="card rows"><div><span>Wi‑Fi</span><b>' + (w.enabled ? tr('Activado', 'On') : tr('Apagado', 'Off')) + '</b></div>';
  if (w.ssid) h += '<div><span>' + tr('Conectado a', 'Connected to') + '</span><b>' + esc(w.ssid) + '</b></div><div><span>' + tr('Señal / canal / velocidad', 'Signal / channel / speed') + '</span><b>' + w.rssi + ' dBm · ' + AL.wifiChannel(w.freq) + ' · ' + w.speed + ' Mbps</b></div>';
  h += '</div>';
  var sc = (w.scan || []).slice().sort(function (a, b) { return b.rssi - a.rssi; });
  if (!sc.length) h += '<p class="muted small">' + tr('Sin redes visibles (necesita permiso y ubicación activada).', 'No networks visible (needs permission and location turned on).') + '</p>';
  else {
    h += sc.slice(0, 25).map(function (n) { var q = n.rssi >= -55 ? 4 : n.rssi >= -67 ? 3 : n.rssi >= -75 ? 2 : n.rssi >= -85 ? 1 : 0; return '<div class="ol"><b>' + esc(n.ssid || tr('(oculta)', '(hidden)')) + '</b> <span style="color:' + AL.Q[q + 1].c + '">' + n.rssi + ' dBm</span><br><span class="muted">' + (n.freq < 3000 ? '2.4 GHz' : '5 GHz') + ' · ' + tr('canal ', 'channel ') + AL.wifiChannel(n.freq) + '</span></div>'; }).join('');
    var best = null, bs = 1e99;
    [1, 6, 11].forEach(function (c) { var s = 0; sc.forEach(function (n) { var ch = AL.wifiChannel(n.freq); if (n.freq < 3000 && Math.abs(ch - c) <= 2) s += Math.pow(10, n.rssi / 10) * 1e9; }); if (s < bs) { bs = s; best = c; } });
    h += '<p>' + tr('Canal recomendado en 2.4 GHz: <b>' + best + '</b> (el menos congestionado).', 'Recommended 2.4 GHz channel: <b>' + best + '</b> (least congested).') + '</p>';
  }
  box.innerHTML = h;
}

// ================= EVENTOS =================
var ACT = {
  tab: function (e) { AL.showTab(e.dataset.tab); },
  info: function (e) { AL.openSheet(e.dataset.m); },
  closeSheet: function () { AL.closeSheet(); },
  set: function (e) { if (A) A.openSettings(e.dataset.k); else AL.toast(tr('Solo disponible en la app', 'Only available in the app')); },
  perms: function () { if (A) A.requestPerms(); },
  dialer: function () { if (A) A.openDialer('*#*#4636#*#*'); },
  center: function () { AL.views.map.center(); }, fit: function () { AL.views.map.fit(); },
  lookup: function () { AL.lookupNow(); }, estimate: function () { AL.estimateNow(); }, aim: function () { AL.comp.aim(); },
  offline: function () { S.offline = !S.offline; $('#lmap').classList.toggle('hidden', S.offline); $('#offcv').classList.toggle('hidden', !S.offline); AL.views.map.update(true); if (!S.offline) setTimeout(function () { AL.views.map.show(); }, 50); },
  xp: function () { AL.exp.p(); }, xc: function () { AL.exp.c(); }, xj: function () { AL.exp.j(); }, xs: function () { AL.exp.s(); },
  clear: function (e) { AL.clearHistory(e); },
  tset: function () { AL.comp.set(); }, tnow: function () { AL.comp.now(); }, tbest: function () { AL.comp.best(); }, tclr: function () { AL.comp.clr(); },
  ant: function (e) { AS.sel = e.dataset.id; AL.views.ant.render(); $('main').scrollTop = 0; },
  antBack: function () { AS.sel = null; AL.views.ant.render(); },
  tablita: function () { AS.sel = '__tab'; AL.views.ant.render(); $('main').scrollTop = 0; },
  more: function (e) { if (e.dataset.k === 'tablita') { AS.sel = '__tab'; AL.showTab('antenas'); return; } MORE = e.dataset.k; AL.views.more.render(); $('main').scrollTop = 0; },
  speed: function () { speedRun(); },
  wifiscan: function () { if (A) { A.startWifiScan(); AL.toast(tr('Escaneando…', 'Scanning…')); setTimeout(wifiLoad, 3500); } },
  saveKey: function () { LS.set('al_ocid', $('#ocid').value.trim()); AL.toast(tr('Clave guardada', 'Key saved')); }
};
function bindAll() {
  document.addEventListener('click', function (ev) {
    var e = ev.target.closest('[data-act]'); if (!e) return;
    var f = ACT[e.dataset.act]; if (f) f(e);
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'mapLayer') AL.views.map.setLayer(t.value);
    else if (t.id === 'mapFilter') { S.mapFilter = t.value; S.heatN = -1; AL.views.map.update(true); }
    else if (t.name === 'north') S.useTrue = t.value === 'true' && t.checked;
    else if (t.id === 'awake') { if (A) A.keepScreenOn(t.checked); LS.set('al_awake', t.checked); }
    else if (t.dataset.ch === 'lang') { AL.pref = t.value; LS.set('al_lang', t.value); AL.applyLang(); buildAll(); AL.showTab(S.tab); }
    else if (t.dataset.ch) antChange(t.dataset.ch, t.value);
  });
  document.addEventListener('pointerdown', function (ev) {
    if (ev.target.closest('button')) return;
    var el = ev.target.closest('[data-m]'); if (el) AL.core.startHold(el, ev);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { document.addEventListener(n, function () { AL.core.cancelHold(); }, true); });
  document.addEventListener('pointermove', function (ev) { var p = AL.sx(); if (Math.abs(ev.clientX - p.x) > 14 || Math.abs(ev.clientY - p.y) > 14) AL.core.cancelHold(); });
  document.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  $('#sheet').addEventListener('click', function (ev) { if (ev.target.id === 'sheet') AL.closeSheet(); });
}
function buildAll() {
  AL.views.senal.build(); AL.views.map.build(); AL.views.comp.build();
  $$('nav button').forEach(function (b) { var k = b.dataset.tab; b.textContent = { senal: tr('Señal', 'Signal'), mapa: tr('Mapa', 'Map'), brujula: tr('Brújula', 'Compass'), antenas: tr('Antenas', 'Antennas'), mas: tr('Más', 'More') }[k]; });
}
function boot() {
  AL.core.closeStale(); bindAll(); buildAll();
  if (A && LS.get('al_awake', false)) A.keepScreenOn(true);
  AL.core.tick(); setInterval(AL.core.tick, AL.CFG.pollMs); setInterval(AL.views.comp.tick, 120);
}
fetch('../app/config.json').then(function (r) { return r.json(); }).then(function (c) {
  for (var k in c) { if (k === 'thresholds') { for (var t in c.thresholds) AL.CFG.thresholds[t] = c.thresholds[t]; } else AL.CFG[k] = c[k]; }
}).catch(function () {}).then(boot);
})(window.AL);
