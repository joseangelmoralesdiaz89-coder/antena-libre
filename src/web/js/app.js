const LONG_PRESS_MS = 3000;
const STORAGE_KEY = "antena_libre_v1_history";
const SPEED_OF_LIGHT_M_PER_SEC = 299.792458; // c / 1e6 -> metros por MHz

const BAND_CATALOG = {
  LTE: [
    { code: "B28 (700 MHz)", mhz: 758, role: "Máximo alcance y penetración en muros / zonas rurales" },
    { code: "B20 (800 MHz)", mhz: 806, role: "Cobertura amplia y buena penetración en interiores" },
    { code: "B8 (900 MHz)", mhz: 942, role: "Buen alcance con capacidad moderada" },
    { code: "B3 (1800 MHz)", mhz: 1842, role: "Equilibrio entre velocidad y cobertura urbana" },
    { code: "B1 (2100 MHz)", mhz: 2140, role: "Buena capacidad de datos en zonas pobladas" },
    { code: "B7 (2600 MHz)", mhz: 2655, role: "Alta velocidad a menor alcance y menor penetración" },
    { code: "B41 (2500 MHz TDD)", mhz: 2595, role: "Alta capacidad TDD con buena línea de vista" }
  ],
  NR: [
    { code: "n28 (700 MHz)", mhz: 773, role: "5G de largo alcance y cobertura profunda" },
    { code: "n41 (2500 MHz)", mhz: 2595, role: "5G de alta capacidad media" },
    { code: "n78 (3500 MHz C-Band)", mhz: 3500, role: "5G de alta velocidad, menor penetración en muros" },
    { code: "n258 (26 GHz mmWave)", mhz: 26500, role: "Velocidad muy alta en distancia corta y línea de vista" }
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
  ],
  WIFI: [
    { code: "Wi-Fi 2.4 GHz (Canal 1)", mhz: 2412, role: "Mejor alcance y paso por paredes; más saturado" },
    { code: "Wi-Fi 2.4 GHz (Canal 6)", mhz: 2437, role: "Canal central clásico de 2.4 GHz" },
    { code: "Wi-Fi 2.4 GHz (Canal 11)", mhz: 2462, role: "Canal superior de 2.4 GHz" },
    { code: "Wi-Fi 5 GHz (Canal 36)", mhz: 5180, role: "Mayor velocidad en espacios cercanos; menos alcance" },
    { code: "Wi-Fi 5 GHz (Canal 149)", mhz: 5745, role: "Alta velocidad para enlaces puntuales o cercanos" }
  ]
};

// Atenuación de referencia a 1000 MHz (dB/100m) y factor de velocidad (VF)
const CABLE_SPECS = {
  RG58:   { name: "RG-58 (50 Ω)", loss1GPer100m: 46.5, vf: 0.66 },
  RG6:    { name: "RG-6 Quad (75 Ω)", loss1GPer100m: 19.6, vf: 0.82 },
  LMR200: { name: "LMR-200 (50 Ω)", loss1GPer100m: 34.4, vf: 0.83 },
  LMR400: { name: "LMR-400 (50 Ω)", loss1GPer100m: 13.1, vf: 0.85 }
};

