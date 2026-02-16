# Route Optimizer - Detailed Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed and configured:

### Required Software
- **Node.js 18+** and npm
- **PostgreSQL 14+**
- **Git** (for version control)

### Required Accounts & API Keys
- **TomTom Developer Account** (free tier)
  - Sign up at: https://developer.tomtom.com
  - Create API key in dashboard
  - Free tier: 2,500 requests/day

- **MyGeotab Account**
  - Username, password, and database name
  - API access enabled

### Optional (for self-hosting)
- **OSRM Server** (or use public API)
- **VROOM Server** (or use fallback algorithm)
- **VPS/Cloud Server** for production deployment

---

## Installation Steps

### 1. Clone or Download Project

```bash
cd C:\Users\dariofrisone
# Project already created at: C:\Users\dariofrisone\route-optimizer
```

### 2. Install Dependencies

```bash
cd route-optimizer
npm install
```

This will install:
- Express (API server)
- PostgreSQL client (pg)
- Axios (HTTP client)
- Node-cron (scheduled tasks)
- Helmet, CORS, Compression (security & performance)

### 3. Configure PostgreSQL

#### Install PostgreSQL (if not installed)
- **Windows:** Download from https://www.postgresql.org/download/windows/
- **Linux:** `sudo apt-get install postgresql postgresql-contrib`
- **macOS:** `brew install postgresql`

#### Start PostgreSQL Service
```bash
# Windows
net start postgresql-x64-14

# Linux/macOS
sudo service postgresql start
```

#### Create Database User (optional)
```bash
psql -U postgres
CREATE USER route_optimizer WITH PASSWORD 'your_secure_password';
ALTER USER route_optimizer CREATEDB;
\q
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# PostgreSQL Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=route_optimizer
DB_USER=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD

# API Keys
TOMTOM_API_KEY=YOUR_TOMTOM_API_KEY_HERE
GEOTAB_USERNAME=your_email@company.com
GEOTAB_PASSWORD=your_geotab_password
GEOTAB_DATABASE=your_company_database

# OSRM Configuration
OSRM_URL=http://router.project-osrm.org
# Or self-hosted: http://localhost:5000

# VROOM Configuration (optional)
# VROOM_URL=http://localhost:3000

# Traffic Settings (defaults shown)
TRAFFIC_CACHE_TTL_HIGHWAY=180
TRAFFIC_CACHE_TTL_URBAN=300
TRAFFIC_CACHE_TTL_RURAL=900
TRAFFIC_GRID_SIZE_KM=50

# API Budget Management
TOMTOM_DAILY_LIMIT=2500
TOMTOM_HOURLY_LIMIT=104
BUDGET_ALLOCATION_ACTIVE=0.40
BUDGET_ALLOCATION_PREFETCH=0.24
BUDGET_ALLOCATION_REFRESH=0.28
BUDGET_ALLOCATION_BUFFER=0.08
```

### 5. Initialize Database

Run the database initialization script:

```bash
npm run db:init
```

This will:
- Create the `route_optimizer` database
- Create all required tables
- Set up indexes and triggers
- Insert sample data

**Expected Output:**
```
✓ Connected to PostgreSQL server
✓ Created database: route_optimizer
✓ Database schema created successfully

📊 Created tables:
   - routes
   - route_stops
   - traffic_cache
   - api_usage
   - optimization_history
   - geotab_zones

✅ Database initialization completed successfully!
```

### 6. Get TomTom API Key

1. Visit https://developer.tomtom.com
2. Create account (free)
3. Go to Dashboard → My Apps
4. Click "Create App"
5. Copy the API Key
6. Paste into `.env` file (`TOMTOM_API_KEY`)

### 7. Configure MyGeotab Credentials

1. Get your MyGeotab credentials:
   - **Username:** Your email
   - **Password:** Your password
   - **Database:** Your company database name (e.g., "company_fleet")

2. Update `.env` file with these credentials

### 8. Start the Server

**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║   Route Optimizer for MyGeotab - Italy Traffic Integration ║
╚════════════════════════════════════════════════════════════╝

🚀 Server running on port 3000
📍 Environment: development

📡 Endpoints:
   - API: http://localhost:3000/api
   - MyGeotab Add-In: http://localhost:3000/frontend/index.html
   - Health Check: http://localhost:3000/api/health

📊 Monitoring:
   - Budget Stats: http://localhost:3000/api/traffic/budget

