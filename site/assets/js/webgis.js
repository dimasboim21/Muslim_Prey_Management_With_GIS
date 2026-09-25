(function () {
    'use strict';

    const DEFAULT_OBSERVER = {
        lat: -6.175392,
        lon: 106.827153,
        elevation: 8
    };

    const EARTH_RADIUS_KM = 6371.0088;
    const EARTH_RADIUS_M = 6378137;
    const WEB_MERCATOR_MAX = 20037508.342789244;
    const WEB_MERCATOR_EXTENT = [
        -WEB_MERCATOR_MAX,
        -WEB_MERCATOR_MAX,
        WEB_MERCATOR_MAX,
        WEB_MERCATOR_MAX
    ];
    const KM_PER_AU = 149597870.7;
    const SYNODIC_MONTH_DAYS = 29.530588861;
    const AVG_YEAR_SECONDS = 31557600;
    const SOLAR_DAILY_TRAJECTORY_STEP_HOURS = 1;
    const SUN_APPROX_AGE_YEARS_2026 = 4603000000;
    const MOON_APPROX_AGE_YEARS_2026 = 4510000000;
    const AGE_REFERENCE_UTC_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
    const OVERLAY_SIZES = {
        atmosphere: { width: 1440, height: 360 },
        prayer: { width: 360, height: 180 },
        hilal: { width: 360, height: 180 }
    };
    const ICONS = {
        sun: 'map/astro/sun.png',
        moon: 'map/astro/full-moon.png'
    };
    const PLACE_ICON_BASE_PATH = 'map/places/';
    const IP_PROVIDER_ICON = `${PLACE_ICON_BASE_PATH}ip-pin.png`;
    const ECLIPSE_ADM_API = 'api/eclipse-adm-cache.php';
    const ECLIPSE_ADM_LOCAL_KEY = 'mpm:astro-reviewer:eclipse-adm-cache:v1';
    const FALAK_REGISTRY_API = 'api/falak-registry.php';
    const FALAK_REGISTRY_LOCAL_KEY = 'mpm:astro-reviewer:falak-registry:v1';
    const FALAK_PRAYER_CONFIG_API = 'api/falak-prayer-config.php';
    const FALAK_CALENDAR_API = 'api/falak-calendar.php';
    const FALAK_CALENDAR_LOCAL_KEY = 'mpm:astro-reviewer:falak-calendar:v1';
    const TIMEZONES_API = 'api/timezones.php';
    const TIMEZONES_LOCAL_KEY = 'mpm:astro-reviewer:timezones:v1';

    function actualNow() {
        return window.MpmActualTime && typeof window.MpmActualTime.now === 'function'
            ? window.MpmActualTime.now()
            : new Date();
    }
    const DEFAULT_KAABAH = {
        lat: 21.422495,
        lon: 39.826193,
        timezone: 'Asia/Riyadh'
    };
    const PLACE_ICONS = {
        kaabah: 'kaabah.png',
        mosque: 'mosque.png',
        'prayer-room': 'prayer-room.png',
        'eid-prayer-location': 'eid-repair.png',
        'islamic-boarding-school': 'boarding.png',
        school: 'school.png',
        university: 'university.png',
        house: 'house.png',
        office: 'office.png',
        hospital: 'hospital.jpeg',
        orphanage: 'orphanage.png',
        airport: 'airport.png',
        busterminal: 'busterminal.png',
        trainstation: 'trainstation.png',
        seaport: 'seaport.png',
        caferestaurant: 'caferest-d798.png',
        shopmart: 'shopmart.png',
        shoppingmall: 'shoppingmall.png',
        factory: 'factory.png',
        museum: 'museum.png',
        hotelinn: 'hotelinn.png',
        carshop: 'carshop.png'
    };
    const ADMIN_CONTEXT_ICON_ANCHORS = {
        kaabah: [0.508, 0.509],
        building: [0.5, 0.755],
        provider: [0.5, 0.835]
    };
    const CLICKABLE_ICON_KINDS = new Set([
        'sun',
        'moon',
        'observer',
        'building',
        'ip-provider',
        'provider-building-calibration',
        'kaabah',
        'solar-eclipse',
        'lunar-eclipse',
        'weather',
        'temperature',
        'cloud-condition',
        'earthquake',
        'wildfire'
    ]);

    const COMPASS_16 = [
        { abbr: 'N', name: 'North', idAbbr: 'U', idName: 'Utara', bearing: 0 },
        { abbr: 'NNE', name: 'North north-east', idAbbr: 'UTL', idName: 'Utara Timur Laut', bearing: 22.5 },
        { abbr: 'NE', name: 'North-east', idAbbr: 'TL', idName: 'Timur Laut', bearing: 45 },
        { abbr: 'ENE', name: 'East north-east', idAbbr: 'TTL', idName: 'Timur Timur Laut', bearing: 67.5 },
        { abbr: 'E', name: 'East', idAbbr: 'T', idName: 'Timur', bearing: 90 },
        { abbr: 'ESE', name: 'East south-east', idAbbr: 'TMG', idName: 'Timur Menenggara', bearing: 112.5 },
        { abbr: 'SE', name: 'South-east', idAbbr: 'TG', idName: 'Tenggara', bearing: 135 },
        { abbr: 'SSE', name: 'South south-east', idAbbr: 'STG', idName: 'Selatan Tenggara', bearing: 157.5 },
        { abbr: 'S', name: 'South', idAbbr: 'S', idName: 'Selatan', bearing: 180 },
        { abbr: 'SSW', name: 'South south-west', idAbbr: 'SBD', idName: 'Selatan Barat Daya', bearing: 202.5 },
        { abbr: 'SW', name: 'South-west', idAbbr: 'BD', idName: 'Barat Daya', bearing: 225 },
        { abbr: 'WSW', name: 'West south-west', idAbbr: 'BBD', idName: 'Barat Barat Daya', bearing: 247.5 },
        { abbr: 'W', name: 'West', idAbbr: 'B', idName: 'Barat', bearing: 270 },
        { abbr: 'WNW', name: 'West north-west', idAbbr: 'BBL', idName: 'Barat Barat Laut', bearing: 292.5 },
        { abbr: 'NW', name: 'North-west', idAbbr: 'BL', idName: 'Barat Laut', bearing: 315 },
        { abbr: 'NNW', name: 'North north-west', idAbbr: 'UBL', idName: 'Utara Barat Laut', bearing: 337.5 }
    ];

    const DEFAULT_PRAYER_METHOD_CONFIG = {
        methodKey: 'registry-unavailable',
        nameId: 'Registry metode belum tersedia',
        nameEn: 'Method registry unavailable',
        fajrAngle: 20,
        ishaAngle: 18,
        ishaInterval: null
    };
    const DEFAULT_ASR_METHOD_CONFIG = {
        methodKey: 'registry-unavailable-asr',
        nameId: 'Ashar registry belum tersedia',
        nameEn: 'Asr registry unavailable',
        shadowFactor: 1
    };

    const FALAK_FALLBACK_REGISTRY = {
        schemaVersion: 'fallback',
        databaseOnline: false,
        modules: [],
        plugins: [],
        algorithms: [],
        criteria: [],
        parameters: [],
        methods: [],
        prayerMethods: [],
        asrMethods: [],
        hijriMethods: [],
        hilalCriteria: [],
        rukyatMethods: [],
        ephemerisAlgorithms: [],
        calculationProfiles: [],
        timezones: [],
        profiles: []
    };

    let resolveApplicationReady;
    const applicationReady = new Promise((resolve) => {
        resolveApplicationReady = resolve;
    });

    const state = {
        map: null,
        observer: { ...DEFAULT_OBSERVER },
        layers: {},
        sources: {},
        features: {},
        featureRegistry: new Map(),
        initializationStarted: false,
        initializationStatus: 'BOOTING',
        initializationError: '',
        readyResolved: false,
        resizeObserver: null,
        latestSnapshot: null,
        latestOutput: null,
        latestDirectionAnalysis: [],
        latestPrayerTimes: null,
        latestRukyat: null,
        live: true,
        playing: false,
        networkOffsetMs: 0,
        networkSource: 'Device clock',
        lastAtmosphereKey: '',
        lastPrayerZoneKey: '',
        lastHilalKey: '',
        updateTimer: null,
        trajectoryTimer: null,
        directionZoomFrame: null,
        latestCompassDisplay: null,
        dailyCache: new Map(),
        prayerCache: new Map(),
        weather: {
            layer: 'wind',
            enabled: false,
            playing: false,
            frame: 0,
            timer: null,
            cache: new Map(),
            requests: new Map(),
            wind: null,
            particles: []
        },
        moonTextureImage: null,
        moonIconCanvas: null,
        reviewerMode: ((document.body && document.body.dataset.reviewerMode) || 'settings').toLowerCase() === 'display'
            ? 'display'
            : 'settings',
        reviewerLanguage: 'id',
        adminContext: null,
        adminContextPromise: null,
        providerContext: null,
        falakRegistry: FALAK_FALLBACK_REGISTRY,
        falakRegistrySource: 'fallback',
        falakRegistryLoaded: false,
        falakRegistryLoading: false,
        falakRegistryError: '',
        falakPrayerPublication: null,
        falakPrayerPublicationLoading: false,
        falakPrayerPublicationSaving: false,
        falakPrayerPublicationError: '',
        falakCalendar: { events: [], eventSources: [], monthStartResults: [], supportedImports: [] },
        falakCalendarSource: 'fallback',
        falakCalendarLoaded: false,
        falakCalendarLoading: false,
        falakCalendarError: '',
        timezones: [],
        timezonesSource: 'initial',
        timezonesLoaded: false,
        timezonesLoading: false,
        timezonesError: '',
        latestEclipse: null,
        latestEclipseSeries: [],
        lastEclipseKey: '',
        lastEclipseSeriesKey: '',
        lastEclipseAdmKey: '',
        eclipseAdmHydrating: false,
        admLoadKey: '',
        admLoadGeneration: 0,
        admBoundaryMode: 'adm0-adm1-adm2',
        ipComparisonMode: 'provider',
        eclipseHorizonYears: 0,
        showIpMarker: true,
        showKaabahLine: true,
        showCalibrationLine: true,
        activePopupFeatureKey: '',
        popupOverlay: null,
        naturalEarthScale: '10m',
        naturalEarthLoading: false,
        naturalEarthLoadedScale: ''
    };

    function resolveRegistryValue(value, fallback) {
        try {
            const resolved = typeof value === 'function' ? value() : value;
            return resolved === undefined || resolved === null ? fallback : resolved;
        } catch (error) {
            return fallback;
        }
    }

    function registryFeatureCoordinates(feature, configuredCoordinates) {
        const explicit = resolveRegistryValue(configuredCoordinates, null);
        if (Array.isArray(explicit) && explicit.length >= 2
            && Number.isFinite(Number(explicit[0])) && Number.isFinite(Number(explicit[1]))) {
            return [Number(explicit[0]), Number(explicit[1])];
        }
        const geometry = feature && feature.getGeometry ? feature.getGeometry() : null;
        if (!geometry || !window.ol) {
            return null;
        }
        try {
            const projected = geometry.getType && geometry.getType() === 'Point'
                ? geometry.getCoordinates()
                : ol.extent.getCenter(geometry.getExtent());
            const lonLat = ol.proj.toLonLat(projected);
            return Number.isFinite(lonLat[0]) && Number.isFinite(lonLat[1])
                ? [normalizeLon(lonLat[0]), clamp(lonLat[1], -90, 90)]
                : null;
        } catch (error) {
            return null;
        }
    }

    function featureRegistrySnapshot(entry, options) {
        const settings = options && typeof options === 'object' ? options : {};
        const marker = resolveRegistryValue(entry.marker || entry.feature, null);
        const layer = resolveRegistryValue(entry.layer, null);
        const coordinates = registryFeatureCoordinates(marker, entry.coordinates);
        const configuredVisibility = resolveRegistryValue(entry.visibility, true) !== false;
        const layerVisibility = !layer || typeof layer.getVisible !== 'function' || layer.getVisible();
        const geometryValid = Boolean(marker && marker.getGeometry && marker.getGeometry() && coordinates);
        const popup = settings.includeContent
            ? resolveRegistryValue(entry.popup, marker && marker.get ? marker.get('infoHtml') : '')
            : '';
        const infoBoxData = settings.includeContent ? resolveRegistryValue(entry.infoBoxData, null) : null;
        return {
            id: entry.id,
            type: resolveRegistryValue(entry.type, ''),
            name: resolveRegistryValue(entry.name, entry.id),
            layer,
            marker,
            feature: marker,
            coordinates,
            popup: popup || '',
            infoBoxData,
            iconUrl: resolveRegistryValue(entry.iconUrl, marker && marker.get ? marker.get('iconPath') : '') || '',
            iconLabel: resolveRegistryValue(entry.iconLabel, resolveRegistryValue(entry.name, entry.id)) || entry.id,
            iconMeaning: resolveRegistryValue(entry.iconMeaning, '') || '',
            visibility: Boolean(configuredVisibility && layerVisibility),
            reviewerEnabled: resolveRegistryValue(entry.reviewerEnabled, true) !== false,
            priority: Number(resolveRegistryValue(entry.priority, 0)) || 0,
            dataSource: resolveRegistryValue(entry.dataSource, ''),
            dataStatus: resolveRegistryValue(entry.dataStatus, ''),
            owner: entry.owner || 'core',
            valid: geometryValid
        };
    }

    function registerFeature(entry) {
        if (!entry || !textValue(entry.id)) {
            return false;
        }
        const normalized = Object.assign({}, entry, { id: textValue(entry.id) });
        state.featureRegistry.set(normalized.id, normalized);
        return true;
    }

    function replaceFeatureRegistry(owner, entries) {
        const registryOwner = textValue(owner, 'external');
        state.featureRegistry.forEach((entry, key) => {
            if (entry.owner === registryOwner) {
                state.featureRegistry.delete(key);
            }
        });
        (Array.isArray(entries) ? entries : []).forEach((entry) => {
            registerFeature(Object.assign({}, entry, { owner: registryOwner }));
        });
        window.dispatchEvent(new CustomEvent('mpm:astro-feature-registry-changed', {
            detail: { owner: registryOwner, count: state.featureRegistry.size }
        }));
        return state.featureRegistry.size;
    }

    function unregisterFeature(id) {
        const removed = state.featureRegistry.delete(textValue(id));
        if (removed) {
            window.dispatchEvent(new CustomEvent('mpm:astro-feature-registry-changed', {
                detail: { owner: 'external', count: state.featureRegistry.size }
            }));
        }
        return removed;
    }

    function getFeatureRegistry(options) {
        const settings = options && typeof options === 'object' ? options : {};
        return Array.from(state.featureRegistry.values())
            .map((entry) => featureRegistrySnapshot(entry, settings))
            .filter((entry) => !settings.validOnly || entry.valid)
            .filter((entry) => !settings.reviewerOnly || (entry.reviewerEnabled && entry.visibility));
    }

    function getFeatureRegistryEntry(id, options) {
        const entry = state.featureRegistry.get(textValue(id));
        return entry ? featureRegistrySnapshot(entry, Object.assign({ includeContent: true }, options || {})) : null;
    }

    function mapContainerDiagnostics() {
        const target = byId('map');
        const rect = target ? target.getBoundingClientRect() : null;
        const size = state.map && state.map.getSize ? state.map.getSize() : null;
        return {
            status: state.map && rect && rect.width > 0 && rect.height > 0 && size && size[0] > 0 && size[1] > 0
                ? 'READY'
                : 'FAIL',
            width: rect ? Math.round(rect.width) : 0,
            height: rect ? Math.round(rect.height) : 0,
            mapSize: size ? size.slice() : null
        };
    }

    function applicationDiagnostics() {
        const registry = getFeatureRegistry();
        return {
            initialization: state.initializationStatus,
            initializationError: state.initializationError,
            map: mapContainerDiagnostics(),
            featureRegistry: {
                status: registry.some((entry) => entry.valid) ? 'READY' : 'FAIL',
                total: registry.length,
                valid: registry.filter((entry) => entry.valid).length,
                reviewerReady: registry.filter((entry) => entry.valid && entry.visibility && entry.reviewerEnabled).length
            },
            popup: state.activePopupFeatureKey ? 'OPEN' : 'CLOSED'
        };
    }

    function completeApplicationReadiness(status, error) {
        state.initializationStatus = status;
        state.initializationError = error ? String(error.message || error) : '';
        const detail = applicationDiagnostics();
        if (!state.readyResolved) {
            state.readyResolved = true;
            resolveApplicationReady(detail);
        }
        window.dispatchEvent(new CustomEvent(status === 'READY' ? 'mpm:astro-map-ready' : 'mpm:astro-map-error', {
            detail
        }));
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function getRuntimeSettings() {
        return window.GisRuntime ? window.GisRuntime.settings() : {};
    }

    function getRuntimeLayer(key) {
        const settings = getRuntimeSettings();
        const layers = Array.isArray(settings.layers) ? settings.layers : [];
        return layers.find((layer) => layer.key === key) || null;
    }

    function runtimeLayerEnabled(key, fallback) {
        const layer = getRuntimeLayer(key);
        return layer ? Boolean(layer.enabled) : fallback;
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

    function usesIndonesianCompass() {
        return String(document.documentElement.lang || '').toLowerCase().indexOf('id') === 0;
    }

    function compassAbbreviation(direction) {
        return usesIndonesianCompass() ? direction.idAbbr : direction.abbr;
    }

    function compassName(direction) {
        return usesIndonesianCompass() ? direction.idName : direction.name;
    }

    function normalizeMinutes(minutes) {
        return ((minutes % 1440) + 1440) % 1440;
    }

    function normalizeHours(hours) {
        return ((hours % 24) + 24) % 24;
    }

    function signedMinuteDifference(left, right) {
        let diff = normalizeMinutes(left) - normalizeMinutes(right);
        if (diff > 720) {
            diff -= 1440;
        }
        if (diff < -720) {
            diff += 1440;
        }
        return diff;
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

    function formatDegrees(value, digits) {
        return `${formatNumber(value, digits)} ${localized('derajat', 'deg')}`;
    }

    function formatPercent(value, digits) {
        if (!Number.isFinite(value)) {
            return '-';
        }

        return `${formatNumber(value * 100, digits)}%`;
    }

    function formatKm(value) {
        if (!Number.isFinite(value)) {
            return '-';
        }

        return `${Math.round(value).toLocaleString('en-US')} km`;
    }

    function formatUtc(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return '-';
        }

        return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
    }

    function formatLocalDateTime(date, offsetHours) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return '-';
        }

        const shifted = new Date(date.getTime() + offsetHours * 3600000);
        return `${shifted.toISOString().replace('T', ' ').slice(0, 19)} ${formatUtcOffset(offsetHours)}`;
    }

    function formatUtcOffset(offsetHours) {
        const sign = offsetHours >= 0 ? '+' : '-';
        const absoluteMinutes = Math.round(Math.abs(offsetHours) * 60);
        const hours = Math.floor(absoluteMinutes / 60);
        const minutes = absoluteMinutes % 60;
        return `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    function formatClockFromMinutes(minutes) {
        if (!Number.isFinite(minutes)) {
            return '-';
        }

        const rounded = Math.round(normalizeMinutes(minutes));
        const hours = Math.floor(rounded / 60);
        const mins = rounded % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }

    function formatLocalClock(date, offsetHours, withSeconds) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return '-';
        }

        const shifted = new Date(date.getTime() + offsetHours * 3600000);
        const text = shifted.toISOString().slice(11, withSeconds ? 19 : 16);
        return text;
    }

    function formatDateOnly(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return '-';
        }

        return date.toISOString().slice(0, 10);
    }

    function formatDuration(seconds) {
        if (!Number.isFinite(seconds)) {
            return '-';
        }

        const total = Math.max(0, Math.round(seconds));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function formatCoordinatePair(lat, lon, digits) {
        if (!validCoordinates(lat, lon)) {
            return '-';
        }

        const precision = Number.isFinite(Number(digits)) ? Number(digits) : 6;
        return `${formatNumber(Number(lat), precision)}, ${formatNumber(normalizeLon(Number(lon)), precision)}`;
    }

    function formatApproxAge(baseYearsAtReference, date) {
        const targetDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : getNetworkNow();
        const totalSeconds = Math.max(
            0,
            baseYearsAtReference * AVG_YEAR_SECONDS + (targetDate.getTime() - AGE_REFERENCE_UTC_MS) / 1000
        );
        const years = Math.floor(totalSeconds / AVG_YEAR_SECONDS);
        const remainder = totalSeconds - years * AVG_YEAR_SECONDS;
        const days = Math.floor(remainder / 86400);
        const secondsInDay = Math.floor(remainder - days * 86400);
        return `${years.toLocaleString('en-US')} ${localized('tahun', 'years')} ${days} ${localized('hari', 'days')} ${formatDuration(secondsInDay)}`;
    }

    function formatSignedSeconds(seconds) {
        if (!Number.isFinite(seconds)) {
            return '-';
        }

        const sign = seconds >= 0 ? '+' : '-';
        const absolute = Math.abs(seconds);
        return `${sign}${Math.round(absolute)}s (${sign}${formatNumber(absolute / 60, 2)}m)`;
    }

    function formatSignedDegrees(value) {
        if (!Number.isFinite(value)) {
            return '-';
        }

        const sign = value >= 0 ? '+' : '-';
        return `${sign}${formatNumber(Math.abs(value), 4)}`;
    }

    function formatSignedValue(value, digits, suffix) {
        if (!Number.isFinite(value)) {
            return '-';
        }

        const sign = value >= 0 ? '+' : '-';
        return `${sign}${formatNumber(Math.abs(value), digits)}${suffix || ''}`;
    }

    function escapeHtml(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function textValue(value, fallback) {
        const text = String(value === undefined || value === null ? '' : value).trim();
        return text || fallback || '';
    }

    function optionalTextValue(value) {
        const text = textValue(value);
        if (!text || /^(?:null|undefined|n\/?a|none|-\s*(?:m|km|ms)?|tidak tersedia|unavailable)$/i.test(text)) {
            return '';
        }
        return text;
    }

    function optionalNumberValue(value) {
        if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
            return null;
        }
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
    }

    function setText(id, value) {
        const element = byId(id);
        if (element) {
            element.textContent = value;
        }
    }

    function setHtml(id, html) {
        const element = byId(id);
        if (element) {
            element.innerHTML = html;
        }
    }

    function languageMode() {
        return window.PrayerI18n ? window.PrayerI18n.getCurrentLanguage() : (state.reviewerLanguage === 'en' ? 'en' : 'id');
    }

    function normalizeReviewerLanguage(value) {
        const text = textValue(value).toLowerCase();
        if (text === 'id' || text === 'en') {
            return text;
        }
        return 'id';
    }

    function requestedReviewerLanguage() {
        if (window.PrayerI18n) return window.PrayerI18n.getCurrentLanguage();
        try {
            const params = new URLSearchParams(window.location.search || '');
            const requested = textValue(params.get('lang') || '').toLowerCase();
            return requested === 'en' || requested === 'id' ? requested : '';
        } catch (error) {
            return '';
        }
    }

    function applyReviewerLanguage() {
        const mode = languageMode();
        document.documentElement.lang = mode === 'en' ? 'en' : 'id';
        document.querySelectorAll('[data-language]').forEach((button) => {
            const active = button.dataset.language === mode;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        applyStaticPageTranslations();
        setText('reviewerModeBadge', state.reviewerMode === 'display'
            ? localized('Display', 'Display')
            : localized('Pengaturan', 'Settings'));
        if (state.adminContext) {
            setContextBadge(displaySourceLabel(state.adminContext.source || 'Database'));
        }
        updateConnectivityBadge();
        if (byId('timelineLabel')) {
            updateTimelineLabel();
        }
    }

    function localized(idText, enText) {
        const mode = languageMode();
        return mode === 'en' ? enText : idText;
    }

    function setElementText(selector, idText, enText) {
        document.querySelectorAll(selector).forEach((element) => {
            element.textContent = localized(idText, enText);
        });
    }

    function setElementAttribute(selector, attribute, idText, enText) {
        document.querySelectorAll(selector).forEach((element) => {
            element.setAttribute(attribute, localized(idText, enText));
        });
    }

    function setControlLabel(controlId, idText, enText) {
        const control = byId(controlId);
        const label = control ? control.closest('label') : null;
        const span = label ? label.querySelector('span') : null;
        if (span) {
            span.textContent = localized(idText, enText);
        }
    }

    function setOptionText(selectId, value, idText, enText) {
        const select = byId(selectId);
        if (!select) {
            return;
        }
        const option = select.querySelector(`option[value="${value}"]`);
        if (option) {
            option.textContent = localized(idText, enText);
        }
    }

    function setButtonLabel(buttonId, idText, enText) {
        const button = byId(buttonId);
        if (!button) {
            return;
        }
        const text = ` ${localized(idText, enText)}`;
        const existing = Array.from(button.childNodes).find((node) => (
            node.nodeType === Node.TEXT_NODE && node.textContent.trim()
        ));
        if (existing) {
            existing.textContent = text;
        } else {
            button.appendChild(document.createTextNode(text));
        }
    }

    function applyStaticPageTranslations() {
        const isDisplayPage = state.reviewerMode === 'display'
            || ((document.body && document.body.dataset.reviewerMode) || '').toLowerCase() === 'display';
        const pageTitle = isDisplayPage
            ? localized('Tampilan Astronomical Reviewer', 'Astronomical Reviewer Display')
            : localized('Pengaturan Astronomical Reviewer', 'Astronomical Reviewer Settings');
        document.title = pageTitle;
        setElementText('.brand-block h1', pageTitle, pageTitle);
        setElementAttribute('#map', 'aria-label', 'Peta GIS astronomi lanjutan', 'Advanced astronomical GIS map');
        setElementAttribute('.map-tools, .astro-map-drawer', 'aria-label', 'Kontrol peta', 'Map controls');
        setElementAttribute('.control-panel, .astro-info-drawer', 'aria-label', 'Panel data astronomi', 'Astronomical data panel');
        setElementAttribute('.panel-tabs', 'aria-label', 'Panel', 'Panel');
        setElementAttribute('#locateButton', 'title', 'Gunakan lokasi perangkat', 'Use device location');
        setElementAttribute('#locateButton', 'aria-label', 'Gunakan lokasi perangkat', 'Use device location');
        setElementAttribute('#syncTimeButton', 'title', 'Sinkron waktu jaringan', 'Sync network time');
        setElementAttribute('#syncTimeButton', 'aria-label', 'Sinkron waktu jaringan', 'Sync network time');
        setElementAttribute('#exportButton', 'title', 'Ekspor JSON', 'Export JSON');
        setElementAttribute('#exportButton', 'aria-label', 'Ekspor JSON', 'Export JSON');
        setElementAttribute('#playTimeline', 'title', 'Putar timeline', 'Play timeline');
        setElementAttribute('#playTimeline', 'aria-label', 'Putar timeline', 'Play timeline');
        setElementAttribute('#copyJsonButton', 'title', 'Salin JSON', 'Copy JSON');
        setElementAttribute('#copyJsonButton', 'aria-label', 'Salin JSON', 'Copy JSON');
        const statusLine = byId('statusLine');
        if (statusLine && /^(Memuat mesin astronomi|Loading astronomy engine)$/.test(statusLine.textContent.trim())) {
            statusLine.textContent = localized('Memuat mesin astronomi', 'Loading astronomy engine');
        }
        const contextBadge = byId('contextSourceBadge');
        if (contextBadge && /^(Waiting|Menunggu)$/.test(contextBadge.textContent.trim())) {
            contextBadge.textContent = localized('Menunggu', 'Waiting');
        }
        const trajectoryStatus = byId('trajectoryStatus');
        if (trajectoryStatus && /^(Siap|Ready)$/.test(trajectoryStatus.textContent.trim())) {
            trajectoryStatus.textContent = localized('Siap', 'Ready');
        }
        const renderBadge = byId('renderDateBadge');
        if (renderBadge && /^(Render -)$/.test(renderBadge.textContent.trim())) {
            renderBadge.textContent = localized('Render -', 'Render -');
        }

        setElementText('[data-tab="context"]', 'Konteks', 'Context');
        setElementText('[data-tab="observe"]', 'Observasi', 'Observation');
        setElementText('[data-tab="orbit"]', 'Orbit', 'Orbit');
        setElementText('[data-tab="time"]', 'Waktu', 'Time');
        setElementText('[data-tab="prayer"]', 'Shalat', 'Prayer');
        setElementText('[data-tab="rukyat"]', byId('fieldObservationRoot') ? 'Rukyat lapangan' : 'Rukyat', byId('fieldObservationRoot') ? 'Field observation' : 'Rukyat');
        setElementText('[data-tab="api"]', 'API', 'API');

        setElementText('#atmosphereToggle + span', 'Atmosfer', 'Atmosphere');
        setElementText('#trajectoryToggle + span', 'Trajektori', 'Trajectory');
        setElementText('#sunTrajectoryToggle + span', 'Jalur Matahari', 'Sun Path');
        setElementText('#moonTrajectoryToggle + span', 'Jalur Bulan', 'Moon Path');
        setElementText('#prayerZoneToggle + span', 'Zona Shalat', 'Prayer Zone');
        setElementText('#hilalZoneToggle + span', 'Hilal', 'Crescent');
        setElementText('#directionToggle + span', '16 Arah', '16 Directions');
        setElementText('#admBoundaryToggle + span', 'ADM', 'ADM');
        setElementText('#ipMarkerToggle + span', 'IP', 'IP');
        setElementText('#kaabahLineToggle + span', 'Kaabah', 'Kaabah');

        setElementText('#tab-context .section-head h2', 'Konteks Reviewer', 'Reviewer Context');
        setElementText('#tab-observe > .section-head:first-child h2', 'Observer', 'Observer');
        setElementText('#tab-orbit > .section-head:first-child h2', 'Trajektori', 'Trajectory');
        setElementText('#tab-time > .section-head:first-child h2', 'Komparasi Waktu', 'Time Comparison');
        setElementText('#tab-prayer > .section-head:first-child h2', 'Prayer Engine', 'Prayer Engine');
        setElementText('#tab-rukyat > .section-head:first-child h2', 'Rukyat Hilal', 'Crescent Rukyat');
        setElementText('#tab-api > .section-head:first-child h2', 'Output JSON', 'JSON Output');
        setElementText('#tab-time .section-head.compact h2', 'Analisis 16 Arah', '16-Direction Analysis');
        const observeCompactHeads = document.querySelectorAll('#tab-observe .section-head.compact h2');
        if (observeCompactHeads[0]) {
            observeCompactHeads[0].textContent = localized('Matahari', 'Sun');
        }
        if (observeCompactHeads[1]) {
            observeCompactHeads[1].textContent = localized('Bulan', 'Moon');
        }

        setElementAttribute('.astro-language-switch', 'aria-label', 'Bahasa halaman', 'Page language');
        setElementText('.astro-language-switch .astro-field-label', 'Bahasa halaman', 'Page language');
        setElementText('#buildingContextIcon + span', 'Bangunan', 'Building');
        setElementText('#ipContextIcon + span', 'IP provider', 'IP provider');
        setElementText('#kaabahContextIcon + span', 'Kaabah', 'Kaabah');
        setElementText('#contextSettingsPanelTitle', 'Pengaturan tampilan dan sumber', 'Display and source settings');
        setElementText('#islamicMethodPanelTitle', 'Review Metode Rukyat / Hisab', 'Rukyat / Hisab Method Review');
        setElementText('#falakEnginePanelTitle', 'Universal Falak Engine', 'Universal Falak Engine');
        setElementText('#falakCalendarPanelTitle', 'Kalender Ibadah Islam', 'Islamic Worship Calendar');
        setElementText('#eclipsePredictionPanelTitle', 'Prediksi Gerhana Matahari / Bulan', 'Solar / Lunar Eclipse Prediction');

        setControlLabel('reviewerModeSelect', 'Versi reviewer', 'Reviewer version');
        setControlLabel('admBoundaryMode', 'ADM overlay', 'ADM overlay');
        setControlLabel('ipComparisonMode', 'Perbandingan IP', 'IP comparison');
        setControlLabel('eclipseRangeSelect', 'Rentang titik gerhana', 'Eclipse point range');
        setControlLabel('observerLat', 'Latitude', 'Latitude');
        setControlLabel('observerLon', 'Longitude', 'Longitude');
        setControlLabel('observerElev', 'Elevasi meter', 'Elevation meters');
        setControlLabel('directionDistance', 'Jarak analisis km', 'Analysis distance km');
        setControlLabel('trajectoryBody', 'Benda langit', 'Celestial body');
        setControlLabel('trajectoryYears', 'Rentang', 'Range');
        setControlLabel('trajectoryStep', 'Sampel hari', 'Sample days');
        setControlLabel('playbackSpeed', 'Playback hari/detik', 'Playback days/second');
        setControlLabel('timeInput', 'Waktu dasar', 'Base time');
        setControlLabel('timelineSlider', 'Offset timeline hari', 'Timeline offset days');
        setControlLabel('timezoneSelect', 'Zona waktu', 'Timezone');
        setControlLabel('atmosphereOpacity', 'Opasitas atmosfer', 'Atmosphere opacity');
        setControlLabel('atmosphereOpacityMap', 'Opasitas atmosfer', 'Atmosphere opacity');
        setControlLabel('prayerMethod', 'Metode', 'Method');
        setControlLabel('asrMadhab', 'Madhab Ashar', 'Asr school');

        setElementText('#liveTimeToggle + span', 'Realtime', 'Realtime');
        setElementText('#sunDailyLegend', 'Lintasan harian matahari', 'Daily Sun path');
        setElementText('#sunAnalemmaLegend', 'Analemma matahari', 'Sun analemma');
        setElementText('#moonPathLegend', 'Lintasan bulan', 'Moon path');
        setButtonLabel('loadAdminContext', 'Muat database', 'Load database');
        setButtonLabel('applyAdminContext', 'Pakai gedung', 'Use building');
        setButtonLabel('applyObserver', 'Terapkan', 'Apply');
        setButtonLabel('centerObserver', 'Pusatkan', 'Center');
        setButtonLabel('rebuildTrajectory', 'Hitung Trajektori', 'Calculate Trajectory');

        setOptionText('reviewerModeSelect', 'settings', 'Settings / konfigurasi', 'Settings / configuration');
        setOptionText('reviewerModeSelect', 'display', 'Display final', 'Final display');
        setOptionText('admBoundaryMode', 'off', 'Mati', 'Off');
        setOptionText('ipComparisonMode', 'provider', 'Marker IP provider saja', 'IP provider marker only');
        setOptionText('ipComparisonMode', 'off', 'Mati', 'Off');
        setOptionText('trajectoryBody', 'both', 'Matahari + Bulan', 'Sun + Moon');
        setOptionText('trajectoryBody', 'sun', 'Matahari', 'Sun');
        setOptionText('trajectoryBody', 'moon', 'Bulan', 'Moon');
        setOptionText('trajectoryYears', '5', '5 tahun mundur/maju', '5 years backward/forward');
        setOptionText('trajectoryYears', '10', '10 tahun mundur/maju', '10 years backward/forward');
        setOptionText('trajectoryStep', '1', '1 hari', '1 day');
        setOptionText('trajectoryStep', '3', '3 hari', '3 days');
        setOptionText('trajectoryStep', '7', '7 hari', '7 days');
        setOptionText('trajectoryStep', '14', '14 hari', '14 days');

        setElementText('#tab-time thead th:nth-child(1)', 'Arah', 'Direction');
        setElementText('#tab-time thead th:nth-child(2)', 'Delta Koordinat', 'Coordinate Delta');
        setElementText('#tab-time thead th:nth-child(3)', 'Solar', 'Solar');
        setElementText('#tab-time thead th:nth-child(4)', 'Shalat', 'Prayer');
        setElementText('#tab-time thead th:nth-child(5)', 'Hilal', 'Crescent');
        setElementText('#tab-rukyat thead th:nth-child(1)', 'Parameter', 'Parameter');
        setElementText('#tab-rukyat thead th:nth-child(2)', 'Nilai', 'Value');
        setElementAttribute('#panelMoonCanvas', 'aria-label', 'Fase bulan', 'Moon phase');
    }

    function validCoordinates(latitude, longitude) {
        return Number.isFinite(Number(latitude))
            && Number.isFinite(Number(longitude))
            && Number(latitude) >= -90
            && Number(latitude) <= 90
            && Number(longitude) >= -180
            && Number(longitude) <= 180;
    }

    function contextPoint(context) {
        const location = context && context.location ? context.location : {};
        const lat = Number(location.latitude);
        const lon = Number(location.longitude);
        if (!validCoordinates(lat, lon)) {
            return null;
        }
        return { lat, lon };
    }

    function providerPoint() {
        const calibration = timeCoordinateCalibrationState();
        const provider = state.providerContext
            || (calibration && calibration.provider)
            || {};
        const lat = Number(provider.latitude);
        const lon = Number(provider.longitude);
        if (!validCoordinates(lat, lon)) {
            return null;
        }
        return { lat, lon };
    }

    function timeCoordinateCalibrationState() {
        return window.MpmTimeCoordinateCalibration && typeof window.MpmTimeCoordinateCalibration.getState === 'function'
            ? window.MpmTimeCoordinateCalibration.getState()
            : null;
    }

    function kaabahPoint() {
        const context = state.adminContext || {};
        const gis = context.gis && typeof context.gis === 'object' ? context.gis : {};
        const kaabah = gis.kaabah && typeof gis.kaabah === 'object' ? gis.kaabah : {};
        const lat = Number(kaabah.latitude !== undefined ? kaabah.latitude : kaabah.lat);
        const lon = Number(kaabah.longitude !== undefined ? kaabah.longitude : kaabah.lon);
        if (validCoordinates(lat, lon)) {
            return {
                lat,
                lon: normalizeLon(lon),
                timezone: textValue(kaabah.timezone, DEFAULT_KAABAH.timezone)
            };
        }

        return { ...DEFAULT_KAABAH };
    }

    function activeBuildingPoint() {
        return contextPoint(state.adminContext) || {
            lat: state.observer.lat,
            lon: state.observer.lon
        };
    }

    function placesIconPath(fileName) {
        const value = textValue(fileName);
        if (!value) {
            return `${PLACE_ICON_BASE_PATH}mosque.png`;
        }
        if (/^(https?:)?\/\//i.test(value) || value.indexOf('/') !== -1) {
            return value;
        }
        return `${PLACE_ICON_BASE_PATH}${value}`;
    }

    function buildingIconFromContext(context) {
        const mosque = context && context.mosque ? context.mosque : {};
        const configured = textValue(mosque.iconPath);
        if (configured) {
            return placesIconPath(configured);
        }
        const type = textValue(mosque.type).toLowerCase();
        return placesIconPath(PLACE_ICONS[type] || PLACE_ICONS.mosque);
    }

    function timezoneOffsetForDate(timezoneName, date) {
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezoneName,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            const parts = {};
            formatter.formatToParts(date).forEach((part) => {
                if (part.type !== 'literal') {
                    parts[part.type] = Number(part.value);
                }
            });
            const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
            return (asUtc - date.getTime()) / 3600000;
        } catch (error) {
            return NaN;
        }
    }

    function ensureTimezoneOption(timezoneName) {
        const select = byId('timezoneSelect');
        const name = textValue(timezoneName);
        if (!select || !name) {
            return false;
        }

        const existing = Array.from(select.options).find((option) => option.value === name);
        if (existing) {
            select.value = name;
            return true;
        }

        const offset = timezoneOffsetForDate(name, getRenderDate());
        if (!Number.isFinite(offset)) {
            return false;
        }

        const option = document.createElement('option');
        option.value = name;
        option.dataset.offset = String(offset);
        option.textContent = `${name} ${formatUtcOffset(offset)}`;
        select.appendChild(option);
        select.value = name;
        return true;
    }

    function readTimezoneCache() {
        try {
            const raw = window.localStorage ? window.localStorage.getItem(TIMEZONES_LOCAL_KEY) : '';
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    function writeTimezoneCache(payload) {
        try {
            if (window.localStorage) {
                window.localStorage.setItem(TIMEZONES_LOCAL_KEY, JSON.stringify(payload));
            }
        } catch (error) {
            // Timezone cache is an optimization only.
        }
    }

    function normalizeTimezoneRecord(record) {
        const timezone = textValue(record && (record.timezone || record.timezoneName));
        if (!timezone) {
            return null;
        }
        const offsetSeconds = Number(record.offsetSeconds);
        const offsetHours = Number.isFinite(offsetSeconds)
            ? offsetSeconds / 3600
            : timezoneOffsetForDate(timezone, getNetworkNow());
        return {
            timezone,
            offsetHours: Number.isFinite(offsetHours) ? offsetHours : 0,
            offset: textValue(record.offset || formatUtcOffset(offsetHours)),
            abbreviation: textValue(record.abbreviation || ''),
            isDst: record.isDst === true,
            observesDst: record.observesDst === true
        };
    }

    function normalizeTimezonePayload(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const timezones = Array.isArray(source.timezones)
            ? source.timezones
            : (source.data && Array.isArray(source.data.timezones) ? source.data.timezones : []);
        return timezones.map(normalizeTimezoneRecord).filter(Boolean);
    }

    function timezoneOptionLabel(record) {
        const dstLabel = record.isDst
            ? ` ${localized('DST aktif', 'DST active')}`
            : '';
        return `${record.timezone} ${record.offset || formatUtcOffset(record.offsetHours)}${dstLabel}`;
    }

    function populateTimezoneSelect(preferredTimezone) {
        const select = byId('timezoneSelect');
        if (!select) {
            return;
        }

        const runtimeSettings = getRuntimeSettings();
        const runtimeTimezone = runtimeSettings.application && runtimeSettings.application.timezone
            ? runtimeSettings.application.timezone
            : 'Asia/Jakarta';
        const preferred = textValue(preferredTimezone || select.value || runtimeTimezone);
        if (!state.timezones.length) {
            ensureTimezoneOption(preferred);
            return;
        }

        replaceSelectOptions(select, state.timezones.map((record) => ({
            value: record.timezone,
            label: timezoneOptionLabel(record),
            dataset: {
                offset: record.offsetHours,
                abbreviation: record.abbreviation,
                dst: record.isDst ? '1' : '0',
                observesDst: record.observesDst ? '1' : '0'
            }
        })), preferred);

        if (preferred && select.value !== preferred) {
            ensureTimezoneOption(preferred);
        }
    }

    async function loadTimezones(force) {
        if (state.timezonesLoading) {
            return;
        }
        if (state.timezonesLoaded && !force) {
            populateTimezoneSelect(getSelectedTimezoneName());
            return;
        }

        state.timezonesLoading = true;
        const cached = readTimezoneCache();
        if (cached && !state.timezonesLoaded) {
            state.timezones = normalizeTimezonePayload(cached);
            state.timezonesSource = 'local-cache';
            state.timezonesLoaded = true;
            populateTimezoneSelect(getSelectedTimezoneName());
            renderFalakRegistry();
        }

        try {
            const response = await fetch(`${TIMEZONES_API}?at=${encodeURIComponent(getNetworkNow().toISOString())}`, {
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            const payload = await response.json();
            if (!response.ok || !payload || payload.success === false) {
                throw new Error(payload && payload.error ? payload.error : `HTTP ${response.status}`);
            }
            const records = normalizeTimezonePayload(payload.data || payload);
            state.timezones = records;
            state.timezonesSource = 'database';
            state.timezonesLoaded = true;
            state.timezonesError = '';
            writeTimezoneCache(payload.data || payload);
            populateTimezoneSelect(getSelectedTimezoneName());
            renderFalakRegistry();
            clearComputationCaches();
            if (state.latestSnapshot) {
                updateAll(true);
            }
        } catch (error) {
            state.timezonesError = error.message || 'Timezone registry offline';
            if (!state.timezonesLoaded) {
                state.timezones = normalizeTimezonePayload(cached || { timezones: [] });
                state.timezonesSource = cached ? 'local-cache' : 'initial';
                state.timezonesLoaded = true;
                populateTimezoneSelect(getSelectedTimezoneName());
                renderFalakRegistry();
            }
        } finally {
            state.timezonesLoading = false;
        }
    }

    function haversineKm(leftLat, leftLon, rightLat, rightLon) {
        const dLat = degToRad(rightLat - leftLat);
        const dLon = degToRad(normalize180(rightLon - leftLon));
        const lat1 = degToRad(leftLat);
        const lat2 = degToRad(rightLat);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function initialBearing(leftLat, leftLon, rightLat, rightLon) {
        const lat1 = degToRad(leftLat);
        const lat2 = degToRad(rightLat);
        const dLon = degToRad(normalize180(rightLon - leftLon));
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2)
            - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        return normalize360(radToDeg(Math.atan2(y, x)));
    }

    function currentAdmLabels(context) {
        const location = context && context.location ? context.location : {};
        return {
            adm0: textValue(location.adm0 || location.country),
            adm1: textValue(location.adm1 || location.province),
            adm2: textValue(location.adm2 || location.city),
            adm1Id: textValue(location.adm1Id || location.adm1_id || location.provinceId || location.province_id),
            adm2Id: textValue(location.adm2Id || location.adm2_id || location.cityId || location.city_id || location.districtId || location.district_id),
            countryCode: textValue(location.countryCode || location.country_code || location.iso2).toUpperCase().slice(0, 2)
        };
    }

    function displaySourceLabel(source) {
        const value = textValue(source).toLowerCase();
        if (value === 'active-mosque-api') {
            return localized('Database admin aktif', 'Active admin database');
        }
        if (value === 'database' || value === 'active-database') {
            return localized('Database admin', 'Admin database');
        }
        if (value === 'local-storage' || value === 'local-cache') {
            return localized('Cache lokal', 'Local cache');
        }
        if (value === 'manual') {
            return localized('Manual', 'Manual');
        }
        return source || '-';
    }

    function displayBuildingType(value) {
        const text = textValue(value);
        const key = text.toLowerCase();
        const labels = {
            mosque: localized('Masjid', 'Mosque'),
            building: localized('Bangunan', 'Building'),
            house: localized('Rumah', 'House'),
            office: localized('Kantor', 'Office'),
            school: localized('Sekolah', 'School'),
            university: localized('Universitas', 'University'),
            hospital: localized('Rumah sakit', 'Hospital'),
            'prayer-room': localized('Mushalla', 'Prayer room'),
            'eid-prayer-location': localized('Lokasi shalat Id', 'Eid prayer location'),
            'islamic-boarding-school': localized('Pesantren', 'Islamic boarding school')
        };
        return labels[key] || text || localized('Bangunan', 'Building');
    }

    function displayAdmLabel(value, level) {
        const text = textValue(value);
        if (!text) {
            return '';
        }
        if (languageMode() === 'en') {
            return text;
        }

        const exact = {
            'Special Region of Yogyakarta': 'Daerah Istimewa Yogyakarta',
            'Yogyakarta Special Region': 'Daerah Istimewa Yogyakarta',
            'Makkah Region': 'Wilayah Makkah'
        };
        if (exact[text]) {
            return exact[text];
        }
        if (level === 'adm2') {
            const regency = /^(.+?)\s+Regency$/i.exec(text);
            if (regency) {
                return `Kabupaten ${regency[1]}`;
            }
            const city = /^(.+?)\s+City$/i.exec(text);
            if (city) {
                return `Kota ${city[1]}`;
            }
        }
        if (level === 'adm1') {
            const province = /^(.+?)\s+Province$/i.exec(text);
            if (province) {
                return `Provinsi ${province[1]}`;
            }
            const region = /^(.+?)\s+Region$/i.exec(text);
            if (region) {
                return `Wilayah ${region[1]}`;
            }
        }
        return text;
    }

    function displayAdmLabels(context) {
        const labels = currentAdmLabels(context);
        return {
            adm0: displayAdmLabel(labels.adm0, 'adm0'),
            adm1: displayAdmLabel(labels.adm1, 'adm1'),
            adm2: displayAdmLabel(labels.adm2, 'adm2')
        };
    }

    function calculateKaabahSpatialComparison() {
        const building = activeBuildingPoint();
        const kaabah = kaabahPoint();
        return {
            latitude: kaabah.lat,
            longitude: kaabah.lon,
            timezone: kaabah.timezone,
            distanceKm: haversineKm(building.lat, building.lon, kaabah.lat, kaabah.lon),
            bearingFromBuilding: initialBearing(building.lat, building.lon, kaabah.lat, kaabah.lon),
            longitudeDelta: normalize180(kaabah.lon - building.lon),
            latitudeDelta: kaabah.lat - building.lat
        };
    }

    function setStatus(message) {
        const element = byId('statusLine');
        if (element) {
            element.textContent = message;
        }
    }

    function localizedNetworkSource(source) {
        if (source === 'Device clock') {
            return localized('Jam perangkat', 'Device clock');
        }
        if (source === 'Network time') {
            return localized('Waktu jaringan', 'Network time');
        }
        return source || localized('Jam perangkat', 'Device clock');
    }

    function ensureMapInfoPopup() {
        let element = byId('astroMapInfoPopup');
        if (!element) {
            element = document.createElement('div');
            element.id = 'astroMapInfoPopup';
            element.className = 'map-info-popup astro-map-popup hidden';
            element.setAttribute('aria-live', 'polite');
            const shell = document.querySelector('.app-shell') || document.body;
            shell.appendChild(element);
        }
        if (!element.dataset.bound) {
            element.addEventListener('click', (event) => {
                const closeButton = event.target.closest('[data-popup-close]');
                if (closeButton) {
                    event.preventDefault();
                    hideMapInfoPopup();
                }
            });
            element.dataset.bound = '1';
        }
        return element;
    }

    function showMapInfoPopup(coordinate, html) {
        const element = ensureMapInfoPopup();
        element.innerHTML = html;
        element.classList.toggle('astro-earthquake-popup', Boolean(element.querySelector('.earthquake-radius-info')));
        element.classList.remove('hidden');
        if (window.MpmEarthquakeRadius) window.MpmEarthquakeRadius.layoutPopup();
        if (state.popupOverlay) {
            state.popupOverlay.setPosition(coordinate);
        }
        if (volcanoController) volcanoController.layoutPopup();
        if (airQualityController) airQualityController.layoutPopup();
    }

    function hideMapInfoPopup() {
        if (window.MpmEarthquakeRadius) window.MpmEarthquakeRadius.clear();
        setActivePopupFeature(null);
        const element = byId('astroMapInfoPopup');
        if (element) {
            element.classList.add('hidden');
        }
        if (state.popupOverlay) {
            state.popupOverlay.setPosition(undefined);
        }
        if (volcanoController) volcanoController.layoutPopup();
        if (airQualityController) airQualityController.layoutPopup();
    }

    function popupFeatureKey(feature) {
        if (!feature || !feature.get) {
            return '';
        }
        const kind = textValue(feature.get('kind'));
        if (!kind) {
            return '';
        }
        const explicitKey = textValue(feature.get('popupKey') || feature.get('recordId'));
        if (explicitKey) {
            return `${kind}:${explicitKey}`;
        }
        if (kind === 'solar-eclipse' || kind === 'lunar-eclipse') {
            const eclipse = feature.get('eclipse') || {};
            return [
                kind,
                textValue(eclipse.referenceCode || feature.get('referenceCode')),
                textValue(eclipse.peakUtc || feature.get('peakUtc')),
                textValue(feature.get('markerLabel') || feature.get('label'))
            ].filter(Boolean).join(':');
        }
        return kind;
    }

    function setActivePopupFeature(feature) {
        const nextKey = feature ? popupFeatureKey(feature) : '';
        if (state.activePopupFeatureKey === nextKey) {
            return;
        }
        state.activePopupFeatureKey = nextKey;
        refreshPopupHighlightLayers();
        window.dispatchEvent(new CustomEvent('mpm:astro-popup-active-changed', {
            detail: { featureKey: nextKey }
        }));
    }

    function isActivePopupFeature(feature) {
        const key = popupFeatureKey(feature);
        return Boolean(key && state.activePopupFeatureKey && key === state.activePopupFeatureKey);
    }

    function refreshPopupHighlightLayers() {
        ['bodies', 'context', 'eclipse'].forEach((layerKey) => {
            if (state.layers[layerKey] && typeof state.layers[layerKey].changed === 'function') {
                state.layers[layerKey].changed();
            }
        });
    }

    function activePopupHighlightStyle(radius) {
        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: radius || 20,
                fill: new ol.style.Fill({ color: 'rgba(245, 202, 66, 0.22)' }),
                stroke: new ol.style.Stroke({ color: '#f5ca42', width: 3 })
            })
        });
    }

    function withPopupHighlight(feature, style, radius) {
        if (!isActivePopupFeature(feature)) {
            return style;
        }
        return [
            activePopupHighlightStyle(radius),
            style
        ];
    }

    function infoBoxHtml(title, rows, media) {
        const cleanedRows = rows
            .map((row) => ({
                label: textValue(row.label),
                value: textValue(row.value)
            }))
            .filter((row) => row.label && row.value);
        const mediaHtml = media && media.src
            ? `<div class="astro-popup-media"><img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt || title)}"><span>${escapeHtml(media.caption || '')}</span></div>`
            : '';
        return [
            `<button class="astro-popup-close" type="button" data-popup-close aria-label="${escapeHtml(localized('Tutup popup', 'Close popup'))}">x</button>`,
            mediaHtml,
            `<h4>${escapeHtml(title)}</h4>`,
            `<dl>${cleanedRows.map((row) => `<dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd>`).join('')}</dl>`
        ].join('');
    }

    function admLabelsForCoordinate(lat, lon) {
        const result = { adm0: '', adm1: '', adm2: '' };
        if (!state.sources.adm || !validCoordinates(lat, lon)) {
            return result;
        }

        const coordinate = ol.proj.fromLonLat([normalizeLon(Number(lon)), Number(lat)]);
        state.sources.adm.getFeatures().forEach((feature) => {
            const geometry = feature && feature.getGeometry ? feature.getGeometry() : null;
            if (!geometry) {
                return;
            }
            let contains = false;
            if (typeof geometry.intersectsCoordinate === 'function') {
                contains = geometry.intersectsCoordinate(coordinate);
            }
            if (!contains && ol.extent && typeof ol.extent.containsCoordinate === 'function') {
                contains = ol.extent.containsCoordinate(geometry.getExtent(), coordinate);
            }
            if (!contains) {
                return;
            }

            const name = boundaryFeatureName(feature);
            const level = feature.get('admLevel');
            if (level === 'adm0') {
                result.adm0 = name;
            } else if (level === 'adm1') {
                result.adm1 = name;
            } else if (level === 'adm2') {
                result.adm2 = name;
            }
        });
        return result;
    }

    function implementationAdmLabels() {
        const labels = currentAdmLabels(state.adminContext);
        return {
            adm0: labels.adm0 || '-',
            adm1: labels.adm1 || '-',
            adm2: labels.adm2 || '-',
            source: 'offline-admin-context'
        };
    }

    function mergeAdmLabels(primary, fallback, source) {
        const safePrimary = primary || {};
        const safeFallback = fallback || {};
        return {
            adm0: textValue(safePrimary.adm0, textValue(safeFallback.adm0, '-')),
            adm1: textValue(safePrimary.adm1, textValue(safeFallback.adm1, '-')),
            adm2: textValue(safePrimary.adm2, textValue(safeFallback.adm2, '-')),
            source: textValue(source || safePrimary.source || safeFallback.source, 'offline-admin-context')
        };
    }

    function eclipseReferenceCode(eventType, peakUtc) {
        const compact = textValue(peakUtc)
            .replace(/\.\d{3}Z$/, 'Z')
            .replace(/[^0-9TZ]/g, '')
            .replace(/Z$/, '');
        return `${eventType}-${compact || 'unknown'}`;
    }

    function applyOfflineAdm(event) {
        const boundaryAdm = validCoordinates(event.latitude, event.longitude)
            ? admLabelsForCoordinate(event.latitude, event.longitude)
            : {};
        const implementationAdm = implementationAdmLabels();
        const hasBoundary = Boolean(boundaryAdm.adm0 || boundaryAdm.adm1 || boundaryAdm.adm2);
        const adm = mergeAdmLabels(
            hasBoundary ? boundaryAdm : null,
            implementationAdm,
            hasBoundary ? 'client-boundary' : 'offline-admin-context'
        );
        event.adm = mergeAdmLabels(event.adm, adm, event.adm && event.adm.source ? event.adm.source : adm.source);
        event.clientAdm = adm;
        return event;
    }

    function cacheKeyForEclipseAdm(event) {
        return `${event.eventType || 'solar'}|${event.referenceCode || eclipseReferenceCode(event.eventType || 'solar', event.peakUtc || '')}`;
    }

    function readLocalEclipseAdmCache() {
        try {
            const raw = localStorage.getItem(ECLIPSE_ADM_LOCAL_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function writeLocalEclipseAdmCache(cache) {
        try {
            localStorage.setItem(ECLIPSE_ADM_LOCAL_KEY, JSON.stringify(cache));
        } catch (error) {
            // Ignore storage quota/private-mode failures; database/API cache remains the source of truth when online.
        }
    }

    function applyStoredEclipseAdm(event) {
        const cache = readLocalEclipseAdmCache();
        const cached = cache[cacheKeyForEclipseAdm(event)];
        if (cached && cached.adm) {
            event.adm = mergeAdmLabels(cached.adm, event.adm || implementationAdmLabels(), cached.source || cached.adm.source || 'local-cache');
            event.displayName = textValue(cached.displayName, event.displayName || '');
            event.admUpdatedAt = textValue(cached.updatedAt, event.admUpdatedAt || '');
        }
        return applyOfflineAdm(event);
    }

    function fallbackAdmValue(primary, basis, label) {
        if (primary) {
            return primary;
        }
        if (basis) {
            return `${basis} (${localized('konteks implementasi', 'implementation context')})`;
        }
        return `${label} ${localized('kosong dari konfigurasi implementasi', 'is empty in implementation configuration')}`;
    }

    function formatHoursAsDuration(hours) {
        if (!Number.isFinite(hours)) {
            return '-';
        }
        const totalSeconds = Math.max(0, Math.round(hours * 3600));
        const days = Math.floor(totalSeconds / 86400);
        const rest = totalSeconds - days * 86400;
        return `${days} ${localized('hari', 'days')} ${formatDuration(rest)}`;
    }

    function moonPopupImage() {
        try {
            return getMoonIconCanvas().toDataURL('image/png');
        } catch (error) {
            return ICONS.moon;
        }
    }

    function classifySunPhase(altitude) {
        if (!Number.isFinite(altitude)) {
            return localized('Tidak tersedia', 'Not available');
        }
        if (altitude >= 0) {
            return localized('Siang. Matahari tidak memiliki fase visual seperti Bulan.', 'Daylight. The Sun does not have a visible phase like the Moon.');
        }
        if (altitude >= -6) {
            return localized('Senja sipil. Matahari tidak memiliki fase visual seperti Bulan.', 'Civil twilight. The Sun does not have a visible phase like the Moon.');
        }
        if (altitude >= -12) {
            return localized('Senja nautikal. Matahari tidak memiliki fase visual seperti Bulan.', 'Nautical twilight. The Sun does not have a visible phase like the Moon.');
        }
        if (altitude >= -18) {
            return localized('Senja astronomis. Matahari tidak memiliki fase visual seperti Bulan.', 'Astronomical twilight. The Sun does not have a visible phase like the Moon.');
        }
        return localized('Malam astronomis. Matahari tidak memiliki fase visual seperti Bulan.', 'Astronomical night. The Sun does not have a visible phase like the Moon.');
    }

    function currentTimeComparison() {
        return state.latestOutput && state.latestOutput.timeComparison
            ? state.latestOutput.timeComparison
            : null;
    }

    function buildSunInfoHtml() {
        const snapshot = state.latestSnapshot;
        if (!snapshot) {
            return infoBoxHtml(localized('Matahari', 'Sun'), [
                { label: localized('Status', 'Status'), value: localized('Menunggu kalkulasi.', 'Waiting for calculation.') }
            ]);
        }
        return infoBoxHtml(localized('Matahari', 'Sun'), [
            { label: localized('Jenis/type', 'Type'), value: localized('Matahari', 'Sun') },
            { label: localized('Fase/status', 'Phase/status'), value: classifySunPhase(snapshot.sun.horizontal.altitude) },
            { label: localized('Ketinggian', 'Altitude'), value: formatDegrees(snapshot.sun.horizontal.altitude, 2) },
            { label: localized('Azimut', 'Azimuth'), value: `${formatDegrees(snapshot.sun.horizontal.azimuth, 2)} ${getCompassDirection(snapshot.sun.horizontal.azimuth)}` },
            { label: 'Subsolar', value: formatCoordinatePair(snapshot.sun.subpoint.lat, snapshot.sun.subpoint.lon, 4) },
            { label: localized('Jarak bumi', 'Distance from Earth'), value: `${formatKm(snapshot.sun.distanceKm)} / ${formatNumber(snapshot.sun.distanceAu, 6)} AU` },
            { label: localized('Usia matahari', 'Sun age'), value: formatApproxAge(SUN_APPROX_AGE_YEARS_2026, snapshot.date) },
            { label: localized('Waktu render', 'Render time'), value: formatUtc(snapshot.date) }
        ], {
            src: ICONS.sun,
            alt: 'Sun icon',
            caption: localized('Icon matahari yang sama dengan marker peta.', 'The same Sun icon used by the map marker.')
        });
    }

    function buildMoonInfoHtml() {
        const snapshot = state.latestSnapshot;
        if (!snapshot) {
            return infoBoxHtml(localized('Bulan', 'Moon'), [
                { label: localized('Status', 'Status'), value: localized('Menunggu kalkulasi.', 'Waiting for calculation.') }
            ]);
        }

        return infoBoxHtml(localized('Bulan', 'Moon'), [
            { label: localized('Jenis/type', 'Type'), value: localized('Bulan', 'Moon') },
            { label: localized('Fase bulan', 'Moon phase'), value: snapshot.moon.phaseName },
            { label: localized('Iluminasi', 'Illumination'), value: formatPercent(snapshot.moon.illumination, 1) },
            { label: localized('Elongasi', 'Elongation'), value: formatDegrees(snapshot.moon.phaseAngle, 2) },
            { label: localized('Umur fase', 'Phase age'), value: formatHoursAsDuration(snapshot.moon.conjunction.ageHours) },
            { label: localized('Ketinggian', 'Altitude'), value: formatDegrees(snapshot.moon.horizontal.altitude, 2) },
            { label: localized('Azimut', 'Azimuth'), value: `${formatDegrees(snapshot.moon.horizontal.azimuth, 2)} ${getCompassDirection(snapshot.moon.horizontal.azimuth)}` },
            { label: 'Sublunar', value: formatCoordinatePair(snapshot.moon.subpoint.lat, snapshot.moon.subpoint.lon, 4) },
            { label: localized('Jarak bumi', 'Distance from Earth'), value: `${formatKm(snapshot.moon.distanceKm)} / ${formatNumber(snapshot.moon.distanceAu, 6)} AU` },
            { label: localized('Usia bulan', 'Moon age'), value: formatApproxAge(MOON_APPROX_AGE_YEARS_2026, snapshot.date) }
        ], {
            src: moonPopupImage(),
            alt: 'Moon phase icon',
            caption: localized('Gambar fase bulan mengikuti marker pada peta.', 'The phase image follows the Moon marker on the map.')
        });
    }

    function buildTimelineInfoHtml() {
        const snapshot = state.latestSnapshot || {};
        const sun = snapshot.sun || {};
        const subpoint = sun.subpoint || {};
        const renderedAt = snapshot.date || actualNow();
        return infoBoxHtml(localized('Informasi Timeline Subsolar', 'Subsolar Timeline Information'), [
            { label: localized('Nama ikon', 'Icon name'), value: localized('Titik Timeline', 'Timeline point') },
            { label: localized('Fungsi', 'Purpose'), value: localized('Menghubungkan waktu aktif dengan posisi subsolar hasil kalkulasi.', 'Links the active time to the calculated subsolar position.') },
            { label: localized('Koordinat', 'Coordinate'), value: Number.isFinite(Number(subpoint.lat)) && Number.isFinite(Number(subpoint.lon)) ? formatCoordinatePair(subpoint.lat, subpoint.lon, 4) : '-' },
            { label: localized('Waktu render', 'Render time'), value: formatUtc(renderedAt) },
            { label: localized('Sumber waktu', 'Time source'), value: localizedNetworkSource(state.networkSource) },
            { label: localized('Status', 'Status'), value: state.live ? localized('Mengikuti waktu aktual', 'Following actual time') : localized('Mengikuti timeline manual', 'Following manual timeline') }
        ]);
    }

    function buildBuildingInfoHtml() {
        const context = state.adminContext || {};
        const mosque = context.mosque || {};
        const location = context.location || {};
        const point = contextPoint(context) || activeBuildingPoint();
        const coordinateLabels = admLabelsForCoordinate(point.lat, point.lon);
        const labels = {
            ...currentAdmLabels(context),
            ...coordinateLabels,
            adm0: coordinateLabels.adm0 || currentAdmLabels(context).adm0,
            adm1: coordinateLabels.adm1 || currentAdmLabels(context).adm1,
            adm2: coordinateLabels.adm2 || currentAdmLabels(context).adm2
        };
        const calibration = timeCoordinateCalibrationState();
        const calibratedBuilding = calibration && calibration.building ? calibration.building : {};
        const accuracy = optionalNumberValue(calibratedBuilding.accuracy);
        const elevation = optionalNumberValue(calibratedBuilding.elevation);
        const accuracyNote = optionalTextValue(calibratedBuilding.accuracyNote);
        const rawCoordinateStatus = optionalTextValue(calibratedBuilding.coordinateStatus);
        const coordinateStatus = /^(?:unverified|belum diverifikasi)$/i.test(rawCoordinateStatus)
            ? ''
            : rawCoordinateStatus;
        return infoBoxHtml(localized('Informasi Bangunan', 'Building Information'), [
            { label: localized('Jenis/type gedung', 'Building type'), value: displayBuildingType(mosque.typeLabel || mosque.type || 'Building') },
            { label: localized('Nama gedung', 'Building name'), value: textValue(mosque.name || 'Building') },
            { label: localized('Koordinat bangunan', 'Building coordinates'), value: formatCoordinatePair(point.lat, point.lon, 6) },
            { label: localized('Negara', 'Country'), value: displayAdmLabel(labels.adm0 || location.country, 'adm0') },
            { label: localized('ADM0 berdasarkan koordinat', 'ADM0 from coordinates'), value: displayAdmLabel(labels.adm0 || '-', 'adm0') },
            { label: localized('Provinsi', 'Province'), value: displayAdmLabel(labels.adm1 || location.province, 'adm1') },
            { label: localized('Kota / Kabupaten', 'City / Regency'), value: displayAdmLabel(labels.adm2 || location.city, 'adm2') },
            { label: localized('Alamat', 'Address'), value: mosque.officialAddress || location.address },
            { label: localized('Zona waktu', 'Timezone'), value: location.timezone },
            { label: localized('Sumber koordinat', 'Coordinate source'), value: displaySourceLabel(location.coordinateSource || context.source) },
            { label: localized('Status koordinat', 'Coordinate status'), value: coordinateStatus },
            { label: localized('Akurasi', 'Accuracy'), value: accuracy !== null ? `${formatNumber(accuracy, 2)} m` : accuracyNote },
            { label: localized('Konfirmasi pengguna', 'User confirmation'), value: calibratedBuilding.confirmedByUser === true ? localized('Ya', 'Yes') : '' },
            { label: localized('Elevasi', 'Elevation'), value: elevation !== null ? `${formatNumber(elevation, 2)} m` : '' }
        ], {
            src: buildingIconFromContext(context),
            alt: 'Building icon',
            caption: localized('Icon bangunan mengikuti konfigurasi database admin.', 'The building icon follows the admin database configuration.')
        });
    }

    function buildProviderInfoHtml() {
        const provider = state.providerContext || {};
        const point = providerPoint();
        const calibration = timeCoordinateCalibrationState();
        const calibratedProvider = calibration && calibration.provider ? calibration.provider : {};
        const timeSource = calibratedProvider.timeSource || {};
        const accuracyRadius = optionalNumberValue(calibratedProvider.accuracyRadius);
        const roundTripTime = optionalNumberValue(timeSource.roundTripTime);
        const stratum = optionalNumberValue(timeSource.stratum);
        const rttAndStratum = [
            roundTripTime !== null ? `${formatNumber(roundTripTime, 3)} ms` : '',
            stratum !== null ? formatNumber(stratum, 0) : ''
        ].filter(Boolean).join(' / ');
        return infoBoxHtml(localized('Informasi Service Provider', 'Service Provider Information'), [
            { label: localized('Lokasi IP', 'IP location'), value: [provider.city, provider.region, provider.country].filter(Boolean).join(' - ') },
            { label: 'ADM0', value: provider.country },
            { label: 'ADM1', value: provider.region },
            { label: 'ADM2', value: provider.city },
            { label: 'Service provider', value: provider.org || provider.source },
            { label: 'IP address', value: provider.ip },
            { label: localized('Zona waktu', 'Timezone'), value: provider.timezone },
            { label: localized('Koordinat', 'Coordinate'), value: point ? formatCoordinatePair(point.lat, point.lon, 6) : '' },
            { label: localized('Tipe koordinat', 'Coordinate type'), value: calibratedProvider.coordinateType || 'IP geolocation estimate' },
            { label: localized('Status / confidence', 'Status / confidence'), value: `${calibratedProvider.coordinateStatus || 'estimated'} / ${calibratedProvider.confidence || 'unverified'}` },
            { label: localized('Akurasi radius', 'Accuracy radius'), value: accuracyRadius !== null ? `${formatNumber(accuracyRadius, 0)} m` : '' },
            { label: localized('Sumber waktu', 'Time source'), value: optionalTextValue(timeSource.providerName) },
            { label: localized('Sinkronisasi waktu', 'Time synchronization'), value: optionalTextValue(timeSource.synchronizationStatus) },
            { label: localized('RTT / stratum', 'RTT / stratum'), value: rttAndStratum },
            { label: localized('Pemisahan ilmiah', 'Scientific separation'), value: localized('Koordinat adalah estimasi layanan berbasis IP; bukan bukti lokasi BTS, NTP server, atau master-clock.', 'The coordinate is an IP-based service estimate; it is not evidence of a BTS, NTP server, or master-clock location.') }
        ], {
            src: IP_PROVIDER_ICON,
            alt: 'IP provider icon',
            caption: localized('Marker IP hanya pembanding display; perhitungan utama memakai koordinat gedung.', 'The IP marker is only a display comparison; primary calculations use the building coordinates.')
        });
    }

    function buildCalibrationLineInfoHtml() {
        const calibration = timeCoordinateCalibrationState();
        const spatial = calibration && calibration.spatialDifference ? calibration.spatialDifference : {};
        const astronomical = calibration && calibration.astronomicalDifference ? calibration.astronomicalDifference : {};
        if (!calibration || !calibration.provider || !calibration.building || !calibration.spatialDifference) {
            return infoBoxHtml(localized('Provider → Gedung', 'Provider → Building'), [
                { label: localized('Status', 'Status'), value: localized('Koordinat belum lengkap.', 'Coordinates are incomplete.') }
            ]);
        }
        return infoBoxHtml(localized('Provider → Gedung', 'Provider → Building'), [
            { label: localized('Jarak geodesik', 'Geodesic distance'), value: `${formatNumber(spatial.distanceMeters, 3)} m / ${formatNumber(spatial.distanceKilometers, 6)} km` },
            { label: localized('Initial bearing', 'Initial bearing'), value: `${formatNumber(spatial.bearingDegrees, 3)}°` },
            { label: localized('Arah relatif', 'Relative direction'), value: localized(spatial.relativeDirectionId, spatial.relativeDirectionEn) },
            { label: 'Î” Latitude', value: `${spatial.deltaLatitude >= 0 ? '+' : ''}${formatNumber(spatial.deltaLatitude, 6)}°` },
            { label: 'Î” Longitude', value: `${spatial.deltaLongitude >= 0 ? '+' : ''}${formatNumber(spatial.deltaLongitude, 6)}°` },
            { label: localized('Timur/Barat', 'East/West'), value: `${spatial.eastWestMeters >= 0 ? '+' : ''}${formatNumber(spatial.eastWestMeters, 3)} m` },
            { label: localized('Utara/Selatan', 'North/South'), value: `${spatial.northSouthMeters >= 0 ? '+' : ''}${formatNumber(spatial.northSouthMeters, 3)} m` },
            { label: localized('Selisih waktu dari bujur', 'Longitude-derived time difference'), value: window.MpmTimeCoordinateCalibration.formatSignedDuration(astronomical.longitudeDifferenceMilliseconds) },
            { label: localized('Metode', 'Method'), value: 'Haversine, R = 6,371,008.8 m; Î”t = Î”Î» × 240000 ms' }
        ]);
    }

    function buildKaabahInfoHtml() {
        const kaabah = kaabahPoint();
        const spatial = calculateKaabahSpatialComparison();
        const comparison = currentTimeComparison();
        const kaabahTime = comparison && comparison.kaabahComparison ? comparison.kaabahComparison : null;
        const rows = [
            { label: localized('Jenis/type gedung', 'Building type'), value: 'Kaabah' },
            { label: localized('Nama gedung', 'Building name'), value: 'Kaabah / Masjid al-Haram' },
            { label: localized('Koordinat bangunan', 'Building coordinates'), value: formatCoordinatePair(kaabah.lat, kaabah.lon, 6) },
            { label: localized('Negara', 'Country'), value: 'Saudi Arabia' },
            { label: localized('Provinsi', 'Province'), value: 'Makkah Region' },
            { label: localized('Kota / Kabupaten', 'City / Regency'), value: 'Makkah' },
            { label: localized('Zona waktu', 'Timezone'), value: kaabah.timezone },
            { label: localized('Jarak gedung', 'Building distance'), value: `${formatNumber(spatial.distanceKm, 2)} km` },
            { label: localized('Arah dari gedung', 'Bearing from building'), value: `${formatDegrees(spatial.bearingFromBuilding, 2)} ${getCompassDirection(spatial.bearingFromBuilding)}` }
        ];
        if (kaabahTime) {
            rows.push(
                { label: localized('Delta solar', 'Solar delta'), value: formatSignedSeconds(kaabahTime.apparentSolarDiffSeconds) },
                { label: localized('Delta Dhuhr', 'Dhuhr delta'), value: formatSignedSeconds(kaabahTime.dhuhrDiffSeconds) },
                { label: localized('Delta Maghrib', 'Maghrib delta'), value: formatSignedSeconds(kaabahTime.maghribDiffSeconds) }
            );
        }
        return infoBoxHtml(localized('Informasi Kaabah', 'Kaabah Information'), rows, {
            src: placesIconPath(PLACE_ICONS.kaabah),
            alt: 'Kaabah icon',
            caption: localized('Garis emas menunjukkan hubungan gedung implementasi dengan Kaabah.', 'The gold line shows the implementation building relationship to the Kaabah.')
        });
    }

    function buildKaabahLineInfoHtml() {
        const context = state.adminContext || {};
        const mosque = context.mosque || context.building || {};
        const spatial = calculateKaabahSpatialComparison();
        return infoBoxHtml(localized("Informasi Garis Gedung ke Ka'bah", 'Building to Kaabah Line Information'), [
            { label: localized('Nama feature', 'Feature name'), value: localized('Garis Kiblat Emas', 'Golden Qibla Line') },
            { label: localized('Dari', 'From'), value: mosque.name || localized('Gedung aktif', 'Active building') },
            { label: localized('Menuju', 'To'), value: "Ka'bah / Masjid al-Haram" },
            { label: localized('Jarak geodesik', 'Geodesic distance'), value: `${formatNumber(spatial.distanceKm, 2)} km` },
            { label: localized('Bearing awal', 'Initial bearing'), value: `${formatDegrees(spatial.bearingFromBuilding, 2)} ${getCompassDirection(spatial.bearingFromBuilding)}` },
            { label: localized('Fungsi', 'Purpose'), value: localized("Menjelaskan hubungan spasial gedung dengan koordinat kanonik Ka'bah.", 'Explains the spatial relationship between the building and the canonical Kaabah coordinate.') },
            { label: localized('Sumber', 'Source'), value: localized('Kalkulasi geodesik WebGIS', 'WebGIS geodesic calculation') }
        ]);
    }

    function updateConnectivityBadge() {
        const element = byId('modeBadge');
        if (!element) {
            return;
        }

        const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
        const isFileMode = window.location.protocol === 'file:';
        const label = isFileMode
            ? localized('Offline/File', 'Offline/File')
            : (online ? localized('Online', 'Online') : localized('Offline', 'Offline'));
        element.textContent = `${localized('Mode', 'Mode')}: ${label}`;
        updateOnlineMapControls();
    }

    const ONLINE_MAPS = {
        firemap: {
            url: () => 'https://firemap.live/',
            icon: 'wildfire_detected_medium.png',
            data: [['all-fire-data', 'Hotspot + heat detection']]
        },
        'usgs-earthquake': {
            url: () => 'https://earthquake.usgs.gov/earthquakes/map',
            icon: 'quake-land.png',
            data: [
                ['all_day', 'All earthquakes · 24 hours'],
                ['significant_day', 'Significant · 24 hours'],
                ['4.5_day', 'Magnitude 4.5+ · 24 hours'],
                ['2.5_day', 'Magnitude 2.5+ · 24 hours'],
                ['1.0_day', 'Magnitude 1.0+ · 24 hours'],
                ['all_week', 'All earthquakes · 7 days']
            ],
            feed: (data) => `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${data}.geojson`
        },
        'bmkg-earthquake-m5': {
            url: () => 'https://data.bmkg.go.id/gempabumi/', icon: 'quake-land.png', data: [['m5', 'BMKG M 5.0+']]
        },
        'bmkg-earthquake-felt': {
            url: () => 'https://data.bmkg.go.id/gempabumi/', icon: 'quake-land.png', data: [['felt', 'BMKG dirasakan']]
        },
        volcanoes: {
            url: () => 'https://www.usgs.gov/programs/VHP/volcanic-alert-levels-characterize-conditions-us-volcanoes',
            icon: 'quake-volc.png',
            data: [['all', 'Volcano locations and official status']]
        },
        'air-quality': {
            url: () => 'https://open-meteo.com/en/docs/air-quality-api',
            icon: 'haze.png',
            data: [
                ['aqi', 'US AQI'],
                ['pm25', 'PM2.5'],
                ['pm10', 'PM10'],
                ['o3', 'Ozone'],
                ['no2', 'NO2'],
                ['so2', 'SO2'],
                ['co', 'CO']
            ]
        }
    };

    function onlineMapAvailable() {
        return window.location.protocol !== 'file:' && navigator.onLine !== false;
    }

    function updateOnlineMapControls() {
        const controls = byId('onlineMapControls');
        if (!controls) {
            return;
        }
        const volcanoSelected = ['volcanoes', 'air-quality'].includes((byId('onlineMapSelect') || {}).value);
        controls.classList.toggle('hidden', !onlineMapAvailable() && !volcanoSelected && !volcanoController);
        const select = byId('onlineMapSelect');
        if (select) Array.from(select.options).forEach((option) => {
            option.disabled = !onlineMapAvailable() && !['volcanoes', 'air-quality'].includes(option.value);
        });
        if (!onlineMapAvailable() && !volcanoSelected) {
            if (window.MpmEarthquakeRadius) window.MpmEarthquakeRadius.clearForKind('online-earthquake');
            const toggle = byId('onlineMapToggle');
            if (toggle) {
                toggle.checked = false;
            }
        }
    }

    function isEarthquakeMap(key) { return ['usgs-earthquake', 'bmkg-earthquake-m5', 'bmkg-earthquake-felt'].includes(key); }
    function configureOnlineTime(mapKey) {
        const select = byId('environmentRangeSelect'), controls = byId('onlineMapControls');
        if (!select || !controls) return;
        const supportsRange = isEarthquakeMap(mapKey) || mapKey === 'firemap';
        select.disabled = !supportsRange; select.closest('label').hidden = !supportsRange;
        let current = select.querySelector('[value="current"]');
        if (!current) { current = document.createElement('option'); current.value = 'current'; current.textContent = 'Terkini sumber (tanpa filter waktu)'; select.appendChild(current); }
        current.hidden = mapKey !== 'firemap'; current.disabled = mapKey !== 'firemap';
        if (mapKey !== 'firemap' && select.value === 'current') select.value = '1';
        ['onlineMapTemporalNote', 'onlineMapDataStatus'].forEach((id) => { if (!byId(id)) { const p = document.createElement('p'); p.id = id; p.style.cssText = 'font-size:11px;line-height:1.4;margin:3px 0;width:100%'; p.setAttribute('role', 'status'); controls.appendChild(p); } });
        byId('onlineMapTemporalNote').textContent = mapKey.startsWith('bmkg-') ? 'BMKG: Indonesia, 15 kejadian terakhir pada feed; bukan arsip lengkap periode terpilih.'
            : mapKey === 'noaa-hazards' ? 'NOAA/NWS: peringatan aktif Amerika Serikat; sumber ini bukan arsip 1–30 hari.'
            : mapKey === 'volcanoes' ? localized('Status terakhir dari sumber; arsip status per periode tidak tersedia.', 'Latest status from the source; historical status by period is unavailable.')
            : mapKey === 'air-quality' ? 'Estimasi kualitas udara saat ini; bukan riwayat 1–30 hari.'
            : mapKey === 'firemap' ? 'Rentang waktu menyaring umur pembaruan deteksi. Hotspot aktif tanpa waktu hanya tampil pada Terkini sumber.'
            : 'Waktu kejadian disaring sesuai 1/5/10/30 hari terakhir.';
        if (controls.dataset.timeMap !== mapKey) { byId('onlineMapDataStatus').textContent = ''; controls.dataset.timeMap = mapKey; }
    }

    function updateOnlineMapFrame() {
        const select = byId('onlineMapSelect');
        const link = byId('onlineMapOpenLink');
        const icon = byId('onlineMapIcon');
        const onlineToggle = byId('onlineMapToggle');
        if (select && !ONLINE_MAPS[select.value]) select.value = 'firemap';
        const config = ONLINE_MAPS[select ? select.value : 'firemap'];
        if (!config) {
            return;
        }

        const mapKey = select ? select.value : 'firemap';
        configureOnlineTime(mapKey);
        if (volcanoController && (mapKey !== 'volcanoes' || !onlineToggle || !onlineToggle.checked)) volcanoController.setEnabled(false);
        if (airQualityController && (mapKey !== 'air-quality' || !onlineToggle || !onlineToggle.checked)) airQualityController.setEnabled(false);
        const dataKey = config.data[0][0];
        const url = config.url(dataKey);
        if (link) link.href = url;
        if (icon) icon.style.backgroundImage = `url("map/weather/${config.icon}")`;
        if (onlineToggle && onlineToggle.checked && (onlineMapAvailable() || ['volcanoes', 'air-quality'].includes(mapKey))) {
            updateOnlineOverlay(select ? select.value : 'firemap', dataKey);
        } else if (state.layers && state.layers.onlineOverlay) {
            state.layers.onlineOverlay.getLayers().clear();
            state.layers.onlineOverlay.setVisible(false);
        }
    }

    const adm0Scope = window.MpmAdm0MapScope.create({ ol: window.ol, state });
    const onlineLocal = () => (byId('environmentDisplaySelect') || {}).value !== 'global';
    const earthquakeScope = window.MpmEarthquakeMapScope.create({ ol: window.ol, adm0: adm0Scope });
    adm0Scope.subscribe(() => {
        const scope = adm0Scope.getState();
        const select = byId('environmentDisplaySelect');
        if (select) select.querySelector('[value="local"]').textContent = 'Lokal ADM0 · ' + (scope.name || 'negara belum dipilih') + (scope.ready ? '' : ' · batas belum tersedia');
        if (state.map && (byId('onlineMapToggle') || {}).checked && onlineLocal()) updateOnlineMapFrame();
    });
    earthquakeScope.subscribe(() => {
        if (state.map && onlineLocal() && (byId('onlineMapToggle') || {}).checked && isEarthquakeMap((byId('onlineMapSelect') || {}).value)) updateOnlineMapFrame();
    });
    const volcanoController = window.MpmVolcanoMap
        ? window.MpmVolcanoMap.create({ ol: window.ol, state, byId, scope: adm0Scope, isLocal: onlineLocal,
            hidePopup: hideMapInfoPopup, presentFeature: presentMapFeatureInfo })
        : null;

    const airQualityController = window.MpmAirQualityMap.create({ ol: window.ol, state, byId, scope: adm0Scope, isLocal: onlineLocal,
        hidePopup: hideMapInfoPopup, presentFeature: presentMapFeatureInfo });

    const weatherOverlayController = window.MpmWeatherOverlays
        ? window.MpmWeatherOverlays.init({
            ol: window.ol,
            state,
            byId,
            scope: adm0Scope,
            observer: () => state.observer
        })
        : null;
    function updateOnlineMapDataOptions(mapKey) {
        return ONLINE_MAPS[mapKey] || null;
    }

    function classifyFireSize(properties) {
        const frp = Number(properties.frp || properties.FRP || properties.fire_radiative_power);
        if (!Number.isFinite(frp)) {
            return { key: 'medium', label: 'Menengah', frp: null };
        }
        if (frp < 10) {
            return { key: 'small', label: 'Kecil', frp };
        }
        if (frp < 50) {
            return { key: 'medium', label: 'Menengah', frp };
        }
        if (frp < 100) {
            return { key: 'large', label: 'Besar', frp };
        }
        return { key: 'very-large', label: 'Sangat besar', frp };
    }

    function fireIconPath(sizeKey) {
        const file = sizeKey === 'small'
            ? 'wildfire_detected_small.png'
            : (sizeKey === 'large'
                ? 'wildfire_detected_large.png'
                : (sizeKey === 'very-large' ? 'wildfire_detected_big.png' : 'wildfire_detected_medium.png'));
        return `map/weather/${file}`;
    }

    const FIRE_ICON_SCALES = Object.freeze({
        small: 0.014,
        medium: 0.018,
        large: 0.022,
        'very-large': 0.026
    });

    function fireIconScale(sizeKey) {
        return FIRE_ICON_SCALES[sizeKey] || FIRE_ICON_SCALES.medium;
    }

    function classifyHeatIntensity(properties, sizeKey) {
        const frp = Number(properties.frp || properties.FRP || properties.fire_radiative_power);
        const brightness = Number(properties.brightness || properties.bright_ti4 || properties.bright_ti5);
        const heatSignals = Number(properties.heatsigfcidetections_last_hour || properties.heat_detections);
        if (sizeKey === 'very-large' || (Number.isFinite(frp) && frp >= 100)) {
            return { key: 'very-large', color: '#7f1d5a', radius: 56000, label: 'Sangat besar' };
        }
        if (sizeKey === 'large' || (Number.isFinite(frp) && frp >= 50) || (Number.isFinite(brightness) && brightness >= 340) || (Number.isFinite(heatSignals) && heatSignals >= 24)) {
            return { key: 'large', color: '#991b1b', radius: 42000, label: 'Besar' };
        }
        if (sizeKey === 'medium' || (Number.isFinite(frp) && frp >= 15) || (Number.isFinite(brightness) && brightness >= 315) || (Number.isFinite(heatSignals) && heatSignals >= 12)) {
            return { key: 'medium', color: '#f4511e', radius: 28000, label: 'Sedang' };
        }
        return { key: 'small', color: '#f97316', radius: 16000, label: 'Kecil' };
    }

    function firePolyCircleStyle(feature, resolution) {
        const geometry = feature.getGeometry();
        const intensity = feature.get('fireIntensity') || classifyHeatIntensity(feature.getProperties(), feature.get('fireSizeKey'));
        if (!geometry || geometry.getType() !== 'Point') {
            return new ol.style.Style({
                fill: new ol.style.Fill({ color: `${intensity.color}66` }),
                stroke: new ol.style.Stroke({ color: intensity.color, width: 2 })
            });
        }
        const circle = new ol.geom.Circle(geometry.getCoordinates(), intensity.radius);
        const styles = [new ol.style.Style({
            geometry: ol.geom.Polygon.fromCircle(circle, 48),
            fill: new ol.style.Fill({ color: `${intensity.color}66` }),
            stroke: new ol.style.Stroke({ color: intensity.color, width: 2 })
        })];
        if (feature.get('fireMapDataType') === 'Active wildfire hotspot') {
            const circlePixelRadius = Number.isFinite(resolution) && resolution > 0
                ? intensity.radius / resolution
                : 32;
            // Keep the hotspot icon below the polycircle diameter, especially when zoomed out.
            const iconScale = Math.min(0.02, Math.max(0.002, circlePixelRadius / 320));
            styles.push(new ol.style.Style({
                image: new ol.style.Icon({
                    src: 'map/weather/wildfire_detected_medium.png',
                    scale: iconScale,
                    anchor: [0.5, 0.5]
                })
            }));
        }
        return styles;
    }

    function fireMapSizeKey(properties, dataType) {
        const area = Number(properties.area_ha || properties.areaHa || properties.size_ha);
        const heatSignals = Number(properties.heatsigfcidetections_last_hour || properties.heat_detections);
        if (dataType === 'Active wildfire hotspot') {
            return Number.isFinite(area) && area >= 500 ? 'very-large' : 'large';
        }

        if (Number.isFinite(heatSignals) && heatSignals >= 24) {
            return 'large';
        }
        if (Number.isFinite(heatSignals) && heatSignals >= 12) {
            return 'medium';
        }
        return 'small';
    }

    function fireSizeLabel(sizeKey) {
        return {
            small: 'Kecil',
            medium: 'Menengah',
            large: 'Besar',
            'very-large': 'Sangat besar'
        }[sizeKey] || 'Kecil';
    }

    function classifyOnlineEarthquake(feature) {
        const properties = feature.getProperties ? feature.getProperties() : {};
        const raw = Object.keys(properties)
            .filter((key) => key !== 'geometry')
            .map((key) => properties[key])
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        const volcanic = /\b(volcan|vulkan|volcano|volcanic|erupsi|eruption|magmatic)\b/.test(raw);
        const coordinate = feature.getGeometry().getCoordinates();
        const waterSources = ['naturalEarth:ocean', 'naturalEarth:marinePolys', 'naturalEarth:lakes']
            .map((key) => window.AdvancedAstroGIS && window.AdvancedAstroGIS.getSource ? window.AdvancedAstroGIS.getSource(key) : null)
            .filter(Boolean);
        const water = /\b(sea|ocean|offshore|water|laut|samudra|perairan|selat|teluk)\b/.test(raw)
            || waterSources.some((source) => source.getFeatures().some((item) => {
            const geometry = item.getGeometry();
            return geometry && geometry.intersectsCoordinate && geometry.intersectsCoordinate(coordinate);
        }));
        const environment = water ? 'water' : 'land';
        const type = volcanic ? 'vulcanic' : 'tectonic';
        return {
            type,
            typeLabel: volcanic ? 'Vulkanik' : 'Tektonik',
            environment,
            environmentLabel: water ? 'Perairan / laut' : 'Darat',
            iconPath: ('map/weather/'+MpmBuildFile(`emergency_earthquake_${environment}_${type}.png`)),
            source: volcanic ? 'atribut USGS / kata kunci vulkanik' : 'default tektonik; atribut vulkanik tidak tersedia'
        };
    }

    function onlineEarthquakeStyle(feature) {
        const rawMagnitude = feature.get('mag');
        const magnitude = rawMagnitude === null || rawMagnitude === undefined || String(rawMagnitude).trim() === '' ? NaN : Number(rawMagnitude);
        const classification = feature.get('earthquakeClassification') || {};
        const magnitudeColor = window.MpmEarthquakeRadius.magnitudeClass(rawMagnitude).color;
        return new ol.style.Style({
            image: new ol.style.Icon({
                src: classification.iconPath || 'map/weather/quake-land.png',
                scale: 0.045,
                anchor: [0.5, 0.9]
            }),
            text: new ol.style.Text({
                text: Number.isFinite(magnitude) ? magnitude.toFixed(1) : '',
                offsetY: -42,
                font: 'bold 10px Segoe UI, sans-serif',
                fill: new ol.style.Fill({ color: magnitudeColor }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
            })
        });
    }

    let quakeFlight = null;
    function refreshOnlineEarthquakes(mapKey) {
        const overlay = state.layers.onlineOverlay;
        const range = MpmOnlineMapTime.windowOf((byId('environmentRangeSelect') || {}).value);
        const key = [mapKey, range.days, onlineLocal() ? adm0Scope.getState().key : 'global'].join('|');
        const bmkg = mapKey.startsWith('bmkg-'), providerName = bmkg ? 'BMKG' : 'USGS';
        if (onlineLocal()) earthquakeScope.ensure();
        const url = bmkg ? 'api/bmkg-earthquakes.php?feed=' + (mapKey.endsWith('-felt') ? 'felt' : 'm5')
            : ONLINE_MAPS['usgs-earthquake'].feed(range.days === 1 ? 'all_day' : range.days <= 7 ? 'all_week' : 'all_month');
        let layer = overlay.getLayers().getArray().find((item) => item.get('quakeFeedKey') === key);
        if (!layer) {
            layer = new ol.layer.Vector({ source: new ol.source.Vector(), style: onlineEarthquakeStyle, zIndex: 125 });
            layer.set('quakeFeedKey', key); layer.set('adm0CenterFiltered', true);
            overlay.getLayers().clear(); overlay.getLayers().push(layer);
        }
        if (quakeFlight && quakeFlight.layer === layer) return;
        if (quakeFlight) quakeFlight.controller.abort();
        const controller = new AbortController(), flight = { layer, controller };
        quakeFlight = flight;
        const timer = setTimeout(() => controller.abort(), 20000);
        fetch(url, { signal: controller.signal, cache: 'no-cache' })
            .then((response) => { if (!response.ok) throw new Error(providerName + ' HTTP ' + response.status); return response.json(); })
            .then((payload) => {
                if (quakeFlight !== flight || !overlay.getLayers().getArray().includes(layer) || !(byId('onlineMapToggle') || {}).checked || byId('onlineMapSelect').value !== mapKey) return;
                if (payload.type !== 'FeatureCollection' || !Array.isArray(payload.features)) throw new Error('Format data gempa tidak valid.');
                const features = new ol.format.GeoJSON().readFeatures(payload, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
                features.forEach((feature) => {
                    const classification = classifyOnlineEarthquake(feature);
                    feature.setProperties({ kind: 'online-earthquake', popupKey: feature.getId() || feature.get('code'), label: feature.get('place') || providerName + ' Earthquake', earthquakeClassification: classification,
                        earthquakeTypeLabel: classification.typeLabel, epicenterEnvironmentLabel: classification.environmentLabel });
                });
                const dated = features.filter((f) => MpmOnlineMapTime.contains(f.get('time'), range));
                const visible = onlineLocal() ? dated.filter(earthquakeScope.accepts) : dated;
                MpmLiveMapData.sync(layer.getSource(), visible);
                const marine = earthquakeScope.getState();
                const scopeNote = onlineLocal() ? (marine.marineReady ? 'Lokal ADM0 + ZEE rujukan Marine Regions/VLIZ' : 'Lokal ADM0; laut ' + (marine.status === 'loading' ? 'sedang dimuat' : 'belum tersedia: ' + (marine.metadata.warning || marine.status))) : 'Global';
                byId('onlineMapDataStatus').textContent = providerName + ' · ' + visible.length + ' kejadian · ' + range.days + ' hari · ' + scopeNote
                    + (payload.meta && payload.meta.stale ? ' · Data tersimpan, pembaruan sumber gagal.' : '');
            })
            .catch((error) => { if (quakeFlight === flight && overlay.getLayers().getArray().includes(layer)) setStatus('Pembaruan gempa gagal; data terakhir tetap ditampilkan. ' + error.message); })
            .finally(() => { clearTimeout(timer); if (quakeFlight === flight) quakeFlight = null; });
    }

    function updateOnlineOverlay(mapKey, dataKey) {
        const overlay = state.layers && state.layers.onlineOverlay;
        if (!overlay || (!onlineMapAvailable() && !['volcanoes', 'air-quality'].includes(mapKey))) {
            return;
        }
        adm0Scope.bind(overlay, onlineLocal);
        overlay.setVisible(true);
        if (isEarthquakeMap(mapKey) && (!onlineLocal() || adm0Scope.getState().ready)) { refreshOnlineEarthquakes(mapKey); return; }
        overlay.getLayers().clear();
        if (onlineLocal() && !adm0Scope.getState().ready) {
            if (volcanoController) volcanoController.setEnabled(false);
            if (airQualityController) airQualityController.setEnabled(false);
            setStatus('Cakupan lokal menunggu batas ADM0 negara terpilih dari database.');
            return;
        }
        if (mapKey === 'volcanoes') {
            if (volcanoController) volcanoController.setEnabled(true, overlay);
        } else if (mapKey === 'air-quality') {
            airQualityController.setEnabled(true, overlay);
        } else if (mapKey === 'firemap') {
            const source = new ol.source.Vector();
            const layer = new ol.layer.Vector({ source, style: firePolyCircleStyle, zIndex: 60 });
            overlay.getLayers().push(layer);
            const local = onlineLocal(), countryKey = adm0Scope.getState().key;
            const selection = (byId('environmentRangeSelect') || {}).value;
            const current = selection === 'current', range = MpmOnlineMapTime.windowOf(selection);
            const localBounds = local ? adm0Scope.bounds() : null;
            const request = (name) => {
                const params = new URLSearchParams({ service: 'WFS', version: '1.0.0', request: 'GetFeature',
                    typeName: 'FireDB:' + name, outputFormat: 'application/json', maxFeatures: '50000' });
                if (localBounds) params.set('bbox', localBounds.join(',') + ',EPSG:4326');
                return fetch('https://geo.firemap.live/geoserver/ows?' + params).then((response) => {
                    if (!response.ok) throw new Error('FireMap HTTP ' + response.status);
                    return response.json();
                });
            };
            const empty = { type: 'FeatureCollection', features: [] };
            Promise.all([current ? request('combined_fire_pt_active') : Promise.resolve(empty), request('firms_hotspot_pt_slim')])
                .then((payloads) => {
                    if (!overlay.getLayers().getArray().includes(layer) || local !== onlineLocal() || (local && countryKey !== adm0Scope.getState().key)) return;
                    let omitted = 0;
                    const features = payloads.flatMap((payload, index) => {
                        const dataType = index === 0 ? 'Active wildfire hotspot' : 'Heat detection';
                        const stamped = Date.parse(payload.timeStamp);
                        const reference = Number.isFinite(stamped) ? stamped : range.until;
                        return new ol.format.GeoJSON().readFeatures(payload, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' })
                            .filter((feature) => {
                                if (current) return true;
                                const time = MpmOnlineMapTime.heatTime(feature.getProperties(), reference);
                                if (time === null) omitted++;
                                return MpmOnlineMapTime.contains(time, range);
                            }).map((feature) => {
                                const sizeKey = fireMapSizeKey(feature.getProperties(), dataType);
                                const intensity = classifyHeatIntensity(feature.getProperties(), sizeKey);
                                feature.setProperties({ kind: 'online-firms', label: 'FireMap.live ' + dataType.toLowerCase(), source: 'FireMap.live',
                                    fireMapDataType: dataType, fireSizeKey: sizeKey, fireSize: fireSizeLabel(sizeKey), fireIntensity: intensity, fireIntensityLabel: intensity.label });
                                return feature;
                            });
                    });
                    source.addFeatures(local ? features.filter(adm0Scope.accepts) : features);
                    const limited = payloads.some((p) => (p.features || []).length >= 50000 || Number(p.totalFeatures) > (p.features || []).length);
                    byId('onlineMapDataStatus').textContent = 'FireMap.live · ' + source.getFeatures().length + ' titik · ' + (current ? 'terkini sumber' : range.days + ' hari')
                        + (omitted ? ' · ' + omitted + ' titik tanpa waktu dikecualikan' : '')
                        + (limited ? ' · Hasil dibatasi 50.000 titik per feed; cakupan periode tidak lengkap.' : '');
                }).catch((error) => { if (overlay.getLayers().getArray().includes(layer)) setStatus('FireMap.live gagal dimuat: ' + error.message); });
        } else {
            const config = ONLINE_MAPS[mapKey];
            const tileUrl = config && typeof config.tileUrl === 'function' ? config.tileUrl(dataKey) : null;
            if (tileUrl) {
                overlay.getLayers().push(new ol.layer.Tile({
                    source: new ol.source.XYZ({ url: tileUrl }),
                    opacity: 0.72,
                    zIndex: 18
                }));
            }
        }
        overlay.setVisible(true);
    }

    function clearComputationCaches() {
        state.dailyCache.clear();
        state.prayerCache.clear();
    }

    function storedSelectedTimezoneOffset() {
        const select = byId('timezoneSelect');
        if (!select) {
            return 7;
        }

        const option = select.options[select.selectedIndex];
        return Number(option && option.dataset.offset || 0);
    }

    function getSelectedTimezoneName() {
        const select = byId('timezoneSelect');
        return select ? select.value : 'Asia/Jakarta';
    }

    function getSelectedTimezoneOffset(referenceDate) {
        const timezoneName = getSelectedTimezoneName();
        const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
            ? referenceDate
            : (state.latestSnapshot && state.latestSnapshot.date instanceof Date ? state.latestSnapshot.date : getNetworkNow());
        const dynamicOffset = timezoneOffsetForDate(timezoneName, date);
        if (Number.isFinite(dynamicOffset)) {
            const select = byId('timezoneSelect');
            const option = select ? select.options[select.selectedIndex] : null;
            if (option) {
                option.dataset.offset = String(dynamicOffset);
                if (!option.textContent.includes(formatUtcOffset(dynamicOffset))) {
                    option.textContent = `${timezoneName} ${formatUtcOffset(dynamicOffset)}`;
                }
            }
            return dynamicOffset;
        }

        return storedSelectedTimezoneOffset();
    }

    function parseDateTimeInput(value, offsetHours) {
        const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
        if (!match) {
            return getNetworkNow();
        }

        const utcMs = Date.UTC(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3]),
            Number(match[4]),
            Number(match[5]),
            0
        ) - offsetHours * 3600000;

        return new Date(utcMs);
    }

    function setDateTimeInputFromDate(date, offsetHours) {
        const shifted = new Date(date.getTime() + offsetHours * 3600000);
        byId('timeInput').value = shifted.toISOString().slice(0, 16);
    }

    function getNetworkNow() {
        if (window.MpmActualTime && typeof window.MpmActualTime.now === 'function') {
            // The shared authority already reconciles server, manual and
            // rollback state. Applying the legacy network offset again would
            // double-correct the clock after a device rollback.
            return window.MpmActualTime.now();
        }
        return new Date(Date.now() + state.networkOffsetMs);
    }

    function getRenderDate() {
        if (state.live) {
            return getNetworkNow();
        }

        const offsetHours = storedSelectedTimezoneOffset();
        const base = parseDateTimeInput(byId('timeInput').value, offsetHours);
        const days = Number(byId('timelineSlider').value || 0);
        return new Date(base.getTime() + days * 86400000);
    }

    function localYmd(date, offsetHours) {
        const shifted = new Date(date.getTime() + offsetHours * 3600000);
        return shifted.toISOString().slice(0, 10);
    }

    function localMidnightUtc(date, offsetHours) {
        const shifted = new Date(date.getTime() + offsetHours * 3600000);
        const y = shifted.getUTCFullYear();
        const m = shifted.getUTCMonth();
        const d = shifted.getUTCDate();
        return Date.UTC(y, m, d, 0, 0, 0) - offsetHours * 3600000;
    }

    function dateToLocalMinutes(date, offsetHours) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return NaN;
        }

        const shifted = new Date(date.getTime() + offsetHours * 3600000);
        return shifted.getUTCHours() * 60 + shifted.getUTCMinutes() + shifted.getUTCSeconds() / 60;
    }

    function julianDay(date) {
        return date.getTime() / 86400000 + 2440587.5;
    }

    function equationOfTimeMinutes(date) {
        const jd = julianDay(date);
        const t = (jd - 2451545.0) / 36525.0;
        const epsilon = degToRad(23.439291 - 0.0130042 * t);
        const l0 = degToRad(normalize360(280.46646 + 36000.76983 * t + 0.0003032 * t * t));
        const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
        const m = degToRad(normalize360(357.52911 + 35999.05029 * t - 0.0001537 * t * t));
        const y = Math.tan(epsilon / 2) * Math.tan(epsilon / 2);
        const eot = y * Math.sin(2 * l0)
            - 2 * e * Math.sin(m)
            + 4 * e * y * Math.sin(m) * Math.cos(2 * l0)
            - 0.5 * y * y * Math.sin(4 * l0)
            - 1.25 * e * e * Math.sin(2 * m);

        return radToDeg(eot) * 4;
    }

    function solarDeclination(date) {
        const jd = julianDay(date);
        const t = (jd - 2451545.0) / 36525.0;
        const omega = degToRad(125.04 - 1934.136 * t);
        const epsilon = degToRad(23.439291 - 0.0130042 * t + 0.00256 * Math.cos(omega));
        const l0 = normalize360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
        const m = degToRad(normalize360(357.52911 + 35999.05029 * t - 0.0001537 * t * t));
        const center = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m)
            + (0.019993 - 0.000101 * t) * Math.sin(2 * m)
            + 0.000289 * Math.sin(3 * m);
        const lambda = degToRad(normalize360(l0 + center - 0.00569 - 0.00478 * Math.sin(omega)));
        return radToDeg(Math.asin(Math.sin(epsilon) * Math.sin(lambda)));
    }

    function apparentSolarMinutes(date, longitude) {
        const utcMinutes = date.getUTCHours() * 60
            + date.getUTCMinutes()
            + date.getUTCSeconds() / 60
            + date.getUTCMilliseconds() / 60000;
        return normalizeMinutes(utcMinutes + 4 * longitude + equationOfTimeMinutes(date));
    }

    function meanSolarMinutes(date, longitude) {
        const utcMinutes = date.getUTCHours() * 60
            + date.getUTCMinutes()
            + date.getUTCSeconds() / 60
            + date.getUTCMilliseconds() / 60000;
        return normalizeMinutes(utcMinutes + 4 * longitude);
    }

    function ensureReady() {
        if (!window.ol) {
            throw new Error(localized('OpenLayers gagal dimuat.', 'OpenLayers failed to load.'));
        }

        if (window.AstronomyRuntime) {
            window.AstronomyRuntime.requireEngine();
        } else if (!window.Astronomy) {
            throw new Error(localized('Astronomy Engine gagal dimuat.', 'Astronomy Engine failed to load.'));
        }
    }

    const NATURAL_EARTH_LAYERS = [
        { key: 'coastline', file: 'ne-1-6f5c.geojson', color: '#1e3a8a', width: 2.8 },
        { key: 'marinePolys', file: 'ne-1-6bb0.geojson', color: '#1e3a8a', fill: true },
        { key: 'lakes', file: 'ne-1-3d5c.geojson', color: '#1e3a8a', fill: true },
        { key: 'ocean', file: 'ne-1-4347.geojson', color: '#1e3a8a', fill: true },
        { key: 'rivers', file: 'ne-1-bea5.geojson', color: '#1e3a8a', width: 2.8 }
    ];

    function createNaturalEarthLayers() {
        return NATURAL_EARTH_LAYERS.map((definition, index) => {
            const source = new ol.source.Vector();
            source.on('addfeature', (event) => {
                if (event.feature) {
                    event.feature.set('kind', 'natural-earth');
                    event.feature.set('naturalEarthKey', definition.key);
                    event.feature.set('naturalEarthLabel', definition.file.replace(/^ne_10m_|\.geojson$/g, '').replace(/_/g, ' '));
                }
            });
            const layer = new ol.layer.Vector({
                source,
                style: new ol.style.Style({
                    fill: definition.fill ? new ol.style.Fill({ color: 'rgba(30, 58, 138, 0.2)' }) : undefined,
                    stroke: new ol.style.Stroke({
                        color: definition.color,
                        width: definition.width || 2.8
                    })
                }),
                visible: true,
                zIndex: 2 + index
            });
            layer.set('title', definition.key);
            return { layer, source };
        });
    }

    function naturalEarthUrl(scale, file) {
        return `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_${scale}_${file.replace(/^ne_10m_/, '')}`;
    }

    async function loadNaturalEarthFeatures(scale) {
        if (state.naturalEarthLoading || !state.map) {
            return;
        }
        state.naturalEarthLoading = true;
        if (state.initializationStatus !== 'READY') {
            const readiness = await window.AdvancedAstroGIS.whenReady();
            if (readiness.initialization !== 'READY' || !state.layers.naturalEarth.getVisible()) {
                state.naturalEarthLoading = false;
                return;
            }
        }
        const status = byId('waterFeaturesStatus');
        if (status) {
            status.textContent = localized(`Memuat perairan ${scale}`, `Loading ${scale} water features`);
        }
        try {
            await Promise.all(NATURAL_EARTH_LAYERS.map(async (definition) => {
                const source = state.sources[`naturalEarth:${definition.key}`];
                if (!source) {
                    return;
                }
                let payload;
                try {
                    const response = await fetch(naturalEarthUrl(scale, definition.file));
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    payload = await response.json();
                } catch (onlineError) {
                    if (scale !== '10m') {
                        throw onlineError;
                    }
                    const response = await fetch(`map/geo/${definition.file}`);
                    if (!response.ok) {
                        throw new Error(`Local fallback HTTP ${response.status}`);
                    }
                    payload = await response.json();
                }
                source.clear();
                source.addFeatures(new ol.format.GeoJSON().readFeatures(payload, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                }));
            }));
            state.naturalEarthLoadedScale = scale;
            window.dispatchEvent(new CustomEvent('mpm:natural-earth-ready'));
            if (status) {
                status.textContent = localized(`Perairan aktif · ${scale}`, `Water features active · ${scale}`);
            }
        } catch (error) {
            if (status) {
                status.textContent = localized(`Gagal memuat perairan: ${error.message}`, `Water features failed: ${error.message}`);
            }
            throw error;
        } finally {
            state.naturalEarthLoading = false;
        }
    }

    async function toggleNaturalEarthFeatures(enabled, scale) {
        const group = state.layers.naturalEarth;
        if (!group) {
            return;
        }
        state.naturalEarthScale = scale || state.naturalEarthScale;
        group.setVisible(Boolean(enabled));
        group.getLayers().forEach((layer) => layer.setVisible(Boolean(enabled)));
        if (!enabled) {
            const status = byId('waterFeaturesStatus');
            if (status) {
                status.textContent = localized('Perairan nonaktif', 'Water features off');
            }
            return;
        }
        if (state.naturalEarthLoadedScale !== state.naturalEarthScale) {
            await loadNaturalEarthFeatures(state.naturalEarthScale);
        }
    }

    function createOpenFreeMapStyleLayer(styleName, visible) {
        const layer = new ol.layer.VectorTile({
            declutter: true,
            source: new ol.source.VectorTile({
                format: new ol.format.MVT(),
                // Let the style's TileJSON supply the current tile URL instead
                // of issuing requests before that configuration has loaded.
                maxZoom: 14,
                attributions: 'OpenFreeMap, OpenMapTiles, OpenStreetMap'
            }),
            visible: Boolean(visible)
        });
        layer.set('title', styleName === 'bright' ? 'Basic' : styleName.charAt(0).toUpperCase() + styleName.slice(1));
        // Inactive basemaps must not fetch style JSON, TileJSON and fonts at startup.
        let styleFlight = null, styleReady = false;
        const ensureStyle = () => {
            if (!layer.getVisible() || styleReady || styleFlight || !window.olms) return;
            styleFlight = window.MpmOpenFreeMapStyle.apply(layer, styleName)
                .then(() => { styleReady = true; })
                .catch((error) => console.warn(`[OpenFreeMap] ${styleName} style failed.`, error))
                .finally(() => { styleFlight = null; });
        };
        layer.on('change:visible', ensureStyle);
        // Allow saved basemap selection to settle before fetching a default style.
        window.setTimeout(ensureStyle, 0);
        return layer;
    }

    function createMap() {
        const basicLayer = createOpenFreeMapStyleLayer('bright', true);

        const fiordLayer = createOpenFreeMapStyleLayer('fiord', false);
        const positronLayer = createOpenFreeMapStyleLayer('positron', false);
        const darkLayer = createOpenFreeMapStyleLayer('dark', false);

        const topoRasterLayer = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
                attributions: 'CyclOSM, OpenStreetMap'
            }),
            zIndex: 1
        });
        const topoFeatureLayer = createOpenFreeMapStyleLayer('bright', false);
        topoFeatureLayer.setOpacity(0.01);
        topoFeatureLayer.setZIndex(3);
        const topoLayer = new ol.layer.Group({
            layers: [topoRasterLayer, topoFeatureLayer],
            visible: false,
            zIndex: 1
        });

        topoLayer.on('change:visible', () => topoFeatureLayer.setVisible(topoLayer.getVisible()));

        const googleSatelliteSource = new ol.source.XYZ({
            urls: [
                'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
            ],
            tileSize: 256,
            crossOrigin: 'anonymous'
        });
        const googleLabelsSource = new ol.source.XYZ({
            url: 'https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
            tileSize: 256,
            crossOrigin: 'anonymous'
        });
        const satFeatureLayer = createOpenFreeMapStyleLayer('bright', false);
        satFeatureLayer.setOpacity(0.01);
        satFeatureLayer.setZIndex(3);
        const satLayer = new ol.layer.Group({
            layers: [
                new ol.layer.Tile({ source: googleSatelliteSource, zIndex: 1 }),
                new ol.layer.Tile({ source: googleLabelsSource, zIndex: 2 }),
                satFeatureLayer
            ],
            visible: false,
            zIndex: 1
        });

        satLayer.on('change:visible', () => satFeatureLayer.setVisible(satLayer.getVisible()));

        const graticuleLayer = new ol.layer.Graticule({
            strokeStyle: new ol.style.Stroke({
                color: 'rgba(34, 50, 71, 0.24)',
                width: 1,
                lineDash: [2, 5]
            }),
            showLabels: true,
            wrapX: true
        });

        const atmosphereLayer = new ol.layer.Image({
            opacity: Number(byId('atmosphereOpacity').value) / 100,
            visible: byId('atmosphereToggle').checked,
            zIndex: 10
        });

        const prayerLayer = new ol.layer.Image({
            opacity: 0.62,
            visible: true,
            zIndex: 11
        });

        const hilalLayer = new ol.layer.Image({
            opacity: 0.74,
            visible: true,
            zIndex: 12
        });

        const naturalEarthLayers = createNaturalEarthLayers();
        const admSource = new ol.source.Vector();
        const admLayer = new ol.layer.Vector({
            source: admSource,
            style: admBoundaryStyle,
            visible: true,
            zIndex: 100
        });

        const trajectoryVisible = runtimeLayerEnabled('trajectory', false);
        const sunTrajectorySource = new ol.source.Vector();
        const moonTrajectorySource = new ol.source.Vector();
        const sunTrajectoryLayer = new ol.layer.Vector({
            source: sunTrajectorySource,
            style: trajectoryStyle,
            visible: true,
            zIndex: 22
        });
        const moonTrajectoryLayer = new ol.layer.Vector({
            source: moonTrajectorySource,
            style: trajectoryStyle,
            visible: true,
            zIndex: 23
        });
        const trajectoryLayer = new ol.layer.Group({
            layers: [
                sunTrajectoryLayer,
                moonTrajectoryLayer
            ],
            visible: trajectoryVisible,
            zIndex: 22
        });

        const directionSource = new ol.source.Vector();
        const directionLayer = new ol.layer.Vector({
            source: directionSource,
            style: directionStyle,
            visible: runtimeLayerEnabled('compass', true),
            zIndex: 24
        });

        const bodySource = new ol.source.Vector();
        const bodyLayer = new ol.layer.Vector({
            source: bodySource,
            style: bodyStyle,
            visible: true,
            zIndex: 130
        });

        const eclipseSource = new ol.source.Vector();
        const eclipseLayer = new ol.layer.Vector({
            source: eclipseSource,
            style: eclipseStyle,
            visible: true,
            zIndex: 132
        });

        const contextSource = new ol.source.Vector();
        const contextLayer = new ol.layer.Vector({
            source: contextSource,
            style: contextMarkerStyle,
            visible: true,
            zIndex: 140
        });
        const onlineOverlayLayer = new ol.layer.Group({
            layers: [],
            visible: false,
            zIndex: 160
        });
        const weatherParticleSource = new ol.source.Vector();
        const weatherOverlayLayer = new ol.layer.Group({
            layers: [],
            visible: false,
            zIndex: 161
        });

        state.features.sun = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([0, 0])),
            kind: 'sun',
            label: 'Subsolar'
        });
        state.features.moon = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([0, 0])),
            kind: 'moon',
            label: 'Sublunar'
        });
        state.features.observer = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([state.observer.lon, state.observer.lat])),
            kind: 'observer',
            label: 'Observer'
        });
        state.features.timeline = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([0, 0])),
            kind: 'timeline',
            label: 'Timeline'
        });
        bodySource.addFeatures([
            state.features.sun,
            state.features.moon,
            state.features.observer,
            state.features.timeline
        ]);
        state.features.building = new ol.Feature({
            kind: 'building',
            label: 'Building',
            iconPath: placesIconPath(PLACE_ICONS.mosque)
        });
        state.features.provider = new ol.Feature({
            kind: 'ip-provider',
            label: 'IP provider',
            iconPath: IP_PROVIDER_ICON
        });
        state.features.calibrationLine = new ol.Feature({
            kind: 'provider-building-calibration',
            label: 'Provider → Building Coordinate Calibration'
        });
        state.features.kaabah = new ol.Feature({
            kind: 'kaabah',
            label: 'Kaabah',
            iconPath: placesIconPath(PLACE_ICONS.kaabah)
        });
        state.features.kaabahLine = new ol.Feature({
            kind: 'kaabah-line',
            label: 'Building to Kaabah'
        });
        contextSource.addFeatures([
            state.features.kaabahLine,
            state.features.calibrationLine,
            state.features.building,
            state.features.provider,
            state.features.kaabah
        ]);

        state.layers = {
            osm: basicLayer,
            fiord: fiordLayer,
            positron: positronLayer,
            dark: darkLayer,
            topo: topoLayer,
            topoFeatures: topoFeatureLayer,
            sat: satLayer,
            satFeatures: satFeatureLayer,
            graticule: graticuleLayer,
            atmosphere: atmosphereLayer,
            prayer: prayerLayer,
            hilal: hilalLayer,
            naturalEarth: new ol.layer.Group({
                layers: naturalEarthLayers.map((entry) => entry.layer),
                visible: false,
                zIndex: 2
            }),
            adm: admLayer,
            trajectory: trajectoryLayer,
            sunTrajectory: sunTrajectoryLayer,
            moonTrajectory: moonTrajectoryLayer,
            direction: directionLayer,
            bodies: bodyLayer,
            eclipse: eclipseLayer,
            context: contextLayer,
            onlineOverlay: onlineOverlayLayer,
            weatherOverlay: weatherOverlayLayer
        };
        state.sources = {
            adm: admSource,
            trajectory: sunTrajectorySource,
            sunTrajectory: sunTrajectorySource,
            moonTrajectory: moonTrajectorySource,
            direction: directionSource,
            bodies: bodySource,
            eclipse: eclipseSource,
            context: contextSource,
            weatherParticles: weatherParticleSource
        };
        naturalEarthLayers.forEach((entry) => {
            state.sources[`naturalEarth:${entry.layer.get('title')}`] = entry.source;
        });

        state.map = new ol.Map({
            target: 'map',
            layers: [
                basicLayer,
                fiordLayer,
                positronLayer,
                darkLayer,
                topoLayer,
                satLayer,
                graticuleLayer,
                atmosphereLayer,
                prayerLayer,
                hilalLayer,
                state.layers.naturalEarth,
                admLayer,
                onlineOverlayLayer,
                weatherOverlayLayer,
                trajectoryLayer,
                directionLayer,
                bodyLayer,
                eclipseLayer,
                contextLayer
            ],
            view: new ol.View({
                center: ol.proj.fromLonLat([state.observer.lon, state.observer.lat]),
                zoom: 3,
                minZoom: 1,
                maxZoom: 18
            })
        });
        state.popupOverlay = new ol.Overlay({
            element: ensureMapInfoPopup(),
            positioning: 'bottom-center',
            offset: [0, -18],
            stopEvent: true,
            // Reviewer controls popup placement only after the map transition
            // finishes. A built-in auto-pan started before zoom can otherwise
            // complete late and move the focused icon outside the viewport.
            autoPan: state.reviewerMode === 'display' ? false : {
                animation: { duration: 180 },
                margin: 16
            }
        });
        state.map.addOverlay(state.popupOverlay);
        if (window.MpmEarthquakeRadius) window.MpmEarthquakeRadius.init(state.map);

        state.map.on('pointermove', handlePointerMove);
        state.map.on('click', handleMapClick);
        bindMapResize();
        updateMapSize();
        loadNaturalEarthFeatures('10m').catch(() => {});
    }

    function updateMapSize() {
        if (!state.map) {
            return;
        }
        state.map.updateSize();
        state.map.render();
    }

    function bindMapResize() {
        window.addEventListener('resize', updateMapSize);
        const target = byId('map');
        if (target && window.ResizeObserver) {
            state.resizeObserver = new ResizeObserver(() => updateMapSize());
            state.resizeObserver.observe(target);
        }
        const view = state.map && state.map.getView ? state.map.getView() : null;
        if (view) {
            view.on('change:resolution', scheduleDirectionLayerResize);
        }
    }

    function scheduleDirectionLayerResize() {
        if (state.directionZoomFrame !== null) {
            return;
        }
        state.directionZoomFrame = window.requestAnimationFrame(() => {
            state.directionZoomFrame = null;
            if (state.latestDirectionAnalysis.length && state.sources.direction) {
                renderDirectionLayer(state.latestDirectionAnalysis);
            }
        });
    }

    function registerCoreFeatures() {
        const trajectoryFeature = () => {
            const source = state.sources.trajectory;
            return source && source.getFeatures ? (source.getFeatures()[0] || null) : null;
        };
        const eclipseFeature = (kind) => {
            const source = state.sources.eclipse;
            return source && source.getFeatures
                ? (source.getFeatures().find((feature) => feature.get('kind') === kind) || null)
                : null;
        };
        replaceFeatureRegistry('core', [
            {
                id: 'building', type: 'building', name: () => state.features.building && state.features.building.get('label'),
                layer: state.layers.context, marker: state.features.building, popup: () => buildBuildingInfoHtml(),
                iconUrl: () => state.features.building && state.features.building.get('iconPath'),
                iconLabel: () => localized('Ikon Gedung Aktif', 'Active Building icon'),
                iconMeaning: () => localized('Menandai gedung dari konteks lokasi database admin.', 'Marks the building from the admin database location context.'),
                reviewerEnabled: true, priority: 30, dataSource: 'Admin location SQL/API'
            },
            {
                id: 'sun', type: 'astro', name: () => localized('Matahari', 'Sun'),
                layer: state.layers.bodies, marker: state.features.sun, popup: () => buildSunInfoHtml(),
                iconUrl: ICONS.sun, iconLabel: () => localized('Ikon Matahari / Subsolar', 'Sun / Subsolar icon'),
                iconMeaning: () => localized('Menandai titik subsolar dan kondisi Matahari pada waktu render.', 'Marks the subsolar point and Sun conditions at render time.'),
                reviewerEnabled: true, priority: 30, dataSource: 'Astronomy Engine'
            },
            {
                id: 'moon', type: 'astro', name: () => localized('Bulan', 'Moon'),
                layer: state.layers.bodies, marker: state.features.moon, popup: () => buildMoonInfoHtml(),
                iconUrl: ICONS.moon, iconLabel: () => localized('Ikon Bulan / Sublunar', 'Moon / Sublunar icon'),
                iconMeaning: () => localized('Menandai titik sublunar dan fase Bulan pada waktu render.', 'Marks the sublunar point and Moon phase at render time.'),
                reviewerEnabled: true, priority: 30, dataSource: 'Astronomy Engine'
            },
            {
                id: 'moon-phase', type: 'astro', name: () => localized('Fase Bulan', 'Moon Phase'),
                layer: state.layers.bodies, marker: state.features.moon, popup: () => buildMoonInfoHtml(),
                iconUrl: ICONS.moon, iconLabel: () => localized('Visual Fase Bulan', 'Moon Phase visual'),
                iconMeaning: () => localized('Visual berubah mengikuti fase dan iluminasi Bulan hasil kalkulasi.', 'The visual follows the calculated Moon phase and illumination.'),
                reviewerEnabled: true, priority: 30, dataSource: 'Astronomy Engine'
            },
            {
                id: 'timeline', type: 'timeline', name: () => localized('Timeline Subsolar', 'Subsolar Timeline'),
                layer: state.layers.bodies, marker: state.features.timeline, popup: () => buildTimelineInfoHtml(),
                iconLabel: () => localized('Titik Timeline', 'Timeline point'),
                iconMeaning: () => localized('Menunjukkan posisi subsolar yang terkait dengan waktu aktif presentasi.', 'Shows the subsolar position associated with the active presentation time.'),
                reviewerEnabled: true, priority: 28, dataSource: 'Actual Time / Astronomy Engine'
            },
            {
                id: 'observer', type: 'location', name: () => localized('Lokasi Observasi', 'Observation Point'),
                layer: state.layers.bodies, marker: state.features.observer,
                popup: () => buildFeatureInfoHtml(state.features.observer), reviewerEnabled: true,
                iconLabel: () => localized('Titik Observer', 'Observer point'),
                iconMeaning: () => localized('Lokasi acuan perhitungan astronomi, rukyat, dan arah.', 'Reference location for astronomy, rukyat, and direction calculations.'),
                priority: 25, dataSource: 'Admin context / observer state'
            },
            {
                id: 'kaabah', type: 'location', name: "Ka'bah",
                layer: state.layers.context, marker: state.features.kaabah, popup: () => buildKaabahInfoHtml(),
                iconUrl: () => state.features.kaabah && state.features.kaabah.get('iconPath'),
                iconLabel: () => localized("Ikon Ka'bah", 'Kaabah icon'),
                iconMeaning: () => localized("Koordinat kanonik Ka'bah sebagai tujuan arah kiblat.", 'Canonical Kaabah coordinate used as the Qibla destination.'),
                reviewerEnabled: true, priority: 30, dataSource: 'WebGIS canonical coordinate'
            },
            {
                id: 'ip-provider', type: 'location', name: 'IP provider',
                layer: state.layers.context, marker: state.features.provider, popup: () => buildProviderInfoHtml(),
                iconUrl: IP_PROVIDER_ICON, iconLabel: 'IP provider',
                iconMeaning: () => localized('Estimasi lokasi jaringan untuk pembanding; bukan lokasi utama gedung.', 'Estimated network location for comparison; not the primary building location.'),
                reviewerEnabled: true, priority: 18, dataSource: 'Provider coordinate service'
            },
            {
                id: 'provider-building-calibration', type: 'provider-building-calibration',
                name: () => localized('Kalibrasi Provider ke Gedung', 'Provider to Building Calibration'),
                layer: state.layers.context, marker: state.features.calibrationLine,
                popup: () => buildCalibrationLineInfoHtml(),
                iconLabel: () => localized('Garis Kalibrasi Sian', 'Cyan Calibration Line'),
                iconMeaning: () => localized('Membandingkan koordinat estimasi IP dengan koordinat gedung database.', 'Compares the IP-estimated coordinate with the database building coordinate.'),
                reviewerEnabled: true, priority: 17, dataSource: 'Time-coordinate calibration'
            },
            {
                id: 'kaabah-line', type: 'kaabah-line',
                name: () => localized("Garis Gedung ke Ka'bah", 'Building to Kaabah Line'),
                layer: state.layers.context, marker: state.features.kaabahLine,
                popup: () => buildKaabahLineInfoHtml(),
                iconLabel: () => localized("Garis Kiblat Emas", 'Golden Qibla Line'),
                iconMeaning: () => localized("Menunjukkan jalur geodesik dan bearing awal dari gedung menuju Ka'bah.", 'Shows the geodesic path and initial bearing from the building to the Kaabah.'),
                reviewerEnabled: true, priority: 26, dataSource: 'WebGIS geodesic calculation'
            },
            {
                id: 'trajectory', type: 'trajectory', name: () => localized('Trajektori Matahari & Bulan', 'Sun & Moon Trajectory'),
                layer: state.layers.trajectory, marker: trajectoryFeature,
                iconLabel: () => localized('Garis Trajektori', 'Trajectory line'),
                iconMeaning: () => localized('Menampilkan jalur kalkulasi Matahari dan Bulan.', 'Displays the calculated Sun and Moon paths.'),
                reviewerEnabled: true, priority: 20, dataSource: 'WebGIS local calculation'
            },
            {
                id: 'solar-eclipse', type: 'astro', name: () => localized('Gerhana Matahari', 'Solar Eclipse'),
                layer: state.layers.eclipse, marker: () => eclipseFeature('solar-eclipse'),
                popup: () => {
                    const feature = eclipseFeature('solar-eclipse');
                    return feature ? buildFeatureInfoHtml(feature) : '';
                }, reviewerEnabled: true, priority: 35, dataSource: 'Astronomy Engine / Falak registry'
            },
            {
                id: 'lunar-eclipse', type: 'astro', name: () => localized('Gerhana Bulan', 'Lunar Eclipse'),
                layer: state.layers.eclipse, marker: () => eclipseFeature('lunar-eclipse'),
                popup: () => {
                    const feature = eclipseFeature('lunar-eclipse');
                    return feature ? buildFeatureInfoHtml(feature) : '';
                }, reviewerEnabled: true, priority: 35, dataSource: 'Astronomy Engine / Falak registry'
            }
        ]);
    }

    function applyRuntimeLayerControls() {
        const trajectoryToggle = byId('trajectoryToggle');
        const directionToggle = byId('directionToggle');
        const waterScale = byId('waterFeaturesScale');
        if (trajectoryToggle) {
            trajectoryToggle.checked = runtimeLayerEnabled('trajectory', false);
        }
        if (directionToggle) {
            directionToggle.checked = runtimeLayerEnabled('compass', directionToggle.checked);
        }
        if (waterScale) {
            state.naturalEarthScale = waterScale.value || '10m';
        }
        syncTrajectoryLayerVisibility();
    }

    function syncTrajectoryLayerVisibility() {
        const masterToggle = byId('trajectoryToggle');
        const sunToggle = byId('sunTrajectoryToggle');
        const moonToggle = byId('moonTrajectoryToggle');
        const masterVisible = masterToggle ? masterToggle.checked : true;
        const sunVisible = sunToggle ? sunToggle.checked : true;
        const moonVisible = moonToggle ? moonToggle.checked : true;

        if (state.layers.trajectory) {
            state.layers.trajectory.setVisible(masterVisible);
        }
        if (state.layers.sunTrajectory) {
            state.layers.sunTrajectory.setVisible(sunVisible);
        }
        if (state.layers.moonTrajectory) {
            state.layers.moonTrajectory.setVisible(moonVisible);
        }
    }

    function syncTrajectoryBodyToggles() {
        const bodySelect = byId('trajectoryBody');
        const sunToggle = byId('sunTrajectoryToggle');
        const moonToggle = byId('moonTrajectoryToggle');
        const choice = bodySelect ? bodySelect.value : 'both';
        if (sunToggle) {
            sunToggle.checked = choice !== 'moon';
        }
        if (moonToggle) {
            moonToggle.checked = choice !== 'sun';
        }
        syncTrajectoryLayerVisibility();
    }

    function bodyStyle(feature) {
        const kind = feature.get('kind');

        if (kind === 'sun') {
            const style = new ol.style.Style({
                image: new ol.style.Icon({
                    src: ICONS.sun,
                    scale: 0.045,
                    anchor: [0.5, 0.5]
                }),
                text: labelStyle(feature.get('label'), 34, '#7a4d00')
            });
            return withPopupHighlight(feature, style, 22);
        }

        if (kind === 'moon') {
            const style = new ol.style.Style({
                image: new ol.style.Icon({
                    img: getMoonIconCanvas(),
                    imgSize: [64, 64],
                    scale: 0.82,
                    anchor: [0.5, 0.5]
                }),
                text: labelStyle(feature.get('label'), 34, '#223247')
            });
            return withPopupHighlight(feature, style, 22);
        }

        if (kind === 'timeline') {
            return new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 6,
                    fill: new ol.style.Fill({ color: '#d88918' }),
                    stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
                }),
                text: labelStyle(feature.get('label'), 22, '#6d470c')
            });
        }

        const style = new ol.style.Style({
            image: new ol.style.Circle({
                radius: 7,
                fill: new ol.style.Fill({ color: '#176a58' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
            }),
            text: labelStyle(feature.get('label'), 22, '#123b32')
        });
        return withPopupHighlight(feature, style, 18);
    }

    function admBoundaryStyle(feature) {
        const level = feature.get('admLevel') || 'adm0';
        const styles = {
            adm0: {
                stroke: 'rgba(255, 213, 74, 0.98)',
                fill: 'rgba(255, 213, 74, 0.08)',
                width: 1.6
            },
            adm1: {
                stroke: 'rgba(255, 213, 74, 0.98)',
                fill: 'rgba(255, 213, 74, 0.08)',
                width: 2
            },
            adm2: {
                stroke: 'rgba(255, 213, 74, 0.98)',
                fill: 'rgba(255, 213, 74, 0.08)',
                width: 2.4
            }
        };
        const selected = styles[level] || styles.adm0;

        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: selected.stroke,
                width: selected.width
            }),
            fill: new ol.style.Fill({ color: selected.fill })
        });
    }

    function contextMarkerStyle(feature) {
        const kind = feature.get('kind');
        if (kind === 'kaabah-line') {
            return new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: 'rgba(214, 160, 34, 0.92)',
                    width: 3
                })
            });
        }
        if (kind === 'provider-building-calibration') {
            return new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: '#00FFFF',
                    width: 3,
                    lineDash: [9, 5]
                })
            });
        }

        const isProvider = kind === 'ip-provider';
        const isKaabah = kind === 'kaabah';
        const anchor = isKaabah
            ? ADMIN_CONTEXT_ICON_ANCHORS.kaabah
            : (isProvider ? ADMIN_CONTEXT_ICON_ANCHORS.provider : ADMIN_CONTEXT_ICON_ANCHORS.building);
        const src = feature.get('iconPath') || (isProvider
            ? IP_PROVIDER_ICON
            : placesIconPath(isKaabah ? PLACE_ICONS.kaabah : PLACE_ICONS.mosque));
        const style = new ol.style.Style({
            image: new ol.style.Icon({
                src,
                scale: isProvider ? 0.055 : (isKaabah ? 0.072 : 0.062),
                anchor,
                anchorXUnits: 'fraction',
                anchorYUnits: 'fraction'
            }),
            text: labelStyle(
                feature.get('label'),
                isProvider ? 20 : 24,
                isProvider ? '#194c7a' : (isKaabah ? '#7a4d00' : '#123b32')
            )
        });
        return withPopupHighlight(feature, style, isProvider ? 19 : 22);
    }

    function eclipseStyle(feature) {
        const eventType = feature.get('eventType') || 'solar';
        const isLunar = eventType === 'lunar';
        const halo = isLunar ? 'rgba(116, 151, 211, 0.2)' : 'rgba(246, 196, 83, 0.18)';
        const ring = isLunar ? 'rgba(116, 151, 211, 0.9)' : 'rgba(246, 196, 83, 0.86)';
        const inner = isLunar ? 'rgba(30, 44, 74, 0.96)' : 'rgba(17, 24, 33, 0.95)';
        const edge = isLunar ? '#9cb8f0' : '#f6c453';
        const labelColor = isLunar ? '#20365f' : '#4d3400';
        const styles = [
            new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 13,
                    fill: new ol.style.Fill({ color: halo }),
                    stroke: new ol.style.Stroke({ color: ring, width: 1.5 })
                })
            }),
            new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 8,
                    fill: new ol.style.Fill({ color: inner }),
                    stroke: new ol.style.Stroke({ color: edge, width: 2.2 })
                }),
                text: labelStyle(feature.get('markerLabel') || feature.get('label') || 'Eclipse', -23, labelColor)
            })
        ];
        return isActivePopupFeature(feature)
            ? [activePopupHighlightStyle(18), ...styles]
            : styles;
    }

    function labelStyle(text, offsetY, color) {
        return new ol.style.Text({
            text,
            offsetY,
            font: '800 12px Segoe UI, Arial, sans-serif',
            fill: new ol.style.Fill({ color }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 4 })
        });
    }

    function trajectoryStyle(feature) {
        const role = feature.get('role');
        const body = feature.get('body');
        const trajectoryKind = feature.get('trajectoryKind') || 'orbital';
        const isFuture = role === 'future';
        const isMoon = body === 'moon';
        const isDailySun = body === 'sun' && trajectoryKind === 'daily';
        const isSunAnalemma = body === 'sun' && trajectoryKind === 'analemma';

        if (isDailySun) {
            return new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: 'rgba(246, 196, 83, 0.9)',
                    width: 2.6
                })
            });
        }

        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: isSunAnalemma
                    ? (isFuture ? 'rgba(192, 57, 43, 0.62)' : 'rgba(19, 138, 85, 0.62)')
                    : (isFuture ? 'rgba(80, 110, 183, 0.58)' : 'rgba(24, 106, 133, 0.58)'),
                width: isMoon ? 1.35 : 1.9,
                lineDash: isMoon ? [5, 5] : (isSunAnalemma ? undefined : [7, 5])
            })
        });
    }

    function directionStyle(feature) {
        if (feature.getGeometry().getType() === 'Point') {
            return new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 3.5,
                    fill: new ol.style.Fill({ color: '#d88918' }),
                    stroke: new ol.style.Stroke({ color: '#ffffff', width: 1.5 })
                }),
                text: new ol.style.Text({
                    text: feature.get('abbr'),
                    offsetY: 14,
                    font: '900 12px Segoe UI, Arial, sans-serif',
                    fill: new ol.style.Fill({ color: '#513608' }),
                    stroke: new ol.style.Stroke({ color: '#ffffff', width: 3.5 }),
                    backgroundFill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.74)' }),
                    padding: [1, 2, 1, 2]
                })
            });
        }

        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: 'rgba(216, 137, 24, 0.78)',
                width: 1.5,
                lineDash: [6, 5]
            })
        });
    }

    function getMoonIconCanvas() {
        if (!state.moonIconCanvas) {
            state.moonIconCanvas = document.createElement('canvas');
            state.moonIconCanvas.width = 64;
            state.moonIconCanvas.height = 64;
        }

        drawMoonCanvas(state.moonIconCanvas, state.latestSnapshot && state.latestSnapshot.moon);
        return state.moonIconCanvas;
    }

    function drawMoonCanvas(canvas, moon) {
        const context = canvas.getContext('2d');
        const size = canvas.width;
        const center = size / 2;
        const radius = size / 2 - 4;
        const phaseDegrees = moon ? moon.phaseDegrees : 0;
        const illumination = moon ? moon.illumination : 0;
        const phase = normalize360(phaseDegrees) / 360;

        context.clearRect(0, 0, size, size);
        context.save();
        context.beginPath();
        context.arc(center, center, radius, 0, Math.PI * 2);
        context.clip();

        if (state.moonTextureImage && state.moonTextureImage.complete) {
            context.drawImage(
                state.moonTextureImage,
                center - radius,
                center - radius,
                radius * 2,
                radius * 2
            );
        } else {
            const surface = context.createRadialGradient(center - 12, center - 13, 2, center, center, radius);
            surface.addColorStop(0, '#fffbe3');
            surface.addColorStop(0.55, '#d9d2b7');
            surface.addColorStop(1, '#77766f');
            context.fillStyle = surface;
            context.fillRect(0, 0, size, size);
        }

        drawMoonPhaseShadow(context, center, radius, phase, illumination);

        context.restore();
        context.beginPath();
        context.arc(center, center, radius, 0, Math.PI * 2);
        context.strokeStyle = 'rgba(255, 255, 255, 0.76)';
        context.lineWidth = 2;
        context.stroke();

        const glow = clamp(illumination, 0.08, 1);
        context.beginPath();
        context.arc(center, center, radius + 2, 0, Math.PI * 2);
        context.strokeStyle = `rgba(210, 225, 255, ${0.12 + glow * 0.25})`;
        context.lineWidth = 3;
        context.stroke();
    }

    function drawMoonPhaseShadow(context, center, radius, phase, illumination) {
        if (illumination <= 0.02) {
            context.fillStyle = 'rgba(3, 7, 16, 0.92)';
            context.fillRect(center - radius, center - radius, radius * 2, radius * 2);
            return;
        }

        if (illumination >= 0.98) {
            return;
        }

        const waxing = phase < 0.5;
        const shadowWidth = (1 - illumination) * radius * 2;

        context.fillStyle = 'rgba(3, 7, 16, 0.78)';
        context.beginPath();
        if (waxing) {
            context.rect(center - radius, center - radius, shadowWidth, radius * 2);
        } else {
            context.rect(center + radius - shadowWidth, center - radius, shadowWidth, radius * 2);
        }
        context.fill();

        context.globalAlpha = 0.34;
        context.fillStyle = 'rgba(3, 7, 16, 0.8)';
        context.beginPath();
        context.ellipse(
            center + (waxing ? -shadowWidth / 2 : shadowWidth / 2),
            center,
            Math.max(4, shadowWidth / 2),
            radius,
            0,
            0,
            Math.PI * 2
        );
        context.fill();
        context.globalAlpha = 1;
    }

    function bindPrayerPublicationControls() {
        const savePrayerPublicationButton = byId('saveFalakPublication');
        if (savePrayerPublicationButton) {
            savePrayerPublicationButton.addEventListener('click', savePrayerPublication);
        }
        const publicationPrimary = byId('falakPublicationPrimary');
        if (publicationPrimary) {
            publicationPrimary.addEventListener('change', () => {
                if (state.falakPrayerPublication) {
                    state.falakPrayerPublication.primaryMethodKey = publicationPrimary.value;
                }
                setPrayerPublicationStatus('Perubahan metode utama belum disimpan.', '');
            });
        }
        const publicationAsr = byId('falakPublicationAsr');
        if (publicationAsr) {
            publicationAsr.addEventListener('change', () => {
                if (state.falakPrayerPublication) {
                    state.falakPrayerPublication.asrMethodKey = publicationAsr.value;
                }
                setPrayerPublicationStatus('Perubahan metode Ashar belum disimpan.', '');
            });
        }
    }

    function bindCompactDetailsAccordions() {
        const groups = new Map();
        document.querySelectorAll('details[data-astro-accordion]').forEach((detail) => {
            const groupName = detail.dataset.astroAccordion || 'default';
            if (!groups.has(groupName)) {
                groups.set(groupName, []);
            }
            groups.get(groupName).push(detail);
        });
        groups.forEach((details) => {
            let openFound = false;
            details.forEach((detail) => {
                if (detail.open && openFound) {
                    detail.open = false;
                } else if (detail.open) {
                    openFound = true;
                }
                detail.addEventListener('toggle', () => {
                    if (!detail.open) {
                        return;
                    }
                    details.forEach((sibling) => {
                        if (sibling !== detail && sibling.open) {
                            sibling.open = false;
                        }
                    });
                });
            });
        });
    }

    function bindControls() {
        bindCompactDetailsAccordions();
        document.querySelectorAll('[data-basemap]').forEach((button) => {
            button.addEventListener('click', () => switchBasemap(button.dataset.basemap));
        });

        document.querySelectorAll('[data-tab]').forEach((button) => {
            const tabName = button.dataset.tab;
            const panel = byId(`tab-${tabName}`);
            button.id = button.id || `panel-tab-${tabName}`;
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-controls', `tab-${tabName}`);
            button.setAttribute('aria-selected', button.classList.contains('active') ? 'true' : 'false');
            button.tabIndex = button.classList.contains('active') ? 0 : -1;
            if (panel) {
                panel.setAttribute('role', 'tabpanel');
                panel.setAttribute('aria-labelledby', button.id);
            }
            button.addEventListener('click', () => activateTab(button.dataset.tab));
        });

        byId('applyObserver').addEventListener('click', () => {
            applyObserverInputs();
            updateAll(true);
            rebuildTrajectory();
        });

        byId('centerObserver').addEventListener('click', centerOnObserver);
        byId('locateButton').addEventListener('click', locateDevice);
        byId('syncTimeButton').addEventListener('click', syncNetworkTime);
        byId('exportButton').addEventListener('click', downloadJson);
        byId('copyJsonButton').addEventListener('click', copyJson);

        const loadContextButton = byId('loadAdminContext');
        if (loadContextButton) {
            loadContextButton.addEventListener('click', loadAdminContext);
        }
        const applyContextButton = byId('applyAdminContext');
        if (applyContextButton) {
            applyContextButton.addEventListener('click', () => applyAdminContextToObserver(true));
        }
        const reviewerModeSelect = byId('reviewerModeSelect');
        if (reviewerModeSelect) {
            reviewerModeSelect.addEventListener('change', (event) => {
                state.reviewerMode = event.target.value === 'display' ? 'display' : 'settings';
                applyReviewerMode();
            });
        }
        document.querySelectorAll('[data-language]').forEach((button) => {
            button.addEventListener('click', () => {
                state.reviewerLanguage = normalizeReviewerLanguage(button.dataset.language || 'id');
                if (window.PrayerI18n) window.PrayerI18n.setLanguage(state.reviewerLanguage);
                applyReviewerLanguage();
                populateFalakControls();
                populateTimezoneSelect(getSelectedTimezoneName());
                state.lastEclipseKey = '';
                state.lastEclipseSeriesKey = '';
                renderReviewerContext();
                renderProviderContext();
                renderFalakRegistry();
                renderPrayerPublication();
                renderFalakCalendar();
                if (state.latestSnapshot) {
                    updateAll(true);
                } else {
                    renderIslamicMethodNarrative();
                    updateEclipseRangeOptions(getRenderDate());
                    if (state.latestEclipse) {
                        renderEclipsePrediction(state.latestEclipse);
                    }
                }
            });
        });
        const admBoundaryMode = byId('admBoundaryMode');
        if (admBoundaryMode) {
            admBoundaryMode.addEventListener('change', (event) => {
                state.admBoundaryMode = event.target.value || 'adm0-adm1-adm2';
                state.admLoadKey = '';
                loadAdmBoundaries(state.adminContext);
            });
        }
        const ipComparisonMode = byId('ipComparisonMode');
        if (ipComparisonMode) {
            ipComparisonMode.addEventListener('change', (event) => {
                state.ipComparisonMode = event.target.value || 'provider';
                renderProviderContext();
                renderContextMarkers();
                if (state.ipComparisonMode !== 'off' && !providerPoint()) {
                    initProviderContext();
                }
                updateAll(true);
            });
        }
        const eclipseRangeSelect = byId('eclipseRangeSelect');
        if (eclipseRangeSelect) {
            eclipseRangeSelect.addEventListener('change', (event) => {
                state.eclipseHorizonYears = clamp(Number(event.target.value || 0), 0, 10);
                state.lastEclipseKey = '';
                state.lastEclipseSeriesKey = '';
                updateAll(true);
            });
        }
        byId('atmosphereToggle').addEventListener('change', (event) => {
            state.layers.atmosphere.setVisible(event.target.checked);
        });
        byId('trajectoryToggle').addEventListener('change', (event) => {
            syncTrajectoryLayerVisibility();
        });
        const sunTrajectoryToggle = byId('sunTrajectoryToggle');
        if (sunTrajectoryToggle) {
            sunTrajectoryToggle.addEventListener('change', syncTrajectoryLayerVisibility);
        }
        const moonTrajectoryToggle = byId('moonTrajectoryToggle');
        if (moonTrajectoryToggle) {
            moonTrajectoryToggle.addEventListener('change', syncTrajectoryLayerVisibility);
        }
        byId('prayerZoneToggle').addEventListener('change', (event) => {
            state.layers.prayer.setVisible(event.target.checked);
        });
        byId('hilalZoneToggle').addEventListener('change', (event) => {
            state.layers.hilal.setVisible(event.target.checked);
        });
        byId('directionToggle').addEventListener('change', (event) => {
            state.layers.direction.setVisible(event.target.checked);
        });
        byId('admBoundaryToggle').addEventListener('change', (event) => {
            state.layers.adm.setVisible(event.target.checked);
        });
        byId('ipMarkerToggle').addEventListener('change', (event) => {
            state.showIpMarker = event.target.checked;
            renderContextMarkers();
        });
        const kaabahLineToggle = byId('kaabahLineToggle');
        if (kaabahLineToggle) {
            kaabahLineToggle.addEventListener('change', (event) => {
                state.showKaabahLine = event.target.checked;
                renderContextMarkers();
            });
        }
        const calibrationLineToggle = byId('calibrationLineToggle');
        if (calibrationLineToggle) {
            const calibration = timeCoordinateCalibrationState();
            state.showCalibrationLine = calibration && calibration.configuration
                ? calibration.configuration.showCalibrationLine !== false
                : calibrationLineToggle.checked;
            calibrationLineToggle.checked = state.showCalibrationLine;
            calibrationLineToggle.addEventListener('change', (event) => {
                state.showCalibrationLine = event.target.checked;
                if (window.MpmTimeCoordinateCalibration) {
                    window.MpmTimeCoordinateCalibration.configure({ showCalibrationLine: state.showCalibrationLine });
                }
                renderContextMarkers();
            });
        }
        const waterFeaturesToggle = byId('waterFeaturesToggle');
        const waterFeaturesScale = byId('waterFeaturesScale');
        if (waterFeaturesToggle) {
            waterFeaturesToggle.addEventListener('change', (event) => {
                toggleNaturalEarthFeatures(event.target.checked, waterFeaturesScale ? waterFeaturesScale.value : '10m')
                    .catch((error) => console.warn('Natural Earth water layers failed:', error));
            });
        }
        if (waterFeaturesScale) {
            waterFeaturesScale.addEventListener('change', (event) => {
                state.naturalEarthScale = event.target.value || '10m';
                if (waterFeaturesToggle && waterFeaturesToggle.checked) {
                    toggleNaturalEarthFeatures(true, state.naturalEarthScale)
                        .catch((error) => console.warn('Natural Earth scale change failed:', error));
                }
            });
        }
        const onlineMapToggle = byId('onlineMapToggle');
        const onlineMapSelect = byId('onlineMapSelect');
        const environmentDisplaySelect = byId('environmentDisplaySelect');
        const environmentRangeSelect = byId('environmentRangeSelect');
        if (onlineMapSelect) {
            onlineMapSelect.addEventListener('change', () => {
                updateOnlineMapDataOptions(onlineMapSelect.value);
                updateOnlineMapFrame();
            });
        }
        if (environmentDisplaySelect) {
            environmentDisplaySelect.addEventListener('change', () => { hideMapInfoPopup(); updateOnlineMapFrame(); });
        }
        if (environmentRangeSelect) {
            environmentRangeSelect.addEventListener('change', updateOnlineMapFrame);
        }
        if (onlineMapToggle) {
            onlineMapToggle.addEventListener('change', (event) => {
                if (!event.target.checked) {
                    if (volcanoController) volcanoController.setEnabled(false);
                    if (airQualityController) airQualityController.setEnabled(false);
                    if (state.layers && state.layers.onlineOverlay) {
                        state.layers.onlineOverlay.getLayers().clear();
                        state.layers.onlineOverlay.setVisible(false);
                    }
                    return;
                }
                updateOnlineMapFrame();
            });
        }
        updateOnlineMapDataOptions(onlineMapSelect ? onlineMapSelect.value : 'firemap');
        window.addEventListener('online', updateOnlineMapControls);
        window.addEventListener('offline', updateOnlineMapControls);
        updateOnlineMapControls();
        updateOnlineMapFrame();
        if (weatherOverlayController) {
            try {
                weatherOverlayController.bind();
            } catch (error) {
                // Optional weather UI must not stop the admin database and ISP context startup.
                console.warn('[Weather] Initialization unavailable:', error.message);
                const weatherStatus = byId('weatherFrameStatus');
                if (weatherStatus) weatherStatus.textContent = localized('Modul cuaca belum siap. Muat ulang halaman untuk mencoba lagi.', 'Weather module is not ready. Reload the page to retry.');
            }
        }
        window.setInterval(() => {
            const toggle = byId('onlineMapToggle');
            if (toggle && toggle.checked && onlineMapAvailable() && !isEarthquakeMap(byId('onlineMapSelect').value)) {
                updateOnlineMapFrame();
            }
        }, 300000);
        window.setInterval(() => {
            if ((byId('onlineMapToggle') || {}).checked && isEarthquakeMap(byId('onlineMapSelect').value) && onlineMapAvailable() && !document.hidden) updateOnlineMapFrame();
        }, 300000);

        ['atmosphereOpacity', 'atmosphereOpacityMap'].forEach((id) => {
            byId(id).addEventListener('input', (event) => {
                const value = clamp(Number(event.target.value), 0, 100);
                state.layers.atmosphere.setOpacity(value / 100);
                byId('atmosphereOpacity').value = String(value);
                byId('atmosphereOpacityMap').value = String(value);
                byId('atmosphereOpacityValue').textContent = `${value}%`;
            });
        });

        byId('rebuildTrajectory').addEventListener('click', rebuildTrajectory);

        byId('liveTimeToggle').addEventListener('change', (event) => {
            state.live = event.target.checked;
            if (state.live) {
                byId('timelineSlider').value = '0';
                updateTimelineLabel();
            } else {
                setDateTimeInputFromDate(getNetworkNow(), getSelectedTimezoneOffset());
            }
            updateAll(true);
        });

        byId('timeInput').addEventListener('change', () => {
            setLiveMode(false);
            updateAll(true);
            rebuildTrajectory();
        });

        byId('timelineSlider').addEventListener('input', () => {
            setLiveMode(false);
            updateTimelineLabel();
            updateAll(true);
        });

        byId('playTimeline').addEventListener('click', toggleTimelinePlayback);

        ['timezoneSelect', 'prayerMethod', 'asrMadhab', 'directionDistance'].forEach((id) => {
            byId(id).addEventListener('change', () => {
                clearComputationCaches();
                if (id === 'timezoneSelect') {
                    setDateTimeInputFromDate(getRenderDate(), getSelectedTimezoneOffset());
                }
                updateAll(true);
            });
        });

        ['trajectoryBody', 'trajectoryYears', 'trajectoryStep'].forEach((id) => {
            byId(id).addEventListener('change', () => {
                if (id === 'trajectoryBody') {
                    syncTrajectoryBodyToggles();
                }
                rebuildTrajectory();
            });
        });
    }

    function activateTab(tabName) {
        if (!Array.from(document.querySelectorAll('[data-tab]')).some((button) => button.dataset.tab === tabName)
            || !byId(`tab-${tabName}`)) return;
        document.body.dataset.fieldObservationActive = String(tabName === 'rukyat' && Boolean(byId('fieldObservationRoot')));
        const current = document.querySelector('[data-tab].active');
        const tabChanged = !current || current.dataset.tab !== tabName;
        document.querySelectorAll('[data-tab]').forEach((button) => {
            const active = button.dataset.tab === tabName;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
            button.tabIndex = active ? 0 : -1;
        });
        document.querySelectorAll('.tab-panel').forEach((panel) => {
            panel.classList.toggle('active', panel.id === `tab-${tabName}`);
        });
        if (tabChanged) {
            const scroller = document.querySelector('.panel-scroll');
            if (scroller) {
                scroller.scrollTop = 0;
            }
        }
    }

    function switchBasemap(key) {
        ['osm', 'fiord', 'positron', 'dark', 'topo', 'sat'].forEach((layerKey) => {
            const layer = state.layers[layerKey];
            if (layer) {
                layer.setVisible(layerKey === key);
            }
        });

        document.querySelectorAll('[data-basemap]').forEach((button) => {
            button.classList.toggle('active', button.dataset.basemap === key);
        });
        if (window.MpmMapPresentation) window.MpmMapPresentation.changed();
    }

    const presentationLayerKeys = ['graticule','atmosphere','prayer','hilal','naturalEarth','adm','trajectory','sunTrajectory','moonTrajectory','direction','bodies','eclipse','context','onlineOverlay','weatherOverlay'];
    const presentationControlIds = ['atmosphereToggle','atmosphereOpacity','prayerZoneToggle','hilalZoneToggle','directionToggle','admBoundaryToggle','trajectoryToggle','sunTrajectoryToggle','moonTrajectoryToggle','waterFeaturesToggle','waterFeaturesScale','ipMarkerToggle','kaabahLineToggle','calibrationLineToggle','onlineMapToggle','onlineMapSelect','environmentDisplaySelect','environmentRangeSelect','admBoundaryMode','ipComparisonMode'];
    const presentationLayerControls = {atmosphere:'atmosphereToggle',prayer:'prayerZoneToggle',hilal:'hilalZoneToggle',adm:'admBoundaryToggle',trajectory:'trajectoryToggle',sunTrajectory:'sunTrajectoryToggle',moonTrajectory:'moonTrajectoryToggle',direction:'directionToggle',naturalEarth:'waterFeaturesToggle'};
    function captureMapPresentation() {
        const result = {schemaVersion:1,baseMap:['osm','fiord','positron','dark','topo','sat'].find(key=>state.layers[key]&&state.layers[key].getVisible())||'osm',layers:{},controls:{}};
        presentationLayerKeys.forEach(key=>{const layer=state.layers[key];if(layer)result.layers[key]={visible:layer.getVisible(),opacity:layer.getOpacity(),zIndex:layer.getZIndex()||0};});
        presentationControlIds.forEach(id=>{const control=byId(id);if(control)result.controls[id]=control.type==='checkbox'?control.checked:control.value;});
        return result;
    }
    function setPresentationLayer(key,value) {
        const layer=state.layers[key];if(!layer||!presentationLayerKeys.includes(key))return;
        const control=byId(presentationLayerControls[key]);
        if(control && control.checked!==Boolean(value.visible)){control.checked=Boolean(value.visible);control.dispatchEvent(new Event('change',{bubbles:true}));}
        layer.setVisible(Boolean(value.visible));
        layer.setOpacity(clamp(Number(value.opacity),0,1));layer.setZIndex(clamp(Number(value.zIndex)||0,-1000,10000));
        if(key==='atmosphere'&&byId('atmosphereOpacity'))byId('atmosphereOpacity').value=String(Math.round(layer.getOpacity()*100));
    }
    let applyingPresentation = false;
    function applyMapPresentation(value) {
        if(!value||value.schemaVersion!==1)return;
        applyingPresentation = true;
        try {
        presentationControlIds.forEach(id=>{
            const control=byId(id);if(!control||!(id in (value.controls||{})))return;
            const desired=value.controls[id], current=control.type==='checkbox'?control.checked:control.value;
            if(current===desired)return;
            if(control.type==='checkbox')control.checked=Boolean(desired);
            else {if(control.tagName==='SELECT'&&!Array.from(control.options).some(option=>option.value===String(desired)))return;control.value=String(desired);}
            control.dispatchEvent(new Event('change',{bubbles:true}));
        });
        if(['osm','fiord','positron','dark','topo','sat'].includes(value.baseMap))switchBasemap(value.baseMap);
        Object.entries(value.layers||{}).forEach(([key,layer])=>setPresentationLayer(key,layer));
        } finally { applyingPresentation = false; }
        if(state.initializationStatus === 'READY')updateAll(true);
    }

    function setLiveMode(isLive) {
        state.live = isLive;
        byId('liveTimeToggle').checked = isLive;
    }

    function applyObserverInputs() {
        const lat = clamp(Number(byId('observerLat').value), -90, 90);
        const lon = clamp(Number(byId('observerLon').value), -180, 180);
        const elevation = Number(byId('observerElev').value || 0);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            setStatus(localized('Latitude atau longitude tidak valid.', 'Latitude or longitude is invalid.'));
            return;
        }

        state.observer.lat = lat;
        state.observer.lon = lon;
        state.observer.elevation = Number.isFinite(elevation) ? elevation : 0;
        clearComputationCaches();
        writeObserverInputs();
        updateObserverFeature();
        renderContextMarkers();
    }

    function writeObserverInputs() {
        byId('observerLat').value = state.observer.lat.toFixed(6);
        byId('observerLon').value = state.observer.lon.toFixed(6);
        byId('observerElev').value = String(Math.round(state.observer.elevation || 0));
    }

    function updateObserverFeature() {
        state.features.observer.getGeometry().setCoordinates(
            ol.proj.fromLonLat([state.observer.lon, state.observer.lat])
        );
    }

    function centerOnObserver() {
        state.map.getView().animate({
            center: ol.proj.fromLonLat([state.observer.lon, state.observer.lat]),
            zoom: Math.max(state.map.getView().getZoom(), 5),
            duration: 450
        });
    }

    function applyReviewerMode() {
        document.body.classList.toggle('astro-display-mode', state.reviewerMode === 'display');
        setText('reviewerModeBadge', state.reviewerMode === 'display'
            ? localized('Display', 'Display')
            : localized('Pengaturan', 'Settings'));
        const select = byId('reviewerModeSelect');
        if (select) {
            select.value = state.reviewerMode;
        }
        applyStaticPageTranslations();
        renderFalakRegistry();
    }

    function setContextBadge(label) {
        setText('contextSourceBadge', label);
    }

    function normalizeReviewerContext(raw) {
        if (!raw || typeof raw !== 'object') {
            return null;
        }
        if (window.MpmAdminLocation && window.MpmAdminLocation.normalize) {
            return window.MpmAdminLocation.normalize(raw);
        }

        const root = raw.data && typeof raw.data === 'object' ? raw.data : raw;
        const location = root.location && typeof root.location === 'object' ? root.location : root;
        const mosque = root.mosque && typeof root.mosque === 'object' ? root.mosque : {};
        const latitude = Number(location.latitude !== undefined ? location.latitude : root.latitude);
        const longitude = Number(location.longitude !== undefined ? location.longitude : root.longitude);
        if (!validCoordinates(latitude, longitude)) {
            return null;
        }

        return {
            schemaVersion: 'mpm.active-location.v1',
            updatedAt: textValue(root.updatedAt || root.updated_at || actualNow().toISOString()),
            source: textValue(root.source || 'active-mosque-api'),
            mosque: {
                id: mosque.id || root.mosqueId || root.mosque_id || null,
                name: textValue(mosque.name || mosque.mosqueName || root.mosqueName || root.mosque_name),
                type: textValue(mosque.type || root.buildingType),
                typeLabel: textValue(mosque.typeLabel || root.buildingTypeLabel),
                iconPath: textValue(mosque.iconPath || root.iconPath),
                officialAddress: textValue(mosque.officialAddress || root.officialAddress),
                additionalInfo: textValue(mosque.additionalInfo || root.additionalInfo)
            },
            location: {
                continent: textValue(location.continent || root.continent),
                country: textValue(location.country || root.country),
                province: textValue(location.province || location.adm1 || root.province || root.adm1),
                city: textValue(location.city || location.adm2 || root.city || root.adm2),
                adm0: textValue(location.adm0 || location.country || root.adm0 || root.country),
                adm1: textValue(location.adm1 || location.province || root.adm1 || root.province),
                adm2: textValue(location.adm2 || location.city || root.adm2 || root.city),
                timezone: textValue(location.timezone || root.timezone || 'UTC'),
                latitude,
                longitude,
                coordinateSource: textValue(location.coordinateSource || root.coordinateSource || 'manual'),
                accuracyOrNote: textValue(location.accuracyOrNote || root.coordinateAccuracy)
            },
            gis: root.gis && typeof root.gis === 'object' ? root.gis : {}
        };
    }

    async function fetchActiveMosqueContext() {
        if (!window.fetch) {
            return null;
        }

        const response = await fetch('api/active-mosque.php', {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`active-mosque HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (!payload || payload.success === false || !payload.data) {
            return null;
        }
        if (window.MpmAdminLocation && window.MpmAdminLocation.fromActiveMosque) {
            return window.MpmAdminLocation.fromActiveMosque(payload.data);
        }
        return normalizeReviewerContext(payload.data);
    }

    async function loadAdminContextInternal() {
        state.buildingLinkError = '';
        if (byId('buildingSelectedIdentity')) byId('buildingSelectedIdentity').textContent = '';
        if (!window.MpmBuildingLinks.requested()) {
            state.adminContext = null;
            if (byId('buildingSelectedIdentity')) byId('buildingSelectedIdentity').textContent = '';
            const highlight = state.sources.context && state.sources.context.getFeatureById('building-deep-link-highlight');
            if (highlight) state.sources.context.removeFeature(highlight);
            renderReviewerContext();
            renderContextMarkers();
            if (window.MpmBuildingSelector) window.MpmBuildingSelector.show();
            return null;
        }
        setContextBadge(localized('Memuat DB', 'Loading DB'));
        let context = null;
        try {
            if (window.MpmBuildingLinks && window.MpmBuildingLinks.requested()) {
                context = await window.MpmBuildingLinks.resolve(window.MpmBuildingLinks.requested());
            } else if (window.MpmAdminLocation && window.MpmAdminLocation.resolve) {
                context = await window.MpmAdminLocation.resolve();
            } else {
                context = await fetchActiveMosqueContext();
            }
        } catch (error) {
            if (window.MpmBuildingLinks && window.MpmBuildingLinks.requested()) {
                const key = error.code || 'buildingUnavailable';
                state.buildingLinkError = key;
                state.adminContext = null;
                renderContextMarkers();
                const highlight = state.sources.context && state.sources.context.getFeatureById('building-deep-link-highlight');
                if (highlight) state.sources.context.removeFeature(highlight);
                setHtml('reviewerContextSummary', '<span role="alert" data-i18n="messages.' + escapeHtml(key) + '">' + escapeHtml(window.PrayerI18n.t('messages.' + key)) + '</span>');
                setContextBadge(window.PrayerI18n.t('messages.' + key));
                return null;
            }
            setStatus(`${localized('Gagal membaca konteks admin', 'Failed to read admin context')}: ${error.message}`);
        }

        if (!context) {
            setContextBadge(localized('Data DB kosong', 'No DB data'));
            renderReviewerContext();
            return null;
        }

        setAdminContext(context);
        applyAdminContextToObserver(true);
        if (window.MpmBuildingLinks && window.MpmBuildingLinks.requested() && state.map) {
            state.map.getView().setCenter(ol.proj.fromLonLat([state.observer.lon, state.observer.lat]));
            state.map.getView().setZoom(16);
            if (state.features.building) state.features.building.set('selected', true);
            const highlight = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat([state.observer.lon, state.observer.lat])));
            highlight.setId('building-deep-link-highlight');
            highlight.setStyle(new ol.style.Style({image:new ol.style.Circle({radius:22,fill:new ol.style.Fill({color:'rgba(255,215,0,0.18)'}),stroke:new ol.style.Stroke({color:'#ffd700',width:3})})}));
            const source = state.layers.context.getSource();
            const previous = source.getFeatureById('building-deep-link-highlight');
            if (previous) source.removeFeature(previous);
            source.addFeature(highlight);
            const summary = byId('reviewerContextSummary');
            if (summary && summary.closest('details')) summary.closest('details').open = true;
        }
        return context;
    }

    function loadAdminContext() {
        if (state.adminContextPromise) {
            return state.adminContextPromise;
        }
        state.adminContextPromise = loadAdminContextInternal().finally(() => {
            state.adminContextPromise = null;
        });
        return state.adminContextPromise;
    }

    function setAdminContext(context) {
        const normalized = normalizeReviewerContext(context);
        if (!normalized) {
            setContextBadge(localized('Data DB tidak valid', 'Invalid DB data'));
            return;
        }

        state.adminContext = normalized;
        if (byId('buildingSelectedIdentity')) byId('buildingSelectedIdentity').textContent = [normalized.mosque.name, normalized.mosque.buildingIdentifier].filter(Boolean).join(' · ');
        if (window.MpmTimeCoordinateCalibration) {
            const location = normalized.location || {};
            const mosque = normalized.mosque || {};
            window.MpmTimeCoordinateCalibration.setBuildingCoordinate({
                name: textValue(mosque.name, localized('Gedung aktif', 'Active building')),
                latitude: location.latitude,
                longitude: location.longitude,
                elevation: location.elevation,
                coordinateSource: location.coordinateSource || normalized.source || 'admin-database',
                accuracy: location.coordinateAccuracy,
                accuracyNote: location.accuracyOrNote,
                confirmedByUser: Boolean(location.confirmedByUser || location.coordinateConfirmedAt),
                coordinateStatus: location.confirmedByUser || location.coordinateConfirmedAt ? 'verified' : 'unverified',
                timezone: location.timezone,
                timestamp: normalized.updatedAt
            });
        }
        state.lastEclipseKey = '';
        setContextBadge(displaySourceLabel(normalized.source || 'Database'));
        renderReviewerContext();
        renderContextMarkers();
        loadAdmBoundaries(normalized);
    }

    function applyAdminContextToObserver(center) {
        const point = contextPoint(state.adminContext);
        if (!point) {
            setStatus(localized('Konteks admin belum memiliki koordinat gedung yang valid.', 'Admin context does not have valid building coordinates.'));
            return;
        }

        state.observer.lat = point.lat;
        state.observer.lon = point.lon;
        state.observer.elevation = 0;
        const timezone = state.adminContext && state.adminContext.location
            ? state.adminContext.location.timezone
            : '';
        ensureTimezoneOption(timezone);
        clearComputationCaches();
        state.lastEclipseKey = '';
        writeObserverInputs();
        updateObserverFeature();
        renderContextMarkers();
        if (center && state.map && !(byId('onlineMapToggle') || {}).checked && !(weatherOverlayController && weatherOverlayController.getState().enabled)) {
            centerOnObserver();
        }
        updateAll(true);
        rebuildTrajectory();
        setStatus(localized(
            'Koordinat gedung dari database admin dipakai untuk kalkulasi astronomi dan waktu shalat.',
            'Building coordinates from the admin database are used for astronomy and prayer-time calculations.'
        ));
    }

    function renderReviewerContext() {
        if (state.buildingLinkError) {
            setHtml('reviewerContextSummary', '<span role="alert">' + escapeHtml(window.PrayerI18n.t('messages.' + state.buildingLinkError)) + '</span>');
            return;
        }
        const context = state.adminContext;
        const buildingIcon = byId('buildingContextIcon');
        if (buildingIcon) {
            buildingIcon.src = buildingIconFromContext(context);
        }
        const ipIcon = byId('ipContextIcon');
        if (ipIcon) {
            ipIcon.src = IP_PROVIDER_ICON;
        }
        const kaabahIcon = byId('kaabahContextIcon');
        if (kaabahIcon) {
            kaabahIcon.src = placesIconPath(PLACE_ICONS.kaabah);
        }

        if (!context) {
            setHtml('reviewerContextSummary', `<span>${escapeHtml(window.PrayerI18n.t('selector.question'))}</span>`);
            return;
        }

        const mosque = context.mosque || {};
        const location = context.location || {};
        const point = contextPoint(context);
        const coordinateLabels = point
            ? admLabelsForCoordinate(point.lat, point.lon)
            : {};
        const contextLabels = displayAdmLabels(context);
        const labels = {
            ...contextLabels,
            adm0: coordinateLabels.adm0 || contextLabels.adm0,
            adm1: coordinateLabels.adm1 || contextLabels.adm1,
            adm2: coordinateLabels.adm2 || contextLabels.adm2
        };
        const kaabah = calculateKaabahSpatialComparison();
        const lines = [
            `<span><strong>${escapeHtml(textValue(mosque.name, localized('Gedung aktif', 'Active building')))}</strong> ${escapeHtml(displayBuildingType(mosque.typeLabel || mosque.type))}</span>`,
            `<span><strong>ADM</strong> ${escapeHtml([labels.adm0, labels.adm1, labels.adm2].filter(Boolean).join(' - ') || '-')}</span>`,
            `<span><strong>${escapeHtml(localized('Koordinat', 'Coordinate'))}</strong> ${formatNumber(Number(location.latitude), 6)}, ${formatNumber(Number(location.longitude), 6)} (${escapeHtml(displaySourceLabel(location.coordinateSource || 'manual'))})</span>`,
            `<span><strong>${escapeHtml(localized('Zona waktu', 'Timezone'))}</strong> ${escapeHtml(textValue(location.timezone, getSelectedTimezoneName()))}</span>`,
            `<span><strong>Kaabah</strong> ${formatNumber(kaabah.latitude, 6)}, ${formatNumber(kaabah.longitude, 6)} (${escapeHtml(kaabah.timezone)})</span>`,
            `<span><strong>${escapeHtml(localized('Bangunan ke Kaabah', 'Building to Kaabah'))}</strong> ${formatNumber(kaabah.distanceKm, 2)} km, ${formatDegrees(kaabah.bearingFromBuilding, 2)} ${getCompassDirection(kaabah.bearingFromBuilding)}</span>`
        ];
        if (textValue(mosque.officialAddress)) {
            lines.push(`<span><strong>${escapeHtml(localized('Alamat', 'Address'))}</strong> ${escapeHtml(mosque.officialAddress)}</span>`);
        }
        if (mosque.buildingIdentifier) lines.unshift(`<span><strong>${escapeHtml(localized('Identifier bangunan', 'Building identifier'))}</strong> ${escapeHtml(mosque.buildingIdentifier)}</span>`);
        setHtml('reviewerContextSummary', lines.join(''));
    }

    function setProviderContext(context) {
        state.providerContext = context;
        if (window.MpmTimeCoordinateCalibration) {
            if (context && validCoordinates(context.latitude, context.longitude)) {
                window.MpmTimeCoordinateCalibration.setProviderCoordinate({
                    name: context.org || context.name || context.source || 'Network service provider',
                    operatorType: context.operatorType || 'internet-service-provider',
                    latitude: context.latitude,
                    longitude: context.longitude,
                    elevation: context.elevation,
                    coordinateSource: context.coordinateSource || context.source || 'ipapi.co',
                    coordinateType: context.coordinateType || 'ip-geolocation-estimate',
                    accuracyRadius: context.accuracyRadius,
                    confidence: context.confidence || 'unverified',
                    coordinateStatus: context.coordinateStatus || 'estimated',
                    sourceURL: context.sourceURL || 'https://ipapi.co/',
                    ip: context.ip,
                    city: context.city,
                    region: context.region,
                    country: context.country,
                    timezone: context.timezone,
                    timestamp: context.updatedAt
                });
            }
        }
        renderProviderContext();
        renderContextMarkers();
        if (state.latestSnapshot) {
            updateAll(true);
        }
    }

    async function initProviderContext() {
        if (state.ipComparisonMode === 'off' || !window.fetch) {
            renderProviderContext();
            renderContextMarkers();
            return null;
        }

        if (window.MpmTimeCoordinateCalibration
            && typeof window.MpmTimeCoordinateCalibration.initialize === 'function') {
            await window.MpmTimeCoordinateCalibration.initialize().catch((error) => {
                setStatus(`${localized('Kalibrasi koordinat gagal dimuat', 'Coordinate calibration failed')}: ${error.message}`);
            });
        }
        const calibration = timeCoordinateCalibrationState();
        if (!state.providerContext
            && calibration
            && calibration.provider
            && validCoordinates(calibration.provider.latitude, calibration.provider.longitude)) {
            state.providerContext = calibration.provider;
            renderProviderContext();
            renderContextMarkers();
        }
        renderProviderContext('Loading IP provider');
        try {
            if (window.MpmTimeCoordinateCalibration && typeof window.MpmTimeCoordinateCalibration.discoverProviderCoordinate === 'function') {
                const discovered = await window.MpmTimeCoordinateCalibration.discoverProviderCoordinate();
                if (!discovered) {
                    const lookup = window.MpmTimeCoordinateCalibration.getProviderLookupState?.();
                    throw new Error(lookup?.error || localized('estimasi IP tidak tersedia', 'IP estimate unavailable'));
                }
                const sharedContext = {
                    source: discovered.coordinateSource || 'ipapi.co',
                    sourceURL: discovered.sourceURL || 'https://ipapi.co/',
                    coordinateSource: discovered.coordinateSource || 'ipapi.co',
                    coordinateType: discovered.coordinateType || 'ip-geolocation-estimate',
                    coordinateStatus: discovered.coordinateStatus || 'estimated',
                    accuracyRadius: discovered.accuracyRadius,
                    confidence: discovered.confidence || 'unverified',
                    ip: discovered.ip,
                    org: discovered.name,
                    city: discovered.city,
                    region: discovered.region,
                    country: discovered.country,
                    timezone: discovered.timezone,
                    latitude: discovered.latitude,
                    longitude: discovered.longitude,
                    updatedAt: discovered.timestamp
                };
                setProviderContext(sharedContext);
                return sharedContext;
            }
            const response = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            const context = {
                source: 'ipapi.co',
                ip: textValue(data.ip),
                org: textValue(data.org || data.asn),
                city: textValue(data.city),
                region: textValue(data.region),
                country: textValue(data.country_name || data.country),
                timezone: textValue(data.timezone),
                latitude: Number(data.latitude),
                longitude: Number(data.longitude),
                coordinateSource: 'ipapi.co',
                coordinateType: 'ip-geolocation-estimate',
                coordinateStatus: 'estimated',
                accuracyRadius: null,
                confidence: 'unverified',
                sourceURL: 'https://ipapi.co/',
                updatedAt: actualNow().toISOString()
            };
            if (!validCoordinates(context.latitude, context.longitude)) {
                throw new Error(localized('koordinat IP tidak valid', 'invalid IP coordinates'));
            }
            setProviderContext(context);
            return context;
        } catch (error) {
            const existingProvider = providerPoint();
            if (!existingProvider) {
                state.providerContext = { error: error.message, source: 'ip-provider' };
            }
            renderProviderContext();
            renderContextMarkers();
            return null;
        }
    }

    function renderProviderContext(statusText) {
        if (state.ipComparisonMode === 'off') {
            setHtml('providerContextSummary', `<span><strong>IP provider</strong> ${escapeHtml(localized(
                'Dinonaktifkan. Kalkulasi tetap memakai koordinat gedung.',
                'Disabled. Calculations still use building coordinates.'
            ))}</span>`);
            return;
        }
        if (statusText) {
            setHtml('providerContextSummary', `<span><strong>IP provider</strong> ${escapeHtml(statusText)}</span>`);
            return;
        }

        const provider = state.providerContext;
        if (!provider) {
            setHtml('providerContextSummary', `<span><strong>IP provider</strong> ${escapeHtml(localized(
                'Menunggu estimasi koordinat service provider.',
                'Waiting for service-provider coordinate estimate.'
            ))}</span>`);
            return;
        }
        if (provider.error) {
            setHtml('providerContextSummary', `<span><strong>IP provider</strong> ${escapeHtml(localized('Gagal membaca estimasi', 'Failed to read estimate'))}: ${escapeHtml(provider.error)}. ${escapeHtml(localized(
                'Kalkulasi tetap memakai koordinat gedung.',
                'Calculations still use building coordinates.'
            ))}</span>`);
            return;
        }

        const point = providerPoint();
        const building = contextPoint(state.adminContext) || { lat: state.observer.lat, lon: state.observer.lon };
        const range = point ? haversineKm(building.lat, building.lon, point.lat, point.lon) : NaN;
        const bearing = point ? initialBearing(building.lat, building.lon, point.lat, point.lon) : NaN;
        const lines = [
            `<span><strong>IP provider</strong> ${escapeHtml([provider.city, provider.region, provider.country].filter(Boolean).join(' - ') || provider.source || localized('terdeteksi', 'detected'))}</span>`,
            `<span><strong>${escapeHtml(localized('Koordinat', 'Coordinate'))}</strong> ${point ? `${formatNumber(point.lat, 6)}, ${formatNumber(point.lon, 6)}` : '-'}</span>`,
            `<span><strong>${escapeHtml(localized('Jarak dari gedung', 'Distance from building'))}</strong> ${Number.isFinite(range) ? `${formatNumber(range, 2)} km, ${formatDegrees(bearing, 1)} ${getCompassDirection(bearing)}` : '-'}</span>`,
            `<span><strong>${escapeHtml(localized('Basis', 'Basis'))}</strong> ${escapeHtml(localized(
                'Marker IP hanya pembanding display. Perhitungan shalat memakai koordinat gedung database.',
                'The IP marker is only a display comparison. Prayer calculations use database building coordinates.'
            ))}</span>`
        ];
        setHtml('providerContextSummary', lines.join(''));
    }

    function renderContextMarkers() {
        if (!state.features.building || !state.features.provider || !state.features.calibrationLine || !state.features.kaabah || !state.features.kaabahLine) {
            return;
        }

        const building = contextPoint(state.adminContext);
        const lineOrigin = building || activeBuildingPoint();
        if (building) {
            const mosque = state.adminContext.mosque || {};
            state.features.building.set('label', textValue(mosque.name, 'Building'));
            state.features.building.set('iconPath', buildingIconFromContext(state.adminContext));
            state.features.building.setGeometry(new ol.geom.Point(ol.proj.fromLonLat([building.lon, building.lat])));
        } else {
            state.features.building.setGeometry(null);
        }

        const provider = state.ipComparisonMode === 'off' || !state.showIpMarker ? null : providerPoint();
        if (provider) {
            state.features.provider.set('label', 'IP provider');
            state.features.provider.set('iconPath', IP_PROVIDER_ICON);
            state.features.provider.setGeometry(new ol.geom.Point(ol.proj.fromLonLat([provider.lon, provider.lat])));
        } else {
            state.features.provider.setGeometry(null);
        }

        const calibration = timeCoordinateCalibrationState();
        const calibrationConfig = calibration && calibration.configuration ? calibration.configuration : {};
        const calibrationProvider = calibration && calibration.provider ? calibration.provider : null;
        const calibrationBuilding = calibration && calibration.building ? calibration.building : null;
        const showCalibration = state.showCalibrationLine
            && calibrationConfig.showComparison !== false
            && calibrationConfig.showCalibrationLine !== false
            && calibrationProvider && calibrationBuilding
            && validCoordinates(calibrationProvider.latitude, calibrationProvider.longitude)
            && validCoordinates(calibrationBuilding.latitude, calibrationBuilding.longitude);
        state.features.calibrationLine.setGeometry(showCalibration
            ? new ol.geom.LineString([
                ol.proj.fromLonLat([Number(calibrationProvider.longitude), Number(calibrationProvider.latitude)]),
                ol.proj.fromLonLat([Number(calibrationBuilding.longitude), Number(calibrationBuilding.latitude)])
            ])
            : null);

        const kaabah = kaabahPoint();
        state.features.kaabah.set('label', 'Kaabah');
        state.features.kaabah.set('iconPath', placesIconPath(PLACE_ICONS.kaabah));
        state.features.kaabah.setGeometry(new ol.geom.Point(ol.proj.fromLonLat([kaabah.lon, kaabah.lat])));
        state.features.kaabahLine.setGeometry(state.showKaabahLine
            ? new ol.geom.LineString([
                ol.proj.fromLonLat([lineOrigin.lon, lineOrigin.lat]),
                ol.proj.fromLonLat([kaabah.lon, kaabah.lat])
            ])
            : null);

        if (state.layers.context) {
            state.layers.context.changed();
        }
    }

    function normalizeBoundaryText(value) {
        let normalized = textValue(value).toLowerCase();
        if (typeof normalized.normalize === 'function') {
            normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        normalized = normalized
            .replace(/&/g, ' and ')
            .replace(/\bnothern\b/g, 'northern')
            .replace(/\brep\b/g, 'republic')
            .replace(/\bdem\b/g, 'democratic')
            .replace(/\b(regency|city|district|province|state|special|region|municipality|daerah|istimewa|kabupaten|kota|provinsi|wilayah|administrative|governorate|of|the|and)\b/g, ' ')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        if (!normalized) {
            return '';
        }
        return normalized.split(/\s+/).filter((token, index, tokens) => token && tokens.indexOf(token) === index).sort().join('|');
    }

    function boundaryTextMatches(left, right) {
        const a = normalizeBoundaryText(left);
        const b = normalizeBoundaryText(right);
        if (!a || !b) {
            return false;
        }
        return a === b;
    }

    function boundaryFeatureName(feature) {
        const props = feature.getProperties ? feature.getProperties() : {};
        const keys = ['shapeName', 'NAME_0', 'NAME_1', 'NAME_2', 'name', 'country_name', 'province', 'city'];
        for (let index = 0; index < keys.length; index += 1) {
            const value = textValue(props[keys[index]]);
            if (value) {
                return value;
            }
        }
        return '';
    }

    function boundaryFeatureId(feature) {
        const props = feature.getProperties ? feature.getProperties() : {};
        const keys = ['shapeID', 'shapeId', 'shape_id', 'GID_1', 'GID_2', 'HASC_1', 'HASC_2'];
        for (let index = 0; index < keys.length; index += 1) {
            const value = textValue(props[keys[index]]);
            if (value) {
                return value;
            }
        }
        return '';
    }

    function geoJsonFeaturesFromPayload(payload, level) {
        if (!payload || !Array.isArray(payload.features)) {
            return [];
        }
        const format = new ol.format.GeoJSON();
        return format.readFeatures(payload, { featureProjection: 'EPSG:3857' }).map((feature) => {
            feature.set('admLevel', level);
            return feature;
        });
    }

    const boundaryFlights = new Map();
    function fetchBoundaryFeatures(level, params, targetName, targetId) {
        const key = JSON.stringify([level, Object.entries(params || {}).filter(([,v])=>textValue(v)).sort(), targetName || '', targetId || '', navigator.onLine]);
        if (!boundaryFlights.has(key)) {
            const flight = loadBoundaryFeatures(level, params, targetName, targetId).finally(() => boundaryFlights.delete(key));
            boundaryFlights.set(key, flight);
        }
        return boundaryFlights.get(key);
    }
    async function loadBoundaryFeatures(level, params, targetName, targetId) {
        const search = new URLSearchParams();
        search.set('level', level);
        search.set('hierarchy', 'strict-v5');
        Object.keys(params || {}).forEach((key) => {
            if (textValue(params[key])) {
                search.set(key, params[key]);
            }
        });
        if (!window.MpmAdmBoundary) {
            throw new Error('ADM source client is unavailable.');
        }
        const result = await window.MpmAdmBoundary.fetchGeoJson(`api/adm-boundaries.php?${search.toString()}`);
        const payload = result.geojson;
        let features = geoJsonFeaturesFromPayload(payload, level);
        const staticResolved = String(result.source && result.source.mode || '').includes('static');
        if (!staticResolved && targetId) {
            features = features.filter((feature) => boundaryFeatureId(feature) === textValue(targetId));
        } else if (!staticResolved && targetName && level !== 'adm0') {
            features = features.filter((feature) => boundaryTextMatches(boundaryFeatureName(feature), targetName));
        }
        return { features, source: result.source };
    }

    async function fetchAdm0ContainingPoint(point) {
        if (!point) {
            return { features: [], source: null };
        }
        let payload;
        let source = { mode: 'local-bundled-coordinate', label: 'GeoJSON ADM0 lokal' };
        try {
            const response = await fetch(
                'map/geo/geoBoundariesCGAZ_ADM0.geojson',
                { cache: 'force-cache' }
            );
            if (response.ok) {
                payload = await response.json();
            }
        } catch (error) {
            payload = null;
        }
        if (!payload || !Array.isArray(payload.features) || !payload.features.length) {
            const response = await fetch(
                'map/geo/geob-4ec2.geojson',
                { cache: 'force-cache' }
            );
            if (!response.ok) {
                throw new Error(`GeoJSON ADM0 lokal HTTP ${response.status}`);
            }
            payload = await response.json();
            source = { mode: 'local-bundled-coordinate-lite', label: 'GeoJSON ADM0 lokal lite' };
        }
        const features = geoJsonFeaturesFromPayload(payload, 'adm0')
            .filter((feature) => {
                const geometry = feature.getGeometry();
                return geometry && geometry.intersectsCoordinate(
                    ol.proj.fromLonLat([point.lon, point.lat])
                );
            });
        return { features, source };
    }

    async function loadAdmBoundaries(context) {
        if (!state.sources.adm) {
            return;
        }

        const labels = currentAdmLabels(context);
        adm0Scope.load([labels.countryCode, labels.adm0].join('|'), labels.adm0,
            () => labels.adm0 ? fetchBoundaryFeatures('adm0', { country: labels.adm0, country_iso2: labels.countryCode }, labels.adm0) : Promise.resolve({ features: [] }));
        const mode = state.admBoundaryMode;
        const key = [mode, labels.countryCode, labels.adm0, labels.adm1, labels.adm1Id, labels.adm2, labels.adm2Id].join('|');
        if (mode === 'off') {
            state.admLoadGeneration += 1;
            state.sources.adm.clear();
            state.admLoadKey = key;
            return;
        }
        if (state.admLoadKey === key) {
            return;
        }

        state.admLoadKey = key;
        const generation = ++state.admLoadGeneration;
        try {
            const jobs = labels.adm0
                ? [fetchBoundaryFeatures('adm0', {
                    country: labels.adm0,
                    country_iso2: labels.countryCode
                }, labels.adm0)]
                : [];
            if (labels.adm0 && labels.adm1) {
                jobs.push(fetchBoundaryFeatures('adm1', {
                    country: labels.adm0,
                    country_iso2: labels.countryCode,
                    adm1: labels.adm1,
                    adm1_id: labels.adm1Id
                }, labels.adm1, labels.adm1Id));
            }
            if (labels.adm0 && mode === 'adm0-adm1-adm2' && labels.adm1 && labels.adm2) {
                jobs.push(fetchBoundaryFeatures('adm2', {
                    country: labels.adm0,
                    country_iso2: labels.countryCode,
                    adm1: labels.adm1,
                    adm1_id: labels.adm1Id,
                    adm2: labels.adm2,
                    adm2_id: labels.adm2Id
                }, labels.adm2, labels.adm2Id));
            }

            let grouped = await Promise.all(jobs);
            const point = contextPoint(context);
            const coordinate = point
                ? ol.proj.fromLonLat([point.lon, point.lat])
                : null;
            const adm0ContainsPoint = grouped.length
                && grouped[0].features.some((feature) => {
                    const geometry = feature.getGeometry();
                    return geometry && coordinate && geometry.intersectsCoordinate(coordinate);
                });
            if (!adm0ContainsPoint && point) {
                const fallback = await fetchAdm0ContainingPoint(point);
                if (fallback.features.length) {
                    grouped = [fallback, ...grouped.slice(1)];
                }
            }
            if (generation !== state.admLoadGeneration || state.admLoadKey !== key) {
                return;
            }
            const features = grouped.flatMap((group) => group.features);
            const sourceLabels = Array.from(new Set(grouped.map((group) => (
                window.MpmAdmBoundary.sourceLabel(group.source, document.documentElement.lang || 'id')
            ))));
            state.sources.adm.clear();
            state.sources.adm.addFeatures(features);
            state.layers.adm.setVisible(byId('admBoundaryToggle').checked);
            renderContextMarkers();
            renderReviewerContext();
            state.map.render();
            if (features.length && state.map && !window.MpmBuildingLinks.requested() && !(byId('onlineMapToggle') || {}).checked && !(weatherOverlayController && weatherOverlayController.getState().enabled)) {
                const extent = state.sources.adm.getExtent();
                if (extent && extent.every(Number.isFinite)) {
                    state.map.getView().fit(extent, {
                        padding: [80, 450, 60, 60],
                        duration: 450,
                        maxZoom: 11
                    });
                }
            }
            setStatus(`${localized('ADM reviewer dimuat', 'Reviewer ADM loaded')}: ${features.length} ${localized('boundary', 'boundaries')} · ${sourceLabels.join(' / ')}.`);
        } catch (error) {
            if (generation !== state.admLoadGeneration || state.admLoadKey !== key) {
                return;
            }
            state.sources.adm.clear();
            setStatus(`${localized('ADM reviewer gagal dimuat', 'Reviewer ADM failed to load')}: ${error.message}`);
        }
    }

    function locateDevice() {
        if (!navigator.geolocation) {
            setStatus(localized('Geolocation tidak tersedia di browser ini.', 'Geolocation is not available in this browser.'));
            return;
        }

        navigator.geolocation.getCurrentPosition((position) => {
            if (state.reviewerMode === 'display' && state.adminContext) {
                setProviderContext({
                    source: 'device-geolocation',
                    city: '',
                    region: '',
                    country: '',
                    timezone: '',
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    updatedAt: actualNow().toISOString()
                });
                setStatus(localized(
                    'Lokasi perangkat ditampilkan sebagai pembanding. Kalkulasi tetap memakai koordinat gedung.',
                    'Device location is shown as a comparison. Calculations still use building coordinates.'
                ));
                return;
            }

            state.observer.lat = position.coords.latitude;
            state.observer.lon = position.coords.longitude;
            state.observer.elevation = Number.isFinite(position.coords.altitude) ? position.coords.altitude : 0;
            clearComputationCaches();
            writeObserverInputs();
            updateObserverFeature();
            renderContextMarkers();
            centerOnObserver();
            updateAll(true);
            rebuildTrajectory();
        }, (error) => {
            setStatus(`${localized('Geolocation gagal', 'Geolocation failed')}: ${error.message}`);
        }, {
            enableHighAccuracy: true,
            timeout: 9000
        });
    }

    function handlePointerMove(event) {
        if (!event.coordinate) {
            return;
        }

        const lonLat = ol.proj.toLonLat(event.coordinate);
        byId('coordinateBadge').textContent =
            `Lon ${formatNumber(normalizeLon(lonLat[0]), 4)}, Lat ${formatNumber(clamp(lonLat[1], -90, 90), 4)}`;
    }

    function clickableFeatureAtPixel(pixel) {
        if (!state.map || !pixel) {
            return null;
        }
        const candidates = [];
        state.map.forEachFeatureAtPixel(pixel, (feature) => {
            const kind = feature && feature.get ? feature.get('kind') : '';
            const geometry = feature && feature.getGeometry ? feature.getGeometry() : null;
            const geometryType = geometry && geometry.getType ? geometry.getType() : '';
            const supportedGeometry = geometry && (geometryType === 'Point'
                || (['earthquake-impact-ring', 'air-quality-circle'].includes(kind) && geometryType === 'Polygon')
                || (kind === 'provider-building-calibration' && geometryType === 'LineString')
                || (kind === 'wildfire' && (geometryType === 'Polygon' || geometryType === 'MultiPolygon'))
                || (kind === 'natural-earth' && ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(geometryType))
                || (kind === 'online-noaa-hazard' && ['Polygon', 'MultiPolygon'].includes(geometryType))
                || kind === 'online-volcano');
            if ((!CLICKABLE_ICON_KINDS.has(kind) && kind !== 'earthquake-impact-ring' && kind !== 'natural-earth' && kind !== 'online-earthquake' && kind !== 'online-firms' && kind !== 'online-noaa-hazard' && kind !== 'online-volcano' && kind !== 'online-air-quality' && kind !== 'air-quality-circle') || !supportedGeometry) {
                return undefined;
            }
            candidates.push(feature);
            return undefined;
        }, {
            hitTolerance: 8
        });
        if (!candidates.length) {
            return null;
        }
        const activeTab = document.querySelector('[data-tab].active');
        const tabName = activeTab ? activeTab.dataset.tab : '';
        const preferredKinds = tabName === 'weather'
            ? new Set(['weather', 'temperature', 'cloud-condition'])
            : new Set([tabName]);
        const onlineFeature = candidates.find((feature) => String(feature.get('kind') || '').indexOf('online-') === 0
            && feature.getGeometry().getType() === 'Point');
        const marker = candidates.find((feature) => feature.get('kind') !== 'earthquake-impact-ring'
            && feature.get('kind') !== 'natural-earth' && preferredKinds.has(feature.get('kind')))
            || candidates.find((feature) => feature.getGeometry().getType() === 'Point');
        return onlineFeature || marker || candidates.find((feature) => feature.get('kind') === 'earthquake-impact-ring')
            || candidates.find((feature) => preferredKinds.has(feature.get('kind'))) || candidates[0];
    }

    function buildFeatureInfoHtml(feature) {
        const kind = feature && feature.get ? feature.get('kind') : '';
        if (kind === 'online-air-quality' || kind === 'air-quality-circle') return airQualityController.popupHtml(feature);
        const suppliedHtml = feature && feature.get ? textValue(feature.get('infoHtml')) : '';
        if (suppliedHtml) {
            return suppliedHtml;
        }
        if (kind === 'sun') {
            return buildSunInfoHtml();
        }
        if (kind === 'moon') {
            return buildMoonInfoHtml();
        }
        if (kind === 'timeline') {
            return buildTimelineInfoHtml();
        }
        if (kind === 'building') {
            return buildBuildingInfoHtml();
        }
        if (kind === 'ip-provider') {
            return buildProviderInfoHtml();
        }
        if (kind === 'provider-building-calibration') {
            return buildCalibrationLineInfoHtml();
        }
        if (kind === 'kaabah-line') {
            return buildKaabahLineInfoHtml();
        }
        if (kind === 'kaabah') {
            return buildKaabahInfoHtml();
        }
        if (kind === 'solar-eclipse') {
            return buildEclipseInfoHtml(feature.get('eclipse'));
        }
        if (kind === 'lunar-eclipse') {
            return buildEclipseInfoHtml(feature.get('eclipse'));
        }
        if (kind === 'observer') {
            return infoBoxHtml(localized('Lokasi Observasi Rukyat', 'Rukyat Observation Location'), [
                { label: localized('Koordinat', 'Coordinate'), value: formatCoordinatePair(state.observer.lat, state.observer.lon, 6) },
                { label: localized('Elevasi', 'Elevation'), value: `${formatNumber(state.observer.elevation || 0, 0)} m` },
                { label: localized('Zona waktu', 'Timezone'), value: getSelectedTimezoneName() },
                { label: localized('Basis', 'Basis'), value: state.adminContext ? localized('Database admin / observasi aktif', 'Admin database / active observation') : localized('Observer manual', 'Manual observer') }
            ]);
        }
        if (kind === 'natural-earth') {
            const clickCoordinate = feature.get('naturalEarthClickCoordinate');
            let relatedFeature = null;
            if (Array.isArray(clickCoordinate)) {
                const namedSources = ['naturalEarth:marinePolys', 'naturalEarth:lakes', 'naturalEarth:rivers'];
                namedSources.some((sourceKey) => {
                    const source = state.sources[sourceKey];
                    relatedFeature = source && source.getFeatures().find((candidate) => {
                        const geometry = candidate.getGeometry();
                        return geometry && geometry.intersectsCoordinate && geometry.intersectsCoordinate(clickCoordinate)
                            && (textValue(candidate.get('name_id')) || textValue(candidate.get('name')) || textValue(candidate.get('name_en')));
                    });
                    return Boolean(relatedFeature);
                });
            }
            const properties = relatedFeature && relatedFeature.getProperties
                ? relatedFeature.getProperties()
                : (feature.getProperties ? feature.getProperties() : {});
            const featureProperties = feature.getProperties ? feature.getProperties() : {};
            const layerType = textValue(feature.get('naturalEarthKey')).replace(/([A-Z])/g, ' $1').trim();
            let label = textValue(properties.name_id) || textValue(properties.name) || textValue(properties.name_en)
                || textValue(properties.label) || (relatedFeature ? '' : textValue(properties.featurecla))
                || (layerType ? localized(`Feature ${layerType}`, `${layerType} feature`) : localized('Feature Natural Earth', 'Natural Earth feature'));
            if (state.reviewerLanguage === 'id' && label === 'Selat Melaka') {
                label = 'Selat Malaka';
            }
            const type = textValue(properties.featurecla) || textValue(featureProperties.featurecla) || textValue(feature.get('naturalEarthLabel'));
            const rows = [
                { label: localized('Nama', 'Name'), value: label },
                { label: localized('Layer', 'Layer'), value: layerType || localized('Natural Earth', 'Natural Earth') },
                { label: localized('Jenis geometri', 'Geometry type'), value: feature.getGeometry().getType() },
                { label: localized('Jenis', 'Type'), value: type || localized('Tidak diketahui', 'Unknown') }
            ];
            if (Array.isArray(clickCoordinate)) {
                const clickLonLat = ol.proj.toLonLat(clickCoordinate);
                rows.push({ label: localized('Koordinat klik', 'Clicked coordinate'), value: formatCoordinatePair(clickLonLat[1], clickLonLat[0], 6) });
            }
            const extent = feature.getGeometry().getExtent();
            if (extent && extent.every(Number.isFinite)) {
                const center = ol.proj.toLonLat(ol.extent.getCenter(extent));
                rows.push({ label: localized('Titik tengah feature', 'Feature center'), value: formatCoordinatePair(center[1], center[0], 6) });
            }
            const id = textValue(properties.wikidataid) || textValue(properties.ne_id)
                || textValue(featureProperties.wikidataid) || textValue(featureProperties.ne_id);
            if (id) {
                rows.push({ label: 'ID', value: id });
            }
            return infoBoxHtml(localized('Informasi Lokasi', 'Location Information'), rows);
        }
        if (kind === 'online-volcano') {
            return volcanoController ? volcanoController.popupHtml(feature) : '';
        }
        if (kind === 'online-earthquake' || kind === 'online-firms' || kind === 'online-noaa-hazard') {
            const properties = feature.getProperties ? feature.getProperties() : {};
            const earthquakeClassification = feature.get('earthquakeClassification') || {};
            if (kind === 'online-earthquake') {
                const coordinate = feature.getGeometry().getCoordinates();
                const lonLat = ol.proj.toLonLat(coordinate);
                const magnitude = window.MpmEarthquakeRadius.describe({ magnitude: properties.mag }).magnitude;
                const eventTime = Number(properties.time);
                const date = properties.time !== null && properties.time !== undefined && Number.isFinite(eventTime) ? new Date(eventTime) : null;
                const bmkg = properties.source === 'BMKG';
                const sourceUrl = /^https:\/\/(?:[a-z0-9-]+\.)*(?:usgs\.gov|bmkg\.go\.id)\//i.test(String(properties.url || '')) ? String(properties.url) : 'https://earthquake.usgs.gov/earthquakes/map/';
                const html = infoBoxHtml(bmkg ? 'Informasi Gempa BMKG' : 'USGS Earthquake Information', [
                    { label: 'Event ID', value: feature.getId() || properties.code || feature.get('popupKey') },
                    { label: localized('Lokasi', 'Place'), value: textValue(properties.place) || textValue(properties.title) },
                    { label: localized('Waktu', 'Time'), value: date && Number.isFinite(date.getTime()) ? date.toLocaleString() : localized('Tidak tersedia', 'Unavailable') },
                    { label: localized('Magnitudo', 'Magnitude'), value: magnitude === null ? localized('Tidak tersedia', 'Unavailable') : `${magnitude} ${textValue(properties.magType)}` },
                    { label: localized('Kedalaman', 'Depth'), value: Number.isFinite(coordinate[2]) ? `${coordinate[2]} km` : localized('Tidak tersedia', 'Unavailable') },
                    { label: localized('Koordinat pusat', 'Epicenter coordinates'), value: formatCoordinatePair(lonLat[1], normalizeLon(lonLat[0]), 6) },
                    { label: localized('Jenis gempa', 'Earthquake type'), value: textValue(earthquakeClassification.typeLabel) },
                    { label: localized('Pusat gempa', 'Epicenter environment'), value: textValue(earthquakeClassification.environmentLabel) },
                    { label: localized('Laporan dirasakan', 'Felt reports'), value: properties.felt === null || properties.felt === undefined ? localized('Tidak tersedia', 'Unavailable') : String(properties.felt) },
                    { label: 'Status', value: textValue(properties.status) },
                    { label: 'Tsunami', value: bmkg ? (textValue(properties.potential) || localized('Tidak tersedia', 'Unavailable')) : properties.tsunami === 1 ? localized('Ya', 'Yes') : (properties.tsunami === 0 ? localized('Tidak', 'No') : localized('Tidak tersedia', 'Unavailable')) }
                ]);
                return `${html}<p><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${bmkg ? 'BMKG · Badan Meteorologi, Klimatologi, dan Geofisika' : 'U.S. Geological Survey'} · ${localized('Detail gempa', 'Event details')}</a></p>`;
            }
            const rows = kind === 'online-firms'
                ? [
                    { label: 'Ukuran titik api', value: textValue(properties.fireSize) || 'Menengah' },
                    { label: 'FRP', value: properties.frp !== undefined ? `${properties.frp} MW` : 'Tidak tersedia' },
                    ...Object.keys(properties)
                        .filter((key) => !['geometry', 'fireSize', 'fireSizeKey', 'frp'].includes(key) && properties[key] !== '' && properties[key] !== null && properties[key] !== undefined)
                        .slice(0, 14)
                        .map((key) => ({ label: key, value: String(properties[key]) }))
                ]
                : [
                    { label: 'Nama', value: textValue(properties.place) || textValue(properties.title) || textValue(feature.get('label')) },
                    { label: 'Magnitudo', value: properties.mag !== undefined ? String(properties.mag) : 'Tidak tersedia' },
                    { label: 'Jenis gempa', value: textValue(earthquakeClassification.typeLabel) || 'Tektonik' },
                    { label: 'Pusat gempa', value: textValue(earthquakeClassification.environmentLabel) || 'Darat' },
                    { label: 'Ikon', value: textValue(earthquakeClassification.iconPath).split('/').pop() || 'quake-land.png' },
                    ...Object.keys(properties)
                    .filter((key) => key !== 'geometry' && properties[key] !== '' && properties[key] !== null && properties[key] !== undefined)
                    .slice(0, 16)
                    .map((key) => ({ label: key, value: String(properties[key]) }))
                ];
            return infoBoxHtml(
                kind === 'online-earthquake' ? 'USGS Earthquake Information' : (kind === 'online-firms' ? 'FireMap.live Hotspot Information' : 'NOAA Hazard Information'),
                rows
            );
        }
        if (kind === 'weather-storm') {
            const link = textValue(feature.get('link'));
            const popup = infoBoxHtml('NOAA/NHC Current Storm', [
                { label: 'Storm', value: textValue(feature.get('label')) },
                { label: 'Source', value: 'NOAA/NHC CurrentStorms.json' }
            ]);
            return `${popup}<p><a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Official track metadata</a></p>`;
        }
        return '';
    }

    function featurePopupCoordinate(feature, preferredCoordinate) {
        if (Array.isArray(preferredCoordinate) && preferredCoordinate.length >= 2) {
            return preferredCoordinate;
        }
        const geometry = feature && feature.getGeometry ? feature.getGeometry() : null;
        if (!geometry) {
            return null;
        }
        if (geometry.getType && geometry.getType() === 'Point') {
            return geometry.getCoordinates();
        }
        if (geometry.getClosestPoint && state.map && state.map.getView) {
            return geometry.getClosestPoint(state.map.getView().getCenter());
        }
        return geometry.getExtent ? ol.extent.getCenter(geometry.getExtent()) : null;
    }

    function presentMapFeatureInfo(feature, options) {
        const settings = options && typeof options === 'object' ? options : {};
        if (!feature || !feature.getGeometry || !state.map) {
            return { shown: false, html: '', coordinate: null, kind: '' };
        }
        const coordinate = featurePopupCoordinate(feature, settings.coordinate);
        const suppliedHtml = typeof settings.html === 'string' ? settings.html : '';
        let html = suppliedHtml || buildFeatureInfoHtml(feature);
        if (!coordinate || !html) {
            return { shown: false, html, coordinate, kind: feature.get ? feature.get('kind') : '' };
        }
        if (suppliedHtml && feature.set && settings.persistHtml !== false) {
            feature.set('infoHtml', suppliedHtml, true);
        }
        const source = settings.source || 'programmatic-focus';
        if (window.MpmEarthquakeRadius) {
            window.MpmEarthquakeRadius.prepareFeature(feature, source);
            html = window.MpmEarthquakeRadius.popupHtml(feature, html);
        }
        setActivePopupFeature(feature);
        showMapInfoPopup(coordinate, html);
        ensureMapInfoPopup().dataset.focusSource = source;
        const kind = feature.get ? feature.get('kind') : '';
        const label = feature.get ? (feature.get('label') || kind) : kind;
        if (settings.updateStatus !== false) {
            setStatus(`${localized('Info ditampilkan', 'Info displayed')}: ${label}`);
        }
        if (settings.dispatchEvent !== false) {
            window.dispatchEvent(new CustomEvent('mpm:astro-feature-focused', {
                detail: { feature, kind, source }
            }));
        }
        return { shown: true, html, coordinate, kind, source };
    }

    function basemapFeatureAtPixel(pixel, coordinate) {
        const bases = ['osm', 'fiord', 'positron', 'dark'].map((key) => state.layers[key]).filter(Boolean);
        const interactiveBasemaps = bases.concat([
            state.layers.topoFeatures,
            state.layers.satFeatures
        ].filter(Boolean));
        const hits = [];
        state.map.forEachFeatureAtPixel(pixel, (item, layer) => {
            if (!interactiveBasemaps.includes(layer) || !item.getProperties) return;
            const props = item.getProperties();
            const name = props['name:' + (document.documentElement.lang || 'id')] || props.name || props['name:latin'] || props.name_en;
            if (typeof name !== 'string' || !name.trim()) return;
            const geometry = item.getGeometry && item.getGeometry();
            hits.push({ props, name, point: geometry && /Point/.test(geometry.getType()), layer });
        }, { hitTolerance: 6, layerFilter: (layer) => interactiveBasemaps.includes(layer) });
        const hit = hits.find((item) => item.point) || hits[0];
        if (!hit) return null;
        const lonLat = ol.proj.toLonLat(coordinate);
        const rows = [
            { label: 'Nama', value: hit.name },
            { label: 'Kategori', value: hit.props.class || hit.props.layer || '-' },
            { label: 'Jenis', value: hit.props.subclass || hit.props.brunnel || '-' },
            { label: 'Koordinat klik', value: formatCoordinatePair(lonLat[1], normalizeLon(lonLat[0]), 6) },
            {
                label: 'Sumber',
                value: hit.layer === state.layers.topoFeatures
                    ? 'CyclOSM / OpenFreeMap / OpenMapTiles / OpenStreetMap'
                    : hit.layer === state.layers.satFeatures
                        ? 'Google Satellite / OpenFreeMap / OpenMapTiles / OpenStreetMap'
                        : 'OpenFreeMap / OpenMapTiles / OpenStreetMap'
            }
        ];
        [['ref', 'Referensi'], ['ele', 'Elevasi (m)'], ['height', 'Tinggi (m)'], ['housenumber', 'Nomor bangunan']].forEach(([key, label]) => {
            const value = hit.props[key];
            if ((typeof value === 'string' && value.trim()) || (typeof value === 'number' && Number.isFinite(value))) rows.push({ label, value: String(value) });
        });
        // Vector-tile RenderFeatures are read-only source objects. Use a popup
        // anchor at the click without mutating the tile's geometry/properties.
        return new ol.Feature({ geometry: new ol.geom.Point(coordinate), kind: 'basemap-feature',
            label: hit.name, popupKey: 'basemap:' + coordinate.join(','),
            infoHtml: infoBoxHtml(hit.name, rows) });
    }

    function handleMapClick(event) {
        const feature = clickableFeatureAtPixel(event.pixel);
        if (feature && feature.get('kind') !== 'natural-earth') {
            if (['online-air-quality', 'air-quality-circle'].includes(feature.get('kind'))) {
                airQualityController.focus(feature.get('airParent') || feature); return;
            }
            if (feature.get('kind') === 'earthquake-impact-ring') {
                const parent = feature.get('earthquakeParent');
                if (parent) presentMapFeatureInfo(parent, { coordinate: event.coordinate, source: 'earthquake-radius-click' });
                return;
            }
            if (feature.get('kind') === 'natural-earth') {
                feature.set('naturalEarthClickCoordinate', event.coordinate, true);
            }
            presentMapFeatureInfo(feature, {
                coordinate: event.coordinate,
                source: 'map-click'
            });
            return;
        }

        if (weatherOverlayController && weatherOverlayController.handleMapClick(event)) return;
        const basemapFeature = basemapFeatureAtPixel(event.pixel, event.coordinate);
        if (basemapFeature) {
            presentMapFeatureInfo(basemapFeature, { coordinate: event.coordinate, source: 'basemap-click' });
            return;
        }
        if (feature) {
            feature.set('naturalEarthClickCoordinate', event.coordinate, true);
            presentMapFeatureInfo(feature, { coordinate: event.coordinate, source: 'map-click' });
            return;
        }

        if (state.layers && state.layers.onlineOverlay && state.layers.onlineOverlay.getVisible()) {
            const select = byId('onlineMapSelect');
            const mapKey = select ? select.value : 'firemap';
            const config = ONLINE_MAPS[mapKey];
            const dataKey = config && config.data && config.data[0] ? config.data[0][0] : '';
            if (mapKey === 'air-quality') { setStatus('Pilih penanda AQI untuk melihat data dan poly-circle.'); return; }
            if (mapKey === 'firemap') {
                if (onlineLocal() && !adm0Scope.contains(event.coordinate)) {
                    setStatus('Lokasi di luar cakupan ADM0 negara terpilih.');
                    return;
                }
                const lonLat = ol.proj.toLonLat(event.coordinate);
                const point = new ol.Feature({
                    geometry: new ol.geom.Point(event.coordinate),
                    kind: 'online-location',
                    label: `${mapKey} ${dataKey}`
                });
                const endpoint = mapKey === 'air-quality'
                    ? `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lonLat[1]}&longitude=${lonLat[0]}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi`
                    : `https://api.open-meteo.com/v1/forecast?latitude=${lonLat[1]}&longitude=${lonLat[0]}&current=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,precipitation`;
                const query = fetch(endpoint).then((response) => response.json());
                query.then((payload) => {
                    const values = payload.current || {};
                    point.set('infoHtml', infoBoxHtml(
                        `${mapKey} · ${dataKey}`,
                        [
                            { label: 'Coordinate', value: formatCoordinatePair(lonLat[1], lonLat[0], 6) },
                            { label: 'Selected data', value: dataKey },
                            ...Object.keys(values).map((key) => ({ label: key, value: String(values[key]) }))
                        ]
                    ), true);
                    presentMapFeatureInfo(point, { coordinate: event.coordinate, source: 'online-overlay-click' });
                }).catch((error) => setStatus(`Online data query failed: ${error.message}`));
                return;
            }
        }

        hideMapInfoPopup();
        // Map inspection never changes the observation/building coordinate.
        // Location changes use the explicit observer controls or admin context.
    }

    async function syncNetworkTime() {
        updateConnectivityBadge();
        const badge = byId('networkBadge');
        badge.textContent = localized('Sinkron', 'Syncing');

        if (window.MpmActualTime && typeof window.MpmActualTime.snapshot === 'function') {
            const authority = window.MpmActualTime.snapshot();
            const authorityState = authority.state || {};
            const networkTime = authorityState.networkTime || {};
            state.networkOffsetMs = 0;
            state.networkSource = authorityState.activeSourceMode === 'online_network'
                ? (networkTime.sourceName || 'Actual Time Authority - online')
                : (authorityState.activeSourceMode === 'manual_user'
                    ? 'Actual Time Authority - manual user'
                    : 'Actual Time Authority - server/device fallback');
            badge.textContent = authorityState.activeSourceMode === 'online_network'
                ? localized('Waktu online', 'Online time')
                : (authorityState.activeSourceMode === 'manual_user'
                    ? localized('Waktu manual', 'Manual time')
                    : localized('Waktu fallback', 'Fallback time'));
            setStatus(localized(
                'Astronomi memakai otoritas waktu bersama; koreksi jaringan lama tidak ditambahkan dua kali.',
                'Astronomy uses the shared time authority; the legacy network correction is not applied twice.'
            ));
            updateAll(true);
            return;
        }

        try {
            const start = Date.now();
            const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', {
                cache: 'no-store'
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            const end = Date.now();
            const serverMs = Date.parse(data.utc_datetime);
            if (!Number.isFinite(serverMs)) {
                throw new Error(localized('Respons waktu tidak valid', 'Invalid time response'));
            }

            state.networkOffsetMs = serverMs + (end - start) / 2 - end;
            state.networkSource = 'WorldTimeAPI UTC';
            badge.textContent = `Network ${formatSignedSeconds(state.networkOffsetMs / 1000)}`;
            setStatus(localized('Waktu jaringan tersinkron.', 'Network time is synced.'));
            updateAll(true);
        } catch (error) {
            state.networkOffsetMs = 0;
            state.networkSource = 'Device clock';
            badge.textContent = localized('Jam perangkat', 'Device clock');
            setStatus(`${localized('Sinkron jaringan gagal, memakai jam perangkat.', 'Network sync failed; using device clock.')} ${error.message}`);
            updateAll(true);
        }
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

    function getHorizontal(body, date, lat, lon, elevation) {
        const observer = new Astronomy.Observer(lat, lon, elevation || 0);
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
        const sunHorizontal = getHorizontal(
            Astronomy.Body.Sun,
            date,
            state.observer.lat,
            state.observer.lon,
            state.observer.elevation
        );
        const moonHorizontal = getHorizontal(
            Astronomy.Body.Moon,
            date,
            state.observer.lat,
            state.observer.lon,
            state.observer.elevation
        );
        const sunIllumination = Astronomy.Illumination(Astronomy.Body.Sun, date);
        const moonIllumination = Astronomy.Illumination(Astronomy.Body.Moon, date);
        const phaseDegrees = Astronomy.MoonPhase(date);
        const phaseAngle = Math.min(normalize360(phaseDegrees), 360 - normalize360(phaseDegrees));
        const conjunction = estimateIjtimak(date, phaseDegrees);

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
                phaseDegrees,
                phaseAngle,
                phaseName: getMoonPhaseName(phaseDegrees),
                conjunction
            }
        };
    }

    function getMoonPhaseName(phaseDegrees) {
        const phase = normalize360(phaseDegrees) / 360;

        if (phase < 0.02 || phase >= 0.98) {
            return localized('Bulan baru', 'New Moon');
        }
        if (phase < 0.09) {
            return 'Hilal';
        }
        if (phase < 0.24) {
            return localized('Sabit muda', 'Waxing Crescent');
        }
        if (phase < 0.31) {
            return localized('Kuartal pertama', 'First Quarter');
        }
        if (phase < 0.48) {
            return localized('Cembung membesar', 'Waxing Gibbous');
        }
        if (phase < 0.56) {
            return localized('Purnama', 'Full Moon');
        }
        if (phase < 0.73) {
            return localized('Cembung mengecil', 'Waning Gibbous');
        }
        if (phase < 0.81) {
            return localized('Kuartal terakhir', 'Last Quarter');
        }
        if (phase < 0.94) {
            return localized('Sabit tua', 'Waning Crescent');
        }

        return localized('Sabit akhir', 'Old Crescent');
    }

    function estimateIjtimak(date, phaseDegrees) {
        const phase = normalize360(phaseDegrees) / 360;
        const previous = new Date(date.getTime() - phase * SYNODIC_MONTH_DAYS * 86400000);
        const next = new Date(previous.getTime() + SYNODIC_MONTH_DAYS * 86400000);
        const ageHours = (date.getTime() - previous.getTime()) / 3600000;

        return {
            previous,
            next,
            ageHours
        };
    }

    function altitudeFromSubpoint(lat, lon, subLat, subLon) {
        const latRad = degToRad(lat);
        const subLatRad = degToRad(subLat);
        const hourAngleRad = degToRad(normalize180(lon - subLon));
        const sinAltitude =
            Math.sin(latRad) * Math.sin(subLatRad)
            + Math.cos(latRad) * Math.cos(subLatRad) * Math.cos(hourAngleRad);

        return radToDeg(Math.asin(clamp(sinAltitude, -1, 1)));
    }

    function getCompassDirection(azimuth) {
        const index = Math.round(normalize360(azimuth) / 22.5) % 16;
        const direction = COMPASS_16[index];
        return `${compassAbbreviation(direction)} / ${compassName(direction)}`;
    }

    function updateAll(forceOverlays) {
        if(applyingPresentation)return;
        try {
            const date = getRenderDate();
            const snapshot = getBodySnapshot(date);
            state.latestSnapshot = snapshot;

            updateBodyMarkers(snapshot);
            renderDynamicOverlays(snapshot, Boolean(forceOverlays));
            renderPanels(snapshot);
            state.layers.bodies.changed();

            setStatus(`${localized('Render', 'Render')} ${formatUtc(date)} ${localized('dari', 'from')} ${localizedNetworkSource(state.networkSource)}`);
        } catch (error) {
            setStatus(error.message || localized('Kalkulasi astronomi gagal.', 'Astronomical calculation failed.'));
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
        state.features.timeline.getGeometry().setCoordinates(ol.proj.fromLonLat([
            snapshot.sun.subpoint.lon,
            snapshot.sun.subpoint.lat
        ]));
        updateObserverFeature();
    }

    function renderDynamicOverlays(snapshot, force) {
        const dateKey = snapshot.date.toISOString().slice(0, 19);
        const observerKey = `${state.observer.lat.toFixed(3)},${state.observer.lon.toFixed(3)}`;

        // At 1440 pixels around Earth, ten seconds of rotation is less than 0.2 pixel.
        // Numeric positions and clocks still update every second; only this raster is throttled.
        const atmosphereKey = `${Math.floor(snapshot.date.getTime() / 10000)}|${snapshot.moon.illumination.toFixed(3)}`;
        if (state.layers.atmosphere.getVisible() && (force || atmosphereKey !== state.lastAtmosphereKey)) {
            renderAtmosphereOverlay(snapshot);
            state.lastAtmosphereKey = atmosphereKey;
        }

        const prayerKey = `${dateKey.slice(0, 16)}|${getSelectedTimezoneOffset(snapshot.date)}|${observerKey}`;
        if (state.layers.prayer.getVisible() && (force || prayerKey !== state.lastPrayerZoneKey)) {
            renderPrayerZoneOverlay(snapshot);
            state.lastPrayerZoneKey = prayerKey;
        }

        const hilalKey = `${dateKey.slice(0, 16)}|${snapshot.moon.phaseDegrees.toFixed(2)}`;
        if (state.layers.hilal.getVisible() && (force || hilalKey !== state.lastHilalKey)) {
            renderHilalOverlay(snapshot);
            state.lastHilalKey = hilalKey;
        }
    }

    function renderAtmosphereOverlay(snapshot) {
        const canvas = createOverlayCanvas(OVERLAY_SIZES.atmosphere);
        const context = canvas.getContext('2d');
        const imageData = context.createImageData(canvas.width, canvas.height);
        const data = imageData.data;
        const method = prayerMethodConfig(byId('prayerMethod').value);
        const asr = asrMethodConfig(byId('asrMadhab').value);
        renderAtmosphereLegend(method, asr);

        for (let y = 0; y < canvas.height; y += 1) {
            const lat = latitudeForCanvasY(y, canvas.height);
            const grading = window.MpmAtmosphereGrading.build(lat, snapshot.sun.subpoint.lat, method.fajrAngle, asr.shadowFactor);
            for (let x = 0; x < canvas.width; x += 1) {
                const lon = -180 + (x / (canvas.width - 1)) * 360;
                const moonAltitude = altitudeFromSubpoint(
                    lat,
                    lon,
                    snapshot.moon.subpoint.lat,
                    snapshot.moon.subpoint.lon
                );
                const color = grading.sample(normalize180(lon - snapshot.sun.subpoint.lon), moonAltitude, snapshot.moon.illumination);
                const index = (y * canvas.width + x) * 4;
                data[index] = color[0];
                data[index + 1] = color[1];
                data[index + 2] = color[2];
                data[index + 3] = color[3];
            }
        }

        context.putImageData(imageData, 0, 0);
        setImageLayerFromCanvas(state.layers.atmosphere, canvas);
    }

    function renderAtmosphereLegend(method, asr) {
        let legend = byId('atmosphereGradingLegend');
        if (!legend) {
            legend = document.createElement('details');
            legend.id = 'atmosphereGradingLegend';
            legend.className = 'atmosphere-grading-legend';
            const summary = document.createElement('summary');
            summary.textContent = localized('Gradasi siang–malam · detail fase', 'Day/night gradient · phase details');
            const strip = document.createElement('div');
            strip.className = 'atmosphere-grading-strip';
            strip.style.background = 'linear-gradient(to right, ' + window.MpmAtmosphereGrading.phases.filter(p => p.id !== 'false').map(p => p.hex).concat('#6679ae').join(', ') + ')';
            summary.appendChild(strip);
            const note = document.createElement('p');
            note.textContent = localized('Warna adalah ilustrasi fase, bukan warna langit terukur atau penetapan waktu ibadah. Tahap tertentu dapat tidak terjadi di lintang tinggi. Fajar kadzib perlu observasi. Ghurub dan sunset merujuk peristiwa terbenam yang sama.', 'Colors illustrate phases, not measured sky colors or prayer-time rulings. Some phases may not occur at high latitudes. False dawn requires observation. Ghurub and sunset describe the same event.');
            const config = document.createElement('p');
            config.id = 'atmosphereGradingMethod';
            const list = document.createElement('ol');
            window.MpmAtmosphereGrading.phases.forEach(phase => {
                const item = document.createElement('li');
                const swatch = document.createElement('span');
                swatch.className = 'atmosphere-grading-swatch';
                swatch.style.backgroundColor = phase.hex;
                if (phase.id === 'false') swatch.style.background = 'repeating-linear-gradient(135deg, #9383ad, #9383ad 3px, transparent 3px, transparent 6px)';
                const text = document.createElement('span');
                const title = document.createElement('strong');
                title.textContent = phase.label;
                const detail = document.createElement('small');
                detail.textContent = phase.detail;
                text.append(title, detail);
                item.append(swatch, text);
                list.appendChild(item);
            });
            const sources = document.createElement('p');
            sources.append(document.createTextNode(localized('Siklus kembali ke syafaq abyadh, lalu malam.', 'The cycle returns to white twilight, then night.')), document.createElement('br'));
            for (const [label, url] of [['NASA: cahaya zodiakal / fajar kadzib', 'https://science.nasa.gov/solar-system/skywatching/night-sky-network/nsn-night-lights/'], ['NWS: batas twilight 6°, 12°, 18°', 'https://www.weather.gov/fsd/twilight']]) {
                const link = document.createElement('a');
                link.textContent = label;
                link.href = url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                sources.append(link, document.createElement('br'));
            }
            legend.append(summary, note, config, list, sources);
            byId('atmosphereOpacity').closest('.form-grid').after(legend);
        }
        const description = `${method.name} · fajar âˆ’${method.fajrAngle}° · faktor bayangan ashar ${asr.shadowFactor}`;
        const config = byId('atmosphereGradingMethod');
        if (config.textContent !== description) config.textContent = description;
    }

    function renderPrayerZoneOverlay(snapshot) {
        const canvas = createOverlayCanvas(OVERLAY_SIZES.prayer);
        const context = canvas.getContext('2d');
        const imageData = context.createImageData(canvas.width, canvas.height);
        const data = imageData.data;

        for (let y = 0; y < canvas.height; y += 1) {
            const lat = latitudeForCanvasY(y, canvas.height);
            for (let x = 0; x < canvas.width; x += 1) {
                const lon = -180 + (x / (canvas.width - 1)) * 360;
                const sunAltitude = altitudeFromSubpoint(
                    lat,
                    lon,
                    snapshot.sun.subpoint.lat,
                    snapshot.sun.subpoint.lon
                );
                const solarMinute = apparentSolarMinutes(snapshot.date, lon);
                const color = colorForPrayerZone(sunAltitude, solarMinute);
                const index = (y * canvas.width + x) * 4;
                data[index] = color[0];
                data[index + 1] = color[1];
                data[index + 2] = color[2];
                data[index + 3] = color[3];
            }
        }

        context.putImageData(imageData, 0, 0);
        setImageLayerFromCanvas(state.layers.prayer, canvas);
    }

    function colorForPrayerZone(sunAltitude, solarMinute) {
        if (sunAltitude < -18) {
            return [13, 20, 32, 0];
        }

        if (sunAltitude >= -18 && sunAltitude < -0.833) {
            if (solarMinute < 720) {
                return [30, 130, 142, 74];
            }
            return [211, 86, 54, 78];
        }

        if (sunAltitude >= -0.833 && sunAltitude < 8) {
            if (solarMinute < 720) {
                return [244, 183, 75, 54];
            }
            return [219, 98, 53, 66];
        }

        if (solarMinute >= 690 && solarMinute <= 810) {
            return [23, 106, 88, 58];
        }

        if (solarMinute > 810 && solarMinute < 1080) {
            return [99, 128, 58, 48];
        }

        return [255, 204, 83, 28];
    }

    function renderHilalOverlay(snapshot) {
        const canvas = createOverlayCanvas(OVERLAY_SIZES.hilal);
        const context = canvas.getContext('2d');
        const imageData = context.createImageData(canvas.width, canvas.height);
        const data = imageData.data;

        for (let y = 0; y < canvas.height; y += 1) {
            const lat = latitudeForCanvasY(y, canvas.height);
            for (let x = 0; x < canvas.width; x += 1) {
                const lon = -180 + (x / (canvas.width - 1)) * 360;
                const probability = hilalProbabilityAt(lat, lon, snapshot).probability;
                const color = colorForHilalProbability(probability);
                const index = (y * canvas.width + x) * 4;
                data[index] = color[0];
                data[index + 1] = color[1];
                data[index + 2] = color[2];
                data[index + 3] = color[3];
            }
        }

        context.putImageData(imageData, 0, 0);
        setImageLayerFromCanvas(state.layers.hilal, canvas);
    }

    function hilalProbabilityAt(lat, lon, snapshot) {
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
        const elongation = snapshot.moon.phaseAngle;
        const waxing = normalize360(snapshot.moon.phaseDegrees) > 0
            && normalize360(snapshot.moon.phaseDegrees) < 180;
        const twilightFactor = clamp((-sunAltitude - 2) / 10, 0, 1);
        const moonAltitudeScore = clamp((moonAltitude - 3) / 14, 0, 1);
        const elongationScore = clamp((elongation - 6) / 16, 0, 1);
        const ageScore = clamp((snapshot.moon.conjunction.ageHours - 8) / 34, 0, 1);
        const illuminationScore = clamp(snapshot.moon.illumination / 0.08, 0, 1);
        const phaseGate = waxing ? 1 : 0.12;
        const twilightGate = sunAltitude < -1 && sunAltitude > -16 ? 1 : 0.22;
        const probability = clamp(
            phaseGate
            * twilightGate
            * (
                moonAltitudeScore * 0.36
                + elongationScore * 0.28
                + ageScore * 0.2
                + illuminationScore * 0.1
                + twilightFactor * 0.06
            ),
            0,
            1
        );

        return {
            probability,
            sunAltitude,
            moonAltitude,
            elongation,
            waxing
        };
    }

    function colorForHilalProbability(probability) {
        if (probability < 0.12) {
            return [0, 0, 0, 0];
        }

        if (probability < 0.36) {
            return [192, 57, 43, Math.round(34 + probability * 92)];
        }

        if (probability < 0.62) {
            return [216, 137, 24, Math.round(42 + probability * 98)];
        }

        return [19, 138, 85, Math.round(52 + probability * 110)];
    }

    function createOverlayCanvas(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        return canvas;
    }

    function latitudeForCanvasY(y, height) {
        const mercatorY = WEB_MERCATOR_MAX - (y / (height - 1)) * WEB_MERCATOR_MAX * 2;
        return radToDeg(Math.atan(Math.sinh(mercatorY / EARTH_RADIUS_M)));
    }

    function setImageLayerFromCanvas(layer, canvas) {
        let source = layer.getSource();
        if (!source || !source.get('worldOverlayCanvas')) {
            // ImageStatic covers just one world. Render every visible world copy
            // into a viewport-sized canvas, including when the view is rotated.
            source = new ol.source.ImageCanvas({
                projection: 'EPSG:3857',
                ratio: 1,
                canvasFunction: function (extent, resolution, pixelRatio, size) {
                    const image = source.get('worldOverlayCanvas');
                    const output = document.createElement('canvas');
                    output.width = Math.ceil(size[0]);
                    output.height = Math.ceil(size[1]);
                    const context = output.getContext('2d');
                    const worldWidth = WEB_MERCATOR_EXTENT[2] - WEB_MERCATOR_EXTENT[0];
                    const bottom = Math.max(extent[1], WEB_MERCATOR_EXTENT[1]);
                    const top = Math.min(extent[3], WEB_MERCATOR_EXTENT[3]);
                    if (!image || bottom >= top) return output;
                    const scaleX = output.width / (extent[2] - extent[0]);
                    const scaleY = output.height / (extent[3] - extent[1]);
                    const first = Math.floor((extent[0] - WEB_MERCATOR_EXTENT[0]) / worldWidth);
                    const last = Math.ceil((extent[2] - WEB_MERCATOR_EXTENT[0]) / worldWidth) - 1;
                    for (let world = first; world <= last; world += 1) {
                        const origin = WEB_MERCATOR_EXTENT[0] + world * worldWidth;
                        const left = Math.max(extent[0], origin);
                        const right = Math.min(extent[2], origin + worldWidth);
                        const x0 = Math.round((left - extent[0]) * scaleX);
                        const x1 = Math.round((right - extent[0]) * scaleX);
                        context.drawImage(image,
                            (left - origin) / worldWidth * image.width,
                            (WEB_MERCATOR_EXTENT[3] - top) / worldWidth * image.height,
                            (right - left) / worldWidth * image.width,
                            (top - bottom) / worldWidth * image.height,
                            x0, (extent[3] - top) * scaleY,
                            x1 - x0, (top - bottom) * scaleY);
                    }
                    return output;
                }
            });
            source.set('worldOverlayCanvas', canvas, true);
            layer.setSource(source);
        } else {
            // Keep the source and layer identity during background time updates.
            source.set('worldOverlayCanvas', canvas, true);
            source.changed();
        }
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

    function renderPanels(snapshot) {
        const offsetHours = getSelectedTimezoneOffset(snapshot.date);
        const timeComparison = calculateTimeComparison(snapshot.date, snapshot);
        const dailyEvents = getDailyAstronomyEvents(snapshot.date);
        const prayerTimes = calculatePrayerTimes(
            snapshot.date,
            state.observer.lat,
            state.observer.lon,
            offsetHours,
            byId('prayerMethod').value,
            byId('asrMadhab').value
        );
        const nextPrayer = getNextPrayer(prayerTimes, snapshot.date);
        const directionAnalysis = analyzeDirections(snapshot, prayerTimes, nextPrayer);
        const rukyat = calculateRukyat(snapshot);
        updateEclipseRangeOptions(snapshot.date);
        const eclipse = getSolarEclipsePrediction(snapshot.date);

        state.latestPrayerTimes = prayerTimes;
        state.latestDirectionAnalysis = directionAnalysis;
        state.latestRukyat = rukyat;
        state.latestEclipse = eclipse;

        drawMoonCanvas(byId('panelMoonCanvas'), snapshot.moon);
        renderSunMetrics(snapshot, dailyEvents);
        renderMoonMetrics(snapshot, dailyEvents);
        renderTimeMetrics(timeComparison);
        renderPrayerTimes(prayerTimes, nextPrayer, timeComparison);
        renderDirectionAnalysis(directionAnalysis);
        renderRukyat(rukyat, snapshot);
        renderIslamicMethodNarrative();
        renderEclipsePrediction(eclipse);
        updateBadges(snapshot, rukyat);
        renderApiOutput(snapshot, timeComparison, prayerTimes, directionAnalysis, rukyat, eclipse);
    }

    function renderSunMetrics(snapshot, events) {
        const offsetHours = getSelectedTimezoneOffset(snapshot.date);
        setMetricGrid('sunMetrics', [
            [localized('Ketinggian', 'Altitude'), formatDegrees(snapshot.sun.horizontal.altitude, 2)],
            [localized('Azimut', 'Azimuth'), `${formatDegrees(snapshot.sun.horizontal.azimuth, 2)} ${getCompassDirection(snapshot.sun.horizontal.azimuth)}`],
            ['Subsolar', `${formatNumber(snapshot.sun.subpoint.lat, 4)}, ${formatNumber(snapshot.sun.subpoint.lon, 4)}`],
            [localized('Jarak', 'Distance'), `${formatKm(snapshot.sun.distanceKm)} / ${formatNumber(snapshot.sun.distanceAu, 6)} AU`],
            [localized('Matahari terbit', 'Sunrise'), formatLocalClock(events.sunrise, offsetHours, false)],
            [localized('Matahari terbenam', 'Sunset'), formatLocalClock(events.sunset, offsetHours, false)],
            [localized('Senja sipil', 'Civil Twilight'), `${formatLocalClock(events.civilDawn, offsetHours, false)} - ${formatLocalClock(events.civilDusk, offsetHours, false)}`],
            [localized('Senja astronomis', 'Astronomical Twilight'), `${formatLocalClock(events.astroDawn, offsetHours, false)} - ${formatLocalClock(events.astroDusk, offsetHours, false)}`]
        ]);
    }

    function renderMoonMetrics(snapshot, events) {
        const offsetHours = getSelectedTimezoneOffset(snapshot.date);
        setMetricGrid('moonMetrics', [
            [localized('Fase', 'Phase'), snapshot.moon.phaseName],
            [localized('Iluminasi', 'Illumination'), formatPercent(snapshot.moon.illumination, 1)],
            [localized('Ketinggian', 'Altitude'), formatDegrees(snapshot.moon.horizontal.altitude, 2)],
            [localized('Azimut', 'Azimuth'), `${formatDegrees(snapshot.moon.horizontal.azimuth, 2)} ${getCompassDirection(snapshot.moon.horizontal.azimuth)}`],
            ['Sublunar', `${formatNumber(snapshot.moon.subpoint.lat, 4)}, ${formatNumber(snapshot.moon.subpoint.lon, 4)}`],
            [localized('Elongasi', 'Elongation'), formatDegrees(snapshot.moon.phaseAngle, 2)],
            [localized('Bulan terbit', 'Moonrise'), formatLocalClock(events.moonrise, offsetHours, false)],
            [localized('Bulan terbenam', 'Moonset'), formatLocalClock(events.moonset, offsetHours, false)],
            [localized('Ijtimak sebelumnya', 'Previous conjunction'), formatLocalDateTime(snapshot.moon.conjunction.previous, offsetHours)],
            [localized('Ijtimak berikutnya', 'Next conjunction'), formatLocalDateTime(snapshot.moon.conjunction.next, offsetHours)]
        ]);
    }

    function renderTimeMetrics(comparison) {
        const items = [
            ['UTC', formatUtc(comparison.utcDate)],
            [localized('Jam dunia', 'World clock'), comparison.worldClock],
            [localized('Offset jaringan', 'Network offset'), formatSignedSeconds(comparison.networkOffsetSeconds)],
            [localized('Waktu matahari rata-rata', 'Mean solar time'), comparison.meanSolarTime],
            [localized('Waktu matahari tampak', 'Apparent solar time'), comparison.apparentSolarTime],
            [localized('Equation of time', 'Equation of time'), `${formatNumber(comparison.equationOfTimeMinutes, 2)} min`],
            [localized('Solar vs sipil', 'Solar vs civil'), formatSignedSeconds(comparison.solarCivilOffsetSeconds)],
            [localized('Waktu sideris lokal', 'Local sidereal time'), comparison.localSiderealTime],
            [localized('Sudut jam Bulan', 'Lunar hour angle'), comparison.lunarHourAngleTime],
            [localized('Zona waktu', 'Timezone'), `${comparison.timezoneName} ${formatUtcOffset(comparison.timezoneOffset)}`]
        ];

        if (comparison.providerComparison) {
            const provider = comparison.providerComparison;
            items.push(
                [localized('Basis gedung', 'Building basis'), 'Database admin'],
                ['IP provider', `${formatNumber(provider.distanceKm, 2)} km ${formatDegrees(provider.bearingFromBuilding, 1)}`],
                [localized('Delta solar tampak IP', 'IP apparent delta'), formatSignedSeconds(provider.apparentSolarDiffSeconds)],
                [localized('Delta Dhuhr IP', 'IP Dhuhr delta'), formatSignedSeconds(provider.dhuhrDiffSeconds)]
            );
        } else {
            items.push(['IP provider', state.ipComparisonMode === 'off' ? localized('Mati', 'Off') : localized('Belum tersedia', 'Not available')]);
        }

        if (comparison.kaabahComparison) {
            const kaabah = comparison.kaabahComparison;
            items.push(
                [localized('Jarak Kaabah', 'Kaabah distance'), `${formatNumber(kaabah.distanceKm, 2)} km ${formatDegrees(kaabah.bearingFromBuilding, 1)} ${getCompassDirection(kaabah.bearingFromBuilding)}`],
                [localized('Zona waktu Kaabah', 'Kaabah timezone'), `${kaabah.timezone} ${formatUtcOffset(kaabah.timezoneOffset)}`],
                [localized('Delta solar Kaabah', 'Kaabah solar delta'), formatSignedSeconds(kaabah.apparentSolarDiffSeconds)],
                [localized('Delta Dhuhr Kaabah', 'Kaabah Dhuhr delta'), formatSignedSeconds(kaabah.dhuhrDiffSeconds)]
            );
        }

        setMetricGrid('timeMetrics', items);
    }

    function renderPrayerTimes(prayerTimes, nextPrayer, timeComparison) {
        const grid = byId('prayerGrid');
        grid.innerHTML = '';
        const order = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'dhuha', 'tahajjud'];
        const labels = {
            fajr: 'Fajr',
            sunrise: 'Sunrise',
            dhuhr: 'Dhuhr',
            asr: 'Asr',
            maghrib: 'Maghrib',
            isha: 'Isha',
            dhuha: 'Dhuha',
            tahajjud: 'Tahajjud'
        };

        order.forEach((key) => {
            const item = document.createElement('article');
            item.className = `prayer-item${nextPrayer && nextPrayer.key === key ? ' is-next' : ''}`;
            const label = document.createElement('span');
            label.className = 'prayer-name';
            label.textContent = labels[key];
            const time = document.createElement('span');
            time.className = 'prayer-time';
            time.textContent = prayerTimes.formatted[key] || '-';
            item.append(label, time);
            grid.appendChild(item);
        });

        byId('nextPrayerBadge').textContent = nextPrayer
            ? `${labels[nextPrayer.key]} ${formatSignedSeconds(nextPrayer.secondsUntil)}`
            : '-';

        const comparisonRows = [
            [localized('Metode', 'Method'), prayerTimes.methodName],
            ['Madhab', prayerTimes.madhab],
            [localized('Basis koordinat', 'Coordinate basis'), state.adminContext ? localized('Gedung database admin', 'Admin database building') : localized('Observer manual', 'Manual observer')],
            [localized('Jam sipil', 'Civil clock'), timeComparison.worldClock],
            [localized('Offset solar', 'Solar offset'), formatSignedSeconds(timeComparison.solarCivilOffsetSeconds)]
        ];
        if (timeComparison.providerComparison) {
            comparisonRows.push(
                [localized('Delta solar IP', 'IP solar delta'), formatSignedSeconds(timeComparison.providerComparison.apparentSolarDiffSeconds)],
                [localized('Delta Dhuhr IP', 'IP Dhuhr delta'), formatSignedSeconds(timeComparison.providerComparison.dhuhrDiffSeconds)]
            );
        }
        if (timeComparison.kaabahComparison) {
            comparisonRows.push(
                [localized('Jarak Kaabah', 'Kaabah distance'), `${formatNumber(timeComparison.kaabahComparison.distanceKm, 2)} km`],
                ['Kaabah Dhuhr', `${timeComparison.kaabahComparison.kaabahDhuhrLocal} ${timeComparison.kaabahComparison.timezone}`],
                [localized('Bangunan/Kaabah Dhuhr', 'Building/Kaabah Dhuhr'), formatSignedSeconds(timeComparison.kaabahComparison.dhuhrDiffSeconds)],
                [localized('Bangunan/Kaabah Maghrib', 'Building/Kaabah Maghrib'), formatSignedSeconds(timeComparison.kaabahComparison.maghribDiffSeconds)]
            );
        }
        setMetricGrid('prayerComparison', comparisonRows);
    }

    function renderDirectionAnalysis(rows) {
        const tbody = byId('directionRows');
        tbody.innerHTML = '';

        rows.forEach((row) => {
            const tr = document.createElement('tr');
            appendCell(tr, `${row.abbr}\n${row.name}`);
            appendCell(tr, `dLat ${formatSignedDegrees(row.deltaLat)}\ndLon ${formatSignedDegrees(row.deltaLon)}`);
            appendCell(tr, formatSignedSeconds(row.solarDiffSeconds));
            appendCell(tr, `Dhuhr ${formatSignedSeconds(row.prayerDiffSeconds)}\n${localized('Terbit', 'Rise')} ${formatSignedSeconds(row.sunriseDiffSeconds)}\n${localized('Terbenam', 'Set')} ${formatSignedSeconds(row.sunsetDiffSeconds)}`);
            appendCell(tr, `${formatPercent(row.hilalProbability, 0)}\n${localized('Delta', 'Delta')} ${formatSignedValue(row.lunarVisibilityDiff, 1, ' pt')}`);
            tbody.appendChild(tr);
        });

        renderDirectionLayer(rows);
    }

    function appendCell(row, text) {
        const cell = document.createElement('td');
        cell.textContent = text;
        cell.style.whiteSpace = 'pre-line';
        row.appendChild(cell);
    }

    function renderRukyat(rukyat, snapshot) {
        const offsetHours = getSelectedTimezoneOffset(snapshot.date);
        const reviewMethods = activeReviewRegistryMethods()
            .slice(0, 6)
            .map(falakMethodLabel)
            .join(', ');
        setMetricGrid('hilalMetrics', [
            [localized('Probabilitas observer', 'Observer probability'), formatPercent(rukyat.probability, 1)],
            [localized('Status', 'Status'), rukyat.status],
            [localized('Altitude bulan', 'Moon altitude'), formatDegrees(rukyat.moonAltitude, 2)],
            [localized('Altitude matahari', 'Sun altitude'), formatDegrees(rukyat.sunAltitude, 2)],
            [localized('Elongasi', 'Elongation'), formatDegrees(rukyat.elongation, 2)],
            [localized('Umur bulan', 'Moon age'), `${formatNumber(snapshot.moon.conjunction.ageHours, 1)} ${localized('jam', 'hours')}`]
        ]);

        const rows = [
            [localized('Fase membesar', 'Waxing phase'), rukyat.waxing ? localized('Ya', 'Yes') : localized('Tidak', 'No')],
            [localized('Ijtimak sebelumnya', 'Previous conjunction'), formatLocalDateTime(snapshot.moon.conjunction.previous, offsetHours)],
            [localized('Ijtimak berikutnya', 'Next conjunction'), formatLocalDateTime(snapshot.moon.conjunction.next, offsetHours)],
            ['ADM context', Object.values(currentAdmLabels(state.adminContext)).filter(Boolean).join(' - ') || '-'],
            [localized('Metode review', 'Review methods'), reviewMethods || localized('Registry metode belum tersedia', 'Method registry is unavailable')],
            [localized('Rekomendasi', 'Recommendation'), rukyat.recommendation]
        ];
        const tbody = byId('rukyatRows');
        tbody.innerHTML = '';
        rows.forEach(([label, value]) => {
            const row = document.createElement('tr');
            appendCell(row, label);
            appendCell(row, value);
            tbody.appendChild(row);
        });
    }

    function readFalakRegistryCache() {
        try {
            const raw = window.localStorage ? window.localStorage.getItem(FALAK_REGISTRY_LOCAL_KEY) : '';
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    function writeFalakRegistryCache(registry) {
        try {
            if (window.localStorage) {
                window.localStorage.setItem(FALAK_REGISTRY_LOCAL_KEY, JSON.stringify(registry));
            }
        } catch (error) {
            // Browser storage can be disabled; registry rendering still has a fallback.
        }
    }

    function normalizeFalakRegistry(registry) {
        const source = registry && typeof registry === 'object' ? registry : {};
        return {
            schemaVersion: textValue(source.schemaVersion || '', 'fallback'),
            databaseOnline: source.databaseOnline === true,
            modules: Array.isArray(source.modules) ? source.modules : [],
            plugins: Array.isArray(source.plugins) ? source.plugins : [],
            algorithms: Array.isArray(source.algorithms) ? source.algorithms : [],
            criteria: Array.isArray(source.criteria) ? source.criteria : [],
            parameters: Array.isArray(source.parameters) ? source.parameters : [],
            methods: Array.isArray(source.methods) ? source.methods : [],
            prayerMethods: Array.isArray(source.prayerMethods) ? source.prayerMethods : [],
            asrMethods: Array.isArray(source.asrMethods) ? source.asrMethods : [],
            hijriMethods: Array.isArray(source.hijriMethods) ? source.hijriMethods : [],
            hilalCriteria: Array.isArray(source.hilalCriteria) ? source.hilalCriteria : [],
            rukyatMethods: Array.isArray(source.rukyatMethods) ? source.rukyatMethods : [],
            ephemerisAlgorithms: Array.isArray(source.ephemerisAlgorithms) ? source.ephemerisAlgorithms : [],
            calculationProfiles: Array.isArray(source.calculationProfiles) ? source.calculationProfiles : [],
            timezones: Array.isArray(source.timezones) ? source.timezones : [],
            profiles: Array.isArray(source.profiles) || (source.profiles && typeof source.profiles === 'object')
                ? source.profiles
                : []
        };
    }

    function applyFalakRegistry(registry, sourceLabel) {
        state.falakRegistry = normalizeFalakRegistry(registry);
        state.falakRegistrySource = sourceLabel || 'database';
        state.falakRegistryLoaded = true;
        state.falakRegistryError = '';
        clearComputationCaches();
        writeFalakRegistryCache(state.falakRegistry);
        populateFalakControls();
        syncPrayerPreviewWithPublication();
        renderFalakRegistry();
        renderIslamicMethodNarrative();
        if (state.latestSnapshot) {
            updateAll(true);
        }
        if (state.latestOutput) {
            state.latestOutput.reviewer.falakRegistry = state.falakRegistry;
        }
    }

    function falakText(record, idKey, enKey, fallback) {
        const value = languageMode() === 'en'
            ? textValue(record && record[enKey])
            : textValue(record && record[idKey]);
        if (value) {
            return value;
        }
        return textValue(record && (record[idKey] || record[enKey])) || fallback || '';
    }

    function falakMethodLabel(method) {
        return falakText(method, 'methodNameId', 'methodNameEn', method.methodKey || '-');
    }

    function registryAllMethods(registryInput) {
        const registry = normalizeFalakRegistry(registryInput || state.falakRegistry || FALAK_FALLBACK_REGISTRY);
        const keyed = new Map();
        [
            registry.prayerMethods,
            registry.asrMethods,
            registry.hijriMethods,
            registry.hilalCriteria,
            registry.rukyatMethods,
            registry.ephemerisAlgorithms,
            registry.methods
        ].forEach((items) => {
            items.forEach((item) => {
                const key = textValue(item.methodKey || item.criterionKey || item.algorithmKey || '');
                if (!key || keyed.has(key)) {
                    return;
                }
                keyed.set(key, item);
            });
        });
        return Array.from(keyed.values());
    }

    function activeFalakMethods() {
        return registryAllMethods().filter((method) => method.isEnabled !== false && method.isActive !== false);
    }

    function activeReviewRegistryMethods() {
        const registry = normalizeFalakRegistry(state.falakRegistry || FALAK_FALLBACK_REGISTRY);
        const selected = [];
        const selectedKeys = new Set();
        const addItems = (items, limit) => {
            items
                .filter((item) => item.isEnabled !== false && item.isActive !== false)
                .slice(0, limit)
                .forEach((item) => {
                    const key = textValue(item.methodKey || item.criterionKey || item.algorithmKey || '');
                    if (!key || selectedKeys.has(key)) {
                        return;
                    }
                    selectedKeys.add(key);
                    selected.push(item);
                });
        };

        addItems(registry.hijriMethods, 2);
        addItems(registry.hilalCriteria, 2);
        addItems(registry.rukyatMethods, 2);

        if (selected.length) {
            return selected;
        }

        return activeFalakMethods().filter((method) => {
            const category = textValue(method.category || method.moduleKey || '').toLowerCase();
            return category.indexOf('hilal') >= 0
                || category.indexOf('rukyat') >= 0
                || category.indexOf('hijri') >= 0
                || category.indexOf('visibility') >= 0;
        });
    }

    function enabledPrayerMethods() {
        const registry = normalizeFalakRegistry(state.falakRegistry || FALAK_FALLBACK_REGISTRY);
        const typed = registry.prayerMethods.filter((method) => method.isEnabled !== false && method.isActive !== false);
        if (typed.length) {
            return typed;
        }
        return registry.methods.filter((method) => {
            const category = textValue(method.category || method.moduleKey || '').toLowerCase();
            return method.isEnabled !== false
                && method.isActive !== false
                && (category === 'prayer_time' || category === 'prayer');
        });
    }

    function enabledAsrMethods() {
        const registry = normalizeFalakRegistry(state.falakRegistry || FALAK_FALLBACK_REGISTRY);
        return registry.asrMethods.filter((method) => method.isEnabled !== false && method.isActive !== false);
    }

    function numericParameter(parameters, keys, fallback) {
        const source = parameters && typeof parameters === 'object' ? parameters : {};
        for (const key of keys) {
            const value = Number(source[key]);
            if (Number.isFinite(value)) {
                return value;
            }
        }
        return fallback;
    }

    function defaultCalculationProfile() {
        const registry = normalizeFalakRegistry(state.falakRegistry || FALAK_FALLBACK_REGISTRY);
        return registry.calculationProfiles.find((profile) => profile.isDefault !== false && profile.isActive !== false)
            || registry.calculationProfiles.find((profile) => profile.isActive !== false)
            || null;
    }

    function defaultPrayerMethodKey(methods) {
        const profile = defaultCalculationProfile();
        if (profile && textValue(profile.prayerMethodKey)) {
            return textValue(profile.prayerMethodKey);
        }
        return methods.length ? methods[0].methodKey : DEFAULT_PRAYER_METHOD_CONFIG.methodKey;
    }

    function defaultAsrMethodKey(methods) {
        const profile = defaultCalculationProfile();
        if (profile && textValue(profile.asrMethodKey)) {
            return textValue(profile.asrMethodKey);
        }
        return methods.length ? methods[0].methodKey : DEFAULT_ASR_METHOD_CONFIG.methodKey;
    }

    function prayerMethodConfig(methodId) {
        const methods = enabledPrayerMethods();
        const methodKey = textValue(methodId || defaultPrayerMethodKey(methods));
        const method = methods.find((item) => item.methodKey === methodKey) || methods[0] || null;
        if (!method) {
            return {
                methodKey: DEFAULT_PRAYER_METHOD_CONFIG.methodKey,
                name: localized(DEFAULT_PRAYER_METHOD_CONFIG.nameId, DEFAULT_PRAYER_METHOD_CONFIG.nameEn),
                fajrAngle: DEFAULT_PRAYER_METHOD_CONFIG.fajrAngle,
                ishaAngle: DEFAULT_PRAYER_METHOD_CONFIG.ishaAngle,
                ishaInterval: DEFAULT_PRAYER_METHOD_CONFIG.ishaInterval
            };
        }

        const params = method.parameters && typeof method.parameters === 'object' ? method.parameters : {};
        const publicationParameters = state.falakPrayerPublication
            && state.falakPrayerPublication.methodParameters
            && state.falakPrayerPublication.methodParameters[method.methodKey]
            ? normalizePublicationParameters(state.falakPrayerPublication.methodParameters[method.methodKey], method)
            : normalizePublicationParameters({}, method);
        return {
            methodKey: method.methodKey,
            name: falakMethodLabel(method),
            fajrAngle: numericParameter(params, ['fajr_angle', 'fajrAngle'], DEFAULT_PRAYER_METHOD_CONFIG.fajrAngle),
            ishaAngle: numericParameter(params, ['isha_angle', 'ishaAngle'], DEFAULT_PRAYER_METHOD_CONFIG.ishaAngle),
            ishaInterval: numericParameter(params, ['isha_interval', 'ishaInterval', 'ishaIntervalMinutes'], null),
            publicationParameters,
            registryRefractionCorrection: numericParameter(
                params,
                ['refraction_correction', 'refractionCorrection'],
                publicationNumber(method.refractionCorrection, 0.5667)
            ),
            registryPressureHpa: numericParameter(params, ['pressure_hpa', 'pressureHpa'], publicationNumber(method.pressureHpa, 1010)),
            registryTemperatureCelsius: numericParameter(params, ['temperature_celsius', 'temperatureCelsius'], publicationNumber(method.temperatureCelsius, 25))
        };
    }

    function asrMethodConfig(methodId) {
        const methods = enabledAsrMethods();
        const methodKey = textValue(methodId || defaultAsrMethodKey(methods));
        const method = methods.find((item) => item.methodKey === methodKey) || methods[0] || null;
        if (!method) {
            return {
                methodKey: DEFAULT_ASR_METHOD_CONFIG.methodKey,
                name: localized(DEFAULT_ASR_METHOD_CONFIG.nameId, DEFAULT_ASR_METHOD_CONFIG.nameEn),
                shadowFactor: DEFAULT_ASR_METHOD_CONFIG.shadowFactor
            };
        }

        return {
            methodKey: method.methodKey,
            name: falakMethodLabel(method),
            shadowFactor: Number.isFinite(Number(method.shadowFactor)) ? Number(method.shadowFactor) : DEFAULT_ASR_METHOD_CONFIG.shadowFactor
        };
    }

    function falakMethodDescription(method) {
        const advantage = falakText(method, 'advantagesId', 'advantagesEn', '');
        const limitation = falakText(method, 'limitationsId', 'limitationsEn', '');
        return [advantage, limitation].filter(Boolean).join(' ');
    }

    function falakRegistrySourceLabel(source) {
        const value = textValue(source || '').toLowerCase();
        if (value === 'database') {
            return localized('Database', 'Database');
        }
        if (value === 'local-cache') {
            return localized('Cache lokal', 'Local cache');
        }
        if (value === 'fallback') {
            return localized('Fallback offline', 'Offline fallback');
        }
        return source || '-';
    }

    function optionLabelSuffix(parts) {
        const text = parts.filter((part) => textValue(part)).join(' / ');
        return text ? ` (${text})` : '';
    }

    function prayerMethodOptionLabel(method) {
        const params = method.parameters && typeof method.parameters === 'object' ? method.parameters : {};
        const fajr = numericParameter(params, ['fajr_angle', 'fajrAngle'], null);
        const isha = numericParameter(params, ['isha_angle', 'ishaAngle'], null);
        const interval = numericParameter(params, ['isha_interval', 'ishaInterval', 'ishaIntervalMinutes'], null);
        const publication = state.falakPrayerPublication
            && state.falakPrayerPublication.methodParameters
            ? state.falakPrayerPublication.methodParameters[method.methodKey]
            : null;
        const profile = normalizePublicationParameters(publication, method);
        const ishaText = interval !== null
            ? `${formatNumber(interval, 0)}m`
            : `${formatNumber(isha, 1)}°`;
        const detail = `Subuh ${formatNumber(fajr, 1)}° / Syuruq ${formatNumber(profile.sunriseAltitudeDegrees, 2)}° / Dhuha ${formatNumber(profile.dhuhaAltitudeDegrees, 1)}° / Maghrib ${formatNumber(profile.maghribAltitudeDegrees, 2)}° / Isya ${ishaText}`;
        return `${falakMethodLabel(method)}${optionLabelSuffix([detail])}`;
    }

    function asrMethodOptionLabel(method) {
        return `${falakMethodLabel(method)}${optionLabelSuffix([
            `${localized('bayangan', 'shadow')} ${formatNumber(method.shadowFactor, 0)}x`
        ])}`;
    }

    function replaceSelectOptions(select, options, selectedValue) {
        const previous = textValue(selectedValue || select.value);
        select.innerHTML = '';
        options.forEach((optionData) => {
            const option = document.createElement('option');
            option.value = optionData.value;
            option.textContent = optionData.label;
            Object.keys(optionData.dataset || {}).forEach((key) => {
                option.dataset[key] = String(optionData.dataset[key]);
            });
            select.appendChild(option);
        });
        if (previous && options.some((option) => option.value === previous)) {
            select.value = previous;
        } else if (options.length) {
            select.value = options[0].value;
        }
    }

    function populatePrayerMethodControl() {
        const select = byId('prayerMethod');
        if (!select) {
            return;
        }

        const methods = enabledPrayerMethods();
        if (!methods.length) {
            replaceSelectOptions(select, [{
                value: DEFAULT_PRAYER_METHOD_CONFIG.methodKey,
                label: localized(DEFAULT_PRAYER_METHOD_CONFIG.nameId, DEFAULT_PRAYER_METHOD_CONFIG.nameEn),
                dataset: { registryStatus: 'unavailable' }
            }], DEFAULT_PRAYER_METHOD_CONFIG.methodKey);
            return;
        }

        const defaultKey = defaultPrayerMethodKey(methods);
        replaceSelectOptions(select, methods.map((method) => ({
            value: method.methodKey,
            label: prayerMethodOptionLabel(method),
            dataset: {
                registryType: method.registryType || 'prayer',
                fajrAngle: numericParameter(method.parameters, ['fajr_angle', 'fajrAngle'], ''),
                ishaAngle: numericParameter(method.parameters, ['isha_angle', 'ishaAngle'], ''),
                ishaInterval: numericParameter(method.parameters, ['isha_interval', 'ishaInterval', 'ishaIntervalMinutes'], '')
            }
        })), select.value && select.value !== DEFAULT_PRAYER_METHOD_CONFIG.methodKey ? select.value : defaultKey);
    }

    function populateAsrMethodControl() {
        const select = byId('asrMadhab');
        if (!select) {
            return;
        }

        const methods = enabledAsrMethods();
        if (!methods.length) {
            replaceSelectOptions(select, [{
                value: DEFAULT_ASR_METHOD_CONFIG.methodKey,
                label: localized(DEFAULT_ASR_METHOD_CONFIG.nameId, DEFAULT_ASR_METHOD_CONFIG.nameEn),
                dataset: {
                    registryStatus: 'unavailable',
                    shadowFactor: DEFAULT_ASR_METHOD_CONFIG.shadowFactor
                }
            }], DEFAULT_ASR_METHOD_CONFIG.methodKey);
            return;
        }

        const defaultKey = defaultAsrMethodKey(methods);
        replaceSelectOptions(select, methods.map((method) => ({
            value: method.methodKey,
            label: asrMethodOptionLabel(method),
            dataset: {
                registryType: method.registryType || 'asr',
                shadowFactor: method.shadowFactor
            }
        })), select.value && select.value !== DEFAULT_ASR_METHOD_CONFIG.methodKey ? select.value : defaultKey);
    }

    function populateFalakControls() {
        populatePrayerMethodControl();
        populateAsrMethodControl();
    }

    function normalizePrayerPublication(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const methods = Array.isArray(source.methods) ? source.methods : [];
        const asrMethods = Array.isArray(source.asrMethods) ? source.asrMethods : [];
        const selectedProfiles = Array.isArray(source.selectedMethods) ? source.selectedMethods : [];
        const keys = Array.isArray(source.selectedMethodKeys)
            ? source.selectedMethodKeys.map((key) => textValue(key)).filter(Boolean).slice(0, 3)
            : [];
        const methodParameters = {};
        methods.forEach((method) => {
            const key = textValue(method.methodKey);
            const stored = selectedProfiles.find((profile) => textValue(profile.methodKey) === key);
            methodParameters[key] = normalizePublicationParameters(
                stored && stored.calculationParameters,
                method
            );
        });
        return {
            schemaVersion: textValue(source.schemaVersion || 'falak-prayer-publication-v2'),
            context: source.context && typeof source.context === 'object' ? source.context : {},
            constraints: source.constraints && typeof source.constraints === 'object'
                ? source.constraints
                : { minimumMethods: 1, maximumMethods: 3 },
            methods,
            asrMethods,
            selectedMethodKeys: keys,
            primaryMethodKey: keys.includes(textValue(source.primaryMethodKey))
                ? textValue(source.primaryMethodKey)
                : (keys[0] || ''),
            asrMethodKey: textValue(source.asrMethodKey || 'asr-shafii'),
            methodParameters,
            source: textValue(source.source || 'database-profile')
        };
    }

    function publicationNumber(value, fallback) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function normalizePublicationParameters(value, method) {
        const source = value && typeof value === 'object' ? value : {};
        const registry = method && method.parameters && typeof method.parameters === 'object'
            ? method.parameters
            : {};
        const offsets = source.prayerOffsetsMinutes && typeof source.prayerOffsetsMinutes === 'object'
            ? source.prayerOffsetsMinutes
            : {};
        const refraction = publicationNumber(method && method.refractionCorrection, 0.5667);
        const solarDiameter = publicationNumber(method && method.solarDiameterArcmin, 32);
        const standardAltitude = -(refraction + solarDiameter / 120);
        const normalizedOffsets = {};
        ['subuh', 'syuruq', 'dhuha', 'dhuhur', 'ashar', 'maghrib', 'isha'].forEach((key) => {
            normalizedOffsets[key] = publicationNumber(
                offsets[key],
                publicationNumber(registry[`${key}_offset_minutes`], 0)
            );
        });
        const textChoice = (candidate, fallback, allowed) => {
            const normalized = textValue(candidate || fallback).toLowerCase();
            return allowed.includes(normalized) ? normalized : fallback;
        };
        return {
            sunriseAltitudeDegrees: publicationNumber(source.sunriseAltitudeDegrees, publicationNumber(registry.sunrise_altitude_degrees, standardAltitude)),
            dhuhaAltitudeDegrees: publicationNumber(source.dhuhaAltitudeDegrees, publicationNumber(registry.dhuha_altitude_degrees, 4.5)),
            dhuhaAwwabinBeforeDhuhrMinutes: publicationNumber(source.dhuhaAwwabinBeforeDhuhrMinutes, publicationNumber(registry.dhuha_awwabin_before_dhuhr_minutes, 60)),
            maghribAltitudeDegrees: publicationNumber(source.maghribAltitudeDegrees, publicationNumber(registry.maghrib_altitude_degrees, standardAltitude)),
            elevationMeters: publicationNumber(source.elevationMeters, 0),
            refractionCorrection: publicationNumber(source.refractionCorrection, refraction),
            pressureHpa: publicationNumber(source.pressureHpa, publicationNumber(method && method.pressureHpa, 1010)),
            temperatureCelsius: publicationNumber(source.temperatureCelsius, publicationNumber(method && method.temperatureCelsius, 25)),
            ishaIntervalRamadanMinutes: publicationNumber(source.ishaIntervalRamadanMinutes, publicationNumber(registry.isha_interval_ramadan_minutes, 0)),
            roundingPolicy: textChoice(source.roundingPolicy, registry.rounding_policy || 'nearest', ['nearest', 'up', 'down']),
            twilightCalculation: textChoice(source.twilightCalculation, registry.twilight_calculation || 'fixed-angle', ['fixed-angle', 'seasonal-moonsighting']),
            shafaq: textChoice(source.shafaq, registry.shafaq || 'general', ['general', 'ahmer', 'abyad']),
            prayerOffsetsMinutes: normalizedOffsets
        };
    }

    function publicationMethodSignature(method, parameters) {
        const fajr = Number(method && method.fajrAngle);
        const isha = Number(method && method.ishaAngle);
        const interval = Number(method && method.ishaIntervalMinutes);
        const fajrText = Number.isFinite(fajr) ? `${formatNumber(fajr, 1)}°` : '-';
        const ishaText = Number.isFinite(interval)
            ? `${formatNumber(interval, 0)} menit setelah Maghrib`
            : (Number.isFinite(isha) ? `${formatNumber(isha, 1)}°` : '-');
        const profile = normalizePublicationParameters(parameters, method);
        return `Subuh ${fajrText} / Syuruq ${formatNumber(profile.sunriseAltitudeDegrees, 2)}° / Dhuha ${formatNumber(profile.dhuhaAltitudeDegrees, 1)}° / Maghrib ${formatNumber(profile.maghribAltitudeDegrees, 2)}° / Isya ${ishaText}`;
    }

    function selectedPublicationKeysFromDom() {
        return Array.from(document.querySelectorAll('[data-falak-publication-method]:checked'))
            .map((input) => textValue(input.value))
            .filter(Boolean)
            .slice(0, 3);
    }

    function setPrayerPublicationStatus(message, kind) {
        const status = byId('falakPublicationStatus');
        if (!status) {
            return;
        }
        status.textContent = message;
        status.dataset.kind = kind || '';
    }

    function capturePublicationParametersFromDom() {
        const publication = state.falakPrayerPublication;
        if (!publication) {
            return {};
        }
        document.querySelectorAll('[data-falak-parameter-method][data-falak-parameter-key]').forEach((input) => {
            const methodKey = textValue(input.dataset.falakParameterMethod);
            const parameterKey = textValue(input.dataset.falakParameterKey);
            const value = Number(input.value);
            if (!methodKey || !parameterKey || !Number.isFinite(value)) {
                return;
            }
            const method = publication.methods.find((candidate) => candidate.methodKey === methodKey) || {};
            publication.methodParameters[methodKey] = normalizePublicationParameters(
                publication.methodParameters[methodKey],
                method
            );
            const offsetKey = textValue(input.dataset.falakOffsetKey);
            if (offsetKey) {
                publication.methodParameters[methodKey].prayerOffsetsMinutes[offsetKey] = value;
            } else {
                publication.methodParameters[methodKey][parameterKey] = value;
            }
        });
        return publication.methodParameters;
    }

    function falakParameterInput(methodKey, parameterKey, labelText, value, minimum, maximum, step, offsetKey) {
        const label = document.createElement('label');
        const labelSpan = document.createElement('span');
        labelSpan.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'number';
        input.value = String(value);
        input.min = String(minimum);
        input.max = String(maximum);
        input.step = String(step);
        input.dataset.falakParameterMethod = methodKey;
        input.dataset.falakParameterKey = parameterKey;
        if (offsetKey) {
            input.dataset.falakOffsetKey = offsetKey;
        }
        input.addEventListener('input', () => {
            capturePublicationParametersFromDom();
            setPrayerPublicationStatus('Perubahan parameter Falak belum disimpan.', '');
        });
        label.appendChild(labelSpan);
        label.appendChild(input);
        return label;
    }

    function renderPrayerPublicationParameters() {
        const target = byId('falakPublicationParameterPanels');
        const publication = state.falakPrayerPublication;
        if (!target) {
            return;
        }
        target.replaceChildren();
        if (!publication) {
            return;
        }
        publication.selectedMethodKeys.forEach((methodKey, index) => {
            const method = publication.methods.find((candidate) => candidate.methodKey === methodKey) || {};
            const parameters = normalizePublicationParameters(publication.methodParameters[methodKey], method);
            publication.methodParameters[methodKey] = parameters;
            const panel = document.createElement('details');
            panel.className = 'falak-parameter-panel';
            panel.open = index === 0;
            const summary = document.createElement('summary');
            summary.textContent = `${method.methodNameId || method.methodNameEn || methodKey} - parameter lengkap`;
            const body = document.createElement('div');
            body.className = 'falak-parameter-body';
            const physicalGrid = document.createElement('div');
            physicalGrid.className = 'falak-parameter-grid';
            [
                ['sunriseAltitudeDegrees', 'Ketinggian Syuruq (°)', -3, 0, 0.001],
                ['dhuhaAltitudeDegrees', 'Ketinggian Dhuha (°)', 1, 12, 0.1],
                ['dhuhaAwwabinBeforeDhuhrMinutes', 'Awwabin sebelum Dzuhur (menit)', 15, 180, 1],
                ['maghribAltitudeDegrees', 'Ketinggian Maghrib (°)', -6, 0, 0.001],
                ['elevationMeters', 'Elevasi lokasi (meter)', -50, 9000, 1],
                ['refractionCorrection', 'Koreksi refraksi (°)', 0, 1.5, 0.0001],
                ['pressureHpa', 'Tekanan udara (hPa)', 800, 1100, 0.1],
                ['temperatureCelsius', 'Suhu udara (°C)', -60, 60, 0.1]
            ].forEach(([key, label, minimum, maximum, step]) => {
                physicalGrid.appendChild(falakParameterInput(
                    methodKey,
                    key,
                    label,
                    parameters[key],
                    minimum,
                    maximum,
                    step,
                    ''
                ));
            });
            const ihtiyatTitle = document.createElement('p');
            ihtiyatTitle.className = 'falak-ihtiyat-title';
            ihtiyatTitle.textContent = 'Ihtiyat/koreksi lokal per waktu (menit, boleh minus)';
            const ihtiyatGrid = document.createElement('div');
            ihtiyatGrid.className = 'falak-ihtiyat-grid';
            [
                ['subuh', 'Subuh'], ['syuruq', 'Syuruq'], ['dhuha', 'Dhuha'],
                ['dhuhur', 'Dzuhur'], ['ashar', 'Ashar'], ['maghrib', 'Maghrib'], ['isha', 'Isya']
            ].forEach(([key, label]) => {
                ihtiyatGrid.appendChild(falakParameterInput(
                    methodKey,
                    'prayerOffsetsMinutes',
                    label,
                    parameters.prayerOffsetsMinutes[key],
                    -30,
                    30,
                    1,
                    key
                ));
            });
            body.appendChild(physicalGrid);
            body.appendChild(ihtiyatTitle);
            body.appendChild(ihtiyatGrid);
            panel.appendChild(summary);
            panel.appendChild(body);
            target.appendChild(panel);
        });
    }

    function syncPublicationSelectionControls(preferredPrimary) {
        const publication = state.falakPrayerPublication;
        if (!publication) {
            return;
        }
        capturePublicationParametersFromDom();
        const selectedKeys = selectedPublicationKeysFromDom();
        publication.selectedMethodKeys = selectedKeys;
        const count = byId('falakPublicationCount');
        if (count) {
            count.textContent = `${selectedKeys.length}/3`;
        }
        const primarySelect = byId('falakPublicationPrimary');
        if (primarySelect) {
            const current = textValue(preferredPrimary || primarySelect.value || publication.primaryMethodKey);
            const options = selectedKeys.map((key) => {
                const method = publication.methods.find((candidate) => candidate.methodKey === key) || {};
                return {
                    value: key,
                    label: method.methodNameId || method.methodNameEn || key
                };
            });
            replaceSelectOptions(primarySelect, options, selectedKeys.includes(current) ? current : selectedKeys[0]);
            publication.primaryMethodKey = primarySelect.value || selectedKeys[0] || '';
        }
        const save = byId('saveFalakPublication');
        if (save) {
            save.disabled = state.falakPrayerPublicationSaving || selectedKeys.length < 1 || selectedKeys.length > 3;
        }
        renderPrayerPublicationParameters();
    }

    function syncPrayerPreviewWithPublication() {
        const publication = state.falakPrayerPublication;
        if (!publication) {
            return;
        }
        const methodSelect = byId('prayerMethod');
        if (methodSelect && Array.from(methodSelect.options).some((option) => option.value === publication.primaryMethodKey)) {
            methodSelect.value = publication.primaryMethodKey;
        }
        const asrSelect = byId('asrMadhab');
        if (asrSelect && Array.from(asrSelect.options).some((option) => option.value === publication.asrMethodKey)) {
            asrSelect.value = publication.asrMethodKey;
        }
    }

    function renderPrayerPublication() {
        const target = byId('falakPublicationMethodOptions');
        if (!target) {
            return;
        }
        const publication = state.falakPrayerPublication;
        if (!publication) {
            target.innerHTML = '';
            setPrayerPublicationStatus(
                state.falakPrayerPublicationError || localized('Memuat konfigurasi metode publik...', 'Loading public method configuration...'),
                state.falakPrayerPublicationError ? 'error' : ''
            );
            return;
        }
        const selected = new Set(publication.selectedMethodKeys);
        const fragment = document.createDocumentFragment();
        publication.methods.forEach((method) => {
            const label = document.createElement('label');
            label.className = 'falak-publication-option';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = textValue(method.methodKey);
            input.checked = selected.has(input.value);
            input.setAttribute('data-falak-publication-method', '');
            const name = document.createElement('strong');
            name.textContent = method.methodNameId || method.methodNameEn || method.methodKey;
            const signature = document.createElement('small');
            signature.textContent = publicationMethodSignature(
                method,
                publication.methodParameters[method.methodKey]
            );
            const onlineProfile = method.onlineProfile && typeof method.onlineProfile === 'object'
                ? method.onlineProfile
                : {};
            const evidence = document.createElement('small');
            const sourceCount = Array.isArray(onlineProfile.sources) ? onlineProfile.sources.length : 0;
            const profileLabels = {
                official_authority_verified: 'Parameter otoritas resmi',
                official_and_technical_verified: 'Otoritas + registry teknis',
                authority_algorithm_verified: 'Algoritme otoritas terverifikasi',
                technical_registry_verified: 'Registry kalkulasi daring',
                technical_registry_approximation: 'Aproksimasi registry kalkulasi',
                official_schedule_formula_unpublished: 'Jadwal resmi; rumus lengkap tidak dipublikasikan'
            };
            evidence.textContent = `${profileLabels[onlineProfile.status] || onlineProfile.status || 'Belum diteliti'} · ${sourceCount} sumber · verifikasi ${onlineProfile.verifiedOnlineOn || '-'}`;
            input.addEventListener('change', () => {
                const keys = selectedPublicationKeysFromDom();
                if (input.checked && keys.length >= 3 && !keys.includes(input.value)) {
                    input.checked = false;
                    setPrayerPublicationStatus('Maksimal 3 metode dapat ditampilkan di index.html.', 'error');
                    return;
                }
                const checkedCount = document.querySelectorAll('[data-falak-publication-method]:checked').length;
                if (!input.checked && checkedCount < 1) {
                    input.checked = true;
                    setPrayerPublicationStatus('Minimal 1 metode harus tetap dipilih.', 'error');
                    return;
                }
                const allChecked = Array.from(document.querySelectorAll('[data-falak-publication-method]:checked'));
                if (allChecked.length > 3) {
                    input.checked = false;
                    setPrayerPublicationStatus('Maksimal 3 metode dapat ditampilkan di index.html.', 'error');
                    return;
                }
                syncPublicationSelectionControls();
                setPrayerPublicationStatus('Perubahan belum disimpan.', '');
            });
            label.appendChild(input);
            label.appendChild(name);
            label.appendChild(signature);
            label.appendChild(evidence);
            fragment.appendChild(label);
        });
        target.replaceChildren(fragment);

        const asrSelect = byId('falakPublicationAsr');
        if (asrSelect) {
            replaceSelectOptions(asrSelect, publication.asrMethods.map((method) => ({
                value: method.methodKey,
                label: `${method.methodNameId || method.methodNameEn || method.methodKey} (${formatNumber(method.shadowFactor, 0)}x bayangan)`
            })), publication.asrMethodKey);
        }
        syncPublicationSelectionControls(publication.primaryMethodKey);
        setPrayerPublicationStatus(
            `${publication.selectedMethodKeys.length} metode Falak diterapkan ke index.html.`,
            'success'
        );
    }

    async function loadPrayerPublication() {
        if (state.falakPrayerPublicationLoading) {
            return;
        }
        state.falakPrayerPublicationLoading = true;
        state.falakPrayerPublicationError = '';
        renderPrayerPublication();
        try {
            const response = await fetch(FALAK_PRAYER_CONFIG_API, {
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            const payload = await response.json();
            if (!response.ok || !payload || payload.success === false) {
                throw new Error(payload && payload.error ? payload.error : `HTTP ${response.status}`);
            }
            state.falakPrayerPublication = normalizePrayerPublication(payload.data || payload);
            renderPrayerPublication();
            syncPrayerPreviewWithPublication();
            if (window.Astronomy) {
                clearComputationCaches();
                updateAll(true);
            }
        } catch (error) {
            state.falakPrayerPublicationError = error.message || 'Konfigurasi Falak tidak tersedia.';
            renderPrayerPublication();
        } finally {
            state.falakPrayerPublicationLoading = false;
        }
    }

    async function savePrayerPublication() {
        const publication = state.falakPrayerPublication;
        if (!publication || state.falakPrayerPublicationSaving) {
            return;
        }
        const methodKeys = selectedPublicationKeysFromDom();
        if (methodKeys.length < 1 || methodKeys.length > 3) {
            setPrayerPublicationStatus('Pilih minimal 1 dan maksimal 3 metode.', 'error');
            return;
        }
        const primary = textValue(byId('falakPublicationPrimary') && byId('falakPublicationPrimary').value);
        const asr = textValue(byId('falakPublicationAsr') && byId('falakPublicationAsr').value);
        const methodParameters = capturePublicationParametersFromDom();
        state.falakPrayerPublicationSaving = true;
        syncPublicationSelectionControls(primary);
        setPrayerPublicationStatus('Menyimpan konfigurasi Falak...', '');
        try {
            const response = await fetch(FALAK_PRAYER_CONFIG_API, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mosqueId: publication.context.mosqueId,
                    methodKeys,
                    primaryMethodKey: primary,
                    asrMethodKey: asr,
                    methodParameters
                })
            });
            const payload = await response.json();
            if (!response.ok || !payload || payload.success === false) {
                throw new Error(payload && payload.error ? payload.error : `HTTP ${response.status}`);
            }
            const saved = payload.data && payload.data.configuration ? payload.data.configuration : payload.data;
            state.falakPrayerPublication = normalizePrayerPublication(saved);
            state.falakPrayerPublicationError = '';
            renderPrayerPublication();
            syncPrayerPreviewWithPublication();
            if (window.Astronomy) {
                clearComputationCaches();
                updateAll(true);
            }
            window.dispatchEvent(new CustomEvent('mpm:falak-prayer-publication-updated', {
                detail: payload.data || {}
            }));
        } catch (error) {
            state.falakPrayerPublicationError = error.message || 'Konfigurasi gagal disimpan.';
            setPrayerPublicationStatus(`Gagal menyimpan: ${state.falakPrayerPublicationError}`, 'error');
        } finally {
            state.falakPrayerPublicationSaving = false;
            syncPublicationSelectionControls(primary);
        }
    }

    function renderFalakRegistry() {
        const target = byId('falakEngineSummary');
        if (!target) {
            return;
        }

        const registry = normalizeFalakRegistry(state.falakRegistry || FALAK_FALLBACK_REGISTRY);
        const methods = registryAllMethods(registry);
        const enabledMethods = activeFalakMethods();
        const algorithmCount = registry.ephemerisAlgorithms.length || registry.algorithms.length;
        const criteriaCount = registry.hilalCriteria.length || registry.criteria.length;
        const statusLabel = state.falakRegistryError
            ? localized('Cache/offline', 'Cache/offline')
            : falakRegistrySourceLabel(state.falakRegistrySource);
        const head = `
            <div class="falak-registry-head">
                <p><strong>${escapeHtml(localized('Sumber', 'Source'))}</strong> ${escapeHtml(statusLabel)}</p>
                <p><strong>${escapeHtml(localized('Metode aktif', 'Active methods'))}</strong> ${enabledMethods.length}/${methods.length}</p>
                <p><strong>${escapeHtml(localized('Algoritma / kriteria / parameter', 'Algorithms / criteria / parameters'))}</strong> ${algorithmCount} / ${criteriaCount} / ${registry.parameters.length}</p>
                <p><strong>${escapeHtml(localized('Registry typed', 'Typed registries'))}</strong> ${registry.prayerMethods.length} prayer / ${registry.asrMethods.length} asr / ${registry.hijriMethods.length} hijri / ${registry.hilalCriteria.length} hilal / ${registry.rukyatMethods.length} rukyat / ${registry.ephemerisAlgorithms.length} ephemeris</p>
                <p><strong>${escapeHtml(localized('Profil / zona waktu', 'Profiles / timezones'))}</strong> ${registry.calculationProfiles.length} / ${state.timezones.length || registry.timezones.length}</p>
            </div>
        `;

        const methodRows = methods.slice(0, 12).map((method) => {
            const enabled = method.isEnabled !== false && method.isActive !== false;
            const category = textValue(method.category || method.moduleKey || '');
            const status = textValue(method.implementationStatus || '');
            const entryKey = textValue(method.methodKey || method.criterionKey || method.algorithmKey || '');
            const registryType = textValue(method.registryType || 'generic');
            if (state.reviewerMode === 'display') {
                if (!enabled) {
                    return '';
                }
                return `
                    <article class="astro-method-card">
                        <strong>${escapeHtml(falakMethodLabel(method))}</strong>
                        <span>${escapeHtml([category, status].filter(Boolean).join(' - '))}</span>
                        <p>${escapeHtml(falakMethodDescription(method) || localized('Metode aktif pada registry falak.', 'Active method in the falak registry.'))}</p>
                    </article>
                `;
            }
            return `
                <button class="falak-method-toggle${enabled ? ' is-enabled' : ''}" type="button" data-falak-method="${escapeHtml(entryKey)}" data-falak-registry-type="${escapeHtml(registryType)}" aria-pressed="${enabled ? 'true' : 'false'}">
                    <strong>${escapeHtml(falakMethodLabel(method))}</strong>
                    <span>${escapeHtml([category, status].filter(Boolean).join(' - '))}</span>
                </button>
            `;
        }).join('');

        const body = state.reviewerMode === 'display'
            ? `<div class="astro-method-list">${methodRows || `<p>${escapeHtml(localized('Belum ada metode aktif.', 'No active method is available.'))}</p>`}</div>`
            : `<div class="falak-method-toolbar">${methodRows}</div>`;

        target.innerHTML = `${head}${body}`;

        if (state.reviewerMode !== 'display') {
            target.querySelectorAll('[data-falak-method]').forEach((button) => {
                button.addEventListener('click', () => {
                    const methodKey = button.getAttribute('data-falak-method') || '';
                    const registryType = button.getAttribute('data-falak-registry-type') || 'generic';
                    const nextEnabled = button.getAttribute('aria-pressed') !== 'true';
                    toggleFalakMethod(methodKey, nextEnabled, registryType);
                });
            });
        }
    }

    async function loadFalakRegistry(force) {
        if (state.falakRegistryLoading) {
            return;
        }
        if (state.falakRegistryLoaded && !force) {
            renderFalakRegistry();
            return;
        }

        state.falakRegistryLoading = true;
        const cached = readFalakRegistryCache();
        if (cached && !state.falakRegistryLoaded) {
            state.falakRegistry = normalizeFalakRegistry(cached);
            state.falakRegistrySource = 'local-cache';
            state.falakRegistryLoaded = true;
            populateFalakControls();
            renderFalakRegistry();
        }

        try {
            const response = await fetch(`${FALAK_REGISTRY_API}?lang=${encodeURIComponent(languageMode())}`, {
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            const payload = await response.json();
            if (!response.ok || !payload || payload.success === false) {
                throw new Error(payload && payload.error ? payload.error : `HTTP ${response.status}`);
            }
            applyFalakRegistry(payload.data || payload, 'database');
        } catch (error) {
            state.falakRegistryError = error.message || 'Registry offline';
            if (!state.falakRegistryLoaded) {
                state.falakRegistry = normalizeFalakRegistry(cached || FALAK_FALLBACK_REGISTRY);
                state.falakRegistrySource = cached ? 'local-cache' : 'fallback';
                state.falakRegistryLoaded = true;
                populateFalakControls();
            }
            renderFalakRegistry();
        } finally {
            state.falakRegistryLoading = false;
        }
    }

    async function toggleFalakMethod(methodKey, enabled, registryType) {
        const registry = normalizeFalakRegistry(state.falakRegistry || FALAK_FALLBACK_REGISTRY);
        const type = textValue(registryType || 'generic');
        const method = registryAllMethods(registry).find((item) => {
            const entryKey = textValue(item.methodKey || item.criterionKey || item.algorithmKey || '');
            const entryType = textValue(item.registryType || 'generic');
            return entryKey === methodKey && entryType === type;
        });
        if (!method) {
            return;
        }

        method.isEnabled = Boolean(enabled);
        state.falakRegistry = registry;
        state.falakRegistrySource = state.falakRegistrySource || 'local-cache';
        clearComputationCaches();
        writeFalakRegistryCache(registry);
        populateFalakControls();
        renderFalakRegistry();
        renderIslamicMethodNarrative();
        if (state.latestSnapshot) {
            updateAll(true);
        }

        try {
            const response = await fetch(FALAK_REGISTRY_API, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'set_registry_entry_enabled',
                    registryType: type,
                    entryKey: methodKey,
                    enabled: Boolean(enabled)
                })
            });
            const payload = await response.json();
            if (!response.ok || !payload || payload.success === false) {
                throw new Error(payload && payload.error ? payload.error : `HTTP ${response.status}`);
            }
            if (payload.data) {
                applyFalakRegistry(payload.data, 'database');
            }
        } catch (error) {
            state.falakRegistryError = error.message || 'Registry saved locally only';
            renderFalakRegistry();
        }
    }

    function normalizeFalakCalendar(calendar) {
        const source = calendar && typeof calendar === 'object' ? calendar : {};
        return {
            schemaVersion: textValue(source.schemaVersion || '', 'fallback'),
            year: Number.isFinite(Number(source.year)) ? Number(source.year) : getNetworkNow().getUTCFullYear(),
            events: Array.isArray(source.events) ? source.events : [],
            eventSources: Array.isArray(source.eventSources) ? source.eventSources : [],
            monthStartResults: Array.isArray(source.monthStartResults) ? source.monthStartResults : [],
            supportedImports: Array.isArray(source.supportedImports) ? source.supportedImports : []
        };
    }

    function readFalakCalendarCache() {
        try {
            const raw = window.localStorage ? window.localStorage.getItem(FALAK_CALENDAR_LOCAL_KEY) : '';
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    function writeFalakCalendarCache(calendar) {
        try {
            if (window.localStorage) {
                window.localStorage.setItem(FALAK_CALENDAR_LOCAL_KEY, JSON.stringify(calendar));
            }
        } catch (error) {
            // Calendar cache is not required for calculations.
        }
    }

    function calendarEventLabel(event) {
        return languageMode() === 'en'
            ? textValue(event.eventNameEn || event.eventNameId || event.eventKey)
            : textValue(event.eventNameId || event.eventNameEn || event.eventKey);
    }

    function calendarEventHijriText(event) {
        return languageMode() === 'en'
            ? textValue(event.hijriDateEn || event.hijriDateId || '')
            : textValue(event.hijriDateId || event.hijriDateEn || '');
    }

    function calendarEventGregorianText(event) {
        return languageMode() === 'en'
            ? textValue(event.gregorianDateTextEn || event.gregorianDateTextId || '')
            : textValue(event.gregorianDateTextId || event.gregorianDateTextEn || '');
    }

    function calendarEventStatusLabel(event) {
        const status = textValue(event.dateStatus);
        const labels = {
            'pending-online-decision': localized('menunggu keputusan online, tanggal Masehi masih prediksi', 'waiting for online decision; Gregorian date is still predicted'),
            prediction: localized('prediksi kalender Hijriah tabular', 'tabular Hijri calendar prediction'),
            'recurring-rule': localized('aturan berulang', 'recurring rule'),
            'no-fixed-date': localized('tidak punya tanggal tetap', 'no fixed date')
        };
        return labels[status] || status;
    }

    function renderFalakCalendar() {
        const target = byId('falakCalendarSummary');
        if (!target) {
            return;
        }

        const calendar = normalizeFalakCalendar(state.falakCalendar);
        const statusLabel = state.falakCalendarError
            ? localized('Cache/offline', 'Cache/offline')
            : falakRegistrySourceLabel(state.falakCalendarSource);
        const monthRows = calendar.monthStartResults.slice(0, 6).map((result) => {
            const label = [
                result.monthName,
                result.methodKey,
                result.criterionKey,
                result.decisionStatus
            ].filter(Boolean).join(' - ');
            return `<article class="astro-method-card"><strong>${escapeHtml(label || result.resultKey || '-')}</strong><p>${escapeHtml(result.decidedStartDate || result.localDate || localized('Tanggal keputusan belum tersimpan.', 'Decision date is not stored yet.'))}</p></article>`;
        }).join('');
        const eventRows = calendar.events.map((event) => {
            const meta = [event.legalCategory, event.eventType, event.regionScope].filter(Boolean).join(' - ');
            const hijriText = calendarEventHijriText(event);
            const gregorianText = calendarEventGregorianText(event);
            const statusText = calendarEventStatusLabel(event);
            return `
                <article class="astro-method-card">
                    <strong>${escapeHtml(calendarEventLabel(event))}</strong>
                    <span>${escapeHtml(meta)}</span>
                    ${hijriText ? `<span><b>${escapeHtml(localized('Hijriah', 'Hijri'))}</b> ${escapeHtml(hijriText)}</span>` : ''}
                    ${gregorianText ? `<span><b>${escapeHtml(localized('Masehi', 'Gregorian'))}</b> ${escapeHtml(gregorianText)}</span>` : ''}
                    ${statusText ? `<span><b>${escapeHtml(localized('Status', 'Status'))}</b> ${escapeHtml(statusText)}</span>` : ''}
                    <p>${escapeHtml(languageMode() === 'en' ? event.descriptionEn || '' : event.descriptionId || '')}</p>
                </article>
            `;
        }).join('');
        const empty = `<article class="astro-method-card"><strong>${escapeHtml(localized('Kalender belum tersedia', 'Calendar unavailable'))}</strong><p>${escapeHtml(localized('Jalankan migration 006 dan isi data kalender ibadah dari database/import.', 'Run migration 006 and load worship-calendar data from database/import.'))}</p></article>`;
        const monthStartSection = monthRows
            ? `<div class="astro-method-list"><article class="astro-method-card"><strong>${escapeHtml(localized('Hasil Awal Bulan', 'Month-Start Results'))}</strong><p>${escapeHtml(localized('Keputusan online atau hasil perhitungan yang tersimpan di database.', 'Online decisions or calculated results stored in the database.'))}</p></article>${monthRows}</div>`
            : '';
        const eventSection = eventRows
            ? `<div class="astro-method-list"><article class="astro-method-card"><strong>${escapeHtml(localized('Kalender Hari Besar / Ibadah', 'Holy Days / Worship Calendar'))}</strong><p>${escapeHtml(localized('Tanggal Masehi dihitung dari acuan Hijriah; Ramadan, Syawal, dan Zulhijah tetap menunggu keputusan online bila belum ada keputusan tersimpan.', 'Gregorian dates are calculated from Hijri rules; Ramadan, Shawwal, and Dhu al-Hijjah still wait for online decisions when no stored decision exists.'))}</p></article>${eventRows}</div>`
            : '';

        target.innerHTML = `
            <div class="falak-registry-head">
                <p><strong>${escapeHtml(localized('Sumber', 'Source'))}</strong> ${escapeHtml(statusLabel)}</p>
                <p><strong>${escapeHtml(localized('Tahun', 'Year'))}</strong> ${calendar.year}</p>
                <p><strong>${escapeHtml(localized('Event / hasil awal bulan / referensi', 'Events / month-start results / references'))}</strong> ${calendar.events.length} / ${calendar.monthStartResults.length} / ${calendar.eventSources.length}</p>
                <p><strong>${escapeHtml(localized('Import', 'Import'))}</strong> ${escapeHtml(calendar.supportedImports.join(', ') || '-')}</p>
            </div>
            ${monthStartSection}${eventSection || empty}
        `;
    }

    async function loadFalakCalendar(force) {
        if (state.falakCalendarLoading) {
            return;
        }
        if (state.falakCalendarLoaded && !force) {
            renderFalakCalendar();
            return;
        }

        state.falakCalendarLoading = true;
        const cached = readFalakCalendarCache();
        if (cached && !state.falakCalendarLoaded) {
            state.falakCalendar = normalizeFalakCalendar(cached);
            state.falakCalendarSource = 'local-cache';
            state.falakCalendarLoaded = true;
            renderFalakCalendar();
        }

        try {
            const year = getRenderDate().getUTCFullYear();
            const response = await fetch(`${FALAK_CALENDAR_API}?year=${encodeURIComponent(year)}`, {
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            const payload = await response.json();
            if (!response.ok || !payload || payload.success === false) {
                throw new Error(payload && payload.error ? payload.error : `HTTP ${response.status}`);
            }
            state.falakCalendar = normalizeFalakCalendar(payload.data || payload);
            state.falakCalendarSource = 'database';
            state.falakCalendarLoaded = true;
            state.falakCalendarError = '';
            writeFalakCalendarCache(state.falakCalendar);
            renderFalakCalendar();
        } catch (error) {
            state.falakCalendarError = error.message || 'Falak calendar offline';
            if (!state.falakCalendarLoaded) {
                state.falakCalendar = normalizeFalakCalendar(cached || {});
                state.falakCalendarSource = cached ? 'local-cache' : 'fallback';
                state.falakCalendarLoaded = true;
            }
            renderFalakCalendar();
        } finally {
            state.falakCalendarLoading = false;
        }
    }

    function renderIslamicMethodNarrative() {
        const rukyat = state.latestRukyat;
        const labels = currentAdmLabels(state.adminContext);
        const heading = [
            `<p><strong>${escapeHtml(localized('Konteks lokal', 'Local context'))}</strong> ${escapeHtml([labels.adm0, labels.adm1, labels.adm2].filter(Boolean).join(' - ') || localized('observer manual', 'manual observer'))}</p>`,
            rukyat
                ? `<p><strong>${escapeHtml(localized('Hasil aktual', 'Current result'))}</strong> ${escapeHtml(rukyat.status)} / ${formatPercent(rukyat.probability, 1)}. ${escapeHtml(rukyat.recommendation)}</p>`
                : `<p><strong>${escapeHtml(localized('Hasil aktual', 'Current result'))}</strong> ${escapeHtml(localized('Menunggu kalkulasi hilal.', 'Waiting for crescent calculation.'))}</p>`
        ];
        const registryMethods = activeReviewRegistryMethods();
        const cards = registryMethods.length
            ? registryMethods.slice(0, 8).map((method) => {
                const meta = [
                    method.country,
                    method.organization,
                    method.implementationStatus
                ].filter(Boolean).join(' - ');
                return `
                    <article class="astro-method-card">
                        <strong>${escapeHtml(falakMethodLabel(method))}</strong>
                        <span>${escapeHtml(meta)}</span>
                        <p>${escapeHtml(falakMethodDescription(method) || localized('Metadata metode tersedia di registry falak.', 'Method metadata is available in the falak registry.'))}</p>
                    </article>
                `;
            }).join('')
            : `<article class="astro-method-card"><strong>${escapeHtml(localized('Registry metode belum tersedia', 'Method registry is unavailable'))}</strong><p>${escapeHtml(localized('Sambungkan database atau cache registry untuk menampilkan metode hisab, rukyat, dan kriteria hilal.', 'Connect the database or registry cache to display hisab, rukyat, and hilal-criterion methods.'))}</p></article>`;
        setHtml('islamicMethodNarrative', `${heading.join('')}<div class="astro-method-list">${cards}</div>`);
    }

    function safeDateFromAstroTime(value) {
        if (!value) {
            return null;
        }
        if (value instanceof Date) {
            return value;
        }
        if (value.time) {
            return safeDateFromAstroTime(value.time);
        }
        if (value.date instanceof Date) {
            return value.date;
        }
        const parsed = new Date(String(value));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function astroEventDate(container, key) {
        if (!container || !key) {
            return null;
        }
        return safeDateFromAstroTime(container[key]);
    }

    function durationSecondsBetween(start, end) {
        if (!(start instanceof Date) || !(end instanceof Date)) {
            return NaN;
        }
        return Math.max(0, (end.getTime() - start.getTime()) / 1000);
    }

    function calculateLocalSolarEclipseDetails(peakDate, latitude, longitude) {
        if (!window.Astronomy || typeof Astronomy.SearchLocalSolarEclipse !== 'function') {
            return null;
        }
        if (!(peakDate instanceof Date) || !validCoordinates(latitude, longitude)) {
            return null;
        }

        try {
            const observer = new Astronomy.Observer(Number(latitude), normalizeLon(Number(longitude)), 0);
            const local = Astronomy.SearchLocalSolarEclipse(new Date(peakDate.getTime() - 3 * 86400000), observer);
            if (!local) {
                return null;
            }
            const peak = astroEventDate(local, 'peak');
            if (!peak || Math.abs(peak.getTime() - peakDate.getTime()) > 5 * 86400000) {
                return null;
            }

            const partialBegin = astroEventDate(local, 'partial_begin');
            const partialEnd = astroEventDate(local, 'partial_end');
            const totalBegin = astroEventDate(local, 'total_begin') || astroEventDate(local, 'annular_begin');
            const totalEnd = astroEventDate(local, 'total_end') || astroEventDate(local, 'annular_end');
            const totalDurationSeconds = Number.isFinite(durationSecondsBetween(totalBegin, totalEnd))
                ? durationSecondsBetween(totalBegin, totalEnd)
                : NaN;
            const partialDurationSeconds = Number.isFinite(durationSecondsBetween(partialBegin, partialEnd))
                ? durationSecondsBetween(partialBegin, partialEnd)
                : NaN;

            return {
                kind: local.kind || null,
                obscuration: Number.isFinite(Number(local.obscuration)) ? Number(local.obscuration) : null,
                partialBeginUtc: partialBegin ? partialBegin.toISOString() : null,
                peakUtc: peak.toISOString(),
                partialEndUtc: partialEnd ? partialEnd.toISOString() : null,
                totalBeginUtc: totalBegin ? totalBegin.toISOString() : null,
                totalEndUtc: totalEnd ? totalEnd.toISOString() : null,
                durationSeconds: Number.isFinite(totalDurationSeconds)
                    ? totalDurationSeconds
                    : partialDurationSeconds
            };
        } catch (error) {
            return {
                error: error.message
            };
        }
    }

    function normalizeEclipseKind(kind, eventType) {
        if (Number.isFinite(Number(kind))) {
            const numeric = Number(kind);
            if (eventType === 'lunar') {
                return ['penumbral', 'partial', 'total'][numeric] || 'unknown';
            }
            return ['partial', 'annular', 'total', 'hybrid'][numeric] || 'unknown';
        }

        const value = textValue(kind || 'unknown').toLowerCase();
        if (value.indexOf('penum') !== -1) {
            return 'penumbral';
        }
        if (value.indexOf('partial') !== -1 || value.indexOf('sebagian') !== -1) {
            return 'partial';
        }
        if (value.indexOf('annular') !== -1 || value.indexOf('cincin') !== -1) {
            return 'annular';
        }
        if (value.indexOf('hybrid') !== -1 || value.indexOf('hibr') !== -1) {
            return 'hybrid';
        }
        if (value.indexOf('total') !== -1) {
            return 'total';
        }
        return value || 'unknown';
    }

    function eclipseTypeLabel(kind, eventType) {
        const value = normalizeEclipseKind(kind, eventType || 'solar');
        const labels = {
            total: localized('Total', 'Total'),
            annular: localized('Cincin', 'Annular'),
            partial: localized('Sebagian', 'Partial'),
            hybrid: localized('Hibrida', 'Hybrid'),
            penumbral: localized('Penumbral', 'Penumbral')
        };
        return labels[value] || `${value || 'unknown'}`;
    }

    function eclipseMarkerLabel(peakDate, baseYear) {
        const year = peakDate.getUTCFullYear();
        const delta = year - baseYear;
        return delta <= 0 ? String(year) : `${delta}yr ${year}`;
    }

    function calculateSolarEclipse(date) {
        if (!window.Astronomy || typeof Astronomy.SearchGlobalSolarEclipse !== 'function') {
            return {
                available: false,
                messageId: 'Mesin prediksi gerhana matahari tidak tersedia.',
                messageEn: 'Solar eclipse prediction engine is not available.'
            };
        }

        try {
            const eclipse = Astronomy.SearchGlobalSolarEclipse(date);
            if (!eclipse) {
                return {
                    available: false,
                    messageId: 'Belum ada prediksi gerhana matahari dari tanggal render.',
                    messageEn: 'No solar eclipse prediction was returned from the render date.'
                };
            }

            const peakDate = safeDateFromAstroTime(eclipse.peak);
            const latitude = Number(eclipse.latitude);
            const longitude = Number.isFinite(Number(eclipse.longitude)) ? normalizeLon(Number(eclipse.longitude)) : NaN;
            const building = contextPoint(state.adminContext) || { lat: state.observer.lat, lon: state.observer.lon };
            const hasPeakPoint = validCoordinates(latitude, longitude);
            const localDetails = hasPeakPoint
                ? calculateLocalSolarEclipseDetails(peakDate, latitude, longitude)
                : null;
            return applyStoredEclipseAdm({
                available: true,
                eventType: 'solar',
                referenceCode: eclipseReferenceCode('solar', peakDate ? peakDate.toISOString() : ''),
                kind: normalizeEclipseKind(eclipse.kind || 'unknown', 'solar'),
                typeLabel: eclipseTypeLabel(eclipse.kind || 'unknown', 'solar'),
                peakUtc: peakDate ? peakDate.toISOString() : null,
                latitude: hasPeakPoint ? latitude : null,
                longitude: hasPeakPoint ? longitude : null,
                coordinateBasis: localized('Koordinat puncak gerhana matahari global', 'Global solar eclipse peak coordinate'),
                obscuration: Number.isFinite(eclipse.obscuration) ? eclipse.obscuration : null,
                localDetails,
                durationSeconds: localDetails && Number.isFinite(localDetails.durationSeconds)
                    ? localDetails.durationSeconds
                    : null,
                distanceKmFromBuilding: hasPeakPoint
                    ? haversineKm(building.lat, building.lon, latitude, longitude)
                    : null,
                bearingFromBuilding: hasPeakPoint
                    ? initialBearing(building.lat, building.lon, latitude, longitude)
                    : null,
                admContext: currentAdmLabels(state.adminContext)
            });
        } catch (error) {
            return {
                available: false,
                messageId: `Prediksi gerhana gagal: ${error.message}`,
                messageEn: `Solar eclipse prediction failed: ${error.message}`
            };
        }
    }

    function lunarSemiDurationMinutes(eclipse) {
        const total = Number(eclipse && eclipse.sd_total);
        const partial = Number(eclipse && eclipse.sd_partial);
        const penumbral = Number(eclipse && eclipse.sd_penum);
        if (Number.isFinite(total) && total > 0) {
            return { phase: 'total', minutes: total };
        }
        if (Number.isFinite(partial) && partial > 0) {
            return { phase: 'partial', minutes: partial };
        }
        if (Number.isFinite(penumbral) && penumbral > 0) {
            return { phase: 'penumbral', minutes: penumbral };
        }
        return { phase: 'unknown', minutes: NaN };
    }

    function calculateLunarEclipse(date) {
        if (!window.Astronomy || typeof Astronomy.SearchLunarEclipse !== 'function') {
            return {
                available: false,
                messageId: 'Mesin prediksi gerhana bulan tidak tersedia.',
                messageEn: 'Lunar eclipse prediction engine is not available.'
            };
        }

        try {
            const eclipse = Astronomy.SearchLunarEclipse(date);
            if (!eclipse) {
                return {
                    available: false,
                    messageId: 'Belum ada prediksi gerhana bulan dari tanggal render.',
                    messageEn: 'No lunar eclipse prediction was returned from the render date.'
                };
            }

            const peakDate = safeDateFromAstroTime(eclipse.peak);
            const subpoint = peakDate ? getSubpoint(Astronomy.Body.Moon, peakDate) : null;
            const latitude = subpoint ? Number(subpoint.lat) : NaN;
            const longitude = subpoint ? normalizeLon(Number(subpoint.lon)) : NaN;
            const building = contextPoint(state.adminContext) || { lat: state.observer.lat, lon: state.observer.lon };
            const hasPeakPoint = validCoordinates(latitude, longitude);
            const semiDuration = lunarSemiDurationMinutes(eclipse);
            const durationSeconds = Number.isFinite(semiDuration.minutes) ? semiDuration.minutes * 120 : null;
            const startDate = peakDate && Number.isFinite(semiDuration.minutes)
                ? new Date(peakDate.getTime() - semiDuration.minutes * 60000)
                : null;
            const endDate = peakDate && Number.isFinite(semiDuration.minutes)
                ? new Date(peakDate.getTime() + semiDuration.minutes * 60000)
                : null;

            return applyStoredEclipseAdm({
                available: true,
                eventType: 'lunar',
                referenceCode: eclipseReferenceCode('lunar', peakDate ? peakDate.toISOString() : ''),
                kind: normalizeEclipseKind(eclipse.kind || 'unknown', 'lunar'),
                typeLabel: eclipseTypeLabel(eclipse.kind || 'unknown', 'lunar'),
                peakUtc: peakDate ? peakDate.toISOString() : null,
                latitude: hasPeakPoint ? latitude : null,
                longitude: hasPeakPoint ? longitude : null,
                coordinateBasis: localized('Titik sublunar saat puncak gerhana bulan', 'Sublunar point at lunar eclipse peak'),
                obscuration: Number.isFinite(Number(eclipse.obscuration)) ? Number(eclipse.obscuration) : null,
                localDetails: {
                    phase: semiDuration.phase,
                    partialBeginUtc: startDate ? startDate.toISOString() : null,
                    peakUtc: peakDate ? peakDate.toISOString() : null,
                    partialEndUtc: endDate ? endDate.toISOString() : null,
                    durationBasis: semiDuration.phase,
                    sdPenumMinutes: Number.isFinite(Number(eclipse.sd_penum)) ? Number(eclipse.sd_penum) : null,
                    sdPartialMinutes: Number.isFinite(Number(eclipse.sd_partial)) ? Number(eclipse.sd_partial) : null,
                    sdTotalMinutes: Number.isFinite(Number(eclipse.sd_total)) ? Number(eclipse.sd_total) : null
                },
                durationSeconds,
                distanceKmFromBuilding: hasPeakPoint
                    ? haversineKm(building.lat, building.lon, latitude, longitude)
                    : null,
                bearingFromBuilding: hasPeakPoint
                    ? initialBearing(building.lat, building.lon, latitude, longitude)
                    : null,
                admContext: currentAdmLabels(state.adminContext)
            });
        } catch (error) {
            return {
                available: false,
                messageId: `Prediksi gerhana bulan gagal: ${error.message}`,
                messageEn: `Lunar eclipse prediction failed: ${error.message}`
            };
        }
    }

    function getSolarEclipsePrediction(date) {
        const labels = currentAdmLabels(state.adminContext);
        const horizonYears = getEclipseHorizonYears();
        const key = [
            localYmd(date, getSelectedTimezoneOffset(date)),
            horizonYears,
            labels.adm0,
            labels.adm1,
            labels.adm2,
            state.observer.lat.toFixed(4),
            state.observer.lon.toFixed(4)
        ].join('|');
        if (state.latestEclipse && state.lastEclipseKey === key) {
            return state.latestEclipse;
        }
        state.lastEclipseKey = key;
        const solarSeries = collectSolarEclipseSeries(date, horizonYears);
        const lunarSeries = collectLunarEclipseSeries(date, horizonYears);
        const series = solarSeries.concat(lunarSeries)
            .filter((event) => event && event.available)
            .sort((left, right) => String(left.peakUtc || '').localeCompare(String(right.peakUtc || '')));
        const first = series[0] || calculateSolarEclipse(date);
        const result = {
            ...first,
            available: series.length > 0,
            solar: solarSeries[0] || null,
            lunar: lunarSeries[0] || null,
            series,
            horizonYears,
            baseYear: date.getUTCFullYear(),
            rangeEndYear: date.getUTCFullYear() + horizonYears
        };
        state.latestEclipseSeries = series;
        return result;
    }

    function getEclipseHorizonYears() {
        const select = byId('eclipseRangeSelect');
        const value = select ? Number(select.value) : state.eclipseHorizonYears;
        return clamp(Number.isFinite(value) ? Math.round(value) : 0, 0, 10);
    }

    function updateEclipseRangeOptions(date) {
        const select = byId('eclipseRangeSelect');
        if (!select) {
            return;
        }

        const baseYear = date.getUTCFullYear();
        Array.from(select.options).forEach((option) => {
            const years = clamp(Number(option.value || 0), 0, 10);
            option.textContent = years === 0
                ? `${localized('Tahun aktual', 'Current year')} (${baseYear})`
                : `${years} ${localized('tahun ke depan', 'year(s) ahead')} (${baseYear + years})`;
        });
        select.value = String(getEclipseHorizonYears());
    }

    function collectSolarEclipseSeries(date, horizonYears) {
        const baseYear = date.getUTCFullYear();
        const endDate = new Date(Date.UTC(baseYear + horizonYears, 11, 31, 23, 59, 59));
        const events = [];
        const seen = new Set();
        let cursor = new Date(date.getTime());
        for (let index = 0; index < 36; index += 1) {
            const eclipse = calculateSolarEclipse(cursor);
            if (!eclipse || !eclipse.available || !eclipse.peakUtc) {
                break;
            }
            const peakDate = new Date(eclipse.peakUtc);
            if (Number.isNaN(peakDate.getTime())) {
                break;
            }
            if (peakDate.getTime() > endDate.getTime()) {
                break;
            }
            if (peakDate.getTime() >= date.getTime()) {
                const eventKey = peakDate.toISOString();
                if (!seen.has(eventKey)) {
                    const enriched = {
                        ...eclipse,
                        markerLabel: eclipseMarkerLabel(peakDate, baseYear),
                        year: peakDate.getUTCFullYear(),
                        yearOffset: Math.max(0, peakDate.getUTCFullYear() - baseYear)
                    };
                    events.push(applyStoredEclipseAdm(enriched));
                    seen.add(eventKey);
                }
            }
            cursor = new Date(peakDate.getTime() + 86400000);
        }

        return events;
    }

    function collectLunarEclipseSeries(date, horizonYears) {
        const baseYear = date.getUTCFullYear();
        const endDate = new Date(Date.UTC(baseYear + horizonYears, 11, 31, 23, 59, 59));
        const events = [];
        const seen = new Set();
        let cursor = new Date(date.getTime());
        for (let index = 0; index < 36; index += 1) {
            const eclipse = calculateLunarEclipse(cursor);
            if (!eclipse || !eclipse.available || !eclipse.peakUtc) {
                break;
            }
            const peakDate = new Date(eclipse.peakUtc);
            if (Number.isNaN(peakDate.getTime())) {
                break;
            }
            if (peakDate.getTime() > endDate.getTime()) {
                break;
            }
            if (peakDate.getTime() >= date.getTime()) {
                const eventKey = peakDate.toISOString();
                if (!seen.has(eventKey)) {
                    const enriched = {
                        ...eclipse,
                        markerLabel: eclipseMarkerLabel(peakDate, baseYear),
                        year: peakDate.getUTCFullYear(),
                        yearOffset: Math.max(0, peakDate.getUTCFullYear() - baseYear)
                    };
                    events.push(applyStoredEclipseAdm(enriched));
                    seen.add(eventKey);
                }
            }
            cursor = new Date(peakDate.getTime() + 86400000);
        }
        return events;
    }

    function renderEclipseMarkers(eclipse) {
        const source = state.sources.eclipse;
        if (!source) {
            return;
        }

        source.clear();
        const events = eclipse && Array.isArray(eclipse.series)
            ? eclipse.series
            : state.latestEclipseSeries;
        const displayEvents = state.reviewerMode === 'display'
            ? ['solar', 'lunar'].map((eventType) => events.find((event) => event.eventType === eventType)).filter(Boolean)
            : events;
        displayEvents
            .filter((event) => validCoordinates(event.latitude, event.longitude))
            .forEach((event) => {
                const eventType = event.eventType === 'lunar' ? 'lunar' : 'solar';
                const feature = new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.fromLonLat([event.longitude, event.latitude])),
                    kind: `${eventType}-eclipse`,
                    eventType,
                    label: eventType === 'lunar' ? 'Lunar eclipse' : 'Solar eclipse',
                    markerLabel: event.markerLabel || String(event.year || 'Eclipse'),
                    eclipse: event
                });
                source.addFeature(feature);
            });
    }

    function formatEclipseTiming(eclipse) {
        const detail = eclipse.localDetails || {};
        const parts = [];
        if (detail.partialBeginUtc) {
            parts.push(`${localized('Mulai', 'Start')} UTC ${formatUtc(new Date(detail.partialBeginUtc))}`);
        }
        if (eclipse.peakUtc) {
            const peakDate = new Date(eclipse.peakUtc);
            parts.push(`${localized('Puncak', 'Peak')} UTC ${formatUtc(new Date(eclipse.peakUtc))}`);
            parts.push(`${localized('Puncak waktu reviewer', 'Reviewer-time peak')} ${formatLocalDateTime(peakDate, getSelectedTimezoneOffset(peakDate))}`);
        }
        if (detail.partialEndUtc) {
            parts.push(`${localized('Selesai', 'End')} UTC ${formatUtc(new Date(detail.partialEndUtc))}`);
        }
        return parts.join(' | ') || '-';
    }

    function buildEclipseInfoHtml(eclipse) {
        const peakDate = eclipse && eclipse.peakUtc ? new Date(eclipse.peakUtc) : null;
        const peakAdm = eclipse && eclipse.adm ? eclipse.adm : {};
        const basis = currentAdmLabels(state.adminContext);
        const title = eclipse && eclipse.eventType === 'lunar'
            ? localized('Informasi Gerhana Bulan', 'Lunar Eclipse Information')
            : localized('Informasi Gerhana Matahari', 'Solar Eclipse Information');
        return infoBoxHtml(title, [
            { label: localized('Jenis/Type gerhana', 'Eclipse type'), value: eclipseTypeLabel(eclipse && eclipse.kind, eclipse && eclipse.eventType) },
            { label: localized('Tanggal gerhana', 'Eclipse date'), value: peakDate ? formatDateOnly(peakDate) : '-' },
            { label: localized('Waktu gerhana', 'Eclipse time'), value: eclipse ? formatEclipseTiming(eclipse) : '-' },
            { label: localized('Durasi', 'Duration'), value: eclipse && Number.isFinite(eclipse.durationSeconds) ? formatDuration(eclipse.durationSeconds) : localized('Estimasi durasi tidak tersedia', 'Duration estimate is not available') },
            { label: localized('Lokasi terjadi', 'Event coordinate'), value: eclipse ? formatCoordinatePair(eclipse.latitude, eclipse.longitude, 4) : '-' },
            { label: localized('Basis koordinat', 'Coordinate basis'), value: eclipse ? eclipse.coordinateBasis : '-' },
            { label: localized('Negara (ADM0)', 'Country (ADM0)'), value: fallbackAdmValue(peakAdm.adm0, basis.adm0, 'ADM0') },
            { label: 'ADM1', value: fallbackAdmValue(peakAdm.adm1, basis.adm1, 'ADM1') },
            { label: 'ADM2', value: fallbackAdmValue(peakAdm.adm2, basis.adm2, 'ADM2') },
            { label: localized('Sumber ADM', 'ADM source'), value: eclipse && eclipse.adm ? textValue(eclipse.adm.source, '-') : '-' },
            { label: localized('Jarak dari gedung', 'Distance from building'), value: eclipse && Number.isFinite(eclipse.distanceKmFromBuilding) ? `${formatNumber(eclipse.distanceKmFromBuilding, 2)} km` : '-' },
            { label: 'Obscuration', value: eclipse && eclipse.obscuration !== null ? formatPercent(eclipse.obscuration, 1) : '-' }
        ]);
    }

    function applyEclipseAdmResults(results) {
        if (!Array.isArray(results) || !state.latestEclipse || !Array.isArray(state.latestEclipse.series)) {
            return false;
        }

        const localCache = readLocalEclipseAdmCache();
        let changed = false;
        results.forEach((item) => {
            if (!item || !item.referenceCode) {
                return;
            }
            const event = state.latestEclipse.series.find((candidate) => {
                return candidate.referenceCode === item.referenceCode
                    && candidate.eventType === item.eventType;
            });
            if (!event) {
                return;
            }
            const nextAdm = mergeAdmLabels(item.adm, event.adm || implementationAdmLabels(), item.source || 'database');
            event.adm = nextAdm;
            event.displayName = textValue(item.displayName, event.displayName || '');
            event.admUpdatedAt = textValue(item.updatedAt, event.admUpdatedAt || '');
            event.admStatus = textValue(item.status, event.admStatus || '');
            localCache[cacheKeyForEclipseAdm(event)] = {
                adm: nextAdm,
                source: nextAdm.source,
                displayName: event.displayName,
                updatedAt: event.admUpdatedAt
            };
            changed = true;
        });

        if (changed) {
            writeLocalEclipseAdmCache(localCache);
            const sorted = state.latestEclipse.series.slice().sort((left, right) => String(left.peakUtc || '').localeCompare(String(right.peakUtc || '')));
            state.latestEclipse.series = sorted;
            state.latestEclipse.solar = sorted.find((event) => event.eventType === 'solar') || null;
            state.latestEclipse.lunar = sorted.find((event) => event.eventType === 'lunar') || null;
            state.latestEclipseSeries = sorted;
            if (state.latestOutput && state.latestOutput.reviewer) {
                state.latestOutput.reviewer.eclipses = state.latestEclipse;
                state.latestOutput.reviewer.solarEclipseMarkers = sorted.filter((event) => event.eventType === 'solar');
                state.latestOutput.reviewer.lunarEclipseMarkers = sorted.filter((event) => event.eventType === 'lunar');
                state.latestOutput.reviewer.eclipseMarkers = sorted;
                const output = byId('apiOutput');
                if (output) {
                    output.textContent = JSON.stringify(state.latestOutput, null, 2);
                }
            }
        }
        return changed;
    }

    async function hydrateEclipseAdm(eclipse) {
        const events = eclipse && Array.isArray(eclipse.series) ? eclipse.series : [];
        if (!events.length || state.eclipseAdmHydrating || !window.fetch) {
            return;
        }

        events.forEach(applyOfflineAdm);
        const payloadEvents = events.map((event) => ({
            eventType: event.eventType,
            referenceCode: event.referenceCode || eclipseReferenceCode(event.eventType || 'solar', event.peakUtc || ''),
            peakUtc: event.peakUtc || '',
            latitude: event.latitude,
            longitude: event.longitude,
            kind: event.kind,
            clientAdm: event.clientAdm || event.adm || implementationAdmLabels()
        }));
        const payloadKey = JSON.stringify({
            online: Boolean(navigator.onLine),
            language: languageMode(),
            implementationAdm: implementationAdmLabels(),
            events: payloadEvents.map((event) => [event.eventType, event.referenceCode, event.latitude, event.longitude, event.clientAdm])
        });
        if (state.lastEclipseAdmKey === payloadKey) {
            return;
        }

        state.lastEclipseAdmKey = payloadKey;
        state.eclipseAdmHydrating = true;
        try {
            const response = await fetch(ECLIPSE_ADM_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                cache: 'no-store',
                body: JSON.stringify({
                    online: Boolean(navigator.onLine),
                    language: languageMode(),
                    implementationAdm: implementationAdmLabels(),
                    events: payloadEvents
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const payload = await response.json();
            const results = payload && payload.data && Array.isArray(payload.data.events)
                ? payload.data.events
                : [];
            if (applyEclipseAdmResults(results)) {
                renderEclipseMarkers(state.latestEclipse);
                renderEclipsePrediction(state.latestEclipse);
            }
        } catch (error) {
            const fallbackRows = payloadEvents.map((event) => ({
                eventType: event.eventType,
                referenceCode: event.referenceCode,
                latitude: event.latitude,
                longitude: event.longitude,
                adm: event.clientAdm || implementationAdmLabels(),
                source: 'offline-admin-context',
                status: 'offline-local'
            }));
            applyEclipseAdmResults(fallbackRows);
        } finally {
            state.eclipseAdmHydrating = false;
        }
    }

    function renderEclipsePrediction(eclipse) {
        renderEclipseMarkers(eclipse);
        if (!eclipse || !eclipse.available || !Array.isArray(eclipse.series) || !eclipse.series.length) {
            setHtml('eclipsePredictionSummary', [
                `<p><strong>${escapeHtml(localized('Status', 'Status'))}</strong> ${escapeHtml(eclipse ? localized(eclipse.messageId, eclipse.messageEn) : localized('Prediksi belum tersedia.', 'Prediction is not available yet.'))}</p>`
            ].join(''));
            return;
        }

        const events = Array.isArray(eclipse.series) ? eclipse.series : [];
        hydrateEclipseAdm(eclipse);
        const solarCount = events.filter((event) => event.eventType === 'solar').length;
        const lunarCount = events.filter((event) => event.eventType === 'lunar').length;
        const lines = [
            `<p><strong>${escapeHtml(localized('Rentang tampil', 'Displayed range'))}</strong> ${escapeHtml(String(eclipse.baseYear || '-'))} - ${escapeHtml(String(eclipse.rangeEndYear || '-'))}</p>`,
            `<p><strong>${escapeHtml(localized('Jumlah titik', 'Point count'))}</strong> ${events.length} (${solarCount} ${escapeHtml(localized('matahari', 'solar'))}, ${lunarCount} ${escapeHtml(localized('bulan', 'lunar'))})</p>`
        ];

        if (eclipse.solar) {
            lines.push(`<p><strong>${escapeHtml(localized('Gerhana matahari berikutnya', 'Next solar eclipse'))}</strong> ${escapeHtml(eclipse.solar.typeLabel || eclipse.solar.kind)} ${escapeHtml(eclipse.solar.peakUtc || '-')}</p>`);
        }
        if (eclipse.lunar) {
            lines.push(`<p><strong>${escapeHtml(localized('Gerhana bulan berikutnya', 'Next lunar eclipse'))}</strong> ${escapeHtml(eclipse.lunar.typeLabel || eclipse.lunar.kind)} ${escapeHtml(eclipse.lunar.peakUtc || '-')}</p>`);
        }

        events.slice(0, 12).forEach((event) => {
            const adm = event.adm || implementationAdmLabels();
            const eventName = event.eventType === 'lunar'
                ? localized('Gerhana Bulan', 'Lunar Eclipse')
                : localized('Gerhana Matahari', 'Solar Eclipse');
            lines.push(`<p><strong>${escapeHtml(event.markerLabel || String(event.year || 'Eclipse'))}</strong> ${escapeHtml(eventName)} - ${escapeHtml(event.typeLabel || event.kind)} - ${escapeHtml(event.peakUtc || '-')} @ ${formatCoordinatePair(event.latitude, event.longitude, 3)} - ${escapeHtml([adm.adm0, adm.adm1, adm.adm2].filter(Boolean).join(' - '))}</p>`);
        });
        if (events.length > 12) {
            lines.push(`<p><strong>${escapeHtml(localized('Lainnya', 'More'))}</strong> ${events.length - 12} ${escapeHtml(localized('titik lain tampil di peta dan JSON.', 'additional points are visible on the map and JSON.'))}</p>`);
        }
        setHtml('eclipsePredictionSummary', lines.join(''));
    }

    function setMetricGrid(id, items) {
        const grid = byId(id);
        grid.innerHTML = '';
        items.forEach(([label, value]) => {
            const item = document.createElement('div');
            item.className = 'metric-item';
            const labelElement = document.createElement('span');
            labelElement.className = 'metric-label';
            labelElement.textContent = label;
            const valueElement = document.createElement('span');
            valueElement.className = 'metric-value';
            valueElement.textContent = value;
            item.append(labelElement, valueElement);
            grid.appendChild(item);
        });
    }

    function updateBadges(snapshot, rukyat) {
        byId('clockBadge').textContent = snapshot.date.toISOString().slice(11, 19) + ' UTC';
        byId('subsolarBadge').textContent =
            `Subsolar ${formatNumber(snapshot.sun.subpoint.lat, 2)}, ${formatNumber(snapshot.sun.subpoint.lon, 2)}`;
        byId('sublunarBadge').textContent =
            `Sublunar ${formatNumber(snapshot.moon.subpoint.lat, 2)}, ${formatNumber(snapshot.moon.subpoint.lon, 2)}`;
        byId('renderDateBadge').textContent = formatUtc(snapshot.date);
        byId('hilalBadge').textContent = `${rukyat.status} ${formatPercent(rukyat.probability, 0)}`;
        byId('networkBadge').textContent = state.networkSource === 'Device clock'
            ? localized('Jam perangkat', 'Device clock')
            : `Network ${formatSignedSeconds(state.networkOffsetMs / 1000)}`;
    }

    function getDailyAstronomyEvents(date) {
        const offsetHours = getSelectedTimezoneOffset(date);
        const key = [
            localYmd(date, offsetHours),
            state.observer.lat.toFixed(4),
            state.observer.lon.toFixed(4),
            offsetHours
        ].join('|');

        if (state.dailyCache.has(key)) {
            return state.dailyCache.get(key);
        }

        const lat = state.observer.lat;
        const lon = state.observer.lon;
        const elevation = state.observer.elevation;
        const events = {
            astroDawn: findAltitudeCrossing(Astronomy.Body.Sun, date, lat, lon, elevation, -18, 'rise', offsetHours),
            nauticalDawn: findAltitudeCrossing(Astronomy.Body.Sun, date, lat, lon, elevation, -12, 'rise', offsetHours),
            civilDawn: findAltitudeCrossing(Astronomy.Body.Sun, date, lat, lon, elevation, -6, 'rise', offsetHours),
            sunrise: findAltitudeCrossing(Astronomy.Body.Sun, date, lat, lon, elevation, -0.833, 'rise', offsetHours),
            sunset: findAltitudeCrossing(Astronomy.Body.Sun, date, lat, lon, elevation, -0.833, 'set', offsetHours),
            civilDusk: findAltitudeCrossing(Astronomy.Body.Sun, date, lat, lon, elevation, -6, 'set', offsetHours),
            nauticalDusk: findAltitudeCrossing(Astronomy.Body.Sun, date, lat, lon, elevation, -12, 'set', offsetHours),
            astroDusk: findAltitudeCrossing(Astronomy.Body.Sun, date, lat, lon, elevation, -18, 'set', offsetHours),
            moonrise: findAltitudeCrossing(Astronomy.Body.Moon, date, lat, lon, elevation, 0, 'rise', offsetHours),
            moonset: findAltitudeCrossing(Astronomy.Body.Moon, date, lat, lon, elevation, 0, 'set', offsetHours)
        };

        state.dailyCache.set(key, events);
        return events;
    }

    function findAltitudeCrossing(body, date, lat, lon, elevation, threshold, mode, offsetHours, startMinute, endMinute) {
        const startMs = localMidnightUtc(date, offsetHours);
        const start = Number.isFinite(startMinute) ? startMinute : 0;
        const end = Number.isFinite(endMinute) ? endMinute : 1440;
        const step = 5;
        let previousMinute = start;
        let previousDate = new Date(startMs + previousMinute * 60000);
        let previousAltitude = getHorizontal(body, previousDate, lat, lon, elevation).altitude - threshold;

        for (let minute = start + step; minute <= end; minute += step) {
            const currentDate = new Date(startMs + minute * 60000);
            const currentAltitude = getHorizontal(body, currentDate, lat, lon, elevation).altitude - threshold;
            const crossedRise = previousAltitude <= 0 && currentAltitude >= 0;
            const crossedSet = previousAltitude >= 0 && currentAltitude <= 0;

            if ((mode === 'rise' && crossedRise) || (mode === 'set' && crossedSet)) {
                const fraction = previousAltitude === currentAltitude
                    ? 0
                    : previousAltitude / (previousAltitude - currentAltitude);
                const crossingMinute = previousMinute + clamp(fraction, 0, 1) * (minute - previousMinute);
                return new Date(startMs + crossingMinute * 60000);
            }

            previousMinute = minute;
            previousAltitude = currentAltitude;
            previousDate = currentDate;
        }

        return null;
    }

    function calculatePrayerTimes(date, lat, lon, offsetHours, methodId, madhab) {
        const method = prayerMethodConfig(methodId);
        const profile = method.publicationParameters || normalizePublicationParameters({}, {});
        const profileSignature = JSON.stringify(profile);
        const cacheKey = [
            localYmd(date, offsetHours),
            Number(lat).toFixed(4),
            Number(lon).toFixed(4),
            Math.round(state.observer.elevation || 0),
            offsetHours,
            methodId,
            madhab,
            profileSignature
        ].join('|');

        if (state.prayerCache.has(cacheKey)) {
            return state.prayerCache.get(cacheKey);
        }

        const elevation = publicationNumber(profile.elevationMeters, state.observer.elevation || 0);
        const referencePressure = Math.max(1, publicationNumber(method.registryPressureHpa, profile.pressureHpa));
        const referenceTemperature = publicationNumber(method.registryTemperatureCelsius, profile.temperatureCelsius);
        const effectiveRefraction = publicationNumber(profile.refractionCorrection, method.registryRefractionCorrection)
            * (publicationNumber(profile.pressureHpa, referencePressure) / referencePressure)
            * ((273 + referenceTemperature) / Math.max(1, 273 + publicationNumber(profile.temperatureCelsius, referenceTemperature)));
        const refractionDelta = effectiveRefraction - publicationNumber(method.registryRefractionCorrection, effectiveRefraction);
        const horizonDip = elevation > 0 ? 0.0347 * Math.sqrt(elevation) : 0;
        const sunriseAltitude = publicationNumber(profile.sunriseAltitudeDegrees, -0.833) - refractionDelta - horizonDip;
        const maghribAltitude = publicationNumber(profile.maghribAltitudeDegrees, -0.833) - refractionDelta - horizonDip;
        const offsets = profile.prayerOffsetsMinutes || {};
        const applyOffset = (value, key) => value
            ? new Date(value.getTime() + publicationNumber(offsets[key], 0) * 60000)
            : null;
        const dhuhr = applyOffset(calculateSolarNoon(date, lon, offsetHours), 'dhuhur');
        const dhuhrMinute = dateToLocalMinutes(dhuhr, offsetHours);
        const asrConfig = asrMethodConfig(madhab);
        const asrAltitude = calculateAsrAltitude(date, lat, madhab);
        const rawMaghrib = findAltitudeCrossing(Astronomy.Body.Sun, date, lat, lon, elevation, maghribAltitude, 'set', offsetHours);
        const maghrib = applyOffset(rawMaghrib, 'maghrib');
        const fajr = applyOffset(findAltitudeCrossing(Astronomy.Body.Sun, date, lat, lon, elevation, -method.fajrAngle, 'rise', offsetHours), 'subuh');
        const sunrise = applyOffset(findAltitudeCrossing(Astronomy.Body.Sun, date, lat, lon, elevation, sunriseAltitude, 'rise', offsetHours), 'syuruq');
        const asr = applyOffset(findAltitudeCrossing(
            Astronomy.Body.Sun,
            date,
            lat,
            lon,
            elevation,
            asrAltitude,
            'set',
            offsetHours,
            Math.max(0, dhuhrMinute),
            1440
        ), 'ashar');
        const rawIsha = method.ishaInterval && rawMaghrib
            ? new Date(rawMaghrib.getTime() + method.ishaInterval * 60000)
            : findAltitudeCrossing(Astronomy.Body.Sun, date, lat, lon, elevation, -method.ishaAngle, 'set', offsetHours);
        const isha = applyOffset(rawIsha, 'isha');
        const dhuha = applyOffset(findAltitudeCrossing(
            Astronomy.Body.Sun,
            date,
            lat,
            lon,
            elevation,
            publicationNumber(profile.dhuhaAltitudeDegrees, 4.5),
            'rise',
            offsetHours
        ), 'dhuha');
        const nextDay = new Date(date.getTime() + 86400000);
        const nextFajr = applyOffset(
            findAltitudeCrossing(Astronomy.Body.Sun, nextDay, lat, lon, elevation, -method.fajrAngle, 'rise', offsetHours),
            'subuh'
        );
        const tahajjud = maghrib && nextFajr
            ? new Date(maghrib.getTime() + (nextFajr.getTime() - maghrib.getTime()) * 2 / 3)
            : null;

        const raw = {
            fajr,
            sunrise,
            dhuhr,
            asr,
            maghrib,
            isha,
            dhuha,
            tahajjud,
            nextFajr
        };
        const formatted = {};
        Object.keys(raw).forEach((key) => {
            formatted[key] = formatLocalClock(raw[key], offsetHours, false);
        });

        const result = {
            date: localYmd(date, offsetHours),
            timezone: getSelectedTimezoneName(),
            timezoneOffset: offsetHours,
            methodId,
            methodName: method.name,
            madhab: asrConfig.name,
            publicationParameters: profile,
            asrAltitude,
            raw,
            formatted
        };

        state.prayerCache.set(cacheKey, result);
        return result;
    }

    function calculateSolarNoon(date, lon, offsetHours) {
        const noonEstimate = new Date(localMidnightUtc(date, offsetHours) + 12 * 3600000);
        const eot = equationOfTimeMinutes(noonEstimate);
        const localMinutes = 720 - 4 * lon - eot + offsetHours * 60;
        return new Date(localMidnightUtc(date, offsetHours) + localMinutes * 60000);
    }

    function calculateAsrAltitude(date, lat, asrMethodId) {
        const declination = solarDeclination(date);
        const factor = asrMethodConfig(asrMethodId).shadowFactor;
        const angle = Math.atan(1 / (factor + Math.tan(Math.abs(degToRad(lat - declination)))));
        return radToDeg(angle);
    }

    function calculatePrayerTimesFast(date, lat, lon, offsetHours, methodId, madhab) {
        const method = prayerMethodConfig(methodId);
        const dhuhr = calculateSolarNoon(date, lon, offsetHours);
        const sunrise = calculateSolarEventFast(date, lat, lon, offsetHours, 90.833, true);
        const maghrib = calculateSolarEventFast(date, lat, lon, offsetHours, 90.833, false);
        const fajr = calculateSolarEventFast(date, lat, lon, offsetHours, 90 + method.fajrAngle, true);
        const asrAltitude = calculateAsrAltitude(date, lat, madhab);
        const asr = calculateSolarEventFast(date, lat, lon, offsetHours, 90 - asrAltitude, false);
        const isha = method.ishaInterval && maghrib
            ? new Date(maghrib.getTime() + method.ishaInterval * 60000)
            : calculateSolarEventFast(date, lat, lon, offsetHours, 90 + method.ishaAngle, false);

        return {
            raw: {
                fajr,
                sunrise,
                dhuhr,
                asr,
                maghrib,
                isha
            }
        };
    }

    function calculateSolarEventFast(date, lat, lon, offsetHours, zenith, isRise) {
        const reference = new Date(localMidnightUtc(date, offsetHours) + 12 * 3600000);
        const declination = degToRad(solarDeclination(reference));
        const latitude = degToRad(lat);
        const zenithRad = degToRad(zenith);
        const cosHourAngle = (
            Math.cos(zenithRad)
            - Math.sin(latitude) * Math.sin(declination)
        ) / (Math.cos(latitude) * Math.cos(declination));

        if (cosHourAngle < -1 || cosHourAngle > 1) {
            return null;
        }

        const hourAngle = radToDeg(Math.acos(cosHourAngle));
        const eot = equationOfTimeMinutes(reference);
        const localMinutes = 720 - 4 * lon - eot + offsetHours * 60 + (isRise ? -hourAngle * 4 : hourAngle * 4);
        return new Date(localMidnightUtc(date, offsetHours) + localMinutes * 60000);
    }

    function getNextPrayer(prayerTimes, date) {
        const order = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        const candidates = order
            .map((key) => ({ key, date: prayerTimes.raw[key] }))
            .filter((item) => item.date instanceof Date && !Number.isNaN(item.date.getTime()))
            .filter((item) => item.date.getTime() >= date.getTime());

        if (!candidates.length && prayerTimes.raw.nextFajr) {
            candidates.push({ key: 'fajr', date: prayerTimes.raw.nextFajr });
        }

        candidates.sort((left, right) => left.date.getTime() - right.date.getTime());
        if (!candidates.length) {
            return null;
        }

        return {
            key: candidates[0].key,
            date: candidates[0].date,
            secondsUntil: (candidates[0].date.getTime() - date.getTime()) / 1000
        };
    }

    function calculateProviderTimeComparison(date, buildingMeanSolar, buildingApparentSolar) {
        const provider = providerPoint();
        if (!provider) {
            return null;
        }

        const offsetHours = getSelectedTimezoneOffset(date);
        const providerMean = meanSolarMinutes(date, provider.lon);
        const providerApparent = apparentSolarMinutes(date, provider.lon);
        const buildingDhuhr = calculateSolarNoon(date, state.observer.lon, offsetHours);
        const providerDhuhr = calculateSolarNoon(date, provider.lon, offsetHours);
        return {
            source: state.providerContext ? state.providerContext.source : 'ip-provider',
            latitude: provider.lat,
            longitude: provider.lon,
            timezone: state.providerContext ? state.providerContext.timezone : '',
            distanceKm: haversineKm(state.observer.lat, state.observer.lon, provider.lat, provider.lon),
            bearingFromBuilding: initialBearing(state.observer.lat, state.observer.lon, provider.lat, provider.lon),
            longitudeDelta: normalize180(provider.lon - state.observer.lon),
            meanSolarTime: formatClockFromMinutes(providerMean),
            apparentSolarTime: formatClockFromMinutes(providerApparent),
            meanSolarDiffSeconds: signedMinuteDifference(providerMean, buildingMeanSolar) * 60,
            apparentSolarDiffSeconds: signedMinuteDifference(providerApparent, buildingApparentSolar) * 60,
            dhuhrDiffSeconds: diffDatesSeconds(providerDhuhr, buildingDhuhr)
        };
    }

    function calculateKaabahTimeComparison(date, buildingMeanSolar, buildingApparentSolar) {
        const kaabah = kaabahPoint();
        const offsetHours = getSelectedTimezoneOffset(date);
        const kaabahOffset = timezoneOffsetForDate(kaabah.timezone, date);
        const effectiveKaabahOffset = Number.isFinite(kaabahOffset) ? kaabahOffset : 3;
        const kaabahMean = meanSolarMinutes(date, kaabah.lon);
        const kaabahApparent = apparentSolarMinutes(date, kaabah.lon);
        const methodId = byId('prayerMethod').value;
        const madhab = byId('asrMadhab').value;
        const buildingPrayer = calculatePrayerTimesFast(
            date,
            state.observer.lat,
            state.observer.lon,
            offsetHours,
            methodId,
            madhab
        );
        const kaabahPrayer = calculatePrayerTimesFast(
            date,
            kaabah.lat,
            kaabah.lon,
            effectiveKaabahOffset,
            methodId,
            madhab
        );
        const spatial = calculateKaabahSpatialComparison();

        return {
            latitude: kaabah.lat,
            longitude: kaabah.lon,
            timezone: kaabah.timezone,
            timezoneOffset: effectiveKaabahOffset,
            distanceKm: spatial.distanceKm,
            bearingFromBuilding: spatial.bearingFromBuilding,
            longitudeDelta: spatial.longitudeDelta,
            meanSolarTime: formatClockFromMinutes(kaabahMean),
            apparentSolarTime: formatClockFromMinutes(kaabahApparent),
            meanSolarDiffSeconds: signedMinuteDifference(kaabahMean, buildingMeanSolar) * 60,
            apparentSolarDiffSeconds: signedMinuteDifference(kaabahApparent, buildingApparentSolar) * 60,
            fajrDiffSeconds: diffDatesSeconds(kaabahPrayer.raw.fajr, buildingPrayer.raw.fajr),
            dhuhrDiffSeconds: diffDatesSeconds(kaabahPrayer.raw.dhuhr, buildingPrayer.raw.dhuhr),
            maghribDiffSeconds: diffDatesSeconds(kaabahPrayer.raw.maghrib, buildingPrayer.raw.maghrib),
            kaabahDhuhrLocal: formatLocalClock(kaabahPrayer.raw.dhuhr, effectiveKaabahOffset, false),
            kaabahMaghribLocal: formatLocalClock(kaabahPrayer.raw.maghrib, effectiveKaabahOffset, false)
        };
    }

    function calculateTimeComparison(date, snapshot) {
        const offsetHours = getSelectedTimezoneOffset(date);
        const civilMinutes = normalizeMinutes(
            date.getUTCHours() * 60
            + date.getUTCMinutes()
            + date.getUTCSeconds() / 60
            + offsetHours * 60
        );
        const meanSolar = meanSolarMinutes(date, state.observer.lon);
        const apparentSolar = apparentSolarMinutes(date, state.observer.lon);
        const siderealHours = normalizeHours(Astronomy.SiderealTime(date) + state.observer.lon / 15);
        const moonHourAngle = normalizeHours(siderealHours - snapshot.moon.horizontal.ra);

        return {
            utcDate: date,
            worldClock: formatLocalDateTime(date, offsetHours),
            networkOffsetSeconds: state.networkOffsetMs / 1000,
            timezoneName: getSelectedTimezoneName(),
            timezoneOffset: offsetHours,
            civilMinutes,
            meanSolarMinutes: meanSolar,
            apparentSolarMinutes: apparentSolar,
            meanSolarTime: formatClockFromMinutes(meanSolar),
            apparentSolarTime: formatClockFromMinutes(apparentSolar),
            equationOfTimeMinutes: equationOfTimeMinutes(date),
            solarCivilOffsetSeconds: signedMinuteDifference(apparentSolar, civilMinutes) * 60,
            localSiderealTime: hoursToClock(siderealHours),
            lunarHourAngleTime: hoursToClock(moonHourAngle),
            providerComparison: calculateProviderTimeComparison(date, meanSolar, apparentSolar),
            kaabahComparison: calculateKaabahTimeComparison(date, meanSolar, apparentSolar)
        };
    }

    function hoursToClock(hours) {
        const totalSeconds = Math.round(normalizeHours(hours) * 3600);
        const h = Math.floor(totalSeconds / 3600) % 24;
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function analyzeDirections(snapshot, basePrayerTimes, nextPrayer) {
        const distanceKm = clamp(Number(byId('directionDistance').value || 50), 1, 1000);
        const offsetHours = getSelectedTimezoneOffset(snapshot.date);
        const baseSolar = apparentSolarMinutes(snapshot.date, state.observer.lon);
        const baseHilal = hilalProbabilityAt(state.observer.lat, state.observer.lon, snapshot);
        const basePrayerKey = nextPrayer && basePrayerTimes.raw[nextPrayer.key] ? nextPrayer.key : 'dhuhr';
        const basePrayerDate = basePrayerTimes.raw[basePrayerKey];

        const methodId = byId('prayerMethod').value;
        const madhab = byId('asrMadhab').value;

        return COMPASS_16.map((direction) => {
            const target = destinationPoint(state.observer.lat, state.observer.lon, direction.bearing, distanceKm);
            const targetSolar = apparentSolarMinutes(snapshot.date, target.lon);
            const targetPrayer = calculatePrayerTimesFast(
                snapshot.date,
                target.lat,
                target.lon,
                offsetHours,
                methodId,
                madhab
            );
            const targetHilal = hilalProbabilityAt(target.lat, target.lon, snapshot);

            return {
                abbr: compassAbbreviation(direction),
                name: compassName(direction),
                bearing: direction.bearing,
                distanceKm,
                lat: target.lat,
                lon: target.lon,
                deltaLat: target.lat - state.observer.lat,
                deltaLon: normalize180(target.lon - state.observer.lon),
                solarDiffSeconds: signedMinuteDifference(targetSolar, baseSolar) * 60,
                prayerKey: basePrayerKey,
                prayerDiffSeconds: diffDatesSeconds(targetPrayer.raw[basePrayerKey], basePrayerDate),
                sunriseDiffSeconds: diffDatesSeconds(targetPrayer.raw.sunrise, basePrayerTimes.raw.sunrise),
                sunsetDiffSeconds: diffDatesSeconds(targetPrayer.raw.maghrib, basePrayerTimes.raw.maghrib),
                hilalProbability: targetHilal.probability,
                lunarVisibilityDiff: (targetHilal.probability - baseHilal.probability) * 100
            };
        });
    }

    function diffDatesSeconds(left, right) {
        if (!(left instanceof Date) || !(right instanceof Date)) {
            return NaN;
        }

        return (left.getTime() - right.getTime()) / 1000;
    }

    function destinationPoint(lat, lon, bearing, distanceKm) {
        const angularDistance = distanceKm / EARTH_RADIUS_KM;
        const bearingRad = degToRad(bearing);
        const lat1 = degToRad(lat);
        const lon1 = degToRad(lon);
        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(angularDistance)
            + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
        );
        const lon2 = lon1 + Math.atan2(
            Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
            Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
        );

        return {
            lat: clamp(radToDeg(lat2), -90, 90),
            lon: normalizeLon(radToDeg(lon2))
        };
    }

    function compassDisplayRadiusPixels(zoom) {
        const currentZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : 8;
        const reviewerDisplay = state.reviewerMode === 'display';
        const radiusAtZoomEight = reviewerDisplay ? 76 : 78;
        const minimumRadius = reviewerDisplay ? 58 : 60;
        return clamp(
            radiusAtZoomEight - Math.max(0, currentZoom - 8) * 3.25,
            minimumRadius,
            radiusAtZoomEight
        );
    }

    function compassDisplayDistanceKm(analysisDistanceKm) {
        const view = state.map && state.map.getView ? state.map.getView() : null;
        const resolution = view ? Number(view.getResolution()) : NaN;
        const zoom = view ? Number(view.getZoom()) : NaN;
        const canonicalDistanceKm = clamp(Number(analysisDistanceKm || 50), 1, 1000);
        if (!Number.isFinite(resolution) || resolution <= 0) {
            return canonicalDistanceKm;
        }

        // Web Mercator resolution is expressed in projected metres per pixel.
        // Correct it for latitude so the compass keeps a compact screen radius
        // without changing the canonical analysis distance returned to tables/API.
        const latitudeScale = Math.max(0.15, Math.cos(degToRad(state.observer.lat)));
        const responsiveDistanceKm = resolution
            * compassDisplayRadiusPixels(zoom)
            * latitudeScale
            / 1000;
        return clamp(Math.min(canonicalDistanceKm, responsiveDistanceKm), 0.05, canonicalDistanceKm);
    }

    function renderDirectionLayer(rows) {
        const source = state.sources.direction;
        source.clear();

        const view = state.map && state.map.getView ? state.map.getView() : null;
        const zoom = view ? Number(view.getZoom()) : NaN;
        const analysisDistanceKm = rows.length ? Number(rows[0].distanceKm || 50) : 50;
        const displayDistanceKm = compassDisplayDistanceKm(analysisDistanceKm);
        const displayRadiusPixels = compassDisplayRadiusPixels(zoom);
        const origin = ol.proj.fromLonLat([state.observer.lon, state.observer.lat]);

        state.latestCompassDisplay = {
            zoom: Number.isFinite(zoom) ? zoom : null,
            analysisDistanceKm,
            displayDistanceKm,
            displayRadiusPixels,
            directionCount: rows.length
        };

        rows.forEach((row) => {
            const displayTarget = destinationPoint(
                state.observer.lat,
                state.observer.lon,
                row.bearing,
                displayDistanceKm
            );
            const target = ol.proj.fromLonLat([displayTarget.lon, displayTarget.lat]);
            const featureProperties = {
                abbr: row.abbr,
                bearing: row.bearing,
                analysisDistanceKm,
                displayDistanceKm
            };
            const line = new ol.Feature({
                geometry: new ol.geom.LineString([origin, target]),
                ...featureProperties,
                kind: 'compass-direction-line'
            });
            const point = new ol.Feature({
                geometry: new ol.geom.Point(target),
                ...featureProperties,
                kind: 'compass-direction-label'
            });
            source.addFeatures([line, point]);
        });
    }

    function calculateRukyat(snapshot) {
        const data = hilalProbabilityAt(state.observer.lat, state.observer.lon, snapshot);
        let status = localized('Rendah', 'Low');
        let recommendation = localized('Pantau parameter bulan lokal; peluang visual belum kuat.', 'Monitor local lunar parameters; visual chance is not strong yet.');
        if (data.probability >= 0.62) {
            status = localized('Tinggi', 'High');
            recommendation = localized('Zona observer mendukung rukyat jika horizon barat bersih.', 'The observer zone supports rukyat if the western horizon is clear.');
        } else if (data.probability >= 0.36) {
            status = localized('Sedang', 'Medium');
            recommendation = localized('Perlu horizon bersih, transparansi atmosfer baik, dan pengamatan optik.', 'Needs a clear horizon, good atmospheric transparency, and optical observation.');
        }

        return {
            ...data,
            status,
            recommendation
        };
    }

    function rebuildTrajectory() {
        if (!state.map || !state.sources.sunTrajectory || !state.sources.moonTrajectory) {
            return;
        }

        window.clearTimeout(state.trajectoryTimer);
        byId('trajectoryStatus').textContent = localized('Menghitung', 'Calculating');

        state.trajectoryTimer = window.setTimeout(() => {
            const sunSource = state.sources.sunTrajectory;
            const moonSource = state.sources.moonTrajectory;
            sunSource.clear();
            moonSource.clear();
            const years = Number(byId('trajectoryYears').value || 5);
            const stepDays = Number(byId('trajectoryStep').value || 14);
            const bodyChoice = byId('trajectoryBody').value;
            const date = getRenderDate();

            if (bodyChoice === 'sun' || bodyChoice === 'both') {
                addDailyBodyTrajectory(sunSource, 'sun', Astronomy.Body.Sun, date);
                addBodyTrajectory(sunSource, 'sun', Astronomy.Body.Sun, date, years, stepDays, 'analemma');
            }
            if (bodyChoice === 'moon' || bodyChoice === 'both') {
                addBodyTrajectory(moonSource, 'moon', Astronomy.Body.Moon, date, years, stepDays, 'orbital');
            }

            syncTrajectoryLayerVisibility();
            byId('trajectoryStatus').textContent = `${years} ${localized('th', 'yr')}, ${stepDays} ${localized('hari', 'days')}`;
        }, 25);
    }

    function addDailyBodyTrajectory(source, bodyName, body, date) {
        const points = [];
        const offsetHours = getSelectedTimezoneOffset(date);
        const startMs = localMidnightUtc(date, offsetHours);
        const stepMinutes = Math.max(15, SOLAR_DAILY_TRAJECTORY_STEP_HOURS * 60);

        for (let minute = 0; minute <= 1440; minute += stepMinutes) {
            points.push(subpointAtDate(body, new Date(startMs + minute * 60000)));
        }

        addTrajectorySegments(source, points, bodyName, 'daily', 'daily');
    }

    function addBodyTrajectory(source, bodyName, body, date, years, stepDays, trajectoryKind) {
        const days = Math.round(years * 365.2425);
        const history = [];
        const future = [];

        for (let day = -days; day <= 0; day += stepDays) {
            history.push(subpointAtDay(body, date, day));
        }
        for (let day = 0; day <= days; day += stepDays) {
            future.push(subpointAtDay(body, date, day));
        }

        addTrajectorySegments(source, history, bodyName, 'history', trajectoryKind || 'orbital');
        addTrajectorySegments(source, future, bodyName, 'future', trajectoryKind || 'orbital');
    }

    function subpointAtDay(body, date, offsetDays) {
        const sampleDate = new Date(date.getTime() + offsetDays * 86400000);
        return subpointAtDate(body, sampleDate);
    }

    function subpointAtDate(body, sampleDate) {
        const subpoint = getSubpoint(body, sampleDate);
        return [subpoint.lon, subpoint.lat];
    }

    function addTrajectorySegments(source, points, bodyName, role, trajectoryKind) {
        let segment = [];

        points.forEach((point) => {
            if (segment.length) {
                const previous = segment[segment.length - 1];
                if (Math.abs(point[0] - previous[0]) > 180) {
                    addTrajectoryFeature(source, segment, bodyName, role, trajectoryKind);
                    segment = [];
                }
            }
            segment.push(point);
        });

        addTrajectoryFeature(source, segment, bodyName, role, trajectoryKind);
    }

    function addTrajectoryFeature(source, segment, bodyName, role, trajectoryKind) {
        if (segment.length < 2) {
            return;
        }

        const feature = new ol.Feature({
            geometry: new ol.geom.LineString(segment.map((point) => ol.proj.fromLonLat(point))),
            body: bodyName,
            role,
            trajectoryKind: trajectoryKind || 'orbital'
        });
        source.addFeature(feature);
    }

    function updateTimelineLabel() {
        const days = Number(byId('timelineSlider').value || 0);
        byId('timelineLabel').textContent = `${days > 0 ? '+' : ''}${days} ${localized('hari', 'days')}`;
    }

    function toggleTimelinePlayback() {
        state.playing = !state.playing;
        const icon = byId('playTimeline').querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', state.playing ? 'pause' : 'play');
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
        setLiveMode(false);
    }

    function playbackTick() {
        if (!state.playing || state.live) {
            return;
        }

        const slider = byId('timelineSlider');
        const speed = clamp(Number(byId('playbackSpeed').value || 7), 0.1, 365);
        const current = Number(slider.value || 0);
        const next = current + speed;
        if (next > Number(slider.max)) {
            slider.value = slider.min;
        } else {
            slider.value = String(Math.round(next));
        }
        updateTimelineLabel();
        updateAll(true);
    }

    function renderApiOutput(snapshot, timeComparison, prayerTimes, directionAnalysis, rukyat, eclipse) {
        const output = buildJsonOutput(snapshot, timeComparison, prayerTimes, directionAnalysis, rukyat, eclipse);
        state.latestOutput = output;
        byId('apiOutput').textContent = JSON.stringify(output, null, 2);
    }

    function buildJsonOutput(snapshot, timeComparison, prayerTimes, directionAnalysis, rukyat, eclipse) {
        return {
            generatedAt: actualNow().toISOString(),
            renderTimeUtc: snapshot.date.toISOString(),
            reviewer: {
                mode: state.reviewerMode,
                language: state.reviewerLanguage,
                admBoundaryMode: state.admBoundaryMode,
                ipComparisonMode: state.ipComparisonMode,
                showIpMarker: state.showIpMarker,
                showKaabahLine: state.showKaabahLine,
                adminContext: state.adminContext,
                providerContext: state.providerContext,
                timeCoordinateCalibration: timeCoordinateCalibrationState(),
                falakRegistry: state.falakRegistry,
                falakRegistrySource: state.falakRegistrySource,
                falakCalendar: state.falakCalendar,
                falakCalendarSource: state.falakCalendarSource,
                timezonesSource: state.timezonesSource,
                timezonesCount: state.timezones.length,
                activeFalakMethods: activeFalakMethods(),
                typedFalakMethods: registryAllMethods(),
                solarEclipse: eclipse && eclipse.solar ? eclipse.solar : null,
                lunarEclipse: eclipse && eclipse.lunar ? eclipse.lunar : null,
                eclipses: eclipse,
                solarEclipseMarkers: state.latestEclipseSeries.filter((event) => event.eventType === 'solar'),
                lunarEclipseMarkers: state.latestEclipseSeries.filter((event) => event.eventType === 'lunar'),
                eclipseMarkers: state.latestEclipseSeries
            },
            observer: {
                latitude: state.observer.lat,
                longitude: state.observer.lon,
                elevationMeters: state.observer.elevation,
                timezone: getSelectedTimezoneName(),
                timezoneOffset: getSelectedTimezoneOffset(snapshot.date)
            },
            solar: {
                altitude: snapshot.sun.horizontal.altitude,
                azimuth: snapshot.sun.horizontal.azimuth,
                subsolarPoint: snapshot.sun.subpoint,
                distanceKm: snapshot.sun.distanceKm
            },
            lunar: {
                phaseName: snapshot.moon.phaseName,
                phaseDegrees: snapshot.moon.phaseDegrees,
                illumination: snapshot.moon.illumination,
                altitude: snapshot.moon.horizontal.altitude,
                azimuth: snapshot.moon.horizontal.azimuth,
                sublunarPoint: snapshot.moon.subpoint,
                distanceKm: snapshot.moon.distanceKm,
                ijtimak: {
                    previousUtc: snapshot.moon.conjunction.previous.toISOString(),
                    nextUtc: snapshot.moon.conjunction.next.toISOString(),
                    ageHours: snapshot.moon.conjunction.ageHours
                }
            },
            timeComparison,
            prayerTimes: serializePrayerTimes(prayerTimes),
            rukyat,
            directionAnalysis
        };
    }

    function serializePrayerTimes(prayerTimes) {
        const raw = {};
        Object.keys(prayerTimes.raw).forEach((key) => {
            raw[key] = prayerTimes.raw[key] instanceof Date ? prayerTimes.raw[key].toISOString() : null;
        });

        return {
            date: prayerTimes.date,
            method: prayerTimes.methodName,
            madhab: prayerTimes.madhab,
            formatted: prayerTimes.formatted,
            rawUtc: raw
        };
    }

    function downloadJson() {
        if (!state.latestOutput) {
            updateAll(false);
        }

        const blob = new Blob([JSON.stringify(state.latestOutput || {}, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `advanced-astro-gis-${actualNow().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    async function copyJson() {
        const text = byId('apiOutput').textContent;
        try {
            await navigator.clipboard.writeText(text);
            setStatus(localized('JSON disalin ke clipboard.', 'JSON copied to clipboard.'));
        } catch (error) {
            setStatus(`${localized('Gagal menyalin JSON', 'Failed to copy JSON')}: ${error.message}`);
        }
    }

    function initInputs() {
        writeObserverInputs();
        // Render the last valid admin context immediately while the remote
        // database request is still being resolved.
        if (!state.adminContext
            && window.MpmAdminLocation
            && typeof window.MpmAdminLocation.read === 'function') {
            // Selection mode never restores an unrelated active building.
        }
        const modeSelect = byId('reviewerModeSelect');
        if (modeSelect) {
            modeSelect.value = state.reviewerMode;
        }
        const queryLanguage = requestedReviewerLanguage();
        state.reviewerLanguage = queryLanguage || state.reviewerLanguage || 'id';
        applyReviewerLanguage();
        const admSelect = byId('admBoundaryMode');
        if (admSelect) {
            state.admBoundaryMode = admSelect.value || state.admBoundaryMode;
        }
        const ipSelect = byId('ipComparisonMode');
        if (ipSelect) {
            state.ipComparisonMode = ipSelect.value || state.ipComparisonMode;
        }
        const eclipseRangeSelect = byId('eclipseRangeSelect');
        if (eclipseRangeSelect) {
            state.eclipseHorizonYears = clamp(Number(eclipseRangeSelect.value || 0), 0, 10);
        }
        applyReviewerMode();
        renderReviewerContext();
        renderProviderContext();
        renderFalakRegistry();
        renderPrayerPublication();
        renderFalakCalendar();
        renderIslamicMethodNarrative();
        setDateTimeInputFromDate(getNetworkNow(), getSelectedTimezoneOffset());
        updateTimelineLabel();
    }

    function preloadLocalAssets() {
        state.moonTextureImage = new Image();
        state.moonTextureImage.onload = () => {
            if (state.map) {
                state.layers.bodies.changed();
            }
            if (state.latestSnapshot) {
                drawMoonCanvas(byId('panelMoonCanvas'), state.latestSnapshot.moon);
            }
        };
        state.moonTextureImage.src = ICONS.moon;
    }

    async function init() {
        if (state.initializationStarted) {
            return;
        }
        state.initializationStarted = true;
        state.initializationStatus = 'INITIALIZING';
        try {
            updateConnectivityBadge();
            initInputs();
            // Publication configuration is database/UI work and remains usable
            // even when the optional astronomy visualization CDN is slow.
            bindPrayerPublicationControls();
            loadPrayerPublication().catch((error) => {
                state.falakPrayerPublicationError = error.message || localized('Konfigurasi metode publik gagal dimuat.', 'Public method configuration failed to load.');
                renderPrayerPublication();
            });
            ensureReady();
            preloadLocalAssets();
            createMap();
            if (state.adminContext) {
                applyAdminContextToObserver(false);
            }
            renderContextMarkers();
            applyRuntimeLayerControls();
            bindControls();
            if (window.MpmMapPresentation) {
                await window.MpmMapPresentation.attach({capture:captureMapPresentation,apply:applyMapPresentation,setLayer:setPresentationLayer});
                document.addEventListener('change', event=>{if(event.target&&(presentationControlIds.includes(event.target.id)||event.target.id==='atmosphereOpacityMap'))window.MpmMapPresentation.changed();});
            }
            if (window.lucide) {
                window.lucide.createIcons();
            }
            updateAll(true);
            rebuildTrajectory();
            registerCoreFeatures();
            updateMapSize();
            completeApplicationReadiness('READY');
            loadAdminContext().catch((error) => {
                setStatus(`${localized('Konteks admin gagal dimuat', 'Admin context failed to load')}: ${error.message}`);
            });
            loadFalakRegistry().catch((error) => {
                state.falakRegistryError = error.message || localized('Registry falak gagal dimuat.', 'Falak registry failed to load.');
                renderFalakRegistry();
            });
            loadFalakCalendar().catch((error) => {
                state.falakCalendarError = error.message || localized('Kalender falak gagal dimuat.', 'Falak calendar failed to load.');
                renderFalakCalendar();
            });
            loadTimezones().catch((error) => {
                state.timezonesError = error.message || localized('Registry zona waktu gagal dimuat.', 'Timezone registry failed to load.');
            });
            initProviderContext().catch((error) => {
                setStatus(`${localized('Konteks IP gagal dimuat', 'IP context failed to load')}: ${error.message}`);
            });
            state.updateTimer = window.setInterval(() => {
                playbackTick();
                updateAll(false);
            }, 1000);
            syncNetworkTime();
        } catch (error) {
            setStatus(error.message || localized('Aplikasi gagal dimulai.', 'Application failed to start.'));
            completeApplicationReadiness('ERROR', error);
        }
    }

    window.AdvancedAstroGIS = {
        getState: () => ({
            mapView: state.map ? {zoom:state.map.getView().getZoom(),center:ol.proj.toLonLat(state.map.getView().getCenter())} : null,
            mapPresentation: state.map ? captureMapPresentation() : null,
            observer: { ...state.observer },
            live: state.live,
            playing: state.playing,
            networkSource: state.networkSource,
            reviewerMode: state.reviewerMode,
            reviewerLanguage: state.reviewerLanguage,
            adminContext: state.adminContext,
            providerContext: state.providerContext,
            timeCoordinateCalibration: timeCoordinateCalibrationState(),
            calibrationLineVisible: Boolean(state.features.calibrationLine && state.features.calibrationLine.getGeometry()),
            falakRegistry: state.falakRegistry,
            kaabah: calculateKaabahSpatialComparison(),
            solarEclipses: state.latestEclipseSeries.filter((event) => event.eventType === 'solar'),
            lunarEclipses: state.latestEclipseSeries.filter((event) => event.eventType === 'lunar'),
            eclipseSeries: state.latestEclipseSeries,
            latestSnapshot: state.latestSnapshot,
            latestOutput: state.latestOutput,
            latestPrayerTimes: state.latestPrayerTimes,
            latestRukyat: state.latestRukyat,
            compassDisplay: state.latestCompassDisplay ? { ...state.latestCompassDisplay } : null
        }),
        getMap: () => state.map,
        observationMethods: () => enabledPrayerMethods().map((method) => prayerMethodConfig(method.methodKey)),
        whenObservationMethodsReady: async () => {
            await applicationReady;
            const deadline = Date.now() + 45000;
            while ((!state.falakRegistryLoaded || state.falakRegistryLoading || state.falakPrayerPublicationLoading) && Date.now() < deadline) {
                await new Promise((resolve) => window.setTimeout(resolve, 100));
            }
            const methods = enabledPrayerMethods().map((method) => prayerMethodConfig(method.methodKey));
            if (!methods.length) throw new Error('Metode Falak belum tersedia. Muat ulang setelah registry siap.');
            return methods;
        },
        getWeatherController: () => weatherOverlayController,
        getAdm0Scope: () => adm0Scope,
        getEarthquakeScope: () => earthquakeScope,
        getAirQualityController: () => airQualityController,
        getVolcanoController: () => volcanoController,
        getFeature: (key) => state.features[key] || null,
        getLayer: (key) => state.layers[key] || null,
        getSource: (key) => state.sources[key] || null,
        getCompassDisplay: () => (state.latestCompassDisplay ? { ...state.latestCompassDisplay } : null),
        whenReady: () => applicationReady,
        getDiagnostics: applicationDiagnostics,
        getFeatureRegistry,
        getFeatureEntry: getFeatureRegistryEntry,
        registerFeature,
        replaceFeatureRegistry,
        unregisterFeature,
        updateMapSize,
        activateTab,
        hidePopup: hideMapInfoPopup,
        getFeatureInfoHtml: (feature) => buildFeatureInfoHtml(feature),
        presentFeature: (feature, options) => presentMapFeatureInfo(feature, options),
        showPopup: (feature, html, coordinate) => {
            return presentMapFeatureInfo(feature, {
                html: html || '',
                coordinate,
                source: 'external-popup',
                dispatchEvent: false,
                updateStatus: false
            }).shown;
        },
        setObserver: (lat, lon, elevation) => {
            state.observer.lat = clamp(Number(lat), -90, 90);
            state.observer.lon = clamp(Number(lon), -180, 180);
            state.observer.elevation = Number(elevation || 0);
            clearComputationCaches();
            writeObserverInputs();
            updateObserverFeature();
            renderContextMarkers();
            updateAll(true);
        },
        setDate: (date) => {
            setLiveMode(false);
            setDateTimeInputFromDate(new Date(date), getSelectedTimezoneOffset());
            byId('timelineSlider').value = '0';
            updateTimelineLabel();
            updateAll(true);
        },
        solarCalculations: (date, lat, lon) => {
            const targetDate = date ? new Date(date) : getRenderDate();
            const targetLat = Number.isFinite(Number(lat)) ? Number(lat) : state.observer.lat;
            const targetLon = Number.isFinite(Number(lon)) ? Number(lon) : state.observer.lon;
            return {
                subsolarPoint: getSubpoint(Astronomy.Body.Sun, targetDate),
                horizontal: getHorizontal(Astronomy.Body.Sun, targetDate, targetLat, targetLon, state.observer.elevation),
                equationOfTimeMinutes: equationOfTimeMinutes(targetDate),
                apparentSolarTime: formatClockFromMinutes(apparentSolarMinutes(targetDate, targetLon))
            };
        },
        lunarCalculations: (date, lat, lon) => {
            const targetDate = date ? new Date(date) : getRenderDate();
            const targetLat = Number.isFinite(Number(lat)) ? Number(lat) : state.observer.lat;
            const targetLon = Number.isFinite(Number(lon)) ? Number(lon) : state.observer.lon;
            const phaseDegrees = Astronomy.MoonPhase(targetDate);
            const illumination = Astronomy.Illumination(Astronomy.Body.Moon, targetDate);
            return {
                sublunarPoint: getSubpoint(Astronomy.Body.Moon, targetDate),
                horizontal: getHorizontal(Astronomy.Body.Moon, targetDate, targetLat, targetLon, state.observer.elevation),
                phaseDegrees,
                phaseName: getMoonPhaseName(phaseDegrees),
                illumination: illumination.phase_fraction,
                ijtimak: estimateIjtimak(targetDate, phaseDegrees)
            };
        },
        timeCalculations: () => state.latestSnapshot
            ? calculateTimeComparison(state.latestSnapshot.date, state.latestSnapshot)
            : null,
        prayerTimes: (date, lat, lon) => {
            const targetDate = date ? new Date(date) : getRenderDate();
            return calculatePrayerTimes(
                targetDate,
                Number.isFinite(Number(lat)) ? Number(lat) : state.observer.lat,
                Number.isFinite(Number(lon)) ? Number(lon) : state.observer.lon,
                getSelectedTimezoneOffset(targetDate),
                byId('prayerMethod').value,
                byId('asrMadhab').value
            );
        },
        rukyat: () => state.latestRukyat,
        solarEclipse: () => state.latestEclipse && state.latestEclipse.solar ? state.latestEclipse.solar : null,
        lunarEclipse: () => state.latestEclipse && state.latestEclipse.lunar ? state.latestEclipse.lunar : null,
        eclipses: () => state.latestEclipse,
        directionAnalysis: () => state.latestDirectionAnalysis,
        exportJSON: () => state.latestOutput,
        reloadAdminContext: loadAdminContext,
        refresh: () => updateAll(true),
        rebuildTrajectory
    };

    window.addEventListener('online', () => {
        updateConnectivityBadge();
        setStatus(localized('Koneksi tersedia, mode online aktif.', 'Connection is available; online mode is active.'));
        state.admLoadKey = '';
        loadAdmBoundaries(state.adminContext);
    });

    window.addEventListener('offline', () => {
        updateConnectivityBadge();
        setStatus(localized('Koneksi terputus, mode offline tetap aktif.', 'Connection is lost; offline mode remains active.'));
        state.admLoadKey = '';
        loadAdmBoundaries(state.adminContext);
    });

    window.addEventListener('mpm:actual-time-status', () => {
        if (state.updateTimer) {
            updateAll(true);
        }
    });

    window.addEventListener('mpm:time-coordinate-calibration', (event) => {
        const calibration = event && event.detail ? event.detail : timeCoordinateCalibrationState();
        if (calibration && calibration.configuration) {
            state.showCalibrationLine = calibration.configuration.showCalibrationLine !== false;
            const toggle = byId('calibrationLineToggle');
            if (toggle && document.activeElement !== toggle) {
                toggle.checked = state.showCalibrationLine;
            }
        }
        if (calibration && calibration.provider
            && validCoordinates(calibration.provider.latitude, calibration.provider.longitude)) {
            state.providerContext = calibration.provider;
            renderProviderContext();
        }
        renderContextMarkers();
        if (state.latestSnapshot) {
            renderApiOutput(
                state.latestSnapshot,
                currentTimeComparison(),
                state.latestPrayerTimes,
                state.latestDirectionAnalysis,
                state.latestRukyat,
                state.latestEclipse
            );
        }
    });

    window.addEventListener(
        window.MpmAdminLocation && window.MpmAdminLocation.UPDATE_EVENT
            ? window.MpmAdminLocation.UPDATE_EVENT
            : 'mpm:admin-location-updated',
        (event) => {
            const identifier = window.MpmBuildingLinks.requested();
            if (identifier && event.detail && event.detail.mosque && event.detail.mosque.buildingIdentifier === identifier) loadAdminContext();
        }
    );

    window.addEventListener('mpm:language-changed', () => {
        state.reviewerLanguage = window.PrayerI18n.getCurrentLanguage();
        if (!state.map) return;
        applyReviewerLanguage();
        renderReviewerContext(); renderProviderContext();
        populateFalakControls();
        populateTimezoneSelect(getSelectedTimezoneName());
        renderFalakRegistry();renderPrayerPublication();renderFalakCalendar();
        if (state.latestSnapshot) updateAll(true);
    });
    window.addEventListener('mpm:building-selected', () => { if (state.map) loadAdminContext(); });
    window.addEventListener('popstate', () => { if (!window.MpmAdvancedPage && state.map) loadAdminContext(); });
    window.addEventListener(window.MpmAdvancedPage ? 'mpm:advanced-mount' : 'DOMContentLoaded', () => {
        const start = () => init();
        if (window.GisRuntime) {
            window.GisRuntime.loadSettings().then(start, start);
        } else {
            start();
        }
    });
}());
