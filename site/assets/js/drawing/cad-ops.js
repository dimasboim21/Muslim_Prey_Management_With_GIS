(function (window) {
  "use strict";

  var geom = window.MpmDrawingGeometry;

  function cloneFeature(feature) {
    return geom.clone(feature);
  }

  function nearestSegment(points, target, closed) {
    var best = null;
    var limit = closed ? points.length : points.length - 1;
    for (var index = 0; index < limit; index += 1) {
      var a = points[index];
      var b = points[(index + 1) % points.length];
      var projected = geom.projectPointOnSegment(target, a, b);
      if (!best || projected.distance < best.distance) {
        best = {
          index: index,
          point: projected.point,
          t: projected.t,
          distance: projected.distance,
          a: a,
          b: b
        };
      }
    }
    return best;
  }

  function splitFeatureAtPoint(feature, target, tolerance) {
    var geometry = feature.geometry || {};
    var closed = geometry.type === "Polygon";
    var points = (geometry.coordinates || []).slice();
    if (points.length < 2) {
      return null;
    }
    var hit = nearestSegment(points, target, closed);
    if (!hit || hit.distance > (tolerance || 0.25)) {
      return null;
    }
    var splitPoint = hit.point;
    if (geometry.type === "Polygon") {
      var updated = cloneFeature(feature);
      updated.geometry.coordinates.splice(hit.index + 1, 0, splitPoint);
      updated.updatedAt = new Date().toISOString();
      return { mode: "add-vertex", features: [updated], point: splitPoint };
    }
    var first = points.slice(0, hit.index + 1).concat([splitPoint]);
    var second = [splitPoint].concat(points.slice(hit.index + 1));
    if (first.length < 2 || second.length < 2) {
      return null;
    }
    var a = cloneFeature(feature);
    var b = cloneFeature(feature);
    a.id = geom.uid("feature");
    b.id = geom.uid("feature");
    a.name = feature.name ? feature.name + " A" : "";
    b.name = feature.name ? feature.name + " B" : "";
    a.geometry.coordinates = first;
    b.geometry.coordinates = second;
    a.createdAt = b.createdAt = new Date().toISOString();
    a.updatedAt = b.updatedAt = new Date().toISOString();
    return { mode: "split", features: [a, b], point: splitPoint };
  }

  function samePoint(a, b, tolerance) {
    return geom.distance(a, b) <= (tolerance || 0.25);
  }

  function joinFeatures(features, tolerance) {
    var items = (features || []).filter(function (feature) {
      var type = feature.geometry && feature.geometry.type;
      return type === "Polyline" || type === "LineString";
    }).map(cloneFeature);
    if (!items.length) {
      return null;
    }
    var coords = items.shift().geometry.coordinates.slice();
    var changed = true;
    while (items.length && changed) {
      changed = false;
      for (var index = 0; index < items.length; index += 1) {
        var next = items[index].geometry.coordinates.slice();
        var start = coords[0];
        var end = coords[coords.length - 1];
        var nextStart = next[0];
        var nextEnd = next[next.length - 1];
        if (samePoint(end, nextStart, tolerance)) {
          coords = coords.concat(next.slice(1));
        } else if (samePoint(end, nextEnd, tolerance)) {
          coords = coords.concat(next.reverse().slice(1));
        } else if (samePoint(start, nextEnd, tolerance)) {
          coords = next.slice(0, -1).concat(coords);
        } else if (samePoint(start, nextStart, tolerance)) {
          coords = next.reverse().slice(0, -1).concat(coords);
        } else {
          continue;
        }
        items.splice(index, 1);
        changed = true;
        break;
      }
    }
    if (items.length) {
      return null;
    }
    var joined = cloneFeature(features[0]);
    joined.id = geom.uid("feature");
    joined.name = joined.name ? joined.name + " joined" : "Joined polyline";
    joined.type = "Polyline";
    joined.geometry.type = "Polyline";
    joined.geometry.coordinates = coords;
    joined.createdAt = new Date().toISOString();
    joined.updatedAt = new Date().toISOString();
    return joined;
  }

  function trimFeatureAtCutters(feature, cutters, target, tolerance) {
    var geometry = feature.geometry || {};
    if (geometry.type !== "Polyline" && geometry.type !== "LineString") {
      return null;
    }
    var points = geometry.coordinates || [];
    if (points.length < 2) {
      return null;
    }
    var hit = nearestSegment(points, target, false);
    if (!hit || hit.distance > (tolerance || 0.25)) {
      return null;
    }
    var intersections = [];
    (cutters || []).forEach(function (cutter) {
      geom.featureSegments(cutter).forEach(function (segment) {
        var intersection = geom.lineIntersection(hit.a, hit.b, segment[0], segment[1]);
        if (intersection) {
          var projected = geom.projectPointOnSegment(intersection, hit.a, hit.b);
          intersections.push({ point: intersection, t: projected.t });
        }
      });
    });
    intersections = intersections.filter(function (item) {
      return item.t > 1e-9 && item.t < 1 - 1e-9;
    }).sort(function (a, b) {
      return a.t - b.t;
    });
    if (!intersections.length) {
      return null;
    }
    var targetProjection = geom.projectPointOnSegment(target, hit.a, hit.b);
    var before = intersections.filter(function (item) { return item.t <= targetProjection.t; }).pop();
    var after = intersections.find(function (item) { return item.t >= targetProjection.t; });
    var updated = cloneFeature(feature);
    var coords = points.slice();
    if (before && after && before !== after) {
      coords.splice(hit.index + 1, 0, before.point, after.point);
      coords.splice(hit.index + 2, 1);
    } else if (before) {
      coords[hit.index + 1] = before.point;
    } else if (after) {
      coords[hit.index] = after.point;
    }
    updated.geometry.coordinates = coords;
    updated.updatedAt = new Date().toISOString();
    return updated;
  }

  function extendFeatureToTargets(feature, targets, endpointName, tolerance) {
    var geometry = feature.geometry || {};
    if (geometry.type !== "Polyline" && geometry.type !== "LineString") {
      return null;
    }
    var coords = (geometry.coordinates || []).slice();
    if (coords.length < 2) {
      return null;
    }
    var atEnd = endpointName !== "start";
    var endpoint = atEnd ? coords[coords.length - 1] : coords[0];
    var adjacent = atEnd ? coords[coords.length - 2] : coords[1];
    var rayFar = {
      x: endpoint.x + (endpoint.x - adjacent.x) * 1000000,
      y: endpoint.y + (endpoint.y - adjacent.y) * 1000000
    };
    var best = null;
    (targets || []).forEach(function (targetFeature) {
      geom.featureSegments(targetFeature).forEach(function (segment) {
        var intersection = geom.lineIntersection(adjacent, rayFar, segment[0], segment[1]);
        if (!intersection) {
          return;
        }
        var direction = geom.projectPointOnSegment(intersection, endpoint, rayFar);
        if (direction.t <= 0) {
          return;
        }
        var dist = geom.distance(endpoint, intersection);
        if (dist <= (tolerance || 1000000) && (!best || dist < best.distance)) {
          best = { point: intersection, distance: dist };
        }
      });
    });
    if (!best) {
      return null;
    }
    var updated = cloneFeature(feature);
    if (atEnd) {
      updated.geometry.coordinates[updated.geometry.coordinates.length - 1] = best.point;
    } else {
      updated.geometry.coordinates[0] = best.point;
    }
    updated.updatedAt = new Date().toISOString();
    return updated;
  }

  function offsetPolyline(feature, distance, side) {
    var geometry = feature.geometry || {};
    var points = geometry.coordinates || [];
    if (points.length < 2) {
      return null;
    }
    var sign = side === "right" ? -1 : 1;
    var shifted = points.map(function (point, index) {
      var prev = points[Math.max(0, index - 1)];
      var next = points[Math.min(points.length - 1, index + 1)];
      var dx = next.x - prev.x;
      var dy = next.y - prev.y;
      var len = Math.hypot(dx, dy) || 1;
      return {
        x: point.x + (-dy / len) * distance * sign,
        y: point.y + (dx / len) * distance * sign
      };
    });
    var copy = cloneFeature(feature);
    copy.id = geom.uid("feature");
    copy.name = feature.name ? feature.name + " offset" : "Offset";
    copy.geometry.coordinates = shifted;
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = new Date().toISOString();
    return copy;
  }

  window.MpmDrawingCadOps = {
    nearestSegment: nearestSegment,
    splitFeatureAtPoint: splitFeatureAtPoint,
    joinFeatures: joinFeatures,
    trimFeatureAtCutters: trimFeatureAtCutters,
    extendFeatureToTargets: extendFeatureToTargets,
    offsetPolyline: offsetPolyline
  };
})(window);
