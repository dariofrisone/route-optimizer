const axios = require('axios');
const db = require('../config/database');
const budgetManager = require('../utils/budget-manager');
const gridCalculator = require('../utils/grid-calculator');
const logger = require('../utils/logger');

class TrafficService {
    constructor() {
        this.apiKey = process.env.TOMTOM_API_KEY;
        this.baseUrl = 'https://api.tomtom.com/traffic';
    }

    /**
     * Get traffic data for a route with smart caching
     * @param {Array<{lat, lon}>} coordinates - Route stops
     * @param {string} budgetType - Budget allocation type
     * @returns {Promise<object>} Traffic data with cache status
     */
    async getTrafficForRoute(coordinates, budgetType = 'active') {
        const bounds = gridCalculator.getBoundingBox(coordinates, 10);
        if (!bounds) {
            throw new Error('Invalid coordinates provided');
        }

        const gridCells = gridCalculator.getGridCellsForBounds(bounds);
        logger.traffic(`Route requires ${gridCells.length} grid cells`, { gridCells });

        // Check cache for each cell
        const cachedData = await this.getCachedTrafficData(gridCells);
        const uncachedCells = gridCells.filter(cell => !cachedData[cell]);

        logger.traffic(`Cache status: ${cachedData ? Object.keys(cachedData).length : 0}/${gridCells.length} cells cached`);

        let freshData = {};

        // Fetch uncached cells if budget allows
        if (uncachedCells.length > 0) {
            const budgetCheck = await budgetManager.canMakeRequest(budgetType, uncachedCells.length);

            if (budgetCheck.allowed) {
                logger.traffic(`Fetching ${uncachedCells.length} uncached cells from TomTom`);
                freshData = await this.fetchTrafficFromTomTom(uncachedCells, budgetType);
            } else {
                logger.warn(`Budget limit reached: ${budgetCheck.message}. Using stale/empty data for uncached cells.`);
            }
        }

        // Merge cached and fresh data
        const trafficData = { ...cachedData, ...freshData };

        return {
            trafficData,
            cacheHitRate: cachedData ? (Object.keys(cachedData).length / gridCells.length * 100).toFixed(1) : 0,
            cellsFetched: uncachedCells.length,
            totalCells: gridCells.length
        };
    }

    /**
     * Fetch traffic data from TomTom API for specific grid cells
     * @param {Array<string>} gridCells - Grid cell IDs
     * @param {string} budgetType - Budget type
     * @returns {Promise<object>} Traffic data by grid cell
     */
    async fetchTrafficFromTomTom(gridCells, budgetType) {
        const trafficData = {};

        for (const cell of gridCells) {
            try {
                const bounds = gridCalculator.getGridBounds(cell);
                const data = await this.fetchTrafficForBounds(bounds);

                // Determine road type and cache TTL
                const roadType = this.inferRoadType(data);
                const ttl = gridCalculator.getCacheTTL(roadType);

                // Cache the data
                await this.cacheTrafficData(cell, bounds, data, roadType, ttl);

                trafficData[cell] = data;

                // Record API usage
                await budgetManager.recordUsage(budgetType, 1);

                logger.traffic(`Fetched and cached traffic for cell ${cell} [${roadType}, TTL: ${ttl}s]`);

            } catch (error) {
                logger.error(`Failed to fetch traffic for cell ${cell}:`, error);
                trafficData[cell] = { error: error.message, flow: [] };
            }
        }

        return trafficData;
    }

