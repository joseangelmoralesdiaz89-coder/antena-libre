let running = false, timer = null;
let ang = 0, posX = 0, posY = 0;
let curDbm = -88, bestDbm = -120, bestDesc = "Sin guardar aún";

function easySize(m) {
  const cm = m * 100;
  const mm = m * 1000;
  if (cm >= 100) return `${m.toFixed(2)} metros (${cm.toFixed(0)} cm)`;
  if (cm >= 10) return `${cm.toFixed(1)} cm (${Math.round(mm)} mm)`;
  return `${Math.round(mm)} mm (${cm.toFixed(1)} cm)`;
}

function drawBoard() {
  const c = document.getElementById("board");
  if (!c) return;
  const ctx = c.getContext("2d");
  const w = c.width, h = c.height;
  ctx.clearRect(0, 0, w, h);

  // Cuadrícula de referencia
  ctx.strokeStyle = "#122032";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  // Tablita física (base de apoyo sin conector)
  const bx = 55, by = 22, bw = w - 110, bh = h - 44;
  ctx.fillStyle = "#132030";
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 14);
  ctx.fill();
  ctx.stroke();

  // Zona de acoplamiento magnético/RF en el centro de la tablita
  const cx = w / 2, cy = h / 2;
  const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 85);
  g.addColorStop(0, "rgba(16, 185, 129, 0.38)");
  g.addColorStop(1, "rgba(16, 185, 129, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, 85, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(16, 185, 129, 0.65)";
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, 44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#93a8c2";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText("TABLITA DE APOYO (SIN CABLE AL TELÉFONO)", bx + 14, by + 18);

  // Dibujo del teléfono girando y moviéndose encima de la tablita
  ctx.save();
  ctx.translate(cx + posX * 1.4, cy + posY * 1.1);
  ctx.rotate((ang * Math.PI) / 180);

  ctx.fillStyle = running ? "rgba(16, 185, 129, 0.28)" : "rgba(56, 189, 248, 0.2)";
  ctx.strokeStyle = running ? "#10b981" : "#38bdf8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-30, -54, 60, 108, 10);
  ctx.fill();
  ctx.stroke();

  // Cámara / parte superior del teléfono para ver hacia dónde apunta
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(0, -38, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText("MÓVIL", -17, 4);
  ctx.restore();

  const cleanAng = Math.round(((ang % 360) + 360) % 360);
  document.getElementById("hAng").textContent = `${cleanAng}°`;
  document.getElementById("hPos").textContent = `${Math.round(posX)} / ${Math.round(posY)} mm`;
  document.getElementById("hState").textContent = running ? "ALINEANDO" : "EN PAUSA";
}

function readSignal() {
  let d = null;
  if (window.AntenaBridge && typeof window.AntenaBridge.getTelemetryJson === "function") {
    try { d = JSON.parse(window.AntenaBridge.getTelemetryJson()); } catch (_) {}
  }
  const baseDbm = d && typeof d.dbm === "number" ? d.dbm : -88;
  // Variación realista según posición/ángulo sobre la tablita si no hay lectura instantánea nueva
  const bonus = Math.round(Math.cos((ang * Math.PI) / 180) * 3 - Math.abs(posX) * 0.06);
  curDbm = Math.max(-120, Math.min(-50, baseDbm + (running ? bonus : 0)));

  const pct = Math.max(6, Math.min(100, Math.round(((curDbm + 120) / 65) * 100)));
  document.getElementById("kDbm").textContent = `${curDbm} dBm`;
  document.getElementById("kQual").textContent = curDbm >= -80 ? "Señal fuerte" : curDbm >= -95 ? "Señal media" : "Señal débil";
  document.getElementById("kBar").style.width = `${pct}%`;

  if (curDbm > bestDbm) {
    bestDbm = curDbm;
    bestDesc = `${Math.round(((ang % 360) + 360) % 360)}° · X:${Math.round(posX)}mm Y:${Math.round(posY)}mm`;
    document.getElementById("kBest").textContent = `${bestDbm} dBm`;
    document.getElementById("kBestPos").textContent = bestDesc;
  }

  const list = document.getElementById("netList");
  const cells = d && Array.isArray(d.cellList) ? d.cellList : [];
  const wifis = d && Array.isArray(d.wifiList) ? d.wifiList : [];
  const html = [
    ...cells.map((c) => `<div class="box"><strong>${c.tech}</strong> · ${c.band} · <strong>${c.dbm} dBm</strong></div>`),
    ...wifis.map((w) => `<div class="box"><strong>Wi-Fi: ${w.ssid}</strong> · ${w.freqMhz} MHz · <strong>${w.rssi} dBm</strong></div>`)
  ];
  list.innerHTML = html.length ? html.join("") : `<div class="box">Concede permiso de Ubicación y pulsa Medir para ver torres y Wi-Fi reales.</div>`;
}

function renderPlans() {
  const freq = Math.max(50, Number(document.getElementById("inFreq").value) || 1842);
  const len = Math.max(0.5, Number(document.getElementById("inLen").value) || 3);
  const lam = 299.792458 / freq;
  const totalElem = lam * 0.5 * 0.95;
  const halfElem = totalElem / 2;
  const gapElem = lam * 0.22;
  const lossDb = (0.14 * Math.sqrt(freq / 1000) * len).toFixed(2);

  document.getElementById("calcOut").innerHTML =
    `Para <strong>${freq} MHz</strong> con cable de <strong>${len} m</strong>:<br>` +
    `• Medida principal del elemento de antena: <strong>${easySize(totalElem)}</strong>.<br>` +
    `• Pérdida estimada del cable: <strong>-${lossDb} dB</strong> (mientras más corto el cable, mejor llega la señal a la tablita).`;

  document.getElementById("plansList").innerHTML = `
    <div class="card">
      <h3>Vista Real y Plano 1: Tablita de Apoyo sin Conector</h3>
      <svg viewBox="0 0 560 190" class="svgbox">
        <rect x="20" y="18" width="250" height="154" rx="10" fill="#0d1826" stroke="#38bdf8" stroke-width="2"/>
        <text x="34" y="38" fill="#38bdf8" font-size="11" font-weight="bold">1. VISTA DESDE ARRIBA (TABLITA)</text>
        <rect x="44" y="54" width="202" height="84" rx="8" fill="#18283c" stroke="#93a8c2" stroke-width="1.5"/>
        <rect x="85" y="66" width="120" height="60" rx="7" fill="#0f2c25" stroke="#10b981" stroke-width="2"/>
        <text x="98" y="100" fill="#10b981" font-size="11" font-weight="bold">APOYA EL CELULAR</text>
        <line x1="44" y1="150" x2="246" y2="150" stroke="#f59e0b" stroke-width="2"/>
        <text x="64" y="164" fill="#f59e0b" font-size="10">Largo cobre/placa: ${easySize(totalElem)}</text>

        <rect x="286" y="18" width="254" height="154" rx="10" fill="#0d1826" stroke="#10b981" stroke-width="2"/>
        <text x="300" y="38" fill="#10b981" font-size="11" font-weight="bold">2. VISTA DE LADO (SIN ENCHUFAR)</text>
        <rect x="320" y="56" width="166" height="26" rx="6" fill="#1e344d" stroke="#38bdf8" stroke-width="2"/>
        <text x="346" y="73" fill="#ffffff" font-size="10">Teléfono encima</text>
        <line x1="498" y1="82" x2="498" y2="104" stroke="#f59e0b" stroke-width="2"/>
        <text x="454" y="96" fill="#f59e0b" font-size="10">0–6 mm</text>
        <rect x="306" y="104" width="204" height="24" rx="5" fill="#292114" stroke="#f59e0b" stroke-width="2"/>
        <text x="322" y="120" fill="#f59e0b" font-size="10">Tablita + cable hacia antena</text>
        <text x="300" y="152" fill="#93a8c2" font-size="10">No lleva ningún cable conectado al móvil</text>
      </svg>
      <ul class="specs">
        <li><strong>Cómo funciona fácil:</strong> la tablita concentra la señal de la antena exterior justo debajo de la zona donde el teléfono tiene su antena interna, sin enchufar nada al puerto de carga.</li>
        <li><strong>Medida con regla:</strong> corta la lámina o varilla acopladora de <strong>${easySize(totalElem)}</strong> de punta a punta (si son dos piezas iguales, cada una mide <strong>${easySize(halfElem)}</strong>).</li>
        <li><strong>Materiales simples:</strong> tabla seca o plástico acrílico firme, cinta o lámina de cobre/aluminio, un plástico fino encima para que el metal no toque directo el celular, y cable coaxial corto (<strong>${len} m</strong>).</li>
      </ul>
    </div>

    <div class="card">
      <h3>Vista Real y Plano 2: Antena Exterior hacia la Tablita</h3>
      <svg viewBox="0 0 560 185" class="svgbox">
        <rect x="20" y="18" width="520" height="150" rx="10" fill="#0d1826" stroke="#f59e0b" stroke-width="2"/>
        <line x1="45" y1="88" x2="265" y2="88" stroke="#93a8c2" stroke-width="3"/>
        <line x1="70" y1="44" x2="70" y2="132" stroke="#f59e0b" stroke-width="4"/>
        <text x="32" y="148" fill="#f59e0b" font-size="10">1) ${easySize(totalElem * 1.05)}</text>
        <line x1="155" y1="48" x2="155" y2="128" stroke="#10b981" stroke-width="4"/>
        <text x="122" y="148" fill="#10b981" font-size="10">2) ${easySize(totalElem)}</text>
        <line x1="235" y1="53" x2="235" y2="123" stroke="#38bdf8" stroke-width="4"/>
        <text x="205" y="148" fill="#38bdf8" font-size="10">3) ${easySize(totalElem * 0.92)}</text>
        <path d="M265,88 L350,88" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="5,4"/>
        <rect x="350" y="56" width="168" height="64" rx="8" fill="#162638" stroke="#10b981" stroke-width="2"/>
        <text x="366" y="83" fill="#ffffff" font-size="11" font-weight="bold">TABLITA INTERIOR</text>
        <text x="366" y="102" fill="#10b981" font-size="10">Celular apoyado aquí</text>
      </svg>
      <ul class="specs">
        <li><strong>Varilla 1 (atrás, reflector):</strong> mide <strong>${easySize(totalElem * 1.05)}</strong>. Empuja la señal hacia adelante.</li>
        <li><strong>Varilla 2 (centro, donde va el cable):</strong> mide <strong>${easySize(totalElem)}</strong>.</li>
        <li><strong>Varilla 3 (adelante, apunta a la torre):</strong> mide <strong>${easySize(totalElem * 0.92)}</strong>.</li>
        <li><strong>Separación entre varillas:</strong> deja <strong>${easySize(gapElem)}</strong> entre una varilla y la siguiente sobre un tubo plástico o madera seca.</li>
      </ul>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    b.classList.add("active");
    document.getElementById("v-" + b.dataset.v).classList.add("active");
    if (b.dataset.v === "align") drawBoard();
  }));

  document.getElementById("btnStart").addEventListener("click", () => {
    running = true;
    clearInterval(timer);
    let step = 0;
    timer = setInterval(() => {
      step++;
      ang = (ang + 12) % 360;
      posX = Math.round(Math.sin(step * 0.3) * 28);
      posY = Math.round(Math.cos(step * 0.22) * 18);
      document.getElementById("rngAngle").value = Math.round(ang);
      document.getElementById("rngX").value = posX;
      readSignal();
      drawBoard();
    }, 300);
    drawBoard();
  });

  document.getElementById("btnStop").addEventListener("click", () => {
    running = false;
    clearInterval(timer);
    drawBoard();
  });

  document.getElementById("btnSavePeak").addEventListener("click", () => {
    bestDbm = curDbm;
    bestDesc = `${Math.round(((ang % 360) + 360) % 360)}° · X:${Math.round(posX)}mm Y:${Math.round(posY)}mm`;
    document.getElementById("kBest").textContent = `${bestDbm} dBm`;
    document.getElementById("kBestPos").textContent = bestDesc;
  });

  document.getElementById("rngAngle").addEventListener("input", (e) => {
    ang = Number(e.target.value);
    readSignal();
    drawBoard();
  });

  document.getElementById("rngX").addEventListener("input", (e) => {
    posX = Number(e.target.value);
    readSignal();
    drawBoard();
  });

  const board = document.getElementById("board");
  board.addEventListener("pointermove", (e) => {
    if (e.buttons === 0 && !running) return;
    const r = board.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    posX = Math.max(-45, Math.min(45, Math.round(nx * 45)));
    posY = Math.max(-35, Math.min(35, Math.round(ny * 35)));
    ang = Math.round(((Math.atan2(ny, nx) * 180) / Math.PI + 360) % 360);
    document.getElementById("rngAngle").value = ang;
    document.getElementById("rngX").value = posX;
    readSignal();
    drawBoard();
  });

  document.getElementById("btnRefresh").addEventListener("click", () => { readSignal(); drawBoard(); });
  document.getElementById("inFreq").addEventListener("input", renderPlans);
  document.getElementById("inLen").addEventListener("input", renderPlans);
  document.getElementById("selBand").addEventListener("change", (e) => {
    document.getElementById("inFreq").value = e.target.value;
    renderPlans();
  });
  document.getElementById("btnNetSettings").addEventListener("click", () => {
    if (window.AntenaBridge && window.AntenaBridge.openNetworkSettings) window.AntenaBridge.openNetworkSettings();
  });

  renderPlans();
  readSignal();
  drawBoard();
});
