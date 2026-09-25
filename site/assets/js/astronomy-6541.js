(function () {
    'use strict';

    function actualNow() {
        return window.MpmActualTime && typeof window.MpmActualTime.now === 'function'
            ? window.MpmActualTime.now()
            : new Date();
    }

    const DEFAULT_OBSERVER = {
        lat: -0.13712159010106006,
        lon: 113.43511008403357,
        elevation: 0
    };
    const DEFAULT_CENTER_SHIFT = 0.08;
    const WEB_MERCATOR_MAX = 20037508.342789244;
    const WEB_MERCATOR_EXTENT = [
        -WEB_MERCATOR_MAX,
        -WEB_MERCATOR_MAX,
        WEB_MERCATOR_MAX,
        WEB_MERCATOR_MAX
    ];
    const EARTH_RADIUS_M = 6378137;
    const KM_PER_AU = 149597870.700;
    const DAY_NIGHT_CANVAS = {
        width: 960,
        height: 480
    };
    const ICONS = {
        sun: 'map/astro/sun.png',
        moon: 'map/astro/full-moon.png'
    };
    const ADMIN_ICON_STYLE = {
        minZoom: 2,
        maxZoom: 19,
        zoomInScale: 0.05,
        zoomOutScale: 0.05,
        defaultAnchor: [0.3, 0.83]
    };

    const state = {
        map: null,
        observer: { ...DEFAULT_OBSERVER },
        layers: {},
        features: {},
        overlayOpacity: 0.72,
        moonImage: null,
        eclipseCache: null,
        eclipseCacheDate: '',
        updateTimer: null,
        admLoadGeneration: 0,
        admRequest: { level: 'adm0', world: false, autoLoad: false }
    };

    const COMPASS_16 = [
        { abbr: 'N', id: 'Utara', en: 'North' },
        { abbr: 'NNE', id: 'Utara Timur Laut', en: 'North-northeast' },
        { abbr: 'NE', id: 'Timur Laut', en: 'Northeast' },
        { abbr: 'ENE', id: 'Timur Timur Laut', en: 'East-northeast' },
        { abbr: 'E', id: 'Timur', en: 'East' },
        { abbr: 'ESE', id: 'Timur Tenggara', en: 'East-southeast' },
        { abbr: 'SE', id: 'Tenggara', en: 'Southeast' },
        { abbr: 'SSE', id: 'Selatan Tenggara', en: 'South-southeast' },
        { abbr: 'S', id: 'Selatan', en: 'South' },
        { abbr: 'SSW', id: 'Selatan Barat Daya', en: 'South-southwest' },
        { abbr: 'SW', id: 'Barat Daya', en: 'Southwest' },
        { abbr: 'WSW', id: 'Barat Barat Daya', en: 'West-southwest' },
        { abbr: 'W', id: 'Barat', en: 'West' },
        { abbr: 'WNW', id: 'Barat Barat Laut', en: 'West-northwest' },
        { abbr: 'NW', id: 'Barat Laut', en: 'Northwest' },
        { abbr: 'NNW', id: 'Utara Barat Laut', en: 'North-northwest' }
    ];

    function byId(id) {
        return document.getElementById(id);
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function degToRad(degrees) {
        return degrees * Math.PI / 180;
    }

    function radToDeg(radians) {
        return radians * 180 / Math.PI;
    }

    function normalize360(degrees) {
        return ((degrees % 360) + 360) % 360;
    }

    function normalize180(degrees) {
        const normalized = normalize360(degrees);
        return normalized > 180 ? normalized - 360 : normalized;
    }

    function normalizeLon(longitude) {
        return normalize180(longitude);
    }

    function formatNumber(value, digits) {
        if (!Number.isFinite(value)) {
            return '-';
        }

        return Number(value).toLocaleString('en-US', {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
    }

    function formatKm(value) {
        if (!Number.isFinite(value)) {
            return '-';
        }

        return `${Math.round(value).toLocaleString('en-US')} km`;
    }

    function formatDegrees(value, digits) {
        return `${formatNumber(value, digits)} deg`;
    }

    function formatPercent(value, digits) {
        if (!Number.isFinite(value)) {
            return '-';
        }

        return `${formatNumber(value * 100, digits)}%`;
    }

    function formatDateUtc(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return '-';
        }

        return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
    }

    function formatUtcOffset(hours) {
        const sign = hours >= 0 ? '+' : '-';
        const absoluteHours = Math.abs(hours);
        return `UTC${sign}${String(absoluteHours).padStart(2, '0')}:00`;
    }

    function formatShiftedDate(date, offsetHours) {
        const shifted = new Date(date.getTime() + offsetHours * 3600000);
        return shifted.toISOString().replace('T', ' ').slice(0, 19);
    }

    function getCompassDirection(azimuth) {
        const index = Math.round(normalize360(azimuth) / 22.5) % 16;
        const direction = COMPASS_16[index];
        return `${direction.abbr} / ${direction.id} / ${direction.en}`;
    }

    function getMoonPhaseName(phaseDegrees) {
        const phase = normalize360(phaseDegrees) / 360;

        if (phase < 0.0625 || phase >= 0.9375) {
            return 'Bulan baru / New Moon';
        }
        if (phase < 0.1875) {
            return 'Sabit muda / Waxing Crescent';
        }
        if (phase < 0.3125) {
            return 'Kuartal pertama / First Quarter';
        }
        if (phase < 0.4375) {
            return 'Cembung membesar / Waxing Gibbous';
        }
        if (phase < 0.5625) {
            return 'Purnama / Full Moon';
        }
        if (phase < 0.6875) {
            return 'Cembung mengecil / Waning Gibbous';
        }
        if (phase < 0.8125) {
            return 'Kuartal akhir / Last Quarter';
        }

        return 'Sabit tua / Waning Crescent';
    }

    function safeDateFromAstroTime(value) {
        if (!value) {
            return null;
        }

        if (value instanceof Date) {
            return value;
        }

        if (value.date instanceof Date) {
            return value.date;
        }

        const parsed = new Date(String(value));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function ensureAstronomyReady() {
        if (!window.ol) {
            throw new Error('OpenLayers gagal dimuat.');
        }

        if (window.AstronomyRuntime) {
            window.AstronomyRuntime.requireEngine();
        } else if (!window.Astronomy) {
            throw new Error('Astronomy Engine gagal dimuat.');
        }
    }

    function createMap() {
        const basicLayer = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: window.GisRuntime
                    ? window.GisRuntime.tileUrl('basic', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png')
                    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                attributions: 'OpenStreetMap'
            }),
            title: 'Basic',
            visible: true
        });

        const topoLayer = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
                attributions: 'CyclOSM, OpenStreetMap'
            }),
            title: 'Topography',
            visible: false
        });

        const satelliteLayer = new ol.layer.Group({
            layers: [
                new ol.layer.Tile({
                    source: new ol.source.XYZ({
                        urls: [
                            'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                            'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                            'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                            'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
                        ],
                        tileSize: 256
                    })
                }),
                new ol.layer.Tile({
                    source: new ol.source.XYZ({
                        urls: [
                            'https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png'
                        ],
                        tileSize: 256
                    })
                })
            ],
            title: 'Satellite',
            visible: false
        });

        const dayNightLayer = new ol.layer.Image({
            opacity: state.overlayOpacity,
            zIndex: 10
        });

        const admSource = new ol.source.Vector();
        const admLayer = new ol.layer.Vector({
            source: admSource,
            zIndex: 20,
            style: (feature) => {
                const level = String(feature.get('admLevel') || feature.get('shapeType') || '').toUpperCase();
                const colors = level === 'ADM2'
                    ? ['rgba(255,213,74,.08)', '#ffd54a']
                    : level === 'ADM1'
                        ? ['rgba(255,213,74,.08)', '#ffd54a']
                        : ['rgba(255,213,74,.08)', '#ffd54a'];
                return new ol.style.Style({
                    fill: new ol.style.Fill({ color: colors[0] }),
                    stroke: new ol.style.Stroke({ color: colors[1], width: level === 'ADM0' ? 1.8 : 1.2 })
                });
            }
        });

        const bodySource = new ol.source.Vector();
        const bodyLayer = new ol.layer.Vector({
            source: bodySource,
            zIndex: 30,
            style: getBodyStyle
        });

        const calibrationSource = new ol.source.Vector();
        const calibrationLayer = new ol.layer.Vector({
            source: calibrationSource,
            zIndex: 42,
            style: calibrationFeatureStyle
        });

        state.features.sun = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([0, 0])),
            body: 'sun',
            label: 'Matahari'
        });
        state.features.moon = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([0, 0])),
            body: 'moon',
            label: 'Bulan'
        });
        bodySource.addFeatures([state.features.sun, state.features.moon]);
        state.features.calibrationLine = new ol.Feature({ kind: 'provider-building-calibration', label: 'Provider → Building' });
        state.features.providerCoordinate = new ol.Feature({ kind: 'provider-coordinate', label: 'Provider Coordinate' });
        state.features.buildingCoordinate = new ol.Feature({ kind: 'building-coordinate', label: 'Building Coordinate' });
        calibrationSource.addFeatures([
            state.features.calibrationLine,
            state.features.providerCoordinate,
            state.features.buildingCoordinate
        ]);

        state.layers = {
            basic: basicLayer,
            topography: topoLayer,
            satellite: satelliteLayer,
            dayNight: dayNightLayer,
            adm: admLayer,
            admSource,
            bodies: bodyLayer,
            calibration: calibrationLayer,
            calibrationSource
        };

        state.map = new ol.Map({
            target: 'map',
            layers: [basicLayer, topoLayer, satelliteLayer, dayNightLayer, admLayer, bodyLayer, calibrationLayer],
            view: new ol.View({
                center: ol.proj.fromLonLat([
                    DEFAULT_OBSERVER.lon + DEFAULT_CENTER_SHIFT,
                    DEFAULT_OBSERVER.lat
                ]),
                zoom: 2,
                minZoom: 1,
                maxZoom: 19
            })
        });

        state.map.on('pointermove', handlePointerMove);
        state.map.on('click', handleMapClick);
        renderCalibrationFeatures();
    }

    function calibrationFeatureStyle(feature) {
        const kind = feature.get('kind');
        if (kind === 'provider-building-calibration') {
            return new ol.style.Style({
                stroke: new ol.style.Stroke({ color: '#00FFFF', width: 3, lineDash: [9, 5] })
            });
        }
        const provider = kind === 'provider-coordinate';
        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: provider ? 7 : 8,
                fill: new ol.style.Fill({ color: provider ? '#00caca' : '#176a58' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
            }),
            text: new ol.style.Text({
                text: feature.get('label') || '',
                offsetY: 20,
                font: '700 11px Segoe UI, Arial, sans-serif',
                fill: new ol.style.Fill({ color: '#173a38' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
            })
        });
    }

    function renderCalibrationFeatures() {
        if (!window.MpmTimeCoordinateCalibration || !state.features.calibrationLine) {
            return;
        }
        const calibration = window.MpmTimeCoordinateCalibration.getState();
        const provider = calibration.provider;
        const building = calibration.building;
        const configuration = calibration.configuration || {};
        const providerValid = provider && Number.isFinite(Number(provider.latitude)) && Number.isFinite(Number(provider.longitude));
        const buildingValid = building && Number.isFinite(Number(building.latitude)) && Number.isFinite(Number(building.longitude));
        state.features.providerCoordinate.setGeometry(providerValid
            ? new ol.geom.Point(ol.proj.fromLonLat([Number(provider.longitude), Number(provider.latitude)])) : null);
        state.features.providerCoordinate.set('label', provider ? (provider.name || 'Provider Coordinate') : 'Provider Coordinate');
        state.features.buildingCoordinate.setGeometry(buildingValid
            ? new ol.geom.Point(ol.proj.fromLonLat([Number(building.longitude), Number(building.latitude)])) : null);
        state.features.buildingCoordinate.set('label', building ? (building.name || 'Building Coordinate') : 'Building Coordinate');
        state.features.calibrationLine.setGeometry(providerValid && buildingValid
            && configuration.showComparison !== false && configuration.showCalibrationLine !== false
            ? new ol.geom.LineString([
                ol.proj.fromLonLat([Number(provider.longitude), Number(provider.latitude)]),
                ol.proj.fromLonLat([Number(building.longitude), Number(building.latitude)])
            ]) : null);
        if (state.layers.calibration) {
            state.layers.calibration.changed();
        }
    }

    function adminMatchedIconScale(resolution) {
        const view = state.map && state.map.getView ? state.map.getView() : null;
        let zoom = view && Number.isFinite(resolution) ? view.getZoomForResolution(resolution) : NaN;
        if (!Number.isFinite(zoom)) {
            zoom = view ? view.getZoom() : 8;
        }
        if (!Number.isFinite(zoom)) {
            zoom = 8;
        }

        const normalized = clamp(
            (zoom - ADMIN_ICON_STYLE.minZoom) / (ADMIN_ICON_STYLE.maxZoom - ADMIN_ICON_STYLE.minZoom),
            0,
            1
        );
        const scale = ADMIN_ICON_STYLE.zoomOutScale
            - normalized * (ADMIN_ICON_STYLE.zoomOutScale - ADMIN_ICON_STYLE.zoomInScale);
        const minScale = Math.min(ADMIN_ICON_STYLE.zoomInScale, ADMIN_ICON_STYLE.zoomOutScale);
        const maxScale = Math.max(ADMIN_ICON_STYLE.zoomInScale, ADMIN_ICON_STYLE.zoomOutScale);
        return clamp(scale, minScale, maxScale);
    }

    function getBodyStyle(feature, resolution) {
        const body = feature.get('body');
        const isSun = body === 'sun';
        const scale = adminMatchedIconScale(resolution);

        return new ol.style.Style({
            image: new ol.style.Icon({
                src: isSun ? ICONS.sun : ICONS.moon,
                scale,
                anchor: ADMIN_ICON_STYLE.defaultAnchor,
                anchorXUnits: 'fraction',
                anchorYUnits: 'fraction',
                crossOrigin: 'anonymous'
            }),
            text: new ol.style.Text({
                text: feature.get('label'),
                offsetY: 24,
                font: '700 12px Segoe UI, Arial, sans-serif',
                fill: new ol.style.Fill({ color: '#172033' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
            })
        });
    }

    function bindControls() {
        document.querySelectorAll('.basemap-controls button').forEach((button) => {
            button.addEventListener('click', () => switchBaseLayer(button.dataset.layer));
        });

        byId('applyObserver').addEventListener('click', applyObserverInputs);

        byId('overlayOpacity').addEventListener('input', (event) => {
            state.overlayOpacity = Number(event.target.value) / 100;
            byId('overlayOpacityValue').textContent = `${event.target.value}%`;
            if (state.layers.dayNight) {
                state.layers.dayNight.setOpacity(state.overlayOpacity);
            }
        });

        byId('observerLat').value = DEFAULT_OBSERVER.lat.toFixed(6);
        byId('observerLon').value = DEFAULT_OBSERVER.lon.toFixed(6);
        byId('overlayOpacityValue').textContent = `${byId('overlayOpacity').value}%`;

        byId('loadAstronomyAdm0').addEventListener('click', () => loadAdmBoundary('adm0'));
        byId('loadAstronomyAdm1').addEventListener('click', () => loadAdmBoundary('adm1'));
        byId('loadAstronomyAdm2').addEventListener('click', () => loadAdmBoundary('adm2'));
        byId('clearAstronomyAdm').addEventListener('click', () => {
            state.admLoadGeneration += 1;
            state.layers.admSource.clear();
            setAdmStatus('Boundary ADM dibersihkan.');
        });

        const requestedCountry = new URLSearchParams(window.location.search).get('country');
        if (requestedCountry && /^[A-Za-z]{2,3}$/.test(requestedCountry)) {
            byId('admCountryCode').value = requestedCountry.toUpperCase();
        }
        const requestedAdm1 = new URLSearchParams(window.location.search).get('adm1');
        if (requestedAdm1) byId('adm1BoundaryName').value = requestedAdm1;
        const requestedLevel = String(new URLSearchParams(window.location.search).get('level') || 'adm0').toLowerCase();
        state.admRequest.level = ['adm0', 'adm1', 'adm2'].includes(requestedLevel) ? requestedLevel : 'adm0';
        state.admRequest.autoLoad = Boolean(requestedCountry || new URLSearchParams(window.location.search).has('level'));

        window.addEventListener('online', reloadAdmBoundary);
        window.addEventListener('offline', reloadAdmBoundary);
    }

    function switchBaseLayer(layerKey) {
        ['basic', 'topography', 'satellite'].forEach((key) => {
            state.layers[key].setVisible(key === layerKey);
        });

        document.querySelectorAll('.basemap-controls button').forEach((button) => {
            button.classList.toggle('active', button.dataset.layer === layerKey);
        });
    }

    function applyObserverInputs() {
        const lat = clamp(Number(byId('observerLat').value), -90, 90);
        const lon = clamp(Number(byId('observerLon').value), -180, 180);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            showError('Latitude atau longitude tidak valid.');
            return;
        }

        state.observer.lat = lat;
        state.observer.lon = lon;
        byId('observerLat').value = lat.toFixed(6);
        byId('observerLon').value = lon.toFixed(6);
        hideError();
        updateAll();
    }

    function setAdmStatus(message, kind) {
        const element = byId('astronomyAdmStatus');
        if (!element) return;
        element.textContent = message;
        element.dataset.kind = kind || '';
    }

    function admFeatureValue(feature, keys) {
        const properties = feature && feature.getProperties ? feature.getProperties() : {};
        for (let index = 0; index < keys.length; index += 1) {
            const value = String(properties[keys[index]] || '').trim();
            if (value) return value;
        }
        return '';
    }

    function loadAdmBoundary(level) {
        if (!window.MpmAdmBoundary) {
            setAdmStatus('Klien sumber ADM tidak tersedia.', 'error');
            return Promise.reject(new Error('ADM source client unavailable'));
        }
        const country = String(byId('admCountryCode').value || '').trim().toUpperCase();
        const adm1 = String(byId('adm1BoundaryName').value || '').trim();
        if (!/^[A-Z]{2,3}$/.test(country)) {
            setAdmStatus('Isi kode negara ISO2 atau ISO3 yang valid.', 'error');
            return Promise.resolve([]);
        }
        if (level === 'adm2' && !adm1) {
            setAdmStatus('Isi atau pilih nama ADM1 sebelum memuat ADM2.', 'error');
            return Promise.resolve([]);
        }
        const params = { level, hierarchy: 'strict-v6' };
        if (country.length === 2) params.country_iso2 = country;
        else params.country = country;
        if (level === 'adm2') params.adm1 = adm1;
        state.admRequest = { level, world: false };
        const generation = ++state.admLoadGeneration;
        setAdmStatus(`Memeriksa ${level.toUpperCase()} penuh dari geoBoundaries online…`);
        return window.MpmAdmBoundary.fetchGeoJson('api/adm-boundaries.php', { params }).then((result) => {
            if (generation !== state.admLoadGeneration) return [];
            const features = new ol.format.GeoJSON().readFeatures(result.geojson, {
                dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'
            });
            features.forEach((feature) => feature.set('admLevel', level));
            state.layers.admSource.clear();
            state.layers.admSource.addFeatures(features);
            if (features.length) {
                state.map.getView().fit(state.layers.admSource.getExtent(), {
                    padding: [45, 450, 45, 45], duration: 350, maxZoom: level === 'adm2' ? 11 : 8
                });
            }
            setAdmStatus(`${level.toUpperCase()} dimuat: ${features.length} boundary · ${window.MpmAdmBoundary.sourceLabel(result.source, 'id')}.`, 'success');
            return features;
        }).catch((error) => {
            if (generation === state.admLoadGeneration) setAdmStatus(`Gagal memuat ${level.toUpperCase()}: ${error.message}`, 'error');
            throw error;
        });
    }

    function reloadAdmBoundary() {
        loadAdmBoundary(state.admRequest.level).catch(() => {});
    }

    function handlePointerMove(event) {
        if (!event.coordinate) {
            return;
        }

        const lonLat = ol.proj.toLonLat(event.coordinate);
        byId('coordinateBadge').textContent =
            `Lon ${formatNumber(normalizeLon(lonLat[0]), 4)}, Lat ${formatNumber(clamp(lonLat[1], -90, 90), 4)}`;
    }

    function handleMapClick(event) {
        const calibrationFeature = state.map.forEachFeatureAtPixel(event.pixel, (feature, layer) => (
            layer === state.layers.calibration ? feature : null
        ), { hitTolerance: 8 });
        if (calibrationFeature) {
            const calibration = window.MpmTimeCoordinateCalibration && window.MpmTimeCoordinateCalibration.getState();
            const spatial = calibration && calibration.spatialDifference;
            byId('updateStatus').textContent = spatial
                ? `Calibration ${formatNumber(spatial.distanceMeters, 3)} m · ${formatNumber(spatial.bearingDegrees, 3)} deg`
                : 'Calibration data unavailable';
            const panel = byId('timeCoordinateCalibrationPanel');
            if (panel) {
                panel.querySelectorAll('details').forEach((detail) => { detail.open = true; });
            }
            return;
        }
        const admFeature = state.map.forEachFeatureAtPixel(event.pixel, (feature, layer) => (
            layer === state.layers.adm ? feature : null
        ), { hitTolerance: 5 });
        if (admFeature) {
            const iso3 = admFeatureValue(admFeature, ['shapeGroup', 'ISO_A3', 'ISO3']);
            const name = admFeatureValue(admFeature, ['shapeName', 'NAME_0', 'NAME_1', 'NAME_2', 'name']);
            const level = String(admFeature.get('admLevel') || admFeature.get('shapeType') || '').toUpperCase();
            if (iso3) byId('admCountryCode').value = iso3;
            if (level === 'ADM1' && name) byId('adm1BoundaryName').value = name;
            setAdmStatus([level || 'ADM', name, iso3].filter(Boolean).join(' · '), 'success');
            return;
        }
        const lonLat = ol.proj.toLonLat(event.coordinate);
        state.observer.lon = normalizeLon(lonLat[0]);
        state.observer.lat = clamp(lonLat[1], -90, 90);
        byId('observerLat').value = state.observer.lat.toFixed(6);
        byId('observerLon').value = state.observer.lon.toFixed(6);
        updateAll();
    }

    function getSubpoint(body, date) {
        const vector = Astronomy.GeoVector(body, date, true);
        const equator = Astronomy.EquatorFromVector(vector);
        const siderealDegrees = Astronomy.SiderealTime(date) * 15;

        return {
            lat: equator.dec,
            lon: normalizeLon(equator.ra * 15 - siderealDegrees),
            ra: equator.ra,
            dec: equator.dec,
            distanceAu: equator.dist
        };
    }

    function getHorizontal(body, date) {
        const observer = new Astronomy.Observer(
            state.observer.lat,
            state.observer.lon,
            state.observer.elevation
        );
        const equator = Astronomy.Equator(body, date, observer, true, true);
        const horizon = Astronomy.Horizon(date, observer, equator.ra, equator.dec, 'normal');

        return {
            altitude: horizon.altitude,
            azimuth: normalize360(horizon.azimuth),
            ra: equator.ra,
            dec: equator.dec,
            distanceAu: equator.dist
        };
    }

    function getBodySnapshot(date) {
        const sunSubpoint = getSubpoint(Astronomy.Body.Sun, date);
        const moonSubpoint = getSubpoint(Astronomy.Body.Moon, date);
        const sunHorizontal = getHorizontal(Astronomy.Body.Sun, date);
        const moonHorizontal = getHorizontal(Astronomy.Body.Moon, date);
        const sunIllumination = Astronomy.Illumination(Astronomy.Body.Sun, date);
        const moonIllumination = Astronomy.Illumination(Astronomy.Body.Moon, date);
        const moonPhaseDegrees = Astronomy.MoonPhase(date);

        return {
            date,
            sun: {
                subpoint: sunSubpoint,
                horizontal: sunHorizontal,
                distanceKm: sunIllumination.geo_dist * KM_PER_AU,
                distanceAu: sunIllumination.geo_dist
            },
            moon: {
                subpoint: moonSubpoint,
                horizontal: moonHorizontal,
                distanceKm: moonIllumination.geo_dist * KM_PER_AU,
                distanceAu: moonIllumination.geo_dist,
                illumination: moonIllumination.phase_fraction,
                phaseDegrees: moonPhaseDegrees,
                phaseName: getMoonPhaseName(moonPhaseDegrees)
            }
        };
    }

    function updateAll() {
        try {
            const now = actualNow();
            const snapshot = getBodySnapshot(now);

            updateBodyMarkers(snapshot);
            updateDayNightLayer(snapshot);
            updateInfoPanels(snapshot);
            drawMoonPhase(snapshot.moon);
            hideError();
            byId('updateStatus').textContent = `Updated ${now.toISOString().slice(11, 19)} UTC`;
        } catch (error) {
            showError(error.message || 'Gagal menghitung data astronomi.');
            byId('updateStatus').textContent = 'Error';
        }
    }

    function updateBodyMarkers(snapshot) {
        state.features.sun.getGeometry().setCoordinates(ol.proj.fromLonLat([
            snapshot.sun.subpoint.lon,
            snapshot.sun.subpoint.lat
        ]));
        state.features.moon.getGeometry().setCoordinates(ol.proj.fromLonLat([
            snapshot.moon.subpoint.lon,
            snapshot.moon.subpoint.lat
        ]));
    }

    function updateDayNightLayer(snapshot) {
        const canvas = document.createElement('canvas');
        canvas.width = DAY_NIGHT_CANVAS.width;
        canvas.height = DAY_NIGHT_CANVAS.height;

        const context = canvas.getContext('2d');
        const imageData = context.createImageData(canvas.width, canvas.height);
        const data = imageData.data;

        for (let y = 0; y < canvas.height; y += 1) {
            const mercatorY = WEB_MERCATOR_MAX - (y / (canvas.height - 1)) * WEB_MERCATOR_MAX * 2;
            const lat = radToDeg(Math.atan(Math.sinh(mercatorY / EARTH_RADIUS_M)));

            for (let x = 0; x < canvas.width; x += 1) {
                const lon = -180 + (x / (canvas.width - 1)) * 360;
                const sunAltitude = altitudeFromSubpoint(
                    lat,
                    lon,
                    snapshot.sun.subpoint.lat,
                    snapshot.sun.subpoint.lon
                );
                const moonAltitude = altitudeFromSubpoint(
                    lat,
                    lon,
                    snapshot.moon.subpoint.lat,
                    snapshot.moon.subpoint.lon
                );
                const color = colorForSky(
                    sunAltitude,
                    moonAltitude,
                    snapshot.moon.illumination,
                    normalize180(lon - snapshot.sun.subpoint.lon)
                );
                const index = (y * canvas.width + x) * 4;

                data[index] = color[0];
                data[index + 1] = color[1];
                data[index + 2] = color[2];
                data[index + 3] = color[3];
            }
        }

        context.putImageData(imageData, 0, 0);
        state.layers.dayNight.setSource(new ol.source.ImageStatic({
            url: canvas.toDataURL('image/png'),
            projection: 'EPSG:3857',
            imageExtent: WEB_MERCATOR_EXTENT
        }));
    }

    function altitudeFromSubpoint(lat, lon, subLat, subLon) {
        const latRad = degToRad(lat);
        const subLatRad = degToRad(subLat);
        const hourAngleRad = degToRad(normalize180(lon - subLon));
        const sinAltitude =
            Math.sin(latRad) * Math.sin(subLatRad) +
            Math.cos(latRad) * Math.cos(subLatRad) * Math.cos(hourAngleRad);

        return radToDeg(Math.asin(clamp(sinAltitude, -1, 1)));
    }

    function colorForSky(sunAltitude, moonAltitude, moonIllumination, sunHourAngle) {
        if (sunAltitude >= 12) {
            return [255, 212, 84, 78];
        }

        if (sunAltitude >= 0) {
            const t = sunAltitude / 12;
            const morning = sunHourAngle < 0;
            const edge = morning ? [255, 248, 225, 112] : [255, 143, 61, 126];
            return mixColor(edge, [255, 212, 84, 78], t);
        }

        if (sunAltitude >= -6) {
            const t = (sunAltitude + 6) / 6;
            const twilight = sunHourAngle < 0 ? [255, 248, 225, 132] : [255, 121, 49, 148];
            const night = moonAltitude > 0 && moonIllumination > 0.08
                ? [8, 29, 96, 158]
                : [0, 0, 0, 174];
            return mixColor(night, twilight, t);
        }

        if (sunAltitude >= -18) {
            const t = (sunAltitude + 18) / 12;
            const night = moonAltitude > 0 && moonIllumination > 0.08
                ? [8, 29, 96, 170]
                : [0, 0, 0, 188];
            const twilight = sunHourAngle < 0 ? [240, 244, 255, 120] : [214, 84, 44, 142];
            return mixColor(night, twilight, t);
        }

        if (moonAltitude > 0 && moonIllumination > 0.08) {
            const moonBoost = clamp(moonIllumination, 0.12, 1);
            return [
                Math.round(5 + 18 * moonBoost),
                Math.round(22 + 32 * moonBoost),
                Math.round(70 + 72 * moonBoost),
                Math.round(168 - 24 * moonBoost)
            ];
        }

        return [0, 0, 0, 190];
    }

    function mixColor(fromColor, toColor, weight) {
        const t = clamp(weight, 0, 1);
        return [
            Math.round(fromColor[0] + (toColor[0] - fromColor[0]) * t),
            Math.round(fromColor[1] + (toColor[1] - fromColor[1]) * t),
            Math.round(fromColor[2] + (toColor[2] - fromColor[2]) * t),
            Math.round(fromColor[3] + (toColor[3] - fromColor[3]) * t)
        ];
    }

    function updateInfoPanels(snapshot) {
        const utcOffset = clamp(Math.round(state.observer.lon / 15), -12, 14);

        setDataGrid('timeGrid', [
            ['UTC sekarang', formatDateUtc(snapshot.date)],
            ['Offset lokasi', `${formatUtcOffset(utcOffset)} (estimasi longitude)`],
            ['Waktu lokasi', formatShiftedDate(snapshot.date, utcOffset)],
            ['Observer', `${formatNumber(state.observer.lat, 6)}, ${formatNumber(state.observer.lon, 6)}`],
            ['Subsolar', `${formatNumber(snapshot.sun.subpoint.lat, 4)}, ${formatNumber(snapshot.sun.subpoint.lon, 4)}`],
            ['Sublunar', `${formatNumber(snapshot.moon.subpoint.lat, 4)}, ${formatNumber(snapshot.moon.subpoint.lon, 4)}`]
        ]);

        setDataGrid('sunGrid', [
            ['Altitude', formatDegrees(snapshot.sun.horizontal.altitude, 2)],
            ['Azimuth', formatDegrees(snapshot.sun.horizontal.azimuth, 2)],
            ['Arah', getCompassDirection(snapshot.sun.horizontal.azimuth)],
            ['Jarak', formatKm(snapshot.sun.distanceKm)],
            ['Jarak AU', formatNumber(snapshot.sun.distanceAu, 6)],
            ['Koordinat bawah', `${formatNumber(snapshot.sun.subpoint.lat, 4)}, ${formatNumber(snapshot.sun.subpoint.lon, 4)}`]
        ]);

        setDataGrid('moonGrid', [
            ['Fase', snapshot.moon.phaseName],
            ['Iluminasi', formatPercent(snapshot.moon.illumination, 1)],
            ['Altitude', formatDegrees(snapshot.moon.horizontal.altitude, 2)],
            ['Azimuth', formatDegrees(snapshot.moon.horizontal.azimuth, 2)],
            ['Arah', getCompassDirection(snapshot.moon.horizontal.azimuth)],
            ['Jarak', formatKm(snapshot.moon.distanceKm)]
        ]);

        renderEclipses(snapshot.date);
    }

    function setDataGrid(id, items) {
        const grid = byId(id);
        grid.innerHTML = items.map(([label, value]) => (
            `<div class="data-item">
                <span class="data-label">${escapeHtml(label)}</span>
                <span class="data-value">${escapeHtml(value)}</span>
            </div>`
        )).join('');
    }

    function renderEclipses(date) {
        const cacheDate = date.toISOString().slice(0, 10);

        if (!state.eclipseCache || state.eclipseCacheDate !== cacheDate) {
            state.eclipseCache = getUpcomingEclipses(date);
            state.eclipseCacheDate = cacheDate;
        }

        byId('eclipseList').innerHTML = state.eclipseCache.map((event) => (
            `<article class="eclipse-item">
                <div class="eclipse-head">
                    <span class="eclipse-type">${escapeHtml(event.type)}</span>
                    <span class="eclipse-kind">${escapeHtml(event.kind)}</span>
                </div>
                <span class="data-value">${escapeHtml(event.when)}</span>
                <span class="data-label">${escapeHtml(event.detail)}</span>
            </article>`
        )).join('');
    }

    function getUpcomingEclipses(date) {
        const events = [];

        try {
            let solar = Astronomy.SearchGlobalSolarEclipse(date);
            for (let i = 0; i < 3 && solar; i += 1) {
                events.push(formatSolarEclipse(solar));
                solar = Astronomy.NextGlobalSolarEclipse(solar.peak);
            }
        } catch (error) {
            events.push({
                type: 'Gerhana Matahari',
                kind: 'N/A',
                when: 'Tidak tersedia',
                detail: error.message,
                dateMs: Number.MAX_SAFE_INTEGER
            });
        }

        try {
            let lunar = Astronomy.SearchLunarEclipse(date);
            for (let i = 0; i < 3 && lunar; i += 1) {
                events.push(formatLunarEclipse(lunar));
                lunar = Astronomy.NextLunarEclipse(lunar.peak);
            }
        } catch (error) {
            events.push({
                type: 'Gerhana Bulan',
                kind: 'N/A',
                when: 'Tidak tersedia',
                detail: error.message,
                dateMs: Number.MAX_SAFE_INTEGER
            });
        }

        return events.sort((a, b) => a.dateMs - b.dateMs).slice(0, 6);
    }

    function formatSolarEclipse(eclipse) {
        const peakDate = safeDateFromAstroTime(eclipse.peak);
        const latitude = Number.isFinite(eclipse.latitude) ? formatNumber(eclipse.latitude, 2) : '-';
        const longitude = Number.isFinite(eclipse.longitude) ? formatNumber(normalizeLon(eclipse.longitude), 2) : '-';
        const obscuration = Number.isFinite(eclipse.obscuration)
            ? `, obscuration ${formatPercent(eclipse.obscuration, 1)}`
            : '';

        return {
            type: 'Gerhana Matahari',
            kind: eclipse.kind || 'unknown',
            when: formatDateUtc(peakDate),
            detail: `Puncak global di sekitar lat ${latitude}, lon ${longitude}${obscuration}`,
            dateMs: peakDate ? peakDate.getTime() : Number.MAX_SAFE_INTEGER
        };
    }

    function formatLunarEclipse(eclipse) {
        const peakDate = safeDateFromAstroTime(eclipse.peak);
        const total = Number.isFinite(eclipse.sd_total) && eclipse.sd_total > 0
            ? `, total sekitar ${formatNumber(eclipse.sd_total * 2, 0)} menit`
            : '';
        const partial = Number.isFinite(eclipse.sd_partial) && eclipse.sd_partial > 0
            ? `, partial sekitar ${formatNumber(eclipse.sd_partial * 2, 0)} menit`
            : '';

        return {
            type: 'Gerhana Bulan',
            kind: eclipse.kind || 'unknown',
            when: formatDateUtc(peakDate),
            detail: `Durasi penumbra tersedia dari model${total}${partial}`,
            dateMs: peakDate ? peakDate.getTime() : Number.MAX_SAFE_INTEGER
        };
    }

    function drawMoonPhase(moon) {
        const canvas = byId('moonPhaseCanvas');
        const context = canvas.getContext('2d');
        const size = canvas.width;
        const radius = size / 2 - 5;
        const center = size / 2;

        context.clearRect(0, 0, size, size);
        context.save();
        context.beginPath();
        context.arc(center, center, radius, 0, Math.PI * 2);
        context.clip();
        context.fillStyle = '#07111f';
        context.fillRect(0, 0, size, size);

        if (state.moonImage && state.moonImage.complete) {
            context.drawImage(state.moonImage, center - radius, center - radius, radius * 2, radius * 2);
        } else {
            const gradient = context.createRadialGradient(center - 22, center - 24, 8, center, center, radius);
            gradient.addColorStop(0, '#f8f5df');
            gradient.addColorStop(1, '#a9a38d');
            context.fillStyle = gradient;
            context.fillRect(center - radius, center - radius, radius * 2, radius * 2);
        }

        drawPhaseShadow(context, center, radius, moon.phaseDegrees, moon.illumination);
        context.restore();

        context.beginPath();
        context.arc(center, center, radius, 0, Math.PI * 2);
        context.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        context.lineWidth = 2;
        context.stroke();
    }

    function drawPhaseShadow(context, center, radius, phaseDegrees, illumination) {
        const phase = normalize360(phaseDegrees) / 360;
        const shadowWidth = (1 - clamp(illumination, 0, 1)) * radius * 2;

        context.save();
        context.globalCompositeOperation = 'source-over';
        context.fillStyle = 'rgba(2, 6, 15, 0.78)';

        if (illumination < 0.03) {
            context.fillRect(center - radius, center - radius, radius * 2, radius * 2);
            context.restore();
            return;
        }

        if (illumination > 0.97) {
            context.restore();
            return;
        }

        if (phase < 0.5) {
            context.fillRect(center - radius, center - radius, shadowWidth, radius * 2);
        } else {
            context.fillRect(center + radius - shadowWidth, center - radius, shadowWidth, radius * 2);
        }

        context.restore();
    }

    function preloadMoonImage() {
        state.moonImage = new Image();
        state.moonImage.onload = () => updateAll();
        state.moonImage.src = ICONS.moon;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showError(message) {
        const element = byId('astroError');
        element.textContent = message;
        element.style.display = 'block';
    }

    function hideError() {
        const element = byId('astroError');
        element.textContent = '';
        element.style.display = 'none';
    }

    function init() {
        try {
            if (!window.ol) {
                throw new Error('OpenLayers gagal dimuat.');
            }
            createMap();
            bindControls();
            if (state.admRequest.autoLoad) {
                loadAdmBoundary(state.admRequest.level).catch(() => {});
            }
        } catch (error) {
            showError(error.message || 'Peta gagal dimulai.');
            byId('updateStatus').textContent = 'Error';
            return;
        }

        try {
            ensureAstronomyReady();
            preloadMoonImage();
            updateAll();
            state.updateTimer = window.setInterval(updateAll, 60000);
        } catch (error) {
            showError(error.message || 'Halaman gagal dimulai.');
            byId('updateStatus').textContent = 'Error';
        }
    }

    window.AstronomyWorldMap = {
        getState: () => ({
            observer: { ...state.observer },
            calibration: window.MpmTimeCoordinateCalibration
                ? window.MpmTimeCoordinateCalibration.getState()
                : null,
            calibrationLineVisible: Boolean(state.features.calibrationLine && state.features.calibrationLine.getGeometry()),
            providerMarkerVisible: Boolean(state.features.providerCoordinate && state.features.providerCoordinate.getGeometry()),
            buildingMarkerVisible: Boolean(state.features.buildingCoordinate && state.features.buildingCoordinate.getGeometry())
        }),
        refreshCalibration: renderCalibrationFeatures
    };

    window.addEventListener('mpm:actual-time-status', () => {
        if (state.updateTimer) {
            updateAll();
        }
    });

    window.addEventListener('mpm:time-coordinate-calibration', () => {
        renderCalibrationFeatures();
    });

    window.addEventListener('DOMContentLoaded', () => {
        const start = () => init();
        if (window.GisRuntime) {
            window.GisRuntime.loadSettings().then(start, start);
        } else {
            start();
        }
    });
}());
