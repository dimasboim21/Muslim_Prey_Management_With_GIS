(function(){
'use strict';
const hiddenStyles=new WeakMap();let restoring=false;let policy=window.MpmUrlAccess;if(!policy)return;
const current=policy.page,resources=()=>Object.values(policy.resources);
function matches(r,url){return r.page===decodeURIComponent(url.pathname.split('/').pop()||'index.html')&&Object.entries(r.match||{}).every(([k,v])=>url.searchParams.get(k)===v);}
function targets(url){const page=decodeURIComponent(url.pathname.split('/').pop()||'index.html');return resources().filter(r=>r.page===page&&(r.kind==='page'||(url.searchParams.get('access')&&r.key===page+'#'+url.searchParams.get('access'))||(Object.keys(r.match||{}).length&&matches(r,url))));}
function deny(r){const url=new URL(r.page,location.href);url.searchParams.set('lang',document.documentElement.lang==='en'?'en':'id');if(r.kind!=='page')url.searchParams.set('access',r.key.split('#')[1]);location.assign(url.href);}
function ruleFor(node){const host=node.closest('[data-access-key]');return host?policy.resources[current+'#'+host.dataset.accessKey]:null;}
function navigation(node){const tab=node.dataset.tab||node.dataset.panel||node.dataset.meepTab;return resources().find(r=>r.page===current&&r.kind==='panel'&&((r.trigger&&node.matches(r.trigger))||r.match?.panel===tab||r.selector&&document.querySelector(r.selector)?.id===node.getAttribute('aria-controls')));}
function apply(){
 let css='';for(const r of resources())if(r.page===current&&r.selector){const n=document.querySelector(r.selector);if(!r.allowed){css+=r.selector+'{display:none!important;visibility:hidden!important;pointer-events:none!important}';if(n&&!n.hasAttribute('inert')){n.dataset.accessInert='1';n.setAttribute('inert','');}}else if(n?.dataset.accessInert){delete n.dataset.accessInert;n.removeAttribute('inert');}}const style=document.getElementById('urlAccessStyle');if(style&&style.textContent!==css)style.textContent=css;
 document.querySelectorAll('a[href],[data-tab],[data-panel],[data-meep-tab],[data-auto-view],button[aria-controls]').forEach(node=>{
  if(node.closest('#urlAccessManagement'))return;
  let list=[];if(node.tagName==='A'){try{const u=new URL(node.href);if(u.origin===location.origin)list=targets(u);}catch(_){}}else{const r=navigation(node);if(r)list=[r];}
  if(list.some(r=>r.hidden)){if(!hiddenStyles.has(node))hiddenStyles.set(node,[node.style.getPropertyValue('display'),node.style.getPropertyPriority('display')]);node.dataset.accessHidden='1';node.style.setProperty('display','none','important');}else if(node.dataset.accessHidden){const old=hiddenStyles.get(node)||['',''];delete node.dataset.accessHidden;node.style.setProperty('display',old[0],old[1]);hiddenStyles.delete(node);}
 });
}
document.addEventListener('click',e=>{
 const node=e.target.closest('a[href],button,[data-tab],[data-panel],[data-meep-tab],[data-auto-view]');if(!node||node.closest('#urlAccessManagement'))return;
 let denied=ruleFor(node);if(denied?.allowed)denied=null;
 if(node.tagName==='A'){try{const u=new URL(node.href);if(u.origin===location.origin)denied=targets(u).find(r=>!r.allowed)||denied;}catch(_){}}
 else{const r=navigation(node);if(r&&!r.allowed)denied=r;}
 if(denied){e.preventDefault();e.stopImmediatePropagation();deny(denied);return;}
 const r=navigation(node);if(!restoring&&r&&r.page===current&&r.kind!=='page'&&current!=='bms.html'){
  // Keep each existing handler and its URL parameters; add only stable access identity.
  setTimeout(()=>{const u=new URL(location.href);if(current==="quran.html")u.searchParams.delete('access');else u.searchParams.set('access',r.key.split('#')[1]);history.replaceState(history.state,'',u);},0);
 }
},true);
function checkHash(){try{const node=document.getElementById(decodeURIComponent(location.hash.slice(1)));const r=node&&ruleFor(node);if(r&&!r.allowed){deny(r);return false;}}catch(_){}return true;}
window.MpmAccess={canPanel:name=>{const r=policy.resources[current+'#panel:'+name];return !r||r.allowed;}};
function route(){if(!checkHash())return;const denied=targets(new URL(location.href)).find(r=>!r.allowed);if(denied){deny(denied);return;}
 if(current==='bms.html'&&window.MpmMeepRoute){window.MpmMeepRoute.restore();return;}
 const key=new URL(location.href).searchParams.get('access');const r=key&&policy.resources[current+'#'+key];if(!r?.selector)return;
 let node=document.querySelector(r.selector);if(!node)return;
 const ancestors=[];for(let parent=node;parent;parent=parent.parentElement)ancestors.unshift(parent);
 restoring=true;for(const parent of ancestors){const own=parent.hasAttribute('data-access-key')?ruleFor(parent):null;const panel=own?.match?.panel;if(panel){const button=own.trigger?document.querySelector(own.trigger):Array.from(document.querySelectorAll('button[data-tab],button[data-panel]')).find(b=>(b.dataset.tab||b.dataset.panel)===panel);if(button)button.click();}if(parent.tagName==='DETAILS')parent.open=true;}
 restoring=false;node.scrollIntoView({block:'start'});
}
let queued=false;new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;apply();});}}).observe(document.documentElement,{childList:true,subtree:true});
for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=function(...args){const result=original(...args);const denied=targets(new URL(location.href)).find(r=>!r.allowed);if(denied)setTimeout(()=>deny(denied),0);return result;};}
window.addEventListener('popstate',route);window.addEventListener('hashchange',()=>{const node=document.getElementById(decodeURIComponent(location.hash.slice(1)));const r=node&&ruleFor(node);if(r&&!r.allowed)deny(r);});
async function refresh(){try{const response=await fetch('api/url-access.php',{cache:'no-store'});if(!response.ok)throw Error();const result=await response.json();policy.resources=result.data.resources;const denied=targets(new URL(location.href)).find(r=>!r.allowed);if(denied)deny(denied);else{apply();}}catch(_){location.reload();}}
window.addEventListener('mpm:user-session-changed',refresh);window.addEventListener('mpm:user-session-ready',refresh);window.addEventListener('focus',refresh);
try{new BroadcastChannel('mpm:url-access').onmessage=refresh;}catch(_){}
apply();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(route,0));else setTimeout(route,0);
})();
