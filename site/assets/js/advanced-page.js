(function(window,document){
'use strict';
const reviewerPage=document.body.dataset.reviewerMode==='display';
const panels={map:'astroMapToolsPanel','astronomical-information':'astroInformationPanel'};
const tabs=['context','observe','orbit','time','prayer','rukyat','api'];
const state={phase:'INITIALIZING',language:'id',buildingIdentifier:null,building:null,mapInitialized:false,applicationReady:false,selectedPanel:null,currentUser:null,allowedBuildings:null,configurationScope:'global'};
const historyLog=[],filters={page:1,adm0:'',adm1:'',adm2:''};
let routeVersion=0,queryVersion=0,latest=null,mountFlight=null,lazyFlight=null,adapter={},appliedPanel=null;
const copy=x=>JSON.parse(JSON.stringify(x));
const $=id=>document.getElementById(id);
const pairs={
 openReviewer:['Buka Reviewer','Open Reviewer'],building:['Gedung','Building'],changeBuilding:['Ganti gedung','Change building'],chooseAgain:['Pilih gedung lain','Choose another building'],
 loading:['Memuat gedung...','Loading building...'],loadingApp:['Memuat aplikasi peta...','Loading map application...'],
 notFound:['Gedung tidak ditemukan.','Building not found.'],unavailable:['Gedung belum dapat dimuat. Coba lagi atau pilih gedung lain.','Building could not be loaded. Retry or choose another building.'],
 applicationError:['Aplikasi belum dapat dimuat. Muat ulang halaman untuk mencoba kembali.','The application could not load. Reload the page to retry.'],
 denied:['Akses belum tersedia untuk konteks ini.','Access is unavailable for this context.']};
const dictionary={id:{},en:{}};Object.entries(pairs).forEach(([key,pair])=>{dictionary.id['advanced.'+key]=pair[0];dictionary.en['advanced.'+key]=pair[1];});PrayerI18n.mergeDictionary(dictionary);
const extraUi=[
 ['Lambat','Slow'],['Cepat','Fast'],['Lokal ADM0','Local ADM0'],['Angin 10 m','Wind at 10 m'],['Suhu 2 m','Temperature at 2 m'],
 ['Hujan prakiraan \u00b7 akumulasi 1 jam','Forecast rain \u00b7 1-hour accumulation'],['Tutupan awan prakiraan','Forecast cloud cover'],
 ['Radar \u00b7 intensitas pantulan','Radar \u00b7 reflectivity'],['Satelit harian \u00b7 warna alami','Daily satellite \u00b7 natural colour'],
 ['Sistem tropis / peringatan tornado','Tropical systems / tornado warnings'],['Lemah','Weak'],['Kuat','Strong'],
 ['Simpan & terapkan ke index.html','Save & apply to index.html']
];
['10m','50m','110m'].forEach(scale=>{extraUi.push(['Memuat perairan '+scale,'Loading '+scale+' water features'],['Perairan aktif \u00b7 '+scale,'Water features active \u00b7 '+scale]);});
MpmUiTranslations.register(extraUi);
const t=key=>PrayerI18n.t(key);
function can(name,...args){return typeof adapter[name]==='function'?Boolean(adapter[name](...args)):name!=='canEditBuilding';}
// This is a client integration seam, NOT authorization. Future servers must enforce access.
const permissions={canSelectBuilding:()=>can('canSelectBuilding'),canAccessBuilding:id=>can('canAccessBuilding',id),canEditBuilding:id=>can('canEditBuilding',id),canConfigureMap:()=>can('canConfigureMap')};
function audit(action,details={}){
 const allowed=['panel','before','after','result','error','metadata'];const event={schemaVersion:1,timestamp:new Date().toISOString(),actorIdentifier:state.currentUser?.id||null,role:state.currentUser?.role||null,buildingIdentifier:state.buildingIdentifier,page:reviewerPage?'reviewer.html':'webgis.html',panel:state.selectedPanel,action,category:['map_layer_change','map_configuration_change','panel_configuration_change','building_data_change','building_update'].includes(action)?'change':'access'};
 allowed.forEach(key=>{if(details[key]!==undefined)event[key]=details[key];});
 // Only constructed UI summaries are accepted internally; never field/token values.
 historyLog.push(event);if(historyLog.length>200)historyLog.shift();window.dispatchEvent(new CustomEvent('mpm:advanced-audit',{detail:copy(event)}));
}
function transition(phase){state.phase=phase;document.body.dataset.applicationState=phase;window.dispatchEvent(new CustomEvent('mpm:advanced-state',{detail:copy(state)}));}
function urlRoute(){const q=new URL(location.href).searchParams;return {language:PrayerI18n.getCurrentLanguage(),building:q.get('building')||'',panel:q.get('panel'),tab:q.get('tab')};}
function writeRoute(patch={},push=false){
 const old=new URL(location.href),q=old.searchParams;
 Object.entries(patch).forEach(([key,value])=>{if(value===null||value==='')q.delete(key);else q.set(key,value);});
 const ordered=new URLSearchParams();['lang','user','building','panel','tab'].forEach(key=>{if(q.has(key))ordered.set(key,q.get(key));});q.forEach((value,key)=>{if(!ordered.has(key))ordered.set(key,value);});old.search=ordered.toString();
 if(old.href!==location.href)window.history[push?'pushState':'replaceState'](window.history.state,'',old.href);
}
function shouldShowBuildingSelector(){return !urlRoute().building&&permissions.canSelectBuilding();}
function moveLanguage(target){const widget=document.querySelector('.mpm-language-switcher');if(widget&&target)target.appendChild(widget);}
function gateMessage(key){$('advancedGateStatus').dataset.i18n='advanced.'+key;$('advancedGateStatus').textContent=t('advanced.'+key);}
function showSelector(){
 if(!permissions.canSelectBuilding()){transition('APPLICATION_ERROR');gateMessage('denied');return;}
 transition('BUILDING_SELECTION_REQUIRED');$('advancedGate').hidden=false;document.querySelector('.app-shell')?.setAttribute('hidden','');
 moveLanguage($('advancedGateLanguage'));$('advancedChooseAgain').hidden=true;
 if(!$('advancedBuildingGate').open)$('advancedBuildingGate').showModal();audit('building_selection_open');renderSelection();loadSelection();
}
async function loadSelection(){
 const version=++queryVersion;const status=$('buildingSelectionStatus');status.textContent=t('selector.loading');
 try{const response=await fetch('api/mosque-admin.php?'+new URLSearchParams({view:'selector',...filters}),{cache:'no-store'});const body=await response.json();if(!response.ok||!body.success)throw Error('selection_unavailable');if(version!==queryVersion)return;latest=body.data;renderSelection();}
 catch(error){if(version===queryVersion){status.textContent=t('selector.unavailable');audit('error',{error:'selection_unavailable',result:'failed'});}}
}
function renderSelection(){
 $('buildingSelectionQuestion').textContent=t('selector.question');
 ['adm0','adm1','adm2'].forEach(key=>{const select=$('buildingFilter'+key);select.replaceChildren(new Option(t('selector.choose'+key),''));(latest?.filters[key]||[]).forEach(name=>select.add(new Option(name,name)));select.value=filters[key];select.disabled=key==='adm1'?!filters.adm0:key==='adm2'?!filters.adm1:false;});
 const list=$('buildingSelectionList');list.replaceChildren();(latest?.items||[]).slice(0,10).forEach(row=>{const button=document.createElement('button');button.type='button';button.className='building-choice';button.translate=false;const name=document.createElement('strong'),id=document.createElement('code');name.textContent=row.mosque_name;id.textContent=row.building_identifier;button.append(name,id);button.addEventListener('click',()=>selectBuilding(row.building_identifier));list.append(button);});
 $('buildingSelectionStatus').textContent=latest&&!latest.items.length?t('selector.empty'):'';
 $('buildingPagePrevious').disabled=!latest||latest.page<=1;$('buildingPageNext').disabled=!latest||latest.page>=latest.totalPages;
 $('buildingPageLabel').textContent=t('selector.page').replace('{page}',latest?.page||1).replace('{pages}',latest?.totalPages||1);
}
const resolveOriginal=MpmBuildingLinks.resolve;
// A validated gate context is reused only for the exact selected identifier.
MpmBuildingLinks.resolve=async identifier=>state.building&&state.buildingIdentifier===identifier?copy(state.building):resolveOriginal(identifier);
async function resolveBuilding(identifier){
 if(!permissions.canAccessBuilding(identifier))throw Object.assign(Error('denied'),{code:'denied'});
 const value=await resolveOriginal(identifier);
 if(!value?.mosque||(value.mosque.buildingIdentifier!==identifier && value.resolvedFromIdentifier!==identifier)||!Number.isFinite(Number(value.location?.latitude))||!Number.isFinite(Number(value.location?.longitude)))throw Object.assign(Error('invalid'),{code:'buildingCoordinatesMissing'});
 return value;
}
async function selectBuilding(identifier){
 const version=++routeVersion;transition('BUILDING_LOADING');$('buildingSelectionStatus').textContent=t('advanced.loading');
 try{const building=await resolveBuilding(identifier);if(version!==routeVersion)return;
 identifier=building.mosque.buildingIdentifier;state.buildingIdentifier=identifier;state.building=building;audit('building_selected');writeRoute({lang:state.language,building:identifier},true);await enterApplication(version);
 }catch(error){if(version!==routeVersion)return;if(state.phase==='BUILDING_SELECTED'){transition('APPLICATION_ERROR');gateMessage('applicationError');$('advancedGate').hidden=false;state.applicationReady=false;document.querySelector('.app-shell')?.setAttribute('hidden','');return;}transition('BUILDING_SELECTION_REQUIRED');$('buildingSelectionStatus').textContent=t(error.code==='denied'?'advanced.denied':error.code==='buildingNotFound'||error.code==='invalidIdentifier'?'advanced.notFound':'advanced.unavailable');audit('error',{error:'building_validation_failed',result:'failed'});}
}
function loadScript(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');const optional=/^https:/.test(src);const url=new URL(src,location.href);if(!optional)url.searchParams.set('advanced','20260918-gate');script.src=url.href;script.async=false;const timer=setTimeout(()=>{script.remove();reject(Error('asset_timeout'));},optional?6000:20000);script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);reject(Error('asset_unavailable'));};document.body.append(script);});}
async function mount(){
 if(mountFlight)return mountFlight;
 mountFlight=(async()=>{
 document.body.append($('advancedApplicationTemplate').content.cloneNode(true));moveLanguage(document.querySelector('.app-shell [data-language-slot]'));
 MpmUiTranslations.markStatic(document.querySelector('.app-shell'));
 translateMapStatus();
 const manifest=JSON.parse($('advancedScriptManifest').textContent);
 for(const src of manifest){try{await loadScript(src);}catch(error){if(/^https:/.test(src)){audit('error',{error:'optional_asset_unavailable'});continue;}throw error;}}
 window.dispatchEvent(new Event('mpm:advanced-mount'));
 const ready=await AdvancedAstroGIS.whenReady();if(ready.initialization!=='READY'||!AdvancedAstroGIS.getMap())throw Error('map_not_ready');
 state.mapInitialized=true;bindApplication();
 const map=AdvancedAstroGIS.getMap();map.addControl(new ol.control.ScaleLine());new ResizeObserver(()=>map.updateSize()).observe($('map'));map.updateSize();
 })();return mountFlight;
}
async function enterApplication(version){
 $('advancedBuildingGate').close();$('advancedChooseAgain').hidden=true;gateMessage('loadingApp');transition('BUILDING_SELECTED');
 await mount();if(version!==routeVersion)return;
 document.querySelector('.app-shell').hidden=false;$('advancedGate').hidden=true;
 window.dispatchEvent(new CustomEvent('mpm:building-selected',{detail:{identifier:state.buildingIdentifier}}));
 for(let attempt=0;attempt<100;attempt++){
   if(version!==routeVersion)return;
   if(AdvancedAstroGIS.getState().adminContext?.mosque.buildingIdentifier===state.buildingIdentifier)break;
   if(attempt===99)throw Error('building_context_not_ready');
   await new Promise(resolve=>setTimeout(resolve,100));
 }
 state.applicationReady=true;transition('APPLICATION_READY');audit('building_loaded');audit('building_view');
 applyPanelRoute();moveLanguage(document.querySelector('.app-shell [data-language-slot]'));AdvancedAstroGIS.getMap().updateSize();
}
async function route(){
 const version=++routeVersion,r=urlRoute();state.language=r.language;writeRoute({lang:state.language});
 if(!r.building){state.buildingIdentifier=null;state.building=null;state.applicationReady=false;state.selectedPanel=null;$('advancedGate').hidden=false;document.querySelector('.app-shell')?.setAttribute('hidden','');if(shouldShowBuildingSelector())showSelector();else{transition('APPLICATION_ERROR');gateMessage('denied');}return;}
 if(r.building===state.buildingIdentifier&&state.applicationReady){applyPanelRoute();return;}
 $('advancedBuildingGate').close();$('advancedGate').hidden=false;document.querySelector('.app-shell')?.setAttribute('hidden','');moveLanguage($('advancedGate').querySelector('[data-language-slot]'));
 transition('BUILDING_LOADING');gateMessage('loading');$('advancedChooseAgain').hidden=!permissions.canSelectBuilding();
 try{const building=await resolveBuilding(r.building);if(version!==routeVersion)return;state.buildingIdentifier=building.mosque.buildingIdentifier;writeRoute({building:state.buildingIdentifier});state.building=building;await enterApplication(version);}
 catch(error){if(version!==routeVersion)return;const applicationFailed=state.phase==='BUILDING_SELECTED';$('advancedGate').hidden=false;document.querySelector('.app-shell')?.setAttribute('hidden','');transition('APPLICATION_ERROR');state.applicationReady=false;gateMessage(error.code==='denied'?'denied':['buildingNotFound','invalidIdentifier'].includes(error.code)?'notFound':applicationFailed?'applicationError':'unavailable');$('advancedChooseAgain').hidden=!permissions.canSelectBuilding();audit('error',{result:'failed',error:'building_or_application_failed'});}
}
function applyPanelRoute(){
 updateReviewerLink();
 if(!state.applicationReady || reviewerPage)return;
 const r=urlRoute();let panel=r.panel;
 if(panel&&!panels[panel]){audit('invalid_panel',{result:'fallback'});panel='map';writeRoute({panel});}
 if(panel==='map'&&!permissions.canConfigureMap()){panel='astronomical-information';writeRoute({panel});audit('error',{error:'configuration_unavailable'});}
 panel=panel||null;const previous=appliedPanel;
 Object.entries(panels).forEach(([key,id])=>{const dialog=$(id);if(key===panel){if(!dialog.open)dialog.show();}else if(dialog.open)dialog.close();});
 document.querySelector('.app-shell').classList.toggle('has-panel',!!panel);state.selectedPanel=panel;appliedPanel=panel;
 document.querySelectorAll('[data-open-panel]').forEach(button=>button.setAttribute('aria-expanded',String((button.dataset.openPanel==='info'?'astronomical-information':button.dataset.openPanel)===panel)));
 if(previous!==panel){if(previous)audit('panel_close',{panel:previous});if(panel)audit('panel_open',{panel});audit('panel_change',{before:{panel:previous},after:{panel}});}
 if(panel==='map')audit('map_layer_view');
 if(panel==='astronomical-information'&&r.tab){const tab=tabs.includes(r.tab)?r.tab:'context';if(tab!==r.tab)writeRoute({tab});document.querySelector('[data-tab="'+tab+'"]').click();}
 requestAnimationFrame(()=>AdvancedAstroGIS.getMap().updateSize());
}
function openPanel(panel,push=true){if(!state.applicationReady)return;if(panel==='map'&&!permissions.canConfigureMap()){audit('error',{error:'configuration_unavailable'});return;}writeRoute({panel,tab:panel==='astronomical-information'?urlRoute().tab:null},push);applyPanelRoute();}
function lazyObservations(){if(!lazyFlight)lazyFlight=(async()=>{await loadScript('assets/js/astro/field-obs-b6f4.js?v=2');await loadScript('assets/js/astro/field-obs-578d.js?v=20260924-viewer1');window.dispatchEvent(new Event('mpm:advanced-observations'));})();return lazyFlight;}
function translateMapStatus(){
 ['waterFeaturesStatus','weatherLegend','weatherScopeSelect'].forEach(id=>{const node=id==='weatherScopeSelect'?$(id)?.querySelector('[value=local]'):$(id);if(!node)return;let value=node.textContent;
 extraUi.forEach(([idText,enText])=>{if(value===idText||value===enText||value.startsWith(idText+' \u00b7 ')||value.startsWith(enText+' \u00b7 ')){const previous=value.startsWith(idText)?idText:enText;value=(PrayerI18n.getCurrentLanguage()==='id'?idText:enText)+value.slice(previous.length);}});
 if(node.textContent!==value)node.textContent=value;
 });
}
function installFullViewportLayout(){
 const shell=document.querySelector('.app-shell'),header=shell.querySelector('.topbar'),nav=shell.querySelector('.astro-panel-launcher'),footer=shell.querySelector('.advanced-map-status');
 let frame=null;
 function layout(){
  frame=null;
  const shellTop=shell.getBoundingClientRect().top;
  const top=header.getBoundingClientRect().bottom-shellTop+8;nav.style.top=top+'px';
  const safeTop=nav.getBoundingClientRect().bottom-shellTop+8;
  const bottom=footer.getBoundingClientRect().height+16;
  shell.style.setProperty('--map-safe-top',safeTop+'px');shell.style.setProperty('--map-safe-bottom',bottom+'px');
  const drawer=Object.values(panels).map($).find(node=>node.open),mobile=innerWidth<=760;
  const panelBottom=drawer&&mobile?drawer.getBoundingClientRect().height+bottom+12:bottom;
  shell.style.setProperty('--map-control-bottom',panelBottom+'px');
  shell.style.setProperty('--map-control-right',drawer&&!mobile?(drawer.getBoundingClientRect().width+24)+'px':'8px');
  const map=AdvancedAstroGIS.getMap();
  map.getView().padding=[safeTop,drawer&&!mobile?drawer.getBoundingClientRect().width+24:16,panelBottom,16];map.updateSize();
 }
 function schedule(){if(frame===null)frame=requestAnimationFrame(layout);}
 const observer=new ResizeObserver(schedule);[shell,header,nav,footer,...Object.values(panels).map($)].forEach(node=>observer.observe(node));
 new MutationObserver(schedule).observe(shell,{attributes:true,attributeFilter:['class']});
 window.addEventListener('resize',schedule);schedule();
}
function updateReviewerLink(){
 const link=$('selectedBuildingReviewer');if(!link)return;
 link.hidden=!state.applicationReady || !state.buildingIdentifier;
 if(!link.hidden){const url=new URL('main.html',location.href);url.searchParams.set('lang',state.language);link.href=url.href;link.textContent=state.language==='en'?'Home':'Beranda';}
}
function bindApplication(){
 if(reviewerPage){$('advancedChangeBuilding').addEventListener('click',()=>{writeRoute({building:null},true);route();});return;}
 installFullViewportLayout();
 document.querySelector('.astro-panel-launcher').addEventListener('click',event=>{const button=event.target.closest('[data-open-panel]');if(!button)return;const panel=button.dataset.openPanel==='info'?'astronomical-information':button.dataset.openPanel;openPanel(state.selectedPanel===panel?null:panel);});
 document.querySelectorAll('[data-close-astro-drawer]').forEach(button=>button.addEventListener('click',()=>openPanel(null)));
 Object.values(panels).forEach(id=>$(id).addEventListener('cancel',event=>{event.preventDefault();openPanel(null);}));
 $('advancedChangeBuilding').hidden=!permissions.canSelectBuilding();$('advancedChangeBuilding').addEventListener('click',()=>{writeRoute({building:null},true);route();});
 document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{if(state.selectedPanel!=='astronomical-information')return;writeRoute({tab:button.dataset.tab});if(button.dataset.tab==='rukyat')lazyObservations().catch(()=>audit('error',{error:'observation_load_failed'}));}));
 let previousConfiguration=window.MpmMapPresentation?.capture();
 const root=document.querySelector('.app-shell');
 const statusObserver=new MutationObserver(translateMapStatus);['waterFeaturesStatus','weatherLegend','weatherScopeSelect'].forEach(id=>{if($(id))statusObserver.observe($(id),{subtree:true,childList:true,characterData:true});});
 root.addEventListener('change',event=>{const node=event.target;if(!node.id||/token|password|key|secret/i.test(node.id))return;
 if(node.closest('#astroMapToolsPanel')){const after=window.MpmMapPresentation?.capture();audit('map_configuration_change',{before:previousConfiguration,after,metadata:{control:node.id,scope:'global'},result:'local'});previousConfiguration=after;}
 else if(node.closest('#astroInformationPanel'))audit('panel_configuration_change',{metadata:{control:node.id},result:'local'});
 });
 root.addEventListener('input',event=>{if(event.target.type==='search')audit('search',{metadata:{control:event.target.id,queryLength:event.target.value.length}});});
 const map=AdvancedAstroGIS.getMap();map.getLayers().forEach((layer,index)=>['visible','opacity','zIndex'].forEach(property=>{let previous=layer.get(property);layer.on('change:'+property,()=>{const value=layer.get(property);audit('map_layer_change',{metadata:{layerIndex:index,property,scope:'global'},before:{value:previous??null},after:{value:value??null}});previous=value;});}));

}
window.MpmAdvancedPage={snapshot:()=>copy(state),events:()=>copy(historyLog),openPanel,shouldShowBuildingSelector,permissions,
 setAccessAdapter(value,context={}){adapter=value||{};state.currentUser=context.currentUser?{id:context.currentUser.id||null,role:context.currentUser.role||null}:null;state.allowedBuildings=Array.isArray(context.allowedBuildings)?context.allowedBuildings.slice():null;},
 // No building editor exists here: expose a typed integration event, never infer a DB update.
 recordBuildingChange(before,after){audit('building_data_change',{before:{revision:before?.revision||null},after:{revision:after?.revision||null},result:'external'});},
 configuration:{globalKey:'gis.reviewer-presentation',buildingSpecific:null}};
document.addEventListener('DOMContentLoaded',()=>{
 state.language=PrayerI18n.getCurrentLanguage();audit('page_open');
 $('advancedBuildingGate').addEventListener('cancel',event=>event.preventDefault());
 $('advancedChooseAgain').addEventListener('click',()=>{writeRoute({building:null},true);route();});
 ['adm0','adm1','adm2'].forEach(key=>$('buildingFilter'+key).addEventListener('change',event=>{const before=copy(filters);filters[key]=event.target.value;filters.page=1;if(key==='adm0'){filters.adm1='';filters.adm2='';}if(key==='adm1')filters.adm2='';audit('filter_change',{before,after:copy(filters)});loadSelection();}));
 $('buildingPagePrevious').addEventListener('click',()=>{filters.page=Math.max(1,(latest?.page||1)-1);loadSelection();});$('buildingPageNext').addEventListener('click',()=>{filters.page=(latest?.page||1)+1;loadSelection();});route();
});
window.addEventListener('popstate',route);
window.addEventListener('mpm:language-changed',()=>{state.language=PrayerI18n.getCurrentLanguage();writeRoute({lang:state.language});if($('advancedBuildingGate').open)renderSelection();translateMapStatus();updateReviewerLink();});
})(window,document);
