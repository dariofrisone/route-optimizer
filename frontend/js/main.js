/**
 * Route Optimizer - MyGeotab Add-In
 * Main entry point and Add-In lifecycle management
 */

// Global state
window.routeOptimizer = {
    api: null,
    state: null,
    mapManager: null,
    optimizerClient: null,
    routeBuilder: null
};

/**
 * MyGeotab Add-In lifecycle: initialize
 * Called when the Add-In is first loaded
 */
function initialize(api, state, callback) {
    console.log('Route Optimizer Add-In initializing...');

    // Store API and state
    window.routeOptimizer.api = api;
    window.routeOptimizer.state = state;

    // Initialize components
    initializeApp();

    // Call MyGeotab callback
    callback();
}

/**
 * MyGeotab Add-In lifecycle: focus
 * Called when the Add-In receives focus
 */
function focus(api, state) {
    console.log('Route Optimizer Add-In focused');

    // Update state
    window.routeOptimizer.state = state;

    // Refresh data if needed
    if (window.routeOptimizer.routeBuilder) {
        window.routeOptimizer.routeBuilder.refreshData();
    }
}

/**
 * MyGeotab Add-In lifecycle: blur
 * Called when the Add-In loses focus
 */
function blur(api, state) {
    console.log('Route Optimizer Add-In blurred');
}

/**
 * Initialize the application
 */
function initializeApp() {
    console.log('Initializing Route Optimizer app...');

    try {
        // Initialize API client
        const apiBaseUrl = window.location.origin + '/api';
        window.routeOptimizer.optimizerClient = new OptimizerClient(apiBaseUrl);

        // Initialize map manager
        window.routeOptimizer.mapManager = new MapManager('map', {
            center: [45.4642, 9.1900], // Milan, Italy
            zoom: 7
        });

        // Initialize route builder
        window.routeOptimizer.routeBuilder = new RouteBuilder(
            window.routeOptimizer.mapManager,
            window.routeOptimizer.optimizerClient,
            window.routeOptimizer.api
        );

        // Load initial data
        loadInitialData();

        // Update budget indicator
        updateBudgetIndicator();
        setInterval(updateBudgetIndicator, 60000); // Update every minute

        console.log('✓ Route Optimizer initialized successfully');

    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize app: ' + error.message, 'error');
    }
}

/**
 * Load initial data (vehicles, drivers, etc.)
 */
async function loadInitialData() {
    try {
        showLoading('Loading vehicles and drivers...');

        // Load vehicles
        const vehicles = await loadVehicles();
        populateVehicleSelect(vehicles);

        // Load drivers
        const drivers = await loadDrivers();
        populateDriverSelect(drivers);

        hideLoading();

    } catch (error) {
        console.error('Failed to load initial data:', error);
        hideLoading();
        showToast('Failed to load vehicles/drivers. Using manual input mode.', 'warning');
    }
}

/**
 * Load vehicles from Geotab
 */
async function loadVehicles() {
    try {
        const response = await window.routeOptimizer.optimizerClient.get('/geotab/devices');
        return response.devices || [];
    } catch (error) {
        console.error('Failed to load vehicles:', error);
        return [];
    }
}

/**
 * Load drivers from Geotab
 */
async function loadDrivers() {
    try {
        const response = await window.routeOptimizer.optimizerClient.get('/geotab/drivers');
        return response.drivers || [];
    } catch (error) {
        console.error('Failed to load drivers:', error);
        return [];
    }
}

/**
 * Populate vehicle select dropdown
 */
function populateVehicleSelect(vehicles) {
    const select = document.getElementById('vehicle-select');
    select.innerHTML = '<option value="">Select vehicle...</option>';

    vehicles.forEach(vehicle => {
        const option = document.createElement('option');
        option.value = vehicle.id;
        option.textContent = vehicle.name || vehicle.serialNumber || vehicle.id;
        select.appendChild(option);
    });
}

/**
 * Populate driver select dropdown
 */
function populateDriverSelect(drivers) {
    const select = document.getElementById('driver-select');
    select.innerHTML = '<option value="">Select driver...</option>';

    drivers.forEach(driver => {
        const option = document.createElement('option');
        option.value = driver.id;
        option.textContent = driver.name || driver.firstName + ' ' + driver.lastName;
        select.appendChild(option);
    });
}

/**
 * Update budget indicator in header
 */
async function updateBudgetIndicator() {
    try {
        const stats = await window.routeOptimizer.optimizerClient.get('/traffic/budget');
        const indicator = document.getElementById('budget-indicator');

        const percentUsed = parseFloat(stats.percentUsed);
        const remaining = stats.remaining;

        indicator.textContent = `API Budget: ${remaining}/${stats.dailyLimit} (${percentUsed}%)`;

        // Update badge color based on usage
        indicator.className = 'badge';
        if (percentUsed >= 90) {
            indicator.classList.add('badge-danger');
        } else if (percentUsed >= 70) {
            indicator.classList.add('badge-warning');
        } else {
            indicator.classList.add('badge-success');
        }

    } catch (error) {
        console.error('Failed to update budget indicator:', error);
    }
}

/**
 * Show loading overlay
 */
function showLoading(message = 'Processing...') {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');
    messageEl.textContent = message;
    overlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'none';
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Export for MyGeotab
window.initialize = initialize;
window.focus = focus;
window.blur = blur;

// Export utility functions
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showToast = showToast;
