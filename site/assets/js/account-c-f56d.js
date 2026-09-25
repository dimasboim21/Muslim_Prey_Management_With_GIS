(function(){'use strict';
  const cookie=()=>{const m=document.cookie.match(/(?:^|; )mpm_account_scope=([^;]*)/);return m?decodeURIComponent(m[1]):'guest';};
  const scope=cookie(),prefix='mpm-account:'+scope+':';
  // Even drafts, map positions and offline databases belong to this browser account.
  const methods={getItem:Storage.prototype.getItem,setItem:Storage.prototype.setItem,removeItem:Storage.prototype.removeItem};
  const scoped=k=>!String(k).startsWith('mpm-account:')&&!['mpm:user-session-changed'].includes(String(k));
  Object.keys(methods).forEach(name=>{Storage.prototype[name]=function(k,...args){return methods[name].call(this,scoped(k)?prefix+k:k,...args);};});
  if(window.indexedDB){for(const method of ['open','deleteDatabase']){const original=indexedDB[method].bind(indexedDB);indexedDB[method]=(name,...args)=>original(prefix+name,...args);}}
  const originalFetch=window.fetch.bind(window);let session={user:null,csrf:''};
  const staticMode=location.protocol==='file:'||/(^|\.)github\.io$/i.test(location.hostname);
  const ready=(window.MpmViewer?window.MpmViewer.ready.then(data=>({success:true,data})):staticMode?Promise.resolve({success:true,data:session}):originalFetch('api/user-administration.php?resource=session',{cache:'no-store',credentials:'same-origin'}).then(r=>r.json())).then(v=>{
    if(!v.success)throw Error(v.error);session=v.data;const actual=session.user?.userId||'guest';
    if(actual!==scope){document.cookie='mpm_account_scope='+encodeURIComponent(actual)+'; Path=/; SameSite=Strict';location.reload();throw Error('Account changed; reloading private workspace');}
    window.dispatchEvent(new CustomEvent('mpm:account-ready',{detail:session}));return session;
  });
  ready.catch(()=>{});
  window.MpmAccount={ready,getSession:()=>session,scope};
  window.fetch=async function(input,options){const url=new URL(input instanceof Request?input.url:String(input),location.href),method=String(options?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
    if(url.origin===location.origin&&url.pathname.includes('/api/')&&!['GET','HEAD','OPTIONS'].includes(method)&&!url.pathname.endsWith('/user-administration.php')){await ready;options={...options,headers:new Headers(options?.headers||(input instanceof Request?input.headers:{}))};options.headers.set('X-CSRF-Token',session.csrf);}
    return originalFetch(input,options);
  };
  const reload=()=>{if(!window.MpmSessionNavigationPending)location.reload();};
  window.addEventListener('mpm:user-session-changed',reload);
  window.addEventListener('storage',e=>{if(e.key==='mpm:user-session-changed')reload();});
  window.addEventListener('focus',()=>{if(cookie()!==scope)reload();});
  try{const channel=new BroadcastChannel('mpm:user-session');channel.onmessage=reload;}catch(_){}
})();
