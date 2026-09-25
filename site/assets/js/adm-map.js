(function () {
  "use strict";

  var statusNode = document.getElementById("boundaryStatus");
  var countryInput = document.getElementById("countryCode");
  var adm1Input = document.getElementById("adm1Name");
  var currentRequest = { level: "adm0", world: false };
  var loadGeneration = 0;

  function setStatus(message, kind) {
    statusNode.textContent = message;
    statusNode.dataset.kind = kind || "";
  }

  var basicLayer = new ol.layer.VectorTile({
    source: new ol.source.VectorTile({
      format: new ol.format.MVT(),
      url: "https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf",
      maxZoom: 14,
      attributions: "OpenFreeMap, OpenMapTiles, OpenStreetMap"
    }),
    visible: true
  });
  if (window.olms && typeof window.olms.applyStyle === "function") {
    window.olms.applyStyle(basicLayer, "https://tiles.openfreemap.org/styles/bright", "openmaptiles");
  }
  var topoLayer = new ol.layer.Tile({ source: new ol.source.XYZ({ url: "https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png" }), visible: false });
  var satelliteLayer = new ol.layer.Group({
    layers: [
      new ol.layer.Tile({ source: new ol.source.XYZ({ urls: [
        "https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        "https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        "https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
      ], tileSize: 256 }) }),
      new ol.layer.Tile({ source: new ol.source.XYZ({ urls: [
        "https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png"
      ], tileSize: 256 }) })
    ],
    visible: false
  });
  var boundarySource = new ol.source.Vector();
  var boundaryLayer = new ol.layer.Vector({
    source: boundarySource,
    style: new ol.style.Style({
      fill: new ol.style.Fill({ color: "rgba(255,213,74,.08)" }),
      stroke: new ol.style.Stroke({ color: "#ffd54a", width: 1.35 })
    })
  });
  var map = new ol.Map({
    target: "map",
    layers: [basicLayer, topoLayer, satelliteLayer, boundaryLayer],
    view: new ol.View({ center: ol.proj.fromLonLat([118.0148634, -2.548926]), zoom: 4 })
  });

  function normalizedCountry() { return String(countryInput.value || "").trim().toUpperCase(); }

  function featureValue(feature, keys) {
    var props = feature && feature.getProperties ? feature.getProperties() : {};
    for (var index = 0; index < keys.length; index += 1) {
      var value = String(props[keys[index]] || "").trim();
      if (value) return value;
    }
    return "";
  }

  function requestParams(level, world) {
    var country = normalizedCountry();
    var params = { level: level, hierarchy: "strict-v6" };
    if (!world && country) {
      if (/^[A-Z]{2}$/.test(country)) params.country_iso2 = country;
      else params.country = country;
    }
    if (level === "adm2") params.adm1 = String(adm1Input.value || "").trim();
    return params;
  }

  function loadBoundary(level, world) {
    if (!window.MpmAdmBoundary) {
      setStatus("Klien sumber ADM tidak tersedia.", "error");
      return Promise.reject(new Error("ADM source client unavailable"));
    }
    var params = requestParams(level, world);
    if (level !== "adm0" && !normalizedCountry()) {
      setStatus("Isi kode negara sebelum memuat " + level.toUpperCase() + ".", "error");
      return Promise.resolve([]);
    }
    if (level === "adm2" && !params.adm1) {
      setStatus("Pilih atau isi nama ADM1 sebelum memuat ADM2.", "error");
      return Promise.resolve([]);
    }
    currentRequest = { level: level, world: !!world };
    var generation = ++loadGeneration;
    setStatus("Memeriksa " + level.toUpperCase() + " resolusi penuh dari geoBoundaries online…");
    return window.MpmAdmBoundary.fetchGeoJson("api/adm-boundaries.php", { params: params, staticMode: true }).then(function (result) {
      if (generation !== loadGeneration) return [];
      var features = new ol.format.GeoJSON().readFeatures(result.geojson, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });
      boundarySource.clear();
      boundarySource.addFeatures(features);
      if (features.length) map.getView().fit(boundarySource.getExtent(), { padding: [35, 35, 35, 35], duration: 350, maxZoom: level === "adm2" ? 11 : 8 });
      var fallback = result.source && result.source.fallbackReason ? " · alasan fallback: " + result.source.fallbackReason : "";
      setStatus(level.toUpperCase() + " dimuat: " + features.length + " boundary · " + window.MpmAdmBoundary.sourceLabel(result.source, "id") + fallback + ".", "success");
      return features;
    }).catch(function (error) {
      if (generation === loadGeneration) setStatus("Gagal memuat " + level.toUpperCase() + ": " + error.message, "error");
      throw error;
    });
  }

  document.getElementById("loadAdm0Country").addEventListener("click", function () { loadBoundary("adm0", false); });
  document.getElementById("loadAdm0World").addEventListener("click", function () { loadBoundary("adm0", true); });
  document.getElementById("loadAdm1").addEventListener("click", function () { loadBoundary("adm1", false); });
  document.getElementById("loadAdm2").addEventListener("click", function () { loadBoundary("adm2", false); });

  document.querySelectorAll("[data-base-layer]").forEach(function (button) {
    button.addEventListener("click", function () {
      var selected = button.dataset.baseLayer;
      basicLayer.setVisible(selected === "basic"); topoLayer.setVisible(selected === "topography"); satelliteLayer.setVisible(selected === "satellite");
      document.querySelectorAll("[data-base-layer]").forEach(function (candidate) { candidate.classList.toggle("active", candidate === button); });
    });
  });

  map.on("click", function (event) {
    var feature = map.forEachFeatureAtPixel(event.pixel, function (candidate, layer) { return layer === boundaryLayer ? candidate : null; }, { hitTolerance: 5 });
    if (feature) {
      var iso3 = featureValue(feature, ["shapeGroup", "ISO_A3", "ISO3"]);
      var name = featureValue(feature, ["shapeName", "NAME_0", "NAME_1", "NAME_2", "name"]);
      var level = featureValue(feature, ["shapeType"]);
      if (iso3) countryInput.value = iso3;
      if (String(level).toUpperCase() === "ADM1" && name) adm1Input.value = name;
      document.getElementById("mapKey").textContent = [level || currentRequest.level.toUpperCase(), name, iso3].filter(Boolean).join(" · ");
      return;
    }
    var coordinate = ol.proj.toLonLat(event.coordinate);
    document.getElementById("mapKey").textContent = "Lon " + coordinate[0].toFixed(6) + " · Lat " + coordinate[1].toFixed(6);
  });

  function reloadForConnectivity() { loadBoundary(currentRequest.level, currentRequest.world).catch(function () {}); }
  window.addEventListener("online", reloadForConnectivity);
  window.addEventListener("offline", reloadForConnectivity);

  var pageParams = new URLSearchParams(window.location.search);
  var requestedCountry = pageParams.get("country");
  if (requestedCountry && /^[A-Za-z]{2,3}$/.test(requestedCountry)) countryInput.value = requestedCountry.toUpperCase();
  var requestedAdm1 = pageParams.get("adm1");
  if (requestedAdm1) adm1Input.value = requestedAdm1;
  var requestedLat = Number(pageParams.get("lat"));
  var requestedLon = Number(pageParams.get("lon"));
  if (pageParams.has("lat") && pageParams.has("lon") &&
      Number.isFinite(requestedLat) && requestedLat >= -90 && requestedLat <= 90 &&
      Number.isFinite(requestedLon) && requestedLon >= -180 && requestedLon <= 180) {
    map.getView().setCenter(ol.proj.fromLonLat([requestedLon, requestedLat]));
    map.getView().setZoom(12);
    document.getElementById("mapKey").textContent = "Lon " + requestedLon.toFixed(6) + " · Lat " + requestedLat.toFixed(6);
  }
  var requestedLevel = String(pageParams.get("level") || "adm0").toLowerCase();
  if (["adm0", "adm1", "adm2"].indexOf(requestedLevel) === -1) requestedLevel = "adm0";
  if (requestedCountry || pageParams.has("level")) {
    loadBoundary(requestedLevel, false).catch(function () {});
  } else {
    setStatus("Siap. Isi kode negara lalu pilih ADM0, ADM1, atau ADM2. Sumber online penuh diperiksa lebih dahulu.");
  }
})();
