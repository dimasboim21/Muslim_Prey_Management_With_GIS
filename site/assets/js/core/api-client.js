(function (window) {
  "use strict";

  function apiUrl(endpoint) {
    if (window.PrayerRuntime) {
      return window.PrayerRuntime.api(endpoint);
    }

    return "api/" + endpoint;
  }

  function errorFromResponse(response, payload) {
    var message = payload && payload.error ? payload.error : ("Request failed (HTTP " + response.status + ")");
    var error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    return error;
  }

  function request(endpoint, options) {
    if (!window.fetch || (window.PrayerRuntime && !window.PrayerRuntime.isServerCapable)) {
      return Promise.reject(new Error("Backend tidak tersedia dalam mode file/offline."));
    }

    var settings = options || {};
    var headers = settings.headers || {};
    var requestOptions = {
      method: settings.method || "GET",
      credentials: "same-origin",
      headers: headers
    };

    if (settings.body !== undefined) {
      headers["Content-Type"] = "application/json";
      requestOptions.body = JSON.stringify(settings.body);
    }

    return window.fetch(apiUrl(endpoint), requestOptions)
      .then(function (response) {
        return response.text().then(function (text) {
          var payload = null;
          try {
            payload = text ? JSON.parse(text) : null;
          } catch (error) {
            throw new Error("Respons backend bukan JSON yang valid.");
          }

          if (!response.ok || !payload || payload.success === false) {
            throw errorFromResponse(response, payload);
          }

          return payload.data;
        });
      });
  }

  function encode(value) {
    return encodeURIComponent(String(value || ""));
  }

  window.PrayerApiClient = {
    request: request,
    getCurrentConfig: function (userId) {
      return request("config.php?user_id=" + encode(userId));
    },
    getConfigHistory: function (userId, limit) {
      return request("config.php?history=1&user_id=" + encode(userId) + "&limit=" + encode(limit || 25));
    },
    saveConfig: function (config, clientRequestId, source) {
      var user = config && config.user ? config.user : {};
      return request("config.php", {
        method: "POST",
        headers: {
          "X-Actor-Id": user.id || "anonymous",
          "X-Client-Request-Id": clientRequestId
        },
        body: {
          config: config,
          actorId: user.id || "anonymous",
          clientRequestId: clientRequestId,
          source: source || "dashboard"
        }
      });
    },
    logActivity: function (activityType, actorId, metadata, clientRequestId) {
      return request("activity.php", {
        method: "POST",
        headers: {
          "X-Actor-Id": actorId || "anonymous",
          "X-Client-Request-Id": clientRequestId
        },
        body: {
          activityType: activityType,
          actorId: actorId || "anonymous",
          metadata: metadata || {},
          clientRequestId: clientRequestId
        }
      });
    },
    health: function () {
      return request("health.php");
    }
  };
})(window);
