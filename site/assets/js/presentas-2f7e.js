(function () {
  "use strict";
  var api = "api/islamic-text.php", actor = "local-user", catalog = null, items = [], current = null, reviewIndex = 0, listPage = 0, pageSize = 10;
  try { actor = localStorage.getItem("mpm:iqro:actor-id:v1") || actor; } catch (_) {}
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[c]; }); };
  var opt = function (v, label, disabled) { return "<option value=\"" + esc(v) + "\"" + (disabled ? " disabled" : "") + ">" + esc(label) + "</option>"; };
  function get(resource, query) {
    query = query || {}; query.resource = resource;
    return fetch(api + "?" + new URLSearchParams(query), { headers: { "X-Actor-Id": actor } }).then(function (r) { return r.json(); }).then(function (x) { if (!x.success) throw Error(x.error || "Gagal memuat data"); return x.data; });
  }
  function post(body) {
    body.actorId = actor;
    return fetch(api, { method: "POST", headers: { "Content-Type": "application/json", "X-Actor-Id": actor, "X-CSRF-Token":window.MpmUserSession?.csrf||"" }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }).then(function (x) { if (!x.success) throw Error(x.error || "Gagal menyimpan"); return x.data; });
  }
  const ui=value=>window.PrayerI18n.uiText(value);
  function profileHtml(profile){
    if(!profile)return '';
    const fields=window.MpmProfileFields||[],en=document.documentElement.lang==='en';
    const details=Object.entries(profile.details||{}).filter(([key,value])=>fields.some(f=>f[0]===key)&&value!==null&&String(value).trim()!=='');
    const photo=typeof profile.photo==='string'&&/^data:image\/(png|jpeg|gif|webp|svg\+xml|bmp|avif);base64,[A-Za-z0-9+/=]+$/.test(profile.photo)?profile.photo:'assets/avatar.svg';
    return '<section class="presentation-author"><img src="'+esc(photo)+'" alt="" width="64" height="80"><div><strong>'+esc(ui('Pembuat materi'))+'</strong><p translate="no">'+esc(profile.name||'')+'</p>'+(profile.uniqueId?'<small translate="no">'+esc(profile.uniqueId)+'</small>':'')+'</div><details><summary>'+esc(ui('Profil pembuat'))+'</summary><dl>'+details.map(([key,value])=>'<dt>'+esc(fields.find(f=>f[0]===key)[en?2:1])+'</dt><dd translate="no">'+esc(window.MpmProfileDisplay?MpmProfileDisplay(key,value,en):value)+'</dd>').join('')+'</dl></details></section>';
  }
  async function downloadPresentation(id){
    const button=document.querySelector('[data-export-presentation="'+id+'"]');if(button)button.disabled=true;
    try{const data=await get('presentation_export',{id});const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='presentation-'+id+'.mpm.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('presentationExchangeStatus').textContent=ui('Paket presentasi diunduh.');}
    catch(error){$('presentationExchangeStatus').textContent=ui(error.message);}finally{if(button)button.disabled=false;}
  }
  let pendingPackage=null;
  $('presentationImportButton').addEventListener('click',()=>{
    if(!window.MpmUserSession?.user){$('presentationExchangeStatus').textContent=ui('Login required to import a presentation.');return;}
    $('presentationImportFile').click();
  });
  $('presentationImportFile').addEventListener('change',async function(){
    const file=this.files[0];if(!file)return;this.value='';pendingPackage=null;
    $('presentationImportConfirm').disabled=true;
    try{
      if(file.size>33554432)throw Error('Presentation package exceeds 32 MiB.');
      const data=JSON.parse(await file.text()),preview=await post({action:'validate_presentation_package',package:data});pendingPackage=data;
      $('presentationImportPreview').innerHTML='<h3 translate="no">'+esc(preview.title)+'</h3><p translate="no">'+esc(preview.description||'')+'</p><p>'+preview.items.length+' '+esc(ui('slide'))+' - '+esc([...new Set(preview.items.map(item=>item.language))].join(', '))+'</p>'+profileHtml(preview.creator);
      $('presentationImportConfirm').disabled=false;$('presentationImportDialog').showModal();
    }catch(error){$('presentationExchangeStatus').textContent=ui(error instanceof SyntaxError?'Invalid JSON presentation package.':error.message);}
  });
  $('presentationImportConfirm').addEventListener('click',async function(){
    if(!pendingPackage)return;this.disabled=true;
    try{const imported=await post({action:'import_presentation',package:pendingPackage});pendingPackage=null;$('presentationImportDialog').close();await loadList();await openPresentation(imported.id,'review');$('presentationExchangeStatus').textContent=ui('Presentasi diimpor sebagai draft baru.');}
    catch(error){$('presentationExchangeStatus').textContent=ui(error.message);}finally{this.disabled=false;}
  });
  document.addEventListener('click',event=>{const button=event.target.closest('[data-export-presentation]');if(button)downloadPresentation(button.dataset.exportPresentation);});
  window.addEventListener('mpm:language-changed',()=>{if(current){$('presentationCreator').innerHTML=profileHtml(current.creator);renderReview();}loadList();});
  window.addEventListener('mpm:user-session-ready',()=>loadList());
  function label(language) { return language === "id" ? (document.documentElement.lang === "en" ? "Indonesian" : "Indonesia") : language === "ar" ? (document.documentElement.lang === "en" ? "Arabic" : "Arab") : "English"; }
  function resetItem(item) { item.sourceId = ""; item.referenceId = ""; item.surahIds = []; item.tafsirWorkIds = []; item.hadithId = null; item.collectionId = ""; item.bookId = ""; item.chapterId = ""; item.ayahStart = 1; item.ayahEnd = 1; item.manualContent = ""; }
  function resetSourceSelection(item) {
    item.sourceId = ""; item.referenceId = ""; item.hadithId = ""; item.bookId = ""; item.chapterId = "";
    if (item.type !== "text" && item.type !== "manual" && item.type !== "image") { item.ayahStart = 1; item.ayahEnd = 1; }
  }
  function imagePreview(item) {
    return item.manualContent && /^data:image\/(?:jpeg|png|gif|webp|svg\+xml|bmp|avif);base64,/i.test(item.manualContent)
      ? "<div class=\"presentation-image-preview\"><img src=\"" + esc(item.manualContent) + "\" alt=\"" + esc(item.label || "Pratinjau gambar") + "\"></div>"
      : "<div class=\"it-help\">Belum ada gambar dipilih.</div>";
  }
  function sourceOptions(item) {
    if (!catalog) return opt("", "Pilih bahasa terlebih dahulu", true);
    if (item.type === "quran") return (catalog.quranSources || []).map(function (s) { return opt(s.id, s.name); }).join("") || opt("", "Tidak ada sumber Qur'an", true);
    if (item.type === "tafsir") return (catalog.tafsirs || []).map(function (s) { return opt(s.id, s.title + (s.author ? " - " + s.author : "")); }).join("") || opt("", "Tidak ada tafsir", true);
    return (catalog.collections || []).map(function (s) { return opt(s.id, s.name); }).join("") || opt("", "Tidak ada koleksi hadis", true);
  }
  function referenceOptions(item) {
    if (!catalog) return opt("", "Pilih bahasa terlebih dahulu", true);
    if (item.type === "quran") return (catalog.surahs || []).filter(function (s) { return String(s.sourceIds || "").split(",").indexOf(String(item.sourceId)) >= 0; }).map(function (s) { return opt(s.id, s.number + " - " + s.name); }).join("");
    if (item.type === "tafsir") {
      var seenSurahs = {};
      return (catalog.tafsirReferences || []).filter(function (s) {
        if (String(s.workId) !== String(item.sourceId) || seenSurahs[s.surahId]) return false;
        seenSurahs[s.surahId] = true;
        return true;
      }).map(function (s) { return opt(s.id, (s.surahNumber ? s.surahNumber + " - " : "") + s.surahName); }).join("") || opt("", "Tidak ada referensi surah", true);
    }
    if (!item.sourceId) return opt("", "Pilih koleksi terlebih dahulu", true);
    if (!item.bookId) return opt("", "Pilih kitab terlebih dahulu", true);
    var hadiths = (catalog.hadiths || []).filter(function (h) {
      return String(h.collectionId) === String(item.sourceId) &&
        String(h.bookId) === String(item.bookId) &&
        (!item.chapterId || String(h.chapterId) === String(item.chapterId));
    });
    return hadiths.map(function (h) { return opt(h.id, (h.number ? "No. " + h.number + " - " : "") + h.name); }).join("") || opt("", "Tidak ada hadis pada kitab ini", true);
  }
  function renderItem(item, index) {
    if(item.snapshotItemId){
      const c=item.snapshot||{},text=(c.ayahs||[]).map(a=>(a.arabic||'')+'\n'+(a.translation||'')).concat((c.tafsir||[]).map(t=>t.text||''),c.hadith?[(c.hadith.arabic||'')+'\n'+(c.hadith.translation||'')]:[]).join('\n\n');
      return '<article class="it-learning-admin-row" data-index="'+index+'"><strong>Slide '+(index+1)+'</strong><p class="it-help">'+esc(ui('Salinan sumber impor; isi sumber dipertahankan.'))+'</p><button type="button" class="it-button small" data-move-item="up" data-index="'+index+'">'+esc(ui('Naik'))+'</button><button type="button" class="it-button small" data-move-item="down" data-index="'+index+'">'+esc(ui('Turun'))+'</button><button type="button" class="it-button small" data-remove-item="'+index+'">'+esc(ui('Hapus'))+'</button><label>'+esc(ui('Judul/label slide'))+'<input data-field="label" value="'+esc(item.label||'')+'"></label><details><summary>'+esc(ui('Lihat isi sumber'))+'</summary><p translate="no" style="white-space:pre-wrap">'+esc(text)+'</p></details></article>';
    }
    var source = sourceOptions(item), refs = referenceOptions(item), books = item.type === "hadith" && catalog ? (catalog.books || []).filter(function (b) { return String(b.collectionId) === String(item.sourceId); }).map(function (b) { return opt(b.id, b.number + " - " + b.name); }).join("") : "";
    var chapterRows = item.type === "hadith" && catalog ? (catalog.chapters || []).filter(function (c) { return String(c.bookId) === String(item.bookId); }) : [];
    var chapters = chapterRows.map(function (c) { return opt(c.id, c.number + " - " + c.name); }).join("");
    if (item.type === "hadith" && item.sourceId && !books) books = opt("", "Tidak ada kitab pada koleksi ini", true);
    var chapterControl = item.type === "hadith" && catalog && (catalog.chapters || []).length
      ? "<label>Bab (opsional)<select data-field=\"chapterId\">" + opt("", chapterRows.length ? "Semua bab" : "Tidak ada bab pada kitab ini", !chapterRows.length) + chapters + "</select></label>"
      : "";
    var controls = item.type === "image" || item.type === "text" ? "" : item.type === "quran" ? "<label>Sumber<select data-field=\"sourceId\">" + opt("", "Pilih sumber") + source + "</select></label><label>Surah / referensi<select data-field=\"referenceId\">" + opt("", "Pilih surah") + refs + "</select></label>" :
      item.type === "tafsir" ? "<label>Mufassir / karya<select data-field=\"sourceId\">" + opt("", "Pilih mufassir/karya") + source + "</select></label><label>Referensi ayat<select data-field=\"referenceId\">" + opt("", "Pilih karya") + refs + "</select></label>" :
      "<label>Koleksi<select data-field=\"sourceId\">" + opt("", "Pilih koleksi") + source + "</select></label><label>Kitab<select data-field=\"bookId\">" + opt("", "Pilih kitab") + books + "</select></label>" + chapterControl + "<label>Nomor / referensi hadis<select data-field=\"hadithId\">" + opt("", "Pilih hadis") + refs + "</select></label>";
    var imageControl = item.type === "image" ? "<label>File gambar (maks. 12 MB)<input type=\"file\" accept=\"image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp,image/avif\" data-image-upload></label>" + imagePreview(item) : "";
    var textControl = item.type === "text" || item.type === "manual" ? "<label>Isi materi<textarea data-field=\"manualContent\" rows=\"8\" maxlength=\"50000\" placeholder=\"Tulis isi materi presentasi...\">" + esc(item.manualContent || "") + "</textarea></label>" : "";
    var rangeControl = item.type === "image" || item.type === "text" ? "" : "<div class=\"it-fields-2\"><label>" + (item.type === "hadith" ? "Dalil mulai" : "Ayat mulai") + "<input data-field=\"ayahStart\" type=\"number\" min=\"1\" value=\"" + esc(item.ayahStart || 1) + "\"></label><label>" + (item.type === "hadith" ? "Dalil akhir" : "Ayat akhir") + "<input data-field=\"ayahEnd\" type=\"number\" min=\"1\" value=\"" + esc(item.ayahEnd || 1) + "\"></label></div>";
    return "<article class=\"it-learning-admin-row\" data-index=\"" + index + "\"><div><strong>Slide " + (index + 1) + " - " + esc(label($("presentationLanguage").value)) + " / " + esc(item.type) + "</strong> <button type=\"button\" data-move-item=\"up\" data-index=\"" + index + "\" class=\"it-button small\"" + (index === 0 ? " disabled" : "") + ">Naik</button> <button type=\"button\" data-move-item=\"down\" data-index=\"" + index + "\" class=\"it-button small\"" + (index === items.length - 1 ? " disabled" : "") + ">Turun</button> <button type=\"button\" data-remove-item=\"" + index + "\" class=\"it-button small\">Hapus</button></div>" + controls + imageControl +
      textControl + rangeControl + "<label>Judul/label slide<input data-field=\"label\" value=\"" + esc(item.label || "") + "\"></label>" + (item.type === "hadith" ? "<div class=\"it-hadith-preview\" data-hadith-preview>" + esc(item.previewText || "Pilih nomor hadis untuk melihat isi hadis dalam Bahasa " + label($("presentationLanguage").value) + ".") + "</div>" : "") + "</article>";
  }
  function syncItems() {
    Array.prototype.forEach.call($("presentationItemEditor").querySelectorAll("[data-index]"), function (card) {
      var item = items[Number(card.dataset.index)];
      card.querySelectorAll("[data-field]").forEach(function (el) { item[el.dataset.field] = el.type === "number" ? Number(el.value) || null : el.value; });
    });
  }
  function renderItemList() {
    var list = $("presentationItemListView");
    if (!list) return;
    list.innerHTML = items.length
      ? "<div class=\"presentation-item-list-heading\"><strong>Daftar laman</strong><span>" + items.length + " item</span></div>" +
        items.map(function (item, index) {
          return "<button type=\"button\" class=\"presentation-item-list-row\" data-select-item=\"" + index + "\"><strong>Laman " + (index + 1) + "</strong><span>" + esc(item.label || (item.type === "text" || item.type === "manual" ? "Teks penceramah" : item.type === "image" ? "Gambar" : item.type)) + "</span><small>" + esc(item.type) + "</small></button>";
        }).join("")
      : "<div class=\"it-empty\">Belum ada laman. Tambahkan slide untuk mulai mengedit.</div>";
  }
  function renderItems() { renderItemList(); $("presentationItemEditor").innerHTML = items.map(renderItem).join("") || "<div class=\"it-empty\">Pilih bahasa dan jenis sumber, lalu tambah slide.</div>"; items.forEach(function (item, i) { var card = $("presentationItemEditor").querySelector("[data-index=\"" + i + "\"]"); if (!card) return; ["sourceId", "referenceId", "bookId", "chapterId", "hadithId"].forEach(function (key) { var node = card.querySelector("[data-field=\"" + key + "\"]"); if (node && item[key]) node.value = item[key]; }); }); }
  function loadHadithPreview(item, card) {
    var selected = (catalog.hadiths || []).find(function (h) { return String(h.id) === String(item.hadithId); });
    var box = card && card.querySelector("[data-hadith-preview]");
    if (!box || !selected || !selected.internalId) return;
    box.textContent = "Memuat isi hadis Bahasa " + label($("presentationLanguage").value) + "...";
    get("hadith", { id: selected.internalId, language: $("presentationLanguage").value }).then(function (data) {
      var translation = (data.translations || []).find(function (t) { return t.language === $("presentationLanguage").value; }) || data.translations && data.translations[0];
      box.innerHTML = "<strong>" + esc(data.collection || "") + (data.hadithNumber ? " - No. " + esc(data.hadithNumber) : "") + "</strong><div class=\"it-learning-arabic\" dir=\"rtl\">" + esc(data.arabic || "") + "</div><p>" + esc(translation ? translation.text : "Terjemahan bahasa ini tidak tersedia.") + "</p>";
    }).catch(function (e) { box.textContent = e.message; });
  }
  function loadCatalog(language) { return get("presentation_catalog", { language: language }).then(function (data) { catalog = data; $("presentationItemType").disabled = false; renderItems(); }); }
  function resetForLanguage() {
    syncItems();
    var language = $("presentationLanguage").value;
    items.forEach(function (item) { if (!item.snapshotItemId) { item.language = language; resetSourceSelection(item); } });
    catalog = null;
    $("presentationItemType").value = "";
    $("presentationItemType").disabled = true;
    $("presentationAddItem").disabled = true;
    $("presentationItemEditor").innerHTML = items.length
      ? "<div class=\"it-empty\">Memuat daftar sumber Bahasa " + label(language) + "...</div>"
      : "<div class=\"it-empty\">Pilih bahasa dan jenis sumber, lalu tambah slide.</div>";
    renderItemList();
    if (language) loadCatalog(language).catch(function (e) { $("presentationItemEditor").innerHTML = "<div class=\"it-empty\">" + esc(e.message) + "</div>"; });
  }
  function languageNames(value) { return String(value || "").split(",").filter(Boolean).map(function (v) { return label(v); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(", ") || "—"; }
  function formatDate(value) { if (!value) return "—"; var date = new Date(String(value).replace(" ", "T")); return isNaN(date.getTime()) ? String(value) : date.toLocaleString(document.documentElement.lang === "en" ? "en-GB" : "id-ID"); }
  function renderList(data) { var rows = data.items || []; $("presentationList").innerHTML = rows.map(function (p) { return "<article class=\"it-learning-admin-row\"><div><h3>" + esc(p.title) + "</h3><p>" + esc(p.status) + " · " + esc(languageNames(p.languages)) + " · " + p.itemCount + " item</p><p class=\"it-help\">Dibuat: " + esc(formatDate(p.createdAt)) + " · Diperbarui: " + esc(formatDate(p.updatedAt)) + "</p></div><div class=\"it-source-actions\"><button type=\"button\" class=\"it-button small\" data-export-presentation=\"" + p.id + "\">Unduh paket</button><button type=\"button\" class=\"it-button small\" data-review-presentation=\"" + p.id + "\">Review</button><button type=\"button\" class=\"it-button primary small\" data-start-presentation=\"" + p.id + "\">Buka Presentasi</button><button type=\"button\" class=\"it-button small\" data-edit-presentation=\"" + p.id + "\">Edit</button><button type=\"button\" class=\"it-button small\" data-delete-presentation=\"" + p.id + "\">Hapus</button></div></article>"; }).join("") || "<div class=\"it-empty\">Belum ada presentasi.</div>"; $("presentationPageLabel").textContent = data.total ? "1 / " + Math.max(1, Math.ceil(data.total / pageSize)) : "0 / 0"; }
  function loadList() { return get("presentations", { q: $("presentationSearch").value, status: $("presentationStatus").value, limit: pageSize, offset: listPage * pageSize }).then(renderList).catch(function (e) { $("presentationList").innerHTML = "<div class=\"it-empty\">" + esc(e.message) + "</div>"; }); }
  function activatePresentationEditor() {
    var tab = document.querySelector('.it-tabs button[data-tab="presentasi"]');
    if (tab) tab.click();
    var panel = document.querySelector('.it-panel[data-panel="presentasi"]');
    if (panel) panel.classList.add("presentation-editing");
    $("presentationBuilderForm").classList.remove("it-hidden");
  }
  function leavePresentationEditor() {
    var panel = document.querySelector('.it-panel[data-panel="presentasi"]');
    if (panel) panel.classList.remove("presentation-editing", "presentation-viewing");
  }
  function activatePresentationViewer() {
    var tab = document.querySelector('.it-tabs button[data-tab="presentasi"]');
    if (tab) tab.click();
    var panel = document.querySelector('.it-panel[data-panel="presentasi"]');
    if (panel) panel.classList.add("presentation-viewing");
  }
  function setEditorMode(isEdit, id, title) {
    $("presentationEditorTitle").textContent = isEdit ? "Edit Materi Presentasi" : "Tambah Materi Presentasi";
    $("presentationEditorMode").textContent = isEdit
      ? "Mode edit aktif · ID materi " + id + " · " + (title || "Materi dipilih") + ". Data dimuat dari database."
      : "Mode tambah aktif: buat materi baru.";
    $("presentationSaveButton").textContent = isEdit ? "Simpan Perubahan" : "Simpan Materi Baru";
  }
  window.MpmPresentationRoute = {close: function(){leavePresentationEditor();$("presentationReview").classList.add("it-hidden");}, open: function(id, page, mode) {
    return openPresentation(id, mode === "edit" ? "edit" : "review").then(function(){
      reviewIndex = Math.max(0, Math.min((current.items || []).length-1, (Number(page)||1)-1));
      renderReview();
    });
  }};
  function renderReview() {
    const en=document.documentElement.lang==="en";
    if (!current || !current.items || !current.items.length) { $("presentationReviewItems").innerHTML = "<div class=\"it-empty\">" + esc(ui("Tidak ada item.")) + "</div>"; return; }
    if (document.querySelector('[data-panel="presentasi"].active')) window.MpmReaderNavigation?.update({panel:"presentasi",card:document.querySelector(".presentation-editing")?"presentationBuilderForm":"presentationReview",presentation:current.id,slide:reviewIndex+1,mode:document.querySelector(".presentation-editing")?"edit":"review"});
    var item = current.items[reviewIndex], content = item.content || {}, body = "";
    if (content.ayahs) body += content.ayahs.map(function (a) { return "<article><div class=\"it-learning-arabic\" dir=\"rtl\" lang=\"ar\">" + esc(a.arabic) + "</div><p>" + esc(a.translation || "") + "</p></article>"; }).join("");
    if (content.tafsir) body += content.tafsir.map(function (t) { return "<article><strong>" + esc(t.title) + "</strong><p>" + esc(t.text) + "</p></article>"; }).join("");
    if (content.hadith) {
      var hadith = content.hadith, sourceParts = [];
      if (hadith.collectionName) sourceParts.push((en ? "Source: " : "Sumber: ") + hadith.collectionName);
      if (hadith.hadithNumber) sourceParts.push("No. " + hadith.hadithNumber);
      if (hadith.bookName) sourceParts.push((en ? "Book: " : "Kitab: ") + hadith.bookName);
      if (hadith.chapterName) sourceParts.push((en ? "Chapter: " : "Bab: ") + hadith.chapterName);
      body += "<article><p class=\"it-hadith-source\"><strong>" + esc(sourceParts.join(" · ") || (en ? "Hadith source unavailable" : "Sumber hadis belum tersedia")) + "</strong></p><div class=\"it-learning-arabic\" dir=\"rtl\" lang=\"ar\">" + esc(hadith.arabic || "") + "</div><p>" + esc(hadith.translation || "") + "</p></article>";
    }
    if (content.image) body += "<img class=\"presentation-slide-image\" src=\"" + esc(content.image.dataUrl || "") + "\" alt=\"" + esc(content.image.title || "Gambar presentasi") + "\">";
    if (content.manual) body += "<p>" + esc(content.manual.text || "") + "</p>";
    $("presentationItemPage").textContent = "Slide " + (reviewIndex + 1) + " / " + current.items.length;
    $("presentationReviewItems").innerHTML = "<article class=\"it-reading-item\"><h3>" + esc(item.label || item.itemType) + "</h3>" + body + "</article>";
    $("presentationPreviousItem").disabled = reviewIndex === 0; $("presentationNextItem").disabled = reviewIndex >= current.items.length - 1;
  }
  function togglePresentationFullscreen() {
    var review = $("presentationReview");
    if (!review) return;
    if (document.fullscreenElement === review) {
      if (document.exitFullscreen) document.exitFullscreen();
      return;
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().then(function () { togglePresentationFullscreen(); }).catch(function () { review.classList.toggle("presentation-fullscreen"); });
      return;
    }
    if (review.requestFullscreen) {
      review.requestFullscreen().catch(function () { review.classList.add("presentation-fullscreen"); });
    } else {
      review.classList.add("presentation-fullscreen");
    }
  }
  function togglePresentationFocus() {
    var review = $("presentationReview");
    if (!review) return;
    review.classList.toggle("presentation-mode");
    $("presentationStartButton").textContent = review.classList.contains("presentation-mode") ? "Keluar mode fokus" : "Mode fokus";
  }
  function openPresentation(id, mode) {
    id = Number(id);
    if (!id) return Promise.reject(new Error("ID materi presentasi tidak valid."));
    if (mode === "edit") activatePresentationEditor(); else activatePresentationViewer();
    setEditorMode(true, id, "Memuat materi...");
    return get("presentation", { id: id }).then(function (presentation) {
      current = presentation; reviewIndex = 0;
      setEditorMode(true, presentation.id, presentation.title);
      $("presentationId").value = presentation.id; $("presentationTitle").value = presentation.title || ""; $("presentationDescription").value = presentation.description || ""; $("presentationEditStatus").value = presentation.status || "draft";
      items = (presentation.items || []).map(function (item) { return { snapshotItemId:item.portable?item.id:null,snapshot:item.portable?item.content:null,notes:item.notes,type: item.itemType, language: item.language || item.tafsirLanguage || item.hadithLanguage || "", sourceId: item.itemType === "quran" ? (item.quranSourceId || "") : (item.tafsirWorkId || item.collectionId || ""), referenceId: item.surahId || "", hadithId: item.hadithId || "", bookId: item.bookId || "", chapterId: item.chapterId || "", ayahStart: item.ayahStart || 1, ayahEnd: item.ayahEnd || 1, label: item.label || "", manualContent: item.manualContent || "" }; });
      var firstLanguage = (presentation.items || []).map(function (item) { return item.language || item.tafsirLanguage || item.hadithLanguage || ""; }).find(function (language) { return language; }) || presentation.language || "";
      $("presentationLanguage").value = firstLanguage || ""; $("presentationItemType").disabled = !$("presentationLanguage").value;
      renderItems();
      return $("presentationLanguage").value ? loadCatalog($("presentationLanguage").value).then(function () {
        items.forEach(function (item) {
          if (item.type === "quran" && !item.sourceId) {
            var surah = (catalog.surahs || []).find(function (row) { return String(row.id) === String(item.referenceId); });
            var sourceIds = surah ? String(surah.sourceIds || "").split(",").filter(Boolean) : [];
            item.sourceId = sourceIds[0] || (catalog.quranSources && catalog.quranSources[0] ? catalog.quranSources[0].id : "");
          }
          if (item.type === "tafsir") {
            var tafsirReference = (catalog.tafsirReferences || []).find(function (row) {
              return String(row.workId) === String(item.sourceId) &&
                String(row.surahId) === String(item.referenceId) &&
                Number(row.ayahStart) === Number(item.ayahStart) &&
                Number(row.ayahEnd) === Number(item.ayahEnd);
            });
            if (tafsirReference) item.referenceId = tafsirReference.id;
          }
        });
        renderItems();
      }) : null;
    }).then(function () { $("presentationReview").classList.remove("it-hidden"); $("presentationReviewTitle").textContent = current.title; $("presentationCreator").innerHTML=profileHtml(current.creator); renderReview(); });
  }
  function reset() { items = []; current = null; $("presentationId").value = ""; $("presentationTitle").value = ""; $("presentationDescription").value = ""; $("presentationEditStatus").value = "draft"; $("presentationLanguage").value = ""; $("presentationItemType").value = ""; $("presentationItemType").disabled = true; $("presentationAddItem").disabled = true; setEditorMode(false); renderItems(); $("presentationReview").classList.add("it-hidden"); leavePresentationEditor(); }
  document.addEventListener("change", function (event) {
    var target = event.target;
    if (target.id === "presentationLanguage") { resetForLanguage(); return; }
    if (target.id === "presentationItemType") { $("presentationAddItem").disabled = !catalog || !target.value || !$("presentationLanguage").value; return; }
    if (target.matches("[data-field=\"sourceId\"], [data-field=\"referenceId\"], [data-field=\"bookId\"], [data-field=\"chapterId\"], [data-field=\"hadithId\"]")) {
      syncItems();
      var card = target.closest("[data-index]");
      var item = card && items[Number(card.dataset.index)];
      if (item && target.dataset.field === "referenceId" && item.type === "tafsir") {
        var selectedReference = (catalog.tafsirReferences || []).find(function (reference) { return String(reference.id) === String(target.value); });
        if (selectedReference) {
          item.ayahStart = Number(selectedReference.ayahStart) || 1;
          item.ayahEnd = Number(selectedReference.ayahEnd) || item.ayahStart;
        }
      } else if (item && target.dataset.field === "sourceId") {
        item.referenceId = ""; item.bookId = ""; item.chapterId = ""; item.hadithId = null;
      } else if (item && target.dataset.field === "bookId") {
        item.chapterId = ""; item.hadithId = null;
      } else if (item && target.dataset.field === "chapterId") {
        item.hadithId = null;
      }
      renderItems();
      if (item && target.dataset.field === "hadithId") loadHadithPreview(item, $("presentationItemEditor").querySelector("[data-index=\"" + card.dataset.index + "\"]"));
    }
    if (target.matches("[data-image-upload]")) {
      var imageCard = target.closest("[data-index]"), imageItem = imageCard && items[Number(imageCard.dataset.index)], file = target.files && target.files[0];
      if (!imageItem || !file) return;
      if (!/^image\/(?:jpeg|png|gif|webp|svg\+xml|bmp|avif)$/i.test(file.type)) { alert("Format gambar tidak didukung."); target.value = ""; return; }
      if (file.size > 12 * 1024 * 1024) { alert("Ukuran gambar maksimal 12 MB."); target.value = ""; return; }
      var reader = new FileReader();
      reader.onload = function () { imageItem.manualContent = String(reader.result || ""); renderItems(); };
      reader.onerror = function () { alert("Gambar gagal dibaca."); };
      reader.readAsDataURL(file);
    }
  });
  document.addEventListener("click", function (event) {
    var remove = event.target.closest("[data-remove-item]");
    if (remove) { syncItems(); items.splice(Number(remove.dataset.removeItem), 1); renderItems(); }
    if (event.target.id === "presentationAddItem" && catalog && $("presentationItemType").value) { items.push({ type: $("presentationItemType").value, language: $("presentationLanguage").value, sourceId: "", referenceId: "", ayahStart: 1, ayahEnd: 1 }); renderItems(); }
    var selectedItem = event.target.closest("[data-select-item]");
    if (selectedItem) {
      syncItems();
      var selectedCard = $("presentationItemEditor").querySelector("[data-index=\"" + Number(selectedItem.dataset.selectItem) + "\"]");
      if (selectedCard) selectedCard.scrollIntoView({ behavior: "smooth", block: "start" });
      Array.prototype.forEach.call(document.querySelectorAll(".presentation-item-list-row"), function (row) { row.classList.toggle("is-active", row === selectedItem); });
      return;
    }
    if (event.target.id === "presentationReload") loadList();
    if (event.target.id === "presentationNewButton") { reset(); activatePresentationEditor(); return; }
    if (event.target.id === "presentationCancelButton") reset();
    if (event.target.id === "presentationReviewBackButton") { reset(); return; }
    var edit = event.target.closest("[data-edit-presentation]");
    if (edit) { event.preventDefault(); event.stopPropagation(); openPresentation(edit.dataset.editPresentation, "edit").catch(function (e) { alert("Gagal membuka editor: " + e.message); }); return; }
    var removePresentation = event.target.closest("[data-delete-presentation]");
    if (removePresentation && window.confirm("Hapus materi presentasi ini? Semua slide dan progresnya akan dihapus.")) {
      post({ action: "delete_presentation", id: Number(removePresentation.dataset.deletePresentation) }).then(function () { if (String($("presentationId").value) === String(removePresentation.dataset.deletePresentation)) reset(); return loadList(); }).catch(function (e) { alert(e.message); });
    }
    var move = event.target.closest("[data-move-item]");
    if (move) { syncItems(); var from = Number(move.dataset.index), to = move.dataset.moveItem === "up" ? from - 1 : from + 1; if (to >= 0 && to < items.length) { var moved = items.splice(from, 1)[0]; items.splice(to, 0, moved); renderItems(); } return; }
    if (event.target.id === "presentationPreviousItem" && reviewIndex > 0) { reviewIndex -= 1; renderReview(); }
    if (event.target.id === "presentationNextItem" && current && reviewIndex < current.items.length - 1) { reviewIndex += 1; renderReview(); }
    if (event.target.id === "presentationFullscreenButton") togglePresentationFullscreen();
    if (event.target.id === "presentationStartButton") togglePresentationFocus();
    var review = event.target.closest("[data-review-presentation]");
    if (review) { openPresentation(review.dataset.reviewPresentation, "review").catch(function (e) { alert("Gagal membuka review: " + e.message); }); return; }
    var start = event.target.closest("[data-start-presentation]");
    if (start) {
      openPresentation(start.dataset.startPresentation, "review").then(function () { togglePresentationFocus(); }).catch(function (e) { alert("Gagal membuka presentasi: " + e.message); });
      return;
    }
    var open = event.target.closest("[data-open-presentation]");
    if (open) openPresentation(open.dataset.openPresentation, "review").catch(function (e) { alert(e.message); });
  });
  document.addEventListener("fullscreenchange", function () {
    var review = $("presentationReview"), button = $("presentationFullscreenButton");
    if (!review || !button) return;
    var active = document.fullscreenElement === review;
    button.textContent = active ? "Keluar layar penuh" : "Layar penuh";
    if (!active) review.classList.remove("presentation-fullscreen");
  });
  document.addEventListener("keydown", function (event) {
    var review = $("presentationReview");
    var presentationActive = review && !review.classList.contains("it-hidden") &&
      (document.fullscreenElement === review || review.classList.contains("presentation-fullscreen") || review.classList.contains("presentation-mode"));
    var tagName = document.activeElement && document.activeElement.tagName;
    if (presentationActive && current && current.items && current.items.length &&
      !/INPUT|TEXTAREA|SELECT/.test(tagName || "") &&
      (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      event.preventDefault();
      if (event.key === "ArrowRight" && reviewIndex < current.items.length - 1) reviewIndex += 1;
      if (event.key === "ArrowLeft" && reviewIndex > 0) reviewIndex -= 1;
      renderReview();
      return;
    }
    if (event.key === "Escape") {
      if (review && review.classList.contains("presentation-fullscreen")) review.classList.remove("presentation-fullscreen");
    }
  });
  $("presentationBuilderForm").addEventListener("submit", function (event) {
    event.preventDefault(); syncItems();
    var language = $("presentationLanguage").value;
    if (!language) { alert("Pilih bahasa sumber."); return; }
    var editingId = Number($("presentationId").value) || 0;
    post({ action: "save_presentation", id: editingId, status: $("presentationEditStatus").value, title: $("presentationTitle").value, description: $("presentationDescription").value, items: items.map(function (item) {
      var tafsirRef = (catalog.tafsirReferences || []).find(function (ref) { return String(ref.id) === String(item.referenceId); });
      return { snapshotItemId:item.snapshotItemId,notes:item.notes,itemType: item.type, language: item.language||language, sourceId: item.type === "quran" ? item.sourceId : null, surahId: item.type === "quran" ? item.referenceId : (tafsirRef ? tafsirRef.surahId : null), ayahStart: item.ayahStart, ayahEnd: item.ayahEnd, tafsirWorkId: item.type === "tafsir" ? item.sourceId : null, tafsirLanguage: language, hadithId: item.type === "hadith" ? item.hadithId : null, hadithLanguage: item.type === "hadith" ? language : null, collectionId: item.type === "hadith" ? item.sourceId : null, bookId: item.bookId, chapterId: item.chapterId, label: item.label, manualContent: item.type === "image" || item.type === "text" || item.type === "manual" ? item.manualContent : null };
    }) }).then(function () { reset(); return loadList(); }).catch(function (e) { alert(e.message); });
  });
  get("presentation_catalog", { language: "id" }).then(function (data) { catalog = data; loadList(); }).catch(function () { loadList(); });
})();
