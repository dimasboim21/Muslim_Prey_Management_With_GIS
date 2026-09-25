(function (window) {
  "use strict";

  var DEFAULT_FIELDS = ["prayer_name", "adzan_time", "actual_time", "remaining"];
  var PRAYERS = ["subuh", "dhuhur", "ashar", "maghrib", "isha", "jumat"];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function number(value, fallback) { var result = Number(value); return Number.isFinite(result) ? result : fallback; }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  function lines(value) { return String(value || "").split(/\r?\n/).map(function (row) { return row.trim(); }).filter(Boolean); }
  function reading(step, gender) {
    var variants = step && step.readings || {};
    return variants[gender] && (variants[gender].arabic || variants[gender].latin || variants[gender].translation)
      ? variants[gender] : variants.neutral || variants.male || {};
  }
  function reference(step) { return step && step.reference ? clone(step.reference) : null; }
  function guideStep(event, key) { return event && event.guide && event.guide.steps ? event.guide.steps.find(function (step) { return step.stepKey === key; }) : null; }
  function content(eyebrow, title, subtitle, body, arabic, latin, translation, instruction, sourceNote) {
    return { eyebrow: eyebrow || "", title: title || "", subtitle: subtitle || "", body: body || "", arabic: arabic || "", latin: latin || "", translation: translation || "", instruction: instruction || "", sourceNote: sourceNote || "" };
  }
  function contentsByGender(factory) {
    var result = { id: {} };
    ["neutral", "male", "female", "male_plural", "female_plural", "mixed", "unknown"].forEach(function (gender) { result.id[gender] = factory(gender); });
    return result;
  }
  function scene(key, chapter, type, title, duration, options) {
    options = options || {};
    return {
      sceneKey: key, chapterKey: chapter, sceneType: type, title: title, sequenceOrder: 0,
      isEnabled: options.enabled !== false, isOptional: options.optional === true,
      durationMode: options.durationMode || "manual", durationSeconds: duration,
      weight: number(options.weight, 1), minimumDuration: number(options.minimum, Math.min(duration, 3)),
      preferredDuration: number(options.preferred, duration), maximumDuration: number(options.maximum, Math.max(duration, 120)),
      mediaPath: options.mediaPath || null, reference: options.reference || null,
      settings: Object.assign({ showArabic: true, showLatin: true, showTranslation: true, showEvidence: false }, options.settings || {}),
      contents: options.contents || { id: { neutral: content("", title, "", "") } }
    };
  }
  function formatTokenDate(value, event, language) {
    if (!value) { return "-"; }
    var date = new Date(String(value).replace(" ", "T"));
    if (!Number.isFinite(date.getTime())) { return String(value); }
    try { return new Intl.DateTimeFormat(language === "en" ? "en-US" : "id-ID", { dateStyle: "full", timeStyle: "short", timeZone: event.timezone || "Asia/Jakarta" }).format(date); }
    catch (error) { return String(value); }
  }
  function tokens(event, language) {
    var genderLabel = event.deceasedGender === "male" ? "Laki-laki" : event.deceasedGender === "female" ? "Perempuan" : event.deceasedGender === "male_plural" ? "Beberapa laki-laki" : event.deceasedGender === "female_plural" ? "Beberapa perempuan" : event.deceasedGender === "mixed" ? "Korban campuran" : "Jenis kelamin belum diketahui";
    var prayerAt = event.funeralAction === "ghaib" ? event.ghaibAt : event.prayerAt;
    var prayerLocation = event.funeralAction === "ghaib" ? event.ghaibLocation : (event.prayerMosqueName || event.prayerLocation);
    return {
      deceasedName: event.deceasedName || "Informasi duka", genderLabel: genderLabel,
      eventName: event.eventName || "Peristiwa dengan korban jiwa", eventLocation: event.eventLocation || "-",
      fatalityCount: event.fatalityCount || "-", eventAtFormatted: formatTokenDate(event.eventAt, event, language),
      prayerAtFormatted: formatTokenDate(prayerAt, event, language), prayerLocation: prayerLocation || "-",
      prayerName: event.funeralAction === "ghaib" ? "Sholat Ghaib" : "Sholat Jenazah",
      deceasedGrammar: event.deceasedGender === "female" ? "almarhumah" : event.deceasedGender === "male" ? "almarhum" : event.deceasedGender === "female_plural" ? "para almarhumah" : event.deceasedGender === "male_plural" ? "para almarhum" : "mereka",
      sourceName: event.sourceName || "-"
    };
  }
  function replaceTokens(value, event, language) {
    var map = tokens(event || {}, language || "id");
    return String(value || "").replace(/\{([A-Za-z0-9_]+)\}/g, function (_, key) { return map[key] === undefined ? "" : String(map[key]); });
  }
  function selectedContent(sceneRow, event, language) {
    var languageRows = sceneRow && sceneRow.contents && (sceneRow.contents[language] || sceneRow.contents.id) || {};
    var gender = event && event.deceasedGender || "unknown";
    var selected = languageRows[gender] || (["male_plural", "female_plural", "mixed"].indexOf(gender) >= 0 ? languageRows.neutral : null) || languageRows.unknown || languageRows.neutral || languageRows.male || {};
    var result = {};
    Object.keys(selected).forEach(function (key) { result[key] = typeof selected[key] === "string" ? replaceTokens(selected[key], event, language) : selected[key]; });
    return result;
  }
  function contentDuration(sceneRow, event) {
    var selected = selectedContent(sceneRow, event, "id");
    var proseWords = [selected.eyebrow, selected.title, selected.subtitle, selected.body, selected.latin, selected.translation, selected.instruction].join(" ").trim().split(/\s+/).filter(Boolean).length;
    var arabicCharacters = String(selected.arabic || "").replace(/\s/g, "").length;
    return clamp(Math.ceil(2.5 + proseWords / 3.1 + arabicCharacters / 26), number(sceneRow.minimumDuration, 3), number(sceneRow.maximumDuration, 120));
  }
  function effectiveDuration(sceneRow, event, autoAdjust) {
    var minimum = number(sceneRow.minimumDuration, 3), maximum = Math.max(minimum, number(sceneRow.maximumDuration, 120));
    if (!autoAdjust || sceneRow.durationMode === "manual") { return clamp(number(sceneRow.durationSeconds, 10), minimum, maximum); }
    if (sceneRow.durationMode === "proportional") { return clamp(number(sceneRow.preferredDuration, 10) * number(sceneRow.weight, 1), minimum, maximum); }
    return contentDuration(sceneRow, event);
  }
  function normalize(raw, event) {
    var value = raw && raw.sequence && Array.isArray(raw.sequence.scenes) ? clone(raw) : buildDefault(event || {});
    value.isEnabled = value.isEnabled !== false;
    value.presetMode = value.presetMode || "standard";
    value.autoAdjustDuration = value.autoAdjustDuration !== false;
    value.overflowPolicy = value.overflowPolicy || "auto_optimize";
    value.interruptionPolicy = value.interruptionPolicy || "finish_scene_pause";
    value.completionAction = value.completionAction || "return_normal";
    value.persistentPrayerEnabled = value.persistentPrayerEnabled !== false;
    value.persistentFields = Array.isArray(value.persistentFields) ? value.persistentFields : DEFAULT_FIELDS.slice();
    value.contentOptions = Object.assign({ showLaw: true, showEvidence: true, showArabic: true, showLatin: true, showTranslation: true }, value.contentOptions || {});
    value.sequence = value.sequence || {};
    value.sequence.sequenceKey = value.sequence.sequenceKey || "funeral-presentation-" + (event.eventKey || "draft");
    value.sequence.name = value.sequence.name || "Presentasi Sholat Jenazah/Ghaib";
    value.sequence.loopEnabled = value.sequence.loopEnabled !== false;
    value.sequence.settings = Object.assign({ oneViewport: true, chapterDurations: {} }, value.sequence.settings || {});
    value.sequence.settings.chapterDurations = value.sequence.settings.chapterDurations && typeof value.sequence.settings.chapterDurations === "object" ? value.sequence.settings.chapterDurations : {};
    value.sequence.scenes = (value.sequence.scenes || []).map(function (row, index) {
      row.sequenceOrder = index + 1;
      row.durationMode = row.durationMode || "manual";
      row.durationSeconds = number(row.durationSeconds, 10);
      row.minimumDuration = number(row.minimumDuration, 3);
      row.preferredDuration = number(row.preferredDuration, row.durationSeconds);
      row.maximumDuration = Math.max(row.preferredDuration, number(row.maximumDuration, 120));
      row.weight = number(row.weight, 1);
      row.effectiveDurationSeconds = effectiveDuration(row, event, value.autoAdjustDuration);
      return row;
    });
    value.schedule = value.schedule || {};
    value.schedule.displayEnabled = value.schedule.displayEnabled !== false;
    value.schedule.allowedContexts = Array.isArray(value.schedule.allowedContexts) ? value.schedule.allowedContexts : ["outside_fardhu", "before_fardhu", "pre_adzan", "iqamah", "after_prayer", "qiyamul_lail", "syuruq", "dhuha_awwal", "dhuha_wustha", "dhuha_awwabin"];
    value.schedule.protectedPhases = Array.isArray(value.schedule.protectedPhases) ? value.schedule.protectedPhases : ["adzan", "iqamah", "prayer", "friday"];
    value.schedule.protectedOverrides = Array.isArray(value.schedule.protectedOverrides) ? value.schedule.protectedOverrides : [];
    value.schedule.prayerRules = value.schedule.prayerRules || defaultPrayerRules();
    value.schedule.timeWindows = Array.isArray(value.schedule.timeWindows) ? value.schedule.timeWindows : [];
    value.schedule.customRule = value.schedule.customRule || { expression: "", enabled: false };
    return value;
  }
  function defaultPrayerRules() {
    var result = {};
    PRAYERS.forEach(function (prayer) {
      result[prayer] = { enabled: true, beforeMinutes: 30, afterMinutes: 30, phases: { outside_fardhu: true, before_fardhu: true, pre_adzan: true, adzan: false, iqamah: true, prayer: false, after_prayer: true } };
    });
    result.jumat.phases.pre_adzan = false;
    result.jumat.phases.iqamah = false;
    return result;
  }
  function defaultContentsFromStep(step, title, eyebrow, description) {
    return contentsByGender(function (gender) {
      var selected = reading(step, gender);
      return content(eyebrow, title, "", description || step && step.movementDescription, selected.arabic, selected.latin, selected.translation, step && step.instruction, "");
    });
  }
  function buildDefault(event) {
    event = event || {};
    var scenes = [], action = event.funeralAction || "janazah", individual = (event.eventType || "individual_death") === "individual_death";
    var ready = guideStep(event, "ready"), takbir1 = guideStep(event, "takbir-1"), fatihah = guideStep(event, "fatihah"), takbir2 = guideStep(event, "takbir-2"), salawat = guideStep(event, "salawat"), takbir3 = guideStep(event, "takbir-3"), funeralDua = guideStep(event, "funeral-dua"), takbir4 = guideStep(event, "takbir-4"), closingDua = guideStep(event, "closing-dua"), salamRight = guideStep(event, "salam-right"), salamLeft = guideStep(event, "salam-left"), postPrayer = guideStep(event, "post-prayer-dua");
    scenes.push(scene("death-information", "information", individual ? "death_information" : "mass_casualty", "Kabar Duka", 15, { contents: contentsByGender(function () { return individual
      ? content("Inna lillahi wa inna ilaihi raji'un", "{deceasedName}", "{genderLabel}", "Wafat:\n{eventAtFormatted}", "", "", "", "Sumber: {sourceName}")
      : content("Inna lillahi wa inna ilaihi raji'un", "{eventName}", "{eventLocation}", "Korban meninggal terkonfirmasi:\n{fatalityCount} jiwa", "", "", "", "Daftar nama tidak ditampilkan pada layar publik."); }) }));
    scenes.push(scene("prayer-invitation", "invitation", "invitation", "Ajakan Sholat", 15, { contents: contentsByGender(function () { return content("Mari Melaksanakan", "{prayerName}", action === "ghaib" ? "Untuk mendoakan: {deceasedName}" : "Insya Allah dilaksanakan", "{prayerAtFormatted}\n{prayerLocation}"); }) }));
    scenes.push(scene("legal-ruling", "legal", "legal_ruling", "Hukum Sholat", 15, { optional: true, reference: reference(ready), contents: contentsByGender(function () { return content("Hukum", action === "ghaib" ? "Sholat Ghaib" : "Fardhu Kifayah", "Metode aktif: {prayerName}", action === "ghaib" ? "Penerapan Sholat Ghaib memiliki rincian dan perbedaan fiqih. Admin menentukan penggunaannya menurut metode dan otoritas yang dipilih." : "Sholat Jenazah secara umum diperlakukan sebagai kewajiban kolektif. Ringkasan ini mengikuti dataset fiqih terverifikasi, bukan keputusan renderer."); }) }));
    scenes.push(scene("primary-evidence", "evidence", "evidence", "Dasar dan Referensi", 15, { optional: true, reference: action === "ghaib" ? reference(ready) : reference(fatihah), contents: contentsByGender(function () { var ref = action === "ghaib" ? reference(ready) : reference(fatihah); return content("Dalil", action === "ghaib" ? "Riwayat Sholat Ghaib" : "Dasar Sholat Jenazah", "", ref ? [ref.book, ref.hadithNumber ? "Hadis " + ref.hadithNumber : "", ref.narrator ? "Perawi: " + ref.narrator : "", ref.grade ? "Status: " + ref.grade : ""].filter(Boolean).join("\n") : "Referensi belum dipilih.", "", "", "", "Nomor dapat berbeda antar-edisi; gunakan reference ID dan URL sumber."); }) }));
    scenes.push(scene("intention-explanation", "intention", "explanation", "Niat", 10, { contents: contentsByGender(function () { return content("Persiapan", "Niat di Dalam Hati", "Qashd", "Hadirkan maksud melaksanakan sholat karena Allah. Lafaz, bila ditampilkan, hanya bantuan pembelajaran dan bukan satu-satunya bentuk niat yang sah."); }) }));
    scenes.push(scene("intention-evidence", "intention", "evidence", "Dasar Niat", 10, { optional: true, reference: { referenceKey: "bukhari-intention-1", book: "Sahih al-Bukhari", hadithNumber: "1", narrator: "Umar bin al-Khattab", grade: "Sahih", url: "https://sunnah.com/bukhari:1", verificationStatus: "verified" }, contents: contentsByGender(function () { return content("Dalil Niat", "Amal Bergantung pada Niat", "Sahih al-Bukhari 1", "Hadis ini menjadi dasar umum pentingnya niat.", "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ", "Innamal a'malu binniyat", "Amal bergantung pada niat."); }) }));
    scenes.push(scene("intention-how", "intention", "instruction", "Cara Niat", 10, { contents: contentsByGender(function () { return content("Cara", "Niatkan Ibadah di Dalam Hati", "", "Berdiri, menghadap kiblat, dan hadirkan maksud melaksanakan {prayerName} karena Allah.", "", "", "", action === "ghaib" ? "Jenazah tidak berada di hadapan jamaah." : "Posisi jenazah mengikuti tata cara dan arahan imam."); }) }));
    scenes.push(scene("qibla", "qibla", "movement", "Berdiri Menghadap Kiblat", 10, { mediaPath: ready && ready.mediaPath, reference: reference(ready), contents: defaultContentsFromStep(ready, "Berdiri Menghadap Kiblat", "Persiapan", action === "ghaib" ? "Berdiri menghadap kiblat tanpa jenazah berada di hadapan jamaah." : "Jamaah berdiri menghadap kiblat; penempatan jenazah mengikuti arahan imam.") }));
    scenes.push(scene("takbir-1", "first_takbir", "movement_reading", "Takbir Pertama", 5, { mediaPath: takbir1 && takbir1.mediaPath, reference: reference(takbir1), contents: defaultContentsFromStep(takbir1, "Takbir Pertama", "Takbir 1") }));
    scenes.push(scene("fold-hands", "fold_hands", "movement", "Bersedekap", 5, { mediaPath: fatihah && fatihah.mediaPath, contents: contentsByGender(function () { return content("Posisi", "Bersedekap", "", "Setelah takbir pertama, berdiri dalam posisi bersedekap sebelum membaca Al-Fatihah."); }) }));
    var fatihahVariants = {};
    ["neutral", "male", "female", "male_plural", "female_plural", "mixed", "unknown"].forEach(function (gender) {
      var selected = reading(fatihah, gender), arabic = lines(selected.arabic), latin = lines(selected.latin), translation = lines(selected.translation);
      fatihahVariants[gender] = { arabic: arabic, latin: latin, translation: translation };
    });
    for (var ayah = 0; ayah < 7; ayah += 1) {
      (function (index) {
        var length = (fatihahVariants.neutral.arabic[index] || "").length + (fatihahVariants.neutral.translation[index] || "").length;
        scenes.push(scene("fatihah-ayah-" + (index + 1), "al_fatihah", "quran_ayah", "Al-Fatihah Ayat " + (index + 1), length > 145 ? 10 : length > 85 ? 7 : 5, { durationMode: "content_based", minimum: 5, preferred: length > 145 ? 10 : 7, maximum: 20, reference: reference(fatihah), contents: contentsByGender(function (gender) { var rows = fatihahVariants[gender] || fatihahVariants.neutral; return content("Membaca Surah Al-Fatihah", "Ayat " + (index + 1), "1 ayat · 1 laman", "", rows.arabic[index], rows.latin[index], rows.translation[index]); }) }));
      })(ayah);
    }
    scenes.push(scene("fatihah-evidence", "al_fatihah", "evidence", "Dasar Membaca Al-Fatihah", 15, { optional: true, reference: { referenceKey: "bukhari-funeral-fatihah", book: "Sahih al-Bukhari", hadithNumber: "1335", narrator: "Talhah bin Abdullah bin Auf dari Ibnu Abbas", grade: "Sahih", url: "https://sunnah.com/bukhari:1335", verificationStatus: "verified" }, contents: contentsByGender(function () { return content("Dalil", "Al-Fatihah dalam Sholat Jenazah", "Sahih al-Bukhari 1335", "Ibnu Abbas membaca Al-Fatihah dalam sholat jenazah dan menjelaskan bahwa hal tersebut termasuk Sunnah."); }) }));
    scenes.push(scene("takbir-2", "second_takbir", "movement_reading", "Takbir Kedua", 5, { mediaPath: takbir2 && takbir2.mediaPath, reference: reference(takbir2), contents: defaultContentsFromStep(takbir2, "Takbir Kedua", "Takbir 2") }));
    scenes.push(scene("salawat-reading", "salawat", "reading", "Shalawat kepada Nabi", 10, { mediaPath: salawat && salawat.mediaPath, reference: reference(salawat), durationMode: "content_based", contents: defaultContentsFromStep(salawat, "Shalawat kepada Nabi ﷺ", "Setelah Takbir Kedua") }));
    scenes.push(scene("takbir-3", "third_takbir", "movement_reading", "Takbir Ketiga", 5, { mediaPath: takbir3 && takbir3.mediaPath, reference: reference(takbir3), contents: defaultContentsFromStep(takbir3, "Takbir Ketiga", "Takbir 3") }));
    var duaParts = 3;
    for (var part = 0; part < duaParts; part += 1) {
      (function (index) {
        scenes.push(scene("funeral-dua-" + (index + 1), "funeral_dua", "gender_reading", "Doa untuk Jenazah " + (index + 1), 12, { durationMode: "content_based", minimum: 7, preferred: 12, maximum: 30, reference: reference(funeralDua), contents: contentsByGender(function (gender) {
          var selected = reading(funeralDua, gender), split = function (value) { var chunks = String(value || "").split(/[,،]/).map(function (row) { return row.trim(); }).filter(Boolean); var size = Math.ceil(chunks.length / duaParts); return chunks.slice(index * size, (index + 1) * size).join(index === 0 ? ", " : ", "); };
          return content("Setelah Takbir Ketiga", "Doa untuk Jenazah", "Bagian " + (index + 1) + " dari " + duaParts, "", split(selected.arabic), split(selected.latin), split(selected.translation), funeralDua && funeralDua.instruction);
        }) }));
      })(part);
    }
    scenes.push(scene("takbir-4", "fourth_takbir", "movement_reading", "Takbir Keempat", 5, { mediaPath: takbir4 && takbir4.mediaPath, reference: reference(takbir4), contents: defaultContentsFromStep(takbir4, "Takbir Keempat", "Takbir 4") }));
    scenes.push(scene("final-dua", "final_dua", "reading", "Doa Penutup", 10, { reference: reference(closingDua), durationMode: "content_based", contents: defaultContentsFromStep(closingDua, "Doa Penutup", "Setelah Takbir Keempat") }));
    scenes.push(scene("salam-right", "salam", "movement_reading", "Salam", 7, { mediaPath: salamRight && salamRight.mediaPath, reference: reference(salamRight), contents: defaultContentsFromStep(salamRight, "Salam", "Penutup Sholat") }));
    if (salamLeft) { scenes.push(scene("salam-left", "salam", "movement", "Salam ke Kiri", 5, { optional: true, mediaPath: salamLeft.mediaPath, reference: reference(salamLeft), contents: defaultContentsFromStep(salamLeft, "Salam ke Kiri", "Variasi Metode") })); }
    scenes.push(scene("closing", "closing", "closing", "Penutup", 10, { contents: contentsByGender(function (gender) { return content("Rangkaian Selesai", "Semoga Allah Mengampuni dan Merahmati", "", gender === "mixed" || gender === "unknown" ? "Mari mendoakan para korban dan keluarga yang ditinggalkan." : "Semoga Allah mengampuni dan merahmati {deceasedGrammar}.\nMari mendoakan keluarga yang ditinggalkan."); }) }));
    if (postPrayer) { scenes.push(scene("post-prayer-dua", "closing", "movement", "Doa Lanjutan", 8, { enabled: false, optional: true, mediaPath: postPrayer.mediaPath, reference: reference(postPrayer), contents: defaultContentsFromStep(postPrayer, "Doa Setelah Sholat", "Opsional") })); }
    var result = {
      isEnabled: true, presetMode: "standard", autoAdjustDuration: true, maximumDurationSeconds: 420,
      overflowPolicy: "auto_optimize", interruptionPolicy: "finish_scene_pause", completionAction: "return_normal",
      persistentPrayerEnabled: true, persistentFields: DEFAULT_FIELDS.slice(),
      contentOptions: { showLaw: true, showEvidence: true, showArabic: true, showLatin: true, showTranslation: true },
      sequence: { sequenceKey: "funeral-presentation-" + (event.eventKey || "draft"), name: "Presentasi " + (action === "ghaib" ? "Sholat Ghaib" : "Sholat Jenazah"), loopEnabled: true, settings: { oneViewport: true, chapterDurations: {} }, scenes: scenes },
      schedule: { displayEnabled: true, allowedContexts: ["outside_fardhu", "before_fardhu", "pre_adzan", "iqamah", "after_prayer", "qiyamul_lail", "syuruq", "dhuha_awwal", "dhuha_wustha", "dhuha_awwabin"], protectedPhases: ["adzan", "iqamah", "prayer", "friday"], protectedOverrides: [], prayerRules: defaultPrayerRules(), timeWindows: [], customRule: { expression: "", enabled: false } }
    };
    applyPreset(result, "standard");
    return normalize(result, event);
  }
  function applyPreset(presentation, preset) {
    var shortChapters = ["information", "invitation", "qibla", "first_takbir", "second_takbir", "third_takbir", "fourth_takbir", "salam", "closing"];
    var fullOnly = ["legal", "evidence"];
    presentation.presetMode = preset;
    (presentation.sequence && presentation.sequence.scenes || []).forEach(function (row) {
      if (preset === "short") { row.isEnabled = shortChapters.indexOf(row.chapterKey) >= 0 && (!row.isOptional || row.sceneKey === "salam-left"); }
      else if (preset === "standard") { row.isEnabled = fullOnly.indexOf(row.chapterKey) < 0 && row.sceneType !== "evidence" && row.sceneKey !== "post-prayer-dua"; }
      else if (preset === "full") { row.isEnabled = row.sceneKey !== "post-prayer-dua"; }
    });
    return presentation;
  }
  function distributedDurations(rows, targetSeconds) {
    var allocations = {}, remainingRows = rows.slice(), minimumTotal = 0, maximumTotal = 0;
    rows.forEach(function (row) { var minimum = number(row.minimumDuration, 3), maximum = Math.max(minimum, number(row.maximumDuration, 120)); allocations[row.sceneKey] = minimum; minimumTotal += minimum; maximumTotal += maximum; });
    var remaining = clamp(number(targetSeconds, minimumTotal), minimumTotal, maximumTotal) - minimumTotal, guard = 0;
    while (remaining > .001 && remainingRows.length && guard < 20) {
      guard += 1;
      var weightTotal = remainingRows.reduce(function (sum, row) { return sum + Math.max(.01, number(row.weight, 1)); }, 0), distributed = 0, nextRows = [];
      remainingRows.forEach(function (row) { var maximum = Math.max(number(row.minimumDuration, 3), number(row.maximumDuration, 120)), capacity = maximum - allocations[row.sceneKey], share = remaining * Math.max(.01, number(row.weight, 1)) / weightTotal, addition = Math.min(capacity, share); allocations[row.sceneKey] += addition; distributed += addition; if (capacity - addition > .001) { nextRows.push(row); } });
      if (distributed <= .001) { break; }
      remaining -= distributed; remainingRows = nextRows;
    }
    Object.keys(allocations).forEach(function (key) { allocations[key] = Math.round(allocations[key] * 100) / 100; });
    return allocations;
  }
  function sceneVisible(value, row) { var options = value.contentOptions || {}, evidence = row.sceneType === "evidence" || row.chapterKey === "evidence", verifiedReference = row.reference && row.reference.verificationStatus === "verified"; if (!row.isEnabled) { return false; } if (row.chapterKey === "legal" && (options.showLaw === false || !verifiedReference)) { return false; } if (evidence && (options.showEvidence === false || !verifiedReference)) { return false; } return true; }
  function chapterDurationMap(value) {
    var targets = value.sequence.settings && value.sequence.settings.chapterDurations || {}, groups = {}, result = {};
    value.sequence.scenes.filter(function (row) { return sceneVisible(value, row); }).forEach(function (row) { (groups[row.chapterKey] = groups[row.chapterKey] || []).push(row); });
    Object.keys(groups).forEach(function (chapterKey) { var target = number(targets[chapterKey], 0); if (target > 0) { Object.assign(result, distributedDurations(groups[chapterKey], target)); } });
    return result;
  }
  function timeline(presentation, event) {
    var value = normalize(presentation, event), elapsed = 0, rows = [], chapterDurations = chapterDurationMap(value);
    value.sequence.scenes.filter(function (row) { return sceneVisible(value, row); }).forEach(function (row) {
      var duration = chapterDurations[row.sceneKey] === undefined ? effectiveDuration(row, event, value.autoAdjustDuration) : chapterDurations[row.sceneKey];
      rows.push({ scene: row, startSeconds: elapsed, endSeconds: elapsed + duration, durationSeconds: duration });
      elapsed += duration;
    });
    return { rows: rows, totalSeconds: elapsed };
  }
  function chapterSummary(presentation, event) {
    var value = normalize(presentation, event), result = {}, targets = value.sequence.settings.chapterDurations || {};
    timeline(value, event).rows.forEach(function (row) { var key = row.scene.chapterKey; if (!result[key]) { result[key] = { chapterKey: key, title: key.replace(/_/g, " "), sceneCount: 0, durationSeconds: 0, targetSeconds: number(targets[key], 0) || null }; } result[key].sceneCount += 1; result[key].durationSeconds += row.durationSeconds; });
    return Object.keys(result).map(function (key) { result[key].durationSeconds = Math.round(result[key].durationSeconds * 100) / 100; return result[key]; });
  }
  function setChapterDuration(presentation, chapterKey, seconds) {
    presentation.sequence = presentation.sequence || {}; presentation.sequence.settings = presentation.sequence.settings || {}; presentation.sequence.settings.chapterDurations = presentation.sequence.settings.chapterDurations || {};
    if (number(seconds, 0) > 0) { presentation.sequence.settings.chapterDurations[chapterKey] = number(seconds, 0); } else { delete presentation.sequence.settings.chapterDurations[chapterKey]; }
    presentation.presetMode = "custom"; return presentation;
  }
  function optimize(presentation, event) {
    var value = normalize(presentation, event), maximum = number(value.maximumDurationSeconds, 0), result = timeline(value, event);
    if (!maximum || result.totalSeconds <= maximum || value.overflowPolicy === "extend_duration") { return value; }
    if (value.overflowPolicy === "short_mode") { applyPreset(value, "short"); return normalize(value, event); }
    value.sequence.scenes.slice().reverse().forEach(function (row) {
      if (result.totalSeconds > maximum && row.isEnabled && row.isOptional) { row.isEnabled = false; result = timeline(value, event); }
    });
    if (value.overflowPolicy === "reduce_optional") { return normalize(value, event); }
    if (result.totalSeconds > maximum) {
      var scale = maximum / result.totalSeconds;
      Object.keys(value.sequence.settings.chapterDurations || {}).forEach(function (chapterKey) { value.sequence.settings.chapterDurations[chapterKey] = Math.max(1, number(value.sequence.settings.chapterDurations[chapterKey], 1) * scale); });
      value.sequence.scenes.filter(function (row) { return row.isEnabled && row.durationMode !== "manual"; }).forEach(function (row) {
        row.durationSeconds = clamp(effectiveDuration(row, event, value.autoAdjustDuration) * scale, number(row.minimumDuration, 3), number(row.maximumDuration, 120));
        row.durationMode = "manual";
      });
    }
    return normalize(value, event);
  }

  window.FuneralPresentationModel = {
    buildDefault: buildDefault, normalize: normalize, applyPreset: applyPreset, timeline: timeline, optimize: optimize,
    selectedContent: selectedContent, effectiveDuration: effectiveDuration, replaceTokens: replaceTokens,
    chapterSummary: chapterSummary, setChapterDuration: setChapterDuration,
    defaultPrayerRules: defaultPrayerRules, defaultPersistentFields: DEFAULT_FIELDS.slice(), prayers: PRAYERS.slice()
  };
})(window);
