/**
 * Route Builder - Route building and optimization UI logic
 */

class RouteBuilder {
    constructor(mapManager, optimizerClient, geotabApi) {
        this.mapManager = mapManager;
        this.optimizerClient = optimizerClient;
        this.geotabApi = geotabApi;

        this.stops = [];
        this.optimizedRoute = null;
        this.currentRouteId = null;

        this.setupEventListeners();
        this.setupMapClickHandler();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Add stop button
        document.getElementById('add-stop-btn').addEventListener('click', () => {
            this.showAddStopModal();
        });

        // Optimize button
        document.getElementById('optimize-btn').addEventListener('click', () => {
            this.optimizeRoute();
        });

        // Send to driver button
        document.getElementById('send-to-driver-btn').addEventListener('click', () => {
            this.sendToDriver();
        });

        // Clear button
        document.getElementById('clear-btn').addEventListener('click', () => {
            this.clearAll();
        });

        // Modal controls
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.hideAddStopModal();
        });

        document.getElementById('modal-cancel-btn').addEventListener('click', () => {
            this.hideAddStopModal();
        });

        document.getElementById('modal-add-btn').addEventListener('click', () => {
            this.addStopFromModal();
        });
    }

    /**
     * Setup map click handler for adding stops
     */
    setupMapClickHandler() {
        this.mapManager.setMapClickHandler((latlng) => {
            this.addStopFromMap(latlng.lat, latlng.lng);
        });
    }

    /**
     * Add stop from map click
     */
    addStopFromMap(lat, lon) {
        const stop = {
            lat: parseFloat(lat.toFixed(6)),
            lon: parseFloat(lon.toFixed(6)),
            name: `Stop ${this.stops.length + 1}`,
            serviceDuration: 10
        };

        this.addStop(stop);
    }

    /**
     * Add stop
     */
    addStop(stop) {
        this.stops.push(stop);
        this.updateUI();
        this.updateMap();

        window.showToast(`Added ${stop.name}`, 'success', 2000);
    }

    /**
     * Remove stop
     */
    removeStop(index) {
        this.stops.splice(index, 1);
        this.updateUI();
        this.updateMap();
    }

    /**
     * Update UI (stops list, buttons, etc.)
     */
    updateUI() {
        // Update stop count
        document.getElementById('stop-count').textContent = this.stops.length;

        // Update stops list
        const stopsList = document.getElementById('stops-list');
        if (this.stops.length === 0) {
            stopsList.innerHTML = '<div class="empty-state"><p>Click on the map to add stops</p></div>';
        } else {
            stopsList.innerHTML = this.stops.map((stop, i) => this.renderStopItem(stop, i)).join('');

            // Add event listeners to stop action buttons
            this.stops.forEach((_, i) => {
                const removeBtn = stopsList.querySelector(`[data-index="${i}"][data-action="remove"]`);
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => this.removeStop(i));
                }
            });
        }

        // Enable/disable optimize button
        document.getElementById('optimize-btn').disabled = this.stops.length < 2;

        // Hide send button if no optimized route
        document.getElementById('send-to-driver-btn').disabled = !this.optimizedRoute;
    }

    /**
     * Render stop item HTML
     */
    renderStopItem(stop, index) {
        const isOptimized = this.optimizedRoute && stop.order;

        return `
            <div class="stop-item ${isOptimized ? 'optimized' : ''}">
                <div class="stop-info">
                    <span class="stop-order">${isOptimized ? stop.order : index + 1}</span>
                    <div>
                        <div class="stop-name">${stop.name}</div>
                        <div class="stop-coords">${stop.lat.toFixed(5)}, ${stop.lon.toFixed(5)}</div>
                        ${stop.arrivalTime ? `<div class="stop-coords">ETA: ${new Date(stop.arrivalTime).toLocaleTimeString()}</div>` : ''}
                    </div>
                </div>
                <div class="stop-actions">
                    <button data-index="${index}" data-action="remove" title="Remove">🗑️</button>
                </div>
            </div>
        `;
    }

    /**
     * Update map with stops and route
     */
    updateMap() {
        // Clear existing markers and route
        this.mapManager.clearMarkers();
        this.mapManager.clearRoute();

        // Add markers for each stop
        this.stops.forEach((stop, i) => {
            const number = this.optimizedRoute && stop.order ? stop.order : i + 1;

            this.mapManager.addMarker(stop.lat, stop.lon, {
                number: number,
                popup: `
                    <div class="stop-popup">
                        <h4>${stop.name}</h4>
                        <p><strong>Coordinates:</strong> ${stop.lat.toFixed(5)}, ${stop.lon.toFixed(5)}</p>
                        ${stop.arrivalTime ? `<p><strong>ETA:</strong> ${new Date(stop.arrivalTime).toLocaleTimeString()}</p>` : ''}
                        ${stop.serviceDuration ? `<p><strong>Service:</strong> ${stop.serviceDuration} min</p>` : ''}
                    </div>
                `
            });
        });

        // Draw route if optimized
        if (this.optimizedRoute) {
            this.mapManager.drawRoute(this.stops);
        }

        // Fit map to show all markers
        if (this.stops.length > 0) {
            this.mapManager.fitToMarkers();
        }
    }

    /**
     * Optimize route
     */
    async optimizeRoute() {
        if (this.stops.length < 2) {
            window.showToast('At least 2 stops required', 'warning');
            return;
        }

        try {
            window.showLoading('Optimizing route with traffic data...');

            const vehicleId = document.getElementById('vehicle-select').value;
            const driverId = document.getElementById('driver-select').value;
            const routeName = document.getElementById('route-name').value || `Route ${new Date().toLocaleDateString()}`;

            const result = await this.optimizerClient.optimizeRoute(this.stops, {
                vehicleId,
                driverId,
                routeName,
                considerTraffic: true
            });

            window.hideLoading();

            // Update stops with optimized order
            this.stops = result.stops;
            this.optimizedRoute = result;
            this.currentRouteId = result.routeId;

            // Update UI and map
            this.updateUI();
            this.updateMap();

            // Show summary
            this.showRouteSummary(result);

            window.showToast(
                `Route optimized! Distance: ${result.totalDistanceKm}km, Duration: ${result.totalDurationMinutes}min`,
                'success',
                5000
            );

        } catch (error) {
            window.hideLoading();
            console.error('Optimization error:', error);
            window.showToast('Optimization failed: ' + error.message, 'error');
        }
    }

    /**
     * Show route summary
     */
    showRouteSummary(route) {
        const summary = document.getElementById('route-summary');
        summary.style.display = 'block';

        document.getElementById('total-distance').textContent = `${route.totalDistanceKm} km`;
        document.getElementById('total-duration').textContent = `${route.totalDurationMinutes} min`;
        document.getElementById('total-stops').textContent = route.stops.length;
    }

    /**
     * Send route to driver via Geotab Drive
     */
    async sendToDriver() {
        if (!this.optimizedRoute || !this.currentRouteId) {
            window.showToast('Please optimize the route first', 'warning');
            return;
        }

        const vehicleId = document.getElementById('vehicle-select').value;
        const driverId = document.getElementById('driver-select').value;

        if (!vehicleId || !driverId) {
            window.showToast('Please select vehicle and driver', 'warning');
            return;
        }

        try {
            window.showLoading('Sending route to Geotab Drive...');

            const result = await this.optimizerClient.sendToDriver(
                this.currentRouteId,
                driverId,
                vehicleId
            );

            window.hideLoading();

            window.showToast(
                'Route sent to driver successfully! Check Geotab Drive app.',
                'success',
                5000
            );

            console.log('Geotab Route ID:', result.geotabRouteId);

        } catch (error) {
            window.hideLoading();
            console.error('Send to driver error:', error);
            window.showToast('Failed to send route: ' + error.message, 'error');
        }
    }

    /**
     * Clear all stops and route
     */
    clearAll() {
        if (this.stops.length === 0) return;

        if (confirm('Are you sure you want to clear all stops?')) {
            this.stops = [];
            this.optimizedRoute = null;
            this.currentRouteId = null;

            this.updateUI();
            this.updateMap();

            // Hide summary
            document.getElementById('route-summary').style.display = 'none';

            window.showToast('All stops cleared', 'info');
        }
    }

    /**
     * Show add stop modal
     */
    showAddStopModal() {
        document.getElementById('add-stop-modal').style.display = 'flex';

        // Clear form
        document.getElementById('stop-name').value = '';
        document.getElementById('stop-address').value = '';
        document.getElementById('stop-lat').value = '';
        document.getElementById('stop-lon').value = '';
        document.getElementById('stop-duration').value = '10';
    }

    /**
     * Hide add stop modal
     */
    hideAddStopModal() {
        document.getElementById('add-stop-modal').style.display = 'none';
    }

    /**
     * Add stop from modal form
     */
    addStopFromModal() {
        const name = document.getElementById('stop-name').value.trim();
        const address = document.getElementById('stop-address').value.trim();
        const lat = parseFloat(document.getElementById('stop-lat').value);
        const lon = parseFloat(document.getElementById('stop-lon').value);
        const duration = parseInt(document.getElementById('stop-duration').value);

        if (!name || isNaN(lat) || isNaN(lon)) {
            window.showToast('Please fill in all required fields', 'warning');
            return;
        }

        const stop = {
            name,
            address,
            lat,
            lon,
            serviceDuration: duration
        };

        this.addStop(stop);
        this.hideAddStopModal();
    }

    /**
     * Refresh data (called when Add-In receives focus)
     */
    refreshData() {
        console.log('Refreshing route builder data...');
        // Implement any refresh logic if needed
    }
}

// Export
window.RouteBuilder = RouteBuilder;
