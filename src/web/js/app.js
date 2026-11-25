const LONG_PRESS_MS = 3000;
const STORAGE_KEY = "antena_libre_history_v1";

const BAND_CATALOG = {
  LTE: [
    { code: "B28 (700 MHz)", mhz: 758, role: "Máximo alcance y penetración en interiores / zonas rurales" },
    { code: "B20 (800 MHz)", mhz: 806, role: "Cobertura amplia y penetración en muros" },
    { code: "B8 (900 MHz)", mhz: 942, role: "Buen alcance con capacidad moderada" },
    { code: "B3 (1800 MHz)", mhz: 1842, role: "Equilibrio entre velocidad y cobertura urbana" },
    { code: "B1 (2100 MHz)", mhz: 2140, role: "Buena capacidad de datos en zonas pobladas" },
    { code: "B7 (2600 MHz)", mhz: 2655, role: "Alta velocidad a menor alcance y menor penetración" },
    { code: "B41 (2500 MHz TDD)", mhz: 2595, role: "Alta capacidad TDD en áreas con línea de vista" }
  ],
  NR: [
    { code: "n28 (700 MHz)", mhz: 773, role: "5G de largo alcance y cobertura profunda" },
    { code: "n78 (3500 MHz C-Band)", mhz: 3500, role: "5G de muy alta velocidad, menor alcance y penetración" },
    { code: "n41 (2500 MHz)", mhz: 2595, role: "5G de alta capacidad media" },
    { code: "n258 (26 GHz mmWave)", mhz: 26500, role: "Velocidad extrema en línea de vista muy corta" }
  ],
  UMTS: [
    { code: "B5 (850 MHz)", mhz: 880, role: "3G de alcance extendido" },
    { code: "B8 (900 MHz)", mhz: 942, role: "3G de buena penetración" },
    { code: "B1 (2100 MHz)", mhz: 2140, role: "3G estándar" }
  ],
  GSM: [
    { code: "GSM 850", mhz: 881, role: "Voz y señal básica de gran alcance" },
    { code: "GSM 900", mhz: 942, role: "Cobertura clásica de largo alcance" },
    { code: "DCS 1800", mhz: 1842, role: "Capacidad urbana" },
    { code: "PCS 1900", mhz: 1960, role: "Frecuencia regional de capacidad" }
  ]
};

const CABLE_LOSS_PER_100M_AT_1GHZ = {
  RG58: 46.5,
  RG6: 19.6,
  LMR200: 34.4,
  LMR400: 13.1
};

const METRIC_GUIDES = {
  rsrp: {
    title: "Intensidad de Señal (dBm / RSRP / RSSI)",
    what: "Mide la potencia real con la que llega la señal a tu dispositivo. Entre -65 y -80 dBm es excelente/buena; entre -81 y -95 dBm es regular; por debajo de -100 dBm se vuelve lenta o se desconecta.",
    steps: [
      "Sube el equipo o router 1.5 a 2 metros y acércalo a ventanas o zonas elevadas.",
      "Aléjalo de muros gruesos, bloques de concreto, láminas de zinc/aluminio, microondas y motores.",
      "Si usas antena exterior, acorta el cable coaxial y apunta hacia la dirección con mayor nivel de dBm."
    ]
  },
  sinr: {
    title: "Calidad de Enlace / SINR (dB)",
    what: "Compara la señal útil frente al ruido y la interferencia de otras celdas o redes. Valores >= 10 dB suelen dar buen rendimiento; valores negativos indican mucha interferencia.",
    steps: [
      "Cambia a un canal o frecuencia menos saturada si estás en Wi-Fi.",
      "Evita tener múltiples equipos transmitiendo pegados al receptor.",
      "Busca una ubicación con menos rebotes o reflexión metálica directa."
    ]
  },
  freq: {
    title: "Frecuencia Actual (MHz / GHz)",
    what: "Las frecuencias bajas (< 1000 MHz o 2.4 GHz) viajan más lejos y atraviesan mejor paredes; las frecuencias altas (>= 1800 MHz o 5 GHz) ofrecen mayor velocidad pero pierden fuerza más rápido con la distancia y los obstáculos.",
    steps: [
      "Revisa la tarjeta 'Frecuencia Conectada vs. Recomendada' para ver si te conviene cambiar de banda.",
      "En interiores lejanos a la torre/router, prioriza frecuencia baja/penetrante.",
      "Cerca de la fuente y sin muros, aprovecha frecuencia alta para mayor velocidad."
    ]
  },
  dist: {
    title: "Antena y Distancia Estimada",
    what: "Calcula una distancia aproximada hacia la antena/sector usando la potencia recibida, la frecuencia y la pérdida de trayectoria. Edificios, árboles y colinas hacen que la distancia real pueda variar.",
    steps: [
      "Mira el mapa para identificar la dirección aproximada del marcador de antena.",
      "Verifica si hay obstáculos físicos en esa dirección y eleva el punto de recepción.",
      "Si el enlace es largo o inestable, revisa el módulo 'Planos y Cables' para construir una antena direccional."
    ]
  },
  advisor: {
    title: "Asesor de Frecuencia Conectada vs. Recomendada",
    what: "Compara la banda/frecuencia activa con la más adecuada según tu nivel de señal y tipo de red para darte pasos concretos de cambio.",
    steps: [
      "Toca 'Ajustes de Red / Banda' para ir a la configuración de red del sistema.",
      "En Wi-Fi, alterna entre 2.4 GHz (alcance/paredes) y 5 GHz (velocidad cerca).",
      "En red móvil, comprueba el modo de red preferido o desplázate unos metros para captar un mejor sector."
    ]
  },
  map: {
    title: "Mapa Local · Ubicación y Distancia de Antena",
    what: "Muestra tu ubicación (vía GPS o coordenada de respaldo), un marcador estimado de la antena y la distancia en línea recta. Si no hay conexión para cargar tiles externos, activa automáticamente el mapa offline.",
    steps: [
      "Activa el GPS / Ubicación del teléfono y concede el permiso de ubicación a la app.",
      "Camina o gira el receptor observando si la distancia estimada y los dBm mejoran.",
      "Usa la orientación del mapa como referencia inicial para apuntar antenas direccionales."
    ]
  }
};

