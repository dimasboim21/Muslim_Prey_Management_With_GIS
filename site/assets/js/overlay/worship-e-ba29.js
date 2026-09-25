(function (window) {
  "use strict";

  var DEFAULT_BACKGROUND = "assets/images/bg/main-bg.png";
  var PLAYBACK_KEY = "mpm:worship-education-playlist:v2";
  var OFFLINE_DB_NAME = "mpm-islamic-text-offline-v2";
  var OFFLINE_STORE_NAME = "responses";
  if (window.indexedDB) {
    try { window.indexedDB.deleteDatabase("mpm-islamic-text-offline-v1"); } catch (error) {}
  }
  var OFFLINE_SNAPSHOT_KEY = "worship-education/public-snapshot/v1";
  var data = { settings: { isEnabled: false }, slides: [] };
  var playback = { settingsVersion: null, cursorMs: 0, lastAtMs: null, lastSavedAtMs: 0 };
  var started = false, pollTimer = null, reloadThrottle = 0;
  var transport = "uninitialized", cacheSavedAt = null, lastLoadError = "";
  var retiredSalatSections = ["syarat_sholat","rukun_sholat","praktik_sholat","tata_cara","bacaan_sholat","adzan_iqamah","sholat_fardhu","sholat_sunnah","sholat_jenazah"];
  var retiredSalatSlideKeys = ["islam-intro","islam-sholat"];
  var sectionLabels = {
    rukun_iman: { id: "Rukun Iman", en: "Pillars of Faith" },
    rukun_islam: { id: "Rukun Islam", en: "Pillars of Islam" },
    wudhu: { id: "Wudhu", en: "Ablution" },
    tayammum: { id: "Tayammum", en: "Dry Ablution" },
    puasa: { id: "Puasa", en: "Fasting" },
    zakat: { id: "Zakat", en: "Zakat" },
    haji: { id: "Haji", en: "Hajj" },
    doa_dzikir: { id: "Doa dan Dzikir", en: "Supplications and Dhikr" },
    materi_lain: { id: "Materi Ibadah Lain", en: "Other Worship Material" }
  };
  var phaseLabels = {
    main: { id: "Waktu umum", en: "General time" },
    subuh: { id: "Waktu Subuh hingga Syuruq", en: "Fajr until sunrise" },
    syuruq: { id: "Syuruq / matahari terbit", en: "Sunrise period" },
    dhuha: { id: "Waktu Dhuha", en: "Duha period" },
    istiwa: { id: "Istiwa / transit matahari", en: "Solar transit" },
    zuhur: { id: "Waktu Dhuhur", en: "Dhuhr period" },
    ashar: { id: "Waktu Ashar", en: "Asr period" },
    "late-ashar": { id: "Akhir waktu Ashar", en: "Late Asr" },
    sunset: { id: "Ghurub / matahari terbenam", en: "Sunset" },
    maghrib: { id: "Waktu Maghrib · senja menuju batas Isya", en: "Maghrib · twilight towards Isha" },
    isya: { id: "Waktu Isya · syafaq menurut sumber falak telah hilang", en: "Isha · twilight boundary has passed" },
    "night-first-third": { id: "Sepertiga malam pertama", en: "First third of the night" },
    midnight: { id: "Pertengahan malam", en: "Islamic night midpoint" },
    "last-third-night": { id: "Sepertiga malam terakhir · sebelum fajar", en: "Last third of the night · before dawn" }
  };
  var currentPrayerLabels = {
    subuh:{id:"Masih dalam waktu Subuh",en:"Fajr time is active"},syuruq:{id:"Masa Syuruq / menuju Isyraq",en:"Sunrise / approaching Ishraq"},dhuha:{id:"Masih dalam waktu Dhuha",en:"Duha time is active"},istiwa:{id:"Masa Istiwa / menuju Dhuhur",en:"Solar transit / approaching Dhuhr"},zuhur:{id:"Masih dalam waktu Dhuhur",en:"Dhuhr time is active"},ashar:{id:"Masih dalam waktu Ashar",en:"Asr time is active"},"late-ashar":{id:"Masih dalam akhir waktu Ashar",en:"Late Asr time is active"},sunset:{id:"Masa Ghurub / menuju Maghrib",en:"Sunset / approaching Maghrib"},maghrib:{id:"Masih dalam waktu Maghrib",en:"Maghrib time is active"},isya:{id:"Masih dalam waktu Isya",en:"Isha time is active"},"night-first-third":{id:"Masih dalam rentang waktu Isya",en:"Isha time range remains"},midnight:{id:"Masih dalam rentang waktu Isya",en:"Isha time range remains"},"last-third-night":{id:"Rentang Isya · waktu utama Qiyamul",en:"Isha range · prime Qiyamul time"},main:{id:"Di luar penanda waktu sholat khusus",en:"Outside a specific prayer marker"}
  };
  phaseLabels["night-first-third"]={id:"Qiyamul Lail · sepertiga malam pertama",en:"Qiyamul Lail · first third of the night"};
  phaseLabels.midnight={id:"Qiyamul Lail · pertengahan malam",en:"Qiyamul Lail · Islamic night midpoint"};
  phaseLabels["last-third-night"]={id:"Qiyamul Lail · sepertiga malam terakhir",en:"Qiyamul Lail · last third of the night"};

  function canonicalIndonesianTerminology(text) {
    return String(text == null ? "" : text).replace(/\b(?:sholat|shalat|solat)\b/gi,function(word){return word.charAt(0)===word.charAt(0).toUpperCase()?"Salat":"salat";});
  }
  function localizedText(idText,enText,language) {
    var text=language==="en"?(enText||idText||""):(idText||enText||"");
    return language==="en"?String(text):canonicalIndonesianTerminology(text);
  }

  function notify() { window.dispatchEvent(new CustomEvent("mpm:worship-education-updated", { detail: { generatedAtUtc: data.generatedAtUtc || null, transport: transport, cachedAt: cacheSavedAt } })); }
  function loadPlayback() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(PLAYBACK_KEY) || "null");
      if (stored && Number(stored.settingsVersion) === Number(data.settings && data.settings.version) && Number.isFinite(Number(stored.cursorMs))) {
        playback.settingsVersion = Number(stored.settingsVersion); playback.cursorMs = Math.max(0, Number(stored.cursorMs)); playback.lastAtMs = null;
        return;
      }
    } catch (error) {}
    playback = { settingsVersion: Number(data.settings && data.settings.version || 0), cursorMs: 0, lastAtMs: null, lastSavedAtMs: 0 };
  }
  function savePlayback(nowMs) {
    if (nowMs - Number(playback.lastSavedAtMs || 0) < 5000) { return; }
    playback.lastSavedAtMs = nowMs;
    try { window.localStorage.setItem(PLAYBACK_KEY, JSON.stringify({ settingsVersion: playback.settingsVersion, cursorMs: Math.round(playback.cursorMs) })); } catch (error) {}
  }
  function openOfflineDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("IndexedDB unavailable.")); return; }
      var request = window.indexedDB.open(OFFLINE_DB_NAME, 1);
      request.onupgradeneeded = function () {
        if (!request.result.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
          request.result.createObjectStore(OFFLINE_STORE_NAME, { keyPath: "key" });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("Offline database unavailable.")); };
    });
  }
  function writeOfflineSnapshot(snapshot) {
    var savedAt = new Date().toISOString();
    return openOfflineDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(OFFLINE_STORE_NAME, "readwrite");
        transaction.objectStore(OFFLINE_STORE_NAME).put({ key: OFFLINE_SNAPSHOT_KEY, savedAt: savedAt, data: snapshot });
        transaction.oncomplete = function () { db.close(); resolve(savedAt); };
        transaction.onerror = function () { var error = transaction.error; db.close(); reject(error || new Error("Offline snapshot could not be saved.")); };
        transaction.onabort = transaction.onerror;
      });
    });
  }
  function readOfflineSnapshot() {
    return openOfflineDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(OFFLINE_STORE_NAME, "readonly"), request = transaction.objectStore(OFFLINE_STORE_NAME).get(OFFLINE_SNAPSHOT_KEY);
        request.onsuccess = function () { var row = request.result || null; db.close(); resolve(row); };
        request.onerror = function () { var error = request.error; db.close(); reject(error || new Error("Offline snapshot could not be read.")); };
      });
    });
  }
  function sanitizeSnapshot(snapshot) {
    var cleanSections=function(items){return (Array.isArray(items)?items:[]).filter(function(key){return retiredSalatSections.indexOf(String(key))<0&&Object.prototype.hasOwnProperty.call(sectionLabels,String(key));});};
    var cleanSlides=snapshot.slides.filter(function(slide){return retiredSalatSections.indexOf(String(slide&&slide.sectionKey||""))<0&&retiredSalatSlideKeys.indexOf(String(slide&&slide.slideKey||""))<0;});
    var settings=Object.assign({},snapshot.settings||{}),durations=Object.assign({},settings.sectionSlideSeconds||{});
    retiredSalatSections.forEach(function(key){delete durations[key];});
    settings.enabledSections=cleanSections(settings.enabledSections);
    settings.sectionOrder=cleanSections(settings.sectionOrder);
    settings.sectionSlideSeconds=durations;
    return Object.assign({},snapshot,{settings:settings,sections:(Array.isArray(snapshot.sections)?snapshot.sections:[]).filter(function(section){return retiredSalatSections.indexOf(String(section&&section.sectionKey||""))<0;}),slides:cleanSlides});
  }
  function applySnapshot(snapshot, source, savedAt, loadError) {
    if (!snapshot || !snapshot.settings || !Array.isArray(snapshot.slides)) { throw new Error("Worship education snapshot is invalid."); }
    var previousVersion = Number(data.settings && data.settings.version || -1);
    data = sanitizeSnapshot(snapshot);
    transport = source;
    cacheSavedAt = savedAt || null;
    lastLoadError = loadError ? String(loadError.message || loadError) : "";
    if (previousVersion !== Number(data.settings && data.settings.version || 0) || playback.settingsVersion === null) { loadPlayback(); }
    notify();
    return data;
  }
  function load() {
    return window.fetch("api/worship-education.php", { cache: "no-store", headers: { Accept: "application/json" } }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok || !payload || payload.success !== true || !payload.data) { throw new Error(payload && payload.error || "Worship education data unavailable."); }
        return payload.data;
      });
    }).then(function (snapshot) {
      var sanitized=sanitizeSnapshot(snapshot);
      return writeOfflineSnapshot(sanitized).then(function (savedAt) {
        return applySnapshot(sanitized, "local-database", savedAt, null);
      }, function () {
        return applySnapshot(sanitized, "local-database", null, null);
      });
    }).catch(function (networkError) {
      return readOfflineSnapshot().then(function (cached) {
        if (!cached || !cached.data) { throw networkError; }
        return applySnapshot(cached.data, "local-cache", cached.savedAt || null, networkError);
      }, function () { throw networkError; });
    });
  }
  function fallback() { if (!pollTimer) { pollTimer = window.setInterval(function () { if (!document.hidden) { load().catch(function () {}); } }, 30000); } }
  function start() {
    if (started) { return; } started = true; load().catch(function () {}); fallback();
    window.addEventListener("mpm:funeral-data-updated", function () { var now = Date.now(); if (now - reloadThrottle < 1000) { return; } reloadThrottle = now; load().catch(function () {}); });
  }
  function activePrayerPeriod(snapshot, config, now, lang) {
    var prayer = window.PrayerOverlayController && window.PrayerOverlayController.candidate ? window.PrayerOverlayController.candidate(snapshot, config, now, lang) : null;
    var friday = window.FridayOverlayController && window.FridayOverlayController.candidate ? window.FridayOverlayController.candidate(snapshot, config, now, lang) : null;
    var qiyamul = window.QiyamulOverlayController && window.QiyamulOverlayController.candidate ? window.QiyamulOverlayController.candidate(snapshot, config, now, lang) : null;
    var dhuha = window.DhuhaOverlayController && window.DhuhaOverlayController.candidate ? window.DhuhaOverlayController.candidate(snapshot, config, now, lang) : null;
    if (prayer || friday || qiyamul || dhuha) { return true; }
    if (window.FuneralOverlayController && typeof window.FuneralOverlayController.scheduleContext === "function") {
      var context = window.FuneralOverlayController.scheduleContext(snapshot, config, now, lang, { prayerRules: {} });
      if (context && ["qiyamul_lail", "syuruq", "dhuha_awwal", "dhuha_wustha", "dhuha_awwabin"].indexOf(context.phaseKey) >= 0) { return true; }
    }
    return false;
  }
  function advancePlayback(now, paused) {
    var nowMs = now.getTime(), version = Number(data.settings && data.settings.version || 0);
    if (playback.settingsVersion !== version) { playback = { settingsVersion: version, cursorMs: 0, lastAtMs: nowMs, lastSavedAtMs: 0 }; }
    if (playback.lastAtMs === null || nowMs < playback.lastAtMs || nowMs - playback.lastAtMs > 300000) { playback.lastAtMs = nowMs; savePlayback(nowMs); return playback.cursorMs; }
    if (!paused) { playback.cursorMs += Math.max(0, nowMs - playback.lastAtMs); }
    playback.lastAtMs = nowMs; savePlayback(nowMs); return playback.cursorMs;
  }
  function playlist(settings) {
    var enabled = Array.isArray(settings.enabledSections) ? settings.enabledSections : Object.keys(sectionLabels);
    var order = Array.isArray(settings.sectionOrder) ? settings.sectionOrder : Object.keys(sectionLabels);
    var seen = {}, segments = [], total = 0;
    order.concat(enabled).forEach(function (sectionKey) {
      if (seen[sectionKey] || enabled.indexOf(sectionKey) < 0) { return; } seen[sectionKey] = true;
      var slides = data.slides.filter(function (slide) { return slide.isEnabled !== false && slide.sectionKey === sectionKey; });
      if (!slides.length) { return; }
      var seconds = Math.max(10, Number(settings.sectionSlideSeconds && settings.sectionSlideSeconds[sectionKey] || settings.displayDurationSeconds || 45));
      var renderItems=[];slides.forEach(function(slide,logicalIndex){renderPages(slide).forEach(function(page,pageIndex){renderItems.push({slide:slide,page:page,pageIndex:pageIndex,logicalIndex:logicalIndex});});});
      var duration = renderItems.length * seconds * 1000;
      segments.push({ type: "section", sectionKey: sectionKey, slides: slides, renderItems:renderItems, slideDurationMs: seconds * 1000, start: total, end: total + duration }); total += duration;
      var gap = Math.max(10, Number(settings.categoryGapSeconds || 60)) * 1000;
      segments.push({ type: "category_gap", start: total, end: total + gap }); total += gap;
    });
    if (segments.length) { var rest = Math.max(60, Number(settings.intervalSeconds || 600)) * 1000; segments.push({ type: "cycle_rest", start: total, end: total + rest }); total += rest; }
    return { segments: segments, totalMs: total };
  }
  var SOURCE_TYPES=["quran","tafsir","hadith","ijma","qiyas","other"];
  var DEFAULT_BLOCK_OPTIONS={showIntro:true,showArabic:true,showArabicLabel:false,showTransliteration:true,showTransliterationLabel:true,showTranslation:true,showTranslationLabel:true};
  var DEFAULT_CARD_STYLE={backgroundColor:"#123a31",backgroundImage:"",backgroundGradient:"",opacity:.92,backdropBlur:14,borderColor:"#ffffff",borderOpacity:.22,borderWidth:1,borderRadius:24,boxShadow:"0 28px 80px rgba(0,0,0,.32)",padding:"clamp(.55rem,1.5vw,1.2rem)",textColor:"#ffffff",titleColor:"#ffffff",subtitleColor:"#ffffff",arabicColor:"#ffffff",latinColor:"#e7f5f0",translationColor:"#ffffff",sourceColor:"#bff9e9"};
  function sourceLabel(sourceType,displayType,language){if(sourceType==="quran"){return language==="en"?"Qur’anic Evidence":"Dalil Al-Qur’an";}if(sourceType==="tafsir"){return "Tafsir";}if(sourceType==="hadith"){if(displayType==="narration"){return language==="en"?"Hadith Narration":"Riwayat Hadis";}return language==="en"?"Hadith Evidence":"Dalil Hadis";}if(sourceType==="ijma"){return language==="en"?"Ijma Evidence":"Dalil Ijma";}if(sourceType==="qiyas"){return language==="en"?"Qiyas Evidence":"Dalil Qiyas";}return language==="en"?"Other Reference":"Sumber Lain";}
  function legacyQuran(reference){var match=String(reference&&reference.referenceNumber||"").match(/(?:QS\.\s*)?(.+?)\s*\[?(\d{1,3})\]?\s*:\s*(\d{1,3})/i);return match?{surahName:match[1].trim(),surahNumber:Number(match[2]),ayahNumber:Number(match[3])}:{};}
  function normalizeGroups(slide){
    if(Array.isArray(slide.evidenceGroups)){return slide.evidenceGroups.map(function(group,index){return normalizeGroup(group,index);});}
    var references=Array.isArray(slide.references)?slide.references:(slide.reference?[slide.reference]:[]);
    return references.filter(Boolean).map(function(reference,index){var type=SOURCE_TYPES.indexOf(reference.sourceType)>=0?reference.sourceType:"other",quran=type==="quran"?legacyQuran(reference):{},blocks=(reference.passages||[]).map(function(passage,blockIndex){return {id:"legacy-block-"+(blockIndex+1),contentRole:passage.role||"narration",introId:passage.introId||"",introEn:passage.introEn||"",arabicText:passage.arabicText||"",transliteration:passage.latinText||"",translationId:passage.translationId||"",translationEn:passage.translationEn||"",sequence:blockIndex+1,displayOptions:Object.assign({},DEFAULT_BLOCK_OPTIONS,passage.displayOptions||{})};});return normalizeGroup({id:"legacy-evidence-"+(index+1),sourceType:type,sourceSubtype:"legacy_reference",groupMode:blocks.length>1?"grouped":"standalone",displayType:type==="hadith"&&blocks.length>1?"narration":"evidence",sequence:index+1,reference:{collection:type==="hadith"?reference.book||"":"",hadithNumber:type==="hadith"?reference.referenceNumber||"":"",grade:reference.grade||"",surahName:quran.surahName||"",surahNumber:quran.surahNumber||null,ayahNumber:quran.ayahNumber||null,citation:reference.numberingNote||"",url:reference.url||""},displayOptions:{showTitle:true,showReference:true},blocks:blocks},index);});
  }
  function normalizeGroup(group,index){var type=SOURCE_TYPES.indexOf(group.sourceType)>=0?group.sourceType:"other",blocks=(Array.isArray(group.blocks)?group.blocks:[]).map(function(block,blockIndex){return Object.assign({id:"block-"+(blockIndex+1),contentRole:"narration",introId:"",introEn:"",arabicText:"",transliteration:"",translationId:"",translationEn:"",sequence:blockIndex+1,displayOptions:{}},block,{displayOptions:Object.assign({},DEFAULT_BLOCK_OPTIONS,block.displayOptions||{})});}).sort(function(a,b){return Number(a.sequence)-Number(b.sequence);});return Object.assign({id:"evidence-"+(index+1),sourceType:type,sourceSubtype:"",groupMode:blocks.length>1?"grouped":"standalone",displayType:type==="hadith"&&blocks.length>1?"narration":"evidence",titleId:"",titleEn:"",labelId:"",labelEn:"",sequence:index+1,reference:{},displayOptions:{showTitle:true,showReference:true},blocks:blocks},group,{sourceType:type,reference:Object.assign({},group.reference||{}),displayOptions:Object.assign({showTitle:true,showReference:true},group.displayOptions||{}),blocks:blocks});}
  function renderPages(slide){
    var groups=normalizeGroups(slide),pages=[];
    groups.forEach(function(group){
      if(group.blocks.length){group.blocks.forEach(function(block,blockIndex){pages.push({pageType:"evidence",logicalEvidenceId:group.id,group:group,block:block,blockIndex:blockIndex,blockCount:group.blocks.length});});}
      else{pages.push({pageType:"evidence",logicalEvidenceId:group.id,group:group,block:null,blockIndex:0,blockCount:1});}
    });
    if(slide&&slide.sectionKey==="praktik_sholat"&&slide.mediaPath){pages.push({pageType:"application",logicalEvidenceId:"application:"+String(slide.slideKey||"practice"),group:null,block:null,blockIndex:0,blockCount:1});}
    return pages.length?pages:[null];
  }
  function quranReference(reference){if(!reference||!reference.surahName||!reference.surahNumber){return "";}var numbers=Array.isArray(reference.ayahNumbers)&&reference.ayahNumbers.length?reference.ayahNumbers:[],start=Number(reference.ayahStart||reference.ayahNumber||0),end=Number(reference.ayahEnd||start),label=numbers.length?numbers.join(", "):end>start?start+"–"+end:String(start||"");return label?"QS. "+reference.surahName+" ["+reference.surahNumber+"]: "+label:"";}
  function hadithReference(reference,language){if(!reference){return "";}if(reference.citation){return reference.citation;}var collection=String(reference.collection||"");var shortCollection=/muslim/i.test(collection)?"Muslim":/bukhari/i.test(collection)?"al-Bukhari":collection;return shortCollection&&reference.hadithNumber?(language==="en"?"Reported by ":"HR. ")+shortCollection+(language==="en"?", no. ":" no. ")+reference.hadithNumber:"";}
  function groupReference(group,language){var reference=group&&group.reference||{};if(group.sourceType==="quran"){return quranReference(reference);}if(group.sourceType==="tafsir"){return reference.citation||("Tafsir "+(reference.tafsirTitle||"")+" · "+quranReference(reference));}if(group.sourceType==="hadith"){return hadithReference(reference,language);}return reference.citation||reference.collection||reference.book||"";}
  function groupReferenceDetail(group){var reference=group&&group.reference||{};if(group.sourceType==="hadith"){return [reference.collection,reference.book].filter(Boolean).join(" · ");}if(group.sourceType==="tafsir"){return [reference.author,reference.language&&String(reference.language).toUpperCase(),reference.sourceName].filter(Boolean).join(" · ");}return reference.sourceName||"";}
  function localizePage(page,language,settings){if(!page){return null;}var group=page.group,block=page.block,options=block?Object.assign({},DEFAULT_BLOCK_OPTIONS,block.displayOptions||{}):Object.assign({},DEFAULT_BLOCK_OPTIONS),groupOptions=Object.assign({showTitle:true,showReference:true},group.displayOptions||{}),title=language==="en"?group.titleEn||group.titleId:group.titleId||group.titleEn,label=language==="en"?group.labelEn||group.labelId:group.labelId||group.labelEn,languageTranslationAllowed=language==="en"?options.showTranslationEn!==false:options.showTranslationId!==false;return {logicalEvidenceId:page.logicalEvidenceId,sourceType:group.sourceType,displayType:group.displayType,label:label||sourceLabel(group.sourceType,group.displayType,language),title:title||group.reference&&group.reference.commonName||"",reference:groupReference(group,language),referenceDetail:groupReferenceDetail(group),commonName:group.reference&&group.reference.commonName||"",url:group.reference&&group.reference.url||"",linkStatus:group.reference&&group.reference.linkStatus||group.databaseResolution&&group.databaseResolution.status||"",blockRole:block&&block.contentRole||"reference",blockIndex:page.blockIndex,blockCount:page.blockCount,intro:block?(language==="en"?block.introEn||block.introId:block.introId||block.introEn):"",arabic:block&&block.arabicText||"",tajwidPresentation:block&&block.tajwidPresentation||null,transliteration:block&&block.transliteration||"",translation:block?(language==="en"?block.translationEn||block.translationId:block.translationId||block.translationEn):"",tafsir:block&&block.tafsirText||"",componentOrder:block&&Array.isArray(block.componentOrder)?block.componentOrder:[],displayOptions:{showTitle:groupOptions.showTitle!==false,showReference:groupOptions.showReference!==false,showIntro:options.showIntro!==false,showArabic:settings.showArabic!==false&&options.showArabic!==false,showArabicLabel:options.showArabicLabel===true,showTransliteration:settings.showLatin!==false&&options.showTransliteration!==false,showTransliterationLabel:options.showTransliterationLabel!==false,showTranslation:settings.showTranslation!==false&&options.showTranslation!==false&&languageTranslationAllowed,showTranslationLabel:settings.showTranslationLabel!==false&&options.showTranslationLabel!==false},labels:{arabic:group.sourceType==="quran"?(language==="en"?"Verse":"Bacaan Ayat"):group.sourceType==="tafsir"?(language==="en"?"Arabic tafsir":"Tafsir Arab"):(language==="en"?"Arabic text":"Bacaan Hadis"),transliteration:language==="en"?"Transliteration":"Bacaan Latin",translation:group.sourceType==="tafsir"?"":(language==="en"?"Meaning:":"Artinya:")}};}
  function resolvedCardStyle(settings,sectionKey,config){return Object.assign({},DEFAULT_CARD_STYLE,config&&config.globalCardStyle||settings.globalCardStyle||{},settings.overlayCardStyle||{},settings.sectionCardStyles&&settings.sectionCardStyles[sectionKey]||{});}
  function formatClock(date, snapshot) {
    try { return new Intl.DateTimeFormat("id-ID", { timeZone: window.OverlayTimeService.timezone(snapshot), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date); }
    catch (error) { return date.toISOString().slice(11,16); }
  }
  function remainingLabel(milliseconds, language) { var text = window.PrayerTimeUtils.formatSeconds(Math.max(0, milliseconds) / 1000); return language === "en" ? text + " remaining" : text + " lagi"; }
  function enabledPrayerSetting(config, prayerKey, stateKey) {
    var rows = config && config.prayerSettings || [], row = rows.find(function (item) { return item.prayerKey === prayerKey && item.stateKey === stateKey; }); return !row || row.isEnabled !== false;
  }
  function nextFardhu(snapshot, now, language) {
    var source = snapshot && snapshot.activeSource, labels = language === "en" ? {subuh:"Fajr",dhuhur:"Dhuhr",ashar:"Asr",maghrib:"Maghrib",isha:"Isha"} : {subuh:"Subuh",dhuhur:"Dhuhur",ashar:"Ashar",maghrib:"Maghrib",isha:"Isya"};
    if (!source || !source.times) { return null; } var events = [];
    [0,1].forEach(function (offset) { Object.keys(labels).forEach(function (key) { var date = window.OverlayTimeService.localTimeDate(now, source.times[key], snapshot, offset); if (date && date > now) { events.push({ key:key, label:labels[key], date:date }); } }); });
    return events.sort(function (a,b) { return a.date-b.date; })[0] || null;
  }
  function nextSunnah(snapshot, config, now, language) {
    var source = snapshot && snapshot.activeSource; if (!source || !source.times) { return null; } var events = [], labels = language === "en" ? {syuruq:"Ishraq",dhuhaAwwal:"Early Duha",dhuhaWoosthaa:"Mid Duha",dhuhaAwwabin:"Duha Awwabin",qiyamulLail:"Qiyamul Lail"} : {syuruq:"Isyraq/Syuruq",dhuhaAwwal:"Dhuha Awwal",dhuhaWoosthaa:"Dhuha Wustha",dhuhaAwwabin:"Dhuha Awwabin",qiyamulLail:"Qiyamul Lail"};
    [0,1].forEach(function (offset) {
      var syuruq = window.OverlayTimeService.localTimeDate(now, source.times.syuruq, snapshot, offset); if (syuruq && syuruq > now) { events.push({ key:"syuruq", label:labels.syuruq, date:syuruq }); }
      ["dhuhaAwwal","dhuhaWoosthaa","dhuhaAwwabin"].forEach(function (key) { var timing=source.dhuhaTimings&&source.dhuhaTimings[key]; if (!timing || !enabledPrayerSetting(config,key,"phase")) { return; } var date=window.OverlayTimeService.localTimeDate(now,timing.start,snapshot,offset); if(date&&date>now){events.push({key:key,label:labels[key],date:date});} });
    });
    if (enabledPrayerSetting(config,"qiyamulLail","last_third_recurring")) {
      [-1,0,1].forEach(function (offset) { var maghrib=window.OverlayTimeService.localTimeDate(now,source.times.maghrib,snapshot,offset),subuh=window.OverlayTimeService.localTimeDate(now,source.times.subuh,snapshot,offset+1); if(!maghrib||!subuh||subuh<=maghrib){return;} var lastThird=new Date(maghrib.getTime()+(subuh.getTime()-maghrib.getTime())*2/3); if(lastThird>now){events.push({key:"qiyamulLail",label:labels.qiyamulLail,date:lastThird});} });
    }
    return events.sort(function(a,b){return a.date-b.date;})[0]||null;
  }
  function timeContext(snapshot, config, now, language) {
    var dashboardConfig=window.PrayerDashboardRuntime&&window.PrayerDashboardRuntime.getConfig?window.PrayerDashboardRuntime.getConfig():null,source=snapshot&&snapshot.activeSource;
    if(!dashboardConfig){dashboardConfig={scheduleSources:source?[source]:[],activeSourceId:source&&source.id||null,calendar:{timezone:snapshot&&snapshot.timezone||source&&source.timezone||"Asia/Jakarta"},display:{},prayerCards:{},prayerOrder:snapshot&&snapshot.prayerOrder||[]};}
    var timeline = window.PrayerScheduleRenderer && window.PrayerScheduleRenderer.buildTimeBackgroundTimeline ? window.PrayerScheduleRenderer.buildTimeBackgroundTimeline(dashboardConfig, now) : null;
    var phase=timeline&&timeline.phase||null, phaseKey=phase&&phase.id||"main", phaseLabel=phaseLabels[phaseKey]||phaseLabels.main,currentPrayer=currentPrayerLabels[phaseKey]||currentPrayerLabels.main,fardhu=nextFardhu(snapshot,now,language), sunnah=nextSunnah(snapshot,config,now,language);
    return {
      language:language,clock:snapshot&&snapshot.clockText||formatClock(now,snapshot),gregorianDate:snapshot&&snapshot.gregorianDate||"",hijriDate:snapshot&&snapshot.hijriDate||"",timezone:snapshot&&snapshot.timezone||"",
      currentPrayerLabel:localizedText(currentPrayer.id,currentPrayer.en,language),currentLabel:localizedText(phaseLabel.id,phaseLabel.en,language),periodRange:phase?[formatClock(phase.start,snapshot),formatClock(phase.end,snapshot)].join(" – "):"",
      nextFardhuLabel:fardhu?fardhu.label:"-",nextFardhuTime:fardhu?formatClock(fardhu.date,snapshot):"-",nextFardhuRemaining:fardhu?remainingLabel(fardhu.date-now,language):"",
      nextSunnahLabel:sunnah?sunnah.label:"-",nextSunnahTime:sunnah?formatClock(sunnah.date,snapshot):"-",nextSunnahRemaining:sunnah?remainingLabel(sunnah.date-now,language):"",
      sourceName:snapshot&&snapshot.activeSource&&snapshot.activeSource.name||""
    };
  }
  function candidateForSlide(slide,snapshot,config,now,lang,options){
    options=options||{};var settings=Object.assign({},data.settings||{},options.settings||{}),language=lang==="en"?"en":"id",sectionKey=options.sectionKey||slide.sectionKey||"rukun_iman",section=sectionLabels[sectionKey]||{id:sectionKey,en:sectionKey};
    var sectionSlides=Array.isArray(options.sectionSlides)&&options.sectionSlides.length?options.sectionSlides:data.slides.filter(function(item){return item.isEnabled!==false&&item.sectionKey===sectionKey;});
    var foundIndex=sectionSlides.findIndex(function(item){return item.slideKey===slide.slideKey;}),slideIndex=Number.isFinite(Number(options.slideIndex))?Number(options.slideIndex):Math.max(0,foundIndex),total=Math.max(1,Number(options.totalSlides||sectionSlides.length||1));
    var durationMs=Math.max(10000,Number(options.durationMs||settings.sectionSlideSeconds&&settings.sectionSlideSeconds[sectionKey]*1000||settings.displayDurationSeconds*1000||45000)),slideOffset=Math.max(0,Math.min(durationMs-1,Number(options.slideOffset||0))),nowMs=now.getTime();
    var title=localizedText(slide.titleId,slide.titleEn,language),subtitle=localizedText(slide.subtitleId,slide.subtitleEn,language),body=localizedText(slide.bodyId,slide.bodyEn,language),translation=localizedText(slide.translationId,slide.translationEn,language),instruction=localizedText(slide.instructionId,slide.instructionEn,language);
    var pages=renderPages(slide),page=options.evidencePage!==undefined?options.evidencePage:pages[Math.max(0,Math.min(pages.length-1,Number(options.evidencePageIndex||0)))],presentationPhase=page&&page.pageType==="application"?"application":"evidence",localized=settings.showEvidence!==false&&presentationPhase==="evidence"?localizePage(page,language,settings):null,context=timeContext(snapshot,config,now,language),showIndicator=settings.showPageIndicator!==false;
    var sameTypeSlides=sectionSlides.filter(function(item){return item.slideType===slide.slideType;}),semanticIndex=sameTypeSlides.findIndex(function(item){return item.slideKey===slide.slideKey;})+1,semanticCount=sameTypeSlides.length,displayLabel;
    if(localized){displayLabel=[localized.label,localized.title||localized.reference].filter(Boolean).join(" · ");}
    else if(semanticCount>1&&["principle","pillar","condition","movement","reading"].indexOf(slide.slideType)>=0){displayLabel=title+" · "+String(Math.max(1,semanticIndex))+" "+(language==="en"?"of":"dari")+" "+String(semanticCount);}
    else{displayLabel=presentationPhase==="application"?title+" · "+(language==="en"?"Applied illustration":"Penerapan dan ilustrasi"):title;}
    var source=localized&&localized.displayOptions.showReference&&localized.reference?{name:localized.reference,url:localized.url||null,sourceType:localized.sourceType}:null;
    var sequenceFlow=sectionKey==="praktik_sholat"&&Boolean(slide.mediaPath),applicationPhase=sequenceFlow&&presentationPhase==="application",flow=slide.presentationFlow||{},evidenceSummary=normalizeGroups(slide).map(function(group){return groupReference(group,language);}).filter(Boolean);
    var materialWidget={widgetKey:"worship-education-content",widgetType:"presentation_scene",layerKey:"main",sortOrder:1,isEnabled:true,config:{adapter:"worship_education",mediaUrl:applicationPhase?slide.mediaPath||null:null,mediaRole:"illustration",mediaAlt:(language==="en"?"Prayer practice illustration: ":"Ilustrasi praktik salat: ")+title,contentType:slide.slideType,chapterKey:slide.chapterKey,sequenceFlow:sequenceFlow,flowPhase:presentationPhase,flowMode:flow.mode||"evidence_explanation_illustration",flowLabels:language==="en"?{evidence:"1 · Evidence",explanation:"2 · Explanation and practice",illustration:"3 · Applied illustration"}:{evidence:"1 · Dalil",explanation:"2 · Penjelasan dan praktik",illustration:"3 · Ilustrasi penerapan"},evidenceSummary:applicationPhase?evidenceSummary:[],explanation:applicationPhase?body:"",arabic:applicationPhase&&settings.showArabic!==false?slide.arabicText||"":"",latin:applicationPhase&&settings.showLatin!==false?slide.latinText||"":"",translation:applicationPhase&&settings.showTranslation!==false?translation||"":"",translationLabel:language==="en"?"Meaning:":"Artinya:",showTranslationLabel:settings.showTranslationLabel!==false,instruction:applicationPhase?instruction||"":"",evidencePage:localized,language:language},source:null,sources:[]};
    var cardStyle=resolvedCardStyle(settings,sectionKey,config);
    return {candidateKey:"worship-education:"+String(settings.version||1)+":"+String(options.cycle||0)+":"+sectionKey+":"+String(slideIndex)+":"+(page&&page.logicalEvidenceId||"material")+":"+String(page&&page.blockIndex||0),overlayKey:"worship-education-rotation",overlayType:"worship_education",priority:options.preview?99999:180,interruptionPolicy:"pause",conflictMode:"replace",isInterruptible:true,layerKey:"main",layerOrder:180,animation:"fade",settings:{showContent:true,showClock:true,showDates:true,protectedPhases:["pre_adzan","adzan","iqamah","prayer","friday"],playlistMode:"sequential",playlistLoop:false,oneViewport:true,globalCardStyle:config&&config.globalCardStyle||settings.globalCardStyle||{}},startsAt:nowMs-slideOffset,endsAt:nowMs+(durationMs-slideOffset),targetAt:nowMs+(durationMs-slideOffset),language:language,backgroundPath:slide.backgroundPath||DEFAULT_BACKGROUND,backgroundMedia:null,content:{eyebrow:language==="en"?section.en:section.id,title:title,subtitle:subtitle,bodyText:body,additionalText:"",textAlign:"center",fontFamily:"Arial, Helvetica, sans-serif",titleSizeClamp:"clamp(1.3rem,4vw,3.5rem)",bodySizeClamp:"clamp(.74rem,1.65vw,1.2rem)"},layout:{xPercent:50,yPercent:55,widthPercent:94,heightPercent:80,anchorKey:"center",showCard:true,imageFit:"cover",imagePosition:"center center",imageOpacity:1,tintColor:"#071d18",tintOpacity:.76,cardBackground:cardStyle.backgroundColor,cardOpacity:cardStyle.opacity,settings:{cardStyle:cardStyle}},sequenceItems:[],widgets:[materialWidget],metadata:{triggerReason:options.preview?"worship-education-direct-preview":"worship-education-category-playlist",worshipEducation:true,oneViewport:true,preview:Boolean(options.preview),slideKey:slide.slideKey,topicTitle:title,sectionKey:sectionKey,sectionTitle:language==="en"?section.en:section.id,sectionType:slide.slideType,sectionIndex:semanticIndex,sectionCount:semanticCount,displayLabel:displayLabel,duration:durationMs,logicalEvidenceId:page&&page.logicalEvidenceId||null,renderPageIndex:page?page.blockIndex+1:1,renderPageCount:page?page.blockCount:1,sequenceItemIndex:slideIndex+1,sequenceItemTotal:total,sequenceItemRemainingMs:durationMs-slideOffset,showPageIndicator:showIndicator,timeContext:context,settingsVersion:settings.version||1}};
  }
  function candidate(snapshot, config, now, lang) {
    var settings=data.settings||{}; if(!settings.isEnabled||!Array.isArray(data.slides)||!data.slides.length){return null;}
    var language=lang==="en"?"en":"id", paused=settings.pauseDuringPrayer!==false&&activePrayerPeriod(snapshot,config,now,language), cursor=advancePlayback(now,paused); if(paused){return null;}
    var plan=playlist(settings); if(!plan.totalMs){return null;} var cycle=Math.floor(cursor/plan.totalMs),position=((cursor%plan.totalMs)+plan.totalMs)%plan.totalMs,segment=plan.segments.find(function(item){return position>=item.start&&position<item.end;});
    if(!segment||segment.type!=="section"){return null;}var sectionPosition=position-segment.start,itemIndex=Math.min(segment.renderItems.length-1,Math.floor(sectionPosition/segment.slideDurationMs)),item=segment.renderItems[itemIndex],slideOffset=sectionPosition-itemIndex*segment.slideDurationMs;
    return candidateForSlide(item.slide,snapshot,config,now,language,{sectionKey:segment.sectionKey,sectionSlides:segment.slides,slideIndex:item.logicalIndex,totalSlides:segment.slides.length,evidencePage:item.page,evidencePageIndex:item.pageIndex,durationMs:segment.slideDurationMs,slideOffset:slideOffset,cycle:cycle});
  }
  function resetPlayback(cursorMs){playback={settingsVersion:Number(data.settings&&data.settings.version||0),cursorMs:Math.max(0,Number(cursorMs||0)),lastAtMs:null,lastSavedAtMs:0};try{window.localStorage.removeItem(PLAYBACK_KEY);}catch(error){}}
  window.WorshipEducationOverlayController={start:start,load:load,candidate:candidate,previewCandidate:function(slide,snapshot,config,now,lang,options){return candidateForSlide(slide,snapshot,config,now,lang,Object.assign({},options||{},{preview:true}));},snapshot:function(){return data;},cacheStatus:function(){return {transport:transport,cachedAt:cacheSavedAt,lastError:lastLoadError,database:OFFLINE_DB_NAME,store:OFFLINE_STORE_NAME,key:OFFLINE_SNAPSHOT_KEY,slideCount:Array.isArray(data.slides)?data.slides.length:0};},resetPlayback:resetPlayback,playlist:function(){return playlist(data.settings||{});},renderPages:renderPages,normalizeGroups:normalizeGroups};
  start();
})(window);
