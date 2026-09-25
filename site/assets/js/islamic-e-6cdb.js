(function (window) {
  "use strict";

  var API_URL = "api/islamic-text.php";
  var DB_NAME = "mpm-islamic-text-offline-v3";
  var STORE_NAME = "responses";
  if (window.indexedDB) {
    try { window.indexedDB.deleteDatabase("mpm-islamic-text-offline-v1"); } catch (error) {}
  }
  var state = { transport: "uninitialized" };

  function cacheKey(resource, params) {
    var query = new URLSearchParams(params || {}); query.sort();
    return "evidence/" + resource + "?" + query.toString();
  }
  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("IndexedDB tidak tersedia.")); return; }
      var request = window.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "key" }); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }
  function put(key, data) {
    return openDb().then(function (db) { return new Promise(function (resolve, reject) { var tx=db.transaction(STORE_NAME,"readwrite");tx.objectStore(STORE_NAME).put({key:key,savedAt:new Date().toISOString(),data:data});tx.oncomplete=function(){db.close();resolve();};tx.onerror=function(){db.close();reject(tx.error);}; }); }).catch(function () {});
  }
  function getCached(key) {
    return openDb().then(function (db) { return new Promise(function (resolve, reject) { var tx=db.transaction(STORE_NAME,"readonly"),request=tx.objectStore(STORE_NAME).get(key);request.onsuccess=function(){db.close();resolve(request.result||null);};request.onerror=function(){db.close();reject(request.error);}; }); }).catch(function () { return null; });
  }
  async function request(resource, params) {
    var input=Object.assign({},params||{}),key=cacheKey(resource,input),query=Object.assign({resource:resource},input);
    try {
      var response=await window.fetch(API_URL+"?"+new URLSearchParams(query).toString(),{headers:{Accept:"application/json"},cache:"no-store"});
      var payload=await response.json();
      if(!response.ok||!payload||payload.success!==true)throw new Error(payload&&payload.error||"Database sumber tidak dapat dibaca.");
      state.transport="local-database";put(key,payload.data);return Object.assign({_transport:"local-database"},payload.data);
    } catch (error) {
      var cached=await getCached(key);
      if(cached){state.transport="local-cache";return Object.assign({_transport:"local-cache",_cachedAt:cached.savedAt},cached.data);}
      state.transport="missing";throw error;
    }
  }
  function catalog(){return request("evidence_catalog",{});}
  function search(params){return request("evidence_search",params||{});}
  function resolve(params){return request("evidence_resolve",params||{});}
  function resolveSearchResult(result, overrides) {
    var type=result&&result.sourceType,citation=result&&result.citation||{},params=Object.assign({source_type:type},overrides||{});
    if(type==="quran"){params.surah=citation.surah;params.selection=citation.ayah;}
    else if(type==="hadith"){params.hadith_id=result.internalId||citation.internal_id;}
    else if(type==="tafsir"){params.entry_ids=result.canonicalId||citation.tafsir_id;}
    return resolve(params);
  }
  window.IslamicEvidenceReferenceAdapter={catalog:catalog,search:search,resolve:resolve,resolveSearchResult:resolveSearchResult,transport:function(){return state.transport;},cacheDatabase:DB_NAME,cacheStore:STORE_NAME};
})(window);
