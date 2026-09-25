/**
 * ========================================
 * SOLAR TIME CALCULATOR
 * Perhitungan waktu sholat berdasarkan posisi matahari
 * ======================================== 
 */

(function (window) {
  'use strict';

  // ========================================
  // KONSTANTA ASTRONOMI
  // ========================================
  const DEGREES_TO_RADIANS = Math.PI / 180;
  const RADIANS_TO_DEGREES = 180 / Math.PI;

  // ========================================
  // FUNGSI UTILITY
  // ========================================

  /**
   * Normalisasi sudut ke range 0-360 derajat
   */
  function normalizeAngle(angle) {
    return angle - 360 * Math.floor(angle / 360);
  }

  /**
   * Konversi derajat desimal ke jam:menit:detik
   */
  function degreesToTime(degrees) {
    degrees = normalizeAngle(degrees);
    const hours = Math.floor(degrees / 15);
    const remainder = (degrees % 15) * 4;
    const minutes = Math.floor(remainder);
    const seconds = Math.floor((remainder % 1) * 60);

    return {
      hours: hours,
      minutes: minutes,
      seconds: seconds,
      formatted: String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0')
    };
  }

  /**
   * Hitung Julian Day Number
   */
  function calculateJulianDay(date) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();

    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;

    const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    const jd = jdn + (hours - 12) / 24 + minutes / 1440 + seconds / 86400;

    return jd;
  }

  /**
   * Hitung Mean Solar Time
   */
  function calculateMeanSolarTime(jd) {
    return jd + 0.0008;
  }

  /**
   * Hitung Sun's Mean Longitude
   */
  function calculateSunMeanLongitude(jd) {
    const t = (jd - 2451545.0) / 36525.0;
    return normalizeAngle(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
  }

  /**
   * Hitung Sun's Mean Anomaly
   */
  function calculateSunMeanAnomaly(jd) {
    const t = (jd - 2451545.0) / 36525.0;
    return normalizeAngle(357.52911 + 35999.05029 * t - 0.0001536 * t * t);
  }

  /**
   * Hitung Equation of Center
   */
  function calculateEquationOfCenter(jd) {
    const M = calculateSunMeanAnomaly(jd) * DEGREES_TO_RADIANS;
    const c = (1.914602 - 0.004817 * (jd - 2451545.0) / 36525.0 - 0.000014 * Math.pow((jd - 2451545.0) / 36525.0, 2)) * Math.sin(M)
      + (0.019993 - 0.000101 * (jd - 2451545.0) / 36525.0) * Math.sin(2 * M)
      + 0.000029 * Math.sin(3 * M);
    return c;
  }

  /**
   * Hitung True Longitude Matahari
   */
  function calculateSunTrueLongitude(jd) {
    const L0 = calculateSunMeanLongitude(jd);
    const c = calculateEquationOfCenter(jd);
    return L0 + c;
  }

  /**
   * Hitung Apparent Longitude Matahari
   */
  function calculateSunApparentLongitude(jd) {
    const L = calculateSunTrueLongitude(jd);
    const t = (jd - 2451545.0) / 36525.0;
    const omega = 125.04 - 1934.136 * t;
    return normalizeAngle(L - 20.4898 / 3600.0 - 0.00569 * Math.sin(omega * DEGREES_TO_RADIANS));
  }

  /**
   * Hitung Declination Matahari
   */
  function calculateSunDeclination(jd) {
    const epsilon = 23.439291 - 0.0130042 * (jd - 2451545.0) / 36525.0;
    const lambda = calculateSunApparentLongitude(jd);
    
    const sinDec = Math.sin(epsilon * DEGREES_TO_RADIANS) * Math.sin(lambda * DEGREES_TO_RADIANS);
    return Math.asin(sinDec) * RADIANS_TO_DEGREES;
  }

  /**
   * Hitung Equation of Time
   */
  function calculateEquationOfTime(jd) {
    const t = (jd - 2451545.0) / 36525.0;
    const L0 = calculateSunMeanLongitude(jd);
    const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
    const M = calculateSunMeanAnomaly(jd);
    
    const y = Math.tan((23.439291 - 0.0130042 * t) / 2 * DEGREES_TO_RADIANS);
    y = y * y;

    const eot = 229.2 * (y * Math.sin(2 * L0 * DEGREES_TO_RADIANS)
      - 2 * e * Math.sin(M * DEGREES_TO_RADIANS)
      + 4 * e * y * Math.sin(M * DEGREES_TO_RADIANS) * Math.cos(2 * L0 * DEGREES_TO_RADIANS)
      - 0.5 * y * y * Math.sin(4 * L0 * DEGREES_TO_RADIANS)
      - 1.25 * e * e * Math.sin(2 * M * DEGREES_TO_RADIANS));

    return eot;
  }

  /**
   * Hitung Hour Angle Matahari
   */
  function calculateSunHourAngle(latitude, declination, zenith) {
    const latRad = latitude * DEGREES_TO_RADIANS;
    const decRad = declination * DEGREES_TO_RADIANS;
    const zenithRad = zenith * DEGREES_TO_RADIANS;

    const cosH = (Math.cos(zenithRad) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad));

    if (cosH > 1) {
      return null; // Sun never rises
    }
    if (cosH < -1) {
      return null; // Sun never sets
    }

    return Math.acos(cosH) * RADIANS_TO_DEGREES;
  }

  /**
   * Hitung Azimuth Matahari
   */
  function calculateSunAzimuth(latitude, declination, hourAngle) {
    const latRad = latitude * DEGREES_TO_RADIANS;
    const decRad = declination * DEGREES_TO_RADIANS;
    const haRad = hourAngle * DEGREES_TO_RADIANS;

    const tanAz = Math.sin(haRad) / (Math.cos(haRad) * Math.sin(latRad) + Math.tan(decRad) * Math.cos(latRad));
    let azimuth = Math.atan(tanAz) * RADIANS_TO_DEGREES + 180;

    return normalizeAngle(azimuth);
  }

  /**
   * Hitung Altitude Matahari (Elevation)
   */
  function calculateSunAltitude(latitude, declination, hourAngle) {
    const latRad = latitude * DEGREES_TO_RADIANS;
    const decRad = declination * DEGREES_TO_RADIANS;
    const haRad = hourAngle * DEGREES_TO_RADIANS;

    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    return Math.asin(sinAlt) * RADIANS_TO_DEGREES;
  }

  // ========================================
  // WAKTU SHOLAT CALCULATIONS
  // ========================================

  /**
   * Hitung waktu sunrise
   */
  function calculateSunrise(date, latitude, longitude, timezone) {
    const zenith = 90.833; // Official sunrise/sunset
    const jd = calculateJulianDay(date) - longitude / 360;

    const dec = calculateSunDeclination(jd);
    const eot = calculateEquationOfTime(jd);
    const ha = calculateSunHourAngle(latitude, dec, zenith);

    if (ha === null) {
      return null;
    }

    const sunrise = 12 - ha / 15 - eot / 60 - longitude / 15;
    return degreesToTime(sunrise * 15);
  }

  /**
   * Hitung waktu sunset
   */
  function calculateSunset(date, latitude, longitude, timezone) {
    const zenith = 90.833;
    const jd = calculateJulianDay(date) - longitude / 360;

    const dec = calculateSunDeclination(jd);
    const eot = calculateEquationOfTime(jd);
    const ha = calculateSunHourAngle(latitude, dec, zenith);

    if (ha === null) {
      return null;
    }

    const sunset = 12 + ha / 15 - eot / 60 - longitude / 15;
    return degreesToTime(sunset * 15);
  }

  /**
   * Hitung waktu solar noon (tengah hari)
   */
  function calculateSolarNoon(date, latitude, longitude, timezone) {
    const jd = calculateJulianDay(date) - longitude / 360;
    const eot = calculateEquationOfTime(jd);
    const noon = 12 - eot / 60 - longitude / 15;
    return degreesToTime(noon * 15);
  }

  /**
   * Hitung waktu Subuh (morning twilight)
   * Menggunakan sudut depresi 18 derajat
   */
  function calculateFajr(date, latitude, longitude, timezone, depression = 18) {
    const zenith = 90 + depression;
    const jd = calculateJulianDay(date) - longitude / 360;

    const dec = calculateSunDeclination(jd);
    const eot = calculateEquationOfTime(jd);
    const ha = calculateSunHourAngle(latitude, dec, zenith);

    if (ha === null) {
      return null;
    }

    const fajr = 12 - ha / 15 - eot / 60 - longitude / 15;
    return degreesToTime(fajr * 15);
  }

  /**
   * Hitung waktu Isya (evening twilight)
   * Menggunakan sudut depresi 18 derajat
   */
  function calculateIsya(date, latitude, longitude, timezone, depression = 18) {
    const zenith = 90 + depression;
    const jd = calculateJulianDay(date) - longitude / 360;

    const dec = calculateSunDeclination(jd);
    const eot = calculateEquationOfTime(jd);
    const ha = calculateSunHourAngle(latitude, dec, zenith);

    if (ha === null) {
      return null;
    }

    const isya = 12 + ha / 15 - eot / 60 - longitude / 15;
    return degreesToTime(isya * 15);
  }

  /**
   * Hitung waktu Dhuhur
   * Sama dengan solar noon
   */
  function calculateDhuhur(date, latitude, longitude, timezone) {
    return calculateSolarNoon(date, latitude, longitude, timezone);
  }

  /**
   * Hitung waktu Asr
   * Menggunakan shadow length ratio (biasanya 1 atau 2)
   */
  function calculateAsr(date, latitude, longitude, timezone, shadowRatio = 1) {
    const jd = calculateJulianDay(date);
    
    // Iterasi untuk menemukan waktu Asr
    let time = 12; // Mulai dari tengah hari
    const step = 0.01;
    let bestTime = null;
    let minDiff = Infinity;

    for (let i = 0; i < 12; i += step) {
      const testJd = jd + (i / 24);
      const dec = calculateSunDeclination(testJd);
      const latRad = latitude * DEGREES_TO_RADIANS;
      const decRad = dec * DEGREES_TO_RADIANS;

      const tanH = (Math.tan(latRad) + Math.tan(decRad) * (1 / shadowRatio)) * -1;
      
      if (Math.abs(tanH) <= 1) {
        const h = Math.atan(tanH) * RADIANS_TO_DEGREES;
        
        // Hitung hour angle untuk altitude ini
        const eot = calculateEquationOfTime(testJd);
        const ha = (12 - i - eot / 60 - longitude / 15);
        
        if (Math.abs(h - (-1 * Math.acos(Math.cos(Math.sqrt(1 + tanH * tanH)) * RADIANS_TO_DEGREES))) < minDiff) {
          minDiff = Math.abs(h);
          bestTime = i;
        }
      }
    }

    if (bestTime === null) {
      // Fallback: gunakan metode sederhana
      const jdNoon = jd - longitude / 360;
      const dec = calculateSunDeclination(jdNoon);
      const eot = calculateEquationOfTime(jdNoon);
      const asr = 12 + 2 - eot / 60 - longitude / 15; // +2 jam dari dhuhur
      return degreesToTime(asr * 15);
    }

    return degreesToTime(bestTime * 15);
  }

  /**
   * Hitung semua waktu sholat untuk lokasi dan tanggal tertentu
   */
  function calculateAllPrayerTimes(date, latitude, longitude, timezone = 'UTC', options = {}) {
    const depression = options.depression || 18;
    const asrRatio = options.asrRatio || 1;

    const jd = calculateJulianDay(date);
    const utcOffset = getTimezoneOffset(timezone);

    // Hitung deklinasi dan equation of time untuk hari ini
    const dec = calculateSunDeclination(jd);
    const eot = calculateEquationOfTime(jd);

    const results = {
      date: date.toISOString().slice(0, 10),
      latitude: latitude,
      longitude: longitude,
      timezone: timezone,
      utcOffset: utcOffset,
      times: {},
      celestial: {
        declination: dec.toFixed(4),
        equationOfTime: eot.toFixed(4),
        sunPositionAtNoon: {}
      }
    };

    // Hitung setiap waktu sholat
    results.times.fajr = calculateFajr(date, latitude, longitude, timezone, depression);
    results.times.sunrise = calculateSunrise(date, latitude, longitude, timezone);
    results.times.dhuhur = calculateDhuhur(date, latitude, longitude, timezone);
    results.times.asr = calculateAsr(date, latitude, longitude, timezone, asrRatio);
    results.times.sunset = calculateSunset(date, latitude, longitude, timezone);
    results.times.isya = calculateIsya(date, latitude, longitude, timezone, depression);

    // Hitung posisi matahari di tengah hari
    const noonJd = jd - longitude / 360;
    const noonDec = calculateSunDeclination(noonJd);
    const noonHa = 0; // Hour angle 0 pada solar noon
    results.celestial.sunPositionAtNoon.azimuth = calculateSunAzimuth(latitude, noonDec, noonHa).toFixed(2);
    results.celestial.sunPositionAtNoon.altitude = calculateSunAltitude(latitude, noonDec, noonHa).toFixed(2);

    return results;
  }

  /**
   * Dapatkan UTC offset berdasarkan timezone
   */
  function getTimezoneOffset(timezone) {
    // Simplified timezone mapping
    const timezoneMap = {
      'UTC': 0,
      'Asia/Jakarta': 7,
      'Asia/Bangkok': 7,
      'Asia/Singapore': 8,
      'Asia/Hong_Kong': 8,
      'Asia/Shanghai': 8,
      'Asia/Tokyo': 9,
      'Asia/Dubai': 4,
      'Asia/Karachi': 5,
      'Asia/Kolkata': 5.5,
      'Asia/Istanbul': 3,
      'Europe/London': 0,
      'Europe/Paris': 1,
      'Europe/Cairo': 2,
      'US/Eastern': -5
    };
    return timezoneMap[timezone] || 0;
  }

  /**
   * Format time object ke string HH:MM
   */
  function formatTime(timeObj) {
    if (!timeObj) {
      return '-';
    }
    return String(timeObj.hours).padStart(2, '0') + ':' + String(timeObj.minutes).padStart(2, '0');
  }

  // ========================================
  // PUBLIC API
  // ========================================
  window.SolarTimeCalculator = {
    calculateAllPrayerTimes: calculateAllPrayerTimes,
    calculateSunrise: calculateSunrise,
    calculateSunset: calculateSunset,
    calculateSolarNoon: calculateSolarNoon,
    calculateFajr: calculateFajr,
    calculateIsya: calculateIsya,
    calculateDhuhur: calculateDhuhur,
    calculateAsr: calculateAsr,
    calculateSunDeclination: calculateSunDeclination,
    calculateSunAltitude: calculateSunAltitude,
    calculateSunAzimuth: calculateSunAzimuth,
    formatTime: formatTime,
    getTimezoneOffset: getTimezoneOffset,
    
    /**
     * Dapatkan prayer times dalam format yang lebih user-friendly
     */
    getPrayerTimesFormatted: function(date, latitude, longitude, timezone) {
      const times = this.calculateAllPrayerTimes(date, latitude, longitude, timezone);
      const formatted = {};
      
      Object.keys(times.times).forEach(key => {
        formatted[key] = this.formatTime(times.times[key]);
      });
      
      return {
        date: times.date,
        times: formatted,
        celestial: times.celestial
      };
    }
  };

})(window);
