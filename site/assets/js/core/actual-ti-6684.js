(function (window) {
  "use strict";

  // One policy for request, continuity, reconciliation and retry. Override before loading.
  var POLICY = Object.freeze(Object.assign({
    onlineGracePeriodMs: 300000, maxAnchorAgeMs: 1800000, requestTimeoutMs: 15000,
    retryInitialMs: 3000, retryMaximumMs: 60000,
    resynchronizationIntervalMs: 300000, highUncertaintyMs: 2000,
    maximumSmoothCorrectionMs: 10000, slewDurationMs: 60000
  }, window.MpmActualTimePolicy || {}));
  Object.keys(POLICY).forEach(function(key) { if (!Number.isFinite(POLICY[key]) || POLICY[key] <= 0) throw new Error('Invalid actual-time policy: '+key); });
  var lastValidOnlineTime = null, serverAnchor = null, retryAttempt = 0;
  var runtimeSlewMs = 0;
  var CONTEXT_KEY = "global";
  var STATE_KEY = "mpm:actual-time:v1:state:" + CONTEXT_KEY;
  var LOG_KEY = "mpm:actual-time:v1:logs:" + CONTEXT_KEY;
  var OUTBOX_KEY = "mpm:actual-time:v1:outbox:" + CONTEXT_KEY;
  var ROLLBACK_TOLERANCE_MS = 2000;
  var MAX_LOGS = 100;
  var runtimeAnchorEpochMs = Date.now();
  var runtimeHoldMs = 0;
  var runtimeAnchorPerformanceMs = performanceNow();
  var state = null;
  var initialized = false;
  var initialization = null;
  var refreshInFlight = null;
  var refreshTimer = null;
  var RESYNCHRONIZATION_INTERVAL_MS = POLICY.resynchronizationIntervalMs;
  var evidence = null;
  var lastTrustedPerformanceMs = -Infinity;
  var deviceBaseline = { wall: Date.now(), mono: performanceNow() };
  var retryTimer = null;
  var outboxFlight = null;

  function confirmedEvidence(code, proofKey) {
    var now = performanceNow();
    if (!evidence || evidence.code !== code || now - evidence.last > 90000) evidence = { code: code, first: now, last: now, count: 1, proofKey: proofKey };
    else if (now - evidence.last >= 3000 && (!proofKey || proofKey !== evidence.proofKey)) { evidence.last = now; evidence.count++; evidence.proofKey = proofKey; }
    return evidence.count >= 3 && now - evidence.first >= 10000;
  }

  function anchorAge() {
    return lastValidOnlineTime ? Math.max(0, performanceNow()-lastValidOnlineTime.receivedAtMonotonic)+lastValidOnlineTime.sourceAgeMs : Infinity;
  }
  function validOnlineAnchor() { return lastValidOnlineTime && anchorAge() <= POLICY.maxAnchorAgeMs + POLICY.onlineGracePeriodMs; }
  function audit(event, reason) {
    appendLocalLog({eventType:event,decision:'observed',reasonCode:reason||'',actualEpochMs:nowEpochMs(),deviceEpochMs:Date.now()},false);
  }
  function scheduleRetry() {
    if (retryTimer) return;
    var delay=Math.min(POLICY.retryMaximumMs,POLICY.retryInitialMs*Math.pow(2,Math.min(retryAttempt++,12)));
    if(state)state.retryDelayMs=delay;
    retryTimer=window.setTimeout(function(){retryTimer=null;refresh();},delay);
  }
  function continuity(reason, backendAvailable) {
    if(!state)return;
    state.online=false;state.networkAvailable=false;
    state.networkTime=Object.assign({},state.networkTime||{},{available:false,stale:true});
    if(state.mandatory){state.authorityStatus='TIME_INVALID';state.onlineStatus='ONLINE_UNAVAILABLE';state.confidence='INVALID';}
    if(backendAvailable!==undefined)state.backendAvailable=backendAvailable;
    state.connectionStatus=reason||'unavailable';
    if(validOnlineAnchor() && !state.mandatory) {
      if(state.authorityStatus!=='ONLINE_CONTINUING')audit('online_continuing',reason);
      state.onlineStatus='ONLINE_CONTINUING';
      state.authorityStatus=state.activeSourceMode==='manual_user'?'MANUAL_ANCHOR':'ONLINE_CONTINUING';
      state.confidence=anchorAge()>POLICY.maxAnchorAgeMs||lastValidOnlineTime.uncertaintyMs>POLICY.highUncertaintyMs?'LOW':'MEDIUM';
      state.status='online-continuing';state.requiresConfirmation=false;
      if(state.activeSourceMode!=='manual_user')state.activeSourceMode='online_network';
    } else if(!state.mandatory) {
      state.onlineStatus='ONLINE_UNAVAILABLE';state.confidence='LOW';
      var fallback=state.activeSourceMode==='manual_user'?'MANUAL_ANCHOR':serverAnchor?'SERVER_FALLBACK':'DEVICE_FALLBACK';
      if(state.authorityStatus!==fallback) {
        // Change source once; reconcile rather than jumping the displayed clock.
        var target=fallback==='SERVER_FALLBACK'?serverAnchor.epochMs+Math.max(0,performanceNow()-serverAnchor.mono):Date.now();
        if(fallback!=='MANUAL_ANCHOR')reconcile(target);
        audit('fallback_activated',fallback+':'+reason);
      }
      state.authorityStatus=fallback;state.status='fallback-authoritative';
      if(fallback!=='MANUAL_ANCHOR')state.activeSourceMode='server_device';
      // Expiry is visible but need not interrupt a valid fallback.
      state.requiresConfirmation=Boolean(state.requiresConfirmation && !lastValidOnlineTime);
    }
    state.lastValidOnlineTime=clone(lastValidOnlineTime);
    persistState();
  }
  function connectionUnavailable(reason) {
    if(!state)return;
    audit(reason==='timeout'?'network_timeout':'network_unavailable',reason);audit(lastValidOnlineTime?'recalibration_failed':'calibration_failed',reason);
    continuity(reason,false);scheduleRetry();
    detectRuntimeRollback();dispatch('mpm:actual-time-status');
  }

  function performanceNow() {
    return window.performance && typeof window.performance.now === "function"
      ? window.performance.now()
      : 0;
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function safeRead(key, fallback) {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(key) || "null");
      return parsed === null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function makeRequestId(prefix) {
    var random = "";
    if (window.crypto && window.crypto.getRandomValues) {
      var values = new Uint32Array(2);
      window.crypto.getRandomValues(values);
      random = values[0].toString(36) + values[1].toString(36);
    } else {
      random = Math.random().toString(36).slice(2);
    }
    return (prefix || "time") + ":" + Date.now().toString(36) + ":" + random;
  }

  function actorId() {
    var configured = document.documentElement.dataset.actualTimeActor || "";
    if (configured) {
      return configured;
    }
    if (window.PrayerDashboardRuntime && window.PrayerDashboardRuntime.getConfig) {
      var config = window.PrayerDashboardRuntime.getConfig();
      if (config && config.user && config.user.id) {
        return String(config.user.id);
      }
    }
    var operator = document.getElementById("operatorId");
    return operator && operator.value ? String(operator.value) : "browser-user";
  }

  function apiUrl() {
    return window.PrayerRuntime && typeof window.PrayerRuntime.api === "function"
      ? window.PrayerRuntime.api("actual-time.php")
      : "api/actual-time.php";
  }

  function nowEpochMs() {
    var elapsed = Math.max(0, performanceNow() - runtimeAnchorPerformanceMs);
    return Math.floor(runtimeAnchorEpochMs + Math.max(0, elapsed - runtimeHoldMs) + runtimeSlewMs*Math.min(1,elapsed/Math.max(POLICY.slewDurationMs,Math.abs(runtimeSlewMs)*2)));
  }

  function nowDate() {
    return new Date(nowEpochMs());
  }

  function setRuntimeAnchor(epochMs, holdMs) {
    runtimeSlewMs = 0;
    runtimeAnchorEpochMs = Math.floor(Number(epochMs));
    runtimeAnchorPerformanceMs = performanceNow();
    runtimeHoldMs = Math.max(0, Number(holdMs) || 0);
  }

  function reconcile(target) {
    var current=nowEpochMs();
    setRuntimeAnchor(current);
    runtimeSlewMs=target-current;
  }

  function dispatch(name) {
    if (typeof window.CustomEvent === "function") {
      window.dispatchEvent(new window.CustomEvent(name, { detail: snapshot() }));
    }
  }

  function persistState() {
    if (state) {
      safeWrite(STATE_KEY, state);
    }
  }

  function localLogs() {
    var logs = safeRead(LOG_KEY, []);
    return Array.isArray(logs) ? logs : [];
  }

  function appendLocalLog(entry, queueForServer) {
    var log = Object.assign({
      requestId: makeRequestId("actual-time"),
      contextKey: CONTEXT_KEY,
      actorId: actorId(),
      recordedAt: new Date(nowEpochMs()).toISOString(),
      page: window.location.pathname
    }, entry || {});
    var logs = localLogs();
    logs.unshift(log);
    safeWrite(LOG_KEY, logs.slice(0, MAX_LOGS));
    if (queueForServer) {
      var outbox = safeRead(OUTBOX_KEY, []);
      outbox = Array.isArray(outbox) ? outbox : [];
      if (!outbox.some(function (item) { return item.requestId === log.requestId; })) {
        outbox.push(log);
        safeWrite(OUTBOX_KEY, outbox.slice(-MAX_LOGS));
      }
    }
    return log;
  }

  function buildOfflineState(saved, deviceNow) {
    var usable = saved && Number.isFinite(Number(saved.anchorEpochMs))
      && Number.isFinite(Number(saved.deviceObservedEpochMs));
    if (!usable) {
      return {
        schemaVersion: "mpm.actual-time.client.v1",
        contextKey: CONTEXT_KEY,
        activeSourceMode: "server_device",
        anchorEpochMs: deviceNow,
        deviceObservedEpochMs: deviceNow,
        serverObservedEpochMs: null,
        lastAuthoritativeEpochMs: deviceNow,
        online: false,
        backendAvailable: false,
        networkAvailable: false,
        status: "offline-unconfirmed",
        requiresConfirmation: true,
        mandatory: false,
        anomalyCode: "",
        deviationMs: 0,
        revision: 0,
        updatedAt: new Date().toISOString()
      };
    }
    var elapsedDeviceMs = deviceNow - Number(saved.deviceObservedEpochMs);
    var rollback = elapsedDeviceMs < -ROLLBACK_TOLERANCE_MS;
    var projected = rollback
      ? Number(saved.lastAuthoritativeEpochMs || saved.anchorEpochMs)
      : Number(saved.anchorEpochMs) + Math.max(0, elapsedDeviceMs);
    return Object.assign({}, saved, {
      anchorEpochMs: projected,
      deviceObservedEpochMs: deviceNow,
      lastAuthoritativeEpochMs: Math.max(Number(saved.lastAuthoritativeEpochMs || 0), projected),
      online: false,
      backendAvailable: false,
      networkAvailable: false,
      status: rollback ? "device-rollback" : (saved.mandatory ? saved.status : (saved.requiresConfirmation || elapsedDeviceMs > 86400000 ? 'offline-confirmation' : "offline-holdover")),
      requiresConfirmation: rollback || elapsedDeviceMs > 86400000 || Boolean(saved.requiresConfirmation),
      mandatory: rollback || Boolean(saved.mandatory),
      anomalyCode: rollback ? "DEVICE_TIME_ROLLBACK" : (saved.mandatory ? saved.anomalyCode : ""),
      deviationMs: elapsedDeviceMs,
      updatedAt: new Date(projected).toISOString()
    });
  }

  function applyServerSnapshot(data) {
    var deviceNow = Date.now();
    var timing=data.transport||{}, received=performanceNow();
    var wireDelay=Math.max(0,Number(timing.oneWayMs)||0);
    if(Number.isFinite(Number(data.serverEpochMs)) && Number(data.serverEpochMs)>946684800000 && !(data.anomaly||{}).requiresAction)
      serverAnchor={epochMs:Number(data.serverEpochMs)+wireDelay,mono:received};
    if(data.networkTime && data.networkTime.available===true &&
       (!Number.isFinite(Number(data.networkTime.sampledEpochMs)) || Number(data.networkTime.sampledEpochMs)<946684800000 || Number(data.networkTime.sampledEpochMs)>7258118400000)) {
      state.authorityStatus='TIME_INVALID';state.onlineStatus='ONLINE_UNAVAILABLE';state.networkAvailable=false;state.confidence='INVALID';state.mandatory=true;state.requiresConfirmation=true;state.anomalyCode='INVALID_ONLINE_TIMESTAMP';
      audit('time_validation_failed','INVALID_ONLINE_TIMESTAMP');persistState();dispatch('mpm:actual-time-status');return state;
    }
    var serverState = data && data.state ? data.state : {};
    var projected = Number(serverState.projectedEpochMs || data.serverEpochMs || deviceNow)+wireDelay;
    var anomaly = data && data.anomaly ? data.anomaly : {};
    var networkTime = data && data.networkTime ? data.networkTime : {};
    var activeMode = serverState.activeSourceMode || "server_device";
    var networkAvailable = networkTime.available === true;
    var measurementUncertainty=(Number(networkTime.uncertaintyMs)||0)+wireDelay;
    if(networkAvailable && ((!Number.isInteger(Number(networkTime.sampleCount)) || Number(networkTime.sampleCount)<2) || measurementUncertainty>POLICY.highUncertaintyMs)) {
      continuity('calibration-quality-insufficient',true);audit('calibration_failed','insufficient-samples-or-uncertainty');scheduleRetry();dispatch('mpm:actual-time-status');return state;
    }
    var onlineDelta=lastValidOnlineTime?Number(networkTime.sampledEpochMs)+wireDelay-(lastValidOnlineTime.timestampEpochMs+received-lastValidOnlineTime.receivedAtMonotonic):0;
    var largeConflict=lastValidOnlineTime && Math.abs(onlineDelta)>POLICY.maximumSmoothCorrectionMs+lastValidOnlineTime.uncertaintyMs+(Number(timing.rttMs)||0)/2;
    var networkConflict = networkAvailable && (networkTime.syncAccepted === false || largeConflict) && activeMode !== 'manual_user';
    var conflictCode = networkConflict ? (largeConflict?'ONLINE_TIME_CONFLICT':'NETWORK_TIME_BEFORE_AUTHORITY') : (anomaly.requiresAction ? (anomaly.code || 'SERVER_TIME_ROLLBACK') : '');
    if (conflictCode) {
      var confirmed = confirmedEvidence(conflictCode, networkConflict
        ? String(networkTime.sourceKey || '') + ':' + String(networkTime.retrievedAtServerEpochMs || networkTime.sampledEpochMs)
        : String(data.serverEpochMs));
      if (state) {
        state.backendAvailable = true; state.online = networkAvailable; state.networkAvailable = networkAvailable;
        state.networkTime = clone(networkTime); state.connectionStatus = 'checking-anomaly';
        state.mandatory = Boolean(state.mandatory) || confirmed;
        state.requiresConfirmation = Boolean(state.requiresConfirmation) || confirmed;
        state.authorityStatus=confirmed?'TIME_INVALID':(validOnlineAnchor()?'ONLINE_CONTINUING':'ONLINE_RECONNECTING');state.confidence=confirmed?'INVALID':'LOW';
        state.anomalyCode = conflictCode; state.status = state.mandatory ? 'confirmed-anomaly' : 'checking-anomaly';
        if (confirmed && !state.confirmedEvidenceLogged) {
          state.confirmedEvidenceLogged = true;
          appendLocalLog({eventType:'time_validation_failed',decision:'requires_confirmation',reasonCode:conflictCode,actualEpochMs:nowEpochMs(),deviceEpochMs:deviceNow,metadata:clone(evidence)},false);
        }
        persistState(); dispatch('mpm:actual-time-status'); return state;
      }
    } else if (networkAvailable) {
      if (initialized && state && (state.connectionStatus || state.mandatory)) appendLocalLog({eventType:'time_reference_recovered',decision:'observed',actualEpochMs:nowEpochMs(),deviceEpochMs:deviceNow},false);
      var wasContinuing=state && state.onlineStatus && state.onlineStatus!=='ONLINE_CONFIRMED';
      var sourceAge=Math.max(0,Number(networkTime.cacheAgeMs)||0);
      lastValidOnlineTime={timestampUtc:new Date(Number(networkTime.sampledEpochMs)+wireDelay).toISOString(),
        timestampEpochMs:Number(networkTime.sampledEpochMs)+wireDelay,localTimestamp:new Date(Number(networkTime.sampledEpochMs)+wireDelay).toString(),
        receivedAtMonotonic:received,source:networkTime.sourceName||networkTime.sourceKey,sourceIdentifier:networkTime.sourceKey,serverIdentifiers:(networkTime.samples||[]).map(function(sample){return sample.host||sample.source||null;}),
        sourceAgeMs:sourceAge,requestTimestamp:timing.requestTimestamp||null,responseTimestamp:timing.responseTimestamp||new Date(deviceNow).toISOString(),
        rttMs:Number(timing.rttMs)||0,offsetMs:Number(networkTime.sampledEpochMs)+wireDelay-deviceNow,
        uncertaintyMs:Math.max(0,Number(networkTime.uncertaintyMs)||Number(networkTime.spreadMs)||0)+wireDelay,status:'valid'};
      (networkTime.samples||[]).forEach(function(sample){audit('calibration_sample_received',String(sample.host||sample.source||'online'));});
      audit(initialized?'recalibration_success':'calibration_success');
      audit(wasContinuing?'online_reconnected':'online_revalidated');
      retryAttempt=0;if(retryTimer){window.clearTimeout(retryTimer);retryTimer=null;}
      evidence = null; lastTrustedPerformanceMs = performanceNow();
      deviceBaseline = { wall: deviceNow, mono: performanceNow() };
    } else if (initialized && state) {
      state.networkTime=Object.assign({},state.networkTime||{},{available:false,stale:true});continuity('online-source-unavailable',true);audit('network_unavailable','online-source-unavailable');audit(lastValidOnlineTime?'recalibration_failed':'calibration_failed','online-source-unavailable');scheduleRetry();dispatch('mpm:actual-time-status');return state;
    }
    if(!networkAvailable && activeMode!=='manual_user'){activeMode='server_device';projected=serverAnchor?serverAnchor.epochMs:deviceNow;}
    if(networkAvailable && activeMode==='online_network')projected=Number(networkTime.sampledEpochMs)+wireDelay;
    var fallbackConfirmation = !networkAvailable && activeMode !== 'manual_user' && Boolean(state && state.requiresConfirmation);
    var mandatory = Boolean(anomaly.requiresAction) || networkConflict;
    var requiresConfirmation = mandatory || fallbackConfirmation;
    var status = "fallback-authoritative";
    if (mandatory) {
      status = networkConflict ? "network-time-conflict" : "server-rollback";
    } else if (activeMode === "manual_user") {
      status = "manual-authoritative";
    } else if (networkAvailable && activeMode === "online_network") {
      status = "online-authoritative";
    } else if (!networkAvailable) {
      status = "online-unavailable-confirmation";
    }
    state = {
      schemaVersion: "mpm.actual-time.client.v1",
      contextKey: CONTEXT_KEY,
      activeSourceMode: activeMode,
      anchorEpochMs: projected,
      deviceObservedEpochMs: deviceNow,
      serverObservedEpochMs: Number(data.serverEpochMs || 0) || null,
      lastAuthoritativeEpochMs: Math.max(projected, Number(serverState.authoritativeEpochMs || 0)),
      online: networkAvailable,
      backendAvailable: true,
      networkAvailable: networkAvailable,
      status: status,
      requiresConfirmation: requiresConfirmation,
      mandatory: mandatory,
      anomalyCode: networkConflict ? "NETWORK_TIME_BEFORE_AUTHORITY" : (anomaly.code || ""),
      deviationMs: Number(anomaly.deviceDeviationMs || deviceNow - projected),
      revision: Number(serverState.revision || 0),
      updatedAt: serverState.updatedAt || new Date().toISOString(),
      configurations: clone(data.configurations || {}),
      latestLogs: clone(data.latestLogs || []),
      policy: clone(data.policy || {}),
      networkTime: clone(networkTime),
      lastValidOnlineTime:clone(lastValidOnlineTime),
      authorityStatus:mandatory?'TIME_INVALID':activeMode==='manual_user'?'MANUAL_ANCHOR':networkAvailable?'ONLINE_CONFIRMED':'SERVER_FALLBACK',
      onlineStatus:networkAvailable?'ONLINE_CONFIRMED':'ONLINE_UNAVAILABLE',
      confidence:mandatory?'INVALID':networkAvailable?(lastValidOnlineTime.uncertaintyMs>POLICY.highUncertaintyMs?'LOW':'HIGH'):'LOW'
    };
    if(!networkAvailable)audit(state.authorityStatus,'online-source-unavailable');
    if(initialized)reconcile(projected);
    else {var hold=Math.max(0,Number(serverState.catchupRemainingMs)||0);setRuntimeAnchor(hold?Math.max(projected,Number(serverState.projectedEpochMs)||0):projected,hold);}
    persistState();
    dispatch("mpm:actual-time-status");
    return state;
  }

  function requestSnapshot() {
    var requestWall=Date.now(), started = performanceNow(), controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, POLICY.requestTimeoutMs);
    var url = apiUrl() + "?context=" + encodeURIComponent(CONTEXT_KEY)
      + "&calibrate=" + (lastValidOnlineTime ? "0" : "1")
      + "&actor_id=" + encodeURIComponent(actorId())
      + "&device_epoch_ms=" + encodeURIComponent(Date.now());
    return window.fetch(url, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok || !payload || payload.success !== true || !payload.data) {
            throw new Error((payload && payload.error) || "Actual time API is unavailable.");
          }
          var rtt=Math.max(0,performanceNow()-started);
          var processing=Math.min(rtt,Math.max(0,Number(payload.data.processingDurationMs)||0));
          payload.data.transport={rttMs:rtt,oneWayMs:(rtt-processing)/2,requestTimestamp:new Date(requestWall).toISOString(),responseTimestamp:new Date(Date.now()).toISOString()};
          return payload.data;
        });
      }).finally(function () { window.clearTimeout(timeout); });
  }

  function postDecision(decision) {
    var payload = {
      contextKey: CONTEXT_KEY,
      sourceMode: decision.sourceMode,
      action: decision.action,
      actualEpochMs: decision.actualEpochMs === null || decision.actualEpochMs === undefined
        ? null
        : Number(decision.actualEpochMs),
      deviceEpochMs: decision.deviceEpochMs || Date.now(),
      actorId: decision.actorId || actorId(),
      clientRequestId: decision.requestId || makeRequestId("actual-time"),
      metadata: Object.assign({ page: window.location.pathname }, decision.metadata || {})
    };
    var controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, POLICY.requestTimeoutMs);
    return window.fetch(apiUrl(), {
      signal: controller.signal,
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Actor-Id": payload.actorId,
        "X-Client-Request-Id": payload.clientRequestId
      },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json().then(function (result) {
        if (!result || result.success !== true || !result.data) {
          throw new Error((result && result.error) || "Actual time decision failed.");
        }
        return result.data;
      });
    }).finally(function () { window.clearTimeout(timeout); });
  }

  function flushOutboxQueue() {
    var outbox = safeRead(OUTBOX_KEY, []);
    outbox = Array.isArray(outbox) ? outbox : [];
    if (!outbox.length) {
      return Promise.resolve(true);
    }
    function next() {
      if (!outbox.length) {
        return Promise.resolve(true);
      }
      var item = outbox[0];
      return postDecision({
        sourceMode: item.sourceMode,
        action: item.action,
        actualEpochMs: item.actualEpochMs,
        deviceEpochMs: item.deviceEpochMs,
        actorId: item.actorId,
        requestId: item.requestId,
        metadata: Object.assign({}, item.metadata || {}, { offlineRecordedAt: item.recordedAt })
      }).then(function () {
        outbox.shift();
        var current = safeRead(OUTBOX_KEY, []);
        safeWrite(OUTBOX_KEY, (Array.isArray(current) ? current : []).filter(function (entry) { return entry.requestId !== item.requestId; }));
        return next();
      });
    }
    return next();
  }

  function flushOutbox() {
    if (!outboxFlight) outboxFlight = flushOutboxQueue().finally(function () { outboxFlight = null; });
    return outboxFlight;
  }

  function initialize() {
    if (initialization) {
      return initialization;
    }
    var deviceNow = Date.now();
    state = buildOfflineState(safeRead(STATE_KEY, null), deviceNow);
    setRuntimeAnchor(state.anchorEpochMs);
    persistState();
    initialization = Promise.resolve()
      .then(function () {
        if (!window.fetch || (window.PrayerRuntime && window.PrayerRuntime.isFileMode) || navigator.onLine === false) {
          throw new Error("offline");
        }
        state.authorityStatus='ONLINE_CALIBRATING';if(!state.mandatory)state.requiresConfirmation=false;audit('calibration_started');
        return requestSnapshot();
      })
      .then(function (data) {
        applyServerSnapshot(data);
        initialized = true;
        flushOutbox().catch(function () {});
        dispatch("mpm:actual-time-ready");
        return snapshot();
      })
      .catch(function (error) {
        connectionUnavailable(error.name==='AbortError'?'timeout':'unavailable');
        state.online = false;
        state.backendAvailable = false;
        state.networkAvailable = false;
        persistState();
        initialized = true;
        appendLocalLog({
          sourceMode: state.activeSourceMode,
          eventType: state.mandatory ? "device_rollback_detected" : (state.requiresConfirmation ? "offline_confirmation_required" : "offline_anchor_retained"),
          decision: state.mandatory ? "requires_confirmation" : "observed",
          actualEpochMs: state.anchorEpochMs,
          deviceEpochMs: deviceNow,
          reasonCode: state.anomalyCode || "OFFLINE_STARTUP",
          action: "confirm",
          metadata: { deviationMs: state.deviationMs }
        }, false);
        dispatch("mpm:actual-time-ready");
        dispatch("mpm:actual-time-status");
        return snapshot();
      });
    return initialization;
  }

  function refresh() {
    if (refreshInFlight) {
      return refreshInFlight;
    }
    if (!window.fetch || (window.PrayerRuntime && window.PrayerRuntime.isFileMode) || navigator.onLine === false) {
      connectionUnavailable('offline');
      return Promise.resolve(snapshot());
    }
    if(state){state.onlineStatus=lastValidOnlineTime?'ONLINE_RECALIBRATING':'ONLINE_RECONNECTING';if(validOnlineAnchor()&&!state.mandatory){state.requiresConfirmation=false;state.authorityStatus='ONLINE_RECALIBRATING';}audit(lastValidOnlineTime?'recalibration_started':'calibration_started');dispatch('mpm:actual-time-status');}
    refreshInFlight = requestSnapshot()
      .then(function (data) {
        applyServerSnapshot(data);
        initialized = true;
        flushOutbox().catch(function () {});
        dispatch("mpm:actual-time-ready");
        return snapshot();
      })
      .catch(function (error) {
        connectionUnavailable(error.name==='AbortError'?'timeout':'unavailable');
        return snapshot();
      })
      .finally(function () {
        refreshInFlight = null;
        if (state && (!state.networkAvailable || evidence) && !retryTimer && !document.hidden) {
          scheduleRetry();
        }
      });
    return refreshInFlight;
  }

  function applyLocalDecision(options) {
    var proposed = Number(options.actualEpochMs);
    var minimum = Math.max(Number(state.lastAuthoritativeEpochMs || 0), nowEpochMs());
    if (!Number.isFinite(proposed) || proposed + ROLLBACK_TOLERANCE_MS < minimum) {
      audit('time_validation_failed','PROPOSED_TIME_BEFORE_AUTHORITATIVE_TIME');
      return Promise.resolve({
        accepted: false,
        minimumEpochMs: minimum,
        error: "PROPOSED_TIME_BEFORE_AUTHORITATIVE_TIME"
      });
    }
    proposed = Math.max(proposed, minimum);
    state = Object.assign({}, state, {
      activeSourceMode: options.sourceMode,
      anchorEpochMs: proposed,
      deviceObservedEpochMs: Date.now(),
      lastAuthoritativeEpochMs: proposed,
      online: false,
      backendAvailable: false,
      networkAvailable: false,
      authorityStatus: options.sourceMode === 'manual_user'?'MANUAL_ANCHOR':validOnlineAnchor()?'ONLINE_CONTINUING':'DEVICE_FALLBACK',
      confidence: 'LOW',
      status: options.sourceMode === "manual_user" ? "manual-offline" : "last-authority-confirmed-offline",
      requiresConfirmation: false,
      mandatory: false,
      anomalyCode: "",
      deviationMs: Date.now() - proposed,
      revision: Number(state.revision || 0) + 1,
      updatedAt: new Date(proposed).toISOString()
    });
    setRuntimeAnchor(proposed);
    persistState();
    var log = appendLocalLog({
      sourceMode: options.sourceMode,
      eventType: options.sourceMode === 'manual_user' ? 'manual_anchor_created' : 'time_confirmed',
      decision: "accepted",
      actualEpochMs: proposed,
      deviceEpochMs: Date.now(),
      reasonCode: options.action === "set" ? "OFFLINE_MANUAL_ACCEPTED" : "OFFLINE_CONFIRM_ACCEPTED",
      action: options.action,
      metadata: options.metadata || {}
    }, true);
    dispatch("mpm:actual-time-status");
    return Promise.resolve({ accepted: true, localOnly: true, log: log, state: snapshot() });
  }

  function decide(options) {
    var settings = Object.assign({
      sourceMode: state && state.activeSourceMode || "online_network",
      action: "confirm",
      actualEpochMs: nowEpochMs(),
      metadata: {}
    }, options || {});
    if (!state || !state.backendAvailable) {
      return applyLocalDecision(settings);
    }
    return postDecision({
      sourceMode: settings.sourceMode,
      action: settings.action,
      actualEpochMs: settings.actualEpochMs,
      deviceEpochMs: Date.now(),
      metadata: settings.metadata
    }).then(function (data) {
      applyServerSnapshot(data);
      if(settings.sourceMode==='manual_user' && data.accepted!==false)audit('manual_anchor_created');
      return data;
    });
  }

  function confirmCurrent(sourceMode) {
    var mode = sourceMode || state.activeSourceMode || "online_network";
    // Null delegates online sampling or the server fallback to the backend.
    // The browser wall clock must never silently become either authority.
    var backendAuthority = state && state.backendAvailable
      && (mode === "online_network" || mode === "server_device");
    var proposed = backendAuthority ? null : nowEpochMs();
    return decide({ sourceMode: mode, action: "confirm", actualEpochMs: proposed });
  }

  function confirmOfflineCurrent(sourceMode) {
    return applyLocalDecision({
      sourceMode: sourceMode || (state && state.activeSourceMode) || "online_network",
      action: "confirm",
      actualEpochMs: nowEpochMs(),
      metadata: { onlineSourceUnavailable: true }
    });
  }

  function setActualTime(epochMs, sourceMode, metadata) {
    return decide({
      sourceMode: sourceMode || "manual_user",
      action: "set",
      actualEpochMs: Number(epochMs),
      metadata: metadata || {}
    });
  }

  function snapshot() {
    if(state && lastValidOnlineTime && !validOnlineAnchor() && /^ONLINE_/.test(state.authorityStatus||''))continuity('grace-expired');
    return {
      initialized: initialized,
      contextKey: CONTEXT_KEY,
      epochMs: nowEpochMs(),
      iso: new Date(nowEpochMs()).toISOString(),
      state: Object.assign(clone(state)||{}, {calibrationAgeMs:Number.isFinite(anchorAge())?anchorAge():null}),
      localLogs: localLogs().slice(0, 20),
      pendingLogs: (safeRead(OUTBOX_KEY, []) || []).length
      , safety: { evidence: clone(evidence), lastTrustedAgeMs: Number.isFinite(lastTrustedPerformanceMs) ? performanceNow() - lastTrustedPerformanceMs : null }
    };
  }

  function detectRuntimeRollback() {
    if (!state) {
      return;
    }
    if(lastValidOnlineTime && performanceNow()<lastValidOnlineTime.receivedAtMonotonic) {
      if(state.anomalyCode!=='MONOTONIC_INTEGRITY_FAILED')audit('time_validation_failed','MONOTONIC_INTEGRITY_FAILED');
      state.mandatory=true;state.requiresConfirmation=true;state.authorityStatus='TIME_INVALID';state.confidence='INVALID';state.anomalyCode='MONOTONIC_INTEGRITY_FAILED';
      persistState();dispatch('mpm:actual-time-status');return;
    }
    var deviation = (Date.now() - deviceBaseline.wall) - (performanceNow() - deviceBaseline.mono);
    if (validOnlineAnchor()) {
      // A verified online source is intentionally independent of the device
      // wall clock. Keep the deviation visible, but never let it override NTP.
      state.deviationMs = deviation;
      return;
    }
    if (Math.abs(deviation) <= ROLLBACK_TOLERANCE_MS) {
      if (evidence && /^DEVICE_/.test(evidence.code)) evidence = null;
      return;
    }
    var code = deviation < 0 ? 'DEVICE_TIME_ROLLBACK' : 'DEVICE_TIME_FORWARD_JUMP';
    if (confirmedEvidence(code) && !state.mandatory) {
      state.mandatory = true;
      state.requiresConfirmation = true;
      state.status = "device-rollback";state.authorityStatus='TIME_INVALID';state.confidence='INVALID';
      state.anomalyCode = code;
      state.deviationMs = deviation;
      persistState();
      appendLocalLog({
        sourceMode: state.activeSourceMode,
        eventType: "device_rollback_detected",
        decision: "requires_confirmation",
        actualEpochMs: nowEpochMs(),
        deviceEpochMs: Date.now(),
        reasonCode: code,
        action: "set",
        metadata: { deviationMs: deviation }
      }, false);
      dispatch("mpm:actual-time-status");
    }
  }

  ["focus", "pageshow", "online"].forEach(function (name) {
    window.addEventListener(name, function () {
      detectRuntimeRollback();
      if (name === "online") {
        refresh();
      }
    });
  });
  window.addEventListener('offline', function () { connectionUnavailable('offline'); });
  window.setInterval(function () { if (initialized && !document.hidden) detectRuntimeRollback(); }, 5000);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      detectRuntimeRollback();
    }
  });

  window.MpmActualTime = {
    initialize: initialize,
    refresh: refresh,
    now: nowDate,
    nowEpochMs: nowEpochMs,
    snapshot: snapshot,
    confirmCurrent: confirmCurrent,
    confirmOfflineCurrent: confirmOfflineCurrent,
    setActualTime: setActualTime,
    flushOutbox: flushOutbox,
    sourceModes: ["online_network", "server_device", "manual_user"],
    policy: POLICY,
    resynchronizationIntervalMs: RESYNCHRONIZATION_INTERVAL_MS
  };

  if (!refreshTimer) {
    refreshTimer = window.setInterval(function () {
      if (!document.hidden && !retryTimer) {
        refresh();
      }
    }, RESYNCHRONIZATION_INTERVAL_MS);
  }

  initialize();
})(window);