const ANTENNA_PLANS = [
  {
    name: "Dipolo de Media Onda (λ/2)",
    signal: "Señal omnidireccional de base para bandas bajas/medias (ej. 700–900 MHz o 1800 MHz).",
    reach: "Alcance amplio en terreno abierto o semiabierto; ideal como punto de partida confiable.",
    materials: "2 varillas o tubos de cobre/aluminio (3–6 mm), soporte aislante (PVC/teflón), conector hembra N o SO-239, caja estanca.",
    cable: "Coaxial LMR-200 / LMR-400 (50 Ω) o RG-6 (75 Ω). Longitud recomendada: lo más corta posible (ideal < 3–5 m).",
    whyCableShort: "Cada metro de cable pierde dB por resistencia y dieléctrico. Un cable largo o delgado disipa la señal y reduce el alcance útil."
  },
  {
    name: "Antena Yagi Direccional (3 o 5 Elementos)",
    signal: "Enlace direccional de alta ganancia para apuntar hacia una torre o punto lejano.",
    reach: "Mayor alcance en el eje frontal y menor interferencia lateral/trasera.",
    materials: "Boom soporte, 1 reflector trasero, 1 dipolo activo, 2 a 4 directores de varilla de cobre/aluminio y conector N/SMA.",
    cable: "LMR-240 / LMR-400 lo más corto posible (1.5 a 4 m), con conectores sellados contra humedad.",
    whyCableShort: "A mayor frecuencia, mayor pérdida por metro; si el cable es demasiado largo, pierde más dB de los que aporta la Yagi."
  },
  {
    name: "Antena Ground-Plane (GP) con Radiales",
    signal: "Recepción/transmisión de horizonte bajo con plano de tierra radial.",
    reach: "Buen desempeño costero/abierto y recepción estable a baja elevación.",
    materials: "1 elemento vertical radiante + 3 o 4 radiales inclinados (~30°–45°), base metálica/conector chasis.",
    cable: "Cable coaxial de baja pérdida corto (< 4 m), evitando bucles apretados o aplastamientos.",
    whyCableShort: "Mantener el tramo corto minimiza atenuación y evita desadaptaciones por cables largos de mala calidad."
  },
  {
    name: "Antena Cantena / Guía de Onda Cilíndrica",
    signal: "Enlace direccional de corto/medio alcance en frecuencias altas (ej. 2.4 GHz).",
    reach: "Cientos de metros a ~1–2 km en línea de vista despejada con equipo compatible.",
    materials: "Lata metálica limpia de diámetro adecuado, sonda de cobre soldada al conector N/SMA, soporte.",
    cable: "Pigtail / coaxial corto de baja pérdida (ideal <= 1.5–2 m).",
    whyCableShort: "En 2.4 GHz un cable largo o RG-58 extenso pierde gran parte de la señal antes de llegar al equipo."
  },
  {
    name: "Reflector Parabólico / Corner Reflector",
    signal: "Alta direccionalidad para enfocar señal débil en enlaces puntuales.",
    reach: "Alcance superior en dirección focal con buena línea de vista.",
    materials: "Superficie reflectora (malla o lámina metálica curvada o en ángulo de 90°), alimentador (dipolo/biquad) en el punto focal.",
    cable: "Tramo mínimo de cable de baja pérdida entre alimentador y equipo.",
    whyCableShort: "La ganancia del reflector se desperdicia si el cable de bajada es largo o de alta atenuación."
  }
];

