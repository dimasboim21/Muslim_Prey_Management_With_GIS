(function(){'use strict';
const en=()=>new URLSearchParams(location.search).get('lang')==='en',t=(a,b)=>en()?b:a;
let session={user:null};
const blocked=/^(save|delete|remove|upload|import|publish|sync|register|approve|reject|restore|reset|simpan|hapus|unggah|impor|terbitkan|sinkron|daftar|setujui|tolak|pulihkan|tambah|add|create|update|apply|terapkan|mulai test|start test)\b/i;
const allowField=n=>n.closest('#loginForm,#calculatorForm')||n.matches('[type=search]')||/search|query|filter|language|lang|surah|ayah|count|limit|page|select|compare|date|time|offset|voltage|current|powerFactor|quantity|operating|tariff/i.test(n.id+' '+n.name);
function lock(root=document){
 if(!window.MpmViewer?.isViewer())return;
 root.querySelectorAll('input,textarea,button').forEach(n=>{
  if(n.closest('#mpmSiteNavigation,#loginForm'))return;
  if(n.tagName==='BUTTON'){
   const text=n.textContent.trim();if(blocked.test(text)&&!n.matches('[data-tab],[data-panel],[data-meep-tab]')){n.dataset.viewerLocked='1';n.setAttribute('aria-disabled','true');n.title=t('Login untuk mengubah data','Log in to change data');}
  }else if(n.type==='file'||!allowField(n)&&!['button','hidden','checkbox','radio','range'].includes(n.type)){n.readOnly=true;n.dataset.viewerLocked='1';if(n.type==='file')n.disabled=true;}
 });
}
function headerLinks(){
 document.querySelectorAll('header a[href*=".html"],.topbar a[href*=".html"],.it-header a[href*=".html"],.meep-header a[href*=".html"],#selectedBuildingReviewer').forEach(a=>{
  if(a.closest('#mpmSiteNavigation'))return;
  a.dataset.mpmLegacyNavigation='1';
  if(/login|akun|account|profile|profil/i.test(a.textContent)){a.hidden=true;return;}
  const href='main.html?lang='+(en()?'en':'id'),label=t('Beranda','Home');
  if(a.getAttribute('href')!==href)a.setAttribute('href',href);if(a.textContent!==label)a.textContent=label;
 });
}
function labels(){
 const nav=document.getElementById('mpmSiteNavigation');if(!nav)return;
 nav.querySelector('[data-home]').textContent=t('Beranda','Home');nav.querySelector('[data-home]').href='main.html?lang='+(en()?'en':'id');
 nav.querySelector('[data-session]').textContent=session.user?t('Logout','Logout'):t('Login','Log in');
 const demo=window.MpmViewer.isViewer();nav.querySelector('[data-mode]').textContent=demo?t('Viewer · Demo hanya baca','Viewer · Read-only demo'):(session.user?.name||'');
 nav.querySelector('[data-mode]').title=demo?t('Data contoh. Navigasi, peta dan perhitungan dapat dicoba tanpa menyimpan.','Example data. Explore navigation, maps and calculations without saving.'):'';
 document.querySelectorAll('.mpm-dialog-navigation [data-home]').forEach(n=>{n.textContent=t('Beranda','Home');n.href=nav.querySelector('[data-home]').href;});
 document.querySelectorAll('.mpm-dialog-navigation [data-session]').forEach(n=>n.textContent=session.user?'Logout':t('Login','Log in'));
 document.documentElement.classList.toggle('mpm-viewer',demo);
}
async function start(){
 session=await MpmViewer.ready;
 const nav=document.createElement('nav');nav.id='mpmSiteNavigation';nav.setAttribute('aria-label','Main');nav.innerHTML='<a data-home></a><span data-mode></span><button type="button" data-session></button><p id="mpmViewerNotice" role="status" hidden></p>';
 document.body.prepend(nav);document.documentElement.classList.add('mpm-has-navigation');labels();
 new ResizeObserver(()=>{document.documentElement.style.setProperty('--mpm-navigation-height',nav.offsetHeight+'px');window.AdvancedAstroGIS?.getMap?.()?.updateSize();}).observe(nav);
 nav.querySelector('[data-session]').onclick=async()=>{
  if(!session.user){location.href='users.html?lang='+(en()?'en':'id');return;}
  window.MpmSessionNavigationPending=true;
  try{const r=await fetch('api/user-administration.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({action:'logout'})});const v=await r.json();if(!r.ok||!v.success)throw Error(v.error);try{new BroadcastChannel('mpm:user-session').postMessage('logout');}catch(_){}location.href='main.html?lang='+(en()?'en':'id');}catch(e){window.MpmSessionNavigationPending=false;nav.querySelector('p').hidden=false;nav.querySelector('p').textContent=e.message;}
 };
 document.querySelectorAll('#advancedBuildingGate,#indexBuildingDialog').forEach(dialog=>{const links=document.createElement('div');links.className='mpm-dialog-navigation';links.innerHTML='<a data-home></a><button type="button" data-session></button>';dialog.prepend(links);links.querySelector('button').onclick=()=>nav.querySelector('[data-session]').click();});labels();
 // Legacy header navigation also goes through the main portal; content links keep their purpose.
 document.querySelectorAll('header a[href$=".html"],header a[href*=".html?"],.it-header a[href*=".html"],.meep-header a[href*=".html"]').forEach(a=>{if(a.closest('#mpmSiteNavigation'))return;if(/login|akun|account|profile|profil/i.test(a.textContent))a.hidden=true;else{a.href='main.html?lang='+(en()?'en':'id');a.textContent=t('Beranda','Home');}});
 if(MpmViewer.isStatic()&&document.getElementById('loginForm')){
  const info=document.createElement('p');info.className='mpm-static-login';info.textContent=t('Ini situs demonstrasi. Login akun tersedia pada instalasi aplikasi yang menggunakan server.','This is a demonstration site. Account login is available on the server installation.');document.getElementById('loginForm').prepend(info);document.getElementById('loginForm').querySelectorAll('input,button').forEach(n=>n.disabled=true);
 }
 if(MpmViewer.isViewer()&&document.getElementById('loginForm')){
  const example=document.createElement('section');example.className='mpm-demo-example';example.innerHTML='<h2>'+t('Contoh daftar pengguna','Example user list')+'</h2><p>'+t('Identitas fiktif untuk memperlihatkan tampilan. Ini bukan akun yang dapat digunakan untuk login.','Fictional identities showing the interface. These are not accounts you can log in with.')+'</p><table><thead><tr><th>'+t('Nama','Name')+'</th><th>'+t('Peran','Role')+'</th><th>Status</th></tr></thead><tbody><tr><td>'+t('Pengguna Contoh','Example User')+'</td><td>User</td><td>Demo</td></tr><tr><td>'+t('Editor Contoh','Example Editor')+'</td><td>Editor</td><td>Demo</td></tr></tbody></table>';document.querySelector('main')?.append(example);
 }
 lock();headerLinks();let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;lock();headerLinks();});}).observe(document.body,{childList:true,subtree:true});
}
document.addEventListener('click',e=>{if(!window.MpmViewer?.isViewer())return;const n=e.target.closest('[data-viewer-locked]');if(n){e.preventDefault();e.stopImmediatePropagation();MpmViewer.notice();}},true);
 document.addEventListener('submit',e=>{if(MpmViewer.isViewer()&&e.target.method!=='dialog'&&e.target.id!=='loginForm'&&e.target.id!=='calculatorForm'){e.preventDefault();e.stopImmediatePropagation();MpmViewer.notice();}},true);
window.addEventListener('mpm:language-changed',()=>{labels();lock();headerLinks();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
