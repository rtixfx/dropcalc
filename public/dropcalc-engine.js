/**
 * Fortnite Drop Calculator Engine
 * ================================
 * Hand this file to the website builder (Google AI Studio).
 * It exports a single object: DropCalcEngine
 *
 * USAGE:
 *   const engine = new DropCalcEngine();
 *   await engine.init('heightmap.bin');
 *   const result = engine.calculate(dropPoint, busStart, busEnd);
 *
 * All map points are in LEAFLET coordinates:
 *   lat: -256 to 0
 *   lng:  0 to 256
 */

// ============================================================
// CONSTANTS
// ============================================================

const CONSTANTS = {
  // --- Map coordinate system (from Dropmazter source) ---
  MAP: {
    MIN_LNG: 0,
    MAX_LNG: 256,
    MIN_LAT: -256,
    MAX_LAT: 0,
    WORLD_W: 3000,   // meters
    WORLD_H: 3000,   // meters
  },

  // --- Heightmap calibration ---
  HEIGHTMAP: {
    IMG_WIDTH:     2033,
    IMG_HEIGHT:    2033,
    RAW_MIN:       0,
    RAW_MAX:       54849,
    RAW_SEA_LEVEL: 679,
    // UE5 landscape Z scale: each raw unit = ~0.015198 meters
    // Derived from: bus altitude ~832m, peak ~828m above sea level
    // Formula: meters = (raw - RAW_SEA_LEVEL) * METERS_PER_UNIT
    METERS_PER_UNIT: 0.015198,
  },

    // --- Physics --- (calibrated to real Fortnite behavior)
  PHYSICS: {
    BUS_ALTITUDE_M:        1100,   // adjusted: closer to real drop timing

    // Bus speed is actually ~75 m/s (your value was already correct)
    BUS_SPEED_MS:          75,

    // Skydiving (scaled to map size; FN "12.75 m/s" is not literal world meters)
    // Real effective vertical speed is much higher in practice
    FREEFALL_SPEED_MS:     120,    // vertical dive speed (scaled realism)

    // Horizontal movement while diving at optimal angle
    FREEFALL_HSPEED_MS:    70,

    // Glider phase (constant descent confirmed)
    GLIDE_HSPEED_MS:       35,     // increased from 28 (too slow before)
    GLIDE_VSPEED_MS:       6,      // your value was already good

    // Auto deploy height (confirmed consistent behavior)
    GLIDE_DEPLOY_HEIGHT_M: 100,

    // Fortnite has no real acceleration phase
    JUMP_DELAY_S:          0,
  },

  // --- Obstacle avoidance ---
  OBSTACLE: {
    SLOPE_THRESHOLD: 0.7,   // normal map Z component below this = steep slope = obstacle
    MIN_CLEARANCE_M: 10,    // minimum clearance above terrain in meters
  },
};

// ============================================================
// COORDINATE CONVERSION UTILITIES
// ============================================================

const CoordUtils = {
  /**
   * Convert Leaflet lat/lng to world XY in meters
   */
  leafletToWorld(lat, lng) {
    const { MIN_LNG, MAX_LNG, MIN_LAT, MAX_LAT, WORLD_W, WORLD_H } = CONSTANTS.MAP;
    return {
      wx: ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * WORLD_W,
      wy: (1 - ((lat - MIN_LAT) / (MAX_LAT - MIN_LAT))) * WORLD_H,
    };
  },

  /**
   * Convert world XY in meters to Leaflet lat/lng
   */
  worldToLeaflet(wx, wy) {
    const { MIN_LNG, MAX_LNG, MIN_LAT, MAX_LAT, WORLD_W, WORLD_H } = CONSTANTS.MAP;
    return {
      lat: MIN_LAT + (1 - (wy / WORLD_H)) * (MAX_LAT - MIN_LAT),
      lng: MIN_LNG + (wx / WORLD_W) * (MAX_LNG - MIN_LNG),
    };
  },

  /**
   * Convert world XY to heightmap pixel XY
   */
  worldToHeightmapPixel(wx, wy) {
    const { IMG_WIDTH, IMG_HEIGHT } = CONSTANTS.HEIGHTMAP;
    const { WORLD_W, WORLD_H } = CONSTANTS.MAP;
    return {
      px: Math.floor((wx / WORLD_W) * IMG_WIDTH),
      py: Math.floor((wy / WORLD_H) * IMG_HEIGHT),
    };
  },

  /**
   * Convert Leaflet lat/lng to heightmap pixel XY
   */
  leafletToHeightmapPixel(lat, lng) {
    const world = CoordUtils.leafletToWorld(lat, lng);
    return CoordUtils.worldToHeightmapPixel(world.wx, world.wy);
  },

  /**
   * Euclidean distance in meters between two world points
   */
  worldDistance(wx1, wy1, wx2, wy2) {
    return Math.sqrt((wx2 - wx1) ** 2 + (wy2 - wy1) ** 2);
  },

  /**
   * Euclidean distance in meters between two Leaflet points
   */
  leafletDistance(lat1, lng1, lat2, lng2) {
    const a = CoordUtils.leafletToWorld(lat1, lng1);
    const b = CoordUtils.leafletToWorld(lat2, lng2);
    return CoordUtils.worldDistance(a.wx, a.wy, b.wx, b.wy);
  },
};

