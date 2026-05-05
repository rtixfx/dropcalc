/**
 * Accurate Fortnite Drop Calculator
 * ================================
 * Uses simulation + optimization to find the optimal jump point.
 * Works with your existing heightmap.bin and coordinate system.
 */

// ============================================================
// CONSTANTS (calibrated for current Fortnite)
// ============================================================

const FORTNITE_CONSTANTS = {
  // World size (meters)
  WORLD_W: 3000,
  WORLD_H: 3000,

  // Bus
  BUS_SPEED_MS: 75,
  BUS_ALTITUDE_M: 832, // above sea level

  // Freefall (skydiving)
  FREEFALL_VERTICAL_SPEED_MS: 75,    // terminal velocity while diving
  FREEFALL_HORIZONTAL_SPEED_MS: 58,  // max horizontal speed when steering

  // Gliding
  GLIDE_HORIZONTAL_SPEED_MS: 28,
  GLIDE_VERTICAL_SPEED_MS: 6,        // descent rate

  // Auto-deploy altitude (above sea level, not terrain)
  // Current season: ~150m ASL (which is ~100m above flat ground)
  AUTO_DEPLOY_ALTITUDE_ASL_M: 150,

  // Heightmap calibration (adjust to match your .bin file)
  HEIGHTMAP: {
    RAW_SEA_LEVEL: 679,
    METERS_PER_UNIT: 0.015198,
    IMG_WIDTH: 2033,
    IMG_HEIGHT: 2033,
  },

  // Optimization
  OPTIMIZATION: {
    JUMP_SAMPLE_COUNT: 30,      // initial grid search samples
    JUMP_PRECISION: 0.002,      // final golden-section precision (as fraction of bus route)
  },
};

// ============================================================
// COORDINATE UTILITIES (matches your existing system)
// ============================================================

const CoordUtils = {
  leafletToWorld(lat, lng) {
    const { WORLD_W, WORLD_H } = FORTNITE_CONSTANTS;
    const MIN_LNG = 0, MAX_LNG = 256;
    const MIN_LAT = -256, MAX_LAT = 0;
    return {
      x: ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * WORLD_W,
      y: (1 - ((lat - MIN_LAT) / (MAX_LAT - MIN_LAT))) * WORLD_H,
    };
  },

  worldToLeaflet(x, y) {
    const { WORLD_W, WORLD_H } = FORTNITE_CONSTANTS;
    const MIN_LNG = 0, MAX_LNG = 256;
    const MIN_LAT = -256, MAX_LAT = 0;
    return {
      lat: MIN_LAT + (1 - (y / WORLD_H)) * (MAX_LAT - MIN_LAT),
      lng: MIN_LNG + (x / WORLD_W) * (MAX_LNG - MIN_LNG),
    };
  },

  distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  },
};

// ============================================================
// HEIGHTMAP SAMPLER (using your binary data)
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
    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);
    this.width = view.getUint32(0, true);
    this.height = view.getUint32(4, true);
    this.data = new Uint16Array(buffer, 8);
    this.ready = true;
    console.log(`Heightmap loaded: ${this.width}x${this.height}`);
  }

  getRaw(px, py) {
    if (!this.ready) return FORTNITE_CONSTANTS.HEIGHTMAP.RAW_SEA_LEVEL;
    px = Math.min(Math.max(0, px), this.width - 1);
    py = Math.min(Math.max(0, py), this.height - 1);
    return this.data[py * this.width + px];
  }

  // Bilinear interpolation for smooth elevation
  getElevationAtWorld(x, y) {
    const { RAW_SEA_LEVEL, METERS_PER_UNIT, IMG_WIDTH, IMG_HEIGHT } = FORTNITE_CONSTANTS.HEIGHTMAP;
    const fx = (x / FORTNITE_CONSTANTS.WORLD_W) * IMG_WIDTH;
    const fy = (y / FORTNITE_CONSTANTS.WORLD_H) * IMG_HEIGHT;
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
}

// ============================================================
// SIMULATION ENGINE
// ============================================================

class DropSimulator {
  constructor(heightmap) {
    this.hmap = heightmap;
    this.const = FORTNITE_CONSTANTS;
  }

