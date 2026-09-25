(function () {
  'use strict';
  var root, catalog, batch, index = 0, valid = false, busy = false, reports = [], saved = [], workflow=null, pauseWorkflow=false, dirty=false;
  var api = 'api/reviewed-document-import.php';
  var classicalTypes=[];
  var classicalOptions=[];
  var previewOnly=false,lastCursor=0;
  function t(id,en){return document.documentElement.lang==='en'?en:id;}
  var workflowApi='api/document-workflow.php';
  function el(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function options(rows, value) { return rows.map(function(r) { return '<option value="'+esc(r[0])+'"'+(String(r[0])===String(value)?' selected':'')+'>'+esc(r[1])+'</option>'; }).join(''); }
  function field(key,label,value,type) { return '<label>'+label+'<input data-meta="'+key+'" value="'+esc(value)+'" maxlength="255" type="'+(type||'text')+'"></label>'; }
  function select(key,label,rows,value) { return '<label>'+label+'<select data-meta="'+key+'">'+options(rows,value)+'</select></label>'; }
  function message(text,error) { el('riMessage').textContent=text; el('riMessage').classList.toggle('error',!!error); }
  async function request(url,body) {
    var headers={}, token=el('riToken').value.trim(); if(token)headers['X-Admin-Token']=token;
    if(body && !(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}
    var response=await fetch(url,{method:body?'POST':'GET',headers:headers,body:body,cache:'no-store'});
    var result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||'Permintaan gagal.');return result.data;
  }
  async function uploadDocument(file,actor,metadata) {
    if(file.size>1073741824)throw new Error('Batas 1 GiB per dokumen.');
    var fingerprint='mpm:review-upload:'+JSON.stringify([actor,file.name,file.size,file.lastModified]),key;
    try{key=localStorage.getItem(fingerprint);}catch(ignore){}
    var upload;
    if(key)upload=await request(api,{action:'upload_status',key:key,actor:actor});
    else {
      upload=await request(api,{action:'upload_begin',actor:actor,name:file.name,size:file.size});
      try{localStorage.setItem(fingerprint,upload.key);}catch(ignore){}
    }
    while(upload.offset<file.size){
      message('Mengunggah '+file.name+' — '+Math.floor(upload.offset/file.size*100)+'% ('+(upload.offset/1048576).toFixed(1)+' / '+(file.size/1048576).toFixed(1)+' MiB). Jika terputus, pilih file yang sama lalu klik Baca kembali.');
      var form=new FormData();form.append('chunk',file.slice(upload.offset,Math.min(file.size,upload.offset+4194304)),'chunk.bin');
      form.append('payload',JSON.stringify({action:'upload_chunk',key:upload.key,offset:upload.offset,actor:actor}));
      upload=await request(api,form);
    }
    message('Upload 100%. Membaca dan menganalisis dokumen… Arsip upload tetap tersedia jika analisis gagal.');
    workflow=await request(workflowApi,{action:'start',key:upload.key,actor:actor,metadata:metadata});
    var result=await processWorkflow();
    if(!result)return null;
    try{localStorage.removeItem(fingerprint);}catch(ignore){}
    return result;
  }
  function renderWorkflow() {
    if(!workflow){el('riWorkflow').hidden=true;return;}
    el('riWorkflow').hidden=false;if(workflow.actor)el('riActor').value=workflow.actor;
    var p=workflow.progress;
    el('riWorkflowStatus').textContent=workflow.filename+' · '+workflow.status+' · '+(p.bytes/1048576).toFixed(2)+' MiB teks · '+p.parts+' paket / '+p.items+' bagian'+(workflow.status==='ANALYZING'?' · '+Math.floor(p.offset/Math.max(1,p.bytes)*100)+'% dianalisis':'')+(p.physicalPages?' · halaman '+Math.min(p.nextPage-1,p.pageCount)+' / '+p.pageCount:'');
    el('riWorkflowParts').innerHTML=options([['','Pilih paket review']].concat(workflow.parts.map(function(part){return [part.batch_id,'Paket '+part.part_number+' · '+part.status];})),batch&&batch.id);
    el('riWorkflowPage').textContent=workflow.page+' / '+workflow.totalPages;el('riWorkflowText').href=workflowApi+'?download_text='+workflow.id;el('riWorkflowText').hidden=workflow.status==='EXTRACTING';
    el('riPauseWorkflow').disabled=!busy;el('riContinueWorkflow').disabled=busy||workflow.status==='READY';
    el('riWorkflowFirst').disabled=busy||workflow.page<=1;el('riWorkflowLast').disabled=busy||workflow.page>=workflow.totalPages;el('riWorkflowPrevious').disabled=busy||workflow.page<=1;el('riWorkflowNext').disabled=busy||workflow.page>=workflow.totalPages;
  }
  async function processWorkflow() {
    pauseWorkflow=false;renderWorkflow();
    while(workflow.status!=='READY'&&!pauseWorkflow){
      message(workflow.status==='EXTRACTING'?'Ekstraksi lokal sedang menulis teks ke disk…':'Analisis bertahap; checkpoint disimpan pada setiap langkah…');
      workflow=await request(workflowApi,{action:'step',id:workflow.id,actor:el('riActor').value.trim()});renderWorkflow();
    }
    if(pauseWorkflow){message('Dijeda setelah checkpoint. Klik Lanjutkan proses atau muat workflow ini nanti.');return null;}
    try{Object.keys(localStorage).filter(function(k){return k.indexOf('mpm:review-upload:')===0&&localStorage.getItem(k)===workflow.uploadKey;}).forEach(function(k){localStorage.removeItem(k);});}catch(ignore){}
    return workflow.parts.length?await request(api+'?id='+workflow.parts[0].batch_id):null;
  }
  async function run(work) {
    if(busy)return;busy=true;root.setAttribute('aria-busy','true');root.querySelectorAll('fieldset').forEach(function(f){f.disabled=true;});
    try { await work(); } catch(error) { message(error.message,true); }
    finally { busy=false;root.setAttribute('aria-busy','false');root.querySelectorAll('fieldset').forEach(function(f){f.disabled=false;}); freezeSaved();buttons();renderWorkflow(); }
  }
  function buttons() { if(el('riSave'))el('riSave').disabled=busy||!valid||!batch||batch.status==='SAVED'; }
  function freezeSaved() {
    if(!batch)return;var row=batch.items[index],frozen=batch.status==='SAVED'||row&&row.status==='SAVED';
    el('riItem').querySelectorAll('input,textarea,select,button').forEach(n=>n.disabled=!!frozen);
    el('riMetadata').querySelectorAll('input,select').forEach(n=>n.disabled=!!batch.hasSaved);
    el('riRemoveItem').disabled=!!frozen;el('riSplitItem').disabled=!!frozen||!!row?.draft?.excluded;
    el('riLabelWorkflow').disabled=!!batch.hasSaved;el('riAddItem').disabled=batch.status==='SAVED';
    el('riValidate').disabled=batch.status==='SAVED';buttons();
  }
  function changed() { dirty=true;valid=false;reports=[];buttons();if(el('riValidation'))el('riValidation').textContent=t('Perubahan belum disimpan.','Changes have not been saved.');renderPreview(); }
  function sync() {
    if(!batch)return;
    root.querySelectorAll('[data-meta]').forEach(function(input){batch.metadata[input.dataset.meta]=input.value;});
    var item=batch.items[index];if(!item)return;
    root.querySelectorAll('[data-draft]').forEach(function(input){item.draft[input.dataset.draft]=input.type==='checkbox'?input.checked:input.value;});
    if(item.draft.excluded){item.draft.selected=false;item.draft.reviewed=false;return;}
    item.draft.parts=Array.from(root.querySelectorAll('.ri-part')).map(function(part){return {role:part.querySelector('select').value,text:part.querySelector('textarea').value};});
  }
  function updateHistory() { el('riHistory').innerHTML=options([['','Pilih draft / hasil impor']].concat((catalog.batches||[]).map(function(b){return [b.id,b.filename+' · '+b.status+' · '+b.created_at];})),batch&&batch.id); }
  async function refresh() { var results=await Promise.all([request(api),request(workflowApi)]);catalog=results[0];updateHistory();el('riWorkflowHistory').innerHTML=options([['','Pilih workflow dokumen']].concat(results[1].map(function(j){return [j.id,j.filename+' · '+j.status];})),workflow&&workflow.id);if(workflow)workflow=await request(workflowApi+'?id='+workflow.id+'&page='+workflow.page); }
  function render() {
    var m=batch.metadata, languages=[['','Pilih bahasa'],['ar','Arabic'],['en','English'],['id','Indonesia']];
    el('riWorkspace').hidden=false;
    el('riSourceInfo').textContent=batch.filename+' · '+batch.format.toUpperCase()+' · '+batch.importedAt+' · '+batch.status;
    el('riSourceDownload').href=batch.sourceDownload;
    el('riExtraction').textContent=t('Periksa teks, label dan batas setiap bagian sebelum menyimpan.','Check the text, labels and section boundaries before publishing.')+(batch.extraction.ocrPageCount?' OCR: '+batch.extraction.ocrPageCount+' '+t('halaman.','pages.'):'')+(batch.extraction.lowConfidencePages?.length?' '+t('Periksa khusus halaman: ','Check these pages carefully: ')+batch.extraction.lowConfidencePages.join(', '):'');
    el('riMetadata').innerHTML=select('type','Type',[['tafsir','Tafsir'],['hadith','Hadith']].concat(classicalOptions),m.type)+field('author','Author / Mufassir / Compiler',m.author)+field('book','Book / Collection',m.book)+select('language','Language',languages,m.language)+select('translationStatus','Status sumber',[['original_source','Original Source'],['manual_translation','Manual Translation (teks yang diunggah)']],m.translationStatus)+select('sourceLanguage','Source Language (terjemahan manual)',languages,m.sourceLanguage)+field('translator','Translator (terjemahan manual)',m.translator)+field('edition','Edisi / penerbit',m.edition)+field('sourceLabel','Label sumber',m.sourceLabel)+select(m.type==='tafsir'?'familyId':'collectionId',m.type==='tafsir'?'Hubungkan ke kitab Tafsir':'Hubungkan ke koleksi Hadith',[['','Deteksi berdasarkan judul + author / buat baru']].concat((m.type==='tafsir'?catalog.tafsirFamilies:catalog.collections).map(function(r){return [r.id,r.title+' — '+(r.author||'')];})),m.type==='tafsir'?m.familyId:m.collectionId);
    if(classicalTypes.includes(m.type)){
      el('riMetadata').querySelector('[data-meta="collectionId"]')?.closest('label').remove();
      el('riMetadata').innerHTML+=select('classicalBookId','Arabic source book',[['','New Arabic book']].concat((catalog.classicalBooks||[]).filter(b=>b.category===m.type).map(b=>[b.id,b.title+' ? '+b.author])),m.classicalBookId)+select('madhhab','Madhhab',[['','Unspecified'],['hanafi','Hanafi'],['maliki','Maliki'],['shafii','Shafii'],['hanbali','Hanbali']],m.madhhab)+select('licenseStatus','License',[['','Needs verification'],['PUBLIC_DOMAIN','Public domain'],['CC0','CC0'],['CC_BY','CC BY'],['CC_BY_SA','CC BY-SA'],['CC_BY_NC_SA','CC BY-NC-SA'],['PERMISSION_GRANTED','Permission granted']],m.licenseStatus)+field('licenseEvidence','License evidence / permission reference',m.licenseEvidence);
    }
    simplifyMetadata();
    el('riRawPage').value=batch.rawPage.number;el('riRawPage').max=batch.extraction.pageCount;el('riRawText').textContent=batch.rawPage.text;
    renderItem();renderValidation();freezeSaved();buttons();route();
  }
  function renderItem() {
    index=Math.max(0,Math.min(index,batch.items.length-1));var row=batch.items[index],d=row.draft,s=row.source||{};
    el('riItemSelect').innerHTML=options(batch.items.map(function(item,i){var p=item.draft;return [i,(i+1)+'. '+(p.excluded?t('[Dihapus] ','[Removed] '):'')+(p.chapter?p.chapter+' · ':'')+(p.selected?'✓ ':'')+(batch.metadata.type==='tafsir'?'QS '+(p.surah||'?')+':'+(p.ayahStart||'?')+'–'+(p.ayahEnd||'?'):'Hadith '+(p.number||'?'))+' · '+(item.status||'Needs Review')];}),index);
    var mapping=batch.metadata.type==='tafsir'?'<label>Surah<select data-draft="surah">'+options([['','Needs Review — pilih surah']].concat(catalog.surahs.map(function(s){return [s.number,s.number+'. '+s.name];})),d.surah)+'</select></label><label>Ayat awal<input data-draft="ayahStart" type="number" min="1" value="'+esc(d.ayahStart)+'"></label><label>Ayat akhir<input data-draft="ayahEnd" type="number" min="1" value="'+esc(d.ayahEnd)+'"></label>':'<label>Nomor Hadith / ID sumber<input data-draft="number" maxlength="100" value="'+esc(d.number)+'"></label>';
    if(classicalTypes.includes(batch.metadata.type)) mapping+='<label>Surah (reference)<select data-draft="surah">'+options([['','No reference']].concat(catalog.surahs.map(r=>[r.number,r.name])),d.surah)+'</select></label><label>Start ayah<input type="number" min="1" data-draft="ayahStart" value="'+esc(d.ayahStart)+'"></label><label>End ayah<input type="number" min="1" data-draft="ayahEnd" value="'+esc(d.ayahEnd)+'"></label><label>Volume<input data-draft="volume" value="'+esc(d.volume)+'"></label><label>Printed page<input data-draft="printedPage" value="'+esc(d.printedPage)+'"></label><label>Topic<select data-draft="topicId">'+options([['','No topic']].concat((catalog.fiqhTopics||[]).map(r=>[r.id,r.titleEn])),d.topicId)+'</select></label><label>Existing Hadith ID<input data-draft="hadithId" type="number" min="1" value="'+esc(d.hadithId)+'"></label><label>Existing Tafsir entry ID<input data-draft="tafsirId" type="number" min="1" value="'+esc(d.tafsirId)+'"></label>';
    el('riItem').innerHTML='<div class="ri-checks"><label><input data-draft="selected" type="checkbox"'+(d.selected?' checked':'')+'> Pilih bagian ini untuk disimpan</label><label><input data-draft="reviewed" type="checkbox"'+(d.reviewed?' checked':'')+'> Saya sudah memeriksa teks, klasifikasi, dan mapping</label></div><div class="ri-grid">'+mapping+'<label>Chapter / Bab<input data-draft="chapter" maxlength="255" value="'+esc(d.chapter)+'"></label></div><p class="it-help">'+esc(s.pageStart?'Halaman '+s.pageStart+'–'+s.pageEnd:'Tanpa nomor halaman fisik')+' · '+esc(s.section||'Batas belum teridentifikasi / bagian manual')+'</p><label>Teks utama '+(batch.metadata.type==='tafsir'?'Tafsir':classicalTypes.includes(batch.metadata.type)?batch.metadata.type:'Hadith')+'<textarea data-draft="text" rows="10" dir="auto">'+esc(d.text)+'</textarea></label><div id="riParts">'+(d.parts||[]).map(partHtml).join('')+'</div><button type="button" id="riAddPart" class="it-button small">Tambah bagian pendukung</button><details><summary>Teks asli bagian ini (sebelum koreksi)</summary><pre dir="auto">'+esc(s.rawText||'Bagian ditambahkan manual. Dokumen lengkap tersedia di pratinjau sumber.')+'</pre></details>';
    el('riItem').hidden=previewOnly;
    if(d.excluded)el('riItem').innerHTML='<p>'+t('Bagian ini dihapus dari penyajian.','This section is excluded from publication.')+'</p>';
    el('riRemoveItem').textContent=d.excluded?t('Pulihkan bagian','Restore section'):t('Hapus dari penyajian','Remove from publication');
    el('riRemoveItem').disabled=row.status==='SAVED';el('riSplitItem').disabled=row.status==='SAVED'||!!d.excluded;
    el('riPrevious').disabled=index===0;el('riNext').disabled=index===batch.items.length-1;
    renderPreview();freezeSaved();
  }
  function partHtml(p) {return '<div class="ri-part"><label>Klasifikasi<select>'+options([['quran','Embedded Quranic Evidence'],['commentary','Explanation / Commentary'],['reference','Reference / Source'],['isnad','Sanad'],['other','Catatan / bagian lain'],['main','Lanjutan teks utama']],p.role)+'</select></label><textarea rows="4" dir="auto" aria-label="Teks bagian pendukung">'+esc(p.text)+'</textarea><button type="button" data-remove-part class="it-button small">Hapus dari draft</button></div>';}
  function renderValidation() {
    el('riValidation').innerHTML=reports.length?reports.filter(function(r){return r.selected;}).map(function(r){var i=batch.items.findIndex(function(item){return Number(item.id)===Number(r.id);});return '<p class="'+(r.errors.length?'error':'')+'">Bagian '+(i+1)+': '+esc(r.errors.length?r.errors.join(' '):'Valid — siap disimpan')+(r.duplicates||[]).map(function(d){return '<br>'+esc(d.label);}).join('')+'</p>';}).join(''):'Pilih dan review bagian, lalu validasi sebelum menyimpan.';
    if(saved.length)el('riValidation').innerHTML='<p>'+saved.length+' bagian tersimpan. Bagian lain dapat direview dan disimpan kemudian.</p><button id="riOpenReader" class="it-button primary" type="button">Lihat hasil di '+esc(batch.metadata.type==='tafsir'?'Tafsir':classicalTypes.includes(batch.metadata.type)?batch.metadata.type:'Hadith')+'</button>';
  }
  async function review(action) {
    sync();message(action==='save'?'Menyimpan bagian yang dipilih…':'Memeriksa mapping dan duplikat…');
    var result=await request(api,{action:action,actor:el('riActor').value.trim(),id:batch.id,revision:batch.revision,metadata:batch.metadata,items:batch.items.map(function(r){return {id:r.id,draft:r.draft};})});
    batch=result.batch;dirty=false;reports=result.validation;valid=result.canSave;saved=result.saved;render();
    message(saved.length?saved.length+' bagian tersimpan dan tersedia di reader.':valid?'Validasi lulus. Periksa pilihan terakhir lalu klik Simpan bagian terpilih ke bacaan.':'Draft tersimpan. Selesaikan bagian yang masih Needs Review atau duplikat.',!valid&&!saved.length);
    if(saved.length)await refresh();route();
  }


  function simplifyMetadata(){
    var container=el('riMetadata'),more=el('riExtraMetadata');
    if(!more){more=document.createElement('details');more.id='riExtraMetadata';more.className='ri-meta-extra';more.innerHTML='<summary>'+t('Edisi, penerjemah dan pengaitan koleksi (opsional)','Edition, translator and collection links (optional)')+'</summary><div class="ri-grid"></div>';container.appendChild(more);
      ['translationStatus','sourceLanguage','translator','edition','sourceLabel','familyId','collectionId'].forEach(function(key){var input=container.querySelector('[data-meta="'+key+'"]');if(input)more.querySelector('.ri-grid').appendChild(input.closest('label'));});
    }
    var translated=container.querySelector('[data-meta=translationStatus]').value==='manual_translation';
    ['sourceLanguage','translator'].forEach(function(key){container.querySelector('[data-meta="'+key+'"]').closest('label').hidden=!translated;});
  }
  function route(){if(batch)window.MpmReaderNavigation?.update({panel:'book-import','review-batch':batch.id,section:index+1,mode:previewOnly?'preview':'edit'});}
  function renderPreview(){
    if(!batch||!el('riPreview'))return;var d=batch.items[index]?.draft;if(!d)return;
    el('riPreview').innerHTML='<p class="it-eyebrow">'+t('Pratinjau penyajian web','Web reading preview')+'</p>'+(d.excluded?'<p>'+t('Bagian ini tidak akan ditampilkan.','This section will not be published.')+'</p>':window.MpmBookPresentation.html(batch.metadata,d));
    root.querySelector('.ri-review-layout').classList.toggle('preview-only',previewOnly);
  }
  document.addEventListener('DOMContentLoaded',function(){
    root=el('reviewedDocumentImporter');if(!root)return;
    root.innerHTML='<h2>Impor Kitab Tafsir & Hadis</h2><p>Unggah kitab atau masukkan URL. Periksa bacaan, koreksi teks dan label, hapus bagian yang tidak diperlukan, lalu simpan bagian yang sudah diperiksa.</p><fieldset><div class="ri-grid"><details><summary>Reviewer & akses</summary><label>Nama / ID reviewer<input id="riActor" maxlength="180" autocomplete="name"></label><label>Token admin (jika server memerlukan)<input id="riToken" type="password" autocomplete="off"></label></details><label>Jenis kitab<select id="riType"><option value="">Deteksi dari dokumen</option><option value="tafsir">Tafsir — Surah / Ayat</option><option value="hadith">Hadith — nomor / bagian pendukung</option></select></label><label>Dokumen (maks. 1 GiB per file; upload bertahap)<input id="riFile" type="file" accept=".pdf,.txt,.doc,.docx,.epub,.odt,.html,.htm,.md,.png,.jpg,.jpeg,.tif,.tiff,.webp,.bmp"></label><label>Atau URL dokumen / halaman<input id="riUrl" type="url" placeholder="https://…"></label></div><button id="riRead" class="it-button primary" type="button">Baca kitab</button><p class="it-help">Upload file: hingga 1 GiB. URL: hingga 30 MiB. Hasil teks hingga 1 GiB diproses bertahap, tanpa dipotong pada 20 MiB. Paket review tersimpan dengan checkpoint.</p><div class="ri-grid"><label>Lanjutkan review / lihat arsip<select id="riHistory"></select></label><button id="riReload" class="it-button" type="button">Muat batch</button></div></fieldset><p id="riMessage" role="status" aria-live="polite"></p><label>Workflow tersimpan<select id="riWorkflowHistory"></select></label><button id="riLoadWorkflow" class="it-button" type="button">Muat workflow</button><section id="riWorkflow" hidden><p id="riWorkflowStatus" role="status"></p><a id="riWorkflowText">Unduh seluruh teks hasil ekstraksi</a><div class="ri-actions"><button id="riPauseWorkflow" class="it-button" type="button">Jeda setelah langkah ini</button><button id="riContinueWorkflow" class="it-button" type="button">Lanjutkan proses</button></div><div class="ri-nav"><button id="riWorkflowFirst" class="it-button" type="button">Awal</button><button id="riWorkflowPrevious" class="it-button" type="button">Paket sebelumnya</button><span id="riWorkflowPage"></span><button id="riWorkflowNext" class="it-button" type="button">Paket berikutnya</button><button id="riWorkflowLast" class="it-button" type="button">Akhir</button></div><label>Paket review<select id="riWorkflowParts"></select></label><button id="riOpenWorkflowPart" class="it-button" type="button">Buka paket</button></section><section id="riWorkspace" hidden><p id="riSourceInfo"></p><a id="riSourceDownload">Unduh dokumen asli</a><p id="riExtraction"></p><details><summary>Pratinjau teks paket review</summary><label>Halaman / bagian<input id="riRawPage" type="number" min="1" value="1"></label><button id="riLoadPage" class="it-button small" type="button">Buka</button><pre id="riRawText" dir="auto"></pre></details><fieldset id="riEditor"><h3>1. Identitas kitab</h3><div id="riMetadata" class="ri-grid"></div><button id="riLabelWorkflow" class="it-button" type="button">Terapkan label ke seluruh paket dokumen</button><h3>2. Periksa bacaan</h3><div class="ri-nav"><button id="riPrevious" class="it-button" type="button">Sebelumnya</button><select id="riItemSelect" aria-label="Pilih bagian"></select><button id="riNext" class="it-button" type="button">Berikutnya</button></div><div class="ri-actions"><button id="riEditView" class="it-button" type="button">Sunting & pratinjau</button><button id="riPreviewView" class="it-button" type="button">Tampilan bacaan</button><button id="riRemoveItem" class="it-button" type="button">Hapus dari penyajian</button><button id="riSplitItem" class="it-button" type="button">Pisahkan pada posisi kursor</button></div><div class="ri-review-layout"><div id="riItem"></div><section id="riPreview" class="ri-preview"></section></div><div class="ri-actions"><button id="riAddItem" class="it-button" type="button">Tambah bagian manual</button><button id="riValidate" class="it-button" type="button">Simpan draft & periksa</button><button id="riSave" class="it-button primary" type="button" disabled>Simpan bagian terpilih ke bacaan</button></div></fieldset><div id="riValidation" aria-live="polite"></div></section>';
    var history=document.createElement('details');history.className='ri-history';history.innerHTML='<summary>'+t('Lanjutkan pekerjaan tersimpan','Continue saved work')+'</summary>';var oldHistory=el('riHistory').closest('.ri-grid');root.querySelector('fieldset').after(history);history.appendChild(oldHistory);history.appendChild(el('riWorkflowHistory').closest('label'));history.appendChild(el('riLoadWorkflow'));
    el('riActor').value=window.MpmUserSession?.user?.name||t('Reviewer lokal','Local reviewer');
    window.addEventListener('mpm:user-session-ready',function(event){if(event.detail?.user?.name&&!workflow)el('riActor').value=event.detail.user.name;});
    document.querySelector('[data-tab=book-import]').addEventListener('click',function(){if(!catalog)run(refresh);});
    document.querySelectorAll('[data-auto-view]').forEach(function(button){button.addEventListener('click',function(){var view=button.dataset.autoView;document.querySelectorAll('[data-auto-panel]').forEach(function(p){p.classList.toggle('active',p.dataset.autoPanel===view);});document.querySelectorAll('.it-auto-tabs [data-auto-view]').forEach(function(b){b.classList.toggle('active',b.dataset.autoView===view);});if(view==='import-review'&&!catalog)run(refresh);});});
    root.addEventListener('input',function(event){if(event.target.closest('#riEditor')&&!event.target.closest('.ri-nav')){sync();changed();}});
    root.addEventListener('change',function(event){if(event.target.dataset.meta==='translationStatus')simplifyMetadata();if(event.target.id==='riItemSelect'){sync();index=Number(event.target.value);renderItem();route();}else if(event.target.dataset.meta==='type'){sync();changed();render();}});
    root.addEventListener('select',function(event){if(event.target.matches('[data-draft=\"text\"]'))lastCursor=event.target.selectionStart;});
    root.addEventListener('keyup',function(event){if(event.target.matches('[data-draft=\"text\"]'))lastCursor=event.target.selectionStart;});
    root.addEventListener('click',function(event){if(event.target.matches('[data-draft=\"text\"]'))lastCursor=event.target.selectionStart;var button=event.target.closest('button');if(!button)return;if(button.id==='riPauseWorkflow'){pauseWorkflow=true;return;}if(busy)return;
      if(button.id==='riRead')run(async function(){if(dirty)throw new Error('Simpan draft sebelum membaca dokumen lain.');el('riWorkspace').hidden=true;var actor=el('riActor').value.trim(),file=el('riFile').files[0],url=el('riUrl').value.trim();if(!actor)throw new Error('Isi nama / ID reviewer.');if(Boolean(file)===Boolean(url))throw new Error('Pilih satu sumber: file atau URL.');message('Membaca sumber dan mencari batas bagian. Tunggu hingga hasil review tampil…');var form=new FormData();if(file)form.append('document',file);var type=el('riType').value;form.append('payload',JSON.stringify({action:'read',actor:actor,url:url,metadata:type?{type:type}:{}}));if(file)batch=await uploadDocument(file,actor,type?{type:type}:{});else{workflow=await request(workflowApi,{action:'start_url',url:url,actor:actor,metadata:type?{type:type}:{}});batch=await processWorkflow();}if(!batch)return;index=0;dirty=false;valid=false;reports=[];saved=[];await refresh();render();message('Sumber dibaca. Hasil masih Needs Review; belum ada materi yang masuk ke reader.');});
      else if(button.id==='riReload')run(async function(){if(dirty)throw new Error(t('Simpan draft sebelum berganti dokumen.','Save the draft before switching documents.'));if(!el('riHistory').value)throw new Error('Pilih batch.');batch=await request(api+'?id='+Number(el('riHistory').value));index=0;valid=false;reports=[];saved=[];render();message('Batch dimuat.');});
      else if(button.id==='riLoadWorkflow')run(async function(){if(dirty)throw new Error('Simpan draft sebelum berganti workflow.');workflow=await request(workflowApi+'?id='+Number(el('riWorkflowHistory').value));renderWorkflow();});
      else if(button.id==='riContinueWorkflow')run(async function(){if(dirty)throw new Error(t('Simpan draft sebelum melanjutkan proses.','Save the draft before continuing.'));var result=await processWorkflow();if(result){batch=result;index=0;dirty=false;valid=false;reports=[];saved=[];render();await refresh();}});
      else if(button.id==='riWorkflowFirst'||button.id==='riWorkflowLast')run(async function(){workflow=await request(workflowApi+'?id='+workflow.id+'&page='+(button.id==='riWorkflowFirst'?1:workflow.totalPages));renderWorkflow();});
      else if(button.id==='riWorkflowPrevious'||button.id==='riWorkflowNext')run(async function(){workflow=await request(workflowApi+'?id='+workflow.id+'&page='+(workflow.page+(button.id==='riWorkflowNext'?1:-1)));renderWorkflow();});
      else if(button.id==='riOpenWorkflowPart')run(async function(){if(dirty)throw new Error('Klik Simpan draft & periksa sebelum berganti paket.');if(!el('riWorkflowParts').value)throw new Error('Pilih paket.');batch=await request(api+'?id='+Number(el('riWorkflowParts').value));index=0;dirty=false;valid=false;reports=[];saved=[];render();});
      else if(button.id==='riPrevious'||button.id==='riNext'){sync();index+=button.id==='riNext'?1:-1;renderItem();route();}
      else if(button.id==='riRemoveItem'){sync();var d=batch.items[index].draft;if(batch.items[index].status==='SAVED')return;d.excluded=!d.excluded;d.selected=false;d.reviewed=false;changed();renderItem();}
      else if(button.id==='riPreviewView'||button.id==='riEditView'){sync();previewOnly=button.id==='riPreviewView';renderItem();route();}
      else if(button.id==='riSplitItem'){sync();var row=batch.items[index],cut=lastCursor;if(row.status==='SAVED'||row.draft.excluded)return;if(cut<=0||cut>=row.draft.text.length){message(t('Letakkan kursor di tengah teks yang ingin dipisahkan.','Place the cursor inside the text to split.'),true);return;}var next={id:0,source:Object.assign({},row.source,{splitFrom:row.id}),draft:{text:row.draft.text.slice(cut),parts:row.draft.parts,chapter:row.draft.chapter,number:'',surah:null,ayahStart:null,ayahEnd:null,selected:false,reviewed:false}};row.draft.parts=[];row.draft.text=row.draft.text.slice(0,cut);row.draft.reviewed=false;batch.items.splice(index+1,0,next);changed();renderItem();}
      else if(button.id==='riAddPart'){sync();batch.items[index].draft.parts.push({role:'other',text:''});changed();renderItem();}
      else if(button.hasAttribute('data-remove-part')){button.closest('.ri-part').remove();sync();changed();}
      else if(button.id==='riAddItem'){sync();batch.items.push({id:0,source:{manualAdded:true},draft:{text:'',parts:[],number:'',chapter:'',surah:null,ayahStart:null,ayahEnd:null,selected:false,reviewed:false}});index=batch.items.length-1;changed();renderItem();}
      else if(button.id==='riLabelWorkflow')run(async function(){if(!batch.extraction.workflowId)throw new Error(t('Dokumen ini tidak memiliki paket terkait.','This document has no linked packages.'));if(!workflow||batch.extraction.workflowId!==workflow.id){workflow=await request(workflowApi+'?id='+batch.extraction.workflowId);renderWorkflow();}sync();var currentPage=workflow.page;await request(workflowApi,{action:'label',id:workflow.id,actor:el('riActor').value.trim(),metadata:batch.metadata});workflow=await request(workflowApi+'?id='+workflow.id+'&page='+currentPage);var current=await request(api+'?id='+batch.id);batch.revision=current.revision;changed();renderWorkflow();message('Label diterapkan ke seluruh paket. Perubahan teks draft tetap tersedia; lanjutkan validasi.');});
      else if(button.id==='riValidate')run(function(){return review('validate');});
      else if(button.id==='riSave')run(function(){return review('save');});
      else if(button.id==='riLoadPage')run(async function(){var result=await request(api+'?id='+batch.id+'&page='+Number(el('riRawPage').value));batch.rawPage=result.rawPage;el('riRawText').textContent=result.rawPage.text;el('riRawPage').value=result.rawPage.number;});
      else if(button.id==='riOpenReader')run(async function(){var first=saved[0],row=batch.items.find(function(r){return Number(r.id)===Number(first.itemId);});await window.IslamicTextOpenReviewedImport(first,batch.metadata,row.draft);});
    });
    window.addEventListener('beforeunload',function(event){if(dirty){event.preventDefault();event.returnValue='';}});
    window.addEventListener('mpm:language-changed',function(){if(batch)renderPreview();document.querySelectorAll('[data-book-label]').forEach(n=>n.textContent=t('Impor Kitab','Book Import'));});
    document.querySelectorAll('[data-book-label]').forEach(n=>n.textContent=t('Impor Kitab','Book Import'));
    window.ReviewedDocumentImporter={openBatch:async function(id){if(batch&&Number(batch.id)===Number(id))return;if(dirty||busy)throw new Error('Save the current draft before opening another review.');document.querySelector('[data-tab=book-import]').click();if(!catalog)await refresh();batch=await request(api+'?id='+Number(id));index=0;valid=false;reports=[];saved=[];render();window.MpmReaderNavigation?.update({panel:'book-import','review-batch':batch.id,section:index+1});},restoreSection:function(n,mode){if(!batch)return;sync();index=Math.max(0,Math.min(batch.items.length-1,Number(n||1)-1));previewOnly=mode==='preview';renderItem();},getState:function(){return {batch:batch,busy:busy,valid:valid,saved:saved,workflow:workflow};}};
  });
})();
