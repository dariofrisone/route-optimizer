const axios = require('axios');
const osrmService = require('./osrm.service');
const trafficService = require('./traffic.service');
const logger = require('../utils/logger');
const db = require('../config/database');

class OptimizationService {
    constructor() {
        this.vroomUrl = process.env.VROOM_URL || null;
    }

    /**
     * Optimize route with traffic consideration
     * @param {Array<object>} stops - Array of stops with {lat, lon, name, timeWindow, serviceDuration}
     * @param {object} options - Optimization options
     * @returns {Promise<object>} Optimized route
     */
    async optimizeRoute(stops, options = {}) {
        const startTime = Date.now();

        if (!stops || stops.length < 2) {
            throw new Error('At least 2 stops required for optimization');
        }

        logger.optimization(`Starting optimization for ${stops.length} stops`);

        try {
            // Step 1: Get base distance/duration matrix from OSRM
            logger.optimization('Fetching base matrix from OSRM');
            const baseMatrix = await osrmService.getMatrix(stops);

            // Step 2: Get traffic data for route area
            let trafficData = null;
            let adjustedMatrix = baseMatrix;

            if (options.considerTraffic !== false) {
                logger.optimization('Fetching traffic data');
                const trafficResult = await trafficService.getTrafficForRoute(stops, 'active');
                trafficData = trafficResult.trafficData;

                logger.optimization(`Traffic cache hit rate: ${trafficResult.cacheHitRate}%`);

                // Step 3: Apply traffic multipliers to duration matrix
                adjustedMatrix = this.applyTrafficToMatrix(baseMatrix, trafficData, stops);
            }

            // Step 4: Optimize with VROOM (or fallback to simple optimization)
            let optimizedOrder;
            if (this.vroomUrl) {
                optimizedOrder = await this.optimizeWithVROOM(stops, adjustedMatrix, options);
            } else {
                logger.warn('VROOM URL not configured, using simple nearest-neighbor optimization');
                optimizedOrder = this.nearestNeighborOptimization(stops, adjustedMatrix.durations);
            }

            // Step 5: Calculate final route details
            const optimizedStops = optimizedOrder.map(idx => stops[idx]);
            const routeDetails = await this.calculateRouteDetails(optimizedStops, adjustedMatrix, optimizedOrder);

            const optimizationTime = Date.now() - startTime;
            logger.optimization(`Optimization completed in ${optimizationTime}ms`);

            return {
                stops: optimizedStops.map((stop, i) => ({
                    ...stop,
                    order: i + 1,
                    arrivalTime: routeDetails.arrivalTimes[i],
                    departureTime: routeDetails.departureTimes[i]
                })),
                totalDistanceKm: routeDetails.totalDistance / 1000,
                totalDurationMinutes: routeDetails.totalDuration / 60,
                optimizationTimeMs: optimizationTime,
                trafficConsidered: options.considerTraffic !== false,
                cacheHitRate: trafficData ? trafficResult.cacheHitRate : null
            };

        } catch (error) {
            logger.error('Route optimization failed:', error);
            throw error;
        }
    }

    /**
     * Apply traffic multipliers to duration matrix
     * @param {object} baseMatrix - Base OSRM matrix
     * @param {object} trafficData - Traffic data by grid cell
     * @param {Array<object>} stops - Route stops
     * @returns {object} Adjusted matrix
     */
    applyTrafficToMatrix(baseMatrix, trafficData, stops) {
        const adjustedDurations = baseMatrix.durations.map((row, i) =>
            row.map((duration, j) => {
                if (i === j) return 0;

                // Get average traffic multiplier for this segment
                const multiplier = this.getSegmentTrafficMultiplier(
                    stops[i],
                    stops[j],
                    trafficData
                );

                return duration * multiplier;
            })
        );

        return {
            distances: baseMatrix.distances,
            durations: adjustedDurations,
            sources: baseMatrix.sources,
            destinations: baseMatrix.destinations
        };
    }

    /**
     * Get traffic multiplier for a route segment
     * @param {object} from - Start coordinate
     * @param {object} to - End coordinate
     * @param {object} trafficData - Traffic data by grid cell
     * @returns {number} Traffic multiplier
     */
    getSegmentTrafficMultiplier(from, to, trafficData) {
        // Simple approach: average multiplier of start and end points
        const gridCalculator = require('../utils/grid-calculator');

        const fromCell = gridCalculator.getGridCell(from.lat, from.lon);
        const toCell = gridCalculator.getGridCell(to.lat, to.lon);

        const fromMultiplier = trafficData[fromCell]
            ? trafficService.calculateTrafficMultiplier(trafficData[fromCell])
            : 1.0;

        const toMultiplier = trafficData[toCell]
            ? trafficService.calculateTrafficMultiplier(trafficData[toCell])
            : 1.0;

        return (fromMultiplier + toMultiplier) / 2;
    }