let leafletMap = null;
let userLayer = null;
let antLayer = null;
let lineLayer = null;
let currentLang = "es";

function wavelengthMeters(freqMhz) {
  return 300 / Math.max(1, freqMhz);
}

function cableAttenuationDb(cableType, freqMhz, lengthMeters) {
  const base1G = CABLE_LOSS_PER_100M_AT_1GHZ[cableType] || 25;
  const freqFactor = Math.sqrt(Math.max(1, freqMhz) / 1000);
  return (base1G / 100) * freqFactor * lengthMeters;
}

function estimateDistanceMeters(dbm, freqMhz) {
  const clamped = Math.max(-125, Math.min(-45, dbm));
  const freqCorr = Math.max(1, freqMhz) / 1800;
  return Math.max(25, Math.round((60 * Math.pow(10, (-68 - clamped) / 34)) / Math.sqrt(freqCorr)));
}

function initTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((s) => s.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "panel" && leafletMap) {
        setTimeout(() => leafletMap.invalidateSize(), 160);
      }
      if (btn.dataset.tab === "diag") {
        renderHistory();
      }
    });
  });
}

function initLongPress() {
  document.querySelectorAll(".lp-card").forEach((card) => {
    const bar = card.querySelector(".lp-progress");
    let timer = null;
    let raf = null;
    let t0 = 0;

    const start = () => {
      t0 = performance.now();
      const step = (now) => {
        const pct = Math.min(100, ((now - t0) / LONG_PRESS_MS) * 100);
        if (bar) bar.style.width = pct + "%";
        if (pct < 100) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);

      timer = setTimeout(() => {
        cancel();
        if (window.AntenaBridge && typeof window.AntenaBridge.vibrateMs === "function") {
          try { window.AntenaBridge.vibrateMs(60); } catch (_) {}
        }
        openGuideModal(card.dataset.metric);
      }, LONG_PRESS_MS);
    };

    const cancel = () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      if (bar) bar.style.width = "0%";
    };

    card.addEventListener("pointerdown", start);
    card.addEventListener("pointerup", cancel);
    card.addEventListener("pointerleave", cancel);
    card.addEventListener("pointercancel", cancel);
  });
}

function openGuideModal(key) {
  const item = METRIC_GUIDES[key] || METRIC_GUIDES.rsrp;
  document.getElementById("modalTitle").textContent = item.title;
  document.getElementById("modalWhat").textContent = item.what;
  const ul = document.getElementById("modalSteps");
  ul.innerHTML = "";
  item.steps.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    ul.appendChild(li);
  });
  document.getElementById("guideModal").classList.remove("hidden");
}

function initBandsTab() {
  const techSel = document.getElementById("bandTechSelect");
  const itemSel = document.getElementById("bandItemSelect");
  const box = document.getElementById("bandDetailsBox");

  const populateItems = () => {
    const list = BAND_CATALOG[techSel.value] || BAND_CATALOG.LTE;
    itemSel.innerHTML = "";
    list.forEach((b, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = b.code;
      itemSel.appendChild(opt);
    });
    updateBandBox();
  };

  const updateBandBox = () => {
    const list = BAND_CATALOG[techSel.value] || BAND_CATALOG.LTE;
    const b = list[Number(itemSel.value) || 0] || list[0];
    const lam = wavelengthMeters(b.mhz);
    const dipoleHalf = (lam * 0.475).toFixed(3);
    box.innerHTML = `
      <strong>${b.code}</strong> · Frecuencia central: <strong>${b.mhz} MHz</strong><br/>
      <span>Uso típico: ${b.role}</span><br/>
      <span>Longitud de onda (λ): <strong>${lam.toFixed(3)} m</strong> · Dipolo λ/2 aprox.: <strong>${dipoleHalf} m</strong></span>
    `;
  };

  techSel.addEventListener("change", populateItems);
  itemSel.addEventListener("change", updateBandBox);
  populateItems();
}

