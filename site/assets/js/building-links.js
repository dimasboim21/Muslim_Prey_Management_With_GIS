(function (window) {
  'use strict';
  function requested() { return new URLSearchParams(window.location.search).get('building') || ''; }
  function valid(value) { return value.length <= 768 && /^[A-Z]{3}-[A-Z0-9_]+-[A-Z0-9_]+-[A-Z0-9_]+-\d{3,20}-\d{8}$/.test(value); }
  function link(page, identifier) {
    var url = new URL(page, window.location.href);
    url.searchParams.set('lang', window.PrayerI18n.getCurrentLanguage());
    if (identifier) url.searchParams.set('building', identifier);
    return url.href;
  }
  async function resolve(identifier) {
    if (!valid(identifier)) { var invalid = new Error('invalidIdentifier'); invalid.code = 'invalidIdentifier'; throw invalid; }
    var url = window.PrayerRuntime && window.PrayerRuntime.api ? window.PrayerRuntime.api('mosque-admin.php') : 'api/mosque-admin.php';
    var response;
    try { response = await fetch(url + '?building=' + encodeURIComponent(identifier), {credentials:'same-origin', cache:'no-store'}); }
    catch (error) {
      var cached = window.MpmAdminLocation && window.MpmAdminLocation.read();
      // Never substitute another active building when a deep link cannot resolve.
      if (cached && cached.mosque.buildingIdentifier === identifier) return cached;
      error.code = 'buildingUnavailable'; throw error;
    }
    var body = await response.json();
    if (!response.ok || !body.success) { var error = new Error(body.code || 'buildingUnavailable'); error.code = body.code || 'buildingUnavailable'; throw error; }
    var row = body.data[0];
    if (row.latitude === null || row.longitude === null || row.latitude === '' || row.longitude === '') {
      var coordinates = new Error('buildingCoordinatesMissing'); coordinates.code = 'buildingCoordinatesMissing'; throw coordinates;
    }
    var context = window.MpmAdminLocation.normalize({
      source:'building-deep-link', updatedAt:row.history_saved_at || row.created_at,
      mosque:{id:row.mosque_id, buildingIdentifier:row.building_identifier, name:row.mosque_name, type:row.building_type, typeLabel:row.building_type_label, iconPath:row.icon_path, officialAddress:row.official_address},
      location:row
    });
    if(row.resolved_from_identifier===identifier)context.resolvedFromIdentifier=identifier;
    return context;
  }
  window.MpmBuildingLinks = {requested:requested, valid:valid, link:link, resolve:resolve};
})(window);
