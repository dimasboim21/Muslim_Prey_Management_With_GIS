(function (window, document) {
    'use strict';

    function ui(value) { return window.PrayerI18n ? window.PrayerI18n.uiText(value) : value; }

    var LAYERS = [
        ['wind', 'Angin', 'wind', 'Arah & kecepatan'],
        ['rain', 'Radar hujan', 'radar', 'Pengamatan radar'],
        ['cloud', 'Satelit harian', 'satellite', 'Citra satelit harian NASA Terra'],
        ['temperature', 'Suhu', 'thermometer', 'Suhu udara'],
        ['precipitation', 'Curah hujan', 'rain', 'Prakiraan hujan'],
        ['cloud-cover', 'Tutupan awan', 'cloud', 'Persentase awan'],
        ['pressure', 'Tekanan', 'pressure', 'Tekanan permukaan laut'],
        ['storm', 'Badai', 'storm', 'Peristiwa aktif']
    ];
    var ICONS = {
        wind: '<path d="M3 8h11a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 16h5a3 3 0 1 1-3 3"/>',
        radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 7-7M12 3v2M3 12h2M12 19v2M19 12h2"/>',
        satellite: '<path d="m7 7 10 10M5 9l4-4 3 3-4 4-3-3ZM12 16l4-4 3 3-4 4-3-3ZM3 16a5 5 0 0 0 5 5M3 12a9 9 0 0 0 9 9M15 3l6 6"/>',
        thermometer: '<path d="M9 14.5V5a3 3 0 0 1 6 0v9.5a5 5 0 1 1-6 0Z"/><path d="M12 8v10M17 5h3M17 9h2"/>',
        rain: '<path d="M6 14a4 4 0 0 1 0-8 6 6 0 0 1 11-1 4.5 4.5 0 0 1 1 9M7 17l-1 3M12 17l-1 3M17 17l-1 3"/>',
        cloud: '<path d="M6 18a5 5 0 1 1 1-10 6 6 0 0 1 11 0 5 5 0 0 1 0 10H6Z"/>',
        pressure: '<circle cx="12" cy="12" r="9"/><path d="m12 12 4-4M5 12h2M12 5v2M17 12h2M9 17h6"/><circle cx="12" cy="12" r="1"/>',
        storm: '<path d="M7 14a4 4 0 0 1-1-8 6 6 0 0 1 11-1 4.5 4.5 0 0 1 1 9M13 10l-4 7h5l-3 6"/>',
        globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',
        search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
        settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
        close: '<path d="m6 6 12 12M6 18 18 6"/>',
        previous: '<path d="m14 6-6 6 6 6"/>',
        next: '<path d="m10 6 6 6-6 6"/>',
        play: '<path d="m8 5 11 7-11 7V5Z"/>',
        pause: '<path d="M8 5v14M16 5v14"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        minus: '<path d="M5 12h14"/>',
        locate: '<circle cx="12" cy="12" r="6"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1"/>',
        fullscreen: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
        refresh: '<path d="M20 7V2l-4 4M4 17v5l4-4M20 7a9 9 0 0 0-15-2M4 17a9 9 0 0 0 15 2"/>'
    };

    function icon(name) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.globe) + '</svg>';
    }

    function button(id, name, label, extraClass) {
        label = ui(label);
        return '<button type="button" id="' + id + '" class="wx-icon-button ' + (extraClass || '') + '" aria-label="' + label + '" title="' + label + '">' + icon(name) + '</button>';
    }

    function safeUrl(url) {
        try {
            var parsed = new URL(url, window.location.href);
            return /^https?:$/.test(parsed.protocol) ? parsed.href : '';
        } catch (error) {
            return '';
        }
    }

    function displayTime(time, options) {
        var date = new Date(time);
        if (!isFinite(date.getTime())) return 'Waktu belum tersedia';
        return date.toLocaleString(window.PrayerI18n?.getCurrentLanguage()==='en'?'en-US':'id-ID', options || { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function valueText(value, unit) {
        if (value === null || value === undefined || value === '' || (typeof value === 'number' && !isFinite(value))) return 'Tidak tersedia';
        return String(value) + (unit ? ' ' + unit : '');
    }

    function mount(options) {
        options = options || {};
        var controller = options.controller;
        var map = options.map;
        if (!controller || !map || document.getElementById('weatherExplorer')) return null;

        var root = document.createElement('section');
        root.id = 'weatherExplorer';
        root.className = 'weather-explorer';
        root.setAttribute('aria-label', 'Penjelajah cuaca');
        root.hidden = true;
        root.innerHTML = '<header class="wx-header wx-surface">' +
            '<div class="wx-brand"><span class="wx-brand-icon">' + icon('globe') + '</span><div><strong>Peta cuaca</strong><span>Jelajahi kondisi & prakiraan</span></div></div>' +
            "<form id=\"wxSearchForm\" class=\"wx-search\" role=\"search\"><label class=\"wx-sr-only\" for=\"wxSearchInput\"><span data-i18n=\"ui.7fdc33b2\">Cari kota atau koordinat lintang, bujur</span></label>" +
            "<input id=\"wxSearchInput\" type=\"search\" placeholder=\"Cari kota atau lintang, bujur\" autocomplete=\"off\" maxlength=\"160\" aria-controls=\"wxSearchResults\" aria-expanded=\"false\" data-i18n-placeholder=\"ui.c80b859b\">" +
            "<button type=\"submit\" class=\"wx-icon-button\" aria-label=\"Cari lokasi\" title=\"Cari lokasi\" data-i18n-title=\"ui.547c64a1\" data-i18n-aria-label=\"ui.547c64a1\">" + icon('search') + '</button>' +
            '<div id="wxSearchResults" class="wx-search-results wx-surface" hidden></div></form>' +
            '<button id="wxExit" type="button" class="wx-exit">' + icon('close') + "<span><span data-i18n=\"ui.b311ca8c\">Tutup cuaca</span></span></button></header>" +
            "<aside class=\"wx-sidebar wx-surface\" aria-label=\"Lapisan dan pengaturan cuaca\" data-i18n-aria-label=\"ui.99d330dc\"><div class=\"wx-section-label\"><span data-i18n=\"ui.f798c27b\">LAPISAN PETA</span></div><nav class=\"wx-layer-list\" aria-label=\"Pilih lapisan cuaca\" data-i18n-aria-label=\"ui.aae613ea\">" +
            LAYERS.map(function (layer) {
                return '<button type="button" class="wx-layer-button" data-weather-layer="' + layer[0] + '" aria-pressed="false" title="' + ui(layer[3]) + '">' + icon(layer[2]) + '<span>' + ui(layer[1]) + '</span></button>';
            }).join('') + '</nav>' +
            '<details id="wxSettings" class="wx-settings"><summary>' + icon('settings') + "<span><span data-i18n=\"ui.cff2da1c\">Pengaturan</span></span></summary><div class=\"wx-settings-content wx-surface\">" +
            "<h3><span data-i18n=\"ui.b0eef383\">Pengaturan cuaca</span></h3><label for=\"wxBasemap\"><span data-i18n=\"ui.5aec8826\">Peta dasar</span></label><select id=\"wxBasemap\"></select>" +
            "<label for=\"wxModel\"><span data-i18n=\"ui.9b9b2339\">Model prakiraan</span></label><select id=\"wxModel\"><option value=\"best_match\">Otomatis · Best Match</option><option value=\"icon\">ICON · DWD</option><option value=\"gfs\">GFS · NOAA</option></select>" +
            '<label for="wxScope">Cakupan data</label><select id="wxScope"><option value="local">Negara terpilih (ADM0)</option><option value="global">Seluruh dunia</option></select>' +
            '<label for="wxUnits">Satuan</label><select id="wxUnits"><option value="metric">Metrik · °C, km/jam, mm</option><option value="imperial">Imperial · °F, mph, inci</option></select>' +
            '<label class="wx-label-row" for="wxOpacity"><span>Opasitas lapisan</span><output id="wxOpacityValue" for="wxOpacity">70%</output></label><input id="wxOpacity" type="range" min="0" max="100" step="5" value="70">' +
            "<label class=\"wx-wind-motion\" for=\"wxWindMotion\"><input id=\"wxWindMotion\" type=\"checkbox\"> <span data-i18n=\"ui.ea3c32da\">Gerakkan partikel angin saat diputar</span></label>" +
            "<p class=\"wx-settings-help\"><span data-i18n=\"ui.f7fc43a1\">Model mengatur lapisan prakiraan. Radar, citra satelit, dan laporan badai mengikuti sumber pengamatannya.</span></p>" +
            '<button id="wxRefresh" type="button" class="wx-secondary-button">' + icon('refresh') + "<span><span data-i18n=\"ui.33f1707d\">Perbarui data</span></span></button></div></details></aside>" +
            "<div class=\"wx-map-actions wx-surface\" role=\"group\" aria-label=\"Navigasi peta cuaca\" data-i18n-aria-label=\"ui.4acf03dc\">" +
            button('wxZoomIn', 'plus', 'Perbesar peta') + button('wxZoomOut', 'minus', 'Perkecil peta') +
            button('wxLocate', 'locate', 'Ke lokasi pengamat') + button('wxFullscreen', 'fullscreen', 'Layar penuh') + '</div>' +
            "<div class=\"wx-map-hint\"><span data-i18n=\"ui.1f056891\">Klik peta untuk prakiraan lokasi</span></div>" +
            "<aside id=\"wxPointCard\" class=\"wx-point-card wx-surface\" aria-label=\"Prakiraan titik di lokasi pilihan\" hidden data-i18n-aria-label=\"ui.fe9cd046\"><div class=\"wx-point-heading\"><div><span class=\"wx-section-label\"><span data-i18n=\"ui.b4ef157d\">PRAKIRAAN TITIK</span></span><h3 id=\"wxPointName\"><span data-i18n=\"ui.1efe503f\">Lokasi pilihan</span></h3><p id=\"wxPointCoordinates\"></p></div>" +
            button('wxPointClose', 'close', 'Tutup rincian lokasi') + '</div><p id="wxPointStatus" class="wx-point-status" role="status"></p>' +
            "<div id=\"wxStormTimeWrap\" class=\"wx-storm-time\" hidden><label for=\"wxStormTime\"><span data-i18n=\"ui.3f2a0ad4\">Waktu prakiraan area angin</span></label><select id=\"wxStormTime\"></select></div>" +
            '<div id="wxPointValues" class="wx-point-values"></div><ul id="wxPointNotes" class="wx-point-notes" hidden></ul>' +
            "<div id=\"wxPointHourlyWrap\" class=\"wx-hourly-wrap\"><table class=\"wx-hourly\"><caption><span data-i18n=\"ui.41c6ecef\">Prakiraan per jam</span></caption><thead><tr><th scope=\"col\"><span data-i18n=\"ui.4293eacd\">Waktu</span></th><th scope=\"col\" id=\"wxHourlyTemp\">Suhu</th><th scope=\"col\" id=\"wxHourlyRain\">Hujan</th><th scope=\"col\" id=\"wxHourlyWind\">Angin</th></tr></thead><tbody id=\"wxPointHourly\"></tbody></table></div>" +
            "<a id=\"wxPointSource\" class=\"wx-source-link\" target=\"_blank\" rel=\"noopener noreferrer\" hidden><span data-i18n=\"ui.e399dd16\">Sumber prakiraan</span></a></aside>" +
            "<footer class=\"wx-timeline wx-surface\" aria-label=\"Waktu dan legenda cuaca\" data-i18n-aria-label=\"ui.6fe839e9\"><div class=\"wx-timeline-top\"><div class=\"wx-layer-summary\"><strong id=\"wxActiveLayer\">Angin</strong><span id=\"wxDataKind\" class=\"wx-data-kind\"><span data-i18n=\"ui.dad514a4\">PRAKIRAAN</span></span></div>" +
            "<div id=\"wxStatus\" class=\"wx-status\" role=\"status\" aria-live=\"polite\"><span data-i18n=\"ui.dc191037\">Pilih lapisan untuk menjelajahi cuaca</span></div></div>" +
            "<nav id=\"wxStormList\" class=\"wx-storm-list\" aria-label=\"Pilih badai untuk menampilkan lokasi dan panduan\" hidden data-i18n-aria-label=\"ui.6ede4769\"></nav>" +
            '<div class="wx-playback"><div class="wx-playback-buttons">' + button('wxPrevious', 'previous', 'Waktu sebelumnya') + button('wxPlay', 'play', 'Putar animasi', 'wx-play') + button('wxNext', 'next', 'Waktu berikutnya') + '</div>' +
            "<div class=\"wx-time-track\"><div class=\"wx-time-caption\"><time id=\"wxTimeLabel\"><span data-i18n=\"ui.5041667\">Waktu belum tersedia</span></time><span id=\"wxTimeZone\"><span data-i18n=\"ui.d71b8ee\">Waktu perangkat</span></span></div><input id=\"wxFrameSlider\" type=\"range\" min=\"0\" max=\"0\" value=\"0\" step=\"1\" aria-label=\"Waktu cuaca\">" +
            '<div class="wx-time-endpoints"><span id="wxTimeStart"></span><span id="wxTimeEnd"></span></div></div>' +
            "<label class=\"wx-speed-label\" for=\"wxSpeed\"><span><span data-i18n=\"ui.44bb2225\">Kecepatan</span></span><select id=\"wxSpeed\"><option value=\"1600\">0,5×</option><option value=\"800\" selected>1×</option><option value=\"400\">2×</option></select></label></div>" +
            '<div class="wx-legend-row"><div id="wxLegend" class="wx-color-legend"><div class="wx-legend-heading"><span id="wxLegendTitle">Angin</span><span id="wxLegendUnit"></span></div><div id="wxLegendGradient" class="wx-legend-gradient"></div><div id="wxLegendLabels" class="wx-legend-labels"></div></div>' +
            '<div class="wx-source"><a id="wxSourceLink" target="_blank" rel="noopener noreferrer">Sumber data</a><span id="wxSourceNote"></span></div></div></footer>';
        if (window.MpmUiTranslations) window.MpmUiTranslations.markStatic(root);
        (document.querySelector('.app-shell') || document.body).appendChild(root);

        var refs = {};
        root.querySelectorAll('[id]').forEach(function (element) { refs[element.id] = element; });
        // Share the map's actual basemap choices instead of maintaining a second list.
        document.querySelectorAll('.map-tools [data-basemap], .astro-map-drawer [data-basemap]').forEach(function (button) {
            var option = document.createElement('option');
            option.value = button.dataset.basemap;
            option.textContent = button.textContent.trim();
            refs.wxBasemap.appendChild(option);
        });
        var state = controller.getState();
        var lastEnabled = false;
        var lastPointSignature = '';
        var lastLegendSignature = '';
        var dismissedPoint = false;
        var searchSequence = 0;
        var searchTimer = null;
        var searchResults = [];
        var previousFocus = null;
        var handlers = [];

        function listen(target, type, callback) {
            target.addEventListener(type, callback);
            handlers.push([target, type, callback]);
        }

        function setText(element, text) {
            var next = text === undefined || text === null ? '' : String(text);
            if (!['wxPointName','wxPointCoordinates','wxSourceLink','wxSourceNote'].includes(element.id)) next=ui(next);
            if (element.textContent !== next) element.textContent = next;
        }

        function setValue(element, value) {
            if (document.activeElement !== element && value !== undefined && value !== null && element.value !== String(value)) element.value = value;
        }

        function reportActionError(error) {
            setText(refs.wxStatus, error && error.message ? error.message : 'Tindakan belum dapat dijalankan. Coba lagi.');
        }

        function runAction(action) {
            try {
                var result = action();
                if (result && typeof result.catch === 'function') result.catch(reportActionError);
            } catch (error) { reportActionError(error); }
        }

        function closeSearch() {
            searchSequence += 1;
            window.clearTimeout(searchTimer);
            refs.wxSearchResults.hidden = true;
            refs.wxSearchInput.setAttribute('aria-expanded', 'false');
        }

        function searchMessage(message) {
            refs.wxSearchResults.replaceChildren();
            var note = document.createElement('p');
            note.className = 'wx-search-message';
            note.setAttribute('role', 'status');
            note.textContent = message;
            refs.wxSearchResults.appendChild(note);
            refs.wxSearchResults.hidden = false;
            refs.wxSearchInput.setAttribute('aria-expanded', 'true');
        }

        function performSearch() {
            var query = refs.wxSearchInput.value.trim();
            var sequence = ++searchSequence;
            if (query.length < 2) { closeSearch(); return; }
            searchMessage('Mencari lokasi…');
            var coordinates = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
            if (coordinates) {
                var latitude = Number(coordinates[1]);
                var longitude = Number(coordinates[2]);
                if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
                    searchMessage('Lintang harus âˆ’90 hingga 90; bujur âˆ’180 hingga 180.');
                    return;
                }
                showSearchResults([{ name: latitude.toFixed(4) + ', ' + longitude.toFixed(4), latitude: latitude, longitude: longitude, country: 'Koordinat pilihan' }]);
                return;
            }
            Promise.resolve().then(function () { return controller.searchPlaces(query); }).then(function (results) {
                if (sequence !== searchSequence || !state.enabled) return;
                showSearchResults(Array.isArray(results) ? results : []);
            }).catch(function (error) {
                if (sequence !== searchSequence || !state.enabled) return;
                searchMessage(error && error.message ? error.message : 'Pencarian tidak tersedia. Coba lagi atau gunakan koordinat.');
            });
        }

        function showSearchResults(results) {
            searchResults = results;
            if (!results.length) { searchMessage('Lokasi tidak ditemukan. Coba nama kota lain.'); return; }
            refs.wxSearchResults.replaceChildren();
            results.slice(0, 7).forEach(function (place, index) {
                var item = document.createElement('button');
                item.type = 'button';
                item.dataset.placeIndex = index;
                item.className = 'wx-place-result';item.setAttribute('translate','no');
                var title = document.createElement('strong');
                title.textContent = place.name || 'Lokasi pilihan';
                var subtitle = document.createElement('span');
                subtitle.textContent = [place.country, Number(place.latitude).toFixed(3) + ', ' + Number(place.longitude).toFixed(3)].filter(Boolean).join(' · ');
                item.appendChild(title);
                item.appendChild(subtitle);
                refs.wxSearchResults.appendChild(item);
            });
            refs.wxSearchResults.hidden = false;
            refs.wxSearchInput.setAttribute('aria-expanded', 'true');
        }

        function renderPoint(point) {
            refs.wxPointCard.hidden = !point || dismissedPoint;
            if (!point || dismissedPoint) return;
            var signature = JSON.stringify([point, state.unitSystem]);
            if (signature === lastPointSignature) return;
            lastPointSignature = signature;
            setText(refs.wxPointCard.querySelector('.wx-section-label'), point.storm && point.storm.type === 'tornado' ? 'PERINGATAN TORNADO' : point.kind === 'OBSERVED' ? 'MONITORING BADAI' : 'PRAKIRAAN TITIK');
            setText(refs.wxPointName, point.name || 'Lokasi pilihan');
            setText(refs.wxPointCoordinates, Number(point.latitude).toFixed(4) + '°, ' + Number(point.longitude).toFixed(4) + '°');
            setText(refs.wxPointStatus, point.loading ? (point.storm ? 'Memuat jalur dan area resmi…' : 'Memuat prakiraan lokasi…') : point.error || (point.time ? displayTime(point.time) + (point.kind === 'OBSERVED' ? ' · laporan resmi' : ' · prakiraan model') : (point.kind === 'OBSERVED' ? 'Waktu laporan belum tersedia' : 'Prakiraan model untuk lokasi ini')));
            refs.wxPointStatus.classList.toggle('wx-is-error', !!point.error);
            refs.wxPointValues.replaceChildren();
            (point.loading && !point.storm ? [] : point.values || []).forEach(function (entry) {
                var item = document.createElement('div');
                item.className = 'wx-point-value';
                var label = document.createElement('span');
                label.textContent = ui(entry.label || '');
                var value = document.createElement('strong');
                value.textContent = valueText(entry.value, entry.unit);
                item.appendChild(label);
                item.appendChild(value);
                refs.wxPointValues.appendChild(item);
            });
            refs.wxPointNotes.replaceChildren();
            (point.notes || []).forEach(function (note) { var item = document.createElement('li'); item.textContent = note; refs.wxPointNotes.appendChild(item); });
            refs.wxPointNotes.hidden = !(point.notes || []).length;
            var stormTimes = point.storm && point.storm.forecastTimes || [];
            refs.wxStormTimeWrap.hidden = !stormTimes.length;
            refs.wxStormTime.replaceChildren();
            stormTimes.forEach(function (time) { var option = document.createElement('option'); option.value = String(time); option.textContent = displayTime(time); refs.wxStormTime.appendChild(option); });
            if (point.storm) refs.wxStormTime.value = String(point.storm.forecastTime);
            refs.wxPointHourly.replaceChildren();
            var hourly = point.loading ? [] : point.hourly || [];
            refs.wxPointHourlyWrap.hidden = !hourly.length;
            var imperial = state.unitSystem === 'imperial';
            setText(refs.wxHourlyTemp, 'Suhu ' + (imperial ? '°F' : '°C'));
            setText(refs.wxHourlyRain, 'Hujan ' + (imperial ? 'in' : 'mm'));
            setText(refs.wxHourlyWind, 'Angin ' + (imperial ? 'mph' : 'km/j'));
            hourly.slice(0, 24).forEach(function (hour) {
                var row = document.createElement('tr');
                [displayTime(hour.time, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), valueText(hour.temperature), valueText(hour.precipitation), valueText(hour.wind)].forEach(function (text) {
                    var cell = document.createElement('td');
                    cell.textContent = text;
                    row.appendChild(cell);
                });
                refs.wxPointHourly.appendChild(row);
            });
            var pointSource = point.source || { provider: 'Open-Meteo', url: 'https://open-meteo.com/' };
            var pointUrl = safeUrl(pointSource.url || point.sourceUrl);
            refs.wxPointSource.hidden = !pointUrl;
            if (pointUrl) refs.wxPointSource.href = pointUrl;
            setText(refs.wxPointSource, 'Sumber: ' + (pointSource.provider || 'Prakiraan cuaca'));
        }

        function render(nextState) {
            state = nextState || controller.getState();
            var enabled = !!state.enabled;
            root.hidden = !enabled;
            document.body.classList.toggle('weather-explorer-active', enabled);
            if (enabled !== lastEnabled) {
                if (enabled) {
                    previousFocus = document.activeElement;
                    refs.wxExit.focus({ preventScroll: true });
                } else {
                    closeSearch();
                    refs.wxSettings.open = false;
                    dismissedPoint = false;
                    if (previousFocus && document.contains(previousFocus) && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
                }
                lastEnabled = enabled;
                window.requestAnimationFrame(function () { if (map.updateSize) map.updateSize(); });
            }
            if (!enabled) return;
            root.querySelectorAll('[data-weather-layer]').forEach(function (element) {
                var active = element.dataset.weatherLayer === state.layer;
                element.setAttribute('aria-pressed', active ? 'true' : 'false');
                element.classList.toggle('is-active', active);
            });
            var layer = LAYERS.filter(function (item) { return item[0] === state.layer; })[0];
            setText(refs.wxActiveLayer, layer ? layer[1] : 'Cuaca');
            setValue(refs.wxBasemap, state.basemap);
            setValue(refs.wxModel, state.model);
            setValue(refs.wxScope, state.scope);
            if (refs.wxScope && state.scopeCountry) refs.wxScope.querySelector('[value=local]').textContent = 'Lokal ADM0 · ' + (state.scopeCountry.name || 'negara belum dipilih') + (state.scopeCountry.ready ? '' : ' · batas belum tersedia');
            setValue(refs.wxUnits, state.unitSystem);
            setValue(refs.wxOpacity, Math.round(Number(state.opacity) * 100));
            setText(refs.wxOpacityValue, Math.round(Number(state.opacity) * 100) + '%');
            setValue(refs.wxSpeed, state.speed);
            refs.wxWindMotion.checked = !!state.windMotion;
            var frames = state.frames || [];
            var frameIndex = Math.max(0, Math.min(frames.length - 1, Number(state.frame) || 0));
            var frame = frames[frameIndex];
            var canAnimate = frames.length > 1;
            root.querySelector('.wx-playback').hidden = state.layer === 'storm';
            refs.wxStormList.hidden = state.layer !== 'storm';
            var systems = state.stormSystems || [], systemsSignature = JSON.stringify(systems);
            if (refs.wxStormList.dataset.signature !== systemsSignature) {
                refs.wxStormList.dataset.signature = systemsSignature;
                refs.wxStormList.replaceChildren();
                systems.forEach(function (system) {
                    var button = document.createElement('button'); button.type = 'button'; button.className = 'wx-storm-choice'; button.dataset.stormId = system.id;
                    button.setAttribute('translate','no');button.textContent = system.name; button.title = 'Tampilkan lokasi dan panduan ' + system.name; refs.wxStormList.appendChild(button);
                });
            }
            refs.wxFrameSlider.max = Math.max(0, frames.length - 1);
            refs.wxFrameSlider.disabled = !canAnimate;
            setValue(refs.wxFrameSlider, frameIndex);
            refs.wxPlay.disabled = !canAnimate;
            refs.wxPrevious.disabled = !canAnimate;
            refs.wxNext.disabled = !canAnimate;
            refs.wxSpeed.disabled = !canAnimate;
            refs.wxPlay.setAttribute('aria-pressed', state.playing ? 'true' : 'false');
            var playLabel = ui(state.playing ? 'Jeda animasi' : 'Putar animasi');
            if (refs.wxPlay.getAttribute('aria-label') !== playLabel) {
                refs.wxPlay.setAttribute('aria-label', playLabel);
                refs.wxPlay.title = playLabel;
                refs.wxPlay.innerHTML = icon(state.playing ? 'pause' : 'play');
            }
            var displayedTime = state.raster && state.raster.displayedTime || (frame && frame.time);
            var timestamp = displayedTime ? displayTime(displayedTime) : 'Waktu belum tersedia';
            setText(refs.wxTimeLabel, timestamp);
            if (displayedTime && isFinite(Number(displayedTime))) refs.wxTimeLabel.dateTime = new Date(displayedTime).toISOString();
            else refs.wxTimeLabel.removeAttribute('datetime');
            refs.wxFrameSlider.setAttribute('aria-valuetext', timestamp);
            setText(refs.wxTimeStart, frames.length ? displayTime(frames[0].time) : '');
            setText(refs.wxTimeEnd, frames.length > 1 ? displayTime(frames[frames.length - 1].time) : '');
            var isObserved = frame && frame.kind === 'OBSERVED';
            setText(refs.wxDataKind, state.layer === 'storm' ? 'MONITORING' : frame ? (isObserved ? 'PENGAMATAN' : 'PRAKIRAAN') : 'DATA');
            refs.wxDataKind.classList.toggle('is-observed', !!isObserved);
            setText(refs.wxStatus, state.error || state.status || (state.loading ? 'Memuat data cuaca…' : 'Klik peta untuk prakiraan lokasi'));
            refs.wxStatus.classList.toggle('wx-is-error', !!state.error);
            root.classList.toggle('wx-is-loading', !!state.loading || !!(state.raster && state.raster.loading));
            refs.wxRefresh.disabled = !!state.loading;
            var legend = state.legend || {};
            var legendSignature = JSON.stringify(legend);
            if (legendSignature !== lastLegendSignature) {
                lastLegendSignature = legendSignature;
                setText(refs.wxLegendTitle, legend.title || (layer && layer[1]) || 'Cuaca');
                setText(refs.wxLegendUnit, legend.unit || '');
                var colors = (legend.colors || []).filter(function (color) { return /^#[a-fA-F0-9]{3,8}$/.test(color); });
                refs.wxLegendGradient.hidden = !colors.length;
                refs.wxLegendGradient.style.background = colors.length > 1 ? 'linear-gradient(to right,' + colors.join(',') + ')' : colors[0] || 'transparent';
                refs.wxLegendLabels.replaceChildren();
                (legend.labels || []).forEach(function (label) {
                    var tick = document.createElement('span');
                    tick.textContent = String(label);
                    refs.wxLegendLabels.appendChild(tick);
                });
            }
            var source = state.source || {};
            var sourceUrl = safeUrl(source.url);
            if (sourceUrl) refs.wxSourceLink.href = sourceUrl;
            else refs.wxSourceLink.removeAttribute('href');
            setText(refs.wxSourceLink, source.provider || 'Sumber belum tersedia');
            setText(refs.wxSourceNote, source.note || '');
            renderPoint(state.point);
        }

        listen(refs.wxExit, 'click', function () { controller.setEnabled(false); });
        listen(root, 'click', function (event) {
            var layerButton = event.target.closest('[data-weather-layer]');
            if (layerButton) {
                refs.wxSettings.open = false;
                runAction(function () { return controller.setLayer(layerButton.dataset.weatherLayer); });
            }
        });
        [['wxBasemap', 'setBasemap'], ['wxModel', 'setModel'], ['wxScope', 'setScope'], ['wxUnits', 'setUnitSystem']].forEach(function (pair) {
            listen(refs[pair[0]], 'change', function () { var value = this.value; runAction(function () { return controller[pair[1]](value); }); });
        });
        listen(refs.wxOpacity, 'input', function () {
            setText(refs.wxOpacityValue, this.value + '%');
            controller.setOpacity(Number(this.value) / 100);
        });
        listen(refs.wxSpeed, 'change', function () { controller.setSpeed(Number(this.value)); });
        listen(refs.wxWindMotion, 'change', function () { controller.setWindMotion(this.checked); });
        listen(refs.wxStormTime, 'change', function () { controller.setStormForecastTime(Number(this.value)); });
        listen(refs.wxStormList, 'click', function (event) { var button = event.target.closest('[data-storm-id]'); if (button) controller.focusStorm(button.dataset.stormId); });
        listen(refs.wxFrameSlider, 'input', function () { controller.setFrame(Number(this.value)); });
        listen(refs.wxPlay, 'click', function () { controller.setPlaying(!state.playing); });
        listen(refs.wxPrevious, 'click', function () { controller.setPlaying(false); controller.setFrame((Number(state.frame) - 1 + state.frames.length) % state.frames.length); });
        listen(refs.wxNext, 'click', function () { controller.setPlaying(false); controller.setFrame((Number(state.frame) + 1) % state.frames.length); });
        listen(refs.wxRefresh, 'click', function () { runAction(function () { return controller.refresh(); }); });
        listen(refs.wxLocate, 'click', function () { dismissedPoint = false; runAction(function () { return controller.goToObserver(); }); });
        listen(refs.wxZoomIn, 'click', function () { var view = map.getView(); view.animate({ zoom: view.getZoom() + 1, duration: 220 }); });
        listen(refs.wxZoomOut, 'click', function () { var view = map.getView(); view.animate({ zoom: view.getZoom() - 1, duration: 220 }); });
        listen(refs.wxFullscreen, 'click', function () {
            runAction(function () {
                if (document.fullscreenElement) return document.exitFullscreen();
                if (document.documentElement.requestFullscreen) return document.documentElement.requestFullscreen();
                setText(refs.wxStatus, 'Layar penuh tidak didukung pada browser ini.');
            });
        });
        listen(document, 'fullscreenchange', function () {
            var label = document.fullscreenElement ? 'Keluar layar penuh' : 'Layar penuh';
            refs.wxFullscreen.setAttribute('aria-label', label);
            refs.wxFullscreen.title = label;
            if (map.updateSize) map.updateSize();
        });
        listen(refs.wxPointClose, 'click', function () { if (controller.closePoint) controller.closePoint(); dismissedPoint = false; refs.wxPointCard.hidden = true; refs.wxLocate.focus({ preventScroll: true }); });
        listen(refs.wxSearchForm, 'submit', function (event) { event.preventDefault(); window.clearTimeout(searchTimer); performSearch(); });
        listen(refs.wxSearchInput, 'input', function () {
            searchSequence += 1;
            window.clearTimeout(searchTimer);
            if (this.value.trim().length < 2) { closeSearch(); return; }
            searchTimer = window.setTimeout(performSearch, 400);
        });
        listen(refs.wxSearchInput, 'keydown', function (event) {
            if (event.key === 'ArrowDown' && !refs.wxSearchResults.hidden) {
                var first = refs.wxSearchResults.querySelector('button');
                if (first) { event.preventDefault(); first.focus(); }
            }
        });
        listen(refs.wxSearchResults, 'keydown', function (event) {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            var buttons = Array.prototype.slice.call(refs.wxSearchResults.querySelectorAll('button'));
            var index = buttons.indexOf(document.activeElement);
            if (index < 0) return;
            event.preventDefault();
            var next = index + (event.key === 'ArrowDown' ? 1 : -1);
            if (next < 0) refs.wxSearchInput.focus();
            else buttons[Math.min(buttons.length - 1, next)].focus();
        });
        listen(refs.wxSearchResults, 'click', function (event) {
            var item = event.target.closest('[data-place-index]');
            if (!item) return;
            var place = searchResults[Number(item.dataset.placeIndex)];
            if (!place) return;
            refs.wxSearchInput.value = place.name || '';
            dismissedPoint = false;
            closeSearch();
            refs.wxSearchInput.focus({ preventScroll: true });
            runAction(function () { return controller.goToPlace(place); });
        });
        listen(document, 'pointerdown', function (event) { if (!refs.wxSearchForm.contains(event.target)) closeSearch(); });
        listen(document, 'keydown', function (event) {
            if (!state.enabled || event.key !== 'Escape') return;
            if (!refs.wxSearchResults.hidden) { closeSearch(); refs.wxSearchInput.focus(); }
            else if (refs.wxSettings.open) { refs.wxSettings.open = false; refs.wxSettings.querySelector('summary').focus(); }
            else if (!refs.wxPointCard.hidden) { controller.closePoint(); dismissedPoint = false; refs.wxPointCard.hidden = true; refs.wxLocate.focus(); }
            else if (!document.fullscreenElement) controller.setEnabled(false);
        });
        function mapClick() { dismissedPoint = false; renderPoint(state.point); }
        if (map.on) map.on('singleclick', mapClick);
        listen(window, 'mpm:language-changed', function () { lastPointSignature=''; lastLegendSignature=''; render(controller.getState()); root.querySelectorAll('[data-weather-layer]').forEach(function(button) { var entry=LAYERS.find(function(layer){return layer[0]===button.dataset.weatherLayer;});button.title=ui(entry[3]);button.querySelector('span').textContent=ui(entry[1]); }); });
        listen(window, 'mpm:weather-state', function (event) { render(event.detail); });
        render(state);

        return {
            element: root,
            render: render,
            destroy: function () {
                closeSearch();
                handlers.forEach(function (entry) { entry[0].removeEventListener(entry[1], entry[2]); });
                if (map.un) map.un('singleclick', mapClick);
                document.body.classList.remove('weather-explorer-active');
                root.remove();
            }
        };
    }

    window.MpmWeatherExplorer = { mount: mount };
})(window, document);
