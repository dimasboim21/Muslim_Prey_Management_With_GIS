/**
 * ========================================
 * KML VIEWER HANDLER
 * Module untuk menangani visualisasi KML polygon di peta
 * ======================================== 
 */

const KML_VIEWER_ICON_BASE_PATH = 'map/places/';
const KML_VIEWER_ICON_SIZE_SCALE = 0.4;

class KMLViewerHandler {
    constructor(mapInstance, containerElementId) {
        this.map = mapInstance;
        this.containerElementId = containerElementId;
        this.featureSource = new ol.source.Vector();
        this.selectedFeature = null;
        this.hoveredFeature = null;
        this.featureStyle = this.createFeatureStyles();
        this.stats = {
            total: 0,
            continents: {},
            countries: {}
        };

        this.customMarkerSource = new ol.source.Vector();
        this.customMarkerLayer = new ol.layer.Vector({
            source: this.customMarkerSource,
            zIndex: 15
        });

        this.kaabahMarker = null;
        this.iconConfig = {};

        this.featureLayer = new ol.layer.Vector({
            source: this.featureSource,
            style: (feature) => this.getFeatureStyle(feature),
            zIndex: 10
        });

        this.map.addLayer(this.featureLayer);
        this.map.addLayer(this.customMarkerLayer);

        this.setupInteractions();
    }

    setIconsConfig(config) {
        this.iconConfig = config || {};
    }

getIconPath(type) {
         if (this.iconConfig[type]) {
             return this.resolveIconPath(this.iconConfig[type]);
         }
         var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M32 4 C18 4 8 14 8 28 C8 42 20 56 32 60 C44 56 56 42 56 28 C56 14 46 4 32 4 Z" fill="none" stroke="#1a1a2e" stroke-width="2.5"/><path d="M32 10 L32 30 L38 30 L38 34 L26 34 L26 30 L32 30 Z" fill="none" stroke="#1a1a2e" stroke-width="1.5"/><path d="M24 22 L40 22 M24 26 L40 26 M24 30 L40 30" stroke="#1a1a2e" stroke-width="1" fill="none" opacity="0.4"/><line x1="32" y1="4" x2="32" y2="24" stroke="#1a1a2e" stroke-width="1" opacity="0.5"/></svg>';
         return 'data:image/svg+xml,' + encodeURIComponent(svg);
     }

    resolveIconPath(iconPath) {
        var value = String(iconPath || '');
        if (/^(?:https?:|data:|\/)/i.test(value) || value.indexOf('/') >= 0) {
            return value;
        }

        return KML_VIEWER_ICON_BASE_PATH + value;
    }

    createIconStyle(iconPath, size) {
        var s = (size || 24) * KML_VIEWER_ICON_SIZE_SCALE;
        var self = this;
        return function(feature, resolution) {
            var zoom = self.map.getView().getZoomForResolution(resolution);
            if (!Number.isFinite(zoom)) {
                zoom = self.map.getView().getZoom() || 8;
            }
            var zoomFactor = Math.max(0.35, Math.min(1.65, 1 + ((8 - zoom) * 0.1)));
            var scale = Math.max(0.035, Math.min(0.32, (s / 64) * zoomFactor));
            return new ol.style.Style({
                image: new ol.style.Icon({
                    src: self.resolveIconPath(iconPath),
                    scale: scale,
                    anchor: [0.5, 0.5],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'fraction'
                }),
                text: new ol.style.Text({
                    text: feature.get('label') || '',
                    offsetY: scale * (s / 2) + 8,
                    fill: new ol.style.Fill({ color: '#183b33' }),
                    stroke: new ol.style.Stroke({ color: 'rgba(255,255,255,0.9)', width: 4 }),
                    font: '700 13px Arial, sans-serif',
                    textAlign: 'center'
                })
            });
        };
    }

    addKaabaMarker(lat, lon, label) {
        if (this.kaabahMarker) {
            this.customMarkerSource.removeFeature(this.kaabahMarker);
        }
        var kaabahCoord = ol.proj.fromLonLat([lon, lat]);
        this.kaabahMarker = new ol.Feature({
            geometry: new ol.geom.Point(kaabahCoord),
            name: label || 'Kaabah',
            type: 'kaabah',
            label: label || 'Kaabah'
        });
        this.kaabahMarker.setStyle(this.createIconStyle(this.getIconPath('kaabah'), 28));
        this.customMarkerSource.addFeature(this.kaabahMarker);
        return this.kaabahMarker;
    }