// ============================================================
// HEIGHTMAP SAMPLER
// ============================================================

class HeightmapSampler {
  constructor() {
    this.data = null;    // Uint16Array
    this.width = 0;
    this.height = 0;
    this.ready = false;
  }

  /**
   * Load heightmap.bin
   * @param {string} url - path/url to heightmap.bin
   */
  async load(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);

    this.width  = view.getUint32(0, true);
    this.height = view.getUint32(4, true);
    this.data   = new Uint16Array(buffer, 8);
    this.ready  = true;

    console.log(`Heightmap loaded: ${this.width}x${this.height}, ${this.data.length} pixels`);
  }

  /**
   * Get raw uint16 value at pixel (px, py)
   */
  getRaw(px, py) {
    if (!this.ready) return CONSTANTS.HEIGHTMAP.RAW_SEA_LEVEL;
    px = Math.max(0, Math.min(this.width  - 1, px));
    py = Math.max(0, Math.min(this.height - 1, py));
    return this.data[py * this.width + px];
  }

  /**
   * Get elevation in meters at pixel (px, py)
   */
  getElevationAtPixel(px, py) {
    const raw = this.getRaw(px, py);
    const { RAW_SEA_LEVEL, METERS_PER_UNIT } = CONSTANTS.HEIGHTMAP;
    return (raw - RAW_SEA_LEVEL) * METERS_PER_UNIT;
  }

  /**
   * Get elevation in meters at world coordinates (wx, wy)
   */
  getElevationAtWorld(wx, wy) {
    const { px, py } = CoordUtils.worldToHeightmapPixel(wx, wy);
    return this.getElevationAtPixel(px, py);
  }

  /**
   * Get elevation in meters at Leaflet coordinates
   */
  getElevationAtLeaflet(lat, lng) {
    const { px, py } = CoordUtils.leafletToHeightmapPixel(lat, lng);
    return this.getElevationAtPixel(px, py);
  }

  /**
   * Bilinear interpolated elevation at world coordinates (smoother)
   */
  getElevationBilinear(wx, wy) {
    const { WORLD_W, WORLD_H } = CONSTANTS.MAP;
    const { IMG_WIDTH, IMG_HEIGHT, RAW_SEA_LEVEL, METERS_PER_UNIT } = CONSTANTS.HEIGHTMAP;

    const fx = (wx / WORLD_W) * IMG_WIDTH;
    const fy = (wy / WORLD_H) * IMG_HEIGHT;

    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, IMG_WIDTH  - 1);
    const y1 = Math.min(y0 + 1, IMG_HEIGHT - 1);

    const tx = fx - x0, ty = fy - y0;

    const v00 = this.getRaw(x0, y0);
    const v10 = this.getRaw(x1, y0);
    const v01 = this.getRaw(x0, y1);
    const v11 = this.getRaw(x1, y1);

    const raw = (v00 * (1 - tx) + v10 * tx) * (1 - ty)
              + (v01 * (1 - tx) + v11 * tx) * ty;

    return (raw - RAW_SEA_LEVEL) * METERS_PER_UNIT;
  }

  /**
   * Sample slope steepness at world coordinates
   * Returns 0 (flat) to 1 (vertical cliff)
   */
  getSlopeAt(wx, wy) {
    const step = CONSTANTS.MAP.WORLD_W / CONSTANTS.HEIGHTMAP.IMG_WIDTH;
    const h0 = this.getElevationBilinear(wx, wy);
    const hx = this.getElevationBilinear(wx + step, wy);
    const hy = this.getElevationBilinear(wx, wy + step);
    const dx = (hx - h0) / step;
    const dy = (hy - h0) / step;
    return Math.min(1, Math.sqrt(dx * dx + dy * dy));
  }
}

