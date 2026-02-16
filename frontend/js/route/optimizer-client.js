/**
 * Optimizer Client - Backend API communication
 */

class OptimizerClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    /**
     * Generic GET request
     */
    async get(endpoint, params = {}) {
        const url = new URL(this.baseUrl + endpoint);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.message || 'Request failed');
        }

        return await response.json();
    }

    /**
     * Generic POST request
     */
    async post(endpoint, data = {}) {
        const response = await fetch(this.baseUrl + endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.message || 'Request failed');
        }

        return await response.json();
    }

    /**
     * Generic DELETE request
     */
    async delete(endpoint) {
        const response = await fetch(this.baseUrl + endpoint, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.message || 'Request failed');
        }

        return await response.json();
    }

    /**
     * Optimize route
     */
    async optimizeRoute(stops, options = {}) {
        return await this.post('/routes/optimize', {
            stops,
            vehicleId: options.vehicleId,
            driverId: options.driverId,
            routeName: options.routeName,
            departureTime: options.departureTime,
            considerTraffic: options.considerTraffic !== false
        });
    }

    /**
     * Send route to driver
     */
    async sendToDriver(routeId, driverId, vehicleId) {
        return await this.post('/routes/send-to-driver', {
            routeId,
            driverId,
            vehicleId
        });
    }

    /**
     * Get route details
     */
    async getRoute(routeId) {
        return await this.get(`/routes/${routeId}`);
    }

    /**
     * Get all routes
     */
    async getAllRoutes(params = {}) {
        return await this.get('/routes', params);
    }

    /**
     * Delete route
     */
    async deleteRoute(routeId) {
        return await this.delete(`/routes/${routeId}`);
    }

    /**
     * Get route status from Geotab
     */
    async getRouteStatus(routeId) {
        return await this.get(`/routes/${routeId}/status`);
    }

    /**
     * Get traffic for area
     */
    async getTrafficForArea(bounds) {
        return await this.get('/traffic/area', bounds);
    }

    /**
     * Get budget statistics
     */
    async getBudgetStats() {
        return await this.get('/traffic/budget');
    }

    /**
     * Health check
     */
    async healthCheck() {
        return await this.get('/health');
    }
}

// Export
window.OptimizerClient = OptimizerClient;
