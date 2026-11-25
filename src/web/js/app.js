const LONG_PRESS_MS = 3000;
const STORAGE_KEY = "antena_libre_v1_4_history";
const SPEED_OF_LIGHT_M_PER_SEC = 299.792458;

const BAND_CATALOG = {
  LTE: [
    { code: "B28 (700 MHz)", mhz: 758, role: "Máximo alcance y penetración en muros" },
    { code: "B20 (800 MHz)", mhz: 806, role: "Cobertura amplia e interiores" },
    { code: "B8 (900 MHz)", mhz: 942, role: "Alcance sólido con capacidad media" },
    { code: "B3 (1800 MHz)", mhz: 1842, role: "Equilibrio velocidad y cobertura" },
    { code: "B1 (2100 MHz)", mhz: 2140, role: "Buena capacidad de datos" },
    { code: "B7 (2600 MHz)", mhz: 2655, role: "Alta velocidad a menor distancia" }
  ],
  NR: [
    { code: "n28 (700 MHz)", mhz: 773, role: "5G de largo alcance" },
    { code: "n41 (2500 MHz)", mhz: 2595, role: "5G de alta capacidad" },
    { code: "n78 (3500 MHz)", mhz: 3500, role: "5G alta velocidad en línea de vista" }
  ],
  UMTS: [
    { code: "B5 (850 MHz)", mhz: 880, role: "3G alcance extendido" },
    { code: "B8 (900 MHz)", mhz: 942, role: "3G penetración" },
    { code: "B1 (2100 MHz)", mhz: 2140, role: "3G estándar" }
  ],
  GSM: [
    { code: "GSM 850", mhz: 881, role: "Voz y señal de largo alcance" },
    { code: "GSM 900", mhz: 942, role: "Cobertura clásica" },
    { code: "DCS 1800", mhz: 1842, role: "Capacidad urbana" }
  ],
  WIFI: [
    { code: "Wi-Fi 2.4 GHz (Ch 1)", mhz: 2412, role: "Mayor alcance y muros" },
    { code: "Wi-Fi 2.4 GHz (Ch 6)", mhz: 2437, role: "Canal central 2.4 GHz" },
    { code: "Wi-Fi 5 GHz (Ch 36)", mhz: 5180, role: "Alta velocidad cerca" },
    { code: "Wi-Fi 5 GHz (Ch 149)", mhz: 5745, role: "Enlace cercano rápido" }
  ]
};

const CABLE_SPECS = {
  RG58:   { name: "RG-58 (50 Ω)", loss1GPer100m: 46.5, vf: 0.66 },
  RG6:    { name: "RG-6 Quad (75 Ω)", loss1GPer100m: 19.6, vf: 0.82 },
  LMR200: { name: "LMR-200 (50 Ω)", loss1GPer100m: 34.4, vf: 0.83 },
  LMR400: { name: "LMR-400 (50 Ω)", loss1GPer100m: 13.1, vf: 0.85 }
};

const METRIC_GUIDES = {
  rsrp: { title: "Señal (dBm / RSRP / RSSI)", what: "Mide la potencia recibida. Entre -65 y -80 dBm es fuerte; -81 a -95 dBm es media; bajo -100 dBm es débil.", steps: ["Sube el equipo 1.5–2 m cerca de ventana o zona alta.", "Aléjalo de muros gruesos, metal o motores.", "Acorta cable coaxial y gira despacio buscando el mejor dBm."] },
  sinr: { title: "Calidad / SINR (dB)", what: "Relación entre señal útil y ruido/interferencia. >= 10 dB indica señal limpia.", steps: ["Cambia de canal Wi-Fi si está saturado.", "Separa receptores de fuentes de ruido eléctrico.", "Evita rebotes metálicos cercanos."] },
  freq: { title: "Frecuencia Actual (MHz)", what: "Frecuencias bajas llegan más lejos y pasan mejor muros; altas dan más velocidad cerca.", steps: ["Revisa 'Frecuencia Conectada vs. Recomendada'.", "Prueba bandas en el Selector de Bandas.", "Prioriza baja frecuencia si estás lejos o tras muros."] },
  dist: { title: "Antena y Distancia Estimada", what: "Estima distancia aproximada según potencia y frecuencia; obstáculos alteran la lectura.", steps: ["Usa el mapa como referencia de dirección y distancia.", "Busca línea de vista elevando la antena.", "Combina con calculadora de cable y ganancia."] },
  advisor: { title: "Conectada vs. Recomendada", what: "Compara frecuencia actual con la sugerida según señal y modo.", steps: ["Abre Ajustes de red desde el botón.", "En Wi-Fi, 2.4 GHz da alcance y 5 GHz velocidad cerca.", "Valida cambios mirando el dBm y SINR."] },
  map: { title: "Mapa Local", what: "Muestra posición, antena estimada y distancia; usa mapa canvas si no hay red.", steps: ["Activa GPS y concede permiso de ubicación.", "Observa cómo varía la distancia al moverte.", "Úsalo para orientar antenas direccionales."] }
};

