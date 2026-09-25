(function (window) {
  "use strict";

  var CACHE_KEY = "mpm:overlay-data-sources:islamic-calendar:v1";
  var MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  var catalog = [];
  var sourceState = { status: "not-loaded", retrievedAtUtc: null, error: null };
  var loading = null;
  var sourceUrl = "api/islamic-calendar-events.php";

  function readCache() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null");
      if (!parsed || !Array.isArray(parsed.events) || !parsed.savedAt) { return false; }
      if (Date.now() - new Date(parsed.savedAt).getTime() > MAX_CACHE_AGE_MS) { return false; }
      catalog = parsed.events;
      sourceState = { status: "cached", retrievedAtUtc: parsed.savedAt, error: null };
      return true;
    } catch (error) { return false; }
  }

  function writeCache(events) {
    var compact = events.slice(0, 500).map(function (event) {
      return { eventKey:event.eventKey,nameId:event.nameId,nameEn:event.nameEn,eventType:event.eventType,legalCategory:event.legalCategory,calendarRule:event.calendarRule||{},descriptionId:event.descriptionId,descriptionEn:event.descriptionEn,publicationStatus:event.publicationStatus,sources:(event.sources||[]).slice(0,3).map(function(source){return {title:source.title,url:source.url,citation:source.citation,verificationStatus:source.verificationStatus};}) };
    });
    try { window.localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt:new Date().toISOString(),events:compact })); } catch (error) {}
  }

  function load(force) {
    if (loading) { return loading; }
    if (!catalog.length) { readCache(); }
    if (!force && sourceState.status === "official-live") { return Promise.resolve(catalog); }
    loading = window.fetch(sourceUrl, { cache:"no-store",headers:{Accept:"application/json"} }).then(function(response){if(!response.ok){throw new Error("HTTP "+response.status);}return response.json();}).then(function(payload){
      if(!payload||payload.success!==true||!payload.data||!Array.isArray(payload.data.events)){throw new Error("Format kalender tidak valid");}
      catalog=payload.data.events;sourceState={status:"official-live",retrievedAtUtc:new Date().toISOString(),error:null};writeCache(catalog);window.dispatchEvent(new CustomEvent("mpm:overlay-data-updated",{detail:{source:"islamic-calendar",count:catalog.length}}));return catalog;
    }).catch(function(error){sourceState={status:catalog.length?"stale-cache":"unavailable",retrievedAtUtc:sourceState.retrievedAtUtc,error:error.message};return catalog;}).finally(function(){loading=null;});
    return loading;
  }

  function numbers(value){return Array.isArray(value)?value.map(Number):[];}
  function ruleMatches(rule,parts){
    if(!parts||!parts.month||!parts.day){return false;}var month=Number(parts.month),day=Number(parts.day),config=rule||{};
    if(numbers(config.suppress_in_hijri_months).indexOf(month)>=0||numbers(config.exclude_days).indexOf(day)>=0){return false;}
    if(Number(config.hijri_month||0)>0&&Number(config.hijri_month)!==month){return false;}
    if(Number(config.day||0)>0){return Number(config.day)===day;}
    if(numbers(config.days).length){return numbers(config.days).indexOf(day)>=0;}
    if(config.repeat==="monthly"&&numbers(config.hijri_days).length){return numbers(config.hijri_days).indexOf(day)>=0;}
    var start=Number(config.start_day||0),end=Number(config.end_day||0);return start>0&&end>=start&&day>=start&&day<=end;
  }

  function enrich(snapshot){var result=Object.assign({},snapshot||{});result.calendarEvents=catalog.filter(function(event){return ruleMatches(event.calendarRule,result.hijriParts);});result.overlayDataSources=Object.assign({},result.overlayDataSources||{},{islamicCalendar:Object.assign({},sourceState,{count:result.calendarEvents.length})});if(!catalog.length&&!loading){load(false);}return result;}

  function configure(rows){var source=(rows||[]).find(function(row){return row.sourceKey==="islamic-calendar"&&row.isEnabled!==false&&["manual","verified"].indexOf(row.verificationStatus)>=0;});if(!source||!source.sourceUrl){return;}try{var resolved=new URL(source.sourceUrl,window.location.href);if(resolved.origin===window.location.origin||resolved.protocol==="https:"){sourceUrl=resolved.href;}}catch(error){}}

  readCache();
  window.OverlayDataSources={load:load,enrich:enrich,configure:configure,status:function(){return Object.assign({},sourceState);}};
})(window);
