(function (window) {
  "use strict";

  function actualNowEpochMs() {
    return window.MpmActualTime && typeof window.MpmActualTime.nowEpochMs === "function"
      ? window.MpmActualTime.nowEpochMs()
      : Date.now();
  }

  function language(snapshot) {
    var query = new URLSearchParams(window.location.search).get("lang");
    if (query === "id" || query === "en") {
      return query;
    }
    return snapshot && snapshot.language === "en" ? "en" : "id";
  }

  function contentFor(definition, lang) {
    var enabled = (definition.contents || []).filter(function (row) { return row.isEnabled; });
    return enabled.find(function (row) { return row.languageCode === lang && row.contentKey === "main"; })
      || enabled.find(function (row) { return row.languageCode === lang; })
      || enabled[0]
      || {};
  }

  function replace(value, context) {
    return String(value || "").replace(/\{([A-Za-z0-9_]+)\}/g, function (_, key) {
      return context[key] === undefined || context[key] === null ? "" : String(context[key]);
    }).trim();
  }

  function normalized(value) {
    return String(value || "").trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function valueAtPath(source, path) {
    return String(path || "").split(".").filter(Boolean).reduce(function (value, key) {
      return value && typeof value === "object" ? value[key] : undefined;
    }, source);
  }

  function conditionMatches(trigger, snapshot) {
    var config = trigger.config || {};
    var path = config.conditionPath || config.path || "";
    var actual = path ? valueAtPath(snapshot, path) : undefined;
    var expected = config.conditionValue === undefined ? config.value : config.conditionValue;
    var operator = config.conditionOperator || config.operator || "truthy";
    if (operator === "truthy") { return Boolean(actual); }
    if (operator === "falsy") { return !actual; }
    if (operator === "equals") { return normalized(actual) === normalized(expected); }
    if (operator === "not_equals") { return normalized(actual) !== normalized(expected); }
    if (operator === "contains") { return normalized(actual).indexOf(normalized(expected)) >= 0; }
    if (operator === "greater_than") { return Number(actual) > Number(expected); }
    if (operator === "less_than") { return Number(actual) < Number(expected); }
    return false;
  }

  function recurringRangeMatches(month, day, startMonth, startDay, endMonth, endDay) {
    var value = Number(month) * 100 + Number(day);
    var start = Number(startMonth) * 100 + Number(startDay);
    var end = Number(endMonth) * 100 + Number(endDay);
    if (![value, start, end].every(Number.isFinite) || startMonth < 1 || endMonth < 1) { return false; }
    return start <= end ? value >= start && value <= end : value >= start || value <= end;
  }

  function distanceMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
    var rad=Math.PI/180;var phi1=latitudeA*rad;var phi2=latitudeB*rad;var deltaPhi=(latitudeB-latitudeA)*rad;var deltaLambda=(longitudeB-longitudeA)*rad;
    var a=Math.sin(deltaPhi/2)*Math.sin(deltaPhi/2)+Math.cos(phi1)*Math.cos(phi2)*Math.sin(deltaLambda/2)*Math.sin(deltaLambda/2);
    return 6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  function scopeMatches(definition, snapshot, context) {
    var scopes=(definition.scopes||[]).filter(function(scope){return scope.isEnabled;});
    if(!scopes.length){return true;}
    var location=(snapshot&&snapshot.location)||{};var mosque=(snapshot&&snapshot.mosque)||{};var binding=context||{};
    function matches(scope){
      if(scope.scopeType==="GLOBAL"){return true;}
      if(["PAGE","PRAYER","PRAYER_GROUP","PHASE","DATE_EVENT"].indexOf(scope.scopeType)>=0&&binding.deferContextual===true){return true;}
      if(scope.scopeType==="PAGE"){return normalized(scope.pageKey)===normalized(binding.pageKey||snapshot&&snapshot.pageKey||"index");}
      if(scope.scopeType==="PRAYER"){return normalized(scope.prayerKey)===normalized(binding.prayerKey||snapshot&&snapshot.currentPrayerKey);}
      if(scope.scopeType==="PRAYER_GROUP"){
        var prayer=normalized(binding.prayerKey||snapshot&&snapshot.currentPrayerKey),group=normalized(binding.prayerGroup||"");
        if(!group){group=["subuh","dhuhur","ashar","maghrib","isha","jumat"].indexOf(prayer)>=0?"fardhu":["dhuhaawwal","dhuhawoosthaa","dhuhaawwabin","qiyamullail"].indexOf(prayer)>=0?"sunnah":"";}
        return normalized(scope.prayerGroup)===group;
      }
      if(scope.scopeType==="PHASE"){return normalized(scope.phaseKey)===normalized(binding.phaseKey||snapshot&&snapshot.currentPrayerPhase);}
      if(scope.scopeType==="DATE_EVENT"){
        var eventKey=binding.eventKey||"";if(eventKey){return normalized(scope.eventKey)===normalized(eventKey);}
        return ((snapshot&&snapshot.calendarEvents)||[]).some(function(event){return normalized(event.eventKey)===normalized(scope.eventKey);});
      }
      var countryCode=String(location.countryIso2||location.countryCode||"").toUpperCase();
      var countryOk=(!scope.countryIso2||scope.countryIso2===countryCode)&&(!scope.countryName||normalized(scope.countryName)===normalized(location.country));
      if(scope.scopeType==="COUNTRY"){return countryOk;}
      var adm1Ok=(!scope.adm1Code||normalized(scope.adm1Code)===normalized(location.adm1Code||location.provinceCode))&&(!scope.adm1Name||normalized(scope.adm1Name)===normalized(location.adm1||location.province));
      if(scope.scopeType==="ADM1"){return countryOk&&adm1Ok;}
      var adm2Ok=(!scope.adm2Code||normalized(scope.adm2Code)===normalized(location.adm2Code||location.cityCode))&&(!scope.adm2Name||normalized(scope.adm2Name)===normalized(location.adm2||location.city));
      if(scope.scopeType==="ADM2"){return countryOk&&adm1Ok&&adm2Ok;}
      if(scope.scopeType==="LOCATION"){return Number(scope.locationId)>0&&Number(scope.locationId)===Number(location.id||location.locationId);}
      if(scope.scopeType==="BUILDING"){return Number(scope.buildingId)>0&&Number(scope.buildingId)===Number(mosque.buildingId||location.buildingId);}
      if(scope.scopeType==="GEOFENCE"){
        var latitude=Number(location.latitude),longitude=Number(location.longitude);
        return Number.isFinite(latitude)&&Number.isFinite(longitude)&&distanceMeters(latitude,longitude,Number(scope.latitude),Number(scope.longitude))<=Number(scope.radiusMeters);
      }
      return false;
    }
    var excluded=scopes.filter(function(scope){return scope.scopeEffect==="exclude";}).some(matches);
    if(excluded){return false;}
    var included=scopes.filter(function(scope){return scope.scopeEffect!=="exclude";});
    if(!included.length){return true;}
    var groups={};included.forEach(function(scope){var key=["COUNTRY","ADM1","ADM2","GEOFENCE","LOCATION","BUILDING"].indexOf(scope.scopeType)>=0?"GEOGRAPHY":scope.scopeType;(groups[key]=groups[key]||[]).push(scope);});
    return Object.keys(groups).every(function(key){return groups[key].some(matches);});
  }

  function prayerDate(snapshot, now, prayerKey, offsetSeconds) {
    var source = snapshot && snapshot.activeSource;
    var minutes = source && source.times ? window.PrayerTimeUtils.parseTimeToMinutes(source.times[prayerKey]) : null;
    if (minutes === null) {
      return null;
    }
    var result = window.OverlayTimeService.timeOnDay(now, minutes, snapshot, 0);
    return result ? new Date(result.getTime() + Number(offsetSeconds || 0) * 1000) : null;
  }

  function triggerWindow(trigger, definition, snapshot, now) {
    var duration = Math.max(1, Number(trigger.durationSeconds || definition.defaultDurationSeconds || 30)) * 1000;
    var start = null;
    var end = null;
    var parts = window.OverlayTimeService.dateParts(now, snapshot);
    if (trigger.triggerType === "absolute_datetime") {
      start = Date.parse(String(trigger.startsAtUtc || ""));
      end = trigger.endsAtUtc ? Date.parse(trigger.endsAtUtc) : start + duration;
    } else if (trigger.triggerType === "permanent") {
      start = trigger.startsAtUtc ? Date.parse(trigger.startsAtUtc) : 0;
      end = trigger.endsAtUtc ? Date.parse(trigger.endsAtUtc) : 8640000000000000;
    } else if (trigger.triggerType === "daily_time" || trigger.triggerType === "weekday") {
      var weekdays=(trigger.config&&trigger.config.weekdays)||[];
      if(trigger.triggerType==="weekday"&&weekdays.length&&weekdays.indexOf(now.getDay())<0){return null;}
      var daily = window.OverlayTimeService.localTimeDate(now, trigger.localTime, snapshot, 0);
      start = daily ? daily.getTime() : null;
      end = start === null ? null : start + duration;
    } else if (trigger.triggerType === "repeat_interval") {
      var interval=Math.max(1,Number(trigger.config&&trigger.config.repeatMinutes||1))*60000;
      var origin=trigger.startsAtUtc?Date.parse(trigger.startsAtUtc):window.OverlayTimeService.localTimeDate(now,trigger.localTime||"00:00:00",snapshot,0).getTime();
      if(Number.isFinite(origin)&&now.getTime()>=origin){start=origin+Math.floor((now.getTime()-origin)/interval)*interval;end=start+duration;}
    } else if (["prayer_time", "before_prayer", "after_prayer"].indexOf(trigger.triggerType) >= 0) {
      var anchored = prayerDate(snapshot, now, trigger.prayerKey, trigger.offsetSeconds);
      start = anchored ? anchored.getTime() : null;
      end = start === null ? null : start + duration;
    } else if (trigger.triggerType === "date_range") {
      start=trigger.startsAtUtc?Date.parse(trigger.startsAtUtc):null;end=trigger.endsAtUtc?Date.parse(trigger.endsAtUtc):null;
    } else if (trigger.triggerType === "gregorian_range") {
      var gregorianConfig=trigger.config||{};
      if(recurringRangeMatches(parts.month,parts.day,trigger.gregorianMonth,trigger.gregorianDay,gregorianConfig.endMonth,gregorianConfig.endDay)){
        start=window.OverlayTimeService.localTimeDate(now,trigger.localTime||"00:00:00",snapshot,0).getTime();
        end=start+duration;
      }
    } else if (trigger.triggerType === "hijri_range") {
      var rangeHijri=window.OverlayTimeService.hijriParts(now,snapshot);var hijriConfig=trigger.config||{};
      if(recurringRangeMatches(rangeHijri.month,rangeHijri.day,trigger.hijriMonth,trigger.hijriDay,hijriConfig.endMonth,hijriConfig.endDay)){
        start=window.OverlayTimeService.localTimeDate(now,trigger.localTime||"00:00:00",snapshot,0).getTime();
        end=start+duration;
      }
    } else if (["prayer_phase","relative_phase"].indexOf(trigger.triggerType)>=0) {
      var phaseKey=trigger.config&&trigger.config.phaseKey;var phase=(snapshot&&snapshot.prayerPhases||[]).find(function(item){return item.key===phaseKey;});
      start=phase?Date.parse(phase.startsAt)+Number(trigger.offsetSeconds||0)*1000:null;end=phase&&phase.endsAt?Date.parse(phase.endsAt):start===null?null:start+duration;
    } else if (trigger.triggerType === "gregorian_date") {
      if (Number(trigger.gregorianMonth) === parts.month && Number(trigger.gregorianDay) === parts.day) {
        var gregorian = window.OverlayTimeService.localTimeDate(now, trigger.localTime || "00:00:00", snapshot, 0);
        start = gregorian ? gregorian.getTime() : null;
        end = start === null ? null : start + duration;
      }
    } else if (trigger.triggerType === "hijri_date") {
      var hijri = window.OverlayTimeService.hijriParts(now, snapshot);
      var yearMatches = !trigger.hijriYear || Number(trigger.hijriYear) === hijri.year;
      if (yearMatches && Number(trigger.hijriMonth) === hijri.month && Number(trigger.hijriDay) === hijri.day) {
        var hijriDate = window.OverlayTimeService.localTimeDate(now, trigger.localTime || "00:00:00", snapshot, 0);
        start = hijriDate ? hijriDate.getTime() : null;
        end = start === null ? null : start + duration;
      }
    } else if (trigger.triggerType === "calendar_event") {
      var calendarKey=(trigger.config&&trigger.config.eventKey)||trigger.astronomicalEvent||"";
      var calendarEvent=((snapshot&&snapshot.calendarEvents)||[]).find(function(item){return item&&(!calendarKey||normalized(item.eventKey)===normalized(calendarKey));});
      if(calendarEvent){var eventStart=window.OverlayTimeService.localTimeDate(now,trigger.localTime||"00:00:00",snapshot,0);start=eventStart?eventStart.getTime():null;end=start===null?null:start+(trigger.localTime?duration:86400000);}
    } else if (trigger.triggerType === "astronomical_event") {
      var events = (snapshot && snapshot.astronomicalEvents) || [];
      var event = events.find(function (item) { return item.key === trigger.astronomicalEvent; });
      start = event ? Date.parse(event.startsAt) + Number(trigger.offsetSeconds || 0) * 1000 : null;
      end = start === null ? null : start + duration;
    } else if (trigger.triggerType === "condition" || trigger.triggerType === "weather_event") {
      var conditionTrigger=trigger;
      if(trigger.triggerType==="weather_event"&&!trigger.config.conditionPath){conditionTrigger=Object.assign({},trigger,{config:Object.assign({},trigger.config||{},{conditionPath:"weather.status",conditionOperator:"equals",conditionValue:(trigger.config&&trigger.config.eventKey)||trigger.astronomicalEvent||"rain"})});}
      if(conditionMatches(conditionTrigger,snapshot)){
        start=trigger.startsAtUtc?Date.parse(trigger.startsAtUtc):0;
        end=trigger.endsAtUtc?Date.parse(trigger.endsAtUtc):8640000000000000;
      }
    } else if (trigger.triggerType === "external_api") {
      var externalKey=(trigger.config&&trigger.config.eventKey)||trigger.astronomicalEvent;
      var external=((snapshot&&snapshot.externalEvents)||[]).find(function(item){return item&&item.verified===true&&(!externalKey||item.key===externalKey);});
      if(external){start=external.startsAt?Date.parse(external.startsAt):0;end=external.endsAt?Date.parse(external.endsAt):8640000000000000;}
    }
    return Number.isFinite(start) && Number.isFinite(end) ? { start: start, end: end } : null;
  }

  function genericCandidates(snapshot, config, now, lang, diagnostics) {
    var nowMs = now.getTime();
    var result = [];
    (config.definitions || []).forEach(function (definition) {
      if (!definition.isEnabled) { if(diagnostics){diagnostics.push({overlayKey:definition.overlayKey,status:"suppressed",reason:"definition-disabled"});} return; }
      if (!scopeMatches(definition, snapshot, {deferContextual:true})) { if(diagnostics){diagnostics.push({overlayKey:definition.overlayKey,status:"suppressed",reason:"scope-mismatch"});} return; }
      if (definition.overlayKey === "fardhu-sequence" || definition.overlayKey === "friday-prayer" || definition.overlayKey === "qiyamul-lail" || definition.overlayKey === "dhuha-phases") {
        return;
      }
      var matched=false;
      (definition.triggers || []).forEach(function (trigger) {
        if (!trigger.isEnabled || ["manual", "emergency"].indexOf(trigger.triggerType) >= 0) {
          return;
        }
        var windowRange = triggerWindow(trigger, definition, snapshot, now);
        if (!windowRange || nowMs < windowRange.start || nowMs >= windowRange.end) {
          if(diagnostics){diagnostics.push({overlayKey:definition.overlayKey,triggerKey:trigger.triggerKey,status:"inactive",reason:windowRange?"outside-trigger-window":"trigger-unresolved"});}
          return;
        }
        var triggerContext={pageKey:snapshot&&snapshot.pageKey||"index",prayerKey:trigger.prayerKey||null,phaseKey:trigger.config&&trigger.config.phaseKey||null,eventKey:trigger.config&&trigger.config.eventKey||trigger.astronomicalEvent||null};
        if(!scopeMatches(definition,snapshot,triggerContext)){if(diagnostics){diagnostics.push({overlayKey:definition.overlayKey,triggerKey:trigger.triggerKey,status:"suppressed",reason:"context-scope-mismatch"});}return;}
        matched=true;
        result.push(fromDefinition(definition, contentFor(definition, lang), lang, windowRange.start, windowRange.end, {
          triggerKey: trigger.triggerKey,
          sourceName: snapshot && snapshot.activeSource ? snapshot.activeSource.name : "",
          triggerType: trigger.triggerType,
          triggerReason: trigger.triggerType,
          nowMs: nowMs
        }));
      });
      if(diagnostics&&matched){diagnostics.push({overlayKey:definition.overlayKey,status:"candidate",reason:"trigger-matched"});}
    });
    return result;
  }

  function commandCandidates(snapshot, config, now, lang) {
    var definitions = (config.definitions || []).reduce(function (map, item) { map[item.overlayKey] = item; return map; }, {});
    var nowMs = now.getTime();
    return (config.runtimeCommands || []).map(function (command) {
      var definition = definitions[command.overlayKey];
      var start = Date.parse(command.startsAtUtc);
      var end = Date.parse(command.endsAtUtc);
      if (!definition || !definition.isEnabled || !scopeMatches(definition, snapshot, Object.assign({pageKey:snapshot&&snapshot.pageKey||"index"},command.payload||{})) || !Number.isFinite(start) || !Number.isFinite(end) || nowMs < start || nowMs >= end) {
        return null;
      }
      var content = Object.assign({}, contentFor(definition, lang), command.payload && command.payload.content ? command.payload.content : {});
      return fromDefinition(definition, content, lang, start, end, Object.assign({}, command.payload || {}, {
        commandKey: command.commandKey,
        commandType: command.commandType,
        triggerReason: "manual-command",
        nowMs: nowMs
      }));
    }).filter(Boolean);
  }

  function fromDefinition(definition, content, lang, start, end, context) {
    var values = Object.assign({
      overlayName: lang === "en" ? definition.nameEn : definition.nameId,
      countdown: window.PrayerTimeUtils.formatSeconds((end - Number(context&&context.nowMs||actualNowEpochMs())) / 1000)
    }, context || {});
    return {
      candidateKey: "generic:" + definition.overlayKey + ":" + start + ":" + (values.commandKey || values.triggerKey || "default"),
      overlayKey: definition.overlayKey,
      overlayType: definition.overlayType,
      priority: definition.priority,
      interruptionPolicy: definition.interruptionPolicy,
      conflictMode: definition.conflictMode || "replace",
      isInterruptible: definition.isInterruptible !== false,
      layerKey: definition.layerKey || "main",
      layerOrder: Number(definition.layerOrder || 100),
      animation: definition.animation,
      settings: definition.settings || {},
      startsAt: start,
      endsAt: end,
      targetAt: end,
      language: lang,
      backgroundPath: definition.backgroundPath,
      backgroundMedia: definition.backgroundMedia || null,
      content: {
        eyebrow: replace(content.eyebrow, values),
        title: replace(content.title || values.overlayName, values),
        subtitle: replace(content.subtitle, values),
        bodyText: replace(content.bodyText, values),
        additionalText: replace(content.additionalText, values),
        textAlign: content.textAlign,
        fontFamily: content.fontFamily,
        titleSizeClamp: content.titleSizeClamp,
        bodySizeClamp: content.bodySizeClamp
      },
      layout: (definition.layouts || [])[0] || {},
      sequenceItems: (definition.sequenceItems || []).filter(function (item) { return item.isEnabled; }),
      widgets: (definition.widgets || []).filter(function (item) { return item.isEnabled; }),
      metadata: values
    };
  }

  function candidates(snapshot, config, now, diagnostics) {
    var lang = language(snapshot);
    var values = [];
    var prayer = window.PrayerOverlayController.candidate(snapshot, config, now, lang);
    var friday = window.FridayOverlayController.candidate(snapshot, config, now, lang);
    var qiyamul = window.QiyamulOverlayController.candidate(snapshot, config, now, lang);
    var dhuha = window.DhuhaOverlayController.candidate(snapshot, config, now, lang);
    if (prayer) { values.push(prayer); }
    if (friday) { values.push(friday); }
    if (qiyamul) { values.push(qiyamul); }
    if (dhuha) { values.push(dhuha); }
    if (window.FuneralOverlayController && typeof window.FuneralOverlayController.candidates === "function") {
      values = values.concat(window.FuneralOverlayController.candidates(snapshot, config, now, lang));
    }
    if (window.WorshipEducationOverlayController && typeof window.WorshipEducationOverlayController.candidate === "function") {
      var education = window.WorshipEducationOverlayController.candidate(snapshot, config, now, lang);
      if (education) { values.push(education); }
    }
    return values.concat(genericCandidates(snapshot, config, now, lang, diagnostics), commandCandidates(snapshot, config, now, lang))
      .sort(function (a, b) { return b.priority - a.priority || a.startsAt - b.startsAt; });
  }

  function evaluate(snapshot, config, now) {
    var diagnostics=[];var items=candidates(snapshot,config,now,diagnostics);
    items.forEach(function(item){diagnostics.push({overlayKey:item.overlayKey,candidateKey:item.candidateKey,status:"active-candidate",reason:item.metadata&&item.metadata.triggerReason||item.metadata&&item.metadata.stateKey||"runtime-controller",priority:item.priority,layerKey:item.layerKey||"main",startsAt:item.startsAt,endsAt:item.endsAt});});
    return {candidates:items,diagnostics:diagnostics,at:now.toISOString()};
  }

  window.OverlayTriggerEngine = {
    candidates: candidates,
    evaluate: evaluate,
    language: language,
    fromDefinition: fromDefinition,
    scopeMatches: scopeMatches
  };
})(window);
