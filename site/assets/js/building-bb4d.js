(function (window,document) {
  'use strict';
  var selection={page:1,adm0:'',adm1:'',adm2:''}, version=0, latest=null;
  function t(key) {return window.PrayerI18n.t('selector.'+key);}
  function node(tag,text) {var element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;}
  async function load() {
    var ticket=++version, host=document.getElementById('buildingSelection');
    if (!host || window.MpmBuildingLinks.requested()) return;
    var status=document.getElementById('buildingSelectionStatus');status.textContent=t('loading');
    try {
      var response=await fetch('api/mosque-admin.php?'+new URLSearchParams(Object.assign({view:'selector'},selection)),{cache:'no-store',credentials:'same-origin'});
      var body=await response.json();if(!response.ok||!body.success)throw new Error('unavailable');
      if(ticket!==version||window.MpmBuildingLinks.requested())return;
      latest=body.data;render();
    } catch(error) {if(ticket===version) status.textContent=t('unavailable');}
  }
  function render() {
    var host=document.getElementById('buildingSelection');if(!host)return;
    document.getElementById('buildingSelectionQuestion').textContent=t('question');
    ['adm0','adm1','adm2'].forEach(function(key) {
      var select=document.getElementById('buildingFilter'+key),label=select.previousElementSibling;
      label.textContent=t(key);select.replaceChildren();
      var empty=node('option',t('choose'+key));empty.value='';select.appendChild(empty);
      ((latest&&latest.filters[key])||[]).forEach(function(name) {var option=node('option',name);option.value=name;select.appendChild(option);});
      select.value=selection[key];select.disabled=key==='adm1'?!selection.adm0:key==='adm2'?!selection.adm1:false;
    });
    var list=document.getElementById('buildingSelectionList');list.replaceChildren();
    if(latest)latest.items.forEach(function(record) {
      var button=node('button');button.type='button';button.className='building-choice';button.setAttribute('translate','no');
      button.append(node('strong',record.mosque_name),node('code',record.building_identifier));
      button.addEventListener('click',function() {
        var url=new URL(window.location.href);url.searchParams.set('building',record.building_identifier);url.searchParams.set('lang',window.PrayerI18n.getCurrentLanguage());
        window.history.pushState(window.history.state,'',url.href);host.hidden=true;
        window.dispatchEvent(new CustomEvent('mpm:building-selected',{detail:{identifier:record.building_identifier}}));
      });list.appendChild(button);
    });
    document.getElementById('buildingSelectionStatus').textContent=latest&&!latest.items.length?t('empty'):'';
    var previous=document.getElementById('buildingPagePrevious'),next=document.getElementById('buildingPageNext');
    previous.textContent=t('previous');next.textContent=t('next');
    previous.disabled=!latest||latest.page<=1;next.disabled=!latest||latest.page>=latest.totalPages;
    document.getElementById('buildingPageLabel').textContent=t('page').replace('{page}',latest?latest.page:1).replace('{pages}',latest?latest.totalPages:1);
  }
  function show() {
    var host=document.getElementById('buildingSelection');if(!host)return;
    host.hidden=!!window.MpmBuildingLinks.requested();
    if(!host.hidden){render();load();}
  }
  document.addEventListener('DOMContentLoaded',function() {
    ['adm0','adm1','adm2'].forEach(function(key) {
      document.getElementById('buildingFilter'+key).addEventListener('change',function(event) {
        selection[key]=event.target.value;selection.page=1;
        if(key==='adm0'){selection.adm1='';selection.adm2='';}
        if(key==='adm1')selection.adm2='';load();
      });
    });
    document.getElementById('buildingPagePrevious').addEventListener('click',function(){selection.page=Math.max(1,(latest?latest.page:1)-1);load();});
    document.getElementById('buildingPageNext').addEventListener('click',function(){selection.page=(latest?latest.page:1)+1;load();});
    show();
  });
  window.addEventListener('mpm:language-changed',render);
  window.addEventListener('popstate',show);
  window.MpmBuildingSelector={show:show,reload:load};
})(window,document);
