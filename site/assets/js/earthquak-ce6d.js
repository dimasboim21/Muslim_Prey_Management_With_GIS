(function () {
    'use strict';

    // These are display classes, not local shaking intensity or USGS ShakeMap colors.
    const LEVELS = [
        { max: 4, key: 'very-small', label: 'SANGAT KECIL', color: '#8bd68b', range: '< 4.0' },
        { max: 5, key: 'light', label: 'RINGAN', color: '#f4d35e', range: '4.0–4.9' },
        { max: 6, key: 'moderate', label: 'SEDANG', color: '#f28c28', range: '5.0–5.9' },
        { max: 7, key: 'strong', label: 'KUAT', color: '#d9362b', range: '6.0–6.9' },
        { max: 8, key: 'large', label: 'BESAR', color: '#8f1d25', range: '7.0–7.9' },
        { max: 9, key: 'very-large', label: 'SANGAT BESAR', color: '#691536', range: '8.0–8.9' },
        { max: 10, key: 'extreme', label: 'EKSTREM', color: '#48152b', range: '9.0–9.9' },
        { max: Infinity, key: 'giant', label: 'RAKSASA', color: '#260d17', range: '≥ 10.0' }
    ];
    const BANDS = 40;
    const SEGMENTS = 128;
    const CYCLE_MS = 3000;
    const MAX_LATITUDE = 85.0511287798;
    const state = { map: null, source: null, layer: null, feature: null, estimate: null,
        selectedKey: '', playing: false, progress: 1, frame: null, startedAt: 0, lastDraw: 0, listeners: [], bands: [], focused: false };
    const localized = (id, en) => (document.documentElement.lang || 'id').toLowerCase().startsWith('en') ? en : id;
    const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function number(value) {
        if (value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '') return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function magnitudeClass(value) {
        const magnitude = number(value);
        return magnitude === null
            ? { key: 'unknown', label: localized('TIDAK TERSEDIA', 'UNAVAILABLE'), color: '#88929c' }
            : Object.assign({}, LEVELS.find((level) => magnitude < level.max));
    }

    function describe(event) {
        const magnitude = number(event && event.magnitude);
        const depthKm = number(event && event.depthKm);
        // Deliberately an illustrative display scale; no invented PGA/MMI or felt observations.
        // USGS explains why magnitude alone cannot predict the actual felt area:
        // https://www.usgs.gov/observatories/hvo/science/felt-earthquakes-ones-people-feel
        const radiusKm = magnitude === null ? null : Math.max(5, Math.min(2500, Math.pow(10, 0.5 * magnitude - 0.5)));
        return { magnitude, depthKm, radiusKm, magnitudeClass: magnitudeClass(magnitude), model: 'illustrative-magnitude-radius-v1' };
    }

    function eventFromFeature(feature) {
        if (!feature || !feature.get || !['earthquake', 'online-earthquake'].includes(feature.get('kind'))) return null;
        const geometry = feature.getGeometry();
        if (!geometry || geometry.getType() !== 'Point') return null;
        const coordinate = geometry.getCoordinates();
        if (!coordinate.slice(0, 2).every(Number.isFinite)) return null;
        const lonLat = ol.proj.toLonLat(coordinate);
        const record = feature.get('record') || {};
        return {
            magnitude: feature.get('kind') === 'online-earthquake' ? feature.get('mag') : record.magnitude,
            depthKm: feature.get('kind') === 'online-earthquake' ? coordinate[2] : record.depthKm,
            longitude: ((lonLat[0] + 180) % 360 + 360) % 360 - 180,
            latitude: lonLat[1]
        };
    }

    function featureKey(feature) {
        return `${feature.get('kind')}:${feature.get('popupKey') || feature.get('recordId') || feature.getId() || ol.getUid(feature)}`;
    }

    function legendHtml() {
        return `<div class="earthquake-magnitude-legend"><strong>${localized('Magnitudo gempa · klasifikasi warna', 'Earthquake magnitude · color classes')}</strong>${LEVELS.map((level) =>
            `<span><i style="background:${level.color}"></i><b>${escapeHtml(level.range)}</b> ${level.label}</span>`).join('')}</div>`;
    }

    function init(map) {
        if (state.map || !map) return;
        state.map = map;
        state.source = new ol.source.Vector({ wrapX: true });
        state.layer = new ol.layer.Vector({ source: state.source, zIndex: 29, visible: false,
            updateWhileAnimating: true, updateWhileInteracting: true });
        state.layer.set('name', 'earthquakeRadius');
        map.addLayer(state.layer);
        document.addEventListener('click', (event) => {
            const settings = event.target.closest('[data-earthquake-radius-settings]');
            if (settings && state.feature) {
                event.preventDefault();
                clearSelectionPopup();
                return;
            }
            const button = event.target.closest('[data-earthquake-radius-play]');
            if (!button || button.disabled) return;
            event.preventDefault();
            event.stopPropagation();
            if (state.playing) pause(); else play();
        });
        document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
        window.addEventListener('pagehide', clear);
        window.addEventListener('resize', () => { if (state.feature && state.focused) fitRadius(); });
    }

    function setFocused(focused) {
        state.focused = focused;
        document.body.classList.toggle('earthquake-radius-focus', focused);
        layoutPopup();
    }

    function layoutPopup() {
        const popup = document.getElementById('astroMapInfoPopup');
        const parent = popup && popup.parentElement;
        if (parent && parent.classList.contains('ol-overlay-container')) {
            parent.classList.toggle('earthquake-popup-dock', Boolean(state.feature && state.focused));
        }
    }

    function fitRadius() {
        if (!state.map || !state.source || !state.feature) return;
        const mobile = window.innerWidth <= 700;
        state.map.updateSize();
        const size = state.map.getSize();
        const topbar = document.querySelector('.topbar');
        const top = Math.max(40, topbar && getComputedStyle(topbar).display !== 'none' ? topbar.getBoundingClientRect().bottom + 20 : 40);
        const padding = mobile ? [top, 24, Math.min(size[1] * 0.44, 360) + 32, 24] : [top, 380, 40, 40];
        state.map.getView().cancelAnimations();
        const geometry = new ol.geom.Polygon([circleRing(eventFromFeature(state.feature), state.estimate.radiusKm)]);
        state.map.getView().fit(geometry.getExtent(), { padding, maxZoom: 10, duration: 0 });
    }

    // Sample ground distances on the sphere. Unwrap longitudes so a circle crossing
    // the date line remains local; close polar caps along the Mercator display limit.
    function circleRing(event, radiusKm) {
        const ring = [];
        let previousLon = event.longitude;
        for (let index = 0; index <= SEGMENTS; index += 1) {
            // Start toward the nearest pole so cap exteriors and their inner holes
            // occupy the same unwrapped world in both hemispheres.
            const bearing = 2 * Math.PI * index / SEGMENTS + (event.latitude < 0 ? -Math.PI : 0);
            const point = ol.sphere.offset([event.longitude, event.latitude], radiusKm * 1000, bearing);
            while (point[0] - previousLon > 180) point[0] -= 360;
            while (point[0] - previousLon < -180) point[0] += 360;
            previousLon = point[0];
            ring.push([point[0], Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, point[1]))]);
        }
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (Math.abs(last[0] - first[0]) > 180) {
            const pole = event.latitude >= 0 ? MAX_LATITUDE : -MAX_LATITUDE;
            ring.push([last[0], pole], [first[0], pole]);
        }
        ring.push(first.slice());
        return ring.map((point) => ol.proj.fromLonLat(point));
    }

    function bandColor(fraction, alpha) {
        const levelIndex = LEVELS.findIndex((level) => level.key === state.estimate.magnitudeClass.key);
        const position = Math.max(0, levelIndex) * Math.pow(1 - fraction, 0.8);
        const lower = Math.floor(position);
        const upper = Math.min(LEVELS.length - 1, lower + 1);
        const mix = position - lower;
        const rgb = [1, 3, 5].map((offset) => Math.round(
            parseInt(LEVELS[lower].color.slice(offset, offset + 2), 16) * (1 - mix)
            + parseInt(LEVELS[upper].color.slice(offset, offset + 2), 16) * mix));
        return `rgba(${rgb.join(',')},${alpha})`;
    }

    function draw(progress, rebuild) {
        if (!state.feature || !state.estimate || !state.source) return;
        state.progress = progress;
        const event = eventFromFeature(state.feature);
        const radiusKm = state.estimate.radiusKm * progress;
        let innerRing = null;
        for (let index = 0; index < BANDS; index += 1) {
            const fraction = (index + 1) / BANDS;
            const outerRing = circleRing(event, radiusKm * fraction);
            const geometry = new ol.geom.Polygon(innerRing ? [outerRing, innerRing.slice().reverse()] : [outerRing]);
            if (rebuild) {
                const band = new ol.Feature({ geometry, kind: 'earthquake-impact-ring', earthquakeParent: state.feature,
                    parentPopupKey: state.selectedKey, radiusFraction: fraction, fullRadiusKm: state.estimate.radiusKm });
                band.setStyle(new ol.style.Style({
                    fill: new ol.style.Fill({ color: bandColor(index / (BANDS - 1), 0.48 - 0.38 * fraction) }),
                    stroke: index === BANDS - 1 ? new ol.style.Stroke({ color: bandColor(1, 0.65), width: 1.5 }) : undefined
                }));
                state.source.addFeature(band);
                state.bands.push(band);
            } else {
                state.bands[index].setGeometry(geometry);
            }
            innerRing = outerRing;
        }
    }

    function watchParent(feature) {
        function visit(layer, ancestors) {
            if (layer.getSource && layer.getSource() && layer.getSource().hasFeature && layer.getSource().hasFeature(feature)) {
                const source = layer.getSource();
                state.listeners.push(source.on('clear', clearSelectionPopup));
                state.listeners.push(source.on('removefeature', (event) => { if (event.feature === feature) clearSelectionPopup(); }));
                ancestors.concat(layer).forEach((item) => {
                    state.listeners.push(item.on('change:visible', () => { if (!item.getVisible()) clearSelectionPopup(); }));
                    if (item.getLayers) state.listeners.push(item.getLayers().on('remove', clearSelectionPopup));
                });
                return true;
            }
            return layer.getLayers && layer.getLayers().getArray().some((child) => visit(child, ancestors.concat(layer)));
        }
        visit(state.map.getLayerGroup(), []);
    }

    function prepareFeature(feature, source) {
        const event = eventFromFeature(feature);
        const key = event ? featureKey(feature) : '';
        if (key && key === state.selectedKey && feature === state.feature) {
            // A live refresh preserves the feature identity. Reopening its details
            // must use the revised magnitude without restarting playback or fitting the map.
            const estimate = describe(event);
            if (estimate.radiusKm === null) { clear(); return; }
            const rebuild = estimate.magnitudeClass.key !== state.estimate.magnitudeClass.key;
            state.estimate = estimate;
            if (rebuild) { state.source.clear(); state.bands = []; }
            draw(state.progress, rebuild);
            return;
        }
        clear();
        if (!event || source !== 'map-click' || !state.map) return;
        const estimate = describe(event);
        if (estimate.radiusKm === null) return;
        state.feature = feature;
        state.selectedKey = key;
        state.estimate = estimate;
        draw(1, true);
        state.layer.setVisible(true);
        watchParent(feature);
        setFocused(true);
        fitRadius();
    }

    function popupHtml(feature, html) {
        const event = eventFromFeature(feature);
        if (!event) return html;
        const estimate = describe(event);
        const selected = state.feature === feature;
        const radius = estimate.radiusKm === null ? localized('Tidak tersedia', 'Unavailable') : `≈ ${Math.round(estimate.radiusKm).toLocaleString()} km`;
        const panel = `<section class="earthquake-radius-info">
            <strong><i style="background:${estimate.magnitudeClass.color}"></i>${escapeHtml(estimate.magnitudeClass.label)} · ${localized('Radius perkiraan', 'Estimated radius')} ${radius}</strong>
            <p>${localized('Ilustrasi area dirasakan, bukan ShakeMap USGS. Belum memperhitungkan kedalaman dan kondisi tanah.', 'Illustrative felt area, not a USGS ShakeMap. Depth and ground conditions are not yet accounted for.')}</p>
            ${selected ? `<div class="earthquake-radius-actions"><button type="button" class="earthquake-radius-play" data-earthquake-radius-play aria-pressed="${state.playing}">${playLabel()}</button><button type="button" class="earthquake-radius-settings" data-earthquake-radius-settings>${localized('Pengaturan peta', 'Map settings')}</button></div><span class="earthquake-radius-status" data-earthquake-radius-status>${statusLabel()}</span>`
                : `<p>${estimate.radiusKm === null ? localized('Magnitudo tidak tersedia; radius tidak dihitung.', 'Magnitude unavailable; radius is not calculated.') : localized('Klik ikon gempa pada peta untuk menampilkan radius dan animasinya.', 'Click the earthquake icon on the map to show its radius and animation.')}</p>`}
            <details><summary>${localized('Klasifikasi & dasar radius', 'Classes & radius basis')}</summary>${legendHtml()}
            <p>${localized('Skala ilustrasi', 'Illustrative scale')}: R = min(2500, max(5, 10^(0.5 × M − 0.5))) km. ${localized('Gradasi memudar dari warna kelas magnitudo pusat, bukan intensitas terukur. Animasi adalah simulasi visual, bukan waktu rambat gelombang. Luas yang benar-benar dirasakan dapat berbeda.', 'Colors fade from the epicenter magnitude class, not measured intensity. Animation is a visual simulation, not wave travel time. The actual felt area can differ.')}
            <a href="https://www.usgs.gov/observatories/hvo/science/felt-earthquakes-ones-people-feel" target="_blank" rel="noopener noreferrer">${localized('Penjelasan USGS', 'USGS explanation')}</a></p></details>
        </section>`;
        return html.includes('</h4>') ? html.replace('</h4>', `</h4>${panel}`) : panel + html;
    }

    function playLabel() { return state.playing ? localized('Jeda animasi', 'Pause animation') : localized('Putar animasi', 'Play animation'); }
    function statusLabel() { return state.playing ? localized('Simulasi gelombang berulang', 'Repeating wave simulation') : localized('Radius penuh ditampilkan', 'Full radius displayed'); }
    function updateControls() {
        document.querySelectorAll('[data-earthquake-radius-play]').forEach((button) => {
            button.textContent = playLabel();
            button.disabled = !state.feature;
            button.setAttribute('aria-pressed', String(state.playing));
        });
        document.querySelectorAll('[data-earthquake-radius-status]').forEach((element) => {
            element.textContent = state.feature ? statusLabel() : localized('Klik ikon gempa untuk memilih radius', 'Click an earthquake icon to select a radius');
        });
    }

    function animate(time) {
        if (!state.playing || !state.feature) return;
        if (time - state.lastDraw >= 50) {
            draw(0.04 + 0.96 * ((time - state.startedAt) % CYCLE_MS) / CYCLE_MS, false);
            state.lastDraw = time;
        }
        state.frame = requestAnimationFrame(animate);
    }

    function play() {
        if (!state.feature || state.playing) return;
        state.playing = true;
        state.startedAt = performance.now();
        state.lastDraw = state.startedAt;
        draw(0.04, false);
        state.frame = requestAnimationFrame(animate);
        updateControls();
    }

    function pause() {
        if (state.frame !== null) cancelAnimationFrame(state.frame);
        state.frame = null;
        state.playing = false;
        if (state.feature) draw(1, false);
        updateControls();
    }

    function clear() {
        if (state.frame !== null) cancelAnimationFrame(state.frame);
        state.frame = null;
        state.playing = false;
        state.progress = 1;
        state.feature = null;
        state.selectedKey = '';
        state.estimate = null;
        setFocused(false);
        state.listeners.forEach((key) => ol.Observable.unByKey(key));
        state.listeners = [];
        state.bands = [];
        if (state.source) state.source.clear();
        if (state.layer) state.layer.setVisible(false);
        updateControls();
    }

    function clearSelectionPopup() {
        clear();
        if (window.AdvancedAstroGIS) window.AdvancedAstroGIS.hidePopup();
    }

    window.MpmEarthquakeRadius = {
        init, magnitudeClass, describe, legendHtml, prepareFeature, popupHtml, layoutPopup, clear, play, pause,
        clearForKind: (kind) => { if (state.feature && state.feature.get('kind') === kind) clearSelectionPopup(); },
        getSource: () => state.source,
        getLayer: () => state.layer,
        getState: () => ({ selectedKey: state.selectedKey, kind: state.feature ? state.feature.get('kind') : '',
            radiusKm: state.estimate ? state.estimate.radiusKm : null,
            displayRadiusKm: state.estimate ? state.estimate.radiusKm * state.progress : null,
            playing: state.playing, progress: state.progress, featureCount: state.source ? state.source.getFeatures().length : 0 })
    };
})();
