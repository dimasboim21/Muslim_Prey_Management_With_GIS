(function (global) {
    'use strict';
    // Color anchors are illustrative. Religious visibility phenomena are not
    // observations inferred from solar altitude. Use the selected prayer model.
    const phases = [
        ['white', 'Syafaq abyadh', '#94a7e8', 'Sisa cahaya senja: jangkar visual −16°; bukan deteksi hilangnya syafaq.'],
        ['night', 'Malam', '#050c28', 'Biru gelap; cahaya Bulan hanya memberi sedikit pencerahan.'],
        ['before', 'Sebelum fajar', '#29206b', 'Transisi ilustratif mulai 4° sebelum sudut fajar terpilih.'],
        ['false', 'Fajar kadzib', '#9383ad', 'Cahaya zodiakal perlu observasi; tidak diberi zona atau waktu otomatis.'],
        ['first', 'Awal fajar shadiq', '#7043d6', 'Jangkar mengikuti sudut fajar metode terpilih; perkiraan model.'],
        ['dawn', 'Fajar shadiq', '#168dcf', 'Gradasi lanjut sesudah jangkar fajar menuju terbit.'],
        ['riseStart', 'Mulai sunrise', '#f58472', 'Jangkar visual −1,2° ketika Matahari naik.'],
        ['rise', 'Sunrise', '#ffaf20', 'Pusat Matahari −0,833°; pendekatan ufuk datar standar.'],
        ['riseUp', 'Sunrise up', '#ffe35d', 'Jangkar visual +2° ketika Matahari naik.'],
        ['morning', 'Morning / pagi', '#26bdc6', 'Jangkar visual +8° pada sisi pagi.'],
        ['preNoon', 'Awal istiwa', '#b8e780', 'Ilustrasi mendekati transit: sudut jam −4° (sekitar 16 menit).'],
        ['noon', 'Istiwa', '#fff3ac', 'Transit Matahari di meridian setempat: sudut jam 0°.'],
        ['zawal', 'Zawal / dhuhur', '#ffd044', 'Jangkar visual sesudah transit (+1°); bukan tambahan waktu jadwal.'],
        ['asrStart', 'Awal ashar', '#f6a026', 'Ambang panjang bayangan sesuai faktor ashar metode terpilih.'],
        ['asr', 'Ashar', '#f47722', 'Ilustrasi perkembangan sore sesudah ambang ashar.'],
        ['lateAsr', 'Late ashar', '#dc452b', 'Ilustrasi sore lanjut menuju Matahari +6°.'],
        ['golden', 'Golden hour', '#ffc12c', 'Jangkar visual +6° ketika Matahari turun; durasi tidak selalu satu jam.'],
        ['setStart', 'Mulai sunset', '#fa6337', 'Jangkar visual +0,5° ketika Matahari turun.'],
        ['set', 'Sunset', '#ed3055', 'Pusat Matahari −0,833°; pendekatan ufuk datar standar.'],
        ['ghurub', 'Ghurub', '#d3268a', 'Lanjutan warna selepas terbenam (−2°); ghurub merujuk peristiwa terbenam yang sama.'],
        ['red', 'Mulai syafaq ahmar', '#af309d', 'Jangkar senja kemerahan −4°; istilah ahmar berarti merah.'],
        ['redFade', 'Pelemahan syafaq ahmar', '#813bbb', 'Jangkar visual −8°; warna aktual dipengaruhi atmosfer.'],
        ['redGone', 'Syafaq ahmar menghilang', '#51499e', 'Jangkar visual −12°; bukan konfirmasi observasi hilangnya kemerahan.']
    ].map(([id, label, hex, detail]) => ({ id, label, hex, detail,
        rgb: [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) }));
    const byId = Object.fromEntries(phases.map(p => [p.id, p]));
    const rad = Math.PI / 180;
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    function blend(a, b, t) {
        const x = clamp(t, 0, 1);
        // Hold recognizable anchor colors longer without moving phase positions.
        const weight = x * x * (3 - 2 * x);
        return a.map((v, i) => Math.round(v + (b[i] - v) * weight));
    }
    function build(latitude, declination, fajrAngle, shadowFactor) {
        const phi = latitude * rad, dec = declination * rad;
        const fajr = clamp(Number(fajrAngle) || 20, 6, 30);
        const factor = clamp(Number(shadowFactor) || 1, 1, 2);
        const altitude = h => Math.asin(clamp(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h * rad), -1, 1)) / rad;
        function crossing(a) {
            const c = (Math.sin(a * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
            return c >= -1 && c <= 1 ? Math.acos(c) / rad : null;
        }
        const knots = [];
        function add(h, id) { if (h !== null && Number.isFinite(h)) knots.push({ h, phase: byId[id], rgb: byId[id].rgb }); }
        function at(a, direction, id) { const h = crossing(a); if (h !== null) add(direction * h, id); }
        const morning = [[-fajr - 4, 'before'], [-fajr, 'first'], [-Math.max(4, fajr - 6), 'dawn'], [-1.2, 'riseStart'], [-0.833, 'rise'], [2, 'riseUp'], [8, 'morning']];
        const evening = [[6, 'golden'], [0.5, 'setStart'], [-0.833, 'set'], [-2, 'ghurub'], [-4, 'red'], [-8, 'redFade'], [-12, 'redGone'], [-16, 'white'], [-20, 'night']];
        function altitudeColor(a, rising) {
            const stops = rising ? [[-35, 'night'], ...morning, [60, 'noon']] : [[-35, 'night'], ...evening.slice().reverse(), [60, 'noon']];
            for (let i = 1; i < stops.length; i++) {
                if (a <= stops[i][0]) return blend(byId[stops[i - 1][1]].rgb, byId[stops[i][1]].rgb, (a - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
            }
            return byId.noon.rgb;
        }
        // At high latitudes, absent horizon crossings must not invent a full
        // sunrise/sunset cycle. Color still follows the actual solar altitude.
        const polar = crossing(-0.833) === null;
        const midnightColor = altitudeColor(altitude(180), false);
        knots.push({ h: -180, phase: byId.night, rgb: midnightColor });
        morning.forEach(([a, id]) => at(a, -1, id));
        if (altitude(0) > 8) {
            add(-4, 'preNoon'); add(0, 'noon'); add(1, 'zawal');
            const noonZenith = Math.abs(latitude - declination);
            if (noonZenith < 90) {
                const asrAltitude = Math.atan(1 / (factor + Math.tan(noonZenith * rad))) / rad;
                const start = crossing(asrAltitude), golden = crossing(6);
                if (start !== null && golden !== null && start > 1 && start < golden) {
                    add(start, 'asrStart'); add(start + (golden - start) / 3, 'asr');
                    add(start + (golden - start) * 2 / 3, 'lateAsr');
                }
            }
        }
        evening.forEach(([a, id]) => at(a, 1, id));
        knots.push({ h: 180, phase: byId.night, rgb: midnightColor });
        knots.sort((a, b) => a.h - b.h);
        return {
            knots,
            sample(hourAngle, moonAltitude = -90, illumination = 0) {
                const h = ((hourAngle + 180) % 360 + 360) % 360 - 180;
                let rgb;
                if (polar) {
                    // A single altitude ramp avoids a discontinuity at midnight.
                    rgb = altitudeColor(altitude(h), false);
                } else {
                    let i = 1;
                    while (i < knots.length - 1 && h > knots[i].h) i++;
                    const a = knots[i - 1], b = knots[i];
                    rgb = blend(a.rgb, b.rgb, (h - a.h) / Math.max(1e-9, b.h - a.h));
                }
                if (altitude(h) < -18 && moonAltitude > 0) rgb = blend(rgb, [36, 64, 106], clamp(illumination, 0, 1) * 0.12);
                return [...rgb, 255];
            }
        };
    }
    global.MpmAtmosphereGrading = { phases, build };
})(window);
