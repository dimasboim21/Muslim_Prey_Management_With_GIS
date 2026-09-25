(function (window, document) {
  "use strict";

  var currentCompositeKey = "";
  var providerTimer = null;

  function byId(id) { return document.getElementById(id); }
  function text(value) { return String(value === undefined || value === null ? "" : value).trim(); }
  function displayText(value) { return text(value).replace(/\b(?:sholat|shalat|solat)\b/gi,function(word){return word.charAt(0)===word.charAt(0).toUpperCase()?"Salat":"salat";}); }

  function setText(id, value) {
    var element = byId(id);
    if (!element) { return false; }
    var output = displayText(value);
    element.textContent = output;
    element.hidden = output === "";
    return output !== "";
  }

  function safeUrl(value) {
    var path = text(value);
    if (!path || /^(?:javascript|data):/i.test(path)) { return ""; }
    try {
      var url = new URL(path, window.location.href);
      return ["http:", "https:"].indexOf(url.protocol) >= 0 ? url.href : "";
    } catch (error) { return ""; }
  }

  function notify(type, detail) {
    window.dispatchEvent(new CustomEvent("mpm:overlay-renderer-event", {
      detail: Object.assign({ eventType: type, occurredAt: new Date().toISOString() }, detail || {})
    }));
  }

  function showFallback(backgroundNode, fallback, candidate, reason) {
    if (fallback && backgroundNode) {
      backgroundNode.hidden = false;
      backgroundNode.style.backgroundImage = 'url("' + fallback.replace(/"/g, "\\\"") + '")';
    }
    notify("media_fallback", {
      candidateKey: candidate && candidate.candidateKey,
      overlayKey: candidate && candidate.overlayKey,
      reasonCode: reason,
      fallbackAvailable: Boolean(fallback)
    });
    if (!fallback) {
      var snapshot = window.PrayerDashboardRuntime && window.PrayerDashboardRuntime.getSnapshot ? window.PrayerDashboardRuntime.getSnapshot() : {};
      setText("dynamicOverlayClock", snapshot && snapshot.clockText || "--:--");
      setText("dynamicOverlayGregorian", snapshot && snapshot.gregorianDate || "");
      setText("dynamicOverlayHijri", snapshot && snapshot.hijriDate || "");
      var root = byId("dynamicOverlayRoot");
      var timebar = root && root.querySelector(".dynamic-overlay-timebar");
      if (byId("dynamicOverlayClock")) { byId("dynamicOverlayClock").hidden = false; }
      if (byId("dynamicOverlayDates")) { byId("dynamicOverlayDates").hidden = false; }
      if (timebar) { timebar.hidden = false; }
      if (root) { root.classList.add("has-critical-fallback"); }
      var persistent = byId("dynamicOverlayPersistentLayer");
      if (persistent && !persistent.querySelector(".dynamic-overlay-critical-prayer")) {
        var prayer = document.createElement("article");
        prayer.className = "dynamic-overlay-widget dynamic-overlay-critical-prayer";
        appendLine(prayer, "dynamic-overlay-widget-title", "Waktu salat berikutnya", { tag: "strong" });
        appendLine(prayer, "dynamic-overlay-widget-body", [snapshot && snapshot.nextPrayerLabel, snapshot && snapshot.nextPrayerTime].filter(Boolean).join(" ") || "Jadwal salat tetap aktif");
        appendLine(prayer, "dynamic-overlay-widget-meta", snapshot && snapshot.nextPrayerCountdown ? "Sisa " + snapshot.nextPrayerCountdown : "");
        persistent.appendChild(prayer);
        persistent.hidden = false;
      }
    }
  }

  function resetMedia() {
    var backgroundNode = byId("dynamicOverlayBackground");
    var video = byId("dynamicOverlayVideo");
    var provider = byId("dynamicOverlayProvider");
    if (providerTimer) { window.clearTimeout(providerTimer); providerTimer = null; }
    if (video) {
      video.onerror = null;
      video.pause();
      video.hidden = true;
      video.removeAttribute("src");
      video.removeAttribute("poster");
    }
    if (provider) {
      provider.onload = null;
      provider.onerror = null;
      provider.hidden = true;
      provider.removeAttribute("src");
    }
    if (backgroundNode) {
      backgroundNode.hidden = true;
      backgroundNode.style.backgroundImage = "none";
    }
    if (byId("dynamicOverlayRoot")) { byId("dynamicOverlayRoot").classList.remove("has-critical-fallback"); }
    var criticalPrayer = document.querySelector(".dynamic-overlay-critical-prayer");
    if (criticalPrayer) { criticalPrayer.remove(); }
  }

  function renderMedia(candidate) {
    resetMedia();
    if (!candidate || candidate.settings && candidate.settings.showBackground === false) { return; }
    var backgroundNode = byId("dynamicOverlayBackground");
    var video = byId("dynamicOverlayVideo");
    var provider = byId("dynamicOverlayProvider");
    var media = candidate.backgroundMedia || {};
    var kind = media.mediaKind || "image";
    var source = safeUrl(media.publicUrl || candidate.backgroundPath);
    var fallback = safeUrl(media.fallbackUrl || media.posterUrl || candidate.backgroundPath);
    if (!source) { return; }

    if (kind === "video" && video) {
      video.src = source;
      if (fallback) { video.poster = fallback; }
      video.loop = !(candidate.settings && candidate.settings.videoLoop === false);
      video.hidden = false;
      video.onerror = function () { video.hidden = true; showFallback(backgroundNode, fallback, candidate, "video-load-failed"); };
      var playback = video.play();
      if (playback && playback.catch) {
        playback.catch(function () { video.hidden = true; showFallback(backgroundNode, fallback, candidate, "video-playback-blocked"); });
      }
      return;
    }

    if (kind === "youtube" && provider) {
      if (fallback && backgroundNode) {
        backgroundNode.hidden = false;
        backgroundNode.style.backgroundImage = 'url("' + fallback.replace(/"/g, "\\\"") + '")';
      }
      var loaded = false;
      provider.onload = function () {
        loaded = true;
        provider.hidden = false;
        if (backgroundNode) { backgroundNode.hidden = true; }
        if (providerTimer) { window.clearTimeout(providerTimer); providerTimer = null; }
      };
      provider.onerror = function () { provider.hidden = true; showFallback(backgroundNode, fallback, candidate, "youtube-load-failed"); };
      provider.src = source;
      provider.hidden = false;
      providerTimer = window.setTimeout(function () {
        if (!loaded) {
          provider.hidden = true;
          provider.removeAttribute("src");
          showFallback(backgroundNode, fallback, candidate, "youtube-timeout");
        }
      }, 10000);
      return;
    }

    if (backgroundNode) {
      backgroundNode.hidden = false;
      backgroundNode.style.backgroundImage = 'url("' + source.replace(/"/g, "\\\"") + '")';
      var probe = new Image();
      probe.onerror = function () { showFallback(backgroundNode, fallback !== source ? fallback : "", candidate, "image-load-failed"); };
      probe.src = source;
    }
  }

  function appendLine(host, className, value, options) {
    var output = displayText(value);
    if (!output) { return null; }
    var element = document.createElement(options && options.tag || "p");
    element.className = className;
    element.textContent = output;
    if (options && options.lang) { element.lang = options.lang; }
    if (options && options.dir) { element.dir = options.dir; }
    host.appendChild(element);
    return element;
  }

  function appendTajwidArabic(host, className, canonical, presentation) {
    if (!presentation || !text(presentation.plainText) || !Array.isArray(presentation.spans) || !presentation.spans.length) { return appendLine(host, className, canonical, {lang:"ar",dir:"rtl"}); }
    var element=document.createElement("p"),chars=Array.from(String(presentation.plainText)),cursor=0;
    element.className=className+" has-tajwid";element.lang="ar";element.dir="rtl";element.dataset.tajwidEdition=presentation.editionTitle||"";element.dataset.alignmentStatus=presentation.alignmentStatus||"";
    presentation.spans.slice().sort(function(a,b){return Number(a.startCharacter)-Number(b.startCharacter);}).forEach(function(span){var start=Math.max(cursor,Number(span.startCharacter||0)),end=Math.max(start,Math.min(chars.length,Number(span.endCharacter||start)));if(start>cursor){element.appendChild(document.createTextNode(chars.slice(cursor,start).join("")));}var token=document.createElement("span");token.className="dynamic-overlay-tajwid-token tajwid-"+String(span.code||"").toLowerCase().replace(/[^a-z0-9_-]/g,"");token.dataset.rule=span.code||"";token.title=span.nameId||span.nameEn||span.code||"Tajwid";token.textContent=chars.slice(start,end).join("");token.style.setProperty("--tajwid-overlay-color",span.darkColor||span.lightColor||"#f4c95d");element.appendChild(token);cursor=end;});
    if(cursor<chars.length){element.appendChild(document.createTextNode(chars.slice(cursor).join("")));}host.appendChild(element);return element;
  }

  function formatPrayerTimes(snapshot) {
    var labels = { subuh: "Subuh", syuruq: "Syuruq", dhuha: "Dhuha", dhuhur: "Dhuhur", ashar: "Ashar", maghrib: "Maghrib", isha: "Isya" };
    var times = snapshot && snapshot.prayerTimes || {};
    var rows = Object.keys(labels).filter(function (key) { return text(times[key]); }).map(function (key) { return labels[key] + " " + times[key]; });
    var next = [snapshot && snapshot.nextPrayerLabel, snapshot && snapshot.nextPrayerTime].filter(Boolean).join(" ");
    if (next) { rows.push("Berikutnya " + next + (snapshot.nextPrayerCountdown ? " (" + snapshot.nextPrayerCountdown + ")" : "")); }
    var clockMatch=String(snapshot&&snapshot.clockText||"").match(/(\d{1,2})\D(\d{2})(?:\D(\d{2}))?/),nowSeconds=clockMatch?Number(clockMatch[1])*3600+Number(clockMatch[2])*60+Number(clockMatch[3]||0):null;
    if(nowSeconds!==null){var fardhu=["subuh","dhuhur","ashar","maghrib","isha"].map(function(key){var match=String(times[key]||"").match(/(\d{1,2})\D(\d{2})/);return match?{key:key,seconds:Number(match[1])*3600+Number(match[2])*60}:null;}).filter(Boolean);var current=fardhu.filter(function(row){return row.seconds<=nowSeconds;}).pop()||fardhu[fardhu.length-1];if(current){var elapsed=nowSeconds-current.seconds;if(elapsed<0){elapsed+=86400;}var elapsedHours=String(Math.floor(elapsed/3600)).padStart(2,"0"),elapsedMinutes=String(Math.floor(elapsed%3600/60)).padStart(2,"0");rows.push("Rentang "+(labels[current.key]||current.key)+" · waktu berlalu "+elapsedHours+":"+elapsedMinutes);}}
    return rows.join(" · ");
  }

  function astronomySummary(snapshot) {
    var astronomy = snapshot && snapshot.astronomy || {};
    var sun = astronomy.sun || {};
    var moon = astronomy.moon || {};
    return [sun.sunrise ? "Terbit " + sun.sunrise : "", sun.sunset ? "Terbenam " + sun.sunset : "", moon.phase ? "Bulan " + moon.phase : ""].filter(Boolean).join(" · ");
  }

  function widgetValue(widget, snapshot) {
    var config = widget.config || {};
    var type = widget.widgetType;
    if (type === "clock") { return snapshot && snapshot.clockText || config.label || "Jam"; }
    if (type === "prayer_schedule") { return formatPrayerTimes(snapshot) || [snapshot && snapshot.nextPrayerLabel, snapshot && snapshot.nextPrayerTime].filter(Boolean).join(" ") || config.body || "Jadwal salat belum tersedia"; }
    if (type === "islamic_calendar") {
      var events = snapshot && snapshot.calendarEvents || [];
      return events.length ? events.map(function (event) { return event.nameId || event.nameEn; }).filter(Boolean).join(" · ") : snapshot && snapshot.hijriDate || config.body || "Kalender Islam";
    }
    if (type === "weather") { return snapshot && snapshot.weather && (snapshot.weather.summary || snapshot.weather.condition) || config.body || "Data cuaca belum tersedia"; }
    if (type === "webgis") {
      var location = snapshot && snapshot.location || {};
      return [location.adm2 || location.city, location.adm1 || location.province, location.country].filter(Boolean).join(", ") || config.body || "Lokasi WebGIS belum tersedia";
    }
    if (type === "astronomy") { return astronomySummary(snapshot) || config.body || "Data astronomi belum tersedia"; }
    return config.body || config.text || config.label || type.replace(/_/g, " ");
  }

  function renderWidget(widget, snapshot) {
    var config = widget.config || {};
    var item = document.createElement("article");
    item.className = "dynamic-overlay-widget dynamic-overlay-widget-" + String(widget.widgetType || "text").replace(/[^a-z0-9_-]/gi, "");
    item.dataset.widgetKey = widget.widgetKey || "";
    item.dataset.widgetType = widget.widgetType || "text";
    if (Number.isFinite(Number(config.xPercent))) { item.style.setProperty("--widget-x", Number(config.xPercent) + "%"); }
    if (Number.isFinite(Number(config.yPercent))) { item.style.setProperty("--widget-y", Number(config.yPercent) + "%"); }
    if (Number.isFinite(Number(config.widthPercent))) { item.style.setProperty("--widget-width", Math.max(10, Math.min(100, Number(config.widthPercent))) + "%"); }
    if (config.positioned === true) { item.classList.add("is-positioned"); }
    item.style.textAlign = ["left", "center", "right"].indexOf(config.textAlign) >= 0 ? config.textAlign : "center";
    if (config.backgroundColor && /^#[0-9a-f]{6}$/i.test(config.backgroundColor)) { item.style.backgroundColor = config.backgroundColor; }
    if (config.textColor && /^#[0-9a-f]{6}$/i.test(config.textColor)) { item.style.color = config.textColor; }
    if (config.borderColor && /^#[0-9a-f]{6}$/i.test(config.borderColor)) { item.style.borderColor = config.borderColor; }
    if (Number.isFinite(Number(config.borderWidthPx))) { item.style.borderWidth = Math.max(0, Math.min(12, Number(config.borderWidthPx))) + "px"; }
    var widgetFonts={system:"Arial, Helvetica, sans-serif",serif:"Georgia, 'Times New Roman', serif",mono:"Consolas, 'Courier New', monospace",arabic:"'Noto Naskh Arabic', 'Amiri', serif"};
    if (widgetFonts[config.fontFamily]) { item.style.fontFamily = widgetFonts[config.fontFamily]; }
    if (Number.isFinite(Number(config.fontSizePx))) { item.style.fontSize = Math.max(10, Math.min(120, Number(config.fontSizePx))) + "px"; }
    if (Number.isFinite(Number(config.paddingPx))) { item.style.padding = Math.max(0, Math.min(80, Number(config.paddingPx))) + "px"; }
    if (Number.isFinite(Number(config.opacity))) { item.style.opacity = Math.max(0, Math.min(1, Number(config.opacity))); }
    if (["fade","slide","pulse"].indexOf(config.animation) >= 0) { item.classList.add("has-animation-" + config.animation); }
    if (config.safeArea !== false) { item.classList.add("uses-safe-area"); }

    appendLine(item, "dynamic-overlay-widget-title", config.label || config.title, { tag: "strong" });
    if (widget.widgetType === "worship_time_context") {
      item.classList.add("dynamic-overlay-worship-time-context");
      var contextLanguage=config.language==="en"?"en":"id",contextGrid=document.createElement("div");contextGrid.className="dynamic-overlay-worship-time-grid";
      function contextCell(labelText,mainText,metaText){var cell=document.createElement("section");cell.className="dynamic-overlay-worship-time-cell";appendLine(cell,"dynamic-overlay-worship-time-label",labelText,{tag:"small"});appendLine(cell,"dynamic-overlay-worship-time-main",mainText,{tag:"strong"});appendLine(cell,"dynamic-overlay-worship-time-meta",metaText);contextGrid.appendChild(cell);}
      contextCell(contextLanguage==="en"?"Actual time":"Waktu aktual",config.clock,[config.gregorianDate,config.hijriDate].filter(Boolean).join(" · "));
      contextCell(contextLanguage==="en"?"Current prayer range":"Rentang salat saat ini",config.currentPrayerLabel,config.periodRange);
      contextCell(contextLanguage==="en"?"Current time category":"Golongan waktu saat ini",config.currentLabel,config.periodRange);
      contextCell(contextLanguage==="en"?"Next Sunnah":"Sunnah berikutnya",[config.nextSunnahLabel,config.nextSunnahTime].filter(Boolean).join(" · "),config.nextSunnahRemaining);
      contextCell(contextLanguage==="en"?"Next obligatory prayer":"Fardhu berikutnya",[config.nextFardhuLabel,config.nextFardhuTime].filter(Boolean).join(" · "),config.nextFardhuRemaining);
      item.appendChild(contextGrid);appendLine(item,"dynamic-overlay-worship-time-source",config.sourceName?((contextLanguage==="en"?"Falak source: ":"Sumber falak: ")+config.sourceName):"");
    } else if (widget.widgetType === "presentation_scene" || widget.widgetType === "funeral_scene") {
      item.classList.add("dynamic-overlay-presentation-scene", "dynamic-overlay-funeral-scene");
      var sequenceFlow=config.adapter==="worship_education"&&config.sequenceFlow===true,flowLabels=config.flowLabels||{},sceneMedia=safeUrl(config.mediaUrl),sceneFigure=document.createElement("figure"),sceneCopy=document.createElement("div");
      if(sequenceFlow){item.classList.add("has-sequence-flow");}
      sceneFigure.className="dynamic-overlay-funeral-scene-media";sceneCopy.className="dynamic-overlay-funeral-scene-copy";
      if(sceneMedia){if(config.mediaRole==="deceased_photo"){item.classList.add("has-deceased-photo");sceneFigure.classList.add("is-deceased-photo");}var sceneImage=document.createElement("img");sceneImage.src=sceneMedia;sceneImage.alt=config.mediaAlt||"Ilustrasi materi";sceneImage.addEventListener("error",function(){sceneFigure.remove();item.classList.remove("has-deceased-photo");});sceneFigure.appendChild(sceneImage);if(sequenceFlow){appendLine(sceneFigure,"dynamic-overlay-worship-flow-caption",flowLabels.illustration||"3 · Ilustrasi penerapan",{tag:"figcaption"});}else{item.appendChild(sceneFigure);}}
      if(sequenceFlow&&config.flowPhase==="application"){appendLine(sceneCopy,"dynamic-overlay-worship-flow-label",flowLabels.explanation||"2 · Penjelasan dan praktik",{tag:"small"});appendLine(sceneCopy,"dynamic-overlay-worship-explanation",config.explanation);if(Array.isArray(config.evidenceSummary)&&config.evidenceSummary.length){appendLine(sceneCopy,"dynamic-overlay-worship-evidence-summary",(config.language==="en"?"Evidence presented previously: ":"Dalil yang baru ditampilkan: ")+config.evidenceSummary.join(" · "),{tag:"small"});}}
      appendLine(sceneCopy,"dynamic-overlay-widget-arabic",config.arabic,{lang:"ar",dir:"rtl"});
      appendLine(sceneCopy,"dynamic-overlay-widget-latin",config.latin);
      appendLine(sceneCopy,"dynamic-overlay-widget-translation",config.translation?(config.showTranslationLabel===false?config.translation:(config.translationLabel||"Artinya:")+" "+config.translation):"");
      appendLine(sceneCopy,"dynamic-overlay-widget-meta",config.instruction);
      if(config.evidencePage){
        var evidence=config.evidencePage,display=evidence.displayOptions||{},quote=document.createElement("blockquote"),defaultOrder=["title","intro","arabic","transliteration","translation","reference"],componentOrder=Array.isArray(evidence.componentOrder)&&evidence.componentOrder.length?evidence.componentOrder:defaultOrder;
        quote.className="dynamic-overlay-evidence-block is-"+String(evidence.sourceType||"other").replace(/[^a-z0-9_-]/gi,"");quote.dataset.logicalEvidenceId=evidence.logicalEvidenceId||"";quote.dataset.passageRole=evidence.blockRole||"reference";quote.dataset.linkStatus=evidence.linkStatus||"";appendLine(quote,"dynamic-overlay-evidence-badge",evidence.label,{tag:"small"});
        function renderEvidenceComponent(component){
          if(component==="title"&&display.showTitle!==false){appendLine(quote,"dynamic-overlay-evidence-title",evidence.title,{tag:"strong"});}
          else if(component==="intro"&&display.showIntro!==false){appendLine(quote,"dynamic-overlay-evidence-intro",evidence.intro,{tag:"strong"});}
          else if(component==="arabic"&&display.showArabic!==false&&evidence.arabic){if(display.showArabicLabel){appendLine(quote,"dynamic-overlay-evidence-field-label",evidence.labels&&evidence.labels.arabic,{tag:"small"});}appendTajwidArabic(quote,"dynamic-overlay-evidence-arabic",evidence.arabic,evidence.tajwidPresentation);}
          else if(component==="transliteration"&&display.showTransliteration!==false&&evidence.transliteration){if(display.showTransliterationLabel){appendLine(quote,"dynamic-overlay-evidence-field-label",evidence.labels&&evidence.labels.transliteration,{tag:"small"});}appendLine(quote,"dynamic-overlay-evidence-latin",evidence.transliteration);}
          else if(component==="translation"&&display.showTranslation!==false&&evidence.translation){appendLine(quote,"dynamic-overlay-evidence-translation",(display.showTranslationLabel!==false?(evidence.labels&&evidence.labels.translation||"Artinya:")+" ":"")+evidence.translation);}
          else if(component==="tafsir"&&display.showTranslation!==false&&(evidence.tafsir||evidence.translation)){appendLine(quote,"dynamic-overlay-evidence-tafsir",evidence.tafsir||evidence.translation);}
          else if(component==="reference"&&display.showReference!==false){
            var evidenceUrl=safeUrl(evidence.url),sourceNode=document.createElement(evidenceUrl?"a":"small");sourceNode.className="dynamic-overlay-evidence-source";sourceNode.textContent=displayText(evidence.reference||"");if(evidenceUrl){sourceNode.href=evidenceUrl;sourceNode.target="_blank";sourceNode.rel="noopener noreferrer";}if(sourceNode.textContent){quote.appendChild(sourceNode);}appendLine(quote,"dynamic-overlay-evidence-source-detail",evidence.referenceDetail,{tag:"small"});appendLine(quote,"dynamic-overlay-evidence-source-detail",evidence.commonName&&evidence.commonName!==evidence.title?(config.language==="en"?"Known as ":"Dikenal sebagai ")+evidence.commonName: "",{tag:"small"});if(evidence.linkStatus&&evidence.linkStatus!=="linked"){appendLine(quote,"dynamic-overlay-evidence-link-status",evidence.linkStatus,{tag:"small"});}
          }
        }
        componentOrder.forEach(renderEvidenceComponent);sceneCopy.appendChild(quote);if(sequenceFlow){var evidenceFlowLabel=document.createElement("small");evidenceFlowLabel.className="dynamic-overlay-worship-flow-label is-evidence";evidenceFlowLabel.textContent=flowLabels.evidence||"1 · Dalil";sceneCopy.insertBefore(quote,sceneCopy.firstChild);sceneCopy.insertBefore(evidenceFlowLabel,quote);}
      }else if(Array.isArray(config.evidencePassages)&&config.evidencePassages.length){var evidenceGrid=document.createElement("div");evidenceGrid.className="dynamic-overlay-evidence-grid";config.evidencePassages.forEach(function(passage){var legacyQuote=document.createElement("blockquote");legacyQuote.className="dynamic-overlay-evidence-block is-"+String(passage.sourceType||"other").replace(/[^a-z0-9_-]/gi,"");legacyQuote.dataset.passageRole=passage.role||"narration";var typeLabel=passage.sourceType==="quran"?"Dalil Al-Qur’an":passage.sourceType==="hadith"?"Riwayat Hadis":"Sumber";appendLine(legacyQuote,"dynamic-overlay-evidence-badge",typeLabel,{tag:"small"});appendLine(legacyQuote,"dynamic-overlay-evidence-source",passage.sourceLabel,{tag:"small"});appendLine(legacyQuote,"dynamic-overlay-evidence-intro",passage.intro,{tag:"strong"});appendLine(legacyQuote,"dynamic-overlay-evidence-arabic",passage.arabic,{lang:"ar",dir:"rtl"});appendLine(legacyQuote,"dynamic-overlay-evidence-latin",passage.latin);appendLine(legacyQuote,"dynamic-overlay-evidence-translation",passage.translation?"Artinya: "+passage.translation:"");evidenceGrid.appendChild(legacyQuote);});sceneCopy.appendChild(evidenceGrid);}
      if(sequenceFlow){var flowTrail=document.createElement("div");flowTrail.className="dynamic-overlay-worship-flow-trail";[flowLabels.evidence||"1 · Dalil",flowLabels.explanation||"2 · Penjelasan dan praktik",flowLabels.illustration||"3 · Ilustrasi penerapan"].forEach(function(labelText,index){var step=document.createElement("span"),active=config.flowPhase==="evidence"?index===0:index>0;step.textContent=labelText;step.dataset.flowStep=String(index+1);step.classList.toggle("is-active",active);flowTrail.appendChild(step);});item.appendChild(flowTrail);}
      if(sceneCopy.childElementCount){item.appendChild(sceneCopy);}if(sequenceFlow&&sceneMedia){item.appendChild(sceneFigure);}
    } else if (widget.widgetType === "persistent_prayer") {
      item.classList.add("dynamic-overlay-persistent-prayer");
      var fields=Array.isArray(config.fields)?config.fields:["prayer_name","adzan_time","actual_time","remaining"],prayerParts=[];
      if(fields.indexOf("prayer_name")>=0&&snapshot&&snapshot.nextPrayerLabel){prayerParts.push(snapshot.nextPrayerLabel);}
      if(fields.indexOf("adzan_time")>=0&&snapshot&&snapshot.nextPrayerTime){prayerParts.push(snapshot.nextPrayerTime);}
      appendLine(item,"dynamic-overlay-persistent-prayer-main",prayerParts.join(" "),{tag:"strong"});
      if(fields.indexOf("remaining")>=0&&snapshot&&snapshot.nextPrayerCountdown){appendLine(item,"dynamic-overlay-persistent-prayer-remaining",snapshot.nextPrayerCountdown+" lagi");}
      if(fields.indexOf("actual_time")>=0&&snapshot&&snapshot.clockText){appendLine(item,"dynamic-overlay-persistent-prayer-clock",snapshot.clockText,{tag:"time"});}
    } else if (widget.widgetType === "funeral_guide") {
      item.classList.add("dynamic-overlay-funeral-guide");
      var mediaUrl=safeUrl(config.mediaUrl),figure=document.createElement("figure"),copy=document.createElement("div"),guideImage=document.createElement("img");
      figure.className="dynamic-overlay-funeral-media";copy.className="dynamic-overlay-funeral-copy";
      if(mediaUrl){guideImage.src=mediaUrl;guideImage.alt="Ilustrasi "+String(config.illustrationNumber||"")+": "+String(config.movementName||"");figure.appendChild(guideImage);}
      appendLine(figure,"dynamic-overlay-funeral-counter",String(config.sequenceOrder||1)+" / "+String(config.totalSteps||1)+" · gambar "+String(config.illustrationNumber||""),{tag:"figcaption"});
      appendLine(copy,"dynamic-overlay-funeral-stage",config.takbirNumber?"Takbir "+config.takbirNumber:(config.isCoreStep===false?"Opsional setelah salat":"Tahap panduan"));
      appendLine(copy,"dynamic-overlay-funeral-movement",config.movementName,{tag:"h3"});
      appendLine(copy,"dynamic-overlay-widget-body",config.movementDescription);
      appendLine(copy,"dynamic-overlay-funeral-reading-title",config.readingTitle,{tag:"strong"});
      appendLine(copy,"dynamic-overlay-widget-arabic",config.arabic,{lang:"ar",dir:"rtl"});
      appendLine(copy,"dynamic-overlay-widget-latin",config.latin);
      appendLine(copy,"dynamic-overlay-widget-translation",config.translation);
      appendLine(copy,"dynamic-overlay-widget-meta",config.instruction);
      item.append(figure,copy);
    } else if (widget.widgetType === "clock") {
      var clockStyle = config.clockStyle || "digital";
      if (clockStyle === "analog" || clockStyle === "both") {
        var analog = document.createElement("div");analog.className="dynamic-overlay-analog-clock";analog.setAttribute("aria-label",snapshot && snapshot.clockText || "Jam analog");
        var clockParts=String(snapshot && snapshot.clockText||"").match(/(\d{1,2})\D(\d{2})(?:\D(\d{2}))?/),hour=clockParts?Number(clockParts[1]):0,minute=clockParts?Number(clockParts[2]):0,second=clockParts?Number(clockParts[3]||0):0;
        [["hour",hour*30+minute*.5],["minute",minute*6+second*.1],["second",second*6]].forEach(function(hand){var node=document.createElement("span");node.className="dynamic-overlay-clock-hand "+hand[0];node.style.transform="translateX(-50%) rotate("+hand[1]+"deg)";analog.appendChild(node);});item.appendChild(analog);
      }
      if (clockStyle !== "analog") { appendLine(item,"dynamic-overlay-widget-body",widgetValue(widget,snapshot)); }
      appendLine(item,"dynamic-overlay-widget-meta",[snapshot&&snapshot.timezone,snapshot&&snapshot.gregorianDate,snapshot&&snapshot.hijriDate].filter(Boolean).join(" · "));
    } else if (widget.widgetType === "media") {
      var mediaUrl=safeUrl(config.mediaUrl),mediaKind=config.mediaKind||"image",mediaNode;
      if(mediaUrl&&mediaKind==="video"){mediaNode=document.createElement("video");mediaNode.src=mediaUrl;mediaNode.muted=true;mediaNode.loop=config.loop!==false;mediaNode.autoplay=true;mediaNode.playsInline=true;mediaNode.controls=config.controls===true;mediaNode.play().catch(function(){});}
      else if(mediaUrl){mediaNode=document.createElement("img");mediaNode.src=mediaUrl;mediaNode.alt=config.alt||config.label||"Media overlay";}
      if(mediaNode){mediaNode.className="dynamic-overlay-widget-media-element";mediaNode.addEventListener("error",function(){mediaNode.hidden=true;appendLine(item,"dynamic-overlay-widget-body",config.fallbackText||"Media belum dapat ditampilkan.");});item.appendChild(mediaNode);}else{appendLine(item,"dynamic-overlay-widget-body",config.body||"Media mengikuti background overlay.");}
    } else if (widget.widgetType === "quran") {
      if(config.showArabic!==false){appendLine(item, "dynamic-overlay-widget-arabic", config.arabic, { lang: "ar", dir: "rtl" });}
      if(config.showLatin!==false){appendLine(item, "dynamic-overlay-widget-latin", config.latin);}
      if(config.showTranslation!==false){appendLine(item, "dynamic-overlay-widget-translation", config.translation || config.body);}
    } else if (widget.widgetType === "tafsir") {
      appendLine(item, "dynamic-overlay-widget-body", config.tafsirText || config.body);
      appendLine(item, "dynamic-overlay-widget-meta", config.mufassir ? "Tafsir: " + config.mufassir : "");
    } else if (widget.widgetType === "hadith") {
      appendLine(item, "dynamic-overlay-widget-body", config.hadithText || config.body);
      appendLine(item, "dynamic-overlay-widget-meta", config.reference ? "Rujukan: " + config.reference : "");
    } else {
      appendLine(item, "dynamic-overlay-widget-body", widgetValue(widget, snapshot));
    }
    if (widget.widgetType === "ticker") { item.classList.add("is-ticker"); }
    var sources=Array.isArray(widget.sources)?widget.sources.filter(function(entry){return entry&&(entry.name||entry.url||entry.note);}):[],source = widget.source || {};
    if(!sources.length&&(source.name||source.url||source.note||config.sourceName||config.sourceUrl)){sources=[{name:source.name||source.note||config.sourceName,url:source.url||config.sourceUrl,note:source.note||""}];}
    if(sources.length){var sourceList=document.createElement("div");sourceList.className="dynamic-overlay-widget-sources";sources.forEach(function(entry){var sourceUrl=safeUrl(entry.url),citation=document.createElement(sourceUrl?"a":"small"),sourceType=entry.sourceType==="quran"?"Al-Qur’an":entry.sourceType==="hadith"?"Hadis":"Sumber";citation.className="dynamic-overlay-widget-source is-"+String(entry.sourceType||"other");citation.textContent=(entry.name||entry.note||sourceType);if(sourceUrl){citation.href=sourceUrl;citation.target="_blank";citation.rel="noopener noreferrer";}sourceList.appendChild(citation);});item.appendChild(sourceList);}
    return item;
  }

  function widgetsForCandidates(candidates, layer) {
    var seen = {};
    var rows = [];
    (candidates || []).forEach(function (candidate) {
      (candidate.widgets || []).filter(function (widget) { return widget.isEnabled !== false && (widget.layerKey || candidate.layerKey || "main") === layer; }).forEach(function (widget) {
        var key = candidate.candidateKey + ":" + (widget.widgetKey || widget.widgetType);
        if (!seen[key]) { seen[key] = true; rows.push(widget); }
      });
    });
    return rows.sort(function (a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); });
  }

  function renderWidgets(host, candidates, snapshot, layer, append) {
    if (!host) { return; }
    if (!append) { host.replaceChildren(); }
    widgetsForCandidates(candidates, layer).forEach(function (widget) { host.appendChild(renderWidget(widget, snapshot)); });
    host.hidden = !host.childElementCount;
  }

  function renderCard(candidate, className) {
    var content = candidate && candidate.content || {};
    var card = document.createElement("article");
    card.className = className;
    card.dataset.candidateKey = candidate.candidateKey || "";
    appendLine(card, "dynamic-overlay-eyebrow", content.eyebrow);
    appendLine(card, "dynamic-overlay-layer-title", content.title, { tag: "h2" });
    appendLine(card, "dynamic-overlay-layer-subtitle", content.subtitle);
    appendLine(card, "dynamic-overlay-layer-body", content.bodyText);
    appendLine(card, "dynamic-overlay-layer-additional", content.additionalText);
    return card;
  }

  var DEFAULT_CARD_STYLE={backgroundColor:"#102a25",backgroundImage:"",backgroundGradient:"",opacity:.78,backdropBlur:14,borderColor:"#ffffff",borderOpacity:.22,borderWidth:1,borderRadius:24,boxShadow:"0 28px 80px rgba(0,0,0,.32)",padding:"clamp(.6rem,min(4vw,4dvh),4rem)",textColor:"#ffffff",titleColor:"#ffffff",subtitleColor:"#ffffff",arabicColor:"#ffffff",latinColor:"#e7f5f0",translationColor:"#ffffff",sourceColor:"#bff9e9"};
  function safeColor(value,fallback){var color=text(value);return /^#[0-9a-f]{6}$/i.test(color)?color:fallback;}
  function bounded(value,min,max,fallback){var number=Number(value);return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;}
  function safeCssValue(value,fallback){var result=text(value);return result&&!/[{};<>]/.test(result)&&!/url\s*\(/i.test(result)?result:fallback;}
  function rgba(hex,opacity){var match=safeColor(hex,"#ffffff").match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);return "rgba("+parseInt(match[1],16)+","+parseInt(match[2],16)+","+parseInt(match[3],16)+","+bounded(opacity,0,1,1)+")";}
  function cardBackground(style){var layers=[],gradient=safeCssValue(style.backgroundGradient,"");if(/^(?:linear|radial|conic)-gradient\(/i.test(gradient)){layers.push(gradient);}var image=safeUrl(style.backgroundImage);if(image){layers.push('url("'+image.replace(/"/g,"\\\"")+'")');}layers.push(safeColor(style.backgroundColor,"#102a25"));return layers.join(", ");}

  function applyLayout(candidate) {
    var root = byId("dynamicOverlayRoot");
    if (!root || !candidate) { return; }
    var content = candidate.content || {};
    var layout = candidate.layout || {};
    root.style.setProperty("--overlay-x", Number(layout.xPercent === undefined ? 50 : layout.xPercent) + "%");
    root.style.setProperty("--overlay-y", Number(layout.yPercent === undefined ? 50 : layout.yPercent) + "%");
    root.style.setProperty("--overlay-width", Number(layout.widthPercent === undefined ? 86 : layout.widthPercent) + "%");
    root.style.setProperty("--overlay-height", Number(layout.heightPercent === undefined ? 78 : layout.heightPercent) + "%");
    root.style.setProperty("--overlay-image-fit", layout.imageFit || "cover");
    root.style.setProperty("--overlay-image-position", layout.imagePosition || "center center");
    var imageScale = Number(layout.settings && layout.settings.imageScalePercent);
    if (!Number.isFinite(imageScale)) { imageScale = 100; }
    root.style.setProperty("--overlay-image-scale", String(Math.max(100, Math.min(300, imageScale)) / 100));
    root.style.setProperty("--overlay-image-opacity", Number(layout.imageOpacity === undefined ? 1 : layout.imageOpacity));
    root.style.setProperty("--overlay-tint", layout.tintColor || "#081b18");
    root.style.setProperty("--overlay-tint-opacity", Number(layout.tintOpacity === undefined ? 0.52 : layout.tintOpacity));
    var runtimeConfig=window.OverlayManager&&typeof window.OverlayManager.getConfig==="function"?window.OverlayManager.getConfig():null;
    var cardStyle=Object.assign({},DEFAULT_CARD_STYLE,runtimeConfig&&runtimeConfig.globalCardStyle||{},candidate.settings&&candidate.settings.globalCardStyle||{},layout.settings&&layout.settings.cardStyle||{});
    if(!layout.settings||!layout.settings.cardStyle){cardStyle.backgroundColor=layout.cardBackground||cardStyle.backgroundColor;cardStyle.opacity=layout.cardOpacity===undefined?cardStyle.opacity:layout.cardOpacity;}
    root.style.setProperty("--overlay-card",safeColor(cardStyle.backgroundColor,"#102a25"));
    root.style.setProperty("--overlay-card-background",cardBackground(cardStyle));
    root.style.setProperty("--overlay-card-opacity",bounded(cardStyle.opacity,0,1,.78));
    root.style.setProperty("--overlay-card-backdrop-blur",bounded(cardStyle.backdropBlur,0,80,14)+"px");
    root.style.setProperty("--overlay-card-border",rgba(cardStyle.borderColor,cardStyle.borderOpacity));
    root.style.setProperty("--overlay-card-border-width",bounded(cardStyle.borderWidth,0,20,1)+"px");
    root.style.setProperty("--overlay-card-radius",bounded(cardStyle.borderRadius,0,160,24)+"px");
    root.style.setProperty("--overlay-card-shadow",safeCssValue(cardStyle.boxShadow,DEFAULT_CARD_STYLE.boxShadow));
    root.style.setProperty("--overlay-card-padding",safeCssValue(cardStyle.padding,DEFAULT_CARD_STYLE.padding));
    root.style.setProperty("--overlay-card-text",safeColor(cardStyle.textColor,"#ffffff"));
    root.style.setProperty("--overlay-card-title",safeColor(cardStyle.titleColor,"#ffffff"));
    root.style.setProperty("--overlay-card-subtitle",safeColor(cardStyle.subtitleColor,"#ffffff"));
    root.style.setProperty("--overlay-card-arabic",safeColor(cardStyle.arabicColor,"#ffffff"));
    root.style.setProperty("--overlay-card-latin",safeColor(cardStyle.latinColor,"#e7f5f0"));
    root.style.setProperty("--overlay-card-translation",safeColor(cardStyle.translationColor,"#ffffff"));
    root.style.setProperty("--overlay-card-source",safeColor(cardStyle.sourceColor,"#bff9e9"));
    root.style.setProperty("--overlay-text-align", content.textAlign || "center");
    root.style.setProperty("--overlay-font-family", content.fontFamily || "Arial, Helvetica, sans-serif");
    root.style.setProperty("--overlay-title-size", content.titleSizeClamp || "clamp(2rem, 7vw, 6rem)");
    root.style.setProperty("--overlay-body-size", content.bodySizeClamp || "clamp(1rem, 2.4vw, 1.7rem)");
    root.dataset.anchor = layout.anchorKey || "center";
    root.dataset.animation = candidate.animation || "fade";
    root.classList.toggle("is-funeral-presentation",Boolean(candidate.metadata&&candidate.metadata.funeralPresentation));
    root.classList.toggle("is-worship-education",Boolean(candidate.metadata&&candidate.metadata.worshipEducation));
    root.classList.toggle("is-one-viewport",Boolean(candidate.metadata&&candidate.metadata.oneViewport||candidate.settings&&candidate.settings.oneViewport));
    var panel = byId("dynamicOverlayContent");
    if (panel) { panel.classList.toggle("without-card", layout.showCard === false); }
  }

  function renderPrayerContext(candidate){
    var host=byId("dynamicOverlayPrayerContext"),context=candidate&&candidate.metadata&&candidate.metadata.timeContext;if(!host){return;}
    host.replaceChildren();if(!context){host.hidden=true;return;}var language=context.language==="en"?"en":"id";
    function add(label,main,meta){if(!main){return;}var item=document.createElement("section");item.className="dynamic-overlay-prayer-context-item";appendLine(item,"",label,{tag:"small"});appendLine(item,"",main,{tag:"strong"});appendLine(item,"",meta);host.appendChild(item);}
    add(language==="en"?"Current prayer range":"Masih waktu salat",context.currentPrayerLabel,context.periodRange);
    add(language==="en"?"Current worship period":"Waktu ibadah saat ini",context.currentLabel,context.sourceName?((language==="en"?"Falak: ":"Falak: ")+context.sourceName):"");
    add(language==="en"?"Towards the next obligatory prayer":"Menuju salat fardu",(language==="en"?"Towards ":"Menuju ")+(context.nextFardhuLabel||"-"),[context.nextFardhuTime,context.nextFardhuRemaining].filter(Boolean).join(" · "));
    host.hidden=!host.childElementCount;
  }

  function renderMain(candidate, allCandidates, snapshot) {
    var root = byId("dynamicOverlayRoot");
    var panel = byId("dynamicOverlayContent");
    var content = candidate && candidate.content || {};
    var settings = candidate && candidate.settings || {};
    var hasContent = candidate && ["eyebrow", "title", "subtitle", "bodyText", "additionalText"].some(function (key) { return text(content[key]); });
    if (panel) { panel.hidden = !candidate || settings.showContent === false || !hasContent; }
    setText("dynamicOverlayEyebrow", content.eyebrow);
    setText("dynamicOverlayTitle", content.title);
    setText("dynamicOverlaySubtitle", content.subtitle);
    setText("dynamicOverlayBody", content.bodyText);
    setText("dynamicOverlayAdditional", content.additionalText);
    var sceneProgress=byId("dynamicOverlaySceneProgress"),metadata=candidate&&candidate.metadata||{};
    if(sceneProgress&&metadata.sequenceItemTotal&&metadata.showPageIndicator!==false){
      var remainingSeconds=Math.max(0,Math.ceil(Number(metadata.sequenceItemRemainingMs||0)/1000));
      sceneProgress.textContent=[metadata.displayLabel||metadata.topicTitle||"Materi",String(Math.floor(remainingSeconds/60)).padStart(2,"0")+":"+String(remainingSeconds%60).padStart(2,"0")].filter(Boolean).join(" · ");
      sceneProgress.hidden=false;
    }else if(sceneProgress){sceneProgress.hidden=true;sceneProgress.textContent="";}
    setText("dynamicOverlayClock", snapshot && snapshot.clockText);
    setText("dynamicOverlayGregorian", snapshot && snapshot.gregorianDate);
    setText("dynamicOverlayHijri", snapshot && snapshot.hijriDate);
    var clock = byId("dynamicOverlayClock");
    var dates = byId("dynamicOverlayDates");
    var timebar = root && root.querySelector(".dynamic-overlay-timebar");
    renderPrayerContext(candidate);
    if (clock) { clock.hidden = candidate ? settings.showClock === false : true; }
    if (dates) { dates.hidden = candidate ? settings.showDates === false : true; }
    if (timebar) { timebar.hidden = !candidate || settings.showClock === false && settings.showDates === false; }
    renderWidgets(byId("dynamicOverlayWidgets"), allCandidates, snapshot, "main", false);
  }

  function renderLayers(layerMap, snapshot, now) {
    var root = byId("dynamicOverlayRoot");
    if (!root) { return; }
    var layers = layerMap || {};
    var background = (layers.background || [])[0] || (layers.main || [])[0] || (layers.alert || [])[0] || null;
    var main = (layers.main || [])[0] || null;
    var primary = (layers.alert || [])[0] || main || (layers.persistent || [])[0] || background;
    var all = [].concat(layers.background || [], layers.persistent || [], layers.main || [], layers.alert || []);
    if (!primary && !all.length) { hide(); return; }

    applyLayout(main || primary);
    renderMedia(background || primary);
    renderMain(main, all, snapshot || {});
    renderWidgets(byId("dynamicOverlayPersistentLayer"), all, snapshot || {}, "persistent", false);

    var stackHost = byId("dynamicOverlayStackLayer");
    if (stackHost) {
      stackHost.replaceChildren();
      (layers.main || []).slice(1).forEach(function (candidate) { stackHost.appendChild(renderCard(candidate, "dynamic-overlay-stack-card")); });
      renderWidgets(stackHost, all, snapshot || {}, "background", true);
      stackHost.hidden = !stackHost.childElementCount;
    }

    var alertHost = byId("dynamicOverlayAlertLayer");
    if (alertHost) {
      alertHost.replaceChildren();
      (layers.alert || []).forEach(function (candidate) { alertHost.appendChild(renderCard(candidate, "dynamic-overlay-alert-card")); });
      renderWidgets(alertHost, all, snapshot || {}, "alert", true);
      alertHost.hidden = !alertHost.childElementCount;
    }

    var compositeKey = all.map(function (candidate) { return candidate.candidateKey; }).join("|");
    root.dataset.candidateKey = primary && primary.candidateKey || "";
    root.dataset.activeLayers = ["background", "persistent", "main", "alert"].filter(function (layer) { return (layers[layer] || []).length; }).join(" ");
    root.dataset.renderedAt = now instanceof Date ? now.toISOString() : new Date().toISOString();
    if (root.hidden || currentCompositeKey !== compositeKey) {
      root.hidden = false;
      root.classList.remove("is-active");
      window.requestAnimationFrame(function () { root.classList.add("is-active"); });
    }
    root.setAttribute("aria-hidden", "false");
    currentCompositeKey = compositeKey;
  }

  function render(candidate, snapshot, now) {
    if (!candidate) { hide(); return; }
    var map = { background: [], persistent: [], main: [], alert: [] };
    map[candidate.layerKey || "main"].push(candidate);
    renderLayers(map, snapshot, now);
  }

  function hide() {
    var root = byId("dynamicOverlayRoot");
    resetMedia();
    if (!root) { return; }
    root.classList.remove("is-active");
    root.setAttribute("aria-hidden", "true");
    root.hidden = true;
    currentCompositeKey = "";
  }

  window.OverlayRenderer = { render: render, renderLayers: renderLayers, hide: hide };
})(window, document);
