(function (window) {
  "use strict";

  /**
   * Small adapter that keeps astronomy-library availability separate from UI
   * components. Existing astronomy pages continue to use the same public
   * Astronomy global, so their calculations remain backward compatible.
   */
  window.AstronomyRuntime = {
    isAvailable: function () {
      return Boolean(window.Astronomy);
    },
    requireEngine: function () {
      if (!window.Astronomy) {
        throw new Error("Mesin astronomi belum tersedia. Buka halaman ini sekali saat online agar asetnya tersimpan untuk mode offline.");
      }
      return window.Astronomy;
    }
  };
})(window);