    /**
     * Optimize route using VROOM
     * @param {Array<object>} stops - Route stops
     * @param {object} matrix - Distance/duration matrix
     * @param {object} options - Options
     * @returns {Promise<Array<number>>} Optimized order indices
     */
    async optimizeWithVROOM(stops, matrix, options) {
        const vroomInput = {
            vehicles: [{
                id: 1,
                start_index: options.startIndex || 0,
                end_index: options.endIndex || 0
            }],
            jobs: stops.slice(1).map((stop, i) => ({
                id: i + 1,
                location_index: i + 1,
                service: stop.serviceDuration || 600, // 10 minutes default
                time_windows: stop.timeWindow ? [[
                    this.timeToSeconds(stop.timeWindow.start),
                    this.timeToSeconds(stop.timeWindow.end)
                ]] : undefined
            })),
            matrices: {
                durations: matrix.durations,
                distances: matrix.distances
            }
        };

        try {
            const response = await axios.post(`${this.vroomUrl}`, vroomInput);

            if (response.data.code !== 0) {
                throw new Error(`VROOM error: ${response.data.error}`);
            }

            const solution = response.data.solution;
            const route = solution.routes[0];

            return route.steps
                .filter(step => step.type === 'job' || step.type === 'start')
                .map(step => step.location_index || 0);

        } catch (error) {
            logger.error('VROOM optimization failed:', error);
            throw error;
        }
    }

    /**
     * Simple nearest-neighbor optimization (fallback when VROOM unavailable)
     * @param {Array<object>} stops - Route stops
     * @param {Array<Array<number>>} durations - Duration matrix
     * @returns {Array<number>} Optimized order indices
     */
    nearestNeighborOptimization(stops, durations) {
        const unvisited = stops.map((_, i) => i);
        const order = [];

        let current = 0; // Start at first stop
        order.push(current);
        unvisited.splice(0, 1);

        while (unvisited.length > 0) {
            let nearest = unvisited[0];
            let minDuration = durations[current][nearest];

            for (const idx of unvisited) {
                if (durations[current][idx] < minDuration) {
                    minDuration = durations[current][idx];
                    nearest = idx;
                }
            }

            order.push(nearest);
            unvisited.splice(unvisited.indexOf(nearest), 1);
            current = nearest;
        }

        return order;
    }

    /**
     * Calculate detailed route information
     * @param {Array<object>} stops - Ordered stops
     * @param {object} matrix - Distance/duration matrix
     * @param {Array<number>} order - Stop order indices
     * @returns {object} Route details
     */
    async calculateRouteDetails(stops, matrix, order) {
        let totalDistance = 0;
        let totalDuration = 0;
        const arrivalTimes = [];
        const departureTimes = [];

        let currentTime = new Date();

        for (let i = 0; i < order.length; i++) {
            arrivalTimes.push(new Date(currentTime));

            if (i > 0) {
                const prevIdx = order[i - 1];
                const currIdx = order[i];

                totalDistance += matrix.distances[prevIdx][currIdx];
                totalDuration += matrix.durations[prevIdx][currIdx];
            }

            const serviceDuration = (stops[i].serviceDuration || 10) * 60 * 1000; // Convert to ms
            currentTime = new Date(currentTime.getTime() + serviceDuration);
            departureTimes.push(new Date(currentTime));

            if (i < order.length - 1) {
                const nextIdx = order[i + 1];
                const travelTime = matrix.durations[order[i]][nextIdx] * 1000;
                currentTime = new Date(currentTime.getTime() + travelTime);
            }
        }

        return {
            totalDistance,
            totalDuration,
            arrivalTimes,
            departureTimes
        };
    }

    /**
     * Save optimized route to database
     * @param {object} route - Optimized route
     * @param {object} metadata - Additional metadata
     * @returns {Promise<number>} Route ID
     */
    async saveRoute(route, metadata = {}) {
        const client = await db.pool.connect();

        try {
            await client.query('BEGIN');

            // Insert route
            const routeQuery = `
                INSERT INTO routes (name, vehicle_id, driver_id, total_distance_km, total_duration_minutes, departure_time, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `;
            const routeResult = await client.query(routeQuery, [
                metadata.name || `Route ${new Date().toISOString()}`,
                metadata.vehicleId,
                metadata.driverId,
                route.totalDistanceKm,
                route.totalDurationMinutes,
                metadata.departureTime || new Date(),
                'draft'
            ]);

            const routeId = routeResult.rows[0].id;

            // Insert stops
            for (let i = 0; i < route.stops.length; i++) {
                const stop = route.stops[i];
                const stopQuery = `
                    INSERT INTO route_stops (route_id, sequence_order, lat, lon, name, address, time_window_start, time_window_end, expected_arrival, service_duration_minutes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `;
                await client.query(stopQuery, [
                    routeId,
                    i + 1,
                    stop.lat,
                    stop.lon,
                    stop.name,
                    stop.address,
                    stop.timeWindow?.start,
                    stop.timeWindow?.end,
                    stop.arrivalTime,
                    stop.serviceDuration || 10
                ]);
            }

            await client.query('COMMIT');
            logger.optimization(`Route saved with ID: ${routeId}`);

            return routeId;

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Failed to save route:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Convert time string (HH:MM) to seconds
     * @param {string} timeStr - Time string
     * @returns {number} Seconds since midnight
     */
    timeToSeconds(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 3600 + minutes * 60;
    }
}

module.exports = new OptimizationService();
