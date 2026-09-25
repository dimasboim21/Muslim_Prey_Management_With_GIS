(function (window) {
  "use strict";

  var OFFICIAL_API = "https://www.geoboundaries.org/api/current/gbOpen";
  var OFFICIAL_WORLD_ADM0 = "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/CGAZ/geoBoundariesCGAZ_ADM0.geojson";
  var STATIC_CACHE = "mpm-adm-boundary-static-v2";
  var ISO_PAIRS = (
    "AF:AFG AX:ALA AL:ALB DZ:DZA AS:ASM AD:AND AO:AGO AI:AIA AQ:ATA AG:ATG AR:ARG AM:ARM AW:ABW AU:AUS AT:AUT AZ:AZE " +
    "BS:BHS BH:BHR BD:BGD BB:BRB BY:BLR BE:BEL BZ:BLZ BJ:BEN BM:BMU BT:BTN BO:BOL BQ:BES BA:BIH BW:BWA BV:BVT BR:BRA IO:IOT " +
    "BN:BRN BG:BGR BF:BFA BI:BDI KH:KHM CM:CMR CA:CAN CV:CPV KY:CYM CF:CAF TD:TCD CL:CHL CN:CHN CX:CXR CC:CCK CO:COL KM:COM " +
    "CG:COG CD:COD CK:COK CR:CRI CI:CIV HR:HRV CU:CUB CW:CUW CY:CYP CZ:CZE DK:DNK DJ:DJI DM:DMA DO:DOM EC:ECU EG:EGY SV:SLV " +
    "GQ:GNQ ER:ERI EE:EST SZ:SWZ ET:ETH FK:FLK FO:FRO FJ:FJI FI:FIN FR:FRA GF:GUF PF:PYF TF:ATF GA:GAB GM:GMB GE:GEO DE:DEU " +
    "GH:GHA GI:GIB GR:GRC GL:GRL GD:GRD GP:GLP GU:GUM GT:GTM GG:GGY GN:GIN GW:GNB GY:GUY HT:HTI HM:HMD VA:VAT HN:HND HK:HKG " +
    "HU:HUN IS:ISL IN:IND ID:IDN IR:IRN IQ:IRQ IE:IRL IM:IMN IL:ISR IT:ITA JM:JAM JP:JPN JE:JEY JO:JOR KZ:KAZ KE:KEN KI:KIR " +
    "KP:PRK KR:KOR KW:KWT KG:KGZ LA:LAO LV:LVA LB:LBN LS:LSO LR:LBR LY:LBY LI:LIE LT:LTU LU:LUX MO:MAC MG:MDG MW:MWI MY:MYS " +
    "MV:MDV ML:MLI MT:MLT MH:MHL MQ:MTQ MR:MRT MU:MUS YT:MYT MX:MEX FM:FSM MD:MDA MC:MCO MN:MNG ME:MNE MS:MSR MA:MAR MZ:MOZ " +
    "MM:MMR NA:NAM NR:NRU NP:NPL NL:NLD NC:NCL NZ:NZL NI:NIC NE:NER NG:NGA NU:NIU NF:NFK MK:MKD MP:MNP NO:NOR OM:OMN PK:PAK " +
    "PW:PLW PS:PSE PA:PAN PG:PNG PY:PRY PE:PER PH:PHL PN:PCN PL:POL PT:PRT PR:PRI QA:QAT RE:REU RO:ROU RU:RUS RW:RWA BL:BLM " +
    "SH:SHN KN:KNA LC:LCA MF:MAF PM:SPM VC:VCT WS:WSM SM:SMR ST:STP SA:SAU SN:SEN RS:SRB SC:SYC SL:SLE SG:SGP SX:SXM SK:SVK " +
    "SI:SVN SB:SLB SO:SOM ZA:ZAF GS:SGS SS:SSD ES:ESP LK:LKA SD:SDN SR:SUR SJ:SJM SE:SWE CH:CHE SY:SYR TW:TWN TJ:TJK TZ:TZA " +
    "TH:THA TL:TLS TG:TGO TK:TKL TO:TON TT:TTO TN:TUN TR:TUR TM:TKM TC:TCA TV:TUV UG:UGA UA:UKR AE:ARE GB:GBR US:USA UM:UMI " +
    "UY:URY UZ:UZB VU:VUT VE:VEN VN:VNM VG:VGB VI:VIR WF:WLF EH:ESH YE:YEM ZM:ZMB ZW:ZWE XK:XKX"
  ).split(" ").reduce(function (map, pair) {
    var parts = pair.split(":");
    map[parts[0]] = parts[1];
    return map;
  }, {});

  function isOnline() {
    try {
      if (new URLSearchParams(window.location.search).get("adm_offline") === "1") return false;
    } catch (error) {}
    return !(window.navigator && window.navigator.onLine === false);
  }

  function isStaticHosting(settings) {
    var host = String(window.location && window.location.hostname || "").toLowerCase();
    var requestedStatic = false;
    try { requestedStatic = new URLSearchParams(window.location.search).get("adm_static") === "1"; } catch (error) {}
    return settings.staticMode === true || window.MPM_ADM_STATIC_MODE === true ||
      requestedStatic || String(window.location && window.location.protocol || "") === "file:" || /\.github\.io$/.test(host);
  }

  function requestUrl(input, extraParams) {
    var url = new URL(String(input || "api/adm-boundaries.php"), window.location.href);
    var params = extraParams && typeof extraParams === "object" ? extraParams : {};
    Object.keys(params).forEach(function (key) {
      var value = params[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") url.searchParams.set(key, String(value));
    });
    url.searchParams.set("source", isOnline() ? "auto" : "local");
    url.searchParams.set("offline", isOnline() ? "0" : "1");
    if (!url.searchParams.has("hierarchy")) url.searchParams.set("hierarchy", "strict-v6");
    return url.toString();
  }

  function sourceInfo(response) {
    return {
      mode: response.headers.get("X-ADM-Source-Mode") || "unknown",
      label: response.headers.get("X-ADM-Source-Label") || "ADM boundary source",
      resolution: response.headers.get("X-ADM-Resolution") || "full",
      onlineChecked: response.headers.get("X-ADM-Online-Checked") === "1",
      sourceUrl: response.headers.get("X-ADM-Source-URL") || "",
      fallbackReason: response.headers.get("X-ADM-Fallback-Reason") || ""
    };
  }

  function validateGeoJson(value, label) {
    if (!value || value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
      throw new Error((label || "ADM boundary") + " bukan GeoJSON FeatureCollection yang valid.");
    }
    return value;
  }

  function normalizedText(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\bnothern\b/g, "northern")
      .replace(/\b(regency|city|district|province|state|special|region|municipality|administrative|governorate|of|the|and)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }

  function propertyValue(feature, keys) {
    var props = feature && feature.properties && typeof feature.properties === "object" ? feature.properties : {};
    for (var index = 0; index < keys.length; index += 1) {
      var value = String(props[keys[index]] || "").trim();
      if (value) return value;
    }
    return "";
  }

  function featureName(feature) { return propertyValue(feature, ["shapeName", "NAME_0", "NAME_1", "NAME_2", "name"]); }
  function featureId(feature) { return propertyValue(feature, ["shapeID", "shapeId", "shape_id", "GID_1", "GID_2", "HASC_1", "HASC_2"]); }
  function featureCountry(feature) { return propertyValue(feature, ["shapeGroup", "ISO_A3", "ISO3", "GID_0"]).slice(0, 3).toUpperCase(); }

  function eachCoordinate(coordinates, callback) {
    if (!Array.isArray(coordinates)) return;
    if (coordinates.length >= 2 && Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1]))) {
      callback(Number(coordinates[0]), Number(coordinates[1]));
      return;
    }
    coordinates.forEach(function (part) { eachCoordinate(part, callback); });
  }

  function geometryCenter(feature) {
    var bounds = [Infinity, Infinity, -Infinity, -Infinity];
    eachCoordinate(feature && feature.geometry && feature.geometry.coordinates, function (x, y) {
      bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
      bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
    });
    return bounds.every(Number.isFinite) ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] : null;
  }

  function pointInRing(point, ring) {
    var inside = false;
    if (!Array.isArray(ring)) return false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = Number(ring[i] && ring[i][0]); var yi = Number(ring[i] && ring[i][1]);
      var xj = Number(ring[j] && ring[j][0]); var yj = Number(ring[j] && ring[j][1]);
      if (!Number.isFinite(xi) || !Number.isFinite(yi) || !Number.isFinite(xj) || !Number.isFinite(yj)) continue;
      if (((yi > point[1]) !== (yj > point[1])) &&
          (point[0] < (xj - xi) * (point[1] - yi) / ((yj - yi) || Number.EPSILON) + xi)) inside = !inside;
    }
    return inside;
  }

  function pointInPolygon(point, polygon) {
    if (!Array.isArray(polygon) || !pointInRing(point, polygon[0])) return false;
    for (var index = 1; index < polygon.length; index += 1) if (pointInRing(point, polygon[index])) return false;
    return true;
  }

  function pointInFeature(point, feature) {
    var geometry = feature && feature.geometry || {};
    if (geometry.type === "Polygon") return pointInPolygon(point, geometry.coordinates);
    if (geometry.type === "MultiPolygon") return geometry.coordinates.some(function (polygon) { return pointInPolygon(point, polygon); });
    return false;
  }

  function selectExact(features, targetName, targetId) {
    var id = String(targetId || "").trim();
    var name = normalizedText(targetName);
    if (id) {
      var identified = features.filter(function (feature) { return featureId(feature) === id; });
      if (identified.length || !name) return identified;
    }
    if (name) return features.filter(function (feature) { return normalizedText(featureName(feature)) === name; });
    return features;
  }

  function iso3FromParams(params) {
    var iso2 = String(params.get("country_iso2") || "").trim().toUpperCase();
    var candidate = String(params.get("country") || "").trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(candidate)) return candidate;
    if (/^[A-Z]{2}$/.test(candidate)) iso2 = candidate;
    return ISO_PAIRS[iso2] || "";
  }

  function cacheMatch(url) {
    if (!window.caches) return Promise.resolve(null);
    return window.caches.open(STATIC_CACHE).then(function (cache) { return cache.match(url); }).catch(function () { return null; });
  }

  function rememberResponse(url, response) {
    if (!window.caches || !response || !response.ok) return;
    window.caches.open(STATIC_CACHE).then(function (cache) { return cache.put(url, response.clone()); }).catch(function () {});
  }

  function jsonFromResponse(response, label) {
    if (!response || !response.ok) throw new Error((label || "ADM") + " HTTP " + (response ? response.status : "offline"));
    return response.json();
  }

  function fetchJsonOnline(url, signal, label) {
    return window.fetch(url, { method: "GET", mode: "cors", cache: "no-store", signal: signal }).then(function (response) {
      if (!response.ok) return jsonFromResponse(response, label);
      rememberResponse(url, response);
      return response.json();
    });
  }

  function fetchJsonCached(url, label) {
    return cacheMatch(url).then(function (response) { return jsonFromResponse(response, label); });
  }

  function corsSafeDownloadUrl(value) {
    var url = String(value || "").trim();
    var match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/raw\/([^/]+)\/(.+)$/i);
    if (match) {
      return "https://media.githubusercontent.com/media/" + match[1] + "/" + match[2] + "/" + match[3] + "/" + match[4];
    }
    return url;
  }

  function officialPayload(iso3, level, signal) {
    if (!iso3) return Promise.reject(new Error("Kode negara ISO2/ISO3 wajib untuk sumber ADM online statis."));
    var metadataUrl = OFFICIAL_API + "/" + encodeURIComponent(iso3) + "/" + level.toUpperCase() + "/";
    var metadataPromise = isOnline() ? fetchJsonOnline(metadataUrl, signal, "Metadata geoBoundaries") : fetchJsonCached(metadataUrl, "Cache metadata geoBoundaries");
    return metadataPromise.then(function (metadata) {
      var entry = Array.isArray(metadata) ? metadata[0] : metadata;
      var downloadUrl = corsSafeDownloadUrl(entry && entry.gjDownloadURL);
      if (!downloadUrl) throw new Error("Metadata geoBoundaries tidak menyediakan gjDownloadURL penuh.");
      var dataPromise = isOnline() ? fetchJsonOnline(downloadUrl, signal, "GeoJSON geoBoundaries") : fetchJsonCached(downloadUrl, "Cache GeoJSON geoBoundaries");
      return dataPromise.then(function (geojson) {
        return { geojson: validateGeoJson(geojson, "GeoJSON geoBoundaries"), source: {
          mode: isOnline() ? "online-static" : "online-cache-static", label: "geoBoundaries gbOpen", resolution: "full",
          onlineChecked: isOnline(), sourceUrl: downloadUrl, metadataUrl: metadataUrl, fallbackReason: ""
        } };
      });
    });
  }

  function worldAdm0Online(signal) {
    var promise = isOnline() ? fetchJsonOnline(OFFICIAL_WORLD_ADM0, signal, "CGAZ ADM0 dunia") : fetchJsonCached(OFFICIAL_WORLD_ADM0, "Cache CGAZ ADM0 dunia");
    return promise.then(function (geojson) {
      return { geojson: validateGeoJson(geojson, "CGAZ ADM0 dunia"), source: {
        mode: isOnline() ? "online-static" : "online-cache-static", label: "geoBoundaries CGAZ", resolution: "full",
        onlineChecked: isOnline(), sourceUrl: OFFICIAL_WORLD_ADM0, fallbackReason: ""
      } };
    });
  }

  function bundledCandidates(level, iso3) {
    var upper = level.toUpperCase(); var candidates = [];
    if (iso3 && level !== "adm0") candidates.push("map/geo/cache/geoBoundariesCGAZ_" + upper + "_" + iso3 + ".geojson");
    candidates.push("map/geo/geoBoundariesCGAZ_" + upper + ".geojson");
    return candidates;
  }

  function bundledPayload(level, iso3, signal, onlineError) {
    var candidates = bundledCandidates(level, iso3);
    function attempt(index, lastError) {
      if (index >= candidates.length) return Promise.reject(lastError || new Error("GeoJSON penuh lokal tidak tersedia."));
      var url = new URL(candidates[index], window.location.href).toString();
      return window.fetch(url, { method: "GET", credentials: "same-origin", cache: "force-cache", signal: signal })
        .then(function (response) { return jsonFromResponse(response, "GeoJSON lokal"); })
        .then(function (geojson) { return { geojson: validateGeoJson(geojson, "GeoJSON lokal"), source: {
          mode: isOnline() ? "local-fallback-static" : "local-offline-static", label: "geoBoundaries CGAZ lokal", resolution: "full",
          onlineChecked: isOnline(), sourceUrl: url, fallbackReason: onlineError ? String(onlineError.message || onlineError) : "browser offline"
        } }; })
        .catch(function (error) { return attempt(index + 1, error); });
    }
    return attempt(0, onlineError);
  }

  function filteredPayload(result, level, params, iso3, signal) {
    var allFeatures = result.geojson.features;
    if (iso3) allFeatures = allFeatures.filter(function (feature) { return featureCountry(feature) === iso3; });
    var targetName = params.get(level); var targetId = params.get(level + "_id");
    if (level !== "adm2") {
      result.geojson = { type: "FeatureCollection", features: selectExact(allFeatures, targetName, targetId) };
      result.geojson._mpmAdmSource = result.source;
      return Promise.resolve(result);
    }
    var parentName = params.get("adm1"); var parentId = params.get("adm1_id");
    if (!parentName && !parentId) return Promise.reject(new Error("Parent ADM1 wajib untuk pemuatan ADM2 statis."));
    var parentPromise = result.source.mode.indexOf("online") === 0
      ? officialPayload(iso3, "adm1", signal)
      : bundledPayload("adm1", iso3, signal, new Error(result.source.fallbackReason || "online unavailable"));
    return parentPromise.then(function (parentResult) {
      var parents = parentResult.geojson.features.filter(function (feature) { return !iso3 || featureCountry(feature) === iso3; });
      parents = selectExact(parents, parentName, parentId);
      if (parents.length !== 1) throw new Error("Parent ADM1 tidak ditemukan secara tepat untuk penyaringan ADM2.");
      var children = allFeatures.filter(function (feature) { var center = geometryCenter(feature); return center && pointInFeature(center, parents[0]); });
      result.geojson = { type: "FeatureCollection", features: selectExact(children, targetName, targetId) };
      result.geojson._mpmAdmSource = result.source;
      return result;
    });
  }

  function fetchStatic(input, settings) {
    var parsed = new URL(requestUrl(input, settings.params || {}));
    var params = parsed.searchParams; var level = String(params.get("level") || "adm0").toLowerCase();
    if (["adm0", "adm1", "adm2"].indexOf(level) === -1) return Promise.reject(new Error("Level ADM tidak didukung."));
    var iso3 = iso3FromParams(params); var world = level === "adm0" && !iso3;
    var onlinePromise = world ? worldAdm0Online(settings.signal) : officialPayload(iso3, level, settings.signal);
    return onlinePromise.catch(function (onlineError) { return bundledPayload(level, iso3, settings.signal, onlineError); })
      .then(function (result) { return filteredPayload(result, level, params, iso3, settings.signal); })
      .then(function (result) { return { geojson: result.geojson, source: result.source, requestUrl: result.source.sourceUrl }; });
  }

  function fetchServer(input, settings) {
    var url = requestUrl(input, settings.params || {});
    return window.fetch(url, { method: "GET", credentials: "same-origin", cache: isOnline() ? "no-store" : "force-cache", signal: settings.signal })
      .then(function (response) {
        var provenance = sourceInfo(response);
        if (!response.ok) return response.text().then(function (body) {
          var error = new Error("ADM boundary HTTP " + response.status + (body ? ": " + body.slice(0, 500) : ""));
          error.status = response.status; error.body = body; error.admSource = provenance; throw error;
        });
        return response.json().then(function (geojson) {
          validateGeoJson(geojson, "ADM boundary response"); geojson._mpmAdmSource = provenance;
          return { geojson: geojson, source: provenance, requestUrl: url };
        });
      });
  }

  function fetchGeoJson(input, options) {
    var settings = options && typeof options === "object" ? options : {};
    return isStaticHosting(settings) ? fetchStatic(input, settings) : fetchServer(input, settings);
  }

  function sourceLabel(source, language) {
    var info = source && typeof source === "object" ? source : {}; var id = String(language || "id").toLowerCase() === "id";
    if (info.mode === "online-cache-static") return id ? "cache lokal geoBoundaries penuh" : "full local geoBoundaries cache";
    if (String(info.mode || "").indexOf("online") === 0) return id ? "geoBoundaries online, resolusi penuh" : "geoBoundaries online, full resolution";
    if (String(info.mode || "").indexOf("local-offline") === 0) return id ? "GeoJSON lokal penuh, mode offline" : "Full local GeoJSON, offline mode";
    return id ? "GeoJSON lokal penuh, fallback online gagal" : "Full local GeoJSON, online fallback";
  }

  window.MpmAdmBoundary = Object.freeze({
    isOnline: isOnline, isStaticHosting: isStaticHosting, requestUrl: requestUrl,
    fetchGeoJson: fetchGeoJson, sourceLabel: sourceLabel,
    iso3FromIso2: function (iso2) { return ISO_PAIRS[String(iso2 || "").trim().toUpperCase()] || ""; }
  });
})(window);
