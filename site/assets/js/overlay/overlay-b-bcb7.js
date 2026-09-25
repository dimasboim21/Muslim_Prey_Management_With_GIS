(function (window, document) {
  "use strict";
  function boot() { window.OverlayManager.start(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window, document);
