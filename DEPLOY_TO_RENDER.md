# Deploy Route Optimizer to Render.com (FREE)

## 🎯 Why Render?
- ✅ 100% FREE tier
- ✅ Automatic HTTPS
- ✅ Free PostgreSQL database
- ✅ Auto-deploy from GitHub
- ✅ No admin password needed
- ✅ Works from anywhere (not just localhost)

---

## 📋 Prerequisites
- GitHub account (free)
- Render account (free)
- TomTom API key
- MyGeotab credentials

---

## 🚀 Deployment Steps

### Step 1: Push to GitHub

1. **Create a new repository on GitHub:**
   - Go to https://github.com/new
   - Name: `route-optimizer`
   - Make it **Private** (keep your API keys safe)
   - Don't initialize with README (we have one)
   - Click **Create repository**

2. **Push your code:**
   ```bash
   cd C:\Users\dariofrisone\route-optimizer

   # Initialize git
   git init

   # Add all files
   git add .

   # Commit
   git commit -m "Initial commit - Route Optimizer for MyGeotab"

   # Add your GitHub repo (replace YOUR_USERNAME)
   git remote add origin https://github.com/YOUR_USERNAME/route-optimizer.git

   # Push
   git branch -M main
   git push -u origin main
   ```

---

### Step 2: Create Render Account

1. Go to https://render.com
2. Click **"Get Started"**
3. Sign up with your **GitHub account** (easiest)
4. Authorize Render to access your repositories

---

### Step 3: Deploy with Blueprint

1. In Render dashboard, click **"New +"**
2. Select **"Blueprint"**
3. Connect your repository: `route-optimizer`
4. Render will detect `render.yaml` and show:
   ```
   ✓ Web Service: route-optimizer
   ✓ PostgreSQL Database: route-optimizer-db
   ```
5. Click **"Apply"**

---

### Step 4: Add Environment Variables

Render will ask for environment variables marked as `sync: false`:

```
TOMTOM_API_KEY = your_tomtom_api_key_here
GEOTAB_USERNAME = your_geotab_email@company.com
GEOTAB_PASSWORD = your_geotab_password
GEOTAB_DATABASE = your_company_database
```

Click **"Apply"** again.

---

### Step 5: Wait for Deployment

Render will:
1. Create PostgreSQL database (1-2 minutes)
2. Build your app (`npm install`) (2-3 minutes)
3. Start the server (1 minute)

**Total time: ~5 minutes**

You'll see logs like:
```
==> Installing dependencies...
==> Building...
==> Starting server...
🚀 Server running on port 10000
✓ Route Optimizer server started successfully
```

---

### Step 6: Initialize Database

1. Once deployed, go to your service page
2. Click **"Shell"** tab (top navigation)
3. Run:
   ```bash
   npm run db:init
   ```

You should see:
```
✓ Connected to PostgreSQL server
✓ Created database: route_optimizer
✓ Database schema created successfully
```

---

### Step 7: Get Your URL

Your app is now live at:
```
https://route-optimizer-XXXX.onrender.com
```

Find it in the Render dashboard (top of your service page).

---

### Step 8: Register in MyGeotab

1. Open MyGeotab
2. Go to **Administration → System → System Settings → Add-Ins**
3. Click **"New Add-In"**
4. Enter:
   ```
   Name: Route Optimizer
   URL: https://route-optimizer-XXXX.onrender.com/frontend/index.html
   Support Email: frisonedario95@gmail.com
   ```
5. Click **Save**
6. Refresh MyGeotab
7. Find **"Route Optimizer"** in the sidebar under **"Activities"**

---

## ✅ Testing Your Deployment

### Test 1: Health Check
Visit in browser:
```
https://route-optimizer-XXXX.onrender.com/api/health
```

Should return:
```json
{
  "success": true,
  "status": "healthy"
}
```

### Test 2: Frontend
Visit:
```
https://route-optimizer-XXXX.onrender.com/frontend/index.html
```

Should show the map and UI.

### Test 3: Budget Stats
Visit:
```
https://route-optimizer-XXXX.onrender.com/api/traffic/budget
```

Should show API usage stats.

---

## 🔄 Updating Your App

Whenever you make changes:

```bash
cd C:\Users\dariofrisone\route-optimizer

# Make your changes...

# Commit and push
git add .
git commit -m "Update: description of changes"
git push

# Render will auto-deploy in ~2 minutes
```

---

## 💰 Render Free Tier Limits

**Web Service:**
- ✅ 750 hours/month (enough for 24/7)
- ✅ Automatic HTTPS
- ⚠️ Sleeps after 15 min of inactivity (wakes in <30 seconds)

**PostgreSQL:**
- ✅ 1 GB storage
- ✅ Expires after 90 days (can recreate for free)
- ✅ Automatic backups

**Workaround for sleep:**
- Use a free uptime monitor (https://uptimerobot.com) to ping your app every 5 minutes
- This keeps it awake 24/7

---

## 🆘 Troubleshooting

### Build Failed
**Error:** `npm install failed`

**Fix:**
1. Check `package.json` is valid
2. Delete `package-lock.json` and try again
3. Check Render logs for specific error

### Database Connection Failed
**Error:** `Failed to connect to PostgreSQL`

**Fix:**
1. Ensure database was created
2. Check environment variables are linked correctly
3. Run `npm run db:init` in Shell

### Environment Variables Not Working
**Fix:**
1. Go to service → **Environment**
2. Verify all variables are set
3. Click **"Manual Deploy"** → **"Deploy latest commit"**

---

## 🎉 Success!

Your Route Optimizer is now:
- ✅ Live on the internet (HTTPS)
- ✅ Accessible from anywhere
- ✅ Integrated with MyGeotab
- ✅ 100% FREE
- ✅ No admin password needed

**Your URL:** `https://route-optimizer-XXXX.onrender.com/frontend/index.html`

Add this to MyGeotab and you're done! 🚀
