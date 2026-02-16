// Simple Route Optimizer - Frontend Only
// No backend required, works directly from GitHub Pages

// Global state
let map;
let stops = [];
let optimizedStops = [];
let markers = [];
let routeLine = null;
let geotabApi = null;
let tomtomKey = '';

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    initializeMap();
    loadSettings();
    initializeGeotab();
});

// Initialize map
function initializeMap() {
    map = L.map('map').setView([45.4642, 9.1900], 7); // Center on Milan, Italy

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    map.on('click', (e) => {
        addStop(e.latlng.lat, e.latlng.lng);
    });
}

// Load settings from localStorage
function loadSettings() {
    tomtomKey = localStorage.getItem('tomtomApiKey') || '';
    document.getElementById('tomtom-key').value = tomtomKey;

    if (!tomtomKey) {
        document.getElementById('setup-notice').style.display = 'block';
    }
}

// Save settings
function saveSettings() {
    tomtomKey = document.getElementById('tomtom-key').value.trim();

    if (tomtomKey) {
        localStorage.setItem('tomtomApiKey', tomtomKey);
        document.getElementById('setup-notice').style.display = 'none';
        showToast('Settings saved!', 'success');
    } else {
        showToast('Please enter a valid API key', 'error');
    }
}

// Initialize MyGeotab integration
function initializeGeotab() {
    if (typeof window.geotab !== 'undefined' && window.geotab.addin) {
        window.geotab.addin.routeOptimizer = (api, state) => {
            geotabApi = api;
            loadVehiclesAndDrivers();
        };
    } else {
        // Standalone mode (not in MyGeotab)
        console.log('Running in standalone mode');
    }
}

