const axios = require('axios');
const logger = require('../utils/logger');
const db = require('../config/database');

class GeotabService {
    constructor() {
        this.username = process.env.GEOTAB_USERNAME;
        this.password = process.env.GEOTAB_PASSWORD;
        this.database = process.env.GEOTAB_DATABASE;
        this.sessionId = null;
        this.server = null;
    }

    /**
     * Authenticate with MyGeotab
     * @returns {Promise<string>} Session ID
     */
    async authenticate() {
        try {
            const response = await axios.post('https://my.geotab.com/apiv1', {
                method: 'Authenticate',
                params: {
                    userName: this.username,
                    password: this.password,
                    database: this.database
                }
            });

            if (response.data.error) {
                throw new Error(`Geotab auth error: ${response.data.error.message}`);
            }

            this.sessionId = response.data.result.credentials.sessionId;
            this.server = response.data.result.path;

            logger.info('✓ Authenticated with MyGeotab');
            return this.sessionId;

        } catch (error) {
            logger.error('Geotab authentication failed:', error);
            throw error;
        }
    }

    /**
     * Call MyGeotab API
     * @param {string} method - API method name
     * @param {object} params - Method parameters
     * @returns {Promise<any>} API response
     */
    async call(method, params = {}) {
        if (!this.sessionId) {
            await this.authenticate();
        }

        try {
            const url = `https://${this.server}/apiv1`;
            const response = await axios.post(url, {
                method,
                params: {
                    credentials: {
                        sessionId: this.sessionId,
                        database: this.database
                    },
                    ...params
                }
            });

            if (response.data.error) {
                // Try re-authentication on session expiry
                if (response.data.error.message.includes('Session')) {
                    logger.warn('Session expired, re-authenticating');
                    await this.authenticate();
                    return this.call(method, params);
                }
                throw new Error(`Geotab API error: ${response.data.error.message}`);
            }

            return response.data.result;

        } catch (error) {
            logger.error(`Geotab API call failed [${method}]:`, error);
            throw error;
        }
    }

    /**
     * Get all devices (vehicles)
     * @returns {Promise<Array>} List of devices
     */
    async getDevices() {
        return await this.call('Get', {
            typeName: 'Device'
        });
    }

    /**
     * Get device by ID
     * @param {string} deviceId - Device ID
     * @returns {Promise<object>} Device details
     */
    async getDevice(deviceId) {
        const devices = await this.call('Get', {
            typeName: 'Device',
            search: { id: deviceId }
        });
        return devices[0] || null;
    }

    /**
     * Get all drivers (users)
     * @returns {Promise<Array>} List of drivers
     */
    async getDrivers() {
        return await this.call('Get', {
            typeName: 'User',
            search: {
                isDriver: true
            }
        });
    }

    /**
     * Create or get zone for a stop location
     * @param {object} stop - Stop with lat, lon, name
     * @returns {Promise<string>} Zone ID
     */
    async createZone(stop) {
        // Check if zone already exists in our database
        const existingZone = await db.query(
            'SELECT geotab_zone_id FROM geotab_zones WHERE name = $1',
            [stop.name]
        );

        if (existingZone.rows.length > 0) {
            return existingZone.rows[0].geotab_zone_id;
        }

        // Create new zone in Geotab
        try {
            const zoneId = await this.call('Add', {
                typeName: 'Zone',
                entity: {
                    name: stop.name,
                    comment: `Route stop - ${stop.address || ''}`,
                    displayed: true,
                    activeFrom: new Date().toISOString(),
                    activeTo: '2050-01-01T00:00:00.000Z',
                    zoneTypes: ['ZoneTypeCustomerId'],
                    points: [
                        { x: stop.lon, y: stop.lat }
                    ],
                    // Create circular zone with 100m radius
                    externalReference: `route-stop-${Date.now()}`
                }
            });

            // Save to our database
            await db.query(
                'INSERT INTO geotab_zones (geotab_zone_id, name, lat, lon, radius_meters) VALUES ($1, $2, $3, $4, $5)',
                [zoneId, stop.name, stop.lat, stop.lon, 100]
            );

            logger.info(`Created Geotab zone: ${stop.name} (${zoneId})`);
            return zoneId;

        } catch (error) {
            logger.error('Failed to create Geotab zone:', error);
            throw error;
        }
    }