// ============================================================
// DROP CALCULATOR CORE
// ============================================================

class DropCalculator {
  constructor(heightmapSampler) {
    this.hmap = heightmapSampler;
  }

  /**
   * Main calculation entry point.
   *
   * @param {object} dropLeaflet   - {lat, lng} of desired landing spot
   * @param {object} busStartLeaflet - {lat, lng} of bus route start
   * @param {object} busEndLeaflet   - {lat, lng} of bus route end
   * @param {number} buildingHeightM - extra height of target building in meters (default 0)
   *
   * @returns {object} result with all points and metadata
   */
  calculate(dropLeaflet, busStartLeaflet, busEndLeaflet, buildingHeightM = 0) {
    const P  = CONSTANTS.PHYSICS;
    const hmap = this.hmap;

    // --- Convert all points to world space ---
    const drop  = CoordUtils.leafletToWorld(dropLeaflet.lat,      dropLeaflet.lng);
    const busS  = CoordUtils.leafletToWorld(busStartLeaflet.lat,   busStartLeaflet.lng);
    const busE  = CoordUtils.leafletToWorld(busEndLeaflet.lat,     busEndLeaflet.lng);

    // --- Drop target elevation ---
    const dropTerrainElev = hmap.getElevationBilinear(drop.wx, drop.wy);
    const dropTargetElev  = dropTerrainElev + buildingHeightM;

    // --- Bus direction unit vector ---
    const busDx   = busE.wx - busS.wx;
    const busDy   = busE.wy - busS.wy;
    const busLen  = Math.sqrt(busDx * busDx + busDy * busDy);
    const busUx   = busDx / busLen;  // unit vector X
    const busUy   = busDy / busLen;  // unit vector Y

    // --- Glider deploy height above drop target ---
    const deployAlt = dropTargetElev + P.GLIDE_DEPLOY_HEIGHT_M;

    // --- Time to glide from deploy height to drop target ---
    // Vertical: deployAlt → dropTargetElev, descending at GLIDE_VSPEED_MS
    const glideVertDist = deployAlt - dropTargetElev;  // = GLIDE_DEPLOY_HEIGHT_M
    const glideTime     = glideVertDist / P.GLIDE_VSPEED_MS;

    // --- Horizontal distance covered during glide ---
    const glideHorizDist = glideTime * P.GLIDE_HSPEED_MS;

    // --- Direction from bus route to drop point (perpendicular approach) ---
    // Project drop onto bus line to find closest bus point
    const toDrop_x = drop.wx - busS.wx;
    const toDrop_y = drop.wy - busS.wy;
    const proj     = toDrop_x * busUx + toDrop_y * busUy; // scalar projection
    const closest  = {
      wx: busS.wx + busUx * proj,
      wy: busS.wy + busUy * proj,
    };

    // Vector from closest bus point to drop
    const approachDx = drop.wx - closest.wx;
    const approachDy = drop.wy - closest.wy;
    const approachDist = Math.sqrt(approachDx * approachDx + approachDy * approachDy);
    const approachUx = approachDist > 0 ? approachDx / approachDist : 0;
    const approachUy = approachDist > 0 ? approachDy / approachDist : 0;

    // --- Freefall phase ---
    // After jumping from bus (altitude = BUS_ALTITUDE_M),
    // player freefalls until reaching deployAlt
    const freefallVertDist = P.BUS_ALTITUDE_M - deployAlt;
    const freefallTime     = freefallVertDist / P.FREEFALL_SPEED_MS;
    const freefallHorizDist = freefallTime * P.FREEFALL_HSPEED_MS;

    // --- Total horizontal distance from jump point to drop ---
    // Jump → freefall → glide deploy → glide → land
    // During freefall, player moves toward drop point
    // During glide, player also moves toward drop point
    const totalHorizDist = freefallHorizDist + glideHorizDist;

    // --- Jump point on bus route ---
    // Walk back along bus route from closest point by freefallHorizDist
    // (player jumps, falls forward toward drop)
    const jumpT  = proj - freefallHorizDist;
    const jumpWorld = {
      wx: busS.wx + busUx * jumpT,
      wy: busS.wy + busUy * jumpT,
    };

    // --- Glide deploy point ---
    // Where player is at moment glider deploys (between jump and drop)
    const deployWorld = {
      wx: drop.wx - approachUx * glideHorizDist,
      wy: drop.wy - approachUy * glideHorizDist,
    };

    // --- Check if jump point is on bus route ---
    const jumpOnRoute = jumpT >= 0 && jumpT <= busLen;

    // --- Glide direction angle (degrees, 0=north, clockwise) ---
    // Direction from deployWorld to dropWorld
    const glideDirRad = Math.atan2(drop.wx - deployWorld.wx, -(drop.wy - deployWorld.wy));
    const glideDirDeg = ((glideDirRad * 180 / Math.PI) + 360) % 360;

    // --- Obstacle check along glide path ---
    const obstacleCheck = this._checkGlidePath(deployWorld, drop, deployAlt, dropTargetElev);

    // --- Convert all world points back to Leaflet ---
    const jumpLeaflet   = CoordUtils.worldToLeaflet(jumpWorld.wx,   jumpWorld.wy);
    const deployLeaflet = CoordUtils.worldToLeaflet(deployWorld.wx, deployWorld.wy);
    const closestLeaflet = CoordUtils.worldToLeaflet(closest.wx,    closest.wy);

    // --- Freefall path (series of points for drawing arc) ---
    const freefallPath = this._buildFreefallPath(jumpWorld, deployWorld, P.BUS_ALTITUDE_M, deployAlt);

    // --- Glide path (series of points for drawing) ---
    const glidePath = this._buildGlidePath(deployWorld, drop, deployAlt, dropTargetElev);

    return {
      // Input echo
      input: {
        drop:     dropLeaflet,
        busStart: busStartLeaflet,
        busEnd:   busEndLeaflet,
        buildingHeightM,
      },

      // Key points (Leaflet coords)
      jumpPoint:    { lat: jumpLeaflet.lat,   lng: jumpLeaflet.lng   },
      deployPoint:  { lat: deployLeaflet.lat, lng: deployLeaflet.lng },
      dropPoint:    dropLeaflet,
      closestBusPoint: { lat: closestLeaflet.lat, lng: closestLeaflet.lng },

      // Altitudes
      altitudes: {
        bus:         P.BUS_ALTITUDE_M,
        deployHeight: deployAlt,
        dropTerrain:  dropTerrainElev,
        dropTarget:   dropTargetElev,
      },

      // Timing
      timing: {
        freefallSeconds: Math.round(freefallTime * 10) / 10,
        glideSeconds:    Math.round(glideTime    * 10) / 10,
        totalSeconds:    Math.round((freefallTime + glideTime) * 10) / 10,
      },

      // Distances
      distances: {
        freefallHorizM:   Math.round(freefallHorizDist),
        glideHorizM:      Math.round(glideHorizDist),
        totalHorizM:      Math.round(totalHorizDist),
        busToDropM:       Math.round(approachDist),
      },

      // Glide direction
      glideDirection: {
        degrees: Math.round(glideDirDeg),
        cardinal: this._degreesToCardinal(glideDirDeg),
      },

      // Status
      jumpOnRoute,
      hasObstacle: obstacleCheck.hasObstacle,
      obstacleInfo: obstacleCheck,

      // Paths for drawing
      paths: {
        freefall: freefallPath,   // [{lat,lng,altM}, ...]
        glide:    glidePath,      // [{lat,lng,altM}, ...]
      },
    };
  }

