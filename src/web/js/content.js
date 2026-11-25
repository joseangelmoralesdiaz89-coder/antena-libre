(function (AL) {
'use strict';
var L = AL.L, T = AL.T;

// ================= MÉTRICAS: qué son y cómo mejorarlas =================
function scaleRows(rows) {
  return '<div class="scl">' + rows.map(function (r) { return '<div><i style="background:' + r[0] + '"></i><b>' + r[1] + '</b><span>' + r[2] + '</span></div>'; }).join('') + '</div>';
}
var QC = ['#16a34a', '#84cc16', '#eab308', '#f97316', '#dc2626'];
AL.scaleHtml = function (k) {
  var t = AL.CFG.thresholds;
  var nm = [L('Excelente', 'Excellent'), L('Buena', 'Good'), L('Regular', 'Fair'), L('Mala', 'Poor'), L('Muy mala', 'Very poor')];
  if (k === 'rsrp' || k === 'sinr') {
    var a = t[k], u = k === 'rsrp' ? 'dBm' : 'dB';
    return scaleRows([[QC[0], '≥ ' + a[0], nm[0]], [QC[1], a[1] + ' … ' + a[0], nm[1]], [QC[2], a[2] + ' … ' + a[1], nm[2]], [QC[3], a[3] + ' … ' + a[2], nm[3]], [QC[4], '< ' + a[3] + ' ' + u, nm[4]]]);
  }
  if (k === 'rsrq') return scaleRows([[QC[0], '-3 … -9', nm[0]], [QC[2], '-10 … -14', L('Normal', 'Normal')], [QC[4], '< -15', L('Mala (celda saturada)', 'Poor (congested cell)')]]);
  return '';
};
AL.METRICS = {
  quality: { n: ['Calidad global', 'Overall quality'],
    what: ['Resumen de tu señal: el peor valor entre RSRP (potencia) y SINR (limpieza). Si cualquiera de los dos es malo, la conexión lo será.', 'Summary of your signal: the worse of RSRP (power) and SINR (cleanliness). If either is bad, the connection will be bad.'],
    how: [['Mira cuál de los dos (RSRP o SINR) limita y mantén presionado ese dato.', 'Check which one limits (RSRP or SINR) and long-press it.'], ['Cambiar de lugar unos metros y subir de altura casi siempre mejora más que cualquier ajuste.', 'Moving a few meters and gaining height almost always beats any setting.']] },
  rsrp: { n: ['RSRP · potencia de señal', 'RSRP · signal power'],
    what: ['Potencia con que llega a tu móvil la señal de referencia de la torre (dBm). Es el número principal: cuanto más cerca de 0, mejor. Baja con la distancia, paredes, techos y obstáculos. Alrededor de -120 dBm el móvil pierde la red.', 'Power of the tower’s reference signal at your phone (dBm). The main number: closer to 0 is better. It drops with distance, walls, roofs and obstacles. Around -120 dBm the phone loses the network.'],
    how: [['Sal al exterior o pégate a una ventana: una pared de concreto resta 10–20 dB.', 'Go outside or next to a window: a concrete wall costs 10–20 dB.'],
      ['Sube de altura (azotea, piso alto): hay menos obstáculos hacia la torre.', 'Gain height (roof, upper floor): fewer obstacles toward the tower.'],
      ['Gira el móvil hacia la torre (pestaña Brújula), quita fundas metálicas y no lo cubras con la mano.', 'Turn the phone toward the tower (Compass tab), remove metal cases and don’t cover it with your hand.'],
      ['Si sigue baja: antena externa direccional (pestaña Antenas): +8 a +20 dB.', 'If it stays low: external directional antenna (Antennas tab): +8 to +20 dB.']] },
  sinr: { n: ['SINR · limpieza de señal', 'SINR · signal cleanliness'],
    what: ['Relación señal / ruido + interferencia (dB). Define la velocidad real aunque el RSRP sea bueno: con SINR bajo hay señal pero va lento o se corta.', 'Signal-to-interference-plus-noise ratio (dB). It sets real speed even with good RSRP: low SINR means signal but slow or dropping.'],
    how: [['Aléjate de routers, microondas, cargadores y motores.', 'Move away from routers, microwaves, chargers and motors.'],
      ['Cambia unos metros de sitio: el SINR varía mucho de un punto a otro; la altura ayuda.', 'Move a few meters: SINR varies a lot by spot; height helps.'],
      ['Prueba otra banda o celda (tarjeta “A cuál conectarte”).', 'Try another band or cell (“Which one to connect to” card).'],
      ['Una antena direccional apuntada a la torre rechaza interferencia lateral.', 'A directional antenna aimed at the tower rejects side interference.']] },
  rsrq: { n: ['RSRQ · calidad de la celda', 'RSRQ · cell quality'],
    what: ['Calidad de la señal de referencia (dB): mezcla potencia, interferencia y carga de la celda. Mala = celda saturada o con interferencia.', 'Quality of the reference signal (dB): mixes power, interference and cell load. Poor = congested or interfered cell.'],
    how: [['En horas de menos tráfico (madrugada) mejora: hay menos usuarios en la celda.', 'It improves at low-traffic hours (night): fewer users on the cell.'],
      ['Pasa a otra banda o celda menos cargada.', 'Move to another, less loaded band or cell.'],
      ['Reduce interferencias como en SINR.', 'Reduce interference as for SINR.']] },
  net: { n: ['Tipo de red', 'Network type'],
    what: ['Tecnología en uso: 5G y 4G LTE son rápidas; 3G y 2G son lentas. El móvil baja a 3G/2G cuando el 4G es débil.', 'Technology in use: 5G and 4G LTE are fast; 3G and 2G are slow. The phone drops to 3G/2G when 4G is weak.'],
    how: [['Si estás en 3G/2G, sal o sube a un punto mejor para recuperar 4G.', 'If on 3G/2G, go outside or higher to get 4G back.'],
      ['Ajustes → Red móvil → Tipo de red preferida: 4G/LTE evita saltos a 2G/3G.', 'Settings → Mobile network → Preferred network type: 4G/LTE avoids jumps to 2G/3G.'],
      ['Si el 5G fluctúa con señal débil, fija 4G LTE: suele ser más estable.', 'If 5G flickers on weak signal, lock 4G LTE: usually steadier.']] },
  op: { n: ['Operador', 'Carrier'],
    what: ['Operador al que estás registrado. En zonas con varios operadores, el mejor cambia según el lugar.', 'Carrier you are registered to. Where several carriers exist, the best one changes by location.'],
    how: [['Con dos SIM, prueba la otra y compara el RSRP en el mismo lugar.', 'With two SIMs, try the other one and compare RSRP at the same spot.'],
      ['Ajustes → Red móvil → Operadores → selección manual (si tu SIM lo permite).', 'Settings → Mobile network → Carriers → manual selection (if your SIM allows).'],
      ['Compara operadores antes de comprar una antena.', 'Compare carriers before buying an antenna.']] },
  reg: { n: ['Registro de red', 'Network registration'],
    what: ['Estado frente a la red: En servicio = conectado; Sin servicio = no encuentra red; Solo emergencias = sin registro con tu operador; Radio apagada = modo avión.', 'State toward the network: In service = connected; Out of service = no network found; Emergency only = not registered to your carrier; Radio off = airplane mode.'],
    how: [['Activa y desactiva el modo avión 10 s para re-registrar.', 'Toggle airplane mode for 10 s to re-register.'],
      ['Revisa la SIM (limpia contactos), plan activo y cobertura del operador.', 'Check the SIM (clean contacts), active plan and carrier coverage.'],
      ['Selecciona el operador a mano y reinicia el móvil.', 'Select the carrier manually and reboot.']] },
  inet: { n: ['Internet', 'Internet'],
    what: ['Si hay conexión de datos activa (móvil o Wi‑Fi). “Sin validar” = hay conexión pero Android no pudo comprobar internet (común si ciertos servicios están bloqueados).', 'Whether a data connection is active (mobile or Wi‑Fi). “Unvalidated” = connected but Android could not verify internet (common where some services are blocked).'],
    how: [['Datos móviles activados y APN correcta (Ajustes → Red móvil → APN).', 'Mobile data on and correct APN (Settings → Mobile network → APN).'],
      ['Plan/saldo de datos activo; desactiva el ahorro de datos.', 'Active data plan/balance; turn off data saver.'],
      ['Haz una prueba en Más → Velocidad.', 'Run a test in More → Speed.']] },
  gps: { n: ['Ubicación (GPS)', 'Location (GPS)'],
    what: ['Precisión de tu ubicación (± metros). El mapa, la distancia a la torre y el mapa de calor la necesitan.', 'Accuracy of your location (± meters). The map, tower distance and heat map need it.'],
    how: [['Activa la ubicación en alta precisión.', 'Turn location on in high-accuracy mode.'], ['Sal al exterior con vista al cielo durante un minuto.', 'Go outside with sky view for a minute.'], ['Concede el permiso de ubicación a la app.', 'Grant the app location permission.']] },
  band: { n: ['Banda y frecuencia', 'Band and frequency'],
    what: ['Banda y frecuencia en que está tu móvil. Bandas bajas (700–900 MHz) llegan más lejos y atraviesan paredes; medias (1800–2600) equilibran; altas (3500+) dan velocidad pero poco alcance.', 'Band and frequency your phone is on. Low bands (700–900 MHz) travel farther and penetrate walls; mid (1800–2600) balance; high (3500+) give speed but short range.'],
    how: [['Con señal débil conviene una banda baja; con señal fuerte, banda alta o 5G para más velocidad.', 'On weak signal a low band is better; on strong signal, a high band or 5G for speed.'],
      ['Android no deja que una app fuerce la banda: mira la tarjeta “A cuál conectarte” para ver cómo influir.', 'Android doesn’t let apps force a band: see the “Which one to connect to” card for ways to influence it.'],
      ['Una antena externa rinde más sintonizada a tu banda (pestaña Antenas).', 'An external antenna works best tuned to your band (Antennas tab).']] },
  cell: { n: ['Celda / sector', 'Cell / sector'],
    what: ['Identificador (ID y PCI) del sector que te sirve. Una torre tiene varios sectores que apuntan a direcciones distintas.', 'Identifier (ID and PCI) of your serving sector. A tower has several sectors pointing in different directions.'],
    how: [['Muévete unos metros: puede conectarte a otro sector con mejor señal.', 'Move a few meters: you may be handed to a better sector.'],
      ['Si la señal salta entre celdas estás en el borde: sube de altura o apunta una antena a UNA celda.', 'If the signal hops between cells you are at the edge: gain height or aim an antenna at ONE cell.'],
      ['Con el ID la app puede ubicar la torre en el mapa.', 'With the ID the app can place the tower on the map.']] },
  tower: { n: ['Distancia a la torre', 'Distance to the tower'],
    what: ['Distancia a la torre que te sirve. Fuente: coordenadas de base de datos (OpenCelliD), tus propias mediciones, timing advance de la red o, en último caso, un modelo aproximado por potencia.', 'Distance to your serving tower. Source: database coordinates (OpenCelliD), your own measurements, network timing advance, or as a last resort a rough power-based model.'],
    how: [['Busca línea de vista a la torre: sin árboles ni edificios (mapa satélite ayuda).', 'Look for line of sight to the tower: no trees or buildings (satellite map helps).'],
      ['Apunta hacia ella: Brújula → “Apuntar a la torre”.', 'Aim toward it: Compass → “Aim at tower”.'],
      ['A más de 10 km usa una Yagi de 5 elementos o una parabólica en un mástil alto.', 'Beyond 10 km use a 5-element Yagi or a dish on a tall mast.']] }
};

// ================= CONSEJOS EN VIVO =================
// ctx: {s, why, cell, cells, loc, tow:{dist,bearing,src}, f:{label,f,cls}}
AL.advise = function (c) {
  var out = [], s = c.s;
  if (!s) return [[L('Esperando datos de la red…', 'Waiting for network data…'), 'info']];
  if (c.why) {
    out.push([L('Sin conexión (' + c.why + '): activa el modo avión 10 s, revisa SIM y plan, o elige el operador a mano.', 'No connection (' + c.why + '): toggle airplane mode 10 s, check SIM and plan, or pick the carrier manually.'), 'bad']);
    out.push([L('Sal al exterior o sube de altura: es lo que más rápido recupera cobertura.', 'Go outside or gain height: the quickest way to regain coverage.'), 'tip']);
    return out;
  }
  var rs = s.rsrp != null ? s.rsrp : s.dbm;
  if (!s.locPerm || !s.phonePerm) out.push([L('Concede permisos de ubicación y teléfono: sin ellos no hay RSRP completo, bandas, torre ni mapa.', 'Grant location and phone permissions: without them there is no full RSRP, bands, tower or map.'), 'bad']);
  if (rs != null && rs <= -110) {
    out.push([L('Señal muy débil (' + rs + ' dBm): acércate a una ventana o al exterior y sube de altura.', 'Very weak signal (' + rs + ' dBm): go next to a window or outside and gain height.'), 'bad']);
  } else if (rs != null && rs <= -100) {
    out.push([L('Señal mala (' + rs + ' dBm): cambia unos metros de sitio o gira el móvil; evita fundas metálicas.', 'Poor signal (' + rs + ' dBm): move a few meters or rotate the phone; avoid metal cases.'), 'warn']);
  }
  if (c.tow && c.tow.bearing != null && rs != null && rs < -95) {
    out.push([L('La torre está a ' + AL.fmtDist(c.tow.dist) + ' hacia el ' + AL.card8(c.tow.bearing) + ' (' + Math.round(c.tow.bearing) + '°). Pon una ventana o antena de ese lado.', 'The tower is ' + AL.fmtDist(c.tow.dist) + ' toward ' + AL.card8(c.tow.bearing) + ' (' + Math.round(c.tow.bearing) + '°). Place a window or antenna on that side.'), 'tip']);
  }
  if (s.sinr != null && s.sinr < 3) out.push([L('SINR bajo (' + s.sinr + ' dB): hay interferencia. Aléjate de routers/electrónica o prueba otra banda.', 'Low SINR (' + s.sinr + ' dB): interference. Move away from routers/electronics or try another band.'), 'warn']);
  if (s.net === '3G' || s.net === '2G') out.push([L('Estás en ' + s.net + ': busca un punto con mejor señal para volver a 4G.', 'You are on ' + s.net + ': find a spot with better signal to get 4G back.'), 'warn']);
  if (c.reco && c.reco.msg) out.push([c.reco.msg, 'tip']);
  if (rs != null && rs <= -105) out.push([L('Si es tu lugar fijo: una antena externa direccional (+8 a +15 dB) es la mejora más grande. Mira la pestaña Antenas.', 'If this is a fixed spot: an external directional antenna (+8 to +15 dB) is the biggest upgrade. See the Antennas tab.'), 'tip']);
  if (c.loc == null && s.locPerm) out.push([L('Sin posición GPS: sal al exterior un minuto para activar mapa y distancia a la torre.', 'No GPS fix: go outside for a minute to enable the map and tower distance.'), 'info']);
  if (!out.length) out.push([L('Señal en buen estado. Para mantenerla: evita cubrir el móvil y no lo guardes junto a metales.', 'Signal is healthy. To keep it: don’t cover the phone or store it next to metal.'), 'ok']);
  return out;
};

// ================= CÓMO CAMBIAR DE BANDA =================
AL.HOWBAND = [
  ['Ajustes → Red móvil → Operadores de red: desactiva “automático” y elige a mano tu mismo operador. Al reescanear a veces te asigna una celda mejor.', 'Settings → Mobile network → Carriers: turn off “automatic” and choose your own carrier manually. The rescan sometimes gives you a better cell.'],
  ['Ajustes → Red móvil → Tipo de red preferida: elige 4G/LTE (o 5G/4G) si el móvil salta a 3G/2G o el 5G fluctúa.', 'Settings → Mobile network → Preferred network type: pick 4G/LTE (or 5G/4G) if the phone jumps to 3G/2G or 5G flickers.'],
  ['Modo avión 10 segundos: fuerza a escoger celda de nuevo.', 'Airplane mode for 10 seconds: forces a new cell selection.'],
  ['Menú de ingeniería (depende del modelo): el botón de abajo abre el marcador con el código *#*#4636#*#*. En algunos Samsung existe *#2263# para bloquear banda. Si no pasa nada, tu móvil no lo permite.', 'Engineering menu (model dependent): the button below opens the dialer with code *#*#4636#*#*. Some Samsung phones have *#2263# for band lock. If nothing happens, your phone doesn’t allow it.'],
  ['Lo que siempre funciona: mover o apuntar físicamente (o una antena externa). La red, no la app, decide la banda.', 'What always works: physically moving or aiming (or an external antenna). The network, not the app, decides the band.']
];

// ================= GLOSARIO =================
AL.GLOSS = [
  ['RSRP', 'Potencia de la señal de referencia (dBm). Va de -140 a -44; más cerca de 0 es mejor.', 'Reference signal received power (dBm). Ranges -140 to -44; closer to 0 is better.'],
  ['SINR', 'Relación señal/ruido e interferencia (dB). >20 excelente, 13–20 buena, 0–13 regular, <0 mala.', 'Signal-to-interference-plus-noise ratio (dB). >20 excellent, 13–20 good, 0–13 fair, <0 poor.'],
  ['RSRQ', 'Calidad de la señal de referencia (dB). -3 a -9 muy buena; peor que -15 indica saturación.', 'Reference signal quality (dB). -3 to -9 very good; worse than -15 means congestion.'],
  ['dBm / dB', 'dBm = potencia absoluta (logarítmica). dB = diferencia. +3 dB duplica la potencia; +10 dB la multiplica por 10.', 'dBm = absolute power (logarithmic). dB = difference. +3 dB doubles power; +10 dB multiplies it by 10.'],
  ['dBi', 'Ganancia de una antena respecto a una ideal que radia igual en todas direcciones.', 'Antenna gain relative to an ideal one radiating equally in all directions.'],
  ['EARFCN / NR-ARFCN', 'Número de canal que identifica la frecuencia exacta de la celda. La app lo convierte a banda y MHz.', 'Channel number identifying the cell’s exact frequency. The app converts it to band and MHz.'],
  ['Banda (B3, n78…)', 'Rango de frecuencias asignado a un servicio. B = 4G LTE, n = 5G NR.', 'Frequency range allocated to a service. B = 4G LTE, n = 5G NR.'],
  ['PCI / Cell ID', 'PCI distingue sectores cercanos; el Cell ID identifica la celda en toda la red.', 'PCI tells nearby sectors apart; Cell ID identifies the cell across the whole network.'],
  ['Timing Advance (TA)', 'Retardo que la red mide para ajustar tu transmisión. Cada unidad ≈ 78 m de distancia a la torre en 4G.', 'Delay the network measures to align your transmission. Each unit ≈ 78 m of distance to the tower in 4G.'],
  ['Registro de red', 'Estado de conexión con la red: en servicio, sin servicio, solo emergencias, radio apagada.', 'Connection state with the network: in service, out of service, emergency only, radio off.'],
  ['Caída', 'Periodo sin comunicación: sin servicio, modo avión, solo emergencias o sin datos. Se guarda con inicio, fin y lugar.', 'Period without communication: out of service, airplane mode, emergency only or no data. Saved with start, end and place.'],
  ['MIMO', 'Usar dos o más antenas a la vez para más velocidad y estabilidad. Los módems 4G suelen traer 2 conectores.', 'Using two or more antennas at once for speed and stability. 4G modems usually have 2 connectors.'],
  ['VSWR / SWR', 'Cuánto se refleja de la potencia por mala adaptación. 1.0 es perfecto; hasta 2.0 es aceptable (pierde ~0.5 dB).', 'How much power is reflected by mismatch. 1.0 is perfect; up to 2.0 is acceptable (~0.5 dB loss).'],
  ['Norte magnético / verdadero', 'La brújula marca el magnético; el verdadero (de los mapas) difiere según el lugar (declinación).', 'The compass shows magnetic north; true (map) north differs by place (declination).'],
  ['Línea de vista', 'Que no haya obstáculos entre tu antena y la torre. Es lo que más cuenta en frecuencias altas.', 'No obstacles between your antenna and the tower. It matters most at high frequencies.']
];

// ================= TALLER DE ANTENAS =================
function lam(f) { return 299792.458 / f; }
function mm(x) { return (x < 100 ? x.toFixed(1) : Math.round(x)) + ' mm'; }
function svgWrap(inner) { return '<svg viewBox="0 0 340 190" class="ant">' + inner + '</svg>'; }
function tx(x, y, t, c) { return '<text x="' + x + '" y="' + y + '" fill="' + (c || '#cbd5e1') + '" font-size="10" text-anchor="middle">' + t + '</text>'; }

function svgYagi(els, boom) {
  var mx = Math.max.apply(null, els.map(function (e) { return e.l; })), sx = 280 / Math.max(boom, 1), sy = 130 / mx, s = '';
  s += '<line x1="20" y1="100" x2="' + (20 + boom * sx) + '" y2="100" stroke="#94a3b8" stroke-width="4"/>';
  els.forEach(function (e, i) {
    var x = 20 + e.x * sx, col = i === 0 ? '#f97316' : (e.drv ? '#22c55e' : '#3b82f6');
    s += '<line x1="' + x + '" y1="' + (100 - e.l * sy / 2) + '" x2="' + x + '" y2="' + (100 + e.l * sy / 2) + '" stroke="' + col + '" stroke-width="4" stroke-linecap="round"/>';
    s += tx(x, 175, i === 0 ? 'R' : (e.drv ? 'D' : 'd' + (i - 1)), col);
  });
  s += '<text x="330" y="96" fill="#94a3b8" font-size="10" text-anchor="end">→ ' + L('hacia la torre', 'toward tower') + '</text>';
  s += tx(170, 14, L('Vista lateral (elementos perpendiculares al mástil)', 'Side view (elements perpendicular to boom)'), '#94a3b8');
  return svgWrap(s);
}
function svgDipole(arm, gap) {
  var k = 130 / (arm + gap / 2);
  return svgWrap('<line x1="' + (170 - gap * k / 2) + '" y1="90" x2="' + (170 - gap * k / 2 - arm * k) + '" y2="90" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/><line x1="' + (170 + gap * k / 2) + '" y1="90" x2="' + (170 + gap * k / 2 + arm * k) + '" y2="90" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/><circle cx="170" cy="90" r="4" fill="#f97316"/><line x1="170" y1="94" x2="170" y2="170" stroke="#94a3b8" stroke-width="3"/>' + tx(100, 75, 'brazo / arm', '#22c55e') + tx(240, 75, 'brazo / arm', '#22c55e') + tx(170, 70, L('separación', 'gap'), '#f97316') + tx(170, 184, L('al cable coaxial + balun', 'to coax + balun'), '#94a3b8'));
}
function svgGP() {
  return svgWrap('<line x1="170" y1="20" x2="170" y2="100" stroke="#22c55e" stroke-width="5"/><line x1="170" y1="100" x2="90" y2="150" stroke="#3b82f6" stroke-width="3"/><line x1="170" y1="100" x2="250" y2="150" stroke="#3b82f6" stroke-width="3"/><line x1="170" y1="100" x2="125" y2="130" stroke="#3b82f6" stroke-width="3" opacity=".6"/><line x1="170" y1="100" x2="215" y2="130" stroke="#3b82f6" stroke-width="3" opacity=".6"/><circle cx="170" cy="100" r="5" fill="#f97316"/>' + tx(190, 55, L('radiador', 'radiator'), '#22c55e') + tx(90, 168, L('4 radiales a 45° hacia abajo', '4 radials 45° downward'), '#3b82f6'));
}
function svgCorner() {
  return svgWrap('<line x1="60" y1="95" x2="230" y2="20" stroke="#3b82f6" stroke-width="4"/><line x1="60" y1="95" x2="230" y2="170" stroke="#3b82f6" stroke-width="4"/><circle cx="140" cy="95" r="6" fill="#22c55e"/><line x1="60" y1="95" x2="140" y2="95" stroke="#f97316" stroke-dasharray="4"/>' + tx(100, 88, 'S', '#f97316') + tx(300, 96, L('→ hacia la torre', '→ toward tower'), '#94a3b8') + tx(140, 118, L('dipolo (vertical)', 'dipole (vertical)'), '#22c55e') + tx(170, 14, L('Vista superior: reflector en V de 90°', 'Top view: 90° V reflector'), '#94a3b8'));
}
function svgCan() {
  return svgWrap('<rect x="40" y="55" width="250" height="80" rx="6" fill="none" stroke="#3b82f6" stroke-width="4"/><line x1="105" y1="55" x2="105" y2="85" stroke="#22c55e" stroke-width="4"/><circle cx="105" cy="140" r="4" fill="#f97316"/><line x1="105" y1="135" x2="105" y2="85" stroke="#94a3b8" stroke-width="2"/>' + tx(105, 160, L('conector N/SMA', 'N/SMA connector'), '#f97316') + tx(165, 45, 'L', '#3b82f6') + tx(72, 120, 'P', '#22c55e') + tx(310, 100, '→', '#94a3b8') + tx(170, 178, L('Vista lateral · D = diámetro interior', 'Side view · D = inner diameter'), '#94a3b8'));
}
function svgDish(D, f) {
  var pts = [], i, k = 150 / D, c = D * D / (16 * f);
  for (i = -10; i <= 10; i++) { var x = i / 10 * D / 2, y = x * x / (4 * f); pts.push((170 + x * k).toFixed(1) + ',' + (150 - y * k).toFixed(1)); }
  return svgWrap('<polyline points="' + pts.join(' ') + '" fill="none" stroke="#3b82f6" stroke-width="4"/><circle cx="170" cy="' + (150 - f * k) + '" r="6" fill="#f97316"/><line x1="170" y1="150" x2="170" y2="' + (150 - f * k) + '" stroke="#94a3b8" stroke-dasharray="3"/>' + tx(210, 150 - f * k / 2, 'f', '#94a3b8') + tx(170, 175, 'D', '#3b82f6') + tx(170, 150 - f * k - 10, L('alimentador', 'feed'), '#f97316'));
}

var YAGIS = {
  yagi3: { L: [0.480, 0.466, 0.426], X: [0, 0.239, 0.423], g: 8.5, fb: 15, h: 96, v: 66, z: 31, swr: 1.64 },
  yagi5: { L: [0.474, 0.457, 0.429, 0.425, 0.430], X: [0, 0.258, 0.574, 0.895, 1.198], g: 11.3, fb: 15.5, h: 54, v: 48, z: 43, swr: 1.17 }
};
function yagi(id, f) {
  var y = YAGIS[id], l = lam(f), rows = [], els = [];
  y.L.forEach(function (len, i) {
    var nm = i === 0 ? L('Reflector', 'Reflector') : i === 1 ? L('Dipolo activo (con separación central)', 'Driven dipole (with centre gap)') : L('Director ' + (i - 1), 'Director ' + (i - 1));
    rows.push([nm, mm(len * l) + ' (' + len.toFixed(3) + ' λ)', mm(y.X[i] * l)]);
    els.push({ l: len * l, x: y.X[i] * l, drv: i === 1 });
  });
  var rod = 0.01 * l, gap = 0.02 * l, boom = y.X[y.X.length - 1] * l;
  return {
    g: y.g, dir: true, bw: L('Horizontal ' + y.h + '° · Vertical ' + y.v + '°', 'Horizontal ' + y.h + '° · Vertical ' + y.v + '°'),
    head: [L('Elemento', 'Element'), L('Largo (punta a punta)', 'Length (tip to tip)'), L('Posición desde el reflector', 'Position from reflector')],
    rows: rows,
    facts: [[L('Longitud de onda λ', 'Wavelength λ'), mm(l)], [L('Diámetro de varilla', 'Rod diameter'), '≈ ' + mm(rod) + ' (0.01 λ)'], [L('Separación central del activo', 'Driven centre gap'), mm(gap)], [L('Largo del travesaño (boom)', 'Boom length'), mm(boom)],
      [L('Ganancia teórica (simulada)', 'Theoretical gain (simulated)'), y.g + ' dBi'], [L('Relación adelante/atrás', 'Front-to-back'), '≈ ' + y.fb + ' dB'], [L('Impedancia / SWR con 50 Ω', 'Impedance / SWR on 50 Ω'), y.z + ' Ω / ' + y.swr + ':1']],
    mats: [[L('Travesaño (boom)', 'Boom'), L('Madera seca o PVC, sección ≈ 20 mm, largo ' + mm(boom + 40), 'Dry wood or PVC, ≈ 20 mm section, length ' + mm(boom + 40))],
      [L('Elementos', 'Elements'), L(y.L.length + ' varillas de aluminio/latón/cobre Ø ≈ ' + mm(rod) + ' (cualquier Ø de 0.008–0.015 λ sirve)', y.L.length + ' aluminium/brass/copper rods Ø ≈ ' + mm(rod) + ' (any Ø of 0.008–0.015 λ works)')],
      [L('Balun / adaptación', 'Balun / matching'), L('Choke 1:1: 4–5 vueltas del propio coaxial en un aro de ≈ 6 cm junto al activo, o clip de ferrita', '1:1 choke: 4–5 turns of the coax itself in a ≈ 6 cm loop next to the driven element, or a ferrite clip')],
      [L('Cable y conector', 'Cable and connector'), L('Coaxial 50 Ω (ver sección Cable) + conector N o pigtail SMA/TS9/CRC9 según tu módem', '50 Ω coax (see Cable section) + N connector or SMA/TS9/CRC9 pigtail for your modem')]],
    steps: [[L('Corta los elementos con las medidas de la tabla (±1 mm a 1800 MHz; ±0.5 % de tolerancia general).', 'Cut the elements to the table lengths (±1 mm at 1800 MHz; ±0.5 % tolerance).'), ''],
      [L('Marca en el boom las posiciones desde el reflector y perfora; los elementos pasivos van centrados, aislados del metal.', 'Mark positions from the reflector on the boom and drill; passive elements are centred, insulated from metal.'), ''],
      [L('El activo se corta en dos brazos con la separación central; suelda malla del coaxial a un brazo y el vivo al otro.', 'Cut the driven element in two arms with the centre gap; solder the coax shield to one arm and the centre conductor to the other.'), ''],
      [L('Haz el choke con el coaxial junto al activo y sella con silicona o cinta autofundente.', 'Make the choke with the coax next to the driven element and seal with silicone or self-fusing tape.'), ''],
      [L('Fija el boom a un mástil NO metálico cerca del activo si puedes; apunta con la Brújula al rumbo de la torre.', 'Mount the boom on a mast, non-metal near the driven element if possible; aim using the Compass.'), '']],
    svg: svgYagi(els, boom),
    note: L('Con boom metálico que atraviese los elementos hay que alargarlos ≈ 2–3 %. Estas medidas son para boom aislante. Polarización: las torres usan polarización cruzada; vertical u horizontal funciona (≈ 3 dB de diferencia a veces).', 'With a metal boom passing through the elements, lengthen them ≈ 2–3 %. These dimensions are for an insulating boom. Polarisation: towers use cross-polarisation; vertical or horizontal both work (≈ 3 dB difference at times).')
  };
}
AL.ANT = [
  { id: 'dipolo', n: ['Dipolo de media onda', 'Half-wave dipole'], use: ['Omnidireccional sencilla para empezar o repetidores cercanos.', 'Simple omnidirectional to start with, or nearby repeaters.'],
    build: function (f) {
      var l = lam(f), tot = 0.47 * l, gap = 0.02 * l, arm = (tot - gap) / 2;
      return { g: 2.1, dir: false, bw: L('Vertical 78° · omnidireccional en horizontal', 'Vertical 78° · omnidirectional horizontally'),
        head: [L('Pieza', 'Part'), L('Medida', 'Size'), L('Cantidad', 'Qty')],
        rows: [[L('Brazo', 'Arm'), mm(arm), '2'], [L('Separación central', 'Centre gap'), mm(gap), '1'], [L('Largo total punta a punta', 'Total tip to tip'), mm(tot) + ' (0.47 λ)', '–']],
        facts: [[L('Longitud de onda λ', 'Wavelength λ'), mm(l)], [L('Diámetro de varilla', 'Rod diameter'), '≈ ' + mm(0.01 * l)], [L('Impedancia', 'Impedance'), '≈ 75 Ω (SWR ≈ 1.5 en 50 Ω)']],
        mats: [[L('Varillas', 'Rods'), L('2 × cobre/latón/aluminio Ø ≈ ' + mm(0.01 * l) + ', largo ' + mm(arm + 10), '2 × copper/brass/aluminium Ø ≈ ' + mm(0.01 * l) + ', length ' + mm(arm + 10))],
          [L('Soporte', 'Support'), L('Tubo PVC o caja plástica que separe los brazos', 'PVC pipe or plastic box holding the arms apart')], [L('Cable', 'Cable'), L('Coaxial 50 Ω + choke de 4–5 vueltas (Ø 6 cm)', '50 Ω coax + 4–5 turn choke (Ø 6 cm)')]],
        steps: [[L('Corta dos brazos de ' + mm(arm) + '.', 'Cut two arms of ' + mm(arm) + '.'), ''], [L('Fíjalos alineados con ' + mm(gap) + ' de separación en el soporte aislante.', 'Fix them in line with ' + mm(gap) + ' gap on the insulating support.'), ''],
          [L('Suelda la malla a un brazo y el vivo al otro; haz el choke y sella.', 'Solder shield to one arm and centre to the other; make the choke and seal.'), ''], [L('Móntalo vertical, lo más alto posible y con vista libre.', 'Mount it vertical, as high as possible with a clear view.'), '']],
        svg: svgDipole(arm, gap), note: L('Ganancia baja: sirve donde la señal ya es aceptable. Para señal débil elige una direccional.', 'Low gain: good where signal is already acceptable. For weak signal pick a directional.') };
    } },
  { id: 'gp', n: ['Monopolo “ground plane” (cuarto de onda)', 'Ground-plane monopole (quarter-wave)'], use: ['Omnidireccional vertical, muy fácil de hacer con un conector.', 'Vertical omnidirectional, very easy with one connector.'],
    build: function (f) {
      var l = lam(f);
      return { g: 2.1, dir: false, bw: L('Vertical ≈ 50° · omnidireccional', 'Vertical ≈ 50° · omnidirectional'),
        head: [L('Pieza', 'Part'), L('Medida', 'Size'), L('Cantidad', 'Qty')],
        rows: [[L('Radiador vertical', 'Vertical radiator'), mm(0.235 * l) + ' (0.235 λ)', '1'], [L('Radiales', 'Radials'), mm(0.25 * l) + ' (0.25 λ)', '4']],
        facts: [[L('Longitud de onda λ', 'Wavelength λ'), mm(l)], [L('Ángulo de radiales', 'Radial angle'), '135° ' + L('desde el radiador', 'from the radiator')], [L('Impedancia', 'Impedance'), '≈ 40–50 Ω']],
        mats: [[L('Conector', 'Connector'), L('N o SO-239 de panel con 4 agujeros (los radiales van soldados a la brida)', 'Panel N or SO-239 with 4 holes (radials soldered to the flange)')], [L('Varillas', 'Rods'), L('5 × cobre/latón Ø ≈ ' + mm(0.01 * l), '5 × copper/brass Ø ≈ ' + mm(0.01 * l))], [L('Cable', 'Cable'), L('Coaxial 50 Ω directo al conector', '50 Ω coax straight to the connector')]],
        steps: [[L('Suelda el radiador de ' + mm(0.235 * l) + ' al pin central.', 'Solder the ' + mm(0.235 * l) + ' radiator to the centre pin.'), ''], [L('Suelda 4 radiales de ' + mm(0.25 * l) + ' a la brida y dóblalos 45° hacia abajo.', 'Solder 4 radials of ' + mm(0.25 * l) + ' to the flange and bend them 45° downward.'), ''], [L('Móntalo vertical en lo alto; protege la unión con termorretráctil.', 'Mount vertical up high; protect the joint with heat-shrink.'), '']],
        svg: svgGP(), note: L('Ideal como antena de prueba o para zonas con varias torres en distintas direcciones.', 'Ideal as a test antenna or where several towers lie in different directions.') };
    } },
  { id: 'yagi3', n: ['Yagi de 3 elementos', '3-element Yagi'], use: ['Direccional fácil y ligera: de +8 dBi, buena primera mejora.', 'Easy lightweight directional: +8 dBi, a great first upgrade.'], build: function (f) { return yagi('yagi3', f); } },
  { id: 'yagi5', n: ['Yagi de 5 elementos', '5-element Yagi'], use: ['Direccional de +11 dBi para señal débil a varios km.', '+11 dBi directional for weak signal several km away.'], build: function (f) { return yagi('yagi5', f); } },
  { id: 'corner', n: ['Reflector de esquina 90°', '90° corner reflector'], use: ['Direccional de ≈ 10 dBi con chapa o malla; muy tolerante a errores.', '≈ 10 dBi directional made of sheet or mesh; very forgiving.'],
    build: function (f) {
      var l = lam(f), dip = 0.47 * l, S = 0.5 * l, H = Math.max(0.65 * l, 1.2 * dip), W = 1.0 * l;
      return { g: 10, dir: true, bw: L('Horizontal ≈ 55° · Vertical ≈ 60°', 'Horizontal ≈ 55° · Vertical ≈ 60°'),
        head: [L('Pieza', 'Part'), L('Medida', 'Size'), L('Cantidad', 'Qty')],
        rows: [[L('Dipolo activo (punta a punta)', 'Driven dipole (tip to tip)'), mm(dip) + ' (0.47 λ)', '1'], [L('Distancia dipolo → vértice (S)', 'Dipole → vertex distance (S)'), mm(S) + ' (0.5 λ)', '–'], [L('Placa reflectora: ancho', 'Reflector plate: width'), mm(W) + ' (1.0 λ)', '2'], [L('Placa reflectora: alto', 'Reflector plate: height'), mm(H), '2'], [L('Ángulo entre placas', 'Angle between plates'), '90°', '–']],
        facts: [[L('Longitud de onda λ', 'Wavelength λ'), mm(l)], [L('Abertura máxima de la malla', 'Max mesh opening'), mm(0.1 * l)], [L('Ganancia típica', 'Typical gain'), '≈ 10 dBi (8–12)']],
        mats: [[L('Reflector', 'Reflector'), L('Chapa de aluminio, o malla/varillas con huecos ≤ ' + mm(0.1 * l), 'Aluminium sheet, or mesh/rods with gaps ≤ ' + mm(0.1 * l))], [L('Dipolo', 'Dipole'), L('Como el dipolo de media onda (2 brazos de ' + mm((dip - 0.02 * l) / 2) + ')', 'As the half-wave dipole (2 arms of ' + mm((dip - 0.02 * l) / 2) + ')')], [L('Soporte', 'Support'), L('Estructura de madera/PVC que mantenga el ángulo de 90°', 'Wood/PVC frame holding the 90° angle')]],
        steps: [[L('Une las dos placas formando un ángulo exacto de 90° (usa una escuadra).', 'Join the two plates at exactly 90° (use a square).'), ''], [L('Coloca el dipolo vertical, paralelo al vértice, a ' + mm(S) + ' de él, centrado en la altura.', 'Place the dipole vertical, parallel to the vertex, ' + mm(S) + ' from it, centred in height.'), ''], [L('Sácale el coaxial por detrás con choke; apunta la abertura hacia la torre.', 'Run the coax out the back with a choke; aim the opening at the tower.'), '']],
        svg: svgCorner(), note: L('Más voluminosa que una Yagi pero más fácil de afinar y con poco rechazo de ruido lateral.', 'Bulkier than a Yagi but easier to build and with good side rejection.') };
    } },
  { id: 'cantenna', n: ['Cantenna (guía de onda)', 'Cantenna (waveguide)'], use: ['Lata metálica con sonda: compacta, para 1.7 GHz o más (4G 1800/2100/2600, Wi‑Fi).', 'Metal can with a probe: compact, for 1.7 GHz and above (4G 1800/2100/2600, Wi‑Fi).'],
    build: function (f) {
      var l = lam(f), D = 0.70 * l, lc = 1.706 * D, lg = l / Math.sqrt(1 - (l / lc) * (l / lc)), Lc = 0.75 * lg;
      return { g: 8.5, dir: true, bw: L('≈ 60° en ambos planos', '≈ 60° in both planes'),
        head: [L('Medida', 'Dimension'), L('Valor', 'Value'), ''],
        rows: [[L('Diámetro interior D (0.70 λ)', 'Inner diameter D (0.70 λ)'), mm(D), ''], [L('Largo del tubo L (≥ 0.75 λg)', 'Tube length L (≥ 0.75 λg)'), mm(Lc), ''], [L('Sonda desde el fondo P (λg/4)', 'Probe from back wall P (λg/4)'), mm(lg / 4), ''], [L('Largo de la sonda (λ/4)', 'Probe length (λ/4)'), mm(l / 4), ''], [L('Ø de la sonda', 'Probe Ø'), '≈ ' + mm(Math.max(1.5, 0.012 * l)), '']],
        facts: [[L('Longitud de onda λ', 'Wavelength λ'), mm(l)], [L('Longitud de onda en la guía λg', 'Guide wavelength λg'), mm(lg)], [L('Corte (D debe ser > 0.586 λ y < 0.766 λ)', 'Cutoff (D must be > 0.586 λ and < 0.766 λ)'), mm(0.586 * l) + ' – ' + mm(0.766 * l)]],
        mats: [[L('Tubo', 'Tube'), L('Lata o tubo de cobre/aluminio, interior D ≈ ' + mm(D) + ', cerrado en un extremo con tapa metálica soldada', 'Can or copper/aluminium tube, inner D ≈ ' + mm(D) + ', closed at one end with a soldered metal cap')], [L('Sonda', 'Probe'), L('Alambre rígido de cobre de ' + mm(l / 4), 'Stiff copper wire ' + mm(l / 4))], [L('Conector', 'Connector'), L('N o SMA de panel en la pared lateral', 'Panel N or SMA on the side wall')]],
        steps: [[L('Prepara el tubo con D y L indicados y tapa un extremo.', 'Prepare the tube with the D and L given and close one end.'), ''], [L('Haz un agujero a ' + mm(lg / 4) + ' del fondo y monta el conector.', 'Drill a hole ' + mm(lg / 4) + ' from the back and mount the connector.'), ''], [L('Suelda la sonda de ' + mm(l / 4) + ' al pin central, perpendicular al eje.', 'Solder the ' + mm(l / 4) + ' probe to the centre pin, perpendicular to the axis.'), ''], [L('La polarización sigue la sonda: giramos el tubo para igualarla a la torre.', 'Polarisation follows the probe: rotate the tube to match the tower.'), '']],
        svg: svgCan(), note: L('Por debajo de ~1.7 GHz el tubo sería demasiado grande (a 900 MHz: D ≈ ' + mm(0.70 * lam(900)) + '). Mantén la sonda limpia y el conector sellado.', 'Below ~1.7 GHz the tube gets too large (at 900 MHz: D ≈ ' + mm(0.70 * lam(900)) + '). Keep the probe clean and the connector sealed.') };
    } },
  { id: 'dish', n: ['Parabólica de rejilla', 'Grid parabolic dish'], use: ['La de más ganancia (15–25 dBi) para torres muy lejanas.', 'The highest gain (15–25 dBi) for very distant towers.'],
    build: function (f, o) {
      var l = lam(f) / 1000, D = (o && o.D) || 0.9, g = 10 * Math.log10(0.5 * Math.pow(Math.PI * D / l, 2)), bw = 70 * l / D, fl = 0.4 * D, c = D * D / (16 * fl), rows = [];
      [0.125, 0.25, 0.375, 0.5].forEach(function (u) { var r = u * D; rows.push([L('Radio ' + Math.round(r * 100) + ' cm', 'Radius ' + Math.round(r * 100) + ' cm'), (r * r / (4 * fl) * 100).toFixed(1) + ' cm', L('profundidad', 'depth')]); });
      return { g: g, dir: true, bw: L('≈ ' + bw.toFixed(0) + '° (ambos planos)', '≈ ' + bw.toFixed(0) + '° (both planes)'),
        head: [L('Punto del perfil', 'Profile point'), L('Profundidad desde el borde', 'Depth from rim'), ''], rows: rows,
        facts: [[L('Diámetro D', 'Diameter D'), D.toFixed(2) + ' m'], [L('Distancia focal f = 0.4 D', 'Focal length f = 0.4 D'), (fl * 100).toFixed(0) + ' cm'], [L('Profundidad central c = D²/16f', 'Centre depth c = D²/16f'), (c * 100).toFixed(1) + ' cm'], [L('Separación máx. de la rejilla', 'Max grid spacing'), mm(0.1 * l * 1000)], [L('Ganancia (eficiencia 50 %)', 'Gain (50 % efficiency)'), g.toFixed(1) + ' dBi']],
        mats: [[L('Reflector', 'Reflector'), L('Rejilla de malla soldada o varillas paralelas con huecos ≤ ' + mm(0.1 * l * 1000) + ' sobre un marco curvado con el perfil de la tabla', 'Welded mesh or parallel rods with gaps ≤ ' + mm(0.1 * l * 1000) + ' on a frame curved to the profile above')], [L('Alimentador', 'Feed'), L('Dipolo de media onda con disco o una cantenna en el foco (' + (fl * 100).toFixed(0) + ' cm del centro)', 'Half-wave dipole with a disc or a cantenna at the focus (' + (fl * 100).toFixed(0) + ' cm from the centre)')], [L('Mástil', 'Mast'), L('Tubo rígido y contrapesos; el viento carga mucho', 'Rigid pipe and counterweights; wind load is large')]],
        steps: [[L('Dibuja el perfil con y = x²/(4f) y construye costillas con esa curva.', 'Draw the profile with y = x²/(4f) and build ribs with that curve.'), ''], [L('Cubre con rejilla (huecos ≤ ' + mm(0.1 * l * 1000) + ') y tensa sin deformar.', 'Cover with mesh (gaps ≤ ' + mm(0.1 * l * 1000) + ') and tension without warping.'), ''], [L('Pon el alimentador en el foco, apuntando al centro del plato, y ajusta ± 2 cm mirando el RSRP.', 'Place the feed at the focus, aimed at the dish centre, and adjust ± 2 cm watching RSRP.'), ''], [L('Apunta con precisión: el haz es muy estrecho (usa la Brújula y afina con el RSRP).', 'Aim precisely: the beam is very narrow (use the Compass and fine-tune with RSRP).'), '']],
        svg: svgDish(D, fl), note: L('Fíjala con seguridad: una parabólica de 0.9 m soporta una fuerza de viento considerable.', 'Anchor it safely: a 0.9 m dish takes a significant wind force.') };
    } }
];
})(window.AL);
