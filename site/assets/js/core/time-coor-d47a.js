(function (window, document) {
  "use strict";

  var STORAGE_KEY = "mpm:time-coordinate-calibration:v1";
  var API_ENDPOINT = "time-coordinate-calibration.php";
  var EARTH_RADIUS_METERS = 6371008.8;
  var LONGITUDE_MILLISECONDS_PER_DEGREE = 240000;
  var SIDEREAL_ANGULAR_VELOCITY = 7.292115e-5;
  var EQUATORIAL_ROTATION_METERS_PER_SECOND = 465.1;
  var subscribers = [];
  var animationFrame = null;
  var initialization = null;
  var networkAnchor = null;
  var lastRemoteSignature = "";
  var timestampFormatters = {};
  var providerCoordinateRevision = 0;
  var buildingCoordinateRevision = 0;
  var providerLookupFlight = null;
  var providerLookupRecord = {};
  var PROVIDER_LOOKUP_KEY = 'mpm:ip-provider-lookup:v1';

  function readProviderLookup() {
    try { providerLookupRecord = JSON.parse(window.localStorage.getItem(PROVIDER_LOOKUP_KEY) || 'null') || providerLookupRecord; } catch (_) {}
    return providerLookupRecord;
  }

  function saveProviderLookup(record) {
    providerLookupRecord = record;
    try { window.localStorage.setItem(PROVIDER_LOOKUP_KEY, JSON.stringify(record)); } catch (_) {}
  }

  var state = {
    schemaVersion: "mpm.time-coordinate-calibration.v1",
    contextKey: "global",
    configuration: {
      showComparison: true,
      actualTimeDisplayMode: "isp",
      timeReferenceMode: "provider_network",
      coordinateDifferenceMode: "display_only",
      showCalibrationLine: true
    },
    provider: null,
    building: null,
    persistence: {
      source: "default",
      databaseOnline: false,
      updatedAt: null,
      lastError: ""
    }
  };

  function performanceNow() {
    return window.performance && typeof window.performance.now === "function"
      ? window.performance.now()
      : 0;
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function text(id, en) {
    var query = new URLSearchParams(window.location.search).get("lang");
    var indonesian = query ? query !== "en" : document.documentElement.lang !== "en";
    return indonesian ? id : en;
  }

  function finite(value) {
    if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
      return null;
    }
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function validCoordinate(latitude, longitude) {
    var lat = finite(latitude);
    var lon = finite(longitude);
    return lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  function normalizeLongitudeDifference(value) {
    var result = Number(value);
    if (!Number.isFinite(result)) {
      return NaN;
    }
    while (result > 180) { result -= 360; }
    while (result < -180) { result += 360; }
    return result;
  }

  function radians(value) {
    return Number(value) * Math.PI / 180;
  }

  function degrees(value) {
    return Number(value) * 180 / Math.PI;
  }

  function directionFromBearing(bearing, distanceMeters) {
    if (!Number.isFinite(bearing) || Number(distanceMeters) < 0.01) {
      return { key: "same", id: "Posisi sama", en: "Same position" };
    }
    var names = [
      ["north", "Utara", "North"],
      ["north-east", "Timur Laut", "North-East"],
      ["east", "Timur", "East"],
      ["south-east", "Tenggara", "South-East"],
      ["south", "Selatan", "South"],
      ["south-west", "Barat Daya", "South-West"],
      ["west", "Barat", "West"],
      ["north-west", "Barat Laut", "North-West"]
    ];
    var selected = names[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
    return { key: selected[0], id: selected[1], en: selected[2] };
  }

  function calculateSpatialDifference(provider, building) {
    if (!provider || !building || !validCoordinate(provider.latitude, provider.longitude)
      || !validCoordinate(building.latitude, building.longitude)) {
      return null;
    }
    var lat1 = radians(provider.latitude);
    var lat2 = radians(building.latitude);
    var deltaLatRadians = lat2 - lat1;
    var deltaLongitude = normalizeLongitudeDifference(Number(building.longitude) - Number(provider.longitude));
    var deltaLonRadians = radians(deltaLongitude);
    var a = Math.pow(Math.sin(deltaLatRadians / 2), 2)
      + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(deltaLonRadians / 2), 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    var distanceMeters = EARTH_RADIUS_METERS * c;
    var y = Math.sin(deltaLonRadians) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2)
      - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLonRadians);
    var bearing = distanceMeters < 0.01 ? 0 : (degrees(Math.atan2(y, x)) + 360) % 360;
    var northSouthMeters = distanceMeters * Math.cos(radians(bearing));
    var eastWestMeters = distanceMeters * Math.sin(radians(bearing));
    var direction = directionFromBearing(bearing, distanceMeters);

    return {
      method: "Haversine great-circle",
      earthRadiusMeters: EARTH_RADIUS_METERS,
      deltaLatitude: Number(building.latitude) - Number(provider.latitude),
      deltaLongitude: deltaLongitude,
      distanceMeters: distanceMeters,
      distanceKilometers: distanceMeters / 1000,
      bearingDegrees: bearing,
      relativeDirection: direction.key,
      relativeDirectionId: direction.id,
      relativeDirectionEn: direction.en,
      eastWestMeters: eastWestMeters,
      northSouthMeters: northSouthMeters
    };
  }

  function calculateAstronomicalDifference(provider, building) {
    var spatial = calculateSpatialDifference(provider, building);
    if (!spatial) {
      return null;
    }
    var milliseconds = spatial.deltaLongitude * LONGITUDE_MILLISECONDS_PER_DEGREE;
    return {
      basis: "mean-solar-longitude-comparison",
      longitudeDifferenceDegrees: spatial.deltaLongitude,
      longitudeDifferenceSeconds: milliseconds / 1000,
      longitudeDifferenceMilliseconds: milliseconds,
      sign: milliseconds > 0 ? 1 : (milliseconds < 0 ? -1 : 0),
      interpretation: milliseconds > 0
        ? "building-east-astronomically-advanced"
        : (milliseconds < 0 ? "building-west-astronomically-slower" : "same-longitude")
    };
  }

  function median(values) {
    var sorted = values.filter(Number.isFinite).slice().sort(function (a, b) { return a - b; });
    if (!sorted.length) { return null; }
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function networkMetadata() {
    var snapshot = window.MpmActualTime && typeof window.MpmActualTime.snapshot === "function"
      ? window.MpmActualTime.snapshot()
      : null;
    var authority = snapshot && snapshot.state ? snapshot.state : {};
    var network = authority.networkTime || {};
    var samples = Array.isArray(network.samples) ? network.samples : [];
    var rtt = median(samples.map(function (sample) { return Number(sample.roundTripMs); }));
    var stratums = samples.map(function (sample) { return finite(sample.stratum); }).filter(function (value) { return value !== null; });
    var hosts = samples.map(function (sample) { return String(sample.host || ""); }).filter(Boolean);
    var available = network.available === true && Number.isFinite(Number(network.sampledEpochMs));
    var degraded = network.degraded === true || String(network.sourceKey || "").indexOf("https") >= 0;
    var synchronizationStatus = !available
      ? "unavailable"
      : (degraded ? "estimated" : "verified");
    return {
      available: available,
      timeSourceType: available
        ? (String(network.sourceKey || "").indexOf("ntp") >= 0 ? "public-network-ntp" : "official-server-timestamp")
        : "unavailable",
      providerName: network.sourceName || "Online time unavailable",
      providerTimestamp: available ? Number(network.sampledEpochMs) : null,
      receivedTimestamp: finite(network.retrievedAtServerEpochMs),
      roundTripTime: rtt,
      estimatedOffset: finite(network.deviationFromAuthorityMs),
      uncertainty: available ? Math.max(Number(network.spreadMs || 0) / 2, rtt === null ? 0 : rtt / 2) : null,
      stratum: stratums.length ? Math.min.apply(Math, stratums) : null,
      synchronizationStatus: synchronizationStatus,
      sourceURL: network.sourceUrl || "",
      sourceHost: hosts.join(", "),
      lastSynchronization: network.sampledIso || (available ? new Date(Number(network.sampledEpochMs)).toISOString() : null),
      sampleCount: Number(network.sampleCount || 0),
      spreadMs: finite(network.spreadMs),
      servedFrom: network.servedFrom || "",
      activeAuthorityMode: authority.activeSourceMode || "unknown",
      actualIspMasterClockAvailable: false,
      provenanceNote: text(
        "Sumber jam adalah master-clock jaringan publik yang tersedia, bukan master-clock ISP yang terbukti terkait dengan koordinat estimasi IP.",
        "The clock source is the available public network master clock, not a proven ISP master clock tied to the estimated IP coordinate."
      )
    };
  }

  function syncNetworkAnchor() {
    var metadata = networkMetadata();
    if (!metadata.available) {
      networkAnchor = null;
      return metadata;
    }
    var snapshot = window.MpmActualTime.snapshot();
    var authority = snapshot.state || {};
    var reference = authority.activeSourceMode === "online_network"
      ? Number(snapshot.epochMs)
      : Number(metadata.providerTimestamp);
    networkAnchor = {
      epochMs: reference,
      performanceMs: performanceNow(),
      metadata: metadata
    };
    return metadata;
  }

  function providerEpochMs() {
    if (!networkAnchor) {
      syncNetworkAnchor();
    }
    return networkAnchor
      ? networkAnchor.epochMs + Math.max(0, performanceNow() - networkAnchor.performanceMs)
      : null;
  }

  function sanitizedProvider(input) {
    if (!input || !validCoordinate(input.latitude, input.longitude)) { return null; }
    return {
      name: String(input.name || input.org || "Network service provider"),
      operatorType: String(input.operatorType || "internet-service-provider"),
      latitude: Number(input.latitude),
      longitude: Number(input.longitude),
      elevation: finite(input.elevation),
      coordinateSource: String(input.coordinateSource || input.source || "unknown"),
      coordinateType: String(input.coordinateType || "ip-geolocation-estimate"),
      accuracyRadius: finite(input.accuracyRadius),
      confidence: String(input.confidence || "unverified"),
      coordinateStatus: String(input.coordinateStatus || "unverified"),
      sourceURL: String(input.sourceURL || ""),
      ip: String(input.ip || ""),
      city: String(input.city || ""),
      region: String(input.region || ""),
      country: String(input.country || ""),
      timezone: String(input.timezone || ""),
      timestamp: String(input.timestamp || input.updatedAt || new Date().toISOString())
    };
  }

  function sanitizedBuilding(input) {
    if (!input || !validCoordinate(input.latitude, input.longitude)) { return null; }
    return {
      name: String(input.name || "Active building"),
      latitude: Number(input.latitude),
      longitude: Number(input.longitude),
      elevation: finite(input.elevation),
      coordinateSource: String(input.coordinateSource || "manual/database"),
      accuracy: finite(input.accuracy),
      accuracyNote: String(input.accuracyNote || input.accuracyOrNote || ""),
      confirmedByUser: input.confirmedByUser === true,
      coordinateStatus: String(input.coordinateStatus || (input.confirmedByUser === true ? "verified" : "unverified")),
      timezone: String(input.timezone || ""),
      timestamp: String(input.timestamp || input.updatedAt || new Date().toISOString())
    };
  }

  function persistLocal() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        schemaVersion: state.schemaVersion,
        contextKey: state.contextKey,
        configuration: state.configuration,
        provider: state.provider,
        building: state.building,
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      state.persistence.lastError = String(error.message || error);
    }
  }

  function hydrate(payload, source) {
    var value = payload && payload.value ? payload.value : payload;
    if (!value || typeof value !== "object") { return; }
    var configuration = value.configuration || {};
    state.configuration.showComparison = configuration.showComparison !== false;
    if (configuration.actualTimeDisplayMode === "building-coordinate-calibrated"
      || configuration.actualTimeDisplayMode === "isp") {
      state.configuration.actualTimeDisplayMode = configuration.actualTimeDisplayMode;
    } else if (source === "local" && configuration.timeReferenceMode === "coordinate_calibrated") {
      // Compatibility with the display selector used before the display and
      // astronomical reference settings were separated.
      state.configuration.actualTimeDisplayMode = "building-coordinate-calibrated";
    }
    state.configuration.timeReferenceMode = configuration.timeReferenceMode === "coordinate_calibrated"
      ? "coordinate_calibrated" : "provider_network";
    state.configuration.coordinateDifferenceMode = configuration.coordinateDifferenceMode === "apply"
      ? "apply" : "display_only";
    state.configuration.showCalibrationLine = configuration.showCalibrationLine !== false;
    state.provider = sanitizedProvider(value.provider) || state.provider;
    state.building = sanitizedBuilding(value.building) || state.building;
    state.persistence.source = source || "local";
    state.persistence.updatedAt = payload && payload.updatedAt ? payload.updatedAt : (value.updatedAt || null);
  }

  function dispatch() {
    var detail = getState();
    if (typeof window.CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent("mpm:time-coordinate-calibration", { detail: detail }));
    }
    subscribers.slice().forEach(function (callback) {
      try { callback(detail); } catch (error) { window.setTimeout(function () { throw error; }, 0); }
    });
  }

  function apiUrl() {
    return window.PrayerRuntime && typeof window.PrayerRuntime.api === "function"
      ? window.PrayerRuntime.api(API_ENDPOINT)
      : "api/" + API_ENDPOINT;
  }

  function loadRemote() {
    if (!window.fetch || (window.PrayerRuntime && window.PrayerRuntime.isFileMode)) {
      return Promise.resolve(null);
    }
    return window.fetch(apiUrl() + "?context=global", { cache: "no-store", credentials: "same-origin" })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok || !payload || payload.success !== true) {
            throw new Error((payload && payload.error) || "Calibration configuration API unavailable.");
          }
          if (payload.data) {
            hydrate(payload.data, "database");
            state.persistence.databaseOnline = true;
            persistLocal();
          }
          return payload.data || null;
        });
      }).catch(function (error) {
        state.persistence.databaseOnline = false;
        state.persistence.lastError = String(error.message || error);
        return null;
      });
  }

  function remotePayload() {
    return {
      contextKey: state.contextKey,
      configuration: clone(state.configuration),
      provider: clone(state.provider),
      building: clone(state.building)
    };
  }

  function saveRemote(options) {
    if (!window.fetch || (window.PrayerRuntime && window.PrayerRuntime.isFileMode)) {
      return Promise.resolve({ localOnly: true });
    }
    var payload = remotePayload();
    var signature = JSON.stringify(payload);
    if (!(options && options.force) && signature === lastRemoteSignature) {
      return Promise.resolve({ unchanged: true });
    }
    var headers = {
      "Content-Type": "application/json",
      "X-Actor-Id": "time-coordinate-calibration",
      "X-Client-Request-Id": "time-coordinate:" + Date.now() + ":" + Math.random().toString(16).slice(2)
    };
    if (options && options.adminToken) {
      headers["X-Admin-Token"] = String(options.adminToken);
    }
    return window.fetch(apiUrl(), {
      method: "POST",
      credentials: "same-origin",
      headers: headers,
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json().then(function (result) {
        if (!response.ok || !result || result.success !== true) {
          throw new Error((result && result.error) || "Calibration configuration could not be saved.");
        }
        lastRemoteSignature = signature;
        state.persistence.databaseOnline = true;
        state.persistence.source = "database";
        state.persistence.updatedAt = result.data && result.data.updatedAt || new Date().toISOString();
        state.persistence.lastError = "";
        dispatch();
        return result.data;
      });
    }).catch(function (error) {
      state.persistence.databaseOnline = false;
      state.persistence.lastError = String(error.message || error);
      dispatch();
      throw error;
    });
  }

  function setProviderCoordinate(value, options) {
    var normalized = sanitizedProvider(value);
    providerCoordinateRevision += 1;
    state.provider = normalized;
    persistLocal();
    dispatch();
    return options && options.persist ? saveRemote(options).catch(function () { return null; }) : Promise.resolve(normalized);
  }

  function setBuildingCoordinate(value, options) {
    var normalized = sanitizedBuilding(value);
    buildingCoordinateRevision += 1;
    state.building = normalized;
    persistLocal();
    dispatch();
    return options && options.persist ? saveRemote(options).catch(function () { return null; }) : Promise.resolve(normalized);
  }

  function configure(changes, options) {
    var value = changes || {};
    if (Object.prototype.hasOwnProperty.call(value, "showComparison")) {
      state.configuration.showComparison = value.showComparison !== false;
    }
    if (Object.prototype.hasOwnProperty.call(value, "showCalibrationLine")) {
      state.configuration.showCalibrationLine = value.showCalibrationLine !== false;
    }
    if (value.actualTimeDisplayMode) {
      state.configuration.actualTimeDisplayMode = value.actualTimeDisplayMode === "building-coordinate-calibrated"
        ? "building-coordinate-calibrated" : "isp";
    }
    if (value.timeReferenceMode) {
      state.configuration.timeReferenceMode = value.timeReferenceMode === "coordinate_calibrated"
        ? "coordinate_calibrated" : "provider_network";
    }
    if (value.coordinateDifferenceMode) {
      state.configuration.coordinateDifferenceMode = value.coordinateDifferenceMode === "apply"
        ? "apply" : "display_only";
    }
    persistLocal();
    dispatch();
    return options && options.persist ? saveRemote(options) : Promise.resolve(getState());
  }

  function discoverProviderCoordinate() {
    if (new URLSearchParams(window.location.search).has("overlay-preview")) {
      return Promise.resolve(state.provider ? clone(state.provider) : null);
    }
    if (state.provider && state.provider.coordinateSource
      && state.provider.coordinateSource !== "ipapi.co") {
      return Promise.resolve(clone(state.provider));
    }
    if (state.provider && state.provider.coordinateSource === "ipapi.co"
      && Date.now() >= Date.parse(state.provider.timestamp || 0)
      && Date.now() - Date.parse(state.provider.timestamp || 0) < 3600000) {
      return Promise.resolve(clone(state.provider));
    }
    if (!window.fetch || navigator.onLine === false) { return Promise.resolve(null); }
    if (providerLookupFlight) return providerLookupFlight;
    var requestedRevision = providerCoordinateRevision;
    function lookup() {
      var record = readProviderLookup(), now = Date.now();
      if (requestedRevision !== providerCoordinateRevision) return Promise.resolve(state.provider ? clone(state.provider) : null);
      var cached = record.provider && sanitizedProvider(record.provider);
      if (cached && Number(record.expiresAt) > now && Number(record.expiresAt) <= now + 3600000) {
        state.provider = cached; persistLocal(); dispatch(); return Promise.resolve(clone(cached));
      }
      if (Number(record.retryAt) > now) return Promise.resolve(state.provider ? clone(state.provider) : null);
      var controller = new AbortController();
      var timeout = window.setTimeout(function () { controller.abort(); }, 10000);
      return window.fetch("https://ipapi.co/json/", { cache: "no-store", signal: controller.signal })
      .then(function (response) {
        if (response.status === 429) {
          var retry = response.headers.get('Retry-After');
          var retryAt = retry && /^\d+$/.test(retry.trim()) ? Date.now() + Number(retry) * 1000 : Date.parse(retry || '');
          saveProviderLookup(Object.assign({}, record, { retryAt: Number.isFinite(retryAt) && retryAt > Date.now() ? retryAt : Date.now() + 3600000,
            error: 'Batas akses lokasi IP tercapai (429); permintaan dijeda.' }));
        }
        if (!response.ok) { throw new Error("HTTP " + response.status); }
        return response.json();
      }).then(function (data) {
        if (requestedRevision !== providerCoordinateRevision) {
          return state.provider ? clone(state.provider) : null;
        }
        var provider = sanitizedProvider({
          name: data.org || data.asn || "IP service provider",
          operatorType: "internet-service-provider",
          latitude: data.latitude,
          longitude: data.longitude,
          coordinateSource: "ipapi.co",
          coordinateType: "ip-geolocation-estimate",
          accuracyRadius: null,
          confidence: "unverified",
          coordinateStatus: "estimated",
          sourceURL: "https://ipapi.co/",
          ip: data.ip,
          city: data.city,
          region: data.region,
          country: data.country_name || data.country,
          timezone: data.timezone,
          timestamp: new Date().toISOString()
        });
        if (!provider) { throw new Error("Invalid provider coordinate."); }
        saveProviderLookup({ provider: provider, expiresAt: Date.now() + 3600000, retryAt: 0, error: '' });
        state.provider = provider;
        persistLocal();
        dispatch();
        return clone(provider);
      }).catch(function () {
        var latest = readProviderLookup();
        if (!(Number(latest.retryAt) > Date.now())) saveProviderLookup(Object.assign({}, latest, { retryAt: Date.now() + 60000, error: 'Lokasi IP belum tersedia; permintaan dijeda.' }));
        return state.provider ? clone(state.provider) : null;
      }).finally(function () { window.clearTimeout(timeout); });
    }
    // Web Locks also coalesces startup requests from tabs on the same origin.
    providerLookupFlight = (navigator.locks && navigator.locks.request
      ? navigator.locks.request(PROVIDER_LOOKUP_KEY, lookup) : Promise.resolve().then(lookup))
      .finally(function () { providerLookupFlight = null; });
    return providerLookupFlight;
  }

  function buildingFromActiveMosque(payload) {
    var data = payload && payload.data ? payload.data : payload;
    var location = data && data.location ? data.location : {};
    var mosque = data && data.mosque ? data.mosque : {};
    return sanitizedBuilding({
      name: mosque.name || "Active building",
      latitude: location.latitude,
      longitude: location.longitude,
      elevation: location.elevation,
      coordinateSource: location.coordinateSource || "active-mosque-database",
      accuracy: location.coordinateAccuracy,
      accuracyNote: location.accuracyOrNote || location.coordinateAccuracyNote,
      confirmedByUser: Boolean(location.confirmedByUser || location.coordinateConfirmedAt),
      coordinateStatus: location.confirmedByUser || location.coordinateConfirmedAt ? "verified" : "unverified",
      timezone: location.timezone,
      timestamp: location.updatedAt || new Date().toISOString()
    });
  }

  function discoverBuildingCoordinate() {
    if (state.building && state.building.coordinateSource
      && state.building.coordinateSource !== "active-mosque-database") {
      return Promise.resolve(clone(state.building));
    }
    if (!window.fetch || (window.PrayerRuntime && window.PrayerRuntime.isFileMode)) {
      return Promise.resolve(state.building ? clone(state.building) : null);
    }
    var requestedRevision = buildingCoordinateRevision;
    var url = window.PrayerRuntime && window.PrayerRuntime.api
      ? window.PrayerRuntime.api("active-mosque.php") : "api/active-mosque.php";
    return window.fetch(url, { cache: "no-store", credentials: "same-origin" })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok || !payload || payload.success === false) { throw new Error("Active building unavailable."); }
          if (requestedRevision !== buildingCoordinateRevision) {
            return state.building ? clone(state.building) : null;
          }
          var building = buildingFromActiveMosque(payload);
          if (building) {
            state.building = building;
            persistLocal();
            dispatch();
          }
          return clone(building);
        });
      }).catch(function () { return state.building ? clone(state.building) : null; });
  }

  function earthRotation(latitude) {
    var lat = finite(latitude);
    return lat === null ? null : EQUATORIAL_ROTATION_METERS_PER_SECOND * Math.cos(radians(lat));
  }

  function narrative(spatial, astronomical) {
    if (!spatial || !astronomical) {
      return text("Koordinat provider dan gedung belum lengkap.", "Provider and building coordinates are incomplete.");
    }
    var latitudeDominant = Math.abs(spatial.deltaLongitude) < 0.00001 && Math.abs(spatial.deltaLatitude) >= 0.00001;
    if (latitudeDominant) {
      return text(
        "Perbedaan terutama berada pada latitude. Jarak geodesik serta altitude/azimuth dapat berubah, tetapi latitude tidak menghasilkan koreksi waktu bujur secara langsung.",
        "The difference is primarily latitudinal. Geodesic distance and altitude/azimuth may change, but latitude does not directly produce a longitude time correction."
      );
    }
    if (Math.abs(spatial.deltaLatitude) >= 0.00001 && Math.abs(spatial.deltaLongitude) >= 0.00001) {
      return text(
        "Posisi berbeda secara diagonal. Jarak total dihitung secara geodesik; diferensiasi waktu astronomis hanya memakai komponen longitude.",
        "The positions differ diagonally. Total distance is geodesic; astronomical time differentiation uses only the longitude component."
      );
    }
    if (astronomical.sign > 0) {
      return text(
        "Bangunan berada lebih timur. Local mean solar-time berbasis bujur relatif lebih maju; ini bukan bukti latency atau perubahan akurasi clock ISP.",
        "The building is farther east. Longitude-based local mean solar time is relatively advanced; this is not evidence of ISP latency or clock accuracy."
      );
    }
    if (astronomical.sign < 0) {
      return text(
        "Bangunan berada lebih barat sehingga local mean solar-time berbasis bujur relatif lebih lambat. Ini terpisah dari sinkronisasi network clock.",
        "The building is farther west, so longitude-based local mean solar time is relatively slower. This remains separate from network-clock synchronization."
      );
    }
    return text("Longitude sama; tidak ada diferensiasi waktu berbasis bujur.", "Longitudes are equal; there is no longitude-derived time difference.");
  }

  function diagnostics(network, astronomical) {
    if (!network || !astronomical || network.estimatedOffset === null || network.roundTripTime === null) {
      return { available: false, warning: "", residualMilliseconds: null };
    }
    var residual = network.estimatedOffset - astronomical.longitudeDifferenceMilliseconds;
    var excessive = Math.abs(network.estimatedOffset) > Math.max(1000, network.roundTripTime * 10);
    return {
      available: true,
      observedClockDifferenceMilliseconds: network.estimatedOffset,
      longitudeDerivedDifferenceMilliseconds: astronomical.longitudeDifferenceMilliseconds,
      networkRoundTripMilliseconds: network.roundTripTime,
      residualMilliseconds: residual,
      warning: excessive ? text(
        "Perbedaan clock jauh lebih besar daripada RTT dan tidak boleh dianggap sebagai latency propagasi ISP.",
        "The clock difference is substantially larger than RTT and must not be interpreted as ISP propagation latency."
      ) : ""
    };
  }

  function getState() {
    var network = networkMetadata();
    var spatial = calculateSpatialDifference(state.provider, state.building);
    var astronomical = calculateAstronomicalDifference(state.provider, state.building);
    var providerTime = providerEpochMs();
    var calibrated = providerTime !== null && astronomical
      ? providerTime + astronomical.longitudeDifferenceMilliseconds : null;
    var displayMode = state.configuration.actualTimeDisplayMode === "building-coordinate-calibrated"
      ? "building-coordinate-calibrated" : "isp";
    var selected = displayMode === "building-coordinate-calibrated" ? calibrated : providerTime;
    var selectedAvailable = selected !== null && Number.isFinite(Number(selected));
    return {
      schemaVersion: state.schemaVersion,
      contextKey: state.contextKey,
      configuration: clone(state.configuration),
      provider: state.provider ? Object.assign(clone(state.provider), {
        timeSource: network,
        synchronizationStatus: network.synchronizationStatus,
        lastSync: network.lastSynchronization,
        rtt: network.roundTripTime,
        uncertainty: network.uncertainty
      }) : null,
      building: clone(state.building),
      spatialDifference: spatial,
      astronomicalDifference: astronomical,
      time: {
        providerTime: providerTime,
        coordinateCalibratedBuildingTime: calibrated,
        differenceMilliseconds: astronomical ? astronomical.longitudeDifferenceMilliseconds : null,
        displayMode: displayMode,
        referenceMode: state.configuration.timeReferenceMode,
        coordinateDifferenceMode: state.configuration.coordinateDifferenceMode,
        selectedTime: selectedAvailable ? selected : null,
        selectedTimeAvailable: selectedAvailable,
        derivedLabel: "Derived from provider reference + longitude correction",
        officialCivilTime: false
      },
      earthRotation: {
        meanSolarDegreesPerDay: 360,
        meanSolarDegreesPerHour: 15,
        meanSolarDegreesPerMinute: 0.25,
        meanSolarDegreesPerSecond: 0.0041666667,
        secondsPerLongitudeDegree: 240,
        siderealAngularVelocityRadPerSecond: SIDEREAL_ANGULAR_VELOCITY,
        equatorialMetersPerSecond: EQUATORIAL_ROTATION_METERS_PER_SECOND,
        equatorialKilometersPerHour: EQUATORIAL_ROTATION_METERS_PER_SECOND * 3.6,
        providerMetersPerSecond: state.provider ? earthRotation(state.provider.latitude) : null,
        buildingMetersPerSecond: state.building ? earthRotation(state.building.latitude) : null
      },
      diagnostic: diagnostics(network, astronomical),
      narrative: narrative(spatial, astronomical),
      persistence: clone(state.persistence)
    };
  }

  function pad(value, length) {
    return String(value).padStart(length, "0");
  }

  function formatTimestamp(epochMs, timeZone) {
    if (!Number.isFinite(Number(epochMs))) { return "Unavailable"; }
    var zone = String(timeZone || (state.building && state.building.timezone) || "UTC");
    var parts = {};
    try {
      if (!timestampFormatters[zone]) {
        timestampFormatters[zone] = new Intl.DateTimeFormat("en-GB", {
          timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
        });
      }
      timestampFormatters[zone].formatToParts(new Date(Number(epochMs))).forEach(function (part) {
        if (part.type !== "literal") { parts[part.type] = part.value; }
      });
    } catch (error) {
      zone = "UTC";
      return formatTimestamp(epochMs, zone);
    }
    return parts.day + "/" + parts.month + "/" + parts.year + " "
      + parts.hour + ":" + parts.minute + ":" + parts.second + "."
      + pad(new Date(Number(epochMs)).getUTCMilliseconds(), 3);
  }

  function formatSignedDuration(milliseconds) {
    if (!Number.isFinite(Number(milliseconds))) { return "Unavailable"; }
    var value = Number(milliseconds);
    var sign = value < 0 ? "-" : "+";
    var absolute = Math.abs(value);
    var hours = Math.floor(absolute / 3600000);
    var minutes = Math.floor((absolute % 3600000) / 60000);
    var seconds = Math.floor((absolute % 60000) / 1000);
    var ms = Math.round(absolute % 1000);
    if (ms === 1000) { seconds += 1; ms = 0; }
    return sign + pad(hours, 2) + ":" + pad(minutes, 2) + ":" + pad(seconds, 2) + "." + pad(ms, 3);
  }

  function selectedClock(displayMode, existingSnapshot) {
    var snapshot = existingSnapshot || getState();
    var requestedMode = displayMode === "building-coordinate-calibrated" || displayMode === "isp"
      ? displayMode
      : (snapshot.configuration.actualTimeDisplayMode || "isp");
    var coordinate = requestedMode === "building-coordinate-calibrated";
    var epoch = coordinate
      ? snapshot.time.coordinateCalibratedBuildingTime
      : snapshot.time.providerTime;
    var available = epoch !== null && Number.isFinite(Number(epoch));
    var networkStatus = snapshot.provider && snapshot.provider.timeSource
      ? snapshot.provider.timeSource.synchronizationStatus : "unavailable";
    var status = networkStatus;
    if (coordinate && available) {
      var providerStatus = String(snapshot.provider && snapshot.provider.coordinateStatus || "unverified").toLowerCase();
      var buildingStatus = String(snapshot.building && snapshot.building.coordinateStatus || "unverified").toLowerCase();
      if (networkStatus === "unavailable") {
        status = "unavailable";
      } else if (networkStatus === "estimated" || providerStatus === "estimated" || buildingStatus === "estimated") {
        status = "estimated";
      } else if (providerStatus !== "verified" || buildingStatus !== "verified") {
        status = "unverified";
      } else {
        status = "verified";
      }
    }
    return {
      available: available,
      epochMs: available ? Number(epoch) : null,
      mode: requestedMode,
      suffix: coordinate ? "-calibrating building coordinate position" : "-isp",
      label: coordinate
        ? "Calibrating Building Coordinate Position"
        : "ISP / Provider Time",
      status: available ? status : "unavailable"
    };
  }

  function tickerFrame() {
    animationFrame = null;
    if (!subscribers.length) { return; }
    var detail = getState();
    subscribers.slice().forEach(function (callback) {
      try { callback(detail); } catch (error) { /* subscriber isolation */ }
    });
    animationFrame = window.requestAnimationFrame(tickerFrame);
  }

  function subscribe(callback) {
    if (typeof callback !== "function") { return function () {}; }
    subscribers.push(callback);
    callback(getState());
    if (!animationFrame && window.requestAnimationFrame) {
      animationFrame = window.requestAnimationFrame(tickerFrame);
    }
    return function () {
      subscribers = subscribers.filter(function (candidate) { return candidate !== callback; });
      if (!subscribers.length && animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
    };
  }

  function initialize() {
    if (initialization) { return initialization; }
    try {
      hydrate(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null"), "local");
    } catch (error) { /* retain defaults */ }
    initialization = Promise.resolve(window.MpmActualTime && window.MpmActualTime.initialize
      ? window.MpmActualTime.initialize() : null)
      .then(function () {
        syncNetworkAnchor();
        return loadRemote();
      }).then(function () {
        return Promise.all([discoverBuildingCoordinate(), discoverProviderCoordinate()]);
      }).then(function () {
        syncNetworkAnchor();
        persistLocal();
        dispatch();
        return getState();
      });
    return initialization;
  }

  window.addEventListener("mpm:actual-time-status", function () {
    syncNetworkAnchor();
    dispatch();
  });
  window.addEventListener("online", function () {
    discoverProviderCoordinate().then(function () { dispatch(); });
  });

  window.MpmTimeCoordinateCalibration = {
    initialize: initialize,
    getState: getState,
    selectedClock: selectedClock,
    subscribe: subscribe,
    configure: configure,
    save: saveRemote,
    setProviderCoordinate: setProviderCoordinate,
    setBuildingCoordinate: setBuildingCoordinate,
    discoverProviderCoordinate: discoverProviderCoordinate,
    getProviderLookupState: function () { var record = readProviderLookup(); return { retryAt: Number(record.retryAt) || 0, error: record.error || '' }; },
    discoverBuildingCoordinate: discoverBuildingCoordinate,
    calculateSpatialDifference: calculateSpatialDifference,
    calculateAstronomicalDifference: calculateAstronomicalDifference,
    normalizeLongitudeDifference: normalizeLongitudeDifference,
    formatTimestamp: formatTimestamp,
    formatSignedDuration: formatSignedDuration,
    constants: {
      earthRadiusMeters: EARTH_RADIUS_METERS,
      longitudeMillisecondsPerDegree: LONGITUDE_MILLISECONDS_PER_DEGREE,
      siderealAngularVelocityRadPerSecond: SIDEREAL_ANGULAR_VELOCITY,
      equatorialRotationMetersPerSecond: EQUATORIAL_ROTATION_METERS_PER_SECOND
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})(window, document);
