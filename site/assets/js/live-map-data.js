(function () {
    'use strict';
    const identity = (f) => String(f.getId() ?? f.get('popupKey') ?? f.get('recordId') ?? '');
    function sync(source, incoming) {
        const old = new Map(source.getFeatures().map((f) => [identity(f), f]));
        const kept = new Set();
        const result = incoming.map((next) => {
            const key = identity(next), existing = key && old.get(key);
            if (!existing) { source.addFeature(next); kept.add(next); return next; }
            const props = next.getProperties(), previous = existing.getProperties();
            delete props.geometry; delete previous.geometry;
            if (JSON.stringify(props) !== JSON.stringify(previous)) {
                Object.keys(previous).filter((k) => !(k in props)).forEach((k) => existing.unset(k, true));
                existing.setProperties(props);
            }
            const a = existing.getGeometry(), b = next.getGeometry();
            if (!a || !b || a.getType() !== b.getType() || JSON.stringify(a.getCoordinates()) !== JSON.stringify(b.getCoordinates())) existing.setGeometry(b);
            kept.add(existing); return existing;
        });
        source.getFeatures().filter((f) => !kept.has(f)).forEach((f) => source.removeFeature(f));
        return result;
    }
    window.MpmLiveMapData = { sync, identity };
}());
