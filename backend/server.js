const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

const apiRoutes = require('./routes/api.routes');
const logger = require('./utils/logger');
const budgetManager = require('./utils/budget-manager');
const trafficService = require('./services/traffic.service');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ Middleware ============

// Security headers
app.use(helmet({
    contentSecurityPolicy: false // Allow MyGeotab iframe embedding
}));

// CORS - allow MyGeotab to access the API
app.use(cors({
    origin: [
        'https://my.geotab.com',
        'https://*.geotab.com',
        'http://localhost:*',
        'http://127.0.0.1:*'
    ],
    credentials: true
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// ============ Static Files (MyGeotab Add-In) ============

app.use('/frontend', express.static(path.join(__dirname, '../frontend')));

// ============ API Routes ============

app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Route Optimizer API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            api: '/api',
            addin: '/frontend/index.html',
            health: '/api/health'
        }
    });
});

// ============ Error Handling ============

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path
    });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);

    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ============ Cron Jobs ============

// Daily budget reset at midnight
cron.schedule('0 0 * * *', async () => {
    logger.info('Running daily budget reset');
    await budgetManager.resetDailyCounters();
});

// Hourly cache cleanup
cron.schedule('0 * * * *', async () => {
    logger.info('Running hourly cache cleanup');
    await trafficService.cleanExpiredCache();
});

// Traffic prefetch during off-peak hours (every 30 minutes between 00:00-06:00)
cron.schedule('*/30 0-6 * * *', async () => {
    logger.info('Running traffic prefetch');
    await trafficService.prefetchCommonRoutes();
});

// ============ Server Startup ============

const server = app.listen(PORT, () => {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   Route Optimizer for MyGeotab - Italy Traffic Integration ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`\n📡 Endpoints:`);
    console.log(`   - API: http://localhost:${PORT}/api`);
    console.log(`   - MyGeotab Add-In: http://localhost:${PORT}/frontend/index.html`);
    console.log(`   - Health Check: http://localhost:${PORT}/api/health`);
    console.log(`\n📊 Monitoring:`);
    console.log(`   - Budget Stats: http://localhost:${PORT}/api/traffic/budget`);
    console.log(`\n⏰ Scheduled Tasks:`);
    console.log(`   - Daily budget reset: 00:00`);
    console.log(`   - Hourly cache cleanup: Every hour`);
    console.log(`   - Traffic prefetch: Every 30min (00:00-06:00)\n`);

    logger.info('Route Optimizer server started successfully');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
});

module.exports = app;
