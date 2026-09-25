(function () {
    'use strict';
    const $=id=>document.getElementById(id), escape=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const conditions=['before_fajr','kadzib_fajr','begining_shadiq_fajr','shadiq_fajr','begining_sunrise','sunrise','sunrise_up','morning','morning_gnomon','begining_istiwa','istiwa','zawal_dhuhr','ashar_begining','ashar_jumhur','ashar_hanafi','late_ashar','golden_hour','begining_sunset','sunset','ghurub','begining_syafaq_ammar','weakened_syafaq_ammar','dissapearing_syafaq_ammar','syafaq_abyadh','syafaq_abyadh_become_night','hilal_night','hilal_ghurub','hilal_syafaq_ammar'];
    const conditionLabels=['Sebelum Fajar','Fajar kadzib','Awal Fajar shadiq','Fajar shadiq','Menjelang terbit','Terbit','Sesudah terbit','Pagi','Bayangan pagi','Menjelang Istiwa','Istiwa','Zawal / Dhuhr','Menjelang Ashr','Ashr Jumhur','Ashr Hanafi','Akhir Ashr','Menjelang sunset','Awal sunset','Sunset','Ghurub','Awal syafaq merah','Syafaq melemah','Syafaq menghilang','Syafaq Abyadh','Abyadh menuju malam','Hilal malam','Hilal saat ghurub','Hilal saat syafaq'];
    const conditionTypes=['fajr','fajr','fajr','fajr','sunrise','sunrise','sunrise','sunrise','dhuhr','dhuhr','dhuhr','dhuhr','asr_jumhur','asr_jumhur','asr_hanafi','asr_hanafi','maghrib','maghrib','maghrib','maghrib','syafaq','syafaq','syafaq','syafaq_abyadh','syafaq_abyadh','hilal','hilal','hilal'];
    const defaults={fajr:3,sunrise:5,dhuhr:10,asr_jumhur:13,asr_hanafi:14,maghrib:18,syafaq:22,syafaq_abyadh:24,hilal:26};
    const poles=['before_istiwa','begining_istiwa','istiwa','dhuhr_zawal','for_before_ashar','jumhur_ashar','hanafi_ashar'];
    const poleLabels=['Sebelum Istiwa','Menjelang Istiwa','Istiwa','Zawal Dhuhr','Menjelang Ashr','Ashr Jumhur','Ashr Hanafi'];
    const base='assets/images/sky/', poleBase='assets/images/pole/';
    const asset=index=>base+encodeURIComponent(MpmBuildFile((index+1)+') '+conditions[index]+'.png'));
    let accountSession={user:null,csrf:''};
    const tr=(id,en)=>new URLSearchParams(location.search).get('lang')==='en'?en:id;
    let current=null, calculated=null, rows=[], reference=null, newPhotos=[], removed=[], busy=false, ready=false, methods=[];
    const number=id=>$(id).value===''?null:Number($(id).value);
    function sessionUuid() {
        const bytes=crypto.getRandomValues(new Uint8Array(16)); bytes[6]=(bytes[6]&15)|64; bytes[8]=(bytes[8]&63)|128;
        const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
        return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
    }
    const message=(text,error)=>{ $('foMessage').textContent=text; $('foMessage').classList.toggle('fo-error',!!error); };
    const invalidate=()=>{ calculated=null; $('foSave').disabled=true; $('foReviewOutput').innerHTML=''; };
    async function request(query, payload, files) {
        const options={cache:'no-store',credentials:'same-origin',headers:{}};
        if(payload)options.headers['X-CSRF-Token']=accountSession.csrf;
        if (payload) {
            options.method='POST';
            if (files) { const form=new FormData(); form.append('payload',JSON.stringify(payload)); files.forEach(p=>form.append('photos[]',p.file)); options.body=form; }
            else { options.headers['Content-Type']='application/json'; options.body=JSON.stringify(payload); }
        }
        const response=await fetch('api/field-observations.php'+(query?'?'+query:''),options);
        let body; try { body=await response.json(); } catch (_) { throw new Error('Server tidak menerima unggahan. Periksa ukuran foto dan batas upload PHP.'); }
        if (!response.ok || !body.success) throw new Error(body.error || 'Penyimpanan tidak tersedia. Data form tetap dipertahankan.');
        return body.data;
    }
    function condition(index) {
        $('foCondition').value=String(index); $('foType').value=conditionTypes[index];
        $('foConditionImage').src=asset(index); $('foConditionImage').alt=conditionLabels[index]; $('foConditionCaption').textContent=conditionLabels[index];
        document.querySelectorAll('[data-fo-condition]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.foCondition)===index?'true':'false'));
        const type=$('foType').value, shadow=['dhuhr','asr_jumhur','asr_hanafi'].includes(type);
        $('foMeasurement').hidden=!shadow; $('foHeight').required=shadow; $('foShadow').required=shadow;
        $('foHeight').disabled=!shadow; $('foShadow').disabled=!shadow; $('foDirection').disabled=!shadow;
        $('foHilal').hidden=type!=='hilal';
        $('foPoleStage').value=type==='asr_hanafi'?'6':type==='asr_jumhur'?'5':index===11?'3':'2'; poleGuide(); invalidate();renderComparison();
    }
    function poleGuide() {
        const stage=Number($('foPoleStage').value), name=poles[stage];
        $('foPoleImages').innerHTML=['front','up'].map((view,i)=>'<figure><img loading="lazy" src="'+escape(poleBase+encodeURIComponent(MpmBuildFile((stage*2+i+1)+'_measure_'+name+'_'+view+'.png')))+'" alt="'+escape(poleLabels[stage]+' '+(i?'tampak atas':'tampak depan'))+'"><figcaption>'+ (i?'Tampak atas':'Tampak depan')+'</figcaption></figure>').join('');
    }
    function useGIS() {
        const state=AdvancedAstroGIS.getState(), point=state.observer;
        $('foLatitude').value=point.lat; $('foLongitude').value=point.lon; $('foElevation').value=point.elevation;
        $('foLocation').value='Lokasi GIS '+Number(point.lat).toFixed(6)+', '+Number(point.lon).toFixed(6);
        invalidate(); message('Koordinat pilihan GIS telah disalin. Pilih lokasi lain di peta lalu gunakan tombol ini untuk memperbaruinya.');
    }
    function localNow() {
        const offset=number('foOffset') || 0; $('foTime').value=new Date(Date.now()+offset*3600000).toISOString().slice(0,19); invalidate();
    }
    function input() {
        if (!$('foForm').reportValidity()) throw new Error('Lengkapi data observasi yang ditandai.');
        let time=$('foTime').value; if(time.length===16) time+=':00';
        const offset=number('foOffset'), utc=new Date(Date.parse(time+'Z')-offset*3600000).toISOString(), type=$('foType').value;
        return {type,condition:Number($('foCondition').value),conditionLabel:conditionLabels[Number($('foCondition').value)],
            localTime:time,offsetHours:offset,utc,latitude:number('foLatitude'),longitude:number('foLongitude'),elevation:number('foElevation'),
            location:$('foLocation').value,observer:accountSession.user?.name||'',notes:$('foNotes').value,result:$('foResult').value,sky:$('foSky').value,
            instrument:$('foInstrument').value,status:$('foStatus').value,visibility:type==='hilal'?$('foVisibility').value:null,
            syafaqAngle:number('foSyafaq'),abyadhAngle:number('foAbyadh'),methodKey:$('foMethod').value,
            measurement:['dhuhr','asr_jumhur','asr_hanafi'].includes(type)?{heightMeters:number('foHeight'),shadowMeters:number('foShadow'),directionDegrees:number('foDirection'),timestamp:utc,method:type,poleStage:Number($('foPoleStage').value)}:null};
    }
    function clock(value, offset) { return value ? new Date(Date.parse(value)+offset*3600000).toISOString().slice(0,19).replace('T',' ') : 'Tidak terjadi / tidak tersedia pada tanggal ini'; }
    const metric=(key,value)=>'<div><dt>'+escape(key)+'</dt><dd>'+escape(value)+'</dd></div>';
    const round=value=>Number.isFinite(value)?value.toFixed(3):'—';
    function calculationHtml(c,o) {
        const labels=FieldObservationEngine.labels;
        let html='<section class="fo-calculated"><h3>Calculated · GIS / Astronomi</h3><p>'+escape(c.engine)+' · UTC '+escape(c.timestamp)+'</p><dl class="fo-metrics">';
        ['sun','moon'].forEach(body=>{ const p=c[body], title=body==='sun'?'Matahari':'Bulan'; html+=metric(title+' altitude tampak',round(p.altitude)+'°')+metric(title+' altitude geometris',round(p.geometricAltitude)+'°')+metric(title+' azimuth dari Utara',round(p.azimuth)+'°')+metric(title+' deklinasi',round(p.declination)+'°')+metric(title+' sudut jam',round(p.hourAngleDegrees)+'°'); });
        html+=metric('Iluminasi Bulan',round(c.moon.illumination*100)+'%')+metric('Fase Bulan',round(c.moon.phaseDegrees)+'°')+metric('Elongasi Bulan–Matahari',round(c.moon.elongationDegrees)+'°')+metric('Transit / Istiwa',clock(c.transit,o.offsetHours))+'</dl>';
        if (o.measurement) html+='<h4>Pengukuran bayangan · meter</h4><dl class="fo-metrics">'+metric('Tinggi / bayangan aktual',o.measurement.heightMeters+' / '+o.measurement.shadowMeters)+metric('Rasio aktual',round(c.shadow.measuredRatio))+metric('Rasio hasil posisi Matahari',round(c.shadow.predictedRatio))+metric('Rasio saat transit',round(c.shadow.noonRatio))+metric('Target Jumhur / Hanafi',round(c.shadow.expectedJumhurRatio)+' / '+round(c.shadow.expectedHanafiRatio))+'</dl>';
        html+='<h4>Waktu sholat · UTC'+(o.offsetHours>=0?'+':'')+o.offsetHours+'</h4><div class="fo-table"><table><thead><tr><th>Peristiwa</th><th>Perhitungan</th><th>Observasi</th><th>Selisih (detik)</th></tr></thead><tbody>';
        Object.entries(c.prayer).forEach(([key,value])=>{html+='<tr><td>'+escape(labels[key]||'Isha')+'</td><td>'+escape(clock(value,o.offsetHours))+'</td><td>'+escape(o.type===key?clock(o.utc,o.offsetHours):'—')+'</td><td>'+escape(o.type===key?round(c.comparison.differenceSeconds):'—')+'</td></tr>';});
        html+='</tbody></table></div><p>Selisih = waktu observasi − waktu perhitungan. Nilai positif berarti observasi lebih lambat. Kondisi visual dan hasil hitungan tetap merupakan dua data berbeda.</p>';
        if(c.referenceVisibility) {const r=c.referenceVisibility;html+='<section class="fo-reference"><h4>Referensi visibilitas Hilal #'+escape(r.referenceId)+'</h4><dl class="fo-metrics">'+metric('Waktu sumber',r.referenceUtc)+metric('Hasil lapangan sumber',r.visibility)+metric('Altitude Bulan sumber / sekarang',round(r.sourceMoon.altitude)+'° / '+round(r.currentMoon.altitude)+'°')+metric('Elongasi sumber / sekarang',round(r.sourceMoon.elongationDegrees)+'° / '+round(r.currentMoon.elongationDegrees)+'°')+metric('Iluminasi sumber / sekarang',round(r.sourceMoon.illumination*100)+'% / '+round(r.currentMoon.illumination*100)+'%')+'</dl><p>'+escape(r.note)+'</p></section>';}
        if(c.calibration) {const r=c.calibration; html+='<section class="fo-reference"><h4>Simulasi referensi #'+escape(r.referenceId)+' · '+escape(labels[r.event])+'</h4><dl class="fo-metrics">'+metric('Versi referensi',r.referenceVersion)+metric('Waktu sumber',r.referenceUtc)+metric('Aturan / parameter',r.rule+' / '+round(r.parameter))+metric('Metode dasar',clock(r.baseline,o.offsetHours))+metric('Hasil referensi',clock(r.calculated,o.offsetHours))+metric('Selisih terhadap metode dasar',round(r.differenceSeconds)+' detik')+'</dl><p>'+escape(r.note)+'</p></section>';}
        return html+'<details><summary>Parameter, sumber engine & konvensi hitungan</summary><p><a href="https://github.com/cosinekitty/astronomy/tree/v2.1.19" target="_blank" rel="noopener">Astronomy Engine 2.1.19</a>. Posisi tampak memakai refraksi normal. Fajar/senja memakai pusat Matahari geometris. Ketinggian yang tidak diisi dihitung sebagai 0 m. Sudut syafaq adalah parameter analisis pilihan pengguna, bukan pengesahan kriteria.</p><pre>'+escape(JSON.stringify(c.parameters,null,2))+'</pre></details></section>';
    }
    function observedHtml(o) {
        return '<section class="fo-observed"><h3>Observed · Data lapangan</h3><dl class="fo-metrics">'+metric('Observer',o.observer)+metric('Lokasi',o.location)+metric('Latitude / Longitude',o.latitude+' / '+o.longitude)+metric('Elevasi',o.elevation===null?'Tidak tersedia':o.elevation+' m')+metric('Waktu lokal',o.localTime+' UTC'+(o.offsetHours>=0?'+':'')+o.offsetHours)+metric('UTC',o.utc)+metric('Kondisi',o.conditionLabel)+metric('Alat / metode',o.instrument)+metric('Status',o.status)+(o.type==='hilal'?metric('Hilal',o.visibility):'')+'</dl><p><b>Hasil:</b> '+escape(o.result)+'</p><p><b>Langit:</b> '+escape(o.sky)+'</p><p><b>Catatan:</b> '+escape(o.notes)+'</p></section>';
    }
    async function review() {
        const o=input();o.selfReview=$('foSelfReview')?.value||'';
        if($('foReference').value) { const fresh=await request('id='+encodeURIComponent($('foReference').value)); reference=fresh; } else reference=null;
        const c=FieldObservationEngine.calculate(o,methods.find(m=>m.methodKey===o.methodKey),reference);
        calculated={observed:o,calculated:c}; $('foReviewOutput').innerHTML=observedHtml(o)+calculationHtml(c,o); $('foSave').disabled=false;
        message('Review siap. Periksa data lapangan, foto, dan hitungan sebelum menyimpan ke database.'); return calculated;
    }
    function photoEditor() {
        $('foPhotosPreview').innerHTML=(current?current.photos:[]).filter(p=>!removed.includes(Number(p.id))).map(p=>'<figure><img tabindex="0" role="button" src="'+escape(p.url)+'" alt="'+escape(p.name)+'"><figcaption>'+escape(p.name)+' <button type="button" data-fo-remove="'+Number(p.id)+'">'+tr('Hapus foto','Delete photo')+'</button></figcaption><label>'+tr('Waktu pengambilan','Capture time')+'<input type="datetime-local" step="1" data-fo-saved-time="'+p.id+'" value="'+escape(p.metadata.capturedLocal||'')+'"></label><label>'+tr('Catatan foto','Photo notes')+'<input maxlength="2000" data-fo-saved-note="'+p.id+'" value="'+escape(p.metadata.note||'')+'"></label></figure>').join('')+
            newPhotos.map((p,i)=>'<figure><img src="'+escape(p.url)+'" alt="'+escape(p.file.name)+'"><figcaption>'+escape(p.file.name)+'</figcaption><label>Waktu pengambilan (lokal sesi)<input type="datetime-local" step="1" data-fo-photo-time="'+i+'" value="'+escape(p.capturedLocal)+'"></label><label>Catatan foto<input data-fo-photo-note="'+i+'" value="'+escape(p.note)+'" maxlength="2000"></label><button type="button" data-fo-drop="'+i+'">Batalkan foto</button></figure>').join('');
        renderComparison();
        $('foPhotosPreview').querySelectorAll('img').forEach(img=>{img.tabIndex=0;img.setAttribute('role','button');});
    }
    function comparisonSources(){return [{url:asset(Number($('foCondition').value)||0),name:tr('Ilustrasi kondisi pilihan','Selected condition illustration')},...(current?.photos||[]).filter(p=>!removed.includes(Number(p.id))),...newPhotos.map(p=>({url:p.url,name:p.file.name}))];}
    function renderComparison(){
        if(!$('foCompareLeft'))return;const sources=comparisonSources();
        ['Left','Right'].forEach((side,index)=>{const select=$('foCompare'+side),old=select.value;select.innerHTML=sources.map((p,i)=>'<option value="'+i+'">'+escape(p.name)+'</option>').join('');select.value=old&&sources[old]?old:String(Math.min(index,sources.length-1));});updateComparison();
    }
    function updateComparison(){const sources=comparisonSources();['Left','Right'].forEach(side=>{const p=sources[Number($('foCompare'+side).value)]||sources[0],img=$('foCompareImage'+side);img.src=p.url;img.alt=p.name;});}
    function openPhoto(url,name){
        let dialog=$('foPhotoDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='foPhotoDialog';dialog.className='fo-photo-dialog';document.body.appendChild(dialog);}
        dialog.innerHTML='<form method="dialog"><button>'+tr('Tutup','Close')+'</button></form><h2>'+escape(name||tr('Foto observasi','Observation photo'))+'</h2><img src="'+escape(url)+'" alt="'+escape(name)+'"><p><a target="_blank" rel="noopener" href="'+escape(url)+'">'+tr('Buka ukuran asli','Open original size')+'</a></p>';
        if(!dialog.open)dialog.showModal();
    }
    async function history() {
        const data=await request(''); rows=data.records;
        $('foHistory').innerHTML=rows.length?rows.map(r=>'<article class="fo-history-row"><strong>'+escape(FieldObservationEngine.labels[r.type])+' · #'+r.id+'</strong><p>'+escape(r.localTime.replace('T',' ')+' · '+r.location)+'</p><small>'+escape(r.observer+' · '+r.status+(r.reference?' · Referensi aktif':''))+'</small><div class="fo-actions"><button type="button" data-fo-view="'+r.id+'">Lihat</button><button type="button" data-fo-edit="'+r.id+'">Edit</button><button type="button" data-fo-delete="'+r.id+'">Hapus</button></div></article>').join(''):'<p>Belum ada sesi observasi tersimpan.</p>';
        const selection=$('foReference').value;
        $('foReference').innerHTML='<option value="">Tanpa referensi · metode dasar</option>'+rows.filter(r=>r.reference).map(r=>'<option value="'+r.id+'">#'+r.id+' '+escape(FieldObservationEngine.labels[r.type]+' · '+r.localTime+' · '+r.location)+'</option>').join('');
        if(rows.some(r=>String(r.id)===selection&&r.reference)) $('foReference').value=selection;
    }
    async function show(id) {
        const r=await request('id='+id); $('foDetail').innerHTML='<h3>Observasi #'+r.id+' · versi '+r.version+'</h3>'+observedHtml(r.observed)+
            '<div class="fo-photo-grid">'+r.photos.map(p=>'<figure><a href="'+escape(p.url)+'" target="_blank" rel="noopener"><img src="'+escape(p.url)+'" alt="'+escape(p.name)+'"></a><figcaption>'+escape(p.name)+'<br>'+escape(p.metadata.capturedLocal||'Waktu foto belum dicatat')+'<br>'+escape(p.metadata.note)+'</figcaption></figure>').join('')+'</div>'+calculationHtml(r.calculated,r.observed)+'<p><b>Status referensi:</b> '+(r.reference.enabled?'Aktif':'Tidak aktif')+' · '+escape(r.reference.note)+'</p><button type="button" data-fo-edit="'+r.id+'">Edit observasi ini</button>';
        const attribution=document.createElement('p');attribution.textContent=tr('Pembuat asal: ','Original creator: ')+(r.creator?.name||r.observed.observer)+(r.creator?.uniqueId?' · '+r.creator.uniqueId:'');$('foDetail').prepend(attribution);
        if(r.observed.selfReview){const note=document.createElement('p');note.textContent=tr('Review pribadi: ','Self-review: ')+r.observed.selfReview;$('foDetail').appendChild(note);}
        $('foDetail').hidden=false; $('foDetail').scrollIntoView({block:'start'}); return r;
    }
    function reset() {
        current=null; removed=[]; newPhotos.forEach(p=>URL.revokeObjectURL(p.url)); newPhotos=[];
        $('foForm').reset();if($('foSelfReview'))$('foSelfReview').value='';$('foObserver').value=accountSession.user?.name||''; $('foUuid').value=sessionUuid(); $('foSessionTitle').textContent='Sesi observasi baru';
        $('foReferenceEnabled').checked=false; $('foReferenceNote').value=''; $('foReferenceInfo').textContent=''; reference=null;
        $('foOffset').value=-new Date().getTimezoneOffset()/60; $('foDetail').hidden=true;
        const main=$('prayerMethod'); if(main&&methods.some(m=>m.methodKey===main.value)) $('foMethod').value=main.value;
        setAngles(); useGIS(); localNow(); condition(3); photoEditor(); invalidate();
    }
    function setAngles() {
        const method=methods.find(m=>m.methodKey===$('foMethod').value);
        if(method) { $('foSyafaq').value=method.ishaAngle; $('foAbyadh').value=method.ishaAngle; }
    }
    async function edit(id) {
        reset(); current=await request('id='+id); const o=current.observed;
        $('foUuid').value=current.uuid; $('foSessionTitle').textContent='Edit observasi #'+id+' · versi '+current.version;
        condition(o.condition);
        const fields={foType:'type',foTime:'localTime',foOffset:'offsetHours',foLatitude:'latitude',foLongitude:'longitude',foElevation:'elevation',foLocation:'location',foNotes:'notes',foResult:'result',foSky:'sky',foInstrument:'instrument',foStatus:'status',foVisibility:'visibility',foSyafaq:'syafaqAngle',foAbyadh:'abyadhAngle',foMethod:'methodKey'};
        Object.entries(fields).forEach(([id,key])=>{$(id).value=o[key]==null?'':o[key];});
        if(o.measurement) { $('foHeight').value=o.measurement.heightMeters; $('foShadow').value=o.measurement.shadowMeters; $('foDirection').value=o.measurement.directionDegrees==null?'':o.measurement.directionDegrees; $('foPoleStage').value=o.measurement.poleStage; poleGuide(); }
        $('foReferenceEnabled').checked=current.reference.enabled; $('foReferenceNote').value=current.reference.note;
        $('foSelfReview').value=o.selfReview||'';photoEditor(); $('foSessionTitle').scrollIntoView({block:'start'}); message('Record dimuat. Review ulang setelah perubahan sebelum menyimpan.');
    }
    async function save() {
        if(!calculated) throw new Error('Hitung & review terlebih dahulu.');
        const payload={action:'save',id:current?current.id:0,version:current?current.version:0,uuid:$('foUuid').value,...calculated,
            reference:{enabled:$('foReferenceEnabled').checked,note:$('foReferenceNote').value},removePhotos:removed,
            existingPhotoMetadata:Object.fromEntries((current?.photos||[]).filter(p=>!removed.includes(Number(p.id))).map(p=>[p.id,p.metadata])),
            photoMetadata:newPhotos.map(p=>({capturedLocal:p.capturedLocal,note:p.note}))};
        const saved=await request('',payload,newPhotos); current=saved; removed=[]; newPhotos.forEach(p=>URL.revokeObjectURL(p.url)); newPhotos=[];
        $('foSessionTitle').textContent='Observasi #'+saved.id+' tersimpan · versi '+saved.version; $('foPhotos').value=''; photoEditor();
        await history(); await show(saved.id); invalidate(); message('Observasi #'+saved.id+' tersimpan di database, termasuk hitungan dan '+saved.photos.length+' foto.');
    }
    async function run(fn) {
        if(busy) return; busy=true; $('foWorkspace').setAttribute('aria-busy','true');
        const controls=Array.from($('foWorkspace').querySelectorAll('button,input,select,textarea')), disabled=controls.map(el=>el.disabled);
        // Capture form values before asynchronous work; prevent edits while saving/reviewing.
        try { const work=fn(); controls.forEach(el=>el.disabled=true); await work; }
        catch(error) { message(error.message,true); }
        finally {
            controls.forEach((el,i)=>el.disabled=disabled[i]);
            ['foHeight','foShadow','foDirection'].forEach(id=>$(id).disabled=$('foMeasurement').hidden);
            $('foSave').disabled=!calculated; busy=false; $('foWorkspace').setAttribute('aria-busy','false');
        }
    }
    async function init() {
        const root=$('fieldObservationRoot'); if(!root) return;
        root.innerHTML=`<div id="foWorkspace" class="fo-workspace">
          <div class="fo-heading"><p>Observasi lapangan · Rukyat & waktu sholat</p><h2 id="foSessionTitle">Sesi observasi baru</h2><button id="foNew" type="button">Sesi baru</button></div>
          <p id="foMessage" role="status" aria-live="polite">Menunggu engine GIS…</p>
          <form id="foForm"><input id="foUuid" type="hidden">
          <fieldset><legend>1 · Pilih kondisi observasi</legend><label>Jenis<select id="foType">${Object.entries(FieldObservationEngine.labels).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')}</select></label>
          <input id="foCondition" type="hidden"><figure class="fo-condition"><img id="foConditionImage" alt=""><figcaption id="foConditionCaption"></figcaption></figure>
          <details><summary>Panduan siklus kondisi · sebelum Fajar hingga malam</summary><p>Pilih gambar yang sesuai kondisi lapangan. Siklus berlanjut kembali ke sebelum Fajar. Ilustrasi hilal tersedia di akhir panduan.</p><div class="fo-cycle">${conditions.map((_,i)=>'<button type="button" data-fo-condition="'+i+'" aria-pressed="false"><img loading="lazy" src="'+escape(asset(i))+'" alt="">'+escape(conditionLabels[i])+'</button>').join('')}</div></details></fieldset>
          <fieldset><legend>2 · Lokasi & waktu yang benar-benar diamati</legend><button id="foUseGIS" type="button">Gunakan lokasi pilihan GIS</button><div class="fo-fields">
          <label>Nama lokasi<input id="foLocation" required maxlength="240"></label><label>Observer / user<input id="foObserver" readonly required maxlength="180" autocomplete="name"></label>
          <label>Latitude<input id="foLatitude" type="number" min="-90" max="90" step="any" required></label><label>Longitude<input id="foLongitude" type="number" min="-180" max="180" step="any" required></label><label>Elevasi (m, opsional)<input id="foElevation" type="number" min="-500" max="9000" step="any"></label>
          <label>Waktu lokal observasi / pengukuran<input id="foTime" type="datetime-local" step="1" required></label><label>Offset UTC lokasi (jam)<input id="foOffset" type="number" min="-12" max="14" step="0.25" required></label></div><button id="foNow" type="button">Isi waktu sekarang</button><p>Periksa offset UTC lokasi, termasuk DST jika berlaku. Waktu ini juga dipakai untuk posisi Matahari/Bulan dan pengukuran bayangan.</p></fieldset>
          <fieldset><legend>3 · Hasil lapangan</legend><label>Hasil yang diamati<textarea id="foResult" required maxlength="10000" rows="3" placeholder="Jelaskan apa yang terlihat, termasuk perubahan kondisi."></textarea></label><label>Kondisi langit<input id="foSky" maxlength="2000" placeholder="Awan, kabut, kejernihan horizon, polusi cahaya"></label><label>Metode / instrumen<select id="foInstrument"><option value="naked_eye">Mata telanjang</option><option value="gnomon">Tiang / gnomon</option><option value="binocular">Binokular</option><option value="telescope">Teleskop</option><option value="camera">Kamera</option></select></label><div id="foHilal" hidden><label>Hasil hilal<select id="foVisibility"><option value="uncertain">Belum dapat dipastikan</option><option value="visible">Terlihat</option><option value="not_visible">Tidak terlihat</option></select></label></div><label>Catatan observer<textarea id="foNotes" rows="2" maxlength="10000"></textarea></label><label>Status<select id="foStatus"><option value="draft">Draft lapangan</option><option value="recorded">Observasi selesai dicatat</option></select></label></fieldset>
          <fieldset id="foMeasurement" hidden><legend>4 · Pengukuran bayangan Dhuhr / Ashr</legend><label>Panduan metode<select id="foPoleStage">${poleLabels.map((label,i)=>'<option value="'+i+'">'+label+'</option>').join('')}</select></label><div id="foPoleImages" class="fo-pole-images"></div><div class="fo-fields"><label>Tinggi tiang (m)<input id="foHeight" type="number" min="0.001" max="100" step="any"></label><label>Panjang bayangan (m)<input id="foShadow" type="number" min="0" max="10000" step="any"></label><label>Arah bayangan (° dari Utara, opsional)<input id="foDirection" type="number" min="0" max="360" step="any"></label></div><p>Gunakan tiang tegak dan permukaan datar. Pengukuran disimpan pada waktu observasi di atas. Target Jumhur/Hanafi memasukkan bayangan saat transit.</p></fieldset>
          <fieldset><legend>5 · Dokumentasi foto</legend><input id="foPhotos" type="file" accept="image/jpeg,image/png,image/webp" multiple><p>Maksimal 6 foto, 5 MB per foto. Isi waktu pengambilan dan catatan tiap foto; metadata tidak mengubah lokasi/waktu sesi secara otomatis.</p><div id="foPhotosPreview" class="fo-photo-grid"></div></fieldset>
          <fieldset><legend>6 · Metode perhitungan & referensi</legend><label>Metode Falak<select id="foMethod" required></select></label><div class="fo-fields"><label>Sudut Syafaq di bawah horizon (°)<input id="foSyafaq" type="number" min="0.1" max="29.9" step="0.1" required></label><label>Sudut Syafaq Abyadh (°)<input id="foAbyadh" type="number" min="0.1" max="29.9" step="0.1" required></label></div><p>Nilai awal mengikuti sudut Isha metode terpilih. Sesuaikan untuk analisis kondisi merah/putih; keduanya tidak otomatis dianggap kriteria yang sama.</p><label>Observation Reference untuk simulasi<select id="foReference"><option value="">Tanpa referensi · metode dasar</option></select></label><p id="foReferenceInfo"></p></fieldset>
          <div class="fo-actions"><button id="foReview" type="submit">7 · Hitung & review</button></div></form>
          <div id="foReviewOutput"></div>
          <fieldset><legend>8 · Simpan sesi & status referensi</legend><label class="fo-check"><input id="foReferenceEnabled" type="checkbox"> Jadikan Calibration / Observation Reference</label><label>Catatan referensi<textarea id="foReferenceNote" maxlength="2000" rows="2"></textarea></label><p>Satu observasi adalah referensi lapangan, bukan bukti universal. Hilal tersimpan sebagai referensi visibilitas dan tidak mengoreksi waktu sholat.</p><button id="foSave" type="button" disabled>Simpan observasi ke database</button></fieldset>
          <section id="foComparison"><h3>${tr('Bandingkan foto dan review pribadi','Compare photos and self-review')}</h3><div class="fo-comparison">${['Left','Right'].map(side=>'<figure><select id="foCompare'+side+'" aria-label="'+tr('Pilih gambar pembanding','Choose comparison image')+'"></select><img id="foCompareImage'+side+'" tabindex="0" role="button" alt=""></figure>').join('')}</div><label>${tr('Hasil review saya','My review notes')}<textarea id="foSelfReview" rows="3" maxlength="10000" form="foForm"></textarea></label><p>${tr('Bandingkan foto dengan ilustrasi atau foto lain, lalu catat penilaian Anda. Klik gambar untuk ukuran penuh.','Compare a photo with the illustration or another photo, then record your assessment. Click an image to view it full size.')}</p></section>
          <section><div class="fo-heading"><h3>Riwayat observasi</h3><button id="foReload" type="button">Muat ulang</button></div><div id="foHistory"></div><div id="foDetail" hidden></div></section>
        </div>`;
        $('foForm').addEventListener('input',invalidate);
        ['Left','Right'].forEach(side=>$('foCompare'+side).addEventListener('change',updateComparison));
        $('foSelfReview').addEventListener('input',invalidate);
        root.addEventListener('keydown',event=>{if(event.target.matches('img')&&['Enter',' '].includes(event.key)){event.preventDefault();openPhoto(event.target.src,event.target.alt);}});
        root.querySelectorAll('#foConditionImage').forEach(img=>{img.tabIndex=0;img.setAttribute('role','button');});
        $('foType').addEventListener('change',()=>condition(defaults[$('foType').value]));
        $('foPoleStage').addEventListener('change',poleGuide);
        $('foUseGIS').onclick=useGIS; $('foNow').onclick=localNow; $('foMethod').onchange=()=>{setAngles();invalidate();};
        $('foNew').onclick=()=>{reset();message('Sesi baru siap. Isi data observasi aktual.');};
        $('foForm').onsubmit=event=>{event.preventDefault();run(review);}; $('foSave').onclick=()=>run(save); $('foReload').onclick=()=>run(history);
        $('foReference').onchange=()=>run(async()=>{invalidate();reference=$('foReference').value?await request('id='+$('foReference').value):null;$('foReferenceInfo').textContent=reference?'Referensi #'+reference.id+' · '+reference.observed.localTime+' · '+reference.observed.location+' · altitude Matahari geometris '+round(reference.calculated.sun.geometricAltitude)+'°':'';});
        $('foPhotos').onchange=()=>{
            const files=Array.from($('foPhotos').files);
            if(files.some(f=>f.size>5*1024*1024) || files.length+newPhotos.length+(current?current.photos.length-removed.length:0)>6) {message('Maksimal 6 foto dan 5 MB per foto.',true);$('foPhotos').value='';return;}
            files.forEach(file=>newPhotos.push({file,url:URL.createObjectURL(file),capturedLocal:$('foTime').value,note:''}));$('foPhotos').value='';photoEditor();invalidate();
        };
        root.addEventListener('input',event=>{if(event.target.dataset.foSavedNote){current.photos.find(p=>String(p.id)===event.target.dataset.foSavedNote).metadata.note=event.target.value;invalidate();}if(event.target.dataset.foSavedTime){current.photos.find(p=>String(p.id)===event.target.dataset.foSavedTime).metadata.capturedLocal=event.target.value;invalidate();}let i=event.target.dataset.foPhotoTime;if(i!==undefined)newPhotos[Number(i)].capturedLocal=event.target.value;i=event.target.dataset.foPhotoNote;if(i!==undefined)newPhotos[Number(i)].note=event.target.value;});
        root.addEventListener('click',event=>{const img=event.target.closest('img');if(img&&!img.closest('.fo-cycle')){event.preventDefault();openPhoto(img.src,img.alt);return;}const b=event.target.closest('button');if(!b || busy)return;
            if(b.dataset.foCondition!==undefined)condition(Number(b.dataset.foCondition));
            if(b.dataset.foRemove){removed.push(Number(b.dataset.foRemove));photoEditor();invalidate();}
            if(b.dataset.foDrop!==undefined){const p=newPhotos.splice(Number(b.dataset.foDrop),1)[0];URL.revokeObjectURL(p.url);photoEditor();invalidate();}
            if(b.dataset.foView)run(()=>show(Number(b.dataset.foView)));
            if(b.dataset.foEdit)run(()=>edit(Number(b.dataset.foEdit)));
            if(b.dataset.foDelete)run(async()=>{const id=Number(b.dataset.foDelete),r=rows.find(row=>row.id===id);if(!confirm('Hapus observasi #'+id+' dari riwayat aktif?'))return;await request('',{action:'delete',id,version:r.version});if(current&&current.id===id)reset();$('foDetail').hidden=true;await history();message('Observasi #'+id+' dihapus dari riwayat aktif.');});
        });
        try {
            accountSession=await window.MpmAccount.ready;
            methods=await AdvancedAstroGIS.whenObservationMethodsReady();
            $('foMethod').innerHTML=methods.map(m=>'<option value="'+escape(m.methodKey)+'">'+escape(m.name)+'</option>').join('');
            reset(); if(accountSession.user)await history();ready=true;if(!accountSession.user){if(window.MpmViewer?.isViewer()){$('foObserver').value='Viewer (Demo)';$('foNotes').value=tr('Contoh pengamatan. Gunakan Hitung & review untuk melihat cara perhitungan; hasil tidak disimpan.','Example observation. Use Calculate & review to explore the calculation; results are not saved.');}message(tr('Login untuk menyimpan dan melihat observasi pribadi.','Log in to save and view personal observations.'));return;} message('Siap untuk observasi. Pilih kondisi, lokasi GIS, dan waktu lapangan.');
        } catch(error) { message(error.message,true); }
    }
    window.FieldObservations={getState:()=>({ready,currentId:current&&current.id,records:rows.length,reviewed:!!calculated}),reload:history};
    window.addEventListener(window.MpmAdvancedPage ? 'mpm:advanced-observations' : 'DOMContentLoaded',init);
}());
