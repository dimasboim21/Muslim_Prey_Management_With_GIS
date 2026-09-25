(function (window) {
  "use strict";

  var PRAYERS = ["subuh", "dhuhur", "ashar", "maghrib", "isha"];
  var STATES = ["pre_adzan", "adzan", "iqamah", "prayer"];

  function settingsMap(config) {
    return (config.prayerSettings || []).reduce(function (map, row) {
      map[row.prayerKey + ":" + row.stateKey] = row;
      return map;
    }, {});
  }

  function definition(config) {
    return (config.definitions || []).find(function (item) {
      return item.overlayKey === "fardhu-sequence" && item.isEnabled;
    }) || null;
  }

  function label(row, language, field) {
    return row[field + (language === "en" ? "En" : "Id")] || row[field + "Id"] || "";
  }

  function stageMessage(state, language) {
    var messages = {
      id: {
        pre_adzan: "Persiapkan diri dan rapikan saf sebelum adzan.",
        adzan: "Adzan sedang dikumandangkan.",
        iqamah: "Waktu tersisa menuju iqamah.",
        prayer: "Sholat berjamaah sedang dilaksanakan."
      },
      en: {
        pre_adzan: "Prepare and arrange the rows before the adhan.",
        adzan: "The adhan is being called.",
        iqamah: "Time remaining until iqamah.",
        prayer: "Congregational prayer is in progress."
      }
    };
    return messages[language][state] || "";
  }

  function resolveTemplate(overlay, language, context, fallback) {
    var template = (overlay.contents || []).find(function (item) {
      return item.isEnabled && item.languageCode === language && item.contentKey === "main";
    }) || {};
    function resolved(field, defaultValue) {
      return String(template[field] || defaultValue || "").replace(/\{([A-Za-z0-9_]+)\}/g, function (_, key) {
        return context[key] === undefined || context[key] === null ? "" : String(context[key]);
      }).trim();
    }
    return {
      eyebrow: resolved("eyebrow", fallback.eyebrow),
      title: resolved("title", fallback.title),
      subtitle: resolved("subtitle", fallback.subtitle),
      bodyText: resolved("bodyText", fallback.bodyText),
      additionalText: resolved("additionalText", fallback.additionalText),
      textAlign: template.textAlign || "center",
      fontFamily: template.fontFamily,
      titleSizeClamp: template.titleSizeClamp,
      bodySizeClamp: template.bodySizeClamp
    };
  }

  function candidate(snapshot, config, now, language) {
    var overlay = definition(config);
    var source = snapshot && snapshot.activeSource;
    if (!overlay || !source || !source.times || (window.OverlayTriggerEngine && !window.OverlayTriggerEngine.scopeMatches(overlay, snapshot))) {
      return null;
    }
    var map = settingsMap(config);
    var nowMs = now.getTime();
    var candidates = [];
    PRAYERS.forEach(function (prayerKey) {
      var minute = window.PrayerTimeUtils.parseTimeToMinutes(source.times[prayerKey]);
      if (minute === null) {
        return;
      }
      [-1, 0, 1].forEach(function (dayOffset) {
        var adzanAt = window.OverlayTimeService.timeOnDay(now, minute, snapshot, dayOffset);
        if (!adzanAt) {
          return;
        }
        if (prayerKey === "dhuhur" && window.FridayOverlayController && window.FridayOverlayController.suppressesDhuhr(snapshot, config, adzanAt)) {
          return;
        }
        var rows = STATES.map(function (stateKey) { return map[prayerKey + ":" + stateKey]; });
        if (rows.some(function (row) { return !row; })) {
          return;
        }
        var preStart = adzanAt.getTime() - rows[0].durationSeconds * 1000;
        var boundaries = [
          [preStart, adzanAt.getTime()],
          [adzanAt.getTime(), adzanAt.getTime() + rows[1].durationSeconds * 1000],
          [adzanAt.getTime() + rows[1].durationSeconds * 1000, adzanAt.getTime() + (rows[1].durationSeconds + rows[2].durationSeconds) * 1000],
          [adzanAt.getTime() + (rows[1].durationSeconds + rows[2].durationSeconds) * 1000, adzanAt.getTime() + (rows[1].durationSeconds + rows[2].durationSeconds + rows[3].durationSeconds) * 1000]
        ];
        STATES.forEach(function (stateKey, index) {
          var row = rows[index];
          var start = boundaries[index][0];
          var end = boundaries[index][1];
          if (!row.isEnabled || nowMs < start || nowMs >= end) {
            return;
          }
          var context = {
            stageLabel: label(row, language, "stateLabel"),
            prayerLabel: label(row, language, "prayerLabel"),
            countdown: window.PrayerTimeUtils.formatSeconds((end - nowMs) / 1000),
            stageMessage: stageMessage(stateKey, language),
            sourceName: source.name || ""
          };
          candidates.push({
            candidateKey: "prayer:" + prayerKey + ":" + stateKey + ":" + start,
            overlayKey: overlay.overlayKey,
            overlayType: overlay.overlayType,
            priority: overlay.priority,
            interruptionPolicy: overlay.interruptionPolicy,
            animation: overlay.animation,
            settings: overlay.settings || {},
            startsAt: start,
            endsAt: end,
            targetAt: end,
            language: language,
            backgroundPath: row.backgroundPath || overlay.backgroundPath,
            content: resolveTemplate(overlay, language, context, {
              eyebrow: context.stageLabel, title: context.prayerLabel, subtitle: context.countdown,
              bodyText: context.stageMessage, additionalText: context.sourceName
            }),
            layout: (overlay.layouts || [])[0] || {},
            metadata: {
              controller: "PrayerOverlayController",
              prayerKey: prayerKey,
              stateKey: stateKey,
              adzanAt: adzanAt.toISOString(),
              sourceName: source.name || ""
            }
          });
        });
      });
    });
    candidates.sort(function (a, b) { return b.priority - a.priority || a.endsAt - b.endsAt; });
    return candidates[0] || null;
  }

  window.PrayerOverlayController = { candidate: candidate };
})(window);
