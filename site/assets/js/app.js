(function (window, document) {
  "use strict";

  var config = null;
  var clockTimer = null;
  var slideTimer = null;
  var activeSlideIndex = 0;
  var slideIntervalMs = 15000;
  var lastShownSlideId = "";
  var reminderHasBeenShown = false;

  function actualNow() {
    return window.MpmActualTime && typeof window.MpmActualTime.now === "function"
      ? window.MpmActualTime.now()
      : new Date();
  }

  function prayerRuntimeSnapshot() {
    if (!config) {
      return null;
    }
    var now = actualNow();
    var activeSource = window.PrayerScheduleRenderer.getActiveSource(config);
    var timezone = (config.calendar && config.calendar.timezone)
      || (activeSource && activeSource.timezone)
      || "Asia/Jakarta";
    var nextPrayerLabel = document.getElementById("nextPrayerLabel");
    var nextPrayerTime = document.getElementById("nextPrayerTime");
    var nextPrayerCountdown = document.getElementById("nextPrayerCountdown");
    return {
      capturedAt: now.toISOString(),
      configUpdatedAt: config.updatedAt || null,
      timezone: timezone,
      language: window.PrayerI18n.getLanguage(config),
      pageKey: "index",
      clockText: window.PrayerTimeUtils.getClockText(now, timezone),
      gregorianDate: window.PrayerTimeUtils.getGregorianDate(now, config),
      hijriDate: window.PrayerTimeUtils.getHijriDate(now, config),
      hijriParts: window.PrayerScheduleRenderer.getHijriParts ? window.PrayerScheduleRenderer.getHijriParts(now, config) : null,
      activeSourceId: config.activeSourceId || null,
      activeSource: activeSource,
      prayerTimes: Object.assign({}, activeSource && activeSource.times || {}),
      nextPrayerLabel: nextPrayerLabel ? nextPrayerLabel.textContent.trim() : "",
      nextPrayerTime: nextPrayerTime ? nextPrayerTime.textContent.trim() : "",
      nextPrayerCountdown: nextPrayerCountdown ? nextPrayerCountdown.textContent.trim() : "",
      prayerOrder: Array.isArray(config.prayerOrder) ? config.prayerOrder.slice() : [],
      location: Object.assign({}, config.location || {}),
      mosque: Object.assign({}, config.mosque || {}),
      astronomy: Object.assign({}, config.astronomy || {}),
      calendar: Object.assign({}, config.calendar || {}),
      programs: Array.isArray(config.programs) ? config.programs.slice() : [],
      reminders: Array.isArray(config.reminders) ? config.reminders.slice() : [],
      weather: Object.assign({}, config.weather || {}),
      webgis: Object.assign({}, config.webgis || config.map || {}),
      externalEvents: Array.isArray(config.externalEvents) ? config.externalEvents.slice() : [],
      astronomicalEvents: Array.isArray(config.astronomicalEvents) ? config.astronomicalEvents.slice() : []
    };
  }

  function prayerRuntimeSnapshotAt(date) {
    var snapshot = prayerRuntimeSnapshot();
    if (!snapshot) {
      return null;
    }
    var simulated = date instanceof Date ? new Date(date.getTime()) : new Date(date);
    if (!Number.isFinite(simulated.getTime())) {
      return snapshot;
    }
    snapshot.capturedAt = simulated.toISOString();
    snapshot.clockText = window.PrayerTimeUtils.getClockText(simulated, snapshot.timezone);
    snapshot.gregorianDate = window.PrayerTimeUtils.getGregorianDate(simulated, config);
    snapshot.hijriDate = window.PrayerTimeUtils.getHijriDate(simulated, config);
    snapshot.hijriParts = window.PrayerScheduleRenderer.getHijriParts
      ? window.PrayerScheduleRenderer.getHijriParts(simulated, config)
      : null;
    return snapshot;
  }

  function publishPrayerRuntime() {
    window.dispatchEvent(new CustomEvent("mpm:prayer-runtime-updated", {
      detail: prayerRuntimeSnapshot()
    }));
  }

  window.PrayerDashboardRuntime = {
    getSnapshot: prayerRuntimeSnapshot,
    getSnapshotAt: prayerRuntimeSnapshotAt,
    getConfig: function () { return config; }
  };

  function updateSyncStatus(detail) {
    var element = document.getElementById("syncStatus");
    if (!element) {
      return;
    }

    var pending = Number(detail && detail.pending || 0);
    var isFileMode = Boolean(window.PrayerRuntime && window.PrayerRuntime.isFileMode);
    element.classList.toggle("is-pending", pending > 0);
    element.classList.toggle("is-online", !isFileMode && pending === 0);

    if (isFileMode) {
      element.textContent = window.PrayerI18n.t(config || {}, "fileOfflineMode");
    } else if (pending > 0) {
      element.textContent = window.PrayerI18n.t(config || {}, "waitingSync") + ": " + pending;
    } else {
      element.textContent = window.PrayerI18n.t(config || {}, "synced");
    }
  }

  function applyDatabaseMosqueData(databaseData) {
    if (!databaseData || !config) {
      return;
    }

    var location = databaseData.location || {};
    var mosque = databaseData.mosque || {};
    var schedule = databaseData.schedule || null;
    config.location = config.location || {};
    config.location.country = location.country || config.location.country || "";
    config.location.province = location.province || config.location.province || "";
    config.location.city = location.city || config.location.city || "";
    config.location.continent = location.continent || config.location.continent || "";
    config.location.adm0 = location.adm0 || config.location.adm0 || config.location.country || "";
    config.location.adm1 = location.adm1 || config.location.adm1 || config.location.province || "";
    config.location.adm2 = location.adm2 || config.location.adm2 || config.location.city || "";
    if (Number.isFinite(Number(location.latitude))) {
      config.location.latitude = Number(location.latitude);
    }
    if (Number.isFinite(Number(location.longitude))) {
      config.location.longitude = Number(location.longitude);
    }
    config.location.coordinateSource = location.coordinateSource || config.location.coordinateSource || "";
    config.location.timezone = location.timezone || config.location.timezone || "Asia/Jakarta";

    config.mosque = config.mosque || {};
    config.mosque.buildingIdentifier = mosque.buildingIdentifier || "";
    config.mosque.id = location.id || mosque.id || config.mosque.id || null;
    config.mosque.name = mosque.name || config.mosque.name || "Masjid";
    config.mosque.officialAddress = mosque.officialAddress || config.mosque.officialAddress || "";
    config.mosque.additionalInfo = mosque.additionalInfo || config.mosque.additionalInfo || "";
    config.mosque.hijriDateManual = mosque.hijriDateManual || config.mosque.hijriDateManual || "";
    config.calendar = config.calendar || {};
    config.calendar.timezone = location.timezone || config.calendar.timezone || "Asia/Jakarta";
    config.calendar.hijriDate = mosque.hijriDateManual || config.calendar.hijriDate || "";
    config.calendar.hijriDateManual = mosque.hijriDateManual || config.calendar.hijriDateManual || config.calendar.hijriDate || "";
    if (window.MpmTimeCoordinateCalibration) {
      window.MpmTimeCoordinateCalibration.setBuildingCoordinate({
        name: config.mosque.name || "Active building",
        latitude: config.location.latitude,
        longitude: config.location.longitude,
        elevation: location.elevation,
        coordinateSource: config.location.coordinateSource || "active-mosque-database",
        accuracy: location.coordinateAccuracy,
        accuracyNote: location.accuracyOrNote || location.coordinateAccuracyNote,
        confirmedByUser: Boolean(location.confirmedByUser || location.coordinateConfirmedAt),
        coordinateStatus: location.confirmedByUser || location.coordinateConfirmedAt ? "verified" : "unverified",
        timezone: config.location.timezone,
        timestamp: location.updatedAt || databaseData.updatedAt
      });
    }

    if (schedule && Array.isArray(schedule.sources) && schedule.sources.length) {
      // The public display has room for at most three Falak methods. Preserve
      // the viewer's current choice while it is still one of the configured
      // methods; the configured primary is used for first load or after a
      // method has been removed in Prayer Engine.
      var publishedSources = schedule.sources.slice(0, 3);
      var previousSourceId = config.activeSourceId;
      var previousStillPublished = publishedSources.some(function (source) {
        return source && source.id === previousSourceId;
      });
      config.scheduleSources = publishedSources;
      config.activeSourceId = previousStillPublished
        ? previousSourceId
        : (schedule.activeSourceId || publishedSources[0].id || previousSourceId);
      config.prayerOrder = config.prayerOrder || window.DEFAULT_PRAYER_CONFIG.prayerOrder;
    }

    config.updatedAt = actualNow().toISOString();
  }

  function render() {
    window.PrayerScheduleRenderer.renderAll(config);
    window.BackgroundContrast.apply(document.body, config);
    if (window.PrayerScheduleRenderer.startTimeBackgroundScheduler) {
      window.PrayerScheduleRenderer.startTimeBackgroundScheduler(config);
    } else {
      window.PrayerScheduleRenderer.applyTimeBackground(config);
    }
    var activeStage = window.PrayerForceCountdown.update(config);
    initInfoCarousel();
    updateProgramOverlay(activeStage);

    var location = (config && config.location) || {};
    var mosque = (config && config.mosque) || {};
    var locationText = [location.city, location.province, location.country].filter(Boolean).join(", ");

    var mosqueNameElement = document.getElementById("mosqueName");
    if (mosqueNameElement) {
      mosqueNameElement.textContent = mosque.name || "Building aktif";
    }

    var locationTextElement = document.getElementById("locationText");
    if (locationTextElement) {
      locationTextElement.textContent = locationText || "Lokasi belum diisi";
    }

    var countryTextElement = document.getElementById("countryText");
    if (countryTextElement) {
      countryTextElement.textContent = location.country || "-";
    }

    var provinceTextElement = document.getElementById("provinceText");
    if (provinceTextElement) {
      provinceTextElement.textContent = location.province || "-";
    }

    var cityTextElement = document.getElementById("cityText");
    if (cityTextElement) {
      cityTextElement.textContent = location.city || "-";
    }

    var hijriDateElement = document.getElementById("hijriDate");
    if (hijriDateElement) {
      hijriDateElement.textContent = window.PrayerTimeUtils.getHijriDate(actualNow(), config);
    }

    var mosqueAddressElement = document.getElementById("mosqueAddress");
    if (mosqueAddressElement) {
      mosqueAddressElement.textContent = mosque.officialAddress || mosque.address || location.address || window.PrayerI18n.t(config || {}, "addressEmpty");
    }
    publishPrayerRuntime();
  }

  function saveAndRender(nextConfig, options) {
    config = window.PrayerConfigLoader.normalizeConfig(nextConfig);
    config = window.PrayerStorage.saveConfig(config, options || {});
    if (window.PrayerActivityLogger) {
      window.PrayerActivityLogger.record("configuration.local-saved", config, {
        source: (options && options.source) || "dashboard"
      });
    }
    render();
    window.PrayerConfigForm.fillForm(config);
  }

  function previewConfig(nextConfig) {
    config = window.PrayerConfigLoader.normalizeConfig(nextConfig);
    render();
  }

  function resetLocal(userId) {
    window.PrayerStorage.clearUser(userId);
    config = window.PrayerStorage.clone(window.DEFAULT_PRAYER_CONFIG);
    config.user.id = window.PrayerStorage.normalizeUserId(userId);
    config.user.displayName = config.user.id;
    config = window.PrayerConfigLoader.normalizeConfig(config);
    render();
    window.PrayerConfigForm.fillForm(config);
  }

  function refreshFromDatabase() {
    window.fetch("api/active-mosque.php" + (window.MpmBuildingLinks?.requested() ? "?building=" + encodeURIComponent(window.MpmBuildingLinks.requested()) : ""), { cache: "no-store" })
      .then(function (response) {
        return response.json().then(function (json) {
          if (!response.ok || !json || json.success === false) {
            return null;
          }
          return json.data || null;
        });
      })
      .catch(function () {
        return null;
      })
      .then(function (databaseData) {
        if (databaseData) {
          applyDatabaseMosqueData(databaseData);
          render();
        }
      });
  }

  function bindGlobalEvents() {
    var sourceSelect = document.getElementById("activeSourceSelect");
    sourceSelect.addEventListener("change", function (event) {
      config.activeSourceId = event.target.value;
      config = window.PrayerStorage.saveConfig(config, {
        skipHistory: true,
        source: "prayer-source.changed"
      });
      if (window.PrayerActivityLogger) {
        window.PrayerActivityLogger.record("prayer-source.changed", config, {
          sourceId: config.activeSourceId
        });
      }
      render();
      window.PrayerConfigForm.fillForm(config);
    });

    var exportButton = document.getElementById("exportJsonButton");
    if (exportButton) {
      exportButton.addEventListener("click", function () {
        window.PrayerStorage.exportToFile(config);
        if (window.PrayerActivityLogger) {
          window.PrayerActivityLogger.record("configuration.exported", config, {});
        }
      });
    }

    window.addEventListener("prayer:sync-status", function (event) {
      updateSyncStatus(event.detail || {});
    });

    window.addEventListener("mpm:mosque-updated", function () {
      refreshFromDatabase();
    });

    window.addEventListener("storage", function (event) {
      if (event.key === "mpm:mosque-updated") {
        refreshFromDatabase();
      }
    });

    window.setInterval(function () {
      refreshFromDatabase();
    }, 4000);

    updateSyncStatus({
      pending: window.PrayerSyncManager ? window.PrayerSyncManager.pendingCount() : 0
    });

    initInfoCarousel();
  }

  function getSlides() {
    return Array.prototype.slice.call(document.querySelectorAll(".info-slide")).filter(function (slide) {
      return !slide.hidden;
    });
  }

  function showSlide(index) {
    var slides = getSlides();
    var track = document.getElementById("carouselTrack");
    var title = document.getElementById("slideTitle");
    var counter = document.getElementById("slideCounter");

    if (!slides.length || !track) {
      return;
    }

    activeSlideIndex = ((index % slides.length) + slides.length) % slides.length;
    track.style.transform = "translateX(-" + (activeSlideIndex * 100) + "%)";

    if (slides[activeSlideIndex].id === "reminderSlide" && lastShownSlideId !== "reminderSlide") {
      if (reminderHasBeenShown) {
        window.PrayerScheduleRenderer.advanceReminder(config);
      }
      reminderHasBeenShown = true;
    }

    if (title) {
      title.textContent = slides[activeSlideIndex].getAttribute("data-slide-title") || window.PrayerI18n.t(config, "infoLabel");
    }
    if (counter) {
      counter.textContent = (activeSlideIndex + 1) + "/" + slides.length;
    }

    document.querySelectorAll(".slide-dot").forEach(function (dot, dotIndex) {
      dot.classList.toggle("is-active", dotIndex === activeSlideIndex);
      dot.setAttribute("aria-current", dotIndex === activeSlideIndex ? "true" : "false");
    });

    lastShownSlideId = slides[activeSlideIndex].id || "";
  }

  function restartSlideTimer() {
    if (slideTimer) {
      window.clearInterval(slideTimer);
    }

    slideTimer = window.setInterval(function () {
      showSlide(activeSlideIndex + 1);
    }, slideIntervalMs);
  }

  function initInfoCarousel() {
    var slides = getSlides();
    var dots = document.getElementById("slideDots");
    if (!slides.length || !dots) {
      return;
    }

    dots.innerHTML = "";
    slides.forEach(function (slide, index) {
      var button = document.createElement("button");
      button.className = "slide-dot";
      button.type = "button";
      button.setAttribute("aria-label", window.PrayerI18n.t(config, "showSlide") + " " + (slide.getAttribute("data-slide-title") || ("slide " + (index + 1))));
      button.addEventListener("click", function () {
        showSlide(index);
        restartSlideTimer();
      });
      dots.appendChild(button);
    });

    showSlide(activeSlideIndex);
    restartSlideTimer();
  }

  function hideProgramOverlay() {
    var overlay = document.getElementById("programOverlay");
    if (!overlay) {
      return;
    }

    overlay.classList.remove("is-active");
    overlay.setAttribute("aria-hidden", "true");
  }

  function updateProgramOverlay(activeStage) {
    var overlay = document.getElementById("programOverlay");
    var content = document.getElementById("programOverlayContent");
    if (!overlay || !content) {
      return;
    }

    if (activeStage) {
      hideProgramOverlay();
      return;
    }

    var seconds = actualNow().getSeconds();
    var type = null;
    if (seconds < 20) {
      type = "agenda";
    } else if (seconds < 40) {
      type = "activity";
    }

    if (!type) {
      hideProgramOverlay();
      return;
    }

    var hasContent = window.PrayerScheduleRenderer.renderProgramOverlay(config, type, content);
    if (!hasContent) {
      hideProgramOverlay();
      return;
    }

    overlay.classList.add("is-active");
    overlay.setAttribute("aria-hidden", "false");
  }

  function startClock() {
    if (clockTimer) {
      window.clearInterval(clockTimer);
    }

    window.PrayerScheduleRenderer.renderClock(config);
    updateProgramOverlay(window.PrayerForceCountdown.update(config));
    clockTimer = window.setInterval(function () {
      window.PrayerScheduleRenderer.renderClock(config);
      window.PrayerScheduleRenderer.renderPrayerCards(config);
      updateProgramOverlay(window.PrayerForceCountdown.update(config));
    }, 1000);
  }

  function boot() {
    window.PrayerConfigLoader.loadInitialConfig().then(function (initialConfig) {
      config = initialConfig;
      return (window.PrayerI18n && window.PrayerI18n.load ? window.PrayerI18n.load() : Promise.resolve()).then(function () {
        return config;
      });
    }).then(function () {
      if(window.IndexBuildingGate?.data) return window.IndexBuildingGate.data;
      return window.fetch("api/active-mosque.php" + (window.MpmBuildingLinks?.requested() ? "?building=" + encodeURIComponent(window.MpmBuildingLinks.requested()) : ""), { cache: "no-store" })
        .then(function (response) {
          return response.json().then(function (json) {
            if (!response.ok || !json || json.success === false) {
              return null;
            }
            return json.data || null;
          });
        })
        .catch(function () {
          return null;
        });
    }).then(function (databaseData) {
      if (databaseData) {
        applyDatabaseMosqueData(databaseData);
      }
      render();
      window.setTimeout(function () {
        render();
      }, 350);
      if (window.PrayerActivityLogger) {
        window.PrayerActivityLogger.record("dashboard.opened", config, {
          fileMode: Boolean(window.PrayerRuntime && window.PrayerRuntime.isFileMode)
        });
      }
      bindGlobalEvents();
      window.PrayerConfigForm.init(config, {
        onSave: function (nextConfig) {
          saveAndRender(nextConfig, { source: "configuration-form" });
        },
        onPreview: previewConfig,
        onReset: resetLocal,
        onLoadHistory: function (historyConfig) {
          saveAndRender(historyConfig, {
            skipHistory: true
          });
        }
      });
      startClock();
      window.dispatchEvent(new Event("mpm:index-ready"));
    });
  }

  window.addEventListener("mpm:actual-time-status", function () {
    if (!config) {
      return;
    }
    render();
    startClock();
  });

  window.addEventListener('mpm:language-changed', function () { if (config) { render(); startClock(); } });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window, document);
