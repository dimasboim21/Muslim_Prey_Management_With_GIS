(function (window) {
  "use strict";

  function record(activityType, configOrActor, metadata) {
    if (!window.PrayerSyncManager) {
      return null;
    }

    var actorId = "anonymous";
    if (typeof configOrActor === "string") {
      actorId = configOrActor;
    } else if (configOrActor && configOrActor.user && configOrActor.user.id) {
      actorId = configOrActor.user.id;
    }

    try {
      return window.PrayerSyncManager.queueActivity(activityType, actorId, metadata || {});
    } catch (error) {
      // Activity logging must never interrupt prayer time display in offline mode.
      return null;
    }
  }

  window.PrayerActivityLogger = { record: record };
})(window);
