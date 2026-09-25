(function (window) {
  "use strict";

  var PRAYER_KEY = "qiyamulLail";
  var STATE_KEYS = ["first_reminder", "last_third_warning", "last_third_recurring", "fajr_preparation"];

  function number(value, fallback) {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }
    var result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function formatClock(date, snapshot) {
    try {
      return new Intl.DateTimeFormat("id-ID", {
        timeZone: window.OverlayTimeService.timezone(snapshot),
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).format(date);
    } catch (error) {
      return date.toISOString().slice(11, 16);
    }
  }

  function replace(value, context) {
    return String(value || "").replace(/\{([A-Za-z0-9_]+)\}/g, function (_, key) {
      return context[key] === undefined || context[key] === null ? "" : String(context[key]);
    }).trim();
  }

  function contentFor(overlay, language, context) {
    var template = (overlay.contents || []).find(function (item) {
      return item.isEnabled && item.languageCode === language && item.contentKey === "main";
    }) || {};
    return {
      eyebrow: replace(template.eyebrow || context.stageLabel, context),
      title: replace(template.title || context.prayerLabel, context),
      subtitle: replace(template.subtitle || context.countdown, context),
      bodyText: replace(template.bodyText || context.stageMessage, context),
      additionalText: replace(template.additionalText || context.sourceName, context),
      textAlign: template.textAlign || "center",
      fontFamily: template.fontFamily,
      titleSizeClamp: template.titleSizeClamp,
      bodySizeClamp: template.bodySizeClamp
    };
  }

  function stageMessage(stateKey, language, context) {
    var messages = language === "en" ? {
      first_reminder: "Early reminder for Qiyamul Lail. Prepare your rest and intention for night worship.",
      last_third_warning: "One hour remains before the last third of the night begins at " + context.lastThirdTime + ".",
      last_third_recurring: "Qiyamul time remains until the Fajr preparation cutoff at " + context.qiyamulCutoffTime + ".",
      fajr_preparation: "Qiyamul Lail reminders have ended. Prepare for the obligatory Fajr prayer at " + context.subuhTime + "."
    } : {
      first_reminder: "Pengingat awal Qiyamul Lail. Persiapkan istirahat dan niat untuk ibadah malam.",
      last_third_warning: "Satu jam menuju sepertiga malam terakhir yang dimulai pukul " + context.lastThirdTime + ".",
      last_third_recurring: "Sisa waktu Qiyamul Lail dihitung sampai batas persiapan Subuh pukul " + context.qiyamulCutoffTime + ".",
      fajr_preparation: "Reminder Qiyamul Lail dihentikan. Bersiap untuk sholat Subuh fardhu pukul " + context.subuhTime + "."
    };
    return messages[stateKey] || "";
  }

  function nightWindow(snapshot, now, source, dayOffset) {
    var maghribMinutes = window.PrayerTimeUtils.parseTimeToMinutes(source.times.maghrib);
    var subuhMinutes = window.PrayerTimeUtils.parseTimeToMinutes(source.times.subuh);
    if (maghribMinutes === null || subuhMinutes === null) {
      return null;
    }
    var maghrib = window.OverlayTimeService.timeOnDay(now, maghribMinutes, snapshot, dayOffset);
    var subuh = window.OverlayTimeService.timeOnDay(now, subuhMinutes, snapshot, dayOffset + 1);
    if (!maghrib || !subuh || subuh <= maghrib) {
      return null;
    }
    var duration = subuh.getTime() - maghrib.getTime();
    return {
      maghrib: maghrib,
      subuh: subuh,
      midpoint: new Date(maghrib.getTime() + duration / 2),
      lastThirdStart: new Date(maghrib.getTime() + duration * 2 / 3)
    };
  }

  function settingMap(config) {
    return (config.prayerSettings || []).reduce(function (map, row) {
      map[row.prayerKey + ":" + row.stateKey] = row;
      return map;
    }, {});
  }

  function eventRange(stateKey, row, finalRow, night, nowMs) {
    var rowSettings = row.settings || {};
    var displayMs = Math.max(5, number(row.displayDurationSeconds, 60)) * 1000;
    var cutoffMinutes = 15;
    if (finalRow) {
      cutoffMinutes = Math.max(1, number((finalRow.settings || {}).stopBeforeSubuhMinutes, 15));
    }
    var cutoff = night.subuh.getTime() - cutoffMinutes * 60000;
    var start;
    if (stateKey === "first_reminder") {
      start = rowSettings.primaryAnchor === "first_third_start"
        ? night.maghrib.getTime()
        : night.midpoint.getTime() - Math.max(0, number(rowSettings.leadMinutes, 60)) * 60000;
    } else if (stateKey === "last_third_warning") {
      start = night.lastThirdStart.getTime() - Math.max(0, number(rowSettings.leadMinutes, 60)) * 60000;
    } else if (stateKey === "last_third_recurring") {
      var first = night.lastThirdStart.getTime();
      var intervalMs = Math.max(30, number(row.reminderIntervalSeconds, 900)) * 1000;
      if (nowMs < first || nowMs >= cutoff) {
        return null;
      }
      start = first + Math.floor((nowMs - first) / intervalMs) * intervalMs;
      if (start >= cutoff) {
        return null;
      }
      return { start: start, end: Math.min(start + displayMs, cutoff), target: cutoff, cutoff: cutoff };
    } else if (stateKey === "fajr_preparation") {
      start = cutoff;
    } else {
      return null;
    }
    var target = start + displayMs;
    if (stateKey === "first_reminder") {
      target = rowSettings.primaryAnchor === "first_third_start" ? night.lastThirdStart.getTime() : night.midpoint.getTime();
    } else if (stateKey === "last_third_warning") {
      target = night.lastThirdStart.getTime();
    } else if (stateKey === "fajr_preparation") {
      target = night.subuh.getTime();
    }
    return { start: start, end: start + displayMs, target: target, cutoff: cutoff };
  }

  function candidate(snapshot, config, now, language) {
    var overlay = (config.definitions || []).find(function (item) {
      return item.overlayKey === "qiyamul-lail" && item.isEnabled;
    });
    var source = snapshot && snapshot.activeSource;
    if (!overlay || !source || !source.times || !source.times.maghrib || !source.times.subuh ||
        (window.OverlayTriggerEngine && !window.OverlayTriggerEngine.scopeMatches(overlay, snapshot))) {
      return null;
    }
    var settings = settingMap(config);
    var finalRow = settings[PRAYER_KEY + ":fajr_preparation"];
    var nowMs = now.getTime();
    var matches = [];
    [-1, 0].forEach(function (dayOffset) {
      var night = nightWindow(snapshot, now, source, dayOffset);
      if (!night || nowMs < night.maghrib.getTime() || nowMs >= night.subuh.getTime()) {
        return;
      }
      STATE_KEYS.forEach(function (stateKey) {
        var row = settings[PRAYER_KEY + ":" + stateKey];
        if (!row || !row.isEnabled) {
          return;
        }
        var range = eventRange(stateKey, row, finalRow, night, nowMs);
        if (!range || nowMs < range.start || nowMs >= range.end) {
          return;
        }
        var clockContext = {
          maghribTime: formatClock(night.maghrib, snapshot),
          midnightTime: formatClock(night.midpoint, snapshot),
          lastThirdTime: formatClock(night.lastThirdStart, snapshot),
          subuhTime: formatClock(night.subuh, snapshot),
          qiyamulCutoffTime: formatClock(new Date(range.cutoff), snapshot)
        };
        var context = Object.assign(clockContext, {
          stageLabel: language === "en" ? row.stateLabelEn : row.stateLabelId,
          prayerLabel: language === "en" ? row.prayerLabelEn : row.prayerLabelId,
          countdown: window.PrayerTimeUtils.formatSeconds((range.target - nowMs) / 1000),
          sourceName: source.name || ""
        });
        context.stageMessage = stageMessage(stateKey, language, context);
        matches.push({
          candidateKey: "qiyamul:" + stateKey + ":" + range.start,
          overlayKey: overlay.overlayKey,
          overlayType: overlay.overlayType,
          priority: overlay.priority,
          interruptionPolicy: overlay.interruptionPolicy,
          animation: overlay.animation,
          settings: overlay.settings || {},
          startsAt: range.start,
          endsAt: range.end,
          targetAt: range.target,
          language: language,
          backgroundPath: row.backgroundPath || overlay.backgroundPath,
          content: contentFor(overlay, language, context),
          layout: (overlay.layouts || [])[0] || {},
          metadata: {
            controller: "QiyamulOverlayController",
            prayerKey: PRAYER_KEY,
            stateKey: stateKey,
            maghribAt: night.maghrib.toISOString(),
            nightMidpointAt: night.midpoint.toISOString(),
            lastThirdStartAt: night.lastThirdStart.toISOString(),
            qiyamulCutoffAt: new Date(range.cutoff).toISOString(),
            subuhAt: night.subuh.toISOString(),
            sourceName: source.name || ""
          }
        });
      });
    });
    matches.sort(function (a, b) { return b.startsAt - a.startsAt; });
    return matches[0] || null;
  }

  window.QiyamulOverlayController = { candidate: candidate };
})(window);
