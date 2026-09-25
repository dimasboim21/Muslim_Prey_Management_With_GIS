(function (window, document) {
  "use strict";

  var root = null;
  var unsubscribe = null;
  var lastRenderedAt = 0;

  function isIndonesian() {
    var query = new URLSearchParams(window.location.search).get("lang");
    return query ? query !== "en" : document.documentElement.lang !== "en";
  }

  function text(id, en) { return isIndonesian() ? id : en; }
  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function finite(value) { return Number.isFinite(Number(value)); }
  function number(value, decimals) { return finite(value) ? Number(value).toFixed(decimals) : text("Tidak tersedia", "Unavailable"); }
  function signed(value, decimals, unit) {
    if (!finite(value)) { return text("Tidak tersedia", "Unavailable"); }
    var numeric = Number(value);
    return (numeric >= 0 ? "+" : "") + numeric.toFixed(decimals) + (unit || "");
  }
  function distance(value) {
    if (!finite(value)) { return text("Tidak tersedia", "Unavailable"); }
    return Number(value) >= 1000
      ? number(Number(value) / 1000, 3) + " km"
      : number(value, 3) + " m";
  }
  function metric(label, value) {
    return "<div><span>" + escapeHtml(label) + "</span><strong>" + escapeHtml(value) + "</strong></div>";
  }

  function markup() {
    return '<section class="time-coordinate-calibration" id="timeCoordinateCalibrationPanel" aria-labelledby="timeCoordinateCalibrationTitle">'
      + '<header><div><h3 id="timeCoordinateCalibrationTitle">' + text("Kalibrasi Waktu & Koordinat", "Time & Coordinate Calibration") + '</h3>'
      + '<p>' + text("Network clock dan pembanding astronomis bujur dipisahkan.", "Network clock and longitude-based astronomical comparison are separate.") + '</p></div>'
      + '<span class="calibration-status" id="calibrationSyncStatus">Unavailable</span></header>'
      + '<div class="calibration-config astro-settings-panel">'
      + '<label><span>' + text("Tampilkan perbandingan", "Show comparison") + '</span><select id="calibrationShowComparison"><option value="on">ON</option><option value="off">OFF</option></select></label>'
      + '<label><span>' + text("Referensi waktu", "Time reference") + '</span><select id="calibrationTimeReference"><option value="provider_network">Provider / Network Time</option><option value="coordinate_calibrated">Coordinate-Calibrated Building Time</option></select></label>'
      + '<label><span>' + text("Diferensiasi koordinat", "Coordinate difference") + '</span><select id="calibrationDifferenceMode"><option value="display_only">' + text("Tampilkan saja", "Display only") + '</option><option value="apply">' + text("Terapkan ke waktu turunan", "Apply to derived time") + '</option></select></label>'
      + '<label><span>' + text("Garis cyan provider-ke-gedung", "Cyan provider-to-building line") + '</span><select id="calibrationLineMode"><option value="on">ON</option><option value="off">OFF</option></select></label>'
      + '<label><span>' + text("Token admin (jika server meminta)", "Admin token (if required)") + '</span><input id="calibrationAdminToken" type="password" autocomplete="off" placeholder="Optional"></label>'
      + '<div class="calibration-actions"><button id="saveTimeCoordinateCalibration" type="button">' + text("Simpan konfigurasi", "Save configuration") + '</button><button id="refreshTimeCoordinateCalibration" type="button">' + text("Sinkronkan ulang", "Resynchronize") + '</button></div>'
      + '</div>'
      + '<div class="calibration-summary" id="calibrationSummary"></div>'
      + '<p class="calibration-narrative" id="calibrationNarrative"></p>'
      + '<p class="calibration-warning" id="calibrationWarning" hidden></p>'
      + '<p class="calibration-disclosure" id="calibrationDisclosure"></p>'
      + '<div class="calibration-details">'
      + '<details><summary>' + text("Provider", "Provider") + '</summary><div class="calibration-detail-grid" id="calibrationProviderDetails"></div></details>'
      + '<details><summary>' + text("Gedung", "Building") + '</summary><div class="calibration-detail-grid" id="calibrationBuildingDetails"></div></details>'
      + '<details><summary>' + text("Perbedaan spasial", "Spatial Difference") + '</summary><div class="calibration-detail-grid" id="calibrationSpatialDetails"></div></details>'
      + '<details open><summary>' + text("Perbedaan waktu", "Time Difference") + '</summary><div class="calibration-detail-grid" id="calibrationTimeDetails"></div></details>'
      + '<details><summary>' + text("Rotasi Bumi", "Earth Rotation") + '</summary><div class="calibration-detail-grid" id="calibrationEarthDetails"></div></details>'
      + '<details><summary>' + text("Detail perhitungan", "Calculation Details") + '</summary><pre class="calibration-formula" id="calibrationFormula"></pre></details>'
      + '</div></section>';
  }

  function byId(id) { return document.getElementById(id); }
  function renderGrid(id, items) {
    var element = byId(id);
    if (!element) { return; }
    element.innerHTML = items.map(function (item) { return metric(item[0], item[1]); }).join("");
  }

  function render(snapshot) {
    if (!root || !snapshot) { return; }
    var now = window.performance && window.performance.now ? window.performance.now() : Date.now();
    if (now - lastRenderedAt < 125) { return; }
    lastRenderedAt = now;
    var config = snapshot.configuration || {};
    var provider = snapshot.provider || {};
    var building = snapshot.building || {};
    var spatial = snapshot.spatialDifference || {};
    var astro = snapshot.astronomicalDifference || {};
    var time = snapshot.time || {};
    var network = provider.timeSource || {};
    var earth = snapshot.earthRotation || {};
    var status = network.synchronizationStatus || "unavailable";
    byId("calibrationSyncStatus").textContent = status === "verified"
      ? "Verified Provider Time" : (status === "estimated" ? "Estimated Provider Time" : "Unavailable");
    byId("calibrationSyncStatus").dataset.status = status;
    byId("calibrationShowComparison").value = config.showComparison === false ? "off" : "on";
    byId("calibrationTimeReference").value = config.timeReferenceMode || "provider_network";
    byId("calibrationDifferenceMode").value = config.coordinateDifferenceMode || "display_only";
    byId("calibrationLineMode").value = config.showCalibrationLine === false ? "off" : "on";
    root.classList.toggle("comparison-hidden", config.showComparison === false);

    renderGrid("calibrationSummary", [
      [text("Provider koordinat", "Coordinate provider"), provider.name || text("Tidak tersedia", "Unavailable")],
      [text("Sumber jam", "Clock source"), network.providerName || text("Tidak tersedia", "Unavailable")],
      [text("Gedung", "Building"), building.name || text("Tidak tersedia", "Unavailable")],
      [text("Jarak", "Distance"), distance(spatial.distanceMeters)],
      [text("Arah provider ke gedung", "Provider to building direction"), spatial.relativeDirectionId || spatial.relativeDirectionEn || text("Tidak tersedia", "Unavailable")],
      ["Δ Longitude", signed(spatial.deltaLongitude, 6, "°")],
      [text("Selisih waktu astronomis", "Astronomical time difference"), window.MpmTimeCoordinateCalibration.formatSignedDuration(time.differenceMilliseconds)],
      [text("Referensi dipilih", "Selected reference"), config.timeReferenceMode === "coordinate_calibrated" ? "Coordinate-Calibrated Building Time" : "Provider / Network Time"]
    ]);
    byId("calibrationNarrative").textContent = snapshot.narrative || "";
    var warning = snapshot.diagnostic && snapshot.diagnostic.warning || "";
    byId("calibrationWarning").hidden = !warning;
    byId("calibrationWarning").textContent = warning;
    byId("calibrationDisclosure").textContent = network.provenanceNote || text(
      "Jam provider belum tersedia. Nilai tidak disimulasikan dari Date.now().",
      "Provider time is unavailable. No value is simulated from Date.now()."
    );

    renderGrid("calibrationProviderDetails", [
      [text("Provider / operator", "Provider / operator"), provider.name || "Unavailable"],
      [text("Koordinat", "Coordinate"), finite(provider.latitude) ? number(provider.latitude, 6) + ", " + number(provider.longitude, 6) : "Unavailable"],
      [text("Tipe koordinat", "Coordinate type"), provider.coordinateType || "Unavailable"],
      [text("Status koordinat", "Coordinate status"), provider.coordinateStatus || "Unverified"],
      [text("Akurasi radius", "Accuracy radius"), finite(provider.accuracyRadius) ? distance(provider.accuracyRadius) : "Unavailable"],
      [text("Confidence", "Confidence"), provider.confidence || "Unverified"],
      [text("Sumber koordinat", "Coordinate source"), provider.coordinateSource || "Unavailable"],
      [text("Tipe sumber jam", "Time source type"), network.timeSourceType || "Unavailable"],
      [text("Host jam", "Time host"), network.sourceHost || network.sourceURL || "Unavailable"],
      ["RTT", finite(network.roundTripTime) ? number(network.roundTripTime, 3) + " ms" : "Unavailable"],
      ["Stratum", finite(network.stratum) ? number(network.stratum, 0) : "Unavailable"],
      [text("Uncertainty", "Uncertainty"), finite(network.uncertainty) ? number(network.uncertainty, 3) + " ms" : "Unavailable"],
      [text("Sinkronisasi terakhir", "Last synchronization"), network.lastSynchronization || "Unavailable"]
    ]);
    renderGrid("calibrationBuildingDetails", [
      [text("Nama", "Name"), building.name || "Unavailable"],
      [text("Koordinat", "Coordinate"), finite(building.latitude) ? number(building.latitude, 6) + ", " + number(building.longitude, 6) : "Unavailable"],
      [text("Sumber", "Source"), building.coordinateSource || "Unavailable"],
      [text("Status", "Status"), building.coordinateStatus || "Unverified"],
      [text("Dikonfirmasi pengguna", "Confirmed by user"), building.confirmedByUser ? text("Ya", "Yes") : text("Belum", "Not yet")],
      [text("Akurasi", "Accuracy"), finite(building.accuracy) ? distance(building.accuracy) : (building.accuracyNote || "Unavailable")],
      [text("Elevasi", "Elevation"), finite(building.elevation) ? number(building.elevation, 2) + " m" : "Unavailable"]
    ]);
    renderGrid("calibrationSpatialDetails", [
      ["Δ Latitude", signed(spatial.deltaLatitude, 6, "°")],
      ["Δ Longitude", signed(spatial.deltaLongitude, 6, "°")],
      [text("Komponen Utara/Selatan", "North/South component"), signed(spatial.northSouthMeters, 3, " m")],
      [text("Komponen Timur/Barat", "East/West component"), signed(spatial.eastWestMeters, 3, " m")],
      [text("Initial bearing", "Initial bearing"), finite(spatial.bearingDegrees) ? number(spatial.bearingDegrees, 3) + "°" : "Unavailable"],
      [text("Jarak permukaan", "Surface distance"), distance(spatial.distanceMeters)]
    ]);
    renderGrid("calibrationTimeDetails", [
      [text("Provider / network", "Provider / network"), window.MpmTimeCoordinateCalibration.formatTimestamp(time.providerTime, building.timezone)],
      [text("Waktu gedung turunan", "Derived building time"), window.MpmTimeCoordinateCalibration.formatTimestamp(time.coordinateCalibratedBuildingTime, building.timezone)],
      [text("Perbedaan", "Difference"), window.MpmTimeCoordinateCalibration.formatSignedDuration(time.differenceMilliseconds)],
      [text("Perbedaan milidetik", "Difference milliseconds"), finite(time.differenceMilliseconds) ? signed(time.differenceMilliseconds, 3, " ms") : "Unavailable"],
      [text("Perbedaan detik", "Difference seconds"), finite(astro.longitudeDifferenceSeconds) ? signed(astro.longitudeDifferenceSeconds, 3, " s") : "Unavailable"],
      [text("Mode penerapan", "Application mode"), config.coordinateDifferenceMode === "apply" ? text("Diterapkan pada display turunan", "Applied to derived display") : text("Hanya ditampilkan", "Display only")]
    ]);
    renderGrid("calibrationEarthDetails", [
      [text("Rotasi solar rata-rata", "Mean solar rotation"), "360° / 24 h · 15°/h · 0.25°/min"],
      [text("Konversi bujur", "Longitude conversion"), "1° = 4 min = 240 s"],
      [text("Kecepatan sudut sideris", "Sidereal angular velocity"), "7.292115 × 10⁻⁵ rad/s"],
      [text("Kecepatan ekuator", "Equatorial speed"), number(earth.equatorialMetersPerSecond, 1) + " m/s · " + number(earth.equatorialKilometersPerHour, 0) + " km/h"],
      [text("Pada latitude provider", "At provider latitude"), finite(earth.providerMetersPerSecond) ? number(earth.providerMetersPerSecond, 3) + " m/s" : "Unavailable"],
      [text("Pada latitude gedung", "At building latitude"), finite(earth.buildingMetersPerSecond) ? number(earth.buildingMetersPerSecond, 3) + " m/s" : "Unavailable"]
    ]);
    byId("calibrationFormula").textContent = [
      "Δλ = longitudeBuilding - longitudeProvider (normalized -180° ... +180°)",
      "Δt_ms = Δλ × 240000 ms",
      "Haversine: a = sin²(Δφ/2) + cos φ1 × cos φ2 × sin²(Δλ/2)",
      "c = 2 × atan2(√a, √(1-a)); d = 6,371,008.8 m × c",
      "v(latitude) = 465.1 × cos(latitude) m/s",
      "Latitude affects geodesic/astronomical geometry; it is not a direct longitude-time correction."
    ].join("\n");
  }

  function currentControls() {
    return {
      showComparison: byId("calibrationShowComparison").value !== "off",
      timeReferenceMode: byId("calibrationTimeReference").value,
      coordinateDifferenceMode: byId("calibrationDifferenceMode").value,
      showCalibrationLine: byId("calibrationLineMode").value !== "off"
    };
  }

  function bind() {
    ["calibrationShowComparison", "calibrationTimeReference", "calibrationDifferenceMode", "calibrationLineMode"].forEach(function (id) {
      byId(id).addEventListener("change", function () {
        window.MpmTimeCoordinateCalibration.configure(currentControls());
      });
    });
    byId("saveTimeCoordinateCalibration").addEventListener("click", function () {
      var button = this;
      button.disabled = true;
      window.MpmTimeCoordinateCalibration.configure(currentControls(), {
        persist: true,
        force: true,
        adminToken: byId("calibrationAdminToken").value
      }).then(function () {
        button.textContent = text("Tersimpan", "Saved");
      }).catch(function (error) {
        button.textContent = text("Gagal: ", "Failed: ") + String(error.message || error);
      }).finally(function () {
        window.setTimeout(function () {
          button.disabled = false;
          button.textContent = text("Simpan konfigurasi", "Save configuration");
        }, 1800);
      });
    });
    byId("refreshTimeCoordinateCalibration").addEventListener("click", function () {
      var jobs = [
        window.MpmTimeCoordinateCalibration.discoverBuildingCoordinate(),
        window.MpmTimeCoordinateCalibration.discoverProviderCoordinate()
      ];
      if (window.MpmActualTime && window.MpmActualTime.refresh) { jobs.push(window.MpmActualTime.refresh()); }
      Promise.all(jobs).then(function () { render(window.MpmTimeCoordinateCalibration.getState()); });
    });
  }

  function initialize() {
    if (!window.MpmTimeCoordinateCalibration || root) { return; }
    var target = document.getElementById("timeMetrics") || document.getElementById("timeGrid");
    if (!target || !target.parentNode) { return; }
    var host = document.createElement("div");
    host.innerHTML = markup();
    root = host.firstElementChild;
    target.insertAdjacentElement("afterend", root);
    bind();
    unsubscribe = window.MpmTimeCoordinateCalibration.subscribe(render);
    window.MpmTimeCoordinateCalibration.initialize().then(render);
  }

  window.MpmTimeCoordinateCalibrationPanel = {
    initialize: initialize,
    render: render,
    destroy: function () { if (unsubscribe) { unsubscribe(); } if (root) { root.remove(); } root = null; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else { initialize(); }
})(window, document);
