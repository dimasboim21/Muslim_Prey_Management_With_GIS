(function () {
    'use strict';
    function create({ ol, adm0 }) {
        let key = '', status = 'unavailable', polygons = [], metadata = {}, generation = 0, abort = null, retryAt = 0;
        const listeners = new Set();
        const notify = () => listeners.forEach((fn) => fn());
        const state = () => ({ key, status, marineReady: status === 'ready', metadata, country: adm0.getState().name });
        function contains(coordinate) {
            if (adm0.contains(coordinate)) return true;
            if (!adm0.getState().ready || key !== adm0.getState().key) return false;
            const world = 40075016.68557849;
            return [-world, 0, world].some((shift) => polygons.some((g) => g.intersectsCoordinate([coordinate[0] + shift, coordinate[1]])));
        }
        async function ensure() {
            const country = adm0.getState();
            if (!country.ready || (country.key === key && status !== 'unavailable' && !(status === 'error' && Date.now() >= retryAt))) return;
            key = country.key; polygons = []; metadata = {}; status = 'loading';
            if (abort) abort.abort(); abort = new AbortController(); const controller = abort, token = ++generation;
            if (!country.iso3) { status = 'error'; retryAt = Date.now() + 60000; metadata.warning = 'Kode ISO3 negara belum tersedia untuk batas maritim.'; return; }
            const timeout = setTimeout(() => controller.abort(), 100000);
            try {
                const response = await fetch('api/earthquake-maritime-scope.php?iso3=' + encodeURIComponent(country.iso3), { signal: controller.signal });
                const payload = await response.json();
                if (!response.ok || payload.success !== true) throw new Error(payload.error || 'Batas maritim belum tersedia.');
                if (token !== generation || country.key !== adm0.getState().key) return;
                polygons = new ol.format.GeoJSON().readFeatures(payload, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' })
                    .map((f) => f.getGeometry()).filter((g) => g && ['Polygon', 'MultiPolygon'].includes(g.getType()));
                metadata = payload.meta || {}; status = polygons.length ? 'ready' : 'empty';
            } catch (error) { if (token !== generation) return; status = 'error'; retryAt = Date.now() + 60000; metadata.warning = error.message; }
            finally { clearTimeout(timeout); if (token === generation) notify(); }
        }
        adm0.subscribe(() => { ++generation; if (abort) abort.abort(); polygons = []; key = ''; status = 'unavailable'; metadata = {}; });
        return { ensure, contains, accepts: (f) => !!f.getGeometry() && f.getGeometry().getType() === 'Point' && contains(f.getGeometry().getCoordinates()), getState: state, subscribe: (fn) => listeners.add(fn) };
    }
    window.MpmEarthquakeMapScope = { create };
}());
