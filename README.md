# Route Optimizer for MyGeotab - Italy Traffic Integration

## Overview

A comprehensive route optimization system that integrates with MyGeotab to provide:
- **Real-time traffic data** for Italy (accidents, roadworks, traffic conditions)
- **Multi-stop route optimization** considering traffic conditions
- **Route delivery** to drivers via Geotab Drive app
- **Traffic visualization** for planned routes and Italy road conditions

**100% FREE** - Uses TomTom Traffic API free tier (2,500 requests/day)

## Architecture

### Backend (Node.js/Express)
- RESTful API for route optimization
- Grid-based traffic caching (stays under 2,500 req/day limit)
- Integrations:
  - **OSRM** - Free routing engine
  - **TomTom Traffic API** - Real-time traffic data
  - **VROOM** - Multi-stop route optimization
  - **MyGeotab API** - Route delivery to Geotab Drive

### Frontend (MyGeotab Add-In)
- HTML/CSS/JavaScript with Leaflet.js
- Interactive map interface
- Route builder with drag-and-drop stops
- Traffic visualization overlay
- Driver assignment interface

### Database (PostgreSQL)
- Route storage
- Traffic cache with grid cells
- API usage tracking

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- TomTom API key (free tier)
- MyGeotab account with API credentials

### Installation

1. **Clone and install dependencies:**
```bash
cd route-optimizer
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your API keys and database credentials
```

3. **Initialize database:**
```bash
npm run db:init
```

4. **Start the server:**
```bash
npm run dev  # Development mode with auto-reload
# or
npm start    # Production mode
```

### Deploy MyGeotab Add-In

1. Open MyGeotab → Administration → System → System Settings
2. Navigate to Add-Ins
3. Click "Add" and enter:
   - **Name:** Route Optimizer
   - **URL:** `http://localhost:3000/frontend/index.html`
   - **Support URL:** Your support page
4. Click Save

## Traffic Caching Strategy

**Grid-Based System:**
- Italy divided into 50km x 50km grid cells
- Each cell cached for 3-15 minutes (highways = 3min, rural = 15min)
- Shared across all users and routes

**Daily Budget (2,500 requests):**
- 40% (1,000) - Active route optimization
- 24% (600) - Background prefetch (off-peak hours)
- 28% (700) - On-demand user refresh
- 8% (200) - Buffer/reserve

**Smart Features:**
- Only fetches uncached grid cells
- Hourly budget limits (104/hour max)
- Priority: active routes > new routes > background updates

## API Endpoints

### Route Optimization
```
POST /api/routes/optimize
{
  "stops": [
    {"lat": 45.4642, "lon": 9.1900, "name": "Milan", "timeWindow": {"start": "08:00", "end": "12:00"}},
    {"lat": 45.0703, "lon": 7.6869, "name": "Turin"}
  ],
  "vehicleId": "b1234",
  "departureTime": "2026-02-16T08:00:00Z"
}
```

### Traffic Data
```
GET /api/traffic/area?bounds=45.0,7.0,46.0,10.0
```

### Send to Geotab Drive
```
POST /api/routes/send-to-driver
{
  "routeId": "route-123",
  "driverId": "driver-456",
  "vehicleId": "vehicle-789"
}
```

## File Structure

```
route-optimizer/
├── backend/
│   ├── config/
│   │   └── database.js          # PostgreSQL connection
│   ├── controllers/
│   │   ├── route.controller.js  # Route endpoints
│   │   └── traffic.controller.js # Traffic endpoints
│   ├── services/
│   │   ├── optimization.service.js # VROOM integration
│   │   ├── traffic.service.js      # TomTom + caching
│   │   ├── geotab.service.js       # MyGeotab API
│   │   └── osrm.service.js         # Routing engine
│   ├── utils/
│   │   ├── budget-manager.js    # API request budgeting
│   │   ├── grid-calculator.js   # Geographic grid system
│   │   └── logger.js            # Logging utility
│   ├── database/
│   │   ├── init.js              # Database initialization
│   │   └── schema.sql           # Table schemas
│   ├── routes/
│   │   └── api.routes.js        # API route definitions
│   └── server.js                # Express app entry point
├── frontend/
│   ├── configuration.json       # MyGeotab Add-In config
│   ├── index.html              # Main UI
│   ├── css/
│   │   └── styles.css          # UI styles
│   └── js/
│       ├── main.js             # Add-In lifecycle
│       ├── map/
│       │   └── map-manager.js  # Leaflet integration
│       └── route/
│           ├── optimizer-client.js # Backend API client
│           └── route-builder.js    # Route UI logic
└── docs/
    ├── SETUP.md                # Detailed setup guide
    └── API.md                  # API documentation
```

## Development

### Running Tests
```bash
npm test
```

### Monitoring API Usage
Check daily TomTom API usage:
```sql
SELECT date, request_count
FROM api_usage
WHERE api_name = 'tomtom'
ORDER BY date DESC
LIMIT 7;
```

### Clearing Traffic Cache
```sql
DELETE FROM traffic_cache WHERE expires_at < NOW();
```

## Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production` in .env
- [ ] Configure HTTPS/SSL
- [ ] Set up PostgreSQL backup
- [ ] Configure firewall rules
- [ ] Set up monitoring (PM2 or similar)
- [ ] Register Add-In in MyGeotab Marketplace

### PM2 Deployment
```bash
npm install -g pm2
pm2 start backend/server.js --name route-optimizer
pm2 save
pm2 startup
```

## Support

For issues or questions:
- GitHub Issues: [Your repository]
- Email: dariofrisone@example.com

## License

MIT
