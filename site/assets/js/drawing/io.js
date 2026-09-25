(function (window, document) {
  "use strict";

  var geom = window.MpmDrawingGeometry;
  var transform = window.MpmDrawingTransform;

  function escapeXml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function downloadText(fileName, content, type) {
    var blob = new Blob([content], { type: type || "text/plain" });
    downloadBlob(fileName, blob);
  }

  function downloadBlob(fileName, blob) {
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function featureStyle(feature) {
    var style = feature.style || {};
    return {
      stroke: style.stroke || "#116653",
      fill: style.fill || (feature.geometry.type === "Polygon" ? "rgba(17,102,83,0.12)" : "none"),
      strokeWidth: Number(style.strokeWidth || 0.08),
      opacity: Number(style.opacity || 1)
    };
  }

  function pointsAttribute(points) {
    return (points || []).map(function (point) {
      return geom.round(point.x, 6) + "," + geom.round(point.y, 6);
    }).join(" ");
  }

  function arcPath(center, radius, startDeg, endDeg) {
    var start = geom.arcSamples(center, radius, startDeg, startDeg, 1)[0];
    var end = geom.arcSamples(center, radius, endDeg, endDeg, 1)[0];
    var delta = geom.normalizedArcDelta(startDeg, endDeg);
    var largeArc = delta > 180 ? 1 : 0;
    return "M " + start.x + " " + start.y + " A " + radius + " " + radius + " 0 " + largeArc + " 1 " + end.x + " " + end.y;
  }

  function transformFeatureCrs(feature, source, target) {
    if (!transform || !source || !target || source === target) {
      return feature;
    }
    var copy = geom.clone(feature);
    copy.geometry.coordinates = (copy.geometry.coordinates || []).map(function (point) {
      return transform.transformCrs(point, source, target);
    });
    if (copy.geometry.endPoint) {
      copy.geometry.endPoint = transform.transformCrs(copy.geometry.endPoint, source, target);
    }
    if (copy.properties && copy.properties.endPoint) {
      copy.properties.endPoint = transform.transformCrs(copy.properties.endPoint, source, target);
    }
    if (copy.geometry.type === "Circle" && copy.geometry.coordinates.length >= 2) {
      copy.geometry.radius = geom.distance(copy.geometry.coordinates[0], copy.geometry.coordinates[1]);
    }
    if (copy.geometry.type === "Arc" && copy.geometry.coordinates.length >= 2) {
      var center = copy.geometry.coordinates[0];
      var start = copy.geometry.coordinates[1];
      var end = copy.geometry.endPoint || (copy.properties && copy.properties.endPoint) || start;
      copy.geometry.radius = geom.distance(center, start);
      copy.geometry.startAngle = Math.atan2(start.y - center.y, start.x - center.x) * 180 / Math.PI;
      copy.geometry.endAngle = Math.atan2(end.y - center.y, end.x - center.x) * 180 / Math.PI;
    }
    return copy;
  }

  function projectForExport(project, options) {
    var opts = options || {};
    var georef = project.metadata && project.metadata.georeference ? project.metadata.georeference : {};
    var source = project;
    var coordinateSpace = "local-meter";
    var sourceCrs = georef.mapCrs || "LOCAL";
    if (opts.coordinateMode === "georeferenced" && transform && georef.transform && georef.transform.matrix) {
      source = transform.transformProject(project, georef.transform.matrix);
      coordinateSpace = "georeferenced";
      if (opts.targetCrs && sourceCrs !== opts.targetCrs && sourceCrs !== "LOCAL") {
        source = geom.clone(source);
        source.features = (source.features || []).map(function (feature) {
          return transformFeatureCrs(feature, sourceCrs, opts.targetCrs);
        });
        sourceCrs = opts.targetCrs;
      }
    }
    if (source === project) {
      source = geom.clone(project);
    }
    source.coordinateSpace = coordinateSpace;
    source.exportCrs = coordinateSpace === "georeferenced" ? sourceCrs : "LOCAL";
    return source;
  }

  function featureToSvg(feature) {
    var style = featureStyle(feature);
    var geometry = feature.geometry || {};
    var coords = geometry.coordinates || [];
    var common = " data-id=\"" + escapeXml(feature.id) + "\" stroke=\"" + escapeXml(style.stroke) + "\" fill=\"" + escapeXml(style.fill) + "\" stroke-width=\"" + style.strokeWidth + "\" opacity=\"" + style.opacity + "\" vector-effect=\"non-scaling-stroke\"";
    if (geometry.type === "Point") {
      var point = coords[0] || { x: 0, y: 0 };
      return "<circle" + common + " cx=\"" + point.x + "\" cy=\"" + point.y + "\" r=\"0.14\"></circle>";
    }
    if (geometry.type === "LineString" || geometry.type === "Polyline") {
      return "<polyline" + common + " points=\"" + pointsAttribute(coords) + "\"></polyline>";
    }
    if (geometry.type === "Polygon") {
      return "<polygon" + common + " points=\"" + pointsAttribute(coords) + "\"></polygon>";
    }
    if (geometry.type === "Circle" && coords.length >= 2) {
      return "<circle" + common + " cx=\"" + coords[0].x + "\" cy=\"" + coords[0].y + "\" r=\"" + geom.distance(coords[0], coords[1]) + "\"></circle>";
    }
    if (geometry.type === "Arc" && coords.length >= 2) {
      var radius = Number(geometry.radius || (feature.properties && feature.properties.radius) || geom.distance(coords[0], coords[1]));
      return "<path" + common + " fill=\"none\" d=\"" + arcPath(coords[0], radius, geometry.startAngle || 0, geometry.endAngle || 0) + "\"></path>";
    }
    if (geometry.type === "BezierCurve" && coords.length >= 4) {
      return "<path" + common + " fill=\"none\" d=\"M " + coords[0].x + " " + coords[0].y + " C " + coords[1].x + " " + coords[1].y + ", " + coords[2].x + " " + coords[2].y + ", " + coords[3].x + " " + coords[3].y + "\"></path>";
    }
    if (geometry.type === "TextAnnotation") {
      var textPoint = coords[0] || { x: 0, y: 0 };
      return "<text x=\"" + textPoint.x + "\" y=\"" + textPoint.y + "\" font-size=\"0.55\" fill=\"" + escapeXml(style.stroke) + "\">" + escapeXml(feature.text || feature.name || "Text") + "</text>";
    }
    return "";
  }

  function projectToSvg(project, options) {
    var exportProject = projectForExport(project, options);
    var settings = exportProject.settings || {};
    var width = Number(settings.width || 30);
    var height = Number(settings.height || 20);
    var viewBox = "0 0 " + width + " " + height;
    if (exportProject.coordinateSpace === "georeferenced") {
      var points = [];
      (exportProject.features || []).forEach(function (feature) {
        points = points.concat(geom.featureVertices(feature));
      });
      if (points.length) {
        var box = geom.bounds(points);
        var pad = Math.max(box.w, box.h) * 0.05 || 1;
        viewBox = [box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2].join(" ");
      }
    }
    var reference = exportProject.reference || null;
    var ref = reference && reference.dataUrl
      ? "<image href=\"" + escapeXml(reference.dataUrl) + "\" x=\"" + (reference.x || 0) + "\" y=\"" + (reference.y || 0) + "\" width=\"" + (reference.width || width) + "\" height=\"" + (reference.height || height) + "\" opacity=\"" + Number(reference.opacity || 0.45) + "\"></image>"
      : "";
    var body = (exportProject.features || []).map(featureToSvg).join("");
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"" + viewBox + "\">" + ref + body + "</svg>";
  }

  function geometryToGeoJson(feature) {
    var geometry = feature.geometry || {};
    var coords = geometry.coordinates || [];
    if (geometry.type === "Point") {
      return { type: "Point", coordinates: [coords[0].x, coords[0].y] };
    }
    if (geometry.type === "Polygon") {
      var ring = coords.map(function (point) { return [point.x, point.y]; });
      if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
        ring.push(ring[0]);
      }
      return { type: "Polygon", coordinates: [ring] };
    }
    if (geometry.type === "Circle" && coords.length >= 2) {
      var circle = geom.circleSamples(coords[0], geom.distance(coords[0], coords[1]), 72).map(function (point) { return [point.x, point.y]; });
      if (circle.length) {
        circle.push(circle[0]);
      }
      return { type: "LineString", coordinates: circle };
    }
    if (geometry.type === "Arc" && coords.length >= 2) {
      var radius = Number(geometry.radius || (feature.properties && feature.properties.radius) || geom.distance(coords[0], coords[1]));
      return { type: "LineString", coordinates: geom.arcSamples(coords[0], radius, geometry.startAngle || 0, geometry.endAngle || 0, 48).map(function (point) { return [point.x, point.y]; }) };
    }
    if (geometry.type === "BezierCurve") {
      return { type: "LineString", coordinates: geom.curveSamples(coords, 48).map(function (point) { return [point.x, point.y]; }) };
    }
    if (geometry.type === "TextAnnotation") {
      return { type: "Point", coordinates: coords[0] ? [coords[0].x, coords[0].y] : [0, 0] };
    }
    return { type: "LineString", coordinates: coords.map(function (point) { return [point.x, point.y]; }) };
  }

  function projectToGeoJson(project, options) {
    var exportProject = projectForExport(project, options);
    return {
      type: "FeatureCollection",
      name: exportProject.name || "Floor Plan",
      coordinateSpace: exportProject.coordinateSpace || "local-meter",
      crsCode: exportProject.exportCrs || "LOCAL",
      features: (exportProject.features || []).map(function (feature) {
        return {
          type: "Feature",
          id: feature.id,
          properties: Object.assign({}, feature.properties || {}, {
            name: feature.name || "",
            layerId: feature.layerId,
            objectType: feature.type || feature.geometry.type,
            coordinateSpace: exportProject.coordinateSpace || "local-meter",
            crsCode: exportProject.exportCrs || "LOCAL"
          }),
          geometry: geometryToGeoJson(feature)
        };
      })
    };
  }

  function projectToKml(project, options) {
    var opts = Object.assign({}, options || {});
    if (opts.coordinateMode === "georeferenced") {
      opts.targetCrs = "EPSG:4326";
    }
    var exportProject = projectForExport(project, opts);
    var placemarks = (exportProject.features || []).map(function (feature) {
      var geometry = geometryToGeoJson(feature);
      var coords = [];
      if (geometry.type === "Point") {
        coords = [geometry.coordinates.join(",") + ",0"];
        return "<Placemark><name>" + escapeXml(feature.name || feature.id) + "</name><Point><coordinates>" + coords.join(" ") + "</coordinates></Point></Placemark>";
      }
      if (geometry.type === "Polygon") {
        coords = geometry.coordinates[0].map(function (pair) { return pair.join(",") + ",0"; });
        return "<Placemark><name>" + escapeXml(feature.name || feature.id) + "</name><Polygon><outerBoundaryIs><LinearRing><coordinates>" + coords.join(" ") + "</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>";
      }
      coords = geometry.coordinates.map(function (pair) { return pair.join(",") + ",0"; });
      return "<Placemark><name>" + escapeXml(feature.name || feature.id) + "</name><LineString><coordinates>" + coords.join(" ") + "</coordinates></LineString></Placemark>";
    }).join("");
    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><kml xmlns=\"http://www.opengis.net/kml/2.2\"><Document><name>" + escapeXml(exportProject.name || "Floor Plan") + "</name>" + placemarks + "</Document></kml>";
  }

  function projectToDxf(project, options) {
    var exportProject = projectForExport(project, options);
    var lines = ["0", "SECTION", "2", "ENTITIES"];
    function layerName(feature) {
      return (feature.properties && feature.properties.cadLayer) || feature.layerId || "Drawing";
    }
    function addLine(a, b, layer) {
      lines.push("0", "LINE", "8", layer || "Drawing", "10", String(a.x), "20", String(a.y), "30", "0", "11", String(b.x), "21", String(b.y), "31", "0");
    }
    function addLwPolyline(points, closed, layer) {
      lines.push("0", "LWPOLYLINE", "8", layer || "Drawing", "90", String(points.length), "70", closed ? "1" : "0");
      points.forEach(function (point) {
        lines.push("10", String(point.x), "20", String(point.y), "30", "0");
      });
    }
    function addPoint(point, layer) {
      lines.push("0", "POINT", "8", layer || "Drawing", "10", String(point.x), "20", String(point.y), "30", "0");
    }
    function addText(feature, point, layer) {
      lines.push("0", "TEXT", "8", layer || "Drawing", "10", String(point.x), "20", String(point.y), "30", "0", "40", "0.55", "1", feature.text || feature.name || "Text");
    }
    (exportProject.features || []).forEach(function (feature) {
      var layer = layerName(feature);
      var geometry = feature.geometry || {};
      var coords = geometry.coordinates || [];
      if ((geometry.type === "LineString" || geometry.type === "Polyline") && coords.length === 2) {
        addLine(coords[0], coords[1], layer);
      } else if (geometry.type === "LineString" || geometry.type === "Polyline") {
        addLwPolyline(coords, false, layer);
      } else if (geometry.type === "Polygon") {
        addLwPolyline(coords, true, layer);
      } else if (geometry.type === "BezierCurve") {
        addLwPolyline(geom.curveSamples(coords, 36), false, layer);
      } else if (geometry.type === "Circle" && coords.length >= 2) {
        lines.push("0", "CIRCLE", "8", layer, "10", String(coords[0].x), "20", String(coords[0].y), "30", "0", "40", String(geometry.radius || geom.distance(coords[0], coords[1])));
      } else if (geometry.type === "Arc" && coords.length >= 2) {
        lines.push("0", "ARC", "8", layer, "10", String(coords[0].x), "20", String(coords[0].y), "30", "0", "40", String(geometry.radius || geom.distance(coords[0], coords[1])), "50", String(geometry.startAngle || 0), "51", String(geometry.endAngle || 0));
      } else if (geometry.type === "Point" && coords[0]) {
        addPoint(coords[0], layer);
      } else if (geometry.type === "TextAnnotation" && coords[0]) {
        addText(feature, coords[0], layer);
      }
    });
    lines.push("0", "ENDSEC", "0", "EOF");
    return lines.join("\n");
  }

  function featureFromGeoJson(item, defaultLayerId) {
    var geometry = item.geometry || {};
    var props = item.properties || {};
    var id = item.id || geom.uid("feature");
    if (geometry.type === "Point") {
      return {
        id: id,
        type: "Point",
        name: props.name || "",
        layerId: defaultLayerId,
        geometry: { type: "Point", coordinates: [geom.point(geometry.coordinates[0], geometry.coordinates[1])] },
        properties: props,
        style: {}
      };
    }
    if (geometry.type === "Polygon") {
      var ring = geometry.coordinates && geometry.coordinates[0] ? geometry.coordinates[0] : [];
      if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) {
        ring = ring.slice(0, -1);
      }
      return {
        id: id,
        type: "Polygon",
        name: props.name || "",
        layerId: defaultLayerId,
        geometry: { type: "Polygon", coordinates: ring.map(function (pair) { return geom.point(pair[0], pair[1]); }) },
        properties: props,
        style: {}
      };
    }
    if (geometry.type === "LineString") {
      return {
        id: id,
        type: "Polyline",
        name: props.name || "",
        layerId: defaultLayerId,
        geometry: { type: "Polyline", coordinates: (geometry.coordinates || []).map(function (pair) { return geom.point(pair[0], pair[1]); }) },
        properties: props,
        style: {}
      };
    }
    return null;
  }

  function importGeoJson(text, defaultLayerId) {
    var data = JSON.parse(text);
    var items = data.type === "FeatureCollection" ? data.features || [] : [data];
    return items.map(function (item) {
      return featureFromGeoJson(item, defaultLayerId);
    }).filter(Boolean);
  }

  function importInternal(text) {
    var data = JSON.parse(text);
    return data && data.schemaVersion === "mpm.floor-plan-editor.v1" ? data : null;
  }

  function importKml(text, defaultLayerId) {
    var parser = new DOMParser();
    var xml = parser.parseFromString(text, "application/xml");
    return Array.prototype.slice.call(xml.querySelectorAll("Placemark")).map(function (placemark) {
      var nameNode = placemark.querySelector("name");
      var name = nameNode ? nameNode.textContent : "";
      var pointNode = placemark.querySelector("Point coordinates");
      var lineNode = placemark.querySelector("LineString coordinates");
      var polygonNode = placemark.querySelector("Polygon coordinates");
      var coordNode = pointNode || lineNode || polygonNode;
      if (!coordNode) {
        return null;
      }
      var coords = coordNode.textContent.trim().split(/\s+/).map(function (part) {
        var pieces = part.split(",");
        return geom.point(Number(pieces[0]), Number(pieces[1]));
      });
      var geometryType = pointNode ? "Point" : (polygonNode ? "Polygon" : "Polyline");
      if (geometryType === "Polygon" && coords.length > 1 && coords[0].x === coords[coords.length - 1].x && coords[0].y === coords[coords.length - 1].y) {
        coords = coords.slice(0, -1);
      }
      return {
        id: geom.uid("feature"),
        type: geometryType,
        name: name,
        layerId: defaultLayerId,
        geometry: { type: geometryType === "Point" ? "Point" : geometryType, coordinates: coords },
        properties: {},
        style: {}
      };
    }).filter(Boolean);
  }

  function dxfNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : (fallback || 0);
  }

  function dxfPairs(text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n");
    var pairs = [];
    for (var index = 0; index < lines.length; index += 2) {
      var code = String(lines[index] || "").trim();
      var value = String(lines[index + 1] || "").trim();
      if (code) {
        pairs.push({ code: code, value: value });
      }
    }
    return pairs;
  }

  function pushDxfEntity(entities, entity) {
    if (entity && entity.type) {
      entities.push(entity);
    }
  }

  function collectDxfEntities(text) {
    var pairs = dxfPairs(text);
    var entities = [];
    var current = null;
    var activePolyline = null;

    function finishVertex() {
      if (!activePolyline || !current || current.type !== "VERTEX") {
        return;
      }
      activePolyline.vertices.push(current.groups);
      current = null;
    }

    function finishCurrent() {
      if (!current) {
        return;
      }
      if (current.type === "VERTEX") {
        finishVertex();
        return;
      }
      if (current.type !== "POLYLINE") {
        pushDxfEntity(entities, current);
      }
      current = null;
    }

    pairs.forEach(function (pair) {
      if (pair.code !== "0") {
        if (current) {
          current.groups.push(pair);
        }
        return;
      }
      var type = pair.value.toUpperCase();
      if (type === "VERTEX" && activePolyline) {
        finishVertex();
        current = { type: "VERTEX", groups: [] };
        return;
      }
      if (type === "SEQEND") {
        finishVertex();
        if (activePolyline) {
          pushDxfEntity(entities, activePolyline);
        }
        activePolyline = null;
        current = null;
        return;
      }
      finishCurrent();
      if (type === "POLYLINE") {
        activePolyline = { type: "POLYLINE", groups: [], vertices: [] };
        current = activePolyline;
        return;
      }
      if (["LINE", "LWPOLYLINE", "POINT", "CIRCLE", "ARC", "TEXT", "MTEXT"].indexOf(type) >= 0) {
        current = { type: type, groups: [] };
      }
    });
    finishCurrent();
    if (activePolyline) {
      pushDxfEntity(entities, activePolyline);
    }
    return entities;
  }

  function firstGroup(groups, code, fallback) {
    var item = (groups || []).find(function (pair) {
      return pair.code === String(code);
    });
    return item ? item.value : fallback;
  }

  function joinedGroups(groups, codes) {
    return (groups || []).filter(function (pair) {
      return codes.indexOf(pair.code) >= 0;
    }).map(function (pair) {
      return pair.value;
    }).join("");
  }

  function dxfPointFromGroups(groups, xCode, yCode) {
    return geom.point(dxfNumber(firstGroup(groups, xCode, 0), 0), dxfNumber(firstGroup(groups, yCode, 0), 0));
  }

  function dxfCommon(entity, defaultLayerId) {
    return {
      id: geom.uid("feature"),
      layerId: defaultLayerId,
      name: "",
      style: {},
      properties: {
        cadLayer: firstGroup(entity.groups, 8, "Drawing"),
        cadEntity: entity.type,
        colorIndex: firstGroup(entity.groups, 62, ""),
        lineWeight: firstGroup(entity.groups, 370, "")
      }
    };
  }

  function dxfPolylinePoints(groups) {
    var points = [];
    var x = null;
    (groups || []).forEach(function (pair) {
      if (pair.code === "10") {
        x = dxfNumber(pair.value, 0);
      } else if (pair.code === "20" && x !== null) {
        points.push(geom.point(x, dxfNumber(pair.value, 0)));
        x = null;
      }
    });
    return points;
  }

  function featureFromDxfEntity(entity, defaultLayerId) {
    var common = dxfCommon(entity, defaultLayerId);
    var layerName = common.properties.cadLayer || "Drawing";
    if (entity.type === "LINE") {
      return Object.assign(common, {
        type: "LineString",
        name: layerName + " LINE",
        geometry: { type: "LineString", coordinates: [dxfPointFromGroups(entity.groups, 10, 20), dxfPointFromGroups(entity.groups, 11, 21)] }
      });
    }
    if (entity.type === "LWPOLYLINE") {
      var points = dxfPolylinePoints(entity.groups);
      var closed = (dxfNumber(firstGroup(entity.groups, 70, 0), 0) & 1) === 1;
      return Object.assign(common, {
        type: closed ? "Polygon" : "Polyline",
        name: layerName + " LWPOLYLINE",
        geometry: { type: closed ? "Polygon" : "Polyline", coordinates: points }
      });
    }
    if (entity.type === "POLYLINE") {
      var polyPoints = (entity.vertices || []).map(function (groups) {
        return dxfPointFromGroups(groups, 10, 20);
      });
      var polyClosed = (dxfNumber(firstGroup(entity.groups, 70, 0), 0) & 1) === 1;
      return Object.assign(common, {
        type: polyClosed ? "Polygon" : "Polyline",
        name: layerName + " POLYLINE",
        geometry: { type: polyClosed ? "Polygon" : "Polyline", coordinates: polyPoints }
      });
    }
    if (entity.type === "POINT") {
      return Object.assign(common, {
        type: "Point",
        name: layerName + " POINT",
        geometry: { type: "Point", coordinates: [dxfPointFromGroups(entity.groups, 10, 20)] }
      });
    }
    if (entity.type === "CIRCLE") {
      var center = dxfPointFromGroups(entity.groups, 10, 20);
      var radius = dxfNumber(firstGroup(entity.groups, 40, 0), 0);
      return Object.assign(common, {
        type: "Circle",
        name: layerName + " CIRCLE",
        geometry: { type: "Circle", coordinates: [center, geom.point(center.x + radius, center.y)], radius: radius }
      });
    }
    if (entity.type === "ARC") {
      var arcCenter = dxfPointFromGroups(entity.groups, 10, 20);
      var arcRadius = dxfNumber(firstGroup(entity.groups, 40, 0), 0);
      var startAngle = dxfNumber(firstGroup(entity.groups, 50, 0), 0);
      var endAngle = dxfNumber(firstGroup(entity.groups, 51, 0), 0);
      var startPoint = geom.arcSamples(arcCenter, arcRadius, startAngle, startAngle, 1)[0];
      var endPoint = geom.arcSamples(arcCenter, arcRadius, endAngle, endAngle, 1)[0];
      common.properties.radius = arcRadius;
      common.properties.endPoint = endPoint;
      return Object.assign(common, {
        type: "Arc",
        name: layerName + " ARC",
        geometry: { type: "Arc", coordinates: [arcCenter, startPoint], radius: arcRadius, startAngle: startAngle, endAngle: endAngle, endPoint: endPoint }
      });
    }
    if (entity.type === "TEXT" || entity.type === "MTEXT") {
      var text = joinedGroups(entity.groups, ["1", "3"]) || "Text";
      return Object.assign(common, {
        type: "TextAnnotation",
        name: text,
        text: text,
        geometry: { type: "TextAnnotation", coordinates: [dxfPointFromGroups(entity.groups, 10, 20)] }
      });
    }
    return null;
  }

  function importDxf(text, defaultLayerId) {
    return collectDxfEntities(text).map(function (entity) {
      return featureFromDxfEntity(entity, defaultLayerId);
    }).filter(function (feature) {
      return feature && feature.geometry && (feature.geometry.coordinates || []).length;
    });
  }

  function exportPng(svgElement, fileName) {
    var source = new XMLSerializer().serializeToString(svgElement);
    var svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    var url = URL.createObjectURL(svgBlob);
    var image = new Image();
    return new Promise(function (resolve, reject) {
      image.onload = function () {
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1200, svgElement.clientWidth || 1200);
        canvas.height = Math.max(800, svgElement.clientHeight || 800);
        var context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (!blob) {
            reject(new Error("PNG export gagal."));
            return;
          }
          downloadBlob(fileName, blob);
          resolve();
        }, "image/png");
      };
      image.onerror = reject;
      image.src = url;
    });
  }

  window.MpmDrawingIO = {
    downloadText: downloadText,
    downloadBlob: downloadBlob,
    readFileAsText: readFileAsText,
    readFileAsDataUrl: readFileAsDataUrl,
    projectToSvg: projectToSvg,
    projectToGeoJson: projectToGeoJson,
    projectToKml: projectToKml,
    projectToDxf: projectToDxf,
    importInternal: importInternal,
    importGeoJson: importGeoJson,
    importKml: importKml,
    importDxf: importDxf,
    exportPng: exportPng
  };
})(window, document);
