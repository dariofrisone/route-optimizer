# Route Optimizer API Documentation

## Base URL
```
http://localhost:3000/api
```

---

## Route Endpoints

### Optimize Route
**POST** `/routes/optimize`

Optimize a multi-stop route with traffic consideration.

**Request Body:**
```json
{
  "stops": [
    {
      "lat": 45.4642,
      "lon": 9.1900,
      "name": "Milan Office",
      "address": "Via Roma 123, Milan",
      "timeWindow": {
        "start": "08:00",
        "end": "12:00"
      },
      "serviceDuration": 15
    },
    {
      "lat": 45.0703,
      "lon": 7.6869,
      "name": "Turin Warehouse"
    }
  ],
  "vehicleId": "b1234",
  "driverId": "d5678",
  "routeName": "Milan Deliveries",
  "departureTime": "2026-02-16T08:00:00Z",
  "considerTraffic": true
}
```

**Response:**
```json
{
  "success": true,
  "routeId": 42,
  "stops": [
    {
      "lat": 45.4642,
      "lon": 9.1900,
      "name": "Milan Office",
      "order": 1,
      "arrivalTime": "2026-02-16T08:00:00Z",
      "departureTime": "2026-02-16T08:15:00Z"
    }
  ],
  "totalDistanceKm": 125.5,
  "totalDurationMinutes": 90,
  "optimizationTimeMs": 1234,
  "trafficConsidered": true,
  "cacheHitRate": "75.0"
}
```

---

### Send Route to Driver
**POST** `/routes/send-to-driver`

Send optimized route to Geotab Drive app.

**Request Body:**
```json
{
  "routeId": 42,
  "driverId": "b1234",
  "vehicleId": "v5678"
}
```

**Response:**
```json
{
  "success": true,
  "routeId": 42,
  "geotabRouteId": "a1b2c3d4",
  "message": "Route sent to Geotab Drive app"
}
```

---

### Get Route
**GET** `/routes/:id`

Get route details by ID.

**Response:**
```json
{
  "id": 42,
  "name": "Milan Deliveries",
  "vehicle_id": "b1234",
  "driver_id": "d5678",
  "total_distance_km": 125.5,
  "total_duration_minutes": 90,
  "status": "sent",
  "geotab_route_id": "a1b2c3d4",
  "stops": [...]
}
```

---

### Get All Routes
**GET** `/routes`

Get all routes with optional filtering.

**Query Parameters:**
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset (default: 0)
- `status` - Filter by status (draft, active, sent, completed)

**Response:**
```json
{
  "routes": [...],
  "total": 10
}
```

---

### Delete Route
**DELETE** `/routes/:id`

Delete a route (also removes from Geotab if sent).

**Response:**
```json
{
  "success": true,
  "message": "Route deleted"
}
```

---

### Get Route Status
**GET** `/routes/:id/status`

Get route status from Geotab.

**Response:**
```json
{
  "success": true,
  "route": {...},
  "stops": [...]
}
```

---

## Traffic Endpoints

### Get Traffic for Area
**GET** `/traffic/area`

Get traffic data for a geographic area.

**Query Parameters:**
- `latMin` - Minimum latitude
- `latMax` - Maximum latitude
- `lonMin` - Minimum longitude
- `lonMax` - Maximum longitude

**Response:**
```json
{
  "success": true,
  "trafficData": {
    "45.0000_9.0000": {
      "flow": {...},
      "incidents": [...]
    }
  },
  "cacheHitRate": "75.0",
  "cellsFetched": 2,
  "totalCells": 5
}
```

---

### Get Budget Statistics
**GET** `/traffic/budget`

Get TomTom API usage statistics for today.

**Response:**
```json
{
  "success": true,
  "date": "2026-02-16",
  "totalUsed": 1234,
  "remaining": 1266,
  "percentUsed": "49.4",
  "dailyLimit": 2500,
  "byType": [
    {
      "budget_type": "active",
      "total": 800
    }
  ]
}
```

---

### Clear Cache
**POST** `/traffic/cache/clear`

Clear expired traffic cache entries.

**Response:**
```json
{
  "success": true,
  "message": "Cache cleared successfully"
}
```

---

### Prefetch Traffic
**POST** `/traffic/prefetch`

Manually trigger traffic prefetch (off-peak hours only).

**Response:**
```json
{
  "success": true,
  "message": "Traffic prefetch completed"
}
```

---

## Geotab Endpoints

### Get Vehicles
**GET** `/geotab/devices`

Get all vehicles from MyGeotab.

**Response:**
```json
{
  "success": true,
  "devices": [
    {
      "id": "b1234",
      "name": "Truck 01",
      "serialNumber": "G9ABC123"
    }
  ]
}
```

---

### Get Drivers
**GET** `/geotab/drivers`

Get all drivers from MyGeotab.

**Response:**
```json
{
  "success": true,
  "drivers": [
    {
      "id": "b5678",
      "name": "John Doe",
      "firstName": "John",
      "lastName": "Doe"
    }
  ]
}
```

---

## Health Check

### API Health
**GET** `/health`

Check API and service health.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "services": {
    "api": "ok",
    "osrm": "ok",
    "database": "ok"
  },
  "timestamp": "2026-02-16T10:30:00Z"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

The API uses TomTom Traffic API with a free tier limit of **2,500 requests per day**.

**Budget Allocation:**
- Active routes: 40% (1,000 requests)
- Prefetch: 24% (600 requests)
- Refresh: 28% (700 requests)
- Buffer: 8% (200 requests)

**Tips to Stay Under Limit:**
- Traffic data is cached (3-15 minutes depending on road type)
- Optimize routes during off-peak hours when possible
- Monitor usage at `/traffic/budget`
