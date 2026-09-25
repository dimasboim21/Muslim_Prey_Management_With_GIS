(function (window, document) {
  "use strict";

  var model = window.FuneralPresentationModel;
  if (!model) { return; }
  var state = { data: null, event: {}, presentation: null, selectedIndex: 0, playing: false, timer: null, informationRepeat: false };
  var prayerLabels = { subuh: "Subuh", dhuhur: "Dhuhur", ashar: "Ashar", maghrib: "Maghrib", isha: "Isya", jumat: "Jumat" };
  var phaseLabels = ["outside_fardhu", "before_fardhu", "pre_adzan", "adzan", "iqamah", "prayer", "after_prayer"];

  function byId(id) { return document.getElementById(id); }
  function value(id) { var node = byId(id); return node ? node.value : ""; }
  function setValue(id, next) { var node = byId(id); if (node) { node.value = next === null || next === undefined ? "" : next; } }
  function checked(id) { var node = byId(id); return Boolean(node && node.checked); }
  function setChecked(id, next) { var node = byId(id); if (node) { node.checked = Boolean(next); } }
  function selected(name) { return Array.prototype.slice.call(document.querySelectorAll('input[name="' + name + '"]:checked')).map(function (node) { return node.value; }); }
  function setSelected(name, values) { values = Array.isArray(values) ? values : []; document.querySelectorAll('input[name="' + name + '"]').forEach(function (node) { node.checked = values.indexOf(node.value) >= 0; }); }
  function text(value) { return String(value === null || value === undefined ? "" : value); }
  function formatSeconds(total) { total = Math.max(0, Math.round(Number(total) || 0)); var hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), seconds = total % 60; return (hours ? String(hours).padStart(2, "0") + ":" : "") + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0"); }
  function eventFromForm() {
    var photoId = Number(value("funeralDeceasedPhotoMediaId") || 0), photoUrl = value("funeralDeceasedPhotoUrl");
    return {
      eventKey: value("funeralEventKey") || "draft", eventType: value("funeralEventType") || "individual_death",
      deceasedName: value("funeralDeceasedName"), deceasedGender: value("funeralDeceasedGender") || "unknown",
      deceasedPhotoMediaId: photoId || null, deceasedPhotoEnabled: Boolean(photoId && photoUrl && checked("funeralDeceasedPhotoEnabled")),
      deceasedPhoto: photoId && photoUrl ? { id: photoId, publicUrl: photoUrl, originalName: value("funeralDeceasedPhotoName") || "Foto jenazah", mediaKind: "image" } : null,
      fatalityCount: value("funeralFatalityCount") ? Number(value("funeralFatalityCount")) : null,
      eventName: value("funeralEventName"), eventLocation: value("funeralEventLocation"), eventAt: value("funeralEventAt"),
      timezone: value("funeralTimezone") || "Asia/Jakarta", funeralAction: value("funeralAction") || "janazah",
      prayerAt: value("funeralPrayerAt"), prayerMosqueName: value("funeralPrayerMosqueName"), prayerLocation: value("funeralPrayerLocation"),
      ghaibAt: value("funeralGhaibAt"), ghaibLocation: value("funeralGhaibLocation"), sourceName: value("funeralSourceName"),
      guide: findGuide(value("funeralAction") || "janazah", value("funeralMethod") || "syafii")
    };
  }
  function findGuide(action, method) {
    if (!state.data) { return state.event && state.event.guide || null; }
    return (state.data.guides || []).find(function (guide) { return guide.prayerType === action && guide.methodKey === method && guide.verificationStatus === "verified"; }) || null;
  }
  function currentEvent() { return Object.assign({}, state.event || {}, eventFromForm(), { guide: findGuide(value("funeralAction") || "janazah", value("funeralMethod") || "syafii") }); }
  function ensurePresentation(rebuild) {
    var event = currentEvent();
    if (rebuild || !state.presentation) { state.presentation = model.buildDefault(event); }
    else { state.presentation = model.normalize(state.presentation, event); }
    return state.presentation;
  }
  function renderPrayerRules() {
    var body = byId("funeralPrayerRuleBody");
    if (!body) { return; }
    var rules = ensurePresentation(false).schedule.prayerRules;
    body.replaceChildren();
    model.prayers.forEach(function (prayer) {
      var rule = rules[prayer] || { enabled: true, beforeMinutes: 30, afterMinutes: 30, phases: {} };
      var row = document.createElement("tr");
      var name = document.createElement("th"); name.scope = "row"; name.textContent = prayerLabels[prayer]; row.appendChild(name);
      function checkbox(className, isChecked, title) { var cell = document.createElement("td"), input = document.createElement("input"); input.type = "checkbox"; input.className = className; input.checked = Boolean(isChecked); input.title = title || ""; input.addEventListener("change", syncRulesFromTable); cell.appendChild(input); row.appendChild(cell); }
      function numberInput(className, current) { var cell = document.createElement("td"), input = document.createElement("input"); input.type = "number"; input.min = "0"; input.max = "240"; input.className = className; input.value = Number(current || 0); input.addEventListener("change", syncRulesFromTable); cell.appendChild(input); row.appendChild(cell); }
      row.dataset.prayer = prayer;
      checkbox("rule-enabled", rule.enabled !== false, "Boleh tampil pada rentang sholat ini");
      numberInput("rule-before-minutes", rule.beforeMinutes);
      checkbox("rule-phase-outside_fardhu", rule.phases.outside_fardhu);
      checkbox("rule-phase-pre_adzan", rule.phases.pre_adzan);
      checkbox("rule-phase-adzan", rule.phases.adzan);
      checkbox("rule-phase-iqamah", rule.phases.iqamah);
      checkbox("rule-phase-prayer", rule.phases.prayer);
      checkbox("rule-phase-after_prayer", rule.phases.after_prayer);
      numberInput("rule-after-minutes", rule.afterMinutes);
      body.appendChild(row);
    });
  }
  function syncRulesFromTable() {
    var rules = {};
    document.querySelectorAll("#funeralPrayerRuleBody tr[data-prayer]").forEach(function (row) {
      var phases = {};
      phaseLabels.forEach(function (phase) { var input = row.querySelector(".rule-phase-" + phase); phases[phase] = input ? input.checked : phase === "before_fardhu"; });
      phases.before_fardhu = phases.outside_fardhu;
      rules[row.dataset.prayer] = {
        enabled: row.querySelector(".rule-enabled").checked,
        beforeMinutes: Number(row.querySelector(".rule-before-minutes").value || 0),
        afterMinutes: Number(row.querySelector(".rule-after-minutes").value || 0), phases: phases
      };
    });
    ensurePresentation(false).schedule.prayerRules = rules;
  }
  function fillControls() {
    var presentation = ensurePresentation(false), schedule = presentation.schedule;
    setChecked("funeralPresentationEnabled", presentation.isEnabled);
    setValue("funeralInterruptionPolicy", presentation.interruptionPolicy);
    setValue("funeralCompletionAction", presentation.completionAction);
    setChecked("funeralPersistentPrayerEnabled", presentation.persistentPrayerEnabled);
    setSelected("funeralPersistentField", presentation.persistentFields);
    setSelected("funeralAllowedContext", schedule.allowedContexts);
    setSelected("funeralProtectedPhase", schedule.protectedPhases);
    setSelected("funeralProtectedOverride", schedule.protectedOverrides);
    var windowRule = schedule.timeWindows[0] || {};
    setValue("funeralSpecificTimeStart", windowRule.start || ""); setValue("funeralSpecificTimeEnd", windowRule.end || "");
    setValue("funeralCustomRule", schedule.customRule && schedule.customRule.expression || "");
    setChecked("funeralAutoAdjustDuration", presentation.autoAdjustDuration);
    setChecked("funeralShowLawScenes", presentation.contentOptions.showLaw !== false); setChecked("funeralShowEvidenceScenes", presentation.contentOptions.showEvidence !== false); setChecked("funeralShowArabic", presentation.contentOptions.showArabic !== false); setChecked("funeralShowLatin", presentation.contentOptions.showLatin !== false); setChecked("funeralShowTranslation", presentation.contentOptions.showTranslation !== false);
    setValue("funeralMaximumDuration", presentation.maximumDurationSeconds || "");
    setValue("funeralOverflowPolicy", presentation.overflowPolicy);
    document.querySelectorAll("[data-funeral-preset]").forEach(function (button) { button.classList.toggle("is-active", button.dataset.funeralPreset === presentation.presetMode); });
    renderPrayerRules(); renderTimeline(); renderPreview();
  }
  function syncControls() {
    var presentation = ensurePresentation(false), schedule = presentation.schedule;
    presentation.isEnabled = checked("funeralPresentationEnabled");
    presentation.interruptionPolicy = value("funeralInterruptionPolicy") || "finish_scene_pause";
    presentation.completionAction = value("funeralCompletionAction") || "return_normal";
    presentation.persistentPrayerEnabled = checked("funeralPersistentPrayerEnabled");
    presentation.persistentFields = selected("funeralPersistentField");
    presentation.autoAdjustDuration = checked("funeralAutoAdjustDuration");
    presentation.contentOptions = presentation.contentOptions || {}; presentation.contentOptions.showLaw = checked("funeralShowLawScenes"); presentation.contentOptions.showEvidence = checked("funeralShowEvidenceScenes"); presentation.contentOptions.showArabic = checked("funeralShowArabic"); presentation.contentOptions.showLatin = checked("funeralShowLatin"); presentation.contentOptions.showTranslation = checked("funeralShowTranslation");
    presentation.maximumDurationSeconds = value("funeralMaximumDuration") ? Number(value("funeralMaximumDuration")) : null;
    presentation.overflowPolicy = value("funeralOverflowPolicy") || "auto_optimize";
    schedule.displayEnabled = presentation.isEnabled;
    schedule.allowedContexts = selected("funeralAllowedContext");
    schedule.protectedPhases = selected("funeralProtectedPhase");
    schedule.protectedOverrides = selected("funeralProtectedOverride");
    schedule.timeWindows = value("funeralSpecificTimeStart") && value("funeralSpecificTimeEnd") ? [{ start: value("funeralSpecificTimeStart"), end: value("funeralSpecificTimeEnd") }] : [];
    schedule.customRule = { expression: value("funeralCustomRule"), enabled: schedule.allowedContexts.indexOf("custom_rule") >= 0 && Boolean(value("funeralCustomRule")) };
    syncRulesFromTable();
    state.presentation = model.normalize(presentation, currentEvent());
  }
  function activeVariant(scene) {
    var languageRows = scene.contents.id || (scene.contents.id = {}), gender = currentEvent().deceasedGender || "unknown";
    if (!languageRows[gender]) { languageRows[gender] = JSON.parse(JSON.stringify(languageRows.neutral || languageRows.unknown || languageRows.male || {})); }
    return languageRows[gender];
  }
  function renderTimeline() {
    var host = byId("funeralSceneTimeline"); if (!host) { return; }
    var event = currentEvent(), presentation = ensurePresentation(false), timeline = model.timeline(presentation, event);
    host.replaceChildren();
    renderChapterDurations(presentation, event);
    presentation.sequence.scenes.forEach(function (scene, index) {
      var rowTiming = timeline.rows.find(function (item) { return item.scene.sceneKey === scene.sceneKey; });
      var row = document.createElement("article"); row.className = "funeral-scene-row" + (scene.isEnabled ? "" : " is-disabled"); row.dataset.sceneKey = scene.sceneKey;
      var time = document.createElement("span"); time.className = "funeral-scene-time"; time.textContent = rowTiming ? formatSeconds(rowTiming.startSeconds) + "–" + formatSeconds(rowTiming.endSeconds) : "--:--";
      var toggle = document.createElement("input"); toggle.type = "checkbox"; toggle.checked = scene.isEnabled; toggle.title = "Aktif/nonaktif"; toggle.addEventListener("change", function () { scene.isEnabled = toggle.checked; presentation.presetMode = "custom"; renderTimeline(); renderPreview(); });
      var label = document.createElement("div"); label.className = "funeral-scene-title"; var strong = document.createElement("strong"), small = document.createElement("small"); strong.textContent = scene.title; small.textContent = scene.chapterKey + " · " + scene.sceneType; label.append(strong, small);
      var mode = document.createElement("select"); [["manual", "Manual"], ["auto", "Auto"], ["content_based", "Content Based"], ["proportional", "Proportional"]].forEach(function (optionRow) { var option = document.createElement("option"); option.value = optionRow[0]; option.textContent = optionRow[1]; mode.appendChild(option); }); mode.value = scene.durationMode; mode.addEventListener("change", function () { scene.durationMode = mode.value; presentation.presetMode = "custom"; renderTimeline(); });
      var duration = document.createElement("input"); duration.type = "number"; duration.min = "1"; duration.max = "600"; duration.step = ".5"; duration.value = scene.durationSeconds; duration.title = "Durasi detik"; duration.addEventListener("change", function () { scene.durationSeconds = Number(duration.value || 1); scene.preferredDuration = scene.durationSeconds; presentation.presetMode = "custom"; renderTimeline(); });
      var actions = document.createElement("div"); actions.className = "funeral-scene-actions";
      function actionButton(labelText, title, handler) { var button = document.createElement("button"); button.type = "button"; button.className = "button button-secondary"; button.textContent = labelText; button.title = title; button.addEventListener("click", handler); actions.appendChild(button); }
      actionButton("↑", "Pindah ke atas", function () { if (index > 0) { var moved = presentation.sequence.scenes.splice(index, 1)[0]; presentation.sequence.scenes.splice(index - 1, 0, moved); presentation.presetMode = "custom"; renderTimeline(); } });
      actionButton("↓", "Pindah ke bawah", function () { if (index < presentation.sequence.scenes.length - 1) { var moved = presentation.sequence.scenes.splice(index, 1)[0]; presentation.sequence.scenes.splice(index + 1, 0, moved); presentation.presetMode = "custom"; renderTimeline(); } });
      actionButton("Edit", "Edit isi laman", function () { if(editor.hidden){ensureEditor();}editor.hidden = !editor.hidden; });
      actionButton("Preview", "Tampilkan laman ini", function () { state.selectedIndex = Math.max(0, enabledScenes().indexOf(scene)); renderPreview(); });
      var editor = document.createElement("section"); editor.className = "funeral-scene-editor"; editor.hidden = true;
      function ensureEditor(){if(editor.dataset.built==="true"){return;}editor.dataset.built="true";
      var grid = document.createElement("div"); grid.className = "funeral-scene-editor-grid"; var variant = activeVariant(scene);
      function field(labelText, key, type, wide) { var wrapper = document.createElement("label"); if (wide) { wrapper.className = "wide"; } wrapper.appendChild(document.createTextNode(labelText)); var input = document.createElement(type === "textarea" ? "textarea" : "input"); input.value = variant[key] || ""; input.addEventListener("input", function () { variant[key] = input.value; presentation.presetMode = "custom"; if (enabledScenes()[state.selectedIndex] === scene) { renderPreview(); } }); wrapper.appendChild(input); grid.appendChild(wrapper); }
      field("Judul", "title", "input", false); field("Subjudul", "subtitle", "input", false); field("Isi singkat", "body", "textarea", true); field("Arab", "arabic", "textarea", true); field("Latin", "latin", "textarea", true); field("Arti", "translation", "textarea", true); field("Instruksi", "instruction", "textarea", true); field("Catatan sumber", "sourceNote", "textarea", true);
      function numericSceneField(labelText, key, minimum, maximum, step) { var wrapper = document.createElement("label"), input = document.createElement("input"); wrapper.appendChild(document.createTextNode(labelText)); input.type = "number"; input.min = minimum; input.max = maximum; input.step = step; input.value = scene[key]; input.addEventListener("change", function () { var next = Number(input.value); if (key === "minimumDuration") { scene.minimumDuration = next; scene.preferredDuration = Math.max(next, Number(scene.preferredDuration || next)); scene.maximumDuration = Math.max(scene.preferredDuration, Number(scene.maximumDuration || scene.preferredDuration)); } else if (key === "preferredDuration") { scene.preferredDuration = next; scene.minimumDuration = Math.min(next, Number(scene.minimumDuration || next)); scene.maximumDuration = Math.max(next, Number(scene.maximumDuration || next)); } else if (key === "maximumDuration") { scene.maximumDuration = Math.max(next, Number(scene.preferredDuration || next)); } else { scene[key] = next; } presentation.presetMode = "custom"; renderTimeline(); renderPreview(); }); wrapper.appendChild(input); grid.appendChild(wrapper); }
      numericSceneField("Weight", "weight", ".01", "1000", ".01"); numericSceneField("Minimum (detik)", "minimumDuration", "1", "600", ".5"); numericSceneField("Preferred (detik)", "preferredDuration", "1", "1200", ".5"); numericSceneField("Maximum (detik)", "maximumDuration", "1", "1800", ".5");
      scene.reference = scene.reference || {};
      function referenceField(labelText, key, wide) { var wrapper = document.createElement("label"), input = document.createElement("input"); if (wide) { wrapper.className = "wide"; } wrapper.appendChild(document.createTextNode(labelText)); input.value = scene.reference[key] || ""; input.addEventListener("input", function () { scene.reference[key] = input.value; if (key === "referenceKey") { scene.referenceKey = input.value; } presentation.presetMode = "custom"; }); wrapper.appendChild(input); grid.appendChild(wrapper); }
      referenceField("Reference key", "referenceKey", false); referenceField("Kitab / sumber", "book", false); referenceField("Bab", "chapter", false); referenceField("Nomor hadis/ID", "hadithNumber", false); referenceField("Perawi", "narrator", false); referenceField("Status/grade", "grade", false); referenceField("URL HTTPS", "url", true);
      var verificationLabel = document.createElement("label"), verification = document.createElement("select"); verificationLabel.appendChild(document.createTextNode("Verifikasi sumber")); [["pending", "Menunggu verifikasi"], ["needs_review", "Perlu review"], ["verified", "Terverifikasi"], ["rejected", "Ditolak"]].forEach(function (optionRow) { var option = document.createElement("option"); option.value = optionRow[0]; option.textContent = optionRow[1]; verification.appendChild(option); }); verification.value = scene.reference.verificationStatus || "pending"; verification.addEventListener("change", function () { scene.reference.verificationStatus = verification.value; presentation.presetMode = "custom"; }); verificationLabel.appendChild(verification); grid.appendChild(verificationLabel);
      var mediaLabel = document.createElement("label"); mediaLabel.className = "wide"; mediaLabel.appendChild(document.createTextNode("Media existing (read-only path)")); var mediaInput = document.createElement("input"); mediaInput.value = scene.mediaPath || "Tanpa media"; mediaInput.readOnly = true; mediaLabel.appendChild(mediaInput); grid.appendChild(mediaLabel); editor.appendChild(grid);}
      row.append(time, toggle, label, mode, duration, actions, editor); host.appendChild(row);
    });
    byId("funeralTotalDuration").textContent = formatSeconds(timeline.totalSeconds);
    var maximum = Number(presentation.maximumDurationSeconds || 0), warning = byId("funeralDurationWarning");
    warning.textContent = maximum && timeline.totalSeconds > maximum ? "Melebihi batas " + formatSeconds(maximum) + ". Pilih optimasi; isi tidak akan dipotong." : timeline.rows.length + " laman aktif · tidak ada scroll pada layar publik.";
    document.querySelectorAll("[data-funeral-preset]").forEach(function (button) { button.classList.toggle("is-active", button.dataset.funeralPreset === presentation.presetMode); });
  }
  function renderChapterDurations(presentation, event) {
    var host = byId("funeralChapterDurations"); if (!host) { return; } host.replaceChildren();
    model.chapterSummary(presentation, event).forEach(function (chapter) { var row = document.createElement("label"), name = document.createElement("span"), input = document.createElement("input"), actual = document.createElement("small"); row.className = "funeral-chapter-duration-row"; name.textContent = chapter.title; actual.textContent = chapter.sceneCount + " laman · aktual " + formatSeconds(chapter.durationSeconds); input.type = "number"; input.min = "1"; input.max = "3600"; input.step = ".5"; input.placeholder = "Auto"; input.value = chapter.targetSeconds || ""; input.title = "Target total bagian dalam detik"; input.addEventListener("change", function () { model.setChapterDuration(presentation, chapter.chapterKey, input.value); renderTimeline(); renderPreview(); }); row.append(name, input, actual); host.appendChild(row); });
  }
  function enabledScenes() { var presentation = ensurePresentation(false); return model.timeline(presentation, currentEvent()).rows.map(function (row) { return row.scene; }).filter(function (scene) { return !state.informationRepeat || scene.chapterKey === "information" || scene.chapterKey === "invitation"; }); }
  function renderPreview() {
    var host = byId("funeralScenePreview"); if (!host) { return; }
    var scenes = enabledScenes(), event = currentEvent();
    if (!scenes.length) { host.innerHTML = '<p class="form-help">Tidak ada laman aktif.</p>'; return; }
    state.selectedIndex = Math.max(0, Math.min(scenes.length - 1, state.selectedIndex));
    var scene = scenes[state.selectedIndex], selectedContent = model.selectedContent(scene, event, "id");
    host.replaceChildren(); var copy = document.createElement("div"); copy.className = "funeral-scene-preview-copy";
    var sceneMedia = scene.sceneKey === "death-information" && event.deceasedPhotoEnabled && event.deceasedPhoto ? event.deceasedPhoto.publicUrl : scene.mediaPath;
    if (sceneMedia) { var image = document.createElement("img"); image.src = sceneMedia; image.alt = scene.sceneKey === "death-information" ? "Foto " + (event.deceasedName || "almarhum atau almarhumah") : "Ilustrasi " + scene.title; copy.appendChild(image); }
    function line(tag, className, contentValue, attributes) { if (!contentValue) { return; } var node = document.createElement(tag); node.className = className; node.textContent = contentValue; if (attributes) { Object.keys(attributes).forEach(function (key) { node.setAttribute(key, attributes[key]); }); } copy.appendChild(node); }
    line("p", "eyebrow", selectedContent.eyebrow); line("h4", "", selectedContent.title || scene.title); line("p", "", selectedContent.subtitle); line("p", "", selectedContent.body);
    var contentOptions = ensurePresentation(false).contentOptions || {};
    if (scene.settings.showArabic !== false && contentOptions.showArabic !== false) { line("p", "arabic", selectedContent.arabic, { lang: "ar", dir: "rtl" }); }
    if (scene.settings.showLatin !== false && contentOptions.showLatin !== false) { line("p", "latin", selectedContent.latin); }
    if (scene.settings.showTranslation !== false && contentOptions.showTranslation !== false) { line("p", "translation", selectedContent.translation); }
    var timing = model.timeline(ensurePresentation(false), event).rows.find(function (row) { return row.scene.sceneKey === scene.sceneKey; });
    line("p", "form-help", selectedContent.instruction); line("p", "scene-progress", "Laman " + (state.selectedIndex + 1) + " / " + scenes.length + " · " + formatSeconds(timing ? timing.durationSeconds : model.effectiveDuration(scene, event, ensurePresentation(false).autoAdjustDuration)));
    host.appendChild(copy);
  }
  function scheduleNextPreview() {
    if (state.timer) { window.clearTimeout(state.timer); }
    if (!state.playing) { return; }
    var scenes = enabledScenes(), scene = scenes[state.selectedIndex]; if (!scene) { return; }
    var timing = model.timeline(ensurePresentation(false), currentEvent()).rows.find(function (row) { return row.scene.sceneKey === scene.sceneKey; }), duration = timing ? timing.durationSeconds : model.effectiveDuration(scene, currentEvent(), ensurePresentation(false).autoAdjustDuration);
    state.timer = window.setTimeout(function () { state.selectedIndex += 1; if (state.selectedIndex >= enabledScenes().length) { state.selectedIndex = 0; if (ensurePresentation(false).completionAction === "repeat_information") { state.informationRepeat = true; } else if (ensurePresentation(false).completionAction === "stop" || ensurePresentation(false).completionAction === "return_normal" || ensurePresentation(false).completionAction === "next_playlist") { state.playing = false; byId("funeralScenePlayPause").textContent = window.PrayerI18n.uiText("Putar laman"); renderPreview(); return; } } renderPreview(); scheduleNextPreview(); }, duration * 1000);
  }
  function setData(data) { state.data = data || null; }
  function load(event, data) { state.data = data || state.data; state.event = event || {}; state.presentation = event && event.presentation ? model.normalize(event.presentation, event) : model.buildDefault(event || {}); state.selectedIndex = 0; state.informationRepeat = false; fillControls(); }
  function reset(data) { state.data = data || state.data; state.event = currentEvent(); state.presentation = model.buildDefault(state.event); state.selectedIndex = 0; state.informationRepeat = false; fillControls(); }
  function collect() {
    syncControls();
    var output = JSON.parse(JSON.stringify(state.presentation));
    output.sequence.scenes.forEach(function (scene, index) { scene.sequenceOrder = index + 1; delete scene.id; delete scene.effectiveDurationSeconds; if (scene.reference && scene.reference.referenceKey) { scene.referenceKey = scene.reference.referenceKey; } });
    return output;
  }
  function massSample() {
    var now = "2026-08-21T17:30:00";
    setValue("funeralEventType", "disaster_fatalities"); setValue("funeralDeceasedName", ""); setValue("funeralDeceasedGender", "mixed"); setValue("funeralFatalityCount", "125");
    setValue("funeralEventName", "Gempa Bumi"); setValue("funeralEventLocation", "Wilayah X"); setValue("funeralEventAt", now); setValue("funeralReportedAt", "2026-08-21T17:40:00"); setValue("funeralReceivedAt", "2026-08-21T17:45:00");
    setValue("funeralAction", "ghaib"); setValue("funeralGhaibMode", "both"); setValue("funeralGhaibAt", "2026-08-22T09:00:00"); setValue("funeralGhaibLocation", "Masjid Utama Wilayah X");
    setValue("funeralStatus", "draft"); setValue("funeralSourceVerification", "unverified");
    state.event = currentEvent(); state.presentation = model.buildDefault(state.event); state.selectedIndex = 0; state.informationRepeat = false; fillControls();
    document.getElementById("funeralEventType").dispatchEvent(new Event("change", { bubbles: true }));
  }
  function bind() {
    if (!byId("funeralSceneTimeline")) { return; }
    document.querySelectorAll("[data-funeral-preset]").forEach(function (button) { button.addEventListener("click", function () { model.applyPreset(ensurePresentation(false), button.dataset.funeralPreset); ensurePresentation(false).presetMode = button.dataset.funeralPreset; renderTimeline(); renderPreview(); }); });
    ["funeralPresentationEnabled", "funeralInterruptionPolicy", "funeralCompletionAction", "funeralPersistentPrayerEnabled", "funeralAutoAdjustDuration", "funeralMaximumDuration", "funeralOverflowPolicy", "funeralShowLawScenes", "funeralShowEvidenceScenes", "funeralShowArabic", "funeralShowLatin", "funeralShowTranslation", "funeralSpecificTimeStart", "funeralSpecificTimeEnd", "funeralCustomRule"].forEach(function (id) { var node = byId(id); if (node) { node.addEventListener("change", function () { syncControls(); renderTimeline(); renderPreview(); }); } });
    document.querySelectorAll('input[name="funeralAllowedContext"],input[name="funeralProtectedPhase"],input[name="funeralProtectedOverride"],input[name="funeralPersistentField"]').forEach(function (node) { node.addEventListener("change", syncControls); });
    byId("funeralOptimizeButton").addEventListener("click", function () { syncControls(); state.presentation = model.optimize(state.presentation, currentEvent()); fillControls(); });
    byId("funeralScenePrevious").addEventListener("click", function () { state.selectedIndex = Math.max(0, state.selectedIndex - 1); renderPreview(); scheduleNextPreview(); });
    byId("funeralSceneNext").addEventListener("click", function () { state.selectedIndex = Math.min(enabledScenes().length - 1, state.selectedIndex + 1); renderPreview(); scheduleNextPreview(); });
    byId("funeralSceneRestart").addEventListener("click", function () { state.selectedIndex = 0; state.informationRepeat = false; renderPreview(); scheduleNextPreview(); });
    byId("funeralScenePlayPause").addEventListener("click", function () { state.playing = !state.playing; this.textContent = state.playing ? "Jeda laman" : "Putar laman"; scheduleNextPreview(); });
    byId("funeralMassSampleButton").addEventListener("click", massSample);
    byId("funeralSampleButton").addEventListener("click", function () { window.setTimeout(function () { state.event = currentEvent(); state.presentation = model.buildDefault(state.event); state.selectedIndex = 0; fillControls(); }, 0); });
    ["funeralEventType", "funeralDeceasedGender", "funeralAction", "funeralMethod"].forEach(function (id) { var node = byId(id); if (node) { node.addEventListener("change", function () { renderPreview(); }); } });
    byId("funeralEventForm").addEventListener("input", function (event) { if (!event.target.closest(".funeral-sequence-editor")) { renderPreview(); } });
    if(!window.BereavementFuneralEditor){reset(null);}
  }

  window.FuneralPresentationEditor = { setData: setData, load: load, reset: reset, collect: collect, renderPreview: renderPreview, snapshot: function () { return collect(); } };
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", bind); } else { bind(); }
})(window, document);
