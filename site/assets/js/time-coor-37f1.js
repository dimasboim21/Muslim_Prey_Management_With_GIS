(function (window, document) {
  "use strict";

  var unsubscribe = null;
  var lastTimestamp = "";
  var lastMetadata = "";

  function byId(id) { return document.getElementById(id); }
  function indonesian() {
    var query = new URLSearchParams(window.location.search).get("lang");
    return query ? query !== "en" : document.documentElement.lang !== "en";
  }
  function text(id, en) { return indonesian() ? id : en; }

  function statusLabel(status) {
    var key = String(status || "unavailable").toLowerCase();
    var labels = {
      verified: text("Terverifikasi", "Verified"),
      estimated: text("Estimasi", "Estimated"),
      unverified: text("Belum terverifikasi", "Unverified"),
      unavailable: text("Tidak tersedia", "Unavailable")
    };
    return labels[key] || labels.unavailable;
  }

  function sourcePresentation(selected) {
    if (selected.mode === "building-coordinate-calibrated") {
      return {
        label: text(
          "Waktu Kalibrasi Koordinat Gedung terhadap ISP",
          "Calibrating Building Coordinate Position"
        ),
        tooltip: text(
          "Waktu turunan berdasarkan waktu referensi ISP/provider dan diferensiasi longitude antara koordinat provider dengan koordinat gedung. Ini bukan UTC resmi.",
          "Derived time based on the ISP/provider reference and the longitude difference between provider and building coordinates. This is not official UTC."
        )
      };
    }
    return {
      label: window.MpmDemoOptions && window.MpmDemoOptions.useLocalClockFallback
        ? text("Waktu Demo Lokal", "Local Demo Time")
        : text("Waktu ISP / Provider", "ISP / Provider Time"),
      tooltip: text(
        window.MpmDemoOptions && window.MpmDemoOptions.useLocalClockFallback
          ? "Demo menggunakan jam lokal perangkat secara monotonic karena sumber ISP tidak tersedia."
          : "Waktu yang diterima dari sumber waktu ISP/provider sesuai status dan provenance Time System.",
        window.MpmDemoOptions && window.MpmDemoOptions.useLocalClockFallback
          ? "The demo uses the device local clock monotonically because an ISP source is unavailable."
          : "Time received from the ISP/provider source according to the Time System status and provenance."
      )
    };
  }

  function renderTimestamp(clock, selected, timezone) {
    var datePart = byId("actualTimeDatePart");
    var clockPart = byId("actualTimeClockPart");
    if (!datePart || !clockPart) { return; }

    if (!selected.available || !Number.isFinite(Number(selected.epochMs))) {
      var unavailable = selected.mode === "building-coordinate-calibrated"
        ? text("Kalibrasi gedung tidak tersedia", "Building calibration unavailable")
        : text("Waktu ISP tidak tersedia", "ISP time unavailable");
      if (lastTimestamp !== unavailable) {
        datePart.textContent = unavailable;
        clockPart.textContent = "";
        clockPart.hidden = true;
        clock.removeAttribute("datetime");
        lastTimestamp = unavailable;
      }
      return;
    }

    var full = window.MpmTimeCoordinateCalibration.formatTimestamp(selected.epochMs, timezone);
    if (full !== lastTimestamp) {
      var separator = full.indexOf(" ");
      datePart.textContent = separator >= 0 ? full.slice(0, separator) : full;
      clockPart.textContent = separator >= 0 ? full.slice(separator + 1) : "";
      clockPart.hidden = false;
      clock.dateTime = new Date(Number(selected.epochMs)).toISOString();
      lastTimestamp = full;
    }
  }

  function render(snapshot) {
    if (!window.MpmTimeCoordinateCalibration || !snapshot) { return; }
    var clock = byId("clockTime");
    var selector = byId("actualTimeDisplayMode");
    var differenceOutput = byId("actualTimeCoordinateDifference");
    var sourceLabel = byId("actualTimeSourceLabel");
    var sourceStatus = byId("actualTimeSourceStatus");
    if (!clock || !selector || !differenceOutput || !sourceLabel || !sourceStatus) { return; }

    var selected = window.MpmTimeCoordinateCalibration.selectedClock(undefined, snapshot);
    if (document.activeElement !== selector) { selector.value = selected.mode; }
    renderTimestamp(clock, selected, snapshot.building && snapshot.building.timezone);

    var source = sourcePresentation(selected);
    var network = snapshot.provider && snapshot.provider.timeSource || {};
    var difference = snapshot.time && snapshot.time.differenceMilliseconds;
    var differenceAvailable = Number.isFinite(Number(difference));
    var differenceText = differenceAvailable
      ? ((Number(difference) >= 0 ? "+" : "") + (Number(difference) / 1000).toFixed(3) + " s")
      : text("Tidak tersedia", "Unavailable");
    var status = selected.available ? (selected.status || "unverified") : "unavailable";
    var providerName = network.providerName || text("Sumber jaringan tidak tersedia", "Network source unavailable");
    var metadataSignature = [selected.mode, source.label, source.tooltip, status, providerName,
      snapshot.configuration.showComparison, differenceText].join("|");

    if (metadataSignature !== lastMetadata) {
      sourceLabel.textContent = source.label;
      sourceLabel.title = source.tooltip;
      selector.title = source.tooltip;
      sourceStatus.textContent = statusLabel(status) + (selected.available ? " · " + providerName : "");
      sourceStatus.dataset.status = status;
      sourceStatus.title = network.provenanceNote || source.tooltip;
      differenceOutput.hidden = snapshot.configuration.showComparison === false;
      differenceOutput.textContent = differenceAvailable
        ? text("Selisih Gedung ↔ ISP ", "Building ↔ ISP Difference ") + differenceText
        : text("Selisih Gedung ↔ ISP tidak tersedia", "Building ↔ ISP Difference unavailable");
      differenceOutput.dataset.status = differenceAvailable ? status : "unavailable";
      differenceOutput.title = text(
        "Diferensiasi waktu berbasis longitude; tidak mengubah UTC, timezone global, timestamp provider, atau koordinat.",
        "Longitude-derived time difference; it does not change UTC, the global timezone, provider timestamp, or coordinates."
      );
      clock.dataset.displayMode = selected.mode;
      lastMetadata = metadataSignature;
    }
  }

  function applyDisplayMode(displayMode) {
    if (!window.MpmTimeCoordinateCalibration) { return Promise.resolve(null); }
    var normalized = displayMode === "building-coordinate-calibrated"
      ? "building-coordinate-calibrated" : "isp";
    return window.MpmTimeCoordinateCalibration.configure({ actualTimeDisplayMode: normalized });
  }

  function localizeSelector(selector) {
    byId("actualTimeDisplayLabel").textContent = text("Sumber Waktu", "Time Source");
    var ispOption = selector.querySelector('option[value="isp"]');
    var buildingOption = selector.querySelector('option[value="building-coordinate-calibrated"]');
    if (ispOption) { ispOption.textContent = "ISP / Provider"; }
    if (buildingOption) { buildingOption.textContent = text("Kalibrasi Gedung", "Building Calibration"); }
  }

  function initialize() {
    if (!window.MpmTimeCoordinateCalibration || unsubscribe) { return; }
    var selector = byId("actualTimeDisplayMode");
    if (!selector) { return; }
    localizeSelector(selector);
    selector.addEventListener("change", function () {
      applyDisplayMode(selector.value);
    });
    unsubscribe = window.MpmTimeCoordinateCalibration.subscribe(render);
    window.MpmTimeCoordinateCalibration.initialize().then(render);
  }

  window.MpmIndexTimeCalibration = {
    initialize: initialize,
    render: render,
    applyDisplayMode: applyDisplayMode
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else { initialize(); }
})(window, document);
