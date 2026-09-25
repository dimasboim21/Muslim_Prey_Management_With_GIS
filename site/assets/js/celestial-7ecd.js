/**
 * ========================================
 * CELESTIAL BODIES CALCULATOR
 * Perhitungan posisi matahari, bulan, dan fase bulan
 * ======================================== 
 */

(function (window) {
  'use strict';

  const DEGREES_TO_RADIANS = Math.PI / 180;
  const RADIANS_TO_DEGREES = 180 / Math.PI;

  // ========================================
  // BULAN - LUNAR CALCULATIONS
  // ========================================

  /**
   * Hitung fase bulan (0-1)
   * 0 = New Moon, 0.25 = First Quarter, 0.5 = Full Moon, 0.75 = Last Quarter
   */
  function calculateMoonPhase(date) {
    // Reference: New Moon pada 2000-01-06
    const referenceDate = new Date(2000, 0, 6);
    const lunarCycle = 29.53058867; // Hari dalam siklus bulan

    const timeDiff = date.getTime() - referenceDate.getTime();
    const daysDiff = timeDiff / (24 * 60 * 60 * 1000);
    const phase = (daysDiff % lunarCycle) / lunarCycle;

    return phase;
  }

  /**
   * Dapatkan nama fase bulan
   */
  function getMoonPhaseName(phase) {
    phase = phase % 1;
    
    if (phase < 0.0625 || phase >= 0.9375) {
      return { name: 'New Moon', emoji: '🌑', percent: 0 };
    } else if (phase < 0.1875) {
      return { name: 'Waxing Crescent', emoji: '🌒', percent: Math.round(phase * 400) };
    } else if (phase < 0.3125) {
      return { name: 'First Quarter', emoji: '🌓', percent: 50 };
    } else if (phase < 0.4375) {
      return { name: 'Waxing Gibbous', emoji: '🌔', percent: Math.round(phase * 200 + 50) };
    } else if (phase < 0.5625) {
      return { name: 'Full Moon', emoji: '🌕', percent: 100 };
    } else if (phase < 0.6875) {
      return { name: 'Waning Gibbous', emoji: '🌖', percent: Math.round((1 - phase) * 200 + 50) };
    } else if (phase < 0.8125) {
      return { name: 'Last Quarter', emoji: '🌗', percent: 50 };
    } else {
      return { name: 'Waning Crescent', emoji: '🌘', percent: Math.round((1 - phase) * 400) };
    }
  }

  /**
   * Hitung Illumination Bulan (0-1)
   */
  function calculateMoonIllumination(phase) {
    phase = phase % 1;
    // Illumination mengikuti kurva cosine
    return (1 - Math.cos(2 * Math.PI * phase)) / 2;
  }

  /**
   * Hitung Right Ascension Bulan (simplified)
   */
  function calculateMoonRightAscension(date) {
    const days = (date.getTime() - new Date(2000, 0, 1, 12, 0, 0).getTime()) / (24 * 60 * 60 * 1000);
    const moonRA = (124.963 - 1.4025522 * days) % 360;
    return moonRA < 0 ? moonRA + 360 : moonRA;
  }

  /**
   * Hitung Declination Bulan (simplified)
   */
  function calculateMoonDeclination(date) {
    const days = (date.getTime() - new Date(2000, 0, 1, 12, 0, 0).getTime()) / (24 * 60 * 60 * 1000);
    // Declination berkisar antara -28.3° dan +28.3°
    const moonDec = 28.3 * Math.sin((days / 27.32) * 2 * Math.PI);
    return moonDec;
  }

  /**
   * Hitung Azimuth Bulan
   */
  function calculateMoonAzimuth(latitude, rightAscension, declination, hourAngle) {
    const latRad = latitude * DEGREES_TO_RADIANS;
    const decRad = declination * DEGREES_TO_RADIANS;
    const haRad = hourAngle * DEGREES_TO_RADIANS;

    const tanAz = Math.sin(haRad) / (Math.cos(haRad) * Math.sin(latRad) + Math.tan(decRad) * Math.cos(latRad));
    let azimuth = Math.atan(tanAz) * RADIANS_TO_DEGREES + 180;

    return azimuth < 0 ? azimuth + 360 : azimuth;
  }

  /**
   * Hitung Altitude Bulan
   */
  function calculateMoonAltitude(latitude, declination, hourAngle) {
    const latRad = latitude * DEGREES_TO_RADIANS;
    const decRad = declination * DEGREES_TO_RADIANS;
    const haRad = hourAngle * DEGREES_TO_RADIANS;

    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    return Math.asin(sinAlt) * RADIANS_TO_DEGREES;
  }

  /**
   * Hitung semua data bulan untuk lokasi dan waktu tertentu
   */
  function calculateMoonData(date, latitude, longitude, timezone) {
    const phase = calculateMoonPhase(date);
    const illumination = calculateMoonIllumination(phase);
    const phaseName = getMoonPhaseName(phase);

    const ra = calculateMoonRightAscension(date);
    const dec = calculateMoonDeclination(date);

    // Hitung Hour Angle (simplified - menggunakan Greenwich Sidereal Time)
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    const gst = (18.697374558 + 24.06570982441908 * ((date.getTime() - new Date(2000, 0, 1, 12, 0, 0).getTime()) / (24 * 60 * 60 * 1000))) % 24;
    const hourAngle = (gst * 15 + longitude - ra) % 360;

    const azimuth = calculateMoonAzimuth(latitude, ra, dec, hourAngle);
    const altitude = calculateMoonAltitude(latitude, dec, hourAngle);

    return {
      date: date.toISOString(),
      phase: phase.toFixed(4),
      phaseName: phaseName.name,
      phaseEmoji: phaseName.emoji,
      illumination: (illumination * 100).toFixed(1),
      ra: ra.toFixed(2),
      declination: dec.toFixed(2),
      hourAngle: hourAngle.toFixed(2),
      azimuth: azimuth.toFixed(2),
      altitude: altitude.toFixed(2),
      visible: altitude > -18 // Bulan terlihat jika altitude > -18°
    };
  }

  // ========================================
  // VISUALISASI 2D - CELESTIAL SPHERE
  // ========================================

  /**
   * Draw celestial sphere 2D (Azimuth-Altitude)
   */
  function drawCelestialSphere2D(canvas, latitude, sunAltitude, sunAzimuth, moonAltitude, moonAzimuth, options = {}) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 20;

    // Clear canvas
    ctx.fillStyle = '#E8F4F8';
    ctx.fillRect(0, 0, width, height);

    // Draw background circles (horizon, 30°, 60°, 90°)
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 1;

    for (let alt = 0; alt <= 90; alt += 30) {
      const radius = maxRadius * (1 - alt / 90);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();

      // Draw altitude label
      if (alt > 0) {
        ctx.fillStyle = '#999';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(alt + '°', centerX, centerY - radius + 12);
      }
    }

    // Draw cardinal directions (N, E, S, W)
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', centerX, centerY - maxRadius - 15);
    ctx.fillText('S', centerX, centerY + maxRadius + 15);
    ctx.fillText('E', centerX + maxRadius + 15, centerY + 5);
    ctx.fillText('W', centerX - maxRadius - 15, centerY + 5);

    // Horizon line
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw cardinal direction lines
    ctx.strokeStyle = '#DDD';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - maxRadius);
    ctx.lineTo(centerX, centerY + maxRadius);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(centerX - maxRadius, centerY);
    ctx.lineTo(centerX + maxRadius, centerY);
    ctx.stroke();

    // Draw Sun
    if (sunAltitude >= -18) { // Sun atau twilight
      const sunRadius = maxRadius * Math.max(0, (sunAltitude + 18) / 108);
      const sunX = centerX + sunRadius * Math.sin((sunAzimuth - 180) * DEGREES_TO_RADIANS);
      const sunY = centerY - sunRadius * Math.cos((sunAzimuth - 180) * DEGREES_TO_RADIANS);

      ctx.fillStyle = sunAltitude < 0 ? '#FFB81C80' : '#FFB81C';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 6, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#FF8C00';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#333';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('☉', sunX + 8, sunY - 8);
    }

    // Draw Moon
    if (moonAltitude >= -18) {
      const moonRadius = maxRadius * Math.max(0, (moonAltitude + 18) / 108);
      const moonX = centerX + moonRadius * Math.sin((moonAzimuth - 180) * DEGREES_TO_RADIANS);
      const moonY = centerY - moonRadius * Math.cos((moonAzimuth - 180) * DEGREES_TO_RADIANS);

      ctx.fillStyle = moonAltitude < 0 ? '#D3D3D380' : '#D3D3D3';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#333';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('☾', moonX + 8, moonY - 8);
    }

    // Draw horizon label
    ctx.fillStyle = '#666';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Horizon', centerX, centerY + maxRadius + 15);
  }

  /**
   * Animate celestial sphere (untuk real-time updates)
   */
  function animateCelestialSphere(canvas, latitude, longitude, timezone, options = {}) {
    function update() {
      const date = new Date();
      const sunData = window.SolarTimeCalculator ? window.SolarTimeCalculator.calculateAllPrayerTimes(date, latitude, longitude, timezone) : null;
      
      if (sunData && sunData.celestial) {
        const moonData = calculateMoonData(date, latitude, longitude, timezone);
        
        // Hitung hour angle untuk sun at current time
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();
        const fractionalHour = hours + minutes / 60 + seconds / 3600;
        const hourAngleSun = (fractionalHour - 12) * 15 + longitude;

        const sunAltitude = window.SolarTimeCalculator.calculateSunAltitude(
          latitude,
          parseFloat(sunData.celestial.declination),
          hourAngleSun
        );

        const sunAzimuth = window.SolarTimeCalculator.calculateSunAzimuth(
          latitude,
          parseFloat(sunData.celestial.declination),
          hourAngleSun
        );

        drawCelestialSphere2D(
          canvas,
          latitude,
          sunAltitude,
          sunAzimuth,
          parseFloat(moonData.altitude),
          parseFloat(moonData.azimuth),
          options
        );
      }

      if (options.animate !== false) {
        requestAnimationFrame(update);
      }
    }

    update();
  }

  // ========================================
  // PUBLIC API
  // ========================================
  window.CelestialBodies = {
    // Moon calculations
    calculateMoonPhase: calculateMoonPhase,
    calculateMoonIllumination: calculateMoonIllumination,
    getMoonPhaseName: getMoonPhaseName,
    calculateMoonRightAscension: calculateMoonRightAscension,
    calculateMoonDeclination: calculateMoonDeclination,
    calculateMoonAzimuth: calculateMoonAzimuth,
    calculateMoonAltitude: calculateMoonAltitude,
    calculateMoonData: calculateMoonData,

    // Visualization
    drawCelestialSphere2D: drawCelestialSphere2D,
    animateCelestialSphere: animateCelestialSphere,

    /**
     * Get moon phase info dalam format yang lebih sederhana
     */
    getMoonInfo: function(date) {
      const phase = this.calculateMoonPhase(date);
      const phaseName = this.getMoonPhaseName(phase);
      const illumination = this.calculateMoonIllumination(phase);

      return {
        phase: phase.toFixed(3),
        phaseName: phaseName.name,
        phaseEmoji: phaseName.emoji,
        illumination: (illumination * 100).toFixed(1) + '%',
        illuminationRaw: illumination
      };
    }
  };

})(window);
