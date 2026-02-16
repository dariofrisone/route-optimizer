/**
 * Map Manager - Leaflet map integration
 */

class MapManager {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.center = options.center || [45.4642, 9.1900]; // Milan, Italy
        this.zoom = options.zoom || 7;

        this.map = null;
        this.markers = [];
        this.polyline = null;
        this.trafficLayer = null;
        this.trafficEnabled = false;

        this.initialize();
        this.setupEventHandlers();
    }

    /**
     * Initialize Leaflet map
     */
    initialize() {
        // Create map
        this.map = L.map(this.containerId, {
            center: this.center,
            zoom: this.zoom,
            zoomControl: true
        });

        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        console.log('✓ Map initialized');
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Map click to add stops
        this.map.on('click', (e) => {
            if (this.onMapClick) {
                this.onMapClick(e.latlng);
            }
        });

        // Traffic toggle button
        document.getElementById('toggle-traffic-btn').addEventListener('click', () => {
            this.toggleTraffic();
        });

        // Refresh traffic button
        document.getElementById('refresh-traffic-btn').addEventListener('click', () => {
            this.refreshTraffic();
        });
    }

    /**
     * Add marker to map
     */
    addMarker(lat, lon, options = {}) {
        const marker = L.marker([lat, lon], {
            draggable: options.draggable || false,
            icon: this.createNumberedIcon(options.number),
            ...options
        }).addTo(this.map);

        if (options.popup) {
            marker.bindPopup(options.popup);
        }

        if (options.onDragEnd) {
            marker.on('dragend', (e) => {
                const pos = e.target.getLatLng();
                options.onDragEnd(pos.lat, pos.lng);
            });
        }

        this.markers.push(marker);
        return marker;
    }

    /**
     * Create numbered icon for stop markers
     */
    createNumberedIcon(number) {
        if (!number) {
            return L.Icon.Default();
        }

        const iconHtml = `
            <div style="
                background: #0066cc;
                color: white;
                width: 32px;
                height: 32px;
                border-radius: 50% 50% 50% 0;
                border: 2px solid white;
                text-align: center;
                line-height: 32px;
                font-weight: bold;
                font-size: 14px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                transform: rotate(-45deg);
            ">
                <span style="transform: rotate(45deg); display: inline-block;">${number}</span>
            </div>
        `;

        return L.divIcon({
            html: iconHtml,
            className: 'numbered-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });
    }

    /**
     * Remove all markers
     */
    clearMarkers() {
        this.markers.forEach(marker => marker.remove());
        this.markers = [];
    }

    /**
     * Draw route polyline
     */
    drawRoute(coordinates, options = {}) {
        // Remove existing polyline
        if (this.polyline) {
            this.polyline.remove();
        }

        // Convert coordinates to LatLng array
        const latLngs = coordinates.map(coord => [coord.lat, coord.lon]);

        // Draw polyline
        this.polyline = L.polyline(latLngs, {
            color: options.color || '#0066cc',
            weight: options.weight || 4,
            opacity: options.opacity || 0.7,
            smoothFactor: 1
        }).addTo(this.map);

        // Fit bounds to show entire route
        if (options.fitBounds !== false) {
            this.map.fitBounds(this.polyline.getBounds(), {
                padding: [50, 50]
            });
        }
    }

    /**
     * Clear route polyline
     */
    clearRoute() {
        if (this.polyline) {
            this.polyline.remove();
            this.polyline = null;
        }
    }

    /**
     * Toggle traffic layer
     */
    toggleTraffic() {
        this.trafficEnabled = !this.trafficEnabled;

        if (this.trafficEnabled) {
            this.showTraffic();
        } else {
            this.hideTraffic();
        }

        // Update button
        const btn = document.getElementById('toggle-traffic-btn');
        btn.style.background = this.trafficEnabled ? '#0066cc' : '';
        btn.style.color = this.trafficEnabled ? 'white' : '';
    }

    /**
     * Show traffic overlay
     */
    async showTraffic() {
        try {
            const bounds = this.map.getBounds();
            const apiClient = window.routeOptimizer.optimizerClient;

            // Fetch traffic data
            const traffic = await apiClient.get('/traffic/area', {
                latMin: bounds.getSouth(),
                latMax: bounds.getNorth(),
                lonMin: bounds.getWest(),
                lonMax: bounds.getEast()
            });

            // Update cache indicator
            document.getElementById('cache-indicator').textContent =
                `Cache: ${traffic.cacheHitRate}%`;

            // Visualize traffic (simple heat map approach)
            // In production, you'd render actual traffic incidents and flow data
            this.visualizeTraffic(traffic.trafficData);

            window.showToast('Traffic data loaded', 'success', 3000);

        } catch (error) {
            console.error('Failed to load traffic:', error);
            window.showToast('Failed to load traffic data', 'error');
            this.trafficEnabled = false;
        }
    }

    /**
     * Hide traffic overlay
     */
    hideTraffic() {
        if (this.trafficLayer) {
            this.trafficLayer.remove();
            this.trafficLayer = null;
        }
    }

    /**
     * Visualize traffic data on map
     */
    visualizeTraffic(trafficData) {
        // Remove existing layer
        if (this.trafficLayer) {
            this.trafficLayer.remove();
        }

        // Create layer group for traffic
        this.trafficLayer = L.layerGroup().addTo(this.map);

        // Render incidents as markers
        Object.values(trafficData).forEach(cellData => {
            if (cellData.incidents && cellData.incidents.length > 0) {
                cellData.incidents.forEach(incident => {
                    const coords = incident.geometry?.coordinates;
                    if (coords && coords[0]) {
                        const [lon, lat] = coords[0];

                        const marker = L.circleMarker([lat, lon], {
                            radius: 8,
                            fillColor: this.getIncidentColor(incident.properties?.iconCategory),
                            color: '#fff',
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0.8
                        });

                        const popupContent = `
                            <div class="stop-popup">
                                <h4>${incident.properties?.iconCategory || 'Traffic Incident'}</h4>
                                <p>${incident.properties?.events?.[0]?.description || 'No details'}</p>
                            </div>
                        `;

                        marker.bindPopup(popupContent);
                        marker.addTo(this.trafficLayer);
                    }
                });
            }
        });
    }

    /**
     * Get color for incident type
     */
    getIncidentColor(category) {
        const colors = {
            'ACCIDENT': '#dc3545',
            'ROADWORK': '#ffc107',
            'CONGESTION': '#ff6b6b',
            'CLOSURE': '#e74c3c',
            'default': '#f39c12'
        };

        return colors[category] || colors.default;
    }

    /**
     * Refresh traffic data
     */
    async refreshTraffic() {
        if (!this.trafficEnabled) {
            window.showToast('Traffic layer is not enabled', 'info');
            return;
        }

        window.showLoading('Refreshing traffic data...');
        await this.showTraffic();
        window.hideLoading();
    }

    /**
     * Fit map to show all markers
     */
    fitToMarkers() {
        if (this.markers.length === 0) return;

        const group = L.featureGroup(this.markers);
        this.map.fitBounds(group.getBounds(), {
            padding: [50, 50]
        });
    }

    /**
     * Set callback for map click
     */
    setMapClickHandler(callback) {
        this.onMapClick = callback;
    }
}

// Export
window.MapManager = MapManager;