function fmtLen(m) {
  return m >= 1 ? `${m.toFixed(3)} m (${(m * 100).toFixed(1)} cm)` : `${(m * 100).toFixed(2)} cm (${(m * 1000).toFixed(1)} mm)`;
}

function buildAntennaPlans(freqMhz, cableType, cableLen) {
  const k = 0.95, lam = SPEED_OF_LIGHT_M_PER_SEC / Math.max(1, freqMhz), half = lam / 2;
  const cableInfo = CABLE_SPECS[cableType] || CABLE_SPECS.LMR200;
  const lossDb = (cableInfo.loss1GPer100m / 100) * Math.sqrt(Math.max(1, freqMhz) / 1000) * cableLen;
  const remPct = (Math.pow(10, -lossDb / 10) * 100).toFixed(1);
  return [
    { title: "1. Dipolo λ/2 (Omnidireccional)", howItWorks: "Dos elementos simétricos alimentados al centro.", materials: "2 varillas cobre/aluminio, soporte aislante, conector N/SO-239.", measurements: `Total: ${fmtLen(half * k)} · Cada brazo: ${fmtLen((half * k) / 2)}.`, cableRule: `${cableInfo.name} corto (${cableLen} m -> -${lossDb.toFixed(2)} dB, ~${remPct}% potencia).`, whyShortCable: "Menos metros de cable = menos pérdida de señal." },
    { title: "2. Yagi 3 Elementos (Direccional)", howItWorks: "Reflector atrás, dipolo activo al centro y director al frente.", materials: "Boom rígido, 3 varillas, aisladores y conector.", measurements: `Ref: ${fmtLen(half * 1.05 * k)} · Dip: ${fmtLen(half * k)} · Dir: ${fmtLen(half * 0.92 * k)}.`, cableRule: `${cableInfo.name} corto (${cableLen} m -> -${lossDb.toFixed(2)} dB).`, whyShortCable: "Evita perder la ganancia direccional en el cable." },
    { title: "3. Base / Cuna de Acoplamiento sin Conector", howItWorks: "Apoya el teléfono en una cuna alineada con la zona de antena interna sin enchufar cables al puerto.", materials: "Soporte/cuna no metálica, placa o bobina acopladora pasiva, topes fijos.", measurements: `Separación de prueba: 0–15 mm · Paso de ajuste: 2–5 mm (λ = ${fmtLen(lam)}).`, cableRule: `Suma pérdida de cable (${lossDb.toFixed(2)} dB) + acoplamiento (~8.5 dB típico).`, whyShortCable: "Al haber pérdida por acoplamiento, cada dB de cable extra pesa más." }
  ];
}

function estimateDistanceMeters(dbm, freqMhz) {
  const c = Math.max(-125, Math.min(-45, dbm));
  return Math.max(25, Math.round((60 * Math.pow(10, (-68 - c) / 34)) / Math.sqrt(Math.max(1, freqMhz) / 1800)));
}

let leafletMap = null, userLayer = null, antLayer = null, lineLayer = null, currentLang = "es";

