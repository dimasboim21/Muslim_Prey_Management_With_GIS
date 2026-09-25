(function(window,document) {
  'use strict';
  var KEY='gis.reviewer-presentation', LOCAL='mpm:gis:reviewer-presentation:v1', bridge=null, applying=false, pending=false;
  function t(key){return window.PrayerI18n.t('mapPresentation.'+key);}
  function status(key){var node=document.getElementById('mapPresentationStatus');if(node){node.dataset.i18n='mapPresentation.'+key;node.textContent=t(key);}}
  function local(){try{return JSON.parse(localStorage.getItem(LOCAL)||'null');}catch(error){return null;}}
  function store(value,dirty){try{localStorage.setItem(LOCAL,JSON.stringify({value:value,dirty:dirty,savedAt:new Date().toISOString()}));}catch(error){status('storageFailed');}}
  function capture(){return bridge?bridge.capture():null;}
  function changed(){if(!bridge||applying||document.body.dataset.reviewerMode==='display')return;pending=true;var value=capture();store(value,true);status('local');}
  async function load(force){
    var cached=local();if(force)pending=false;
    if(cached&&cached.value&&bridge){applying=true;try{bridge.apply(cached.value);}finally{applying=false;}}
    try {
      var response=await fetch('api/settings.php?key='+KEY,{cache:'no-store'});var body=await response.json();
      if(!response.ok||!body.success)throw new Error('unavailable');
      if(body.data&&body.data.value&&(force||!(cached&&cached.dirty))&&!pending){
        applying=true;try{bridge.apply(body.data.value);}finally{applying=false;}
        store(body.data.value,false);status('loaded');
      }else status(cached&&cached.dirty?'local':'loaded');
    }catch(error){status(cached?'local':'unavailable');}
    refreshAppearance();
  }
  async function save(){
    if(!bridge)return;var value=capture(),token=document.getElementById('mapPresentationToken');
    status('saving');
    try {
      var response=await fetch('api/settings.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Admin-Token':token?token.value:''},body:JSON.stringify({key:KEY,value:value,isPublic:true,actorId:'webgis-map-settings'})});
      var body=await response.json();if(!response.ok||!body.success){status(response.status===403?'authorization':'unavailable');return false;}
      pending=false;store(body.data.value,false);status('saved');return true;
    }catch(error){status('unavailable');return false;}
  }
  function refreshAppearance(){
    var select=document.getElementById('mapAppearanceLayer');if(!select||!bridge)return;
    var key=select.value,layer=capture().layers[key];if(!layer)return;
    document.getElementById('mapAppearanceVisible').checked=layer.visible;
    document.getElementById('mapAppearanceOpacity').value=layer.opacity;
    document.getElementById('mapAppearanceOrder').value=layer.zIndex;
  }
  function bindAppearance(){
    var select=document.getElementById('mapAppearanceLayer');if(!select)return;
    select.replaceChildren();Object.keys(capture().layers).forEach(function(key){var option=document.createElement('option');option.value=key;option.dataset.i18n='mapLayer.'+key;option.textContent=window.PrayerI18n.t('mapLayer.'+key);select.appendChild(option);});
    select.addEventListener('change',refreshAppearance);
    ['mapAppearanceVisible','mapAppearanceOpacity','mapAppearanceOrder'].forEach(function(id){document.getElementById(id).addEventListener('change',function(){bridge.setLayer(select.value,{visible:document.getElementById('mapAppearanceVisible').checked,opacity:Number(document.getElementById('mapAppearanceOpacity').value),zIndex:Number(document.getElementById('mapAppearanceOrder').value)});changed();});});
    document.getElementById('saveMapPresentation').addEventListener('click',save);
    document.getElementById('reloadMapPresentation').addEventListener('click',function(){load(true);});
    refreshAppearance();
  }
  window.MpmMapPresentation={attach:function(api){bridge=api;bindAppearance();return load();},changed:changed,capture:capture,save:save,reload:function(){return load(true);}};
  window.addEventListener('storage',function(event){if(event.key===LOCAL&&bridge){var cached=local();if(cached&&cached.value){applying=true;try{bridge.apply(cached.value);}finally{applying=false;}refreshAppearance();}}});
})(window,document);
