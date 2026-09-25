(function () {
    'use strict';

    const ICONS = {
        tornado: 'map/weather/tornado.gif',
        hurricane: 'map/weather/hurricane.gif',
        'tropical-cyclone': 'map/weather/tropical-dcbd.gif'
    };
    const LABELS = { tornado: 'Tornado', hurricane: 'Hurricane', 'tropical-cyclone': 'Tropical cyclone' };
    const PRODUCTS = ['observedPoints', 'observedTrack', 'forecastPoints', 'forecastTrack', 'cone', 'windAreas', 'currentWindAreas'];
    const CACHE_MS = 5 * 60 * 1000;
    const finite = (value) => value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
    const time = (value) => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) ? (value < 1e12 ? value * 1000 : value) : null;
        const parsed = Date.parse(String(value));
        return Number.isFinite(parsed) ? parsed : null;
    };
    const dateLabel = (value) => Number.isFinite(value) ? new Date(value).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'Waktu tidak tersedia';
    const numberLabel = (value, unit) => Number.isFinite(value) ? value.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' ' + unit : 'Tidak tersedia';
    const unique = (items) => Array.from(new Set(items.filter(Boolean)));

    function classify(feature) {
        const record = feature.get('record') || {};
        const alert = record.alert && (record.alert.properties || record.alert) || {};
        const values = [feature.get('stormType'), record.classification, record.type, alert.event].map((value) => String(value || '').toLowerCase().trim());
        if (values.some((value) => /\btornado\b/.test(value))) return 'tornado';
        if (values.some((value) => value === 'hu' || value === 'hurricane' || /^hurricane\s/.test(value))) return 'hurricane';
        return 'tropical-cyclone';
    }

    function init(options) {
        const { ol, map } = options;
        const notify = typeof options.onSelect === 'function' ? options.onSelect : function () {};
        const status = typeof options.onStatus === 'function' ? options.onStatus : function () {};
        const baseline = new ol.source.Vector({ wrapX: true });
        const guidance = new ol.source.Vector({ wrapX: true });
        let selectedFeature = null, selection = null, selectedId = '', request = null, revision = 0, active = false;
        let selectedData = null, guidanceFeatures = [], requestedForecastTime = null;
        const markers = new Map(), cache = new Map(), styles = new Map();
        const idOf = (feature) => String(feature && (feature.get('recordId') || (feature.get('record') || {}).id || feature.getId() || feature.get('label')) || '');

        function style(feature) {
            const product = feature.get('weatherStormProduct') || 'observedTrack';
            const threshold = finite(feature.get('windThresholdKt')) || 34;
            const key = product + ':' + threshold;
            if (styles.has(key)) return styles.get(key);
            let stroke = '#6ae9df', fill = 'rgba(90, 210, 201, 0.12)', width = 2, dash;
            if (product === 'forecastTrack' || product === 'forecastPoints') { stroke = '#ffdc86'; dash = [8, 6]; }
            if (product === 'cone') { stroke = '#f5d182'; fill = 'rgba(245, 209, 130, 0.09)'; dash = [5, 5]; width = 1.5; }
            if (product === 'windAreas' || product === 'currentWindAreas') {
                stroke = threshold >= 64 ? '#ff667d' : threshold >= 50 ? '#ffac64' : '#e8d36d';
                const rgb = threshold >= 64 ? '255,102,125' : threshold >= 50 ? '255,172,100' : '232,211,109';
                fill = 'rgba(' + rgb + ',' + (product === 'currentWindAreas' ? '0.16' : '0.10') + ')';
                if (product === 'windAreas') dash = [7, 4];
            }
            if (product === 'warning') { stroke = '#ff577b'; fill = 'rgba(255, 87, 123, 0.17)'; width = 2.5; }
            const result = new ol.style.Style({
                stroke: new ol.style.Stroke({ color: stroke, width, lineDash: dash }),
                fill: new ol.style.Fill({ color: fill }),
                image: new ol.style.Circle({ radius: product === 'forecastPoints' ? 3 : 3.5, fill: new ol.style.Fill({ color: stroke }), stroke: new ol.style.Stroke({ color: '#122b3b', width: 1.3 }) })
            });
            styles.set(key, result);
            return result;
        }

        const layer = new ol.layer.Group({ layers: [
            new ol.layer.Vector({ source: guidance, style, zIndex: 63 }),
            new ol.layer.Vector({ source: baseline, style, zIndex: 64 })
        ], zIndex: 63 });
        layer.set('kind', 'weather-storm-guidance');

        function wrappedCoordinate(coordinate) {
            const center = map.getView().getCenter() || coordinate;
            const extent = map.getView().getProjection().getExtent();
            if (!extent || !map.getView().getProjection().canWrapX()) return coordinate.slice();
            const width = extent[2] - extent[0];
            return [coordinate[0] + Math.round((center[0] - coordinate[0]) / width) * width, coordinate[1]];
        }

        function updateVisibility() {
            const size = map.getSize();
            markers.forEach((marker) => {
                const coordinate = wrappedCoordinate(marker.feature.getGeometry().getCoordinates());
                const pixel = map.getPixelFromCoordinate(coordinate);
                const visible = active && size && pixel && pixel[0] >= -24 && pixel[0] <= size[0] + 24 && pixel[1] >= -24 && pixel[1] <= size[1] + 24;
                marker.element.hidden = !visible;
                marker.overlay.setPosition(visible ? coordinate : undefined);
                // The original GIFs are large. Fetch a type only once its marker enters the viewport.
                if (visible && !marker.image.hasAttribute('src')) marker.image.src = ICONS[marker.type];
            });
        }

        function removeMarker(marker) {
            marker.image.removeAttribute('src');
            marker.image.onload = marker.image.onerror = null;
            marker.overlay.setPosition(undefined);
            map.removeOverlay(marker.overlay);
            marker.element.remove();
        }

        function makeMarker(feature, id) {
            const element = document.createElement('button');
            element.type = 'button';
            element.className = 'wx-storm-marker';
            element.dataset.stormId = id;
            element.hidden = true;
            const fallback = document.createElement('span');
            fallback.className = 'wx-storm-marker-fallback';
            fallback.setAttribute('aria-hidden', 'true');
            const image = document.createElement('img');
            image.width = image.height = 22;
            image.alt = '';
            image.decoding = 'async';
            image.loading = 'lazy';
            image.setAttribute('fetchpriority', 'low');
            image.draggable = false;
            element.append(fallback, image);
            image.onload = () => element.classList.add('is-loaded');
            image.onerror = () => { element.classList.remove('is-loaded'); element.classList.add('has-image-error'); };
            const overlay = new ol.Overlay({ element, positioning: 'center-center', stopEvent: true, insertFirst: false });
            const marker = { feature, element, image, fallback, overlay, type: '' };
            element.addEventListener('click', (event) => { event.stopPropagation(); select(marker.feature); });
            map.addOverlay(overlay);
            return marker;
        }

        function setMarker(marker, feature, id) {
            const type = classify(feature);
            marker.feature = feature;
            if (marker.type !== type) {
                marker.image.removeAttribute('src');
                marker.element.classList.remove('is-loaded', 'has-image-error');
                marker.type = type;
            }
            marker.element.dataset.stormType = type;
            marker.fallback.textContent = type === 'tornado' ? 'T' : type === 'hurricane' ? 'H' : 'TC';
            const record = feature.get('record') || {};
            const isWarning = type === 'tornado' && Boolean(record.warningGeometry);
            const label = String(feature.get('label') || record.name || LABELS[type]);
            marker.element.setAttribute('aria-label', label + ' · ' + LABELS[type] + (isWarning ? ' · penanda area peringatan' : '') + ' · buka lintasan dan area');
            marker.element.title = label + ' · ' + LABELS[type] + (isWarning ? ' · area peringatan' : '');
            marker.element.classList.toggle('is-selected', id === selectedId);
        }

        function render(features) {
            active = true;
            const wanted = new Set();
            baseline.clear();
            (features || []).forEach((feature) => {
                const geometry = feature && feature.getGeometry && feature.getGeometry();
                if (!geometry) return;
                if (geometry.getType() !== 'Point') {
                    const copy = feature.clone();
                    copy.set('weatherStormProduct', feature.get('weatherStormProduct') || 'observedTrack');
                    baseline.addFeature(copy);
                    return;
                }
                const id = idOf(feature);
                if (!id || wanted.has(id) || !geometry.getCoordinates().slice(0, 2).every(Number.isFinite)) return;
                wanted.add(id);
                const marker = markers.get(id) || makeMarker(feature, id);
                markers.set(id, marker);
                setMarker(marker, feature, id);
            });
            markers.forEach((marker, id) => { if (!wanted.has(id)) { removeMarker(marker); markers.delete(id); } });
            updateVisibility();
            if (selectedId && markers.has(selectedId)) select(markers.get(selectedId).feature, { refresh: true });
            else if (selectedId) {
                cancelSelection();
                notify(null, null);
            }
        }

        function normalizedGeometry(geometry, anchor) {
            if (!geometry || !geometry.type) return null;
            const point = (coordinate, reference) => {
                if (!Array.isArray(coordinate) || !coordinate.slice(0, 2).every((value) => typeof value === 'number' && Number.isFinite(value)) || Math.abs(coordinate[1]) > 90) throw new Error('Koordinat produk tidak valid.');
                return [coordinate[0] + Math.round((reference - coordinate[0]) / 360) * 360, Math.max(-85.05112878, Math.min(85.05112878, coordinate[1]))];
            };
            const line = (coordinates) => {
                let reference = anchor;
                return coordinates.map((coordinate) => { const result = point(coordinate, reference); reference = result[0]; return result; });
            };
            switch (geometry.type) {
                case 'Point': return { type: geometry.type, coordinates: point(geometry.coordinates, anchor) };
                case 'MultiPoint': return { type: geometry.type, coordinates: geometry.coordinates.map((coordinate) => point(coordinate, anchor)) };
                case 'LineString': return { type: geometry.type, coordinates: line(geometry.coordinates) };
                case 'MultiLineString': case 'Polygon': return { type: geometry.type, coordinates: geometry.coordinates.map(line) };
                case 'MultiPolygon': return { type: geometry.type, coordinates: geometry.coordinates.map((polygon) => polygon.map(line)) };
                case 'GeometryCollection': return { type: geometry.type, geometries: geometry.geometries.map((child) => normalizedGeometry(child, anchor)).filter(Boolean) };
                default: return null;
            }
        }

        function readProduct(collection, product, feature) {
            const origin = ol.proj.toLonLat(feature.getGeometry().getCoordinates())[0];
            const list = collection && collection.type === 'FeatureCollection' ? collection.features : collection && collection.type === 'Feature' ? [collection] : [];
            const result = [];
            list.forEach((item) => {
                try {
                    const geometry = normalizedGeometry(item.geometry, origin);
                    if (!geometry) return;
                    const copy = new ol.format.GeoJSON().readFeature({ type: 'Feature', properties: item.properties || {}, geometry }, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
                    copy.set('kind', 'weather-storm-guidance');
                    copy.set('weatherStormProduct', product);
                    copy.set('weatherStormId', idOf(feature));
                    result.push(copy);
                } catch (_) { /* A malformed product must not remove valid guidance from the same advisory. */ }
            });
            return result;
        }

        function area(geometry) {
            if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.getType())) return null;
            const value = ol.sphere.getArea(geometry, { projection: 'EPSG:3857' }) / 1e6;
            return Number.isFinite(value) ? Math.abs(value) : null;
        }

        function trackLength(features) {
            const lines = features.filter((feature) => ['LineString', 'MultiLineString'].includes(feature.getGeometry().getType()));
            if (!lines.length) return null;
            return lines.reduce((sum, feature) => sum + ol.sphere.getLength(feature.getGeometry(), { projection: 'EPSG:3857' }) / 1000, 0);
        }

        function areaRows(features) {
            return features.map((feature) => ({
                validAt: time(feature.get('validAt')),
                thresholdKt: finite(feature.get('windThresholdKt')),
                forecastHour: finite(feature.get('forecastHour')),
                areaKm2: area(feature.getGeometry())
            })).filter((row) => row.areaKm2 !== null);
        }

        function selectedRows(rows) {
            return rows.filter((row) => requestedForecastTime === null || row.validAt === requestedForecastTime);
        }

        function updateGuidanceVisibility() {
            guidance.clear();
            guidance.addFeatures(guidanceFeatures.filter((feature) => {
                if (feature.get('weatherStormProduct') !== 'windAreas') return true;
                return requestedForecastTime === null || time(feature.get('validAt')) === requestedForecastTime;
            }));
        }

        function baseSelection(feature) {
            const record = feature.get('record') || {};
            const type = classify(feature);
            const alert = record.alert && (record.alert.properties || record.alert) || {};
            const values = [{ label: 'Jenis sistem', value: LABELS[type] }];
            const intensity = finite(record.intensity), pressure = finite(record.pressure), speed = finite(record.movementSpeed), direction = finite(record.movementDir);
            if (type !== 'tornado') {
                values.push({ label: 'Angin berkelanjutan', value: intensity === null ? 'Tidak tersedia' : numberLabel(intensity, 'kt') + ' · ' + numberLabel(intensity * 1.852, 'km/h') });
                values.push({ label: 'Tekanan', value: numberLabel(pressure, 'hPa') });
                values.push({ label: 'Kecepatan gerak dilaporkan', value: speed === null ? 'Tidak tersedia' : numberLabel(speed * 1.609344, 'km/h') });
                values.push({ label: 'Arah gerak dilaporkan', value: direction === null ? 'Tidak tersedia' : numberLabel(direction, '°') });
            } else {
                const detection = alert.parameters && alert.parameters.tornadoDetection;
                if (detection) values.push({ label: 'Deteksi pada peringatan', value: Array.isArray(detection) ? detection.join(', ') : String(detection) });
                if (alert.expires) values.push({ label: 'Peringatan berlaku sampai', value: dateLabel(time(alert.expires)) });
            }
            return {
                id: idOf(feature), name: String(feature.get('label') || record.name || LABELS[type]), type,
                coordinate: ol.proj.toLonLat(feature.getGeometry().getCoordinates()),
                observedAt: time(record.lastUpdate || alert.sent || alert.effective),
                loading: false, error: '', status: '', values, notes: [],
                sourceName: type === 'tornado' ? 'NOAA / NWS' : 'NOAA / NHC',
                sourceUrl: type === 'tornado' ? 'https://www.weather.gov/' : 'https://www.nhc.noaa.gov/gis/',
                metrics: { observedDistanceKm: null, forecastDistanceKm: null, coneAreaKm2: null, coneAreasKm2: [], windAreas: [], currentWindAreas: [], warningAreaKm2: null },
                forecastTimes: [], forecastTime: null, updatedAt: null, stale: false
            };
        }

        function summarize(data, feature, metadata) {
            const next = baseSelection(feature);
            const groups = {};
            PRODUCTS.forEach((product) => { groups[product] = readProduct(data[product], product, feature); });
            guidanceFeatures = PRODUCTS.flatMap((product) => groups[product]);
            const metrics = next.metrics;
            metrics.observedDistanceKm = trackLength(groups.observedTrack);
            metrics.forecastDistanceKm = trackLength(groups.forecastTrack);
            metrics.coneAreasKm2 = groups.cone.map((item) => area(item.getGeometry())).filter((value) => value !== null);
            // Multiple cones can overlap. Never add them and present the sum as an impacted area.
            metrics.coneAreaKm2 = metrics.coneAreasKm2.length === 1 ? metrics.coneAreasKm2[0] : null;
            metrics.windAreas = areaRows(groups.windAreas);
            metrics.currentWindAreas = areaRows(groups.currentWindAreas);
            next.forecastTimes = unique(metrics.windAreas.map((row) => row.validAt)).sort((a, b) => a - b);
            if (!next.forecastTimes.includes(requestedForecastTime)) {
                requestedForecastTime = next.forecastTimes.find((value) => value >= Date.now()) ?? next.forecastTimes[0] ?? null;
            }
            next.forecastTime = requestedForecastTime;
            next.updatedAt = time(metadata.fetchedAt) || time(data.issuedAt);
            next.stale = Boolean(metadata.stale || data.stale);
            next.status = data.status === 'partial' ? 'Sebagian produk lintasan / area belum tersedia.' : 'Lintasan dan area resmi · diperbarui setiap 5 menit';
            next.sourceUrl = /^https:\/\//i.test(data.sourceUrl || '') ? data.sourceUrl : next.sourceUrl;
            const noteTranslations = {
                'The cone describes uncertainty in the forecast center track, not the full affected area or a location-specific impact probability.': 'Kerucut kuning menunjukkan ketidakpastian lintasan pusat badai; luasnya bukan luas dampak dan bukan peluang dampak di suatu titik.',
                'Wind polygons show official maximum wind extents at the stated threshold and valid time. Not every location inside experiences that wind speed.': 'Area angin mengikuti ambang kecepatan dan waktu produk NHC. Area tiap ambang dapat bertumpang tindih; bukan perkiraan kerusakan atau seluruh bahaya badai.',
                'Observed tracks are preliminary best-track positions. Forecast positions are not observations.': 'Lintasan teramati merupakan posisi awal hasil analisis NHC. Posisi prakiraan belum merupakan pengamatan.',
                'Coverage is limited to the NHC and CPHC products available in this official service.': 'Produk mengikuti cakupan layanan NHC/CPHC.'
            };
            next.notes = (Array.isArray(data.notes) ? data.notes : []).map((note) => noteTranslations[note] || String(note));
            next.notes.push('Garis hijau: lintasan teramati. Garis kuning putus-putus: prakiraan lintasan pusat badai.');
            if (metrics.coneAreasKm2.length) next.notes.push('Kerucut kuning menunjukkan ketidakpastian lintasan pusat badai; luasnya bukan luas dampak dan bukan peluang dampak di suatu titik.');
            if (metrics.windAreas.length || metrics.currentWindAreas.length) next.notes.push('Area angin mengikuti ambang kecepatan dan waktu produk NHC. Area tiap ambang dapat bertumpang tindih; bukan perkiraan kerusakan atau seluruh bahaya badai.');
            if (next.stale) next.notes.push('Menampilkan produk tersimpan; pembaruan sumber belum tersedia.');
            if (!guidanceFeatures.length) next.notes.push('Lintasan dan area resmi belum tersedia untuk sistem ini; posisi dan kecepatan laporan tetap ditampilkan.');
            if (metrics.observedDistanceKm !== null) next.values.push({ label: 'Panjang lintasan teramati', value: numberLabel(metrics.observedDistanceKm, 'km') });
            if (metrics.forecastDistanceKm !== null) next.values.push({ label: 'Panjang lintasan prakiraan', value: numberLabel(metrics.forecastDistanceKm, 'km') });
            metrics.coneAreasKm2.forEach((value, index) => next.values.push({ label: 'Luas kerucut ketidakpastian pusat' + (metrics.coneAreasKm2.length > 1 ? ' ' + (index + 1) : ''), value: numberLabel(value, 'km²') }));
            const appendArea = (row, prefix) => next.values.push({ label: prefix + (row.thresholdKt === null ? '' : ' ≥ ' + row.thresholdKt + ' kt'), value: numberLabel(row.areaKm2, 'km²') });
            metrics.currentWindAreas.forEach((row) => appendArea(row, 'Luas angin saat advisori'));
            if (next.forecastTime !== null) next.values.push({ label: 'Waktu area angin prakiraan', value: dateLabel(next.forecastTime) });
            selectedRows(metrics.windAreas).forEach((row) => appendArea(row, 'Luas angin prakiraan'));
            if (time(data.issuedAt) !== null) next.values.push({ label: 'Produk diterbitkan', value: dateLabel(time(data.issuedAt)) });
            next.notes = unique(next.notes);
            updateGuidanceVisibility();
            return next;
        }

        function emit() {
            if (!selection || !selectedFeature) return;
            markers.forEach((marker, id) => marker.element.classList.toggle('is-selected', id === selectedId));
            notify(selectedFeature, selection);
            if (selection.status) status(selection.status);
        }

        function cancelSelection() {
            ++revision;
            if (request) request.abort();
            request = null;
            selectedFeature = null; selectedId = ''; selection = null; selectedData = null;
            requestedForecastTime = null; guidanceFeatures = []; guidance.clear();
            markers.forEach((marker) => marker.element.classList.remove('is-selected'));
        }

        async function select(feature, settings) {
            if (!active || !feature || !feature.getGeometry() || feature.getGeometry().getType() !== 'Point') return null;
            const id = idOf(feature);
            if (!id) return null;
            const same = id === selectedId;
            if (request) request.abort();
            const generation = ++revision;
            if (!same) { guidance.clear(); guidanceFeatures = []; selectedData = null; requestedForecastTime = null; }
            selectedFeature = feature; selectedId = id;
            selection = same && selection ? Object.assign({}, selection) : baseSelection(feature);
            if (classify(feature) === 'tornado') {
                const record = feature.get('record') || {};
                const alert = record.alert && (record.alert.properties || record.alert) || {};
                selection = baseSelection(feature);
                const geometry = record.warningGeometry || (record.alert && record.alert.geometry);
                guidanceFeatures = readProduct(geometry ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry }] } : null, 'warning', feature);
                selection.metrics.warningAreaKm2 = guidanceFeatures.length === 1 ? area(guidanceFeatures[0].getGeometry()) : null;
                if (selection.metrics.warningAreaKm2 !== null) selection.values.push({ label: 'Luas area peringatan tornado', value: numberLabel(selection.metrics.warningAreaKm2, 'km²') });
                selection.notes = ['Ikon menandai area peringatan tornado, bukan posisi tornado yang terukur. Poligon menunjukkan wilayah peringatan resmi; bukan jejak tornado atau peluang kerusakan.'];
                if (alert.headline) selection.notes.push(String(alert.headline));
                if (!geometry) selection.notes.push('Poligon peringatan belum tersedia; tidak membuat radius atau lintasan perkiraan.');
                selection.status = 'Peringatan tornado NWS · ' + (selection.observedAt !== null ? dateLabel(selection.observedAt) : 'waktu penerbitan tidak tersedia');
                selection.updatedAt = selection.observedAt;
                updateGuidanceVisibility(); emit(); return selection;
            }
            if (!/^(al|ep|cp)\d{6}$/i.test(id)) {
                selection.loading = false;
                selection.notes = ['Produk lintasan dan area resmi belum tersedia untuk identitas sistem ini.'];
                selection.status = 'Posisi sistem tersedia; panduan lintasan belum tersedia.';
                emit(); return selection;
            }
            const cached = cache.get(id);
            if (cached && Date.now() - cached.savedAt < CACHE_MS && !(settings && settings.refresh)) {
                selectedData = cached;
                selection = summarize(cached.data, feature, cached.metadata); emit(); return selection;
            }
            selection.loading = true; selection.error = ''; selection.status = 'Memuat lintasan dan area resmi ' + selection.name + '…'; emit();
            request = new AbortController();
            const currentRequest = request;
            const external = settings && settings.signal;
            const externalAbort = () => currentRequest.abort();
            if (external) { if (external.aborted) currentRequest.abort(); else external.addEventListener('abort', externalAbort, { once: true }); }
            try {
                const response = await fetch('api/weather-map-proxy.php?source=storm-guidance&storm=' + encodeURIComponent(id), { signal: currentRequest.signal, headers: { Accept: 'application/json' } });
                if (!response.ok) throw new Error('Produk lintasan dan area belum dapat diakses.');
                const result = await response.json();
                if (!result.success || !result.data || String(result.data.stormId || '').toLowerCase() !== id.toLowerCase()) throw new Error('Produk tidak cocok dengan badai yang dipilih.');
                if (!active || generation !== revision || currentRequest.signal.aborted) return null;
                selectedData = { data: result.data, metadata: { stale: Boolean(result.stale), fetchedAt: result.fetchedAt }, savedAt: Date.now() };
                cache.set(id, selectedData);
                while (cache.size > 8) cache.delete(cache.keys().next().value);
                selection = summarize(selectedData.data, feature, selectedData.metadata);
                emit(); return selection;
            } catch (error) {
                if (!active || generation !== revision || currentRequest.signal.aborted || error.name === 'AbortError') return null;
                if (cached) {
                    selectedData = cached;
                    selection = summarize(cached.data, feature, Object.assign({}, cached.metadata, { stale: true }));
                }
                selection.loading = false;
                selection.error = error.message || 'Panduan badai belum tersedia.';
                selection.status = cached ? 'Panduan tersimpan · pembaruan belum tersedia.' : 'Posisi tersedia; lintasan dan area belum tersedia.';
                selection.notes = unique(selection.notes.concat('Area atau pergerakan tidak disimulasikan ketika produk resmi belum tersedia.'));
                emit(); return selection;
            } finally {
                if (external) external.removeEventListener('abort', externalAbort);
                if (request === currentRequest) request = null;
            }
        }

        function setForecastTime(value) {
            const requested = time(value);
            if (!selection || !selection.forecastTimes.includes(requested) || !selectedData) return;
            requestedForecastTime = requested;
            selection = summarize(selectedData.data, selectedFeature, selectedData.metadata);
            emit();
        }

        function handleMapClick(event) {
            if (!active) return false;
            let found = null;
            markers.forEach((marker) => {
                const pixel = map.getPixelFromCoordinate(wrappedCoordinate(marker.feature.getGeometry().getCoordinates()));
                if (pixel && !marker.element.hidden && Math.hypot(pixel[0] - event.pixel[0], pixel[1] - event.pixel[1]) <= 14) found = marker.feature;
            });
            if (found) { select(found); return true; }
            map.forEachFeatureAtPixel(event.pixel, (feature) => {
                const id = feature.get('weatherStormId');
                if (id && markers.has(id)) { found = markers.get(id).feature; return true; }
                return undefined;
            }, { hitTolerance: 6, layerFilter: (candidate) => layer.getLayers().getArray().includes(candidate) });
            if (!found) return false;
            select(found);
            return true;
        }

        function clear() {
            active = false;
            cancelSelection();
            markers.forEach(removeMarker); markers.clear();
            baseline.clear();
        }

        const moveListener = map.on('moveend', updateVisibility);
        return {
            render, select, clear, clearSelection: cancelSelection, setForecastTime, handleMapClick,
            getLayer: () => layer,
            getState: () => ({ active, markerCount: markers.size, visibleMarkers: Array.from(markers.values()).filter((marker) => !marker.element.hidden).length,
                markers: Array.from(markers.entries()).map(([id, marker]) => ({ id, type: marker.type, loaded: marker.image.hasAttribute('src'), visible: !marker.element.hidden })),
                selectedId, selection, guidanceFeatures: guidance.getFeatures().length, baselineFeatures: baseline.getFeatures().length }),
            destroy: () => { clear(); ol.Observable.unByKey(moveListener); cache.clear(); }
        };
    }

    window.MpmWeatherStorms = { init, classify, icons: Object.assign({}, ICONS) };
})();
