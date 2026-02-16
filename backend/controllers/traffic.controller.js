const trafficService = require('../services/traffic.service');
const budgetManager = require('../utils/budget-manager');
const logger = require('../utils/logger');

class TrafficController {
    /**
     * GET /api/traffic/area
     * Get traffic data for a geographic area
     */
    async getTrafficForArea(req, res) {
        try {
            const { latMin, latMax, lonMin, lonMax } = req.query;

            if (!latMin || !latMax || !lonMin || !lonMax) {
                return res.status(400).json({
                    error: 'Bounding box required: latMin, latMax, lonMin, lonMax'
                });
            }

            const bounds = {
                latMin: parseFloat(latMin),
                latMax: parseFloat(latMax),
                lonMin: parseFloat(lonMin),
                lonMax: parseFloat(lonMax)
            };

            // Create dummy coordinates for the area center
            const centerLat = (bounds.latMin + bounds.latMax) / 2;
            const centerLon = (bounds.lonMin + bounds.lonMax) / 2;

            const coordinates = [
                { lat: centerLat, lon: centerLon },
                { lat: bounds.latMin, lon: bounds.lonMin },
                { lat: bounds.latMax, lon: bounds.lonMax }
            ];

            const result = await trafficService.getTrafficForRoute(coordinates, 'refresh');

            res.json({
                success: true,
                ...result
            });

        } catch (error) {
            logger.error('Get traffic for area error:', error);
            res.status(500).json({
                error: 'Failed to get traffic data',
                message: error.message
            });
        }
    }

    /**
     * GET /api/traffic/budget
     * Get API budget usage statistics
     */
    async getBudgetStats(req, res) {
        try {
            const stats = await budgetManager.getTodayStats();

            res.json({
                success: true,
                ...stats
            });

        } catch (error) {
            logger.error('Get budget stats error:', error);
            res.status(500).json({
                error: 'Failed to get budget statistics',
                message: error.message
            });
        }
    }

    /**
     * POST /api/traffic/cache/clear
     * Clear expired cache entries
     */
    async clearCache(req, res) {
        try {
            await trafficService.cleanExpiredCache();

            res.json({
                success: true,
                message: 'Cache cleared successfully'
            });

        } catch (error) {
            logger.error('Clear cache error:', error);
            res.status(500).json({
                error: 'Failed to clear cache',
                message: error.message
            });
        }
    }

    /**
     * POST /api/traffic/prefetch
     * Manually trigger traffic prefetch
     */
    async prefetchTraffic(req, res) {
        try {
            if (!budgetManager.isOffPeakHour()) {
                return res.status(400).json({
                    error: 'Prefetch should only run during off-peak hours (00:00-06:00)'
                });
            }

            await trafficService.prefetchCommonRoutes();

            res.json({
                success: true,
                message: 'Traffic prefetch completed'
            });

        } catch (error) {
            logger.error('Prefetch traffic error:', error);
            res.status(500).json({
                error: 'Failed to prefetch traffic',
                message: error.message
            });
        }
    }
}

module.exports = new TrafficController();
