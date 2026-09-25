(function (window) {
  "use strict";

  var CACHE_KEY = "mpm:dynamic-overlay:v1:public-config";

  function readCache() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null");
      return parsed && parsed.data ? parsed.data : null;
    } catch (error) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({
        cachedAt: new Date().toISOString(),
        data: data
      }));
    } catch (error) {
      // SQL remains authoritative; unavailable browser storage is harmless.
    }
  }

  function load() {
    return window.fetch("api/overlays.php", {
      cache: "no-store",
      headers: { "Accept": "application/json" }
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok || !payload || payload.success !== true || !payload.data) {
          throw new Error((payload && payload.error) || "Overlay configuration is unavailable.");
        }
        writeCache(payload.data);
        return { data: payload.data, source: "sql" };
      });
    }).catch(function (error) {
      var cached = readCache();
      if (cached) {
        return { data: cached, source: "local-cache", error: error.message };
      }
      throw error;
    });
  }

  window.OverlayApi = {
    load: load,
    readCache: readCache
  };
})(window);
