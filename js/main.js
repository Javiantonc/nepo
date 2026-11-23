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
  // En Inicio el logo sube al principio; en las demás páginas lleva a Inicio.
  $$("[data-scroll-top]").forEach((a) => a.addEventListener("click", (e) => {
    if (document.body.dataset.page !== "inicio") return;
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
     2b. PASE DE FOTOS DEL HERO
     Una foto cada vez. Flechas a los lados (vuelven al principio al
     llegar al final), puntos indicadores y deslizamiento táctil nativo.
     --------------------------------------------------------------- */
  const slider = $("[data-slider]");
  if (slider) {
    const track = $("[data-slider-track]", slider);
    const slides = $$(".slide", track);
    const dotsEl = $("[data-slider-dots]", slider);
    const status = $("[data-slider-status]", slider);
    let current = 0;

    dotsEl.innerHTML = slides.map((s, i) =>
      `<button class="slider__dot" type="button" aria-label="Ver foto ${i + 1} de ${slides.length}"></button>`
    ).join("");
    const dots = $$(".slider__dot", dotsEl);

    const markActive = (i) => {
      current = i;
      dots.forEach((d, k) => d.setAttribute("aria-current", String(k === i)));
      slides.forEach((s, k) => s.setAttribute("aria-hidden", String(k !== i)));
      const caption = slides[i].querySelector(".slide__caption");
      status.textContent = `Foto ${i + 1} de ${slides.length}${caption ? `: ${caption.textContent}` : ""}`;
    };
    const goTo = (i) => {
      const n = (i + slides.length) % slides.length; // bucle infinito
      track.scrollTo({ left: n * track.clientWidth });
      markActive(n);
    };

    $("[data-slider-prev]", slider).addEventListener("click", () => goTo(current - 1));
    $("[data-slider-next]", slider).addEventListener("click", () => goTo(current + 1));
    dots.forEach((d, i) => d.addEventListener("click", () => goTo(i)));

    // Sincroniza puntos al deslizar con el dedo
    let raf = 0;
    track.addEventListener("scroll", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(track.scrollLeft / track.clientWidth);
        if (i !== current && slides[i]) markActive(i);
      });
    }, { passive: true });
    // Si cambia el tamaño, mantiene la foto actual encuadrada
    window.addEventListener("resize", () => track.scrollTo({ left: current * track.clientWidth, behavior: "auto" }));
    // Flechas del teclado cuando el foco está dentro del pase
    slider.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(current + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(current - 1); }
    });

    markActive(0);
  }

  /* ---------------------------------------------------------------
     3. CARRUSEL DE DESTACADOS
     El desplazamiento es scroll nativo con scroll-snap (táctil incluido);
     las flechas solo avanzan una tarjeta y se desactivan en los extremos.
     --------------------------------------------------------------- */
  const carousel = $("[data-carousel]");
  if (carousel) {
    const prev = $("[data-carousel-prev]");
    const next = $("[data-carousel-next]");
    const step = () => {
      const card = carousel.querySelector(".product");
      const gap = parseFloat(getComputedStyle(carousel).columnGap) || 0;
      return card ? card.getBoundingClientRect().width + gap : carousel.clientWidth * 0.8;
    };
    const update = () => {
      const max = carousel.scrollWidth - carousel.clientWidth - 2;
      prev.disabled = carousel.scrollLeft <= 2;
      next.disabled = carousel.scrollLeft >= max;
    };
    prev.addEventListener("click", () => carousel.scrollBy({ left: -step() }));
    next.addEventListener("click", () => carousel.scrollBy({ left: step() }));
    carousel.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // Flechas del teclado cuando el carrusel tiene el foco
    carousel.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); carousel.scrollBy({ left: step() }); }
      if (e.key === "ArrowLeft") { e.preventDefault(); carousel.scrollBy({ left: -step() }); }
    });
    update();
  }

  /* ---------------------------------------------------------------
     4. CARTA INTERACTIVA
     Carta oficial de NEPO (nepo.cafe/media/carta-nepo.pdf).
     Cada categoría tiene grupos (con título opcional) y productos.
     price: un número, o varios si hay tamaños (p. ej. [3.5, 4, 4.5]).
     --------------------------------------------------------------- */
  const MENU = [
    {
      id: "cafe",
      label: "Café",
      intro: "Café de especialidad preparado con precisión.",
      groups: [
        {
          items: [
            { name: "Solo", price: 2.8 },
            { name: "Cortado", price: 3 },
            { name: "Flat White", price: 3.5 },
            { name: "Capuccino", price: 3.5 },
            { name: "Latte", price: [3.5, 4, 4.5] },
            { name: "Mocha", price: [4.2, 5.2] },
            { name: "Long Black", price: 2.8 },
            { name: "Batch Brew", price: [3.7, 4.7] },
            { name: "Pour Over", price: [6, 9] },
          ],
        },
        {
          title: "Chocolate",
          items: [{ name: "55% Ecuador · 70% Nicaragua", price: 4 }],
        },
      ],
    },
    {
      id: "te",
      label: "Té",
      intro: "Tés e infusiones, solos o en latte.",
      groups: [
        {
          items: [
            { name: "Sencha Verde", price: 3.5 },
            { name: "Matcha Latte", price: [4, 5] },
            { name: "Black Chai Latte", price: [4, 5] },
            { name: "Blanco Himalaya", price: 3.5 },
            { name: "Malawi Earl Grey", price: 3.5 },
          ],
        },
        {
          title: "Sin teína",
          items: [
            { name: "Hojicha Latte", price: [4, 5] },
            { name: "Rooibos Chai", price: 3.5 },
            { name: "Rooibos Latte", price: [4, 5] },
            { name: "Golden Milk", price: [4, 5] },
            { name: "Herbal", price: 3.5 },
          ],
        },
      ],
    },
    {
      id: "frias",
      label: "Bebidas Frías",
      intro: "Para los días de calor (y para los que no pueden vivir sin hielo).",
      groups: [
        {
          items: [
            { name: "Cold Brew", price: 4.2 },
            { name: "Iced Espresso Latte", price: 4.8 },
            { name: "Iced Matcha / Chai Latte", price: 5.3 },
            { name: "Zumo de Naranja Natural", price: [3.8, 4.8] },
            { name: "Cold Brew Té Verde", price: 4.2 },
            { name: "Matcha / Espresso Tonic", price: 6 },
            { name: "Kombucha", price: 4 },
            { name: "Fever Tree", price: 3.5 },
          ],
        },
      ],
    },
    {
      id: "tostadas",
      label: "Tostadas",
      intro: "Masa madre ecológica de larga fermentación o, sin gluten, 100% trigo sarraceno ecológico (+0,60 €).",
      footnote: "*Jamón 50% cebo ibérico.",
      groups: [
        {
          items: [
            { name: "Aceite y Tomate", price: 3.8, desc: "Aceite de oliva virgen extra y tomate natural." },
            { name: "Mantequilla y Mermelada", price: 4.7, desc: "Mantequilla francesa y mermelada casera." },
            { name: "Aguacate", price: 6.7, desc: "Aguacate, cilantro, AOVE y tomate natural." },
            { name: "Pavo", price: 6.7, desc: "AOVE, tomate natural, canónigos y nuestro pavo a baja temperatura." },
            { name: "Huevo-Piquillo", price: 7, desc: "Huevos revueltos, canónigos, mayo de piquillo y crujiente de cebolla." },
            { name: "Jamón Ibérico", price: 7.5, desc: "AOVE, tomate natural y jamón ibérico*." },
            { name: "Majorera", price: 8, desc: "Almogrote con guacamole y almendras." },
            { name: "Pavo & Guaca", price: 11, desc: "Pavo a baja temperatura, guacamole, mozzarella de búfala, tomate, pepino y vinagreta de manzana y Dijon." },
            { name: "Huevo & Guaca", price: 11, desc: "Elige pavo, mozzarella, guanciale o jamón ibérico*." },
          ],
        },
      ],
    },
    {
      id: "brioches",
      label: "Brioches & Buns",
      intro: "Brioche hojaldrado hecho en NEPO, cada día.",
      footnote: "*Jamón 50% cebo ibérico.",
      groups: [
        {
          title: "Brioches",
          note: "Rebanada de pan brioche hojaldrado hecho en NEPO.",
          items: [
            { name: "French Toast", price: 9.5, desc: "Con crema de mascarpone casera, fruta fresca de temporada y sirope de arce." },
            { name: "Mantequilla y Mermelada", price: 5, desc: "Con la mantequilla francesa con la que elaboramos nuestro hojaldre y mermelada de higo o frambuesa." },
            { name: "Pavo y Mozzarella", price: 8, desc: "Pavo a baja temperatura y mozzarella de búfala, AOVE y mix de pimientas." },
            { name: "Jamón Ibérico*", price: 8 },
          ],
        },
        {
          title: "Buns",
          note: "Bollo de brioche, receta especial de la casa, o mollete de trigo sarraceno sin gluten (+1 €).",
          items: [
            { name: "Huevo & Guaca", price: 11, desc: "Huevos revueltos con guacamole y elige: pavo a baja temperatura, guanciale madurado, mozzarella de búfala o jamón ibérico*." },
          ],
        },
      ],
    },
  ];

  // 3.5 → "3,50" · [3.5, 4] → "3,50 / 4,00"
  const fmtPrice = (p) => [].concat(p).map((n) => n.toFixed(2).replace(".", ",")).join(" / ");
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
      let n = 0; // retardo escalonado de la animación de entrada
      panelEl.innerHTML = `
        <p class="menu__intro">${esc(cat.intro)}</p>
        ${cat.groups.map((g) => `
          <div class="menu__group">
            ${g.title ? `<h3 class="menu__group-title">${esc(g.title)}</h3>` : ""}
            ${g.note ? `<p class="menu__group-note">${esc(g.note)}</p>` : ""}
            <ul class="menu__list">
              ${g.items.map((it) => `
                <li class="dish${it.desc ? "" : " dish--compact"}" style="animation-delay:${n++ * 45}ms">
                  <div class="dish__row">
                    <h4 class="dish__name">${esc(it.name)}</h4>
                    <span class="dish__dots" aria-hidden="true"></span>
                    <span class="dish__price">${fmtPrice(it.price)} €</span>
                  </div>
                  ${it.desc ? `<p class="dish__desc">${esc(it.desc)}</p>` : ""}
                </li>`).join("")}
            </ul>
          </div>`).join("")}
        ${cat.footnote ? `<p class="menu__footnote">${esc(cat.footnote)}</p>` : ""}`;
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
