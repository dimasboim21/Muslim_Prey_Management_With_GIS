(function () {
    'use strict';
    // Native dialogs replace the obsolete always-visible wrappers.
    // No legacy layout or delayed DOM reconstruction is retained.
    const launcher=document.querySelector('.astro-panel-launcher'), topbar=document.querySelector('.topbar');
    const panels={map:document.getElementById('astroMapToolsPanel'),info:document.getElementById('astroInformationPanel')};
    if(!launcher||!topbar||!panels.map||!panels.info)return;
    let selected='';
    function select(name,restoreFocus){
        Object.entries(panels).forEach(([key,panel])=>{if(key===name){if(!panel.open)panel.show();}else if(panel.open)panel.close();});
        selected=name;
        launcher.querySelectorAll('button').forEach(button=>button.setAttribute('aria-expanded',String(button.dataset.openPanel===name)));
        if(restoreFocus)launcher.querySelector('[data-open-panel="'+restoreFocus+'"]').focus();
    }
    Object.entries(panels).forEach(([name,panel])=>{
        panel.querySelector('[data-close-astro-drawer]').addEventListener('click',()=>select('',name));
        panel.addEventListener('cancel',event=>{event.preventDefault();select('',name);});
    });
    launcher.addEventListener('click',event=>{const button=event.target.closest('[data-open-panel]');if(button)select(selected===button.dataset.openPanel?'':button.dataset.openPanel);});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&selected)select('',selected);});
    window.addEventListener('mpm:astro-feature-focused',()=>select(''));
    function layout(){const top=Math.ceil(topbar.getBoundingClientRect().bottom)+10;document.body.style.setProperty('--astro-launcher-top',top+'px');document.body.style.setProperty('--astro-drawer-top',(top+launcher.offsetHeight+10)+'px');}
    layout();new ResizeObserver(layout).observe(topbar);window.addEventListener('resize',layout);
})();
