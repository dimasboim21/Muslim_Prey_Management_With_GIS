(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const en=()=>document.documentElement.lang==='en', tr=(id,eng)=>en()?eng:id;
const state={asbab:{type:'asbab_al_nuzul',page:1},fiqh:{type:'fiqh',page:1}};
const api=async(resource,params={})=>{const r=await fetch('api/islamic-text.php?'+new URLSearchParams({resource,...params}));const j=await r.json();if(!r.ok||!j.success)throw Error(j.error||'Request failed');return j.data;};
const input=(key,name)=>document.querySelector('#'+key+'ClassicalPanel [name="'+name+'"]');
function shell(key){
 const asbab=key==='asbab',s=state[key];
 document.querySelector('[data-tab="'+key+'"]').textContent=asbab?'Asbab al-Nuzul':tr('Kitab Hukum & Fiqih','Islamic Law & Fiqh');
 document.getElementById(key+'ClassicalPanel').innerHTML='<div class="it-operation-card"><h2>'+(asbab?'Asbab al-Nuzul':tr('Kitab Hukum & Fiqih','Islamic Law & Fiqh'))+'</h2><form data-classical-form="'+key+'"><div class="it-fields-2">'+
 '<label>'+tr('Kitab','Book')+'<select name="book"><option value="">'+tr('Semua kitab','All books')+'</option></select></label>'+
 '<label>'+tr('Bahasa isi','Content language')+'<select name="language"><option value="ar">Arabic</option><option value="en">English</option><option value="id">Bahasa Indonesia</option></select></label>'+
 (asbab?'<label>Surah<select name="surah"></select></label><label>'+tr('Mulai ayat','Start ayah')+'<input name="ayah" type="number" min="1" value="1"></label><label>'+tr('Sampai ayat','End ayah')+'<input name="end" type="number" min="1" value="1"></label>':'<label>'+tr('Mazhab','Madhhab')+'<select name="madhhab"><option value="">'+tr('Semua','All')+'</option>'+['Hanafi','Maliki','Shafii','Hanbali'].map(x=>'<option value="'+x.toLowerCase()+'">'+x+'</option>').join('')+'</select></label><label>'+tr('Kategori','Category')+'<select name="category"><option value="fiqh">Fiqh</option><option value="comparative_fiqh">Comparative Fiqh</option><option value="usul_fiqh">Usul Fiqh</option><option value="qawaid_fiqhiyyah">Qawaid Fiqhiyyah</option></select></label><label>'+tr('Topik','Topic')+'<select name="topic"><option value="">'+tr('Semua','All')+'</option></select></label><label>'+tr('Volume','Volume')+'<input name="volume"></label><label>'+tr('Bab / bagian','Chapter / section')+'<select name="section"><option value="">'+tr('Semua','All')+'</option></select></label>')+
 '<label>'+tr('Penulis','Author')+'<input name="author"></label><label>'+tr('Cari dalam teks','Search text')+'<input name="q"></label><label>'+tr('Baris per laman','Rows per page')+'<select name="page_size"><option>10</option><option>25</option><option>50</option></select></label></div><button class="it-button primary" type="submit">'+tr('Tampilkan','Show')+'</button></form></div><p data-classical-overview class="it-help"></p><p data-classical-status role="status"></p><div data-classical-results></div><div class="it-source-actions"><button class="it-button" data-classical-prev>'+tr('Sebelumnya','Previous')+'</button><span data-classical-page></span><button class="it-button" data-classical-next>'+tr('Berikutnya','Next')+'</button></div><details class="it-operation-card"><summary>'+tr('Sumber dan status pemrosesan','Sources and processing status')+'</summary><div data-classical-sources></div></details>';
 input(key,'language').value=s.language||'ar';
}
function root(key){return document.getElementById(key+'ClassicalPanel');}
function syncAyah(){
 const from=document.getElementById('quranSurahSelect');if(!from?.options.length)return;
 input('asbab','surah').innerHTML=from.innerHTML;input('asbab','surah').value=from.value;
 input('asbab','ayah').value=document.getElementById('quranStartInput').value;
 input('asbab','end').value=document.getElementById('quranEndInput').value;
}
async function catalog(key){
 const s=state[key];if(s.loaded)return;
 const books=await api('classical_books',{type:s.type});
 input(key,'book').innerHTML='<option value="">'+tr('Semua kitab','All books')+'</option>'+books.map(b=>'<option value="'+b.id+'">'+esc((en()?b.titleEn:b.titleId)||b.title)+' — '+esc(b.author)+'</option>').join('');
 if(key==='fiqh'){const topics=await api('classical_topics');input(key,'topic').innerHTML='<option value="">'+tr('Semua','All')+'</option>'+topics.map(t=>'<option value="'+t.id+'">'+esc(en()?t.titleEn:t.titleId)+'</option>').join('');}
 const rows=await api('classical_sources',{type:s.type});
 const overview=await api('classical_overview',{type:s.type});
 root(key).querySelector('[data-classical-overview]').textContent=overview.books+' '+tr('kitab terdaftar','registered books')+' ? '+overview.archivedBooks+' '+tr('kitab diarsipkan','archived books')+' ? '+overview.reviewCandidates+' '+tr('bagian menunggu review','entries awaiting review')+' ? '+overview.publishedEntries+' '+tr('entri terbit','published entries')+(overview.publishedEntries===0?' ? '+tr('Isi pembaca belum tersedia. Buka Sumber dan status pemrosesan untuk melihat bahan review.','Reader content is not available yet. Open Sources and processing status to view review material.'):'');
 root(key).querySelector('[data-classical-sources]').innerHTML=rows.length?'<div style="overflow:auto"><table class="it-table"><thead><tr>'+['Book','Author','Category','Language','Format','Provider','License','Source','Download','Parse','Entries','Last checked','Status'].map(x=>'<th>'+esc(PrayerI18n.uiText(x))+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+[r.book,r.author,r.category,r.language,r.format,r.provider,r.licenseStatus].map(x=>'<td>'+esc(x||'UNKNOWN')+'</td>').join('')+'<td>'+sourceLink(r.url)+(r.reviewBatchId?'<button class="it-button small" data-classical-review="'+r.reviewBatchId+'">'+tr('Buka review','Open review')+'</button>':'')+'</td>'+[r.downloadStatus,r.parseStatus,r.entries,r.lastChecked,r.error||r.validationStatus].map(x=>'<td>'+esc(x??'UNKNOWN')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':tr('Belum ada sumber terdaftar untuk kategori ini.','No sources registered for this category.');
 s.loaded=true;
}
function sourceLink(url){if(!url)return '';try{const u=new URL(url,location.href);if(!['https:','http:'].includes(u.protocol))return '';}catch(_){return '';}return '<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+tr('Lihat sumber','View source')+'</a>';}
function renderEntry(item,language,key){
 const t=(item.translations||[]).find(t=>t.language===language),machine=!t&&language==='id'?item.madladTranslation:null;
 const content=language==='ar'?item.arabic:t?.text||machine?.text;
 const label=language==='ar'?tr('Teks Arab sumber','Original Arabic'):t?.label||machine?.label||tr('Terjemahan belum tersedia. Teks Arab ditampilkan.','Translation unavailable. Showing original Arabic.');
 const meta=[item.author,item.madhhab,item.edition,item.volume?tr('Volume ','Volume ')+item.volume:null,item.printedPage?tr('Halaman ','Page ')+item.printedPage:null].filter(Boolean);
 return '<article class="it-operation-card"><h3 translate="no">'+esc(item.book)+(item.heading?' — '+esc(item.heading):'')+'</h3><p>'+esc(meta.join(' · '))+'</p><p class="it-help">'+esc(label)+(machine?' · '+esc(machine.reviewStatus):'')+'</p><div translate="no" lang="'+(content?language:'ar')+'" dir="'+(language==='ar'||!content?'rtl':'ltr')+'" style="white-space:pre-wrap">'+esc(content||item.arabic)+'</div>'+(language!=='ar'?'<details><summary>'+tr('Lihat Arab asli','View original Arabic')+'</summary><p translate="no" dir="rtl" lang="ar">'+esc(item.arabic)+'</p></details>':'')+
 (item.authenticityStatus?'<p>'+esc(item.authenticityStatus)+' · '+esc(item.authenticitySource||'')+'</p>':'')+
 '<div class="it-source-actions">'+item.ayahLinks.map(a=>'<a class="it-button small" href="?lang='+document.documentElement.lang+'&panel=quran&surah='+a.surah+'&ayah='+a.start+'">Qur’an '+a.surah+':'+a.start+(a.end!==a.start?'–'+a.end:'')+'</a>').join('')+item.entityLinks.map(l=>l.hadithId?'<a href="?lang='+document.documentElement.lang+'&panel=hadith&hadith='+l.hadithId+'">Hadith #'+l.hadithId+'</a>':'').join('')+(item.sources||[]).map(s=>sourceLink(s.url)).join(' ')+'</div><div class="it-source-actions">'+['previous','next'].map(d=>item[d]?'<button class="it-button small" data-classical-entry="'+item[d]+'">'+(d==='previous'?tr('Bagian sebelumnya','Previous entry'):tr('Bagian berikutnya','Next entry'))+'</button>':'').join('')+'</div></article>';
}
async function load(key,id){
 const s=state[key],ticket=(s.ticket||0)+1;s.ticket=ticket;const status=root(key).querySelector('[data-classical-status]');status.textContent=tr('Memuat…','Loading…');
 try{
  await catalog(key);const f=Object.fromEntries(new FormData(root(key).querySelector('form')));f.type=f.category||s.type;f.page=s.page;if(id)f.id=id;s.language=f.language;
  const data=await api('classical_entries',f);if(ticket!==s.ticket)return;
  root(key).querySelector('[data-classical-results]').innerHTML=data.items.map(item=>renderEntry(item,f.language,key)).join('')||'<p class="it-empty">'+(key==='asbab'?tr('Belum ditemukan riwayat Asbabul Nuzul pada sumber yang tersedia.','No Asbab al-Nuzul reports found in the available sources.'):tr('Belum ada bagian kitab yang terverifikasi sesuai pilihan ini.','No verified book entries match these filters.'))+'</p>';
  root(key).querySelector('[data-classical-prev]').disabled=data.page<=1;root(key).querySelector('[data-classical-next]').disabled=data.page>=data.totalPages;root(key).querySelector('[data-classical-page]').textContent=data.page+' / '+data.totalPages+' · '+data.total;s.page=data.page;status.textContent='';
  const route={panel:key,book:f.book||null,entry:id||null,topic:f.topic||null,madhhab:f.madhhab||null,volume:f.volume||null,section:f.section||null,q:f.q||null,category:f.category||null,author:f.author||null,surah:f.surah||null,ayah:f.ayah||null,end:f.end||null,'reading-language':f.language,page:data.page,'page-size':f.page_size};s.route=route;if(root(key).closest(".it-panel").classList.contains("active"))window.MpmReaderNavigation?.update(route);
 }catch(e){if(ticket===s.ticket)status.textContent=e.message;}
}
function install(key){
 shell(key);const r=root(key);
 r.querySelector('form').addEventListener('submit',e=>{e.preventDefault();state[key].page=1;load(key);});
 r.querySelector('[data-classical-prev]').onclick=()=>{state[key].page--;load(key);};r.querySelector('[data-classical-next]').onclick=()=>{state[key].page++;load(key);};
 r.onclick=e=>{const review=e.target.closest('[data-classical-review]');if(review){window.ReviewedDocumentImporter?.openBatch(Number(review.dataset.classicalReview)).catch(error=>{r.querySelector('[data-classical-status]').textContent=error.message;});return;}const b=e.target.closest('[data-classical-entry]');if(b){for(const name of ['topic','madhhab','surah','ayah','end','volume','section','q','author'])if(input(key,name))input(key,name).value='';state[key].page=1;load(key,b.dataset.classicalEntry);}};
 r.querySelector('details').addEventListener('toggle',()=>{if(r.querySelector('details').open)catalog(key).catch(()=>{});});
 if(key==='fiqh')input(key,'book').addEventListener('change',()=>sections(key).catch(e=>{r.querySelector('[data-classical-status]').textContent=e.message;}));
}
for(const key of Object.keys(state))install(key);
document.addEventListener('click',e=>{const key=e.target.closest('[data-tab]')?.dataset.tab;if(state[key]){if(key==='asbab')syncAyah();load(key);}});
async function sections(key){
 if(key!=='fiqh')return;
 const book=input(key,'book').value,rows=book?await api('classical_sections',{book}):[];
 if(input(key,'book').value!==book)return;
 input(key,'section').innerHTML='<option value="">'+tr('Semua','All')+'</option>'+rows.map(s=>'<option value="'+s.id+'">'+esc(s.titleAr||s.titleEn||s.titleId||s.level)+'</option>').join('');
}
window.MpmClassical={
 snapshot:key=>state[key]?.route||{},
 restore:async(key,query)=>{
  if(!state[key])return;
  ++state[key].ticket;
  await catalog(key);
  if(key==='asbab')syncAyah();
  for(const name of ['book','topic','madhhab','surah','ayah','end','volume','q','category','author']){
   if(input(key,name))input(key,name).value=query.get(name)||(name==='category'?'fiqh':'');
  }
  await sections(key);
  if(input(key,'section'))input(key,'section').value=query.get('section')||'';
  input(key,'language').value=query.get('reading-language')||'ar';
  input(key,'page_size').value=query.get('page-size')||'10';
  state[key].page=Number(query.get('page'))||1;
  await load(key,query.get('entry'));
 },
 openImport:async(entry,metadata)=>{
  const key=entry.type==='asbab_al_nuzul'?'asbab':'fiqh';
  state[key].loaded=false;
  document.querySelector('[data-tab="'+key+'"]').click();
  await window.MpmClassical.restore(key,new URLSearchParams({book:entry.workId,entry:entry.readerId||entry.nativeId,category:entry.type,'reading-language':metadata.language}));
 }
};
window.addEventListener('islamic-reader-ready',()=>{if(!document.querySelector('[data-panel="asbab"].active'))syncAyah();});
window.addEventListener('mpm:language-changed',async()=>{for(const key of Object.keys(state)){const values=Object.fromEntries(new FormData(root(key).querySelector('form')));state[key].loaded=false;install(key);if(key==='asbab')syncAyah();try{await catalog(key);for(const [name,value] of Object.entries(values)){if(input(key,name))input(key,name).value=value;}await sections(key);if(input(key,'section'))input(key,'section').value=values.section||'';if(root(key).closest('.it-panel').classList.contains('active'))load(key);}catch(_){} }});
})();