function renderOfflineMap(distM) {
  document.getElementById("leafletMap").classList.add("hidden");
  const c = document.getElementById("fallbackMapCanvas");
  c.classList.remove("hidden");
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#1c2a3d"; ctx.lineWidth = 1;
  for (let x = 0; x <= c.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke(); }
  for (let y = 0; y <= c.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke(); }
  const ux = 140, uy = 230, ax = 480, ay = 95;
  ctx.setLineDash([8, 6]); ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ax, ay); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#10b981"; ctx.beginPath(); ctx.arc(ux, uy, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#eef4fb"; ctx.font = "bold 13px sans-serif"; ctx.fillText("Tú", ux - 10, uy + 26);
  ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.arc(ax, ay, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillText(`Antena (~${distM} m)`, ax - 55, ay - 16);
}

function updateMap(lat, lon, distM) {
  document.getElementById("mapCoords").textContent = `Coord.: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  document.getElementById("mapDistanceBadge").textContent = `~${distM} m`;
  const dLat = (distM / 111320) * 0.72;
  const dLon = (distM / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)))) * 0.68;
  const antLat = lat + dLat, antLon = lon + dLon;
  if (typeof L !== "undefined" && navigator.onLine) {
    document.getElementById("leafletMap").classList.remove("hidden");
    document.getElementById("fallbackMapCanvas").classList.add("hidden");
    if (!leafletMap) {
      leafletMap = L.map("leafletMap").setView([lat, lon], 15);
      const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
      tiles.on("tileerror", () => renderOfflineMap(distM));
      tiles.addTo(leafletMap);
    } else leafletMap.setView([lat, lon], 15);
    if (userLayer) leafletMap.removeLayer(userLayer);
    if (antLayer) leafletMap.removeLayer(antLayer);
    if (lineLayer) leafletMap.removeLayer(lineLayer);
    userLayer = L.circleMarker([lat, lon], { radius: 8, color: "#10b981", fillOpacity: 0.9 }).addTo(leafletMap);
    antLayer = L.circleMarker([antLat, antLon], { radius: 8, color: "#f59e0b", fillOpacity: 0.9 }).addTo(leafletMap);
    lineLayer = L.polyline([[lat, lon], [antLat, antLon]], { color: "#38bdf8", weight: 2.5, dashArray: "6,6" }).addTo(leafletMap);
  } else renderOfflineMap(distM);
}

function saveHistorySample(dbm, sinr, freqMhz, distM) {
  const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  arr.unshift({ ts: new Date().toLocaleTimeString(), dbm, sinr, freqMhz, distM });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, 40)));
}

function renderHistory() {
  const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  document.getElementById("historyList").innerHTML = arr.length
    ? arr.map((r) => `<div class="history-item"><span>${r.ts} · ${r.freqMhz} MHz</span><span>${r.dbm} dBm · ~${r.distM} m</span></div>`).join("")
    : `<div class="history-item"><span>Sin muestras</span><span>Toca Escanear</span></div>`;
  const c = document.getElementById("historyCanvas"), ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  if (arr.length < 2) return;
  const s = [...arr].reverse();
  ctx.strokeStyle = "#10b981"; ctx.lineWidth = 2; ctx.beginPath();
  s.forEach((item, idx) => {
    const x = (idx / (s.length - 1)) * (c.width - 24) + 12;
    const y = c.height - 16 - Math.max(0, Math.min(1, (item.dbm + 120) / 70)) * (c.height - 32);
    if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderScans(data) {
  const wrap = document.getElementById("scanResultsList");
  const cells = (data && Array.isArray(data.cellList)) ? data.cellList : [];
  const wifis = (data && Array.isArray(data.wifiList)) ? data.wifiList : [];
  const rows = [
    ...cells.map((c) => `<div class="info-box"><strong>${c.tech || "Celda"}</strong> · ${c.band || ""} · PCI ${c.pci || 0} · <strong>${c.dbm} dBm</strong></div>`),
    ...wifis.map((w) => `<div class="info-box"><strong>${w.ssid || "Wi-Fi"}</strong> · ${w.freqMhz} MHz · <strong>${w.rssi} dBm</strong></div>`)
  ];
  wrap.innerHTML = rows.length ? rows.join("") : `<div class="info-box">Activa ubicación/permisos o pulsa Escanear para ver celdas y redes cercanas.</div>`;
}

function refreshTelemetry() {
  let d = null;
  if (window.AntenaBridge && typeof window.AntenaBridge.getTelemetryJson === "function") {
    try { d = JSON.parse(window.AntenaBridge.getTelemetryJson()); } catch (_) {}
  }
  const dbm = d && typeof d.dbm === "number" ? d.dbm : -87;
  const sinr = d && typeof d.sinr === "number" ? d.sinr : 8;
  const freqMhz = d && typeof d.freqMhz === "number" ? d.freqMhz : 1800;
  const bandLabel = d && d.band ? d.band : "Banda Auto";
  const isWifi = d && d.mode === "WIFI";
  const distM = estimateDistanceMeters(dbm, freqMhz);
  const pct = Math.max(5, Math.min(100, Math.round(((Math.max(-120, Math.min(-55, dbm)) + 120) / 65) * 100)));

  document.getElementById("mSignal").textContent = `${dbm} dBm`;
  document.getElementById("mSignalSub").textContent = dbm >= -80 ? "Señal fuerte" : dbm >= -95 ? "Señal media" : "Señal débil";
  document.getElementById("sigMeterFill").style.width = `${pct}%`;
  document.getElementById("mSinr").textContent = `${sinr} dB`;
  document.getElementById("mFreq").textContent = `${freqMhz} MHz`;
  document.getElementById("mFreqSub").textContent = bandLabel;
  document.getElementById("mDist").textContent = `~${distM} m`;
  document.getElementById("linkModePill").textContent = isWifi ? "WI-FI" : "CELULAR";
  document.getElementById("freqNow").textContent = `${freqMhz} MHz (${bandLabel})`;
  document.getElementById("freqBest").textContent = dbm < -90
    ? (isWifi ? "Wi-Fi 2.4 GHz (alcance/muros)" : "Banda baja 700–900 MHz")
    : (isWifi ? "Wi-Fi 5 GHz (velocidad cerca)" : "Banda media/alta 1800+ MHz");
  document.getElementById("freqGuideText").textContent = "Ajusta en Ajustes de red o simula en Selector de Bandas y Planos y Cables.";
  document.getElementById("coachAdvice").textContent = dbm < -88
    ? "Sube el equipo 1.5–2 m, aléjalo de muros/metal y usa cable corto de baja pérdida."
    : "Buen nivel base: evita cables coaxiales largos o doblados.";

  updateMap(d && typeof d.lat === "number" ? d.lat : 23.1136, d && typeof d.lon === "number" ? d.lon : -82.3666, distM);
  saveHistorySample(dbm, sinr, freqMhz, distM);
  renderScans(d);
}

function recalcCableAndPlans() {
  const freq = Math.max(50, Number(document.getElementById("calcFreq").value) || 2412);
  const len = Math.max(0.1, Number(document.getElementById("calcCableLen").value) || 5);
  const cableKey = document.getElementById("calcCableType").value;
  const dist = Math.max(10, Number(document.getElementById("calcDist").value) || 800);
  const cable = CABLE_SPECS[cableKey] || CABLE_SPECS.LMR200;
  const lossDb = (cable.loss1GPer100m / 100) * Math.sqrt(freq / 1000) * len;
  const fsplDb = 20 * Math.log10(dist / 1000) + 20 * Math.log10(freq) + 32.44;
  document.getElementById("cablePhysicsBox").innerHTML = `<div><strong>${freq} MHz</strong> · Cable <strong>${cable.name}</strong> (${len} m) -> pérdida <strong>-${lossDb.toFixed(2)} dB</strong> · Espacio libre (${dist} m): <strong>~${fsplDb.toFixed(1)} dB</strong>.</div>`;
  const cont = document.getElementById("antennaPlansContainer");
  cont.innerHTML = "";
  buildAntennaPlans(freq, cableKey, len).forEach((p) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<h3>${p.title}</h3><ul class="spec-list"><li><strong>Funcionamiento:</strong> ${p.howItWorks}</li><li><strong>Materiales:</strong> ${p.materials}</li><li><strong>Medidas:</strong> ${p.measurements}</li><li><strong>Cable / Cuna:</strong> ${p.cableRule}</li><li><strong>Por qué cable corto:</strong> ${p.whyShortCable}</li></ul>`;
    cont.appendChild(div);
  });
}

