/* =================================================================
   NEPO Café · main.js
   - Estado abierto/cerrado (hora de Madrid)
   - Navbar
   - Hero scrollytelling: vertido de café en <canvas> 2D con
     simulación de ondas (muelles 1D) sincronizada con el scroll
   - Carta filtrable
   - Reveals, mapa diferido
   Vanilla ES6+, sin dependencias.
   ================================================================= */
(() => {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------
     1. HORARIO · Abierto ahora / Cerrado
     Se calcula con la hora oficial de Madrid (Europe/Madrid), así es
     correcto aunque el visitante esté en otra zona horaria.
     --------------------------------------------------------------- */
  const HOURS = {
    // 0 = domingo … 6 = sábado. Minutos desde medianoche.
    0: [8 * 60, 15 * 60],
    1: [7 * 60 + 30, 19 * 60 + 30],
    2: [7 * 60 + 30, 19 * 60 + 30],
    3: [7 * 60 + 30, 19 * 60 + 30],
    4: [7 * 60 + 30, 19 * 60 + 30],
    5: [7 * 60 + 30, 19 * 60 + 30],
    6: [8 * 60, 19 * 60 + 30],
  };
  const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  // Días especiales ("MM-DD"): [apertura, cierre] en minutos, o null = cerrado
  const SPECIAL = {
    "12-24": [7 * 60 + 30, 15 * 60],   // Nochebuena
    "12-25": null,                     // Navidad: cerrado
  };

  function madridNow() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Madrid", weekday: "short", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { day, md: `${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
  }
  // "MM-DD" del día siguiente (para el texto «abre mañana…»)
  const nextMD = (md) => {
    const d = new Date(2001, Number(md.slice(0, 2)) - 1, Number(md.slice(3)) + 1);
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const hoursFor = (day, md) => (md in SPECIAL ? SPECIAL[md] : HOURS[day]);

  function updateStatus() {
    const el = $("[data-status]");
    const text = $("[data-status-text]");
    if (!el) return;
    const { day, md, minutes } = madridNow();
    const today = hoursFor(day, md);
    const [open, close] = today || [Infinity, -Infinity];
    const isOpen = !!today && minutes >= open && minutes < close;

    el.classList.toggle("is-open", isOpen);
    el.classList.toggle("is-closed", !isOpen);

    // Texto principal + detalle (el detalle se oculta en móvil vía CSS)
    let main = isOpen ? "Abierto ahora" : "Cerrado", detail = "";
    if (isOpen && close - minutes <= 30) detail = `cierra a las ${fmt(close)}`;
    else if (!isOpen && minutes < open) detail = `abre a las ${fmt(open)}`;
    else if (!isOpen) {
      const tomorrow = hoursFor((day + 1) % 7, nextMD(md));
      detail = tomorrow ? `abre mañana a las ${fmt(tomorrow[0])}` : "mañana cerrado";
    }
    text.innerHTML = `<span class="status__main">${main}</span>${detail ? `<span class="status__detail"> · ${detail}</span>` : ""}`;
    el.title = detail ? `${main} · ${detail}` : main;

    // Avisos de temporada: visibles solo dentro de su rango "MM-DD:MM-DD"
    $$("[data-season]").forEach((el) => {
      const [from, to] = el.dataset.season.split(":");
      el.hidden = !(md >= from && md <= to);
    });

    // Resalta el día de hoy en la tabla de horarios
    $$(".hours tr").forEach((tr) => {
      tr.classList.toggle("is-today", tr.dataset.days.split(",").map(Number).includes(day));
    });
  }
  updateStatus();
  setInterval(updateStatus, 30_000);

  /* ---------------------------------------------------------------
     2. NAVBAR
     --------------------------------------------------------------- */
  const nav = $("[data-nav]");
  const toggle = $("[data-nav-toggle]");
  const setMenu = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.querySelector(".sr-only").textContent = open ? "Cerrar menú" : "Abrir menú";
  };
  toggle.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
  $$("#nav-menu a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  // El logo lleva siempre al inicio de la página (suave, sin dejar #inicio en la URL)
  $$("[data-scroll-top]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    setMenu(false);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    history.replaceState(null, "", location.pathname + location.search);
  }));

  const onScrollNav = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  const yearEl = $("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------------------------------------------------------
     3. HERO · VERTIDO DE CAFÉ
     Sistema de coordenadas lógico de 400 × 600 escalado al canvas.
     --------------------------------------------------------------- */
  const canvas = $("[data-pour-canvas]");
  const track = $("[data-hero-track]");
  const steps = $$("[data-step]");
  const mlEl = $("[data-ml]");
  const barEl = $("[data-hero-bar]");
  const hintEl = $("[data-hero-hint]");

  if (canvas && track) {
    const ctx = canvas.getContext("2d");
    const W = 400, H = 600;

    // Geometría del vaso (vaso de vidrio templado, ligeramente cónico)
    const G = {
      cx: 200,
      topY: 232, botY: 556,          // borde superior / base exterior
      topHW: 104, botHW: 80,         // semianchos exteriores
      wall: 5,                       // grosor de pared
      base: 20,                      // grosor del fondo de vidrio
      perspective: 0.24,             // ry = hw * perspective
    };
    G.inTop = G.topY + 6;
    G.inBot = G.botY - G.base;
    const SPOUT = { x: 200, y: 118 };
    const ML_MAX = 160;

    // Semiancho interior a una altura y
    const innerHW = (y) => {
      const t = clamp((G.inBot - y) / (G.inBot - G.topY));
      return lerp(G.botHW - G.wall, G.topHW - G.wall, t);
    };
    const outerHW = (y) => lerp(G.botHW, G.topHW, clamp((G.botY - y) / (G.botY - G.topY)));

    // --- Simulación de superficie: N columnas unidas por muelles ---
    const N = 44;
    const wave = { h: new Float32Array(N), v: new Float32Array(N) };
    const TENSION = 0.028, DAMP = 0.035, SPREAD = 0.24;
    const l = new Float32Array(N), r = new Float32Array(N); // buffers reutilizados

    function stepWaves(impact, slosh) {
      const { h, v } = wave;
      // Impacto del chorro en el centro
      if (impact > 0) {
        const c = (N / 2) | 0;
        for (let k = -2; k <= 2; k++) v[c + k] += (Math.random() * 0.9 + 0.3) * impact * (1 - Math.abs(k) * 0.3);
      }
      // Balanceo por la velocidad del scroll (modo de chapoteo lateral)
      if (slosh) for (let i = 0; i < N; i++) v[i] += slosh * ((i / (N - 1)) * 2 - 1);
      // Ruido ambiental muy leve: el líquido nunca está del todo quieto
      if (!reduceMotion) v[(Math.random() * N) | 0] += (Math.random() - 0.5) * 0.06;

      for (let i = 0; i < N; i++) {
        v[i] += -TENSION * h[i] - DAMP * v[i];
        h[i] += v[i];
      }
      // Propagación entre vecinos (dos pasadas para suavidad)
            for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < N; i++) {
          if (i > 0) { l[i] = SPREAD * (h[i] - h[i - 1]); v[i - 1] += l[i]; }
          if (i < N - 1) { r[i] = SPREAD * (h[i] - h[i + 1]); v[i + 1] += r[i]; }
        }
        for (let i = 0; i < N; i++) {
          if (i > 0) h[i - 1] += l[i];
          if (i < N - 1) h[i + 1] += r[i];
        }
      }
      for (let i = 0; i < N; i++) h[i] = clamp(h[i], -6, 6);
    }
    const waveAt = (t) => { // t ∈ [-1, 1]
      const f = ((t + 1) / 2) * (N - 1);
      const i = Math.floor(f), j = Math.min(N - 1, i + 1);
      return lerp(wave.h[i], wave.h[j], f - i);
    };

    // --- Colores ---
    const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const mix = (a, b, t, alpha = 1) => {
      const A = hex(a), B = hex(b);
      return `rgba(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))},${alpha})`;
    };

    // --- Partículas (salpicaduras) ---
    const drops = [];

    // --- Estado ---
    let dpr = 1, scale = 1, ox = 0, oy = 0;
    let target = 0, progress = 0, prevProgress = 0, time = 0, running = false, rafId = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      scale = Math.min(rect.width / W, rect.height / H);
      ox = (rect.width - W * scale) / 2;
      oy = (rect.height - H * scale) / 2;
    }

    function readScroll() {
      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      target = total > 0 ? clamp(-rect.top / total) : 0;
    }

    // Trazado del interior del vaso (para recortar el líquido)
    function interiorPath() {
      const hwT = innerHW(G.inTop), hwB = innerHW(G.inBot);
      ctx.beginPath();
      ctx.moveTo(G.cx - hwT, G.inTop - 40);
      ctx.lineTo(G.cx - hwB, G.inBot);
      ctx.ellipse(G.cx, G.inBot, hwB, hwB * G.perspective, 0, Math.PI, 0, true);
      ctx.lineTo(G.cx + hwT, G.inTop - 40);
      ctx.closePath();
    }

    // ---------- Dibujo del portafiltro (espresso) ----------
    function drawPortafilter(alpha, t) {
      if (alpha <= 0.001) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      // Grupo/cabezal de la máquina insinuado
      ctx.fillStyle = "#2A2420";
      roundRect(120, -10, 160, 44, 10); ctx.fill();
      // Cesta del portafiltro
      const g = ctx.createLinearGradient(140, 0, 260, 0);
      g.addColorStop(0, "#3B342F"); g.addColorStop(.45, "#8C847C"); g.addColorStop(.6, "#B7AEA4"); g.addColorStop(1, "#3B342F");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(140, 36); ctx.lineTo(260, 36);
      ctx.quadraticCurveTo(258, 84, 222, 92); ctx.lineTo(178, 92);
      ctx.quadraticCurveTo(142, 84, 140, 36); ctx.fill();
      // Mango de madera
      const wood = ctx.createLinearGradient(0, 46, 0, 70);
      wood.addColorStop(0, "#8A5A3B"); wood.addColorStop(1, "#5A3822");
      ctx.fillStyle = wood;
      ctx.save(); ctx.translate(150, 58); ctx.rotate(-0.08);
      roundRect(-128, -10, 112, 20, 10); ctx.fill();
      ctx.fillStyle = "#3B342F"; roundRect(-22, -7, 26, 14, 4); ctx.fill();
      ctx.restore();
      // Boquilla
      ctx.fillStyle = "#4A433D";
      ctx.beginPath();
      ctx.moveTo(186, 90); ctx.lineTo(214, 90); ctx.lineTo(207, SPOUT.y - 4); ctx.lineTo(193, SPOUT.y - 4); ctx.closePath(); ctx.fill();
      // Brillo
      ctx.globalAlpha = alpha * (0.35 + 0.1 * Math.sin(t * 1.5));
      ctx.fillStyle = "#fff";
      ctx.fillRect(196, 40, 4, 44);
      ctx.restore();
    }

    // ---------- Dibujo de la jarra de leche (pitcher) ----------
    function drawPitcher(alpha, f, lift = 0) {
      if (alpha <= 0.001) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(lift * 30, -lift * 40); // se retira al terminar el vertido
      // Inclinación ligeramente mayor a medida que se vacía
      const tilt = -0.62 - 0.18 * smooth(0.5, 1, f);
      ctx.translate(SPOUT.x + 2, SPOUT.y - 2);
      ctx.rotate(tilt);
      const g = ctx.createLinearGradient(20, -60, 20, 60);
      g.addColorStop(0, "#E9E6E1"); g.addColorStop(.35, "#C7C2BB"); g.addColorStop(.55, "#F4F2EE"); g.addColorStop(1, "#9E978F");
      ctx.fillStyle = g;
      // Cuerpo de la jarra: el pico queda en (0,0)
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(14, -12, 30, -46);
      ctx.lineTo(132, -46);
      ctx.quadraticCurveTo(144, 0, 132, 46);
      ctx.lineTo(30, 46);
      ctx.quadraticCurveTo(22, 20, 12, 8);
      ctx.closePath();
      ctx.fill();
      // Asa
      ctx.strokeStyle = "#A9A29A"; ctx.lineWidth = 9; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(134, -28); ctx.bezierCurveTo(176, -26, 176, 26, 134, 28); ctx.stroke();
      // Reflejo
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = "#fff";
      roundRect(56, -40, 7, 80, 4); ctx.fill();
      ctx.restore();
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    // ---------- Arte latte (tulipán) sobre la superficie ----------
    function drawLatteArt(L, hw, ry, f, alpha) {
      const grow = smooth(0.5, 1, f);
      if (grow <= 0.001) return;
      ctx.save();
      ctx.translate(G.cx, L);
      ctx.scale(1, ry / hw);           // pasa la elipse a un círculo de radio hw
      ctx.globalAlpha = alpha;
      const R = hw * 0.7 * grow;
      // Tres capas de tulipán que aparecen progresivamente.
      // Cada capa: un anillo de crema y encima la leche blanca, para que
      // se lean separadas como en un tulipán real.
      const layers = [
        { y: R * 0.2, s: 1, at: 0 },
        { y: -R * 0.24, s: .72, at: .4 },
        { y: -R * 0.58, s: .48, at: .75 },
      ];
      const blob = (y, r) => {
        ctx.beginPath();
        ctx.ellipse(0, y, r, r * 0.62, 0, Math.PI, 0, false);   // cúpula superior
        ctx.quadraticCurveTo(r * 0.7, y + r * 0.75, 0, y + r * 0.62);
        ctx.quadraticCurveTo(-r * 0.7, y + r * 0.75, -r, y);
        ctx.closePath();
      };
      layers.forEach((l) => {
        const k = smooth(l.at, l.at + 0.2, grow);
        if (k <= 0) return;
        const r = R * l.s * k;
        ctx.fillStyle = "#A8693B"; blob(l.y + r * 0.04, r * 1.1); ctx.fill();
        ctx.fillStyle = "#FBF4EA"; blob(l.y, r); ctx.fill();
      });
      // Línea de corte final del vertido
      const cut = smooth(0.92, 1, grow);
      if (cut > 0) {
        ctx.strokeStyle = "rgba(176,118,72,.6)";
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(0, -R * 0.95); ctx.lineTo(0, lerp(-R * 0.95, R * 0.7, cut)); ctx.stroke();
      }
      ctx.restore();
    }

    // ---------- Fotograma ----------
    function render() {
      const p = progress;
      const f = smooth(0.03, 0.94, p);                    // nivel de llenado 0→1
      const milk = smooth(0.42, 0.9, f);                  // cuánto “café con leche” hay
      const pour = smooth(0.005, 0.04, p) * (1 - smooth(0.9, 0.97, p)); // intensidad del chorro
      const vel = p - prevProgress;                        // velocidad de scroll suavizada

      // Física
      stepWaves(pour * 0.4, clamp(vel * 30, -0.45, 0.45));

      // Nivel
      const L = lerp(G.inBot, G.inTop + 14, f);
      const hwL = innerHW(L);
      const ryL = hwL * G.perspective;
      const hwB = innerHW(G.inBot);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);

      // Sombra suave sobre la mesa
      const sh = ctx.createRadialGradient(G.cx, G.botY + 6, 4, G.cx, G.botY + 6, 150);
      sh.addColorStop(0, "rgba(60,40,25,.22)"); sh.addColorStop(1, "rgba(60,40,25,0)");
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.ellipse(G.cx, G.botY + 6, 150, 22, 0, 0, Math.PI * 2); ctx.fill();
      // Reflejo cálido del café en la mesa
      if (f > 0.02) {
        const cr = ctx.createRadialGradient(G.cx, G.botY + 8, 2, G.cx, G.botY + 8, 90);
        cr.addColorStop(0, mix("#6B3A1C", "#B98A5E", milk, 0.18 * f)); cr.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = cr;
        ctx.beginPath(); ctx.ellipse(G.cx, G.botY + 8, 90, 12, 0, 0, Math.PI * 2); ctx.fill();
      }

      // Vidrio: cara trasera
      ctx.fillStyle = "rgba(255,255,255,.28)";
      ctx.beginPath();
      ctx.moveTo(G.cx - G.topHW, G.topY);
      ctx.lineTo(G.cx - G.botHW, G.botY);
      ctx.ellipse(G.cx, G.botY, G.botHW, G.botHW * G.perspective, 0, Math.PI, 0, true);
      ctx.lineTo(G.cx + G.topHW, G.topY);
      ctx.ellipse(G.cx, G.topY, G.topHW, G.topHW * G.perspective, 0, 0, Math.PI, true);
      ctx.fill();
      ctx.strokeStyle = "rgba(28,25,23,.16)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(G.cx, G.topY, G.topHW, G.topHW * G.perspective, 0, Math.PI, 0); ctx.stroke();

      // ----- Líquido -----
      if (f > 0.003) {
        ctx.save();
        interiorPath(); ctx.clip();

        const steps = 40;
        // Cuerpo: pared izq. → fondo → pared der. → borde frontal de la superficie
        ctx.beginPath();
        ctx.moveTo(G.cx - hwL, L + waveAt(-1));
        ctx.lineTo(G.cx - hwB, G.inBot);
        ctx.ellipse(G.cx, G.inBot, hwB, hwB * G.perspective, 0, Math.PI, 0, true);
        ctx.lineTo(G.cx + hwL, L + waveAt(1));
        for (let i = steps; i >= 0; i--) {
          const t = (i / steps) * 2 - 1;
          ctx.lineTo(G.cx + t * hwL, L + ryL * Math.sqrt(1 - t * t) + waveAt(t));
        }
        ctx.closePath();

        const body = ctx.createLinearGradient(0, G.inBot + 10, 0, L);
        const foamStop = clamp(1 - (4 + 16 * milk) / Math.max(20, G.inBot - L));
        body.addColorStop(0, "#22110A");
        body.addColorStop(clamp(0.5 - 0.15 * milk), mix("#3A1D0E", "#6E4024", milk));
        body.addColorStop(foamStop, mix("#6B3A1C", "#C99A6E", milk));
        body.addColorStop(1, mix("#B07040", "#DCC1A0", milk));
        ctx.fillStyle = body;
        ctx.fill();

        // Volumen cilíndrico: bordes más oscuros, centro con luz
        const vol = ctx.createLinearGradient(G.cx - hwL, 0, G.cx + hwL, 0);
        vol.addColorStop(0, "rgba(20,10,5,.35)");
        vol.addColorStop(.28, "rgba(255,240,220,.06)");
        vol.addColorStop(.42, "rgba(255,240,220,.14)");
        vol.addColorStop(.75, "rgba(20,10,5,.05)");
        vol.addColorStop(1, "rgba(20,10,5,.4)");
        ctx.fillStyle = vol; ctx.fill();

        // Superficie (elipse ondulada)
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t = (i / steps) * 2 - 1;
          const y = L - ryL * Math.sqrt(1 - t * t) + waveAt(t);
          i ? ctx.lineTo(G.cx + t * hwL, y) : ctx.moveTo(G.cx + t * hwL, y);
        }
        for (let i = steps; i >= 0; i--) {
          const t = (i / steps) * 2 - 1;
          ctx.lineTo(G.cx + t * hwL, L + ryL * Math.sqrt(1 - t * t) + waveAt(t));
        }
        ctx.closePath();
        const surf = ctx.createRadialGradient(G.cx - hwL * .25, L - ryL * .4, 2, G.cx, L, hwL);
        surf.addColorStop(0, mix("#D6A06A", "#B67A48", milk));
        surf.addColorStop(1, mix("#9A5E32", "#8E5530", milk));
        ctx.fillStyle = surf; ctx.fill();
        // Menisco: fina línea brillante donde el líquido toca el vidrio
        ctx.strokeStyle = `rgba(255,248,236,${0.25 + 0.25 * milk})`;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.save(); ctx.clip();
        drawLatteArt(L, hwL, ryL, f, smooth(0.45, 0.7, f));
        ctx.restore();

        ctx.restore();
      }

      // ----- Chorro -----
      if (pour > 0.01) {
        const streamColor = mix("#7A4220", "#F2E8DA", smooth(0.4, 0.55, f));
        const edgeColor = mix("#C68B4E", "#FFFFFF", smooth(0.4, 0.55, f));
        const yEnd = L - ryL * 0.3 + waveAt(0);
        const w0 = 3.4 * pour + 1.2 * milk * pour, w1 = 2.2 * pour + 1.4 * milk * pour;
        const seg = 28;
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i <= seg; i++) {
          const k = i / seg, y = lerp(SPOUT.y, yEnd, k);
          const x = SPOUT.x + Math.sin(time * 9 + k * 7) * 0.9 * k - lerp(w0, w1, k);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        for (let i = seg; i >= 0; i--) {
          const k = i / seg, y = lerp(SPOUT.y, yEnd, k);
          ctx.lineTo(SPOUT.x + Math.sin(time * 9 + k * 7) * 0.9 * k + lerp(w0, w1, k), y);
        }
        ctx.closePath();
        const sg = ctx.createLinearGradient(SPOUT.x - 4, 0, SPOUT.x + 4, 0);
        sg.addColorStop(0, streamColor); sg.addColorStop(.4, edgeColor); sg.addColorStop(1, streamColor);
        ctx.fillStyle = sg; ctx.fill();
        // Pequeña corona de espuma en el punto de impacto
        if (f > 0.01) {
          ctx.fillStyle = mix("#C98E55", "#FBF4EA", milk, 0.7 * pour);
          ctx.beginPath(); ctx.ellipse(SPOUT.x, yEnd + 1, 7 + 4 * pour, 2.2, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        // Salpicaduras ocasionales
        if (!reduceMotion && f > 0.01 && Math.random() < 0.25 * pour) {
          drops.push({ x: SPOUT.x, y: yEnd, vx: (Math.random() - .5) * 1.6, vy: -Math.random() * 1.6 - .4, life: 1, c: streamColor });
        }
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.x += d.vx; d.y += d.vy; d.vy += 0.12; d.life -= 0.045;
        if (d.life <= 0 || d.y > L + 2) { drops.splice(i, 1); continue; }
        ctx.fillStyle = d.c; ctx.globalAlpha = d.life;
        ctx.beginPath(); ctx.arc(d.x, d.y, 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ----- Vidrio: cara frontal -----
      // Contorno de paredes
      ctx.strokeStyle = "rgba(28,25,23,.28)"; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(G.cx - G.topHW, G.topY); ctx.lineTo(G.cx - G.botHW, G.botY);
      ctx.ellipse(G.cx, G.botY, G.botHW, G.botHW * G.perspective, 0, Math.PI, 0, true);
      ctx.lineTo(G.cx + G.topHW, G.topY);
      ctx.stroke();
      // Base gruesa de vidrio
      const baseG = ctx.createLinearGradient(0, G.inBot, 0, G.botY + 12);
      baseG.addColorStop(0, "rgba(255,255,255,.55)"); baseG.addColorStop(1, "rgba(200,190,175,.35)");
      ctx.fillStyle = baseG;
      ctx.beginPath();
      ctx.moveTo(G.cx - innerHW(G.inBot) - 2, G.inBot);
      ctx.ellipse(G.cx, G.inBot, innerHW(G.inBot) + 2, (innerHW(G.inBot) + 2) * G.perspective, 0, Math.PI, 0, true);
      ctx.lineTo(G.cx + G.botHW, G.botY);
      ctx.ellipse(G.cx, G.botY, G.botHW, G.botHW * G.perspective, 0, 0, Math.PI, false);
      ctx.closePath(); ctx.fill();
      // Borde (labio) frontal
      ctx.strokeStyle = "rgba(28,25,23,.32)"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(G.cx, G.topY, G.topHW, G.topHW * G.perspective, 0, 0, Math.PI); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(G.cx, G.topY + 1.5, G.topHW - 2, (G.topHW - 2) * G.perspective, 0, 0.15, Math.PI - 0.15); ctx.stroke();
      // Reflejos verticales del vidrio
      const refl = (x0, x1, a) => {
        const gr = ctx.createLinearGradient(0, G.topY, 0, G.botY);
        gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.7, `rgba(255,255,255,${a * .5})`); gr.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(G.cx + x0 * G.topHW, G.topY + 10);
        ctx.lineTo(G.cx + x1 * G.topHW, G.topY + 10);
        ctx.lineTo(G.cx + x1 * G.botHW, G.botY - 16);
        ctx.lineTo(G.cx + x0 * G.botHW, G.botY - 16);
        ctx.closePath(); ctx.fill();
      };
      refl(-0.84, -0.7, 0.55);
      refl(-0.64, -0.6, 0.35);
      refl(0.74, 0.8, 0.25);
      // Línea de facetas horizontal típica del vaso templado
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1;
      const fy = G.topY + 34, fhw = outerHW(fy) - 1;
      ctx.beginPath(); ctx.ellipse(G.cx, fy, fhw, fhw * G.perspective, 0, 0.1, Math.PI - 0.1); ctx.stroke();

      // ----- Vertedores (encima de todo) -----
      const swap = smooth(0.38, 0.5, f);
      drawPortafilter(1 - swap, time);
      drawPitcher(smooth(0.4, 0.52, f) * (1 - smooth(0.96, 1, p)), f, smooth(0.95, 1, p));

      // Vapor sutil al final
      if (!reduceMotion && f > 0.85) {
        const a = smooth(0.85, 1, f) * 0.22;
        ctx.strokeStyle = `rgba(120,100,85,${a})`; ctx.lineWidth = 2; ctx.lineCap = "round";
        for (let s = -1; s <= 1; s++) {
          ctx.beginPath();
          for (let k = 0; k <= 20; k++) {
            const y = G.topY - 14 - k * 4;
            const x = G.cx + s * 26 + Math.sin(time * 1.4 + k * 0.35 + s * 2) * (4 + k * 0.4);
            k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
      }

      prevProgress = lerp(prevProgress, p, 0.5);
      return { f, p };
    }

    // ---------- Textos narrativos y UI del hero ----------
    const RANGES = [[0.03, 0.33], [0.33, 0.63], [0.63, 1.2]];
    function updateHeroUI(p, f) {
      steps.forEach((el, i) => {
        const [a, b] = RANGES[i];
        const fade = 0.05;
        const inV = smooth(a, a + fade, p), outV = 1 - smooth(b - fade, b, p);
        const o = Math.min(inV, outV);
        const y = (1 - inV) * 18 - (1 - outV) * 18;
        el.style.opacity = o.toFixed(3);
        el.style.transform = `translateY(${y.toFixed(1)}px)`;
        el.style.filter = `blur(${((1 - o) * 4).toFixed(1)}px)`;
        el.setAttribute("aria-hidden", o < 0.5 ? "true" : "false");
      });
      if (mlEl) mlEl.textContent = Math.round(f * mlMax);
      if (barEl) barEl.style.transform = `scaleX(${p.toFixed(4)})`;
      if (hintEl) hintEl.style.opacity = (1 - smooth(0.01, 0.08, p)).toFixed(3);
    }

    // ---------- Modo vídeo real (scroll-scrubbing) ----------
    // Si ./assets/vertido.mp4 carga, el vídeo sustituye al canvas y su
    // currentTime sigue al progreso del scroll (hacia delante y atrás).
    const video = $("[data-pour-video]");
    const stage = $("[data-hero-stage]");
    let videoMode = false;

    let mlMax = ML_MAX;
    function enableVideo() {
      if (videoMode || !video || !video.duration) return;
      videoMode = true;
      stage.classList.add("has-video");
      // Contador adaptado al vídeo (p. ej. «Café de moka · 60 ml»)
      if (video.dataset.ml) mlMax = Number(video.dataset.ml);
      const label = stage.querySelector(".hero__meter-label");
      if (label && video.dataset.label) label.textContent = video.dataset.label;
      canvas.setAttribute("aria-hidden", "true");
      video.setAttribute("aria-hidden", "false");
      video.setAttribute("aria-label", "Vídeo: café vertiéndose en un vaso de cristal, sincronizado con el scroll.");
    }
    if (video) {
      video.addEventListener("loadeddata", enableVideo);
      // El vídeo se descarga entero en memoria (blob): así cada salto de
      // fotograma es instantáneo y el scroll va fluido. Si fetch no está
      // disponible (p. ej. abriendo el HTML con file://), se carga normal.
      const src = video.dataset.src;
      fetch(src)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })
        .then((b) => { video.src = URL.createObjectURL(b); video.load(); })
        .catch(() => { video.preload = "auto"; video.src = src; });
      // Si el archivo no existe o falla, nos quedamos con el canvas
      video.addEventListener("error", () => stage.classList.remove("has-video"));
      // iOS Safari solo permite buscar fotogramas tras una primera reproducción
      const unlock = () => { video.play().then(() => video.pause()).catch(() => {}); };
      window.addEventListener("touchstart", unlock, { once: true, passive: true });
    }

    function scrubVideo(p) {
      const d = video.duration;
      if (!d || video.seeking) return;
      const t = clamp(p) * (d - 0.04);                // evita el último fotograma negro de algunos códecs
      if (Math.abs(video.currentTime - t) > 1 / 60) video.currentTime = t;
    }

    function frame(now) {
      time = now / 1000;
      // Interpolación suave hacia el progreso real (inercia orgánica)
      progress += (target - progress) * (reduceMotion ? 1 : 0.11);
      if (Math.abs(target - progress) < 0.0001) progress = target;
      if (videoMode) {
        scrubVideo(progress);
        updateHeroUI(progress, smooth(0.03, 0.94, progress));
      } else {
        const { f, p } = render();
        updateHeroUI(p, f);
      }
      if (running) rafId = requestAnimationFrame(frame);
    }

    const start = () => { if (!running) { running = true; rafId = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(rafId); };

    // Solo animamos cuando el hero está en pantalla
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: "100px" }).observe(track);

    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("resize", () => { resize(); readScroll(); });
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
    resize(); readScroll();
    progress = prevProgress = target;
    start();
  }

  /* ---------------------------------------------------------------
     4. CARTA INTERACTIVA
     Edita aquí productos y precios. Alérgenos: L, G, H, F, S, P.
     --------------------------------------------------------------- */
  const MENU = [
    {
      id: "cafes",
      label: "Cafés de Especialidad",
      intro: "Grano de especialidad, molido al momento y extraído con precisión.",
      items: [
        { name: "Espresso", price: "1,80", desc: "Corto, denso, con crema avellana.", notes: ["Chocolate negro", "Avellana"], a: [] },
        { name: "Cortado", price: "2,00", desc: "Espresso y un punto de leche texturizada en vaso de cristal.", notes: ["Caramelo", "Cacao"], a: ["L"], veg: true },
        { name: "Flat White", price: "3,00", desc: "Doble ristretto y microespuma sedosa. No es espuma: es textura.", notes: ["Chocolate con leche", "Frutos secos"], a: ["L"], veg: true },
        { name: "Cappuccino", price: "2,80", desc: "Equilibrio clásico entre espresso, leche y espuma fina.", notes: ["Cacao", "Galleta"], a: ["L"], veg: true },
        { name: "Latte", price: "3,00", desc: "Suave y cremoso, con arte latte en cada taza.", notes: ["Toffee", "Vainilla"], a: ["L"], veg: true },
        { name: "Filtro del día · V60", price: "3,50", desc: "Origen de temporada en método manual. Pregunta por el grano de hoy.", notes: ["Frutas de hueso", "Floral"], a: [] },
      ],
    },
    {
      id: "tostadas",
      label: "Tostadas Brutales",
      intro: "Pan de masa madre, buen producto y generosidad sin complejos.",
      items: [
        { name: "Aguacate & huevo", price: "7,50", desc: "Aguacate machacado, huevo a baja temperatura, lima y chili.", notes: ["Vegetariana"], a: ["G", "H"] },
        { name: "Ibérico & tomate", price: "8,50", desc: "Tomate rallado, AOVE y jamón ibérico cortado a cuchillo.", notes: ["Clásica"], a: ["G"] },
        { name: "Ricotta, miel & nueces", price: "6,90", desc: "Ricotta cremosa, miel de flores, nueces tostadas y tomillo.", notes: ["Dulce"], a: ["G", "L", "F"] },
        { name: "Salmón & queso crema", price: "8,90", desc: "Salmón ahumado, queso crema, eneldo y alcaparras.", notes: ["Ahumada"], a: ["G", "L", "P"] },
      ],
    },
    {
      id: "bolleria",
      label: "Bollería Casera",
      intro: "Horneada cada mañana. Cuando se acaba, se acaba.",
      items: [
        { name: "Croissant de mantequilla", price: "2,40", desc: "Hojaldre crujiente, interior alveolado.", notes: ["Mantequilla"], a: ["G", "L", "H"] },
        { name: "Cinnamon roll", price: "3,20", desc: "Espiral de canela con glaseado suave.", notes: ["Canela", "Azúcar moreno"], a: ["G", "L", "H"] },
        { name: "Banana bread", price: "3,00", desc: "Jugoso, con nueces y un toque de cacao.", notes: ["Plátano", "Nuez"], a: ["G", "H", "F"] },
        { name: "Cookie de chocolate", price: "2,50", desc: "Bordes crujientes, centro tierno y sal en escamas.", notes: ["Chocolate negro"], a: ["G", "L", "H", "S"] },
      ],
    },
    {
      id: "frias",
      label: "Bebidas Frías & Matcha",
      intro: "Frescura con la misma precisión que nuestros calientes.",
      items: [
        { name: "Iced Latte", price: "3,40", desc: "Doble espresso sobre leche fría y hielo.", notes: ["Caramelo", "Cacao"], a: ["L"], veg: true },
        { name: "Cold Brew", price: "3,50", desc: "Infusión en frío durante 16 horas. Limpio y dulce.", notes: ["Frutas rojas", "Chocolate"], a: [] },
        { name: "Espresso Tonic", price: "3,80", desc: "Tónica, hielo, piel de naranja y espresso.", notes: ["Cítrico", "Amargo fino"], a: [] },
        { name: "Matcha Latte", price: "3,90", desc: "Matcha ceremonial batido a mano, caliente o con hielo.", notes: ["Vegetal", "Umami"], a: ["L"], veg: true },
      ],
    },
  ];

  const ALLERGEN_NAMES = { L: "Lácteos", G: "Gluten", H: "Huevo", F: "Frutos de cáscara", S: "Soja", P: "Pescado" };
  const tabsEl = $("[data-tabs]");
  const panelEl = $("[data-menu-panel]");

  if (tabsEl && panelEl) {
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    tabsEl.innerHTML = MENU.map((c, i) =>
      `<button class="tab" role="tab" id="tab-${c.id}" aria-controls="menu-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-cat="${c.id}">${esc(c.label)}</button>`
    ).join("");
    panelEl.id = "menu-panel";

    const renderCat = (id) => {
      const cat = MENU.find((c) => c.id === id);
      panelEl.setAttribute("aria-labelledby", `tab-${id}`);
      panelEl.innerHTML = `
        <p class="menu__intro">${esc(cat.intro)}</p>
        <ul class="menu__list">
          ${cat.items.map((it, i) => `
            <li class="dish" style="animation-delay:${i * 60}ms">
              <div class="dish__row">
                <h3 class="dish__name">${esc(it.name)}</h3>
                <span class="dish__dots" aria-hidden="true"></span>
                <span class="dish__price">${esc(it.price)} €</span>
              </div>
              <p class="dish__desc">${esc(it.desc)}</p>
              <div class="dish__meta">
                ${it.notes.map((n) => `<span class="note">${esc(n)}</span>`).join("")}
                ${it.veg ? `<span class="note note--veg">Bebida vegetal sin coste extra</span>` : ""}
                ${it.a.map((a) => `<span class="chip" title="${ALLERGEN_NAMES[a]}" aria-label="Contiene ${ALLERGEN_NAMES[a]}">${a}</span>`).join("")}
              </div>
            </li>`).join("")}
        </ul>`;
    };

    const select = (btn, focus = false) => {
      $$(".tab", tabsEl).forEach((b) => {
        const on = b === btn;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
      });
      if (focus) btn.focus();
      btn.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
      renderCat(btn.dataset.cat);
    };

    tabsEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab");
      if (btn) select(btn);
    });
    // Navegación con flechas (patrón ARIA tabs)
    tabsEl.addEventListener("keydown", (e) => {
      const tabs = $$(".tab", tabsEl);
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      let n = null;
      if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
      if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
      if (e.key === "Home") n = 0;
      if (e.key === "End") n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); select(tabs[n], true); }
    });

    renderCat(MENU[0].id);
  }

  /* ---------------------------------------------------------------
     5. REVEALS + MAPA DIFERIDO
     --------------------------------------------------------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal").forEach((el) => io.observe(el));

  /* ---------------------------------------------------------------
     6. COOKIES + MAPA
     La única cookie opcional es la de Google Maps (terceros). El mapa
     solo se carga con consentimiento; la elección se guarda 1 año.
     --------------------------------------------------------------- */
  const CONSENT_KEY = "nepo-cookies";
  const CONSENT_DAYS = 365;
  const banner = $("[data-cookie-banner]");
  const mapFrame = $(".map__frame");
  const mapConsent = $("[data-map-consent]");

  const readConsent = () => {
    try {
      const c = JSON.parse(localStorage.getItem(CONSENT_KEY));
      return c && Date.now() - c.date < CONSENT_DAYS * 864e5 ? c.value : null;
    } catch { return null; }
  };
  const saveConsent = (value) => {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ value, date: Date.now() })); } catch {}
  };

  let mapObserver = null;
  function loadMap() {
    if (!mapFrame || mapFrame.getAttribute("src")) return;
    mapConsent?.setAttribute("hidden", "");
    // Carga diferida: solo cuando el mapa está cerca de la pantalla
    mapObserver = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { mapFrame.src = mapFrame.dataset.src; mapObserver.disconnect(); }
    }, { rootMargin: "400px" });
    mapObserver.observe(mapFrame);
  }
  function unloadMap() {
    mapObserver?.disconnect();
    if (mapFrame?.getAttribute("src")) mapFrame.removeAttribute("src");
    mapConsent?.removeAttribute("hidden");
  }

  const showBanner = () => { banner.hidden = false; requestAnimationFrame(() => banner.classList.add("is-visible")); };
  const hideBanner = () => { banner.classList.remove("is-visible"); setTimeout(() => (banner.hidden = true), 400); };

  function setConsent(value) {
    saveConsent(value);
    value === "accepted" ? loadMap() : unloadMap();
    hideBanner();
  }

  if (banner) {
    $$("[data-cookie-accept]").forEach((b) => b.addEventListener("click", () => setConsent("accepted")));
    $$("[data-cookie-reject]").forEach((b) => b.addEventListener("click", () => setConsent("rejected")));
    $$("[data-cookie-settings]").forEach((b) => b.addEventListener("click", showBanner));

    const consent = readConsent();
    if (consent === "accepted") loadMap();
    if (!consent || location.hash === "#cookies") showBanner();
  }
})();
