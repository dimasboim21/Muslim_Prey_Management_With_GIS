(function (window, document) {
  "use strict";

  function actualNow() {
    return window.MpmActualTime && typeof window.MpmActualTime.now === "function"
      ? window.MpmActualTime.now()
      : new Date();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function getPrayerLabel(config, key) {
    return (config.prayerCards && config.prayerCards[key] && config.prayerCards[key].label)
      || window.PrayerTimeUtils.labels[key]
      || key;
  }

  function getForceConfig(config) {
    var fallback = window.DEFAULT_PRAYER_CONFIG.forceDisplay || {};
    var forceDisplay = config.forceDisplay || {};
    return {
      enabled: forceDisplay.enabled !== false,
      preAdzanMinutes: Number.isFinite(Number(forceDisplay.preAdzanMinutes))
        ? Number(forceDisplay.preAdzanMinutes)
        : fallback.preAdzanMinutes,
      iqomahDelayMinutes: Number.isFinite(Number(forceDisplay.iqomahDelayMinutes))
        ? Number(forceDisplay.iqomahDelayMinutes)
        : fallback.iqomahDelayMinutes,
      prayerDurationMinutes: Number.isFinite(Number(forceDisplay.prayerDurationMinutes))
        ? Number(forceDisplay.prayerDurationMinutes)
        : fallback.prayerDurationMinutes,
      includedPrayers: Array.isArray(forceDisplay.includedPrayers) && forceDisplay.includedPrayers.length
        ? forceDisplay.includedPrayers
        : fallback.includedPrayers
    };
  }

  function findActiveStage(config, now) {
    var forceConfig = getForceConfig(config);
    if (!forceConfig.enabled) {
      return null;
    }

    var source = window.PrayerScheduleRenderer.getActiveSource(config);
    if (!source || !source.times) {
      return null;
    }

    var timezone = (config.calendar && config.calendar.timezone) || source.timezone;
    var currentSeconds = window.PrayerTimeUtils.getCurrentMinuteNumber(now, timezone) * 60;
    var candidates = [];

    forceConfig.includedPrayers.forEach(function (key) {
      var prayerMinutes = window.PrayerTimeUtils.parseTimeToMinutes(source.times[key]);
      if (prayerMinutes === null) {
        return;
      }

      [-1440, 0, 1440].forEach(function (offsetMinutes) {
        var prayerSeconds = (prayerMinutes + offsetMinutes) * 60;
        var adzanStart = prayerSeconds - forceConfig.preAdzanMinutes * 60;
        var iqomahAt = prayerSeconds + forceConfig.iqomahDelayMinutes * 60;
        var prayerEnd = iqomahAt + forceConfig.prayerDurationMinutes * 60;

        if (currentSeconds >= adzanStart && currentSeconds < prayerSeconds) {
          candidates.push({
            key: key,
            stage: "adzan",
            targetSeconds: prayerSeconds,
            endSeconds: prayerSeconds
          });
        } else if (currentSeconds >= prayerSeconds && currentSeconds < iqomahAt) {
          candidates.push({
            key: key,
            stage: "iqomah",
            targetSeconds: iqomahAt,
            endSeconds: iqomahAt
          });
        } else if (currentSeconds >= iqomahAt && currentSeconds < prayerEnd) {
          candidates.push({
            key: key,
            stage: "prayer",
            targetSeconds: prayerEnd,
            endSeconds: prayerEnd
          });
        }
      });
    });

    if (!candidates.length) {
      return null;
    }

    candidates.sort(function (a, b) {
      return a.endSeconds - b.endSeconds;
    });

    return Object.assign({}, candidates[0], {
      secondsRemaining: Math.max(0, candidates[0].targetSeconds - currentSeconds),
      sourceName: source.name
    });
  }

  function getStageText(config, stage) {
    if (stage === "iqomah") {
      return {
        label: window.PrayerI18n.t(config, "iqomahStage"),
        message: window.PrayerI18n.t(config, "iqomahMessage")
      };
    }

    if (stage === "prayer") {
      return {
        label: window.PrayerI18n.t(config, "prayerStage"),
        message: window.PrayerI18n.t(config, "prayerMessage")
      };
    }

    return {
      label: window.PrayerI18n.t(config, "adzanStage"),
      message: window.PrayerI18n.t(config, "adzanMessage")
    };
  }

  function hide() {
    var overlay = byId("forceCountdown");
    if (!overlay) {
      return;
    }

    overlay.classList.remove("is-active");
    overlay.setAttribute("aria-hidden", "true");
  }

  function update(config) {
    var overlay = byId("forceCountdown");
    if (!overlay) {
      return null;
    }

    var activeStage = findActiveStage(config, actualNow());
    if (!activeStage) {
      hide();
      return null;
    }

    var text = getStageText(config, activeStage.stage);
    byId("forceStageLabel").textContent = text.label;
    byId("forcePrayerName").textContent = getPrayerLabel(config, activeStage.key);
    byId("forceCountdownTime").textContent = window.PrayerTimeUtils.formatSeconds(activeStage.secondsRemaining);
    byId("forceCountdownTime").setAttribute("datetime", window.PrayerTimeUtils.formatSeconds(activeStage.secondsRemaining));
    byId("forceMessage").textContent = text.message + " " + window.PrayerI18n.t(config, "returnMessage");
    byId("forceMeta").textContent = activeStage.sourceName || "";

    overlay.classList.add("is-active");
    overlay.setAttribute("aria-hidden", "false");
    return activeStage;
  }

  window.PrayerForceCountdown = {
    findActiveStage: findActiveStage,
    update: update,
    hide: hide
  };
})(window, document);
