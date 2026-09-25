(function(){'use strict';
const nativeFetch=window.fetch.bind(window),base=new URL('../../',document.currentScript.src);
const isApi=url=>url.origin===base.origin&&url.pathname.startsWith(base.pathname+'api/');
let viewer=!window.MpmServerSession?.user,staticHost=window.MpmDeployment?.mode==='static'||location.protocol==='file:'||/(^|\.)github\.io$/i.test(location.hostname),fixturePromise;
let session=window.MpmServerSession||{user:null,csrf:''};
const ready=(async()=>{
 if(window.MpmServerSession&&!staticHost)return session;
 if(!staticHost){try{const r=await nativeFetch(new URL('api/user-administration.php?resource=session',base),{cache:'no-store',credentials:'same-origin'});const v=await r.json();if(!r.ok||!v.success)throw Error('session');session=v.data;viewer=!session.user;}catch(_){staticHost=true;}}
 return session;
})();
const lang=()=>new URLSearchParams(location.search).get('lang')==='en'?'en':'id';
const message=()=>lang()==='en'?'Viewer demo: data is read-only. Log in on the server application to save.':'Demo Viewer: data hanya dapat dilihat. Login pada aplikasi server untuk menyimpan.';
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-MPM-Mode':'viewer'}});
const ok=data=>response({success:true,data});
function fixtures(){return fixturePromise||(fixturePromise=nativeFetch(new URL('assets/demo/viewer-data.json',base)).then(r=>{if(!r.ok)throw Error('Demo data unavailable');return r.json();}));}
function notice(){const n=document.getElementById('mpmViewerNotice');if(n){n.textContent=message();n.hidden=false;}return message();}
async function demo(url,method,body){
 const endpoint=url.pathname.split('/').pop(),q=url.searchParams,resource=q.get('resource')||'bootstrap';
 if(endpoint==='user-administration.php'&&method==='GET'&&(resource==='session'||!q.has('resource')))return ok(session);
 if(endpoint==='url-access.php'&&method==='GET')return ok({resources:{}});
 const readonlyAction=endpoint==='meep-bms.php'&&['building_catalog','bootstrap','select_building','calculate'].includes(body?.action);
 if(!['GET','HEAD'].includes(method)&&!readonlyAction)return response({success:false,error:notice(),code:'viewer_read_only'},403);
 const d=await fixtures(),b=d.building,c=d.config;
 if(endpoint==='mosque-admin.php'){
  if(q.get('building')&&q.get('building')!==b.building_identifier)return response({success:false,error:'Demo building not found'},404);
  if(q.get('view')==='selector')return ok({items:[b],page:1,totalPages:1,total:1,filters:{adm0:['Indonesia'],adm1:['Jakarta'],adm2:['Central Jakarta']}});
  return ok([b]);
 }
 if(endpoint==='active-mosque.php')return ok(c);
 if(endpoint==='config.php')return ok(q.has('history')?[]:{config:c,configVersion:1,source:'viewer-demo'});
 if(endpoint==='fixed-markers.php')return response({success:true,markers:[{key:'kaabah',name:'Kaabah',latitude:21.422487,longitude:39.826206,type:'fixed',icon:'map/places/kaabah.png'}]});
 if(endpoint==='runtime.php')return ok({application:{name:'Muslim Prey Management With Gis',timezone:'Asia/Jakarta'},map:{tileUrl:'https://tile.openstreetmap.org/{z}/{x}/{y}.png'},runtimeMode:'viewer',features:{},modules:[],offline:{enabled:true},sync:{enabled:false}});
 if(endpoint==='health.php')return ok({status:'viewer',database:{online:false},databaseOnline:false});
 if(endpoint==='settings.php')return ok(q.has('key')?{key:q.get('key'),value:null}:{});
 if(endpoint==='falak-prayer-config.php'){const registry=d['falak-registry.php'].data;return ok({context:{mosqueId:1,latitude:b.latitude,longitude:b.longitude,timezone:'Asia/Jakarta'},methods:registry.prayerMethods,asrMethods:registry.asrMethods,selectedMethods:[],selectedMethodKeys:[],primaryMethodKey:'',source:'viewer-demo'});}
 if(endpoint==='field-observations.php')return ok({records:[]});
 if(endpoint==='reviewed-document-import.php')return ok({batches:[],surahs:d['islamic-bootstrap'].data.catalog.surahs,tafsirFamilies:[],collections:[]});
 if(endpoint==='personal-reading.php')return ok({profiles:[],user:null,marks:[],positions:[],events:[]});
 if(endpoint==='islamic-text.php'){
  const boot=d['islamic-bootstrap'].data;
  if(resource==='bootstrap')return ok(boot);
  if(resource==='catalog')return ok(boot.catalog);
  if(resource==='tafsir_manager')return ok(boot.tafsirManager);
  if(resource==='learning')return ok(boot.learningEngine);
  if(resource==='learning_lesson'){const sample=d['lesson:'+q.get('lesson_id')+':'+(q.get('language')||lang())];if(sample)return response(sample);}
  if(resource==='quran'||resource==='ayah'){
   if(q.has('surah')&&q.get('surah')!=='1'||q.get('tafsir_work_id')&&q.get('tafsir_work_id')!=='2')return response({success:false,error:lang()==='en'?'The demo includes Al-Fatihah and the labelled Al-Jalalayn excerpt.':'Demo memuat Al-Fatihah dan kutipan Al-Jalalayn yang diberi label.'},422);
   const sample=structuredClone(d[(q.get('tafsir_work_id')?'tafsir:':'quran:')+(q.get('language')==='en'?'en':'id')].data);
   const start=Number(q.get('start')||q.get('ayah')||1),count=Number(q.get('count')||7);sample.ayahs=sample.ayahs.filter(a=>a.ayahNumber>=start&&a.ayahNumber<start+count);sample.actualCount=sample.ayahs.length;sample.hasNext=false;sample.hasPrevious=start>1;sample.start=start;sample.end=start+sample.actualCount-1;
   return ok(resource==='ayah'?sample.ayahs[0]:sample);
  }
  if(resource==='hadiths'){const h=structuredClone(d['hadiths:'+(q.get('language')==='en'?'en':'id')].data);if(q.get('q'))h.records=h.records.filter(r=>JSON.stringify(r).toLowerCase().includes(q.get('q').toLowerCase()));if(q.get('collection_id')&&q.get('collection_id')!=='11')h.records=[];h.total=h.records.length;return ok(h);}
  if(resource==='presentations')return ok({presentations:[],items:[]});
  if(resource==='learning_admin_catalog')return ok({students:[],staff:[],levels:boot.learningEngine.levels});
 }
 if(endpoint==='meep-bms.php'){
  const record={recordType:'mosque',recordId:1,selectionKey:'mosque:1',displayName:b.mosque_name,typeKey:'mosque',typeName:'Demo',country:b.country,adm1:b.province,adm2:b.city,latitude:b.latitude,longitude:b.longitude};
  if(body?.action==='building_catalog')return ok({buildings:[record],buildingTypes:[],selectedBuildingKey:'mosque:1'});
  if(body?.action==='select_building')return ok({selectionKey:'mosque:1',context:c});
  if(body?.action==='bootstrap')return ok({site:{siteId:1,scopeKey:'demo',displayName:b.mosque_name,context:c},summary:{totalDevices:6,deviceRecords:2,connectedLoadW:140,estimatedDemandW:140,estimatedDailyKwh:1.2,estimatedMonthlyKwh:36,unknownLoadDevices:0,meterCount:0,maintenanceDue:0,maintenanceOverdue:0},devices:[{installedDeviceId:1,deviceName:'Demo LED',locationName:'Ruang contoh / Example room',disciplineKey:'electrical',quantity:4,ratedInputW:10,operatingHoursDay:10,calculation:{connectedLoadW:40,dailyKwh:.4,monthlyKwh:12},maintenanceStatus:'not-scheduled'},{installedDeviceId:2,deviceName:'Demo fan',locationName:'Ruang contoh / Example room',disciplineKey:'electrical',quantity:2,ratedInputW:50,operatingHoursDay:8,calculation:{connectedLoadW:100,dailyKwh:.8,monthlyKwh:24},maintenanceStatus:'not-scheduled'}],meters:[],maintenanceHistory:[],specifications:[],recentCandidates:[],powerCapacities:[],disciplines:[],providers:[]});
 }
 if(d[endpoint])return response(d[endpoint]);
 return response({success:false,error:lang()==='en'?'This service requires the server application.':'Layanan ini memerlukan aplikasi server.',code:'viewer_demo_unavailable'},503);
}
window.fetch=async function(input,options){
 const url=new URL(input instanceof Request?input.url:String(input),location.href);
 if(!isApi(url))return nativeFetch(input,options);
 await ready;const method=String(options?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(!viewer)return nativeFetch(input,options);
 let body;try{body=JSON.parse(options?.body||(input instanceof Request&&method!=='GET'?await input.clone().text():'{}'));}catch(_){}
 if(!staticHost&&url.pathname.endsWith('/user-administration.php')&&method==='POST'&&['login','logout'].includes(body?.action))return nativeFetch(input,options);
 return demo(url,method,body);
};
// Drafts and map preferences in a Viewer session are volatile and cannot be queued for a later login.
const memory=new Map();for(const name of ['getItem','setItem','removeItem']){const original=Storage.prototype[name];Storage.prototype[name]=function(key,value){if(!viewer)return original.apply(this,arguments);const k=(this===localStorage?'local:':'session:')+key;if(name==='getItem')return memory.get(k)??null;if(name==='setItem')memory.set(k,String(value));else memory.delete(k);};}
const sendBeacon=navigator.sendBeacon?.bind(navigator);if(sendBeacon)navigator.sendBeacon=(url,data)=>viewer&&isApi(new URL(url,location.href))?false:sendBeacon(url,data);
window.MpmViewer={ready,isViewer:()=>viewer,isStatic:()=>staticHost,fixtures,notice};
})();