    /**
     * Send optimized route to Geotab Drive app
     * @param {number} routeId - Route ID from database
     * @param {string} driverId - Geotab driver ID
     * @param {string} vehicleId - Geotab device ID
     * @returns {Promise<string>} Geotab route ID
     */
    async sendRouteToDriver(routeId, driverId, vehicleId) {
        logger.info(`Sending route ${routeId} to driver ${driverId} on vehicle ${vehicleId}`);

        try {
            // Get route and stops from database
            const routeQuery = 'SELECT * FROM routes WHERE id = $1';
            const routeResult = await db.query(routeQuery, [routeId]);

            if (routeResult.rows.length === 0) {
                throw new Error(`Route ${routeId} not found`);
            }

            const route = routeResult.rows[0];

            const stopsQuery = 'SELECT * FROM route_stops WHERE route_id = $1 ORDER BY sequence_order';
            const stopsResult = await db.query(stopsQuery, [routeId]);
            const stops = stopsResult.rows;

            // Create Route in Geotab
            const routeName = route.name || `Route ${routeId}`;
            const activeFrom = route.departure_time || new Date();
            const activeTo = new Date(activeFrom);
            activeTo.setHours(activeTo.getHours() + 24); // Valid for 24 hours

            const geotabRouteId = await this.call('Add', {
                typeName: 'Route',
                entity: {
                    name: routeName,
                    comment: `Optimized route - ${route.total_distance_km}km, ${route.total_duration_minutes}min`,
                    activeFrom: activeFrom.toISOString(),
                    activeTo: activeTo.toISOString(),
                    externalReference: `route-optimizer-${routeId}`
                }
            });

            logger.info(`Created Geotab route: ${geotabRouteId}`);

            // Create zones and route plan items for each stop
            for (const stop of stops) {
                const zoneId = await this.createZone({
                    name: stop.name,
                    lat: stop.lat,
                    lon: stop.lon,
                    address: stop.address
                });

                // Create RoutePlanItem
                await this.call('Add', {
                    typeName: 'RoutePlanItem',
                    entity: {
                        route: { id: geotabRouteId },
                        sequence: stop.sequence_order,
                        zone: { id: zoneId },
                        activeFrom: activeFrom.toISOString(),
                        activeTo: activeTo.toISOString(),
                        expectedArrivalTime: stop.expected_arrival?.toISOString(),
                        expectedServiceDuration: `PT${stop.service_duration_minutes}M`
                    }
                });
            }

            // Update route in our database with Geotab route ID
            await db.query(
                'UPDATE routes SET geotab_route_id = $1, driver_id = $2, vehicle_id = $3, status = $4 WHERE id = $5',
                [geotabRouteId, driverId, vehicleId, 'sent', routeId]
            );

            logger.info(`✓ Route ${routeId} sent to Geotab Drive (${geotabRouteId})`);

            return geotabRouteId;

        } catch (error) {
            logger.error('Failed to send route to Geotab:', error);
            throw error;
        }
    }

    /**
     * Get route status from Geotab
     * @param {string} geotabRouteId - Geotab route ID
     * @returns {Promise<object>} Route status
     */
    async getRouteStatus(geotabRouteId) {
        try {
            const route = await this.call('Get', {
                typeName: 'Route',
                search: { id: geotabRouteId }
            });

            const routePlanItems = await this.call('Get', {
                typeName: 'RoutePlanItem',
                search: {
                    routeSearch: { id: geotabRouteId }
                }
            });

            return {
                route: route[0],
                stops: routePlanItems
            };

        } catch (error) {
            logger.error('Failed to get route status:', error);
            throw error;
        }
    }

    /**
     * Delete route from Geotab
     * @param {string} geotabRouteId - Geotab route ID
     */
    async deleteRoute(geotabRouteId) {
        try {
            // Delete all route plan items first
            const routePlanItems = await this.call('Get', {
                typeName: 'RoutePlanItem',
                search: {
                    routeSearch: { id: geotabRouteId }
                }
            });

            for (const item of routePlanItems) {
                await this.call('Remove', {
                    typeName: 'RoutePlanItem',
                    entity: { id: item.id }
                });
            }

            // Delete the route
            await this.call('Remove', {
                typeName: 'Route',
                entity: { id: geotabRouteId }
            });

            logger.info(`Deleted Geotab route: ${geotabRouteId}`);

        } catch (error) {
            logger.error('Failed to delete Geotab route:', error);
            throw error;
        }
    }
}

module.exports = new GeotabService();
