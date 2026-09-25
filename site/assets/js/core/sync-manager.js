(function (window) {
  "use strict";

  var OUTBOX_KEY = "prayer-dashboard:sync-outbox:v1";
  var MAX_OUTBOX = 250;
  var flushing = false;
  var scheduled = false;
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
      var probe = "prayer-dashboard:sync-probe";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return true;
    } catch (error) {
      return false;
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

  function readQueue() {
    if (!canUseStorage()) {
      return [];
    }

    try {
      var parsed = JSON.parse(window.localStorage.getItem(OUTBOX_KEY) || "[]");
      if (!Array.isArray(parsed)) {
        return [];
      }
      var cleaned = parsed.filter(function (item) {
        return !containsDeletedContext(item);
      });
      if (cleaned.length !== parsed.length) {
        window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(cleaned));
      }
      return cleaned;
    } catch (error) {
      return [];
    }
  }

  function writeQueue(queue) {
    if (canUseStorage()) {
      window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
    }
    emitStatus();
  }

  function makeId(prefix) {
    var random = "";
    if (window.crypto && window.crypto.getRandomValues) {
      var values = new Uint32Array(2);
      window.crypto.getRandomValues(values);
      random = values[0].toString(36) + values[1].toString(36);
    } else {
      random = Math.random().toString(36).slice(2);
    }

    return prefix + ":" + Date.now().toString(36) + ":" + random;
  }

  function emitStatus(lastError) {
    var detail = {
      pending: readQueue().length,
      isFlushing: flushing,
      lastError: lastError ? String(lastError.message || lastError) : ""
    };
    if (typeof window.CustomEvent === "function") {
      window.dispatchEvent(new window.CustomEvent("prayer:sync-status", { detail: detail }));
    }
  }

  function canSync() {
    return Boolean(
      window.PrayerApiClient &&
      (!window.PrayerRuntime || window.PrayerRuntime.isServerCapable) &&
      (typeof navigator === "undefined" || navigator.onLine !== false)
    );
  }

  function enqueue(item) {
    var queue = readQueue();
    if (queue.length >= MAX_OUTBOX) {
      throw new Error("Antrean sinkronisasi penuh. Sambungkan ke server lalu tunggu sinkronisasi selesai.");
    }

    queue.push(item);
    writeQueue(queue);
    scheduleFlush();
    return item.id;
  }

  function queueConfig(config, options) {
    if (containsDeletedContext(config)) {
      return "";
    }

    var settings = options || {};
    var userId = config && config.user ? String(config.user.id || "") : "";
    var updatedAt = config ? String(config.updatedAt || "") : "";
    var existing = readQueue().find(function (item) {
      return item.type === "config.save" &&
        item.payload && item.payload.user &&
        String(item.payload.user.id || "") === userId &&
        String(item.payload.updatedAt || "") === updatedAt;
    });

    if (existing) {
      return existing.id;
    }

    var item = {
      id: makeId("config"),
      type: "config.save",
      createdAt: new Date().toISOString(),
      attempts: 0,
      source: settings.source || "dashboard",
      payload: config
    };

    return enqueue(item);
  }

  function queueActivity(activityType, actorId, metadata) {
    var item = {
      id: makeId("activity"),
      type: "activity.log",
      createdAt: new Date().toISOString(),
      attempts: 0,
      activityType: activityType,
      actorId: actorId || "anonymous",
      metadata: metadata || {}
    };

    return enqueue(item);
  }

  function send(item) {
    if (item.type === "config.save") {
      return window.PrayerApiClient.saveConfig(item.payload, item.id, item.source);
    }
    if (item.type === "activity.log") {
      return window.PrayerApiClient.logActivity(item.activityType, item.actorId, item.metadata, item.id);
    }

    return Promise.reject(new Error("Tipe antrean sinkronisasi tidak dikenal."));
  }

  function flush() {
    if (flushing || !canSync()) {
      return Promise.resolve(false);
    }

    flushing = true;
    emitStatus();

    function next() {
      var queue = readQueue();
      if (!queue.length) {
        flushing = false;
        emitStatus();
        return Promise.resolve(true);
      }

      var item = queue[0];
      return send(item)
        .then(function () {
          queue.shift();
          writeQueue(queue);
          return next();
        })
        .catch(function (error) {
          item.attempts = Number(item.attempts || 0) + 1;
          item.lastError = String(error.message || error);
          item.lastAttemptAt = new Date().toISOString();
          queue[0] = item;
          writeQueue(queue);
          flushing = false;
          emitStatus(error);
          return false;
        });
    }

    return next();
  }

  function scheduleFlush() {
    if (scheduled) {
      return;
    }
    scheduled = true;
    window.setTimeout(function () {
      scheduled = false;
      flush();
    }, 50);
  }

  if (window.addEventListener) {
    window.addEventListener("online", scheduleFlush);
    window.addEventListener("focus", scheduleFlush);
  }

  window.PrayerSyncManager = {
    queueConfig: queueConfig,
    queueActivity: queueActivity,
    flush: flush,
    pendingCount: function () {
      return readQueue().length;
    },
    getQueue: readQueue
  };

  scheduleFlush();
})(window);