  /**
   * Simulate a drop given:
   * @param {number} jumpT - fraction along bus route (0 = start, 1 = end)
   * @param {object} busStart - {x, y} in world meters
   * @param {object} busEnd - {x, y} in world meters
   * @param {object} dropPoint - {x, y} in world meters
   * @param {number} targetHeightM - additional height of building (default 0)
   * @returns {object} simulation result or null if invalid
   */
  simulate(jumpT, busStart, busEnd, dropPoint, targetHeightM = 0) {
    // Calculate jump point on bus route
    const busDirX = busEnd.x - busStart.x;
    const busDirY = busEnd.y - busStart.y;
    const busLen = Math.hypot(busDirX, busDirY);
    const jumpX = busStart.x + busDirX * jumpT;
    const jumpY = busStart.y + busDirY * jumpT;

    // Terrain elevation at drop point
    const dropTerrain = this.hmap.getElevationAtWorld(dropPoint.x, dropPoint.y);
    const dropTargetAlt = dropTerrain + targetHeightM;

    // Auto-deploy altitude (above sea level)
    const deployAltASL = this.const.AUTO_DEPLOY_ALTITUDE_ASL_M;

    // Freefall phase: from bus altitude down to deploy altitude
    const freefallVertDist = this.const.BUS_ALTITUDE_M - deployAltASL;
    if (freefallVertDist <= 0) return null; // invalid
    const freefallTime = freefallVertDist / this.const.FREEFALL_VERTICAL_SPEED_MS;

    // During freefall, player moves horizontally toward the drop point
    const freefallHorizDist = freefallTime * this.const.FREEFALL_HORIZONTAL_SPEED_MS;

    // Direction from jump point to drop point
    const dx = dropPoint.x - jumpX;
    const dy = dropPoint.y - jumpY;
    const distToDrop = Math.hypot(dx, dy);
    if (distToDrop <= 0) return null;

    const dirX = dx / distToDrop;
    const dirY = dy / distToDrop;

    // Deploy point after freefall
    let deployX = jumpX + dirX * freefallHorizDist;
    let deployY = jumpY + dirY * freefallHorizDist;

    // Glide phase: from deploy point to drop point
    const remainingDist = Math.hypot(dropPoint.x - deployX, dropPoint.y - deployY);
    if (remainingDist < 0) return null;

    // Time to glide remaining horizontal distance (glide speed is constant)
    const glideTime = remainingDist / this.const.GLIDE_HORIZONTAL_SPEED_MS;

    // Check vertical feasibility: glide descent must exactly match remaining altitude loss
    const startAlt = deployAltASL;
    const endAlt = dropTargetAlt;
    const altLoss = startAlt - endAlt;
    const requiredDescentTime = altLoss / this.const.GLIDE_VERTICAL_SPEED_MS;

    // If glide time < required descent time, player would overshoot vertically (too high)
    // If glide time > required descent time, player would hit ground before reaching drop (too low)
    // We require them to match (within tolerance) for a valid trajectory.
    // In practice, we can adjust deploy point slightly, but for simplicity we check.
    if (Math.abs(glideTime - requiredDescentTime) > 0.5) {
      // Not a perfect match; we could adjust deployment altitude or reject.
      // For now, reject this jumpT (will be caught by optimizer)
      return null;
    }

    // Total time
    const totalTime = freefallTime + glideTime;

    // Determine if jump point is valid (within bus route)
    const jumpOnRoute = jumpT >= 0 && jumpT <= 1;

    // Glide direction angle (degrees from north)
    const glideAngleRad = Math.atan2(dropPoint.x - deployX, -(dropPoint.y - deployY));
    let glideDeg = (glideAngleRad * 180 / Math.PI + 360) % 360;

    return {
      jumpT,
      jumpPoint: { x: jumpX, y: jumpY, leaflet: CoordUtils.worldToLeaflet(jumpX, jumpY) },
      deployPoint: { x: deployX, y: deployY, leaflet: CoordUtils.worldToLeaflet(deployX, deployY) },
      dropPoint: { x: dropPoint.x, y: dropPoint.y, leaflet: CoordUtils.worldToLeaflet(dropPoint.x, dropPoint.y) },
      freefallTime,
      glideTime,
      totalTime,
      freefallHorizDist,
      glideHorizDist: remainingDist,
      totalHorizDist: freefallHorizDist + remainingDist,
      glideAngleDeg: glideDeg,
      jumpOnRoute,
      altitudes: {
        bus: this.const.BUS_ALTITUDE_M,
        deploy: deployAltASL,
        dropTerrain,
        dropTarget: dropTargetAlt,
      },
    };
  }