const METRIC_GUIDES = {
  rsrp: {
    title: "Intensidad de Señal (dBm / RSRP / RSSI)",
    what: "Mide la potencia real que llega a tu equipo. Entre -65 y -80 dBm es fuerte/buena; entre -81 y -95 dBm es media; por debajo de -100 dBm es débil y causa cortes o lentitud.",
    steps: [
      "Sube el equipo o receptor 1.5 a 2 m y colócalo cerca de ventanas o zona elevada.",
      "Aléjalo de paredes gruesas, bloques de concreto, láminas de zinc/aluminio, microondas y motores.",
      "Si usas antena exterior, acorta el cable coaxial y gira despacio hacia donde suba el valor en dBm."
    ]
  },
  sinr: {
    title: "Calidad de Enlace / SINR (dB)",
    what: "Compara la señal útil frente al ruido e interferencia. Valores >= 10 dB indican señal limpia; valores bajos o negativos muestran saturación o interferencia.",
    steps: [
      "En Wi-Fi, prueba otro canal menos ocupado o acerca el dispositivo si está al límite de cobertura.",
      "Separa el receptor de fuentes de ruido eléctrico o múltiples transmisores pegados.",
      "Evita rebotes fuertes contra superficies metálicas cercanas."
    ]
  },
  freq: {
    title: "Frecuencia Actual (MHz)",
    what: "Las frecuencias bajas (< 1000 MHz o 2.4 GHz) llegan más lejos y atraviesan mejor paredes; las altas (>= 1800 MHz o 5 GHz) dan más velocidad cerca pero pierden fuerza antes.",
    steps: [
      "Mira la tarjeta 'Frecuencia Conectada vs. Recomendada' para ver qué banda conviene más hoy.",
      "Usa el Selector de Bandas para simular cómo cambia el tamaño de antena y la pérdida por distancia.",
      "Si estás lejos o tras muros, prioriza frecuencia baja/penetrante."
    ]
  },
  dist: {
    title: "Antena y Distancia Estimada",
    what: "Estima la distancia aproximada a la antena/sector usando la potencia recibida y la frecuencia. Edificios, árboles y cerros alteran la estimación real.",
    steps: [
      "Observa el marcador y la línea en el mapa para ubicar la dirección aproximada.",
      "Eleva la antena o receptor para ganar línea de vista sobre obstáculos.",
      "Si el enlace es largo, revisa en 'Planos y Cables' qué antena direccional y qué largo de cable usar."
    ]
  },
  advisor: {
    title: "Frecuencia Conectada vs. Recomendada",
    what: "Compara tu frecuencia actual con la recomendada según el nivel de señal y el tipo de conexión para guiarte paso a paso.",
    steps: [
      "Toca 'Cambiar Banda / Red (Ajustes)' para ir directo a los ajustes de red del teléfono.",
      "En Wi-Fi, elige 2.4 GHz para alcance/paredes o 5 GHz para velocidad cercana.",
      "En red móvil, revisa el modo de red preferido o muévete a un punto con mejor recepción."
    ]
  },
  map: {
    title: "Mapa Local · Tu Posición y Antena",
    what: "Muestra tu ubicación, un marcador estimado de antena y la distancia aproximada. Si no hay conexión para cargar tiles externos, activa el mapa offline automáticamente.",
    steps: [
      "Activa la ubicación/GPS del teléfono y concede permiso de ubicación a la app.",
      "Compara cómo cambia la distancia estimada y los dBm al moverte o girar el equipo.",
      "Usa la orientación del mapa como apoyo inicial antes de apuntar una antena."
    ]
  }
};

function fmtLen(meters) {
  if (meters >= 1) return `${meters.toFixed(3)} m (${(meters * 100).toFixed(1)} cm)`;
  return `${(meters * 100).toFixed(2)} cm (${(meters * 1000).toFixed(1)} mm)`;
}