function openGuideModal(key) {
  const item = METRIC_GUIDES[key] || METRIC_GUIDES.rsrp;
  document.getElementById("modalTitle").textContent = item.title;
  document.getElementById("modalWhat").textContent = item.what;
  document.getElementById("modalSteps").innerHTML = item.steps.map((s) => `<li>${s}</li>`).join("");
  document.getElementById("guideModal").classList.remove("hidden");
}

function openAndroidNetworkSettings() {
  if (window.AntenaBridge && typeof window.AntenaBridge.openNetworkSettings === "function") {
    try { window.AntenaBridge.openNetworkSettings(); return; } catch (_) {}
  }
  openGuideModal("advisor");
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab").forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "panel" && leafletMap) setTimeout(() => leafletMap.invalidateSize(), 160);
    if (btn.dataset.tab === "diag") renderHistory();
  }));
  document.querySelectorAll(".lp-card").forEach((card) => {
    const bar = card.querySelector(".lp-progress");
    let timer = null, raf = null, t0 = 0;
    const cancel = () => { clearTimeout(timer); cancelAnimationFrame(raf); if (bar) bar.style.width = "0%"; };
    card.addEventListener("pointerdown", () => {
      t0 = performance.now();
      const step = (now) => { const pct = Math.min(100, ((now - t0) / LONG_PRESS_MS) * 100); if (bar) bar.style.width = pct + "%"; if (pct < 100) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
      timer = setTimeout(() => { cancel(); openGuideModal(card.dataset.metric); }, LONG_PRESS_MS);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => card.addEventListener(ev, cancel));
  });
  const techSel = document.getElementById("bandTechSelect"), itemSel = document.getElementById("bandItemSelect"), goalSel = document.getElementById("bandGoalSelect");
  const renderBand = () => {
    const b = (BAND_CATALOG[techSel.value] || BAND_CATALOG.LTE)[Number(itemSel.value) || 0];
    document.getElementById("bandDetailsBox").innerHTML = `<strong>${b.code}</strong> · ${b.mhz} MHz · λ: <strong>${fmtLen(SPEED_OF_LIGHT_M_PER_SEC / b.mhz)}</strong><br>${b.role}`;
  };
  const fillBands = () => {
    const list = BAND_CATALOG[techSel.value] || BAND_CATALOG.LTE;
    itemSel.innerHTML = list.map((b, i) => `<option value="${i}">${b.code}</option>`).join("");
    renderBand();
  };
  techSel.addEventListener("change", fillBands); itemSel.addEventListener("change", renderBand); goalSel.addEventListener("change", renderBand);
  document.getElementById("btnApplyBandToCalc").addEventListener("click", () => {
    const b = (BAND_CATALOG[techSel.value] || BAND_CATALOG.LTE)[Number(itemSel.value) || 0];
    document.getElementById("calcFreq").value = b.mhz; recalcCableAndPlans(); document.querySelector('.tab[data-tab="antenas"]').click();
  });
  ["calcFreq", "calcCableLen", "calcCableType", "calcDist"].forEach((id) => document.getElementById(id).addEventListener("input", recalcCableAndPlans));
  document.getElementById("btnRefresh").addEventListener("click", refreshTelemetry);
  document.getElementById("btnWifiScan").addEventListener("click", () => { if (window.AntenaBridge && window.AntenaBridge.scanWifi) try { window.AntenaBridge.scanWifi(); } catch (_) {} refreshTelemetry(); });
  document.getElementById("btnOpenNetSettings").addEventListener("click", openAndroidNetworkSettings);
  document.getElementById("btnOpenBandSettings").addEventListener("click", openAndroidNetworkSettings);
  document.getElementById("btnClearHistory").addEventListener("click", () => { localStorage.removeItem(STORAGE_KEY); renderHistory(); });
  document.getElementById("btnCloseModal").addEventListener("click", () => document.getElementById("guideModal").classList.add("hidden"));
  document.getElementById("btnModalOk").addEventListener("click", () => document.getElementById("guideModal").classList.add("hidden"));
  fillBands(); recalcCableAndPlans(); refreshTelemetry(); renderHistory();
  setInterval(refreshTelemetry, 6000);
});
