(function (window) {
  "use strict";

  var ACTIVE_USER_KEY = "prayer-dashboard:active-user";
  var USER_INDEX_KEY = "prayer-dashboard:user-index";
  var MAX_HISTORY = 25;
  var QUOTA_HISTORY_LIMITS = [10, 5, 1];
  var memoryLatest = Object.create(null);
  var memoryHistory = Object.create(null);
  var lastWriteStatus = {
    mode: "idle",
    latestPersisted: false,
    historyPersisted: false,
    quotaExceeded: false,
    error: "",
    updatedAt: ""
  };
  var DELETED_CONTEXT_MARKERS = [
    "masjid al-ikhlas",
    "masjid al ikhlas",
    "al-ikhlas",
    "al ikhlas",
    "kalimantan tengah",
    "kabupaten katingan",
    "katingan"
  ];

  function canUseStorage() {
    try {
      var probeKey = "prayer-dashboard:probe";
      window.localStorage.setItem(probeKey, "1");
      window.localStorage.removeItem(probeKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  function storageGetItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function storageRemoveItem(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function storageSetItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: error };
    }
  }

  function isQuotaError(error) {
    return Boolean(error && (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22 ||
      error.code === 1014
    ));
  }

  function updateWriteStatus(changes) {
    lastWriteStatus = Object.assign({}, lastWriteStatus, changes || {}, {
      updatedAt: new Date().toISOString()
    });
  }

  function writeStatusSnapshot() {
    return Object.assign({}, lastWriteStatus);
  }

  function safeParse(value, fallback) {
    if (!value) {
      return fallback;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function containsDeletedContext(value) {
    var text = "";
    try {
      text = typeof value === "string" ? value : JSON.stringify(value);
    } catch (error) {
      text = "";
    }
    text = String(text || "").toLowerCase();
    return DELETED_CONTEXT_MARKERS.some(function (marker) {
      return text.indexOf(marker) !== -1;
    });
  }

  function purgeDeletedContextStorage() {
    try {
      Object.keys(window.localStorage).forEach(function (key) {
        if (key.indexOf("prayer-dashboard:") !== 0) {
          return;
        }
        if (containsDeletedContext(storageGetItem(key))) {
          storageRemoveItem(key);
        }
      });
    } catch (error) {
      // Storage can remain readable even when it cannot accept another write.
    }
  }

  function clone(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value));
  }

  function normalizeUserId(userId) {
    return String(userId || "default-user").trim() || "default-user";
  }

  function latestKey(userId) {
    return "prayer-dashboard:user:" + normalizeUserId(userId) + ":latest";
  }

  function historyKey(userId) {
    return "prayer-dashboard:user:" + normalizeUserId(userId) + ":history";
  }

  function getActiveUserId() {
    return storageGetItem(ACTIVE_USER_KEY);
  }

  function setActiveUserId(userId) {
    storageSetItem(ACTIVE_USER_KEY, normalizeUserId(userId));
  }

  function getUserIndex() {
    return safeParse(storageGetItem(USER_INDEX_KEY), []);
  }

  function rememberUser(config) {
    var userId = normalizeUserId(config.user && config.user.id);
    var index = getUserIndex().filter(function (entry) {
      return entry.id !== userId;
    });

    index.unshift({
      id: userId,
      displayName: (config.user && config.user.displayName) || userId,
      mosqueName: (config.mosque && config.mosque.name) || "",
      updatedAt: new Date().toISOString()
    });

    storageSetItem(USER_INDEX_KEY, JSON.stringify(index.slice(0, 50)));
  }

  function loadLatest(userId) {
    var normalizedUserId = normalizeUserId(userId);
    var raw = storageGetItem(latestKey(normalizedUserId));
    if (containsDeletedContext(raw)) {
      storageRemoveItem(latestKey(normalizedUserId));
      return null;
    }
    return safeParse(raw, memoryLatest[normalizedUserId] || null);
  }

  function loadHistory(userId) {
    var normalizedUserId = normalizeUserId(userId);
    var raw = storageGetItem(historyKey(normalizedUserId));
    if (containsDeletedContext(raw)) {
      storageRemoveItem(historyKey(normalizedUserId));
      return [];
    }
    return safeParse(raw, memoryHistory[normalizedUserId] || []);
  }

  function makeHistoryRoom(userId) {
    var key = historyKey(userId);
    var history = safeParse(storageGetItem(key), []);
    var wroteSmallerHistory = false;

    if (!Array.isArray(history) || !history.length) {
      return false;
    }

    QUOTA_HISTORY_LIMITS.some(function (limit) {
      if (history.length <= limit) {
        return false;
      }
      var result = storageSetItem(key, JSON.stringify(history.slice(0, limit)));
      if (result.ok) {
        wroteSmallerHistory = true;
        return true;
      }
      return false;
    });

    if (!wroteSmallerHistory) {
      storageRemoveItem(key);
    }
    return true;
  }

  function persistLatest(userId, nextConfig) {
    var key = latestKey(userId);
    var serialized = JSON.stringify(nextConfig);
    var result = storageSetItem(key, serialized);

    if (!result.ok && isQuotaError(result.error) && makeHistoryRoom(userId)) {
      result = storageSetItem(key, serialized);
    }

    updateWriteStatus({
      mode: result.ok ? "local-storage" : "memory-only",
      latestPersisted: result.ok,
      historyPersisted: lastWriteStatus.historyPersisted,
      quotaExceeded: !result.ok && isQuotaError(result.error),
      error: result.ok ? "" : String(result.error && (result.error.message || result.error.name) || "Storage is unavailable")
    });
    return result.ok;
  }

  function persistHistory(userId, history) {
    var key = historyKey(userId);
    var result = { ok: false, error: null };
    var limits = [MAX_HISTORY].concat(QUOTA_HISTORY_LIMITS);

    limits.some(function (limit) {
      result = storageSetItem(key, JSON.stringify(history.slice(0, limit)));
      return result.ok;
    });

    updateWriteStatus({
      historyPersisted: result.ok,
      quotaExceeded: lastWriteStatus.quotaExceeded || (!result.ok && isQuotaError(result.error)),
      error: lastWriteStatus.error || (result.ok ? "" : String(result.error && (result.error.message || result.error.name) || "Storage is unavailable"))
    });
    return result.ok;
  }

  function saveConfig(config, options) {
    if (containsDeletedContext(config)) {
      return clone(window.DEFAULT_PRAYER_CONFIG || config);
    }

    var settings = options || {};
    var nextConfig = clone(config);
    var userId = normalizeUserId(nextConfig.user && nextConfig.user.id);
    if (!settings.preserveUpdatedAt || !nextConfig.updatedAt) {
      nextConfig.updatedAt = new Date().toISOString();
    }

    memoryLatest[userId] = clone(nextConfig);
    persistLatest(userId, nextConfig);
    setActiveUserId(userId);
    rememberUser(nextConfig);

    if (!settings.skipHistory) {
      var history = loadHistory(userId);
      history.unshift({
        savedAt: nextConfig.updatedAt,
        mosqueName: (nextConfig.mosque && nextConfig.mosque.name) || "",
        location: nextConfig.location || {},
        config: nextConfig
      });

      memoryHistory[userId] = clone(history.slice(0, MAX_HISTORY));
      persistHistory(userId, history);
    }

    if (!settings.skipRemote && window.PrayerSyncManager) {
      try {
        window.PrayerSyncManager.queueConfig(nextConfig, {
          source: settings.source || "dashboard"
        });
      } catch (error) {
        // Local persistence remains authoritative while a browser is offline.
      }
    }

    return nextConfig;
  }

  function cacheRemoteConfig(config) {
    return saveConfig(config, {
      skipHistory: true,
      skipRemote: true,
      preserveUpdatedAt: true
    });
  }

  function clearUser(userId) {
    var normalizedUserId = normalizeUserId(userId);
    delete memoryLatest[normalizedUserId];
    delete memoryHistory[normalizedUserId];
    storageRemoveItem(latestKey(normalizedUserId));
    storageRemoveItem(historyKey(normalizedUserId));
  }

  function exportToFile(config) {
    var fileName = "jadwal-sholat-" + normalizeUserId(config.user && config.user.id) + ".json";
    var blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json"
    });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  purgeDeletedContextStorage();

  window.PrayerStorage = {
    clone: clone,
    getActiveUserId: getActiveUserId,
    setActiveUserId: setActiveUserId,
    getUserIndex: getUserIndex,
    loadLatest: loadLatest,
    loadHistory: loadHistory,
    saveConfig: saveConfig,
    cacheRemoteConfig: cacheRemoteConfig,
    getLastWriteStatus: writeStatusSnapshot,
    clearUser: clearUser,
    exportToFile: exportToFile,
    normalizeUserId: normalizeUserId
  };
})(window);
