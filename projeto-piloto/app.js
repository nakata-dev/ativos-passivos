(() => {
  "use strict";

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function toNumberBR(value) {
    const s = String(value ?? "").trim();
    if (!s) return NaN;
    let clean = s.replace(/\s/g, "").replace(/[R$\u00A0]/g, "");
    const hasComma = clean.includes(",");
    if (hasComma) clean = clean.replace(/\./g, "").replace(",", ".");
    clean = clean.replace(/[^0-9.+-]/g, "");
    return Number(clean);
  }

  function formatBrl(v) { return Number.isFinite(v) ? brl.format(v) : "—"; }

  function debounce(fn, wait = 180) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  function setMsg(text, kind = "info") {
    const msg = $("#msg");
    if (!msg) return;
    if (!text) {
      msg.hidden = true;
      msg.textContent = "";
      msg.style.borderColor = "rgba(31,42,58,.9)";
      return;
    }
    msg.hidden = false;
    msg.textContent = text;
    msg.style.borderColor =
      kind === "danger" ? "rgba(251,113,133,.55)"
      : kind === "ok" ? "rgba(52,211,153,.45)"
      : "rgba(31,42,58,.9)";
  }

  function isNeg(n) { return Number.isFinite(n) && n < 0; }

  // ---------- Focus trap ----------
  function focusableElements(container) {
    const sel = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    return $$(sel, container).filter(
      (el) => !el.hasAttribute("hidden") && !el.getAttribute("aria-hidden")
    );
  }

  function trapFocus(container, onClose) {
    const els = focusableElements(container);
    const first = els[0];
    const last = els[els.length - 1];

    function onKeyDown(e) {
      if (e.key === "Escape") { e.preventDefault(); onClose?.(); return; }
      if (e.key !== "Tab") return;

      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) { e.preventDefault(); last?.focus(); }
      } else {
        if (active === last) { e.preventDefault(); first?.focus(); }
      }
    }

    container.addEventListener("keydown", onKeyDown);
    (first || container).focus({ preventScroll: true });
    return () => container.removeEventListener("keydown", onKeyDown);
  }

  // ---------- UI: Menu ----------
  const btnMenu = $("#btnMenu");
  const menuOverlay = $("#menuOverlay");
  const menuPanel = $(".menu-panel");
  const btnCloseMenu = $("#btnCloseMenu");
  const btnPrint = $("#btnPrint");
  const btnTutorial = $("#btnTutorial");

  let releaseMenuTrap = null;
  let lastFocusBeforeMenu = null;

  function openMenu() {
    if (!btnMenu || !menuOverlay || !menuPanel) return;
    lastFocusBeforeMenu = document.activeElement;

    document.body.classList.add("is-locked");
    menuOverlay.hidden = false;
    btnMenu.setAttribute("aria-expanded", "true");

    releaseMenuTrap = trapFocus(menuPanel, closeMenu);
    menuPanel.focus({ preventScroll: true });
  }

  function closeMenu() {
    if (!btnMenu || !menuOverlay) return;
    if (menuOverlay.hidden) return;

    menuOverlay.hidden = true;
    btnMenu.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-locked");

    releaseMenuTrap?.();
    releaseMenuTrap = null;
    lastFocusBeforeMenu?.focus?.({ preventScroll: true });
  }

  btnMenu?.addEventListener("click", () => {
    const expanded = btnMenu.getAttribute("aria-expanded") === "true";
    expanded ? closeMenu() : openMenu();
  });

  btnCloseMenu?.addEventListener("click", closeMenu);

  menuOverlay?.addEventListener("mousedown", (e) => {
    const t = e.target;
    if (t && t.matches("[data-close-overlay]")) closeMenu();
  });

  // ---------- PDF Help Modal ----------
  const pdfHelpModal = $("#pdfHelpModal");
  const pdfHelpPanel = $("#pdfHelpModal .modal-panel");
  let releasePdfTrap = null;
  let lastFocusBeforePdfHelp = null;

  function openPdfHelp() {
    if (!pdfHelpModal || !pdfHelpPanel) return;
    lastFocusBeforePdfHelp = document.activeElement;

    document.body.classList.add("is-locked");
    pdfHelpModal.hidden = false;

    releasePdfTrap = trapFocus(pdfHelpPanel, closePdfHelp);
  }

  function closePdfHelp() {
    if (!pdfHelpModal) return;
    if (pdfHelpModal.hidden) return;

    pdfHelpModal.hidden = true;
    document.body.classList.remove("is-locked");

    releasePdfTrap?.();
    releasePdfTrap = null;
    lastFocusBeforePdfHelp?.focus?.({ preventScroll: true });
  }

  pdfHelpModal?.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-close-pdfhelp]")) closePdfHelp();
  });

  // ✅ “Gerar PDF” agora abre ajuda e dispara o print
  btnPrint?.addEventListener("click", () => {
    closeMenu();
    // Explica antes do print (fica mais claro)
    openPdfHelp();
    setMsg("Dica: no Windows, escolha “Microsoft Print to PDF” e clique “Imprimir”. Depois selecione a pasta e salve.", "info");

    // Deixa o modal renderizar e abre o print
    setTimeout(() => {
      // Fechamos o modal pra não atrapalhar o diálogo do print
      closePdfHelp();
      window.print();
    }, 220);
  });

  // ---------- Tutorial Modal (tabs simples) ----------
  const tutorialModal = $("#tutorialModal");
  const modalPanel = $("#tutorialModal .modal-panel");
  let releaseModalTrap = null;
  let lastFocusBeforeModal = null;

  const tutorialTabs = $$("#tutorialModal .tab");
  const tutorialPanels = $$("#tutorialModal .tabpanel");

  function activateTutorialTab(tabId) {
    for (const t of tutorialTabs) {
      const active = t.id === tabId;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    }
    for (const p of tutorialPanels) {
      const show = p.getAttribute("aria-labelledby") === tabId;
      p.hidden = !show;
    }
  }

  tutorialTabs.forEach((t) => {
    t.addEventListener("click", () => activateTutorialTab(t.id));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const idx = tutorialTabs.indexOf(t);
      const next = e.key === "ArrowRight" ? idx + 1 : idx - 1;
      const target = tutorialTabs[(next + tutorialTabs.length) % tutorialTabs.length];
      target.focus({ preventScroll: true });
      activateTutorialTab(target.id);
    });
  });

  function openTutorial() {
    closeMenu();
    if (!tutorialModal || !modalPanel) return;

    lastFocusBeforeModal = document.activeElement;
    document.body.classList.add("is-locked");
    tutorialModal.hidden = false;

    releaseModalTrap = trapFocus(modalPanel, closeTutorial);
    if ($("#tComo")) activateTutorialTab("tComo");
  }

  function closeTutorial() {
    if (!tutorialModal) return;
    if (tutorialModal.hidden) return;

    tutorialModal.hidden = true;
    document.body.classList.remove("is-locked");

    releaseModalTrap?.();
    releaseModalTrap = null;
    lastFocusBeforeModal?.focus?.({ preventScroll: true });
  }

  btnTutorial?.addEventListener("click", openTutorial);

  tutorialModal?.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-close-modal]")) closeTutorial();
  });

  // ---------- Inputs / Defaults ----------
  const form = $("#form");
  const btnReset = $("#btnReset");

  const elValorInicial = $("#valorInicial");
  const elAporteMensal = $("#aporteMensal");
  const elPrazoMeses = $("#prazoMeses");
  const elTaxaPoupanca = $("#taxaPoupanca");
  const elTaxaAlternativo = $("#taxaAlternativo");
  const elToggleInflacao = $("#toggleInflacao");
  const inflacaoWrap = $("#inflacaoWrap");
  const elInflacaoAnual = $("#inflacaoAnual");
  const elTaxaAtivoReal = $("#taxaAtivoReal");
  const elTaxaRendaVar = $("#taxaRendaVar");
  const modeLabel = $("#modeLabel");

  const DEFAULTS = {
    valorInicial: "1000",
    aporteMensal: "200",
    prazoMeses: "24",
    taxaPoupanca: "6.0",
    taxaAlternativo: "10.0",
    inflacaoOn: false,
    inflacaoAnual: "4.0",
    taxaAtivoReal: "8.0",
    taxaRendaVar: "12.0",
  };

  function updateInflacaoUI() {
    const on = !!elToggleInflacao?.checked;
    inflacaoWrap?.classList.toggle("is-hidden", !on);
    if (modeLabel) modeLabel.textContent = on ? "Valores ajustados pela inflação" : "Valores nominais";
  }

  function applyDefaults() {
    if (elValorInicial) elValorInicial.value = DEFAULTS.valorInicial;
    if (elAporteMensal) elAporteMensal.value = DEFAULTS.aporteMensal;
    if (elPrazoMeses) elPrazoMeses.value = DEFAULTS.prazoMeses;
    if (elTaxaPoupanca) elTaxaPoupanca.value = DEFAULTS.taxaPoupanca;
    if (elTaxaAlternativo) elTaxaAlternativo.value = DEFAULTS.taxaAlternativo;
    if (elToggleInflacao) elToggleInflacao.checked = DEFAULTS.inflacaoOn;
    if (elInflacaoAnual) elInflacaoAnual.value = DEFAULTS.inflacaoAnual;
    if (elTaxaAtivoReal) elTaxaAtivoReal.value = DEFAULTS.taxaAtivoReal;
    if (elTaxaRendaVar) elTaxaRendaVar.value = DEFAULTS.taxaRendaVar;

    updateInflacaoUI();
    setMsg("");
  }

  elToggleInflacao?.addEventListener("change", () => {
    updateInflacaoUI();
    if (state.hasData) computeAndRender();
  });

  btnReset?.addEventListener("click", () => {
    applyDefaults();
    clearOutputs();
  });

  // ---------- Models / Simulation ----------
  function annualToMonthlyRate(taxaAnualPercent) {
    const a = taxaAnualPercent / 100;
    return Math.pow(1 + a, 1 / 12) - 1;
  }

  function simulateMonthByMonthCompound({ initial, aporteMensal, meses, taxaMensal }) {
    const series = new Array(meses + 1);
    let saldo = initial;
    series[0] = saldo;
    for (let m = 1; m <= meses; m++) {
      saldo = (saldo + aporteMensal) * (1 + taxaMensal);
      series[m] = saldo;
    }
    return series;
  }

  function simulateMonthByMonthSimpleInterest({ initial, aporteMensal, meses, taxaMensal }) {
    const series = new Array(meses + 1);
    let saldo = initial;
    let totalAportado = initial;
    series[0] = saldo;
    for (let m = 1; m <= meses; m++) {
      totalAportado += aporteMensal;
      saldo = saldo + aporteMensal + (totalAportado * taxaMensal);
      series[m] = saldo;
    }
    return series;
  }

  function deflateSeries(seriesNominal, inflacaoAnualPercent) {
    const fatorInflacaoMensal = annualToMonthlyRate(inflacaoAnualPercent);
    const base = 1 + fatorInflacaoMensal;
    return seriesNominal.map((v, mes) => v / Math.pow(base, mes));
  }

  // ---------- Timeline ----------
  const timelineList = $("#timelineList");
  const tip = $("#tip");
  const tipTitle = $("#tipTitle");
  const tipBody = $("#tipBody");
  const tipClose = $("#tipClose");
  let tipAnchor = null;

  function markerMonths(prazo) {
    const set = new Set([0, prazo]);
    if (prazo <= 36) for (let m = 0; m <= prazo; m++) set.add(m);
    else for (let m = 0; m <= prazo; m += 3) set.add(m);
    return Array.from(set).sort((a, b) => a - b);
  }

  function closeTip() {
    if (!tip || tip.hidden) return;
    tip.hidden = true;
    tipAnchor?.focus?.({ preventScroll: true });
    tipAnchor = null;
  }

  function openTipForMonth(month, anchorEl) {
    if (!tip || !tipTitle || !tipBody || !timelineList) return;
    if (!state.hasData) return;

    tipAnchor = anchorEl;
    tip.hidden = false;
    tipTitle.textContent = `Mês ${month}`;

    const rows = [
      ["Poupança", state.display.poup[month]],
      ["Juros simples", state.display.simple[month]],
      ["Juros compostos", state.display.comp[month]],
      ["Ativo real (simulação)", state.display.real[month]],
      ["Renda variável (simulação)", state.display.var[month]],
    ];

    tipBody.innerHTML = rows.map(([name, val]) => `
      <div class="tip-row">
        <span>${name}</span>
        <strong>${formatBrl(val)}</strong>
      </div>
    `).join("");

    const rect = anchorEl.getBoundingClientRect();
    const sectionRect = $(".timeline")?.getBoundingClientRect();
    if (!sectionRect) return;

    const preferNear = window.matchMedia("(min-width: 721px)").matches;
    if (preferNear) {
      const left = clamp(rect.left - sectionRect.left, 12, sectionRect.width - tip.offsetWidth - 12);
      const top = clamp(rect.bottom - sectionRect.top + 8, 70, sectionRect.height - tip.offsetHeight - 12);
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
      tip.style.right = "auto";
    } else {
      tip.style.left = "auto";
      tip.style.right = "";
      tip.style.top = "";
    }

    tipClose?.focus({ preventScroll: true });
  }

  tipClose?.addEventListener("click", closeTip);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    if (pdfHelpModal && !pdfHelpModal.hidden) { closePdfHelp(); return; }
    if (tutorialModal && !tutorialModal.hidden) { closeTutorial(); return; }
    if (menuOverlay && !menuOverlay.hidden) { closeMenu(); return; }
    if (tip && !tip.hidden) closeTip();
  });

  document.addEventListener("mousedown", (e) => {
    if (!tip || tip.hidden) return;
    const t = e.target;
    if (t instanceof Element && !tip.contains(t) && !timelineList?.contains(t)) closeTip();
  });

  function renderTimeline(prazo) {
    if (!timelineList) return;
    timelineList.innerHTML = "";
    const months = markerMonths(prazo);

    const frag = document.createDocumentFragment();
    for (const m of months) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "marker";
      btn.setAttribute("aria-label", `Abrir detalhes do mês ${m}`);

      const label = document.createElement("span");
      label.textContent = `Mês ${m}`;

      const hint = document.createElement("small");
      hint.textContent = m === 0 ? "início" : m === prazo ? "fim" : "ver";

      btn.append(label, hint);
      btn.addEventListener("click", () => openTipForMonth(m, btn));
      btn.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openTipForMonth(m, btn); }
      });

      li.appendChild(btn);
      frag.appendChild(li);
    }
    timelineList.appendChild(frag);
  }

  // ---------- Cards ----------
  const cardsGrid = $("#cardsGrid");
  function cardHTML(title, value, sub = "") {
    const subHTML = sub ? `<p class="sub">${sub}</p>` : "";
    return `
      <article class="card">
        <h3>${title}</h3>
        <p class="value">${value}</p>
        ${subHTML}
      </article>
    `;
  }

  // ---------- Canvas Charts ----------
  const cPoup = $("#cPoup");
  const cSimples = $("#cSimples");
  const cComposto = $("#cComposto");
  const cCompare = $("#cCompare");

  const COLORS = {
    poup: "#f2c94c",
    simple: "#7dd3fc",
    comp: "#a78bfa",
    real: "#34d399",
    var: "#fb7185",
    grid: "rgba(169,182,199,.16)",
    axis: "rgba(169,182,199,.34)",
    text: "rgba(169,182,199,.9)",
  };

  function setupCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const cssWidth = canvas.clientWidth || 600;
    const cssHeight = Math.max(220, Math.round(cssWidth * 0.52));
    canvas.style.height = `${cssHeight}px`;

    const w = Math.floor(cssWidth * dpr);
    const h = Math.floor(cssHeight * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: cssWidth, h: cssHeight };
  }

  function niceMax(v) {
    if (!Number.isFinite(v) || v <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * pow;
  }

  function seriesBounds(seriesArrs) {
    let max = -Infinity;
    for (const s of seriesArrs) for (const v of s) if (Number.isFinite(v) && v > max) max = v;
    if (!Number.isFinite(max)) max = 1;
    return { max };
  }

  function drawAxes(ctx, w, h, pad, minY, maxY) {
    ctx.save();
    ctx.clearRect(0, 0, w, h);

    const gridLines = 4;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + (i * (h - pad.top - pad.bottom)) / gridLines;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    ctx.strokeStyle = COLORS.axis;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, h - pad.bottom);
    ctx.lineTo(w - pad.right, h - pad.bottom);
    ctx.stroke();

    ctx.fillStyle = COLORS.text;
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "middle";
    ctx.fillText(formatBrl(maxY), pad.left + 6, pad.top + 8);
    ctx.fillText(formatBrl(minY), pad.left + 6, h - pad.bottom - 8);
    ctx.restore();
  }

  function drawLine(ctx, w, h, pad, series, minY, maxY, stroke) {
    const n = series.length - 1;
    const innerW = w - pad.left - pad.right;
    const innerH = h - pad.top - pad.bottom;

    const scaleX = (i) => pad.left + innerW * (n === 0 ? 0 : i / n);
    const scaleY = (v) => pad.top + innerH * (1 - (v - minY) / (maxY - minY));

    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.beginPath();
    for (let i = 0; i < series.length; i++) {
      const x = scaleX(i);
      const y = scaleY(series[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawLegend(ctx, items) {
    ctx.save();
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "middle";

    let x = 12;
    const y = 16;
    for (const it of items) {
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.arc(x + 6, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLORS.text;
      ctx.fillText(it.label, x + 16, y);
      x += 16 + ctx.measureText(it.label).width + 18;
    }
    ctx.restore();
  }

  function drawSingleChart(canvas, series, color) {
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const pad = { top: 28, right: 14, bottom: 24, left: 54 };
    const { max } = seriesBounds([series]);
    const minY = 0;
    const maxY = niceMax(max);

    drawAxes(ctx, w, h, pad, minY, maxY);
    drawLine(ctx, w, h, pad, series, minY, maxY, color);
  }

  function drawCompareChart(canvas, seriesMap) {
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const pad = { top: 36, right: 14, bottom: 26, left: 54 };

    const all = Object.values(seriesMap).map((o) => o.series);
    const { max } = seriesBounds(all);
    const minY = 0;
    const maxY = niceMax(max);

    drawAxes(ctx, w, h, pad, minY, maxY);
    for (const o of Object.values(seriesMap)) {
      drawLine(ctx, w, h, pad, o.series, minY, maxY, o.color);
    }
    drawLegend(ctx, Object.values(seriesMap).map((o) => ({ label: o.label, color: o.color })));
  }

  // ---------- Compare default ----------
  const compareDetails = $("#compareDetails");
  const mqDesktop = window.matchMedia("(min-width: 860px)");
  let userToggledCompare = false;

  compareDetails?.addEventListener("toggle", () => {
    userToggledCompare = true;
    if (state.hasData) redrawCharts();
  });

  function syncCompareDefault() {
    if (!compareDetails) return;
    if (userToggledCompare) return;
    compareDetails.open = mqDesktop.matches;
  }

  // ---------- State ----------
  const state = {
    hasData: false,
    inflacaoOn: false,
    fatorInflacaoMensal: 0,
    meses: 0,
    inputs: { valorInicial: 0, aporteMensal: 0 },
    display: { poup: [], simple: [], comp: [], real: [], var: [] },
  };

  function clearOutputs() {
    state.hasData = false;
    timelineList && (timelineList.innerHTML = "");
    cardsGrid && (cardsGrid.innerHTML = "");
    $("#miniReal") && ($("#miniReal").textContent = "—");
    $("#miniVar") && ($("#miniVar").textContent = "—");
    closeTip();

    [cPoup, cSimples, cComposto, cCompare].forEach((c) => {
      if (!c) return;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
    });
  }

  // ---------- Compute ----------
  function readInputs() {
    return {
      valorInicial: toNumberBR(elValorInicial?.value),
      aporteMensal: toNumberBR(elAporteMensal?.value),
      prazoMeses: Math.round(toNumberBR(elPrazoMeses?.value)),
      taxaPoupanca: toNumberBR(elTaxaPoupanca?.value),
      taxaAlternativo: toNumberBR(elTaxaAlternativo?.value),
      inflacaoOn: !!elToggleInflacao?.checked,
      inflacaoAnual: toNumberBR(elInflacaoAnual?.value),
      taxaAtivoReal: toNumberBR(elTaxaAtivoReal?.value),
      taxaRendaVar: toNumberBR(elTaxaRendaVar?.value),
    };
  }

  function validateInputs(i) {
    const finiteAll =
      Number.isFinite(i.valorInicial) &&
      Number.isFinite(i.aporteMensal) &&
      Number.isFinite(i.prazoMeses) &&
      Number.isFinite(i.taxaPoupanca) &&
      Number.isFinite(i.taxaAlternativo) &&
      Number.isFinite(i.taxaAtivoReal) &&
      Number.isFinite(i.taxaRendaVar) &&
      (!i.inflacaoOn || Number.isFinite(i.inflacaoAnual));

    if (!finiteAll) return "Preencha os campos com números válidos.";
    if (
      isNeg(i.valorInicial) || isNeg(i.aporteMensal) ||
      isNeg(i.taxaPoupanca) || isNeg(i.taxaAlternativo) ||
      isNeg(i.taxaAtivoReal) || isNeg(i.taxaRendaVar) ||
      (i.inflacaoOn && isNeg(i.inflacaoAnual))
    ) return "Sem valores negativos, combinado? 🙂";

    if (i.prazoMeses < 1 || i.prazoMeses > 600) return "Prazo: use de 1 a 600 meses.";
    if (i.inflacaoOn && i.inflacaoAnual > 200) return "Inflação muito alta. Ajuste para um valor realista.";
    return "";
  }

  function renderCards() {
    if (!cardsGrid) return;

    const m = state.meses;
    const totalAportadoNom = state.inputs.valorInicial + state.inputs.aporteMensal * m;
    const totalAportado = state.inflacaoOn
      ? totalAportadoNom / Math.pow(1 + state.fatorInflacaoMensal, m)
      : totalAportadoNom;

    const finalP = state.display.poup[m];
    const finalS = state.display.simple[m];
    const finalC = state.display.comp[m];
    const finalR = state.display.real[m];
    const finalV = state.display.var[m];

    const jurosC = finalC - totalAportado;
    const diffCP = finalC - finalP;

    cardsGrid.innerHTML = [
      cardHTML("Poupança (final)", formatBrl(finalP)),
      cardHTML("Juros simples (final)", formatBrl(finalS)),
      cardHTML("Juros compostos (final)", formatBrl(finalC)),
      cardHTML("Ativo real (simulação)", formatBrl(finalR)),
      cardHTML("Renda variável (simulação)", formatBrl(finalV)),
      cardHTML("Total aportado", formatBrl(totalAportado), "Valor inicial + aportes."),
      cardHTML("Juros ganhos", formatBrl(jurosC), "Considerando o composto."),
      cardHTML("Diferença: composto vs poupança", formatBrl(diffCP)),
    ].join("");

    $("#miniReal") && ($("#miniReal").textContent = formatBrl(finalR));
    $("#miniVar") && ($("#miniVar").textContent = formatBrl(finalV));
  }

  function computeAndRender() {
    const i = readInputs();
    const err = validateInputs(i);
    if (err) { setMsg(err, "danger"); return; }

    setMsg("Calculando…", "info");

    const taxaMensalP = annualToMonthlyRate(i.taxaPoupanca);
    const taxaMensalA = annualToMonthlyRate(i.taxaAlternativo);
    const taxaMensalReal = annualToMonthlyRate(i.taxaAtivoReal);
    const taxaMensalVar = annualToMonthlyRate(i.taxaRendaVar);

    const poup = simulateMonthByMonthCompound({ initial: i.valorInicial, aporteMensal: i.aporteMensal, meses: i.prazoMeses, taxaMensal: taxaMensalP });
    const simple = simulateMonthByMonthSimpleInterest({ initial: i.valorInicial, aporteMensal: i.aporteMensal, meses: i.prazoMeses, taxaMensal: taxaMensalA });
    const comp = simulateMonthByMonthCompound({ initial: i.valorInicial, aporteMensal: i.aporteMensal, meses: i.prazoMeses, taxaMensal: taxaMensalA });
    const real = simulateMonthByMonthCompound({ initial: i.valorInicial, aporteMensal: i.aporteMensal, meses: i.prazoMeses, taxaMensal: taxaMensalReal });
    const variavel = simulateMonthByMonthCompound({ initial: i.valorInicial, aporteMensal: i.aporteMensal, meses: i.prazoMeses, taxaMensal: taxaMensalVar });

    let display = { poup, simple, comp, real, var: variavel };
    let fatorInflacaoMensal = 0;

    if (i.inflacaoOn) {
      fatorInflacaoMensal = annualToMonthlyRate(i.inflacaoAnual);
      display = {
        poup: deflateSeries(poup, i.inflacaoAnual),
        simple: deflateSeries(simple, i.inflacaoAnual),
        comp: deflateSeries(comp, i.inflacaoAnual),
        real: deflateSeries(real, i.inflacaoAnual),
        var: deflateSeries(variavel, i.inflacaoAnual),
      };
    }

    state.hasData = true;
    state.inflacaoOn = i.inflacaoOn;
    state.fatorInflacaoMensal = fatorInflacaoMensal;
    state.meses = i.prazoMeses;
    state.inputs.valorInicial = i.valorInicial;
    state.inputs.aporteMensal = i.aporteMensal;
    state.display = display;

    renderTimeline(i.prazoMeses);
    renderCards();
    syncCompareDefault();
    redrawCharts();

    setMsg("Pronto. Toque na timeline para ver detalhes.", "ok");
  }

  form?.addEventListener("submit", (e) => { e.preventDefault(); computeAndRender(); });

  function redrawCharts() {
    if (!state.hasData) return;

    drawSingleChart(cPoup, state.display.poup, COLORS.poup);
    drawSingleChart(cSimples, state.display.simple, COLORS.simple);
    drawSingleChart(cComposto, state.display.comp, COLORS.comp);

    if (compareDetails && compareDetails.open) {
      drawCompareChart(cCompare, {
        poup: { label: "Poupança", color: COLORS.poup, series: state.display.poup },
        simple: { label: "Simples", color: COLORS.simple, series: state.display.simple },
        comp: { label: "Composto", color: COLORS.comp, series: state.display.comp },
        real: { label: "Ativo real (sim.)", color: COLORS.real, series: state.display.real },
        variavel: { label: "Renda var. (sim.)", color: COLORS.var, series: state.display.var },
      });
    } else if (cCompare) {
      const ctx = cCompare.getContext("2d");
      ctx.clearRect(0, 0, cCompare.width, cCompare.height);
    }
  }

  window.addEventListener("resize", debounce(() => {
    syncCompareDefault();
    redrawCharts();
  }, 200));

  // ---------- Init ----------
  function init() {
    menuOverlay && (menuOverlay.hidden = true);
    tutorialModal && (tutorialModal.hidden = true);
    pdfHelpModal && (pdfHelpModal.hidden = true);
    document.body.classList.remove("is-locked");
    btnMenu?.setAttribute("aria-expanded", "false");

    applyDefaults();
    clearOutputs();
    syncCompareDefault();
  }

  init();
})();
