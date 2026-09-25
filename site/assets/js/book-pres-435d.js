(function(){
  'use strict';
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.MpmBookPresentation={html(meta,draft){
    const en=document.documentElement.lang==='en',labels={quran:en?'Quranic evidence':'Dalil Al-Qur’an',commentary:en?'Commentary':'Penjelasan',reference:en?'Source':'Sumber',isnad:en?'Chain of narration':'Sanad',other:en?'Notes':'Catatan',main:en?'Continuation':'Lanjutan'};
    const language=meta.language||'',ref=meta.type==='tafsir'?`QS ${draft.surah||'?'}:${draft.ayahStart||'?'}–${draft.ayahEnd||'?'}`:(en?'Hadith ':'Hadis ')+(draft.number||'?');
    return `<article class="it-record it-book-reading"><div class="it-record-head"><strong>${escape(meta.book)}</strong><span class="it-badge">${escape(({ar:en?'Arabic':'Arab',id:'Bahasa Indonesia',en:'English'})[language]||language)}</span></div><p class="it-help">${escape([meta.author,meta.edition,meta.sourceLabel].filter(Boolean).join(' · '))}</p>${meta.translator?`<p class="it-help">${en?'Translator':'Penerjemah'}: ${escape(meta.translator)}</p>`:''}<p class="it-record-ref">${escape(ref)}</p>${draft.chapter?`<h3>${escape(draft.chapter)}</h3>`:''}<div class="it-book-text ${language==='ar'?'it-arabic':''}" dir="${language==='ar'?'rtl':'ltr'}" lang="${escape(language)}">${escape(draft.text)}</div>${(draft.parts||[]).filter(p=>p.text?.trim()).map(p=>`<section class="it-import-part"><strong>${escape(labels[p.role]||labels.other)}</strong><p class="it-book-text" dir="auto">${escape(p.text)}</p></section>`).join('')}</article>`;
  }};
})();
