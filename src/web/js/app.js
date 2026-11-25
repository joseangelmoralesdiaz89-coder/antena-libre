const LONG_PRESS_MS = 3000;
const LOG_KEY = "antena_libre_align_log_v1";
const C_M_MHZ = 299.792458;

const BANDS = {
  LTE: [
    { code: "B28 (700 MHz)", mhz: 758, note: "Máximo alcance y cruce de muros" },
    { code: "B20 (800 MHz)", mhz: 806, note: "Buena cobertura interior" },
    { code: "B8 (900 MHz)", mhz: 942, note: "Alcance sólido en zonas abiertas" },
    { code: "B3 (1800 MHz)", mhz: 1842, note: "Equilibrio velocidad y alcance" },
    { code: "B1 (2100 MHz)", mhz: 2140, note: "Buena capacidad de datos" },
    { code: "B7 (2600 MHz)", mhz: 2655, note: "Alta velocidad a corta distancia" }
  ],
  NR: [
    { code: "n28 (700 MHz)", mhz: 773, note: "5G de largo alcance" },
    { code: "n41 (2500 MHz)", mhz: 2595, note: "5G de capacidad media/alta" },
    { code: "n78 (3500 MHz)", mhz: 3500, note: "5G alta velocidad en línea de vista" }
  ],
  WIFI: [
    { code: "2.4 GHz Ch 1", mhz: 2412, note: "Más alcance y paso por paredes" },
    { code: "2.4 GHz Ch 6", mhz: 2437, note: "Canal central 2.4 GHz" },
    { code: "5 GHz Ch 36", mhz: 5180, note: "Más velocidad cerca" },
    { code: "5 GHz Ch 149", mhz: 5745, note: "Enlace rápido de corto alcance" }
  ],
  UMTS: [
    { code: "B5 (850 MHz)", mhz: 880, note: "3G de alcance extendido" },
    { code: "B8 (900 MHz)", mhz: 942, note: "3G de penetración" },
    { code: "B1 (2100 MHz)", mhz: 2140, note: "3G estándar" }
  ]
};

const CABLES = {
  LMR400: { name: "LMR-400 (50 Ω)", k1g: 13.1 },
  LMR200: { name: "LMR-200 (50 Ω)", k1g: 34.4 },
  RG6:    { name: "RG-6 Quad (75 Ω)", k1g: 19.6 },
  RG58:   { name: "RG-58 (50 Ω)", k1g: 46.5 }
};

const GUIDES = {
  sig: { title: "Señal (dBm)", desc: "Potencia recibida. -65 a -80 dBm es fuerte; -81 a -95 dBm es media; bajo -100 dBm es débil.", steps: ["Gira y desliza el teléfono sobre la tablita durante la alineación.", "Coloca la tablita cerca de ventana o zona elevada y lejos de metal grueso.", "Usa cable corto y baja pérdida hacia la antena exterior."] },
  sinr: { title: "Calidad / SINR (dB)", desc: "Relación señal/ruido. Valores de 10 dB o más indican enlace limpio.", steps: ["Aléjate de fuentes de interferencia eléctrica o routers saturados.", "Evita rebotes en chapas metálicas pegadas al apoyo.", "Busca el ángulo donde suba SINR junto con dBm."] },
  freq: { title: "Frecuencia (MHz)", desc: "Bandas bajas llegan más lejos y pasan muros; bandas altas dan más velocidad cerca.", steps: ["Ajusta banda y frecuencia en 'Tablita y Banda'.", "Si estás lejos o tras paredes, prioriza frecuencia baja.", "Si buscas velocidad cerca, prueba banda media/alta o 5 GHz."] },
  best: { title: "Pico en Tablita", desc: "Mejor lectura registrada al mover o girar el teléfono sobre la tablita.", steps: ["Pulsa 'Iniciar alineación del teléfono' y haz barridos lentos.", "Cuando veas el mejor dBm, toca 'Guardar punto óptimo'.", "Deja el teléfono apoyado en esa marca sin conector físico."] }
};

function fmtMm(m) {
  return m >= 1 ? `${m.toFixed(3)} m (${(m * 100).toFixed(1)} cm)` : `${(m * 100).toFixed(2)} cm (${(m * 1000).toFixed(1)} mm)`;
}

