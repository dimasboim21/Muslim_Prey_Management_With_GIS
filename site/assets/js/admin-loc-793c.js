(function (window) {
  "use strict";

  var STORAGE_KEY = "mpm:admin-webgis:active-context:v1";
  var UPDATE_EVENT = "mpm:admin-location-updated";
  var DELETED_CONTEXT_MARKERS = [
    "masjid al-ikhlas",
    "masjid al ikhlas",
    "al-ikhlas",
    "al ikhlas",
    "kalimantan tengah",
    "kabupaten katingan",
    "katingan"
  ];

  function numeric(value) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function validCoordinates(latitude, longitude) {
    return latitude !== null && longitude !== null &&
      latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  }

  function safeJson(value) {
    try {
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  function textFrom(source, keys) {
    if (!source || typeof source !== "object") {
      return "";
    }
    var normalized = {};
    Object.keys(source).forEach(function (key) {
      normalized[String(key).toLowerCase()] = key;
    });
    for (var index = 0; index < keys.length; index += 1) {
      var actualKey = normalized[String(keys[index]).toLowerCase()];
      if (!actualKey) {
        continue;
      }
      var value = source[actualKey];
      if (value && typeof value === "object") {
        continue;
      }
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }
    return "";
  }

  function locationIdentityValue(location, root, keys) {
    return textFrom(location, keys) ||
      textFrom(root, keys) ||
      textFrom(root && root.gis, keys) ||
      textFrom(root && root.gis && root.gis.boundaries, keys);
  }

  function containsDeletedContext(value) {
    var text = "";
    try {
      text = typeof value === "string" ? value : JSON.stringify(value);
    } catch (error) {
      text = "";
    }
    text = String(text || "").toLowerCase();
    return DELETED_CONTEXT_MARKERS.some(function (marker) {
      return text.indexOf(marker) !== -1;
    });
  }

  function purgeDeletedContextStorage() {
    try {
      Object.keys(window.localStorage || {}).forEach(function (key) {
        if (key.indexOf("mpm:admin-webgis:") !== 0) {
          return;
        }
        if (containsDeletedContext(window.localStorage.getItem(key))) {
          window.localStorage.removeItem(key);
        }
      });
    } catch (error) {
      // Storage cleanup is best-effort only.
    }
  }

  function read() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (containsDeletedContext(raw)) {
        window.localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return normalize(safeJson(raw));
    } catch (error) {
      return null;
    }
  }

  function coordinateSource(location, raw) {
    if (location && location.coordinateSource) {
      return String(location.coordinateSource);
    }
    if (location && location.acquisition && location.acquisition.source) {
      return String(location.acquisition.source);
    }
    if (raw && raw.coordinateSource) {
      return String(raw.coordinateSource);
    }
    return "manual";
  }

  function normalize(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    if (containsDeletedContext(raw)) {
      return null;
    }

    var root = raw.data && typeof raw.data === "object" ? raw.data : raw;
    var location = root.location && typeof root.location === "object" ? root.location : root;
    var mosque = root.mosque && typeof root.mosque === "object" ? root.mosque : {};
    var latitude = numeric(location.latitude !== undefined ? location.latitude : root.latitude);
    var longitude = numeric(location.longitude !== undefined ? location.longitude : root.longitude);

    if (!validCoordinates(latitude, longitude)) {
      return null;
    }

    return {
      schemaVersion: "mpm.active-location.v1",
      updatedAt: String(root.updatedAt || root.savedAt || new Date().toISOString()),
      source: String(root.source || "admin-webgis"),
      mosque: {
        buildingIdentifier: String(mosque.buildingIdentifier || root.buildingIdentifier || root.building_identifier || ""),
        id: mosque.id !== undefined ? mosque.id : (root.mosqueId || root.mosque_id || null),
        name: String(mosque.name || mosque.mosqueName || root.mosqueName || root.mosque_name || ""),
        type: String(mosque.type || root.buildingType || ""),
        typeLabel: String(mosque.typeLabel || root.buildingTypeLabel || ""),
        iconPath: String(mosque.iconPath || root.iconPath || ""),
        displayLanguage: String(mosque.displayLanguage || root.displayLanguage || root.display_language || "auto"),
        hijriDateManual: String(mosque.hijriDateManual || root.hijriDateManual || root.hijri_date_manual || ""),
        officialAddress: String(mosque.officialAddress || root.officialAddress || ""),
        additionalInfo: String(mosque.additionalInfo || root.additionalInfo || "")
      },
      location: {
        continent: String(location.continent || root.continent || ""),
        country: String(location.country || root.country || ""),
        province: String(location.province || location.adm1 || root.province || root.adm1 || ""),
        city: String(location.city || location.adm2 || root.city || root.adm2 || ""),
        adm0: String(location.adm0 || location.country || root.adm0 || root.country || ""),
        adm1: String(location.adm1 || location.province || root.adm1 || root.province || ""),
        adm2: String(location.adm2 || location.city || root.adm2 || root.city || ""),
        adm0Id: locationIdentityValue(location, root, ["adm0Id", "adm0_id", "countryId", "country_id", "shapeGroup", "ISO_A3", "ISO3", "iso3", "countryCode3"]),
        adm1Id: locationIdentityValue(location, root, ["adm1Id", "adm1_id", "provinceId", "province_id", "regionId", "region_id", "shapeID", "shapeId", "shape_id", "GID_1", "HASC_1"]),
        adm2Id: locationIdentityValue(location, root, ["adm2Id", "adm2_id", "cityId", "city_id", "regencyId", "regency_id", "districtId", "district_id", "shapeID", "shapeId", "shape_id", "GID_2", "HASC_2"]),
        timezone: String(location.timezone || root.timezone || "UTC"),
        latitude: latitude,
        longitude: longitude,
        coordinateSource: coordinateSource(location, root),
        accuracyOrNote: String(
          location.accuracyOrNote ||
          (location.acquisition && location.acquisition.accuracyOrNote) ||
          root.coordinateAccuracy ||
          ""
        )
      },
      gis: root.gis && typeof root.gis === "object" ? root.gis : {}
    };
  }

  function fromAdminConfig(config, source) {
    if (!config || typeof config !== "object") {
      return null;
    }
    return normalize({
      updatedAt: config.updatedAt || new Date().toISOString(),
      source: source || "admin-webgis",
      mosque: config.mosque || {},
      location: config.location || {},
      gis: config.gis || {}
    });
  }

  function write(context, options) {
    var normalized = normalize(context);
    if (!normalized) {
      return null;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      window.localStorage.setItem("mpm:mosque-updated", String(Date.now()));
    } catch (error) {
      // The event still allows same-page consumers to refresh when storage is unavailable.
    }

    if (!(options && options.silent)) {
      try {
        window.dispatchEvent(new window.CustomEvent(UPDATE_EVENT, { detail: normalized }));
      } catch (error) {
        // CustomEvent can be unavailable in older file-preview environments.
      }
    }
    return normalized;
  }

  function merge(local, remote) {
    if (!local) {
      return remote;
    }
    if (!remote) {
      return local;
    }

    var merged = {
      schemaVersion: "mpm.active-location.v1",
      updatedAt: remote.updatedAt || local.updatedAt,
      source: remote.source || local.source,
      mosque: Object.assign({}, local.mosque || {}, remote.mosque || {}),
      location: Object.assign({}, local.location || {}, remote.location || {}),
      gis: Object.assign({}, local.gis || {}, remote.gis || {})
    };
    return normalize(merged) || local;
  }

  function sameContext(left, right) {
    try {
      return JSON.stringify(left || null) === JSON.stringify(right || null);
    } catch (error) {
      return false;
    }
  }

  function fromActiveMosque(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    return normalize({
      updatedAt: payload.updatedAt || payload.updated_at ||
        (payload.configuration && (payload.configuration.savedAt || payload.configuration.saved_at)) ||
        new Date().toISOString(),
      source: "active-mosque-api",
      mosque: payload.mosque || {},
      location: payload.location || {},
      gis: payload.gis || {}
    });
  }

  function fetchActive() {
    if (!window.fetch || (window.navigator && window.navigator.onLine === false)) {
      return Promise.resolve(null);
    }

    return window.fetch("api/active-mosque.php", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        return null;
      }
      return response.json();
    }).then(function (payload) {
      return payload && payload.success !== false ? fromActiveMosque(payload.data) : null;
    }).catch(function () {
      return null;
    });
  }

  function resolve() {
    var local = read();
    return fetchActive().then(function (remote) {
      var context = merge(local, remote);
      if (context && remote && !sameContext(local, context)) {
        // The caller already owns this resolve cycle. Persist the online
        // context without dispatching the same event back into that cycle.
        write(context, { silent: true });
      }
      return context;
    });
  }

  window.MpmAdminLocation = {
    STORAGE_KEY: STORAGE_KEY,
    UPDATE_EVENT: UPDATE_EVENT,
    normalize: normalize,
    fromAdminConfig: fromAdminConfig,
    fromActiveMosque: fromActiveMosque,
    read: read,
    write: write,
    fetchActive: fetchActive,
    resolve: resolve
  };
  purgeDeletedContextStorage();
})(window);
