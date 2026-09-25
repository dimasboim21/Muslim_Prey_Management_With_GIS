(function (window, document) {
  "use strict";

  var dialog = null;
  var button = null;
  var clockTimer = null;
  var autoOpened = false;
  var automaticDialog = false;
  var fieldsInitialized = false;
  var lastMandatory = false;
  var logSignature = '';

  function isIndonesian() {
    if(window.PrayerI18n && window.PrayerI18n.getCurrentLanguage)return window.PrayerI18n.getCurrentLanguage()==='id';
    var query = new URLSearchParams(window.location.search).get("lang");
    return query ? query !== "en" : document.documentElement.lang !== "en";
  }

  function text(id, en) {
    if(window.MpmUiTranslations)window.MpmUiTranslations.register([[id,en]]);
    return isIndonesian() ? id : en;
  }

  function pad(value, length) {
    return String(value).padStart(length, "0");
  }

  function safeTimeZone(value) {
    try {
      var zone = String(value || "").trim();
      new Intl.DateTimeFormat("en", { timeZone: zone }).format(new Date());
      return zone;
    } catch (error) {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    }
  }

  function zonedParts(epochMs, timeZone) {
    var formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23"
    });
    var values = {};
    formatter.formatToParts(new Date(epochMs)).forEach(function (part) {
      if (part.type !== "literal") {
        values[part.type] = Number(part.value);
      }
    });
    return values;
  }

  function zonedLocalToEpoch(parts, timeZone) {
    var targetUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
    var guess = targetUtc;
    for (var index = 0; index < 3; index += 1) {
      var actual = zonedParts(guess, timeZone);
      var represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second, parts.millisecond);
      guess += targetUtc - represented;
    }
    return guess;
  }

  function formatActual(epochMs, withMs) {
    var options = {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23"
    };
    var result = new Intl.DateTimeFormat(isIndonesian() ? "id-ID" : "en-GB", options).format(new Date(epochMs));
    return withMs ? result + "." + pad(new Date(epochMs).getMilliseconds(), 3) : result;
  }

  function markup() {
    return '<button class="actual-time-launcher" id="actualTimeLauncher" type="button" title="'
      + text("Buka Otoritas Waktu Aktual", "Open Actual Time Authority")
      + '" aria-label="' + text("Buka Otoritas Waktu Aktual", "Open Actual Time Authority") + '"></button>'
      + '<dialog class="actual-time-dialog" id="actualTimeDialog" aria-labelledby="actualTimeTitle">'
      + '<form class="actual-time-form" id="actualTimeForm" method="dialog">'
      + '<header><div><p class="actual-time-eyebrow">' + text("Otoritas Waktu Aktual", "Actual Time Authority") + '</p>'
      + '<h2 id="actualTimeTitle">' + text("Konfirmasi waktu aplikasi", "Confirm application time") + '</h2></div>'
      + '<button class="actual-time-close" id="actualTimeClose" type="button" aria-label="' + text("Tutup", "Close") + '">&times;</button></header>'
      + '<p class="actual-time-explanation" id="actualTimeExplanation"></p>'
      + '<div class="actual-time-status-grid">'
      + '<div><span>' + text("Waktu aplikasi", "Application time") + '</span><strong id="actualTimeCurrent">-</strong></div>'
      + '<div><span>' + text("Waktu perangkat", "Device time") + '</span><strong id="actualTimeDevice">-</strong></div>'
      + '<div><span>' + text("Log aktual terakhir", "Last actual-time log") + '</span><strong id="actualTimeLastLog">-</strong></div>'
      + '<div><span>' + text("Deviasi perangkat", "Device deviation") + '</span><strong id="actualTimeDeviation">-</strong></div>'
      + '<div><span>' + text("Sumber waktu online", "Online time source") + '</span><strong id="actualTimeOnlineSource">-</strong></div>'
      + '</div>'
      + '<fieldset class="actual-time-source"><legend>' + text("Sumber waktu aktif", "Active time source") + '</legend>'
      + '<label class="actual-time-recommended"><input type="radio" name="actualTimeSource" value="online_network"> <span><strong>'
      + text("Online independen (utama)", "Independent online (primary)") + '</strong><small>'
      + text("Google Public NTP melalui backend; beberapa server diperiksa tanpa memakai jam perangkat sebagai sumber.", "Google Public NTP through the backend; multiple servers are checked without using the device clock as the source.")
      + '</small></span></label>'
      + '<label><input type="radio" name="actualTimeSource" value="server_device"> <span><strong>'
      + text("Server/perangkat (fallback)", "Server/device (fallback)") + '</strong><small>'
      + text("Dipakai bila waktu online tidak tersedia; tidak menghapus konfigurasi online atau manual.", "Used when online time is unavailable; it does not delete online or manual configuration.")
      + '</small></span></label>'
      + '<label><input type="radio" name="actualTimeSource" value="manual_user"> <span><strong>'
      + text("Konfigurasi manual pengguna", "Manual user configuration") + '</strong><small>'
      + text("Anchor mandiri yang berjalan monotonic dan dicatat terpisah.", "An independent monotonic anchor with its own log.")
      + '</small></span></label></fieldset>'
      + '<fieldset class="actual-time-source actual-time-calibration-display" id="actualTimeCalibrationDisplayFieldset" hidden><legend>'
      + text("Tampilan waktu aktual", "Actual time display") + '</legend>'
      + '<label><span><strong>' + text("Pilihan display", "Display selection") + '</strong><select id="actualTimeCalibrationDisplay">'
      + '<option value="isp">ISP / Provider</option>'
      + '<option value="building-coordinate-calibrated">' + text("Kalibrasi Gedung", "Building Calibration") + '</option>'
      + '</select><small id="actualTimeCalibrationDisplayStatus">-</small></span></label></fieldset>'
      + '<div class="actual-time-fields" id="actualTimeFields">'
      + '<label><span>' + text("Tanggal Masehi", "Gregorian date") + '</span><input id="actualTimeDate" type="date" required></label>'
      + '<label class="actual-time-focus"><span>' + text("Jam : menit", "Hour : minute") + '</span><input id="actualTimeClock" type="time" step="60" required></label>'
      + '<label><span>' + text("Zona waktu IANA", "IANA timezone") + '</span><input id="actualTimeZone" type="text" required></label>'
      + '<label class="actual-time-optional"><input id="actualTimeEditSeconds" type="checkbox"> <span>'
      + text("Edit detik dan milidetik (opsional)", "Edit seconds and milliseconds (optional)") + '</span></label>'
      + '<label><span>' + text("Detik", "Seconds") + '</span><input id="actualTimeSeconds" type="number" min="0" max="59" step="1" disabled></label>'
      + '<label><span>' + text("Milidetik", "Milliseconds") + '</span><input id="actualTimeMilliseconds" type="number" min="0" max="999" step="1" disabled></label>'
      + '</div>'
      + '<p class="actual-time-error" id="actualTimeError" role="alert"></p>'
      + '<details class="actual-time-log"><summary>' + text("Lihat log waktu", "View time log") + '</summary><ol id="actualTimeLogList"></ol></details>'
      + '<footer><button class="actual-time-secondary" id="actualTimeKeep" type="button">'
      + text("Pertahankan waktu", "Keep current time") + '</button><button class="actual-time-primary" id="actualTimeSave" type="submit">'
      + text("Simpan waktu aktual", "Save actual time") + '</button></footer>'
      + '</form></dialog>';
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function mode() {
    var checked = document.querySelector('input[name="actualTimeSource"]:checked');
    return checked ? checked.value : "online_network";
  }

  function fillFields(epochMs) {
    var zone = safeTimeZone(byId("actualTimeZone").value || Intl.DateTimeFormat().resolvedOptions().timeZone);
    byId("actualTimeZone").value = zone;
    var parts = zonedParts(epochMs, zone);
    byId("actualTimeDate").value = pad(parts.year, 4) + "-" + pad(parts.month, 2) + "-" + pad(parts.day, 2);
    byId("actualTimeClock").value = pad(parts.hour, 2) + ":" + pad(parts.minute, 2);
    byId("actualTimeSeconds").value = pad(parts.second, 2);
    byId("actualTimeMilliseconds").value = pad(new Date(epochMs).getMilliseconds(), 3);
  }

  function updateModeFields() {
    var manual = mode() === "manual_user";
    byId("actualTimeFields").classList.toggle("is-system-source", !manual);
    ["actualTimeDate", "actualTimeClock", "actualTimeZone", "actualTimeEditSeconds"].forEach(function (id) {
      byId(id).disabled = !manual;
    });
    if (!manual) {
      byId("actualTimeSeconds").disabled = true;
      byId("actualTimeMilliseconds").disabled = true;
      fillFields(window.MpmActualTime.nowEpochMs());
    } else {
      var edit = byId("actualTimeEditSeconds").checked;
      byId("actualTimeSeconds").disabled = !edit;
      byId("actualTimeMilliseconds").disabled = !edit;
    }
  }

  function renderLog(snapshot) {
    var logs = [];
    var serverLogs = snapshot.state && Array.isArray(snapshot.state.latestLogs) ? snapshot.state.latestLogs : [];
    logs = serverLogs.concat(snapshot.localLogs || []).slice(0, 8);
    var signature = JSON.stringify([isIndonesian(), logs]);
    if (signature === logSignature) return;
    logSignature = signature;
    var list = byId("actualTimeLogList");
    list.innerHTML = "";
    if (!logs.length) {
      var empty = document.createElement("li");
      empty.textContent = text("Belum ada log.", "No logs yet.");
      list.appendChild(empty);
      return;
    }
    logs.forEach(function (entry) {
      var item = document.createElement("li");
      var epoch = entry.resultingAuthoritativeEpochMs || entry.actualEpochMs || entry.proposedEpochMs;
      item.textContent = (entry.sourceMode || "-") + " \u00b7 " + (entry.eventType || entry.reasonCode || "log")
        + (epoch ? " \u00b7 " + formatActual(Number(epoch), true) : "");
      list.appendChild(item);
    });
  }

  function renderClock(snapshot) {
    if (!dialog || !window.MpmActualTime) return;
    snapshot = snapshot || window.MpmActualTime.snapshot();
    byId("actualTimeCurrent").textContent = formatActual(snapshot.epochMs, true);
    byId("actualTimeDevice").textContent = formatActual(Date.now(), true);
    var deviation = Date.now() - snapshot.epochMs;
    byId("actualTimeDeviation").textContent = (deviation >= 0 ? "+" : "") + (deviation / 1000).toFixed(3) + " s";
  }

  function render() {
    if (!window.MpmActualTime || !dialog) {
      return;
    }
    var snapshot = window.MpmActualTime.snapshot();
    var timeState = snapshot.state || {};
    var modeLabel = timeState.activeSourceMode === "manual_user"
      ? text("Manual", "Manual")
      : (timeState.activeSourceMode === "online_network"
        ? text("Online", "Online")
        : text("Fallback", "Fallback"));
    button.textContent = text("Waktu", "Time") + ": " + modeLabel;
    var continuing=['ONLINE_CONTINUING','ONLINE_RECONNECTING','ONLINE_RECALIBRATING'].includes(timeState.authorityStatus);
    var statusText=continuing
      ? text('Online - melanjutkan waktu tervalidasi','Online - continuing from validated time')
      : timeState.authorityStatus==='ONLINE_CONFIRMED'?text('Online - tervalidasi','Online - validated')
      : timeState.authorityStatus==='ONLINE_RECALIBRATING'?text('Kalibrasi ulang online','Online recalibration')
      : timeState.authorityStatus==='ONLINE_CALIBRATING'?text('Kalibrasi online','Online calibration')
      : timeState.authorityStatus==='TIME_INVALID'?text('Waktu tidak valid','Invalid time')
      : text('Waktu fallback digunakan','Fallback time source in use');
    button.textContent=continuing?text('Waktu: Online berlanjut','Time: Online continuing'):button.textContent;
    button.title=statusText+' | '+(timeState.confidence||'LOW');
    button.dataset.status = timeState.authorityStatus || timeState.status || 'checking';
    byId('actualTimeAuthorityStatus').textContent=statusText+' | '+text('Keyakinan: ','Confidence: ')+(timeState.confidence||'LOW');
    renderClock(snapshot);
    if(timeState.calibrationAgeMs!==null && timeState.calibrationAgeMs!==undefined)byId('actualTimeAuthorityStatus').textContent+=' ? '+text('Usia kalibrasi: ','Calibration age: ')+Math.floor(timeState.calibrationAgeMs/1000)+' s ? ?'+Math.round(timeState.lastValidOnlineTime?.uncertaintyMs||0)+' ms';
    var lastEpoch = Number(timeState.lastAuthoritativeEpochMs || snapshot.epochMs);
    byId("actualTimeLastLog").textContent = formatActual(lastEpoch, true);
    var networkTime = timeState.networkTime || {};
    byId("actualTimeOnlineSource").textContent = networkTime.available
      ? (networkTime.sourceName || text("Online tersedia", "Online available")) + " · " + (networkTime.servedFrom || "online")
      : (networkTime.sourceName ? networkTime.sourceName + text(" · referensi terakhir; koneksi belum terverifikasi", " · last reference; connection unverified")
        : text("Tidak tersedia — memakai anchor/fallback", "Unavailable — using anchor/fallback"));
    var calibrationFieldset = byId("actualTimeCalibrationDisplayFieldset");
    if (calibrationFieldset && window.MpmTimeCoordinateCalibration) {
      var calibration = window.MpmTimeCoordinateCalibration.getState();
      var calibrationTime = calibration.time || {};
      var calibrationNetwork = calibration.provider && calibration.provider.timeSource || {};
      calibrationFieldset.hidden = false;
      if (!dialog.open) byId("actualTimeCalibrationDisplay").value = calibration.configuration.actualTimeDisplayMode || "isp";
      byId("actualTimeCalibrationDisplayStatus").textContent = calibrationTime.differenceMilliseconds === null
        ? text("Koordinat atau jam provider belum tersedia.", "Provider coordinate or time is unavailable.")
        : text("Selisih astronomis: ", "Astronomical difference: ")
          + window.MpmTimeCoordinateCalibration.formatSignedDuration(calibrationTime.differenceMilliseconds)
          + " · " + (calibrationNetwork.providerName || "Unavailable")
          + text("; bukan master-clock ISP yang terverifikasi.", "; not a verified ISP master clock.");
    }
    var mandatory = Boolean(timeState.mandatory);
    var offline = !timeState.online;
    byId("actualTimeExplanation").textContent = mandatory && timeState.anomalyCode === 'NETWORK_TIME_BEFORE_AUTHORITY'
      ? text("Sampel waktu online tertinggal dari batas waktu aplikasi. Ini bukan otomatis berarti jam perangkat mundur. Sinkronisasi berikutnya akan memeriksa ulang; konfigurasi manual tetap harus memenuhi nilai minimum.", "The online time sample precedes the application time floor. This does not necessarily mean the device clock moved backward. The next synchronization will check again; manual time must still meet the minimum.")
      : mandatory && timeState.anomalyCode === 'SERVER_TIME_ROLLBACK'
      ? text("Jam server terdeteksi mundur terhadap anchor tersimpan. Konfirmasi waktu yang valid diperlukan.", "The server clock moved backward relative to its saved anchor. A valid time confirmation is required.")
      : mandatory && timeState.anomalyCode === 'DEVICE_TIME_FORWARD_JUMP'
      ? text("Lompatan maju jam perangkat terkonfirmasi saat referensi online tidak tersedia. Cocokkan waktu aktual dengan log terakhir sebelum melanjutkan.", "A forward device-clock jump was confirmed while the online reference was unavailable. Verify actual time against the last log before continuing.")
      : mandatory
      ? text("Anomali terdeteksi: waktu perangkat lebih lama daripada log otoritatif. Masukkan waktu aktual yang sama atau lebih maju; dialog tidak dapat ditutup sebelum valid.", "Anomaly detected: device time precedes the authoritative log. Enter an actual time equal to or later than the minimum; this dialog cannot be closed until valid.")
      : (offline
        ? text("Sumber online tidak tersedia. Konfirmasi untuk mempertahankan anchor terakhir atau pilih konfigurasi manual.", "The online source is unavailable. Confirm the last anchor or choose manual configuration.")
        : text("Waktu online independen tersedia sebagai sumber utama. Fallback server/perangkat dan anchor manual tetap disimpan terpisah.", "Independent online time is available as the primary source. Server/device fallback and manual anchors remain stored separately."));
    if(mandatory && timeState.anomalyCode==='INVALID_ONLINE_TIMESTAMP')byId('actualTimeExplanation').textContent=text('Sampel waktu online tidak valid. Menunggu referensi valid atau koreksi manual.','The online timestamp is invalid. Waiting for a valid reference or manual correction.');
    if(continuing && !mandatory)byId('actualTimeExplanation').textContent=text(
      'Koneksi online terganggu - menggunakan waktu online terakhir yang tervalidasi.',
      'Online connection interrupted - using the last validated online time.');
    else if(!mandatory && offline)byId('actualTimeExplanation').textContent=text(
      'Sumber waktu online tidak tersedia. Waktu fallback digunakan; sinkronisasi dicoba kembali di latar belakang.',
      'Online time source unavailable. Fallback time source in use; synchronization retries in the background.');
    dialog.dataset.mandatory = mandatory ? "true" : "false";
    byId("actualTimeClose").hidden = mandatory;
    byId("actualTimeKeep").hidden = mandatory;
    var selectedMode = mandatory ? "manual_user" : (timeState.activeSourceMode || "online_network");
    var radio = document.querySelector('input[name="actualTimeSource"][value="' + selectedMode + '"]');
    // Background authority updates must not replace the user's unsaved form.
    if (radio && (!dialog.open || (mandatory && !lastMandatory))) {
      radio.checked = true;
    }
    lastMandatory = mandatory;
    if (!fieldsInitialized) {
      fieldsInitialized = true;
      byId("actualTimeZone").value = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      fillFields(snapshot.epochMs);
    }
    updateModeFields();
    renderLog(snapshot);
  }

  function openDialog() {
    render();
    if (dialog.open) return;
    byId("actualTimeError").textContent = "";
    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog() {
    var state = window.MpmActualTime.snapshot().state || {};
    if (state.mandatory) {
      return;
    }
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function parsedEpoch() {
    var dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(byId("actualTimeDate").value || "");
    var timeMatch = /^(\d{2}):(\d{2})$/.exec(byId("actualTimeClock").value || "");
    if (!dateMatch || !timeMatch) {
      return NaN;
    }
    var editSeconds = byId("actualTimeEditSeconds").checked;
    var zone = safeTimeZone(byId("actualTimeZone").value);
    var current = zonedParts(window.MpmActualTime.nowEpochMs(), zone);
    return zonedLocalToEpoch({
      year: Number(dateMatch[1]), month: Number(dateMatch[2]), day: Number(dateMatch[3]),
      hour: Number(timeMatch[1]), minute: Number(timeMatch[2]),
      // Hour and minute remain the main inputs. When optional precision is
      // disabled, preserve the authority's live seconds rather than silently
      // rounding the proposal backward to :00.
      second: editSeconds ? Number(byId("actualTimeSeconds").value || 0) : current.second,
      millisecond: editSeconds
        ? Number(byId("actualTimeMilliseconds").value || 0)
        : new Date(window.MpmActualTime.nowEpochMs()).getMilliseconds()
    }, zone);
  }

  function submit(event) {
    event.preventDefault();
    byId("actualTimeError").textContent = "";
    var selectedMode = mode();
    var epochMs = selectedMode === "manual_user" ? parsedEpoch() : window.MpmActualTime.nowEpochMs();
    if (!Number.isFinite(epochMs)) {
      byId("actualTimeError").textContent = text("Tanggal atau waktu tidak valid.", "The date or time is invalid.");
      return;
    }
    byId("actualTimeSave").disabled = true;
    var metadata = {
      timeZone: safeTimeZone(byId("actualTimeZone").value),
      secondsEdited: byId("actualTimeEditSeconds").checked
    };
    var decision = selectedMode === "manual_user"
      ? window.MpmActualTime.setActualTime(epochMs, "manual_user", metadata)
      : window.MpmActualTime.confirmCurrent(selectedMode);
    decision.then(function (result) {
      if (result && result.accepted === false) {
        var minimum = Number(result.minimumEpochMs || window.MpmActualTime.nowEpochMs());
        byId("actualTimeError").textContent = text("Waktu ditolak. Nilai minimum: ", "Time rejected. Minimum: ") + formatActual(minimum, true);
        fillFields(minimum);
        return;
      }
      render();
      closeDialog();
    }).catch(function (error) {
      byId("actualTimeError").textContent = String(error.message || error);
    }).finally(function () {
      byId("actualTimeSave").disabled = false;
    });
  }

  function initialize() {
    if (!window.MpmActualTime || dialog) {
      return;
    }
    var host = document.createElement("div");
    host.className = "actual-time-root";
    host.innerHTML = markup();
    var authorityStatus=document.createElement('p');authorityStatus.id='actualTimeAuthorityStatus';authorityStatus.setAttribute('role','status');
    host.querySelector('#actualTimeExplanation').after(authorityStatus);
    if(window.MpmUiTranslations)window.MpmUiTranslations.markStatic(host);
    var launcherSlot = document.querySelector("[data-actual-time-launcher-slot]");
    if (launcherSlot) {
      host.dataset.placement = "inline";
      launcherSlot.appendChild(host);
    } else {
      host.dataset.placement = "floating";
      document.body.appendChild(host);
    }
    button = byId("actualTimeLauncher");
    dialog = byId("actualTimeDialog");
    button.addEventListener("click", function(){automaticDialog=false;openDialog();});
    byId("actualTimeForm").addEventListener("input",function(){automaticDialog=false;});
    byId("actualTimeClose").addEventListener("click", closeDialog);
    byId("actualTimeKeep").addEventListener("click", function () {
      byId("actualTimeKeep").disabled = true;
      var snapshot = window.MpmActualTime.snapshot();
      var keepDecision = snapshot.state && snapshot.state.online
        ? window.MpmActualTime.confirmCurrent(mode())
        : window.MpmActualTime.confirmOfflineCurrent(mode());
      keepDecision.then(function (result) {
        if (result && result.accepted === false) {
          byId("actualTimeError").textContent = text("Konfirmasi ditolak; masukkan waktu yang lebih baru.", "Confirmation rejected; enter a later time.");
          return;
        }
        render();
        closeDialog();
      }).catch(function (error) {
        byId("actualTimeError").textContent = String(error.message || error);
      }).finally(function () {
        byId("actualTimeKeep").disabled = false;
      });
    });
    byId("actualTimeForm").addEventListener("submit", submit);
    byId("actualTimeEditSeconds").addEventListener("change", updateModeFields);
    byId("actualTimeZone").addEventListener("change", function () { fillFields(window.MpmActualTime.nowEpochMs()); });
    document.querySelectorAll('input[name="actualTimeSource"]').forEach(function (radio) {
      radio.addEventListener("change", updateModeFields);
    });
    var calibrationDisplay = byId("actualTimeCalibrationDisplay");
    if (calibrationDisplay) {
      calibrationDisplay.addEventListener("change", function () {
        if (!window.MpmTimeCoordinateCalibration) {
          return;
        }
        window.MpmTimeCoordinateCalibration.configure({
          actualTimeDisplayMode: calibrationDisplay.value === "building-coordinate-calibrated"
            ? "building-coordinate-calibrated" : "isp"
        });
        render();
      });
    }
    dialog.addEventListener("cancel", function (event) {
      if ((window.MpmActualTime.snapshot().state || {}).mandatory) {
        event.preventDefault();
      }
    });
    ["mpm:actual-time-ready", "mpm:actual-time-status"].forEach(function (name) {
      window.addEventListener(name, function () {
        render();
        var timeState = window.MpmActualTime.snapshot().state || {};
        if(automaticDialog && !timeState.requiresConfirmation && !timeState.mandatory){closeDialog();automaticDialog=false;byId('actualTimeError').textContent='';}
        if (timeState.requiresConfirmation && (!autoOpened || timeState.mandatory)) {
          autoOpened = true;automaticDialog=true;
          openDialog();
        }
      });
    });
    window.addEventListener('mpm:language-changed',render);
    render();
    window.MpmActualTime.initialize().then(function () {
      render();
      var timeState = window.MpmActualTime.snapshot().state || {};
      if (timeState.requiresConfirmation && !autoOpened) {
        autoOpened = true;automaticDialog=true;
        openDialog();
      }
    });
    clockTimer = window.setInterval(function () { if (dialog.open) renderClock(); }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})(window, document);