function renderAntennaPlans(freq, len, cableKey) {
  const c = CABLES[cableKey] || CABLES.LMR400;
  const lam = C_M_MHZ / Math.max(50, freq);
  const half = lam * 0.5 * 0.95;
  const cableLoss = (c.k1g / 100) * Math.sqrt(Math.max(50, freq) / 1000) * len;
  const couplerLoss = 8.5;
  document.getElementById("cPhysics").innerHTML = `<strong>${freq} MHz</strong> · λ: <strong>${fmtMm(lam)}</strong> · Cable ${c.name} (${len} m): <strong>-${cableLoss.toFixed(2)} dB</strong> · Acoplamiento sin conector en tablita: <strong>~-${couplerLoss.toFixed(1)} dB</strong> (total estimado <strong>-${(cableLoss + couplerLoss).toFixed(1)} dB</strong>).`;

  const items = [
    {
      title: "1. Tablita Acopladora Plana sin Conector (Apoyo Directo)",
      svg: `<svg viewBox="0 0 540 140" class="photo-svg">
        <rect x="30" y="78" width="480" height="36" rx="8" fill="#172436" stroke="#38bdf8" stroke-width="2"/>
        <rect x="150" y="26" width="220" height="46" rx="10" fill="#1e2f45" stroke="#10b981" stroke-width="2.5"/>
        <rect x="172" y="34" width="176" height="30" rx="5" fill="#0b131e" stroke="#f59e0b" stroke-width="1.5"/>
        <path d="M260,72 L260,114" stroke="#f59e0b" stroke-width="3" stroke-dasharray="4,3"/>
        <text x="45" y="100" fill="#eef4fb" font-size="11">TABLITA BASE (sin conector al cel)</text>
        <text x="195" y="53" fill="#10b981" font-size="11">TELÉFONO APOYADO (0–10 mm)</text>
      </svg>`,
      specs: [
        "Cómo funciona: acopla energía RF entre la tablita y la zona de antena interna del teléfono sin enchufar ningún cable al puerto del celular.",
        "Materiales: tabla/placa de madera seca, acrílico o FR4 no metálico, elemento acoplador de cobre/aluminio, topes de apoyo y conector N/SMA en el borde de la tablita.",
        `Medidas orientativas: elemento activo/acoplador ~${fmtMm(half * 0.5)} a ${fmtMm(half)}; holgura de apoyo 0–10 mm.`,
        `Cable y pérdida: mantén el coaxial (${c.name}) lo más corto posible (${len} m -> -${cableLoss.toFixed(2)} dB); al sumar el acople sin conector (~8.5 dB), cada metro extra de cable reduce más la señal.`
      ]
    },
    {
      title: "2. Tablita con Plano Reflector y Guías de Posición",
      svg: `<svg viewBox="0 0 540 140" class="photo-svg">
        <rect x="40" y="84" width="460" height="30" rx="6" fill="#142030" stroke="#8fa4bf" stroke-width="2"/>
        <line x1="80" y1="84" x2="460" y2="84" stroke="#f59e0b" stroke-width="3"/>
        <rect x="175" y="24" width="190" height="54" rx="9" fill="#1a2a3d" stroke="#38bdf8" stroke-width="2.5"/>
        <circle cx="270" cy="51" r="8" fill="none" stroke="#10b981" stroke-width="2"/>
        <text x="52" y="103" fill="#8fa4bf" font-size="11">PLANO / REBOTE · Desliza y gira el teléfono sobre las guías</text>
      </svg>`,
      specs: [
        "Cómo funciona: concentra el campo en la zona de apoyo y facilita encontrar el punto exacto donde el módem del teléfono capta más señal.",
        "Materiales: base rígida, lámina/pista conductora de acople con aislamiento dieléctrico encima, guías laterales removibles para rotar el equipo.",
        `Medidas clave: separación de referencia ~${fmtMm(lam * 0.25)}; ajusta el giro 0°–360° viendo el medidor en vivo.`,
        `Por qué cable corto: evita que la atenuación del coaxial (${len} m) anule la mejora obtenida al girar y centrar el teléfono.`
      ]
    },
    {
      title: "3. Antena Exterior Direccional + Tablita de Apoyo Interior",
      svg: `<svg viewBox="0 0 540 140" class="photo-svg">
        <line x1="40" y1="36" x2="180" y2="36" stroke="#8fa4bf" stroke-width="2"/>
        <line x1="65" y1="16" x2="65" y2="56" stroke="#f59e0b" stroke-width="3"/>
        <line x1="115" y1="20" x2="115" y2="52" stroke="#10b981" stroke-width="3"/>
        <line x1="160" y1="24" x2="160" y2="48" stroke="#38bdf8" stroke-width="3"/>
        <path d="M180,36 C250,36 260,96 330,96" fill="none" stroke="#38bdf8" stroke-width="3"/>
        <rect x="330" y="80" width="170" height="32" rx="6" fill="#172436" stroke="#10b981" stroke-width="2"/>
        <text x="342" y="100" fill="#eef4fb" font-size="10">CUNA / TABLITA APOYO</text>
      </svg>`,
      specs: [
        "Cómo funciona: una antena exterior apunta hacia la torre/fuente y alimenta mediante un cable corto la tablita donde apoyas el teléfono.",
        "Materiales: antena direccional/Yagi o panel exterior, cable coaxial de baja pérdida, conector estanco y tablita de apoyo interior.",
        `Medidas: reflector ~${fmtMm(half * 1.05)}, dipolo ~${fmtMm(half)}, director ~${fmtMm(half * 0.92)}.`,
        `Por qué cable corto: en ${c.name}, ${len} m pierden ~${cableLoss.toFixed(2)} dB; acortar el recorrido o usar LMR-400 mejora directo el dBm.`
      ]
    }
  ];

  document.getElementById("plansCards").innerHTML = items.map((it) => `
    <div class="card">
      <h3>${it.title}</h3>
      ${it.svg}
      <ul class="specs">${it.specs.map((s) => `<li>${s}</li>`).join("")}</ul>
    </div>
  `).join("");
}

