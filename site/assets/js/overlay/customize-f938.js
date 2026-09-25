(function (window, document) {
  "use strict";

  var DEVICE_SIZES = {
    desktop: { width: 1366, height: 768 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 812 }
  };
  var PRAYER_LABELS = { subuh: "Subuh", dhuhur: "Dhuhur", ashar: "Ashar", maghrib: "Maghrib", isha: "Isya" };
  var PRAYER_STATE_LABELS = { pre_adzan: "Pra-adzan", adzan: "Adzan", iqamah: "Menunggu iqamah", prayer: "Pelaksanaan" };
  var state = { activeSection: "prayer", timer: null, baselines: {}, frameReady: false, channel: null, requestId: "", open: false };

  function byId(id) { return document.getElementById(id); }
  function core() { return window.OverlayCustomizerCore; }
  function funeral() { return window.BereavementFuneralEditor; }
  function education() { return window.WorshipEducationEditor; }
  function activePanelName() { var panel = document.querySelector("[data-customizer-panel].is-active"); return panel ? panel.dataset.customizerPanel : "prayer"; }
  function selectedPrayerView() { var view = document.querySelector('[data-customizer-panel="prayer"] [data-panel-view].is-active'); return view ? view.dataset.panelView : "fardhu"; }
  function option(value, label) { return { value: value, label: label }; }
  function prayerStates() {
    var view = selectedPrayerView(), rows = [];
    if (view === "friday") { return [option("jumat:information", "Jumat · Informasi"), option("jumat:prayer", "Jumat · Pelaksanaan")]; }
    if (view === "dhuha") { return [option("dhuhaAwwal:phase", "Dhuha Awwal"), option("dhuhaWoosthaa:phase", "Dhuha Wustha"), option("dhuhaAwwabin:phase", "Dhuha Awwabin")]; }
    if (view === "qiyamul") { return [option("qiyamulLail:first_reminder", "Qiyamul · Pengingat awal"), option("qiyamulLail:last_third_warning", "Qiyamul · Menuju sepertiga terakhir"), option("qiyamulLail:last_third_recurring", "Qiyamul · Sepertiga terakhir"), option("qiyamulLail:fajr_preparation", "Qiyamul · Persiapan Subuh")]; }
    Object.keys(PRAYER_LABELS).forEach(function (prayerKey) { Object.keys(PRAYER_STATE_LABELS).forEach(function (stateKey) { rows.push(option(prayerKey + ":" + stateKey, PRAYER_LABELS[prayerKey] + " · " + PRAYER_STATE_LABELS[stateKey])); }); });
    return rows;
  }

  var registry = {
    prayer: {
      label: "Waktu Sholat",
      description: "Preview setiap state Fardhu, Jumat, Dhuha, dan Qiyamul dari nilai form yang belum disimpan.",
      states: prayerStates,
      candidate: function (frameWindow, language, stateKey) { return core() && core().buildPreviewCandidate("prayer", { language: language, stateKey: stateKey }); },
      draft: function () { return core() && core().draft("prayer"); },
      save: function () { core().saveDraft("prayer"); },
      reset: function () { core().resetDraft("prayer"); }
    },
    definition: definitionAdapter("Konten", "Konten bilingual, playlist, trigger, scope, dan definisi terpilih."),
    layout: definitionAdapter("Tampilan", "Background, overlay, card, posisi, widget, opacity, dan layering terpilih."),
    orchestration: definitionAdapter("Prioritas", "Widget modular, protected phase, prioritas, dan aturan konflik terpilih."),
    funeral: {
      label: "Jenazah / Ghaib",
      description: "Event form dan sequence presentasi dirender oleh FuneralOverlayController pada index.html.",
      states: function () { return funeral() && funeral().previewStates ? funeral().previewStates() : []; },
      candidate: function (frameWindow, language, stateKey) { return funeral() && funeral().previewCandidate ? funeral().previewCandidate(frameWindow, language, stateKey) : null; },
      draft: function () { return funeral() && funeral().draft ? funeral().draft() : null; },
      save: function () { if (funeral() && funeral().saveDraft) { funeral().saveDraft(); } },
      reset: function () { if (funeral() && funeral().resetDraft) { funeral().resetDraft(); } }
    },
    education: {
      label: "Materi Ibadah",
      description: "Katalog, style, isi, dalil, dan bahasa aktif memakai renderer Materi Ibadah yang sama dengan index.html.",
      states: function () { return education() && education().previewStates ? education().previewStates() : []; },
      candidate: function (frameWindow, language, stateKey) { return education() && education().previewCandidate ? education().previewCandidate(frameWindow, language, stateKey) : null; },
      draft: function () { return education() && education().draft ? education().draft() : null; },
      save: function () { if (education() && education().saveDraft) { education().saveDraft(); } },
      reset: function () { if (education() && education().resetDraft) { education().resetDraft(); } }
    },
    preview: {
      label: "Preview Scheduler",
      description: "Panel ini sendiri adalah simulator runtime dan tidak menghasilkan konfigurasi production terpisah.",
      reason: "Preview tambahan tidak berlaku: panel ini sudah menjalankan Preview index.html untuk scheduler, tanggal, waktu, fase, dan trigger simulasi."
    }
  };

  function definitionAdapter(label, description) {
    var sectionKey = label === "Konten" ? "definition" : label === "Tampilan" ? "layout" : "orchestration";
    return {
      label: label,
      description: description,
      states: function () { return [option("current", "Definisi terpilih")]; },
      candidate: function (frameWindow, language) { return core() && core().buildPreviewCandidate(sectionKey, { language: language }); },
      draft: function () { return core() && core().draft(sectionKey); },
      save: function () { core().saveDraft(sectionKey); },
      reset: function () { core().resetDraft(sectionKey); }
    };
  }

  function stable(value) {
    var seen = [];
    return JSON.stringify(value, function (key, row) {
      if (row && typeof row === "object") { if (seen.indexOf(row) >= 0) { return null; } seen.push(row); }
      return row;
    });
  }
  function signature(section) { var adapter = registry[section]; if (!adapter || !adapter.draft) { return ""; } try { return stable(adapter.draft()); } catch (error) { return ""; } }
  function relatedSections(section) { return ["definition", "layout", "orchestration"].indexOf(section) >= 0 ? ["definition", "layout", "orchestration"] : section === "all" ? Object.keys(registry) : [section]; }
  function syncBaselines(section) { relatedSections(section).forEach(function (key) { if (registry[key] && registry[key].draft) { state.baselines[key] = signature(key); } }); updateDirty(); }
  function updateDirty() {
    var adapter = registry[state.activeSection], dirty = Boolean(adapter && adapter.draft && state.baselines[state.activeSection] !== undefined && signature(state.activeSection) !== state.baselines[state.activeSection]);
    var badge = byId("sectionPreviewDirtyState");
    badge.textContent = dirty ? "Unsaved Changes" : "Tersimpan";
    badge.classList.toggle("is-clean", !dirty);
    return dirty;
  }
  function setStatus(message, isError) { var node = byId("sectionPreviewStatus"); node.textContent = message; node.classList.toggle("is-error", Boolean(isError)); }

  function populateStates() {
    var select = byId("sectionPreviewState"), previous = select.value, adapter = registry[state.activeSection], rows = adapter && adapter.states ? adapter.states() : [];
    select.replaceChildren();
    if (!rows.length) { rows = [option("current", "Tampilan saat ini")]; }
    rows.forEach(function (row) { var node = document.createElement("option"); node.value = row.value; node.textContent = row.label; select.appendChild(node); });
    if (rows.some(function (row) { return row.value === previous; })) { select.value = previous; }
  }
  function updateSection() {
    state.activeSection = activePanelName();
    state.lastCandidate = null;
    var adapter = registry[state.activeSection] || registry.preview, workspace = byId("sectionPreviewWorkspace"), notApplicable = Boolean(adapter.reason);
    byId("sectionPreviewTitle").textContent = "Preview index.html · " + adapter.label;
    byId("sectionPreviewDescription").textContent = adapter.description;
    workspace.classList.toggle("is-not-applicable", notApplicable);
    ["sectionPreviewRefreshButton", "sectionPreviewApplyButton", "sectionPreviewSaveButton", "sectionPreviewResetButton", "sectionPreviewState", "sectionPreviewLanguage"].forEach(function (id) { byId(id).disabled = notApplicable; });
    populateStates();
    if (state.baselines[state.activeSection] === undefined && adapter.draft) { state.baselines[state.activeSection] = signature(state.activeSection); }
    if (notApplicable) { setStatus(adapter.reason, false); } else if (state.open) { scheduleRender(30); }
    updateDirty();
  }

  function render() {
    window.clearTimeout(state.timer); state.timer = null;
    var adapter = registry[state.activeSection], frame = byId("sectionPreviewFrame"), frameWindow = frame && frame.contentWindow;
    updateDirty();
    if (!state.open || !adapter || adapter.reason) { return; }
    if (frameWindow && frameWindow.OverlayManager && frameWindow.PrayerDashboardRuntime) { state.frameReady = true; }
    if (!state.frameReady || !frameWindow || !frameWindow.OverlayManager || !frameWindow.PrayerDashboardRuntime) { setStatus("Menyiapkan renderer dan jadwal index.html...", false); scheduleRender(450); return; }
    var candidate;
    try { candidate = adapter.candidate(frameWindow, byId("sectionPreviewLanguage").value, byId("sectionPreviewState").value); } catch (error) { setStatus("Preview belum dapat dirender: " + error.message, true); return; }
    if (!candidate) { setStatus("Data panel masih dimuat atau belum cukup untuk membuat preview. Preview akan mencoba lagi otomatis.", false); scheduleRender(500); return; }
    frameWindow.postMessage({ type: "mpm:overlay-preview", candidate: candidate }, window.location.origin);
    state.lastCandidate = candidate;
    setStatus("Live preview aktif · draft sementara · " + (byId("sectionPreviewViewport").selectedOptions[0].textContent) + " · skala " + byId("sectionPreviewScale").selectedOptions[0].textContent, false);
  }
  function scheduleRender(delay) { if (!state.open) { updateDirty(); return; } window.clearTimeout(state.timer); state.timer = window.setTimeout(render, Number(delay === undefined ? 180 : delay)); }

  function setOpen(open) {
    state.open = Boolean(open); byId("sectionPreviewWorkspace").hidden = !state.open;
    var toggle = byId("sectionPreviewToggleButton"); toggle.setAttribute("aria-expanded", state.open ? "true" : "false"); toggle.classList.toggle("is-active", state.open);
    if (state.open) { var frame = byId("sectionPreviewFrame"); if (frame.getAttribute("src") === "about:blank") { state.frameReady = false; frame.src = frame.dataset.previewSrc; } updateSection(); resizeFrame(); }
  }
  function resizeFrame() {
    var stage = byId("sectionPreviewStage"), shell = byId("sectionPreviewFrameShell"), frame = byId("sectionPreviewFrame"), mode = byId("sectionPreviewViewport").value, scale = Number(byId("sectionPreviewScale").value || 1), size = DEVICE_SIZES[mode];
    stage.dataset.viewport = mode;
    if (!size) { shell.style.cssText = ""; frame.style.cssText = ""; return; }
    var availableWidth = Math.max(280, stage.clientWidth - 20), availableHeight = Math.max(260, stage.clientHeight - 20), fit = Math.min(1, availableWidth / size.width, availableHeight / size.height), displayScale = Math.min(scale, fit);
    frame.style.width = size.width + "px"; frame.style.height = size.height + "px"; frame.style.transform = "scale(" + displayScale + ")";
    shell.style.width = Math.round(size.width * displayScale) + "px"; shell.style.height = Math.round(size.height * displayScale) + "px";
  }
  function applyTemporary() {
    render();
    var candidate = state.lastCandidate;
    if (!candidate) { setStatus("Preview belum siap untuk diterapkan.", true); return; }
    var message = { type: "mpm:overlay-session-apply", requestId: "apply-" + Date.now(), candidate: candidate };
    state.requestId = message.requestId;
    if (state.channel) { state.channel.postMessage(message); }
    else { try { window.localStorage.setItem("mpm:overlay-customizer:session-apply", JSON.stringify(message)); window.localStorage.removeItem("mpm:overlay-customizer:session-apply"); } catch (error) {} }
    setStatus("Draft diterapkan sementara ke index.html yang sedang terbuka; SQL belum berubah.", false);
  }
  function save() { var adapter = registry[state.activeSection]; if (!adapter || !adapter.save) { return; } adapter.save(); setStatus("Menyimpan melalui mekanisme SQL modul " + adapter.label + "...", false); }
  function reset() { var adapter = registry[state.activeSection]; if (!adapter || !adapter.reset) { return; } adapter.reset(); syncBaselines(state.activeSection); scheduleRender(20); setStatus("Draft dikembalikan ke nilai tersimpan. Default sistem tidak diubah.", false); }
  function toggleFullscreen() { var workspace = byId("sectionPreviewWorkspace"), active = workspace.classList.toggle("is-fullscreen"); byId("sectionPreviewFullscreenButton").textContent = active ? "Kecilkan" : "Perbesar"; window.setTimeout(resizeFrame, 30); }

  function sectionForEvent(target) { if (target.closest && target.closest("#worshipEducationSlideDialog")) { return "education"; } var panel = target.closest && target.closest("[data-customizer-panel]"); return panel ? panel.dataset.customizerPanel : ""; }
  function editorMutation(event) {
    var section = sectionForEvent(event.target); if (!section || section === "preview") { return; }
    if (event.target.matches && (event.target.matches('input[type="search"]') || ["mediaSearchInput", "mediaCategoryFilter", "mediaKindFilter", "worshipEducationFilter"].indexOf(event.target.id) >= 0)) { return; }
    if (section === state.activeSection) { scheduleRender(); } else { window.setTimeout(function () { updateDirty(); }, 20); }
  }
  function bind() {
    byId("sectionPreviewToggleButton").addEventListener("click", function () { setOpen(!state.open); });
    byId("sectionPreviewCloseButton").addEventListener("click", function () { setOpen(false); });
    byId("sectionPreviewRefreshButton").addEventListener("click", function () { render(); });
    byId("sectionPreviewApplyButton").addEventListener("click", applyTemporary);
    byId("sectionPreviewSaveButton").addEventListener("click", save);
    byId("sectionPreviewResetButton").addEventListener("click", reset);
    byId("sectionPreviewFullscreenButton").addEventListener("click", toggleFullscreen);
    byId("sectionPreviewViewport").addEventListener("change", function () { resizeFrame(); scheduleRender(20); });
    byId("sectionPreviewScale").addEventListener("change", resizeFrame);
    byId("sectionPreviewState").addEventListener("change", function () { scheduleRender(20); });
    byId("sectionPreviewLanguage").addEventListener("change", function () { scheduleRender(20); });
    byId("sectionPreviewFrame").addEventListener("load", function () { state.frameReady = true; scheduleRender(250); });
    document.addEventListener("input", editorMutation, true); document.addEventListener("change", editorMutation, true);
    document.addEventListener("click", function (event) { if (event.target.closest("[data-panel], [data-panel-view-button], .definition-button, .worship-education-slide-actions, .sequence-actions, .widget-editor-card, .media-card")) { window.setTimeout(function () { updateSection(); scheduleRender(20); }, 30); } }, true);
    window.addEventListener("resize", resizeFrame);
    window.addEventListener("keydown", function (event) { if (event.key === "Escape" && byId("sectionPreviewWorkspace").classList.contains("is-fullscreen")) { toggleFullscreen(); } });
    window.addEventListener("mpm:customizer-loaded", function (event) { window.setTimeout(function () { syncBaselines(event.detail && event.detail.section || "all"); populateStates(); scheduleRender(50); }, 30); });
    window.addEventListener("mpm:customizer-saved", function (event) { window.setTimeout(function () { syncBaselines(event.detail && event.detail.section || "all"); populateStates(); scheduleRender(50); setStatus("Tersimpan permanen; preview disinkronkan dengan data SQL terbaru.", false); }, 40); });
    if ("ResizeObserver" in window) { new ResizeObserver(resizeFrame).observe(byId("sectionPreviewStage")); }
  }
  function boot() {
    if (!byId("sectionPreviewWorkspace")) { return; }
    try {
      if ("BroadcastChannel" in window) {
        state.channel = new BroadcastChannel("mpm:overlay-customizer-session:v1");
        state.channel.addEventListener("message", function (event) {
          if (event.data && event.data.type === "mpm:overlay-session-applied" && (!state.requestId || event.data.requestId === state.requestId)) {
            setStatus("Apply sementara diterima oleh index.html · SQL tetap tidak berubah.", false);
          }
        });
      }
    } catch (error) { state.channel = null; }
    bind(); updateSection();
    setOpen(false);
  }

  window.CustomizerSectionPreview = { registry: registry, render: render, open: function () { setOpen(true); }, close: function () { setOpen(false); }, activeSection: function () { return state.activeSection; } };
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", boot); } else { boot(); }
})(window, document);
