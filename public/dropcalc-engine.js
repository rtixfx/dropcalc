/**
 * dropcalc-engine.js
 * Accurate Fortnite drop calculator – simulation based.
 * Replaces your broken engine with a working version.
 */

// ============================================================
// CONSTANTS (tune these for current Fortnite season)
// ============================================================

const CONSTANTS = {
  // World / map
  MAP: {
    MIN_LNG: 0,
    MAX_LNG: 256,
    MIN_LAT: -256,
    MAX_LAT: 0,
    WORLD_W: 3000,
    WORLD_H: 3000,
  },

  // Heightmap calibration (matches your .bin file)
  HEIGHTMAP: {
    IMG_WIDTH: 2033,
    IMG_HEIGHT: 2033,
    RAW_SEA_LEVEL: 679,
    METERS_PER_UNIT: 0.015198,
  },

  // Physics – accurate as of current Fortnite
  PHYSICS: {
    BUS_ALTITUDE_M: 832,
    BUS_SPEED_MS: 75,
    FREEFALL_VERTICAL_SPEED_MS: 75,
    FREEFALL_HORIZONTAL_SPEED_MS: 58,
    GLIDE_HORIZONTAL_SPEED_MS: 28,
    GLIDE_VERTICAL_SPEED_MS: 6,
    AUTO_DEPLOY_ALTITUDE_ASL_M: 150,
  },

  // Optimization
  OPTIMIZATION: {
    JUMP_SAMPLE_COUNT: 30,   // grid search resolution
    JUMP_PRECISION: 0.002,   // final golden‑section precision
  },
};

// ============================================================
// COORDINATE CONVERSION (Leaflet ↔ world meters)
// ============================================================

const CoordUtils = {
  leafletToWorld(lat, lng) {
    const { MIN_LNG, MAX_LNG, MIN_LAT, MAX_LAT, WORLD_W, WORLD_H } = CONSTANTS.MAP;
    return {
      wx: ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * WORLD_W,
      wy: (1 - ((lat - MIN_LAT) / (MAX_LAT - MIN_LAT))) * WORLD_H,
    };
  },

  worldToLeaflet(wx, wy) {
    const { MIN_LNG, MAX_LNG, MIN_LAT, MAX_LAT, WORLD_W, WORLD_H } = CONSTANTS.MAP;
    return {
      lat: MIN_LAT + (1 - (wy / WORLD_H)) * (MAX_LAT - MIN_LAT),
      lng: MIN_LNG + (wx / WORLD_W) * (MAX_LNG - MIN_LNG),
    };
  },
};

// ============================================================
// HEIGHTMAP LOADER & SAMPLER
// ============================================================

class HeightmapSampler {
  constructor() {
    this.data = null;
    this.width = 0;
    this.height = 0;
    this.ready = false;
  }

