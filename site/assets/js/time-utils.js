(function (window) {
  "use strict";

  var LABELS = {
    maghrib: "Maghrib",
    isha: "Isya",
    subuh: "Subuh",
    syuruq: "Syuruq",
    dhuha: "Dhuha",
    dhuhur: "Dhuhur",
    ashar: "Ashar"
  };

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function parseTimeToMinutes(value) {
    if (typeof value !== "string") {
      return null;
    }

    var match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
    if (!match) {
      return null;
    }

    return Number(match[1]) * 60 + Number(match[2]) + Number(match[3] || 0) / 60;
  }

  function minutesToTime(totalMinutes) {
    if (!Number.isFinite(totalMinutes)) {
      return "-";
    }

    var rounded = Math.round(totalMinutes);
    var normalized = ((rounded % 1440) + 1440) % 1440;
    var hours = Math.floor(normalized / 60);
    var minutes = normalized % 60;
    return pad(hours) + ":" + pad(minutes);
  }

  function formatDuration(totalMinutes) {
    if (!Number.isFinite(totalMinutes)) {
      return "-";
    }

    var rounded = Math.max(0, Math.round(totalMinutes));
    var hours = Math.floor(rounded / 60);
    var minutes = rounded % 60;
    if (hours <= 0) {
      return minutes + " menit";
    }

    return hours + " jam " + minutes + " menit";
  }

  function formatSeconds(totalSeconds) {
    var safeSeconds = Math.max(0, Math.round(totalSeconds || 0));
    var hours = Math.floor(safeSeconds / 3600);
    var minutes = Math.floor((safeSeconds % 3600) / 60);
    var seconds = safeSeconds % 60;
    return pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
  }

  function calculateTahajud(times) {
    if (!times) {
      return null;
    }

    var maghrib = parseTimeToMinutes(times.maghrib);
    var subuh = parseTimeToMinutes(times.subuh);
    if (maghrib === null || subuh === null) {
      return null;
    }

    var endNight = subuh;
    if (endNight <= maghrib) {
      endNight += 1440;
    }

    var nightDuration = endNight - maghrib;
    var tahajudDuration = nightDuration / 3;
    var startTahajud = endNight - tahajudDuration;

    return {
      startTime: minutesToTime(startTahajud),
      endTime: minutesToTime(endNight),
      durationMinutes: Math.round(tahajudDuration),
      nightDurationMinutes: Math.round(nightDuration)
    };
  }

  function calculateDhuha(times, dhuhaTimings) {
    if (!times) {
      return null;
    }

    var syuruq = parseTimeToMinutes(times.syuruq);
    var dhuhaStart = syuruq;
    var dhuhaEnd = null;

    // Use dhuhaAwwabin end time if available via dhuhaTimings
    if (dhuhaTimings && dhuhaTimings.dhuhaAwwabin && dhuhaTimings.dhuhaAwwabin.end) {
      dhuhaEnd = parseTimeToMinutes(dhuhaTimings.dhuhaAwwabin.end);
    }

    // Fallback to dhuhur if dhuhaAwwabin not available
    if (dhuhaEnd === null) {
      dhuhaEnd = parseTimeToMinutes(times.dhuhur);
    }

    if (syuruq === null || dhuhaEnd === null) {
      return null;
    }

    if (dhuhaEnd <= dhuhaStart) {
      dhuhaEnd += 1440;
    }

    var dhuhaDuration = dhuhaEnd - dhuhaStart;

    return {
      startTime: minutesToTime(dhuhaStart),
      endTime: minutesToTime(dhuhaEnd),
      durationMinutes: Math.round(dhuhaDuration)
    };
  }

  function getTimeParts(now, timeZone) {
    var parts = getZonedDateParts(now, timeZone);

    return {
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second
    };
  }

  function getZonedDateParts(now, timeZone) {
    var formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      hourCycle: "h23"
    });

    var parts = formatter.formatToParts(now).reduce(function (accumulator, part) {
      accumulator[part.type] = part.value;
      return accumulator;
    }, {});

    var hour = Number(parts.hour || 0);
    if (hour === 24) {
      hour = 0;
    }

    return {
      year: Number(parts.year || now.getFullYear()),
      month: Number(parts.month || (now.getMonth() + 1)),
      day: Number(parts.day || now.getDate()),
      hour: hour,
      minute: Number(parts.minute || 0),
      second: Number(parts.second || 0)
    };
  }

  function addLocalDays(dateParts, days) {
    var base = new Date(Date.UTC(
      Number(dateParts && dateParts.year) || 1970,
      (Number(dateParts && dateParts.month) || 1) - 1,
      Number(dateParts && dateParts.day) || 1,
      12,
      0,
      0
    ));
    base.setUTCDate(base.getUTCDate() + Number(days || 0));

    return {
      year: base.getUTCFullYear(),
      month: base.getUTCMonth() + 1,
      day: base.getUTCDate()
    };
  }

  function getTimeZoneOffsetMs(timeZone, date) {
    var parts = getZonedDateParts(date, timeZone);
    var localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return localAsUtc - date.getTime();
  }

  function zonedTimeToDate(dateParts, totalMinutes, timeZone) {
    if (!Number.isFinite(totalMinutes)) {
      return null;
    }

    var dayShift = Math.floor(totalMinutes / 1440);
    var normalizedMinutes = totalMinutes - dayShift * 1440;
    if (normalizedMinutes < 0) {
      normalizedMinutes += 1440;
      dayShift -= 1;
    }

    var targetDate = addLocalDays(dateParts, dayShift);
    var totalSeconds = Math.round(normalizedMinutes * 60);
    if (totalSeconds >= 86400) {
      targetDate = addLocalDays(targetDate, 1);
      totalSeconds -= 86400;
    }

    var hour = Math.floor(totalSeconds / 3600);
    var minute = Math.floor((totalSeconds % 3600) / 60);
    var second = totalSeconds % 60;
    var utcGuess = Date.UTC(targetDate.year, targetDate.month - 1, targetDate.day, hour, minute, second);

    try {
      var offset = getTimeZoneOffsetMs(timeZone, new Date(utcGuess));
      var result = new Date(utcGuess - offset);
      var correctedOffset = getTimeZoneOffsetMs(timeZone, result);
      if (correctedOffset !== offset) {
        result = new Date(utcGuess - correctedOffset);
      }
      return result;
    } catch (error) {
      return new Date(targetDate.year, targetDate.month - 1, targetDate.day, hour, minute, second);
    }
  }

  function getCurrentMinuteNumber(now, timeZone) {
    try {
      var parts = getTimeParts(now, timeZone);
      return parts.hour * 60 + parts.minute + parts.second / 60;
    } catch (error) {
      return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    }
  }

  function getClockText(now, timeZone) {
    try {
      var parts = getTimeParts(now, timeZone);
      return pad(parts.hour) + ":" + pad(parts.minute) + ":" + pad(parts.second);
    } catch (error) {
      return pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
    }
  }

  function getLocale(config) {
    var language = window.PrayerI18n && window.PrayerI18n.getLanguage
      ? window.PrayerI18n.getLanguage(config)
      : (config && config.language);
    return language === "en" ? "en-US" : "id-ID";
  }

  function getGregorianDate(now, config) {
    var calendar = config.calendar || {};
    try {
      return new Intl.DateTimeFormat(getLocale(config), {
        timeZone: calendar.timezone || undefined,
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
      }).format(now);
    } catch (error) {
      return now.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
      });
    }
  }

  function hijriCalendarSystem(config) {
    var requested = String(config && config.calendar && config.calendar.hijriCalendar || "islamic-umalqura");
    return ["islamic-umalqura", "islamic", "islamic-civil"].indexOf(requested) >= 0
      ? requested
      : "islamic-umalqura";
  }

  function activeScheduleSource(config) {
    var sources = config && Array.isArray(config.scheduleSources) ? config.scheduleSources : [];
    return sources.find(function (source) { return source.id === config.activeSourceId; }) || sources[0] || null;
  }

  function localDateKey(now, timeZone) {
    var parts = getZonedDateParts(now, timeZone);
    return [parts.year, pad(parts.month), pad(parts.day)].join("-");
  }

  function hijriReferenceDate(now, config) {
    var calendar = config && config.calendar || {};
    var timeZone = calendar.timezone || undefined;
    var reference = new Date(now.getTime());
    var source = activeScheduleSource(config || {});
    var maghrib = source && source.times ? parseTimeToMinutes(source.times.maghrib) : null;
    if (maghrib !== null) {
      var parts = getZonedDateParts(now, timeZone);
      var currentMinutes = parts.hour * 60 + parts.minute + parts.second / 60;
      if (currentMinutes >= maghrib) {
        reference = new Date(reference.getTime() + 86400000);
      }
    }
    var adjustment = Number(calendar.hijriAdjustmentDays || 0);
    adjustment = Number.isFinite(adjustment) ? Math.max(-2, Math.min(2, Math.round(adjustment))) : 0;
    if (adjustment !== 0) {
      reference = new Date(reference.getTime() + adjustment * 86400000);
    }
    return reference;
  }

  function effectiveManualHijriDate(now, config) {
    var calendar = config && config.calendar || {};
    var manual = String(calendar.hijriDateManual || "").trim();
    var effectiveDate = String(calendar.hijriDateManualEffectiveDate || "").trim();
    if (!manual || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
      return "";
    }
    return effectiveDate === localDateKey(now, calendar.timezone || undefined) ? manual : "";
  }

  function getHijriParts(now, config) {
    var calendar = config && config.calendar || {};
    try {
      return new Intl.DateTimeFormat("en-u-ca-" + hijriCalendarSystem(config), {
        timeZone: calendar.timezone || undefined,
        day: "numeric",
        month: "numeric",
        year: "numeric"
      }).formatToParts(hijriReferenceDate(now, config)).reduce(function (result, part) {
        if (part.type === "day" || part.type === "month" || part.type === "year") {
          result[part.type] = Number(String(part.value).replace(/[^0-9]/g, ""));
        }
        return result;
      }, {});
    } catch (error) {
      return { day: null, month: null, year: null };
    }
  }

  function getHijriDate(now, config) {
    var calendar = config.calendar || {};
    var locale = getLocale(config);
    var manual = effectiveManualHijriDate(now, config);
    if (manual) {
      return manual;
    }

    try {
      return new Intl.DateTimeFormat(locale + "-u-ca-" + hijriCalendarSystem(config), {
        timeZone: calendar.timezone || undefined,
        day: "2-digit",
        month: "long",
        year: "numeric"
      }).format(hijriReferenceDate(now, config));
    } catch (error) {
      return locale === "en-US" ? "Islamic date has not been entered" : "Tanggal Islam manual belum diisi";
    }
  }

  function normalizePrayerSequence(order, times) {
    var sequence = [];
    var previous = null;

    order.forEach(function (key) {
      var minutes = parseTimeToMinutes(times[key]);
      if (minutes === null) {
        return;
      }

      var normalized = minutes;
      if (previous !== null && normalized <= previous) {
        normalized += 1440;
      }

      sequence.push({
        key: key,
        label: LABELS[key] || key,
        time: times[key],
        minute: normalized
      });
      previous = normalized;
    });

    return sequence;
  }

  function getNextPrayer(order, times, now, timeZone) {
    if (!Array.isArray(order) || !times) {
      return null;
    }

    var maghrib = parseTimeToMinutes(times.maghrib);
    var current = getCurrentMinuteNumber(now, timeZone);
    if (maghrib !== null && current < maghrib) {
      current += 1440;
    }

    var sequence = normalizePrayerSequence(order, times);
    for (var index = 0; index < sequence.length; index += 1) {
      if (sequence[index].minute > current) {
        return Object.assign({}, sequence[index], {
          secondsUntil: (sequence[index].minute - current) * 60
        });
      }
    }

    if (sequence.length > 0) {
      return Object.assign({}, sequence[0], {
        minute: sequence[0].minute + 1440,
        secondsUntil: (sequence[0].minute + 1440 - current) * 60
      });
    }

    return null;
  }

  window.PrayerTimeUtils = {
    labels: LABELS,
    pad: pad,
    parseTimeToMinutes: parseTimeToMinutes,
    minutesToTime: minutesToTime,
    formatDuration: formatDuration,
    formatSeconds: formatSeconds,
    calculateTahajud: calculateTahajud,
    calculateDhuha: calculateDhuha,
    getClockText: getClockText,
    getCurrentMinuteNumber: getCurrentMinuteNumber,
    getZonedDateParts: getZonedDateParts,
    addLocalDays: addLocalDays,
    zonedTimeToDate: zonedTimeToDate,
    getGregorianDate: getGregorianDate,
    getHijriDate: getHijriDate,
    getHijriParts: getHijriParts,
    hijriReferenceDate: hijriReferenceDate,
    normalizePrayerSequence: normalizePrayerSequence,
    getNextPrayer: getNextPrayer
  };
})(window);
