(function () {
    'use strict';
    const iso = value => value && Number.isFinite(value.getTime()) ? value.toISOString() : null;
    const labels = {fajr:'Fajr',sunrise:'Sunrise',dhuhr:'Dhuhr / Istiwa',asr_jumhur:'Ashr Jumhur',asr_hanafi:'Ashr Hanafi',maghrib:'Maghrib',syafaq:'Syafaq',syafaq_abyadh:'Syafaq Abyadh',hilal:'Hilal'};
    function calculate(input, method, reference) {
        const A = window.Astronomy;
        if (!A || !method) throw new Error('Engine atau metode Falak belum tersedia.');
        const date = new Date(input.utc), lat = Number(input.latitude), lon = Number(input.longitude), elevation = Number(input.elevation || 0), offset = Number(input.offsetHours);
        if (!Number.isFinite(date.getTime()) || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180) throw new Error('Waktu/koordinat tidak valid.');
        const observer = new A.Observer(lat, lon, elevation);
        const day = input.localTime.slice(0,10), start = new Date(Date.parse(day+'T00:00:00Z')-offset*3600000), end = new Date(start.getTime()+86400000);
        const within = value => value && value.getTime()>=start.getTime() && value.getTime()<end.getTime() ? value : null;
        function position(body, at) {
            const equator = A.Equator(body, at, observer, true, true);
            const apparent = A.Horizon(at, observer, equator.ra, equator.dec, 'normal');
            const geometric = A.Horizon(at, observer, equator.ra, equator.dec, null);
            return {altitude:apparent.altitude, geometricAltitude:geometric.altitude, azimuth:apparent.azimuth, declination:equator.dec, rightAscensionHours:equator.ra, hourAngleDegrees:A.HourAngle(body, at, observer)*15};
        }
        function crossing(altitude, direction, from) {
            if (!Number.isFinite(altitude) || altitude<=-90 || altitude>=90) return null;
            const since=from || start, days=Math.max(0,(end-since)/86400000);
            if (!days) return null;
            const found=A.SearchAltitude(A.Body.Sun,observer,direction,since,days,altitude);
            return found ? within(found.date) : null;
        }
        const transitResult=A.SearchHourAngle(A.Body.Sun,observer,0,start,1);
        const transit=within(transitResult.time.date), sun=position(A.Body.Sun,date), moon=position(A.Body.Moon,date);
        const profile=method.publicationParameters || {}, offsets=profile.prayerOffsetsMinutes || {};
        const val=(x, fallback)=> x !== null && x !== undefined && Number.isFinite(Number(x)) ? Number(x) : fallback;
        const dip=elevation>0 ? 0.0347*Math.sqrt(elevation) : 0;
        const params={methodKey:method.methodKey,methodName:method.name,fajrAngle:val(method.fajrAngle,18),ishaAngle:val(method.ishaAngle,18),ishaInterval:method.ishaInterval || null,
            sunriseAltitude:val(profile.sunriseAltitudeDegrees,-0.833)-dip, sunsetAltitude:val(profile.maghribAltitudeDegrees,-0.833)-dip,
            syafaqAngle:val(input.syafaqAngle,method.ishaAngle),abyadhAngle:val(input.abyadhAngle,method.ishaAngle),
            elevationMeters:elevation,horizonDipDegrees:dip,offsetsMinutes:offsets,altitudeConvention:'geometric solar centre; rise/set threshold includes conventional refraction and solar radius',profile:JSON.parse(JSON.stringify(profile))};
        if (![params.fajrAngle,params.ishaAngle,params.syafaqAngle,params.abyadhAngle].every(x=>Number.isFinite(x)&&x>0&&x<30)) throw new Error('Sudut senja/fajar harus lebih dari 0 dan kurang dari 30 derajat.');
        const shift=(value, key)=>value ? new Date(value.getTime()+val(offsets[key],0)*60000) : null;
        const noonSun=transit ? position(A.Body.Sun,transit) : null;
        const noonRatio=noonSun && noonSun.geometricAltitude>0 ? 1/Math.tan(noonSun.geometricAltitude*Math.PI/180) : null;
        const asr=factor=>noonRatio===null ? null : crossing(Math.atan(1/(factor+noonRatio))*180/Math.PI,-1,transit);
        const sunset=crossing(params.sunsetAltitude,-1);
        const raw={fajr:shift(crossing(-params.fajrAngle,1),'subuh'),sunrise:shift(crossing(params.sunriseAltitude,1),'syuruq'),
            dhuhr:shift(transit,'dhuhur'),asr_jumhur:shift(asr(1),'ashar'),asr_hanafi:shift(asr(2),'ashar'),maghrib:shift(sunset,'maghrib'),
            syafaq:crossing(-params.syafaqAngle,-1),syafaq_abyadh:crossing(-params.abyadhAngle,-1),
            isha:shift(params.ishaInterval && sunset ? new Date(sunset.getTime()+Number(params.ishaInterval)*60000) : crossing(-params.ishaAngle,-1),'isha')};
        const phase=A.Illumination(A.Body.Moon,date);
        moon.illumination=phase.phase_fraction; moon.phaseDegrees=A.MoonPhase(date); moon.elongationDegrees=A.AngleFromSun(A.Body.Moon,date);
        const baseline=raw[input.type] || null;
        const result={engine:'Astronomy Engine 2.1.19',timestamp:iso(date),input:{type:input.type,latitude:lat,longitude:lon,elevation,offsetHours:offset},
            parameters:params,sun,moon,transit:iso(transit),prayer:Object.fromEntries(Object.entries(raw).map(([key,value])=>[key,iso(value)])),
            comparison:{event:input.type,calculated:iso(baseline),observed:iso(date),differenceSeconds:baseline ? (date-baseline)/1000 : null},
            shadow:{noonRatio,expectedJumhurRatio:noonRatio===null?null:1+noonRatio,expectedHanafiRatio:noonRatio===null?null:2+noonRatio,
                predictedRatio:sun.geometricAltitude>0 ? 1/Math.tan(sun.geometricAltitude*Math.PI/180) : null},
            calibration:null};
        if (input.measurement && input.measurement.heightMeters>0) {
            result.shadow.measuredRatio=input.measurement.shadowMeters/input.measurement.heightMeters;
        }
        if (reference) {
            const ref=reference.observed, stored=reference.calculated;
            if (!reference.reference.enabled || ref.status!=='recorded') throw new Error('Observasi terpilih bukan referensi aktif.');
            if (Math.abs(ref.latitude-lat)>0.0001 || Math.abs(ref.longitude-lon)>0.0001 || Math.abs(Number(ref.elevation||0)-elevation)>1) throw new Error('Referensi berasal dari lokasi/elevasi berbeda. Gunakan lokasi referensi atau pilih referensi setempat.');
            if (ref.type==='hilal') {
                result.referenceVisibility={referenceId:reference.id,referenceVersion:reference.version,referenceUtc:ref.utc,visibility:ref.visibility,
                    sourceMoon:stored.moon,currentMoon:moon,altitudeDifferenceDegrees:moon.altitude-stored.moon.altitude,
                    note:'Perbandingan kondisi Bulan dengan observasi hilal tersimpan; bukan prediksi pasti terlihat dan tidak mengubah waktu sholat.'};
                return result;
            }
            let calibrated=null, rule='solar-altitude', parameter=stored.sun.geometricAltitude;
            if (ref.type==='dhuhr') {
                rule='observed-minus-transit-seconds'; parameter=(Date.parse(ref.utc)-Date.parse(stored.transit))/1000;
                calibrated=transit && Number.isFinite(parameter) ? new Date(transit.getTime()+parameter*1000) : null;
            } else if (ref.type==='asr_jumhur' || ref.type==='asr_hanafi') {
                rule='measured-shadow-factor'; parameter=stored.shadow.measuredRatio-stored.shadow.noonRatio;
                calibrated=Number.isFinite(parameter)&&parameter>0 ? asr(parameter) : null;
            } else calibrated=crossing(parameter,['fajr','sunrise'].includes(ref.type)?1:-1);
            result.calibration={referenceId:reference.id,referenceVersion:reference.version,referenceUtc:ref.utc,event:ref.type,rule,parameter,
                baseline:result.prayer[ref.type],calculated:iso(calibrated),differenceSeconds:calibrated && raw[ref.type] ? (calibrated-raw[ref.type])/1000 : null,
                note:'Simulasi referensi lapangan; tidak mengubah jadwal resmi atau membuktikan kriteria universal.'};
        }
        return result;
    }
    window.FieldObservationEngine={calculate,labels};
}());
