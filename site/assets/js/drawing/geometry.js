(function (window) {
  "use strict";

  var DIRECTIONS_16 = [
    ["N", "Utara"],
    ["NNE", "Utara-Timur Laut"],
    ["NE", "Timur Laut"],
    ["ENE", "Timur-Timur Laut"],
    ["E", "Timur"],
    ["ESE", "Timur-Tenggara"],
    ["SE", "Tenggara"],
    ["SSE", "Selatan-Tenggara"],
    ["S", "Selatan"],
    ["SSW", "Selatan-Barat Daya"],
    ["SW", "Barat Daya"],
    ["WSW", "Barat-Barat Daya"],
    ["W", "Barat"],
    ["WNW", "Barat-Barat Laut"],
    ["NW", "Barat Laut"],
    ["NNW", "Utara-Barat Laut"]
  ];

  function uid(prefix) {
    return (prefix || "obj") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function point(x, y) {
    return { x: Number(x) || 0, y: Number(y) || 0 };
  }

  function distance(a, b) {
    return Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0));
  }

  function midpoint(a, b) {
    return point(((a.x || 0) + (b.x || 0)) / 2, ((a.y || 0) + (b.y || 0)) / 2);
  }

  function round(value, digits) {
    var factor = Math.pow(10, digits || 0);
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function segmentLength(points) {
    var total = 0;
    for (var index = 1; index < points.length; index += 1) {
      total += distance(points[index - 1], points[index]);
    }
    return total;
  }

  function polygonArea(points) {
    if (!points || points.length < 3) {
      return 0;
    }
    var total = 0;
    points.forEach(function (current, index) {
      var next = points[(index + 1) % points.length];
      total += current.x * next.y - next.x * current.y;
    });
    return Math.abs(total / 2);
  }

  function bounds(points) {
    if (!points || !points.length) {
      return { x: 0, y: 0, w: 1, h: 1, minX: 0, minY: 0, maxX: 1, maxY: 1 };
    }
    var xs = points.map(function (item) { return item.x; });
    var ys = points.map(function (item) { return item.y; });
    var minX = Math.min.apply(Math, xs);
    var maxX = Math.max.apply(Math, xs);
    var minY = Math.min.apply(Math, ys);
    var maxY = Math.max.apply(Math, ys);
    return {
      x: minX,
      y: minY,
      w: Math.max(0.000001, maxX - minX),
      h: Math.max(0.000001, maxY - minY),
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY
    };
  }

  function cubicPoint(points, t) {
    var p0 = points[0];
    var p1 = points[1];
    var p2 = points[2];
    var p3 = points[3];
    var mt = 1 - t;
    return point(
      mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
      mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
    );
  }

  function curveSamples(points, steps) {
    var samples = [];
    var count = Math.max(8, steps || 32);
    for (var index = 0; index <= count; index += 1) {
      samples.push(cubicPoint(points, index / count));
    }
    return samples;
  }

  function circleSamples(center, radius, steps) {
    var samples = [];
    var count = Math.max(12, steps || 48);
    var r = Math.max(0, Number(radius) || 0);
    for (var index = 0; index < count; index += 1) {
      var angle = Math.PI * 2 * index / count;
      samples.push(point(center.x + Math.cos(angle) * r, center.y + Math.sin(angle) * r));
    }
    return samples;
  }

  function normalizedArcDelta(startDeg, endDeg) {
    var start = Number(startDeg) || 0;
    var end = Number(endDeg) || 0;
    var delta = end - start;
    while (delta <= 0) {
      delta += 360;
    }
    while (delta > 360) {
      delta -= 360;
    }
    return delta;
  }

  function arcSamples(center, radius, startDeg, endDeg, steps) {
    var samples = [];
    var delta = normalizedArcDelta(startDeg, endDeg);
    var count = Math.max(8, steps || Math.ceil(delta / 8));
    var r = Math.max(0, Number(radius) || 0);
    for (var index = 0; index <= count; index += 1) {
      var angle = (Number(startDeg) + delta * index / count) * Math.PI / 180;
      samples.push(point(center.x + Math.cos(angle) * r, center.y + Math.sin(angle) * r));
    }
    return samples;
  }

  function featurePoints(feature) {
    var geometry = feature && feature.geometry ? feature.geometry : {};
    var coords = geometry.coordinates || [];
    if (geometry.type === "BezierCurve") {
      return coords.slice(0, 4);
    }
    return coords.slice();
  }

  function featureVertices(feature) {
    var geometry = feature && feature.geometry ? feature.geometry : {};
    var coords = geometry.coordinates || [];
    if (geometry.type === "Circle") {
      return [coords[0], coords[1]].filter(Boolean);
    }
    if (geometry.type === "Arc") {
      return [coords[0], coords[1], geometry.endPoint || (feature.properties && feature.properties.endPoint)].filter(Boolean);
    }
    return coords.slice();
  }

  function featureSegments(feature) {
    var geometry = feature && feature.geometry ? feature.geometry : {};
    var coords = geometry.coordinates || [];
    var source = coords;
    if (geometry.type === "BezierCurve") {
      source = curveSamples(coords, 32);
    } else if (geometry.type === "Circle" && coords.length >= 2) {
      source = circleSamples(coords[0], distance(coords[0], coords[1]), 48);
    } else if (geometry.type === "Arc" && coords.length >= 2) {
      var radius = Number(geometry.radius || (feature.properties && feature.properties.radius) || distance(coords[0], coords[1]));
      source = arcSamples(coords[0], radius, geometry.startAngle || 0, geometry.endAngle || 0, 32);
    }
    var segments = [];
    for (var index = 1; index < source.length; index += 1) {
      segments.push([source[index - 1], source[index]]);
    }
    if ((geometry.type === "Polygon" || geometry.type === "Circle") && source.length > 2) {
      segments.push([source[source.length - 1], source[0]]);
    }
    return segments;
  }

  function featureLength(feature) {
    var geometry = feature && feature.geometry ? feature.geometry : {};
    var coords = geometry.coordinates || [];
    if (geometry.type === "Polygon") {
      return segmentLength(coords.concat([coords[0]]));
    }
    if (geometry.type === "BezierCurve") {
      return segmentLength(curveSamples(coords, 36));
    }
    if (geometry.type === "Circle" && coords.length >= 2) {
      return 2 * Math.PI * distance(coords[0], coords[1]);
    }
    if (geometry.type === "Arc" && coords.length >= 2) {
      var radius = Number(geometry.radius || (feature.properties && feature.properties.radius) || distance(coords[0], coords[1]));
      return normalizedArcDelta(geometry.startAngle || 0, geometry.endAngle || 0) * Math.PI / 180 * radius;
    }
    return segmentLength(coords);
  }

  function featureArea(feature) {
    var geometry = feature && feature.geometry ? feature.geometry : {};
    if (geometry.type === "Polygon") {
      return polygonArea(geometry.coordinates || []);
    }
    if (geometry.type === "Circle") {
      var coords = geometry.coordinates || [];
      if (coords.length >= 2) {
        var radius = distance(coords[0], coords[1]);
        return Math.PI * radius * radius;
      }
    }
    return 0;
  }

  function formatLength(value, unit) {
    var meters = Number(value) || 0;
    var map = {
      mm: { factor: 1000, label: "mm" },
      cm: { factor: 100, label: "cm" },
      m: { factor: 1, label: "m" },
      km: { factor: 0.001, label: "km" },
      ft: { factor: 3.280839895, label: "ft" },
      in: { factor: 39.37007874, label: "in" }
    };
    var target = map[unit] || map.m;
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: target.label === "mm" ? 0 : 2 }).format(meters * target.factor) + " " + target.label;
  }

  function bearing(a, b, northDegrees) {
    var angle = Math.atan2((b.x || 0) - (a.x || 0), -((b.y || 0) - (a.y || 0))) * 180 / Math.PI;
    return (angle - (Number(northDegrees) || 0) + 360) % 360;
  }

  function direction16(degrees) {
    var index = Math.round(((Number(degrees) || 0) % 360) / 22.5) % 16;
    return {
      code: DIRECTIONS_16[index][0],
      label: DIRECTIONS_16[index][1],
      degrees: index * 22.5
    };
  }

  function projectPointOnSegment(p, a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) {
      return { point: point(a.x, a.y), t: 0, distance: distance(p, a) };
    }
    var t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
    var projected = point(a.x + t * dx, a.y + t * dy);
    return { point: projected, t: t, distance: distance(p, projected) };
  }

  function lineIntersection(a, b, c, d) {
    var denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(denominator) < 0.0000001) {
      return null;
    }
    var px = ((a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x)) / denominator;
    var py = ((a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x)) / denominator;
    var candidate = point(px, py);
    var onFirst = projectPointOnSegment(candidate, a, b);
    var onSecond = projectPointOnSegment(candidate, c, d);
    return onFirst.distance < 0.0001 && onSecond.distance < 0.0001 ? candidate : null;
  }

  function collectSnapTargets(features) {
    var targets = {
      vertices: [],
      midpoints: [],
      intersections: [],
      segments: []
    };
    (features || []).forEach(function (feature) {
      featureVertices(feature).forEach(function (vertex) {
        targets.vertices.push(vertex);
      });
      featureSegments(feature).forEach(function (segment) {
        targets.segments.push(segment);
        targets.midpoints.push(midpoint(segment[0], segment[1]));
      });
    });
    for (var a = 0; a < targets.segments.length; a += 1) {
      for (var b = a + 1; b < targets.segments.length; b += 1) {
        var intersection = lineIntersection(targets.segments[a][0], targets.segments[a][1], targets.segments[b][0], targets.segments[b][1]);
        if (intersection) {
          targets.intersections.push(intersection);
        }
      }
    }
    return targets;
  }

  function nearestPoint(raw, items, tolerance, kind) {
    var best = null;
    items.forEach(function (item) {
      var d = distance(raw, item);
      if (d <= tolerance && (!best || d < best.distance)) {
        best = { point: point(item.x, item.y), distance: d, kind: kind };
      }
    });
    return best;
  }

  function snapPoint(raw, options) {
    var settings = options && options.settings ? options.settings : {};
    if (!settings.enabled) {
      return { point: raw, kind: "" };
    }
    var tolerance = Number(options.tolerance) || 0.25;
    var targets = collectSnapTargets(options.features || []);
    var candidates = [];
    if (settings.grid && settings.gridSpacing > 0) {
      var gridPoint = point(
        Math.round(raw.x / settings.gridSpacing) * settings.gridSpacing,
        Math.round(raw.y / settings.gridSpacing) * settings.gridSpacing
      );
      var gridDistance = distance(raw, gridPoint);
      if (gridDistance <= tolerance) {
        candidates.push({ point: gridPoint, distance: gridDistance, kind: "grid" });
      }
    }
    if (settings.vertex) {
      var vertex = nearestPoint(raw, targets.vertices, tolerance, "vertex");
      if (vertex) {
        candidates.push(vertex);
      }
    }
    if (settings.midpoint) {
      var mid = nearestPoint(raw, targets.midpoints, tolerance, "midpoint");
      if (mid) {
        candidates.push(mid);
      }
    }
    if (settings.intersection) {
      var intersection = nearestPoint(raw, targets.intersections, tolerance, "intersection");
      if (intersection) {
        candidates.push(intersection);
      }
    }
    if (settings.line) {
      targets.segments.forEach(function (segment) {
        var projected = projectPointOnSegment(raw, segment[0], segment[1]);
        if (projected.distance <= tolerance) {
          candidates.push({ point: projected.point, distance: projected.distance, kind: "line" });
        }
      });
    }
    candidates.sort(function (a, b) {
      return a.distance - b.distance;
    });
    return candidates[0] || { point: raw, kind: "" };
  }

  function moveFeature(feature, dx, dy) {
    var copy = clone(feature);
    (copy.geometry.coordinates || []).forEach(function (coord) {
      coord.x += dx;
      coord.y += dy;
    });
    if (copy.geometry.endPoint) {
      copy.geometry.endPoint.x += dx;
      copy.geometry.endPoint.y += dy;
    }
    if (copy.properties && copy.properties.endPoint) {
      copy.properties.endPoint.x += dx;
      copy.properties.endPoint.y += dy;
    }
    return copy;
  }

  function rotatePointAround(coord, pivot, rad) {
    var dx = coord.x - pivot.x;
    var dy = coord.y - pivot.y;
    coord.x = pivot.x + dx * Math.cos(rad) - dy * Math.sin(rad);
    coord.y = pivot.y + dx * Math.sin(rad) + dy * Math.cos(rad);
    return coord;
  }

  function rotateFeature(feature, degrees, origin) {
    var copy = clone(feature);
    var center = origin || bounds(featurePoints(copy));
    var pivot = origin || point(center.x + center.w / 2, center.y + center.h / 2);
    var rad = (Number(degrees) || 0) * Math.PI / 180;
    (copy.geometry.coordinates || []).forEach(function (coord) {
      rotatePointAround(coord, pivot, rad);
    });
    if (copy.geometry.endPoint) {
      rotatePointAround(copy.geometry.endPoint, pivot, rad);
    }
    if (copy.properties && copy.properties.endPoint) {
      rotatePointAround(copy.properties.endPoint, pivot, rad);
    }
    copy.rotation = ((Number(copy.rotation) || 0) + Number(degrees || 0)) % 360;
    if (copy.geometry.type === "Circle" && copy.geometry.coordinates.length >= 2) {
      copy.geometry.radius = distance(copy.geometry.coordinates[0], copy.geometry.coordinates[1]);
    }
    if (copy.geometry.type === "Arc" && copy.geometry.coordinates.length >= 2) {
      var arcCenter = copy.geometry.coordinates[0];
      var arcStart = copy.geometry.coordinates[1];
      var arcEnd = copy.geometry.endPoint || (copy.properties && copy.properties.endPoint) || arcStart;
      copy.geometry.radius = distance(arcCenter, arcStart);
      copy.geometry.startAngle = Math.atan2(arcStart.y - arcCenter.y, arcStart.x - arcCenter.x) * 180 / Math.PI;
      copy.geometry.endAngle = Math.atan2(arcEnd.y - arcCenter.y, arcEnd.x - arcCenter.x) * 180 / Math.PI;
    }
    return copy;
  }

  function validateFeature(feature) {
    var errors = [];
    var geometry = feature && feature.geometry ? feature.geometry : {};
    var coords = geometry.coordinates || [];
    if ((geometry.type === "LineString" || geometry.type === "Polyline") && featureLength(feature) <= 0.0001) {
      errors.push("zero-length line");
    }
    if (geometry.type === "Polygon") {
      if (coords.length < 3) {
        errors.push("polygon needs at least 3 points");
      }
      if (polygonArea(coords) <= 0.0001) {
        errors.push("polygon area is zero");
      }
    }
    if (geometry.type === "Circle" && (coords.length < 2 || distance(coords[0], coords[1]) <= 0.000001)) {
      errors.push("circle radius is zero");
    }
    if (geometry.type === "Arc" && (coords.length < 2 || featureLength(feature) <= 0.000001)) {
      errors.push("arc length is zero");
    }
    for (var index = 1; index < coords.length; index += 1) {
      if (distance(coords[index - 1], coords[index]) <= 0.000001) {
        errors.push("duplicate vertex");
        break;
      }
    }
    return { valid: !errors.length, errors: errors };
  }

  window.MpmDrawingGeometry = {
    DIRECTIONS_16: DIRECTIONS_16,
    uid: uid,
    clone: clone,
    point: point,
    distance: distance,
    midpoint: midpoint,
    round: round,
    segmentLength: segmentLength,
    polygonArea: polygonArea,
    bounds: bounds,
    cubicPoint: cubicPoint,
    curveSamples: curveSamples,
    circleSamples: circleSamples,
    arcSamples: arcSamples,
    normalizedArcDelta: normalizedArcDelta,
    featurePoints: featurePoints,
    featureVertices: featureVertices,
    featureSegments: featureSegments,
    featureLength: featureLength,
    featureArea: featureArea,
    formatLength: formatLength,
    bearing: bearing,
    direction16: direction16,
    projectPointOnSegment: projectPointOnSegment,
    lineIntersection: lineIntersection,
    snapPoint: snapPoint,
    moveFeature: moveFeature,
    rotateFeature: rotateFeature,
    validateFeature: validateFeature
  };
})(window);
