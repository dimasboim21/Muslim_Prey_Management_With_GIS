(function () {
  "use strict";

  var API = "api/islamic-automation.php";
  var IMPORT_API = "api/islamic-tafsir-import.php";
  var state = {
    tafsir: null,
    tafsirAdmin: [],
    hadith: null,
    hadithSources: [],
    claims: [],
    reviews: [],
    executionEnabled: false,
    tafsirLoaded: false,
    hadithLoaded: false
  };

  function byId(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }
  function number(value) { return Number(value || 0).toLocaleString("id-ID"); }
  function percent(value) {
    return Math.max(0, Math.min(100, Number(value || 0))).toLocaleString("id-ID", { maximumFractionDigits: 3 }) + "%";
  }
  function date(value) {
    if (!value) return "—";
    var raw = String(value);
    var parsed = new Date(raw.replace(" ", "T") + (raw.indexOf("Z") < 0 ? "Z" : ""));
    return isNaN(parsed.getTime()) ? raw : parsed.toLocaleString("id-ID");
  }
  function statusKind(value) {
    value = String(value || "").toUpperCase();
    if (/COMPLETE|APPROVED|VERIFIED|SAHIH|HASAN|PUBLISHED|ARCHIVED|FOUND/.test(value)) return "good";
    if (/BLOCK|REJECT|FAILED|MAWDU|NOT_A_HADITH/.test(value)) return "bad";
    if (/PARTIAL|PENDING|REVIEW|INVESTIGATION|POSSIBLE|CONFLICT|DAIF|WEAK|MISSING|NO_HADITH/.test(value)) return "warn";
    return "neutral";
  }
  function badge(value) { return `<span class="it-badge ${statusKind(value)}">${esc(value || "—")}</span>`; }
  function metric(label, value, detail) {
    return `<article class="it-auto-metric"><span>${esc(label)}</span><strong>${esc(value == null ? 0 : value)}</strong><small>${esc(detail || "")}</small></article>`;
  }
  function toast(message, isError) {
    var node = byId("islamicTextToast");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("error", Boolean(isError));
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { node.classList.remove("show"); }, 5000);
  }
  function headers(json) {
    var output = {};
    var token = byId("islamicAdminToken");
    if (json) output["Content-Type"] = "application/json";
    if (token && token.value.trim()) output["X-Admin-Token"] = token.value.trim();
    return output;
  }
  async function get(resource, query) {
    var url = new URL(API, location.href);
    url.searchParams.set("resource", resource);
    Object.keys(query || {}).forEach(function (key) {
      if (query[key] !== "" && query[key] != null) url.searchParams.set(key, query[key]);
    });
    var response = await fetch(url, { headers: headers(false), cache: "no-store" });
    var payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || "Request gagal.");
    return payload.data;
  }
  async function post(action, body) {
    var response = await fetch(API, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify(Object.assign({ action: action, actorId: localStorage.getItem("mpm:admin-actor") || "local-admin" }, body || {}))
    });
    var payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || "Operasi gagal.");
    return payload.data;
  }
  function requireExecutionConfirmation() {
    if (!state.executionEnabled) throw new Error("Automation sedang nonaktif. Aktifkan toggle global dan konfirmasikan terlebih dahulu.");
    var accepted = window.confirm("Jalankan proses automation ini sekarang?\n\nProses dapat memakai jaringan, CPU, disk, OCR, atau translation. Konfirmasi manual akan dicatat pada audit log.");
    if (!accepted) throw new Error("Operasi dibatalkan pengguna.");
    return "CONFIRM_MANUAL_AUTOMATION";
  }
  function applyExecutionControl() {
    document.querySelectorAll("[data-corpus-execution='manual']").forEach(function (button) {
      button.disabled = !state.executionEnabled;
      button.title = state.executionEnabled ? "Konfirmasi manual akan diminta" : "Aktifkan toggle Automation terlebih dahulu";
    });
  }
  async function manual(action, body, success) {
    var confirmation = requireExecutionConfirmation();
    var result = await post(action, Object.assign({ confirmation: confirmation }, body || {}));
    toast(success || "Operasi selesai.");
    return result;
  }

  function coverageFor(work, language, kind) {
    return (work.coverage || []).find(function (row) {
      return row.language === language && row.coverageKind === kind;
    }) || {
      language: language,
      coverageKind: kind,
      coveragePercent: 0,
      reviewedPercent: 0,
      availabilityStatus: "MISSING",
      pipelineStatus: "SOURCE_SEARCHING",
      availablePassages: 0,
      expectedPassages: work.expectedAyahCount || 6236,
      sourceSummary: []
    };
  }
  function progressRow(label, row) {
    var width = Math.max(0, Math.min(100, Number(row.coveragePercent || 0)));
    return `<div class="it-corpus-progress">
      <div><strong>${esc(label)}</strong><span>${badge(row.availabilityStatus)} ${number(row.availablePassages)}/${number(row.expectedPassages)}</span></div>
      <div class="it-corpus-progress-track"><span style="width:${width}%"></span></div>
      <small>${percent(row.coveragePercent)} · ${esc(row.pipelineStatus || "—")}${Number(row.reviewedPercent || 0) ? ` · reviewed ${percent(row.reviewedPercent)}` : ""}</small>
    </div>`;
  }
  async function loadTafsir() {
    byId("tafsirCorpusState").textContent = "Memuat registry dan coverage aktual…";
    var results = await Promise.all([get("tafsir_corpus_dashboard"), get("tafsir_registry_admin")]);
    state.tafsir = results[0];
    state.tafsirAdmin = results[1];
    state.tafsirLoaded = true;
    renderTafsir();
  }
  function updateAuthor() {
    var option = byId("tafsirLocalWork").selectedOptions[0];
    byId("tafsirLocalAuthor").value = option ? (option.dataset.author || "") : "";
  }
  function renderTafsir() {
    var data = state.tafsir || {};
    var summary = data.summary || {};
    var policy = data.policy || {};
    byId("tafsirCorpusState").innerHTML = `Mode ${badge(policy.mode)} · ${number(policy.approvedWorkCount)} kitab approved · free discovery ${badge(policy.freeDiscoveryAllowed ? "ALLOWED" : "BLOCKED")} · encryption-at-rest ${badge(policy.storage && policy.storage.encryptionAtRestAvailable ? "AVAILABLE" : "NOT AVAILABLE")}`;
    byId("tafsirCorpusMetrics").innerHTML =
      metric("Kitab approved", summary.registeredWorks, "registry terkurasi") +
      metric("Arabic complete", summary.completeArabic, "dari 7 kitab") +
      metric("English complete", summary.completeEnglish, "human corpus") +
      metric("Human ID tersedia", summary.humanIndonesianAvailable, "preferred bila licensed") +
      metric("Rata-rata Auto ID", percent(summary.averageAutoIndonesian), "history tetap disimpan") +
      metric("Counterpart human", (data.translationCounterparts || {}).total, "dapat dibandingkan");

    byId("tafsirRegistryAdminList").innerHTML = state.tafsirAdmin.length ? state.tafsirAdmin.map(function (work) {
      var action = work.registryStatus !== "APPROVED"
        ? `<button class="it-button small primary" data-tafsir-approval="${work.workId}" data-approved="1" type="button">Approve</button>`
        : `<button class="it-button small danger" data-tafsir-approval="${work.workId}" data-approved="0" type="button">Disable</button>`;
      return `<article class="it-stack-item"><div><strong>${esc(work.title)} · ${esc(work.author)}</strong><p>${badge(work.registryStatus)} · ${esc(work.workKey)}</p></div><div>${action}</div></article>`;
    }).join("") : '<div class="it-empty">Registry admin belum tersedia.</div>';

    var works = data.works || [];
    byId("tafsirCorpusWorks").innerHTML = works.length ? works.map(function (work) {
      var ar = coverageFor(work, "ar", "ORIGINAL");
      var en = coverageFor(work, "en", "HUMAN_TRANSLATION");
      var human = coverageFor(work, "id", "HUMAN_TRANSLATION");
      var auto = coverageFor(work, "id", "AUTO_SYSTEM_TRANSLATE");
      var sources = [].concat(ar.sourceSummary || [], en.sourceSummary || [], human.sourceSummary || []).slice(0, 4);
      var sourceHtml = sources.length ? `<details><summary>${number(work.sourceCount)} source · ${number(work.documentCount)} document</summary><ul class="it-compact-list">${sources.map(function (source) {
        return `<li>${esc(source.title)} · ${badge(source.format || source.sourceType)} · ${badge(source.licenseStatus)}${source.sourcePageUrl ? ` · <a href="${esc(source.sourcePageUrl)}" target="_blank" rel="noopener">source</a>` : ""}</li>`;
      }).join("")}</ul></details>` : '<p class="it-help">Source belum ditemukan; nilai tidak dibuat-buat.</p>';
      return `<article class="it-corpus-work-card">
        <header><div><p class="it-eyebrow">${esc(work.author || "Mufassir belum dicatat")}</p><h3>${esc(work.title)}</h3></div>${badge(work.registryStatus)}</header>
        ${progressRow("Arabic", ar)}${progressRow("English", en)}${progressRow("Indonesian Human", human)}${progressRow("Auto-System ID", auto)}
        <div class="it-corpus-progress"><div><strong>OCR</strong><span>${number(work.ocrCompleted)}/${number(work.ocrRequired)}</span></div><div class="it-corpus-progress-track"><span style="width:${Math.max(0, Math.min(100, Number(work.ocrPercent || 0)))}%"></span></div><small>${percent(work.ocrPercent)}</small></div>
        ${sourceHtml}
        <div class="it-source-actions"><button class="it-button small" data-tafsir-discover="${work.workId}" data-corpus-execution="manual" type="button">Cari source terdaftar</button></div>
      </article>`;
    }).join("") : '<div class="it-empty">Registry Tafsir terkurasi belum tersedia.</div>';

    var select = byId("tafsirLocalWork");
    var current = select.value;
    select.innerHTML = '<option value="">Pilih kitab</option>' + works.map(function (work) {
      return `<option value="${work.workId}" data-author="${esc(work.author || "")}">${esc(work.title)} — ${esc(work.author || "")}</option>`;
    }).join("");
    if (current) select.value = current;
    updateAuthor();

    var imports = data.localImports || [];
    byId("tafsirLocalImportList").innerHTML = imports.length ? imports.map(function (item) {
      return `<article class="it-stack-item"><div><strong>${esc(item.workTitle)} · ${esc(item.originalFilename)}</strong><p>${badge("LOCAL_IMPORT")} ${badge(item.licenseStatus)} ${badge(item.jobStatus || item.status)}</p><small>${number(item.fileSize)} bytes · checksum ${esc(String(item.checksum || "").slice(0, 20))}… · ${date(item.importedAt)}</small></div></article>`;
    }).join("") : '<div class="it-empty">Belum ada local Tafsir import.</div>';
    applyExecutionControl();
  }

  async function loadHadith() {
    byId("hadithDiscoveryState").textContent = "Memuat circulating claims, attempts, dan review inbox…";
    var status = byId("hadithClaimStatusFilter").value;
    var category = byId("hadithReviewCategory").value;
    var results = await Promise.all([
      get("hadith_discovery_dashboard"),
      get("hadith_claims", { limit: 100, status: status }),
      get("hadith_discovery_reviews", { limit: 100, category: category }),
      get("hadith_discovery_sources")
    ]);
    state.hadith = results[0];
    state.claims = results[1];
    state.reviews = results[2];
    state.hadithSources = results[3];
    state.hadithLoaded = true;
    renderHadith();
  }
  function renderHadith() {
    var data = state.hadith || {};
    var summary = data.summary || {};
    var matches = data.matches || {};
    byId("hadithDiscoveryState").innerHTML = `Mode ${badge((data.policy || {}).mode)} · AI authenticity decision ${badge((data.policy || {}).aiAuthenticityDecisionAllowed ? "ALLOWED" : "PROHIBITED")} · search terakhir ${esc(date(summary.lastOnlineSearch))} · berikutnya ${esc(date(summary.nextSearch))}`;
    byId("hadithDiscoveryMetrics").innerHTML =
      metric("Circulating claims", summary.total, "entitas terpisah") +
      metric("Under investigation", summary.underInvestigation, "recheck berkala") +
      metric("Possible matches", matches.possibleMatches, "wajib review") +
      metric("No source found", summary.noSourceFound, "bukan otomatis palsu") +
      metric("Weak reports", summary.weakReports, "grading reviewed") +
      metric("Fabricated reports", summary.fabricatedReports, "provenance wajib") +
      metric("Conflicting grading", summary.conflictingGradings, "semua grading dipertahankan") +
      metric("Related narration", matches.relatedNarrations, "record tidak dihapus");

    byId("hadithDiscoverySourceList").innerHTML = state.hadithSources.length ? state.hadithSources.map(function (source) {
      return `<article class="it-source-card"><div><p class="it-eyebrow">Tier ${number(source.sourceTier)} · ${esc(source.sourceRole)}</p><h3>${esc(source.name)}</h3></div><p>${badge(source.enabled ? "ENABLED" : "DISABLED")} ${badge(source.authenticityEvidenceAllowed ? "EVIDENCE_ALLOWED" : "DISCOVERY_ONLY")}</p><p class="it-help">${esc(source.queryUrlTemplate || "Query template belum dikonfigurasi; tidak ada guessed scraping.")}</p><div class="it-source-actions"><button class="it-button small" data-hadith-source-config="${source.id}" type="button">Configure</button></div></article>`;
    }).join("") : '<div class="it-empty">Belum ada discovery source.</div>';

    byId("hadithClaimList").innerHTML = state.claims.length ? state.claims.map(function (claim) {
      return `<article class="it-discovery-claim">
        <header><div><p class="it-eyebrow">${esc(claim.claimType)} · ${esc(claim.language)}</p><h3>Claim #${number(claim.id)}</h3></div>${badge(claim.status)}</header>
        <blockquote>${esc(claim.circulatingText)}</blockquote>
        <div class="it-discovery-meta"><span>First seen ${esc(date(claim.firstSeen))}</span><span>Last search ${esc(date(claim.lastSearch))}</span><span>Next ${esc(date(claim.nextSearch))}</span></div>
        <p>${number(claim.searchAttempts)} attempts · ${number(claim.possibleMatches)} possible matches · ${number(claim.verifiedGradings)} verified gradings</p>
        <div class="it-source-actions"><button class="it-button small" data-hadith-detail="${claim.id}" type="button">Detail, match &amp; grading</button><button class="it-button small" data-hadith-search="${claim.id}" data-corpus-execution="manual" type="button">Search sekarang</button></div>
      </article>`;
    }).join("") : '<div class="it-empty">Belum ada circulating claim pada filter ini.</div>';

    byId("hadithDiscoveryReviewList").innerHTML = state.reviews.length ? state.reviews.slice(0, 20).map(function (review) {
      return `<article class="it-stack-item"><div><strong>${esc(review.title)}</strong><p>${badge(review.category)} ${badge(review.riskLevel)}</p><small>Claim #${number(review.claimId)} · ${esc(review.reason)}</small></div><button class="it-button small" data-hadith-detail="${review.claimId}" type="button">Review</button></article>`;
    }).join("") : '<div class="it-empty">Tidak ada item review pada filter ini.</div>';
    applyExecutionControl();
  }

  async function openHadithDetail(claimId) {
    var data = await get("hadith_claim", { claim_id: claimId });
    var claim = data.claim || {};
    var variants = data.variants || [];
    var findings = data.findings || [];
    var matches = data.matches || [];
    var gradings = data.gradings || [];
    var attempts = data.searchAttempts || [];
    var history = data.history || [];
    var findingsHtml = findings.length ? findings.map(function (finding) {
      return `<article class="it-stack-item"><div><strong>${esc(finding.sourceName)} · ${badge(finding.findingType)}</strong><p><a href="${esc(finding.resultUrl)}" target="_blank" rel="noopener">${esc(finding.resultTitle || finding.resultUrl)}</a></p><small>Tier ${number(finding.sourceTier)} · ${esc(finding.sourceRole)} · ${badge(finding.authenticityEvidenceAllowed ? "EVIDENCE_ALLOWED" : "DISCOVERY_ONLY")} · ${badge(finding.reviewStatus)}</small></div></article>`;
    }).join("") : '<div class="it-empty">Belum ada online finding dari source yang dikonfigurasi.</div>';
    var matchesHtml = matches.length ? matches.map(function (match) {
      return `<article class="it-auto-card"><header><strong>${esc(match.collectionKey || "Hadith Record")} ${esc(match.hadithNumber || "")}</strong>${badge(match.status)}</header><p><strong>Similarity:</strong> ${percent(Number(match.similarityScore || 0) * 100)} · ${esc(match.matchMethod)}</p><p dir="rtl" lang="ar">${esc(match.arabicText || "Teks Arab tidak tersedia")}</p><p>${esc(match.englishText || "Translation tidak tersedia")}</p><div class="it-source-actions"><button class="it-button small primary" data-hadith-match="${match.id}" data-decision="CONFIRM_MATCH">Confirm source</button><button class="it-button small" data-hadith-match="${match.id}" data-decision="RELATED_ONLY">Related only</button><button class="it-button small danger" data-hadith-match="${match.id}" data-decision="REJECT_MATCH">Reject match</button></div></article>`;
    }).join("") : '<div class="it-empty">Belum ada possible match.</div>';
    var gradingsHtml = gradings.length ? gradings.map(function (grading) {
      var actions = grading.verificationStatus === "NEEDS_REVIEW" ? `<div><button class="it-button small primary" data-grading-review="${grading.id}" data-decision="APPROVE">Approve provenance</button><button class="it-button small danger" data-grading-review="${grading.id}" data-decision="REJECT">Reject</button></div>` : "";
      return `<article class="it-stack-item"><div><strong>${esc(grading.grader)} · ${badge(grading.grade)}</strong><p>${esc(grading.workTitle)} · ${esc(grading.referenceText)}</p><small><a href="${esc(grading.sourceUrl)}" target="_blank" rel="noopener">Source traceable</a> · ${badge(grading.verificationStatus)}</small></div>${actions}</article>`;
    }).join("") : '<div class="it-empty">Belum ada grading source.</div>';
    var attemptRows = attempts.map(function (attempt) {
      return `<tr><td>${esc(date(attempt.searchedAt))}</td><td>${esc(attempt.queryType)}</td><td>${esc(attempt.databaseSearched)}</td><td>${number(attempt.resultCount)}</td><td>${badge(attempt.status)}</td></tr>`;
    }).join("");
    var historyHtml = history.map(function (event) {
      return `<article class="it-stack-item"><div><strong>${esc(event.eventType)}</strong><p>${esc(event.previousStatus || "—")} → ${esc(event.newStatus || "—")}</p><small>${esc(date(event.createdAt))} · ${esc(event.actorId || event.actorType)}</small></div></article>`;
    }).join("");
    var variantsHtml = variants.length ? variants.map(function (variant) {
      return `<article class="it-stack-item"><div><strong>${esc(variant.language)} · ${badge(variant.variantType)}</strong><p>${esc(variant.variantText)}</p><small>${variant.sourceUrl ? `<a href="${esc(variant.sourceUrl)}" target="_blank" rel="noopener">source</a>` : "No source URL"} · ${esc(date(variant.firstSeen))}</small></div></article>`;
    }).join("") : '<div class="it-empty">Belum ada circulating variant.</div>';
    var html = `<div class="it-panel-title"><p class="it-eyebrow">Circulating claim #${number(claim.id)}</p><h2>${esc(claim.status)}</h2></div>
      <div class="it-notice warning">Claim tetap terpisah dari canonical Hadith Record. Similarity dan query translation hanya alat pencarian.</div>
      <blockquote class="it-discovery-quote">${esc(claim.circulatingText)}</blockquote>
      <div class="it-source-actions"><button class="it-button small" data-hadith-claim-decision="KEEP_INVESTIGATING" data-claim-id="${claim.id}">Keep investigating</button><button class="it-button small" data-hadith-claim-decision="MARK_MISATTRIBUTED" data-claim-id="${claim.id}">Mark misattributed</button><button class="it-button small danger" data-hadith-claim-decision="MARK_NOT_HADITH" data-claim-id="${claim.id}">Mark not Hadith</button></div>
      <h3>Circulating variants</h3>${variantsHtml}
      <form id="hadithVariantForm" class="it-auto-form it-operation-card"><input name="claimId" type="hidden" value="${claim.id}"><label class="it-form-wide">Variant text<textarea name="variantText" rows="2" required></textarea></label><label>Language<select name="language"><option value="id">Indonesia</option><option value="ar">Arabic</option><option value="en">English</option><option value="und">Unknown</option></select></label><label>Type<select name="variantType"><option>CIRCULATING_VARIANT</option><option>FABRICATED_REPORT_VARIANT</option><option>SEARCH_QUERY_TRANSLATION</option></select></label><label class="it-form-wide">Source URL<input name="sourceUrl" type="url"></label><button class="it-button" type="submit">Simpan variant terpisah</button></form>
      <h3>Online findings</h3>${findingsHtml}
      <h3>Possible / reviewed matches</h3>${matchesHtml}
      <h3>Grading per ulama/source</h3>${gradingsHtml}
      <form id="hadithGradingForm" class="it-auto-form it-operation-card">
        <h3 class="it-form-wide">Tambah grading source traceable</h3><input name="claimId" type="hidden" value="${claim.id}">
        <label>Grader<input name="grader" required></label><label>Grade<select name="grade"><option>SAHIH</option><option>HASAN</option><option>DAIF</option><option>VERY_WEAK</option><option>MAWDU</option></select></label>
        <label>Work / kitab<input name="workTitle" required></label><label>Reference<input name="reference" required></label><label class="it-form-wide">Source URL<input name="sourceUrl" type="url" required></label>
        <label>Source tier<input name="sourceTier" type="number" min="1" max="8" value="6"></label><label class="it-form-wide">Quotation (opsional)<textarea name="quotationText" rows="2"></textarea></label>
        <button class="it-button primary" type="submit">Tambah ke review, jangan terapkan dulu</button>
      </form>
      <details><summary>${number(attempts.length)} search attempts</summary><div class="it-auto-table"><table><thead><tr><th>Waktu</th><th>Metode</th><th>Database</th><th>Hasil</th><th>Status</th></tr></thead><tbody>${attemptRows}</tbody></table></div></details>
      <details><summary>Investigation history (${number(history.length)})</summary><div class="it-stack">${historyHtml}</div></details>`;
    byId("automationDetailContent").innerHTML = html;
    byId("automationDetailDialog").showModal();
  }

  function catchToast(error) {
    if (error && error.message !== "Operasi dibatalkan pengguna.") toast(error.message, true);
  }
  function bindDelegatedActions() {
    document.addEventListener("click", function (event) {
      // `data-hadith-detail` is also used by the canonical Hadith reader.
      // Only numeric circulating-claim controls inside this module belong to
      // the discovery API; otherwise both readers would handle one click.
      var detail = event.target.closest("#hadithClaimList [data-hadith-detail],#hadithDiscoveryReviewList [data-hadith-detail]");
      if (detail) { openHadithDetail(Number(detail.dataset.hadithDetail)).catch(catchToast); return; }
      var approval = event.target.closest("[data-tafsir-approval]");
      if (approval) {
        var approved = approval.dataset.approved === "1";
        if (!window.confirm((approved ? "Approve" : "Disable") + " kitab ini pada registry Tafsir? Automation hanya akan mencari source setelah status APPROVED.")) return;
        post("set_tafsir_registry_approval", { workId: Number(approval.dataset.tafsirApproval), approved: approved, confirmation: approved ? "APPROVE_TAFSIR_REGISTRY" : "DISABLE_TAFSIR_REGISTRY" }).then(loadTafsir).catch(catchToast);
        return;
      }
      var sourceButton = event.target.closest("[data-hadith-source-config]");
      if (sourceButton) {
        var source = state.hadithSources.find(function (item) { return Number(item.id) === Number(sourceButton.dataset.hadithSourceConfig); });
        if (!source) return;
        var template = window.prompt("HTTPS JSON search URL template. Wajib memuat {query}; {language} opsional:", source.queryUrlTemplate || "");
        if (template == null) return;
        var tier = window.prompt("Source tier 1-8:", source.sourceTier || 8);
        if (tier == null) return;
        var role = window.prompt("Role source:", source.sourceRole || "DISCOVERY_LEAD");
        if (role == null) return;
        var enabled = window.confirm("Aktifkan source ini? Worker tetap mengikuti toggle global Automation.");
        post("save_hadith_discovery_source", { sourceId: source.id, source: { queryUrlTemplate: template, sourceTier: Number(tier), sourceRole: role, adapterKey: "generic-json-search-v1", enabled: enabled, authenticityEvidenceAllowed: Number(tier) <= 6 && !/GENERAL_WEBSITE|DISCOVERY_LEAD/.test(role), confirmation: "CONFIGURE_HADITH_DISCOVERY_SOURCE" } }).then(loadHadith).catch(catchToast);
        return;
      }
      var discover = event.target.closest("[data-tafsir-discover]");
      if (discover) { manual("run_tafsir_source_discovery", { workId: Number(discover.dataset.tafsirDiscover), limit: 10 }, "Discovery hanya mendaftarkan kandidat untuk kitab approved.").then(loadTafsir).catch(catchToast); return; }
      var search = event.target.closest("[data-hadith-search]");
      if (search) { manual("run_hadith_discovery", { claimId: Number(search.dataset.hadithSearch) }, "Search attempts dan candidate tersimpan.").then(loadHadith).catch(catchToast); return; }
      var match = event.target.closest("[data-hadith-match]");
      if (match) { post("review_hadith_match", { matchId: Number(match.dataset.hadithMatch), decision: match.dataset.decision, notes: "Reviewed from Hadith Discovery UI" }).then(function (result) { toast("Match: " + result.matchStatus + "; tidak ada record yang dihapus."); return openHadithDetail(result.claimId); }).then(loadHadith).catch(catchToast); return; }
      var grading = event.target.closest("[data-grading-review]");
      if (grading) { post("review_hadith_grading", { gradingId: Number(grading.dataset.gradingReview), decision: grading.dataset.decision, notes: "Provenance reviewed from UI" }).then(function (result) { toast("Grading " + result.verificationStatus + "; claim " + result.claimStatus); return openHadithDetail(result.claimId); }).then(loadHadith).catch(catchToast); return; }
      var claimDecision = event.target.closest("[data-hadith-claim-decision]");
      if (claimDecision) { post("review_hadith_claim", { claimId: Number(claimDecision.dataset.claimId), decision: claimDecision.dataset.hadithClaimDecision, notes: "Human decision from UI" }).then(function (result) { toast("Claim status: " + result.status); return openHadithDetail(result.claimId); }).then(loadHadith).catch(catchToast); }
    });
    document.addEventListener("submit", function (event) {
      if (event.target.id === "hadithVariantForm") {
        event.preventDefault();
        var variantForm = new FormData(event.target);
        var variant = {};
        variantForm.forEach(function (value, key) { if (key !== "claimId") variant[key] = value; });
        var variantClaimId = Number(variantForm.get("claimId"));
        post("add_hadith_claim_variant", { claimId: variantClaimId, variant: variant }).then(function () { toast("Variant tersimpan tanpa mengubah canonical Hadith Record."); return openHadithDetail(variantClaimId); }).then(loadHadith).catch(catchToast);
        return;
      }
      if (event.target.id !== "hadithGradingForm") return;
      event.preventDefault();
      var form = new FormData(event.target);
      var grading = {};
      form.forEach(function (value, key) { if (key !== "claimId") grading[key] = value; });
      var claimId = Number(form.get("claimId"));
      post("add_hadith_grading", { claimId: claimId, grading: grading }).then(function () { toast("Grading source ditambahkan sebagai NEEDS_REVIEW."); return openHadithDetail(claimId); }).then(loadHadith).catch(catchToast);
    });
  }

  function bind() {
    document.querySelectorAll("[data-auto-view]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.dataset.autoView === "tafsir-corpus" && !state.tafsirLoaded) loadTafsir().catch(catchToast);
        if (button.dataset.autoView === "hadith-discovery" && !state.hadithLoaded) loadHadith().catch(catchToast);
      });
    });
    byId("tafsirCorpusReloadButton").addEventListener("click", function () { loadTafsir().catch(catchToast); });
    byId("tafsirCoverageRefreshButton").addEventListener("click", function () { manual("refresh_tafsir_coverage", {}, "Coverage Tafsir dihitung dari record aktual.").then(loadTafsir).catch(catchToast); });
    byId("tafsirLocalWork").addEventListener("change", updateAuthor);
    byId("tafsirRegistryForm").addEventListener("submit", function (event) {
      event.preventDefault();
      post("register_tafsir_work", { work: { workKey: byId("tafsirRegistryKey").value, title: byId("tafsirRegistryTitle").value, author: byId("tafsirRegistryAuthor").value } }).then(function () { event.target.reset(); toast("Kitab ditambahkan sebagai PENDING_APPROVAL; discovery tetap nonaktif."); return loadTafsir(); }).catch(catchToast);
    });
    byId("tafsirLocalImportForm").addEventListener("submit", async function (event) {
      event.preventDefault();
      var button = byId("tafsirLocalImportButton");
      try {
        var confirmation = requireExecutionConfirmation();
        var form = new FormData(event.currentTarget);
        form.append("confirmation", confirmation);
        form.append("actorId", localStorage.getItem("mpm:admin-actor") || "local-admin");
        button.disabled = true;
        byId("tafsirLocalImportState").textContent = "Uploading dan menghitung checksum…";
        var response = await fetch(IMPORT_API, { method: "POST", headers: headers(false), body: form });
        var payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || "Import gagal.");
        byId("tafsirLocalImportState").textContent = "Archived · pipeline job #" + payload.data.jobId;
        event.currentTarget.reset();
        toast("Local Tafsir archived dan masuk antrean extraction/OCR.");
        await loadTafsir();
      } catch (error) {
        byId("tafsirLocalImportState").textContent = error.message;
        catchToast(error);
      } finally {
        button.disabled = !state.executionEnabled;
      }
    });
    byId("hadithDiscoveryReloadButton").addEventListener("click", function () { loadHadith().catch(catchToast); });
    byId("hadithReviewReloadButton").addEventListener("click", function () { loadHadith().catch(catchToast); });
    byId("hadithClaimStatusFilter").addEventListener("change", function () { loadHadith().catch(catchToast); });
    byId("hadithReviewCategory").addEventListener("change", function () { loadHadith().catch(catchToast); });
    byId("hadithDiscoveryRunDueButton").addEventListener("click", function () { manual("run_due_hadith_discovery", { limit: 10 }, "Claim jatuh tempo selesai diperiksa.").then(loadHadith).catch(catchToast); });
    byId("hadithClaimForm").addEventListener("submit", function (event) {
      event.preventDefault();
      post("create_hadith_claim", { claim: { circulatingText: byId("hadithClaimText").value, language: byId("hadithClaimLanguage").value, claimType: byId("hadithClaimType").value, claimedNarrator: byId("hadithClaimNarrator").value, claimedReference: byId("hadithClaimReference").value, sourceUrl: byId("hadithClaimSourceUrl").value } }).then(function () { event.target.reset(); toast("Claim disimpan terpisah dari canonical Hadith Record."); return loadHadith(); }).catch(catchToast);
    });
    bindDelegatedActions();
    var toggle = byId("autoAutomationToggle");
    state.executionEnabled = Boolean(toggle && toggle.getAttribute("aria-checked") === "true");
    applyExecutionControl();
  }

  document.addEventListener("mpm:automation-execution-change", function (event) {
    state.executionEnabled = Boolean(event.detail && event.detail.enabled);
    applyExecutionControl();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
})();