function buildAntennaPlans(freqMhz, cableType, cableLen) {
  const k = 0.95; // factor de acortamiento típico por efecto de extremo / diámetro de conductor en aire
  const lam = SPEED_OF_LIGHT_M_PER_SEC / Math.max(1, freqMhz);
  const halfWave = lam / 2;

  // 1. Dipolo de media onda (λ/2)
  const dipoleTotal = halfWave * k;
  const dipoleElement = dipoleTotal / 2;

  // 2. Yagi de 3 elementos (Reflector, Dipolo activo, 1 Director) - proporciones clásicas de diseño
  const yagiRef = halfWave * 1.05 * k;
  const yagiDrv = halfWave * k;
  const yagiDir = halfWave * 0.92 * k;
  const yagiGapRefDrv = lam * 0.20;
  const yagiGapDrvDir = lam * 0.15;

  // 3. Monopolo vertical de 1/4 de onda (λ/4) sobre plano de tierra
  const monopoloElem = (lam / 4) * k;

  // 4. Ground-Plane (GP) vertical λ/4 + 4 radiales λ/4
  const gpVertical = (lam / 4) * k;
  const gpRadial = (lam / 4) * k;

  // 5. Cantena (guía de onda cilíndrica) para frecuencias >= 1500 MHz
  const cantennaDiam = lam * 0.76; // diámetro interno guía circular ~0.76 λ
  const cantennaProbe = lam * 0.25 * k; // sonda de 1/4 λ
  const cantennaProbeFromBack = lam * 0.25; // distancia desde el fondo cerrado ~1/4 λ

  const cableInfo = CABLE_SPECS[cableType] || CABLE_SPECS.LMR200;
  const lossDb = (cableInfo.loss1GPer100m / 100) * Math.sqrt(Math.max(1, freqMhz) / 1000) * cableLen;
  const powerRemainingPct = (Math.pow(10, -lossDb / 10) * 100).toFixed(1);

  return [
    {
      id: "dipole",
      title: "1. Dipolo de Media Onda (λ/2) — Omnidireccional Base",
      howItWorks: "Tiene dos brazos iguales conectados al centro (uno al conductor central del coaxial y el otro a la malla/tierra). La señal resuena mejor cuando el largo total ronda la mitad de la longitud de onda ajustada por el factor de acortamiento (~0.95).",
      materials: "2 varillas o tubos de cobre/aluminio (3–6 mm), soporte plástico/PVC aislante, conector hembra N o SO-239, caja estanca.",
      measurements: `Longitud total: ${fmtLen(dipoleTotal)} · Cada brazo: ${fmtLen(dipoleElement)} (λ = ${fmtLen(lam)}).`,
      cableRule: `Usa coaxial de ${cableInfo.name} lo más corto posible (ideal <= 3–5 m). Con ${cableLen} m pierdes ~${lossDb.toFixed(2)} dB (llega ~${powerRemainingPct}% de la potencia).`,
      whyShortCable: "Cada metro de cable disipa señal como calor y resistencia; si el cable es largo, pierde más fuerza de la que ayuda la antena.",
      svg: `<svg viewBox="0 0 520 110" class="blueprint-svg">
        <line x1="260" y1="88" x2="260" y2="54" stroke="#38bdf8" stroke-width="3"/>
        <line x1="70" y1="54" x2="254" y2="54" stroke="#10b981" stroke-width="5"/>
        <line x1="266" y1="54" x2="450" y2="54" stroke="#10b981" stroke-width="5"/>
        <circle cx="260" cy="54" r="5" fill="#f59e0b"/>
        <text x="115" y="34" fill="#eef4fb" font-size="11">Brazo A: ${fmtLen(dipoleElement)}</text>
        <text x="275" y="34" fill="#eef4fb" font-size="11">Brazo B: ${fmtLen(dipoleElement)}</text>
        <text x="150" y="98" fill="#8fa3bd" font-size="11">Total dipolo: ${fmtLen(dipoleTotal)} · Feed central 50/75 Ω</text>
      </svg>`
    },
    {
      id: "yagi",
      title: "2. Antena Yagi de 3 Elementos — Direccional de Alcance",
      howItWorks: "Un elemento trasero (reflector, un poco más largo) rebota señal hacia adelante; el elemento central (dipolo activo) recibe/entrega la señal; el elemento delantero (director, más corto) enfoca el haz en una dirección.",
      materials: "1 boom de aluminio o PVC rígido, 1 reflector trasero, 1 dipolo activo central, 1 director frontal, abrazaderas aislantes y conector N/SMA.",
      measurements: `Reflector: ${fmtLen(yagiRef)} · Dipolo: ${fmtLen(yagiDrv)} · Director: ${fmtLen(yagiDir)} · Separación Ref-Dip: ${fmtLen(yagiGapRefDrv)} · Dip-Dir: ${fmtLen(yagiGapDrvDir)}.`,
      cableRule: `Usa ${cableInfo.name} corto (1.5 a 4 m). En ${cableLen} m de ${cableInfo.name} pierdes ~${lossDb.toFixed(2)} dB.`,
      whyShortCable: "Si pones un cable largo o delgado en una Yagi, el cable se come la ganancia direccional antes de llegar al equipo.",
      svg: `<svg viewBox="0 0 520 110" class="blueprint-svg">
        <line x1="60" y1="55" x2="460" y2="55" stroke="#8fa3bd" stroke-width="2" stroke-dasharray="5,4"/>
        <line x1="120" y1="20" x2="120" y2="90" stroke="#f59e0b" stroke-width="4"/>
        <line x1="250" y1="24" x2="250" y2="86" stroke="#10b981" stroke-width="4"/>
        <line x1="370" y1="28" x2="370" y2="82" stroke="#38bdf8" stroke-width="4"/>
        <polygon points="445,55 432,49 432,61" fill="#38bdf8"/>
        <text x="85" y="104" fill="#f59e0b" font-size="10">Ref ${fmtLen(yagiRef)}</text>
        <text x="215" y="104" fill="#10b981" font-size="10">Dip ${fmtLen(yagiDrv)}</text>
        <text x="340" y="104" fill="#38bdf8" font-size="10">Dir ${fmtLen(yagiDir)}</text>
      </svg>`
    },
    {
      id: "monopole",
      title: "3. Antena Monopolo Vertical (λ/4) — Señal Vertical Simple",
      howItWorks: "Usa una varilla vertical de un cuarto de onda sobre un plano conductor o tierra; el plano metálico actúa como espejo eléctrico para completar el equivalente a un dipolo.",
      materials: "1 varilla vertical de cobre/latón/aluminio, base metálica o plano de tierra, conector chasis N/SMA/BNC.",
      measurements: `Varilla vertical: ${fmtLen(monopoloElem)} (1/4 λ × 0.95).`,
      cableRule: `Cable ${cableInfo.name} lo más corto posible (${cableLen} m -> ~${lossDb.toFixed(2)} dB de pérdida estimada).`,
      whyShortCable: "Sin plano de tierra estable o con cable largo de alta pérdida, la señal cae rápido y cambia la resonancia.",
      svg: `<svg viewBox="0 0 520 110" class="blueprint-svg">
        <line x1="110" y1="84" x2="410" y2="84" stroke="#8fa3bd" stroke-width="4"/>
        <line x1="260" y1="84" x2="260" y2="26" stroke="#10b981" stroke-width="5"/>
        <circle cx="260" cy="84" r="5" fill="#f59e0b"/>
        <text x="272" y="54" fill="#10b981" font-size="11">Varilla: ${fmtLen(monopoloElem)}</text>
        <text x="150" y="102" fill="#8fa3bd" font-size="11">Plano de tierra conductor debajo de la base</text>
      </svg>`
    },
    {
      id: "groundplane",
      title: "4. Antena Ground-Plane (GP) con 4 Radiales — Horizonte Abierto",
      howItWorks: "Combina un elemento vertical central con 3 o 4 radiales inclinados hacia abajo (~30°–45°) conectados a la malla; crea un plano artificial estable para recepción/transmisión omnidireccional.",
      materials: "1 varilla vertical, 4 varillas radiales, conector N/SO-239 con terminales para radiales y soporte mástil.",
      measurements: `Elemento vertical: ${fmtLen(gpVertical)} · Cada uno de los 4 radiales: ${fmtLen(gpRadial)} (inclinados ~35°–45°).`,
      cableRule: `Cable ${cableInfo.name} corto (< 4 m recomendado; en ${cableLen} m pierdes ~${lossDb.toFixed(2)} dB).`,
      whyShortCable: "Un tramo largo y fino atenúa la señal antes de entrar al receptor y anula parte de la ventaja de ubicar la antena en alto.",
      svg: `<svg viewBox="0 0 520 110" class="blueprint-svg">
        <line x1="260" y1="56" x2="260" y2="18" stroke="#10b981" stroke-width="5"/>
        <line x1="260" y1="56" x2="150" y2="92" stroke="#38bdf8" stroke-width="3"/>
        <line x1="260" y1="56" x2="370" y2="92" stroke="#38bdf8" stroke-width="3"/>
        <line x1="260" y1="56" x2="210" y2="96" stroke="#38bdf8" stroke-width="2.5"/>
        <line x1="260" y1="56" x2="310" y2="96" stroke="#38bdf8" stroke-width="2.5"/>
        <text x="272" y="34" fill="#10b981" font-size="11">Vertical: ${fmtLen(gpVertical)}</text>
        <text x="65" y="104" fill="#38bdf8" font-size="10">Radiales (~35°–45°): ${fmtLen(gpRadial)}</text>
      </svg>`
    },
    {
      id: "cantena",
      title: "5. Cantena (Guía de Onda Cilíndrica) — Alta Frecuencia Direccional",
      howItWorks: "Usa un cilindro metálico cerrado en un extremo como guía de onda: una pequeña sonda de cobre alimentada por el conector central excita el modo dentro del tubo y dirige la energía por la boca abierta.",
      materials: "Cilindro metálico limpio (lata/tubo conductivo sin pintura aislante interna), alambre grueso de cobre para la sonda, conector N/SMA.",
      measurements: `Diámetro guía ~0.76 λ: ${fmtLen(cantennaDiam)} · Sonda: ${fmtLen(cantennaProbe)} · Posición sonda desde fondo: ${fmtLen(cantennaProbeFromBack)}.`,
      cableRule: `Pigtail / cable ${cableInfo.name} ultra corto (ideal <= 1–2 m; en ${cableLen} m pierdes ~${lossDb.toFixed(2)} dB).`,
      whyShortCable: "En frecuencias altas (como 2.4 GHz o superiores), la pérdida por metro de cable es alta y un cable largo destruye la señal.",
      svg: `<svg viewBox="0 0 520 110" class="blueprint-svg">
        <rect x="110" y="24" width="260" height="62" fill="none" stroke="#8fa3bd" stroke-width="3"/>
        <line x1="110" y1="24" x2="110" y2="86" stroke="#f59e0b" stroke-width="4"/>
        <line x1="175" y1="86" x2="175" y2="52" stroke="#10b981" stroke-width="4"/>
        <polygon points="395,55 382,48 382,62" fill="#38bdf8"/>
        <text x="120" y="102" fill="#8fa3bd" font-size="10">Ø ~${fmtLen(cantennaDiam)} · Sonda ${fmtLen(cantennaProbe)} a ${fmtLen(cantennaProbeFromBack)} del fondo</text>
      </svg>`
    }
  ];
}