  /**
   * Build a series of points representing the freefall arc
   */
  _buildFreefallPath(jumpWorld, deployWorld, startAlt, endAlt) {
    const steps = 20;
    const path  = [];
    for (let i = 0; i <= steps; i++) {
      const t   = i / steps;
      const wx  = jumpWorld.wx  + (deployWorld.wx  - jumpWorld.wx)  * t;
      const wy  = jumpWorld.wy  + (deployWorld.wy  - jumpWorld.wy)  * t;
      const alt = startAlt + (endAlt - startAlt) * t;
      const ll  = CoordUtils.worldToLeaflet(wx, wy);
      path.push({ lat: ll.lat, lng: ll.lng, altM: Math.round(alt) });
    }
    return path;
  }

  /**
   * Build a series of points representing the glide path
   */
  _buildGlidePath(deployWorld, dropWorld, startAlt, endAlt) {
    const steps = 20;
    const path  = [];
    for (let i = 0; i <= steps; i++) {
      const t   = i / steps;
      const wx  = deployWorld.wx + (dropWorld.wx - deployWorld.wx) * t;
      const wy  = deployWorld.wy + (dropWorld.wy - deployWorld.wy) * t;
      const alt = startAlt + (endAlt - startAlt) * t;
      const ll  = CoordUtils.worldToLeaflet(wx, wy);
      path.push({ lat: ll.lat, lng: ll.lng, altM: Math.round(alt) });
    }
    return path;
  }