function initAntennaCalculatorAndPlans() {
  const freqInput = document.getElementById("calcFreq");
  const lenInput = document.getElementById("calcCableLen");
  const cableSel = document.getElementById("calcCableType");
  const distInput = document.getElementById("calcDist");
  const physBox = document.getElementById("cablePhysicsBox");

  const recalc = () => {
    const freq = Math.max(50, Number(freqInput.value) || 1800);
    const len = Math.max(0.2, Number(lenInput.value) || 5);
    const cable = cableSel.value;
    const dist = Math.max(10, Number(distInput.value) || 1000);

    const lam = wavelengthMeters(freq);
    const dipoleTotal = (lam * 0.475).toFixed(3);
    const dipoleArm = (lam * 0.2375).toFixed(3);
    const yagiReflector = (lam * 0.50).toFixed(3);
    const yagiDriven = (lam * 0.47).toFixed(3);
    const yagiDirector = (lam * 0.44).toFixed(3);

    const lossDb = cableAttenuationDb(cable, freq, len);
    const fsplDb = 20 * Math.log10(dist / 1000) + 20 * Math.log10(freq) + 32.44;

    physBox.innerHTML = `
      <div><strong>Medidas calculadas a ${freq} MHz (λ = ${lam.toFixed(3)} m):</strong></div>
      <div>• Dipolo λ/2: total <strong>${dipoleTotal} m</strong> (cada brazo <strong>${dipoleArm} m</strong>)</div>
      <div>• Yagi base: reflector <strong>${yagiReflector} m</strong> · dipolo <strong>${yagiDriven} m</strong> · director <strong>${yagiDirector} m</strong></div>
      <div>• Pérdida estimada en <strong>${len} m</strong> de <strong>${cable}</strong>: <strong style="color:var(--warn)">-${lossDb.toFixed(2)} dB</strong> (Pérdida de trayectoria libre a ${dist} m: ~${fsplDb.toFixed(1)} dB)</div>
      <div style="margin-top:4px;color:var(--muted)">Si alargas el cable sin cambiar a uno de menor pérdida, pierdes más potencia en el tramo y reduces el alcance efectivo.</div>
    `;
  };

  [freqInput, lenInput, cableSel, distInput].forEach((el) => el.addEventListener("input", recalc));
  recalc();

  const plansContainer = document.getElementById("antennaPlansContainer");
  plansContainer.innerHTML = "";
  ANTENNA_PLANS.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${p.name}</h3>
      <ul class="spec-list">
        <li><strong>Señal que capta:</strong> ${p.signal}</li>
        <li><strong>Distancia / Alcance:</strong> ${p.reach}</li>
        <li><strong>Materiales:</strong> ${p.materials}</li>
        <li><strong>Cable recomendado:</strong> ${p.cable}</li>
        <li><strong>Por qué no alargar el cable:</strong> ${p.whyCableShort}</li>
      </ul>
    `;
    plansContainer.appendChild(card);
  });
}

function renderOfflineMap(distM) {
  document.getElementById("leafletMap").classList.add("hidden");
  const c = document.getElementById("fallbackMapCanvas");
  c.classList.remove("hidden");
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);

  ctx.strokeStyle = "#1c2a3d";
  ctx.lineWidth = 1;
  for (let x = 0; x <= c.width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke();
  }
  for (let y = 0; y <= c.height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke();
  }

  const ux = 140, uy = 230;
  const ax = 480, ay = 95;

  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ax, ay); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#10b981";
  ctx.beginPath(); ctx.arc(ux, uy, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#eef4fb";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("Tú", ux - 10, uy + 26);

  ctx.fillStyle = "#f59e0b";
  ctx.beginPath(); ctx.arc(ax, ay, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#eef4fb";
  ctx.fillText(`Antena (~${distM} m)`, ax - 55, ay - 16);
}

function updateMap(lat, lon, distM) {
  document.getElementById("mapCoords").textContent = `Coord.: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  document.getElementById("mapDistanceBadge").textContent = `~${distM} m`;

  const dLat = (distM / 111320) * 0.72;
  const dLon = (distM / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)))) * 0.68;
  const antLat = lat + dLat;
  const antLon = lon + dLon;

  if (typeof L !== "undefined" && navigator.onLine) {
    document.getElementById("leafletMap").classList.remove("hidden");
    document.getElementById("fallbackMapCanvas").classList.add("hidden");

    if (!leafletMap) {
      leafletMap = L.map("leafletMap").setView([lat, lon], 15);
      const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap"
      });
      tiles.on("tileerror", () => renderOfflineMap(distM));
      tiles.addTo(leafletMap);
    } else {
      leafletMap.setView([lat, lon], 15);
    }

    if (userLayer) leafletMap.removeLayer(userLayer);
    if (antLayer) leafletMap.removeLayer(antLayer);
    if (lineLayer) leafletMap.removeLayer(lineLayer);

    userLayer = L.circleMarker([lat, lon], { radius: 8, color: "#10b981", fillOpacity: 0.9 }).addTo(leafletMap).bindPopup("Tu ubicación");
    antLayer = L.circleMarker([antLat, antLon], { radius: 8, color: "#f59e0b", fillOpacity: 0.9 }).addTo(leafletMap).bindPopup(`Antena estimada (~${distM} m)`);
    lineLayer = L.polyline([[lat, lon], [antLat, antLon]], { color: "#38bdf8", weight: 2.5, dashArray: "6,6" }).addTo(leafletMap);
  } else {
    renderOfflineMap(distM);
  }
}

