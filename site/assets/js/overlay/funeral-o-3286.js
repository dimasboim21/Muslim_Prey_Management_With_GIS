(function (window) {
  "use strict";
  var CACHE_KEY = "mpm:funeral-overlay:v2:last-known";
  var data = { events: [], guides: [] }, started = false, stream = null, pollTimer = null, playback = {};
  function readCache() { try { var parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null"); return parsed && parsed.events ? parsed : null; } catch (error) { return null; } }
  function writeCache(value) { try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch (error) {} }
  function notify() { window.dispatchEvent(new CustomEvent("mpm:funeral-data-updated", { detail: { generatedAtUtc: data.generatedAtUtc || null } })); }
  function load() { return window.fetch("api/bereavement-funeral.php", { cache: "no-store", headers: { Accept: "application/json" } }).then(function (response) { return response.json().then(function (payload) { if (!response.ok || !payload || payload.success !== true || !payload.data) { throw new Error(payload && payload.error || "Funeral data unavailable."); } data = payload.data; writeCache(data); notify(); return data; }); }).catch(function (error) { var cached = readCache(); if (cached) { data = cached; notify(); return data; } throw error; }); }
  function fallback() { if (pollTimer) { return; } pollTimer = window.setInterval(function () { if (!document.hidden) { load().catch(function () {}); } }, 30000); }
  async function connect() { if(window.MpmViewer){await MpmViewer.ready;if(MpmViewer.isViewer())return;} if (!window.EventSource) { fallback(); return; } try { stream = new EventSource("api/bereavement-events-stream.php"); stream.onopen = function () { if (pollTimer) { window.clearInterval(pollTimer); pollTimer = null; } }; ["bereavement.created", "bereavement.updated", "bereavement.published", "bereavement.unpublished", "bereavement.deleted", "funeral_schedule.updated", "overlay.updated", "media_sequence.updated"].forEach(function (name) { stream.addEventListener(name, function () { load().catch(function () {}); }); }); stream.onerror = fallback; } catch (error) { fallback(); } }
  function start() { if (started) { return; } started = true; var cached = readCache(); if (cached) { data = cached; } load().catch(function () {}); connect(); }
  function parse(value) { if (!value) { return NaN; } return Date.parse(String(value).replace(" ", "T")); }
  function publication(event) { var startAt = parse(event.publishFrom), endAt = parse(event.publishUntil); return { start: Number.isFinite(startAt) ? startAt : 0, end: Number.isFinite(endAt) ? endAt : 8640000000000000 }; }
  function prayerSettings(config) { return (config.prayerSettings || []).reduce(function (map, row) { map[row.prayerKey + ":" + row.stateKey] = row; return map; }, {}); }
  function activePrayer(snapshot, config, now, lang) { return window.PrayerOverlayController && window.PrayerOverlayController.candidate ? window.PrayerOverlayController.candidate(snapshot, config, now, lang) : null; }
  function activeFriday(snapshot, config, now, lang) { return window.FridayOverlayController && window.FridayOverlayController.candidate ? window.FridayOverlayController.candidate(snapshot, config, now, lang) : null; }
  function prayerWindow(prayerKey, snapshot, config, now, dayOffset) {
    var source = snapshot && snapshot.activeSource, map = prayerSettings(config), minute = source && source.times && window.PrayerTimeUtils.parseTimeToMinutes(source.times[prayerKey]);
    if (minute === null || minute === undefined) { return null; }
    var adzan = window.OverlayTimeService.timeOnDay(now, minute, snapshot, dayOffset || 0); if (!adzan) { return null; }
    var adzanRow = map[prayerKey + ":adzan"], iqamahRow = map[prayerKey + ":iqamah"], prayerRow = map[prayerKey + ":prayer"], preRow = map[prayerKey + ":pre_adzan"];
    if (!adzanRow || !iqamahRow || !prayerRow || !preRow) { return null; }
    var adzanStart = adzan.getTime(), adzanEnd = adzanStart + Number(adzanRow.durationSeconds || 0) * 1000, iqamahEnd = adzanEnd + Number(iqamahRow.durationSeconds || 0) * 1000, prayerEnd = iqamahEnd + Number(prayerRow.durationSeconds || 0) * 1000;
    return { prayerKey: prayerKey, adzanAt: adzanStart, preStart: adzanStart - Number(preRow.durationSeconds || 0) * 1000, adzanEnd: adzanEnd, iqamahEnd: iqamahEnd, prayerEnd: prayerEnd };
  }
  function definitionPriority(config, overlayKey, fallback) {
    var row = (config.definitions || []).find(function (item) { return item.overlayKey === overlayKey && item.isEnabled; });
    return row ? Number(row.priority || fallback) : fallback;
  }
  function sunnahContext(snapshot, config, now, lang) {
    var source = snapshot && snapshot.activeSource, nowMs = now.getTime(), times = source && source.times;
    if (!times) { return null; }

    var maghribMinute = window.PrayerTimeUtils.parseTimeToMinutes(times.maghrib), subuhMinute = window.PrayerTimeUtils.parseTimeToMinutes(times.subuh);
    if (maghribMinute !== null && subuhMinute !== null) {
      for (var nightOffset = -1; nightOffset <= 0; nightOffset += 1) {
        var maghrib = window.OverlayTimeService.timeOnDay(now, maghribMinute, snapshot, nightOffset);
        var subuh = window.OverlayTimeService.timeOnDay(now, subuhMinute, snapshot, nightOffset + 1);
        if (!maghrib || !subuh || subuh <= maghrib) { continue; }
        var lastThird = maghrib.getTime() + (subuh.getTime() - maghrib.getTime()) * 2 / 3;
        var cutoff = subuh.getTime() - 15 * 60000;
        if (nowMs >= lastThird && nowMs < cutoff) {
          var qiyamulCandidate = window.QiyamulOverlayController && window.QiyamulOverlayController.candidate ? window.QiyamulOverlayController.candidate(snapshot, config, now, lang) : null;
          return { prayerKey: "qiyamulLail", phaseKey: "qiyamul_lail", protectedKey: "", startsAt: lastThird, endsAt: cutoff, activeCandidate: qiyamulCandidate || { priority: definitionPriority(config, "qiyamul-lail", 540) } };
        }
      }
    }

    var dhuhaKeys = ["dhuhaAwwal", "dhuhaWoosthaa", "dhuhaAwwabin"], phaseKeys = ["dhuha_awwal", "dhuha_wustha", "dhuha_awwabin"], dhuha = source.dhuhaTimings || {};
    for (var index = 0; index < dhuhaKeys.length; index += 1) {
      var timing = dhuha[dhuhaKeys[index]], nextTiming = index < dhuhaKeys.length - 1 ? dhuha[dhuhaKeys[index + 1]] : null;
      var startValue = timing && timing.start, endValue = nextTiming && nextTiming.start || (index === dhuhaKeys.length - 1 ? times.dhuhur : timing && timing.end);
      var start = startValue ? window.OverlayTimeService.localTimeDate(now, startValue, snapshot, 0) : null;
      var end = endValue ? window.OverlayTimeService.localTimeDate(now, endValue, snapshot, 0) : null;
      if (start && end && end > start && nowMs >= start.getTime() && nowMs < end.getTime()) {
        var dhuhaCandidate = window.DhuhaOverlayController && window.DhuhaOverlayController.candidate ? window.DhuhaOverlayController.candidate(snapshot, config, now, lang) : null;
        return { prayerKey: dhuhaKeys[index], phaseKey: phaseKeys[index], protectedKey: "", startsAt: start.getTime(), endsAt: end.getTime(), activeCandidate: dhuhaCandidate || { priority: definitionPriority(config, "dhuha-phases", 520) } };
      }
    }

    var syuruqMinute = window.PrayerTimeUtils.parseTimeToMinutes(times.syuruq);
    if (syuruqMinute !== null) {
      var syuruq = window.OverlayTimeService.timeOnDay(now, syuruqMinute, snapshot, 0);
      var firstDhuhaValue = dhuha.dhuhaAwwal && dhuha.dhuhaAwwal.start;
      var firstDhuha = firstDhuhaValue ? window.OverlayTimeService.localTimeDate(now, firstDhuhaValue, snapshot, 0) : null;
      var syuruqEnd = firstDhuha && firstDhuha > syuruq ? firstDhuha.getTime() : syuruq && syuruq.getTime() + 20 * 60000;
      if (syuruq && nowMs >= syuruq.getTime() && nowMs < syuruqEnd) {
        return { prayerKey: "syuruq", phaseKey: "syuruq", protectedKey: "", startsAt: syuruq.getTime(), endsAt: syuruqEnd, activeCandidate: { priority: 510 } };
      }
    }
    return null;
  }
  function scheduleContext(snapshot, config, now, lang, schedule) {
    var prayer = activePrayer(snapshot, config, now, lang), friday = activeFriday(snapshot, config, now, lang), nowMs = now.getTime();
    if (friday) { var fridayState = friday.metadata && friday.metadata.stateKey || "information"; return { prayerKey: "jumat", phaseKey: fridayState === "prayer" ? "prayer" : "before_fardhu", protectedKey: fridayState === "prayer" ? "friday" : "", startsAt: Number(friday.startsAt), endsAt: Number(friday.endsAt), activeCandidate: friday }; }
    if (prayer) { return { prayerKey: prayer.metadata && prayer.metadata.prayerKey || "", phaseKey: prayer.metadata && prayer.metadata.stateKey || "", protectedKey: prayer.metadata && prayer.metadata.stateKey || "", startsAt: Number(prayer.startsAt), endsAt: Number(prayer.endsAt), activeCandidate: prayer }; }
    var sunnah = sunnahContext(snapshot, config, now, lang); if (sunnah) { return sunnah; }
    var rules = schedule && schedule.prayerRules || {}, windows = [];
    ["subuh", "dhuhur", "ashar", "maghrib", "isha"].forEach(function (prayerKey) { [-1, 0, 1].forEach(function (offset) { var row = prayerWindow(prayerKey, snapshot, config, now, offset); if (row) { windows.push(row); } }); });
    var after = windows.filter(function (row) { var rule = rules[row.prayerKey] || {}; return nowMs >= row.prayerEnd && nowMs < row.prayerEnd + Math.max(0, Number(rule.afterMinutes || 30)) * 60000; }).sort(function (a, b) { return b.prayerEnd - a.prayerEnd; })[0];
    if (after) { return { prayerKey: after.prayerKey, phaseKey: "after_prayer", protectedKey: "", startsAt: after.prayerEnd, endsAt: after.prayerEnd + Math.max(0, Number((rules[after.prayerKey] || {}).afterMinutes || 30)) * 60000, activeCandidate: null }; }
    var before = windows.filter(function (row) { var rule = rules[row.prayerKey] || {}; return nowMs < row.preStart && nowMs >= row.adzanAt - Math.max(0, Number(rule.beforeMinutes || 30)) * 60000; }).sort(function (a, b) { return a.adzanAt - b.adzanAt; })[0];
    if (before) { return { prayerKey: before.prayerKey, phaseKey: "before_fardhu", protectedKey: "", startsAt: before.adzanAt - Math.max(0, Number((rules[before.prayerKey] || {}).beforeMinutes || 30)) * 60000, endsAt: before.preStart, activeCandidate: null }; }
    var next = windows.filter(function (row) { return row.adzanAt > nowMs; }).sort(function (a, b) { return a.adzanAt - b.adzanAt; })[0];
    return { prayerKey: next ? next.prayerKey : "", phaseKey: "outside_fardhu", protectedKey: "", startsAt: 0, endsAt: next ? next.adzanAt : 8640000000000000, activeCandidate: null };
  }
  function timeMatches(windows, now) { if (!windows || !windows.length) { return false; } var current = now.getHours() * 60 + now.getMinutes(); return windows.some(function (windowRow) { var startParts = String(windowRow.start || "").split(":"), endParts = String(windowRow.end || "").split(":"), startMinute = Number(startParts[0]) * 60 + Number(startParts[1]), endMinute = Number(endParts[0]) * 60 + Number(endParts[1]); return endMinute >= startMinute ? current >= startMinute && current < endMinute : current >= startMinute || current < endMinute; }); }
  function customMatches(rule, now) { if (!rule || !rule.enabled || !rule.expression) { return false; } var clauses = String(rule.expression).split(";").map(function (row) { return row.trim(); }).filter(Boolean), ok = true; clauses.forEach(function (clause) { var parts = clause.split("="); if (parts.length < 2) { ok = false; return; } if (parts[0] === "weekday") { ok = ok && String(now.getDay()) === parts[1]; } else if (parts[0] === "time") { var range = parts[1].split("-"); ok = ok && range.length === 2 && timeMatches([{ start: range[0], end: range[1] }], now); } else { ok = false; } }); return ok; }
  function ruleAllows(context, schedule, now) { var contexts = schedule.allowedContexts || [], globalMatch = contexts.indexOf("anytime") >= 0 || contexts.indexOf(context.phaseKey) >= 0; if (context.phaseKey === "after_prayer" && contexts.indexOf("sequence_complete") >= 0) { globalMatch = true; } if (contexts.indexOf("specific_time") >= 0 && timeMatches(schedule.timeWindows, now)) { globalMatch = true; } if (contexts.indexOf("custom_rule") >= 0 && customMatches(schedule.customRule, now)) { globalMatch = true; } if (!globalMatch) { return false; } var rule = schedule.prayerRules && schedule.prayerRules[context.prayerKey]; return !(rule && (rule.enabled === false || rule.phases && rule.phases[context.phaseKey] === false)); }
  function insertionWindow(event, phase, nowMs, publishEnd) {
    if (!phase || event.insertDuringFardhu === false) { return null; }
    var supported = ["pre_adzan", "adzan", "iqamah", "prayer", "qiyamul_lail", "syuruq", "dhuha_awwal", "dhuha_wustha", "dhuha_awwabin"];
    var phases = Array.isArray(event.insertPhases) && event.insertPhases.length ? event.insertPhases : ["pre_adzan", "iqamah", "prayer", "qiyamul_lail", "syuruq", "dhuha_awwal", "dhuha_wustha", "dhuha_awwabin"], phaseKey = phase.phaseKey || phase.metadata && phase.metadata.stateKey || "";
    if (supported.indexOf(phaseKey) < 0 || phases.indexOf(phaseKey) < 0) { return null; }
    var phaseStart = Number(phase.startsAt), phaseEnd = Number(phase.endsAt), interval = Math.max(1, Number(event.insertIntervalMinutes || 5)) * 60000, duration = Math.max(10, Number(event.insertDurationSeconds || 75)) * 1000;
    if (!Number.isFinite(phaseStart) || !Number.isFinite(phaseEnd) || nowMs < phaseStart || nowMs >= phaseEnd) { return null; }
    var startAt = phaseStart + Math.floor((nowMs - phaseStart) / interval) * interval, endAt = Math.min(startAt + duration, phaseEnd, publishEnd);
    return nowMs >= startAt && nowMs < endAt ? { start: startAt, end: endAt, phaseKey: phaseKey, prayerKey: phase.prayerKey || phase.metadata && phase.metadata.prayerKey || "", durationSeconds: duration / 1000, intervalMinutes: interval / 60000 } : null;
  }
  function tracker(event, nowMs) { var version = String(event.version || 0) + ":" + String(event.presentation && event.presentation.version || 0), row = playback[event.eventKey]; if (!row || row.version !== version) { row = playback[event.eventKey] = { version: version, progressMs: 0, lastAt: nowMs, wasVisible: false, graceUntil: 0, completed: false, informationRepeat: false }; } return row; }
  function informationPresentation(presentation) { var value = JSON.parse(JSON.stringify(presentation)), chapters = ["information", "invitation"]; value.sequence.scenes = (value.sequence.scenes || []).filter(function (scene) { return scene.isEnabled !== false && chapters.indexOf(scene.chapterKey) >= 0; }); value.completionAction = "repeat_tutorial"; return value; }
  function progressInfo(presentation, event, progressMs) { var timeline = window.FuneralPresentationModel.timeline(presentation, event), totalMs = Math.max(1000, timeline.totalSeconds * 1000), mode = presentation.completionAction; if ((mode === "return_normal" || mode === "stop" || mode === "next_playlist") && progressMs >= totalMs) { return { completed: true, totalMs: totalMs, timeline: timeline, offset: totalMs }; } var offset = progressMs % totalMs, current = timeline.rows[0]; for (var index = 0; index < timeline.rows.length; index += 1) { if (offset < timeline.rows[index].endSeconds * 1000) { current = timeline.rows[index]; break; } } return { completed: false, totalMs: totalMs, timeline: timeline, offset: offset, current: current, remainingSceneMs: current ? Math.max(500, current.endSeconds * 1000 - offset) : 1000 }; }
  function scheduleDecision(event, presentation, context, now, range) {
    var nowMs = now.getTime(), schedule = presentation.schedule || {}, row = tracker(event, nowMs), allowed = presentation.isEnabled !== false && schedule.displayEnabled !== false && ruleAllows(context, schedule, now), protectedKey = context.protectedKey || "", protectedPhase = protectedKey && (schedule.protectedPhases || []).indexOf(protectedKey) >= 0, override = protectedKey && (schedule.protectedOverrides || []).indexOf(protectedKey) >= 0, activePresentation;
    if (presentation.completionAction !== "repeat_information") { row.informationRepeat = false; }
    var fullTimeline = window.FuneralPresentationModel.timeline(presentation, event), fullTotalMs = Math.max(1000, fullTimeline.totalSeconds * 1000);
    if (presentation.completionAction === "repeat_information" && !row.informationRepeat && row.progressMs >= fullTotalMs) { row.informationRepeat = true; row.progressMs = row.progressMs - fullTotalMs; }
    activePresentation = row.informationRepeat ? informationPresentation(presentation) : presentation;
    var insertionPhases = Array.isArray(event.insertPhases) && event.insertPhases.length ? event.insertPhases : ["pre_adzan", "iqamah", "prayer", "qiyamul_lail", "syuruq", "dhuha_awwal", "dhuha_wustha", "dhuha_awwabin"];
    var insertionContext = event.insertDuringFardhu !== false && insertionPhases.indexOf(context.phaseKey) >= 0;
    var insert = allowed && insertionContext ? insertionWindow(event, context, nowMs, range.end) : null;
    if (insert) {
      activePresentation = informationPresentation(presentation);
      var insertProgress = Math.max(0, nowMs - insert.start);
      row.lastAt = nowMs; row.wasVisible = true; row.completed = false; row.progressMs = insertProgress;
      return { allowed: true, info: progressInfo(activePresentation, event, insertProgress), tracker: row, insert: insert, presentation: activePresentation };
    }
    if (insertionContext) { allowed = false; }
    var info = progressInfo(activePresentation, event, row.progressMs);
    if (info.completed) { row.completed = true; row.wasVisible = false; row.lastAt = nowMs; return { allowed: false, info: info, tracker: row }; }
    if (allowed && protectedPhase && !override && presentation.interruptionPolicy !== "continue") { if (presentation.interruptionPolicy === "finish_scene_pause" && row.wasVisible && !row.graceUntil) { row.graceUntil = nowMs + info.remainingSceneMs; } allowed = Boolean(row.graceUntil && nowMs < row.graceUntil); }
    if (!protectedPhase || override || presentation.interruptionPolicy === "continue") { row.graceUntil = 0; }
    var delta = Math.max(0, Math.min(2000, nowMs - row.lastAt)); if (allowed) { row.progressMs += delta; }
    if (presentation.completionAction === "repeat_information" && !row.informationRepeat && row.progressMs >= fullTotalMs) { row.informationRepeat = true; row.progressMs = row.progressMs - fullTotalMs; activePresentation = informationPresentation(presentation); }
    row.lastAt = nowMs; row.wasVisible = allowed;
    return { allowed: allowed, info: progressInfo(activePresentation, event, row.progressMs), tracker: row, insert: insert, presentation: activePresentation };
  }
  function referenceLabel(reference) { return reference ? [reference.book, reference.hadithNumber ? "Hadis " + reference.hadithNumber : "", reference.narrator ? "Perawi: " + reference.narrator : "", reference.grade ? "Status: " + reference.grade : ""].filter(Boolean).join(" · ") : ""; }
  function sequenceItems(event, presentation, lang) {
    var timeline = window.FuneralPresentationModel.timeline(presentation, event), count = timeline.rows.length;
    return timeline.rows.map(function (row, index) {
      var scene = row.scene, selected = window.FuneralPresentationModel.selectedContent(scene, event, lang), settings = scene.settings || {}, options = presentation.contentOptions || {}, widget = null, deceasedPhoto = event.eventType === "individual_death" && event.deceasedPhotoEnabled && event.deceasedPhoto ? event.deceasedPhoto : null, sceneMedia = scene.sceneKey === "death-information" && deceasedPhoto ? deceasedPhoto.publicUrl : scene.mediaPath;
      if (sceneMedia || selected.arabic || selected.latin || selected.translation) { widget = { widgetKey: "presentation-scene-" + scene.sceneKey, widgetType: "presentation_scene", layerKey: "main", sortOrder: 1, isEnabled: true, config: { adapter: "funeral_prayer", mediaUrl: sceneMedia, mediaRole: scene.sceneKey === "death-information" && deceasedPhoto ? "deceased_photo" : "illustration", mediaAlt: scene.sceneKey === "death-information" && deceasedPhoto ? ((lang === "en" ? "Photo of " : "Foto ") + (event.deceasedName || (lang === "en" ? "the deceased" : "almarhum atau almarhumah"))) : "", sceneType: scene.sceneType, chapterKey: scene.chapterKey, arabic: settings.showArabic !== false && options.showArabic !== false ? selected.arabic : "", latin: settings.showLatin !== false && options.showLatin !== false ? selected.latin : "", translation: settings.showTranslation !== false && options.showTranslation !== false ? selected.translation : "", instruction: selected.instruction, sceneNumber: index + 1, totalScenes: count }, source: scene.reference && scene.reference.verificationStatus === "verified" && (scene.sceneType === "evidence" || settings.showEvidence || options.showEvidence) ? { name: referenceLabel(scene.reference), url: scene.reference.url, verificationStatus: scene.reference.verificationStatus } : null }; }
      return { itemKey: scene.sceneKey, isEnabled: true, durationSeconds: row.durationSeconds, transitionName: "fade", settings: { content: { id: { eyebrow: selected.eyebrow, title: selected.title || scene.title, subtitle: selected.subtitle, bodyText: selected.body, additionalText: selected.sourceNote || (scene.sceneType === "evidence" && scene.reference && scene.reference.verificationStatus === "verified" ? referenceLabel(scene.reference) : "") }, en: { eyebrow: selected.eyebrow, title: selected.title || scene.title, subtitle: selected.subtitle, bodyText: selected.body, additionalText: selected.sourceNote } }, widgets: widget ? [widget] : [], scene: { sceneKey: scene.sceneKey, chapterKey: scene.chapterKey, sceneType: scene.sceneType, index: index + 1, total: count } } };
    });
  }
  function mainCandidate(event, snapshot, config, now, lang) {
    var nowMs = now.getTime(), range = publication(event); if (nowMs < range.start || nowMs >= range.end || !window.FuneralPresentationModel) { return null; }
    var presentation = window.FuneralPresentationModel.normalize(event.presentation, event);
    if (!event.presentation) {
      presentation.schedule.protectedPhases = ["adzan", "friday"];
      (event.insertPhases || ["pre_adzan", "iqamah", "prayer"]).forEach(function (phase) {
        if (presentation.schedule.allowedContexts.indexOf(phase) < 0) { presentation.schedule.allowedContexts.push(phase); }
        Object.keys(presentation.schedule.prayerRules || {}).forEach(function (prayerKey) { presentation.schedule.prayerRules[prayerKey].phases[phase] = true; });
      });
    }
    var context = scheduleContext(snapshot, config, now, lang, presentation.schedule), decision = scheduleDecision(event, presentation, context, now, range);
    if (!decision.allowed || !decision.info.timeline.rows.length) { return null; }
    var insert = decision.insert, leaseEnd = insert ? insert.end : Math.min(range.end, nowMs + 2000), phasePriority = context.activeCandidate ? Number(context.activeCandidate.priority || 800) : 0, priority = context.activeCandidate ? Math.max(Number(event.priorityValue || 650), phasePriority + 1) : Number(event.priorityValue || 650), displayStart = insert ? insert.start : nowMs;
    return { candidateKey: "funeral:" + event.eventKey + (insert ? ":insert:" + insert.start : ""), overlayKey: "bereavement-prayer-notice", overlayType: event.funeralAction === "ghaib" ? "ghaib" : event.funeralAction === "janazah" ? "janazah" : "death", priority: priority, interruptionPolicy: "pause", conflictMode: "replace", isInterruptible: true, layerKey: "main", layerOrder: 100, animation: "fade", settings: { showContent: true, showClock: false, showDates: false, protectedPhases: [], playlistMode: "sequential", playlistLoop: presentation.completionAction === "repeat_tutorial" || presentation.completionAction === "repeat_information", oneViewport: true }, startsAt: displayStart, endsAt: leaseEnd, targetAt: insert ? insert.end : range.end, language: lang, backgroundPath: null, backgroundMedia: null, content: { eyebrow: lang === "en" ? "Bereavement Presentation" : "Presentasi Kabar Duka", title: "", subtitle: "", bodyText: "", additionalText: "", textAlign: "center", fontFamily: "Arial, Helvetica, sans-serif", titleSizeClamp: "clamp(1.8rem,6vw,5.2rem)", bodySizeClamp: "clamp(1rem,2.4vw,1.7rem)" }, layout: { xPercent: 50, yPercent: 50, widthPercent: 94, heightPercent: 88, anchorKey: "center", showCard: true, imageFit: "contain", imagePosition: "center center", imageOpacity: 1, tintColor: "#071d18", tintOpacity: .72, cardBackground: "#0f342c", cardOpacity: .9, settings: {} }, sequenceItems: sequenceItems(event, decision.presentation || presentation, lang), widgets: [], metadata: { triggerReason: insert ? "bereavement-prayer-insertion" : "bereavement-presentation", funeralPresentation: true, oneViewport: true, sequenceElapsedMs: decision.tracker.progressMs, informationRepeat: Boolean(decision.tracker.informationRepeat), eventKey: event.eventKey, eventVersion: event.version, presentationVersion: presentation.version || 0, sourceName: event.sourceName, funeralAction: event.funeralAction, deceasedGender: event.deceasedGender, scheduleContext: context, insertion: insert || null, eventPublishUntil: range.end, leaseUntil: leaseEnd } };
  }
  function persistentCandidate(main, event, snapshot, now, lang) { if (!main) { return null; } var presentation = window.FuneralPresentationModel.normalize(event.presentation, event); if (!presentation.persistentPrayerEnabled) { return null; } return { candidateKey: "funeral-persistent:" + event.eventKey, overlayKey: "bereavement-prayer-persistent", overlayType: "prayer_information", priority: main.priority + 10, interruptionPolicy: "stack", conflictMode: "stack", isInterruptible: true, layerKey: "persistent", layerOrder: 10, animation: "fade", settings: { showContent: false, showClock: false, showDates: false, protectedPhases: [] }, startsAt: main.startsAt, endsAt: main.endsAt, targetAt: main.targetAt, language: lang, backgroundPath: null, content: {}, layout: main.layout, sequenceItems: [], widgets: [{ widgetKey: "persistent-prayer", widgetType: "persistent_prayer", layerKey: "persistent", sortOrder: 1, isEnabled: true, config: { fields: presentation.persistentFields, compact: true } }], metadata: { triggerReason: "bereavement-persistent-prayer", funeralPresentation: true, eventKey: event.eventKey } }; }
  function candidates(snapshot, config, now, lang) { var result = []; (data.events || []).forEach(function (event) { var main = mainCandidate(event, snapshot, config, now, lang); if (main) { result.push(main); var persistent = persistentCandidate(main, event, snapshot, now, lang); if (persistent) { result.push(persistent); } } }); return result; }
  window.FuneralOverlayController = { start: start, load: load, candidates: candidates, candidateForEvent: mainCandidate, insertionWindow: insertionWindow, scheduleContext: scheduleContext, snapshot: function () { return data; }, playbackSnapshot: function () { return JSON.parse(JSON.stringify(playback)); } };
  start();
})(window);