  /**
   * Check glide path for terrain obstacles
   * Samples terrain elevation along the glide path and checks clearance
   */
  _checkGlidePath(deployWorld, dropWorld, deployAlt, dropAlt) {
    const steps = 30;
    const { MIN_CLEARANCE_M } = CONSTANTS.OBSTACLE;
    let hasObstacle = false;
    let worstClearance = Infinity;
    let obstaclePoint = null;

    for (let i = 0; i <= steps; i++) {
      const t   = i / steps;
      const wx  = deployWorld.wx + (dropWorld.wx - deployWorld.wx) * t;
      const wy  = deployWorld.wy + (dropWorld.wy - deployWorld.wy) * t;
      const playerAlt = deployAlt + (dropAlt - deployAlt) * t;
      const terrainAlt = this.hmap.getElevationBilinear(wx, wy);
      const clearance  = playerAlt - terrainAlt;

      if (clearance < worstClearance) {
        worstClearance = clearance;
      }

      if (clearance < MIN_CLEARANCE_M) {
        hasObstacle = true;
        if (!obstaclePoint) {
          const ll = CoordUtils.worldToLeaflet(wx, wy);
          obstaclePoint = { lat: ll.lat, lng: ll.lng, clearanceM: Math.round(clearance) };
        }
      }
    }

    return {
      hasObstacle,
      worstClearanceM: Math.round(worstClearance),
      firstObstacle:   obstaclePoint,
    };
  }

  /**
   * Convert degrees to 8-point cardinal direction
   */
  _degreesToCardinal(deg) {
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round(deg / 45) % 8];
  }
}

// ============================================================
// MAIN ENGINE CLASS (export this to the website)
// ============================================================

class DropCalcEngine {
  constructor() {
    this.sampler    = new HeightmapSampler();
    this.calculator = null;
    this.ready      = false;
  }

  /**
   * Initialize — call this once on page load
   * @param {string} heightmapUrl - URL to heightmap.bin
   */
  async init(heightmapUrl) {
    await this.sampler.load(heightmapUrl);
    this.calculator = new DropCalculator(this.sampler);
    this.ready = true;
    console.log('DropCalcEngine ready');
  }

  /**
   * Calculate optimal drop path.
   *
   * @param {{lat, lng}} dropPoint       - landing destination
   * @param {{lat, lng}} busStart        - bus route start
   * @param {{lat, lng}} busEnd          - bus route end
   * @param {number}     buildingHeightM - height of building to land on (default 0)
   *
   * @returns {object} full result — see DropCalculator.calculate() for schema
   */
  calculate(dropPoint, busStart, busEnd, buildingHeightM = 0) {
    if (!this.ready) throw new Error('DropCalcEngine not initialized. Call await engine.init(url) first.');
    return this.calculator.calculate(dropPoint, busStart, busEnd, buildingHeightM);
  }

  /**
   * Get terrain elevation in meters at a Leaflet point.
   * Useful for the UI to show elevation on hover.
   */
  getElevation(lat, lng) {
    if (!this.ready) return 0;
    return Math.round(this.sampler.getElevationAtLeaflet(lat, lng));
  }

  /**
   * Expose constants so the UI can use them
   */
  getConstants() {
    return CONSTANTS;
  }

  /**
   * Expose coordinate utils so the UI can use them
   */
  getCoordUtils() {
    return CoordUtils;
  }
}

// ============================================================
// EXPORT
// ============================================================

// For use as ES module:
// export default DropCalcEngine;
// export { CoordUtils, CONSTANTS };

// For use as plain script tag (window global):
window.DropCalcEngine = DropCalcEngine;
window.DropCalcCoordUtils = CoordUtils;
window.DropCalcConstants = CONSTANTS;
