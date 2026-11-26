(function (AL) {
'use strict';
var tr = AL.L, T = AL.T, LS = AL.LS, esc = AL.esc, $ = AL.$;
function lam(f) { return 299792.458 / f; }
function mm(x) { return (x < 100 ? x.toFixed(1) : String(Math.round(x))) + ' mm'; }
function m0(x) { return x < 100 ? x.toFixed(1) : String(Math.round(x)); }
function stdRod(l) { var s = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8], t = 0.01 * l, b = s[0], i; for (i = 0; i < s.length; i++) if (Math.abs(s[i] - t) < Math.abs(b - t)) b = s[i]; return b; }
function canD(l, o) { return (o && o.Dmm && o.Dmm > 0.586 * l && o.Dmm < 0.766 * l) ? o.Dmm : 0.70 * l; }

// ================= FOTOS REALES (Wikimedia Commons) =================
var PQ = { dipolo: 'dipole antenna', gp: 'ground plane antenna', yagi3: 'Yagi antenna', yagi5: 'Yagi television antenna', corner: 'corner reflector antenna', cantenna: 'cantenna', dish: 'grid parabolic antenna' };
var PH = { id: null, list: [], idx: 0 };
function stripTags(s) { return String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
function loadPhotos(id, ok, fail) {
  var key = 'al_ph2_' + id, c = LS.get(key, null);
  if (c && c.t && Date.now() - c.t < 30 * 864e5 && c.list && c.list.length) { ok(c.list); return; }
  var url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=' + encodeURIComponent(PQ[id] + ' filetype:bitmap') + '&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=640';
  fetch(url).then(function (r) { return r.json(); }).then(function (j) {
    var pages = j.query && j.query.pages ? Object.keys(j.query.pages).map(function (k) { return j.query.pages[k]; }) : [];
    pages.sort(function (a, b) { return a.index - b.index; });
    var list = [];
    pages.forEach(function (p) {
      var ii = p.imageinfo && p.imageinfo[0]; if (!ii || ii.mime !== 'image/jpeg' || ii.width < 600 || !ii.thumburl) return;
      if (/diagram|svg|pattern|schematic|plot|graph|map|logo|icon|drawing|illustration|animation|simulation|radiation/i.test(p.title)) return;
      var em = ii.extmetadata || {};
      list.push({ thumb: ii.thumburl, page: ii.descriptionurl, title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''), artist: stripTags(em.Artist && em.Artist.value).slice(0, 60), lic: stripTags(em.LicenseShortName && em.LicenseShortName.value) });
    });
    list = list.slice(0, 8);
    if (!list.length) { fail(); return; }
    LS.set(key, { t: Date.now(), list: list }); ok(list);
  }).catch(function () { fail(); });
}
function showPhoto(boxId, capId) {
  var box = $(boxId), cap = capId ? $(capId) : null; if (!box) return;
  var p = PH.list[PH.idx % PH.list.length]; if (!p) return;
  box.innerHTML = '<img alt="' + esc(p.title) + '" src="' + esc(p.thumb) + '">';
  var im = box.querySelector('img'); if (im) im.onerror = function () { box.innerHTML = '<div class="muted small" style="padding:20px;text-align:center">' + tr('No se pudo cargar la foto. Prueba “Otra foto”.', 'Could not load the photo. Try “Another photo”.') + '</div>'; };
  if (cap) cap.innerHTML = esc(p.title) + ' · ' + esc(p.artist || '?') + ' · ' + esc(p.lic || '') + ' · <a href="' + esc(p.page) + '">Wikimedia Commons</a>';
}
function photoInto(id, boxId, capId) {
  var box = $(boxId); if (!box) return;
  PH.id = id; PH.idx = 0;
  loadPhotos(id, function (l) { PH.list = l; showPhoto(boxId, capId); }, function () { box.innerHTML = '<div class="muted small" style="padding:20px;text-align:center">' + tr('Foto no disponible sin internet (se guarda al verla una vez). Mira el dibujo de abajo.', 'Photo unavailable offline (it is cached after one view). See the drawing below.') + '</div>'; });
}

// ================= RECOMENDADOR =================
var NAME = { dipolo: ['Dipolo de media onda', 'Half-wave dipole'], gp: ['Monopolo ground plane', 'Ground-plane monopole'], yagi3: ['Yagi de 3 elementos', '3-element Yagi'], yagi5: ['Yagi de 5 elementos', '5-element Yagi'], corner: ['Reflector de esquina 90°', '90° corner reflector'], cantenna: ['Cantenna', 'Cantenna'], dish: ['Parabólica de rejilla', 'Grid parabolic dish'] };
function gainOf(id, f) { var a = AL.ANT.filter(function (x) { return x.id === id; })[0]; return a ? a.build(f, { D: 0.9 }).g : 0; }
AL.taller = AL.taller || {};
AL.taller.reco = function () {
  var S = AL.S, s = S.sig; if (!s) return null;
  var rs = s.rsrp != null ? s.rsrp : s.dbm; if (rs == null) return null;
  var f = (S.freq && S.freq.f) || 1842.5, tw = S.tow, d = tw ? tw.dist / 1000 : null, dir = tw && tw.bearing != null;
  var need = -95 - rs + 3 + (d != null && d > 8 ? 3 : 0), id;
  if (need <= 0) id = 'gp'; else if (need <= 5.5) id = dir ? 'yagi3' : 'gp'; else if (need <= 7.5) id = f >= 1700 ? 'cantenna' : 'corner'; else if (need <= 9.5) id = 'yagi5'; else id = 'dish';
  var g = gainOf(id, f), net = g - 3;
  var why = need <= 0 ? [tr('Tu señal ya es buena (' + rs + ' dBm). Una antena sencilla omnidireccional solo da estabilidad.', 'Your signal is already good (' + rs + ' dBm). A simple omnidirectional antenna only adds stability.')]
    : [tr('Tu RSRP es ' + rs + ' dBm. Para llegar a -95 dBm (buena) necesitas ≈ +' + need.toFixed(0) + ' dB netos' + (d != null && d > 8 ? ' (la torre está lejos: ' + AL.fmtDist(tw.dist) + ')' : '') + '. Esta antena aporta ≈ ' + g.toFixed(1) + ' dBi (≈ +' + net.toFixed(1) + ' dB netos con cable corto y acople).', 'Your RSRP is ' + rs + ' dBm. To reach -95 dBm (good) you need ≈ +' + need.toFixed(0) + ' dB net' + (d != null && d > 8 ? ' (the tower is far: ' + AL.fmtDist(tw.dist) + ')' : '') + '. This antenna gives ≈ ' + g.toFixed(1) + ' dBi (≈ +' + net.toFixed(1) + ' dB net with short cable and coupling).')];
  if (need > 0 && need <= 5.5 && !dir) why.push(tr('Como aún no se conoce la dirección de la torre, empieza con una omnidireccional; cuando la ubiques (Mapa / Brújula) pasa a una Yagi.', 'Since the tower direction is not known yet, start with an omnidirectional; once you locate it (Map / Compass) move up to a Yagi.'));
  if (id === 'cantenna') why.push(tr('Cantenna: compacta y fácil porque la banda es ≥ 1.7 GHz.', 'Cantenna: compact and easy because the band is ≥ 1.7 GHz.'));
  if (f < 1000 && id !== 'gp') why.push(tr('Banda baja (' + f + ' MHz): las piezas serán grandes porque la longitud de onda es larga.', 'Low band (' + f + ' MHz): parts will be large because the wavelength is long.'));
  return { id: id, why: why, need: need, g: g };
};
AL.taller.recoHtml = function () {
  var r = AL.taller.reco(); if (!r) return '<div class="card"><div class="muted small">' + tr('Abre la pestaña Señal unos segundos para que la app te recomiende una antena según tu RSRP, tu banda y la torre.', 'Open the Signal tab for a few seconds so the app can recommend an antenna from your RSRP, band and tower.') + '</div></div>';
  return '<div class="card tbc"><div class="ah"><b>⭐ ' + tr('Recomendada para tu señal', 'Recommended for your signal') + '</b><span class="gn">' + r.g.toFixed(1) + ' dBi</span></div><div id="ph-reco" class="phbox small"></div><div style="font-weight:700;margin:6px 0">' + T(NAME[r.id]) + '</div>' + r.why.map(function (w) { return '<div class="muted small" style="margin-bottom:4px">' + w + '</div>'; }).join('') + '<button class="primary" data-act="ant" data-id="' + r.id + '">' + tr('Ver planos y guía paso a paso', 'See plans and step-by-step guide') + '</button></div>';
};
AL.taller.photoHtml = function () {
  return '<div class="card"><div id="ph-box" class="phbox">' + tr('Cargando foto real…', 'Loading real photo…') + '</div><div id="ph-cap" class="muted small" style="margin-top:6px"></div><button data-act="phNext" style="margin-top:6px">' + tr('Otra foto', 'Another photo') + '</button></div>';
};
AL.taller.nextPhoto = function () { if (PH.list.length) { PH.idx++; showPhoto('#ph-box', '#ph-cap'); } };
AL.taller.mount = function (selId) {
  if ($('#ph-reco')) { var r = AL.taller.reco(); if (r) photoInto(r.id, '#ph-reco', null); }
  if (selId && $('#ph-box')) photoInto(selId, '#ph-box', '#ph-cap');
};

// ================= PLANOS DE TALLER (con cotas en mm) =================
function dimH(x1, x2, y, t) { return '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="#f59e0b"/><line x1="' + x1 + '" y1="' + (y - 4) + '" x2="' + x1 + '" y2="' + (y + 4) + '" stroke="#f59e0b"/><line x1="' + x2 + '" y1="' + (y - 4) + '" x2="' + x2 + '" y2="' + (y + 4) + '" stroke="#f59e0b"/><text x="' + ((x1 + x2) / 2) + '" y="' + (y - 4) + '" fill="#f59e0b" font-size="9" text-anchor="middle">' + t + '</text>'; }
function dimV(x, y1, y2, t) { return '<line x1="' + x + '" y1="' + y1 + '" x2="' + x + '" y2="' + y2 + '" stroke="#f59e0b"/><line x1="' + (x - 4) + '" y1="' + y1 + '" x2="' + (x + 4) + '" y2="' + y1 + '" stroke="#f59e0b"/><line x1="' + (x - 4) + '" y1="' + y2 + '" x2="' + (x + 4) + '" y2="' + y2 + '" stroke="#f59e0b"/><text transform="translate(' + (x - 4) + ',' + ((y1 + y2) / 2) + ') rotate(-90)" fill="#f59e0b" font-size="9" text-anchor="middle">' + t + '</text>'; }
function txt(x, y, t, c, a) { return '<text x="' + x + '" y="' + y + '" fill="' + (c || '#cbd5e1') + '" font-size="9" text-anchor="' + (a || 'middle') + '">' + t + '</text>'; }
function wrap(vh, inner) { return '<svg viewBox="0 0 340 ' + vh + '" class="ant">' + inner + '</svg>'; }

function shop(id, f, o) {
  var l = lam(f), rod = stdRod(l), cut = [], svg = '', note = '', Y;
  if (id === 'yagi3' || id === 'yagi5') {
    Y = AL.YAGIS[id]; var boom = Y.X[Y.X.length - 1] * l, sx = 290 / boom, mx = Math.max.apply(null, Y.L) * l, sy = 90 / mx, s = '';
    s += '<line x1="24" y1="105" x2="' + (24 + boom * sx) + '" y2="105" stroke="#94a3b8" stroke-width="5"/>';
    Y.L.forEach(function (L_, i) {
      var x = 24 + Y.X[i] * l * sx, len = L_ * l, nm = i === 0 ? 'R' : i === 1 ? 'D' : 'd' + (i - 1), col = i === 0 ? '#f97316' : i === 1 ? '#22c55e' : '#3b82f6';
      s += '<line x1="' + x + '" y1="' + (105 - len * sy / 2) + '" x2="' + x + '" y2="' + (105 + len * sy / 2) + '" stroke="' + col + '" stroke-width="4" stroke-linecap="round"/>' + txt(x, 172, nm, col) + txt(x, 183, m0(len), col);
      cut.push([nm === 'R' ? tr('Reflector', 'Reflector') : nm === 'D' ? tr('Activo (2 brazos)', 'Driven (2 arms)') : tr('Director ', 'Director ') + nm.slice(1), 1, mm(len), nm === 'D' ? tr('Cortar en dos brazos de ' + mm((len - 0.02 * l) / 2) + ' con separación ' + mm(0.02 * l), 'Cut in two arms of ' + mm((len - 0.02 * l) / 2) + ' with gap ' + mm(0.02 * l)) : tr('Varilla Ø ' + rod + ' mm', 'Rod Ø ' + rod + ' mm')]);
      if (i > 0) s += dimH(24 + Y.X[i - 1] * l * sx, x, 200, m0((Y.X[i] - Y.X[i - 1]) * l));
    });
    s += dimH(24, 24 + boom * sx, 218, tr('Posición total ', 'Total position ') + mm(boom));
    s += txt(170, 12, tr('Plano de taller · cotas en mm · vista lateral', 'Shop drawing · dimensions in mm · side view'), '#94a3b8');
    svg = wrap(232, s);
    cut.push([tr('Travesaño (boom)', 'Boom'), 1, mm(boom + 40), tr('Madera seca/PVC ≈ 20 mm; 20 mm de sobra en cada extremo', 'Dry wood/PVC ≈ 20 mm; 20 mm spare each end')]);
    cut.push([tr('Posiciones de taladro', 'Drill positions'), Y.L.length, Y.X.map(function (x) { return m0(x * l + 20); }).join(' · '), tr('Desde el extremo del reflector (ya incluye los 20 mm de sobra)', 'From the reflector end (includes the 20 mm spare)')]);
  } else if (id === 'dipolo') {
    var tot = 0.47 * l, gap = 0.02 * l, arm = (tot - gap) / 2, k = 120 / arm, s2 = '';
    s2 += '<line x1="' + (170 - gap * k / 2) + '" y1="80" x2="' + (170 - gap * k / 2 - arm * k) + '" y2="80" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/><line x1="' + (170 + gap * k / 2) + '" y1="80" x2="' + (170 + gap * k / 2 + arm * k) + '" y2="80" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/>';
    s2 += dimH(170 - gap * k / 2 - arm * k, 170 - gap * k / 2, 62, mm(arm)) + dimH(170 + gap * k / 2, 170 + gap * k / 2 + arm * k, 62, mm(arm)) + dimH(165, 175, 100, mm(gap)) + dimH(170 - gap * k / 2 - arm * k, 170 + gap * k / 2 + arm * k, 120, mm(tot)) + txt(170, 12, tr('Plano de taller · dipolo', 'Shop drawing · dipole'), '#94a3b8');
    svg = wrap(136, s2);
    cut.push([tr('Brazos', 'Arms'), 2, mm(arm + 10), tr('Cortar +10 mm y limar hasta ' + mm(arm), 'Cut +10 mm and file down to ' + mm(arm))], [tr('Soporte aislante', 'Insulating support'), 1, mm(gap + 60), tr('Plástico/madera', 'Plastic/wood')]);
  } else if (id === 'gp') {
    var rad = 0.235 * l, ra = 0.25 * l, s3 = '';
    s3 += '<line x1="170" y1="30" x2="170" y2="110" stroke="#22c55e" stroke-width="5"/><line x1="170" y1="110" x2="95" y2="160" stroke="#3b82f6" stroke-width="3"/><line x1="170" y1="110" x2="245" y2="160" stroke="#3b82f6" stroke-width="3"/><circle cx="170" cy="110" r="4" fill="#f97316"/>';
    s3 += dimV(190, 30, 110, mm(rad)) + dimH(95, 170, 176, mm(ra) + ' (×4)') + txt(135, 125, '45°', '#f59e0b') + txt(170, 14, tr('Plano de taller · ground plane', 'Shop drawing · ground plane'), '#94a3b8');
    svg = wrap(190, s3);
    cut.push([tr('Radiador', 'Radiator'), 1, mm(rad + 10), tr('Limar hasta ' + mm(rad), 'File down to ' + mm(rad))], [tr('Radiales', 'Radials'), 4, mm(ra + 10), tr('Limar hasta ' + mm(ra), 'File down to ' + mm(ra))], [tr('Conector de panel N/SO-239 (4 agujeros)', 'Panel connector N/SO-239 (4 holes)'), 1, '—', '']);
  } else if (id === 'corner') {
    var dip = 0.47 * l, S = 0.5 * l, H = Math.max(0.65 * l, 1.2 * dip), W = l, s4 = '', sc = 100 / Math.max(W, H);
    s4 += '<rect x="20" y="30" width="' + (W * sc) + '" height="' + (H * sc) + '" fill="rgba(59,130,246,.15)" stroke="#3b82f6" stroke-width="2"/>' + dimH(20, 20 + W * sc, 24, mm(W)) + dimV(14, 30, 30 + H * sc, mm(H)) + txt(20 + W * sc / 2, 30 + H * sc / 2, tr('placa ×2', 'plate ×2'), '#60a5fa');
    var vx = 190, vy = 90;
    s4 += '<line x1="' + vx + '" y1="' + vy + '" x2="' + (vx + 120) + '" y2="' + (vy - 70) + '" stroke="#3b82f6" stroke-width="3"/><line x1="' + vx + '" y1="' + vy + '" x2="' + (vx + 120) + '" y2="' + (vy + 70) + '" stroke="#3b82f6" stroke-width="3"/>';
    var dsx = vx + S * 100 / W * 1.2; s4 += '<circle cx="' + dsx + '" cy="' + vy + '" r="4" fill="#22c55e"/>' + dimH(vx, dsx, vy + 22, 'S = ' + mm(S)) + txt(vx + 6, vy + 4, '90°', '#f59e0b', 'start') + txt(250, 14, tr('Vista superior', 'Top view'), '#94a3b8') + txt(70, 14, tr('Placa plana', 'Flat plate'), '#94a3b8');
    svg = wrap(190, s4);
    cut.push([tr('Placas reflectoras', 'Reflector plates'), 2, mm(W) + ' × ' + mm(H), tr('Chapa o malla con huecos ≤ ' + mm(0.1 * l), 'Sheet or mesh with gaps ≤ ' + mm(0.1 * l))], [tr('Brazos del dipolo', 'Dipole arms'), 2, mm((dip - 0.02 * l) / 2 + 10), tr('Limar hasta ' + mm((dip - 0.02 * l) / 2), 'File down to ' + mm((dip - 0.02 * l) / 2))], [tr('Soporte aislante del dipolo', 'Dipole insulating support'), 1, mm(0.02 * l + 60), '']);
  } else if (id === 'cantenna') {
    var D = canD(l, o), lc = 1.706 * D, lg = l / Math.sqrt(1 - (l / lc) * (l / lc)), Lc = 0.75 * lg, Pp = lg / 4, pr = l / 4, k5 = 250 / Lc, s5 = '';
    s5 += '<rect x="40" y="50" width="' + (Lc * k5) + '" height="80" rx="4" fill="rgba(59,130,246,.12)" stroke="#3b82f6" stroke-width="3"/><line x1="' + (40 + Pp * k5) + '" y1="130" x2="' + (40 + Pp * k5) + '" y2="' + (130 - pr * k5 * 0.9 > 52 ? 130 - pr * k5 * 0.9 : 52) + '" stroke="#22c55e" stroke-width="3"/><circle cx="' + (40 + Pp * k5) + '" cy="134" r="3" fill="#f97316"/>';
    s5 += dimH(40, 40 + Lc * k5, 42, 'L = ' + mm(Lc)) + dimH(40, 40 + Pp * k5, 152, 'P = ' + mm(Pp)) + dimV(32, 50, 130, 'D = ' + mm(D)) + txt(40 + Pp * k5 + 36, 112, tr('sonda ' + mm(pr), 'probe ' + mm(pr)), '#22c55e') + txt(170, 14, tr('Plano de taller · cantenna (corte lateral)', 'Shop drawing · cantenna (side cut)'), '#94a3b8');
    svg = wrap(170, s5);
    cut.push([tr('Tubo / bote', 'Tube / can'), 1, 'Ø ' + mm(D) + ' × ' + mm(Lc), tr('Diámetro INTERIOR; cerrado en el fondo', 'INNER diameter; closed at the back')], [tr('Tapa del fondo', 'Back cap'), 1, 'Ø ' + mm(D + 10), tr('Metal, soldada o remachada sin huecos', 'Metal, soldered or riveted with no gaps')], [tr('Sonda (alambre de cobre rígido)', 'Probe (stiff copper wire)'), 1, mm(pr + 8), tr('λ/4 + 8 mm para soldar al pin', 'λ/4 + 8 mm to solder to the pin')], [tr('Agujero del conector', 'Connector hole'), 1, mm(Pp) + ' ' + tr('del fondo', 'from back'), tr('Medido por dentro', 'Measured on the inside')]);
  } else if (id === 'dish') {
    var Dd = (o && o.D) || 0.9, fl = 0.4 * Dd, k6 = 250 / Dd, pts = [], i2, s6 = '', rows = [];
    for (i2 = -10; i2 <= 10; i2++) { var xx = i2 / 10 * Dd / 2, yy = xx * xx / (4 * fl); pts.push((170 + xx * k6).toFixed(1) + ',' + (60 + yy * k6 * 1.0).toFixed(1)); }
    s6 += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#3b82f6" stroke-width="3"/><circle cx="170" cy="' + (60 + fl * k6) + '" r="5" fill="#f97316"/>';
    s6 += dimH(170 - Dd * k6 / 2, 170 + Dd * k6 / 2, 40, 'D = ' + m0(Dd * 1000) + ' mm') + dimV(190, 60, 60 + fl * k6, 'f = ' + m0(fl * 1000) + ' mm') + txt(170, 14, tr('Plano de taller · perfil de la costilla', 'Shop drawing · rib profile'), '#94a3b8');
    svg = wrap(60 + Math.round(fl * k6) + 20, s6);
    [0, 0.125, 0.25, 0.375, 0.5].forEach(function (u) { var x = u * Dd, y = x * x / (4 * fl); rows.push([m0(x * 1000), m0(y * 1000)]); });
    cut.push([tr('Costillas (plantilla)', 'Ribs (template)'), 2, tr('Perfil: ', 'Profile: ') + rows.map(function (r) { return '(' + r[0] + ', ' + r[1] + ')'; }).join(' '), tr('Pares (x desde el centro, profundidad) en mm; lado a lado', 'Pairs (x from center, depth) in mm; each side')], [tr('Malla/rejilla', 'Mesh/grid'), 1, m0(Dd * 1000 + 60) + ' mm Ø', tr('Huecos ≤ ' + mm(0.1 * l), 'Gaps ≤ ' + mm(0.1 * l))], [tr('Tubo del alimentador (no metálico)', 'Feed tube (non-metallic)'), 1, mm(fl * 1000 + 50), ''], [tr('Disco reflector del alimentador', 'Feed reflector disc'), 1, 'Ø ' + mm(0.6 * l), tr('A ' + mm(0.25 * l) + ' detrás del dipolo', mm(0.25 * l) + ' behind the dipole')], [tr('Brazos del dipolo del alimentador', 'Feed dipole arms'), 2, mm((0.47 * l - 0.02 * l) / 2 + 10), '']);
  }
  cut.push([tr('Coaxial', 'Coax'), 1, '—', tr('Largo según tu montaje (ver Cable); +10 cm de sobra', 'Length per your setup (see Cable); +10 cm spare')]);
  return { svg: svg, cut: cut, rod: rod };
}
AL.taller.shopHtml = function (id, f, o) {
  var s = shop(id, f, o);
  return '<h3>' + tr('Plano de taller y lista de corte', 'Shop drawing and cut list') + '</h3><div class="card">' + s.svg + '</div><div class="tw2"><table><tr><th>' + tr('Pieza', 'Piece') + '</th><th>' + tr('Cant.', 'Qty') + '</th><th>' + tr('Medida', 'Size') + '</th><th>' + tr('Nota', 'Note') + '</th></tr>' + s.cut.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>'; }).join('') + '</table></div><p class="muted small">' + tr('Varilla recomendada Ø ' + s.rod + ' mm (≈ 0.01 λ). Si usas otro grosor dentro de ±30 %, las medidas casi no cambian.', 'Recommended rod Ø ' + s.rod + ' mm (≈ 0.01 λ). If you use another thickness within ±30 %, dimensions barely change.') + '</p>';
};

// ================= GUÍAS PASO A PASO =================
var META = { dipolo: [1, '1–2'], gp: [1, '1–2'], yagi3: [2, '2–3'], yagi5: [3, '3–5'], corner: [2, '3–4'], cantenna: [2, '2–3'], dish: [4, '6–10'] };
function st(t, d, ok) { return { t: t, d: d, ok: ok }; }
function specific(id, f, o, l, rod) {
  var S = [], arm, gap = 0.02 * l;
  if (id === 'dipolo') {
    arm = (0.47 * l - gap) / 2;
    S.push(st(tr('Corta los dos brazos', 'Cut the two arms'), tr('1) Marca ' + mm(arm + 10) + ' en la varilla con lápiz fino.<br>2) Corta recto con sierra o alicate de corte.<br>3) Repite para el segundo brazo y compáralos lado a lado.<br>4) Lima el extremo hasta que cada brazo mida exactamente <b>' + mm(arm) + '</b> (±0.5 mm).', '1) Mark ' + mm(arm + 10) + ' on the rod with a fine pencil.<br>2) Cut straight with a saw or cutters.<br>3) Repeat for the second arm and compare them side by side.<br>4) File the end until each arm is exactly <b>' + mm(arm) + '</b> (±0.5 mm).'), tr('Los dos brazos miden lo mismo con el calibre o la regla.', 'Both arms measure the same with the caliper or ruler.')));
    S.push(st(tr('Monta los brazos en el soporte', 'Mount the arms on the support'), tr('1) Fija los brazos en línea recta sobre el listón/PVC con bridas.<br>2) Deja entre las puntas internas una separación de <b>' + mm(gap) + '</b>.<br>3) Mide la separación con regla y ajusta.', '1) Fix the arms in a straight line on the batten/PVC with zip ties.<br>2) Leave a gap of <b>' + mm(gap) + '</b> between the inner tips.<br>3) Measure the gap with a ruler and adjust.'), tr('Los brazos están alineados y la separación es la correcta.', 'Arms are aligned and the gap is right.')));
  } else if (id === 'gp') {
    var rad = 0.235 * l, ra = 0.25 * l;
    S.push(st(tr('Prepara radiador y radiales', 'Prepare radiator and radials'), tr('1) Corta 1 varilla de ' + mm(rad + 10) + ' y 4 de ' + mm(ra + 10) + '.<br>2) Lima hasta ' + mm(rad) + ' el radiador y ' + mm(ra) + ' los radiales.<br>3) Estaña 5 mm de un extremo de cada una (calienta la varilla 3 s y deja correr el estaño).', '1) Cut 1 rod of ' + mm(rad + 10) + ' and 4 of ' + mm(ra + 10) + '.<br>2) File the radiator to ' + mm(rad) + ' and radials to ' + mm(ra) + '.<br>3) Tin 5 mm at one end of each (heat the rod 3 s and let the solder flow).'), tr('Cada pieza tiene un extremo estañado y la medida correcta.', 'Each piece has a tinned end and the right length.')));
    S.push(st(tr('Suelda al conector de panel', 'Solder to the panel connector'), tr('1) Suelda el radiador al pin central del conector, perfectamente vertical.<br>2) Suelda cada radial a uno de los 4 agujeros de la brida.<br>3) Dobla los radiales a 135° del radiador (45° hacia abajo) con alicate.', '1) Solder the radiator to the connector’s center pin, perfectly vertical.<br>2) Solder each radial to one of the 4 flange holes.<br>3) Bend the radials to 135° from the radiator (45° downward) with pliers.'), tr('Con el multímetro: pin central y brida NO tienen continuidad entre sí.', 'With the multimeter: center pin and flange have NO continuity between them.')));
  } else if (id === 'yagi3' || id === 'yagi5') {
    var Y = AL.YAGIS[id], boom = Y.X[Y.X.length - 1] * l;
    S.push(st(tr('Corta y rotula los elementos', 'Cut and label the elements'), tr('1) Corta cada varilla con +10 mm de sobra.<br>2) Lima hasta la medida de la lista de corte y rotula con cinta: R (reflector), D (activo), d1, d2…<br>3) Tabla: ' + Y.L.map(function (x, i) { return (i === 0 ? 'R' : i === 1 ? 'D' : 'd' + (i - 1)) + ' = ' + mm(x * l); }).join(' · '), '1) Cut each rod with +10 mm spare.<br>2) File to the cut-list size and label with tape: R (reflector), D (driven), d1, d2…<br>3) Table: ' + Y.L.map(function (x, i) { return (i === 0 ? 'R' : i === 1 ? 'D' : 'd' + (i - 1)) + ' = ' + mm(x * l); }).join(' · ')), tr('Todos los elementos están rotulados y medidos.', 'All elements are labeled and measured.')));
    S.push(st(tr('Marca y taladra el travesaño', 'Mark and drill the boom'), tr('1) Corta el boom a ' + mm(boom + 40) + '.<br>2) Desde el extremo del reflector marca: ' + Y.X.map(function (x) { return m0(x * l + 20) + ' mm'; }).join(', ') + '.<br>3) Pega una tira de papel con las marcas como plantilla y taladra perpendicular al boom con broca Ø ' + (rod + 0.5) + ' mm.', '1) Cut the boom to ' + mm(boom + 40) + '.<br>2) From the reflector end mark: ' + Y.X.map(function (x) { return m0(x * l + 20) + ' mm'; }).join(', ') + '.<br>3) Tape a paper strip with the marks as a template and drill perpendicular to the boom with a Ø ' + (rod + 0.5) + ' mm bit.'), tr('Los agujeros están alineados: mira el boom de punta a punta.', 'Holes are aligned: sight along the boom.')));
    S.push(st(tr('Fija los elementos pasivos', 'Fix the passive elements'), tr('1) Pasa R y los directores por sus agujeros.<br>2) Centra cada uno: mide la misma longitud a cada lado del boom.<br>3) Fija con epoxi o silicona; deja secar.<br>4) Comprueba que todos son paralelos entre sí y perpendiculares al boom.', '1) Pass R and the directors through their holes.<br>2) Center each: same length each side of the boom.<br>3) Fix with epoxy or silicone; let dry.<br>4) Check all are parallel to each other and perpendicular to the boom.'), tr('Vistos desde el frente, los elementos parecen una sola línea.', 'Seen from the front, the elements look like a single line.')));
    S.push(st(tr('Elemento activo y alimentación', 'Driven element and feed'), tr('1) Corta D en dos brazos de ' + mm((Y.L[1] * l - gap) / 2) + ' (la medida completa ' + mm(Y.L[1] * l) + ' incluye la separación de ' + mm(gap) + ').<br>2) Fíjalos sobre un soporte plástico en la posición del activo, alineados y con la separación.<br>3) Suelda la malla del coaxial a un brazo y el vivo al otro.', '1) Cut D into two arms of ' + mm((Y.L[1] * l - gap) / 2) + ' (the full ' + mm(Y.L[1] * l) + ' includes the ' + mm(gap) + ' gap).<br>2) Fix them on a plastic holder at the driven position, aligned and with the gap.<br>3) Solder the coax shield to one arm and the center conductor to the other.'), tr('Sin continuidad entre los dos brazos; sí entre malla-brazo A y vivo-brazo B.', 'No continuity between the two arms; yes shield–arm A and center–arm B.')));
  } else if (id === 'corner') {
    var dip = 0.47 * l, S_ = 0.5 * l, H = Math.max(0.65 * l, 1.2 * dip), W = l;
    S.push(st(tr('Corta las placas', 'Cut the plates'), tr('1) Dibuja dos rectángulos de ' + mm(W) + ' × ' + mm(H) + '.<br>2) Corta con tijera de chapa o cizalla (si es malla, con alicate y refuérzala con marco de listón).<br>3) Lima los bordes: no deben cortar.', '1) Draw two rectangles of ' + mm(W) + ' × ' + mm(H) + '.<br>2) Cut with tin snips or shears (for mesh, use cutters and reinforce with a batten frame).<br>3) File the edges so they don’t cut.'), tr('Las dos placas son iguales.', 'Both plates are identical.')));
    S.push(st(tr('Únelas a 90°', 'Join them at 90°'), tr('1) Une los lados H con una escuadra exacta de 90°.<br>2) Tornillos o remaches cada 10–15 cm; la unión debe hacer contacto eléctrico.<br>3) Marca el vértice y mide ' + mm(S_) + ' hacia afuera sobre la bisectriz.', '1) Join the H sides with an exact 90° square.<br>2) Screws or rivets every 10–15 cm; the seam must make electrical contact.<br>3) Mark the vertex and measure ' + mm(S_) + ' outward along the bisector.'), tr('Con la escuadra entre placas no pasa luz.', 'No light passes under the square between plates.')));
    S.push(st(tr('Coloca el dipolo', 'Place the dipole'), tr('1) Dipolo: dos brazos de ' + mm((dip - gap) / 2) + ' con separación ' + mm(gap) + ' (como el dipolo de media onda).<br>2) Móntalo VERTICAL, paralelo al vértice, a ' + mm(S_) + ', centrado en altura (' + mm(H / 2) + ').<br>3) Saca el coaxial por detrás con el choke.', '1) Dipole: two arms of ' + mm((dip - gap) / 2) + ' with gap ' + mm(gap) + ' (like the half-wave dipole).<br>2) Mount it VERTICAL, parallel to the vertex, at ' + mm(S_) + ', centered in height (' + mm(H / 2) + ').<br>3) Run the coax out the back with the choke.'), tr('La distancia dipolo–vértice es ' + mm(S_) + ' arriba y abajo.', 'Dipole–vertex distance is ' + mm(S_) + ' at top and bottom.')));
  } else if (id === 'cantenna') {
    var D = canD(l, o), lc = 1.706 * D, lg = l / Math.sqrt(1 - (l / lc) * (l / lc)), Lc = 0.75 * lg, Pp = lg / 4, pr = l / 4;
    S.push(st(tr('Consigue y prepara el tubo', 'Get and prepare the tube'), tr('1) Necesitas un bote/tubo metálico de diámetro INTERIOR ≈ <b>' + mm(D) + '</b> (válido de ' + mm(0.586 * l) + ' a ' + mm(0.766 * l) + '). Mide con calibre por dentro.<br>2) Si tu bote es de otro diámetro, escríbelo arriba en “Mi bote mide…” y la app recalcula.<br>3) Largo del tubo: <b>' + mm(Lc) + '</b>. Quita la pintura/aceite del interior con lija.', '1) You need a metal can/tube with INNER diameter ≈ <b>' + mm(D) + '</b> (valid from ' + mm(0.586 * l) + ' to ' + mm(0.766 * l) + '). Measure inside with a caliper.<br>2) If your can has another diameter, type it above in “My can measures…” and the app recalculates.<br>3) Tube length: <b>' + mm(Lc) + '</b>. Sand off paint/oil inside.'), tr('El diámetro interior está dentro del rango válido.', 'Inner diameter is inside the valid range.')));
    S.push(st(tr('Cierra el fondo', 'Close the back'), tr('1) Corta una tapa metálica de Ø ' + mm(D + 10) + ' y suéldala o remáchala al fondo.<br>2) No debe quedar ningún hueco (cubre con cinta de aluminio y estaño si hace falta).', '1) Cut a metal cap of Ø ' + mm(D + 10) + ' and solder or rivet it to the back.<br>2) No gaps may remain (cover with aluminium tape and solder if needed).'), tr('Sin huecos de luz en el fondo.', 'No light gaps at the back.')));
    S.push(st(tr('Agujero y conector', 'Hole and connector'), tr('1) Mide por dentro <b>' + mm(Pp) + '</b> desde el fondo y marca en la pared lateral.<br>2) Taladra del tamaño de tu conector (N panel ≈ 16 mm; SMA ≈ 6.5 mm).<br>3) Monta el conector con su tuerca y arandela.', '1) Measure <b>' + mm(Pp) + '</b> inside from the back and mark on the side wall.<br>2) Drill to your connector size (N panel ≈ 16 mm; SMA ≈ 6.5 mm).<br>3) Mount the connector with its nut and washer.'), tr('El conector queda firme y a ' + mm(Pp) + ' del fondo.', 'Connector is firm and ' + mm(Pp) + ' from the back.')));
    S.push(st(tr('Suelda la sonda', 'Solder the probe'), tr('1) Corta alambre de cobre rígido de ' + mm(pr + 8) + '.<br>2) Suelda 8 mm al pin central y deja <b>' + mm(pr) + '</b> libres, perpendicular al eje del tubo.<br>3) Comprueba con la regla que el alambre libre mide ' + mm(pr) + '.', '1) Cut stiff copper wire of ' + mm(pr + 8) + '.<br>2) Solder 8 mm to the center pin and leave <b>' + mm(pr) + '</b> free, perpendicular to the tube axis.<br>3) Check with a ruler that the free wire is ' + mm(pr) + '.'), tr('La sonda no toca las paredes.', 'The probe doesn’t touch the walls.')));
  } else if (id === 'dish') {
    var Dd = (o && o.D) || 0.9, fl = 0.4 * Dd;
    S.push(st(tr('Haz las plantillas de costilla', 'Make the rib templates'), tr('1) En cartón o contrachapado dibuja el perfil con la tabla de la lista de corte (x desde el centro, profundidad).<br>2) Une los puntos con una curva suave y recorta 2 costillas iguales de ' + m0(Dd * 1000) + ' mm de ancho.', '1) On cardboard or plywood draw the profile from the cut-list table (x from center, depth).<br>2) Join the points with a smooth curve and cut 2 identical ribs ' + m0(Dd * 1000) + ' mm wide.'), tr('Las dos costillas coinciden al ponerlas una sobre otra.', 'The two ribs match when stacked.')));
    S.push(st(tr('Arma el esqueleto', 'Assemble the frame'), tr('1) Cruza las costillas en el centro con una unión a media madera y fíjalas a un buje o plancha central.<br>2) Añade 2 aros o diagonales para rigidizar.', '1) Cross the ribs at the center with a half-lap joint and fix them to a center hub or plate.<br>2) Add 2 rings or diagonals for stiffness.'), tr('La estructura no se tuerce al presionarla.', 'The frame doesn’t twist when pressed.')));
    S.push(st(tr('Cubre con rejilla', 'Cover with grid'), tr('1) Corta malla/rejilla de ' + m0(Dd * 1000 + 60) + ' mm de diámetro; huecos ≤ ' + mm(0.1 * l) + '.<br>2) Fíjala a las costillas con alambre o grapas, sin arrugas.', '1) Cut mesh/grid of ' + m0(Dd * 1000 + 60) + ' mm diameter; gaps ≤ ' + mm(0.1 * l) + '.<br>2) Fix it to the ribs with wire or staples, without wrinkles.'), tr('La superficie sigue la curva de las costillas.', 'The surface follows the rib curve.')));
    S.push(st(tr('Alimentador en el foco', 'Feed at the focus'), tr('1) Un tubo NO metálico de ' + mm(fl * 1000 + 50) + ' sale del centro hacia el frente.<br>2) En su punta, a ' + m0(fl * 1000) + ' mm del centro, monta un dipolo de brazos ' + mm((0.47 * l - gap) / 2) + ' con un disco de Ø ' + mm(0.6 * l) + ' a ' + mm(0.25 * l) + ' detrás.<br>3) El coaxial baja por el tubo.', '1) A NON-metallic tube of ' + mm(fl * 1000 + 50) + ' goes from the center to the front.<br>2) At its tip, ' + m0(fl * 1000) + ' mm from the center, mount a dipole with arms ' + mm((0.47 * l - gap) / 2) + ' and a Ø ' + mm(0.6 * l) + ' disc ' + mm(0.25 * l) + ' behind it.<br>3) The coax runs down the tube.'), tr('El dipolo mira al centro del plato.', 'The dipole faces the dish center.')));
  }
  return S;
}
function tail(f, l) {
  return [
    st(tr('Prepara el coaxial', 'Prepare the coax'), tr('1) Corta el cable con +10 cm de sobra.<br>2) Retira 25 mm de chaqueta sin cortar la malla.<br>3) Abre la malla, trénzala en un solo hilo y retira el dieléctrico dejando 8 mm de conductor central.<br>4) Estaña la malla trenzada y el conductor (calienta 2–3 s).', '1) Cut the cable with +10 cm spare.<br>2) Strip 25 mm of jacket without cutting the braid.<br>3) Open the braid, twist it into one strand and remove the dielectric leaving 8 mm of center conductor.<br>4) Tin the twisted braid and the conductor (heat 2–3 s).'), tr('Malla y vivo están separados y no se tocan.', 'Braid and center are apart and don’t touch.')),
    st(tr('Haz el choke (balun)', 'Make the choke (balun)'), tr('Enrolla 3–4 vueltas del propio coaxial en un aro de Ø ≈ ' + mm(lam(f) / 3) + ' (λ/3), junto al punto de alimentación, y sujétalas con bridas. O usa un clip de ferrita. Evita que el coaxial irradie y deforme el patrón.', 'Wind 3–4 turns of the coax itself in a loop of Ø ≈ ' + mm(lam(f) / 3) + ' (λ/3), next to the feed point, and secure with zip ties. Or use a ferrite clip. It stops the coax from radiating and distorting the pattern.'), tr('El aro queda pegado al punto de alimentación.', 'The loop sits right at the feed point.')),
    st(tr('Sella contra el agua', 'Seal against water'), tr('1) Envuelve las soldaduras con cinta autofundente (estirándola 2×) y encima cinta vinílica.<br>2) Sella con silicona neutra los orificios del conector/boom.<br>3) Deja un “bucle de goteo” en el cable antes de entrar a casa.', '1) Wrap the solder joints with self-fusing tape (stretch it 2×) and vinyl tape on top.<br>2) Seal connector/boom holes with neutral silicone.<br>3) Leave a “drip loop” in the cable before it enters the house.'), tr('No queda cobre ni estaño a la vista.', 'No copper or solder remains exposed.')),
    st(tr('Monta y pon a tierra', 'Mount and ground'), tr('1) Fija el mástil lejos de líneas eléctricas (≥ 3 m) y de metales cercanos (≥ ' + mm(lam(f)) + ').<br>2) Si el mástil es metálico, conéctalo a tierra con cable de 6 mm² a una varilla de cobre.<br>3) NO instales con lluvia, viento fuerte ni tormenta; usa arnés si trabajas alto.', '1) Fix the mast away from power lines (≥ 3 m) and nearby metal (≥ ' + mm(lam(f)) + ').<br>2) If the mast is metal, connect it to ground with 6 mm² wire to a copper rod.<br>3) DO NOT install in rain, strong wind or storms; use a harness when working high.'), tr('El mástil está firme y no se mueve con la mano.', 'The mast is firm and doesn’t move by hand.')),
    st(tr('Apunta con la app', 'Aim with the app'), tr('1) En Mapa → “Apuntar brújula a la torre” y gira hasta alinear.<br>2) Con la pestaña Señal abierta, mueve la antena de 5° en 5°, esperando 5 s en cada paso.<br>3) Quédate en el rumbo donde RSRP y SINR sean mejores y aprieta los tornillos.', '1) In Map → “Aim compass at tower” and rotate to align.<br>2) With the Signal tab open, move the antenna in 5° steps, waiting 5 s at each.<br>3) Stay at the bearing where RSRP and SINR are best and tighten the screws.'), tr('RSRP mejor que antes de apuntar.', 'RSRP better than before aiming.'))
  ];
}
AL.taller.metaHtml = function (id, f) {
  var m = META[id], dots = '●●●●●'.slice(0, m[0]) + '○○○○○'.slice(0, 5 - m[0]);
  return '<div class="card rows"><div><span>' + tr('Dificultad', 'Difficulty') + '</span><b>' + dots + '</b></div><div><span>' + tr('Tiempo aproximado', 'Approx. time') + '</span><b>' + m[1] + ' h</b></div></div><div class="card"><b>' + tr('Herramientas', 'Tools') + '</b><div class="muted small">' + tr('Regla o cinta métrica (mm) · calibre (ideal) · lápiz fino · sierra para metal o alicate de corte · lima · lija fina · taladro y brocas · soldador 60–100 W y estaño con resina · cinta autofundente y vinílica · bridas · silicona neutra · multímetro (continuidad) · escuadra', 'Ruler or tape (mm) · caliper (ideal) · fine pencil · hacksaw or cutters · file · fine sandpaper · drill and bits · 60–100 W soldering iron and rosin-core solder · self-fusing and vinyl tape · zip ties · neutral silicone · multimeter (continuity) · square') + '</div></div>';
};
AL.taller.buildHtml = function (id, f, o) {
  var l = lam(f), rod = stdRod(l), steps = specific(id, f, o, l, rod).concat(tail(f, l)), n = 0;
  var h = '<h3>' + tr('Paso a paso (fabricación y montaje)', 'Step by step (build and install)') + '</h3>';
  h += steps.map(function (s) { n++; return '<div class="card stp"><div class="sn">' + n + '</div><div><b>' + s.t + '</b><div class="sd">' + s.d + '</div><div class="sok">✔ ' + s.ok + '</div></div></div>'; }).join('');
  h += '<h3>' + tr('Prueba y ajuste final', 'Final test and tuning') + '</h3><div class="card"><ol>' +
    '<li>' + tr('Con el módulo “Alineación en tablita” o la pestaña Señal, anota el RSRP y SINR SIN antena (referencia).', 'Using the “Board alignment” module or the Signal tab, note RSRP and SINR WITHOUT the antenna (reference).') + '</li>' +
    '<li>' + tr('Conecta la antena y apunta. La mejora esperada es la ganancia menos las pérdidas de cable y acople (ver Cable y alcance abajo).', 'Connect the antenna and aim. Expected improvement is gain minus cable and coupling losses (see Cable and range below).') + '</li>' +
    '<li>' + tr('Si falta más de 3 dB: revisa medidas con calibre, soldaduras frías, agua en el coaxial, metales cerca y que la polarización coincida (prueba girar la antena 90°).', 'If more than 3 dB is missing: re-check dimensions with a caliper, cold solder joints, water in the coax, nearby metal and polarization match (try rotating the antenna 90°).') + '</li>' +
    '<li>' + tr('Repite la medición de la mañana y de la noche: la carga de la celda cambia el SINR.', 'Repeat the measurement in the morning and at night: cell load changes SINR.') + '</li></ol></div>';
  h += '<h3>' + tr('Errores comunes', 'Common mistakes') + '</h3><div class="card"><ul>' +
    '<li>' + tr('Medidas “a ojo”: 2–3 mm de error ya desafinan a esta frecuencia.', 'Eyeballing sizes: 2–3 mm of error already detunes at this frequency.') + '</li>' +
    '<li>' + tr('Cable demasiado largo o muy fino: se come la ganancia (ver Cable).', 'Cable too long or too thin: it eats the gain (see Cable).') + '</li>' +
    '<li>' + tr('Soldaduras “frías” (opacas, granulosas): vuelve a calentar hasta que brillen.', '“Cold” solder joints (dull, grainy): reheat until they shine.') + '</li>' +
    '<li>' + tr('Montar la antena pegada a una pared metálica, techo de zinc o mástil sin separación.', 'Mounting the antenna against a metal wall, zinc roof or mast with no spacing.') + '</li>' +
    '<li>' + tr('Apuntar al lugar equivocado: confirma con Mapa/Brújula y mide, no supongas.', 'Aiming the wrong way: confirm with Map/Compass and measure, don’t assume.') + '</li></ul></div>';
  return h;
};
})(window.AL);
