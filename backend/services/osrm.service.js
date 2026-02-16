const axios = require('axios');
const logger = require('../utils/logger');

class OSRMService {
    constructor() {
        this.baseUrl = process.env.OSRM_URL || 'http://router.project-osrm.org';
    }

    /**
     * Get route between two points
     * @param {Array<{lat, lon}>} coordinates - Array of coordinates
     * @param {object} options - Routing options
     * @returns {Promise<object>} Route with distance and duration
     */
    async getRoute(coordinates, options = {}) {
        if (!coordinates || coordinates.length < 2) {
            throw new Error('At least 2 coordinates required for routing');
        }

        const coordsString = coordinates
            .map(c => `${c.lon},${c.lat}`)
            .join(';');

        const url = `${this.baseUrl}/route/v1/driving/${coordsString}`;
        const params = {
            overview: options.overview || 'full',
            geometries: options.geometries || 'geojson',
            steps: options.steps !== undefined ? options.steps : true,
            annotations: options.annotations !== undefined ? options.annotations : true
        };

        try {
            const response = await axios.get(url, { params });

            if (response.data.code !== 'Ok') {
                throw new Error(`OSRM error: ${response.data.message}`);
            }

            const route = response.data.routes[0];

            return {
                distance: route.distance, // meters
                duration: route.duration, // seconds
                geometry: route.geometry,
                legs: route.legs,
                distanceKm: (route.distance / 1000).toFixed(2),
                durationMinutes: (route.duration / 60).toFixed(0)
            };

        } catch (error) {
            logger.error('OSRM routing error:', error);
            throw error;
        }
    }

    /**
     * Get distance/duration matrix for multiple points
     * @param {Array<{lat, lon}>} coordinates - Array of coordinates
     * @returns {Promise<object>} Distance and duration matrices
     */
    async getMatrix(coordinates) {
        if (!coordinates || coordinates.length < 2) {
            throw new Error('At least 2 coordinates required for matrix');
        }

        const coordsString = coordinates
            .map(c => `${c.lon},${c.lat}`)
            .join(';');

        const url = `${this.baseUrl}/table/v1/driving/${coordsString}`;
        const params = {
            annotations: 'distance,duration'
        };

        try {
            const response = await axios.get(url, { params });

            if (response.data.code !== 'Ok') {
                throw new Error(`OSRM error: ${response.data.message}`);
            }

            return {
                distances: response.data.distances, // meters
                durations: response.data.durations, // seconds
                sources: response.data.sources,
                destinations: response.data.destinations
            };

        } catch (error) {
            logger.error('OSRM matrix error:', error);
            throw error;
        }
    }

    /**
     * Match GPS coordinates to roads (map matching)
     * @param {Array<{lat, lon, timestamp}>} coordinates - GPS trace
     * @returns {Promise<object>} Matched route
     */
    async matchRoute(coordinates) {
        if (!coordinates || coordinates.length < 2) {
            throw new Error('At least 2 coordinates required for matching');
        }

        const coordsString = coordinates
            .map(c => `${c.lon},${c.lat}`)
            .join(';');

        const url = `${this.baseUrl}/match/v1/driving/${coordsString}`;
        const params = {
            overview: 'full',
            geometries: 'geojson',
            timestamps: coordinates.map(c => c.timestamp || 0).join(';')
        };

        try {
            const response = await axios.get(url, { params });

            if (response.data.code !== 'Ok') {
                throw new Error(`OSRM error: ${response.data.message}`);
            }

            const matching = response.data.matchings[0];

            return {
                distance: matching.distance,
                duration: matching.duration,
                geometry: matching.geometry,
                confidence: matching.confidence,
                distanceKm: (matching.distance / 1000).toFixed(2),
                durationMinutes: (matching.duration / 60).toFixed(0)
            };

        } catch (error) {
            logger.error('OSRM matching error:', error);
            throw error;
        }
    }

    /**
     * Get nearest road point for a coordinate
     * @param {object} coordinate - {lat, lon}
     * @returns {Promise<object>} Nearest point on road network
     */
    async getNearestRoad(coordinate) {
        const url = `${this.baseUrl}/nearest/v1/driving/${coordinate.lon},${coordinate.lat}`;

        try {
            const response = await axios.get(url);

            if (response.data.code !== 'Ok') {
                throw new Error(`OSRM error: ${response.data.message}`);
            }

            const waypoint = response.data.waypoints[0];

            return {
                lat: waypoint.location[1],
                lon: waypoint.location[0],
                distance: waypoint.distance,
                name: waypoint.name
            };

        } catch (error) {
            logger.error('OSRM nearest error:', error);
            throw error;
        }
    }

    /**
     * Check if OSRM service is available
     * @returns {Promise<boolean>}
     */
    async checkHealth() {
        try {
            // Simple route request to check if service is up
            const testCoords = [
                { lat: 45.4642, lon: 9.1900 }, // Milan
                { lat: 45.0703, lon: 7.6869 }  // Turin
            ];

            await this.getRoute(testCoords);
            return true;

        } catch (error) {
            logger.error('OSRM health check failed:', error);
            return false;
        }
    }
}

module.exports = new OSRMService();
