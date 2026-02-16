# Route Optimizer - Quick Start Guide

Get your Route Optimizer running in 5 minutes!

## 📋 Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] PostgreSQL 14+ installed and running
- [ ] TomTom API key (free tier)
- [ ] MyGeotab credentials

---

## 🚀 Quick Setup (5 Steps)

### Step 1: Configure Environment

```bash
cd C:\Users\dariofrisone\route-optimizer
cp .env.example .env
```

Edit `.env` and fill in:
```env
DB_PASSWORD=your_postgres_password
TOMTOM_API_KEY=your_tomtom_api_key
GEOTAB_USERNAME=your_geotab_email
GEOTAB_PASSWORD=your_geotab_password
GEOTAB_DATABASE=your_company_database
```

### Step 2: Initialize Database

```bash
npm run db:init
```

Expected output:
```
✅ Database initialization completed successfully!
```

### Step 3: Start Server

```bash
npm run dev
```

Expected output:
```
🚀 Server running on port 3000
```

### Step 4: Test API

Open browser:
```
http://localhost:3000/api/health
```

Should show: `"status": "healthy"`

### Step 5: Register in MyGeotab

1. Open MyGeotab
2. Go to **Administration → System → Add-Ins**
3. Click **New Add-In**
4. Enter:
   - **Name:** Route Optimizer
   - **URL:** `http://localhost:3000/frontend/index.html`
5. Save and refresh MyGeotab
6. Find "Route Optimizer" in sidebar

---

## ✅ You're Ready!

Now you can:
1. Click on map to add stops
2. Click "Optimize Route" to optimize with traffic
3. Click "Send to Driver" to deliver route via Geotab Drive

---

## 📊 Monitor Usage

Check your TomTom API usage:
```
http://localhost:3000/api/traffic/budget
```

Stay under 2,500 requests/day!

---

## 🆘 Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL is running
sudo service postgresql status

# Verify connection
psql -U postgres -c "SELECT 1"
```

### Can't Get TomTom API Key
1. Visit https://developer.tomtom.com
2. Sign up (free)
3. Dashboard → My Apps → Create App
4. Copy API Key

### MyGeotab Add-In Not Showing
- Clear browser cache
- Refresh MyGeotab
- Check URL is correct: `http://localhost:3000/frontend/index.html`
- Verify server is running

---

## 📚 Documentation

- **Full Setup Guide:** `docs/SETUP.md`
- **API Reference:** `docs/API.md`
- **Main README:** `README.md`

---

## 🎯 Next Steps

### Optimize Settings

Edit `.env` to tune cache behavior:
```env
TRAFFIC_CACHE_TTL_HIGHWAY=180    # 3 minutes
TRAFFIC_CACHE_TTL_URBAN=300      # 5 minutes
TRAFFIC_CACHE_TTL_RURAL=900      # 15 minutes
```

### Deploy to Production

```bash
# Using PM2
npm install -g pm2
pm2 start backend/server.js --name route-optimizer
pm2 save
pm2 startup
```

### Self-Host OSRM (Optional)

For better Italy routing:
```bash
# Download Italy map
wget http://download.geofabrik.de/europe/italy-latest.osm.pbf

# Run with Docker
docker run -t -i -p 5000:5000 -v "${PWD}:/data" \
  osrm/osrm-backend osrm-routed /data/italy-latest.osrm
```

Update `.env`:
```env
OSRM_URL=http://localhost:5000
```

---

## 💡 Tips

**Save API Requests:**
- Traffic is cached automatically
- Optimize routes during off-peak hours (00:00-06:00)
- Cache hit rate shown in UI

**Best Performance:**
- Use self-hosted OSRM for Italy
- Run prefetch overnight
- Monitor budget daily

**Production Ready:**
- Enable HTTPS
- Set `NODE_ENV=production`
- Configure PM2 or Docker
- Set up database backups

---

## 🎉 Success!

You now have a fully functional route optimizer integrated with MyGeotab and real-time Italian traffic data!

**Need Help?**
- Check logs: `logs/app.log`
- API health: `http://localhost:3000/api/health`
- Review docs: `docs/` directory
