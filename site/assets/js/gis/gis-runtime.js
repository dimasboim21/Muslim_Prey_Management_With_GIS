(function (window) {
  "use strict";

  var settings = {
    tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    offlineTileUrl: "",
    layers: [],
    buildingTypes: [],
    kaabah: null
  };
  var loaded = false;
  var loading = null;

  function canUseRemoteTiles() {
    return typeof navigator === "undefined" || navigator.onLine !== false;
  }

  function tileUrl(layer, fallback) {
    if (layer === "basic") {
      if (!canUseRemoteTiles() && settings.offlineTileUrl) {
        return settings.offlineTileUrl;
      }
      return settings.tileUrl || fallback;
    }

    return fallback;
  }

  function loadSettings() {
    if (loaded) {
      return Promise.resolve(settings);
    }
    if (loading) {
      return loading;
    }
    if (!window.PrayerApiClient) {
      loaded = true;
      return Promise.resolve(settings);
    }

    loading = window.PrayerApiClient.request("runtime.php")
      .then(function (data) {
        var map = data && data.map ? data.map : {};
        var gis = data && data.gis ? data.gis : {};
        settings.tileUrl = map.tileUrl || settings.tileUrl;
        settings.offlineTileUrl = map.offlineTileUrl || settings.offlineTileUrl;
        settings.layers = Array.isArray(gis.layers) ? gis.layers : settings.layers;
        settings.buildingTypes = Array.isArray(gis.buildingTypes) ? gis.buildingTypes : settings.buildingTypes;
        settings.kaabah = gis.kaabah || settings.kaabah;
        loaded = true;
        return settings;
      })
      .catch(function () {
        loaded = true;
        return settings;
      });

    return loading;
  }

  window.GisRuntime = {
    loadSettings: loadSettings,
    tileUrl: tileUrl,
    isOffline: function () {
      return !canUseRemoteTiles();
    },
    settings: function () {
      return {
        tileUrl: settings.tileUrl,
        offlineTileUrl: settings.offlineTileUrl,
        layers: settings.layers.slice(),
        buildingTypes: settings.buildingTypes.slice(),
        kaabah: settings.kaabah
      };
    },
    layer: function (key) {
      return settings.layers.find(function (layerConfig) {
        return layerConfig.key === key;
      }) || null;
    },
    iconForBuildingType: function (type) {
      var normalized = String(type || "").toLowerCase().replace(/\s+/g, "-");
      var match = settings.buildingTypes.find(function (item) {
        return item.key === normalized || String(item.name || "").toLowerCase() === String(type || "").toLowerCase();
      });

      return match ? match.icon : "";
    }
  };
})(window);
