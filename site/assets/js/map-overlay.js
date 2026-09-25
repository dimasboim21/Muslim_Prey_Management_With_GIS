(function (window, document) {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var XLINK_NS = "http://www.w3.org/1999/xlink";
  var DEFAULT_VIEWBOX = "0 0 1000 500";
  var DEFAULT_KAABAH = { lat: 21.422487, lon: 39.826206 };

  function MapOverlay(container, options) {
    if (!(container instanceof HTMLElement)) {
      throw new Error("MapOverlay requires a valid DOM container element.");
    }
    this._container = container;
    this._options = Object.assign({
      viewBox: DEFAULT_VIEWBOX,
      kaabah: DEFAULT_KAABAH,
      svgSrc: "assets/svg/map-overlay.svg",
      iconBase: "map/places",
      language: "en",
      onPointChange: null
    }, options || {});
    this._svg = null;
    this._refs = {};
    this._point = null;
    this._source = null;
    this._buildingType = "mosque";
    this._buildingName = "";
    this._initialized = false;
  }

  MapOverlay.prototype.projectPoint = function (point) {
    var parts = this._options.viewBox.split(" ");
    var w = parseFloat(parts[2]) || 1000;
    var h = parseFloat(parts[3]) || 500;
    var x = ((point.lon + 180) / 360) * w;
    var y = ((90 - point.lat) / 180) * h;
    return { x: x, y: y };
  };

  MapOverlay.prototype._qs = function (id) {
    return this._svg ? this._svg.querySelector("#" + id) : null;
  };

  MapOverlay.prototype._setImageHref = function (image, path) {
    image.setAttribute("href", path);
    image.setAttributeNS(XLINK_NS, "href", path);
  };

  MapOverlay.prototype._iconPath = function (type) {
    return this._options.iconBase + "/" + (type || "mosque.png");
  };

  MapOverlay.prototype._sourceIconPath = function (source) {
    return this._options.iconBase + "/" + (String(source).indexOf("ip") !== -1 ? "ip-pin.png" : "gps-pinpoint.png");
  };

  MapOverlay.prototype._hide = function (el) {
    if (el) { el.classList.add("is-hidden"); }
  };

  MapOverlay.prototype._show = function (el) {
    if (el) { el.classList.remove("is-hidden"); }
  };

  MapOverlay.prototype._updateQibla = function (buildingPoint, kaabahPoint) {
    var line = this._refs.qiblaLine;
    var label = this._refs.qiblaLabel;
    if (!line || !label) { return; }
    line.setAttribute("x1", buildingPoint.x.toFixed(2));
    line.setAttribute("y1", buildingPoint.y.toFixed(2));
    line.setAttribute("x2", kaabahPoint.x.toFixed(2));
    line.setAttribute("y2", kaabahPoint.y.toFixed(2));
    this._show(line);
    var midpoint = {
      x: (buildingPoint.x + kaabahPoint.x) / 2,
      y: (buildingPoint.y + kaabahPoint.y) / 2 - 8
    };
    label.setAttribute("x", midpoint.x.toFixed(2));
    label.setAttribute("y", midpoint.y.toFixed(2));
    this._show(label);
  };

  MapOverlay.prototype._hideQibla = function () {
    this._hide(this._refs.qiblaLine);
    this._hide(this._refs.qiblaLabel);
  };

  MapOverlay.prototype.setKaabah = function (lat, lon) {
    this._options.kaabah = { lat: lat, lon: lon };
    if (this._svg) {
      var kp = this.projectPoint(this._options.kaabah);
      var kaabah = this._refs.kaabahMarker;
      if (kaabah) {
        kaabah.setAttribute("transform", "translate(" + kp.x.toFixed(2) + "," + kp.y.toFixed(2) + ")");
        this._show(kaabah);
      }
    }
  };

  MapOverlay.prototype.setBuildingPoint = function (lat, lon, buildingType, buildingName) {
    this._point = { lat: lat, lon: lon };
    this._buildingType = buildingType || "mosque";
    this._buildingName = buildingName || "";
    if (!this._svg) { return; }
    var bp = this.projectPoint(this._point);
    var building = this._refs.buildingMarker;
    var source = this._refs.sourceMarker;
    if (building) {
      building.setAttribute("transform", "translate(" + bp.x.toFixed(2) + "," + bp.y.toFixed(2) + ")");
      this._show(building);
    }
    if (source) {
      source.setAttribute("transform", "translate(" + bp.x.toFixed(2) + "," + bp.y.toFixed(2) + ")");
      this._show(source);
    }
    var icon = this._qs("overlay-building-icon");
    if (icon) { this._setImageHref(icon, this._iconPath(this._buildingType)); }
    var label = this._refs.buildingLabel;
    if (label) {
      label.textContent = this._buildingName || "Building";
    }
    if (this._point && this._options.kaabah) {
      var kp = this.projectPoint(this._options.kaabah);
      this._updateQibla(bp, kp);
    }
  };

  MapOverlay.prototype.setSourcePoint = function (lat, lon, sourceType) {
    this._source = { lat: lat, lon: lon };
    if (!this._svg) { return; }
    var sp = this.projectPoint(this._source);
    var source = this._refs.sourceMarker;
    if (source) {
      source.setAttribute("transform", "translate(" + sp.x.toFixed(2) + "," + sp.y.toFixed(2) + ")");
      this._show(source);
    }
    var icon = this._qs("overlay-source-icon");
    if (icon) { this._setImageHref(icon, this._sourceIconPath(sourceType)); }
  };

  MapOverlay.prototype.clearBuildingPoint = function () {
    this._point = null;
    if (!this._svg) { return; }
    this._hide(this._refs.buildingMarker);
    this._hide(this._refs.sourceMarker);
    this._hideQibla();
  };

  MapOverlay.prototype.clearSourcePoint = function () {
    this._source = null;
    if (!this._svg) { return; }
    this._hide(this._refs.sourceMarker);
  };

  MapOverlay.prototype.getPoint = function () {
    return this._point;
  };

  MapOverlay.prototype.getKaabah = function () {
    return this._options.kaabah;
  };

  MapOverlay.prototype.updateLabel = function (text) {
    if (this._refs.buildingLabel) {
      this._refs.buildingLabel.textContent = text || "";
    }
  };

  MapOverlay.prototype.setLanguage = function (lang) {
    this._options.language = lang;
  };

  MapOverlay.prototype._bindEvents = function () {
    var self = this;
    this._container.addEventListener("click", function (event) {
      var target = event.target.closest("[data-overlay-marker]");
      if (target) { return; }
      var rect = self._container.getBoundingClientRect();
      if (!rect.width || !rect.height) { return; }
      var x = (event.clientX - rect.left) / rect.width * 1000;
      var y = (event.clientY - rect.top) / rect.height * 500;
      var lon = x / 1000 * 360 - 180;
      var lat = 90 - y / 500 * 180;
      if (typeof self._options.onPointChange === "function") {
        self._options.onPointChange({ lat: lat, lon: lon });
      }
    });
  };

  MapOverlay.prototype.destroy = function () {
    if (this._svg && this._svg.parentNode) {
      this._svg.parentNode.removeChild(this._svg);
    }
    this._svg = null;
    this._refs = {};
    this._initialized = false;
  };

  MapOverlay.prototype._initFromSvgElement = function (svgEl) {
    this._svg = svgEl;
    this._refs.qiblaLine = this._qs("overlay-qibla-line");
    this._refs.qiblaLabel = this._qs("overlay-qibla-label");
    this._refs.sourceMarker = this._qs("overlay-source-marker");
    this._refs.buildingMarker = this._qs("overlay-building-marker");
    this._refs.kaabahMarker = this._qs("overlay-kaabah-marker");
    this._refs.buildingIcon = this._qs("overlay-building-icon");
    this._refs.sourceIcon = this._qs("overlay-source-icon");
    this._refs.buildingLabel = this._qs("overlay-building-label");
    this._initialized = true;
  };

  MapOverlay.prototype._initFromFetch = function () {
    var self = this;
    return fetch(this._options.svgSrc)
      .then(function (response) {
        if (!response.ok) { throw new Error("SVG fetch failed: " + response.status); }
        return response.text();
      })
      .then(function (svgText) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(svgText, "image/svg+xml");
        var svgEl = doc.documentElement;
        svgEl.setAttribute("id", "mapOverlay");
        svgEl.style.position = "absolute";
        svgEl.style.inset = "0";
        svgEl.style.width = "100%";
        svgEl.style.height = "100%";
        svgEl.style.zIndex = "2";
        svgEl.style.touchAction = "manipulation";
        svgEl.style.overflow = "visible";
        svgEl.style.pointerEvents = "none";
        self._container.appendChild(svgEl);
        self._initFromSvgElement(svgEl);
        self.setKaabah(self._options.kaabah.lat, self._options.kaabah.lon);
        return self;
      });
  };

  MapOverlay.prototype.init = function () {
    var self = this;
    if (this._initialized) { return Promise.resolve(this); }
    if (this._container.querySelector("svg")) {
      var existing = this._container.querySelector("svg");
      this._initFromSvgElement(existing);
      this.setKaabah(this._options.kaabah.lat, this._options.kaabah.lon);
      this._bindEvents();
      return Promise.resolve(this);
    }
    return this._initFromFetch().then(function () {
      self._bindEvents();
      return self;
    });
  };

  MapOverlay.prototype.getSvgElement = function () {
    return this._svg;
  };

  window.MapOverlay = MapOverlay;
})(window, document);