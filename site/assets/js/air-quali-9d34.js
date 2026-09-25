(function () {
    'use strict';
    const BANDS = [
        [50, 'Baik', '#55a84f'], [100, 'Sedang', '#e8c547'],
        [150, 'Tidak sehat bagi kelompok sensitif', '#ed983c'], [200, 'Tidak sehat', '#df5358'],
        [300, 'Sangat tidak sehat', '#995aa5'], [Infinity, 'Berbahaya', '#812c4d']
    ];
    const FIELDS = { us_aqi: 'US AQI', pm2_5: 'PM2.5', pm10: 'PM10', nitrogen_dioxide: 'NO₂', ozone: 'O₃', sulphur_dioxide: 'SO₂', carbon_monoxide: 'CO' };
    const numeric = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
    const band = (value) => value === null ? [null, 'Data belum tersedia', '#64748b'] : BANDS.find((item) => value <= item[0]);
    const escape = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const timeText = (value) => Number.isFinite(value) ? new Date(value).toLocaleString('id-ID') : 'Tidak tersedia';
    function create({ ol, state, byId, scope, isLocal, presentFeature, hidePopup }) {
        const source = new ol.source.Vector();
        const circles = new ol.source.Vector();
        let enabled = false, loading = false, requestId = 0, abort = null, records = [], selected = null;
        let fetchedAt = 0, stale = false, error = '', radiusKm = 5, query = '', category = 'all';
        let panel = null, mounted = false, fitPending = false, lastScopeKey = '';
        const circleLayer = new ol.layer.Vector({ source: circles, zIndex: 30, style: (feature) => {
            const color = band(feature.get('airRecord').values.us_aqi)[2];
            return new ol.style.Style({ stroke: new ol.style.Stroke({ color, width: 2, lineDash: [6, 4] }), fill: new ol.style.Fill({ color: color + '22' }) });
        } });
        const pointLayer = new ol.layer.Vector({ source, zIndex: 66, style: (feature) => {
            const value = feature.get('airRecord').values.us_aqi;
            return new ol.style.Style({ image: new ol.style.Circle({ radius: 18, fill: new ol.style.Fill({ color: band(value)[2] }), stroke: new ol.style.Stroke({ color: '#fff', width: 2 }) }),
                text: new ol.style.Text({ text: value === null ? '–' : String(Math.round(value)), font: 'bold 11px Segoe UI', fill: new ol.style.Fill({ color: value !== null && value <= 150 ? '#172033' : '#fff' }) }) });
        } });
        pointLayer.set('adm0CenterFiltered', true);
        function mount() {
            if (mounted) return;
            mounted = true;
            panel = document.createElement('section'); panel.id = 'airQualityControls'; panel.className = 'air-quality-controls hidden';
            panel.innerHTML = '<header><strong>Kualitas udara · US AQI</strong><button type="button" data-air-action="close">Tutup</button></header>'
                + '<p class="air-source-note">Open-Meteo / CAMS · estimasi model, bukan sensor.</p>'
                + '<p id="airQualityStatus" role="status"></p><div class="air-actions"><button type="button" data-air-action="refresh">Perbarui</button><button type="button" data-air-action="fit">Lihat cakupan</button></div>'
                + '<details><summary>Filter, legenda dan poly-circle</summary><label>Cari titik <input id="airQualitySearch" type="search" placeholder="Nama atau koordinat"></label>'
                + '<label>Kategori <select id="airQualityCategory"><option value="all">Semua kategori</option>' + BANDS.map((item, i) => '<option value="' + i + '">' + item[1] + '</option>').join('') + '<option value="unknown">Belum tersedia</option></select></label>'
                + '<label>Poly-circle pilihan <select id="airQualityRadius"><option value="0">Sembunyikan</option><option value="1">1 km</option><option value="5" selected>5 km</option><option value="10">10 km</option><option value="25">25 km</option></select></label>'
                + '<small>Radius ilustratif, bukan batas polusi atau jangkauan sensor.</small><details><summary>Legenda AQI</summary><div class="air-legend">'
                + BANDS.map((item, i) => '<span><i style="background:' + item[2] + '"></i>' + (i ? BANDS[i - 1][0] + 1 : 0) + '–' + (Number.isFinite(item[0]) ? item[0] : '500+') + ' · ' + item[1] + '</span>').join('')
                + '</div></details></details><div id="airQualityList" class="air-quality-list"></div>';
            byId('onlineMapControls').appendChild(panel);
            panel.addEventListener('click', (event) => {
                const action = event.target.closest('[data-air-action]');
                if (action) {
                    if (action.dataset.airAction === 'refresh') refresh(true);
                    if (action.dataset.airAction === 'fit') fit();
                    if (action.dataset.airAction === 'close') { const toggle = byId('onlineMapToggle'); toggle.checked = false; toggle.dispatchEvent(new Event('change', { bubbles: true })); }
                }
                const button = event.target.closest('[data-air-id]');
                if (button) { const feature = source.getFeatureById(button.dataset.airId); if (feature) { state.map.getView().setCenter(feature.getGeometry().getCoordinates()); state.map.getView().setZoom(9); focus(feature); } }
            });
            byId('airQualitySearch').addEventListener('input', (event) => { query = event.target.value.toLowerCase(); render(); });
            byId('airQualityCategory').addEventListener('change', (event) => { category = event.target.value; render(); });
            byId('airQualityRadius').addEventListener('change', (event) => { radiusKm = Number(event.target.value); if (selected) focus(selected); });
        }
        function points() {
            const extent = isLocal() ? scope.bounds() : [-180, -85, 180, 85];
            if (!extent) return [];
            const output = [], ids = new Set();
            function add(lon, lat, name) {
                if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 85) return;
                const id = lon.toFixed(4) + ',' + lat.toFixed(4);
                if (ids.has(id) || (isLocal() && !scope.contains(ol.proj.fromLonLat([lon, lat])))) return;
                ids.add(id); output.push({ id, lon, lat, name: name || 'Titik model ' + lat.toFixed(2) + ', ' + lon.toFixed(2) });
            }
            if (isLocal()) {
                add(Number(state.observer.lon), Number(state.observer.lat), 'Lokasi pengamatan');
                scope.samplePoints(24).forEach((coordinate) => add(coordinate[0], coordinate[1]));
            }
            const columns = isLocal() ? 24 : 12, rows = isLocal() ? 16 : 6;
            for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) add(extent[0] + (x + 0.5) / columns * (extent[2] - extent[0]), extent[1] + (y + 0.5) / rows * (extent[3] - extent[1]));
            if (output.length <= 72) return output;
            const seeds = output.slice(0, 25), grid = output.slice(25);
            return seeds.concat(Array.from({ length: 47 }, (_, i) => grid[Math.floor(i * grid.length / 47)]));
        }
        function parse(payload, samples) {
            const rows = Array.isArray(payload) ? payload : [payload];
            if (rows.length !== samples.length) throw new Error('Jumlah data kualitas udara tidak sesuai permintaan.');
            return rows.map((row, i) => {
                if (!row || !row.current || !Number.isFinite(row.current.time) || row.current.time <= 0) throw new Error('Format waktu kualitas udara tidak valid.');
                const values = Object.fromEntries(Object.keys(FIELDS).map((key) => [key, numeric(row.current[key])]));
                return { ...samples[i], values, units: row.current_units || {}, time: row.current.time * 1000 };
            });
        }
        function status() {
            if (!panel) return;
            byId('airQualityStatus').textContent = (isLocal() ? 'Lokal ADM0 · ' + scope.getState().name : 'Global · sampel model seluruh dunia')
                + ' · ' + source.getFeatures().length + '/' + records.length + ' titik' + (loading ? ' · Memuat…' : '')
                + (stale ? ' · Data tersimpan; belum diperbarui' : '') + (error ? ' · ' + error : '');
            panel.querySelector('[data-air-action="refresh"]').disabled = loading;
        }
        function render() {
            if (selected) hidePopup();
            selected = null; circles.clear(); source.clear();
            const visible = records.filter((record) => (!isLocal() || scope.contains(ol.proj.fromLonLat([record.lon, record.lat])))
                && (!query || (record.name + ' ' + record.id).toLowerCase().includes(query))
                && (category === 'all' || (category === 'unknown' ? record.values.us_aqi === null : BANDS.indexOf(band(record.values.us_aqi)) === Number(category))));
            visible.forEach((record) => { const feature = new ol.Feature({ geometry: new ol.geom.Point(ol.proj.fromLonLat([record.lon, record.lat])), kind: 'online-air-quality', airRecord: record, label: record.name, popupKey: 'aq:' + record.id }); feature.setId(record.id); source.addFeature(feature); });
            if (panel) byId('airQualityList').innerHTML = visible.map((record) => '<button type="button" data-air-id="' + record.id + '"><b style="background:' + band(record.values.us_aqi)[2] + '">' + (record.values.us_aqi === null ? '–' : Math.round(record.values.us_aqi)) + '</b><span>' + escape(record.name) + '<small>' + escape(band(record.values.us_aqi)[1]) + '</small></span></button>').join('') || '<p>Tidak ada titik yang tersedia pada pilihan ini.</p>';
            status();
        }
        function popupHtml(feature) {
            const record = feature.get('airRecord'); if (!record) return '';
            return '<button type="button" class="astro-popup-close" data-popup-close aria-label="Tutup">×</button><h4>' + escape(record.name) + '</h4>'
                + '<p><strong>US AQI ' + (record.values.us_aqi === null ? '—' : Math.round(record.values.us_aqi)) + ' · ' + escape(band(record.values.us_aqi)[1]) + '</strong></p>'
                + '<p>Estimasi model CAMS melalui Open-Meteo. Bukan pembacaan stasiun sensor atau data IQAir.</p><dl>'
                + Object.entries(FIELDS).map(([key, label]) => '<dt>' + label + '</dt><dd>' + (record.values[key] === null ? 'Tidak tersedia' : escape(record.values[key]) + ' ' + escape(key === 'us_aqi' ? '' : record.units[key] || '')) + '</dd>').join('')
                + '<dt>Waktu data</dt><dd>' + escape(timeText(record.time)) + '</dd><dt>Diambil</dt><dd>' + escape(timeText(fetchedAt)) + (stale ? ' · cache' : '') + '</dd>'
                + '<dt>Koordinat sampel</dt><dd>' + record.lat.toFixed(5) + ', ' + record.lon.toFixed(5) + '</dd></dl><p>Poly-circle ' + radiusKm + ' km hanya ilustrasi area pilihan, bukan batas konsentrasi polusi atau jangkauan sensor.</p>'
                + '<a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noopener noreferrer">Sumber Open-Meteo / CAMS</a>';
        }
        function focus(feature) {
            if (!enabled || !feature || !source.hasFeature(feature)) return;
            const view = state.map.getView();
            if (view.getZoom() < 10) { view.cancelAnimations(); view.setCenter(feature.getGeometry().getCoordinates()); view.setZoom(10); }
            selected = feature; circles.clear();
            if (radiusKm > 0) {
                const record = feature.get('airRecord');
                const ring = Array.from({ length: 64 }, (_, i) => {
                    const p = ol.sphere.offset([record.lon, record.lat], radiusKm * 1000, i * 2 * Math.PI / 64);
                    while (p[0] - record.lon > 180) p[0] -= 360;
                    while (p[0] - record.lon < -180) p[0] += 360;
                    return p;
                });
                ring.push(ring[0].slice());
                const polygon = new ol.geom.Polygon([ring]).transform('EPSG:4326', 'EPSG:3857');
                circles.addFeature(new ol.Feature({ geometry: polygon, kind: 'air-quality-circle', airParent: feature, airRecord: record }));
            }
            presentFeature(feature, { html: popupHtml(feature), source: 'air-quality-click' });
        }
        function layoutPopup() {
            const popup = byId('astroMapInfoPopup');
            const open = enabled && selected && popup && !popup.classList.contains('hidden');
            if (popup && popup.parentElement) popup.parentElement.classList.toggle('air-popup-dock', Boolean(open));
            const topbar = document.querySelector('.topbar');
            if (popup) popup.style.setProperty('--air-popup-top', Math.max(100, topbar ? topbar.getBoundingClientRect().bottom + 12 : 100) + 'px');
            if (popup && popup.parentElement) popup.parentElement.style.setProperty('--air-popup-top', Math.max(100, topbar ? topbar.getBoundingClientRect().bottom + 12 : 100) + 'px');
        }
        function fit() { if (source.getFeatures().length) state.map.getView().fit(source.getExtent(), { padding: state.map.getSize()[0] < 700 ? [100, 30, 290, 30] : [120, 60, 60, 380], maxZoom: 9, duration: 250 }); }
        async function refresh(force) {
            if (!enabled) return;
            const token = ++requestId;
            if (abort) abort.abort(); abort = new AbortController(); const controller = abort;
            const samples = points(), key = 'mpm:air-quality:model:v1:' + (isLocal() ? scope.getState().key : 'world');
            if (lastScopeKey !== key) { fitPending = true; lastScopeKey = key; }
            records = []; fetchedAt = 0; stale = false; error = ''; loading = true; hidePopup(); render();
            if (!samples.length) { loading = false; error = 'Batas ADM0 atau titik sampel belum tersedia.'; status(); return; }
            const signature = samples.map((point) => point.id).join('|');
            const timer = setTimeout(() => controller.abort(), 30000);
            try {
                const cache = JSON.parse(localStorage.getItem(key) || 'null');
                if (cache && cache.signature === signature && Number.isFinite(cache.fetchedAt) && cache.fetchedAt <= Date.now() && Date.now() - cache.fetchedAt < 6 * 3600000) {
                    records = parse(cache.payload, samples); fetchedAt = cache.fetchedAt;
                    stale = Date.now() - fetchedAt > 3600000 || records.some((record) => Date.now() - record.time > 6 * 3600000); render();
                    if (!stale && !force) { clearTimeout(timer); loading = false; status(); if (fitPending) { fitPending = false; fit(); } return; }
                }
            } catch (_) { /* Unusable local cache cannot establish air quality. */ }
            try {
                const params = new URLSearchParams({ latitude: samples.map((point) => point.lat.toFixed(4)).join(','), longitude: samples.map((point) => point.lon.toFixed(4)).join(','), current: Object.keys(FIELDS).join(','), timeformat: 'unixtime', timezone: 'GMT', domains: 'cams_global' });
                const response = await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?' + params, { signal: controller.signal });
                if (!response.ok) throw new Error('Sumber kualitas udara HTTP ' + response.status);
                const payload = await response.json(), parsed = parse(payload, samples);
                if (!enabled || token !== requestId) return;
                records = parsed; fetchedAt = Date.now(); stale = records.some((record) => fetchedAt - record.time > 6 * 3600000);
                if (stale) error = 'Waktu data sumber lebih dari enam jam yang lalu.';
                try { localStorage.setItem(key, JSON.stringify({ signature, fetchedAt, payload })); } catch (_) {}
            } catch (failure) {
                if (!enabled || token !== requestId) return;
                stale = records.length > 0; error = failure.name === 'AbortError' ? 'Waktu tunggu sumber habis.' : failure.message;
            } finally {
                clearTimeout(timer);
                if (enabled && token === requestId) { loading = false; render(); if (fitPending && records.length) { fitPending = false; fit(); } }
            }
        }
        function setEnabled(value, overlay) {
            mount(); const wasEnabled = enabled; enabled = Boolean(value); panel.classList.toggle('hidden', !enabled); document.body.classList.toggle('air-quality-active', enabled);
            if (!enabled) { ++requestId; if (abort) abort.abort(); loading = false; if (selected) hidePopup(); circles.clear(); selected = null; layoutPopup(); return; }
            if (overlay) { const layers = overlay.getLayers(); [circleLayer, pointLayer].forEach((layer) => { if (!layers.getArray().includes(layer)) layers.push(layer); }); }
            if (!wasEnabled) fitPending = true;
            refresh();
        }
        window.addEventListener('mpm:astro-feature-focused', (event) => { if (!event.detail || !['online-air-quality', 'air-quality-circle'].includes(event.detail.kind)) { selected = null; circles.clear(); } layoutPopup(); });
        window.addEventListener('mpm:astro-popup-active-changed', (event) => { if (!event.detail.featureKey) { selected = null; circles.clear(); layoutPopup(); } });
        let resizeTimer;
        window.addEventListener('resize', () => {
            layoutPopup(); clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => { if (enabled && !selected) fit(); }, 150);
        });
        return { setEnabled, refresh, focus, popupHtml, layoutPopup, getSource: () => source, getCircleSource: () => circles,
            getState: () => ({ enabled, loading, total: records.length, visible: source.getFeatures().length, fetchedAt, stale, error, local: isLocal(), radiusKm }) };
    }
    window.MpmAirQualityMap = { create, band, numeric };
}());
