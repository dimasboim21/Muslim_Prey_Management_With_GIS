(function (window, document) {
  "use strict";

  function normalizeBasePath(path) {
    if (!path || path === "/") {
      return "";
    }

    return path.replace(/\\/g, "/").replace(/\/+$/, "");
  }

  function discoverBasePath() {
    var script = document.currentScript;
    var source = script && script.src ? script.src : "";
    var marker = "/assets/js/core/";

    if (source && window.URL) {
      try {
        var path = new window.URL(source, window.location.href).pathname;
        var position = path.indexOf(marker);
        if (position >= 0) {
          return normalizeBasePath(path.slice(0, position));
        }
      } catch (error) {
        // A file:// document can still use relative URLs below.
      }
    }

    return "";
  }

  var basePath = discoverBasePath();
  var isFileMode = window.location.protocol === "file:";

  function url(relativePath) {
    var relative = String(relativePath || "").replace(/^\/+/, "");

    if (isFileMode) {
      return relative;
    }

    return (basePath || "") + "/" + relative;
  }

  window.PrayerRuntime = {
    basePath: basePath,
    isFileMode: isFileMode,
    isServerCapable: !isFileMode && typeof window.fetch === "function",
    url: url,
    api: function (endpoint) {
      return url("api/" + String(endpoint || "").replace(/^\/+/, ""));
    },
    asset: function (path) {
      return url("assets/" + String(path || "").replace(/^\/+/, ""));
    },
    data: function (path) {
      return url("data/" + String(path || "").replace(/^\/+/, ""));
    }
  };
})(window, document);
