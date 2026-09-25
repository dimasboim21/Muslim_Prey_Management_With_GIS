(function () {
  "use strict";

  var API_URL = "api/islamic-automation.php";
  var loaded = false;
  var loading = null;
  var reviewImageUrl = "";
  var state = { dashboard: null, sources: [], jobs: [], reviews: [], selectedReviewId: 0 };

  function byId(id) { return document.getElementById(id); }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]; }); }
  function number(value) { return Number(value || 0).toLocaleString("id-ID"); }
  function date(value) { if (!value) return "—"; var parsed = new Date(String(value).replace(" ", "T")); return isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("id-ID"); }
  function bytes(value) { var amount = Number(value || 0), units = ["B", "KB", "MB", "GB", "TB"], index = 0; while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; } return amount.toLocaleString("id-ID", { maximumFractionDigits: index ? 2 : 0 }) + " " + units[index]; }
  function actor() { try { return localStorage.getItem("mpm:iqro:actor-id:v1") || "admin-local"; } catch (error) { return "admin-local"; } }
  function token() { return byId("islamicAdminToken") ? byId("islamicAdminToken").value.trim() : ""; }
  function headers(write) { var result = { Accept: "application/json", "X-Actor-Id": actor() }; if (write) result["Content-Type"] = "application/json"; if (token()) result["X-Admin-Token"] = token(); return result; }
  function executionEnabled() {
    var toggle = byId("autoAutomationToggle");
    if (toggle && (toggle.dataset.enabled === "0" || toggle.dataset.enabled === "1")) return toggle.dataset.enabled === "1";
    var control = (state.dashboard || {}).executionControl || {};
    return control.enabled === true;
  }
  function gateExecutionButton(button, enabled) {
    if (!button) return;
    if (!Object.prototype.hasOwnProperty.call(button.dataset, "executionBaseDisabled")) button.dataset.executionBaseDisabled = button.disabled ? "1" : "0";
    if (!Object.prototype.hasOwnProperty.call(button.dataset, "executionBaseTitle")) button.dataset.executionBaseTitle = button.title || "";
    var baseDisabled = button.dataset.executionBaseDisabled === "1";
    button.dataset.executionDisabled = enabled ? "0" : "1";
    button.disabled = !enabled || baseDisabled;
    button.title = enabled ? button.dataset.executionBaseTitle : "Automation nonaktif; aktifkan toggle pada header terlebih dahulu.";
  }
  function applyDocumentExecutionControl() {
    var enabled = executionEnabled();
    ["autoDocumentDiscoveryButton", "autoDocumentProcessButton", "autoDocumentQueueProcessButton", "autoDocumentReclassifyButton"].forEach(function (id) { gateExecutionButton(byId(id), enabled); });
    document.querySelectorAll("[data-doc-source-check],[data-doc-source-queue]").forEach(function (button) { gateExecutionButton(button, enabled); });
    if (!enabled) setDocumentState("Automation nonaktif oleh pengguna · scheduled worker tidak menjalankan download, extraction, atau OCR · raw archive tetap aman.", "warning");
  }
  function confirmDocumentExecution(label) {
    if (!executionEnabled()) { toast("Automation masih nonaktif. Aktifkan toggle pada header terlebih dahulu.", true); return false; }
    return window.confirm(label + "\n\nProses dapat memakai jaringan atau alat eksternal tanpa membuka jendela CMD. Lanjutkan sekarang?");
  }
  function badge(value, kind) { return '<span class="it-badge ' + esc(kind || "neutral") + '">' + esc(value || "—") + "</span>"; }
  function roleLabel(value) {
    return ({ hadith: "Isi Hadis", publication_info: "Informasi penerbitan", introduction: "Pengantar", front_matter: "Bagian awal kitab", table_of_contents: "Daftar isi", bibliography: "Daftar pustaka", index: "Indeks", unknown_body: "Belum terklasifikasi", body: "Isi dokumen" })[String(value || "").toLowerCase()] || String(value || "Belum terklasifikasi");
  }
  function statusKind(value) { value = String(value || "").toUpperCase(); if (/COMPLETE|VALIDATED|VERIFIED|ARCHIVED|PRESENT|IDLE|PASSED/.test(value)) return "good"; if (/FAIL|REJECT|BLOCK|ERROR|ABSENT/.test(value)) return "bad"; if (/REVIEW|PENDING|QUEUE|PROCESS|PARTIAL|UNKNOWN|RETRY/.test(value)) return "warn"; return "neutral"; }
  function toast(message, error) { var node = byId("islamicTextToast"); if (!node) return; node.textContent = message; node.className = "it-toast show" + (error ? " error" : ""); clearTimeout(toast.timer); toast.timer = setTimeout(function () { node.className = "it-toast"; }, 6000); }
  function busy(button, active) { if (!button) return; if (active) { button.dataset.documentLabel = button.textContent; button.textContent = "Memproses…"; button.disabled = true; } else { button.textContent = button.dataset.documentLabel || button.textContent; button.disabled = false; } }
  function cacheKey(resource, query) { return "mpm:islamic-documents:" + resource + ":" + new URLSearchParams(query || {}).toString(); }

  async function get(resource, query) {
    var params = Object.assign({ resource: resource }, query || {}), key = cacheKey(resource, query), response, payload;
    try {
      response = await fetch(API_URL + "?" + new URLSearchParams(params), { headers: headers(false), cache: "no-store" });
      payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Permintaan document ingestion gagal.");
      try { localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), data: payload.data })); } catch (cacheError) {}
      return payload.data;
    } catch (error) {
      try {
        var cached = JSON.parse(localStorage.getItem(key) || "null");
        if (cached && cached.data) { setDocumentState("Cached · snapshot " + date(cached.savedAt), "warning"); return cached.data; }
      } catch (cacheReadError) {}
      throw error;
    }
  }

  async function post(action, body) {
    var response = await fetch(API_URL, { method: "POST", headers: headers(true), body: JSON.stringify(Object.assign({ action: action, actorId: actor(), clientRequestId: "document-" + Date.now() + "-" + Math.random().toString(16).slice(2) }, body || {})) });
    var payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || "Operasi document ingestion gagal.");
    return payload.data;
  }

  function setDocumentState(message, kind) {
    var node = byId("autoDocumentState");
    if (!node) return;
    node.className = "it-notice" + (kind === "error" ? " error" : kind === "warning" ? " warning" : "");
    node.textContent = message;
  }

  function metric(label, value, note) { return '<article class="it-auto-metric"><span>' + esc(label) + '</span><strong>' + number(value) + '</strong><small>' + esc(note || "") + "</small></article>"; }
  function storageMetric(label, value) { return '<article><span>' + esc(label) + '</span><strong>' + esc(bytes(value)) + "</strong></article>"; }

  async function loadAll(force) {
    if (loading && !force) return loading;
    loading = Promise.all([
      get("document_dashboard"),
      get("document_sources"),
      get("document_jobs", { limit: 150 }),
      get("document_reviews", { limit: Number((byId("autoDocumentReviewLimit") || {}).value || 50), type: (byId("autoDocumentReviewType") || {}).value || "" })
    ]).then(function (results) {
      state.dashboard = results[0]; state.sources = results[1] || []; state.jobs = results[2] || []; state.reviews = results[3] || [];
      renderAll(); loaded = true; return state;
    }).finally(function () { loading = null; });
    return loading;
  }

  function populateWorks() {
    var select = byId("autoDocumentDiscoveryWork"), works = (state.dashboard || {}).works || [];
    if (!select) return;
    var selected = select.value;
    select.innerHTML = '<option value="">Pilih kitab prioritas</option>' + works.map(function (work) { return '<option value="' + Number(work.id) + '">' + esc(work.canonicalTitle + " · " + work.canonicalAuthor) + "</option>"; }).join("");
    if (selected && works.some(function (work) { return String(work.id) === selected; })) select.value = selected;
  }

  function renderAll() {
    renderDashboard(); renderSources(); renderJobs(); renderReviews(); populateWorks(); renderOcrProgressSummary(); applyDocumentExecutionControl();
  }

  function renderOcrProgressSummary() {
    var node = byId("autoOcrProgressSummary");
    if (!node) return;
    var jobs = state.jobs.filter(function (job) { return /OCR|EXTRACT|PROCESS/i.test(String(job.stage || "") + " " + String(job.jobKey || "")); });
    var active = jobs.filter(function (job) { return /QUEUED|RUNNING|PROCESS/i.test(String(job.status || "")); });
    var progress = active.length ? Math.max.apply(null, active.map(function (job) { return Number(job.progress || 0); })) : 0;
    var dashboard = state.dashboard || {}, summary = dashboard.summary || {};
    node.innerHTML = '<div><strong>OCR scan progress</strong><span>' + progress.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + '%</span></div><div class="it-document-progress"><span style="width:' + Math.max(0, Math.min(100, progress)) + '%"></span></div><small>' + number(summary.ocrCompletedPages) + ' halaman selesai · ' + number(Math.max(0, Number(summary.ocrRequiredPages || 0) - Number(summary.ocrCompletedPages || 0))) + ' menunggu · ' + number(active.length) + ' job aktif. Raw scan dan hasil OCR tetap dipisahkan untuk review.</small>';
  }

  function renderDashboard() {
    var dashboard = state.dashboard || {}, summary = dashboard.summary || {}, storage = dashboard.storage || {}, worker = dashboard.worker || {}, policy = dashboard.policy || {};
    byId("autoDocumentMetricGrid").innerHTML = metric("Sources", summary.sourceCount, number(summary.validatedSourceCount) + " validated") + metric("Documents", summary.documentCount, number(summary.volumeCount) + " volume") + metric("Pages", summary.pageCount, number(summary.textLayerPages) + " native text") + metric("OCR required", summary.ocrRequiredPages, number(summary.ocrCompletedPages) + " OCR completed") + metric("Passages", summary.passageCount, number(summary.translationCount) + " translation links") + metric("Human review", summary.reviewCount, "raw OCR preserved") + metric("Document jobs", summary.queuedJobs, "checkpointed") + metric("References", Number(summary.quranReferenceCount || 0) + Number(summary.hadithReferenceCount || 0), "Qur'an + Hadith");
    var passages = dashboard.passages || {}, classification = byId("autoDocumentClassificationSummary");
    if (classification) classification.innerHTML = '<strong>' + number(passages.hadithContent) + ' isi Hadis</strong> · ' + number(passages.publicationInfo) + ' informasi penerbitan · ' + number(passages.paratext) + ' pengantar/daftar/indeks · ' + number(passages.unclassifiedHadithText) + ' belum terklasifikasi. Hanya isi Hadis yang boleh masuk translation queue religius.';
    byId("autoExtractionMetricGrid").innerHTML = metric("Detected pages", summary.pageCount, number(summary.textLayerPages) + " text layer") + metric("OCR backlog", Math.max(0, Number(summary.ocrRequiredPages || 0) - Number(summary.ocrCompletedPages || 0)), "Tesseract ara+eng") + metric("Review backlog", summary.reviewCount, "human decision required") + metric("Active jobs", summary.queuedJobs, "single-instance worker");
    byId("autoDocumentStorageGrid").innerHTML = storageMetric("Immutable raw", storage.rawBytes) + storageMetric("Extracted text", storage.extractedTextBytes) + storageMetric("Page images", storage.pageImageBytes) + storageMetric("Disk free", storage.freeDiskBytes);
    var tools = dashboard.toolchain || {};
    byId("autoExtractionProgressList").innerHTML = ((dashboard.works || []).map(function (work) {
      var total = Number(work.documentCount || 0), passages = Number(work.passageCount || 0);
      return '<article class="it-document-progress-card"><header><div><strong>' + esc(work.canonicalTitle) + '</strong><small>' + esc(work.workKey) + '</small></div>' + badge(total ? work.volumeCount + " volume" : "belum diarsipkan", total ? "good" : "neutral") + '</header><div class="it-document-progress"><span style="width:' + (total ? Math.min(100, Math.max(4, passages ? 100 : 20)) : 0) + '%"></span></div><p>' + number(total) + " dokumen · " + number(passages) + " passage · " + number(work.reviewCount) + " review</p></article>";
    }).join("") || '<div class="it-empty">Registry kitab kosong.</div>') + '<details class="it-document-tools"><summary>Toolchain proses</summary>' + Object.keys(tools).map(function (name) { var tool = tools[name] || {}; return '<p><strong>' + esc(name) + '</strong> ' + badge(tool.available ? "AVAILABLE" : "UNAVAILABLE", tool.available ? "good" : "bad") + '<br><code>' + esc(tool.path || "tidak ditemukan") + '</code>' + (name === "tesseract" ? '<br>model: ' + esc((tool.languages || []).join(", ") || "—") : "") + "</p>"; }).join("") + "</details>";
    var workerText = "Worker " + (worker.status || "Unknown") + " · " + (worker.mode || "Background") + " · last " + date(worker.lastRun || worker.completedAt) + " · next " + date(worker.nextScheduledRun) + " · exit " + (worker.lastExitCode == null ? "—" : worker.lastExitCode);
    setDocumentState(workerText + (worker.lastError ? " · error: " + worker.lastError : "") + " · automatic download " + (policy.automaticDownload ? "enabled" : "disabled") + ", raw archive immutable", worker.lastError ? "error" : (worker.status === "Running" ? "warning" : "ok"));
  }

  function sourceMatches(source) {
    var term = (byId("autoDocumentSourceFilter").value || "").trim().toLowerCase(), provider = byId("autoDocumentProviderFilter").value, status = byId("autoDocumentStatusFilter").value;
    var haystack = [source.title, source.author, source.canonicalTitle, source.providerName, source.editionTitle, source.checksumSha256, source.remoteFilename].join(" ").toLowerCase();
    if (term && haystack.indexOf(term) < 0) return false;
    if (provider && String(source.providerKey || "").replace(/-books$/, "").replace(/-/g, "_") !== provider) return false;
    if (status && [source.status, source.validationStatus, source.downloadStatus, source.extractionStatus, source.eligibilityStatus].indexOf(status) < 0) return false;
    return true;
  }

  function renderSources() {
    var rows = state.sources.filter(sourceMatches), node = byId("autoDocumentSourceList");
    node.innerHTML = rows.length ? rows.map(function (source) {
      var canQueue = source.validationStatus === "VALIDATED" && source.licenseStatus !== "BLOCKED" && source.licenseStatus !== "VERIFIED_REMOTE_ONLY";
      var sourceLink = source.sourcePageUrl ? '<a href="' + esc(source.sourcePageUrl) + '" target="_blank" rel="noopener noreferrer">Source page</a>' : "Source page tidak tersedia";
      return '<article class="it-document-source-card"><header><div><p class="it-eyebrow">' + esc(source.providerName) + " · " + esc(source.sourceType) + '</p><h3>' + esc(source.title) + '</h3><p>' + esc(source.author || "Penulis tidak tersedia") + " · " + esc(source.language || "und") + " · " + esc(source.remoteFilename || "nama file tidak tersedia") + '</p></div><div class="it-document-statuses">' + badge(source.status, statusKind(source.status)) + badge(source.validationStatus, statusKind(source.validationStatus)) + badge(source.licenseStatus, statusKind(source.licenseStatus)) + '</div></header><dl><dt>Kitab / edition</dt><dd>' + esc(source.canonicalTitle) + " / " + esc(source.editionTitle || "belum ditetapkan") + '</dd><dt>Remote</dt><dd>' + bytes(source.remoteFileSize || source.validatedFileSize) + " · " + esc(source.declaredMimeType || source.validatedContentType || "MIME belum tersedia") + '</dd><dt>Text layer / OCR</dt><dd>' + badge(source.textLayerStatus, statusKind(source.textLayerStatus)) + " " + badge(source.ocrRequired ? "OCR REQUIRED" : "OCR NOT REQUIRED", source.ocrRequired ? "warn" : "good") + '</dd><dt>Archive / extraction</dt><dd>' + badge(source.downloadStatus, statusKind(source.downloadStatus)) + " " + badge(source.extractionStatus, statusKind(source.extractionStatus)) + '</dd><dt>Provenance</dt><dd>' + sourceLink + " · checked " + date(source.lastChecked) + '</dd></dl>' + (source.lastError ? '<p class="it-document-error">' + esc(source.lastError) + "</p>" : "") + '<div class="it-source-actions"><button class="it-button small" data-doc-source-detail="' + source.id + '" type="button">Detail</button><button class="it-button small" data-doc-source-check="' + source.id + '" type="button">Validasi URL/file</button><button class="it-button primary small" data-doc-source-queue="' + source.id + '" type="button" ' + (canQueue ? "" : "disabled") + '>' + (source.eligibilityStatus === "ELIGIBLE" ? "Queue download" : "Arsip untuk review") + "</button></div></article>";
    }).join("") : '<div class="it-empty">Tidak ada document source pada filter ini.</div>';
  }

  function renderJobs() {
    var filter = byId("autoDocumentJobStatus").value, jobs = state.jobs.filter(function (job) { return !filter || job.status === filter; });
    byId("autoDocumentJobList").innerHTML = jobs.length ? jobs.map(function (job) {
      var progress = Math.max(0, Math.min(100, Number(job.progress || 0)));
      var byteProgress = Number(job.totalBytes || 0) ? bytes(job.downloadedBytes) + " / " + bytes(job.totalBytes) : bytes(job.downloadedBytes) + " terunduh";
      return '<article class="it-document-job-card"><header><div><p class="it-eyebrow">' + esc(job.stage) + " · job #" + number(job.id) + '</p><h3>' + esc(job.canonicalTitle || job.sourceTitle || job.jobKey) + '</h3><p>' + esc(job.originalFilename || job.jobKey) + " · attempt " + number(job.attemptCount) + "/" + number(job.maxAttempts) + '</p></div>' + badge(job.status, statusKind(job.status)) + '</header><div class="it-document-progress"><span style="width:' + progress + '%"></span></div><p>' + progress.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "% · " + byteProgress + " · " + number(job.processedUnits) + "/" + number(job.totalUnits) + " unit · lease " + esc(job.leaseOwner || "tidak aktif") + '</p><p>Diperbarui ' + esc(date(job.updatedAt || job.startedAt || job.createdAt)) + '</p>' + (job.errorMessage ? '<p class="it-document-error">' + esc(job.errorMessage) + "</p>" : "") + '<details><summary>Checkpoint/result</summary><pre class="it-auto-code">' + esc(JSON.stringify(job.result || job.config || {}, null, 2)) + "</pre></details></article>";
    }).join("") : '<div class="it-empty">Tidak ada pekerjaan document ingestion pada filter ini.</div>';
  }

  function renderReviews() {
    var node = byId("autoDocumentReviewList"), selected = state.selectedReviewId;
    node.innerHTML = state.reviews.length ? state.reviews.map(function (item) {
      return '<button class="it-document-review-row ' + (Number(item.id) === Number(selected) ? "active" : "") + '" data-doc-review-select="' + item.id + '" type="button"><span><strong>' + esc(item.title || item.reviewType) + '</strong><small>' + esc(item.canonicalTitle || item.documentKey || "Dokumen") + " · halaman " + esc(item.physicalPageNumber || "—") + '</small></span>' + badge(item.riskLevel, statusKind(item.riskLevel)) + '<small>' + esc(item.reviewType) + " · confidence " + esc(item.confidence == null ? "—" : Number(item.confidence).toFixed(3)) + "</small></button>";
    }).join("") : '<div class="it-empty">Tidak ada OCR/document review yang menunggu.</div>';
    if (selected) {
      var item = state.reviews.find(function (review) { return Number(review.id) === Number(selected); });
      if (item) renderReviewWorkspace(item);
    }
  }

  function renderReviewWorkspace(item) {
    var workspace = byId("autoDocumentReviewWorkspace"), raw = item.rawText || "", corrected = item.normalizedText || raw;
    if (!item.extractionId) {
      workspace.innerHTML = '<div class="it-panel-title"><p class="it-eyebrow">' + esc(item.reviewType) + '</p><h3>' + esc(item.title) + '</h3></div><p>' + esc(item.reason) + '</p><pre class="it-auto-code">' + esc(JSON.stringify(item.context || {}, null, 2)) + '</pre><p class="it-help">Item struktur/relasi ini tidak memiliki raw extraction; keputusan tidak disamakan dengan koreksi OCR.</p>';
      return;
    }
    workspace.innerHTML = '<div class="it-panel-title"><p class="it-eyebrow">Original page ↔ raw OCR ↔ correction</p><h3>' + esc(item.canonicalTitle || item.documentKey) + " · halaman " + esc(item.physicalPageNumber || "—") + '</h3></div><div class="it-document-review-columns"><figure><div id="autoDocumentReviewImageState" class="it-empty">Memuat scan asli…</div><img id="autoDocumentReviewImage" alt="Halaman scan asli" hidden><figcaption>Original scan dipertahankan; image bukan hasil rekonstruksi OCR.</figcaption></figure><label>Raw extraction / OCR<textarea id="autoDocumentRawText" rows="20" dir="auto" readonly>' + esc(raw) + '</textarea></label><label>Correction candidate<textarea id="autoDocumentCorrectedText" rows="20" dir="auto">' + esc(corrected) + '</textarea></label></div><label>Catatan keputusan<textarea id="autoDocumentReviewNotes" rows="3" placeholder="Alasan koreksi, bagian tidak terbaca, atau catatan mapping"></textarea></label><div class="it-source-actions"><button class="it-button primary" data-doc-review-decision="approve" data-review-id="' + item.id + '" type="button">Approve correction</button><button class="it-button" data-doc-review-decision="needs_review" data-review-id="' + item.id + '" type="button">Tetap needs review</button><button class="it-button danger" data-doc-review-decision="reject" data-review-id="' + item.id + '" type="button">Reject extraction</button></div><details><summary>Metadata extraction</summary><pre class="it-auto-code">' + esc(JSON.stringify({ extractionMethod: item.extractionMethod, confidence: item.extractionConfidence, preprocessing: item.preprocessing || {}, uncertainty: item.uncertainty || {}, reason: item.reason }, null, 2)) + "</pre></details>";
    if (item.pageId) loadReviewImage(Number(item.pageId));
  }

  async function loadReviewImage(pageId) {
    var image = byId("autoDocumentReviewImage"), status = byId("autoDocumentReviewImageState");
    if (!image || !status) return;
    try {
      var response = await fetch("api/islamic-document-page.php?id=" + pageId, { headers: headers(false), cache: "no-store" });
      if (!response.ok) { var message = "Original page tidak tersedia (HTTP " + response.status + ")"; try { message = (await response.json()).error || message; } catch (error) {} throw new Error(message); }
      var blob = await response.blob();
      if (reviewImageUrl) URL.revokeObjectURL(reviewImageUrl);
      reviewImageUrl = URL.createObjectURL(blob); image.src = reviewImageUrl; image.hidden = false; status.hidden = true;
    } catch (error) { status.textContent = error.message; status.className = "it-notice warning"; }
  }

  function openDialog(html) {
    var dialog = byId("automationDetailDialog"); byId("automationDetailContent").innerHTML = html; if (dialog && typeof dialog.showModal === "function") dialog.showModal();
  }

  async function showSource(sourceId) {
    var data = await get("document_source", { source_id: sourceId }), source = data.source || {};
    openDialog('<div class="it-panel-title"><p class="it-eyebrow">Document source provenance</p><h2>' + esc(source.title) + '</h2></div><p>' + badge(source.status, statusKind(source.status)) + " " + badge(source.licenseStatus, statusKind(source.licenseStatus)) + " " + badge(source.validationStatus, statusKind(source.validationStatus)) + '</p><dl><dt>Provider</dt><dd>' + esc(source.providerName) + '</dd><dt>Source page</dt><dd><a href="' + esc(source.sourcePageUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(source.sourcePageUrl) + '</a></dd><dt>Download URL</dt><dd><code>' + esc(source.downloadUrl || "tidak tersedia") + '</code></dd><dt>Remote checksum</dt><dd><code>' + esc((source.remoteChecksumAlgorithm || "") + ":" + (source.remoteChecksum || "tidak tersedia")) + '</code></dd><dt>Edition / completeness</dt><dd>' + esc(source.editionTitle || "belum ditentukan") + " · " + esc(source.detectedVolumeCount || 0) + "/" + esc(source.expectedVolumeCount || "?") + " volume · " + esc(source.completenessStatus || "UNKNOWN") + '</dd></dl><h3>Documents / mirrors</h3><pre class="it-auto-code">' + esc(JSON.stringify(data.documents || [], null, 2)) + '</pre><h3>Jobs</h3><pre class="it-auto-code">' + esc(JSON.stringify(data.jobs || [], null, 2)) + '</pre><h3>Security validations</h3><pre class="it-auto-code">' + esc(JSON.stringify(data.security || [], null, 2)) + "</pre>");
  }

  async function showTrace(passageId, documentId) {
    var query = passageId ? { passage_id: passageId } : { document_id: documentId }, data = await get("document_trace", query), passage = data.passage || {}, documentRow = data.document || {};
    var classification = passage.contentClassification || passage.contentClassificationJson || null; if (typeof classification === "string") { try { classification = JSON.parse(classification); } catch (error) { classification = { raw: classification }; } }
    openDialog('<div class="it-panel-title"><p class="it-eyebrow">Page-level document provenance</p><h2>' + esc(passage.passageKey || documentRow.documentKey) + '</h2></div><p>' + badge(documentRow.format, "neutral") + " " + badge(documentRow.textLayerStatus, statusKind(documentRow.textLayerStatus)) + " " + badge(passage.verificationStatus || documentRow.status, statusKind(passage.verificationStatus || documentRow.status)) + " " + badge(roleLabel(passage.passageType), passage.passageType === "hadith" ? "good" : "warn") + '</p><h3>Normalized passage</h3><div class="it-document-trace-text" dir="auto">' + esc(passage.normalizedText || "Passage tidak dipilih.") + '</div><h3>Klasifikasi isi</h3><pre class="it-auto-code">' + esc(JSON.stringify(classification || { passageType: passage.passageType || "belum tersedia" }, null, 2)) + '</pre><h3>Exact pages / extraction</h3>' + ((data.pages || []).map(function (page) { return '<article class="it-auto-card"><strong>Physical page ' + esc(page.physicalPageNumber) + " · logical " + esc(page.logicalPageNumber) + '</strong><p>' + esc(page.extractionMethod) + " · " + esc(page.extractionEngine) + " · confidence " + esc(page.confidence) + '</p><a class="it-button small" href="api/islamic-document-page.php?id=' + page.id + '" target="_blank" rel="noopener">Open original page</a></article>'; }).join("") || '<div class="it-empty">Page mapping tidak tersedia.</div>') + '<h3>Source mirrors</h3>' + ((data.mirrors || []).map(function (mirror) { return '<article class="it-auto-card"><strong>' + esc(mirror.providerName) + '</strong><p>' + esc(mirror.relationshipType) + " · " + esc(mirror.verificationStatus) + '</p><a href="' + esc(mirror.sourcePageUrl) + '" target="_blank" rel="noopener noreferrer">Source page</a></article>'; }).join("") || '<div class="it-empty">Mirror belum tersedia.</div>') + '<h3>Qur\'an / Hadith mapping</h3><pre class="it-auto-code">' + esc(JSON.stringify({ quranReferences: data.quranReferences || [], hadithReferences: data.hadithReferences || [], translations: data.translations || [] }, null, 2)) + "</pre>");
  }

  async function searchDocuments(event) {
    event.preventDefault(); var button = event.submitter, query = byId("autoDocumentSearchQuery").value.trim(); if (!query) return;
    busy(button, true);
    try {
      var data = await get("document_search", { q: query, limit: Number(byId("autoDocumentSearchLimit").value || 25) }), type = byId("autoDocumentSearchType").value, language = byId("autoDocumentSearchLanguage").value;
      var results = (data.results || []).filter(function (item) { return (!type || item.contentType === type) && (!language || item.language === language); });
      byId("autoDocumentSearchSummary").innerHTML = '<strong>' + number(results.length) + '</strong> passage ditemukan. Status OCR dan sumber selalu ditampilkan.';
      byId("autoDocumentSearchResults").innerHTML = results.length ? results.map(function (item) { return '<article class="it-search-result-card"><header><div><p class="it-eyebrow">' + esc(item.canonicalTitle) + " · " + esc(item.editionTitle || "edition tidak tersedia") + '</p><h3>' + esc(item.heading || item.passageKey) + '</h3></div><div>' + badge(roleLabel(item.passageType), item.passageType === "hadith" ? "good" : "neutral") + " " + badge(item.ocrStatus, statusKind(item.ocrStatus)) + '</div></header><p class="it-document-result-text" dir="auto">' + esc(String(item.normalizedText || "").slice(0, 900)) + (String(item.normalizedText || "").length > 900 ? "…" : "") + '</p><footer><span>' + esc(item.sourceType) + " · halaman " + esc(item.pageStart) + (item.pageEnd && item.pageEnd !== item.pageStart ? "–" + esc(item.pageEnd) : "") + " · confidence " + esc(item.confidence) + '</span><button class="it-button small" data-doc-trace-passage="' + item.passageId + '" type="button">Trace ke halaman sumber</button></footer></article>'; }).join("") : '<div class="it-empty">Tidak ada passage terindeks pada filter ini.</div>';
    } catch (error) { toast(error.message, true); } finally { busy(button, false); }
  }

  async function mutate(button, action, body, message) {
    busy(button, true);
    try { await post(action, body); toast(message); await loadAll(true); }
    catch (error) { toast(error.message, true); }
    finally { busy(button, false); applyDocumentExecutionControl(); }
  }

  function processDocumentQueue(button) {
    if (!executionEnabled()) { toast("Automation masih nonaktif. Aktifkan toggle pada header terlebih dahulu.", true); return; }
    if (!window.confirm("Jalankan dua tahap document ingestion sekarang?\n\nProses dapat memanggil PDF tools, 7-Zip, atau Tesseract tanpa membuka jendela CMD.")) return;
    mutate(button, "process_document_queue", { limit: 2, confirmation: "CONFIRM_MANUAL_AUTOMATION" }, "Dua tahap pekerjaan document ingestion diproses.");
  }

  function bind() {
    document.querySelectorAll('[data-auto-view="documents"],[data-auto-view="extraction"],[data-auto-view="document-review"]').forEach(function (button) {
      button.addEventListener("click", function () { if (!loaded) loadAll().catch(function (error) { setDocumentState(error.message, "error"); toast(error.message, true); }); });
    });
    byId("autoDocumentDiscoveryForm").addEventListener("submit", async function (event) {
      event.preventDefault(); var button = event.submitter, workId = Number(byId("autoDocumentDiscoveryWork").value || 0); if (!workId) { toast("Pilih kitab dari registry sebelum discovery.", true); return; }
      if (!confirmDocumentExecution("Cari kandidat dokumen dari provider sekarang?")) return;
      busy(button, true); setDocumentState("Discovery metadata provider sedang berjalan; tidak ada file yang diunduh…", "warning");
      try { var result = await post("run_document_discovery", { workId: workId, limit: Number(byId("autoDocumentDiscoveryLimit").value || 10), confirmation: "CONFIRM_MANUAL_AUTOMATION" }); toast(number((result.results || result.candidates || []).length) + " kandidat aktual didaftarkan; belum diunduh."); await loadAll(true); }
      catch (error) { setDocumentState(error.message, "error"); toast(error.message, true); }
      finally { busy(button, false); }
    });
    ["autoDocumentReloadButton", "autoDocumentJobReloadButton", "autoDocumentReviewReloadButton"].forEach(function (id) { byId(id).addEventListener("click", function () { var button = this; busy(button, true); loadAll(true).then(function () { toast("Status document ingestion dimuat ulang."); }).catch(function (error) { toast(error.message, true); }).finally(function () { busy(button, false); }); }); });
    ["autoDocumentProcessButton", "autoDocumentQueueProcessButton"].forEach(function (id) { byId(id).addEventListener("click", function () { processDocumentQueue(this); }); });
    byId("autoDocumentReclassifyButton").addEventListener("click", function () {
      if (!confirmDocumentExecution("Klasifikasikan ulang passage kitab Hadis lama dan karantina hasil mesin yang ternyata berasal dari penerbit/alamat/pengantar?\n\nRaw source dan riwayat tidak akan dihapus.")) return;
      mutate(this, "reclassify_hadith_passages", { limit: 5000, confirmation: "CONFIRM_MANUAL_AUTOMATION" }, "Klasifikasi isi selesai; materi non-Hadis dikeluarkan dari translation queue religius.");
    });
    byId("autoDocumentSourceFilter").addEventListener("input", function () { renderSources(); applyDocumentExecutionControl(); }); byId("autoDocumentProviderFilter").addEventListener("change", function () { renderSources(); applyDocumentExecutionControl(); }); byId("autoDocumentStatusFilter").addEventListener("change", function () { renderSources(); applyDocumentExecutionControl(); }); byId("autoDocumentJobStatus").addEventListener("change", renderJobs);
    byId("autoDocumentReviewType").addEventListener("change", function () { loadAll(true).catch(function (error) { toast(error.message, true); }); }); byId("autoDocumentReviewLimit").addEventListener("change", function () { loadAll(true).catch(function (error) { toast(error.message, true); }); });
    window.setInterval(function () {
      if (!loaded || document.hidden) return;
      var active = state.jobs.some(function (job) { return /QUEUED|RUNNING|PROCESS/i.test(String(job.status || "")); });
      if (active) loadAll(true).catch(function (error) { setDocumentState(error.message, "error"); });
    }, 4000);
    byId("autoDocumentSearchForm").addEventListener("submit", searchDocuments);
    document.addEventListener("click", async function (event) {
      var button = event.target.closest("button"); if (!button) return;
      try {
        if (button.dataset.docSourceDetail) await showSource(Number(button.dataset.docSourceDetail));
        else if (button.dataset.docSourceCheck) {
          if (!confirmDocumentExecution("Validasi URL dan file source ini sekarang?")) return;
          await mutate(button, "check_document_source", { sourceId: Number(button.dataset.docSourceCheck), confirmation: "CONFIRM_MANUAL_AUTOMATION" }, "Remote URL, MIME, size, dan signature tervalidasi.");
        }
        else if (button.dataset.docSourceQueue) {
          var source = state.sources.find(function (item) { return Number(item.id) === Number(button.dataset.docSourceQueue); }); if (!source) return;
          var reviewOnly = source.eligibilityStatus !== "ELIGIBLE";
          var queuePrompt = reviewOnly ? "Lisensi belum dinyatakan reusable. Antrekan arsip hanya untuk review lokal dan jangan publikasikan?" : "Antrekan download dokumen ini ke immutable raw archive?";
          if (!confirmDocumentExecution(queuePrompt)) return;
          await mutate(button, "queue_document_download", { sourceId: source.id, reviewOnlyApproval: reviewOnly, confirmation: "CONFIRM_MANUAL_AUTOMATION" }, "Download masuk antrean checkpointed; raw file akan diarsipkan immutable.");
        } else if (button.dataset.docReviewSelect) { state.selectedReviewId = Number(button.dataset.docReviewSelect); renderReviews(); }
        else if (button.dataset.docReviewDecision) {
          var corrected = byId("autoDocumentCorrectedText"), notes = byId("autoDocumentReviewNotes");
          await mutate(button, "review_document_page", { reviewId: Number(button.dataset.reviewId), review: { decision: button.dataset.docReviewDecision, correctedText: corrected ? corrected.value : "", notes: notes ? notes.value : "" } }, "Keputusan manusia disimpan; raw extraction tidak ditimpa."); state.selectedReviewId = 0;
        } else if (button.dataset.docTracePassage) await showTrace(Number(button.dataset.docTracePassage), 0);
      } catch (error) { toast(error.message, true); }
    });
  }

  function init() {
    if (!byId("autoDocumentSourceList")) return;
    document.addEventListener("mpm:automation-execution-change", function (event) {
      state.dashboard = state.dashboard || {};
      state.dashboard.executionControl = (event.detail || {}).control || { enabled: Boolean((event.detail || {}).enabled) };
      if (loaded && executionEnabled()) renderDashboard();
      applyDocumentExecutionControl();
    });
    document.addEventListener("mpm:islamic-live-progress", function (event) {
      var jobs = ((((event || {}).detail || {}).documents || {}).jobs || []);
      if (!Array.isArray(jobs)) return;
      state.jobs = jobs;
      renderJobs();
    });
    bind();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
}());
