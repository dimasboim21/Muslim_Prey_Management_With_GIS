(function (window) {
  "use strict";

  function timezone(snapshot) {
    return (snapshot && snapshot.timezone) || "Asia/Jakarta";
  }

  function dateParts(now, snapshot) {
    return window.PrayerTimeUtils.getZonedDateParts(now, timezone(snapshot));
  }

  function timeOnDay(now, totalMinutes, snapshot, dayOffset) {
    var parts = dateParts(now, snapshot);
    var day = window.PrayerTimeUtils.addLocalDays(parts, Number(dayOffset || 0));
    return window.PrayerTimeUtils.zonedTimeToDate(day, totalMinutes, timezone(snapshot));
  }

  function localTimeDate(now, localTime, snapshot, dayOffset) {
    var minutes = window.PrayerTimeUtils.parseTimeToMinutes(String(localTime || ""));
    return minutes === null ? null : timeOnDay(now, minutes, snapshot, dayOffset);
  }

  function hijriParts(now, snapshot) {
    if (snapshot && snapshot.hijriParts && snapshot.hijriParts.day && snapshot.hijriParts.month) {
      return {
        day: Number(snapshot.hijriParts.day),
        month: Number(snapshot.hijriParts.month),
        year: snapshot.hijriParts.year ? Number(snapshot.hijriParts.year) : null
      };
    }
    try {
      var parts = new Intl.DateTimeFormat("en-u-ca-islamic", {
        timeZone: timezone(snapshot),
        day: "numeric",
        month: "numeric",
        year: "numeric"
      }).formatToParts(now).reduce(function (result, part) {
        if (part.type !== "literal") {
          result[part.type] = Number(String(part.value).replace(/[^0-9]/g, ""));
        }
        return result;
      }, {});
      return { day: parts.day || null, month: parts.month || null, year: parts.year || null };
    } catch (error) {
      return { day: null, month: null, year: null };
    }
  }

  function isoAt(timestamp) {
    return new Date(timestamp).toISOString();
  }

  window.OverlayTimeService = {
    timezone: timezone,
    dateParts: dateParts,
    timeOnDay: timeOnDay,
    localTimeDate: localTimeDate,
    hijriParts: hijriParts,
    isoAt: isoAt
  };
})(window);
