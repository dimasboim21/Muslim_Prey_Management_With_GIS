(function () {
    'use strict';
    function create({ ol, state }) {
        let key = '', name = '', geometries = [], generation = 0, status = 'unavailable';
        let iso3 = '';
        let pathKey = '', clipPath = null;
        const bindings = new WeakSet();
        const listeners = new Set();
        const notify = () => { listeners.forEach((fn) => fn()); if (state.map) state.map.render(); };
        function contains(coordinate) {
            if (!coordinate) return false;
            const world = 40075016.68557849;
            return [-world, 0, world].some((shift) => {
                const point = [coordinate[0] + shift, coordinate[1]];
                return geometries.some((g) => ol.extent.containsCoordinate(g.getExtent(), point) && g.intersectsCoordinate(point));
            });
        }
        function bounds() {
            if (!geometries.length) return null;
            const extent = ol.extent.createEmpty();
            geometries.forEach((g) => ol.extent.extend(extent, g.getExtent()));
            return ol.proj.transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
        }
        async function load(identity, label, loader) {
            if (key === identity && status !== 'error') return;
            key = identity; name = label || ''; iso3 = ''; geometries = []; clipPath = null; status = 'loading';
            const token = ++generation; notify();
            try {
                const result = await loader();
                if (token !== generation) return;
                const props = result.features && result.features[0] ? result.features[0].getProperties() : {};
                iso3 = String(props.shapeGroup || props.ISO_A3 || props.ISO3 || props.iso3 || '').toUpperCase();
                if (!/^[A-Z]{3}$/.test(iso3)) iso3 = name.toLowerCase() === 'indonesia' ? 'IDN' : '';
                geometries = (result.features || []).map((f) => f.getGeometry()).filter((g) => g && ['Polygon', 'MultiPolygon'].includes(g.getType()))
                    .flatMap((g) => g.getType() === 'MultiPolygon' ? g.getPolygons() : [g.clone()]);
                clipPath = null;
                status = geometries.length ? 'ready' : 'unavailable';
            } catch (_) { if (token !== generation) return; status = 'error'; }
            notify();
        }
        function accepts(feature) {
            const g = feature.getGeometry();
            if (!g || !geometries.length) return false;
            if (g.getType() === 'Point') return contains(g.getCoordinates());
            // Non-point hazards may cross the border; retain intersecting candidates
            // and clip their actual rendering to the country polygon below.
            return geometries.some((boundary) => boundary.intersectsExtent(g.getExtent()) || g.intersectsExtent(boundary.getExtent()));
        }
        function bind(layer, local) {
            if (!layer || bindings.has(layer)) return;
            bindings.add(layer);
            if (layer.getLayers) {
                layer.getLayers().forEach((child) => bind(child, local));
                layer.getLayers().on('add', (event) => bind(event.element, local));
                return;
            }
            let saved = false;
            layer.on('prerender', (event) => {
                // Point layers that already filter their centers should keep readable badges at coastlines.
                if (!local() || layer.get('adm0CenterFiltered') || !event.context || !event.context.canvas) return;
                const context = event.context;
                context.save(); saved = true;
                const world = 40075016.68557849;
                const view = state.map.getView(), resolution = view.getResolution();
                const center = view.getCenter()[0];
                const base = Math.round(center / world) * world;
                const nextKey = [generation, status, view.getCenter(), resolution, view.getRotation(), state.map.getSize(), event.inversePixelTransform].join('|');
                if (!clipPath || pathKey !== nextKey) {
                    pathKey = nextKey; clipPath = new Path2D();
                    const viewport = view.calculateExtent(state.map.getSize());
                    geometries.forEach((g) => {
                    // Rendering tolerance is a quarter pixel; membership always uses full ADM0 geometry.
                    const polygon = g.getSimplifiedGeometry(resolution * resolution / 16).getCoordinates();
                    [base - world, base, base + world].forEach((shift) => {
                        const extent = g.getExtent();
                        if (!ol.extent.intersects(viewport, [extent[0] + shift, extent[1], extent[2] + shift, extent[3]])) return;
                        polygon.forEach((ring) => {
                        ring.forEach((coordinate, i) => {
                            const pixel = state.map.getPixelFromCoordinate([coordinate[0] + shift, coordinate[1]]);
                            const p = ol.render.getRenderPixel(event, pixel);
                            if (i) clipPath.lineTo(p[0], p[1]); else clipPath.moveTo(p[0], p[1]);
                        }); clipPath.closePath();
                    }); });
                }); }
                context.clip(clipPath, 'evenodd');
            });
            layer.on('postrender', (event) => { if (saved) { event.context.restore(); saved = false; } });
        }
        function samplePoints(limit) {
            return geometries.slice().sort((a, b) => b.getArea() - a.getArea()).slice(0, limit)
                .map((g) => g.getInteriorPoint().getCoordinates().slice(0, 2)).filter(contains).map((p) => ol.proj.toLonLat(p));
        }
        return { load, bounds, contains, accepts, bind, samplePoints, subscribe: (fn) => listeners.add(fn),
            getState: () => ({ key, name, iso3, status, ready: status === 'ready', bounds: bounds() }) };
    }
    window.MpmAdm0MapScope = { create };
}());
