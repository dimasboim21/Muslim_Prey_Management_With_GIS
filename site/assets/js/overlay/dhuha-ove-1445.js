(function (window) {
  "use strict";

  var KEYS = ["dhuhaAwwal", "dhuhaWoosthaa", "dhuhaAwwabin"];

  function resolveTemplate(overlay, language, context) {
    var template = (overlay.contents || []).find(function (item) {
      return item.isEnabled && item.languageCode === language && item.contentKey === "main";
    }) || {};
    function text(field, fallback) {
      return String(template[field] || fallback || "").replace(/\{([A-Za-z0-9_]+)\}/g, function (_, key) {
        return context[key] === undefined || context[key] === null ? "" : String(context[key]);
      }).trim();
    }
    return {
      eyebrow: text("eyebrow", context.eyebrow),
      title: text("title", context.prayerLabel),
      subtitle: text("subtitle", context.countdown),
      bodyText: text("bodyText", context.stageLabel + " · " + context.phaseStart + " - " + context.phaseEnd),
      additionalText: text("additionalText", context.sourceName),
      textAlign: template.textAlign || "center",
      fontFamily: template.fontFamily,
      titleSizeClamp: template.titleSizeClamp,
      bodySizeClamp: template.bodySizeClamp
    };
  }

  function transition(configuredTiming, source, index) {
    if (index < KEYS.length - 1) {
      var nextTiming = source.dhuhaTimings[KEYS[index + 1]];
      if (nextTiming && nextTiming.start) {
        return { time: nextTiming.start, targetKey: KEYS[index + 1] };
      }
    } else if (source.times && source.times.dhuhur) {
      return { time: source.times.dhuhur, targetKey: "dhuhur" };
    }
    return { time: configuredTiming.end, targetKey: "configured_end" };
  }

  function candidate(snapshot, config, now, language) {
    var overlay = (config.definitions || []).find(function (item) {
      return item.overlayKey === "dhuha-phases" && item.isEnabled;
    });
    var source = snapshot && snapshot.activeSource;
    if (!overlay || !source || !source.dhuhaTimings ||
        (window.OverlayTriggerEngine && !window.OverlayTriggerEngine.scopeMatches(overlay, snapshot))) {
      return null;
    }
    var settings = (config.prayerSettings || []).reduce(function (map, row) {
      map[row.prayerKey + ":" + row.stateKey] = row;
      return map;
    }, {});
    var nowMs = now.getTime();
    for (var index = 0; index < KEYS.length; index += 1) {
      var key = KEYS[index];
      var timing = source.dhuhaTimings[key];
      var row = settings[key + ":phase"];
      if (!timing || !row || !row.isEnabled) {
        continue;
      }
      var nextTransition = transition(timing, source, index);
      var start = window.OverlayTimeService.localTimeDate(now, timing.start, snapshot, 0);
      var end = window.OverlayTimeService.localTimeDate(now, nextTransition.time, snapshot, 0);
      if (!start || !end || end <= start || nowMs < start.getTime() || nowMs >= end.getTime()) {
        continue;
      }
      var interval = Math.max(30, Number(row.reminderIntervalSeconds || 1800));
      var display = Math.min(interval, Math.max(5, Number(row.displayDurationSeconds || 30)));
      var elapsed = Math.floor((nowMs - start.getTime()) / 1000);
      var windowOffset = elapsed % interval;
      if (windowOffset >= display) {
        return null;
      }
      var label = language === "en" ? row.prayerLabelEn : row.prayerLabelId;
      var stageLabel = language === "en" ? row.stateLabelEn : row.stateLabelId;
      var visibleEnd = Math.min(end.getTime(), nowMs + (display - windowOffset) * 1000);
      var context = {
        eyebrow: language === "en" ? "Dhuha Time" : "Waktu Dhuha",
        prayerLabel: label,
        countdown: window.PrayerTimeUtils.formatSeconds((end.getTime() - nowMs) / 1000),
        stageLabel: stageLabel,
        phaseStart: timing.start,
        phaseEnd: nextTransition.time,
        sourceName: source.name || ""
      };
      return {
        candidateKey: "dhuha:" + key + ":" + Math.floor(elapsed / interval),
        overlayKey: overlay.overlayKey,
        overlayType: overlay.overlayType,
        priority: overlay.priority,
        interruptionPolicy: overlay.interruptionPolicy,
        animation: overlay.animation,
        settings: overlay.settings || {},
        startsAt: start.getTime() + Math.floor(elapsed / interval) * interval * 1000,
        endsAt: visibleEnd,
        targetAt: end.getTime(),
        language: language,
        backgroundPath: row.backgroundPath || overlay.backgroundPath,
        content: resolveTemplate(overlay, language, context),
        layout: (overlay.layouts || [])[0] || {},
        metadata: {
          controller: "DhuhaOverlayController",
          prayerKey: key,
          phaseStart: timing.start,
          phaseEnd: nextTransition.time,
          configuredPhaseEnd: timing.end,
          transitionTargetKey: nextTransition.targetKey,
          phaseEndsAt: end.toISOString(),
          sourceName: source.name || ""
        }
      };
    }
    return null;
  }

  window.DhuhaOverlayController = { candidate: candidate };
})(window);