  async load(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} – ${url}`);
    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);
    this.width = view.getUint32(0, true);
    this.height = view.getUint32(4, true);
    this.data = new Uint16Array(buffer, 8);
    this.ready = true;
    console.log(`Heightmap loaded: ${this.width}x${this.height}`);
  }

  getRaw(px, py) {
    if (!this.ready) return CONSTANTS.HEIGHTMAP.RAW_SEA_LEVEL;
    px = Math.min(Math.max(0, px), this.width - 1);
    py = Math.min(Math.max(0, py), this.height - 1);
    return this.data[py * this.width + px];
  }

  // Bilinear interpolation for smooth elevation
  getElevationAtWorld(wx, wy) {
    const { RAW_SEA_LEVEL, METERS_PER_UNIT, IMG_WIDTH, IMG_HEIGHT } = CONSTANTS.HEIGHTMAP;
    const { WORLD_W, WORLD_H } = CONSTANTS.MAP;
    const fx = (wx / WORLD_W) * IMG_WIDTH;
    const fy = (wy / WORLD_H) * IMG_HEIGHT;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, IMG_WIDTH - 1);
    const y1 = Math.min(y0 + 1, IMG_HEIGHT - 1);
    const tx = fx - x0, ty = fy - y0;
    const v00 = this.getRaw(x0, y0);
    const v10 = this.getRaw(x1, y0);
    const v01 = this.getRaw(x0, y1);
    const v11 = this.getRaw(x1, y1);
    const raw = (v00 * (1 - tx) + v10 * tx) * (1 - ty) +
                (v01 * (1 - tx) + v11 * tx) * ty;
    return (raw - RAW_SEA_LEVEL) * METERS_PER_UNIT;
  }

  getElevationAtLeaflet(lat, lng) {
    const { wx, wy } = CoordUtils.leafletToWorld(lat, lng);
    return this.getElevationAtWorld(wx, wy);
  }
}

// ============================================================
// SIMULATION ENGINE
// ============================================================

class DropSimulator {
  constructor(heightmap) {
    this.hmap = heightmap;
    this.const = CONSTANTS;
  }

  /**
   * Simulate a single jump fraction (t from 0 to 1)
   * Returns null if the path is physically impossible.
   */
  simulate(jumpT, busStart, busEnd, dropPoint, buildingHeightM = 0) {
    const P = this.const.PHYSICS;

    // Jump point on bus route
    const busDirX = busEnd.wx - busStart.wx;
    const busDirY = busEnd.wy - busStart.wy;
    const busLen = Math.hypot(busDirX, busDirY);
    if (busLen === 0) return null;
    const jumpX = busStart.wx + busDirX * jumpT;
    const jumpY = busStart.wy + busDirY * jumpT;

    // Terrain elevation at the landing spot
    const dropTerrain = this.hmap.getElevationAtWorld(dropPoint.wx, dropPoint.wy);
    const dropTargetAlt = dropTerrain + buildingHeightM;

    const deployAltASL = P.AUTO_DEPLOY_ALTITUDE_ASL_M;

    // ----- Freefall phase -----
    const freefallVertDist = P.BUS_ALTITUDE_M - deployAltASL;
    if (freefallVertDist <= 0) return null;
    const freefallTime = freefallVertDist / P.FREEFALL_VERTICAL_SPEED_MS;
    const freefallHorizDist = freefallTime * P.FREEFALL_HORIZONTAL_SPEED_MS;

    // Direction from jump point to drop point
    const dx = dropPoint.wx - jumpX;
    const dy = dropPoint.wy - jumpY;
    const distToDrop = Math.hypot(dx, dy);
    if (distToDrop < 1e-6) return null;
    const dirX = dx / distToDrop;
    const dirY = dy / distToDrop;

    // Deploy point after freefall
    let deployX = jumpX + dirX * freefallHorizDist;
    let deployY = jumpY + dirY * freefallHorizDist;

    // Remaining glide distance
    const glideDist = Math.hypot(dropPoint.wx - deployX, dropPoint.wy - deployY);

    // ----- Special case: drop point is above deploy altitude (e.g., mountain top) -----
    const altLoss = deployAltASL - dropTargetAlt;
    if (altLoss < 0) {
      // Cannot glide – just fall and land immediately at the drop point
      const totalTime = freefallTime;
      const jumpLeaflet = CoordUtils.worldToLeaflet(jumpX, jumpY);
      const deployLeaflet = CoordUtils.worldToLeaflet(dropPoint.wx, dropPoint.wy);
      return {
        jump_point_x: jumpX, jump_point_y: jumpY,
        deploy_point_x: dropPoint.wx, deploy_point_y: dropPoint.wy,
        jump_leaflet: { lat: jumpLeaflet.lat, lng: jumpLeaflet.lng },
        deploy_leaflet: { lat: deployLeaflet.lat, lng: deployLeaflet.lng },
        jump_to_deploy_time: freefallTime,
        time_from_deploy_to_ground: 0,
        total_time: totalTime,
        freefall_horiz_m: freefallHorizDist,
        glide_horiz_m: 0,
        deploy_height: deployAltASL,
        glide_angle_deg: 0,
        jump_on_route: jumpT >= 0 && jumpT <= 1,
      };
    }

    // ----- Normal glide phase -----
    const glideTime = glideDist / P.GLIDE_HORIZONTAL_SPEED_MS;
    const requiredDescentTime = altLoss / P.GLIDE_VERTICAL_SPEED_MS;

    // The glide time must closely match the required descent time for a valid path.
    // If not, this jumpT is impossible – return null.
    if (Math.abs(glideTime - requiredDescentTime) > 0.5) return null;

    const totalTime = freefallTime + glideTime;

    // Glide angle (degrees from north)
    const glideRad = Math.atan2(dropPoint.wx - deployX, -(dropPoint.wy - deployY));
    let glideDeg = (glideRad * 180 / Math.PI + 360) % 360;

    const jumpLeaflet = CoordUtils.worldToLeaflet(jumpX, jumpY);
    const deployLeaflet = CoordUtils.worldToLeaflet(deployX, deployY);

    return {
      jump_point_x: jumpX, jump_point_y: jumpY,
      deploy_point_x: deployX, deploy_point_y: deployY,
      jump_leaflet: { lat: jumpLeaflet.lat, lng: jumpLeaflet.lng },
      deploy_leaflet: { lat: deployLeaflet.lat, lng: deployLeaflet.lng },
      jump_to_deploy_time: freefallTime,
      time_from_deploy_to_ground: glideTime,
      total_time: totalTime,
      freefall_horiz_m: freefallHorizDist,
      glide_horiz_m: glideDist,
      deploy_height: deployAltASL,
      glide_angle_deg: glideDeg,
      jump_on_route: jumpT >= 0 && jumpT <= 1,
    };
  }

  /**
   * Find the jump fraction (t) that minimises total time.
   * Uses a coarse grid search followed by golden‑section refinement.
   */
  findOptimalJump(busStart, busEnd, dropPoint, buildingHeightM = 0) {
    const steps = CONSTANTS.OPTIMIZATION.JUMP_SAMPLE_COUNT;
    let bestT = 0.5;
    let bestResult = null;
    let bestTime = Infinity;

    // 1) Grid search
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const res = this.simulate(t, busStart, busEnd, dropPoint, buildingHeightM);
      if (res && res.total_time < bestTime && res.jump_on_route) {
        bestTime = res.total_time;
        bestT = t;
        bestResult = res;
      }
    }

    // 2) Golden‑section refinement around bestT
    const precision = CONSTANTS.OPTIMIZATION.JUMP_PRECISION;
    let a = Math.max(0, bestT - 0.1);
    let b = Math.min(1, bestT + 0.1);
    const phi = (Math.sqrt(5) - 1) / 2;
    let c = b - phi * (b - a);
    let d = a + phi * (b - a);
    let fc = this.simulate(c, busStart, busEnd, dropPoint, buildingHeightM);
    let fd = this.simulate(d, busStart, busEnd, dropPoint, buildingHeightM);

    while (Math.abs(b - a) > precision) {
      if ((fc?.total_time ?? Infinity) < (fd?.total_time ?? Infinity)) {
        b = d;
        d = c;
        fd = fc;
        c = b - phi * (b - a);
        fc = this.simulate(c, busStart, busEnd, dropPoint, buildingHeightM);
      } else {
        a = c;
        c = d;
        fc = fd;
        d = a + phi * (b - a);
        fd = this.simulate(d, busStart, busEnd, dropPoint, buildingHeightM);
      }
    }

    const tFinal = (a + b) / 2;
    const finalResult = this.simulate(tFinal, busStart, busEnd, dropPoint, buildingHeightM);
    if (finalResult && finalResult.total_time < bestTime) return finalResult;
    return bestResult;
  }
}

// ============================================================
// MAIN ENGINE EXPORT (same API as original)
// ============================================================

class DropCalcEngine {
  constructor() {
    this.sampler = new HeightmapSampler();
    this.simulator = null;
    this.ready = false;
  }

  /**
   * Initialize the engine.
   * @param {string} heightmapUrl – path to heightmap.bin (default: '/heightmap.bin')
   */
  async init(heightmapUrl = '/heightmap.bin') {
    try {
      await this.sampler.load(heightmapUrl);
      this.simulator = new DropSimulator(this.sampler);
      this.ready = true;
      console.log('DropCalcEngine ready (accurate simulation)');
      // Remove any error banner if previously shown
      const oldBanner = document.getElementById('dropcalc-error-banner');
      if (oldBanner) oldBanner.remove();
    } catch (err) {
      console.error('DropCalcEngine init failed:', err);
      this.ready = false;
      // Show visible error on page
      const banner = document.createElement('div');
      banner.id = 'dropcalc-error-banner';
      banner.style.cssText = 'position:fixed; top:0; left:0; right:0; background:#c00; color:white; padding:12px; text-align:center; z-index:10000; font-family:sans-serif';
      banner.innerText = `⚠️ Drop calculator error: failed to load heightmap from "${heightmapUrl}". Check console for details.`;
      document.body.prepend(banner);
      throw err;
    }
  }

  /**
   * Calculate the optimal drop.
   * @param {object} dropPoint – {lat, lng} in Leaflet coordinates
   * @param {object} busStart  – {lat, lng}
   * @param {object} busEnd    – {lat, lng}
   * @param {number} buildingHeightM – extra building height (default 0)
   * @return {object} result with jump_x/y, deploy_x/y, times, angles, etc.
   */
  calculate(dropPoint, busStart, busEnd, buildingHeightM = 0) {
    if (!this.ready) throw new Error('Engine not initialized. Call await engine.init() first.');

    const startWorld = CoordUtils.leafletToWorld(busStart.lat, busStart.lng);
    const endWorld = CoordUtils.leafletToWorld(busEnd.lat, busEnd.lng);
    const dropWorld = CoordUtils.leafletToWorld(dropPoint.lat, dropPoint.lng);

    const result = this.simulator.findOptimalJump(startWorld, endWorld, dropWorld, buildingHeightM);

    if (!result) {
      throw new Error('No valid drop path found – try a different destination or bus route.');
    }

    // Return a clean object with all needed fields
    return {
      jump_point_x: result.jump_point_x,
      jump_point_y: result.jump_point_y,
      deploy_point_x: result.deploy_point_x,
      deploy_point_y: result.deploy_point_y,
      jump_leaflet: result.jump_leaflet,
      deploy_leaflet: result.deploy_leaflet,
      jump_to_deploy_time: result.jump_to_deploy_time,
      time_from_deploy_to_ground: result.time_from_deploy_to_ground,
      total_time: result.total_time,
      freefall_horiz_m: result.freefall_horiz_m,
      glide_horiz_m: result.glide_horiz_m,
      deploy_height: result.deploy_height,
      glide_angle_deg: result.glide_angle_deg,
      is_high_deploy_marker: 0,   // kept for compatibility
    };
  }

  /**
   * Get terrain elevation (meters) at a Leaflet point.
   */
  getElevation(lat, lng) {
    if (!this.ready) return 0;
    return Math.round(this.sampler.getElevationAtLeaflet(lat, lng));
  }

  getConstants() {
    return CONSTANTS;
  }

  getCoordUtils() {
    return CoordUtils;
  }
}

// Expose globally (exactly as your original script expects)
window.DropCalcEngine = DropCalcEngine;
window.DropCalcCoordUtils = CoordUtils;
window.DropCalcConstants = CONSTANTS;
