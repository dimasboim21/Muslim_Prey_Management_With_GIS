(function (window) {
  "use strict";

  if (!window.navigator || !window.navigator.serviceWorker || window.location.protocol === "file:") {
    return;
  }

  var serviceWorkerUrl = window.PrayerRuntime
    ? window.PrayerRuntime.url("sw.js")
    : "sw.js";
  var scope = window.PrayerRuntime && window.PrayerRuntime.basePath
    ? window.PrayerRuntime.basePath + "/"
    : "./";

  window.addEventListener("load", function () {
    window.navigator.serviceWorker.register(serviceWorkerUrl, { scope: scope }).catch(function () {
      // The app still works using localStorage if service workers are unavailable.
    });
  });
})(window);