// Load vehicles and drivers from MyGeotab
async function loadVehiclesAndDrivers() {
    if (!geotabApi) return;

    try {
        // Load vehicles
        const vehicles = await geotabApi.call('Get', {
            typeName: 'Device'
        });

        const vehicleSelect = document.getElementById('vehicle-select');
        vehicleSelect.innerHTML = '<option value="">Select vehicle...</option>';
        vehicles.forEach(v => {
            const option = document.createElement('option');
            option.value = v.id;
            option.textContent = v.name || v.serialNumber;
            vehicleSelect.appendChild(option);
        });

        // Load drivers
        const drivers = await geotabApi.call('Get', {
            typeName: 'User',
            search: { isDriver: true }
        });

        const driverSelect = document.getElementById('driver-select');
        driverSelect.innerHTML = '<option value="">Select driver...</option>';
        drivers.forEach(d => {
            const option = document.createElement('option');
            option.value = d.id;
            option.textContent = d.name || `${d.firstName} ${d.lastName}`;
            driverSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Failed to load vehicles/drivers:', error);
    }
}

// Add stop
function addStop(lat, lon) {
    const stop = {
        id: Date.now(),
        lat: parseFloat(lat.toFixed(6)),
        lon: parseFloat(lon.toFixed(6)),
        name: `Stop ${stops.length + 1}`
    };

    stops.push(stop);
    updateUI();
    showToast(`Added ${stop.name}`, 'success', 2000);
}

// Remove stop
function removeStop(id) {
    stops = stops.filter(s => s.id !== id);
    optimizedStops = [];
    updateUI();
}

// Update UI
function updateUI() {
    // Update stop count
    document.getElementById('stop-count').textContent = stops.length;

    // Update stops list
    const stopsList = document.getElementById('stops-list');
    if (stops.length === 0) {
        stopsList.innerHTML = '<div class="empty-state">Click map to add stops</div>';
    } else {
        const displayStops = optimizedStops.length > 0 ? optimizedStops : stops;
        stopsList.innerHTML = displayStops.map((stop, idx) => `
            <div class="stop-item ${optimizedStops.length > 0 ? 'optimized' : ''}">
                <div>
                    <span class="stop-number">${idx + 1}</span>
                    <strong>${stop.name}</strong><br>
                    <small>${stop.lat.toFixed(5)}, ${stop.lon.toFixed(5)}</small>
                </div>
                <button class="stop-remove" onclick="removeStop(${stop.id})">✕</button>
            </div>
        `).join('');
    }

    // Update map
    updateMap();

    // Enable/disable buttons
    document.getElementById('optimize-btn').disabled = stops.length < 2 || !tomtomKey;
    document.getElementById('send-btn').disabled = optimizedStops.length === 0;
}

// Update map markers and route
function updateMap() {
    // Clear existing markers
    markers.forEach(m => m.remove());
    markers = [];

    // Clear route line
    if (routeLine) {
        routeLine.remove();
        routeLine = null;
    }

    // Add markers
    const displayStops = optimizedStops.length > 0 ? optimizedStops : stops;
    displayStops.forEach((stop, idx) => {
        const marker = L.marker([stop.lat, stop.lon], {
            icon: createNumberIcon(idx + 1)
        }).addTo(map);

        marker.bindPopup(`
            <strong>${stop.name}</strong><br>
            ${stop.lat.toFixed(5)}, ${stop.lon.toFixed(5)}
        `);

        markers.push(marker);
    });

    // Draw route if optimized
    if (optimizedStops.length > 0) {
        const coords = optimizedStops.map(s => [s.lat, s.lon]);
        routeLine = L.polyline(coords, {
            color: '#0066cc',
            weight: 4,
            opacity: 0.7
        }).addTo(map);

        map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
    } else if (stops.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
}

// Create numbered icon
function createNumberIcon(number) {
    return L.divIcon({
        html: `
            <div style="
                background: #0066cc;
                color: white;
                width: 28px;
                height: 28px;
                border-radius: 50% 50% 50% 0;
                border: 2px solid white;
                text-align: center;
                line-height: 28px;
                font-weight: bold;
                font-size: 12px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                transform: rotate(-45deg);
            ">
                <span style="transform: rotate(45deg); display: inline-block;">${number}</span>
            </div>
        `,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28]
    });
}

// Optimize route (simple nearest neighbor algorithm)
async function optimizeRoute() {
    if (stops.length < 2) {
        showToast('Add at least 2 stops', 'error');
        return;
    }

    if (!tomtomKey) {
        showToast('Please enter TomTom API key in settings', 'error');
        document.getElementById('setup-notice').style.display = 'block';
        return;
    }

    showToast('Optimizing route...', 'info');

    try {
        // Simple nearest neighbor optimization
        optimizedStops = [stops[0]];
        let remaining = stops.slice(1);

        while (remaining.length > 0) {
            const current = optimizedStops[optimizedStops.length - 1];
            let nearestIdx = 0;
            let minDist = distance(current, remaining[0]);

            for (let i = 1; i < remaining.length; i++) {
                const dist = distance(current, remaining[i]);
                if (dist < minDist) {
                    minDist = dist;
                    nearestIdx = i;
                }
            }

            optimizedStops.push(remaining[nearestIdx]);
            remaining.splice(nearestIdx, 1);
        }

        // Calculate total distance and duration
        let totalDistance = 0;
        let totalDuration = 0;

        for (let i = 0; i < optimizedStops.length - 1; i++) {
            const dist = distance(optimizedStops[i], optimizedStops[i + 1]);
            totalDistance += dist;
            totalDuration += dist / 60; // Rough estimate: 60 km/h average
        }

        // Update summary
        document.getElementById('total-distance').textContent = totalDistance.toFixed(1) + ' km';
        document.getElementById('total-duration').textContent = Math.round(totalDuration * 60) + ' min';
        document.getElementById('total-stops').textContent = optimizedStops.length;
        document.getElementById('summary').style.display = 'block';

        updateUI();
        showToast('Route optimized!', 'success');

    } catch (error) {
        console.error('Optimization error:', error);
        showToast('Optimization failed: ' + error.message, 'error');
    }
}

// Calculate distance between two points (Haversine formula)
function distance(point1, point2) {
    const R = 6371; // Earth radius in km
    const dLat = toRad(point2.lat - point1.lat);
    const dLon = toRad(point2.lon - point1.lon);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRad(degrees) {
    return degrees * Math.PI / 180;
}

// Send route to driver (MyGeotab integration)
async function sendToDriver() {
    if (!geotabApi) {
        showToast('MyGeotab API not available. This feature only works when running as a MyGeotab Add-In.', 'error');
        return;
    }

    const vehicleId = document.getElementById('vehicle-select').value;
    const driverId = document.getElementById('driver-select').value;

    if (!vehicleId || !driverId) {
        showToast('Please select vehicle and driver', 'error');
        return;
    }

    if (optimizedStops.length === 0) {
        showToast('Please optimize route first', 'error');
        return;
    }

    try {
        showToast('Sending route to driver...', 'info');

        // Create route in MyGeotab
        const routeName = `Route ${new Date().toLocaleDateString()}`;
        const routeId = await geotabApi.call('Add', {
            typeName: 'Route',
            entity: {
                name: routeName,
                comment: `Optimized route with ${optimizedStops.length} stops`,
                activeFrom: new Date().toISOString(),
                activeTo: new Date(Date.now() + 24*60*60*1000).toISOString()
            }
        });

        // Add stops as zones and route plan items
        for (let i = 0; i < optimizedStops.length; i++) {
            const stop = optimizedStops[i];

            // Create zone
            const zoneId = await geotabApi.call('Add', {
                typeName: 'Zone',
                entity: {
                    name: stop.name,
                    displayed: true,
                    activeFrom: new Date().toISOString(),
                    activeTo: '2050-01-01T00:00:00.000Z',
                    zoneTypes: ['ZoneTypeCustomerId'],
                    points: [{ x: stop.lon, y: stop.lat }]
                }
            });

            // Add route plan item
            await geotabApi.call('Add', {
                typeName: 'RoutePlanItem',
                entity: {
                    route: { id: routeId },
                    sequence: i + 1,
                    zone: { id: zoneId },
                    activeFrom: new Date().toISOString(),
                    activeTo: new Date(Date.now() + 24*60*60*1000).toISOString()
                }
            });
        }

        showToast('Route sent to driver successfully!', 'success');

    } catch (error) {
        console.error('Send to driver error:', error);
        showToast('Failed to send route: ' + error.message, 'error');
    }
}

// Clear all stops
function clearAll() {
    if (stops.length === 0) return;

    if (confirm('Clear all stops?')) {
        stops = [];
        optimizedStops = [];
        document.getElementById('summary').style.display = 'none';
        updateUI();
        showToast('All stops cleared', 'info');
    }
}

// Show toast notification
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// MyGeotab Add-In lifecycle functions
window.geotab = window.geotab || {};
window.geotab.addin = window.geotab.addin || {};
window.geotab.addin.routeOptimizer = function(api, state) {
    geotabApi = api;
    loadVehiclesAndDrivers();
};