let alignTimer = null;
let alignActive = false;
let phoneX = 0, phoneY = 0, phoneAngle = 0;
let bestDbm = -120, bestInfo = "Sin calibrar aún";
let liveDbm = -87, liveSinr = 8, liveFreq = 1842, liveBand = "LTE B3", liveLat = 23.1136, liveLon = -82.3666;

function drawAlignmentBoard() {
  const c = document.getElementById("alignCanvas");
  if (!c) return;
  const ctx = c.getContext("2d");
  const w = c.width, h = c.height;
  ctx.clearRect(0, 0, w, h);

  // Cuadrícula de precisión milimétrica sobre la tablita
  ctx.strokeStyle = "#142234";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  // Tablita base de apoyo (sin conector)
  const padX = 70, padY = 26, padW = w - 140, padH = h - 52;
  ctx.fillStyle = "#101b29";
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(padX, padY, padW, padH, 14);
  ctx.fill();
  ctx.stroke();

  // Zona de acoplamiento óptima en el centro de la tablita
  const cx = w / 2, cy = h / 2;
  const grad = ctx.createRadialGradient(cx, cy, 6, cx, cy, 85);
  grad.addColorStop(0, "rgba(16, 185, 129, 0.35)");
  grad.addColorStop(1, "rgba(16, 185, 129, 0.0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 85, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(16, 185, 129, 0.55)";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(cx, cy, 42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#8fa4bf";
  ctx.font = "11px sans-serif";
  ctx.fillText("TABLITA SIN CONECTOR (APOYO)", padX + 12, padY + 18);

  // Teléfono que gira y se desplaza sobre la tablita
  const px = cx + phoneX * 1.4;
  const py = cy + phoneY * 1.2;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((phoneAngle * Math.PI) / 180);

  ctx.fillStyle = alignActive ? "rgba(16, 185, 129, 0.22)" : "rgba(56, 189, 248, 0.16)";
  ctx.strokeStyle = alignActive ? "#10b981" : "#38bdf8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-28, -50, 56, 100, 9);
  ctx.fill();
  ctx.stroke();

  // Indicador frontal / orientación del teléfono
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(0, -34, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f1f6fc";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText("CEL", -11, 5);
  ctx.restore();

  document.getElementById("hudAngle").textContent = `${Math.round(((phoneAngle % 360) + 360) % 360)}°`;
  document.getElementById("hudXY").textContent = `${Math.round(phoneX)} / ${Math.round(phoneY)} mm`;
  document.getElementById("hudGain").textContent = `${liveDbm} dBm · ${alignActive ? "ALINEANDO" : "LISTO"}`;
}

function startAlignmentMode() {
  alignActive = true;
  let step = 0;
  clearInterval(alignTimer);
  alignTimer = setInterval(() => {
    step += 1;
    pullNativeTelemetry();
    // Movimiento y giro suave sobre la tablita para probar posiciones y ángulos
    phoneAngle = (phoneAngle + 14) % 360;
    phoneX = Math.round(Math.sin(step * 0.35) * 28);
    phoneY = Math.round(Math.cos(step * 0.25) * 18);
    const effDbm = liveDbm + Math.round(Math.cos((phoneAngle * Math.PI) / 180) * 3 - Math.abs(phoneX) * 0.05);
    if (effDbm > bestDbm) {
      bestDbm = effDbm;
      bestInfo = `${Math.round(phoneAngle)}° · X:${phoneX} Y:${phoneY}mm`;
      document.getElementById("mBest").textContent = `${bestDbm} dBm`;
      document.getElementById("mBestPos").textContent = bestInfo;
    }
    drawAlignmentBoard();
  }, 350);
  drawAlignmentBoard();
}

function stopAlignmentMode() {
  alignActive = false;
  clearInterval(alignTimer);
  drawAlignmentBoard();
}

let leafletMap = null, uMarker = null, aMarker = null, rLine = null;

function pullNativeTelemetry() {
  let d = null;
  if (window.AntenaBridge && typeof window.AntenaBridge.getTelemetryJson === "function") {
    try { d = JSON.parse(window.AntenaBridge.getTelemetryJson()); } catch (_) {}
  }
  liveDbm = d && typeof d.dbm === "number" ? d.dbm : -87;
  liveSinr = d && typeof d.sinr === "number" ? d.sinr : 8;
  liveFreq = d && typeof d.freqMhz === "number" ? d.freqMhz : 1842;
  liveBand = d && d.band ? d.band : "LTE B3";
  if (d && typeof d.lat === "number") liveLat = d.lat;
  if (d && typeof d.lon === "number") liveLon = d.lon;

  const pct = Math.max(5, Math.min(100, Math.round(((Math.max(-120, Math.min(-55, liveDbm)) + 120) / 65) * 100)));
  document.getElementById("mDbm").textContent = `${liveDbm} dBm`;
  document.getElementById("mDbmSub").textContent = liveDbm >= -80 ? "Fuerte" : liveDbm >= -95 ? "Media" : "Débil";
  document.getElementById("mDbmBar").style.width = `${pct}%`;
  document.getElementById("mSinr").textContent = `${liveSinr} dB`;
  document.getElementById("mFreq").textContent = `${liveFreq} MHz`;
  document.getElementById("mFreqSub").textContent = liveBand;

  const list = document.getElementById("scanList");
  const cells = (d && Array.isArray(d.cellList)) ? d.cellList : [];
  const wifis = (d && Array.isArray(d.wifiList)) ? d.wifiList : [];
  const out = [
    ...cells.map((x) => `<div class="box"><strong>${x.tech || "Celda"}</strong> · ${x.band || ""} · PCI ${x.pci || 0} · <strong>${x.dbm} dBm</strong></div>`),
    ...wifis.map((w) => `<div class="box"><strong>${w.ssid || "Wi-Fi"}</strong> · ${w.freqMhz} MHz · <strong>${w.rssi} dBm</strong></div>`)
  ];
  list.innerHTML = out.length ? out.join("") : `<div class="box">Activa ubicación/permisos o pulsa Escanear para ver celdas y Wi-Fi.</div>`;
}

function updateMapView() {
  const distM = Math.max(30, Math.round(60 * Math.pow(10, (-68 - Math.max(-120, Math.min(-45, liveDbm))) / 34)));
  document.getElementById("mapInfo").textContent = `GPS: ${liveLat.toFixed(5)}, ${liveLon.toFixed(5)} · Distancia est.: ~${distM} m`;
  const antLat = liveLat + (distM / 111320) * 0.7;
  const antLon = liveLon + (distM / (111320 * Math.max(0.2, Math.cos((liveLat * Math.PI) / 180)))) * 0.7;

  if (typeof L !== "undefined" && navigator.onLine) {
    document.getElementById("mapCanvasWrap").classList.remove("hidden");
    document.getElementById("mapFallback").classList.add("hidden");
    if (!leafletMap) {
      leafletMap = L.map("mapCanvasWrap").setView([liveLat, liveLon], 15);
      const t = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OSM" });
      t.on("tileerror", () => drawFallbackMap(distM));
      t.addTo(leafletMap);
    } else leafletMap.setView([liveLat, liveLon], 15);
    if (uMarker) leafletMap.removeLayer(uMarker);
    if (aMarker) leafletMap.removeLayer(aMarker);
    if (rLine) leafletMap.removeLayer(rLine);
    uMarker = L.circleMarker([liveLat, liveLon], { radius: 7, color: "#10b981" }).addTo(leafletMap);
    aMarker = L.circleMarker([antLat, antLon], { radius: 7, color: "#f59e0b" }).addTo(leafletMap);
    rLine = L.polyline([[liveLat, liveLon], [antLat, antLon]], { color: "#38bdf8", dashArray: "6,6" }).addTo(leafletMap);
  } else drawFallbackMap(distM);
}

function drawFallbackMap(distM) {
  document.getElementById("mapCanvasWrap").classList.add("hidden");
  const c = document.getElementById("mapFallback");
  c.classList.remove("hidden");
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#19283b";
  for (let x = 0; x <= c.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke(); }
  for (let y = 0; y <= c.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke(); }
  ctx.fillStyle = "#10b981"; ctx.beginPath(); ctx.arc(140, 175, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.arc(480, 70, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#38bdf8"; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(140, 175); ctx.lineTo(480, 70); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#f1f6fc"; ctx.font = "12px sans-serif"; ctx.fillText(`Tú · Antena ~${distM} m`, 160, 165);
}

function saveLog(msg) {
  const arr = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  arr.unshift({ t: new Date().toLocaleTimeString(), msg });
  localStorage.setItem(LOG_KEY, JSON.stringify(arr.slice(0, 30)));
  renderLog();
}

function renderLog() {
  const arr = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  document.getElementById("logList").innerHTML = arr.length
    ? arr.map((r) => `<div class="hist-row"><span>${r.t}</span><span>${r.msg}</span></div>`).join("")
    : `<div class="hist-row"><span>Sin registros</span><span>--</span></div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  const selTech = document.getElementById("selTech"), selBand = document.getElementById("selBand");
  const fillBands = () => {
    const list = BANDS[selTech.value] || BANDS.LTE;
    selBand.innerHTML = list.map((b, i) => `<option value="${i}">${b.code}</option>`).join("");
    updatePadSummary();
  };
  const updatePadSummary = () => {
    const b = (BANDS[selTech.value] || BANDS.LTE)[Number(selBand.value) || 0];
    const pad = document.getElementById("selPadType").value;
    const gap = document.getElementById("inpGapMm").value || 4;
    document.getElementById("padSummary").innerHTML = `<strong>${b.code}</strong> (${b.mhz} MHz) · Modo: <strong>${pad}</strong> · Holgura: <strong>${gap} mm</strong><br>${b.note}. Sin conector directo al teléfono.`;
    document.getElementById("cFreq").value = b.mhz;
    renderAntennaPlans(b.mhz, Number(document.getElementById("cLen").value) || 3, document.getElementById("cCable").value);
  };

  document.querySelectorAll(".tab").forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "maptab") { updateMapView(); if (leafletMap) setTimeout(() => leafletMap.invalidateSize(), 150); }
    if (btn.dataset.tab === "align") drawAlignmentBoard();
  }));

  document.querySelectorAll(".lp-card").forEach((card) => {
    const bar = card.querySelector(".lp-bar");
    let t = null, raf = null, t0 = 0;
    const stop = () => { clearTimeout(t); cancelAnimationFrame(raf); if (bar) bar.style.width = "0%"; };
    card.addEventListener("pointerdown", () => {
      t0 = performance.now();
      const loop = (now) => { const p = Math.min(100, ((now - t0) / LONG_PRESS_MS) * 100); if (bar) bar.style.width = p + "%"; if (p < 100) raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      t = setTimeout(() => {
        stop();
        const g = GUIDES[card.dataset.k] || GUIDES.sig;
        document.getElementById("gTitle").textContent = g.title;
        document.getElementById("gDesc").textContent = g.desc;
        document.getElementById("gSteps").innerHTML = g.steps.map((s) => `<li>${s}</li>`).join("");
        document.getElementById("guideModal").classList.remove("hidden");
      }, LONG_PRESS_MS);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => card.addEventListener(ev, stop));
  });

  // Arrastrar directamente el canvas de alineación para mover/girar el teléfono sobre la tablita
  const ac = document.getElementById("alignCanvas");
  ac.addEventListener("pointermove", (e) => {
    if (!alignActive && e.buttons === 0) return;
    const r = ac.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    phoneX = Math.max(-45, Math.min(45, Math.round(nx * 45)));
    phoneY = Math.max(-35, Math.min(35, Math.round(ny * 35)));
    phoneAngle = Math.round(((Math.atan2(ny, nx) * 180) / Math.PI + 360) % 360);
    drawAlignmentBoard();
  });

  selTech.addEventListener("change", fillBands);
  selBand.addEventListener("change", updatePadSummary);
  document.getElementById("selPadType").addEventListener("change", updatePadSummary);
  document.getElementById("inpGapMm").addEventListener("input", updatePadSummary);
  ["cFreq", "cLen", "cCable"].forEach((id) => document.getElementById(id).addEventListener("input", () => {
    renderAntennaPlans(Number(document.getElementById("cFreq").value) || 1842, Number(document.getElementById("cLen").value) || 3, document.getElementById("cCable").value);
  }));

  document.getElementById("btnStartAlign").addEventListener("click", startAlignmentMode);
  document.getElementById("btnStopAlign").addEventListener("click", stopAlignmentMode);
  document.getElementById("btnMarkPeak").addEventListener("click", () => {
    bestDbm = liveDbm;
    bestInfo = `${Math.round(phoneAngle)}° · X:${phoneX} Y:${phoneY}mm`;
    document.getElementById("mBest").textContent = `${bestDbm} dBm`;
    document.getElementById("mBestPos").textContent = bestInfo;
    saveLog(`Punto óptimo ${bestDbm} dBm en ${bestInfo}`);
  });
  document.getElementById("btnScanNow").addEventListener("click", () => { pullNativeTelemetry(); drawAlignmentBoard(); saveLog(`Escaneo: ${liveDbm} dBm (${liveFreq} MHz)`); });
  document.getElementById("btnOpenNet").addEventListener("click", () => { if (window.AntenaBridge && window.AntenaBridge.openNetworkSettings) try { window.AntenaBridge.openNetworkSettings(); } catch (_) {} });
  document.getElementById("btnPing").addEventListener("click", async () => {
    const t0 = performance.now();
    try { await fetch("https://www.openstreetmap.org/favicon.ico?_=" + Date.now(), { cache: "no-store", mode: "no-cors" }); const ms = Math.max(10, Math.round(performance.now() - t0)); document.getElementById("pingOut").textContent = `Ping: ${ms} ms`; saveLog(`Ping ${ms} ms`); }
    catch (_) { document.getElementById("pingOut").textContent = "Ping: Sin red / Offline"; }
  });
  document.getElementById("btnClearLog").addEventListener("click", () => { localStorage.removeItem(LOG_KEY); renderLog(); });
  document.getElementById("btnCloseG").addEventListener("click", () => document.getElementById("guideModal").classList.add("hidden"));
  document.getElementById("btnOkG").addEventListener("click", () => document.getElementById("guideModal").classList.add("hidden"));

  fillBands();
  pullNativeTelemetry();
  drawAlignmentBoard();
  renderLog();
});

let alignTimer = null, alignActive = false;
let phoneX = 0, phoneY = 0, phoneAngle = 0;
let bestDbm = -120, bestLabel = "Sin marcar";
let liveDbm = -87, liveSinr = 8, liveFreq = 1842, liveBand = "LTE B3", liveLat = 23.1136, liveLon = -82.3666;
let leafletMap = null, uM = null, aM = null, rL = null;

function drawBoard() {
  const c = document.getElementById("alignCanvas");
  if (!c) return;
  const ctx = c.getContext("2d");
  const w = c.width, h = c.height;
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "#132133";
  for (let x = 0; x <= w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  const px0 = 65, py0 = 24, pw = w - 130, ph = h - 48;
  ctx.fillStyle = "#101b29";
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(px0, py0, pw, ph, 14);
  ctx.fill();
  ctx.stroke();

  const cx = w / 2, cy = h / 2;
  const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 80);
  glow.addColorStop(0, "rgba(16, 185, 129, 0.35)");
  glow.addColorStop(1, "rgba(16, 185, 129, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 80, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8fa4bf";
  ctx.font = "11px sans-serif";
  ctx.fillText("TABLITA SIN CONECTOR (APOYO)", px0 + 12, py0 + 18);

  ctx.save();
  ctx.translate(cx + phoneX * 1.3, cy + phoneY * 1.1);
  ctx.rotate((phoneAngle * Math.PI) / 180);
  ctx.fillStyle = alignActive ? "rgba(16, 185, 129, 0.24)" : "rgba(56, 189, 248, 0.16)";
  ctx.strokeStyle = alignActive ? "#10b981" : "#38bdf8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-28, -50, 56, 100, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(0, -35, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f1f6fc";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText("CEL", -11, 5);
  ctx.restore();

  const deg = Math.round(((phoneAngle % 360) + 360) % 360);
  document.getElementById("hudAngle").textContent = `${deg}°`;
  document.getElementById("hudXY").textContent = `${Math.round(phoneX)} / ${Math.round(phoneY)} mm`;
  document.getElementById("hudGain").textContent = `${liveDbm} dBm · ${alignActive ? "GIRANDO" : "PAUSA"}`;
}

function startAlign() {
  alignActive = true;
  let tick = 0;
  clearInterval(alignTimer);
  alignTimer = setInterval(() => {
    tick += 1;
    readTelemetry();
    phoneAngle = (phoneAngle + 15) % 360;
    phoneX = Math.round(Math.sin(tick * 0.35) * 26);
    phoneY = Math.round(Math.cos(tick * 0.25) * 16);
    const est = liveDbm + Math.round(Math.cos((phoneAngle * Math.PI) / 180) * 3);
    if (est > bestDbm) {
      bestDbm = est;
      bestLabel = `${Math.round(phoneAngle)}° · X:${phoneX} Y:${phoneY}mm`;
      document.getElementById("mBest").textContent = `${bestDbm} dBm`;
      document.getElementById("mBestPos").textContent = bestLabel;
    }
    drawBoard();
  }, 320);
  drawBoard();
}

function stopAlign() {
  alignActive = false;
  clearInterval(alignTimer);
  drawBoard();
}

function readTelemetry() {
  let d = null;
  if (window.AntenaBridge && typeof window.AntenaBridge.getTelemetryJson === "function") {
    try { d = JSON.parse(window.AntenaBridge.getTelemetryJson()); } catch (_) {}
  }
  liveDbm = d && typeof d.dbm === "number" ? d.dbm : -87;
  liveSinr = d && typeof d.sinr === "number" ? d.sinr : 8;
  liveFreq = d && typeof d.freqMhz === "number" ? d.freqMhz : 1842;
  liveBand = d && d.band ? d.band : "LTE B3";
  if (d && typeof d.lat === "number") liveLat = d.lat;
  if (d && typeof d.lon === "number") liveLon = d.lon;

  const pct = Math.max(5, Math.min(100, Math.round(((Math.max(-120, Math.min(-55, liveDbm)) + 120) / 65) * 100)));
  document.getElementById("mDbm").textContent = `${liveDbm} dBm`;
  document.getElementById("mDbmSub").textContent = liveDbm >= -80 ? "Fuerte" : liveDbm >= -95 ? "Media" : "Débil";
  document.getElementById("mDbmBar").style.width = `${pct}%`;
  document.getElementById("mSinr").textContent = `${liveSinr} dB`;
  document.getElementById("mFreq").textContent = `${liveFreq} MHz`;
  document.getElementById("mFreqSub").textContent = liveBand;

  const list = document.getElementById("scanList");
  const cells = (d && Array.isArray(d.cellList)) ? d.cellList : [];
  const wifis = (d && Array.isArray(d.wifiList)) ? d.wifiList : [];
  const rows = [
    ...cells.map((x) => `<div class="box"><strong>${x.tech || "Celda"}</strong> · ${x.band || ""} · <strong>${x.dbm} dBm</strong></div>`),
    ...wifis.map((w) => `<div class="box"><strong>${w.ssid || "Wi-Fi"}</strong> · ${w.freqMhz} MHz · <strong>${w.rssi} dBm</strong></div>`)
  ];
  list.innerHTML = rows.length ? rows.join("") : `<div class="box">Pulsa Escanear o permite ubicación para ver celdas y redes.</div>`;
}

function updateMap() {
  const distM = Math.max(30, Math.round(60 * Math.pow(10, (-68 - Math.max(-120, Math.min(-45, liveDbm))) / 34)));
  document.getElementById("mapInfo").textContent = `GPS: ${liveLat.toFixed(5)}, ${liveLon.toFixed(5)} · Distancia est.: ~${distM} m`;
  const aLat = liveLat + (distM / 111320) * 0.7;
  const aLon = liveLon + (distM / (111320 * Math.max(0.2, Math.cos((liveLat * Math.PI) / 180)))) * 0.7;

  if (typeof L !== "undefined" && navigator.onLine) {
    document.getElementById("mapCanvasWrap").classList.remove("hidden");
    document.getElementById("mapFallback").classList.add("hidden");
    if (!leafletMap) {
      leafletMap = L.map("mapCanvasWrap").setView([liveLat, liveLon], 15);
      const t = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OSM" });
      t.on("tileerror", () => drawFallbackMap(distM));
      t.addTo(leafletMap);
    } else leafletMap.setView([liveLat, liveLon], 15);
    if (uM) leafletMap.removeLayer(uM);
    if (aM) leafletMap.removeLayer(aM);
    if (rL) leafletMap.removeLayer(rL);
    uM = L.circleMarker([liveLat, liveLon], { radius: 7, color: "#10b981" }).addTo(leafletMap);
    aM = L.circleMarker([aLat, aLon], { radius: 7, color: "#f59e0b" }).addTo(leafletMap);
    rL = L.polyline([[liveLat, liveLon], [aLat, aLon]], { color: "#38bdf8", dashArray: "6,6" }).addTo(leafletMap);
  } else drawFallbackMap(distM);
}

function drawFallbackMap(distM) {
  document.getElementById("mapCanvasWrap").classList.add("hidden");
  const c = document.getElementById("mapFallback");
  c.classList.remove("hidden");
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#10b981"; ctx.beginPath(); ctx.arc(140, 165, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.arc(470, 75, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#38bdf8"; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(140, 165); ctx.lineTo(470, 75); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#f1f6fc"; ctx.font = "12px sans-serif"; ctx.fillText(`Tú · Antena ~${distM} m`, 160, 155);
}

function addLog(msg) {
  const arr = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  arr.unshift({ t: new Date().toLocaleTimeString(), msg });
  localStorage.setItem(LOG_KEY, JSON.stringify(arr.slice(0, 30)));
  renderLog();
}

function renderLog() {
  const arr = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  document.getElementById("logList").innerHTML = arr.length
    ? arr.map((r) => `<div class="hist-row"><span>${r.t}</span><span>${r.msg}</span></div>`).join("")
    : `<div class="hist-row"><span>Sin registros</span><span>--</span></div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  const selTech = document.getElementById("selTech"), selBand = document.getElementById("selBand");
  const updatePad = () => {
    const b = (BANDS[selTech.value] || BANDS.LTE)[Number(selBand.value) || 0];
    const gap = document.getElementById("inpGapMm").value || 4;
    document.getElementById("padSummary").innerHTML = `<strong>${b.code}</strong> (${b.mhz} MHz) · Holgura: <strong>${gap} mm</strong> · ${b.note}. Sin enchufar cable al teléfono.`;
    document.getElementById("cFreq").value = b.mhz;
    renderAntennaPlans(b.mhz, Number(document.getElementById("cLen").value) || 3, document.getElementById("cCable").value);
  };
  const fillBands = () => {
    const list = BANDS[selTech.value] || BANDS.LTE;
    selBand.innerHTML = list.map((b, i) => `<option value="${i}">${b.code}</option>`).join("");
    updatePad();
  };

  document.querySelectorAll(".tab").forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "maptab") { updateMap(); if (leafletMap) setTimeout(() => leafletMap.invalidateSize(), 150); }
    if (btn.dataset.tab === "align") drawBoard();
  }));

  const ac = document.getElementById("alignCanvas");
  ac.addEventListener("pointermove", (e) => {
    if (!alignActive && e.buttons === 0) return;
    const r = ac.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    phoneX = Math.max(-42, Math.min(42, Math.round(nx * 42)));
    phoneY = Math.max(-32, Math.min(32, Math.round(ny * 32)));
    phoneAngle = Math.round(((Math.atan2(ny, nx) * 180) / Math.PI + 360) % 360);
    drawBoard();
  });

  selTech.addEventListener("change", fillBands);
  selBand.addEventListener("change", updatePad);
  document.getElementById("inpGapMm").addEventListener("input", updatePad);
  ["cFreq", "cLen", "cCable"].forEach((id) => document.getElementById(id).addEventListener("input", () => {
    renderAntennaPlans(Number(document.getElementById("cFreq").value) || 1842, Number(document.getElementById("cLen").value) || 3, document.getElementById("cCable").value);
  }));

  document.getElementById("btnStartAlign").addEventListener("click", startAlign);
  document.getElementById("btnStopAlign").addEventListener("click", stopAlign);
  document.getElementById("btnMarkPeak").addEventListener("click", () => {
    bestDbm = liveDbm;
    bestLabel = `${Math.round(phoneAngle)}° · X:${phoneX} Y:${phoneY}mm`;
    document.getElementById("mBest").textContent = `${bestDbm} dBm`;
    document.getElementById("mBestPos").textContent = bestLabel;
    addLog(`Pico ${bestDbm} dBm en ${bestLabel}`);
  });
  document.getElementById("btnScanNow").addEventListener("click", () => { readTelemetry(); drawBoard(); addLog(`Lectura ${liveDbm} dBm (${liveFreq} MHz)`); });
  document.getElementById("btnOpenNet").addEventListener("click", () => { if (window.AntenaBridge && window.AntenaBridge.openNetworkSettings) try { window.AntenaBridge.openNetworkSettings(); } catch (_) {} });
  document.getElementById("btnPing").addEventListener("click", async () => {
    const t0 = performance.now();
    try { await fetch("https://www.openstreetmap.org/favicon.ico?_=" + Date.now(), { cache: "no-store", mode: "no-cors" }); const ms = Math.max(10, Math.round(performance.now() - t0)); document.getElementById("pingOut").textContent = `Ping: ${ms} ms`; addLog(`Ping ${ms} ms`); }
    catch (_) { document.getElementById("pingOut").textContent = "Ping: Sin red / Offline"; }
  });
  document.getElementById("btnClearLog").addEventListener("click", () => { localStorage.removeItem(LOG_KEY); renderLog(); });
  document.getElementById("btnCloseG").addEventListener("click", () => document.getElementById("guideModal").classList.add("hidden"));
  document.getElementById("btnOkG").addEventListener("click", () => document.getElementById("guideModal").classList.add("hidden"));

  fillBands();
  readTelemetry();
  drawBoard();
  renderLog();
});
