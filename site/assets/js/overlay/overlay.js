(function (window, document) {
  "use strict";

  var state = {
    snapshot: null,
    selectedKey: "fardhu-sequence",
    editingTriggers: [],
    editingSequences: [],
    editingScopes: [],
    editingWidgets: [],
    dragSequenceIndex: null,
    renderedDefinitionKey: "",
    pendingMediaId: null,
    pendingBackgroundPath: "",
    uploadPreviewUrl: "",
    editorDrag: null
  };
  var PRAYER_KEYS = ["subuh","dhuhur","ashar","maghrib","isha"];
  var DHUHA_KEYS = ["dhuhaAwwal","dhuhaWoosthaa","dhuhaAwwabin"];
  var QIYAMUL_STATES = ["first_reminder","last_third_warning","last_third_recurring","fajr_preparation"];
  var FRIDAY_STATES = ["information","prayer"];
  var WIDGET_LABELS = {clock:"Jam",prayer_schedule:"Jadwal sholat",media:"Media",text:"Teks",ticker:"Running text",announcement:"Pengumuman",fyi:"FYI / kartu informasi",quran:"Al-Qur'an",tafsir:"Tafsir",hadith:"Hadis",islamic_calendar:"Kalender Islam",fasting:"Pengingat puasa",sunnah_prayer:"Sholat sunnah",weather:"Cuaca",webgis:"WebGIS",astronomy:"Astronomi",emergency:"Darurat",bereavement:"Kabar duka"};
  var PRESETS = {
    fullscreen_media:{label:"Fullscreen Media",type:"image",priority:120,layer:"background",conflict:"replace",settings:{showBackground:true,showContent:false,showClock:false,showDates:false},widgets:[]},
    countdown:{label:"Countdown",type:"custom",priority:500,layer:"main",conflict:"replace",settings:{showBackground:false,showContent:true,showClock:true,showDates:false},widgets:["clock","prayer_schedule"]},
    announcement:{label:"Announcement",type:"announcement",priority:520,layer:"main",conflict:"queue",settings:{showBackground:true,showContent:true,showClock:true,showDates:true},widgets:["announcement"]},
    quran:{label:"Quran",type:"quran",priority:430,layer:"main",conflict:"queue",settings:{showBackground:true,showContent:false,showClock:true,showDates:false},widgets:["quran"]},
    prayer_reminder:{label:"Prayer Reminder",type:"custom",priority:650,layer:"main",conflict:"replace",settings:{showBackground:true,showContent:true,showClock:true,showDates:true},widgets:["prayer_schedule"]},
    fyi:{label:"FYI",type:"announcement",priority:300,layer:"main",conflict:"rotate",settings:{showBackground:false,showContent:true,showClock:true,showDates:true},widgets:["fyi"]},
    emergency:{label:"Emergency",type:"emergency",priority:950,layer:"alert",conflict:"replace",settings:{showBackground:false,showContent:true,showClock:true,showDates:true},widgets:["emergency"]},
    minimal_clock:{label:"Minimal Clock",type:"custom",priority:100,layer:"persistent",conflict:"stack",settings:{showBackground:false,showContent:false,showClock:false,showDates:false},widgets:["clock"]},
    video_countdown:{label:"Video + Countdown",type:"custom",priority:560,layer:"main",conflict:"replace",settings:{showBackground:true,showContent:true,showClock:true,showDates:false,videoLoop:true},widgets:["prayer_schedule"]},
    image_countdown:{label:"Image + Countdown",type:"custom",priority:540,layer:"main",conflict:"replace",settings:{showBackground:true,showContent:true,showClock:true,showDates:false},widgets:["prayer_schedule"]},
    information_prayer:{label:"Information + Prayer Time",type:"announcement",priority:420,layer:"main",conflict:"rotate",settings:{showBackground:true,showContent:true,showClock:true,showDates:true},widgets:["announcement","prayer_schedule"]}
  };
  var SELECT_LABELS = {
    definitionType:{prayer_sequence:"Rangkaian sholat",friday_sequence:"Rangkaian Jumat",qiyamul_sequence:"Rangkaian Qiyamul",dhuha_sequence:"Rangkaian Dhuha",custom:"Tampilan bebas",announcement:"Pengumuman",emergency:"Darurat",astronomy:"Astronomi",weather:"Cuaca",image:"Media/background",hijri_reminder:"Pengingat Hijriah",death:"Kabar duka",janazah:"Sholat Jenazah",ghaib:"Sholat Ghaib",tutorial:"Tutorial",wudhu:"Panduan wudhu",tayammum:"Panduan tayamum",quran:"Al-Qur'an"},
    triggerType:{absolute_datetime:"Tanggal dan jam tertentu",daily_time:"Setiap hari pada jam tertentu",permanent:"Selalu tampil",weekday:"Hari tertentu setiap pekan",date_range:"Rentang tanggal/jam",repeat_interval:"Berulang setiap interval",prayer_time:"Tepat waktu sholat",before_prayer:"Sebelum waktu sholat",after_prayer:"Sesudah waktu sholat",prayer_phase:"Selama fase sholat",relative_phase:"Relatif terhadap fase",hijri_date:"Tanggal Hijriah",hijri_range:"Rentang tanggal Hijriah",gregorian_date:"Tanggal Masehi",gregorian_range:"Rentang tanggal Masehi",calendar_event:"Event kalender Islam",astronomical_event:"Peristiwa astronomi",manual:"Hanya saat admin menekan tampilkan",emergency:"Perintah darurat",dhuha_phase:"Fase Dhuha",weather_event:"Kondisi cuaca",condition:"Kondisi data",external_api:"Event eksternal terverifikasi"}
  };

  function byId(id) { return document.getElementById(id); }
  function canonicalDisplayTerminology(text){return String(text==null?"":text).replace(/\b(?:sholat|shalat|solat)\b/gi,function(word){return word.charAt(0)===word.charAt(0).toUpperCase()?"Salat":"salat";}).replace(/\bGhaib\b/g,"Gaib");}
  function normalizeVisibleTerminology(root){
    if(!root){return;}
    if(root.nodeType===Node.TEXT_NODE){var parent=root.parentElement;if(parent&&!parent.closest("[data-i18n],[lang=ar],[translate=no],[data-no-i18n]")&&!/^(?:SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/.test(parent.tagName)){var normalized=canonicalDisplayTerminology(root.nodeValue);if(normalized!==root.nodeValue){root.nodeValue=normalized;}}return;}
    if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE){return;}
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode()){nodes.push(walker.currentNode);}nodes.forEach(normalizeVisibleTerminology);
    if(root.nodeType===Node.ELEMENT_NODE){[root].concat(Array.prototype.slice.call(root.querySelectorAll("[placeholder],[title],[aria-label]"))).forEach(function(element){["placeholder","title","aria-label"].forEach(function(name){if(element.hasAttribute(name)){var current=element.getAttribute(name),normalized=canonicalDisplayTerminology(current);if(normalized!==current){element.setAttribute(name,normalized);}}});});}
  }
  function observeVisibleTerminology(){normalizeVisibleTerminology(document.body);new MutationObserver(function(mutations){mutations.forEach(function(mutation){if(mutation.type==="characterData"){normalizeVisibleTerminology(mutation.target);}else{Array.prototype.forEach.call(mutation.addedNodes,normalizeVisibleTerminology);}});}).observe(document.body,{subtree:true,childList:true,characterData:true});}
  function value(id) { return byId(id).value; }
  function checked(id) { return byId(id).checked; }
  function number(id, fallback) { var result = Number(value(id)); return Number.isFinite(result) ? result : fallback; }
  function token() { return value("overlayAdminToken").trim(); }
  function headers(json) {
    var result = {};
    if (json) { result["Content-Type"] = "application/json"; }
    if (token()) { result["X-Admin-Token"] = token(); }
    result["X-Actor-Id"] = "feature-background-image-and-overlay-customizer";
    result["X-Client-Request-Id"] = "overlay-" + Date.now() + "-" + Math.random().toString(16).slice(2);
    return result;
  }
  function status(message, type) {
    var element = byId("overlayAdminStatus");
    element.textContent = window.PrayerI18n.uiText(message);
    element.classList.toggle("is-error", type === "error");
    element.classList.toggle("is-success", type === "success");
  }
  function notifyCustomizer(name, section, detail) {
    window.dispatchEvent(new CustomEvent("mpm:customizer-" + name, { detail: Object.assign({ section: section || "" }, detail || {}) }));
  }
  function request(url, options) {
    return window.fetch(url, options || {}).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok || !payload || payload.success !== true) {
          throw new Error((payload && payload.error) || ("HTTP " + response.status));
        }
        return payload.data;
      });
    });
  }
  function post(body) {
    return request("api/overlays.php", { method: "POST", cache: "no-store", headers: headers(true), body: JSON.stringify(body) });
  }
  function selectedDefinition() {
    return state.snapshot && state.snapshot.definitions.find(function (item) { return item.overlayKey === state.selectedKey; });
  }
  function escapeText(value) { return String(value === undefined || value === null ? "" : value); }
  function clamp(value, minimum, maximum, fallback) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) { parsed = fallback; }
    return Math.max(minimum, Math.min(maximum, parsed));
  }
  var CARD_STYLE_IDS={backgroundColor:"CardBackgroundColor",backgroundImage:"CardBackgroundImage",backgroundGradient:"CardBackgroundGradient",opacity:"CardOpacity",backdropBlur:"CardBackdropBlur",borderColor:"CardBorderColor",borderOpacity:"CardBorderOpacity",borderWidth:"CardBorderWidth",borderRadius:"CardBorderRadius",boxShadow:"CardBoxShadow",padding:"CardPadding",textColor:"CardTextColor",titleColor:"CardTitleColor",subtitleColor:"CardSubtitleColor",arabicColor:"CardArabicColor",latinColor:"CardLatinColor",translationColor:"CardTranslationColor",sourceColor:"CardSourceColor"};
  function cardNode(prefix,key){var id=prefix+CARD_STYLE_IDS[key];if(prefix==="layout"&&key==="backgroundColor"){id="layoutCardColor";}return byId(id);}
  function renderCardStyle(prefix,style,fallback){var row=Object.assign({},fallback||{},style||{});Object.keys(CARD_STYLE_IDS).forEach(function(key){var node=cardNode(prefix,key);if(node){node.value=row[key]===undefined||row[key]===null?"":row[key];}});}
  function readCardStyle(prefix){var result={};Object.keys(CARD_STYLE_IDS).forEach(function(key){var node=cardNode(prefix,key);if(!node){return;}var raw=node.value.trim();if(["opacity","backdropBlur","borderOpacity","borderWidth","borderRadius"].indexOf(key)>=0){result[key]=Number(raw||0);}else{result[key]=raw;}});return result;}
  function mediaById(id) {
    var numericId = Number(id);
    return state.snapshot && (state.snapshot.media || []).find(function (item) { return Number(item.id) === numericId; });
  }
  function positionPart(value, axis) {
    var normalized = String(value || "").toLowerCase();
    var named = axis === "x" ? { left: 0, center: 50, right: 100 } : { top: 0, center: 50, bottom: 100 };
    if (Object.prototype.hasOwnProperty.call(named, normalized)) { return named[normalized]; }
    return clamp(parseFloat(normalized), 0, 100, 50);
  }
  function parseImagePosition(value) {
    var parts = String(value || "center center").trim().split(/\s+/);
    if (parts.length < 2) { parts.push("center"); }
    return { x: positionPart(parts[0], "x"), y: positionPart(parts[1], "y") };
  }
  function rounded(value) { return Math.round(Number(value) * 10) / 10; }
  function backgroundFilename(path) {
    var clean=String(path||"").split(/[?#]/)[0],parts=clean.split("/");
    try{return decodeURIComponent(parts[parts.length-1]||clean);}catch(error){return parts[parts.length-1]||clean;}
  }
  function mediaForPath(path){return state.snapshot&&(state.snapshot.media||[]).find(function(media){return media.publicUrl===path;});}
  function updateQuickBackgroundPreview(){
    var select=byId("quickBackgroundSelect"),media=mediaById(select.value),preview=byId("quickBackgroundPreview");
    byId("quickBackgroundInfo").textContent=media?(media.widthPx+" × "+media.heightPx+" · "+(media.isBundled?"Background bawaan":"Hasil upload")):"Belum ada background di database";
    preview.src=media?media.publicUrl:"";preview.hidden=!media;
    ["quickBackgroundEditButton","quickBackgroundUseButton","quickBackgroundDeleteButton"].forEach(function(id){byId(id).disabled=!media;});
  }
  function renderQuickBackgroundPicker(){
    var select=byId("quickBackgroundSelect"),previous=Number(state.pendingMediaId||select.value||value("definitionBackgroundMedia")),rows=state.snapshot&&state.snapshot.media||[];select.innerHTML="";
    rows.forEach(function(media){var option=document.createElement("option");option.value=media.id;option.textContent=media.originalName+(media.isBundled?" · Bawaan":" · Upload");select.appendChild(option);});
    if(previous&&rows.some(function(media){return Number(media.id)===previous;})){select.value=String(previous);}
    else if(rows.length){var subuh=rows.find(function(media){return /^subuh(?:\.|$)/i.test(media.originalName)||/\/subuh\.png$/i.test(media.publicUrl);});select.value=String((subuh||rows[0]).id);}
    updateQuickBackgroundPreview();
  }
  function editQuickBackground(){
    var media=mediaById(value("quickBackgroundSelect"));if(!media){return;}
    stageMedia(media.id);status('Mode edit: "'+media.originalName+'". Geser atau zoom gambar; konfigurasi database belum berubah.',"success");
  }
  function useQuickBackground(){var media=mediaById(value("quickBackgroundSelect"));if(!media){return;}state.pendingMediaId=Number(media.id);applySelectedBackground(false);}
  function deleteQuickBackground(){var media=mediaById(value("quickBackgroundSelect"));if(media){deleteMedia(media);}}
  function uploadQuickBackground(){var details=document.querySelector(".optional-media-settings");if(details){details.open=true;}byId("mediaUploadInput").click();}

  function load() {
    status("Memuat konfigurasi SQL...");
    var requestHeaders = headers(false);
    return request("api/overlays.php?admin=1", { cache: "no-store", headers: requestHeaders }).then(function (snapshot) {
      state.snapshot = snapshot;
      if (!selectedDefinition() && snapshot.definitions.length) { state.selectedKey = snapshot.definitions[0].overlayKey; }
      renderAll();
      status("Terhubung ke SQL · " + snapshot.definitions.length + " definisi · " + snapshot.prayerSettings.length + " state", "success");
      notifyCustomizer("loaded", "all");
    }).catch(function (error) {
      status("Gagal memuat: " + error.message + ". Isi admin token bila server mewajibkannya.", "error");
    });
  }

  function renderAll() {
    renderDefinitions();
    renderPrayerSettings();
    renderMedia();
    renderDefinitionForm();
    renderSuggestions();
    renderAudit();
    renderCardStyle("global",state.snapshot&&state.snapshot.globalCardStyle||{});
  }

  function renderSuggestions(){
    var host=byId("externalSuggestionList");if(!host||!state.snapshot){return;}host.replaceChildren();
    var rows=(state.snapshot.externalSuggestions||[]).filter(function(row){return ["pending","approved"].indexOf(row.status)>=0;});
    if(!rows.length){var empty=document.createElement("p");empty.className="form-help";empty.textContent="Belum ada saran menunggu review atau penjadwalan.";host.appendChild(empty);return;}
    rows.forEach(function(row){
      var card=document.createElement("article");card.className="suggestion-card";
      var title=document.createElement("strong");title.textContent=row.title;
      var payload={};try{payload=row.source_payload_json?JSON.parse(row.source_payload_json):{};}catch(error){}var detail=document.createElement("p");detail.textContent=(row.suggestion_type||"informasi")+" · "+(row.source_name||"sumber eksternal")+" · "+row.status+[payload.region,payload.verificationStatus,payload.occurredAt?"kejadian "+payload.occurredAt:""].filter(Boolean).map(function(value){return " · "+value;}).join("");
      var link=document.createElement("a");link.href=row.source_url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Periksa sumber";
      var approve=document.createElement("button");approve.type="button";approve.className="button button-secondary";approve.textContent="Tandai sudah ditinjau";approve.hidden=row.status!=="pending";
      var convert=document.createElement("button");convert.type="button";convert.className="button button-primary";convert.textContent="Buat overlay editable";
      var schedule=document.createElement("button");schedule.type="button";schedule.className="button button-secondary";schedule.textContent="Jadwalkan";
      var reject=document.createElement("button");reject.type="button";reject.className="button button-danger";reject.textContent="Abaikan";reject.hidden=row.status!=="pending";
      function review(decision){post({action:"review_suggestion",suggestionId:Number(row.id),status:decision,note:"Ditinjau dari Universal Overlay Customizer"}).then(function(snapshot){state.snapshot=snapshot;renderAll();status("Saran "+decision+".","success");}).catch(function(error){status("Review gagal: "+error.message,"error");});}
      function convertSuggestion(scheduled){
        var starts=null,ends=null,duration=120;if(scheduled){starts=window.prompt("Mulai (contoh 2026-08-21 17:00)",new Date(Date.now()+3600000).toISOString().slice(0,16));if(!starts){return;}duration=Number(window.prompt("Durasi tampil dalam detik","120")||120);ends=new Date(new Date(starts).getTime()+duration*1000).toISOString();}
        post({action:"convert_suggestion",suggestion:{suggestionId:Number(row.id),title:row.title,summaryText:row.summary_text,durationSeconds:duration,startsAtUtc:starts?new Date(starts).toISOString():null,endsAtUtc:ends,note:scheduled?"Admin menjadwalkan setelah memeriksa sumber.":"Admin membuat draft editable setelah memeriksa sumber."}}).then(function(snapshot){state.snapshot=snapshot;var converted=(snapshot.externalSuggestions||[]).find(function(item){return Number(item.id)===Number(row.id);});if(converted&&converted.converted_overlay_key){state.selectedKey=converted.converted_overlay_key;}state.renderedDefinitionKey="";renderAll();showPanel("definition");status("Saran diubah menjadi overlay editable. Periksa isi dan aktifkan bila sudah benar.","success");}).catch(function(error){status("Konversi saran gagal: "+error.message,"error");});
      }
      approve.addEventListener("click",function(){review("approved");});reject.addEventListener("click",function(){review("rejected");});convert.addEventListener("click",function(){convertSuggestion(false);});schedule.addEventListener("click",function(){convertSuggestion(true);});
      card.append(title,detail,link,approve,convert,schedule,reject);host.appendChild(card);
    });
  }

  function submitSuggestion(event){event.preventDefault();function iso(id){var raw=value(id);return raw?new Date(raw).toISOString():null;}post({action:"submit_suggestion",suggestion:{suggestionType:value("suggestionType"),title:value("suggestionTitle"),summaryText:value("suggestionSummary"),sourceName:value("suggestionSourceName"),sourceUrl:value("suggestionSourceUrl"),sourcePayload:{region:value("suggestionRegion")||null,occurredAt:iso("suggestionOccurredAt"),publishedAt:iso("suggestionPublishedAt"),updatedAt:iso("suggestionUpdatedAt"),verificationStatus:value("suggestionVerification"),capturedAt:new Date().toISOString()}}}).then(function(snapshot){state.snapshot=snapshot;byId("externalSuggestionForm").reset();renderSuggestions();renderAudit();status("Saran masuk antrean review. Belum ditampilkan ke publik.","success");}).catch(function(error){status("Saran ditolak: "+error.message,"error");});}

  function renderAudit(){var host=byId("overlayAuditList");if(!host||!state.snapshot){return;}host.replaceChildren();var rows=[].concat((state.snapshot.runtimeHistory||[]).map(function(row){return {at:row.created_at,label:(row.event_type||"runtime")+" · "+(row.overlay_key||"-")+" · "+(row.reason_code||"-")};}),(state.snapshot.auditLog||[]).map(function(row){return {at:row.created_at,label:(row.action||"change")+" · "+(row.entity_key||"-")+" · "+(row.actor_id||"system")};})).sort(function(a,b){return String(b.at).localeCompare(String(a.at));}).slice(0,100);if(!rows.length){var empty=document.createElement("p");empty.className="form-help";empty.textContent="Belum ada log konfigurasi atau runtime.";host.appendChild(empty);return;}rows.forEach(function(row){var item=document.createElement("div");item.className="audit-row";var when=document.createElement("time");when.textContent=row.at||"-";var label=document.createElement("span");label.textContent=row.label;item.append(when,label);host.appendChild(item);});}

  function renderDefinitions() {
    var container = byId("overlayDefinitionList");
    container.innerHTML = "";
    (state.snapshot.definitions || []).forEach(function (definition) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "definition-button" + (definition.overlayKey === state.selectedKey ? " is-active" : "");
      var strong = document.createElement("strong");
      strong.textContent = definition.nameId;
      var meta = document.createElement("span");
      meta.textContent = definition.overlayType + " · prioritas " + definition.priority + (definition.isEnabled ? " · aktif" : " · nonaktif");
      button.append(strong, meta);
      button.addEventListener("click", function () {
        state.selectedKey = definition.overlayKey;
        state.renderedDefinitionKey = "";
        state.pendingMediaId = null;
        state.pendingBackgroundPath = "";
        renderAll();
        notifyCustomizer("loaded", "definition", { selectedKey: state.selectedKey });
      });
      container.appendChild(button);
    });
  }

  function createCell(row, tag, text) {
    var cell = document.createElement(tag || "td");
    if (text !== undefined) { cell.textContent = text; }
    row.appendChild(cell);
    return cell;
  }

  function settingsByKey() {
    return (state.snapshot.prayerSettings || []).reduce(function (map, row) { map[row.prayerKey + ":" + row.stateKey] = row; return map; }, {});
  }

  function backgroundSelect(row, key) {
    var wrapper = document.createElement("div");
    wrapper.className = "background-path-editor";
    var input = document.createElement("select");
    input.dataset.settingField = "backgroundPath";
    input.dataset.settingKey = key;
    var none=document.createElement("option");none.value="";none.textContent="Tanpa background";input.appendChild(none);
    (state.snapshot.media||[]).forEach(function(media){var option=document.createElement("option");option.value=media.publicUrl;option.textContent=media.originalName+" · "+(media.categoryKey||"media");input.appendChild(option);});
    if(row.backgroundPath&&!Array.prototype.some.call(input.options,function(option){return option.value===row.backgroundPath;})){var legacy=document.createElement("option");legacy.value=row.backgroundPath;legacy.textContent="Background lama · "+backgroundFilename(row.backgroundPath);input.appendChild(legacy);}
    input.value=row.backgroundPath||"";
    var edit = document.createElement("button");
    edit.type = "button";
    edit.className = "button button-secondary";
    edit.textContent = "Edit visual";
    edit.addEventListener("click", function () {
      var path = input.value.trim();
      if (!path) { status("Pilih background terlebih dahulu.", "error"); return; }
      state.pendingMediaId = null;
      state.pendingBackgroundPath = path;
      showPanel("layout");
      renderQuickBackgroundPicker();
      byId("quickBackgroundSelect").value = path;
      updateQuickBackgroundPreview();
      renderBackgroundStudio();
      byId("backgroundEditorStage").scrollIntoView({ behavior: "smooth", block: "center" });
      status('Mengedit visual "' + backgroundFilename(path) + '". Perubahan posisi berlaku pada layout overlay terpilih.', "success");
    });
    wrapper.append(input, edit);
    return wrapper;
  }

  function renderPrayerSettings() {
    var map = settingsByKey();
    var prayerBody = byId("prayerSettingsBody");
    prayerBody.innerHTML = "";
    PRAYER_KEYS.forEach(function (prayerKey) {
      ["pre_adzan","adzan","iqamah","prayer"].forEach(function (stateKey) {
        var key = prayerKey + ":" + stateKey;
        var setting = map[key];
        if (!setting) { return; }
        var row = document.createElement("tr");
        row.dataset.settingKey = key;
        createCell(row,"td",setting.prayerLabelId);
        createCell(row,"td",setting.stateLabelId);
        var enabledCell=createCell(row); var enabled=document.createElement("input");enabled.type="checkbox";enabled.checked=setting.isEnabled;enabled.dataset.settingField="isEnabled";enabledCell.appendChild(enabled);
        var durationCell=createCell(row); var duration=document.createElement("input");duration.type="number";duration.min="0";duration.max="1440";duration.step="0.1";duration.value=String(setting.durationSeconds/60);duration.dataset.settingField="durationMinutes";durationCell.appendChild(duration);
        createCell(row).appendChild(backgroundSelect(setting,key));
        prayerBody.appendChild(row);
      });
    });
    var dhuhaBody=byId("dhuhaSettingsBody");dhuhaBody.innerHTML="";
    DHUHA_KEYS.forEach(function(prayerKey){
      var key=prayerKey+":phase";var setting=map[key];if(!setting){return;}
      var row=document.createElement("tr");row.dataset.settingKey=key;
      createCell(row,"td",setting.prayerLabelId);
      var enabledCell=createCell(row);var enabled=document.createElement("input");enabled.type="checkbox";enabled.checked=setting.isEnabled;enabled.dataset.settingField="isEnabled";enabledCell.appendChild(enabled);
      var displayCell=createCell(row);var display=document.createElement("input");display.type="number";display.min="5";display.max="3600";display.value=String(setting.displayDurationSeconds||30);display.dataset.settingField="displayDurationSeconds";displayCell.appendChild(display);
      var intervalCell=createCell(row);var interval=document.createElement("input");interval.type="number";interval.min="0.5";interval.max="1440";interval.step="0.5";interval.value=String((setting.reminderIntervalSeconds||1800)/60);interval.dataset.settingField="intervalMinutes";intervalCell.appendChild(interval);
      createCell(row).appendChild(backgroundSelect(setting,key));
      dhuhaBody.appendChild(row);
    });
    var qiyamulBody=byId("qiyamulSettingsBody");qiyamulBody.innerHTML="";
    QIYAMUL_STATES.forEach(function(stateKey){
      var key="qiyamulLail:"+stateKey;var setting=map[key];if(!setting){return;}
      var row=document.createElement("tr");row.dataset.settingKey=key;
      createCell(row,"td",setting.stateLabelId);
      var enabledCell=createCell(row);var enabled=document.createElement("input");enabled.type="checkbox";enabled.checked=setting.isEnabled;enabled.dataset.settingField="isEnabled";enabledCell.appendChild(enabled);
      var displayCell=createCell(row);var display=document.createElement("input");display.type="number";display.min="5";display.max="3600";display.value=String(setting.displayDurationSeconds||60);display.dataset.settingField="displayDurationSeconds";displayCell.appendChild(display);
      var anchorCell=createCell(row);
      if(stateKey==="first_reminder"){
        var anchor=document.createElement("select");anchor.dataset.settingField="primaryAnchor";
        [{value:"one_hour_before_midnight",label:"1 jam sebelum tengah malam Islami"},{value:"first_third_start",label:"Awal sepertiga malam pertama"}].forEach(function(item){var option=document.createElement("option");option.value=item.value;option.textContent=item.label;anchor.appendChild(option);});
        anchor.value=(setting.settings&&setting.settings.primaryAnchor)||"one_hour_before_midnight";anchorCell.appendChild(anchor);
      }else{
        anchorCell.textContent=stateKey==="last_third_warning"?"Sebelum sepertiga terakhir":stateKey==="last_third_recurring"?"Mulai sepertiga terakhir":"Sebelum Subuh";
      }
      var timingCell=createCell(row);var timing=document.createElement("input");timing.type="number";timing.min="0.5";timing.max="1440";timing.step="0.5";
      if(stateKey==="first_reminder"||stateKey==="last_third_warning"){
        timing.value=String((setting.settings&&setting.settings.leadMinutes)||60);timing.dataset.settingField="leadMinutes";timing.title="Jarak sebelum anchor (menit)";
      }else if(stateKey==="last_third_recurring"){
        timing.value=String((setting.reminderIntervalSeconds||900)/60);timing.dataset.settingField="intervalMinutes";timing.title="Interval reminder (menit)";
      }else{
        timing.value=String((setting.settings&&setting.settings.stopBeforeSubuhMinutes)||15);timing.dataset.settingField="stopBeforeSubuhMinutes";timing.title="Menit sebelum Subuh";
      }
      timingCell.appendChild(timing);
      createCell(row).appendChild(backgroundSelect(setting,key));
      qiyamulBody.appendChild(row);
    });
    var fridayBody=byId("fridaySettingsBody");fridayBody.innerHTML="";
    FRIDAY_STATES.forEach(function(stateKey){
      var key="jumat:"+stateKey;var setting=map[key];if(!setting){return;}
      var row=document.createElement("tr");row.dataset.settingKey=key;
      createCell(row,"td",setting.stateLabelId);
      var enabledCell=createCell(row);var enabled=document.createElement("input");enabled.type="checkbox";enabled.checked=setting.isEnabled;enabled.dataset.settingField="isEnabled";enabledCell.appendChild(enabled);
      var timingCell=createCell(row);var timing=document.createElement("input");timing.type="number";timing.min="0";timing.max="1440";timing.step="1";
      if(stateKey==="information"){
        timing.value=String((setting.settings&&setting.settings.stopBeforeDhuhurMinutes)||15);timing.dataset.settingField="stopBeforeDhuhurMinutes";timing.title="Informasi berhenti sekian menit sebelum Dzuhur";
      }else{
        timing.value=String((setting.durationSeconds||2700)/60);timing.dataset.settingField="durationMinutes";timing.title="Durasi pelaksanaan Jumat";
      }
      timingCell.appendChild(timing);
      createCell(row,"td",stateKey==="information"?"Selesai setelah rangkaian Subuh":"Mulai tepat waktu Dzuhur");
      createCell(row).appendChild(backgroundSelect(setting,key));
      fridayBody.appendChild(row);
    });
  }

  function readPrayerRows() {
    var original=settingsByKey();
    return Array.prototype.slice.call(document.querySelectorAll("tr[data-setting-key]")).map(function(row){
      var base=Object.assign({},original[row.dataset.settingKey]);base.settings=Object.assign({},base.settings||{});
      Array.prototype.slice.call(row.querySelectorAll("[data-setting-field]")).forEach(function(input){
        var field=input.dataset.settingField;
        if(field==="isEnabled"){base.isEnabled=input.checked;}
        else if(field==="durationMinutes"){base.durationSeconds=Math.round(Number(input.value||0)*60);}
        else if(field==="displayDurationSeconds"){base.displayDurationSeconds=Math.round(Number(input.value||30));}
        else if(field==="intervalMinutes"){base.reminderIntervalSeconds=Math.round(Number(input.value||30)*60);}
        else if(field==="leadMinutes"||field==="stopBeforeSubuhMinutes"||field==="stopBeforeDhuhurMinutes"){base.settings[field]=Number(input.value||0);}
        else if(field==="primaryAnchor"){base.settings.primaryAnchor=input.value;}
        else {base[field]=input.value.trim()||null;}
      });
      return base;
    });
  }

  function populateSelect(id, values) {
    var select=byId(id),labels=SELECT_LABELS[id]||{};select.innerHTML="";values.forEach(function(value){var option=document.createElement("option");option.value=value;option.textContent=labels[value]||String(value).replace(/_/g," ");select.appendChild(option);});
  }

  function renderPresetSelect(){var select=byId("overlayPresetSelect");if(!select||select.options.length){return;}Object.keys(PRESETS).forEach(function(key){var option=document.createElement("option");option.value=key;option.textContent=PRESETS[key].label;select.appendChild(option);});}
  function applyPreset(){
    var preset=PRESETS[value("overlayPresetSelect")];if(!preset){return;}
    byId("definitionType").value=preset.type;byId("definitionPriority").value=String(preset.priority);byId("definitionLayer").value=preset.layer;byId("definitionConflictMode").value=preset.conflict;byId("definitionPolicy").value=preset.conflict==="stack"?"stack":preset.conflict==="queue"?"queue":"pause";
    byId("componentShowBackground").checked=preset.settings.showBackground!==false;byId("componentShowContent").checked=preset.settings.showContent!==false;byId("componentShowClock").checked=preset.settings.showClock!==false;byId("componentShowDates").checked=preset.settings.showDates!==false;
    document.querySelectorAll('#widgetChecklist input[type="checkbox"]').forEach(function(input){input.checked=preset.widgets.indexOf(input.value)>=0;});syncWidgetsFromChecklist();
    if(!state.editingTriggers.length){state.editingTriggers=[{triggerKey:"always",triggerType:"permanent",prayerKey:null,offsetSeconds:0,durationSeconds:86400,localTime:null,startsAtUtc:null,endsAtUtc:null,gregorianMonth:null,gregorianDay:null,hijriMonth:null,hijriDay:null,hijriYear:null,astronomicalEvent:null,timezone:null,config:{},isEnabled:true}];renderTriggerList();}
    if(preset.type==="emergency"){byId("layoutTintColor").value="#5f1713";byId("layoutCardColor").value="#5f1713";byId("definitionInterruptible").checked=false;}
    renderBackgroundStudio();status('Preset "'+preset.label+'" diterapkan pada form. Periksa isinya lalu simpan ke SQL.',"success");
  }

  function renderDefinitionForm() {
    if(!state.snapshot){return;}
    renderPresetSelect();
    populateSelect("definitionType",state.snapshot.supportedOverlayTypes||[]);
    populateSelect("triggerType",state.snapshot.supportedTriggerTypes||[]);
    var definition=selectedDefinition();if(!definition){return;}
    byId("definitionKey").value=definition.overlayKey;
    byId("definitionKey").readOnly=Boolean(definition.isSystem);
    byId("definitionType").value=definition.overlayType;
    byId("definitionPriority").value=definition.priority;
    byId("definitionPolicy").value=definition.interruptionPolicy;
    byId("definitionConflictMode").value=definition.conflictMode||"replace";
    byId("definitionLayer").value=definition.layerKey||"main";
    byId("definitionLayerOrder").value=definition.layerOrder===undefined?100:definition.layerOrder;
    byId("definitionInterruptible").checked=definition.isInterruptible!==false;
    byId("definitionNameId").value=definition.nameId;
    byId("definitionNameEn").value=definition.nameEn;
    byId("definitionDuration").value=definition.defaultDurationSeconds;
    byId("definitionAnimation").value=definition.animation;
    byId("definitionEnabled").checked=definition.isEnabled;
    var scope=(definition.scopes||[])[0]||{scopeType:"GLOBAL"};state.editingScopes=(definition.scopes||[]).slice(1).map(function(row){return Object.assign({},row);});byId("scopeEffect").value=scope.scopeEffect||"include";byId("scopeType").value=scope.scopeType||"GLOBAL";byId("scopePageKey").value=scope.pageKey||"";byId("scopePrayerKey").value=scope.prayerKey||"";byId("scopePrayerGroup").value=scope.prayerGroup||"";byId("scopePhaseKey").value=scope.phaseKey||"";byId("scopeEventKey").value=scope.eventKey||"";byId("scopeCountryIso2").value=scope.countryIso2||"";byId("scopeCountryName").value=scope.countryName||"";byId("scopeAdm1Name").value=scope.adm1Name||"";byId("scopeAdm2Name").value=scope.adm2Name||"";byId("scopeLocationId").value=scope.locationId||"";byId("scopeBuildingId").value=scope.buildingId||"";byId("scopeLatitude").value=scope.latitude===null||scope.latitude===undefined?"":scope.latitude;byId("scopeLongitude").value=scope.longitude===null||scope.longitude===undefined?"":scope.longitude;byId("scopeRadius").value=scope.radiusMeters===null||scope.radiusMeters===undefined?"":scope.radiusMeters;renderScopeList();
    ["id","en"].forEach(function(lang){
      var content=(definition.contents||[]).find(function(row){return row.languageCode===lang&&row.contentKey==="main";})||{};
      document.querySelectorAll('[data-content-lang="'+lang+'"]').forEach(function(input){input.value=content[input.dataset.contentField]||"";});
    });
    state.editingTriggers=(definition.triggers||[]).map(function(row){return Object.assign({},row);});
    renderTriggerList();
    state.editingSequences=(definition.sequenceItems||[]).map(function(row){return Object.assign({},row,{settings:Object.assign({},row.settings||{})});});
    byId("playlistMode").value=definition.settings.playlistMode||"sequential";
    byId("playlistRotationSeconds").value=Number(definition.settings.rotationSeconds||15);
    byId("playlistLoop").checked=definition.settings.playlistLoop!==false;
    renderSequenceList();
    var layout=(definition.layouts||[])[0]||{};
    var imagePosition=parseImagePosition(layout.imagePosition);
    var imageScale=clamp(layout.settings&&layout.settings.imageScalePercent,100,300,100);
    byId("layoutAnchor").value=layout.anchorKey||"center";
    byId("layoutX").value=layout.xPercent===undefined?50:layout.xPercent;
    byId("layoutY").value=layout.yPercent===undefined?50:layout.yPercent;
    byId("layoutWidth").value=layout.widthPercent===undefined?86:layout.widthPercent;
    byId("layoutHeight").value=layout.heightPercent===undefined?78:layout.heightPercent;
    byId("layoutFit").value=layout.imageFit||"cover";
    byId("layoutImageX").value=imagePosition.x;
    byId("layoutImageY").value=imagePosition.y;
    byId("layoutImageScale").value=imageScale;
    byId("layoutImageScaleRange").value=imageScale;
    byId("layoutImageOpacity").value=layout.imageOpacity===undefined?1:layout.imageOpacity;
    byId("layoutTintColor").value=layout.tintColor||"#081b18";
    byId("layoutTintOpacity").value=layout.tintOpacity===undefined?.52:layout.tintOpacity;
    byId("layoutCardColor").value=layout.cardBackground||"#102a25";
    byId("layoutCardOpacity").value=layout.cardOpacity===undefined?.78:layout.cardOpacity;
    renderCardStyle("layout",layout.settings&&layout.settings.cardStyle||{backgroundColor:layout.cardBackground||"#102a25",opacity:layout.cardOpacity===undefined?.78:layout.cardOpacity},state.snapshot&&state.snapshot.globalCardStyle||{});
    byId("layoutShowCard").checked=layout.showCard!==false;
    var mainContent=(definition.contents||[]).find(function(row){return row.languageCode==="id"&&row.contentKey==="main";})||(definition.contents||[])[0]||{};
    byId("contentTextAlign").value=mainContent.textAlign||"center";byId("contentTitleSize").value=mainContent.titleSizeClamp||"clamp(2rem, 7vw, 6rem)";byId("contentBodySize").value=mainContent.bodySizeClamp||"clamp(1rem, 2.4vw, 1.7rem)";
    byId("componentShowBackground").checked=definition.settings.showBackground!==false;byId("componentShowContent").checked=definition.settings.showContent!==false;byId("componentShowClock").checked=definition.settings.showClock!==false;byId("componentShowDates").checked=definition.settings.showDates!==false;
    state.editingWidgets=(definition.widgets||[]).map(function(row){return Object.assign({},row,{config:Object.assign({},row.config||{}),source:Object.assign({},row.source||{})});});
    var widgets=state.editingWidgets.filter(function(row){return row.isEnabled;}).map(function(row){return row.widgetType;});document.querySelectorAll('#widgetChecklist input[type="checkbox"]').forEach(function(input){input.checked=widgets.indexOf(input.value)>=0;});
    var phases=(definition.settings&&definition.settings.protectedPhases)||[];document.querySelectorAll('#protectedPhaseChecklist input[type="checkbox"]').forEach(function(input){input.checked=phases.indexOf(input.value)>=0;});
    var firstWidget=(definition.widgets||[])[0]||{};byId("widgetSourceNote").value=(firstWidget.source&&firstWidget.source.note)||"";
    renderWidgetEditor();
    byId("definitionBackgroundPath").value=definition.backgroundPath||"";
    byId("definitionBackgroundMedia").value=definition.backgroundMediaId||"";
    if(state.renderedDefinitionKey!==definition.overlayKey){
      state.renderedDefinitionKey=definition.overlayKey;
      state.pendingMediaId=definition.backgroundMediaId?Number(definition.backgroundMediaId):null;
      state.pendingBackgroundPath="";
    }
    renderQuickBackgroundPicker();
    renderBackgroundStudio();
  }

  function renderTriggerList(){
    var container=byId("triggerList");container.innerHTML="";
    state.editingTriggers.forEach(function(trigger,index){var item=document.createElement("div");item.className="trigger-chip";var text=document.createElement("span");text.textContent=trigger.triggerType+" · "+(trigger.prayerKey||trigger.localTime||trigger.startsAtUtc||trigger.triggerKey);var remove=document.createElement("button");remove.type="button";remove.className="button button-danger";remove.textContent=window.PrayerI18n.uiText("Hapus");remove.addEventListener("click",function(){state.editingTriggers.splice(index,1);renderTriggerList();});item.append(text,remove);container.appendChild(item);});
  }

  function sequenceValue(item, path) {
    var content=(item.settings&&item.settings.content)||{};
    return path==="titleId"?(content.id&&content.id.title)||"":path==="titleEn"?(content.en&&content.en.title)||"":path==="backgroundPath"?(item.settings&&item.settings.backgroundPath)||"":item[path]||"";
  }
  function renderSequenceList(){
    var container=byId("sequenceItemList");container.innerHTML="";
    state.editingSequences.forEach(function(item,index){
      var row=document.createElement("div");row.className="sequence-row";row.draggable=true;row.dataset.sequenceIndex=String(index);row.title="Geser untuk mengubah urutan";
      row.addEventListener("dragstart",function(){state.dragSequenceIndex=index;row.classList.add("is-dragging");});row.addEventListener("dragend",function(){state.dragSequenceIndex=null;row.classList.remove("is-dragging");});row.addEventListener("dragover",function(event){event.preventDefault();});row.addEventListener("drop",function(event){event.preventDefault();if(state.dragSequenceIndex===null||state.dragSequenceIndex===index){return;}var moved=state.editingSequences.splice(state.dragSequenceIndex,1)[0];state.editingSequences.splice(index,0,moved);state.editingSequences.forEach(function(entry,position){entry.sequenceOrder=position+1;});state.dragSequenceIndex=null;renderSequenceList();});
      [{label:"Urutan",field:"sequenceOrder",type:"number"},{label:"Judul ID",field:"titleId",type:"text"},{label:"Title EN",field:"titleEn",type:"text"},{label:"Detik",field:"durationSeconds",type:"number"},{label:"Ulang item",field:"repeatCount",type:"number",setting:true},{label:"Prioritas item",field:"priority",type:"number",setting:true}].forEach(function(spec){var label=document.createElement("label");label.textContent=spec.label;var input=document.createElement("input");input.type=spec.type;if(spec.field==="repeatCount"){input.min="1";input.max="20";}if(spec.field==="priority"){input.min="0";input.max="10000";}input.value=spec.setting?String(item.settings&&item.settings[spec.field]!==undefined?item.settings[spec.field]:spec.field==="repeatCount"?1:100):sequenceValue(item,spec.field);input.addEventListener("change",function(){if(spec.field==="titleId"||spec.field==="titleEn"){item.settings=item.settings||{};item.settings.content=item.settings.content||{};var lang=spec.field==="titleId"?"id":"en";item.settings.content[lang]=item.settings.content[lang]||{};item.settings.content[lang].title=input.value;}else if(spec.setting){item.settings=item.settings||{};item.settings[spec.field]=Number(input.value);}else{item[spec.field]=Number(input.value);}});label.appendChild(input);row.appendChild(label);});
      var mediaLabel=document.createElement("label");mediaLabel.textContent="Media";var mediaSelect=document.createElement("select");var noMedia=document.createElement("option");noMedia.value="";noMedia.textContent="Gunakan background utama";mediaSelect.appendChild(noMedia);(state.snapshot.media||[]).forEach(function(media){var option=document.createElement("option");option.value=String(media.id);option.textContent=media.originalName;mediaSelect.appendChild(option);});mediaSelect.value=item.mediaId?String(item.mediaId):"";mediaSelect.addEventListener("change",function(){var media=mediaById(mediaSelect.value);item.mediaId=media?Number(media.id):null;item.settings=item.settings||{};item.settings.backgroundPath=media?media.publicUrl:"";item.settings.backgroundMedia=media||null;});mediaLabel.appendChild(mediaSelect);row.appendChild(mediaLabel);
      var transitionLabel=document.createElement("label");transitionLabel.textContent="Transisi";var transition=document.createElement("select");["fade","slide","none"].forEach(function(name){var option=document.createElement("option");option.value=name;option.textContent=name;transition.appendChild(option);});transition.value=item.transitionName||"fade";transition.addEventListener("change",function(){item.transitionName=transition.value;});transitionLabel.appendChild(transition);row.appendChild(transitionLabel);
      var actions=document.createElement("div");actions.className="sequence-actions";var up=document.createElement("button");up.type="button";up.className="button button-secondary";up.textContent="Naik";up.disabled=index===0;up.addEventListener("click",function(){var previous=state.editingSequences[index-1];state.editingSequences[index-1]=item;state.editingSequences[index]=previous;renderSequenceList();});var down=document.createElement("button");down.type="button";down.className="button button-secondary";down.textContent="Turun";down.disabled=index===state.editingSequences.length-1;down.addEventListener("click",function(){var next=state.editingSequences[index+1];state.editingSequences[index+1]=item;state.editingSequences[index]=next;renderSequenceList();});var remove=document.createElement("button");remove.type="button";remove.className="button button-danger";remove.textContent=window.PrayerI18n.uiText("Hapus");remove.addEventListener("click",function(){state.editingSequences.splice(index,1);renderSequenceList();});actions.append(up,down,remove);row.appendChild(actions);container.appendChild(row);
    });
  }
  function addSequence(){var order=state.editingSequences.length+1;state.editingSequences.push({sequenceOrder:order,itemKey:"slide-"+Date.now(),contentKey:"main",mediaId:null,durationSeconds:10,transitionName:"fade",settings:{backgroundPath:"",repeatCount:1,priority:100,content:{id:{title:"Slide "+order},en:{title:"Slide "+order}}},isEnabled:true});renderSequenceList();}

  function readPair(value){var parts=String(value||"").split("/").map(Number);return parts.length===2&&parts.every(Number.isFinite)?parts:[null,null];}
  function addTrigger(){
    var type=value("triggerType");var greg=readPair(value("triggerGregorian"));var hijri=readPair(value("triggerHijri"));var gregEnd=readPair(value("triggerGregorianEnd"));var hijriEnd=readPair(value("triggerHijriEnd"));var starts=value("triggerStarts"),ends=value("triggerEnds");
    var weekdays=value("triggerWeekdays").split(",").map(function(item){return Number(item.trim());}).filter(function(item){return item>=0&&item<=6;});
    state.editingTriggers.push({triggerKey:"trigger-"+Date.now(),triggerType:type,prayerKey:value("triggerPrayer")||null,offsetSeconds:number("triggerOffset",0),durationSeconds:number("triggerDuration",30),localTime:value("triggerLocalTime")||null,startsAtUtc:starts?new Date(starts).toISOString():null,endsAtUtc:ends?new Date(ends).toISOString():null,gregorianMonth:greg[0],gregorianDay:greg[1],hijriMonth:hijri[0],hijriDay:hijri[1],hijriYear:null,astronomicalEvent:value("triggerEventKey")||null,timezone:null,config:{weekdays:weekdays,repeatMinutes:number("triggerRepeatMinutes",0)||null,phaseKey:value("triggerPhase")||null,endMonth:type==="hijri_range"?hijriEnd[0]:gregEnd[0],endDay:type==="hijri_range"?hijriEnd[1]:gregEnd[1],eventKey:value("triggerEventKey")||null,conditionPath:value("triggerConditionPath")||null,conditionOperator:value("triggerConditionOperator"),conditionValue:value("triggerConditionValue")},isEnabled:true});renderTriggerList();
  }

  function contentRows(){
    return ["id","en"].map(function(lang){var row={contentKey:"main",languageCode:lang,textAlign:value("contentTextAlign"),fontFamily:"Arial, Helvetica, sans-serif",titleSizeClamp:value("contentTitleSize"),bodySizeClamp:value("contentBodySize"),settings:{},isEnabled:true};document.querySelectorAll('[data-content-lang="'+lang+'"]').forEach(function(input){row[input.dataset.contentField]=input.value.trim()||null;});return row;});
  }
  function layoutRow(){
    var definition=selectedDefinition()||{};
    var previous=(definition.layouts||[])[0]||{};
    var settings=Object.assign({},previous.settings||{},{imageScalePercent:clamp(number("layoutImageScale",100),100,300,100),cardStyle:readCardStyle("layout")});
    return {
      viewportKey:"default",
      anchorKey:value("layoutAnchor"),
      xPercent:clamp(number("layoutX",50),0,100,50),
      yPercent:clamp(number("layoutY",50),0,100,50),
      widthPercent:clamp(number("layoutWidth",86),5,100,86),
      heightPercent:clamp(number("layoutHeight",78),5,100,78),
      imageFit:value("layoutFit"),
      imagePosition:clamp(number("layoutImageX",50),0,100,50)+"% "+clamp(number("layoutImageY",50),0,100,50)+"%",
      imageOpacity:clamp(number("layoutImageOpacity",1),0,1,1),
      tintColor:value("layoutTintColor"),
      tintOpacity:clamp(number("layoutTintOpacity",.52),0,1,.52),
      cardBackground:value("layoutCardColor"),
      cardOpacity:clamp(number("layoutCardOpacity",.78),0,1,.78),
      showCard:checked("layoutShowCard"),
      settings:settings
    };
  }
  function draftScope(key){return {scopeKey:key,scopeType:value("scopeType"),scopeEffect:value("scopeEffect"),pageKey:value("scopePageKey")||null,prayerKey:value("scopePrayerKey")||null,prayerGroup:value("scopePrayerGroup")||null,phaseKey:value("scopePhaseKey")||null,eventKey:value("scopeEventKey")||null,countryIso2:value("scopeCountryIso2").toUpperCase()||null,countryName:value("scopeCountryName")||null,adm1Code:null,adm1Name:value("scopeAdm1Name")||null,adm2Code:null,adm2Name:value("scopeAdm2Name")||null,locationId:value("scopeLocationId")===""?null:Number(value("scopeLocationId")),buildingId:value("scopeBuildingId")===""?null:Number(value("scopeBuildingId")),latitude:value("scopeLatitude")===""?null:Number(value("scopeLatitude")),longitude:value("scopeLongitude")===""?null:Number(value("scopeLongitude")),radiusMeters:value("scopeRadius")===""?null:Number(value("scopeRadius")),timezone:null,isEnabled:true};}
  function scopeRows(){var primary=draftScope("primary");var extras=state.editingScopes.map(function(row,index){return Object.assign({},row,{scopeKey:row.scopeKey||("scope-"+(index+2))});});if(primary.scopeType==="GLOBAL"&&primary.scopeEffect==="include"){return extras;}return [primary].concat(extras);}
  function renderScopeList(){var host=byId("scopeList");if(!host){return;}host.replaceChildren();state.editingScopes.forEach(function(scope,index){var item=document.createElement("div");item.className="trigger-chip";var label=document.createElement("span");label.textContent=(scope.scopeEffect==="exclude"?"KECUALIKAN ":"SERTAKAN ")+(scope.scopeType||"GLOBAL")+" · "+(scope.eventKey||scope.phaseKey||scope.prayerGroup||scope.prayerKey||scope.pageKey||scope.adm2Name||scope.adm1Name||scope.countryName||scope.countryIso2||"semua");var remove=document.createElement("button");remove.type="button";remove.className="button button-danger";remove.textContent=window.PrayerI18n.uiText("Hapus");remove.addEventListener("click",function(){state.editingScopes.splice(index,1);renderScopeList();});item.append(label,remove);host.appendChild(item);});}
  function addScope(){var row=draftScope("scope-"+Date.now());if(row.scopeType==="GLOBAL"&&row.scopeEffect==="include"){status("Scope global sudah menjadi default. Pilih area atau efek pengecualian.","error");return;}state.editingScopes.push(row);renderScopeList();status("Scope ditambahkan ke form. Simpan definisi untuk menyimpan ke SQL.","success");}
  function selectedWidgetTypes(){return Array.prototype.slice.call(document.querySelectorAll('#widgetChecklist input[type="checkbox"]:checked')).map(function(input){return input.value;});}
  function syncWidgetsFromChecklist(){
    var selected=selectedWidgetTypes();
    state.editingWidgets=selected.map(function(type,index){var existing=state.editingWidgets.find(function(row){return row.widgetType===type;});return existing||{widgetKey:"component-"+type,widgetType:type,layerKey:value("definitionLayer")||"main",sortOrder:index+1,config:{languageAware:true,label:WIDGET_LABELS[type],positioned:false,xPercent:50,yPercent:50,widthPercent:40,opacity:1,textAlign:"center",backgroundColor:"#102a25"},source:{},isEnabled:true};});
    renderWidgetEditor();
    renderEditorWidgets();
  }
  function editorField(labelText,input){var label=document.createElement("label");label.textContent=labelText;label.appendChild(input);return label;}
  function textInput(valueText,handler,type){var input=document.createElement("input");input.type=type||"text";input.value=valueText===undefined||valueText===null?"":valueText;input.addEventListener("input",function(){handler(input.value);});return input;}
  function renderWidgetEditor(){
    var host=byId("widgetEditorList");if(!host){return;}host.replaceChildren();
    state.editingWidgets.forEach(function(widget,index){
      var config=widget.config=Object.assign({languageAware:true,positioned:false,xPercent:50,yPercent:50,widthPercent:40,opacity:1,textAlign:"center",backgroundColor:"#102a25",fontFamily:"system",borderWidthPx:1},widget.config||{});widget.source=Object.assign({},widget.source||{});
      var card=document.createElement("article");card.className="widget-editor-card";card.dataset.widgetKey=widget.widgetKey;card.draggable=true;
      card.addEventListener("dragstart",function(){card.dataset.dragging="true";});card.addEventListener("dragend",function(){delete card.dataset.dragging;});card.addEventListener("dragover",function(event){event.preventDefault();});card.addEventListener("drop",function(event){event.preventDefault();var dragged=host.querySelector('[data-dragging="true"]');if(!dragged||dragged===card){return;}var from=state.editingWidgets.findIndex(function(row){return row.widgetKey===dragged.dataset.widgetKey;});var to=state.editingWidgets.findIndex(function(row){return row.widgetKey===card.dataset.widgetKey;});var moved=state.editingWidgets.splice(from,1)[0];state.editingWidgets.splice(to,0,moved);renderWidgetEditor();});
      var heading=document.createElement("header");heading.className="widget-editor-heading";var title=document.createElement("strong");title.textContent=(index+1)+". "+(WIDGET_LABELS[widget.widgetType]||widget.widgetType);var hint=document.createElement("span");hint.textContent="Geser kartu untuk mengubah urutan";heading.append(title,hint);card.appendChild(heading);
      var grid=document.createElement("div");grid.className="form-grid four compact-grid";
      grid.appendChild(editorField("Lapisan",(function(){var select=document.createElement("select");["background","persistent","main","alert"].forEach(function(layer){var option=document.createElement("option");option.value=layer;option.textContent={background:"Background",persistent:"Informasi tetap",main:"Konten utama",alert:"Peringatan"}[layer];select.appendChild(option);});select.value=widget.layerKey||"main";select.addEventListener("change",function(){widget.layerKey=select.value;});return select;})()));
      grid.appendChild(editorField("Judul/label",textInput(config.label,function(v){config.label=v;})));
      var body=document.createElement("textarea");body.rows=3;body.value=config.body||config.text||"";body.addEventListener("input",function(){config.body=body.value;});grid.appendChild(editorField("Isi informasi",body));
      grid.appendChild(editorField("Sumber",textInput(widget.source.name||widget.source.note||"",function(v){widget.source.name=v;widget.source.note=v;})));
      grid.appendChild(editorField("URL sumber HTTPS",textInput(widget.source.url||"",function(v){widget.source.url=v;},"url")));
      if(widget.widgetType==="quran"){
        [["Tampilkan Arab","showArabic"],["Tampilkan latin","showLatin"],["Tampilkan terjemahan","showTranslation"]].forEach(function(spec){var toggle=document.createElement("input");toggle.type="checkbox";toggle.checked=config[spec[1]]!==false;toggle.addEventListener("change",function(){config[spec[1]]=toggle.checked;});grid.appendChild(editorField(spec[0],toggle));});
        grid.appendChild(editorField("Teks Arab",textInput(config.arabic||"",function(v){config.arabic=v;})));grid.appendChild(editorField("Latin",textInput(config.latin||"",function(v){config.latin=v;})));grid.appendChild(editorField("Terjemahan",textInput(config.translation||"",function(v){config.translation=v;})));
      }
      if(widget.widgetType==="tafsir"){grid.appendChild(editorField("Nama mufassir",textInput(config.mufassir||"",function(v){config.mufassir=v;})));grid.appendChild(editorField("Teks tafsir",textInput(config.tafsirText||"",function(v){config.tafsirText=v;})));}
      if(widget.widgetType==="hadith"){grid.appendChild(editorField("Nomor/rujukan hadis",textInput(config.reference||"",function(v){config.reference=v;})));grid.appendChild(editorField("Teks hadis",textInput(config.hadithText||"",function(v){config.hadithText=v;})));}
      if(widget.widgetType==="media"){
        var mediaSelect=document.createElement("select"),emptyMedia=document.createElement("option");emptyMedia.value="";emptyMedia.textContent="Ikuti media background";mediaSelect.appendChild(emptyMedia);
        (state.snapshot.media||[]).forEach(function(media){var option=document.createElement("option");option.value=media.id;option.textContent=media.originalName;mediaSelect.appendChild(option);});
        mediaSelect.value=config.mediaId||"";mediaSelect.addEventListener("change",function(){var selected=mediaById(mediaSelect.value);config.mediaId=selected?Number(selected.id):null;config.mediaUrl=selected?selected.publicUrl:"";config.mediaKind=selected?selected.mediaKind:"";});grid.appendChild(editorField("Media komponen",mediaSelect));
      }
      if(widget.widgetType==="clock"){var clockStyle=document.createElement("select");[["digital","Digital"],["analog","Analog"],["both","Digital + analog"]].forEach(function(optionRow){var option=document.createElement("option");option.value=optionRow[0];option.textContent=optionRow[1];clockStyle.appendChild(option);});clockStyle.value=config.clockStyle||"digital";clockStyle.addEventListener("change",function(){config.clockStyle=clockStyle.value;});grid.appendChild(editorField("Tampilan jam",clockStyle));}
      var positioned=document.createElement("input");positioned.type="checkbox";positioned.checked=config.positioned===true;positioned.addEventListener("change",function(){config.positioned=positioned.checked;});grid.appendChild(editorField("Posisi bebas",positioned));
      [["X (%)","xPercent",0,100],["Y (%)","yPercent",0,100],["Lebar (%)","widthPercent",10,100],["Opacity","opacity",0,1]].forEach(function(spec){var input=document.createElement("input");input.type="number";input.min=spec[2];input.max=spec[3];input.step=spec[1]==="opacity"?"0.05":"1";input.value=config[spec[1]];input.addEventListener("input",function(){config[spec[1]]=Number(input.value);});grid.appendChild(editorField(spec[0],input));});
      grid.appendChild(editorField("Warna panel",textInput(config.backgroundColor||"#102a25",function(v){config.backgroundColor=v;},"color")));
      grid.appendChild(editorField("Warna teks",textInput(config.textColor||"#ffffff",function(v){config.textColor=v;},"color")));
      grid.appendChild(editorField("Warna border",textInput(config.borderColor||"#ffffff",function(v){config.borderColor=v;},"color")));
      grid.appendChild(editorField("Jenis font",(function(){var select=document.createElement("select");[["system","Sans-serif sistem"],["serif","Serif"],["mono","Monospace"],["arabic","Arab / Naskh"]].forEach(function(row){var option=document.createElement("option");option.value=row[0];option.textContent=row[1];select.appendChild(option);});select.value=config.fontFamily||"system";select.addEventListener("change",function(){config.fontFamily=select.value;});return select;})()));
      [["Ukuran font (px)","fontSizePx",10,120,20],["Lebar border (px)","borderWidthPx",0,12,1],["Padding (px)","paddingPx",0,80,12]].forEach(function(spec){var input=document.createElement("input");input.type="number";input.min=spec[2];input.max=spec[3];input.value=config[spec[1]]===undefined?spec[4]:config[spec[1]];input.addEventListener("input",function(){config[spec[1]]=Number(input.value);});grid.appendChild(editorField(spec[0],input));});
      var animation=document.createElement("select");[["none","Tanpa animasi"],["fade","Fade"],["slide","Slide"],["pulse","Pulse lembut"]].forEach(function(optionRow){var option=document.createElement("option");option.value=optionRow[0];option.textContent=optionRow[1];animation.appendChild(option);});animation.value=config.animation||"none";animation.addEventListener("change",function(){config.animation=animation.value;});grid.appendChild(editorField("Animasi",animation));
      var safeArea=document.createElement("input");safeArea.type="checkbox";safeArea.checked=config.safeArea!==false;safeArea.addEventListener("change",function(){config.safeArea=safeArea.checked;});grid.appendChild(editorField("Batasi ke area aman",safeArea));
      grid.appendChild(editorField("Rata teks",(function(){var select=document.createElement("select");["left","center","right"].forEach(function(align){var option=document.createElement("option");option.value=align;option.textContent={left:"Kiri",center:"Tengah",right:"Kanan"}[align];select.appendChild(option);});select.value=config.textAlign||"center";select.addEventListener("change",function(){config.textAlign=select.value;});return select;})()));
      card.addEventListener("input",renderEditorWidgets);card.addEventListener("change",renderEditorWidgets);card.appendChild(grid);host.appendChild(card);
    });
  }
  function renderEditorWidgets(){
    var host=byId("backgroundEditorWidgetLayer");if(!host){return;}host.replaceChildren();
    state.editingWidgets.forEach(function(widget){var config=widget.config||{},chip=document.createElement("button"),label=document.createElement("span"),resize=document.createElement("span");chip.type="button";chip.className="background-editor-widget-chip"+(config.positioned===true?" is-positioned":"");chip.dataset.editorWidgetKey=widget.widgetKey;label.textContent=config.label||WIDGET_LABELS[widget.widgetType]||widget.widgetType;resize.className="background-editor-widget-resize";resize.setAttribute("aria-hidden","true");chip.append(label,resize);chip.style.setProperty("--editor-widget-x",clamp(config.xPercent,0,100,50)+"%");chip.style.setProperty("--editor-widget-y",clamp(config.yPercent,0,100,50)+"%");chip.style.setProperty("--editor-widget-width",clamp(config.widthPercent,10,100,40)+"%");chip.title="Geser untuk memindahkan; gunakan sudut kanan bawah untuk mengubah ukuran "+label.textContent;host.appendChild(chip);});
  }
  function widgetRows(){var note=value("widgetSourceNote").trim();return state.editingWidgets.map(function(widget,index){var row=Object.assign({},widget,{sortOrder:index+1,isEnabled:true,config:Object.assign({},widget.config||{}),source:Object.assign({},widget.source||{})});if(!row.source.name&&!row.source.note&&note){row.source.note=note;}if(["quran","tafsir","hadith"].indexOf(row.widgetType)>=0){row.source.requiresAttribution=true;}return row;});}
  function protectedPhases(){return Array.prototype.slice.call(document.querySelectorAll('#protectedPhaseChecklist input[type="checkbox"]:checked')).map(function(input){return input.value;});}
  function collectDefinition(){
    var current=selectedDefinition()||{};var settings=Object.assign({},current.settings||{},{showBackground:checked("componentShowBackground"),showContent:checked("componentShowContent"),showClock:checked("componentShowClock"),showDates:checked("componentShowDates"),protectedPhases:protectedPhases(),playlistMode:value("playlistMode"),playlistLoop:checked("playlistLoop"),rotationSeconds:number("playlistRotationSeconds",15)});return {overlayKey:value("definitionKey"),overlayType:value("definitionType"),nameId:value("definitionNameId"),nameEn:value("definitionNameEn"),priority:number("definitionPriority",100),interruptionPolicy:value("definitionPolicy"),conflictMode:value("definitionConflictMode"),isInterruptible:checked("definitionInterruptible"),layerKey:value("definitionLayer"),layerOrder:number("definitionLayerOrder",100),animation:value("definitionAnimation"),defaultDurationSeconds:number("definitionDuration",30),backgroundMediaId:value("definitionBackgroundMedia")?Number(value("definitionBackgroundMedia")):null,backgroundPath:value("definitionBackgroundPath")||null,settings:settings,isEnabled:checked("definitionEnabled"),triggers:state.editingTriggers,contents:contentRows(),layouts:[layoutRow()],sequenceItems:state.editingSequences,scopes:scopeRows(),widgets:widgetRows()};
  }
  function saveDefinition(){var definition=collectDefinition(),missingSource=definition.widgets.find(function(widget){return ["quran","tafsir","hadith"].indexOf(widget.widgetType)>=0&&(!(widget.source.name||widget.source.note)||!/^https:\/\//i.test(widget.source.url||""));});if(missingSource){status("Komponen "+(WIDGET_LABELS[missingSource.widgetType]||missingSource.widgetType)+" memerlukan nama sumber dan URL HTTPS sebelum disimpan.","error");return Promise.resolve(null);}status("Menyimpan definisi...");return post({action:"save_definition",definition:definition}).then(function(snapshot){state.snapshot=snapshot;state.selectedKey=value("definitionKey");state.renderedDefinitionKey="";renderAll();status("Definisi tersimpan di SQL bersama pengaturan tampilan.","success");notifyCustomizer("saved","definition",{selectedKey:state.selectedKey});return snapshot;}).catch(function(error){status("Gagal menyimpan: "+error.message,"error");return null;});}

  function renderMedia(){
    var select=byId("definitionBackgroundMedia");
    var definition=selectedDefinition()||{};
    var selected=select.value||definition.backgroundMediaId||"";
    select.innerHTML='<option value="">Tidak ada / path manual</option>';
    var gallery=byId("mediaGallery");gallery.innerHTML="";
    var search=byId("mediaSearchInput")?value("mediaSearchInput").trim().toLocaleLowerCase():"";var category=byId("mediaCategoryFilter")?value("mediaCategoryFilter"):"";var kind=byId("mediaKindFilter")?value("mediaKindFilter"):"";
    var allMediaRows=state.snapshot.media||[];allMediaRows.forEach(function(media){var option=document.createElement("option");option.value=media.id;option.textContent=media.originalName;select.appendChild(option);});
    var mediaRows=allMediaRows.filter(function(media){var isOnline=["direct_url","youtube"].indexOf(String(media.sourceType||""))>=0||media.mediaKind==="youtube";var kindMatches=!kind||(kind==="online"?isOnline:media.mediaKind===kind);return kindMatches&&(!category||media.categoryKey===category)&&(!search||String(media.originalName||"").toLocaleLowerCase().indexOf(search)>=0);});
    mediaRows.forEach(function(media){
      var card=document.createElement("article");card.className="media-card";card.dataset.mediaId=String(media.id);card.dataset.mediaKind=media.mediaKind||"image";card.dataset.sourceType=media.sourceType||"upload";
      var image;if(media.mediaKind==="video"){image=document.createElement("video");image.src=media.publicUrl;image.poster=media.posterUrl||media.fallbackUrl||"";image.muted=true;image.loop=true;image.preload="metadata";image.setAttribute("aria-label","Pratinjau video "+media.originalName);}else if(media.mediaKind==="youtube"){image=document.createElement("div");image.className="media-provider-preview";image.textContent="YouTube";}else{image=document.createElement("img");image.src=media.publicUrl;image.alt="Pratinjau "+media.originalName;image.loading="lazy";}
      var info=document.createElement("div");
      var name=document.createElement("strong");name.textContent=media.originalName;
      var meta=document.createElement("span");meta.textContent=(media.mediaKind||"image")+" · "+(media.categoryKey||"overlay")+(media.sizeBytes?" · "+Math.round(media.sizeBytes/1024)+" KB":" · eksternal")+" · dipakai "+Number(media.usageCount||0)+" tempat";
      if((media.usages||[]).length){meta.title=media.usages.map(function(usage){return (usage.usageLabel||usage.usageKey)+" ("+usage.usageType+")";}).join("\n");}
      var badge=document.createElement("span");badge.className="media-badge";badge.hidden=true;
      var choose=document.createElement("button");choose.type="button";choose.className="button button-secondary";choose.textContent="Pilih & edit";choose.addEventListener("click",function(){stageMedia(media.id);});
      var nameInput=document.createElement("input");nameInput.className="media-name-input";nameInput.value=media.originalName;nameInput.setAttribute("aria-label","Nama gambar "+media.originalName);
      var actions=document.createElement("div");actions.className="media-card-actions";
      var rename=document.createElement("button");rename.type="button";rename.className="button button-secondary";rename.textContent="Simpan nama";rename.addEventListener("click",function(){renameMedia(media.id,nameInput.value);});
      var remove=document.createElement("button");remove.type="button";remove.className="button button-danger";remove.textContent=window.PrayerI18n.uiText("Hapus");remove.addEventListener("click",function(){deleteMedia(media);});
      actions.append(rename,remove);info.append(name,meta,badge,choose,nameInput,actions);card.append(image,info);gallery.appendChild(card);
    });
    if(!mediaRows.length){var empty=document.createElement("p");empty.className="form-help";empty.textContent="Tidak ada media yang cocok dengan pencarian atau kategori.";gallery.appendChild(empty);}
    select.value=String(selected||"");
    updateMediaCardStates();
  }

  function updateMediaCardStates(){
    var appliedId=Number(value("definitionBackgroundMedia"));
    document.querySelectorAll(".media-card[data-media-id]").forEach(function(card){
      var id=Number(card.dataset.mediaId);var badge=card.querySelector(".media-badge");
      card.classList.toggle("is-selected",id===Number(state.pendingMediaId));
      card.classList.toggle("is-applied",id===appliedId);
      if(badge){badge.hidden=id!==appliedId;badge.textContent="Sedang digunakan";}
    });
  }

  function stageMedia(id){
    var media=mediaById(id);if(!media){return;}
    state.pendingMediaId=Number(media.id);state.pendingBackgroundPath="";
    renderBackgroundStudio();
    byId("backgroundEditorStage").scrollIntoView({behavior:"smooth",block:"center"});
    status("Gambar dipilih untuk diedit. Belum digunakan dan belum tersimpan ke SQL.","success");
  }

  function applySelectedBackground(skipConfirmation){
    var media=mediaById(state.pendingMediaId);if(!media){return;}
    if(!skipConfirmation&&!window.confirm('Gunakan "'+media.originalName+'" sebagai background untuk overlay '+(selectedDefinition()&&selectedDefinition().nameId||"terpilih")+'? Perubahan belum masuk SQL sampai Anda menekan Simpan tampilan.')){return;}
    byId("definitionBackgroundMedia").value=String(media.id);
    byId("definitionBackgroundPath").value=media.publicUrl;
    state.pendingBackgroundPath="";
    renderBackgroundStudio();
    status('Background "'+media.originalName+'" diterapkan pada form. Klik Simpan tampilan ke SQL untuk menyimpan.',"success");
  }

  function selectedEditorMedia(){return mediaById(state.pendingMediaId)||mediaById(value("definitionBackgroundMedia"));}

  function renderBackgroundStudio(){
    if(!state.snapshot){return;}
    var pending=mediaById(state.pendingMediaId);var applied=mediaById(value("definitionBackgroundMedia"));
    var selection=byId("backgroundSelectionStatus"),applyButton=byId("applyBackgroundMediaButton");
    if(pending){selection.textContent='Dipilih dari galeri: "'+pending.originalName+'". Klik Gunakan sebagai background bila sudah sesuai.';selection.classList.add("is-pending");applyButton.disabled=false;}
    else if(state.pendingBackgroundPath){selection.textContent='Sedang mengedit background bawaan: "'+backgroundFilename(state.pendingBackgroundPath)+'".';selection.classList.add("is-pending");applyButton.disabled=true;}
    else{selection.textContent="Background saat ini langsung dapat digeser atau diperbesar pada pratinjau.";selection.classList.remove("is-pending");applyButton.disabled=true;}
    var appliedStatus=byId("backgroundAppliedStatus");
    if(applied){appliedStatus.textContent='Background pada form: "'+applied.originalName+'". Perubahan posisi atau gambar baru tersimpan setelah tombol Simpan tampilan ditekan.';}
    else if(value("definitionBackgroundPath")){appliedStatus.textContent="Background pada form memakai path manual. Perubahan belum tersimpan sampai tombol Simpan tampilan ditekan.";}
    else{appliedStatus.textContent="Overlay ini belum menggunakan background.";}
    updateMediaCardStates();syncEditorPreview();
  }

  function syncEditorPreview(){
    var media=selectedEditorMedia(),path=media?media.publicUrl:(state.pendingBackgroundPath||value("definitionBackgroundPath")),image=byId("backgroundEditorImage"),video=byId("backgroundEditorVideo"),isVideo=media&&media.mediaKind==="video";
    image.style.backgroundImage=!isVideo&&path?'url('+JSON.stringify(path)+')':"none";video.hidden=!isVideo;if(isVideo&&video.src!==new URL(path,window.location.href).href){video.src=path;video.play().catch(function(){});}else if(!isVideo){video.pause();video.removeAttribute("src");}
    image.style.backgroundPosition=clamp(number("layoutImageX",50),0,100,50)+"% "+clamp(number("layoutImageY",50),0,100,50)+"%";
    image.style.backgroundSize=value("layoutFit")||"cover";image.style.opacity=String(clamp(number("layoutImageOpacity",1),0,1,1));video.style.objectFit=value("layoutFit")||"cover";video.style.opacity=image.style.opacity;
    var scale=clamp(number("layoutImageScale",100),100,300,100);image.style.transform="scale("+(scale/100)+")";video.style.transform=image.style.transform;byId("layoutImageScaleRange").value=String(scale);byId("quickZoomValue").textContent=Math.round(scale)+"%";
    var tint=byId("backgroundEditorTint");tint.style.background=value("layoutTintColor")||"#081b18";tint.style.opacity=String(clamp(number("layoutTintOpacity",.52),0,1,.52));
    var overlay=byId("backgroundEditorOverlay"),cardStyle=readCardStyle("layout");overlay.dataset.anchor=value("layoutAnchor")||"center";overlay.style.left=clamp(number("layoutX",50),0,100,50)+"%";overlay.style.top=clamp(number("layoutY",50),0,100,50)+"%";overlay.style.width=clamp(number("layoutWidth",86),5,100,86)+"%";overlay.style.height=clamp(number("layoutHeight",78),5,100,78)+"%";
    var layers=[];if(cardStyle.backgroundGradient){layers.push(cardStyle.backgroundGradient);}if(cardStyle.backgroundImage){layers.push('url("'+cardStyle.backgroundImage.replace(/"/g,"\\\"")+'")');}layers.push(cardStyle.backgroundColor||"#102a25");overlay.style.setProperty("--editor-card-background",layers.join(", "));overlay.style.setProperty("--editor-card-opacity",String(clamp(cardStyle.opacity,0,1,.78)));overlay.style.borderColor=cardStyle.borderColor||"#ffffff";overlay.style.borderWidth=clamp(cardStyle.borderWidth,0,20,1)+"px";overlay.style.borderRadius=clamp(cardStyle.borderRadius,0,160,24)+"px";overlay.style.boxShadow=cardStyle.boxShadow||"none";overlay.style.color=cardStyle.textColor||"#ffffff";overlay.style.backdropFilter="blur("+clamp(cardStyle.backdropBlur,0,80,14)+"px)";
    renderEditorWidgets();
  }

  function previewUpload(){
    var input=byId("mediaUploadInput"),file=input.files&&input.files[0],wrap=byId("mediaUploadPreviewWrap");
    if(state.uploadPreviewUrl){URL.revokeObjectURL(state.uploadPreviewUrl);state.uploadPreviewUrl="";}
    if(!file){wrap.hidden=true;byId("mediaUploadPreview").removeAttribute("src");byId("mediaUploadPreviewName").textContent="";return;}
    state.uploadPreviewUrl=URL.createObjectURL(file);var preview=byId("mediaUploadPreview");if(file.type.indexOf("image/")===0){preview.src=state.uploadPreviewUrl;preview.hidden=false;}else{preview.removeAttribute("src");preview.hidden=true;}byId("mediaUploadPreviewName").textContent=file.name+" · "+Math.round(file.size/1024)+" KB";wrap.hidden=false;
  }

  function clearUploadPreview(){if(state.uploadPreviewUrl){URL.revokeObjectURL(state.uploadPreviewUrl);state.uploadPreviewUrl="";}byId("mediaUploadInput").value="";previewUpload();}

  function uploadMedia(event){
    event.preventDefault();var file=byId("mediaUploadInput").files[0];if(!file){status("Pilih file media terlebih dahulu.","error");return;}
    var body=new FormData();body.append("media",file);body.append("category",value("mediaUploadCategory"));status("Mengunggah dan memeriksa media...");
    request("api/overlay-media.php",{method:"POST",headers:headers(false),body:body}).then(function(media){clearUploadPreview();return load().then(function(){stageMedia(media.id);if(window.confirm('Upload berhasil. Gunakan "'+media.originalName+'" sebagai background overlay terpilih sekarang?')){applySelectedBackground(true);}else{status("Media berhasil masuk library dan belum digunakan sebagai background.","success");}});}).catch(function(error){status("Upload gagal: "+error.message,"error");});
  }

  function registerExternalMedia(event){event.preventDefault();var url=value("externalMediaUrl").trim();if(!url){status("Isi URL HTTPS media.","error");return;}status("Memvalidasi URL media...");request("api/overlay-media.php",{method:"POST",headers:headers(true),body:JSON.stringify({action:"register_external",name:value("externalMediaName")||"Media eksternal",sourceType:value("externalMediaSource"),mediaKind:value("externalMediaKind"),url:url,fallbackUrl:value("externalMediaFallback")||null,category:value("mediaUploadCategory")})}).then(function(media){byId("externalMediaForm").reset();return load().then(function(){stageMedia(media.id);status("Media eksternal masuk library. Klik Gunakan setelah preview sesuai.","success");});}).catch(function(error){status("URL media ditolak: "+error.message,"error");});}

  function renameMedia(id,name){
    request("api/overlay-media.php",{method:"PATCH",headers:headers(true),body:JSON.stringify({id:id,name:name})}).then(function(media){var pending=state.pendingMediaId;return load().then(function(){state.pendingMediaId=pending;renderBackgroundStudio();status('Nama gambar diubah menjadi "'+media.originalName+'".',"success");});}).catch(function(error){status("Gagal mengganti nama: "+error.message,"error");});
  }

  function deleteMedia(media){
    if(!media||!window.confirm('Hapus permanen gambar "'+media.originalName+'"? Gambar yang masih digunakan overlay tidak dapat dihapus.')){return;}
    request("api/overlay-media.php?id="+encodeURIComponent(media.id),{method:"DELETE",headers:headers(false)}).then(function(){if(Number(state.pendingMediaId)===Number(media.id)){state.pendingMediaId=null;}return load().then(function(){status('Gambar "'+media.originalName+'" telah dihapus.',"success");});}).catch(function(error){status("Gagal menghapus: "+error.message,"error");});
  }

  function setEditorNumber(id,newValue,minimum,maximum,fallback){byId(id).value=String(rounded(clamp(newValue,minimum,maximum,fallback)));}

  function beginEditorDrag(event){
    if(event.button!==0){return;}
    var stage=byId("backgroundEditorStage"),overlay=byId("backgroundEditorOverlay"),widgetChip=event.target.closest&&event.target.closest("[data-editor-widget-key]"),mode="image",widget=null;
    if(widgetChip){mode=event.target.closest&&event.target.closest(".background-editor-widget-resize")?"widget-resize":"widget";widget=state.editingWidgets.find(function(row){return row.widgetKey===widgetChip.dataset.editorWidgetKey;})||null;}
    else if(event.target===byId("backgroundEditorResizeHandle")){mode="resize";}else if(overlay.contains(event.target)){mode="overlay";}
    state.editorDrag={pointerId:event.pointerId,mode:mode,startX:event.clientX,startY:event.clientY,imageX:number("layoutImageX",50),imageY:number("layoutImageY",50),overlayX:number("layoutX",50),overlayY:number("layoutY",50),width:number("layoutWidth",86),height:number("layoutHeight",78),widget:widget,widgetChip:widgetChip,widgetX:widget?clamp(widget.config&&widget.config.xPercent,0,100,50):50,widgetY:widget?clamp(widget.config&&widget.config.yPercent,0,100,50):50,widgetWidth:widget?clamp(widget.config&&widget.config.widthPercent,10,100,40):40};
    stage.setPointerCapture(event.pointerId);stage.classList.add("is-dragging");event.preventDefault();
  }

  function moveEditorDrag(event){
    var drag=state.editorDrag;if(!drag||drag.pointerId!==event.pointerId){return;}
    var stage=byId("backgroundEditorStage"),rect=stage.getBoundingClientRect(),deltaX=(event.clientX-drag.startX)/Math.max(1,rect.width)*100,deltaY=(event.clientY-drag.startY)/Math.max(1,rect.height)*100;
    if(drag.mode==="widget"&&drag.widget){drag.widget.config=Object.assign({},drag.widget.config||{},{positioned:true,xPercent:rounded(clamp(drag.widgetX+deltaX,0,100,50)),yPercent:rounded(clamp(drag.widgetY+deltaY,0,100,50))});if(drag.widgetChip){drag.widgetChip.style.setProperty("--editor-widget-x",drag.widget.config.xPercent+"%");drag.widgetChip.style.setProperty("--editor-widget-y",drag.widget.config.yPercent+"%");}}
    else if(drag.mode==="widget-resize"&&drag.widget){drag.widget.config=Object.assign({},drag.widget.config||{},{positioned:true,widthPercent:rounded(clamp(drag.widgetWidth+deltaX*2,10,100,40))});if(drag.widgetChip){drag.widgetChip.style.setProperty("--editor-widget-width",drag.widget.config.widthPercent+"%");}}
    else if(drag.mode==="image"){setEditorNumber("layoutImageX",drag.imageX+deltaX,0,100,50);setEditorNumber("layoutImageY",drag.imageY+deltaY,0,100,50);}
    else if(drag.mode==="overlay"){byId("layoutAnchor").value="center";setEditorNumber("layoutX",drag.overlayX+deltaX,0,100,50);setEditorNumber("layoutY",drag.overlayY+deltaY,0,100,50);}
    else{setEditorNumber("layoutWidth",drag.width+deltaX,5,100,86);setEditorNumber("layoutHeight",drag.height+deltaY,5,100,78);}
    syncEditorPreview();event.preventDefault();
  }

  function endEditorDrag(event){
    if(!state.editorDrag||state.editorDrag.pointerId!==event.pointerId){return;}
    var stage=byId("backgroundEditorStage");
    if(stage.hasPointerCapture&&stage.hasPointerCapture(event.pointerId)){stage.releasePointerCapture(event.pointerId);}
    var changedWidget=state.editorDrag.mode==="widget"||state.editorDrag.mode==="widget-resize";state.editorDrag=null;stage.classList.remove("is-dragging");if(changedWidget){renderWidgetEditor();renderEditorWidgets();}status("Posisi atau ukuran tampilan diubah pada form. Klik Simpan tampilan ke SQL bila sudah sesuai.","success");
  }

  function zoomEditor(event){
    event.preventDefault();var current=number("layoutImageScale",100),next=current+(event.deltaY<0?5:-5);setEditorNumber("layoutImageScale",next,100,300,100);syncEditorPreview();
  }

  function resetBackgroundImage(){byId("layoutImageX").value="50";byId("layoutImageY").value="50";byId("layoutImageScale").value="100";byId("layoutImageScaleRange").value="100";byId("layoutFit").value="cover";syncEditorPreview();status("Posisi dan zoom gambar dikembalikan ke tengah. Belum tersimpan ke SQL.","success");}
  function resetOverlayPosition(){byId("layoutAnchor").value="center";byId("layoutX").value="50";byId("layoutY").value="50";byId("layoutWidth").value="86";byId("layoutHeight").value="78";syncEditorPreview();status("Posisi overlay dikembalikan ke default. Belum tersimpan ke SQL.","success");}

  function newDefinition(){
    var key="custom-"+Date.now();state.snapshot.definitions.push({overlayKey:key,overlayType:"custom",nameId:"Overlay Custom",nameEn:"Custom Overlay",priority:100,interruptionPolicy:"queue",conflictMode:"replace",isInterruptible:true,layerKey:"main",layerOrder:100,animation:"fade",defaultDurationSeconds:30,backgroundMediaId:null,backgroundPath:null,settings:{protectedPhases:[],playlistMode:"sequential",playlistLoop:true,rotationSeconds:15},isEnabled:false,isSystem:false,triggers:[],contents:[],layouts:[{viewportKey:"default",anchorKey:"center",xPercent:50,yPercent:50,widthPercent:86,heightPercent:78,imageFit:"cover",imagePosition:"50% 50%",imageOpacity:1,tintColor:"#081b18",tintOpacity:.52,cardOpacity:.78,cardBackground:"#102a25",showCard:true,settings:{imageScalePercent:100}}],sequenceItems:[],scopes:[],widgets:[]});state.selectedKey=key;state.renderedDefinitionKey="";state.pendingMediaId=null;state.pendingBackgroundPath="";renderAll();showPanel("definition");
  }

  function updateSectionToggle(){var panel=document.querySelector("[data-customizer-panel].is-active"),button=byId("togglePanelSectionsButton"),sections=panel?panel.querySelectorAll("fieldset.compact-collapsible"):[],expanded=sections.length&&Array.prototype.every.call(sections,function(fieldset){return !fieldset.classList.contains("is-collapsed");});if(button){button.textContent=expanded?"Ringkas bagian":"Buka semua bagian";button.setAttribute("aria-pressed",expanded?"true":"false");}}
  function initializeCompactSections(){document.querySelectorAll("[data-customizer-panel] fieldset").forEach(function(fieldset,index){var legend=fieldset.querySelector(":scope > legend");if(!legend){return;}fieldset.classList.add("compact-collapsible");legend.tabIndex=0;legend.setAttribute("role","button");legend.setAttribute("aria-expanded","true");function toggle(){fieldset.classList.toggle("is-collapsed");legend.setAttribute("aria-expanded",fieldset.classList.contains("is-collapsed")?"false":"true");updateSectionToggle();}legend.addEventListener("click",toggle);legend.addEventListener("keydown",function(event){if(event.key==="Enter"||event.key===" "){event.preventDefault();toggle();}});fieldset.dataset.compactIndex=String(index);});}
  function applyCompactMode(mode){document.querySelectorAll("[data-customizer-panel]").forEach(function(panel){var visibleIndex=0;panel.querySelectorAll("fieldset.compact-collapsible").forEach(function(fieldset){var keepOpen=mode==="advanced"||visibleIndex===0;fieldset.classList.toggle("is-collapsed",!keepOpen);var legend=fieldset.querySelector(":scope > legend");if(legend){legend.setAttribute("aria-expanded",keepOpen?"true":"false");}visibleIndex+=1;});});updateSectionToggle();}
  function togglePanelSections(){var panel=document.querySelector("[data-customizer-panel].is-active"),sections=panel?panel.querySelectorAll("fieldset.compact-collapsible"):[],open=Array.prototype.some.call(sections,function(fieldset){return fieldset.classList.contains("is-collapsed");});sections.forEach(function(fieldset){fieldset.classList.toggle("is-collapsed",!open);var legend=fieldset.querySelector(":scope > legend");if(legend){legend.setAttribute("aria-expanded",open?"true":"false");}});updateSectionToggle();}
  function setPanelView(button){var panel=button&&button.closest("[data-customizer-panel]"),target=button&&button.dataset.panelViewButton;if(!panel||!target){return;}panel.querySelectorAll("[data-panel-view-button]").forEach(function(item){var active=item.dataset.panelViewButton===target;item.classList.toggle("is-active",active);item.setAttribute("aria-pressed",active?"true":"false");});panel.querySelectorAll("[data-panel-view]").forEach(function(view){view.classList.toggle("is-active",view.dataset.panelView===target);});panel.scrollTop=0;}
  function initializePanelViews(){document.querySelectorAll("[data-panel-view-button]").forEach(function(button){button.setAttribute("aria-pressed",button.classList.contains("is-active")?"true":"false");button.addEventListener("click",function(){setPanelView(button);});});}
  function setSidebarCollapsed(collapsed,persist){document.body.classList.toggle("is-sidebar-collapsed",collapsed);var button=byId("overlaySidebarToggleButton");if(button){button.setAttribute("aria-expanded",collapsed?"false":"true");button.textContent=collapsed?"Tampilkan daftar":"Sembunyikan daftar";}if(persist){try{window.localStorage.setItem("mpm:overlay-customizer:sidebar-collapsed",collapsed?"1":"0");}catch(error){}}}
  function reloadAll(){var button=byId("overlayReloadButton"),original=button.textContent;button.disabled=true;button.textContent="Memuat...";var tasks=[load()];if(window.BereavementFuneralEditor&&typeof window.BereavementFuneralEditor.reload==="function"){tasks.push(window.BereavementFuneralEditor.reload(true));}if(window.WorshipEducationEditor&&typeof window.WorshipEducationEditor.reload==="function"){tasks.push(window.WorshipEducationEditor.reload());}return Promise.all(tasks).then(function(){status("Seluruh konfigurasi overlay, event, dan materi ibadah dimuat ulang dari SQL.","success");}).catch(function(error){status("Muat ulang belum lengkap: "+error.message,"error");}).finally(function(){button.disabled=false;button.textContent=original;});}
  function ensureOverlayPreviewFrame(){
    var frame=byId("overlayPreviewFrame"),source=frame&&frame.dataset.previewSrc;
    if(frame&&source&&!frame.dataset.previewLoaded){frame.dataset.previewLoaded="1";frame.src=source;}
    return frame;
  }
  function postPreviewMessage(frame,message,attempt){
    attempt=Number(attempt||0);if(!frame||!frame.contentWindow){return;}
    var ready=false;try{ready=Boolean(frame.contentDocument&&frame.contentDocument.readyState==="complete"&&frame.contentWindow.OverlayManager);}catch(error){}
    if(ready){frame.contentWindow.postMessage(message,window.location.origin);return;}
    if(attempt<30){window.setTimeout(function(){postPreviewMessage(frame,message,attempt+1);},100);}
    else{status("Preview belum siap setelah 3 detik. Tekan Preview lagi.","error");}
  }
  function showPanel(name){document.querySelectorAll("[data-customizer-panel]").forEach(function(panel){var active=panel.dataset.customizerPanel===name;panel.classList.toggle("is-active",active);if(active){panel.scrollTop=0;}});document.querySelectorAll("[data-panel]").forEach(function(button){button.classList.toggle("is-active",button.dataset.panel===name);});if(name==="preview"){ensureOverlayPreviewFrame();}updateSectionToggle();}

  function syncPreviewSelectors(){
    var mode=value("previewMode"),prayer=byId("previewPrayer"),stage=byId("previewState");
    if(mode==="qiyamul"){prayer.value="qiyamulLail";stage.value="first_reminder";}
    else if(mode==="friday"){prayer.value="jumat";stage.value="information";}
    else if(mode==="dhuha"){if(DHUHA_KEYS.indexOf(prayer.value)<0){prayer.value="dhuhaAwwal";}stage.value="phase";}
    else if(mode==="prayer"){if(PRAYER_KEYS.indexOf(prayer.value)<0){prayer.value="subuh";}if(["pre_adzan","adzan","iqamah","prayer"].indexOf(stage.value)<0){stage.value="pre_adzan";}}
  }

  function preview(){
    var mode=value("previewMode"),prayer=value("previewPrayer"),stage=value("previewState"),lang=value("previewLanguage"),candidate;
    var previewFrame=ensureOverlayPreviewFrame();
    var simulated=value("previewSimulationTime");var simulatedAt=simulated?new Date(simulated):new Date();
    if(mode==="runtime"||mode==="custom"){
      var definition=mode==="custom"?collectDefinition():null;
      byId("previewDecisionDebug").textContent="Mengevaluasi seluruh rule pada "+simulatedAt.toLocaleString("id-ID")+"...";
      byId("previewDiagnostics").replaceChildren();
      var hijriMonth=number("previewHijriMonth",0),hijriDay=number("previewHijriDay",0),eventKey=value("previewCalendarEvent").trim();var overrides={};if(hijriMonth>=1&&hijriMonth<=12&&hijriDay>=1&&hijriDay<=30){overrides.hijriParts={month:hijriMonth,day:hijriDay};}if(eventKey){overrides.calendarEvents=[{eventKey:eventKey,nameId:eventKey,nameEn:eventKey,sourceName:"Simulasi admin"}];}
      postPreviewMessage(previewFrame,{type:"mpm:overlay-simulate",at:simulatedAt.toISOString(),definition:definition,snapshotOverrides:overrides});
      status("Scheduler dijalankan pada waktu simulasi tanpa membuat runtime command.","success");return;
    }
    {
      var isQiyamul=mode==="qiyamul",isFriday=mode==="friday",effectivePrayer=isQiyamul?"qiyamulLail":isFriday?"jumat":prayer,effectiveState=mode==="dhuha"?"phase":stage;
      var map=settingsByKey(),key=effectivePrayer+":"+effectiveState,row=map[key];if(!row){status("State preview tidak ditemukan.","error");return;}var label=lang==="en"?row.prayerLabelEn:row.prayerLabelId;var stageLabel=lang==="en"?row.stateLabelEn:row.stateLabelId;candidate={overlayKey:mode==="dhuha"?"dhuha-phases":isQiyamul?"qiyamul-lail":isFriday?"friday-prayer":"fardhu-sequence",overlayType:mode==="dhuha"?"dhuha_sequence":isQiyamul?"qiyamul_sequence":isFriday?"friday_sequence":"prayer_sequence",priority:99999,interruptionPolicy:"skip",animation:"fade",backgroundPath:row.backgroundPath,layout:layoutRow(),durationSeconds:30,content:{eyebrow:stageLabel,title:label,subtitle:"00:00:30",bodyText:lang==="en"?"Preview without changing public runtime.":"Preview tanpa mengubah runtime publik.",additionalText:"Universal Overlay Editor"},metadata:{preview:true,prayerKey:effectivePrayer,stateKey:effectiveState}};
    }
    candidate.metadata=Object.assign({},candidate.metadata||{},{simulatedAt:simulatedAt.toISOString()});
    var debug=byId("previewDecisionDebug");debug.textContent="AKTIF untuk simulasi · prioritas "+candidate.priority+" · lapisan "+(candidate.layerKey||value("definitionLayer")||"main")+" · kebijakan "+(candidate.conflictMode||value("definitionConflictMode")||"replace")+(simulated?" · waktu "+new Date(simulated).toLocaleString("id-ID"):" · waktu aktual");
    postPreviewMessage(previewFrame,{type:"mpm:overlay-preview",candidate:candidate});status("Preview dikirim ke frame; tidak ada runtime command yang dibuat.","success");
  }

  function receivePreviewResult(event){
    if(event.origin!==window.location.origin||!event.data||event.data.type!=="mpm:overlay-simulation-result"){return;}
    var active=event.data.active||[],diagnostics=event.data.diagnostics||[],debug=byId("previewDecisionDebug");
    debug.textContent=active.length?("AKTIF "+active.length+" overlay pada "+new Date(event.data.at).toLocaleString("id-ID")+" · "+active.map(function(item){var endValue=Number(item.endsAt||0),until=!endValue?"":endValue>4102444800000?" · tanpa batas":" sampai "+new Date(endValue).toLocaleTimeString("id-ID");return item.overlayKey+" ["+item.layerKey+", P"+item.priority+"]"+until;}).join(" · ")):("TIDAK ADA OVERLAY AKTIF pada "+new Date(event.data.at).toLocaleString("id-ID")+". Lihat alasan di bawah.");
    var host=byId("previewDiagnostics");host.replaceChildren();diagnostics.slice(0,80).forEach(function(item){var row=document.createElement("div");row.className="diagnostic-row "+(item.status||"");var name=document.createElement("strong");name.textContent=item.overlayKey||"overlay";var reason=document.createElement("span");reason.textContent=(item.status||"status")+" · "+(item.reason||"-")+(item.triggerKey?" · "+item.triggerKey:"");row.append(name,reason);host.appendChild(row);});
  }

  function contentForLanguage(definition, language) {
    var rows = definition && definition.contents || [];
    return rows.find(function (row) { return row.languageCode === language && row.contentKey === "main"; }) ||
      rows.find(function (row) { return row.languageCode === "id" && row.contentKey === "main"; }) || rows[0] || {};
  }
  function candidateFromDefinition(definition, language) {
    if (!definition) { return null; }
    var content = contentForLanguage(definition, language || "id");
    var layout = definition.layouts && definition.layouts[0] || {};
    var media = mediaById(definition.backgroundMediaId);
    return {
      candidateKey: "customizer:" + definition.overlayKey,
      overlayKey: definition.overlayKey,
      overlayType: definition.overlayType,
      priority: Number(definition.priority || 100),
      interruptionPolicy: definition.interruptionPolicy || "queue",
      conflictMode: definition.conflictMode || "replace",
      isInterruptible: definition.isInterruptible !== false,
      layerKey: definition.layerKey || "main",
      layerOrder: Number(definition.layerOrder || 100),
      animation: definition.animation || "fade",
      durationSeconds: Math.max(5, Number(definition.defaultDurationSeconds || 30)),
      language: language || "id",
      backgroundPath: definition.backgroundPath || null,
      backgroundMedia: media || null,
      settings: Object.assign({}, definition.settings || {}),
      content: Object.assign({}, content),
      layout: Object.assign({}, layout),
      sequenceItems: (definition.sequenceItems || []).map(function (item) { return Object.assign({}, item); }),
      widgets: (definition.widgets || []).map(function (widget) { return Object.assign({}, widget); }),
      metadata: { preview: true, customizerSection: true, sourceDefinitionKey: definition.overlayKey }
    };
  }
  function definitionForPrayer(prayerKey) {
    var overlayKey = DHUHA_KEYS.indexOf(prayerKey) >= 0 ? "dhuha-phases" : prayerKey === "qiyamulLail" ? "qiyamul-lail" : prayerKey === "jumat" ? "friday-prayer" : "fardhu-sequence";
    return state.snapshot && state.snapshot.definitions.find(function (definition) { return definition.overlayKey === overlayKey; });
  }
  function buildPrayerPreviewCandidate(settingKey, language) {
    var rows = readPrayerRows(), row = rows.find(function (item) { return item.prayerKey + ":" + item.stateKey === settingKey; });
    if (!row) { return null; }
    var base = candidateFromDefinition(definitionForPrayer(row.prayerKey), language) || {};
    var label = language === "en" ? row.prayerLabelEn : row.prayerLabelId;
    var stateLabel = language === "en" ? row.stateLabelEn : row.stateLabelId;
    base.candidateKey = "customizer-prayer:" + settingKey;
    base.backgroundPath = row.backgroundPath || base.backgroundPath || null;
    base.backgroundMedia = mediaForPath(base.backgroundPath) || base.backgroundMedia || null;
    base.durationSeconds = Math.max(5, Number(row.displayDurationSeconds || row.durationSeconds || 30));
    base.content = Object.assign({}, base.content || {}, {
      eyebrow: stateLabel,
      title: label,
      subtitle: "00:00:30",
      bodyText: language === "en" ? "Live draft preview using the production index renderer." : "Preview draft langsung memakai renderer index produksi.",
      additionalText: language === "en" ? "Changes are not saved yet." : "Perubahan belum disimpan."
    });
    base.metadata = Object.assign({}, base.metadata || {}, { prayerKey: row.prayerKey, stateKey: row.stateKey, customizerSection: "prayer" });
    return base;
  }
  function buildSectionPreviewCandidate(section, options) {
    options = options || {};
    if (!state.snapshot) { return null; }
    if (section === "prayer") { return buildPrayerPreviewCandidate(options.stateKey || "subuh:pre_adzan", options.language || "id"); }
    if (["definition", "layout", "orchestration"].indexOf(section) >= 0) { return candidateFromDefinition(collectDefinition(), options.language || "id"); }
    return null;
  }
  function sectionDraft(section) {
    if (section === "prayer") { return readPrayerRows(); }
    if (["definition", "layout", "orchestration"].indexOf(section) >= 0) { return collectDefinition(); }
    return null;
  }
  function resetSectionDraft(section) {
    if (section === "prayer") { renderPrayerSettings(); }
    else if (["definition", "layout", "orchestration"].indexOf(section) >= 0) { state.renderedDefinitionKey = ""; renderDefinitionForm(); }
    notifyCustomizer("loaded", section, { resetDraft: true });
  }
  function saveSectionDraft(section) {
    if (section === "prayer") { byId("savePrayerSettingsButton").click(); return; }
    if (["definition", "layout", "orchestration"].indexOf(section) >= 0) { saveDefinition(); }
  }

  function activate(){var definition=selectedDefinition();if(!definition){return;}status("Mengaktifkan overlay manual...");post({action:"activate",overlayKey:definition.overlayKey,commandType:definition.overlayType==="emergency"?"emergency":"manual",durationSeconds:60,payload:{content:{additionalText:"Manual · Universal Overlay Editor"}}}).then(function(snapshot){state.snapshot=snapshot;renderAll();status("Overlay aktif 60 detik pada index.html.","success");}).catch(function(error){status("Aktivasi gagal: "+error.message,"error");});}
  function saveGlobalCardStyle(){status("Menyimpan default visual seluruh card...");post({action:"save_global_card_style",cardStyle:readCardStyle("global")}).then(function(snapshot){state.snapshot=snapshot;renderAll();status("Default card global tersimpan dan diterapkan pada seluruh overlay.","success");notifyCustomizer("saved","layout");}).catch(function(error){status("Gagal menyimpan default card: "+error.message,"error");});}
  function setExperienceMode(mode,persist){var normalized=mode==="advanced"?"advanced":"simple";document.body.dataset.experienceMode=normalized;byId("customizerExperienceMode").value=normalized;applyCompactMode(normalized);if(persist){try{window.localStorage.setItem("mpm:overlay-customizer:experience-mode",normalized);}catch(error){}}}

  function bind(){
    byId("overlayReloadButton").addEventListener("click",reloadAll);byId("overlaySidebarToggleButton").addEventListener("click",function(){setSidebarCollapsed(!document.body.classList.contains("is-sidebar-collapsed"),true);});byId("togglePanelSectionsButton").addEventListener("click",togglePanelSections);byId("overlayNewButton").addEventListener("click",newDefinition);byId("overlayDefinitionForm").addEventListener("submit",function(event){event.preventDefault();saveDefinition();});byId("addTriggerButton").addEventListener("click",addTrigger);byId("addScopeButton").addEventListener("click",addScope);byId("addSequenceItemButton").addEventListener("click",addSequence);byId("saveLayoutButton").addEventListener("click",saveDefinition);byId("saveGlobalCardStyleButton").addEventListener("click",saveGlobalCardStyle);byId("saveOrchestrationButton").addEventListener("click",saveDefinition);byId("mediaUploadForm").addEventListener("submit",uploadMedia);byId("externalMediaForm").addEventListener("submit",registerExternalMedia);byId("activateDefinitionButton").addEventListener("click",activate);byId("runPreviewButton").addEventListener("click",preview);byId("previewMode").addEventListener("change",syncPreviewSelectors);
    byId("applyOverlayPresetButton").addEventListener("click",applyPreset);byId("externalSuggestionForm").addEventListener("submit",submitSuggestion);byId("customizerExperienceMode").addEventListener("change",function(){setExperienceMode(this.value,true);});
    document.querySelectorAll('#widgetChecklist input[type="checkbox"]').forEach(function(input){input.addEventListener("change",syncWidgetsFromChecklist);});
    byId("mediaSearchInput").addEventListener("input",renderMedia);byId("mediaCategoryFilter").addEventListener("change",renderMedia);byId("mediaKindFilter").addEventListener("change",renderMedia);
    byId("restoreAllDefaultsButton").addEventListener("click",function(){if(!window.confirm("Pulihkan seluruh definisi sistem, konten, layout, sequence, dan timing ke default? Overlay custom tidak dihapus.")){return;}status("Memulihkan seluruh default...");post({action:"restore_defaults"}).then(function(snapshot){state.snapshot=snapshot;state.selectedKey="fardhu-sequence";renderAll();status("Seluruh default sistem dipulihkan. Overlay custom tetap disimpan.","success");notifyCustomizer("saved","all",{restoredDefaults:true});}).catch(function(error){status("Restore penuh gagal: "+error.message,"error");});});
    byId("definitionBackgroundMedia").addEventListener("change",function(){var media=mediaById(this.value);state.pendingMediaId=media?Number(media.id):null;state.pendingBackgroundPath="";if(media){byId("definitionBackgroundPath").value=media.publicUrl;}renderBackgroundStudio();});
    byId("definitionBackgroundPath").addEventListener("input",syncEditorPreview);
    byId("quickBackgroundSelect").addEventListener("change",updateQuickBackgroundPreview);
    byId("quickBackgroundEditButton").addEventListener("click",editQuickBackground);
    byId("quickBackgroundUseButton").addEventListener("click",useQuickBackground);
    byId("quickBackgroundUploadButton").addEventListener("click",uploadQuickBackground);
    byId("quickBackgroundDeleteButton").addEventListener("click",deleteQuickBackground);
    byId("mediaUploadInput").addEventListener("change",previewUpload);
    byId("applyBackgroundMediaButton").addEventListener("click",function(){applySelectedBackground(false);});
    byId("resetBackgroundImageButton").addEventListener("click",resetBackgroundImage);
    byId("zoomOutBackgroundButton").addEventListener("click",function(){setEditorNumber("layoutImageScale",number("layoutImageScale",100)-10,100,300,100);syncEditorPreview();});
    byId("zoomInBackgroundButton").addEventListener("click",function(){setEditorNumber("layoutImageScale",number("layoutImageScale",100)+10,100,300,100);syncEditorPreview();});
    byId("resetOverlayPositionButton").addEventListener("click",resetOverlayPosition);
    ["layoutImageX","layoutImageY","layoutImageScale","layoutFit","layoutImageOpacity","layoutTintColor","layoutTintOpacity","layoutAnchor","layoutX","layoutY","layoutWidth","layoutHeight"].concat(Object.keys(CARD_STYLE_IDS).map(function(key){var node=cardNode("layout",key);return node&&node.id;})).filter(Boolean).forEach(function(id){byId(id).addEventListener("input",syncEditorPreview);byId(id).addEventListener("change",syncEditorPreview);});
    byId("layoutImageScaleRange").addEventListener("input",function(){byId("layoutImageScale").value=this.value;syncEditorPreview();});
    var editorStage=byId("backgroundEditorStage");editorStage.addEventListener("pointerdown",beginEditorDrag);editorStage.addEventListener("pointermove",moveEditorDrag);editorStage.addEventListener("pointerup",endEditorDrag);editorStage.addEventListener("pointercancel",endEditorDrag);editorStage.addEventListener("wheel",zoomEditor,{passive:false});
    byId("applyBulkDurationsButton").addEventListener("click",function(){var durations={pre_adzan:number("bulkPreAdzan",10),adzan:number("bulkAdzan",2),iqamah:number("bulkIqamah",10),prayer:number("bulkPrayer",20)};document.querySelectorAll('#prayerSettingsBody tr[data-setting-key]').forEach(function(row){var stage=row.dataset.settingKey.split(":")[1];row.querySelector('[data-setting-field="durationMinutes"]').value=durations[stage];});status("Durasi diterapkan di form. Klik Simpan timing untuk menyimpan SQL.","success");});
    byId("savePrayerSettingsButton").addEventListener("click",function(){status("Menyimpan timing...");post({action:"save_prayer_settings",prayerSettings:readPrayerRows()}).then(function(snapshot){state.snapshot=snapshot;renderAll();status("Timing sholat, Jumat, Dhuha, dan Qiyamul Lail tersimpan di SQL.","success");notifyCustomizer("saved","prayer");}).catch(function(error){status("Gagal menyimpan timing: "+error.message,"error");});});
    byId("restorePrayerDefaultsButton").addEventListener("click",function(){if(!window.confirm("Kembalikan durasi dan background sholat, Jumat, Dhuha, dan Qiyamul Lail ke default?")){return;}post({action:"restore_prayer_defaults"}).then(function(snapshot){state.snapshot=snapshot;renderAll();status("Default dipulihkan ke SQL.","success");notifyCustomizer("saved","prayer",{restoredDefaults:true});}).catch(function(error){status("Restore gagal: "+error.message,"error");});});
    document.querySelectorAll("[data-panel]").forEach(function(button){button.addEventListener("click",function(){showPanel(button.dataset.panel);if(button.dataset.panel==="layout"){renderBackgroundStudio();}});});
    byId("overlayAdminToken").addEventListener("change",function(){try{window.sessionStorage.setItem("mpm:overlay-admin-token",this.value);}catch(error){}load();});
    window.addEventListener("message",receivePreviewResult);
  }

  window.OverlayCustomizerCore = {
    reload: load,
    snapshot: function () { return state.snapshot; },
    selectedDefinition: selectedDefinition,
    buildPreviewCandidate: buildSectionPreviewCandidate,
    draft: sectionDraft,
    resetDraft: resetSectionDraft,
    saveDraft: saveSectionDraft,
    showPanel: showPanel,
    ensurePreviewFrame: ensureOverlayPreviewFrame
  };
  function boot(){var experience="simple",sidebarCollapsed=false;try{byId("overlayAdminToken").value=window.sessionStorage.getItem("mpm:overlay-admin-token")||"";experience=window.localStorage.getItem("mpm:overlay-customizer:experience-mode")||"simple";sidebarCollapsed=window.localStorage.getItem("mpm:overlay-customizer:sidebar-collapsed")==="1";}catch(error){}observeVisibleTerminology();initializeCompactSections();initializePanelViews();setExperienceMode(experience,false);setSidebarCollapsed(sidebarCollapsed,false);bind();load();}
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window, document);
