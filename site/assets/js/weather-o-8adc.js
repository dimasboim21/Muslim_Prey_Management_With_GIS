(function () {
    'use strict';

    const ui = value => window.PrayerI18n ? window.PrayerI18n.uiText(value) : value;
    const WORLD = [-180, -80, 180, 80];
    const MODEL_URL = 'https://api.open-meteo.com/v1/forecast';
    const RADAR_URL = 'https://api.rainviewer.com/public/weather-maps.json';
    const GIBS_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor';
    const NHC_URL = 'https://www.nhc.noaa.gov/CurrentStorms.json';
    const VARIABLES = ['temperature_2m', 'wind_speed_10m', 'wind_direction_10m', 'precipitation', 'cloud_cover', 'pressure_msl', 'relative_humidity_2m'];
    const MODEL_IDS = { best_match: 'best_match', icon: 'icon_seamless', gfs: 'gfs_seamless' };
    const SETTINGS_KEY = 'mpm:weather-explorer:settings:v1';
    const FIELDS = {
        wind: { field: 'wind_speed_10m', title: 'Angin 10 m', unit: 'km/h', stops: [0, 10, 25, 40, 65, 100, 150], colors: ['#183a79', '#167fba', '#24b7ad', '#b8dc69', '#f6b449', '#e85757', '#a943aa'] },
        temperature: { field: 'temperature_2m', title: 'Suhu 2 m', unit: '°C', stops: [-30, -10, 0, 15, 25, 35, 45], colors: ['#6343a8', '#3262bd', '#44a6d8', '#72cbb2', '#eddb76', '#f29b55', '#d44e63'] },
        precipitation: { field: 'precipitation', title: 'Hujan prakiraan · akumulasi 1 jam', unit: 'mm', stops: [0, 0.2, 1, 3, 8, 20, 40], colors: ['#112c50', '#2478a1', '#37c5c8', '#63ce7d', '#ecd553', '#e77b44', '#a64997'] },
        'cloud-cover': { field: 'cloud_cover', title: 'Tutupan awan prakiraan', unit: '%', stops: [0, 20, 40, 60, 80, 100], colors: ['#163c66', '#3b637c', '#6f8d9c', '#a1b4c0', '#cfd9de', '#ffffff'] },
        pressure: { field: 'pressure_msl', title: 'Tekanan permukaan laut', unit: 'hPa', stops: [970, 990, 1005, 1015, 1025, 1040], colors: ['#8451b0', '#406dba', '#4cbbc1', '#8cce92', '#ebd16d', '#ed9361'] }
    };
    const SOURCES = {
        wind: { provider: 'Open-Meteo', url: 'https://open-meteo.com/en/docs', note: 'Prakiraan model; warna diinterpolasi antartitik sampel. Klik peta untuk prakiraan lokasi.' },
        rain: { provider: 'RainViewer', url: 'https://www.rainviewer.com/', note: 'Radar pengamatan dua jam terakhir, sesuai cakupan radar. Area tanpa warna dapat berarti tidak ada hujan atau tidak ada cakupan. Resolusi asli sampai zoom 7.' },
        cloud: { provider: 'NASA GIBS · MODIS Terra', url: 'https://www.earthdata.nasa.gov/engage/open-data-services-and-software/earthdata-developer-portal/gibs-api', note: 'Komposit satelit harian, bukan citra langsung. Awan, jeda pengamatan, dan cakupan dapat meninggalkan area kosong.' },
        storm: { provider: 'NOAA · NHC / NWS', url: 'https://www.nhc.noaa.gov/gis/', note: 'NHC: sistem tropis Atlantik/Pasifik timur-tengah. NWS: peringatan tornado AS. Klik ikon untuk jalur dan luas area resmi; bukan cakupan badai global.' }
    };
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const numeric = (value) => value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
    const longitude = (lon) => ((lon + 180) % 360 + 360) % 360 - 180;
    const timestamp = (time) => typeof time === 'number' ? (time < 1e12 ? time * 1000 : time) : Date.parse(/Z$|[+-]\d\d:\d\d$/.test(time || '') ? time : time + 'Z');
    const dateLabel = (time) => new Date(time).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    const isModel = (layer) => Boolean(FIELDS[layer]);

    function init(options) {
        const { ol, state, byId, observer, scope } = options;
        const inScope = (feature) => weather.scope === "global" || scope.accepts(feature);
        const weather = state.weather;
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (_) {}
        Object.assign(weather, { enabled: false, playing: false, windMotion: false, layer: FIELDS[saved.layer] || SOURCES[saved.layer] ? saved.layer : 'wind',
            scope: saved.scope === 'global' ? 'global' : 'local', model: MODEL_IDS[saved.model] ? saved.model : 'best_match',
            unitSystem: saved.unitSystem === 'imperial' ? 'imperial' : 'metric', opacity: clamp(numeric(saved.opacity) ?? 0.65, 0, 1),
            speed: clamp(numeric(saved.speed) ?? 800, 300, 3000), frame: 0, loading: false, error: '', status: 'Cuaca nonaktif', point: null });
        let activeData = null, activeKey = '', revision = 0, abort = null, pointAbort = null, pointRevision = 0;
        let windFrame = null, windLastTime = 0, moveTimer = null, bound = false, pointData = null, searchAbort = null;
        let fieldLayer = null, windLayer = null, pointLayer = null, pointMarker = null;
        let hiddenLayers = [], hiddenLayerKeys = [];
        const fieldCache = new Map(), pointCache = new Map();
        let rasterPlayer = null, stormDisplay = null, stormTimer = null, selectedStormId = '';
        const frameList = () => activeData && activeData.frames || [];
        const currentFrame = () => frameList()[weather.frame] || null;
        const source = () => {
            const value = Object.assign({}, SOURCES[weather.layer] || SOURCES.wind);
            if (isModel(weather.layer)) value.provider += ' · ' + ({ best_match: 'Auto', icon: 'DWD ICON', gfs: 'NOAA GFS' }[weather.model]);
            return value;
        };
        const convert = (value, field) => {
            if (value === null) return null;
            if (weather.unitSystem !== 'imperial') return value;
            return field === 'temperature_2m' ? value * 1.8 + 32 : field === 'wind_speed_10m' ? value / 1.609344 : field === 'precipitation' ? value / 25.4 : field === 'pressure_msl' ? value * 0.029529983 : value;
        };
        const unit = (field) => ({ temperature_2m: weather.unitSystem === 'imperial' ? '°F' : '°C', wind_speed_10m: weather.unitSystem === 'imperial' ? 'mph' : 'km/h',
            precipitation: weather.unitSystem === 'imperial' ? 'in' : 'mm', pressure_msl: weather.unitSystem === 'imperial' ? 'inHg' : 'hPa', cloud_cover: '%', relative_humidity_2m: '%', wind_direction_10m: '°' }[field] || '');
        const formatted = (value, field) => value === null ? 'Tidak tersedia' : `${convert(value, field).toFixed(field === 'precipitation' || (field === 'pressure_msl' && weather.unitSystem === 'imperial') ? 2 : 1)} ${unit(field)}`;
        const legend = () => {
            const field = FIELDS[weather.layer];
            if (field) return { title: field.title, unit: unit(field.field), colors: field.colors, labels: field.stops.map((n) => String(Math.round(convert(n, field.field) * 10) / 10)) };
            return weather.layer === 'rain'
                ? { title: 'Radar · intensitas pantulan', unit: 'dBZ', colors: ['#b7d2e8', '#65a2cf', '#2765b0', '#172d7a'], labels: ['Lemah', '', '', 'Kuat'] }
                : { title: weather.layer === 'cloud' ? 'Satelit harian · warna alami' : 'Sistem tropis / peringatan tornado', unit: '', colors: [], labels: [] };
        };
        const getState = () => ({ enabled: weather.enabled, layer: weather.layer, scope: weather.scope, scopeCountry: scope.getState(), model: weather.model,
            unitSystem: weather.unitSystem, opacity: weather.opacity, speed: weather.speed, playing: weather.playing, windMotion: weather.windMotion,
            raster: rasterPlayer ? rasterPlayer.getState() : null,
            stormSystems: weather.layer === 'storm' && activeData && activeData.features ? activeData.features.filter(inScope).filter((feature) => feature.getGeometry().getType() === 'Point').map((feature) => ({ id: feature.get('recordId'), name: feature.get('label'), type: feature.get('stormType') })) : [],
            frame: weather.frame, frames: frameList().map((f) => ({ time: f.time, kind: f.kind, label: f.label || dateLabel(f.time) })),
            loading: weather.loading, error: weather.error, status: weather.status, legend: legend(), source: source(), point: weather.point,
            basemap: Array.from(document.querySelectorAll('.map-tools [data-basemap], .astro-map-drawer [data-basemap]'), (button) => button.dataset.basemap).find((key) => state.layers[key] && state.layers[key].getVisible()) || 'osm',
            grid: activeData && activeData.grid ? { columns: activeData.grid.width, rows: activeData.grid.height, extent: activeData.extent.slice() } : null });
        function publish() {
            const snapshot = getState();
            const scopeSelect = byId('weatherScopeSelect'); if (scopeSelect) scopeSelect.querySelector('[value=local]').textContent = 'Lokal ADM0 · ' + (snapshot.scopeCountry.name || 'negara belum dipilih');
            const toggle = byId('weatherOverlayToggle'); if (toggle) toggle.checked = weather.enabled;
            ['Layer', 'Scope', 'Speed'].forEach((name) => { const node = byId('weather' + name + 'Select'); if (node) node.value = String(weather[name.toLowerCase()]); });
            const slider = byId('weatherFrameSlider');
            if (slider) { slider.max = String(Math.max(0, frameList().length - 1)); slider.value = String(weather.frame); slider.disabled = !weather.enabled || frameList().length < 2; }
            ['weatherPreviousButton', 'weatherNextButton', 'weatherPlayToggle'].forEach((id) => { const node = byId(id); if (node) node.disabled = !weather.enabled || weather.loading || frameList().length < 2; });
            const play = byId('weatherPlayToggle'); if (play) { play.textContent = ui(weather.playing ? 'Jeda' : 'Putar'); play.setAttribute('aria-pressed', String(weather.playing)); }
            const status = byId('weatherFrameStatus'); if (status) status.textContent = ui(weather.error || weather.status);
            const label = byId('weatherLegend'); if (label) label.textContent = ui(snapshot.legend.title) + (snapshot.legend.unit ? ' · ' + snapshot.legend.unit : '');
            window.dispatchEvent(new CustomEvent('mpm:weather-state', { detail: snapshot }));
        }
        window.addEventListener('mpm:language-changed', publish);
        function persist() {
            try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ layer: weather.layer, scope: weather.scope, model: weather.model, unitSystem: weather.unitSystem, opacity: weather.opacity, speed: weather.speed })); } catch (_) {}
        }
        function dataExtent() {
            if (weather.scope === 'global') return WORLD.slice();
            return scope.bounds();
        }

        function grid(extent) {
            const width = 8, height = 6;
            return { width, height, points: Array.from({ length: width * height }, (_, index) => ({
                lon: extent[0] + (extent[2] - extent[0]) * (index % width) / (width - 1),
                lat: extent[1] + (extent[3] - extent[1]) * Math.floor(index / width) / (height - 1)
            })) };
        }
        function modelUrl(points, point) {
            const params = new URLSearchParams({ latitude: points.map((p) => p.lat.toFixed(4)).join(','), longitude: points.map((p) => longitude(p.lon).toFixed(4)).join(','),
                hourly: VARIABLES.join(','), models: MODEL_IDS[weather.model], forecast_days: '3', past_days: point ? '5' : '0', timezone: 'GMT', timeformat: 'unixtime',
                temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm', cell_selection: 'nearest' });
            return MODEL_URL + '?' + params.toString();
        }
        async function fetchJson(url, signal) {
            const response = await fetch(url, { signal, cache: 'no-cache' });
            if (!response.ok) throw new Error(response.status === 429 ? 'Batas permintaan layanan tercapai. Coba lagi nanti.' : 'Sumber data tidak tersedia (HTTP ' + response.status + ').');
            const payload = await response.json();
            if (payload && payload.error) throw new Error('Sumber menolak permintaan cuaca.');
            return payload;
        }
        function parseModel(payload, gridData, extent) {
            const rows = Array.isArray(payload) ? payload : [payload];
            if (rows.length !== gridData.points.length) throw new Error('Data grid cuaca tidak lengkap.');
            const times = rows[0] && rows[0].hourly && rows[0].hourly.time;
            if (!Array.isArray(times) || !times.length) throw new Error('Waktu prakiraan tidak tersedia.');
            const frames = times.map((time, index) => ({ time: timestamp(time), kind: 'FORECAST', values: rows.map((row) => {
                const hourly = row.hourly || {};
                // Missing values remain missing; a dry/calm zero is a valid observation of model output.
                const rowValues = Object.fromEntries(VARIABLES.map((variable) => [variable, timestamp((hourly.time || [])[index]) === timestamp(time) ? numeric((hourly[variable] || [])[index]) : null]));
                const speed = rowValues.wind_speed_10m, direction = rowValues.wind_direction_10m;
                rowValues.u = speed === null || direction === null ? null : -Math.sin(direction * Math.PI / 180) * speed / 3.6;
                rowValues.v = speed === null || direction === null ? null : -Math.cos(direction * Math.PI / 180) * speed / 3.6;
                return rowValues;
            }) })).filter((f) => Number.isFinite(f.time));
            if (!frames.length) throw new Error('Waktu prakiraan tidak valid.');
            return { frames, grid: gridData, extent, fetchedAt: Date.now() };
        }
        async function loadRadar(signal) {
            const payload = await fetchJson(RADAR_URL, signal);
            // Public RainViewer: observed past only, native zoom <=7 since January 2026.
            // https://www.rainviewer.com/api/transition-faq.html
            const host = /^https:\/\/(?:[a-z0-9-]+\.)*rainviewer\.com\/?$/i.test(payload.host || '') ? payload.host.replace(/\/$/, '') : 'https://tilecache.rainviewer.com';
            const seen = new Set();
            const frames = ((payload.radar || {}).past || []).filter((f) => numeric(f.time) !== null && /^\/v2\/radar\/[a-z0-9/_-]+$/i.test(f.path || ''))
                .map((f) => ({ time: Number(f.time) * 1000, path: f.path, kind: 'OBSERVED' })).sort((a, b) => a.time - b.time)
                .filter((f) => { if (seen.has(f.time)) return false; seen.add(f.time); return true; });
            if (!frames.length) throw new Error('Frame radar pengamatan belum tersedia.');
            return { frames, host, fetchedAt: Date.now() };
        }
        async function loadSatellite(signal) {
            const dates = Array.from({ length: 5 }, (_, i) => new Date(Date.now() - (i + 1) * 86400000).toISOString().slice(0, 10));
            const frames = await Promise.all(dates.map(async (date) => {
                try {
                    const response = await fetch(GIBS_URL + '/default/' + date + '/GoogleMapsCompatible_Level9/0/0/0.jpg', { signal });
                    return response.ok ? { time: Date.parse(date + 'T00:00:00Z'), date, kind: 'OBSERVED', label: date + ' · harian UTC' } : null;
                } catch (error) { if (error.name === 'AbortError') throw error; return null; }
            }));
            const available = frames.filter(Boolean).sort((a, b) => a.time - b.time);
            if (!available.length) throw new Error('Citra satelit harian belum tersedia.');
            return { frames: available, fetchedAt: Date.now() };
        }
        async function loadStorms(signal) {
            let payload, cached = false, stale = false, fetchedAt = Date.now();
            const warnings = [];
            const tornadoRequest = fetchJson('api/weather-map-proxy.php?source=tornado-warnings', signal)
                .then((response) => response.success && response.data ? response : null).catch(() => null);
            try {
                // NHC has no browser CORS headers; use the fixed same-origin endpoint first.
                const response = await fetchJson('api/weather-map-proxy.php?source=nhc-current', signal);
                if (!response.success || !response.data) throw new Error('Data NHC belum dapat diakses.');
                payload = response.data; cached = Boolean(response.cached); stale = Boolean(response.stale);
                if (Number.isFinite(Date.parse(response.fetchedAt))) fetchedAt = Date.parse(response.fetchedAt);
            } catch (error) {
                if (error.name === 'AbortError') throw error;
                try { payload = await fetchJson(NHC_URL, signal); }
                catch (directError) { if (directError.name === 'AbortError') throw directError; warnings.push('Laporan NHC belum tersedia.'); payload = { activeStorms: [] }; }
            }
            if (!payload || (!Array.isArray(payload.activeStorms) && !Array.isArray(payload.features))) throw new Error('Format laporan NHC tidak tersedia.');
            const features = [];
            (payload.activeStorms || []).forEach((storm) => {
                const lat = numeric(storm.latitudeNumeric ?? storm.latitude_numeric ?? storm.lat), lon = numeric(storm.longitudeNumeric ?? storm.longitude_numeric ?? storm.lon);
                if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
                const classification = String(storm.classification || storm.stormType || 'TC').toLowerCase();
                features.push(new ol.Feature({ geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])), kind: 'weather-storm',
                    label: String(storm.name || storm.id || 'Sistem tropis'), record: storm, recordId: String(storm.id || storm.name || ''),
                    stormType: classification.includes('tornado') ? 'tornado' : ['hu', 'hurricane'].includes(classification) ? 'hurricane' : 'tropical-cyclone', link: 'https://www.nhc.noaa.gov/' }));
            });
            (payload.features || []).forEach((item) => {
                if (!item.geometry) return;
                const f = new ol.format.GeoJSON().readFeature(item, { featureProjection: 'EPSG:3857' });
                f.set('kind', f.getGeometry().getType() === 'Point' ? 'weather-storm' : 'weather-storm-track');
                f.set('label', String((item.properties || {}).name || 'NHC')); features.push(f);
            });
            const tornadoResponse = await tornadoRequest;
            if (!tornadoResponse && warnings.includes('Laporan NHC belum tersedia.')) throw new Error('Sumber badai belum dapat diakses; data terakhir dipertahankan.');
            if (!tornadoResponse) warnings.push('Peringatan tornado NWS belum tersedia.');
            else {
                const alerts = tornadoResponse.data;
                (alerts.features || []).forEach((item) => {
                    const properties = item.properties || {};
                    if (!item.geometry || (properties.event && properties.event !== 'Tornado Warning')) return;
                    const expires = Date.parse(properties.expires || '');
                    if (Number.isFinite(expires) && expires <= Date.now()) return;
                    const area = new ol.format.GeoJSON().readGeometry(item.geometry, { featureProjection: 'EPSG:3857' });
                    let center;
                    if (area.getType() === 'Polygon') center = area.getInteriorPoint().getCoordinates().slice(0, 2);
                    else if (area.getType() === 'MultiPolygon') center = area.getPolygons().sort((a, b) => Math.abs(b.getArea()) - Math.abs(a.getArea()))[0].getInteriorPoint().getCoordinates().slice(0, 2);
                    else return;
                    features.push(new ol.Feature({ geometry: new ol.geom.Point(center), kind: 'weather-storm', stormType: 'tornado',
                        recordId: String(item.id || properties.id || properties['@id'] || ''), label: 'Peringatan tornado · ' + String(properties.areaDesc || 'NWS'),
                        record: { id: item.id || properties.id, classification: 'Tornado Warning', lastUpdate: properties.sent, alert: item, warningGeometry: item.geometry }, link: 'https://www.weather.gov/' }));
                });
                if (tornadoResponse.stale) warnings.push('Peringatan NWS memakai data tersimpan; periksa waktu laporan.');
            }
            if (warnings.length === 2 && !tornadoResponse && !features.length) throw new Error(warnings.join(' '));
            return { frames: [], features, fetchedAt, cached, stale, warnings };
        }
        function clearLayers() {
            if (rasterPlayer) rasterPlayer.clear();
            if (stormDisplay) stormDisplay.clear();
            state.layers.weatherOverlay.getLayers().clear();
            state.sources.weatherParticles.clear();
            fieldLayer = null; windLayer = null;
        }
        let refreshing = false, activePresentation = '';
        function dataSignature(data) {
            if (!data) return '';
            return JSON.stringify({ ...data, fetchedAt: undefined, features: data.features && data.features.map((f) => {
                const props = f.getProperties(); delete props.geometry;
                return { ...props, geometry: f.getGeometry() && f.getGeometry().getCoordinates() };
            }) });
        }
        async function loadAndRender(force, background) {
            if (!weather.enabled || !state.map) return;
            if (background && refreshing) return;
            const requestRevision = ++revision;
            if (abort) abort.abort();
            abort = new AbortController();
            const signal = abort.signal, selectedLayer = weather.layer, extent = dataExtent();
            if (weather.scope === 'local' && !extent) { clearLayers(); activeData = null; weather.loading = false; weather.error = 'Batas ADM0 negara terpilih belum tersedia.'; weather.status = weather.error; publish(); return; }
            const key = isModel(selectedLayer) ? 'model:' + weather.model + ':' + extent.map((n) => n.toFixed(1)).join(',') : selectedLayer;
            const retainedTime = currentFrame() && currentFrame().time;
            const presentation = [selectedLayer, weather.scope, weather.scope === 'local' ? scope.getState().key : 'global', key].join('|');
            const previousData = activeKey === key && activePresentation === presentation ? activeData : null;
            const preserve = Boolean(previousData);
            const signature = dataSignature(previousData), previousStatus = weather.status;
            refreshing = true;
            const timeout = setTimeout(() => abort && !signal.aborted && requestRevision === revision && abort.abort(), 20000);
            weather.loading = !preserve; weather.error = ''; if (!preserve) weather.status = 'Memuat cuaca…';
            if (!preserve) { setPlaying(false); clearLayers(); activeData = null; weather.frame = 0; }
            activeKey = key; activePresentation = presentation; if (!background) publish();
            try {
                let entry = fieldCache.get(key), data;
                if (!force && entry && entry.expires > Date.now()) data = entry.data;
                else {
                    if (isModel(selectedLayer)) {
                        const gridData = grid(extent);
                        data = parseModel(await fetchJson(modelUrl(gridData.points, false), signal), gridData, extent);
                    } else if (selectedLayer === 'rain') data = await loadRadar(signal);
                    else if (selectedLayer === 'cloud') data = await loadSatellite(signal);
                    else data = await loadStorms(signal);
                    if (requestRevision !== revision || !weather.enabled) return;
                    fieldCache.delete(key);
                    fieldCache.set(key, { data, expires: Date.now() + (selectedLayer === 'rain' || selectedLayer === 'storm' ? 180000 : 900000) });
                    while (fieldCache.size > 8) fieldCache.delete(fieldCache.keys().next().value);
                }
                if (requestRevision !== revision || !weather.enabled || activeKey !== key) return;
                weather.loading = false;
                if (preserve && signature === dataSignature(data)) { activeData.fetchedAt = data.fetchedAt; weather.error = ''; weather.status = previousStatus; publish(); return; }
                const targetTime = preserve && currentFrame() ? currentFrame().time : retainedTime;
                activeData = data;
                if (data.frames.length) {
                    const target = targetTime || Date.now();
                    weather.frame = data.frames.reduce((best, f, i, frames) => Math.abs(f.time - target) < Math.abs(frames[best].time - target) ? i : best, 0);
                }
                if (!preserve) weather.particles = []; render();
            } catch (error) {
                if (requestRevision !== revision || !weather.enabled) return;
                weather.loading = false; weather.error = error.message || 'Sumber cuaca belum dapat diakses.';
                if (previousData) activeData = previousData;
                weather.status = previousData ? 'Pembaruan gagal; data terakhir tetap ditampilkan.' : 'Data tidak tersedia'; publish();
            } finally {
                clearTimeout(timeout); if (requestRevision === revision) refreshing = false;
            }
        }
        function sample(frame, lat, lon, field) {
            if (!activeData || !activeData.grid || !frame) return null;
            const e = activeData.extent, g = activeData.grid;
            while (lon < e[0] - 180) lon += 360;
            while (lon > e[2] + 180) lon -= 360;
            if (lon < e[0] || lon > e[2] || lat < e[1] || lat > e[3]) return null;
            const x = clamp((lon - e[0]) / (e[2] - e[0]) * (g.width - 1), 0, g.width - 1), y = clamp((lat - e[1]) / (e[3] - e[1]) * (g.height - 1), 0, g.height - 1);
            const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(g.width - 1, x0 + 1), y1 = Math.min(g.height - 1, y0 + 1);
            const a = frame.values[y0 * g.width + x0][field], b = frame.values[y0 * g.width + x1][field], c = frame.values[y1 * g.width + x0][field], d = frame.values[y1 * g.width + x1][field];
            if ([a, b, c, d].some((n) => n === null)) return null;
            return (a * (1 - x + x0) + b * (x - x0)) * (1 - y + y0) + (c * (1 - x + x0) + d * (x - x0)) * (y - y0);
        }
        function color(value, field) {
            const stops = field.stops;
            let upper = stops.findIndex((n) => n >= value); if (upper < 0) upper = stops.length - 1;
            const lower = Math.max(0, upper - 1), weight = upper === lower ? 0 : clamp((value - stops[lower]) / (stops[upper] - stops[lower]), 0, 1);
            return [1, 3, 5].map((offset) => Math.round(parseInt(field.colors[lower].slice(offset, offset + 2), 16) * (1 - weight) + parseInt(field.colors[upper].slice(offset, offset + 2), 16) * weight));
        }
        function fieldCanvas(extent, resolution, pixelRatio, size) {
            const canvas = document.createElement('canvas'); canvas.width = size[0]; canvas.height = size[1];
            const frame = currentFrame(), field = FIELDS[weather.layer];
            if (!weather.enabled || !frame || !field) return canvas;
            const small = document.createElement('canvas'); small.width = Math.max(2, Math.min(300, Math.ceil(size[0] / 5))); small.height = Math.max(2, Math.min(200, Math.ceil(size[1] / 5)));
            const ctx = small.getContext('2d'), pixels = ctx.createImageData(small.width, small.height);
            for (let y = 0; y < small.height; y += 1) {
                const mapY = extent[3] - (extent[3] - extent[1]) * (y + 0.5) / small.height;
                const lat = ol.proj.toLonLat([0, mapY])[1];
                for (let x = 0; x < small.width; x += 1) {
                    const lon = (extent[0] + (extent[2] - extent[0]) * (x + 0.5) / small.width) / 20037508.342789244 * 180;
                    const value = sample(frame, lat, lon, field.field); if (value === null) continue;
                    const rgb = color(value, field), offset = (y * small.width + x) * 4;
                    pixels.data[offset] = rgb[0]; pixels.data[offset + 1] = rgb[1]; pixels.data[offset + 2] = rgb[2];
                    pixels.data[offset + 3] = weather.layer === 'precipitation' ? Math.round(clamp(value / 0.5, 0, 1) * 220) : 225;
                }
            }
            ctx.putImageData(pixels, 0, 0); const output = canvas.getContext('2d'); output.imageSmoothingEnabled = true; output.drawImage(small, 0, 0, canvas.width, canvas.height);
            return canvas;
        }
        function drawWind(delta) {
            const frame = currentFrame(); if (!frame || !activeData.grid) return;
            const e = activeData.extent, particles = weather.particles;
            if (!particles.length) {
                for (let i = 0; i < 150; i += 1) particles.push({ lon: e[0] + ((i * 0.61803398875) % 1) * (e[2] - e[0]), lat: e[1] + ((i * 0.41421356) % 1) * (e[3] - e[1]), age: i % 80, feature: new ol.Feature({ kind: 'weather-wind' }) });
                state.sources.weatherParticles.addFeatures(particles.map((p) => p.feature));
            }
            const resolution = state.map.getView().getResolution();
            particles.forEach((p, index) => {
                // Interpolate vector components, not angles across the 0°/360° seam.
                const u = sample(frame, p.lat, p.lon, 'u'), v = sample(frame, p.lat, p.lon, 'v');
                const magnitude = u === null || v === null ? 0 : Math.hypot(u, v);
                if (magnitude === 0) { p.feature.setGeometry(undefined); return; }
                const coordinate = ol.proj.fromLonLat([p.lon, p.lat]), length = (10 + Math.min(magnitude, 40)) * resolution;
                const tip = [coordinate[0] + u / magnitude * length, coordinate[1] + v / magnitude * length], arrow = 3 * resolution;
                p.feature.setGeometry(new ol.geom.MultiLineString([[coordinate, tip],
                    [[tip[0] - u / magnitude * arrow - v / magnitude * arrow * 0.65, tip[1] - v / magnitude * arrow + u / magnitude * arrow * 0.65], tip,
                    [tip[0] - u / magnitude * arrow + v / magnitude * arrow * 0.65, tip[1] - v / magnitude * arrow - u / magnitude * arrow * 0.65]]]));
                if (!delta) return;
                const moved = ol.proj.toLonLat([coordinate[0] + u / magnitude * resolution * delta * (15 + Math.min(magnitude, 60)), coordinate[1] + v / magnitude * resolution * delta * (15 + Math.min(magnitude, 60))]);
                p.lon = moved[0]; while (p.lon < e[0] - 180) p.lon += 360; p.lat = moved[1]; p.age += 1;
                if (p.lon < e[0] || p.lon > e[2] || p.lat < e[1] || p.lat > e[3] || p.age > 120) {
                    p.lon = e[0] + ((index * 0.61803398875 + performance.now() / 1e5) % 1) * (e[2] - e[0]);
                    p.lat = e[1] + ((index * 0.41421356 + performance.now() / 2e5) % 1) * (e[3] - e[1]); p.age = 0;
                }
            });
        }
        function windTick(time) {
            if (!weather.enabled || !weather.playing || !weather.windMotion || weather.layer !== 'wind') { windFrame = null; return; }
            if (time - windLastTime >= 50) { drawWind(Math.min(0.1, (time - windLastTime) / 1000)); windLastTime = time; }
            windFrame = requestAnimationFrame(windTick);
        }
        function render() {
            if (!weather.enabled || !activeData) return;
            const layers = state.layers.weatherOverlay.getLayers(), frame = currentFrame();
            if (isModel(weather.layer) && frame) {
                if (!fieldLayer) {
                    layers.clear();
                    fieldLayer = new ol.layer.Image({ source: new ol.source.ImageCanvas({ canvasFunction: fieldCanvas, projection: 'EPSG:3857', ratio: 1 }), zIndex: 17 });
                    fieldLayer.set('weatherKind', weather.layer); layers.push(fieldLayer);
                }
                fieldLayer.getSource().changed();
                if (weather.layer === 'wind') {
                    if (!windLayer) { windLayer = new ol.layer.Vector({ source: state.sources.weatherParticles, style: new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(240,252,255,0.9)', width: 1.4 }) }), zIndex: 18 }); layers.push(windLayer); }
                    drawWind(0);
                }
                weather.status = frame.values.some((row) => row[FIELDS[weather.layer].field] !== null)
                    ? 'PRAKIRAAN · ' + dateLabel(frame.time) : 'Data prakiraan tidak tersedia pada waktu ini.';
            } else if ((weather.layer === 'rain' || weather.layer === 'cloud') && frame) {
                const radar = weather.layer === 'rain';
                rasterPlayer.show(frame, { url: radar ? activeData.host + frame.path + '/256/{z}/{x}/{y}/2/1_1.png' : GIBS_URL + '/default/' + frame.date + '/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
                    maxZoom: radar ? 7 : 9, attributions: radar ? 'Radar © <a href="https://www.rainviewer.com/">RainViewer</a>' : 'NASA GIBS / MODIS Terra' });
            } else if (weather.layer === 'storm') {
                if (!layers.getArray().includes(stormDisplay.getLayer())) { layers.clear(); layers.push(stormDisplay.getLayer()); }
                stormDisplay.render(activeData.features.filter(inScope));
                const selected = activeData.features.filter(inScope).find((feature) => feature.get('recordId') === selectedStormId);
                if (selected && !stormDisplay.getState().selection) stormDisplay.select(selected);
                weather.status = activeData.features.filter(inScope).length ? `${activeData.features.filter(inScope).length} sistem / peringatan · diperiksa setiap 5 detik` : 'Tidak ada sistem / peringatan aktif dalam cakupan sumber.';
                if (activeData.stale) weather.status = 'NHC · data tersimpan ' + dateLabel(activeData.fetchedAt) + '; pembaruan belum tersedia.';
                if (activeData.warnings.length) weather.status += ' ' + activeData.warnings.join(' ');
            }
            updatePoint(); publish();
        }
        function stopTimers() {
            if (weather.timer) clearInterval(weather.timer); weather.timer = null;
            if (windFrame !== null) cancelAnimationFrame(windFrame); windFrame = null;
        }
        function setPlaying(playing) {
            stopTimers();
            weather.playing = Boolean(playing && weather.enabled && !weather.loading && frameList().length > 1);
            if (weather.playing) {
                weather.timer = setInterval(() => { if (weather.enabled && !(rasterPlayer && (rasterPlayer.getState().loading || rasterPlayer.getState().transitioning))) { weather.frame = (weather.frame + 1) % frameList().length; weather.error = ''; render(); } }, weather.speed);
                if (weather.layer === 'wind' && weather.windMotion) { windLastTime = performance.now(); windFrame = requestAnimationFrame(windTick); }
            }
            publish();
        }
        function mapFocus(enabled) {
            if (enabled) {
                const candidates = ['atmosphere', 'prayer', 'hilal', 'trajectory', 'direction', 'bodies', 'eclipse', 'onlineOverlay'].map((key) => state.layers[key]).filter(Boolean);
                if (window.AdvancedAstroGIS && window.AdvancedAstroGIS.getFeatureRegistry) window.AdvancedAstroGIS.getFeatureRegistry().forEach((entry) => { if (entry.layer && ['weather', 'temperature', 'cloud-condition', 'earthquake', 'wildfire'].includes(entry.type)) candidates.push(entry.layer); });
                hiddenLayers = Array.from(new Set(candidates)).map((layer) => ({ layer, visible: layer.getVisible() }));
                hiddenLayers.forEach(({ layer }) => { layer.setVisible(false); hiddenLayerKeys.push(layer.on('change:visible', () => { if (weather.enabled && layer.getVisible()) layer.setVisible(false); })); });
            } else {
                hiddenLayerKeys.forEach((key) => ol.Observable.unByKey(key)); hiddenLayerKeys = [];
                hiddenLayers.forEach(({ layer, visible }) => layer.setVisible(visible)); hiddenLayers = [];
            }
        }
        function setEnabled(enabled) {
            enabled = Boolean(enabled);
            if (enabled === weather.enabled) { publish(); return; }
            weather.enabled = enabled;
            if (enabled) {
                if (window.AdvancedAstroGIS) window.AdvancedAstroGIS.hidePopup();
                mapFocus(true); state.layers.weatherOverlay.setVisible(true); state.layers.weatherOverlay.setOpacity(weather.opacity);
                pointLayer.setVisible(true); publish(); loadAndRender();
                stormTimer = setInterval(() => { if (weather.enabled && !document.hidden) { loadAndRender(true, true); refreshPoint(); } }, 300000);
            } else {
                ++revision; ++pointRevision;
                if (abort) abort.abort(); if (pointAbort) pointAbort.abort(); if (searchAbort) searchAbort.abort();
                clearTimeout(moveTimer); stopTimers(); weather.playing = false; weather.loading = false; weather.error = ''; weather.status = 'Cuaca nonaktif';
                clearInterval(stormTimer); stormTimer = null; selectedStormId = '';
                weather.point = null; pointData = null; pointLayer.getSource().clear(); pointLayer.setVisible(false);
                clearLayers(); activeData = null; state.layers.weatherOverlay.setVisible(false); mapFocus(false); publish();
            }
        }
        function updatePoint() {
            if (!pointData || !weather.point || weather.point.kind === 'OBSERVED') return;
            const target = (currentFrame() || {}).time || Date.now();
            const index = pointData.frames.reduce((best, frame, i, frames) => Math.abs(frame.time - target) < Math.abs(frames[best].time - target) ? i : best, 0);
            const frame = pointData.frames[index]; if (!frame) return;
            const labels = ['Suhu', 'Angin', 'Arah angin (dari)', 'Hujan · 1 jam', 'Tutupan awan', 'Tekanan laut', 'Kelembapan'];
            const row = frame.values[0];
            weather.point.time = frame.time;
            weather.point.values = VARIABLES.map((field, i) => ({ label: labels[i], value: formatted(row[field], field) }));
            weather.point.hourly = pointData.frames.slice(index, index + 12).map((f) => ({ time: f.time, temperature: formatted(f.values[0].temperature_2m, 'temperature_2m'), precipitation: formatted(f.values[0].precipitation, 'precipitation'), wind: formatted(f.values[0].wind_speed_10m, 'wind_speed_10m') }));
        }
        async function inspectCoordinate(coordinate, name) {
            if (weather.scope === 'local' && !scope.contains(coordinate)) { weather.error = 'Lokasi di luar ADM0 negara terpilih.'; publish(); return; }
            if (!weather.enabled || !Array.isArray(coordinate)) return;
            const lonLat = ol.proj.toLonLat(coordinate), lat = clamp(lonLat[1], -85, 85), lon = longitude(lonLat[0]);
            if (![lat, lon].every(Number.isFinite)) return;
            selectedStormId = ''; if (stormDisplay) stormDisplay.clearSelection();
            if (pointAbort) pointAbort.abort(); pointAbort = new AbortController(); const id = ++pointRevision;
            pointData = null;
            weather.point = { latitude: lat, longitude: lon, name: name || `${lat.toFixed(3)}, ${lon.toFixed(3)}`, time: null, kind: 'FORECAST', values: [], hourly: [], loading: true, error: '', source: { provider: 'Open-Meteo · ' + ({ best_match: 'Auto', icon: 'DWD ICON', gfs: 'NOAA GFS' }[weather.model]), url: SOURCES.wind.url } };
            pointLayer.getSource().clear(); pointMarker = new ol.Feature({ geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])), kind: 'weather-inspection' }); pointLayer.getSource().addFeature(pointMarker); publish();
            try {
                const key = weather.model + ':' + lat.toFixed(3) + ':' + lon.toFixed(3);
                let entry = pointCache.get(key), data;
                if (entry && entry.expires > Date.now()) data = entry.data;
                else {
                    const points = [{ lat, lon }];
                    data = parseModel(await fetchJson(modelUrl(points, true), pointAbort.signal), { points, width: 1, height: 1 }, [lon, lat, lon, lat]);
                    pointCache.set(key, { data, expires: Date.now() + 300000 });
                    while (pointCache.size > 12) pointCache.delete(pointCache.keys().next().value);
                }
                if (id !== pointRevision || !weather.enabled) return;
                pointData = data; weather.point.loading = false; updatePoint(); publish();
            } catch (error) { if (id === pointRevision && weather.enabled && error.name !== 'AbortError') { weather.point.loading = false; weather.point.error = error.message || 'Prakiraan titik tidak tersedia.'; publish(); } }
        }
        let pointRefreshing = false;
        async function refreshPoint() {
            if (pointRefreshing || !weather.point || weather.point.kind !== 'FORECAST' || weather.point.loading || !pointData) return;
            pointRefreshing = true;
            const id = pointRevision, point = weather.point, lat = point.latitude, lon = point.longitude;
            const controller = new AbortController(); pointAbort = controller;
            const timeout = setTimeout(() => controller.abort(), 20000);
            try {
                const data = parseModel(await fetchJson(modelUrl([{lat, lon}], true), controller.signal), { points: [{lat, lon}], width: 1, height: 1 }, [lon, lat, lon, lat]);
                if (id !== pointRevision || !weather.enabled || weather.point !== point) return;
                const changed = dataSignature(data) !== dataSignature(pointData);
                pointData = data;
                if (changed || point.error) { point.error = ''; updatePoint(); publish(); }
            } catch (error) {
                if (id === pointRevision && weather.enabled && weather.point === point) { point.error = 'Pembaruan gagal; data titik terakhir tetap ditampilkan.'; publish(); }
            } finally { clearTimeout(timeout); pointRefreshing = false; }
        }
        function handleMapClick(event) {
            if (!weather.enabled) return false;
            let contextMarker = false;
            state.map.forEachFeatureAtPixel(event.pixel, (feature) => {
                if (['building', 'ip-provider', 'kaabah'].includes(feature.get('kind'))) { contextMarker = true; return true; }
                return undefined;
            }, { hitTolerance: 6 });
            if (contextMarker) return false;
            if (weather.layer === 'storm' && stormDisplay.handleMapClick(event)) return true;
            let storm = null;
            state.map.forEachFeatureAtPixel(event.pixel, (feature) => { if (feature.get('kind') === 'weather-storm') { storm = feature; return true; } return undefined; }, { hitTolerance: 8 });
            if (storm) {
                stormDisplay.select(storm);
                return true;
            } else inspectCoordinate(event.coordinate);
            return true;
        }
        async function searchPlaces(query) {
            if (searchAbort) searchAbort.abort(); searchAbort = new AbortController();
            if (!weather.enabled || String(query).trim().length < 2) return [];
            const payload = await fetchJson('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(String(query).trim()) + '&count=6&language=id&format=json', searchAbort.signal);
            return (payload.results || []).filter((p) => numeric(p.latitude) !== null && numeric(p.longitude) !== null).map((p) => ({ name: String(p.name || ''), latitude: Number(p.latitude), longitude: Number(p.longitude), country: [p.admin1, p.country].filter(Boolean).join(', ') }));
        }
        function goToPlace(place) {
            if (!weather.enabled || !place || numeric(place.latitude) === null || numeric(place.longitude) === null) return;
            const coordinate = ol.proj.fromLonLat([longitude(Number(place.longitude)), clamp(Number(place.latitude), -80, 80)]);
            state.map.getView().animate({ center: coordinate, zoom: 7, duration: 400 }); inspectCoordinate(coordinate, place.name);
        }
        function bind() {
            if (bound || !state.map) return; bound = true;
            rasterPlayer = window.MpmWeatherRasterPlayer.init({ ol, map: state.map, layers: state.layers.weatherOverlay.getLayers(), onChange: (snapshot) => {
                if (!weather.enabled || !['rain', 'cloud'].includes(weather.layer)) return;
                weather.error = snapshot.error;
                weather.status = (snapshot.loading ? 'Memuat frame berikutnya' : (weather.layer === 'rain' ? 'RADAR PENGAMATAN' : 'SATELIT HARIAN'))
                    + (snapshot.displayedTime ? ' · ditampilkan ' + dateLabel(snapshot.displayedTime) : ''); publish();
            } });
            stormDisplay = window.MpmWeatherStorms.init({ ol, map: state.map, onSelect: (feature, selection) => {
                if (!weather.enabled || weather.layer !== 'storm' || !selection) return;
                if (pointAbort) pointAbort.abort(); ++pointRevision; pointData = null; pointLayer.getSource().clear();
                const coordinate = ol.proj.toLonLat(feature.getGeometry().getCoordinates());
                selectedStormId = selection.id;
                weather.point = { name: selection.name, longitude: coordinate[0], latitude: coordinate[1], kind: 'OBSERVED',
                    time: selection.observedAt, values: selection.values || [], hourly: [], loading: selection.loading, error: selection.error || '',
                    notes: selection.notes || [], storm: selection, source: { provider: selection.sourceName || 'NOAA / NHC', url: selection.sourceUrl || SOURCES.storm.url } };
                publish();
            }, onStatus: (message) => { if (weather.enabled && weather.layer === 'storm') { weather.status = message; publish(); } } });
            pointLayer = new ol.layer.Vector({ source: new ol.source.Vector(), visible: false, zIndex: 91,
                style: new ol.style.Style({ image: new ol.style.Circle({ radius: 6, fill: new ol.style.Fill({ color: '#102d4b' }), stroke: new ol.style.Stroke({ color: '#fff', width: 3 }) }) }) });
            state.map.addLayer(pointLayer);
            const events = { weatherOverlayToggle: ['change', (event) => setEnabled(event.target.checked)], weatherExplorerOpenButton: ['click', () => setEnabled(true)],
                weatherLayerSelect: ['change', (event) => api.setLayer(event.target.value)], weatherScopeSelect: ['change', (event) => api.setScope(event.target.value)],
                weatherSpeedSelect: ['change', (event) => api.setSpeed(event.target.value)], weatherFrameSlider: ['input', (event) => api.setFrame(Number(event.target.value))],
                weatherPreviousButton: ['click', () => api.setFrame(weather.frame - 1)], weatherNextButton: ['click', () => api.setFrame(weather.frame + 1)],
                weatherPlayToggle: ['click', () => setPlaying(!weather.playing)] };
            Object.entries(events).forEach(([id, [event, listener]]) => { const node = byId(id); if (node) node.addEventListener(event, listener); });
            scope.bind(state.layers.weatherOverlay, () => weather.scope === 'local');
            scope.subscribe(() => { if (weather.enabled && weather.scope === 'local') { selectedStormId = ''; weather.point = null; pointData = null; if (pointAbort) pointAbort.abort(); ++pointRevision; if (pointLayer) pointLayer.getSource().clear(); if (stormDisplay) stormDisplay.clear(); loadAndRender(); } else publish(); });
            state.map.on('moveend', () => { if (weather.enabled && ['rain', 'cloud'].includes(weather.layer)) render(); });
            document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });
            window.addEventListener('pagehide', () => { if (weather.enabled) setEnabled(false); });
            if (window.MpmWeatherExplorer) window.MpmWeatherExplorer.mount({ controller: api, map: state.map });
            publish();
        }
        const api = {
            bind, setEnabled, render, load: () => weather.enabled ? loadAndRender() : Promise.resolve(), getState, getLayer: () => state.layers.weatherOverlay,
            getFieldData: () => activeData, getRasterState: () => rasterPlayer && rasterPlayer.getState(), getStormState: () => stormDisplay && stormDisplay.getState(), handleMapClick, inspectCoordinate, searchPlaces, goToPlace,
            goToObserver: () => { const point = observer(); goToPlace({ latitude: point.lat, longitude: point.lon, name: 'Lokasi pengamat' }); },
            setLayer: (key) => { if (!FIELDS[key] && !SOURCES[key]) return; if (weather.layer === 'storm' && key !== 'storm') api.closePoint(); weather.layer = key; persist(); if (weather.enabled) loadAndRender(); else publish(); },
            setScope: (value) => { weather.scope = value === 'global' ? 'global' : 'local'; selectedStormId = ''; if (stormDisplay) stormDisplay.clear(); weather.point = null; pointData = null; if (pointLayer) pointLayer.getSource().clear(); persist(); if (weather.enabled) loadAndRender(); else publish(); },
            setModel: (model) => { if (!MODEL_IDS[model]) return; weather.model = model; persist(); if (weather.enabled) { if (isModel(weather.layer)) loadAndRender(); if (weather.point && weather.point.kind !== 'OBSERVED') inspectCoordinate(ol.proj.fromLonLat([weather.point.longitude, weather.point.latitude]), weather.point.name); } publish(); },
            setUnitSystem: (value) => { weather.unitSystem = value === 'imperial' ? 'imperial' : 'metric'; persist(); updatePoint(); publish(); },
            setOpacity: (value) => { if (numeric(value) === null) return; weather.opacity = clamp(Number(value), 0, 1); if (state.layers.weatherOverlay) state.layers.weatherOverlay.setOpacity(weather.opacity); persist(); publish(); },
            setSpeed: (speed) => { weather.speed = clamp(numeric(speed) ?? 800, 300, 3000); persist(); setPlaying(weather.playing); },
            setWindMotion: (enabled) => { weather.windMotion = Boolean(enabled); setPlaying(weather.playing); },
            setStormForecastTime: (time) => { if (stormDisplay) stormDisplay.setForecastTime(Number(time)); },
            focusStorm: (id) => {
                if (!weather.enabled || weather.layer !== 'storm' || !activeData) return;
                const feature = activeData.features.filter(inScope).find((item) => item.get('recordId') === id);
                if (!feature || feature.getGeometry().getType() !== 'Point') return;
                state.map.getView().animate({ center: feature.getGeometry().getCoordinates(), zoom: 5, duration: 400 });
                stormDisplay.select(feature);
            },
            setFrame: (frame) => { setPlaying(false); weather.frame = clamp(Math.round(numeric(frame) ?? 0), 0, Math.max(0, frameList().length - 1)); weather.error = ''; render(); },
            setBasemap: (key) => { const button = Array.from(document.querySelectorAll('.map-tools [data-basemap], .astro-map-drawer [data-basemap]')).find((item) => item.dataset.basemap === key); if (!button || !state.layers[key]) return; button.click(); publish(); },
            setPlaying, refresh: () => loadAndRender(true), closePoint: () => { if (pointAbort) pointAbort.abort(); ++pointRevision; weather.point = null; pointData = null; selectedStormId = ''; if (stormDisplay) stormDisplay.clearSelection(); if (pointLayer) pointLayer.getSource().clear(); publish(); }
        };
        return api;
    }
    window.MpmWeatherOverlays = { SOURCES, init };
}());
