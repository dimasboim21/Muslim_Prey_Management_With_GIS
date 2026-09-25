(function (window, document) {
  "use strict";

  var geom = window.MpmDrawingGeometry;
  var io = window.MpmDrawingIO;
  var transform = window.MpmDrawingTransform;
  var cadOps = window.MpmDrawingCadOps;
  var STORAGE_PREFIX = "mpm:floor-plan-editor:v1:";
  var READY_EVENT = "mpm:facility-ready";

  function html(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function defaultLayers() {
    return [
      { id: "base", name: "Base Map Layer", type: "base", visible: true, locked: true, opacity: 1 },
      { id: "reference", name: "Blueprint / Reference Layer", type: "reference", visible: true, locked: true, opacity: 0.45 },
      { id: "drawing", name: "Drawing Layer", type: "drawing", visible: true, locked: false, opacity: 1 },
      { id: "annotation", name: "Annotation Layer", type: "annotation", visible: true, locked: false, opacity: 1 },
      { id: "measurement", name: "Measurement Layer", type: "measurement", visible: true, locked: false, opacity: 1 }
    ];
  }

  function defaultGeoreference() {
    return {
      drawingCrs: "LOCAL",
      mapCrs: "EPSG:4326",
      exportMode: "local",
      controlPoints: [],
      transform: null,
      preview: false,
      applied: false
    };
  }

  function createProject(context) {
    var plan = context && context.plan ? context.plan : {};
    return {
      schemaVersion: "mpm.floor-plan-editor.v1",
      id: geom.uid("floor"),
      name: (context && context.buildingName ? context.buildingName : ""),
      scopeKey: context && context.scopeKey ? context.scopeKey : "manual-local",
      buildingId: context && context.buildingId ? context.buildingId : "main",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      settings: {
        width: Number(plan.length || 30),
        height: Number(plan.width || 20),
        units: "m",
        metersPerUnit: 1,
        measurementLabels: true,
        northDegrees: 0,
        compassVisible: true,
        geometryTolerance: 0.000001,
        georeferenceTolerance: 0.5,
        grid: { visible: true, spacing: 1, rotation: 0 },
        snap: {
          enabled: true,
          grid: true,
          vertex: true,
          midpoint: true,
          intersection: true,
          line: true,
          gridSpacing: 1
        }
      },
      layers: defaultLayers(),
      features: [],
      reference: null,
      metadata: {
        georeference: defaultGeoreference(),
        importAdapters: ["RasterImporter", "PDFReferenceImporter", "GeoJSONImporter", "KMLImporter", "DXFImporter", "DWGExternalConverterAdapter", "DGNExternalConverterAdapter", "InternalJSONImporter"],
        exportAdapters: ["SVGExporter", "GeoJSONExporter", "KMLExporter", "DXFExporter", "PNGExporter", "InternalJSONExporter"]
      }
    };
  }

  function normalizeProject(project) {
    project.settings = project.settings || {};
    project.settings.grid = Object.assign({ visible: true, spacing: 1, rotation: 0 }, project.settings.grid || {});
    project.settings.snap = Object.assign({
      enabled: true,
      grid: true,
      vertex: true,
      midpoint: true,
      intersection: true,
      line: true,
      gridSpacing: Number(project.settings.grid.spacing || 1)
    }, project.settings.snap || {});
    if (!Number.isFinite(Number(project.settings.geometryTolerance))) {
      project.settings.geometryTolerance = 0.000001;
    }
    if (!Number.isFinite(Number(project.settings.georeferenceTolerance))) {
      project.settings.georeferenceTolerance = 0.5;
    }
    project.metadata = project.metadata || {};
    project.metadata.georeference = Object.assign(defaultGeoreference(), project.metadata.georeference || {});
    project.metadata.georeference.controlPoints = Array.isArray(project.metadata.georeference.controlPoints)
      ? project.metadata.georeference.controlPoints
      : [];
    project.metadata.importAdapters = project.metadata.importAdapters || ["RasterImporter", "PDFReferenceImporter", "GeoJSONImporter", "KMLImporter", "DXFImporter", "DWGExternalConverterAdapter", "DGNExternalConverterAdapter", "InternalJSONImporter"];
    project.metadata.exportAdapters = project.metadata.exportAdapters || ["SVGExporter", "GeoJSONExporter", "KMLExporter", "DXFExporter", "PNGExporter", "InternalJSONExporter"];
    return project;
  }

  function storageKey(context) {
    var scope = context && context.scopeKey ? context.scopeKey : "manual-local";
    var building = context && context.buildingId ? context.buildingId : "main";
    return STORAGE_PREFIX + scope + ":" + building;
  }

  function cloneProjectState(project) {
    return geom.clone({
      settings: project.settings,
      layers: project.layers,
      features: project.features,
      reference: project.reference,
      metadata: project.metadata
    });
  }

  function applyProjectState(project, state) {
    project.settings = geom.clone(state.settings);
    project.layers = geom.clone(state.layers);
    project.features = geom.clone(state.features);
    project.reference = geom.clone(state.reference);
    project.metadata = geom.clone(state.metadata || project.metadata || {});
    project.updatedAt = nowIso();
  }

  function layerById(project, id) {
    return (project.layers || []).find(function (layer) {
      return layer.id === id;
    }) || null;
  }

  function ensureLayer(project, id) {
    return layerById(project, id) || project.layers[2] || project.layers[0];
  }

  function visibleFeatures(project) {
    return project.features.filter(function (feature) {
      var layer = ensureLayer(project, feature.layerId);
      return layer.visible;
    });
  }

  function selectableFeatures(project) {
    return project.features.filter(function (feature) {
      var layer = ensureLayer(project, feature.layerId);
      return layer.visible && !layer.locked;
    });
  }

  function featureLayerLocked(project, feature) {
    return ensureLayer(project, feature.layerId).locked;
  }

  function FloorPlanEditor(mount) {
    this.mount = mount;
    this.context = null;
    this.key = "";
    this.project = null;
    this.tool = "select";
    this.activeLayerId = "drawing";
    this.viewBox = { x: 0, y: 0, w: 30, h: 20 };
    this.selectedId = "";
    this.selectedVertex = null;
    this.draft = null;
    this.drag = null;
    this.snapHint = null;
    this.history = [];
    this.redoStack = [];
    this.clipboard = null;
    this.dirty = false;
    this.autosaveTimer = null;
    this.menuFeatureId = "";
    this.menuVertexIndex = null;
    this.build();
    this.bind();
  }

  FloorPlanEditor.prototype.build = function () {
    this.mount.innerHTML = [
      "<section class=\"floor-editor\" data-floor-editor>",
      "<div class=\"floor-editor-head\">",
      "<div><p class=\"eyebrow\">Drawing / Floor Plan Editor</p><h3>Editor denah gambar, tracing, dan pengukuran</h3></div>",
      "<div class=\"floor-editor-status\"><span id=\"floorEditorDirty\" class=\"status-pill\">Belum dimuat</span><button id=\"floorFullscreenButton\" class=\"button button-secondary\" type=\"button\">Enter Fullscreen</button></div>",
      "</div>",
      "<div class=\"floor-toolbar\" aria-label=\"Floor plan tools\">",
      this.toolButton("select", "Select", true),
      this.toolButton("pan", "Pan"),
      this.toolButton("point", "Point"),
      this.toolButton("line", "Line"),
      this.toolButton("polyline", "Polyline"),
      this.toolButton("curve", "Curve"),
      this.toolButton("circle", "Circle"),
      this.toolButton("arc", "Arc"),
      this.toolButton("polygon", "Polygon"),
      this.toolButton("rectangle", "Rectangle"),
      this.toolButton("text", "Text"),
      this.toolButton("measure", "Measure"),
      this.toolButton("calibrate", "Calibrate"),
      this.toolButton("georef", "Georef"),
      "<button id=\"floorFinishButton\" class=\"button button-secondary\" type=\"button\">Finish</button>",
      "<button id=\"floorCancelButton\" class=\"button button-secondary\" type=\"button\">Cancel</button>",
      "<button id=\"floorUndoButton\" class=\"button button-secondary\" type=\"button\">Undo</button>",
      "<button id=\"floorRedoButton\" class=\"button button-secondary\" type=\"button\">Redo</button>",
      "<button id=\"floorDeleteButton\" class=\"button button-secondary\" type=\"button\">Delete</button>",
      "<button id=\"floorSaveButton\" class=\"button button-primary\" type=\"button\">Save</button>",
      "</div>",
      "<div class=\"floor-toolbar floor-toolbar-secondary\">",
      "<button id=\"floorZoomInButton\" class=\"button button-secondary\" type=\"button\">Zoom In</button>",
      "<button id=\"floorZoomOutButton\" class=\"button button-secondary\" type=\"button\">Zoom Out</button>",
      "<button id=\"floorZoomExtentButton\" class=\"button button-secondary\" type=\"button\">Zoom Extent</button>",
      "<label><span>Grid</span><input id=\"floorGridVisibleInput\" type=\"checkbox\" checked></label>",
      "<label><span>Spacing</span><input id=\"floorGridSpacingInput\" type=\"number\" min=\"0.1\" step=\"0.1\" value=\"1\"></label>",
      "<label><span>Snap</span><input id=\"floorSnapEnabledInput\" type=\"checkbox\" checked></label>",
      "<label><span>Vertex</span><input id=\"floorSnapVertexInput\" type=\"checkbox\" checked></label>",
      "<label><span>Mid</span><input id=\"floorSnapMidpointInput\" type=\"checkbox\" checked></label>",
      "<label><span>Intersect</span><input id=\"floorSnapIntersectionInput\" type=\"checkbox\" checked></label>",
      "<label><span>Line</span><input id=\"floorSnapLineInput\" type=\"checkbox\" checked></label>",
      "<label><span>Label ukur</span><input id=\"floorMeasurementInput\" type=\"checkbox\" checked></label>",
      "<label><span>Unit</span><select id=\"floorUnitInput\"><option value=\"m\">m</option><option value=\"cm\">cm</option><option value=\"mm\">mm</option><option value=\"km\">km</option><option value=\"ft\">ft</option><option value=\"in\">in</option></select></label>",
      "<label><span>North</span><input id=\"floorNorthInput\" type=\"number\" step=\"0.1\" value=\"0\"></label>",
      "</div>",
      "<div class=\"floor-toolbar floor-toolbar-secondary\">",
      "<button id=\"floorImportReferenceButton\" class=\"button button-secondary\" type=\"button\">Import Blueprint</button>",
      "<input id=\"floorReferenceInput\" class=\"hidden-file\" type=\"file\" accept=\"image/png,image/jpeg,image/webp,image/tiff,application/pdf\">",
      "<button id=\"floorImportDrawingButton\" class=\"button button-secondary\" type=\"button\">Import Drawing</button>",
      "<input id=\"floorDrawingInput\" class=\"hidden-file\" type=\"file\" accept=\"application/json,.json,.geojson,.kml,.dxf,.dwg,.dgn,application/dxf\">",
      "<label><span>Export</span><select id=\"floorExportInput\"><option value=\"json\">Internal JSON</option><option value=\"svg\">SVG</option><option value=\"geojson\">GeoJSON</option><option value=\"kml\">KML</option><option value=\"dxf\">DXF</option><option value=\"png\">PNG render</option></select></label>",
      "<label><span>Koordinat</span><select id=\"floorExportModeInput\"><option value=\"local\">Local</option><option value=\"georeferenced\">Georeferenced</option></select></label>",
      "<label><span>Target CRS</span><select id=\"floorExportCrsInput\"><option value=\"EPSG:4326\">EPSG:4326</option><option value=\"EPSG:3857\">EPSG:3857</option></select></label>",
      "<button id=\"floorExportButton\" class=\"button button-secondary\" type=\"button\">Export</button>",
      "<button id=\"floorSyncZoneButton\" class=\"button button-secondary\" type=\"button\">Kirim polygon ke denah</button>",
      "</div>",
      "<div class=\"floor-toolbar floor-toolbar-secondary floor-cad-toolbar\">",
      "<button class=\"button button-secondary\" type=\"button\" data-cad-action=\"split\">Split</button>",
      "<button class=\"button button-secondary\" type=\"button\" data-cad-action=\"trim\">Trim</button>",
      "<button class=\"button button-secondary\" type=\"button\" data-cad-action=\"extend\">Extend</button>",
      "<button class=\"button button-secondary\" type=\"button\" data-cad-action=\"join\">Join</button>",
      "<button class=\"button button-secondary\" type=\"button\" data-cad-action=\"offset\">Offset</button>",
      "<span class=\"floor-toolbar-note\">CAD ops memakai toleransi tampilan dan undo/redo.</span>",
      "</div>",
      "<div class=\"floor-layout\">",
      "<aside class=\"floor-panel\"><div class=\"floor-panel-head\"><strong>Layer</strong><button id=\"floorAddLayerButton\" class=\"button button-secondary\" type=\"button\">Tambah</button></div><div id=\"floorLayerList\" class=\"floor-layer-list\"></div></aside>",
      "<div class=\"floor-center-stack\"><div class=\"floor-stage-wrap\"><svg id=\"floorSvg\" class=\"floor-svg\" xmlns=\"http://www.w3.org/2000/svg\" tabindex=\"0\"></svg><div id=\"floorSnapBadge\" class=\"floor-snap-badge\" hidden></div><div id=\"floorContextMenu\" class=\"floor-context-menu\" hidden></div></div><section id=\"floorGeorefPanel\" class=\"floor-georef-panel\"></section></div>",
      "<aside class=\"floor-panel\"><strong>Properties</strong><div id=\"floorProperties\" class=\"floor-properties\"></div></aside>",
      "</div>",
      "</section>"
    ].join("");

    this.root = this.mount.querySelector("[data-floor-editor]");
    this.svg = this.mount.querySelector("#floorSvg");
    this.layerList = this.mount.querySelector("#floorLayerList");
    this.properties = this.mount.querySelector("#floorProperties");
    this.georefPanel = this.mount.querySelector("#floorGeorefPanel");
    this.dirtyBadge = this.mount.querySelector("#floorEditorDirty");
    this.snapBadge = this.mount.querySelector("#floorSnapBadge");
    this.contextMenu = this.mount.querySelector("#floorContextMenu");
  };

  FloorPlanEditor.prototype.toolButton = function (tool, label, active) {
    return "<button class=\"button button-secondary floor-tool" + (active ? " is-active" : "") + "\" type=\"button\" data-tool=\"" + tool + "\">" + label + "</button>";
  };

  FloorPlanEditor.prototype.bind = function () {
    var self = this;
    this.mount.addEventListener("click", function (event) {
      var toolButton = event.target.closest("[data-tool]");
      if (toolButton) {
        self.setTool(toolButton.getAttribute("data-tool"));
        return;
      }
      var action = event.target.closest("[data-floor-action]");
      if (action) {
        self.handleMenuAction(action.getAttribute("data-floor-action"));
      }
      var cadAction = event.target.closest("[data-cad-action]");
      if (cadAction) {
        self.handleCadAction(cadAction.getAttribute("data-cad-action"));
        return;
      }
      var georefAction = event.target.closest("[data-georef-action]");
      if (georefAction) {
        self.handleGeorefAction(georefAction.getAttribute("data-georef-action"));
      }
    });

    this.mount.querySelector("#floorFinishButton").addEventListener("click", function () { self.finishDraft(); });
    this.mount.querySelector("#floorCancelButton").addEventListener("click", function () { self.cancelOperation(); });
    this.mount.querySelector("#floorUndoButton").addEventListener("click", function () { self.undo(); });
    this.mount.querySelector("#floorRedoButton").addEventListener("click", function () { self.redo(); });
    this.mount.querySelector("#floorDeleteButton").addEventListener("click", function () { self.deleteSelected(); });
    this.mount.querySelector("#floorSaveButton").addEventListener("click", function () { self.saveManual(); });
    this.mount.querySelector("#floorFullscreenButton").addEventListener("click", function () { self.toggleFullscreen(); });
    this.mount.querySelector("#floorZoomInButton").addEventListener("click", function () { self.zoom(0.78); });
    this.mount.querySelector("#floorZoomOutButton").addEventListener("click", function () { self.zoom(1.25); });
    this.mount.querySelector("#floorZoomExtentButton").addEventListener("click", function () { self.zoomExtent(); });
    this.mount.querySelector("#floorImportReferenceButton").addEventListener("click", function () { self.mount.querySelector("#floorReferenceInput").click(); });
    this.mount.querySelector("#floorImportDrawingButton").addEventListener("click", function () { self.mount.querySelector("#floorDrawingInput").click(); });
    this.mount.querySelector("#floorExportButton").addEventListener("click", function () { self.exportSelected(); });
    this.mount.querySelector("#floorSyncZoneButton").addEventListener("click", function () { self.syncSelectedToFacilityPlan(); });
    this.mount.querySelector("#floorAddLayerButton").addEventListener("click", function () { self.addLayer(); });

    ["floorGridVisibleInput", "floorGridSpacingInput", "floorSnapEnabledInput", "floorSnapVertexInput", "floorSnapMidpointInput", "floorSnapIntersectionInput", "floorSnapLineInput", "floorMeasurementInput", "floorUnitInput", "floorNorthInput"].forEach(function (id) {
      self.mount.querySelector("#" + id).addEventListener("change", function () { self.updateSettingsFromInputs(); });
      self.mount.querySelector("#" + id).addEventListener("input", function () { self.updateSettingsFromInputs(false); });
    });

    this.mount.querySelector("#floorReferenceInput").addEventListener("change", function (event) {
      self.importReference(event.target.files && event.target.files[0]);
      event.target.value = "";
    });
    this.mount.querySelector("#floorDrawingInput").addEventListener("change", function (event) {
      self.importDrawing(event.target.files && event.target.files[0]);
      event.target.value = "";
    });

    this.svg.addEventListener("pointerdown", function (event) { self.pointerDown(event); });
    this.svg.addEventListener("pointermove", function (event) { self.pointerMove(event); });
    this.svg.addEventListener("pointerup", function (event) { self.pointerUp(event); });
    this.svg.addEventListener("dblclick", function (event) { event.preventDefault(); self.finishDraft(); });
    this.svg.addEventListener("wheel", function (event) { self.wheelZoom(event); }, { passive: false });
    this.svg.addEventListener("contextmenu", function (event) { self.openContextMenu(event); });

    this.layerList.addEventListener("change", function (event) { self.updateLayerFromControl(event); });
    this.layerList.addEventListener("input", function (event) { self.updateLayerFromControl(event, true); });
    this.layerList.addEventListener("click", function (event) { self.layerAction(event); });
    this.properties.addEventListener("input", function (event) { self.updateFeatureProperty(event); });
    this.properties.addEventListener("change", function (event) { self.updateFeatureProperty(event); });
    this.georefPanel.addEventListener("input", function (event) { self.updateGeorefInput(event); });
    this.georefPanel.addEventListener("change", function (event) { self.updateGeorefInput(event); });

    document.addEventListener("keydown", function (event) { self.keyDown(event); });
    document.addEventListener("click", function (event) {
      if (!event.target.closest(".floor-context-menu")) {
        self.contextMenu.hidden = true;
      }
    });
  };

  FloorPlanEditor.prototype.loadForContext = function (context) {
    this.context = context || {};
    this.key = storageKey(this.context);
    var stored = null;
    try {
      stored = JSON.parse(window.localStorage.getItem(this.key) || "null");
    } catch (error) {
      stored = null;
    }
    this.project = normalizeProject(stored && stored.schemaVersion === "mpm.floor-plan-editor.v1" ? stored : createProject(this.context));
    this.project.layers = this.project.layers && this.project.layers.length ? this.project.layers : defaultLayers();
    this.project.features = Array.isArray(this.project.features) ? this.project.features : [];
    this.activeLayerId = "drawing";
    this.viewBox = { x: 0, y: 0, w: Number(this.project.settings.width || 30), h: Number(this.project.settings.height || 20) };
    this.history = [];
    this.redoStack = [];
    this.dirty = false;
    this.syncInputs();
    this.zoomExtent();
    this.render();
    this.updateStatus();
  };

  FloorPlanEditor.prototype.syncInputs = function () {
    var settings = this.project.settings;
    this.mount.querySelector("#floorGridVisibleInput").checked = Boolean(settings.grid.visible);
    this.mount.querySelector("#floorGridSpacingInput").value = String(settings.grid.spacing || 1);
    this.mount.querySelector("#floorSnapEnabledInput").checked = Boolean(settings.snap.enabled);
    this.mount.querySelector("#floorSnapVertexInput").checked = Boolean(settings.snap.vertex);
    this.mount.querySelector("#floorSnapMidpointInput").checked = Boolean(settings.snap.midpoint);
    this.mount.querySelector("#floorSnapIntersectionInput").checked = Boolean(settings.snap.intersection);
    this.mount.querySelector("#floorSnapLineInput").checked = Boolean(settings.snap.line);
    this.mount.querySelector("#floorMeasurementInput").checked = Boolean(settings.measurementLabels);
    this.mount.querySelector("#floorUnitInput").value = settings.units || "m";
    this.mount.querySelector("#floorNorthInput").value = String(settings.northDegrees || 0);
    var georef = this.georef();
    this.mount.querySelector("#floorExportModeInput").value = georef.exportMode || "local";
    this.mount.querySelector("#floorExportCrsInput").value = georef.mapCrs === "EPSG:3857" ? "EPSG:3857" : "EPSG:4326";
  };

  FloorPlanEditor.prototype.updateSettingsFromInputs = function (recordHistory) {
    var self = this;
    this.mutate("ChangeSettings", function () {
      var settings = self.project.settings;
      settings.grid.visible = self.mount.querySelector("#floorGridVisibleInput").checked;
      settings.grid.spacing = Math.max(0.1, Number(self.mount.querySelector("#floorGridSpacingInput").value || 1));
      settings.snap.enabled = self.mount.querySelector("#floorSnapEnabledInput").checked;
      settings.snap.grid = settings.grid.visible;
      settings.snap.gridSpacing = settings.grid.spacing;
      settings.snap.vertex = self.mount.querySelector("#floorSnapVertexInput").checked;
      settings.snap.midpoint = self.mount.querySelector("#floorSnapMidpointInput").checked;
      settings.snap.intersection = self.mount.querySelector("#floorSnapIntersectionInput").checked;
      settings.snap.line = self.mount.querySelector("#floorSnapLineInput").checked;
      settings.measurementLabels = self.mount.querySelector("#floorMeasurementInput").checked;
      settings.units = self.mount.querySelector("#floorUnitInput").value;
      settings.northDegrees = Number(self.mount.querySelector("#floorNorthInput").value || 0);
    }, recordHistory !== false);
  };

  FloorPlanEditor.prototype.setTool = function (tool) {
    this.tool = tool;
    this.draft = null;
    this.selectedVertex = null;
    this.contextMenu.hidden = true;
    this.root.setAttribute("data-active-tool", tool);
    this.mount.querySelectorAll("[data-tool]").forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-tool") === tool);
    });
    this.render();
  };

  FloorPlanEditor.prototype.currentLayerId = function (fallback) {
    var layer = ensureLayer(this.project, this.activeLayerId);
    if (layer.locked && fallback !== false) {
      layer = ensureLayer(this.project, "drawing");
    }
    return layer.id;
  };

  FloorPlanEditor.prototype.mutate = function (label, fn, recordHistory) {
    var before = cloneProjectState(this.project);
    fn();
    this.project.updatedAt = nowIso();
    if (recordHistory !== false) {
      this.history.push({ label: label, before: before, after: cloneProjectState(this.project) });
      this.redoStack = [];
    }
    this.markDirty();
    this.render();
  };

  FloorPlanEditor.prototype.markDirty = function () {
    var self = this;
    this.dirty = true;
    this.updateStatus();
    window.clearTimeout(this.autosaveTimer);
    this.autosaveTimer = window.setTimeout(function () {
      self.saveAuto();
    }, 900);
  };

  FloorPlanEditor.prototype.updateStatus = function () {
    if (!this.project) {
      return;
    }
    this.dirtyBadge.textContent = this.dirty ? "Belum disimpan" : "Tersimpan";
    this.dirtyBadge.className = "status-pill " + (this.dirty ? "is-warn" : "is-ok");
  };

  FloorPlanEditor.prototype.saveAuto = function () {
    if (!this.project || !this.key) {
      return;
    }
    this.project.updatedAt = nowIso();
    try {
      window.localStorage.setItem(this.key, JSON.stringify(this.project));
      this.dirty = false;
      this.updateStatus();
    } catch (error) {
      if (this.project.reference && this.project.reference.dataUrl) {
        var lightweight = geom.clone(this.project);
        lightweight.reference.dataUrl = "";
        lightweight.reference.storageWarning = "Blueprint terlalu besar untuk autosave localStorage. Export Internal JSON untuk backup lengkap.";
        try {
          window.localStorage.setItem(this.key, JSON.stringify(lightweight));
        } catch (nestedError) {
          this.dirtyBadge.textContent = "Autosave gagal";
          this.dirtyBadge.className = "status-pill is-warn";
          return;
        }
      }
      this.dirtyBadge.textContent = "Autosave tanpa gambar";
      this.dirtyBadge.className = "status-pill is-warn";
    }
  };

  FloorPlanEditor.prototype.saveManual = function () {
    this.saveAuto();
    this.dirtyBadge.textContent = "Tersimpan manual";
  };

  FloorPlanEditor.prototype.undo = function () {
    var step = this.history.pop();
    if (!step) {
      return;
    }
    this.redoStack.push(step);
    applyProjectState(this.project, step.before);
    this.selectedId = "";
    this.selectedVertex = null;
    this.markDirty();
    this.render();
  };

  FloorPlanEditor.prototype.redo = function () {
    var step = this.redoStack.pop();
    if (!step) {
      return;
    }
    this.history.push(step);
    applyProjectState(this.project, step.after);
    this.selectedId = "";
    this.selectedVertex = null;
    this.markDirty();
    this.render();
  };

  FloorPlanEditor.prototype.screenToWorld = function (event) {
    var rect = this.svg.getBoundingClientRect();
    return geom.point(
      this.viewBox.x + (event.clientX - rect.left) / rect.width * this.viewBox.w,
      this.viewBox.y + (event.clientY - rect.top) / rect.height * this.viewBox.h
    );
  };

  FloorPlanEditor.prototype.snap = function (raw) {
    var tolerance = this.viewBox.w / Math.max(1, this.svg.clientWidth || 1) * 12;
    var result = geom.snapPoint(raw, {
      features: visibleFeatures(this.project),
      tolerance: tolerance,
      settings: this.project.settings.snap
    });
    this.snapHint = result.kind ? result : null;
    return result.point;
  };

  FloorPlanEditor.prototype.pointerDown = function (event) {
    if (!this.project || event.button !== 0) {
      return;
    }
    this.svg.setPointerCapture(event.pointerId);
    var target = event.target;
    var raw = this.screenToWorld(event);
    var world = this.tool === "pan" ? raw : this.snap(raw);
    this.contextMenu.hidden = true;

    if (target.classList.contains("floor-control")) {
      this.startVertexDrag(target, event, world);
      return;
    }
    if (this.tool === "select" && target.closest(".floor-feature")) {
      this.startFeatureDrag(target.closest(".floor-feature"), event, world);
      return;
    }
    if (this.tool === "pan" || (event.shiftKey && this.tool === "select")) {
      this.drag = { type: "pan", startX: event.clientX, startY: event.clientY, viewBox: geom.clone(this.viewBox) };
      return;
    }
    this.handleDrawClick(world, event);
  };

  FloorPlanEditor.prototype.pointerMove = function (event) {
    if (!this.project) {
      return;
    }
    var raw = this.screenToWorld(event);
    var world = this.tool === "pan" ? raw : this.snap(raw);
    if (this.drag) {
      this.handleDrag(event, world);
      return;
    }
    if (this.draft) {
      this.draft.preview = world;
      this.render();
    } else {
      this.updateSnapBadge(event);
    }
  };

  FloorPlanEditor.prototype.pointerUp = function () {
    if (!this.drag) {
      return;
    }
    if (this.drag.before) {
      this.history.push({ label: this.drag.label || "EditGeometry", before: this.drag.before, after: cloneProjectState(this.project) });
      this.redoStack = [];
      this.markDirty();
    }
    this.drag = null;
    this.render();
  };

  FloorPlanEditor.prototype.startVertexDrag = function (element, event, world) {
    var feature = this.findFeature(element.getAttribute("data-id"));
    if (!feature || featureLayerLocked(this.project, feature)) {
      return;
    }
    this.selectedId = feature.id;
    this.selectedVertex = Number(element.getAttribute("data-index"));
    this.drag = {
      type: "vertex",
      label: "MoveVertex",
      before: cloneProjectState(this.project),
      featureId: feature.id,
      vertexIndex: this.selectedVertex,
      start: world
    };
    event.preventDefault();
  };

  FloorPlanEditor.prototype.startFeatureDrag = function (element, event, world) {
    var feature = this.findFeature(element.getAttribute("data-id"));
    if (!feature || featureLayerLocked(this.project, feature)) {
      return;
    }
    this.selectedId = feature.id;
    this.selectedVertex = null;
    this.drag = {
      type: "feature",
      label: "MoveObject",
      before: cloneProjectState(this.project),
      featureId: feature.id,
      start: world,
      original: geom.clone(feature)
    };
    this.render();
    event.preventDefault();
  };

  FloorPlanEditor.prototype.handleDrag = function (event, world) {
    if (this.drag.type === "pan") {
      var rect = this.svg.getBoundingClientRect();
      this.viewBox.x = this.drag.viewBox.x - (event.clientX - this.drag.startX) / rect.width * this.drag.viewBox.w;
      this.viewBox.y = this.drag.viewBox.y - (event.clientY - this.drag.startY) / rect.height * this.drag.viewBox.h;
      this.render();
      return;
    }
    var feature = this.findFeature(this.drag.featureId);
    if (!feature) {
      return;
    }
    if (this.drag.type === "vertex") {
      if (feature.geometry.type === "Arc" && this.drag.vertexIndex === 2) {
        feature.geometry.endPoint = geom.point(world.x, world.y);
        feature.properties = feature.properties || {};
        feature.properties.endPoint = geom.point(world.x, world.y);
      } else {
        feature.geometry.coordinates[this.drag.vertexIndex] = geom.point(world.x, world.y);
      }
      if (feature.geometry.type === "Circle" && feature.geometry.coordinates.length >= 2) {
        feature.geometry.radius = geom.distance(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
      }
      if (feature.geometry.type === "Arc" && feature.geometry.coordinates.length >= 2) {
        var center = feature.geometry.coordinates[0];
        var start = feature.geometry.coordinates[1];
        var end = feature.geometry.endPoint || (feature.properties && feature.properties.endPoint) || start;
        feature.geometry.radius = geom.distance(center, start);
        feature.geometry.startAngle = Math.atan2(start.y - center.y, start.x - center.x) * 180 / Math.PI;
        feature.geometry.endAngle = Math.atan2(end.y - center.y, end.x - center.x) * 180 / Math.PI;
        feature.properties = feature.properties || {};
        feature.properties.radius = feature.geometry.radius;
        feature.properties.endPoint = end;
      }
    } else if (this.drag.type === "feature") {
      var dx = world.x - this.drag.start.x;
      var dy = world.y - this.drag.start.y;
      var moved = geom.moveFeature(this.drag.original, dx, dy);
      Object.assign(feature, moved);
    }
    feature.updatedAt = nowIso();
    this.render();
  };

  FloorPlanEditor.prototype.handleDrawClick = function (world) {
    var tool = this.tool;
    if (tool === "point") {
      this.createFeature("Point", [world], "Point");
      return;
    }
    if (tool === "text") {
      var text = window.prompt("Isi annotation", "Catatan");
      if (text) {
        this.createFeature("TextAnnotation", [world], "TextAnnotation", { text: text, name: text });
      }
      return;
    }
    if (tool === "line") {
      this.addDraftPoint("LineString", world, 2);
      return;
    }
    if (tool === "polyline") {
      this.addDraftPoint("Polyline", world);
      return;
    }
    if (tool === "polygon") {
      if (this.draft && this.draft.points.length >= 3 && geom.distance(world, this.draft.points[0]) < this.viewBox.w / 80) {
        this.finishDraft();
        return;
      }
      this.addDraftPoint("Polygon", world);
      return;
    }
    if (tool === "rectangle") {
      this.addDraftPoint("Rectangle", world, 2);
      return;
    }
    if (tool === "curve") {
      this.addDraftPoint("BezierCurve", world, 4);
      return;
    }
    if (tool === "circle") {
      this.addDraftPoint("Circle", world, 2);
      return;
    }
    if (tool === "arc") {
      this.addDraftPoint("Arc", world, 3);
      return;
    }
    if (tool === "measure") {
      this.addDraftPoint("Measure", world);
      return;
    }
    if (tool === "calibrate") {
      this.addCalibrationPoint(world);
      return;
    }
    if (tool === "georef") {
      this.addControlPointAt(world);
    }
  };

  FloorPlanEditor.prototype.addDraftPoint = function (kind, world, autoFinishCount) {
    if (!this.draft || this.draft.kind !== kind) {
      this.draft = { kind: kind, points: [], preview: world };
    }
    this.draft.points.push(geom.point(world.x, world.y));
    if (autoFinishCount && this.draft.points.length >= autoFinishCount) {
      this.finishDraft();
      return;
    }
    this.render();
  };

  FloorPlanEditor.prototype.finishDraft = function () {
    if (!this.draft) {
      return;
    }
    var kind = this.draft.kind;
    var points = this.draft.points.slice();
    if ((kind === "Polyline" || kind === "Measure") && points.length < 2) {
      this.cancelOperation();
      return;
    }
    if (kind === "Polygon" && points.length < 3) {
      this.cancelOperation();
      return;
    }
    if (kind === "Rectangle") {
      var a = points[0];
      var b = points[1];
      points = [geom.point(a.x, a.y), geom.point(b.x, a.y), geom.point(b.x, b.y), geom.point(a.x, b.y)];
      kind = "Rectangle";
    }
    if (kind === "BezierCurve" && points.length < 4) {
      this.cancelOperation();
      return;
    }
    if (kind === "Circle") {
      if (points.length < 2 || geom.distance(points[0], points[1]) <= 0.000001) {
        this.cancelOperation();
        return;
      }
      this.draft = null;
      this.createFeature("Circle", points.slice(0, 2), "Circle", {
        geometryProps: { radius: geom.distance(points[0], points[1]) }
      });
      return;
    }
    if (kind === "Arc") {
      if (points.length < 3 || geom.distance(points[0], points[1]) <= 0.000001) {
        this.cancelOperation();
        return;
      }
      var center = points[0];
      var start = points[1];
      var end = points[2];
      var radius = geom.distance(center, start);
      var startAngle = Math.atan2(start.y - center.y, start.x - center.x) * 180 / Math.PI;
      var endAngle = Math.atan2(end.y - center.y, end.x - center.x) * 180 / Math.PI;
      this.draft = null;
      this.createFeature("Arc", [center, start], "Arc", {
        geometryProps: { radius: radius, startAngle: startAngle, endAngle: endAngle, endPoint: end },
        properties: { radius: radius, endPoint: end }
      });
      return;
    }
    var geometryType = kind === "Measure" ? "Polyline" : (kind === "Rectangle" ? "Polygon" : kind);
    var layerId = kind === "Measure" ? "measurement" : this.currentLayerId();
    var featureType = kind === "Measure" ? "Measurement" : kind;
    this.draft = null;
    this.createFeature(geometryType, points, featureType, { layerId: layerId });
  };

  FloorPlanEditor.prototype.cancelOperation = function () {
    this.draft = null;
    this.drag = null;
    this.snapHint = null;
    this.render();
  };

  FloorPlanEditor.prototype.createFeature = function (geometryType, points, type, extra) {
    var self = this;
    this.mutate("CreateObject", function () {
      var layerId = extra && extra.layerId ? extra.layerId : self.currentLayerId();
      var geometry = Object.assign({ type: geometryType, coordinates: points.map(function (item) { return geom.point(item.x, item.y); }) }, extra && extra.geometryProps ? extra.geometryProps : {});
      var feature = {
        id: geom.uid("feature"),
        type: type || geometryType,
        name: extra && extra.name ? extra.name : "",
        layerId: layerId,
        geometry: geometry,
        text: extra && extra.text ? extra.text : "",
        rotation: 0,
        style: defaultFeatureStyle(geometryType, layerId),
        properties: Object.assign({}, extra && extra.properties ? extra.properties : {}),
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      var validation = geom.validateFeature(feature);
      if (!validation.valid) {
        feature.properties.validationWarnings = validation.errors;
      }
      self.project.features.push(feature);
      self.selectedId = feature.id;
    });
  };

  function defaultFeatureStyle(geometryType, layerId) {
    if (layerId === "measurement") {
      return { stroke: "#a53d3d", fill: "none", strokeWidth: 0.06, opacity: 1 };
    }
    if (geometryType === "Polygon") {
      return { stroke: "#116653", fill: "rgba(17,102,83,0.14)", strokeWidth: 0.07, opacity: 1 };
    }
    if (geometryType === "TextAnnotation") {
      return { stroke: "#14221e", fill: "#14221e", strokeWidth: 0.05, opacity: 1 };
    }
    return { stroke: "#214f7a", fill: "none", strokeWidth: 0.07, opacity: 1 };
  }

  FloorPlanEditor.prototype.addCalibrationPoint = function (world) {
    if (!this.draft || this.draft.kind !== "Calibration") {
      this.draft = { kind: "Calibration", points: [], preview: world };
    }
    this.draft.points.push(geom.point(world.x, world.y));
    if (this.draft.points.length < 2) {
      this.render();
      return;
    }
    var a = this.draft.points[0];
    var b = this.draft.points[1];
    var drawingLength = geom.distance(a, b);
    var actual = Number(window.prompt("Panjang sebenarnya dalam meter", "6"));
    this.draft = null;
    if (!actual || actual <= 0 || drawingLength <= 0) {
      this.render();
      return;
    }
    var self = this;
    this.mutate("ScaleCalibration", function () {
      self.project.settings.metersPerUnit = actual / drawingLength;
      self.project.settings.calibration = {
        points: [a, b],
        actualMeters: actual,
        drawingUnits: drawingLength,
        calibratedAt: nowIso()
      };
    });
  };

  FloorPlanEditor.prototype.findFeature = function (id) {
    return this.project.features.find(function (feature) {
      return feature.id === id;
    }) || null;
  };

  FloorPlanEditor.prototype.selectedFeature = function () {
    return this.selectedId ? this.findFeature(this.selectedId) : null;
  };

  FloorPlanEditor.prototype.deleteSelected = function () {
    var self = this;
    if (!this.selectedId) {
      return;
    }
    this.mutate("DeleteObject", function () {
      self.project.features = self.project.features.filter(function (feature) {
        return feature.id !== self.selectedId;
      });
      self.selectedId = "";
      self.selectedVertex = null;
    });
  };

  FloorPlanEditor.prototype.duplicateSelected = function () {
    var selected = this.selectedFeature();
    var self = this;
    if (!selected) {
      return;
    }
    this.mutate("DuplicateObject", function () {
      var copy = geom.moveFeature(selected, 0.6, 0.6);
      copy.id = geom.uid("feature");
      copy.name = selected.name ? selected.name + " copy" : "";
      copy.createdAt = nowIso();
      copy.updatedAt = nowIso();
      self.project.features.push(copy);
      self.selectedId = copy.id;
    });
  };

  FloorPlanEditor.prototype.keyDown = function (event) {
    if (!this.project || !this.root.contains(document.activeElement) && !event.target.closest(".floor-editor")) {
      return;
    }
    if (event.key === "Escape") {
      this.cancelOperation();
    } else if (event.key === "Delete") {
      this.deleteSelected();
    } else if (event.ctrlKey && event.key.toLowerCase() === "z" && !event.shiftKey) {
      event.preventDefault();
      this.undo();
    } else if ((event.ctrlKey && event.key.toLowerCase() === "y") || (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "z")) {
      event.preventDefault();
      this.redo();
    } else if (event.ctrlKey && event.key.toLowerCase() === "c") {
      var selected = this.selectedFeature();
      this.clipboard = selected ? geom.clone(selected) : null;
    } else if (event.ctrlKey && event.key.toLowerCase() === "v") {
      event.preventDefault();
      if (this.clipboard) {
        var self = this;
        this.mutate("PasteObject", function () {
          var copy = geom.moveFeature(self.clipboard, 0.8, 0.8);
          copy.id = geom.uid("feature");
          copy.createdAt = nowIso();
          copy.updatedAt = nowIso();
          self.project.features.push(copy);
          self.selectedId = copy.id;
        });
      }
    } else if (event.ctrlKey && event.key.toLowerCase() === "d") {
      event.preventDefault();
      this.duplicateSelected();
    }
  };

  FloorPlanEditor.prototype.zoom = function (factor, center) {
    var cx = center ? center.x : this.viewBox.x + this.viewBox.w / 2;
    var cy = center ? center.y : this.viewBox.y + this.viewBox.h / 2;
    var nextW = Math.max(1, this.viewBox.w * factor);
    var nextH = Math.max(1, this.viewBox.h * factor);
    this.viewBox = { x: cx - nextW / 2, y: cy - nextH / 2, w: nextW, h: nextH };
    this.render();
  };

  FloorPlanEditor.prototype.wheelZoom = function (event) {
    event.preventDefault();
    this.zoom(event.deltaY < 0 ? 0.86 : 1.16, this.screenToWorld(event));
  };

  FloorPlanEditor.prototype.zoomExtent = function () {
    if (!this.project) {
      return;
    }
    this.viewBox = {
      x: -0.5,
      y: -0.5,
      w: Number(this.project.settings.width || 30) + 1,
      h: Number(this.project.settings.height || 20) + 1
    };
    this.render();
  };

  FloorPlanEditor.prototype.featureSvg = function (feature) {
    var geometry = feature.geometry || {};
    var coords = geometry.coordinates || [];
    var style = feature.style || {};
    var selected = feature.id === this.selectedId ? " is-selected" : "";
    var common = " class=\"floor-feature" + selected + "\" data-id=\"" + html(feature.id) + "\" stroke=\"" + html(style.stroke || "#116653") + "\" fill=\"" + html(style.fill || "none") + "\" stroke-width=\"" + Number(style.strokeWidth || 0.07) + "\" opacity=\"" + Number(style.opacity || 1) + "\" vector-effect=\"non-scaling-stroke\"";
    if (geometry.type === "Point") {
      var point = coords[0] || { x: 0, y: 0 };
      return "<circle" + common + " cx=\"" + point.x + "\" cy=\"" + point.y + "\" r=\"0.16\"></circle>";
    }
    if (geometry.type === "Polyline" || geometry.type === "LineString") {
      return "<polyline" + common + " points=\"" + this.pointsAttr(coords) + "\"></polyline>";
    }
    if (geometry.type === "Polygon") {
      return "<polygon" + common + " points=\"" + this.pointsAttr(coords) + "\"></polygon>";
    }
    if (geometry.type === "Circle" && coords.length >= 2) {
      return "<circle" + common + " cx=\"" + coords[0].x + "\" cy=\"" + coords[0].y + "\" r=\"" + geom.distance(coords[0], coords[1]) + "\"></circle>";
    }
    if (geometry.type === "Arc" && coords.length >= 2) {
      var radius = Number(geometry.radius || (feature.properties && feature.properties.radius) || geom.distance(coords[0], coords[1]));
      var startAngle = Number(geometry.startAngle || 0);
      var endAngle = Number(geometry.endAngle || 0);
      var startPoint = geom.arcSamples(coords[0], radius, startAngle, startAngle, 1)[0];
      var endPoint = geom.arcSamples(coords[0], radius, endAngle, endAngle, 1)[0];
      var delta = geom.normalizedArcDelta(startAngle, endAngle);
      return "<path" + common + " fill=\"none\" d=\"M " + startPoint.x + " " + startPoint.y + " A " + radius + " " + radius + " 0 " + (delta > 180 ? 1 : 0) + " 1 " + endPoint.x + " " + endPoint.y + "\"></path>";
    }
    if (geometry.type === "BezierCurve" && coords.length >= 4) {
      return "<path" + common + " fill=\"none\" d=\"M " + coords[0].x + " " + coords[0].y + " C " + coords[1].x + " " + coords[1].y + ", " + coords[2].x + " " + coords[2].y + ", " + coords[3].x + " " + coords[3].y + "\"></path>" +
        "<polyline class=\"floor-curve-handles\" points=\"" + this.pointsAttr(coords) + "\"></polyline>";
    }
    if (geometry.type === "TextAnnotation") {
      var p = coords[0] || { x: 0, y: 0 };
      return "<text class=\"floor-feature floor-text" + selected + "\" data-id=\"" + html(feature.id) + "\" x=\"" + p.x + "\" y=\"" + p.y + "\" font-size=\"0.55\" fill=\"" + html(style.stroke || "#14221e") + "\">" + html(feature.text || feature.name || "Text") + "</text>";
    }
    return "";
  };

  FloorPlanEditor.prototype.pointsAttr = function (points) {
    return (points || []).map(function (point) {
      return geom.round(point.x, 6) + "," + geom.round(point.y, 6);
    }).join(" ");
  };

  FloorPlanEditor.prototype.render = function () {
    if (!this.project) {
      return;
    }
    this.svg.setAttribute("viewBox", [this.viewBox.x, this.viewBox.y, this.viewBox.w, this.viewBox.h].join(" "));
    var settings = this.project.settings;
    var grid = settings.grid || {};
    var gridSpacing = Math.max(0.1, Number(grid.spacing || 1));
    var gridSvg = grid.visible
      ? "<defs><pattern id=\"floorGridPattern\" width=\"" + gridSpacing + "\" height=\"" + gridSpacing + "\" patternUnits=\"userSpaceOnUse\"><path d=\"M " + gridSpacing + " 0 L 0 0 0 " + gridSpacing + "\" fill=\"none\" stroke=\"rgba(20,34,30,0.14)\" stroke-width=\"0.025\" vector-effect=\"non-scaling-stroke\"></path></pattern></defs><rect x=\"-10000\" y=\"-10000\" width=\"20000\" height=\"20000\" fill=\"url(#floorGridPattern)\"></rect>"
      : "";
    var referenceSvg = this.referenceSvg();
    var layersSvg = this.project.layers.map(function (layer) {
      if (!layer.visible || layer.type === "reference" || layer.type === "base") {
        return "";
      }
      var features = this.project.features.filter(function (feature) {
        return feature.layerId === layer.id;
      }).map(this.featureSvg.bind(this)).join("");
      return "<g class=\"floor-layer\" data-layer-id=\"" + html(layer.id) + "\" opacity=\"" + Number(layer.opacity || 1) + "\">" + features + "</g>";
    }, this).join("");
    var draftSvg = this.draftSvg();
    var controlSvg = this.controlSvg();
    var labelSvg = settings.measurementLabels ? this.measurementSvg() : "";
    var georefSvg = this.georefSvg();
    var snapSvg = this.snapHint ? "<circle class=\"floor-snap-point\" cx=\"" + this.snapHint.point.x + "\" cy=\"" + this.snapHint.point.y + "\" r=\"" + (this.viewBox.w / 220) + "\"></circle>" : "";
    this.svg.innerHTML = gridSvg + referenceSvg + layersSvg + draftSvg + labelSvg + georefSvg + controlSvg + snapSvg + this.compassSvg();
    this.renderLayers();
    this.renderProperties();
    this.renderGeoreferencePanel();
    this.updateSnapBadge();
  };

  FloorPlanEditor.prototype.referenceSvg = function () {
    var reference = this.project.reference;
    var refLayer = ensureLayer(this.project, "reference");
    if (!reference || !reference.dataUrl || !refLayer.visible) {
      return "";
    }
    var filter = [
      reference.grayscale ? "grayscale(1)" : "",
      reference.invert ? "invert(1)" : "",
      "brightness(" + Number(reference.brightness || 1) + ")",
      "contrast(" + Number(reference.contrast || 1) + ")"
    ].filter(Boolean).join(" ");
    return "<image class=\"floor-reference\" href=\"" + html(reference.dataUrl) + "\" x=\"" + Number(reference.x || 0) + "\" y=\"" + Number(reference.y || 0) + "\" width=\"" + Number(reference.width || this.project.settings.width) + "\" height=\"" + Number(reference.height || this.project.settings.height) + "\" opacity=\"" + Number(refLayer.opacity || reference.opacity || 0.45) + "\" style=\"filter:" + html(filter) + "\" transform=\"rotate(" + Number(reference.rotation || 0) + " " + Number(reference.x || 0) + " " + Number(reference.y || 0) + ")\"></image>";
  };

  FloorPlanEditor.prototype.draftSvg = function () {
    if (!this.draft) {
      return "";
    }
    var points = this.draft.points.slice();
    if (this.draft.preview) {
      points.push(this.draft.preview);
    }
    if (this.draft.kind === "Rectangle" && points.length >= 2) {
      var a = points[0];
      var b = points[1];
      points = [a, geom.point(b.x, a.y), b, geom.point(a.x, b.y)];
      return "<polygon class=\"floor-draft\" points=\"" + this.pointsAttr(points) + "\"></polygon>";
    }
    if (this.draft.kind === "BezierCurve" && points.length >= 2) {
      return "<polyline class=\"floor-draft\" points=\"" + this.pointsAttr(points) + "\"></polyline>";
    }
    if (this.draft.kind === "Circle" && points.length >= 2) {
      return "<circle class=\"floor-draft\" cx=\"" + points[0].x + "\" cy=\"" + points[0].y + "\" r=\"" + geom.distance(points[0], points[1]) + "\"></circle>";
    }
    if (this.draft.kind === "Arc" && points.length >= 2) {
      if (points.length < 3) {
        return "<polyline class=\"floor-draft\" points=\"" + this.pointsAttr(points) + "\"></polyline>";
      }
      var center = points[0];
      var start = points[1];
      var end = points[2];
      var radius = geom.distance(center, start);
      var startAngle = Math.atan2(start.y - center.y, start.x - center.x) * 180 / Math.PI;
      var endAngle = Math.atan2(end.y - center.y, end.x - center.x) * 180 / Math.PI;
      var delta = geom.normalizedArcDelta(startAngle, endAngle);
      return "<path class=\"floor-draft\" fill=\"none\" d=\"M " + start.x + " " + start.y + " A " + radius + " " + radius + " 0 " + (delta > 180 ? 1 : 0) + " 1 " + end.x + " " + end.y + "\"></path>";
    }
    if (this.draft.kind === "Polygon") {
      return "<polyline class=\"floor-draft\" points=\"" + this.pointsAttr(points) + "\"></polyline>";
    }
    return "<polyline class=\"floor-draft\" points=\"" + this.pointsAttr(points) + "\"></polyline>";
  };

  FloorPlanEditor.prototype.controlSvg = function () {
    var selected = this.selectedFeature();
    if (!selected) {
      return "";
    }
    return geom.featureVertices(selected).map(function (point, index) {
      return "<circle class=\"floor-control" + (this.selectedVertex === index ? " is-active" : "") + "\" data-id=\"" + html(selected.id) + "\" data-index=\"" + index + "\" cx=\"" + point.x + "\" cy=\"" + point.y + "\" r=\"" + (this.viewBox.w / 180) + "\"></circle>";
    }, this).join("");
  };

  FloorPlanEditor.prototype.measurementSvg = function () {
    var settings = this.project.settings;
    var metersPerUnit = Number(settings.metersPerUnit || 1);
    var unit = settings.units || "m";
    return visibleFeatures(this.project).map(function (feature) {
      var segments = geom.featureSegments(feature);
      var type = feature.geometry && feature.geometry.type;
      var labels = (type === "Circle" || type === "Arc" || type === "BezierCurve") ? "" : segments.map(function (segment) {
        var mid = geom.midpoint(segment[0], segment[1]);
        return "<text class=\"floor-measure-label\" x=\"" + mid.x + "\" y=\"" + mid.y + "\">" + html(geom.formatLength(geom.distance(segment[0], segment[1]) * metersPerUnit, unit)) + "</text>";
      }).join("");
      var length = geom.featureLength(feature) * metersPerUnit;
      var area = geom.featureArea(feature) * metersPerUnit * metersPerUnit;
      var points = geom.featureVertices(feature);
      if (points.length) {
        var box = geom.bounds(points);
        var text = feature.geometry.type === "Polygon" || feature.geometry.type === "Circle"
          ? "L " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(area) + " m2"
          : "T " + geom.formatLength(length, unit);
        labels += "<text class=\"floor-measure-total\" x=\"" + (box.x + box.w / 2) + "\" y=\"" + (box.y + box.h / 2) + "\">" + html(text) + "</text>";
      }
      return labels;
    }).join("");
  };

  FloorPlanEditor.prototype.compassSvg = function () {
    if (!this.project.settings.compassVisible) {
      return "";
    }
    var size = this.viewBox.w / 18;
    var cx = this.viewBox.x + this.viewBox.w - size * 1.4;
    var cy = this.viewBox.y + size * 1.4;
    var north = Number(this.project.settings.northDegrees || 0);
    return "<g class=\"floor-compass\" transform=\"translate(" + cx + " " + cy + ")\">" +
      "<circle r=\"" + size + "\"></circle>" +
      "<path d=\"M 0 " + (-size * 0.82) + " L " + (size * 0.22) + " 0 L 0 " + (size * 0.82) + " L " + (-size * 0.22) + " 0 Z\" transform=\"rotate(" + north + ")\"></path>" +
      "<text y=\"" + (-size * 1.12) + "\">N</text><text x=\"" + (size * 1.12) + "\" y=\"0.12\">E</text><text y=\"" + (size * 1.34) + "\">S</text><text x=\"" + (-size * 1.35) + "\" y=\"0.12\">W</text>" +
      "</g>";
  };

  FloorPlanEditor.prototype.georef = function () {
    this.project.metadata = this.project.metadata || {};
    this.project.metadata.georeference = Object.assign(defaultGeoreference(), this.project.metadata.georeference || {});
    this.project.metadata.georeference.controlPoints = Array.isArray(this.project.metadata.georeference.controlPoints)
      ? this.project.metadata.georeference.controlPoints
      : [];
    return this.project.metadata.georeference;
  };

  FloorPlanEditor.prototype.georefSvg = function () {
    var georef = this.georef();
    var points = georef.controlPoints || [];
    if (!points.length) {
      return "";
    }
    var radius = this.viewBox.w / 160;
    var inverse = georef.transform && georef.transform.inverse;
    return "<g class=\"floor-georef-svg\">" + points.map(function (item, index) {
      var source = geom.point(item.drawingX, item.drawingY);
      var label = html(item.name || ("CP " + (index + 1)));
      var targetLine = "";
      if (transform && inverse && Number.isFinite(Number(item.mapX)) && Number.isFinite(Number(item.mapY))) {
        var targetLocal = transform.applyMatrix(geom.point(item.mapX, item.mapY), inverse);
        targetLine = "<line class=\"floor-georef-link\" x1=\"" + source.x + "\" y1=\"" + source.y + "\" x2=\"" + targetLocal.x + "\" y2=\"" + targetLocal.y + "\"></line>" +
          "<circle class=\"floor-georef-target\" cx=\"" + targetLocal.x + "\" cy=\"" + targetLocal.y + "\" r=\"" + (radius * 0.72) + "\"></circle>";
      }
      return targetLine +
        "<circle class=\"floor-georef-marker" + (item.enabled === false ? " is-disabled" : "") + "\" cx=\"" + source.x + "\" cy=\"" + source.y + "\" r=\"" + radius + "\"></circle>" +
        "<text class=\"floor-georef-label\" x=\"" + (source.x + radius * 1.6) + "\" y=\"" + (source.y - radius * 1.2) + "\">" + label + "</text>";
    }).join("") + "</g>";
  };

  FloorPlanEditor.prototype.formatNumber = function (value, digits) {
    var number = Number(value);
    if (!Number.isFinite(number)) {
      return "";
    }
    return String(geom.round(number, digits || 6));
  };

  FloorPlanEditor.prototype.promptNumber = function (label, fallback) {
    var answer = window.prompt(label, this.formatNumber(fallback || 0, 8));
    if (answer === null) {
      return null;
    }
    var number = Number(String(answer).replace(",", "."));
    if (!Number.isFinite(number)) {
      window.alert("Nilai angka tidak valid.");
      return null;
    }
    return number;
  };

  FloorPlanEditor.prototype.addControlPointAt = function (world) {
    var mapX = this.promptNumber("Target X / longitude / easting", world.x);
    if (mapX === null) {
      return;
    }
    var mapY = this.promptNumber("Target Y / latitude / northing", world.y);
    if (mapY === null) {
      return;
    }
    var self = this;
    this.mutate("AddGeoreferencePoint", function () {
      var georef = self.georef();
      georef.controlPoints.push({
        id: geom.uid("cp"),
        name: "CP " + (georef.controlPoints.length + 1),
        drawingX: geom.round(world.x, 8),
        drawingY: geom.round(world.y, 8),
        mapX: mapX,
        mapY: mapY,
        enabled: true
      });
      self.calculateGeoreference();
    });
  };

  FloorPlanEditor.prototype.addManualControlPoint = function () {
    var drawingX = this.promptNumber("Drawing X", 0);
    if (drawingX === null) {
      return;
    }
    var drawingY = this.promptNumber("Drawing Y", 0);
    if (drawingY === null) {
      return;
    }
    this.addControlPointAt(geom.point(drawingX, drawingY));
  };

  FloorPlanEditor.prototype.calculateGeoreference = function () {
    var georef = this.georef();
    if (!transform || typeof transform.calculate !== "function") {
      georef.transform = null;
      return;
    }
    georef.transform = transform.calculate(georef.controlPoints || []);
  };

  FloorPlanEditor.prototype.recalculateGeoreference = function () {
    var self = this;
    this.mutate("RecalculateGeoreference", function () {
      self.calculateGeoreference();
    });
  };

  FloorPlanEditor.prototype.resetGeoreference = function () {
    var self = this;
    this.mutate("ResetGeoreference", function () {
      self.project.metadata.georeference = defaultGeoreference();
    });
  };

  FloorPlanEditor.prototype.applyGeoreference = function () {
    var self = this;
    this.mutate("ApplyGeoreference", function () {
      var georef = self.georef();
      self.calculateGeoreference();
      georef.applied = Boolean(georef.transform && georef.transform.controlPointCount);
      georef.preview = false;
      georef.exportMode = georef.applied ? "georeferenced" : "local";
    });
    var exportMode = this.mount.querySelector("#floorExportModeInput");
    if (exportMode) {
      exportMode.value = this.georef().exportMode || "local";
    }
  };

  FloorPlanEditor.prototype.deleteControlPoint = function (id) {
    var self = this;
    this.mutate("DeleteGeoreferencePoint", function () {
      var georef = self.georef();
      georef.controlPoints = georef.controlPoints.filter(function (item) {
        return item.id !== id;
      });
      self.calculateGeoreference();
    });
  };

  FloorPlanEditor.prototype.handleGeorefAction = function (action) {
    if (action === "add") {
      this.addManualControlPoint();
    } else if (action === "recalculate") {
      this.recalculateGeoreference();
    } else if (action === "apply") {
      this.applyGeoreference();
    } else if (action === "overlay") {
      this.publishMapOverlay();
    } else if (action === "reset") {
      this.resetGeoreference();
    } else if (action.indexOf("delete:") === 0) {
      this.deleteControlPoint(action.split(":")[1]);
    }
  };

  FloorPlanEditor.prototype.buildMapOverlayPayload = function () {
    var georef = this.georef();
    if (!georef.transform || !georef.transform.matrix) {
      return null;
    }
    var targetCrs = georef.mapCrs || "EPSG:4326";
    return {
      id: this.project.id,
      name: this.project.name,
      scopeKey: this.project.scopeKey,
      buildingId: this.project.buildingId,
      crs: targetCrs,
      generatedAt: nowIso(),
      geojson: io.projectToGeoJson(this.project, { coordinateMode: "georeferenced", targetCrs: targetCrs })
    };
  };

  FloorPlanEditor.prototype.publishMapOverlay = function () {
    var payload = this.buildMapOverlayPayload();
    if (!payload) {
      window.alert("Hitung georeference terlebih dahulu sebelum publish overlay.");
      return;
    }
    var self = this;
    this.mutate("PublishMapOverlay", function () {
      self.georef().lastOverlayAt = payload.generatedAt;
    }, false);
    window.MpmFloorPlanLatestOverlay = payload;
    window.dispatchEvent(new CustomEvent("mpm:floor-plan-overlay-ready", { detail: payload }));
  };

  FloorPlanEditor.prototype.updateGeorefInput = function (event) {
    var projectField = event.target.getAttribute("data-georef-project-field");
    var field = event.target.getAttribute("data-georef-field");
    var id = event.target.getAttribute("data-georef-id");
    if (!projectField && (!field || !id)) {
      return;
    }
    var self = this;
    this.mutate("EditGeoreference", function () {
      var georef = self.georef();
      if (projectField) {
        georef[projectField] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
        if (projectField === "exportMode") {
          var exportMode = self.mount.querySelector("#floorExportModeInput");
          if (exportMode) {
            exportMode.value = georef.exportMode || "local";
          }
        } else if (projectField === "mapCrs") {
          var exportCrs = self.mount.querySelector("#floorExportCrsInput");
          if (exportCrs) {
            exportCrs.value = georef.mapCrs || "EPSG:4326";
          }
        }
      } else {
        var item = georef.controlPoints.find(function (point) {
          return point.id === id;
        });
        if (!item) {
          return;
        }
        item[field] = event.target.type === "checkbox" ? event.target.checked : (field === "name" ? event.target.value : Number(event.target.value));
      }
      self.calculateGeoreference();
    }, false);
  };

  FloorPlanEditor.prototype.renderGeoreferencePanel = function () {
    var georef = this.georef();
    var result = georef.transform || {};
    var residuals = result.residuals || [];
    var residualMap = {};
    residuals.forEach(function (item) {
      residualMap[item.id] = item;
    });
    var rows = (georef.controlPoints || []).map(function (item, index) {
      var residual = residualMap[item.id] || {};
      return "<tr>" +
        "<td><input data-georef-id=\"" + html(item.id) + "\" data-georef-field=\"enabled\" type=\"checkbox\" " + (item.enabled === false ? "" : "checked") + "></td>" +
        "<td><input data-georef-id=\"" + html(item.id) + "\" data-georef-field=\"name\" value=\"" + html(item.name || ("CP " + (index + 1))) + "\"></td>" +
        "<td><input data-georef-id=\"" + html(item.id) + "\" data-georef-field=\"drawingX\" type=\"number\" step=\"0.000001\" value=\"" + this.formatNumber(item.drawingX, 8) + "\"></td>" +
        "<td><input data-georef-id=\"" + html(item.id) + "\" data-georef-field=\"drawingY\" type=\"number\" step=\"0.000001\" value=\"" + this.formatNumber(item.drawingY, 8) + "\"></td>" +
        "<td><input data-georef-id=\"" + html(item.id) + "\" data-georef-field=\"mapX\" type=\"number\" step=\"0.000001\" value=\"" + this.formatNumber(item.mapX, 8) + "\"></td>" +
        "<td><input data-georef-id=\"" + html(item.id) + "\" data-georef-field=\"mapY\" type=\"number\" step=\"0.000001\" value=\"" + this.formatNumber(item.mapY, 8) + "\"></td>" +
        "<td>" + html(this.formatNumber(residual.error, 6) || "-") + "</td>" +
        "<td><button type=\"button\" data-georef-action=\"delete:" + html(item.id) + "\">Del</button></td>" +
        "</tr>";
    }, this).join("");
    var matrix = result.matrix || {};
    this.georefPanel.innerHTML = [
      "<div class=\"floor-panel-head\"><strong>Georeference</strong><div class=\"form-actions\"><button class=\"button button-secondary\" type=\"button\" data-georef-action=\"add\">Tambah CP</button><button class=\"button button-secondary\" type=\"button\" data-georef-action=\"recalculate\">Hitung</button><button class=\"button button-secondary\" type=\"button\" data-georef-action=\"apply\">Apply</button><button class=\"button button-secondary\" type=\"button\" data-georef-action=\"overlay\">Publish overlay</button><button class=\"button button-secondary\" type=\"button\" data-georef-action=\"reset\">Reset</button></div></div>",
      "<div class=\"floor-georef-controls\">",
      "<label><span>Drawing CRS</span><select data-georef-project-field=\"drawingCrs\"><option value=\"LOCAL\" " + (georef.drawingCrs === "LOCAL" ? "selected" : "") + ">LOCAL</option></select></label>",
      "<label><span>Map CRS</span><select data-georef-project-field=\"mapCrs\"><option value=\"EPSG:4326\" " + (georef.mapCrs === "EPSG:4326" ? "selected" : "") + ">EPSG:4326</option><option value=\"EPSG:3857\" " + (georef.mapCrs === "EPSG:3857" ? "selected" : "") + ">EPSG:3857</option></select></label>",
      "<label><span>Export default</span><select data-georef-project-field=\"exportMode\"><option value=\"local\" " + (georef.exportMode !== "georeferenced" ? "selected" : "") + ">Local</option><option value=\"georeferenced\" " + (georef.exportMode === "georeferenced" ? "selected" : "") + ">Georeferenced</option></select></label>",
      "<label><span>Preview</span><input data-georef-project-field=\"preview\" type=\"checkbox\" " + (georef.preview ? "checked" : "") + "></label>",
      "</div>",
      "<dl class=\"floor-georef-summary\"><dt>Mode</dt><dd>" + html(matrix.type || "belum dihitung") + "</dd><dt>CP aktif</dt><dd>" + Number(result.controlPointCount || 0) + "</dd><dt>RMS</dt><dd>" + html(this.formatNumber(result.rmsError, 6) || "0") + "</dd><dt>Max residual</dt><dd>" + html(this.formatNumber(result.maxError, 6) || "0") + "</dd><dt>Overlay</dt><dd>" + html(georef.lastOverlayAt ? "published" : "belum") + "</dd></dl>",
      transform ? "" : "<p class=\"muted-cell\">Modul transform tidak tersedia; georeference dinonaktifkan.</p>",
      "<div class=\"floor-georef-table-wrap\"><table class=\"floor-georef-table\"><thead><tr><th>On</th><th>Nama</th><th>Drawing X</th><th>Drawing Y</th><th>Map X/Lon</th><th>Map Y/Lat</th><th>Err</th><th></th></tr></thead><tbody>" + (rows || "<tr><td colspan=\"8\">Belum ada control point. Gunakan tool Georef lalu klik titik denah.</td></tr>") + "</tbody></table></div>"
    ].join("");
  };

  FloorPlanEditor.prototype.renderLayers = function () {
    this.layerList.innerHTML = this.project.layers.map(function (layer, index) {
      return "<div class=\"floor-layer-row\" data-layer-id=\"" + html(layer.id) + "\">" +
        "<input type=\"checkbox\" data-layer-field=\"visible\" " + (layer.visible ? "checked" : "") + ">" +
        "<input class=\"floor-layer-name\" data-layer-field=\"name\" value=\"" + html(layer.name) + "\">" +
        "<input type=\"checkbox\" data-layer-field=\"locked\" " + (layer.locked ? "checked" : "") + " title=\"Lock\">" +
        "<input type=\"range\" min=\"0\" max=\"1\" step=\"0.05\" data-layer-field=\"opacity\" value=\"" + Number(layer.opacity || 0) + "\">" +
        "<button type=\"button\" data-layer-action=\"active\">Aktif</button>" +
        "<button type=\"button\" data-layer-action=\"up\" " + (index === 0 ? "disabled" : "") + ">Up</button>" +
        "<button type=\"button\" data-layer-action=\"down\" " + (index === this.project.layers.length - 1 ? "disabled" : "") + ">Down</button>" +
        "<button type=\"button\" data-layer-action=\"delete\" " + (layer.type === "base" || layer.type === "drawing" ? "disabled" : "") + ">Del</button>" +
        "</div>";
    }, this).join("");
  };

  FloorPlanEditor.prototype.renderProperties = function () {
    var selected = this.selectedFeature();
    if (!selected) {
      var reference = this.project.reference;
      var referencePanel = reference ? [
        "<hr>",
        "<strong>Blueprint / Reference</strong>",
        "<label><span>Opacity</span><input data-project-prop=\"reference.opacity\" type=\"number\" min=\"0\" max=\"1\" step=\"0.05\" value=\"" + Number(reference.opacity || 0.45) + "\"></label>",
        "<label><span>Brightness</span><input data-project-prop=\"reference.brightness\" type=\"number\" min=\"0.2\" max=\"3\" step=\"0.05\" value=\"" + Number(reference.brightness || 1) + "\"></label>",
        "<label><span>Contrast</span><input data-project-prop=\"reference.contrast\" type=\"number\" min=\"0.2\" max=\"3\" step=\"0.05\" value=\"" + Number(reference.contrast || 1) + "\"></label>",
        "<label><span>Rotate</span><input data-project-prop=\"reference.rotation\" type=\"number\" step=\"0.1\" value=\"" + Number(reference.rotation || 0) + "\"></label>",
        "<label><span>Grayscale</span><input data-project-prop=\"reference.grayscale\" type=\"checkbox\" " + (reference.grayscale ? "checked" : "") + "></label>",
        "<label><span>Invert</span><input data-project-prop=\"reference.invert\" type=\"checkbox\" " + (reference.invert ? "checked" : "") + "></label>"
      ].join("") : "";
      this.properties.innerHTML = "<p class=\"muted-cell\">Pilih objek untuk melihat properties. Klik kanan objek untuk context menu.</p>" +
        "<dl><dt>Project</dt><dd>" + html(this.project.name) + "</dd><dt>Scale</dt><dd>1 unit = " + geom.formatLength(this.project.settings.metersPerUnit || 1, "m") + "</dd></dl>" + referencePanel;
      return;
    }
    var length = geom.featureLength(selected) * Number(this.project.settings.metersPerUnit || 1);
    var area = geom.featureArea(selected) * Math.pow(Number(this.project.settings.metersPerUnit || 1), 2);
    var points = geom.featureVertices(selected);
    var bearing = points.length > 1 ? geom.bearing(points[0], points[1], this.project.settings.northDegrees) : 0;
    var direction = points.length > 1 ? geom.direction16(bearing) : null;
    var layerOptions = this.project.layers.map(function (layer) {
      return "<option value=\"" + html(layer.id) + "\" " + (layer.id === selected.layerId ? "selected" : "") + ">" + html(layer.name) + "</option>";
    }).join("");
    this.properties.innerHTML = [
      "<dl>",
      "<dt>Object ID</dt><dd>" + html(selected.id) + "</dd>",
      "<dt>Type</dt><dd>" + html(selected.type || selected.geometry.type) + "</dd>",
      "<dt>Length</dt><dd>" + html(geom.formatLength(length, this.project.settings.units)) + "</dd>",
      "<dt>Area</dt><dd>" + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(area) + " m2</dd>",
      "<dt>Bearing</dt><dd>" + geom.round(bearing, 1) + " deg" + (direction ? " / " + html(direction.code + " - " + direction.label) : "") + "</dd>",
      "</dl>",
      "<label><span>Name</span><input data-prop=\"name\" value=\"" + html(selected.name || "") + "\"></label>",
      "<label><span>Layer</span><select data-prop=\"layerId\">" + layerOptions + "</select></label>",
      "<label><span>Stroke</span><input data-prop=\"style.stroke\" type=\"color\" value=\"" + html(selected.style.stroke || "#116653") + "\"></label>",
      "<label><span>Fill</span><input data-prop=\"style.fill\" value=\"" + html(selected.style.fill || "none") + "\"></label>",
      "<label><span>Line Width</span><input data-prop=\"style.strokeWidth\" type=\"number\" step=\"0.01\" min=\"0\" value=\"" + Number(selected.style.strokeWidth || 0.07) + "\"></label>",
      "<label><span>Opacity</span><input data-prop=\"style.opacity\" type=\"number\" min=\"0\" max=\"1\" step=\"0.05\" value=\"" + Number(selected.style.opacity || 1) + "\"></label>",
      "<label><span>Description</span><textarea data-prop=\"properties.description\">" + html(selected.properties.description || "") + "</textarea></label>",
      "<div class=\"form-actions\"><button type=\"button\" class=\"button button-secondary\" data-floor-action=\"duplicate\">Duplicate</button><button type=\"button\" class=\"button button-secondary\" data-floor-action=\"rotate90\">Rotate 90</button></div>"
    ].join("");
  };

  FloorPlanEditor.prototype.updateFeatureProperty = function (event) {
    var prop = event.target.getAttribute("data-prop");
    var projectProp = event.target.getAttribute("data-project-prop");
    var selected = this.selectedFeature();
    if (projectProp) {
      var selfProject = this;
      this.mutate("ChangeProjectProperty", function () {
        var value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
        if (projectProp.indexOf("reference.") === 0 && selfProject.project.reference) {
          var key = projectProp.split(".")[1];
          selfProject.project.reference[key] = event.target.type === "number" ? Number(value) : value;
          if (key === "opacity") {
            ensureLayer(selfProject.project, "reference").opacity = Number(value);
          }
        }
      }, false);
      return;
    }
    if (!prop || !selected) {
      return;
    }
    var value = event.target.value;
    var self = this;
    this.mutate("ChangeStyle", function () {
      if (prop === "name") {
        selected.name = value;
      } else if (prop === "layerId") {
        selected.layerId = value;
      } else if (prop.indexOf("style.") === 0) {
        var key = prop.split(".")[1];
        selected.style[key] = event.target.type === "number" ? Number(value) : value;
      } else if (prop === "properties.description") {
        selected.properties.description = value;
      }
      selected.updatedAt = nowIso();
      self.selectedId = selected.id;
    }, false);
  };

  FloorPlanEditor.prototype.updateLayerFromControl = function (event) {
    var row = event.target.closest("[data-layer-id]");
    var field = event.target.getAttribute("data-layer-field");
    if (!row || !field) {
      return;
    }
    var layer = layerById(this.project, row.getAttribute("data-layer-id"));
    if (!layer) {
      return;
    }
    var value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    var self = this;
    this.mutate("TransformLayer", function () {
      layer[field] = field === "opacity" ? Number(value) : value;
      if (field === "opacity" && layer.id === "reference" && self.project.reference) {
        self.project.reference.opacity = Number(value);
      }
    }, false);
  };

  FloorPlanEditor.prototype.layerAction = function (event) {
    var button = event.target.closest("[data-layer-action]");
    if (!button) {
      return;
    }
    var row = button.closest("[data-layer-id]");
    var action = button.getAttribute("data-layer-action");
    var layerId = row.getAttribute("data-layer-id");
    var self = this;
    this.mutate("LayerAction", function () {
      var index = self.project.layers.findIndex(function (layer) { return layer.id === layerId; });
      if (index < 0) {
        return;
      }
      if (action === "active") {
        self.activeLayerId = layerId;
      } else if (action === "up" && index > 0) {
        self.project.layers.splice(index - 1, 0, self.project.layers.splice(index, 1)[0]);
      } else if (action === "down" && index < self.project.layers.length - 1) {
        self.project.layers.splice(index + 1, 0, self.project.layers.splice(index, 1)[0]);
      } else if (action === "delete") {
        self.project.layers.splice(index, 1);
        self.project.features = self.project.features.filter(function (feature) { return feature.layerId !== layerId; });
        if (self.activeLayerId === layerId) {
          self.activeLayerId = "drawing";
        }
      }
    });
  };

  FloorPlanEditor.prototype.addLayer = function () {
    var self = this;
    this.mutate("CreateLayer", function () {
      var layer = { id: geom.uid("layer"), name: "Layer baru", type: "drawing", visible: true, locked: false, opacity: 1 };
      self.project.layers.push(layer);
      self.activeLayerId = layer.id;
    });
  };

  FloorPlanEditor.prototype.openContextMenu = function (event) {
    event.preventDefault();
    var featureElement = event.target.closest(".floor-feature,.floor-control");
    if (!featureElement) {
      return;
    }
    this.menuFeatureId = featureElement.getAttribute("data-id");
    this.menuVertexIndex = featureElement.classList.contains("floor-control") ? Number(featureElement.getAttribute("data-index")) : null;
    this.selectedId = this.menuFeatureId;
    this.selectedVertex = this.menuVertexIndex;
    this.contextMenu.innerHTML = [
      "<button type=\"button\" data-floor-action=\"properties\">Properties</button>",
      "<button type=\"button\" data-floor-action=\"addVertex\">Add Vertex</button>",
      "<button type=\"button\" data-floor-action=\"deleteVertex\">Delete Vertex</button>",
      "<button type=\"button\" data-floor-action=\"duplicate\">Duplicate</button>",
      "<button type=\"button\" data-floor-action=\"bringForward\">Bring Forward</button>",
      "<button type=\"button\" data-floor-action=\"sendBackward\">Send Backward</button>",
      "<button type=\"button\" data-floor-action=\"rotate90\">Rotate 90</button>",
      "<button type=\"button\" data-floor-action=\"delete\">Delete</button>"
    ].join("");
    this.contextMenu.style.left = event.offsetX + "px";
    this.contextMenu.style.top = event.offsetY + "px";
    this.contextMenu.hidden = false;
    this.render();
  };

  FloorPlanEditor.prototype.handleMenuAction = function (action) {
    var self = this;
    if (action === "delete") {
      this.deleteSelected();
    } else if (action === "duplicate") {
      this.duplicateSelected();
    } else if (action === "rotate90") {
      this.rotateSelected(90);
    } else if (action === "bringForward" || action === "sendBackward") {
      this.mutate("ReorderObject", function () {
        var index = self.project.features.findIndex(function (feature) { return feature.id === self.selectedId; });
        if (index < 0) {
          return;
        }
        var next = action === "bringForward" ? Math.min(self.project.features.length - 1, index + 1) : Math.max(0, index - 1);
        self.project.features.splice(next, 0, self.project.features.splice(index, 1)[0]);
      });
    } else if (action === "addVertex") {
      this.addVertexToSelected();
    } else if (action === "deleteVertex") {
      this.deleteVertexFromSelected();
    }
    this.contextMenu.hidden = true;
  };

  FloorPlanEditor.prototype.rotateSelected = function (degrees) {
    var self = this;
    var selected = this.selectedFeature();
    if (!selected) {
      return;
    }
    this.mutate("RotateObject", function () {
      var rotated = geom.rotateFeature(selected, degrees);
      Object.assign(selected, rotated);
      selected.updatedAt = nowIso();
      self.selectedId = selected.id;
    });
  };

  FloorPlanEditor.prototype.addVertexToSelected = function () {
    var selected = this.selectedFeature();
    if (!selected || selected.geometry.coordinates.length < 2) {
      return;
    }
    var self = this;
    this.mutate("AddVertex", function () {
      var index = self.selectedVertex !== null ? self.selectedVertex : 0;
      var coords = selected.geometry.coordinates;
      var next = coords[(index + 1) % coords.length] || coords[index];
      coords.splice(index + 1, 0, geom.midpoint(coords[index], next));
      selected.updatedAt = nowIso();
    });
  };

  FloorPlanEditor.prototype.deleteVertexFromSelected = function () {
    var selected = this.selectedFeature();
    if (!selected || this.selectedVertex === null) {
      return;
    }
    var min = selected.geometry.type === "Polygon" ? 3 : 2;
    if (selected.geometry.coordinates.length <= min) {
      return;
    }
    var self = this;
    this.mutate("DeleteVertex", function () {
      selected.geometry.coordinates.splice(self.selectedVertex, 1);
      self.selectedVertex = null;
      selected.updatedAt = nowIso();
    });
  };

  FloorPlanEditor.prototype.currentCadTolerance = function () {
    var pixelTolerance = this.viewBox.w / Math.max(1, this.svg.clientWidth || 1) * 14;
    return Math.max(Number(this.project.settings.geometryTolerance || 0.000001), pixelTolerance);
  };

  FloorPlanEditor.prototype.promptWorldPoint = function (label, fallback) {
    var base = fallback || geom.point(0, 0);
    var x = this.promptNumber(label + " X", base.x);
    if (x === null) {
      return null;
    }
    var y = this.promptNumber(label + " Y", base.y);
    if (y === null) {
      return null;
    }
    return geom.point(x, y);
  };

  FloorPlanEditor.prototype.replaceCadFeatures = function (removeIds, addFeatures, selectedId) {
    var self = this;
    this.mutate("CadOperation", function () {
      self.project.features = self.project.features.filter(function (feature) {
        return removeIds.indexOf(feature.id) < 0;
      });
      (addFeatures || []).forEach(function (feature) {
        feature.createdAt = feature.createdAt || nowIso();
        feature.updatedAt = nowIso();
        feature.style = Object.assign(defaultFeatureStyle(feature.geometry.type, feature.layerId), feature.style || {});
        self.project.features.push(feature);
      });
      self.selectedId = selectedId || (addFeatures && addFeatures[0] ? addFeatures[0].id : "");
      self.selectedVertex = null;
    });
  };

  FloorPlanEditor.prototype.handleCadAction = function (action) {
    if (!cadOps) {
      window.alert("Modul CAD ops belum tersedia.");
      return;
    }
    var selected = this.selectedFeature();
    if (!selected) {
      window.alert("Pilih objek line/polyline/polygon terlebih dahulu.");
      return;
    }
    var type = selected.geometry && selected.geometry.type;
    var coords = selected.geometry.coordinates || [];
    var tolerance = this.currentCadTolerance();
    var fallback = coords[0] || geom.point(0, 0);
    if (action === "split") {
      var splitPoint = this.promptWorldPoint("Titik split", fallback);
      if (!splitPoint) {
        return;
      }
      var splitResult = cadOps.splitFeatureAtPoint(selected, splitPoint, tolerance);
      if (!splitResult) {
        window.alert("Split gagal. Titik harus dekat segment objek.");
        return;
      }
      this.replaceCadFeatures([selected.id], splitResult.features, splitResult.features[0].id);
    } else if (action === "trim") {
      var trimPoint = this.promptWorldPoint("Titik trim", fallback);
      if (!trimPoint) {
        return;
      }
      var cutters = visibleFeatures(this.project).filter(function (feature) {
        return feature.id !== selected.id;
      });
      var trimmed = cadOps.trimFeatureAtCutters(selected, cutters, trimPoint, tolerance);
      if (!trimmed) {
        window.alert("Trim gagal. Pastikan objek berpotongan dengan cutter.");
        return;
      }
      this.replaceCadFeatures([selected.id], [trimmed], trimmed.id);
    } else if (action === "extend") {
      if (type !== "Polyline" && type !== "LineString") {
        window.alert("Extend hanya untuk line/polyline.");
        return;
      }
      var endpoint = String(window.prompt("Endpoint yang diperpanjang: start atau end", "end") || "end").toLowerCase();
      if (endpoint !== "start") {
        endpoint = "end";
      }
      var targets = visibleFeatures(this.project).filter(function (feature) {
        return feature.id !== selected.id;
      });
      var extended = cadOps.extendFeatureToTargets(selected, targets, endpoint, 1000000);
      if (!extended) {
        window.alert("Extend gagal. Tidak ada target pada arah endpoint.");
        return;
      }
      this.replaceCadFeatures([selected.id], [extended], extended.id);
    } else if (action === "join") {
      if (type !== "Polyline" && type !== "LineString") {
        window.alert("Join hanya untuk line/polyline.");
        return;
      }
      var selectedStart = coords[0];
      var selectedEnd = coords[coords.length - 1];
      var candidates = visibleFeatures(this.project).filter(function (feature) {
        if (feature.id === selected.id || !feature.geometry) {
          return false;
        }
        var featureType = feature.geometry.type;
        if (featureType !== "Polyline" && featureType !== "LineString") {
          return false;
        }
        var points = feature.geometry.coordinates || [];
        if (points.length < 2) {
          return false;
        }
        return geom.distance(selectedStart, points[0]) <= tolerance ||
          geom.distance(selectedStart, points[points.length - 1]) <= tolerance ||
          geom.distance(selectedEnd, points[0]) <= tolerance ||
          geom.distance(selectedEnd, points[points.length - 1]) <= tolerance;
      });
      var joined = cadOps.joinFeatures([selected].concat(candidates), tolerance);
      if (!joined) {
        window.alert("Join gagal. Endpoint objek harus saling berdekatan.");
        return;
      }
      this.replaceCadFeatures([selected.id].concat(candidates.map(function (feature) { return feature.id; })), [joined], joined.id);
    } else if (action === "offset") {
      var distance = this.promptNumber("Jarak offset dalam unit gambar", 0.5);
      if (distance === null) {
        return;
      }
      var side = String(window.prompt("Sisi offset: left atau right", "left") || "left").toLowerCase() === "right" ? "right" : "left";
      var offset = cadOps.offsetPolyline(selected, distance, side);
      if (!offset) {
        window.alert("Offset gagal. Pilih line/polyline/polygon dengan minimal dua titik.");
        return;
      }
      offset.properties = Object.assign({}, offset.properties || {}, { operation: "offset-experimental", offsetDistance: distance, offsetSide: side });
      this.replaceCadFeatures([], [offset], offset.id);
    }
  };

  FloorPlanEditor.prototype.importReference = function (file) {
    if (!file) {
      return;
    }
    var self = this;
    if (file.type === "application/pdf") {
      window.alert("PDF disimpan sebagai reference non-destruktif. Ekstraksi vector PDF belum aktif; untuk tracing visual paling stabil gunakan JPG/PNG/WebP hasil scan.");
    }
    io.readFileAsDataUrl(file).then(function (dataUrl) {
      self.mutate("ImportReference", function () {
        self.project.reference = {
          id: geom.uid("reference"),
          name: file.name,
          mimeType: file.type,
          sourceKind: file.type === "application/pdf" ? "pdf-reference" : "raster-reference",
          vectorExtracted: false,
          dataUrl: dataUrl,
          x: 0,
          y: 0,
          width: self.project.settings.width,
          height: self.project.settings.height,
          opacity: 0.45,
          brightness: 1,
          contrast: 1,
          grayscale: false,
          invert: false,
          rotation: 0,
          locked: true
        };
        var layer = ensureLayer(self.project, "reference");
        layer.visible = true;
        layer.locked = true;
        layer.opacity = 0.45;
      });
    });
  };

  FloorPlanEditor.prototype.importDrawing = function (file) {
    if (!file) {
      return;
    }
    var self = this;
    io.readFileAsText(file).then(function (text) {
      var lower = file.name.toLowerCase();
      if (lower.endsWith(".dwg") || lower.endsWith(".dgn")) {
        window.alert("DWG/DGN belum bisa dibaca langsung oleh browser tanpa converter CAD eksternal. Konversikan dulu ke DXF, lalu import file DXF ke editor ini.");
        return;
      }
      var internal = lower.endsWith(".json") ? io.importInternal(text) : null;
      if (internal) {
        self.project = normalizeProject(internal);
        self.project.scopeKey = self.context.scopeKey;
        self.project.buildingId = self.context.buildingId;
        self.syncInputs();
        self.markDirty();
        self.zoomExtent();
        self.render();
        return;
      }
      var features = lower.endsWith(".dxf")
        ? io.importDxf(text, self.currentLayerId())
        : (lower.endsWith(".kml") ? io.importKml(text, self.currentLayerId()) : io.importGeoJson(text, self.currentLayerId()));
      self.mutate("ImportDrawing", function () {
        features.forEach(function (feature) {
          feature.id = feature.id || geom.uid("feature");
          feature.createdAt = feature.createdAt || nowIso();
          feature.updatedAt = nowIso();
          feature.style = Object.assign(defaultFeatureStyle(feature.geometry.type, feature.layerId), feature.style || {});
          self.project.features.push(feature);
        });
      });
    }).catch(function (error) {
      window.alert(error.message || "Import drawing gagal.");
    });
  };

  FloorPlanEditor.prototype.exportSelected = function () {
    var format = this.mount.querySelector("#floorExportInput").value;
    var exportMode = this.mount.querySelector("#floorExportModeInput").value;
    var targetCrs = this.mount.querySelector("#floorExportCrsInput").value;
    var options = { coordinateMode: exportMode, targetCrs: targetCrs };
    var baseName = "floor-plan-" + (this.project.buildingId || "main");
    if (format === "json") {
      io.downloadText(baseName + ".json", JSON.stringify(this.project, null, 2), "application/json");
    } else if (format === "svg") {
      io.downloadText(baseName + ".svg", io.projectToSvg(this.project, options), "image/svg+xml");
    } else if (format === "geojson") {
      io.downloadText(baseName + ".geojson", JSON.stringify(io.projectToGeoJson(this.project, options), null, 2), "application/geo+json");
    } else if (format === "kml") {
      io.downloadText(baseName + ".kml", io.projectToKml(this.project, options), "application/vnd.google-earth.kml+xml");
    } else if (format === "dxf") {
      io.downloadText(baseName + ".dxf", io.projectToDxf(this.project, options), "application/dxf");
    } else if (format === "png") {
      io.exportPng(this.svg, baseName + ".png");
    }
  };

  FloorPlanEditor.prototype.syncSelectedToFacilityPlan = function () {
    var selected = this.selectedFeature();
    if (!selected || selected.geometry.type !== "Polygon") {
      window.alert("Pilih polygon ruangan terlebih dahulu.");
      return;
    }
    if (!window.MpmFacilityManagement || typeof window.MpmFacilityManagement.upsertPlanZoneFromDrawing !== "function") {
      window.alert("Bridge fasilitas belum tersedia.");
      return;
    }
    var name = window.prompt("Nama ruang/blok untuk analisa", selected.name || "Ruang baru");
    if (!name) {
      return;
    }
    selected.name = name;
    var result = window.MpmFacilityManagement.upsertPlanZoneFromDrawing({
      name: name,
      kind: "prayer",
      points: selected.geometry.coordinates
    });
    if (!result || !result.success) {
      window.alert(result && result.error ? result.error : "Gagal mengirim polygon ke denah.");
    } else {
      this.render();
    }
  };

  FloorPlanEditor.prototype.toggleFullscreen = function () {
    this.root.classList.toggle("is-fullscreen");
    this.mount.querySelector("#floorFullscreenButton").textContent = this.root.classList.contains("is-fullscreen") ? "Exit Fullscreen" : "Enter Fullscreen";
    this.render();
  };

  FloorPlanEditor.prototype.updateSnapBadge = function (event) {
    if (!this.snapHint || !event) {
      this.snapBadge.hidden = true;
      return;
    }
    this.snapBadge.hidden = false;
    this.snapBadge.textContent = "snap: " + this.snapHint.kind;
    this.snapBadge.style.left = (event.offsetX + 12) + "px";
    this.snapBadge.style.top = (event.offsetY + 12) + "px";
  };

  function boot() {
    var mount = document.getElementById("floorPlanEditorMount");
    if (!mount || !geom || !io) {
      return;
    }
    var editor = new FloorPlanEditor(mount);
    window.MpmFloorPlanEditor = editor;
    function load() {
      var context = window.MpmFacilityManagement && window.MpmFacilityManagement.getDrawingContext
        ? window.MpmFacilityManagement.getDrawingContext()
        : { scopeKey: "manual-local", buildingId: "main", buildingName: "", plan: { length: 30, width: 20 } };
      editor.loadForContext(context);
    }
    window.addEventListener(READY_EVENT, function (event) {
      editor.loadForContext(event.detail || {});
    });
    window.addEventListener("mpm:facility-plan-updated", function () {
      editor.saveAuto();
    });
    window.setTimeout(load, 600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window, document);
