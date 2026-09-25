(function (window) {
  "use strict";

  function isObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function deepMerge(base, override) {
    var result = window.PrayerStorage.clone(base || {});
    Object.keys(override || {}).forEach(function (key) {
      if (isObject(result[key]) && isObject(override[key])) {
        result[key] = deepMerge(result[key], override[key]);
      } else {
        result[key] = window.PrayerStorage.clone(override[key]);
      }
    });

    return result;
  }

  var VISUAL_ASSET_BASE = "assets/images/bg/";
  var DEFAULT_VISUAL_ASSETS = {
    main: VISUAL_ASSET_BASE + "main-bg.png",
    tahajud: VISUAL_ASSET_BASE + "night-la-9746.png",
    timeBackgrounds: {
      main: VISUAL_ASSET_BASE + "main-bg.png",
      night: VISUAL_ASSET_BASE + "night.png",
      subuh: VISUAL_ASSET_BASE + "subuh.png",
      syuruq: VISUAL_ASSET_BASE + "syuruq.png",
      dhuha: VISUAL_ASSET_BASE + "dhuha-awwal.png",
      istiwa: VISUAL_ASSET_BASE + "istiwa.png",
      zuhur: VISUAL_ASSET_BASE + "dhuhr.png",
      ashar: VISUAL_ASSET_BASE + "ashar.png",
      "late-ashar": VISUAL_ASSET_BASE + "ashar-late.png",
      sunset: VISUAL_ASSET_BASE + "sunset.png",
      maghrib: VISUAL_ASSET_BASE + "maghrib.png",
      isya: VISUAL_ASSET_BASE + "isha.png",
      "night-first-third": VISUAL_ASSET_BASE + "night-fi-6044.png",
      midnight: VISUAL_ASSET_BASE + "midnight.png",
      "last-third-night": VISUAL_ASSET_BASE + "night-la-9746.png"
    },
    prayerCards: {
      maghrib: VISUAL_ASSET_BASE + "maghrib.png",
      isha: VISUAL_ASSET_BASE + "isha.png",
      subuh: VISUAL_ASSET_BASE + "subuh.png",
      syuruq: VISUAL_ASSET_BASE + "syuruq.png",
      dhuhaAwwal: VISUAL_ASSET_BASE + "dhuha-awwal.png",
      dhuhaWoosthaa: VISUAL_ASSET_BASE + "dhuha-wustha.png",
      dhuhaAwwabin: VISUAL_ASSET_BASE + "dhuha-awwabin.png",
      dhuhur: VISUAL_ASSET_BASE + "dhuhr.png",
      ashar: VISUAL_ASSET_BASE + "ashar.png"
    }
  };

  function normalizePrayerCardLabel(key, label) {
    if (key === "dhuhaWoosthaa" && typeof label === "string" && /^(Dhuha|Duha)\s+Wo+stha+a?$/i.test(label.trim())) {
      return label.replace(/Wo+stha+a?/i, "Wustha");
    }

    return label;
  }

  function applyDefaultVisualAssets(config) {
    config.display = config.display || {};
    var usingDefaultMainBackground = !config.display.backgroundImage;
    if (!config.display.backgroundImage) {
      config.display.backgroundImage = DEFAULT_VISUAL_ASSETS.main;
    }
    if (usingDefaultMainBackground && (!config.display.backgroundTone || config.display.backgroundTone === "auto")) {
      config.display.backgroundTone = "dark";
    }
    if (!config.display.tahajudBackgroundImage) {
      config.display.tahajudBackgroundImage = DEFAULT_VISUAL_ASSETS.tahajud;
    } else if (/\/?Tahajud\.png$/i.test(config.display.tahajudBackgroundImage)) {
      config.display.tahajudBackgroundImage = DEFAULT_VISUAL_ASSETS.tahajud;
    }
    if (!config.display.nightLastThirdBackgroundImage || /\/?Tahajud\.png$/i.test(config.display.nightLastThirdBackgroundImage)) {
      config.display.nightLastThirdBackgroundImage = DEFAULT_VISUAL_ASSETS.tahajud;
    }
    config.display.timeBackgroundImages = config.display.timeBackgroundImages || {};
    Object.keys(DEFAULT_VISUAL_ASSETS.timeBackgrounds).forEach(function (key) {
      var fallbackImage = key === "last-third-night" && config.display.nightLastThirdBackgroundImage
        ? config.display.nightLastThirdBackgroundImage
        : DEFAULT_VISUAL_ASSETS.timeBackgrounds[key];
      if (!config.display.timeBackgroundImages[key] || /\/?Tahajud\.png$/i.test(config.display.timeBackgroundImages[key])) {
        config.display.timeBackgroundImages[key] = fallbackImage;
      }
    });
    config.display.timeBackgroundSettings = deepMerge({
      syuruqFallbackMinutes: 18,
      istiwaOffsetBeforeMinutes: 5,
      istiwaOffsetAfterMinutes: 0,
      lateAsharSolarElevation: 6,
      lateAsharFallbackMinutesBeforeMaghrib: 45,
      sunsetFallbackMinutes: 3,
      watchdogIntervalSeconds: 60,
      transitionMs: 850
    }, config.display.timeBackgroundSettings || {});

    config.prayerCards = config.prayerCards || {};
    Object.keys(DEFAULT_VISUAL_ASSETS.prayerCards).forEach(function (key) {
      config.prayerCards[key] = config.prayerCards[key] || {};
      config.prayerCards[key].label = normalizePrayerCardLabel(key, config.prayerCards[key].label);
      if (!config.prayerCards[key].backgroundImage) {
        config.prayerCards[key].backgroundImage = DEFAULT_VISUAL_ASSETS.prayerCards[key];
      }
    });
  }

  function normalizeConfig(config) {
    var merged = deepMerge(window.DEFAULT_PRAYER_CONFIG, config || {});

    merged.user = merged.user || {};
    merged.user.id = window.PrayerStorage.normalizeUserId(merged.user.id);
    merged.user.displayName = merged.user.displayName || merged.user.id;
    merged.location = merged.location || {};
    merged.mosque = merged.mosque || {};
    merged.mosque.committees = Array.isArray(merged.mosque.committees) ? merged.mosque.committees : [];
    merged.calendar = merged.calendar || {};
    merged.language = merged.language === "en" ? "en" : "id";
    merged.calendar.locale = merged.language === "en" ? "en-US" : "id-ID";
    merged.calendar.hijriCalendar = ["islamic-umalqura", "islamic", "islamic-civil"].indexOf(merged.calendar.hijriCalendar) >= 0 ? merged.calendar.hijriCalendar : "islamic-umalqura";
    merged.calendar.hijriAdjustmentDays = Math.max(-2, Math.min(2, Math.round(Number(merged.calendar.hijriAdjustmentDays || 0))));
    merged.calendar.hijriDateManualEffectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(String(merged.calendar.hijriDateManualEffectiveDate || "")) ? merged.calendar.hijriDateManualEffectiveDate : "";
    merged.display = merged.display || {};
    applyDefaultVisualAssets(merged);
    merged.forceDisplay = deepMerge(window.DEFAULT_PRAYER_CONFIG.forceDisplay, merged.forceDisplay || {});
    merged.forceDisplay.enabled = merged.forceDisplay.enabled !== false;
    merged.forceDisplay.preAdzanMinutes = Number(merged.forceDisplay.preAdzanMinutes);
    merged.forceDisplay.iqomahDelayMinutes = Number(merged.forceDisplay.iqomahDelayMinutes);
    merged.forceDisplay.prayerDurationMinutes = Number(merged.forceDisplay.prayerDurationMinutes);
    if (!Number.isFinite(merged.forceDisplay.preAdzanMinutes)) {
      merged.forceDisplay.preAdzanMinutes = window.DEFAULT_PRAYER_CONFIG.forceDisplay.preAdzanMinutes;
    }
    if (!Number.isFinite(merged.forceDisplay.iqomahDelayMinutes)) {
      merged.forceDisplay.iqomahDelayMinutes = window.DEFAULT_PRAYER_CONFIG.forceDisplay.iqomahDelayMinutes;
    }
    if (!Number.isFinite(merged.forceDisplay.prayerDurationMinutes)) {
      merged.forceDisplay.prayerDurationMinutes = window.DEFAULT_PRAYER_CONFIG.forceDisplay.prayerDurationMinutes;
    }
    merged.forceDisplay.includedPrayers = Array.isArray(merged.forceDisplay.includedPrayers)
      ? merged.forceDisplay.includedPrayers
      : window.DEFAULT_PRAYER_CONFIG.forceDisplay.includedPrayers.slice();
    merged.prayerOrder = Array.isArray(merged.prayerOrder) && merged.prayerOrder.length
      ? merged.prayerOrder
      : window.DEFAULT_PRAYER_CONFIG.prayerOrder.slice();
    if (merged.prayerOrder.indexOf("syuruq") === -1) {
      var subuhIndex = merged.prayerOrder.indexOf("subuh");
      merged.prayerOrder.splice(subuhIndex >= 0 ? subuhIndex + 1 : merged.prayerOrder.length, 0, "syuruq");
    }
    merged.prayerCards = merged.prayerCards || {};
    merged.scheduleSources = Array.isArray(merged.scheduleSources) ? merged.scheduleSources : [];
    merged.reminders = Array.isArray(merged.reminders) ? merged.reminders : [];
    if (merged.reminders.length <= 3) {
      var existingReminderKeys = merged.reminders.map(function (reminder) {
        return [reminder && reminder.type, reminder && reminder.title, reminder && reminder.reference].join("|");
      });

      window.DEFAULT_PRAYER_CONFIG.reminders.forEach(function (defaultReminder) {
        var key = [defaultReminder.type, defaultReminder.title, defaultReminder.reference].join("|");
        if (existingReminderKeys.indexOf(key) === -1) {
          merged.reminders.push(window.PrayerStorage.clone(defaultReminder));
        }
      });
    }
    merged.reminders = merged.reminders.map(function (reminder) {
      if (!reminder || typeof reminder !== "object") {
        return reminder;
      }

      var defaultReminder = window.DEFAULT_PRAYER_CONFIG.reminders.find(function (candidate) {
        return candidate.type === reminder.type
          && (candidate.reference === reminder.reference || candidate.title === reminder.title);
      });

      if (!defaultReminder || reminder.arabicText || !defaultReminder.arabicText) {
        return reminder;
      }

      reminder.arabicText = defaultReminder.arabicText;
      return reminder;
    });
    merged.astronomy = merged.astronomy || {};
    merged.astronomy.sun = merged.astronomy.sun || {};
    merged.astronomy.moon = merged.astronomy.moon || {};
    merged.astronomy.eclipse = merged.astronomy.eclipse || {};
    merged.astronomy.eclipse.solar = merged.astronomy.eclipse.solar || {};
    merged.astronomy.eclipse.lunar = merged.astronomy.eclipse.lunar || {};
    merged.islamicPrograms = merged.islamicPrograms || {};
    merged.islamicPrograms.fridayPrayer = merged.islamicPrograms.fridayPrayer || {};
    merged.islamicPrograms.worshipDays = Array.isArray(merged.islamicPrograms.worshipDays)
      ? merged.islamicPrograms.worshipDays
      : [];
    merged.islamicPrograms.activities = Array.isArray(merged.islamicPrograms.activities)
      ? merged.islamicPrograms.activities
      : [];

    var oldWorshipTemplate = merged.islamicPrograms.worshipDays.some(function (item) {
      return ["Puasa Senin", "Puasa Kamis", "Ayyamul Bidh"].indexOf(item.title) >= 0;
    });
    if (oldWorshipTemplate && merged.islamicPrograms.worshipDays.length <= 3) {
      merged.islamicPrograms.worshipDays = window.PrayerStorage.clone(window.DEFAULT_PRAYER_CONFIG.islamicPrograms.worshipDays);
    }

    var oldActivityTemplate = merged.islamicPrograms.activities.some(function (item) {
      return ["Sholat Jumat", "Kajian Maghrib", "Tadarus Al-Quran"].indexOf(item.title) >= 0;
    });
    if (oldActivityTemplate && merged.islamicPrograms.activities.length <= 3) {
      merged.islamicPrograms.activities = window.PrayerStorage.clone(window.DEFAULT_PRAYER_CONFIG.islamicPrograms.activities);
    }

    if (!merged.scheduleSources.length) {
      merged.scheduleSources = window.PrayerStorage.clone(window.DEFAULT_PRAYER_CONFIG.scheduleSources);
    }

    merged.scheduleSources = merged.scheduleSources.map(function (source, index) {
      var defaultSource = window.DEFAULT_PRAYER_CONFIG.scheduleSources.find(function (candidate) {
        return candidate.id === source.id;
      }) || window.DEFAULT_PRAYER_CONFIG.scheduleSources[index] || window.DEFAULT_PRAYER_CONFIG.scheduleSources[0];

      source.times = source.times || {};
      Object.keys(window.DEFAULT_PRAYER_CONFIG.prayerCards).forEach(function (key) {
        if (!source.times[key] && defaultSource && defaultSource.times) {
          source.times[key] = defaultSource.times[key] || "";
        }
      });
      return source;
    });

    var hasActiveSource = merged.scheduleSources.some(function (source) {
      return source.id === merged.activeSourceId;
    });

    if (!hasActiveSource) {
      merged.activeSourceId = merged.scheduleSources[0].id;
    }

    return merged;
  }

  function fetchSampleConfig() {
    return fetch(window.PRAYER_CONFIG_DATA_URL, {
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Gagal membaca JSON contoh");
      }
      return response.json();
    });
  }

  function timestamp(config) {
    var value = config && config.updatedAt ? Date.parse(config.updatedAt) : NaN;
    return Number.isFinite(value) ? value : 0;
  }

  function fetchServerConfig(userId) {
    if (!window.PrayerApiClient) {
      return Promise.resolve(null);
    }

    return window.PrayerApiClient.getCurrentConfig(userId)
      .catch(function () {
        return null;
      });
  }

  function loadInitialConfig() {
    var defaultConfig = window.PrayerStorage.clone(window.DEFAULT_PRAYER_CONFIG);
    return fetchSampleConfig()
      .catch(function () {
        return defaultConfig;
      })
      .then(function (sampleConfig) {
        var seedConfig = normalizeConfig(sampleConfig);
        var activeUserId = window.PrayerStorage.getActiveUserId() || seedConfig.user.id;
        var storedConfig = window.PrayerStorage.loadLatest(activeUserId);
        return fetchServerConfig(activeUserId).then(function (serverRevision) {
          var serverConfig = serverRevision && serverRevision.config
            ? normalizeConfig(serverRevision.config)
            : null;
          var localConfig = storedConfig ? normalizeConfig(storedConfig) : null;

          if (serverConfig && (!localConfig || timestamp(serverConfig) >= timestamp(localConfig))) {
            window.PrayerStorage.cacheRemoteConfig(serverConfig);
            return serverConfig;
          }

          if (localConfig) {
            if (window.PrayerSyncManager) {
              try {
                window.PrayerSyncManager.queueConfig(localConfig, { source: "startup-recovery" });
              } catch (error) {
                // The local cache is still usable if its outbox is full.
              }
            }
            return localConfig;
          }

          return seedConfig;
        });
      });
  }

  window.PrayerConfigLoader = {
    deepMerge: deepMerge,
    normalizeConfig: normalizeConfig,
    fetchSampleConfig: fetchSampleConfig,
    fetchServerConfig: fetchServerConfig,
    loadInitialConfig: loadInitialConfig
  };
})(window);
