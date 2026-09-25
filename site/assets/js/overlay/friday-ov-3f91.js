(function (window) {
  "use strict";

  function definition(config) {
    return (config.definitions || []).find(function (item) {
      return item.overlayKey === "friday-prayer" && item.isEnabled;
    }) || null;
  }

  function settingsMap(config) {
    return (config.prayerSettings || []).reduce(function (map, row) {
      map[row.prayerKey + ":" + row.stateKey] = row;
      return map;
    }, {});
  }

  function isFriday(date, snapshot) {
    var parts = window.OverlayTimeService.dateParts(date, snapshot);
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay() === 5;
  }

  function suppressesDhuhr(snapshot, config, adzanAt) {
    var overlay = definition(config);
    var map = settingsMap(config);
    return Boolean(overlay && isFriday(adzanAt, snapshot) &&
      map["jumat:prayer"] && map["jumat:prayer"].isEnabled);
  }

  function label(row, language, field) {
    return row[field + (language === "en" ? "En" : "Id")] || row[field + "Id"] || "";
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

  function candidate(snapshot, config, now, language) {
    var overlay = definition(config);
    var source = snapshot && snapshot.activeSource;
    if (!overlay || !source || !source.times || !isFriday(now, snapshot) ||
        (window.OverlayTriggerEngine && !window.OverlayTriggerEngine.scopeMatches(overlay, snapshot))) {
      return null;
    }
    var subuhMinute = window.PrayerTimeUtils.parseTimeToMinutes(source.times.subuh);
    var dhuhurMinute = window.PrayerTimeUtils.parseTimeToMinutes(source.times.dhuhur);
    if (subuhMinute === null || dhuhurMinute === null) {
      return null;
    }
    var map = settingsMap(config);
    var subuhRows = ["adzan", "iqamah", "prayer"].map(function (stateKey) {
      return map["subuh:" + stateKey];
    });
    var information = map["jumat:information"];
    var prayer = map["jumat:prayer"];
    if (subuhRows.some(function (row) { return !row; }) || !information || !prayer) {
      return null;
    }
    var subuhAt = window.OverlayTimeService.timeOnDay(now, subuhMinute, snapshot, 0);
    var dhuhurAt = window.OverlayTimeService.timeOnDay(now, dhuhurMinute, snapshot, 0);
    if (!subuhAt || !dhuhurAt || dhuhurAt <= subuhAt) {
      return null;
    }
    var informationStart = subuhAt.getTime() + subuhRows.reduce(function (seconds, row) {
      return seconds + Number(row.durationSeconds || 0);
    }, 0) * 1000;
    var cutoffMinutes = Math.max(0, Number((information.settings || {}).stopBeforeDhuhurMinutes || 15));
    var informationEnd = dhuhurAt.getTime() - cutoffMinutes * 60000;
    var prayerStart = dhuhurAt.getTime();
    var prayerEnd = prayerStart + Math.max(60, Number(prayer.durationSeconds || 2700)) * 1000;
    var nowMs = now.getTime();
    var row = null;
    var stateKey = null;
    var start = null;
    var end = null;
    var target = null;
    if (information.isEnabled && nowMs >= informationStart && nowMs < informationEnd) {
      row = information;
      stateKey = "information";
      start = informationStart;
      end = informationEnd;
      target = prayerStart;
    } else if (prayer.isEnabled && nowMs >= prayerStart && nowMs < prayerEnd) {
      row = prayer;
      stateKey = "prayer";
      start = prayerStart;
      end = prayerEnd;
      target = prayerEnd;
    } else {
      return null;
    }
    var context = {
      stageLabel: label(row, language, "stateLabel"),
      prayerLabel: label(row, language, "prayerLabel"),
      countdown: window.PrayerTimeUtils.formatSeconds((target - nowMs) / 1000),
      stageMessage: stateKey === "information"
        ? (language === "en" ? "Friday prayer will begin at the Dhuhr time. The regular Dhuhr sequence is replaced today." : "Sholat Jumat dilaksanakan pada waktu Dzuhur. Rangkaian Sholat Dzuhur reguler digantikan hari ini.")
        : (language === "en" ? "Friday prayer is in progress." : "Sholat Jumat sedang dilaksanakan."),
      sourceName: source.name || ""
    };
    return {
      candidateKey: "friday:" + stateKey + ":" + start,
      overlayKey: overlay.overlayKey,
      overlayType: overlay.overlayType,
      priority: overlay.priority,
      interruptionPolicy: overlay.interruptionPolicy,
      animation: overlay.animation,
      settings: overlay.settings || {},
      startsAt: start,
      endsAt: end,
      targetAt: target,
      language: language,
      backgroundPath: row.backgroundPath || overlay.backgroundPath,
      content: contentFor(overlay, language, context),
      layout: (overlay.layouts || [])[0] || {},
      metadata: {
        controller: "FridayOverlayController",
        prayerKey: "jumat",
        stateKey: stateKey,
        subuhSequenceEndsAt: new Date(informationStart).toISOString(),
        informationEndsAt: new Date(informationEnd).toISOString(),
        fridayPrayerStartsAt: dhuhurAt.toISOString(),
        fridayPrayerEndsAt: new Date(prayerEnd).toISOString(),
        sourceName: source.name || ""
      }
    };
  }

  window.FridayOverlayController = {
    candidate: candidate,
    isFriday: isFriday,
    suppressesDhuhr: suppressesDhuhr
  };
})(window);
