(function (window, document) {
  "use strict";

  var STORAGE_PREFIX = "mpm:facility-management:v1:";
  var ENERGY_PANEL_STORAGE_KEY = STORAGE_PREFIX + "ui:energy-panels";
  var ENERGY_PANEL_DEFAULTS = {
    fuel: true,
    electricity: false,
    telecom: false,
    water: false,
    database: false
  };
  var ENERGY_PANEL_LABELS = {
    fuel: "BBM & minyak",
    electricity: "Listrik",
    telecom: "Telekomunikasi",
    water: "Air",
    database: "Database & discovery"
  };
  var SYSTEM_NAME = "Flexibel Building And Asset Management For Monitoring System";
  var CATALOG_ENDPOINTS = [
    "api/facility-catalog.php",
    "data/facilit-e453.json"
  ];
  var BRAND_LOOKUP_ENDPOINT = "api/facility-brand-lookup.php";
  var ENERGY_PRICE_ENDPOINT = "api/facility-energy-prices.php";
  var GLOBAL_UTILITY_ENDPOINT = "api/global-utility-prices.php";
  var US_ELECTRICITY_GENERATION_ENDPOINT = "api/us-electricity-generation.php";
  var US_FUEL_PROVIDER_CATALOG_ENDPOINT = "api/us-fuel-provider-catalog.php";
  var US_WATER_PROVIDER_CATALOG_ENDPOINT = "api/us-water-provider-catalog.php";
  var US_WATER_TARIFF_HIERARCHY_ENDPOINT = "api/us-water-tariff-hierarchy.php";
  var US_MOBILE_OPERATOR_CATALOG_ENDPOINT = "api/us-mobile-operator-catalog.php";
  var GLOBAL_UTILITY_ENERGY_CATEGORIES = ["fuel", "electricity", "internet", "mobile", "water"];
  var ADM_BOUNDARY_OPTIONS_ENDPOINT = "api/adm-boundary-options.php";
  var WEBGIS_BUILDINGS_ENDPOINT = "api/mosque-admin.php";
  var DEFAULT_TARIFF = 1444.7;
  var DEFAULT_MINIMUM_KWH = 20;
  var SERVICE_TARGET_BUILDING = "building";
  var LEGACY_ASSET_CODE_FORMAT = "{MASJID}-{GEDUNG}-{JENIS}-{TAHUN}-{URUT3}";
  var DEFAULT_ASSET_CODE_FORMAT = "{SITE}-{BUILDING}-{JENIS}-{TAHUN}-{URUT3}";
  var LEGACY_DEFAULT_BUILDING_SLUG = "building-utama";
  var admBoundaryOptionCache = {};
  var admProvinceLoadGeneration = 0;
  var admCityLoadGeneration = 0;
  var BUILDING_TYPE_LABELS = {
    office: "Kantor",
    factory: "Pabrik",
    warehouse: "Gudang",
    retail: "Ruko / retail",
    education: "Sekolah / kampus",
    healthcare: "Fasilitas kesehatan",
    worship: "Tempat ibadah",
    public_facility: "Fasilitas umum",
    residential: "Hunian / asrama",
    other: "Lainnya"
  };
  var PRICE_COUNTRY_CODES = ("AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI KH CM CA CV KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW XK").split(" ");
  var PRICE_COUNTRY_CURRENCY_PAIRS = "AF:AFN AX:EUR AL:ALL DZ:DZD AS:USD AD:EUR AO:AOA AI:XCD AQ:USD AG:XCD AR:ARS AM:AMD AW:AWG AU:AUD AT:EUR AZ:AZN BS:BSD BH:BHD BD:BDT BB:BBD BY:BYN BE:EUR BZ:BZD BJ:XOF BM:BMD BT:BTN BO:BOB BQ:USD BA:BAM BW:BWP BV:NOK BR:BRL IO:USD BN:BND BG:BGN BF:XOF BI:BIF KH:KHR CM:XAF CA:CAD CV:CVE KY:KYD CF:XAF TD:XAF CL:CLP CN:CNY CX:AUD CC:AUD CO:COP KM:KMF CG:XAF CD:CDF CK:NZD CR:CRC CI:XOF HR:EUR CU:CUP CW:ANG CY:EUR CZ:CZK DK:DKK DJ:DJF DM:XCD DO:DOP EC:USD EG:EGP SV:USD GQ:XAF ER:ERN EE:EUR SZ:SZL ET:ETB FK:FKP FO:DKK FJ:FJD FI:EUR FR:EUR GF:EUR PF:XPF TF:EUR GA:XAF GM:GMD GE:GEL DE:EUR GH:GHS GI:GIP GR:EUR GL:DKK GD:XCD GP:EUR GU:USD GT:GTQ GG:GBP GN:GNF GW:XOF GY:GYD HT:HTG HM:AUD VA:EUR HN:HNL HK:HKD HU:HUF IS:ISK IN:INR ID:IDR IR:IRR IQ:IQD IE:EUR IM:GBP IL:ILS IT:EUR JM:JMD JP:JPY JE:GBP JO:JOD KZ:KZT KE:KES KI:AUD KP:KPW KR:KRW KW:KWD KG:KGS LA:LAK LV:EUR LB:LBP LS:LSL LR:LRD LY:LYD LI:CHF LT:EUR LU:EUR MO:MOP MG:MGA MW:MWK MY:MYR MV:MVR ML:XOF MT:EUR MH:USD MQ:EUR MR:MRU MU:MUR YT:EUR MX:MXN FM:USD MD:MDL MC:EUR MN:MNT ME:EUR MS:XCD MA:MAD MZ:MZN MM:MMK NA:NAD NR:AUD NP:NPR NL:EUR NC:XPF NZ:NZD NI:NIO NE:XOF NG:NGN NU:NZD NF:AUD MK:MKD MP:USD NO:NOK OM:OMR PK:PKR PW:USD PS:ILS PA:PAB PG:PGK PY:PYG PE:PEN PH:PHP PN:NZD PL:PLN PT:EUR PR:USD QA:QAR RE:EUR RO:RON RU:RUB RW:RWF BL:EUR SH:SHP KN:XCD LC:XCD MF:EUR PM:EUR VC:XCD WS:WST SM:EUR ST:STN SA:SAR SN:XOF RS:RSD SC:SCR SL:SLE SG:SGD SX:ANG SK:EUR SI:EUR SB:SBD SO:SOS ZA:ZAR GS:GBP SS:SSP ES:EUR LK:LKR SD:SDG SR:SRD SJ:NOK SE:SEK CH:CHF SY:SYP TW:TWD TJ:TJS TZ:TZS TH:THB TL:USD TG:XOF TK:NZD TO:TOP TT:TTD TN:TND TR:TRY TM:TMT TC:USD TV:AUD UG:UGX UA:UAH AE:AED GB:GBP US:USD UM:USD UY:UYU UZ:UZS VU:VUV VE:VES VN:VND VG:USD VI:USD WF:XPF EH:MAD YE:YER ZM:ZMW ZW:ZWL XK:EUR";
  var PRICE_COUNTRY_CURRENCY_MAP = PRICE_COUNTRY_CURRENCY_PAIRS.split(" ").reduce(function (map, pair) {
    var parts = pair.split(":");
    if (parts.length === 2) {
      map[parts[0]] = parts[1];
    }
    return map;
  }, {});
  var PRICE_COUNTRY_ALIASES = {
    "afghanistan": "AF",
    "afganistan": "AF",
    "indonesia": "ID",
    "republik-indonesia": "ID",
    "united-states": "US",
    "united-states-of-america": "US",
    "usa": "US",
    "america": "US",
    "u-s-a": "US",
    "uk": "GB",
    "u-k": "GB",
    "united-kingdom": "GB",
    "uae": "AE",
    "u-a-e": "AE",
    "united-arab-emirates": "AE",
    "south-korea": "KR",
    "north-korea": "KP",
    "russia": "RU",
    "palestine": "PS",
    "palestina": "PS",
    "state-of-palestine": "PS",
    "palestinian-territories": "PS",
    "palestinian-territory": "PS",
    "wilayah-palestina": "PS",
    "kosovo": "XK"
  };
  var PRICE_COUNTRY_NAME_OVERRIDES = {
    AF: "Afghanistan",
    XK: "Kosovo"
  };
  var PRICE_COUNTRY_DEFAULT_LANGUAGES = {
    AF: ["fa", "ps", "en"]
  };
  var PRICE_REGION_PRESETS = {
    ID: {
      supported: true,
      provinces: [
        {
          value: "Daerah Istimewa Yogyakarta",
          label: "Daerah Istimewa Yogyakarta",
          fuelRegion: "DIY / Jawa Tengah",
          electricityRegion: "Nasional PLN",
          telecomRegion: "Daerah Istimewa Yogyakarta",
          waterRegion: "Daerah Istimewa Yogyakarta",
          cities: [
            { value: "Sleman", label: "Kabupaten Sleman", telecomRegion: "Sleman", waterRegion: "PDAM Tirta Sembada Sleman" },
            { value: "Kota Yogyakarta", label: "Kota Yogyakarta", telecomRegion: "Kota Yogyakarta", waterRegion: "PDAM Tirtamarta Yogyakarta" },
            { value: "Bantul", label: "Kabupaten Bantul", telecomRegion: "Bantul", waterRegion: "PDAM Bantul" },
            { value: "Kulon Progo", label: "Kabupaten Kulon Progo", telecomRegion: "Kulon Progo", waterRegion: "PDAM Kulon Progo" },
            { value: "Gunungkidul", label: "Kabupaten Gunungkidul", telecomRegion: "Gunungkidul", waterRegion: "PDAM Gunungkidul" }
          ]
        },
        {
          value: "DKI Jakarta",
          label: "DKI Jakarta",
          fuelRegion: "DKI Jakarta",
          electricityRegion: "Nasional PLN",
          telecomRegion: "DKI Jakarta",
          waterRegion: "PAM Jaya",
          cities: [
            { value: "Jakarta Pusat", label: "Jakarta Pusat", waterRegion: "PAM Jaya" },
            { value: "Jakarta Selatan", label: "Jakarta Selatan", waterRegion: "PAM Jaya" },
            { value: "Jakarta Timur", label: "Jakarta Timur", waterRegion: "PAM Jaya" },
            { value: "Jakarta Barat", label: "Jakarta Barat", waterRegion: "PAM Jaya" },
            { value: "Jakarta Utara", label: "Jakarta Utara", waterRegion: "PAM Jaya" },
            { value: "Kepulauan Seribu", label: "Kepulauan Seribu", waterRegion: "PAM Jaya" }
          ]
        },
        {
          value: "Jawa Tengah",
          label: "Jawa Tengah",
          fuelRegion: "DIY / Jawa Tengah",
          electricityRegion: "Nasional PLN",
          telecomRegion: "Jawa Tengah",
          waterRegion: "Jawa Tengah",
          cities: [
            { value: "Kota Semarang", label: "Kota Semarang" },
            { value: "Surakarta", label: "Kota Surakarta" },
            { value: "Magelang", label: "Magelang" },
            { value: "Klaten", label: "Klaten" },
            { value: "Banyumas", label: "Banyumas" }
          ]
        },
        {
          value: "Jawa Barat",
          label: "Jawa Barat",
          fuelRegion: "Jawa Barat",
          electricityRegion: "Nasional PLN",
          telecomRegion: "Jawa Barat",
          waterRegion: "Jawa Barat",
          cities: [
            { value: "Kota Bandung", label: "Kota Bandung" },
            { value: "Bekasi", label: "Bekasi" },
            { value: "Bogor", label: "Bogor" },
            { value: "Depok", label: "Depok" },
            { value: "Cirebon", label: "Cirebon" }
          ]
        },
        {
          value: "Jawa Timur",
          label: "Jawa Timur",
          fuelRegion: "Jawa Timur",
          electricityRegion: "Nasional PLN",
          telecomRegion: "Jawa Timur",
          waterRegion: "Jawa Timur",
          cities: [
            { value: "Kota Surabaya", label: "Kota Surabaya" },
            { value: "Malang", label: "Malang" },
            { value: "Sidoarjo", label: "Sidoarjo" },
            { value: "Gresik", label: "Gresik" },
            { value: "Kediri", label: "Kediri" }
          ]
        },
        {
          value: "Bali",
          label: "Bali",
          fuelRegion: "Bali",
          electricityRegion: "Nasional PLN",
          telecomRegion: "Bali",
          waterRegion: "Bali",
          cities: [
            { value: "Denpasar", label: "Denpasar" },
            { value: "Badung", label: "Badung" },
            { value: "Gianyar", label: "Gianyar" },
            { value: "Tabanan", label: "Tabanan" }
          ]
        },
        {
          value: "Nasional",
          label: "Nasional Indonesia",
          fuelRegion: "Nasional Indonesia",
          electricityRegion: "Nasional PLN",
          telecomRegion: "Nasional Indonesia",
          waterRegion: "Nasional Indonesia",
          cities: [
            { value: "Nasional", label: "Seluruh Indonesia", waterRegion: "Nasional Indonesia" }
          ]
        }
      ]
    }
  };
  var priceCountryDisplayNames = null;
  var priceCountryEnglishDisplayNames = null;
  var priceCountryOptionCache = null;

  var ASSET_CATALOG = {
    "AC": {
      prefix: "AC",
      subtypes: [
        { name: "0.5 PK split wall", watts: 390, btu: 5000, pk: 0.5 },
        { name: "0.75 PK split wall", watts: 600, btu: 7000, pk: 0.75 },
        { name: "1 PK split wall", watts: 900, btu: 9000, pk: 1 },
        { name: "1.5 PK split wall", watts: 1250, btu: 12000, pk: 1.5 },
        { name: "2 PK split wall", watts: 1800, btu: 18000, pk: 2 },
        { name: "2.5 PK split wall", watts: 2200, btu: 24000, pk: 2.5 },
        { name: "2 PK standing floor", watts: 1900, btu: 18000, pk: 2 },
        { name: "3 PK standing floor", watts: 2850, btu: 28000, pk: 3 },
        { name: "Cassette 2 PK", watts: 1850, btu: 18000, pk: 2 },
        { name: "Inverter low watt 1 PK", watts: 650, btu: 9000, pk: 1 }
      ]
    },
    "Televisi": {
      prefix: "TV",
      subtypes: [
        { name: "LED 32 inch", watts: 45 },
        { name: "LED 43 inch", watts: 75 },
        { name: "LED 55 inch", watts: 120 },
        { name: "Display informasi 65 inch", watts: 170 },
        { name: "Proyektor", watts: 280 }
      ]
    },
    "Pengeras suara": {
      prefix: "AUD",
      subtypes: [
        { name: "Amplifier 250 W", watts: 250 },
        { name: "Amplifier 500 W", watts: 500 },
        { name: "Speaker aktif 12 inch", watts: 150 },
        { name: "Speaker horn luar", watts: 80 },
        { name: "Mixer audio", watts: 30 },
        { name: "Receiver microphone wireless", watts: 15 }
      ]
    },
    "Kulkas": {
      prefix: "REF",
      subtypes: [
        { name: "Kulkas 1 pintu", watts: 100 },
        { name: "Kulkas 2 pintu", watts: 170 },
        { name: "Freezer box kecil", watts: 150 },
        { name: "Showcase minuman", watts: 260 }
      ]
    },
    "Pompa air": {
      prefix: "PMP",
      subtypes: [
        { name: "Pompa sumur dangkal 125 W", watts: 125 },
        { name: "Pompa sumur dangkal 250 W", watts: 250 },
        { name: "Pompa jet pump 370 W", watts: 370 },
        { name: "Pompa submersible 750 W", watts: 750 },
        { name: "Pompa transfer toren 125 W", watts: 125 },
        { name: "Booster pump 200 W", watts: 200 }
      ]
    },
    "Lampu": {
      prefix: "LGT",
      subtypes: [
        { name: "LED bulb 9 W", watts: 9 },
        { name: "LED bulb 12 W", watts: 12 },
        { name: "LED tube 18 W", watts: 18 },
        { name: "LED panel 36 W", watts: 36 },
        { name: "Floodlight halaman 50 W", watts: 50 },
        { name: "Floodlight halaman 100 W", watts: 100 }
      ]
    },
    "Kipas angin": {
      prefix: "FAN",
      subtypes: [
        { name: "Kipas dinding 16 inch", watts: 55 },
        { name: "Kipas berdiri", watts: 60 },
        { name: "Exhaust fan", watts: 35 },
        { name: "Ceiling fan", watts: 75 },
        { name: "Industrial fan", watts: 180 }
      ]
    },
    "Pendingin ruangan": {
      prefix: "HVAC",
      subtypes: [
        {
          name: "VRV / VRF outdoor unit",
          watts: 5200,
          btu: 48000,
          capacityLabel: "4 HP / multi indoor",
          coolingSystem: "VRV/VRF",
          models: [
            { brand: "Daikin", model: "VRV outdoor", series: "IV / A series", capacityLabel: "4-10 HP", claimPowerWatts: 5200 },
            { brand: "Mitsubishi Electric", model: "City Multi outdoor", series: "VRF", capacityLabel: "4-10 HP", claimPowerWatts: 5200 },
            { brand: "LG", model: "Multi V outdoor", series: "VRF", capacityLabel: "4-10 HP", claimPowerWatts: 5200 },
            { brand: "Panasonic", model: "ECOi outdoor", series: "VRF", capacityLabel: "4-10 HP", claimPowerWatts: 5200 }
          ]
        },
        {
          name: "VRV / VRF indoor cassette",
          watts: 90,
          btu: 12000,
          capacityLabel: "Indoor cassette 1-1.5 PK",
          coolingSystem: "VRV/VRF indoor",
          models: [
            { brand: "Daikin", model: "Indoor cassette", series: "VRV", capacityLabel: "12.000 BTU/h", claimPowerWatts: 90 },
            { brand: "Mitsubishi Electric", model: "Indoor cassette", series: "VRF", capacityLabel: "12.000 BTU/h", claimPowerWatts: 90 },
            { brand: "LG", model: "Indoor cassette", series: "Multi V", capacityLabel: "12.000 BTU/h", claimPowerWatts: 90 }
          ]
        },
        {
          name: "Chiller air cooled",
          watts: 18000,
          btu: 120000,
          capacityLabel: "10 TR / 120.000 BTU/h",
          coolingSystem: "Chiller",
          models: [
            { brand: "Carrier", model: "Air cooled chiller", series: "AquaSnap", capacityLabel: "10 TR", claimPowerWatts: 18000 },
            { brand: "Trane", model: "Air cooled chiller", series: "Sintesis", capacityLabel: "10 TR", claimPowerWatts: 18000 },
            { brand: "York", model: "Air cooled chiller", series: "YLAA", capacityLabel: "10 TR", claimPowerWatts: 18000 },
            { brand: "Daikin", model: "Air cooled chiller", series: "EWAD", capacityLabel: "10 TR", claimPowerWatts: 18000 }
          ]
        },
        {
          name: "Chiller water cooled",
          watts: 15000,
          btu: 120000,
          capacityLabel: "10 TR / butuh cooling tower",
          coolingSystem: "Chiller",
          models: [
            { brand: "Carrier", model: "Water cooled chiller", series: "AquaEdge", capacityLabel: "10 TR", claimPowerWatts: 15000 },
            { brand: "Trane", model: "Water cooled chiller", series: "CenTraVac", capacityLabel: "10 TR", claimPowerWatts: 15000 },
            { brand: "York", model: "Water cooled chiller", series: "YVWA", capacityLabel: "10 TR", claimPowerWatts: 15000 }
          ]
        },
        { name: "AHU air handling unit", watts: 2200, btu: 60000, capacityLabel: "Supply air / ducting", coolingSystem: "AHU" },
        { name: "FCU fan coil unit", watts: 160, btu: 12000, capacityLabel: "Fan coil 1 TR", coolingSystem: "FCU" },
        { name: "Cooling tower", watts: 1500, capacityLabel: "Sirkulasi kondensor chiller", coolingSystem: "Cooling tower" },
        { name: "Evaporative air cooler", watts: 280, capacityLabel: "Pendingin evaporatif", coolingSystem: "Evaporative cooler" },
        { name: "Air curtain", watts: 180, capacityLabel: "Pintu masuk / lobby", coolingSystem: "Air curtain" }
      ]
    },
    "Genset": {
      prefix: "GEN",
      subtypes: [
        {
          name: "Genset inverter bensin 1 kVA",
          watts: 900,
          capacityLabel: "1 kVA",
          fuelType: "Bensin RON 92",
          models: [
            { brand: "Honda", model: "EU10i", series: "Inverter", capacityLabel: "1 kVA / bensin", claimPowerWatts: 900 },
            { brand: "Yamaha", model: "EF1000iS", series: "Inverter", capacityLabel: "1 kVA / bensin", claimPowerWatts: 900 },
            { brand: "Loncin", model: "Inverter 1 kVA", series: "Portable", capacityLabel: "1 kVA / bensin", claimPowerWatts: 900 }
          ]
        },
        {
          name: "Genset portable bensin 2.2 kVA",
          watts: 2000,
          capacityLabel: "2.2 kVA",
          fuelType: "Bensin RON 92",
          models: [
            { brand: "Honda", model: "EG2200", series: "Portable", capacityLabel: "2.2 kVA / bensin", claimPowerWatts: 2000 },
            { brand: "Yamaha", model: "EF2600", series: "Portable", capacityLabel: "2.2 kVA / bensin", claimPowerWatts: 2000 },
            { brand: "Krisbow", model: "Portable gasoline", series: "2.2 kVA", capacityLabel: "2.2 kVA / bensin", claimPowerWatts: 2000 }
          ]
        },
        {
          name: "Genset silent diesel 5 kVA",
          watts: 4500,
          capacityLabel: "5 kVA",
          fuelType: "Solar / diesel",
          models: [
            { brand: "Yanmar", model: "Silent diesel", series: "5 kVA", capacityLabel: "5 kVA / diesel", claimPowerWatts: 4500 },
            { brand: "Kubota", model: "Silent diesel", series: "5 kVA", capacityLabel: "5 kVA / diesel", claimPowerWatts: 4500 },
            { brand: "Firman", model: "Silent diesel", series: "5 kVA", capacityLabel: "5 kVA / diesel", claimPowerWatts: 4500 }
          ]
        },
        { name: "Genset silent diesel 10 kVA", watts: 9000, capacityLabel: "10 kVA", fuelType: "Solar / diesel" },
        { name: "Genset silent diesel 20 kVA", watts: 18000, capacityLabel: "20 kVA", fuelType: "Solar / diesel" },
        { name: "Genset silent diesel 50 kVA", watts: 45000, capacityLabel: "50 kVA", fuelType: "Solar / diesel" },
        { name: "Genset gas / LPG 5 kVA", watts: 4500, capacityLabel: "5 kVA / gas", fuelType: "LPG / gas" },
        { name: "Panel ATS / AMF genset", watts: 50, capacityLabel: "Auto transfer switch", fuelType: "Tidak memakai BBM" }
      ]
    },
    "CCTV dan jaringan": {
      prefix: "NET",
      subtypes: [
        { name: "Kamera CCTV IP", watts: 8, capacityLabel: "1 kamera IP PoE" },
        { name: "Kamera CCTV analog", watts: 6, capacityLabel: "1 kamera analog" },
        { name: "NVR 4 channel", watts: 25, capacityLabel: "4 channel / 1 bay HDD" },
        { name: "NVR 8 channel", watts: 35, capacityLabel: "8 channel / 1-2 bay HDD" },
        { name: "NVR 16 channel", watts: 50, capacityLabel: "16 channel / 2 bay HDD" },
        { name: "NVR 32 channel", watts: 70, capacityLabel: "32 channel / 4 bay HDD" },
        { name: "DVR 4 channel", watts: 18, capacityLabel: "4 channel analog / 1 bay HDD" },
        { name: "DVR 8 channel", watts: 25, capacityLabel: "8 channel analog / 1 bay HDD" },
        { name: "DVR 16 channel", watts: 35, capacityLabel: "16 channel analog / 2 bay HDD" },
        { name: "HDD CCTV 1 TB", watts: 6, capacityLabel: "1 TB" },
        { name: "HDD CCTV 2 TB", watts: 7, capacityLabel: "2 TB" },
        { name: "HDD CCTV 4 TB", watts: 8, capacityLabel: "4 TB" },
        { name: "HDD CCTV 8 TB", watts: 9, capacityLabel: "8 TB" },
        { name: "Router internet", watts: 12 },
        { name: "Switch PoE 8 port", watts: 70 },
        { name: "Switch PoE 16 port", watts: 150, capacityLabel: "16 port PoE" },
        { name: "UPS CCTV / jaringan", watts: 25, capacityLabel: "650-1200 VA" },
        { name: "Access point WiFi", watts: 15 }
      ]
    },
    "Peralatan air dan dapur": {
      prefix: "KIT",
      subtypes: [
        { name: "Dispenser galon bawah", watts: 350 },
        { name: "Rice cooker besar", watts: 700 },
        { name: "Water heater wudhu", watts: 350 },
        { name: "Mesin cuci mukena", watts: 350 }
      ]
    },
    "Inventaris non-listrik": {
      prefix: "INV",
      subtypes: [
        { name: "Lemari / bupet", watts: 0 },
        { name: "Rak dokumen / display", watts: 0 },
        { name: "Buku / dokumen inventaris", watts: 0 },
        { name: "Karpet / alas lantai", watts: 0 },
        { name: "Kotak dana / kas kecil", watts: 0 },
        { name: "Meja kerja / meja kegiatan", watts: 0 }
      ]
    },
    "Kendaraan": {
      prefix: "VEH",
      subtypes: [
        {
          name: "Sepeda 2 roda",
          watts: 0,
          wheels: 2,
          vehicleKind: "Sepeda",
          fuelType: "Tidak memakai BBM",
          capacityLabel: "2 roda",
          models: [
            { brand: "Polygon", model: "Sepeda", capacityLabel: "2 roda", claimPowerWatts: 0 },
            { brand: "United", model: "Sepeda", capacityLabel: "2 roda", claimPowerWatts: 0 },
            { brand: "Pacific", model: "Sepeda", capacityLabel: "2 roda", claimPowerWatts: 0 }
          ]
        },
        {
          name: "Sepeda motor 2 roda",
          watts: 0,
          wheels: 2,
          vehicleKind: "Sepeda motor",
          fuelType: "Bensin RON 92",
          capacityLabel: "2 roda / plat opsional",
          models: [
            { brand: "Honda", model: "Beat / Vario / Supra", capacityLabel: "2 roda", claimPowerWatts: 0 },
            { brand: "Yamaha", model: "Mio / NMAX / Jupiter", capacityLabel: "2 roda", claimPowerWatts: 0 },
            { brand: "Suzuki", model: "Address / Smash", capacityLabel: "2 roda", claimPowerWatts: 0 },
            { brand: "Kawasaki", model: "KLX / W175", capacityLabel: "2 roda", claimPowerWatts: 0 },
            { brand: "Vespa", model: "Sprint / Primavera", capacityLabel: "2 roda", claimPowerWatts: 0 }
          ]
        },
        {
          name: "Motor roda tiga",
          watts: 0,
          wheels: 3,
          vehicleKind: "Kendaraan khusus",
          fuelType: "Bensin RON 92",
          capacityLabel: "3 roda / bak angkut",
          models: [
            { brand: "Viar", model: "Karya", capacityLabel: "3 roda", claimPowerWatts: 0 },
            { brand: "Nozomi", model: "Roda tiga", capacityLabel: "3 roda", claimPowerWatts: 0 }
          ]
        },
        {
          name: "Mobil penumpang 4 roda",
          watts: 0,
          wheels: 4,
          vehicleKind: "Mobil",
          fuelType: "Bensin RON 92",
          capacityLabel: "4 roda / plat nomor",
          models: [
            { brand: "Toyota", model: "Avanza / Innova / Calya", capacityLabel: "4 roda", claimPowerWatts: 0 },
            { brand: "Daihatsu", model: "Xenia / Gran Max / Sigra", capacityLabel: "4 roda", claimPowerWatts: 0 },
            { brand: "Honda", model: "Brio / Mobilio / BR-V", capacityLabel: "4 roda", claimPowerWatts: 0 },
            { brand: "Suzuki", model: "Ertiga / Carry", capacityLabel: "4 roda", claimPowerWatts: 0 },
            { brand: "Mitsubishi", model: "Xpander", capacityLabel: "4 roda", claimPowerWatts: 0 },
            { brand: "Wuling", model: "Confero / Formo", capacityLabel: "4 roda", claimPowerWatts: 0 }
          ]
        },
        {
          name: "Pick-up / angkutan 4 roda",
          watts: 0,
          wheels: 4,
          vehicleKind: "Pick-up",
          fuelType: "Bensin RON 92 / Solar",
          capacityLabel: "4 roda / bak angkut",
          models: [
            { brand: "Suzuki", model: "Carry Pick Up", capacityLabel: "4 roda", claimPowerWatts: 0 },
            { brand: "Daihatsu", model: "Gran Max Pick Up", capacityLabel: "4 roda", claimPowerWatts: 0 },
            { brand: "Mitsubishi", model: "L300", capacityLabel: "4 roda", claimPowerWatts: 0 }
          ]
        },
        {
          name: "Truk / kendaraan logistik",
          watts: 0,
          wheels: 4,
          vehicleKind: "Truk",
          fuelType: "Solar / diesel",
          capacityLabel: "4-6 roda / plat nomor",
          models: [
            { brand: "Mitsubishi Fuso", model: "Canter", capacityLabel: "4-6 roda", claimPowerWatts: 0 },
            { brand: "Hino", model: "Dutro", capacityLabel: "4-6 roda", claimPowerWatts: 0 },
            { brand: "Isuzu", model: "Elf", capacityLabel: "4-6 roda", claimPowerWatts: 0 }
          ]
        }
      ]
    },
    "Lainnya": {
      prefix: "OTH",
      subtypes: [
        { name: "Perangkat listrik lain", watts: 0 },
        { name: "Aset catatan saja", watts: 0 }
      ]
    }
  };

  var LOCAL_CATALOG_ENTRIES = {
    "Kendaraan": ASSET_CATALOG.Kendaraan,
    "Genset": ASSET_CATALOG.Genset,
    "Pendingin ruangan": ASSET_CATALOG["Pendingin ruangan"]
  };

  var PLAN_KIND_LABELS = {
    prayer: "Ruang utama",
    room: "Ruang / area utama",
    service: "Area service",
    utility: "Utilitas",
    storage: "Gudang / inventaris",
    circulation: "Akses / teras"
  };

  var METER_KIND_LABELS = {
    prepaid: "Prabayar/token",
    postpaid: "Pascabayar",
    "smart-ami": "Smart meter/AMI",
    "sub-meter": "Sub-meter panel",
    "sensor-ready": "Sensor otomatis disiapkan"
  };

  var POWER_CAPACITY_OPTIONS = [
    450,
    900,
    1300,
    2200,
    3500,
    4400,
    5500,
    6600,
    7700,
    10600,
    11000,
    13200,
    16500,
    23000,
    33000,
    41500,
    53000
  ];
  var POWER_CAPACITY_DETAILS = [];
  var catalogSource = "embedded-fallback";

  var state = {
    context: null,
    scopeKey: "manual-local",
    data: null,
    activeTab: "assets",
    drag: null,
    lastAutoAssetCode: "",
    lastAutoAssetCapacity: "",
    brandLookupKey: "",
    brandLookupData: null,
    showBuildingInfo: false,
    webgisBuildings: null,
    webgisBuildingsLoading: false,
    webgisBuildingsLoaded: false,
    webgisBuildingsError: "",
    energyPrices: null,
    energyPricesLoading: false,
    energyPricesLoaded: false,
    energyPricesError: "",
    energyPriceLoadTimer: null,
    energyPriceRequestKey: "",
    energyPriceRequestSerial: 0,
    energyPricePromise: null,
    electricityGenerationProfile: null,
    electricityGenerationLoading: false,
    electricityGenerationError: "",
    electricityGenerationRequestKey: "",
    electricityGenerationPromise: null,
    usFuelProviderCatalog: null,
    usFuelProviderLoading: false,
    usFuelProviderError: "",
    usFuelProviderRequestKey: "",
    usFuelProviderPromise: null,
    usWaterProviderCatalog: null,
    usWaterProviderLoading: false,
    usWaterProviderError: "",
    usWaterProviderRequestKey: "",
    usWaterProviderPromise: null,
    usWaterTariffHierarchy: null,
    usWaterTariffHierarchyLoading: false,
    usWaterTariffHierarchyError: "",
    usWaterTariffHierarchyRequestKey: "",
    usWaterTariffHierarchyPromise: null,
    usMobileOperatorCatalog: null,
    usMobileOperatorLoading: false,
    usMobileOperatorError: "",
    usMobileOperatorRequestKey: "",
    usMobileOperatorPromise: null,
    globalFuelDatabase: null,
    globalUtilityCategoryDatabases: {},
    globalUtilityCategoryErrors: {},
    globalDiscoveryDatabase: null,
    globalDiscoveryLoading: false,
    globalDiscoveryLoaded: false,
    globalDiscoveryError: "",
    globalDiscoveryRequestKey: "",
    globalDiscoveryRequestSerial: 0,
    globalDiscoveryPromise: null,
    energyPanelsExpanded: Object.assign({}, ENERGY_PANEL_DEFAULTS),
    deepLinkSection: "",
    resolvingContext: false,
    suppressHashApply: false,
    assetSaveBusy: false,
    globalEditContext: null,
    globalEditBusy: false
  };

  var refs = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function collectRefs() {
    [
      "scopeMosqueName",
      "scopeLocation",
      "storageStatus",
      "toggleBuildingInfoButton",
      "buildingInfoPanel",
      "loadWebgisBuildingsButton",
      "webgisBuildingStatus",
      "webgisBuildingTableWrap",
      "webgisBuildingTableBody",
      "buildingForm",
      "buildingSelect",
      "buildingNameInput",
      "buildingTypeInput",
      "assetCodeFormatInput",
      "exportDataButton",
      "importDataButton",
      "importDataInput",
      "metricAssetCount",
      "metricAssetValue",
      "metricLoad",
      "metricDailyCost",
      "metricMonthlyCost",
      "metricTariff",
      "metricKwhBalance",
      "metricKwhDays",
      "metricMonthlyInfaq",
      "metricCashBalance",
      "metricMonthlyExpense",
      "metricServiceDue",
      "assetForm",
      "assetResetButton",
      "assetIdInput",
      "assetCodeInput",
      "assetCategoryInput",
      "assetSubtypeInput",
      "assetNameInput",
      "assetBrandInput",
      "brandLookupButton",
      "brandLookupPanel",
      "brandLookupStatus",
      "brandLookupResults",
      "assetModelInput",
      "assetCapacityInput",
      "catalogAutoUpdateInput",
      "vehicleAssetFields",
      "assetWheelCountInput",
      "assetVehicleKindInput",
      "assetVehicleYearInput",
      "assetVehicleColorInput",
      "assetVehiclePlateInput",
      "fuelAssetFields",
      "assetFuelTypeInput",
      "assetFuelCapacityInput",
      "assetRoomInput",
      "assetPlanXInput",
      "assetPlanYInput",
      "assetMountHeightInput",
      "assetDirectionInput",
      "assetQuantityInput",
      "assetWattsInput",
      "assetHoursInput",
      "assetDaysInput",
      "assetMonitoringInput",
      "assetSensorInput",
      "assetAcquiredInput",
      "assetValueInput",
      "assetNotesInput",
      "assetEstimateText",
      "assetTableBody",
      "roomNameList",
      "assetSubtypeList",
      "assetCapacityList",
      "brandSuggestionList",
      "seriesSuggestionList",
      "energyPriceRefreshButton",
      "energyPriceStatus",
      "energyCountryFormatText",
      "energyPanelShowAllButton",
      "energyPanelHideAllButton",
      "energyPanelToggleStatus",
      "priceRegionForm",
      "priceCountryInput",
      "priceCountryCodeInput",
      "priceProvinceInput",
      "priceCityInput",
      "priceRegionLanguagesInput",
      "useWebgisPriceAreaButton",
      "fuelPriceRegionInput",
      "electricityPriceRegionInput",
      "telecomPriceRegionInput",
      "waterPriceRegionInput",
      "priceRegionNotesInput",
      "priceRegionSummaryText",
      "fuelPriceUnitHeader",
      "fuelPriceConversionHeader",
      "fuelRetailStatus",
      "fuelPriceDisplayModeInput",
      "electricityPriceUnitHeader",
      "internetPriceUnitHeader",
      "mobilePriceUnitHeader",
      "waterPriceUnitHeader",
      "waterPriceConversionHeader",
      "oilPriceTableBody",
      "fuelPriceTableBody",
      "usFuelProviderStatus",
      "usFuelProviderTableBody",
      "electricityTariffTableBody",
      "electricityGenerationStatus",
      "electricityGenerationTableBody",
      "internetPackageTableBody",
      "usTelecomScopeStatus",
      "usTelecomProviderWrap",
      "usTelecomProviderTableBody",
      "usMobileOperatorStatus",
      "mobilePackageTableBody",
      "waterTariffTableBody",
      "usWaterProviderStatus",
      "usWaterProviderTableBody",
      "sourceDiscoveryStatus",
      "sourceDiscoveryTableBody",
      "globalUtilityStatus",
      "globalUtilityTableBody",
      "globalDiscoveryForm",
      "globalDiscoveryCategoryInput",
      "globalDiscoveryUseAdmInput",
      "globalDiscoveryScopeHint",
      "globalDiscoveryRefreshButton",
      "globalDiscoveryStatus",
      "globalDiscoveryRunTableBody",
      "globalDiscoveryStageTableBody",
      "globalDiscoveryQualityTableBody",
      "globalDiscoveryPatternTableBody",
      "globalAuthorityTableBody",
      "globalProviderTableBody",
      "globalCoverageTableBody",
      "globalProductTableBody",
      "globalDiscoverySourceTableBody",
      "globalDiscoveryPriceTableBody",
      "globalDiscoveryGraphTableBody",
      "globalFuelRecordTableBody",
      "globalElectricityRecordTableBody",
      "globalWaterRecordTableBody",
      "globalInternetRecordTableBody",
      "globalMobileRecordTableBody",
      "globalSourceRegistryTableBody",
      "globalRelationalStatus",
      "globalRelationalCountTableBody",
      "globalRelationTableBody",
      "globalOrganizationTableBody",
      "globalPricingAreaTableBody",
      "globalOfficialSourceTableBody",
      "globalUncoveredTableBody",
      "globalEditPanel",
      "globalEditTitle",
      "globalEditTimestampText",
      "globalEditForm",
      "globalEditEntityInput",
      "globalEditEntityIdInput",
      "globalEditNameInput",
      "globalEditSecondaryNameInput",
      "globalEditCategoryInput",
      "globalEditPriceInput",
      "globalEditCurrencyInput",
      "globalEditUnitInput",
      "globalEditPricingAreaInput",
      "globalEditEffectiveDateInput",
      "globalEditEffectiveTimeInput",
      "globalEditTimezoneInput",
      "globalEditUrlInput",
      "globalEditStatusInput",
      "globalEditLanguageInput",
      "globalEditSourceTypeInput",
      "globalEditMethodInput",
      "globalEditAdapterInput",
      "globalEditScoreInput",
      "globalEditNotesInput",
      "globalEditSaveButton",
      "globalEditCancelButton",
      "globalEditMessage",
      "localeProfileSummary",
      "localeLanguageTableBody",
      "multilingualExtractionTableBody",
      "extractionReviewRules",
      "waterSourceForm",
      "waterPrimarySourceInput",
      "waterProviderInput",
      "waterCustomerInput",
      "waterCustomerGroupInput",
      "waterManualRateInput",
      "waterNotesInput",
      "waterSourceSummaryText",
      "meterSettingsForm",
      "meterResetButton",
      "meterKindInput",
      "meterCustomerInput",
      "meterPhaseInput",
      "installedPowerClassInput",
      "installedPowerInput",
      "tariffInput",
      "electricBudgetInput",
      "currentKwhInput",
      "minimumKwhInput",
      "meterVarianceText",
      "meterLogForm",
      "meterLogIdInput",
      "meterDateInput",
      "meterTypeInput",
      "meterKwhInput",
      "meterCostInput",
      "meterNoteInput",
      "meterTableBody",
      "serviceForm",
      "serviceResetButton",
      "serviceIdInput",
      "serviceDateInput",
      "serviceTargetInput",
      "serviceTypeInput",
      "serviceTitleInput",
      "serviceVendorInput",
      "serviceCostInput",
      "serviceNextInput",
      "serviceDetailInput",
      "showServiceDetailsToggle",
      "serviceTableBody",
      "infaqForm",
      "infaqResetButton",
      "infaqIdInput",
      "infaqDateInput",
      "infaqCategoryInput",
      "infaqSourceInput",
      "infaqAmountInput",
      "infaqMethodInput",
      "infaqAllocationInput",
      "infaqNotesInput",
      "infaqTableBody",
      "expenseForm",
      "expenseResetButton",
      "expenseIdInput",
      "expenseDateInput",
      "expenseCategoryInput",
      "expenseDescriptionInput",
      "expenseAmountInput",
      "expenseSourceInput",
      "expenseAssetInput",
      "expenseTableBody",
      "roomForm",
      "roomResetButton",
      "roomIdInput",
      "roomNameInput",
      "roomLengthInput",
      "roomWidthInput",
      "roomHeightInput",
      "roomOccupancyInput",
      "roomSunInput",
      "roomAirflowInput",
      "roomRecommendationInput",
      "roomEstimateText",
      "roomTableBody",
      "planForm",
      "planResetButton",
      "planLengthInput",
      "planWidthInput",
      "planHeightInput",
      "planSettingsButton",
      "planIdInput",
      "planNameInput",
      "planKindInput",
      "planShapeInput",
      "planPointsInput",
      "planXInput",
      "planYInput",
      "planWInput",
      "planHInput",
      "planFromRoomsButton",
      "planCanvas",
      "planAnalysisList",
      "planTableBody"
    ].forEach(function (id) {
      refs[id] = byId(id);
    });
  }

  function canUseStorage() {
    try {
      var key = "mpm:facility:probe";
      window.localStorage.setItem(key, "1");
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function safeParse(value, fallback) {
    if (!value) {
      return fallback;
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function normalizeEnergyPanelPreferences(value) {
    var source = value && typeof value === "object" ? value : {};
    return Object.keys(ENERGY_PANEL_DEFAULTS).reduce(function (preferences, panel) {
      preferences[panel] = typeof source[panel] === "boolean"
        ? source[panel]
        : ENERGY_PANEL_DEFAULTS[panel];
      return preferences;
    }, {});
  }

  function loadEnergyPanelPreferences(serializedValue) {
    var stored = null;
    if (serializedValue !== undefined) {
      stored = safeParse(serializedValue, null);
    } else if (canUseStorage()) {
      try {
        stored = safeParse(window.localStorage.getItem(ENERGY_PANEL_STORAGE_KEY), null);
      } catch (error) {
        stored = null;
      }
    }
    state.energyPanelsExpanded = normalizeEnergyPanelPreferences(stored);
    if (state.deepLinkSection === "discovery") {
      state.energyPanelsExpanded.database = true;
    }
  }

  function persistEnergyPanelPreferences() {
    if (!canUseStorage()) {
      return;
    }
    try {
      window.localStorage.setItem(ENERGY_PANEL_STORAGE_KEY, JSON.stringify(normalizeEnergyPanelPreferences(state.energyPanelsExpanded)));
    } catch (error) {
      // UI preferences are optional and must never block facility management.
    }
  }

  function energyPanelCards(panel) {
    var selector = panel === "database"
      ? ".energy-price-card.source-discovery-card"
      : ".energy-price-card[data-energy-panel=\"" + panel + "\"]";
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  function renderEnergyPanelVisibility() {
    var preferences = normalizeEnergyPanelPreferences(state.energyPanelsExpanded);
    state.energyPanelsExpanded = preferences;
    var visiblePanels = [];
    Object.keys(ENERGY_PANEL_DEFAULTS).forEach(function (panel) {
      var expanded = preferences[panel] === true;
      var cards = energyPanelCards(panel);
      var controlledIds = [];
      cards.forEach(function (card, index) {
        if (!card.id) {
          card.id = "energy-" + panel + "-panel-" + (index + 1);
        }
        controlledIds.push(card.id);
        card.classList.toggle("is-energy-panel-hidden", !expanded);
        if (expanded) {
          card.removeAttribute("aria-hidden");
        } else {
          card.setAttribute("aria-hidden", "true");
        }
      });
      var button = document.querySelector("[data-energy-panel-toggle=\"" + panel + "\"]");
      if (button) {
        button.setAttribute("aria-pressed", expanded ? "true" : "false");
        button.setAttribute("aria-expanded", expanded ? "true" : "false");
        button.setAttribute("aria-controls", controlledIds.join(" "));
        var stateLabel = button.querySelector("[data-energy-panel-state]");
        if (stateLabel) {
          stateLabel.textContent = expanded ? "Tampil" : "Tersembunyi";
        }
        button.title = (expanded ? "Sembunyikan " : "Tampilkan ") + ENERGY_PANEL_LABELS[panel];
      }
      if (expanded) {
        visiblePanels.push(ENERGY_PANEL_LABELS[panel]);
      }
    });
    if (refs.energyPanelShowAllButton) {
      refs.energyPanelShowAllButton.disabled = visiblePanels.length === Object.keys(ENERGY_PANEL_DEFAULTS).length;
    }
    if (refs.energyPanelHideAllButton) {
      refs.energyPanelHideAllButton.disabled = visiblePanels.length === 0;
    }
    if (refs.energyPanelToggleStatus) {
      refs.energyPanelToggleStatus.textContent = visiblePanels.length
        ? "Ditampilkan: " + visiblePanels.join(", ") + ". Membuka atau menutup panel tidak memuat ulang data."
        : "Semua kelompok disembunyikan. Data tetap tersimpan dan dapat ditampilkan kembali tanpa memuat ulang.";
    }
  }

  function setEnergyPanelVisibility(panel, expanded, persist) {
    if (!Object.prototype.hasOwnProperty.call(ENERGY_PANEL_DEFAULTS, panel)) {
      return;
    }
    state.energyPanelsExpanded[panel] = Boolean(expanded);
    if (persist !== false) {
      persistEnergyPanelPreferences();
    }
    renderEnergyPanelVisibility();
  }

  function setAllEnergyPanels(expanded) {
    Object.keys(ENERGY_PANEL_DEFAULTS).forEach(function (panel) {
      state.energyPanelsExpanded[panel] = Boolean(expanded);
    });
    persistEnergyPanelPreferences();
    renderEnergyPanelVisibility();
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toNumber(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : (fallback || 0);
  }

  function optionalNumber(value) {
    var text = String(value === undefined || value === null ? "" : value).trim();
    if (!text) {
      return null;
    }
    var parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, digits) {
    var factor = Math.pow(10, digits || 0);
    return Math.round((toNumber(value, 0) + Number.EPSILON) * factor) / factor;
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function isLegacyDefaultBuildingName(value) {
    return slugify(value) === LEGACY_DEFAULT_BUILDING_SLUG;
  }

  function cleanBuildingName(value, id, index) {
    var name = String(value || "").trim();
    if ((String(id || "") === "main" || index === 0) && isLegacyDefaultBuildingName(name)) {
      return "";
    }
    return name;
  }

  function displayBuildingName(building, fallback) {
    var name = building ? String(building.name || "").trim() : "";
    if (building && String(building.id || "") === "main" && isLegacyDefaultBuildingName(name)) {
      name = "";
    }
    return name || fallback || "";
  }

  function textValue(value) {
    return String(value === undefined || value === null ? "" : value).trim();
  }

  function normalizeLanguageTags(value) {
    var items = Array.isArray(value) ? value : String(value || "").split(/[,\s;|]+/);
    var normalized = [];
    items.forEach(function (item) {
      var tag = String(item || "")
        .trim()
        .replace(/_/g, "-")
        .toLowerCase();
      if (!tag || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,4}$/.test(tag)) {
        return;
      }
      if (normalized.indexOf(tag) === -1) {
        normalized.push(tag);
      }
    });
    return normalized.slice(0, 40);
  }

  function languageTagsText(value) {
    return normalizeLanguageTags(value).join(", ");
  }

  function boundaryIdentityValue(source, keys) {
    if (!source || typeof source !== "object") {
      return "";
    }
    var pools = [source];
    ["location", "webgis", "gis", "properties", "boundary", "boundaries"].forEach(function (key) {
      if (source[key] && typeof source[key] === "object") {
        pools.push(source[key]);
      }
    });
    ["adm0", "adm1", "adm2"].forEach(function (key) {
      if (source[key] && typeof source[key] === "object") {
        pools.push(source[key]);
      }
    });

    for (var poolIndex = 0; poolIndex < pools.length; poolIndex += 1) {
      var pool = pools[poolIndex];
      var lowerKeys = {};
      Object.keys(pool).forEach(function (key) {
        lowerKeys[String(key).toLowerCase()] = key;
      });
      for (var keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
        var wanted = String(keys[keyIndex]).toLowerCase();
        var actual = lowerKeys[wanted];
        if (!actual) {
          continue;
        }
        if (pool[actual] && typeof pool[actual] === "object") {
          continue;
        }
        var value = textValue(pool[actual]);
        if (value) {
          return value;
        }
      }
    }
    return "";
  }

  function admIdentityId(source, level) {
    var keyMap = {
      adm0: ["adm0Id", "adm0_id", "admin0Id", "admin0_id", "countryId", "country_id", "shapeGroup", "ISO_A3", "ISO3", "iso3", "countryCode3"],
      adm1: ["adm1Id", "adm1_id", "admin1Id", "admin1_id", "provinceId", "province_id", "regionId", "region_id", "shapeID", "shapeId", "shape_id", "GID_1", "HASC_1"],
      adm2: ["adm2Id", "adm2_id", "admin2Id", "admin2_id", "cityId", "city_id", "regencyId", "regency_id", "districtId", "district_id", "shapeID", "shapeId", "shape_id", "GID_2", "HASC_2"]
    };
    return boundaryIdentityValue(source, keyMap[level] || []);
  }

  function admIdentityName(source, level) {
    var keyMap = {
      adm0: ["adm0", "country", "NAME_LONG", "country_name", "NAME_0", "shapeName", "name"],
      adm1: ["adm1", "province", "region", "state", "NAME_1", "shapeName", "name"],
      adm2: ["adm2", "city", "regency", "district", "county", "NAME_2", "shapeName", "name"]
    };
    return boundaryIdentityValue(source, keyMap[level] || []);
  }

  function samePriceAreaSelection(saved, draft) {
    var savedArea = saved || {};
    var draftArea = draft || {};
    return normalizePriceCountryCode(savedArea.country, savedArea.countryCode) === normalizePriceCountryCode(draftArea.country, draftArea.countryCode) &&
      presetValueMatches(savedArea.province || savedArea.adm1, draftArea.province || draftArea.adm1) &&
      presetValueMatches(savedArea.city || savedArea.adm2, draftArea.city || draftArea.adm2);
  }

  function buildingTypeLabel(value, fallback) {
    var key = textValue(value);
    return BUILDING_TYPE_LABELS[key] || fallback || key;
  }

  function countryDisplayNames() {
    if (priceCountryDisplayNames !== null) {
      return priceCountryDisplayNames;
    }
    priceCountryDisplayNames = false;
    try {
      if (window.Intl && typeof window.Intl.DisplayNames === "function") {
        priceCountryDisplayNames = new window.Intl.DisplayNames(["id", "en"], { type: "region" });
      }
    } catch (error) {
      priceCountryDisplayNames = false;
    }
    return priceCountryDisplayNames;
  }

  function countryEnglishDisplayNames() {
    if (priceCountryEnglishDisplayNames !== null) {
      return priceCountryEnglishDisplayNames;
    }
    priceCountryEnglishDisplayNames = false;
    try {
      if (window.Intl && typeof window.Intl.DisplayNames === "function") {
        priceCountryEnglishDisplayNames = new window.Intl.DisplayNames(["en"], { type: "region" });
      }
    } catch (error) {
      priceCountryEnglishDisplayNames = false;
    }
    return priceCountryEnglishDisplayNames;
  }

  function countryNameForCode(code) {
    var normalized = String(code || "").trim().toUpperCase();
    if (!normalized) {
      return "";
    }
    if (PRICE_COUNTRY_NAME_OVERRIDES[normalized]) {
      return PRICE_COUNTRY_NAME_OVERRIDES[normalized];
    }
    var displayNames = countryDisplayNames();
    if (displayNames) {
      try {
        return displayNames.of(normalized) || normalized;
      } catch (error) {
        return normalized;
      }
    }
    return normalized;
  }

  function countryEnglishNameForCode(code) {
    var normalized = String(code || "").trim().toUpperCase();
    if (!normalized) {
      return "";
    }
    var displayNames = countryEnglishDisplayNames();
    if (displayNames) {
      try {
        return displayNames.of(normalized) || normalized;
      } catch (error) {
        return normalized;
      }
    }
    return normalized;
  }

  function priceCountryDefaultLanguages(code) {
    var normalized = String(code || "").trim().toUpperCase();
    return Array.isArray(PRICE_COUNTRY_DEFAULT_LANGUAGES[normalized])
      ? PRICE_COUNTRY_DEFAULT_LANGUAGES[normalized].slice()
      : [];
  }

  function priceCountryOptions() {
    if (priceCountryOptionCache) {
      return priceCountryOptionCache;
    }
    priceCountryOptionCache = PRICE_COUNTRY_CODES.map(function (code) {
      return {
        code: code,
        label: countryNameForCode(code)
      };
    }).sort(function (left, right) {
      return left.label.localeCompare(right.label, "id-ID");
    });
    return priceCountryOptionCache;
  }

  function normalizePriceCountryCode(country, countryCode) {
    var code = String(countryCode || "").trim().toUpperCase().slice(0, 2);
    if (PRICE_COUNTRY_CODES.indexOf(code) !== -1) {
      return code;
    }
    var countryKey = slugify(country);
    if (PRICE_COUNTRY_ALIASES[countryKey]) {
      return PRICE_COUNTRY_ALIASES[countryKey];
    }
    var options = priceCountryOptions();
    for (var index = 0; index < options.length; index += 1) {
      if (slugify(options[index].label) === countryKey ||
          slugify(countryNameForCode(options[index].code)) === countryKey ||
          slugify(countryEnglishNameForCode(options[index].code)) === countryKey) {
        return options[index].code;
      }
    }
    return "";
  }

  function looksLikeIndonesiaPricing(area) {
    var source = area && typeof area === "object" ? area : {};
    var text = [
      source.country,
      source.countryCode,
      source.province,
      source.city,
      source.fuelRegion,
      source.electricityRegion,
      source.telecomRegion,
      source.waterRegion,
      source.provider,
      source.notes
    ].filter(Boolean).join(" ").toLowerCase();
    return /indonesia|\bid\b|diy|jawa|yogyakarta|sleman|pdam|pln|pertamina|biznet|indihome|telkomsel|myrepublic|smartfren|xl|im3|tirta/.test(text);
  }

  function legacyDefaultPriceArea(area) {
    var source = area && typeof area === "object" ? area : {};
    if (textValue(source.updatedAt || source.savedAt || source.userSavedAt)) {
      return false;
    }
    var code = normalizePriceCountryCode(source.country, source.countryCode || source.country_code);
    var country = textValue(source.country);
    var fuelRegion = textValue(source.fuelRegion || source.fuel_region);
    var electricityRegion = textValue(source.electricityRegion || source.electricity_region);
    var telecomRegion = textValue(source.telecomRegion || source.telecom_region);
    return (code === "ID" || /^indonesia$/i.test(country)) &&
      !textValue(source.province || source.region) &&
      !textValue(source.city || source.regency) &&
      (fuelRegion === "" || fuelRegion === "DIY / Jawa Tengah") &&
      (electricityRegion === "" || electricityRegion === "Nasional PLN") &&
      (telecomRegion === "" || telecomRegion === "Cek area alamat building") &&
      !textValue(source.waterRegion || source.water_region) &&
      !textValue(source.notes);
  }

  function staleSeededLegacyNationalPriceArea(area) {
    var source = area && typeof area === "object" ? area : {};
    var code = normalizePriceCountryCode(source.country, source.countryCode || source.country_code);
    var country = textValue(source.country || source.adm0);
    var province = textValue(source.province || source.adm1 || source.region);
    var city = textValue(source.city || source.adm2 || source.regency);
    var fuelRegion = textValue(source.fuelRegion || source.fuel_region);
    var electricityRegion = textValue(source.electricityRegion || source.electricity_region);
    var telecomRegion = textValue(source.telecomRegion || source.telecom_region);
    var waterRegion = textValue(source.waterRegion || source.water_region);
    var genericProvince = province === "" || province === "Nasional" || province === "Nasional / seluruh negara";
    var genericCity = city === "" || city === "Nasional" || city === "Seluruh negara";
    var countryLower = country.toLowerCase();
    var genericRegions = [fuelRegion, electricityRegion, telecomRegion, waterRegion].every(function (value) {
      var normalized = value.toLowerCase();
      return normalized === "" || normalized === countryLower || normalized === ("nasional " + countryLower);
    });
    return code === "MY" && genericProvince && genericCity && genericRegions;
  }

  function normalizePriceAreaCountry(area) {
    var source = Object.assign({}, area && typeof area === "object" ? area : {});
    if (legacyDefaultPriceArea(source) || staleSeededLegacyNationalPriceArea(source)) {
      source.country = "";
      source.countryCode = "";
      source.adm0 = "";
      source.adm1 = "";
      source.adm2 = "";
      source.adm0Id = "";
      source.adm1Id = "";
      source.adm2Id = "";
      source.province = "";
      source.city = "";
      source.fuelRegion = "";
      source.electricityRegion = "";
      source.telecomRegion = "";
      source.waterRegion = "";
      source.languages = [];
      source.notes = "";
      return source;
    }
    var code = normalizePriceCountryCode(source.country, source.countryCode || source.country_code);
    if (looksLikeIndonesiaPricing(source) && code !== "ID") {
      if (!textValue(source.province || source.region) || !textValue(source.city || source.regency)) {
        source.country = "";
        source.countryCode = "";
        source.adm0 = "";
        source.adm1 = "";
        source.adm2 = "";
        source.adm0Id = "";
        source.adm1Id = "";
        source.adm2Id = "";
        source.province = "";
        source.city = "";
        source.fuelRegion = "";
        source.electricityRegion = "";
        source.telecomRegion = "";
        source.waterRegion = "";
        source.languages = [];
        source.notes = "";
        return source;
      }
      code = "ID";
    }
    source.countryCode = code;
    source.country = code ? countryNameForCode(code) : "";
    source.adm0 = textValue(source.adm0) || source.country;
    source.adm1 = textValue(source.adm1) || textValue(source.province || source.region);
    source.adm2 = textValue(source.adm2) || textValue(source.city || source.regency);
    source.adm0Id = textValue(source.adm0Id || source.adm0_id);
    source.adm1Id = textValue(source.adm1Id || source.adm1_id);
    source.adm2Id = textValue(source.adm2Id || source.adm2_id);
    source.languages = normalizeLanguageTags(source.languages || source.languageCodes || source.sourceLanguages || source.language || "");
    return source;
  }

  function genericPriceRegionPreset(countryCode) {
    var country = countryNameForCode(countryCode) || "Negara";
    return {
      supported: false,
      provinces: [
        {
          value: "Nasional",
          label: "Nasional / seluruh negara",
          fuelRegion: "Nasional " + country,
          electricityRegion: "Nasional " + country,
          telecomRegion: "Nasional " + country,
          waterRegion: "Nasional " + country,
          cities: [
            {
              value: "Nasional",
              label: "Seluruh negara",
              fuelRegion: "Nasional " + country,
              electricityRegion: "Nasional " + country,
              telecomRegion: "Nasional " + country,
              waterRegion: "Nasional " + country
            }
          ]
        }
      ]
    };
  }

  function priceRegionPreset(countryCode) {
    var code = String(countryCode || "").trim().toUpperCase();
    return PRICE_REGION_PRESETS[code] || genericPriceRegionPreset(code);
  }

  function presetValueMatches(left, right) {
    return textValue(left) === textValue(right) || slugify(left) === slugify(right);
  }

  function findProvincePreset(countryCode, value) {
    var provinces = priceRegionPreset(countryCode).provinces || [];
    return provinces.find(function (province) {
      return presetValueMatches(province.value, value) || presetValueMatches(province.label, value);
    }) || null;
  }

  function findCityPreset(provincePreset, value) {
    var cities = provincePreset && Array.isArray(provincePreset.cities) ? provincePreset.cities : [];
    return cities.find(function (city) {
      return presetValueMatches(city.value, value) || presetValueMatches(city.label, value);
    }) || null;
  }

  function priceAreaValidationMessage(area) {
    var source = normalizePriceAreaCountry(area || priceArea());
    if (!source.country || !source.countryCode) {
      return "Pilih negara harga dulu.";
    }
    return "";
  }

  function priceAreaReady(area) {
    return priceAreaValidationMessage(area) === "";
  }

  function energyPriceAreaValidationMessage(area) {
    var source = normalizePriceAreaCountry(area || priceArea());
    var countryMessage = priceAreaValidationMessage(source);
    if (countryMessage) {
      return countryMessage;
    }
    if (String(source.countryCode || "").toUpperCase() === "US" && !textValue(source.adm1 || source.province || "")) {
      return "Pilih negara bagian Amerika Serikat agar harga lokal, provider air, dan pembangkit tidak tercampur antar-state.";
    }
    return "";
  }

  function energyPriceAreaReady(area) {
    return energyPriceAreaValidationMessage(area) === "";
  }

  function webgisKeyFromParts(mosqueId, locationId, name) {
    if (mosqueId) {
      return "webgis-mosque-" + slugify(mosqueId);
    }
    if (locationId) {
      return "webgis-location-" + slugify(locationId);
    }
    return "webgis-" + (slugify(name) || "building");
  }

  function normalizeWebgisRecord(record) {
    var source = record && typeof record === "object" ? record : {};
    var mosqueId = textValue(source.mosque_id || source.mosqueId || source.id || "");
    var locationId = textValue(source.location_id || source.locationId || "");
    var name = textValue(source.building_name || source.mosque_name || source.name || "");
    var type = textValue(source.building_type || source.type || "");
    var typeLabel = textValue(source.building_type_label || source.typeLabel || source.type_label || "");
    var officialAddress = textValue(source.official_address || source.officialAddress || source.address || "");
    var additionalInfo = textValue(source.additional_info || source.additionalInfo || "");
    var latitude = optionalNumber(source.latitude);
    var longitude = optionalNumber(source.longitude);
    var key = webgisKeyFromParts(mosqueId, locationId, name);
    return {
      key: key,
      buildingId: key.replace(/^webgis-/, ""),
      mosqueId: mosqueId,
      locationId: locationId,
      name: name,
      type: type,
      typeLabel: typeLabel,
      officialAddress: officialAddress,
      additionalInfo: additionalInfo,
      country: admIdentityName(source, "adm0"),
      countryCode: textValue(source.countryCode || source.country_code || source.iso2 || ""),
      adm0: admIdentityName(source, "adm0"),
      adm1: admIdentityName(source, "adm1"),
      adm2: admIdentityName(source, "adm2"),
      adm0Id: admIdentityId(source, "adm0"),
      adm1Id: admIdentityId(source, "adm1"),
      adm2Id: admIdentityId(source, "adm2"),
      province: textValue(source.province || admIdentityName(source, "adm1")),
      city: textValue(source.city || admIdentityName(source, "adm2")),
      timezone: textValue(source.timezone || ""),
      latitude: latitude,
      longitude: longitude,
      iconPath: textValue(source.icon_path || source.iconPath || ""),
      historyId: textValue(source.history_id || source.historyId || ""),
      historySavedAt: textValue(source.history_saved_at || source.historySavedAt || source.updated_at || source.updatedAt || source.created_at || source.createdAt || "")
    };
  }

  function normalizeWebgisMeta(meta) {
    var source = meta && typeof meta === "object" ? meta : {};
    return {
      key: textValue(source.key || ""),
      mosqueId: textValue(source.mosqueId || source.mosque_id || ""),
      locationId: textValue(source.locationId || source.location_id || ""),
      name: textValue(source.name || source.buildingName || source.mosque_name || ""),
      type: textValue(source.type || source.building_type || ""),
      typeLabel: textValue(source.typeLabel || source.building_type_label || ""),
      officialAddress: textValue(source.officialAddress || source.official_address || ""),
      additionalInfo: textValue(source.additionalInfo || source.additional_info || ""),
      country: admIdentityName(source, "adm0"),
      countryCode: textValue(source.countryCode || source.country_code || source.iso2 || ""),
      adm0: admIdentityName(source, "adm0"),
      adm1: admIdentityName(source, "adm1"),
      adm2: admIdentityName(source, "adm2"),
      adm0Id: admIdentityId(source, "adm0"),
      adm1Id: admIdentityId(source, "adm1"),
      adm2Id: admIdentityId(source, "adm2"),
      province: textValue(source.province || admIdentityName(source, "adm1")),
      city: textValue(source.city || admIdentityName(source, "adm2")),
      timezone: textValue(source.timezone || ""),
      latitude: optionalNumber(source.latitude),
      longitude: optionalNumber(source.longitude),
      importedAt: textValue(source.importedAt || source.imported_at || "")
    };
  }

  function webgisMetaFromRecord(record) {
    return normalizeWebgisMeta(Object.assign({}, record, {
      importedAt: new Date().toISOString()
    }));
  }

  function codeFromName(value, fallback) {
    var words = String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (!words.length) {
      return fallback || "BLD";
    }
    var code = words.slice(0, 3).map(function (word) {
      return word.charAt(0);
    }).join("");
    return (code || fallback || "BLD").slice(0, 5);
  }

  function scopePrefix() {
    var building = state.data && state.data.buildings ? activeBuilding() : null;
    var buildingName = displayBuildingName(building, "");
    return buildingName ? codeFromName(buildingName, "SITE") : "SITE";
  }

  function uid(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function humanizeHashName(value) {
    var decoded = "";
    try {
      decoded = decodeURIComponent(String(value || ""));
    } catch (error) {
      decoded = String(value || "");
    }
    decoded = decoded.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    if (!decoded) {
      return "";
    }
    return decoded.replace(/\b([a-z])/g, function (match) {
      return match.toUpperCase();
    });
  }

  function routeBuildingFromHash(hashValue) {
    var raw = String(hashValue !== undefined ? hashValue : window.location.hash || "")
      .replace(/^#/, "")
      .replace(/^\/+/, "")
      .trim();
    if (!raw) {
      return null;
    }
    var decoded = "";
    try {
      decoded = decodeURIComponent(raw);
    } catch (error) {
      decoded = raw;
    }
    decoded = decoded.replace(/^\/+/, "").trim();
    if (!decoded) {
      return null;
    }
    var namePart = "";
    var idPart = "";
    var explicitIndex = decoded.indexOf("-*");
    if (explicitIndex > 0) {
      namePart = decoded.slice(0, explicitIndex);
      idPart = decoded.slice(explicitIndex + 2);
    } else {
      var separatorIndex = decoded.lastIndexOf("-");
      if (separatorIndex > 0 && separatorIndex < decoded.length - 1) {
        namePart = decoded.slice(0, separatorIndex);
        idPart = decoded.slice(separatorIndex + 1);
      } else {
        namePart = decoded;
        idPart = decoded;
      }
    }
    idPart = String(idPart || "").replace(/^\*/, "");
    var id = slugify(idPart) || slugify(namePart);
    if (!id) {
      return null;
    }
    return {
      id: id.slice(0, 80),
      name: humanizeHashName(namePart || idPart) || id,
      raw: decoded
    };
  }

  function buildingHash(building) {
    if (!building) {
      return "";
    }
    return "#" + (slugify(building.name) || "building") + "-*" + (slugify(building.id) || building.id);
  }

  function replaceBuildingHash(building) {
    var nextHash = buildingHash(building);
    if (!nextHash || window.location.hash === nextHash) {
      return;
    }
    state.suppressHashApply = true;
    if (window.history && typeof window.history.replaceState === "function") {
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search + nextHash);
      state.suppressHashApply = false;
    } else {
      window.location.hash = nextHash;
      window.setTimeout(function () {
        state.suppressHashApply = false;
      }, 0);
    }
  }

  function todayValue() {
    return new Date().toISOString().slice(0, 10);
  }

  function datetimeLocalValue(value) {
    var date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      date = new Date();
    }
    var offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function isoFromLocal(value) {
    if (!value) {
      return "";
    }
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function formatNumber(value, digits) {
    return new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: digits === undefined ? 2 : digits
    }).format(toNumber(value, 0));
  }

  function formatNullableNumber(value, digits) {
    return value === null || value === undefined || value === "" ? "-" : formatNumber(value, digits);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(toNumber(value, 0));
  }

  function formatMoney(value, currency) {
    var code = String(currency || "").trim().toUpperCase();
    if (!code) {
      return formatNumber(value, 2);
    }
    try {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: code,
        maximumFractionDigits: ["BHD", "JOD", "KWD", "OMR", "TND"].indexOf(code) !== -1 ? 3 : 2
      }).format(toNumber(value, 0));
    } catch (error) {
      return code + " " + formatNumber(value, 2);
    }
  }

  function meterKindLabel(value) {
    return METER_KIND_LABELS[value] || "KWH meter";
  }

  function powerCapacityClass(value) {
    var va = Math.round(toNumber(value, 0));
    return POWER_CAPACITY_OPTIONS.indexOf(va) !== -1 ? String(va) : "custom";
  }

  function powerCapacityLabel(value) {
    var va = Math.round(toNumber(value, 0));
    var detail = POWER_CAPACITY_DETAILS.find(function (item) {
      return Number(item.va) === va;
    });
    return detail && detail.label ? detail.label : (va > 0 ? formatNumber(va, 0) + " VA" : "Kapasitas belum diisi");
  }

  function normalizeModel(raw) {
    var model = raw && typeof raw === "object" ? raw : {};
    return {
      brand: String(model.brand || model.brandName || ""),
      model: String(model.model || model.modelName || ""),
      series: String(model.series || model.seriesName || ""),
      capacityLabel: String(model.capacityLabel || model.capacity || model.storageCapacity || model.storage || model.channels || ""),
      claimPowerWatts: toNumber(model.claimPowerWatts !== undefined ? model.claimPowerWatts : model.claim_power_watts, null),
      btuPerHour: toNumber(model.btuPerHour !== undefined ? model.btuPerHour : model.btu_per_hour, null),
      pk: toNumber(model.pk !== undefined ? model.pk : model.pkRating, null),
      fuelType: String(model.fuelType || model.fuel_type || model.defaultFuel || model.default_fuel || ""),
      coolingSystem: String(model.coolingSystem || model.cooling_system || "")
    };
  }

  function normalizeCatalogPayload(payload) {
    var root = payload && payload.data && typeof payload.data === "object" ? payload.data : payload;
    var categories = root && Array.isArray(root.assetCategories) ? root.assetCategories : [];
    if (!categories.length) {
      return null;
    }

    var catalog = {};
    categories.forEach(function (category) {
      var name = String(category.name || category.categoryName || "").trim();
      if (!name) {
        return;
      }
      catalog[name] = {
        key: String(category.key || category.categoryKey || slugify(name)),
        prefix: String(category.prefix || category.assetCodePrefix || "AST"),
        isElectric: category.isElectric !== false,
        subtypes: (Array.isArray(category.types) ? category.types : []).map(function (type) {
          return {
            key: String(type.key || type.typeKey || slugify(type.name)),
            name: String(type.name || type.typeName || ""),
            watts: toNumber(type.defaultPowerWatts !== undefined ? type.defaultPowerWatts : type.watts, 0),
            btu: toNumber(type.btuPerHour !== undefined ? type.btuPerHour : type.btu, 0),
            pk: toNumber(type.pk !== undefined ? type.pk : type.pkRating, 0),
            wheels: type.wheels !== undefined || type.wheelCount !== undefined ? toNumber(type.wheels !== undefined ? type.wheels : type.wheelCount, null) : undefined,
            vehicleKind: String(type.vehicleKind || type.vehicle_type || ""),
            fuelType: String(type.fuelType || type.fuel_type || type.defaultFuel || type.default_fuel || ""),
            coolingSystem: String(type.coolingSystem || type.cooling_system || ""),
            capacityLabel: String(type.capacityLabel || type.capacity || type.storageCapacity || ""),
            models: (Array.isArray(type.models) ? type.models : []).map(normalizeModel).filter(function (model) {
              return model.brand || model.model || model.series;
            })
          };
        }).filter(function (type) {
          return type.name;
        })
      };
    });

    if (root && Array.isArray(root.meterTypes) && root.meterTypes.length) {
      METER_KIND_LABELS = {};
      root.meterTypes.forEach(function (item) {
        if (item && item.key) {
          METER_KIND_LABELS[String(item.key)] = String(item.label || item.name || item.key);
        }
      });
    }

    if (root && Array.isArray(root.powerCapacities) && root.powerCapacities.length) {
      POWER_CAPACITY_DETAILS = root.powerCapacities.map(function (item) {
        return {
          va: Math.round(toNumber(item.va !== undefined ? item.va : item.capacityVa, 0)),
          phase: String(item.phase || item.phaseKey || "1-phase"),
          label: String(item.label || item.capacityLabel || "")
        };
      }).filter(function (item) {
        return item.va > 0;
      });
      POWER_CAPACITY_OPTIONS = POWER_CAPACITY_DETAILS.map(function (item) {
        return item.va;
      });
    }

    return Object.keys(catalog).length ? catalog : null;
  }

  function applyCatalogPayload(payload, source) {
    var catalog = normalizeCatalogPayload(payload);
    if (!catalog) {
      return false;
    }
    ASSET_CATALOG = catalog;
    Object.keys(LOCAL_CATALOG_ENTRIES).forEach(function (category) {
      if (!ASSET_CATALOG[category] && LOCAL_CATALOG_ENTRIES[category]) {
        ASSET_CATALOG[category] = LOCAL_CATALOG_ENTRIES[category];
      }
    });
    catalogSource = source || (payload && payload.source) || "catalog";
    return true;
  }

  function fetchCatalog(url) {
    if (!window.fetch) {
      return Promise.reject(new Error("fetch unavailable"));
    }

    return window.fetch(url, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Catalog request failed");
      }
      return response.json();
    });
  }

  function loadCatalog() {
    return fetchCatalog(CATALOG_ENDPOINTS[0]).then(function (payload) {
      if (!applyCatalogPayload(payload, payload.source || "sql-api")) {
        throw new Error("Catalog API payload is empty");
      }
    }).catch(function () {
      return fetchCatalog(CATALOG_ENDPOINTS[1]).then(function (payload) {
        applyCatalogPayload(payload, payload.source || "json-fallback");
      }).catch(function () {
        catalogSource = "embedded-fallback";
      });
    });
  }

  function catalogSourceLabel() {
    if (catalogSource === "sql" || catalogSource === "sql-api") {
      return "SQL";
    }
    if (catalogSource === "json-fallback") {
      return "JSON offline";
    }
    return "fallback lokal";
  }

  function priceArea() {
    var building = state.data ? activeBuilding() : null;
    return building && building.priceArea ? building.priceArea : {};
  }

  function priceAreaForRequest() {
    if (!refs.priceRegionForm || !refs.priceCountryInput) {
      return priceArea();
    }
    var code = refs.priceCountryInput.value;
    var parts = selectedPriceRegionParts();
    var savedArea = normalizePriceAreaCountry(priceArea());
    var provinceMeta = selectedOptionMeta(refs.priceProvinceInput);
    var cityMeta = selectedOptionMeta(refs.priceCityInput);
    var selectedLanguages = refs.priceRegionLanguagesInput
      ? normalizeLanguageTags(refs.priceRegionLanguagesInput.value)
      : [];
    if (!selectedLanguages.length) {
      selectedLanguages = priceCountryDefaultLanguages(code);
    }
    var draftArea = {
      country: code ? countryNameForCode(code) : "",
      countryCode: code,
      adm0: code ? countryNameForCode(code) : "",
      adm1: refs.priceProvinceInput.value,
      adm2: refs.priceCityInput.value,
      adm0Id: provinceMeta.adm0Id || cityMeta.adm0Id || "",
      adm1Id: provinceMeta.admId || "",
      adm2Id: cityMeta.admId || "",
      province: refs.priceProvinceInput.value,
      city: refs.priceCityInput.value,
      languages: selectedLanguages,
      fuelRegion: refs.fuelPriceRegionInput.value || parts.fuelRegion || "",
      electricityRegion: refs.electricityPriceRegionInput.value || parts.electricityRegion || "",
      telecomRegion: refs.telecomPriceRegionInput.value || parts.telecomRegion || "",
      waterRegion: refs.waterPriceRegionInput.value || parts.waterRegion || "",
      notes: refs.priceRegionNotesInput ? refs.priceRegionNotesInput.value : ""
    };
    if (samePriceAreaSelection(savedArea, draftArea)) {
      draftArea.adm0Id = draftArea.adm0Id || savedArea.adm0Id || "";
      draftArea.adm1Id = draftArea.adm1Id || savedArea.adm1Id || "";
      draftArea.adm2Id = draftArea.adm2Id || savedArea.adm2Id || "";
    }
    return normalizePriceAreaCountry(draftArea);
  }

  function priceAreaSummary(area) {
    var source = area || priceArea();
    return [
      source.country || "",
      source.province || "",
      source.city || ""
    ].filter(Boolean).join(" - ") || "Belum dipilih";
  }

  function priceScopeLabel(item, fallbackKey) {
    var area = item && typeof item === "object" ? item : {};
    if (String(area.country || "").toLowerCase() === "global") {
      return area.region || area.priceRegion || "Global";
    }
    return [
      area.country || "",
      area.region || area.priceRegion || area[fallbackKey || ""] || area.province || "",
      area.city || ""
    ].filter(Boolean).join(" - ") || priceAreaSummary();
  }

  function energyPriceRequestScopeKey(area) {
    var source = normalizePriceAreaCountry(area || priceAreaForRequest());
    return [
      source.countryCode || "",
      source.adm0Id || source.adm0 || source.country || "",
      source.adm1Id || source.adm1 || source.province || "",
      source.adm2Id || source.adm2 || source.city || "",
      source.fuelRegion || "",
      source.electricityRegion || "",
      source.telecomRegion || "",
      source.waterRegion || "",
      Array.isArray(source.languages) ? source.languages.join(",") : ""
    ].join("|");
  }

  function invalidateEnergyPriceRequests() {
    state.energyPriceRequestSerial += 1;
    state.energyPriceRequestKey = "";
    state.energyPricePromise = null;
    state.energyPricesLoading = false;
    state.electricityGenerationProfile = null;
    state.electricityGenerationLoading = false;
    state.electricityGenerationError = "";
    state.electricityGenerationRequestKey = "";
    state.electricityGenerationPromise = null;
    state.usFuelProviderCatalog = null;
    state.usFuelProviderLoading = false;
    state.usFuelProviderError = "";
    state.usFuelProviderRequestKey = "";
    state.usFuelProviderPromise = null;
    state.usWaterProviderCatalog = null;
    state.usWaterProviderLoading = false;
    state.usWaterProviderError = "";
    state.usWaterProviderRequestKey = "";
    state.usWaterProviderPromise = null;
    state.usWaterTariffHierarchy = null;
    state.usWaterTariffHierarchyLoading = false;
    state.usWaterTariffHierarchyError = "";
    state.usWaterTariffHierarchyRequestKey = "";
    state.usWaterTariffHierarchyPromise = null;
    state.usMobileOperatorCatalog = null;
    state.usMobileOperatorLoading = false;
    state.usMobileOperatorError = "";
    state.usMobileOperatorRequestKey = "";
    state.usMobileOperatorPromise = null;
  }

  function energyPriceRequestIsCurrent(serial, requestKey) {
    return serial === state.energyPriceRequestSerial &&
      requestKey === state.energyPriceRequestKey &&
      requestKey === energyPriceRequestScopeKey(priceAreaForRequest());
  }

  function energyPriceUrl(requestArea) {
    var area = normalizePriceAreaCountry(requestArea || priceAreaForRequest());
    var params = new URLSearchParams();
    [
      ["country", area.country || ""],
      ["countryCode", area.countryCode || ""],
      ["adm0", area.adm0 || area.country || ""],
      ["adm1", area.adm1 || area.province || ""],
      ["adm2", area.adm2 || area.city || ""],
      ["adm0Id", area.adm0Id || ""],
      ["adm1Id", area.adm1Id || ""],
      ["adm2Id", area.adm2Id || ""],
      ["province", area.province || ""],
      ["city", area.city || ""],
      ["languages", Array.isArray(area.languages) ? area.languages.join(",") : ""],
      ["fuelRegion", area.fuelRegion || ""],
      ["electricityRegion", area.electricityRegion || ""],
      ["telecomRegion", area.telecomRegion || ""],
      ["waterRegion", area.waterRegion || ""]
    ].forEach(function (pair) {
      if (pair[1]) {
        params.set(pair[0], pair[1]);
      }
    });
    var query = params.toString();
    return query ? ENERGY_PRICE_ENDPOINT + "?" + query : ENERGY_PRICE_ENDPOINT;
  }

  function usElectricityGenerationUrl(requestArea, force) {
    var area = normalizePriceAreaCountry(requestArea || priceAreaForRequest());
    var params = new URLSearchParams();
    [
      ["country", area.country || ""],
      ["countryCode", area.countryCode || ""],
      ["adm1", area.adm1 || area.province || ""],
      ["province", area.province || area.adm1 || ""],
      ["refresh", force ? "1" : ""]
    ].forEach(function (pair) {
      if (pair[1]) {
        params.set(pair[0], pair[1]);
      }
    });
    return US_ELECTRICITY_GENERATION_ENDPOINT + "?" + params.toString();
  }

  function usFuelProviderCatalogUrl(requestArea) {
    var area = normalizePriceAreaCountry(requestArea || priceAreaForRequest());
    var params = new URLSearchParams();
    [["country", area.country || ""], ["countryCode", area.countryCode || ""], ["adm1", area.adm1 || area.province || ""]].forEach(function (pair) {
      if (pair[1]) {
        params.set(pair[0], pair[1]);
      }
    });
    return US_FUEL_PROVIDER_CATALOG_ENDPOINT + "?" + params.toString();
  }

  function usWaterProviderCatalogUrl(requestArea, force) {
    var area = normalizePriceAreaCountry(requestArea || priceAreaForRequest());
    var params = new URLSearchParams();
    [["country", area.country || ""], ["countryCode", area.countryCode || ""], ["adm1", area.adm1 || area.province || ""], ["refresh", force ? "1" : ""]].forEach(function (pair) {
      if (pair[1]) {
        params.set(pair[0], pair[1]);
      }
    });
    return US_WATER_PROVIDER_CATALOG_ENDPOINT + "?" + params.toString();
  }

  function usWaterTariffHierarchyUrl(requestArea) {
    var area = normalizePriceAreaCountry(requestArea || priceAreaForRequest());
    var params = new URLSearchParams();
    var stateCode = /^[A-Za-z]{2}$/.test(String(area.adm1Code || "").trim()) ? String(area.adm1Code).toUpperCase() : "";
    [["country", area.country || ""], ["countryCode", area.countryCode || ""], ["adm1", area.adm1 || area.province || ""], ["adm1Code", stateCode]].forEach(function (pair) {
      if (pair[1]) {
        params.set(pair[0], pair[1]);
      }
    });
    return US_WATER_TARIFF_HIERARCHY_ENDPOINT + "?" + params.toString();
  }

  function usMobileOperatorCatalogUrl(requestArea, force) {
    var area = normalizePriceAreaCountry(requestArea || priceAreaForRequest());
    var params = new URLSearchParams();
    var stateCode = /^[A-Za-z]{2}$/.test(String(area.adm1Code || "").trim()) ? String(area.adm1Code).toUpperCase() : "";
    [["country", area.country || ""], ["countryCode", area.countryCode || ""], ["adm1", area.adm1 || area.province || ""], ["adm1Code", stateCode], ["refresh", force ? "1" : ""]].forEach(function (pair) {
      if (pair[1]) {
        params.set(pair[0], pair[1]);
      }
    });
    return US_MOBILE_OPERATOR_CATALOG_ENDPOINT + "?" + params.toString();
  }

  function normalizeGlobalUtilityCategory(value) {
    var normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    var aliases = {
      fixed_internet: "internet",
      fixed_broadband: "internet",
      mobile_internet: "mobile",
      mobile_broadband: "mobile"
    };
    normalized = aliases[normalized] || normalized;
    return ["fuel", "electricity", "water", "internet", "mobile"].indexOf(normalized) !== -1
      ? normalized
      : "";
  }

  function globalDiscoveryCategory() {
    return normalizeGlobalUtilityCategory(refs.globalDiscoveryCategoryInput ? refs.globalDiscoveryCategoryInput.value : "");
  }

  function globalDiscoveryUsesAdmOverride() {
    return Boolean(refs.globalDiscoveryUseAdmInput && refs.globalDiscoveryUseAdmInput.checked);
  }

  function globalUtilityUrl(area, refresh, options) {
    var source = normalizePriceAreaCountry(area || priceAreaForRequest());
    var settings = options && typeof options === "object" ? options : {};
    var includeAdm = settings.includeAdm !== false;
    var autoDiscovery = settings.autoDiscovery === true;
    var category = normalizeGlobalUtilityCategory(settings.category || "");
    var params = new URLSearchParams();
    var pairs = [
      ["country", source.country || ""],
      ["countryCode", source.countryCode || ""],
      ["refresh", refresh ? "1" : ""],
      ["auto", !refresh && autoDiscovery ? "1" : ""],
      // Electricity alone can contain 50 states + DC across five sectors.
      // Keep the complete canonical record set so ADM1 filtering never has to
      // guess the scope of an Inspector row whose backing record was truncated.
      ["limit", "500"]
    ];
    if (category) {
      pairs.push(["category", category]);
    }
    if (settings.energyTableView === true) {
      pairs.push(["view", "energy_tables"]);
    }
    if (includeAdm) {
      pairs = pairs.concat([
        ["adm0", source.adm0 || source.country || ""],
        ["adm1", source.adm1 || source.province || ""],
        ["adm2", source.adm2 || source.city || ""],
        ["adm0Id", source.adm0Id || ""],
        ["adm1Id", source.adm1Id || ""],
        ["adm2Id", source.adm2Id || ""],
        ["province", source.province || ""],
        ["city", source.city || ""]
      ]);
    }
    pairs.forEach(function (pair) {
      if (pair[1]) {
        params.set(pair[0], pair[1]);
      }
    });
    var query = params.toString();
    return query ? GLOBAL_UTILITY_ENDPOINT + "?" + query : GLOBAL_UTILITY_ENDPOINT;
  }

  function fetchEnergyPrices(area) {
    if (!window.fetch) {
      return Promise.reject(new Error("fetch unavailable"));
    }

    return window.fetch(energyPriceUrl(area), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Energy price request failed");
      }
      return response.json();
    });
  }

  function loadUsElectricityGeneration(area, force, requestSerial, requestKey) {
    var normalized = normalizePriceAreaCountry(area || {});
    var countryCode = String(normalized.countryCode || "").toUpperCase();
    var adm1 = String(normalized.adm1 || normalized.province || "").trim();
    var profileKey = [countryCode, adm1].join("|");
    if (countryCode !== "US" || !adm1) {
      state.electricityGenerationProfile = null;
      state.electricityGenerationLoading = false;
      state.electricityGenerationError = countryCode === "US"
        ? "Pilih negara bagian Amerika Serikat."
        : "Profil jenis pembangkit ini tersedia untuk Amerika Serikat.";
      state.electricityGenerationRequestKey = profileKey;
      renderUsElectricityGeneration();
      return Promise.resolve();
    }
    if (!force && state.electricityGenerationProfile && state.electricityGenerationRequestKey === profileKey) {
      renderUsElectricityGeneration();
      return Promise.resolve();
    }
    if (state.electricityGenerationLoading && state.electricityGenerationRequestKey === profileKey) {
      return state.electricityGenerationPromise || Promise.resolve();
    }

    state.electricityGenerationLoading = true;
    state.electricityGenerationError = "";
    state.electricityGenerationRequestKey = profileKey;
    renderUsElectricityGeneration();
    var promise = window.fetch(usElectricityGenerationUrl(normalized, force), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Permintaan profil pembangkit EIA gagal");
      }
      return response.json();
    }).then(function (payload) {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.electricityGenerationRequestKey !== profileKey) {
        return;
      }
      if (!payload || payload.success === false) {
        throw new Error(payload && payload.error ? payload.error : "Payload profil pembangkit tidak valid");
      }
      state.electricityGenerationProfile = payload.data || payload;
      state.electricityGenerationError = "";
    }).catch(function (error) {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.electricityGenerationRequestKey !== profileKey) {
        return;
      }
      state.electricityGenerationProfile = null;
      state.electricityGenerationError = error && error.message ? error.message : "Profil pembangkit gagal dimuat";
    }).then(function () {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.electricityGenerationRequestKey !== profileKey) {
        return;
      }
      state.electricityGenerationLoading = false;
      state.electricityGenerationPromise = null;
      renderUsElectricityGeneration();
    });
    state.electricityGenerationPromise = promise;
    return promise;
  }

  function loadUsFuelProviderCatalog(area, requestSerial, requestKey) {
    var normalized = normalizePriceAreaCountry(area || {});
    var countryCode = String(normalized.countryCode || "").toUpperCase();
    var adm1 = String(normalized.adm1 || normalized.province || "").trim();
    var catalogKey = [countryCode, adm1].join("|");
    if (countryCode !== "US") {
      state.usFuelProviderCatalog = null;
      state.usFuelProviderLoading = false;
      state.usFuelProviderError = "Registry ini khusus provider BBM Amerika Serikat.";
      state.usFuelProviderRequestKey = catalogKey;
      renderUsFuelProviderCatalog();
      return Promise.resolve();
    }
    if (state.usFuelProviderCatalog && state.usFuelProviderRequestKey === catalogKey) {
      renderUsFuelProviderCatalog();
      return Promise.resolve();
    }
    state.usFuelProviderLoading = true;
    state.usFuelProviderError = "";
    state.usFuelProviderRequestKey = catalogKey;
    renderUsFuelProviderCatalog();
    var promise = window.fetch(usFuelProviderCatalogUrl(normalized), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Permintaan registry provider BBM gagal");
      }
      return response.json();
    }).then(function (payload) {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.usFuelProviderRequestKey !== catalogKey) {
        return;
      }
      state.usFuelProviderCatalog = payload && payload.success !== false ? (payload.data || payload) : null;
      state.usFuelProviderError = state.usFuelProviderCatalog ? "" : "Payload registry provider BBM tidak valid";
    }).catch(function (error) {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.usFuelProviderRequestKey !== catalogKey) {
        return;
      }
      state.usFuelProviderCatalog = null;
      state.usFuelProviderError = error && error.message ? error.message : "Registry provider BBM gagal dimuat";
    }).then(function () {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.usFuelProviderRequestKey !== catalogKey) {
        return;
      }
      state.usFuelProviderLoading = false;
      state.usFuelProviderPromise = null;
      renderUsFuelProviderCatalog();
    });
    state.usFuelProviderPromise = promise;
    return promise;
  }

  function loadUsWaterProviderCatalog(area, force, requestSerial, requestKey) {
    var normalized = normalizePriceAreaCountry(area || {});
    var countryCode = String(normalized.countryCode || "").toUpperCase();
    var adm1 = String(normalized.adm1 || normalized.province || "").trim();
    var catalogKey = [countryCode, adm1].join("|");
    if (countryCode !== "US" || !adm1) {
      state.usWaterProviderCatalog = null;
      state.usWaterProviderLoading = false;
      state.usWaterProviderError = countryCode === "US"
        ? "Pilih negara bagian Amerika Serikat."
        : "Registry perusahaan air ini khusus Amerika Serikat.";
      state.usWaterProviderRequestKey = catalogKey;
      renderUsWaterProviderCatalog();
      return Promise.resolve();
    }
    if (!force && state.usWaterProviderCatalog && state.usWaterProviderRequestKey === catalogKey) {
      renderUsWaterProviderCatalog();
      return Promise.resolve();
    }
    if (state.usWaterProviderLoading && state.usWaterProviderRequestKey === catalogKey) {
      return state.usWaterProviderPromise || Promise.resolve();
    }

    state.usWaterProviderLoading = true;
    state.usWaterProviderError = "";
    state.usWaterProviderRequestKey = catalogKey;
    renderUsWaterProviderCatalog();
    var promise = window.fetch(usWaterProviderCatalogUrl(normalized, force), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Permintaan registry perusahaan air EPA gagal");
      }
      return response.json();
    }).then(function (payload) {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.usWaterProviderRequestKey !== catalogKey) {
        return;
      }
      if (!payload || payload.success === false) {
        throw new Error(payload && payload.error ? payload.error : "Payload registry perusahaan air tidak valid");
      }
      state.usWaterProviderCatalog = payload.data || payload;
      state.usWaterProviderError = "";
    }).catch(function (error) {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.usWaterProviderRequestKey !== catalogKey) {
        return;
      }
      state.usWaterProviderCatalog = null;
      state.usWaterProviderError = error && error.message ? error.message : "Registry perusahaan air gagal dimuat";
    }).then(function () {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.usWaterProviderRequestKey !== catalogKey) {
        return;
      }
      state.usWaterProviderLoading = false;
      state.usWaterProviderPromise = null;
      renderUsWaterProviderCatalog();
    });
    state.usWaterProviderPromise = promise;
    return promise;
  }

  function loadUsWaterTariffHierarchy(area, requestSerial, requestKey) {
    var normalized = normalizePriceAreaCountry(area || {});
    var countryCode = String(normalized.countryCode || "").toUpperCase();
    var adm1 = String(normalized.adm1 || normalized.province || "").trim();
    var hierarchyKey = [countryCode, adm1].join("|");
    if (countryCode !== "US" || !adm1) {
      state.usWaterTariffHierarchy = null;
      state.usWaterTariffHierarchyLoading = false;
      state.usWaterTariffHierarchyError = countryCode === "US"
        ? "Pilih satu negara bagian Amerika Serikat."
        : "Hierarki tarif air ini khusus Amerika Serikat.";
      state.usWaterTariffHierarchyRequestKey = hierarchyKey;
      renderEnergyPrices();
      return Promise.resolve();
    }
    if (state.usWaterTariffHierarchy && state.usWaterTariffHierarchyRequestKey === hierarchyKey) {
      return Promise.resolve();
    }
    if (state.usWaterTariffHierarchyLoading && state.usWaterTariffHierarchyRequestKey === hierarchyKey) {
      return state.usWaterTariffHierarchyPromise || Promise.resolve();
    }
    state.usWaterTariffHierarchyLoading = true;
    state.usWaterTariffHierarchyError = "";
    state.usWaterTariffHierarchyRequestKey = hierarchyKey;
    var promise = window.fetch(usWaterTariffHierarchyUrl(normalized), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Permintaan hierarki tarif air terverifikasi gagal");
      }
      return response.json();
    }).then(function (payload) {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.usWaterTariffHierarchyRequestKey !== hierarchyKey) {
        return;
      }
      if (!payload || payload.success === false) {
        throw new Error(payload && (payload.reason || payload.error) ? (payload.reason || payload.error) : "Payload hierarki tarif air tidak valid");
      }
      state.usWaterTariffHierarchy = payload.data || payload;
      state.usWaterTariffHierarchyError = "";
    }).catch(function (error) {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.usWaterTariffHierarchyRequestKey !== hierarchyKey) {
        return;
      }
      state.usWaterTariffHierarchy = null;
      state.usWaterTariffHierarchyError = error && error.message ? error.message : "Hierarki tarif air gagal dimuat";
    }).then(function () {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.usWaterTariffHierarchyRequestKey !== hierarchyKey) {
        return;
      }
      state.usWaterTariffHierarchyLoading = false;
      state.usWaterTariffHierarchyPromise = null;
      renderEnergyPrices();
    });
    state.usWaterTariffHierarchyPromise = promise;
    return promise;
  }

  function loadUsMobileOperatorCatalog(area, force, requestSerial, requestKey) {
    var normalized = normalizePriceAreaCountry(area || {});
    var countryCode = String(normalized.countryCode || "").toUpperCase();
    var adm1 = String(normalized.adm1 || normalized.province || "").trim();
    var catalogKey = [countryCode, adm1].join("|");
    if (countryCode !== "US") {
      state.usMobileOperatorCatalog = null;
      state.usMobileOperatorLoading = false;
      state.usMobileOperatorError = "Katalog MNO/MVNO ini khusus Amerika Serikat.";
      state.usMobileOperatorRequestKey = catalogKey;
      renderEnergyPrices();
      return Promise.resolve();
    }
    if (!force && state.usMobileOperatorCatalog && state.usMobileOperatorRequestKey === catalogKey) {
      return Promise.resolve();
    }
    if (state.usMobileOperatorLoading && state.usMobileOperatorRequestKey === catalogKey) {
      return state.usMobileOperatorPromise || Promise.resolve();
    }
    state.usMobileOperatorLoading = true;
    state.usMobileOperatorError = "";
    state.usMobileOperatorRequestKey = catalogKey;
    var promise = window.fetch(usMobileOperatorCatalogUrl(normalized, force), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Permintaan katalog paket MNO/MVNO gagal");
      }
      return response.json();
    }).then(function (payload) {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.usMobileOperatorRequestKey !== catalogKey) {
        return;
      }
      if (!payload || payload.success === false) {
        throw new Error(payload && (payload.reason || payload.error) ? (payload.reason || payload.error) : "Payload katalog MNO/MVNO tidak valid");
      }
      state.usMobileOperatorCatalog = payload.data || payload;
      state.usMobileOperatorError = "";
    }).catch(function (error) {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.usMobileOperatorRequestKey !== catalogKey) {
        return;
      }
      state.usMobileOperatorCatalog = null;
      state.usMobileOperatorError = error && error.message ? error.message : "Katalog MNO/MVNO gagal dimuat";
    }).then(function () {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey) || state.usMobileOperatorRequestKey !== catalogKey) {
        return;
      }
      state.usMobileOperatorLoading = false;
      state.usMobileOperatorPromise = null;
      renderEnergyPrices();
    });
    state.usMobileOperatorPromise = promise;
    return promise;
  }

  function fetchGlobalUtilityPrices(area, refresh, options) {
    if (!window.fetch) {
      return Promise.reject(new Error("fetch unavailable"));
    }

    return window.fetch(globalUtilityUrl(area, refresh, options), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Global utility database request failed");
      }
      return response.json();
    });
  }

  function buildGlobalDiscoveryRequestKey(area, category, includeAdm) {
    var source = normalizePriceAreaCountry(area || {});
    var parts = [source.countryCode || "", category || "all", includeAdm ? "adm" : "country"];
    if (includeAdm) {
      parts.push(
        source.adm0Id || source.adm0 || source.country || "",
        source.adm1Id || source.adm1 || source.province || "",
        source.adm2Id || source.adm2 || source.city || ""
      );
    }
    return parts.join("|");
  }

  function resetGlobalDiscoveryState() {
    state.globalDiscoveryRequestSerial += 1;
    state.globalDiscoveryDatabase = null;
    state.globalDiscoveryLoading = false;
    state.globalDiscoveryLoaded = false;
    state.globalDiscoveryError = "";
    state.globalDiscoveryRequestKey = "";
    state.globalDiscoveryPromise = null;
  }

  function clearGlobalDiscoveryInspector(message) {
    var text = message || "Discovery inspector belum dimuat.";
    [
      [refs.globalDiscoveryRunTableBody, 12],
      [refs.globalDiscoveryStageTableBody, 8],
      [refs.globalDiscoveryQualityTableBody, 6],
      [refs.globalDiscoveryPatternTableBody, 10],
      [refs.globalAuthorityTableBody, 9],
      [refs.globalProviderTableBody, 10],
      [refs.globalCoverageTableBody, 9],
      [refs.globalProductTableBody, 8],
      [refs.globalDiscoverySourceTableBody, 10],
      [refs.globalDiscoveryPriceTableBody, 11],
      [refs.globalDiscoveryGraphTableBody, 8]
    ].forEach(function (pair) {
      if (pair[0]) {
        pair[0].innerHTML = emptyRow(pair[1], text);
      }
    });
    if (refs.globalDiscoveryStatus) {
      refs.globalDiscoveryStatus.textContent = text;
    }
  }

  function renderGlobalDiscoveryControls() {
    var area = priceAreaForRequest();
    var validationMessage = priceAreaValidationMessage(area);
    var useAdm = globalDiscoveryUsesAdmOverride();
    if (refs.globalDiscoveryCategoryInput) {
      refs.globalDiscoveryCategoryInput.disabled = state.globalDiscoveryLoading;
    }
    if (refs.globalDiscoveryUseAdmInput) {
      refs.globalDiscoveryUseAdmInput.disabled = state.globalDiscoveryLoading;
    }
    if (refs.globalDiscoveryRefreshButton) {
      refs.globalDiscoveryRefreshButton.disabled = state.globalDiscoveryLoading || Boolean(validationMessage);
      refs.globalDiscoveryRefreshButton.textContent = state.globalDiscoveryLoading
        ? "Menjalankan..."
        : (validationMessage ? "Pilih negara" : "Jalankan discovery");
    }
    if (refs.globalDiscoveryScopeHint) {
      var admScope = [area.adm0 || area.country || "", area.adm1 || area.province || "", area.adm2 || area.city || ""]
        .filter(Boolean)
        .join(" -> ");
      refs.globalDiscoveryScopeHint.textContent = useAdm
        ? "Override geografis aktif: " + (admScope || "ADM belum dipilih")
        : "Scope otomatis: country + category; ADM tidak dikirim";
    }
  }

  function loadGlobalDiscoveryInspector(force) {
    var area = priceAreaForRequest();
    var validationMessage = priceAreaValidationMessage(area);
    if (validationMessage) {
      resetGlobalDiscoveryState();
      clearGlobalDiscoveryInspector(validationMessage + " Discovery inspector belum aktif.");
      renderGlobalDiscoveryControls();
      return Promise.resolve();
    }

    var category = globalDiscoveryCategory();
    var includeAdm = globalDiscoveryUsesAdmOverride();
    var requestKey = buildGlobalDiscoveryRequestKey(area, category, includeAdm);
    if (!force && state.globalDiscoveryLoaded && state.globalDiscoveryDatabase && state.globalDiscoveryRequestKey === requestKey) {
      renderGlobalDiscoveryInspector(state.globalDiscoveryDatabase, state.globalDiscoveryDatabase.country || {});
      renderGlobalDiscoveryControls();
      return Promise.resolve();
    }
    if (state.globalDiscoveryLoading && state.globalDiscoveryRequestKey === requestKey) {
      return state.globalDiscoveryPromise || Promise.resolve();
    }

    var requestSerial = state.globalDiscoveryRequestSerial + 1;
    state.globalDiscoveryRequestSerial = requestSerial;
    state.globalDiscoveryLoading = true;
    state.globalDiscoveryLoaded = false;
    state.globalDiscoveryError = "";
    state.globalDiscoveryRequestKey = requestKey;
    clearGlobalDiscoveryInspector("Memuat Discovery Inspector langsung dari Global Utility Database...");
    renderGlobalDiscoveryControls();

    var request = fetchGlobalUtilityPrices(area, Boolean(force), {
      category: category,
      includeAdm: includeAdm,
      autoDiscovery: false
    }).then(function (payload) {
      if (requestSerial !== state.globalDiscoveryRequestSerial) {
        return;
      }
      if (!payload || payload.success === false) {
        throw new Error(payload && payload.error ? payload.error : "Payload Discovery Inspector tidak valid");
      }
      var db = payload.data || payload;
      var relational = db && db.relational && typeof db.relational === "object" ? db.relational : null;
      if (!relational || !relational.discoveryInspector) {
        throw new Error(db && db.databaseError ? db.databaseError : "Discovery Inspector memerlukan database SQL yang aktif");
      }
      state.globalDiscoveryDatabase = db;
      state.globalDiscoveryLoaded = true;
      if (category) {
        cacheGlobalUtilityCategoryDatabase(category, db, includeAdm ? area : null);
      }
      if (state.energyPrices && typeof state.energyPrices === "object") {
        state.energyPrices.globalUtilityDatabase = db;
        state.energyPrices.globalUtilitySource = payload.source || "";
        attachGlobalUtilityCategoryDatabases(state.energyPrices);
      }
      renderGlobalDiscoveryInspector(db, db.country || {});
      if (state.energyPricesLoaded && state.energyPrices) {
        renderEnergyPrices();
      }
    }).catch(function (error) {
      if (requestSerial !== state.globalDiscoveryRequestSerial) {
        return;
      }
      state.globalDiscoveryDatabase = null;
      state.globalDiscoveryLoaded = false;
      state.globalDiscoveryError = error && error.message ? error.message : "Gagal memuat Discovery Inspector";
      clearGlobalDiscoveryInspector("Discovery Inspector gagal dimuat: " + state.globalDiscoveryError);
    }).then(function () {
      if (requestSerial !== state.globalDiscoveryRequestSerial) {
        return;
      }
      state.globalDiscoveryLoading = false;
      state.globalDiscoveryPromise = null;
      renderGlobalDiscoveryControls();
    });
    state.globalDiscoveryPromise = request;
    return request;
  }

  function postGlobalUtilitySave(action, fields) {
    if (!window.fetch) {
      return Promise.reject(new Error("fetch unavailable"));
    }
    var area = priceAreaForRequest();
    var body = Object.assign({
      action: action,
      country: area.country || "",
      countryCode: area.countryCode || "",
      adm0: area.adm0 || area.country || "",
      adm1: area.adm1 || area.province || "",
      adm2: area.adm2 || area.city || "",
      adm0Id: area.adm0Id || "",
      adm1Id: area.adm1Id || "",
      adm2Id: area.adm2Id || "",
      province: area.province || "",
      city: area.city || ""
    }, {
      fields: fields || {}
    });
    return window.fetch(GLOBAL_UTILITY_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Global utility save failed");
      }
      return response.json();
    });
  }

  function loadEnergyPrices(force) {
    var requestArea = priceAreaForRequest();
    var validationMessage = energyPriceAreaValidationMessage(requestArea);
    if (validationMessage) {
      invalidateEnergyPriceRequests();
      state.energyPricesLoaded = false;
      state.energyPrices = null;
      state.energyPricesError = "";
      renderEnergyPrices();
      return Promise.resolve();
    }
    var requestKey = energyPriceRequestScopeKey(requestArea);
    if (state.energyPricesLoading && state.energyPriceRequestKey === requestKey) {
      return state.energyPricePromise || Promise.resolve();
    }
    if (!force && state.energyPricesLoaded && state.energyPrices && state.energyPriceRequestKey === requestKey) {
      renderEnergyPrices();
      return Promise.resolve();
    }
    var requestSerial = state.energyPriceRequestSerial + 1;
    state.energyPriceRequestSerial = requestSerial;
    state.energyPriceRequestKey = requestKey;
    state.energyPricesLoading = true;
    state.energyPricesError = "";
    renderEnergyPrices();
    loadUsFuelProviderCatalog(requestArea, requestSerial, requestKey);

    var request = fetchEnergyPrices(requestArea).then(function (payload) {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey)) {
        return;
      }
      if (!payload || payload.success === false) {
        throw new Error(payload && payload.error ? payload.error : "Data harga energi tidak valid");
      }
      state.energyPrices = payload.data || payload;
      state.energyPricesLoaded = true;
      renderEnergyPrices();
      return loadGlobalUtilityCategoryDatabases(requestArea, Boolean(force), {
        requestSerial: requestSerial,
        requestKey: requestKey
      }, function (category) {
        if (!energyPriceRequestIsCurrent(requestSerial, requestKey)) {
          return;
        }
        attachGlobalUtilityCategoryDatabases(state.energyPrices);
        renderEnergyPrices();
        if (category === "electricity") {
          loadUsElectricityGeneration(requestArea, Boolean(force), requestSerial, requestKey);
        } else if (category === "mobile") {
          loadUsMobileOperatorCatalog(requestArea, Boolean(force), requestSerial, requestKey);
        } else if (category === "water") {
          loadUsWaterProviderCatalog(requestArea, Boolean(force), requestSerial, requestKey);
          loadUsWaterTariffHierarchy(requestArea, requestSerial, requestKey);
        }
      }).then(function () {
        if (!energyPriceRequestIsCurrent(requestSerial, requestKey)) {
          return;
        }
        attachGlobalUtilityCategoryDatabases(state.energyPrices);
      });
    }).catch(function (error) {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey)) {
        return;
      }
      state.energyPricesError = error && error.message ? error.message : "Gagal memuat harga energi";
    }).then(function () {
      if (!energyPriceRequestIsCurrent(requestSerial, requestKey)) {
        return;
      }
      state.energyPricesLoading = false;
      state.energyPricePromise = null;
      renderEnergyPrices();
    });
    state.energyPricePromise = request;
    return request;
  }

  function scheduleEnergyPricesLoad(force) {
    if (state.activeTab !== "energy-prices" || !energyPriceAreaReady(priceAreaForRequest())) {
      return;
    }
    if (state.energyPriceLoadTimer) {
      window.clearTimeout(state.energyPriceLoadTimer);
    }
    state.energyPriceLoadTimer = window.setTimeout(function () {
      state.energyPriceLoadTimer = null;
      loadEnergyPrices(Boolean(force));
    }, 180);
  }

  function formatEnergyPrice(value, currency, unit) {
    if (value === null || value === undefined || value === "") {
      return "-";
    }
    return escapeHtml(formatMoney(value, currency)) + (unit ? "/" + escapeHtml(unit) : "");
  }

  var LITERS_PER_US_GALLON = 3.785411784;
  var LITERS_PER_IMPERIAL_GALLON = 4.54609;
  var LITERS_PER_CUBIC_METER = 1000;
  var LITERS_PER_HUNDRED_CUBIC_FEET = 2831.6846592;

  function normalizedPriceVolumeUnit(unit) {
    return String(unit || "")
      .trim()
      .toLowerCase()
      .replace(/m³/g, "m3")
      .replace(/m\^3/g, "m3")
      .replace(/u\.s\./g, "us")
      .replace(/_/g, " ")
      .replace(/,/g, "")
      .replace(/^\s*(?:1000|1\s+000)\s+/, "1000 ")
      .replace(/^\s*(?:per|\/)\s*/g, "")
      .replace(/^(.*?)\s+(?:per|\/)\s*(?:unit)?$/, "$1")
      .replace(/\.$/g, "")
      .replace(/\s+/g, " ");
  }

  function convertedVolumePrice(value, unit) {
    var amount = Number(value);
    var sourceUnit = normalizedPriceVolumeUnit(unit);
    if (!isFinite(amount) || amount < 0 || !sourceUnit) {
      return null;
    }
    if (/^(?:l|ltr|ltrs|liter|liters|litre|litres)$/.test(sourceUnit)) {
      return {
        value: amount * LITERS_PER_US_GALLON,
        unit: "US gallon",
        rule: "1 US gallon = 3.785411784 liter"
      };
    }
    if (/^(?:1000 l|1000 liter|1000 liters|1000 litre|1000 litres)$/.test(sourceUnit)) {
      return {
        value: amount * LITERS_PER_US_GALLON / 1000,
        unit: "US gallon",
        rule: "harga per 1000 liter dikonversi ke per US gallon"
      };
    }
    if (/^(?:gal|gals|gallon|gallons|us gal|us gals|us gallon|us gallons)$/.test(sourceUnit)) {
      return {
        value: amount / LITERS_PER_US_GALLON,
        unit: "liter",
        rule: "1 US gallon = 3.785411784 liter"
      };
    }
    if (/^(?:1000 gal|1000 gals|1000 gallon|1000 gallons|1000 us gal|1000 us gals|1000 us gallon|1000 us gallons|kgal|thousand gallon|thousand gallons)$/.test(sourceUnit)) {
      return {
        value: amount / (1000 * LITERS_PER_US_GALLON),
        unit: "liter",
        rule: "1000 US gallon = 3785.411784 liter"
      };
    }
    if (/^(?:imperial gal|imperial gallon|imperial gallons|uk gal|uk gallon|uk gallons)$/.test(sourceUnit)) {
      return {
        value: amount / LITERS_PER_IMPERIAL_GALLON,
        unit: "liter",
        rule: "1 imperial gallon = 4.54609 liter"
      };
    }
    if (/^(?:m3|cu m|cubic meter|cubic meters|cubic metre|cubic metres)$/.test(sourceUnit)) {
      return {
        value: amount / LITERS_PER_CUBIC_METER,
        unit: "liter",
        rule: "1 m3 = 1000 liter"
      };
    }
    if (/^(?:hcf|ccf|100 cubic feet|100 cubic foot)$/.test(sourceUnit)) {
      return {
        value: amount / LITERS_PER_HUNDRED_CUBIC_FEET,
        unit: "liter",
        rule: "100 cubic feet = 2831.6846592 liter"
      };
    }
    return null;
  }

  function formatConvertedVolumePrice(value, currency, unit) {
    var converted = convertedVolumePrice(value, unit);
    if (!converted) {
      return '<span class="muted-cell">Konversi tidak tersedia untuk unit sumber ' + escapeHtml(unit || "-") + ".</span>";
    }
    var absolute = Math.abs(converted.value);
    var digits = absolute >= 1000 ? 4 : (absolute >= 1 ? 6 : (absolute >= 0.01 ? 8 : 10));
    var code = String(currency || "").trim().toUpperCase();
    var label = (code ? code + " " : "") + formatNumber(converted.value, digits) + "/" + converted.unit;
    return '<span title="' + escapeHtml(converted.rule) + '">≈ ' + escapeHtml(label) + "</span>";
  }

  function formatSourceVolumePrice(value, currency, unit, priceText) {
    var exactText = textValue(priceText);
    if (exactText && /\d/.test(exactText)) {
      return escapeHtml(exactText);
    }
    var amount = Number(value);
    if (!isFinite(amount)) {
      return "-";
    }
    var raw = String(value);
    var fraction = raw.indexOf(".") >= 0 ? raw.split(".")[1].replace(/0+$/, "").length : 0;
    var digits = Math.max(0, Math.min(8, fraction));
    var code = String(currency || "").trim().toUpperCase();
    return escapeHtml((code ? code + " " : "") + formatNumber(amount, digits) + (unit ? "/" + unit : ""));
  }

  function formatSourceLink(url, label) {
    if (!url) {
      return escapeHtml(label || "-");
    }
    return "<a href=\"" + escapeHtml(url) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + escapeHtml(label || "Sumber") + "</a>";
  }

  function sourceStatusText(source) {
    if (!source) {
      return "Sumber belum tersedia";
    }
    return [source.label || source.brand || source.name || "Sumber", source.status || "", source.message || ""]
      .filter(Boolean)
      .join(" - ");
  }

  function sourceStatusSuffix(value) {
    return value && value !== "ok" ? " - " + value : "";
  }

  function priceCountryProfileForArea(area) {
    var source = normalizePriceAreaCountry(area || priceAreaForRequest());
    var code = normalizePriceCountryCode(source.country, source.countryCode);
    if (!code) {
      return {};
    }
    var gallonCountries = ["US", "PR", "GU", "VI", "UM"];
    var usesGallon = gallonCountries.indexOf(code) !== -1;
    return {
      country: source.country || countryNameForCode(code),
      countryCode: code,
      currency: PRICE_COUNTRY_CURRENCY_MAP[code] || "",
      fuelUnit: usesGallon ? "gallon" : "liter",
      electricityUnit: "kWh",
      waterUnit: usesGallon ? "1000 gal" : "m3",
      internetBillingUnit: "month",
      mobileBillingUnit: "month",
      oilCurrency: "USD",
      oilUnit: "barrel",
      profileSource: "frontend-iso4217-unit-profile"
    };
  }

  function energyCountryProfile(data) {
    if (data && data.countryProfile && typeof data.countryProfile === "object" && data.countryProfile.currency) {
      return data.countryProfile;
    }
    return priceCountryProfileForArea(data && data.priceArea ? data.priceArea : priceAreaForRequest());
  }

  function energyCoverage(data, key) {
    return data && data.coverage && data.coverage[key] && typeof data.coverage[key] === "object" ? data.coverage[key] : null;
  }

  function energyProfileFormatText(data, unitKey) {
    var profile = energyCountryProfile(data);
    var currency = profile.currency || "mata uang negara";
    var unit = profile[unitKey] || "";
    return currency + (unit ? "/" + unit : "");
  }

  function energyProfileSummary(data) {
    var profile = energyCountryProfile(data);
    if (!profile.currency) {
      return "";
    }
    return "Format: " + [
      "BBM " + energyProfileFormatText(data, "fuelUnit"),
      "listrik " + energyProfileFormatText(data, "electricityUnit"),
      "air " + energyProfileFormatText(data, "waterUnit")
    ].join(", ");
  }

  function globalUtilityAvailabilityItem(container, key) {
    if (Array.isArray(container)) {
      return container.find(function (item) {
        return item && normalizeGlobalUtilityCategory(item.category || item.key || "") === key;
      }) || null;
    }
    if (!container || typeof container !== "object") {
      return null;
    }
    if (container[key] !== undefined && container[key] !== null && typeof container[key] !== "object") {
      return { code: String(container[key]) };
    }
    if (Array.isArray(container[key])) {
      return container[key].find(function (item) {
        return item && (!item.category || normalizeGlobalUtilityCategory(item.category) === key);
      }) || container[key][0] || null;
    }
    if (container[key] && typeof container[key] === "object") {
      return container[key];
    }
    return normalizeGlobalUtilityCategory(container.category || container.key || "") === key ? container : null;
  }

  function globalUtilityAvailabilityCode(value) {
    var code = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    var aliases = {
      no_official_source_discovered: "no_official_source_found",
      source_discovered_awaiting_extraction: "official_source_no_verified_price",
      source_discovered_no_records_extracted: "official_source_no_verified_price",
      official_source_found_no_public_price: "official_source_no_public_price",
      official_authority_no_public_numeric_tariff: "official_source_no_public_price",
      official_public_page_has_no_current_tariff_rows: "official_source_no_public_price",
      source_ok_no_record_for_scope: "official_source_no_record_for_scope",
      generic_html_no_price_records: "official_source_no_public_price",
      provider_found_no_public_tariff_table: "official_source_no_public_price",
      automatic_discovery_needed: "discovery_pending",
      automatic_source_discovery_needed: "discovery_pending",
      waiting_discovery: "discovery_pending",
      fetch_failed: "source_unreachable",
      no_fetch_success: "source_unreachable",
      pdf_downloaded_tariff_table_parser_unsupported: "parser_unsupported",
      parser_not_implemented: "parser_unsupported",
      candidate_source: "candidate_unverified",
      source_pending_verification: "candidate_unverified"
    };
    return aliases[code] || code;
  }

  function globalUtilityAvailabilityCodeFromText(value) {
    var text = String(value || "").toLowerCase().replace(/[_-]+/g, " ");
    if (/no public|not published|tidak dipublikasikan|tanpa tabel tarif|no current tariff rows/.test(text)) {
      return "official_source_no_public_price";
    }
    if (/no record for scope|no published record.*(?:province|adm1|scope)|source ok no record/.test(text)) {
      return "official_source_no_record_for_scope";
    }
    if (/scope|coverage|service area|pricing area|jurisdiction|adm1|adm2|municipality/.test(text)) {
      return "scope_unresolved";
    }
    if (/parser|extract|scan|ocr|pdf|format/.test(text)) {
      return "parser_unsupported";
    }
    if (/timeout|network|fetch|http|tls|dns|unreachable|connection|blocked|forbidden/.test(text)) {
      return "source_unreachable";
    }
    if (/candidate|verification|review|staging/.test(text)) {
      return "candidate_unverified";
    }
    return "";
  }

  function globalUtilityLatestTimestamp(values) {
    return (Array.isArray(values) ? values : []).filter(Boolean).sort(function (left, right) {
      var leftTime = new Date(left).getTime();
      var rightTime = new Date(right).getTime();
      if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
        return String(right).localeCompare(String(left));
      }
      return rightTime - leftTime;
    })[0] || "";
  }

  function globalUtilityAvailabilityLabel(code) {
    return {
      verified_price: "Harga resmi terverifikasi",
      official_reference: "Referensi resmi terverifikasi",
      no_official_source_found: "Sumber resmi tidak ditemukan",
      official_source_no_public_price: "Harga tidak dipublikasikan oleh sumber resmi",
      official_source_no_record_for_scope: "Sumber resmi belum memuat harga wilayah ini",
      official_source_no_verified_price: "Harga resmi belum lolos evidence chain",
      candidate_unverified: "Kandidat sumber masih diverifikasi",
      scope_unresolved: "Cakupan harga belum dapat dipastikan",
      source_unreachable: "Sumber resmi tidak dapat dijangkau saat pemeriksaan",
      parser_unsupported: "Dokumen resmi belum dapat diekstrak",
      stale: "Harga terverifikasi terakhir sudah kedaluwarsa",
      category_load_failed: "Database kategori gagal dimuat",
      discovery_pending: "Pemeriksaan sumber resmi belum dijalankan"
    }[code] || globalUtilityStatusLabel(code || "discovery_pending");
  }

  function globalUtilityAvailabilityDefaultReason(code, key) {
    var label = globalUtilityCategoryLabel(key).toLowerCase();
    return {
      no_official_source_found: "Pemeriksaan authority, regulator, provider, dan registry resmi selesai tanpa menemukan sumber yang menerbitkan " + label + ".",
      official_source_no_public_price: "Sumber resmi ditemukan, tetapi tidak menyediakan tabel harga publik yang dapat diverifikasi.",
      official_source_no_record_for_scope: "Feed resmi berhasil diperiksa, tetapi belum memuat record harga yang dipublikasikan untuk wilayah terpilih; harga wilayah lain tidak digunakan sebagai harga lokal.",
      official_source_no_verified_price: "Sumber resmi tersedia, tetapi provider, product, coverage, atau price evidence belum lengkap.",
      candidate_unverified: "Kandidat URL tetap di staging sampai role sumber dan evidence harganya terverifikasi.",
      scope_unresolved: "Harga tidak diterbitkan sampai bukti cakupan nasional, ADM1, provider area, atau service area dapat dipastikan.",
      source_unreachable: "Pemeriksaan terakhir gagal mengakses sumber; data yang belum terverifikasi tidak diterbitkan.",
      parser_unsupported: "Sumber resmi ditemukan, tetapi format dokumen belum dapat diekstrak dengan confidence yang aman.",
      stale: "Snapshot lama dipertahankan sebagai riwayat dan tidak dianggap harga aktif.",
      category_load_failed: "Respons kategori gagal dimuat tanpa mengganggu kategori lain.",
      discovery_pending: "Jalankan Refresh online untuk memeriksa authority, provider, coverage, dan sumber harga resmi."
    }[code] || "Status ketersediaan harga mengikuti evidence terbaru dari registry resmi.";
  }

  function globalUtilityCategoryAvailability(data, key) {
    var category = normalizeGlobalUtilityCategory(key || "");
    var db = globalUtilityEnergyDatabase(data, category);
    var relational = db && db.relational && typeof db.relational === "object" ? db.relational : {};
    var inspector = relational.discoveryInspector && typeof relational.discoveryInspector === "object"
      ? relational.discoveryInspector
      : {};
    var pipelineCategory = db ? globalUtilityPipelineCategory(db, category) : null;
    var directContainers = [
      db && db.categoryAvailability,
      db && db.availability,
      db && db.pipeline && db.pipeline.categoryAvailability,
      pipelineCategory && pipelineCategory.availability,
      relational.categoryAvailability,
      relational.availability,
      inspector.categoryAvailability,
      inspector.availability,
      data && data.categoryAvailability,
      data && data.availability
    ];
    var direct = null;
    directContainers.some(function (container) {
      direct = globalUtilityAvailabilityItem(container, category);
      return Boolean(direct);
    });
    direct = direct && typeof direct === "object" ? direct : {};

    var errors = data && data.globalUtilityCategoryErrors && typeof data.globalUtilityCategoryErrors === "object"
      ? data.globalUtilityCategoryErrors
      : state.globalUtilityCategoryErrors;
    var loadError = errors && errors[category] ? String(errors[category]) : "";
    var strictRows = db ? globalUtilityStrictPriceRows(data, category) : [];
    var verifiedSources = db ? globalUtilityCategoryItems(inspector.sources, category) : [];
    var stagingSources = db ? globalUtilityCategoryItems(db.sourceRegistry, category) : [];
    var runs = db ? globalUtilityCategoryItems(inspector.runs, category) : [];
    var stages = db ? globalUtilityCategoryItems(inspector.stages, category) : [];
    var checkedAt = globalUtilityLatestTimestamp([
      direct.lastCheckedAt,
      direct.checkedAt,
      direct.updatedAt,
      pipelineCategory && pipelineCategory.ranAt,
      db && db.pipeline && db.pipeline.ranAt
    ].concat(verifiedSources.concat(stagingSources).map(function (source) {
      return source.lastCheckedAt || source.lastSuccessAt || source.updatedAt || "";
    })).concat(runs.map(function (run) {
      return run.completedAt || run.startedAt || "";
    })));
    var stageErrors = stages.map(function (stage) {
      return stage.error || stage.errorText || "";
    }).filter(Boolean);
    var sourceErrors = verifiedSources.concat(stagingSources).map(function (source) {
      var metadata = source && source.metadata && typeof source.metadata === "object" ? source.metadata : {};
      return source.availabilityReason || source.statusReason || source.reason || source.lastError ||
        metadata.availabilityReason || metadata.statusReason || metadata.reason || "";
    }).filter(Boolean);
    var events = pipelineCategory && Array.isArray(pipelineCategory.events) ? pipelineCategory.events : [];
    var notes = pipelineCategory && Array.isArray(pipelineCategory.notes) ? pipelineCategory.notes : [];
    var reason = textValue(direct.reason || direct.message || direct.statusReason || direct.error || "") ||
      stageErrors.slice(-1)[0] || sourceErrors.slice(-1)[0] || events.slice(-1)[0] || notes.slice(-1)[0] || "";
    var code = globalUtilityAvailabilityCode(direct.reasonCode || direct.code || direct.availabilityStatus || direct.status || "");
    if (strictRows.length) {
      code = strictRows.some(function (entry) {
        return String(entry.price.recordKind || "").toLowerCase() === "official_reference";
      }) ? "official_reference" : "verified_price";
    } else if (loadError) {
      code = "category_load_failed";
      reason = loadError;
    } else if (!code || ["complete", "completed", "active", "updated"].indexOf(code) !== -1) {
      var inferredErrorCode = globalUtilityAvailabilityCodeFromText(reason);
      var priceCapable = verifiedSources.some(function (source) {
        return globalUtilitySourceCapabilities(source).some(function (capability) {
          return ["price_api", "price_page", "price_dataset", "price_document", "tariff_page", "tariff_document"].indexOf(capability) !== -1;
        });
      });
      var completedRun = runs.some(function (run) {
        return /complete/i.test(String(run.state || run.status || ""));
      });
      if (inferredErrorCode) {
        code = inferredErrorCode;
      } else if (verifiedSources.length) {
        code = priceCapable ? "official_source_no_verified_price" : "official_source_no_public_price";
      } else if (stagingSources.length) {
        code = "candidate_unverified";
      } else if (completedRun || checkedAt) {
        code = "no_official_source_found";
      } else {
        code = "discovery_pending";
      }
    }
    if (!reason || /^(?:complete|completed|updated)$/i.test(reason)) {
      reason = globalUtilityAvailabilityDefaultReason(code, category);
    }
    return {
      category: category,
      code: code || "discovery_pending",
      label: globalUtilityAvailabilityLabel(code || "discovery_pending"),
      reason: reason,
      checked: Boolean(direct.checked || checkedAt || runs.length || verifiedSources.length || stagingSources.length),
      checkedAt: checkedAt,
      retryAt: textValue(direct.retryAt || direct.nextRetryAt || direct.nextCheckAt || ""),
      sourceCount: verifiedSources.length,
      candidateCount: stagingSources.length
    };
  }

  function globalUtilityAvailabilityDetails(availability) {
    return [
      availability.reason || "",
      availability.checkedAt ? "Diperiksa " + formatDateTime(availability.checkedAt) + "." : "",
      availability.retryAt ? "Pemeriksaan berikutnya " + formatDateTime(availability.retryAt) + "." : ""
    ].filter(Boolean).join(" ");
  }

  function globalUtilityScopeBlocker(data, key) {
    var availability = globalUtilityCategoryAvailability(data, key);
    return availability.code === "scope_unresolved" ? "Blocker: " + availability.reason : "";
  }

  function energyEmptyMessage(data, key, unitKey, fallback) {
    var availability = globalUtilityCategoryAvailability(data, key);
    if (availability.code !== "discovery_pending" || availability.checked) {
      return globalUtilityAvailabilityDetails(availability);
    }
    var coverage = energyCoverage(data, key);
    if (coverage && coverage.message && coverage.configured) {
      return coverage.message;
    }
    return fallback || globalUtilityAvailabilityDetails(availability);
  }

  function sourceDiscoveryCategory(data, key) {
    var discovery = data && data.sourceDiscovery && typeof data.sourceDiscovery === "object" ? data.sourceDiscovery : null;
    var categories = discovery && Array.isArray(discovery.categories) ? discovery.categories : [];
    return categories.find(function (category) {
      return category && category.key === key;
    }) || null;
  }

  function unavailablePriceCell(data, unitKey, key) {
    var availability = globalUtilityCategoryAvailability(data, key);
    return escapeHtml(availability.label) + "<br><span class=\"muted-cell\">Format: " + escapeHtml(energyProfileFormatText(data, unitKey)) + "</span>";
  }

  function unavailableStatusCell(data, key, unitKey, fallback) {
    var availability = globalUtilityCategoryAvailability(data, key);
    return escapeHtml(availability.label) + "<br><span class=\"muted-cell\">" + escapeHtml(energyEmptyMessage(data, key, unitKey, fallback)) + "</span>";
  }

  function unavailableSourceCell(data, key) {
    var category = sourceDiscoveryCategory(data, key);
    var availability = globalUtilityCategoryAvailability(data, key);
    var safety = category && category.safetyRule ? category.safetyRule : "Kandidat tetap di staging sampai role, provider, product, coverage, dan price evidence lengkap.";
    return escapeHtml(availability.label) + "<br><span class=\"muted-cell\">" +
      escapeHtml(globalUtilityAvailabilityDetails(availability)) +
      (availability.code === "candidate_unverified" ? " " + escapeHtml(safety) : "") +
      "</span>";
  }

  function fallbackPriceRegion(data, key) {
    var area = data && data.priceArea ? data.priceArea : priceAreaForRequest();
    var regionKey = {
      fuel: "fuelRegion",
      electricity: "electricityRegion",
      internet: "telecomRegion",
      mobile: "telecomRegion",
      water: "waterRegion"
    }[key] || "priceRegion";
    return priceScopeLabel(area, regionKey);
  }

  function formatDiscoverySources(category) {
    var sources = category && Array.isArray(category.registeredSources) ? category.registeredSources : [];
    var hints = category && Array.isArray(category.domainHints) ? category.domainHints : [];
    var sourceText = sources.map(function (source) {
      return formatSourceLink(source.url, source.label || "Sumber") + "<br><span class=\"muted-cell\">" + escapeHtml(source.status || "verified registry") + "</span>";
    }).join("<br>");
    var hintText = hints.slice(0, 6).map(function (hint) {
      return "<span class=\"source-hint\">" + escapeHtml(hint) + "</span>";
    }).join(" ");
    return [sourceText, hintText].filter(Boolean).join("<br>");
  }

  function formatAdmScopeLevel(scope, key) {
    var identity = scope && scope.admIdentity && scope.admIdentity[key] ? scope.admIdentity[key] : {};
    var name = textValue(identity.name || scope[key] || "");
    var id = textValue(identity.id || scope[key + "Id"] || "");
    return (name || "-") + (id ? " (" + id + ")" : "");
  }

  function renderSourceDiscovery(data) {
    if (!refs.sourceDiscoveryStatus || !refs.sourceDiscoveryTableBody) {
      return;
    }
    var discovery = data && data.sourceDiscovery && typeof data.sourceDiscovery === "object" ? data.sourceDiscovery : null;
    var categories = discovery && Array.isArray(discovery.categories) ? discovery.categories : [];
    if (!state.energyPricesLoaded || !categories.length) {
      refs.sourceDiscoveryStatus.textContent = priceAreaReady(priceAreaForRequest())
        ? "Auto discovery aktif saat negara dipilih. Refresh online memaksa fetch ulang dan mencoba kandidat sumber resmi tambahan."
        : "Pilih negara untuk menyiapkan query sumber resmi.";
      refs.sourceDiscoveryTableBody.innerHTML = emptyRow(5, refs.sourceDiscoveryStatus.textContent);
      return;
    }
    var scope = discovery.scope || {};
    refs.sourceDiscoveryStatus.textContent = "Scope pencarian adaptif: ADM0 " + formatAdmScopeLevel(scope, "adm0") + " - ADM1 " + formatAdmScopeLevel(scope, "adm1") + " - ADM2 " + formatAdmScopeLevel(scope, "adm2") + ". ADM1/ADM2 opsional; fetch memakai verified dynamic registry.";
    refs.sourceDiscoveryTableBody.innerHTML = categories.map(function (category) {
      var queryCell = escapeHtml(category.query || "Query discovery") +
        "<br><span class=\"muted-cell\">Search engine hanya metadata internal; kolom sumber harus URL resmi hasil verifikasi.</span>";
      var columnCell = Array.isArray(category.normalizedColumns)
        ? category.normalizedColumns.map(function (column) {
          return "<span class=\"source-hint\">" + escapeHtml(column) + "</span>";
        }).join(" ")
        : "-";
      var statusCell = [
        category.configured ? "Parser/trusted cache siap" : "Discovery online dibutuhkan",
        category.status || "",
        category.safetyRule || ""
      ].filter(Boolean).join("<br>");
      return "<tr>" +
        "<td>" + escapeHtml(category.label || category.key || "-") + "</td>" +
        "<td>" + queryCell + "</td>" +
        "<td>" + formatDiscoverySources(category) + "</td>" +
        "<td>" + columnCell + "</td>" +
        "<td>" + statusCell + "</td>" +
      "</tr>";
    }).join("");
  }

  function globalUtilityCategoryLabel(key) {
    return {
      fuel: "BBM",
      electricity: "Listrik",
      internet: "Internet rumah",
      mobile: "Mobile internet",
      water: "Air / PDAM"
    }[key] || key;
  }

  function globalUtilityDefaultUnit(key) {
    return {
      fuel: "liter",
      electricity: "kWh",
      internet: "month",
      mobile: "month",
      water: "m3"
    }[key] || "";
  }

  function globalUtilityCategoryItems(items, key) {
    return (Array.isArray(items) ? items : []).filter(function (item) {
      return item && item.category === key;
    });
  }

  function globalUtilityDatabaseCategoryFilter(db) {
    var relational = db && db.relational && typeof db.relational === "object" ? db.relational : {};
    var inspector = relational.discoveryInspector && typeof relational.discoveryInspector === "object"
      ? relational.discoveryInspector
      : {};
    return normalizeGlobalUtilityCategory(relational.categoryFilter || inspector.categoryFilter || "");
  }

  function globalUtilityDatabaseCountryCode(db) {
    var country = db && db.country && typeof db.country === "object" ? db.country : {};
    var relational = db && db.relational && typeof db.relational === "object" ? db.relational : {};
    var inspector = relational.discoveryInspector && typeof relational.discoveryInspector === "object"
      ? relational.discoveryInspector
      : {};
    return String(country.iso2 || country.countryCode || inspector.countryCode || "").trim().toUpperCase();
  }

  function globalUtilityDatabaseMatchesCurrentArea(db) {
    var currentArea = priceAreaForRequest() || {};
    var requested = String(currentArea.countryCode || "").trim().toUpperCase();
    var actual = globalUtilityDatabaseCountryCode(db);
    var requestScopeKey = String(db && db.__mpmRequestScopeKey || "");
    return (!requested || !actual || requested === actual) &&
      (!requestScopeKey || requestScopeKey === energyPriceRequestScopeKey(currentArea));
  }

  function cacheGlobalUtilityCategoryDatabase(category, db, requestArea) {
    if (!db || typeof db !== "object" || db.error) {
      return;
    }
    if (requestArea) {
      db.__mpmRequestScopeKey = energyPriceRequestScopeKey(requestArea);
    }
    var normalized = normalizeGlobalUtilityCategory(category || "");
    var categories = normalized ? [normalized] : GLOBAL_UTILITY_ENERGY_CATEGORIES;
    categories.forEach(function (key) {
      state.globalUtilityCategoryDatabases[key] = db;
      delete state.globalUtilityCategoryErrors[key];
      if (key === "fuel") {
        state.globalFuelDatabase = db;
      }
    });
  }

  function attachGlobalUtilityCategoryDatabases(data) {
    if (!data || typeof data !== "object") {
      return;
    }
    data.globalUtilityCategoryDatabases = state.globalUtilityCategoryDatabases;
    data.globalUtilityCategoryErrors = state.globalUtilityCategoryErrors;
    data.globalFuelDatabase = state.globalUtilityCategoryDatabases.fuel || state.globalFuelDatabase || null;
  }

  function resetGlobalUtilityCategoryDatabases() {
    state.globalFuelDatabase = null;
    state.globalUtilityCategoryDatabases = {};
    state.globalUtilityCategoryErrors = {};
  }

  function loadGlobalUtilityCategoryDatabases(area, refresh, requestContext, onCategoryLoaded) {
    var context = requestContext && typeof requestContext === "object" ? requestContext : null;
    var requestIsCurrent = function () {
      return !context || energyPriceRequestIsCurrent(context.requestSerial, context.requestKey);
    };
    var loadCategory = function (category) {
      return fetchGlobalUtilityPrices(area, Boolean(refresh), {
        category: category,
        includeAdm: true,
        autoDiscovery: false,
        energyTableView: true
      }).then(function (payload) {
        if (!requestIsCurrent()) {
          return false;
        }
        if (!payload || payload.success === false) {
          throw new Error(payload && payload.error ? payload.error : "Database global kategori " + category + " tidak valid");
        }
        var database = payload.data || payload;
        cacheGlobalUtilityCategoryDatabase(category, database, area);
        if (typeof onCategoryLoaded === "function") {
          onCategoryLoaded(category, database);
        }
        return true;
      }).catch(function (error) {
        if (!requestIsCurrent()) {
          return false;
        }
        state.globalUtilityCategoryErrors[category] = error && error.message
          ? error.message
          : "Gagal memuat database global kategori " + category;
        return false;
      });
    };
    var results = [];
    return GLOBAL_UTILITY_ENERGY_CATEGORIES.reduce(function (chain, category) {
      return chain.then(function () {
        if (!requestIsCurrent()) {
          return results;
        }
        return loadCategory(category).then(function (loaded) {
          results.push(loaded);
          return results;
        });
      });
    }, Promise.resolve(results)).then(function () {
      if (requestIsCurrent()) {
        attachGlobalUtilityCategoryDatabases(state.energyPrices);
      }
      return results;
    });
  }

  function globalUtilityEnergyDatabase(data, category) {
    var normalized = normalizeGlobalUtilityCategory(category || "");
    var candidates = [];
    var dataCaches = data && data.globalUtilityCategoryDatabases && typeof data.globalUtilityCategoryDatabases === "object"
      ? data.globalUtilityCategoryDatabases
      : {};
    if (normalized && dataCaches[normalized]) {
      candidates.push(dataCaches[normalized]);
    }
    if (normalized && state.globalUtilityCategoryDatabases[normalized]) {
      candidates.push(state.globalUtilityCategoryDatabases[normalized]);
    }
    if (normalized === "fuel") {
      candidates.push(data && data.globalFuelDatabase, state.globalFuelDatabase);
    }
    candidates.push(data && data.globalUtilityDatabase);
    for (var index = 0; index < candidates.length; index += 1) {
      var db = candidates[index];
      if (!db || typeof db !== "object" || db.error || !globalUtilityDatabaseMatchesCurrentArea(db)) {
        continue;
      }
      var filter = globalUtilityDatabaseCategoryFilter(db);
      if (!filter || filter === normalized) {
        return db;
      }
    }
    return null;
  }

  function globalUtilityPositivePrice(value) {
    if (value === null || value === undefined || value === "") {
      return false;
    }
    var numeric = Number(value);
    return isFinite(numeric) && numeric > 0;
  }

  function globalUtilityScopeToken(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function globalUtilityRecordMetadata(record) {
    return record && record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  }

  function globalUtilityRecordScopeType(row, record) {
    var metadata = globalUtilityRecordMetadata(record);
    return globalUtilityScopeToken(
      record.pricingGeography || record.pricingGeographyType || record.scopeType ||
      metadata.pricingGeography || metadata.pricing_geography || metadata.pricingScopeType ||
      metadata.pricing_scope_type || row.pricingScopeType || row.pricingScope || ""
    );
  }

  function globalUtilityBroadCoverageScope(scopeType) {
    if (!scopeType) {
      return false;
    }
    return /^(?:national|country|countrywide|adm0)$/.test(scopeType);
  }

  function globalUtilityAdm1BoundScope(scopeType) {
    return /^(?:adm1|adm2|provider|provider_area|service_area|coverage_area|pricing_zone|zone|station|municipality|utility_area|network_area|operator_area)$/.test(scopeType || "");
  }

  function globalUtilityIsQualifiedProviderCatalog(row, record, scopeType) {
    var metadata = globalUtilityRecordMetadata(record);
    var category = normalizeGlobalUtilityCategory(record.category || row.category || "");
    return scopeType === "provider_area" &&
      (category === "internet" || category === "mobile") &&
      metadata.catalogBasePriceIsNotStateTariff === true &&
      (metadata.availabilityMustBeCheckedAtAddress === true || metadata.coverageMustBeCheckedOnOfficialMap === true);
  }

  function globalUtilityRecordAdm1Identity(row, record) {
    var metadata = globalUtilityRecordMetadata(record);
    var scopeType = globalUtilityRecordScopeType(row, record);
    var name = record.adm1 || record.province || metadata.adm1 || metadata.adm1Name || metadata.adm1_name || "";
    if (!name && scopeType === "adm1") {
      name = record.pricingArea || record.region || row.pricingScope || "";
    }
    return {
      name: textValue(name),
      id: textValue(record.adm1Id || record.adm1_id || metadata.adm1Id || metadata.adm1_id || "")
    };
  }

  function globalUtilityRecordApplicableAdm1Names(record) {
    var metadata = globalUtilityRecordMetadata(record);
    var values = metadata.applicableAdm1Names || metadata.applicable_adm1_names || [];
    return Array.isArray(values) ? values.map(textValue).filter(Boolean) : [];
  }

  function globalUtilityRecordAppliesToCurrentAdm1(row, record) {
    var selectedArea = normalizePriceAreaCountry(priceAreaForRequest());
    var selectedName = textValue(selectedArea.adm1 || selectedArea.province || "");
    var selectedId = textValue(selectedArea.adm1Id || "");
    if (!selectedName && !selectedId) {
      return true;
    }
    var scopeType = globalUtilityRecordScopeType(row, record);
    var applicableAdm1Names = globalUtilityRecordApplicableAdm1Names(record);
    if (applicableAdm1Names.length) {
      var selectedApplicabilityKey = boundaryOptionMatchKey(selectedName);
      return applicableAdm1Names.some(function (name) {
        return selectedApplicabilityKey && boundaryOptionMatchKey(name) === selectedApplicabilityKey;
      });
    }
    if (globalUtilityBroadCoverageScope(scopeType)) {
      return true;
    }
    // A verified telecom catalog price can be shown as a provider offer in
    // every state, but it remains explicitly address/map qualified and must
    // never be described as a state tariff or proof of local availability.
    if (globalUtilityIsQualifiedProviderCatalog(row, record, scopeType)) {
      return true;
    }
    var recordIdentity = globalUtilityRecordAdm1Identity(row, record);
    if (!recordIdentity.name && !recordIdentity.id) {
      // A local/provider/station scope without an explicit state identity is
      // not safe to reuse for the selected ADM1.  This prevents a municipal
      // tariff or station observation from leaking into another state.
      return !globalUtilityAdm1BoundScope(scopeType);
    }
    if (selectedId && recordIdentity.id) {
      return selectedId.toLowerCase() === recordIdentity.id.toLowerCase();
    }
    var selectedKey = boundaryOptionMatchKey(selectedName);
    var recordKey = boundaryOptionMatchKey(recordIdentity.name);
    return Boolean(selectedKey && recordKey && selectedKey === recordKey);
  }

  function globalUtilityStrictPriceRows(data, category) {
    var db = globalUtilityEnergyDatabase(data, category);
    if (!db) {
      return [];
    }
    var relational = db.relational && typeof db.relational === "object" ? db.relational : {};
    var inspector = relational.discoveryInspector && typeof relational.discoveryInspector === "object"
      ? relational.discoveryInspector
      : {};
    var recordMap = (Array.isArray(db.records) ? db.records : []).reduce(function (map, record) {
      if (record && record.recordId !== null && record.recordId !== undefined) {
        map[String(record.recordId)] = record;
      }
      return map;
    }, {});
    var entries = globalUtilityCategoryItems(inspector.prices, category).filter(function (row) {
      var record = recordMap[String(row.recordId)] || {};
      return globalUtilityPositivePrice(row.price)
        && row.evidenceStatus === "verified_price"
        && /^[a-f0-9]{64}$/i.test(String(row.evidenceHash || ""))
        && /current_verified/i.test(String(row.status || ""))
        && /^https:\/\//i.test(String(row.officialSourceUrl || ""))
        && globalUtilityRecordAppliesToCurrentAdm1(row, record);
    }).map(function (row) {
      return {
        price: row,
        record: recordMap[String(row.recordId)] || {}
      };
    });
    var selectedArea = normalizePriceAreaCountry(priceAreaForRequest());
    var selectedName = textValue(selectedArea.adm1 || selectedArea.province || "");
    if (!selectedName || ["fuel", "electricity"].indexOf(String(category || "").toLowerCase()) === -1) {
      return entries;
    }

    var selectedKey = boundaryOptionMatchKey(selectedName);
    var bestSpecificity = {};
    function entryGroup(entry) {
      var row = entry.price || {};
      var record = entry.record || {};
      var metadata = globalUtilityRecordMetadata(record);
      var publisher = metadata.referencePublisherKey || metadata.referencePublisherName || row.provider || record.provider || "";
      var product = record.productNameNormalized || record.productName || record.customerClass || row.product || "";
      return globalUtilityScopeToken(publisher) + "|" + globalUtilityScopeToken(product);
    }
    function entrySpecificity(entry) {
      var row = entry.price || {};
      var record = entry.record || {};
      var identity = globalUtilityRecordAdm1Identity(row, record);
      if (identity.name && boundaryOptionMatchKey(identity.name) === selectedKey) {
        return 3;
      }
      if (globalUtilityRecordApplicableAdm1Names(record).some(function (name) {
        return boundaryOptionMatchKey(name) === selectedKey;
      })) {
        return 2;
      }
      return 1;
    }
    entries.forEach(function (entry) {
      var group = entryGroup(entry);
      bestSpecificity[group] = Math.max(bestSpecificity[group] || 0, entrySpecificity(entry));
    });
    return entries.filter(function (entry) {
      return entrySpecificity(entry) === bestSpecificity[entryGroup(entry)];
    });
  }

  function globalUtilitySpecLabel(record) {
    return [
      record.ron ? "RON " + record.ron : "",
      record.mon ? "MON " + record.mon : "",
      record.cn ? "CN " + record.cn : ""
    ].filter(Boolean).join(" / ");
  }

  function globalUtilityRangeLabel(start, end, suffix) {
    var values = [start, end].filter(function (value) {
      return value !== null && value !== undefined && value !== "";
    });
    if (!values.length) {
      return "";
    }
    var label = values.length === 2 && String(values[0]) !== String(values[1])
      ? values[0] + " - " + values[1]
      : String(values[0]);
    return label + (suffix ? " " + suffix : "");
  }

  function globalUtilityStrictRowSource(row) {
    return {
      sourceStatus: row.status || row.evidenceStatus || "verified_price",
      sourceUrl: row.officialSourceUrl || "",
      sourceLabel: row.officialSourceName || "Official source",
      updatedAt: row.retrievedAt || row.updatedAt || ""
    };
  }

  function globalUtilityOfficialReferenceLabel(row, record) {
    var metadata = record && record.metadata && typeof record.metadata === "object" ? record.metadata : {};
    var recordKind = String(row.recordKind || row.record_kind || record.recordKind || record.record_kind || metadata.recordKind || metadata.record_kind || "").toLowerCase();
    if (recordKind !== "official_reference") {
      return "";
    }
    var publisher = row.referencePublisherName
      || row.referencePublisher
      || row.publisher
      || metadata.referencePublisherName
      || metadata.reference_publisher_name
      || record.referencePublisherName
      || row.officialSourceName
      || row.regulator
      || record.officialSourceName
      || "publisher resmi";
    return "Referensi resmi - " + publisher;
  }

  function globalUtilityFuelRowsForEnergyTable(data) {
    return globalUtilityStrictPriceRows(data, "fuel").map(function (entry) {
      var row = entry.price;
      var record = entry.record;
      var metadata = globalUtilityRecordMetadata(record);
      var referenceLabel = globalUtilityOfficialReferenceLabel(row, record);
      var recordKind = String(row.recordKind || row.record_kind || record.recordKind || record.record_kind || metadata.recordKind || metadata.record_kind || "").toLowerCase();
      var priceType = String(row.priceType || row.price_type || record.priceType || record.price_type || metadata.priceType || metadata.price_type || "").toLowerCase();
      var scopeType = globalUtilityRecordScopeType(row, record).toUpperCase();
      var referencePrice = Boolean(referenceLabel) || recordKind === "official_reference" || priceType === "reference_price";
      var stationRetail = row.isStationRetailPrice === true || (!referencePrice && scopeType === "STATION" && Boolean(row.provider || record.provider || record.brand) &&
        metadata.stationApplicable === true && recordKind === "provider_station_price" && /station[_ -]?price|retail[_ -]?pump/.test(priceType));
      var priceTier = String(row.priceTier || metadata.priceTier || metadata.price_tier || "").trim().toLowerCase();
      var octaneIndex = String(metadata.octaneIndex || metadata.octane_index || "").trim();
      var octaneLabel = octaneIndex && /^\d+(?:\.\d+)?$/.test(octaneIndex) ? "AKI " + octaneIndex : "";
      var specificationParts = [];
      [octaneLabel, globalUtilitySpecLabel(record), record.fuelType || ""].forEach(function (part) {
        var value = String(part || "").trim();
        if (value && !specificationParts.some(function (present) { return present.toLowerCase() === value.toLowerCase(); })) {
          specificationParts.push(value);
        }
      });
      var priceClassLabel = referencePrice
        ? "Referensi/rata-rata retail resmi - bukan harga stasiun"
        : (stationRetail
          ? "Retail stasiun" + (priceTier ? " - " + (priceTier === "cash" ? "tunai" : (priceTier === "credit" ? "kredit" : priceTier)) : "")
          : "Harga resmi - scope " + (scopeType || "sumber"));
      return Object.assign({
        brand: referenceLabel || record.brand || row.brand || row.provider || record.provider || row.regulator || "Official publisher",
        product: row.product || record.productNameOriginal || record.productName || "Fuel product",
        ronCn: specificationParts.join(" / "),
        priceClass: referencePrice ? "reference" : (stationRetail ? "retail" : "other"),
        priceClassLabel: priceClassLabel,
        priceTier: priceTier,
        price: Number(row.price),
        priceText: record.priceText || record.originalPriceText || "",
        currency: row.currency || record.currency || "",
        unit: row.unit || record.unit || "liter",
        region: record.pricingArea || record.pricingZone || record.adm2 || record.adm1 || record.region || row.pricingScope || "",
        effectiveDate: [row.effectiveDate || "", row.effectiveTime || ""].filter(Boolean).join(" "),
        actualPumpPriceMayDiffer: metadata.actualPumpPriceMayDiffer === true,
        retailDisclosure: metadata.freshnessDisclosure || ""
      }, globalUtilityStrictRowSource(row));
    });
  }

  function usWaterTariffHierarchyRows() {
    var hierarchy = state.usWaterTariffHierarchy;
    if (!hierarchy || typeof hierarchy !== "object") {
      return [];
    }
    var country = hierarchy.country && typeof hierarchy.country === "object" ? hierarchy.country : {};
    var rows = [];
    (Array.isArray(country.states) ? country.states : []).forEach(function (stateEntry) {
      (Array.isArray(stateEntry.localAreas) ? stateEntry.localAreas : []).forEach(function (area) {
        (Array.isArray(area.utilities) ? area.utilities : []).forEach(function (utility) {
          (Array.isArray(utility.customerClasses) ? utility.customerClasses : []).forEach(function (customerClass) {
            (Array.isArray(customerClass.tariffs) ? customerClass.tariffs : []).forEach(function (tariff) {
              var price = tariff.price && typeof tariff.price === "object" ? tariff.price : {};
              var effective = tariff.effective && typeof tariff.effective === "object" ? tariff.effective : {};
              var source = tariff.officialSource && typeof tariff.officialSource === "object" ? tariff.officialSource : {};
              var identity = utility.epaRegistryIdentity && typeof utility.epaRegistryIdentity === "object" ? utility.epaRegistryIdentity : {};
              var qualification = tariff.billQualification && typeof tariff.billQualification === "object" ? tariff.billQualification : {};
              var tariffParts = [];
              [tariff.tariffName, tariff.tierLabel, tariff.tierThreshold, tariff.tariffCode ? "Kode " + tariff.tariffCode : ""].forEach(function (part) {
                var label = textValue(part);
                if (label && !tariffParts.some(function (present) { return present.toLowerCase() === label.toLowerCase(); })) {
                  tariffParts.push(label);
                }
              });
              var qualificationNotes = [];
              if (qualification.addressOrAccountRequired) {
                qualificationNotes.push("verifikasi alamat/akun diperlukan");
              }
              if (qualification.meterSizeRequiredForFullBill) {
                qualificationNotes.push("ukuran meter diperlukan untuk total tagihan");
              }
              var areaTypeLabels = {
                CITY: "City",
                COUNTY: "County",
                MUNICIPALITY: "Municipality",
                SERVICE_AREA: "Service Area"
              };
              var areaType = areaTypeLabels[String(area.type || "").toUpperCase()] || "Local Area";
              rows.push({
                country: country.name || "United States",
                state: stateEntry.name || "",
                localScope: [areaType, area.name || ""].filter(Boolean).join(": "),
                waterUtility: [utility.name || utility.billingUtility || "", identity.pwsId ? "EPA PWSID " + identity.pwsId : ""].filter(Boolean).join(" / "),
                customerGroup: customerClass.originalName || customerClass.name || "",
                tariffTier: tariffParts.join(" / "),
                price: price.amount,
                priceText: price.text || "",
                currency: price.currency || "",
                unit: price.unit || "",
                effectiveDate: [effective.from || "", effective.freshnessStatus || "", qualificationNotes.join("; ")].filter(Boolean).join(" - "),
                sourceUrl: source.url || "",
                sourceLabel: source.name || "Sumber tarif resmi",
                sourceStatus: tariff.evidence && tariff.evidence.chainStatus === "verified_complete" ? "current_verified" : ""
              });
            });
          });
        });
      });
    });
    return rows;
  }

  function globalUtilityElectricityRowsForEnergyTable(data) {
    return globalUtilityStrictPriceRows(data, "electricity").map(function (entry) {
      var row = entry.price;
      var record = entry.record;
      var referenceLabel = globalUtilityOfficialReferenceLabel(row, record);
      var capacity = [
        globalUtilityRangeLabel(record.powerCapacityMin, record.powerCapacityMax, "VA"),
        record.voltageClass || "",
        record.connectionType || ""
      ].filter(Boolean).join(" / ");
      return Object.assign({
        customerGroup: referenceLabel || record.customerClassOriginal || record.customerClass || record.tariffCode || row.product || "Golongan resmi",
        capacity: referenceLabel ? "Benchmark resmi - " + (row.product || row.pricingScope || "harga referensi") : (capacity || record.productType || "Kelas layanan"),
        price: Number(row.price),
        currency: row.currency || record.currency || "",
        unit: row.unit || record.unit || "kWh",
        region: record.pricingArea || record.adm2 || record.adm1 || record.region || row.pricingScope || "",
        effectivePeriod: [row.effectiveDate || "", row.effectiveTime || ""].filter(Boolean).join(" "),
        provider: referenceLabel || row.provider || record.provider || ""
      }, globalUtilityStrictRowSource(row));
    });
  }

  function globalUtilityInternetRowsForEnergyTable(data) {
    return globalUtilityStrictPriceRows(data, "internet").map(function (entry) {
      var row = entry.price;
      var record = entry.record;
      var speed = [
        record.downloadMbps !== null && record.downloadMbps !== undefined ? record.downloadMbps + " Mbps down" : "",
        record.uploadMbps !== null && record.uploadMbps !== undefined ? record.uploadMbps + " Mbps up" : ""
      ].filter(Boolean).join(" / ");
      var quota = record.unlimited === true
        ? "Unlimited"
        : globalUtilityRangeLabel(record.quotaValue, null, record.quotaUnit || "");
      return Object.assign({
        provider: row.provider || record.provider || "Official provider",
        packageName: record.packageName || row.product || record.productName || "Fixed internet package",
        speedLabel: speed || record.technology || "",
        quotaLabel: quota,
        price: Number(row.price),
        currency: row.currency || record.currency || "",
        unit: row.unit || record.unit || "month",
        region: record.pricingArea || record.serviceArea || record.adm2 || record.adm1 || record.region || row.pricingScope || ""
      }, globalUtilityStrictRowSource(row));
    });
  }

  function globalUtilityMobileRowsForEnergyTable(data) {
    return globalUtilityStrictPriceRows(data, "mobile").map(function (entry) {
      var row = entry.price;
      var record = entry.record;
      var metadata = globalUtilityRecordMetadata(record);
      var quota = record.unlimited === true
        ? "Unlimited"
        : globalUtilityRangeLabel(record.quotaValue, null, record.quotaUnit || "");
      var validity = globalUtilityRangeLabel(record.validityValue, null, record.validityUnit || "");
      return Object.assign({
        provider: row.provider || record.provider || "Official provider",
        operatorType: record.operatorType || record.operator_type || metadata.operatorType || metadata.operator_type || "",
        hostMno: record.hostMno || record.hostMNO || record.host_mno || metadata.hostMno || metadata.hostMNO || metadata.host_mno || "",
        packageName: record.packageName || row.product || record.productName || "Mobile package",
        quotaLabel: quota || record.networkGeneration || "",
        validityLabel: validity || record.billingPeriod || "",
        price: Number(row.price),
        currency: row.currency || record.currency || "",
        unit: row.unit || record.unit || "month",
        region: record.pricingArea || record.serviceArea || record.adm2 || record.adm1 || record.region || row.pricingScope || ""
      }, globalUtilityStrictRowSource(row));
    });
  }

  function usMobileOperatorCatalogRows() {
    var catalog = state.usMobileOperatorCatalog;
    if (!catalog || typeof catalog !== "object") {
      return [];
    }
    var rows = [];
    (Array.isArray(catalog.operators) ? catalog.operators : []).forEach(function (operator) {
      var operatorType = String(operator.operatorType || "").toUpperCase();
      var operatorHost = operatorType === "MVNO" && operator.hostMno && typeof operator.hostMno === "object"
        ? operator.hostMno
        : null;
      (Array.isArray(operator.packages) ? operator.packages : []).forEach(function (item) {
        var metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
        var packageType = String(item.operatorType || metadata.operatorType || operatorType || "").toUpperCase();
        var host = packageType === "MVNO"
          ? (item.hostMno && typeof item.hostMno === "object" ? item.hostMno : (metadata.hostMno && typeof metadata.hostMno === "object" ? metadata.hostMno : operatorHost))
          : null;
        if ((packageType !== "MNO" && packageType !== "MVNO") || (packageType === "MVNO" && (!host || host.verified !== true))) {
          return;
        }
        var conditions = [];
        (Array.isArray(item.conditions) ? item.conditions : []).forEach(function (condition) {
          var label = textValue(condition);
          if (label) {
            conditions.push(label);
          }
        });
        if (item.introductory) {
          conditions.push("harga introductory");
        }
        if (Number(item.regularPriceAmount) > 0) {
          conditions.push("harga reguler USD " + formatNumber(item.regularPriceAmount, 2));
        }
        if (item.taxInfo) {
          conditions.push(String(item.taxInfo));
        }
        if (item.coverageQualificationRequired) {
          conditions.push("coverage wajib dicek pada peta resmi");
        }
        var officialSource = item.officialSource && typeof item.officialSource === "object" ? item.officialSource : {};
        rows.push({
          provider: item.operatorName || item.provider || operator.operatorName || "Operator mobile",
          operatorType: packageType,
          hostMno: packageType === "MVNO" ? (host.operatorName || "") : "",
          packageName: item.packageName || item.productName || "Paket mobile",
          quotaLabel: item.dataAllowance || item.quotaText || (item.unlimited ? "Unlimited" : "-"),
          validityLabel: [Number(item.termMonths) > 0 ? item.termMonths + " bulan" : (item.billingPeriod || ""), Number(item.lineCount) > 0 ? item.lineCount + " line" : ""].filter(Boolean).join(" / "),
          price: Number(item.priceAmount),
          priceText: item.priceText || "",
          currency: item.currency || "USD",
          unit: item.unit || item.billingPeriod || "month",
          conditions: conditions.join("; "),
          region: [catalog.selectedStateName || "Amerika Serikat", "provider area; bukan tarif state yang seragam"].filter(Boolean).join(" - "),
          sourceUrl: officialSource.url || item.officialSourceUrl || (operator.priceSource && operator.priceSource.url) || "",
          sourceLabel: officialSource.name || (operator.priceSource && operator.priceSource.name) || "Sumber resmi operator",
          sourceStatus: item.verificationStatus || "verified_official",
          updatedAt: officialSource.retrievedAtUtc || item.observedAt || ""
        });
      });
    });
    return rows;
  }

  function usMobileOperatorCatalogBlockers() {
    var catalog = state.usMobileOperatorCatalog;
    if (!catalog || typeof catalog !== "object") {
      return [];
    }
    var names = {};
    (Array.isArray(catalog.operators) ? catalog.operators : []).forEach(function (operator) {
      names[String(operator.operatorKey || "")] = {
        name: operator.operatorName || operator.operatorKey || "Operator mobile",
        type: operator.operatorType || "",
        host: operator.hostMno && operator.hostMno.verified === true && operator.hostMno.operatorName ? operator.hostMno.operatorName : ""
      };
    });
    return (Array.isArray(catalog.failures) ? catalog.failures : []).map(function (failure) {
      var operator = names[String(failure.operatorKey || "")] || {};
      return {
        provider: operator.name || failure.operatorKey || "Operator mobile",
        operatorType: operator.type || "Belum diklasifikasikan",
        hostMno: operator.type === "MVNO" ? (operator.host || "Host MNO belum terverifikasi") : "",
        component: failure.component || "package_tariff",
        reason: failure.reason || failure.status || "Sumber resmi belum dapat diverifikasi",
        status: failure.status || "official-source-unavailable",
        sourceUrl: failure.officialSourceUrl || ""
      };
    });
  }

  function globalUtilityWaterRowsForEnergyTable(data) {
    var db = globalUtilityEnergyDatabase(data, "water") || {};
    var countryProfile = db.country && typeof db.country === "object" ? db.country : {};
    return globalUtilityStrictPriceRows(data, "water").map(function (entry) {
      var row = entry.price;
      var record = entry.record;
      var metadata = globalUtilityRecordMetadata(record);
      var tierNumber = metadata.tier !== null && metadata.tier !== undefined && metadata.tier !== ""
        ? "Tier " + metadata.tier
        : "";
      var tierThreshold = textValue(metadata.tierThreshold || metadata.tier_threshold || "");
      var productLabel = record.productNameOriginal || record.productName || row.product || "Tarif resmi";
      var tariffTier = [
        productLabel,
        tierNumber && String(productLabel).toLowerCase().indexOf(String(tierNumber).toLowerCase()) < 0 ? tierNumber : "",
        tierThreshold,
        record.tariffCode && String(productLabel).indexOf(record.tariffCode) < 0 ? "Kode " + record.tariffCode : ""
      ].filter(Boolean).join(" / ");
      var localScope = [];
      function appendLocalScope(label, value) {
        var text = textValue(value);
        if (!text) {
          return;
        }
        var normalized = text.toLowerCase();
        var duplicate = localScope.some(function (part) {
          return String(part.value || "").toLowerCase() === normalized;
        });
        if (!duplicate) {
          localScope.push({ label: label, value: text });
        }
      }
      appendLocalScope("County", record.county || metadata.county);
      appendLocalScope("City", record.city || record.municipality || metadata.city || metadata.municipality);
      appendLocalScope("ADM2", record.adm2);
      appendLocalScope("Service Area", record.serviceArea || record.pricingArea || record.pricingZone || metadata.serviceArea || metadata.service_area);
      return Object.assign({
        provider: row.provider || record.waterUtility || record.provider || "Official water utility",
        waterUtility: record.waterUtility || metadata.billingUtility || metadata.billing_utility || row.provider || record.provider || "Official water utility",
        country: countryProfile.countryNameEn || countryProfile.officialName || (data.priceArea && data.priceArea.country) || record.country || record.countryCode || "",
        state: record.adm1 || record.province || "",
        localScope: localScope.length
          ? localScope.map(function (part) { return part.label + ": " + part.value; }).join(" / ")
          : (record.region || row.pricingScope || ""),
        region: record.serviceArea || record.municipality || record.pricingArea || record.adm2 || record.adm1 || record.region || row.pricingScope || "",
        customerGroup: record.customerClassOriginal || record.customerClass || row.product || "Golongan pelanggan",
        blockLabel: globalUtilityRangeLabel(record.blockStart, record.blockEnd, record.unit || "m3") || record.tariffCode || "",
        tariffTier: tariffTier,
        tariffCode: record.tariffCode || "",
        price: Number(row.price),
        priceText: record.priceText || record.originalPriceText || "",
        currency: row.currency || record.currency || "",
        unit: row.unit || record.unit || "m3",
        effectiveDate: [row.effectiveDate || "", row.effectiveTime || ""].filter(Boolean).join(" ")
      }, globalUtilityStrictRowSource(row));
    });
  }

  function globalUtilitySourceCapabilities(source) {
    if (Array.isArray(source.capabilities)) {
      return source.capabilities.map(String);
    }
    return Array.isArray(source.sourceCapabilities) ? source.sourceCapabilities.map(String) : [];
  }

  function globalUtilityEnergySourcesForTable(data, category) {
    var db = globalUtilityEnergyDatabase(data, category);
    if (!db) {
      return [];
    }
    var relational = db.relational && typeof db.relational === "object" ? db.relational : {};
    var inspector = relational.discoveryInspector && typeof relational.discoveryInspector === "object"
      ? relational.discoveryInspector
      : {};
    var verifiedSources = globalUtilityCategoryItems(inspector.sources, category).map(function (source) {
      return { source: source, strict: true };
    });
    var stagingSources = globalUtilityCategoryItems(db.sourceRegistry, category).map(function (source) {
      return { source: source, strict: false };
    });
    var availability = globalUtilityCategoryAvailability(data, category);
    var seen = {};
    return verifiedSources.concat(stagingSources).filter(function (entry) {
      var source = entry.source || {};
      var url = String(source.officialUrl || source.apiUrl || source.documentUrl || source.url || "").trim();
      var role = String(source.sourceRole || source.sourceType || source.method || "").toLowerCase();
      var key = url.toLowerCase() || String(source.sourceName || source.sourceKey || "").toLowerCase();
      if (!/^https:\/\//i.test(url)
        || /(?:google|bing)\.com\/search/i.test(url)
        || /search_query|discovery_query/.test(role)
        || !key
        || seen[key]) {
        return false;
      }
      seen[key] = true;
      return true;
    }).slice(0, 12).map(function (entry) {
      var source = entry.source || {};
      var metadata = source.metadata && typeof source.metadata === "object" ? source.metadata : {};
      var capabilities = globalUtilitySourceCapabilities(source);
      var priceCapable = capabilities.some(function (capability) {
        return ["price_api", "price_page", "price_dataset", "price_document", "tariff_page", "tariff_document"].indexOf(capability) !== -1;
      });
      var statusParts = entry.strict
        ? ["Sumber resmi + role evidence terverifikasi", priceCapable ? "capability harga terverifikasi" : "capability harga belum terverifikasi"]
        : ["Staging", globalUtilityStatusLabel(source.verificationStatus || source.status || "candidate_source"), source.discoveryStage || ""];
      if (source.lastError) {
        statusParts.push("cek terakhir: " + source.lastError);
      }
      var scopeBlocker = globalUtilityScopeBlocker(data, category);
      var sourceReason = textValue(
        source.availabilityReason || source.reason || source.statusReason ||
        metadata.availabilityReason || metadata.reason || metadata.statusReason || ""
      );
      var categoryAvailabilityReason = [
        "official_source_no_record_for_scope",
        "official_source_no_public_price"
      ].indexOf(availability.code) !== -1 ? availability.reason : "";
      var evidenceMessage = categoryAvailabilityReason || sourceReason || (entry.strict
        ? (priceCapable
          ? "Harga resmi belum diterbitkan sampai provider, product, coverage, dan price evidence lengkap."
          : "Sumber resmi ini tidak menyediakan capability harga publik yang terverifikasi.")
        : "Kandidat belum dipromosikan menjadi sumber harga dan tetap berada di registry/staging.");
      return {
        brand: source.organization || source.provider || source.sourceName || "Official source",
        provider: source.organization || source.provider || source.sourceName || "Official source",
        label: source.sourceName || source.provider || "Official source",
        url: source.officialUrl || source.apiUrl || source.documentUrl || source.url || "",
        region: source.jurisdiction || source.geographicScope || source.pricingGeography || "",
        status: statusParts.filter(Boolean).join(" / "),
        message: [scopeBlocker, evidenceMessage, availability.checkedAt ? "Diperiksa " + formatDateTime(availability.checkedAt) + "." : ""].filter(Boolean).join(" "),
        updatedAt: source.lastSuccessAt || source.lastCheckedAt || source.updatedAt || "",
        sourceRole: source.sourceRole || "",
        verificationStatus: source.verificationStatus || source.status || "",
        adapterKey: source.adapterKey || source.parserKey || "",
        lastHttpStatus: source.lastHttpStatus || "",
        lastError: source.lastError || ""
      };
    });
  }

  function globalUtilityFuelSourcesForEnergyTable(data) {
    return globalUtilityEnergySourcesForTable(data, "fuel");
  }

  function globalUtilityStagingStatusCell(source) {
    var status = [source.status || "Registry/staging", source.updatedAt ? "Update " + source.updatedAt : ""]
      .filter(Boolean)
      .join(" - ");
    return escapeHtml(status) + "<br><span class=\"muted-cell\">" + escapeHtml(source.message || "Harga belum lolos evidence chain.") + "</span>";
  }

  function globalUtilityMissingProviderSources(rows, sources) {
    var rowProviders = (Array.isArray(rows) ? rows : []).map(function (row) {
      return String(row.provider || row.brand || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    }).filter(Boolean);
    return (Array.isArray(sources) ? sources : []).filter(function (source) {
      if (String(source.sourceRole || "").toLowerCase() !== "provider_registry") {
        return false;
      }
      var key = String(source.provider || source.brand || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (!key) {
        return false;
      }
      return !rowProviders.some(function (rowKey) {
        return rowKey === key || rowKey.indexOf(key) !== -1 || key.indexOf(rowKey) !== -1;
      });
    });
  }

  function globalUtilityProviderFetchBlocker(source) {
    var status = globalUtilityStatusLabel(source.verificationStatus || source.status || "candidate_source");
    var http = source.lastHttpStatus ? "HTTP " + source.lastHttpStatus : "";
    return [status, http, source.lastError || source.message || "Sumber resmi belum berhasil menghasilkan harga terverifikasi."].filter(Boolean).join(" - ");
  }

  function globalUtilityUnique(values) {
    var seen = {};
    return values.filter(function (value) {
      var key = String(value || "").trim();
      if (!key || seen[key]) {
        return false;
      }
      seen[key] = true;
      return true;
    });
  }

  function globalUtilityStatusLabel(status) {
    return {
      "automatic-discovery-needed": "Discovery otomatis dibutuhkan",
      "source-discovered-awaiting-extraction": "Sumber ditemukan, menunggu ekstraksi",
      "no-official-source-discovered": "Sumber resmi belum ditemukan",
      "waiting-discovery": "Auto discovery belum berjalan",
      "updated": "Data ter-update",
      "active": "Aktif",
      "review-required": "Perlu review",
      "candidate_source": "Kandidat sumber",
      "source_unavailable": "Sumber sementara tidak tersedia",
      "verified_official": "Sumber resmi terverifikasi",
      "verified_price": "Harga resmi terverifikasi",
      "current_verified": "Data aktif terverifikasi",
      "probable_official": "Kemungkinan sumber resmi",
      "dynamic_discovery_ready": "Discovery dinamis siap",
      "records-extracted-needs-review": "Data kandidat diekstrak, perlu review",
      "generic-html-no-price-records": "Halaman resmi dicek, harga belum terbaca",
      "source-discovered-no-records-extracted": "Sumber dicek, record belum terekstrak",
      "checked-no-tariff-change-or-no-records": "Sumber dicek, belum ada record baru",
      "no-fetch-success": "Sumber belum bisa diambil",
      "fetch-failed": "Fetch sumber gagal",
      "parser-not-implemented": "Parser sumber belum tersedia",
      "pdf-downloaded-tariff-table-parser-unsupported": "PDF resmi terunduh, parser tabel belum tersedia",
      "provider-found-no-public-tariff-table": "Sumber terhubung, tabel publik belum terbaca",
      "no_official_source_found": "Sumber resmi tidak ditemukan",
      "official_source_no_public_price": "Sumber resmi tidak mempublikasikan harga",
      "official_source_no_verified_price": "Harga resmi belum lolos evidence chain",
      "candidate_unverified": "Kandidat sumber masih diverifikasi",
      "scope_unresolved": "Cakupan harga belum terverifikasi",
      "source_unreachable": "Sumber resmi tidak dapat dijangkau",
      "parser_unsupported": "Format sumber belum dapat diekstrak",
      "category_load_failed": "Database kategori gagal dimuat",
      "discovery_pending": "Pemeriksaan sumber resmi belum dijalankan"
    }[status] || status || "-";
  }

  function globalUtilitySourceCell(sources, db, category) {
    if (!sources.length) {
      var availability = globalUtilityCategoryAvailability(state.energyPrices || { globalUtilityDatabase: db }, category);
      return escapeHtml(availability.label) + "<br><span class=\"muted-cell\">" + escapeHtml(globalUtilityAvailabilityDetails(availability)) + "</span>";
    }
    return sources.slice(0, 3).map(function (source) {
      var label = source.sourceName || source.provider || source.sourceKey || "Sumber";
      var provider = source.provider && source.provider !== source.sourceName ? source.provider : "";
      var meta = [
        provider,
        source.sourceType || "",
        globalUtilityStatusLabel(source.verificationStatus || source.status || ""),
        source.verificationScore !== undefined ? "score " + source.verificationScore : "",
        source.method || "",
        source.updateFrequency || ""
      ].filter(Boolean).join(" / ");
      return formatSourceLink(source.officialUrl, label) + (meta ? "<br><span class=\"muted-cell\">" + escapeHtml(meta) + "</span>" : "");
    }).join("<br>");
  }

  function globalUtilityRecordCell(rows, normalizedCount, country, category) {
    var first = rows[0] || {};
    var amountReady = first.priceAmount !== null && first.priceAmount !== undefined && first.priceAmount !== "";
    var availability = globalUtilityCategoryAvailability(state.energyPrices || {}, category);
    var priceText = amountReady
      ? formatEnergyPrice(first.priceAmount, first.currency || country.currency || "", first.unit || globalUtilityDefaultUnit(category))
      : escapeHtml(normalizedCount ? (first.priceText || first.originalValue || availability.label) : availability.label);
    var product = [
      first.productName || first.product || first.packageName || first.tariffCode || "-",
      first.productType || first.customerClass || first.technology || ""
    ].filter(Boolean).join(" / ");
    var countLabel = normalizedCount ? normalizedCount + " normalized record" : "0 normalized record";
    if (!normalizedCount && first.status === "source-review-ready") {
      countLabel += " / menunggu extraction";
    }
    if (!normalizedCount && first.status === "automatic-discovery-needed") {
      countLabel += " / discovery dibutuhkan";
    }
    return escapeHtml(countLabel) + "<br><span class=\"muted-cell\">" + escapeHtml(product) + " - " + priceText + "</span>";
  }

  function globalUtilityPipelineCategory(db, category) {
    var pipeline = db && db.pipeline && typeof db.pipeline === "object" ? db.pipeline : null;
    if (!pipeline) {
      return null;
    }
    if (pipeline.categoryMap && pipeline.categoryMap[category]) {
      return pipeline.categoryMap[category];
    }
    var categories = Array.isArray(pipeline.categories) ? pipeline.categories : [];
    return categories.find(function (item) {
      return item && item.category === category;
    }) || null;
  }

  function globalUtilityStatusCell(db, rows, sources, category) {
    var pipelineCategory = globalUtilityPipelineCategory(db, category);
    var statuses = globalUtilityUnique(rows.map(function (row) {
      return row.status || "";
    }).concat(sources.map(function (source) {
      return source.verificationStatus || source.status || "";
    }))).slice(0, 4);
    if (pipelineCategory && pipelineCategory.status) {
      statuses.unshift(pipelineCategory.status);
    }
    if (!statuses.length) {
      statuses = ["waiting-discovery"];
    }
    var storage = db.databaseOnline ? "SQL global utility aktif" : "Fallback seed";
    if (db.databaseError) {
      storage += " - " + db.databaseError;
    }
    var counts = pipelineCategory
      ? "found " + (pipelineCategory.sourcesDiscovered || 0) + ", verified " + (pipelineCategory.sourcesVerified || 0) + ", fetched " + (pipelineCategory.pagesFetched || 0) + ", records " + (pipelineCategory.recordsExtracted || 0)
      : storage;
    return globalUtilityUnique(statuses).map(function (status) {
      return escapeHtml(globalUtilityStatusLabel(status));
    }).join("<br>") + "<br><span class=\"muted-cell\">" + escapeHtml(counts) + "</span>";
  }

  function globalUtilityUpdateCell(rows, sources, country, category) {
    var first = rows[0] || {};
    var source = sources[0] || {};
    var updated = first.retrievedAt || first.effectiveDate || first.updatedAt || source.updatedAt || "";
    var languages = first.language || source.language || (Array.isArray(country.languages) ? country.languages.join(",") : "");
    var unit = (first.currency || country.currency || "-") + "/" + (first.unit || globalUtilityDefaultUnit(category));
    var documentLink = first.sourceDocument && first.sourceDocument !== first.officialSourceUrl
      ? "<br>" + formatSourceLink(first.sourceDocument, "Dokumen")
      : "";
    return escapeHtml(updated ? formatDateTime(updated) : "-") +
      "<br><span class=\"muted-cell\">" + escapeHtml(unit) + (languages ? " - " + escapeHtml(languages) : "") + "</span>" + documentLink;
  }

  function globalUtilityCountryLabel(country) {
    return country.officialName || country.countryNameEn || country.iso2 || "-";
  }

  function globalUtilityPriceText(record) {
    if (!record) {
      return "-";
    }
    if (record.priceText) {
      return escapeHtml(record.priceText);
    }
    return formatEnergyPrice(record.priceAmount, record.currency || "", record.unit || "");
  }

  function globalUtilityDateText(record) {
    return record.effectiveFromDate || record.validFrom || record.effectiveDate || "";
  }

  function globalUtilityTimeText(record) {
    return record.effectiveFromTime || "";
  }

  function globalUtilitySourceLink(record) {
    var url = record.sourceDocument || record.officialSourceUrl || "";
    var label = record.officialSourceName || record.sourceSection || "Sumber";
    return formatSourceLink(url, label);
  }

  function globalUtilityActionButton(entity, id, label) {
    if (!id) {
      return "-";
    }
    return "<button type=\"button\" class=\"mini-button global-edit-button\" data-global-edit=\"" + escapeHtml(entity) + "\" data-global-id=\"" + escapeHtml(String(id)) + "\">" + escapeHtml(label || "Edit") + "</button>";
  }

  function globalUtilityEntityLink(entity, id, label) {
    if (!id) {
      return escapeHtml(label || "-");
    }
    return "<button type=\"button\" class=\"link-button\" data-global-edit=\"" + escapeHtml(entity) + "\" data-global-id=\"" + escapeHtml(String(id)) + "\">" + escapeHtml(label || "-") + "</button>";
  }

  function globalUtilityTimestampText(parts) {
    return Object.keys(parts || {}).map(function (key) {
      return parts[key] ? key + " " + formatDateTime(parts[key]) : "";
    }).filter(Boolean).join(" - ") || "-";
  }

  function globalUtilityQuotaText(record) {
    if (record.quotaValue !== null && record.quotaValue !== undefined && record.quotaValue !== "") {
      return record.quotaValue + (record.quotaUnit ? " " + record.quotaUnit : "");
    }
    return record.unlimited ? "Unlimited" : "-";
  }

  function globalUtilityFallbackMessage(db, category) {
    var pipeline = globalUtilityPipelineCategory(db, category);
    if (pipeline && Array.isArray(pipeline.events) && pipeline.events.length) {
      return pipeline.events.slice(-2).join(" / ");
    }
    if (pipeline && pipeline.status) {
      return globalUtilityStatusLabel(pipeline.status);
    }
    var profiles = Array.isArray(db.countrySourceProfile) ? db.countrySourceProfile : [];
    var profile = profiles.find(function (item) {
      return item && item.category === category;
    });
    if (profile) {
      return globalUtilityStatusLabel(profile.verificationStatus) + " - " + (profile.marketModel || "model negara siap");
    }
    var availability = globalUtilityCategoryAvailability(state.energyPrices || { globalUtilityDatabase: db }, category);
    return availability.label + " - " + globalUtilityAvailabilityDetails(availability);
  }

  function globalUtilityRenderEmpty(tbody, colSpan, db, category) {
    if (tbody) {
      tbody.innerHTML = emptyRow(colSpan, globalUtilityFallbackMessage(db, category));
    }
  }

  function globalDiscoveryEvidenceCell(row) {
    var locator = textValue(row && row.evidenceLocator) || "locator tidak tersedia";
    var hash = textValue(row && row.evidenceHash);
    var confidence = row && row.evidenceConfidence !== undefined ? Number(row.evidenceConfidence) : null;
    var status = textValue(row && row.evidenceStatus);
    var hashLabel = hash ? "sha256 " + hash.slice(0, 16) + (hash.length > 16 ? "..." : "") : "hash tidak tersedia";
    var label = [locator, hashLabel, status, Number.isFinite(confidence) ? "confidence " + confidence : ""].filter(Boolean).join(" / ");
    var title = hash ? "SHA-256 " + hash : label;
    return '<span title="' + escapeHtml(title) + '">' + escapeHtml(label) + "</span>";
  }

  function renderGlobalDiscoveryInspector(db, country) {
    if (!refs.globalDiscoveryStatus) {
      return;
    }
    var rel = db && db.relational && typeof db.relational === "object" ? db.relational : null;
    var inspector = rel && rel.discoveryInspector && typeof rel.discoveryInspector === "object" ? rel.discoveryInspector : null;
    var emptyMessage = "Discovery inspector belum dimuat.";
    if (!inspector) {
      clearGlobalDiscoveryInspector(emptyMessage);
      return;
    }

    var summary = inspector.summary || {};
    refs.globalDiscoveryStatus.textContent = "Inspector " + (inspector.country || country.countryNameEn || country.iso2 || "-") +
      (inspector.categoryFilter ? " - " + globalUtilityCategoryLabel(inspector.categoryFilter) : " - semua kategori") +
      ". Authority " + (summary.authorityFound || 0) +
      ", provider " + (summary.providerFound || 0) +
      ", coverage " + (summary.coverageFound || 0) +
      ", source " + (summary.sourceFound || 0) +
      ", product " + (summary.productFound || 0) +
      ", price " + (summary.priceFound || 0) +
      (summary.priceRowsTruncated ? " (" + (summary.priceRowsReturned || 0) + " rows ditampilkan)" : "") +
      ", pattern " + (summary.patternCount || 0) +
      ", coverage quality " + (summary.coverageQualityCount || 0) +
      ", error " + (summary.errorCount || 0) + ".";

    var runs = Array.isArray(inspector.runs) ? inspector.runs : [];
    refs.globalDiscoveryRunTableBody.innerHTML = runs.map(function (run) {
      return "<tr>" +
        "<td>" + escapeHtml((run.country || inspector.country || "-") + " (" + (run.countryCode || inspector.countryCode || "-") + ")") + "</td>" +
        "<td>" + escapeHtml(globalUtilityCategoryLabel(run.category || "")) + "</td>" +
        "<td>" + escapeHtml(run.state || "-") + "</td>" +
        "<td>" + escapeHtml([run.marketModel || "", run.pricingScope || ""].filter(Boolean).join(" / ") || "-") + "</td>" +
        "<td>" + escapeHtml(String(run.authorityCount || 0)) + "</td>" +
        "<td>" + escapeHtml(String(run.providerCount || 0)) + "</td>" +
        "<td>" + escapeHtml(String(run.coverageCount || 0)) + "</td>" +
        "<td>" + escapeHtml(String(run.sourceCount || 0)) + "</td>" +
        "<td>" + escapeHtml(String(run.productCount || 0)) + "</td>" +
        "<td>" + escapeHtml(String(run.priceCount || 0)) + "</td>" +
        "<td>" + escapeHtml(String(run.errorCount || 0)) + "</td>" +
        "<td>" + escapeHtml(run.completedAt ? formatDateTime(run.completedAt) : (run.startedAt ? formatDateTime(run.startedAt) : "-")) + "</td>" +
      "</tr>";
    }).join("") || emptyRow(12, "Belum ada discovery run. Pilih kategori atau tekan Refresh online.");

    var stages = Array.isArray(inspector.stages) ? inspector.stages : [];
    refs.globalDiscoveryStageTableBody.innerHTML = stages.map(function (stage) {
      return "<tr>" +
        "<td>" + escapeHtml(globalUtilityCategoryLabel(stage.category || "")) + "</td>" +
        "<td>" + escapeHtml(stage.stageKey || "-") + "</td>" +
        "<td>" + escapeHtml(stage.state || "-") + "</td>" +
        "<td>" + escapeHtml(globalUtilityStatusLabel(stage.status || "-")) + "</td>" +
        "<td>" + escapeHtml(String(stage.itemCount || 0)) + "</td>" +
        "<td>" + escapeHtml(stage.error || "-") + "</td>" +
        "<td>" + escapeHtml(stage.startedAt ? formatDateTime(stage.startedAt) : "-") + "</td>" +
        "<td>" + escapeHtml(stage.completedAt ? formatDateTime(stage.completedAt) : "-") + "</td>" +
      "</tr>";
    }).join("") || emptyRow(8, "Stage discovery belum ada.");

    var qualityRows = Array.isArray(inspector.coverageQuality) ? inspector.coverageQuality : [];
    refs.globalDiscoveryQualityTableBody.innerHTML = qualityRows.map(function (row) {
      var evidence = row.evidence && row.evidence.metrics ? row.evidence.metrics : {};
      var evidenceText = Object.keys(evidence).map(function (key) {
        return key + " " + evidence[key];
      }).slice(0, 4).join(", ");
      return "<tr>" +
        "<td>" + escapeHtml(globalUtilityCategoryLabel(row.category || "")) + "</td>" +
        "<td>" + escapeHtml(row.component || "-") + "</td>" +
        "<td>" + escapeHtml(row.status || "-") + "</td>" +
        "<td>" + escapeHtml(String(row.score || 0)) + "</td>" +
        "<td>" + escapeHtml(evidenceText || "-") + "</td>" +
        "<td>" + escapeHtml(row.updatedAt ? formatDateTime(row.updatedAt) : "-") + "</td>" +
      "</tr>";
    }).join("") || emptyRow(6, "Coverage quality belum tersimpan.");

    var patterns = Array.isArray(inspector.patterns) ? inspector.patterns : [];
    refs.globalDiscoveryPatternTableBody.innerHTML = patterns.map(function (row) {
      return "<tr>" +
        "<td>" + escapeHtml(globalUtilityCategoryLabel(row.category || "")) + "</td>" +
        "<td>" + escapeHtml(row.patternKey || "-") + "</td>" +
        "<td>" + escapeHtml([row.marketModel || "", row.pricingScope || ""].filter(Boolean).join(" / ") || "-") + "</td>" +
        "<td>" + escapeHtml(row.authority || "-") + "</td>" +
        "<td>" + escapeHtml(String(row.providerCount || 0)) + "</td>" +
        "<td>" + escapeHtml(String(row.sourceCount || 0)) + "</td>" +
        "<td>" + escapeHtml(String(row.productCount || 0)) + "</td>" +
        "<td>" + escapeHtml(String(row.priceCount || 0)) + "</td>" +
        "<td>" + escapeHtml(String(row.confidence || 0)) + "</td>" +
        "<td>" + escapeHtml(row.lastSuccessAt ? formatDateTime(row.lastSuccessAt) : "-") + "</td>" +
      "</tr>";
    }).join("") || emptyRow(10, "Discovery pattern memory belum tersedia.");

    var authorities = Array.isArray(inspector.authorities) ? inspector.authorities : [];
    refs.globalAuthorityTableBody.innerHTML = authorities.map(function (row) {
      return "<tr>" +
        "<td>" + escapeHtml((row.country || "-") + " (" + (row.countryCode || "-") + ")") + "</td>" +
        "<td>" + escapeHtml(globalUtilityCategoryLabel(row.category || "")) + "</td>" +
        "<td>" + globalUtilityEntityLink("organization", row.organizationId, row.authority || row.legalName || "-") + "</td>" +
        "<td>" + escapeHtml(row.authorityType || "-") + "</td>" +
        "<td>" + escapeHtml(row.jurisdiction || "-") + "</td>" +
        "<td>" + formatSourceLink(row.officialUrl, "Official URL") + "</td>" +
        "<td>" + formatSourceLink(row.sourceUrl, row.sourceName || "Source") + "</td>" +
        "<td>" + escapeHtml((row.verified || "-") + (row.verificationScore !== undefined ? " / " + row.verificationScore : "")) + "</td>" +
        "<td>" + globalDiscoveryEvidenceCell(row) + "</td>" +
      "</tr>";
    }).join("") || emptyRow(9, "Authority/regulator terverifikasi belum ditemukan untuk filter ini.");

    var providers = Array.isArray(inspector.providers) ? inspector.providers : [];
    refs.globalProviderTableBody.innerHTML = providers.map(function (row) {
      return "<tr>" +
        "<td>" + escapeHtml((inspector.country || country.countryNameEn || "-") + " (" + (inspector.countryCode || country.iso2 || "-") + ")") + "</td>" +
        "<td>" + escapeHtml(globalUtilityCategoryLabel(row.category || "")) + "</td>" +
        "<td>" + globalUtilityEntityLink("organization", row.organizationId, row.provider || "-") + "</td>" +
        "<td>" + escapeHtml(row.legalEntity || "-") + "</td>" +
        "<td>" + escapeHtml(row.originCountry || "-") + "</td>" +
        "<td>" + escapeHtml(row.operationArea || "-") + "</td>" +
        "<td>" + escapeHtml(row.regulator || "-") + "</td>" +
        "<td>" + formatSourceLink(row.officialWebsite, row.sourceName || "Website") + "</td>" +
        "<td>" + escapeHtml((row.verified || "-") + (row.confidence !== undefined ? " / " + row.confidence : "")) + "</td>" +
        "<td>" + globalDiscoveryEvidenceCell(row) + "</td>" +
      "</tr>";
    }).join("") || emptyRow(10, "Provider dengan registry, authority, dan evidence terverifikasi belum ditemukan.");

    var coverage = Array.isArray(inspector.coverage) ? inspector.coverage : [];
    refs.globalCoverageTableBody.innerHTML = coverage.map(function (row) {
      return "<tr>" +
        "<td>" + escapeHtml(row.provider || "-") + "</td>" +
        "<td>" + escapeHtml((row.country || "-") + " (" + (row.countryCode || "-") + ")") + "</td>" +
        "<td>" + escapeHtml(row.adm1 || "-") + "</td>" +
        "<td>" + escapeHtml(row.adm2 || "-") + "</td>" +
        "<td>" + escapeHtml(row.serviceArea || row.coverageReferenceType || "-") + "</td>" +
        "<td>" + escapeHtml(row.pricingZone || "-") + "</td>" +
        "<td>" + formatSourceLink(row.sourceUrl, row.sourceName || "Source") + "</td>" +
        "<td>" + escapeHtml((row.verified || "-") + (row.confidence !== undefined ? " / " + row.confidence : "")) + "</td>" +
        "<td>" + globalDiscoveryEvidenceCell(row) + "</td>" +
      "</tr>";
    }).join("") || emptyRow(9, "Coverage eksplisit dengan evidence terverifikasi belum tersedia.");

    var products = Array.isArray(inspector.products) ? inspector.products : [];
    refs.globalProductTableBody.innerHTML = products.map(function (row) {
      return "<tr>" +
        "<td>" + escapeHtml(row.provider || "-") + "</td>" +
        "<td>" + escapeHtml(globalUtilityCategoryLabel(row.category || "")) + "</td>" +
        "<td>" + escapeHtml(row.product || "-") + "</td>" +
        "<td>" + escapeHtml(row.grade || "-") + "</td>" +
        "<td>" + escapeHtml(row.spec || "-") + "</td>" +
        "<td>" + formatSourceLink(row.sourceUrl, row.sourceName || "Source") + "</td>" +
        "<td>" + escapeHtml((row.verified || "-") + (row.confidence !== undefined ? " / " + row.confidence : "")) + "</td>" +
        "<td>" + globalDiscoveryEvidenceCell(row) + "</td>" +
      "</tr>";
    }).join("") || emptyRow(8, "Product/tariff dengan evidence terverifikasi belum tersedia.");

    var sources = Array.isArray(inspector.sources) ? inspector.sources : [];
    refs.globalDiscoverySourceTableBody.innerHTML = sources.map(function (row) {
      return "<tr>" +
        "<td>" + escapeHtml((inspector.countryCode || country.iso2 || "-") + " / " + globalUtilityCategoryLabel(row.category || "")) + "</td>" +
        "<td>" + escapeHtml(row.organization || "-") + "</td>" +
        "<td>" + escapeHtml(row.sourceRole || "-") + "</td>" +
        "<td>" + escapeHtml(Array.isArray(row.capabilities) && row.capabilities.length ? row.capabilities.join(", ") : "-") + "</td>" +
        "<td>" + escapeHtml(row.sourceType || "-") + "</td>" +
        "<td>" + formatSourceLink(row.officialUrl, row.sourceName || "Official URL") + "</td>" +
        "<td>" + escapeHtml(row.language || "-") + "</td>" +
        "<td>" + escapeHtml((row.verified || "-") + (row.verificationScore !== undefined ? " / source " + row.verificationScore : "") + (row.roleConfidence !== undefined ? " / role " + row.roleConfidence : "")) + "</td>" +
        "<td>" + globalDiscoveryEvidenceCell(row) + "</td>" +
        "<td>" + escapeHtml(row.updatedAt ? formatDateTime(row.updatedAt) : "-") + "</td>" +
      "</tr>";
    }).join("") || emptyRow(10, "Source registry belum memiliki role, capability, dan evidence tervalidasi.");

    var prices = Array.isArray(inspector.prices) ? inspector.prices : [];
    refs.globalDiscoveryPriceTableBody.innerHTML = prices.map(function (row) {
      var price = row.price !== null && row.price !== undefined ? formatEnergyPrice(row.price, row.currency || "", row.unit || "") : "-";
      var effective = [row.effectiveDate || "", row.effectiveTime || "", row.effectiveTimezone || ""].filter(Boolean).join(" ");
      return "<tr>" +
        "<td>" + escapeHtml(row.countryCode || inspector.countryCode || "-") + "</td>" +
        "<td>" + escapeHtml(row.pricingScope || "-") + "</td>" +
        "<td>" + escapeHtml(row.provider || "-") + "</td>" +
        "<td>" + escapeHtml(row.product || "-") + "</td>" +
        "<td>" + price + "</td>" +
        "<td>" + escapeHtml(effective || "-") + "</td>" +
        "<td>" + escapeHtml(row.regulator || "-") + "</td>" +
        "<td>" + formatSourceLink(row.officialSourceUrl, row.officialSourceName || "Official source") + "</td>" +
        "<td>" + escapeHtml(row.status || "-") + "</td>" +
        "<td>" + globalDiscoveryEvidenceCell(row) + "</td>" +
        "<td>" + escapeHtml(row.updatedAt ? formatDateTime(row.updatedAt) : "-") + "</td>" +
      "</tr>";
    }).join("") || emptyRow(11, "Price dengan rantai authority/provider/coverage/product/source terverifikasi belum tersedia.");

    var graph = Array.isArray(inspector.graph) ? inspector.graph : [];
    refs.globalDiscoveryGraphTableBody.innerHTML = graph.map(function (row) {
      return "<tr>" +
        "<td>" + escapeHtml(globalUtilityCategoryLabel(row.category || "")) + "</td>" +
        "<td>" + escapeHtml(row.parent || "-") + "</td>" +
        "<td>" + escapeHtml(row.relationship || "-") + "</td>" +
        "<td>" + escapeHtml(row.child || "-") + "</td>" +
        "<td>" + escapeHtml(row.jurisdiction || "-") + "</td>" +
        "<td>" + formatSourceLink(row.sourceUrl, row.sourceName || "Source") + "</td>" +
        "<td>" + escapeHtml((row.verified || "-") + (row.confidence !== undefined ? " / " + row.confidence : "")) + "</td>" +
        "<td>" + globalDiscoveryEvidenceCell(row) + "</td>" +
      "</tr>";
    }).join("") || emptyRow(8, "Relationship graph terverifikasi belum tersedia.");
  }

  function renderGlobalRelationalModel(db, country) {
    if (!refs.globalRelationalStatus) {
      return;
    }
    var rel = db && db.relational && typeof db.relational === "object" ? db.relational : null;
    if (!rel || !rel.schemaVersion) {
      refs.globalRelationalStatus.textContent = "Model relasional belum dimuat.";
      [
        [refs.globalRelationalCountTableBody, 3],
        [refs.globalRelationTableBody, 12],
        [refs.globalOrganizationTableBody, 8],
        [refs.globalPricingAreaTableBody, 9],
        [refs.globalOfficialSourceTableBody, 9],
        [refs.globalUncoveredTableBody, 4]
      ].forEach(function (pair) {
        if (pair[0]) {
          pair[0].innerHTML = emptyRow(pair[1], refs.globalRelationalStatus.textContent);
        }
      });
      return;
    }
    var summary = rel.summary || {};
    var sync = rel.syncSummary || {};
    var admSeed = sync.admSeed && typeof sync.admSeed === "object" ? sync.admSeed : {};
    var admSeedText = admSeed.status
      ? ". ADM seed " + admSeed.status + " ADM1 " + (admSeed.adm1Seeded || 0) + ", ADM2 " + (admSeed.adm2Seeded || 0) + ", parent " + (admSeed.adm2Parented || 0) + "/" + (admSeed.adm2Seeded || 0)
      : "";
    var compacted = sync.admAliasesCompacted && typeof sync.admAliasesCompacted === "object" ? Number(sync.admAliasesCompacted.merged || 0) : 0;
    var pruned = sync.admRecordAreasPruned && typeof sync.admRecordAreasPruned === "object" ? Number(sync.admRecordAreasPruned.removed || 0) : 0;
    var compactText = compacted > 0 ? ". ADM alias compacted " + compacted : "";
    var pruneText = pruned > 0 ? ". ADM record pruned " + pruned : "";
    refs.globalRelationalStatus.textContent = "Schema " + rel.schemaVersion + ". Country " + (summary.countryCount || 0) + ", ADM1 " + (summary.adm1Count || 0) + ", ADM2 " + (summary.adm2Count || 0) + ", regulator " + (summary.regulatorCount || 0) + ", provider " + (summary.providerCount || 0) + ", official source " + (summary.officialSourceCount || 0) + ", fuel current/history " + (summary.fuelPriceCurrentCount || 0) + "/" + (summary.fuelPriceHistoricalCount || 0) + ". Mirror " + (sync.recordsMirrored || 0) + " record" + admSeedText + compactText + pruneText + ".";

    var counts = Array.isArray(rel.counts) ? rel.counts : [];
    refs.globalRelationalCountTableBody.innerHTML = counts.map(function (item) {
      return "<tr>" +
        "<td>" + escapeHtml(item.label || item.table || "-") + "</td>" +
        "<td>" + escapeHtml(String(item.allRows || 0)) + "</td>" +
        "<td>" + escapeHtml(String(item.countryRows || 0)) + "</td>" +
      "</tr>";
    }).join("") || emptyRow(3, "Belum ada count relasional.");

    var relationRows = Array.isArray(rel.relationshipRows) ? rel.relationshipRows : [];
    refs.globalRelationTableBody.innerHTML = relationRows.map(function (row) {
      var octane = [row.ron ? "RON " + row.ron : "", row.mon ? "MON " + row.mon : "", row.cn ? "CN " + row.cn : ""].filter(Boolean).join(" / ") || "-";
      var price = row.price !== null && row.price !== undefined ? formatEnergyPrice(row.price, row.currency || "", row.unit || "") : "-";
      var effective = [row.effectiveDate || "", row.effectiveTime || "", row.effectiveTimezone || ""].filter(Boolean).join(" ");
      return "<tr>" +
        "<td>" + escapeHtml((row.pricingArea || "-") + (row.pricingType ? " / " + row.pricingType : "")) + "</td>" +
        "<td>" + escapeHtml(row.regulators || "-") + "</td>" +
        "<td>" + globalUtilityEntityLink("organization", row.providerId, row.provider || row.providerLegalName || "-") + "</td>" +
        "<td>" + escapeHtml(row.providerOrigin || "-") + "</td>" +
        "<td>" + escapeHtml(row.product || row.localProduct || "-") + "</td>" +
        "<td>" + escapeHtml(octane) + "</td>" +
        "<td>" + price + "</td>" +
        "<td>" + escapeHtml(effective || "-") + "</td>" +
        "<td>" + formatSourceLink(row.sourceUrl, row.sourceName || "Official source") + "</td>" +
        "<td>" + escapeHtml(row.createdAt ? formatDateTime(row.createdAt) : "-") + "</td>" +
        "<td>" + escapeHtml(row.updatedAt ? formatDateTime(row.updatedAt) : "-") + "</td>" +
        "<td>" + globalUtilityActionButton("price-record", row.legacyRecordId, "Edit harga") + "</td>" +
      "</tr>";
    }).join("") || emptyRow(12, "Relasi BBM belum punya current fuel_price untuk negara ini.");

    var organizations = Array.isArray(rel.organizations) ? rel.organizations : [];
    refs.globalOrganizationTableBody.innerHTML = organizations.map(function (item) {
      return "<tr>" +
        "<td>" + globalUtilityEntityLink("organization", item.organizationId, item.brandName || item.legalName || "-") + "<br><span class=\"muted-cell\">" + escapeHtml(item.legalName || "-") + "</span></td>" +
        "<td>" + escapeHtml(item.roles || "-") + "</td>" +
        "<td>" + escapeHtml(item.countryOrigin || "-") + "</td>" +
        "<td>" + escapeHtml(item.operationAreas || "-") + "</td>" +
        "<td>" + formatSourceLink(item.officialWebsite, item.officialSources || "Website") + "</td>" +
        "<td>" + escapeHtml(item.createdAt ? formatDateTime(item.createdAt) : "-") + "</td>" +
        "<td>" + escapeHtml(item.updatedAt ? formatDateTime(item.updatedAt) : "-") + "</td>" +
        "<td>" + globalUtilityActionButton("organization", item.organizationId, "Edit") + "</td>" +
      "</tr>";
    }).join("") || emptyRow(8, "Organization/provider/regulator belum tersedia.");

    var pricingAreas = Array.isArray(rel.pricingAreas) ? rel.pricingAreas : [];
    refs.globalPricingAreaTableBody.innerHTML = pricingAreas.map(function (item) {
      return "<tr>" +
        "<td>" + globalUtilityEntityLink("pricing-area", item.pricingAreaId, item.name || "-") + "</td>" +
        "<td>" + escapeHtml(globalUtilityCategoryLabel(item.category || "")) + "</td>" +
        "<td>" + escapeHtml(item.pricingType || "-") + "</td>" +
        "<td>" + escapeHtml(item.admScope || "-") + "</td>" +
        "<td>" + escapeHtml([item.currency || "", item.unitPolicy || ""].filter(Boolean).join("/") || "-") + "</td>" +
        "<td>" + escapeHtml(item.effectiveTimezone || "-") + "</td>" +
        "<td>" + escapeHtml(item.createdAt ? formatDateTime(item.createdAt) : "-") + "</td>" +
        "<td>" + escapeHtml(item.updatedAt ? formatDateTime(item.updatedAt) : "-") + "</td>" +
        "<td>" + globalUtilityActionButton("pricing-area", item.pricingAreaId, "Edit") + "</td>" +
      "</tr>";
    }).join("") || emptyRow(9, "Pricing area belum tersedia.");

    var officialSources = Array.isArray(rel.officialSources) ? rel.officialSources : [];
    refs.globalOfficialSourceTableBody.innerHTML = officialSources.map(function (source) {
      return "<tr>" +
        "<td>" + formatSourceLink(source.officialUrl, source.sourceName || "Official source") + "</td>" +
        "<td>" + escapeHtml(globalUtilityCategoryLabel(source.category || "")) + "</td>" +
        "<td>" + escapeHtml(source.organization || "-") + "</td>" +
        "<td>" + escapeHtml(source.sourceType || "-") + "</td>" +
        "<td>" + escapeHtml(globalUtilityStatusLabel(source.verificationStatus || "-") + " / " + (source.verificationScore || 0)) + "</td>" +
        "<td>" + escapeHtml([source.lastCheckedAt || "", source.lastSuccessAt || ""].filter(Boolean).map(formatDateTime).join(" / ") || "-") + "</td>" +
        "<td>" + escapeHtml(source.createdAt ? formatDateTime(source.createdAt) : "-") + "</td>" +
        "<td>" + escapeHtml(source.updatedAt ? formatDateTime(source.updatedAt) : "-") + "</td>" +
        "<td>" + (source.legacySourceId ? globalUtilityActionButton("source", source.legacySourceId, "Edit") : "-") + "</td>" +
      "</tr>";
    }).join("") || emptyRow(9, "Official source belum tersedia.");

    var uncovered = Array.isArray(rel.uncoveredCountries) ? rel.uncoveredCountries : [];
    refs.globalUncoveredTableBody.innerHTML = uncovered.slice(0, 40).map(function (row) {
      return "<tr>" +
        "<td>" + escapeHtml((row.country || row.countryCode || "-") + " (" + (row.countryCode || "-") + ")") + "</td>" +
        "<td>" + escapeHtml(row.currency || "-") + "</td>" +
        "<td>" + escapeHtml(Array.isArray(row.coveredCategories) && row.coveredCategories.length ? row.coveredCategories.map(globalUtilityCategoryLabel).join(", ") : "-") + "</td>" +
        "<td>" + escapeHtml(Array.isArray(row.missingCategories) ? row.missingCategories.map(globalUtilityCategoryLabel).join(", ") : "-") + "</td>" +
      "</tr>";
    }).join("") || emptyRow(4, "Coverage country lengkap untuk kategori yang dimuat.");
  }

  function globalUtilityCurrentDb() {
    return state.energyPrices && state.energyPrices.globalUtilityDatabase && typeof state.energyPrices.globalUtilityDatabase === "object"
      ? state.energyPrices.globalUtilityDatabase
      : null;
  }

  function findGlobalEntity(entity, id) {
    var db = globalUtilityCurrentDb();
    var rel = db && db.relational && typeof db.relational === "object" ? db.relational : {};
    var numericId = Number(id);
    if (entity === "price-record") {
      return (Array.isArray(db && db.records) ? db.records : []).find(function (item) {
        return Number(item.recordId) === numericId;
      }) || null;
    }
    if (entity === "source") {
      return (Array.isArray(db && db.sourceRegistry) ? db.sourceRegistry : []).find(function (item) {
        return Number(item.sourceId) === numericId;
      }) || null;
    }
    if (entity === "organization") {
      return (Array.isArray(rel.organizations) ? rel.organizations : []).find(function (item) {
        return Number(item.organizationId) === numericId;
      }) || null;
    }
    if (entity === "pricing-area") {
      return (Array.isArray(rel.pricingAreas) ? rel.pricingAreas : []).find(function (item) {
        return Number(item.pricingAreaId) === numericId;
      }) || null;
    }
    return null;
  }

  function globalEditSetValue(input, value) {
    if (input) {
      input.value = value === null || value === undefined ? "" : String(value);
    }
  }

  function openGlobalEdit(entity, id) {
    var item = findGlobalEntity(entity, id);
    if (!item || !refs.globalEditPanel) {
      return;
    }
    state.globalEditContext = {
      entity: entity,
      id: Number(id),
      item: Object.assign({}, item)
    };
    refs.globalEditPanel.hidden = false;
    refs.globalEditEntityInput.value = entity;
    refs.globalEditEntityIdInput.value = String(id);
    refs.globalEditMessage.textContent = "Perubahan belum disimpan.";
    if (entity === "price-record") {
      refs.globalEditTitle.textContent = "Edit harga #" + id;
      refs.globalEditTimestampText.textContent = globalUtilityTimestampText({
        Dibuat: item.createdAt,
        Update: item.updatedAt,
        Retrieved: item.retrievedAtLocal || item.retrievedAtUtc || item.retrievedAt,
        Effective: [globalUtilityDateText(item), globalUtilityTimeText(item)].filter(Boolean).join(" ")
      });
      globalEditSetValue(refs.globalEditNameInput, item.provider || "");
      globalEditSetValue(refs.globalEditSecondaryNameInput, item.productNameOriginal || item.productName || item.packageName || "");
      globalEditSetValue(refs.globalEditCategoryInput, item.category || "fuel");
      globalEditSetValue(refs.globalEditPriceInput, item.priceAmount);
      globalEditSetValue(refs.globalEditCurrencyInput, item.currency || item.normalizedCurrency || "");
      globalEditSetValue(refs.globalEditUnitInput, item.unit || item.normalizedUnit || item.originalUnit || "");
      globalEditSetValue(refs.globalEditPricingAreaInput, item.pricingArea || item.pricingZone || item.region || "");
      globalEditSetValue(refs.globalEditEffectiveDateInput, item.effectiveFromDate || item.validFrom || item.effectiveDate || "");
      globalEditSetValue(refs.globalEditEffectiveTimeInput, item.effectiveFromTime || "");
      globalEditSetValue(refs.globalEditTimezoneInput, item.effectiveTimezone || "");
      globalEditSetValue(refs.globalEditUrlInput, item.officialSourceUrl || item.sourceDocument || "");
      globalEditSetValue(refs.globalEditStatusInput, item.status || "");
      globalEditSetValue(refs.globalEditLanguageInput, item.language || "");
      globalEditSetValue(refs.globalEditSourceTypeInput, item.productType || item.fuelType || "");
      globalEditSetValue(refs.globalEditMethodInput, "");
      globalEditSetValue(refs.globalEditAdapterInput, item.parserVersion || "");
      globalEditSetValue(refs.globalEditScoreInput, item.confidenceScore || item.parserConfidence || "");
      globalEditSetValue(refs.globalEditNotesInput, item.dataQualityStatus || item.originalText || "");
    } else if (entity === "source") {
      refs.globalEditTitle.textContent = "Edit source #" + id;
      refs.globalEditTimestampText.textContent = globalUtilityTimestampText({
        Dibuat: item.createdAt,
        Update: item.updatedAt,
        Discovered: item.discoveredAt,
        Checked: item.lastCheckedAt,
        Success: item.lastSuccessAt
      });
      globalEditSetValue(refs.globalEditNameInput, item.sourceName || "");
      globalEditSetValue(refs.globalEditSecondaryNameInput, item.provider || "");
      globalEditSetValue(refs.globalEditCategoryInput, item.category || "fuel");
      globalEditSetValue(refs.globalEditPriceInput, "");
      globalEditSetValue(refs.globalEditCurrencyInput, "");
      globalEditSetValue(refs.globalEditUnitInput, "");
      globalEditSetValue(refs.globalEditPricingAreaInput, item.pricingGeography || item.geographicScope || "");
      globalEditSetValue(refs.globalEditEffectiveDateInput, "");
      globalEditSetValue(refs.globalEditEffectiveTimeInput, "");
      globalEditSetValue(refs.globalEditTimezoneInput, "");
      globalEditSetValue(refs.globalEditUrlInput, item.officialUrl || "");
      globalEditSetValue(refs.globalEditStatusInput, item.status || "");
      globalEditSetValue(refs.globalEditLanguageInput, item.language || "");
      globalEditSetValue(refs.globalEditSourceTypeInput, item.sourceType || "");
      globalEditSetValue(refs.globalEditMethodInput, item.method || "");
      globalEditSetValue(refs.globalEditAdapterInput, item.adapterKey || item.parserType || "");
      globalEditSetValue(refs.globalEditScoreInput, item.verificationScore || "");
      globalEditSetValue(refs.globalEditNotesInput, item.lastError || "");
    } else if (entity === "organization") {
      refs.globalEditTitle.textContent = "Edit organization #" + id;
      refs.globalEditTimestampText.textContent = globalUtilityTimestampText({
        Dibuat: item.createdAt,
        Update: item.updatedAt
      });
      globalEditSetValue(refs.globalEditNameInput, item.legalName || "");
      globalEditSetValue(refs.globalEditSecondaryNameInput, item.brandName || "");
      globalEditSetValue(refs.globalEditCategoryInput, "fuel");
      globalEditSetValue(refs.globalEditPriceInput, "");
      globalEditSetValue(refs.globalEditCurrencyInput, "");
      globalEditSetValue(refs.globalEditUnitInput, "");
      globalEditSetValue(refs.globalEditPricingAreaInput, item.operationAreas || "");
      globalEditSetValue(refs.globalEditEffectiveDateInput, "");
      globalEditSetValue(refs.globalEditEffectiveTimeInput, "");
      globalEditSetValue(refs.globalEditTimezoneInput, "");
      globalEditSetValue(refs.globalEditUrlInput, item.officialWebsite || "");
      globalEditSetValue(refs.globalEditStatusInput, item.activeStatus || "active");
      globalEditSetValue(refs.globalEditLanguageInput, "");
      globalEditSetValue(refs.globalEditSourceTypeInput, item.ownershipType || "");
      globalEditSetValue(refs.globalEditMethodInput, "");
      globalEditSetValue(refs.globalEditAdapterInput, "");
      globalEditSetValue(refs.globalEditScoreInput, "");
      globalEditSetValue(refs.globalEditNotesInput, item.localName || "");
    } else if (entity === "pricing-area") {
      refs.globalEditTitle.textContent = "Edit pricing area #" + id;
      refs.globalEditTimestampText.textContent = globalUtilityTimestampText({
        Dibuat: item.createdAt,
        Update: item.updatedAt
      });
      globalEditSetValue(refs.globalEditNameInput, item.name || "");
      globalEditSetValue(refs.globalEditSecondaryNameInput, item.admScope || "");
      globalEditSetValue(refs.globalEditCategoryInput, item.category || "fuel");
      globalEditSetValue(refs.globalEditPriceInput, "");
      globalEditSetValue(refs.globalEditCurrencyInput, item.currency || "");
      globalEditSetValue(refs.globalEditUnitInput, item.unitPolicy || "");
      globalEditSetValue(refs.globalEditPricingAreaInput, item.name || "");
      globalEditSetValue(refs.globalEditEffectiveDateInput, "");
      globalEditSetValue(refs.globalEditEffectiveTimeInput, "");
      globalEditSetValue(refs.globalEditTimezoneInput, item.effectiveTimezone || "");
      globalEditSetValue(refs.globalEditUrlInput, "");
      globalEditSetValue(refs.globalEditStatusInput, item.pricingType || "national");
      globalEditSetValue(refs.globalEditLanguageInput, "");
      globalEditSetValue(refs.globalEditSourceTypeInput, "");
      globalEditSetValue(refs.globalEditMethodInput, "");
      globalEditSetValue(refs.globalEditAdapterInput, "");
      globalEditSetValue(refs.globalEditScoreInput, "");
      globalEditSetValue(refs.globalEditNotesInput, item.admScope || "");
    }
    refs.globalEditPanel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function resetGlobalEdit() {
    state.globalEditContext = null;
    if (refs.globalEditPanel) {
      refs.globalEditPanel.hidden = true;
    }
  }

  function collectGlobalEditFields() {
    var context = state.globalEditContext || {};
    var entity = context.entity || "";
    var item = Object.assign({}, context.item || {});
    if (entity === "price-record") {
      return Object.assign(item, {
        recordId: context.id,
        provider: refs.globalEditNameInput.value.trim(),
        productName: refs.globalEditSecondaryNameInput.value.trim(),
        productNameOriginal: refs.globalEditSecondaryNameInput.value.trim(),
        category: refs.globalEditCategoryInput.value,
        priceAmount: refs.globalEditPriceInput.value,
        currency: refs.globalEditCurrencyInput.value.trim().toUpperCase(),
        normalizedCurrency: refs.globalEditCurrencyInput.value.trim().toUpperCase(),
        unit: refs.globalEditUnitInput.value.trim(),
        normalizedUnit: refs.globalEditUnitInput.value.trim(),
        pricingArea: refs.globalEditPricingAreaInput.value.trim(),
        effectiveDate: refs.globalEditEffectiveDateInput.value,
        validFrom: refs.globalEditEffectiveDateInput.value,
        effectiveFromDate: refs.globalEditEffectiveDateInput.value,
        effectiveFromTime: refs.globalEditEffectiveTimeInput.value,
        effectiveTimezone: refs.globalEditTimezoneInput.value.trim(),
        officialSourceUrl: refs.globalEditUrlInput.value.trim(),
        sourceDocument: refs.globalEditUrlInput.value.trim(),
        status: refs.globalEditStatusInput.value.trim() || item.status || "review-required",
        language: refs.globalEditLanguageInput.value.trim(),
        productType: item.productType || refs.globalEditSourceTypeInput.value.trim(),
        fuelType: item.fuelType || refs.globalEditSourceTypeInput.value.trim(),
        parserVersion: refs.globalEditAdapterInput.value.trim() || item.parserVersion,
        confidenceScore: refs.globalEditScoreInput.value,
        dataQualityStatus: refs.globalEditNotesInput.value.trim() || item.dataQualityStatus || "needs_review"
      });
    }
    if (entity === "source") {
      return Object.assign(item, {
        sourceId: context.id,
        provider: refs.globalEditSecondaryNameInput.value.trim(),
        sourceName: refs.globalEditNameInput.value.trim(),
        category: refs.globalEditCategoryInput.value,
        officialUrl: refs.globalEditUrlInput.value.trim(),
        status: refs.globalEditStatusInput.value.trim() || "review-required",
        language: refs.globalEditLanguageInput.value.trim(),
        sourceType: refs.globalEditSourceTypeInput.value.trim() || "company",
        method: refs.globalEditMethodInput.value.trim() || "html",
        adapterKey: refs.globalEditAdapterInput.value.trim() || "generic_tariff_html",
        parserType: refs.globalEditAdapterInput.value.trim() || item.parserType || "",
        verificationScore: refs.globalEditScoreInput.value,
        verificationStatus: item.verificationStatus || refs.globalEditStatusInput.value.trim(),
        geographicScope: refs.globalEditPricingAreaInput.value.trim(),
        pricingGeography: refs.globalEditPricingAreaInput.value.trim(),
        lastError: refs.globalEditNotesInput.value.trim()
      });
    }
    if (entity === "organization") {
      return Object.assign(item, {
        organizationId: context.id,
        legalName: refs.globalEditNameInput.value.trim(),
        brandName: refs.globalEditSecondaryNameInput.value.trim(),
        localName: refs.globalEditNotesInput.value.trim(),
        officialWebsite: refs.globalEditUrlInput.value.trim(),
        activeStatus: refs.globalEditStatusInput.value.trim() || "active",
        ownershipType: refs.globalEditSourceTypeInput.value.trim()
      });
    }
    if (entity === "pricing-area") {
      return Object.assign(item, {
        pricingAreaId: context.id,
        name: refs.globalEditNameInput.value.trim(),
        category: refs.globalEditCategoryInput.value,
        pricingType: refs.globalEditStatusInput.value.trim() || "national",
        currency: refs.globalEditCurrencyInput.value.trim().toUpperCase(),
        unitPolicy: refs.globalEditUnitInput.value.trim(),
        effectiveTimezone: refs.globalEditTimezoneInput.value.trim()
      });
    }
    return item;
  }

  function saveGlobalEdit(event) {
    event.preventDefault();
    var context = state.globalEditContext;
    if (!context || state.globalEditBusy) {
      return;
    }
    var action = {
      "price-record": "save-price-record",
      source: "save-source",
      organization: "save-organization",
      "pricing-area": "save-pricing-area"
    }[context.entity];
    if (!action) {
      return;
    }
    state.globalEditBusy = true;
    refs.globalEditSaveButton.disabled = true;
    refs.globalEditSaveButton.textContent = "Menyimpan...";
    refs.globalEditMessage.textContent = "Menyimpan ke database...";
    postGlobalUtilitySave(action, collectGlobalEditFields()).then(function (payload) {
      if (!payload || payload.success === false) {
        throw new Error(payload && payload.error ? payload.error : "Save gagal");
      }
      state.energyPrices = state.energyPrices || {};
      var savedDatabase = payload.data || payload;
      state.energyPrices.globalUtilityDatabase = savedDatabase;
      cacheGlobalUtilityCategoryDatabase(globalUtilityDatabaseCategoryFilter(savedDatabase) || globalDiscoveryCategory(), savedDatabase);
      attachGlobalUtilityCategoryDatabases(state.energyPrices);
      state.energyPricesLoaded = true;
      refs.globalEditMessage.textContent = "Tersimpan " + formatDateTime((payload.data && payload.data.saveResult && payload.data.saveResult.savedAt) || new Date().toISOString()) + ".";
      renderEnergyPrices();
    }).catch(function (error) {
      refs.globalEditMessage.textContent = error && error.message ? error.message : "Gagal menyimpan.";
    }).then(function () {
      state.globalEditBusy = false;
      refs.globalEditSaveButton.disabled = false;
      refs.globalEditSaveButton.textContent = "Simpan";
    });
  }

  function handleGlobalEditAction(event) {
    var button = event.target && event.target.closest ? event.target.closest("[data-global-edit]") : null;
    if (!button) {
      return;
    }
    var entity = button.getAttribute("data-global-edit") || "";
    var id = button.getAttribute("data-global-id") || "";
    if (!entity || !id) {
      return;
    }
    event.preventDefault();
    openGlobalEdit(entity, id);
  }

  function renderGlobalFuelRows(db, country, records) {
    if (!refs.globalFuelRecordTableBody) {
      return;
    }
    var rows = globalUtilityCategoryItems(records, "fuel");
    if (!rows.length) {
      globalUtilityRenderEmpty(refs.globalFuelRecordTableBody, 17, db, "fuel");
      return;
    }
    refs.globalFuelRecordTableBody.innerHTML = rows.slice(0, 120).map(function (record) {
      var octane = [record.ron ? "RON " + record.ron : "", record.mon ? "MON " + record.mon : "", record.cn ? "CN " + record.cn : ""].filter(Boolean).join(" / ") || "-";
      return "<tr>" +
        "<td>" + escapeHtml(globalUtilityCountryLabel(country)) + "</td>" +
        "<td>" + escapeHtml(record.pricingArea || record.region || "-") + "</td>" +
        "<td>" + escapeHtml(record.adm1 || record.region || "-") + "</td>" +
        "<td>" + escapeHtml([record.provider || "", record.brand || ""].filter(Boolean).join(" / ") || "-") + "</td>" +
        "<td>" + escapeHtml(record.productNameOriginal || record.productName || "-") + "</td>" +
        "<td>" + escapeHtml(octane) + "</td>" +
        "<td>" + escapeHtml(record.fuelType || record.productType || "-") + "</td>" +
        "<td>" + globalUtilityPriceText(record) + "</td>" +
        "<td>" + escapeHtml(record.currency || "-") + "</td>" +
        "<td>" + escapeHtml(record.unit || "-") + "</td>" +
        "<td>" + escapeHtml(record.priceType || record.tariffCode || "-") + "</td>" +
        "<td>" + escapeHtml(globalUtilityDateText(record) || "-") + "</td>" +
        "<td>" + escapeHtml(globalUtilityTimeText(record) || "-") + "</td>" +
        "<td>" + escapeHtml(record.effectiveTimezone || record.effectiveTimezoneScope || "-") + "</td>" +
        "<td>" + escapeHtml(record.effectiveToDate || record.validTo || "-") + "</td>" +
        "<td>" + globalUtilitySourceLink(record) + "</td>" +
        "<td>" + escapeHtml(record.retrievedAtLocal || record.retrievedAtUtc || record.retrievedAt || "-") + "</td>" +
      "</tr>";
    }).join("");
  }

  function renderGlobalElectricityRows(db, country, records) {
    if (!refs.globalElectricityRecordTableBody) {
      return;
    }
    var rows = globalUtilityCategoryItems(records, "electricity");
    if (!rows.length) {
      globalUtilityRenderEmpty(refs.globalElectricityRecordTableBody, 17, db, "electricity");
      return;
    }
    refs.globalElectricityRecordTableBody.innerHTML = rows.slice(0, 120).map(function (record) {
      var power = [record.powerCapacityMin || "", record.powerCapacityMax || "", record.voltageClass || ""].filter(Boolean).join(" - ") || record.connectionType || "-";
      var block = [record.blockStart, record.blockEnd].filter(function (value) { return value !== null && value !== undefined && value !== ""; }).join(" - ") || "-";
      return "<tr>" +
        "<td>" + escapeHtml(globalUtilityCountryLabel(country)) + "</td>" +
        "<td>" + escapeHtml(record.pricingArea || record.region || "-") + "</td>" +
        "<td>" + escapeHtml(record.utilityName || record.provider || "-") + "</td>" +
        "<td>" + escapeHtml(record.customerClassOriginal || record.customerClass || "-") + "</td>" +
        "<td>" + escapeHtml(record.tariffCode || "-") + "</td>" +
        "<td>" + escapeHtml(power) + "</td>" +
        "<td>" + escapeHtml(block) + "</td>" +
        "<td>" + escapeHtml(record.timeOfUsePeriod || "-") + "</td>" +
        "<td>" + formatEnergyPrice(record.energyCharge || record.priceAmount, record.currency || "", record.unit || "kWh") + "</td>" +
        "<td>" + formatEnergyPrice(record.fixedCharge, record.currency || "", "") + "</td>" +
        "<td>" + formatEnergyPrice(record.demandCharge, record.currency || "", "") + "</td>" +
        "<td>" + escapeHtml(record.taxAmount || record.taxIncluded || "-") + "</td>" +
        "<td>" + escapeHtml(record.currency || "-") + "</td>" +
        "<td>" + escapeHtml(record.unit || "-") + "</td>" +
        "<td>" + escapeHtml(globalUtilityDateText(record) || "-") + "</td>" +
        "<td>" + escapeHtml(globalUtilityTimeText(record) || "-") + "</td>" +
        "<td>" + globalUtilitySourceLink(record) + "</td>" +
      "</tr>";
    }).join("");
  }

  function renderGlobalWaterRows(db, country, records) {
    if (!refs.globalWaterRecordTableBody) {
      return;
    }
    var rows = globalUtilityCategoryItems(records, "water");
    if (!rows.length) {
      globalUtilityRenderEmpty(refs.globalWaterRecordTableBody, 14, db, "water");
      return;
    }
    refs.globalWaterRecordTableBody.innerHTML = rows.slice(0, 120).map(function (record) {
      var block = [record.blockStart, record.blockEnd].filter(function (value) { return value !== null && value !== undefined && value !== ""; }).join(" - ") || "-";
      return "<tr>" +
        "<td>" + escapeHtml(globalUtilityCountryLabel(country)) + "</td>" +
        "<td>" + escapeHtml(record.pricingArea || record.region || "-") + "</td>" +
        "<td>" + escapeHtml(record.waterUtility || record.provider || "-") + "</td>" +
        "<td>" + escapeHtml(record.customerClassOriginal || record.customerClass || "-") + "</td>" +
        "<td>" + escapeHtml(record.meterSize || "-") + "</td>" +
        "<td>" + escapeHtml(block) + "</td>" +
        "<td>" + formatEnergyPrice(record.waterCharge || record.priceAmount, record.currency || "", record.unit || "m3") + "</td>" +
        "<td>" + formatEnergyPrice(record.fixedCharge, record.currency || "", "") + "</td>" +
        "<td>" + formatEnergyPrice(record.sewerageCharge, record.currency || "", "") + "</td>" +
        "<td>" + formatEnergyPrice(record.sanitationCharge, record.currency || "", "") + "</td>" +
        "<td>" + escapeHtml(record.currency || "-") + "</td>" +
        "<td>" + escapeHtml(record.unit || "-") + "</td>" +
        "<td>" + escapeHtml(globalUtilityDateText(record) || "-") + "</td>" +
        "<td>" + globalUtilitySourceLink(record) + "</td>" +
      "</tr>";
    }).join("");
  }

  function renderGlobalInternetRows(db, country, records) {
    if (!refs.globalInternetRecordTableBody) {
      return;
    }
    var rows = globalUtilityCategoryItems(records, "internet");
    if (!rows.length) {
      globalUtilityRenderEmpty(refs.globalInternetRecordTableBody, 15, db, "internet");
      return;
    }
    refs.globalInternetRecordTableBody.innerHTML = rows.slice(0, 120).map(function (record) {
      return "<tr>" +
        "<td>" + escapeHtml(globalUtilityCountryLabel(country)) + "</td>" +
        "<td>" + escapeHtml(record.provider || "-") + "</td>" +
        "<td>" + escapeHtml(record.packageName || record.productName || "-") + "</td>" +
        "<td>" + escapeHtml(record.technology || "-") + "</td>" +
        "<td>" + escapeHtml(record.downloadMbps ? record.downloadMbps + " Mbps" : "-") + "</td>" +
        "<td>" + escapeHtml(record.uploadMbps ? record.uploadMbps + " Mbps" : "-") + "</td>" +
        "<td>" + escapeHtml(globalUtilityQuotaText(record)) + "</td>" +
        "<td>" + escapeHtml(record.unlimited === null || record.unlimited === undefined ? "-" : (record.unlimited ? "Ya" : "Tidak")) + "</td>" +
        "<td>-</td>" +
        "<td>" + globalUtilityPriceText(record) + "</td>" +
        "<td>" + escapeHtml(record.billingPeriod || record.unit || "-") + "</td>" +
        "<td>" + escapeHtml(record.contractMonths || "-") + "</td>" +
        "<td>" + escapeHtml(record.pricingArea || record.region || "-") + "</td>" +
        "<td>" + escapeHtml(globalUtilityDateText(record) || "-") + "</td>" +
        "<td>" + globalUtilitySourceLink(record) + "</td>" +
      "</tr>";
    }).join("");
  }

  function renderGlobalMobileRows(db, country, records) {
    if (!refs.globalMobileRecordTableBody) {
      return;
    }
    var rows = globalUtilityCategoryItems(records, "mobile");
    if (!rows.length) {
      globalUtilityRenderEmpty(refs.globalMobileRecordTableBody, 12, db, "mobile");
      return;
    }
    refs.globalMobileRecordTableBody.innerHTML = rows.slice(0, 120).map(function (record) {
      var validity = record.validityValue ? record.validityValue + " " + (record.validityUnit || "") : (record.originalUnit || "-");
      return "<tr>" +
        "<td>" + escapeHtml(globalUtilityCountryLabel(country)) + "</td>" +
        "<td>" + escapeHtml(record.provider || record.brand || "-") + "</td>" +
        "<td>" + escapeHtml(record.packageName || record.productName || "-") + "</td>" +
        "<td>" + escapeHtml(record.productType || "-") + "</td>" +
        "<td>" + escapeHtml(globalUtilityQuotaText(record)) + "</td>" +
        "<td>" + escapeHtml(validity) + "</td>" +
        "<td>" + escapeHtml(record.networkGeneration || record.technology || "-") + "</td>" +
        "<td>" + globalUtilityPriceText(record) + "</td>" +
        "<td>" + escapeHtml(record.currency || "-") + "</td>" +
        "<td>" + escapeHtml(record.recurring === null || record.recurring === undefined ? "-" : (record.recurring ? "Ya" : "Tidak")) + "</td>" +
        "<td>" + escapeHtml(globalUtilityDateText(record) || "-") + "</td>" +
        "<td>" + globalUtilitySourceLink(record) + "</td>" +
      "</tr>";
    }).join("");
  }

  function renderGlobalSourceRows(db, country) {
    if (!refs.globalSourceRegistryTableBody) {
      return;
    }
    var registry = Array.isArray(db.sourceRegistry) ? db.sourceRegistry : [];
    var profiles = Array.isArray(db.countrySourceProfile) ? db.countrySourceProfile : [];
    if (!registry.length) {
      refs.globalSourceRegistryTableBody.innerHTML = emptyRow(11, "Registry belum berisi sumber untuk negara ini; auto discovery akan mencari kandidat resmi saat negara/kategori dimuat.");
      return;
    }
    refs.globalSourceRegistryTableBody.innerHTML = registry.map(function (source) {
      var profile = profiles.find(function (item) {
        return item && item.category === source.category;
      }) || {};
      return "<tr>" +
        "<td>" + escapeHtml(source.countryCode || country.iso2 || "-") + "</td>" +
        "<td>" + escapeHtml(globalUtilityCategoryLabel(source.category || "")) + "</td>" +
        "<td>" + escapeHtml(source.provider || source.sourceName || "-") + "</td>" +
        "<td>" + escapeHtml(source.sourceType || "-") + "</td>" +
        "<td>" + formatSourceLink(source.officialUrl, source.sourceName || "Official URL") + "</td>" +
        "<td>" + escapeHtml(source.language || profile.officialLanguage || "-") + "</td>" +
        "<td>" + escapeHtml(source.geographicScope || source.pricingGeography || profile.pricingGeographyType || "-") + "</td>" +
        "<td>" + escapeHtml(globalUtilityStatusLabel(source.verificationStatus || source.status || "-") + (source.verificationScore !== undefined ? " / " + source.verificationScore : "")) + "</td>" +
        "<td>" + escapeHtml(source.lastSuccessAt || "-") + "</td>" +
        "<td>" + escapeHtml(source.lastError || "-") + "</td>" +
        "<td>" + escapeHtml(source.adapterKey || source.parserType || "-") + "</td>" +
      "</tr>";
    }).join("");
  }

  function clearGlobalDetailTables(message, preserveDiscovery) {
    var pairs = [
      [refs.globalFuelRecordTableBody, 17],
      [refs.globalElectricityRecordTableBody, 17],
      [refs.globalWaterRecordTableBody, 14],
      [refs.globalInternetRecordTableBody, 15],
      [refs.globalMobileRecordTableBody, 12],
      [refs.globalSourceRegistryTableBody, 11],
      [refs.globalRelationalCountTableBody, 3],
      [refs.globalRelationTableBody, 12],
      [refs.globalOrganizationTableBody, 8],
      [refs.globalPricingAreaTableBody, 9],
      [refs.globalOfficialSourceTableBody, 9],
      [refs.globalUncoveredTableBody, 4]
    ];
    if (!preserveDiscovery) {
      pairs = pairs.concat([
        [refs.globalDiscoveryRunTableBody, 12],
        [refs.globalDiscoveryStageTableBody, 8],
        [refs.globalDiscoveryQualityTableBody, 6],
        [refs.globalDiscoveryPatternTableBody, 10],
        [refs.globalAuthorityTableBody, 9],
        [refs.globalProviderTableBody, 10],
        [refs.globalCoverageTableBody, 9],
        [refs.globalProductTableBody, 8],
        [refs.globalDiscoverySourceTableBody, 10],
        [refs.globalDiscoveryPriceTableBody, 11],
        [refs.globalDiscoveryGraphTableBody, 8]
      ]);
    }
    pairs.forEach(function (pair) {
      if (pair[0]) {
        pair[0].innerHTML = emptyRow(pair[1], message);
      }
    });
    if (refs.globalRelationalStatus) {
      refs.globalRelationalStatus.textContent = message;
    }
    if (refs.globalDiscoveryStatus && !preserveDiscovery) {
      refs.globalDiscoveryStatus.textContent = message;
    }
  }

  function renderGlobalUtilityDatabase(data) {
    if (!refs.globalUtilityStatus || !refs.globalUtilityTableBody) {
      return;
    }
    var db = data && data.globalUtilityDatabase && typeof data.globalUtilityDatabase === "object"
      ? data.globalUtilityDatabase
      : null;
    if (!state.energyPricesLoaded || !db) {
      refs.globalUtilityStatus.textContent = state.energyPricesLoaded && priceAreaReady(priceAreaForRequest())
        ? "Tabel harga sudah dimuat per kategori. Tekan Jalankan discovery bila ingin memuat Inspector dan model relasional lengkap."
        : (priceAreaReady(priceAreaForRequest())
          ? "Tekan Jalankan discovery untuk memuat Inspector dan model relasional lengkap."
          : "Pilih negara untuk membaca database utility global.");
      refs.globalUtilityTableBody.innerHTML = emptyRow(5, refs.globalUtilityStatus.textContent);
      clearGlobalDetailTables(refs.globalUtilityStatus.textContent, state.globalDiscoveryLoading || state.globalDiscoveryLoaded || Boolean(state.globalDiscoveryError));
      return;
    }
    if (db.error) {
      refs.globalUtilityStatus.textContent = "Global utility database gagal dimuat: " + db.error;
      refs.globalUtilityTableBody.innerHTML = emptyRow(5, refs.globalUtilityStatus.textContent);
      clearGlobalDetailTables(refs.globalUtilityStatus.textContent, state.globalDiscoveryLoading || state.globalDiscoveryLoaded || Boolean(state.globalDiscoveryError));
      return;
    }

    var registry = Array.isArray(db.sourceRegistry) ? db.sourceRegistry : [];
    var records = Array.isArray(db.records) ? db.records : [];
    var rows = Array.isArray(db.tableRows) ? db.tableRows : [];
    var country = db.country && typeof db.country === "object" ? db.country : {};
    var countryLabel = country.officialName || country.countryNameEn || country.iso2 || "Negara";
    var tzCount = Array.isArray(country.timezones) ? country.timezones.length : 0;
    var storage = db.databaseOnline ? "SQL global utility aktif" : "fallback seed";
    var pipelineText = db.pipeline && db.pipeline.status ? " Pipeline: " + db.pipeline.status + "." : "";
    refs.globalUtilityStatus.textContent = "Database global: " + storage + ". " + countryLabel + " (" + (country.iso2 || "-") + "/" + (country.iso3 || "-") + "), currency " + (country.currency || "-") + ", timezone " + tzCount + ". Source " + registry.length + ", current records " + records.length + "." + pipelineText;

    var selectedCategory = normalizeGlobalUtilityCategory(
      db && db.relational && db.relational.categoryFilter
        ? db.relational.categoryFilter
        : (db && db.relational && db.relational.discoveryInspector ? db.relational.discoveryInspector.categoryFilter : "")
    );
    var categories = selectedCategory ? [selectedCategory] : ["fuel", "electricity", "internet", "mobile", "water"];
    refs.globalUtilityTableBody.innerHTML = categories.map(function (category) {
      var sources = globalUtilityCategoryItems(registry, category);
      var categoryRows = globalUtilityCategoryItems(rows, category);
      var normalizedRows = globalUtilityCategoryItems(records, category);
      return "<tr>" +
        "<td>" + escapeHtml(globalUtilityCategoryLabel(category)) + "</td>" +
        "<td>" + globalUtilitySourceCell(sources, db, category) + "</td>" +
        "<td>" + globalUtilityRecordCell(categoryRows, normalizedRows.length, country, category) + "</td>" +
        "<td>" + globalUtilityStatusCell(db, categoryRows, sources, category) + "</td>" +
        "<td>" + globalUtilityUpdateCell(categoryRows, sources, country, category) + "</td>" +
        "</tr>";
    }).join("");
    renderGlobalFuelRows(db, country, records);
    renderGlobalElectricityRows(db, country, records);
    renderGlobalWaterRows(db, country, records);
    renderGlobalInternetRows(db, country, records);
    renderGlobalMobileRows(db, country, records);
    renderGlobalSourceRows(db, country);
    if (state.globalDiscoveryLoaded && state.globalDiscoveryDatabase) {
      renderGlobalDiscoveryInspector(state.globalDiscoveryDatabase, state.globalDiscoveryDatabase.country || country);
    } else if (!state.globalDiscoveryLoading && !state.globalDiscoveryError) {
      renderGlobalDiscoveryInspector(db, country);
    }
    renderGlobalRelationalModel(db, country);
  }

  function renderMultilingualExtraction(data) {
    if (!refs.localeProfileSummary || !refs.localeLanguageTableBody || !refs.multilingualExtractionTableBody || !refs.extractionReviewRules) {
      return;
    }
    var locale = data && data.localeProfile && typeof data.localeProfile === "object" ? data.localeProfile : null;
    var extraction = data && data.multilingualExtraction && typeof data.multilingualExtraction === "object" ? data.multilingualExtraction : null;
    var languages = locale && Array.isArray(locale.languageDetails) ? locale.languageDetails : [];
    var categories = extraction && Array.isArray(extraction.categories) ? extraction.categories : [];
    if (!state.energyPricesLoaded || !locale) {
      refs.localeProfileSummary.textContent = priceAreaReady(priceAreaForRequest())
        ? "Profil bahasa, format angka, dan dictionary istilah dimuat otomatis bersama negara yang dipilih."
        : "Pilih negara untuk menyiapkan profil bahasa dan format angka/tanggal.";
      refs.localeLanguageTableBody.innerHTML = emptyRow(5, refs.localeProfileSummary.textContent);
      refs.multilingualExtractionTableBody.innerHTML = emptyRow(4, "Dictionary multibahasa belum dimuat.");
      refs.extractionReviewRules.textContent = "Sumber baru masuk discovery, diverifikasi, lalu hanya record valid yang memperbarui database harga.";
      return;
    }
    var languageNames = languages.map(function (language) {
      return (language.name || language.code || "-") + " (" + (language.code || "-") + ")";
    }).join(", ");
    var catalog = locale.languageCatalog || {};
    var catalogText = catalog.catalogCount
      ? " Katalog " + catalog.catalogCount + " bahasa + fallback BCP-47."
      : "";
    refs.localeProfileSummary.textContent = "Bahasa sumber: " + (languageNames || "-") + ". Currency " + (locale.currency || "-") + "." + catalogText + " Angka dan tanggal disimpan bersama teks asli.";
    refs.localeLanguageTableBody.innerHTML = languages.map(function (language) {
      var status = [language.coverage || "", language.dictionaryStatus || ""].filter(Boolean).join(" / ") || "-";
      return "<tr>" +
        "<td>" + escapeHtml((language.name || "-") + " (" + (language.code || "-") + ")") + "</td>" +
        "<td>" + escapeHtml(language.script || "-") + "</td>" +
        "<td>decimal " + escapeHtml(language.decimal || "-") + " / ribuan " + escapeHtml(language.thousands || "-") + "</td>" +
        "<td>" + escapeHtml(Array.isArray(language.dateFormats) ? language.dateFormats.join(", ") : "-") + "</td>" +
        "<td>" + escapeHtml(status) + "</td>" +
        "</tr>";
    }).join("") || emptyRow(5, "Profil bahasa belum tersedia.");

    refs.multilingualExtractionTableBody.innerHTML = categories.map(function (category) {
      var terms = Array.isArray(category.terms) ? category.terms.slice(0, 10) : [];
      var queries = Array.isArray(category.queries) ? category.queries.slice(0, 3) : [];
      var columns = Array.isArray(category.normalizedColumns) ? category.normalizedColumns : [];
      var coverage = category.dictionaryCoverage || {};
      var fallback = Array.isArray(coverage.fallbackLanguages) && coverage.fallbackLanguages.length
        ? "<br><span class=\"muted-cell\">Fallback review: " + escapeHtml(coverage.fallbackLanguages.join(", ")) + "</span>"
        : "";
      return "<tr>" +
        "<td>" + escapeHtml(category.label || category.key || "-") + "</td>" +
        "<td>" + terms.map(function (term) {
          return "<span class=\"source-hint\">" + escapeHtml(term) + "</span>";
        }).join(" ") + fallback + "</td>" +
        "<td>" + queries.map(function (query) {
          return formatSourceLink(query.searchUrl, query.term || query.query || "Query");
        }).join("<br>") + "</td>" +
        "<td>" + columns.map(function (column) {
          return "<span class=\"source-hint\">" + escapeHtml(column) + "</span>";
        }).join(" ") + "</td>" +
        "</tr>";
    }).join("") || emptyRow(4, "Dictionary multibahasa belum tersedia.");

    var rules = extraction && Array.isArray(extraction.reviewRules) ? extraction.reviewRules : [];
    var confidence = extraction && extraction.confidenceModel ? extraction.confidenceModel : {};
    refs.extractionReviewRules.textContent = [
      rules.slice(0, 2).join(" "),
      confidence.type ? "Confidence: " + confidence.type + ", auto approve >= " + confidence.autoApproveThreshold + "." : ""
    ].filter(Boolean).join(" ");
  }

  function renderUsFuelProviderCatalog() {
    if (!refs.usFuelProviderTableBody || !refs.usFuelProviderStatus) {
      return;
    }
    if (state.usFuelProviderLoading) {
      refs.usFuelProviderStatus.textContent = "Memuat registry provider dan sumber locator resmi...";
      refs.usFuelProviderTableBody.innerHTML = emptyRow(6, "Memuat registry provider BBM Amerika Serikat...");
      return;
    }
    var catalog = state.usFuelProviderCatalog || {};
    var providers = Array.isArray(catalog.providers) ? catalog.providers : [];
    if (!providers.length) {
      var message = state.usFuelProviderError || "Registry provider BBM ditampilkan saat Amerika Serikat dipilih.";
      refs.usFuelProviderStatus.textContent = message;
      refs.usFuelProviderTableBody.innerHTML = emptyRow(6, message);
      return;
    }
    var priceRows = globalUtilityFuelRowsForEnergyTable(state.energyPrices || {}).filter(function (row) {
      return String(row.priceClass || "").toLowerCase() === "retail";
    });
    var adm1 = catalog.adm1 || "negara bagian terpilih";
    refs.usFuelProviderStatus.textContent = providers.length + " grup provider/merek terdaftar. Coverage untuk " + adm1 + " hanya dianggap confirmed dari hasil locator resmi; tidak diasumsikan nasional.";
    refs.usFuelProviderTableBody.innerHTML = providers.map(function (provider) {
      var aliases = Array.isArray(provider.brands) ? provider.brands : [];
      var matching = priceRows.filter(function (row) {
        var rowText = [row.provider || "", row.brand || ""].join(" ").toLowerCase();
        return aliases.some(function (alias) {
          return rowText.indexOf(String(alias || "").toLowerCase()) !== -1;
        }) || (provider.legalName && rowText.indexOf(String(provider.legalName).toLowerCase()) !== -1);
      });
      var products = [];
      var stations = [];
      matching.forEach(function (row) {
        var product = row.product || row.name || "";
        var station = row.pricingArea || row.scopeReference || row.stationName || row.region || "";
        if (product && products.indexOf(product) === -1) {
          products.push(product);
        }
        if (station && stations.indexOf(station) === -1) {
          stations.push(station);
        }
      });
      var coverage = matching.length
        ? "Confirmed: " + stations.length + " stasiun / " + matching.length + " observasi harga resmi pada " + adm1
        : "Belum dikonfirmasi otomatis untuk " + adm1 + "; cek locator resmi (bukan bukti tidak beroperasi).";
      var priceMode = {
        "automatic-official-station-feed": "Update otomatis tersedia, per stasiun.",
        "official-station-page-browser-required": "Harga ada pada halaman stasiun; fetch browser diperlukan.",
        "official-app-estimate-pump-may-differ": "Estimasi pada aplikasi resmi; harga pompa dapat berbeda.",
        "official-source-says-contact-station": "Locator resmi tidak menampilkan harga; hubungi stasiun.",
        "no-public-machine-readable-price-source": "Belum ada feed harga publik machine-readable yang terverifikasi."
      }[provider.priceUpdateMode] || provider.priceReason || "Belum ada feed harga resmi.";
      return "<tr>" +
        "<td>" + escapeHtml(provider.legalName || "-") + "<br><span class=\"muted-cell\">" + escapeHtml(aliases.join(" / ") || "-") + "</span></td>" +
        "<td>" + escapeHtml(coverage) + "</td>" +
        "<td>" + escapeHtml(products.length ? products.join(" / ") : "Menunggu produk pada hasil locator resmi") + "</td>" +
        "<td>" + escapeHtml(priceMode) + "</td>" +
        "<td>STATION — tidak digeneralisasi menjadi harga provider/state; referensi EIA tetap terpisah.</td>" +
        "<td>" + formatSourceLink(provider.locatorUrl, "Locator") + (provider.priceSourceUrl ? "<br>" + formatSourceLink(provider.priceSourceUrl, "Sumber harga") : "") + "</td>" +
        "</tr>";
    }).join("");
  }

  function usWaterProviderNameKey(value) {
    var ignored = {
      and: true, city: true, county: true, department: true, district: true,
      metropolitan: true, municipal: true, municipality: true, public: true,
      service: true, services: true, system: true, utility: true, utilities: true,
      water: true, board: true, authority: true, of: true, the: true
    };
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(function (token) {
      return token && !ignored[token];
    }).join(" ");
  }

  function renderUsWaterProviderCatalog() {
    if (!refs.usWaterProviderTableBody || !refs.usWaterProviderStatus) {
      return;
    }
    if (state.usWaterProviderLoading) {
      refs.usWaterProviderStatus.textContent = "Memuat registry sistem air publik resmi EPA untuk negara bagian terpilih...";
      refs.usWaterProviderTableBody.innerHTML = emptyRow(6, "Memuat registry perusahaan air Amerika Serikat...");
      return;
    }
    var catalog = state.usWaterProviderCatalog || {};
    var providers = Array.isArray(catalog.providers) ? catalog.providers : [];
    if (!providers.length) {
      var message = state.usWaterProviderError || catalog.reason || "Registry perusahaan air ditampilkan saat Amerika Serikat dan satu negara bagian dipilih.";
      refs.usWaterProviderStatus.textContent = message;
      refs.usWaterProviderTableBody.innerHTML = emptyRow(6, message);
      return;
    }

    var waterPrices = globalUtilityWaterRowsForEnergyTable(state.energyPrices || {});
    var adm1 = catalog.stateName || catalog.adm1 || "negara bagian terpilih";
    var returned = Number(catalog.providerCount || providers.length);
    var discovered = Number(catalog.systemsDiscovered || catalog.totalSystems || returned);
    var scopeText = discovered > returned
      ? returned + " sistem terbesar menurut populasi dari " + discovered + " sistem air resmi EPA ditampilkan untuk " + adm1 + "."
      : returned + " sistem air resmi EPA ditampilkan untuk " + adm1 + ".";
    refs.usWaterProviderStatus.textContent = scopeText + " PWSID/county membuktikan registry dan area laporan, bukan otomatis billing utility alamat atau satu tarif statewide.";

    refs.usWaterProviderTableBody.innerHTML = providers.map(function (provider) {
      var raw = provider.rawRecord && typeof provider.rawRecord === "object" ? provider.rawRecord : {};
      var name = provider.legalName || provider.brandName || provider.name || "Sistem air publik";
      var providerKey = usWaterProviderNameKey(name);
      var matchingPrices = waterPrices.filter(function (price) {
        var priceKey = usWaterProviderNameKey(price.provider || "");
        return Boolean(providerKey && priceKey && (providerKey === priceKey || providerKey.indexOf(priceKey) !== -1 || priceKey.indexOf(providerKey) !== -1));
      });
      var tariffStatus = matchingPrices.length
        ? matchingPrices.length + " tarif resmi terverifikasi tampil pada tabel Tarif air di atas; scope kota/service area tetap berlaku."
        : "Belum ada dokumen tarif resmi yang terhubung untuk scope alamat ini. Registry EPA tidak berisi harga.";
      var sourceUrl = provider.sourceUrl || catalog.sourceUrl || (catalog.source && catalog.source.url) || "https://www.epa.gov/waterdata/safe-drinking-water-information-system";
      var population = raw.population_served !== undefined ? Number(raw.population_served) : Number(provider.populationServed || 0);
      return "<tr>" +
        "<td>" + escapeHtml(name) + "</td>" +
        "<td>" + escapeHtml(provider.registryIdentifier || provider.pwsId || raw.registry_identifier || "-") + "</td>" +
        "<td>" + escapeHtml(provider.operationAreaText || provider.operationArea || (Array.isArray(raw.counties_served) ? adm1 + "; counties: " + raw.counties_served.join(", ") : adm1)) + "</td>" +
        "<td>" + escapeHtml(population > 0 ? formatNumber(population, 0) : "Tidak dicantumkan") + "</td>" +
        "<td>" + escapeHtml(tariffStatus) + "</td>" +
        "<td>" + formatSourceLink(sourceUrl, "EPA SDWIS resmi") + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderUsTelecomProviderSummary(data, fixedRows, mobileRows, internetSources, mobileSources) {
    if (!refs.usTelecomProviderTableBody || !refs.usTelecomProviderWrap) {
      return;
    }
    var countryCode = String((data.priceArea && data.priceArea.countryCode) || priceAreaForRequest().countryCode || "").toUpperCase();
    refs.usTelecomProviderWrap.hidden = countryCode !== "US";
    if (countryCode !== "US") {
      refs.usTelecomProviderTableBody.innerHTML = "";
      return;
    }
    var providers = [
      {
        name: "AT&T",
        aliases: ["at&t", "att"],
        mobile: "Jaringan mobile nasional; coverage dan performa harus dicek pada peta lokasi.",
        fixed: "Fiber/Internet Air/DSL hanya pada alamat yang lolos availability check.",
        coverageUrl: "https://www.att.com/maps/wireless-coverage.html",
        fixedUrl: "https://www.att.com/internet/availability/"
      },
      {
        name: "Verizon",
        aliases: ["verizon"],
        mobile: "Jaringan mobile nasional; peta bersifat perkiraan outdoor dan bukan jaminan setiap alamat.",
        fixed: "Fios hanya sebagian Mid-Atlantic/New England; 5G Home bergantung alamat dan jaringan setempat.",
        coverageUrl: "https://www.verizon.com/coverage-map/",
        fixedUrl: "https://www.verizon.com/home/internet/"
      },
      {
        name: "T-Mobile",
        aliases: ["t-mobile", "tmobile"],
        mobile: "Jaringan mobile nasional; coverage/performa bervariasi dan wajib dicek pada peta.",
        fixed: "Home Internet tidak tersedia di semua area dan terikat alamat aktivasi yang disetujui.",
        coverageUrl: "https://www.t-mobile.com/coverage/coverage-map",
        fixedUrl: "https://www.t-mobile.com/home-internet/eligibility"
      }
    ];
    function matchesProvider(value, provider) {
      var key = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      return provider.aliases.some(function (alias) {
        var aliasKey = alias.replace(/[^a-z0-9]+/g, "");
        return key === aliasKey || key.indexOf(aliasKey) !== -1 || aliasKey.indexOf(key) !== -1;
      });
    }
    function sourceFor(provider, sources) {
      return (Array.isArray(sources) ? sources : []).find(function (source) {
        return matchesProvider(source.provider || source.brand || source.label, provider);
      }) || null;
    }
    refs.usTelecomProviderTableBody.innerHTML = providers.map(function (provider) {
      var providerFixedRows = (Array.isArray(fixedRows) ? fixedRows : []).filter(function (row) { return matchesProvider(row.provider, provider); });
      var providerMobileRows = (Array.isArray(mobileRows) ? mobileRows : []).filter(function (row) { return matchesProvider(row.provider, provider); });
      var source = sourceFor(provider, internetSources) || sourceFor(provider, mobileSources);
      var counts = [];
      if (providerFixedRows.length) {
        counts.push(providerFixedRows.length + " paket internet rumah");
      }
      if (providerMobileRows.length) {
        counts.push(providerMobileRows.length + " paket mobile");
      }
      var priceStatus = counts.length
        ? counts.join("; ") + " dari katalog resmi terverifikasi."
        : "Belum dipublikasikan: " + globalUtilityProviderFetchBlocker(source || {});
      return "<tr>" +
        "<td>" + escapeHtml(provider.name) + "</td>" +
        "<td>" + escapeHtml(provider.mobile) + "</td>" +
        "<td>" + escapeHtml(provider.fixed) + "</td>" +
        "<td>" + escapeHtml(priceStatus) + "</td>" +
        "<td>Harga dasar katalog dapat sama lintas-state; pajak, surcharge, promo, jumlah line, teknologi tersedia, dan tagihan akhir dapat berbeda.</td>" +
        "<td>" + formatSourceLink(provider.coverageUrl, "Mobile") + "<br>" + formatSourceLink(provider.fixedUrl, "Internet rumah") + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderUsElectricityGeneration() {
    if (!refs.electricityGenerationTableBody || !refs.electricityGenerationStatus) {
      return;
    }
    if (state.electricityGenerationLoading) {
      refs.electricityGenerationStatus.textContent = "Mengambil workbook resmi EIA dan membaca bauran pembangkit negara bagian...";
      refs.electricityGenerationTableBody.innerHTML = emptyRow(8, "Memuat profil pembangkit resmi EIA...");
      return;
    }
    var profile = state.electricityGenerationProfile || {};
    var sourceMix = Array.isArray(profile.sourceMix) ? profile.sourceMix : [];
    var generatorDetails = Array.isArray(profile.generatorDetails) ? profile.generatorDetails : [];
    if (!sourceMix.length && !generatorDetails.length) {
      var reason = state.electricityGenerationError || profile.reason || "Pilih Amerika Serikat dan satu negara bagian untuk memuat data EIA.";
      refs.electricityGenerationStatus.textContent = reason;
      refs.electricityGenerationTableBody.innerHTML = emptyRow(8, reason);
      return;
    }

    var source = profile.source && typeof profile.source === "object" ? profile.source : {};
    var sourceUrl = source.url || source.publicPage || "https://www.eia.gov/electricity/state/";
    var year = profile.dataYear || "-";
    var region = profile.stateName || profile.stateCode || "Amerika Serikat";
    var rows = sourceMix.map(function (item) {
      return {
        plantType: item.plantType || "Pembangkit",
        energySource: item.energySource || item.sourceLabel || "-",
        technology: "Agregat sumber EIA" + (generatorDetails.some(function (detail) { return detail.parentSourceLabel === item.sourceLabel; }) ? "; rincian di baris berikutnya" : "; prime mover tidak dirinci pada tabel ini"),
        generationMwh: item.generationMwh,
        sharePercent: item.sharePercent,
        detail: false
      };
    }).concat(generatorDetails.map(function (item) {
      return {
        plantType: item.plantType || "Detail generator",
        energySource: item.energySource || item.parentSourceLabel || "-",
        technology: [item.generatorTechnology || item.detailLabel || "-", item.primeMoverCode ? "(" + item.primeMoverCode + ")" : ""].filter(Boolean).join(" "),
        generationMwh: item.generationMwh,
        sharePercent: item.sharePercent,
        detail: true
      };
    }));

    var generationSummary = [
      "Profil " + region + " tahun " + year + ".",
      "Total " + formatNumber(profile.totalGenerationMwh, 0) + " MWh.",
      profile.servedFrom === "official-cache" ? "Workbook resmi dibaca dari cache." : "Workbook resmi EIA terverifikasi.",
      profile.refreshWarning ? "Refresh live gagal; cache resmi terakhir dipakai." : ""
    ].filter(Boolean).join(" ");
    refs.electricityGenerationStatus.innerHTML = escapeHtml(generationSummary) +
      "<br><span class=\"muted-cell\">Baris detail menunjukkan teknologi prime mover agregat pada EIA State Profile. Inventaris pembangkit dan unit generator individual: " +
      formatSourceLink("https://www.eia.gov/electricity/data/eia860/", "EIA-860 resmi") + ".</span>";
    refs.electricityGenerationTableBody.innerHTML = rows.map(function (item) {
      return "<tr" + (item.detail ? " class=\"generation-detail-row\"" : "") + ">" +
        "<td>" + escapeHtml((item.detail ? "↳ " : "") + item.plantType) + "</td>" +
        "<td>" + escapeHtml(item.energySource) + "</td>" +
        "<td>" + escapeHtml(item.technology) + "</td>" +
        "<td>" + escapeHtml(formatNumber(item.generationMwh, 3)) + "</td>" +
        "<td>" + escapeHtml(formatNumber(item.sharePercent, 4)) + "%</td>" +
        "<td>" + escapeHtml(region) + "</td>" +
        "<td>" + escapeHtml(year) + "</td>" +
        "<td>" + formatSourceLink(sourceUrl, item.detail ? "EIA Table 5 - prime mover" : "EIA Table 5") + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderEnergyPrices() {
    if (!refs.energyPriceStatus) {
      return;
    }
    var data = state.energyPrices || {};
    var validationMessage = energyPriceAreaValidationMessage(priceAreaForRequest());
    var profile = energyCountryProfile(data);
    var profileSummary = energyProfileSummary(data);
    var refreshPrompt = profileSummary ? "Auto-load berjalan saat negara dipilih. " + profileSummary + "." : "Auto-load berjalan saat negara dipilih.";
    if (state.energyPricesLoading) {
      refs.energyPriceStatus.textContent = "Mengambil data online dari sumber yang diizinkan...";
    } else if (validationMessage) {
      refs.energyPriceStatus.textContent = validationMessage + " Auto-load belum aktif." + (profileSummary ? " " + profileSummary + "." : "");
    } else if (state.energyPricesError) {
      refs.energyPriceStatus.textContent = "Gagal memuat data online: " + state.energyPricesError;
    } else if (state.energyPricesLoaded) {
      refs.energyPriceStatus.textContent = "Update terakhir sistem: " + formatDateTime(data.fetchedAt || new Date().toISOString()) + " - Wilayah harga: " + priceAreaSummary(data.priceArea || priceAreaForRequest()) + (profileSummary ? " - " + profileSummary : "");
    } else {
      refs.energyPriceStatus.textContent = "Belum dimuat. Wilayah harga: " + priceAreaSummary(priceAreaForRequest()) + (profileSummary ? " - " + profileSummary : "");
    }
    if (refs.energyCountryFormatText) {
      refs.energyCountryFormatText.textContent = profile.currency
        ? "Format negara: " + (profile.country || "Negara") + " (" + profile.countryCode + ") - BBM " + profile.currency + "/" + profile.fuelUnit + ", listrik " + profile.currency + "/" + profile.electricityUnit + ", internet " + profile.currency + "/" + profile.internetBillingUnit + ", mobile " + profile.currency + "/" + profile.mobileBillingUnit + ", air " + profile.currency + "/" + profile.waterUnit + "."
        : "Format negara: pilih negara dulu.";
    }
    if (refs.fuelPriceUnitHeader) {
      refs.fuelPriceUnitHeader.textContent = profile.currency ? "Harga sumber (" + profile.currency + "/" + profile.fuelUnit + ")" : "Harga sumber BBM";
    }
    if (refs.fuelPriceConversionHeader) {
      var fuelTarget = convertedVolumePrice(1, profile.fuelUnit || "");
      refs.fuelPriceConversionHeader.textContent = fuelTarget && profile.currency
        ? "Konversi (" + profile.currency + "/" + fuelTarget.unit + ")"
        : "Konversi unit";
    }
    if (refs.electricityPriceUnitHeader) {
      refs.electricityPriceUnitHeader.textContent = profile.currency ? "Harga (" + profile.currency + "/" + profile.electricityUnit + ")" : "Harga/kWh";
    }
    if (refs.internetPriceUnitHeader) {
      refs.internetPriceUnitHeader.textContent = profile.currency ? "Harga (" + profile.currency + "/" + profile.internetBillingUnit + ")" : "Harga/bulan";
    }
    if (refs.mobilePriceUnitHeader) {
      refs.mobilePriceUnitHeader.textContent = profile.currency ? "Harga (" + profile.currency + "/" + profile.mobileBillingUnit + ")" : "Harga";
    }
    if (refs.waterPriceUnitHeader) {
      refs.waterPriceUnitHeader.textContent = profile.currency ? "Harga sumber (" + profile.currency + "/" + profile.waterUnit + ")" : "Harga sumber";
    }
    if (refs.waterPriceConversionHeader) {
      var waterTarget = convertedVolumePrice(1, profile.waterUnit || "");
      refs.waterPriceConversionHeader.textContent = waterTarget && profile.currency
        ? "Konversi (" + profile.currency + "/" + waterTarget.unit + ")"
        : "Konversi unit";
    }
    if (refs.energyPriceRefreshButton) {
      refs.energyPriceRefreshButton.disabled = state.energyPricesLoading || Boolean(validationMessage);
      refs.energyPriceRefreshButton.textContent = state.energyPricesLoading ? "Memuat..." : (validationMessage ? "Pilih negara" : "Refresh online");
    }
    renderGlobalDiscoveryControls();
    renderSourceDiscovery(data);
    renderGlobalUtilityDatabase(data);
    renderMultilingualExtraction(data);
    renderUsFuelProviderCatalog();
    renderUsElectricityGeneration();
    renderUsWaterProviderCatalog();
    if (refs.usTelecomScopeStatus) {
      var selectedCountryCode = String((data.priceArea && data.priceArea.countryCode) || priceAreaForRequest().countryCode || "").toUpperCase();
      refs.usTelecomScopeStatus.textContent = selectedCountryCode === "US"
        ? "AT&T, Verizon, dan T-Mobile memakai harga katalog/provider-area, bukan tarif negara bagian. Harga dasar dapat sama, tetapi ketersediaan fixed harus dicek per alamat; coverage mobile, pajak, surcharge, diskon, jumlah line, dan tagihan akhir dapat berbeda menurut lokasi."
        : "";
    }

    var oilRows = Array.isArray(data.oil) ? data.oil : [];
    refs.oilPriceTableBody.innerHTML = oilRows.map(function (item) {
      var updated = [formatDateTime(item.updatedAt || item.updated_at), item.status && item.status !== "ok" ? item.status : "", formatSourceLink(item.sourceUrl || item.source, item.sourceLabel || item.sourceName || "Sumber")]
        .filter(Boolean)
        .join("<br>");
      return "<tr>" +
        "<td>" + escapeHtml(item.benchmark || item.label || "-") + "</td>" +
        "<td>" + formatEnergyPrice(item.price, item.currency || "USD", item.unit || "barrel") + "</td>" +
        "<td>" + escapeHtml(item.observedAt || item.observedDate || "-") + "</td>" +
        "<td>" + escapeHtml(priceScopeLabel(item, "priceRegion")) + "</td>" +
        "<td>" + updated + "</td>" +
        "</tr>";
    }).join("") || emptyRow(5, state.energyPricesLoaded ? "Data minyak belum tersedia dari sumber online." : refreshPrompt);

    var fuel = data.fuel || {};
    var globalFuelRows = globalUtilityFuelRowsForEnergyTable(data);
    var globalFuelSources = globalUtilityFuelSourcesForEnergyTable(data);
    var allFuelRows = globalFuelRows.length ? globalFuelRows : (Array.isArray(fuel.items) ? fuel.items : []);
    function fuelRowClass(item) {
      var explicit = String(item.priceClass || "").toLowerCase();
      if (["retail", "reference", "other"].indexOf(explicit) !== -1) {
        return explicit;
      }
      var kind = String(item.recordKind || item.record_kind || "").toLowerCase();
      var type = String(item.priceType || item.price_type || "").toLowerCase();
      var scope = String(item.pricingScopeType || item.pricingGeography || item.scopeType || "").toUpperCase();
      if (kind === "official_reference" || type === "reference_price") {
        return "reference";
      }
      return scope === "STATION" || /station[_ -]?price|retail[_ -]?pump/.test(type) ? "retail" : "other";
    }
    var fuelDisplayMode = refs.fuelPriceDisplayModeInput ? String(refs.fuelPriceDisplayModeInput.value || "all") : "all";
    var retailFuelCount = allFuelRows.filter(function (item) { return fuelRowClass(item) === "retail"; }).length;
    var referenceFuelCount = allFuelRows.filter(function (item) { return fuelRowClass(item) === "reference"; }).length;
    var otherFuelCount = Math.max(0, allFuelRows.length - retailFuelCount - referenceFuelCount);
    var fuelClassOrder = { retail: 0, reference: 1, other: 2 };
    var fuelRows = allFuelRows.filter(function (item) {
      return fuelDisplayMode === "all" || fuelRowClass(item) === fuelDisplayMode;
    }).slice().sort(function (left, right) {
      var classDelta = (fuelClassOrder[fuelRowClass(left)] || 0) - (fuelClassOrder[fuelRowClass(right)] || 0);
      if (classDelta !== 0) {
        return classDelta;
      }
      return String(left.brand || "").localeCompare(String(right.brand || ""))
        || String(left.product || left.name || "").localeCompare(String(right.product || right.name || ""));
    });
    if (refs.fuelRetailStatus) {
      refs.fuelRetailStatus.textContent = retailFuelCount + " harga retail stasiun terverifikasi; " + referenceFuelCount + " referensi/rata-rata resmi; " + otherFuelCount + " harga resmi scope lain. Harga retail wajib memiliki provider, produk, station, wilayah, harga, tanggal/snapshot, dan sumber resmi lengkap.";
    }
    var sourceRows = globalFuelSources.length ? globalFuelSources : (Array.isArray(fuel.sources) ? fuel.sources : []);
    if (fuelRows.length) {
      refs.fuelPriceTableBody.innerHTML = fuelRows.map(function (item) {
        var typeLabel = [item.product || item.name || "-", item.ronCn || item.quality || item.fuelType || ""].filter(Boolean).join(" / ");
        var updateLabel = [item.effectiveDate || item.updatedAt || "-", item.sourceStatus && item.sourceStatus !== "ok" ? item.sourceStatus : "", item.actualPumpPriceMayDiffer ? "harga pom dapat berbeda" : ""].filter(Boolean).join(" - ");
        var hasSourcePrice = item.price !== null && item.price !== undefined && item.price !== "";
        var sourcePrice = hasSourcePrice ? item.price : item.pricePerLiterIdr;
        var sourceCurrency = item.currency || (hasSourcePrice ? profile.currency : "IDR") || "IDR";
        var sourceUnit = hasSourcePrice ? (item.unit || profile.fuelUnit || "liter") : "liter";
        var priceClass = fuelRowClass(item);
        var priceClassLabel = item.priceClassLabel || (priceClass === "reference"
          ? "Referensi/rata-rata retail resmi - bukan harga stasiun"
          : (priceClass === "retail" ? "Retail stasiun" : "Harga resmi - scope sumber"));
        return "<tr>" +
          "<td>" + escapeHtml(item.brand || "-") + "</td>" +
          "<td>" + escapeHtml(typeLabel) + "</td>" +
          "<td>" + escapeHtml(priceClassLabel) + "</td>" +
          "<td>" + formatSourceVolumePrice(sourcePrice, sourceCurrency, sourceUnit, item.priceText) + "</td>" +
          "<td>" + formatConvertedVolumePrice(sourcePrice, sourceCurrency, sourceUnit) + "</td>" +
          "<td>" + escapeHtml(priceScopeLabel(item, "fuelRegion")) + "</td>" +
          "<td>" + escapeHtml(updateLabel) + "</td>" +
          "<td>" + formatSourceLink(item.sourceUrl || item.officialSourceUrl || item.source, item.sourceLabel || item.officialSourceName || "Sumber") + "</td>" +
          "</tr>";
      }).join("");
    } else if (allFuelRows.length && state.energyPricesLoaded) {
      var selectedModeLabel = fuelDisplayMode === "retail" ? "retail stasiun" : (fuelDisplayMode === "reference" ? "referensi resmi" : "harga terverifikasi");
      refs.fuelPriceTableBody.innerHTML = "<tr>" +
        "<td>Filter " + escapeHtml(selectedModeLabel) + "</td>" +
        "<td>Produk tidak ditampilkan</td>" +
        "<td>Tidak ada baris yang cocok dengan mode ini</td>" +
        "<td>-</td>" +
        "<td>-</td>" +
        "<td>" + escapeHtml(fallbackPriceRegion(data, "fuel")) + "</td>" +
        "<td>Ubah mode harga BBM untuk melihat kategori lain.</td>" +
        "<td>-</td>" +
        "</tr>";
    } else if (sourceRows.length && state.energyPricesLoaded) {
      refs.fuelPriceTableBody.innerHTML = sourceRows.map(function (source) {
        return "<tr>" +
          "<td>" + escapeHtml(source.brand || source.label || "-") + "</td>" +
          "<td>RON/AKI/CN lokal</td>" +
          "<td>Harga belum lolos klasifikasi retail/reference</td>" +
          "<td>" + unavailablePriceCell(data, "fuelUnit", "fuel") + "</td>" +
          "<td><span class=\"muted-cell\">Konversi menunggu harga dan unit sumber.</span></td>" +
          "<td>" + escapeHtml(fallbackPriceRegion(data, "fuel")) + "</td>" +
          "<td>" + escapeHtml(sourceStatusText(source)) + "</td>" +
          "<td>" + formatSourceLink(source.url || source.sourceUrl, "Sumber") + "</td>" +
          "</tr>";
      }).join("");
    } else {
      refs.fuelPriceTableBody.innerHTML = state.energyPricesLoaded
        ? "<tr>" +
          "<td>Status publikasi BBM resmi</td>" +
          "<td>RON/AKI/CN lokal</td>" +
          "<td>Retail/reference belum terverifikasi</td>" +
          "<td>" + unavailablePriceCell(data, "fuelUnit", "fuel") + "</td>" +
          "<td><span class=\"muted-cell\">Konversi menunggu harga dan unit sumber.</span></td>" +
          "<td>" + escapeHtml(fallbackPriceRegion(data, "fuel")) + "</td>" +
          "<td>" + unavailableStatusCell(data, "fuel", "fuelUnit", "Pemeriksaan sumber resmi BBM belum menghasilkan harga terverifikasi.") + "</td>" +
          "<td>" + unavailableSourceCell(data, "fuel") + "</td>" +
          "</tr>"
        : emptyRow(8, refreshPrompt);
    }

    var electricity = data.electricity || {};
    var globalElectricityRows = globalUtilityElectricityRowsForEnergyTable(data);
    var electricitySourceRows = globalUtilityEnergySourcesForTable(data, "electricity");
    var tariffs = globalElectricityRows.length ? globalElectricityRows : (Array.isArray(electricity.tariffs) ? electricity.tariffs : []);
    if (tariffs.length) {
      refs.electricityTariffTableBody.innerHTML = tariffs.map(function (item) {
      var electricitySourceStatus = item.sourceStatus && item.sourceStatus !== "ok"
        ? item.sourceStatus
        : (electricity.source && electricity.source.status && electricity.source.status !== "ok" ? electricity.source.status : "");
      var updateCell = [
        item.effectivePeriod || item.updatedAt || "-",
        electricitySourceStatus,
        formatSourceLink(item.sourceUrl || electricity.sourceUrl || (electricity.source && electricity.source.url), item.sourceLabel || "Sumber")
      ].filter(Boolean).join("<br>");
      return "<tr>" +
        "<td>" + escapeHtml(item.customerGroup || item.group || "-") + "</td>" +
        "<td>" + escapeHtml(item.capacity || item.power || "-") + "</td>" +
        "<td>" + formatEnergyPrice(item.tariffPerKwhIdr || item.price, item.currency || profile.currency || "IDR", item.unit || profile.electricityUnit || "kWh") + "</td>" +
        "<td>" + escapeHtml(priceScopeLabel(item, "electricityRegion")) + "</td>" +
        "<td>" + updateCell + "</td>" +
        "</tr>";
      }).join("");
    } else if (electricitySourceRows.length && state.energyPricesLoaded) {
      refs.electricityTariffTableBody.innerHTML = electricitySourceRows.map(function (source) {
        return "<tr>" +
          "<td>" + escapeHtml(source.provider || source.label || "Sumber listrik") + "</td>" +
          "<td>Tarif belum lolos evidence chain</td>" +
          "<td>" + unavailablePriceCell(data, "electricityUnit", "electricity") + "</td>" +
          "<td>" + escapeHtml(source.region || fallbackPriceRegion(data, "electricity")) + "</td>" +
          "<td>" + globalUtilityStagingStatusCell(source) + "<br>" + formatSourceLink(source.url, source.label || "Sumber") + "</td>" +
          "</tr>";
      }).join("");
    } else {
      refs.electricityTariffTableBody.innerHTML = state.energyPricesLoaded
        ? "<tr>" +
        "<td>Status tarif listrik resmi</td>" +
        "<td>Daya/kelas layanan</td>" +
        "<td>" + unavailablePriceCell(data, "electricityUnit", "electricity") + "</td>" +
        "<td>" + escapeHtml(fallbackPriceRegion(data, "electricity")) + "</td>" +
        "<td>" + unavailableStatusCell(data, "electricity", "electricityUnit", globalUtilityScopeBlocker(data, "electricity") || "Pemeriksaan sumber resmi listrik belum menghasilkan tarif terverifikasi.") + "<br>" + unavailableSourceCell(data, "electricity") + "</td>" +
        "</tr>"
        : emptyRow(5, refreshPrompt);
    }

    var internet = data.internet || {};
    var globalInternetRows = globalUtilityInternetRowsForEnergyTable(data);
    var internetSourceRows = globalUtilityEnergySourcesForTable(data, "internet");
    var fixedRows = globalInternetRows.length ? globalInternetRows : (Array.isArray(internet.fixedBroadband) ? internet.fixedBroadband : []);
    if (fixedRows.length) {
      var fixedHtml = fixedRows.map(function (item) {
      var updateLabel = (item.updatedAt || "-") + sourceStatusSuffix(item.sourceStatus);
      var speedQuota = [item.speedLabel || "-", item.quotaLabel || ""].filter(Boolean).join(" / ");
      return "<tr>" +
        "<td>" + escapeHtml(item.provider || "-") + "</td>" +
        "<td>" + escapeHtml(item.packageName || "-") + "</td>" +
        "<td>" + escapeHtml(speedQuota) + "</td>" +
        "<td>" + (item.priceMonthlyIdr || item.price ? formatEnergyPrice(item.priceMonthlyIdr || item.price, item.currency || profile.currency || "IDR", item.unit || profile.internetBillingUnit || "month") : "Cek area") + "</td>" +
        "<td>" + escapeHtml(priceScopeLabel(item, "telecomRegion")) + "</td>" +
        "<td>" + escapeHtml(updateLabel) + "</td>" +
        "<td>" + formatSourceLink(item.sourceUrl || item.source, item.sourceLabel || "Sumber") + "</td>" +
        "</tr>";
      }).join("");
      fixedHtml += globalUtilityMissingProviderSources(fixedRows, internetSourceRows).map(function (source) {
        return "<tr>" +
          "<td>" + escapeHtml(source.provider || source.label || "Provider internet") + "</td>" +
          "<td>Belum dipublikasikan dari fetch resmi terakhir</td>" +
          "<td>Availability fixed wajib dicek per alamat</td>" +
          "<td>Ditahan evidence gate</td>" +
          "<td>Provider area / address-qualified</td>" +
          "<td>" + escapeHtml(globalUtilityProviderFetchBlocker(source)) + "</td>" +
          "<td>" + formatSourceLink(source.url, source.label || "Sumber resmi") + "</td>" +
          "</tr>";
      }).join("");
      refs.internetPackageTableBody.innerHTML = fixedHtml;
    } else if (internetSourceRows.length && state.energyPricesLoaded) {
      refs.internetPackageTableBody.innerHTML = internetSourceRows.map(function (source) {
        return "<tr>" +
          "<td>" + escapeHtml(source.provider || source.label || "Provider internet") + "</td>" +
          "<td>Sumber registry/staging</td>" +
          "<td>Harga paket belum lolos evidence chain</td>" +
          "<td>" + unavailablePriceCell(data, "internetBillingUnit", "internet") + "</td>" +
          "<td>" + escapeHtml(source.region || fallbackPriceRegion(data, "internet")) + "</td>" +
          "<td>" + globalUtilityStagingStatusCell(source) + "</td>" +
          "<td>" + formatSourceLink(source.url, source.label || "Sumber") + "</td>" +
          "</tr>";
      }).join("");
    } else {
      refs.internetPackageTableBody.innerHTML = state.energyPricesLoaded
        ? "<tr>" +
        "<td>Status fixed broadband resmi</td>" +
        "<td>Publikasi paket internet rumah</td>" +
        "<td>Detail mengikuti sumber resmi</td>" +
        "<td>" + unavailablePriceCell(data, "internetBillingUnit", "internet") + "</td>" +
        "<td>" + escapeHtml(fallbackPriceRegion(data, "internet")) + "</td>" +
        "<td>" + unavailableStatusCell(data, "internet", "internetBillingUnit", "Pemeriksaan sumber resmi fixed broadband belum menghasilkan harga terverifikasi.") + "</td>" +
        "<td>" + unavailableSourceCell(data, "internet") + "</td>" +
        "</tr>"
        : emptyRow(7, refreshPrompt);
    }

    var mobileCountryCode = String((data.priceArea && data.priceArea.countryCode) || priceAreaForRequest().countryCode || "").toUpperCase();
    var globalMobileRows = globalUtilityMobileRowsForEnergyTable(data);
    var mobileSourceRows = globalUtilityEnergySourcesForTable(data, "mobile");
    var useUsMobileCatalog = mobileCountryCode === "US";
    var catalogMobileRows = useUsMobileCatalog ? usMobileOperatorCatalogRows() : [];
    var catalogMobileBlockers = useUsMobileCatalog ? usMobileOperatorCatalogBlockers() : [];
    var mobileRows = useUsMobileCatalog
      ? catalogMobileRows
      : (globalMobileRows.length ? globalMobileRows : (Array.isArray(internet.mobilePackages) ? internet.mobilePackages : []));
    renderUsTelecomProviderSummary(data, fixedRows, mobileRows, internetSourceRows, mobileSourceRows);
    function mobileOperatorType(item) {
      var explicit = String(item.operatorType || item.operator_type || "").trim().toUpperCase();
      if (explicit === "MNO" || explicit === "MVNO") {
        return explicit;
      }
      if (mobileCountryCode === "US" && /(?:^|\b)(?:at&t|att|verizon|t-mobile|tmobile)(?:\b|$)/i.test(String(item.provider || item.operator || ""))) {
        return "MNO";
      }
      return mobileCountryCode === "US" ? "Belum diklasifikasikan" : "Operator";
    }
    if (refs.usMobileOperatorStatus) {
      var mnoPackages = mobileRows.filter(function (item) { return mobileOperatorType(item) === "MNO"; }).length;
      var mvnoPackages = mobileRows.filter(function (item) { return mobileOperatorType(item) === "MVNO"; }).length;
      refs.usMobileOperatorStatus.textContent = mobileCountryCode === "US"
        ? (state.usMobileOperatorLoading
          ? "Memuat katalog paket resmi MNO/MVNO Amerika Serikat..."
          : "Tarif per paket: " + mnoPackages + " paket MNO dan " + mvnoPackages + " paket MVNO/retail virtual terverifikasi; " + catalogMobileBlockers.length + " sumber/relasi masih diblokir. Relasi jaringan hanya MVNO → host MNO; MNO tidak memuat daftar balik MVNO. Kategori ini menjelaskan ketergantungan jaringan retail, bukan status lisensi FCC atau kepemilikan korporat.")
        : "Tarif ditampilkan per paket; klasifikasi MNO/MVNO mengikuti evidence resmi bila tersedia.";
    }
    if (mobileRows.length) {
      var mobileHtml = mobileRows.map(function (item) {
        var updateLabel = (item.updatedAt || "-") + sourceStatusSuffix(item.sourceStatus);
        var operatorType = mobileOperatorType(item);
        var hostMno = item.hostMno || item.hostMNO || item.host_mno || "";
        var hostLabel = operatorType === "MVNO" ? (hostMno || "Host MNO belum terverifikasi") : (operatorType === "MNO" ? "—" : "-");
        return "<tr>" +
          "<td>" + escapeHtml(item.provider || item.operator || "-") + "</td>" +
          "<td>" + escapeHtml(operatorType) + "</td>" +
          "<td>" + escapeHtml(hostLabel) + "</td>" +
          "<td>" + escapeHtml(item.packageName || "-") + "<br><span class=\"muted-cell\">" + escapeHtml(updateLabel) + "</span></td>" +
          "<td>" + escapeHtml(item.quotaLabel || "-") + "</td>" +
          "<td>" + escapeHtml(item.validityLabel || "-") + "</td>" +
          "<td>" + (item.priceText ? escapeHtml(item.priceText) : (item.priceIdr || item.price ? formatEnergyPrice(item.priceIdr || item.price, item.currency || profile.currency || "IDR", item.unit || profile.mobileBillingUnit || "month") : "Cek area")) + "</td>" +
          "<td>" + escapeHtml(item.conditions || priceScopeLabel(item, "telecomRegion")) + "</td>" +
          "<td>" + formatSourceLink(item.sourceUrl || item.source, item.sourceLabel || "Sumber") + "</td>" +
          "</tr>";
      }).join("");
      mobileHtml += (useUsMobileCatalog ? [] : globalUtilityMissingProviderSources(mobileRows, mobileSourceRows)).map(function (source) {
        return "<tr>" +
          "<td>" + escapeHtml(source.provider || source.label || "Provider mobile") + "</td>" +
          "<td>Belum diklasifikasikan</td>" +
          "<td>-</td>" +
          "<td>Belum dipublikasikan dari fetch resmi terakhir<br><span class=\"muted-cell\">" + escapeHtml(globalUtilityProviderFetchBlocker(source)) + "</span></td>" +
          "<td>Detail paket ditahan evidence gate</td>" +
          "<td>Harga katalog dapat bergantung jumlah line</td>" +
          "<td>Ditahan evidence gate</td>" +
          "<td>Provider area; coverage lokasi wajib dicek</td>" +
          "<td>" + formatSourceLink(source.url, source.label || "Sumber resmi") + "</td>" +
          "</tr>";
      }).join("");
      mobileHtml += catalogMobileBlockers.map(function (blocker) {
        var blockerHost = blocker.operatorType === "MVNO" ? (blocker.hostMno || "Host MNO belum terverifikasi") : "—";
        return "<tr>" +
          "<td>" + escapeHtml(blocker.provider) + "</td>" +
          "<td>" + escapeHtml(blocker.operatorType) + "</td>" +
          "<td>" + escapeHtml(blockerHost) + "</td>" +
          "<td>Harga paket ditahan: " + escapeHtml(blocker.component) + "</td>" +
          "<td>Belum ada angka terverifikasi</td>" +
          "<td>-</td>" +
          "<td>Ditahan evidence gate</td>" +
          "<td>" + escapeHtml(blocker.status + " - " + blocker.reason) + "</td>" +
          "<td>" + formatSourceLink(blocker.sourceUrl, "Sumber resmi") + "</td>" +
          "</tr>";
      }).join("");
      refs.mobilePackageTableBody.innerHTML = mobileHtml;
    } else if (useUsMobileCatalog && state.usMobileOperatorLoading) {
      refs.mobilePackageTableBody.innerHTML = emptyRow(9, "Memuat paket MNO/MVNO dari sumber resmi...");
    } else if (useUsMobileCatalog && catalogMobileBlockers.length) {
      refs.mobilePackageTableBody.innerHTML = catalogMobileBlockers.map(function (blocker) {
        var blockerHost = blocker.operatorType === "MVNO" ? (blocker.hostMno || "Host MNO belum terverifikasi") : "—";
        return "<tr>" +
          "<td>" + escapeHtml(blocker.provider) + "</td>" +
          "<td>" + escapeHtml(blocker.operatorType) + "</td>" +
          "<td>" + escapeHtml(blockerHost) + "</td>" +
          "<td>Harga paket ditahan: " + escapeHtml(blocker.component) + "</td>" +
          "<td>Belum ada angka terverifikasi</td>" +
          "<td>-</td>" +
          "<td>Ditahan evidence gate</td>" +
          "<td>" + escapeHtml(blocker.status + " - " + blocker.reason) + "</td>" +
          "<td>" + formatSourceLink(blocker.sourceUrl, "Sumber resmi") + "</td>" +
          "</tr>";
      }).join("");
    } else if (useUsMobileCatalog && state.usMobileOperatorError) {
      refs.mobilePackageTableBody.innerHTML = emptyRow(9, state.usMobileOperatorError);
    } else if (mobileSourceRows.length && state.energyPricesLoaded) {
      refs.mobilePackageTableBody.innerHTML = mobileSourceRows.map(function (source) {
        return "<tr>" +
          "<td>" + escapeHtml(source.provider || source.label || "Provider mobile") + "</td>" +
          "<td>Belum diklasifikasikan</td>" +
          "<td>-</td>" +
          "<td>Sumber registry/staging<br><span class=\"muted-cell\">" + escapeHtml(source.status || "Staging") + "</span></td>" +
          "<td>Kuota belum terverifikasi</td>" +
          "<td>Masa aktif belum terverifikasi</td>" +
          "<td>" + unavailablePriceCell(data, "mobileBillingUnit", "mobile") + "</td>" +
          "<td>" + escapeHtml(source.region || fallbackPriceRegion(data, "mobile")) + "</td>" +
          "<td>" + formatSourceLink(source.url, source.label || "Sumber") + "<br><span class=\"muted-cell\">" + escapeHtml(source.message || "Harga belum lolos evidence chain.") + "</span></td>" +
          "</tr>";
      }).join("");
    } else {
      refs.mobilePackageTableBody.innerHTML = state.energyPricesLoaded
        ? "<tr>" +
        "<td>Status mobile internet resmi</td>" +
        "<td>Jenis operator belum terverifikasi</td>" +
        "<td>Host MNO hanya wajib untuk MVNO</td>" +
        "<td>Publikasi paket data</td>" +
        "<td>Kuota mengikuti sumber resmi</td>" +
        "<td>Masa aktif mengikuti sumber resmi</td>" +
        "<td>" + unavailablePriceCell(data, "mobileBillingUnit", "mobile") + "</td>" +
        "<td>" + escapeHtml(fallbackPriceRegion(data, "mobile")) + "</td>" +
        "<td>" + unavailableSourceCell(data, "mobile") + "<br><span class=\"muted-cell\">" + escapeHtml(energyEmptyMessage(data, "mobile", "mobileBillingUnit", "Pemeriksaan sumber resmi mobile internet belum menghasilkan harga terverifikasi.")) + "</span></td>" +
        "</tr>"
        : emptyRow(9, refreshPrompt);
    }

    var water = data.water || {};
    var globalWaterRows = globalUtilityWaterRowsForEnergyTable(data);
    var waterSourceRows = globalUtilityEnergySourcesForTable(data, "water");
    var waterCountryCode = String((data.priceArea && data.priceArea.countryCode) || priceAreaForRequest().countryCode || "").toUpperCase();
    var waterAdm1 = String((data.priceArea && (data.priceArea.adm1 || data.priceArea.province)) || priceAreaForRequest().adm1 || priceAreaForRequest().province || "").trim();
    var useUsWaterHierarchy = waterCountryCode === "US" && Boolean(waterAdm1);
    var hierarchyWaterRows = useUsWaterHierarchy ? usWaterTariffHierarchyRows() : [];
    var waterRows = useUsWaterHierarchy
      ? hierarchyWaterRows
      : (globalWaterRows.length ? globalWaterRows : (Array.isArray(water.tariffs) ? water.tariffs : []));
    if (waterRows.length) {
      refs.waterTariffTableBody.innerHTML = waterRows.map(function (item) {
        var updateLabel = (item.effectiveDate || item.updatedAt || "-") + sourceStatusSuffix(item.sourceStatus);
        var hasSourcePrice = item.price !== null && item.price !== undefined && item.price !== "";
        var sourcePrice = hasSourcePrice ? item.price : item.pricePerM3Idr;
        var sourceCurrency = item.currency || (hasSourcePrice ? profile.currency : "IDR") || "IDR";
        var sourceUnit = hasSourcePrice ? (item.unit || profile.waterUnit || "m3") : "m3";
        return "<tr>" +
          "<td>" + escapeHtml(item.country || "-") + "</td>" +
          "<td>" + escapeHtml(item.state || item.adm1 || "-") + "</td>" +
          "<td>" + escapeHtml(item.localScope || item.serviceArea || item.municipality || item.region || "-") + "</td>" +
          "<td>" + escapeHtml(item.waterUtility || item.provider || "-") + "</td>" +
          "<td>" + escapeHtml(item.customerGroup || item.customerClass || "-") + "</td>" +
          "<td>" + escapeHtml(item.tariffTier || item.blockLabel || item.tariffCode || "-") + "</td>" +
          "<td>" + (sourcePrice !== null && sourcePrice !== undefined && sourcePrice !== "" ? formatSourceVolumePrice(sourcePrice, sourceCurrency, sourceUnit, item.priceText) : "Input manual") + "</td>" +
          "<td>" + formatConvertedVolumePrice(sourcePrice, sourceCurrency, sourceUnit) + "</td>" +
          "<td>" + escapeHtml(updateLabel) + "</td>" +
          "<td>" + formatSourceLink(item.sourceUrl || item.source, item.sourceLabel || "Sumber") + "</td>" +
          "</tr>";
      }).join("");
    } else if (useUsWaterHierarchy && state.usWaterTariffHierarchyLoading) {
      refs.waterTariffTableBody.innerHTML = emptyRow(10, "Memuat Country → State → local area → water utility → customer class → tariff/tier terverifikasi...");
    } else if (useUsWaterHierarchy && (state.usWaterTariffHierarchy || state.usWaterTariffHierarchyError)) {
      var hierarchyReason = state.usWaterTariffHierarchyError || state.usWaterTariffHierarchy.reason || "Tidak ada tarif yang lolos rantai evidence untuk state dan scope lokal terpilih.";
      refs.waterTariffTableBody.innerHTML = "<tr>" +
        "<td>United States</td>" +
        "<td>" + escapeHtml(waterAdm1) + "</td>" +
        "<td>Scope lokal belum menghasilkan tarif</td>" +
        "<td>Utility ditahan evidence gate</td>" +
        "<td>Customer class belum terverifikasi</td>" +
        "<td>Tariff/tier belum terverifikasi</td>" +
        "<td>-</td>" +
        "<td>-</td>" +
        "<td>" + escapeHtml(hierarchyReason) + "</td>" +
        "<td>EPA hanya registry identitas; bukan sumber harga.</td>" +
        "</tr>";
    } else if (waterSourceRows.length && state.energyPricesLoaded) {
      refs.waterTariffTableBody.innerHTML = waterSourceRows.map(function (source) {
        var selectedArea = data.priceArea || priceAreaForRequest();
        return "<tr>" +
          "<td>" + escapeHtml(selectedArea.country || "-") + "</td>" +
          "<td>" + escapeHtml(selectedArea.adm1 || selectedArea.province || "-") + "</td>" +
          "<td>" + escapeHtml(source.region || fallbackPriceRegion(data, "water")) + "</td>" +
          "<td>" + escapeHtml(source.provider || source.label || "Operator air") + "</td>" +
          "<td>Golongan belum terverifikasi</td>" +
          "<td>Tariff/tier belum terverifikasi</td>" +
          "<td>" + unavailablePriceCell(data, "waterUnit", "water") + "</td>" +
          "<td><span class=\"muted-cell\">Konversi menunggu harga dan unit sumber.</span></td>" +
          "<td>" + globalUtilityStagingStatusCell(source) + "</td>" +
          "<td>" + formatSourceLink(source.url, source.label || "Sumber") + "</td>" +
          "</tr>";
      }).join("");
    } else {
      refs.waterTariffTableBody.innerHTML = state.energyPricesLoaded
        ? "<tr>" +
        "<td>" + escapeHtml((data.priceArea && data.priceArea.country) || "-") + "</td>" +
        "<td>" + escapeHtml((data.priceArea && (data.priceArea.adm1 || data.priceArea.province)) || "-") + "</td>" +
        "<td>" + escapeHtml(fallbackPriceRegion(data, "water")) + "</td>" +
        "<td>Status tarif operator air resmi</td>" +
        "<td>Golongan pelanggan</td>" +
        "<td>Tariff/tier pemakaian</td>" +
        "<td>" + unavailablePriceCell(data, "waterUnit", "water") + "</td>" +
        "<td><span class=\"muted-cell\">Konversi menunggu harga dan unit sumber.</span></td>" +
        "<td>" + unavailableStatusCell(data, "water", "waterUnit", globalUtilityScopeBlocker(data, "water") || "Pemeriksaan sumber resmi air belum menghasilkan tarif terverifikasi.") + "</td>" +
        "<td>" + unavailableSourceCell(data, "water") + "</td>" +
        "</tr>"
        : emptyRow(10, refreshPrompt);
    }
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function formatDateTime(value) {
    if (!value) {
      return "-";
    }
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function currentMonthKey() {
    return new Date().toISOString().slice(0, 7);
  }

  function dateMonthKey(value) {
    if (!value) {
      return "";
    }
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value).slice(0, 7);
    }
    return date.toISOString().slice(0, 7);
  }

  function getCatalog(category) {
    return ASSET_CATALOG[category] || ASSET_CATALOG.Lainnya || { prefix: "AST", subtypes: [] };
  }

  function getSubtypeMeta(category, subtype) {
    var catalog = getCatalog(category);
    var match = (catalog.subtypes || []).find(function (item) {
      return item.name === subtype;
    });
    if (match) {
      return match;
    }
    if (!subtype && catalog.subtypes && catalog.subtypes[0]) {
      return catalog.subtypes[0];
    }
    return { name: subtype || "Aset catatan saja", watts: 0, capacityLabel: "", models: [] };
  }

  function storageKey() {
    return STORAGE_PREFIX + state.scopeKey;
  }

  function contextScopeKey(context) {
    if (context && context.mosque && context.mosque.id) {
      return "mosque-" + String(context.mosque.id);
    }

    if (context && context.mosque && context.location) {
      var lat = Number(context.location.latitude);
      var lon = Number(context.location.longitude);
      var coordinate = Number.isFinite(lat) && Number.isFinite(lon)
        ? lat.toFixed(5) + "-" + lon.toFixed(5)
        : "";
      var key = slugify([context.mosque.name, context.location.city, coordinate].filter(Boolean).join("-"));
      if (key) {
        return key;
      }
    }

    return "manual-local";
  }

  function createBuilding(id, name, type, typeLabel) {
    var buildingId = id || uid("building");
    var buildingName = cleanBuildingName(name, buildingId);
    var buildingType = textValue(type);
    return {
      id: buildingId,
      name: buildingName,
      type: buildingType,
      typeLabel: textValue(typeLabel) || buildingTypeLabel(buildingType, ""),
      code: buildingName ? codeFromName(buildingName, "BLD") : "BLD",
      assetCodeFormat: DEFAULT_ASSET_CODE_FORMAT,
      energy: {
        meterKind: "prepaid",
        meterCustomerNumber: "",
        meterPhase: "1-phase",
        installedPowerClass: "2200",
        installedPowerVa: 2200,
        tariffPerKwh: DEFAULT_TARIFF,
        monthlyBudget: 0,
        currentBalanceKwh: 0,
        minimumKwh: DEFAULT_MINIMUM_KWH
      },
      water: {
        sources: ["groundwater"],
        primarySource: "groundwater",
        provider: "",
        customerNumber: "",
        customerGroup: "social-worship",
        manualRatePerM3: 0,
        notes: ""
      },
      priceArea: {
        country: "",
        countryCode: "",
        adm0: "",
        adm1: "",
        adm2: "",
        adm0Id: "",
        adm1Id: "",
        adm2Id: "",
        province: "",
        city: "",
        fuelRegion: "",
        electricityRegion: "",
        telecomRegion: "",
        waterRegion: "",
        languages: [],
        notes: ""
      },
      plan: {
        length: 30,
        width: 20,
        height: 3.5
      },
      records: {
        assets: [],
        services: [],
        expenses: [],
        infaq: [],
        meterLogs: [],
        rooms: [],
        planZones: []
      }
    };
  }

  function createBlankData() {
    var routeBuilding = routeBuildingFromHash();
    var building = routeBuilding
      ? createBuilding(routeBuilding.id, routeBuilding.name)
      : createBuilding("main", "");
    building.code = routeBuilding ? codeFromName(routeBuilding.name, "BLD") : "BLD";
    return {
      schemaVersion: "mpm.facility-management.v1",
      updatedAt: new Date().toISOString(),
      currentBuildingId: building.id,
      contextSnapshot: state.context || null,
      buildings: [building]
    };
  }

  function normalizeBuilding(building, index) {
    var source = building && typeof building === "object" ? building : {};
    var id = source.id || (index === 0 ? "main" : uid("building"));
    var sourceName = String(source.name || "").trim();
    var normalized = createBuilding(id, cleanBuildingName(sourceName, id, index));
    var sourceCode = String(source.code || "").trim();
    if (!normalized.name && String(id || "") === "main" && /^(BU|UTM)$/i.test(sourceCode)) {
      sourceCode = "";
    }
    normalized.code = String(sourceCode || (normalized.name ? codeFromName(normalized.name, "BLD") : "BLD")).slice(0, 8);
    normalized.assetCodeFormat = String(source.assetCodeFormat || DEFAULT_ASSET_CODE_FORMAT);
    if (normalized.assetCodeFormat === LEGACY_ASSET_CODE_FORMAT) {
      normalized.assetCodeFormat = DEFAULT_ASSET_CODE_FORMAT;
    }
    normalized.webgis = normalizeWebgisMeta(source.webgis || null);
    normalized.type = textValue(source.type || source.buildingType || normalized.webgis.type || "");
    normalized.typeLabel = textValue(source.typeLabel || source.buildingTypeLabel || normalized.webgis.typeLabel || buildingTypeLabel(normalized.type, ""));
    normalized.energy = Object.assign({}, normalized.energy, source.energy || {});
    normalized.energy.meterKind = String(normalized.energy.meterKind || "prepaid");
    normalized.energy.meterCustomerNumber = String(normalized.energy.meterCustomerNumber || "");
    normalized.energy.meterPhase = String(normalized.energy.meterPhase || "1-phase");
    normalized.energy.installedPowerVa = toNumber(normalized.energy.installedPowerVa, 2200);
    normalized.energy.installedPowerClass = String(normalized.energy.installedPowerClass || powerCapacityClass(normalized.energy.installedPowerVa));
    normalized.energy.tariffPerKwh = toNumber(normalized.energy.tariffPerKwh, DEFAULT_TARIFF);
    normalized.energy.monthlyBudget = toNumber(normalized.energy.monthlyBudget, 0);
    normalized.energy.currentBalanceKwh = toNumber(normalized.energy.currentBalanceKwh, 0);
    normalized.energy.minimumKwh = toNumber(normalized.energy.minimumKwh, DEFAULT_MINIMUM_KWH);
    normalized.water = Object.assign({}, normalized.water, source.water || {});
    normalized.water.sources = Array.isArray(normalized.water.sources) && normalized.water.sources.length
      ? normalized.water.sources.map(String)
      : ["groundwater"];
    normalized.water.primarySource = String(normalized.water.primarySource || normalized.water.sources[0] || "groundwater");
    normalized.water.provider = String(normalized.water.provider || "");
    normalized.water.customerNumber = String(normalized.water.customerNumber || "");
    normalized.water.customerGroup = String(normalized.water.customerGroup || "social-worship");
    normalized.water.manualRatePerM3 = toNumber(normalized.water.manualRatePerM3, 0);
    normalized.water.notes = String(normalized.water.notes || "");
    normalized.priceArea = Object.assign({}, normalized.priceArea, source.priceArea || source.priceRegion || {});
    normalized.priceArea.adm0 = String(normalized.priceArea.adm0 || normalized.priceArea.country || "");
    normalized.priceArea.adm1 = String(normalized.priceArea.adm1 || normalized.priceArea.province || normalized.priceArea.region || "");
    normalized.priceArea.adm2 = String(normalized.priceArea.adm2 || normalized.priceArea.city || normalized.priceArea.regency || "");
    normalized.priceArea.adm0Id = admIdentityId(normalized.priceArea, "adm0");
    normalized.priceArea.adm1Id = admIdentityId(normalized.priceArea, "adm1");
    normalized.priceArea.adm2Id = admIdentityId(normalized.priceArea, "adm2");
    normalized.priceArea.province = String(normalized.priceArea.province || normalized.priceArea.region || "");
    normalized.priceArea.city = String(normalized.priceArea.city || normalized.priceArea.regency || "");
    normalized.priceArea.fuelRegion = String(normalized.priceArea.fuelRegion || normalized.priceArea.fuel_region || "");
    normalized.priceArea.electricityRegion = String(normalized.priceArea.electricityRegion || normalized.priceArea.electricity_region || "");
    normalized.priceArea.telecomRegion = String(normalized.priceArea.telecomRegion || normalized.priceArea.telecom_region || "");
    normalized.priceArea.waterRegion = String(normalized.priceArea.waterRegion || normalized.priceArea.water_region || "");
    normalized.priceArea.languages = normalizeLanguageTags(normalized.priceArea.languages || normalized.priceArea.languageCodes || normalized.priceArea.sourceLanguages || normalized.priceArea.language || "");
    normalized.priceArea.notes = String(normalized.priceArea.notes || "");
    normalized.priceArea = normalizePriceAreaCountry(normalized.priceArea);
    var sourcePlan = source.plan || {};
    normalized.plan = {
      length: Math.max(1, toNumber(sourcePlan.length !== undefined ? sourcePlan.length : sourcePlan.lengthMeters, 30)),
      width: Math.max(1, toNumber(sourcePlan.width !== undefined ? sourcePlan.width : sourcePlan.widthMeters, 20)),
      height: Math.max(1, toNumber(sourcePlan.height !== undefined ? sourcePlan.height : sourcePlan.heightMeters, 3.5))
    };
    normalized.records = Object.assign({}, normalized.records, source.records || {});
    ["assets", "services", "expenses", "infaq", "meterLogs", "rooms", "planZones"].forEach(function (key) {
      if (!Array.isArray(normalized.records[key])) {
        normalized.records[key] = [];
      }
    });
    delete normalized.records.people;
    return normalized;
  }

  function normalizeData(raw) {
    var data = raw && typeof raw === "object" ? raw : createBlankData();
    var buildings = Array.isArray(data.buildings) ? data.buildings : [];
    if (!buildings.length) {
      var routeBuilding = routeBuildingFromHash();
      buildings = [routeBuilding ? createBuilding(routeBuilding.id, routeBuilding.name) : createBuilding("main", "")];
    }
    data.buildings = buildings.map(normalizeBuilding);
    data.currentBuildingId = data.currentBuildingId || data.buildings[0].id;
    if (!data.buildings.some(function (building) {
      return building.id === data.currentBuildingId;
    })) {
      data.currentBuildingId = data.buildings[0].id;
    }
    data.schemaVersion = "mpm.facility-management.v1";
    data.contextSnapshot = state.context || data.contextSnapshot || null;
    return data;
  }

  function loadData() {
    if (!canUseStorage()) {
      state.data = createBlankData();
      return;
    }
    state.data = normalizeData(safeParse(window.localStorage.getItem(storageKey()), null));
  }

  function saveData() {
    if (!state.data) {
      return;
    }
    state.data.updatedAt = new Date().toISOString();
    state.data.contextSnapshot = state.context || state.data.contextSnapshot || null;
    if (canUseStorage()) {
      window.localStorage.setItem(storageKey(), JSON.stringify(state.data));
    }
  }

  function activeBuilding() {
    if (!state.data) {
      state.data = createBlankData();
    }
    var building = state.data.buildings.find(function (item) {
      return item.id === state.data.currentBuildingId;
    });
    if (!building) {
      building = state.data.buildings[0] || createBuilding("main", "");
      state.data.buildings = [building];
      state.data.currentBuildingId = building.id;
    }
    return building;
  }

  function applyRouteBuildingHash() {
    var route = routeBuildingFromHash();
    if (!route || !state.data) {
      return false;
    }
    var routeName = cleanBuildingName(route.name, route.id);
    var created = false;
    var renamed = false;
    var existing = state.data.buildings.find(function (building) {
      return slugify(building.id) === route.id;
    });
    if (!existing) {
      existing = createBuilding(route.id, routeName);
      existing.source = "url-hash";
      state.data.buildings.push(existing);
      created = true;
    } else if (routeName && existing.name !== routeName) {
      existing.name = routeName;
      existing.code = codeFromName(routeName, existing.code || "BLD");
      renamed = true;
    }
    var changed = state.data.currentBuildingId !== existing.id;
    state.data.currentBuildingId = existing.id;
    return changed || created || renamed;
  }

  function records() {
    return activeBuilding().records;
  }

  function planSettings() {
    var building = activeBuilding();
    if (!building.plan || typeof building.plan !== "object") {
      building.plan = { length: 30, width: 20, height: 3.5 };
    }
    building.plan.length = Math.max(1, toNumber(building.plan.length, 30));
    building.plan.width = Math.max(1, toNumber(building.plan.width, 20));
    building.plan.height = Math.max(1, toNumber(building.plan.height, 3.5));
    return building.plan;
  }

  function planRect(zone) {
    var plan = planSettings();
    var x = clamp(toNumber(zone.x, 0), 0, Math.max(0, plan.length - 0.5));
    var y = clamp(toNumber(zone.y, 0), 0, Math.max(0, plan.width - 0.5));
    var w = clamp(toNumber(zone.w, Math.min(8, plan.length)), 0.5, Math.max(0.5, plan.length - x));
    var h = clamp(toNumber(zone.h, Math.min(6, plan.width)), 0.5, Math.max(0.5, plan.width - y));
    return {
      x: x,
      y: y,
      w: w,
      h: h,
      leftPct: plan.length > 0 ? x / plan.length * 100 : 0,
      topPct: plan.width > 0 ? y / plan.width * 100 : 0,
      widthPct: plan.length > 0 ? w / plan.length * 100 : 0,
      heightPct: plan.width > 0 ? h / plan.width * 100 : 0
    };
  }

  function rectanglePoints(rect) {
    return [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h }
    ];
  }

  function parsePlanPoints(value) {
    return String(value || "").split(/[;\n]+/).map(function (entry) {
      var parts = entry.trim().split(/[,\s]+/).filter(Boolean);
      if (parts.length < 2) {
        return null;
      }
      return {
        x: optionalNumber(parts[0]),
        y: optionalNumber(parts[1])
      };
    }).filter(function (point) {
      return point && point.x !== null && point.y !== null;
    });
  }

  function normalizePlanPoints(points) {
    var plan = planSettings();
    if (!Array.isArray(points)) {
      return [];
    }
    return points.map(function (point) {
      var x = Array.isArray(point) ? point[0] : point.x;
      var y = Array.isArray(point) ? point[1] : point.y;
      return {
        x: round(clamp(toNumber(x, 0), 0, plan.length), 1),
        y: round(clamp(toNumber(y, 0), 0, plan.width), 1)
      };
    }).filter(function (point, index, list) {
      if (index === 0) {
        return true;
      }
      var previous = list[index - 1];
      return previous.x !== point.x || previous.y !== point.y;
    });
  }

  function formatPlanPoints(points) {
    return normalizePlanPoints(points).map(function (point) {
      return String(round(point.x, 1)) + "," + String(round(point.y, 1));
    }).join("; ");
  }

  function boundsFromPoints(points) {
    var normalized = normalizePlanPoints(points);
    if (!normalized.length) {
      return null;
    }
    var xs = normalized.map(function (point) { return point.x; });
    var ys = normalized.map(function (point) { return point.y; });
    var minX = Math.min.apply(Math, xs);
    var maxX = Math.max.apply(Math, xs);
    var minY = Math.min.apply(Math, ys);
    var maxY = Math.max.apply(Math, ys);
    var plan = planSettings();
    return {
      x: minX,
      y: minY,
      w: Math.max(0.5, maxX - minX),
      h: Math.max(0.5, maxY - minY),
      leftPct: plan.length > 0 ? minX / plan.length * 100 : 0,
      topPct: plan.width > 0 ? minY / plan.width * 100 : 0,
      widthPct: plan.length > 0 ? Math.max(0.5, maxX - minX) / plan.length * 100 : 0,
      heightPct: plan.width > 0 ? Math.max(0.5, maxY - minY) / plan.width * 100 : 0
    };
  }

  function zoneShape(zone) {
    return zone && zone.shape === "polygon" && normalizePlanPoints(zone.points).length >= 3 ? "polygon" : "rect";
  }

  function zonePoints(zone) {
    if (zoneShape(zone) === "polygon") {
      return normalizePlanPoints(zone.points);
    }
    return rectanglePoints(planRect(zone));
  }

  function planZoneBounds(zone) {
    return boundsFromPoints(zonePoints(zone)) || planRect(zone);
  }

  function zoneClipPath(zone, bounds) {
    if (zoneShape(zone) !== "polygon") {
      return "";
    }
    var points = zonePoints(zone);
    var path = points.map(function (point) {
      var x = bounds.w > 0 ? (point.x - bounds.x) / bounds.w * 100 : 0;
      var y = bounds.h > 0 ? (point.y - bounds.y) / bounds.h * 100 : 0;
      return round(x, 2) + "% " + round(y, 2) + "%";
    }).join(", ");
    return "polygon(" + path + ")";
  }

  function zoneArea(points) {
    var normalized = normalizePlanPoints(points);
    if (normalized.length < 3) {
      return 0;
    }
    var total = 0;
    normalized.forEach(function (point, index) {
      var next = normalized[(index + 1) % normalized.length];
      total += point.x * next.y - next.x * point.y;
    });
    return Math.abs(total / 2);
  }

  function pointInsidePolygon(point, polygon) {
    var inside = false;
    var points = normalizePlanPoints(polygon);
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
      var xi = points[i].x;
      var yi = points[i].y;
      var xj = points[j].x;
      var yj = points[j].y;
      var intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 0.000001) + xi);
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  function polygonCentroid(points) {
    var normalized = normalizePlanPoints(points);
    if (!normalized.length) {
      return { x: 0, y: 0 };
    }
    var total = normalized.reduce(function (summary, point) {
      summary.x += point.x;
      summary.y += point.y;
      return summary;
    }, { x: 0, y: 0 });
    return {
      x: total.x / normalized.length,
      y: total.y / normalized.length
    };
  }

  function shiftedZonePoints(points, dx, dy) {
    var normalized = normalizePlanPoints(points);
    var bounds = boundsFromPoints(normalized);
    var plan = planSettings();
    if (!bounds) {
      return normalized;
    }
    var safeDx = clamp(dx, -bounds.x, plan.length - (bounds.x + bounds.w));
    var safeDy = clamp(dy, -bounds.y, plan.width - (bounds.y + bounds.h));
    return normalized.map(function (point) {
      return {
        x: round(point.x + safeDx, 1),
        y: round(point.y + safeDy, 1)
      };
    });
  }

  function planPercent(value, total) {
    return total > 0 ? clamp(value, 0, total) / total * 100 : 0;
  }

  function roomNameKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function roomPlanInfo(roomName) {
    var target = roomNameKey(roomName);
    if (!target || !state.data) {
      return null;
    }
    var zone = records().planZones.find(function (item) {
      return roomNameKey(item.name) === target;
    });
    if (!zone) {
      return null;
    }
    var points = zonePoints(zone);
    var area = zoneArea(points);
    return {
      zone: zone,
      shape: zoneShape(zone),
      area: area,
      points: points
    };
  }

  function setContext(context) {
    state.context = context;
    state.scopeKey = contextScopeKey(context);
  }

  function resolveContext() {
    if (window.MpmAdminLocation && typeof window.MpmAdminLocation.resolve === "function") {
      state.resolvingContext = true;
      return window.MpmAdminLocation.resolve().then(function (context) {
        setContext(context);
      }).catch(function () {
        setContext(window.MpmAdminLocation.read ? window.MpmAdminLocation.read() : null);
      }).then(function () {
        state.resolvingContext = false;
      });
    }

    setContext(null);
    return Promise.resolve();
  }

  function refreshForContext(context) {
    var nextScopeKey = contextScopeKey(context);
    var scopeChanged = nextScopeKey !== state.scopeKey;
    setContext(context);
    if (!state.data) {
      return;
    }
    if (scopeChanged) {
      loadData();
      if (applyRouteBuildingHash()) {
        saveData();
      }
      resetAllForms();
      renderAll();
      return;
    }
    renderScope();
  }

  function populateCatalogOptions() {
    var currentCategory = refs.assetCategoryInput.value;
    var categories = Object.keys(ASSET_CATALOG);
    populateMeterTypeOptions();
    populatePowerCapacityOptions();
    refs.assetCategoryInput.innerHTML = "<option value=\"\">Pilih jenis aset</option>" + categories.map(function (category) {
      return "<option value=\"" + escapeHtml(category) + "\">" + escapeHtml(category) + "</option>";
    }).join("");
    refs.assetCategoryInput.value = categories.indexOf(currentCategory) !== -1 ? currentCategory : "";
    populateSubtypeOptions();
  }

  function populateSubtypeOptions(selectedSubtype) {
    var catalog = getCatalog(refs.assetCategoryInput.value);
    var subtypes = refs.assetCategoryInput.value ? (catalog.subtypes || []) : [];
    var currentSubtype = selectedSubtype || refs.assetSubtypeInput.value;
    var hasCurrentSubtype = subtypes.some(function (item) {
      return item.name === currentSubtype;
    });
    var subtypeOptions = subtypes.map(function (item) {
      var label = item.name + (item.watts ? " - " + item.watts + " W" : " - catatan");
      return "<option value=\"" + escapeHtml(item.name) + "\">" + escapeHtml(label) + "</option>";
    });
    var options = ["<option value=\"\">Pilih type / jenis</option>"].concat(subtypeOptions);
    if (selectedSubtype && currentSubtype && !hasCurrentSubtype) {
      options.push("<option value=\"" + escapeHtml(currentSubtype) + "\">" + escapeHtml(currentSubtype + " - custom") + "</option>");
    }
    if (refs.assetSubtypeInput.tagName === "SELECT") {
      refs.assetSubtypeInput.innerHTML = options.join("");
      refs.assetSubtypeInput.value = currentSubtype && (hasCurrentSubtype || selectedSubtype)
        ? currentSubtype
        : "";
    } else {
      if (refs.assetSubtypeList) {
        refs.assetSubtypeList.innerHTML = subtypeOptions.join("");
      }
      if (selectedSubtype !== undefined) {
        refs.assetSubtypeInput.value = currentSubtype || "";
      } else if (!refs.assetCategoryInput.value) {
        refs.assetSubtypeInput.value = "";
      }
    }
    setVehicleFieldsVisibility();
    populateBrandOptions();
    applySubtypeDefaults();
  }

  function applySubtypeDefaults() {
    clearBrandLookup();
    setVehicleFieldsVisibility();
    if (!refs.assetCategoryInput.value || !refs.assetSubtypeInput.value) {
      populateCapacityOptions();
      populateBrandOptions();
      updateAssetCodePreview();
      updateAssetEstimate();
      return;
    }
    var meta = getSubtypeMeta(refs.assetCategoryInput.value, refs.assetSubtypeInput.value);
    var isEditing = Boolean(refs.assetIdInput.value);
    if (!isEditing || refs.assetWattsInput.value === "" || Number(refs.assetWattsInput.value) === 0) {
      refs.assetWattsInput.value = String(meta.watts || 0);
    }
    if (!isEditing && meta.capacityLabel && (!refs.assetCapacityInput.value.trim() || refs.assetCapacityInput.value.trim() === state.lastAutoAssetCapacity)) {
      state.lastAutoAssetCapacity = meta.capacityLabel;
      refs.assetCapacityInput.value = state.lastAutoAssetCapacity;
    }
    if (!isEditing && isVehicleCategory(refs.assetCategoryInput.value)) {
      if (meta.wheels !== undefined && !refs.assetWheelCountInput.value) {
        refs.assetWheelCountInput.value = String(meta.wheels);
      }
      if (meta.vehicleKind && !refs.assetVehicleKindInput.value) {
        refs.assetVehicleKindInput.value = meta.vehicleKind;
      }
    }
    if (!isEditing && meta.fuelType && refs.assetFuelTypeInput && !refs.assetFuelTypeInput.value) {
      refs.assetFuelTypeInput.value = meta.fuelType;
    }
    updateAssetCodePreview();
    populateBrandOptions();
    applyModelSuggestion();
    updateAssetEstimate();
  }

  function populateMeterTypeOptions() {
    if (!refs.meterKindInput) {
      return;
    }
    var current = refs.meterKindInput.value || "prepaid";
    refs.meterKindInput.innerHTML = Object.keys(METER_KIND_LABELS).map(function (key) {
      return "<option value=\"" + escapeHtml(key) + "\">" + escapeHtml(METER_KIND_LABELS[key]) + "</option>";
    }).join("");
    refs.meterKindInput.value = METER_KIND_LABELS[current] ? current : Object.keys(METER_KIND_LABELS)[0];
  }

  function populatePowerCapacityOptions() {
    if (!refs.installedPowerClassInput) {
      return;
    }
    var current = refs.installedPowerClassInput.value || "2200";
    var rows = POWER_CAPACITY_DETAILS.length
      ? POWER_CAPACITY_DETAILS
      : POWER_CAPACITY_OPTIONS.map(function (va) {
        return { va: va, phase: va >= 11000 ? "3-phase" : "1-phase", label: formatNumber(va, 0) + " VA" };
      });
    refs.installedPowerClassInput.innerHTML = rows.map(function (item) {
      return "<option value=\"" + item.va + "\">" + escapeHtml(item.label) + "</option>";
    }).join("") + "<option value=\"custom\">Custom</option>";
    refs.installedPowerClassInput.value = rows.some(function (item) {
      return String(item.va) === current;
    }) || current === "custom" ? current : "custom";
  }

  function uniqueSorted(values) {
    var seen = {};
    return values.filter(function (value) {
      var text = String(value || "").trim();
      var key = text.toLowerCase();
      if (!text || seen[key]) {
        return false;
      }
      seen[key] = true;
      return true;
    }).sort(function (a, b) {
      return a.localeCompare(b, "id");
    });
  }

  function modelDisplay(model) {
    return [model.model, model.series].filter(Boolean).join(" / ");
  }

  function modelsForCurrentType() {
    var meta = getSubtypeMeta(refs.assetCategoryInput.value, refs.assetSubtypeInput.value);
    return Array.isArray(meta.models) ? meta.models : [];
  }

  function modelsForCurrentCategory() {
    var catalog = getCatalog(refs.assetCategoryInput.value);
    return (catalog.subtypes || []).reduce(function (models, subtype) {
      return models.concat(Array.isArray(subtype.models) ? subtype.models : []);
    }, []);
  }

  function isVehicleCategory(category) {
    return String(category || "").toLowerCase() === "kendaraan";
  }

  function isGensetCategory(category) {
    return String(category || "").toLowerCase() === "genset";
  }

  function isFuelAssetCategory(category) {
    return isVehicleCategory(category) || isGensetCategory(category);
  }

  function setVehicleFieldsVisibility() {
    if (refs.vehicleAssetFields) {
      refs.vehicleAssetFields.hidden = !isVehicleCategory(refs.assetCategoryInput.value);
    }
    if (refs.fuelAssetFields) {
      refs.fuelAssetFields.hidden = !isFuelAssetCategory(refs.assetCategoryInput.value);
    }
  }

  function resetVehicleFields() {
    refs.assetWheelCountInput.value = "";
    refs.assetVehicleKindInput.value = "";
    refs.assetVehicleYearInput.value = "";
    refs.assetVehicleColorInput.value = "";
    refs.assetVehiclePlateInput.value = "";
    if (refs.assetFuelTypeInput) {
      refs.assetFuelTypeInput.value = "";
    }
    if (refs.assetFuelCapacityInput) {
      refs.assetFuelCapacityInput.value = "";
    }
  }

  function vehicleDetailsFromForm() {
    return {
      wheels: optionalNumber(refs.assetWheelCountInput.value),
      kind: refs.assetVehicleKindInput.value,
      productionYear: optionalNumber(refs.assetVehicleYearInput.value),
      color: refs.assetVehicleColorInput.value.trim(),
      plateNumber: refs.assetVehiclePlateInput.value.trim()
    };
  }

  function vehicleDetailLine(vehicle) {
    var source = vehicle && typeof vehicle === "object" ? vehicle : {};
    return [
      source.kind || "",
      source.wheels !== null && source.wheels !== undefined ? formatNumber(source.wheels, 0) + " roda" : "",
      source.productionYear !== null && source.productionYear !== undefined ? "Tahun " + formatNumber(source.productionYear, 0) : "",
      source.color || "",
      source.plateNumber ? "Plat " + source.plateNumber : ""
    ].filter(Boolean).join(" - ");
  }

  function fuelDetailsFromForm() {
    return {
      type: refs.assetFuelTypeInput ? refs.assetFuelTypeInput.value : "",
      capacity: refs.assetFuelCapacityInput ? refs.assetFuelCapacityInput.value.trim() : ""
    };
  }

  function fuelDetailLine(fuel) {
    var source = fuel && typeof fuel === "object" ? fuel : {};
    return [
      source.type ? "BBM " + source.type : "",
      source.capacity ? "Tangki " + source.capacity : ""
    ].filter(Boolean).join(" - ");
  }

  function populateCapacityOptions() {
    var meta = getSubtypeMeta(refs.assetCategoryInput.value, refs.assetSubtypeInput.value);
    var values = modelsForCurrentType().map(function (model) {
      return model.capacityLabel;
    });
    if (meta.capacityLabel) {
      values.push(meta.capacityLabel);
    }
    refs.assetCapacityList.innerHTML = uniqueSorted(values).map(function (capacity) {
      return "<option value=\"" + escapeHtml(capacity) + "\"></option>";
    }).join("");
  }

  function populateBrandOptions() {
    var models = modelsForCurrentCategory();
    refs.brandSuggestionList.innerHTML = uniqueSorted(models.map(function (model) {
      return model.brand;
    })).map(function (brand) {
      return "<option value=\"" + escapeHtml(brand) + "\"></option>";
    }).join("");
    populateCapacityOptions();
    populateSeriesOptions();
  }

  function populateSeriesOptions() {
    var brand = refs.assetBrandInput.value.trim().toLowerCase();
    var models = modelsForCurrentType().filter(function (model) {
      return !brand || model.brand.toLowerCase() === brand;
    });
    refs.seriesSuggestionList.innerHTML = uniqueSorted(models.map(modelDisplay)).map(function (model) {
      return "<option value=\"" + escapeHtml(model) + "\"></option>";
    }).join("");
  }

  function findCurrentModelSuggestion() {
    var brand = refs.assetBrandInput.value.trim().toLowerCase();
    var modelText = refs.assetModelInput.value.trim().toLowerCase();
    if (!modelText) {
      return null;
    }
    return modelsForCurrentType().find(function (model) {
      var display = modelDisplay(model).toLowerCase();
      return display === modelText && (!brand || model.brand.toLowerCase() === brand);
    }) || null;
  }

  function brandFingerprint(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function currentLookupKey() {
    return [
      brandFingerprint(refs.assetBrandInput.value),
      refs.assetCategoryInput.value,
      refs.assetSubtypeInput.value
    ].join("|");
  }

  function brandExistsForCurrentType(brand) {
    var needle = brandFingerprint(brand);
    if (!needle) {
      return false;
    }
    return modelsForCurrentCategory().some(function (model) {
      return brandFingerprint(model.brand) === needle;
    });
  }

  function setBrandLookupVisible(visible) {
    if (!refs.brandLookupPanel) {
      return;
    }
    refs.brandLookupPanel.hidden = !visible;
  }

  function setBrandLookupStatus(text) {
    if (refs.brandLookupStatus) {
      refs.brandLookupStatus.textContent = text;
    }
    setBrandLookupVisible(true);
  }

  function clearBrandLookup() {
    state.brandLookupKey = "";
    state.brandLookupData = null;
    if (refs.brandLookupResults) {
      refs.brandLookupResults.innerHTML = "";
    }
    setBrandLookupVisible(false);
  }

  function lookupPayloadFromForm(evidence) {
    var modelText = refs.assetModelInput.value.trim();
    var model = modelText;
    var series = "";
    var separatorIndex = modelText.indexOf(" / ");
    if (separatorIndex !== -1) {
      model = modelText.slice(0, separatorIndex).trim();
      series = modelText.slice(separatorIndex + 3).trim();
    }

    return {
      brand: refs.assetBrandInput.value.trim(),
      category: refs.assetCategoryInput.value,
      categoryPrefix: getCatalog(refs.assetCategoryInput.value).prefix || "AST",
      subtype: refs.assetSubtypeInput.value,
      model: model,
      series: series,
      capacityLabel: refs.assetCapacityInput.value.trim(),
      claimPowerWatts: toNumber(refs.assetWattsInput.value, 0),
      evidenceUrl: evidence && evidence.url ? evidence.url : "",
      evidenceTitle: evidence && evidence.title ? evidence.title : ""
    };
  }

  function renderLookupActions(data) {
    var actions = [];
    if (data.canAdd) {
      actions.push("<button class=\"button button-primary\" type=\"button\" data-lookup-action=\"add\" data-evidence-index=\"0\">Tambah ke katalog SQL</button>");
    } else if (data.canManualAdd) {
      actions.push("<button class=\"button button-secondary\" type=\"button\" data-lookup-action=\"add-manual\">Tambah manual dari nameplate</button>");
    }
    return actions.length ? "<div class=\"lookup-actions\">" + actions.join("") + "</div>" : "";
  }

  function renderBrandLookupResult(data) {
    state.brandLookupData = data;
    state.brandLookupKey = currentLookupKey();
    setBrandLookupVisible(true);

    if (data.exists && data.exactMatch) {
      setBrandLookupStatus("Merk sudah ada di katalog: " + data.exactMatch.brandName + ".");
      refs.brandLookupResults.innerHTML = "";
      return;
    }

    if (data.typoCandidates && data.typoCandidates.length) {
      setBrandLookupStatus("Input mirip merk yang sudah ada. Pilih saran supaya typo tidak masuk database.");
      refs.brandLookupResults.innerHTML = data.typoCandidates.map(function (item) {
        return "<div class=\"lookup-result\">" +
          "<b>" + escapeHtml(item.brandName) + "</b>" +
          "<span>Kemiripan " + escapeHtml(item.score) + "%, jarak typo " + escapeHtml(item.distance) + ".</span>" +
          "<div class=\"lookup-actions\">" +
            "<button class=\"button button-primary\" type=\"button\" data-lookup-action=\"use-brand\" data-brand=\"" + escapeHtml(item.brandName) + "\">Gunakan merk ini</button>" +
          "</div>" +
        "</div>";
      }).join("");
      return;
    }

    var online = data.online || {};
    var evidence = Array.isArray(online.evidence) ? online.evidence : [];
    var statusText = online.message || "Hasil pencarian online sudah dicek.";
    if (online.confidence) {
      statusText += " Confidence: " + online.confidence + ".";
    }
    if (online.safetyMessage) {
      statusText += " " + online.safetyMessage;
    }
    setBrandLookupStatus(statusText);

    var rows = evidence.map(function (item, index) {
      var safety = item.safety || {};
      var safetyLine = safety.label
        ? "<span>Keamanan sumber: " + escapeHtml(safety.label + (safety.reason ? " - " + safety.reason : "")) + "</span>"
        : "";
      return "<div class=\"lookup-result\">" +
        "<a href=\"" + escapeHtml(item.url) + "\" target=\"_blank\" rel=\"noopener noreferrer nofollow\">" + escapeHtml(item.title || item.url) + "</a>" +
        safetyLine +
        (item.snippet ? "<span>" + escapeHtml(item.snippet) + "</span>" : "") +
        (data.canAdd ? "<div class=\"lookup-actions\"><button class=\"button button-secondary\" type=\"button\" data-lookup-action=\"add\" data-evidence-index=\"" + index + "\">Tambah pakai bukti ini</button></div>" : "") +
      "</div>";
    });

    if (!rows.length) {
      rows.push("<div class=\"lookup-result\"><span>Belum ada bukti online yang cukup, tetapi merk bisa ditambahkan manual jika memang benar dari nameplate perangkat.</span></div>");
    }

    refs.brandLookupResults.innerHTML = renderLookupActions(data) + rows.join("");
  }

  function lookupBrandOnline(force) {
    var brand = refs.assetBrandInput.value.trim();
    if (!brand) {
      setBrandLookupStatus("Isi merk terlebih dahulu.");
      refs.assetBrandInput.focus();
      return Promise.resolve();
    }
    if (!force && brandExistsForCurrentType(brand)) {
      clearBrandLookup();
      return Promise.resolve();
    }
    if (!window.fetch) {
      setBrandLookupStatus("Browser belum mendukung pencarian online.");
      return Promise.resolve();
    }
    var key = currentLookupKey();
    if (!force && key === state.brandLookupKey && state.brandLookupData) {
      renderBrandLookupResult(state.brandLookupData);
      return Promise.resolve();
    }

    setBrandLookupStatus("Mengecek merk dan typo ke katalog SQL, lalu mencari online bila belum ada.");
    if (refs.brandLookupResults) {
      refs.brandLookupResults.innerHTML = "";
    }
    refs.brandLookupButton.disabled = true;

    var query = [
      "brand=" + encodeURIComponent(brand),
      "category=" + encodeURIComponent(refs.assetCategoryInput.value),
      "subtype=" + encodeURIComponent(refs.assetSubtypeInput.value)
    ].join("&");

    return window.fetch(BRAND_LOOKUP_ENDPOINT + "?" + query, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok || !payload.success) {
          throw new Error(payload && payload.error ? payload.error : "Lookup merk gagal.");
        }
        renderBrandLookupResult(payload.data || {});
      });
    }).catch(function (error) {
      setBrandLookupStatus(error.message || "Lookup merk gagal.");
    }).then(function () {
      refs.brandLookupButton.disabled = false;
    });
  }

  function maybeLookupUnknownBrand() {
    var brand = refs.assetBrandInput.value.trim();
    if (!brand || brandExistsForCurrentType(brand)) {
      clearBrandLookup();
      return;
    }
    lookupBrandOnline(false);
  }

  function upsertLookupBrand(evidence, overrideTypo, options) {
    options = options || {};
    if (!window.fetch) {
      setBrandLookupStatus("Browser belum mendukung update katalog.");
      return options.rethrow ? Promise.reject(new Error("Browser belum mendukung update katalog.")) : Promise.resolve(null);
    }
    var payload = lookupPayloadFromForm(evidence);
    payload.overrideTypo = Boolean(overrideTypo);
    payload.autoMode = Boolean(options.autoMode);
    if (!payload.brand) {
      setBrandLookupStatus("Isi merk terlebih dahulu.");
      return options.rethrow ? Promise.reject(new Error("Isi merk terlebih dahulu.")) : Promise.resolve(null);
    }

    setBrandLookupStatus(payload.autoMode
      ? "Smart update: verifikasi merk, type, model, seri, dan bukti online aman sebelum menulis katalog SQL."
      : "Menambahkan merk ke katalog SQL.");
    refs.brandLookupButton.disabled = true;
    return window.fetch(BRAND_LOOKUP_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json().then(function (result) {
        if (!response.ok || !result.success) {
          var data = result && result.data ? result.data : {};
          var requestError = new Error(result && result.error ? result.error : "Update katalog gagal.");
          requestError.status = response.status;
          requestError.lookupData = data;
          if (data.typoCandidates && data.typoCandidates.length) {
            renderBrandLookupResult({
              exists: false,
              typoCandidates: data.typoCandidates,
              online: { evidence: [] },
              canAdd: false,
              canManualAdd: false
            });
          }
          throw requestError;
        }
        var added = result.data || {};
        refs.assetBrandInput.value = added.brandName || payload.brand;
        if (added.model && added.model.modelName) {
          refs.assetModelInput.value = [added.model.modelName, added.model.seriesName].filter(Boolean).join(" / ");
          if (added.model.capacityLabel && !refs.assetCapacityInput.value.trim()) {
            refs.assetCapacityInput.value = added.model.capacityLabel;
          }
          if (added.model.claimPowerWatts !== undefined) {
            refs.assetWattsInput.value = String(added.model.claimPowerWatts || 0);
          }
        }
        return loadCatalog().then(function () {
          populateCatalogOptions();
          refs.assetCategoryInput.value = payload.category;
          populateSubtypeOptions(payload.subtype);
          refs.assetBrandInput.value = added.brandName || payload.brand;
          populateSeriesOptions();
          updateAssetEstimate();
          setBrandLookupStatus((added.warning || (payload.autoMode ? "Smart update berhasil. Merk, type, model, dan seri sudah masuk katalog SQL." : "Merk dan model sudah masuk katalog SQL.")) + " Datalist diperbarui.");
          refs.brandLookupResults.innerHTML = "";
          return added;
        });
      });
    }).catch(function (error) {
      setBrandLookupStatus(error.message || "Update katalog gagal.");
      if (options.rethrow) {
        throw error;
      }
      return null;
    }).then(function (value) {
      refs.brandLookupButton.disabled = false;
      return value;
    }, function (error) {
      refs.brandLookupButton.disabled = false;
      throw error;
    });
  }

  function handleBrandLookupAction(event) {
    var button = event.target.closest("[data-lookup-action]");
    if (!button) {
      return;
    }
    var action = button.getAttribute("data-lookup-action");
    if (action === "use-brand") {
      refs.assetBrandInput.value = button.getAttribute("data-brand") || refs.assetBrandInput.value;
      applyBrandSuggestion();
      clearBrandLookup();
      refs.assetModelInput.focus();
      return;
    }
    if (action === "add" || action === "add-manual") {
      var evidence = null;
      if (action === "add" && state.brandLookupData && state.brandLookupData.online) {
        var evidenceList = state.brandLookupData.online.evidence || [];
        var evidenceIndex = Math.max(0, Math.round(toNumber(button.getAttribute("data-evidence-index"), 0)));
        evidence = evidenceList[evidenceIndex] || evidenceList[0] || null;
      }
      if (action === "add-manual" && !window.confirm("Pencarian online belum membuktikan merk ini terkait jenis barang yang dipilih. Tambahkan hanya kalau nama merk benar dari nameplate/perangkat fisik.")) {
        return;
      }
      upsertLookupBrand(evidence, action === "add-manual");
    }
  }

  function applyBrandSuggestion() {
    populateSeriesOptions();
    var brand = refs.assetBrandInput.value.trim().toLowerCase();
    if (!brand || refs.assetModelInput.value.trim()) {
      return;
    }
    var matches = modelsForCurrentType().filter(function (model) {
      return model.brand.toLowerCase() === brand;
    });
    if (matches.length === 1) {
      refs.assetModelInput.value = modelDisplay(matches[0]);
      applyModelSuggestion();
    }
  }

  function applyModelSuggestion() {
    var model = findCurrentModelSuggestion();
    if (!model) {
      populateSeriesOptions();
      return;
    }
    if (!refs.assetBrandInput.value.trim() && model.brand) {
      refs.assetBrandInput.value = model.brand;
    }
    if (model.claimPowerWatts !== null && model.claimPowerWatts !== undefined) {
      refs.assetWattsInput.value = String(model.claimPowerWatts || 0);
    }
    if (model.capacityLabel) {
      state.lastAutoAssetCapacity = model.capacityLabel;
      refs.assetCapacityInput.value = state.lastAutoAssetCapacity;
    }
    if (model.fuelType && refs.assetFuelTypeInput && isFuelAssetCategory(refs.assetCategoryInput.value)) {
      refs.assetFuelTypeInput.value = model.fuelType;
    }
    updateAssetEstimate();
  }

  function handleAssetCategoryChange() {
    refs.assetSubtypeInput.value = "";
    refs.assetBrandInput.value = "";
    refs.assetModelInput.value = "";
    refs.assetCapacityInput.value = "";
    resetVehicleFields();
    state.lastAutoAssetCapacity = "";
    clearBrandLookup();
    populateSubtypeOptions();
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function assetCodeTokens(category) {
    var building = activeBuilding();
    var catalog = getCatalog(category);
    return {
      SITE: scopePrefix(),
      BUILDING: building.code || "BLD",
      MASJID: scopePrefix(),
      MOSQUE: scopePrefix(),
      GEDUNG: building.code || "BLD",
      JENIS: catalog.prefix || "AST",
      TYPE: catalog.prefix || "AST",
      TAHUN: String(new Date().getFullYear()),
      YEAR: String(new Date().getFullYear())
    };
  }

  function assetCodeSequencePattern(format, category) {
    var tokens = assetCodeTokens(category);
    var source = String(format || DEFAULT_ASSET_CODE_FORMAT);
    var match = null;
    var sequencePadding = 3;
    var cursor = 0;
    var pattern = "^";
    var tokenPattern = /\{([A-Z]+)(\d*)\}/gi;

    while ((match = tokenPattern.exec(source)) !== null) {
      pattern += escapeRegExp(source.slice(cursor, match.index));
      var token = match[1].toUpperCase();
      var digits = Number(match[2] || 0);
      if (token === "URUT" || token === "SEQ") {
        sequencePadding = digits || sequencePadding;
        pattern += "(\\d+)";
      } else {
        pattern += escapeRegExp(tokens[token] || "");
      }
      cursor = match.index + match[0].length;
    }
    pattern += escapeRegExp(source.slice(cursor)) + "$";

    if (!/\{(?:URUT|SEQ)\d*\}/i.test(source)) {
      var base = source.replace(/\{([A-Z]+)(\d*)\}/gi, function (full, tokenName) {
        return tokens[tokenName.toUpperCase()] || "";
      });
      pattern = "^" + escapeRegExp(base) + "-(\\d+)$";
    }

    return {
      regex: new RegExp(pattern, "i"),
      padding: sequencePadding
    };
  }

  function renderAssetCodeFormat(format, category, sequence) {
    var source = String(format || DEFAULT_ASSET_CODE_FORMAT).trim() || DEFAULT_ASSET_CODE_FORMAT;
    var tokens = assetCodeTokens(category);
    var rendered = source.replace(/\{([A-Z]+)(\d*)\}/gi, function (full, tokenName, digits) {
      var token = tokenName.toUpperCase();
      if (token === "URUT" || token === "SEQ") {
        return String(sequence).padStart(Number(digits || 3), "0");
      }
      return tokens[token] || "";
    });
    if (!/\{(?:URUT|SEQ)\d*\}/i.test(source)) {
      rendered += "-" + String(sequence).padStart(3, "0");
    }
    return rendered;
  }

  function generateAssetCode(category) {
    var format = activeBuilding().assetCodeFormat || DEFAULT_ASSET_CODE_FORMAT;
    var sequence = assetCodeSequencePattern(format, category);
    var max = records().assets.reduce(function (highest, asset) {
      var match = String(asset.code || "").match(sequence.regex);
      if (!match) {
        return highest;
      }
      var number = Number(match[1]);
      return Number.isFinite(number) ? Math.max(highest, number) : highest;
    }, 0);
    return renderAssetCodeFormat(format, category, max + 1);
  }

  function updateAssetCodePreview() {
    if (refs.assetIdInput.value) {
      return;
    }
    if (!refs.assetCategoryInput.value) {
      if (!refs.assetCodeInput.value.trim() || refs.assetCodeInput.value.trim() === state.lastAutoAssetCode) {
        refs.assetCodeInput.value = "";
      }
      state.lastAutoAssetCode = "";
      return;
    }
    var current = refs.assetCodeInput.value.trim();
    if (!current || current === state.lastAutoAssetCode) {
      state.lastAutoAssetCode = generateAssetCode(refs.assetCategoryInput.value);
      refs.assetCodeInput.value = state.lastAutoAssetCode;
    }
  }

  function assetEnergy(asset) {
    var quantity = Math.max(0, toNumber(asset.quantity, 1));
    var watts = Math.max(0, toNumber(asset.powerWatts, 0));
    var hours = Math.max(0, toNumber(asset.hoursPerDay, 0));
    var days = clamp(toNumber(asset.daysPerMonth, 30), 0, 31);
    var dailyKwh = watts * quantity * hours / 1000;
    return {
      loadWatts: watts * quantity,
      dailyKwh: dailyKwh,
      monthlyKwh: dailyKwh * days
    };
  }

  function buildingEnergySummary() {
    var assets = records().assets;
    var tariff = activeBuilding().energy.tariffPerKwh;
    return assets.reduce(function (summary, asset) {
      var energy = assetEnergy(asset);
      summary.loadWatts += energy.loadWatts;
      summary.dailyKwh += energy.dailyKwh;
      summary.monthlyKwh += energy.monthlyKwh;
      summary.monthlyCost += energy.monthlyKwh * tariff;
      return summary;
    }, {
      loadWatts: 0,
      dailyKwh: 0,
      monthlyKwh: 0,
      monthlyCost: 0
    });
  }

  function updateAssetEstimate() {
    if (!refs.assetEstimateText) {
      return;
    }
    var asset = {
      quantity: refs.assetQuantityInput.value,
      powerWatts: refs.assetWattsInput.value,
      hoursPerDay: refs.assetHoursInput.value,
      daysPerMonth: refs.assetDaysInput.value
    };
    var energy = assetEnergy(asset);
    var cost = energy.monthlyKwh * activeBuilding().energy.tariffPerKwh;
    refs.assetEstimateText.textContent = formatNumber(energy.monthlyKwh, 2) + " kWh/bulan - " + formatCurrency(cost);
  }

  function roomEstimateFromInputs() {
    return roomCoolingNeed({
      name: refs.roomNameInput.value,
      length: refs.roomLengthInput.value,
      width: refs.roomWidthInput.value,
      height: refs.roomHeightInput.value,
      occupancy: refs.roomOccupancyInput.value,
      sunExposure: refs.roomSunInput.value
    });
  }

  function updateRoomEstimate() {
    var hasRoomInput = [
      refs.roomNameInput.value,
      refs.roomLengthInput.value,
      refs.roomWidthInput.value,
      refs.roomHeightInput.value,
      refs.roomOccupancyInput.value,
      refs.roomSunInput.value
    ].some(function (value) {
      return String(value || "").trim() !== "";
    });
    if (!hasRoomInput) {
      refs.roomEstimateText.textContent = "Belum ada data ruangan";
      return;
    }
    var estimate = roomEstimateFromInputs();
    refs.roomEstimateText.textContent = formatNumber(estimate.requiredBtu, 0) + " BTU/h - rekomendasi " + estimate.pkLabel + (estimate.areaSource === "denah" ? " - luas dari denah" : "");
  }

  function resetAssetForm() {
    refs.assetForm.reset();
    refs.assetIdInput.value = "";
    refs.assetCategoryInput.value = "";
    refs.assetSubtypeInput.value = "";
    state.lastAutoAssetCode = "";
    state.lastAutoAssetCapacity = "";
    clearBrandLookup();
    refs.assetCapacityInput.value = "";
    resetVehicleFields();
    refs.assetPlanXInput.value = "";
    refs.assetPlanYInput.value = "";
    refs.assetMountHeightInput.value = "";
    refs.assetDirectionInput.value = "";
    refs.assetQuantityInput.value = "1";
    refs.assetWattsInput.value = "0";
    refs.assetHoursInput.value = "0";
    refs.assetDaysInput.value = "30";
    populateSubtypeOptions();
    setVehicleFieldsVisibility();
    updateAssetCodePreview();
    updateAssetEstimate();
  }

  function resetMeterLogForm() {
    refs.meterLogForm.reset();
    refs.meterLogIdInput.value = "";
    refs.meterDateInput.value = datetimeLocalValue();
    refs.meterKwhInput.value = "0";
    refs.meterCostInput.value = "0";
  }

  function resetServiceForm() {
    refs.serviceForm.reset();
    refs.serviceIdInput.value = "";
    populateServiceTargets();
    refs.serviceDateInput.value = "";
    refs.serviceTargetInput.value = "";
    refs.serviceTypeInput.value = "";
  }

  function resetExpenseForm() {
    refs.expenseForm.reset();
    refs.expenseIdInput.value = "";
    refs.expenseDateInput.value = todayValue();
    refs.expenseAmountInput.value = "0";
    populateExpenseAssets();
  }

  function resetInfaqForm() {
    refs.infaqForm.reset();
    refs.infaqIdInput.value = "";
    refs.infaqDateInput.value = todayValue();
    refs.infaqAmountInput.value = "0";
  }

  function resetRoomForm() {
    refs.roomForm.reset();
    refs.roomIdInput.value = "";
    refs.roomHeightInput.value = "";
    refs.roomLengthInput.value = "";
    refs.roomWidthInput.value = "";
    refs.roomOccupancyInput.value = "";
    refs.roomSunInput.value = "";
    updateRoomEstimate();
  }

  function resetPlanForm() {
    var plan = planSettings();
    refs.planForm.reset();
    refs.planIdInput.value = "";
    refs.planKindInput.value = "";
    refs.planShapeInput.value = "rect";
    refs.planPointsInput.value = "";
    refs.planXInput.value = "0";
    refs.planYInput.value = "0";
    refs.planWInput.value = String(Math.min(8, plan.length));
    refs.planHInput.value = String(Math.min(6, plan.width));
  }

  function updatePlanShapeInput() {
    if (refs.planShapeInput.value !== "polygon") {
      return;
    }
    if (refs.planPointsInput.value.trim()) {
      return;
    }
    var rect = {
      x: round(clamp(toNumber(refs.planXInput.value, 0), 0, planSettings().length), 1),
      y: round(clamp(toNumber(refs.planYInput.value, 0), 0, planSettings().width), 1),
      w: Math.max(0.5, toNumber(refs.planWInput.value, 8)),
      h: Math.max(0.5, toNumber(refs.planHInput.value, 6))
    };
    refs.planPointsInput.value = formatPlanPoints(rectanglePoints(rect));
  }

  function setMeterSettingsForm() {
    var energy = activeBuilding().energy;
    refs.meterKindInput.value = energy.meterKind || "prepaid";
    refs.meterCustomerInput.value = energy.meterCustomerNumber || "";
    refs.meterPhaseInput.value = energy.meterPhase || "1-phase";
    refs.installedPowerClassInput.value = energy.installedPowerClass || powerCapacityClass(energy.installedPowerVa);
    refs.installedPowerInput.value = String(energy.installedPowerVa || 0);
    if (refs.installedPowerClassInput.value === "custom") {
      refs.installedPowerInput.removeAttribute("readonly");
    } else {
      refs.installedPowerInput.setAttribute("readonly", "readonly");
    }
    refs.tariffInput.value = String(energy.tariffPerKwh);
    refs.electricBudgetInput.value = String(energy.monthlyBudget);
    refs.currentKwhInput.value = String(energy.currentBalanceKwh);
    refs.minimumKwhInput.value = String(energy.minimumKwh);
  }

  function selectOptionExists(options, value) {
    return options.some(function (option) {
      return presetValueMatches(option.value, value) || boundaryOptionMatchKey(option.value) === boundaryOptionMatchKey(value);
    });
  }

  function boundaryOptionMatchKey(value) {
    var normalized = textValue(value).toLowerCase();
    if (typeof normalized.normalize === "function") {
      normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    normalized = normalized
      .replace(/&/g, " and ")
      .replace(/\bnothern\b/g, "northern")
      .replace(/\bghanzi\b/g, "ghazni");
    if (normalized.trim() === "wardak") {
      normalized = "maidan wardak";
    }
    normalized = normalized
      .replace(/\brep\b/g, "republic")
      .replace(/\bdem\b/g, "democratic")
      .replace(/\b(special|region|province|state|district|regency|city|municipality|daerah|istimewa|provinsi|kabupaten|kota|wilayah|administrative|governorate|of|the|and)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (!normalized) {
      return "";
    }
    return normalized.split(/\s+/).filter(function (token, index, tokens) {
      return token && tokens.indexOf(token) === index;
    }).sort().join("|");
  }

  function resolveSelectOptionValue(options, value) {
    var selectedValue = textValue(value);
    if (!selectedValue) {
      return "";
    }
    var selectedKey = boundaryOptionMatchKey(selectedValue);
    var exact = options.find(function (option) {
      return presetValueMatches(option.value, selectedValue) ||
        presetValueMatches(option.label, selectedValue) ||
        (selectedKey && boundaryOptionMatchKey(option.value) === selectedKey);
    });
    return exact ? exact.value : selectedValue;
  }

  function withStoredSelectOption(options, value) {
    var selectedValue = textValue(value);
    if (!selectedValue || selectOptionExists(options, selectedValue)) {
      return options;
    }
    return options.concat([{ value: selectedValue, label: selectedValue + " (tersimpan)" }]);
  }

  function setSelectOptions(select, placeholder, options, selectedValue, disabled) {
    var selected = textValue(selectedValue);
    select.innerHTML = "<option value=\"\">" + escapeHtml(placeholder) + "</option>" + options.map(function (option) {
      var attributes = [
        "value=\"" + escapeHtml(option.value) + "\""
      ];
      if (option.admId) {
        attributes.push("data-adm-id=\"" + escapeHtml(option.admId) + "\"");
      }
      if (option.adm0Id) {
        attributes.push("data-adm0-id=\"" + escapeHtml(option.adm0Id) + "\"");
      }
      return "<option " + attributes.join(" ") + ">" + escapeHtml(option.label || option.value) + "</option>";
    }).join("");
    select.disabled = Boolean(disabled);
    select.value = selected;
    if (select.value !== selected) {
      select.value = "";
    }
  }

  function selectedOptionMeta(select) {
    if (!select || select.selectedIndex < 0) {
      return {};
    }
    var option = select.options[select.selectedIndex];
    return option && option.dataset ? {
      admId: textValue(option.dataset.admId),
      adm0Id: textValue(option.dataset.adm0Id)
    } : {};
  }

  function admBoundaryCountryParam(countryCode) {
    var code = String(countryCode || "").trim().toUpperCase();
    return countryEnglishNameForCode(code) || countryNameForCode(code) || code;
  }

  function boundaryOptionFromItem(item, level) {
    var source = item && typeof item === "object" ? item : {};
    var name = textValue(source.name || source.value || admIdentityName(source, level));
    var id = textValue(source.id || source.admId || admIdentityId(source, level));
    var adm0Id = textValue(source.adm0Id || source.adm0_id || admIdentityId(source, "adm0"));
    if (!name) {
      return null;
    }
    return {
      value: name,
      label: id ? name + " (" + id + ")" : name,
      admId: id,
      adm0Id: adm0Id
    };
  }

  function normalizeBoundaryOptions(items, level) {
    var seen = {};
    return items.map(function (item) {
      return boundaryOptionFromItem(item, level);
    }).filter(function (option) {
      if (!option) {
        return false;
      }
      var key = slugify(option.value) + "|" + textValue(option.admId);
      if (seen[key]) {
        return false;
      }
      seen[key] = true;
      return true;
    }).sort(function (left, right) {
      return left.value.localeCompare(right.value, "id-ID");
    });
  }

  function fetchAdmBoundaryOptions(level, countryCode, adm1Name, adm1Id) {
    if (!window.fetch) {
      return Promise.resolve([]);
    }
    var normalizedLevel = String(level || "").trim().toLowerCase();
    var code = String(countryCode || "").trim().toUpperCase();
    if (!normalizedLevel || !code) {
      return Promise.resolve([]);
    }
    var parentId = textValue(adm1Id);
    var sourceMode = window.navigator && window.navigator.onLine === false ? "local" : "auto";
    var cacheKey = "strict-v5|" + sourceMode + "|" + normalizedLevel + "|" + code + "|" + textValue(adm1Name) + "|" + parentId;
    if (admBoundaryOptionCache[cacheKey]) {
      return admBoundaryOptionCache[cacheKey];
    }
    var params = new URLSearchParams();
    params.set("level", normalizedLevel);
    params.set("country", admBoundaryCountryParam(code));
    params.set("country_iso2", code);
    params.set("hierarchy", "strict-v5");
    params.set("source", sourceMode);
    params.set("offline", sourceMode === "local" ? "1" : "0");
    if (normalizedLevel === "adm2") {
      if (!textValue(adm1Name)) {
        return Promise.resolve([]);
      }
      params.set("adm1", adm1Name);
      if (parentId) {
        params.set("adm1_id", parentId);
      }
    }
    admBoundaryOptionCache[cacheKey] = window.fetch(ADM_BOUNDARY_OPTIONS_ENDPOINT + "?" + params.toString(), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("ADM boundary request failed: " + response.status);
      }
      return response.json();
    }).then(function (payload) {
      return normalizeBoundaryOptions(payload && Array.isArray(payload.items) ? payload.items : [], normalizedLevel);
    }).catch(function (error) {
      delete admBoundaryOptionCache[cacheKey];
      console.warn("ADM boundary options unavailable", normalizedLevel, code, error);
      return [];
    });
    return admBoundaryOptionCache[cacheKey];
  }

  function loadAdmProvinceOptions(countryCode, selectedProvince) {
    var code = String(countryCode || "").trim().toUpperCase();
    var generation = ++admProvinceLoadGeneration;
    if (!code) {
      return;
    }
    fetchAdmBoundaryOptions("adm1", code).then(function (options) {
      if (generation !== admProvinceLoadGeneration || !options.length || refs.priceCountryInput.value !== code) {
        return;
      }
      var selected = resolveSelectOptionValue(options, refs.priceProvinceInput.value || selectedProvince);
      if (!selectOptionExists(options, selected)) {
        selected = "";
      }
      setSelectOptions(refs.priceProvinceInput, "Pilih wilayah", options, selected, false);
      if (selected) {
        loadAdmCityOptions(code, selected, refs.priceCityInput.value);
        syncPriceRegionDerivedFields();
      } else {
        admCityLoadGeneration += 1;
        setSelectOptions(refs.priceCityInput, "Pilih wilayah dulu", [], "", true);
      }
    });
  }

  function loadAdmCityOptions(countryCode, selectedProvince, selectedCity) {
    var code = String(countryCode || "").trim().toUpperCase();
    var province = textValue(selectedProvince);
    var generation = ++admCityLoadGeneration;
    if (!code || !province) {
      return;
    }
    var provinceMeta = selectedOptionMeta(refs.priceProvinceInput);
    var provinceId = textValue(provinceMeta.admId);
    fetchAdmBoundaryOptions("adm2", code, province, provinceId).then(function (options) {
      var currentProvinceMeta = selectedOptionMeta(refs.priceProvinceInput);
      var currentProvinceId = textValue(currentProvinceMeta.admId);
      if (generation !== admCityLoadGeneration || !options.length || refs.priceCountryInput.value !== code || refs.priceProvinceInput.value !== province ||
          (provinceId ? currentProvinceId !== provinceId : currentProvinceId !== "")) {
        return;
      }
      var selected = resolveSelectOptionValue(options, refs.priceCityInput.value || selectedCity);
      if (!selectOptionExists(options, selected)) {
        selected = "";
      }
      setSelectOptions(refs.priceCityInput, "Pilih daerah", options, selected, false);
    });
  }

  function populatePriceCountrySelect(selectedCode) {
    var selected = String(selectedCode || "").trim().toUpperCase();
    setSelectOptions(refs.priceCountryInput, "Pilih negara", priceCountryOptions().map(function (item) {
      return { value: item.code, label: item.label + " (" + item.code + ")" };
    }), selected, false);
  }

  function populatePriceProvinceSelect(countryCode, selectedProvince) {
    var code = String(countryCode || "").trim().toUpperCase();
    if (!code) {
      admProvinceLoadGeneration += 1;
      setSelectOptions(refs.priceProvinceInput, "Pilih negara dulu", [], "", true);
      return;
    }
    var provinces = (priceRegionPreset(code).provinces || []).map(function (province) {
      return { value: province.value, label: province.label || province.value };
    });
    setSelectOptions(refs.priceProvinceInput, "Pilih wilayah", withStoredSelectOption(provinces, selectedProvince), selectedProvince, false);
    loadAdmProvinceOptions(code, selectedProvince);
  }

  function populatePriceCitySelect(countryCode, selectedProvince, selectedCity) {
    var code = String(countryCode || "").trim().toUpperCase();
    var province = findProvincePreset(code, selectedProvince);
    if (!code || !selectedProvince || !province) {
      if (code && selectedProvince && selectedCity) {
        setSelectOptions(refs.priceCityInput, "Pilih daerah", [{ value: selectedCity, label: selectedCity + " (tersimpan)" }], selectedCity, false);
        loadAdmCityOptions(code, selectedProvince, selectedCity);
        return;
      }
      if (code && selectedProvince) {
        setSelectOptions(refs.priceCityInput, "Memuat ADM2...", [], "", true);
        loadAdmCityOptions(code, selectedProvince, selectedCity);
        return;
      }
      admCityLoadGeneration += 1;
      setSelectOptions(refs.priceCityInput, code ? "Pilih wilayah dulu" : "Pilih negara dulu", [], "", true);
      return;
    }
    var cities = (province.cities || []).map(function (city) {
      return { value: city.value, label: city.label || city.value };
    });
    setSelectOptions(refs.priceCityInput, "Pilih daerah", withStoredSelectOption(cities, selectedCity), selectedCity, false);
    loadAdmCityOptions(code, selectedProvince, selectedCity);
  }

  function selectedPriceRegionParts(savedArea) {
    var saved = savedArea || {};
    var code = refs.priceCountryInput.value;
    var country = code ? countryNameForCode(code) : "";
    var province = refs.priceProvinceInput.value;
    var city = refs.priceCityInput.value;
    var provincePreset = findProvincePreset(code, province);
    var cityPreset = findCityPreset(provincePreset, city);
    return {
      code: code,
      country: country,
      province: province,
      city: city,
      fuelRegion: textValue(saved.fuelRegion) || (cityPreset && cityPreset.fuelRegion) || (provincePreset && provincePreset.fuelRegion) || city || province || country,
      electricityRegion: textValue(saved.electricityRegion) || (cityPreset && cityPreset.electricityRegion) || (provincePreset && provincePreset.electricityRegion) || (code === "ID" ? "Nasional PLN" : country),
      telecomRegion: textValue(saved.telecomRegion) || (cityPreset && cityPreset.telecomRegion) || (provincePreset && provincePreset.telecomRegion) || city || province || country,
      waterRegion: textValue(saved.waterRegion) || (cityPreset && cityPreset.waterRegion) || (provincePreset && provincePreset.waterRegion) || city || province || country
    };
  }

  function priceAreaFromWebgis() {
    var building = activeBuilding();
    var webgis = building && building.webgis ? building.webgis : {};
    var location = state.context && state.context.location ? state.context.location : {};
    var adm0 = textValue(admIdentityName(webgis, "adm0") || admIdentityName(location, "adm0"));
    var adm1 = textValue(admIdentityName(webgis, "adm1") || admIdentityName(location, "adm1"));
    var adm2 = textValue(admIdentityName(webgis, "adm2") || admIdentityName(location, "adm2"));
    var adm0Id = admIdentityId(webgis, "adm0") || admIdentityId(location, "adm0");
    var adm1Id = admIdentityId(webgis, "adm1") || admIdentityId(location, "adm1");
    var adm2Id = admIdentityId(webgis, "adm2") || admIdentityId(location, "adm2");
    var code = normalizePriceCountryCode(adm0 || webgis.country || location.country, webgis.countryCode || location.countryCode || location.iso2 || "");
    if (!adm0 || !code) {
      return null;
    }
    var scope = [adm2, adm1, adm0].filter(Boolean).join(" - ");
    return normalizePriceAreaCountry({
      country: countryNameForCode(code),
      countryCode: code,
      adm0: adm0,
      adm1: adm1,
      adm2: adm2,
      adm0Id: adm0Id,
      adm1Id: adm1Id,
      adm2Id: adm2Id,
      province: adm1,
      city: adm2,
      languages: normalizeLanguageTags((building.priceArea || {}).languages || ""),
      fuelRegion: scope || adm0,
      electricityRegion: [adm1, adm0].filter(Boolean).join(" - ") || adm0,
      telecomRegion: scope || adm0,
      waterRegion: scope || adm0,
      notes: "Wilayah harga diambil dari ADM0/ADM1/ADM2 WebGIS."
    });
  }

  function applyWebgisPriceArea() {
    var area = priceAreaFromWebgis();
    if (!area) {
      window.alert("Data ADM0/ADM1/ADM2 WebGIS belum tersedia untuk building aktif. Pilih building dari database WebGIS dahulu.");
      return;
    }
    activeBuilding().priceArea = Object.assign({}, area, {
      updatedAt: new Date().toISOString()
    });
    invalidateEnergyPriceRequests();
    state.energyPricesLoaded = false;
    state.energyPrices = null;
    state.energyPricesError = "";
    resetGlobalUtilityCategoryDatabases();
    resetGlobalDiscoveryState();
    saveData();
    setPriceRegionForm();
    renderEnergyPrices();
    loadEnergyPrices(true);
  }

  function syncPriceRegionDerivedFields(savedArea) {
    var parts = selectedPriceRegionParts(savedArea);
    refs.priceCountryCodeInput.value = parts.code || "";
    if (!parts.code) {
      refs.fuelPriceRegionInput.value = "";
      refs.electricityPriceRegionInput.value = "";
      refs.telecomPriceRegionInput.value = "";
      refs.waterPriceRegionInput.value = "";
      return;
    }
    refs.fuelPriceRegionInput.value = parts.fuelRegion || "";
    refs.electricityPriceRegionInput.value = parts.electricityRegion || "";
    refs.telecomPriceRegionInput.value = parts.telecomRegion || "";
    refs.waterPriceRegionInput.value = parts.waterRegion || "";
  }

  function setPriceRegionForm() {
    if (!refs.priceRegionForm) {
      return;
    }
    var area = normalizePriceAreaCountry(priceArea());
    var code = normalizePriceCountryCode(area.country, area.countryCode);
    populatePriceCountrySelect(code);
    populatePriceProvinceSelect(code, area.province || "");
    populatePriceCitySelect(code, area.province || "", area.city || "");
    syncPriceRegionDerivedFields(area);
    if (refs.priceRegionLanguagesInput) {
      var storedLanguages = normalizeLanguageTags(area.languages || "");
      refs.priceRegionLanguagesInput.value = languageTagsText(storedLanguages.length ? storedLanguages : priceCountryDefaultLanguages(code));
    }
    refs.priceRegionNotesInput.value = area.notes || "";
    renderPriceRegionSummary();
  }

  function handlePriceCountryChange() {
    var code = refs.priceCountryInput.value;
    refs.priceCountryCodeInput.value = code || "";
    if (refs.priceRegionLanguagesInput) {
      refs.priceRegionLanguagesInput.value = languageTagsText(priceCountryDefaultLanguages(code));
    }
    populatePriceProvinceSelect(code, "");
    populatePriceCitySelect(code, "", "");
    syncPriceRegionDerivedFields();
    invalidateEnergyPriceRequests();
    state.energyPricesLoaded = false;
    state.energyPrices = null;
    state.energyPricesError = "";
    resetGlobalUtilityCategoryDatabases();
    resetGlobalDiscoveryState();
    renderEnergyPrices();
    scheduleEnergyPricesLoad(false);
  }

  function handlePriceProvinceChange() {
    var code = refs.priceCountryInput.value;
    populatePriceCitySelect(code, refs.priceProvinceInput.value, "");
    syncPriceRegionDerivedFields();
    invalidateEnergyPriceRequests();
    state.energyPricesLoaded = false;
    state.energyPrices = null;
    state.energyPricesError = "";
    resetGlobalUtilityCategoryDatabases();
    if (globalDiscoveryUsesAdmOverride()) {
      resetGlobalDiscoveryState();
    }
    renderEnergyPrices();
    scheduleEnergyPricesLoad(false);
    if (globalDiscoveryUsesAdmOverride()) {
      loadGlobalDiscoveryInspector(false);
    }
  }

  function handlePriceCityChange() {
    syncPriceRegionDerivedFields();
    invalidateEnergyPriceRequests();
    state.energyPricesLoaded = false;
    state.energyPrices = null;
    state.energyPricesError = "";
    resetGlobalUtilityCategoryDatabases();
    if (globalDiscoveryUsesAdmOverride()) {
      resetGlobalDiscoveryState();
    }
    renderEnergyPrices();
    scheduleEnergyPricesLoad(false);
    if (globalDiscoveryUsesAdmOverride()) {
      loadGlobalDiscoveryInspector(false);
    }
  }

  function renderPriceRegionSummary() {
    if (!refs.priceRegionSummaryText) {
      return;
    }
    var area = priceArea();
    refs.priceRegionSummaryText.textContent = priceAreaSummary(area) || "Wilayah harga belum disimpan";
  }

  function waterSourceLabel(value) {
    var labels = {
      groundwater: "Sumur / air tanah",
      pdam: "PDAM / air perpipaan",
      "water-truck": "Tangki / vendor air",
      rainwater: "Tampungan air hujan",
      depot: "Galon / depot air"
    };
    return labels[value] || value || "Sumber air";
  }

  function waterSourceCheckboxes() {
    return Array.prototype.slice.call(document.querySelectorAll("input[name=\"waterSourceInput\"]"));
  }

  function setWaterSettingsForm() {
    if (!refs.waterSourceForm) {
      return;
    }
    var water = activeBuilding().water || {};
    var sources = Array.isArray(water.sources) && water.sources.length ? water.sources : ["groundwater"];
    waterSourceCheckboxes().forEach(function (input) {
      input.checked = sources.indexOf(input.value) !== -1;
    });
    refs.waterPrimarySourceInput.value = water.primarySource || sources[0] || "groundwater";
    refs.waterProviderInput.value = water.provider || "";
    refs.waterCustomerInput.value = water.customerNumber || "";
    refs.waterCustomerGroupInput.value = water.customerGroup || "social-worship";
    refs.waterManualRateInput.value = String(water.manualRatePerM3 || 0);
    refs.waterNotesInput.value = water.notes || "";
    renderWaterSourceSummary();
  }

  function renderWaterSourceSummary() {
    if (!refs.waterSourceSummaryText) {
      return;
    }
    var water = activeBuilding().water || {};
    var sources = Array.isArray(water.sources) && water.sources.length ? water.sources : ["groundwater"];
    var paidSources = sources.filter(function (source) {
      return source !== "groundwater" && source !== "rainwater";
    });
    var summary = sources.map(waterSourceLabel).join(", ");
    refs.waterSourceSummaryText.textContent = summary + (paidSources.length ? " - gunakan tarif air/PDAM" : " - biaya air langsung 0, cek listrik pompa");
  }

  function applyInstalledPowerClass() {
    if (refs.installedPowerClassInput.value === "custom") {
      refs.installedPowerInput.removeAttribute("readonly");
      refs.installedPowerInput.focus();
      return;
    }
    refs.installedPowerInput.value = refs.installedPowerClassInput.value;
    refs.installedPowerInput.setAttribute("readonly", "readonly");
  }

  function syncInstalledPowerClass() {
    refs.installedPowerClassInput.value = powerCapacityClass(refs.installedPowerInput.value);
    if (refs.installedPowerClassInput.value === "custom") {
      refs.installedPowerInput.removeAttribute("readonly");
    }
  }

  function catalogAutoUpdateEnabled() {
    return Boolean(refs.catalogAutoUpdateInput && refs.catalogAutoUpdateInput.checked);
  }

  function shouldSmartUpdateCatalog(record) {
    if (!catalogAutoUpdateEnabled()) {
      return false;
    }
    if (!record.category || !record.subtype || !record.brand) {
      return false;
    }
    var subtypeKnown = (getCatalog(record.category).subtypes || []).some(function (item) {
      return item.name === record.subtype;
    });
    var modelExists = Boolean(findCurrentModelSuggestion());
    return !subtypeKnown || !brandExistsForCurrentType(record.brand) || (record.model && !modelExists);
  }

  function refreshAssetRecordFromForm(record) {
    record.category = refs.assetCategoryInput.value;
    record.subtype = refs.assetSubtypeInput.value;
    record.brand = refs.assetBrandInput.value.trim();
    record.model = refs.assetModelInput.value.trim();
    record.capacity = refs.assetCapacityInput.value.trim();
    record.powerWatts = Math.max(0, toNumber(refs.assetWattsInput.value, 0));
    record.vehicle = isVehicleCategory(refs.assetCategoryInput.value) ? vehicleDetailsFromForm() : null;
    record.fuel = isFuelAssetCategory(refs.assetCategoryInput.value) ? fuelDetailsFromForm() : null;
  }

  function smartUpdateCatalogBeforeAssetSave(record) {
    if (!shouldSmartUpdateCatalog(record)) {
      return Promise.resolve(true);
    }
    return upsertLookupBrand(null, false, {
      autoMode: true,
      rethrow: true
    }).then(function () {
      refreshAssetRecordFromForm(record);
      return true;
    }).catch(function (error) {
      if (error && error.status === 409) {
        setBrandLookupStatus("Simpan aset dihentikan. Input merk terindikasi typo; pilih merk yang benar dari saran terlebih dahulu.");
        refs.assetBrandInput.focus();
        return false;
      }
      setBrandLookupStatus((error && error.message ? error.message : "Smart update katalog gagal.") + " Aset tetap bisa disimpan, tetapi katalog SQL tidak diubah otomatis.");
      return true;
    });
  }

  function persistAssetRecord(list, existing, record) {
    if (existing) {
      Object.assign(existing, record);
    } else {
      list.unshift(record);
    }
    saveData();
    resetAssetForm();
    renderAll();
  }

  function saveAsset(event) {
    event.preventDefault();
    if (state.assetSaveBusy) {
      return;
    }
    var list = records().assets;
    var id = refs.assetIdInput.value || uid("asset");
    var existing = list.find(function (item) {
      return item.id === id;
    });
    var plan = planSettings();
    var planX = optionalNumber(refs.assetPlanXInput.value);
    var planY = optionalNumber(refs.assetPlanYInput.value);
    if (planX !== null) {
      planX = round(clamp(planX, 0, plan.length), 1);
    }
    if (planY !== null) {
      planY = round(clamp(planY, 0, plan.width), 1);
    }
    var record = {
      id: id,
      code: refs.assetCodeInput.value || generateAssetCode(refs.assetCategoryInput.value),
      category: refs.assetCategoryInput.value,
      subtype: refs.assetSubtypeInput.value,
      name: refs.assetNameInput.value.trim(),
      brand: refs.assetBrandInput.value.trim(),
      model: refs.assetModelInput.value.trim(),
      capacity: refs.assetCapacityInput.value.trim(),
      room: refs.assetRoomInput.value.trim(),
      planX: planX,
      planY: planY,
      mountHeight: optionalNumber(refs.assetMountHeightInput.value),
      direction: refs.assetDirectionInput.value.trim(),
      quantity: Math.max(1, Math.round(toNumber(refs.assetQuantityInput.value, 1))),
      powerWatts: Math.max(0, toNumber(refs.assetWattsInput.value, 0)),
      hoursPerDay: Math.max(0, toNumber(refs.assetHoursInput.value, 0)),
      daysPerMonth: clamp(toNumber(refs.assetDaysInput.value, 30), 0, 31),
      monitoringMode: refs.assetMonitoringInput.value,
      sensorId: refs.assetSensorInput.value.trim(),
      acquiredAt: refs.assetAcquiredInput.value,
      acquisitionCost: Math.max(0, toNumber(refs.assetValueInput.value, 0)),
      notes: refs.assetNotesInput.value.trim(),
      vehicle: isVehicleCategory(refs.assetCategoryInput.value) ? vehicleDetailsFromForm() : null,
      fuel: isFuelAssetCategory(refs.assetCategoryInput.value) ? fuelDetailsFromForm() : null,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!record.category) {
      refs.assetCategoryInput.focus();
      return;
    }

    if (!record.name) {
      refs.assetNameInput.focus();
      return;
    }

    state.assetSaveBusy = true;
    smartUpdateCatalogBeforeAssetSave(record).then(function (shouldSave) {
      if (shouldSave) {
        persistAssetRecord(list, existing, record);
      }
    }).then(function () {
      state.assetSaveBusy = false;
    }, function (error) {
      state.assetSaveBusy = false;
      setBrandLookupStatus(error && error.message ? error.message : "Simpan aset gagal.");
    });
  }

  function saveMeterSettings(event) {
    event.preventDefault();
    var energy = activeBuilding().energy;
    energy.meterKind = refs.meterKindInput.value;
    energy.meterCustomerNumber = refs.meterCustomerInput.value.trim();
    energy.meterPhase = refs.meterPhaseInput.value;
    energy.installedPowerClass = refs.installedPowerClassInput.value;
    energy.installedPowerVa = Math.max(0, toNumber(refs.installedPowerInput.value, 0));
    if (energy.installedPowerClass !== "custom") {
      energy.installedPowerVa = Math.max(0, toNumber(energy.installedPowerClass, energy.installedPowerVa));
    }
    energy.tariffPerKwh = Math.max(0, toNumber(refs.tariffInput.value, DEFAULT_TARIFF));
    energy.monthlyBudget = Math.max(0, toNumber(refs.electricBudgetInput.value, 0));
    energy.currentBalanceKwh = Math.max(0, toNumber(refs.currentKwhInput.value, 0));
    energy.minimumKwh = Math.max(0, toNumber(refs.minimumKwhInput.value, DEFAULT_MINIMUM_KWH));
    saveData();
    renderAll();
  }

  function savePriceRegion(event) {
    event.preventDefault();
    var building = activeBuilding();
    var area = priceAreaForRequest();
    var validationMessage = priceAreaValidationMessage(area);
    if (validationMessage) {
      window.alert(validationMessage);
      renderEnergyPrices();
      return;
    }
    building.priceArea = normalizePriceAreaCountry({
      country: area.country,
      countryCode: area.countryCode,
      adm0: area.adm0 || area.country,
      adm1: area.adm1 || area.province,
      adm2: area.adm2 || area.city,
      adm0Id: area.adm0Id || "",
      adm1Id: area.adm1Id || "",
      adm2Id: area.adm2Id || "",
      province: area.province,
      city: area.city,
      languages: area.languages,
      fuelRegion: area.fuelRegion,
      electricityRegion: area.electricityRegion,
      telecomRegion: area.telecomRegion,
      waterRegion: area.waterRegion,
      notes: area.notes,
      updatedAt: new Date().toISOString()
    });
    invalidateEnergyPriceRequests();
    state.energyPricesLoaded = false;
    state.energyPrices = null;
    resetGlobalUtilityCategoryDatabases();
    resetGlobalDiscoveryState();
    saveData();
    renderAll();
    loadEnergyPrices(true);
  }

  function saveWaterSettings(event) {
    event.preventDefault();
    var checked = waterSourceCheckboxes().filter(function (input) {
      return input.checked;
    }).map(function (input) {
      return input.value;
    });
    if (!checked.length) {
      checked = ["groundwater"];
    }
    var water = activeBuilding().water || {};
    water.sources = checked;
    water.primarySource = checked.indexOf(refs.waterPrimarySourceInput.value) !== -1
      ? refs.waterPrimarySourceInput.value
      : checked[0];
    water.provider = refs.waterProviderInput.value.trim();
    water.customerNumber = refs.waterCustomerInput.value.trim();
    water.customerGroup = refs.waterCustomerGroupInput.value;
    water.manualRatePerM3 = Math.max(0, toNumber(refs.waterManualRateInput.value, 0));
    water.notes = refs.waterNotesInput.value.trim();
    activeBuilding().water = water;
    saveData();
    renderAll();
  }

  function applyMeterEffect(record, previous) {
    var energy = activeBuilding().energy;
    if (previous && previous.type === "topup") {
      energy.currentBalanceKwh = Math.max(0, energy.currentBalanceKwh - toNumber(previous.kwh, 0));
    }
    if (previous && previous.type === "usage") {
      energy.currentBalanceKwh += toNumber(previous.kwh, 0);
    }

    if (record.type === "topup") {
      energy.currentBalanceKwh += toNumber(record.kwh, 0);
    } else if (record.type === "usage") {
      energy.currentBalanceKwh = Math.max(0, energy.currentBalanceKwh - toNumber(record.kwh, 0));
    } else if (record.type === "reading" || record.type === "adjustment") {
      energy.currentBalanceKwh = Math.max(0, toNumber(record.kwh, 0));
    }
    energy.currentBalanceKwh = round(energy.currentBalanceKwh, 2);
    record.balanceAfter = energy.currentBalanceKwh;
  }

  function saveMeterLog(event) {
    event.preventDefault();
    var list = records().meterLogs;
    var id = refs.meterLogIdInput.value || uid("meter");
    var existing = list.find(function (item) {
      return item.id === id;
    });
    var record = {
      id: id,
      date: isoFromLocal(refs.meterDateInput.value) || new Date().toISOString(),
      type: refs.meterTypeInput.value,
      kwh: Math.max(0, toNumber(refs.meterKwhInput.value, 0)),
      cost: Math.max(0, toNumber(refs.meterCostInput.value, 0)),
      note: refs.meterNoteInput.value.trim(),
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    applyMeterEffect(record, existing || null);
    if (existing) {
      Object.assign(existing, record);
    } else {
      list.unshift(record);
    }
    saveData();
    resetMeterLogForm();
    setMeterSettingsForm();
    renderAll();
  }

  function parseTarget(value) {
    var parts = String(value || "").split(":");
    return {
      type: parts[0] || "",
      id: parts.slice(1).join(":")
    };
  }

  function targetLabel(type, id) {
    if (!type || !id) {
      return "Target belum dipilih";
    }
    if (type === "asset") {
      var asset = records().assets.find(function (item) {
        return item.id === id;
      });
      return asset ? asset.code + " - " + asset.name : "Aset";
    }
    if (type === "room") {
      var room = records().rooms.find(function (item) {
        return item.id === id;
      });
      return room ? room.name : "Ruangan";
    }
    return displayBuildingName(activeBuilding(), "Building");
  }

  function saveService(event) {
    event.preventDefault();
    var list = records().services;
    var id = refs.serviceIdInput.value || uid("service");
    var existing = list.find(function (item) {
      return item.id === id;
    });
    var target = parseTarget(refs.serviceTargetInput.value);
    var date = isoFromLocal(refs.serviceDateInput.value);
    if (!date) {
      refs.serviceDateInput.focus();
      return;
    }
    if (!target.type || !target.id) {
      refs.serviceTargetInput.focus();
      return;
    }
    if (!refs.serviceTypeInput.value) {
      refs.serviceTypeInput.focus();
      return;
    }
    var record = {
      id: id,
      date: date,
      targetType: target.type,
      targetId: target.id,
      targetLabel: targetLabel(target.type, target.id),
      type: refs.serviceTypeInput.value,
      title: refs.serviceTitleInput.value.trim(),
      vendor: refs.serviceVendorInput.value.trim(),
      cost: Math.max(0, toNumber(refs.serviceCostInput.value, 0)),
      nextServiceDate: refs.serviceNextInput.value,
      detail: refs.serviceDetailInput.value.trim(),
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!record.title) {
      refs.serviceTitleInput.focus();
      return;
    }
    if (existing) {
      Object.assign(existing, record);
    } else {
      list.unshift(record);
    }
    saveData();
    resetServiceForm();
    renderAll();
  }

  function saveInfaq(event) {
    event.preventDefault();
    var list = records().infaq;
    var id = refs.infaqIdInput.value || uid("infaq");
    var existing = list.find(function (item) {
      return item.id === id;
    });
    var record = {
      id: id,
      date: refs.infaqDateInput.value || todayValue(),
      category: refs.infaqCategoryInput.value,
      source: refs.infaqSourceInput.value.trim(),
      amount: Math.max(0, toNumber(refs.infaqAmountInput.value, 0)),
      method: refs.infaqMethodInput.value,
      allocation: refs.infaqAllocationInput.value,
      notes: refs.infaqNotesInput.value.trim(),
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (record.amount <= 0) {
      refs.infaqAmountInput.focus();
      return;
    }
    if (existing) {
      Object.assign(existing, record);
    } else {
      list.unshift(record);
    }
    saveData();
    resetInfaqForm();
    renderAll();
  }

  function saveExpense(event) {
    event.preventDefault();
    var list = records().expenses;
    var id = refs.expenseIdInput.value || uid("expense");
    var existing = list.find(function (item) {
      return item.id === id;
    });
    var assetId = refs.expenseAssetInput.value;
    var record = {
      id: id,
      date: refs.expenseDateInput.value || todayValue(),
      category: refs.expenseCategoryInput.value,
      description: refs.expenseDescriptionInput.value.trim(),
      amount: Math.max(0, toNumber(refs.expenseAmountInput.value, 0)),
      source: refs.expenseSourceInput.value.trim(),
      assetId: assetId,
      assetLabel: assetId ? targetLabel("asset", assetId) : "",
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!record.description) {
      refs.expenseDescriptionInput.focus();
      return;
    }
    if (existing) {
      Object.assign(existing, record);
    } else {
      list.unshift(record);
    }
    saveData();
    resetExpenseForm();
    renderAll();
  }

  function roomCoolingNeed(room) {
    var length = Math.max(0, toNumber(room.length, 0));
    var width = Math.max(0, toNumber(room.width, 0));
    var roomHeight = optionalNumber(room.height);
    var height = roomHeight !== null && roomHeight > 0 ? roomHeight : 3;
    var occupancy = Math.max(0, toNumber(room.occupancy, 0));
    var rectangularArea = length * width;
    var planInfo = roomPlanInfo(room.name);
    var area = planInfo && planInfo.area > 0 && (planInfo.shape === "polygon" || rectangularArea <= 0)
      ? planInfo.area
      : rectangularArea;
    var base = area * 550;
    var heightFactor = height > 3 ? 1 + Math.min(0.45, (height - 3) * 0.12) : 1;
    var sunFactor = room.sunExposure === "high" ? 1.2 : (room.sunExposure === "medium" ? 1.1 : 1);
    var occupantExtra = Math.max(0, occupancy - 2) * 600;
    var requiredBtu = Math.round((base + occupantExtra) * heightFactor * sunFactor);
    return {
      area: area,
      requiredBtu: requiredBtu,
      pkLabel: pkLabel(requiredBtu),
      areaSource: planInfo && planInfo.area > 0 && area === planInfo.area ? "denah" : "ukuran"
    };
  }

  function pkLabel(btu) {
    if (btu <= 0) {
      return "0 PK";
    }
    if (btu <= 5000) {
      return "0.5 PK";
    }
    if (btu <= 7000) {
      return "0.75 PK";
    }
    if (btu <= 9000) {
      return "1 PK";
    }
    if (btu <= 12000) {
      return "1.5 PK";
    }
    if (btu <= 18000) {
      return "2 PK";
    }
    if (btu <= 24000) {
      return "2.5 PK";
    }
    if (btu <= 28000) {
      return "3 PK";
    }
    return Math.ceil(btu / 9000) + " PK total";
  }

  function btuFromPkValue(pk) {
    if (pk <= 0) {
      return 0;
    }
    if (pk <= 0.5) {
      return 5000;
    }
    if (pk <= 0.75) {
      return 7000;
    }
    if (pk <= 1) {
      return 9000;
    }
    if (pk <= 1.5) {
      return 12000;
    }
    if (pk <= 2) {
      return 18000;
    }
    if (pk <= 2.5) {
      return 24000;
    }
    if (pk <= 3) {
      return 28000;
    }
    return Math.round(pk * 9000);
  }

  function acUnitBtu(asset) {
    var meta = getSubtypeMeta(asset.category, asset.subtype);
    var metaBtu = toNumber(meta.btu, 0);
    if (metaBtu > 0) {
      return metaBtu;
    }
    var text = [asset.capacity, asset.subtype, asset.model, asset.name].filter(Boolean).join(" ");
    var btuMatch = text.match(/(\d{4,5})\s*(?:btu|btuh|btu\/h)/i);
    if (btuMatch) {
      return toNumber(btuMatch[1], 0);
    }
    var pkMatch = text.match(/(\d+(?:[\.,]\d+)?)\s*pk/i);
    if (pkMatch) {
      return btuFromPkValue(toNumber(pkMatch[1].replace(",", "."), 0));
    }
    return 0;
  }

  function assetQuantity(asset) {
    return Math.max(1, Math.round(toNumber(asset.quantity, 1)));
  }

  function isCoolingAsset(asset) {
    return asset && (asset.category === "AC" || asset.category === "Pendingin ruangan");
  }

  function existingAcBtu(roomName) {
    var target = roomNameKey(roomName);
    if (!target) {
      return 0;
    }
    return records().assets.reduce(function (total, asset) {
      if (!isCoolingAsset(asset) || roomNameKey(asset.room) !== target) {
        return total;
      }
      return total + acUnitBtu(asset) * assetQuantity(asset);
    }, 0);
  }

  function acAssetsForRoom(roomName) {
    var target = roomNameKey(roomName);
    if (!target) {
      return [];
    }
    return records().assets.filter(function (asset) {
      return isCoolingAsset(asset) && roomNameKey(asset.room) === target;
    });
  }

  function isAcService(service) {
    var text = [
      service.type,
      service.title,
      service.detail,
      service.targetLabel
    ].filter(Boolean).join(" ");
    return /(?:\bac\b|air conditioner|pendingin|filter|freon|cuci evaporator|cuci ac|service ac|cooling|hvac|vrv|vrf|chiller|ahu|fcu|cooling tower)/i.test(text);
  }

  function serviceTime(service) {
    var date = new Date(service.date);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function daysSince(value) {
    var time = serviceTime({ date: value });
    if (!time) {
      return null;
    }
    return Math.max(0, Math.floor((Date.now() - time) / 86400000));
  }

  function lastAcServiceForAsset(asset, room) {
    var roomKey = roomNameKey(room && room.name);
    var roomText = roomKey ? roomKey : roomNameKey(asset.room);
    var relevant = records().services.filter(function (service) {
      if (service.targetType === "asset" && service.targetId === asset.id) {
        return true;
      }
      if (service.targetType === "room" && room && service.targetId === room.id && isAcService(service)) {
        return true;
      }
      if (service.targetType === SERVICE_TARGET_BUILDING && isAcService(service)) {
        var text = roomNameKey([service.title, service.detail, service.targetLabel].filter(Boolean).join(" "));
        return roomText && text.indexOf(roomText) !== -1;
      }
      return false;
    });
    return relevant.sort(function (a, b) {
      return serviceTime(b) - serviceTime(a);
    })[0] || null;
  }

  function roomAcAnalysis(room) {
    var need = roomCoolingNeed(room);
    var assets = acAssetsForRoom(room.name);
    var installedBtu = 0;
    var effectiveBtu = 0;
    var serviceAlerts = [];
    var positionMissing = false;

    assets.forEach(function (asset) {
      var assetBtu = acUnitBtu(asset) * assetQuantity(asset);
      installedBtu += assetBtu;
      if (asset.planX === null || asset.planX === undefined || asset.planY === null || asset.planY === undefined || !asset.direction) {
        positionMissing = true;
      }
      var lastService = lastAcServiceForAsset(asset, room);
      var serviceDays = lastService ? daysSince(lastService.date) : null;
      var factor = 1;
      if (!lastService) {
        factor = 0.9;
        serviceAlerts.push(asset.name + " belum punya log service pendingin.");
      } else if (serviceDays !== null && serviceDays > 90) {
        factor = 0.85;
        serviceAlerts.push(asset.name + " sudah " + serviceDays + " hari belum service.");
      }
      effectiveBtu += assetBtu * factor;
    });

    effectiveBtu = Math.round(effectiveBtu);
    var deficit = Math.max(0, need.requiredBtu - effectiveBtu);
    var statusKey = "ok";
    var conclusion = "Pendingin memadai";
    if (need.requiredBtu <= 0) {
      statusKey = "warn";
      conclusion = "Lengkapi ukuran ruangan";
    } else if (!assets.length) {
      statusKey = "bad";
      conclusion = "Belum ada pendingin tercatat";
    } else if (effectiveBtu < need.requiredBtu) {
      statusKey = "bad";
      conclusion = "Kurang optimal";
    } else if (effectiveBtu < need.requiredBtu * 1.1) {
      statusKey = "warn";
      conclusion = "Cukup, margin tipis";
    }

    var suggestions = [];
    if (deficit > 0) {
      suggestions.push("Tambah kapasitas sekitar " + formatNumber(deficit, 0) + " BTU/h (" + pkLabel(deficit) + ") atau ganti sebagian unit ke kapasitas lebih besar.");
    }
    if (room.sunExposure === "high") {
      suggestions.push("Paparan panas tinggi; cek tirai, kaca, atap, dan arah hembusan sebelum menambah unit.");
    }
    if (positionMissing && assets.length) {
      suggestions.push("Lengkapi posisi dan arah hembusan pendingin di denah agar evaluasi sebaran dingin lebih jelas.");
    }
    serviceAlerts.slice(0, 3).forEach(function (message) {
      suggestions.push(message);
    });
    if (!suggestions.length && assets.length) {
      suggestions.push("Pertahankan service berkala 3 bulan dan cek filter saat beban pengguna tinggi.");
    }

    return {
      room: room,
      need: need,
      assets: assets,
      installedBtu: Math.round(installedBtu),
      effectiveBtu: effectiveBtu,
      deficit: Math.round(deficit),
      statusKey: statusKey,
      conclusion: conclusion,
      suggestions: suggestions
    };
  }

  function saveRoom(event) {
    event.preventDefault();
    var list = records().rooms;
    var id = refs.roomIdInput.value || uid("room");
    var existing = list.find(function (item) {
      return item.id === id;
    });
    var length = optionalNumber(refs.roomLengthInput.value);
    var width = optionalNumber(refs.roomWidthInput.value);
    var height = optionalNumber(refs.roomHeightInput.value);
    var occupancy = optionalNumber(refs.roomOccupancyInput.value);
    var record = {
      id: id,
      name: refs.roomNameInput.value.trim(),
      length: length !== null ? Math.max(0, length) : null,
      width: width !== null ? Math.max(0, width) : null,
      height: height !== null ? Math.max(0, height) : null,
      occupancy: occupancy !== null ? Math.max(0, Math.round(occupancy)) : null,
      sunExposure: refs.roomSunInput.value,
      airflow: refs.roomAirflowInput.value.trim(),
      recommendation: refs.roomRecommendationInput.value.trim(),
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!record.name) {
      refs.roomNameInput.focus();
      return;
    }
    if (existing) {
      Object.assign(existing, record);
    } else {
      list.unshift(record);
    }
    saveData();
    resetRoomForm();
    renderAll();
  }

  function savePlanZone(event) {
    event.preventDefault();
    var list = records().planZones;
    var id = refs.planIdInput.value || uid("zone");
    var existing = list.find(function (item) {
      return item.id === id;
    });
    var name = refs.planNameInput.value.trim();
    if (!name) {
      refs.planNameInput.focus();
      return;
    }
    if (!refs.planKindInput.value) {
      refs.planKindInput.focus();
      return;
    }
    var plan = planSettings();
    var x = round(clamp(toNumber(refs.planXInput.value, 0), 0, Math.max(0, plan.length - 0.5)), 1);
    var y = round(clamp(toNumber(refs.planYInput.value, 0), 0, Math.max(0, plan.width - 0.5)), 1);
    var w = round(clamp(toNumber(refs.planWInput.value, Math.min(8, plan.length - x)), 0.5, Math.max(0.5, plan.length - x)), 1);
    var h = round(clamp(toNumber(refs.planHInput.value, Math.min(6, plan.width - y)), 0.5, Math.max(0.5, plan.width - y)), 1);
    var shape = refs.planShapeInput.value === "polygon" ? "polygon" : "rect";
    var points = [];
    if (shape === "polygon") {
      points = normalizePlanPoints(parsePlanPoints(refs.planPointsInput.value));
      if (points.length < 3) {
        window.alert("Bentuk bebas minimal membutuhkan 3 titik. Contoh: 0,0; 10,0; 10,4; 6,4; 6,8; 0,8");
        refs.planPointsInput.focus();
        return;
      }
      if (zoneArea(points) <= 0) {
        window.alert("Titik bentuk bebas belum membentuk area. Pastikan titik tidak segaris.");
        refs.planPointsInput.focus();
        return;
      }
      var bounds = boundsFromPoints(points);
      x = round(bounds.x, 1);
      y = round(bounds.y, 1);
      w = round(bounds.w, 1);
      h = round(bounds.h, 1);
    }
    var record = {
      id: id,
      name: name,
      kind: refs.planKindInput.value,
      shape: shape,
      x: x,
      y: y,
      w: w,
      h: h,
      points: points,
      unit: "meter",
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (existing) {
      Object.assign(existing, record);
    } else {
      list.unshift(record);
    }
    saveData();
    resetPlanForm();
    renderAll();
  }

  function addZonesFromRooms() {
    var zones = records().planZones;
    var plan = planSettings();
    var existingNames = zones.map(function (zone) {
      return zone.name.trim().toLowerCase();
    });
    var cursorX = 0;
    var cursorY = 0;
    var rowHeight = 0;
    records().rooms.forEach(function (room) {
      var name = String(room.name || "").trim();
      if (!name || existingNames.indexOf(name.toLowerCase()) !== -1) {
        return;
      }
      var roomLength = Math.max(1, toNumber(room.length, 6));
      var roomWidth = Math.max(1, toNumber(room.width, 4));
      if (cursorX > 0 && cursorX + roomLength > plan.length) {
        cursorX = 0;
        cursorY += rowHeight + 1;
        rowHeight = 0;
      }
      plan.length = Math.max(plan.length, cursorX + roomLength + 1);
      plan.width = Math.max(plan.width, cursorY + roomWidth + 1);
      zones.push({
        id: uid("zone"),
        name: name,
        kind: "room",
        shape: "rect",
        x: round(cursorX, 1),
        y: round(cursorY, 1),
        w: round(roomLength, 1),
        h: round(roomWidth, 1),
        points: [],
        unit: "meter",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      existingNames.push(name.toLowerCase());
      cursorX += roomLength + 1;
      rowHeight = Math.max(rowHeight, roomWidth);
    });
    saveData();
    renderAll();
    notifyFacilityReady();
  }

  function addBuilding(event) {
    event.preventDefault();
    var name = refs.buildingNameInput.value.trim();
    if (!name) {
      refs.buildingNameInput.focus();
      return;
    }
    var selectedTypeOption = refs.buildingTypeInput.options[refs.buildingTypeInput.selectedIndex];
    var building = createBuilding(uid("building"), name, refs.buildingTypeInput.value, selectedTypeOption ? selectedTypeOption.textContent : "");
    building.assetCodeFormat = refs.assetCodeFormatInput.value.trim() || activeBuilding().assetCodeFormat || DEFAULT_ASSET_CODE_FORMAT;
    state.data.buildings.push(building);
    state.data.currentBuildingId = building.id;
    replaceBuildingHash(building);
    refs.buildingNameInput.value = "";
    refs.buildingTypeInput.value = "";
    saveData();
    resetAllForms();
    renderAll();
  }

  function changeBuilding() {
    state.data.currentBuildingId = refs.buildingSelect.value;
    replaceBuildingHash(activeBuilding());
    saveData();
    resetAllForms();
    renderAll();
    notifyFacilityReady();
  }

  function resetAllForms() {
    resetAssetForm();
    resetMeterLogForm();
    resetServiceForm();
    resetInfaqForm();
    resetExpenseForm();
    resetRoomForm();
    resetPlanForm();
    setMeterSettingsForm();
    setPlanSettingsForm();
  }

  function populateServiceTargets() {
    var building = activeBuilding();
    var options = [
      "<option value=\"\">Pilih target service</option>",
      "<option value=\"building:" + escapeHtml(building.id) + "\">" + escapeHtml(displayBuildingName(building, "Building")) + "</option>"
    ];
    records().assets.forEach(function (asset) {
      options.push("<option value=\"asset:" + escapeHtml(asset.id) + "\">" + escapeHtml(asset.code + " - " + asset.name) + "</option>");
    });
    records().rooms.forEach(function (room) {
      options.push("<option value=\"room:" + escapeHtml(room.id) + "\">Ruangan - " + escapeHtml(room.name) + "</option>");
    });
    refs.serviceTargetInput.innerHTML = options.join("");
  }

  function populateExpenseAssets() {
    var options = ["<option value=\"\">Tidak terkait aset</option>"];
    records().assets.forEach(function (asset) {
      options.push("<option value=\"" + escapeHtml(asset.id) + "\">" + escapeHtml(asset.code + " - " + asset.name) + "</option>");
    });
    refs.expenseAssetInput.innerHTML = options.join("");
  }

  function populateRoomDatalist() {
    var names = {};
    records().rooms.forEach(function (room) {
      names[room.name] = true;
    });
    records().assets.forEach(function (asset) {
      if (asset.room) {
        names[asset.room] = true;
      }
    });
    refs.roomNameList.innerHTML = Object.keys(names).sort().map(function (name) {
      return "<option value=\"" + escapeHtml(name) + "\"></option>";
    }).join("");
  }

  function buildingInfoText(building) {
    var name = displayBuildingName(building, "");
    var rec = building && building.records ? building.records : {};
    var assetCount = Array.isArray(rec.assets) ? rec.assets.length : 0;
    var roomCount = Array.isArray(rec.rooms) ? rec.rooms.length : 0;
    var zoneCount = Array.isArray(rec.planZones) ? rec.planZones.length : 0;
    var typeText = building ? (building.typeLabel || buildingTypeLabel(building.type, "")) : "";
    var hasBuildingRecord = Boolean(name || typeText || String(building && building.id || "") !== "main" || assetCount || roomCount || zoneCount);

    if (!hasBuildingRecord) {
      return "Belum ada data building. Tambahkan atau pilih building terlebih dahulu.";
    }

    var parts = [];
    if (name) {
      parts.push(name);
    }
    if (typeText) {
      parts.push(typeText);
    }
    if (building && building.id && String(building.id) !== "main") {
      parts.push("ID " + building.id);
    }
    if (building && building.code && building.code !== "BLD") {
      parts.push("Kode " + building.code);
    }
    parts.push(formatNumber(assetCount, 0) + " aset");
    parts.push(formatNumber(roomCount, 0) + " ruangan");
    parts.push(formatNumber(zoneCount, 0) + " blok denah");
    return parts.join(" - ");
  }

  function webgisAddressText(record) {
    var parts = [
      record.officialAddress || record.additionalInfo || "",
      record.city || "",
      record.province || "",
      record.country || ""
    ].filter(Boolean);
    var coordinate = Number.isFinite(Number(record.latitude)) && Number.isFinite(Number(record.longitude))
      ? "Koordinat " + Number(record.latitude).toFixed(6) + ", " + Number(record.longitude).toFixed(6)
      : "";
    return parts.concat(coordinate ? [coordinate] : []).join(" - ") || "Address null";
  }

  function findLocalBuildingForWebgis(record) {
    if (!state.data || !Array.isArray(state.data.buildings)) {
      return null;
    }
    return state.data.buildings.find(function (building) {
      var webgis = building.webgis || {};
      if (record.key && webgis.key === record.key) {
        return true;
      }
      if (record.mosqueId && String(webgis.mosqueId || "") === String(record.mosqueId)) {
        return true;
      }
      return false;
    }) || null;
  }

  function facilityInputStatus(building) {
    if (!building) {
      return "Belum dipilih - aset null - KWH meter null - service null - keuangan null - denah null";
    }
    var rec = building.records || {};
    var financeCount = (Array.isArray(rec.infaq) ? rec.infaq.length : 0) + (Array.isArray(rec.expenses) ? rec.expenses.length : 0);
    return [
      "Dipilih",
      (Array.isArray(rec.assets) && rec.assets.length ? formatNumber(rec.assets.length, 0) + " aset" : "aset null"),
      (Array.isArray(rec.meterLogs) && rec.meterLogs.length ? formatNumber(rec.meterLogs.length, 0) + " log KWH" : "KWH meter null"),
      (Array.isArray(rec.services) && rec.services.length ? formatNumber(rec.services.length, 0) + " service" : "service null"),
      (financeCount ? formatNumber(financeCount, 0) + " transaksi" : "keuangan null"),
      (Array.isArray(rec.planZones) && rec.planZones.length ? formatNumber(rec.planZones.length, 0) + " blok denah" : "denah null")
    ].join(" - ");
  }

  function renderWebgisBuildings() {
    if (!refs.webgisBuildingStatus || !refs.webgisBuildingTableWrap || !refs.webgisBuildingTableBody) {
      return;
    }
    if (state.webgisBuildingsLoading) {
      refs.webgisBuildingStatus.textContent = "Membaca database WebGIS...";
      refs.webgisBuildingTableWrap.hidden = true;
      refs.webgisBuildingTableBody.innerHTML = "";
      return;
    }
    if (!state.webgisBuildingsLoaded) {
      refs.webgisBuildingStatus.textContent = "Belum dicek. Data WebGIS tidak dipilih otomatis.";
      refs.webgisBuildingTableWrap.hidden = true;
      refs.webgisBuildingTableBody.innerHTML = "";
      return;
    }

    var rows = Array.isArray(state.webgisBuildings) ? state.webgisBuildings : [];
    refs.webgisBuildingStatus.textContent = state.webgisBuildingsError
      ? state.webgisBuildingsError
      : rows.length
      ? "Ditemukan " + formatNumber(rows.length, 0) + " record WebGIS. Pilih salah satu untuk diproses di modul ini."
      : "Belum ada data building di database WebGIS.";
    refs.webgisBuildingTableWrap.hidden = false;
    refs.webgisBuildingTableBody.innerHTML = rows.map(function (record) {
      var local = findLocalBuildingForWebgis(record);
      var typeText = record.typeLabel || record.type || "Jenis building null";
      var actionText = local && state.data && state.data.currentBuildingId === local.id ? "Sedang diedit" : "Pilih/Edit";
      return "<tr>" +
        "<td><span class=\"row-title\"><strong>" + escapeHtml(record.name || "Nama database null") + "</strong><small>ID " + escapeHtml(record.mosqueId || record.locationId || record.key) + "</small></span></td>" +
        "<td>" + escapeHtml(typeText) + "</td>" +
        "<td>" + escapeHtml(webgisAddressText(record)) + "</td>" +
        "<td>" + escapeHtml(facilityInputStatus(local)) + "</td>" +
        "<td><div class=\"row-actions\"><button type=\"button\" data-webgis-action=\"select\" data-webgis-key=\"" + escapeHtml(record.key) + "\">" + escapeHtml(actionText) + "</button></div></td>" +
        "</tr>";
    }).join("") || emptyRow(5, "Belum ada data building di database WebGIS.");
  }

  function normalizeWebgisList(payload) {
    var rows = payload && Array.isArray(payload.data) ? payload.data : [];
    return rows.map(normalizeWebgisRecord).filter(function (record) {
      return record.key || record.name || record.officialAddress || record.latitude !== null;
    });
  }

  function loadWebgisBuildings() {
    if (!window.fetch) {
      state.webgisBuildings = [];
      state.webgisBuildingsLoaded = true;
      renderWebgisBuildings();
      return Promise.resolve();
    }
    state.webgisBuildingsLoading = true;
    state.webgisBuildingsLoaded = false;
    state.webgisBuildingsError = "";
    renderWebgisBuildings();
    return window.fetch(WEBGIS_BUILDINGS_ENDPOINT, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("WebGIS HTTP " + response.status);
      }
      return response.json();
    }).then(function (payload) {
      state.webgisBuildings = normalizeWebgisList(payload);
      state.webgisBuildingsLoaded = true;
    }).catch(function () {
      state.webgisBuildings = [];
      state.webgisBuildingsLoaded = true;
      state.webgisBuildingsError = "Database WebGIS belum bisa dibaca.";
    }).then(function () {
      state.webgisBuildingsLoading = false;
      renderWebgisBuildings();
    });
  }

  function selectWebgisBuilding(record) {
    if (!record) {
      return;
    }
    var local = findLocalBuildingForWebgis(record);
    if (!local) {
      var id = record.key || uid("webgis-building");
      local = createBuilding(id, record.name || "");
      local.source = "webgis-database";
      state.data.buildings.push(local);
    }
    if (!local.name && record.name) {
      local.name = record.name;
    }
    if ((!local.code || local.code === "BLD") && local.name) {
      local.code = codeFromName(local.name, "BLD");
    }
    local.type = record.type || local.type || "";
    local.typeLabel = record.typeLabel || local.typeLabel || buildingTypeLabel(local.type, "");
    local.webgis = webgisMetaFromRecord(record);
    state.data.currentBuildingId = local.id;
    replaceBuildingHash(local);
    saveData();
    resetAllForms();
    renderAll();
    notifyFacilityReady();
  }

  function handleWebgisBuildingAction(event) {
    var button = event.target.closest("[data-webgis-action]");
    if (!button) {
      return;
    }
    var key = button.getAttribute("data-webgis-key") || "";
    var record = (state.webgisBuildings || []).find(function (item) {
      return item.key === key;
    });
    if (button.getAttribute("data-webgis-action") === "select") {
      selectWebgisBuilding(record);
    }
  }

  function renderScope() {
    var building = activeBuilding();
    var buildingName = displayBuildingName(building, "");
    if (refs.buildingInfoPanel) {
      refs.buildingInfoPanel.hidden = !state.showBuildingInfo;
    }
    if (refs.toggleBuildingInfoButton) {
      refs.toggleBuildingInfoButton.textContent = state.showBuildingInfo ? "Sembunyikan data building" : "Lihat data building";
      refs.toggleBuildingInfoButton.setAttribute("aria-expanded", state.showBuildingInfo ? "true" : "false");
    }
    if (refs.scopeMosqueName) {
      refs.scopeMosqueName.textContent = state.showBuildingInfo ? buildingName : "";
      refs.scopeMosqueName.hidden = !state.showBuildingInfo || !buildingName;
    }

    refs.scopeLocation.textContent = state.showBuildingInfo ? buildingInfoText(building) : "";

    if (canUseStorage()) {
      refs.storageStatus.textContent = "Tersimpan lokal - Katalog " + catalogSourceLabel();
      refs.storageStatus.className = "status-pill is-ok";
    } else {
      refs.storageStatus.textContent = "Storage browser tidak tersedia";
      refs.storageStatus.className = "status-pill is-warn";
    }
  }

  function renderBuildingOptions() {
    refs.buildingSelect.innerHTML = state.data.buildings.map(function (building) {
      var typeText = building.typeLabel || buildingTypeLabel(building.type, "");
      var label = displayBuildingName(building, "Building belum dinamai");
      return "<option value=\"" + escapeHtml(building.id) + "\">" + escapeHtml(label + (typeText ? " - " + typeText : "")) + "</option>";
    }).join("");
    refs.buildingSelect.value = state.data.currentBuildingId;
  }

  function setAssetCodeFormatForm() {
    refs.assetCodeFormatInput.value = activeBuilding().assetCodeFormat || DEFAULT_ASSET_CODE_FORMAT;
  }

  function saveAssetCodeFormat() {
    var format = refs.assetCodeFormatInput.value.trim() || DEFAULT_ASSET_CODE_FORMAT;
    var currentCode = refs.assetCodeInput.value.trim();
    var canRefreshPreview = !refs.assetIdInput.value && (!currentCode || currentCode === state.lastAutoAssetCode);
    activeBuilding().assetCodeFormat = format;
    state.lastAutoAssetCode = "";
    if (canRefreshPreview) {
      refs.assetCodeInput.value = "";
    }
    saveData();
    updateAssetCodePreview();
  }

  function setPlanSettingsForm() {
    var plan = planSettings();
    refs.planLengthInput.value = String(plan.length);
    refs.planWidthInput.value = String(plan.width);
    refs.planHeightInput.value = String(plan.height);
  }

  function savePlanSettings() {
    var plan = planSettings();
    plan.length = Math.max(1, toNumber(refs.planLengthInput.value, plan.length));
    plan.width = Math.max(1, toNumber(refs.planWidthInput.value, plan.width));
    plan.height = Math.max(1, toNumber(refs.planHeightInput.value, plan.height));
    records().planZones.forEach(function (zone) {
      if (zoneShape(zone) === "polygon") {
        zone.points = normalizePlanPoints(zone.points);
        var bounds = planZoneBounds(zone);
        zone.x = round(bounds.x, 1);
        zone.y = round(bounds.y, 1);
        zone.w = round(bounds.w, 1);
        zone.h = round(bounds.h, 1);
      } else {
        zone.x = round(clamp(toNumber(zone.x, 0), 0, Math.max(0, plan.length - 0.5)), 1);
        zone.y = round(clamp(toNumber(zone.y, 0), 0, Math.max(0, plan.width - 0.5)), 1);
        zone.w = round(clamp(toNumber(zone.w, 1), 0.5, Math.max(0.5, plan.length - zone.x)), 1);
        zone.h = round(clamp(toNumber(zone.h, 1), 0.5, Math.max(0.5, plan.width - zone.y)), 1);
      }
    });
    records().assets.forEach(function (asset) {
      if (asset.planX !== null && asset.planX !== undefined) {
        asset.planX = round(clamp(toNumber(asset.planX, 0), 0, plan.length), 1);
      }
      if (asset.planY !== null && asset.planY !== undefined) {
        asset.planY = round(clamp(toNumber(asset.planY, 0), 0, plan.width), 1);
      }
    });
    saveData();
    renderAll();
  }

  function renderMetrics() {
    var building = activeBuilding();
    var rec = records();
    var summary = buildingEnergySummary();
    var assetCount = rec.assets.reduce(function (total, asset) {
      return total + Math.max(1, toNumber(asset.quantity, 1));
    }, 0);
    var assetValue = rec.assets.reduce(function (total, asset) {
      return total + toNumber(asset.acquisitionCost, 0);
    }, 0);
    var monthlyInfaq = monthlyInfaqTotal();
    var monthlyExpense = monthlyExpenseTotal();
    var dueCount = serviceDueCount();
    var balance = building.energy.currentBalanceKwh;
    var remainingDays = summary.dailyKwh > 0 ? balance / summary.dailyKwh : 0;

    refs.metricAssetCount.textContent = formatNumber(assetCount, 0);
    refs.metricAssetValue.textContent = "Nilai aset " + formatCurrency(assetValue);
    refs.metricLoad.textContent = formatNumber(summary.loadWatts, 0) + " W";
    refs.metricDailyCost.textContent = formatNumber(summary.dailyKwh, 2) + " kWh/hari";
    refs.metricMonthlyCost.textContent = formatCurrency(summary.monthlyCost);
    refs.metricTariff.textContent = meterKindLabel(building.energy.meterKind) + " - " + powerCapacityLabel(building.energy.installedPowerVa) + " - Tarif " + formatCurrency(building.energy.tariffPerKwh) + "/kWh";
    refs.metricKwhBalance.textContent = formatNumber(balance, 2) + " kWh";
    refs.metricKwhDays.textContent = summary.dailyKwh > 0 ? formatNumber(remainingDays, 1) + " hari estimasi" : "Belum ada pemakaian";
    refs.metricMonthlyInfaq.textContent = formatCurrency(monthlyInfaq);
    refs.metricCashBalance.textContent = "Saldo bulan ini " + formatCurrency(monthlyInfaq - monthlyExpense);
    refs.metricMonthlyExpense.textContent = formatCurrency(monthlyExpense);
    refs.metricServiceDue.textContent = dueCount + " jadwal service dekat";
  }

  function monthlyInfaqTotal() {
    var month = currentMonthKey();
    return records().infaq.reduce(function (total, item) {
      return dateMonthKey(item.date) === month ? total + toNumber(item.amount, 0) : total;
    }, 0);
  }

  function monthlyExpenseTotal() {
    var month = currentMonthKey();
    var rec = records();
    var expenses = rec.expenses.reduce(function (total, item) {
      return dateMonthKey(item.date) === month ? total + toNumber(item.amount, 0) : total;
    }, 0);
    var services = rec.services.reduce(function (total, item) {
      return dateMonthKey(item.date) === month ? total + toNumber(item.cost, 0) : total;
    }, 0);
    var meter = rec.meterLogs.reduce(function (total, item) {
      return dateMonthKey(item.date) === month ? total + toNumber(item.cost, 0) : total;
    }, 0);
    return expenses + services + meter;
  }

  function serviceDueCount() {
    var now = new Date();
    var limit = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    return records().services.filter(function (service) {
      if (!service.nextServiceDate) {
        return false;
      }
      var next = new Date(service.nextServiceDate + "T00:00:00");
      return !Number.isNaN(next.getTime()) && next <= limit;
    }).length;
  }

  function meterVarianceText() {
    var logs = records().meterLogs.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
    var topup = logs.find(function (item) {
      return item.type === "topup";
    });
    if (!topup) {
      return "Belum ada log token";
    }
    var summary = buildingEnergySummary();
    var topupDate = new Date(topup.date);
    if (Number.isNaN(topupDate.getTime())) {
      return "Log token belum valid";
    }
    var days = Math.max(0, (Date.now() - topupDate.getTime()) / 86400000);
    var estimatedUse = summary.dailyKwh * days;
    var estimatedRemaining = Math.max(0, toNumber(topup.balanceAfter, topup.kwh) - estimatedUse);
    var current = activeBuilding().energy.currentBalanceKwh;
    var variance = current - estimatedRemaining;
    return "Estimasi sisa " + formatNumber(estimatedRemaining, 2) + " kWh, selisih " + formatNumber(variance, 2) + " kWh";
  }

  function renderMeterVariance() {
    refs.meterVarianceText.textContent = meterVarianceText();
  }

  function actionButtons(kind, id) {
    return "<div class=\"row-actions\">" +
      "<button type=\"button\" data-kind=\"" + kind + "\" data-action=\"edit\" data-id=\"" + escapeHtml(id) + "\">Edit</button>" +
      "<button type=\"button\" data-kind=\"" + kind + "\" data-action=\"delete\" data-id=\"" + escapeHtml(id) + "\">Hapus</button>" +
      "</div>";
  }

  function emptyRow(colspan, text) {
    return "<tr class=\"empty-row\"><td colspan=\"" + colspan + "\">" + escapeHtml(text) + "</td></tr>";
  }

  function renderAssets() {
    var rows = records().assets.map(function (asset) {
      var energy = assetEnergy(asset);
      var cost = energy.monthlyKwh * activeBuilding().energy.tariffPerKwh;
      var meta = getSubtypeMeta(asset.category, asset.subtype);
      var subtypeLine = asset.subtype + (meta.pk ? " - " + meta.pk + " PK" : "");
      var vehicleLine = isVehicleCategory(asset.category) ? vehicleDetailLine(asset.vehicle) : "";
      var fuelLine = isFuelAssetCategory(asset.category) ? fuelDetailLine(asset.fuel) : "";
      var positionParts = [];
      if (asset.planX !== null && asset.planX !== undefined && asset.planY !== null && asset.planY !== undefined) {
        positionParts.push(formatNumber(asset.planX, 1) + ", " + formatNumber(asset.planY, 1) + " m");
      }
      if (asset.mountHeight !== null && asset.mountHeight !== undefined) {
        positionParts.push("h " + formatNumber(asset.mountHeight, 1) + " m");
      }
      if (asset.direction) {
        positionParts.push(asset.direction);
      }
      var positionLine = positionParts.join(" - ");
      return "<tr>" +
        "<td><strong>" + escapeHtml(asset.code) + "</strong><br><span class=\"muted-cell\">" + escapeHtml(asset.category) + "</span></td>" +
        "<td><span class=\"row-title\"><strong>" + escapeHtml(asset.name) + "</strong><small>" + escapeHtml(subtypeLine) + "</small></span></td>" +
        "<td><span class=\"row-title\"><strong>" + escapeHtml([asset.brand, asset.model].filter(Boolean).join(" / ") || "-") + "</strong><small>" + escapeHtml([asset.capacity, vehicleLine, fuelLine].filter(Boolean).join(" - ") || "") + "</small></span></td>" +
        "<td><span class=\"row-title\"><strong>" + escapeHtml(asset.room || "-") + "</strong><small>" + escapeHtml(positionLine || "-") + "</small></span></td>" +
        "<td>" + formatNumber(asset.powerWatts, 0) + " W x " + formatNumber(asset.quantity, 0) + "</td>" +
        "<td>" + formatNumber(energy.monthlyKwh, 2) + " kWh/bln<br><span class=\"muted-cell\">" + formatCurrency(cost) + "</span></td>" +
        "<td>" + actionButtons("asset", asset.id) + "</td>" +
        "</tr>";
    });
    refs.assetTableBody.innerHTML = rows.join("") || emptyRow(7, "Belum ada aset pada bangunan ini.");
  }

  function renderMeterLogs() {
    var typeLabels = {
      topup: "Isi ulang token",
      reading: "Catat sisa KWH",
      usage: "Pemakaian aktual",
      adjustment: "Penyesuaian"
    };
    var rows = records().meterLogs.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    }).map(function (item) {
      return "<tr>" +
        "<td>" + formatDateTime(item.date) + "</td>" +
        "<td>" + escapeHtml(typeLabels[item.type] || item.type) + "</td>" +
        "<td>" + formatNumber(item.kwh, 2) + " kWh<br><span class=\"muted-cell\">Sisa " + formatNumber(item.balanceAfter, 2) + " kWh</span></td>" +
        "<td>" + formatCurrency(item.cost) + "</td>" +
        "<td>" + escapeHtml(item.note || "-") + "</td>" +
        "<td>" + actionButtons("meter", item.id) + "</td>" +
        "</tr>";
    });
    refs.meterTableBody.innerHTML = rows.join("") || emptyRow(6, "Belum ada log KWH meter.");
  }

  function renderServices() {
    var rows = records().services.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    }).map(function (service) {
      var next = service.nextServiceDate ? "<br><span class=\"muted-cell\">Berikutnya " + formatDate(service.nextServiceDate) + "</span>" : "";
      return "<tr>" +
        "<td>" + formatDateTime(service.date) + next + "</td>" +
        "<td>" + escapeHtml(service.targetLabel || targetLabel(service.targetType, service.targetId)) + "</td>" +
        "<td>" + escapeHtml(service.type) + "</td>" +
        "<td><span class=\"row-title\"><strong>" + escapeHtml(service.title) + "</strong><small>" + escapeHtml(service.vendor || "-") + "</small></span></td>" +
        "<td>" + formatCurrency(service.cost) + "</td>" +
        "<td class=\"service-detail-cell\">" + escapeHtml(service.detail || "-") + "</td>" +
        "<td>" + actionButtons("service", service.id) + "</td>" +
        "</tr>";
    });
    refs.serviceTableBody.innerHTML = rows.join("") || emptyRow(7, "Belum ada log service.");
    document.body.classList.toggle("service-details-hidden", !refs.showServiceDetailsToggle.checked);
  }

  function renderInfaq() {
    var rows = records().infaq.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    }).map(function (item) {
      return "<tr>" +
        "<td>" + formatDate(item.date) + "</td>" +
        "<td>" + escapeHtml(item.category) + "</td>" +
        "<td><span class=\"row-title\"><strong>" + escapeHtml(item.source || "-") + "</strong><small>" + escapeHtml(item.notes || "") + "</small></span></td>" +
        "<td>" + escapeHtml(item.allocation || "-") + "</td>" +
        "<td>" + escapeHtml(item.method || "-") + "</td>" +
        "<td>" + formatCurrency(item.amount) + "</td>" +
        "<td>" + actionButtons("infaq", item.id) + "</td>" +
        "</tr>";
    });
    refs.infaqTableBody.innerHTML = rows.join("") || emptyRow(7, "Belum ada pemasukan.");
  }

  function renderExpenses() {
    var rows = records().expenses.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    }).map(function (expense) {
      return "<tr>" +
        "<td>" + formatDate(expense.date) + "</td>" +
        "<td>" + escapeHtml(expense.category) + "</td>" +
        "<td><span class=\"row-title\"><strong>" + escapeHtml(expense.description) + "</strong><small>" + escapeHtml(expense.source || "-") + "</small></span></td>" +
        "<td>" + escapeHtml(expense.assetLabel || "-") + "</td>" +
        "<td>" + formatCurrency(expense.amount) + "</td>" +
        "<td>" + actionButtons("expense", expense.id) + "</td>" +
        "</tr>";
    });
    refs.expenseTableBody.innerHTML = rows.join("") || emptyRow(6, "Belum ada pengeluaran.");
  }

  function renderRooms() {
    var rows = records().rooms.map(function (room) {
      var analysis = roomAcAnalysis(room);
      var need = analysis.need;
      var statusDetail = analysis.deficit > 0
        ? "Kurang " + formatNumber(analysis.deficit, 0) + " BTU/h"
        : "Margin " + formatNumber(Math.max(0, analysis.effectiveBtu - need.requiredBtu), 0) + " BTU/h";
      var areaDetail = formatNullableNumber(room.length, 1) + " x " + formatNullableNumber(room.width, 1) + " x " + formatNullableNumber(room.height, 1) + " m";
      if (need.areaSource === "denah") {
        areaDetail += " - luas denah";
      }
      return "<tr>" +
        "<td><span class=\"row-title\"><strong>" + escapeHtml(room.name) + "</strong><small>" + escapeHtml(room.airflow || "-") + "</small></span></td>" +
        "<td>" + formatNumber(need.area, 1) + " m2<br><span class=\"muted-cell\">" + escapeHtml(areaDetail) + "</span></td>" +
        "<td>" + formatNumber(need.requiredBtu, 0) + " BTU/h<br><span class=\"muted-cell\">" + escapeHtml(need.pkLabel) + "</span></td>" +
        "<td>" + formatNumber(analysis.installedBtu, 0) + " BTU/h<br><span class=\"muted-cell\">Efektif " + formatNumber(analysis.effectiveBtu, 0) + "</span></td>" +
        "<td><span class=\"status-dot is-" + escapeHtml(analysis.statusKey) + "\"></span>" + escapeHtml(analysis.conclusion) + "<br><span class=\"muted-cell\">" + escapeHtml(statusDetail) + "</span></td>" +
        "<td>" + actionButtons("room", room.id) + "</td>" +
        "</tr>";
    });
    refs.roomTableBody.innerHTML = rows.join("") || emptyRow(6, "Belum ada data ruangan.");
  }

  function assetsInNamedArea(name) {
    var target = roomNameKey(name);
    return records().assets.filter(function (asset) {
      return roomNameKey(asset.room) === target;
    });
  }

  function planZoneByName(name) {
    var target = roomNameKey(name);
    if (!target) {
      return null;
    }
    return records().planZones.find(function (zone) {
      return roomNameKey(zone.name) === target;
    }) || null;
  }

  function planAssetLabel(asset) {
    var labels = {
      "AC": "AC",
      "Televisi": "TV",
      "Pengeras suara": "AUD",
      "Kulkas": "REF",
      "Pompa air": "PMP",
      "Lampu": "LMP",
      "Kipas angin": "FAN",
      "Pendingin ruangan": "HVAC",
      "Genset": "GEN",
      "CCTV dan jaringan": "CCTV",
      "Peralatan air dan dapur": "KIT",
      "Inventaris non-listrik": "INV",
      "Kendaraan": "VEH"
    };
    return labels[asset.category] || String(asset.category || "AST").slice(0, 4).toUpperCase();
  }

  function planAssetPosition(asset, slotByZone) {
    var plan = planSettings();
    if (asset.planX !== null && asset.planX !== undefined && asset.planY !== null && asset.planY !== undefined) {
      return {
        x: clamp(toNumber(asset.planX, 0), 0, plan.length),
        y: clamp(toNumber(asset.planY, 0), 0, plan.width)
      };
    }
    var zone = planZoneByName(asset.room);
    if (!zone) {
      return null;
    }
    var rect = planZoneBounds(zone);
    var points = zonePoints(zone);
    var key = roomNameKey(zone.name);
    var slot = slotByZone[key] || 0;
    slotByZone[key] = slot + 1;
    var col = slot % 4;
    var row = Math.floor(slot / 4) % 3;
    var position = {
      x: rect.x + rect.w * (0.18 + col * 0.21),
      y: rect.y + rect.h * (0.22 + row * 0.23)
    };
    if (zoneShape(zone) === "polygon" && !pointInsidePolygon(position, points)) {
      var candidates = [
        { x: rect.x + rect.w * 0.5, y: rect.y + rect.h * 0.5 },
        { x: rect.x + rect.w * 0.3, y: rect.y + rect.h * 0.3 },
        { x: rect.x + rect.w * 0.7, y: rect.y + rect.h * 0.3 },
        { x: rect.x + rect.w * 0.3, y: rect.y + rect.h * 0.7 },
        { x: rect.x + rect.w * 0.7, y: rect.y + rect.h * 0.7 },
        polygonCentroid(points)
      ];
      position = candidates.find(function (candidate) {
        return pointInsidePolygon(candidate, points);
      }) || polygonCentroid(points);
    }
    return position;
  }

  function renderPlanAnalysis() {
    if (!refs.planAnalysisList) {
      return;
    }
    var cards = records().rooms.map(function (room) {
      var analysis = roomAcAnalysis(room);
      var assetSummary = analysis.assets.length
        ? analysis.assets.length + " record pendingin, " + analysis.assets.reduce(function (total, asset) {
          return total + assetQuantity(asset);
        }, 0) + " unit"
        : "Belum ada pendingin di inventaris ruangan ini";
      var suggestions = analysis.suggestions.slice(0, 4).map(function (message) {
        return "<li>" + escapeHtml(message) + "</li>";
      }).join("");
      return "<article class=\"analysis-card\" data-status=\"" + escapeHtml(analysis.statusKey) + "\">" +
        "<strong>" + escapeHtml(room.name) + "</strong>" +
        "<span>" + escapeHtml(analysis.conclusion) + "</span>" +
        "<small>Butuh " + formatNumber(analysis.need.requiredBtu, 0) + " BTU/h (" + escapeHtml(analysis.need.pkLabel) + "), terpasang " + formatNumber(analysis.installedBtu, 0) + ", efektif " + formatNumber(analysis.effectiveBtu, 0) + ". " + escapeHtml(assetSummary) + ".</small>" +
        "<ul>" + suggestions + "</ul>" +
        "</article>";
    });
    refs.planAnalysisList.innerHTML = cards.join("") || "<article class=\"analysis-card\" data-status=\"warn\"><strong>Belum ada ruangan</strong><span>Isi data ruangan dahulu</span><small>Analisa pendingin membutuhkan panjang, lebar, tinggi, dan inventaris pendingin per ruangan.</small></article>";
  }

  function renderPlan() {
    var zones = records().planZones;
    var plan = planSettings();
    refs.planCanvas.style.aspectRatio = plan.length + " / " + plan.width;
    var zoneHtml = zones.map(function (zone) {
      var rect = planZoneBounds(zone);
      var shape = zoneShape(zone);
      var clipPath = zoneClipPath(zone, rect);
      var shapeStyle = clipPath ? ";clip-path:" + clipPath : "";
      var count = assetsInNamedArea(zone.name).reduce(function (total, asset) {
        return total + assetQuantity(asset);
      }, 0);
      var dimensionLine = shape === "polygon"
        ? "Bebas - " + formatNumber(zoneArea(zone.points), 1) + " m2"
        : formatNumber(rect.w, 1) + " x " + formatNumber(rect.h, 1) + " m";
      return "<div class=\"plan-zone\" data-id=\"" + escapeHtml(zone.id) + "\" data-kind=\"" + escapeHtml(zone.kind) + "\" data-shape=\"" + escapeHtml(shape) + "\" style=\"left:" + round(rect.leftPct, 2) + "%;top:" + round(rect.topPct, 2) + "%;width:" + round(rect.widthPct, 2) + "%;height:" + round(rect.heightPct, 2) + "%" + shapeStyle + "\">" +
        "<strong>" + escapeHtml(zone.name) + "</strong>" +
        "<small>" + escapeHtml(PLAN_KIND_LABELS[zone.kind] || zone.kind) + "</small>" +
        "<small>" + escapeHtml(dimensionLine) + "</small>" +
        "<small>" + count + " aset</small>" +
        "</div>";
    }).join("");

    var slotByZone = {};
    var markerHtml = records().assets.map(function (asset) {
      var position = planAssetPosition(asset, slotByZone);
      if (!position) {
        return "";
      }
      var label = planAssetLabel(asset);
      var quantity = assetQuantity(asset);
      var title = [
        asset.code,
        asset.name,
        asset.category,
        asset.subtype,
        asset.room ? "Ruang " + asset.room : "",
        asset.mountHeight !== null && asset.mountHeight !== undefined ? "Tinggi " + formatNumber(asset.mountHeight, 1) + " m" : "",
        asset.direction || ""
      ].filter(Boolean).join(" - ");
      return "<button type=\"button\" class=\"plan-asset plan-asset-" + escapeHtml(slugify(asset.category)) + "\" style=\"left:" + round(planPercent(position.x, plan.length), 2) + "%;top:" + round(planPercent(position.y, plan.width), 2) + "%\" title=\"" + escapeHtml(title) + "\">" +
        "<span>" + escapeHtml(label) + "</span>" +
        "<small>x" + formatNumber(quantity, 0) + "</small>" +
        "</button>";
    }).join("");

    refs.planCanvas.innerHTML = "<div class=\"plan-scale-label\">" + formatNumber(plan.length, 1) + " x " + formatNumber(plan.width, 1) + " x " + formatNumber(plan.height, 1) + " m</div>" + zoneHtml + markerHtml;

    refs.planTableBody.innerHTML = zones.map(function (zone) {
      var rect = planZoneBounds(zone);
      var shape = zoneShape(zone);
      var assetCount = assetsInNamedArea(zone.name).reduce(function (total, asset) {
        return total + assetQuantity(asset);
      }, 0);
      var position = shape === "polygon"
        ? "Bebas " + formatNumber(zoneArea(zone.points), 1) + " m2 - " + normalizePlanPoints(zone.points).length + " titik"
        : formatNumber(rect.x, 1) + "," + formatNumber(rect.y, 1) + " m - " + formatNumber(rect.w, 1) + " x " + formatNumber(rect.h, 1) + " m";
      return "<tr>" +
        "<td>" + escapeHtml(zone.name) + "</td>" +
        "<td>" + escapeHtml(PLAN_KIND_LABELS[zone.kind] || zone.kind) + "</td>" +
        "<td>" + escapeHtml(position) + "</td>" +
        "<td>" + assetCount + " aset</td>" +
        "<td>" + actionButtons("plan", zone.id) + "</td>" +
        "</tr>";
    }).join("") || emptyRow(5, "Belum ada blok denah.");
    renderPlanAnalysis();
  }

  function renderAll() {
    renderScope();
    renderWebgisBuildings();
    renderBuildingOptions();
    setAssetCodeFormatForm();
    setPlanSettingsForm();
    renderMetrics();
    setMeterSettingsForm();
    setPriceRegionForm();
    setWaterSettingsForm();
    renderMeterVariance();
    populateServiceTargets();
    populateExpenseAssets();
    populateRoomDatalist();
    renderAssets();
    renderMeterLogs();
    renderServices();
    renderInfaq();
    renderExpenses();
    renderRooms();
    renderPlan();
    renderEnergyPrices();
    updateAssetCodePreview();
    updateAssetEstimate();
    updateRoomEstimate();
  }

  function applyDeepLinkQuery() {
    if (!window.URLSearchParams) {
      return;
    }
    var params = new URLSearchParams(window.location.search || "");
    var requestedTab = String(params.get("tab") || "").trim();
    var allowedTabs = ["assets", "meter", "energy-prices", "service", "finance", "rooms", "plan"];
    if (allowedTabs.indexOf(requestedTab) !== -1) {
      state.activeTab = requestedTab;
    }
    var requestedCategory = params.get("category");
    if (requestedCategory !== null && refs.globalDiscoveryCategoryInput) {
      var category = normalizeGlobalUtilityCategory(requestedCategory);
      var allCategories = ["all", "semua", "*"].indexOf(String(requestedCategory).trim().toLowerCase()) !== -1;
      if (category || allCategories) {
        refs.globalDiscoveryCategoryInput.value = category;
      }
    }
    if (refs.globalDiscoveryUseAdmInput) {
      refs.globalDiscoveryUseAdmInput.checked = ["1", "true", "yes", "adm"].indexOf(String(params.get("admOverride") || "").toLowerCase()) !== -1;
    }
    state.deepLinkSection = String(params.get("section") || "").trim().toLowerCase();
    if (state.deepLinkSection === "discovery" && allowedTabs.indexOf(requestedTab) === -1) {
      state.activeTab = "energy-prices";
    }
  }

  function syncGlobalDiscoveryQuery() {
    if (!window.URLSearchParams || !window.history || typeof window.history.replaceState !== "function") {
      return;
    }
    var params = new URLSearchParams(window.location.search || "");
    params.set("tab", "energy-prices");
    params.set("section", "discovery");
    params.set("category", globalDiscoveryCategory() || "all");
    if (globalDiscoveryUsesAdmOverride()) {
      params.set("admOverride", "1");
    } else {
      params.delete("admOverride");
    }
    var query = params.toString();
    window.history.replaceState(null, document.title, window.location.pathname + (query ? "?" + query : "") + window.location.hash);
  }

  function scrollToDeepLinkedSection() {
    if (state.deepLinkSection !== "discovery") {
      return;
    }
    var target = document.getElementById("globalDiscoveryInspector");
    if (!target || typeof target.scrollIntoView !== "function") {
      return;
    }
    window.setTimeout(function () {
      try {
        target.scrollIntoView({ block: "start" });
      } catch (error) {
        target.scrollIntoView(true);
      }
    }, 0);
  }

  function activateTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll("[data-tab]").forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-tab") === tab);
    });
    document.querySelectorAll("[data-pane]").forEach(function (pane) {
      pane.classList.toggle("is-active", pane.getAttribute("data-pane") === tab);
    });
    if (tab === "energy-prices") {
      loadEnergyPrices(false);
    }
  }

  function findRecord(kind, id) {
    var map = {
      asset: "assets",
      meter: "meterLogs",
      service: "services",
      infaq: "infaq",
      expense: "expenses",
      room: "rooms",
      plan: "planZones"
    };
    var list = records()[map[kind]] || [];
    return list.find(function (item) {
      return item.id === id;
    });
  }

  function deleteRecord(kind, id) {
    var map = {
      asset: "assets",
      meter: "meterLogs",
      service: "services",
      infaq: "infaq",
      expense: "expenses",
      room: "rooms",
      plan: "planZones"
    };
    var key = map[kind];
    if (!key || !window.confirm("Hapus record ini?")) {
      return;
    }
    activeBuilding().records[key] = records()[key].filter(function (item) {
      return item.id !== id;
    });
    saveData();
    resetAllForms();
    renderAll();
  }

  function editAsset(asset) {
    refs.assetIdInput.value = asset.id;
    refs.assetCategoryInput.value = asset.category;
    populateSubtypeOptions(asset.subtype);
    refs.assetCodeInput.value = asset.code;
    refs.assetNameInput.value = asset.name;
    refs.assetBrandInput.value = asset.brand || "";
    refs.assetModelInput.value = asset.model || "";
    refs.assetCapacityInput.value = asset.capacity || "";
    setVehicleFieldsVisibility();
    refs.assetWheelCountInput.value = asset.vehicle && asset.vehicle.wheels !== null && asset.vehicle.wheels !== undefined ? String(asset.vehicle.wheels) : "";
    refs.assetVehicleKindInput.value = asset.vehicle && asset.vehicle.kind ? asset.vehicle.kind : "";
    refs.assetVehicleYearInput.value = asset.vehicle && asset.vehicle.productionYear !== null && asset.vehicle.productionYear !== undefined ? String(asset.vehicle.productionYear) : "";
    refs.assetVehicleColorInput.value = asset.vehicle && asset.vehicle.color ? asset.vehicle.color : "";
    refs.assetVehiclePlateInput.value = asset.vehicle && asset.vehicle.plateNumber ? asset.vehicle.plateNumber : "";
    refs.assetFuelTypeInput.value = asset.fuel && asset.fuel.type ? asset.fuel.type : "";
    refs.assetFuelCapacityInput.value = asset.fuel && asset.fuel.capacity ? asset.fuel.capacity : "";
    refs.assetRoomInput.value = asset.room || "";
    refs.assetPlanXInput.value = asset.planX !== null && asset.planX !== undefined ? String(asset.planX) : "";
    refs.assetPlanYInput.value = asset.planY !== null && asset.planY !== undefined ? String(asset.planY) : "";
    refs.assetMountHeightInput.value = asset.mountHeight !== null && asset.mountHeight !== undefined ? String(asset.mountHeight) : "";
    refs.assetDirectionInput.value = asset.direction || "";
    refs.assetQuantityInput.value = String(asset.quantity || 1);
    refs.assetWattsInput.value = String(asset.powerWatts || 0);
    refs.assetHoursInput.value = String(asset.hoursPerDay || 0);
    refs.assetDaysInput.value = String(asset.daysPerMonth || 30);
    refs.assetMonitoringInput.value = asset.monitoringMode || "manual";
    refs.assetSensorInput.value = asset.sensorId || "";
    refs.assetAcquiredInput.value = asset.acquiredAt || "";
    refs.assetValueInput.value = String(asset.acquisitionCost || 0);
    refs.assetNotesInput.value = asset.notes || "";
    populateBrandOptions();
    populateSeriesOptions();
    updateAssetEstimate();
    activateTab("assets");
  }

  function editMeter(item) {
    refs.meterLogIdInput.value = item.id;
    refs.meterDateInput.value = datetimeLocalValue(item.date);
    refs.meterTypeInput.value = item.type || "reading";
    refs.meterKwhInput.value = String(item.kwh || 0);
    refs.meterCostInput.value = String(item.cost || 0);
    refs.meterNoteInput.value = item.note || "";
    activateTab("meter");
  }

  function editService(service) {
    refs.serviceIdInput.value = service.id;
    refs.serviceDateInput.value = datetimeLocalValue(service.date);
    refs.serviceTypeInput.value = service.type || "";
    refs.serviceTitleInput.value = service.title || "";
    refs.serviceVendorInput.value = service.vendor || "";
    refs.serviceCostInput.value = String(service.cost || 0);
    refs.serviceNextInput.value = service.nextServiceDate || "";
    refs.serviceDetailInput.value = service.detail || "";
    populateServiceTargets();
    refs.serviceTargetInput.value = service.targetType && service.targetId ? service.targetType + ":" + service.targetId : "";
    activateTab("service");
  }

  function editExpense(expense) {
    refs.expenseIdInput.value = expense.id;
    refs.expenseDateInput.value = expense.date || todayValue();
    refs.expenseCategoryInput.value = expense.category || "Lainnya";
    refs.expenseDescriptionInput.value = expense.description || "";
    refs.expenseAmountInput.value = String(expense.amount || 0);
    refs.expenseSourceInput.value = expense.source || "";
    populateExpenseAssets();
    refs.expenseAssetInput.value = expense.assetId || "";
    activateTab("finance");
  }

  function editInfaq(item) {
    refs.infaqIdInput.value = item.id;
    refs.infaqDateInput.value = item.date || todayValue();
    refs.infaqCategoryInput.value = item.category || "Infaq";
    refs.infaqSourceInput.value = item.source || "";
    refs.infaqAmountInput.value = String(item.amount || 0);
    refs.infaqMethodInput.value = item.method || "Tunai";
    refs.infaqAllocationInput.value = item.allocation || "Operasional";
    refs.infaqNotesInput.value = item.notes || "";
    activateTab("finance");
  }

  function editRoom(room) {
    refs.roomIdInput.value = room.id;
    refs.roomNameInput.value = room.name || "";
    refs.roomLengthInput.value = room.length !== null && room.length !== undefined ? String(room.length) : "";
    refs.roomWidthInput.value = room.width !== null && room.width !== undefined ? String(room.width) : "";
    refs.roomHeightInput.value = room.height !== null && room.height !== undefined ? String(room.height) : "";
    refs.roomOccupancyInput.value = room.occupancy !== null && room.occupancy !== undefined ? String(room.occupancy) : "";
    refs.roomSunInput.value = room.sunExposure || "";
    refs.roomAirflowInput.value = room.airflow || "";
    refs.roomRecommendationInput.value = room.recommendation || "";
    updateRoomEstimate();
    activateTab("rooms");
  }

  function editPlan(zone) {
    var rect = planZoneBounds(zone);
    var shape = zoneShape(zone);
    refs.planIdInput.value = zone.id;
    refs.planNameInput.value = zone.name || "";
    refs.planKindInput.value = zone.kind === "prayer" ? "room" : (zone.kind || "");
    refs.planShapeInput.value = shape;
    refs.planPointsInput.value = shape === "polygon" ? formatPlanPoints(zone.points) : "";
    refs.planXInput.value = String(round(rect.x, 1));
    refs.planYInput.value = String(round(rect.y, 1));
    refs.planWInput.value = String(round(rect.w, 1));
    refs.planHInput.value = String(round(rect.h, 1));
    activateTab("plan");
  }

  function editRecord(kind, id) {
    var record = findRecord(kind, id);
    if (!record) {
      return;
    }
    if (kind === "asset") {
      editAsset(record);
    } else if (kind === "meter") {
      editMeter(record);
    } else if (kind === "service") {
      editService(record);
    } else if (kind === "infaq") {
      editInfaq(record);
    } else if (kind === "expense") {
      editExpense(record);
    } else if (kind === "room") {
      editRoom(record);
    } else if (kind === "plan") {
      editPlan(record);
    }
  }

  function handleTableAction(event) {
    var button = event.target.closest("[data-kind][data-action][data-id]");
    if (!button) {
      return;
    }
    var kind = button.getAttribute("data-kind");
    var action = button.getAttribute("data-action");
    var id = button.getAttribute("data-id");
    if (action === "edit") {
      editRecord(kind, id);
    } else if (action === "delete") {
      deleteRecord(kind, id);
    }
  }

  function exportData() {
    var payload = {
      systemName: SYSTEM_NAME,
      exportedAt: new Date().toISOString(),
      scopeKey: state.scopeKey,
      data: state.data
    };
    var buildingName = displayBuildingName(activeBuilding(), "building");
    var fileName = "flexibel-building-asset-monitoring-" + slugify(buildingName) + ".json";
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function importData(file) {
    if (!file) {
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var payload = safeParse(String(reader.result || ""), null);
      var imported = payload && payload.data ? payload.data : payload;
      if (!imported || !Array.isArray(imported.buildings)) {
        window.alert("File JSON tidak sesuai format " + SYSTEM_NAME + ".");
        return;
      }
      state.data = normalizeData(imported);
      saveData();
      resetAllForms();
      renderAll();
    };
    reader.readAsText(file);
  }

  function bindPlanDrag() {
    refs.planCanvas.addEventListener("mousedown", function (event) {
      var zoneElement = event.target.closest(".plan-zone");
      if (!zoneElement) {
        return;
      }
      var zone = findRecord("plan", zoneElement.getAttribute("data-id"));
      if (!zone) {
        return;
      }
      var rect = refs.planCanvas.getBoundingClientRect();
      var plan = planSettings();
      var zoneBounds = planZoneBounds(zone);
      state.drag = {
        id: zone.id,
        startX: event.clientX,
        startY: event.clientY,
        shape: zoneShape(zone),
        points: zonePoints(zone),
        zoneX: zoneBounds.x,
        zoneY: zoneBounds.y,
        zoneW: zoneBounds.w,
        zoneH: zoneBounds.h,
        width: rect.width,
        height: rect.height,
        planLength: plan.length,
        planWidth: plan.width
      };
      event.preventDefault();
    });

    document.addEventListener("mousemove", function (event) {
      if (!state.drag) {
        return;
      }
      var zone = findRecord("plan", state.drag.id);
      if (!zone) {
        return;
      }
      var dx = (event.clientX - state.drag.startX) / state.drag.width * state.drag.planLength;
      var dy = (event.clientY - state.drag.startY) / state.drag.height * state.drag.planWidth;
      if (state.drag.shape === "polygon") {
        zone.points = shiftedZonePoints(state.drag.points, dx, dy);
        var movedBounds = planZoneBounds(zone);
        zone.x = round(movedBounds.x, 1);
        zone.y = round(movedBounds.y, 1);
        zone.w = round(movedBounds.w, 1);
        zone.h = round(movedBounds.h, 1);
      } else {
        zone.x = round(clamp(state.drag.zoneX + dx, 0, Math.max(0, state.drag.planLength - state.drag.zoneW)), 1);
        zone.y = round(clamp(state.drag.zoneY + dy, 0, Math.max(0, state.drag.planWidth - state.drag.zoneH)), 1);
      }
      var element = refs.planCanvas.querySelector("[data-id=\"" + zone.id + "\"]");
      if (element) {
        var zoneRect = planZoneBounds(zone);
        element.style.left = round(zoneRect.leftPct, 2) + "%";
        element.style.top = round(zoneRect.topPct, 2) + "%";
        if (state.drag.shape === "polygon") {
          element.style.width = round(zoneRect.widthPct, 2) + "%";
          element.style.height = round(zoneRect.heightPct, 2) + "%";
          element.style.clipPath = zoneClipPath(zone, zoneRect);
        }
      }
    });

    document.addEventListener("mouseup", function () {
      if (!state.drag) {
        return;
      }
      state.drag = null;
      saveData();
      renderPlan();
    });
  }

  function bindEvents() {
    document.querySelectorAll("[data-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        activateTab(button.getAttribute("data-tab"));
      });
    });
    document.querySelectorAll("[data-energy-panel-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        var panel = String(button.getAttribute("data-energy-panel-toggle") || "");
        setEnergyPanelVisibility(panel, state.energyPanelsExpanded[panel] !== true);
      });
    });
    refs.energyPanelShowAllButton.addEventListener("click", function () {
      setAllEnergyPanels(true);
    });
    refs.energyPanelHideAllButton.addEventListener("click", function () {
      setAllEnergyPanels(false);
    });
    window.addEventListener("storage", function (event) {
      if (event.key !== ENERGY_PANEL_STORAGE_KEY) {
        return;
      }
      loadEnergyPanelPreferences(event.newValue);
      renderEnergyPanelVisibility();
    });

    refs.buildingForm.addEventListener("submit", addBuilding);
    refs.buildingSelect.addEventListener("change", changeBuilding);
    refs.toggleBuildingInfoButton.addEventListener("click", function () {
      state.showBuildingInfo = !state.showBuildingInfo;
      renderScope();
      renderWebgisBuildings();
    });
    refs.loadWebgisBuildingsButton.addEventListener("click", function () {
      loadWebgisBuildings();
    });
    refs.webgisBuildingTableBody.addEventListener("click", handleWebgisBuildingAction);
    window.addEventListener("hashchange", function () {
      if (state.suppressHashApply || !state.data) {
        return;
      }
      if (applyRouteBuildingHash()) {
        saveData();
        resetAllForms();
        renderAll();
        notifyFacilityReady();
      }
    });
    refs.assetCodeFormatInput.addEventListener("change", saveAssetCodeFormat);
    refs.assetCodeFormatInput.addEventListener("blur", saveAssetCodeFormat);
    refs.exportDataButton.addEventListener("click", exportData);
    refs.importDataButton.addEventListener("click", function () {
      refs.importDataInput.click();
    });
    refs.importDataInput.addEventListener("change", function () {
      importData(refs.importDataInput.files && refs.importDataInput.files[0]);
      refs.importDataInput.value = "";
    });

    refs.assetCategoryInput.addEventListener("input", handleAssetCategoryChange);
    refs.assetCategoryInput.addEventListener("change", handleAssetCategoryChange);
    refs.assetCodeInput.addEventListener("input", function () {
      if (refs.assetCodeInput.value.trim() !== state.lastAutoAssetCode) {
        state.lastAutoAssetCode = "";
      }
    });
    refs.assetSubtypeInput.addEventListener("input", applySubtypeDefaults);
    refs.assetSubtypeInput.addEventListener("change", applySubtypeDefaults);
    refs.assetBrandInput.addEventListener("input", applyBrandSuggestion);
    refs.assetBrandInput.addEventListener("change", applyBrandSuggestion);
    refs.assetBrandInput.addEventListener("input", function () {
      state.brandLookupKey = "";
      state.brandLookupData = null;
      if (refs.brandLookupPanel && !refs.brandLookupPanel.hidden) {
        refs.brandLookupStatus.textContent = "Merk berubah. Cek ulang sebelum ditambahkan ke katalog.";
        refs.brandLookupResults.innerHTML = "";
      }
    });
    refs.assetBrandInput.addEventListener("blur", maybeLookupUnknownBrand);
    refs.brandLookupButton.addEventListener("click", function () {
      lookupBrandOnline(true);
    });
    refs.brandLookupResults.addEventListener("click", handleBrandLookupAction);
    refs.assetModelInput.addEventListener("input", applyModelSuggestion);
    refs.assetModelInput.addEventListener("change", applyModelSuggestion);
    refs.assetCapacityInput.addEventListener("input", function () {
      if (refs.assetCapacityInput.value.trim() !== state.lastAutoAssetCapacity) {
        state.lastAutoAssetCapacity = "";
      }
    });
    [
      refs.assetQuantityInput,
      refs.assetWattsInput,
      refs.assetHoursInput,
      refs.assetDaysInput
    ].forEach(function (input) {
      input.addEventListener("input", updateAssetEstimate);
    });
    refs.assetForm.addEventListener("submit", saveAsset);
    refs.assetResetButton.addEventListener("click", resetAssetForm);

    refs.meterSettingsForm.addEventListener("submit", saveMeterSettings);
    refs.installedPowerClassInput.addEventListener("change", applyInstalledPowerClass);
    refs.installedPowerInput.addEventListener("input", syncInstalledPowerClass);
    refs.meterLogForm.addEventListener("submit", saveMeterLog);
    refs.meterResetButton.addEventListener("click", resetMeterLogForm);

    refs.serviceForm.addEventListener("submit", saveService);
    refs.serviceResetButton.addEventListener("click", resetServiceForm);
    refs.showServiceDetailsToggle.addEventListener("change", renderServices);

    refs.infaqForm.addEventListener("submit", saveInfaq);
    refs.infaqResetButton.addEventListener("click", resetInfaqForm);

    refs.expenseForm.addEventListener("submit", saveExpense);
    refs.expenseResetButton.addEventListener("click", resetExpenseForm);

    refs.energyPriceRefreshButton.addEventListener("click", function () {
      loadEnergyPrices(true);
    });
    refs.fuelPriceDisplayModeInput.addEventListener("change", renderEnergyPrices);
    refs.globalDiscoveryForm.addEventListener("submit", function (event) {
      event.preventDefault();
      syncGlobalDiscoveryQuery();
      loadGlobalDiscoveryInspector(true);
    });
    refs.globalDiscoveryCategoryInput.addEventListener("change", function () {
      resetGlobalDiscoveryState();
      syncGlobalDiscoveryQuery();
      loadGlobalDiscoveryInspector(false);
    });
    refs.globalDiscoveryUseAdmInput.addEventListener("change", function () {
      resetGlobalDiscoveryState();
      syncGlobalDiscoveryQuery();
      loadGlobalDiscoveryInspector(false);
    });
    refs.priceCountryInput.addEventListener("change", handlePriceCountryChange);
    refs.priceProvinceInput.addEventListener("change", handlePriceProvinceChange);
    refs.priceCityInput.addEventListener("change", handlePriceCityChange);
    refs.useWebgisPriceAreaButton.addEventListener("click", applyWebgisPriceArea);
    refs.priceRegionForm.addEventListener("submit", savePriceRegion);
    document.addEventListener("click", handleGlobalEditAction);
    refs.globalEditForm.addEventListener("submit", saveGlobalEdit);
    refs.globalEditCancelButton.addEventListener("click", resetGlobalEdit);
    refs.waterSourceForm.addEventListener("submit", saveWaterSettings);
    waterSourceCheckboxes().forEach(function (input) {
      input.addEventListener("change", function () {
        var selected = waterSourceCheckboxes().filter(function (item) {
          return item.checked;
        }).map(function (item) {
          return item.value;
        });
        if (selected.length && selected.indexOf(refs.waterPrimarySourceInput.value) === -1) {
          refs.waterPrimarySourceInput.value = selected[0];
        }
      });
    });

    [
      refs.roomLengthInput,
      refs.roomWidthInput,
      refs.roomHeightInput,
      refs.roomOccupancyInput,
      refs.roomSunInput
    ].forEach(function (input) {
      input.addEventListener("input", updateRoomEstimate);
      input.addEventListener("change", updateRoomEstimate);
    });
    refs.roomForm.addEventListener("submit", saveRoom);
    refs.roomResetButton.addEventListener("click", resetRoomForm);

    refs.planForm.addEventListener("submit", savePlanZone);
    refs.planResetButton.addEventListener("click", resetPlanForm);
    refs.planSettingsButton.addEventListener("click", savePlanSettings);
    refs.planShapeInput.addEventListener("change", updatePlanShapeInput);
    refs.planFromRoomsButton.addEventListener("click", addZonesFromRooms);

    [
      refs.assetTableBody,
      refs.meterTableBody,
      refs.serviceTableBody,
      refs.infaqTableBody,
      refs.expenseTableBody,
      refs.roomTableBody,
      refs.planTableBody
    ].forEach(function (body) {
      body.addEventListener("click", handleTableAction);
    });

    bindPlanDrag();

    if (window.MpmAdminLocation && window.MpmAdminLocation.UPDATE_EVENT) {
      window.addEventListener(window.MpmAdminLocation.UPDATE_EVENT, function (event) {
        if (state.resolvingContext) {
          return;
        }
        refreshForContext(event.detail || (window.MpmAdminLocation.read ? window.MpmAdminLocation.read() : null));
      });
      window.addEventListener("storage", function (event) {
        if (event.key !== window.MpmAdminLocation.STORAGE_KEY) {
          return;
        }
        refreshForContext(window.MpmAdminLocation.read ? window.MpmAdminLocation.read() : null);
      });
    }
  }

  function drawingContext() {
    var building = activeBuilding();
    return {
      scopeKey: state.scopeKey,
      siteName: displayBuildingName(building, ""),
      mosqueName: "",
      buildingId: building.id,
      buildingName: displayBuildingName(building, ""),
      plan: Object.assign({}, planSettings())
    };
  }

  function upsertPlanZoneFromDrawing(payload) {
    var source = payload && typeof payload === "object" ? payload : {};
    var name = String(source.name || source.roomName || source.label || "").trim();
    if (!name) {
      return { success: false, error: "Nama ruang/blok wajib diisi." };
    }
    var points = normalizePlanPoints(source.points || []);
    if (points.length < 3 || zoneArea(points) <= 0) {
      return { success: false, error: "Geometry polygon belum valid." };
    }
    var bounds = boundsFromPoints(points);
    var list = records().planZones;
    var key = roomNameKey(name);
    var existing = list.find(function (zone) {
      return roomNameKey(zone.name) === key;
    });
    var record = {
      id: existing ? existing.id : uid("zone"),
      name: name,
      kind: source.kind || (existing && existing.kind) || "room",
      shape: "polygon",
      x: round(bounds.x, 4),
      y: round(bounds.y, 4),
      w: round(bounds.w, 4),
      h: round(bounds.h, 4),
      points: points,
      unit: "meter",
      source: "floor-plan-editor",
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (existing) {
      Object.assign(existing, record);
    } else {
      list.unshift(record);
    }
    saveData();
    renderAll();
    window.dispatchEvent(new CustomEvent("mpm:facility-plan-updated", {
      detail: { zone: record, context: drawingContext() }
    }));
    return { success: true, zone: record };
  }

  function exposeFacilityBridge() {
    window.MpmFacilityManagement = {
      getDrawingContext: drawingContext,
      upsertPlanZoneFromDrawing: upsertPlanZoneFromDrawing
    };
  }

  function notifyFacilityReady() {
    window.dispatchEvent(new CustomEvent("mpm:facility-ready", {
      detail: drawingContext()
    }));
  }

  function init() {
    collectRefs();
    applyDeepLinkQuery();
    loadEnergyPanelPreferences();
    exposeFacilityBridge();
    bindEvents();
    renderEnergyPanelVisibility();
    loadCatalog().then(function () {
      populateCatalogOptions();
      return resolveContext();
    }).then(function () {
      loadData();
      if (applyRouteBuildingHash()) {
        saveData();
      }
      resetAllForms();
      renderAll();
      activateTab(state.activeTab);
      scrollToDeepLinkedSection();
      notifyFacilityReady();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);
