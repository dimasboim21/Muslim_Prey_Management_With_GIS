(function (window) {
  "use strict";

  var reminderIndex = 0;

  function actualNow() {
    return window.MpmActualTime && typeof window.MpmActualTime.now === "function"
      ? window.MpmActualTime.now()
      : new Date();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function createElement(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== undefined && text !== null) {
      element.textContent = text;
    }
    return element;
  }

  function getActiveSource(config) {
    var sources = config.scheduleSources || [];
    return sources.find(function (source) {
      return source.id === config.activeSourceId;
    }) || sources[0] || null;
  }

  function isLegacyDhuhaWusthaLabel(value) {
    return typeof value === "string" && /^(Dhuha|Duha)\s+Wo+stha+a?$/i.test(value.trim());
  }

  function getPrayerLabel(config, key) {
    var cardLabel = config.prayerCards && config.prayerCards[key] && config.prayerCards[key].label;
    var translated = window.PrayerI18n.t(config, "prayer" + key.charAt(0).toUpperCase() + key.slice(1));
    var defaultLabel = window.DEFAULT_PRAYER_CONFIG
      && window.DEFAULT_PRAYER_CONFIG.prayerCards
      && window.DEFAULT_PRAYER_CONFIG.prayerCards[key]
      && window.DEFAULT_PRAYER_CONFIG.prayerCards[key].label;

    if (key === "dhuhaWoosthaa" && isLegacyDhuhaWusthaLabel(cardLabel)) {
      cardLabel = translated || "Dhuha Wustha";
    }

    if (window.PrayerI18n.getLanguage(config) === "en" && (!cardLabel || cardLabel === defaultLabel || cardLabel === window.PrayerTimeUtils.labels[key])) {
      return translated;
    }

    return cardLabel
      || translated
      || window.PrayerTimeUtils.labels[key]
      || key;
  }

  function getNextPrayerOrder(config) {
    return (config.prayerOrder || []).filter(function (key) {
      return key !== "syuruq";
    });
  }

  function setText(id, value) {
    var element = byId(id);
    if (element) {
      element.textContent = value || "-";
    }
  }

  function toCssUrl(path) {
    var url = String(path || "");
    try {
      url = new URL(url, window.location.href).href;
    } catch (error) {
      // Keep the original path when URL parsing is unavailable.
    }
    return 'url("' + url.replace(/"/g, '\\"') + '")';
  }

  var TIME_BACKGROUND_PHASES = [
    "main",
    "night",
    "subuh",
    "syuruq",
    "dhuha",
    "istiwa",
    "zuhur",
    "ashar",
    "late-ashar",
    "sunset",
    "maghrib",
    "isya",
    "night-first-third",
    "midnight",
    "last-third-night",
    "tahajud"
  ];
  var backgroundState = {
    key: "",
    image: "",
    phase: null,
    timer: null,
    watchdogTimer: null,
    transitionTimer: null,
    configSignature: "",
    preloadSignature: "",
    preloadedImages: {},
    config: null,
    wakeEventsBound: false
  };

  function normalizePrayerDayMinute(minute, maghribMinute) {
    if (!Number.isFinite(minute)) {
      return null;
    }
    if (Number.isFinite(maghribMinute) && minute < maghribMinute) {
      return minute + 1440;
    }

    return minute;
  }

  function getDhuhaStageStart(source) {
    var timing = source && source.dhuhaTimings && source.dhuhaTimings.dhuhaWoosthaa
      ? source.dhuhaTimings.dhuhaWoosthaa
      : null;
    var fromTiming = timing && timing.start ? window.PrayerTimeUtils.parseTimeToMinutes(timing.start) : null;
    if (Number.isFinite(fromTiming)) {
      return fromTiming;
    }

    var fromTimes = source && source.times
      ? window.PrayerTimeUtils.parseTimeToMinutes(source.times.dhuhaWoosthaa || source.times.dhuhaAwwal)
      : null;
    if (Number.isFinite(fromTimes)) {
      return fromTimes;
    }

    var syuruq = source && source.times ? window.PrayerTimeUtils.parseTimeToMinutes(source.times.syuruq) : null;
    return Number.isFinite(syuruq) ? syuruq + 45 : null;
  }

  function getPrayerStageMinute(source, key, fallbackOffset) {
    var timing = source && source.dhuhaTimings && source.dhuhaTimings[key] ? source.dhuhaTimings[key] : null;
    var fromTiming = timing && timing.start ? window.PrayerTimeUtils.parseTimeToMinutes(timing.start) : null;
    if (Number.isFinite(fromTiming)) {
      return fromTiming;
    }

    var fromTimes = source && source.times ? window.PrayerTimeUtils.parseTimeToMinutes(source.times[key]) : null;
    if (Number.isFinite(fromTimes)) {
      return fromTimes;
    }

    return Number.isFinite(fallbackOffset) ? fallbackOffset : null;
  }

  function isBetweenPrayerDayMinutes(current, start, end) {
    return Number.isFinite(current)
      && Number.isFinite(start)
      && Number.isFinite(end)
      && current >= start
      && current < end;
  }

  function numberOption(value, fallback) {
    var numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  function getTimeBackgroundSettings(config) {
    var display = (config && config.display) || {};
    var settings = display.timeBackgroundSettings || {};

    return {
      // Fallback pendekatan ketika akhir Syuruq dari elevasi +2 derajat belum tersedia.
      syuruqFallbackMinutes: numberOption(settings.syuruqFallbackMinutes, 18),
      istiwaOffsetBeforeMinutes: numberOption(settings.istiwaOffsetBeforeMinutes, 5),
      istiwaOffsetAfterMinutes: numberOption(settings.istiwaOffsetAfterMinutes, 0),
      // Parameter elevasi disimpan untuk modul astronomi live; fallback waktu dipakai saat belum ada event elevasi.
      lateAsharSolarElevation: numberOption(settings.lateAsharSolarElevation, 6),
      lateAsharFallbackMinutesBeforeMaghrib: numberOption(settings.lateAsharFallbackMinutesBeforeMaghrib, 45),
      sunsetFallbackMinutes: numberOption(settings.sunsetFallbackMinutes, 3),
      watchdogIntervalSeconds: numberOption(settings.watchdogIntervalSeconds, 60),
      transitionMs: numberOption(settings.transitionMs, 850)
    };
  }

  function getScheduleDayData(source, offset) {
    source = source || {};
    var containerName = offset < 0 ? "previousDay" : (offset > 0 ? "nextDay" : "currentDay");
    var timesName = offset < 0 ? "previousDayTimes" : (offset > 0 ? "nextDayTimes" : "currentDayTimes");
    var dhuhaName = offset < 0 ? "previousDayDhuhaTimings" : (offset > 0 ? "nextDayDhuhaTimings" : "currentDayDhuhaTimings");
    var makruhName = offset < 0 ? "previousDayMakruhTimes" : (offset > 0 ? "nextDayMakruhTimes" : "currentDayMakruhTimes");
    var container = (source && source[containerName]) || {};

    return {
      date: container.date || container.gregorianDate || source.gregorianDate || "",
      times: container.times || source[timesName] || source.times || {},
      dhuhaTimings: container.dhuhaTimings || source[dhuhaName] || source.dhuhaTimings || {},
      makruhTimes: container.makruhTimes || source[makruhName] || source.makruhTimes || {},
      solar: container.solar || source.solar || {},
      astronomy: container.astronomy || source.astronomy || {}
    };
  }

  function minuteFromValue(value) {
    return window.PrayerTimeUtils.parseTimeToMinutes(value);
  }

  function firstFiniteMinute(values) {
    for (var index = 0; index < values.length; index += 1) {
      var minute = minuteFromValue(values[index]);
      if (Number.isFinite(minute)) {
        return minute;
      }
    }

    return null;
  }

  function getDayMinute(dayData, key) {
    var times = (dayData && dayData.times) || {};
    if (key === "zuhur") {
      return firstFiniteMinute([times.zuhur, times.dhuhur]);
    }
    if (key === "late-ashar") {
      return firstFiniteMinute([times.lateAshar, times.late_ashar, times.lateAsr]);
    }

    return minuteFromValue(times[key]);
  }

  function getSunMinute(config, dayData, keys) {
    var astronomySun = config && config.astronomy && config.astronomy.sun ? config.astronomy.sun : {};
    var candidates = [];
    keys.forEach(function (key) {
      var times = (dayData && dayData.times) || {};
      var solar = (dayData && dayData.solar) || {};
      var astronomy = (dayData && dayData.astronomy) || {};
      candidates.push(times[key]);
      candidates.push(solar[key]);
      candidates.push(astronomy[key]);
      candidates.push(astronomySun[key]);
    });

    return firstFiniteMinute(candidates);
  }

  function getDhuhaBackgroundStartMinute(dayData, settings) {
    var syuruq = getDayMinute(dayData, "syuruq");
    var timings = (dayData && dayData.dhuhaTimings) || {};
    var fromTiming = timings.dhuhaAwwal && timings.dhuhaAwwal.start
      ? minuteFromValue(timings.dhuhaAwwal.start)
      : null;
    var fromTimes = getDayMinute(dayData, "dhuhaAwwal");

    if (Number.isFinite(syuruq)) {
      if (Number.isFinite(fromTiming) && fromTiming > syuruq) {
        return fromTiming;
      }
      if (Number.isFinite(fromTimes) && fromTimes > syuruq) {
        return fromTimes;
      }
      return syuruq + settings.syuruqFallbackMinutes;
    }

    return Number.isFinite(fromTiming) ? fromTiming : fromTimes;
  }

  function createStage(id, start, end, source) {
    if (!(start instanceof Date) || !(end instanceof Date)) {
      return null;
    }
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      return null;
    }

    return {
      id: id,
      label: id,
      start: start,
      end: end,
      backgroundClass: "bg-" + id,
      source: source || ""
    };
  }

  function addStage(stages, id, start, end, source) {
    var stage = createStage(id, start, end, source);
    if (stage) {
      stages.push(stage);
    }
  }

  function safeZonedDateParts(now, timezone) {
    try {
      return window.PrayerTimeUtils.getZonedDateParts(now, timezone);
    } catch (error) {
      return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds()
      };
    }
  }

  function dateOnLocalDay(dateParts, minute, timezone) {
    return window.PrayerTimeUtils.zonedTimeToDate(dateParts, minute, timezone);
  }

  function buildTimeBackgroundTimeline(config, now) {
    var nowDate = now || actualNow();
    var source = getActiveSource(config);
    if (!source || !source.times) {
      return {
        timezone: "",
        source: null,
        stages: [],
        phase: createStage("main", new Date(nowDate.getTime() - 60000), new Date(nowDate.getTime() + 60000), "fallback"),
        nextTransition: null
      };
    }

    var timezone = (config.calendar && config.calendar.timezone) || source.timezone;
    var settings = getTimeBackgroundSettings(config);
    var localToday = safeZonedDateParts(nowDate, timezone);
    var currentDay = getScheduleDayData(source, 0);
    var todayMaghribMinute = getDayMinute(currentDay, "maghrib");
    if (!Number.isFinite(todayMaghribMinute)) {
      return {
        timezone: timezone,
        source: source,
        stages: [],
        phase: createStage("main", new Date(nowDate.getTime() - 60000), new Date(nowDate.getTime() + 60000), "fallback"),
        nextTransition: null
      };
    }

    var todayMaghrib = dateOnLocalDay(localToday, todayMaghribMinute, timezone);
    var baseOffset = nowDate >= todayMaghrib ? 0 : -1;
    var baseDate = window.PrayerTimeUtils.addLocalDays(localToday, baseOffset);
    var nextDate = window.PrayerTimeUtils.addLocalDays(baseDate, 1);
    var baseDay = getScheduleDayData(source, baseOffset);
    var nextDay = getScheduleDayData(source, baseOffset + 1);
    var stages = [];

    var maghribMinute = getDayMinute(baseDay, "maghrib");
    var ishaMinute = getDayMinute(baseDay, "isha");
    var subuhMinute = getDayMinute(nextDay, "subuh");
    var syuruqMinute = getDayMinute(nextDay, "syuruq");
    var dhuhurMinute = getDayMinute(nextDay, "zuhur");
    var asharMinute = getDayMinute(nextDay, "ashar");
    var nextMaghribMinute = getDayMinute(nextDay, "maghrib");

    if (!Number.isFinite(maghribMinute) || !Number.isFinite(subuhMinute)) {
      return {
        timezone: timezone,
        source: source,
        stages: [],
        phase: createStage("main", new Date(nowDate.getTime() - 60000), new Date(nowDate.getTime() + 60000), "fallback"),
        nextTransition: null
      };
    }

    var maghribDate = dateOnLocalDay(baseDate, maghribMinute, timezone);
    var subuhDate = dateOnLocalDay(nextDate, subuhMinute, timezone);
    var nightDurationMs = subuhDate && maghribDate ? subuhDate.getTime() - maghribDate.getTime() : 0;
    var firstThirdDate = nightDurationMs > 0 ? new Date(maghribDate.getTime() + nightDurationMs / 3) : null;
    var midnightDate = nightDurationMs > 0 ? new Date(maghribDate.getTime() + nightDurationMs / 2) : null;
    var lastThirdDate = nightDurationMs > 0 ? new Date(maghribDate.getTime() + nightDurationMs * 2 / 3) : null;

    var sunsetMinute = getSunMinute(config, baseDay, ["sunset", "ghurub"]);
    if (!Number.isFinite(sunsetMinute)) {
      sunsetMinute = maghribMinute;
    }
    var sunsetStartDate = dateOnLocalDay(baseDate, sunsetMinute, timezone);
    var sunsetEndMinute = getSunMinute(config, baseDay, ["sunsetEnd", "ghurubEnd"]);
    var sunsetEndDate = Number.isFinite(sunsetEndMinute)
      ? dateOnLocalDay(baseDate, sunsetEndMinute, timezone)
      : new Date(sunsetStartDate.getTime() + settings.sunsetFallbackMinutes * 60000);
    var maghribStartDate = sunsetEndDate > maghribDate ? sunsetEndDate : maghribDate;
    var ishaDate = Number.isFinite(ishaMinute) ? dateOnLocalDay(baseDate, normalizePrayerDayMinute(ishaMinute, maghribMinute), timezone) : null;

    addStage(stages, "sunset", sunsetStartDate, sunsetEndDate, "sunset");
    addStage(stages, "maghrib", maghribStartDate, ishaDate || firstThirdDate || subuhDate, "active prayer time");
    addStage(stages, "isya", ishaDate, firstThirdDate || lastThirdDate || subuhDate, "active prayer time");
    addStage(stages, "night-first-third", firstThirdDate, midnightDate || lastThirdDate || subuhDate, "night division");
    addStage(stages, "midnight", midnightDate, lastThirdDate || subuhDate, "night division");
    addStage(stages, "last-third-night", lastThirdDate, subuhDate, "night division");

    var syuruqDate = Number.isFinite(syuruqMinute) ? dateOnLocalDay(nextDate, syuruqMinute, timezone) : null;
    var dhuhaStartMinute = getDhuhaBackgroundStartMinute(nextDay, settings);
    var dhuhaStartDate = Number.isFinite(dhuhaStartMinute) ? dateOnLocalDay(nextDate, dhuhaStartMinute, timezone) : null;
    var transitMinute = getSunMinute(config, nextDay, ["transit", "solarNoon", "istiwa"]);
    if (!Number.isFinite(transitMinute)) {
      transitMinute = dhuhurMinute;
    }
    var istiwaStartDate = Number.isFinite(transitMinute)
      ? dateOnLocalDay(nextDate, transitMinute - settings.istiwaOffsetBeforeMinutes, timezone)
      : null;
    var istiwaEndDate = Number.isFinite(dhuhurMinute)
      ? dateOnLocalDay(nextDate, dhuhurMinute, timezone)
      : (Number.isFinite(transitMinute) ? dateOnLocalDay(nextDate, transitMinute + settings.istiwaOffsetAfterMinutes, timezone) : null);
    var dhuhurDate = Number.isFinite(dhuhurMinute) ? dateOnLocalDay(nextDate, dhuhurMinute, timezone) : istiwaEndDate;
    var asharDate = Number.isFinite(asharMinute) ? dateOnLocalDay(nextDate, asharMinute, timezone) : null;
    var nextMaghribDate = Number.isFinite(nextMaghribMinute) ? dateOnLocalDay(nextDate, nextMaghribMinute, timezone) : null;
    var lateAsharMinute = getDayMinute(nextDay, "late-ashar");
    if (!Number.isFinite(lateAsharMinute)) {
      lateAsharMinute = firstFiniteMinute([
        nextDay.makruhTimes && nextDay.makruhTimes.ashar,
        nextDay.makruhTimes && nextDay.makruhTimes.lateAshar,
        nextDay.solar && nextDay.solar.lateAsharStart
      ]);
    }
    if (!Number.isFinite(lateAsharMinute) && Number.isFinite(nextMaghribMinute)) {
      lateAsharMinute = nextMaghribMinute - settings.lateAsharFallbackMinutesBeforeMaghrib;
    }
    if (Number.isFinite(lateAsharMinute) && Number.isFinite(asharMinute) && Number.isFinite(nextMaghribMinute) && lateAsharMinute <= asharMinute) {
      lateAsharMinute = asharMinute + Math.max(1, (nextMaghribMinute - asharMinute) * 0.55);
    }
    var lateAsharDate = Number.isFinite(lateAsharMinute) ? dateOnLocalDay(nextDate, lateAsharMinute, timezone) : null;
    var nextSunsetMinute = getSunMinute(config, nextDay, ["sunset", "ghurub"]);
    if (!Number.isFinite(nextSunsetMinute)) {
      nextSunsetMinute = nextMaghribMinute;
    }
    var nextSunsetStartDate = Number.isFinite(nextSunsetMinute) ? dateOnLocalDay(nextDate, nextSunsetMinute, timezone) : nextMaghribDate;
    var nextSunsetEndMinute = getSunMinute(config, nextDay, ["sunsetEnd", "ghurubEnd"]);
    var nextSunsetEndDate = Number.isFinite(nextSunsetEndMinute)
      ? dateOnLocalDay(nextDate, nextSunsetEndMinute, timezone)
      : (nextSunsetStartDate ? new Date(nextSunsetStartDate.getTime() + settings.sunsetFallbackMinutes * 60000) : null);

    addStage(stages, "subuh", subuhDate, syuruqDate, "active prayer time");
    addStage(stages, "syuruq", syuruqDate, dhuhaStartDate, "sunrise + elevation fallback");
    addStage(stages, "dhuha", dhuhaStartDate, istiwaStartDate, "sun elevation fallback");
    addStage(stages, "istiwa", istiwaStartDate, istiwaEndDate, "solar transit");
    addStage(stages, "zuhur", dhuhurDate, asharDate, "active prayer time");
    addStage(stages, "ashar", asharDate, lateAsharDate || nextSunsetStartDate || nextMaghribDate, "active prayer time");
    addStage(stages, "late-ashar", lateAsharDate, nextSunsetStartDate || nextMaghribDate, "low sun fallback");
    addStage(stages, "sunset", nextSunsetStartDate, nextSunsetEndDate, "sunset");

    stages.sort(function (a, b) {
      return a.start.getTime() - b.start.getTime();
    });

    var activePhase = null;
    var nextTransition = null;
    for (var index = 0; index < stages.length; index += 1) {
      if (nowDate >= stages[index].start && nowDate < stages[index].end) {
        activePhase = stages[index];
        nextTransition = stages[index].end;
        break;
      }
      if (!nextTransition && stages[index].start > nowDate) {
        nextTransition = stages[index].start;
      }
    }

    if (!activePhase) {
      activePhase = createStage("main", new Date(nowDate.getTime() - 60000), new Date(nowDate.getTime() + 60000), "fallback");
    }

    return {
      timezone: timezone,
      source: source,
      stages: stages,
      phase: activePhase,
      nextTransition: nextTransition
    };
  }

  function resolveTimeBackgroundPhase(config, now) {
    return buildTimeBackgroundTimeline(config, now || actualNow()).phase;
  }

  function getTimeBackgroundKey(config, now) {
    return resolveTimeBackgroundPhase(config, now || actualNow()).id;
  }

  function getBackgroundImageFromMap(display, key) {
    var map = display.timeBackgroundImages || {};
    var aliases = {
      tahajud: ["last-third-night", "nightLastThird", "nightLastThirdBackgroundImage"],
      "last-third-night": ["last-third-night", "nightLastThird", "tahajud"],
      "night-first-third": ["night-first-third", "nightFirstThird"],
      "late-ashar": ["late-ashar", "lateAshar"],
      zuhur: ["zuhur", "dhuhur"]
    };
    var keys = aliases[key] || [key];

    for (var index = 0; index < keys.length; index += 1) {
      if (map[keys[index]]) {
        return map[keys[index]];
      }
    }

    return "";
  }

  function getTimeBackgroundImage(config, key) {
    var display = (config && config.display) || {};
    var mapped = getBackgroundImageFromMap(display, key);
    if (mapped) {
      return mapped;
    }
    if (key === "last-third-night" || key === "tahajud") {
      return display.nightLastThirdBackgroundImage
        || display.tahajudBackgroundImage
        || display.backgroundImage
        || "";
    }
    if (key === "night") {
      return display.nightBackgroundImage || display.backgroundImage || "";
    }
    if (key === "main") {
      return display.backgroundImage || "";
    }
    if (key === "dhuha") {
      return getBackgroundImageFromMap(display, "dhuha")
        || (config && config.prayerCards && config.prayerCards.dhuhaAwwal && config.prayerCards.dhuhaAwwal.backgroundImage)
        || display.backgroundImage
        || "";
    }
    if (key === "zuhur") {
      return (config && config.prayerCards && config.prayerCards.dhuhur && config.prayerCards.dhuhur.backgroundImage)
        || display.backgroundImage
        || "";
    }

    var card = config && config.prayerCards && config.prayerCards[key] ? config.prayerCards[key] : null;
    return (card && card.backgroundImage) || display.backgroundImage || "";
  }

  function getTimeBackgroundImageList(config) {
    var images = {};
    var display = (config && config.display) || {};
    if (display.backgroundImage) {
      images.main = display.backgroundImage;
    }
    TIME_BACKGROUND_PHASES.forEach(function (key) {
      var image = getTimeBackgroundImage(config, key);
      if (image) {
        images[key] = image;
      }
    });

    return images;
  }

  function preloadTimeBackgroundImages(config) {
    var images = getTimeBackgroundImageList(config);
    var signature = "";
    try {
      signature = JSON.stringify(images);
    } catch (error) {
      signature = String(Date.now());
    }
    if (signature === backgroundState.preloadSignature) {
      return;
    }

    backgroundState.preloadSignature = signature;
    Object.keys(images).forEach(function (key) {
      var imagePath = images[key];
      if (!imagePath || backgroundState.preloadedImages[imagePath]) {
        return;
      }
      var image = new Image();
      image.src = imagePath;
      backgroundState.preloadedImages[imagePath] = image;
    });
  }

  function setBackgroundPhaseClass(page, key) {
    TIME_BACKGROUND_PHASES.forEach(function (phaseKey) {
      page.classList.remove("bg-" + phaseKey);
    });
    page.classList.add("bg-" + key);
  }

  function clearBackgroundPhaseState() {
    var page = document.body;
    if (!page) {
      return;
    }
    TIME_BACKGROUND_PHASES.forEach(function (phaseKey) {
      page.classList.remove("bg-" + phaseKey);
    });
    page.classList.remove("is-background-transitioning");
    page.removeAttribute("data-time-background");
    page.removeAttribute("data-prayer-phase");
    page.style.removeProperty("--page-next-image");
    backgroundState.key = "";
    backgroundState.image = "";
    backgroundState.phase = null;
  }

  function setPageBackgroundImage(page, image, key, transitionMs) {
    var cssImage = toCssUrl(image);
    var currentImage = backgroundState.image;

    if (backgroundState.transitionTimer) {
      window.clearTimeout(backgroundState.transitionTimer);
      backgroundState.transitionTimer = null;
    }

    if (currentImage && currentImage !== image && transitionMs > 0) {
      page.style.setProperty("--page-next-image", cssImage);
      page.classList.add("is-background-transitioning");
      backgroundState.transitionTimer = window.setTimeout(function () {
        page.style.setProperty("--page-image", cssImage);
        page.style.removeProperty("--page-next-image");
        page.classList.remove("is-background-transitioning");
        backgroundState.transitionTimer = null;
      }, transitionMs);
    } else {
      page.style.setProperty("--page-image", cssImage);
      page.style.removeProperty("--page-next-image");
      page.classList.remove("is-background-transitioning");
    }

    page.setAttribute("data-time-background", key);
    page.setAttribute("data-prayer-phase", key);
    setBackgroundPhaseClass(page, key);
    backgroundState.key = key;
    backgroundState.image = image;
  }

  function applyTimeBackground(config, now) {
    if (!config || (config.display && config.display.dynamicTimeBackground === false)) {
      return;
    }

    var page = document.body;
    if (!page) {
      return;
    }

    preloadTimeBackgroundImages(config);
    var timeline = buildTimeBackgroundTimeline(config, now || actualNow());
    var phase = timeline.phase || {};
    var key = phase.id || "main";
    var image = getTimeBackgroundImage(config, key);
    if (!image) {
      image = getTimeBackgroundImage(config, "main");
    }
    if (!image) {
      return timeline;
    }

    if (backgroundState.key !== key || backgroundState.image !== image) {
      setPageBackgroundImage(page, image, key, getTimeBackgroundSettings(config).transitionMs);
    } else {
      page.setAttribute("data-time-background", key);
      page.setAttribute("data-prayer-phase", key);
      setBackgroundPhaseClass(page, key);
    }

    backgroundState.phase = phase;
    return timeline;
  }

  function getTimeBackgroundSignature(config) {
    var source = getActiveSource(config) || {};
    var display = (config && config.display) || {};
    var calendar = (config && config.calendar) || {};
    try {
      return JSON.stringify({
        activeSourceId: config && config.activeSourceId,
        timezone: calendar.timezone || source.timezone || "",
        times: source.times || {},
        previousDay: source.previousDay || source.previousDayTimes || {},
        currentDay: source.currentDay || source.currentDayTimes || {},
        nextDay: source.nextDay || source.nextDayTimes || {},
        displayImages: display.timeBackgroundImages || {},
        tahajudBackgroundImage: display.tahajudBackgroundImage || "",
        nightLastThirdBackgroundImage: display.nightLastThirdBackgroundImage || "",
        settings: display.timeBackgroundSettings || {}
      });
    } catch (error) {
      return String(Date.now());
    }
  }

  function stopTimeBackgroundScheduler() {
    if (backgroundState.timer) {
      window.clearTimeout(backgroundState.timer);
      backgroundState.timer = null;
    }
    if (backgroundState.watchdogTimer) {
      window.clearInterval(backgroundState.watchdogTimer);
      backgroundState.watchdogTimer = null;
    }
    if (backgroundState.transitionTimer) {
      window.clearTimeout(backgroundState.transitionTimer);
      backgroundState.transitionTimer = null;
    }
  }

  function scheduleNextTimeBackgroundCheck(config, timeline) {
    if (backgroundState.timer) {
      window.clearTimeout(backgroundState.timer);
      backgroundState.timer = null;
    }

    var now = actualNow();
    var next = timeline && timeline.nextTransition instanceof Date ? timeline.nextTransition : null;
    var delay = next ? next.getTime() - now.getTime() + 250 : 60000;
    if (!Number.isFinite(delay) || delay < 1000) {
      delay = 1000;
    }
    delay = Math.min(delay, 2147483647);

    backgroundState.timer = window.setTimeout(function () {
      var activeConfig = backgroundState.config || config;
      var nextTimeline = applyTimeBackground(activeConfig, actualNow());
      scheduleNextTimeBackgroundCheck(activeConfig, nextTimeline);
    }, delay);
  }

  function bindTimeBackgroundWakeEvents() {
    if (backgroundState.wakeEventsBound) {
      return;
    }
    backgroundState.wakeEventsBound = true;

    function refreshAfterWake() {
      if (!backgroundState.config) {
        return;
      }
      var timeline = applyTimeBackground(backgroundState.config, actualNow());
      scheduleNextTimeBackgroundCheck(backgroundState.config, timeline);
    }

    window.addEventListener("focus", refreshAfterWake);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        refreshAfterWake();
      }
    });
  }

  function startTimeBackgroundScheduler(config) {
    if (!config || (config.display && config.display.dynamicTimeBackground === false)) {
      stopTimeBackgroundScheduler();
      clearBackgroundPhaseState();
      return;
    }

    backgroundState.config = config;
    var signature = getTimeBackgroundSignature(config);
    if (backgroundState.configSignature !== signature) {
      stopTimeBackgroundScheduler();
      backgroundState.configSignature = signature;
    }

    var timeline = applyTimeBackground(config, actualNow());
    scheduleNextTimeBackgroundCheck(config, timeline);
    bindTimeBackgroundWakeEvents();
    if (!backgroundState.watchdogTimer) {
      backgroundState.watchdogTimer = window.setInterval(function () {
        var activeConfig = backgroundState.config || config;
        var watchdogTimeline = applyTimeBackground(activeConfig, actualNow());
        scheduleNextTimeBackgroundCheck(activeConfig, watchdogTimeline);
      }, Math.max(30, getTimeBackgroundSettings(config).watchdogIntervalSeconds) * 1000);
    }
  }

  function simulateTimeBackgroundPhases(config, referenceDate) {
    var timeline = buildTimeBackgroundTimeline(config, referenceDate || actualNow());
    var stages = timeline.stages || [];
    var cases = [];

    function addCase(label, date) {
      if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
        return;
      }
      var phase = resolveTimeBackgroundPhase(config, date);
      cases.push({
        label: label,
        at: date.toISOString(),
        phase: phase.id,
        backgroundClass: phase.backgroundClass,
        backgroundImage: getTimeBackgroundImage(config, phase.id)
      });
    }

    function stage(id) {
      return stages.find(function (item) {
        return item.id === id;
      }) || null;
    }

    var subuh = stage("subuh");
    var syuruq = stage("syuruq");
    var dhuha = stage("dhuha");
    var istiwa = stage("istiwa");
    var zuhur = stage("zuhur");
    var ashar = stage("ashar");
    var lateAshar = stage("late-ashar");
    var sunset = stage("sunset");
    var maghrib = stage("maghrib");
    var isya = stage("isya");
    var firstThird = stage("night-first-third");
    var midnight = stage("midnight");
    var lastThird = stage("last-third-night");

    if (subuh) {
      addCase("1 menit sebelum Subuh", new Date(subuh.start.getTime() - 60000));
      addCase("tepat masuk Subuh", subuh.start);
    }
    if (syuruq) {
      addCase("1 menit sebelum Sunrise", new Date(syuruq.start.getTime() - 60000));
      addCase("tepat Sunrise", syuruq.start);
      addCase("akhir Syuruq", syuruq.end);
    }
    if (dhuha) {
      addCase("waktu Dhuha", new Date(dhuha.start.getTime() + 60000));
      addCase("sebelum Istiwa", new Date(dhuha.end.getTime() - 60000));
    }
    if (istiwa) {
      addCase("tepat solar transit", new Date(istiwa.start.getTime() + Math.max(0, (istiwa.end.getTime() - istiwa.start.getTime()) / 2)));
    }
    if (zuhur) {
      addCase("masuk Zuhur", zuhur.start);
    }
    if (ashar) {
      addCase("masuk Ashar", ashar.start);
    }
    if (lateAshar) {
      addCase("matahari mulai rendah", lateAshar.start);
    }
    if (sunset) {
      addCase("tepat Sunset", sunset.start);
      addCase("akhir Ghurub", sunset.end);
    }
    if (maghrib) {
      addCase("masuk Maghrib", maghrib.start);
    }
    if (isya) {
      addCase("masuk Isya", isya.start);
    }
    if (firstThird) {
      addCase("batas sepertiga malam", firstThird.start);
    }
    if (midnight) {
      addCase("pertengahan malam", midnight.start);
    }
    if (lastThird) {
      addCase("awal sepertiga malam terakhir", lastThird.start);
      addCase("1 menit sebelum Subuh berikutnya", new Date(lastThird.end.getTime() - 60000));
    }

    if (timeline.timezone) {
      var parts = safeZonedDateParts(referenceDate || actualNow(), timeline.timezone);
      var nextDateParts = window.PrayerTimeUtils.addLocalDays(parts, 1);
      addCase("pergantian tanggal lokal", window.PrayerTimeUtils.zonedTimeToDate(nextDateParts, 0, timeline.timezone));
    }

    return cases;
  }

  function applyTranslations(config) {
    document.documentElement.lang = window.PrayerI18n.getLanguage(config);
    document.title = window.PrayerI18n.t(config, "documentTitle");

    Array.prototype.slice.call(document.querySelectorAll("[data-i18n]")).forEach(function (element) {
      element.textContent = window.PrayerI18n.t(config, element.getAttribute("data-i18n"));
    });

    Array.prototype.slice.call(document.querySelectorAll("[data-slide-key]")).forEach(function (slide) {
      slide.setAttribute("data-slide-title", window.PrayerI18n.t(config, slide.getAttribute("data-slide-key")));
    });

    var dots = byId("slideDots");
    if (dots) {
      dots.setAttribute("aria-label", window.PrayerI18n.t(config, "slideNavigation"));
    }
  }

  function cleanText(value) {
    return String(value === undefined || value === null ? "" : value).trim();
  }

  function hasMeaningfulText(value) {
    var text = cleanText(value);
    var normalized = text.toLowerCase();

    if (!text) {
      return false;
    }

    if (["-", "n/a", "null", "undefined", "yyyy-mm-dd", "yyyy/mm/dd"].indexOf(normalized) >= 0) {
      return false;
    }

    if (/^isi\s+manual\b/i.test(text)
      || /^belum\s+(diisi|ditentukan|pasti)\b/i.test(text)
      || /^tidak\s+pasti\b/i.test(text)
      || /^menunggu\b/i.test(text)) {
      return false;
    }

    return true;
  }

  function hasClearTime(value) {
    return hasMeaningfulText(value) && /^([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(cleanText(value));
  }

  function formatDurationLabel(config, totalMinutes) {
    if (window.PrayerI18n.getLanguage(config) !== "en") {
      return window.PrayerTimeUtils.formatDuration(totalMinutes);
    }

    if (!Number.isFinite(totalMinutes)) {
      return "-";
    }

    var rounded = Math.max(0, Math.round(totalMinutes));
    var hours = Math.floor(rounded / 60);
    var minutes = rounded % 60;
    if (hours <= 0) {
      return minutes + " min";
    }

    return hours + " hr " + minutes + " min";
  }

  function formatDateText(value, config) {
    var text = cleanText(value);
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

    if (!match) {
      return text;
    }

    try {
      return new Intl.DateTimeFormat(window.PrayerI18n.getLanguage(config) === "en" ? "en-US" : "id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "UTC"
      }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
    } catch (error) {
      return text;
    }
  }

  function normalizeText(value) {
    return cleanText(value).toLowerCase().replace(/[\s'`’.,-]+/g, "");
  }

  function parseHijriYear(config, text) {
    var directYear = cleanText(text).match(/\b(1[3-5]\d{2})\b/);
    var manualYear = cleanText(config.calendar && config.calendar.hijriDateManual).match(/\b(1[3-5]\d{2})\b/);

    if (directYear) {
      return Number(directYear[1]);
    }
    if (config.calendar && Number.isFinite(Number(config.calendar.hijriYear))) {
      return Number(config.calendar.hijriYear);
    }
    if (manualYear) {
      return Number(manualYear[1]);
    }

    var current = window.PrayerTimeUtils.getHijriParts(actualNow(), config);
    return current && current.year ? Number(current.year) : null;
  }

  function parseHijriDate(value, config) {
    var text = cleanText(value);
    var normalized = normalizeText(text);
    var monthMap = {
      muharram: 1,
      safar: 2,
      rabiulawal: 3,
      rabiulawwal: 3,
      rabiakhir: 4,
      rabiulakhir: 4,
      jumadilawal: 5,
      jumadilawwal: 5,
      jumadilakhir: 6,
      rajab: 7,
      syaban: 8,
      shaban: 8,
      ramadan: 9,
      ramadhan: 9,
      syawal: 10,
      shawwal: 10,
      dzulqadah: 11,
      dzulkaidah: 11,
      dhulqadah: 11,
      dzulhijjah: 12,
      dzulhijah: 12,
      dhulhijjah: 12,
      dhualhijjah: 12,
      dhulhijah: 12,
      dhuallhijjah: 12
    };
    var month = null;
    var days = (text.match(/\d+/g) || []).map(Number).filter(function (day) {
      return day >= 1 && day <= 30;
    });

    Object.keys(monthMap).some(function (key) {
      if (normalized.indexOf(key) >= 0) {
        month = monthMap[key];
        return true;
      }
      return false;
    });

    if (!month || !days.length) {
      return null;
    }

    return {
      days: days,
      month: month,
      year: parseHijriYear(config, text)
    };
  }

  function getHijriParts(date, config) {
    return window.PrayerTimeUtils.getHijriParts(date, config);
  }

  function getSearchYear(config, hijriYear) {
    var manualYear = parseHijriYear(config, "");
    var now = actualNow();

    if (manualYear && hijriYear && manualYear === hijriYear) {
      return now.getFullYear();
    }

    return now.getFullYear();
  }

  function findGregorianDatesForHijri(hijriDate, config) {
    var target = parseHijriDate(hijriDate, config);
    if (!target || !target.year) {
      return [];
    }

    var searchYear = getSearchYear(config, target.year);
    var matches = [];

    [searchYear - 1, searchYear, searchYear + 1].forEach(function (year) {
      var start = Date.UTC(year, 0, 1, 12);
      var end = Date.UTC(year, 11, 31, 12);
      for (var time = start; time <= end; time += 86400000) {
        var date = new Date(time);
        var parts = getHijriParts(date, config);
        if (!parts || parts.year !== target.year || parts.month !== target.month) {
          continue;
        }

        if (target.days.indexOf(parts.day) >= 0) {
          matches.push(date);
        }
      }
    });

    return matches.sort(function (left, right) {
      return left.getTime() - right.getTime();
    });
  }

  function formatGregorianEstimateDate(dates, config) {
    if (!dates.length) {
      return "";
    }

    if (dates.length === 1) {
      return formatDateText(dates[0].toISOString().slice(0, 10), config);
    }

    return formatDateText(dates[0].toISOString().slice(0, 10), config)
      + " - "
      + formatDateText(dates[dates.length - 1].toISOString().slice(0, 10), config);
  }

  function normalizeProbability(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 1 ? value : value * 100;
    }

    var text = cleanText(value);
    var match = text.match(/\d+(\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function pickDateCandidate(candidates) {
    return (candidates || []).filter(function (candidate) {
      return candidate && hasMeaningfulText(candidate.date);
    }).sort(function (left, right) {
      return (normalizeProbability(right.probability || right.weight || right.score) || 0)
        - (normalizeProbability(left.probability || left.weight || left.score) || 0);
    })[0] || null;
  }

  function getEstimateField(item, names) {
    for (var index = 0; index < names.length; index += 1) {
      if (hasMeaningfulText(item[names[index]])) {
        return cleanText(item[names[index]]);
      }
    }

    return "";
  }

  function resolveGregorianEstimate(item, config, dateKey) {
    var explicitDate = hasMeaningfulText(item[dateKey]) ? cleanText(item[dateKey]) : "";
    var candidates = item.gregorianCandidates || item.dateCandidates || [];
    var candidate = pickDateCandidate(candidates);
    var estimate = {
      text: "",
      sortKey: "",
      probability: "",
      potential: "",
      possibility: "",
      calculated: false
    };

    if (explicitDate) {
      estimate.text = formatDateText(explicitDate, config);
      estimate.sortKey = explicitDate;
      estimate.probability = getEstimateField(item, ["gregorianProbability", "dateProbability", "probability"]) || window.PrayerI18n.t(config, "confirmedProbability");
      estimate.potential = getEstimateField(item, ["gregorianPotential", "datePotential", "potensial", "potential"]) || window.PrayerI18n.t(config, "confirmedPotential");
      estimate.possibility = getEstimateField(item, ["gregorianPossibility", "datePossibility", "posibilitas", "possibility"]) || window.PrayerI18n.t(config, "confirmedPossibility");
      return estimate;
    }

    if (candidate) {
      estimate.text = formatDateText(candidate.date, config);
      estimate.sortKey = candidate.date;
      estimate.probability = getEstimateField(candidate, ["probability", "weight", "score"]) || window.PrayerI18n.t(config, "calculatedProbability");
      estimate.potential = getEstimateField(candidate, ["potential", "potensial"]) || window.PrayerI18n.t(config, "calculatedPotential");
      estimate.possibility = getEstimateField(candidate, ["possibility", "posibilitas"]) || window.PrayerI18n.t(config, "calculatedPossibility");
      return estimate;
    }

    if (hasMeaningfulText(item.hijriDate)) {
      var calculatedDates = findGregorianDatesForHijri(item.hijriDate, config);
      if (calculatedDates.length) {
        estimate.text = formatGregorianEstimateDate(calculatedDates, config);
        estimate.sortKey = calculatedDates[0].toISOString().slice(0, 10);
        estimate.probability = getEstimateField(item, ["gregorianProbability", "dateProbability", "probability"]) || window.PrayerI18n.t(config, "calculatedProbability");
        estimate.potential = getEstimateField(item, ["gregorianPotential", "datePotential", "potensial", "potential"]) || window.PrayerI18n.t(config, "calculatedPotential");
        estimate.possibility = getEstimateField(item, ["gregorianPossibility", "datePossibility", "posibilitas", "possibility"]) || window.PrayerI18n.t(config, "calculatedPossibility");
        estimate.calculated = true;
        return estimate;
      }
    }

    return null;
  }

  function isDisplayableActivity(activity, config) {
    return Boolean(
      activity
        && resolveGregorianEstimate(activity, config, "date")
        && hasClearTime(activity.time)
        && hasMeaningfulText(activity.personInCharge)
    );
  }

  function getMosqueAddress(config) {
    var mosque = (config && config.mosque) || {};
    var location = (config && config.location) || {};
    return mosque.officialAddress
      || mosque.address
      || location.address
      || "";
  }

  function getMosqueName(config) {
    var mosque = (config && config.mosque) || {};
    return String(mosque.name || "").trim() || "Building aktif";
  }

  function renderHeader(config) {
    var location = config.location || {};
    var mosque = config.mosque || {};
    var locationText = [location.city, location.province, location.country].filter(Boolean).join(", ");

    setText("mosqueName", getMosqueName(config));
    setText("locationText", locationText || window.PrayerI18n.t(config, "locationEmpty"));
    setText("mosqueAddress", getMosqueAddress(config) || window.PrayerI18n.t(config, "addressEmpty"));
    setText("countryText", location.country || "-");
    setText("provinceText", location.province || "-");
    setText("cityText", location.city || "-");
  }

  function renderClock(config) {
    var now = actualNow();
    var source = getActiveSource(config);
    var timezone = (config.calendar && config.calendar.timezone) || (source && source.timezone);

    applyTimeBackground(config, now);
    // The calibrated clock owns only this DOM node when its centralized ticker
    // is present. Prayer dates and schedule calculations still use Actual Time.
    if (!window.MpmIndexTimeCalibration) {
      setText("clockTime", window.PrayerTimeUtils.getClockText(now, timezone));
    }
    setText("gregorianDate", window.PrayerTimeUtils.getGregorianDate(now, config));
    setText("hijriDate", window.PrayerTimeUtils.getHijriDate(now, config));

    var clock = byId("clockTime");
    if (clock) {
      clock.setAttribute("datetime", window.PrayerTimeUtils.getClockText(now, timezone));
    }

    if (!source) {
      setText("nextPrayerLabel", "-");
      setText("nextPrayerTime", "-");
      setText("nextPrayerSource", "-");
      setText("nextPrayerCountdown", "00:00:00");
      return;
    }

    var nextPrayer = window.PrayerTimeUtils.getNextPrayer(
      getNextPrayerOrder(config),
      source.times,
      now,
      timezone
    );

    if (!nextPrayer) {
      setText("nextPrayerLabel", "-");
      setText("nextPrayerTime", "-");
      setText("nextPrayerSource", "-");
      setText("nextPrayerCountdown", "00:00:00");
      return;
    }

    var label = getPrayerLabel(config, nextPrayer.key);
    var timeDisplay = nextPrayer.time;

    // Check if this is a Dhuha period and display range from dhuhaTimings
    var dhuhaKeys = ["dhuhaAwwal", "dhuhaWoosthaa", "dhuhaAwwabin"];
    if (dhuhaKeys.indexOf(nextPrayer.key) !== -1 && source.dhuhaTimings && source.dhuhaTimings[nextPrayer.key]) {
      var timing = source.dhuhaTimings[nextPrayer.key];
      timeDisplay = timing.start + " - " + timing.end;
    }

    setText("nextPrayerLabel", label);
    setText("nextPrayerTime", timeDisplay);
    setText("nextPrayerSource", source.name || "-");
    var sourceName = byId("nextPrayerSource");
    if (sourceName) {
      sourceName.title = source.name || "";
    }
    setText("nextPrayerCountdown", window.PrayerTimeUtils.formatSeconds(nextPrayer.secondsUntil));
  }

  function renderSourceSelect(config) {
    var select = byId("activeSourceSelect");
    if (!select) {
      return;
    }

    select.innerHTML = "";
    (config.scheduleSources || []).forEach(function (source) {
      var option = document.createElement("option");
      option.value = source.id;
      option.textContent = source.name;
      if (source.methodDescription) {
        option.title = source.methodDescription;
      }
      select.appendChild(option);
    });
    select.value = config.activeSourceId;
  }

  function createInlineMethodComparison(config, key, activeSource) {
    var sources = (config.scheduleSources || []).filter(function (source) {
      var sourceTime = getSourcePrayerTime(source, key);
      return source && sourceTime.display && sourceTime.display !== "-";
    });
    if (!activeSource || sources.length <= 1) {
      return null;
    }

    var activeTime = getSourcePrayerTime(activeSource, key);
    var list = createElement("div", "inline-method-comparison");
    sources.forEach(function (source) {
      var sourceTime = getSourcePrayerTime(source, key);
      var isActive = source.id === activeSource.id;
      var row = createElement("div", "inline-method-row" + (isActive ? " is-active" : ""));
      row.appendChild(createElement("span", null, source.name || "-"));
      row.appendChild(createElement("strong", null, sourceTime.display));
      row.appendChild(createElement("em", null, formatMinuteDelta(getMinuteDelta(sourceTime.minutes, activeTime.minutes))));
      list.appendChild(row);
    });

    return list.children.length ? list : null;
  }

  function renderDhuhaGroup(config, grid, source, index) {
    var dhuhaKeys = ["dhuhaAwwal", "dhuhaWoosthaa", "dhuhaAwwabin"];
    var dhuhaContainer = createElement("div", "dhuha-group");
    var groupConfig = (config.prayerCards && config.prayerCards.dhuhaAwwal) || {};
    dhuhaContainer.style.setProperty("--card-color", groupConfig.backgroundColor || "#b7791f");
    if (groupConfig.backgroundImage) {
      dhuhaContainer.style.setProperty("--card-image", toCssUrl(groupConfig.backgroundImage));
    }
    
    var groupHeader = createElement("div", "dhuha-group-header");
    groupHeader.appendChild(createElement("h3", null, window.PrayerI18n.t(config, "prayerDhuha")));
    groupHeader.appendChild(createElement("span", "prayer-order", String(index)));
    dhuhaContainer.appendChild(groupHeader);

    var dhuhaItems = createElement("div", "dhuha-items");
    var dhuhaTimings = source && source.dhuhaTimings ? source.dhuhaTimings : null;
    
    dhuhaKeys.forEach(function (key) {
      var cardConfig = (config.prayerCards && config.prayerCards[key]) || {};
      var item = createElement("div", "dhuha-item");
      item.style.setProperty("--card-color", cardConfig.backgroundColor || "#176a58");
      if (cardConfig.backgroundImage) {
        item.style.setProperty("--card-image", toCssUrl(cardConfig.backgroundImage));
      }
      
      var label = createElement("span", "dhuha-label", getPrayerLabel(config, key));
      
      var timing = dhuhaTimings && dhuhaTimings[key] ? dhuhaTimings[key] : null;
      var timeDisplay = timing 
        ? (timing.start + " - " + timing.end) 
        : (source && source.times ? source.times[key] || "-" : "-");
      var time = createElement("span", "dhuha-time", timeDisplay);
      
      item.appendChild(label);
      item.appendChild(time);
      var comparison = createInlineMethodComparison(config, key, source);
      if (comparison) {
        item.appendChild(comparison);
      }
      dhuhaItems.appendChild(item);
    });
    
    dhuhaContainer.appendChild(dhuhaItems);

    // Add duration info
    var duhaDuration = source ? window.PrayerTimeUtils.calculateDhuha(source.times, source.dhuhaTimings) : null;
    if (duhaDuration) {
      var durationInfo = createElement("div", "dhuha-duration");
      durationInfo.appendChild(createElement("span", "dhuha-duration-label", window.PrayerI18n.t(config, "dhuhaTimeLabel")));
      durationInfo.appendChild(createElement("span", "dhuha-duration-time", duhaDuration.startTime + " - " + duhaDuration.endTime));
      durationInfo.appendChild(createElement("span", "dhuha-duration-detail", "(" + window.PrayerTimeUtils.formatDuration(duhaDuration.durationMinutes) + ")"));
      dhuhaContainer.appendChild(durationInfo);
    }
    
    grid.appendChild(dhuhaContainer);
  }

  function renderPrayerCards(config) {
    var grid = byId("prayerGrid");
    if (!grid) {
      return;
    }

    var source = getActiveSource(config);
    var now = actualNow();
    var timezone = (config.calendar && config.calendar.timezone) || (source && source.timezone);
    var nextPrayer = source
      ? window.PrayerTimeUtils.getNextPrayer(getNextPrayerOrder(config), source.times, now, timezone)
      : null;

    grid.innerHTML = "";
    var dhuhaProcessed = false;
    var cardIndex = 1;
    
    (config.prayerOrder || []).forEach(function (key) {
      // Skip dhuhaWoosthaa and dhuhaAwwabin, they are handled as part of dhuhaAwwal group
      if (key === "dhuhaWoosthaa" || key === "dhuhaAwwabin") {
        return;
      }

      // Handle dhuhaAwwal as a group with all 3 periods
      if (key === "dhuhaAwwal" && !dhuhaProcessed) {
        renderDhuhaGroup(config, grid, source, cardIndex);
        dhuhaProcessed = true;
        cardIndex += 1;
        return;
      }

      var cardConfig = (config.prayerCards && config.prayerCards[key]) || {};
      var card = createElement("article", "prayer-card");
      if (nextPrayer && nextPrayer.key === key) {
        card.classList.add("is-next");
      }
      card.style.setProperty("--card-color", cardConfig.backgroundColor || "#176a58");
      if (cardConfig.backgroundImage) {
        card.style.setProperty("--card-image", toCssUrl(cardConfig.backgroundImage));
      }

      var inner = createElement("div", "prayer-card-inner");
      var topLine = createElement("div", "prayer-topline");
      topLine.appendChild(createElement("span", "prayer-name", getPrayerLabel(config, key)));
      topLine.appendChild(createElement("span", "prayer-order", String(cardIndex)));

      var time = createElement("div", "prayer-time", source && source.times ? source.times[key] || "-" : "-");
      
      inner.appendChild(topLine);
      inner.appendChild(time);
      
      // Add makruh time if available
      var makruhTime = source && source.makruhTimes && source.makruhTimes[key] ? source.makruhTimes[key] : null;
      if (makruhTime) {
          var makruhLabel = createElement("div", "prayer-makruh", "Makruh: " + makruhTime);
          inner.appendChild(makruhLabel);
      }
      
      var comparison = createInlineMethodComparison(config, key, source);
      if (comparison) {
        inner.appendChild(comparison);
      }
      card.appendChild(inner);
      grid.appendChild(card);
      cardIndex += 1;
    });

    var tahajudCard = createElement("article", "tahajud-panel tahajud-card-in-grid");
    tahajudCard.id = "tahajudPanel";
    renderTahajudInto(config, tahajudCard);
    grid.appendChild(tahajudCard);
  }

  function getSourcePrayerTime(source, key) {
    var timing = source && source.dhuhaTimings && source.dhuhaTimings[key] ? source.dhuhaTimings[key] : null;
    var display = timing && timing.start && timing.end
      ? timing.start + "-" + timing.end
      : (source && source.times ? source.times[key] || "-" : "-");
    var compareTime = timing && timing.start
      ? timing.start
      : (source && source.times ? source.times[key] : "");

    return {
      display: display,
      minutes: window.PrayerTimeUtils.parseTimeToMinutes(compareTime)
    };
  }

  function getMinuteDelta(sourceMinutes, activeMinutes) {
    if (!Number.isFinite(sourceMinutes) || !Number.isFinite(activeMinutes)) {
      return null;
    }

    var delta = sourceMinutes - activeMinutes;
    if (delta > 720) {
      delta -= 1440;
    } else if (delta < -720) {
      delta += 1440;
    }
    return delta;
  }

  function formatMinuteDelta(delta) {
    if (!Number.isFinite(delta)) {
      return "-";
    }
    if (delta === 0) {
      return "0m";
    }
    return (delta > 0 ? "+" : "-") + Math.abs(delta) + "m";
  }

  function renderMethodComparison(config) {
    var panel = byId("methodComparisonPanel");
    if (!panel) {
      return;
    }

    var sources = config.scheduleSources || [];
    var activeSource = getActiveSource(config);
    var keys = (config.prayerOrder || []).filter(function (key) {
      return sources.some(function (source) {
        return source && source.times && source.times[key];
      });
    });

    panel.innerHTML = "";
    panel.hidden = sources.length === 0 || keys.length === 0;
    if (panel.hidden) {
      return;
    }

    var heading = createElement("div", "method-comparison-heading");
    heading.appendChild(createElement("h3", null, window.PrayerI18n.t(config, "methodComparisonTitle")));
    heading.appendChild(createElement("span", null, window.PrayerI18n.t(config, "deltaAgainstActive")));
    panel.appendChild(heading);

    var grid = createElement("div", "method-comparison-grid");
    grid.style.setProperty("--comparison-columns", String(keys.length));

    sources.forEach(function (source) {
      var isActive = activeSource && source.id === activeSource.id;
      var methodCell = createElement("div", "method-comparison-cell method-comparison-method" + (isActive ? " is-active" : ""));
      methodCell.appendChild(createElement("strong", null, source.name || "-"));
      methodCell.appendChild(createElement("span", null, isActive ? window.PrayerI18n.t(config, "activeLabel") : window.PrayerI18n.t(config, "comparison")));
      grid.appendChild(methodCell);

      keys.forEach(function (key) {
        var sourceTime = getSourcePrayerTime(source, key);
        var activeTime = getSourcePrayerTime(activeSource, key);
        var cell = createElement("div", "method-comparison-cell method-comparison-prayer" + (isActive ? " is-active" : ""));
        cell.appendChild(createElement("span", "method-comparison-label", getPrayerLabel(config, key)));
        cell.appendChild(createElement("strong", "method-comparison-time", sourceTime.display));
        cell.appendChild(createElement("span", "method-comparison-delta", formatMinuteDelta(getMinuteDelta(sourceTime.minutes, activeTime.minutes))));
        grid.appendChild(cell);
      });
    });

    panel.appendChild(grid);
  }

  function renderTahajudInto(config, panel) {
    var activeSource = getActiveSource(config);
    var activeTahajud = activeSource ? window.PrayerTimeUtils.calculateTahajud(activeSource.times) : null;
    panel.innerHTML = "";
    if (config.display && config.display.tahajudBackgroundImage) {
      panel.style.setProperty("--tahajud-image", toCssUrl(config.display.tahajudBackgroundImage));
    } else {
      panel.style.removeProperty("--tahajud-image");
    }

    var main = createElement("div", "tahajud-main");
    main.appendChild(createElement("span", "clock-label", window.PrayerI18n.t(config, "tahajudWindow")));
    main.appendChild(createElement("h3", null, window.PrayerI18n.t(config, "qiyamulLailLabel")));
    main.appendChild(createElement(
      "div",
      "tahajud-time",
      activeTahajud ? activeTahajud.startTime + " - " + activeTahajud.endTime : "-"
    ));
    main.appendChild(createElement(
      "p",
      "tahajud-note",
      activeTahajud
        ? window.PrayerI18n.t(config, "durationPrefix") + " " + formatDurationLabel(config, activeTahajud.durationMinutes) + " " + window.PrayerI18n.t(config, "nightTotalPrefix") + " " + formatDurationLabel(config, activeTahajud.nightDurationMinutes)
        : window.PrayerI18n.t(config, "tahajudNeedsTime")
    ));

    var list = createElement("div", "tahajud-source-list");
    (config.scheduleSources || []).forEach(function (source) {
      var tahajud = window.PrayerTimeUtils.calculateTahajud(source.times);
      var row = createElement("div", "tahajud-source-row");
      row.appendChild(createElement("strong", null, source.name));
      row.appendChild(createElement("span", null, tahajud ? tahajud.startTime + " - " + tahajud.endTime : "-"));
      list.appendChild(row);
    });

    panel.appendChild(main);
    panel.appendChild(list);
  }

  function renderTahajud(config) {
    var panel = byId("tahajudPanel");
    if (!panel) {
      return;
    }

    renderTahajudInto(config, panel);
  }

  function renderCommittees(config) {
    var container = byId("committeeList");
    if (!container) {
      return;
    }

    var committees = (config.mosque && config.mosque.committees) || [];
    container.innerHTML = "";

    if (!committees.length) {
      container.appendChild(createElement("p", null, window.PrayerI18n.t(config, "committeeEmpty")));
      return;
    }

    committees.forEach(function (committee) {
      var item = createElement("div", "committee-item");
      var names = Array.isArray(committee.names) ? committee.names.filter(Boolean) : [];

      if (names.length > 1) {
        item.appendChild(createElement("h3", null, committee.position || window.PrayerI18n.t(config, "committee")));
        var list = document.createElement("ol");
        names.forEach(function (name) {
          list.appendChild(createElement("li", null, name));
        });
        item.appendChild(list);
      } else {
        var wrapper = createElement("div", "committee-single");
        wrapper.appendChild(createElement("span", null, committee.position || window.PrayerI18n.t(config, "committee")));
        wrapper.appendChild(createElement("h3", null, names[0] || "-"));
        item.appendChild(wrapper);
      }

      container.appendChild(item);
    });
  }

  function renderReminders(config) {
    var container = byId("reminderList");
    if (!container) {
      return;
    }

    var reminders = (config.reminders || []).filter(function (reminder) {
      return reminder
        && (hasMeaningfulText(reminder.title)
          || hasMeaningfulText(reminder.arabicText)
          || hasMeaningfulText(reminder.content)
          || hasMeaningfulText(reminder.translation));
    });
    container.innerHTML = "";

    if (!reminders.length) {
      container.appendChild(createElement("p", null, window.PrayerI18n.t(config, "reminderEmpty")));
      return;
    }

    var activeIndex = ((reminderIndex % reminders.length) + reminders.length) % reminders.length;
    var reminder = reminders[activeIndex];
    var item = createElement("article", "reminder-item");
    item.appendChild(createElement(
      "span",
      "reminder-reference",
      (reminder.type || window.PrayerI18n.t(config, "reminder")).toUpperCase() + " " + (activeIndex + 1) + "/" + reminders.length
    ));
    item.appendChild(createElement("h3", null, reminder.title || window.PrayerI18n.t(config, "reminder")));
    if (reminder.arabicText) {
      var quranVerse = createElement("p", "reminder-quran", reminder.arabicText);
      quranVerse.setAttribute("dir", "rtl");
      quranVerse.setAttribute("lang", "ar");
      item.appendChild(quranVerse);
    }
    if (reminder.content) {
      item.appendChild(createElement("p", "reminder-content", reminder.content));
    }
    if (reminder.translation) {
      item.appendChild(createElement("p", "reminder-translation", reminder.translation));
    }
    if (reminder.reference) {
      item.appendChild(createElement("span", "reminder-reference", reminder.reference));
    }
    container.appendChild(item);
  }

  function renderSourceList(config) {
    var container = byId("sourceList");
    if (!container) {
      return;
    }

    container.innerHTML = "";
    (config.scheduleSources || []).forEach(function (source) {
      var item = createElement("article", "source-item");
      item.appendChild(createElement("h3", null, source.name));
      item.appendChild(createElement("p", "source-method", source.methodDescription || window.PrayerI18n.t(config, "manualMethod")));

      var times = createElement("div", "source-times");
      (config.prayerOrder || []).forEach(function (key) {
        times.appendChild(createElement(
          "span",
          "time-chip",
          getPrayerLabel(config, key) + " " + ((source.times && source.times[key]) || "-")
        ));
      });
      item.appendChild(times);
      container.appendChild(item);
    });
  }

  function addAstroItem(container, label, value) {
    var item = createElement("div", "astro-item");
    item.appendChild(createElement("strong", null, label));
    item.appendChild(createElement("span", null, value || "-"));
    container.appendChild(item);
  }

  function renderAstronomy(config) {
    var sunPanel = byId("sunPositionPanel");
    var moonPanel = byId("moonPositionPanel");
    var eclipsePanel = byId("eclipsePanel");
    var astronomy = config.astronomy || {};
    var sun = astronomy.sun || {};
    var moon = astronomy.moon || {};
    var eclipse = astronomy.eclipse || {};

    if (sunPanel) {
      sunPanel.innerHTML = "";
      var sunGrid = createElement("div", "astro-grid");
      addAstroItem(sunGrid, window.PrayerI18n.t(config, "dataSource"), sun.source);
      addAstroItem(sunGrid, window.PrayerI18n.t(config, "altitude"), sun.altitude);
      addAstroItem(sunGrid, window.PrayerI18n.t(config, "azimuth"), sun.azimuth);
      addAstroItem(sunGrid, window.PrayerI18n.t(config, "direction"), sun.direction);
      addAstroItem(sunGrid, window.PrayerI18n.t(config, "sunrise"), sun.sunrise);
      addAstroItem(sunGrid, window.PrayerI18n.t(config, "transit"), sun.transit);
      addAstroItem(sunGrid, window.PrayerI18n.t(config, "sunset"), sun.sunset);
      sunPanel.appendChild(sunGrid);
      if (sun.note) {
        sunPanel.appendChild(createElement("p", "astro-note", sun.note));
      }
    }

    if (moonPanel) {
      moonPanel.innerHTML = "";
      var moonGrid = createElement("div", "astro-grid");
      addAstroItem(moonGrid, window.PrayerI18n.t(config, "dataSource"), moon.source);
      addAstroItem(moonGrid, window.PrayerI18n.t(config, "phase"), moon.phase);
      addAstroItem(moonGrid, window.PrayerI18n.t(config, "illumination"), moon.illumination);
      addAstroItem(moonGrid, window.PrayerI18n.t(config, "altitude"), moon.altitude);
      addAstroItem(moonGrid, window.PrayerI18n.t(config, "azimuth"), moon.azimuth);
      addAstroItem(moonGrid, window.PrayerI18n.t(config, "direction"), moon.direction);
      addAstroItem(moonGrid, window.PrayerI18n.t(config, "moonrise"), moon.moonrise);
      addAstroItem(moonGrid, window.PrayerI18n.t(config, "moonset"), moon.moonset);
      moonPanel.appendChild(moonGrid);
      if (moon.note) {
        moonPanel.appendChild(createElement("p", "astro-note", moon.note));
      }
    }

    if (eclipsePanel) {
      eclipsePanel.innerHTML = "";
      renderEclipseItem(config, eclipsePanel, window.PrayerI18n.t(config, "solarEclipse"), eclipse.solar || {});
      renderEclipseItem(config, eclipsePanel, window.PrayerI18n.t(config, "lunarEclipse"), eclipse.lunar || {});
    }
  }

  function renderEclipseItem(config, container, title, eclipseData) {
    var item = createElement("article", "eclipse-item");
    item.appendChild(createElement("h3", null, title));
    item.appendChild(createElement("span", "eclipse-status", eclipseData.status || "-"));

    var grid = createElement("div", "astro-grid");
    addAstroItem(grid, window.PrayerI18n.t(config, "dataSource"), eclipseData.dataSource);
    addAstroItem(grid, window.PrayerI18n.t(config, "eclipseType"), eclipseData.type);
    addAstroItem(grid, window.PrayerI18n.t(config, "eclipseDate"), eclipseData.date);
    addAstroItem(grid, window.PrayerI18n.t(config, "eclipseStart"), eclipseData.start);
    addAstroItem(grid, window.PrayerI18n.t(config, "eclipsePeak"), eclipseData.peak);
    addAstroItem(grid, window.PrayerI18n.t(config, "eclipseEnd"), eclipseData.end);
    addAstroItem(grid, window.PrayerI18n.t(config, "eclipseVisibility"), eclipseData.visibility);
    addAstroItem(grid, window.PrayerI18n.t(config, "eclipsePrayer"), eclipseData.prayerRecommendation);
    item.appendChild(grid);

    if (eclipseData.note) {
      item.appendChild(createElement("p", "astro-note", eclipseData.note));
    }

    container.appendChild(item);
  }

  function addProgramDetail(container, label, value) {
    if (!hasMeaningfulText(value)) {
      return;
    }

    var item = createElement("div", "program-detail");
    item.appendChild(createElement("span", null, label));
    item.appendChild(createElement("strong", null, value));
    container.appendChild(item);
  }

  function setSlideVisible(slideId, isVisible) {
    var slide = byId(slideId);
    if (slide) {
      slide.hidden = !isVisible;
    }
  }

  function getWorshipDays(config) {
    var programs = config.islamicPrograms || {};
    return (programs.worshipDays || []).filter(function (program) {
      return program && hasMeaningfulText(program.title) && resolveGregorianEstimate(program, config, "gregorianDate");
    }).sort(function (left, right) {
      var leftEstimate = resolveGregorianEstimate(left, config, "gregorianDate");
      var rightEstimate = resolveGregorianEstimate(right, config, "gregorianDate");
      return String(leftEstimate && leftEstimate.sortKey || "").localeCompare(String(rightEstimate && rightEstimate.sortKey || ""));
    });
  }

  function getDisplayableActivities(config) {
    var programs = config.islamicPrograms || {};
    return (programs.activities || []).filter(function (activity) {
      return isDisplayableActivity(activity, config);
    }).slice().sort(function (left, right) {
      var leftEstimate = resolveGregorianEstimate(left, config, "date");
      var rightEstimate = resolveGregorianEstimate(right, config, "date");
      return String(leftEstimate && leftEstimate.sortKey || "").localeCompare(String(rightEstimate && rightEstimate.sortKey || ""));
    });
  }

  function renderWorshipDaysInto(config, container, items) {
    if (!items.length) {
      container.appendChild(createElement("p", null, window.PrayerI18n.t(config, "emptyData")));
      return;
    }

    items.forEach(function (program) {
      var item = createElement("article", "program-item");
      var details = createElement("div", "program-detail-list");
      var estimate = resolveGregorianEstimate(program, config, "gregorianDate");

      item.appendChild(createElement("h3", null, program.title || window.PrayerI18n.t(config, "islamicAgenda")));
      addProgramDetail(details, window.PrayerI18n.t(config, "gregorianDateLabel"), estimate && estimate.text);
      addProgramDetail(details, window.PrayerI18n.t(config, "hijriDateLabel"), program.hijriDate);
      item.appendChild(details);
      if (program.description) {
        item.appendChild(createElement("p", null, program.description));
      }
      container.appendChild(item);
    });
  }

  function renderActivitiesInto(config, container, activities) {
    if (!activities.length) {
      container.appendChild(createElement("p", null, window.PrayerI18n.t(config, "emptyData")));
      return;
    }

    activities.forEach(function (activity) {
      var item = createElement("article", "program-item");
      var details = createElement("div", "program-detail-list");
      var estimate = resolveGregorianEstimate(activity, config, "date");

      item.appendChild(createElement("h3", null, activity.title || window.PrayerI18n.t(config, "mosqueActivity")));
      addProgramDetail(details, window.PrayerI18n.t(config, "gregorianDateLabel"), estimate && estimate.text);
      addProgramDetail(details, window.PrayerI18n.t(config, "hijriDateLabel"), activity.hijriDate);
      addProgramDetail(details, window.PrayerI18n.t(config, "activityTime"), cleanText(activity.time).replace(/:00$/, ""));
      addProgramDetail(details, window.PrayerI18n.t(config, "personInCharge"), activity.personInCharge);
      item.appendChild(details);

      if (hasMeaningfulText(activity.schedule)) {
        item.appendChild(createElement("span", "program-meta", window.PrayerI18n.t(config, "activitySchedule") + ": " + cleanText(activity.schedule)));
      }
      if (activity.description) {
        item.appendChild(createElement("p", null, activity.description));
      }

      container.appendChild(item);
    });
  }

  function renderIslamicPrograms(config) {
    var container = byId("islamicProgramList");
    if (!container) {
      return;
    }

    var worshipDays = getWorshipDays(config);
    setSlideVisible("islamicAgendaSlide", worshipDays.length > 0);
    container.innerHTML = "";
    renderWorshipDaysInto(config, container, worshipDays);
  }

  function renderMosqueActivities(config) {
    var container = byId("mosqueActivityList");
    if (!container) {
      return;
    }

    var activities = getDisplayableActivities(config);
    setSlideVisible("mosqueActivitySlide", activities.length > 0);
    container.innerHTML = "";
    renderActivitiesInto(config, container, activities);
  }

  function getFridayPrayer(config) {
    var programs = config.islamicPrograms || {};
    return programs.fridayPrayer || {};
  }

  function addOfficerRow(config, container, label, value) {
    var row = createElement("div", "officer-row");
    row.appendChild(createElement("span", null, label + ":"));
    row.appendChild(createElement("strong", null, hasMeaningfulText(value) ? cleanText(value) : window.PrayerI18n.t(config, "missingName")));
    container.appendChild(row);
  }

  function renderFridayPrayer(config) {
    var container = byId("fridayOfficerList");
    if (!container) {
      return;
    }

    var fridayPrayer = getFridayPrayer(config);
    var khatib = cleanText(fridayPrayer.khatib);
    var imam = cleanText(fridayPrayer.imam);
    var muadzin = cleanText(fridayPrayer.muadzin);
    var sameKhatibImam = hasMeaningfulText(khatib) && hasMeaningfulText(imam) && khatib.toLowerCase() === imam.toLowerCase();

    container.innerHTML = "";

    if (sameKhatibImam) {
      addOfficerRow(config, container, window.PrayerI18n.t(config, "khatibAndImam"), khatib);
    } else {
      addOfficerRow(config, container, window.PrayerI18n.t(config, "khatib"), khatib);
      addOfficerRow(config, container, window.PrayerI18n.t(config, "imam"), imam);
    }
    addOfficerRow(config, container, window.PrayerI18n.t(config, "muadzin"), muadzin);
  }

  function renderProgramOverlay(config, type, container) {
    if (!container) {
      return false;
    }

    var items = type === "activity" ? getDisplayableActivities(config) : getWorshipDays(config);
    container.innerHTML = "";

    if (!items.length) {
      return false;
    }

    var header = createElement("div", "program-overlay-header");
    header.appendChild(createElement(
      "span",
      null,
      type === "activity" ? window.PrayerI18n.t(config, "overlayActivity") : window.PrayerI18n.t(config, "overlayAgenda")
    ));
    header.appendChild(createElement("strong", null, getMosqueName(config)));
    container.appendChild(header);

    var list = createElement("div", "program-overlay-list");
    if (type === "activity") {
      renderActivitiesInto(config, list, items);
    } else {
      renderWorshipDaysInto(config, list, items);
    }
    container.appendChild(list);

    return true;
  }

  function advanceReminder(config) {
    reminderIndex += 1;
    renderReminders(config);
  }

  function renderAll(config) {
    applyTranslations(config);
    renderHeader(config);
    renderSourceSelect(config);
    renderPrayerCards(config);
    renderMethodComparison(config);
    renderTahajud(config);
    renderCommittees(config);
    renderReminders(config);
    renderSourceList(config);
    renderAstronomy(config);
    renderIslamicPrograms(config);
    renderMosqueActivities(config);
    renderFridayPrayer(config);
    renderClock(config);
  }

  window.PrayerScheduleRenderer = {
    getActiveSource: getActiveSource,
    advanceReminder: advanceReminder,
    getDisplayableActivities: getDisplayableActivities,
    getWorshipDays: getWorshipDays,
    getHijriParts: getHijriParts,
    renderProgramOverlay: renderProgramOverlay,
    renderAll: renderAll,
    renderClock: renderClock,
    renderPrayerCards: renderPrayerCards,
    renderMethodComparison: renderMethodComparison,
    renderTahajud: renderTahajud,
    applyTimeBackground: applyTimeBackground,
    updatePrayerBackground: applyTimeBackground,
    startTimeBackgroundScheduler: startTimeBackgroundScheduler,
    stopTimeBackgroundScheduler: stopTimeBackgroundScheduler,
    resolveTimeBackgroundPhase: resolveTimeBackgroundPhase,
    buildTimeBackgroundTimeline: buildTimeBackgroundTimeline,
    simulateTimeBackgroundPhases: simulateTimeBackgroundPhases
  };
  window.updatePrayerBackground = applyTimeBackground;
})(window);
