const optimizationService = require('../services/optimization.service');
const geotabService = require('../services/geotab.service');
const logger = require('../utils/logger');
const db = require('../config/database');

class RouteController {
    /**
     * POST /api/routes/optimize
     * Optimize a route with traffic consideration
     */
    async optimizeRoute(req, res) {
        try {
            const { stops, vehicleId, driverId, departureTime, considerTraffic = true } = req.body;

            if (!stops || stops.length < 2) {
                return res.status(400).json({
                    error: 'At least 2 stops required for optimization'
                });
            }

            logger.info(`Route optimization request: ${stops.length} stops, traffic: ${considerTraffic}`);

            const optimizedRoute = await optimizationService.optimizeRoute(stops, {
                considerTraffic,
                departureTime: departureTime ? new Date(departureTime) : new Date()
            });

            // Save route to database
            const routeId = await optimizationService.saveRoute(optimizedRoute, {
                vehicleId,
                driverId,
                departureTime,
                name: req.body.routeName
            });

            res.json({
                success: true,
                routeId,
                ...optimizedRoute
            });

        } catch (error) {
            logger.error('Route optimization error:', error);
            res.status(500).json({
                error: 'Route optimization failed',
                message: error.message
            });
        }
    }

    /**
     * POST /api/routes/send-to-driver
     * Send optimized route to Geotab Drive app
     */
    async sendToDriver(req, res) {
        try {
            const { routeId, driverId, vehicleId } = req.body;

            if (!routeId || !driverId || !vehicleId) {
                return res.status(400).json({
                    error: 'routeId, driverId, and vehicleId are required'
                });
            }

            logger.info(`Sending route ${routeId} to driver ${driverId}`);

            const geotabRouteId = await geotabService.sendRouteToDriver(
                routeId,
                driverId,
                vehicleId
            );

            res.json({
                success: true,
                routeId,
                geotabRouteId,
                message: 'Route sent to Geotab Drive app'
            });

        } catch (error) {
            logger.error('Send to driver error:', error);
            res.status(500).json({
                error: 'Failed to send route to driver',
                message: error.message
            });
        }
    }

    /**
     * GET /api/routes/:id
     * Get route details
     */
    async getRoute(req, res) {
        try {
            const { id } = req.params;

            const routeQuery = 'SELECT * FROM routes WHERE id = $1';
            const routeResult = await db.query(routeQuery, [id]);

            if (routeResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Route not found'
                });
            }

            const route = routeResult.rows[0];

            const stopsQuery = 'SELECT * FROM route_stops WHERE route_id = $1 ORDER BY sequence_order';
            const stopsResult = await db.query(stopsQuery, [id]);

            res.json({
                ...route,
                stops: stopsResult.rows
            });

        } catch (error) {
            logger.error('Get route error:', error);
            res.status(500).json({
                error: 'Failed to get route',
                message: error.message
            });
        }
    }

    /**
     * GET /api/routes
     * Get all routes
     */
    async getAllRoutes(req, res) {
        try {
            const { limit = 50, offset = 0, status } = req.query;

            let query = 'SELECT * FROM routes';
            const params = [];

            if (status) {
                query += ' WHERE status = $1';
                params.push(status);
            }

            query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
            params.push(limit, offset);

            const result = await db.query(query, params);

            res.json({
                routes: result.rows,
                total: result.rows.length
            });

        } catch (error) {
            logger.error('Get all routes error:', error);
            res.status(500).json({
                error: 'Failed to get routes',
                message: error.message
            });
        }
    }

    /**
     * DELETE /api/routes/:id
     * Delete a route
     */
    async deleteRoute(req, res) {
        try {
            const { id } = req.params;

            // Get Geotab route ID if exists
            const routeQuery = 'SELECT geotab_route_id FROM routes WHERE id = $1';
            const routeResult = await db.query(routeQuery, [id]);

            if (routeResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Route not found'
                });
            }

            const geotabRouteId = routeResult.rows[0].geotab_route_id;

            // Delete from Geotab if it was sent
            if (geotabRouteId) {
                try {
                    await geotabService.deleteRoute(geotabRouteId);
                } catch (error) {
                    logger.warn('Failed to delete from Geotab, continuing with local deletion', error);
                }
            }

            // Delete from database (cascade will delete stops)
            await db.query('DELETE FROM routes WHERE id = $1', [id]);

            res.json({
                success: true,
                message: 'Route deleted'
            });

        } catch (error) {
            logger.error('Delete route error:', error);
            res.status(500).json({
                error: 'Failed to delete route',
                message: error.message
            });
        }
    }

    /**
     * GET /api/routes/:id/status
     * Get route status from Geotab
     */
    async getRouteStatus(req, res) {
        try {
            const { id } = req.params;

            const routeQuery = 'SELECT geotab_route_id FROM routes WHERE id = $1';
            const routeResult = await db.query(routeQuery, [id]);

            if (routeResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Route not found'
                });
            }

            const geotabRouteId = routeResult.rows[0].geotab_route_id;

            if (!geotabRouteId) {
                return res.status(400).json({
                    error: 'Route not sent to Geotab yet'
                });
            }

            const status = await geotabService.getRouteStatus(geotabRouteId);

            res.json({
                success: true,
                ...status
            });

        } catch (error) {
            logger.error('Get route status error:', error);
            res.status(500).json({
                error: 'Failed to get route status',
                message: error.message
            });
        }
    }
}

module.exports = new RouteController();
