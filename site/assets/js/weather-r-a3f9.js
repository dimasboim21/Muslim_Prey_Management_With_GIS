(function (window) {
    'use strict';

    // Keep the displayed frame until every viewport tile of its replacement is ready.
    // A transparent (dry) tile is valid and replaces old rain, rather than accumulating it.
    function init(options) {
        const { ol, map, layers, onChange } = options;
        let displayed = null, requested = null, loading = false, transition = null, generation = 0;
        let cleanWait = null, viewportKey = '', failure = '';
        const cache = new Map();
        let loadingTiles = [];
        const snapshot = () => ({ displayedTime: displayed && displayed.time, requestedTime: requested && requested.time,
            loading, transitioning: transition !== null, layerCount: layers.getLength(), error: failure,
            tileStates: loadingTiles.map((tile) => tile.getState()) });
        const notify = () => { if (onChange) onChange(snapshot()); };
        function cancelWait() { if (cleanWait) cleanWait(); cleanWait = null; }
        function finishTransition() {
            if (transition !== null) cancelAnimationFrame(transition); transition = null;
            layers.getArray().slice().forEach((layer) => { if (!displayed || layer !== displayed.layer) layers.remove(layer); });
            if (displayed) { displayed.layer.setOpacity(1); if (!layers.getArray().includes(displayed.layer)) layers.push(displayed.layer); }
        }
        function clear() {
            ++generation; cancelWait(); displayed = null; requested = null; loading = false; failure = ''; viewportKey = '';
            finishTransition(); cache.clear(); loadingTiles = []; notify();
        }
        function promote(entry, id) {
            if (generation !== id) return;
            const previous = displayed;
            displayed = entry; loading = false; failure = '';
            if (previous === entry || !previous) {
                layers.getArray().slice().forEach((layer) => { if (layer !== entry.layer) layers.remove(layer); });
                entry.layer.setOpacity(1); if (!layers.getArray().includes(entry.layer)) layers.push(entry.layer); notify(); return;
            }
            entry.layer.setOpacity(0); layers.push(entry.layer);
            const start = performance.now();
            function fade(now) {
                if (generation !== id) return;
                const progress = Math.min(1, (now - start) / 180);
                previous.layer.setOpacity(1 - progress); entry.layer.setOpacity(progress);
                if (progress < 1) transition = requestAnimationFrame(fade);
                else { transition = null; layers.remove(previous.layer); entry.layer.setOpacity(1); notify(); }
            }
            transition = requestAnimationFrame(fade); notify();
        }
        function show(frame, config) {
            const view = map.getView(), extent = view.calculateExtent(map.getSize()), projection = view.getProjection();
            const key = config.url;
            let entry = cache.get(key);
            if (!entry) {
                const source = new ol.source.XYZ({ url: config.url, maxZoom: config.maxZoom, crossOrigin: 'anonymous',
                    transition: 0, attributions: config.attributions });
                // OL 10 caches rendered tiles in the renderer. Reuse our preloaded native
                // tile objects there too, so promotion cannot trigger a second empty load.
                const nativeGetTile = source.getTile.bind(source), nativeTiles = new Map();
                source.getTile = function (z, x, y, pixelRatio, projection) {
                    const tileKey = [z, x, y, projection.getCode()].join('/');
                    if (!nativeTiles.has(tileKey)) {
                        nativeTiles.set(tileKey, nativeGetTile(z, x, y, pixelRatio, projection));
                        if (nativeTiles.size > 96) nativeTiles.delete(nativeTiles.keys().next().value);
                    }
                    return nativeTiles.get(tileKey);
                };
                const layer = new ol.layer.Tile({ source, zIndex: 17 }); layer.set('weatherFrameTime', frame.time);
                entry = { time: frame.time, source, layer }; cache.set(key, entry);
                // Holds the complete two-hour radar loop to avoid repeat tile requests on each cycle.
                if (cache.size > 16) {
                    const oldest = Array.from(cache.keys()).find((name) => cache.get(name) !== displayed && name !== key);
                    if (oldest) cache.delete(oldest);
                }
            }
            const grid = entry.source.getTileGrid(), z = grid.getZForResolution(view.getResolution());
            const range = grid.getTileRangeForExtentAndZ(extent, z), full = grid.getFullTileRange(z);
            const nextViewport = [key, z, range.minX, range.maxX, range.minY, range.maxY].join(':');
            if (requested === entry && viewportKey === nextViewport && !failure) return;
            const id = ++generation; cancelWait(); finishTransition();
            requested = entry; viewportKey = nextViewport; loading = true; failure = ''; notify();
            const tiles = [], subscriptions = [];
            const minY = Math.max(range.minY, full.minY), maxY = Math.min(range.maxY, full.maxY);
            for (let x = range.minX; x <= range.maxX; x += 1) {
                for (let y = minY; y <= maxY; y += 1) {
                    tiles.push(entry.source.getTile(z, x, y, 1, projection));
                }
            }
            let timeout = null;
            loadingTiles = tiles;
            cleanWait = () => { subscriptions.forEach((unsubscribe) => unsubscribe()); clearTimeout(timeout); };
            function check(timedOut) {
                if (generation !== id) return;
                const states = tiles.map((tile) => tile.getState());
                if (states.some((state) => state === 0 || state === 1) && !timedOut) return;
                const failed = timedOut || states.some((state) => state === 3);
                cancelWait();
                if (failed) {
                    loading = false; failure = 'Frame cuaca belum lengkap; frame terakhir tetap ditampilkan.';
                    // Retry creates fresh tile objects, rather than keeping failed tiles in the loop cache.
                    if (displayed !== entry) cache.delete(key);
                    notify(); return;
                }
                promote(entry, id);
            }
            tiles.forEach((tile) => { const listener = () => check(false); tile.addEventListener('change', listener); subscriptions.push(() => tile.removeEventListener('change', listener)); });
            timeout = setTimeout(() => check(true), 20000);
            tiles.forEach((tile) => { if (tile.getState() === 0 || tile.getState() === 3) tile.load(); });
            check(false);
        }
        return { show, clear, getState: snapshot };
    }
    window.MpmWeatherRasterPlayer = { init };
}(window));
