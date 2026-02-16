-- Route Optimizer Database Schema

-- Routes table
CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    vehicle_id VARCHAR(100),
    driver_id VARCHAR(100),
    total_distance_km DECIMAL(10, 2),
    total_duration_minutes INTEGER,
    departure_time TIMESTAMP,
    geotab_route_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Route stops table
CREATE TABLE IF NOT EXISTS route_stops (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL,
    lat DECIMAL(10, 7) NOT NULL,
    lon DECIMAL(10, 7) NOT NULL,
    name VARCHAR(255),
    address TEXT,
    time_window_start TIME,
    time_window_end TIME,
    expected_arrival TIMESTAMP,
    service_duration_minutes INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Traffic cache table with grid-based system
CREATE TABLE IF NOT EXISTS traffic_cache (
    id SERIAL PRIMARY KEY,
    grid_cell VARCHAR(50) NOT NULL,
    lat_min DECIMAL(10, 7) NOT NULL,
    lat_max DECIMAL(10, 7) NOT NULL,
    lon_min DECIMAL(10, 7) NOT NULL,
    lon_max DECIMAL(10, 7) NOT NULL,
    traffic_data JSONB NOT NULL,
    road_type VARCHAR(50), -- highway, urban, rural
    cache_ttl_seconds INTEGER DEFAULT 300,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(grid_cell)
);

-- Create index on grid_cell for fast lookups
CREATE INDEX IF NOT EXISTS idx_traffic_cache_grid ON traffic_cache(grid_cell);
CREATE INDEX IF NOT EXISTS idx_traffic_cache_expires ON traffic_cache(expires_at);

-- API usage tracking table
CREATE TABLE IF NOT EXISTS api_usage (
    id SERIAL PRIMARY KEY,
    api_name VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    hour INTEGER NOT NULL, -- 0-23
    request_count INTEGER DEFAULT 0,
    budget_type VARCHAR(50), -- active, prefetch, refresh, buffer
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(api_name, date, hour, budget_type)
);

-- Create index for usage queries
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(api_name, date, hour);

-- Optimization history table
CREATE TABLE IF NOT EXISTS optimization_history (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    original_distance_km DECIMAL(10, 2),
    optimized_distance_km DECIMAL(10, 2),
    savings_km DECIMAL(10, 2),
    savings_percent DECIMAL(5, 2),
    traffic_considered BOOLEAN DEFAULT TRUE,
    optimization_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Geotab zones mapping (for route delivery)
CREATE TABLE IF NOT EXISTS geotab_zones (
    id SERIAL PRIMARY KEY,
    geotab_zone_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255),
    lat DECIMAL(10, 7),
    lon DECIMAL(10, 7),
    radius_meters INTEGER DEFAULT 100,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for routes table
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing
INSERT INTO routes (name, vehicle_id, total_distance_km, total_duration_minutes, status) VALUES
('Test Route - Milan to Turin', 'vehicle-001', 125.5, 90, 'completed'),
('Daily Delivery - North Italy', 'vehicle-002', 250.3, 180, 'active')
ON CONFLICT DO NOTHING;
