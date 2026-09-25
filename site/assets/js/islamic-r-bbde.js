(function () {
  'use strict';
  const routeKeys = ['book', 'entry', 'topic', 'madhhab', 'end', 'volume', 'section', 'q', 'category', 'author', 'review-batch', 'panel', 'tab', 'card', 'chapter', 'page', 'surah', 'ayah', 'work', 'reading-language', 'hadith', 'presentation', 'slide', 'mode', 'status', 'page-size'];
  let applying = false, pendingRecord = '', pendingPresentation = '', pendingCard = '', observerTimer;
  const en = () => document.documentElement.lang === 'en';
  const activePanel = () => document.querySelector('.it-panel.active')?.dataset.panel || 'quran';
  const find = (attribute, value) => Array.from(document.querySelectorAll('[' + attribute + ']')).find(node => node.getAttribute(attribute) === value);
  function urlFor(values) {
    const url = new URL(location.href);
    routeKeys.forEach(key => url.searchParams.delete(key));
    Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value); });
    url.hash = '';
    return url;
  }
  function write(values, replace) {
    if (applying) return;
    pendingRecord = '';
    pendingPresentation = values.presentation ? [values.presentation,values.slide,values.mode].join('|') : '';
    const url = urlFor(values);
    if (url.href !== location.href) history[replace ? 'replaceState' : 'pushState'](history.state, '', url.href);
    refreshLinks();
  }
  function panelRoute(panel) {
    const route = {panel};
    if (panel === 'asbab' || panel === 'fiqh') Object.assign(route,window.MpmClassical?.snapshot(panel));
    if (panel === 'worship') Object.assign(route, window.MpmWorshipReader?.snapshot());
    if (panel === 'learning') route.tab = document.querySelector('[data-learning-primary].active')?.dataset.learningPrimary || 'material';
    if (panel === 'book-import') route['review-batch']=window.ReviewedDocumentImporter?.getState().batch?.id;
    return route;
  }
  function refreshLinks() {
    if (pendingCard) {
      const card = find('data-route-card', pendingCard);
      if (card?.closest('[data-panel]')?.dataset.panel === activePanel()) { highlight(card); pendingCard = ''; }
    }
  }

  function notice(message) {
    let node = document.getElementById('readerRouteStatus');
    if (!node) { node = document.createElement('p'); node.id = 'readerRouteStatus'; node.className = 'it-route-status'; node.setAttribute('role','status'); document.querySelector('.it-tabs').after(node); }
    node.textContent = message; node.hidden = !message;
  }
  function highlight(card, scroll = true) {
    document.querySelectorAll('.it-route-target').forEach(node => node.classList.remove('it-route-target'));
    if (!card) return;
    for (let parent = card; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    card.classList.add('it-route-target'); if (scroll) card.scrollIntoView({block:'start'});
  }
  async function applyRoute(options = {}) {
    if (applying) return;
    const query = new URLSearchParams(location.search);
    let panel = query.get('panel') || 'quran';
    if (panel === 'automation' && query.get('tab') === 'import-review') panel = 'book-import';
    let button = find('data-tab', panel);
    if (!button || button.hidden || button.disabled) { panel = 'quran'; button = find('data-tab', panel); }
    applying = true;
    try {
      notice('');
      button.click();
      if (panel === 'asbab' || panel === 'fiqh') await window.MpmClassical?.restore(panel,query);
      if (panel === 'worship') window.MpmWorshipReader?.select(query.get('chapter'), query.get('page'));
      if (panel === 'learning' || panel === 'automation') {
        const sub = find(panel === 'learning' ? 'data-learning-primary' : 'data-auto-view', query.get('tab'));
        if (sub && !sub.disabled && !sub.hidden) sub.click();
      }
      if(panel==='book-import'&&/^\d+$/.test(query.get('review-batch')||'')) await window.ReviewedDocumentImporter?.openBatch(Number(query.get('review-batch')));
      if(panel==='book-import')window.ReviewedDocumentImporter?.restoreSection(query.get('section'),query.get('mode'));
      pendingCard = query.get('card') || '';
      const card = find('data-route-card', pendingCard);
      if (card?.closest('[data-panel]')?.dataset.panel === panel) { highlight(card, !options.preserveScroll); pendingCard = ''; }
      else highlight(null);
      const signature = [panel, query.get('surah'), query.get('ayah'), query.get('work'), query.get('hadith'), query.get('reading-language')].join('|');
      if (window.IslamicTextReaderReady?.() && signature !== pendingRecord) {
        if (['quran','tafsir'].includes(panel) && /^\d+$/.test(query.get('surah') || '') && /^\d+$/.test(query.get('ayah') || '')) {
          pendingRecord = signature;
          await window.IslamicTextResumeReading({type:panel, surah:Number(query.get('surah')), ayah:Number(query.get('ayah')), workId:query.get('work'), language:query.get('reading-language') || 'id'});
        } else if (panel === 'hadith' && /^\d+$/.test(query.get('hadith') || '')) {
          pendingRecord = signature; await window.MpmOpenHadithRoute(query.get('hadith'));
        } else pendingRecord = '';
      }
      const presentationSignature = [query.get('presentation'),query.get('slide'),query.get('mode')].join('|');
      if (panel === 'presentasi' && query.get('presentation') && window.MpmPresentationRoute) {
        if (pendingPresentation !== presentationSignature) {
          await window.MpmPresentationRoute.open(query.get('presentation'), query.get('slide'), query.get('mode'));
          pendingPresentation = presentationSignature;
        }
      } else {
        pendingPresentation = '';
        if (panel === 'presentasi') window.MpmPresentationRoute?.close();
      }
    } catch (error) { pendingRecord = ''; notice(error.message); }
    finally { applying = false; refreshLinks(); }
    if (panel !== query.get('panel')) write(panelRoute(panel), true);
    else if (panel === 'worship') write({...panelRoute(panel), card:query.get('card')}, true);
    else if (panel === 'learning' || panel === 'automation') {
      const route = panelRoute(panel);
      if (route.tab !== query.get('tab')) write(route, true);
    }
  }
  window.MpmReaderNavigation = {update:write, refresh:refreshLinks};
  document.addEventListener('DOMContentLoaded', async () => {
    document.addEventListener('click', event => {
      const link = event.target.closest('[data-reader-link]');
      if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
        event.preventDefault(); if (link.href !== location.href) history.pushState(history.state, '', link.href); applyRoute(); return;
      }
      const button = event.target.closest('[data-tab],[data-learning-primary],[data-auto-view]');
      if (button && !button.disabled && !button.hidden) write(panelRoute(activePanel()));
    });
    window.addEventListener('mpm:worship-selection', () => {
      if (activePanel() !== 'worship') return;
      const route = panelRoute('worship'), query = new URLSearchParams(location.search);
      const unchanged = query.get('chapter') === route.chapter && Number(query.get('page')) === route.page;
      if (unchanged) route.card = query.get('card');
      write(route, unchanged);
    });
    window.addEventListener('popstate', applyRoute);
    window.addEventListener('mpm:language-changed', refreshLinks);
    window.addEventListener('islamic-reader-ready', () => { if (window.IslamicTextReaderReady?.()) applyRoute({preserveScroll:true}); });
    new MutationObserver(() => { clearTimeout(observerTimer); observerTimer = setTimeout(refreshLinks, 100); }).observe(document.querySelector('main') || document.body, {childList:true, subtree:true});
    refreshLinks();
    const protectedRoute = ['profile-user','learning'].includes(new URLSearchParams(location.search).get('panel'));
    if (!protectedRoute) await applyRoute();
    if (window.MpmUserSessionReady) await window.MpmUserSessionReady;
    await applyRoute();
  });
})();