function estimateDistanceMeters(dbm, freqMhz) {
  const clamped = Math.max(-125, Math.min(-45, dbm));
  const freqCorr = Math.max(1, freqMhz) / 1800;
  return Math.max(25, Math.round((60 * Math.pow(10, (-68 - clamped) / 34)) / Math.sqrt(freqCorr)));
}

let leafletMap = null;
let userLayer = null;
let antLayer = null;
let lineLayer = null;
let currentLang = "es";

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

function openAndroidNetworkSettings() {
  if (window.AntenaBridge && typeof window.AntenaBridge.openNetworkSettings === "function") {
    try { window.AntenaBridge.openNetworkSettings(); return; } catch (_) {}
  }
  openGuideModal("advisor");
}

function initBandsSelector() {
  const techSel = document.getElementById("bandTechSelect");
  const itemSel = document.getElementById("bandItemSelect");
  const goalSel = document.getElementById("bandGoalSelect");
  const box = document.getElementById("bandDetailsBox");
  const applyBtn = document.getElementById("btnApplyBandToCalc");
  const openBtn = document.getElementById("btnOpenBandSettings");

  const getSelectedBand = () => {
    const list = BAND_CATALOG[techSel.value] || BAND_CATALOG.LTE;
    return list[Number(itemSel.value) || 0] || list[0];
  };

  const renderBand = () => {
    const b = getSelectedBand();
    const goal = goalSel.value;
    const lam = SPEED_OF_LIGHT_M_PER_SEC / b.mhz;
    const dipole = lam / 2 * 0.95;
    const fspl1km = 20 * Math.log10(1) + 20 * Math.log10(b.mhz) + 32.44;
    const fitMsg = goal === "range"
      ? (b.mhz < 1000 ? "Adecuada para largo alcance y paso por paredes." : "Frecuencia media/alta: mejor elevar la antena o usar línea de vista.")
      : goal === "speed"
        ? (b.mhz >= 1800 ? "Buen potencial de ancho de banda si tienes señal limpia." : "Banda baja: prioriza alcance sobre velocidad pico.")
        : "Equilibrio general según distancia y obstáculos.";

    box.innerHTML = `
      <div><strong>${b.code}</strong> · Frecuencia central: <strong>${b.mhz} MHz</strong></div>
      <div>${b.role}</div>
      <div>Longitud de onda (λ): <strong>${fmtLen(lam)}</strong> · Dipolo λ/2 aprox.: <strong>${fmtLen(dipole)}</strong></div>
      <div>Pérdida de espacio libre de referencia a 1 km: <strong>~${fspl1km.toFixed(1)} dB</strong></div>
      <div style="margin-top:4px;color:var(--accent)">${fitMsg}</div>
    `;
  };

  const populateItems = () => {
    const list = BAND_CATALOG[techSel.value] || BAND_CATALOG.LTE;
    itemSel.innerHTML = "";
    list.forEach((b, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = b.code;
      itemSel.appendChild(opt);
    });
    renderBand();
  };

  techSel.addEventListener("change", populateItems);
  itemSel.addEventListener("change", renderBand);
  goalSel.addEventListener("change", renderBand);

  applyBtn.addEventListener("click", () => {
    const b = getSelectedBand();
    document.getElementById("calcFreq").value = b.mhz;
    recalcCableAndPlans();
    document.querySelector('.tab[data-tab="antenas"]').click();
  });

  openBtn.addEventListener("click", openAndroidNetworkSettings);
  populateItems();
}