    /**
     * Fetch traffic data from TomTom API for specific bounds
     * @param {object} bounds - {latMin, latMax, lonMin, lonMax}
     * @returns {Promise<object>} Traffic flow and incident data
     */
    async fetchTrafficForBounds(bounds) {
        const { latMin, latMax, lonMin, lonMax } = bounds;
        const bbox = `${lonMin},${latMin},${lonMax},${latMax}`;

        try {
            // Traffic Flow API
            const flowUrl = `${this.baseUrl}/services/4/flowSegmentData/absolute/10/json`;
            const flowParams = {
                key: this.apiKey,
                point: `${(latMin + latMax) / 2},${(lonMin + lonMax) / 2}`,
                unit: 'KMPH'
            };

            // Traffic Incidents API
            const incidentsUrl = `${this.baseUrl}/services/5/incidentDetails`;
            const incidentsParams = {
                key: this.apiKey,
                bbox: bbox,
                fields: '{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code,iconCategory}}}}'
            };

            const [flowResponse, incidentsResponse] = await Promise.all([
                axios.get(flowUrl, { params: flowParams }),
                axios.get(incidentsUrl, { params: incidentsParams })
            ]);

            return {
                flow: flowResponse.data.flowSegmentData || {},
                incidents: incidentsResponse.data.incidents || [],
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logger.error('TomTom API request failed:', error);
            throw error;
        }
    }

    /**
     * Get cached traffic data for grid cells
     * @param {Array<string>} gridCells - Grid cell IDs
     * @returns {Promise<object>} Cached traffic data by grid cell
     */
    async getCachedTrafficData(gridCells) {
        const placeholders = gridCells.map((_, i) => `$${i + 1}`).join(',');
        const query = `
            SELECT grid_cell, traffic_data
            FROM traffic_cache
            WHERE grid_cell IN (${placeholders})
            AND expires_at > NOW()
        `;

        try {
            const result = await db.query(query, gridCells);
            const cachedData = {};

            result.rows.forEach(row => {
                cachedData[row.grid_cell] = row.traffic_data;
            });

            return cachedData;

        } catch (error) {
            logger.error('Cache retrieval error:', error);
            return {};
        }
    }

    /**
     * Cache traffic data for a grid cell
     * @param {string} gridCell - Grid cell ID
     * @param {object} bounds - Cell boundaries
     * @param {object} data - Traffic data
     * @param {string} roadType - highway, urban, or rural
     * @param {number} ttl - Time to live in seconds
     */
    async cacheTrafficData(gridCell, bounds, data, roadType, ttl) {
        const expiresAt = new Date(Date.now() + ttl * 1000);

        const query = `
            INSERT INTO traffic_cache (grid_cell, lat_min, lat_max, lon_min, lon_max, traffic_data, road_type, cache_ttl_seconds, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (grid_cell)
            DO UPDATE SET
                traffic_data = $6,
                road_type = $7,
                cache_ttl_seconds = $8,
                expires_at = $9,
                created_at = CURRENT_TIMESTAMP
        `;

        try {
            await db.query(query, [
                gridCell,
                bounds.latMin,
                bounds.latMax,
                bounds.lonMin,
                bounds.lonMax,
                JSON.stringify(data),
                roadType,
                ttl,
                expiresAt
            ]);
        } catch (error) {
            logger.error('Cache storage error:', error);
        }
    }

    /**
     * Infer road type from traffic data (for cache TTL calculation)
     * @param {object} trafficData - Traffic data from TomTom
     * @returns {string} highway, urban, or rural
     */
    inferRoadType(trafficData) {
        if (trafficData.flow && trafficData.flow.freeFlowSpeed > 90) {
            return 'highway';
        } else if (trafficData.flow && trafficData.flow.freeFlowSpeed > 50) {
            return 'urban';
        }
        return 'rural';
    }

    /**
     * Calculate traffic multiplier for routing
     * @param {object} trafficData - Traffic data
     * @returns {number} Multiplier (1.0 = no delay, 2.0 = double time)
     */
    calculateTrafficMultiplier(trafficData) {
        if (!trafficData.flow) return 1.0;

        const { currentSpeed, freeFlowSpeed } = trafficData.flow;
        if (!currentSpeed || !freeFlowSpeed) return 1.0;

        const multiplier = freeFlowSpeed / Math.max(currentSpeed, 1);
        return Math.min(Math.max(multiplier, 1.0), 3.0); // Cap between 1x and 3x
    }

    /**
     * Clean up expired cache entries (called by cron)
     */
    async cleanExpiredCache() {
        const query = 'DELETE FROM traffic_cache WHERE expires_at < NOW()';
        try {
            const result = await db.query(query);
            logger.info(`Cleaned ${result.rowCount} expired cache entries`);
        } catch (error) {
            logger.error('Cache cleanup error:', error);
        }
    }

    /**
     * Prefetch traffic for common routes (off-peak hours)
     */
    async prefetchCommonRoutes() {
        if (!budgetManager.isOffPeakHour()) {
            logger.info('Skipping prefetch - not off-peak hours');
            return;
        }

        logger.info('Starting traffic prefetch for common routes');

        // Get frequently used grid cells from recent routes
        const query = `
            SELECT DISTINCT grid_cell, COUNT(*) as usage_count
            FROM (
                SELECT UNNEST(ARRAY[
                    (SELECT grid_cell FROM traffic_cache WHERE lat_min <= rs.lat AND lat_max >= rs.lat AND lon_min <= rs.lon AND lon_max >= rs.lon LIMIT 1)
                ]) as grid_cell
                FROM route_stops rs
                JOIN routes r ON rs.route_id = r.id
                WHERE r.created_at > NOW() - INTERVAL '7 days'
            ) cells
            WHERE grid_cell IS NOT NULL
            GROUP BY grid_cell
            ORDER BY usage_count DESC
            LIMIT 20
        `;

        try {
            const result = await db.query(query);
            const popularCells = result.rows.map(row => row.grid_cell);

            if (popularCells.length > 0) {
                await this.fetchTrafficFromTomTom(popularCells, 'prefetch');
                logger.info(`Prefetched ${popularCells.length} popular grid cells`);
            }

        } catch (error) {
            logger.error('Prefetch error:', error);
        }
    }
}

module.exports = new TrafficService();