function saveHistorySample(dbm, sinr, freqMhz, distM) {
  const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  arr.unshift({
    ts: new Date().toLocaleTimeString(),
    dbm,
    sinr,
    freqMhz,
    distM
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, 30)));
}

function renderHistory() {
  const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const list = document.getElementById("historyList");
  list.innerHTML = arr.length
    ? arr.map((r) => `<div class="history-item"><span>${r.ts} · ${r.freqMhz} MHz</span><span>${r.dbm} dBm · ~${r.distM} m</span></div>`).join("")
    : `<div class="history-item"><span>Sin muestras todavía</span><span>Toca Escanear</span></div>`;

  const canvas = document.getElementById("historyCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (arr.length < 2) return;

  const samples = [...arr].reverse();
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 2;
  ctx.beginPath();
  samples.forEach((s, idx) => {
    const x = (idx / (samples.length - 1)) * (canvas.width - 24) + 12;
    const norm = Math.max(0, Math.min(1, (s.dbm + 120) / 70));
    const y = canvas.height - 16 - norm * (canvas.height - 32);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderScans(data) {
  const wrap = document.getElementById("scanResultsList");
  const wifiList = (data && Array.isArray(data.wifiList)) ? data.wifiList : [];
  if (!wifiList.length) {
    wrap.innerHTML = `<div class="info-box">Estado actual: <strong>${data && data.band ? data.band : "Red Activa"}</strong> · ${data && data.dbm ? data.dbm : -86} dBm. Pulsa <em>Escanear Wi-Fi</em> o concede permisos de ubicación/Wi-Fi para listar redes cercanas.</div>`;
    return;
  }
  wrap.innerHTML = wifiList.map((w) => `
    <div class="info-box">
      <strong>${w.ssid || "Red sin nombre"}</strong> · <span>${w.freqMhz || 2412} MHz</span> · <strong>${w.rssi || -75} dBm</strong>
    </div>
  `).join("");
}

function refreshTelemetry() {
  let nativeData = null;
  if (window.AntenaBridge && typeof window.AntenaBridge.getTelemetryJson === "function") {
    try { nativeData = JSON.parse(window.AntenaBridge.getTelemetryJson()); } catch (_) {}
  }

  const dbm = nativeData && typeof nativeData.dbm === "number" ? nativeData.dbm : -87;
  const sinr = nativeData && typeof nativeData.sinr === "number" ? nativeData.sinr : 8;
  const freqMhz = nativeData && typeof nativeData.freqMhz === "number" ? nativeData.freqMhz : 1800;
  const bandLabel = nativeData && nativeData.band ? nativeData.band : "Banda Auto";
  const isWifi = nativeData && nativeData.mode === "WIFI";
  const distM = estimateDistanceMeters(dbm, freqMhz);

  const recFreq = dbm < -90
    ? (isWifi ? "Wi-Fi 2.4 GHz (mayor alcance y muros)" : "Banda baja 700–900 MHz (mayor alcance)")
    : (isWifi ? "Wi-Fi 5 GHz (mayor velocidad cerca)" : "Banda media/alta 1800–2600+ MHz (más velocidad)");

  document.getElementById("mSignal").textContent = `${dbm} dBm`;
  document.getElementById("mSignalSub").textContent = dbm >= -80 ? "Señal fuerte" : dbm >= -95 ? "Señal media — mejorable" : "Señal débil — reubica/antena";

  document.getElementById("mSinr").textContent = `${sinr} dB`;
  document.getElementById("mSinrSub").textContent = sinr >= 10 ? "Calidad limpia" : "Interferencia o margen bajo";

  document.getElementById("mFreq").textContent = `${freqMhz} MHz`;
  document.getElementById("mFreqSub").textContent = bandLabel;

  document.getElementById("mDist").textContent = `~${distM} m`;
  document.getElementById("mDistSub").textContent = "Distancia estimada a antena";

  document.getElementById("linkModePill").textContent = isWifi ? "WI-FI" : "CELULAR";
  document.getElementById("freqNow").textContent = `${freqMhz} MHz (${bandLabel})`;
  document.getElementById("freqBest").textContent = recFreq;
  document.getElementById("freqGuideText").textContent = isWifi
    ? "Cómo conectarte: abre Ajustes > Wi-Fi, toca la red de 2.4 GHz si buscas alcance a través de paredes o la de 5 GHz si estás cerca y buscas máxima velocidad."
    : "Cómo conectarte: entra a Ajustes > Red móvil > Tipo de red preferido / Selección de red, o desplázate a un punto con línea de vista más despejada para enganchar la mejor banda.";

  document.getElementById("coachAdvice").textContent = dbm < -88
    ? "Acción recomendada: eleva el equipo 1.5–2 m, aléjalo de paredes gruesas o metal y, si el problema persiste, revisa en 'Planos y Cables' el diseño ideal con cable corto."
    : "Buen nivel de partida: mantén el receptor despejado y evita cables coaxiales largos o con dobleces pronunciados.";

  const lat = nativeData && typeof nativeData.lat === "number" ? nativeData.lat : 23.1136;
  const lon = nativeData && typeof nativeData.lon === "number" ? nativeData.lon : -82.3666;
  updateMap(lat, lon, distM);
  saveHistorySample(dbm, sinr, freqMhz, distM);
  renderScans(nativeData);
}

async function runSpeedAndPingTest() {
  const pingEl = document.getElementById("statPing");
  const downEl = document.getElementById("statDown");
  pingEl.textContent = "Midiendo...";
  downEl.textContent = "Midiendo...";

  const t0 = performance.now();
  try {
    await fetch("https://www.openstreetmap.org/favicon.ico?_=" + Date.now(), { cache: "no-store", mode: "no-cors" });
    const ping = Math.max(12, Math.round(performance.now() - t0));
    pingEl.textContent = `${ping} ms`;
    downEl.textContent = ping < 80 ? "Alta (~25+ Mbps)" : ping < 200 ? "Media (~8–20 Mbps)" : "Baja / Latencia alta";
  } catch (_) {
    pingEl.textContent = "Sin red / Offline";
    downEl.textContent = "0 Mbps";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initLongPress();
  initBandsTab();
  initAntennaCalculatorAndPlans();
  refreshTelemetry();
  renderHistory();

  document.getElementById("btnRefresh").addEventListener("click", refreshTelemetry);
  document.getElementById("btnWifiScan").addEventListener("click", () => {
    if (window.AntenaBridge && typeof window.AntenaBridge.scanWifi === "function") {
      try { window.AntenaBridge.scanWifi(); } catch (_) {}
    }
    refreshTelemetry();
  });
  document.getElementById("btnOpenNetSettings").addEventListener("click", () => {
    if (window.AntenaBridge && typeof window.AntenaBridge.openNetworkSettings === "function") {
      try { window.AntenaBridge.openNetworkSettings(); return; } catch (_) {}
    }
    openGuideModal("advisor");
  });
  document.getElementById("btnRunSpeed").addEventListener("click", runSpeedAndPingTest);
  document.getElementById("btnClearHistory").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
  });
  document.getElementById("btnCloseModal").addEventListener("click", () => document.getElementById("guideModal").classList.add("hidden"));
  document.getElementById("btnModalOk").addEventListener("click", () => document.getElementById("guideModal").classList.add("hidden"));
  document.getElementById("btnLang").addEventListener("click", () => {
    currentLang = currentLang === "es" ? "en" : "es";
    document.getElementById("statusBanner").textContent = currentLang === "es"
      ? "Pública · Global (Incl. Cuba) · Offline-Ready"
      : "Public · Global (Incl. Cuba) · Offline-Ready";
  });

  setInterval(refreshTelemetry, 6000);
});