⏰ Scheduled Tasks:
   - Daily budget reset: 00:00
   - Hourly cache cleanup: Every hour
   - Traffic prefetch: Every 30min (00:00-06:00)
```

### 9. Test the API

Open browser and test:
```
http://localhost:3000/api/health
```

Should return:
```json
{
  "success": true,
  "status": "healthy",
  "services": {
    "api": "ok",
    "osrm": "ok",
    "database": "ok"
  }
}
```

---

## Register MyGeotab Add-In

### Method 1: Local Development

1. Open MyGeotab in browser
2. Go to **Administration → System → System Settings**
3. Click **Add-Ins** tab
4. Click **New Add-In**
5. Enter details:
   - **Name:** Route Optimizer
   - **URL:** `http://localhost:3000/frontend/index.html`
   - **Support URL:** Your support page
6. Click **Save**
7. Refresh MyGeotab
8. Find "Route Optimizer" in the sidebar

### Method 2: Production Deployment

After deploying to production server:

1. Use HTTPS URL: `https://your-domain.com/frontend/index.html`
2. Register in MyGeotab Marketplace (optional)
3. Distribute to your organization

---

## Optional: Self-Host OSRM

For better performance and Italy-specific optimization:

### 1. Install Docker

```bash
# Windows: Download Docker Desktop
# Linux: sudo apt-get install docker.io
```

### 2. Download Italy OSM Data

```bash
wget http://download.geofabrik.de/europe/italy-latest.osm.pbf
```

### 3. Build OSRM Data

```bash
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/italy-latest.osm.pbf
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/italy-latest.osrm
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/italy-latest.osrm
```

### 4. Start OSRM Server

```bash
docker run -t -i -p 5000:5000 -v "${PWD}:/data" osrm/osrm-backend osrm-routed --algorithm mld /data/italy-latest.osrm
```

### 5. Update .env

```env
OSRM_URL=http://localhost:5000
```

---

## Troubleshooting

### Database Connection Failed

**Error:** `Failed to connect to PostgreSQL`

**Solutions:**
1. Ensure PostgreSQL is running: `sudo service postgresql status`
2. Check credentials in `.env`
3. Verify database exists: `psql -U postgres -l`
4. Check firewall rules

### TomTom API Errors

**Error:** `TomTom API request failed`

**Solutions:**
1. Verify API key is correct in `.env`
2. Check daily limit at https://developer.tomtom.com
3. Review budget stats: `http://localhost:3000/api/traffic/budget`

### MyGeotab Authentication Failed

**Error:** `Geotab auth error`

**Solutions:**
1. Verify username/password/database in `.env`
2. Check account has API access enabled
3. Try logging into MyGeotab web interface

### OSRM Service Unavailable

**Error:** `OSRM health check failed`

**Solutions:**
1. If using public API, check internet connection
2. If self-hosted, ensure Docker container is running
3. Test manually: `curl http://localhost:5000/route/v1/driving/9.1900,45.4642;7.6869,45.0703`

### Port Already in Use

**Error:** `Port 3000 already in use`

**Solutions:**
1. Change port in `.env`: `PORT=3001`
2. Or kill process using port: `npx kill-port 3000`

---

## Production Deployment

### Using PM2

1. **Install PM2:**
```bash
npm install -g pm2
```

2. **Start Application:**
```bash
pm2 start backend/server.js --name route-optimizer
pm2 save
pm2 startup
```

3. **Monitor:**
```bash
pm2 logs route-optimizer
pm2 monit
```

### Using Docker

```dockerfile
# Dockerfile (create this file)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "backend/server.js"]
```

```bash
# Build and run
docker build -t route-optimizer .
docker run -p 3000:3000 --env-file .env route-optimizer
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name route-optimizer.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Maintenance

### Daily Checks
- Monitor API budget: `GET /api/traffic/budget`
- Check logs: `tail -f logs/app.log`
- Review error log: `tail -f logs/error.log`

### Weekly Tasks
- Clear old routes: `DELETE FROM routes WHERE created_at < NOW() - INTERVAL '30 days'`
- Vacuum database: `VACUUM ANALYZE`
- Update dependencies: `npm update`

### Monthly Tasks
- Renew TomTom API key (if needed)
- Review and optimize cache settings
- Analyze route optimization performance

---

## Support

For issues:
- Check logs in `logs/` directory
- Review API documentation: `docs/API.md`
- Test health endpoint: `/api/health`
- Monitor budget: `/api/traffic/budget`
