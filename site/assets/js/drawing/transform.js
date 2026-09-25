(function (window) {
  "use strict";

  var geom = window.MpmDrawingGeometry;
  var EARTH_RADIUS = 6378137;

  function pointPair(controlPoint) {
    return {
      source: geom.point(controlPoint.drawingX, controlPoint.drawingY),
      target: geom.point(controlPoint.mapX, controlPoint.mapY),
      id: controlPoint.id,
      enabled: controlPoint.enabled !== false
    };
  }

  function enabledPairs(controlPoints) {
    return (controlPoints || []).map(pointPair).filter(function (pair) {
      return pair.enabled && Number.isFinite(pair.source.x) && Number.isFinite(pair.source.y) && Number.isFinite(pair.target.x) && Number.isFinite(pair.target.y);
    });
  }

  function matrixIdentity() {
    return { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0, type: "identity" };
  }

  function applyMatrix(point, matrix) {
    var m = matrix || matrixIdentity();
    return geom.point(m.a * point.x + m.b * point.y + m.c, m.d * point.x + m.e * point.y + m.f);
  }

  function invertMatrix(matrix) {
    var m = matrix || matrixIdentity();
    var det = m.a * m.e - m.b * m.d;
    if (Math.abs(det) < 1e-12) {
      return null;
    }
    return {
      a: m.e / det,
      b: -m.b / det,
      c: (m.b * m.f - m.e * m.c) / det,
      d: -m.d / det,
      e: m.a / det,
      f: (m.d * m.c - m.a * m.f) / det,
      type: "inverse"
    };
  }

  function translationFromPair(pair) {
    return {
      a: 1,
      b: 0,
      c: pair.target.x - pair.source.x,
      d: 0,
      e: 1,
      f: pair.target.y - pair.source.y,
      type: "translation"
    };
  }

  function similarityFromPairs(pairs) {
    var s0 = pairs[0].source;
    var s1 = pairs[1].source;
    var t0 = pairs[0].target;
    var t1 = pairs[1].target;
    var sourceDx = s1.x - s0.x;
    var sourceDy = s1.y - s0.y;
    var targetDx = t1.x - t0.x;
    var targetDy = t1.y - t0.y;
    var sourceLength = Math.hypot(sourceDx, sourceDy);
    var targetLength = Math.hypot(targetDx, targetDy);
    if (sourceLength <= 1e-12) {
      return translationFromPair(pairs[0]);
    }
    var scale = targetLength / sourceLength;
    var sourceAngle = Math.atan2(sourceDy, sourceDx);
    var targetAngle = Math.atan2(targetDy, targetDx);
    var angle = targetAngle - sourceAngle;
    var cos = Math.cos(angle) * scale;
    var sin = Math.sin(angle) * scale;
    return {
      a: cos,
      b: -sin,
      c: t0.x - cos * s0.x + sin * s0.y,
      d: sin,
      e: cos,
      f: t0.y - sin * s0.x - cos * s0.y,
      type: "similarity",
      scale: scale,
      rotationDegrees: angle * 180 / Math.PI
    };
  }

  function solve3(matrix, vector) {
    var a = [
      [matrix[0][0], matrix[0][1], matrix[0][2], vector[0]],
      [matrix[1][0], matrix[1][1], matrix[1][2], vector[1]],
      [matrix[2][0], matrix[2][1], matrix[2][2], vector[2]]
    ];
    for (var col = 0; col < 3; col += 1) {
      var pivot = col;
      for (var row = col + 1; row < 3; row += 1) {
        if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) {
          pivot = row;
        }
      }
      if (Math.abs(a[pivot][col]) < 1e-12) {
        return null;
      }
      if (pivot !== col) {
        var tmp = a[pivot];
        a[pivot] = a[col];
        a[col] = tmp;
      }
      var divisor = a[col][col];
      for (var divCol = col; divCol < 4; divCol += 1) {
        a[col][divCol] /= divisor;
      }
      for (var elim = 0; elim < 3; elim += 1) {
        if (elim === col) {
          continue;
        }
        var factor = a[elim][col];
        for (var elimCol = col; elimCol < 4; elimCol += 1) {
          a[elim][elimCol] -= factor * a[col][elimCol];
        }
      }
    }
    return [a[0][3], a[1][3], a[2][3]];
  }

  function affineFromPairs(pairs) {
    var normal = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    var targetX = [0, 0, 0];
    var targetY = [0, 0, 0];
    pairs.forEach(function (pair) {
      var row = [pair.source.x, pair.source.y, 1];
      for (var i = 0; i < 3; i += 1) {
        targetX[i] += row[i] * pair.target.x;
        targetY[i] += row[i] * pair.target.y;
        for (var j = 0; j < 3; j += 1) {
          normal[i][j] += row[i] * row[j];
        }
      }
    });
    var x = solve3(normal, targetX);
    var y = solve3(normal, targetY);
    if (!x || !y) {
      return similarityFromPairs(pairs.slice(0, 2));
    }
    return { a: x[0], b: x[1], c: x[2], d: y[0], e: y[1], f: y[2], type: pairs.length > 3 ? "affine-least-squares" : "affine" };
  }

  function calculate(controlPoints) {
    var pairs = enabledPairs(controlPoints);
    var matrix = matrixIdentity();
    if (pairs.length === 1) {
      matrix = translationFromPair(pairs[0]);
    } else if (pairs.length === 2) {
      matrix = similarityFromPairs(pairs);
    } else if (pairs.length >= 3) {
      matrix = affineFromPairs(pairs);
    }
    var residuals = pairs.map(function (pair) {
      var predicted = applyMatrix(pair.source, matrix);
      var error = geom.distance(predicted, pair.target);
      return {
        id: pair.id,
        drawingX: pair.source.x,
        drawingY: pair.source.y,
        mapX: pair.target.x,
        mapY: pair.target.y,
        predictedX: predicted.x,
        predictedY: predicted.y,
        error: error
      };
    });
    var sum = residuals.reduce(function (total, item) { return total + item.error; }, 0);
    var square = residuals.reduce(function (total, item) { return total + item.error * item.error; }, 0);
    var max = residuals.reduce(function (current, item) { return Math.max(current, item.error); }, 0);
    return {
      matrix: matrix,
      inverse: invertMatrix(matrix),
      controlPointCount: pairs.length,
      residuals: residuals,
      rmsError: residuals.length ? Math.sqrt(square / residuals.length) : 0,
      averageError: residuals.length ? sum / residuals.length : 0,
      maxError: max,
      calculatedAt: new Date().toISOString()
    };
  }

  function transformCoordinates(coords, matrix) {
    return (coords || []).map(function (item) {
      return applyMatrix(item, matrix);
    });
  }

  function transformFeature(feature, matrix) {
    var copy = geom.clone(feature);
    copy.geometry.coordinates = transformCoordinates(copy.geometry.coordinates || [], matrix);
    if (copy.geometry.type === "Circle" && copy.geometry.coordinates.length >= 2) {
      copy.geometry.radius = geom.distance(copy.geometry.coordinates[0], copy.geometry.coordinates[1]);
    }
    if (copy.geometry.type === "Arc" && copy.geometry.coordinates.length >= 2) {
      var center = copy.geometry.coordinates[0];
      var start = copy.geometry.coordinates[1];
      var endPoint = copy.geometry.endPoint || (copy.properties && copy.properties.endPoint) || copy.geometry.coordinates[2] || start;
      endPoint = applyMatrix(endPoint, matrix);
      copy.geometry.endPoint = endPoint;
      copy.geometry.radius = geom.distance(center, start);
      copy.geometry.startAngle = Math.atan2(start.y - center.y, start.x - center.x) * 180 / Math.PI;
      copy.geometry.endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x) * 180 / Math.PI;
      copy.properties = copy.properties || {};
      copy.properties.endPoint = endPoint;
    }
    copy.properties = copy.properties || {};
    copy.properties.coordinateSpace = "georeferenced";
    return copy;
  }

  function transformProject(project, matrix) {
    var copy = geom.clone(project);
    copy.features = (copy.features || []).map(function (feature) {
      return transformFeature(feature, matrix);
    });
    copy.coordinateSpace = "georeferenced";
    return copy;
  }

  function toWebMercator(point4326) {
    if (window.ol && window.ol.proj && typeof window.ol.proj.transform === "function") {
      var transformed = window.ol.proj.transform([point4326.x, point4326.y], "EPSG:4326", "EPSG:3857");
      return geom.point(transformed[0], transformed[1]);
    }
    var lon = point4326.x;
    var lat = Math.max(-85.05112878, Math.min(85.05112878, point4326.y));
    return geom.point(EARTH_RADIUS * lon * Math.PI / 180, EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)));
  }

  function fromWebMercator(point3857) {
    if (window.ol && window.ol.proj && typeof window.ol.proj.transform === "function") {
      var transformed = window.ol.proj.transform([point3857.x, point3857.y], "EPSG:3857", "EPSG:4326");
      return geom.point(transformed[0], transformed[1]);
    }
    return geom.point(point3857.x / EARTH_RADIUS * 180 / Math.PI, (2 * Math.atan(Math.exp(point3857.y / EARTH_RADIUS)) - Math.PI / 2) * 180 / Math.PI);
  }

  function transformCrs(point, source, target) {
    if (!source || !target || source === target) {
      return geom.point(point.x, point.y);
    }
    if (source === "EPSG:4326" && target === "EPSG:3857") {
      return toWebMercator(point);
    }
    if (source === "EPSG:3857" && target === "EPSG:4326") {
      return fromWebMercator(point);
    }
    if (window.ol && window.ol.proj && typeof window.ol.proj.transform === "function") {
      var transformed = window.ol.proj.transform([point.x, point.y], source, target);
      return geom.point(transformed[0], transformed[1]);
    }
    return geom.point(point.x, point.y);
  }

  window.MpmDrawingTransform = {
    matrixIdentity: matrixIdentity,
    applyMatrix: applyMatrix,
    invertMatrix: invertMatrix,
    calculate: calculate,
    transformFeature: transformFeature,
    transformProject: transformProject,
    transformCrs: transformCrs
  };
})(window);
