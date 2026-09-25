(function (window, document) {
  "use strict";

  var API_URL = "api/meep-bms.php";
  var ATTACHMENT_URL = "api/meep-bms-attachment.php";
  var runtimeMode = (window.MpmMeepRuntime || {}).mode || "auto";
  var staticMode = !window.MpmViewer && (runtimeMode === "static" || (runtimeMode === "auto" &&
    (window.location.protocol === "file:" || /(^|\.)github\.io$/i.test(window.location.hostname))));
  var CACHE_PREFIX = "mpm:meep-bms:snapshot:v1:";
  var BUILDING_SELECTION_KEY = "mpm:meep-bms:selected-building:v1";
  var state = {
    context: null,
    buildingCatalog: null,
    selectedBuildingKey: "",
    data: null,
    searchCandidates: [],
    selectedDeviceId: null,
    busy: false,
    reloadPromise: null,
    reloadQueued: false,
    queuedToast: false,
    actorId: actorId()
  };

  function byId(id) { return document.getElementById(id); }
  function q(selector, root) { return (root || document).querySelector(selector); }
  function qa(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function text(value) { return value === undefined || value === null ? "" : String(value); }
  function tr(id,en) { return document.documentElement.lang === "en" ? en : id; }
  function number(value) { if (value === null || value === undefined || String(value).trim() === "") return null; var parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
  function escapeHtml(value) {
    return text(value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character];
    });
  }
  function safeUrl(value) {
    try { var url = new URL(text(value), window.location.href); return /^https?:$/.test(url.protocol) ? url.href : ""; } catch (error) { return ""; }
  }
  function actorId() {
    var key = "mpm:meep-bms:actor:v1";
    try {
      var existing = window.localStorage.getItem(key);
      if (existing) { return existing; }
      var created = "bms-" + randomId();
      window.localStorage.setItem(key, created);
      return created;
    } catch (error) { return "bms-browser"; }
  }
  function randomId() {
    if (window.crypto && window.crypto.randomUUID) { return window.crypto.randomUUID(); }
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }
  function requestId() { return "meep:" + randomId(); }
  function formatNumber(value, maximum) {
    var parsed = number(value);
    if (parsed === null) { return "—"; }
    return new Intl.NumberFormat(document.documentElement.lang === "en" ? "en-US" : "id-ID", { maximumFractionDigits: maximum === undefined ? 3 : maximum }).format(parsed);
  }
  function formatUnit(value, unit, maximum) { return number(value) === null ? "—" : formatNumber(value, maximum) + " " + unit; }
  function formatDate(value, withTime) {
    if (!value) { return "—"; }
    var normalized = text(value).replace(" ", "T");
    var date = new Date(normalized);
    if (Number.isNaN(date.getTime())) { return text(value); }
    return new Intl.DateTimeFormat(document.documentElement.lang === "en" ? "en-US" : "id-ID", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
  }
  function isoDate(date) {
    var offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }
  function localDateTime(date) {
    var offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
  }
  function currency(value, code) {
    var parsed = number(value);
    if (parsed === null) { return "—"; }
    var currencyCode = /^[A-Z]{3}$/.test(text(code).toUpperCase()) ? text(code).toUpperCase() : "IDR";
    try { return new Intl.NumberFormat(document.documentElement.lang === "en" ? "en-US" : "id-ID", { style: "currency", currency: currencyCode, maximumFractionDigits: 2 }).format(parsed); }
    catch (error) { return currencyCode + " " + formatNumber(parsed, 2); }
  }
  function valueOrNull(value) { return text(value).trim() === "" ? null : value; }

  function setConnection(message, kind) {
    var node = byId("meepConnectionStatus");
    if(window.MpmViewer?.isViewer()){message=tr('Demo Viewer · data contoh hanya baca','Viewer demo · read-only example data');kind='ok';}
    node.textContent = window.PrayerI18n ? window.PrayerI18n.uiText(message) : message;
    node.classList.toggle("is-ok", kind === "ok");
    node.classList.toggle("is-warn", kind === "warn");
  }
  function toast(message, isError) {
    var node = byId("meepToast");
    node.textContent = window.PrayerI18n ? window.PrayerI18n.uiText(message) : message;
    node.classList.toggle("is-error", Boolean(isError));
    node.hidden = false;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(function () { node.hidden = true; }, 4800);
  }

  function api(action, payload) {
    if (staticMode && !window.MpmViewer) { return Promise.reject(new Error("Database operations require the PHP backend.")); }
    var clientRequestId = requestId();
    return window.fetch(API_URL, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Actor-Id": state.actorId,
        "X-Client-Request-Id": clientRequestId
      },
      body: JSON.stringify({ action: action, context: state.context || {}, payload: payload || {}, actorId: state.actorId, clientRequestId: clientRequestId })
    }).then(function (response) {
      return response.json().catch(function () { return { success: false, error: "Respons server bukan JSON." }; }).then(function (body) {
        if (!response.ok || body.success === false) { throw new Error(body.error || "Permintaan MEEP gagal."); }
        return body.data;
      });
    });
  }

  function contextKey() {
    var site = state.data && state.data.site;
    if (site && site.scopeKey) { return text(site.scopeKey).replace(/[^A-Za-z0-9._:-]/g, "_"); }
    var building = state.context && state.context.building;
    var mosque = state.context && state.context.mosque;
    if (building && building.id) { return "building:" + building.id; }
    return mosque && mosque.id ? "mosque:" + mosque.id : "unselected";
  }
  function contextSignature(context) {
    var value = context || {};
    var mosque = value.mosque || {};
    var building = value.building || {};
    var location = value.location || {};
    return JSON.stringify({
      mosqueId: mosque.id || value.mosqueId || null,
      mosqueName: mosque.name || "",
      buildingId: building.id || value.buildingId || null,
      buildingName: building.name || "",
      country: location.country || location.adm0 || "",
      province: location.province || location.adm1 || "",
      city: location.city || location.adm2 || "",
      latitude: location.latitude === undefined ? null : location.latitude,
      longitude: location.longitude === undefined ? null : location.longitude,
      timezone: location.timezone || ""
    });
  }
  function saveSnapshot(data) {
    try {
      var compact = JSON.stringify(data);
      if (compact.length <= 1800000) { window.localStorage.setItem(CACHE_PREFIX + contextKey(), compact); }
    } catch (error) { /* Cache failure must never interrupt the SQL-backed UI. */ }
  }
  function loadSnapshot() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(CACHE_PREFIX + contextKey()) || "null");
      return parsed && parsed.schemaVersion === "mpm.meep-simplify-bms.v1" ? parsed : null;
    } catch (error) { return null; }
  }

  function selectedBuildingRecord(key) {
    var records = state.buildingCatalog && state.buildingCatalog.buildings ? state.buildingCatalog.buildings : [];
    return records.find(function (record) { return record.selectionKey === key; }) || null;
  }
  function contextForBuilding(record) {
    var identity = {
      id: record.recordId,
      name: record.displayName,
      type: record.typeKey || "",
      typeLabel: record.typeName || "",
      version: record.version || 1
    };
    var context = {
      schemaVersion: "mpm.meep-selected-building.v1",
      source: "rdbms-" + record.recordType,
      location: {
        continent: record.continent || "",
        country: record.country || "",
        province: record.adm1 || "",
        city: record.adm2 || "",
        adm0: record.country || "",
        adm1: record.adm1 || "",
        adm2: record.adm2 || "",
        latitude: record.latitude,
        longitude: record.longitude,
        coordinateSource: record.coordinateSource || "database"
      }
    };
    context[record.recordType === "building" ? "building" : "mosque"] = identity;
    return context;
  }
  function storedBuildingKey() {
    try { return window.localStorage.getItem(BUILDING_SELECTION_KEY) || ""; } catch (error) { return ""; }
  }
  function storeBuildingKey(key) {
    try { window.localStorage.setItem(BUILDING_SELECTION_KEY, key); } catch (error) { /* SQL remains authoritative. */ }
  }
  function showBuildingContent(active) {
    qa("[data-meep-building-content]").forEach(function (node) { node.hidden = !active; });
    byId("meepSelectionRequired").hidden = active;
  }
  function renderBuildingCatalog() {
    var catalog = state.buildingCatalog || { buildings: [], buildingTypes: [] };
    var general = catalog.buildings.filter(function (record) { return record.recordType === "building"; });
    var mosques = catalog.buildings.filter(function (record) { return record.recordType === "mosque"; });
    function options(records) {
      return records.map(function (record) {
        var location = [record.adm2, record.adm1, record.country].filter(Boolean).join(", ");
        var label = record.displayName + " · " + (record.typeName || record.typeKey || "Gedung") + (location ? " · " + location : "");
        return "<option value=\"" + escapeHtml(record.selectionKey) + "\">" + escapeHtml(label) + "</option>";
      }).join("");
    }
    var markup = "<option value=\"\">Pilih gedung…</option>";
    if (general.length) { markup += "<optgroup label=\"Master gedung\">" + options(general) + "</optgroup>"; }
    if (mosques.length) { markup += "<optgroup label=\"Gedung masjid tersimpan\">" + options(mosques) + "</optgroup>"; }
    byId("meepBuildingSelect").innerHTML = markup;
    byId("meepBuildingSelect").value = selectedBuildingRecord(state.selectedBuildingKey) ? state.selectedBuildingKey : "";
    var typeSelect = q('[name="buildingTypeId"]', byId("buildingForm"));
    typeSelect.innerHTML = "<option value=\"\">Pilih tipe…</option>" + catalog.buildingTypes.map(function (type) {
      return "<option value=\"" + type.buildingTypeId + "\">" + escapeHtml(type.displayName) + "</option>";
    }).join("");
    byId("meepBuildingCatalogStatus").textContent = window.MpmViewer?.isViewer()?tr('Gedung contoh untuk demonstrasi','Example building for demonstration'):catalog.buildings.length + " gedung tersedia · tersinkronisasi dari RDBMS";
  }
  function chooseBuilding(key, showToast) {
    var record = selectedBuildingRecord(key);
    if (!record) {
      state.context = null;
      state.data = null;
      state.selectedBuildingKey = "";
      byId("meepEditBuildingButton").hidden = true;
      showBuildingContent(false);
      setConnection("SQL aktif · pilih gedung", "ok");
      return Promise.resolve();
    }
    setConnection("Menyimpan pilihan gedung ke SQL…", "warn");
    return api("select_building", { selectionKey: record.selectionKey }).then(function (selection) {
      state.selectedBuildingKey = selection.selectionKey;
      var locationUrl=new URL(window.location.href);locationUrl.searchParams.set("building",selection.selectionKey);history.replaceState(history.state,"",locationUrl);
      state.context = selection.context || contextForBuilding(record);
      storeBuildingKey(selection.selectionKey);
      byId("meepBuildingSelect").value = selection.selectionKey;
      byId("meepEditBuildingButton").hidden = record.recordType !== "building";
      showBuildingContent(true);
      return reload(false);
    }).then(function () {
      if (showToast) { toast((window.MpmViewer?.isViewer()?tr('Gedung contoh dipilih: ','Demo building selected: '):tr("Gedung aktif tersimpan di RDBMS: ","Selected building saved: ")) + record.displayName + "."); }
    }).catch(function (error) {
      setConnection("Pemilihan gedung gagal", "warn");
      toast(error.message, true);
    });
  }
  function loadBuildingCatalog(preferredKey, activate) {
    setConnection("Membaca master gedung SQL…", "warn");
    return api("building_catalog", {}).then(function (catalog) {
      state.buildingCatalog = catalog;
      renderBuildingCatalog();
      var key = preferredKey || catalog.selectedBuildingKey || "";
      if (activate && selectedBuildingRecord(key)) { return chooseBuilding(key, false); }
      state.context = null;
      state.data = null;
      state.selectedBuildingKey = "";
      byId("meepEditBuildingButton").hidden = true;
      showBuildingContent(false);
      setConnection("SQL aktif · pilih gedung", "ok");
    }).catch(function (error) {
      setConnection("SQL gedung tidak tersedia", "warn");
      byId("meepBuildingCatalogStatus").textContent = error.message;
      toast(error.message, true);
    });
  }

  function reload(showToast) {
    if (!state.context) {
      showBuildingContent(false);
      setConnection("SQL aktif · pilih gedung", "ok");
      return Promise.resolve();
    }
    if (state.busy) {
      state.reloadQueued = true;
      state.queuedToast = state.queuedToast || Boolean(showToast);
      return state.reloadPromise || Promise.resolve();
    }
    state.busy = true;
    var requestedContext = contextSignature(state.context);
    setConnection("Sinkronisasi SQL…", "warn");
    state.reloadPromise = api("bootstrap", {}).then(function (data) {
      if (requestedContext !== contextSignature(state.context)) {
        state.reloadQueued = true;
        state.queuedToast = state.queuedToast || Boolean(showToast);
        return;
      }
      state.data = data;
      state.searchCandidates = activeCandidates(data.recentCandidates);
      saveSnapshot(data);
      renderAll();
      setConnection(tr("SQL aktif · ","Database online · ") + formatDate(data.serverDate, true), "ok");
      if (showToast) { toast("Data MEEP berhasil dimuat ulang."); }
    }).catch(function (error) {
      var cached = loadSnapshot();
      if (cached) {
        state.data = cached;
        state.searchCandidates = activeCandidates(cached.recentCandidates);
        renderAll();
        setConnection("Offline · snapshot terakhir", "warn");
        toast("SQL tidak tersedia. Menampilkan snapshot terakhir tanpa mengubah database.", true);
      } else {
        setConnection("SQL tidak tersedia", "warn");
        toast(error.message, true);
      }
    }).finally(function () {
      state.busy = false;
      state.reloadPromise = null;
      if (state.reloadQueued) {
        var nextToast = state.queuedToast;
        state.reloadQueued = false;
        state.queuedToast = false;
        return reload(nextToast);
      }
    });
    return state.reloadPromise;
  }

  function renderAll() {
    if (!state.data) { return; }
    restoreBudget();
    renderScope();
    renderSummary();
    renderDevices();
    renderMeters();
    renderMaintenance();
    renderSpecifications();
    populateSelects();
    renderEnergyBudget();
    restoreRoute();
  }

  function renderScope() {
    var site = state.data.site || {};
    var location = (site.context && site.context.location) || (state.context && state.context.location) || {};
    var segments = [location.adm2 || location.city, location.adm1 || location.province, location.adm0 || location.country].filter(Boolean);
    byId("meepScopeText").textContent = (site.displayName || "Building aktif") + (segments.length ? " · " + segments.join(", ") : "") + " · scope " + (site.scopeKey || "lokal");
  }

  function renderSummary() {
    var summary = state.data.summary || {};
    byId("summaryDevices").textContent = formatNumber(summary.totalDevices, 3);
    byId("summaryDeviceRecords").textContent = formatNumber(summary.deviceRecords, 0) + tr(" record perangkat"," device records");
    byId("summaryConnected").textContent = formatUnit(summary.connectedLoadW, "W", 2);
    byId("summaryUnknownLoad").textContent = formatNumber(summary.unknownLoadDevices, 0) + tr(" belum terhitung"," incomplete");
    byId("summaryDemand").textContent = formatUnit(summary.estimatedDemandW, "W", 2);
    byId("summaryEnergy").textContent = formatUnit(summary.estimatedDailyKwh, tr("kWh/hari","kWh/day"), 3);
    byId("summaryMonthly").textContent = formatUnit(summary.estimatedMonthlyKwh, tr("kWh/bulan","kWh/month"), 3);
    byId("summaryMeters").textContent = summary.meterStatus === "active" ? "Aktif" : "Belum ada";
    byId("summaryMeterCount").textContent = formatNumber(summary.meterCount, 0) + " meter";
    byId("summaryMaintenance").textContent = formatNumber(summary.maintenanceDue, 0);
    byId("summaryOverdue").textContent = formatNumber(summary.maintenanceOverdue, 0) + " overdue";
  }

  function maintenanceLabel(status) {
    return { overdue: "Overdue", due: "Maintenance Due", scheduled: "Terjadwal", "not-scheduled": "Belum dijadwalkan" }[status] || text(status || "Aktif");
  }
  function statusClass(status) {
    return status === "overdue" ? "is-bad" : status === "due" ? "is-warn" : status === "scheduled" || status === "active" ? "is-ok" : "";
  }
  function deviceRated(device) {
    return number(device.ratedInputW) !== null ? device.ratedInputW : device.claimedPowerW;
  }
  function deviceById(id) {
    return (state.data.devices || []).find(function (device) { return Number(device.installedDeviceId) === Number(id); }) || null;
  }
  function meterById(id) {
    return (state.data.meters || []).find(function (meter) { return Number(meter.meterId) === Number(id); }) || null;
  }

  function renderDevices() {
    var search = text(byId("deviceSearchInput").value).trim().toLowerCase();
    var discipline = byId("deviceDisciplineFilter").value;
    var devices = (state.data.devices || []).filter(function (device) {
      var haystack = [device.deviceName, device.brandName, device.modelName, device.seriesName, device.locationName, device.productType, device.assetCode].join(" ").toLowerCase();
      return (!search || haystack.indexOf(search) !== -1) && (!discipline || device.disciplineKey === discipline);
    });
    byId("deviceEmptyState").hidden = devices.length > 0;
    byId("deviceTableBody").innerHTML = devices.map(function (device) {
      var calc = device.calculation || {};
      return "<tr>" +
        "<td><span class=\"row-title\"><strong>" + escapeHtml(device.deviceName) + "</strong><small>" + escapeHtml(device.productType) + " · " + escapeHtml(device.disciplineKey) + (device.assetCode ? " · " + escapeHtml(device.assetCode) : "") + "</small></span></td>" +
        "<td>" + escapeHtml(device.brandName || "—") + "</td>" +
        "<td>" + escapeHtml([device.modelName, device.seriesName].filter(Boolean).join(" / ") || "—") + "</td>" +
        "<td>" + escapeHtml(device.locationName) + "</td>" +
        "<td>" + formatUnit(deviceRated(device), "W", 3) + "<div class=\"muted-cell\">" + escapeHtml(device.powerValueSource || "") + "</div></td>" +
        "<td>" + formatNumber(device.quantity, 3) + "</td>" +
        "<td>" + formatUnit(calc.connectedLoadW, "W", 3) + "<div class=\"muted-cell\">" + formatUnit(calc.monthlyKwh, "kWh/bln", 3) + "</div></td>" +
          "<td>" + escapeHtml(budgetCost(calc.monthlyKwh)) + "</td>" +
          "<td>" + formatDate(device.lastService, false) + "</td>" +
        "<td>" + formatDate(device.nextService, false) + "</td>" +
        "<td><span class=\"status-chip " + statusClass(device.maintenanceStatus) + "\">" + maintenanceLabel(device.maintenanceStatus) + "</span></td>" +
        "<td><span class=\"row-actions\"><button type=\"button\" data-device-action=\"detail\" data-id=\"" + device.installedDeviceId + "\">Detail</button><button type=\"button\" data-device-action=\"edit\" data-id=\"" + device.installedDeviceId + "\">Edit</button><button type=\"button\" data-device-action=\"service\" data-id=\"" + device.installedDeviceId + "\">Service</button></span></td>" +
        "</tr>";
    }).join("");
  }

  function renderMeters() {
    var meters = state.data.meters || [];
    byId("meterEmptyState").hidden = meters.length > 0;
    byId("meterTableBody").innerHTML = meters.map(function (meter) {
      var reading = meter.latestReading || {};
      return "<tr><td><span class=\"row-title\"><strong>" + escapeHtml(meter.meterName) + "</strong><small>" + escapeHtml(meter.meterNumber) + "</small></span></td>" +
        "<td>" + escapeHtml(meter.meterTypeKey) + "</td><td>" + formatNumber(meter.phaseCount, 0) + " phase</td><td>" + formatUnit(meter.capacityVa, "VA", 0) + "</td>" +
        "<td>" + (number(meter.tariffPerKwh) === null ? "—" : currency(meter.tariffPerKwh, meter.currencyCode) + "/kWh") + "<div class=\"muted-cell\">" + escapeHtml(meter.tariffClass || "") + "</div></td>" +
        "<td>" + formatUnit(reading.closingKwh, "kWh", 3) + "</td><td>" + formatUnit(reading.consumptionKwh, "kWh", 3) + "</td><td>" + currency(reading.estimatedCost, reading.currencyCode || meter.currencyCode) + "</td>" +
        "<td><span class=\"row-actions\"><button type=\"button\" data-meter-action=\"reading\" data-id=\"" + meter.meterId + "\">Catat</button><button type=\"button\" data-meter-action=\"edit\" data-id=\"" + meter.meterId + "\">Edit</button></span></td></tr>";
    }).join("");
    var readings = [];
    meters.forEach(function (meter) { (meter.readings || []).forEach(function (reading) { readings.push({ meter: meter, reading: reading }); }); });
    readings.sort(function (a, b) { return text(b.reading.readingAt).localeCompare(text(a.reading.readingAt)); });
    byId("readingHistoryBody").innerHTML = readings.length ? readings.map(function (item) {
      var reading = item.reading;
      return "<tr><td>" + escapeHtml(item.meter.meterName) + "</td><td>" + formatDate(reading.periodStart, false) + " – " + formatDate(reading.periodEnd, false) + "</td><td>" + formatNumber(reading.openingKwh, 3) + "</td><td>" + formatNumber(reading.closingKwh, 3) + "</td><td>" + formatNumber(reading.consumptionKwh, 3) + "</td><td>" + currency(reading.estimatedCost, reading.currencyCode) + "</td><td>" + formatDate(reading.readingAt, true) + "</td></tr>";
    }).join("") : "<tr class=\"empty-row\"><td colspan=\"7\">Belum ada pembacaan.</td></tr>";
  }

  function renderMaintenance() {
    var filter = byId("maintenanceStatusFilter").value;
    var rows = (state.data.maintenanceHistory || []).filter(function (record) {
      var device = deviceById(record.installedDeviceId);
      return !filter || (device && device.maintenanceStatus === filter);
    });
    byId("maintenanceEmptyState").hidden = rows.length > 0;
    byId("maintenanceTableBody").innerHTML = rows.map(function (record) {
      var device = deviceById(record.installedDeviceId) || {};
      var attachments = record.attachments || [];
      var attachmentHtml = attachments.length ? attachments.map(function (attachment) {
        return "<a href=\"" + escapeHtml(attachment.publicUrl) + "\" target=\"_blank\" rel=\"noopener\">" + escapeHtml(attachment.originalName) + "</a>";
      }).join("<br>") : "—";
      return "<tr><td>" + escapeHtml(device.deviceName || ("#" + record.installedDeviceId)) + "</td><td>" + escapeHtml(record.serviceType) + "</td><td>" + escapeHtml(record.maintenanceKind) + "</td><td>" + formatDate(record.serviceDate, true) + "</td><td>" + escapeHtml(record.workPerformed) + "</td><td>" + escapeHtml(record.technicianVendor || "—") + "</td><td>" + currency(record.costAmount, record.currencyCode) + "</td><td>" + formatDate(record.nextServiceDate, false) + "</td><td>" + attachmentHtml + "</td></tr>";
    }).join("");
  }

  function renderSpecifications() {
    var specs = state.data.specifications || [];
    byId("verifiedSpecificationList").innerHTML = specs.length ? specs.map(function (spec) {
      var source = safeUrl(spec.sourceUrl);
      return "<article class=\"verified-spec\"><div class=\"spec-copy\"><strong>" + escapeHtml(spec.detectedBrand + " · " + spec.modelName + (spec.seriesName ? " · " + spec.seriesName : "")) + "</strong><small>" + escapeHtml(spec.productType) + " · " + formatUnit(spec.ratedInputW || spec.claimedPowerW, "W", 3) + " · " + escapeHtml(spec.verificationStatus) + " · verified " + escapeHtml(formatDate(spec.verifiedAt, true)) + "</small>" + (source ? "<a href=\"" + escapeHtml(source) + "\" target=\"_blank\" rel=\"noopener\">" + escapeHtml(spec.sourceTitle || source) + "</a>" : "") + sourceFieldsHtml(spec) + "</div><button type=\"button\" data-use-spec=\""+spec.specificationId+"\">"+tr("Gunakan untuk perangkat","Use for device")+"</button><span class=\"status-chip is-ok\">Cached</span></article>";
    }).join("") : "<p class=\"empty-state\">Belum ada spesifikasi yang diterima.</p>";
    renderCandidateList(state.searchCandidates || []);
  }

  function activeCandidates(candidates) {
    return (candidates || []).filter(function (candidate) { return candidate.reviewStatus === "pending"; });
  }
  function renderCandidateList(candidates) {
    candidates = activeCandidates(candidates);
    var container = byId("specificationResults");
    if (!candidates.length) { container.innerHTML = ""; return; }
    container.innerHTML = candidates.map(function (candidate) {
      var source = safeUrl(candidate.sourceUrl);
      var pending = candidate.reviewStatus === "pending";
      var values = [
        formatUnit(candidate.ratedPowerW, "W", 3), formatUnit(candidate.voltageV, "V", 3),
        formatUnit(candidate.currentA, "A", 3), formatUnit(candidate.capacityValue, candidate.capacityUnit || "", 3)
      ].filter(function (item) { return item !== "—"; });
      var modeNames={cooking:tr('Memasak','Cooking'),warming:tr('Menghangatkan','Warming'),standby:'Standby',sleep:'Sleep',typical:tr('Normal','Typical'),maximum:tr('Maksimum','Maximum')};
      Object.keys(candidate.powerModes || {}).forEach(function(mode){ values.push((modeNames[mode]||mode)+': '+formatUnit(candidate.powerModes[mode],'W',3)); });
      var supply=candidate.adapterOutput || candidate.supplyRating;
      if(supply) values.push(tr('Rating catu daya (bukan konsumsi): ','Supply rating (not consumption): ')+formatUnit(supply.voltageV,'V',3)+' / '+formatUnit(supply.currentA,'A',3));
      if(number(candidate.outputPowerW)!==null) values.push(tr('Daya keluaran: ','Output power: ')+formatUnit(candidate.outputPowerW,'W',3));
      if(number(candidate.ratedPowerW)===null) values.push(tr('Konsumsi Watt belum diketahui','Watt consumption unknown'));
      if(candidate.matchStatus==='variant') values.unshift(tr('Varian dari pencarian: ','Variant of search: ')+(candidate.requestedModel||''));
      return "<article class=\"spec-candidate\"><div class=\"spec-copy\"><strong>" + escapeHtml(candidate.detectedBrand + " · " + candidate.detectedModel + (candidate.detectedSeries ? " · " + candidate.detectedSeries : "")) + "</strong>" +
        "<div class=\"spec-meta\"><span>" + escapeHtml(candidate.productType || candidate.productTypeQuery || "") + "</span><span>" + escapeHtml(candidate.sourceKind) + "</span><span>confidence " + formatNumber(number(candidate.confidenceScore) * 100, 1) + "%</span><span>" + escapeHtml(candidate.reviewStatus) + "</span><span>ditemukan " + escapeHtml(formatDate(candidate.discoveredAt, true)) + "</span>" + values.map(function (item) { return "<span>" + escapeHtml(item) + "</span>"; }).join("") + "</div>" +
        (source ? "<a href=\"" + escapeHtml(source) + "\" target=\"_blank\" rel=\"noopener\">" + escapeHtml(candidate.sourceTitle || source) + "</a>" : "") +
        sourceFieldsHtml(candidate) + "<details><summary>"+tr('Kutipan sumber','Source excerpt')+"</summary><small>" + escapeHtml(candidate.evidenceExcerpt || "Tidak ada snippet; buka sumber untuk pemeriksaan manual.") + "</small></details></div>" +
        (pending ? "<div class=\"row-actions\"><button type=\"button\" data-spec-action=\"accept\" data-id=\"" + candidate.candidateId + "\">Accept</button><button type=\"button\" data-spec-action=\"edit\" data-id=\"" + candidate.candidateId + "\">Edit</button><button type=\"button\" data-spec-action=\"reject\" data-id=\"" + candidate.candidateId + "\">Reject</button></div>" : "<span class=\"status-chip " + (candidate.reviewStatus === "accepted" ? "is-ok" : "is-bad") + "\">" + escapeHtml(candidate.reviewStatus) + "</span>") + "</article>";
    }).join("");
  }

  function sourceFieldsHtml(item) {
    var fields=item.sourceFields||{}, keys=Object.keys(fields);
    if(!keys.length)return '';
    return '<details><summary>'+tr('Spesifikasi dari sumber','Source specifications')+' ('+keys.length+')</summary><div class="table-wrap"><table><tbody>'+keys.map(function(k){return '<tr><th>'+escapeHtml(k)+'</th><td>'+escapeHtml(fields[k])+'</td></tr>';}).join('')+'</tbody></table></div></details>';
  }

  function populateSelects() {
    var deviceOptions = (state.data.devices || []).map(function (device) { return "<option value=\"" + device.installedDeviceId + "\">" + escapeHtml(device.deviceName + " · " + device.locationName) + "</option>"; }).join("");
    q('[name="installedDeviceId"]', byId("maintenanceForm")).innerHTML = "<option value=\"\">Pilih perangkat</option>" + deviceOptions;
    var meterOptions = (state.data.meters || []).map(function (meter) { return "<option value=\"" + meter.meterId + "\">" + escapeHtml(meter.meterName + " · " + meter.meterNumber) + "</option>"; }).join("");
    q('[name="meterId"]', byId("readingForm")).innerHTML = "<option value=\"\">Pilih meter</option>" + meterOptions;
    q('[name="specificationId"]', byId("deviceForm")).innerHTML = "<option value=\"\">Input manual / pengukuran</option>" + (state.data.specifications || []).map(function (spec) {
      return "<option value=\"" + spec.specificationId + "\">" + escapeHtml(spec.detectedBrand + " · " + spec.modelName + " · " + formatUnit(spec.ratedInputW || spec.claimedPowerW, "W", 3)) + "</option>";
    }).join("");
    byId("meterCapacityOptions").innerHTML = (state.data.powerCapacities || []).map(function (capacity) { return "<option value=\"" + capacity.capacityVa + "\">" + escapeHtml(capacity.capacityLabel + " · " + capacity.phaseKey) + "</option>"; }).join("");
  }

  function formObject(form) {
    var object = {};
    new FormData(form).forEach(function (value, key) {
      if (value instanceof File) { return; }
      object[key] = valueOrNull(value);
    });
    return object;
  }

  function showDialog(id) {
    var dialog = byId(id);
    if (dialog && !dialog.open) { dialog.showModal(); }
  }
  function closeDialog(id) { var dialog = byId(id); if (dialog && dialog.open) { dialog.close(); } }

  function openBuilding(record) {
    var form = byId("buildingForm");
    form.reset();
    q('[name="buildingId"]', form).value = "";
    q('[name="version"]', form).value = "";
    byId("buildingDialogTitle").textContent = record ? "Edit gedung" : "Tambah gedung";
    if (record) {
      var mapping = {
        buildingId: "recordId", version: "version", buildingName: "displayName",
        buildingTypeId: "buildingTypeId", continent: "continent", country: "country",
        adm1: "adm1", adm2: "adm2", latitude: "latitude", longitude: "longitude",
        coordinateSource: "coordinateSource", additionalInformation: "additionalInformation"
      };
      Object.keys(mapping).forEach(function (field) {
        var input = q('[name="' + field + '"]', form);
        var value = record[mapping[field]];
        if (input) { input.value = value === null || value === undefined ? "" : value; }
      });
    }
    showDialog("buildingDialog");
  }

  function saveBuilding(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var submit = q('[type="submit"]', form);
    submit.disabled = true;
    api("save_building", formObject(form)).then(function (record) {
      closeDialog("buildingDialog");
      return loadBuildingCatalog(record.selectionKey, true).then(function () {
        toast("Gedung tersimpan di RDBMS dan dijadikan gedung aktif.");
      });
    }).catch(function (error) {
      toast(error.message, true);
    }).finally(function () { submit.disabled = false; });
  }

  function openDevice(device) {
    var form = byId("deviceForm");
    form.reset();
    q('[name="installedDeviceId"]', form).value = "";
    q('[name="quantity"]', form).value = "1";
    q('[name="operatingHoursDay"]', form).value = "0";
    q('[name="operatingDaysMonth"]', form).value = "30";
    q('[name="demandFactor"]', form).value = "1";
    byId("deviceDialogTitle").textContent = device ? "Edit perangkat" : "Tambah perangkat";
    if (device) {
      Object.keys(device).forEach(function (key) { var input = q('[name="' + key + '"]', form); if (input && device[key] !== null) { input.value = device[key]; } });
      q('[name="ratedInputKw"]', form).value = number(device.ratedInputW) === null ? "" : Number(device.ratedInputW) / 1000;
      q('[name="apparentPowerKva"]', form).value = number(device.apparentPowerVa) === null ? "" : Number(device.apparentPowerVa) / 1000;
    }
    renderDeviceCalculation();
    showDialog("deviceDialog");
  }

  function applySpecification() {
    var form = byId("deviceForm");
    var id = q('[name="specificationId"]', form).value;
    var spec = (state.data.specifications || []).find(function (item) { return String(item.specificationId) === String(id); });
    if (!spec) { return; }
    var mapping = {
      brandName: "detectedBrand", modelName: "modelName", seriesName: "seriesName", productType: "productType",
      phaseCount: "phaseCount", voltageV: "voltageV", currentA: "currentA", claimedPowerW: "claimedPowerW",
      ratedInputW: "ratedInputW", apparentPowerVa: "apparentPowerVa", capacityValue: "capacityValue",
      capacityUnit: "capacityUnit", frequencyHz: "frequencyHz", powerFactor: "powerFactor",
      specificationSource: "sourceUrl"
    };
    Object.keys(mapping).forEach(function (target) { var input = q('[name="' + target + '"]', form); var value = spec[mapping[target]]; if (input) { input.value = value === null || value === undefined ? "" : value; } });
    var electronics=['Laptop','Desktop computer','Monitor','Printer','Scanner','Router','Network switch','Access point','Camera','Speaker','Amplifier','Projector','Game console','Television'];
    q('[name="disciplineKey"]',form).value=electronics.indexOf(spec.productType)!==-1 ? 'electronica' : 'electrical';
    q('[name="powerValueSource"]', form).value = "manufacturer-specification";
    q('[name="ratedInputKw"]', form).value = number(spec.ratedInputW) === null ? "" : Number(spec.ratedInputW) / 1000;
    q('[name="apparentPowerKva"]', form).value = number(spec.apparentPowerVa) === null ? "" : Number(spec.apparentPowerVa) / 1000;
    renderDeviceCalculation();
  }

  function useSpecification(id) {
    openDevice(null);
    q('[name="specificationId"]',byId("deviceForm")).value=id;
    applySpecification();
    var spec=(state.data.specifications||[]).find(function(s){return String(s.specificationId)===String(id);});
    if(spec)q('[name="deviceName"]',byId("deviceForm")).value=[spec.detectedBrand,spec.modelName].join(" ");
  }

  function computeElectric(input) {
    var phase = [1, 3].indexOf(Number(input.phaseCount)) !== -1 ? Number(input.phaseCount) : null;
    var voltage = positive(input.voltageV), current = positive(input.currentA), pf = positive(input.powerFactor);
    if (pf !== null && pf > 1) { pf = null; }
    var watts = positive(input.watts !== undefined ? input.watts : input.ratedInputW);
    var kw = positive(input.kilowatts), claimed = positive(input.claimedPowerW), measured = nonNegative(input.measuredPowerW);
    var apparent = positive(input.apparentPowerVa), kva = positive(input.kva);
    var quantity = positive(input.quantity) || 1;
    var energyKwh = nonNegative(input.energyKwh), energyPeriodHours = positive(input.energyPeriodHours);
    var base = watts !== null ? watts : (kw !== null ? kw * 1000 : claimed);
    if (base === null && measured !== null) { base = measured; }
    if (base === null && energyKwh !== null && energyPeriodHours !== null) { base = energyKwh * 1000 / (energyPeriodHours * quantity); }
    if (apparent === null && kva !== null) { apparent = kva * 1000; }
    if (apparent === null && voltage !== null && current !== null && phase !== null) { apparent = (phase === 3 ? Math.sqrt(3) : 1) * voltage * current; }
    if (base === null && apparent !== null && pf !== null) { base = apparent * pf; }
    if (apparent === null && base !== null && pf !== null) { apparent = base / pf; }
    if (current === null && apparent !== null && voltage !== null && phase !== null) { current = apparent / ((phase === 3 ? Math.sqrt(3) : 1) * voltage); }
    var hours = nonNegative(input.operatingHoursDay); if (hours === null) { hours = 0; } hours = Math.min(hours, 24);
    var days = nonNegative(input.operatingDaysMonth); if (days === null) { days = 30; } days = Math.min(days, 31);
    var demandFactor = nonNegative(input.demandFactor); if (demandFactor === null) { demandFactor = 1; } demandFactor = Math.min(demandFactor, 1);
    var connected = base === null ? null : base * quantity;
    var demand = connected === null ? null : connected * demandFactor;
    var energyBasis = measured !== null ? measured * quantity : (energyKwh!==null&&energyPeriodHours!==null?energyKwh*1000/energyPeriodHours:demand);
    var warning = base === null ? (apparent !== null && pf === null ? "VA tersedia, tetapi Watt/kWh memerlukan power factor atau nilai Watt." : "Daya aktif belum dapat dihitung dari data yang tersedia.") : "";
    if ((energyKwh === null) !== (energyPeriodHours === null)) { warning = "Input kWh memerlukan nilai kWh dan durasi pengukuran dalam jam."; }
    return {
      basePowerW: base, apparentPowerVa: apparent, currentA: current, connectedLoadW: connected, estimatedDemandW: demand,
      dailyKwh: energyBasis === null ? null : energyBasis * hours / 1000,
      monthlyKwh: energyBasis === null ? null : energyBasis * hours / 1000 * days,
      yearlyKwh: energyBasis === null ? null : energyBasis * hours / 1000 * 365,
      warning: warning
    };
  }
  function positive(value) { var parsed = number(value); return parsed !== null && parsed > 0 ? parsed : null; }
  function nonNegative(value) { var parsed = number(value); return parsed !== null && parsed >= 0 ? parsed : null; }

  function renderCalculator() {
    var input = formObject(byId("calculatorForm"));
    var result = computeElectric(input);
    byId("calcActivePower").textContent = formatUnit(result.basePowerW, "W", 6);
    byId("calcApparentPower").textContent = formatUnit(result.apparentPowerVa, "VA", 6);
    byId("calcCurrent").textContent = formatUnit(result.currentA, "A", 6);
    byId("calcConnected").textContent = formatUnit(result.connectedLoadW, "W", 6);
    byId("calcDemand").textContent = formatUnit(result.estimatedDemandW, "W", 6);
    byId("calcDaily").textContent = formatUnit(result.dailyKwh, "kWh", 6);
    byId("calcMonth").textContent = formatUnit(result.monthlyKwh, "kWh", 6);
    byId("calcYear").textContent = formatUnit(result.yearlyKwh, "kWh", 6);
    byId("calculatorWarnings").textContent = result.warning || "Perhitungan lengkap. Untuk estimasi aktual, isi hasil pengukuran Watt bila tersedia.";
    renderEnergyBudget();
  }

  var restoredBudgetKey = null;
  function budgetKey() { return "mpm:meep-bms:budget:v1:" + state.actorId + ":" + (state.selectedBuildingKey || "calculator"); }
  function restoreBudget() {
    var key = budgetKey();
    if (restoredBudgetKey === key) return;
    restoredBudgetKey = key;
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (error) {}
    byId("meepBudgetTariff").value = saved.tariff === undefined ? "" : saved.tariff;
    byId("meepBudgetCurrency").value = saved.currency || "IDR";
  }
  function budgetCost(kwh) {
    var tariff = number(byId("meepBudgetTariff").value), value = number(kwh);
    var code = byId("meepBudgetCurrency").value.trim().toUpperCase();
    return tariff !== null && tariff >= 0 && value !== null && /^[A-Z]{3}$/.test(code) ? currency(value * tariff, code) : "—";
  }
  function saveBudget() {
    try { localStorage.setItem(budgetKey(), JSON.stringify({tariff: byId("meepBudgetTariff").value, currency: byId("meepBudgetCurrency").value})); } catch (error) {}
    renderEnergyBudget();
    if (state.data) renderDevices();
  }
  function renderEnergyBudget() {
    if (!byId("meepBudgetTariff")) return;
    var tariff=number(byId("meepBudgetTariff").value),code=byId("meepBudgetCurrency").value.toUpperCase();
    var calc=computeElectric(formObject(byId("calculatorForm")));
    var summary=state.data&&state.data.summary;
      function cost(kwh){return budgetCost(kwh);}
    byId("meepIndividualCost").textContent=tr("Perhitungan saat ini: ","Current calculation: ")+cost(calc.dailyKwh)+tr(" / hari · "," / day · ")+cost(calc.monthlyKwh)+tr(" / bulan"," / month");
    var total=null,unknown=0;
    if(summary){total=0;(state.data.devices||[]).forEach(function(d){var value=d.calculation&&number(d.calculation.monthlyKwh);if(value===null||value===undefined)unknown++;else total+=value;});}
    byId("meepTotalCost").textContent=tr("Total perangkat gedung: ","Building equipment total: ")+cost(total)+tr(" / bulan"," / month")+(unknown?tr(" · belum termasuk "," · excludes ")+unknown+tr(" perangkat dengan data belum lengkap"," devices with incomplete data"):"");
  }

  function renderDeviceCalculation() {
    var form = byId("deviceForm");
    var input = formObject(form);
    if (number(input.ratedInputW) === null && number(input.ratedInputKw) !== null) { input.ratedInputW = Number(input.ratedInputKw) * 1000; }
    if (number(input.apparentPowerVa) === null && number(input.apparentPowerKva) !== null) { input.apparentPowerVa = Number(input.apparentPowerKva) * 1000; }
    var result = computeElectric(input);
    byId("deviceCalculationPreview").textContent = result.basePowerW === null ? result.warning : "Connected " + formatUnit(result.connectedLoadW, "W", 3) + " · demand " + formatUnit(result.estimatedDemandW, "W", 3) + " · " + formatUnit(result.dailyKwh, tr("kWh/hari","kWh/day"), 3) + " · " + formatUnit(result.monthlyKwh, tr("kWh/bulan","kWh/month"), 3);
    var spec=state.data && (state.data.specifications||[]).find(function(s){return String(s.specificationId)===String(input.specificationId);});
    if(spec && spec.powerBasis && spec.powerBasis!=='claimed-input') byId("deviceCalculationPreview").textContent+=tr(' · Basis daya: ',' · Power basis: ')+({cooking:tr('memasak','cooking'),maximum:tr('maksimum','maximum'),typical:tr('normal','typical')}[spec.powerBasis]||spec.powerBasis)+tr('; sesuaikan jam penggunaan dengan mode tersebut.','; match operating hours to this mode.');
  }

  function saveDevice(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var saveButton=form.querySelector('[type="submit"]');if(saveButton.disabled)return;saveButton.disabled=true;
    var payload = formObject(form);
    if (number(payload.ratedInputW) === null && number(payload.ratedInputKw) !== null) { payload.ratedInputW = Number(payload.ratedInputKw) * 1000; }
    if (number(payload.apparentPowerVa) === null && number(payload.apparentPowerKva) !== null) { payload.apparentPowerVa = Number(payload.apparentPowerKva) * 1000; }
    delete payload.ratedInputKw; delete payload.apparentPowerKva;
    api("save_device", payload).then(function () { closeDialog("deviceDialog"); toast("Perangkat dan snapshot kalkulasi tersimpan."); return reload(false); }).catch(function (error) { toast(error.message, true); }).finally(function(){saveButton.disabled=false;});
  }

  function showDeviceDetail(id) {
    var device = deviceById(id);
    if (!device) { return; }
    state.selectedDeviceId = device.installedDeviceId;
    if(!applyingRoute){var detailUrl=new URL(location.href);detailUrl.searchParams.set("panel","devices");detailUrl.searchParams.set("device",device.installedDeviceId);detailUrl.searchParams.set("access","panel:devices");window.history.pushState(window.history.state,"",detailUrl);}
    byId("deviceDetailTitle").textContent = device.deviceName;
    var calc = device.calculation || {};
    var source = safeUrl(device.manufacturerSourceUrl || device.specificationSource);
    var history = device.maintenanceHistory || [];
    byId("deviceDetailContent").innerHTML = "<section class=\"detail-grid\">" + [
      ["Kategori", device.disciplineKey], ["Product type", device.productType], ["Brand", device.brandName || "—"],
      ["Model / Series", [device.modelName, device.seriesName].filter(Boolean).join(" / ") || "—"],
      ["Lokasi", device.locationName], ["Quantity", formatNumber(device.quantity, 3)], ["Phase", device.phaseCount ? device.phaseCount + " phase" : "—"],
      ["Voltage", formatUnit(device.voltageV, "V", 3)], ["Current", formatUnit(device.currentA, "A", 3)],
      ["Rated input", formatUnit(deviceRated(device), "W", 3)], ["Power factor", formatNumber(device.powerFactor, 5)],
      ["Connected load", formatUnit(calc.connectedLoadW, "W", 3)], ["Demand", formatUnit(calc.estimatedDemandW, "W", 3)],
        ["Daily", formatUnit(calc.dailyKwh, "kWh", 3)], ["Monthly", formatUnit(calc.monthlyKwh, "kWh", 3)], ["Yearly", formatUnit(calc.yearlyKwh, "kWh", 3)],
        [tr("Estimasi biaya / bulan", "Estimated cost / month"), budgetCost(calc.monthlyKwh)]
    ].map(function (item) { return "<article><span>" + escapeHtml(item[0]) + "</span><strong>" + escapeHtml(item[1]) + "</strong></article>"; }).join("") + "</section>" +
      (source ? "<p class=\"notice-box\" style=\"margin-top:.65rem\">Sumber: <a href=\"" + escapeHtml(source) + "\" target=\"_blank\" rel=\"noopener\">" + escapeHtml(device.manufacturerSourceTitle || source) + "</a> · " + escapeHtml(device.specificationVerificationStatus || device.powerValueSource || "manual") + "</p>" : "") +
      "<details class=\"history-panel\" open><summary>Histori maintenance (" + history.length + ")</summary>" + (history.length ? history.map(function (record) { return "<p><strong>" + formatDate(record.serviceDate, true) + " · " + escapeHtml(record.serviceType) + "</strong><br>" + escapeHtml(record.workPerformed) + "<br><small>Next: " + formatDate(record.nextServiceDate, false) + " · " + escapeHtml(record.technicianVendor || "tanpa vendor") + "</small></p>"; }).join("<hr>") : "<p class=\"empty-state\">Belum ada maintenance.</p>") + "</details>";
    showDialog("deviceDetailDialog");
  }

  function openMeter(meter) {
    var form = byId("meterForm"); form.reset(); q('[name="meterId"]', form).value = ""; q('[name="currencyCode"]', form).value = "IDR";
    if (meter) { Object.keys(meter).forEach(function (key) { var input = q('[name="' + key + '"]', form); if (input && meter[key] !== null) { input.value = meter[key]; } }); }
    showDialog("meterDialog");
  }
  function saveMeter(event) {
    event.preventDefault(); api("save_meter", formObject(event.currentTarget)).then(function () { closeDialog("meterDialog"); toast("Data meter tersimpan."); return reload(false); }).catch(function (error) { toast(error.message, true); });
  }

  function openReading(meterId) {
    var form = byId("readingForm"); form.reset();
    var today = new Date(); var start = new Date(today.getFullYear(), today.getMonth(), 1);
    q('[name="meterId"]', form).value = meterId || "";
    q('[name="readingAt"]', form).value = localDateTime(today);
    q('[name="periodStart"]', form).value = isoDate(start); q('[name="periodEnd"]', form).value = isoDate(today);
    var meter = meterById(meterId); if (meter) { q('[name="tariffPerKwh"]', form).value = meter.tariffPerKwh || ""; q('[name="currencyCode"]', form).value = meter.currencyCode || ""; }
    showDialog("readingDialog");
  }
  function saveReading(event) {
    event.preventDefault(); api("add_meter_reading", formObject(event.currentTarget)).then(function (result) { closeDialog("readingDialog"); toast("Pembacaan tersimpan: " + formatUnit(result.consumptionKwh, "kWh", 3) + "."); return reload(false); }).catch(function (error) { toast(error.message, true); });
  }

  function openMaintenance(deviceId) {
    var form = byId("maintenanceForm"); form.reset(); q('[name="currencyCode"]', form).value = "IDR"; q('[name="serviceDate"]', form).value = localDateTime(new Date()); q('[name="installedDeviceId"]', form).value = deviceId || ""; showDialog("maintenanceDialog");
  }
  function uploadAttachment(maintenanceId, file) {
    if (!file || !file.size) { return Promise.resolve(null); }
    var body = new FormData(); body.append("maintenanceId", maintenanceId); body.append("context", JSON.stringify(state.context || {})); body.append("actorId", state.actorId); body.append("attachment", file);
    return window.fetch(ATTACHMENT_URL, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "X-Actor-Id": state.actorId }, body: body }).then(function (response) {
      return response.json().then(function (payload) { if (!response.ok || payload.success === false) { throw new Error(payload.error || "Upload attachment gagal."); } return payload.data; });
    });
  }
  function saveMaintenance(event) {
    event.preventDefault(); var form = event.currentTarget; var file = q('[name="attachment"]', form).files[0]; var payload = formObject(form);
    api("add_maintenance", payload).then(function (result) { return uploadAttachment(result.maintenanceId, file).then(function () { return result; }); }).then(function () { closeDialog("maintenanceDialog"); toast("Histori maintenance tersimpan tanpa menimpa riwayat lama."); return reload(false); }).catch(function (error) { toast(error.message, true); });
  }

  function searchSpecifications(event) {
    event.preventDefault();
    return runSpecificationSearch(formObject(event.currentTarget));
  }
  function runSpecificationSearch(input) {
    var button = byId("specificationSearchButton"); var status = byId("specificationSearchStatus");
    button.disabled = true; status.classList.remove("is-error"); status.textContent = tr("Mencari perangkat dan membaca spesifikasi sumber...", "Finding equipment and reading source specifications...");
    return api("search_specifications", input).then(function (result) {
      var choices=byId('specificationSourceChoices');choices.innerHTML='';
      (result.sourceChoices || []).forEach(function (item) {
        var url = safeUrl(item.url); if (!url) return;
        var catalogueProduct = item.matchStatus === 'catalog-product' || item.matchStatus === 'catalog-model' || item.matchStatus === 'catalog-variant';
        var row = document.createElement('article'); row.className = 'notice-box';
        row.innerHTML = '<strong>' + escapeHtml(item.title) + '</strong><p>' + (item.matchStatus==='catalog-variant' ? tr('Varian seri yang ditemukan di katalog. Pilih model yang sesuai.','Series variant found in the catalogue. Select the matching model.') : catalogueProduct ? tr('Produk dari katalog sumber. Pilih untuk membaca spesifikasinya.', 'Source catalogue product. Select to read its specifications.') : tr('Tautan terkait; kecocokan produk belum dikonfirmasi.', 'Related link; product match is not confirmed.')) + '</p><a target="_blank" rel="noopener" href="' + escapeHtml(url) + '">' + tr('Buka sumber', 'Open source') + '</a>';
        var read = document.createElement('button'); read.type = 'button'; read.textContent = tr('Baca data produk', 'Read product data');
        read.addEventListener('click', function () {
          if (button.disabled) return;
          // A chosen result is a one-request override, never a persistent search filter.
          var selectedInput = Object.assign({}, input);
          if (catalogueProduct) {
            selectedInput.searchText = ''; selectedInput.model = ''; selectedInput.series = '';
            selectedInput.brand = item.brand || ''; selectedInput.productType = item.productType || '';
          }
          selectedInput.sourceUrl = item.matchStatus === 'catalog-model' ? '' : url;
          if (item.model) selectedInput.model = item.model;
          return runSpecificationSearch(selectedInput);
        });
        row.appendChild(read); choices.appendChild(row);
      });
      if (result.fromVerifiedCache && result.specification) {
        status.textContent = result.message; state.searchCandidates = []; renderCandidateList([]); toast("Spesifikasi ditemukan di verified cache.");
        return reload(false).then(function(){useSpecification(result.specification.specificationId);});
      } else {
        state.searchCandidates = activeCandidates(result.candidates); status.textContent = window.PrayerI18n ? window.PrayerI18n.uiText(result.message) : result.message; renderCandidateList(state.searchCandidates);
        // Keep inferred category in results; do not turn it into a filter for the next search.
        if (result.status === 'failed') status.classList.add('is-error');
        if(result.interpretedQuery && !state.searchCandidates.length && (result.sourceChoices||[]).length) status.textContent=(result.sourceChoices||[]).some(function(item){return item.matchStatus==='catalog-product'||item.matchStatus==='catalog-model'||item.matchStatus==='catalog-variant';})?tr('Pilih perangkat dari katalog untuk membaca spesifikasinya.','Select a catalogue product to read its specifications.'):tr('Belum ada kecocokan pasti. Berikut sumber terkait yang ditemukan.','No exact match yet. Related sources are shown below.');
      }
    }).catch(function (error) { status.textContent = error.message; status.classList.add("is-error"); toast(error.message, true); }).finally(function () { button.disabled = false; });
  }

  function candidateById(id) {
    return activeCandidates((state.searchCandidates || []).concat(state.data.recentCandidates || [])).find(function (candidate) { return Number(candidate.candidateId) === Number(id); }) || null;
  }
  function openSpecificationReview(candidate) {
    if (!candidate) { return; }
    var form = byId("specificationReviewForm"); form.reset();
    var values = {
      candidateId: candidate.candidateId, detectedBrand: candidate.detectedBrand, productType: candidate.productType || candidate.productTypeQuery || q('[name="productType"]', byId("specificationSearchForm")).value,
      detectedModel: candidate.detectedModel, detectedSeries: candidate.detectedSeries, ratedPowerW: candidate.ratedPowerW,
      voltageV: candidate.voltageV, currentA: candidate.currentA, apparentPowerVa: candidate.apparentPowerVa,
      powerFactor: candidate.powerFactor, phaseCount: candidate.phaseCount, capacityValue: candidate.capacityValue,
      capacityUnit: candidate.capacityUnit, frequencyHz: candidate.frequencyHz, sourceTitle: candidate.sourceTitle, sourceUrl: candidate.sourceUrl
    };
    Object.keys(values).forEach(function (key) { var input = q('[name="' + key + '"]', form); if (input && values[key] !== null && values[key] !== undefined) { input.value = values[key]; } });
    showDialog("specificationReviewDialog");
  }
  function acceptCandidate(candidate, edits) {
    if (!candidate) { return; }
    api("accept_specification", { candidateId: candidate.candidateId, edits: edits || {} }).then(function (result) { closeDialog("specificationReviewDialog"); toast("Spesifikasi diterima, diberi provenance, dan masuk verified cache."); return reload(false).then(function(){useSpecification(result.specificationId);}); }).catch(function (error) {
      if (!edits && number(candidate.ratedPowerW) === null) { openSpecificationReview(candidate); }
      toast(error.message, true);
    });
  }
  function saveSpecificationReview(event) {
    event.preventDefault(); var payload = formObject(event.currentTarget); var candidate = candidateById(payload.candidateId); delete payload.candidateId; acceptCandidate(candidate, payload);
  }
  function rejectCandidate(candidate) {
    if (!candidate) { return; }
    var reason = window.prompt(tr("Alasan reject kandidat (wajib):","Reason for rejection (required):"), tr("Sumber/angka tidak sesuai model perangkat.","Source or values do not match the device model."));
    if (!reason) { return; }
    api("reject_specification", { candidateId: candidate.candidateId, reason: reason }).then(function () {
      var identity = function (item) { return text(item.detectedBrand).toLowerCase().replace(/[^a-z0-9]/g, "") + "|" + text(item.detectedModel).toLowerCase().replace(/[^a-z0-9]/g, "") + "|" + text(item.sourceUrl).toLowerCase().replace(/\/+$/, ""); };
      var rejectedIdentity = identity(candidate);
      var keep = function (item) { return Number(item.candidateId) !== Number(candidate.candidateId) && identity(item) !== rejectedIdentity; };
      state.searchCandidates = activeCandidates(state.searchCandidates).filter(keep);
      if (state.data) { state.data.recentCandidates = activeCandidates(state.data.recentCandidates).filter(keep); saveSnapshot(state.data); }
      renderCandidateList(state.searchCandidates);
      toast(tr("Kandidat ditolak dan dihapus dari hasil pencarian.", "Candidate rejected and removed from search results."));
      return reload(false);
    }).catch(function (error) { toast(error.message, true); });
  }

  var applyingRoute=false;
  function switchTab(name) {
    if (!["devices","calculator","meters","maintenance","specifications"].includes(name)) return;
    qa("[data-meep-tab]").forEach(function (button) { var active = button.dataset.meepTab === name; button.classList.toggle("is-active", active); button.setAttribute("aria-selected", active ? "true" : "false"); });
    qa("[data-meep-pane]").forEach(function (pane) { var active = pane.dataset.meepPane === name; pane.classList.toggle("is-active", active); pane.hidden = !active; });
    if(!applyingRoute){var url=new URL(location.href);url.hash="";url.searchParams.set("panel",name);url.searchParams.delete("card");url.searchParams.delete("device");url.searchParams.set("access","panel:"+name);if(url.href!==location.href)history.pushState(null,"",url);}
  }

  function restoreRoute() {
    var query=new URLSearchParams(location.search), panel=query.get("panel")||location.hash.slice(1)||"devices";
    var identity=query.get("access")||query.get("card"),node=identity&&qa("[data-access-key]").find(function(n){return n.dataset.accessKey===identity;});
    if(node&&node.closest("[data-meep-pane]"))panel=node.closest("[data-meep-pane]").dataset.meepPane;
    if(staticMode)panel="calculator";
    applyingRoute=true;switchTab(panel);
    if(state.data&&query.get("device")&&panel==="devices")showDeviceDetail(query.get("device"));
    else if(byId("deviceDetailDialog").open)byId("deviceDetailDialog").close();
    applyingRoute=false;
    if(node&&!node.closest("[hidden]")){for(var parent=node;parent;parent=parent.parentElement)if(parent.tagName==="DETAILS")parent.open=true;node.scrollIntoView({block:"nearest"});}
  }
  window.MpmMeepRoute={restore:restoreRoute};

  function bind() {
    byId("deviceDetailDialog").addEventListener("close",function(){if(applyingRoute)return;var url=new URL(location.href);url.searchParams.delete("device");history.replaceState(history.state,"",url);});
    byId("verifiedSpecificationList").addEventListener("click",function(e){var b=e.target.closest("[data-use-spec]");if(b)useSpecification(b.dataset.useSpec);});
    byId("meepBudgetTariff").addEventListener("input",saveBudget);
    byId("meepBudgetCurrency").addEventListener("input",saveBudget);
    window.addEventListener("popstate",restoreRoute);
    window.addEventListener("mpm:language-changed",function(){renderCalculator();if(state.data&&!document.querySelector("dialog[open]"))renderAll();});
    document.addEventListener("click",function(event){var node=event.target.closest("[data-access-key]");if(!node||event.target.closest("button,input,select,textarea,a,form"))return;var key=node.dataset.accessKey;if(!key.startsWith("card:"))return;var url=new URL(location.href);url.searchParams.set("access",key);url.searchParams.set("card",key);var pane=node.closest("[data-meep-pane]");if(pane)url.searchParams.set("panel",pane.dataset.meepPane);url.hash="";history.replaceState(history.state,"",url);});
    qa("[data-meep-tab]").forEach(function (button) { button.addEventListener("click", function () { switchTab(button.dataset.meepTab); }); });
    qa("[data-close-dialog]").forEach(function (button) { button.addEventListener("click", function () { closeDialog(button.dataset.closeDialog); }); });
    byId("meepReloadButton").addEventListener("click", function () {
      loadBuildingCatalog(state.selectedBuildingKey, Boolean(state.selectedBuildingKey)).then(function () {
        toast("Katalog gedung dan data BMS dimuat ulang dari RDBMS.");
      });
    });
    byId("meepUseBuildingButton").addEventListener("click", function () {
      var key = byId("meepBuildingSelect").value;
      if (!key) { toast("Pilih gedung dari daftar RDBMS terlebih dahulu.", true); return; }
      chooseBuilding(key, true);
    });
    byId("meepAddBuildingButton").addEventListener("click", function () { openBuilding(null); });
    byId("meepEditBuildingButton").addEventListener("click", function () {
      var record = selectedBuildingRecord(state.selectedBuildingKey);
      if (record && record.recordType === "building") { openBuilding(record); }
    });
    byId("buildingForm").addEventListener("submit", saveBuilding);
    byId("addDeviceButton").addEventListener("click", function () { openDevice(null); });
    byId("deviceSearchInput").addEventListener("input", renderDevices); byId("deviceDisciplineFilter").addEventListener("change", renderDevices);
    byId("deviceTableBody").addEventListener("click", function (event) {
      var button = event.target.closest("[data-device-action]"); if (!button) { return; } var device = deviceById(button.dataset.id);
      if (button.dataset.deviceAction === "detail") { showDeviceDetail(button.dataset.id); }
      if (button.dataset.deviceAction === "edit") { openDevice(device); }
      if (button.dataset.deviceAction === "service") { openMaintenance(button.dataset.id); }
    });
    byId("deviceForm").addEventListener("submit", saveDevice); byId("deviceForm").addEventListener("input", renderDeviceCalculation);
    q('[name="specificationId"]', byId("deviceForm")).addEventListener("change", applySpecification);
    byId("deviceEditFromDetail").addEventListener("click", function () { var device = deviceById(state.selectedDeviceId); closeDialog("deviceDetailDialog"); openDevice(device); });
    byId("deviceArchiveButton").addEventListener("click", function () {
      var device = deviceById(state.selectedDeviceId); if (!device || !window.confirm(tr("Arsipkan ","Archive ") + device.deviceName + tr("? Histori tidak dihapus.","? History will be retained."))) { return; }
      api("archive_device", { installedDeviceId: device.installedDeviceId }).then(function () { closeDialog("deviceDetailDialog"); toast("Perangkat diarsipkan; histori tetap tersimpan."); return reload(false); }).catch(function (error) { toast(error.message, true); });
    });
    byId("calculatorForm").addEventListener("input", renderCalculator); byId("calculatorForm").addEventListener("change", renderCalculator);
    byId("calculatorResetButton").addEventListener("click", function () { byId("calculatorForm").reset(); renderCalculator(); });
    byId("addMeterButton").addEventListener("click", function () { openMeter(null); }); byId("meterForm").addEventListener("submit", saveMeter);
    byId("meterTableBody").addEventListener("click", function (event) { var button = event.target.closest("[data-meter-action]"); if (!button) { return; } if (button.dataset.meterAction === "reading") { openReading(button.dataset.id); } else { openMeter(meterById(button.dataset.id)); } });
    byId("readingForm").addEventListener("submit", saveReading);
    byId("addMaintenanceButton").addEventListener("click", function () { openMaintenance(null); }); byId("maintenanceForm").addEventListener("submit", saveMaintenance); byId("maintenanceStatusFilter").addEventListener("change", renderMaintenance);
    byId("specificationSearchForm").addEventListener("submit", searchSpecifications); byId("specificationReviewForm").addEventListener("submit", saveSpecificationReview);
    byId("specificationResults").addEventListener("click", function (event) { var button = event.target.closest("[data-spec-action]"); if (!button) { return; } var candidate = candidateById(button.dataset.id); if (button.dataset.specAction === "accept") { acceptCandidate(candidate, null); } if (button.dataset.specAction === "edit") { openSpecificationReview(candidate); } if (button.dataset.specAction === "reject") { rejectCandidate(candidate); } });
    window.addEventListener("online", function () { if (!staticMode) loadBuildingCatalog(state.selectedBuildingKey, Boolean(state.selectedBuildingKey)); });
  }

  function start() {
    bind(); restoreBudget(); renderCalculator(); showBuildingContent(false);
    if (staticMode) {
      var english = new URLSearchParams(window.location.search).get("lang") === "en";
      setConnection(english ? "Static mode · local calculator" : "Mode statis · kalkulator lokal", "warn");
      byId("meepScopeText").textContent = english ? "The calculator runs in your browser without PHP." : "Kalkulator berjalan di browser tanpa PHP.";
      byId("meepBuildingCatalogStatus").textContent = english ? "Building data requires the PHP backend." : "Data gedung memerlukan backend PHP.";
      byId("meepSelectionRequired").innerHTML = "<strong>" + (english ? "Calculator available" : "Kalkulator tersedia") + "</strong><span>" +
        (english ? "Inventory, meters, maintenance, login and shared storage require a PHP/database server. Calculations here are not saved." : "Inventaris, meter, maintenance, login, dan penyimpanan bersama memerlukan server PHP/database. Perhitungan di sini tidak disimpan.") + "</span>";
      ["meepReloadButton", "meepBuildingSelect", "meepUseBuildingButton", "meepAddBuildingButton", "meepEditBuildingButton"].forEach(function (id) { byId(id).disabled = true; });
      q(".meep-tabs").hidden = false; q(".meep-workspace").hidden = false;
      qa("[data-meep-tab]").forEach(function (button) { button.disabled = button.dataset.meepTab !== "calculator"; });
      switchTab("calculator");
      return;
    }
    var hashTab = window.location.hash.replace(/^#/, "");
    if (["devices", "calculator", "meters", "maintenance", "specifications"].indexOf(hashTab) !== -1) { switchTab(hashTab); }
    restoreRoute();
    var stored = new URLSearchParams(location.search).get("building") || storedBuildingKey();
    loadBuildingCatalog(stored, Boolean(stored));
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", start); } else { start(); }
})(window, document);
