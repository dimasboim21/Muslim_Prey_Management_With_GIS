/* global ol */
(function () {
    'use strict';

    // Ground alert levels only. Aviation colors, VEI and event descriptions do
    // not establish a current ground alert level.
    const ui = value => window.PrayerI18n ? window.PrayerI18n.uiText(value) : value;
    const LEVELS = Object.freeze({
        VD_0: { color: "#1f2937", label: "VD · Kemungkinan punah", meaning: "Kemungkinan punah", detail: "Kategori aktivitas VolcanoDiscovery; bukan status resmi USGS/PVMBG." },
        VD_1: { color: "#2E7D32", label: "VD · Normal / dorman", meaning: "Normal / dorman", detail: "Kategori aktivitas VolcanoDiscovery; bukan status resmi USGS/PVMBG." },
        VD_2: { color: "#FBC02D", label: "VD · Peningkatan aktivitas", meaning: "Peningkatan aktivitas", detail: "Kategori aktivitas VolcanoDiscovery; bukan status resmi USGS/PVMBG." },
        VD_3: { color: "#F57C00", label: "VD · Aktivitas kecil / peringatan erupsi", meaning: "Aktivitas kecil / peringatan erupsi", detail: "Kategori aktivitas VolcanoDiscovery; bukan status resmi USGS/PVMBG." },
        VD_4: { color: "#D32F2F", label: "VD · Erupsi", meaning: "Erupsi", detail: "Kategori aktivitas VolcanoDiscovery; bukan status resmi USGS/PVMBG." },
        VD_5: { color: "#7f1d1d", label: "VD · Erupsi besar", meaning: "Erupsi besar", detail: "Kategori aktivitas VolcanoDiscovery; bukan status resmi USGS/PVMBG." },
        NORMAL: { color: '#2E7D32', meaning: 'Tenang / normal', detail: 'Aktivitas berada pada kondisi latar belakang normal, tidak erupsi.' },
        ADVISORY: { color: '#FBC02D', meaning: 'Mulai tidak normal, perlu dipantau', detail: 'Aktivitas meningkat di atas normal, misalnya gempa atau deformasi tanah. Belum berarti erupsi akan terjadi.' },
        WATCH: { color: '#F57C00', meaning: 'Waspada tinggi / potensi erupsi meningkat', detail: 'Aktivitas meningkat dan potensi erupsi bertambah, waktunya belum pasti; atau erupsi berlangsung dengan bahaya terbatas.' },
        WARNING: { color: '#D32F2F', meaning: 'Bahaya tinggi / erupsi berbahaya', detail: 'Erupsi berbahaya sedang berlangsung, diperkirakan segera terjadi, atau diduga sedang terjadi.' },
        UNKNOWN: { color: '#64748B', meaning: 'Status belum tersedia', detail: 'Sumber belum menyediakan status resmi untuk gunung ini.' },
        MAGMA_I: { color: '#2E7D32', label: 'Level I (Normal)', meaning: 'MAGMA / PVMBG · Normal', detail: 'Aktivitas berfluktuasi tanpa peningkatan yang signifikan. Ikuti rekomendasi resmi untuk gunung terkait.' },
        MAGMA_II: { color: '#FBC02D', label: 'Level II (Waspada)', meaning: 'MAGMA / PVMBG · Waspada', detail: 'Aktivitas mulai meningkat; pada beberapa gunung api dapat terjadi erupsi.' },
        MAGMA_III: { color: '#F57C00', label: 'Level III (Siaga)', meaning: 'MAGMA / PVMBG · Siaga', detail: 'Peningkatan aktivitas semakin nyata atau gunung api mengalami erupsi. Ikuti rekomendasi resmi PVMBG.' },
        MAGMA_IV: { color: '#D32F2F', label: 'Level IV (Awas)', meaning: 'MAGMA / PVMBG · Awas', detail: 'Tingkat aktivitas tertinggi dalam sistem PVMBG. Ikuti rekomendasi resmi dan arahan petugas.' }
    });
    const CACHE_KEY = 'mpm:volcano-map:v1:';
    const MAX_CACHE_AGE = 7 * 86400000;
    const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    const statusOf = (value) => Object.prototype.hasOwnProperty.call(LEVELS, String(value || '').toUpperCase()) ? String(value).toUpperCase() : 'UNKNOWN';
    const displayStatus = (record) => statusOf(record.displayStatus || record.status);
    const statusLabel = (record) => { const key = displayStatus(record); return ui(LEVELS[key].label || key); };
    const priorityRank = (record) => ({ VD_5: 3, VD_4: 2, WARNING: 2, MAGMA_IV: 2, VD_3: 1, WATCH: 1, MAGMA_III: 1 }[displayStatus(record)] || 0);
    const isVD = (record) => record.provider === 'volcanodiscovery' || /^VD_/.test(displayStatus(record));
    function referenceAge(record) {
        if (!isVD(record)) return 'official';
        let stamp = record.sourceUpdatedAt ? Date.parse(record.sourceUpdatedAt) : NaN;
        if (!Number.isFinite(stamp)) {
            const match = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i.exec(record.sourceUpdatedAtRaw || '');
            if (match) {
                const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(match[2].toLowerCase());
                stamp = Date.UTC(Number(match[3]),month,Number(match[1]));
                if (new Date(stamp).getUTCDate() !== Number(match[1])) stamp = NaN;
            }
        }
        if (!Number.isFinite(stamp) || stamp > Date.now()) return 'unknown';
        return Date.now() - stamp <= 30 * 86400000 ? 'recent' : 'old';
    }
    const referenceLabel = (r) => ({official:'Status dari feed otoritas',recent:'Rujukan VD ≤30 hari; bukan konfirmasi resmi',old:'Rujukan VD >30 hari; kondisi sekarang belum terverifikasi',unknown:'Tanggal rujukan VD belum terverifikasi'}[referenceAge(r)]);

    function officialUrl(value) {
        try {
            const url = new URL(String(value || ''));
            return url.protocol === 'https:' && /(^|\.)(usgs\.gov|alaska\.edu|gdacs\.org|esdm\.go\.id|volcanodiscovery\.com)$/.test(url.hostname) ? url.href : '';
        } catch (_) { return ''; }
    }

    function dateText(value) {
        if (!value) return 'Tidak tersedia';
        const date = new Date(value);
        return Number.isFinite(date.getTime()) ? date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' (waktu lokal)' : String(value);
    }

    function mergeFeatures(features) {
        const normalize = (name) => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            .replace(/\b(gunung|mount|mt|volcano)\b/g, '').replace(/[^a-z0-9]/g, '');
        const distance = (a, b) => {
            const rad = Math.PI / 180, lat = (a[1] - b[1]) * rad, lon = (a[0] - b[0]) * rad;
            return 12742 * Math.asin(Math.min(1, Math.sqrt(Math.sin(lat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(lon / 2) ** 2)));
        };
        const rank = (f) => (f.properties.provider === 'volcanodiscovery' ? -50 : 0) + (displayStatus(f.properties) !== 'UNKNOWN' ? 100 : 0) + (!f.properties.stale ? 20 : 0)
            + (f.properties.provider === 'magma' ? 3 : f.properties.provider === 'usgs' ? 2 : 1);
        const merged = [];
        features.slice().sort((a, b) => rank(b) - rank(a) || Date.parse(b.properties.fetchedAt) - Date.parse(a.properties.fetchedAt)).forEach((feature) => {
            const p = feature.properties;
            const number = String(p.volcanoNumber || '');
            const match = merged.find((entry) => entry.members.some((other) => {
                const q = other.properties;
                return (/^\d{6}$/.test(number) && number === String(q.volcanoNumber)) ||
                    (normalize(p.name) && normalize(p.name) === normalize(q.name) && distance(feature.geometry.coordinates, other.geometry.coordinates) <= 15);
            }));
            if (match) match.members.push(feature);
            else merged.push({ feature, members: [feature] });
        });
        return merged.map(({ feature, members }) => ({ ...feature, properties: { ...feature.properties,
            matchedSources: [...new Set(members.map((f) => f.properties.source))].join(', ')
        } }));
    }

    function create(options) {
        const { ol, state, byId } = options;
        const source = new ol.source.Vector({ wrapX: true });
        let enabled = false;
        let loading = false;
        let provider = 'volcanodiscovery';
        let filter = 'PRIORITY';
        let referenceFilter = 'recent';
        let query = '';
        let records = [];
        let meta = {};
        let error = '';
        let requestId = 0;
        let abortController = null;
        let firstFit = true;
        let lastScope = '';
        let currentFeature = null;

        function triangleStyle(feature, resolution) {
            const coordinate = feature.getGeometry().getCoordinates();
            // Constant screen size: the polygon is a position symbol, not a
            // geographic exclusion area or a prediction of eruption extent.
            const radius = (Number(resolution) || 1) * 14;
            const [x, y] = coordinate;
            const triangle = new ol.geom.Polygon([[
                [x, y + radius], [x - radius * 0.866, y - radius * 0.5],
                [x + radius * 0.866, y - radius * 0.5], [x, y + radius]
            ]]);
            const record = feature.get('volcanoRecord');
            const status = displayStatus(record);
            const stale = recordStale(record);
            return new ol.style.Style({
                zIndex: priorityRank(record),
                geometry: triangle,
                fill: new ol.style.Fill({ color: LEVELS[status].color }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2, lineDash: stale ? [3, 2] : undefined }),
                text: new ol.style.Text({
                    text: statusLabel(record) + (stale ? ' · cache' : ''), offsetY: -22,
                    font: 'bold 10px Segoe UI, sans-serif',
                    fill: new ol.style.Fill({ color: '#172033' }),
                    stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
                })
            });
        }

        // Keep position symbols above ADM polygons (100), but below context icons.
        const layer = new ol.layer.Vector({ source, style: triangleStyle, zIndex: 125 });
        // render() already filters each center against the full ADM0 geometry.
        // Clipping the screen-sized triangle would erase small-island markers at low zoom.
        layer.set('adm0CenterFiltered', true);
        function layoutPopup() {
            const popup = byId('astroMapInfoPopup');
            const open = enabled && popup && !popup.classList.contains('hidden') && Boolean(popup.querySelector('.volcano-popup'));
            document.body.classList.toggle('volcano-popup-open', Boolean(open));
            if (popup && popup.parentElement) popup.parentElement.classList.toggle('volcano-popup-dock', Boolean(open));
        }

        function mapPadding() {
            const size = state.map.getSize();
            const topbar = document.querySelector('.topbar');
            const top = Math.min(size[1] * 0.25, (topbar ? topbar.getBoundingClientRect().bottom : 70) + 20);
            const tools = document.querySelector('.map-tools, .astro-map-drawer');
            const rect = tools && tools.getBoundingClientRect();
            const narrow = size[0] <= 700;
            return [top, 30, narrow && rect ? Math.min(size[1] * 0.52, size[1] - rect.top + 20) : 65,
                !narrow && rect ? Math.min(size[0] * 0.45, rect.right + 20) : 30];
        }

        function centerSelected(feature) {
            if (!state.map) return;
            const size = state.map.getSize();
            const popup = byId('astroMapInfoPopup');
            const rect = popup && popup.getBoundingClientRect();
            const topbar = document.querySelector('.topbar');
            const top = (topbar ? topbar.getBoundingClientRect().bottom : 90) + 20;
            const narrow = size[0] <= 700;
            const pixel = narrow ? [size[0] / 2, (top + (rect ? rect.top : size[1] * 0.55)) / 2]
                : [(rect ? rect.left : size[0] - 350) / 2, (top + size[1] - 50) / 2];
            state.map.getView().cancelAnimations();
            state.map.getView().centerOn(feature.getGeometry().getCoordinates(), size, pixel);
        }
        function recordStale(record) {
            return navigator.onLine === false || record.stale || Date.now() - Date.parse(record.fetchedAt) > (Number(record.cacheTtlSeconds) || 300) * 1000;
        }
        function isStale() {
            const fetched = Date.parse(meta.fetchedAt);
            return Boolean(navigator.onLine === false || meta.stale || !Number.isFinite(fetched) || Date.now() - fetched > (Number(meta.cacheTtlSeconds) || 300) * 1000);
        }

        function closeOwnPopup() {
            if (state.activePopupFeatureKey && state.activePopupFeatureKey.indexOf('online-volcano:') === 0) options.hidePopup();
            currentFeature = null;
        }

        function popupHtml(feature) {
            const record = feature.get('volcanoRecord') || {};
            const status = displayStatus(record);
            const level = LEVELS[status];
            const coordinate = ol.proj.toLonLat(feature.getGeometry().getCoordinates());
            const sourceUrl = officialUrl(record.sourceUrl);
            const sourceTime = record.sourceUpdatedAt ? dateText(record.sourceUpdatedAt)
                : record.sourceUpdatedAtRaw ? record.sourceUpdatedAtRaw + ' (waktu sesuai sumber)' : 'Tidak tersedia';
            const rows = [
                ['Wilayah', record.region || 'Tidak tersedia'],
                ['Koordinat', coordinate[1].toFixed(6) + ', ' + coordinate[0].toFixed(6)],
                ['Sumber status', record.source || meta.source || provider.toUpperCase()],
                ['Sumber digabung', record.matchedSources || record.source],
                ['Status asli sumber', record.nativeStatus || 'Tidak tersedia'],
                [isVD(record) ? 'Tanggal rujukan / pembaruan VD' : 'Waktu status dari sumber', sourceTime],
                ['Diunduh aplikasi (bukan tanggal status)', dateText(record.fetchedAt || meta.fetchedAt)],
                ['Keterkinian rujukan', referenceLabel(record)]
            ];
            if (record.aviationColorCode) rows.push(['Kode penerbangan (terpisah)', record.aviationColorCode]);
            return '<section class="volcano-popup"><button type="button" class="astro-popup-close" data-popup-close aria-label="Tutup informasi gunung">×</button>'
                + '<h4>' + esc(record.name || 'Gunung api') + '</h4>'
                + '<span class="volcano-status-badge" data-status="' + status + '"><i class="volcano-triangle" data-status="' + status + '"></i>' + esc(statusLabel(record)) + '</span>'
                + '<p><strong>' + esc(ui(level.meaning)) + '</strong><br>' + esc(ui(level.detail)) + '</p>'
                + (isVD(record) ? '<p class="volcano-stale-note"><strong>' + esc(referenceLabel(record)) + '</strong><br>Tanggal unduh tidak membuktikan kategori ini masih berlaku. Rujukan lama tidak berarti gunung sudah normal.</p>' : '')
                + (recordStale(record) ? '<p class="volcano-stale-note"><strong>Data tersimpan — status terkini belum terverifikasi.</strong></p>' : '')
                + '<dl class="volcano-popup-meta">' + rows.map(([label, value]) => '<dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd>').join('') + '</dl>'
                + (record.activityNotice ? '<p class="volcano-stale-note">' + esc(record.activityNotice) + '</p>' : '')
                + (record.synopsis ? '<p>' + esc(record.synopsis) + '</p>' : '')
                + '<p>Segitiga menandai posisi gunung, bukan radius bahaya.</p>'
                + (sourceUrl ? '<a href="' + esc(sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + (isVD(record) ? 'Buka rujukan VolcanoDiscovery' : 'Buka sumber resmi') + '</a>' : '')
                + (provider === 'gdacs' && /indonesia/i.test(record.country || record.region || '') ? '<p><a href="https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas" target="_blank" rel="noopener noreferrer">Lihat tingkat aktivitas Indonesia di MAGMA / PVMBG</a></p>' : '') + '</section>';
        }

        function validatePayload(payload, sourceProvider = provider) {
            if (!payload || payload.success !== true || payload.type !== 'FeatureCollection' || !Array.isArray(payload.features) || !payload.meta) throw new Error('Format data gunung tidak valid.');
            const fetched = Date.parse(payload.meta.fetchedAt);
            if (!Number.isFinite(fetched) || fetched > Date.now() + 300000 || Date.now() - fetched > MAX_CACHE_AGE) throw new Error('Data gunung sudah melewati batas umur cache.');
            const ids = new Set();
            return payload.features.filter((item) => {
                const coordinates = item && item.geometry && item.geometry.coordinates;
                const valid = item && item.geometry && item.geometry.type === 'Point' && item.properties && typeof item.properties.name === 'string' && item.id != null
                    && Array.isArray(coordinates) && coordinates.length >= 2
                    && coordinates.slice(0, 2).every((value) => typeof value === 'number' && Number.isFinite(value))
                    && Math.abs(coordinates[0]) <= 180 && Math.abs(coordinates[1]) <= 90 && !ids.has(String(item.id));
                if (valid) ids.add(String(item.id));
                return valid;
            }).map((item) => ({ ...item, properties: { ...item.properties,
                // GDACS is a location catalog; its colors are not USGS alerts.
                status: sourceProvider === 'usgs' && ['NORMAL', 'ADVISORY', 'WATCH', 'WARNING'].includes(item.properties.status) ? item.properties.status : 'UNKNOWN',
                displayStatus: sourceProvider === 'volcanodiscovery' && /^VD_[0-5]$/.test(item.properties.displayStatus) ? item.properties.displayStatus : sourceProvider === 'magma' && ['MAGMA_I', 'MAGMA_II', 'MAGMA_III', 'MAGMA_IV'].includes(item.properties.displayStatus) ? item.properties.displayStatus
                    : sourceProvider === 'usgs' && ['NORMAL', 'ADVISORY', 'WATCH', 'WARNING'].includes(item.properties.status) ? item.properties.status : 'UNKNOWN'
            } }));
        }

        function readCache(sourceProvider = provider) {
            try {
                const cached = JSON.parse(localStorage.getItem(CACHE_KEY + sourceProvider) || 'null');
                validatePayload(cached, sourceProvider);
                return cached;
            } catch (_) { return null; }
        }

        function fit() {
            if (!source.getFeatures().length || !state.map) return;
            state.map.getView().fit(source.getExtent(), { padding: mapPadding(), maxZoom: 8, duration: 350 });
        }

        function render() {
            closeOwnPopup();
            source.clear();
            const search = query.trim().toLocaleLowerCase();
            const visible = records.filter((item) => (!options.scope || !options.isLocal() || options.scope.contains(ol.proj.fromLonLat(item.geometry.coordinates))) && (filter === 'ALL' || (filter === 'PRIORITY' ? priorityRank(item.properties) > 0 : displayStatus(item.properties) === filter))
                && (referenceFilter === 'all' || !isVD(item.properties) || referenceAge(item.properties) === 'recent')
                && (!search || [item.properties.name, item.properties.region, item.properties.volcanoNumber].join(' ').toLocaleLowerCase().includes(search)))
                .sort((a, b) => priorityRank(b.properties) - priorityRank(a.properties) || a.properties.name.localeCompare(b.properties.name));
            source.addFeatures(visible.map((item) => {
                const feature = new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.fromLonLat(item.geometry.coordinates)),
                    kind: 'online-volcano', label: item.properties.name,
                    popupKey: String(item.id), volcanoStatus: item.properties.status, volcanoRecord: item.properties
                });
                feature.setId(String(item.id));
                return feature;
            }));
            const list = byId('volcanoList');
            const note = byId('volcanoReferenceNote');
            if (note) note.textContent = referenceFilter === 'recent' ? 'VD: hanya rujukan bertanggal ≤30 hari. Rujukan lama/tanpa tanggal disembunyikan, bukan dianggap normal. Status resmi tetap mengikuti feed otoritas.' : 'Semua rujukan VD ditampilkan, termasuk yang lama/tanpa tanggal. Warna VD bukan bukti kondisi saat ini.';
            if (list) {
                list.innerHTML = visible.slice(0, 100).map((item) => '<div role="listitem"><button type="button" class="volcano-list-item" data-volcano-id="' + esc(item.id) + '">'
                    + '<i class="volcano-triangle" data-status="' + displayStatus(item.properties) + '"></i><span><strong class="volcano-list-name" translate="no">' + esc(item.properties.name)
                    + '</strong><span class="volcano-list-meta">' + esc(statusLabel(item.properties) + ' · ' + (item.properties.region || item.properties.source || '') + (item.properties.provider === 'volcanodiscovery' ? ' · Pembaruan sumber: ' + (item.properties.sourceUpdatedAtRaw || 'tanggal tidak tersedia') : '')) + '</span></span></button></div>').join('')
                    || '<p class="volcano-empty">' + (loading ? 'Memuat gunung api…' : error && !records.length ? 'Data belum tersedia. Coba perbarui.' : 'Tidak ada gunung yang cocok dengan filter status dan umur rujukan. Pilih Semua status dan/atau Semua rujukan untuk melihat data lainnya; hasil kosong bukan berarti tidak ada bahaya.') + '</p>';
                if (visible.length > 100) list.insertAdjacentHTML('beforeend', '<p class="volcano-empty">100 hasil pertama ditampilkan. Persempit pencarian; semua hasil tetap ada di peta.</p>');
            }
            updateInfo();
        }

        function updateInfo() {
            const status = byId('volcanoDataStatus');
            if (status) status.textContent = loading && !records.length ? 'Memuat data gunung api…' : source.getFeatures().length + ' / ' + records.length + ' gunung · '
                + (error && !records.length ? 'Data tidak tersedia' : isStale() ? 'Data tersimpan · belum terverifikasi terkini' : 'Data sumber berhasil diambil') + (error ? ' · ' + error : '');
            const info = byId('volcanoSourceInfo');
            if (info) info.textContent = (meta.coverage || (provider === 'magma' ? 'Indonesia · status asli Level I–IV dari MAGMA/PVMBG.' : provider === 'usgs' ? 'Status resmi mencakup gunung dalam pemantauan USGS, bukan seluruh dunia.' : 'GDACS menyediakan lokasi gunung dunia. Status empat tingkat belum tersedia dari sumber ini.'))
                + (meta.fetchedAt ? ' Diambil: ' + dateText(meta.fetchedAt) + '.' : '')
                + ' Pembaruan otomatis setiap 5 menit selama layer aktif.' + (meta.warning ? ' ' + meta.warning : '');
            const sourceLink = byId('onlineMapOpenLink');
            if (enabled && sourceLink) sourceLink.href = provider === 'volcanodiscovery' ? 'https://www.volcanodiscovery.com/volcanoes.html' : provider === 'magma' ? 'https://magma.esdm.go.id/v1' : provider === 'gdacs' ? 'https://www.gdacs.org/Volcanoes/' : 'https://www.usgs.gov/programs/VHP/volcano-updates';
            const refreshButton = byId('volcanoRefreshButton');
            if (refreshButton) refreshButton.disabled = !enabled || loading;
            const fitButton = byId('volcanoFitButton');
            if (fitButton) fitButton.disabled = !enabled || !source.getFeatures().length;
            if (currentFeature && state.activePopupFeatureKey === 'online-volcano:' + currentFeature.get('popupKey')) {
                options.presentFeature(currentFeature, { html: popupHtml(currentFeature), persistHtml: false, updateStatus: false, dispatchEvent: false });
            }
        }

        async function refresh() {
            if (!enabled) return;
            const token = ++requestId;
            if (abortController) abortController.abort();
            const controller = abortController = new AbortController();
            loading = true;
            error = '';
            const optional = provider === 'combined';
            const providers = optional ? ['volcanodiscovery', 'usgs', 'magma', 'gdacs'] : [provider];
            const results = new Map();
            const failures = new Map();
            function publish() {
                if (!enabled || token !== requestId) return;
                records = mergeFeatures(Array.from(results.values()).flatMap((payload) => payload.features));
                const dates = records.map((f) => Date.parse(f.properties.fetchedAt)).filter(Number.isFinite);
                meta = { fetchedAt: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
                    stale: records.some((f) => f.properties.stale), cacheTtlSeconds: ['volcanodiscovery', 'gdacs'].includes(provider) ? 3600 : 300,
                    coverage: provider === 'combined' ? 'Gabungan VolcanoDiscovery, USGS, MAGMA/PVMBG, dan GDACS. Status VD merupakan interpretasi berkala, bukan real-time atau status resmi.' : provider === 'volcanodiscovery' ? 'VolcanoDiscovery: hanya data gunung api. Pembaruan berkala, bukan real-time; kategori merupakan interpretasi sumber. Tanggal status tercantum pada setiap gunung.' : undefined,
                    warning: Array.from(failures.values()).join(' ') };
                error = records.length ? '' : Array.from(failures.values()).join(' ');
                render();
                if (firstFit && source.getFeatures().length) { firstFit = false; fit(); }
            }
            // Restore each source immediately; a slow or failed provider never hides another.
            providers.forEach((name) => {
                const cached = readCache(name);
                if (cached) results.set(name, prepare(cached, name, true));
            });
            function prepare(payload, name, stale) {
                return { features: validatePayload(payload, name).map((f) => ({ ...f, properties: {
                    ...f.properties, provider: name, fetchedAt: payload.meta.fetchedAt,
                    stale: Boolean(stale || payload.meta.stale), cacheTtlSeconds: payload.meta.cacheTtlSeconds
                } })) };
            }
            publish();
            await Promise.allSettled(providers.map(async (name) => {
                const request = new AbortController();
                const abort = () => request.abort();
                controller.signal.addEventListener('abort', abort, { once: true });
                const timer = window.setTimeout(abort, 45000);
                try {
                    if (navigator.onLine === false) throw new Error('offline');
                    const response = await fetch('api/volcanoes.php?provider=' + name + (optional ? '&optional=1' : ''), { signal: request.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    const payload = await response.json();
                    if (payload.success !== true) throw new Error(payload.error || 'Sumber belum tersedia');
                    const prepared = prepare(payload, name, false);
                    if (!enabled || token !== requestId) return;
                    results.set(name, prepared);
                    try { localStorage.setItem(CACHE_KEY + name, JSON.stringify(payload)); } catch (_) {}
                } catch (failure) {
                    failures.set(name, name.toUpperCase() + ': ' + (failure.name === 'AbortError' ? 'waktu tunggu habis' : failure.message) + (results.has(name) ? ' (memakai data tersimpan).' : ' (data belum tersedia).'));
                } finally {
                    window.clearTimeout(timer);
                    controller.signal.removeEventListener('abort', abort);
                    publish();
                }
            }));
            if (enabled && token === requestId) { loading = false; publish(); }
        }

        function setEnabled(value, overlay) {
            const wasEnabled = enabled;
            enabled = Boolean(value);
            document.body.classList.toggle('volcano-map-active', enabled);
            const controls = byId('volcanoMapControls');
            if (controls) controls.classList.toggle('hidden', !enabled);
            if (!enabled) {
                requestId++;
                if (abortController) abortController.abort();
                loading = false;
                closeOwnPopup();
                layoutPopup();
                return;
            }
            if (overlay && !overlay.getLayers().getArray().includes(layer)) overlay.getLayers().push(layer);
            const scopeKey = options.scope && options.isLocal() ? options.scope.getState().key : 'global';
            if (!wasEnabled || scopeKey !== lastScope) firstFit = true;
            lastScope = scopeKey;
            refresh();
        }

        function bind(id, type, handler) {
            const element = byId(id);
            if (element) element.addEventListener(type, handler);
        }
        function updateStatusChoices() {
            const select = byId('volcanoStatusFilter');
            const keys = provider === 'volcanodiscovery' ? ['VD_0', 'VD_1', 'VD_2', 'VD_3', 'VD_4', 'VD_5', 'UNKNOWN'] : provider === 'combined' ? Object.keys(LEVELS) : provider === 'magma' ? ['MAGMA_I', 'MAGMA_II', 'MAGMA_III', 'MAGMA_IV', 'UNKNOWN'] : ['NORMAL', 'ADVISORY', 'WATCH', 'WARNING', 'UNKNOWN'];
            if (select) {
                select.innerHTML = "<option value=\"PRIORITY\" data-i18n=\"ui.1ddd1921\">Prioritas oranye &amp; merah</option><option value=\"ALL\" data-i18n=\"ui.cfe7c928\">Semua status</option>" + keys.map((key) => '<option value="' + key + '">' + esc(ui(LEVELS[key].label || key)) + '</option>').join('');
                select.value = filter;
            }
            const legend = byId('volcanoLegend');
            if (legend) legend.querySelector('dl').innerHTML = keys.map((key) => '<div><dt><span class="volcano-triangle" data-status="' + key + '"></span>' + esc(ui(LEVELS[key].label || key)) + '</dt><dd>' + esc(ui(LEVELS[key].detail)) + '</dd></div>').join('');
        }
        window.addEventListener('mpm:language-changed',()=>{updateStatusChoices();render();updateInfo();});
        updateStatusChoices();
        const statusSelect = byId('volcanoStatusFilter');
        if (statusSelect && !byId('volcanoReferenceFilter')) {
            const label = document.createElement('label');label.textContent = 'Rujukan VolcanoDiscovery ';
            const select = document.createElement('select');select.id = 'volcanoReferenceFilter';
            select.innerHTML = "<option value=\"recent\">Rujukan ≤30 hari (default)</option><option value=\"all\" data-i18n=\"ui.1b0a6e06\">Semua, termasuk lama/tanpa tanggal</option>";
            label.appendChild(select);statusSelect.parentElement.insertAdjacentElement('afterend',label);
            const note = document.createElement('p');note.id='volcanoReferenceNote';note.className='volcano-empty';label.insertAdjacentElement('afterend',note);
            select.addEventListener('change',()=>{referenceFilter=select.value;render();});
        }
        bind('volcanoProviderSelect', 'change', (event) => {
            provider = ['combined', 'gdacs', 'magma', 'volcanodiscovery'].includes(event.target.value) ? event.target.value : 'usgs';
            filter = 'PRIORITY';
            updateStatusChoices();
            records = [];
            meta = {};
            firstFit = true;
            render();
            refresh();
        });
        bind('volcanoStatusFilter', 'change', (event) => { filter = event.target.value; render(); });
        bind('volcanoSearchInput', 'input', (event) => { query = event.target.value; render(); });
        bind('volcanoRefreshButton', 'click', refresh);
        bind('volcanoFitButton', 'click', fit);
        bind('volcanoList', 'click', (event) => {
            const button = event.target.closest('[data-volcano-id]');
            const feature = button && source.getFeatureById(button.dataset.volcanoId);
            if (!feature || !state.map) return;
            state.map.getView().setZoom(7);
            options.presentFeature(feature, { source: 'volcano-list' });
        });
        window.addEventListener('mpm:astro-feature-focused', (event) => {
            currentFeature = event.detail && event.detail.kind === 'online-volcano' ? event.detail.feature : null;
            layoutPopup();
            if (currentFeature && enabled) centerSelected(currentFeature);
        });
        window.addEventListener('offline', () => {
            if (!enabled) return;
            meta = { ...meta, stale: true };
            error = 'Koneksi offline.';
            layer.changed();
            updateInfo();
        });
        window.addEventListener('online', () => { if (enabled) refresh(); });
        document.addEventListener('visibilitychange', () => { if (enabled && !document.hidden && isStale()) refresh(); });
        window.setInterval(() => { if (enabled && !document.hidden) { layer.changed(); updateInfo(); } }, 30000);

        return { setEnabled, refresh, popupHtml, layoutPopup, getSource: () => source, getLayer: () => layer,
            getState: () => ({ enabled, loading, provider, filter, referenceFilter, query, featureCount: source.getFeatures().length, totalCount: records.length, stale: isStale(), error, meta: { ...meta } }) };
    }

    window.MpmVolcanoMap = { create, levels: LEVELS, statusOf, mergeFeatures };
}());
