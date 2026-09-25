(function (window) {
  "use strict";

  var callbacks = {};
  var currentConfig = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(message, isError) {
    var status = byId("configStatus");
    if (!status) {
      return;
    }

    status.textContent = message || "";
    status.classList.toggle("is-error", Boolean(isError));
  }

  function parseJsonArray(value, fieldName) {
    var parsed;
    try {
      parsed = JSON.parse(value || "[]");
    } catch (error) {
      throw new Error(fieldName + " harus berupa JSON array yang valid.");
    }

    if (!Array.isArray(parsed)) {
      throw new Error(fieldName + " harus berupa JSON array.");
    }

    return parsed;
  }

  function parseJsonObject(value, fieldName) {
    var parsed;
    try {
      parsed = JSON.parse(value || "{}");
    } catch (error) {
      throw new Error(fieldName + " harus berupa JSON object yang valid.");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(fieldName + " harus berupa JSON object.");
    }

    return parsed;
  }

  function committeesToText(committees) {
    return (committees || []).map(function (committee) {
      var names = Array.isArray(committee.names) ? committee.names.join("; ") : "";
      return (committee.position || "Pengurus") + "|" + names;
    }).join("\n");
  }

  function parseCommittees(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean)
      .map(function (line) {
        var separatorIndex = line.indexOf("|");
        var position = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : "Pengurus";
        var namesText = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : line;
        var names = namesText
          .split(";")
          .map(function (name) {
            return name.trim();
          })
          .filter(Boolean);

        return {
          position: position || "Pengurus",
          names: names.length ? names : ["-"]
        };
      });
  }

  function fillForm(config) {
    currentConfig = window.PrayerConfigLoader.normalizeConfig(config);

    if (!byId("configForm")) {
      return;
    }

    byId("userIdInput").value = currentConfig.user.id || "";
    byId("userNameInput").value = currentConfig.user.displayName || "";
    byId("mosqueNameInput").value = (currentConfig.mosque && currentConfig.mosque.name) || "";
    byId("hijriDateInput").value = ((currentConfig.calendar && currentConfig.calendar.hijriDateManual) || (currentConfig.mosque && currentConfig.mosque.hijriDateManual)) || "";
    byId("countryInput").value = (currentConfig.location && currentConfig.location.country) || "";
    byId("provinceInput").value = (currentConfig.location && currentConfig.location.province) || "";
    byId("cityInput").value = (currentConfig.location && currentConfig.location.city) || "";
    byId("backgroundImageInput").value = (currentConfig.display && currentConfig.display.backgroundImage) || "";
    byId("languageInput").value = currentConfig.language || "id";
    byId("committeeInput").value = committeesToText(currentConfig.mosque.committees);
    byId("sourceJsonInput").value = JSON.stringify(currentConfig.scheduleSources, null, 2);
    byId("cardStyleJsonInput").value = JSON.stringify(currentConfig.prayerCards, null, 2);
    byId("reminderJsonInput").value = JSON.stringify(currentConfig.reminders, null, 2);
    byId("astronomyJsonInput").value = JSON.stringify(currentConfig.astronomy, null, 2);
    byId("islamicProgramJsonInput").value = JSON.stringify(currentConfig.islamicPrograms, null, 2);
    byId("forceDisplayJsonInput").value = JSON.stringify(currentConfig.forceDisplay, null, 2);
    byId("configJsonInput").value = JSON.stringify(currentConfig, null, 2);
    renderHistory(currentConfig.user.id);
  }

  function collectFormConfig() {
    var nextConfig = window.PrayerStorage.clone(currentConfig || window.DEFAULT_PRAYER_CONFIG);
    nextConfig.user = nextConfig.user || {};
    nextConfig.location = nextConfig.location || {};
    nextConfig.mosque = nextConfig.mosque || {};
    nextConfig.calendar = nextConfig.calendar || {};
    nextConfig.display = nextConfig.display || {};

    if (!byId("configForm")) {
      return nextConfig;
    }

    nextConfig.user.id = window.PrayerStorage.normalizeUserId(byId("userIdInput").value);
    nextConfig.user.displayName = byId("userNameInput").value.trim() || nextConfig.user.id;
    nextConfig.mosque.name = byId("mosqueNameInput").value.trim() || "Masjid";
    nextConfig.calendar.hijriDateManual = byId("hijriDateInput").value.trim();
    if (nextConfig.calendar.hijriDateManual) {
      var localToday = window.PrayerTimeUtils.getZonedDateParts(new Date(), nextConfig.calendar.timezone || undefined);
      nextConfig.calendar.hijriDateManualEffectiveDate = [localToday.year, window.PrayerTimeUtils.pad(localToday.month), window.PrayerTimeUtils.pad(localToday.day)].join("-");
    } else {
      nextConfig.calendar.hijriDateManualEffectiveDate = "";
    }
    nextConfig.mosque.hijriDateManual = nextConfig.calendar.hijriDateManual;
    nextConfig.location.country = byId("countryInput").value.trim();
    nextConfig.location.province = byId("provinceInput").value.trim();
    nextConfig.location.city = byId("cityInput").value.trim();
    nextConfig.display.backgroundImage = byId("backgroundImageInput").value.trim();
    nextConfig.language = byId("languageInput").value === "en" ? "en" : "id";
    nextConfig.mosque.committees = parseCommittees(byId("committeeInput").value);
    nextConfig.scheduleSources = parseJsonArray(byId("sourceJsonInput").value, "Sumber Waktu Sholat");
    nextConfig.prayerCards = parseJsonObject(byId("cardStyleJsonInput").value, "Frame Waktu Sholat");
    nextConfig.reminders = parseJsonArray(byId("reminderJsonInput").value, "Pengingat Umat");
    nextConfig.astronomy = parseJsonObject(byId("astronomyJsonInput").value, "Posisi Matahari & Bulan");
    nextConfig.islamicPrograms = parseJsonObject(byId("islamicProgramJsonInput").value, "Hari Ibadah & Kegiatan Islam");
    nextConfig.forceDisplay = parseJsonObject(byId("forceDisplayJsonInput").value, "Force Display Countdown");

    return window.PrayerConfigLoader.normalizeConfig(nextConfig);
  }

  function openDrawer() {
    byId("configDrawer").classList.add("is-open");
    byId("drawerBackdrop").classList.add("is-open");
    byId("configDrawer").setAttribute("aria-hidden", "false");
    setStatus("");
  }

  function closeDrawer() {
    byId("configDrawer").classList.remove("is-open");
    byId("drawerBackdrop").classList.remove("is-open");
    byId("configDrawer").setAttribute("aria-hidden", "true");
  }

  function renderHistoryEntries(entries) {
    var container = byId("historyList");
    if (!container) {
      return;
    }

    container.innerHTML = "";

    if (!entries.length) {
      container.appendChild(document.createTextNode("Belum ada riwayat tersimpan."));
      return;
    }

    entries.forEach(function (entry) {
      var row = document.createElement("div");
      row.className = "history-entry";

      var text = document.createElement("div");
      var title = document.createElement("strong");
      title.textContent = entry.mosqueName || "Masjid";
      var meta = document.createElement("span");
      meta.textContent = new Date(entry.savedAt).toLocaleString("id-ID") + (entry.source ? " · " + entry.source : "");
      text.appendChild(title);
      text.appendChild(meta);

      var button = document.createElement("button");
      button.className = "button button-secondary";
      button.type = "button";
      button.textContent = "Muat";
      button.addEventListener("click", function () {
        if (callbacks.onLoadHistory) {
          callbacks.onLoadHistory(entry.config);
        }
      });

      row.appendChild(text);
      row.appendChild(button);
      container.appendChild(row);
    });
  }

  function renderHistory(userId) {
    var localHistory = window.PrayerStorage.loadHistory(userId).map(function (entry) {
      entry.source = entry.source || "Lokal";
      return entry;
    });
    renderHistoryEntries(localHistory);

    if (!window.PrayerApiClient) {
      return;
    }

    window.PrayerApiClient.getConfigHistory(userId, 25)
      .then(function (remoteHistory) {
        if (!Array.isArray(remoteHistory)) {
          return;
        }

        var remoteEntries = remoteHistory.map(function (revision) {
          var remoteConfig = revision && revision.config ? revision.config : {};
          return {
            savedAt: revision.savedAt || remoteConfig.updatedAt || new Date().toISOString(),
            mosqueName: remoteConfig.mosque && remoteConfig.mosque.name,
            location: remoteConfig.location || {},
            config: remoteConfig,
            source: "SQL v" + (revision.version || "?")
          };
        });
        var seen = {};
        var combined = remoteEntries.concat(localHistory).filter(function (entry) {
          var key = [entry.savedAt, entry.mosqueName, entry.source === "Lokal" ? "" : entry.source].join("|");
          if (seen[key]) {
            return false;
          }
          seen[key] = true;
          return true;
        });
        renderHistoryEntries(combined);
      })
      .catch(function () {
        // Local history remains available offline.
      });
  }

  function importJsonFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var imported = JSON.parse(String(reader.result || "{}"));
        var normalized = window.PrayerConfigLoader.normalizeConfig(imported);
        fillForm(normalized);
        if (callbacks.onPreview) {
          callbacks.onPreview(normalized);
        }
        setStatus("JSON berhasil dimuat. Klik Simpan Konfigurasi untuk menyimpan.");
      } catch (error) {
        setStatus(error.message || "JSON tidak valid.", true);
      }
    };
    reader.readAsText(file);
  }

  function bindEvents() {
    var openButton = byId("openConfigButton");
    var closeButton = byId("closeConfigButton");
    var backdrop = byId("drawerBackdrop");
    var form = byId("configForm");
    var loadSampleButton = byId("loadSampleButton");
    var resetButton = byId("resetLocalButton");
    var importButton = byId("importJsonButton");
    var importInput = byId("importJsonInput");

    if (openButton) {
      openButton.addEventListener("click", openDrawer);
    }
    if (closeButton) {
      closeButton.addEventListener("click", closeDrawer);
    }
    if (backdrop) {
      backdrop.addEventListener("click", closeDrawer);
    }

    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        try {
          var nextConfig = collectFormConfig();
          if (callbacks.onSave) {
            callbacks.onSave(nextConfig);
          }
          fillForm(nextConfig);
          setStatus("Konfigurasi tersimpan untuk user " + nextConfig.user.id + ".");
        } catch (error) {
          setStatus(error.message || "Konfigurasi tidak valid.", true);
        }
      });
    }

    if (loadSampleButton) {
      loadSampleButton.addEventListener("click", function () {
        window.PrayerConfigLoader.fetchSampleConfig()
          .catch(function () {
            return window.DEFAULT_PRAYER_CONFIG;
          })
          .then(function (sampleConfig) {
            var normalized = window.PrayerConfigLoader.normalizeConfig(sampleConfig);
            fillForm(normalized);
            if (callbacks.onPreview) {
              callbacks.onPreview(normalized);
            }
            setStatus("Contoh dimuat. Klik Simpan Konfigurasi untuk menyimpan.");
          });
      });
    }

    if (resetButton) {
      resetButton.addEventListener("click", function () {
        if (!currentConfig || !callbacks.onReset) {
          return;
        }

        callbacks.onReset(currentConfig.user.id);
        setStatus("Penyimpanan lokal user ini direset.");
      });
    }

    if (importButton && importInput) {
      importButton.addEventListener("click", function () {
        importInput.click();
      });

      importInput.addEventListener("change", function (event) {
        var file = event.target.files && event.target.files[0];
        if (file) {
          importJsonFile(file);
        }
        event.target.value = "";
      });
    }
  }

  function init(initialConfig, nextCallbacks) {
    callbacks = nextCallbacks || {};
    fillForm(initialConfig);
    bindEvents();
  }

  window.PrayerConfigForm = {
    init: init,
    fillForm: fillForm,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    renderHistory: renderHistory
  };
})(window);