function recalcCableAndPlans() {
  const freq = Math.max(50, Number(document.getElementById("calcFreq").value) || 2412);
  const len = Math.max(0.1, Number(document.getElementById("calcCableLen").value) || 5);
  const cableKey = document.getElementById("calcCableType").value;
  const dist = Math.max(10, Number(document.getElementById("calcDist").value) || 800);

  const cable = CABLE_SPECS[cableKey] || CABLE_SPECS.LMR200;
  const lam = SPEED_OF_LIGHT_M_PER_SEC / freq;
  const lossDb = (cable.loss1GPer100m / 100) * Math.sqrt(freq / 1000) * len;
  const powerPct = (Math.pow(10, -lossDb / 10) * 100).toFixed(1);
  const fsplDb = 20 * Math.log10(dist / 1000) + 20 * Math.log10(freq) + 32.44;

  document.getElementById("cablePhysicsBox").innerHTML = `
    <div><strong>Frecuencia: ${freq} MHz</strong> · Longitud de onda en aire (λ): <strong>${fmtLen(lam)}</strong></div>
    <div>Cable <strong>${cable.name}</strong> (VF ${cable.vf}) × <strong>${len} m</strong> = pérdida estimada de <strong style="color:var(--warn)">-${lossDb.toFixed(2)} dB</strong> (queda ~<strong>${powerPct}%</strong> de potencia).</div>
    <div>Pérdida de trayectoria en espacio libre a <strong>${dist} m</strong>: <strong>~${fsplDb.toFixed(1)} dB</strong>.</div>
    <div style="margin-top:4px;color:var(--muted)">Regla práctica: cada 3 dB perdidos equivale a la mitad de la potencia. Acortar el cable o pasar a LMR-400 ahorra dB valiosos.</div>
  `;

  const container = document.getElementById("antennaPlansContainer");
  container.innerHTML = "";
  const plans = buildAntennaPlans(freq, cableKey, len);
  plans.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${p.title}</h3>
      ${p.svg}
      <ul class="spec-list">
        <li><strong>Cómo funciona:</strong> ${p.howItWorks}</li>
        <li><strong>Materiales:</strong> ${p.materials}</li>
        <li><strong>Medidas calculadas (${freq} MHz):</strong> ${p.measurements}</li>
        <li><strong>Cable coaxial:</strong> ${p.cableRule}</li>
        <li><strong>Por qué mantener el cable corto:</strong> ${p.whyShortCable}</li>
      </ul>
    `;
    container.appendChild(card);
  });
}

function initAntennaCalculator() {
  ["calcFreq", "calcCableLen", "calcCableType", "calcDist"].forEach((id) => {
    document.getElementById(id).addEventListener("input", recalcCableAndPlans);
  });
  recalcCableAndPlans();
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, 40)));
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
    ? "Cómo conectarte: abre Ajustes > Wi-Fi, toca 2.4 GHz para alcance y muros o 5 GHz para mayor velocidad cerca."
    : "Cómo conectarte: abre Ajustes de red o usa el Selector de Bandas para ver cómo cambia el diseño de antena y cable para tu frecuencia.";

  document.getElementById("coachAdvice").textContent = dbm < -88
    ? "Acción recomendada: sube el equipo 1.5–2 m, aléjalo de muros gruesos o metal y consulta 'Planos y Cables' para usar un cable corto de baja pérdida."
    : "Buen nivel de partida: mantén el receptor despejado y evita cables coaxiales largos o doblados.";

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
  initBandsSelector();
  initAntennaCalculator();
  refreshTelemetry();
  renderHistory();

  document.getElementById("btnRefresh").addEventListener("click", refreshTelemetry);
  document.getElementById("btnWifiScan").addEventListener("click", () => {
    if (window.AntenaBridge && typeof window.AntenaBridge.scanWifi === "function") {
      try { window.AntenaBridge.scanWifi(); } catch (_) {}
    }
    refreshTelemetry();
  });
  document.getElementById("btnOpenNetSettings").addEventListener("click", openAndroidNetworkSettings);
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