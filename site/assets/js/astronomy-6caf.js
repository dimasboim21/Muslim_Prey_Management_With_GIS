(function (window, document) {
    'use strict';

    const DAY_MS = 86400000;
    const EVENT_API_URL = 'api/islamic-calendar-events.php';
    const USER_EVENT_API_URL = 'api/islamic-calendar-user-events.php';
    const MODES = ['gregorian', 'hijri'];
    const MODE_CONFIG = {
        gregorian: {
            calendar: 'gregory',
            label: 'Masehi',
            secondaryCalendar: 'islamic-umalqura',
            secondaryLabel: 'Hijriah'
        },
        hijri: {
            calendar: 'islamic-umalqura',
            label: 'Hijriah',
            secondaryCalendar: 'gregory',
            secondaryLabel: 'Masehi'
        }
    };
    const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const HIJRI_MONTH_NAMES = [
        'Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir',
        'Jumadil Awal', 'Jumadil Akhir', 'Rajab', 'Syaban',
        'Ramadan', 'Syawal', 'Zulkaidah', 'Zulhijah'
    ];
    const WEEKDAY_INDEX = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6
    };
    const formatterCache = new Map();
    const timeZoneValidityCache = new Map();
    const instances = [];
    let instanceSequence = 0;
    let eventCatalogPromise = null;

    function actualNow() {
        return window.MpmActualTime && typeof window.MpmActualTime.now === 'function'
            ? window.MpmActualTime.now()
            : new Date();
    }

    function formatter(locale, options) {
        const key = `${locale}|${JSON.stringify(options)}`;
        if (!formatterCache.has(key)) {
            formatterCache.set(key, new Intl.DateTimeFormat(locale, options));
        }
        return formatterCache.get(key);
    }

    function safeTimeZone(value) {
        const candidate = String(value || '').trim();
        if (!candidate) {
            return '';
        }
        if (timeZoneValidityCache.has(candidate)) {
            return timeZoneValidityCache.get(candidate) ? candidate : '';
        }
        try {
            formatter('en-US', { timeZone: candidate, year: 'numeric' }).format(new Date());
            timeZoneValidityCache.set(candidate, true);
            return candidate;
        } catch (error) {
            timeZoneValidityCache.set(candidate, false);
            return '';
        }
    }

    function browserTimeZone() {
        try {
            return safeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
        } catch (error) {
            return 'UTC';
        }
    }

    function calendarParts(date, mode, timeZone) {
        const calendar = MODE_CONFIG[mode].calendar;
        const parts = formatter('en-US', {
            calendar,
            numberingSystem: 'latn',
            timeZone,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        }).formatToParts(date);
        const result = {};
        parts.forEach((part) => {
            if (part.type === 'year' || part.type === 'relatedYear' || part.type === 'month' || part.type === 'day') {
                result[part.type] = Number(part.value);
            }
        });
        return {
            year: Number.isFinite(result.year) ? result.year : result.relatedYear,
            month: result.month,
            day: result.day
        };
    }

    function timeParts(date, timeZone) {
        const result = {};
        formatter('en-US', {
            numberingSystem: 'latn',
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        }).formatToParts(date).forEach((part) => {
            if (part.type !== 'literal') {
                result[part.type] = Number(part.value);
            }
        });
        return {
            hour: result.hour === 24 ? 0 : result.hour,
            minute: result.minute,
            second: result.second
        };
    }

    function addDays(date, amount) {
        return new Date(date.getTime() + (amount * DAY_MS));
    }

    function sameCalendarMonth(left, right) {
        return left.year === right.year && left.month === right.month;
    }

    function findMonthStart(anchor, mode, timeZone) {
        const anchorParts = calendarParts(anchor, mode, timeZone);
        let candidate = addDays(anchor, -(Math.max(1, anchorParts.day) - 1));
        for (let index = 0; index < 6; index += 1) {
            const parts = calendarParts(candidate, mode, timeZone);
            if (parts.day === 1 && sameCalendarMonth(parts, anchorParts)) {
                return candidate;
            }
            candidate = parts.day > 1 ? addDays(candidate, -1) : addDays(candidate, 1);
        }
        return candidate;
    }

    function shiftMonth(anchor, mode, timeZone, direction) {
        const start = findMonthStart(anchor, mode, timeZone);
        if (direction < 0) {
            return findMonthStart(addDays(start, -2), mode, timeZone);
        }
        const current = calendarParts(start, mode, timeZone);
        for (let offset = 25; offset <= 35; offset += 1) {
            const candidate = addDays(start, offset);
            if (!sameCalendarMonth(calendarParts(candidate, mode, timeZone), current)) {
                return findMonthStart(candidate, mode, timeZone);
            }
        }
        return addDays(start, 30);
    }

    function weekdayIndex(date, timeZone) {
        const weekday = formatter('en-US', {
            timeZone,
            weekday: 'long'
        }).format(date);
        return Object.prototype.hasOwnProperty.call(WEEKDAY_INDEX, weekday)
            ? WEEKDAY_INDEX[weekday]
            : 0;
    }

    function longDate(date, calendar, timeZone) {
        return formatter('id-ID', {
            calendar,
            numberingSystem: 'latn',
            timeZone,
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date);
    }

    function monthTitle(date, calendar, timeZone) {
        return formatter('id-ID', {
            calendar,
            numberingSystem: 'latn',
            timeZone,
            month: 'long',
            year: 'numeric'
        }).format(date);
    }

    function timeZoneLabel(date, timeZone) {
        try {
            const value = formatter('id-ID', {
                timeZone,
                timeZoneName: 'longOffset',
                hour: '2-digit'
            }).formatToParts(date).find((part) => part.type === 'timeZoneName');
            return value ? `${timeZone} (${value.value})` : timeZone;
        } catch (error) {
            return timeZone;
        }
    }

    function pad(value, length) {
        return String(value).padStart(length, '0');
    }

    function normalizeMode(value) {
        return MODES.includes(value) ? value : 'gregorian';
    }

    function queryMode() {
        try {
            const value = new URLSearchParams(window.location.search).get('calendar');
            return MODES.includes(value) ? value : '';
        } catch (error) {
            return '';
        }
    }

    function readMode(storageKey) {
        const fromQuery = queryMode();
        if (fromQuery) {
            return fromQuery;
        }
        try {
            return normalizeMode(window.localStorage.getItem(storageKey));
        } catch (error) {
            return 'gregorian';
        }
    }

    function writeMode(storageKey, mode) {
        try {
            window.localStorage.setItem(storageKey, mode);
        } catch (error) {
            // Preference storage is optional.
        }
    }

    function loadEventCatalog() {
        if (!eventCatalogPromise) {
            eventCatalogPromise = window.fetch(EVENT_API_URL, {
                method: 'GET',
                headers: { Accept: 'application/json' },
                cache: 'no-store',
                credentials: 'same-origin'
            }).then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            }).then((payload) => {
                if (!payload || payload.success !== true || !payload.data || !Array.isArray(payload.data.events)) {
                    throw new Error('Format basis data kalender tidak valid.');
                }
                return { events: payload.data.events };
            });
        }
        return eventCatalogPromise;
    }

    function loadUserCalendarEvents() {
        return window.fetch(USER_EVENT_API_URL, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            credentials: 'same-origin'
        }).then(async (response) => {
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.success !== true || !payload.data || !Array.isArray(payload.data.events)) {
                throw new Error(payload.error || `HTTP ${response.status}`);
            }
            return payload.data;
        });
    }

    function mutateUserCalendarEvent(method, body, adminToken) {
        const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
        const token = String(adminToken || '').trim();
        if (token) {
            headers['X-Admin-Token'] = token;
        }
        return window.fetch(USER_EVENT_API_URL, {
            method,
            headers,
            body: JSON.stringify(Object.assign({
                actorId: 'astronomy-calendar-user',
                clientRequestId: `calendar-${Date.now()}-${Math.random().toString(16).slice(2)}`
            }, body || {})),
            cache: 'no-store',
            credentials: 'same-origin'
        }).then(async (response) => {
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.success !== true) {
                const error = new Error(payload.error || `HTTP ${response.status}`);
                error.status = response.status;
                error.payload = payload;
                throw error;
            }
            return payload.data;
        });
    }

    function ruleMatchesHijriDate(rule, hijriParts, date, timeZone) {
        if (!rule || !hijriParts) {
            return false;
        }
        const suppressedMonths = Array.isArray(rule.suppress_in_hijri_months)
            ? rule.suppress_in_hijri_months.map(Number)
            : [];
        if (suppressedMonths.includes(Number(hijriParts.month))) {
            return false;
        }
        const weekdays = Array.isArray(rule.weekdays) ? rule.weekdays.map((value) => String(value).toLowerCase()) : [];
        if (weekdays.length) {
            const weekday = formatter('en-US', { timeZone, weekday: 'long' }).format(date).toLowerCase();
            return weekdays.includes(weekday);
        }
        if (rule.fixed_hijri_date === false) {
            return false;
        }
        const month = Number(rule.hijri_month || 0);
        if (month > 0 && month !== Number(hijriParts.month)) {
            return false;
        }
        const excludedDays = Array.isArray(rule.exclude_days) ? rule.exclude_days.map(Number) : [];
        if (excludedDays.includes(Number(hijriParts.day))) {
            return false;
        }
        if (Number(rule.day || 0) > 0) {
            return Number(rule.day) === Number(hijriParts.day);
        }
        const days = Array.isArray(rule.days) ? rule.days.map(Number) : [];
        if (days.length) {
            return days.includes(Number(hijriParts.day));
        }
        const monthlyDays = Array.isArray(rule.hijri_days) ? rule.hijri_days.map(Number) : [];
        if (rule.repeat === 'monthly' && monthlyDays.length) {
            return monthlyDays.includes(Number(hijriParts.day));
        }
        const startDay = Number(rule.start_day || 0);
        const endDay = Number(rule.end_day || 0);
        return startDay > 0 && endDay >= startDay
            && Number(hijriParts.day) >= startDay && Number(hijriParts.day) <= endDay;
    }

    function certaintyLabel(value) {
        const labels = {
            'established-text': 'Dalil tanggal kuat',
            'established-month': 'Bulan ditetapkan',
            'widely-attested': 'Riwayat luas',
            'historical-report': 'Riwayat sejarah',
            'reported': 'Tanggal diriwayatkan',
            'traditional-date': 'Tanggal tradisi',
            'tradition-specific': 'Khusus tradisi tertentu',
            'traditional-multiple-opinions': 'Tanggal populer; ada perbedaan',
            'traditional-majority-with-other-opinions': 'Pendapat mayoritas/tradisi; ada perbedaan',
            'popular-commemoration-date-not-historically-certain': 'Tanggal peringatan; sejarah tidak pasti',
            'multiple-date-opinions': 'Beberapa pendapat tanggal',
            'reported-with-date-variants': 'Ada varian hitungan tanggal',
            'reported-exact-date': 'Tanggal disebut sumber sejarah',
            'sahih-report-day-and-place': 'Hadis sahih menyebut hari dan tempat',
            'sahih-report-day-year-unknown': 'Hadis sahih menyebut hari; tahun tidak disebut',
            'historical-date-opinion': 'Salah satu pendapat tanggal sejarah',
            'user-entered-unverified': 'Input pengguna; belum diverifikasi',
            'source-supplied-unreviewed': 'Memiliki sumber; belum ditinjau'
        };
        return labels[value] || String(value || '').replace(/-/g, ' ');
    }

    function claimScopeLabel(value) {
        const labels = {
            legal_practice: 'praktik ibadah',
            weekday_legal_practice: 'praktik puasa pada hari pekan',
            month_worship_window: 'keutamaan/rentang ibadah dalam bulan',
            month_start_legal_rule: 'kaidah penetapan awal bulan',
            local_calendar_authority_process: 'mekanisme keputusan kalender setempat',
            ramadan_night_prayer: 'qiyam Ramadan, bukan ritual khusus satu malam',
            last_ten_days_worship_window: 'rentang sepuluh hari terakhir',
            payment_deadline: 'batas waktu penunaian',
            eid_prayer_practice: 'praktik salat Id',
            eid_fasting_prohibition: 'larangan puasa pada hari Id',
            calendar_history_and_commemoration: 'sejarah kalender/peringatan',
            event_only_not_date: 'peristiwanya saja; bukan tanggal kejadian',
            popular_commemoration_date_not_event_date: 'tanggal peringatan populer; bukan tanggal kejadian pasti',
            historical_exact_date: 'tanggal peristiwa sejarah',
            revelation_day_and_place: 'hari dan tempat turunnya ayat',
            first_revelation_passage_and_place_not_date: 'rangkaian ayat dan tempat wahyu pertama; bukan tanggal Hijriah',
            ramadan_obligatory_fast: 'kewajiban puasa Ramadan',
            verse_text_only: 'teks ayat; bukan bukti tanggal',
            event_narrative_not_date: 'riwayat peristiwa; tidak membuktikan tanggal kalender',
            event_day_not_year: 'hari peristiwa; tahun sejarah tidak disebut',
            prophet_mention_not_date: 'penyebutan nabi; tidak membuktikan tanggal',
            battle_event_not_date: 'peristiwa pertempuran; tidak membuktikan tanggal',
            verse_text_not_date: 'teks ayat; tidak membuktikan tanggal turun',
            event_and_verses_not_date: 'peristiwa dan ayat; tidak membuktikan tanggal Hijriah',
            historical_event_date_disputed: 'peristiwa sejarah; tanggal hari diperselisihkan',
            historical_month_only: 'bulan peristiwa; hari tidak ditetapkan',
            'legal-evidence': 'dalil hukum/ibadah',
            'legal-context': 'konteks syariah',
            'historical-date': 'tanggal dari sumber sejarah',
            'historical-date-opinion': 'salah satu pendapat tanggal sejarah',
            'corroborating-history': 'penguat riwayat sejarah',
            'commemoration-context': 'konteks tanggal peringatan',
            'date-caution': 'peringatan bahwa tanggal diperselisihkan',
            'tradition-date': 'tanggal dalam tradisi yang disebut',
            context_only: 'konteks saja'
        };
        return labels[value] || String(value || '').replace(/[_-]/g, ' ');
    }

    function appendTextElement(parent, tagName, className, text) {
        const element = document.createElement(tagName);
        element.className = className;
        element.textContent = text;
        parent.appendChild(element);
        return element;
    }

    function appendVerifiedSources(card, sources) {
        if (!Array.isArray(sources) || !sources.length) {
            return;
        }
        appendTextElement(card, 'h5', 'astro-event-subtitle', 'Rujukan terverifikasi');
        const sourceList = document.createElement('ul');
        sourceList.className = 'astro-event-sources';
        sources.forEach((source) => {
            const item = document.createElement('li');
            if (source.url) {
                const link = document.createElement('a');
                link.href = source.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = source.title || 'Buka sumber';
                item.appendChild(link);
            } else {
                item.textContent = source.title || source.citation || 'Referensi tersimpan';
            }
            const verified = /^verified/i.test(String(source.verificationStatus || ''));
            const qualification = [
                source.authenticity,
                source.verificationStatus ? (verified ? 'terverifikasi' : 'belum diverifikasi') : ''
            ]
                .filter(Boolean).join(' - ');
            if (qualification) {
                item.appendChild(document.createTextNode(` (${qualification})`));
            }
            const reference = [source.collection, source.referenceNumber].filter(Boolean).join(' - ');
            if (reference) {
                appendTextElement(item, 'span', 'astro-event-source-detail', `Rujukan: ${reference}`);
            }
            if (source.narrator) {
                appendTextElement(item, 'span', 'astro-event-source-detail', `Perawi: ${source.narrator}`);
            }
            if (source.claimScope) {
                appendTextElement(item, 'span', 'astro-event-source-scope', `Cakupan bukti: ${claimScopeLabel(source.claimScope)}.`);
            }
            if (source.citation) {
                appendTextElement(item, 'span', 'astro-event-source-summary', source.citation);
            }
            sourceList.appendChild(item);
        });
        card.appendChild(sourceList);
    }

    function hijriCatalogDescriptor(event, activeMonth) {
        const rule = event && event.calendarRule ? event.calendarRule : {};
        const month = Number(rule.hijri_month || 0);
        const day = Number(rule.day || rule.start_day || 0);
        const endDay = Number(rule.end_day || 0);
        const days = Array.isArray(rule.days) ? rule.days.map(Number).filter(Boolean) : [];
        const monthlyDays = Array.isArray(rule.hijri_days) ? rule.hijri_days.map(Number).filter(Boolean) : [];
        const explicit = String(rule.hijri_date_text_id || '').trim();
        let label = explicit;
        let targetMonth = month;
        let targetDay = day || days[0] || 0;

        if (!label && month > 0) {
            const monthName = HIJRI_MONTH_NAMES[month - 1] || `Bulan ${month}`;
            if (days.length) label = `${days.join(', ')} ${monthName}`;
            else if (day > 0 && endDay > day) label = `${day}-${endDay} ${monthName}`;
            else if (day > 0) label = `${day} ${monthName}`;
            else label = `Sepanjang ${monthName}`;
        } else if (!label && rule.repeat === 'monthly' && monthlyDays.length) {
            label = `${monthlyDays.join(', ')} setiap bulan Hijriah`;
            targetMonth = Number(activeMonth || 1);
            targetDay = monthlyDays[0];
        } else if (!label && Array.isArray(rule.weekdays) && rule.weekdays.length) {
            const weekdayLabels = {
                monday: 'Senin', tuesday: 'Selasa', wednesday: 'Rabu', thursday: 'Kamis',
                friday: 'Jumat', saturday: 'Sabtu', sunday: 'Minggu'
            };
            label = `Setiap ${rule.weekdays.map((value) => weekdayLabels[String(value).toLowerCase()] || String(value)).join(' dan ')}`;
        } else if (!label && rule.repeat === 'alternate-days') {
            label = 'Berselang satu hari';
        } else if (!label) {
            label = 'Tanggal dinamis sesuai aturan kalender';
        }

        if (month > 0 && targetDay < 1) {
            targetDay = 1;
        }
        if (rule.repeat === 'monthly' && monthlyDays.length) {
            targetMonth = Number(activeMonth || 1);
            targetDay = monthlyDays[0];
        }

        const historicalYear = Number(rule.historical_year_ah || 0);
        if (historicalYear > 0 && !label.includes(`${historicalYear}`)) {
            label += ` (riwayat ${historicalYear} H)`;
        }
        return {
            event,
            label,
            targetMonth,
            targetDay,
            sort: month > 0 ? (month * 100 + Math.max(0, targetDay)) : 2000 + Math.max(0, targetDay)
        };
    }

    function findDateForHijri(year, month, day, timeZone, referenceDate) {
        if (![year, month, day].every((value) => Number.isFinite(value) && value > 0)) {
            return null;
        }
        const anchor = referenceDate instanceof Date && Number.isFinite(referenceDate.getTime())
            ? referenceDate
            : actualNow();
        for (let offset = -370; offset <= 370; offset += 1) {
            const candidate = addDays(anchor, offset);
            const parts = calendarParts(candidate, 'hijri', timeZone);
            if (parts.year === year && parts.month === month && parts.day === day) {
                return candidate;
            }
        }
        return null;
    }

    function panelMarkup(prefix, mode) {
        const label = MODE_CONFIG[mode].label;
        return `
            <section class="astro-calendar-panel" id="${prefix}-${mode}-panel" role="tabpanel"
                aria-labelledby="${prefix}-${mode}-tab" data-calendar-panel="${mode}">
                <div class="astro-clock-summary">
                    <div class="astro-analog-clock" data-analog-clock role="img" aria-label="Jam analog ${label}">
                        <span class="astro-clock-number n12">12</span>
                        <span class="astro-clock-number n3">3</span>
                        <span class="astro-clock-number n6">6</span>
                        <span class="astro-clock-number n9">9</span>
                        <span class="astro-clock-hand astro-clock-hour" data-clock-hour></span>
                        <span class="astro-clock-hand astro-clock-minute" data-clock-minute></span>
                        <span class="astro-clock-hand astro-clock-second" data-clock-second></span>
                        <span class="astro-clock-center"></span>
                    </div>
                    <div>
                        <div class="astro-digital-clock" data-digital-clock aria-live="off">00:00:00:000</div>
                        <div class="astro-clock-date-primary" data-date-primary>Memuat tanggal ${label}...</div>
                        <div class="astro-clock-date-secondary" data-date-secondary></div>
                        <div class="astro-clock-zone" data-clock-zone></div>
                    </div>
                </div>
                <div class="astro-month-calendar">
                    <div class="astro-calendar-toolbar">
                        <button class="astro-calendar-action" type="button" data-calendar-previous
                            aria-label="Bulan sebelumnya">&#8249;</button>
                        <h3 class="astro-calendar-month-title" data-calendar-title>Memuat kalender...</h3>
                        <button class="astro-calendar-action" type="button" data-calendar-next
                            aria-label="Bulan berikutnya">&#8250;</button>
                    </div>
                    <div class="astro-calendar-weekdays" role="row" aria-label="Nama hari">
                        ${WEEKDAY_LABELS.map((day) => `<span class="astro-calendar-weekday" role="columnheader">${day}</span>`).join('')}
                    </div>
                    <div class="astro-calendar-days" data-calendar-days role="grid" aria-label="Kalender bulanan ${label}"></div>
                    <button class="astro-calendar-action astro-calendar-today" type="button" data-calendar-today>
                        Kembali ke hari ini
                    </button>
                </div>
                ${mode === 'hijri' ? `
                <section class="astro-hijri-date-catalog" data-hijri-date-catalog aria-label="Katalog tanggal Hijriah yang diterapkan">
                    <div class="astro-hijri-date-catalog-head">
                        <div>
                            <h4>Katalog tanggal Hijriah</h4>
                            <p>Daftar ringkas tanggal yang sudah diterapkan. Untuk menambah catatan, klik tanggal kalender di atas.</p>
                        </div>
                        <span data-hijri-date-catalog-status>Memuat...</span>
                    </div>
                    <div class="astro-hijri-date-catalog-list" data-hijri-date-catalog-list></div>
                </section>` : ''}
            </section>`;
    }

    function rootMarkup(prefix) {
        return `
            <div class="astro-calendar-tabs" role="tablist" aria-label="Pilih kalender">
                <button class="astro-calendar-tab" id="${prefix}-gregorian-tab" type="button" role="tab"
                    aria-controls="${prefix}-gregorian-panel" data-calendar-tab="gregorian">Kalender Masehi</button>
                <button class="astro-calendar-tab" id="${prefix}-hijri-tab" type="button" role="tab"
                    aria-controls="${prefix}-hijri-panel" data-calendar-tab="hijri">Kalender Hijriah</button>
            </div>
            ${panelMarkup(prefix, 'gregorian')}
            ${panelMarkup(prefix, 'hijri')}
            <p class="astro-calendar-help">Klik tanggal untuk melihat ibadah sunnah, hari penting, dan peristiwa sejarah. Kalender Hijriah memakai perhitungan Umm al-Qura dari browser dan dapat berbeda dari penetapan rukyat resmi setempat.</p>
            <div class="astro-calendar-knowledge-actions">
                <p class="astro-calendar-event-status" data-event-status aria-live="polite">Memuat basis data hari penting Hijriah...</p>
            </div>
            <dialog class="astro-calendar-event-dialog" data-event-dialog aria-labelledby="${prefix}-event-title">
                <div class="astro-event-dialog-head">
                    <div>
                        <p class="astro-event-dialog-kicker">Detail kalender Hijriah</p>
                        <h3 id="${prefix}-event-title" data-event-title>Detail tanggal</h3>
                        <p data-event-date-equivalent></p>
                    </div>
                    <button type="button" class="astro-event-dialog-close" data-event-close aria-label="Tutup detail tanggal">&times;</button>
                </div>
                <div class="astro-event-dialog-body" data-event-list></div>
                <p class="astro-event-dialog-note">Catatan: label hukum dan tanggal sejarah bersifat informatif. Ikuti keputusan otoritas keagamaan setempat untuk penetapan awal bulan dan praktik ibadah.</p>
            </dialog>`;
    }

    function populateTimeZones(select) {
        if (!select || select.options.length > 1) {
            return;
        }
        const current = safeTimeZone(select.value) || browserTimeZone();
        let zones = ['UTC', 'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Riyadh'];
        try {
            if (typeof Intl.supportedValuesOf === 'function') {
                zones = Intl.supportedValuesOf('timeZone');
            }
        } catch (error) {
            // Keep the compact fallback list.
        }
        if (!zones.includes('UTC')) {
            zones.unshift('UTC');
        }
        if (current && !zones.includes(current)) {
            zones.unshift(current);
        }
        const fragment = document.createDocumentFragment();
        zones.forEach((zone) => {
            const option = document.createElement('option');
            option.value = zone;
            option.textContent = zone;
            option.selected = zone === current;
            fragment.appendChild(option);
        });
        select.replaceChildren(fragment);
        select.value = current;
    }

    class CalendarClock {
        constructor(root) {
            instanceSequence += 1;
            this.root = root;
            this.prefix = root.id || `astronomy-calendar-clock-${instanceSequence}`;
            this.storageKey = `mpm:astronomy-calendar-clock:v1:${this.prefix}`;
            this.mode = readMode(this.storageKey);
            this.anchors = {
                gregorian: actualNow(),
                hijri: actualNow()
            };
            this.lastTimeZone = '';
            this.lastDayKey = '';
            this.lastDigitalText = '';
            this.events = [];
            this.eventCatalogState = 'loading';
            this.activeHijriCrudDate = null;
            this.timezoneControl = document.getElementById(root.dataset.timezoneControl || '');
            if (root.dataset.populateTimezones === 'true') {
                populateTimeZones(this.timezoneControl);
            }
            root.innerHTML = rootMarkup(this.prefix);
            root.dataset.initialized = 'true';
            this.bind();
            this.activate(this.mode, false);
            this.renderCalendar('gregorian');
            this.renderCalendar('hijri');
            this.loadEvents();
            this.tick = this.tick.bind(this);
            window.requestAnimationFrame(this.tick);
        }

        timeZone() {
            const selected = this.timezoneControl ? this.timezoneControl.value : '';
            return safeTimeZone(selected) || safeTimeZone(this.root.dataset.timezone) || browserTimeZone();
        }

        bind() {
            this.root.querySelectorAll('[data-calendar-tab]').forEach((tab) => {
                tab.addEventListener('click', () => this.activate(tab.dataset.calendarTab, true));
                tab.addEventListener('keydown', (event) => {
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                        return;
                    }
                    event.preventDefault();
                    const currentIndex = MODES.indexOf(tab.dataset.calendarTab);
                    let targetIndex = currentIndex;
                    if (event.key === 'Home') targetIndex = 0;
                    if (event.key === 'End') targetIndex = MODES.length - 1;
                    if (event.key === 'ArrowLeft') targetIndex = (currentIndex - 1 + MODES.length) % MODES.length;
                    if (event.key === 'ArrowRight') targetIndex = (currentIndex + 1) % MODES.length;
                    const targetMode = MODES[targetIndex];
                    this.activate(targetMode, true);
                    this.root.querySelector(`[data-calendar-tab="${targetMode}"]`).focus();
                });
            });
            MODES.forEach((mode) => {
                const panel = this.panel(mode);
                panel.querySelector('[data-calendar-previous]').addEventListener('click', () => {
                    this.anchors[mode] = shiftMonth(this.anchors[mode], mode, this.timeZone(), -1);
                    this.renderCalendar(mode);
                });
                panel.querySelector('[data-calendar-next]').addEventListener('click', () => {
                    this.anchors[mode] = shiftMonth(this.anchors[mode], mode, this.timeZone(), 1);
                    this.renderCalendar(mode);
                });
                panel.querySelector('[data-calendar-today]').addEventListener('click', () => {
                    this.anchors[mode] = actualNow();
                    this.renderCalendar(mode);
                });
            });
            if (this.timezoneControl) {
                this.timezoneControl.addEventListener('change', () => {
                    this.anchors.gregorian = actualNow();
                    this.anchors.hijri = actualNow();
                    this.lastTimeZone = '';
                    this.renderCalendar('gregorian');
                    this.renderCalendar('hijri');
                });
            }
            const dialog = this.root.querySelector('[data-event-dialog]');
            dialog.querySelector('[data-event-close]').addEventListener('click', () => this.closeEventDialog());
            dialog.addEventListener('click', (event) => {
                if (event.target === dialog) {
                    this.closeEventDialog();
                }
            });
        }

        loadEvents(afterLoad) {
            return loadEventCatalog().then((catalog) => {
                this.events = catalog.events;
                this.eventCatalogState = 'ready';
                const datedSourceCount = this.events.reduce((total, event) => total + (Array.isArray(event.sources) ? event.sources.length : 0), 0);
                this.root.querySelector('[data-event-status]').textContent = `${this.events.length} kegiatan bertanggal dan ${datedSourceCount} referensi kalender tersedia.`;
                this.renderCalendar('gregorian');
                this.renderCalendar('hijri');
                if (typeof afterLoad === 'function') {
                    afterLoad();
                }
            }).catch((error) => {
                this.eventCatalogState = 'error';
                this.root.querySelector('[data-event-status]').textContent = `Basis data hari penting belum dapat dimuat (${error.message}). Kalender dan jam tetap dapat digunakan.`;
            });
        }

        eventsForDate(date, timeZone) {
            const hijriParts = calendarParts(date, 'hijri', timeZone);
            return this.events.filter((event) => ruleMatchesHijriDate(event.calendarRule || {}, hijriParts, date, timeZone));
        }

        dateForCatalogDescriptor(descriptor) {
            const anchorParts = calendarParts(this.anchors.hijri || actualNow(), 'hijri', this.timeZone());
            const month = Number(descriptor && descriptor.targetMonth || 0);
            const day = Number(descriptor && descriptor.targetDay || 0);
            return findDateForHijri(anchorParts.year, month, day, this.timeZone(), this.anchors.hijri);
        }

        renderHijriDateCatalog() {
            const panel = this.panel('hijri');
            const list = panel && panel.querySelector('[data-hijri-date-catalog-list]');
            const status = panel && panel.querySelector('[data-hijri-date-catalog-status]');
            if (!list || !status) return;
            list.replaceChildren();
            if (this.eventCatalogState === 'loading') {
                status.textContent = 'Memuat...';
                appendTextElement(list, 'p', 'astro-event-empty', 'Katalog tanggal sedang dimuat.');
                return;
            }
            if (this.eventCatalogState === 'error') {
                status.textContent = 'Tidak tersedia';
                appendTextElement(list, 'p', 'astro-event-empty', 'Katalog tanggal belum dapat dibaca. Kalender tetap dapat digunakan.');
                return;
            }

            const activeMonth = calendarParts(this.anchors.hijri || actualNow(), 'hijri', this.timeZone()).month;
            const entries = this.events
                .map((event) => hijriCatalogDescriptor(event, activeMonth))
                .sort((left, right) => left.sort - right.sort
                    || left.label.localeCompare(right.label, 'id')
                    || String(left.event.nameId || '').localeCompare(String(right.event.nameId || ''), 'id'));
            const userCount = entries.filter((entry) => entry.event.isUserEvent).length;
            status.textContent = `${entries.length} entri${userCount ? ` - ${userCount} catatan pengguna` : ''}`;

            entries.forEach((entry) => {
                const item = document.createElement('article');
                item.className = `astro-hijri-date-catalog-item${entry.event.isUserEvent ? ' is-user-event' : ''}`;
                const summary = document.createElement('div');
                summary.className = 'astro-hijri-date-catalog-summary';
                appendTextElement(summary, 'strong', 'astro-hijri-date-catalog-date', entry.label);
                appendTextElement(summary, 'span', 'astro-hijri-date-catalog-name', entry.event.nameId || entry.event.nameEn || 'Catatan Hijriah');
                appendTextElement(
                    summary,
                    'span',
                    'astro-hijri-date-catalog-state',
                    entry.event.isUserEvent
                        ? 'Catatan pengguna - belum diverifikasi'
                        : `Data kalender - ${certaintyLabel(entry.event.calendarRule && entry.event.calendarRule.date_certainty) || 'aturan tanggal tersimpan'}`
                );
                item.appendChild(summary);

                const actions = document.createElement('div');
                actions.className = 'astro-hijri-date-catalog-actions';
                if (entry.targetMonth > 0 && entry.targetDay > 0) {
                    const open = document.createElement('button');
                    open.type = 'button';
                    open.className = 'astro-calendar-primary-button';
                    open.textContent = entry.event.isUserEvent ? 'Buka & kelola' : 'Buka tanggal';
                    open.addEventListener('click', () => {
                        const date = this.dateForCatalogDescriptor(entry);
                        if (!date) {
                            status.textContent = 'Tanggal tidak dapat dipetakan pada tahun Hijriah yang sedang dilihat.';
                            return;
                        }
                        this.anchors.hijri = date;
                        this.activate('hijri', true);
                        this.showEventsForDate(date, true);
                    });
                    actions.appendChild(open);
                    if (entry.event.isUserEvent) {
                        const edit = document.createElement('button');
                        edit.type = 'button';
                        edit.className = 'astro-calendar-primary-button';
                        edit.textContent = 'Edit';
                        edit.addEventListener('click', () => {
                            const date = this.dateForCatalogDescriptor(entry);
                            if (date) this.showUserEventFormForDate(date, entry.event.userEventId);
                        });
                        const remove = document.createElement('button');
                        remove.type = 'button';
                        remove.className = 'astro-calendar-primary-button astro-user-delete';
                        remove.textContent = 'Hapus';
                        remove.addEventListener('click', () => {
                            const date = this.dateForCatalogDescriptor(entry);
                            if (date) this.deleteUserEventForDate(entry.event, date);
                        });
                        actions.append(edit, remove);
                    }
                } else {
                    appendTextElement(actions, 'span', 'astro-hijri-date-catalog-dynamic', 'Aturan berulang/dinamis');
                }
                item.appendChild(actions);
                list.appendChild(item);
            });
        }

        conflictMessage(event, hijriParts) {
            const rules = event && event.calendarRule && Array.isArray(event.calendarRule.conflict_rules)
                ? event.calendarRule.conflict_rules
                : [];
            const conflict = rules.find((rule) => Number(rule.hijri_month) === Number(hijriParts.month)
                && Array.isArray(rule.days) && rule.days.map(Number).includes(Number(hijriParts.day)));
            return conflict ? String(conflict.message_id || '') : '';
        }

        showEventsForDate(date, allowHijriCrud = false) {
            const timeZone = this.timeZone();
            const hijriParts = calendarParts(date, 'hijri', timeZone);
            const dialog = this.root.querySelector('[data-event-dialog]');
            const list = dialog.querySelector('[data-event-list]');
            const events = this.eventsForDate(date, timeZone);
            this.activeHijriCrudDate = allowHijriCrud ? new Date(date.getTime()) : null;
            dialog.querySelector('[data-event-title]').textContent = longDate(date, 'islamic-umalqura', timeZone);
            dialog.querySelector('[data-event-date-equivalent]').textContent = `Padanan Masehi: ${longDate(date, 'gregory', timeZone)}`;
            list.replaceChildren();

            if (this.eventCatalogState === 'loading') {
                appendTextElement(list, 'p', 'astro-event-empty', 'Basis data masih dimuat. Silakan pilih tanggal ini kembali sebentar lagi.');
            } else if (this.eventCatalogState === 'error') {
                appendTextElement(list, 'p', 'astro-event-empty', 'Basis data hari penting tidak tersedia. Tanggal kalender tetap dapat digunakan.');
            } else if (!events.length) {
                appendTextElement(list, 'p', 'astro-event-empty', 'Tidak ada kegiatan atau peristiwa bertanggal tetap yang tersimpan untuk tanggal ini.');
            } else {
                events.forEach((event) => {
                    const card = document.createElement('article');
                    card.className = 'astro-event-card';
                    appendTextElement(card, 'h4', 'astro-event-name', event.nameId || event.nameEn || 'Peristiwa Hijriah');
                    const badges = document.createElement('div');
                    badges.className = 'astro-event-badges';
                    [event.eventType, event.legalCategory, certaintyLabel(event.calendarRule && event.calendarRule.date_certainty)]
                        .filter(Boolean)
                        .forEach((value) => appendTextElement(badges, 'span', 'astro-event-badge', String(value).replace(/-/g, ' ')));
                    card.appendChild(badges);
                    if (event.descriptionId) {
                        appendTextElement(card, 'p', 'astro-event-description', event.descriptionId);
                    }
                    if (event.isUserEvent) {
                        appendTextElement(
                            card,
                            'p',
                            'astro-event-warning',
                            'Catatan tanggal buatan pengguna. Belum menjadi data agama/sejarah terverifikasi sampai sumbernya ditinjau.'
                        );
                        if (allowHijriCrud) {
                            const userActions = document.createElement('div');
                            userActions.className = 'astro-user-calendar-row-actions';
                            const editButton = document.createElement('button');
                            editButton.type = 'button';
                            editButton.className = 'astro-calendar-primary-button astro-inline-edit-button';
                            editButton.textContent = 'Edit catatan ini';
                            editButton.addEventListener('click', () => this.showUserEventFormForDate(date, event.userEventId));
                            const deleteButton = document.createElement('button');
                            deleteButton.type = 'button';
                            deleteButton.className = 'astro-calendar-primary-button astro-user-delete';
                            deleteButton.textContent = 'Hapus catatan ini';
                            deleteButton.addEventListener('click', () => this.deleteUserEventForDate(event, date));
                            userActions.append(editButton, deleteButton);
                            card.appendChild(userActions);
                        }
                    }
                    const tradition = event.calendarRule && event.calendarRule.tradition_scope;
                    if (tradition && tradition !== 'universal') {
                        appendTextElement(card, 'p', 'astro-event-tradition', `Cakupan tradisi: ${String(tradition).replace(/-/g, ' ')}`);
                    }
                    const actions = event.calendarRule && Array.isArray(event.calendarRule.recommended_actions)
                        ? event.calendarRule.recommended_actions : [];
                    if (actions.length) {
                        appendTextElement(card, 'h5', 'astro-event-subtitle', 'Yang dapat dilakukan');
                        const actionList = document.createElement('ul');
                        actions.forEach((action) => appendTextElement(actionList, 'li', '', action));
                        card.appendChild(actionList);
                    }
                    const avoid = event.calendarRule && Array.isArray(event.calendarRule.avoid_actions)
                        ? event.calendarRule.avoid_actions : [];
                    if (avoid.length) {
                        appendTextElement(card, 'p', 'astro-event-warning', `Perhatian: ${avoid.join('; ')}.`);
                    }
                    const conflict = this.conflictMessage(event, hijriParts);
                    if (conflict) {
                        appendTextElement(card, 'p', 'astro-event-warning', conflict);
                    }
                    appendVerifiedSources(card, event.sources);
                    list.appendChild(card);
                });
            }

            if (allowHijriCrud) {
                const controls = document.createElement('section');
                controls.className = 'astro-date-crud-panel';
                appendTextElement(controls, 'strong', '', 'Kelola tanggal Hijriah ini');
                appendTextElement(controls, 'p', '', 'Tambahkan catatan langsung pada tanggal yang dipilih. Catatan pengguna tetap diberi label belum terverifikasi.');
                const addButton = document.createElement('button');
                addButton.type = 'button';
                addButton.className = 'astro-calendar-primary-button';
                addButton.textContent = 'Tambah catatan pada tanggal ini';
                addButton.addEventListener('click', () => this.showUserEventFormForDate(date));
                controls.appendChild(addButton);
                list.appendChild(controls);
            }

            if (typeof dialog.showModal === 'function') {
                dialog.showModal();
            } else {
                dialog.setAttribute('open', '');
            }
        }

        openEventDialog() {
            const dialog = this.root.querySelector('[data-event-dialog]');
            if (typeof dialog.showModal === 'function') {
                if (!dialog.open) {
                    dialog.showModal();
                }
            } else {
                dialog.setAttribute('open', '');
            }
        }

        reloadCalendarEvents(afterLoad) {
            eventCatalogPromise = null;
            this.eventCatalogState = 'loading';
            this.root.querySelector('[data-event-status]').textContent = 'Memuat ulang kalender setelah perubahan...';
            return this.loadEvents(afterLoad);
        }

        showUserEventFormForDate(date, editEventId = 0) {
            const selectedDate = date instanceof Date && Number.isFinite(date.getTime())
                ? new Date(date.getTime())
                : this.activeHijriCrudDate;
            if (!(selectedDate instanceof Date) || !Number.isFinite(selectedDate.getTime())) {
                return;
            }
            this.activeHijriCrudDate = new Date(selectedDate.getTime());
            const hijriParts = calendarParts(selectedDate, 'hijri', this.timeZone());
            const dialog = this.root.querySelector('[data-event-dialog]');
            const list = dialog.querySelector('[data-event-list]');
            dialog.querySelector('[data-event-title]').textContent = editEventId > 0
                ? 'Edit catatan pada tanggal Hijriah'
                : 'Tambah catatan pada tanggal Hijriah';
            dialog.querySelector('[data-event-date-equivalent]').textContent = `${longDate(selectedDate, 'islamic-umalqura', this.timeZone())} - ${longDate(selectedDate, 'gregory', this.timeZone())}`;
            list.replaceChildren();
            appendTextElement(list, 'p', 'astro-event-empty', 'Menyiapkan formulir untuk tanggal yang dipilih...');
            this.openEventDialog();

            loadUserCalendarEvents().then((catalog) => {
                const events = catalog.events || [];
                const selected = events.find((event) => Number(event.userEventId) === Number(editEventId || 0)) || null;
                if (editEventId > 0 && !selected) {
                    throw new Error('Catatan yang akan diedit tidak ditemukan atau sudah dihapus.');
                }
                this.renderUserEventFormForDate(list, selectedDate, hijriParts, selected, catalog.mutationPolicy || {});
            }).catch((error) => {
                list.replaceChildren();
                appendTextElement(list, 'p', 'astro-event-empty', `Data tanggal pengguna belum dapat dimuat (${error.message}).`);
            });
        }

        renderUserEventFormForDate(list, selectedDate, hijriParts, selected, mutationPolicy) {
            list.replaceChildren();
            const selectedMonth = selected ? Number(selected.hijriMonth) : Number(hijriParts.month);
            const selectedDay = selected ? Number(selected.hijriDay) : Number(hijriParts.day);
            const explanation = document.createElement('div');
            explanation.className = 'astro-user-calendar-explanation';
            appendTextElement(explanation, 'strong', '', selected ? 'Mode edit' : 'Tambah catatan pada tanggal ini');
            appendTextElement(
                explanation,
                'span',
                '',
                selected
                    ? `Mengedit "${selected.nameId}". Tanggal awal tetap ${selectedDay} ${HIJRI_MONTH_NAMES[selectedMonth - 1] || ''}. Versi ${selected.version}.`
                    : `Tanggal pilihan: ${selectedDay} ${HIJRI_MONTH_NAMES[selectedMonth - 1] || ''}. Isi nama catatan; tanggal akhir, tahun, deskripsi, dan rujukan bersifat opsional.`
            );
            list.appendChild(explanation);

            const form = document.createElement('form');
            form.className = 'astro-user-calendar-form';
            form.dataset.userEventForm = '';
            form.innerHTML = `
                <input type="hidden" name="userEventId">
                <input type="hidden" name="version">
                <input type="hidden" name="hijriMonth" value="${selectedMonth}">
                <input type="hidden" name="hijriDay" value="${selectedDay}">
                <label class="astro-user-calendar-field astro-user-calendar-wide">
                    <span>Nama kegiatan / peristiwa *</span>
                    <input type="text" name="nameId" maxlength="260" required placeholder="Contoh: Kajian keluarga setiap 10 Muharram">
                </label>
                <label class="astro-user-calendar-field">
                    <span>Tanggal akhir</span>
                    <input type="number" name="hijriEndDay" min="1" max="30" placeholder="Opsional">
                </label>
                <label class="astro-user-calendar-field">
                    <span>Tahun H</span>
                    <input type="number" name="historicalYearAh" min="1" max="3000" placeholder="Opsional">
                </label>
                <label class="astro-user-calendar-field">
                    <span>Jenis catatan</span>
                    <select name="eventType">
                        <option value="user-note">Catatan umum</option>
                        <option value="historical-event">Peristiwa sejarah</option>
                        <option value="commemoration">Peringatan</option>
                        <option value="worship-note">Catatan ibadah</option>
                        <option value="family-note">Catatan keluarga</option>
                        <option value="other">Lainnya</option>
                    </select>
                </label>
                <label class="astro-user-calendar-field">
                    <span>Kepastian tanggal</span>
                    <select name="dateCertainty">
                        <option value="user-entered-unverified">Input manual - belum diverifikasi</option>
                        <option value="source-supplied-unreviewed">Ada sumber - belum ditinjau</option>
                        <option value="reported-date">Tanggal diriwayatkan</option>
                        <option value="traditional-date">Tanggal tradisi</option>
                        <option value="date-disputed">Tanggal diperselisihkan</option>
                    </select>
                </label>
                <label class="astro-user-calendar-field astro-user-calendar-wide">
                    <span>Penjelasan</span>
                    <textarea name="descriptionId" rows="3" maxlength="5000" placeholder="Apa yang perlu diketahui ketika tanggal ini dibuka?"></textarea>
                </label>
                <label class="astro-user-calendar-field astro-user-calendar-wide">
                    <span>Judul rujukan</span>
                    <input type="text" name="sourceTitle" maxlength="500" placeholder="Opsional, contoh: Sahih al-Bukhari 45">
                </label>
                <label class="astro-user-calendar-field astro-user-calendar-wide">
                    <span>URL rujukan HTTPS</span>
                    <input type="url" name="sourceUrl" maxlength="700" placeholder="https://...">
                    <small>Rujukan yang Anda masukkan tetap berlabel belum diverifikasi sampai ditinjau.</small>
                </label>
                <label class="astro-user-calendar-field astro-user-calendar-wide">
                    <span>Token admin</span>
                    <input type="password" name="adminToken" autocomplete="off" placeholder="Kosongkan bila aplikasi lokal tidak memerlukannya">
                    <small>${mutationPolicy.adminTokenConfigured ? 'Server ini menggunakan token admin.' : 'Mode lokal: perubahan hanya diterima dari host aplikasi yang sama.'}</small>
                </label>
                <div class="astro-user-calendar-actions astro-user-calendar-wide">
                    <button type="submit" class="astro-calendar-primary-button astro-user-save">${selected ? 'Simpan Perubahan' : 'Tambah & Simpan'}</button>
                    <button type="button" class="astro-calendar-primary-button astro-user-cancel">Kembali ke detail tanggal</button>
                </div>
                <p class="astro-user-calendar-form-status astro-user-calendar-wide" data-user-form-status aria-live="polite"></p>`;
            list.appendChild(form);

            if (selected) {
                Object.entries({
                    userEventId: selected.userEventId,
                    version: selected.version,
                    nameId: selected.nameId,
                    hijriMonth: selected.hijriMonth,
                    hijriDay: selected.hijriDay,
                    hijriEndDay: selected.hijriEndDay || '',
                    historicalYearAh: selected.historicalYearAh || '',
                    eventType: selected.eventType,
                    dateCertainty: selected.dateCertainty,
                    descriptionId: selected.descriptionId,
                    sourceTitle: selected.sourceTitle,
                    sourceUrl: selected.sourceUrl
                }).forEach(([name, value]) => {
                    const field = form.elements.namedItem(name);
                    if (field) field.value = value == null ? '' : String(value);
                });
            }

            form.addEventListener('submit', (event) => {
                event.preventDefault();
                this.saveUserEvent(form);
            });
            form.querySelector('.astro-user-cancel')?.addEventListener('click', () => this.showEventsForDate(selectedDate, true));
        }

        saveUserEvent(form) {
            const status = form.querySelector('[data-user-form-status]');
            const save = form.querySelector('.astro-user-save');
            const data = new FormData(form);
            const userEventId = Number(data.get('userEventId') || 0);
            const version = Number(data.get('version') || 0);
            const payload = {
                userEventId,
                version,
                nameId: String(data.get('nameId') || ''),
                hijriMonth: Number(data.get('hijriMonth') || 0),
                hijriDay: Number(data.get('hijriDay') || 0),
                hijriEndDay: String(data.get('hijriEndDay') || ''),
                historicalYearAh: String(data.get('historicalYearAh') || ''),
                eventType: String(data.get('eventType') || 'user-note'),
                dateCertainty: String(data.get('dateCertainty') || 'user-entered-unverified'),
                descriptionId: String(data.get('descriptionId') || ''),
                sourceTitle: String(data.get('sourceTitle') || ''),
                sourceUrl: String(data.get('sourceUrl') || '')
            };
            save.disabled = true;
            status.textContent = userEventId > 0 ? 'Menyimpan perubahan...' : 'Menambahkan tanggal...';
            mutateUserCalendarEvent(
                userEventId > 0 ? 'PUT' : 'POST',
                payload,
                String(data.get('adminToken') || '')
            ).then(() => {
                status.textContent = 'Tersimpan. Kalender sedang dimuat ulang.';
                const selectedDate = this.activeHijriCrudDate && new Date(this.activeHijriCrudDate.getTime());
                this.reloadCalendarEvents(() => {
                    if (selectedDate) this.showEventsForDate(selectedDate, true);
                });
            }).catch((error) => {
                save.disabled = false;
                status.textContent = `Gagal menyimpan: ${error.message}`;
            });
        }

        deleteUserEventForDate(entry, selectedDate, adminToken = '', skipConfirmation = false) {
            if (!skipConfirmation && !window.confirm(`Hapus "${entry.nameId}" dari tanggal ini? Riwayat perubahan tetap disimpan untuk audit.`)) {
                return;
            }
            mutateUserCalendarEvent('DELETE', {
                userEventId: entry.userEventId,
                version: entry.version
            }, adminToken).then(() => {
                this.reloadCalendarEvents(() => this.showEventsForDate(selectedDate, true));
            }).catch((error) => {
                if (error.status === 403 && !adminToken) {
                    const token = window.prompt('Server meminta token admin untuk menghapus catatan ini.', '');
                    if (token) {
                        this.deleteUserEventForDate(entry, selectedDate, token, true);
                        return;
                    }
                }
                window.alert(`Gagal menghapus: ${error.message}`);
            });
        }

        closeEventDialog() {
            const dialog = this.root.querySelector('[data-event-dialog]');
            if (typeof dialog.close === 'function' && dialog.open) {
                dialog.close();
            } else {
                dialog.removeAttribute('open');
            }
        }

        panel(mode) {
            return this.root.querySelector(`[data-calendar-panel="${mode}"]`);
        }

        activate(mode, persist) {
            this.mode = normalizeMode(mode);
            MODES.forEach((candidate) => {
                const selected = candidate === this.mode;
                const tab = this.root.querySelector(`[data-calendar-tab="${candidate}"]`);
                const panel = this.panel(candidate);
                tab.setAttribute('aria-selected', selected ? 'true' : 'false');
                tab.tabIndex = selected ? 0 : -1;
                panel.hidden = !selected;
            });
            if (persist) {
                writeMode(this.storageKey, this.mode);
            }
            this.renderCalendar(this.mode);
            this.updateClock(actualNow(), this.mode, this.timeZone());
        }

        renderCalendar(mode) {
            const panel = this.panel(mode);
            if (!panel) {
                return;
            }
            const timeZone = this.timeZone();
            const start = findMonthStart(this.anchors[mode], mode, timeZone);
            this.anchors[mode] = start;
            const startParts = calendarParts(start, mode, timeZone);
            const todayParts = calendarParts(actualNow(), mode, timeZone);
            const dates = [];
            for (let offset = 0; offset < 35; offset += 1) {
                const date = addDays(start, offset);
                const parts = calendarParts(date, mode, timeZone);
                if (!sameCalendarMonth(parts, startParts)) {
                    break;
                }
                dates.push({ date, parts });
            }
            const grid = panel.querySelector('[data-calendar-days]');
            const fragment = document.createDocumentFragment();
            const blanksBefore = weekdayIndex(start, timeZone);
            const totalCells = 42;
            for (let index = 0; index < totalCells; index += 1) {
                const dayIndex = index - blanksBefore;
                const cell = document.createElement(dayIndex < 0 || dayIndex >= dates.length ? 'span' : 'button');
                cell.className = 'astro-calendar-day';
                cell.setAttribute('role', 'gridcell');
                if (dayIndex < 0 || dayIndex >= dates.length) {
                    cell.classList.add('is-empty');
                    cell.setAttribute('aria-hidden', 'true');
                    cell.textContent = '0';
                } else {
                    const entry = dates[dayIndex];
                    cell.type = 'button';
                    const number = document.createElement('span');
                    number.className = 'astro-calendar-day-number';
                    number.textContent = String(entry.parts.day);
                    cell.appendChild(number);
                    const matchedEvents = this.eventsForDate(entry.date, timeZone);
                    if (matchedEvents.length) {
                        cell.classList.add('has-events');
                        const count = document.createElement('span');
                        count.className = 'astro-calendar-event-count';
                        count.textContent = String(matchedEvents.length);
                        count.setAttribute('aria-hidden', 'true');
                        cell.appendChild(count);
                    }
                    const eventText = matchedEvents.length ? `, ${matchedEvents.length} kegiatan atau peristiwa` : ', tidak ada peristiwa bertanggal tetap';
                    cell.setAttribute('aria-label', `${longDate(entry.date, MODE_CONFIG[mode].calendar, timeZone)}${eventText}`);
                    cell.addEventListener('click', () => this.showEventsForDate(entry.date, mode === 'hijri'));
                    if (entry.parts.year === todayParts.year && entry.parts.month === todayParts.month && entry.parts.day === todayParts.day) {
                        cell.classList.add('is-today');
                        cell.setAttribute('aria-current', 'date');
                    }
                }
                fragment.appendChild(cell);
            }
            grid.replaceChildren(fragment);
            panel.querySelector('[data-calendar-title]').textContent = monthTitle(start, MODE_CONFIG[mode].calendar, timeZone);
            if (mode === 'hijri') {
                this.renderHijriDateCatalog();
            }
        }

        updateClock(now, mode, timeZone) {
            const panel = this.panel(mode);
            if (!panel) {
                return;
            }
            const parts = timeParts(now, timeZone);
            const milliseconds = now.getMilliseconds();
            const digital = `${pad(parts.hour, 2)}:${pad(parts.minute, 2)}:${pad(parts.second, 2)}:${pad(milliseconds, 3)}`;
            const secondValue = parts.second + (milliseconds / 1000);
            const minuteValue = parts.minute + (secondValue / 60);
            const hourValue = (parts.hour % 12) + (minuteValue / 60);
            panel.querySelector('[data-digital-clock]').textContent = digital;
            panel.querySelector('[data-clock-hour]').style.transform = `translateX(-50%) rotate(${hourValue * 30}deg)`;
            panel.querySelector('[data-clock-minute]').style.transform = `translateX(-50%) rotate(${minuteValue * 6}deg)`;
            panel.querySelector('[data-clock-second]').style.transform = `translateX(-50%) rotate(${secondValue * 6}deg)`;
            const analog = panel.querySelector('[data-analog-clock]');
            analog.setAttribute('aria-label', `Jam analog ${MODE_CONFIG[mode].label}: ${pad(parts.hour, 2)} lewat ${pad(parts.minute, 2)} menit ${pad(parts.second, 2)} detik`);
            const zoneNode = panel.querySelector('[data-clock-zone]');
            if (!zoneNode.textContent || digital.slice(0, 8) !== this.lastDigitalText.slice(0, 8) || timeZone !== this.lastTimeZone) {
                zoneNode.textContent = timeZoneLabel(now, timeZone);
            }
            const today = calendarParts(now, mode, timeZone);
            const dateKey = `${mode}|${timeZone}|${today.year}-${today.month}-${today.day}`;
            if (dateKey !== this.lastDayKey || timeZone !== this.lastTimeZone) {
                panel.querySelector('[data-date-primary]').textContent = longDate(now, MODE_CONFIG[mode].calendar, timeZone);
                panel.querySelector('[data-date-secondary]').textContent = `Padanan ${MODE_CONFIG[mode].secondaryLabel}: ${longDate(now, MODE_CONFIG[mode].secondaryCalendar, timeZone)}`;
                this.lastDayKey = dateKey;
                this.renderCalendar(mode);
            }
            this.lastDigitalText = digital;
            this.lastTimeZone = timeZone;
        }

        tick() {
            const now = actualNow();
            const timeZone = this.timeZone();
            if (timeZone !== this.lastTimeZone) {
                this.renderCalendar('gregorian');
                this.renderCalendar('hijri');
            }
            this.updateClock(now, this.mode, timeZone);
            window.requestAnimationFrame(this.tick);
        }
    }

    function initialize() {
        document.querySelectorAll('[data-astronomy-calendar-clock]').forEach((root) => {
            if (root.dataset.initialized !== 'true') {
                instances.push(new CalendarClock(root));
            }
        });
        if (instances.length) {
            document.dispatchEvent(new CustomEvent('astronomy-calendar-clock:ready', {
                detail: { count: instances.length }
            }));
        }
    }

    window.AstronomyCalendarClock = {
        initialize,
        instances
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
}(window, document));
