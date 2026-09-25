(function () {
    'use strict';
    const daysOf = (value) => [1, 5, 10, 30].includes(Number(value)) ? Number(value) : 1;
    const windowOf = (value, now = Date.now()) => ({ days: daysOf(value), since: now - daysOf(value) * 86400000, until: now });
    const contains = (time, range) => typeof time === 'number' && Number.isFinite(time) && time >= range.since && time <= range.until;
    function heatTime(props, retrievedAt) {
        for (const key of ['detect_epoch', 'detectepoch']) {
            const value = props[key];
            if (value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value))) {
                const epoch = Number(value); if (epoch > 0) return epoch < 1e12 ? epoch * 1000 : epoch;
            }
        }
        const value = props.hours_since_update;
        if (value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0) return retrievedAt - Number(value) * 3600000;
        return null;
    }
    window.MpmOnlineMapTime = { daysOf, windowOf, contains, heatTime };
}());
