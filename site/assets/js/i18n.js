(function (window) {
  "use strict";

  var DEFAULT_LANGUAGE = "id";
  var SUPPORTED_LANGUAGES = ["id", "en"];

  var DICTIONARY = {
    id: {
      language: "Bahasa",
      indonesia: "Indonesia",
      english: "English",
      loading: "Memuat...",
      close: "Tutup",
      save: "Simpan",
      cancel: "Batal",
      open: "Buka",
      settings: "Pengaturan",
      defaultLabel: "Default",
      status: "Status",
      search: "Cari",
      filter: "Filter",
      exportJson: "Ekspor JSON",
      documentTitle: "Jadwal Sholat Masjid",
      openConfig: "Konfigurasi",
      currentTime: "Waktu Aktual",
      nextPrayer: "Sholat Berikutnya",
      sourceTime: "Sumber Waktu",
      scheduleTitle: "Jadwal Sholat",
      activeMethod: "Metode Falak aktif",
      methodComparisonTitle: "Perbandingan Metode Waktu",
      deltaAgainstActive: "Selisih dari metode aktif",
      activeLabel: "Aktif",
      additionalMethods: "metode",
      dhuhaTimeLabel: "Waktu Dhuha:",
      synced: "Tersinkron",
      fileOfflineMode: "Mode offline (file)",
      waitingSync: "Menunggu sinkronisasi",
      infoRegion: "Wilayah",
      infoLabel: "Informasi",
      locationSlide: "Lokasi",
      locationEmpty: "Lokasi belum diisi",
      addressEmpty: "Alamat belum diisi",
      country: "Negara",
      province: "Provinsi",
      city: "Kota/Kabupaten",
      mosque: "Masjid",
      committee: "Pengurus",
      reminder: "Pengingat",
      prayerAdvice: "Nasihat Sholat",
      comparison: "Perbandingan",
      timeMethod: "Metode Waktu",
      astronomy: "Astronomi",
      sunPosition: "Posisi Matahari",
      moonPosition: "Posisi Bulan",
      eclipsePrayerTitle: "Sholat Gerhana",
      eclipseReading: "Pembacaan Gerhana",
      worshipAndPrograms: "Ibadah & Kegiatan",
      islamicAgenda: "Agenda Islam",
      mosqueActivity: "Kegiatan Masjid",
      fridayPrayer: "Sholat Jumat",
      fridayOfficers: "Petugas Sholat Jumat",
      offlineManual: "Offline Manual",
      displayConfig: "Konfigurasi Tampilan",
      userId: "ID User",
      userName: "Nama User",
      mosqueName: "Nama Masjid",
      islamicCalendar: "Kalender Islam",
      backgroundImage: "Background Foto",
      committeeStructure: "Susunan Pengurus",
      prayerTimeSources: "Sumber Waktu Sholat",
      prayerCardFrames: "Frame Waktu Sholat",
      communityReminders: "Pengingat Umat",
      sunMoonPosition: "Posisi Matahari & Bulan",
      islamicProgramConfig: "Hari Ibadah & Kegiatan Islam",
      forceDisplayConfig: "Force Display Countdown",
      fullJson: "JSON Lengkap",
      saveConfig: "Simpan Konfigurasi",
      loadSample: "Muat Contoh",
      importJson: "Impor JSON",
      resetLocal: "Reset Lokal",
      configHistory: "Riwayat Konfigurasi User",
      prayerMaghrib: "Maghrib",
      prayerIsha: "Isya",
      prayerSubuh: "Subuh",
      prayerSyuruq: "Syuruq",
      prayerDhuha: "Dhuha",
      prayerDhuhaAwwal: "Dhuha Awwal",
      prayerDhuhaWoosthaa: "Dhuha Wustha",
      prayerDhuhaAwwabin: "Dhuha Awwabin",
      prayerDhuhur: "Dhuhur",
      prayerAshar: "Ashar",
      qiyamulLailLabel: "Qiyamul Lail",
      tahajudWindow: "Sepertiga Malam Terakhir",
      tahajudNeedsTime: "Butuh waktu Maghrib dan Subuh",
      durationPrefix: "Durasi",
      nightTotalPrefix: "dari total malam",
      committeeEmpty: "Data pengurus belum diisi.",
      reminderEmpty: "Pengingat belum diisi.",
      reminderOf: "Pengingat",
      slideNavigation: "Navigasi slide informasi",
      showSlide: "Tampilkan",
      missingName: "Belum diisi",
      khatib: "Khatib",
      imam: "Imam",
      muadzin: "Muadzin",
      khatibAndImam: "Khatib dan Imam",
      overlayAgenda: "Agenda Islam",
      overlayActivity: "Kegiatan Masjid",
      manualMethod: "Metode manual",
      adzanStage: "Menuju Adzan",
      iqomahStage: "Menuju Iqomah",
      prayerStage: "Pelaksanaan Sholat",
      adzanMessage: "Mohon bersiap menuju sholat berjamaah.",
      iqomahMessage: "Adzan telah berkumandang. Iqomah dimulai dalam:",
      prayerMessage: "Sholat berjamaah sedang berlangsung.",
      returnMessage: "Tampilan akan kembali otomatis setelah waktu pelaksanaan selesai.",
      mosqueActivityGroup: "Kegiatan Masjid Bertanggal",
      worshipDayGroup: "Hari Besar & Ibadah Islam",
      emptyData: "Data belum diisi.",
      activityDate: "Tanggal",
      activityTime: "Waktu",
      activitySchedule: "Jadwal",
      personInCharge: "Penanggung jawab",
      gregorianDateLabel: "Tanggal Masehi",
      hijriDateLabel: "Tanggal Hijriah",
      probabilityLabel: "Probabilitas",
      potentialLabel: "Potensial",
      possibilityLabel: "Posibilitas",
      calculatedProbability: "70%",
      calculatedPotential: "Tinggi",
      calculatedPossibility: "Dapat bergeser 1 hari sesuai rukyat atau keputusan resmi.",
      confirmedProbability: "Terkonfirmasi",
      confirmedPotential: "Pasti",
      confirmedPossibility: "Tanggal Masehi sudah diisi.",
      dataSource: "Sumber Data",
      altitude: "Ketinggian",
      azimuth: "Azimuth",
      direction: "Arah",
      sunrise: "Terbit",
      transit: "Kulminasi",
      sunset: "Terbenam",
      phase: "Fase",
      illumination: "Iluminasi",
      moonrise: "Terbit",
      moonset: "Terbenam",
      solarEclipse: "Gerhana Matahari",
      lunarEclipse: "Gerhana Bulan",
      eclipseStatus: "Status",
      eclipseType: "Jenis",
      eclipseDate: "Tanggal",
      eclipseStart: "Mulai",
      eclipsePeak: "Puncak",
      eclipseEnd: "Selesai",
      eclipseVisibility: "Visibilitas",
      eclipsePrayer: "Rekomendasi Sholat",
      adminTitle: "Administrasi Web-GIS",
      adminSubtitle: "Input lokasi, tempat, perangkat, dan audit terstruktur",
      adminBackDashboard: "Dashboard",
      reviewerTitle: "Display Review Astronomi",
      reviewerStatus: "Memuat mesin astronomi",
      reviewerModeDisplay: "Display",
      webgisTitle: "Pengaturan Reviewer Astronomi",
      webgisStatus: "Memuat mesin astronomi",
      customizerTitle: "Background, Informasi & Overlay",
      quranTitle: "Qur'an • Tafsir • Hadith",
      quranSubtitle: "Pembaca lokal, sumber transparan, sinkronisasi bertahap, dan tetap dapat digunakan tanpa koneksi internet.",
      languageSwitchLabel: "Bahasa",
      languageLabel: "Indonesia",
      pageTitle: "Administrasi Web-GIS",
      pageSubtitle: "Input lokasi, tempat, perangkat, dan audit yang terstruktur",
      backDashboard: "Dashboard",
      offlineNotice: "ADM0, ADM1, dan ADM2 diperiksa lebih dahulu dari geoBoundaries online resolusi penuh; GeoJSON penuh lokal dipakai saat offline.",
      recordHeading: "Rekam data tempat",
      recordCopy: "Kolom wajib diperiksa sebelum lokasi dapat disimpan atau diantrikan.",
      identityHeading: "Administrator dan bahasa",
      operatorId: "ID operator",
      operatorIdHelp: "Digunakan sebagai ID aktor audit SQL.",
      displayName: "Nama tampilan",
      role: "Peran",
      roleAdmin: "Admin",
      roleSuperAdmin: "Super Admin",
      languageChoice: "Bahasa tampilan",
      languageAuto: "Otomatis — Bahasa Indonesia hanya bila tempat terkonfirmasi berada di Indonesia",
      languageEnglish: "English (tetap gunakan English)",
      languageIndonesian: "Bahasa Indonesia",
      locationHeading: "Pengambilan lokasi",
      methodGps: "GPS / perangkat",
      methodIp: "Perkiraan IP (online)",
      methodOffline: "Manual / peta offline",
      locateGps: "Gunakan GPS perangkat",
      locateIp: "Gunakan perkiraan IP",
      reverseLookup: "Cari wilayah administratif",
      continent: "Benua",
      country: "Negara",
      adm1: "ADM 1 / Provinsi / State",
      adm2: "ADM 2 / Kota / Kabupaten",
      latitude: "Lintang",
      longitude: "Bujur",
      timezone: "Zona waktu",
      locationSource: "Sumber koordinat",
      accuracy: "Akurasi / catatan",
      adjustmentMethod: "Catatan penyesuaian",
      adjustmentManual: "Koordinat manual / peta",
      adjustmentGpsRaw: "GPS — pembacaan awal belum disesuaikan",
      adjustmentGpsAdjusted: "GPS — disesuaikan setelah peninjauan",
      adjustmentIp: "Lokasi IP — disesuaikan setelah peninjauan",
      confirmLocation: "Saya mengonfirmasi bahwa koordinat yang tampil adalah lokasi bangunan yang dimaksud.",
      placeHeading: "Bangunan dan detail",
      buildingType: "Jenis bangunan",
      selectBuilding: "Pilih jenis",
      buildingTypeHelp: "Marker menggunakan ikon yang sesuai dari map/Places_Icon.",
      buildingName: "Nama bangunan",
      officialAddress: "Alamat resmi",
      additionalInfo: "Informasi tambahan",
      deviceRecord: "Rekam perangkat",
      reset: "Reset draf",
      previewPayload: "Perbarui payload SQL",
      saveRecord: "Verifikasi dan simpan / antrekan",
      savedRecords: "Rekam dasar tersimpan",
      savedRecordsCopy: "Rekam masjid/lokasi relasional yang tersedia dari server saat ini.",
      refresh: "Segarkan",
      reviewSingle: "Tinjau satu bangunan",
      reviewMulti: "Tinjau banyak bangunan",
      reviewModeLabel: "Mode peninjauan",
      reviewModeSingle: "Satu bangunan",
      reviewModeMulti: "Banyak bangunan",
      queueHeading: "Antrean sinkronisasi",
      queueCopy: "Tinjau rekam lokal yang mengantre sebelum dikirim ulang ke API berbasis SQL.",
      retryQueue: "Coba sinkron",
      clearQueue: "Hapus semua",
      queueReview: "Tinjau",
      queueEdit: "Edit",
      queueDelete: "Hapus",
      gisHeading: "Pemeriksaan akhir Web-GIS",
      gisCopy: "Klik peta untuk meletakkan marker bangunan. Kaabah tetap dan garis emas menunjukkan hubungan arah kiblat. Buka peta penuh untuk memeriksa batas negara ADM0.",
      clearMapPoint: "Hapus titik bangunan",
      openFullMap: "Buka peta penuh",
      fullMapTitle: "Peta ADM0 fullsize",
      closeFullMap: "Tutup",
      adm0Layer: "ADM0",
      adm1Layer: "ADM1",
      adm2Layer: "ADM2",
      fullMapFit: "Paskan",
      fullMapLoadingAdm0: "Memuat batas ADM0...",
      fullMapAdm0Ready: "ADM0 siap",
      fullMapAdm0Failed: "Gagal memuat ADM0",
      fullMapLoadingAdm1: "Memuat batas ADM1...",
      fullMapAdm1Ready: "ADM1 siap",
      fullMapAdm1Failed: "Gagal memuat ADM1",
      fullMapLoadingAdm2: "Memuat batas ADM2...",
      fullMapAdm2Ready: "ADM2 siap",
      fullMapAdm2Failed: "Gagal memuat ADM2",
      fullMapSelectCountry: "Pilih negara",
      toggleKmlViewer: "Tampilkan/toggle KML Viewer",
      kmlLoad: "Muat KML",
      kmlClear: "Hapus",
      kmlFit: "Paskan tampilan",
      kmlTotalFeatures: "Total Fitur",
      kmlContinents: "Benua",
      kmlCountries: "Negara",
      kmlLoading: "Memuat fitur KML...",
      kmlLoadFailed: "Gagal memuat",
      kmlAutoLoadFailed: "Pemuatan otomatis KML gagal",
      goldLineLegend: "Garis kiblat emas terang",
      qiblaBearing: "Arah kiblat",
      rangeKaabah: "Jarak ke Kaabah",
      buildingTime: "Waktu lokal bangunan",
      makkahTime: "Waktu lokal Makkah",
      compassHeading: "Layer kompas 16 arah",
      compassCopy: "Kompas hanya menampilkan singkatan. Arahkan kursor atau fokuskan huruf untuk melihat kepanjangannya pada layer khusus ini.",
      tabBuilding: "Bangunan",
      tabKaabah: "Kaabah",
      tabTime: "Waktu",
      auditHeading: "Jejak audit dan revisi",
      auditCopy: "Revisi konfigurasi server ditulis melalui api/config.php yang mencatat audit trail; tindakan lokal tetap terlihat hingga tersinkron.",
      refreshAudit: "Segarkan audit",
      auditWhen: "Waktu",
      auditSource: "Sumber",
      auditAction: "Tindakan",
      auditDetail: "Detail",
      superAdminAuditNote: "Tampilan Super Admin: revisi payload dihubungkan ke aktor dan client request ID. Query langsung audit_trail harus tetap berada di balik endpoint server terautentikasi.",
      sqlHeading: "Payload siap SQL",
      sqlCopy: "Versi terstruktur dikirim ke riwayat konfigurasi; rekam relasional dasar dikirim ke endpoint administrasi masjid saat online.",
      copyPayload: "Salin JSON",
      downloadPayload: "Unduh JSON",
      sqlTable: "Tabel / revisi",
      sqlFields: "Kolom yang disiapkan",
      sqlNote: "Halaman tidak pernah menjalankan SQL mentah di browser. Validasi, API berparameter, ID revisi, dan outbox offline mencegah penulisan langsung yang belum diverifikasi."
    },
    en: {
      language: "Language",
      indonesia: "Indonesia",
      english: "English",
      loading: "Loading...",
      close: "Close",
      save: "Save",
      cancel: "Cancel",
      open: "Open",
      settings: "Settings",
      defaultLabel: "Default",
      status: "Status",
      search: "Search",
      filter: "Filter",
      exportJson: "Export JSON",
      documentTitle: "Mosque Prayer Schedule",
      openConfig: "Settings",
      currentTime: "Current Time",
      nextPrayer: "Next Prayer",
      sourceTime: "Time Source",
      scheduleTitle: "Prayer Schedule",
      activeMethod: "Active Falak method",
      methodComparisonTitle: "Time Method Comparison",
      deltaAgainstActive: "Difference from active method",
      activeLabel: "Active",
      additionalMethods: "methods",
      dhuhaTimeLabel: "Duha time:",
      synced: "Synced",
      fileOfflineMode: "Offline mode (file)",
      waitingSync: "Waiting for sync",
      infoRegion: "Region",
      infoLabel: "Information",
      locationSlide: "Location",
      locationEmpty: "Location has not been entered",
      addressEmpty: "Address has not been entered",
      country: "Country",
      province: "Province",
      city: "City/Regency",
      mosque: "Mosque",
      committee: "Committee",
      reminder: "Reminder",
      prayerAdvice: "Prayer Advice",
      comparison: "Comparison",
      timeMethod: "Time Method",
      astronomy: "Astronomy",
      sunPosition: "Sun Position",
      moonPosition: "Moon Position",
      eclipsePrayerTitle: "Eclipse Prayer",
      eclipseReading: "Eclipse Reading",
      worshipAndPrograms: "Worship & Programs",
      islamicAgenda: "Islamic Agenda",
      mosqueActivity: "Mosque Activities",
      fridayPrayer: "Friday Prayer",
      fridayOfficers: "Friday Prayer Officers",
      offlineManual: "Offline Manual",
      displayConfig: "Display Settings",
      userId: "User ID",
      userName: "User Name",
      mosqueName: "Mosque Name",
      islamicCalendar: "Islamic Calendar",
      backgroundImage: "Background Photo",
      committeeStructure: "Committee Structure",
      prayerTimeSources: "Prayer Time Sources",
      prayerCardFrames: "Prayer Time Cards",
      communityReminders: "Community Reminders",
      sunMoonPosition: "Sun & Moon Position",
      islamicProgramConfig: "Islamic Days & Mosque Activities",
      forceDisplayConfig: "Force Display Countdown",
      fullJson: "Full JSON",
      saveConfig: "Save Settings",
      loadSample: "Load Sample",
      importJson: "Import JSON",
      resetLocal: "Reset Local",
      configHistory: "User Configuration History",
      prayerMaghrib: "Maghrib",
      prayerIsha: "Isha",
      prayerSubuh: "Fajr",
      prayerSyuruq: "Sunrise",
      prayerDhuha: "Duha",
      prayerDhuhaAwwal: "Duha Awal",
      prayerDhuhaWoosthaa: "Duha Wustha",
      prayerDhuhaAwwabin: "Duha Akhir",
      prayerDhuhur: "Dhuhr",
      prayerAshar: "Asr",
      qiyamulLailLabel: "Qiyamul Lail",
      tahajudWindow: "Last Third of the Night",
      tahajudNeedsTime: "Maghrib and Fajr times are required",
      durationPrefix: "Duration",
      nightTotalPrefix: "of the total night",
      committeeEmpty: "Committee data has not been entered.",
      reminderEmpty: "No reminders have been entered.",
      reminderOf: "Reminder",
      slideNavigation: "Information slide navigation",
      showSlide: "Show",
      missingName: "Not entered yet",
      khatib: "Khatib",
      imam: "Imam",
      muadzin: "Muadzin",
      khatibAndImam: "Khatib and Imam",
      overlayAgenda: "Islamic Agenda",
      overlayActivity: "Mosque Activities",
      manualMethod: "Manual method",
      adzanStage: "Adhan Countdown",
      iqomahStage: "Iqamah Countdown",
      prayerStage: "Congregational Prayer",
      adzanMessage: "Please prepare for congregational prayer.",
      iqomahMessage: "The adhan has been called. Iqamah starts in:",
      prayerMessage: "Congregational prayer is in progress.",
      returnMessage: "The display will return automatically after the prayer session ends.",
      mosqueActivityGroup: "Dated Mosque Activities",
      worshipDayGroup: "Islamic Holy Days & Worship",
      emptyData: "No data has been entered.",
      activityDate: "Date",
      activityTime: "Time",
      activitySchedule: "Schedule",
      personInCharge: "Person in charge",
      gregorianDateLabel: "Gregorian Date",
      hijriDateLabel: "Hijri Date",
      probabilityLabel: "Probability",
      potentialLabel: "Potential",
      possibilityLabel: "Possibility",
      calculatedProbability: "70%",
      calculatedPotential: "High",
      calculatedPossibility: "May shift by 1 day depending on moon sighting or official decision.",
      confirmedProbability: "Confirmed",
      confirmedPotential: "Fixed",
      confirmedPossibility: "Gregorian date has been entered.",
      dataSource: "Data Source",
      altitude: "Altitude",
      azimuth: "Azimuth",
      direction: "Direction",
      sunrise: "Sunrise",
      transit: "Transit",
      sunset: "Sunset",
      phase: "Phase",
      illumination: "Illumination",
      moonrise: "Moonrise",
      moonset: "Moonset",
      solarEclipse: "Solar Eclipse",
      lunarEclipse: "Lunar Eclipse",
      eclipseStatus: "Status",
      eclipseType: "Type",
      eclipseDate: "Date",
      eclipseStart: "Start",
      eclipsePeak: "Peak",
      eclipseEnd: "End",
      eclipseVisibility: "Visibility",
      eclipsePrayer: "Prayer Recommendation",
      adminTitle: "Web-GIS Administration",
      adminSubtitle: "Structured location, place, device, and audit input",
      adminBackDashboard: "Dashboard",
      reviewerTitle: "Astronomical Reviewer Display",
      reviewerStatus: "Loading astronomy engine",
      reviewerModeDisplay: "Display",
      webgisTitle: "Astronomical Reviewer Settings",
      webgisStatus: "Loading astronomy engine",
      customizerTitle: "Background, Information & Overlay",
      quranTitle: "Qur'an • Tafsir • Hadith",
      quranSubtitle: "Local reader, transparent sources, gradual sync, and still usable without internet connection.",
      languageSwitchLabel: "Language",
      languageLabel: "English",
      pageTitle: "Web-GIS Administration",
      pageSubtitle: "Structured location, place, device, and audit input",
      backDashboard: "Dashboard",
      offlineNotice: "ADM0, ADM1, and ADM2 are checked from full-resolution geoBoundaries online first; full local GeoJSON is used when offline.",
      recordHeading: "Place record",
      recordCopy: "Required fields are checked before the location can be saved or queued.",
      identityHeading: "Administrator and language",
      operatorId: "Operator ID",
      operatorIdHelp: "Used as the SQL audit actor ID.",
      displayName: "Display name",
      role: "Role",
      roleAdmin: "Admin",
      roleSuperAdmin: "Super Admin",
      languageChoice: "Display language",
      languageAuto: "Automatic — Indonesian only when the confirmed place is in Indonesia",
      languageEnglish: "English (keep English)",
      languageIndonesian: "Bahasa Indonesia",
      locationHeading: "Location acquisition",
      methodGps: "GPS / device",
      methodIp: "IP estimate (online)",
      methodOffline: "Offline manual / map",
      locateGps: "Use device GPS",
      locateIp: "Use IP estimate",
      reverseLookup: "Lookup administrative area",
      continent: "Continent",
      country: "Country",
      adm1: "ADM 1 / Province / State",
      adm2: "ADM 2 / City / Regency",
      latitude: "Latitude",
      longitude: "Longitude",
      timezone: "Time zone",
      locationSource: "Coordinate source",
      accuracy: "Accuracy / note",
      adjustmentMethod: "Adjustment record",
      adjustmentManual: "Manual / map coordinate",
      adjustmentGpsRaw: "GPS — unadjusted first reading",
      adjustmentGpsAdjusted: "GPS — adjusted after review",
      adjustmentIp: "IP location — adjusted after review",
      confirmLocation: "I confirm that the displayed coordinate is the intended building location.",
      placeHeading: "Building and detail",
      buildingType: "Building type",
      selectBuilding: "Select a type",
      buildingTypeHelp: "The marker uses the matching icon from map/Places_Icon.",
      buildingName: "Building name",
      officialAddress: "Official address",
      additionalInfo: "Additional information",
      deviceRecord: "Device record",
      reset: "Reset draft",
      previewPayload: "Refresh SQL payload",
      saveRecord: "Verify and save / queue",
      savedRecords: "Saved base records",
      savedRecordsCopy: "The relational mosque/location records available from the current server.",
      refresh: "Refresh",
      reviewSingle: "Review single building",
      reviewMulti: "Review multiple buildings",
      reviewModeLabel: "Review mode",
      reviewModeSingle: "Single building",
      reviewModeMulti: "Multiple buildings",
      queueHeading: "Sync queue",
      queueCopy: "Review local queued records before they are replayed to the SQL-backed API.",
      retryQueue: "Retry sync",
      clearQueue: "Delete all",
      queueReview: "Review",
      queueEdit: "Edit",
      queueDelete: "Delete",
      gisHeading: "Web-GIS final check",
      gisCopy: "Click the map to put the building marker. The Kaabah is fixed and the gold line is the qibla relationship. Open the full map to inspect ADM0 country boundaries.",
      clearMapPoint: "Clear building point",
      openFullMap: "Open full map",
      fullMapTitle: "Fullsize ADM0 map",
      closeFullMap: "Close",
      adm0Layer: "ADM0",
      adm1Layer: "ADM1",
      adm2Layer: "ADM2",
      fullMapFit: "Fit",
      fullMapLoadingAdm0: "Loading ADM0 boundaries...",
      fullMapAdm0Ready: "ADM0 ready",
      fullMapAdm0Failed: "ADM0 load failed",
      fullMapLoadingAdm1: "Loading ADM1 boundaries...",
      fullMapAdm1Ready: "ADM1 ready",
      fullMapAdm1Failed: "ADM1 load failed",
      fullMapLoadingAdm2: "Loading ADM2 boundaries...",
      fullMapAdm2Ready: "ADM2 ready",
      fullMapAdm2Failed: "ADM2 load failed",
      fullMapSelectCountry: "Select a country",
      toggleKmlViewer: "Toggle KML Viewer",
      kmlLoad: "Load KML",
      kmlClear: "Clear",
      kmlFit: "Fit View",
      kmlTotalFeatures: "Total Features",
      kmlContinents: "Continents",
      kmlCountries: "Countries",
      kmlLoading: "Loading KML features...",
      kmlLoadFailed: "Load failed",
      kmlAutoLoadFailed: "KML auto-load failed",
      goldLineLegend: "Bright-gold qibla line",
      qiblaBearing: "Qibla bearing",
      rangeKaabah: "Range to Kaabah",
      buildingTime: "Building local time",
      makkahTime: "Makkah local time",
      compassHeading: "16-direction compass layer",
      compassCopy: "Only abbreviations are shown on the compass. Hover or focus a letter to reveal its full name in this dedicated layer.",
      tabBuilding: "Building",
      tabKaabah: "Kaabah",
      tabTime: "Time",
      auditHeading: "Audit and revision trail",
      auditCopy: "Server configuration revisions are written through api/config.php, which records an audit trail; local actions remain visible until they sync.",
      refreshAudit: "Refresh audit",
      auditWhen: "When",
      auditSource: "Source",
      auditAction: "Action",
      auditDetail: "Detail",
      superAdminAuditNote: "Super Admin view: payload revisions are linked to the current actor and client request ID. Direct audit_trail querying should stay behind an authenticated server endpoint.",
      sqlHeading: "SQL-ready payload",
      sqlCopy: "A structured version is sent to the configuration history; the base relational record is sent to the mosque administration endpoint when online.",
      copyPayload: "Copy JSON",
      downloadPayload: "Download JSON",
      sqlTable: "Table / revision",
      sqlFields: "Prepared fields",
      sqlNote: "The page never executes raw SQL in the browser. Validation, parameterized APIs, revision IDs, and the offline outbox prevent unverified direct writes."
    }
  };

  var TEXT_ALIASES = {
    id: {
      "Memuat mesin astronomi": "reviewerStatus",
      "Mode: Online/Offline": "reviewerMode",
      "Display": "reviewerModeDisplay",
      "Settings": "webgisTitle",
      "Web-GIS Administration": "adminTitle",
      "Dashboard": "adminBackDashboard",
      "Qur'an • Tafsir • Hadith": "quranTitle",
      "Background, Informasi & Overlay": "customizerTitle",
      "Buka": "open",
      "Tutup": "close",
      "Bahasa": "language",
      "Indonesia": "indonesia",
      "English": "english"
    },
    en: {
      "Loading astronomy engine": "reviewerStatus",
      "Mode: Online/Offline": "reviewerMode",
      "Display": "reviewerModeDisplay",
      "Astronomical Reviewer Settings": "webgisTitle",
      "Web-GIS Administration": "adminTitle",
      "Dashboard": "adminBackDashboard",
      "Qur'an • Tafsir • Hadith": "quranTitle",
      "Background, Information & Overlay": "customizerTitle",
      "Open": "open",
      "Close": "close",
      "Language": "language",
      "Indonesia": "indonesia",
      "English": "english"
    }
  };

  var runtimeDictionary = {};
  var runtimeLanguage = "";
  var runtimePayload = null;
  var runtimeLoaded = false;
  var runtimeLoading = null;

  function mergeDictionary(dictionary) {
    Object.keys(dictionary || {}).forEach(function (language) {
      DICTIONARY[language] = DICTIONARY[language] || {};
      Object.keys(dictionary[language] || {}).forEach(function (key) {
        DICTIONARY[language][key] = dictionary[language][key];
      });
    });
  }

  function normalizeLanguage(language) {
    var normalized = String(language || "").trim().toLowerCase().replace(/_/g, '-').split('-')[0];
    return SUPPORTED_LANGUAGES.indexOf(normalized) !== -1 ? normalized : DEFAULT_LANGUAGE;
  }

  function queryLanguage() {
    try {
      var language = new URLSearchParams(window.location.search).get("lang");
      return language === null ? "" : normalizeLanguage(language);
    } catch (error) {
      return "";
    }
  }

  function getStoredLanguage() {
    try {
      var language = window.localStorage && window.localStorage.getItem("mpm-language");
      return SUPPORTED_LANGUAGES.indexOf(String(language || "").trim().toLowerCase()) !== -1
        ? String(language).trim().toLowerCase()
        : "";
    } catch (error) {
      return "";
    }
  }

  function isIndonesiaCoordinate(location) {
    if (!location) {
      return false;
    }

    var latitude = Number(location.latitude || location.lat);
    var longitude = Number(location.longitude || location.lon || location.lng);

    return Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -11.2 &&
      latitude <= 6.3 &&
      longitude >= 94.7 &&
      longitude <= 141.1;
  }

  function getLanguage(config) {
    var manual = config && config.language;
    var urlLanguage = queryLanguage();

    if (SUPPORTED_LANGUAGES.indexOf(String(urlLanguage || "").trim().toLowerCase()) !== -1) {
      return String(urlLanguage).trim().toLowerCase();
    }
    if (SUPPORTED_LANGUAGES.indexOf(String(manual || "").trim().toLowerCase()) !== -1) {
      return String(manual).trim().toLowerCase();
    }
    if (SUPPORTED_LANGUAGES.indexOf(String(getStoredLanguage() || "").trim().toLowerCase()) !== -1) {
      return String(getStoredLanguage()).trim().toLowerCase();
    }
    if (isIndonesiaCoordinate(config && config.location)) {
      return "id";
    }
    if (SUPPORTED_LANGUAGES.indexOf(String(runtimeLanguage || "").trim().toLowerCase()) !== -1) {
      return String(runtimeLanguage).trim().toLowerCase();
    }

    return DEFAULT_LANGUAGE;
  }

  function translateText(language, key) {
    var targetLanguage = normalizeLanguage(language);
    if (DICTIONARY[targetLanguage] && DICTIONARY[targetLanguage][key]) {
      return DICTIONARY[targetLanguage][key];
    }
    if (DICTIONARY[DEFAULT_LANGUAGE] && DICTIONARY[DEFAULT_LANGUAGE][key]) {
      return DICTIONARY[DEFAULT_LANGUAGE][key];
    }
    return key;
  }

  function getCurrentLanguage() {
    return getLanguage({ language: getStoredLanguage() });
  }

  function updateHtmlLang(language) {
    try {
      if (document && document.documentElement) {
        var normalized = normalizeLanguage(language);
        if (document.documentElement.lang !== normalized) document.documentElement.lang = normalized;
      }
    } catch (error) {
      // no-op
    }
  }

  function setLanguage(language) {
    var normalized = normalizeLanguage(language);
    var query = new URLSearchParams(window.location.search || "");
    query.set("lang", normalized);
    var fullPath = window.location.pathname || "/";
    var nextUrl = fullPath + (query.toString() ? "?" + query.toString() : "") + (window.location.hash || "");

    try {
      window.history.replaceState(window.history.state, "", nextUrl);
    } catch (error) {
      window.location.search = query.toString() ? "?" + query.toString() : "";
    }

    try {
      window.localStorage.setItem("mpm-language", normalized);
    } catch (error) {
      // no-op
    }

    updateHtmlLang(normalized);
    applyTranslations(document);
    bindLanguageSwitcher();
    preserveNavigationLanguage(document);
    window.dispatchEvent(new CustomEvent('mpm:language-changed', {detail:{language:normalized}}));
    return normalized;
  }

  function applyTranslations(root) {
    var currentLanguage = getLanguage({ language: getStoredLanguage() });
    updateHtmlLang(currentLanguage);

    if (!root) {
      return currentLanguage;
    }

    var nodes = root.querySelectorAll("[data-i18n]");
    nodes.forEach(function (element) {
      var key = element.getAttribute("data-i18n");
      if (!key) {
        return;
      }
      var value = translateText(currentLanguage, key);
      if (value && value !== key) {
        if (element.textContent !== value) element.textContent = value;
      }
    });

    var placeholderNodes = root.querySelectorAll("[data-i18n-placeholder]");
    placeholderNodes.forEach(function (element) {
      var key = element.getAttribute("data-i18n-placeholder");
      var value = translateText(currentLanguage, key);
      if (value && value !== key) {
        if (element.getAttribute('placeholder') !== value) element.setAttribute("placeholder", value);
      }
    });

    var titleNodes = root.querySelectorAll("[data-i18n-title]");
    titleNodes.forEach(function (element) {
      var key = element.getAttribute("data-i18n-title");
      var value = translateText(currentLanguage, key);
      if (value && value !== key) {
        if (element.getAttribute('title') !== value) element.setAttribute("title", value);
      }
    });

    var ariaNodes = root.querySelectorAll("[data-i18n-aria-label]");
    ariaNodes.forEach(function (element) {
      var key = element.getAttribute("data-i18n-aria-label");
      var value = translateText(currentLanguage, key);
      if (value && value !== key) {
        if (element.getAttribute('aria-label') !== value) element.setAttribute("aria-label", value);
      }
    });

    // Unmarked content can contain canonical religious text or user data.
    // Only explicitly keyed UI nodes may be translated; never replace containers.
    preserveNavigationLanguage(root);
    return currentLanguage;
  }

  function preserveNavigationLanguage(root) {
    root.querySelectorAll('a[href]').forEach(function (anchor) {
      var raw = anchor.getAttribute('href');
      if (!raw || raw[0] === '#' || anchor.hasAttribute('download')) return;
      try {
        var url = new URL(raw, window.location.href);
        if (url.origin !== window.location.origin || !/\.html$/i.test(url.pathname)) return;
        url.searchParams.set('lang', getCurrentLanguage());
        if (anchor.href !== url.href) anchor.href = url.href;
      } catch (error) { /* Preserve non-URL links. */ }
    });
  }

  function bindLanguageSwitcher() {
    var existingSelector = document.querySelector("[data-language-switcher]");
    if (!existingSelector) {
      var style = document.createElement("style");
      style.textContent = '.mpm-language-switcher{display:inline-flex;align-items:center;gap:6px;font:inherit;margin:0}.mpm-language-switcher select{font:inherit;max-width:155px;padding:5px 8px;border:1px solid #b9c9ce;border-radius:6px;background:var(--surface,#fff);color:#203139}[data-language-slot]{display:flex;align-items:center;flex:0 0 auto}';
      document.head.appendChild(style);

      var wrapper = document.createElement("label");
      wrapper.className = "mpm-language-switcher";
      wrapper.innerHTML = '<span data-i18n="language">' + translateText(getCurrentLanguage(), "language") + '</span><select data-language-switcher data-i18n-aria-label="language" aria-label="Language"><option value="id">Bahasa Indonesia</option><option value="en">English</option></select>';
      var host = document.querySelector("[data-language-slot]") || document.querySelector("header") || document.body;
      host.appendChild(wrapper);
      existingSelector = wrapper.querySelector("[data-language-switcher]");
    }

    var currentLanguage = getLanguage({ language: getStoredLanguage() });
    if (existingSelector) {
      existingSelector.value = currentLanguage;
      existingSelector.onchange = function () {
        setLanguage(existingSelector.value);
      };
    }
  }

  function t(config, key) {
    if (typeof config === 'string' && key === undefined) { key = config; config = {}; }
    var language = getLanguage(config || {});
    return translateText(language, key);
  }

  window.PrayerI18n = {
    dictionary: DICTIONARY,
    load: function () {
      if (runtimeLoaded) {
        return Promise.resolve(runtimeDictionary);
      }
      if (runtimeLoading) {
        return runtimeLoading;
      }
      if (!window.PrayerApiClient) {
        runtimeLoaded = true;
        return Promise.resolve(runtimeDictionary);
      }

      runtimeLoading = window.PrayerApiClient.request("runtime.php" + (window.location.search || ""))
        .then(function (runtime) {
          runtimePayload = runtime || null;
          var translation = runtime && runtime.translation ? runtime.translation : {};
          runtimeDictionary = translation.dictionary || {};
          runtimeLanguage = translation.activeLanguage || translation.defaultLanguage || "";
          mergeDictionary(runtimeDictionary);
          runtimeLoaded = true;
          return runtimeDictionary;
        })
        .catch(function () {
          runtimeLoaded = true;
          return runtimeDictionary;
        });

      return runtimeLoading;
    },
    mergeDictionary: mergeDictionary,
    runtime: function () {
      return runtimePayload;
    },
    getLanguage: getLanguage,
    getCurrentLanguage: getCurrentLanguage,
    setLanguage: setLanguage,
    applyTranslations: applyTranslations,
    bindLanguageSwitcher: bindLanguageSwitcher,
    t: t,
    normalizeLanguage: normalizeLanguage,
    queryLanguage: queryLanguage,
    getStoredLanguage: getStoredLanguage,
    updateHtmlLang: updateHtmlLang
  };

  document.addEventListener("DOMContentLoaded", function () {
    updateHtmlLang(getLanguage({ language: getStoredLanguage() }));
    bindLanguageSwitcher();
    applyTranslations(document);
    document.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('a[href]')) preserveNavigationLanguage(document);
    }, true);
  });
})(window);
