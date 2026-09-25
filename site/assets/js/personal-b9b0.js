(function () {
 'use strict';
 const $=id=>document.getElementById(id), esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.PrayerI18n.mergeDictionary({id:{'account.manage':'Login / Kelola akun','account.login':'Login untuk bacaan pribadi'},en:{'account.manage':'Log in / Manage account','account.login':'Log in for personal reading'}});
 const storageKey='mpm:personal-reading:v1', names={quran:'Qur’an',tafsir:'Tafsir',hadith:'Hadis'};
 let cache;try{cache=JSON.parse(localStorage.getItem(storageKey)||'null');}catch(_){}
 cache=Object.assign({active:'',profiles:[],users:{},marks:{},outbox:{},drafts:{}},cache||{});
 let csrfToken='', active='', epoch=0, flushing=false, loading=false, photoChange, fetchTimer;
 function notice(text){$('readerProfileStatus').textContent=text;}
 function persist(){try{localStorage.setItem(storageKey,JSON.stringify(cache));return true;}catch(_){notice('Penyimpanan perangkat penuh. Catatan belum aman disimpan; jangan tutup halaman.');return false;}}
 function headers(){const h={'Content-Type':'application/json','X-CSRF-Token':csrfToken};if($('islamicAdminToken')&&$('islamicAdminToken').value)h['X-Admin-Token']=$('islamicAdminToken').value;return h;}
 async function api(resource,query,body){const response=await fetch('api/personal-reading.php'+(body?'':'?'+new URLSearchParams(Object.assign({resource},query||{}))),{method:body?'POST':'GET',headers:headers(),body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(10000)});let result;try{result=await response.json();}catch(_){throw new Error('SQL belum tersambung. Perubahan disimpan di perangkat.');}if(!response.ok||!result.success){const error=new Error(result.error||'SQL belum tersambung.');error.status=response.status;throw error;}return result.data;}
 function requestId(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
 function rowKey(uid,ref){return uid+'|'+ref.key;}
 function entries(){return Array.from(document.querySelectorAll('[data-reading-reference]'));}
 function reference(node){return JSON.parse(node.dataset.readingReference);}
 function mark(uid,key){return (cache.marks[uid]||{})[key]||{completed:false,note:'',revision:0};}
 function setMark(uid,key,value){if(!cache.marks[uid])cache.marks[uid]={};cache.marks[uid][key]=value;}
 function renderRow(node){
  const ref=reference(node);if(!active){node.innerHTML='<small>Login melalui Administrasi pengguna untuk menyimpan centang dan catatan.</small>';return;}
  const k=rowKey(active,ref), saved=mark(active,ref.key), pending=cache.outbox[k], draft=cache.drafts[k], value=draft||pending||saved;
  const conflict=pending&&pending.conflict;
  node.dataset.readerUser=active;
  node.innerHTML='<label class="reading-check"><input type="checkbox" data-reading-check '+(value.completed?'checked':'')+'> Sudah dipelajari</label><details '+(value.note?'open':'')+'><summary>Catatan kaki pribadi (opsional)</summary><label>Catatan untuk '+esc(ref.label||ref.key)+'<textarea data-reading-note maxlength="5000" rows="3" placeholder="Tambahkan catatan bila diperlukan…">'+esc(value.note)+'</textarea></label><button type="button" class="it-button small" data-reading-save>Simpan catatan</button><p class="reading-footnote" data-reading-footnote>'+esc(value.note)+'</p></details><small data-reading-state>'+(pending&&pending.problem?esc(pending.problem)+' Perubahan tetap tersimpan di perangkat.':conflict?'Ada perubahan dari perangkat lain. Pilih versi di bawah.':pending?'Menunggu sinkronisasi SQL…':draft?'Catatan belum disimpan.':saved.revision?'Tersimpan untuk profil ini.':'Belum ditandai.')+'</small>'+(conflict?'<div class="reading-conflict"><p>Versi server: '+(conflict.completed?'sudah dipelajari':'belum dicentang')+'</p><p>'+esc(conflict.note)+'</p><button type="button" class="it-button small" data-reading-keep>Gunakan versi saya</button> <button type="button" class="it-button small" data-reading-server>Ambil versi server</button></div>':'');
 }
 function renderRows(){entries().forEach(renderRow);}
 let resolveSession;window.MpmUserSessionReady=new Promise(resolve=>{resolveSession=resolve;});
 function renderProfile(){
  const p=cache.users[active];
  $('readerProfileName').textContent=p?p.name:window.PrayerI18n.t('account.login');
  $('readerProfileInitial').textContent='';
  const logged=!!active,en=document.documentElement.lang==='en';
  $('readerProfileTab').hidden=!logged;$('readerProfilePanel').hidden=!logged;
  $('readerSessionButton').textContent=logged?(en?'Logout':'Logout'):'Login';
  if(!logged&&$('readerProfileTab').classList.contains('active'))document.querySelector('[data-tab=quran]').click();
  $('readerProfileDetails').replaceChildren();
  (window.MpmProfileFields||[]).forEach(([key,id,enLabel])=>{const value=p?.details?.[key];if(value===null||value===undefined||String(value).trim()==='')return;const display=window.MpmProfileDisplay?MpmProfileDisplay(key,value,en):value;if(!display)return;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=en?enLabel:id;dd.textContent=display;$('readerProfileDetails').append(dt,dd);});
  $('readerProfilePhoto').hidden=!(p&&p.photo);$('readerProfileInitial').hidden=!!(p&&p.photo);
  if(p&&p.photo)$('readerProfilePhoto').src=p.photo;else $('readerProfilePhoto').removeAttribute('src');
  $('readerContinueCards').innerHTML=Object.keys(names).map(type=>{
   const pos=p&&p.positions&&p.positions[type],sum=p&&(p.summary||[]).find(r=>r.type===type);
   return '<article class="reading-progress-row"><strong>'+names[type]+'</strong><p>'+Number(sum&&sum.completed||0)+(en?' marked &middot; ':' ditandai &middot; ')+Number(sum&&sum.notes||0)+(en?' notes':' catatan')+'</p><p>'+esc(pos?pos.reference.label:(en?'No saved reading position.':'Belum ada posisi tersimpan.'))+'</p><button type="button" class="it-button small" data-reading-resume="'+type+'" '+(!pos||!window.IslamicTextReaderReady?.()?'disabled':'')+'>'+(en?'Continue reading':'Lanjutkan bacaan')+'</button></article>';
  }).join('');
 }
 window.addEventListener('mpm:language-changed',()=>{renderProfiles();renderRows();});
 function renderProfiles(){renderProfile();}
 async function refreshProfile(uid){try{const p=await api('profile',{user_id:uid});cache.users[uid]=p;persist();if(uid===active)renderProfile();}catch(e){if(uid===active)notice(e.message);}}
 async function loadMarks(){
  const uid=active, generation=epoch;if(!uid)return;const keys=Array.from(new Set(entries().map(n=>reference(n).key)));
  try{
   for(let offset=0;offset<keys.length;offset+=100){const list=keys.slice(offset,offset+100),rows=await api('marks',{user_id:uid,keys:JSON.stringify(list)});if(generation!==epoch||uid!==active)return;list.forEach(key=>{if(!(cache.marks[uid]||{})[key])setMark(uid,key,{completed:false,note:'',revision:0});});rows.forEach(r=>{if(Number(r.revision)>=Number(mark(uid,r.key).revision))setMark(uid,r.key,Object.assign({},r,{completed:!!Number(r.completed)}));});}
   persist();entries().forEach(node=>{if(!node.contains(document.activeElement))renderRow(node);});
  }catch(e){if(generation===epoch)notice('Mode perangkat: '+e.message);}
 }
 async function loadProfiles(){
  if(loading)return;loading=true;
  try{
   const response=await fetch('api/user-administration.php?resource=session',{cache:'no-store',credentials:'same-origin'});const result=await response.json();if(!response.ok||!result.success)throw new Error('Login belum tersedia.');
   csrfToken=result.data.csrf;const user=result.data.user;
   window.MpmUserSession=result.data;resolveSession(result.data);window.dispatchEvent(new CustomEvent('mpm:user-session-ready',{detail:result.data}));
   active=user?user.userId:'';epoch++;cache.active=active;cache.profiles=user?[{userId:active,name:user.name}]:[];
   if(user){cache.users[active]=Object.assign({},cache.users[active]||{},{userId:active,name:user.name});await refreshProfile(active);await loadMarks();}
   persist();renderProfiles();renderRows();notice(user?(document.documentElement.lang==='en'?'Reading saved for ':'Bacaan tersimpan untuk ')+user.name+'.':'');
  }catch(e){window.MpmUserSession={user:null,csrf:''};resolveSession(window.MpmUserSession);window.dispatchEvent(new CustomEvent('mpm:user-session-ready',{detail:window.MpmUserSession}));active='';epoch++;renderProfiles();renderRows();notice(e.message);}finally{loading=false;}flush();
 }
 function queue(node){
  const uid=node.dataset.readerUser,ref=reference(node);if(!uid||uid!==active)return;
  const k=rowKey(uid,ref),old=cache.outbox[k],base=mark(uid,ref.key);
  cache.outbox[k]={userId:uid,reference:ref,completed:node.querySelector('[data-reading-check]').checked,note:node.querySelector('[data-reading-note]').value,revision:old?old.revision:base.revision,requestId:requestId(),conflict:old&&old.conflict};
  delete cache.drafts[k];if(!persist())return;renderRow(node);flush();
 }
 async function flush(){
  if(flushing||!active)return;flushing=true;
  try{
   for(const [k,pending] of Object.entries(cache.outbox)){
    if(pending.userId!==active||pending.conflict||pending.problem)continue;
    let data;try{data=await api('',null,Object.assign({action:'save_mark'},pending));}catch(e){if(e.status>=400&&e.status<500&&e.status!==429){pending.problem=e.message;persist();if(pending.userId===active)renderRows();continue;}throw e;}
    const current=cache.outbox[k];
    if(data.conflict){if(current)current.conflict=Object.assign({completed:false,note:'',revision:0},data.current||{});persist();if(pending.userId===active)renderRows();continue;}
    setMark(pending.userId,pending.reference.key,data);
    if(current&&current.requestId===pending.requestId)delete cache.outbox[k];
    else if(current)current.revision=data.revision;
    persist();
    if(pending.userId===active){entries().filter(n=>reference(n).key===pending.reference.key&&!n.contains(document.activeElement)).forEach(renderRow);notice('Tersimpan di SQL untuk '+(cache.users[active]||{}).name+'.');}
    await refreshProfile(pending.userId);
   }
  }catch(e){notice('Belum tersinkron: '+e.message+' Antrean tiap profil tetap tersimpan.');}
  finally{flushing=false;}
 }
 async function resume(type){
  const uid=active,generation=epoch;if(!uid)return;
  try{let ref;try{ref=await api('resume',{user_id:uid,type});}catch(e){ref=((cache.users[uid]||{}).positions||{})[type]?.reference;if(!ref)throw e;}
   if(uid!==active||generation!==epoch)return;if(!ref)throw new Error('Belum ada posisi untuk bacaan ini.');
   await window.IslamicTextResumeReading(ref);await loadMarks();
   const node=entries().find(n=>reference(n).key===ref.key);if(node)node.scrollIntoView({block:'center',behavior:'smooth'});
  }catch(e){notice('Bacaan belum dapat dibuka: '+e.message);}
 }
 function init(){
  if(!$('readerProfileName'))return;
  $('readerSessionButton').onclick=async()=>{if(!active){location.href='users.html?lang='+(document.documentElement.lang==='en'?'en':'id');return;}try{const response=await fetch('api/user-administration.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify({action:'logout'})});if(!response.ok)throw new Error('Logout gagal');try{new BroadcastChannel('mpm:user-session').postMessage({type:'changed'});}catch(_){}await loadProfiles();}catch(e){notice(e.message);}};
 renderProfile();renderRows();loadProfiles();
  window.addEventListener('storage',event=>{if(event.key==='mpm:user-session-changed')loadProfiles();});
  try{const channel=new BroadcastChannel('mpm:user-session');channel.onmessage=()=>loadProfiles();}catch(_){}
  window.addEventListener('mpm:user-session-changed',loadProfiles);
  document.addEventListener('input',e=>{if(!e.target.matches('[data-reading-note]'))return;const node=e.target.closest('[data-reading-reference]'),uid=node.dataset.readerUser;if(uid!==active)return;cache.drafts[rowKey(uid,reference(node))]={note:e.target.value,completed:node.querySelector('[data-reading-check]').checked};persist();node.querySelector('[data-reading-state]').textContent='Catatan belum disimpan.';node.querySelector('[data-reading-footnote]').textContent=e.target.value;});
  document.addEventListener('change',e=>{if(e.target.matches('[data-reading-check]'))queue(e.target.closest('[data-reading-reference]'));});
  document.addEventListener('click',e=>{
   const resumeButton=e.target.closest('[data-reading-resume]');if(resumeButton){resume(resumeButton.dataset.readingResume);return;}
   const button=e.target.closest('[data-reading-save],[data-reading-keep],[data-reading-server]');if(!button)return;const node=button.closest('[data-reading-reference]'),uid=node.dataset.readerUser;if(uid!==active)return;
   const k=rowKey(uid,reference(node)),pending=cache.outbox[k];
   if(button.hasAttribute('data-reading-save'))queue(node);
   else if(pending&&pending.conflict){const server=Object.assign({},pending.conflict,{completed:!!Number(pending.conflict.completed)});setMark(uid,reference(node).key,server);if(button.hasAttribute('data-reading-server')){delete cache.outbox[k];delete cache.drafts[k];}else{pending.revision=server.revision;pending.requestId=requestId();delete pending.conflict;}persist();renderRow(node);flush();}
  });
  ['quranReader','tafsirReader','hadithReader'].forEach(id=>new MutationObserver(()=>{renderProfile();renderRows();clearTimeout(fetchTimer);fetchTimer=setTimeout(loadMarks,100);}).observe($(id),{childList:true}));
  window.addEventListener('islamic-reader-ready',renderProfile);
  window.addEventListener('focus',loadProfiles);
  window.addEventListener('online',()=>{loadProfiles();flush();});setInterval(()=>{if(!document.hidden)flush();},15000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
