(function () {
    'use strict';

    const API_URL = 'api/environmental-monitoring.php';
    const CACHE_KEY = 'mpm:environmental-monitoring:dashboard:v1';
    const UNIT_KEY = 'mpm:environmental-monitoring:temperature-unit:v1';
    const REFRESH_INTERVAL_MS = 300000;
    const PANEL_EVENT_PAGE_SIZE = 5;
    const REVIEWER_CORE_FEATURE_CONFIG = [
        { feature: 'building', enabled: true, order: 10, zoom: 13, duration: 9000, showPopup: true, showInfoBox: true, transitionType: 'fly', priority: 30, group: 'regular' },
        { feature: 'ip-provider', enabled: true, order: 14, zoom: 12, duration: 8500, showPopup: true, showInfoBox: true, transitionType: 'fly', priority: 18, group: 'regular' },
        { feature: 'provider-building-calibration', enabled: true, order: 17, zoom: 12, duration: 8500, showPopup: true, showInfoBox: true, transitionType: 'fit', priority: 17, group: 'regular' },
        { feature: 'sun', enabled: true, order: 20, zoom: 5, duration: 9000, showPopup: true, showInfoBox: true, transitionType: 'fly', priority: 30, group: 'regular' },
        { feature: 'timeline', enabled: true, order: 25, zoom: 6, duration: 8000, showPopup: true, showInfoBox: true, transitionType: 'fly', priority: 28, group: 'regular' },
        { feature: 'moon', enabled: true, order: 30, zoom: 5, duration: 9000, showPopup: true, showInfoBox: true, transitionType: 'fly', priority: 30, group: 'regular' },
        { feature: 'moon-phase', enabled: true, order: 40, zoom: 6, duration: 9000, showPopup: true, showInfoBox: true, transitionType: 'fly', priority: 30, group: 'regular' },
        { feature: 'kaabah', enabled: true, order: 50, zoom: 12, duration: 9000, showPopup: true, showInfoBox: true, transitionType: 'fly', priority: 30, group: 'regular' },
        { feature: 'kaabah-line', enabled: true, order: 55, zoom: 4, duration: 8500, showPopup: true, showInfoBox: true, transitionType: 'fit', priority: 26, group: 'regular' },
        { feature: 'observer', enabled: true, order: 60, zoom: 10, duration: 8000, showPopup: true, showInfoBox: true, transitionType: 'fly', priority: 25, group: 'regular' },
        { feature: 'trajectory', enabled: true, order: 70, zoom: 4, duration: 8000, showPopup: true, showInfoBox: true, transitionType: 'fit', priority: 20, group: 'regular' },
        { feature: 'solar-eclipse', enabled: true, order: 120, zoom: 5, duration: 9000, showPopup: true, showInfoBox: true, transitionType: 'fly', priority: 35, group: 'regular' },
        { feature: 'lunar-eclipse', enabled: true, order: 130, zoom: 5, duration: 9000, showPopup: true, showInfoBox: true, transitionType: 'fly', priority: 35, group: 'regular' }
    ];
    const DEFAULT_CONFIG = {
        settings: {
            overviewDuration: 6000,
            zoomDuration: 1800,
            popupDelay: 650,
            titleDuration: 2000,
            detailDuration: 3000,
            sourceDuration: 2500,
            transitionDuration: 900,
            interSceneOverviewDuration: 1800,
            returnToOverviewBetweenFeatures: true,
            loopDelay: 1500,
            maxEarthquakesPerCycle: 3,
            maxWildfiresPerCycle: 3,
            importantEarthquakeMagnitude: 5,
            temperatureUnit: 'celsius',
            showTemperatureDisplay: true,
            showCloudLayer: true
        },
        features: REVIEWER_CORE_FEATURE_CONFIG.map((item) => Object.assign({}, item))
    };

    const state = {
        map: null,
        data: null,
        config: DEFAULT_CONFIG,
        sources: {},
        layers: {},
        features: {
            weather: null,
            temperature: null,
            cloud: null,
            earthquakes: [],
            wildfires: []
        },
        selectedForecastIndex: -1,
        temperatureUnit: normalizeUnit(localStorage.getItem(UNIT_KEY) || ''),
        activePopupKey: '',
        activePresentationFeature: null,
        presentationCycle: 0,
        presentationStopped: false,
        presentationStarted: false,
        presentationRunId: 0,
        reloadPromise: null,
        lastWeatherDay: -2,
        pendingData: null,
        cycleLocked: false,
        presentationErrors: [],
        lastTransitionSignal: '',
        initializationStatus: 'BOOTING',
        debugTimer: null,
        currentQueue: [],
        presentationHomeView: null,
        presentationConfigOverride: false,
        panelPages: {
            earthquake: 0,
            wildfire: 0
        }
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function isReviewer() {
        return ((document.body && document.body.dataset.reviewerMode) || '').toLowerCase() === 'display';
    }

    function language() {
        const base = window.AdvancedAstroGIS && window.AdvancedAstroGIS.getState
            ? window.AdvancedAstroGIS.getState()
            : {};
        return base.reviewerLanguage === 'en' || document.documentElement.lang === 'en' ? 'en' : 'id';
    }

    function localized(idText, enText) {
        return language() === 'en' ? enText : idText;
    }

    function escapeHtml(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function safeUrl(value) {
        try {
            const url = new URL(String(value || ''), window.location.href);
            return url.protocol === 'https:' || url.origin === window.location.origin ? url.href : '';
        } catch (error) {
            return '';
        }
    }

    function number(value) {
        if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
            return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function normalizeUnit(value) {
        return String(value || '').toLowerCase() === 'fahrenheit' ? 'fahrenheit' : 'celsius';
    }

    function displayNumber(value, digits) {
        const parsed = number(value);
        if (parsed === null) {
            return '-';
        }
        return parsed.toLocaleString(language() === 'en' ? 'en-US' : 'id-ID', {
            minimumFractionDigits: 0,
            maximumFractionDigits: digits === undefined ? 1 : digits
        });
    }

    function convertedTemperature(value) {
        const celsius = number(value);
        if (celsius === null) {
            return null;
        }
        return state.temperatureUnit === 'fahrenheit' ? (celsius * 9 / 5) + 32 : celsius;
    }

    function temperatureText(value) {
        const converted = convertedTemperature(value);
        if (converted === null) {
            return '-';
        }
        return `${displayNumber(converted, 1)}°${state.temperatureUnit === 'fahrenheit' ? 'F' : 'C'}`;
    }

    function temperatureRange(record) {
        if (!record) {
            return '-';
        }
        const minimum = convertedTemperature(record.minTemperature);
        const maximum = convertedTemperature(record.maxTemperature);
        if (minimum === null && maximum === null) {
            return '-';
        }
        if (minimum === null) {
            return `${localized('Maks', 'Max')} ${temperatureText(record.maxTemperature)}`;
        }
        if (maximum === null) {
            return `${localized('Min', 'Min')} ${temperatureText(record.minTemperature)}`;
        }
        const suffix = `°${state.temperatureUnit === 'fahrenheit' ? 'F' : 'C'}`;
        return `${displayNumber(minimum, 1)}–${displayNumber(maximum, 1)}${suffix}`;
    }

    function formatDate(value, includeTime) {
        if (!value) {
            return '-';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        const options = includeTime
            ? { dateStyle: 'medium', timeStyle: 'short' }
            : { dateStyle: 'medium' };
        return new Intl.DateTimeFormat(language() === 'en' ? 'en-US' : 'id-ID', options).format(date);
    }

    function formatDuration(seconds) {
        const safe = Math.max(0, Math.ceil(Number(seconds) || 0));
        const minutes = Math.floor(safe / 60);
        return `${String(minutes).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
    }

    function statusClass(status) {
        const normalized = String(status || '').toLowerCase();
        if (normalized === 'live') {
            return 'is-live';
        }
        if (normalized === 'cached') {
            return 'is-cached';
        }
        if (normalized === 'stale') {
            return 'is-stale';
        }
        return 'is-unavailable';
    }

    function setStatusBadge(id, status) {
        const element = byId(id);
        if (!element) {
            return;
        }
        element.textContent = status || localized('Tidak tersedia', 'Unavailable');
        element.classList.remove('is-live', 'is-cached', 'is-stale', 'is-unavailable');
        element.classList.add(statusClass(status));
    }

    function popupHtml(title, rows, source) {
        const sourceUrl = safeUrl(source && (source.sourceUrl || source.rawSourceReference));
        const cleanRows = rows.filter((row) => row && row.label && row.value !== null && row.value !== undefined && row.value !== '');
        const sourceRow = source && (source.provider || source.dataset)
            ? `<dt>${escapeHtml(localized('Sumber', 'Source'))}</dt><dd>${sourceUrl
                ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.provider || source.dataset)}</a>`
                : escapeHtml(source.provider || source.dataset)}</dd>`
            : '';
        return [
            '<button class="astro-popup-close" type="button" data-popup-close aria-label="Close">x</button>',
            `<h4>${escapeHtml(title)}</h4>`,
            `<dl>${cleanRows.map((row) => `<dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd>`).join('')}${sourceRow}</dl>`
        ].join('');
    }

    function baseState() {
        return window.AdvancedAstroGIS && window.AdvancedAstroGIS.getState
            ? window.AdvancedAstroGIS.getState()
            : {};
    }

    function currentLocation() {
        const base = baseState();
        const context = base.adminContext || {};
        const location = context.location || {};
        const mosque = context.mosque || context.building || {};
        const latitude = number(location.latitude !== undefined ? location.latitude : (location.lat !== undefined ? location.lat : base.observer && base.observer.lat));
        const longitude = number(location.longitude !== undefined ? location.longitude : (location.lon !== undefined ? location.lon : base.observer && base.observer.lon));
        const parts = [
            mosque.name || mosque.mosqueName || context.name || '',
            location.city || location.adm2 || '',
            location.country || location.adm0 || ''
        ].filter(Boolean);
        return {
            latitude: latitude === null ? -6.175392 : latitude,
            longitude: longitude === null ? 106.827153 : longitude,
            name: parts.join(' · ') || localized('Lokasi observasi', 'Observation location')
        };
    }

    async function requestDashboard() {
        const location = currentLocation();
        const query = new URLSearchParams({
            latitude: String(location.latitude),
            longitude: String(location.longitude),
            location: location.name,
            // Provider refreshes are handled independently by the scheduled
            // worker. The browser reads the latest SQL projection immediately
            // so a large earthquake feed never blocks the visible UI.
            refresh: 'none',
            earthquakeHours: '168',
            wildfireDays: '30',
            limit: '100'
        });
        const response = await fetch(`${API_URL}?${query.toString()}`, {
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { Accept: 'application/json' }
        });
        const payload = await response.json();
        if (!response.ok || !payload || payload.success !== true || !payload.data) {
            throw new Error(payload && payload.error ? payload.error : `Environmental API HTTP ${response.status}`);
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data: payload.data }));
        return payload.data;
    }

    function cachedDashboard() {
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
            if (!cached || !cached.data) {
                return null;
            }
            const ageMinutes = Math.max(0, (Date.now() - Number(cached.cachedAt || 0)) / 60000);
            const data = cached.data;
            if (data.weather) {
                data.weather.dataStatus = ageMinutes > 180 ? 'Stale' : 'Cached';
                if (data.weather.current) {
                    data.weather.current.dataStatus = data.weather.dataStatus;
                }
                (data.weather.forecast || []).forEach((row) => {
                    row.dataStatus = data.weather.dataStatus;
                });
            }
            (data.sources || []).forEach((source) => {
                source.dataStatus = ageMinutes > Math.max(180, Number(source.updateFrequencyMinutes || 60) * 3)
                    ? 'Stale'
                    : 'Cached';
            });
            data.servedFrom = 'local-cache';
            data.cacheAgeMinutes = ageMinutes;
            return data;
        } catch (error) {
            return null;
        }
    }

    function applyDashboard(data) {
        const visual = (value) => JSON.stringify(value, (key, item) => ['generatedAt', 'servedAt', 'fetchedAt', 'cacheAgeMinutes'].includes(key) ? undefined : item);
        const unchanged = state.data && visual(state.data) === visual(data);
        state.data = data;
        if (unchanged) return data;
        if (!state.presentationConfigOverride) {
            state.config = normalizeConfig(data.presentation || DEFAULT_CONFIG);
        }
        if (!localStorage.getItem(UNIT_KEY)) {
            state.temperatureUnit = normalizeUnit(state.config.settings.temperatureUnit);
        }
        syncUnitControl();
        renderLayers();
        renderPanels();
        window.dispatchEvent(new CustomEvent('mpm:environmental-data-ready', { detail: data }));
        return data;
    }

    function applyPendingDashboard() {
        if (!state.pendingData) {
            return false;
        }
        const data = state.pendingData;
        state.pendingData = null;
        applyDashboard(data);
        return true;
    }

    async function loadData() {
        if (state.reloadPromise) {
            return state.reloadPromise;
        }
        state.reloadPromise = (async () => {
            let data;
            try {
                data = await requestDashboard();
            } catch (error) {
                if (state.data) {
                    ['weatherStatusBadge', 'earthquakeStatusBadge'].forEach((id) => setStatusBadge(id, 'Update unavailable · last data retained'));
                    return state.data;
                }
                data = cachedDashboard();
                if (!data) {
                    renderUnavailable(error.message);
                    throw error;
                }
            }
            if (isReviewer() && state.cycleLocked) {
                state.pendingData = data;
                window.dispatchEvent(new CustomEvent('mpm:environmental-data-pending', {
                    detail: { generatedAt: data.generatedAt || null }
                }));
                return data;
            }
            applyDashboard(data);
            return data;
        })().finally(() => {
            state.reloadPromise = null;
        });
        return state.reloadPromise;
    }

    function normalizeConfig(raw) {
        const input = raw && typeof raw === 'object' ? raw : {};
        const configuredFeatures = Array.isArray(input.features) ? input.features : [];
        const mergedFeatures = new Map(REVIEWER_CORE_FEATURE_CONFIG.map((item) => [item.feature, Object.assign({}, item)]));
        configuredFeatures.forEach((item) => {
            if (!item || !item.feature) {
                return;
            }
            mergedFeatures.set(item.feature, Object.assign({}, mergedFeatures.get(item.feature) || {}, item));
        });
        return {
            schemaVersion: input.schemaVersion || DEFAULT_CONFIG.schemaVersion,
            settings: Object.assign({}, DEFAULT_CONFIG.settings, input.settings || {}),
            features: Array.from(mergedFeatures.values())
        };
    }

    function renderUnavailable(message) {
        const detail = escapeHtml(message || localized('Sumber data tidak dapat dihubungi.', 'The data source cannot be reached.'));
        setStatusBadge('weatherStatusBadge', 'Source Unavailable');
        setStatusBadge('earthquakeStatusBadge', 'Source Unavailable');
        setStatusBadge('wildfireStatusBadge', 'Source Unavailable');
        const current = byId('weatherCurrentInfo');
        if (current) {
            current.innerHTML = `<strong>${escapeHtml(localized('Data tidak tersedia', 'Data unavailable'))}</strong><span>${detail}</span>`;
        }
        const forecast = byId('weatherForecastCards');
        if (forecast) {
            forecast.innerHTML = `<div class="environment-note">${escapeHtml(localized('Forecast tidak tersedia karena sumber gagal dimuat.', 'Forecast is unavailable because the source failed to load.'))}</div>`;
        }
        const earthquake = byId('earthquakeList');
        if (earthquake) {
            earthquake.innerHTML = `<div class="environment-note">${escapeHtml(localized('Sumber gempa tidak tersedia.', 'Earthquake source unavailable.'))} ${detail}</div>`;
        }
        renderEarthquakeSourceCard();
        const wildfire = byId('wildfireList');
        if (wildfire) {
            wildfire.innerHTML = `<div class="environment-note">${escapeHtml(localized('Sumber wildfire tidak tersedia.', 'Wildfire source unavailable.'))} ${detail}</div>`;
        }
    }

    function ensureMapLayers() {
        if (state.map || !window.AdvancedAstroGIS || !window.AdvancedAstroGIS.getMap || !window.ol) {
            return Boolean(state.map);
        }
        state.map = window.AdvancedAstroGIS.getMap();
        if (!state.map) {
            return false;
        }
        // Retain the empty earthquakeIntensity layer for legacy diagnostics and reviewer consumers.
        // The shared radius module owns selected-event polygons and their animation.
        ['weather', 'temperature', 'cloud', 'earthquake', 'earthquakeIntensity', 'wildfire'].forEach((key) => {
            state.sources[key] = new ol.source.Vector();
            state.layers[key] = new ol.layer.Vector({
                source: state.sources[key],
                zIndex: key === 'temperature' ? 83 : (key === 'earthquakeIntensity' ? 84 : (key === 'earthquake' || key === 'wildfire' ? 81 : 82)),
                style: featureStyle
            });
            state.map.addLayer(state.layers[key]);
        });
        applyLayerVisibility();
        return true;
    }

    function featureStyle(feature) {
        const kind = feature.get('kind');
        const popupKey = `${kind}:${feature.get('popupKey') || feature.get('recordId') || ''}`;
        const active = popupKey === state.activePopupKey;
        const styles = [];
        if (active) {
            styles.push(new ol.style.Style({
                image: new ol.style.Circle({
                    radius: kind === 'earthquake' ? 24 : 21,
                    fill: new ol.style.Fill({ color: 'rgba(255, 222, 112, 0.23)' }),
                    stroke: new ol.style.Stroke({ color: '#ffe070', width: 3 })
                }),
                stroke: new ol.style.Stroke({ color: '#ffe070', width: 4 }),
                fill: new ol.style.Fill({ color: 'rgba(255, 224, 112, 0.18)' })
            }));
        }
        if (kind === 'weather') {
            styles.push(new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 15,
                    fill: new ol.style.Fill({ color: '#2e7d9c' }),
                    stroke: new ol.style.Stroke({ color: '#ffffff', width: 2.5 })
                }),
                text: new ol.style.Text({
                    text: weatherGlyph(feature.get('weatherCode')),
                    font: 'bold 15px Segoe UI Symbol, sans-serif',
                    fill: new ol.style.Fill({ color: '#ffffff' })
                })
            }));
        } else if (kind === 'temperature') {
            styles.push(new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 5,
                    fill: new ol.style.Fill({ color: '#ef8e32' }),
                    stroke: new ol.style.Stroke({ color: '#ffffff', width: 1.5 })
                }),
                text: new ol.style.Text({
                    text: temperatureText(feature.get('temperature')),
                    offsetY: -24,
                    font: 'bold 13px Segoe UI, sans-serif',
                    padding: [4, 6, 4, 6],
                    fill: new ol.style.Fill({ color: '#ffffff' }),
                    backgroundFill: new ol.style.Fill({ color: 'rgba(30,45,57,0.9)' }),
                    backgroundStroke: new ol.style.Stroke({ color: 'rgba(255,255,255,0.75)', width: 1 })
                })
            }));
        } else if (kind === 'cloud-condition') {
            const cover = Math.max(0, Math.min(100, number(feature.get('cloudCover')) || 0));
            const alpha = 0.18 + (cover / 100) * 0.55;
            styles.push(new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 18,
                    fill: new ol.style.Fill({ color: `rgba(104,125,142,${alpha})` }),
                    stroke: new ol.style.Stroke({ color: '#eef6f8', width: 2 })
                }),
                text: new ol.style.Text({
                    text: `${displayNumber(cover, 0)}%`,
                    font: 'bold 10px Segoe UI, sans-serif',
                    fill: new ol.style.Fill({ color: '#ffffff' })
                })
            }));
        } else if (kind === 'earthquake') {
            const magnitude = Math.max(0, number(feature.get('magnitude')) || 0);
            const iconPath = feature.get('iconPath');
            const magnitudeColor = feature.get('magnitudeColor') || '#ffffff';
            styles.push(new ol.style.Style({
                image: iconPath
                    ? new ol.style.Icon({ src: iconPath, scale: 0.045, anchor: [0.5, 0.9] })
                    : new ol.style.Circle({
                        radius: Math.max(7, Math.min(19, 6 + magnitude * 1.7)),
                        fill: new ol.style.Fill({ color: magnitudeColor }),
                        stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
                    }),
                text: new ol.style.Text({
                    text: magnitude ? displayNumber(magnitude, 1) : '',
                    offsetY: iconPath ? -42 : 0,
                    fill: new ol.style.Fill({ color: magnitudeColor }),
                    stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 }),
                    font: 'bold 10px Segoe UI, sans-serif',
                })
            }));
        } else if (kind === 'wildfire') {
            const geometry = feature.getGeometry();
            if (geometry && geometry.getType() !== 'Point') {
                styles.push(new ol.style.Style({
                    stroke: new ol.style.Stroke({ color: '#c84f1d', width: 2.5 }),
                    fill: new ol.style.Fill({ color: 'rgba(235,105,36,0.24)' })
                }));
            } else {
                styles.push(new ol.style.Style({
                    image: new ol.style.RegularShape({
                        points: 3,
                        radius: 13,
                        angle: 0,
                        fill: new ol.style.Fill({ color: '#d85620' }),
                        stroke: new ol.style.Stroke({ color: '#fff5df', width: 2 })
                    }),
                    text: new ol.style.Text({
                        text: '!',
                        offsetY: 2,
                        font: 'bold 11px Segoe UI, sans-serif',
                        fill: new ol.style.Fill({ color: '#ffffff' })
                    })
                }));
            }
        }
        return styles;
    }

    function classifyEarthquake(event, coordinate) {
        const raw = [
            event.earthquakeType, event.earthquake_type, event.sourceType,
            event.source_type, event.originType, event.type, event.eventType,
            event.place, event.title
        ].filter(Boolean).join(' ').toLowerCase();
        const volcanic = /\b(volcan|vulkan|volcano|volcanic|erupsi|eruption|magmatic)\b/.test(raw);
        const keywordWater = /\b(sea|ocean|offshore|water|laut|samudra|perairan|selat|teluk)\b/.test(raw);
        const gis = window.AdvancedAstroGIS;
        const waterSources = gis && typeof gis.getSource === 'function'
            ? ['naturalEarth:ocean', 'naturalEarth:marinePolys', 'naturalEarth:lakes'].map((key) => gis.getSource(key)).filter(Boolean)
            : [];
        const hasWaterGeometry = waterSources.some((source) => source.getFeatures().length > 0);
        const water = Array.isArray(coordinate) && hasWaterGeometry
            ? waterSources.some((source) => source.getFeatures().some((feature) => {
                const geometry = feature.getGeometry();
                return geometry && geometry.intersectsCoordinate && geometry.intersectsCoordinate(coordinate);
            }))
            : keywordWater;
        const environment = water ? 'water' : 'land';
        const type = volcanic ? 'volcanic' : 'tectonic';
        const file = MpmBuildFile(`emergency_earthquake_${environment}_${type === 'volcanic' ? 'vulcanic' : 'tectonic'}.png`);
        return {
            type,
            typeLabel: volcanic ? 'Vulkanik' : 'Tektonik',
            environment,
            environmentLabel: water ? 'Perairan / laut' : 'Darat',
            iconPath: `map/weather/${file}`,
            source: volcanic ? 'atribut sumber / kata kunci vulkanik' : 'default tektonik; atribut vulkanik tidak tersedia'
        };
    }

    function earthquakeMagnitudeClass(magnitude) {
        return window.MpmEarthquakeRadius && typeof window.MpmEarthquakeRadius.magnitudeClass === 'function'
            ? window.MpmEarthquakeRadius.magnitudeClass(magnitude)
            : { key: 'unknown', label: localized('Tidak tersedia', 'Unavailable'), color: '#94a3b8' };
    }

    function earthquakeMagnitudeLegendHtml() {
        return window.MpmEarthquakeRadius && typeof window.MpmEarthquakeRadius.legendHtml === 'function'
            ? window.MpmEarthquakeRadius.legendHtml()
            : '';
    }

    function clearEarthquakeRadius() {
        if (window.MpmEarthquakeRadius && typeof window.MpmEarthquakeRadius.clearForKind === 'function') {
            window.MpmEarthquakeRadius.clearForKind('earthquake');
        }
    }

    function refreshEarthquakeClassifications() {
        if (!state.data) {
            return;
        }
        state.features.earthquakes.forEach((feature) => {
            const event = feature.get('record') || {};
            const geometry = feature.getGeometry();
            const classification = geometry ? classifyEarthquake(event, geometry.getCoordinates()) : null;
            if (!classification) return;
            const magnitudeClass = earthquakeMagnitudeClass(event.magnitude);
            const enrichedEvent = Object.assign({}, event, {
                earthquakeType: classification.type,
                earthquakeTypeLabel: classification.typeLabel,
                epicenterEnvironment: classification.environment,
                epicenterEnvironmentLabel: classification.environmentLabel,
                classificationSource: classification.source,
                iconPath: classification.iconPath,
                magnitudeClass: magnitudeClass.key,
                magnitudeClassLabel: magnitudeClass.label,
                magnitudeColor: magnitudeClass.color
            });
            feature.setProperties({
                earthquakeType: classification.type,
                earthquakeTypeLabel: classification.typeLabel,
                epicenterEnvironment: classification.environment,
                epicenterEnvironmentLabel: classification.environmentLabel,
                classificationSource: classification.source,
                iconPath: classification.iconPath,
                magnitudeClass: magnitudeClass.key,
                magnitudeClassLabel: magnitudeClass.label,
                magnitudeColor: magnitudeClass.color,
                record: enrichedEvent,
                infoHtml: earthquakePopup(enrichedEvent)
            });
        });
        if (state.layers.earthquake) state.layers.earthquake.changed();
        renderEarthquakePanel();
    }

    function weatherGlyph(code) {
        const value = Number(code);
        if (value === 0 || value === 1) {
            return '☀';
        }
        if (value >= 95) {
            return '⚡';
        }
        if (value >= 51) {
            return '☂';
        }
        return '☁';
    }

    function syncEnvironmentalFeatureRegistry() {
        if (!window.AdvancedAstroGIS || typeof window.AdvancedAstroGIS.replaceFeatureRegistry !== 'function') {
            return;
        }
        const entries = [];
        const weather = state.data && state.data.weather ? state.data.weather : {};
        const selected = selectedWeatherRecord();
        if (state.features.weather && selected) {
            entries.push({
                id: 'weather', type: 'weather', name: localized('Weather & Temperature', 'Weather & Temperature'),
                layer: state.layers.weather, marker: state.features.weather,
                popup: () => weatherPopup(selectedWeatherRecord()), infoBoxData: () => weatherRows(selectedWeatherRecord()),
                iconLabel: localized('Ikon Kondisi Cuaca', 'Weather Condition icon'),
                iconMeaning: localized('Menampilkan kondisi cuaca provider pada lokasi aktif.', 'Shows provider weather conditions at the active location.'),
                visibility: () => state.layers.weather.getVisible(), reviewerEnabled: true, priority: 60,
                dataSource: weather.source ? weather.source.provider : '', dataStatus: weather.dataStatus || ''
            });
        }
        if (state.features.temperature && selected) {
            entries.push({
                id: 'temperature', type: 'temperature', name: localized('Temperatur', 'Temperature'),
                layer: state.layers.temperature, marker: state.features.temperature,
                popup: () => weatherPopup(selectedWeatherRecord()), infoBoxData: () => weatherRows(selectedWeatherRecord()),
                iconLabel: localized('Badge Temperatur', 'Temperature badge'),
                iconMeaning: localized('Menampilkan angka temperatur dari record Weather yang sama.', 'Shows the temperature value from the same Weather record.'),
                visibility: () => state.layers.temperature.getVisible(), reviewerEnabled: true, priority: 59,
                dataSource: weather.source ? weather.source.provider : '', dataStatus: weather.dataStatus || ''
            });
        }
        if (state.features.cloud && selected) {
            entries.push({
                id: 'cloud-condition', type: 'cloud-condition', name: localized('Kondisi Tutupan Awan', 'Cloud Cover Condition'),
                layer: state.layers.cloud, marker: state.features.cloud,
                popup: () => cloudPopup(selectedWeatherRecord()), visibility: () => state.layers.cloud.getVisible(),
                iconLabel: localized('Indikator Tutupan Awan', 'Cloud Cover indicator'),
                iconMeaning: localized('Menampilkan persentase tutupan awan dari provider Weather.', 'Shows the cloud-cover percentage from the Weather provider.'),
                reviewerEnabled: true, priority: 55, dataSource: weather.source ? weather.source.provider : '',
                dataStatus: weather.dataStatus || ''
            });
        }
        state.features.earthquakes.forEach((feature) => {
            const event = feature.get('record') || {};
            entries.push({
                id: `earthquake:${event.eventId || feature.get('recordId')}`,
                type: 'earthquake', name: feature.get('label') || localized('Gempa', 'Earthquake'),
                layer: state.layers.earthquake, marker: feature, popup: () => earthquakePopup(event),
                iconLabel: `${localized('Ikon Gempa', 'Earthquake icon')} M ${displayNumber(event.magnitude, 1)}`,
                iconMeaning: localized('Ukuran dan warna ikon mewakili magnitudo event gempa.', 'The icon size and color represent earthquake magnitude.'),
                visibility: () => state.layers.earthquake.getVisible(), reviewerEnabled: true,
                priority: Number(event.significance || 0), dataSource: event.provider || '', dataStatus: event.dataStatus || ''
            });
        });
        state.features.wildfires.forEach((feature) => {
            const event = feature.get('record') || {};
            entries.push({
                id: `wildfire:${event.detectionId || feature.get('recordId')}`,
                type: 'wildfire', name: event.title || localized('Wildfire / Hotspot', 'Wildfire / Hotspot'),
                layer: state.layers.wildfire, marker: feature, popup: () => wildfirePopup(event),
                iconLabel: localized('Ikon Wildfire / Hotspot', 'Wildfire / Hotspot icon'),
                iconMeaning: localized('Menandai lokasi atau area deteksi wildfire dari sumber satelit.', 'Marks a satellite-sourced wildfire detection location or area.'),
                visibility: () => state.layers.wildfire.getVisible(), reviewerEnabled: true,
                priority: 75, dataSource: event.provider || '', dataStatus: event.dataStatus || ''
            });
        });
        window.AdvancedAstroGIS.replaceFeatureRegistry('environmental', entries);
    }

    function renderLayers() {
        if (!ensureMapLayers() || !state.data) return;
        const original = state.sources, previousFeatures = state.features;
        const staging = Object.fromEntries(Object.keys(original).map((key) => [key, new ol.source.Vector()]));
        state.sources = staging;
        state.features = { ...previousFeatures };
        try { buildEnvironmentalLayers(); }
        catch (error) { state.features = previousFeatures; throw error; }
        finally { state.sources = original; }
        const retained = new Map();
        Object.keys(original).forEach((key) => {
            MpmLiveMapData.sync(original[key], staging[key].getFeatures()).forEach((f) => retained.set(MpmLiveMapData.identity(f), f));
        });
        Object.keys(state.features).forEach((key) => {
            const value = state.features[key], resolve = (f) => f ? retained.get(MpmLiveMapData.identity(f)) || f : null;
            state.features[key] = Array.isArray(value) ? value.map(resolve) : resolve(value);
        });
        applyLayerVisibility(); syncEnvironmentalFeatureRegistry(); updateTemperatureMapDisplay();
    }

    function buildEnvironmentalLayers() {
        if (!ensureMapLayers() || !state.data) {
            return;
        }
        Object.values(state.sources).forEach((source) => source.clear());
        state.features.weather = null;
        state.features.temperature = null;
        state.features.cloud = null;
        state.features.earthquakes = [];
        state.features.wildfires = [];

        const weather = state.data.weather || {};
        const record = selectedWeatherRecord();
        if (weather.available && record) {
            const coordinate = ol.proj.fromLonLat([Number(record.longitude), Number(record.latitude)]);
            const weatherFeature = new ol.Feature({ geometry: new ol.geom.Point(coordinate) });
            weatherFeature.setProperties({
                kind: 'weather',
                popupKey: `weather:${record.locationKey || 'location'}`,
                recordId: record.id,
                label: localized('Prakiraan Cuaca', 'Weather Forecast'),
                weatherCode: record.weatherCode
            });
            weatherFeature.set('infoHtml', weatherPopup(record), true);
            state.sources.weather.addFeature(weatherFeature);
            state.features.weather = weatherFeature;

            const temperatureFeature = new ol.Feature({ geometry: new ol.geom.Point(coordinate) });
            temperatureFeature.setProperties({
                kind: 'temperature',
                popupKey: `temperature:${record.locationKey || 'location'}`,
                recordId: record.id,
                label: localized('Temperatur', 'Temperature'),
                temperature: record.temperature,
                infoHtml: weatherPopup(record)
            });
            state.sources.temperature.addFeature(temperatureFeature);
            state.features.temperature = temperatureFeature;

            if (number(record.cloudCover) !== null) {
                const cloudFeature = new ol.Feature({ geometry: new ol.geom.Point(coordinate) });
                cloudFeature.setProperties({
                    kind: 'cloud-condition',
                    popupKey: `cloud:${record.locationKey || 'location'}`,
                    recordId: record.id,
                    label: localized('Kondisi Awan', 'Cloud Condition'),
                    cloudCover: record.cloudCover,
                    infoHtml: cloudPopup(record)
                });
                state.sources.cloud.addFeature(cloudFeature);
                state.features.cloud = cloudFeature;
            }
        }

        ((state.data.earthquakes || {}).events || []).forEach((event) => {
            if (number(event.latitude) === null || number(event.longitude) === null) {
                return;
            }
            const feature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([Number(event.longitude), Number(event.latitude)]))
            });
            const coordinate = feature.getGeometry().getCoordinates();
            const classification = classifyEarthquake(event, coordinate);
            const magnitudeClass = earthquakeMagnitudeClass(event.magnitude);
            const earthquakeKey = event.eventId || event.id || event.place || `${event.latitude}:${event.longitude}`;
            const enrichedEvent = Object.assign({}, event, {
                earthquakeType: classification.type,
                earthquakeTypeLabel: classification.typeLabel,
                epicenterEnvironment: classification.environment,
                epicenterEnvironmentLabel: classification.environmentLabel,
                classificationSource: classification.source,
                iconPath: classification.iconPath,
                magnitudeClass: magnitudeClass.key,
                magnitudeClassLabel: magnitudeClass.label,
                magnitudeColor: magnitudeClass.color
            });
            feature.setProperties({
                kind: 'earthquake',
                popupKey: earthquakeKey,
                recordId: earthquakeKey,
                label: `Earthquake M ${displayNumber(event.magnitude, 1)}`,
                magnitude: event.magnitude,
                earthquakeType: classification.type,
                earthquakeTypeLabel: classification.typeLabel,
                epicenterEnvironment: classification.environment,
                epicenterEnvironmentLabel: classification.environmentLabel,
                iconPath: classification.iconPath,
                magnitudeClass: magnitudeClass.key,
                magnitudeClassLabel: magnitudeClass.label,
                magnitudeColor: magnitudeClass.color,
                classificationSource: classification.source,
                record: enrichedEvent,
                infoHtml: earthquakePopup(enrichedEvent)
            });
            state.sources.earthquake.addFeature(feature);
            state.features.earthquakes.push(feature);
        });

        ((state.data.wildfires || {}).detections || []).forEach((event) => {
            let geometry = null;
            try {
                if (event.geometry && event.geometry.type) {
                    geometry = new ol.format.GeoJSON().readGeometry(event.geometry, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                }
            } catch (error) {
                geometry = null;
            }
            if (!geometry && number(event.latitude) !== null && number(event.longitude) !== null) {
                geometry = new ol.geom.Point(ol.proj.fromLonLat([Number(event.longitude), Number(event.latitude)]));
            }
            if (!geometry) {
                return;
            }
            const feature = new ol.Feature({ geometry });
            feature.setProperties({
                kind: 'wildfire',
                popupKey: event.detectionId,
                recordId: event.detectionId,
                label: event.title || localized('Wildfire', 'Wildfire'),
                record: event,
                infoHtml: wildfirePopup(event)
            });
            state.sources.wildfire.addFeature(feature);
            state.features.wildfires.push(feature);
        });
        if (isReviewer()) {
            const quakeConfig = configFor('earthquake') || {};
            const wildfireConfig = configFor('wildfire') || {};
            const earthquakeMaximum = Math.max(0, Number(quakeConfig.maxItemsPerCycle || state.config.settings.maxEarthquakesPerCycle || 3));
            const wildfireMaximum = Math.max(0, Number(wildfireConfig.maxItemsPerCycle || state.config.settings.maxWildfiresPerCycle || 3));
            const presentedEarthquakes = state.features.earthquakes.slice().sort((leftFeature, rightFeature) => {
                const left = leftFeature.get('record') || {};
                const right = rightFeature.get('record') || {};
                return Number(right.significance || 0) - Number(left.significance || 0)
                    || Number(right.magnitude || 0) - Number(left.magnitude || 0)
                    || new Date(right.occurredAt || 0) - new Date(left.occurredAt || 0);
            }).slice(0, earthquakeMaximum);
            const presentedWildfires = state.features.wildfires.slice(0, wildfireMaximum);
            state.sources.earthquake.clear();
            state.sources.wildfire.clear();
            state.sources.earthquake.addFeatures(presentedEarthquakes);
            state.sources.wildfire.addFeatures(presentedWildfires);
        }
    }

    function renderSelectedWeatherLayers() {
        if (!ensureMapLayers() || !state.data) {
            return;
        }
        ['weather', 'temperature', 'cloud'].forEach((key) => state.sources[key].clear());
        state.features.weather = null;
        state.features.temperature = null;
        state.features.cloud = null;
        const weather = state.data.weather || {};
        const record = selectedWeatherRecord();
        if (weather.available && record && number(record.latitude) !== null && number(record.longitude) !== null) {
            const coordinate = ol.proj.fromLonLat([Number(record.longitude), Number(record.latitude)]);
            const weatherFeature = new ol.Feature({ geometry: new ol.geom.Point(coordinate) });
            weatherFeature.setProperties({
                kind: 'weather',
                popupKey: `weather:${record.locationKey || 'location'}`,
                recordId: record.id,
                label: localized('Prakiraan Cuaca', 'Weather Forecast'),
                weatherCode: record.weatherCode,
                infoHtml: weatherPopup(record)
            });
            state.sources.weather.addFeature(weatherFeature);
            state.features.weather = weatherFeature;

            const temperatureFeature = new ol.Feature({ geometry: new ol.geom.Point(coordinate) });
            temperatureFeature.setProperties({
                kind: 'temperature',
                popupKey: `temperature:${record.locationKey || 'location'}`,
                recordId: record.id,
                label: localized('Temperatur', 'Temperature'),
                temperature: record.temperature,
                infoHtml: weatherPopup(record)
            });
            state.sources.temperature.addFeature(temperatureFeature);
            state.features.temperature = temperatureFeature;

            if (number(record.cloudCover) !== null) {
                const cloudFeature = new ol.Feature({ geometry: new ol.geom.Point(coordinate) });
                cloudFeature.setProperties({
                    kind: 'cloud-condition',
                    popupKey: `cloud:${record.locationKey || 'location'}`,
                    recordId: record.id,
                    label: localized('Kondisi Awan', 'Cloud Condition'),
                    cloudCover: record.cloudCover,
                    infoHtml: cloudPopup(record)
                });
                state.sources.cloud.addFeature(cloudFeature);
                state.features.cloud = cloudFeature;
            }
        }
        applyLayerVisibility();
        syncEnvironmentalFeatureRegistry();
        updateTemperatureMapDisplay();
    }

    function applyLayerVisibility() {
        const mapping = {
            weather: 'weatherToggle',
            temperature: 'temperatureToggle',
            cloud: 'cloudToggle',
            earthquake: 'earthquakeToggle',
            earthquakeIntensity: 'earthquakeToggle',
            wildfire: 'wildfireToggle'
        };
        Object.entries(mapping).forEach(([key, id]) => {
            const toggle = byId(id);
            if (state.layers[key]) {
                state.layers[key].setVisible(toggle ? toggle.checked : true);
            }
        });
        const earthquakeToggle = byId('earthquakeToggle');
        if (earthquakeToggle && !earthquakeToggle.checked) {
            clearEarthquakeRadius();
        }
        updateTemperatureMapDisplay();
    }

    function selectedWeatherRecord() {
        const weather = state.data && state.data.weather ? state.data.weather : {};
        const forecast = Array.isArray(weather.forecast) ? weather.forecast : [];
        if (state.selectedForecastIndex >= 0 && forecast[state.selectedForecastIndex]) {
            return forecast[state.selectedForecastIndex];
        }
        return weather.current || forecast[0] || null;
    }

    function todayForecast() {
        const forecast = state.data && state.data.weather && Array.isArray(state.data.weather.forecast)
            ? state.data.weather.forecast
            : [];
        return forecast[0] || null;
    }

    function weatherRows(record) {
        const current = state.data && state.data.weather ? state.data.weather.current : null;
        const daily = record && record.forecastKind === 'current' ? todayForecast() : record;
        const rows = [
            { label: localized('Lokasi', 'Location'), value: record.locationName },
            { label: localized('Berlaku', 'Forecast for'), value: formatDate(record.forecastFor, true) },
            { label: localized('Kondisi', 'Condition'), value: record.weatherDescription || `WMO ${record.weatherCode || '-'}` },
            { label: localized('Temperatur', 'Temperature'), value: temperatureText(record.temperature) },
            { label: localized('Terasa seperti', 'Feels like'), value: number(record.feelsLike) === null ? '' : temperatureText(record.feelsLike) },
            { label: localized('Min / Maks', 'Min / Max'), value: daily ? temperatureRange(daily) : '' },
            { label: localized('Kelembapan', 'Humidity'), value: number(record.humidity) === null ? '' : `${displayNumber(record.humidity, 0)}%` },
            { label: localized('Tekanan', 'Pressure'), value: number(record.pressure) === null ? '' : `${displayNumber(record.pressure, 1)} hPa` },
            { label: localized('Angin', 'Wind'), value: number(record.windSpeed) === null ? '' : `${displayNumber(record.windSpeed, 1)} km/h · ${displayNumber(record.windDirection, 0)}°` },
            { label: localized('Tutupan awan', 'Cloud cover'), value: number(record.cloudCover) === null ? '' : `${displayNumber(record.cloudCover, 0)}%` },
            { label: localized('Peluang hujan', 'Precipitation probability'), value: number(record.precipitationProbability) === null ? '' : `${displayNumber(record.precipitationProbability, 0)}%` },
            { label: localized('Hujan', 'Rain'), value: number(record.rain) === null ? '' : `${displayNumber(record.rain, 1)} mm` },
            { label: localized('Visibilitas', 'Visibility'), value: number(record.visibility) === null ? '' : `${displayNumber(record.visibility / 1000, 1)} km` },
            { label: localized('Terbit / Terbenam', 'Sunrise / Sunset'), value: record.sunrise || record.sunset ? `${formatDate(record.sunrise, true)} / ${formatDate(record.sunset, true)}` : '' },
            { label: localized('Diambil', 'Fetched'), value: formatDate(record.fetchedAt, true) },
            { label: localized('Status data', 'Data status'), value: record.dataStatus || (state.data.weather && state.data.weather.dataStatus) || '' }
        ];
        if (record.forecastKind === 'current' && current && current.id !== record.id) {
            rows.unshift({ label: localized('Pengukuran', 'Measurement'), value: formatDate(current.forecastFor, true) });
        }
        return rows;
    }

    function weatherPopup(record) {
        const source = Object.assign({}, (state.data && state.data.weather && state.data.weather.source) || {}, {
            rawSourceReference: record.rawSourceReference,
            provider: record.provider || (state.data.weather.source && state.data.weather.source.provider)
        });
        return popupHtml(localized('Weather & Temperature', 'Weather & Temperature'), weatherRows(record), source);
    }

    function cloudPopup(record) {
        return popupHtml(localized('Kondisi Tutupan Awan', 'Cloud Cover Condition'), [
            { label: localized('Lokasi', 'Location'), value: record.locationName },
            { label: localized('Tutupan awan', 'Cloud cover'), value: `${displayNumber(record.cloudCover, 0)}%` },
            { label: localized('Visualisasi', 'Visualization'), value: localized('Angka provider; bukan raster awan buatan', 'Provider percentage; not a fabricated cloud raster') },
            { label: localized('Berlaku', 'Forecast for'), value: formatDate(record.forecastFor, true) },
            { label: localized('Status', 'Status'), value: record.dataStatus || state.data.weather.dataStatus }
        ], state.data.weather.source || {});
    }

    function earthquakePopup(event) {
        return popupHtml(localized('Informasi Gempa', 'Earthquake Information'), [
            { label: 'Event ID', value: event.eventId },
            { label: localized('Waktu', 'Time'), value: formatDate(event.occurredAt, true) },
            { label: localized('Lintang', 'Latitude'), value: displayNumber(event.latitude, 5) },
            { label: localized('Bujur', 'Longitude'), value: displayNumber(event.longitude, 5) },
            { label: localized('Magnitudo', 'Magnitude'), value: number(event.magnitude) === null ? '' : `${displayNumber(event.magnitude, 1)} ${event.magnitudeType || ''}` },
            { label: localized('Kedalaman', 'Depth'), value: number(event.depthKm) === null ? '' : `${displayNumber(event.depthKm, 1)} km` },
            { label: localized('Jenis gempa', 'Earthquake type'), value: event.earthquakeTypeLabel || localized('Tektonik (fallback)', 'Tectonic (fallback)') },
            { label: localized('Posisi pusat gempa', 'Epicenter environment'), value: event.epicenterEnvironmentLabel || localized('Darat', 'Land') },
            { label: localized('Tingkat magnitudo', 'Magnitude level'), value: earthquakeMagnitudeClass(event.magnitude).label },
            { label: localized('Ikon', 'Icon'), value: event.iconPath ? event.iconPath.split('/').pop() : '' },
            { label: localized('Dasar klasifikasi', 'Classification basis'), value: event.classificationSource || localized('Atribut sumber', 'Source attributes') },
            { label: localized('Lokasi', 'Place'), value: event.place },
            { label: 'Status', value: event.status },
            { label: 'Tsunami', value: event.tsunami === null ? '' : (event.tsunami ? localized('Ya', 'Yes') : localized('Tidak', 'No')) },
            { label: localized('Laporan dirasakan', 'Felt reports'), value: event.feltReports === null ? '' : String(event.feltReports) },
            { label: localized('Revisi', 'Revisions'), value: String(event.revisionCount || 1) },
            { label: localized('Diambil', 'Fetched'), value: formatDate(event.fetchedAt, true) },
            { label: localized('Status data', 'Data status'), value: event.dataStatus }
        ], { provider: event.provider, sourceUrl: event.sourceUrl });
    }

    function wildfirePopup(event) {
        return popupHtml(localized('Informasi Wildfire / Hotspot', 'Wildfire / Hotspot Information'), [
            { label: 'Event ID', value: event.eventId },
            { label: localized('Deteksi', 'Detection'), value: event.detectionId },
            { label: localized('Waktu', 'Time'), value: formatDate(event.detectionAt, true) },
            { label: localized('Tipe geometri', 'Geometry type'), value: event.geometryType },
            { label: localized('Wilayah', 'Region'), value: event.region },
            { label: localized('Confidence', 'Confidence'), value: event.confidence || '' },
            { label: localized('Satelit / sumber', 'Satellite / source'), value: event.satelliteSource || '' },
            { label: localized('Brightness', 'Brightness'), value: number(event.brightness) === null ? '' : displayNumber(event.brightness, 2) },
            { label: 'FRP', value: number(event.fireRadiativePower) === null ? '' : displayNumber(event.fireRadiativePower, 2) },
            { label: localized('Besaran sumber', 'Source magnitude'), value: number(event.magnitudeValue) === null ? '' : `${displayNumber(event.magnitudeValue, 2)} ${event.magnitudeUnit || ''}` },
            { label: 'Status', value: event.status },
            { label: localized('Diambil', 'Fetched'), value: formatDate(event.fetchedAt, true) },
            { label: localized('Status data', 'Data status'), value: event.dataStatus }
        ], { provider: event.provider, sourceUrl: event.sourceUrl });
    }

    function renderPanels() {
        if (!state.data) {
            return;
        }
        renderWeatherPanel();
        renderEarthquakePanel();
        renderWildfirePanel();
    }

    function renderWeatherPanel() {
        const weather = state.data.weather || {};
        const record = selectedWeatherRecord();
        setStatusBadge('weatherStatusBadge', weather.dataStatus || 'Source Unavailable');
        const currentElement = byId('weatherCurrentInfo');
        if (currentElement) {
            if (!record) {
                currentElement.innerHTML = `<strong>-</strong><span>${escapeHtml(localized('Data cuaca tidak tersedia.', 'Weather data is unavailable.'))}</span>`;
            } else {
                const daily = record.forecastKind === 'current' ? todayForecast() : record;
                const feels = number(record.feelsLike) === null ? '' : `${localized('Terasa seperti', 'Feels like')} ${temperatureText(record.feelsLike)}`;
                const range = daily ? temperatureRange(daily) : '';
                currentElement.innerHTML = [
                    `<strong>${escapeHtml(temperatureText(record.temperature))}</strong>`,
                    `<span>${escapeHtml(record.locationName || '')}</span>`,
                    feels ? `<span>${escapeHtml(feels)}</span>` : '',
                    range && range !== '-' ? `<span>${escapeHtml(`${localized('Min/Maks', 'Min/Max')} ${range}`)}</span>` : '',
                    `<span>${escapeHtml(`${record.weatherDescription || `WMO ${record.weatherCode || '-'}`} · ${record.dataStatus || weather.dataStatus || ''}`)}</span>`
                ].join('');
            }
        }
        const forecastElement = byId('weatherForecastCards');
        if (forecastElement) {
            forecastElement.innerHTML = (weather.forecast || []).slice(0, 5).map((day, index) => {
                const title = index === 0 ? localized('Hari ini', 'Today')
                    : (index === 1 ? localized('Besok', 'Tomorrow') : `${localized('Hari', 'Day')} ${index + 1}`);
                return `<button class="weather-forecast-card${state.selectedForecastIndex === index ? ' is-active' : ''}" type="button" data-weather-day="${index}">
                    <strong>${escapeHtml(title)}</strong>
                    <span>${escapeHtml(temperatureRange(day))}</span>
                    <span>${escapeHtml(day.weatherDescription || `WMO ${day.weatherCode || '-'}`)}</span>
                    <span>${escapeHtml(number(day.cloudCover) === null ? '' : `${localized('Awan', 'Clouds')} ${displayNumber(day.cloudCover, 0)}%`)}</span>
                </button>`;
            }).join('');
        }
        const cloud = byId('weatherCloudInfo');
        if (cloud) {
            cloud.textContent = record && number(record.cloudCover) !== null
                ? `${localized('Tutupan awan', 'Cloud cover')} ${displayNumber(record.cloudCover, 0)}% · ${localized('visual numerik dari provider; tidak ada raster/tile awan yang dibuat-buat.', 'numeric provider value; no fabricated cloud raster/tile.')}`
                : localized('Provider tidak menyediakan nilai tutupan awan untuk record ini.', 'The provider did not supply cloud cover for this record.');
        }
        renderSourceCard('weatherSourceInfo', weather.source);
        updateTemperatureMapDisplay();
    }

    function renderEarthquakePanel() {
        const group = state.data.earthquakes || {};
        const events = Array.isArray(group.events) ? group.events : [];
        const status = group.source && group.source.dataStatus ? group.source.dataStatus : (events[0] && events[0].dataStatus);
        setStatusBadge('earthquakeStatusBadge', status || 'Source Unavailable');
        const list = byId('earthquakeList');
        if (list) {
            const page = environmentPanelPage('earthquake', events.length);
            list.innerHTML = events.length ? `${environmentPagerHtml('earthquake', page)}${events.slice(page.start, page.end).map((event) => `<button class="environment-event-card" type="button" data-earthquake-id="${escapeHtml(event.eventId)}">
                <strong>M ${escapeHtml(displayNumber(event.magnitude, 1))} · ${escapeHtml(event.place || event.eventId)}</strong>
                <span>${escapeHtml(`${formatDate(event.occurredAt, true)} · ${displayNumber(event.depthKm, 1)} km`)}</span>
                <span>${escapeHtml(`${event.provider || ''} · ${event.dataStatus || ''}`)}</span>
            </button>`).join('')}` : `<div class="environment-note">${escapeHtml(localized('Tidak ada event dalam window aktif.', 'No events in the active window.'))}</div>`;
        }
        renderEarthquakeSourceCard(group.source);
    }

    function renderEarthquakeSourceCard(source) {
        renderSourceCard('earthquakeSourceInfo', source);
        const sourceInfo = byId('earthquakeSourceInfo');
        if (sourceInfo) {
            sourceInfo.insertAdjacentHTML('beforeend', `${earthquakeMagnitudeLegendHtml()}<div class="environment-note">${escapeHtml(localized('Klik ikon gempa di peta untuk menampilkan estimasi radius dirasakan. Klik area radius untuk informasi dan kontrol animasi; jeda menampilkan radius penuh.', 'Click an earthquake icon on the map to display its estimated felt radius. Click the radius area for information and animation controls; pausing restores the full radius.'))}</div>`);
        }
    }

    function renderWildfirePanel() {
        const group = state.data.wildfires || {};
        const detections = Array.isArray(group.detections) ? group.detections : [];
        const status = group.source && group.source.dataStatus ? group.source.dataStatus : (detections[0] && detections[0].dataStatus);
        setStatusBadge('wildfireStatusBadge', status || 'Source Unavailable');
        const list = byId('wildfireList');
        if (list) {
            const page = environmentPanelPage('wildfire', detections.length);
            list.innerHTML = detections.length ? `${environmentPagerHtml('wildfire', page)}${detections.slice(page.start, page.end).map((event) => `<button class="environment-event-card" type="button" data-wildfire-id="${escapeHtml(event.detectionId)}">
                <strong>${escapeHtml(event.title || event.eventId)}</strong>
                <span>${escapeHtml(`${formatDate(event.detectionAt, true)} · ${event.geometryType || 'Point'}`)}</span>
                <span>${escapeHtml(`${event.satelliteSource || event.provider || ''} · ${event.dataStatus || ''}`)}</span>
            </button>`).join('')}` : `<div class="environment-note">${escapeHtml(localized('Tidak ada wildfire/hotspot dalam window aktif.', 'No wildfire/hotspot in the active window.'))}</div>`;
        }
        renderSourceCard('wildfireSourceInfo', group.source);
    }

    function environmentPanelPage(kind, total) {
        const pageCount = Math.max(1, Math.ceil(total / PANEL_EVENT_PAGE_SIZE));
        const requested = Number(state.panelPages[kind] || 0);
        const index = Math.max(0, Math.min(pageCount - 1, Number.isFinite(requested) ? requested : 0));
        state.panelPages[kind] = index;
        const start = index * PANEL_EVENT_PAGE_SIZE;
        return {
            index,
            pageCount,
            total,
            start,
            end: Math.min(total, start + PANEL_EVENT_PAGE_SIZE)
        };
    }

    function environmentPagerHtml(kind, page) {
        const range = `${page.start + 1}–${page.end}`;
        const summary = localized(
            `Menampilkan ${range} dari ${page.total}`,
            `Showing ${range} of ${page.total}`
        );
        const previousLabel = localized('Halaman sebelumnya', 'Previous page');
        const nextLabel = localized('Halaman berikutnya', 'Next page');
        const controls = page.pageCount > 1 ? `<div class="environment-list-pager">
            <button type="button" data-environment-page-kind="${kind}" data-environment-page-value="${page.index - 1}" aria-label="${escapeHtml(previousLabel)}"${page.index === 0 ? ' disabled' : ''}>‹</button>
            <output>${page.index + 1}/${page.pageCount}</output>
            <button type="button" data-environment-page-kind="${kind}" data-environment-page-value="${page.index + 1}" aria-label="${escapeHtml(nextLabel)}"${page.index >= page.pageCount - 1 ? ' disabled' : ''}>›</button>
        </div>` : '';
        return `<div class="environment-list-toolbar"><span>${escapeHtml(summary)}</span>${controls}</div>`;
    }

    function renderSourceCard(id, source) {
        const element = byId(id);
        if (!element) {
            return;
        }
        if (!source) {
            element.textContent = localized('Registry sumber tidak tersedia.', 'Source registry is unavailable.');
            return;
        }
        const url = safeUrl(source.documentationUrl || source.sourceUrl);
        element.innerHTML = [
            `<strong>${escapeHtml(`${source.provider || ''} · ${source.dataset || ''}`)}</strong>`,
            `<span>${escapeHtml(`${localized('Status', 'Status')}: ${source.dataStatus || source.providerStatus || '-'} · ${localized('Interval', 'Interval')}: ${source.updateFrequencyMinutes || '-'} min`)}</span>`,
            `<span>${escapeHtml(`${localized('Terakhir berhasil', 'Last successful')}: ${formatDate(source.lastSuccessfulAt, true)}`)}</span>`,
            `<span>${escapeHtml(`${localized('Berikutnya', 'Next')}: ${formatDate(source.nextUpdateAt, true)}`)}</span>`,
            `<span>${escapeHtml(`${localized('Lisensi/Terms', 'License/Terms')}: ${source.license || '-'}`)}</span>`,
            url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>` : '',
            source.error ? `<span>${escapeHtml(`${localized('Error', 'Error')}: ${source.error}`)}</span>` : ''
        ].join('');
    }

    function updateTemperatureMapDisplay() {
        const element = byId('temperatureMapDisplay');
        const toggle = byId('temperatureToggle');
        const record = selectedWeatherRecord();
        if (!element) {
            return;
        }
        if (!record || (toggle && !toggle.checked) || isReviewer()) {
            element.classList.add('hidden');
            return;
        }
        const daily = record.forecastKind === 'current' ? todayForecast() : record;
        const feels = number(record.feelsLike) === null ? '' : `${localized('Terasa', 'Feels')} ${temperatureText(record.feelsLike)}`;
        element.innerHTML = [
            `<strong>${escapeHtml(temperatureText(record.temperature))}</strong>`,
            `<span>${escapeHtml(record.locationName || '')}</span>`,
            feels ? `<span>${escapeHtml(feels)}</span>` : '',
            daily ? `<span>${escapeHtml(temperatureRange(daily))}</span>` : '',
            `<span>${escapeHtml(record.dataStatus || (state.data.weather && state.data.weather.dataStatus) || '')}</span>`
        ].join('');
        element.classList.remove('hidden');
    }

    function syncUnitControl() {
        const select = byId('temperatureUnitSelect');
        if (select) {
            select.value = state.temperatureUnit;
        }
    }

    function selectWeatherDay(index, options) {
        const forecast = state.data && state.data.weather && Array.isArray(state.data.weather.forecast)
            ? state.data.weather.forecast
            : [];
        if (index < -1 || index >= forecast.length) {
            return;
        }
        state.selectedForecastIndex = index;
        renderPanels();
        renderSelectedWeatherLayers();
        const record = selectedWeatherRecord();
        if (options && options.popup && record && state.features.weather && window.AdvancedAstroGIS) {
            state.features.weather.set('infoHtml', weatherPopup(record), true);
            window.AdvancedAstroGIS.showPopup(state.features.weather, weatherPopup(record));
        }
    }

    function focusFeature(feature, html, zoom) {
        if (!feature || !state.map) {
            return;
        }
        const geometry = feature.getGeometry();
        if (!geometry) {
            return;
        }
        let center;
        if (geometry.getType() === 'Point') {
            center = geometry.getCoordinates();
        } else {
            center = ol.extent.getCenter(geometry.getExtent());
        }
        let completed = false;
        let moveKey = null;
        const showFocusedPopup = (signal) => {
            if (completed) {
                return;
            }
            completed = true;
            state.lastTransitionSignal = signal;
            if (moveKey && window.ol && ol.Observable && typeof ol.Observable.unByKey === 'function') {
                ol.Observable.unByKey(moveKey);
            }
            if (window.AdvancedAstroGIS) {
                window.AdvancedAstroGIS.showPopup(feature, html || feature.get('infoHtml'), center);
            }
        };
        moveKey = state.map.once('moveend', () => showFocusedPopup('moveend'));
        state.map.getView().animate({ center, zoom: zoom || 7, duration: 900 }, (finished) => {
            if (finished) {
                showFocusedPopup('animation-callback');
            }
        });
        window.setTimeout(() => showFocusedPopup('fallback'), 1800);
    }

    function bindControls() {
        ['weatherToggle', 'temperatureToggle', 'cloudToggle', 'earthquakeToggle', 'wildfireToggle'].forEach((id) => {
            const element = byId(id);
            if (element) {
                element.addEventListener('change', applyLayerVisibility);
            }
        });
        const unit = byId('temperatureUnitSelect');
        if (unit) {
            unit.addEventListener('change', () => {
                state.temperatureUnit = normalizeUnit(unit.value);
                localStorage.setItem(UNIT_KEY, state.temperatureUnit);
                renderSelectedWeatherLayers();
                renderPanels();
                if (state.activePresentationFeature && state.activePresentationFeature.type === 'weather') {
                    updateWeatherPresentation(state.activePresentationFeature, state.lastWeatherDay, state.presentationRunId);
                }
            });
        }
        document.addEventListener('click', (event) => {
            const pageButton = event.target.closest('[data-environment-page-kind]');
            if (pageButton && !pageButton.disabled) {
                const kind = pageButton.dataset.environmentPageKind;
                const page = Number(pageButton.dataset.environmentPageValue);
                if ((kind === 'earthquake' || kind === 'wildfire') && Number.isFinite(page)) {
                    state.panelPages[kind] = page;
                    if (kind === 'earthquake') {
                        renderEarthquakePanel();
                    } else {
                        renderWildfirePanel();
                    }
                }
                return;
            }
            const weatherButton = event.target.closest('[data-weather-day]');
            if (weatherButton) {
                selectWeatherDay(Number(weatherButton.dataset.weatherDay), { popup: true });
                return;
            }
            const earthquakeButton = event.target.closest('[data-earthquake-id]');
            if (earthquakeButton) {
                if (window.AdvancedAstroGIS) {
                    window.AdvancedAstroGIS.activateTab('earthquake');
                }
                const feature = state.features.earthquakes.find((item) => item.get('recordId') === earthquakeButton.dataset.earthquakeId);
                if (feature) {
                    focusFeature(feature, feature.get('infoHtml'), 7);
                }
                return;
            }
            const wildfireButton = event.target.closest('[data-wildfire-id]');
            if (wildfireButton) {
                if (window.AdvancedAstroGIS) {
                    window.AdvancedAstroGIS.activateTab('wildfire');
                }
                const feature = state.features.wildfires.find((item) => item.get('recordId') === wildfireButton.dataset.wildfireId);
                if (feature) {
                    focusFeature(feature, feature.get('infoHtml'), 7);
                }
            }
        });
        window.addEventListener('mpm:astro-feature-focused', (event) => {
            const detail = event.detail || {};
            if (detail.kind === 'weather' || detail.kind === 'temperature' || detail.kind === 'cloud-condition') {
                if (window.AdvancedAstroGIS) {
                    window.AdvancedAstroGIS.activateTab('weather');
                }
                renderWeatherPanel();
            } else if (detail.kind === 'earthquake' && window.AdvancedAstroGIS) {
                window.AdvancedAstroGIS.activateTab('earthquake');
            } else if (detail.kind === 'wildfire' && window.AdvancedAstroGIS) {
                window.AdvancedAstroGIS.activateTab('wildfire');
            }
        });
        window.addEventListener('mpm:astro-popup-active-changed', (event) => {
            state.activePopupKey = event.detail && event.detail.featureKey ? event.detail.featureKey : '';
            Object.values(state.layers).forEach((layer) => layer && layer.changed());
        });
        window.addEventListener('mpm:natural-earth-ready', refreshEarthquakeClassifications);
        window.addEventListener('online', () => loadData().catch(() => {}));
        window.addEventListener(
            window.MpmAdminLocation && window.MpmAdminLocation.UPDATE_EVENT
                ? window.MpmAdminLocation.UPDATE_EVENT
                : 'mpm:admin-location-updated',
            () => loadData().catch(() => {})
        );
    }

    function configFor(key) {
        return (state.config.features || []).find((item) => item.feature === key) || null;
    }

    function baseScene(key, feature, title, rowsBuilder, extra) {
        const config = configFor(key);
        if (!config || config.enabled === false || !feature || !feature.getGeometry || !feature.getGeometry()) {
            return null;
        }
        return Object.assign({
            id: `${key}:${feature.get('popupKey') || feature.get('recordId') || 'base'}`,
            type: key,
            title,
            feature,
            config,
            order: Number(config.order || 999),
            priority: Number(config.priority || 0),
            duration: Math.max(1000, Number(config.duration || 8000)),
            rowsBuilder,
            sourceStatus: localized('Kalkulasi lokal', 'Local calculation')
        }, extra || {});
    }

    function sceneGeometryLabel(scene) {
        const geometry = scene && scene.feature && scene.feature.getGeometry
            ? scene.feature.getGeometry()
            : null;
        const type = geometry && geometry.getType ? geometry.getType() : '';
        if (type === 'Point' || type === 'MultiPoint') {
            return localized('Marker / ikon peta', 'Map marker / icon');
        }
        if (type === 'LineString' || type === 'MultiLineString') {
            return localized('Garis / trajektori', 'Line / trajectory');
        }
        if (type === 'Polygon' || type === 'MultiPolygon') {
            return localized('Area / cakupan', 'Area / coverage');
        }
        return localized('Feature GIS', 'GIS feature');
    }

    function sceneCatalogLabel(type) {
        const labels = {
            building: localized('Gedung', 'Building'),
            'ip-provider': 'IP provider',
            'provider-building-calibration': localized('Kalibrasi provider → gedung', 'Provider → building calibration'),
            sun: localized('Matahari', 'Sun'),
            timeline: localized('Timeline subsolar', 'Subsolar timeline'),
            moon: localized('Bulan', 'Moon'),
            'moon-phase': localized('Fase Bulan', 'Moon Phase'),
            kaabah: localized("Ka'bah / Kiblat", 'Kaabah / Qibla'),
            'kaabah-line': localized("Garis gedung → Ka'bah", 'Building → Kaabah line'),
            observer: localized('Lokasi observasi', 'Observation point'),
            trajectory: localized('Trajektori', 'Trajectory'),
            weather: localized('Cuaca & temperatur', 'Weather & temperature'),
            temperature: localized('Badge temperatur', 'Temperature badge'),
            'cloud-condition': localized('Tutupan awan', 'Cloud cover'),
            earthquake: localized('Gempa', 'Earthquake'),
            wildfire: localized('Wildfire / hotspot', 'Wildfire / hotspot'),
            'solar-eclipse': localized('Gerhana Matahari', 'Solar eclipse'),
            'lunar-eclipse': localized('Gerhana Bulan', 'Lunar eclipse')
        };
        return labels[type] || type || localized('Feature GIS', 'GIS feature');
    }

    function sceneCoordinateText(scene) {
        const center = sceneCenter(scene);
        if (!center || !window.ol || !ol.proj) {
            return '-';
        }
        try {
            const coordinate = ol.proj.toLonLat(center);
            return `${displayNumber(coordinate[1], 5)}, ${displayNumber(coordinate[0], 5)}`;
        } catch (error) {
            return '-';
        }
    }

    function sceneIconDescriptor(scene) {
        const feature = scene && scene.feature;
        const registryEntry = scene && scene.registryEntry ? scene.registryEntry : {};
        const record = feature && feature.get ? (feature.get('record') || {}) : {};
        const configuredUrl = registryEntry.iconUrl || (feature && feature.get ? feature.get('iconPath') : '');
        const descriptor = {
            type: scene && scene.type ? scene.type : 'feature',
            label: registryEntry.iconLabel || sceneCatalogLabel(scene && scene.type),
            meaning: registryEntry.iconMeaning || localized('Menandai feature aktif pada peta GIS.', 'Marks the active feature on the GIS map.'),
            url: configuredUrl || '',
            glyph: '●'
        };
        const glyphs = {
            observer: '◎',
            timeline: 'T',
            trajectory: '⌁',
            weather: feature && feature.get ? weatherGlyph(feature.get('weatherCode')) : '☁',
            temperature: feature && feature.get ? temperatureText(feature.get('temperature')) : '°',
            'cloud-condition': feature && feature.get ? `${displayNumber(feature.get('cloudCover'), 0)}%` : '☁',
            earthquake: `M${displayNumber(record.magnitude || (feature && feature.get && feature.get('magnitude')), 1)}`,
            wildfire: '!',
            'provider-building-calibration': '↔',
            'kaabah-line': '↗',
            'solar-eclipse': '◉',
            'lunar-eclipse': '◐'
        };
        descriptor.glyph = glyphs[descriptor.type] || descriptor.glyph;
        return descriptor;
    }

    function sceneIconMarkup(scene, compact) {
        const icon = sceneIconDescriptor(scene);
        const className = compact ? 'presentation-inventory-icon' : '';
        const imageUrl = icon.url ? safeUrl(icon.url) : '';
        if (imageUrl) {
            return `<i class="${className}" aria-hidden="true"><img src="${escapeHtml(imageUrl)}" alt=""></i>`;
        }
        return `<i class="${className}" aria-hidden="true">${escapeHtml(icon.glyph)}</i>`;
    }

    function setPresentationFeatureIcon(scene) {
        const element = byId('presentationFeatureIcon');
        if (!element) {
            return;
        }
        if (!scene) {
            element.innerHTML = '';
            element.classList.add('hidden');
            element.setAttribute('aria-hidden', 'true');
            delete element.dataset.iconType;
            return;
        }
        const descriptor = sceneIconDescriptor(scene);
        const imageUrl = descriptor.url ? safeUrl(descriptor.url) : '';
        element.innerHTML = imageUrl
            ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(descriptor.label)}">`
            : `<span>${escapeHtml(descriptor.glyph)}</span>`;
        element.dataset.iconType = descriptor.type;
        element.setAttribute('aria-label', descriptor.label);
        element.setAttribute('title', `${descriptor.label} — ${descriptor.meaning}`);
        element.setAttribute('aria-hidden', 'false');
        element.classList.remove('hidden');
    }

    function presentationInventoryHtml(scenes) {
        const catalog = new Map();
        scenes.forEach((scene) => {
            const current = catalog.get(scene.type) || { count: 0, scene };
            current.count += 1;
            catalog.set(scene.type, current);
        });
        const chips = Array.from(catalog.entries()).map(([type, entry]) => {
            const count = entry.count;
            const suffix = count > 1 ? ` ×${count}` : '';
            return `<span>${sceneIconMarkup(entry.scene, true)}${escapeHtml(`${sceneCatalogLabel(type)}${suffix}`)}</span>`;
        }).join('');
        return [
            `<p>${escapeHtml(localized(
                `${scenes.length} feature/record aktif siap dipresentasikan otomatis tanpa klik.`,
                `${scenes.length} active features/records are ready for automatic presentation without clicks.`
            ))}</p>`,
            `<div class="presentation-inventory">${chips}</div>`
        ].join('');
    }

    function scenePopupHtml(scene) {
        const rows = typeof scene.rowsBuilder === 'function' ? scene.rowsBuilder() : [];
        return popupHtml(scene.title, rows.concat([
            { label: localized('Tampilan GIS', 'GIS display'), value: sceneGeometryLabel(scene) }
        ]), null);
    }

    function popupContentDetails(html) {
        if (!html || typeof document === 'undefined') {
            return { title: '', rows: [] };
        }
        const template = document.createElement('template');
        template.innerHTML = html;
        const titleElement = template.content.querySelector('h4');
        const terms = Array.from(template.content.querySelectorAll('dt'));
        return {
            title: titleElement ? titleElement.textContent.trim() : '',
            rows: terms.map((term) => {
                const value = term.nextElementSibling && term.nextElementSibling.tagName === 'DD'
                    ? term.nextElementSibling.textContent.trim()
                    : '';
                return { label: term.textContent.trim(), value };
            }).filter((row) => row.label && row.value)
        };
    }

    function hydrateSceneClickContent(scene, explicitHtml) {
        if (!scene) {
            return '';
        }
        let html = typeof explicitHtml === 'string' ? explicitHtml : '';
        if (!html && scene.feature && window.AdvancedAstroGIS
            && typeof window.AdvancedAstroGIS.getFeatureInfoHtml === 'function') {
            html = window.AdvancedAstroGIS.getFeatureInfoHtml(scene.feature) || '';
        }
        if (!html) {
            html = scene.popupHtml
                || (scene.feature && scene.feature.get ? scene.feature.get('infoHtml') : '')
                || scenePopupHtml(scene);
        }
        scene.popupHtml = html;
        const details = popupContentDetails(html);
        scene.clickPopupTitle = details.title || scene.title;
        scene.clickPopupRows = details.rows;
        return html;
    }

    function activateScenePopup(scene, source, explicitHtml) {
        if (!scene || !scene.feature || scene.config.showPopup === false || !window.AdvancedAstroGIS) {
            return false;
        }
        const html = hydrateSceneClickContent(scene, explicitHtml);
        if (typeof window.AdvancedAstroGIS.presentFeature === 'function') {
            const result = window.AdvancedAstroGIS.presentFeature(scene.feature, {
                html,
                source: source || 'reviewer-sequence',
                persistHtml: false,
                updateStatus: false
            });
            return Boolean(result && result.shown);
        }
        return window.AdvancedAstroGIS.showPopup(scene.feature, html);
    }

    function buildPresentationScenes() {
        const scenes = [];
        const registry = window.AdvancedAstroGIS && typeof window.AdvancedAstroGIS.getFeatureRegistry === 'function'
            ? window.AdvancedAstroGIS.getFeatureRegistry({ validOnly: true, reviewerOnly: true })
            : [];
        const registryById = new Map(registry.map((entry) => [entry.id, entry]));
        const registryFeature = (id) => {
            const entry = registryById.get(id);
            return entry ? entry.marker : null;
        };
        const base = baseState();
        const snapshot = base.latestSnapshot || {};
        const admin = base.adminContext || {};
        const location = admin.location || {};
        const mosque = admin.mosque || admin.building || {};
        const add = (scene) => { if (scene) { scenes.push(scene); } };

        add(baseScene('building', registryFeature('building'),
            mosque.name || mosque.mosqueName || localized('Gedung / Facility', 'Building / Facility'),
            () => [
                { label: localized('Nama', 'Name'), value: mosque.name || mosque.mosqueName || admin.name || localized('Gedung aktif', 'Active building') },
                { label: localized('Lokasi', 'Location'), value: [location.city || location.adm2, location.country || location.adm0].filter(Boolean).join(', ') },
                { label: localized('Koordinat', 'Coordinate'), value: `${displayNumber(location.latitude || location.lat, 6)}, ${displayNumber(location.longitude || location.lon, 6)}` },
                { label: localized('Sumber', 'Source'), value: admin.source || 'admin-database' }
            ], { sourceStatus: admin.source || 'Database' }));

        add(baseScene('ip-provider', registryFeature('ip-provider'), localized('Service Provider / IP', 'Service Provider / IP'), () => {
            const provider = baseState().providerContext || {};
            const entry = registryById.get('ip-provider') || {};
            return [
                { label: localized('Nama ikon', 'Icon name'), value: 'IP provider' },
                { label: localized('Lokasi estimasi', 'Estimated location'), value: [provider.city, provider.region, provider.country].filter(Boolean).join(', ') || '-' },
                { label: localized('Koordinat', 'Coordinate'), value: Array.isArray(entry.coordinates) ? `${displayNumber(entry.coordinates[1], 6)}, ${displayNumber(entry.coordinates[0], 6)}` : '-' },
                { label: localized('Organisasi', 'Organization'), value: provider.org || provider.source || '-' },
                { label: localized('Peran', 'Role'), value: localized('Pembanding lokasi jaringan; bukan lokasi utama gedung.', 'Network-location comparison; not the primary building location.') }
            ];
        }, { sourceStatus: localized('Estimasi geolokasi IP', 'IP geolocation estimate') }));

        add(baseScene('provider-building-calibration', registryFeature('provider-building-calibration'), localized('Kalibrasi Provider → Gedung', 'Provider → Building Calibration'), () => {
            const calibration = baseState().timeCoordinateCalibration || {};
            const spatial = calibration.spatialDifference || {};
            const astronomical = calibration.astronomicalDifference || {};
            return [
                { label: localized('Nama feature', 'Feature name'), value: localized('Garis Kalibrasi Sian', 'Cyan Calibration Line') },
                { label: localized('Jarak', 'Distance'), value: number(spatial.distanceKilometers) === null ? '-' : `${displayNumber(spatial.distanceKilometers, 6)} km` },
                { label: localized('Bearing', 'Bearing'), value: number(spatial.bearingDegrees) === null ? '-' : `${displayNumber(spatial.bearingDegrees, 3)}°` },
                { label: localized('Selisih waktu bujur', 'Longitude time difference'), value: astronomical.longitudeDifferenceMilliseconds === undefined ? '-' : `${displayNumber(Number(astronomical.longitudeDifferenceMilliseconds) / 1000, 3)} s` },
                { label: localized('Peran', 'Role'), value: localized('Membandingkan estimasi IP dengan koordinat gedung database.', 'Compares the IP estimate with the database building coordinate.') }
            ];
        }, { sourceStatus: localized('Kalibrasi waktu-koordinat', 'Time-coordinate calibration') }));

        add(baseScene('sun', registryFeature('sun'), localized('Matahari', 'Sun'), () => {
            const sun = (baseState().latestSnapshot || {}).sun || {};
            return [
                { label: localized('Subsolar', 'Subsolar'), value: sun.subpoint ? `${displayNumber(sun.subpoint.lat, 3)}, ${displayNumber(sun.subpoint.lon, 3)}` : '-' },
                { label: localized('Alt / Az', 'Alt / Az'), value: sun.horizontal ? `${displayNumber(sun.horizontal.altitude, 2)}° / ${displayNumber(sun.horizontal.azimuth, 2)}°` : '-' },
                { label: localized('Jarak', 'Distance'), value: sun.distanceKm ? `${displayNumber(sun.distanceKm, 0)} km` : '-' },
                { label: localized('Waktu kalkulasi', 'Calculation time'), value: formatDate((baseState().latestSnapshot || {}).date, true) }
            ];
        }));

        add(baseScene('timeline', registryFeature('timeline'), localized('Timeline Subsolar', 'Subsolar Timeline'), () => {
            const current = baseState();
            const sun = (current.latestSnapshot || {}).sun || {};
            return [
                { label: localized('Nama ikon', 'Icon name'), value: localized('Titik Timeline', 'Timeline point') },
                { label: localized('Posisi', 'Position'), value: sun.subpoint ? `${displayNumber(sun.subpoint.lat, 4)}, ${displayNumber(sun.subpoint.lon, 4)}` : '-' },
                { label: localized('Waktu aktif', 'Active time'), value: formatDate((current.latestSnapshot || {}).date, true) },
                { label: localized('Mode', 'Mode'), value: current.live ? localized('Waktu aktual', 'Actual time') : localized('Timeline manual', 'Manual timeline') },
                { label: localized('Peran', 'Role'), value: localized('Menghubungkan waktu presentasi dengan posisi subsolar.', 'Links presentation time with the subsolar position.') }
            ];
        }, { sourceStatus: localized('Actual Time / Astronomy Engine', 'Actual Time / Astronomy Engine') }));

        add(baseScene('moon', registryFeature('moon'), localized('Bulan', 'Moon'), () => {
            const moon = (baseState().latestSnapshot || {}).moon || {};
            return [
                { label: localized('Sublunar', 'Sublunar'), value: moon.subpoint ? `${displayNumber(moon.subpoint.lat, 3)}, ${displayNumber(moon.subpoint.lon, 3)}` : '-' },
                { label: localized('Alt / Az', 'Alt / Az'), value: moon.horizontal ? `${displayNumber(moon.horizontal.altitude, 2)}° / ${displayNumber(moon.horizontal.azimuth, 2)}°` : '-' },
                { label: localized('Iluminasi', 'Illumination'), value: number(moon.illumination) === null ? '-' : `${displayNumber(moon.illumination * 100, 1)}%` },
                { label: localized('Fase', 'Phase'), value: moon.phaseName || '-' }
            ];
        }));

        add(baseScene('moon-phase', registryFeature('moon-phase'), localized('Fase Bulan', 'Moon Phase'), () => {
            const moon = (baseState().latestSnapshot || {}).moon || {};
            return [
                { label: localized('Fase', 'Phase'), value: moon.phaseName || '-' },
                { label: localized('Sudut fase', 'Phase angle'), value: number(moon.phaseDegrees) === null ? '-' : `${displayNumber(moon.phaseDegrees, 2)}°` },
                { label: localized('Iluminasi', 'Illumination'), value: number(moon.illumination) === null ? '-' : `${displayNumber(moon.illumination * 100, 1)}%` },
                { label: localized('Umur sejak ijtimak', 'Age since conjunction'), value: moon.conjunction ? `${displayNumber(moon.conjunction.ageHours, 1)} h` : '-' }
            ];
        }));

        add(baseScene('kaabah', registryFeature('kaabah'), localized("Ka'bah / Qibla", 'Kaabah / Qibla'), () => {
            const kaabah = baseState().kaabah || {};
            return [
                { label: localized('Koordinat', 'Coordinate'), value: `${displayNumber(kaabah.latitude, 6)}, ${displayNumber(kaabah.longitude, 6)}` },
                { label: localized('Jarak dari gedung', 'Distance from building'), value: `${displayNumber(kaabah.distanceKm, 2)} km` },
                { label: localized('Arah kiblat', 'Qibla bearing'), value: `${displayNumber(kaabah.bearingFromBuilding, 2)}°` },
                { label: localized('Zona waktu', 'Timezone'), value: kaabah.timezone || 'Asia/Riyadh' }
            ];
        }));

        add(baseScene('kaabah-line', registryFeature('kaabah-line'), localized("Garis Gedung → Ka'bah", 'Building → Kaabah Line'), () => {
            const current = baseState();
            const kaabah = current.kaabah || {};
            const activeMosque = (current.adminContext && (current.adminContext.mosque || current.adminContext.building)) || {};
            return [
                { label: localized('Nama feature', 'Feature name'), value: localized('Garis Kiblat Emas', 'Golden Qibla Line') },
                { label: localized('Dari', 'From'), value: activeMosque.name || localized('Gedung aktif', 'Active building') },
                { label: localized('Menuju', 'To'), value: "Ka'bah / Masjid al-Haram" },
                { label: localized('Jarak', 'Distance'), value: number(kaabah.distanceKm) === null ? '-' : `${displayNumber(kaabah.distanceKm, 2)} km` },
                { label: localized('Bearing awal', 'Initial bearing'), value: number(kaabah.bearingFromBuilding) === null ? '-' : `${displayNumber(kaabah.bearingFromBuilding, 2)}°` }
            ];
        }, { sourceStatus: localized('Kalkulasi geodesik WebGIS', 'WebGIS geodesic calculation') }));

        add(baseScene('observer', registryFeature('observer'), localized('Lokasi Observasi', 'Observation Point'), () => {
            const observer = baseState().observer || {};
            return [
                { label: localized('Koordinat', 'Coordinate'), value: `${displayNumber(observer.lat, 6)}, ${displayNumber(observer.lon, 6)}` },
                { label: localized('Elevasi', 'Elevation'), value: `${displayNumber(observer.elevation, 0)} m` },
                { label: localized('Basis', 'Basis'), value: admin ? localized('Konteks admin / observer', 'Admin context / observer') : localized('Observer manual', 'Manual observer') }
            ];
        }));

        const trajectoryEntry = registryById.get('trajectory');
        const trajectorySource = trajectoryEntry ? window.AdvancedAstroGIS.getSource('trajectory') : null;
        const trajectoryConfig = configFor('trajectory');
        if (trajectoryConfig && trajectoryConfig.enabled !== false && trajectorySource && trajectorySource.getFeatures().length) {
            scenes.push({
                id: 'trajectory:all',
                type: 'trajectory',
                title: localized('Trajektori Matahari & Bulan', 'Sun & Moon Trajectory'),
                feature: trajectorySource.getFeatures()[0],
                extent: trajectorySource.getExtent(),
                config: trajectoryConfig,
                order: Number(trajectoryConfig.order || 999),
                priority: Number(trajectoryConfig.priority || 0),
                duration: Math.max(1000, Number(trajectoryConfig.duration || 8000)),
                rowsBuilder: () => [
                    { label: localized('Jalur', 'Paths'), value: String(trajectorySource.getFeatures().length) },
                    { label: localized('Mode', 'Mode'), value: localized('Trajektori existing WebGIS', 'Existing WebGIS trajectory') },
                    { label: localized('Status', 'Status'), value: localized('Dihitung lokal', 'Calculated locally') }
                ],
                sourceStatus: localized('Kalkulasi WebGIS', 'WebGIS calculation')
            });
        }

        const weatherConfig = configFor('weather');
        if (weatherConfig && weatherConfig.enabled !== false && registryFeature('weather') && state.data.weather && state.data.weather.available) {
            scenes.push({
                id: 'weather:forecast',
                type: 'weather',
                title: localized('Weather & Temperature', 'Weather & Temperature'),
                feature: registryFeature('weather'),
                config: weatherConfig,
                order: Number(weatherConfig.order || 999),
                priority: Number(weatherConfig.priority || 0),
                duration: Math.max(5000, Number(weatherConfig.duration || 15000)),
                rowsBuilder: () => weatherRows(selectedWeatherRecord()),
                sourceStatus: state.data.weather.dataStatus || 'Live',
                weather: true
            });
        }

        const temperatureConfig = configFor('temperature');
        if (temperatureConfig && temperatureConfig.enabled !== false && registryFeature('temperature') && state.data.weather && state.data.weather.available) {
            scenes.push({
                id: 'temperature:current',
                type: 'temperature',
                title: localized('Badge Temperatur', 'Temperature Badge'),
                feature: registryFeature('temperature'),
                config: temperatureConfig,
                order: Number(temperatureConfig.order || 999),
                priority: Number(temperatureConfig.priority || 0),
                duration: Math.max(1000, Number(temperatureConfig.duration || 8500)),
                rowsBuilder: () => {
                    const weather = (state.data && state.data.weather) || {};
                    return weatherRows(weather.current || (weather.forecast || [])[0] || selectedWeatherRecord());
                },
                sourceStatus: state.data.weather.dataStatus || 'Live',
                temperature: true
            });
        }

        const cloudConfig = configFor('cloud-condition');
        if (cloudConfig && cloudConfig.enabled !== false && registryFeature('cloud-condition')) {
            scenes.push({
                id: 'cloud:condition',
                type: 'cloud-condition',
                title: localized('Kondisi Tutupan Awan', 'Cloud Cover Condition'),
                feature: registryFeature('cloud-condition'),
                config: cloudConfig,
                order: Number(cloudConfig.order || 999),
                priority: Number(cloudConfig.priority || 0),
                duration: Math.max(1000, Number(cloudConfig.duration || 8000)),
                rowsBuilder: () => {
                    const record = selectedWeatherRecord();
                    return [
                        { label: localized('Lokasi', 'Location'), value: record.locationName },
                        { label: localized('Tutupan', 'Cover'), value: `${displayNumber(record.cloudCover, 0)}%` },
                        { label: localized('Basis visual', 'Visual basis'), value: localized('Angka provider, bukan raster buatan', 'Provider number, not fabricated raster') },
                        { label: localized('Status', 'Status'), value: record.dataStatus || state.data.weather.dataStatus }
                    ];
                },
                sourceStatus: state.data.weather.dataStatus || 'Live'
            });
        }

        const quakeConfig = configFor('earthquake');
        if (quakeConfig && quakeConfig.enabled !== false) {
            const maximum = Math.max(0, Number(quakeConfig.maxItemsPerCycle || state.config.settings.maxEarthquakesPerCycle || 3));
            registry.filter((entry) => entry.type === 'earthquake').map((entry) => entry.marker)
                .slice()
                .sort((a, b) => {
                    const left = a.get('record') || {};
                    const right = b.get('record') || {};
                    return Number(right.significance || 0) - Number(left.significance || 0)
                        || Number(right.magnitude || 0) - Number(left.magnitude || 0)
                        || new Date(right.occurredAt || 0) - new Date(left.occurredAt || 0);
                })
                .slice(0, maximum)
                .forEach((feature, index) => {
                    const event = feature.get('record');
                    scenes.push({
                        id: `earthquake:${event.eventId}`,
                        type: 'earthquake',
                        title: `Earthquake M ${displayNumber(event.magnitude, 1)} · ${event.place || event.eventId}`,
                        feature,
                        config: quakeConfig,
                        order: Number(quakeConfig.order || 999) + index / 100,
                        priority: Number(quakeConfig.priority || 0) + (Number(event.magnitude || 0) >= Number(state.config.settings.importantEarthquakeMagnitude || 5) ? 20 : 0),
                        duration: Math.max(1000, Number(quakeConfig.duration || 9000)),
                        rowsBuilder: () => [
                            { label: localized('Magnitudo', 'Magnitude'), value: `${displayNumber(event.magnitude, 1)} ${event.magnitudeType || ''}` },
                            { label: localized('Kedalaman', 'Depth'), value: `${displayNumber(event.depthKm, 1)} km` },
                            { label: localized('Waktu', 'Time'), value: formatDate(event.occurredAt, true) },
                            { label: localized('Lokasi', 'Place'), value: event.place },
                            { label: 'Tsunami', value: event.tsunami === null ? '-' : (event.tsunami ? localized('Ya', 'Yes') : localized('Tidak', 'No')) },
                            { label: localized('Sumber / status', 'Source / status'), value: `${event.provider} · ${event.dataStatus}` }
                        ],
                        sourceStatus: `${event.provider} · ${event.dataStatus}`
                    });
                });
        }

        const wildfireConfig = configFor('wildfire');
        if (wildfireConfig && wildfireConfig.enabled !== false) {
            const maximum = Math.max(0, Number(wildfireConfig.maxItemsPerCycle || state.config.settings.maxWildfiresPerCycle || 3));
            registry.filter((entry) => entry.type === 'wildfire').map((entry) => entry.marker).slice(0, maximum).forEach((feature, index) => {
                const event = feature.get('record');
                scenes.push({
                    id: `wildfire:${event.detectionId}`,
                    type: 'wildfire',
                    title: event.title || localized('Wildfire / Hotspot', 'Wildfire / Hotspot'),
                    feature,
                    config: wildfireConfig,
                    order: Number(wildfireConfig.order || 999) + index / 100,
                    priority: Number(wildfireConfig.priority || 0),
                    duration: Math.max(1000, Number(wildfireConfig.duration || 9000)),
                    rowsBuilder: () => [
                        { label: localized('Waktu deteksi', 'Detection time'), value: formatDate(event.detectionAt, true) },
                        { label: localized('Geometri', 'Geometry'), value: event.geometryType },
                        { label: localized('Wilayah', 'Region'), value: event.region },
                        { label: localized('Confidence', 'Confidence'), value: event.confidence || localized('Tidak disediakan', 'Not provided') },
                        { label: localized('Satelit / sumber', 'Satellite / source'), value: event.satelliteSource || event.provider },
                        { label: localized('Status', 'Status'), value: `${event.status} · ${event.dataStatus}` }
                    ],
                    sourceStatus: `${event.provider} · ${event.dataStatus}`
                });
            });
        }

        ['solar-eclipse', 'lunar-eclipse'].forEach((key) => {
            const config = configFor(key);
            const feature = registryFeature(key);
            if (!config || config.enabled === false || !feature) {
                return;
            }
            const event = feature.get('eclipse') || {};
            scenes.push({
                id: `${key}:${event.referenceCode || event.peakUtc || 'next'}`,
                type: key,
                title: key === 'solar-eclipse' ? localized('Gerhana Matahari', 'Solar Eclipse') : localized('Gerhana Bulan', 'Lunar Eclipse'),
                feature,
                config,
                order: Number(config.order || 999),
                priority: Number(config.priority || 0),
                duration: Math.max(1000, Number(config.duration || 9000)),
                rowsBuilder: () => [
                    { label: localized('Tipe', 'Type'), value: event.typeLabel || event.kind || '-' },
                    { label: localized('Puncak', 'Peak'), value: formatDate(event.peakUtc, true) },
                    { label: localized('Koordinat', 'Coordinate'), value: `${displayNumber(event.latitude, 3)}, ${displayNumber(event.longitude, 3)}` },
                    { label: localized('Referensi', 'Reference'), value: event.referenceCode || '-' }
                ],
                sourceStatus: localized('Astronomy Engine / Falak registry', 'Astronomy Engine / Falak registry')
            });
        });

        scenes.forEach((scene) => {
            const registryEntry = registry.find((entry) => entry.id === scene.type)
                || registry.find((entry) => entry.id === scene.id)
                || registry.find((entry) => entry.marker === scene.feature)
                || registry.find((entry) => entry.type === scene.type);
            const fullEntry = registryEntry && window.AdvancedAstroGIS && typeof window.AdvancedAstroGIS.getFeatureEntry === 'function'
                ? window.AdvancedAstroGIS.getFeatureEntry(registryEntry.id)
                : registryEntry;
            scene.registryEntry = fullEntry || registryEntry || null;
            scene.popupHtml = fullEntry && fullEntry.popup ? fullEntry.popup : '';
            scene.presentationKind = sceneGeometryLabel(scene);
        });

        return scenes.sort((left, right) => left.order - right.order || right.priority - left.priority || left.id.localeCompare(right.id));
    }

    function reviewerHudRowCapacity() {
        const height = Math.max(0, Number(window.innerHeight || document.documentElement.clientHeight || 0));
        if (height <= 620) {
            return 3;
        }
        if (height <= 760) {
            return 4;
        }
        if (height <= 920) {
            return 5;
        }
        return 6;
    }

    function reviewerPopupRowCapacity() {
        const height = Math.max(0, Number(window.innerHeight || document.documentElement.clientHeight || 0));
        if (height <= 620) {
            return 3;
        }
        if (height <= 760) {
            return 4;
        }
        if (height <= 920) {
            return 6;
        }
        return 8;
    }

    function pagedRows(rows, elapsed, duration, capacity) {
        const cleaned = rows.filter((row) => row && row.label && row.value !== '' && row.value !== null && row.value !== undefined);
        const pageSize = Math.max(1, Number(capacity || 1));
        const totalPages = Math.max(1, Math.ceil(cleaned.length / pageSize));
        const safeDuration = Math.max(1, Number(duration || 1));
        const progress = Math.max(0, Math.min(0.999999, Number(elapsed || 0) / safeDuration));
        const pageIndex = Math.min(totalPages - 1, Math.floor(progress * totalPages));
        return {
            rows: cleaned.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
            pageIndex,
            totalPages,
            capacity: pageSize
        };
    }

    function allSceneRows(scene) {
        const icon = sceneIconDescriptor(scene);
        const clickRows = Array.isArray(scene.clickPopupRows) && scene.clickPopupRows.length
            ? scene.clickPopupRows
            : (typeof scene.rowsBuilder === 'function' ? scene.rowsBuilder() : []);
        const rows = [
            { label: localized('Ikon aktif', 'Active icon'), value: icon.label },
            { label: localized('Makna ikon', 'Icon meaning'), value: icon.meaning }
        ].concat(clickRows).concat([
            { label: localized('Koordinat fokus', 'Focus coordinate'), value: sceneCoordinateText(scene) },
            { label: localized('Tampilan GIS', 'GIS display'), value: scene.presentationKind || sceneGeometryLabel(scene) },
            { label: localized('Layer / feature', 'Layer / feature'), value: scene.type }
        ]);
        return rows;
    }

    function sceneRowPage(scene, elapsed, duration, capacity) {
        return pagedRows(allSceneRows(scene), elapsed, duration, capacity || reviewerHudRowCapacity());
    }

    function pageIndicatorHtml(pageState, label) {
        if (!pageState || pageState.totalPages <= 1) {
            return '';
        }
        return `<div class="presentation-page-indicator">${escapeHtml(label)} ${pageState.pageIndex + 1} / ${pageState.totalPages}</div>`;
    }

    function hudRowsHtml(rows, pageState) {
        const content = `<dl>${rows.filter((row) => row && row.value !== '').map((row) => `<dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd>`).join('')}</dl>`;
        return content + pageIndicatorHtml(pageState, localized('Data', 'Data'));
    }

    function setHud(title, kicker, infoHtml, counter, sourceStatus, progress) {
        const titleElement = byId('presentationTitle');
        const kickerElement = byId('presentationKicker');
        const infoElement = byId('presentationInfo');
        const counterElement = byId('presentationCounter');
        const sourceElement = byId('presentationSourceStatus');
        const bar = byId('presentationProgressBar');
        if (titleElement) { titleElement.textContent = title; }
        if (kickerElement) { kickerElement.textContent = kicker; }
        if (infoElement) { infoElement.innerHTML = infoHtml; }
        if (counterElement) { counterElement.textContent = counter; }
        if (sourceElement) { sourceElement.textContent = sourceStatus; }
        if (bar) { bar.style.width = `${Math.max(0, Math.min(100, progress * 100))}%`; }
    }

    function pageAwareKicker(base, pageState) {
        if (!pageState || pageState.totalPages <= 1) {
            return base;
        }
        return `${base} | ${localized('Data', 'Data')} ${pageState.pageIndex + 1}/${pageState.totalPages}`;
    }

    function setSceneHud(scene, elapsed, duration, title, kicker, counter, sourceStatus, progress) {
        const showInfo = scene.config.showInfoBox !== false;
        setHud(title, kicker, '', counter, sourceStatus, progress);
        if (!showInfo) {
            return null;
        }
        const infoElement = byId('presentationInfo');
        let capacity = reviewerHudRowCapacity();
        let pageState = sceneRowPage(scene, elapsed, duration, capacity);
        if (!infoElement) {
            return pageState;
        }
        infoElement.innerHTML = hudRowsHtml(pageState.rows, pageState);
        while (capacity > 1 && infoElement.scrollHeight > infoElement.clientHeight + 1) {
            capacity -= 1;
            pageState = sceneRowPage(scene, elapsed, duration, capacity);
            infoElement.innerHTML = hudRowsHtml(pageState.rows, pageState);
        }
        const kickerElement = byId('presentationKicker');
        if (kickerElement) {
            kickerElement.textContent = pageAwareKicker(kicker, pageState);
        }
        infoElement.dataset.page = String(pageState.pageIndex + 1);
        infoElement.dataset.pages = String(pageState.totalPages);
        return pageState;
    }

    function paginateActivePopup(elapsed, duration) {
        const popup = byId('astroMapInfoPopup');
        if (!popup || popup.classList.contains('hidden')) {
            return null;
        }
        const terms = Array.from(popup.querySelectorAll('dt'));
        const pairs = terms.map((term) => ({
            label: term.textContent.trim(),
            term,
            value: term.nextElementSibling && term.nextElementSibling.tagName === 'DD'
                ? term.nextElementSibling
                : null
        })).filter((pair) => pair.value);
        if (!pairs.length) {
            return null;
        }
        let indicator = popup.querySelector('.astro-popup-page-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'astro-popup-page-indicator';
            indicator.setAttribute('aria-live', 'polite');
            popup.appendChild(indicator);
        }
        let capacity = reviewerPopupRowCapacity();
        let pageState;
        const applyPage = () => {
            pageState = pagedRows(pairs, elapsed, duration, capacity);
            const visible = new Set(pageState.rows);
            pairs.forEach((pair) => {
                const hidden = !visible.has(pair);
                pair.term.hidden = hidden;
                pair.value.hidden = hidden;
            });
            indicator.textContent = pageState.totalPages > 1
                ? `${localized('Popup data', 'Popup data')} ${pageState.pageIndex + 1} / ${pageState.totalPages}`
                : '';
            indicator.hidden = pageState.totalPages <= 1;
        };
        applyPage();
        while (capacity > 1 && popup.scrollHeight > popup.clientHeight + 1) {
            capacity -= 1;
            applyPage();
        }
        popup.dataset.page = String(pageState.pageIndex + 1);
        popup.dataset.pages = String(pageState.totalPages);
        popup.scrollTop = 0;
        return pageState;
    }

    function setPresentationTemperature(record, dayLabel) {
        const element = byId('presentationTemperature');
        if (!element) {
            return;
        }
        if (!record || state.config.settings.showTemperatureDisplay === false) {
            element.classList.add('hidden');
            return;
        }
        const daily = record.forecastKind === 'current' ? todayForecast() : record;
        element.innerHTML = [
            `<strong>${escapeHtml(record.forecastKind === 'daily' ? temperatureRange(record) : temperatureText(record.temperature))}</strong>`,
            `<span>${escapeHtml(`${dayLabel} · ${record.locationName || ''}`)}</span>`,
            number(record.feelsLike) === null ? '' : `<span>${escapeHtml(`${localized('Terasa seperti', 'Feels like')} ${temperatureText(record.feelsLike)}`)}</span>`,
            daily && record.forecastKind === 'current' ? `<span>${escapeHtml(`${localized('Min/Maks', 'Min/Max')} ${temperatureRange(daily)}`)}</span>` : ''
        ].join('');
        element.classList.remove('hidden');
    }

    function hidePresentationTemperature() {
        const element = byId('presentationTemperature');
        if (element) {
            element.classList.add('hidden');
        }
    }

    function delay(milliseconds) {
        return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, milliseconds)));
    }

    function isPresentationRunActive(runId) {
        return !state.presentationStopped && state.presentationRunId === runId;
    }

    function sceneCenter(scene) {
        if (scene.extent && !ol.extent.isEmpty(scene.extent)) {
            return ol.extent.getCenter(scene.extent);
        }
        const geometry = scene.feature && scene.feature.getGeometry ? scene.feature.getGeometry() : null;
        if (!geometry) {
            return null;
        }
        return geometry.getType() === 'Point' ? geometry.getCoordinates() : ol.extent.getCenter(geometry.getExtent());
    }

    async function keepReviewerPopupInView(runId) {
        if (!isReviewer() || !state.map || !isPresentationRunActive(runId)) {
            return false;
        }
        await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
        if (!isPresentationRunActive(runId)) {
            return false;
        }
        const popupElement = byId('astroMapInfoPopup');
        const overlays = state.map.getOverlays && state.map.getOverlays().getArray
            ? state.map.getOverlays().getArray()
            : [];
        const popupOverlay = overlays.find((overlay) => overlay && overlay.getElement && overlay.getElement() === popupElement);
        if (!popupOverlay || typeof popupOverlay.panIntoView !== 'function' || !popupElement || popupElement.classList.contains('hidden')) {
            return false;
        }
        popupOverlay.panIntoView({
            margin: 12,
            animation: { duration: 240 }
        });
        await delay(260);
        return isPresentationRunActive(runId);
    }

    function capturePresentationHomeView() {
        if (!state.map || !state.map.getView) {
            return null;
        }
        const view = state.map.getView();
        const center = view.getCenter();
        state.presentationHomeView = {
            center: center && center.slice ? center.slice() : ol.proj.fromLonLat([0, 12]),
            zoom: Math.min(3, Number(view.getZoom()) || 3),
            rotation: Number(view.getRotation()) || 0
        };
        return state.presentationHomeView;
    }

    function waitForMapTransition(startTransition, duration, runId) {
        return new Promise((resolve, reject) => {
            let settled = false;
            let moveKey = null;
            let fallbackTimer = null;
            let cancellationTimer = null;
            const finish = (signal) => {
                if (settled) {
                    return;
                }
                settled = true;
                if (moveKey && window.ol && ol.Observable && typeof ol.Observable.unByKey === 'function') {
                    ol.Observable.unByKey(moveKey);
                }
                window.clearTimeout(fallbackTimer);
                window.clearInterval(cancellationTimer);
                state.lastTransitionSignal = signal;
                resolve(signal);
            };
            moveKey = state.map.once('moveend', () => finish('moveend'));
            fallbackTimer = window.setTimeout(() => finish('fallback'), duration + 1800);
            cancellationTimer = window.setInterval(() => {
                if (!isPresentationRunActive(runId)) {
                    finish('cancelled');
                }
            }, 50);
            try {
                startTransition(() => finish('animation-callback'));
                if (duration <= 0) {
                    window.requestAnimationFrame(() => finish('render-frame'));
                }
            } catch (error) {
                if (moveKey && window.ol && ol.Observable && typeof ol.Observable.unByKey === 'function') {
                    ol.Observable.unByKey(moveKey);
                }
                window.clearTimeout(fallbackTimer);
                window.clearInterval(cancellationTimer);
                reject(error);
            }
        });
    }

    async function transitionToScene(scene, runId) {
        if (!isPresentationRunActive(runId)) {
            return false;
        }
        const center = sceneCenter(scene);
        if (!center || !state.map) {
            return isPresentationRunActive(runId);
        }
        const duration = Math.max(250, Number(state.config.settings.zoomDuration || 1800));
        const transitionType = String(scene.config.transitionType || 'fly').toLowerCase();
        await waitForMapTransition((done) => {
            if ((transitionType === 'fit' || scene.extent) && (scene.extent || scene.feature.getGeometry())) {
                const extent = scene.extent || scene.feature.getGeometry().getExtent();
                state.map.getView().fit(extent, {
                    padding: [100, isReviewer() ? 500 : 450, 110, 90],
                    duration,
                    maxZoom: Number(scene.config.zoom || 7),
                    callback: done
                });
            } else {
                state.map.getView().animate({
                    center,
                    zoom: Number(scene.config.zoom || 7),
                    duration
                }, done);
            }
        }, duration, runId);
        return isPresentationRunActive(runId);
    }

    function allSceneExtent(scenes) {
        const extent = ol.extent.createEmpty();
        scenes.forEach((scene) => {
            const geometry = scene.feature && scene.feature.getGeometry ? scene.feature.getGeometry() : null;
            const target = scene.extent || (geometry && geometry.getExtent());
            if (target && !ol.extent.isEmpty(target)) {
                ol.extent.extend(extent, target);
            }
        });
        return extent;
    }

    async function showOverview(scenes, initial, runId) {
        if (!isPresentationRunActive(runId)) {
            return;
        }
        state.activePresentationFeature = null;
        state.lastWeatherDay = -2;
        hidePresentationTemperature();
        setPresentationFeatureIcon(null);
        if (window.AdvancedAstroGIS) {
            window.AdvancedAstroGIS.hidePopup();
        }
        const duration = Math.max(1000, Number(state.config.settings.overviewDuration || 6000));
        if (initial && scenes.length) {
            activateScenePopup(scenes[0], 'reviewer-initial-popup');
            paginateActivePopup(0, duration);
        }
        const transition = initial ? 0 : Math.max(250, Number(state.config.settings.transitionDuration || 900));
        const extent = allSceneExtent(scenes);
        setHud(
            localized('Ikhtisar Astronomi & Lingkungan', 'Astronomy & Environment Overview'),
            localized('Overview / Maximum Zoom Out', 'Overview / Maximum Zoom Out'),
            presentationInventoryHtml(scenes),
            `${localized('Overview', 'Overview')} · ${formatDuration(duration / 1000)}`,
            localized('Automatic reviewer', 'Automatic reviewer'),
            0
        );
        if (state.map) {
            await waitForMapTransition((done) => {
                if (!ol.extent.isEmpty(extent)) {
                    state.map.getView().fit(extent, {
                        padding: [80, 80, 80, 80],
                        duration: transition,
                        maxZoom: 3,
                        callback: done
                    });
                } else {
                    state.map.getView().animate({
                        center: ol.proj.fromLonLat([0, 12]),
                        zoom: 2,
                        duration: transition
                    }, done);
                }
            }, transition, runId);
        }
        if (initial && scenes.length) {
            await keepReviewerPopupInView(runId);
        }
        const started = performance.now();
        while (isPresentationRunActive(runId) && performance.now() - started < duration) {
            const elapsed = performance.now() - started;
            const remaining = (duration - elapsed) / 1000;
            if (initial && scenes.length) {
                paginateActivePopup(elapsed, duration);
            }
            setHud(
                localized('Ikhtisar Astronomi & Lingkungan', 'Astronomy & Environment Overview'),
                localized('Overview / Maximum Zoom Out', 'Overview / Maximum Zoom Out'),
                presentationInventoryHtml(scenes),
                `${localized('Overview', 'Overview')} · ${formatDuration(remaining)}`,
                localized('Automatic reviewer', 'Automatic reviewer'),
                elapsed / duration
            );
            await delay(100);
        }
    }

    async function showInterSceneOverview(completedScene, nextScene, index, total, runId) {
        if (!isPresentationRunActive(runId) || state.config.settings.returnToOverviewBetweenFeatures === false) {
            return;
        }
        state.activePresentationFeature = null;
        state.lastWeatherDay = -2;
        hidePresentationTemperature();
        setPresentationFeatureIcon(null);
        if (window.AdvancedAstroGIS) {
            window.AdvancedAstroGIS.hidePopup();
        }
        const transition = Math.max(250, Number(state.config.settings.transitionDuration || 900));
        const holdDuration = Math.max(500, Number(state.config.settings.interSceneOverviewDuration || 1800));
        const home = state.presentationHomeView || capturePresentationHomeView() || {
            center: ol.proj.fromLonLat([0, 12]),
            zoom: 2,
            rotation: 0
        };
        const nextTitle = nextScene ? nextScene.title : localized('Ikhtisar siklus berikutnya', 'Next cycle overview');
        const transitionInfo = hudRowsHtml([
            { label: localized('Selesai', 'Completed'), value: completedScene.title },
            { label: localized('Berikutnya', 'Next'), value: nextTitle },
            { label: localized('Posisi peta', 'Map position'), value: localized('Kembali ke tampilan awal', 'Returning to the default view') }
        ]);
        setHud(
            localized('Kembali ke Ikhtisar', 'Back to Overview'),
            localized('Overview / Zoom Out', 'Overview / Zoom Out'),
            transitionInfo,
            `${localized('Overview', 'Overview')} · ${index + 1} / ${total}`,
            localized('Automatic reviewer', 'Automatic reviewer'),
            0
        );
        if (state.map) {
            await waitForMapTransition((done) => {
                state.map.getView().animate({
                    center: home.center,
                    zoom: home.zoom,
                    rotation: home.rotation,
                    duration: transition
                }, done);
            }, transition, runId);
        }
        if (nextScene) {
            activateScenePopup(nextScene, 'reviewer-next-popup');
            paginateActivePopup(0, holdDuration);
            await keepReviewerPopupInView(runId);
        }
        const started = performance.now();
        while (isPresentationRunActive(runId) && performance.now() - started < holdDuration) {
            const elapsed = performance.now() - started;
            if (nextScene) {
                paginateActivePopup(elapsed, holdDuration);
            }
            setHud(
                localized('Kembali ke Ikhtisar', 'Back to Overview'),
                localized('Overview / Zoom Out', 'Overview / Zoom Out'),
                transitionInfo,
                `${localized('Overview', 'Overview')} · ${index + 1} / ${total} · ${formatDuration((holdDuration - elapsed) / 1000)}`,
                localized('Automatic reviewer', 'Automatic reviewer'),
                elapsed / holdDuration
            );
            await delay(100);
        }
    }

    function updateWeatherPresentation(scene, dayIndex, runId) {
        if (!isPresentationRunActive(runId)) {
            return;
        }
        const weather = state.data.weather || {};
        const forecast = Array.isArray(weather.forecast) ? weather.forecast : [];
        const record = dayIndex < 0 ? (weather.current || forecast[0]) : (forecast[dayIndex] || weather.current || forecast[0]);
        if (!record) {
            return;
        }
        state.selectedForecastIndex = dayIndex >= 0 && forecast[dayIndex] ? dayIndex : -1;
        renderSelectedWeatherLayers();
        renderWeatherPanel();
        const label = dayIndex < 0 ? localized('Saat ini', 'Now')
            : dayIndex === 0 ? localized('Hari ini', 'Today')
            : (dayIndex === 1 ? localized('Besok', 'Tomorrow') : `${localized('Hari', 'Day')} ${dayIndex + 1}`);
        setPresentationTemperature(record, label);
        scene.feature = state.features.weather;
        if (scene.feature && scene.config.showPopup !== false) {
            scene.feature.set('infoHtml', weatherPopup(record), true);
            activateScenePopup(scene, 'reviewer-weather-sequence', weatherPopup(record));
        }
    }

    async function presentScene(scene, index, total, runId) {
        if (!isPresentationRunActive(runId)) {
            return;
        }
        state.activePresentationFeature = scene;
        state.lastWeatherDay = -2;
        hidePresentationTemperature();
        if (scene.temperature) {
            state.selectedForecastIndex = -1;
            renderSelectedWeatherLayers();
            renderWeatherPanel();
        }
        setPresentationFeatureIcon(scene);
        let popupShown = false;
        if (scene.weather) {
            const weather = state.data.weather || {};
            const initialWeatherDay = weather.current ? -1 : ((weather.forecast || []).length ? 0 : -1);
            state.lastWeatherDay = initialWeatherDay;
            updateWeatherPresentation(scene, initialWeatherDay, runId);
            popupShown = true;
        } else {
            if (scene.temperature) {
                const record = (state.data.weather && (state.data.weather.current || (state.data.weather.forecast || [])[0])) || selectedWeatherRecord();
                if (record) {
                    setPresentationTemperature(record, localized('Saat ini', 'Now'));
                    scene.popupHtml = weatherPopup(record);
                }
            }
            popupShown = activateScenePopup(scene, 'reviewer-sequence-start', scene.popupHtml);
        }
        const initialWeatherRecord = scene.weather || scene.temperature ? selectedWeatherRecord() : null;
        const initialTemperatureCounter = initialWeatherRecord && number(initialWeatherRecord.temperature) !== null
            ? ` · ${temperatureText(initialWeatherRecord.temperature)}`
            : '';
        setSceneHud(
            scene,
            0,
            scene.duration,
            scene.title,
            `${localized('Memfokuskan feature', 'Focusing feature')} · ${scene.presentationKind || sceneGeometryLabel(scene)}`,
            `${scene.title}${initialTemperatureCounter} · ${index + 1} / ${total} · ${localized('Fokus', 'Focus')}`,
            scene.sourceStatus || '',
            0
        );
        paginateActivePopup(0, scene.duration);
        await transitionToScene(scene, runId);
        if (!isPresentationRunActive(runId)) {
            return;
        }
        activateScenePopup(scene, 'reviewer-sequence-focused', scene.popupHtml);
        paginateActivePopup(0, scene.duration);
        await keepReviewerPopupInView(runId);
        if (!isPresentationRunActive(runId)) {
            return;
        }
        const started = performance.now();
        while (isPresentationRunActive(runId)) {
            const elapsed = performance.now() - started;
            if (elapsed >= scene.duration) {
                break;
            }
            let informationElapsed = elapsed;
            let informationDuration = scene.duration;
            if (scene.weather) {
                const weather = state.data.weather || {};
                const forecastCount = Math.min(5, (weather.forecast || []).length);
                const weatherSteps = [];
                if (weather.current) {
                    weatherSteps.push(-1);
                }
                for (let forecastIndex = 0; forecastIndex < forecastCount; forecastIndex += 1) {
                    weatherSteps.push(forecastIndex);
                }
                if (!weatherSteps.length) {
                    weatherSteps.push(-1);
                }
                const stepIndex = Math.min(weatherSteps.length - 1, Math.floor((elapsed / scene.duration) * weatherSteps.length));
                const dayIndex = weatherSteps[stepIndex];
                const stepDuration = scene.duration / Math.max(1, weatherSteps.length);
                informationElapsed = elapsed - stepIndex * stepDuration;
                informationDuration = stepDuration;
                if (dayIndex !== state.lastWeatherDay) {
                    state.lastWeatherDay = dayIndex;
                    updateWeatherPresentation(scene, dayIndex, runId);
                    popupShown = true;
                }
            } else if (!popupShown) {
                popupShown = true;
                activateScenePopup(scene, 'reviewer-sequence-retry', scene.popupHtml);
            }
            paginateActivePopup(informationElapsed, informationDuration);
            const remaining = (scene.duration - elapsed) / 1000;
            const weatherRecord = scene.weather || scene.temperature ? selectedWeatherRecord() : null;
            const temperatureCounter = weatherRecord && number(weatherRecord.temperature) !== null
                ? ` · ${temperatureText(weatherRecord.temperature)}`
                : '';
            setSceneHud(
                scene,
                informationElapsed,
                informationDuration,
                scene.title,
                scene.type === 'weather' || scene.type === 'temperature'
                    ? `${localized('Weather', 'Weather')} · ${(weatherRecord && weatherRecord.locationName) || ''} · ${scene.presentationKind}`
                    : `${sceneCatalogLabel(scene.type)} · ${scene.presentationKind}`,
                `${scene.title}${temperatureCounter} · ${index + 1} / ${total} · ${formatDuration(remaining)}`,
                scene.sourceStatus || '',
                elapsed / scene.duration
            );
            await delay(100);
        }
        if (isPresentationRunActive(runId) && window.AdvancedAstroGIS) {
            window.AdvancedAstroGIS.hidePopup();
        }
        if (isPresentationRunActive(runId)) {
            await delay(Math.max(150, Number(state.config.settings.transitionDuration || 900)));
        }
    }

    function recordPresentationError(scene, error) {
        const item = {
            featureId: scene && scene.id ? scene.id : 'overview',
            featureType: scene && scene.type ? scene.type : 'overview',
            message: String(error && error.message ? error.message : error),
            occurredAt: new Date().toISOString()
        };
        state.presentationErrors.push(item);
        state.presentationErrors = state.presentationErrors.slice(-20);
        window.dispatchEvent(new CustomEvent('mpm:reviewer-presentation-error', { detail: item }));
        if (window.console && typeof window.console.warn === 'function') {
            window.console.warn('[Astronomical Reviewer] feature skipped', item);
        }
    }

    async function runPresentation() {
        if (state.presentationStarted || !isReviewer()) {
            return false;
        }
        state.presentationStarted = true;
        state.presentationStopped = false;
        const runId = ++state.presentationRunId;
        try {
            while (isPresentationRunActive(runId)) {
                applyPendingDashboard();
                const scenes = buildPresentationScenes();
                state.currentQueue = scenes.map((scene) => scene.id);
                state.cycleLocked = true;
                state.presentationCycle += 1;
                try {
                    await showOverview(scenes, state.presentationCycle === 1, runId);
                } catch (error) {
                    recordPresentationError(null, error);
                }
                if (!isPresentationRunActive(runId)) {
                    break;
                }
                if (!scenes.length) {
                    setHud(
                        localized('Menunggu Feature', 'Waiting for Features'),
                        localized('Data belum tersedia', 'Data unavailable'),
                        localized('Reviewer akan mencoba kembali tanpa memerlukan klik.', 'The reviewer will retry without requiring a click.'),
                        `${localized('Overview', 'Overview')} · 00:05`,
                        localized('Cached / source unavailable', 'Cached / source unavailable'),
                        0
                    );
                    setPresentationFeatureIcon(null);
                    state.cycleLocked = false;
                    await delay(5000);
                    continue;
                }
                for (let index = 0; index < scenes.length && isPresentationRunActive(runId); index += 1) {
                    try {
                        await presentScene(scenes[index], index, scenes.length, runId);
                    } catch (error) {
                        recordPresentationError(scenes[index], error);
                        if (window.AdvancedAstroGIS) {
                            window.AdvancedAstroGIS.hidePopup();
                        }
                    }
                    if (isPresentationRunActive(runId)) {
                        try {
                            await showInterSceneOverview(
                                scenes[index],
                                scenes[index + 1] || null,
                                index,
                                scenes.length,
                                runId
                            );
                        } catch (error) {
                            recordPresentationError(null, error);
                        }
                    }
                }
                state.cycleLocked = false;
                if (isPresentationRunActive(runId)) {
                    await delay(Math.max(0, Number(state.config.settings.loopDelay || 1500)));
                }
            }
        } finally {
            state.cycleLocked = false;
            if (state.presentationRunId === runId) {
                state.presentationStarted = false;
            }
        }
        return true;
    }

    function sourceDiagnostic(category) {
        const sources = state.data && Array.isArray(state.data.sources) ? state.data.sources : [];
        const source = sources.find((item) => item.category === category);
        if (!source) {
            return { status: 'FAIL', count: 0, message: 'Source unavailable' };
        }
        const status = source.dataStatus || source.providerStatus || 'FAIL';
        const normalized = String(status).toUpperCase();
        return {
            status: normalized === 'LIVE' ? 'OK' : normalized,
            count: Number(source.recordCount || 0),
            message: source.error || ''
        };
    }

    function environmentalDiagnostics() {
        const base = window.AdvancedAstroGIS && typeof window.AdvancedAstroGIS.getDiagnostics === 'function'
            ? window.AdvancedAstroGIS.getDiagnostics()
            : null;
        const registry = window.AdvancedAstroGIS && typeof window.AdvancedAstroGIS.getFeatureRegistry === 'function'
            ? window.AdvancedAstroGIS.getFeatureRegistry()
            : [];
        const cached = Boolean(state.data && state.data.servedFrom === 'local-cache');
        const info = byId('presentationInfo');
        const popup = byId('astroMapInfoPopup');
        return {
            initialization: state.initializationStatus,
            map: base ? base.map : { status: state.map ? 'READY' : 'FAIL' },
            featureRegistry: {
                status: registry.some((entry) => entry.valid) ? 'OK' : 'FAIL',
                total: registry.length,
                valid: registry.filter((entry) => entry.valid).length
            },
            api: state.data ? (cached ? 'CACHED' : 'OK') : 'FAIL',
            sql: state.data ? (cached ? 'CACHED' : 'OK') : 'FAIL',
            weather: sourceDiagnostic('weather'),
            earthquake: sourceDiagnostic('earthquake'),
            wildfire: sourceDiagnostic('wildfire'),
            reviewerEngine: isReviewer()
                ? (state.presentationStarted ? 'RUNNING' : (state.initializationStatus === 'READY' ? 'READY' : state.initializationStatus))
                : 'N/A',
            queue: state.currentQueue.slice(),
            active: state.activePresentationFeature ? state.activePresentationFeature.id : '',
            popup: popup && !popup.classList.contains('hidden') ? 'OPEN' : 'CLOSED',
            infoBox: info && info.textContent.trim() ? 'UPDATED' : 'EMPTY',
            timer: byId('presentationCounter') ? byId('presentationCounter').textContent : '',
            transition: state.lastTransitionSignal || 'WAITING',
            pendingData: Boolean(state.pendingData),
            cycleLocked: state.cycleLocked,
            errors: state.presentationErrors.slice()
        };
    }

    function renderDebugPanel() {
        const panel = byId('astronomyRuntimeDebug');
        if (!panel) {
            return;
        }
        const diagnostic = environmentalDiagnostics();
        const line = (label, value) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
        panel.innerHTML = [
            '<h3>Runtime Diagnostics</h3>',
            line('Map', `${diagnostic.map.status} ${diagnostic.map.width || ''}x${diagnostic.map.height || ''}`.trim()),
            line('Features', `${diagnostic.featureRegistry.status} ${diagnostic.featureRegistry.valid}/${diagnostic.featureRegistry.total}`),
            line('Weather API', `${diagnostic.weather.status} (${diagnostic.weather.count})`),
            line('Earthquake API', `${diagnostic.earthquake.status} (${diagnostic.earthquake.count})`),
            line('Wildfire API', `${diagnostic.wildfire.status} (${diagnostic.wildfire.count})`),
            line('SQL', diagnostic.sql),
            line('Reviewer Engine', diagnostic.reviewerEngine),
            line('Queue', String(diagnostic.queue.length)),
            line('Active', diagnostic.active || '-'),
            line('Popup', diagnostic.popup),
            line('InfoBox', diagnostic.infoBox),
            line('Move', diagnostic.transition),
            line('Timer', diagnostic.timer || '-'),
            line('Pending snapshot', diagnostic.pendingData ? 'YES' : 'NO'),
            line('Errors', String(diagnostic.errors.length))
        ].join('');
    }

    function initializeDebugPanel() {
        if (new URLSearchParams(window.location.search).get('debug') !== '1') {
            return;
        }
        let panel = byId('astronomyRuntimeDebug');
        if (!panel) {
            panel = document.createElement('aside');
            panel.id = 'astronomyRuntimeDebug';
            panel.className = 'astronomy-runtime-debug';
            panel.setAttribute('aria-live', 'polite');
            document.body.appendChild(panel);
        }
        renderDebugPanel();
        state.debugTimer = window.setInterval(renderDebugPanel, 500);
    }

    async function init() {
        state.initializationStatus = 'WAITING_FOR_MAP';
        if (window.AdvancedAstroGIS && typeof window.AdvancedAstroGIS.whenReady === 'function') {
            const readiness = await window.AdvancedAstroGIS.whenReady();
            if (!readiness || readiness.initialization !== 'READY') {
                state.initializationStatus = 'ERROR';
                renderUnavailable((readiness && readiness.initializationError) || localized('Peta gagal diinisialisasi.', 'Map initialization failed.'));
                return;
            }
        }
        if (!state.map) {
            ensureMapLayers();
        }
        if (!state.map) {
            state.initializationStatus = 'ERROR';
            renderUnavailable(localized('Peta belum siap.', 'Map is not ready.'));
            return;
        }
        state.initializationStatus = 'LOADING_DATA';
        bindControls();
        syncUnitControl();
        if (window.AdvancedAstroGIS && typeof window.AdvancedAstroGIS.reloadAdminContext === 'function') {
            try {
                await window.AdvancedAstroGIS.reloadAdminContext();
            } catch (error) {
                // Environmental loading can still use the current observer and
                // its own SQL-backed/local cache fallback.
            }
        }
        try {
            await loadData();
        } catch (error) {
            if (isReviewer()) {
                setHud(
                    localized('Sumber Tidak Tersedia', 'Source Unavailable'),
                    localized('Reviewer otomatis', 'Automatic reviewer'),
                    escapeHtml(error.message),
                    `${localized('Overview', 'Overview')} · 00:05`,
                    'Source Unavailable',
                    0
                );
            }
        }
        state.initializationStatus = state.data ? 'READY' : 'DEGRADED';
        initializeDebugPanel();
        window.dispatchEvent(new CustomEvent('mpm:environmental-ready', {
            detail: environmentalDiagnostics()
        }));
        if (isReviewer()) {
            capturePresentationHomeView();
            window.dispatchEvent(new CustomEvent('mpm:reviewer-engine-ready', {
                detail: { queue: buildPresentationScenes().map((scene) => scene.id) }
            }));
            runPresentation();
        }
        window.setInterval(() => loadData().catch(() => {}), REFRESH_INTERVAL_MS);
    }

    async function restartPresentation(config) {
        state.presentationStopped = true;
        state.presentationRunId += 1;
        state.presentationStarted = false;
        await delay(150);
        if (config && typeof config === 'object') {
            state.config = normalizeConfig(config);
            state.presentationConfigOverride = true;
        }
        state.presentationCycle = 0;
        state.presentationStopped = false;
        runPresentation();
        return true;
    }

    window.EnvironmentalMonitoring = {
        reload: loadData,
        getState: () => ({
            data: state.data,
            temperatureUnit: state.temperatureUnit,
            selectedForecastIndex: state.selectedForecastIndex,
            activePresentationFeature: state.activePresentationFeature ? {
                id: state.activePresentationFeature.id,
                type: state.activePresentationFeature.type,
                title: state.activePresentationFeature.title,
                duration: state.activePresentationFeature.duration
            } : null,
            presentationCycle: state.presentationCycle,
            presentationStarted: state.presentationStarted,
            initializationStatus: state.initializationStatus,
            currentQueue: state.currentQueue.slice(),
            presentationHomeView: state.presentationHomeView ? {
                center: state.presentationHomeView.center.slice(),
                zoom: state.presentationHomeView.zoom,
                rotation: state.presentationHomeView.rotation
            } : null,
            cycleLocked: state.cycleLocked,
            pendingData: Boolean(state.pendingData),
            presentationErrors: state.presentationErrors.slice(),
            lastTransitionSignal: state.lastTransitionSignal,
            activePopupKey: state.activePopupKey,
            config: state.config,
            layerVisibility: Object.fromEntries(Object.entries(state.layers).map(([key, layer]) => [key, layer.getVisible()])),
            featureCounts: {
                weather: state.sources.weather ? state.sources.weather.getFeatures().length : 0,
                temperature: state.sources.temperature ? state.sources.temperature.getFeatures().length : 0,
                cloud: state.sources.cloud ? state.sources.cloud.getFeatures().length : 0,
                earthquake: state.sources.earthquake ? state.sources.earthquake.getFeatures().length : 0,
                wildfire: state.sources.wildfire ? state.sources.wildfire.getFeatures().length : 0
            },
            panelPages: { ...state.panelPages }
        }),
        getDiagnostics: environmentalDiagnostics,
        setTemperatureUnit: (unit) => {
            state.temperatureUnit = normalizeUnit(unit);
            localStorage.setItem(UNIT_KEY, state.temperatureUnit);
            syncUnitControl();
            renderSelectedWeatherLayers();
            renderPanels();
            if (state.activePresentationFeature && state.activePresentationFeature.type === 'weather') {
                updateWeatherPresentation(state.activePresentationFeature, state.lastWeatherDay, state.presentationRunId);
            }
        },
        selectWeatherDay: (index) => selectWeatherDay(Number(index), { popup: false }),
        stopPresentation: () => {
            state.presentationStopped = true;
            state.presentationRunId += 1;
            state.presentationStarted = false;
            state.activePresentationFeature = null;
            hidePresentationTemperature();
            setPresentationFeatureIcon(null);
            if (window.AdvancedAstroGIS) {
                window.AdvancedAstroGIS.hidePopup();
            }
        },
        startPresentation: runPresentation,
        restartPresentation
    };

    window.addEventListener(window.MpmAdvancedPage ? 'mpm:advanced-mount' : 'DOMContentLoaded', () => {
        init().catch((error) => {
            state.initializationStatus = 'ERROR';
            renderUnavailable(error.message || String(error));
        });
    });
}());
