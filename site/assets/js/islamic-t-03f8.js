(function () {
  "use strict";

  function resolveApiUrl() {
    if (window.location.protocol !== "file:") return "api/islamic-text.php";
    // XAMPP's active virtual host serves this project at localhost root.
    return "http://localhost/api/islamic-text.php";
  }
  var API_URL = resolveApiUrl();
  var DB_NAME = "mpm-islamic-text-offline-v3";
  var STORE_NAME = "responses";
  var UNAVAILABLE_ONLINE_TAFSIR_SLUGS = {
    "ar-tafsir-al-jalalayn": true,
    "ar-tafseer-tanweer": true
  };
  var ONLINE_TAFSIR_SLUG_ALIASES = { "ar-tafseer-al-sadi": "ar-tafseer-al-saddi" };
  if (window.indexedDB) {
    try { window.indexedDB.deleteDatabase("mpm-islamic-text-offline-v1"); window.indexedDB.deleteDatabase("mpm-islamic-text-offline-v2"); } catch (error) {}
  }
  var state = {
    bootstrap: null,
    quran: null,
    hadith: null,
    automationLibrary: { tafsir: null, hadith: null },
    automationLiveSignatures: { tafsir: "", hadith: "" },
    automationReaderRefreshTimer: 0,
    hadithPage: 1,
    layout: "inline",
    source: "network",
    audio: { playlist: [], index: -1, fullSurah: null },
    tajwidTheme: { enabled: true, showLegend: true, mode: "auto", opacity: 1, rules: {} },
    quranRequestId: 0,
    catalogSurahs: [],
    search: { query: "", result: null, limit: 5, dictionary: null, sessionCache: Object.create(null) },
    learning: {
      engine: null,
      lesson: null,
      mode: "material",
      primary: "material",
      itemIndex: 0,
      revealLatin: false,
      audio: null,
      answerResults: Object.create(null),
      actorId: "",
      identities: { users: [], students: [], teachers: [], examiners: [] },
      admin: null,
      review: { session: null, questions: [], index: 0, results: Object.create(null) },
      test: { attempt: null, questions: [], index: 0, submitted: Object.create(null) },
      history: null
    },
    tafsir: { importEditionId: 0, online: { resources: null, entries: Object.create(null), reference: null, page: 0, pageSize: 30, total: 0 } }
  };

  function byId(id) { return document.getElementById(id); }
  function e(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char];
    });
  }
  function text(value, fallback) { return value == null || value === "" ? (fallback || "—") : String(value); }
  function tafsirHtml(value) {
    var source = String(value == null ? "" : value);
    if (!/<[a-z][\s\S]*>/i.test(source)) return "<p>" + e(source).replace(/\n/g, "<br>") + "</p>";
    var template = document.createElement("template");
    template.innerHTML = source;
    var allowedTags = { H1: true, H2: true, H3: true, P: true, DIV: true, SPAN: true, STRONG: true, EM: true, BR: true, BLOCKQUOTE: true, UL: true, OL: true, LI: true, A: true };
    template.content.querySelectorAll("*").forEach(function (node) {
      if (!allowedTags[node.tagName]) {
        node.replaceWith(document.createTextNode(node.textContent || ""));
        return;
      }
      if (node.tagName === "A") {
        var href = node.getAttribute("href") || "";
        if (!/^https?:\/\//i.test(href)) node.removeAttribute("href");
      }
    });
    template.content.querySelectorAll("*").forEach(function (node) {
      Array.from(node.attributes).forEach(function (attribute) {
        if (attribute.name !== "dir" && attribute.name !== "lang" && !(node.tagName === "A" && attribute.name === "href")) node.removeAttribute(attribute.name);
      });
    });
    return template.innerHTML;
  }
  function formatBytes(bytes) {
    var size = Number(bytes || 0);
    if (!size) return "0 B";
    var units = ["B", "KB", "MB", "GB"];
    var index = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
    return (size / Math.pow(1024, index)).toFixed(index ? 1 : 0) + " " + units[index];
  }
  function toast(message, isError) {
    var node = byId("islamicTextToast");
    node.textContent = window.PrayerI18n.uiText(message);
    node.className = "it-toast show" + (isError ? " error" : "");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { node.className = "it-toast"; }, 4500);
  }
  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.previousLabel = button.textContent;
      button.textContent = label || "Memproses…";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.previousLabel || button.textContent;
      button.disabled = false;
    }
  }

    var worshipStorageKey = "mpm:worship-materials:v3";
    var worshipInitialChapters = [
      { id: "iman", title: "Apa itu rukun iman?", content: "Rukun iman adalah enam keyakinan dasar seorang muslim: iman kepada Allah, malaikat, kitab-kitab Allah, para rasul, hari akhir, serta qada dan qadar. Iman bukan sekadar mengetahui, tetapi membenarkan dengan hati, diikrarkan dengan lisan, dan diwujudkan dalam amal.", hadith: "Jibril bertanya kepada Nabi tentang iman. Beliau menjawab: “Engkau beriman kepada Allah, malaikat-malaikat-Nya, kitab-kitab-Nya, rasul-rasul-Nya, hari akhir, dan engkau beriman kepada takdir yang baik maupun yang buruk.” (HR. Muslim, dari Umar bin Khattab; juga dikenal sebagai Hadis Jibril.)", ayat: "QS. Al-Baqarah 2:285 — Āmana ar-rasūlu bimā unzila ilaihi mir rabbihī wal-mu’minūn; kullun āmana billāhi wa malā’ikatihī wa kutubihī wa rusulih. Lā nufarriqu baina aḥadim mir rusulih. — Rasul telah beriman kepada apa yang diturunkan kepadanya dari Tuhannya, demikian pula orang-orang yang beriman. Semua beriman kepada Allah, malaikat-malaikat-Nya, kitab-kitab-Nya, dan rasul-rasul-Nya. (Mereka berkata,) “Kami tidak membeda-bedakan seorang pun dari rasul-rasul-Nya.”", active: true },
      { id: "islam", title: "Rukun Islam", content: "Rukun Islam adalah lima amal utama yang menjadi bangunan lahiriah keislaman: syahadat, sholat, zakat, puasa Ramadan, dan haji bagi yang mampu. Kelimanya saling menguatkan: syahadat menjadi dasar, sholat menjaga hubungan dengan Allah, zakat dan puasa mendidik kepedulian serta ketakwaan, sedangkan haji menyempurnakan bagi yang mampu.", hadith: "Islam dibangun di atas lima perkara: bersaksi bahwa tidak ada sesembahan yang benar selain Allah dan Muhammad adalah utusan Allah, mendirikan sholat, menunaikan zakat, berpuasa Ramadan, dan menunaikan haji. (HR. Bukhari dan Muslim, dari Abdullah bin Umar.)", ayat: "QS. Ali ‘Imran 3:97 — Wa lillāhi ‘alan-nāsi ḥijjul-baiti manistaṭā‘a ilaihi sabīlā. — Dan kewajiban manusia terhadap Allah adalah melaksanakan ibadah haji ke Baitullah, yaitu bagi orang yang mampu mengadakan perjalanan ke sana.", active: true },
      { id: "sholat", title: "Rukun Sholat", content: "Rukun sholat adalah bagian pokok di dalam sholat yang harus dilakukan. Di antaranya niat, berdiri bagi yang mampu, takbiratul ihram, membaca Al-Fatihah, rukuk, bangkit dari rukuk, sujud, duduk di antara dua sujud, tuma’ninah, tasyahud akhir, duduk untuk tasyahud, membaca shalawat, salam, dan tertib. Perincian jumlah rukun dapat berbeda menurut mazhab, sehingga pelajar hendaknya mengikuti bimbingan guru yang dipercaya.", hadith: "Nabi bersabda kepada orang yang sholatnya belum benar: “Kemudian rukuklah hingga kamu tuma’ninah dalam rukuk, kemudian bangkitlah hingga kamu berdiri tegak, kemudian sujudlah hingga kamu tuma’ninah dalam sujud.” (HR. Bukhari dan Muslim, dari Abu Hurairah.)", ayat: "QS. Al-Hajj 22:77 — Yā ayyuhalladzīna āmanur ka‘ū wasjudū wa‘budū rabbakum waf‘alul-khaira la‘allakum tufliḥūn. — Wahai orang-orang yang beriman, rukuklah, sujudlah, sembahlah Tuhanmu, dan berbuatlah kebaikan agar kamu beruntung.", active: true },
      { id: "wajib-sholat", title: "Syarat wajibnya sholat", content: "Syarat wajib sholat menjelaskan kepada siapa kewajiban sholat berlaku: beragama Islam, sudah baligh, berakal, dan telah masuk waktu sholat. Orang yang kehilangan akal tidak dibebani seperti orang yang sadar, sedangkan orang sakit tetap mengerjakan sholat sesuai kemampuannya. Anak-anak dilatih sejak dini agar terbiasa, meskipun kewajiban penuh berlaku setelah baligh.", hadith: "Pena pencatat amal diangkat dari tiga golongan: orang yang tidur sampai ia bangun, anak kecil sampai baligh, dan orang yang kehilangan akal sampai ia sadar. (HR. Abu Dawud, an-Nasa’i, dan Ibnu Majah, dari Ali bin Abi Thalib; dinilai sahih oleh sejumlah ulama.)", ayat: "QS. An-Nisa 4:103 — Innaṣ-ṣalāta kānat ‘alal-mu’minīna kitābam mauqūtā. — Sesungguhnya sholat itu merupakan kewajiban yang waktunya telah ditentukan atas orang-orang yang beriman.", active: true },
      { id: "sah-sholat", title: "Syarat sahnya sholat", content: "Syarat sah sholat adalah hal yang harus terpenuhi sebelum dan ketika sholat agar ibadahnya sah: suci dari hadas dengan wudhu atau mandi, bersih dari najis pada badan-pakaian-tempat, menutup aurat, masuk waktu, menghadap kiblat, dan mengetahui tata cara serta niat sholat. Jika seseorang tidak mampu memenuhi salah satunya karena uzur, syariat memberikan keringanan sesuai keadaan.", hadith: "Allah tidak menerima sholat tanpa bersuci dan tidak menerima sedekah dari harta yang haram. (HR. Muslim, dari Ibnu Umar.)", ayat: "QS. Al-Ma’idah 5:6 — Yā ayyuhalladzīna āmanū idzā qumtum ilaṣ-ṣalāti faghsilū wujūhakum wa aidiyakum ilal-marāfiqi wamsaḥū biru’ūsikum wa arjulakum ilal-ka‘bain. — Wahai orang-orang yang beriman, apabila kamu hendak melaksanakan sholat, maka basuhlah wajahmu dan tanganmu sampai siku, usaplah kepalamu, dan basuhlah kakimu sampai kedua mata kaki.", active: true },
      { id: "praktik-sholat", title: "Praktik sholat dengan ilustrasi", content: "Praktik sholat perlu dipelajari berurutan, tenang, dan dengan tuma’ninah. Ilustrasi berikut membantu mengenali variasi posisi berdiri, takbir, rukuk, sujud, duduk, dan salam. Perbedaan posisi yang ditampilkan dapat mengikuti riwayat dan mazhab yang dipelajari; jadikan guru yang kompeten sebagai rujukan praktik.", hadith: "Sholatlah kalian sebagaimana kalian melihat aku sholat. (HR. Bukhari, dari Malik bin al-Huwairits.)", ayat: "QS. Al-Baqarah 2:238 — Ḥāfiẓū ‘alaṣ-ṣalawāti waṣ-ṣalātil-wusṭā wa qūmū lillāhi qānitīn. — Peliharalah semua sholat dan sholat wustha. Berdirilah karena Allah dengan khusyuk.", active: true, images: true }
    ];
    var worshipImageFiles = [
      "1-berdir-7fd5.png", "2a-takbi-6c33.png", "2b-takbi-a7ba.png", "2c-takbi-f6ea.png", "3a-sedek-1577.png", "3b-sedek-050b.png", "4a-rukuk.png", "4b-rukuk.png", "4c-rukuk.png", "5-i-tida-d848.png", "6-menuju-b94a.png", "6a-menuj-7fc9.png", "7-menuju-b1ba.png", "8a-sujud-10c3.png", "8b-sujud-d303.png", "9-sujud-cd8f.png", "10a-suju-1896.png", "10b-suju-ee70.png", "11a-suju-67e4.png", "11b-suju-7c5e.png", "11c-suju-61f9.png", "11d-suju-2822.png", "12-duduk-a7ac.png", "13a-ifti-cc9f.png", "13b-ifti-e6bd.png", "13c-ifti-078f.png", "13d-ifti-6e0d.png", "13e-ifti-2d7b.png", "14-iftir-3b59.png", "15-tawar-237a.png", "16a-tawa-185a.png", "16b-tawa-1c36.png", "16c-tawa-9968.png", "17a-tawa-2407.png", "17b-tawa-9606.png", "17c-tawa-1fbe.png", "17d-tawa-29f5.png", "18-salam-b8de.png", "19-salam-dd6f.png", "20-salam-18bb.png"
    ];
    var worshipHadithArabic = {
      iman: "أَنْ تُؤْمِنَ بِاللَّهِ، وَمَلَائِكَتِهِ، وَكُتُبِهِ، وَرُسُلِهِ، وَالْيَوْمِ الْآخِرِ، وَتُؤْمِنَ بِالْقَدَرِ خَيْرِهِ وَشَرِّهِ",
      islam: "بُنِيَ الْإِسْلَامُ عَلَى خَمْسٍ: شَهَادَةِ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَنَّ مُحَمَّدًا رَسُولُ اللَّهِ، وَإِقَامِ الصَّلَاةِ، وَإِيتَاءِ الزَّكَاةِ، وَالْحَجِّ، وَصَوْمِ رَمَضَانَ",
      sholat: "ثُمَّ ارْكَعْ حَتَّى تَطْمَئِنَّ رَاكِعًا، ثُمَّ ارْفَعْ حَتَّى تَعْتَدِلَ قَائِمًا، ثُمَّ اسْجُدْ حَتَّى تَطْمَئِنَّ سَاجِدًا",
      "wajib-sholat": "رُفِعَ الْقَلَمُ عَنْ ثَلَاثَةٍ: عَنِ النَّائِمِ حَتَّى يَسْتَيْقِظَ، وَعَنِ الصَّبِيِّ حَتَّى يَحْتَلِمَ، وَعَنِ الْمَجْنُونِ حَتَّى يَعْقِلَ",
      "sah-sholat": "لَا يَقْبَلُ اللَّهُ صَلَاةً بِغَيْرِ طُهُورٍ، وَلَا صَدَقَةً مِنْ غُلُولٍ",
      "praktik-sholat": "صَلُّوا كَمَا رَأَيْتُمُونِي أُصَلِّي"
    };
    var worshipAyatArabic = {
      iman: "آمَنَ الرَّسُولُ بِمَا أُنْزِلَ إِلَيْهِ مِنْ رَبِّهِ وَالْمُؤْمِنُونَ ۚ كُلٌّ آمَنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ ۚ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِنْ رُسُلِهِ",
      islam: "وَلِلَّهِ عَلَى النَّاسِ حِجُّ الْبَيْتِ مَنِ اسْتَطَاعَ إِلَيْهِ سَبِيلًا ۚ وَمَنْ كَفَرَ فَإِنَّ اللَّهَ غَنِيٌّ عَنِ الْعَالَمِينَ",
      sholat: "يَا أَيُّهَا الَّذِينَ آمَنُوا ارْكَعُوا وَاسْجُدُوا وَاعْبُدُوا رَبَّكُمْ وَافْعَلُوا الْخَيْرَ لَعَلَّكُمْ تُفْلِحُونَ",
      "wajib-sholat": "إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا",
      "sah-sholat": "يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا قُمْتُمْ إِلَى الصَّلَاةِ فَاغْسِلُوا وُجُوهَكُمْ وَأَيْدِيَكُمْ إِلَى الْمَرَافِقِ وَامْسَحُوا بِرُءُوسِكُمْ وَأَرْجُلَكُمْ إِلَى الْكَعْبَيْنِ",
      "praktik-sholat": "حَافِظُوا عَلَى الصَّلَوَاتِ وَالصَّلَاةِ الْوُسْطَى وَقُومُوا لِلَّهِ قَانِتِينَ"
    };
    var worshipReadings = [
      { group: "Rukuk", arabic: "سُبْحَانَ رَبِّيَ الْعَظِيمِ", latin: "Subhāna rabbiyal-‘aẓīm.", meaning: "Mahasuci Tuhanku Yang Mahaagung.", source: "HR. Muslim, dari Hudzaifah.", length: 1 },
      { group: "Sujud", arabic: "سُبْحَانَ رَبِّيَ الْأَعْلَى", latin: "Subhāna rabbiyal-a‘lā.", meaning: "Mahasuci Tuhanku Yang Mahatinggi.", source: "HR. Muslim, dari Hudzaifah.", length: 1 },
      { group: "Duduk iftirasy", arabic: "رَبِّ اغْفِرْ لِي", latin: "Rabbighfir lī.", meaning: "Wahai Tuhanku, ampunilah aku.", source: "HR. Abu Dawud dan Ibnu Majah, dari Hudzaifah.", length: 1 },
      { group: "Rukuk", arabic: "سُبْحَانَكَ اللَّهُمَّ رَبَّنَا وَبِحَمْدِكَ، اللَّهُمَّ اغْفِرْ لِي", latin: "Subhānaka allāhumma rabbanā wa biḥamdik, allāhummaghfir lī.", meaning: "Mahasuci Engkau, ya Allah Tuhan kami, dan dengan pujian kepada-Mu; ampunilah aku.", source: "HR. Bukhari dan Muslim, dari Aisyah.", length: 2 },
      { group: "Rukuk", arabic: "سُبُّوحٌ قُدُّوسٌ رَبُّ الْمَلَائِكَةِ وَالرُّوحِ", latin: "Subbūḥun quddūs, rabbul-malā’ikati war-rūḥ.", meaning: "Mahasuci dan Kudus, Tuhan para malaikat dan Jibril.", source: "HR. Muslim, dari Aisyah.", length: 2 },
      { group: "I‘tidal", arabic: "رَبَّنَا وَلَكَ الْحَمْدُ، حَمْدًا كَثِيرًا طَيِّبًا مُبَارَكًا فِيهِ", latin: "Rabbanā wa lakal-ḥamd, ḥamdan kathīran ṭayyiban mubārakan fīh.", meaning: "Wahai Tuhan kami, bagi-Mu segala puji, pujian yang banyak, baik, dan penuh berkah.", source: "HR. Bukhari, dari Rifa‘ah bin Rafi‘.", length: 3 },
      { group: "Sujud", arabic: "اللَّهُمَّ اغْفِرْ لِي ذَنْبِي كُلَّهُ، دِقَّهُ وَجِلَّهُ، وَأَوَّلَهُ وَآخِرَهُ وَعَلَانِيَتَهُ وَسِرَّهُ", latin: "Allāhummaghfir lī dhanbī kullah, diqqahū wa jillah, wa awwalahū wa ākhirah, wa ‘alāniyatahū wa sirrah.", meaning: "Ya Allah, ampunilah seluruh dosaku, yang kecil dan besar, yang awal dan akhir, yang tampak dan tersembunyi.", source: "HR. Muslim, dari Abu Hurairah.", length: 3 },
      { group: "Sujud", arabic: "سُبْحَانَ ذِي الْجَبَرُوتِ وَالْمَلَكُوتِ وَالْكِبْرِيَاءِ وَالْعَظَمَةِ", latin: "Subḥāna dhil-jabarūti wal-malakūti wal-kibriyā’i wal-‘aẓamah.", meaning: "Mahasuci Pemilik keperkasaan, kerajaan, kebesaran, dan keagungan.", source: "HR. Abu Dawud dan an-Nasa’i, dari Auf bin Malik.", length: 3 },
      { group: "Duduk iftirasy", arabic: "اللَّهُمَّ اغْفِرْ لِي، وَارْحَمْنِي، وَعَافِنِي، وَاهْدِنِي، وَارْزُقْنِي", latin: "Allāhummaghfir lī, warḥamnī, wa ‘āfinī, wahdinī, warzuqnī.", meaning: "Ya Allah, ampunilah aku, rahmatilah aku, sehatkanlah aku, berilah aku petunjuk, dan rezekilah aku.", source: "HR. Abu Dawud, dari Ibnu Abbas.", length: 3 },
      { group: "Duduk iftirasy", arabic: "رَبِّ اغْفِرْ لِي، رَبِّ اغْفِرْ لِي", latin: "Rabbighfir lī, rabbighfir lī.", meaning: "Wahai Tuhanku, ampunilah aku; wahai Tuhanku, ampunilah aku.", source: "HR. Abu Dawud, dari Hudzaifah.", length: 2 },
      { group: "Iftitah", arabic: "اللَّهُ أَكْبَرُ كَبِيرًا، وَالْحَمْدُ لِلَّهِ كَثِيرًا، وَسُبْحَانَ اللَّهِ بُكْرَةً وَأَصِيلًا", latin: "Allāhu akbaru kabīrā, wal-ḥamdu lillāhi kathīrā, wa subḥānallāhi bukratan wa aṣīlā.", meaning: "Allah Mahabesar dengan sebesar-besarnya; segala puji bagi Allah sebanyak-banyaknya; Mahasuci Allah pagi dan petang.", source: "HR. Muslim, dari Ibnu Umar.", length: 4 },
      { group: "Iftitah", arabic: "اللَّهُمَّ بَاعِدْ بَيْنِي وَبَيْنَ خَطَايَايَ كَمَا بَاعَدْتَ بَيْنَ الْمَشْرِقِ وَالْمَغْرِبِ، اللَّهُمَّ نَقِّنِي مِنْ خَطَايَايَ كَمَا نَقَّيْتَ الثَّوْبَ الْأَبْيَضَ مِنَ الدَّنَسِ، اللَّهُمَّ اغْسِلْنِي مِنْ خَطَايَايَ بِالثَّلْجِ وَالْمَاءِ وَالْبَرَدِ", latin: "Allāhumma bā‘id bainī wa baina khaṭāyāya kamā bā‘adta bainal-masyriqi wal-maghrib. Allāhumma naqqinī min khaṭāyāya kamā naqqaitats-tsaubal-abyaḍa minad-danas. Allāhummaghsilnī min khaṭāyāya bits-tsalji wal-mā’i wal-barad.", meaning: "Ya Allah, jauhkanlah aku dari kesalahan-kesalahanku sebagaimana Engkau menjauhkan timur dan barat; bersihkanlah aku dari kesalahan seperti kain putih dibersihkan dari noda; cucilah kesalahanku dengan salju, air, dan embun.", source: "HR. Bukhari dan Muslim, dari Abu Hurairah.", length: 6 },
      { group: "Iftitah", arabic: "وَجَّهْتُ وَجْهِيَ لِلَّذِي فَطَرَ السَّمَاوَاتِ وَالْأَرْضَ حَنِيفًا وَمَا أَنَا مِنَ الْمُشْرِكِينَ، إِنَّ صَلَاتِي وَنُسُكِي وَمَحْيَايَ وَمَمَاتِي لِلَّهِ رَبِّ الْعَالَمِينَ، لَا شَرِيكَ لَهُ وَبِذَلِكَ أُمِرْتُ وَأَنَا مِنَ الْمُسْلِمِينَ", latin: "Wajjahtu wajhiya lilladzī faṭaras-samāwāti wal-arḍa ḥanīfan wa mā ana minal-musyrikīn. Inna ṣalātī wa nusukī wa maḥyāya wa mamātī lillāhi rabbil-‘ālamīn, lā syarīka lahū wa bidzālika umirtu wa ana minal-muslimīn.", meaning: "Aku hadapkan wajahku kepada Dia yang menciptakan langit dan bumi dengan lurus, dan aku bukan termasuk orang musyrik. Sesungguhnya sholatku, ibadahku, hidupku dan matiku hanya untuk Allah, Tuhan seluruh alam; tiada sekutu bagi-Nya. Demikianlah aku diperintah dan aku termasuk orang muslim.", source: "HR. Muslim, dari Ali bin Abu Thalib.", length: 5 },
      { group: "Tasyahud", arabic: "التَّحِيَّاتُ لِلَّهِ، وَالصَّلَوَاتُ وَالطَّيِّبَاتُ، السَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ، السَّلَامُ عَلَيْنَا وَعَلَى عِبَادِ اللَّهِ الصَّالِحِينَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ", latin: "At-taḥiyyātu lillāhi wash-shalawātu wath-thayyibāt, as-salāmu ‘alaika ayyuhan-nabiyyu wa raḥmatullāhi wa barakātuh...", meaning: "Segala penghormatan, sholat, dan kebaikan adalah milik Allah. Semoga keselamatan, rahmat Allah, dan berkah-Nya tercurah kepadamu wahai Nabi. Semoga keselamatan tercurah kepada kami dan hamba-hamba Allah yang saleh. Aku bersaksi bahwa tiada sesembahan yang benar selain Allah dan Muhammad adalah hamba serta utusan-Nya.", source: "HR. Bukhari dan Muslim, dari Ibnu Mas‘ud.", length: 6 },
      { group: "Tasyahud", arabic: "التَّحِيَّاتُ الْمُبَارَكَاتُ الصَّلَوَاتُ الطَّيِّبَاتُ لِلَّهِ، السَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ، السَّلَامُ عَلَيْنَا وَعَلَى عِبَادِ اللَّهِ الصَّالِحِينَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ اللَّهِ", latin: "At-taḥiyyātul-mubārakātuṣ-ṣalawātuṭ-ṭayyibātu lillāh...", meaning: "Segala penghormatan, keberkahan, sholat, dan kebaikan adalah milik Allah... aku bersaksi bahwa Muhammad adalah utusan Allah.", source: "HR. Muslim, dari Ibnu Abbas.", length: 7 }
    ];
    var worshipMovementNotes = {
      "1-berdir-7fd5.png": "Berdiri tegak menghadap kiblat, kaki tidak terlalu lebar, pandangan ke tempat sujud, dan hadirkan niat.",
      "2a-takbi-6c33.png": "Ujung jari sejajar wajah/bahu ketika mengangkat tangan. Malik bin al-Huwairits meriwayatkan Nabi mengangkat tangan hingga sejajar kedua bahu (HR. Muslim).",
      "2b-takbi-a7ba.png": "Posisi ujung jari sejajar bagian atas telinga. Ibn Umar meriwayatkan Nabi mengangkat tangan hingga sejajar telinga (HR. Bukhari dan Muslim).",
      "2c-takbi-f6ea.png": "Posisi tangan sejajar bahu/dada. Malik bin al-Huwairits meriwayatkan Nabi mengangkat tangan hingga sejajar kedua bahu (HR. Muslim).",
      "4a-rukuk.png": "Bungkukkan badan hingga punggung rata, kepala sejajar punggung, dan kedua tangan memegang lutut.",
      "5-i-tida-d848.png": "Bangkit dari rukuk sampai berdiri tegak dan tuma’ninah sebelum turun menuju sujud.",
      "12-duduk-a7ac.png": "Duduk iftirasy dengan tenang di antara dua sujud, lalu baca doa dan tuma’ninah.",
      "15-tawar-237a.png": "Duduk tawarruk pada tasyahud akhir sesuai tuntunan. Duduk iftirasy juga dikenal dalam sebagian riwayat dan menjadi pilihan yang dibolehkan ketika ada kebutuhan atau mengikuti mazhab.",
      "18-salam-b8de.png": "Menoleh ke kanan ketika salam pertama dengan tetap menjaga ketenangan.",
      "20-salam-18bb.png": "Menoleh ke kiri ketika salam kedua untuk mengakhiri sholat."
    };
    var worshipMovementEvidence = {
      standing: "Dalil: فَصَلِّ قَائِمًا — “Sholatlah dengan berdiri.” Nabi menyampaikan ini kepada Imran bin Husain; jika tidak mampu, maka duduk (HR. Bukhari). Menghadap kiblat diperintahkan dalam QS. Al-Baqarah 2:144.",
      takbir: "Dalil: Ibn Umar melihat Nabi mengangkat kedua tangan sejajar bahu ketika memulai sholat dan mengucapkan takbir (HR. Bukhari dan Muslim). Riwayat lain menyebut sejajar telinga (HR. Bukhari dan Muslim).",
      sedekap: "Dalil: Sahl bin Sa‘ad meriwayatkan para sahabat diperintahkan meletakkan tangan kanan di atas lengan kiri dalam sholat (HR. Bukhari). Perbedaan letak di dada atau bawah pusar dibahas dalam riwayat dan praktik ulama.",
      rukuk: "Dalil: Nabi bersabda kepada orang yang salah sholatnya, ثم اركع حتى تطمئن راكعًا — “Kemudian rukuklah sampai tuma’ninah dalam rukuk.” (HR. Bukhari dan Muslim, dari Abu Hurairah).",
      itidal: "Dalil: ثم ارفع حتى تعتدل قائمًا — “Kemudian bangkitlah sampai berdiri tegak.” (HR. Bukhari dan Muslim, dari Abu Hurairah). Nabi juga mengangkat tangan ketika bangkit dari rukuk (HR. Bukhari dan Muslim).",
      turun: "Dalil: Nabi memerintahkan setiap anggota badan diletakkan pada tempatnya dengan tuma’ninah sebelum berpindah (HR. Bukhari dan Muslim, dari Abu Hurairah). Riwayat tentang lutut atau tangan lebih dahulu merupakan bahasan khilafiyah.",
      sujud: "Dalil: Nabi memerintahkan sujud di atas tujuh anggota: dahi dan hidung, dua tangan, dua lutut, dan ujung dua kaki (HR. Bukhari dan Muslim, dari Ibn Abbas).",
      duduk: "Dalil: Nabi mengajarkan duduk di antara dua sujud dengan tuma’ninah dan membaca doa (HR. Bukhari dan Muslim, dari Abu Hurairah).",
      tasyahudAwal: "Dalil: Ibn Mas‘ud meriwayatkan Nabi mengajarkan tasyahud dan duduk pada rakaat kedua (HR. Bukhari dan Muslim).",
      tasyahudAkhir: "Dalil: Abu Humaid as-Sa‘idi menjelaskan Nabi duduk iftirasy pada tasyahud awal dan tawarruk pada rakaat terakhir (HR. Abu Dawud dan Tirmidzi). Duduk iftirasy juga memiliki riwayat pada kondisi tertentu, sehingga keduanya dijelaskan dalam fikih.",
      salam: "Dalil: Nabi mengakhiri sholat dengan salam ke kanan dan ke kiri sampai terlihat putih pipinya (HR. Abu Dawud dan Tirmidzi, dari Sa‘d bin Abi Waqqash)."
    };
    function movementEvidence(file) { file=MpmBuildOriginal(file);
      if (file.indexOf("1_") === 0) return worshipMovementEvidence.standing;
      if (file.indexOf("2") === 0) return worshipMovementEvidence.takbir;
      if (file.indexOf("3") === 0) return worshipMovementEvidence.sedekap;
      if (file.indexOf("4") === 0) return worshipMovementEvidence.rukuk;
      if (file.indexOf("5_") === 0) return worshipMovementEvidence.itidal;
      if (file.indexOf("6") === 0 || file.indexOf("7_") === 0) return worshipMovementEvidence.turun;
      if (file.indexOf("8") === 0 || file.indexOf("9_") === 0 || file.indexOf("10") === 0 || file.indexOf("11") === 0) return worshipMovementEvidence.sujud;
      if (file.indexOf("12_") === 0 || file.indexOf("13") === 0) return worshipMovementEvidence.duduk;
      if (file.indexOf("14_") === 0) return worshipMovementEvidence.tasyahudAwal;
      if (file.indexOf("15_") === 0 || file.indexOf("16") === 0 || file.indexOf("17") === 0) return worshipMovementEvidence.tasyahudAkhir;
      return worshipMovementEvidence.salam;
    }
    function movementQuranHtml(file) { file=MpmBuildOriginal(file);
      if (file.indexOf("1_") !== 0) return "";
      return "<div class=\"it-worship-quran-evidence\"><b>Dalil Al-Qur’an — menghadap kiblat:</b><p class=\"it-worship-ayat-arabic\" lang=\"ar\" dir=\"rtl\">فَوَلِّ وَجْهَكَ شَطْرَ الْمَسْجِدِ الْحَرَامِ ۚ وَحَيْثُ مَا كُنْتُمْ فَوَلُّوا وُجُوهَكُمْ شَطْرَهُ</p><p><b>Latin:</b> Fa walli wajhaka syathral-masjidil-ḥarām; wa ḥaitsu mā kuntum fa wallū wujūhakum syathrah.</p><p><b>Arti:</b> Maka palingkanlah wajahmu ke arah Masjidilharam. Di mana pun kamu berada, palingkanlah wajahmu ke arahnya.</p><small>QS. Al-Baqarah 2:144</small></div>";
    }
    function movementReadingHtml(file) { file=MpmBuildOriginal(file);
      var readings = [];
      if (file.indexOf("2") === 0) readings = [{ group: "Takbiratul ihram", arabic: "اللَّهُ أَكْبَرُ", latin: "Allāhu akbar.", meaning: "Allah Mahabesar.", source: "HR. Bukhari dan Muslim, dari Abu Hurairah.", length: 1 }];
      else if (file.indexOf("3") === 0) readings = worshipReadings.filter(function (item) { return item.group === "Iftitah"; }).slice(0, 1);
      else if (file.indexOf("4") === 0) readings = worshipReadings.filter(function (item) { return item.group === "Rukuk"; }).slice(0, 1);
      else if (file.indexOf("5") === 0) readings = [{ group: "I‘tidal", arabic: "سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ، رَبَّنَا وَلَكَ الْحَمْدُ", latin: "Sami‘allāhu liman hamidah, rabbanā wa lakal-hamd.", meaning: "Allah mendengar orang yang memuji-Nya; wahai Tuhan kami, bagi-Mu segala puji.", source: "HR. Bukhari dan Muslim.", length: 2 }];
      else if (file.indexOf("8") === 0 || file.indexOf("9") === 0 || file.indexOf("10") === 0 || file.indexOf("11") === 0) readings = worshipReadings.filter(function (item) { return item.group === "Sujud"; }).slice(0, 1);
      else if (file.indexOf("12") === 0 || file.indexOf("13") === 0) readings = worshipReadings.filter(function (item) { return item.group === "Duduk iftirasy"; }).slice(0, 1);
      else if (file.indexOf("14") === 0 || file.indexOf("15") === 0 || file.indexOf("16") === 0 || file.indexOf("17") === 0) readings = worshipReadings.filter(function (item) { return item.group === "Tasyahud"; });
      else if (file.indexOf("18") === 0 || file.indexOf("19") === 0 || file.indexOf("20") === 0) readings = [{ group: "Salam", arabic: "السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ", latin: "As-salāmu ‘alaikum wa raḥmatullāh.", meaning: "Semoga keselamatan dan rahmat Allah tercurah kepada kalian.", source: "HR. Muslim, dari Jabir bin Samurah.", length: 1 }];
      else if (file.indexOf("1_") === 0) readings = [{ group: "Niat", arabic: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ", latin: "Innamal-a‘mālu bin-niyyāt.", meaning: "Sesungguhnya amal bergantung pada niat.", source: "HR. Bukhari dan Muslim, dari Umar bin Khattab.", length: 1 }];
      else readings = [{ group: "Takbir perpindahan", arabic: "اللَّهُ أَكْبَرُ", latin: "Allāhu akbar.", meaning: "Allah Mahabesar.", source: "HR. Bukhari dan Muslim, dari Abu Hurairah.", length: 1 }];
      return readings.map(function (reading) { return "<div class=\"it-worship-inline-reading\"><b>" + e(reading.group) + ":</b><p class=\"it-worship-hadith-arabic\" lang=\"ar\" dir=\"rtl\">" + e(reading.arabic) + "</p><p><b>Latin:</b> " + e(reading.latin) + "<br><b>Arti:</b> " + e(reading.meaning) + "</p><small>" + e(reading.source) + "</small></div>"; }).join("");
    }
    function movementReadingCard(file) {
      var html = movementReadingHtml(file);
      return html ? "<article class=\"it-worship-slide it-worship-reading-slide\"><h4>" + e(worshipLabel(file) + " · bacaan") + "</h4>" + html + "</article>" : "";
    }
    var worshipSelectedId = "";
    var worshipPracticeSlide = 0;
    var worshipCustomImages = [];
    try { worshipCustomImages = JSON.parse(localStorage.getItem("mpm:worship-images:v1") || "[]"); } catch (error) { worshipCustomImages = []; }
    function worshipSaveImages() { localStorage.setItem("mpm:worship-images:v1", JSON.stringify(worshipCustomImages)); }
    function worshipLoad() {
      try { var saved = JSON.parse(localStorage.getItem(worshipStorageKey) || "null"); if (Array.isArray(saved) && saved.length) return saved; } catch (error) {}
      return worshipInitialChapters.map(function (row) { return Object.assign({}, row); });
    }
    function worshipSave(rows) { localStorage.setItem(worshipStorageKey, JSON.stringify(rows)); }
    function worshipSorted(rows) { return rows.filter(function (row) { return row.active !== false; }); }
    function worshipLabel(file) { return MpmBuildOriginal(file).replace(/\.png$/i, "").replace(/^\d+[a-z]?_/, "").replace(/_/g, " ").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim(); }
    function worshipLanguage(row){return row.language === "en" ? "en" : "id";}
    function worshipChapterTitle(row){return row.title + " [" + (worshipLanguage(row)==="en"?"English":"Bahasa Indonesia") + "]";}
    function renderWorship() {
      var rows = worshipLoad(), list = byId("worshipChapterList"), nav = byId("worshipChapterNav"), visible = worshipSorted(rows);
      nav.replaceChildren();
      var preferred=document.documentElement.lang==="en"?"en":"id";
      [preferred,preferred==="en"?"id":"en"].forEach(function(language){
        var choices=visible.filter(function(row){return worshipLanguage(row)===language;});if(!choices.length)return;
        var group=document.createElement("optgroup");group.label=language==="en"?"English":"Bahasa Indonesia";
        choices.forEach(function(row){var choice=new Option(worshipChapterTitle(row),row.id);choice.setAttribute("translate","no");group.appendChild(choice);});nav.appendChild(group);
      });
      nav.disabled = !visible.length;
      if (!visible.length) {
        nav.add(new Option(window.PrayerI18n.uiText("Belum ada sub-bab aktif."), ""));
        byId("worshipChapterContent").textContent = window.PrayerI18n.uiText("Belum ada sub-bab aktif.");
        worshipSelectedId = ""; worshipPracticeSlide = 0;
        updateWorshipPagination(0);
      }
      list.innerHTML = rows.length ? rows.map(function (row) {
        return "<article class=\"it-worship-chapter\" data-worship-id=\"" + e(row.id) + "\"><div><h4>" + e(worshipChapterTitle(row)) + "</h4><small>" + e(row.active === false ? "Disembunyikan" : "Aktif") + "</small></div><div class=\"it-worship-chapter-actions\"><button class=\"it-button small\" type=\"button\" data-worship-edit=\"" + e(row.id) + "\">Edit</button><button class=\"it-button small danger\" type=\"button\" data-worship-delete=\"" + e(row.id) + "\">Hapus</button></div></article>";
      }).join("") : "<div class=\"it-empty\">Belum ada sub-bab aktif.</div>";
      list.querySelectorAll("[data-worship-id]").forEach(function(card){
        [-1,1].forEach(function(delta){var button=document.createElement("button");button.type="button";button.className="it-button small";button.dataset.worshipMove=delta;button.dataset.id=card.dataset.worshipId;button.textContent=delta<0?"\u2191":"\u2193";button.setAttribute("aria-label",document.documentElement.lang==="en"?(delta<0?"Move up":"Move down"):(delta<0?"Geser ke atas":"Geser ke bawah"));card.querySelector(".it-worship-chapter-actions").appendChild(button);});
      });
      var selected = visible.find(function (row) { return row.id === worshipSelectedId; }) || visible.find(function(row){return worshipLanguage(row)===preferred;}) || visible[0]; if (selected) showWorshipChapter(selected.id);
      byId("worshipImageChapter").innerHTML = rows.map(function (row) { return option(row.id, row.title); }).join("");
      byId("worshipCustomImageList").innerHTML = worshipCustomImages.map(function (image) { return "<article class=\"it-worship-chapter\"><div><h4>" + e(image.title) + "</h4><small>" + e(image.path) + "</small></div><div class=\"it-worship-chapter-actions\"><button class=\"it-button small\" type=\"button\" data-worship-image-edit=\"" + e(image.id) + "\">Edit</button><button class=\"it-button small danger\" type=\"button\" data-worship-image-delete=\"" + e(image.id) + "\">Hapus</button></div></article>"; }).join("");
    }
    function showWorshipChapter(id) {
      var row = worshipLoad().find(function (item) { return item.id === id; }), target = byId("worshipChapterContent");
      if (!row || row.active === false) return;
      if (worshipSelectedId !== id) worshipPracticeSlide = 0;
      worshipSelectedId = id;
      var language=worshipLanguage(row), english=document.documentElement.lang==="en";
      target.lang=language;
      byId("worshipContentLanguage").textContent=(english?"Content language: ":"Bahasa materi: ")+(language==="en"?"English":"Bahasa Indonesia")+(language!==(english?"en":"id")?(english?". This material is available in Indonesian; an English version has not been selected.":". Materi ini berbahasa Inggris; versi Indonesia belum dipilih."):"");
      document.querySelectorAll(".it-worship-chapter").forEach(function (node) { node.classList.toggle("selected", node.dataset.worshipId === id); });
      var customImages = worshipCustomImages.filter(function (image) { return image.chapterId === row.id; });
      var movementCards = worshipImageFiles.map(function (file) {
        return { file: file, card: "<article class=\"it-worship-slide\"><h4>" + e(worshipLabel(file)) + "</h4><img loading=\"lazy\" src=\"assets/images/prayer/d5de0ac/" + encodeURI(file) + "\" alt=\"" + e(worshipLabel(file)) + "\"><p>" + e(worshipMovementNotes[file] || "Lakukan variasi gerakan ini dengan tenang dan tuma’ninah sesuai tuntunan yang dipelajari.") + "</p><small>" + e(movementEvidence(file)) + "</small>" + movementQuranHtml(file) + "</article>" };
      }).concat(customImages.map(function (image) {
        return { file: "", card: "<article class=\"it-worship-slide\"><h4>" + e(image.title) + "</h4><img loading=\"lazy\" src=\"" + e(image.path) + "\" alt=\"" + e(image.title) + "\"><p>" + e(image.note || "Lakukan variasi gerakan ini dengan tenang dan tuma’ninah sesuai tuntunan yang dipelajari.") + "</p><small>" + e("Dalil gerakan mengikuti riwayat dan penjelasan yang dicatat pada materi ini; tambahkan sumber khusus melalui kolom penjelasan CRUD.") + "</small></article>" };
      }));
      function readingCard(reading) {
        return "<article class=\"it-worship-slide it-worship-reading-slide\"><h4>" + e(reading.group + " · bacaan") + "</h4><p class=\"it-worship-hadith-arabic\" lang=\"ar\" dir=\"rtl\">" + e(reading.arabic) + "</p><p><b>Latin:</b> " + e(reading.latin) + "<br><b>Arti:</b> " + e(reading.meaning) + "</p><small>" + e(reading.source) + "</small></article>";
      }
      var orderedSlides = [
        "<article class=\"it-worship-slide it-worship-slide-intro\"><h4>Praktik sholat dengan ilustrasi</h4><p>" + e(row.content) + "</p><p>Pelajari sholat secara berurutan, tenang, dan khusyuk. Gunakan tombol atau keyboard untuk berpindah slide.</p></article>",
        "<article class=\"it-worship-slide it-worship-slide-intro\"><h4>Persiapan dan urutan gerakan</h4><p class=\"it-worship-copy\">Pastikan badan, pakaian, dan tempat suci; tutup aurat; sudah berwudhu; masuk waktu; menghadap kiblat; dan niat. Berdirilah seimbang dengan jarak kaki wajar dan lakukan setiap perpindahan dengan tuma’ninah.</p></article>"
      ];
      var standing = movementCards.shift(), takbir = movementCards.splice(0, 3), sedekap = movementCards.splice(0, 2);
      function appendMovement(items) { items.forEach(function (item) { orderedSlides.push(item.card); if (item.file) orderedSlides.push(movementReadingCard(item.file)); }); }
      appendMovement([standing]);
      orderedSlides.push("<article class=\"it-worship-slide\"><h4>Niat sholat</h4><p>Niat adalah kehendak beribadah yang tempatnya di dalam hati (qalbiyyah), bersamaan dengan permulaan sholat. Melafalkan niat (qauliyyah) boleh dilakukan sebagai bantuan, tetapi bukan syarat sah tersendiri.</p><small>Dalil: “Sesungguhnya amal itu tergantung niatnya.” (HR. Bukhari dan Muslim, dari Umar bin Khattab.)</small></article>");
      orderedSlides.push("<article class=\"it-worship-slide\"><h4>Mukadimah takbiratul ihram</h4><p>Takbiratul ihram adalah rukun sholat berupa ucapan “Allahu akbar” yang mengawali sholat dan mengharamkan aktivitas di luar sholat. Lafaznya diucapkan jelas: الله أكبر (Allāhu akbar). Riwayat-riwayat menggambarkan mengangkat tangan bersamaan dengan takbir; sebagian lafaz menunjukkan mengangkat tangan lebih dahulu atau sesudahnya. Semua dilakukan dengan tenang dan tidak mendahului takbir secara berlebihan.</p><p class=\"it-worship-hadith-arabic\" lang=\"ar\" dir=\"rtl\">تَحْرِيمُهَا التَّكْبِيرُ، وَتَحْلِيلُهَا التَّسْلِيمُ</p><small>“Pengharam sholat adalah takbir dan penghalalnya adalah salam.” (HR. Abu Dawud, Tirmidzi, dan Ibnu Majah, dari Ali.) Ibn Umar juga meriwayatkan Nabi mengangkat kedua tangan ketika memulai sholat (HR. Bukhari dan Muslim).</small></article>");
      appendMovement(takbir);
      orderedSlides.push("<article class=\"it-worship-slide\"><h4>Sedekap</h4><p>Setelah takbiratul ihram, berdiri dengan tenang dan meletakkan tangan kanan di atas tangan kiri. Posisi tangan di dada atau di bawah pusar memiliki riwayat dan praktik mazhab yang berbeda; ikuti guru yang dipercaya.</p><small>Dalil: Sahl bin Sa‘ad meriwayatkan bahwa orang-orang diperintahkan meletakkan tangan kanan di atas lengan kiri dalam sholat (HR. Bukhari).</small></article>");
      appendMovement(sedekap);
      orderedSlides.push("<article class=\"it-worship-slide it-worship-reading-slide\"><h4>Doa iftitah: pengantar</h4><p>Doa iftitah dibaca setelah takbiratul ihram dan sebelum Al-Fatihah. Hukumnya sunnah, sehingga sholat tetap sah jika ditinggalkan. Berikut beberapa riwayat doa iftitah; masing-masing dibaca sebagai satu kesatuan, bukan dicampur.</p><small>Dalil: Nabi mengajarkan beberapa lafaz iftitah kepada para sahabat (HR. Bukhari dan Muslim).</small></article>");
      orderedSlides = orderedSlides.concat(worshipReadings.filter(function (reading) { return reading.group === "Iftitah"; }).sort(function (a, b) { return a.length - b.length; }).map(readingCard));
      orderedSlides.push("<article class=\"it-worship-slide it-worship-reading-slide\"><h4>Surah Al-Fatihah</h4><p>Al-Fatihah dibaca setelah doa iftitah dan ta‘awwudz.</p><p class=\"it-worship-hadith-arabic\" lang=\"ar\" dir=\"rtl\">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ ۝ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ۝ الرَّحْمَنِ الرَّحِيمِ ۝ مَالِكِ يَوْمِ الدِّينِ ۝ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ ۝ اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ ۝ صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ</p><p><b>Latin:</b> Bismillāhir-raḥmānir-raḥīm. Al-ḥamdu lillāhi rabbil-‘ālamīn. Ar-raḥmānir-raḥīm. Māliki yaumid-dīn. Iyyāka na‘budu wa iyyāka nasta‘īn. Ihdinaṣ-ṣirāṭal-mustaqīm. Ṣirāṭallażīna an‘amta ‘alaihim gairil-magḍūbi ‘alaihim wa laḍ-ḍāllīn.</p><p><b>Arti:</b> Dengan nama Allah Yang Maha Pengasih, Maha Penyayang. Segala puji bagi Allah, Tuhan seluruh alam. Yang Maha Pengasih, Maha Penyayang. Pemilik hari pembalasan. Hanya kepada-Mu kami menyembah dan hanya kepada-Mu kami memohon pertolongan. Tunjukilah kami jalan yang lurus, yaitu jalan orang-orang yang telah Engkau beri nikmat; bukan jalan mereka yang dimurkai dan bukan pula jalan mereka yang sesat.</p><small>QS. Al-Fatihah 1:1–7</small></article>");
      orderedSlides.push("<article class=\"it-worship-slide\"><h4>Bacaan Al-Fatihah dan kondisi tidak mampu</h4><p>Al-Fatihah dibaca setelah doa iftitah dan ta‘awwudz. Nabi bersabda:</p><p class=\"it-worship-hadith-arabic\" lang=\"ar\" dir=\"rtl\">لَا صَلَاةَ لِمَنْ لَمْ يَقْرَأْ بِفَاتِحَةِ الْكِتَابِ</p><p><b>Latin:</b> Lā ṣalāta liman lam yaqra’ bifātiḥatil-kitāb.</p><p><b>Arti:</b> Tidak ada sholat bagi orang yang tidak membaca Fatihatul Kitab. (HR. Bukhari dan Muslim).</p><p>Bagi orang yang belum mampu membaca Al-Fatihah dan tidak dapat belajar saat itu, bacalah ayat yang mudah. Jika tidak mampu membaca ayat sama sekali, bertasbih, bertahmid, bertakbir, dan bertahlil sesuai kemampuan.</p><p class=\"it-worship-ayat-arabic\" lang=\"ar\" dir=\"rtl\">فَاقْرَءُوا مَا تَيَسَّرَ مِنَ الْقُرْآنِ</p><p><b>Latin:</b> Faqra’ū mā tayassara minal-qur’ān.</p><p><b>Arti:</b> Maka bacalah apa yang mudah dari Al-Qur’an. (QS. Al-Muzzammil 73:20).</p><small>Rukhsah pengganti bagi yang benar-benar tidak mampu: tasbih, tahmid, takbir, dan tahlil (HR. Abu Dawud dan Tirmidzi, dari Rifa‘ah bin Rafi‘).</small></article>");
      orderedSlides.push(readingCard({ group: "Pengganti Al-Fatihah", arabic: "سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", latin: "Subḥānallāh, wal-ḥamdu lillāh, wa lā ilāha illallāh, wallāhu akbar, wa lā ḥaula wa lā quwwata illā billāh.", meaning: "Mahasuci Allah, segala puji bagi Allah, tiada sesembahan selain Allah, Allah Mahabesar, dan tiada daya serta kekuatan kecuali dengan Allah.", source: "Bacaan pengganti bagi yang tidak mampu membaca Al-Qur’an; HR. Abu Dawud dan Tirmidzi, dari Rifa‘ah bin Rafi‘.", length: 5 }));
      orderedSlides.push("<article class=\"it-worship-slide it-worship-reading-slide\"><h4>Variasi bacaan gerakan</h4><p>Setiap bacaan berikut dibaca sebagai satu kesatuan sesuai riwayatnya. Pilih salah satu riwayat yang dipelajari, jangan mencampur potongan dari beberapa lafaz.</p></article>");
      ["Iftitah", "Rukuk", "I‘tidal", "Sujud", "Duduk iftirasy"].forEach(function (group) {
        worshipReadings.filter(function (reading) { return reading.group === group; }).sort(function (a, b) { return a.length - b.length; }).forEach(function (reading) { orderedSlides.push(readingCard(reading)); });
      });
      var transitionSource = "assets/images/prayer/d5de0ac/2a-takbi-6c33.png";
      orderedSlides.push("<article class=\"it-worship-slide\"><h4>Takbir intiqal menuju rukuk</h4><img loading=\"lazy\" src=\"" + transitionSource + "\" alt=\"Takbir intiqal\"><p>Ketika turun menuju rukuk, ucapkan Allahu akbar. Sebagian riwayat juga menunjukkan mengangkat kedua tangan sebelum rukuk; ilustrasi digunakan ulang karena gerakannya sama dengan raf‘ul yadain.</p><small>Ibn Umar meriwayatkan Nabi mengangkat tangan ketika hendak rukuk (HR. Bukhari dan Muslim).</small></article>");
      orderedSlides.push(readingCard({ group: "Takbir intiqal", arabic: "اللَّهُ أَكْبَرُ", latin: "Allāhu akbar.", meaning: "Allah Mahabesar.", source: "HR. Bukhari dan Muslim, dari Ibn Umar.", length: 1 }));
      var rukukCards = movementCards.splice(0, 3), itidalCard = movementCards.shift();
      appendMovement(rukukCards);
      orderedSlides.push("<article class=\"it-worship-slide\"><h4>Takbir intiqal ketika i‘tidal</h4><img loading=\"lazy\" src=\"" + transitionSource + "\" alt=\"Raf ul yadain saat i'tidal\"><p>Saat bangkit dari rukuk, ucapkan sami‘allahu liman hamidah. Sebagian riwayat menunjukkan raf‘ul yadain ketika bangkit; ilustrasi yang sama digunakan ulang.</p><small>Ibn Umar meriwayatkan Nabi mengangkat tangan ketika bangkit dari rukuk (HR. Bukhari dan Muslim).</small></article>");
      orderedSlides.push(readingCard({ group: "I‘tidal", arabic: "سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ، رَبَّنَا وَلَكَ الْحَمْدُ", latin: "Sami‘allāhu liman hamidah, rabbanā wa lakal-hamd.", meaning: "Allah mendengar orang yang memuji-Nya; bagi-Mu segala puji.", source: "HR. Bukhari dan Muslim.", length: 2 }));
      appendMovement([itidalCard]);
      appendMovement(movementCards);
      var images = row.images ? "<section class=\"it-worship-practice-slides\">" + orderedSlides.join("") + "</section>" : "";
      var pos = worshipSorted(worshipLoad()).findIndex(function (item) { return item.id === id; });
      var sourceHtml = "<section class=\"it-worship-source\"><h4>Riwayat hadis</h4>" + (worshipHadithArabic[row.id] ? "<p class=\"it-worship-hadith-arabic\" lang=\"ar\" dir=\"rtl\">" + e(worshipHadithArabic[row.id]) + "</p>" : "") + "<p>" + e(row.hadith || "Belum ada riwayat hadis.") + "</p><h4>Dalil Al-Qur’an</h4><p class=\"it-worship-ayat-arabic\" lang=\"ar\" dir=\"rtl\">" + e(worshipAyatArabic[row.id] || "لم يحدد بعد") + "</p><p>" + e(row.ayat || "Belum ada dalil ayat.") + "</p></section>";
      target.innerHTML = row.images ? images : "<h3>" + e(row.title) + "</h3><div class=\"it-worship-copy\">" + e(row.content) + "</div>" + sourceHtml;
      byId("worshipChapterNav").value = id;
      var slides = target.querySelectorAll(".it-worship-practice-slides > article");
      var count = row.images ? slides.length : 1;
      worshipPracticeSlide = Math.max(0, Math.min(count - 1, worshipPracticeSlide));
      slides.forEach(function (slide, index) { slide.hidden = index !== worshipPracticeSlide; });
      updateWorshipPagination(count);
      window.dispatchEvent(new CustomEvent("mpm:worship-selection", {detail:{chapter:id, page:worshipPracticeSlide + 1}}));
    }
    function updateWorshipPagination(count) {
      var previous = byId("worshipPreviousButton"), next = byId("worshipNextButton");
      previous.hidden = next.hidden = count <= 1;
      previous.disabled = worshipPracticeSlide <= 0;
      next.disabled = worshipPracticeSlide >= count - 1;
      byId("worshipSlidePosition").textContent = count ? (document.documentElement.lang === "en" ? "Page " : "Halaman ") + (worshipPracticeSlide + 1) + " / " + count : "";
    }
    function moveWorshipPage(delta) {
      var count = byId("worshipChapterContent").querySelectorAll(".it-worship-practice-slides > article").length;
      if (count <= 1) return;
      var next = Math.max(0, Math.min(count - 1, worshipPracticeSlide + delta));
      if (next === worshipPracticeSlide) return;
      worshipPracticeSlide = next; showWorshipChapter(worshipSelectedId);
    }
    window.MpmWorshipReader = {
      snapshot:function(){return {chapter:worshipSelectedId,page:worshipPracticeSlide+1};},
      select:function(id,page){
        var rows = worshipSorted(worshipLoad());
        var row = rows.find(function(row){return row.id === id;}) || rows.find(function(row){return worshipLanguage(row)===(document.documentElement.lang==="en"?"en":"id");}) || rows[0];
        if (!row) return;
        worshipSelectedId = row.id;
        worshipPracticeSlide = Math.max(0, (Number(page)||1)-1);
        showWorshipChapter(row.id);
      }
    };
    function resetWorshipForm() { byId("worshipChapterId").value = ""; byId("worshipFormTitle").textContent = window.PrayerI18n.uiText("Tambah sub-bab"); byId("worshipChapterTitle").value = ""; byId("worshipChapterText").value = ""; byId("worshipChapterActive").checked = true; byId("worshipChapterLanguage").value=document.documentElement.lang==="en"?"en":"id"; }
    function resetWorshipImageForm() { byId("worshipImageForm").reset(); byId("worshipImageId").value = ""; byId("worshipImageFormTitle").textContent = window.PrayerI18n.uiText("Tambah gambar"); }
    function editWorship(id) { var row = worshipLoad().find(function (item) { return item.id === id; }); if (!row) return; byId("worshipChapterId").value = row.id; byId("worshipFormTitle").textContent = "Edit sub-bab"; byId("worshipChapterLanguage").value=worshipLanguage(row); byId("worshipChapterTitle").value = row.title; byId("worshipChapterText").value = row.content; byId("worshipChapterActive").checked = row.active !== false; byId("worshipChapterTitle").focus(); }
    function bindWorship() {
      byId("worshipChapterForm").addEventListener("submit", function (event) { event.preventDefault(); var rows = worshipLoad(), id = byId("worshipChapterId").value || ("worship-" + Date.now()); var old = rows.find(function (item) { return item.id === id; }) || {}; var row = Object.assign({}, old, { id: id, language:byId("worshipChapterLanguage").value, title: byId("worshipChapterTitle").value.trim(), content: byId("worshipChapterText").value.trim(), active: byId("worshipChapterActive").checked }); var index = rows.findIndex(function (item) { return item.id === id; }); if (index >= 0) rows[index] = row; else rows.push(row); worshipSave(rows); resetWorshipForm(); renderWorship(); showWorshipChapter(id); toast("Sub-bab Materi Ibadah disimpan."); });
      byId("worshipCancelButton").addEventListener("click", resetWorshipForm);
      byId("worshipPreviousButton").addEventListener("click", function () { moveWorshipPage(-1); });
      byId("worshipNextButton").addEventListener("click", function () { moveWorshipPage(1); });
      byId("worshipFullscreenButton").addEventListener("click", function () { var panel = byId("worshipChapterContent"); if (!document.fullscreenElement && panel.requestFullscreen) panel.requestFullscreen(); else if (document.exitFullscreen) document.exitFullscreen(); });
      byId("worshipImageForm").addEventListener("submit", function (event) { event.preventDefault(); var id = byId("worshipImageId").value || ("image-" + Date.now()), image = { id: id, chapterId: byId("worshipImageChapter").value, path: byId("worshipImagePath").value.trim(), title: byId("worshipImageTitle").value.trim(), note: byId("worshipImageNote").value.trim() }, index = worshipCustomImages.findIndex(function (item) { return item.id === id; }); if (index >= 0) worshipCustomImages[index] = image; else worshipCustomImages.push(image); worshipSaveImages(); resetWorshipImageForm(); renderWorship(); showWorshipChapter(worshipSelectedId); toast("Gambar materi disimpan."); });
      byId("worshipImageCancelButton").addEventListener("click", resetWorshipImageForm);
      document.addEventListener("keydown", function (event) {
        if (!document.querySelector('[data-panel="worship"].active') || /INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) return;
        var delta = {ArrowRight:1,PageDown:1,ArrowLeft:-1,PageUp:-1,Home:-Infinity,End:Infinity}[event.key];
        if (delta !== undefined) { event.preventDefault(); moveWorshipPage(delta); }
      });
      byId("worshipCustomImageList").addEventListener("click", function (event) { var button = event.target.closest("button"), id = button && (button.dataset.worshipImageEdit || button.dataset.worshipImageDelete), image = id && worshipCustomImages.find(function (item) { return item.id === id; }); if (!button || !image) return; if (button.dataset.worshipImageEdit) { byId("worshipImageId").value = image.id; byId("worshipImageChapter").value = image.chapterId; byId("worshipImagePath").value = image.path; byId("worshipImageTitle").value = image.title; byId("worshipImageNote").value = image.note || ""; byId("worshipImageFormTitle").textContent = "Edit gambar"; byId("worshipImageTitle").focus(); } else if (window.confirm("Hapus gambar ini?")) { worshipCustomImages = worshipCustomImages.filter(function (item) { return item.id !== id; }); worshipSaveImages(); renderWorship(); showWorshipChapter(worshipSelectedId); toast("Gambar dihapus."); } });
      byId("worshipResetButton").addEventListener("click", function () { if (window.confirm("Pulihkan enam materi awal? Perubahan lokal akan diganti.")) { worshipSave(worshipInitialChapters.map(function (row) { return Object.assign({}, row); })); resetWorshipForm(); renderWorship(); toast("Materi awal dipulihkan."); } });
      byId("worshipChapterNav").addEventListener("change", function () { showWorshipChapter(this.value); });
      byId("worshipChapterList").addEventListener("click", function (event) { var button = event.target.closest("button"), id = button && (button.dataset.worshipEdit || button.dataset.worshipDelete); if (!id) return; var rows = worshipLoad(), index = rows.findIndex(function (row) { return row.id === id; }); if (button.dataset.worshipEdit) editWorship(id); else if (window.confirm("Hapus sub-bab ini?")) { rows.splice(index, 1); worshipSave(rows); renderWorship(); toast("Sub-bab dihapus."); } });
      byId("worshipChapterList").addEventListener("click", function(event){
        var button=event.target.closest("[data-worship-move]"); if(!button)return;
        var rows=worshipLoad(), index=rows.findIndex(function(row){return row.id===button.dataset.id;}), next=index+Number(button.dataset.worshipMove);
        if(index<0 || next<0 || next>=rows.length)return;
        var row=rows.splice(index,1)[0]; rows.splice(next,0,row); worshipSave(rows); renderWorship();
      });
      window.addEventListener("mpm:language-changed",function(){worshipSelectedId="";worshipPracticeSlide=0;renderWorship();if(!byId("worshipChapterId").value)byId("worshipChapterLanguage").value=document.documentElement.lang==="en"?"en":"id";});
      resetWorshipForm();renderWorship();
    }

  function openOfflineDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
      var request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }
  function offlinePut(key, data) {
    return openOfflineDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put({ key: key, savedAt: new Date().toISOString(), data: data });
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      });
    }).catch(function () {});
  }
  function offlineGet(key) {
    return openOfflineDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, "readonly");
        var request = tx.objectStore(STORE_NAME).get(key);
        request.onsuccess = function () { db.close(); resolve(request.result || null); };
        request.onerror = function () { db.close(); reject(request.error); };
      });
    }).catch(function () { return null; });
  }
  function offlineDelete(key) {
    return openOfflineDb().then(function (db) { return new Promise(function (resolve,reject) { var tx=db.transaction(STORE_NAME,"readwrite");tx.objectStore(STORE_NAME).delete(key);tx.oncomplete=function(){db.close();resolve();};tx.onerror=function(){db.close();reject(tx.error);}; }); });
  }
  function offlineEntries(prefix) {
    return openOfflineDb().then(function (db) { return new Promise(function (resolve,reject) { var rows=[],tx=db.transaction(STORE_NAME,"readonly"),request=tx.objectStore(STORE_NAME).openCursor();request.onsuccess=function(){var cursor=request.result;if(!cursor){db.close();resolve(rows);return;}if(String(cursor.key).indexOf(prefix)===0)rows.push(cursor.value);cursor.continue();};request.onerror=function(){db.close();reject(request.error);}; }); }).catch(function(){return [];});
  }
  function cacheKey(resource, params) {
    var stable = Object.assign({}, params || {});
    delete stable.refresh;
    var search = new URLSearchParams(stable);
    search.sort();
    return resource + "?" + search.toString();
  }
  function learningActorId() { return String(window.MpmUserSession?.user?.userId || "").trim(); }
  function actorAwareResource(resource) { return resource === "bootstrap" || String(resource || "").indexOf("learning") === 0; }
  function actorScopedResource(resource) {
    return ["bootstrap","learning","learning_lesson","learning_review","learning_placement","learning_export"].indexOf(resource) >= 0;
  }
  async function readJsonResponse(response) {
    var raw = await response.text(), payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch (error) {
      throw new Error("Server mengembalikan respons non-JSON (HTTP " + response.status + ").");
    }
    if (!payload || typeof payload !== "object") {
      throw new Error("Respons server kosong atau tidak valid (HTTP " + response.status + ").");
    }
    return payload;
  }
  async function apiGet(resource, params) {
    var requestAccount=learningActorId();
    var query = Object.assign({ resource: resource }, params || {});
    if (actorScopedResource(resource) && learningActorId() && !query.actor_id) query.actor_id = learningActorId();
    var keyParams=Object.assign({},query);delete keyParams.resource;
    var key = cacheKey(resource, keyParams);
    var getHeaders = { Accept: "application/json" };
    if (actorAwareResource(resource) && learningActorId()) getHeaders["X-Actor-Id"] = learningActorId();
    try {
      var response = await fetch(API_URL + "?" + new URLSearchParams(query).toString(), { headers: getHeaders, cache: "no-store" });
      var payload = await readJsonResponse(response);
      if (!response.ok || !payload.success) throw new Error(payload.error || "Permintaan gagal.");
      if(actorAwareResource(resource)&&requestAccount!==learningActorId())throw new Error("Account changed. Reload this section.");
      state.source = "network";
      offlinePut(key, payload.data);
      return payload.data;
    } catch (error) {
      if(response && (response.status===401 || response.status===403))throw error;
      if(actorAwareResource(resource)&&(resource!=="learning_lesson"||(response&&response.status<500)))throw error;
      var cached = await offlineGet(key);
      if (!cached && !actorAwareResource(resource) && actorScopedResource(resource) && keyParams.actor_id) {
        var neutralParams=Object.assign({},keyParams);delete neutralParams.actor_id;
        cached=await offlineGet(cacheKey(resource,neutralParams));
      }
      if (cached) {
        state.source = "offline-cache";
        toast("Koneksi server tidak tersedia; menampilkan cache offline.");
        return cached.data;
      }
      if (window.location.protocol === "file:" && error instanceof TypeError) {
        throw new Error("API tidak dapat dihubungi. Jalankan Apache XAMPP, lalu buka halaman melalui http://localhost/...");
      }
      throw error;
    }
  }
  async function apiPost(action, body, disableQueue) {
    var headers = { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token":window.MpmUserSession?.csrf||"" };
    if (learningActorId()) headers["X-Actor-Id"] = learningActorId();
    var token = byId("islamicAdminToken") ? byId("islamicAdminToken").value.trim() : "";
    if (token) headers["X-Admin-Token"] = token;
    var requestBody = Object.assign({ action: action, clientRequestId: "it-" + Date.now() + "-" + Math.random().toString(16).slice(2) }, body || {}), response = null;
    try {
      response = await fetch(API_URL, { method: "POST", headers: headers, body: JSON.stringify(requestBody) });
      var payload = await readJsonResponse(response);
      if (!response.ok || !payload.success) throw new Error(payload.error || "Operasi gagal.");
      return payload.data;
    } catch (error) {
      var queueable = ["save_learning_position","submit_learning_attempt","save_learning_preferences","import_learning_progress"].includes(action);
      if (!disableQueue && queueable && (!response || response.status >= 500)) {
        var outboxKey = "learning-outbox/" + requestBody.clientRequestId;
        await offlinePut(outboxKey,{action:action,body:requestBody,accountId:learningActorId()});
        toast("Perubahan Learning disimpan offline dan akan disinkronkan ketika server tersedia.");
        return {queued:true,offline:true,localPreferences:requestBody.preferences || null};
      }
      throw error;
    }
  }
  async function flushLearningOutbox() {
    var rows=await offlineEntries("learning-outbox/");
    for(var index=0;index<rows.length;index++){
      if(!learningActorId()||rows[index].data.accountId!==learningActorId())continue;
      try{await apiPost(rows[index].data.action,rows[index].data.body,true);await offlineDelete(rows[index].key);}catch(error){break;}
    }
    if(rows.length) toast("Sinkronisasi progres Learning offline selesai.");
  }

  function setConnectivity() {
    var label = navigator.onLine ? "Jaringan perangkat: online" : "Jaringan perangkat: offline";
    if (state.source === "offline-cache") label += " · memakai cache";
    byId("connectivityState").textContent = label;
  }
  function renderStatus(status) {
    var pill = byId("databaseState");
    var ready = status && status.database === "READY";
    pill.textContent = text(status && status.database, "ERROR");
    pill.className = "it-status-pill " + (ready ? "ready" : status ? "partial" : "error");
    var counts = status && status.counts || {};
    byId("databaseSummary").textContent = (counts.quran_surahs || 0) + " surah · " + (counts.quran_ayahs || 0) + " ayat · " + (counts.hadiths || 0) + " hadis · " + (counts.tafsir_entries || 0) + " tafsir";
    byId("lastSyncState").textContent = "Sinkron terakhir: " + text(status && (status.lastSync || status.lastValidatedImport));
    byId("databaseSizeState").textContent = "Ukuran SQL: " + formatBytes(status && status.databaseBytes);
  }
  function option(value, label, selected) { return "<option value=\"" + e(value) + "\"" + (selected ? " selected" : "") + ">" + e(label) + "</option>"; }
  function populateCatalog(catalog) {
    var surahs = catalog.surahs || [];
    state.catalogSurahs = surahs;
    var surahOptions = surahs.map(function (s) { return option(s.surahNumber, s.surahNumber + ". " + s.nameLatin + " — " + s.nameArabic); }).join("");
    byId("quranSurahSelect").innerHTML = surahOptions;
    byId("tafsirSurahSelect").innerHTML = surahOptions;
    renderTafsirCountOptions();
    renderEditionChoices();
    var collections = catalog.hadithCollections || [];
    byId("hadithCollectionSelect").innerHTML = option("", "Semua koleksi") + collections.map(function (c) { return option(c.id, c.name + " (" + c.recordCount + ")"); }).join("");
    byId("searchCollectionFilter").innerHTML = option("", "Semua") + collections.map(function (c) { return option(c.id, c.name); }).join("");
    var reciters = catalog.reciters || [];
    var reciterOptions = reciters.map(function (r) { return option(r.id, r.name + " · " + text(r.riwayah) + " · " + text(r.providerName)); }).join("");
    byId("quranReciterSelect").innerHTML = reciterOptions || option("", "Belum ada qari terdaftar");
    if (byId("audioManagerReciterSelect")) byId("audioManagerReciterSelect").innerHTML = reciterOptions || option("", "Belum ada qari terdaftar");
    updateAudioModeAvailability();
    byId("searchTafsirFilter").innerHTML = option("", "Semua") + (catalog.tafsirs || []).map(function (work) { return option(work.id, work.title + (work.author ? " — " + work.author : "")); }).join("");
    populateTafsirSelectors();
    renderTajwidControls();
  }
  function selectedTafsirSurah() {
    var number = Number(byId("tafsirSurahSelect").value || 1);
    return state.catalogSurahs.find(function (surah) { return Number(surah.surahNumber) === number; }) || null;
  }
  function syncQuranRange(fromEnd) {
    var surah = state.catalogSurahs.find(function(row){return Number(row.surahNumber)===Number(byId("quranSurahSelect").value);});
    if (!surah) return;
    var total = Number(surah.ayahCount), startInput=byId("quranStartInput"), endInput=byId("quranEndInput"), countSelect=byId("quranCountSelect");
    var full = !fromEnd && countSelect.value === "full";
    var start = full ? 1 : Math.min(total,Math.max(1,Math.floor(Number(startInput.value)||1)));
    var count = fromEnd ? Math.min(total,Math.max(start,Math.floor(Number(endInput.value)||start)))-start+1 : Math.min(total-start+1,selectedQuranCount());
    var en=document.documentElement.lang==="en";
    // Keep numeric options for old links, reading shortcuts and saved preferences.
    var options=[];
    for(var i=1;i<=Math.max(50,total);i++) options.push(option(String(i),i+(en?(i===1?" ayah":" ayahs"):" ayat")));
    options.push(option("full",en?"Entire surah":"1 surah penuh"));
    countSelect.innerHTML=options.join("");countSelect.value=full?"full":String(count);
    Array.from(countSelect.options).forEach(function(o){o.disabled=o.value!=="full"&&Number(o.value)>total-start+1;});
    startInput.max=endInput.max=String(total);endInput.min=String(start);
    startInput.value=String(start);endInput.value=String(start+count-1);
    byId("quranEndLabel").textContent=en?"End ayah":"Sampai ayat";
    byId("quranSurahCount").textContent=surah.nameLatin+": "+total+(en?" ayahs in this surah.":" ayat dalam surah ini.");
  }
  function selectedQuranCount() {
    var value = byId("quranCountSelect").value;
    if (value === "full") {
      var number = Number(byId("quranSurahSelect").value || 1);
      var surah = state.catalogSurahs.find(function (item) { return Number(item.surahNumber) === number; });
      return surah ? Number(surah.ayahCount) : 1;
    }
    return Math.max(1, Number(value) || 1);
  }
  function selectedQuranStart() {
    return byId("quranCountSelect").value === "full" ? 1 : Math.max(1, Number(byId("quranStartInput").value) || 1);
  }
  function renderTafsirCountOptions() {
    var select = byId("tafsirCountSelect");
    if (!select) return;
    var current = select.value;
    var options = [];
    for (var count = 1; count <= 50; count++) options.push(option(String(count), String(count) + " ayat", current === String(count)));
    options.push(option("complete", "1 surah lengkap / Complete", current === "complete"));
    select.innerHTML = options.join("");
    if (current === "complete" || (current && Number(current) >= 1 && Number(current) <= 50)) select.value = current;
    else select.value = "1";
  }
  function selectedTafsirCount() {
    var value = byId("tafsirCountSelect").value;
    if (value === "complete") {
      var surah = selectedTafsirSurah();
      return Math.max(1, Number(surah && surah.ayahCount || 1));
    }
    return Math.max(1, Math.min(50, Number(value) || 1));
  }
  function renderEditionChoices() {
    if (!state.bootstrap) return;
    var catalog = state.bootstrap.catalog || {};
    var language = byId("readerLanguageSelect").value;
    var transliterationCurrent = byId("quranTransliterationSelect").value;
    var transliterations = catalog.transliterations || [];
    byId("quranTransliterationSelect").innerHTML = option("", transliterations.length ? "Otomatis" : "Belum tersedia") + transliterations.map(function (edition) { return option(edition.id, edition.title + " · " + edition.sourceName, String(edition.id) === transliterationCurrent); }).join("");
  }
  function populateTafsirSelectors() {
    if (!state.bootstrap) return;
    var manager = state.bootstrap.tafsirManager || {}, families = manager.works || [];
    var currentFamily = byId("tafsirFamilySelect").value;
    byId("tafsirFamilySelect").innerHTML = families.length ? families.map(function (work) {
      return option(work.id, work.canonicalTitle + " — " + work.authorName, String(work.id) === currentFamily);
    }).join("") : option("", "Belum ada katalog karya");
    if ((!currentFamily || !families.some(function (work) { return String(work.id) === String(currentFamily); })) && families.length) {
      var firstLocal = families.find(function (work) { return Number(work.localRecordCount || 0) > 0; }) || families[0];
      byId("tafsirFamilySelect").value = firstLocal.id;
    }
    renderTafsirLanguages();
  }
  function normalizeTafsirLanguage(language) {
    var normalized = String(language || "").trim().toLowerCase();
    return ({ ara: "ar", arabic: "ar", eng: "en", english: "en", ind: "id", indonesia: "id", indonesian: "id" }[normalized] || normalized);
  }
  function renderTafsirLanguages() {
    if (!state.bootstrap) return;
    var familyId = byId("tafsirFamilySelect").value, manager = state.bootstrap.tafsirManager || {};
    var family = (manager.works || []).find(function (row) { return String(row.id) === String(familyId); });
    var registeredEditions = (family && family.editions || []).filter(function (edition) {
      return String(edition.availabilityStatus || "").toUpperCase() !== "NOT_FOUND";
    });
    var languages = Array.from(new Set(registeredEditions
      .map(function (edition) { return normalizeTafsirLanguage(edition.language); })
      .filter(Boolean)));
    if (!languages.length) {
      languages = Array.from(new Set((state.bootstrap.catalog.tafsirs || [])
        .filter(function (work) {
          return (!familyId || String(work.libraryWorkId || "") === String(familyId))
            && Number(work.recordCount || 0) > 0;
        })
        .map(function (work) { return normalizeTafsirLanguage(work.language); })
        .filter(Boolean)));
    }
    var current = normalizeTafsirLanguage(byId("tafsirLanguageSelect").value);
    byId("tafsirLanguageSelect").innerHTML = languages.length ? languages.map(function (language) {
      return option(language, tafsirLanguageLabel(language, false), language === current);
    }).join("") : option("", "Belum ada sumber edisi");
    if ((!current || !languages.includes(current)) && languages.length) {
      byId("tafsirLanguageSelect").value = languages[0];
    }
    renderTafsirWorks();
  }

  function tafsirLanguageLabel(language, machineGenerated) {
    var normalized = String(language || "").toLowerCase();
    if (normalized === "id" || normalized === "ind") return "Bahasa Indonesia — edisi resmi sumber";
    if (normalized === "ar" || normalized === "ara") return "Arabic";
    if (normalized === "en" || normalized === "eng") return "English";
    return String(language || "Bahasa belum diketahui").toUpperCase();
  }
  function renderTafsirWorks() {
    if (!state.bootstrap) return;
    var familyId = byId("tafsirFamilySelect").value;
    var language = normalizeTafsirLanguage(byId("tafsirLanguageSelect").value);
    var family = (((state.bootstrap.tafsirManager || {}).works) || []).find(function (item) { return String(item.id) === String(familyId); });
    var works = (state.bootstrap.catalog.tafsirs || []).filter(function (work) {
      var linkedFamily = String(work.libraryWorkId || "") === String(familyId);
      return (!familyId || linkedFamily) && Number(work.recordCount || 0) > 0 && (!language || normalizeTafsirLanguage(work.language) === language);
    });
    var hasRegisteredLanguage = (family && family.editions || []).some(function (edition) {
      return normalizeTafsirLanguage(edition.language) === language
        && String(edition.availabilityStatus || "").toUpperCase() !== "NOT_FOUND"
        && !(String(edition.availabilityStatus || "").toUpperCase() === "REFERENCE_ONLY"
          && UNAVAILABLE_ONLINE_TAFSIR_SLUGS[String(edition.sourceUrl || "").split("/").pop()]);
    });
    var emptyLabel = hasRegisteredLanguage
      ? "Sumber bahasa tersedia, tetapi record lokal belum diproses"
      : "Belum ada sumber edisi untuk bahasa ini";
    var references = (family && family.editions || []).filter(function (edition) {
      return normalizeTafsirLanguage(edition.language) === language
        && String(edition.availabilityStatus || "").toUpperCase() === "REFERENCE_ONLY"
        && edition.sourceUrl
        && !UNAVAILABLE_ONLINE_TAFSIR_SLUGS[String(edition.sourceUrl).split("/").pop()];
    });
    var choices = works.map(function (work) { return option(work.id, work.title + (work.author ? " — " + work.author : "")); }).join("")
      + references.map(function (edition) { return option("reference:" + edition.id, edition.title + " · Sumber online"); }).join("");
    byId("tafsirWorkSelect").innerHTML = choices || option("", emptyLabel);
    byId("loadTafsirButton").disabled = !choices;
    renderTafsirReaderMeta();
  }

  function selectedTafsirReference() {
    var value = String(byId("tafsirWorkSelect").value || "");
    if (value.indexOf("reference:") !== 0) return null;
    var familyId = byId("tafsirFamilySelect").value;
    var family = (((state.bootstrap || {}).tafsirManager || {}).works || []).find(function (item) { return String(item.id) === String(familyId); });
    return (family && family.editions || []).find(function (edition) { return String(edition.id) === value.slice(10); }) || null;
  }
  function normalizeOnlineTafsir(payload, reference, resource, surah, ayahNumber) {
    var textValue = payload && payload.tafsir && payload.tafsir.text ? String(payload.tafsir.text) : "";
    return {
      surah: state.quran.surah.nameLatin,
      surahNumber: surah,
      ayahNumber: ayahNumber,
      ayahText: "",
      language: normalizeTafsirLanguage(reference.language),
      languageName: tafsirLanguageLabel(reference.language, false),
      sourceTafsir: reference.title,
      title: reference.title,
      author: reference.authorName || resource.author_name || "Mufassir sumber",
      mufassir: reference.authorName || resource.author_name || "Mufassir sumber",
      text: textValue,
      sourceName: "Quran Foundation API",
      sourceId: resource && resource.id,
      sourceUrl: reference.sourceUrl,
      metadataSource: "api.quran.com/api/v4/tafsirs/" + (resource && resource.id) + "/by_ayah/" + surah + ":" + ayahNumber,
      retrievedAt: new Date().toISOString(),
      availabilityStatus: textValue ? "available" : "unavailable",
      status: textValue ? "available" : "unavailable"
    };
  }
  async function getTafsir(params) {
    var key = [params.surah, params.ayah, params.language, params.source].join(":");
    var cached = state.tafsir.online.entries[key];
    if (cached) return cached;
    if (!state.tafsir.online.resources) {
      var resourceResponse = await fetch("https://api.quran.com/api/v4/resources/tafsirs");
      if (!resourceResponse.ok) throw new Error("Sumber online Tafsir tidak dapat dihubungi.");
      var resourcePayload = await resourceResponse.json();
      state.tafsir.online.resources = resourcePayload.tafsirs || [];
    }
    var sourceSlug = String(params.source || "").replace("en-tafisr", "en-tafsir");
    sourceSlug = ONLINE_TAFSIR_SLUG_ALIASES[sourceSlug] || sourceSlug;
    var resource = state.tafsir.online.resources.find(function (item) {
      return String(item.slug || "").replace("en-tafisr", "en-tafsir") === sourceSlug || String(item.id) === String(params.source);
    });
    if (!resource) {
      var title = String(params.reference.title || "").toLowerCase();
      var language = normalizeTafsirLanguage(params.language);
      resource = state.tafsir.online.resources.find(function (item) {
        var itemLanguage = String(item.language_name || "").toLowerCase();
        var itemName = String(item.name || "").toLowerCase();
        return itemLanguage.indexOf(language === "ar" ? "arab" : language === "en" ? "english" : language) >= 0
          && ((title.indexOf("qurtubi") >= 0 && itemName.indexOf("qurtubi") >= 0)
            || (title.indexOf("kathir") >= 0 && itemName.indexOf("kathir") >= 0)
            || (title.indexOf("tabari") >= 0 && itemName.indexOf("tabari") >= 0)
            || (title.indexOf("jalalayn") >= 0 && itemName.indexOf("jalalayn") >= 0)
            || (title.indexOf("sadi") >= 0 && itemName.indexOf("sadi") >= 0));
      });
    }
    if (!resource) throw new Error("Edisi online Tafsir tidak ditemukan pada API sumber.");
    var response = await fetch("https://api.quran.com/api/v4/tafsirs/" + encodeURIComponent(resource.id) + "/by_ayah/" + params.surah + ":" + params.ayah);
    if (!response.ok) throw new Error("Gagal mengambil Tafsir untuk ayat " + params.surah + ":" + params.ayah + ".");
    var result = normalizeOnlineTafsir(await response.json(), params.reference, resource, params.surah, params.ayah);
    state.tafsir.online.entries[key] = result;
    return result;
  }
  async function loadOnlineTafsir(reference) {
    var surah = Number(byId("tafsirSurahSelect").value || 1);
    var start = Number(byId("tafsirStartInput").value || 1);
    var complete = byId("tafsirCountSelect").value === "complete";
    if (!state.tafsir.online.reference || state.tafsir.online.reference.id !== reference.id || state.tafsir.online.reference.surah !== surah || state.tafsir.online.reference.start !== start) state.tafsir.online.page = 0;
    state.tafsir.online.reference = { id: reference.id, surah: surah, start: start };
    var total = complete ? Number((selectedTafsirSurah() || {}).ayahCount || 1) : selectedTafsirCount();
    state.tafsir.online.total = total;
    var pageSize = complete ? state.tafsir.online.pageSize : total;
    var pageStart = start + (complete ? state.tafsir.online.page * pageSize : 0);
    var count = Math.min(pageSize, Math.max(0, total - (pageStart - start)));
    if (!count) return;
    state.quran = await apiGet("quran", {
      surah: surah,
      start: pageStart,
      count: count,
      language: byId("readerLanguageSelect").value
    });
    var slug = String(reference.sourceUrl || "").split("/").pop();
    state.quran.ayahs = await Promise.all(state.quran.ayahs.map(async function (ayah) {
      try {
        var entry = await getTafsir({ surah: surah, ayah: ayah.ayahNumber, language: normalizeTafsirLanguage(reference.language), source: slug, reference: reference });
        entry.ayahText = ayah.arabic || "";
        ayah.tafsir = [entry];
      } catch (error) {
        ayah.tafsir = [{ title: reference.title, language: normalizeTafsirLanguage(reference.language), status: "error", availabilityStatus: "error", error: error.message, sourceName: "Quran Foundation API", sourceUrl: reference.sourceUrl }];
      }
      return ayah;
    }));
    state.quran.readingContext = {workId:"reference:"+reference.id,language:reference.language};
    var target = byId("tafsirReader");
    target.className = "it-reading-list " + state.layout;
    target.innerHTML = state.quran.ayahs.map(function (ayah) { return quranRecordHtml(ayah, true); }).join("") || "<div class=\"it-empty\">Teks Tafsir online tidak tersedia untuk rentang ayat ini.</div>";
    byId("tafsirReaderTitle").textContent = reference.title + " · Surah " + surah + (complete ? " · Halaman " + (state.tafsir.online.page + 1) : "");
    renderTafsirPagination(complete);
  }
  function renderTafsirPagination(enabled) {
    var node = byId("tafsirPagination");
    if (!node) return;
    if (!enabled) { node.innerHTML = ""; return; }
    var totalPages = Math.max(1, Math.ceil(state.tafsir.online.total / state.tafsir.online.pageSize));
    node.innerHTML = "<button class=\"it-button small\" type=\"button\" data-tafsir-page=\"prev\"" + (state.tafsir.online.page <= 0 ? " disabled" : "") + ">Sebelumnya</button><span>Halaman " + (state.tafsir.online.page + 1) + " / " + totalPages + " · " + state.tafsir.online.total + " ayat</span><button class=\"it-button small\" type=\"button\" data-tafsir-page=\"next\"" + (state.tafsir.online.page >= totalPages - 1 ? " disabled" : "") + ">Berikutnya</button>";
  }

  function renderTafsirReaderMeta() {
    if (!state.bootstrap || !byId("tafsirReaderMeta")) return;
    var work = (state.bootstrap.catalog.tafsirs || []).find(function (item) { return String(item.id) === String(byId("tafsirWorkSelect").value); });
    var reference = selectedTafsirReference();
    if (reference) {
      var referenceUrl = String(reference.sourceUrl).replace(/1:1/, String(byId("tafsirSurahSelect").value || 1) + ":" + String(byId("tafsirStartInput").value || 1));
      byId("tafsirReaderMeta").innerHTML = "<strong>" + e(reference.title) + "</strong> · " + e(tafsirLanguageLabel(reference.language, false)) + " · Sumber online · <a target=\"_blank\" rel=\"noopener\" href=\"" + e(referenceUrl) + "\">Buka Tafsir online</a>";
      return;
    }
    if (!work) {
      var family = (((state.bootstrap.tafsirManager || {}).works) || []).find(function (item) { return String(item.id) === String(byId("tafsirFamilySelect").value); });
      var selectedLanguage = normalizeTafsirLanguage(byId("tafsirLanguageSelect").value);
      var hasReference = (family && family.editions || []).some(function (edition) {
        return normalizeTafsirLanguage(edition.language) === selectedLanguage && String(edition.availabilityStatus || "").toUpperCase() !== "NOT_FOUND";
      });
      byId("tafsirReaderMeta").innerHTML = family
        ? "<strong>" + e(family.canonicalTitle) + "</strong> · " + (hasReference ? "Referensi bahasa tersedia, tetapi belum ada edisi lokal yang diproses." : "Belum ada sumber edisi untuk bahasa ini.")
        : "Pilih karya Tafsir untuk membaca teks sumber.";
      return;
    }
    var links = (work.editionSourceUrl ? " · <a target=\"_blank\" rel=\"noopener\" href=\"" + e(work.editionSourceUrl) + "\">sumber edisi</a>" : "") + (work.editionLicenseUrl ? " · <a target=\"_blank\" rel=\"noopener\" href=\"" + e(work.editionLicenseUrl) + "\">lisensi</a>" : "");
    byId("tafsirReaderMeta").innerHTML = "<strong>" + e(work.canonicalWorkTitle || work.title) + "</strong> · " + e(tafsirLanguageLabel(work.language, false)) + " · " + e(work.contentType || "tafsir") + " · " + badge(work.technicalStatus || work.verificationStatus) + " " + badge("LICENSE " + work.licenseStatus) + links;
  }

  function tafsirStatusMatch(edition, filter) {
    if (!filter) return true;
    if (filter === "local") return Number(edition.recordCount || 0) > 0;
    if (filter === "reference") return edition.availabilityStatus === "REFERENCE_ONLY";
    if (filter === "missing") return edition.availabilityStatus === "NOT_FOUND";
    if (filter === "review") return /REVIEW|NOT_CHECKED/.test(String(edition.technicalStatus) + " " + String(edition.licenseStatus) + " " + String(edition.availabilityStatus));
    return true;
  }
  function renderTafsirManager(manager) {
    if (!manager || !byId("tafsirManagerList")) return;
    var summary = manager.summary || {};
    byId("tafsirManagerSummary").innerHTML = [
      [summary.workCount || 0, "karya konseptual"],
      [summary.localEditions || 0, "edisi lokal"],
      [Number(summary.localRecords || 0).toLocaleString("id-ID"), "record tafsir"],
      [formatBytes(summary.localBytes || 0), "arsip tercatat"]
    ].map(function (item) { return "<div class=\"it-learning-stat\"><strong>" + e(item[0]) + "</strong><span>" + e(item[1]) + "</span></div>"; }).join("");
    var query = byId("tafsirManagerSearch").value.trim().toLowerCase(), language = byId("tafsirManagerLanguage").value, status = byId("tafsirManagerStatus").value;
    var html = (manager.works || []).map(function (work) {
      var haystack = [work.canonicalTitle, work.titleArabic, work.authorName, work.authorNameArabic].join(" ").toLowerCase();
      var editions = (work.editions || []).filter(function (edition) {
        var editionText = [edition.title, edition.provider, edition.registrySourceName, edition.notes].join(" ").toLowerCase();
        return (!query || haystack.indexOf(query) >= 0 || editionText.indexOf(query) >= 0) && (!language || edition.language === language) && tafsirStatusMatch(edition, status);
      });
      if (!editions.length) return "";
      return "<section class=\"it-tafsir-work\"><header><div><h3>" + e(work.canonicalTitle) + (work.titleArabic ? " · <span lang=\"ar\" dir=\"rtl\">" + e(work.titleArabic) + "</span>" : "") + "</h3><p>" + e(work.authorName) + " · prioritas " + e(work.priority) + "</p></div><span>" + e(work.availableLanguages.length ? work.availableLanguages.map(function (languageCode) { return tafsirLanguageLabel(languageCode, false); }).join(" · ") : "belum lokal") + "</span></header><div class=\"it-tafsir-editions\">" + editions.map(tafsirEditionHtml).join("") + "</div></section>";
    }).join("");
    byId("tafsirManagerList").innerHTML = html || "<div class=\"it-empty\">Tidak ada edisi yang cocok dengan filter.</div>";
    byId("tafsirAdapterList").innerHTML = (manager.adapters || []).map(function (adapter) {
      return "<article class=\"it-source-card\" data-route-card=\"adapter-" + e(adapter.adapterKey) + "\"><div><p class=\"it-eyebrow\">" + e(adapter.adapterType + " · " + adapter.inputFormat) + "</p><h3>" + e(adapter.providerName) + "</h3></div><div>" + badge(adapter.testStatus) + "</div><p class=\"it-help\">" + e(adapter.notes) + "</p><div class=\"it-source-meta\"><span><strong>Adapter</strong>" + e(adapter.adapterKey) + "</span><span><strong>Kemampuan</strong>" + e((adapter.capabilities || []).join(", ")) + "</span></div></article>";
    }).join("");
    var audits = [];
    (manager.recentImports || []).forEach(function (row) { audits.push({ at: row.startedAt, html: "<article class=\"it-stack-row\"><div><strong>Import · " + e(row.editionTitle + " [" + row.language.toUpperCase() + "]") + "</strong><p>" + e(row.sourceFileName || row.operation) + " · " + e(row.acceptedRecords) + "/" + e(row.inputRecords) + " record · " + formatBytes(row.fileSize) + "</p></div>" + badge(row.status) + "</article>" }); });
    (manager.recentIntegrity || []).forEach(function (row) { audits.push({ at: row.checkedAt, html: "<article class=\"it-stack-row\"><div><strong>Verifikasi · " + e(row.editionTitle + " [" + row.language.toUpperCase() + "]") + "</strong><p>Coverage " + e(row.coveredAyahCount) + "/6.236 ayat · kosong " + e(row.emptyCount) + " · duplikat " + e(row.duplicateCount) + " · range invalid " + e(row.invalidRangeCount) + " · UTF-8 error " + e(row.encodingErrorCount) + "</p></div>" + badge(row.technicalStatus) + "</article>" }); });
    audits.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    byId("tafsirAuditList").innerHTML = audits.length ? audits.slice(0, 20).map(function (row) { return row.html; }).join("") : "<div class=\"it-empty\">Belum ada audit.</div>";
  }
  function tafsirEditionHtml(edition) {
    var integrity = edition.integrity && edition.integrity.checks || {};
    var sourceLink = edition.sourceUrl ? "<a class=\"it-tafsir-source-link\" target=\"_blank\" rel=\"noopener\" href=\"" + e(edition.sourceUrl) + "\">Sumber</a>" : "Sumber resmi belum ditemukan";
    var licenseLink = edition.licenseUrl ? "<a class=\"it-tafsir-source-link\" target=\"_blank\" rel=\"noopener\" href=\"" + e(edition.licenseUrl) + "\">Lisensi</a>" : "lisensi belum ditetapkan";
    var downloadLabel = Number(edition.recordCount || 0) > 0 ? "Update" : "Download";
    var importDisabled = !edition.canImport, downloadDisabled = !edition.canDownload;
    return "<article class=\"it-tafsir-edition\" data-route-card=\"tafsir-edition-" + e(edition.id) + "\"><div><h4>" + e(edition.title) + " · " + e(tafsirLanguageLabel(edition.language, false)) + "</h4><div class=\"it-tafsir-edition-meta\">" + badge(edition.contentType) + badge(edition.availabilityStatus) + badge(edition.technicalStatus) + badge("LICENSE " + edition.licenseStatus) + "</div><p>" + e(edition.provider || edition.registrySourceName || "Provider belum ditetapkan") + " · " + sourceLink + " · " + licenseLink + "</p></div><div><p>Record " + Number(edition.recordCount || 0).toLocaleString("id-ID") + " · coverage " + Number(edition.coveredAyahCount || 0).toLocaleString("id-ID") + "/6.236 ayat · " + formatBytes(edition.fileSize) + "</p><p>Dicek " + e(text(edition.lastChecked)) + " · diverifikasi " + e(text(edition.lastVerified)) + "</p><p>" + e(edition.notes) + "</p>" + (Object.keys(integrity).length ? "<div class=\"it-tafsir-integrity\">Kosong " + e(integrity.emptyCount || 0) + " · duplikat " + e(integrity.duplicateCount || 0) + " · range invalid " + e(integrity.invalidRangeCount || 0) + " · UTF-8 " + e(integrity.encodingErrorCount || 0) + "</div>" : "") + "</div><div class=\"it-tafsir-edition-actions\"><button class=\"it-button small\" data-verify-tafsir=\"" + e(edition.id) + "\" type=\"button\"" + (Number(edition.recordCount || 0) ? "" : " disabled title=\"Belum ada record lokal\"") + ">Verify</button><button class=\"it-button small primary\" data-download-tafsir=\"" + e(edition.id) + "\" type=\"button\"" + (downloadDisabled ? " disabled title=\"Sumber/lisensi belum mengizinkan download offline\"" : "") + ">" + downloadLabel + "</button><button class=\"it-button small\" data-import-tafsir=\"" + e(edition.id) + "\" type=\"button\"" + (importDisabled ? " disabled title=\"Import diblokir sampai izin penyimpanan dan sumber lengkap\"" : "") + ">Import JSON</button><button class=\"it-button small danger\" data-remove-tafsir=\"" + e(edition.id) + "\" type=\"button\"" + (Number(edition.recordCount || 0) ? "" : " disabled") + ">Remove local</button></div></article>";
  }


  function readingProgressHtml(reference) {
    if (reference.type === 'tafsir' && (!reference.workId || reference.available === false)) return '<small>Tanda belajar tersedia setelah teks tafsir berhasil dimuat.</small>';
    if (reference.type === 'hadith') reference.key = 'hadith:' + reference.hadithId;
    else reference.key = reference.type + ':' + (reference.type === 'tafsir' ? reference.workId + ':' : '') + reference.surah + ':' + reference.ayah;
    return '<div class="it-reading-tracker" data-reading-reference="' + e(JSON.stringify(reference)) + '"></div>';
  }
  window.MpmOpenHadithRoute = openHadithDetail;
  var readingReady = false;
  window.IslamicTextReaderReady = function () { return readingReady; };
  window.IslamicTextResumeReading = async function (ref) {
    if (!readingReady) throw new Error('Reader masih memuat data; coba kembali sebentar lagi.');
    document.querySelector('[data-tab="' + ref.type + '"]').click();
    if (ref.type === 'hadith') {
      byId('hadithCollectionSelect').value = ref.collectionId;
      byId('hadithLanguageSelect').value = ref.language;
      byId('hadithGradeSelect').value = 'all';byId('hadithQueryInput').value = '';
      byId('hadithPageSizeSelect').value = '25';await loadHadith(ref.page || 1);
    } else if (ref.type === 'quran') {
      byId('quranSurahSelect').value = ref.surah;byId('quranStartInput').value = ref.ayah;byId('quranCountSelect').value = '1';
      if (Array.from(byId('readerLanguageSelect').options).some(o=>o.value===ref.language)) byId('readerLanguageSelect').value=ref.language;
      await loadQuran(false);
    } else {
      const manager=state.bootstrap.tafsirManager||{}, work=(state.bootstrap.catalog.tafsirs||[]).find(w=>String(w.id)===String(ref.workId));
      const family=(manager.works||[]).find(f=>(f.editions||[]).some(e=>String(e.tafsirWorkId)===String(ref.workId)||('reference:'+e.id)===ref.workId));
      if (!work&&!family) throw new Error('Kitab tafsir tersimpan belum tersedia dalam katalog.');
      byId('tafsirFamilySelect').value=family?family.id:(work.libraryWorkId||'');renderTafsirLanguages();
      if(Array.from(byId('tafsirLanguageSelect').options).some(o=>o.value===ref.language))byId('tafsirLanguageSelect').value=ref.language;
      else if(work)byId('tafsirLanguageSelect').value=work.language;
      renderTafsirWorks();byId('tafsirWorkSelect').value=ref.workId;
      byId('tafsirSurahSelect').value=ref.surah;renderTafsirCountOptions();byId('tafsirStartInput').value=ref.ayah;byId('tafsirCountSelect').value='1';
      await loadQuran(true);
    }
  };
  function provenanceHtml(source) {
    if (!source) return "";
    var metadata = source.metadataSource || source.sourceUrl || source.sourceId;
    return "<div class=\"it-provenance\"><span>Sumber: " + e(text(source.provider || source.sourceName)) + "</span>" + (source.mufassir ? "<span>Mufassir: " + e(source.mufassir) + "</span>" : "") + (source.edition || source.editionTitle || source.version ? "<span>Edisi: " + e(text(source.edition || source.editionTitle || source.version)) + "</span>" : "") + "<span>Status: " + e(text(source.status || source.verificationStatus || source.availabilityStatus)) + "</span>" + (metadata ? "<span>Metadata: " + e(metadata) + "</span>" : "") + (source.retrievedAt ? "<span>Diambil: " + e(source.retrievedAt) + "</span>" : "") + (source.licenseStatus ? "<span>Lisensi: " + e(source.licenseStatus) + "</span>" : "") + (source.checksum ? "<span>SHA-256: " + e(String(source.checksum).slice(0, 12)) + "…</span>" : "") + "</div>";
  }
  function badge(status) {
    var normalized = String(status || "UNCLASSIFIED").toLowerCase();
    var kind = /verified|sahih|validated|active|ready/.test(normalized) ? "good" : /mawdu|failed|blocked|rejected/.test(normalized) ? "bad" : "warn";
    return "<span class=\"it-badge " + kind + "\">" + e(status || "UNCLASSIFIED") + "</span>";
  }
  function tajwidRulePreference(rule) {
    var custom = state.tajwidTheme.rules && state.tajwidTheme.rules[rule.code] || {};
    return { enabled: custom.enabled !== undefined ? !!custom.enabled : rule.defaultEnabled !== false, color: custom.color || (state.tajwidTheme.mode === "dark" ? rule.darkColor : rule.lightColor) || "#16784b", opacity: custom.opacity == null ? Number(rule.defaultOpacity || 1) : Number(custom.opacity), mode: custom.mode || rule.defaultMode || "text" };
  }
  function renderTajwidControls() {
    if (!state.bootstrap) return;
    var rules = state.bootstrap.catalog.tajwidRules || [];
    byId("tajwidRuleControls").innerHTML = rules.map(function (rule) {
      var pref = tajwidRulePreference(rule);
      return "<label class=\"it-tajwid-setting\"><input type=\"checkbox\" data-tajwid-enabled=\"" + e(rule.code) + "\"" + (pref.enabled ? " checked" : "") + "><span>" + e(rule.nameId || rule.code) + "</span><input type=\"color\" data-tajwid-color=\"" + e(rule.code) + "\" value=\"" + e(pref.color) + "\"><select data-tajwid-rule-mode=\"" + e(rule.code) + "\"><option value=\"text\"" + (pref.mode === "text" ? " selected" : "") + ">Teks</option><option value=\"background\"" + (pref.mode === "background" ? " selected" : "") + ">Latar</option><option value=\"underline\"" + (pref.mode === "underline" ? " selected" : "") + ">Garis</option></select></label>";
    }).join("");
    byId("tajwidModeSelect").value = state.tajwidTheme.mode || "auto";
    byId("tajwidOpacityRange").value = state.tajwidTheme.opacity == null ? 1 : state.tajwidTheme.opacity;
    byId("tajwidLegendToggle").checked = state.tajwidTheme.showLegend !== false;
    applyTajwidTheme();
  }
  function collectTajwidTheme() {
    var rules = {};
    (state.bootstrap.catalog.tajwidRules || []).forEach(function (rule) {
      var enabled = document.querySelector("[data-tajwid-enabled=\"" + rule.code + "\"]"), color = document.querySelector("[data-tajwid-color=\"" + rule.code + "\"]"), mode = document.querySelector("[data-tajwid-rule-mode=\"" + rule.code + "\"]");
      rules[rule.code] = { enabled: !enabled || enabled.checked, color: color ? color.value : rule.lightColor, opacity: 1, mode: mode ? mode.value : "text" };
    });
    return { enabled: byId("showTajwidToggle").checked, showLegend: byId("tajwidLegendToggle").checked, mode: byId("tajwidModeSelect").value, opacity: Number(byId("tajwidOpacityRange").value), rules: rules };
  }
  function applyTajwidTheme() {
    var selected = state.tajwidTheme.mode || "auto";
    document.documentElement.dataset.tajwidTheme = selected === "auto" ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : selected;
    document.documentElement.style.setProperty("--tajwid-opacity", state.tajwidTheme.opacity == null ? 1 : state.tajwidTheme.opacity);
    renderTajwidLegend();
  }
  function renderTajwidLegend() {
    if (!state.bootstrap || !byId("tajwidLegend")) return;
    var show = byId("showTajwidToggle").checked && state.tajwidTheme.showLegend !== false;
    byId("tajwidLegend").innerHTML = show ? (state.bootstrap.catalog.tajwidRules || []).filter(function (rule) { return tajwidRulePreference(rule).enabled; }).map(function (rule) { var pref = tajwidRulePreference(rule); return "<span title=\"" + e(rule.readingInstruction || rule.description || "") + "\"><i style=\"--tajwid-color:" + e(pref.color) + "\"></i>" + e(rule.nameId || rule.code) + "</span>"; }).join("") : "";
  }
  function tajwidArabicHtml(ayah) {
    if (!byId("showTajwidToggle").checked || !ayah.tajwidPresentation || !(ayah.tajwid || []).length) return e(ayah.arabic);
    var chars = Array.from(String(ayah.tajwidPresentation.plainText || "")), rulesByCode = {}, cursor = 0, html = "";
    (state.bootstrap.catalog.tajwidRules || []).forEach(function (rule) { rulesByCode[rule.code] = rule; });
    (ayah.tajwid || []).slice().sort(function (a, b) { return Number(a.startCharacter) - Number(b.startCharacter); }).forEach(function (span) {
      var start = Math.max(cursor, Number(span.startCharacter || 0)), end = Math.max(start, Math.min(chars.length, Number(span.endCharacter || start)));
      if (start > cursor) html += e(chars.slice(cursor, start).join(""));
      var rule = rulesByCode[span.code] || span, pref = tajwidRulePreference(rule), content = e(chars.slice(start, end).join(""));
      html += pref.enabled ? "<span class=\"it-tajwid-token\" data-rule=\"" + e(span.code) + "\" data-mode=\"" + e(pref.mode) + "\" title=\"" + e(span.nameId || span.code) + "\" style=\"--tajwid-color:" + e(pref.color) + ";opacity:" + e(pref.opacity) + "\">" + content + "</span>" : content;
      cursor = end;
    });
    if (cursor < chars.length) html += e(chars.slice(cursor).join(""));
    return html;
  }
  function quranAudioHtml(ayah) {
    if (!byId("showAudioToggle").checked) return "";
    var resources = Array.isArray(ayah.audio) ? ayah.audio : [];
    if (!resources.length) return "<span class=\"it-audio-unavailable\">Audio online/lokal belum tersedia untuk qari ini.</span>";
    var resource = resources[0];
    return "<div class=\"it-ayah-play\"><button class=\"it-button small\" type=\"button\" data-play-ayah=\"" + e(ayah.ayahNumber) + "\">▶ Putar ayat</button><span class=\"it-audio-source\">" + e(resource.reciter || "Qari") + " · " + e(resource.bitrate || "") + " kbps · " + e(resource.offlineAvailable ? "offline" : "online") + "</span></div><div class=\"it-audio-player it-audio-compat\"><audio preload=\"none\" src=\"" + e(resource.playbackUrl) + "\"></audio><span>" + e(resource.reciter || "Qari") + " · " + e(resource.riwayah || "") + "</span></div>";
  }
  function quranRecordHtml(ayah, includeTafsir) {
    var tafsir = (ayah.tafsir || []).map(function (entry) {
      if(entry.importProvenance&&window.MpmBookPresentation)return window.MpmBookPresentation.html(entry.importProvenance.metadata,entry.importProvenance.draft)+reviewedImportHtml(entry,true);
      var languageNames = { ar: "Arabic", en: "English", id: "Bahasa Indonesia" };
      var sourceLabel = (languageNames[entry.language] || String(entry.language || "Sumber").toUpperCase()) + (entry.sourceUrl && entry.metadataSource ? " · Sumber online" : " · Edisi sumber");
      var machineMode = false;
      var machineResult = '';
      var status = String(entry.status || entry.availabilityStatus || "available").toLowerCase();
      if (entry.language === "id") sourceLabel = "Bahasa Indonesia — edisi resmi sumber";
      var body = status === "error"
        ? "<p class=\"it-tafsir-state error\">Gagal mengambil data tafsir. " + e(entry.error || "") + "</p>"
        : status === "unavailable"
          ? "<p class=\"it-tafsir-state\">Tafsir untuk bahasa/sumber ini belum tersedia.</p>"
          : tafsirHtml(entry.text);
      return "<section class=\"it-tafsir\" data-tafsir-language=\"" + e(entry.language) + "\" data-tafsir-source=\"" + e(entry.sourceId || entry.sourceName || entry.title) + "\"><div class=\"it-record-head\"><strong>" + e(entry.mufassir || entry.author || entry.title) + "</strong><span class=\"it-badge\">" + e(sourceLabel) + "</span></div><div class=\"it-tafsir-title\">" + e(entry.sourceTafsir || entry.title) + "</div><div class=\"it-tafsir-body\" dir=\"" + (entry.language === "ar" ? "rtl" : "auto") + "\">" + body + "</div>" + machineResult + reviewedImportHtml(entry) + provenanceHtml(entry) + "</section>";
    }).join("");
    var tajwidStatus = byId("showTajwidToggle").checked && ayah.tajwidPresentation ? "<div class=\"it-provenance\"><span>Tajwid: " + e(ayah.tajwidPresentation.editionTitle) + "</span><span>Alignment: " + e(ayah.tajwidPresentation.alignmentStatus) + "</span><span>Anotasi: " + e(ayah.tajwidPresentation.parsedSpanCount) + "</span></div>" : "";
    var relations = (ayah.relatedHadith || []).map(function (row) { return "<button class=\"it-button small\" data-hadith-detail=\"" + e(row.internalHadithId) + "\" type=\"button\">Hadis terkait: " + e(row.collection + " " + row.hadithNumber) + "</button>"; }).join("");
    var translation = "<p class=\"it-translation\"><strong>Arti:</strong> " + e(text(ayah.translationDisplay == null ? ayah.translation : ayah.translationDisplay, "Terjemahan belum tersedia pada edisi aktif.")) + "</p>";
    return "<section class=\"it-record\" data-ayah=\"" + e(ayah.ayahNumber) + "\"><div class=\"it-record-head\"><span class=\"it-record-ref\">" + e(state.quran.surah.nameLatin + " " + ayah.ayahNumber) + "</span>" + badge(ayah.verificationStatus) + "</div><div class=\"it-arabic it-tajwid-arabic\" lang=\"ar\" dir=\"rtl\">" + tajwidArabicHtml(ayah) + "</div><p class=\"it-latin" + (byId("showLatinToggle").checked ? "" : " it-hidden") + "\">" + e(text(ayah.transliteration, "Transliterasi belum tersedia pada edisi aktif.")) + "</p>" + translation + tajwidStatus + (includeTafsir ? tafsir : "") + readingProgressHtml({type:includeTafsir?"tafsir":"quran",available:!includeTafsir||(ayah.tafsir||[]).some(function(t){return !!t.text&&t.status!=="error";}),surah:state.quran.surah.surahNumber,ayah:ayah.ayahNumber,workId:(state.quran.readingContext||{}).workId,language:(state.quran.readingContext||{}).language||"id",label:state.quran.surah.nameLatin+" "+state.quran.surah.surahNumber+":"+ayah.ayahNumber}) + provenanceHtml(ayah.source) + quranAudioHtml(ayah) + "<div class=\"it-record-actions\"><button class=\"it-button small\" data-ayah-detail=\"" + e(state.quran.surah.surahNumber + ":" + ayah.ayahNumber) + "\" type=\"button\">Detail & semua edisi</button>" + relations + "</div></section>";
  }
  async function loadQuran(includeTafsir) {
    if (!includeTafsir) syncQuranRange(false);
    var button = includeTafsir ? byId("loadTafsirButton") : byId("loadQuranButton");
    var requestId = ++state.quranRequestId;
    var routePanel = includeTafsir ? "tafsir" : "quran";
    if (readingReady && document.querySelector('.it-panel.active')?.dataset.panel === routePanel) {
      window.MpmReaderNavigation?.update({panel:routePanel,surah:byId(includeTafsir?"tafsirSurahSelect":"quranSurahSelect").value,ayah:byId(includeTafsir?"tafsirStartInput":"quranStartInput").value,work:includeTafsir?byId("tafsirWorkSelect").value:null,"reading-language":includeTafsir?byId("tafsirLanguageSelect").value:byId("readerLanguageSelect").value});
    }
    setBusy(button, true);
    try {
      if (includeTafsir) {
        var reference = selectedTafsirReference();
        if (reference) {
          await loadOnlineTafsir(reference);
          return;
        }
      }
      var params = includeTafsir ? {
        surah: byId("tafsirSurahSelect").value, start: byId("tafsirStartInput").value, count: selectedTafsirCount(),
        language: byId("readerLanguageSelect").value, tafsir_work_id: byId("tafsirWorkSelect").value,
        tafsir_language: byId("tafsirLanguageSelect").value
      } : {
        surah: byId("quranSurahSelect").value, start: selectedQuranStart(), count: selectedQuranCount(),
        language: byId("readerLanguageSelect").value,
        transliteration_edition_id: byId("quranTransliterationSelect").value, reciter_id: byId("quranReciterSelect").value
      };
      var responses = await Promise.all([
        apiGet("quran", params),
        Promise.resolve(null)
      ]);
      if (requestId !== state.quranRequestId) return;
      state.quran = responses[0];
      state.quran.readingContext = {workId:params.tafsir_work_id,language:params.tafsir_language || params.language};
      var target = includeTafsir ? byId("tafsirReader") : byId("quranReader");
      target.className = "it-reading-list " + state.layout;
      var readerHtml = state.quran.ayahs.map(function (ayah) { return quranRecordHtml(ayah, includeTafsir); }).join("");
      target.innerHTML = readerHtml || "<div class=\"it-empty\">Tidak ada data pada rentang ini.</div>";
      if (!includeTafsir) { setupAudioPlaylist(); renderTajwidLegend(); }
      if (includeTafsir) {
        var work = (state.bootstrap.catalog.tafsirs || []).find(function (item) { return String(item.id) === String(byId("tafsirWorkSelect").value); });
        byId("tafsirReaderTitle").textContent = work ? work.title + " · " + state.quran.surah.nameLatin : state.quran.surah.nameLatin;
        renderTafsirReaderMeta();
      } else {
        byId("quranSurahTitle").textContent = state.quran.surah.surahNumber + ". " + state.quran.surah.nameLatin + " · " + state.quran.surah.nameArabic;
        byId("quranReferenceLabel").textContent = "Ayat " + state.quran.start + "–" + state.quran.end + " dari " + state.quran.surah.ayahCount;
        byId("quranPreviousButton").disabled = !state.quran.hasPrevious;
        byId("quranNextButton").disabled = !state.quran.hasNext;
      }
      setConnectivity();
    } catch (error) {
      toast(error.message, true);
      (includeTafsir ? byId("tafsirReader") : byId("quranReader")).innerHTML = "<div class=\"it-empty\">" + e(error.message) + "</div>";
    } finally { if (requestId === state.quranRequestId) setBusy(button, false); }
  }

  function setupAudioPlaylist() {
    state.audio.playlist = (state.quran.ayahs || []).map(function (ayah) { var resource = (ayah.audio || [])[0]; return resource ? { ayah: ayah.ayahNumber, url: resource.playbackUrl, reciter: resource.reciter, offline: !!resource.offlineAvailable, bitrate: resource.bitrate } : null; }).filter(Boolean);
    state.audio.index = -1;
    state.audio.fullSurah = (state.quran.surahAudio || [])[0] || null;
    byId("audioPlaySurahButton").disabled = !state.audio.fullSurah;
    byId("audioNowLabel").textContent = state.audio.playlist.length ? "Pilih tombol putar pada ayat" : "Audio qari ini tidak tersedia";
  }
  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "00:00";
    var minutes = Math.floor(seconds / 60), remain = Math.floor(seconds % 60);
    return String(minutes).padStart(2, "0") + ":" + String(remain).padStart(2, "0");
  }
  function playAudioAt(index) {
    if (!state.audio.playlist.length) return;
    index = Math.max(0, Math.min(state.audio.playlist.length - 1, index));
    var item = state.audio.playlist[index], audio = byId("quranMasterAudio");
    state.audio.index = index;
    if (audio.src !== new URL(item.url, location.href).href) audio.src = item.url;
    audio.playbackRate = Number(byId("audioSpeedSelect").value || 1);
    audio.play().catch(function (error) { toast("Audio tidak dapat diputar: " + error.message, true); });
    byId("audioNowLabel").textContent = state.quran.surah.nameLatin + " ayat " + item.ayah + " · " + item.reciter;
    byId("audioSourceState").textContent = item.offline ? "File lokal/offline" : "Streaming online";
    document.querySelectorAll(".it-record[data-ayah]").forEach(function (node) { node.classList.toggle("is-audio-active", Number(node.dataset.ayah) === Number(item.ayah)); });
  }
  function playAyahNumber(ayahNumber) {
    var index = state.audio.playlist.findIndex(function (item) { return Number(item.ayah) === Number(ayahNumber); });
    if (index >= 0) playAudioAt(index); else toast("Audio ayat ini belum tersedia untuk qari aktif.", true);
  }
  function playFullSurah() {
    var item = state.audio.fullSurah; if (!item) return;
    var audio = byId("quranMasterAudio"); state.audio.index = -1; audio.src = item.playbackUrl; audio.playbackRate = Number(byId("audioSpeedSelect").value || 1); audio.play().catch(function (error) { toast(error.message, true); });
    byId("audioNowLabel").textContent = state.quran.surah.nameLatin + " · satu surah · " + item.reciter;
    byId("audioSourceState").textContent = item.offlineAvailable ? "File surah lokal/offline" : "Streaming satu surah";
  }
  function bindAudioEngine() {
    var audio = byId("quranMasterAudio");
    byId("audioPlayButton").addEventListener("click", function () { if (!audio.src && state.audio.playlist.length) playAudioAt(Math.max(0, state.audio.index)); else if (audio.paused) audio.play(); else audio.pause(); });
    byId("audioReplayButton").addEventListener("click", function () { audio.currentTime = 0; audio.play(); });
    byId("audioPreviousButton").addEventListener("click", function () { playAudioAt(Math.max(0, state.audio.index - 1)); });
    byId("audioNextButton").addEventListener("click", function () { playAudioAt(Math.min(state.audio.playlist.length - 1, state.audio.index + 1)); });
    byId("audioPlaySurahButton").addEventListener("click", playFullSurah);
    byId("audioProgressRange").addEventListener("input", function () { if (isFinite(audio.duration) && audio.duration > 0) audio.currentTime = audio.duration * (Number(this.value) / 1000); });
    byId("audioSpeedSelect").addEventListener("change", function () { audio.playbackRate = Number(this.value); savePreferencesSoon(); });
    ["audioRepeatSelect", "audioAutoNextToggle"].forEach(function (id) { byId(id).addEventListener("change", savePreferencesSoon); });
    audio.addEventListener("play", function () { byId("audioPlayButton").textContent = "Jeda"; });
    audio.addEventListener("pause", function () { byId("audioPlayButton").textContent = window.PrayerI18n.uiText("Putar"); });
    audio.addEventListener("timeupdate", function () { byId("audioCurrentTime").textContent = formatTime(audio.currentTime); byId("audioDuration").textContent = formatTime(audio.duration); byId("audioProgressRange").value = isFinite(audio.duration) && audio.duration ? Math.round((audio.currentTime / audio.duration) * 1000) : 0; });
    audio.addEventListener("ended", function () {
      var repeat = byId("audioRepeatSelect").value;
      if (repeat === "ayah") { audio.currentTime = 0; audio.play(); return; }
      if (state.audio.index < 0) return;
      if (state.audio.index < state.audio.playlist.length - 1 && (repeat === "range" || byId("audioAutoNextToggle").checked)) playAudioAt(state.audio.index + 1);
      else if (repeat === "range") playAudioAt(0);
    });
  }

  function gradingTone(grade) {
    var family = String(grade && grade.classificationFamily || "");
    if (family === "ACCEPTED_ASSESSMENT") return "good";
    if (family === "CRITICAL_ASSESSMENT") return "bad";
    if (family === "WEAK_ASSESSMENT" || family === "DEFECT_ASSESSMENT") return "warn";
    return "neutral";
  }
  function gradingHtml(gradings) {
    if (!gradings || !gradings.length) return "<span class=\"it-badge neutral\">BELUM ADA DATA GRADING PER RECORD</span>";
    return gradings.map(function (grade) {
      var grader = text(grade.gradedBy, "penilai tidak dicantumkan");
      var evidence = grade.evidenceStatus === "DIRECT_REFERENCE_VERIFIED" ? "rujukan langsung" : grade.evidenceStatus === "AGGREGATOR_UNVERIFIED" ? "rujukan asli belum tersedia" : text(grade.evidenceStatus, "status bukti belum dicatat");
      var tooltip = ["Normalisasi: " + text(grade.normalizedGrade), "Cakupan: " + text(grade.gradeScope, "REPORT"), "Bukti: " + evidence].join(" · ");
      return "<span class=\"it-badge " + gradingTone(grade) + "\" title=\"" + e(tooltip) + "\"><strong>" + e(text(grade.grade, grade.normalizedGrade)) + "</strong> · menurut " + e(grader) + "</span>";
    }).join("");
  }
  function gradingSummaryHtml(summary, compact) {
    if (!summary) return "";
    var counts = summary.counts || {}, evidence = summary.evidence || {};
    var countText = [
      Number(counts.accepted || 0) ? counts.accepted + " menerima" : "",
      Number(counts.weak || 0) ? counts.weak + " daif" : "",
      Number(counts.critical || 0) ? counts.critical + " kritis" : "",
      Number(counts.defect || 0) ? counts.defect + " catatan cacat" : ""
    ].filter(Boolean).join(" · ");
    var evidenceText = Number(evidence.aggregatorUnverified || 0) ? evidence.aggregatorUnverified + " baris agregator belum punya rujukan langsung" : Number(evidence.directVerified || 0) ? evidence.directVerified + " rujukan langsung terverifikasi" : "";
    return "<section class=\"it-grading-summary " + e(text(summary.level, "info")) + (compact ? " compact" : "") + "\"><strong>" + e(summary.title) + "</strong><p>" + e(summary.message) + "</p>" + ((countText || evidenceText) ? "<small>" + e([countText, evidenceText].filter(Boolean).join(" · ")) + "</small>" : "") + "<span class=\"it-system-verdict\">Bukan vonis sistem</span></section>";
  }
  function safeSourceLink(url, label) {
    return /^https?:\/\//i.test(String(url || "")) ? "<a target=\"_blank\" rel=\"noopener noreferrer\" href=\"" + e(url) + "\">" + e(label) + "</a>" : "";
  }
  function gradingDetailHtml(gradings) {
    if (!gradings || !gradings.length) return "<div class=\"it-notice\"><strong>Belum ada data grading per record.</strong><p>Ini bukan kesimpulan bahwa hadis belum pernah dinilai; database lokal belum menyimpan penilaian per record untuk edisi ini.</p></div>";
    return "<div class=\"it-grading-detail-list\">" + gradings.map(function (grade) {
      var evidenceLabel = grade.evidenceStatus === "DIRECT_REFERENCE_VERIFIED" ? "Rujukan langsung terverifikasi" : grade.evidenceStatus === "AGGREGATOR_UNVERIFIED" ? "Agregator—rujukan asli belum tersedia" : text(grade.evidenceStatus, "Status bukti belum dicatat");
      var direct = grade.directSourceUrl ? safeSourceLink(grade.directSourceUrl, "Buka rujukan grading langsung") : "";
      return "<article class=\"it-grading-detail-card " + gradingTone(grade) + "\"><header><strong>" + e(text(grade.grade, grade.normalizedGrade)) + "</strong><span>menurut " + e(text(grade.gradedBy, "penilai tidak dicantumkan")) + "</span></header><dl><dt>Normalisasi pencarian</dt><dd>" + e(text(grade.normalizedGrade)) + "</dd><dt>Cakupan</dt><dd>" + e(text(grade.gradeScope, "REPORT")) + "</dd><dt>Keluarga klasifikasi</dt><dd>" + e(text(grade.classificationFamily)) + "</dd><dt>Status bukti</dt><dd>" + e(evidenceLabel) + "</dd><dt>Sumber data</dt><dd>" + e([grade.gradingSource, grade.gradingEdition, grade.sourceName].filter(Boolean).join(" · ")) + "</dd>" + (grade.directSourceReference ? "<dt>Isi rujukan</dt><dd>" + e(grade.directSourceReference) + "</dd>" : "") + (direct ? "<dt>Rujukan langsung</dt><dd>" + direct + "</dd>" : "") + (grade.notes ? "<dt>Catatan</dt><dd>" + e(grade.notes) + "</dd>" : "") + "</dl></article>";
    }).join("") + "</div>";
  }
  function hadithRecordHtml(record) {
    if(record.importProvenance&&window.MpmBookPresentation)return window.MpmBookPresentation.html(record.importProvenance.metadata,record.importProvenance.draft)+readingProgressHtml({type:'hadith',hadithId:record.id,language:record.importProvenance.metadata.language,label:record.collection+' · '+record.hadithNumber})+reviewedImportHtml(record,true)+gradingSummaryHtml(record.gradingSummary,true);
    var language = byId("hadithLanguageSelect").value;
    var arabicHtml = "<div class=\"it-arabic it-hadith-arabic\" lang=\"ar\" dir=\"rtl\">" + e(text(record.arabic, "Dalil Arab belum tersedia.")) + "</div>";
    var latin = record.transliteration || transliterateArabicHadith(record.arabic);
    var latinHtml = byId("hadithLatinToggle") && byId("hadithLatinToggle").checked && latin
      ? "<div class=\"it-hadith-latin\"><strong><span data-i18n=\"ui.13ebca01\">Latin</span></strong><p class=\"it-latin\">" + e(latin) + "</p></div>"
      : "";
    var translationLabel = language === "en" ? "Meaning" : (record.translation ? "Bahasa Indonesia — edisi resmi sumber" : "Artinya");
    var translationHtml = language === "ar" ? "" : "<div class=\"it-source-original\"><strong>" + translationLabel + "</strong><p dir=\"auto\">" + e(text(record.translation, "Terjemahan belum tersedia.")) + "</p></div>";
    return "<article class=\"it-record it-hadith-record\"><div class=\"it-record-head\"><span class=\"it-record-ref\">" + e(record.collection + " · no. " + record.hadithNumber) + "</span>" + badge(record.verificationStatus) + "</div>" + arabicHtml + latinHtml + translationHtml + readingProgressHtml({type:"hadith",hadithId:record.id,language:state.hadith.language||language,label:record.collection+" · hadis "+record.hadithNumber}) + reviewedImportHtml(record) + gradingSummaryHtml(record.gradingSummary, true) + "<div class=\"it-grading-list\">" + gradingHtml(record.gradings) + "</div><div class=\"it-record-actions\"><button class=\"it-button small\" type=\"button\" data-hadith-detail=\"" + e(record.internalHadithId) + "\">Detail sumber, edisi & penilaian</button></div></article>";
  }
  window.IslamicTextOpenReviewedImport = async function (entry, metadata, draft) {
    if (['asbab_al_nuzul','fiqh','usul_fiqh','qawaid_fiqhiyyah','comparative_fiqh'].includes(entry.type)) {
      await window.MpmClassical.openImport(entry, metadata);
      return;
    }
    var refreshed=await Promise.all([apiGet('catalog'),apiGet('tafsir_manager')]);
    state.bootstrap=state.bootstrap||{};
    state.bootstrap.catalog=refreshed[0];state.bootstrap.tafsirManager=refreshed[1];
    populateCatalog(refreshed[0]);renderTafsirManager(refreshed[1]);
    var type=entry.type;
    document.querySelector('.it-tabs button[data-tab="'+type+'"]').click();
    if(type==='tafsir') {
      byId('tafsirFamilySelect').value=entry.familyId;renderTafsirLanguages();
      byId('tafsirLanguageSelect').value=metadata.language;renderTafsirWorks();
      byId('tafsirWorkSelect').value=entry.workId;
      byId('tafsirSurahSelect').value=draft.surah;byId('tafsirStartInput').value=draft.ayahStart;
      renderTafsirCountOptions();await loadQuran(true);
    } else {
      byId('hadithCollectionSelect').value=entry.collectionId;
      byId('hadithLanguageSelect').value=metadata.language;
      byId('hadithGradeSelect').value='';byId('hadithQueryInput').value=draft.number;
      await loadHadith(1);
    }
  };
  function reviewedImportHtml(record,omitParts) {
    var p=record.importProvenance;if(!p)return "";
    var m=p.metadata||{},d=p.draft||{},s=p.source||{},languages={ar:"Arabic",en:"English",id:"Indonesia"};
    var label=(languages[m.language]||m.language)+" — "+(m.translationStatus==="manual_translation"?"Manual Translation":"Original Source");
    var fields=[m.type,m.author,m.book,label,d.chapter||"",m.type==="tafsir"?"QS "+d.surah+":"+d.ayahStart+"–"+d.ayahEnd:"Hadith "+d.number,"Source: "+(m.sourceLabel||m.edition||p.filename),"Document: "+p.filename+" ("+p.format+")",s.pageStart?"Halaman "+s.pageStart+"–"+s.pageEnd:"Halaman fisik tidak tersedia", "Import: "+p.created_at, "Review: "+p.reviewed_by+" · "+p.reviewed_at];
    if(m.translationStatus==="manual_translation")fields.push("Source Language: "+(languages[m.sourceLanguage]||m.sourceLanguage),"Translator: "+m.translator);
    var html='<section class="it-reviewed-import"><strong>'+e(label)+'</strong><div class="it-provenance">'+fields.filter(Boolean).map(function(v){return '<span>'+e(v)+'</span>';}).join('')+'</div><a href="api/reviewed-document-import.php?download='+Number(p.batchId)+'">Dokumen sumber</a>'+(p.source_url?' · '+safeSourceLink(p.source_url,'Source URL'):'');
    var roles={quran:"Embedded Quranic Evidence",commentary:"Explanation / Commentary",reference:"Reference / Source",isnad:"Sanad",other:"Bagian pendukung"};
    if(!omitParts)(d.parts||[]).filter(function(part){return part.role!=="main"&&part.text;}).forEach(function(part){html+='<section class="it-import-part"><strong>'+e(roles[part.role]||part.role)+'</strong><p dir="auto">'+e(part.text)+'</p></section>';});
    return html+'</section>';
  }
  function transliterateArabicHadith(value) {
    var source = String(value || "").trim();
    if (!source) return "";
    var letters = {
      "ا":"a","أ":"a","إ":"i","آ":"ā","ى":"ā","ب":"b","ت":"t","ث":"th","ج":"j","ح":"ḥ","خ":"kh",
      "د":"d","ذ":"dh","ر":"r","ز":"z","س":"s","ش":"sh","ص":"ṣ","ض":"ḍ","ط":"ṭ","ظ":"ẓ","ع":"ʿ",
      "غ":"gh","ف":"f","ق":"q","ك":"k","ل":"l","م":"m","ن":"n","ه":"h","و":"w","ي":"y","ء":"ʾ",
      "ة":"ah","ؤ":"ʾ","ئ":"ʾ"
    };
    var marks = { "\u064e":"a", "\u0650":"i", "\u064f":"u", "\u064b":"an", "\u064d":"in", "\u064c":"un" };
    function word(input) {
      var chars = Array.from(input), result = "", previousBase = "";
      for (var index = 0; index < chars.length; index += 1) {
        var character = chars[index];
        if (/[\u064B-\u065F\u0670]/.test(character)) continue;
        var following = [], next = index + 1;
        while (next < chars.length && /[\u064B-\u065F\u0670]/.test(chars[next])) following.push(chars[next++]);
        var base = letters[character];
        if (!base) { result += character; continue; }
        if ((character === "ا" || character === "أ" || character === "إ") && following.length) base = "";
        if ((character === "ا" || character === "ى") && (previousBase === "a" || previousBase === "i" || previousBase === "u")) {
          result = result.slice(0, -1) + ({ a: "ā", i: "ī", u: "ū" }[previousBase] || "ā");
          previousBase = "";
          continue;
        }
        var vowel = "";
        following.forEach(function (mark) { if (marks[mark]) vowel = marks[mark]; });
        var isShadda = following.indexOf("\u0651") >= 0;
        if (isShadda && result && previousBase !== base && base !== "a" && base !== "i" && base !== "u") result += base;
        result += base;
        if (vowel) result += vowel;
        previousBase = vowel || base;
        index = next - 1;
      }
      return result;
    }
    return source.replace(/اللَّه/g, "الله").split(/(\s+)/).map(function (part) {
      return /^\s+$/.test(part) ? part : word(part);
    }).join("").replace(/\ballh([aiu])/gi, "Allāh$1").replace(/\ballah\b/gi, "Allāh").replace(/\s+/g, " ").replace(/\s+([,.:;!?،؛؟])/g, "$1").trim();
  }
  function normalizedIslamicWorkTitle(value) {
    return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/\b(english|indonesian|indonesia|arabic|bahasa|edition|edisi)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }
  function sameIslamicWorkTitle(left, right) {
    var a = normalizedIslamicWorkTitle(left), b = normalizedIslamicWorkTitle(right);
    return !!a && !!b && (a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0);
  }
  function automationReaderReference(record) {
    var metadata = record.metadata || {};
    var surah = Number(metadata.surahNumber || metadata.surah || 0);
    var start = Number(metadata.ayahStart || metadata.ayah || 0);
    var end = Number(metadata.ayahEnd || start || 0);
    if (surah && start) return text(record.workTitle, record.contentType) + " · QS " + surah + ":" + start + (end > start ? "-" + end : "");
    if (metadata.collection || metadata.hadithNumber) return [record.workTitle, metadata.collection, metadata.hadithNumber && "no. " + metadata.hadithNumber].filter(Boolean).join(" · ");
    return text(record.workTitle, record.contentType) + " · halaman sumber " + text(record.pageNumber, "belum tercatat") + " · belum dipetakan ke ayat/nomor hadis";
  }
  function automationReaderRecordHtml(record) {
    var sourceLanguage = record.sourceLanguage || (record.arabic ? "ar" : "en");
    var languageNames = { ar: "Arabic", en: "English", id: "Bahasa Indonesia" };
    var sourceText = sourceLanguage === "ar" ? record.arabic : (sourceLanguage === "id" ? record.sourceIndonesian : record.english);
    var original = sourceLanguage === "ar" ? "<div class=\"it-arabic\" lang=\"ar\" dir=\"rtl\">" + e(text(sourceText, "Teks sumber belum tersedia.")) + "</div>" : "<div class=\"it-source-original\"><strong>" + e(languageNames[sourceLanguage] || sourceLanguage.toUpperCase()) + " · Teks sumber</strong><p dir=\"auto\">" + e(text(sourceText, "Teks sumber belum tersedia.")) + "</p></div>";
    var source = record.sourceUrl ? safeSourceLink(record.sourceUrl, "Buka laman sumber") : "URL sumber belum tersedia";
    var passageLabels = { hadith: "ISI HADIS", tafsir_commentary: "ISI TAFSIR", publication_info: "INFORMASI PENERBIT", introduction: "PENGANTAR" };
    return "<article class=\"it-record it-automation-reader-record\"><div class=\"it-record-head\"><span class=\"it-record-ref\">" + e(automationReaderReference(record)) + "</span><span>" + badge(passageLabels[record.passageType] || text(record.passageType, "HASIL EKSTRAKSI")) + " " + badge(record.extractionVerification || record.recordStatus) + "</span></div><h3>" + e(text(record.heading, record.workTitle)) + "</h3>" + original + "<div class=\"it-online-source-meta\"><strong>Sumber:</strong> " + e(text(record.sourceName, "provider tercatat")) + " · " + source + " · ditemukan " + e(text(record.discoveredAt)) + "</div></article>";
  }
  async function loadReaderAutomation(type) {
    try {
      var selectedLanguage = type === "hadith" ? byId("hadithLanguageSelect").value : byId("readerLanguageSelect").value;
      var targetLanguage = ["ar", "en", "id"].includes(selectedLanguage) ? selectedLanguage : "id";
      var family = type === "tafsir" ? (((state.bootstrap.tafsirManager || {}).works) || []).find(function (item) { return String(item.id) === String(byId("tafsirFamilySelect").value); }) : null;
      var data = await apiGet("automation_library", { type: type, language: targetLanguage, work: family ? family.canonicalTitle : "", limit: 30, refresh: Date.now() });
      state.automationLibrary[type] = data;
      return data;
    } catch (error) {
      return state.automationLibrary[type] || { records: [] };
    }
  }
  function readerAutomationRecords(type) {
    var records = ((state.automationLibrary[type] || {}).records || []).slice();
    if (type === "tafsir") {
      var familyId = byId("tafsirFamilySelect").value;
      var family = (((state.bootstrap.tafsirManager || {}).works) || []).find(function (item) { return String(item.id) === String(familyId); });
      var work = (state.bootstrap.catalog.tafsirs || []).find(function (item) { return String(item.id) === String(byId("tafsirWorkSelect").value); });
      var names = [family && family.canonicalTitle, work && work.canonicalWorkTitle, work && work.title].filter(Boolean);
      var currentSurah = Number(byId("tafsirSurahSelect").value || 0);
      var rangeStart = Number(byId("tafsirStartInput").value || 1);
      var selectedCount = selectedTafsirCount();
      var rangeEnd = rangeStart + selectedCount - 1;
      records = records.filter(function (record) {
        // A stale/offline API payload must not render a quoted Hadith passage
        // as Tafsir commentary.
        if (record.passageType !== "tafsir_commentary") return false;
        if (names.length && !names.some(function (name) { return sameIslamicWorkTitle(record.workTitle, name); })) return false;
        var metadata = record.metadata || {};
        var recordSurah = Number(metadata.surahNumber || metadata.surah_number || metadata.surah || 0);
        // Unmapped document candidates do not belong in a surah-specific reader.
        if (!recordSurah) return false;
        var recordStart = Number(metadata.ayahStart || metadata.ayah_start || metadata.ayah || 1);
        var recordEnd = Number(metadata.ayahEnd || metadata.ayah_end || recordStart);
        return recordSurah === currentSurah && recordStart <= rangeEnd && recordEnd >= rangeStart;
      });
      return records.slice(0, selectedCount);
    }
    if (state.hadithPage !== 1) return [];
    var collection = byId("hadithCollectionSelect").value;
    var collectionLabel = collection ? byId("hadithCollectionSelect").selectedOptions[0].textContent.replace(/\s*\(\d+\)\s*$/, "") : "";
    var query = byId("hadithQueryInput").value.trim().toLowerCase();
    records = records.filter(function (record) {
      var metadata = record.metadata || {};
      var haystack = [record.workTitle, record.heading, record.arabic, record.english, record.sourceIndonesian, metadata.collection, metadata.hadithNumber].join(" ").toLowerCase();
      if (collection && !sameIslamicWorkTitle(record.workTitle || metadata.collection, collectionLabel)) return false;
      return !query || haystack.indexOf(query) >= 0;
    });
    return records.slice(0, Math.max(1, Number(byId("hadithPageSizeSelect").value || 25)));
  }
  async function loadHadith(page) {
    var button = byId("loadHadithButton");
    setBusy(button, true);
    try {
      state.hadithPage = Math.max(1, Number(page || 1));
      var responses = await Promise.all([
        apiGet("hadiths", {
          collection_id: byId("hadithCollectionSelect").value, language: byId("hadithLanguageSelect").value,
          grade: byId("hadithGradeSelect").value, include_transliteration: byId("hadithLatinToggle").checked, q: byId("hadithQueryInput").value.trim(), page: state.hadithPage,
          page_size: byId("hadithPageSizeSelect").value
        }),
        Promise.resolve(null)
      ]);
      state.hadith = responses[0];
      var readerHtml = state.hadith.records.map(hadithRecordHtml).join("");
      byId("hadithReader").innerHTML = readerHtml || "<div class=\"it-empty\">Belum ada hadis yang sesuai filter.</div>";
      byId("hadithResultTitle").textContent = state.hadith.total + " record ditemukan";
      byId("hadithPageLabel").textContent = state.hadith.page + " / " + state.hadith.totalPages;
      byId("hadithPreviousButton").disabled = state.hadith.page <= 1;
      byId("hadithNextButton").disabled = state.hadith.page >= state.hadith.totalPages;
      setConnectivity();
    } catch (error) { toast(error.message, true); byId("hadithReader").innerHTML = "<div class=\"it-empty\">" + e(error.message) + "</div>"; }
    finally { setBusy(button, false); }
  }

  async function openAyahDetail(reference) {
    var parts = String(reference).split(":");
    try {
      var data = await apiGet("ayah", { surah: parts[0], ayah: parts[1], language: byId("readerLanguageSelect").value });
      var ayah = data.ayah;
      byId("recordDetailContent").innerHTML = "<p class=\"it-eyebrow\">Qur'an " + e(parts.join(":")) + "</p><h2>" + e(data.surah.nameLatin) + " ayat " + e(ayah.ayahNumber) + "</h2><div class=\"it-arabic\" lang=\"ar\" dir=\"rtl\">" + e(ayah.arabic) + "</div><h3>Terjemahan yang tersimpan</h3>" + (ayah.translations || []).map(function (row) { return "<section class=\"it-record\"><strong>" + e(row.language.toUpperCase() + " · " + row.editionTitle) + "</strong><p>" + e(row.text) + "</p>" + provenanceHtml(row) + "</section>"; }).join("") + "<h3><span data-i18n=\"ui.52d92b34\">Transliterasi</span></h3>" + ((ayah.transliterations || []).length ? ayah.transliterations.map(function (row) { return "<section class=\"it-record\"><strong>" + e(row.editionTitle) + "</strong><p class=\"it-latin\">" + e(row.text) + "</p>" + provenanceHtml(row) + "</section>"; }).join("") : "<p>Belum tersedia.</p>") + "<h3>Tafsir yang mencakup ayat ini</h3>" + ((ayah.allTafsir || []).length ? ayah.allTafsir.map(function (row) { return "<section class=\"it-tafsir\"><strong>" + e(row.title + (row.author ? " — " + row.author : "")) + "</strong><p>" + e(row.text) + "</p>" + provenanceHtml(row) + "</section>"; }).join("") : "<p>Belum tersedia.</p>");
      byId("recordDetailDialog").showModal();
    } catch (error) { toast(error.message, true); }
  }
  function relatedQuranHtml(rows) {
    if (!rows || !rows.length) return "";
    return "<h3>Ayat Qur'an terkait yang telah dikurasi</h3>" + rows.map(function (ayah) {
      return "<section class=\"it-record it-related-quran\"><div class=\"it-record-head\"><strong>QS. " + e(ayah.surahName + " [" + ayah.surahNumber + "]: " + ayah.ayahNumber) + "</strong>" + badge(ayah.verificationStatus) + "</div><div class=\"it-arabic\" lang=\"ar\" dir=\"rtl\">" + e(ayah.arabic) + "</div><p class=\"it-latin\">" + e(text(ayah.transliteration)) + "</p><p class=\"it-translation\">" + e(text(ayah.translation)) + "</p><p class=\"it-help\"><strong>Jenis relasi:</strong> " + e(ayah.relationType) + " · " + e(text(ayah.description)) + "</p></section>";
    }).join("");
  }
  async function openHadithDetail(id) {
    try {
      var row = await apiGet("hadith", { id: id, language: byId("hadithLanguageSelect").value });
      var detailLatin = byId("hadithLatinToggle") && byId("hadithLatinToggle").checked ? (row.transliteration || transliterateArabicHadith(row.arabic)) : "", detailMeaningLabel = byId("hadithLanguageSelect").value === "en" ? "Meaning" : "Artinya";
      byId("recordDetailContent").innerHTML = "<p class=\"it-eyebrow\">" + e(row.internalHadithId) + "</p><h2>" + e(row.collection + " · no. " + row.hadithNumber) + "</h2><div class=\"it-arabic\" lang=\"ar\" dir=\"rtl\">" + e(row.arabic) + "</div>" + (detailLatin ? "<div class=\"it-hadith-latin\"><strong><span data-i18n=\"ui.13ebca01\">Latin</span></strong><p class=\"it-latin\">" + e(detailLatin) + "</p></div>" : "") + "<h3>" + detailMeaningLabel + "</h3>" + (row.translations || []).map(function (translation) { return "<section class=\"it-record\"><strong>" + e((translation.language === "id" ? "Bahasa Indonesia — edisi resmi sumber" : translation.language.toUpperCase()) + " · " + translation.editionTitle) + "</strong><p>" + e(translation.text) + "</p>" + provenanceHtml(translation) + "</section>"; }).join("") + "<h3>Penilaian yang tersimpan</h3>" + gradingSummaryHtml(row.gradingSummary, false) + gradingDetailHtml(row.gradings) + "<h3>Referensi edisi</h3>" + ((row.references || []).length ? row.references.map(function (ref) { return "<p>" + e([ref.referenceSystem, ref.collectionName, ref.book, ref.chapter, ref.hadithNumber, ref.edition].filter(Boolean).join(" · ")) + (ref.sourceUrl ? " · " + safeSourceLink(ref.sourceUrl, "sumber") : "") + "</p>"; }).join("") : "<p>Belum tersedia.</p>") + relatedQuranHtml(row.relatedQuran) + reviewedImportHtml(row) + provenanceHtml(row);
      byId("recordDetailDialog").showModal();
    } catch (error) { toast(error.message, true); }
  }

  function learningIdentityId(row) { return String(row && (row.userId || row.user_id || row.actorId || row.id) || "").trim(); }
  function learningIdentityName(row) { return text(row && (row.displayName || row.display_name || row.fullName || row.name || row.email), learningIdentityId(row)); }
  function learningIdentityRoles(row) {
    var roles = row && (row.roles || row.roleCodes || row.role_codes || row.role) || [];
    if (!Array.isArray(roles)) roles = String(roles || "").split(",");
    return roles.map(function (role) { return String(role && (role.roleKey || role.role_key || role.code || role.name) || role || "").toLowerCase(); }).filter(Boolean);
  }
  function learningIdentityHasRole(row, accepted) { return learningIdentityRoles(row).some(function (role) { return accepted.indexOf(role) >= 0; }); }
  function normalizeLearningIdentities(source) {
    source = source || {};
    function rows(value) { return Array.isArray(value) ? value : []; }
    var users = rows(source.users || source.identities || source.allUsers || source.all), students = rows(source.students), teachers = rows(source.teachers), examiners = rows(source.examiners);
    if (!users.length) users = students.concat(teachers,examiners);
    var unique = Object.create(null);
    users.concat(students,teachers,examiners).forEach(function (row) { var id=learningIdentityId(row); if(id && !unique[id]) unique[id]=row; });
    users=Object.keys(unique).map(function(id){return unique[id];});
    if(!students.length) students=users.filter(function(row){return learningIdentityHasRole(row,["student","admin","super-admin","super_admin"]);});
    if(!teachers.length) teachers=users.filter(function(row){return learningIdentityHasRole(row,["teacher","admin","super-admin","super_admin"]);});
    if(!examiners.length) examiners=users.filter(function(row){return learningIdentityHasRole(row,["examiner","teacher","admin","super-admin","super_admin"]);});
    return {users:users,students:students,teachers:teachers,examiners:examiners};
  }
  function learningIdentityOptions(rows, selectedId, emptyLabel) {
    var options=(rows || []).map(function(row){var id=learningIdentityId(row),roles=learningIdentityRoles(row);return "<option value=\""+e(id)+"\""+(String(id)===String(selectedId)?" selected":"")+">"+e(learningIdentityName(row)+(roles.length ? " · "+roles.join(", ") : ""))+"</option>";}).join("");
    return options || "<option value=\"\">"+e(emptyLabel || "Tidak ada pengguna yang memenuhi peran")+"</option>";
  }
  function learningLessons() {
    var output=[];
    ((state.learning.engine && state.learning.engine.levels) || []).forEach(function(level){(level.lessons || []).forEach(function(lesson){output.push({level:level,lesson:lesson});});});
    return output;
  }
  function renderLearningIdentityControls() {
    var account=window.MpmUserSession?.user,actor=learningActorId(),identities=state.learning.identities,en=document.documentElement.lang==='en';
    state.learning.actorId=actor;
    var actorSelect=byId('learningActorSelect');actorSelect.replaceChildren(new Option(account?.name||(en?'Log in to manage students and assessments':'Login untuk mengelola siswa dan pengujian'),actor));actorSelect.disabled=true;
    ['learningMaterialTeacherSelect','learningReviewTeacherSelect','learningTestTeacherSelect','learningTestExaminerSelect'].forEach(function(id){var node=byId(id);node.replaceChildren(new Option(account?.name||'',actor));node.disabled=true;});
    ['learningMaterialStudentSelect','learningReviewStudentSelect','learningTestStudentSelect','learningHistoryStudentSelect'].forEach(function(id){var node=byId(id),previous=node.value;node.replaceChildren(new Option(en?'Select student':'Pilih siswa',''));(identities.students||[]).forEach(function(row){node.add(new Option(learningIdentityName(row),learningIdentityId(row)));});if(Array.from(node.options).some(o=>o.value===previous))node.value=previous;node.disabled=!account;});
    document.querySelectorAll('[data-learning-primary]').forEach(function(node){node.disabled=!account&&node.dataset.learningPrimary!=='material';});
  }
  var lastLearningAccount=null;
  window.addEventListener('mpm:user-session-ready',async function(event){
    var next=event.detail.user?.userId||'';if(lastLearningAccount===next){renderLearningIdentityControls();return;}lastLearningAccount=next;
    state.learning.actorId=next;state.learning.admin=null;state.learning.history=null;
    state.learning.identities={users:[],students:[],teachers:[],examiners:[]};
    state.learning.review={session:null,questions:[],index:0,results:Object.create(null)};state.learning.test={attempt:null,questions:[],index:0,submitted:Object.create(null)};
    ['learningReviewWorkspace','learningTestWorkspace'].forEach(id=>byId(id).classList.add('it-hidden'));
    ['learningStudentList','learningStudentDetail','learningTestHistoryList','learningReviewHistoryList'].forEach(id=>{if(byId(id))byId(id).replaceChildren();});
    renderLearningIdentityControls();if(!next)showLearningPrimary('material',false);
    if(state.bootstrap){try{await refreshLearningCatalog();if(next)await loadLearningAdminCatalog(false);}catch(error){toast(error.message,true);}}
  });
  function learningLessonOptions(selectedId, levelId) {
    var rows=learningLessons().filter(function(row){return !levelId || Number(row.level.id)===Number(levelId);});
    return rows.map(function(row){return "<option value=\""+e(row.lesson.id)+"\""+(Number(row.lesson.id)===Number(selectedId)?" selected":"")+">Jilid "+e(row.level.levelNumber)+" · Bab "+e(row.lesson.lessonNumber)+" · "+e(row.lesson.title)+"</option>";}).join("") || "<option value=\"\">Belum ada bab</option>";
  }
  function renderLearningLessonSelectors() {
    var levels=(state.learning.engine && state.learning.engine.levels) || [],selectedLevel=Number(byId("learningMaterialLevelSelect").value || (levels[0] && levels[0].id)),selectedLesson=Number(byId("learningMaterialLessonSelect").value || (levels[0] && levels[0].firstLessonId));
    byId("learningMaterialLevelSelect").innerHTML=levels.map(function(level){return "<option value=\""+e(level.id)+"\""+(Number(level.id)===selectedLevel?" selected":"")+">Jilid "+e(level.levelNumber)+" · "+e(level.title)+"</option>";}).join("");
    byId("learningMaterialLessonSelect").innerHTML=learningLessonOptions(selectedLesson,selectedLevel);
    var reviewLesson=byId("learningReviewLessonSelect"),currentReviewLesson=reviewLesson.value;reviewLesson.innerHTML=learningLessonOptions(currentReviewLesson,0);
    var testLevel=byId("learningTestLevelSelect"),currentTestLevel=Number(testLevel.value || selectedLevel);testLevel.innerHTML=levels.map(function(level){return "<option value=\""+e(level.id)+"\""+(Number(level.id)===currentTestLevel?" selected":"")+">Jilid "+e(level.levelNumber)+" · "+e(level.title)+"</option>";}).join("");
    var testLesson=byId("learningTestLessonSelect"),currentTestLesson=testLesson.value;testLesson.innerHTML=learningLessonOptions(currentTestLesson,currentTestLevel);
    renderLearningTestScopeControls();
  }
  function showLearningPrimary(name, loadData) {
    name=["material","review","test","students","history","settings"].indexOf(name)>=0 ? name : "material";
    if(!learningActorId()&&name!=="material")name="material";
    state.learning.primary=name;
    document.querySelectorAll("[data-learning-primary]").forEach(function(button){var active=button.dataset.learningPrimary===name;button.classList.toggle("active",active);button.setAttribute("aria-selected",active ? "true" : "false");});
    document.querySelectorAll("[data-learning-primary-panel]").forEach(function(panel){panel.classList.toggle("it-hidden",panel.dataset.learningPrimaryPanel!==name);});
    if(name === "history" && loadData !== false) loadLearningTestHistory();
    if((name === "students" || name === "staff") && !state.learning.admin) loadLearningAdminCatalog(true);
  }
  function renderLearning(learning, catalog) {
    state.learning.engine = learning && learning.course ? learning : null;
    if (!state.learning.engine) {
      byId("learningDashboard").innerHTML = "<div class=\"it-empty\">Structured Learning belum tersedia. Jalankan migrasi dan seed Iqro.</div>";
      return;
    }
    var engine = state.learning.engine, course = engine.course, progress = engine.progress || {}, preferences = engine.preferences || {},levels=engine.levels || [];
    state.learning.identities=normalizeLearningIdentities(engine.identities || state.learning.identities);
    renderLearningIdentityControls();
    byId("learningCourseTitle").textContent = course.title;
    byId("learningCourseDescription").textContent = course.description + " · versi " + course.version + " · " + course.licenseStatus;
    var officialCompleted=levels.filter(function(level){return level.officialTest && level.officialTest.attemptId;}).length;
    byId("learningDashboard").innerHTML = [[Number(progress.masteryPercent || 0) + "%", "Penguasaan materi"],[Number(progress.masteredItems || 0) + " / " + Number(progress.totalItems || 0), "Contoh dikuasai"],[Number(progress.dueReview || 0), "Review jatuh tempo"],[officialCompleted + " / " + levels.length, "Jilid pernah diuji formal"]].map(function (row) { return "<div class=\"it-learning-stat\"><strong>" + e(row[0]) + "</strong><span>" + e(row[1]) + "</span></div>"; }).join("");
    byId("learningLevelPath").innerHTML = levels.map(function (level) { var official=level.officialTest || {},testLabel=official.attemptId ? "Test "+text(official.status)+" · "+Math.round(Number(official.score || 0))+"%" : "Belum ada test formal";return "<button type=\"button\" class=\"it-level-button " + e(String(level.status || "").toLowerCase()) + "\" data-learning-volume=\""+e(level.id)+"\"><strong>Jilid " + e(level.levelNumber) + " · " + e(level.title) + "</strong><span>" + e(level.itemCount + " contoh · materi " + level.completionPercent + "%") + "</span><span>"+e(testLabel)+"</span></button>"; }).join("");
    byId("learningMaterialOverview").innerHTML=levels.map(function(level){var lessons=level.lessons || [];return "<article class=\"it-learning-volume-card\"><header><div><p class=\"it-eyebrow\"><span data-i18n=\"ui.c74b298d\">Jilid</span> "+e(level.levelNumber)+"</p><h3>"+e(level.title)+"</h3></div>"+badge(level.status || "MATERIAL_AVAILABLE")+"</header><p class=\"it-help\">"+e(text(level.description))+"</p><ol>"+lessons.map(function(lesson){return "<li><button type=\"button\" data-learning-material-lesson=\""+e(lesson.id)+"\"><strong>Bab "+e(lesson.lessonNumber)+" · "+e(lesson.title)+"</strong><span>"+e(lesson.itemCount+" contoh · "+lesson.reviewCount+" soal review · "+lesson.testCount+" soal test")+"</span><span>"+e(text(lesson.targetCompetency,lesson.objective))+"</span></button></li>";}).join("")+"</ol></article>";}).join("") || "<div class=\"it-empty\">Daftar materi belum tersedia.</div>";
    var maximumLevel=levels.reduce(function(maximum,level){return Math.max(maximum,Number(level.levelNumber || 0));},1);["learningPackFromLevel","learningPackToLevel"].forEach(function(id){byId(id).max=String(maximumLevel);if(Number(byId(id).value)>maximumLevel)byId(id).value=String(maximumLevel);});
    renderLearningLessonSelectors();
    byId("learningSourceList").innerHTML = (engine.sources || []).map(function (source) { return "<article class=\"it-source-card\"><h3>" + e(source.name) + "</h3><div>" + badge(source.verificationStatus) + " " + badge(source.licenseStatus) + "</div><p class=\"it-help\">" + e(text(source.notes)) + "</p><a class=\"it-button small\" target=\"_blank\" rel=\"noopener\" href=\"" + e(source.sourceUrl) + "\">Buka sumber</a></article>"; }).join("");
    byId("tajwidRuleList").innerHTML = (catalog.tajwidRules || []).map(function (rule) { return "<article class=\"it-rule-card\"><h3>" + e(rule.nameId || rule.code) + "</h3><span class=\"it-rule-color\" style=\"background:" + e(rule.lightColor || "#dfe7e0") + "\"></span><p>" + e(text(rule.description)) + "</p><p class=\"it-help\">" + e(text(rule.readingInstruction)) + (rule.minHarakat ? " · " + e(rule.minHarakat + "–" + rule.maxHarakat + " harakat") : "") + "</p>" + badge("REFERENSI TAJWID") + "</article>"; }).join("") || "<div class=\"it-empty\">Registry tajwid belum tersedia.</div>";
    applyLearningPreferences(preferences);
    renderLearningPackEstimate();
    if(state.learning.admin)renderLearningMaterialTree();
    showLearningPrimary(state.learning.primary,false);
  }
  function renderLearningMaterialTree() {
    var curriculum=state.learning.admin&&state.learning.admin.curriculum,levels=curriculum&&curriculum.levels||[];if(!levels.length)return;
    byId("learningMaterialOverview").innerHTML=levels.filter(function(level){return level.isActive;}).map(function(level){return "<article class=\"it-learning-volume-card\"><header><div><p class=\"it-eyebrow\"><span data-i18n=\"ui.c74b298d\">Jilid</span> "+e(level.number)+"</p><h3>"+e(level.titleId)+"</h3></div>"+badge("MATERI")+"</header><p class=\"it-help\">"+e(text(level.descriptionId,"Urutan materi dapat dikelola tanpa mengubah riwayat siswa."))+"</p><ol>"+(level.chapters||[]).filter(function(chapter){return chapter.isActive;}).map(function(chapter){return "<li><button type=\"button\" data-learning-material-lesson=\""+e(chapter.id)+"\"><strong>Bab "+e(chapter.number)+" · "+e(chapter.titleId)+"</strong><span>"+(chapter.lessons||[]).filter(function(lesson){return lesson.isActive;}).map(function(lesson){var examples=(lesson.examples||[]).filter(function(example){return example.isActive;});return "<b>"+e(lesson.titleId)+"</b>: "+examples.slice(0,8).map(function(example){return "<span lang=\"ar\" dir=\"rtl\">"+e(example.arabic)+"</span>";}).join(" · ")+(examples.length>8?" · …":"");}).join("<br>")+"</span><span>"+e(text(chapter.goalId,chapter.instructionId))+"</span></button></li>";}).join("")+"</ol></article>";}).join("");
  }
  function learningAdminCurriculumRows() {
    var admin=state.learning.admin || {},curriculum=admin.curriculum || {},levels=curriculum.levels || [],rows={level:[],chapter:[],lesson:[],example:[]};
    levels.forEach(function(level){rows.level.push(level);(level.chapters||[]).forEach(function(chapter){chapter.levelNumber=level.number;chapter.levelTitle=level.titleId;chapter.levelIsActive=level.isActive;rows.chapter.push(chapter);(chapter.lessons||[]).forEach(function(lesson){lesson.chapterId=chapter.id;lesson.chapterNumber=chapter.number;lesson.chapterTitle=chapter.titleId;lesson.chapterIsActive=chapter.isActive;lesson.levelId=level.id;lesson.levelNumber=level.number;lesson.levelIsActive=level.isActive;rows.lesson.push(lesson);(lesson.examples||[]).forEach(function(example){example.levelId=level.id;example.chapterId=chapter.id;example.unitId=lesson.id;example.lessonTitle=lesson.titleId;rows.example.push(example);});});});});
    return rows;
  }
  function learningUnitsForChapter(chapterId,activeOnly){return learningAdminCurriculumRows().lesson.filter(function(row){return Number(row.chapterId)===Number(chapterId)&&(!activeOnly||(row.isActive&&row.chapterIsActive&&row.levelIsActive));});}
  function learningUnitOptions(chapterId,selectedId,activeOnly){var rows=learningUnitsForChapter(chapterId,activeOnly);return rows.map(function(row){return "<option value=\""+e(row.id)+"\""+(Number(row.id)===Number(selectedId)?" selected":"")+">Materi "+e(row.sequence)+" · "+e(row.titleId)+(row.isActive?"":" · NONAKTIF")+"</option>";}).join("")||"<option value=\"\">Belum ada Materi pada Bab ini</option>";}
  function syncLearningBankUnitOptions(purpose,selectedId){var prefix=purpose==="review"?"learningReviewBank":"learningTestBank",chapterId=Number(byId(prefix+"Lesson").value),node=byId(prefix+"Unit"),current=selectedId||Number(node.value);node.innerHTML=learningUnitOptions(chapterId,current,false);if(current&&Array.from(node.options).some(function(entry){return Number(entry.value)===Number(current);}))node.value=String(current);}
  function renderLearningTestScopeControls(){
    var scope=byId("learningTestMaterialScopeSelect").value,lessonId=Number(byId("learningTestLessonSelect").value),from=byId("learningTestFromUnitSelect"),to=byId("learningTestToUnitSelect"),oldFrom=Number(from.value),oldTo=Number(to.value),unitOptions=learningUnitOptions(lessonId,oldFrom,true);
    from.innerHTML=unitOptions;to.innerHTML=learningUnitOptions(lessonId,oldTo||oldFrom,true);
    if(oldFrom&&Array.from(from.options).some(function(entry){return Number(entry.value)===oldFrom;}))from.value=String(oldFrom);
    if(oldTo&&Array.from(to.options).some(function(entry){return Number(entry.value)===oldTo;}))to.value=String(oldTo);
    var needsUnit=scope==="unit"||scope==="unit_range",needsRange=scope==="unit_range";
    byId("learningTestFromUnitField").classList.toggle("it-hidden",!needsUnit);byId("learningTestToUnitField").classList.toggle("it-hidden",!needsRange);from.disabled=!needsUnit;to.disabled=!needsRange;from.required=needsUnit;to.required=needsRange;
    var rows=(state.learning.admin&&state.learning.admin.testBank)||[],difficulty=byId("learningTestDifficultySelect").value,levelId=Number(byId("learningTestLevelSelect").value),fromId=Number(from.value),toId=Number(to.value||fromId),units=learningUnitsForChapter(lessonId,true),fromRow=units.find(function(row){return Number(row.id)===fromId;}),toRow=units.find(function(row){return Number(row.id)===toId;}),low=Math.min(Number(fromRow&&fromRow.sequence||0),Number(toRow&&toRow.sequence||0)),high=Math.max(Number(fromRow&&fromRow.sequence||0),Number(toRow&&toRow.sequence||0));
    rows=rows.filter(function(row){if(!row.isActive||difficulty!=="all"&&row.difficulty!==difficulty)return false;if(scope==="level")return Number(row.levelId)===levelId;if(scope==="lesson")return Number(row.lessonId)===lessonId;if(scope==="unit")return Number(row.sourceUnitId)===fromId;return Number(row.lessonId)===lessonId&&Number(row.sourceUnitSequence)>=low&&Number(row.sourceUnitSequence)<=high;});
    byId("learningTestScopeSummary").textContent=(state.learning.admin?rows.length:"—")+" item Test aktif cocok dengan cakupan dan kesulitan saat ini.";
  }
  function renderLearningHijaiyah() {
    var rows=(state.learning.admin && state.learning.admin.hijaiyah)||[];
    byId("learningHijaiyahList").innerHTML=rows.length?rows.map(function(row){var forms=row.forms||{},examples=row.examples||[];return "<article class=\"it-learning-letter-card"+(row.isActive?"":" inactive")+"\"><span class=\"it-badge\">"+e(row.sequence)+"</span><div class=\"arabic\" lang=\"ar\" dir=\"rtl\">"+e(row.arabic)+"</div><h3>"+e(row.nameId)+"</h3><p>"+e(text(row.transliteration,""))+"</p><div class=\"it-learning-letter-forms\" title=\"tunggal · awal · tengah · akhir\"><span>"+e(forms.isolated||"—")+"</span><span>"+e(forms.initial||"—")+"</span><span>"+e(forms.medial||"—")+"</span><span>"+e(forms.final||"—")+"</span></div>"+(examples.length?"<p lang=\"ar\" dir=\"rtl\">"+e(examples.join(" · "))+"</p>":"")+"<div class=\"it-learning-letter-card-actions\"><button class=\"it-button small\" type=\"button\" data-iqro-edit-letter=\""+e(row.id)+"\">Edit</button><button class=\"it-button small "+(row.isActive?"danger":"")+"\" type=\"button\" data-iqro-toggle-letter=\""+e(row.id)+"\" data-active=\""+(row.isActive?"0":"1")+"\">"+(row.isActive?"Nonaktifkan":"Aktifkan")+"</button></div></article>";}).join(""):"<div class=\"it-empty\">Belum ada huruf Hijaiyah.</div>";
  }
  function learningProfileHaystack(row) { return [row.fullName,row.displayName,row.nickname,row.identifier,row.roleScope,row.classGroup].join(" ").toLowerCase(); }
  function renderLearningStudents() {
    var query=byId("learningStudentSearch").value.trim().toLowerCase(),rows=((state.learning.admin&&state.learning.admin.students)||[]).filter(function(row){return !query||learningProfileHaystack(row).indexOf(query)>=0;});
    byId("learningStudentList").innerHTML=rows.length?rows.map(function(row){return "<article class=\"it-learning-profile-card"+(row.isActive?"":" inactive")+"\"><button class=\"it-link-button\" type=\"button\" data-iqro-student-detail=\""+e(row.userId)+"\"><h3>"+e(row.fullName)+"</h3><p>"+e(text(row.nickname,"Tanpa nama panggilan"))+" · "+e(text(row.identifier,"tanpa nomor"))+"</p><p>Jilid "+e(text(row.currentLevelNumber,"—"))+" · "+e(row.reviewCount)+" Review · "+e(row.testCount)+" Test</p></button><div class=\"it-learning-row-actions\"><button class=\"it-button small\" type=\"button\" data-iqro-edit-student=\""+e(row.userId)+"\">Edit</button><button class=\"it-button small "+(row.isActive?"danger":"")+"\" type=\"button\" data-iqro-toggle-student=\""+e(row.userId)+"\" data-active=\""+(row.isActive?"0":"1")+"\">"+(row.isActive?"Nonaktifkan":"Aktifkan")+"</button></div></article>";}).join(""):"<div class=\"it-empty\">Tidak ada siswa yang cocok.</div>";
  }
  function renderLearningStaff() {
    if(!byId("learningStaffSearch"))return;
    var query=byId("learningStaffSearch").value.trim().toLowerCase(),rows=((state.learning.admin&&state.learning.admin.staff)||[]).filter(function(row){return !query||learningProfileHaystack(row).indexOf(query)>=0;});
    byId("learningStaffList").innerHTML=rows.length?rows.map(function(row){return "<article class=\"it-learning-profile-card"+(row.isActive?"":" inactive")+"\"><button class=\"it-link-button\" type=\"button\" data-iqro-staff-detail=\""+e(row.userId)+"\"><h3>"+e(row.fullName)+"</h3><p>"+e(text(row.nickname,"Tanpa nama panggilan"))+" · "+e(row.roleScope.replace("teacher_examiner","pengajar & penguji"))+"</p><p>"+e(row.materialCount||0)+" Materi · "+e(row.reviewCount)+" Review · "+e(row.testCount)+" Test</p></button><div class=\"it-learning-row-actions\"><button class=\"it-button small\" type=\"button\" data-iqro-edit-staff=\""+e(row.userId)+"\">Edit</button><button class=\"it-button small "+(row.isActive?"danger":"")+"\" type=\"button\" data-iqro-toggle-staff=\""+e(row.userId)+"\" data-active=\""+(row.isActive?"0":"1")+"\">"+(row.isActive?"Nonaktifkan":"Aktifkan")+"</button></div></article>";}).join(""):"<div class=\"it-empty\">Tidak ada pengajar/penguji yang cocok.</div>";
  }
  function renderLearningContentAdmin() {
    var entity=byId("learningContentEntity").value,rows=learningAdminCurriculumRows()[entity]||[];
    byId("learningContentLevelField").classList.toggle("it-hidden",entity==="level");
    byId("learningContentChapterField").classList.toggle("it-hidden",entity!=="lesson");
    byId("learningContentLessonField").classList.toggle("it-hidden",entity!=="example");
    byId("learningContentArabicField").classList.toggle("it-hidden",entity!=="example");byId("learningContentLatinField").classList.toggle("it-hidden",entity!=="example");byId("learningContentTitleField").classList.toggle("it-hidden",entity==="example");byId("learningContentTitleEnField").classList.toggle("it-hidden",entity==="example");
    byId("learningContentAdminList").innerHTML=rows.length?rows.map(function(row){var title=entity==="example"?text(row.arabic):text(row.titleId),meta=entity==="level"?"Jilid "+row.number:entity==="chapter"?"Jilid "+row.levelNumber+" · Bab "+row.number:entity==="lesson"?"Jilid "+row.levelNumber+" · "+row.chapterTitle:"Materi "+row.lessonTitle;return "<article class=\"it-learning-admin-row"+(row.isActive?"":" inactive")+"\"><div><h3>"+e(title)+"</h3><p>"+e(meta)+" · urutan "+e(row.sequence||row.sequenceOrder||row.number||1)+"</p></div><div class=\"it-learning-row-actions\"><button class=\"it-button small\" type=\"button\" data-iqro-edit-content=\""+e(row.id)+"\" data-entity=\""+e(entity)+"\">Edit</button><button class=\"it-button small "+(row.isActive?"danger":"")+"\" type=\"button\" data-iqro-toggle-content=\""+e(row.id)+"\" data-entity=\""+e(entity)+"\" data-active=\""+(row.isActive?"0":"1")+"\">"+(row.isActive?"Nonaktifkan":"Aktifkan")+"</button></div></article>";}).join(""):"<div class=\"it-empty\">Belum ada data pada lapisan ini.</div>";
  }
  function renderLearningBank(purpose) {
    var prefix=purpose==="review"?"learningReviewBank":"learningTestBank",rows=(state.learning.admin&&state.learning.admin[purpose+"Bank"])||[];
    byId(prefix+"List").innerHTML=rows.length?rows.map(function(row){return "<article class=\"it-learning-admin-row"+(row.isActive?"":" inactive")+"\"><div><h3 lang=\"ar\" dir=\"rtl\">"+e(text(row.arabic,"—"))+"</h3><p>Jilid "+e(row.levelNumber)+" · "+e(row.lessonTitle)+" · Materi "+e(text(row.sourceUnitTitle,"belum ditautkan"))+"</p><p>"+e(row.difficulty)+" · urutan "+e(row.sequence)+" · bacaan "+e(text(row.expectedReading))+"</p></div><div class=\"it-learning-row-actions\"><button class=\"it-button small\" type=\"button\" data-iqro-edit-bank=\""+e(row.id)+"\" data-purpose=\""+purpose+"\">Edit</button><button class=\"it-button small\" type=\"button\" data-iqro-duplicate-bank=\""+e(row.id)+"\">Duplikat</button><button class=\"it-button small "+(row.isActive?"danger":"")+"\" type=\"button\" data-iqro-toggle-bank=\""+e(row.id)+"\" data-active=\""+(row.isActive?"0":"1")+"\">"+(row.isActive?"Nonaktifkan":"Aktifkan")+"</button></div></article>";}).join(""):"<div class=\"it-empty\">Bank "+e(purpose)+" belum berisi item.</div>";
  }
  function renderLearningAdminCatalog(data) {
    state.learning.admin=data||null;if(!data)return;
    renderLearningHijaiyah();renderLearningStudents();renderLearningStaff();
    var rows=learningAdminCurriculumRows(),levelOptions=rows.level.map(function(row){return option(row.id,"Jilid "+row.number+" · "+row.titleId);}).join(""),chapterOptions=rows.chapter.map(function(row){return option(row.id,"Jilid "+row.levelNumber+" · "+row.titleId);}).join(""),lessonOptions=rows.lesson.map(function(row){return option(row.id,"Jilid "+row.levelNumber+" · "+row.chapterTitle+" · "+row.titleId);}).join("");
    byId("learningContentLevelId").innerHTML=levelOptions;byId("learningContentChapterId").innerHTML=chapterOptions;byId("learningContentLessonId").innerHTML=lessonOptions;byId("learningStudentCurrentLevel").innerHTML="<option value=\"\" data-i18n=\"ui.40fe01db\">Belum ditentukan</option>"+levelOptions;
    ["learningReviewBankLesson","learningTestBankLesson"].forEach(function(id){var current=byId(id).value;byId(id).innerHTML=chapterOptions;if(current&&Array.from(byId(id).options).some(function(entry){return entry.value===current;}))byId(id).value=current;});
    syncLearningBankUnitOptions("review");syncLearningBankUnitOptions("test");renderLearningContentAdmin();renderLearningBank("review");renderLearningBank("test");renderLearningMaterialTree();renderLearningTestScopeControls();
  }
  async function loadLearningAdminCatalog(showError) {
    if(!learningActorId())return null;
    try{var data=await apiGet("learning_admin_catalog",{actor_id:learningActorId()||"admin-local",include_inactive:1,refresh:Date.now()});renderLearningAdminCatalog(data);return data;}catch(error){if(showError)toast(error.message,true);return null;}
  }
  function openLearningLetterDialog(id) {
    var row=((state.learning.admin&&state.learning.admin.hijaiyah)||[]).find(function(item){return Number(item.id)===Number(id);})||{},forms=row.forms||{};byId("learningLetterDialogTitle").textContent=id?"Edit "+text(row.nameId):"Tambah huruf";byId("learningLetterId").value=row.id||"";byId("learningLetterSequence").value=row.sequence||(((state.learning.admin&&state.learning.admin.hijaiyah)||[]).length+1);byId("learningLetterKey").value=row.key||"";byId("learningLetterArabic").value=row.arabic||"";byId("learningLetterNameId").value=row.nameId||"";byId("learningLetterNameEn").value=row.nameEn||"";byId("learningLetterLatin").value=row.transliteration||"";byId("learningLetterInitial").value=forms.initial||"";byId("learningLetterMedial").value=forms.medial||"";byId("learningLetterFinal").value=forms.final||"";byId("learningLetterAudio").value=row.audioUrl||"";byId("learningLetterExamples").value=(row.examples||[]).join(", ");byId("learningLetterNote").value=row.noteId||"";byId("learningLetterJoiningType").value=row.joiningType||"dual";byId("learningLetterPrevious").checked=row.joinsToPrevious!==false;byId("learningLetterNext").checked=row.joinsToNext!==false;byId("learningLetterActive").checked=row.isActive!==false;byId("learningLetterDialog").showModal();
  }
  async function saveLearningLetter(event){event.preventDefault();var button=event.submitter||event.currentTarget.querySelector('[type="submit"]');setBusy(button,true,"Menyimpan…");try{await apiPost("save_iqro_letter",{letter:{id:Number(byId("learningLetterId").value)||0,sequence:Number(byId("learningLetterSequence").value),key:byId("learningLetterKey").value,arabic:byId("learningLetterArabic").value,nameId:byId("learningLetterNameId").value,nameEn:byId("learningLetterNameEn").value,transliteration:byId("learningLetterLatin").value,forms:{initial:byId("learningLetterInitial").value,medial:byId("learningLetterMedial").value,final:byId("learningLetterFinal").value},audioUrl:byId("learningLetterAudio").value,examples:byId("learningLetterExamples").value,noteId:byId("learningLetterNote").value,joiningType:byId("learningLetterJoiningType").value,joinsToPrevious:byId("learningLetterPrevious").checked,joinsToNext:byId("learningLetterNext").checked,isActive:byId("learningLetterActive").checked}});byId("learningLetterDialog").close();await loadLearningAdminCatalog(true);toast("Huruf Hijaiyah disimpan.");}catch(error){toast(error.message,true);}finally{setBusy(button,false);}}
  function openLearningStudentDialog(userId){var row=((state.learning.admin&&state.learning.admin.students)||[]).find(function(item){return item.userId===userId;})||{};byId("learningStudentDialogTitle").textContent=userId?"Edit "+text(row.fullName):"Tambah siswa";byId("learningStudentUserId").value=row.userId||"";byId("learningStudentFullName").value=row.fullName||"";byId("learningStudentNickname").value=row.nickname||"";byId("learningStudentIdentifier").value=row.identifier||"";byId("learningStudentBirthDate").value=row.birthDate||"";byId("learningStudentClass").value=row.classGroup||"";byId("learningStudentGuardian").value=row.guardianName||"";byId("learningStudentContact").value=row.contact||"";byId("learningStudentStartDate").value=row.startDate||"";byId("learningStudentCurrentLevel").value=row.currentLevelId||"";byId("learningStudentActive").checked=row.isActive!==false;byId("learningStudentNotes").value=row.notes||"";byId("learningStudentDialog").showModal();}
  async function saveLearningStudent(event){event.preventDefault();var button=event.submitter||event.currentTarget.querySelector('[type="submit"]');setBusy(button,true,"Menyimpan…");try{var saved=await apiPost("save_iqro_student",{student:{userId:byId("learningStudentUserId").value,fullName:byId("learningStudentFullName").value,nickname:byId("learningStudentNickname").value,identifier:byId("learningStudentIdentifier").value,birthDate:byId("learningStudentBirthDate").value,classGroup:byId("learningStudentClass").value,guardianName:byId("learningStudentGuardian").value,contact:byId("learningStudentContact").value,startDate:byId("learningStudentStartDate").value,currentLevelId:Number(byId("learningStudentCurrentLevel").value)||null,isActive:byId("learningStudentActive").checked,notes:byId("learningStudentNotes").value}});byId("learningStudentDialog").close();await refreshLearningCatalog();await loadLearningAdminCatalog(true);toast("Profil siswa disimpan.");if(saved&&saved.profile)showLearningStudentDetail(saved.profile.userId);}catch(error){toast(error.message,true);}finally{setBusy(button,false);}}
  function openLearningStaffDialog(userId){var row=((state.learning.admin&&state.learning.admin.staff)||[]).find(function(item){return item.userId===userId;})||{};byId("learningStaffDialogTitle").textContent=userId?"Edit "+text(row.fullName):"Tambah pengajar/penguji";byId("learningStaffUserId").value=row.userId||"";byId("learningStaffFullName").value=row.fullName||"";byId("learningStaffNickname").value=row.nickname||"";byId("learningStaffRoleScope").value=row.roleScope||"teacher";byId("learningStaffContact").value=row.contact||"";byId("learningStaffActive").checked=row.isActive!==false;byId("learningStaffNotes").value=row.notes||"";byId("learningStaffDialog").showModal();}
  async function saveLearningStaff(event){event.preventDefault();var button=event.submitter||event.currentTarget.querySelector('[type="submit"]');setBusy(button,true,"Menyimpan…");try{var saved=await apiPost("save_iqro_staff",{staff:{userId:byId("learningStaffUserId").value,fullName:byId("learningStaffFullName").value,nickname:byId("learningStaffNickname").value,roleScope:byId("learningStaffRoleScope").value,contact:byId("learningStaffContact").value,isActive:byId("learningStaffActive").checked,notes:byId("learningStaffNotes").value}});byId("learningStaffDialog").close();await refreshLearningCatalog();await loadLearningAdminCatalog(true);toast("Profil pengajar/penguji disimpan.");if(saved&&saved.profile)showLearningStaffDetail(saved.profile.userId);}catch(error){toast(error.message,true);}finally{setBusy(button,false);}}
  function historyMiniCards(rows,type){return (rows||[]).length?(rows||[]).slice(0,12).map(function(row){var title=row.lessonTitle||("Jilid "+text(row.levelNumber,"?")),date=learningHistoryDate(row.completedAt||row.startedAt);return "<article class=\"it-learning-admin-row\"><div><h3>"+e(type+" · "+title)+"</h3><p>"+e(date)+(type==="Test"?" · "+e(text(row.percentageScore,"—"))+"% · "+e(text(row.passStatus)):" · "+e(text(row.correctCount,0))+" benar / "+e(text(row.repeatCount,0))+" ulang")+"</p></div></article>";}).join(""):"<div class=\"it-empty\">Belum ada riwayat "+e(type)+".</div>";}
  async function showLearningStudentDetail(userId){try{var data=await apiGet("learning_student_detail",{actor_id:learningActorId(),student_user_id:userId,refresh:Date.now()}),p=data.profile||{};byId("learningStudentDetail").innerHTML="<div class=\"it-section-heading\"><div><p class=\"it-eyebrow\">"+e(p.userId)+"</p><h2>"+e(p.fullName)+"</h2><p>"+e(text(p.nickname))+" · "+e(text(p.classGroup))+" · wali "+e(text(p.guardianName))+"</p></div>"+badge(p.isActive?"AKTIF":"NONAKTIF")+"</div><div class=\"it-learning-profile-summary\"><div><strong>"+e(p.completedMaterialCount||0)+"</strong>Materi selesai</div><div><strong>"+e(p.reviewCount||0)+"</strong>Review</div><div><strong>"+e(p.testCount||0)+"</strong>Test formal</div></div><p><strong>Kontak:</strong> "+e(text(p.contact))+" · <strong>Mulai:</strong> "+e(text(p.startDate))+" · <strong>Jilid:</strong> "+e(text(p.currentLevelNumber))+"</p><p><strong>Catatan:</strong> "+e(text(p.notes))+"</p><h3>Progres per bab</h3>"+((data.progress||[]).length?(data.progress||[]).map(function(row){return "<p><span data-i18n=\"ui.c74b298d\">Jilid</span> "+e(row.levelNumber)+" · "+e(row.lessonTitle)+" · "+e(row.status)+" · "+e(row.viewedItems)+" item · pengajar "+e(text(row.teacherName,"belum tercatat"))+"</p>";}).join(""):"<p class=\"it-help\">Belum ada progres.</p>")+"<h3>Review</h3>"+historyMiniCards(data.reviews,"Review")+"<h3>Test</h3>"+historyMiniCards(data.tests,"Test");}catch(error){byId("learningStudentDetail").innerHTML="<div class=\"it-empty\">"+e(error.message)+"</div>";}}
  async function showLearningStaffDetail(userId){try{var data=await apiGet("learning_staff_detail",{actor_id:learningActorId(),staff_user_id:userId,refresh:Date.now()}),p=data.profile||{},activities=data.learningActivities||[];byId("learningStaffDetail").innerHTML="<div class=\"it-section-heading\"><div><p class=\"it-eyebrow\">"+e(p.roleScope)+"</p><h2>"+e(p.fullName)+"</h2><p>"+e(text(p.nickname))+" · "+e(text(p.contact))+"</p></div>"+badge(p.isActive?"AKTIF":"NONAKTIF")+"</div><div class=\"it-learning-profile-summary\"><div><strong>"+e(p.materialCount||0)+"</strong>Materi didampingi</div><div><strong>"+e(p.reviewCount||0)+"</strong>Review didampingi</div><div><strong>"+e(p.testCount||0)+"</strong>Test terkait</div></div><p><strong>Catatan:</strong> "+e(text(p.notes))+"</p><h3>Materi didampingi</h3>"+(activities.length?activities.map(function(row){return "<article class=\"it-learning-admin-row\"><div><h3>"+e(row.studentName)+" · Jilid "+e(row.levelNumber)+"</h3><p>"+e(row.lessonTitle)+" · "+e(row.status)+" · "+e(row.viewedItems)+" item · "+e(learningHistoryDate(row.lastActivity))+"</p></div></article>";}).join(""):"<div class=\"it-empty\">Belum ada riwayat pendampingan Materi.</div>")+"<h3>Review</h3>"+historyMiniCards(data.reviews,"Review")+"<h3>Test</h3>"+historyMiniCards(data.tests,"Test");}catch(error){byId("learningStaffDetail").innerHTML="<div class=\"it-empty\">"+e(error.message)+"</div>";}}
  function resetLearningContentForm(){byId("learningContentId").value="";byId("learningContentSequence").value="1";byId("learningContentKey").value="";byId("learningContentTitleId").value="";byId("learningContentTitleEn").value="";byId("learningContentArabic").value="";byId("learningContentTransliteration").value="";byId("learningContentInstruction").value="";byId("learningContentDifficulty").value="beginner";byId("learningContentActive").checked=true;renderLearningContentAdmin();}
  function editLearningContent(entity,id){var row=(learningAdminCurriculumRows()[entity]||[]).find(function(item){return Number(item.id)===Number(id);});if(!row)return;byId("learningContentEntity").value=entity;renderLearningContentAdmin();byId("learningContentId").value=row.id;byId("learningContentSequence").value=row.number||row.sequence||row.sequenceOrder||1;byId("learningContentKey").value=row.key||row.itemKey||"";byId("learningContentTitleId").value=row.titleId||"";byId("learningContentTitleEn").value=row.titleEn||"";byId("learningContentArabic").value=row.arabic||"";byId("learningContentTransliteration").value=row.transliteration||"";byId("learningContentInstruction").value=row.instructionId||row.explanationId||"";byId("learningContentDifficulty").value=row.difficulty||"beginner";byId("learningContentActive").checked=row.isActive!==false;if(entity==="chapter")byId("learningContentLevelId").value=row.levelId;if(entity==="lesson")byId("learningContentChapterId").value=row.chapterId;if(entity==="example")byId("learningContentLessonId").value=(learningAdminCurriculumRows().lesson.find(function(lesson){return (lesson.examples||[]).some(function(example){return Number(example.id)===Number(id);});})||{}).id||"";byId("learningContentForm").scrollIntoView({behavior:"smooth",block:"start"});}
  async function saveLearningContent(event){event.preventDefault();var entity=byId("learningContentEntity").value,button=event.submitter||event.currentTarget.querySelector('[type="submit"]'),content={id:Number(byId("learningContentId").value)||0,sequence:Number(byId("learningContentSequence").value),number:Number(byId("learningContentSequence").value),key:byId("learningContentKey").value,titleId:byId("learningContentTitleId").value,titleEn:byId("learningContentTitleEn").value,arabic:byId("learningContentArabic").value,transliteration:byId("learningContentTransliteration").value,instructionId:byId("learningContentInstruction").value,difficulty:byId("learningContentDifficulty").value,isActive:byId("learningContentActive").checked,courseId:state.learning.admin&&state.learning.admin.curriculum.course.id,levelId:Number(byId("learningContentLevelId").value),chapterId:Number(byId("learningContentChapterId").value),lessonId:Number(byId("learningContentLessonId").value),unitId:Number(byId("learningContentLessonId").value)};setBusy(button,true,"Menyimpan…");try{await apiPost("save_iqro_content",{entity:entity,content:content});resetLearningContentForm();await refreshLearningCatalog();await loadLearningAdminCatalog(true);toast("Struktur materi disimpan.");}catch(error){toast(error.message,true);}finally{setBusy(button,false);}}
  function bankPrefix(purpose){return purpose==="review"?"learningReviewBank":"learningTestBank";}
  function resetLearningBankForm(purpose){var prefix=bankPrefix(purpose);["Id","Arabic","Latin","Expected","Note"].forEach(function(suffix){byId(prefix+suffix).value="";});byId(prefix+"Sequence").value="1";byId(prefix+"Difficulty").value="beginner";byId(prefix+"Active").checked=true;syncLearningBankUnitOptions(purpose);}
  function editLearningBank(purpose,id){var row=((state.learning.admin&&state.learning.admin[purpose+"Bank"])||[]).find(function(item){return Number(item.id)===Number(id);});if(!row)return;var prefix=bankPrefix(purpose);byId(prefix+"Id").value=row.id;byId(prefix+"Lesson").value=row.lessonId;syncLearningBankUnitOptions(purpose,row.sourceUnitId);byId(prefix+"Sequence").value=row.sequence;byId(prefix+"Arabic").value=row.arabic||"";byId(prefix+"Latin").value=row.transliteration||"";byId(prefix+"Expected").value=row.expectedReading||"";byId(prefix+"Difficulty").value=row.difficulty||"beginner";byId(prefix+"Note").value=row.note||"";byId(prefix+"Active").checked=row.isActive!==false;byId(prefix+"Id").closest("form").scrollIntoView({behavior:"smooth",block:"start"});}
  async function saveLearningBank(event){event.preventDefault();var purpose=event.currentTarget.dataset.bankPurpose,prefix=bankPrefix(purpose),button=event.submitter||event.currentTarget.querySelector('[type="submit"]');setBusy(button,true,"Menyimpan…");try{await apiPost("save_iqro_bank_item",{purpose:purpose,item:{id:Number(byId(prefix+"Id").value)||0,lessonId:Number(byId(prefix+"Lesson").value),sourceUnitId:Number(byId(prefix+"Unit").value),sequence:Number(byId(prefix+"Sequence").value),arabic:byId(prefix+"Arabic").value,transliteration:byId(prefix+"Latin").value,expectedReading:byId(prefix+"Expected").value,difficulty:byId(prefix+"Difficulty").value,note:byId(prefix+"Note").value,isActive:byId(prefix+"Active").checked}});resetLearningBankForm(purpose);await refreshLearningCatalog();await loadLearningAdminCatalog(true);toast("Item bank "+purpose+" disimpan.");}catch(error){toast(error.message,true);}finally{setBusy(button,false);}}
  function applyLearningPreferences(preferences) {
    if (!preferences) return;
    byId("learningArabicSize").value = preferences.arabicFontSize || 72;
    byId("learningArabicSizeOutput").textContent = (preferences.arabicFontSize || 72) + " px";
    byId("learningLatinMode").value = preferences.latinMode || "LEARNING_ONLY";
    byId("learningMeaningToggle").checked = preferences.showMeaning !== false;
    byId("learningHarakatToggle").checked = preferences.showHarakat !== false;
    byId("learningColorToggle").checked = preferences.learningColorsEnabled !== false;
    byId("learningPatternToggle").checked = preferences.highContrastPatterns !== false;
    document.documentElement.style.setProperty("--learning-arabic-size", (preferences.arabicFontSize || 72) + "px");
  }
  function learningPreferencesPayload() {
    var engine = state.learning.engine || {};
    return { courseId: engine.course && engine.course.id, arabicFontSize: Number(byId("learningArabicSize").value), latinMode: byId("learningLatinMode").value, showMeaning: byId("learningMeaningToggle").checked, showHarakat: byId("learningHarakatToggle").checked, learningColorsEnabled: byId("learningColorToggle").checked, highContrastPatterns: byId("learningPatternToggle").checked, repeatCount: 1, preferredLanguage: byId("readerLanguageSelect").value };
  }
  function learningPackScopePayload() {
    var levels=(state.learning.engine && state.learning.engine.levels)||[],maximumLevel=levels.reduce(function(maximum,level){return Math.max(maximum,Number(level.levelNumber || 0));},1),type=byId("learningPackScope").value,from=Math.max(1,Math.min(maximumLevel,Number(byId("learningPackFromLevel").value)||1)),to=Math.max(1,Math.min(maximumLevel,Number(byId("learningPackToLevel").value)||maximumLevel));
    if(type === "level") to=from;
    if(type === "all_text" || type === "all") { from=1;to=maximumLevel; }
    if(from>to){var swap=from;from=to;to=swap;}
    byId("learningPackFromLevel").value=from;byId("learningPackToLevel").value=to;
    return {type:type,level:from,fromLevel:from,toLevel:to,includeAudio:byId("learningPackAudioToggle").checked || type === "all",includeQuranExamples:byId("learningPackQuranToggle").checked};
  }
  async function renderLearningPackEstimate() {
    try {
      var scope=learningPackScopePayload(),estimate = await apiGet("learning_pack_estimate", Object.assign({ course_id: state.learning.engine.course.id },scope));
      byId("learningPackEstimate").innerHTML = e("Jilid "+estimate.scope.levelFrom+"–"+estimate.scope.levelTo+" · "+estimate.lessons + " bab · " + estimate.items + " contoh · teks sekitar " + formatBytes(estimate.textBytesEstimated) + " · audio diketahui " + formatBytes(estimate.audioBytesKnown)) + "<br>" + e(estimate.audioSizeStatus + " — " + estimate.note);
    } catch (error) { byId("learningPackEstimate").textContent = error.message; }
  }
  async function loadLearningLesson(lessonId, mode, preferredItemId) {
    state.learning.mode = mode === "learn" ? "material" : (mode || state.learning.mode || "material");
    if (!lessonId && state.learning.mode !== "placement") { toast("Pelajaran belum tersedia.", true); return; }
    try {
      var data = state.learning.mode === "placement" ? await apiGet("learning_placement",{language:byId("readerLanguageSelect").value}) : await apiGet("learning_lesson", { lesson_id: lessonId, mode: state.learning.mode, language: byId("readerLanguageSelect").value });
      state.learning.lesson = data;
      state.learning.itemIndex = Math.max(0, preferredItemId ? data.items.findIndex(function (item) { return Number(item.id) === Number(preferredItemId); }) : 0);
      if (state.learning.itemIndex < 0) state.learning.itemIndex = 0;
      state.learning.revealLatin = false;
      state.learning.answerResults = Object.create(null);
      if(state.learning.mode !== "placement") showLearningPrimary("material",false);
      byId("learningLevelLabel").textContent = "Jilid " + data.lesson.levelNumber + " · " + data.lesson.levelTitle + (state.learning.mode === "placement" ? " · DIAGNOSTIK" : " · MATERI");
      byId("learningLessonTitle").textContent = data.lesson.title;
      byId("learningLessonGoal").textContent = data.lesson.goal + " · ±" + data.lesson.estimatedMinutes + " menit";
      if(state.learning.mode !== "placement") {
        byId("learningMaterialLevelSelect").value=String(data.lesson.levelId);
        byId("learningMaterialLessonSelect").innerHTML=learningLessonOptions(data.lesson.id,data.lesson.levelId);
      }
      byId("learningPreviousLessonButton").disabled=!data.previousLesson;
      byId("learningPreviousLessonButton").dataset.lessonId=data.previousLesson ? data.previousLesson.id : "";
      byId("learningNextLessonButton").disabled=!data.nextLesson;
      byId("learningNextLessonButton").dataset.lessonId=data.nextLesson ? data.nextLesson.id : "";
      renderLearningLessonLegend(data.legend || []);
      byId("learningCompletionSummary").classList.toggle("it-hidden",state.learning.mode === "placement");
      renderLearningItem();
      byId("learningWorkspace").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) { toast(error.message, true); }
  }
  function stripArabicMarks(value) { return String(value || "").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, ""); }
  function learningSafeColor(value, fallback) { var color=String(value || "").trim(); return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color) ? color : fallback; }
  function learningPatternToken(value) { var token=String(value || "").trim().toLowerCase(); return /^(underline-solid|underline-double|underline-dotted|underline-wave|border-dashed|background-stripes|tajwid-hatch)$/.test(token) ? token : "border-dashed"; }
  function learningMarkedArabicHtml(item, displayedArabic, hideAids, preferences) {
    var rows=(item.annotations || []).slice().sort(function(a,b){return Number(a.startCharacter || 0)-Number(b.startCharacter || 0);});
    if (hideAids || !rows.length || (!preferences.learningColorsEnabled && !preferences.highContrastPatterns)) return e(displayedArabic);
    var original=String(item.arabic || ""), value=String(displayedArabic || ""), marksPreserved=original === value;
    function markHtml(content,row,rowIndex) {
      var light=learningSafeColor(row.lightColor,"#eef2ef"),dark=learningSafeColor(row.darkColor,"#315b43"),pattern=learningPatternToken(row.patternToken),title=[row.label,row.howToRead,row.reason].filter(Boolean).join(" — ");
      return "<span class=\"it-learning-mark\" role=\"button\" tabindex=\"0\" data-learning-annotation-index=\""+e(rowIndex)+"\"" + (preferences.highContrastPatterns ? " data-pattern=\""+e(pattern)+"\"" : "") + " data-color-enabled=\""+e(preferences.learningColorsEnabled ? "true" : "false")+"\" style=\"--learning-pattern-color:"+e(light)+";--learning-pattern-ink:"+e(dark)+"\" title=\""+e(title)+"\">"+e(content)+"</span>";
    }
    if (!marksPreserved) return markHtml(value,rows[0],0);
    var cursor=0,html="",applied=0;
    rows.forEach(function(row,rowIndex){
      var start=Math.max(0,Math.min(value.length,Number(row.startCharacter || 0))),end=Math.max(start,Math.min(value.length,Number(row.endCharacter == null ? value.length : row.endCharacter)));
      if (end <= start || start < cursor) return;
      html+=e(value.slice(cursor,start))+markHtml(value.slice(start,end),row,rowIndex);cursor=end;applied++;
    });
    html+=e(value.slice(cursor));
    return applied ? html : markHtml(value,rows[0],0);
  }
  function showLearningAnnotationDetail(index) {
    var item=state.learning.lesson && state.learning.lesson.items[state.learning.itemIndex],row=item && (item.annotations || [])[Number(index)],node=byId("learningAnnotationDetail");
    if(!row){node.classList.add("it-hidden");node.innerHTML="";return;}
    node.innerHTML="<div><strong>"+e(text(row.label,row.tajwidCode || "Aturan pembelajaran"))+"</strong>"+(row.tajwidCode ? " <span class=\"it-badge\">"+e(row.tajwidCode)+"</span>" : "")+"</div><dl><dt>Alasan</dt><dd>"+e(text(row.reason))+"</dd><dt>Cara membaca</dt><dd>"+e(text(row.howToRead))+"</dd><dt>Durasi</dt><dd>"+e(text(row.durationLabel,"Sesuai petunjuk guru/sumber"))+"</dd><dt>Status</dt><dd>"+e(text(row.reviewStatus))+"</dd></dl><div class=\"it-source-actions\"><button class=\"it-button small\" type=\"button\" data-learning-rule-audio>Dengarkan contoh</button><button class=\"it-button small\" type=\"button\" data-learning-annotation-close>Tutup</button></div>";
    node.classList.remove("it-hidden");
  }
  function learningPatternIndicatorHtml(rows, hideAids, enabled) {
    if (hideAids || !enabled || !rows || !rows.length) return "";
    return rows.map(function(row){var light=learningSafeColor(row.lightColor,"#eef2ef"),dark=learningSafeColor(row.darkColor,"#315b43"),title=[row.label,row.howToRead,row.reason].filter(Boolean).join(" — ");return "<span class=\"it-learning-pattern-segment\" data-pattern=\""+e(learningPatternToken(row.patternToken))+"\" style=\"--learning-pattern-color:"+e(light)+";--learning-pattern-ink:"+e(dark)+"\" title=\""+e(title)+"\"></span>";}).join("");
  }
  function learningEvidenceStatusHtml(item) {
    var source=item.source || {},spans=item.canonicalTajwidSpans || [],rows=[];
    rows.push("<span class=\"it-learning-evidence-chip\">Provenance: "+e(text(source.verificationStatus,"BELUM DITETAPKAN"))+"</span>");
    if (item.tajwid) rows.push("<span class=\"it-learning-evidence-chip "+(item.tajwid.evidenceStatus === "CANONICAL_SPAN_LINKED" ? "canonical" : "derived")+"\">Tajwid: "+e(item.tajwid.evidenceStatus)+""+(spans.length ? " · "+e(spans.length)+" span" : "")+"</span>");
    if (item.wordSegmentationStatus) rows.push("<span class=\"it-learning-evidence-chip derived\" title=\"Posisi kata berasal dari tokenisasi lokal atas ayat kanonik; bukan record terjemahan atau transliterasi kanonik.\">Segmentasi kata: "+e(item.wordSegmentationStatus)+"</span>");
    return rows.join("");
  }
  function learningItemProvenanceHtml(item) {
    var source=item.source || {},spans=item.canonicalTajwidSpans || [],audio=item.audio || [],tajwidStatus=item.tajwid && item.tajwid.evidenceStatus;
    var spanHtml=spans.length ? "<h4>Rentang Tajwid kanonik terkait</h4><ul class=\"it-learning-canonical-spans\">"+spans.map(function(span){var confidence=Number(span.confidence);return "<li><strong>"+e(span.code || span.nameId || span.nameEn)+"</strong> · karakter "+e(text(span.startCharacter,"?"))+"–"+e(text(span.endCharacter,"?"))+" · "+e(text(span.annotationSource,"sumber anotasi tidak dicatat"))+" · "+e(text(span.reviewStatus,"status review belum dicatat"))+(isFinite(confidence) ? " · confidence "+e(confidence.toFixed(2)) : "")+(span.analysisVersion ? " · versi "+e(span.analysisVersion) : "")+"</li>";}).join("")+"</ul>" : (item.tajwid ? "<p><strong>Status Tajwid:</strong> "+e(text(tajwidStatus))+". Warna/pola ini adalah contoh pembelajaran dan belum dipetakan sebagai rentang Tajwid kanonik pada ayat tersebut.</p>" : "");
    var derivedHtml=item.wordSegmentationStatus ? "<p><strong>Transparansi segmentasi:</strong> "+e(item.wordSegmentationStatus)+" pada posisi kata "+e(text(item.wordPosition,"?"))+(item.wordEndPosition ? "–"+e(item.wordEndPosition) : "")+". Posisi ini diturunkan dari tokenisasi lokal atas teks ayat kanonik; bukan klaim bahwa Latin atau artinya merupakan data kanonik per kata.</p>" : "";
    var audioHtml=audio.length ? "<p><strong>Audio:</strong> "+audio.map(function(row){return e([row.audioType,row.providerMode,row.teacherOrReciter,row.status,row.licenseName].filter(Boolean).join(" · "));}).join("<br>")+"</p>" : "<p><strong>Audio:</strong> tidak ada file audio bersumber pada item ini; tombol dengar dapat memakai bantuan suara perangkat.</p>";
    return "<dl class=\"it-source-trace\"><dt>Sumber</dt><dd>"+e(text(source.label))+"</dd><dt>URL</dt><dd>"+(source.url ? "<a target=\"_blank\" rel=\"noopener\" href=\""+e(source.url)+"\">"+e(source.url)+"</a>" : "—")+"</dd><dt>Lisensi</dt><dd>"+e(text(source.license))+"</dd><dt>Status</dt><dd>"+e(text(source.verificationStatus))+"</dd><dt>Qiraat/riwayah</dt><dd>"+e(text(source.qiraat)+" / "+text(source.riwayah))+"</dd></dl>"+spanHtml+derivedHtml+audioHtml;
  }
  function learningLegendHtml(rows) {
    return (rows || []).map(function (row) { return "<span class=\"it-learning-legend-row\" title=\"" + e(row.purpose || row.reason) + "\"><i class=\"it-learning-swatch\" data-pattern=\"" + e(row.patternToken) + "\" style=\"background-color:" + e(row.lightColor || "#eee") + ";color:" + e(row.darkColor || "#333") + "\"></i>" + e(row.label) + (row.durationLabel ? " · " + e(row.durationLabel) : "") + "</span>"; }).join("");
  }
  function renderLearningLessonLegend(legend) { byId("learningLessonLegend").innerHTML = legend.length ? learningLegendHtml(legend) : "<p class=\"it-help\">Level ini tidak memakai penanda warna khusus.</p>"; }
  function renderLearningItem() {
    stopLearningAudio();
    var lesson = state.learning.lesson; if (!lesson || !lesson.items || !lesson.items.length) return;
    var index = Math.max(0, Math.min(lesson.items.length - 1, state.learning.itemIndex)), item = lesson.items[index], preferences = learningPreferencesPayload(), assessment = state.learning.mode === "placement", answered=state.learning.answerResults[String(item.id)], hideAids=assessment && !answered, forceHarakat = lesson.lesson.levelNumber <= 2;
    state.learning.itemIndex = index;
    var displayedArabic=(forceHarakat || preferences.showHarakat) ? item.arabic : stripArabicMarks(item.arabic);
    byId("learningArabic").innerHTML = learningMarkedArabicHtml(item,displayedArabic,hideAids,preferences);
    byId("learningArabic").style.removeProperty("font-size");
    document.documentElement.style.setProperty("--learning-arabic-size",preferences.arabicFontSize + "px");
    var annotation = (item.annotations || [])[0];
    byId("learningArabic").style.backgroundColor = "transparent";
    byId("learningArabic").setAttribute("aria-label", !hideAids && annotation ? ((annotation.label || "") + ". " + (annotation.howToRead || "")) : (item.arabic || "Materi Arab"));
    var patternHtml=learningPatternIndicatorHtml(item.annotations || [],hideAids,preferences.highContrastPatterns),patternNode=byId("learningPatternIndicator");
    patternNode.innerHTML=patternHtml;patternNode.classList.toggle("it-hidden",!patternHtml);
    byId("learningAnnotationDetail").classList.add("it-hidden");byId("learningAnnotationDetail").innerHTML="";
    var showLatin = state.learning.revealLatin || preferences.latinMode === "ALWAYS" || (preferences.latinMode === "LEARNING_ONLY" && (state.learning.mode === "learn" || state.learning.mode === "material"));
    byId("learningLatin").textContent = item.latin || "Bantuan Latin tidak tersedia pada record ini.";
    byId("learningLatin").classList.toggle("it-hidden", hideAids || !showLatin || preferences.latinMode === "OFF");
    byId("learningMeaning").textContent = item.meaning || "";
    byId("learningMeaning").classList.toggle("it-hidden", hideAids || !preferences.showMeaning || !item.meaning);
    byId("learningPronunciationHint").textContent = item.pronunciationHint || item.instruction || "";
    byId("learningPronunciationHint").classList.toggle("it-hidden",hideAids);
    byId("learningItemCounter").textContent = (index + 1) + " / " + lesson.items.length;
    byId("learningMasteryBadge").textContent = item.mastery && item.mastery.state || "NEW";
    byId("learningItemProgress").style.width = Math.round(((index + 1) / lesson.items.length) * 100) + "%";
    byId("learningPreviousItemButton").disabled = index === 0;
    byId("learningNextItemButton").disabled = index >= lesson.items.length - 1;
    byId("learningContextLegend").innerHTML = hideAids ? "" : learningLegendHtml(item.annotations || []);
    var forms = item.letterForms;
    byId("learningLetterForms").innerHTML = forms ? [["Terpisah",forms.isolatedForm],["Awal",forms.initialForm],["Tengah",forms.medialForm],["Akhir",forms.finalForm]].map(function (row) { return "<div class=\"it-letter-form\"><strong>" + e(row[1] || "—") + "</strong><span>" + e(row[0]) + "</span></div>"; }).join("") + "<p class=\"it-help\" style=\"grid-column:1/-1\">Unicode " + e(forms.unicodeCodepoint) + " · joining " + e(forms.joiningType) + " · sambung sebelumnya " + e(forms.joinsToPrevious ? "ya" : "tidak") + " · sambung sesudahnya " + e(forms.joinsToNext ? "ya" : "tidak") + "</p>" : "";
    byId("learningLetterForms").classList.toggle("it-hidden",hideAids);
    var ref = item.quranReference;
    var readerCount=item.type === "quran_ayah" ? "<label>Ayat dipelajari <select data-learning-quran-count>"+Array.from({length:15},function(_,position){var count=position+1;return "<option"+(count===1?" selected":"")+">"+count+"</option>";}).join("")+"</select></label>" : "";
    byId("learningQuranReference").innerHTML = ref ? "<div class=\"it-quran-learning-ref\"><span><strong>" + e(ref.label) + "</strong> · " + e(ref.verificationStatus) + " · " + e(ref.sourceName) + "</span>"+readerCount+"<button class=\"it-button small\" type=\"button\" data-learning-quran=\"" + e(ref.surah + ":" + ref.ayah) + "\">Buka di Qur'an Reader</button></div>" : "";
    byId("learningQuranReference").classList.toggle("it-hidden",hideAids);
    byId("learningEvidenceStatus").innerHTML=learningEvidenceStatusHtml(item);
    byId("learningEvidenceStatus").classList.toggle("it-hidden",hideAids);
    byId("learningItemProvenance").classList.toggle("it-hidden",hideAids);
    byId("learningAudioActions").classList.toggle("it-hidden",hideAids);
    byId("learningItemSource").innerHTML = learningItemProvenanceHtml(item);
    renderLearningExercise(item);
    var materialStudent=byId("learningMaterialStudentSelect").value,materialTeacher=byId("learningMaterialTeacherSelect").value;
    if (Number(lesson.lesson.id)>0 && (state.learning.mode === "material" || state.learning.mode === "learn") && materialStudent && materialTeacher) apiPost("save_learning_position", { lessonId: lesson.lesson.id, itemId: item.id, viewedItems: index + 1, studentUserId: materialStudent, teacherUserId: materialTeacher }).catch(function () {});
  }
  function renderLearningExercise(item) {
    var area = byId("learningExerciseArea"), mode = state.learning.mode;
    if (mode === "learn" || mode === "material") { area.innerHTML = "<p class=\"it-help\">Pelajari penjelasan, contoh, dan sumber. Review dan Test memakai bank soal serta riwayat yang terpisah.</p>"; return; }
    var recorded=state.learning.answerResults[String(item.id)];
    if (recorded && mode === "placement") { area.innerHTML="<div class=\"it-learning-feedback "+(recorded.correct ? "ok" : "error")+"\">"+e(learningFeedbackText(recorded))+"</div><p class=\"it-help\">Jawaban diagnostik ini sudah dikunci. Pindah ke item berikutnya untuk melanjutkan.</p>"; return; }
    var exercise = (state.learning.lesson.exercises || []).find(function (row) { return Number(row.itemId) === Number(item.id); }) || (state.learning.lesson.exercises || [])[0];
    if (!exercise) { area.innerHTML = "<p class=\"it-help\">Tidak ada soal untuk item ini pada mode " + e(mode) + ".</p>"; return; }
    area.innerHTML = "<p><strong>" + e(exercise.prompt) + "</strong></p><p class=\"it-help\">" + e(text(exercise.instruction)) + "</p>" + (exercise.answers || []).map(function (answer) { return "<button type=\"button\" class=\"it-learning-answer\" data-learning-exercise=\"" + e(exercise.id) + "\" data-learning-answer=\"" + e(answer.id) + "\">" + (answer.arabic ? "<span lang=\"ar\" dir=\"rtl\">" + e(answer.arabic) + "</span> " : "") + e(answer.text) + "</button>"; }).join("") + "<div id=\"learningAnswerFeedback\"></div>";
  }
  function learningFeedbackText(result) {
    var correctAnswer=result.correctAnswer && result.correctAnswer.textId,message=(result.correct ? "Tepat. " : "Belum tepat. Jawaban materi: "+text(correctAnswer)+". ")+text(result.feedbackId)+" Skor pelajaran: "+Math.round(result.lessonScore)+"%. Pelafalan suara tidak dinilai.";
    if(result.placement) message+=" Penempatan "+result.placement.attempted+"/"+result.placement.totalQuestions+"; rekomendasi sementara mulai Level "+result.placement.recommendedStartLevel+". Anda tetap boleh memilih level lain.";
    return message;
  }
  async function submitLearningAnswer(button) {
    document.querySelectorAll(".it-learning-answer").forEach(function (node) { node.disabled = true; });
    try {
      var result = await apiPost("submit_learning_attempt", { exerciseId: Number(button.dataset.learningExercise), answerId: Number(button.dataset.learningAnswer), mode: state.learning.mode });
      if (result.queued) { var queuedFeedback=byId("learningAnswerFeedback");queuedFeedback.className="it-learning-feedback ok";queuedFeedback.textContent="Jawaban tersimpan offline. Hasil akan diverifikasi saat server kembali tersedia; sistem tidak menebak benar/salah.";return; }
      button.classList.add(result.correct ? "correct" : "incorrect");
      var current=state.learning.lesson && state.learning.lesson.items[state.learning.itemIndex],feedback = byId("learningAnswerFeedback");
      if(current) state.learning.answerResults[String(current.id)]=result;
      if(state.learning.mode === "placement") renderLearningItem();
      else { feedback.className = "it-learning-feedback " + (result.correct ? "ok" : "error"); feedback.textContent = learningFeedbackText(result); byId("learningAudioActions").classList.remove("it-hidden"); }
    } catch (error) { toast(error.message,true); document.querySelectorAll(".it-learning-answer").forEach(function (node) { node.disabled = false; }); }
  }
  function learningJsonObject(value) {
    if (value && typeof value === "object") return value;
    try { return JSON.parse(String(value || "{}")); } catch (error) { return {}; }
  }
  function learningAssessmentQuestions(payload) {
    payload=payload || {};
    var nested=payload.lessonPayload || payload.lessonData || payload.review || payload.test || {},session=payload.session || payload.attempt || {};
    var rows=payload.questions || payload.exercises || payload.items || nested.questions || nested.exercises || nested.items || session.questions || session.items || [];
    return (Array.isArray(rows) ? rows : []).map(function(row,index){
      var snapshot=learningJsonObject(row.promptSnapshot || row.prompt_snapshot_json),optionSnapshot=learningJsonObject(row.answerOptionsSnapshot || row.answer_options_snapshot_json),answers=row.answers || row.answerOptions || row.answer_options || row.options || snapshot.answers || snapshot.options || optionSnapshot.answers || optionSnapshot.options || (Array.isArray(optionSnapshot) ? optionSnapshot : []);
      if(!Array.isArray(answers))answers=[];
      return {
        index:index,
        attemptItemId:Number(row.attemptItemId || row.attempt_item_id || row.responseId || row.response_id || 0),
        exerciseId:Number(row.exerciseId || row.exercise_id || snapshot.exerciseId || snapshot.exercise_id || row.id || 0),
        itemId:Number(row.learningItemId || row.learning_item_id || row.itemId || row.item_id || snapshot.itemId || 0),
        prompt:text(row.prompt || row.promptId || row.prompt_id || snapshot.prompt || snapshot.promptId,"Pilih jawaban yang paling tepat."),
        promptArabic:row.promptArabic || row.prompt_arabic || snapshot.promptArabic || snapshot.arabic || "",
        instruction:row.instruction || row.instructionId || row.instruction_id || snapshot.instruction || "",
        answers:answers.map(function(answer){return {id:Number(answer.id || answer.answerId || answer.answer_id),text:text(answer.text || answer.answerText || answer.answer_text || answer.textId || answer.textEn),arabic:answer.arabic || answer.arabicText || answer.arabic_text || ""};})
      };
    }).filter(function(row){return row.exerciseId && row.answers.length;});
  }
  function learningReviewSessionId(payload) { var session=payload && (payload.session || payload.reviewSession) || {};return Number(session.id || session.sessionId || payload && (payload.sessionId || payload.reviewSessionId || payload.id) || 0); }
  function learningTestAttemptId(payload) { var attempt=payload && (payload.attempt || payload.testAttempt) || {};return Number(attempt.id || attempt.attemptId || payload && (payload.attemptId || payload.testAttemptId || payload.id) || 0); }
  function learningAssessmentTitle(payload,fallback) {
    var nested=payload && (payload.lessonPayload || payload.lessonData || payload.lesson) || {},lesson=nested.lesson || nested;
    return text(lesson.title || payload && payload.title,fallback);
  }
  function renderLearningReviewQuestion() {
    var review=state.learning.review,rows=review.questions,index=Math.max(0,Math.min(rows.length-1,review.index)),question=rows[index],sessionId=learningReviewSessionId(review.session);
    if(!question){byId("learningReviewAnswers").innerHTML="<div class=\"it-empty\">Bank soal review untuk bab ini belum tersedia.</div>";return;}
    review.index=index;
    var recorded=review.results[String(question.exerciseId)],answered=Object.keys(review.results).length;
    byId("learningReviewCounter").textContent=(index+1)+" / "+rows.length;
    byId("learningReviewProgress").style.width=Math.round((answered/rows.length)*100)+"%";
    byId("learningReviewArabic").textContent=question.promptArabic || "";
    byId("learningReviewArabic").classList.toggle("it-hidden",!question.promptArabic);
    byId("learningReviewPrompt").textContent=question.prompt;
    byId("learningReviewInstruction").textContent=question.instruction;
    byId("learningReviewAnswers").innerHTML=question.answers.map(function(answer){var chosen=recorded && Number(recorded.answerId)===Number(answer.id),klass="it-learning-answer"+(chosen ? " recorded" : "");return "<button type=\"button\" class=\""+klass+"\" data-learning-review-answer=\""+e(answer.id)+"\" data-learning-exercise=\""+e(question.exerciseId)+"\""+(recorded?" disabled":"")+">"+(answer.arabic ? "<span lang=\"ar\" dir=\"rtl\">"+e(answer.arabic)+"</span> " : "")+e(answer.text)+"</button>";}).join("");
    if(recorded){var result=recorded.result || {},message=result.correct ? "Tepat." : "Belum tepat.";message+=" "+text(result.feedback || result.feedbackId || result.recommendation,"");byId("learningReviewFeedback").innerHTML="<div class=\"it-learning-feedback "+(result.correct ? "ok" : "error")+"\">"+e(message)+"</div>"+(index<rows.length-1 ? "<button class=\"it-button primary\" type=\"button\" data-learning-review-next>Soal berikutnya</button>" : "");}else byId("learningReviewFeedback").innerHTML="";
    byId("learningReviewPreviousButton").disabled=index<=0;byId("learningReviewNextButton").disabled=index>=rows.length-1;byId("learningReviewMarkCorrectButton").disabled=Boolean(recorded);byId("learningReviewMarkRepeatButton").disabled=Boolean(recorded);byId("learningReviewTeacherNote").disabled=Boolean(recorded);if(!recorded)byId("learningReviewTeacherNote").value="";
    byId("learningCompleteReviewButton").disabled=!sessionId || answered<rows.length;
  }
  async function startLearningReview(event) {
    event.preventDefault();
    var button=byId("learningStartReviewButton"),studentUserId=byId("learningReviewStudentSelect").value,teacherUserId=byId("learningReviewTeacherSelect").value,lessonId=Number(byId("learningReviewLessonSelect").value),reviewType=byId("learningReviewTypeSelect").value;
    if(!studentUserId || !teacherUserId || !lessonId){toast(document.documentElement.lang==="en"?"Select a student and review lesson.":"Pilih siswa dan bab review.",true);return;}
    setBusy(button,true,"Menyiapkan…");
    try{
      var result=await apiPost("start_learning_review",{studentUserId:studentUserId,teacherUserId:teacherUserId,lessonId:lessonId,reviewType:reviewType,randomize:byId("learningReviewRandomize").checked,materialRange:{scopeType:"lesson",lessonId:lessonId}}),questions=learningAssessmentQuestions(result);
      if(!learningReviewSessionId(result))throw new Error("Server tidak mengembalikan identitas sesi review.");
      state.learning.review={session:result,questions:questions,index:0,results:Object.create(null)};
      byId("learningReviewMeta").textContent="Sesi #"+learningReviewSessionId(result)+" · "+learningIdentityName(state.learning.identities.students.find(function(row){return learningIdentityId(row)===studentUserId;}) || {id:studentUserId})+" · pengajar "+learningIdentityName(state.learning.identities.teachers.find(function(row){return learningIdentityId(row)===teacherUserId;}) || {id:teacherUserId})+" · "+new Date().toLocaleDateString("id-ID");
      byId("learningReviewTitle").textContent=learningAssessmentTitle(result,"Review bab terpilih");
      byId("learningReviewWorkspace").classList.remove("it-hidden");
      byId("learningReviewHintUsed").checked=false;byId("learningReviewRepetitionCount").value="0";byId("learningReviewTeacherNote").value="";byId("learningReviewSessionNotes").value="";
      renderLearningReviewQuestion();
      byId("learningReviewWorkspace").scrollIntoView({behavior:"smooth",block:"start"});
    }catch(error){toast(error.message,true);}finally{setBusy(button,false);}
  }
  async function submitLearningReviewAnswer(button) {
    var review=state.learning.review,question=review.questions[review.index];if(!question || review.results[String(question.exerciseId)])return;
    document.querySelectorAll("[data-learning-review-answer]").forEach(function(node){node.disabled=true;});
    try{
      var answerId=Number(button.dataset.learningReviewAnswer),result=await apiPost("submit_learning_review",{sessionId:learningReviewSessionId(review.session),exerciseId:question.exerciseId,answerId:answerId,hintUsed:byId("learningReviewHintUsed").checked,repetitionCount:Number(byId("learningReviewRepetitionCount").value || 0),teacherNote:byId("learningReviewTeacherNote").value.trim()});
      review.results[String(question.exerciseId)]={answerId:answerId,result:result};renderLearningReviewQuestion();
    }catch(error){toast(error.message,true);document.querySelectorAll("[data-learning-review-answer]").forEach(function(node){node.disabled=false;});}
  }
  async function submitLearningReviewMark(correct) {
    var review=state.learning.review,question=review.questions[review.index];if(!question||review.results[String(question.exerciseId)])return;
    byId("learningReviewMarkCorrectButton").disabled=true;byId("learningReviewMarkRepeatButton").disabled=true;
    try{var result=await apiPost("submit_learning_review",{sessionId:learningReviewSessionId(review.session),exerciseId:question.exerciseId,answerId:0,markedCorrect:correct,resultStatus:correct?"correct":"repeat",hintUsed:byId("learningReviewHintUsed").checked,repetitionCount:Number(byId("learningReviewRepetitionCount").value||0)+(correct?0:1),teacherNote:byId("learningReviewTeacherNote").value.trim()});review.results[String(question.exerciseId)]={answerId:0,result:result};renderLearningReviewQuestion();}catch(error){toast(error.message,true);byId("learningReviewMarkCorrectButton").disabled=false;byId("learningReviewMarkRepeatButton").disabled=false;}
  }
  async function completeLearningReview() {
    var button=byId("learningCompleteReviewButton"),sessionId=learningReviewSessionId(state.learning.review.session);if(!sessionId)return;
    setBusy(button,true,"Menyelesaikan…");
    try{var result=await apiPost("complete_learning_review",{sessionId:sessionId,notes:byId("learningReviewSessionNotes").value.trim()}),session=result.session || {};byId("learningReviewFeedback").innerHTML="<div class=\"it-learning-feedback ok\"><strong>Review selesai.</strong> "+e(text(result.recommendation || session.recommendation || result.summary,"Penguasaan materi diperbarui; nilai Test formal tetap tidak berubah."))+"</div>";toast("Review selesai tanpa mengubah riwayat nilai Test.");await refreshLearningCatalog();await loadLearningAdminCatalog(false);}catch(error){toast(error.message,true);}finally{setBusy(button,false);}
  }
  function renderLearningTestQuestion() {
    var test=state.learning.test,rows=test.questions,index=Math.max(0,Math.min(rows.length-1,test.index)),question=rows[index];
    if(!question){byId("learningTestAnswers").innerHTML="<div class=\"it-empty\">Bank soal Test untuk cakupan ini belum tersedia.</div>";return;}
    test.index=index;
    var recorded=test.submitted[String(question.exerciseId)],answered=Object.keys(test.submitted).length;
    byId("learningTestCounter").textContent=(index+1)+" / "+rows.length;
    byId("learningTestProgress").style.width=Math.round((answered/rows.length)*100)+"%";
    byId("learningTestArabic").textContent=question.promptArabic || "";
    byId("learningTestArabic").classList.toggle("it-hidden",!question.promptArabic);
    byId("learningTestPrompt").textContent=question.prompt;
    byId("learningTestInstruction").textContent=question.instruction;
    byId("learningTestAnswers").innerHTML=question.answers.map(function(answer){var chosen=recorded && Number(recorded.answerId)===Number(answer.id);return "<button type=\"button\" class=\"it-learning-answer"+(chosen ? " recorded" : "")+"\" data-learning-test-answer=\""+e(answer.id)+"\" data-learning-exercise=\""+e(question.exerciseId)+"\""+(recorded?" disabled":"")+">"+(answer.arabic ? "<span lang=\"ar\" dir=\"rtl\">"+e(answer.arabic)+"</span> " : "")+e(answer.text)+"</button>";}).join("");
    byId("learningTestErrorNote").value=recorded ? text(recorded.errorNote,"") : "";byId("learningTestErrorNote").disabled=Boolean(recorded);
    byId("learningTestItemStatus").innerHTML=recorded ? "<div class=\"it-learning-feedback ok\">Jawaban tercatat dan dikunci. Kunci serta skor tetap disembunyikan sampai finalisasi.</div>"+(index<rows.length-1 ? "<button class=\"it-button primary\" type=\"button\" data-learning-test-next>Soal berikutnya</button>" : "") : "";
    byId("learningTestFinalizeForm").classList.toggle("it-hidden",answered<rows.length);
  }
  async function startLearningTest(event) {
    event.preventDefault();
    var button=byId("learningStartTestButton"),studentUserId=byId("learningTestStudentSelect").value,teacherUserId=byId("learningTestTeacherSelect").value,examinerUserId=byId("learningTestExaminerSelect").value,levelId=Number(byId("learningTestLevelSelect").value),lessonId=Number(byId("learningTestLessonSelect").value),testType=byId("learningTestTypeSelect").value,scopeType=byId("learningTestMaterialScopeSelect").value,fromUnitId=Number(byId("learningTestFromUnitSelect").value),toUnitId=Number(byId("learningTestToUnitSelect").value||fromUnitId),level=((state.learning.engine && state.learning.engine.levels)||[]).find(function(row){return Number(row.id)===levelId;}),lesson=learningLessons().find(function(row){return Number(row.lesson.id)===lessonId;});
    if(!studentUserId || !examinerUserId || !levelId || (scopeType!=="level"&&!lessonId)){toast(document.documentElement.lang==="en"?"Select a student, volume, and lesson for this test.":"Pilih siswa, jilid, dan bab sesuai cakupan tes.",true);return;}
    if((scopeType==="unit"||scopeType==="unit_range")&&!fromUnitId){toast("Pilih Materi awal untuk cakupan Test.",true);return;}
    if(scopeType==="unit_range"&&!toUnitId){toast("Pilih Materi akhir untuk rentang Test.",true);return;}
    var materialScope={type:scopeType,scopeType:scopeType,courseId:state.learning.engine.course.id,levelId:levelId,levelNumber:level && level.levelNumber,lessonId:lessonId,fromUnitId:scopeType==="unit"||scopeType==="unit_range"?fromUnitId:null,toUnitId:scopeType==="unit_range"?toUnitId:(scopeType==="unit"?fromUnitId:null),levelTitle:level && level.title,lessonTitle:lesson && lesson.lesson.title};
    setBusy(button,true,"Membuat attempt…");
    try{
      var result=await apiPost("start_learning_test",{studentUserId:studentUserId,teacherUserId:teacherUserId||null,examinerUserId:examinerUserId,levelId:levelId,lessonId:lessonId,testType:testType,difficulty:byId("learningTestDifficultySelect").value,questionCount:Number(byId("learningTestQuestionCount").value||0),materialScope:materialScope}),questions=learningAssessmentQuestions(result);
      if(!learningTestAttemptId(result))throw new Error("Server tidak mengembalikan identitas attempt Test.");
      state.learning.test={attempt:result,questions:questions,index:0,submitted:Object.create(null)};
      var attempt=result.attempt || result.testAttempt || result;
      var testStudent=attempt.student||{},testExaminer=attempt.examiner||{},testMaterial=attempt.material||{},testDate=learningHistoryDate(attempt.startedAt||new Date().toISOString());
      byId("learningTestMeta").textContent="Attempt #"+text(attempt.attemptNumber || attempt.attempt_number,learningTestAttemptId(result))+" · Siswa "+text(testStudent.displayName,studentUserId)+" · penguji "+text(testExaminer.displayName,examinerUserId)+" · "+testDate;
      var canonicalRange=testMaterial.range||{},fromUnit=canonicalRange.fromUnit||{},toUnit=canonicalRange.toUnit||{},scopeLabel=canonicalRange.type==="level"?text(testMaterial.levelTitle,level&&level.title):text(testMaterial.lessonTitle,lesson&&lesson.lesson.title);if(canonicalRange.type==="unit")scopeLabel+=" · Materi "+text(fromUnit.titleId);if(canonicalRange.type==="unit_range")scopeLabel+=" · Materi "+text(fromUnit.titleId)+" – "+text(toUnit.titleId);
      byId("learningTestTitle").textContent="Jilid "+text(testMaterial.levelNumber,level&&level.levelNumber)+" · "+scopeLabel;
      byId("learningTestWorkspace").classList.remove("it-hidden");byId("learningTestResult").innerHTML="";byId("learningTestExaminerNotes").value="";byId("learningTestRecommendation").value="";byId("learningTestFluencyScore").value="";byId("learningTestFluencyNotes").value="";
      renderLearningTestQuestion();byId("learningTestWorkspace").scrollIntoView({behavior:"smooth",block:"start"});
    }catch(error){toast(error.message,true);}finally{setBusy(button,false);}
  }
  async function submitLearningTestAnswer(button) {
    var test=state.learning.test,question=test.questions[test.index];if(!question || test.submitted[String(question.exerciseId)])return;
    document.querySelectorAll("[data-learning-test-answer]").forEach(function(node){node.disabled=true;});
    try{
      var answerId=Number(button.dataset.learningTestAnswer),errorNote=byId("learningTestErrorNote").value.trim();
      await apiPost("submit_learning_test_item",{attemptId:learningTestAttemptId(test.attempt),exerciseId:question.exerciseId,answerId:answerId,errorNote:errorNote});
      test.submitted[String(question.exerciseId)]={answerId:answerId,errorNote:errorNote};renderLearningTestQuestion();
    }catch(error){toast(error.message,true);document.querySelectorAll("[data-learning-test-answer]").forEach(function(node){node.disabled=false;});}
  }
  async function completeLearningTest(event) {
    event.preventDefault();
    var button=byId("learningCompleteTestButton"),attemptId=learningTestAttemptId(state.learning.test.attempt),examinerUserId=byId("learningTestExaminerSelect").value;if(!attemptId)return;
    setBusy(button,true,"Memfinalisasi…");
    try{
      var result=await apiPost("complete_learning_test",{attemptId:attemptId,examinerUserId:examinerUserId,notes:byId("learningTestExaminerNotes").value.trim(),recommendation:byId("learningTestRecommendation").value.trim(),fluencyScore:byId("learningTestFluencyScore").value,fluencyNotes:byId("learningTestFluencyNotes").value.trim()}),finalResult=result.result || result,score=Number(finalResult.percentageScore == null ? finalResult.score : finalResult.percentageScore),status=finalResult.passStatus || finalResult.status || "COMPLETED";
      byId("learningTestResult").innerHTML="<div class=\"it-learning-feedback "+(String(status).toLowerCase().indexOf("pass")>=0 || String(status).toLowerCase().indexOf("lulus")>=0 ? "ok" : "error")+"\"><strong>Test difinalisasi · "+e(isFinite(score) ? score.toFixed(1)+"%" : text(status))+".</strong> "+e(text(finalResult.recommendation || finalResult.summary,"Riwayat attempt telah disimpan."))+"</div>";
      byId("learningTestFinalizeForm").classList.add("it-hidden");toast("Attempt Test difinalisasi dan ditambahkan ke riwayat.");await refreshLearningCatalog();await loadLearningAdminCatalog(false);
    }catch(error){toast(error.message,true);}finally{setBusy(button,false);}
  }
  function learningHistoryDate(value) { if(!value)return "Belum selesai";var date=new Date(String(value).replace(" ","T"));return isNaN(date.getTime()) ? String(value) : date.toLocaleString("id-ID"); }
  function renderLearningTestHistory(payload) {
    payload=payload || {};state.learning.history=payload;
    var rows=payload.attempts || payload.history || payload.tests || (Array.isArray(payload) ? payload : []),legacy=payload.legacySummary || payload.legacy || {},legacyCount=Number(legacy.count == null ? (payload.legacyAttemptCount || 0) : legacy.count);
    byId("learningLegacyHistoryNotice").innerHTML="<strong>Catatan kompatibilitas:</strong> "+e(legacyCount)+" respons test lama tetap dipertahankan sebagai data legacy, tetapi tidak dipromosikan menjadi attempt formal atau digabungkan ke nilai baru."+(legacy.note ? " "+e(legacy.note) : "");
    byId("learningTestHistoryList").innerHTML=rows.length ? rows.map(function(row){var score=Number(row.percentageScore == null ? row.percentage_score : row.percentageScore),status=row.passStatus || row.pass_status || row.status || "PENDING",attemptNumber=row.attemptNumber || row.attempt_number || row.attemptId || row.id,student=row.student && (row.student.displayName || row.student.userId) || row.studentName || row.student_name || row.studentDisplayName || row.studentUserId || row.student_user_id,examiner=row.examiner && (row.examiner.displayName || row.examiner.userId) || row.examinerName || row.examiner_name || row.examinerDisplayName || row.examinerUserId || row.examiner_user_id,material=row.material || {},title=material.levelTitle || row.levelTitle || row.level_title || row.lessonTitle || ("Jilid "+text(material.levelNumber || row.levelNumber || row.level_number,"?")),notes=row.examinerNotes || row.examiner_notes,recommendation=row.recommendation,fluency=row.fluencyScore == null ? row.fluency_score : row.fluencyScore;return "<article class=\"it-learning-history-card\"><div><p class=\"it-eyebrow\">Attempt #"+e(attemptNumber)+" · "+e(text(row.testType || row.test_type,"level_test"))+"</p><h3>"+e(title)+(material.lessonTitle ? " · "+e(material.lessonTitle) : "")+"</h3><p>"+e(text(student))+" · examiner "+e(text(examiner))+" · "+e(learningHistoryDate(row.completedAt || row.completed_at))+"</p>"+(fluency!=null?"<p><strong>Kelancaran:</strong> "+e(fluency)+" / 5</p>":"")+(notes ? "<p><strong>Catatan:</strong> "+e(notes)+"</p>" : "")+(recommendation ? "<p><strong>Rekomendasi:</strong> "+e(recommendation)+"</p>" : "")+"</div><div class=\"it-learning-history-score\"><strong>"+e(isFinite(score) ? score.toFixed(1)+"%" : "—")+"</strong>"+badge(status)+"</div></article>";}).join("") : "<div class=\"it-empty\">Belum ada attempt Test formal untuk siswa ini.</div>";
  }
  function renderLearningReviewHistory(payload) {
    var rows=(payload&&payload.reviews)||[];byId("learningReviewHistoryList").innerHTML=rows.length?rows.map(function(row){return "<article class=\"it-learning-history-card\"><div><p class=\"it-eyebrow\">Sesi Review #"+e(row.sessionId)+" · "+e(text(row.reviewType))+"</p><h3>Jilid "+e(text(row.levelNumber,"?"))+" · "+e(text(row.lessonTitle))+"</h3><p>"+e(text(row.studentName||row.studentUserId))+" · pengajar "+e(text(row.teacherName||row.teacherUserId))+" · "+e(learningHistoryDate(row.completedAt||row.startedAt))+"</p>"+(row.notes?"<p><strong>Catatan:</strong> "+e(row.notes)+"</p>":"")+(row.recommendation?"<p><strong>Rekomendasi:</strong> "+e(row.recommendation)+"</p>":"")+"</div><div class=\"it-learning-history-score\"><strong>"+e(Number(row.correctCount||0))+" benar</strong><span>"+e(Number(row.repeatCount||0))+" ulang · tanpa skor Test</span></div></article>";}).join(""):"<div class=\"it-empty\">Belum ada sesi Review untuk siswa ini.</div>";
  }
  async function loadLearningTestHistory() {
    var studentUserId=byId("learningHistoryStudentSelect").value;if(!studentUserId){renderLearningTestHistory({attempts:[],legacySummary:{count:0}});renderLearningReviewHistory({reviews:[]});return;}
    var button=byId("learningReloadHistoryButton");setBusy(button,true,"Memuat…");
    try{var combined=await apiGet("learning_history",{actor_id:learningActorId(),student_user_id:studentUserId,limit:100,refresh:Date.now()}),formal=await apiGet("learning_test_history",{student_user_id:studentUserId,limit:100,refresh:Date.now()});formal.attempts=combined.tests||formal.attempts;renderLearningTestHistory(formal);renderLearningReviewHistory(combined);}catch(error){byId("learningTestHistoryList").innerHTML="<div class=\"it-empty\">"+e(error.message)+"</div>";byId("learningReviewHistoryList").innerHTML="<div class=\"it-empty\">"+e(error.message)+"</div>";toast(error.message,true);}finally{setBusy(button,false);}
  }
  var learningPlaybackGeneration=0,learningUtterance=null;
  function stopLearningAudio(){learningPlaybackGeneration++;if(state.learning.audio){state.learning.audio.pause();state.learning.audio=null;}if(window.speechSynthesis)window.speechSynthesis.cancel();learningUtterance=null;}
  function speakLearning(repeats) {
    var item = state.learning.lesson && state.learning.lesson.items[state.learning.itemIndex]; if (!item || !item.arabic) { toast("Teks Arab tidak tersedia.",true); return; }
    if (state.learning.mode === "placement" && !state.learning.answerResults[String(item.id)]) { toast("Jawab diagnostik terlebih dahulu agar bantuan audio tidak membocorkan jawaban.",true); return; }
    stopLearningAudio();var generation=learningPlaybackGeneration;
    var available=(item.audio || []).filter(function(a){return a.localPath||a.remoteUrl;});
    var recitation = available.find(function(a){return a.audioType==='quran_recitation';}) || available.find(function(a){return a.localPath;}) || available[0];
    if (recitation) {
      var remaining = repeats,audio=new Audio(recitation.localPath || recitation.remoteUrl);state.learning.audio=audio;audio.playbackRate=1;
      audio.addEventListener('ended',function(){if(generation!==learningPlaybackGeneration)return;if(--remaining>0){audio.currentTime=0;play();}});
      audio.addEventListener('error',function(){if(generation===learningPlaybackGeneration)toast('Audio tidak dapat dimuat. Muat ulang materi atau periksa koneksi.',true);});
      function play(){audio.play().catch(function(){if(generation===learningPlaybackGeneration)toast('Pemutaran audio diblokir atau gagal. Tekan Dengarkan kembali.',true);});}
      play();return;
    }
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") { toast("Bantuan suara Arab tidak tersedia pada perangkat ini.",true); return; }
    var synth=window.speechSynthesis,count=0;
    function start(){if(generation!==learningPlaybackGeneration)return;var voice=synth.getVoices().find(function(v){return /^ar[-_]/i.test(v.lang)||v.lang==='ar';});
      if(!voice){toast('Suara Arab belum tersedia pada perangkat ini dan materi ini belum memiliki berkas audio.',true);return;}
      function next(){if(generation!==learningPlaybackGeneration||count++>=repeats)return;var utterance=new SpeechSynthesisUtterance(item.arabic);learningUtterance=utterance;utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=.72;utterance.onend=next;utterance.onerror=function(e){if(generation===learningPlaybackGeneration&&!['canceled','interrupted'].includes(e.error))toast('Bantuan suara gagal: '+e.error,true);};synth.resume();synth.speak(utterance);}next();
    }
    if(synth.getVoices().length)start();else{var done=false;function ready(){if(done)return;done=true;synth.removeEventListener('voiceschanged',ready);start();}synth.addEventListener('voiceschanged',ready);setTimeout(ready,1500);}
  }
  function printLearningPracticeSheet() {
    var data=state.learning.lesson,printNode=byId("learningPrintSheet");
    if (!data || !data.items || !data.items.length) { toast("Buka salah satu pelajaran sebelum mencetak lembar latihan.",true); return; }
    var course=state.learning.engine && state.learning.engine.course || {},exercises=data.exercises || [];
    var items=data.items.map(function(item,index){
      var exercise=exercises.find(function(row){return Number(row.itemId)===Number(item.id);}),question="";
      if(exercise) question="<div class=\"it-print-question\"><strong>Latihan: "+e(exercise.prompt)+"</strong>"+(exercise.instruction ? "<p>"+e(exercise.instruction)+"</p>" : "")+((exercise.answers || []).length ? "<ol class=\"it-print-options\">"+exercise.answers.map(function(answer){return "<li>"+(answer.arabic ? "<span lang=\"ar\" dir=\"rtl\">"+e(answer.arabic)+"</span> " : "")+e(answer.text)+"</li>";}).join("")+"</ol>" : "")+"</div>";
      return "<article class=\"it-print-item\"><strong>Item "+e(index+1)+"</strong><div class=\"it-print-arabic\" lang=\"ar\" dir=\"rtl\">"+e(item.arabic)+"</div><div class=\"it-print-line\"></div>"+question+"</article>";
    }).join("");
    printNode.innerHTML="<h1>"+e(course.title || "Learning / Iqro")+" — Lembar latihan</h1><p class=\"it-print-meta\">"+e(data.lesson.title)+" · Level "+e(data.lesson.levelNumber)+" · dicetak "+e(new Date().toLocaleString("id-ID"))+" · tanpa kunci jawaban<br>Nama: ____________________ &nbsp; Tanggal latihan: ____________________</p>"+items;
    printNode.setAttribute("aria-hidden","false");
    var cleaned=false,cleanup=function(){if(cleaned)return;cleaned=true;printNode.setAttribute("aria-hidden","true");printNode.innerHTML="";};
    window.addEventListener("afterprint",cleanup,{once:true});
    window.print();
    window.setTimeout(cleanup,1500);
  }
  function learningKeyboardIgnored(target) {
    return !!(target && target.closest && target.closest("input,textarea,select,button,a,form,summary,[contenteditable=\"true\"],[role=\"dialog\"]"));
  }
  function handleLearningKeyboard(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || learningKeyboardIgnored(event.target) || !document.querySelector('.it-panel[data-panel="learning"].active') || !state.learning.lesson) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); if(state.learning.itemIndex>0){state.learning.itemIndex--;renderLearningItem();} return; }
    if (event.key === "ArrowRight") { event.preventDefault(); if(state.learning.itemIndex<state.learning.lesson.items.length-1){state.learning.itemIndex++;renderLearningItem();} return; }
    if (event.code === "Space" || event.key === " ") { event.preventDefault(); speakLearning(1); }
  }
  async function completeLearningLesson() {
    if (!state.learning.lesson) return;
    var materialStudent=byId("learningMaterialStudentSelect").value,materialTeacher=byId("learningMaterialTeacherSelect").value;
    if(!materialStudent || !materialTeacher){toast("Pilih siswa dan pengajar pendamping pada panel Materi sebelum mencatat penyelesaian.",true);return;}
    try {
      var currentItem=state.learning.lesson.items[state.learning.itemIndex];
      if(currentItem)await apiPost("save_learning_position",{lessonId:state.learning.lesson.lesson.id,itemId:currentItem.id,viewedItems:state.learning.itemIndex+1,studentUserId:materialStudent,teacherUserId:materialTeacher});
      var result = await apiPost("complete_learning_lesson",{ lessonId: state.learning.lesson.lesson.id,studentUserId:materialStudent,teacherUserId:materialTeacher });
      byId("learningCompletionSummary").querySelector("p").textContent = result.completed ? "Progres materi bab selesai. Status ini bukan kelulusan Test formal." : "Materi belum selesai: " + result.viewedItems + "/" + result.requiredItems + " contoh dibuka" + (result.requiredAttempts ? " · " + result.attempts + "/" + result.requiredAttempts + " latihan penguatan" : "") + ".";
      if (result.completed) { toast("Progres materi bab diperbarui; nilai Test formal tidak berubah."); await refreshLearningCatalog(); }
    } catch (error) { toast(error.message,true); }
  }
  async function refreshLearningCatalog() { var data = await apiGet("learning",{ language: byId("readerLanguageSelect").value,refresh:Date.now() }); renderLearning(data,state.bootstrap.catalog || {}); }
  function downloadJson(data, fileName) { var blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"}), url = URL.createObjectURL(blob), link = document.createElement("a"); link.href=url; link.download=fileName; document.body.appendChild(link); link.click(); link.remove(); setTimeout(function(){URL.revokeObjectURL(url);},1000); }
  function downloadText(content,fileName,mimeType) { var blob=new Blob([content],{type:mimeType||"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=fileName;document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000); }
  function learningCurriculumTemplate() {
    return {
      schemaVersion:"mpm-learning-curriculum-v1",
      courseKey:"basic-quranic-reading",
      lessonKey:"level-02-harakat-pendek",
      unitKey:"harakat-pendek-utama",
      source:{key:"mpm-learning-curriculum",label:"GANTI: nama sumber atau pemilik materi",url:"https://example.org/replace-with-source-url",license:"GANTI: nama lisensi atau izin tertulis"},
      items:[{
        itemKey:"custom-ba-fathah-v1",itemType:"reading",arabic:"بَ",latin:"ba",instructionId:"Baca ba dengan vokal pendek.",instructionEn:"Read ba with a short vowel.",pronunciationHintId:"Dengarkan contoh dan ulangi kepada guru.",pronunciationHintEn:"Listen to the example and repeat to a teacher.",difficulty:"foundation",qiraat:"Hafs 'an 'Asim",riwayah:"Hafs",contentVersion:"1.0.0",
        audio:[{audioKey:"custom-ba-fathah-v1-device",audioType:"pronunciation_assistance",providerMode:"DEVICE_TTS_ASSISTANCE",contentText:"بَ",sourceKey:"device-speech-assistance",licenseName:"Device/provider dependent",status:"ASSISTANCE_ONLY"}],
        annotations:[{startCharacter:1,endCharacter:2,annotationType:"LEARNING_SEMANTIC",semanticToken:"fathah",colorKey:"fathah",labelId:"Fathah",labelEn:"Fathah",reasonId:"Penanda vokal a pendek.",reasonEn:"Short a-vowel marker.",howToReadId:"Baca vokal a secara pendek.",howToReadEn:"Read a short a vowel.",patternToken:"underline-solid",reviewStatus:"IMPORTED_REVIEW_REQUIRED"}]
      }]
    };
  }
  function downloadLearningCurriculumTemplate(format) {
    var template=learningCurriculumTemplate();
    if(format === "json"){downloadJson(template,"mpm-learning-curriculum-template.json");return;}
    var row=template.items[0],headers=["lessonKey","unitKey","itemKey","itemType","arabic","latin","instructionId","instructionEn","pronunciationHintId","pronunciationHintEn","difficulty","sourceLabel","sourceUrl","licenseName","qiraat","riwayah","contentVersion","audioJson","annotationsJson"],values=[template.lessonKey,template.unitKey,row.itemKey,row.itemType,row.arabic,row.latin,row.instructionId,row.instructionEn,row.pronunciationHintId,row.pronunciationHintEn,row.difficulty,template.source.label,template.source.url,template.source.license,row.qiraat,row.riwayah,row.contentVersion,JSON.stringify(row.audio),JSON.stringify(row.annotations)];
    function csvCell(value){return '"'+String(value == null ? "" : value).replace(/"/g,'""')+'"';}
    downloadText("\uFEFF"+headers.map(csvCell).join(",")+"\r\n"+values.map(csvCell).join(",")+"\r\n","mpm-learning-curriculum-template.csv","text/csv;charset=utf-8");
  }
  async function sha256Hex(value) {
    if(!window.crypto || !window.crypto.subtle) return null;
    var digest=await window.crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest)).map(function(byte){return byte.toString(16).padStart(2,"0");}).join("");
  }
  async function cacheLearningAudio(rows) {
    if(!window.caches || !Array.isArray(rows) || !rows.length) return {cached:0,failed:rows && rows.length || 0};
    var store=await caches.open("mpm-learning-audio-v1"),cached=0,failed=0;
    for(var index=0;index<rows.length;index++){
      var url=rows[index].localPath || rows[index].remoteUrl;if(!url)continue;
      try{var response=await fetch(url,{cache:"no-store"});if(!response.ok)throw new Error("HTTP "+response.status);await store.put(url,response.clone());cached++;}catch(error){failed++;}
    }
    return {cached:cached,failed:failed};
  }
  async function installLearningPack(pack,expectedChecksum,rawText) {
    if (!pack || pack.format !== "mpm-learning-offline-pack-v1" || !Array.isArray(pack.lessons)) throw new Error("Format paket Learning tidak valid.");
    var actualChecksum=rawText ? await sha256Hex(rawText) : null;
    if(expectedChecksum && actualChecksum && actualChecksum.toLowerCase() !== String(expectedChecksum).toLowerCase()) throw new Error("Checksum paket Learning tidak cocok; instalasi dibatalkan.");
    var writes=[],activeActor=learningActorId();
    function cachePackResponse(resource,params,data) {
      writes.push(offlinePut(cacheKey(resource,params),data));
      if(activeActor) writes.push(offlinePut(cacheKey(resource,Object.assign({},params,{actor_id:activeActor})),data));
    }
    function lessonForMode(source,mode) {
      var copy=JSON.parse(JSON.stringify(source));delete copy.languageVariants;
      var banks=copy.exerciseBanks || {},all=Array.isArray(copy.exercises) ? copy.exercises : [];
      if(mode === "material" || mode === "learn") copy.exercises=[];
      else if(mode === "test") copy.exercises=Array.isArray(banks.test) ? banks.test : all.filter(function(row){return row.purpose === "test";});
      else copy.exercises=Array.isArray(banks.review) ? banks.review : all.filter(function(row){return row.purpose === "review" || row.purpose === "legacy_shared";});
      copy.mode=mode;return copy;
    }
    for (var index=0;index<pack.lessons.length;index++) {
      var lesson=pack.lessons[index],lessonId=lesson.lesson.id;
      ["id","en"].forEach(function(language){var source=language === "en" && lesson.languageVariants && lesson.languageVariants.en ? lesson.languageVariants.en : lesson;["material","learn","practice","review","test"].forEach(function(mode){cachePackResponse("learning_lesson",{lesson_id:lessonId,mode:mode,language:language},lessonForMode(source,mode));});});
    }
    if(pack.catalogs){["id","en"].forEach(function(language){if(pack.catalogs[language])cachePackResponse("learning",{language:language},pack.catalogs[language]);});}
    await Promise.all(writes);
    var audio=await cacheLearningAudio(pack.audioManifest || []);
    await offlinePut("learning-pack/installed",{format:pack.format,generatedAt:pack.generatedAt,versions:pack.versions,scope:pack.scope,checksum:actualChecksum || expectedChecksum || null,course:pack.course,lessonCount:pack.lessons.length,audio:audio,sources:pack.sources});
    return {installed:true,lessons:pack.lessons.length,audioCached:audio.cached,audioFailed:audio.failed,checksumVerified:Boolean(expectedChecksum && actualChecksum)};
  }
  async function importLearningCurriculum(commit) {
    var file = byId("learningCurriculumImportInput").files[0]; if (!file) { toast("Pilih file JSON atau CSV.",true); return; }
    try {
      var content = await file.text(), format = /\.csv$/i.test(file.name) ? "csv" : "json", result = await apiPost("import_learning_curriculum",{format:format,content:content,fileName:file.name,commit:commit});
      byId("learningImportReport").textContent=JSON.stringify(result,null,2); toast(result.status === "IMPORTED" ? "Materi berhasil diimpor." : "Validasi importer selesai.", result.status === "VALIDATION_FAILED"); if (result.status === "IMPORTED") await refreshLearningCatalog();
    } catch(error){byId("learningImportReport").textContent=error.message;toast(error.message,true);}
  }

  function parseJson(json) { try { return JSON.parse(json || "{}"); } catch (error) { return {}; } }
  function renderSources(sources) {
    byId("sourceRegistry").innerHTML = (sources || []).map(function (source) {
      return "<article class=\"it-source-card\" data-route-card=\"source-" + e(source.id) + "\"><div><p class=\"it-eyebrow\"><span data-i18n=\"ui.3ade39c6\">Prioritas</span> " + e(source.priority) + "</p><h3>" + e(source.name) + "</h3></div><div>" + badge(source.status) + " " + badge("LICENSE " + source.licenseStatus) + "</div><p class=\"it-help\">" + e(text(source.notes, "Tidak ada catatan.")) + "</p><div class=\"it-source-meta\"><span><strong>Konten</strong>" + e((source.contentTypes || []).join(", ")) + "</span><span><strong>Record lokal</strong>" + e(source.recordCount || 0) + "</span><span><strong>Offline cache</strong>" + e(source.offlineCacheAllowed ? "Diizinkan" : "Tidak / belum") + "</span><span><strong>Bulk sync</strong>" + e(source.bulkDownloadAllowed ? "Diizinkan" : "Diblokir") + "</span></div><div class=\"it-source-actions\"><a class=\"it-button small\" target=\"_blank\" rel=\"noopener\" href=\"" + e(source.documentationUrl || source.baseUrl) + "\">Dokumentasi</a><button class=\"it-button small\" type=\"button\" data-test-source=\"" + e(source.id) + "\">Test adapter</button></div></article>";
    }).join("");
  }
  function renderStaging(rows) {
    byId("stagingReleaseList").innerHTML = (rows || []).length ? rows.map(function (row) {
      var diff = parseJson(row.diffJson);
      var report = parseJson(row.validationReportJson);
      var actions = row.status === "READY_FOR_REVIEW" ? "<button class=\"it-button small primary\" data-accept-release=\"" + e(row.id) + "\" type=\"button\">Terima</button><button class=\"it-button small danger\" data-reject-release=\"" + e(row.id) + "\" type=\"button\">Tolak</button>" : "";
      return "<article class=\"it-stack-row\"><div><strong>" + e(row.sourceName + " · " + text(row.editionTitle, row.releaseKey)) + "</strong><p>" + e(row.status + " · +" + row.added + " / ~" + row.modified + " / -" + row.removed + " / =" + row.unchanged) + "</p><details><summary>Lihat validasi & diff</summary><pre class=\"it-diff\">" + e(JSON.stringify({ validation: report, diff: diff }, null, 2)) + "</pre></details></div><div class=\"it-stack-actions\">" + badge(row.status) + actions + "</div></article>";
    }).join("") : "<div class=\"it-empty\">Belum ada kandidat staging.</div>";
  }
  function renderDownloads(rows) {
    var audioJobs = state.bootstrap && state.bootstrap.audioManager && state.bootstrap.audioManager.jobs || [];
    var audioById = {}; audioJobs.forEach(function (job) { audioById[String(job.id)] = job; });
    byId("downloadJobList").innerHTML = (rows || []).length ? rows.map(function (row) {
      var audioJob = audioById[String(row.id)], actions = audioJob ? "<button class=\"it-button small primary\" data-process-audio-job=\"" + e(row.id) + "\" type=\"button\">Lanjutkan</button><button class=\"it-button small\" data-retry-audio-job=\"" + e(row.id) + "\" type=\"button\">Retry gagal</button><button class=\"it-button small\" data-verify-audio-job=\"" + e(row.id) + "\" type=\"button\">Verify</button>" : "";
      var detail = audioJob ? " · " + e(audioJob.completedCount || 0) + "/" + e(audioJob.itemCount || 0) + " item" : "";
      return "<article class=\"it-stack-row\"><div><strong>" + e(row.contentType + " · " + row.sourceName) + "</strong><p>" + e(row.status + (row.error ? " · " + row.error : "")) + detail + "</p><div class=\"it-progress\"><span style=\"width:" + Math.max(0, Math.min(100, Number(row.progress || 0))) + "%\"></span></div></div><div class=\"it-stack-actions\">" + badge(row.status) + actions + "</div></article>";
    }).join("") : "<div class=\"it-empty\">Belum ada pekerjaan download.</div>";
  }
  function renderAudioManager(manager) {
    if (!manager) return;
    var integrity = manager.integrity || {};
    var estimate = manager.sizeEstimate || {};
    byId("audioIntegritySummary").textContent = (manager.reciters || []).length + " qari · metadata ayat " + (integrity.ayahMetadata || 0) + " · lokal " + (integrity.ayahDownloaded || 0) + " · file surah lokal " + (integrity.surahDownloaded || 0) + " · parsial " + (integrity.partialFiles || 0) + " · estimasi ukuran: " + (estimate.available ? formatBytes(estimate.bytes) : "belum tersedia dari provider; ukuran aktual dicatat setelah download");
  }
  function renderTajwidManager(manager) {
    if (!manager) return;
    var integrity = manager.integrity || {};
    byId("tajwidIntegritySummary").textContent = "Presentasi " + (integrity.presentationAyahs || 0) + "/6.236 ayat · " + (integrity.spans || 0) + " anotasi · " + (integrity.semanticRules || 0) + " aturan · kanonik " + (integrity.canonicalImmutable ? "tetap/immutable" : "bermasalah");
  }
  function renderSearchManager(manager) {
    if (!manager || !byId("searchIndexSummary")) return;
    byId("searchIndexSummary").innerHTML = [
      ["Qur'an/Hadith/Tafsir/Learning", manager.textIndex, manager.documents + " dokumen"],
      ["Text Search Index", manager.textIndex, "FTS berbobot"],
      ["Semantic Index", manager.semanticIndex, manager.vectors + " vektor lokal"],
      ["Kamus & topik", manager.aliases ? "READY" : "PARTIAL", manager.aliases + " alias · " + manager.topicRelations + " relasi topik"]
    ].map(function (item) { return "<div><strong>" + e(item[0]) + "</strong>" + badge(item[1]) + "<small>" + e(item[2]) + "</small></div>"; }).join("") + "<p class=\"it-help\">Provider: " + e(manager.semanticProvider && manager.semanticProvider.model || "fallback lexical") + " · " + e(formatBytes(manager.indexBytes)) + " · offline " + e(manager.offlineCapable ? "siap" : "belum siap") + "</p>";
  }
  function renderHadithGradingIntegrity(integrity) {
    var target = byId("hadithGradingAuditSummary");
    if (!target || !integrity) return;
    function n(value) { return Number(value || 0).toLocaleString("id-ID"); }
    target.innerHTML = "<strong>Audit grading v" + e(text(integrity.normalizationVersion, "2.0.0")) + "</strong><p>" + e(integrity.meaning) + "</p><div class=\"it-grading-audit-metrics\"><span>" + n(integrity.hadithsWithAnyGradingRow) + " hadis memiliki baris grading</span><span>" + n(integrity.hadithsWithoutPerRecordGrading) + " belum memiliki grading per record</span><span>" + n(integrity.hadithsWithOpposingAssessments) + " memiliki penilaian yang berlawanan</span><span>" + n(integrity.directReferenceVerifiedRows) + " baris dengan rujukan langsung</span><span>" + n(integrity.aggregatorUnverifiedRows) + " baris agregator belum terverifikasi langsung</span></div>";
  }
  function parseSurahScope(value) {
    var result = [];
    String(value || "").split(",").forEach(function (part) {
      var match = part.trim().match(/^(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/); if (!match) return;
      var start = Math.max(1, Math.min(114, Number(match[1]))), end = Math.max(1, Math.min(114, Number(match[2] || match[1]))); if (start > end) { var swap = start; start = end; end = swap; }
      for (var number = start; number <= end; number++) if (!result.includes(number)) result.push(number);
    });
    return result.sort(function (a, b) { return a - b; });
  }
  function updateAudioModeAvailability() {
    if (!state.bootstrap || !byId("audioManagerReciterSelect")) return;
    var reciter = (state.bootstrap.catalog.reciters || []).find(function (item) { return String(item.id) === String(byId("audioManagerReciterSelect").value); });
    var surahOption = byId("audioScopeTypeSelect").querySelector('option[value="surah"]');
    if (surahOption) { surahOption.disabled = !reciter || !reciter.surahReciterKey; surahOption.textContent = surahOption.disabled ? "Satu file per surah (tidak tersedia untuk qari ini)" : "Satu file per surah"; }
    if (surahOption && surahOption.disabled && byId("audioScopeTypeSelect").value === "surah") byId("audioScopeTypeSelect").value = "ayah";
  }
  function renderSnapshots(rows) {
    byId("snapshotList").innerHTML = (rows || []).length ? rows.map(function (row) { return "<article class=\"it-stack-row\"><div><strong>" + e(row.snapshotVersion) + "</strong><p>" + e(row.schemaVersion + " · " + formatBytes(row.fileSize) + " · SHA-256 " + String(row.checksum).slice(0, 16) + "…") + "</p></div><div class=\"it-stack-actions\">" + badge(row.verificationStatus) + "<button class=\"it-button small\" data-verify-snapshot=\"" + e(row.id) + "\" type=\"button\">Verify</button><a class=\"it-button small\" href=\"api/islamic-snapshot.php?id=" + e(row.id) + "\">Download</a><button class=\"it-button small danger\" data-restore-snapshot=\"" + e(row.id) + "\" type=\"button\">Restore merge</button></div></article>"; }).join("") : "<div class=\"it-empty\">Belum ada snapshot.</div>";
  }

  async function loadBootstrap() {
    readingReady=false;window.dispatchEvent(new Event("islamic-reader-ready"));
    var button = byId("reloadSystemButton");
    setBusy(button, true, "Memuat…");
    try {
      state.bootstrap = await apiGet("bootstrap",{language:window.PrayerI18n.getCurrentLanguage()});
      try {
        state.learning.identities=normalizeLearningIdentities(await apiGet("learning_identity_catalog",{refresh:Date.now()}));
        renderLearningIdentityControls();
        if(learningActorId()) {
          state.bootstrap.learningEngine=await apiGet("learning",{language:window.PrayerI18n.getCurrentLanguage(),refresh:Date.now()});
          await offlinePut(cacheKey("bootstrap",{actor_id:learningActorId()}),state.bootstrap);
        }
      } catch (identityError) {
        state.learning.identities=normalizeLearningIdentities((state.bootstrap.learningEngine || state.bootstrap.learning || {}).identities || state.learning.identities);
      }
      await loadLearningAdminCatalog(false);
      state.tajwidTheme = state.bootstrap.tajwidManager && state.bootstrap.tajwidManager.theme || state.tajwidTheme;
      renderStatus(state.bootstrap.status);
      populateCatalog(state.bootstrap.catalog || {});
      renderLearning(state.bootstrap.learningEngine || state.bootstrap.learning || {}, state.bootstrap.catalog || {});
      renderSearchManager(state.bootstrap.searchManager);
      renderHadithGradingIntegrity(state.bootstrap.hadithGradingIntegrity);
      renderTafsirManager(state.bootstrap.tafsirManager);
      applyPreferences(state.bootstrap.preferences || {});
      setConnectivity();
      if(window.MpmAccess?.canPanel("quran")!==false)await loadQuran(false);
      if (window.MpmAccess?.canPanel("hadith")!==false && (state.bootstrap.catalog.hadithCollections || []).length) await loadHadith(1);
      else byId("hadithReader").innerHTML = "<div class=\"it-empty\">Koleksi hadis sedang disiapkan atau belum diimpor.</div>";
    } catch (error) {
      renderStatus(null);
      toast("Database belum dapat dibuka: " + error.message, true);
    } finally { setBusy(button, false);readingReady=!!state.bootstrap&&byId("quranSurahSelect").options.length>0;window.dispatchEvent(new Event("islamic-reader-ready")); }
  }
  function applyPreferences(preferences) {
    state.layout = preferences.layout === "cards" ? "cards" : "inline";
    byId("showLatinToggle").checked = preferences.showLatin !== false;
    byId("showTajwidToggle").checked = !!preferences.showTajwid;
    byId("showAudioToggle").checked = preferences.showAudio !== false;
    byId("arabicFontRange").value = preferences.arabicFontSize || 42;
    byId("arabicLineRange").value = preferences.arabicLineHeight || 2;
    byId("readerLanguageSelect").value = new URLSearchParams(location.search).get("lang") || preferences.language || window.PrayerI18n.getCurrentLanguage();
    var preferredCount = String(preferences.displayCount || 5);
    byId("quranCountSelect").value = byId("quranCountSelect").querySelector("option[value='" + preferredCount + "']") ? preferredCount : "5";
    if (preferences.reciterId && byId("quranReciterSelect").querySelector("option[value='" + preferences.reciterId + "']")) byId("quranReciterSelect").value = String(preferences.reciterId);
    if (byId("audioManagerReciterSelect") && byId("quranReciterSelect").value) byId("audioManagerReciterSelect").value = byId("quranReciterSelect").value;
    byId("audioSpeedSelect").value = String(preferences.playbackSpeed || 1);
    byId("audioRepeatSelect").value = preferences.repeatMode || "off";
    byId("audioAutoNextToggle").checked = preferences.autoNext !== false;
    document.querySelectorAll("[data-layout]").forEach(function (button) { button.classList.toggle("active", button.dataset.layout === state.layout); });
    updateTypography();
  }
  function updateTypography() {
    var size = byId("arabicFontRange").value;
    var line = byId("arabicLineRange").value;
    document.documentElement.style.setProperty("--arabic-size", size + "px");
    document.documentElement.style.setProperty("--arabic-line", line);
    byId("arabicFontOutput").textContent = size + " px";
    byId("arabicLineOutput").textContent = Number(line).toFixed(1);
  }
  function savePreferencesSoon() {
    clearTimeout(savePreferencesSoon.timer);
    savePreferencesSoon.timer = setTimeout(function () {
      apiPost("save_preferences", { preferences: {
        layout: state.layout, showLatin: byId("showLatinToggle").checked,
        showTajwid: byId("showTajwidToggle").checked, showAudio: byId("showAudioToggle").checked,
        arabicFontSize: Number(byId("arabicFontRange").value), arabicLineHeight: Number(byId("arabicLineRange").value),
        language: byId("readerLanguageSelect").value, displayCount: byId("quranCountSelect").value === "full" ? "full" : Number(byId("quranCountSelect").value),
        reciterId: Number(byId("quranReciterSelect").value) || null, playbackSpeed: Number(byId("audioSpeedSelect").value), repeatMode: byId("audioRepeatSelect").value, autoNext: byId("audioAutoNextToggle").checked
      }}).catch(function () {});
    }, 500);
  }
  function searchMode() {
    var checked = document.querySelector('input[name="searchMode"]:checked');
    return checked ? checked.value : "smart";
  }
  function highlightSearchText(value, terms) {
    var source = String(value || "");
    if (!source) return "";
    var unique = Array.from(new Set((terms || []).filter(function (term) { return String(term).length >= 3; }))).sort(function (a, b) { return String(b).length - String(a).length; }).slice(0, 12);
    if (!unique.length) return e(source);
    var pattern = unique.map(function (term) { return String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|");
    try {
      var regex = new RegExp("(" + pattern + ")", "giu"), cursor = 0, output = "", match;
      while ((match = regex.exec(source)) !== null) { output += e(source.slice(cursor, match.index)) + "<mark>" + e(match[0]) + "</mark>"; cursor = match.index + match[0].length; if (!match[0].length) regex.lastIndex++; }
      return output + e(source.slice(cursor));
    } catch (error) { return e(source); }
  }
  function searchResultCard(row) {
    var arabic = row.arabic ? "<div class=\"it-search-arabic\" lang=\"ar\" dir=\"rtl\">" + highlightSearchText(row.arabic, row.highlightTerms) + "</div>" : "";
    var latin = row.transliteration ? "<p class=\"it-latin\">" + highlightSearchText(row.transliteration, row.highlightTerms) + "</p>" : "";
    var translation = row.translation ? "<p class=\"it-translation\">" + highlightSearchText(row.translation, row.highlightTerms) + "</p>" : "";
    var snippet = row.snippet && row.snippet !== row.translation ? "<p class=\"it-search-snippet\">" + highlightSearchText(row.snippet, row.highlightTerms) + "</p>" : "";
    var why = (row.why || []).length ? "<details class=\"it-why\"><summary>Mengapa hasil ini ditemukan?</summary><ul>" + row.why.map(function (reason) { return "<li>" + e(reason) + "</li>"; }).join("") + "</ul></details>" : "";
    var grading = row.contentType === "hadith" ? gradingSummaryHtml(row.gradingSummary, true) : "";
    var variants = (row.editionVariants || []).length ? "<details class=\"it-edition-variants\"><summary>" + e(row.editionVariants.length) + " edisi/bahasa lain</summary>" + row.editionVariants.map(function (variant) { return "<span>" + e([variant.language && variant.language.toUpperCase(), variant.editionTitle, variant.sourceName].filter(Boolean).join(" · ")) + "</span>"; }).join("") + "</details>" : "";
    var sourceUrl = row.source && row.source.url ? "<a target=\"_blank\" rel=\"noopener\" href=\"" + e(row.source.url) + "\">Buka sumber</a>" : "";
    var navigate = row.contentType === "quran" ? "<button class=\"it-button small\" data-search-open-quran=\"" + e(row.citation.surah + ":" + row.citation.ayah) + "\" type=\"button\">Buka di Qur'an Reader</button>" : row.contentType === "hadith" ? "<button class=\"it-button small\" data-hadith-detail=\"" + e(row.internalId) + "\" type=\"button\">Buka di Hadith Reader</button>" : row.contentType === "learning" ? "<button class=\"it-button small\" data-search-open-learning=\"" + e(row.learningLessonId) + "\" type=\"button\">Buka pelajaran</button>" : "";
    return "<article class=\"it-search-result-card\" data-search-document=\"" + e(row.documentId) + "\"><header><div><span class=\"it-search-type\">" + e(row.contentType) + "</span><strong>" + e(row.reference) + "</strong><h3>" + e(row.title) + "</h3></div><div>" + badge(row.matchType) + " " + badge(row.verificationStatus) + "</div></header>" + arabic + latin + translation + snippet + grading + why + variants + "<footer><div class=\"it-search-provenance\"><span>Sumber: " + e(text(row.source && row.source.name)) + "</span><span>Edisi: " + e(text(row.edition && row.edition.title)) + "</span><span>Bahasa: " + e(String(row.language || "").toUpperCase()) + "</span>" + sourceUrl + "</div><div class=\"it-record-actions\"><button class=\"it-button small primary\" data-search-detail=\"" + e(row.documentId) + "\" type=\"button\">Detail & provenance</button>" + navigate + "<button class=\"it-button small\" data-search-feedback=\"relevant\" data-document-id=\"" + e(row.documentId) + "\" type=\"button\">Relevan</button><button class=\"it-button small\" data-search-feedback=\"not_relevant\" data-document-id=\"" + e(row.documentId) + "\" type=\"button\">Tidak relevan</button></div></footer></article>";
  }
  function renderSearchGroup(title, rows, className) {
    if (!rows || !rows.length) return "";
    return "<section class=\"it-search-group " + e(className || "") + "\"><h3>" + e(title) + " <span>" + e(rows.length) + "</span></h3>" + rows.map(searchResultCard).join("") + "</section>";
  }
  function renderSearchResults(result) {
    state.search.result = result;
    byId("searchResultTitle").textContent = result.total + " hasil kuat untuk “" + result.query + "”";
    var expansion = result.expansion || {}, ambiguity = result.referenceAmbiguity || [];
    byId("searchQuerySummary").innerHTML = "<div><span>Bahasa: <strong>" + e(String(result.detectedLanguage || "").toUpperCase()) + "</strong></span><span>Mode: <strong>" + e(result.searchMode) + "</strong></span><span>Waktu: <strong>" + e(result.elapsedMs) + " ms</strong></span><span>Cache: <strong>" + e(result.cache) + "</strong></span></div><p>Query normal: <code>" + e(result.normalizedQuery) + "</code>" + ((expansion.canonicalConcepts || []).length ? " · konsep: " + e(expansion.canonicalConcepts.join(", ")) : "") + "</p>" + ambiguity.map(function (item) { return "<div class=\"it-notice warning\">" + e(item) + "</div>"; }).join("");
    var groups = result.groups || {};
    byId("searchResultList").innerHTML = result.total ? renderSearchGroup("Best Match", groups.bestMatch, "best") + renderSearchGroup("Learning / Iqro", groups.learning) + renderSearchGroup("Qur'an", groups.quran) + renderSearchGroup("Hadith", groups.hadith) + renderSearchGroup("Tafsir", groups.tafsir) + renderSearchGroup("Related", groups.related) : "<div class=\"it-empty\"><strong>" + e(result.message || "Tidak ditemukan kecocokan yang cukup kuat.") + "</strong><p>Sistem tidak memaksakan hasil ber-confidence rendah menjadi dalil.</p></div>";
    byId("searchShowMoreButton").classList.toggle("it-hidden", state.search.limit >= 15 || result.total === 0);
    if (!byId("searchResultDialog").open) byId("searchResultDialog").showModal();
  }
  async function globalSearch(showMore) {
    var query = byId("globalSearchInput").value.trim();
    if (!query) { toast("Masukkan kata, pertanyaan, atau referensi yang dicari.", true); return; }
    if (showMore === true) state.search.limit = 15; else state.search.limit = 5;
    state.search.query = query;
    var button = byId("globalSearchButton"); setBusy(button, true, "Mencari…");
    var parameters = { q: query, mode: searchMode(), type: byId("searchTypeFilter").value, language: byId("searchLanguageFilter").value, collection: byId("searchCollectionFilter").value, tafsir: byId("searchTafsirFilter").value, grade: byId("searchGradeFilter").value, limit: state.search.limit };
    var cacheKey = JSON.stringify(parameters);
    try {
      var result = await apiGet("search", parameters);
      state.search.sessionCache[cacheKey] = result;
      renderSearchResults(result);
    } catch (error) {
      if (state.search.sessionCache[cacheKey]) {
        var cached = Object.assign({}, state.search.sessionCache[cacheKey], { cache: "BROWSER_SESSION_OFFLINE" });
        renderSearchResults(cached);
        toast("Koneksi lokal tidak tersedia; hasil terverifikasi terakhir dalam sesi ini ditampilkan.");
      } else { toast(error.message, true); }
    }
    finally { setBusy(button, false); }
  }
  async function openSearchDetail(documentId) {
    try {
      var row = await apiGet("search_detail", { document_id: documentId });
      var references = (row.allReferences || row.references || []).map(function (ref) { return "<li>" + e([ref.referenceSystem, ref.collectionName, ref.book && "Book " + ref.book, ref.chapter && "Hadith " + ref.chapter, ref.hadithNumber, ref.edition].filter(Boolean).join(" · ")) + (ref.sourceUrl ? " · <a target=\"_blank\" rel=\"noopener\" href=\"" + e(ref.sourceUrl) + "\">sumber</a>" : "") + "</li>"; }).join("");
      var ayahContext = row.ayahContext && row.ayahContext.ayahs ? "<h3>Ayat/range yang dibahas</h3>" + row.ayahContext.ayahs.map(function (ayah) { return "<section class=\"it-record\"><strong>QS " + e(row.ayahContext.surahName + " " + row.ayahContext.surahNumber + ":" + ayah.ayahNumber) + "</strong><div class=\"it-arabic\" lang=\"ar\" dir=\"rtl\">" + e(ayah.arabic) + "</div><p>" + e(text(ayah.translation)) + "</p></section>"; }).join("") : "";
      var learningContext = row.learningContext ? "<h3>Konteks Learning</h3><p>Level " + e(row.learningContext.levelNumber) + " · " + e(row.learningContext.itemType) + " · " + e(row.learningContext.itemKey) + "</p><button class=\"it-button primary\" data-search-open-learning=\"" + e(row.learningContext.lessonId) + "\" type=\"button\">Buka pelajaran</button>" : "";
      var gradingDetails = row.contentType === "hadith" ? "<h3><span data-i18n=\"ui.fafb0891\">Penilaian hadis</span></h3>" + gradingSummaryHtml(row.gradingSummary, false) + gradingDetailHtml(row.allGradings || row.gradings) : "";
      byId("recordDetailContent").innerHTML = "<p class=\"it-eyebrow\">" + e(row.contentType + " · " + row.internalId) + "</p><h2>" + e(row.reference) + "</h2><div class=\"it-arabic\" lang=\"ar\" dir=\"rtl\">" + e(row.arabic) + "</div>" + (row.transliteration ? "<p class=\"it-latin\">" + e(row.transliteration) + "</p>" : "") + (row.translation ? "<p class=\"it-translation\">" + e(row.translation) + "</p>" : "") + ayahContext + learningContext + gradingDetails + "<h3>Source traceability</h3><dl class=\"it-source-trace\"><dt><span data-i18n=\"ui.4e1bb729\">Source</span></dt><dd>" + e(text(row.source && row.source.name)) + "</dd><dt>Edition</dt><dd>" + e(text(row.edition && row.edition.title)) + "</dd><dt>Language</dt><dd>" + e(row.language) + "</dd><dt>Reference system</dt><dd>" + e(text(row.edition && row.edition.referenceSystem)) + "</dd><dt>Database version</dt><dd><code>" + e(row.databaseVersion) + "</code></dd><dt>Status</dt><dd>" + e(row.verificationStatus) + "</dd></dl>" + (references ? "<h3>Referensi edisi</h3><ul>" + references + "</ul>" : "");
      if (!byId("recordDetailDialog").open) byId("recordDetailDialog").showModal();
    } catch (error) { toast(error.message, true); }
  }
  async function sendSearchFeedback(button) {
    setBusy(button, true, "Menyimpan…");
    try { await apiPost("save_search_feedback", { query: state.search.query, documentId: Number(button.dataset.documentId), feedback: button.dataset.searchFeedback }); toast("Feedback disimpan untuk evaluasi; mapping authoritative tidak berubah."); }
    catch (error) { toast(error.message, true); }
    finally { setBusy(button, false); }
  }
  function renderSearchDictionary(data) {
    state.search.dictionary = data;
    var metrics = data.evaluation && data.evaluation.metrics;
    byId("searchEvaluationSummary").innerHTML = metrics ? "Benchmark terakhir: Top-1 " + e(Math.round(metrics.top1Accuracy * 100)) + "% · Top-3 " + e(Math.round(metrics.top3Recall * 100)) + "% · Top-5 " + e(Math.round(metrics.top5Recall * 100)) + "% · false positive " + e(metrics.falsePositiveCount) : "Benchmark belum dijalankan.";
    var rows = (data.searchAliases || []).map(function (row) { row.registry = "search"; return row; }).concat((data.islamicTerms || []).map(function (row) { row.registry = "islamic"; return row; }));
    byId("searchDictionaryList").innerHTML = rows.map(function (row) { return "<article class=\"it-stack-row\"><div><strong>" + e(row.canonicalTerm) + " ← " + e(row.alias) + "</strong><p>" + e(row.language.toUpperCase() + " · " + text(row.aliasType, row.registry) + " · " + row.status + " · " + text(row.source)) + "</p></div><div class=\"it-stack-actions\"><button class=\"it-button small\" data-edit-search-alias=\"" + e(row.id) + "\" data-registry=\"" + e(row.registry) + "\" type=\"button\">Edit</button>" + (row.status !== "SYSTEM" ? "<button class=\"it-button small danger\" data-delete-search-alias=\"" + e(row.id) + "\" data-registry=\"" + e(row.registry) + "\" type=\"button\">Hapus</button>" : "") + "</div></article>"; }).join("") || "<div class=\"it-empty\">Kamus kosong.</div>";
  }
  async function openSearchDictionary() {
    try { renderSearchDictionary(await apiGet("search_dictionary")); byId("searchDictionaryDialog").showModal(); }
    catch (error) { toast(error.message, true); }
  }
  function resetSearchAliasForm() {
    byId("searchAliasId").value = ""; byId("searchAliasCanonical").value = ""; byId("searchAliasText").value = ""; byId("searchAliasLanguage").value = "id"; byId("searchAliasType").value = "semantic"; byId("searchAliasStatus").value = "CURATED"; byId("searchAliasSource").value = "User curated dictionary";
  }
  function editSearchAlias(id, registry) {
    var rows = registry === "islamic" ? state.search.dictionary.islamicTerms : state.search.dictionary.searchAliases, row = (rows || []).find(function (item) { return String(item.id) === String(id); }); if (!row) return;
    byId("searchAliasId").value = row.id; byId("searchAliasRegistry").value = registry; byId("searchAliasCanonical").value = row.canonicalTerm; byId("searchAliasText").value = row.alias; byId("searchAliasLanguage").value = row.language; byId("searchAliasType").value = row.aliasType || "religious"; byId("searchAliasStatus").value = row.status === "SYSTEM" ? "CURATED" : row.status; byId("searchAliasSource").value = row.source || "User curated dictionary"; byId("searchAliasCanonical").focus();
  }
  async function runAction(button, action, body, success, refresh) {
    setBusy(button, true);
    try {
      var result = await apiPost(action, body || {});
      toast(success || "Operasi selesai.");
      if (refresh !== false) await loadBootstrap();
      return result;
    } catch (error) { toast(error.message, true); return null; }
    finally { setBusy(button, false); }
  }

  function bindEvents() {
    document.querySelectorAll(".it-tabs button[data-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        document.querySelectorAll(".it-tabs button[data-tab]").forEach(function (item) { item.classList.toggle("active", item === button); });
        document.querySelectorAll(".it-panel").forEach(function (panel) { panel.classList.toggle("active", panel.dataset.panel === button.dataset.tab); });
      });
    });
    document.querySelectorAll("[data-layout]").forEach(function (button) { button.addEventListener("click", function () { state.layout = button.dataset.layout; document.querySelectorAll("[data-layout]").forEach(function (item) { item.classList.toggle("active", item === button); }); if (state.quran) byId("quranReader").className = "it-reading-list " + state.layout; savePreferencesSoon(); }); });
    ["showLatinToggle", "showTajwidToggle", "showAudioToggle"].forEach(function (id) { byId(id).addEventListener("change", function () { state.tajwidTheme.enabled = byId("showTajwidToggle").checked; if (state.quran) loadQuran(false); applyTajwidTheme(); savePreferencesSoon(); }); });
    ["arabicFontRange", "arabicLineRange"].forEach(function (id) { byId(id).addEventListener("input", updateTypography); byId(id).addEventListener("change", savePreferencesSoon); });
    byId("readerLanguageSelect").addEventListener("change", function () { renderEditionChoices(); savePreferencesSoon(); });
    byId("quranCountSelect").addEventListener("change", function () { syncQuranRange(false); savePreferencesSoon(); });
    byId("quranStartInput").addEventListener("change", function () { if(byId("quranCountSelect").value==="full")byId("quranCountSelect").value="1"; syncQuranRange(false); });
    byId("quranEndInput").addEventListener("change", function () { syncQuranRange(true); savePreferencesSoon(); });
    byId("quranSurahSelect").addEventListener("change", function () { syncQuranRange(false); });
    window.addEventListener("mpm:language-changed",function(){syncQuranRange(false);});
    byId("quranReciterSelect").addEventListener("change", function () { loadQuran(false); savePreferencesSoon(); });
    byId("audioManagerReciterSelect")?.addEventListener("change", updateAudioModeAvailability);
    byId("audioScopeTypeSelect")?.addEventListener("change", function () { if (this.value === "surah") byId("audioBitrateSelect").value = "128"; });
    byId("tafsirFamilySelect").addEventListener("change", renderTafsirLanguages);
    byId("tafsirLanguageSelect").addEventListener("change", renderTafsirWorks);
    byId("tafsirSurahSelect").addEventListener("change", function () { renderTafsirCountOptions(); renderTafsirReaderMeta(); });
    byId("tafsirCountSelect").addEventListener("change", renderTafsirReaderMeta);
    byId("tafsirWorkSelect").addEventListener("change", renderTafsirReaderMeta);
    ["tafsirManagerSearch", "tafsirManagerLanguage", "tafsirManagerStatus"].forEach(function (id) { byId(id).addEventListener(id === "tafsirManagerSearch" ? "input" : "change", function () { renderTafsirManager(state.bootstrap && state.bootstrap.tafsirManager); }); });
    byId("downloadTafsirTemplateButton").addEventListener("click", async function () { try { downloadJson(await apiGet("tafsir_package_template", { refresh: Date.now() }), "mpm-tafsir-package-template.json"); } catch (error) { toast(error.message, true); } });
    byId("tafsirPackageInput").addEventListener("change", async function () {
      var file = this.files[0], editionId = state.tafsir.importEditionId;
      if (!file || !editionId) return;
      try {
        if (file.size > 52428800) throw new Error("Paket tafsir melebihi batas 50 MB.");
        await runAction(null, "import_tafsir_package", { editionId: editionId, fileName: file.name, content: await file.text() }, "Paket tafsir diarsipkan, dinormalisasi, dan diperiksa.");
      } finally { this.value = ""; state.tafsir.importEditionId = 0; }
    });
    byId("loadQuranButton").addEventListener("click", function () { loadQuran(false); });
    byId("loadTafsirButton").addEventListener("click", function () { loadQuran(true); });
    byId("quranPreviousButton").addEventListener("click", function () { if (!state.quran) return; byId("quranStartInput").value = Math.max(1, state.quran.start - state.quran.requestedCount); loadQuran(false); });
    byId("quranNextButton").addEventListener("click", function () { if (!state.quran) return; byId("quranStartInput").value = state.quran.end + 1; loadQuran(false); });
    byId("quranFullscreenButton").addEventListener("click", function () { var reader = document.querySelector('[data-panel="quran"] .it-reader'); if (!document.fullscreenElement && reader.requestFullscreen) reader.requestFullscreen(); else if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); });
    byId("loadHadithButton").addEventListener("click", function () { loadHadith(1); });
    byId("hadithLatinToggle").addEventListener("change", function () { loadHadith(state.hadithPage || 1); });
    byId("hadithPreviousButton").addEventListener("click", function () { loadHadith(state.hadithPage - 1); });
    byId("hadithNextButton").addEventListener("click", function () { loadHadith(state.hadithPage + 1); });
    document.querySelectorAll("[data-learning-primary]").forEach(function(button){button.addEventListener("click",function(){showLearningPrimary(button.dataset.learningPrimary,true);});});
    byId("learningContinueButton").addEventListener("click", function () { var row = state.learning.engine && state.learning.engine.continue; showLearningPrimary("material",false); if (row) loadLearningLesson(row.lessonId,"material",row.lastItemId); });
    byId("learningReviewButton").addEventListener("click", async function () { showLearningPrimary("review",false);try { var row=await apiGet("learning_review",{scope:"due"}); if(row.lessonId){byId("learningReviewLessonSelect").value=String(row.lessonId);toast("Bab review jatuh tempo sudah dipilih. Tekan Mulai sesi review.");}else toast("Belum ada review jatuh tempo; Anda tetap dapat memilih bab secara manual."); } catch(error){toast(error.message,true);} });
    byId("learningHistoryButton").addEventListener("click",function(){showLearningPrimary("history",true);});
    byId("learningPlacementButton").addEventListener("click",function(){showLearningPrimary("material",false);loadLearningLesson(0,"placement");});
    byId("learningPrintButton").addEventListener("click",printLearningPracticeSheet);
    byId("learningMaterialStudentSelect").addEventListener("change",function(){if(this.value && byId("learningMaterialTeacherSelect").value && state.learning.lesson)renderLearningItem();});
    byId("learningMaterialTeacherSelect").addEventListener("change",function(){if(this.value && byId("learningMaterialStudentSelect").value && state.learning.lesson)renderLearningItem();});
    byId("learningMaterialLevelSelect").addEventListener("change",function(){byId("learningMaterialLessonSelect").innerHTML=learningLessonOptions(0,Number(this.value));});
    byId("learningOpenMaterialButton").addEventListener("click",function(){var lessonId=Number(byId("learningMaterialLessonSelect").value);if(lessonId)loadLearningLesson(lessonId,"material");});
    byId("learningShowAllMaterialButton").addEventListener("click",function(){byId("learningMaterialOverview").scrollIntoView({behavior:"smooth",block:"start"});});
    byId("learningOverviewButton").addEventListener("click",function(){byId("learningMaterialOverview").scrollIntoView({behavior:"smooth",block:"start"});});
    byId("learningPreviousLessonButton").addEventListener("click",function(){var lessonId=Number(this.dataset.lessonId);if(lessonId)loadLearningLesson(lessonId,"material");});
    byId("learningNextLessonButton").addEventListener("click",function(){var lessonId=Number(this.dataset.lessonId);if(lessonId)loadLearningLesson(lessonId,"material");});
    byId("learningReviewSetupForm").addEventListener("submit",startLearningReview);
    byId("learningCompleteReviewButton").addEventListener("click",completeLearningReview);
    byId("learningReviewPreviousButton").addEventListener("click",function(){if(state.learning.review.index>0){state.learning.review.index--;renderLearningReviewQuestion();}});
    byId("learningReviewNextButton").addEventListener("click",function(){if(state.learning.review.index<state.learning.review.questions.length-1){state.learning.review.index++;renderLearningReviewQuestion();}});
    byId("learningReviewMarkCorrectButton").addEventListener("click",function(){submitLearningReviewMark(true);});
    byId("learningReviewMarkRepeatButton").addEventListener("click",function(){submitLearningReviewMark(false);});
    byId("learningTestLevelSelect").addEventListener("change",function(){byId("learningTestLessonSelect").innerHTML=learningLessonOptions(0,Number(this.value));renderLearningTestScopeControls();});
    byId("learningTestLessonSelect").addEventListener("change",renderLearningTestScopeControls);
    byId("learningTestTypeSelect").addEventListener("change",function(){if(this.value==="level_test")byId("learningTestMaterialScopeSelect").value="level";renderLearningTestScopeControls();});
    byId("learningTestMaterialScopeSelect").addEventListener("change",function(){if(this.value==="level")byId("learningTestTypeSelect").value="level_test";else if(byId("learningTestTypeSelect").value==="level_test")byId("learningTestTypeSelect").value="chapter_test";renderLearningTestScopeControls();});
    ["learningTestFromUnitSelect","learningTestToUnitSelect","learningTestDifficultySelect"].forEach(function(id){byId(id).addEventListener("change",renderLearningTestScopeControls);});
    byId("learningTestSetupForm").addEventListener("submit",startLearningTest);
    byId("learningTestFinalizeForm").addEventListener("submit",completeLearningTest);
    byId("learningReloadHistoryButton").addEventListener("click",loadLearningTestHistory);
    byId("learningHistoryStudentSelect").addEventListener("change",loadLearningTestHistory);
    byId("learningAddLetterButton").addEventListener("click",function(){openLearningLetterDialog(0);});
    byId("learningLetterForm").addEventListener("submit",saveLearningLetter);
    byId("learningAddStudentButton").addEventListener("click",function(){openLearningStudentDialog("");});
    byId("learningStudentForm").addEventListener("submit",saveLearningStudent);
    byId("learningStudentSearch").addEventListener("input",renderLearningStudents);
    byId("learningContentEntity").addEventListener("change",function(){resetLearningContentForm();});
    byId("learningContentResetButton").addEventListener("click",resetLearningContentForm);
    byId("learningContentForm").addEventListener("submit",saveLearningContent);
    byId("learningReviewBankForm").addEventListener("submit",saveLearningBank);
    byId("learningTestBankForm").addEventListener("submit",saveLearningBank);
    byId("learningReviewBankLesson").addEventListener("change",function(){syncLearningBankUnitOptions("review");});
    byId("learningTestBankLesson").addEventListener("change",function(){syncLearningBankUnitOptions("test");});
    byId("learningReviewBankReset").addEventListener("click",function(){resetLearningBankForm("review");});
    byId("learningTestBankReset").addEventListener("click",function(){resetLearningBankForm("test");});
    document.querySelectorAll("[data-close-dialog]").forEach(function(button){button.addEventListener("click",function(){var dialog=byId(button.dataset.closeDialog);if(dialog&&dialog.open)dialog.close();});});
    byId("learningPreviousItemButton").addEventListener("click",function(){state.learning.itemIndex--;renderLearningItem();});
    byId("learningNextItemButton").addEventListener("click",function(){state.learning.itemIndex++;renderLearningItem();});
    byId("learningRevealLatinButton").addEventListener("click",function(){state.learning.revealLatin=!state.learning.revealLatin;renderLearningItem();});
    byId("learningListenButton").addEventListener("click",function(){speakLearning(1);});
    byId("learningRepeat2Button").addEventListener("click",function(){speakLearning(2);});
    byId("learningRepeat3Button").addEventListener("click",function(){speakLearning(3);});
    byId("learningArabic").addEventListener("click",function(event){var target=event.target.closest("[data-learning-annotation-index]");if(target)showLearningAnnotationDetail(target.dataset.learningAnnotationIndex);});
    byId("learningArabic").addEventListener("keydown",function(event){var target=event.target.closest("[data-learning-annotation-index]");if(target && (event.key === "Enter" || event.key === " ")){event.preventDefault();showLearningAnnotationDetail(target.dataset.learningAnnotationIndex);}});
    byId("learningAnnotationDetail").addEventListener("click",function(event){if(event.target.closest("[data-learning-rule-audio]"))speakLearning(1);if(event.target.closest("[data-learning-annotation-close]")){this.classList.add("it-hidden");this.innerHTML="";}});
    byId("learningCompleteButton").addEventListener("click",completeLearningLesson);
    byId("learningArabicSize").addEventListener("input",function(){byId("learningArabicSizeOutput").textContent=this.value+" px";document.documentElement.style.setProperty("--learning-arabic-size",this.value+"px");if(state.learning.lesson)renderLearningItem();});
    ["learningLatinMode","learningMeaningToggle","learningHarakatToggle","learningColorToggle","learningPatternToggle"].forEach(function(id){byId(id).addEventListener("change",function(){if(state.learning.lesson)renderLearningItem();});});
    byId("learningPreferencesForm").addEventListener("submit",async function(event){event.preventDefault();try{var local=learningPreferencesPayload(),saved=await apiPost("save_learning_preferences",{preferences:local}),effective=saved.queued?(saved.localPreferences||local):saved;state.learning.engine.preferences=effective;applyLearningPreferences(effective);if(state.learning.lesson)renderLearningItem();toast(saved.queued?"Pengaturan disimpan offline.":"Pengaturan Learning disimpan.");}catch(error){toast(error.message,true);}});
    ["learningPackScope","learningPackFromLevel","learningPackToLevel","learningPackAudioToggle","learningPackQuranToggle"].forEach(function(id){byId(id).addEventListener("change",renderLearningPackEstimate);});
    byId("learningBuildPackButton").addEventListener("click",async function(){var button=this;setBusy(button,true,"Membangun…");try{var pack=await apiPost("build_learning_pack",{courseId:state.learning.engine.course.id,scope:learningPackScopePayload()}),response=await fetch(pack.downloadUrl,{cache:"no-store"});if(!response.ok)throw new Error("Paket gagal diunduh (HTTP "+response.status+").");var raw=await response.text(),payload=JSON.parse(raw),installed=await installLearningPack(payload,pack.checksum,raw);byId("learningPackResult").innerHTML="<p class=\"it-help\">"+e(formatBytes(pack.totalBytesKnown)+" · Jilid "+pack.scope.levelFrom+"–"+pack.scope.levelTo+" · "+installed.lessons+" bab terpasang · checksum "+(installed.checksumVerified?"terverifikasi":"tidak didukung browser")+" · audio cache "+installed.audioCached+(installed.audioFailed?" ("+installed.audioFailed+" gagal)":""))+"</p><a class=\"it-button small\" href=\""+e(pack.downloadUrl)+"\">Unduh salinan paket</a>";toast("Paket offline Learning dibangun dan dipasang pada browser ini.");}catch(error){toast(error.message,true);}finally{setBusy(button,false);}});
    byId("learningExportProgressButton").addEventListener("click",async function(){try{downloadJson(await apiGet("learning_export",{refresh:Date.now()}),"mpm-learning-progress.json");}catch(error){toast(error.message,true);}});
    byId("learningProgressImportInput").addEventListener("change",async function(){var file=this.files[0];if(!file)return;try{var payload=JSON.parse(await file.text());await apiPost("import_learning_progress",{payload:payload});toast("Progres Learning berhasil digabungkan.");await refreshLearningCatalog();}catch(error){toast(error.message,true);}});
    byId("learningJsonTemplateButton").addEventListener("click",function(){downloadLearningCurriculumTemplate("json");});
    byId("learningCsvTemplateButton").addEventListener("click",function(){downloadLearningCurriculumTemplate("csv");});
    byId("learningValidateImportButton").addEventListener("click",function(){importLearningCurriculum(false);});
    byId("learningCommitImportButton").addEventListener("click",function(){importLearningCurriculum(true);});
    document.addEventListener("keydown",handleLearningKeyboard);
    byId("globalSearchButton").addEventListener("click", function () { globalSearch(false); });
    byId("globalSearchInput").addEventListener("keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); globalSearch(false); } });
    byId("searchShowMoreButton").addEventListener("click", function () { globalSearch(true); });
    byId("openSearchDictionaryButton")?.addEventListener("click", openSearchDictionary);
    byId("resetSearchAliasButton").addEventListener("click", resetSearchAliasForm);
    byId("searchAliasForm").addEventListener("submit", async function (event) {
      event.preventDefault();
      var button = event.submitter || this.querySelector('button[type="submit"]');
      var saved = await runAction(button, "save_search_alias", { alias: { id: Number(byId("searchAliasId").value) || 0, registry: byId("searchAliasRegistry").value, canonicalTerm: byId("searchAliasCanonical").value, alias: byId("searchAliasText").value, language: byId("searchAliasLanguage").value, aliasType: byId("searchAliasType").value, status: byId("searchAliasStatus").value, source: byId("searchAliasSource").value } }, "Alias pencarian disimpan.", false);
      if (saved) { resetSearchAliasForm(); renderSearchDictionary(await apiGet("search_dictionary", { refresh: Date.now() })); }
    });
    byId("reloadSystemButton").addEventListener("click", loadBootstrap);
    byId("verifyDatabaseButton")?.addEventListener("click", async function () { var result = await runAction(this, "verify_database", {}, "Validasi database selesai.", false); if (result) byId("validationSummary").innerHTML = badge(result.status) + "<pre class=\"it-diff\">" + e(JSON.stringify(result.checks, null, 2)) + "</pre>"; });
    byId("buildSnapshotButton")?.addEventListener("click", function () { runAction(this, "build_snapshot", {}, "Backup tervalidasi berhasil dibuat."); });
    byId("stageSourceButton")?.addEventListener("click", function () { runAction(this, "stage_quran_json", { language: byId("stageLanguageSelect").value, version: byId("stageVersionInput").value }, "Kandidat sudah masuk staging."); });
    byId("syncTransliterationButton")?.addEventListener("click", function () { runAction(this, "sync_transliteration", { version: "3.1.2" }, "Transliterasi berhasil disinkronkan."); });
    byId("saveTajwidThemeButton").addEventListener("click", async function () { var theme = collectTajwidTheme(); var saved = await runAction(this, "save_tajwid_theme", { theme: theme }, "Tema Tajwid tersimpan.", false); if (saved) { state.tajwidTheme = saved; applyTajwidTheme(); if (state.quran) loadQuran(false); } });
    byId("resetTajwidThemeButton").addEventListener("click", async function () { if (!window.confirm("Kembalikan seluruh warna dan mode hukum Tajwid ke default sumber?")) return; var saved = await runAction(this, "reset_tajwid_theme", {}, "Tema Tajwid kembali ke default.", false); if (saved) { state.tajwidTheme = saved; renderTajwidControls(); if (state.quran) loadQuran(false); } });
    ["tajwidModeSelect", "tajwidOpacityRange", "tajwidLegendToggle"].forEach(function (id) { byId(id).addEventListener("change", function () { state.tajwidTheme = collectTajwidTheme(); applyTajwidTheme(); if (state.quran) loadQuran(false); }); });
    byId("enqueueAudioButton")?.addEventListener("click", function () { var surahs = parseSurahScope(byId("audioSurahScopeInput").value); if (!surahs.length) { toast("Cakupan surah tidak valid.", true); return; } runAction(this, "enqueue_audio", { surahs: surahs, reciterId: Number(byId("audioManagerReciterSelect").value), scopeType: byId("audioScopeTypeSelect").value, bitrate: Number(byId("audioBitrateSelect").value), concurrency: Number(byId("audioConcurrencySelect").value) }, "Queue audio tersimpan. Klik proses batch untuk mulai mengunduh."); });
    byId("processAudioQueueButton")?.addEventListener("click", function () { var jobs = state.bootstrap.audioManager && state.bootstrap.audioManager.jobs || []; if (!jobs.length) { toast("Belum ada queue audio.", true); return; } runAction(this, "process_audio_queue", { jobId: Number(jobs[0].id), concurrency: Number(byId("audioConcurrencySelect").value), limit: 24 }, "Batch audio selesai diproses."); });
    byId("verifyAudioButton")?.addEventListener("click", function () { runAction(this, "verify_audio", {}, "Integritas file audio selesai diperiksa."); });
    byId("purgeAudioButton")?.addEventListener("click", function () { var reciterId = Number(byId("audioManagerReciterSelect").value), surahs = parseSurahScope(byId("audioSurahScopeInput").value); if (window.confirm("Hapus file audio lokal qari ini? Metadata dan URL online tetap dipertahankan.")) runAction(this, "purge_audio", { reciterId: reciterId, surah: surahs.length === 1 ? surahs[0] : null }, "File lokal dihapus; metadata tetap ada."); });
    byId("importTajwidButton")?.addEventListener("click", function () { runAction(this, "import_tajwid", {}, "Tajwid 6.236 ayat berhasil diimpor tanpa mengubah teks kanonik."); });
    byId("buildSearchIndexButton")?.addEventListener("click", function () { if (window.confirm("Bangun ulang seluruh indeks pencarian turunan? Reader tetap menggunakan data kanonik yang sama.")) runAction(this, "build_search_index", {}, "Indeks hybrid selesai dibangun."); });
    byId("evaluateSearchButton")?.addEventListener("click", async function () { var result = await runAction(this, "evaluate_search", {}, "Benchmark pencarian selesai.", false); if (result) { toast("Top-1 " + Math.round(result.metrics.top1Accuracy * 100) + "% · Top-5 " + Math.round(result.metrics.top5Recall * 100) + "% · false positive " + result.metrics.falsePositiveCount); renderSearchDictionary(await apiGet("search_dictionary", { refresh: Date.now() })); } });
    document.addEventListener("click", function (event) {
      var target = event.target.closest("[data-tafsir-page],[data-ayah-detail],[data-hadith-detail],[data-play-ayah],[data-test-source],[data-accept-release],[data-reject-release],[data-verify-snapshot],[data-restore-snapshot],[data-process-audio-job],[data-retry-audio-job],[data-verify-audio-job],[data-search-detail],[data-search-feedback],[data-search-open-quran],[data-search-open-learning],[data-edit-search-alias],[data-delete-search-alias],[data-learning-lesson],[data-learning-material-lesson],[data-learning-volume],[data-learning-answer],[data-learning-review-answer],[data-learning-review-next],[data-learning-test-answer],[data-learning-test-next],[data-learning-quran],[data-iqro-edit-letter],[data-iqro-toggle-letter],[data-iqro-edit-student],[data-iqro-toggle-student],[data-iqro-student-detail],[data-iqro-edit-staff],[data-iqro-toggle-staff],[data-iqro-staff-detail],[data-iqro-edit-content],[data-iqro-toggle-content],[data-iqro-edit-bank],[data-iqro-duplicate-bank],[data-iqro-toggle-bank],[data-verify-tafsir],[data-download-tafsir],[data-import-tafsir],[data-remove-tafsir]");
      if (!target) return;
      if (target.dataset.tafsirPage) {
        var online = state.tafsir.online;
        online.page += target.dataset.tafsirPage === "next" ? 1 : -1;
        online.page = Math.max(0, online.page);
        var reference = selectedTafsirReference();
        if (reference) loadOnlineTafsir(reference).catch(function (error) { toast(error.message, true); });
      }
      else if (target.dataset.ayahDetail) openAyahDetail(target.dataset.ayahDetail);
      else if (target.dataset.playAyah) playAyahNumber(Number(target.dataset.playAyah));
      else if (target.dataset.hadithDetail) openHadithDetail(target.dataset.hadithDetail);
      else if (target.dataset.testSource) runAction(target, "test_source", { sourceId: Number(target.dataset.testSource) }, "Source adapter selesai diuji.", false);
      else if (target.dataset.acceptRelease) { if (window.confirm("Terima kandidat ini menjadi data produksi?")) runAction(target, "accept_release", { releaseId: Number(target.dataset.acceptRelease) }, "Kandidat diterima."); }
      else if (target.dataset.rejectRelease) { var reason = window.prompt("Alasan penolakan:", "Ditolak setelah review."); if (reason !== null) runAction(target, "reject_release", { releaseId: Number(target.dataset.rejectRelease), reason: reason }, "Kandidat ditolak."); }
      else if (target.dataset.verifySnapshot) runAction(target, "verify_snapshot", { snapshotId: Number(target.dataset.verifySnapshot) }, "Checksum snapshot sudah diperiksa.");
      else if (target.dataset.restoreSnapshot) { if (window.confirm("Restore menggunakan transactional merge? Data produksi tidak akan dikosongkan terlebih dahulu.")) runAction(target, "restore_snapshot", { snapshotId: Number(target.dataset.restoreSnapshot) }, "Snapshot dipulihkan dengan merge."); }
      else if (target.dataset.processAudioJob) runAction(target, "process_audio_queue", { jobId: Number(target.dataset.processAudioJob), concurrency: Number(byId("audioConcurrencySelect").value), limit: 24 }, "Batch queue selesai.");
      else if (target.dataset.retryAudioJob) runAction(target, "retry_audio_queue", { jobId: Number(target.dataset.retryAudioJob) }, "Item gagal dimasukkan kembali ke queue.");
      else if (target.dataset.verifyAudioJob) runAction(target, "verify_audio", { jobId: Number(target.dataset.verifyAudioJob) }, "Checksum queue selesai diperiksa.");
      else if (target.dataset.searchDetail) openSearchDetail(Number(target.dataset.searchDetail));
      else if (target.dataset.searchFeedback) sendSearchFeedback(target);
      else if (target.dataset.searchOpenQuran) { var reference = target.dataset.searchOpenQuran.split(":"); byId("quranSurahSelect").value = reference[0]; byId("quranStartInput").value = reference[1]; document.querySelector('[data-tab="quran"]').click(); byId("searchResultDialog").close(); loadQuran(false); }
      else if (target.dataset.searchOpenLearning) { if (byId("searchResultDialog").open) byId("searchResultDialog").close(); if (byId("recordDetailDialog").open) byId("recordDetailDialog").close(); document.querySelector('[data-tab="learning"]').click(); showLearningPrimary("material",false); loadLearningLesson(Number(target.dataset.searchOpenLearning),"material"); }
      else if (target.dataset.editSearchAlias) editSearchAlias(target.dataset.editSearchAlias, target.dataset.registry);
      else if (target.dataset.deleteSearchAlias) { if (window.confirm("Hapus alias ini? Record Qur'an/hadis/tafsir tidak ikut terhapus.")) runAction(target, "delete_search_alias", { id: Number(target.dataset.deleteSearchAlias), registry: target.dataset.registry }, "Alias dihapus.", false).then(function () { openSearchDictionary(); }); }
      else if (target.dataset.learningLesson) { loadLearningLesson(Number(target.dataset.learningLesson),"material"); }
      else if (target.dataset.learningMaterialLesson) { loadLearningLesson(Number(target.dataset.learningMaterialLesson),"material"); }
      else if (target.dataset.learningVolume) { var volume=((state.learning.engine && state.learning.engine.levels)||[]).find(function(row){return Number(row.id)===Number(target.dataset.learningVolume);});if(volume){byId("learningMaterialLevelSelect").value=String(volume.id);byId("learningMaterialLessonSelect").innerHTML=learningLessonOptions(volume.firstLessonId,volume.id);if(volume.firstLessonId)loadLearningLesson(Number(volume.firstLessonId),"material");} }
      else if (target.dataset.learningAnswer) submitLearningAnswer(target);
      else if (target.dataset.learningReviewAnswer) submitLearningReviewAnswer(target);
      else if (target.hasAttribute("data-learning-review-next")) { if(state.learning.review.index<state.learning.review.questions.length-1){state.learning.review.index++;byId("learningReviewHintUsed").checked=false;byId("learningReviewRepetitionCount").value="0";renderLearningReviewQuestion();} }
      else if (target.dataset.learningTestAnswer) submitLearningTestAnswer(target);
      else if (target.hasAttribute("data-learning-test-next")) { if(state.learning.test.index<state.learning.test.questions.length-1){state.learning.test.index++;renderLearningTestQuestion();} }
      else if (target.dataset.learningQuran) { var learningReference=target.dataset.learningQuran.split(":"),countSelect=target.closest(".it-quran-learning-ref").querySelector("[data-learning-quran-count]");byId("quranSurahSelect").value=learningReference[0];byId("quranStartInput").value=learningReference[1];byId("quranCountSelect").value=countSelect ? countSelect.value : "1";document.querySelector('[data-tab="quran"]').click();loadQuran(false); }
      else if (target.dataset.iqroEditLetter) openLearningLetterDialog(Number(target.dataset.iqroEditLetter));
      else if (target.dataset.iqroToggleLetter) apiPost("set_iqro_letter_active",{id:Number(target.dataset.iqroToggleLetter),isActive:target.dataset.active==="1"}).then(function(){return loadLearningAdminCatalog(true);}).catch(function(error){toast(error.message,true);});
      else if (target.dataset.iqroEditStudent) openLearningStudentDialog(target.dataset.iqroEditStudent);
      else if (target.dataset.iqroToggleStudent) apiPost("set_iqro_student_active",{userId:target.dataset.iqroToggleStudent,isActive:target.dataset.active==="1"}).then(async function(){await refreshLearningCatalog();await loadLearningAdminCatalog(true);}).catch(function(error){toast(error.message,true);});
      else if (target.dataset.iqroStudentDetail) showLearningStudentDetail(target.dataset.iqroStudentDetail);
      else if (target.dataset.iqroEditStaff) openLearningStaffDialog(target.dataset.iqroEditStaff);
      else if (target.dataset.iqroToggleStaff) apiPost("set_iqro_staff_active",{userId:target.dataset.iqroToggleStaff,isActive:target.dataset.active==="1"}).then(async function(){await refreshLearningCatalog();await loadLearningAdminCatalog(true);}).catch(function(error){toast(error.message,true);});
      else if (target.dataset.iqroStaffDetail) showLearningStaffDetail(target.dataset.iqroStaffDetail);
      else if (target.dataset.iqroEditContent) editLearningContent(target.dataset.entity,Number(target.dataset.iqroEditContent));
      else if (target.dataset.iqroToggleContent) apiPost("set_iqro_content_active",{entity:target.dataset.entity,id:Number(target.dataset.iqroToggleContent),isActive:target.dataset.active==="1"}).then(async function(){await refreshLearningCatalog();await loadLearningAdminCatalog(true);}).catch(function(error){toast(error.message,true);});
      else if (target.dataset.iqroEditBank) editLearningBank(target.dataset.purpose,Number(target.dataset.iqroEditBank));
      else if (target.dataset.iqroDuplicateBank) apiPost("duplicate_iqro_bank_item",{id:Number(target.dataset.iqroDuplicateBank)}).then(function(){return loadLearningAdminCatalog(true);}).catch(function(error){toast(error.message,true);});
      else if (target.dataset.iqroToggleBank) apiPost("set_iqro_bank_item_active",{id:Number(target.dataset.iqroToggleBank),isActive:target.dataset.active==="1"}).then(function(){return loadLearningAdminCatalog(true);}).catch(function(error){toast(error.message,true);});
      else if (target.dataset.verifyTafsir) runAction(target, "verify_tafsir_edition", { editionId: Number(target.dataset.verifyTafsir) }, "Integritas teknis edisi tafsir selesai diperiksa.");
      else if (target.dataset.downloadTafsir) { if (window.confirm("Unduh/update hanya dari URL dan lisensi yang sudah lolos registry. Lanjutkan?")) runAction(target, "download_tafsir_edition", { editionId: Number(target.dataset.downloadTafsir) }, "Paket tafsir berhasil diunduh dan diimpor."); }
      else if (target.dataset.importTafsir) { state.tafsir.importEditionId = Number(target.dataset.importTafsir); byId("tafsirPackageInput").click(); }
      else if (target.dataset.removeTafsir) { if (window.confirm("Hapus record edisi ini dari reader dan indeks lokal? Arsip raw/normalized tetap disimpan untuk audit dan pemulihan.")) runAction(target, "remove_local_tafsir", { editionId: Number(target.dataset.removeTafsir) }, "Record lokal dihapus; arsip audit dipertahankan."); }
    });
    window.addEventListener("online", function(){setConnectivity();flushLearningOutbox();});
    window.addEventListener("offline", setConnectivity);
    document.addEventListener("mpm:islamic-live-progress", function (event) {
      var outputs = (((event || {}).detail || {}).translations || {}).recentOutputs || [];
      ["tafsir", "hadith"].forEach(function (type) {
        var signature = outputs.filter(function (output) { return output.contentType === type; }).map(function (output) { return output.id + ":" + output.status; }).join("|");
        var previous = state.automationLiveSignatures[type];
        state.automationLiveSignatures[type] = signature;
        if (!previous || previous === signature) return;
        var activePanel = document.querySelector('.it-panel.active');
        if (!activePanel || activePanel.dataset.panel !== type) return;
        clearTimeout(state.automationReaderRefreshTimer);
        state.automationReaderRefreshTimer = setTimeout(function () {
          if (type === "tafsir") loadQuran(true); else loadHadith(state.hadithPage || 1);
        }, 350);
      });
    });
  }

  var learningLanguageRequest=0;
  window.addEventListener("mpm:language-changed",async function(){
    if(!state.bootstrap)return;
    var request=++learningLanguageRequest,primary=state.learning.primary;
    try{var engine=await apiGet("learning",{language:window.PrayerI18n.getCurrentLanguage()});if(request!==learningLanguageRequest)return;renderLearning(engine,state.bootstrap.catalog||{});showLearningPrimary(primary,false);}catch(error){toast(error.message,true);}
  });
  document.addEventListener("DOMContentLoaded", async function () {
    byId("readerLanguageSelect").value=window.PrayerI18n.getCurrentLanguage();
    bindEvents();
    bindWorship();
    bindAudioEngine();
    setConnectivity();
    if(window.MpmUserSessionReady)await window.MpmUserSessionReady;
    if (navigator.onLine) flushLearningOutbox();
    loadBootstrap();
    if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(function () {});
  });
}());
