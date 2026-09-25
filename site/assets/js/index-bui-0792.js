(function(){
  'use strict';
  const gate=document.getElementById('indexBuildingDialog');
  const error=document.getElementById('indexBuildingError');
  const choose=document.getElementById('indexBuildingChoose');
  let started=false, loading=false;
  const en=()=>document.documentElement.lang==='en';
  window.IndexBuildingGate={data:null};
  function labels(){
    document.getElementById('indexBuildingTitle').textContent=en()?'Choose a building':'Pilih gedung';
    document.getElementById('buildingSelectionQuestion').textContent=en()?'Which building would you like to display?':'Gedung mana yang ingin Anda tampilkan?';
    choose.textContent=en()?'Choose another building':'Pilih gedung lain';
  }
  function loadScript(src){return new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=src;script.async=false;
    script.onload=resolve;script.onerror=()=>reject(Error('script'));document.body.appendChild(script);
  });}
  async function open(){
    if(started){location.reload();return;}
    if(loading)return;
    if(!gate.open)gate.showModal();labels();
    const id=window.MpmBuildingLinks.requested();
    if(!id){window.MpmBuildingSelector.show();labels();return;}
    loading=true;document.getElementById('buildingSelection').hidden=true;
    error.textContent=en()?'Loading building...':'Memuat gedung...';
    try{
      if(!window.MpmBuildingLinks.valid(id))throw Error('invalid');
      let data;
      try{
        const response=await fetch('api/active-mosque.php?building='+encodeURIComponent(id),{cache:'no-store'});
        const payload=await response.json();
        if(!response.ok||!payload.success||!payload.data)throw Error('missing');
        data=payload.data;
      }catch(failure){
        if(failure.message==='missing')throw failure;
        try{data=JSON.parse(localStorage.getItem('mpm:index-building:'+id));}catch(_){}
        if(!data)throw failure;
      }
      if(id!==window.MpmBuildingLinks.requested())return;
      if(data.mosque?.buildingIdentifier!==id)throw Error('identity');
      window.IndexBuildingGate.data=data;
      try{localStorage.setItem('mpm:index-building:'+id,JSON.stringify(data));}catch(_){}
      document.body.appendChild(document.getElementById('indexDashboardTemplate').content.cloneNode(true));
      const dashboard=document.querySelector('.app-shell');dashboard.hidden=true;
      const ready=new Promise(resolve=>window.addEventListener("mpm:index-ready",resolve,{once:true}));
      started=true;
      for(const src of JSON.parse(document.getElementById('indexDashboardScripts').textContent))await loadScript(src);
      await ready;
      dashboard.hidden=false;gate.close();
    }catch(failure){error.textContent=en()?'This building could not be loaded. Please choose a building again.':'Gedung tidak dapat dimuat. Silakan pilih gedung kembali.';choose.hidden=false;}
    finally{loading=false;if(!started&&id!==window.MpmBuildingLinks.requested())open();}
  }
  choose.addEventListener('click',()=>{const url=new URL(location.href);url.searchParams.delete('building');location.replace(url.href);});
  gate.addEventListener('cancel',event=>event.preventDefault());
  window.addEventListener('mpm:language-changed',()=>setTimeout(labels,0));
  window.addEventListener('mpm:building-selected',open);
  window.addEventListener('popstate',open);
  document.addEventListener('DOMContentLoaded',open);
})();
