(function(){
 'use strict';
 const labels={ONLINE:'Internet terhubung',DEGRADED:'Sebagian probe gagal / respons tidak sesuai',ADAPTER_DISCONNECTED:'Adaptor/jaringan perangkat terputus',LOCAL_NETWORK_UNVERIFIED:'Gateway belum terverifikasi',INTERNET_UNREACHABLE:'Internet tidak terjangkau; gateway merespons'};
 function init(){
  const badge=document.getElementById('networkBadge');if(!badge)return;
  const panel=document.createElement('details');panel.id='networkMonitorPanel';panel.style.cssText='font-size:12px;margin:8px 0';
  const title=document.createElement('summary');title.textContent='Pemantauan koneksi';
  const status=document.createElement('p'),scope=document.createElement('p'),log=document.createElement('ol');
  log.style.cssText='max-height:240px;overflow:auto;padding-left:20px';
  scope.textContent='Pemantauan pada komputer server/worker. Tidak mengubah otoritas waktu.';
  panel.append(title,status,scope,log);badge.parentElement.appendChild(panel);
  let busy=false,signature='';
  async function refresh(){if(busy||document.hidden)return;busy=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
   try{const r=await fetch('api/network-monitor.php',{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const data=await r.json();
    const current=data.state;status.textContent=data.stale?'Worker belum aktif / ada jeda pemantauan; durasi putus tidak dapat dipastikan.':(labels[current.status]||current.status)+' · '+Math.floor(current.continuousOutageMs/60000)+' menit putus teramati'+(current.sixHourOutage?' · mencapai 6 jam':'')+(current.gapBefore?' · ada jeda sebelum sampel ini':'');
    const next=JSON.stringify(data.recent);if(next!==signature){signature=next;const scroll=log.scrollTop;log.replaceChildren();(data.recent||[]).slice().reverse().forEach(row=>{const item=document.createElement('li');item.textContent=new Date(row.observedAt).toLocaleString()+' · '+(labels[row.status]||row.status)+(row.gapBefore?' · jeda pemantauan':'')+' · '+(row.probes||[]).map(p=>p.name+': '+(p.httpStatus||p.error||'gagal')+' / '+p.elapsedMs+' ms').join('; ');log.appendChild(item);});log.scrollTop=scroll;}
   }catch(_){status.textContent='Status worker tidak dapat diambil; koneksi browser ke server belum terverifikasi.';}finally{clearTimeout(timer);busy=false;}
  }
  refresh();setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
