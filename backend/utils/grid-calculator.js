/**
 * Grid-based geographic calculator for traffic caching
 * Divides Italy into grid cells for efficient caching
 */

class GridCalculator {
    constructor(gridSizeKm = 50) {
        this.gridSizeKm = gridSizeKm;
        // Approximate km per degree at Italy's latitude (~45°)
        this.kmPerLatDegree = 111.0;
        this.kmPerLonDegree = 78.8; // cos(45°) * 111
    }

    /**
     * Calculate grid cell ID for a given coordinate
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {string} Grid cell ID (e.g., "45.0_9.0")
     */
    getGridCell(lat, lon) {
        const latDegreeSize = this.gridSizeKm / this.kmPerLatDegree;
        const lonDegreeSize = this.gridSizeKm / this.kmPerLonDegree;

        const latGridIndex = Math.floor(lat / latDegreeSize);
        const lonGridIndex = Math.floor(lon / lonDegreeSize);

        const latMin = latGridIndex * latDegreeSize;
        const lonMin = lonGridIndex * lonDegreeSize;

        return `${latMin.toFixed(4)}_${lonMin.toFixed(4)}`;
    }

    /**
     * Get grid cell boundaries
     * @param {string} gridCell - Grid cell ID
     * @returns {{latMin, latMax, lonMin, lonMax}}
     */
    getGridBounds(gridCell) {
        const [latMin, lonMin] = gridCell.split('_').map(parseFloat);

        const latDegreeSize = this.gridSizeKm / this.kmPerLatDegree;
        const lonDegreeSize = this.gridSizeKm / this.kmPerLonDegree;

        return {
            latMin,
            latMax: latMin + latDegreeSize,
            lonMin,
            lonMax: lonMin + lonDegreeSize
        };
    }

    /**
     * Get all grid cells that intersect with a bounding box
     * @param {object} bounds - {latMin, latMax, lonMin, lonMax}
     * @returns {Array<string>} Array of grid cell IDs
     */
    getGridCellsForBounds(bounds) {
        const { latMin, latMax, lonMin, lonMax } = bounds;
        const cells = [];

        const latDegreeSize = this.gridSizeKm / this.kmPerLatDegree;
        const lonDegreeSize = this.gridSizeKm / this.kmPerLonDegree;

        const latStartIndex = Math.floor(latMin / latDegreeSize);
        const latEndIndex = Math.floor(latMax / latDegreeSize);
        const lonStartIndex = Math.floor(lonMin / lonDegreeSize);
        const lonEndIndex = Math.floor(lonMax / lonDegreeSize);

        for (let latIdx = latStartIndex; latIdx <= latEndIndex; latIdx++) {
            for (let lonIdx = lonStartIndex; lonIdx <= lonEndIndex; lonIdx++) {
                const cellLatMin = latIdx * latDegreeSize;
                const cellLonMin = lonIdx * lonDegreeSize;
                cells.push(`${cellLatMin.toFixed(4)}_${cellLonMin.toFixed(4)}`);
            }
        }

        return cells;
    }

    /**
     * Get grid cells for a list of coordinates (route stops)
     * @param {Array<{lat, lon}>} coordinates
     * @returns {Array<string>} Unique grid cell IDs
     */
    getGridCellsForRoute(coordinates) {
        const cells = new Set();

        coordinates.forEach(coord => {
            const cell = this.getGridCell(coord.lat, coord.lon);
            cells.add(cell);
        });

        return Array.from(cells);
    }

    /**
     * Calculate bounding box for a set of coordinates
     * @param {Array<{lat, lon}>} coordinates
     * @param {number} padding - Padding in km (default 10km)
     * @returns {{latMin, latMax, lonMin, lonMax}}
     */
    getBoundingBox(coordinates, padding = 10) {
        if (!coordinates || coordinates.length === 0) {
            return null;
        }

        let latMin = coordinates[0].lat;
        let latMax = coordinates[0].lat;
        let lonMin = coordinates[0].lon;
        let lonMax = coordinates[0].lon;

        coordinates.forEach(coord => {
            latMin = Math.min(latMin, coord.lat);
            latMax = Math.max(latMax, coord.lat);
            lonMin = Math.min(lonMin, coord.lon);
            lonMax = Math.max(lonMax, coord.lon);
        });

        // Add padding
        const latPadding = padding / this.kmPerLatDegree;
        const lonPadding = padding / this.kmPerLonDegree;

        return {
            latMin: latMin - latPadding,
            latMax: latMax + latPadding,
            lonMin: lonMin - lonPadding,
            lonMax: lonMax + lonPadding
        };
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     * @param {object} coord1 - {lat, lon}
     * @param {object} coord2 - {lat, lon}
     * @returns {number} Distance in kilometers
     */
    calculateDistance(coord1, coord2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRadians(coord2.lat - coord1.lat);
        const dLon = this.toRadians(coord2.lon - coord1.lon);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(coord1.lat)) *
            Math.cos(this.toRadians(coord2.lat)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Determine road type based on road classification
     * @param {string} roadClass - TomTom road class
     * @returns {string} highway, urban, or rural
     */
    getRoadType(roadClass) {
        const highways = ['motorway', 'trunk', 'primary'];
        const urban = ['secondary', 'tertiary', 'residential'];

        if (highways.includes(roadClass)) return 'highway';
        if (urban.includes(roadClass)) return 'urban';
        return 'rural';
    }

    /**
     * Get cache TTL based on road type
     * @param {string} roadType - highway, urban, or rural
     * @returns {number} TTL in seconds
     */
    getCacheTTL(roadType) {
        const ttls = {
            highway: parseInt(process.env.TRAFFIC_CACHE_TTL_HIGHWAY) || 180,  // 3 minutes
            urban: parseInt(process.env.TRAFFIC_CACHE_TTL_URBAN) || 300,      // 5 minutes
            rural: parseInt(process.env.TRAFFIC_CACHE_TTL_RURAL) || 900       // 15 minutes
        };
        return ttls[roadType] || 300;
    }

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    toDegrees(radians) {
        return radians * (180 / Math.PI);
    }
}

module.exports = new GridCalculator(
    parseInt(process.env.TRAFFIC_GRID_SIZE_KM) || 50
);