  /**
   * Find optimal jump fraction (t) that minimizes total time.
   * Uses grid search + golden-section.
   */
  findOptimalJump(busStart, busEnd, dropPoint, targetHeightM = 0) {
    const steps = this.const.OPTIMIZATION.JUMP_SAMPLE_COUNT;
    let bestT = 0.5;
    let bestTime = Infinity;

    // Grid search
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const result = this.simulate(t, busStart, busEnd, dropPoint, targetHeightM);
      if (result && result.totalTime < bestTime && result.jumpOnRoute) {
        bestTime = result.totalTime;
        bestT = t;
      }
    }

    // Refine with golden-section search around bestT
    const precision = this.const.OPTIMIZATION.JUMP_PRECISION;
    let a = Math.max(0, bestT - 0.1);
    let b = Math.min(1, bestT + 0.1);
    const phi = (Math.sqrt(5) - 1) / 2; // golden ratio

    let c = b - phi * (b - a);
    let d = a + phi * (b - a);
    let fc = this.simulate(c, busStart, busEnd, dropPoint, targetHeightM);
    let fd = this.simulate(d, busStart, busEnd, dropPoint, targetHeightM);

    while (Math.abs(b - a) > precision) {
      if ((fc?.totalTime ?? Infinity) < (fd?.totalTime ?? Infinity)) {
        b = d;
        d = c;
        fd = fc;
        c = b - phi * (b - a);
        fc = this.simulate(c, busStart, busEnd, dropPoint, targetHeightM);
      } else {
        a = c;
        c = d;
        fc = fd;
        d = a + phi * (b - a);
        fd = this.simulate(d, busStart, busEnd, dropPoint, targetHeightM);
      }
    }
    bestT = (a + b) / 2;
    const finalResult = this.simulate(bestT, busStart, busEnd, dropPoint, targetHeightM);
    if (finalResult && finalResult.totalTime < bestTime) return finalResult;
    // Fallback to best from grid
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = this.simulate(t, busStart, busEnd, dropPoint, targetHeightM);
      if (r && r.totalTime < bestTime && r.jumpOnRoute) {
        bestTime = r.totalTime;
        bestT = t;
      }
    }
    return this.simulate(bestT, busStart, busEnd, dropPoint, targetHeightM);
  }
}

// ============================================================
// MAIN ENGINE EXPORT (compatible with your existing interface)
// ============================================================

class AccurateDropCalcEngine {
  constructor() {
    this.sampler = new HeightmapSampler();
    this.simulator = null;
    this.ready = false;
  }

  async init(heightmapUrl) {
    await this.sampler.load(heightmapUrl);
    this.simulator = new DropSimulator(this.sampler);
    this.ready = true;
    console.log("AccurateDropCalcEngine ready");
  }

  /**
   * Calculate optimal drop.
   * @param {object} dropPoint - {lat, lng} in Leaflet coords
   * @param {object} busStart - {lat, lng}
   * @param {object} busEnd - {lat, lng}
   * @param {number} buildingHeightM - optional building height
   * @returns {object} detailed result with jump/deploy points (Leaflet and world), times, angles
   */
  calculate(dropPoint, busStart, busEnd, buildingHeightM = 0) {
    if (!this.ready) throw new Error("Engine not initialized");

    const dropWorld = CoordUtils.leafletToWorld(dropPoint.lat, dropPoint.lng);
    const startWorld = CoordUtils.leafletToWorld(busStart.lat, busStart.lng);
    const endWorld = CoordUtils.leafletToWorld(busEnd.lat, busEnd.lng);

    const result = this.simulator.findOptimalJump(startWorld, endWorld, dropWorld, buildingHeightM);
    if (!result) throw new Error("No valid drop path found");

    // Add input echo
    result.input = { dropPoint, busStart, busEnd, buildingHeightM };
    return result;
  }

  getElevation(lat, lng) {
    if (!this.ready) return 0;
    const world = CoordUtils.leafletToWorld(lat, lng);
    return Math.round(this.sampler.getElevationAtWorld(world.x, world.y));
  }

  getConstants() {
    return FORTNITE_CONSTANTS;
  }

  getCoordUtils() {
    return CoordUtils;
  }
}

// Expose globally
window.AccurateDropCalcEngine = AccurateDropCalcEngine;
