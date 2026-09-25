(function (window, document) {
  "use strict";

  var LAYERS = ["background", "persistent", "main", "alert"];
  var config = null;
  var source = "";
  var timer = null;
  var preview = null;
  var previewUntil = 0;
  var suppressed = {};
  var lastRendered = {};
  var auditThrottle = {};
  var customizerChannel = null;
  var lastDecision = { reason: "not-evaluated", layers: {}, diagnostics: [] };
  var states = LAYERS.reduce(function (result, layer) {
    result[layer] = { active: null, paused: [], queued: [], stacked: [] };
    return result;
  }, {});

  function actualNow() {
    return window.MpmActualTime && typeof window.MpmActualTime.now === "function" ? window.MpmActualTime.now() : new Date();
  }

  function runtimeSnapshot(date) {
    var snapshot;
    if (date && window.PrayerDashboardRuntime && typeof window.PrayerDashboardRuntime.getSnapshotAt === "function") {
      snapshot = window.PrayerDashboardRuntime.getSnapshotAt(date);
    } else {
      snapshot = window.PrayerDashboardRuntime && window.PrayerDashboardRuntime.getSnapshot ? window.PrayerDashboardRuntime.getSnapshot() : null;
    }
    return snapshot && window.OverlayDataSources && typeof window.OverlayDataSources.enrich === "function" ? window.OverlayDataSources.enrich(snapshot) : snapshot;
  }

  function stillValid(item, nowMs) { return item && nowMs < Number(item.endsAt || 0); }

  function uniquePush(list, item) {
    if (!item || list.some(function (row) { return row.candidateKey === item.candidateKey; })) { return; }
    list.push(item);
  }

  function audit(eventType, candidate, reasonCode, context) {
    if (!candidate || candidate.metadata && candidate.metadata.preview) { return; }
    var key = [eventType, candidate.candidateKey, reasonCode || ""].join(":");
    var now = Date.now();
    if (auditThrottle[key] && now - auditThrottle[key] < 2000) { return; }
    auditThrottle[key] = now;
    var body = {
      eventKey: "browser-" + now + "-" + Math.random().toString(16).slice(2),
      overlayKey: candidate.overlayKey,
      candidateKey: candidate.candidateKey,
      eventType: eventType,
      reasonCode: reasonCode || null,
      priorityValue: Number(candidate.priority || 0),
      activeFromUtc: candidate.startsAt ? new Date(candidate.startsAt).toISOString() : null,
      activeUntilUtc: candidate.endsAt ? new Date(candidate.endsAt).toISOString() : null,
      context: Object.assign({
        layerKey: candidate.layerKey || "main",
        mediaId: candidate.backgroundMedia && candidate.backgroundMedia.id || null,
        triggerKey: candidate.metadata && candidate.metadata.triggerKey || null,
        triggerType: candidate.metadata && candidate.metadata.triggerType || null,
        sourceName: candidate.metadata && candidate.metadata.sourceName || null
      }, context || {})
    };
    window.fetch("api/overlay-runtime-events.php", {
      method: "POST",
      cache: "no-store",
      keepalive: true,
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).catch(function () {});
  }

  function activePhase() {
    var main = states.main.active;
    return main && main.metadata && (main.metadata.stateKey || main.metadata.phaseKey) || "";
  }

  function protectedFor(candidate) {
    var protectedPhases = candidate && candidate.settings && candidate.settings.protectedPhases || [];
    var phase = activePhase();
    return candidate && candidate.layerKey !== "alert" && phase && protectedPhases.indexOf(phase) >= 0;
  }

  function resume(state, nowMs) {
    while (state.paused.length) {
      var paused = state.paused.pop();
      if (paused.pausedRemainingMs > 0) {
        paused.startsAt = nowMs;
        paused.endsAt = nowMs + paused.pausedRemainingMs;
        paused.targetAt = paused.endsAt;
        audit("resumed", paused, "paused-overlay-resumed");
        return paused;
      }
    }
    while (state.queued.length) {
      var queued = state.queued.shift();
      if (stillValid(queued, nowMs)) {
        audit("resumed", queued, "queued-overlay-started");
        return queued;
      }
    }
    return null;
  }

  function interrupt(layer, next, nowMs) {
    var state = states[layer];
    var active = state.active;
    if (!active || !stillValid(active, nowMs)) {
      state.active = next;
      audit("activated", next, "selected-by-priority");
      return;
    }
    if (active.candidateKey === next.candidateKey) {
      state.active = next;
      return;
    }
    if (protectedFor(next)) {
      suppressed[next.candidateKey] = next.endsAt;
      audit("suppressed", next, "protected-phase", { activeCandidateKey: active.candidateKey, phase: activePhase() });
      return;
    }
    if (active.isInterruptible === false) {
      suppressed[next.candidateKey] = next.endsAt;
      audit("suppressed", next, "active-non-interruptible", { activeCandidateKey: active.candidateKey });
      return;
    }
    if (Number(next.priority || 0) <= Number(active.priority || 0)) { return; }
    var conflict = next.conflictMode || "replace";
    if (conflict === "suppress") {
      suppressed[next.candidateKey] = next.endsAt;
      audit("suppressed", next, "candidate-suppress-policy", { activeCandidateKey: active.candidateKey });
      return;
    }
    if (conflict === "queue" || conflict === "rotate") {
      uniquePush(state.queued, next);
      suppressed[next.candidateKey] = Math.min(next.endsAt, nowMs + 1000);
      audit("queued", next, conflict, { activeCandidateKey: active.candidateKey });
      return;
    }
    var policy = active.interruptionPolicy || "pause";
    if (conflict === "stack" || policy === "stack") {
      uniquePush(state.stacked, active);
      audit("interrupted", active, "stacked-behind", { replacingCandidateKey: next.candidateKey });
    } else if (policy === "pause") {
      active.pausedRemainingMs = Math.max(0, active.endsAt - nowMs);
      uniquePush(state.paused, active);
      audit("interrupted", active, "paused", { replacingCandidateKey: next.candidateKey });
    } else if (policy === "queue") {
      uniquePush(state.queued, active);
      audit("queued", active, "active-moved-to-queue", { replacingCandidateKey: next.candidateKey });
    } else {
      suppressed[active.candidateKey] = active.endsAt;
      audit("interrupted", active, "replaced", { replacingCandidateKey: next.candidateKey });
    }
    state.active = next;
    audit("activated", next, conflict === "stack" ? "stack-front" : "replaced-lower-priority", { replacedCandidateKey: active.candidateKey });
  }

  function rotateCandidates(candidates, nowMs) {
    var rotating = candidates.filter(function (candidate) { return candidate.conflictMode === "rotate"; });
    if (rotating.length < 2) { return candidates; }
    var seconds = Math.max(5, Number(rotating[0].settings && rotating[0].settings.rotationSeconds || 15));
    var selected = rotating[Math.floor(nowMs / (seconds * 1000)) % rotating.length];
    return [selected].concat(candidates.filter(function (candidate) { return candidate.conflictMode !== "rotate"; }));
  }

  function resolveLayer(layer, candidates, nowMs) {
    var state = states[layer];
    var available = rotateCandidates(candidates.filter(function (candidate) { return !suppressed[candidate.candidateKey] && stillValid(candidate, nowMs); }), nowMs);
    if (layer === "persistent") {
      return available.slice(0, 12);
    }
    if (state.active && !stillValid(state.active, nowMs)) {
      audit("completed", state.active, "duration-ended");
      state.active = resume(state, nowMs);
    }
    if (!state.active && !available.length) { state.active = resume(state, nowMs); }
    if (available[0]) { interrupt(layer, available[0], nowMs); }
    state.stacked = state.stacked.filter(function (candidate) { return stillValid(candidate, nowMs); });
    available.slice(1).filter(function (candidate) { return candidate.conflictMode === "stack"; }).forEach(function (candidate) { uniquePush(state.stacked, candidate); });
    var result = state.active && stillValid(state.active, nowMs) ? [state.active] : [];
    if (layer !== "background") {
      state.stacked.forEach(function (candidate) { if (candidate.candidateKey !== (state.active && state.active.candidateKey)) { result.push(candidate); } });
    }
    return result.slice(0, layer === "alert" ? 3 : 5);
  }

  function compose(candidates, nowMs) {
    var grouped = { background: [], persistent: [], main: [], alert: [] };
    candidates.forEach(function (candidate) {
      var layer = LAYERS.indexOf(candidate.layerKey) >= 0 ? candidate.layerKey : "main";
      grouped[layer].push(candidate);
    });
    LAYERS.forEach(function (layer) { grouped[layer].sort(function (a, b) { return Number(b.priority || 0) - Number(a.priority || 0) || Number(a.layerOrder || 0) - Number(b.layerOrder || 0); }); });
    return {
      background: resolveLayer("background", grouped.background, nowMs),
      persistent: resolveLayer("persistent", grouped.persistent, nowMs),
      main: resolveLayer("main", grouped.main, nowMs),
      alert: resolveLayer("alert", grouped.alert, nowMs)
    };
  }

  function resolveSequence(candidate, nowMs) {
    var items = [];
    (candidate.sequenceItems || []).filter(function (item) { return item.isEnabled && Number(item.durationSeconds) > 0; }).forEach(function (item) {
      var repeats = Math.max(1, Math.min(20, Number(item.settings && item.settings.repeatCount || 1)));
      for (var repeatIndex = 0; repeatIndex < repeats; repeatIndex += 1) { items.push(item); }
    });
    if (!items.length) { return candidate; }
    var settings = candidate.settings || {};
    var total = items.reduce(function (sum, item) { return sum + Number(item.durationSeconds) * 1000; }, 0);
    var metadataElapsed = Number(candidate.metadata && candidate.metadata.sequenceElapsedMs);
    var elapsed = Number.isFinite(metadataElapsed) ? Math.max(0, metadataElapsed) : Math.max(0, nowMs - Number(candidate.startsAt || nowMs));
    var mode = settings.playlistMode || "sequential";
    var selected, selectedIndex = 0, selectedElapsedMs = 0;
    if (mode === "random") {
      var randomIndex = Math.floor(elapsed / Math.max(1000, Number(settings.rotationSeconds || 15) * 1000)) % items.length;
      var seed = String(candidate.candidateKey || "").split("").reduce(function (sum, char) { return sum + char.charCodeAt(0); }, 0);
      selectedIndex = (randomIndex + seed) % items.length;
      selected = items[selectedIndex];
    } else {
      var offset = settings.playlistLoop === false ? Math.min(elapsed, Math.max(0, total - 1)) : elapsed % total;
      selected = items[0];
      for (var index = 0; index < items.length; index += 1) {
        var duration = Number(items[index].durationSeconds) * 1000;
        if (offset < duration) { selected = items[index]; selectedIndex = index; selectedElapsedMs = offset; break; }
        offset -= duration;
      }
    }
    var itemSettings = selected.settings || {};
    var localized = itemSettings.content && itemSettings.content[candidate.language] || {};
    return Object.assign({}, candidate, {
      candidateKey: candidate.candidateKey + ":slide:" + selected.itemKey,
      animation: selected.transitionName || candidate.animation,
      backgroundPath: itemSettings.backgroundPath || candidate.backgroundPath,
      backgroundMedia: itemSettings.backgroundMedia || candidate.backgroundMedia,
      content: Object.assign({}, candidate.content || {}, localized),
      layout: Object.assign({}, candidate.layout || {}, itemSettings.layout || {}),
      widgets: Array.isArray(itemSettings.widgets) ? itemSettings.widgets : candidate.widgets,
      metadata: Object.assign({}, candidate.metadata || {}, {
        sequenceItemKey: selected.itemKey,
        sequenceItemPriority: Number(itemSettings.priority || 100),
        sequenceRepeatCount: Number(itemSettings.repeatCount || 1),
        sequenceItemIndex: selectedIndex + 1,
        sequenceItemTotal: items.length,
        sequenceItemElapsedMs: selectedElapsedMs,
        sequenceItemRemainingMs: Math.max(0, Number(selected.durationSeconds) * 1000 - selectedElapsedMs),
        sequenceScene: itemSettings.scene || null
      })
    });
  }

  function sequenceLayers(layers, nowMs) {
    var result = {};
    LAYERS.forEach(function (layer) { result[layer] = (layers[layer] || []).map(function (candidate) { return resolveSequence(candidate, nowMs); }); });
    return result;
  }

  function recordRendered(layers) {
    var current = {};
    LAYERS.forEach(function (layer) {
      (layers[layer] || []).forEach(function (candidate) {
        current[candidate.candidateKey] = candidate;
        if (!lastRendered[candidate.candidateKey]) { audit("rendered", candidate, "visible-on-public-display"); }
      });
    });
    Object.keys(lastRendered).forEach(function (key) { if (!current[key]) { audit("hidden", lastRendered[key], "no-longer-visible"); } });
    lastRendered = current;
  }

  function tick() {
    var now = actualNow();
    var nowMs = now.getTime();
    var snapshot = runtimeSnapshot();
    if (window.MpmDemoOptions && window.MpmDemoOptions.disableScheduledOverlays &&
        window.MpmViewer && window.MpmViewer.isStatic && window.MpmViewer.isStatic()) {
      window.OverlayRenderer.hide();
      lastRendered = {};
      return;
    }
    Object.keys(suppressed).forEach(function (key) { if (suppressed[key] <= nowMs) { delete suppressed[key]; } });
    if (preview && nowMs < previewUntil) {
      window.OverlayRenderer.renderLayers(preview, snapshot || {}, now);
      return;
    }
    preview = null;
    if (!config || !snapshot) { window.OverlayRenderer.hide(); return; }
    var evaluated = window.OverlayTriggerEngine.evaluate(snapshot, config, now);
    var layers = sequenceLayers(compose(evaluated.candidates, nowMs), nowMs);
    recordRendered(layers);
    window.OverlayRenderer.renderLayers(layers, snapshot, now);
    lastDecision = {
      reason: evaluated.candidates.length ? "composed-by-layer" : "no-active-candidate",
      at: now.toISOString(),
      source: source,
      layers: LAYERS.reduce(function (result, layer) { result[layer] = (layers[layer] || []).map(function (candidate) { return candidate.candidateKey; }); return result; }, {}),
      diagnostics: evaluated.diagnostics,
      queues: LAYERS.reduce(function (result, layer) { result[layer] = states[layer].queued.length; return result; }, {}),
      paused: LAYERS.reduce(function (result, layer) { result[layer] = states[layer].paused.length; return result; }, {})
    };
  }

  function start() {
    window.OverlayApi.load().then(function (result) {
      config = result.data;
      source = result.source;
      if (window.OverlayDataSources) {
        if (typeof window.OverlayDataSources.configure === "function") { window.OverlayDataSources.configure(config.dataSources || []); }
        if (typeof window.OverlayDataSources.load === "function") { window.OverlayDataSources.load(false).catch(function () {}); }
      }
      document.documentElement.dataset.overlayConfigSource = source;
      tick();
    }).catch(function () { document.documentElement.dataset.overlayConfigSource = "unavailable"; });
    if (timer) { window.clearInterval(timer); }
    timer = window.setInterval(tick, 500);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { tick(); } });
    ["pageshow", "focus", "online", "mpm:prayer-runtime-updated", "mpm:actual-time-status", "mpm:overlay-data-updated", "mpm:funeral-data-updated", "mpm:worship-education-updated"].forEach(function (name) { window.addEventListener(name, tick); });
    window.setInterval(function () { window.OverlayApi.load().then(function (result) { config = result.data; source = result.source; tick(); }).catch(function () {}); }, 30000);
  }

  function previewCandidate(candidate) {
    var now = Date.now();
    var layer = LAYERS.indexOf(candidate.layerKey) >= 0 ? candidate.layerKey : "main";
    var prepared = resolveSequence(Object.assign({}, candidate, {
      candidateKey: candidate.candidateKey || ("preview:" + now),
      startsAt: Number(candidate.startsAt || now)
    }), now);
    preview = { background: [], persistent: [], main: [], alert: [] };
    preview[layer] = [Object.assign({}, prepared, {
      candidateKey: "preview:" + now,
      startsAt: now,
      endsAt: now + Math.max(5000, Number(candidate.durationSeconds || 30) * 1000),
      targetAt: now + Math.max(5000, Number(candidate.durationSeconds || 30) * 1000),
      priority: 99999,
      metadata: Object.assign({}, candidate.metadata || {}, { preview: true })
    })];
    previewUntil = now + Math.max(5000, Number(candidate.durationSeconds || 30) * 1000);
    window.OverlayRenderer.renderLayers(preview, runtimeSnapshot() || {}, new Date(now));
  }

  function simulate(message, event) {
    var at = new Date(message.at || Date.now());
    if (!Number.isFinite(at.getTime()) || !config) { return; }
    var snapshot = runtimeSnapshot(at);
    if (snapshot && message.snapshotOverrides && typeof message.snapshotOverrides === "object") {
      snapshot = Object.assign({}, snapshot, message.snapshotOverrides);
      if (message.snapshotOverrides.hijriParts) { snapshot.hijriParts = Object.assign({}, snapshot.hijriParts || {}, message.snapshotOverrides.hijriParts); }
      if (Array.isArray(message.snapshotOverrides.calendarEvents)) { snapshot.calendarEvents = message.snapshotOverrides.calendarEvents.slice(0, 50); }
    }
    var simulationConfig = Object.assign({}, config, { definitions: (config.definitions || []).slice() });
    if (message.definition) {
      var definition = Object.assign({}, message.definition, { isEnabled: true });
      simulationConfig.definitions = simulationConfig.definitions.filter(function (item) { return item.overlayKey !== definition.overlayKey; }).concat([definition]);
    }
    var evaluated = window.OverlayTriggerEngine.evaluate(snapshot, simulationConfig, at);
    var layers = { background: [], persistent: [], main: [], alert: [] };
    evaluated.candidates.forEach(function (candidate) {
      var layer = LAYERS.indexOf(candidate.layerKey) >= 0 ? candidate.layerKey : "main";
      if (layer === "persistent" || candidate.conflictMode === "stack" || !layers[layer].length) { layers[layer].push(resolveSequence(Object.assign({}, candidate, { metadata: Object.assign({}, candidate.metadata || {}, { preview: true }) }), at.getTime())); }
    });
    preview = layers;
    previewUntil = Date.now() + 30000;
    window.OverlayRenderer.renderLayers(layers, snapshot || {}, at);
    var result = {
      type: "mpm:overlay-simulation-result",
      at: at.toISOString(),
      active: [].concat(layers.background, layers.persistent, layers.main, layers.alert).map(function (candidate) { return { overlayKey: candidate.overlayKey, candidateKey: candidate.candidateKey, layerKey: candidate.layerKey, priority: candidate.priority, startsAt: candidate.startsAt, endsAt: candidate.endsAt }; }),
      diagnostics: evaluated.diagnostics
    };
    if (event && event.source && typeof event.source.postMessage === "function") { event.source.postMessage(result, event.origin); }
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== window.location.origin || !event.data) { return; }
    if (event.data.type === "mpm:overlay-preview") { previewCandidate(event.data.candidate || {}); }
    if (event.data.type === "mpm:overlay-simulate") { simulate(event.data, event); }
  });

  function applyCustomizerMessage(message) {
    if (!message || message.type !== "mpm:overlay-session-apply" || !message.candidate) { return; }
    previewCandidate(Object.assign({}, message.candidate, { metadata: Object.assign({}, message.candidate.metadata || {}, { sessionApply: true }) }));
    if (customizerChannel) { customizerChannel.postMessage({ type: "mpm:overlay-session-applied", requestId: message.requestId || "", at: Date.now() }); }
  }
  if ("BroadcastChannel" in window) {
    try { customizerChannel = new BroadcastChannel("mpm:overlay-customizer-session:v1"); customizerChannel.addEventListener("message", function (event) { applyCustomizerMessage(event.data); }); } catch (error) { customizerChannel = null; }
  }
  window.addEventListener("storage", function (event) {
    if (event.key !== "mpm:overlay-customizer:session-apply" || !event.newValue) { return; }
    try { applyCustomizerMessage(JSON.parse(event.newValue)); } catch (error) {}
  });

  window.addEventListener("mpm:overlay-renderer-event", function (event) {
    var detail = event.detail || {};
    var candidate = Object.keys(lastRendered).map(function (key) { return lastRendered[key]; }).find(function (item) { return item.candidateKey === detail.candidateKey; });
    if (candidate) { audit(detail.eventType || "renderer_event", candidate, detail.reasonCode || null, detail); }
  });

  window.OverlayManager = {
    start: start,
    tick: tick,
    preview: previewCandidate,
    simulate: simulate,
    getConfig: function () { return config; },
    getDecision: function () { return JSON.parse(JSON.stringify(lastDecision)); }
  };
})(window, document);