    addBuildingMarker(lat, lon, type, name) {
        var iconType = type || 'mosque';
        var iconPath = this.getIconPath(iconType);
        var coord = ol.proj.fromLonLat([lon, lat]);
        var marker = new ol.Feature({
            geometry: new ol.geom.Point(coord),
            name: name || 'Building',
            type: 'building',
            buildingType: iconType,
            label: name || ''
        });
        marker.setStyle(this.createIconStyle(iconPath, 32));
        this.customMarkerSource.addFeature(marker);
        return marker;
    }

    addUserMarker(lat, lon, icon, name) {
        var iconPath = icon || this.getIconPath('mosque');
        var coord = ol.proj.fromLonLat([lon, lat]);
        var marker = new ol.Feature({
            geometry: new ol.geom.Point(coord),
            name: name || 'Marker',
            type: 'user',
            label: name || ''
        });
        marker.setStyle(this.createIconStyle(iconPath, 26));
        this.customMarkerSource.addFeature(marker);
        return marker;
    }

    loadUserMarkersFromAPI(apiUrl) {
        var self = this;
        return fetch(apiUrl)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('HTTP error: ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                var markers = data.markers || [];
                for (var i = 0; i < markers.length; i++) {
                    var m = markers[i];
                    if (m.type === 'fixed') {
                        self.addKaabaMarker(m.latitude, m.longitude, m.name);
                    } else {
                        self.addUserMarker(m.latitude, m.longitude, m.icon, m.name);
                    }
                }
                return markers;
            })
            .catch(function(error) {
                console.warn('Failed to load user markers:', error);
                return [];
            });
    }

    clearCustomMarkers() {
        this.customMarkerSource.clear();
        this.kaabahMarker = null;
    }

    removeKaabaMarker() {
        if (this.kaabahMarker) {
            this.customMarkerSource.removeFeature(this.kaabahMarker);
            this.kaabahMarker = null;
        }
    }

    removeCustomMarker(marker) {
        if (marker) {
            this.customMarkerSource.removeFeature(marker);
        }
    }
    
    /**
     * Setup map interactions (hover, click)
     */
    setupInteractions() {
        // Hover polygon: show country name and change cursor.
        this.map.on('pointermove', (event) => this.handlePointerMove(event));

        // Click polygon: replace the current info-box with the clicked feature.
        this.map.on('click', (event) => this.handleMapClick(event));
    }

    /**
     * Get top KML feature at pixel.
     */
    getFeatureAtPixel(pixel) {
        return this.map.forEachFeatureAtPixel(
            pixel,
            (feature) => feature,
            {
                layerFilter: (layer) => layer === this.featureLayer,
                hitTolerance: 3
            }
        ) || null;
    }

    /**
     * Handle pointer move for hover state.
     */
    handlePointerMove(event) {
        if (event.dragging) {
            return;
        }

        const feature = this.getFeatureAtPixel(event.pixel);
        const target = this.map.getTargetElement();

        if (this.hoveredFeature && this.hoveredFeature !== feature) {
            this.hoveredFeature.set('hovered', false);
        }

        this.hoveredFeature = feature;

        if (feature) {
            feature.set('hovered', true);
            this.showHoverPopup(feature, event.coordinate);
            target.style.cursor = 'pointer';
        } else {
            this.hideHoverPopup();
            target.style.cursor = '';
        }

        this.featureSource.changed();
    }
    
    /**
     * Create or update hover popup element
     */
    createHoverPopup() {
        if (!this.hoverPopup) {
            const popupElement = document.createElement('div');
            popupElement.id = 'kml-hover-popup';
            popupElement.style.cssText = `
                position: absolute;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 12px;
                pointer-events: none;
                z-index: 2500;
                max-width: 200px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            `;
            document.body.appendChild(popupElement);
            
            this.hoverPopup = new ol.Overlay({
                element: popupElement,
                offset: [10, -20],
                positioning: 'bottom-left'
            });
            this.map.addOverlay(this.hoverPopup);
        }
        
        return this.hoverPopup;
    }
    
    /**
     * Show hover popup dengan country name
     */
    showHoverPopup(feature, coordinate) {
        const popup = this.createHoverPopup();
        const props = feature.getProperties();
        const countryName = this.getCountryName(props);
        
        const popupElement = popup.getElement();
        popupElement.textContent = countryName;

        if (coordinate) {
            popup.setPosition(coordinate);
        }
    }
    
    /**
     * Hide hover popup
     */
    hideHoverPopup() {
        if (this.hoverPopup) {
            this.hoverPopup.setPosition(undefined);
        }

        if (this.hoveredFeature) {
            this.hoveredFeature.set('hovered', false);
            this.hoveredFeature = null;
            this.featureSource.changed();
        }
    }
    
    /**
     * Create style definitions untuk features
     */
    createFeatureStyles() {
        return {
            default: {
                fill: new ol.style.Fill({
                    color: 'rgba(77, 148, 212, 0.4)'
                }),
                stroke: new ol.style.Stroke({
                    color: '#2c5aa0',
                    width: 2
                })
            },
            hover: {
                fill: new ol.style.Fill({
                    color: 'rgba(220, 53, 69, 0.6)'
                }),
                stroke: new ol.style.Stroke({
                    color: '#dc3545',
                    width: 3
                })
            },
            selected: {
                fill: new ol.style.Fill({
                    color: 'rgba(40, 167, 69, 0.5)'
                }),
                stroke: new ol.style.Stroke({
                    color: '#28a745',
                    width: 3
                })
            }
        };
    }
    
    /**
     * Get style untuk feature berdasarkan state-nya
     */
    getFeatureStyle(feature) {
        let styleConfig = this.featureStyle.default;
        
        if (feature.get('selected')) {
            styleConfig = this.featureStyle.selected;
        } else if (feature.get('hovered')) {
            styleConfig = this.featureStyle.hover;
        }
        
        return new ol.style.Style({
            fill: styleConfig.fill,
            stroke: styleConfig.stroke
        });
    }
    
    /**
     * Style untuk hover state
     */
    getHoverStyle(feature) {
        if (!feature) return null;
        
        return new ol.style.Style({
            fill: this.featureStyle.hover.fill,
            stroke: this.featureStyle.hover.stroke
        });
    }
    
    /**
     * Load KML features dari API endpoint
     */
    async loadFeaturesFromAPI(apiUrl, continent = null) {
        try {
            console.log('Loading KML features from API...');
            this.showLoadingIndicator(true);
            
            let url = apiUrl + '?format=geojson';
            if (continent) {
                url += '&continent=' + encodeURIComponent(continent);
            }
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const geojson = await response.json();
            
            if (!geojson.success || !geojson.features) {
                throw new Error(geojson.error || 'Unknown error');
            }
            
            console.log('✓ Loaded ' + geojson.features.length + ' features');
            this.addFeaturesToMap(geojson);
            this.updateStats(geojson);
            this.showLoadingIndicator(false);
            
            return geojson;
        } catch (error) {
            console.error('❌ Error loading KML features:', error);
            this.showError(error.message);
            this.showLoadingIndicator(false);
            throw error;
        }
    }
    
    /**
     * Add features dari GeoJSON ke peta
     */
    addFeaturesToMap(geojson) {
        if (!geojson.features || geojson.features.length === 0) {
            console.warn('⚠️ No features found');
            return;
        }
        
        // Clear existing features
        this.hideFeatureInfo();
        this.hideHoverPopup();
        this.featureSource.clear();
        
        // Add each feature
        const features = [];
        for (const geoFeature of geojson.features) {
            try {
                const olFeature = this.createOLFeature(geoFeature);
                features.push(olFeature);
            } catch (e) {
                console.warn('⚠️ Failed to parse feature:', geoFeature.properties?.feature_name, e);
            }
        }
        
        this.featureSource.addFeatures(features);
        console.log('✓ Added ' + features.length + ' features to map');
        
        // Fit map to extent
        if (features.length > 0) {
            this.fitToExtent();
        }
    }
    
    /**
     * Create OpenLayers Feature dari GeoJSON feature
     */
    createOLFeature(geoFeature) {
        try {
            // Parse geometry directly
            const geometry = this.createGeometryFromGeoJSON(geoFeature.geometry);
            
            if (!geometry) {
                throw new Error('Failed to create geometry');
            }
            
            // Create OL Feature
            const olFeature = new ol.Feature({
                geometry: geometry
            });
            
            // Set properties dari GeoJSON
            olFeature.setProperties({
                featureId: geoFeature.id,
                ...geoFeature.properties
            });
            
            return olFeature;
        } catch (e) {
            console.error('Error creating OL feature:', e);
            throw e;
        }
    }
    
    /**
     * Create geometry dari GeoJSON geometry object
     */
    createGeometryFromGeoJSON(geoGeometry) {
        if (!geoGeometry || !geoGeometry.type) {
            return null;
        }
        
        try {
            const coordinates = geoGeometry.coordinates || [];
            let geometry = null;
            
            // Transform coordinates dari EPSG:4326 ke EPSG:3857
            const transform = ol.proj.getTransform('EPSG:4326', 'EPSG:3857');
            
            switch (geoGeometry.type.toUpperCase()) {
                case 'POINT':
                    const point = coordinates;
                    geometry = new ol.geom.Point(point).transform('EPSG:4326', 'EPSG:3857');
                    break;
                    
                case 'LINESTRING':
                    geometry = new ol.geom.LineString(coordinates).transform('EPSG:4326', 'EPSG:3857');
                    break;
                    
                case 'POLYGON':
                    // Polygon: [[[lon, lat], [lon, lat], ...]]
                    geometry = new ol.geom.Polygon(coordinates).transform('EPSG:4326', 'EPSG:3857');
                    break;
                    
                case 'MULTIPOINT':
                    // MultiPoint: [[lon, lat], [lon, lat]]
                    geometry = new ol.geom.MultiPoint(coordinates).transform('EPSG:4326', 'EPSG:3857');
                    break;
                    
                case 'MULTILINESTRING':
                    geometry = new ol.geom.MultiLineString(coordinates).transform('EPSG:4326', 'EPSG:3857');
                    break;
                    
                case 'MULTIPOLYGON':
                    // MultiPolygon: [[[[lon, lat], ...]],  [[[lon, lat], ...]]]
                    geometry = new ol.geom.MultiPolygon(coordinates).transform('EPSG:4326', 'EPSG:3857');
                    break;
                    
                default:
                    console.warn('Unknown geometry type:', geoGeometry.type);
                    return null;
            }
            
            return geometry;
        } catch (e) {
            console.error('Error creating geometry from GeoJSON:', e, geoGeometry);
            return null;
        }
    }
    
    /**
     * Handle map click untuk select feature
     */
    handleMapClick(event) {
        const feature = this.getFeatureAtPixel(event.pixel);
        
        // Deselect previous feature
        if (this.selectedFeature && this.selectedFeature !== feature) {
            this.selectedFeature.set('selected', false);
        }
        
        // Select new feature
        if (feature) {
            this.selectedFeature = feature;
            this.selectedFeature.set('selected', true);
            this.showFeatureInfo(this.selectedFeature);
        } else {
            this.hideFeatureInfo();
        }
        
        // Refresh styles
        this.featureSource.changed();
    }
    
    /**
     * Show feature info di info panel
     */
    showFeatureInfo(feature) {
        const props = feature.getProperties();
        const containerEl = document.getElementById(this.containerElementId);
        
        if (!containerEl) return;

        const countryName = this.getCountryName(props);
        const continentName = this.formatValue(props.continent_name || props.continent || 'N/A');
        const countryId = this.formatValue(props.country_id || props.country_code || props.ISO || props.iso3 || 'N/A');
        const continentId = this.formatValue(props.continent_id || (continentName !== 'N/A' ? this.toId(continentName) : 'N/A'));
        const featureId = this.formatValue(props.feature_id || props.featureId || 'N/A');
        const featureType = this.formatValue(props.feature_type || feature.getGeometry()?.getType() || 'N/A');
        
        const html = `
            <div class="kml-feature-info active">
                <div class="kml-info-header">
                    <h3 title="${this.escapeHTML(countryName)}">${this.escapeHTML(countryName)}</h3>
                    <button class="kml-info-close" type="button" aria-label="Close info" onclick="window.kmlViewer.hideFeatureInfo()">&times;</button>
                </div>
                
                <div class="kml-info-body">
                    <div class="kml-info-row">
                        <span class="kml-info-label">Country:</span>
                        <span class="kml-info-value">${this.escapeHTML(countryName)}</span>
                    </div>
                    
                    <div class="kml-info-row">
                        <span class="kml-info-label">Country ID:</span>
                        <span class="kml-info-value">${this.escapeHTML(countryId)}</span>
                    </div>
                    
                    <div class="kml-info-row">
                        <span class="kml-info-label">Continent:</span>
                        <span class="kml-info-value">${this.escapeHTML(continentName)}</span>
                    </div>
                    
                    <div class="kml-info-row">
                        <span class="kml-info-label">Continent ID:</span>
                        <span class="kml-info-value">${this.escapeHTML(continentId)}</span>
                    </div>

                    <div class="kml-info-row">
                        <span class="kml-info-label">Feature ID:</span>
                        <span class="kml-info-value">${this.escapeHTML(featureId)}</span>
                    </div>

                    <div class="kml-info-row">
                        <span class="kml-info-label">Type:</span>
                        <span class="kml-info-value">${this.escapeHTML(featureType)}</span>
                    </div>
                </div>
            </div>
        `;
        
        containerEl.innerHTML = html;
    }

    /**
     * Get country name from normalized API properties or raw KML properties.
     */
    getCountryName(props) {
        return this.formatValue(
            props.country_name ||
            props.name ||
            props.COUNTRY ||
            props.COUNTRYAFF ||
            props.feature_name ||
            'Unknown'
        );
    }

    /**
     * Safe text helpers for info-box output.
     */
    formatValue(value) {
        if (value === null || value === undefined || value === '') {
            return 'N/A';
        }

        return String(value);
    }

    escapeHTML(value) {
        return this.formatValue(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    toId(value) {
        return this.formatValue(value)
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }
    
    /**
     * Hide feature info
     */
    hideFeatureInfo() {
        const containerEl = document.getElementById(this.containerElementId);
        if (containerEl) {
            containerEl.innerHTML = '';
        }
        
        if (this.selectedFeature) {
            this.selectedFeature.set('selected', false);
            this.featureSource.changed();
            this.selectedFeature = null;
        }
    }
    
    /**
     * Zoom ke feature
     */
    zoomToFeature(feature) {
        const extent = feature.getGeometry().getExtent();
        this.map.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 500
        });
    }
    
    /**
     * Fit map ke extent semua features
     */
    fitToExtent() {
        const extent = this.featureSource.getExtent();
        if (extent[0] !== Infinity) {
            this.map.getView().fit(extent, {
                padding: [50, 50, 50, 50],
                duration: 500
            });
        }
    }
    
    /**
     * Update statistics
     */
    updateStats(geojson) {
        this.stats.total = geojson.features.length;
        this.stats.continents = {};
        this.stats.countries = {};
        
        for (const feature of geojson.features) {
            const continent = feature.properties.continent_name;
            const country = feature.properties.country_name;
            
            if (continent) {
                this.stats.continents[continent] = (this.stats.continents[continent] || 0) + 1;
            }
            if (country) {
                this.stats.countries[country] = (this.stats.countries[country] || 0) + 1;
            }
        }
        
        console.log('📊 Statistics:', this.stats);
    }
    
    /**
     * Get stats
     */
    getStats() {
        return this.stats;
    }
    
    /**
     * Show loading indicator
     */
    showLoadingIndicator(show) {
        const indicator = document.getElementById('kml-loading-indicator');
        if (indicator) {
            indicator.style.display = show ? 'flex' : 'none';
        }
    }
    
    /**
     * Show error message
     */
    showError(message) {
        const errorEl = document.getElementById('kml-error-message');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }
    
    /**
     * Export current features sebagai GeoJSON
     */
    exportAsGeoJSON() {
        const format = new ol.format.GeoJSON();
        const features = this.featureSource.getFeatures();
        const geojson = format.writeFeaturesObject(features, {
            featureProjection: 'EPSG:3857'
        });
        
        return geojson;
    }
    
    /**
     * Export current features sebagai CSV
     */
    exportAsCSV() {
        const features = this.featureSource.getFeatures();
        let csv = 'ID,Name,Type,Country,Continent,Lat,Lon\n';
        
        for (const feature of features) {
            const props = feature.getProperties();
            csv += `${props.featureId},"${props.feature_name}","${props.feature_type}","${props.country_name}","${props.continent_name}",${props.center_lat},${props.center_lon}\n`;
        }
        
        return csv;
    }
}

// Export untuk global access
window.KMLViewerHandler = KMLViewerHandler;
