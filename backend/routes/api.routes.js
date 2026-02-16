const express = require('express');
const router = express.Router();

const routeController = require('../controllers/route.controller');
const trafficController = require('../controllers/traffic.controller');
const geotabService = require('../services/geotab.service');
const osrmService = require('../services/osrm.service');

// ============ Route Optimization Routes ============

// Optimize route
router.post('/routes/optimize', (req, res) => routeController.optimizeRoute(req, res));

// Send route to Geotab Drive
router.post('/routes/send-to-driver', (req, res) => routeController.sendToDriver(req, res));

// Get single route
router.get('/routes/:id', (req, res) => routeController.getRoute(req, res));

// Get all routes
router.get('/routes', (req, res) => routeController.getAllRoutes(req, res));

// Delete route
router.delete('/routes/:id', (req, res) => routeController.deleteRoute(req, res));

// Get route status from Geotab
router.get('/routes/:id/status', (req, res) => routeController.getRouteStatus(req, res));

// ============ Traffic Routes ============

// Get traffic for area
router.get('/traffic/area', (req, res) => trafficController.getTrafficForArea(req, res));

// Get budget statistics
router.get('/traffic/budget', (req, res) => trafficController.getBudgetStats(req, res));

// Clear cache
router.post('/traffic/cache/clear', (req, res) => trafficController.clearCache(req, res));

// Prefetch traffic
router.post('/traffic/prefetch', (req, res) => trafficController.prefetchTraffic(req, res));

// ============ Geotab Routes ============

// Get devices (vehicles)
router.get('/geotab/devices', async (req, res) => {
    try {
        const devices = await geotabService.getDevices();
        res.json({ success: true, devices });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get drivers
router.get('/geotab/drivers', async (req, res) => {
    try {
        const drivers = await geotabService.getDrivers();
        res.json({ success: true, drivers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ Health Check Routes ============

// API health check
router.get('/health', async (req, res) => {
    try {
        const osrmHealthy = await osrmService.checkHealth();

        res.json({
            success: true,
            status: 'healthy',
            services: {
                api: 'ok',
                osrm: osrmHealthy ? 'ok' : 'degraded',
                database: 'ok'
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: error.message
        });
    }
});

module.exports = router;
