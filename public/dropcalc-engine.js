/**
 * Fortnite Drop Calculator Engine v4
 * ====================================
 * window.DropCalcEngine
 *
 * USAGE:
 *   const engine = new DropCalcEngine();
 *   await engine.init('heightmap.bin');
 *   const result = engine.calculate(dropPoint, busStart, busEnd, buildingHeightM);
 *
 * All points: Leaflet { lat: -256..0, lng: 0..256 }
 */

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const C = {
  // Leaflet coordinate bounds
  MAP: {
    MIN_LNG:  0,   MAX_LNG: 256,
    MIN_LAT: -256, MAX_LAT:  0,
    WORLD_W:  8192,          // world units across
    WORLD_H:  8192,          // world units tall
    M_PER_WU: 0.671,         // meters per world unit (5500m / 8192wu)
    WU_PER_M: 1.4888,        // world units per meter (8192wu / 5500m)
  },

  // Heightmap binary file info
  HM: {
    W: 2033, H: 2033,
    RAW_SEA_LEVEL:   679,
    METERS_PER_UNIT: 0.015198,
  },

  // Physics — all speeds in m/s, all altitudes in meters
  PHY: {
    BUS_ALT:       832,   // bus altitude above sea level
    FF_VERT:        75,   // freefall vertical speed
    FF_HORIZ:       25,   // freefall horizontal speed toward target
    GL_VERT:         6,   // glide descent speed
    GL_HORIZ:       28,   // glide horizontal speed
    DEPLOY_HEIGHT: 100,   // glider deploys this many meters above terrain below player
  },
};

// ─────────────────────────────────────────────
// COORDINATE UTILITIES
// ─────────────────────────────────────────────
const Coords = {
  // Leaflet lat/lng → world units
  toWorld(lat, lng) {
    const { MIN_LNG, MAX_LNG, MIN_LAT, MAX_LAT, WORLD_W, WORLD_H } = C.MAP;
    return {
      x: ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * WORLD_W,
      y: (1 - (lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * WORLD_H,
    };
  },

  // World units → Leaflet lat/lng
  toLeaflet(x, y) {
    const { MIN_LNG, MAX_LNG, MIN_LAT, MAX_LAT, WORLD_W, WORLD_H } = C.MAP;
    return {
      lat: MIN_LAT + (1 - y / WORLD_H) * (MAX_LAT - MIN_LAT),
      lng: MIN_LNG + (x / WORLD_W) * (MAX_LNG - MIN_LNG),
    };
  },

  // Distance in world units (use for coordinate math)
  distWU(ax, ay, bx, by) {
    return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
  },

  // Distance in meters (use for physics)
  distM(ax, ay, bx, by) {
    return Coords.distWU(ax, ay, bx, by) * C.MAP.M_PER_WU;
  },

  // Convert meters to world units
  mToWU(meters) {
    return meters * C.MAP.WU_PER_M;
  },

  // Convert world units to meters
  wuToM(wu) {
    return wu * C.MAP.M_PER_WU;
  },
};

// ─────────────────────────────────────────────
// HEIGHTMAP
// ─────────────────────────────────────────────
class Heightmap {
  constructor() { this.data = null; this.ready = false; }

  async load(url) {
    const buf  = await (await fetch(url)).arrayBuffer();
    const view = new DataView(buf);
    this.w    = view.getUint32(0, true);
    this.h    = view.getUint32(4, true);
    this.data = new Uint16Array(buf, 8);
    this.ready = true;
    console.log(`Heightmap loaded: ${this.w}x${this.h}`);
  }

  raw(px, py) {
    px = Math.max(0, Math.min(this.w - 1, Math.floor(px)));
    py = Math.max(0, Math.min(this.h - 1, Math.floor(py)));
    return this.data[py * this.w + px];
  }

  // Bilinear elevation in meters at world unit coords
  elev(wx, wy) {
    if (!this.ready) return 0;
    const { W, H, RAW_SEA_LEVEL, METERS_PER_UNIT } = C.HM;
    const { WORLD_W, WORLD_H } = C.MAP;
    const fx = (wx / WORLD_W) * W;
    const fy = (wy / WORLD_H) * H;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, W - 1), y1 = Math.min(y0 + 1, H - 1);
    const tx = fx - x0, ty = fy - y0;
    const v = (1-tx)*(1-ty)*this.raw(x0,y0)
            +    tx*(1-ty)*this.raw(x1,y0)
            + (1-tx)*   ty*this.raw(x0,y1)
            +    tx*    ty*this.raw(x1,y1);
    return (v - RAW_SEA_LEVEL) * METERS_PER_UNIT;
  }

  elevLL(lat, lng) {
    const w = Coords.toWorld(lat, lng);
    return this.elev(w.x, w.y);
  }
}

// ─────────────────────────────────────────────
// CIRCLE ∩ LINE SEGMENT
// All inputs in world units. Returns t values [0..1].
// ─────────────────────────────────────────────
function circleSegmentTs(cx, cy, r, x1, y1, x2, y2) {
  const dx = x2-x1, dy = y2-y1;
  const fx = x1-cx, fy = y1-cy;
  const a  = dx*dx + dy*dy;
  if (a === 0) return [];
  const b  = 2*(fx*dx + fy*dy);
  const cc = fx*fx + fy*fy - r*r;
  let disc = b*b - 4*a*cc;
  if (disc < 0) return [];
  disc = Math.sqrt(disc);
  return [(-b-disc)/(2*a), (-b+disc)/(2*a)]
    .filter(t => t >= -0.0001 && t <= 1.0001)
    .map(t => Math.max(0, Math.min(1, t)));
}

// ─────────────────────────────────────────────
// FIND GLIDER DEPLOY POINT
// Binary search along freefall path for where
// player altitude = terrain altitude + DEPLOY_HEIGHT
// All positions in world units, altitudes in meters.
// ─────────────────────────────────────────────
function findDeployPoint(hmap, jumpWorld, dropWorld, busAlt) {
  const P  = C.PHY;

  // Direction in world units from jump to drop
  const jumpToDropWU = Coords.distWU(jumpWorld.x, jumpWorld.y, dropWorld.x, dropWorld.y);
  const ux = jumpToDropWU > 0 ? (dropWorld.x - jumpWorld.x) / jumpToDropWU : 0;
  const uy = jumpToDropWU > 0 ? (dropWorld.y - jumpWorld.y) / jumpToDropWU : 0;

  // FF_HORIZ is m/s → convert to world units per second
  const ffHorizWU = P.FF_HORIZ * C.MAP.WU_PER_M;

  // Max freefall time
  const maxTime = busAlt / P.FF_VERT;

  // Binary search
  let lo = 0, hi = maxTime;
  for (let iter = 0; iter < 64; iter++) {
    const mid        = (lo + hi) / 2;
    const x          = jumpWorld.x + ux * ffHorizWU * mid;
    const y          = jumpWorld.y + uy * ffHorizWU * mid;
    const playerAlt  = busAlt - P.FF_VERT * mid;
    const terrainAlt = hmap.elev(x, y);
    const clearance  = playerAlt - terrainAlt;
    if (Math.abs(clearance - P.DEPLOY_HEIGHT) < 0.01) break;
    if (clearance > P.DEPLOY_HEIGHT) lo = mid;
    else                              hi = mid;
  }

  const ffTime    = (lo + hi) / 2;
  const ffHorizM  = P.FF_HORIZ * ffTime;           // meters traveled horizontally
  const ffHorizWu = ffHorizM * C.MAP.WU_PER_M;     // same in world units
  const deployX   = jumpWorld.x + ux * ffHorizWu;
  const deployY   = jumpWorld.y + uy * ffHorizWu;
  const deployAlt = busAlt - P.FF_VERT * ffTime;

  return {
    world:       { x: deployX, y: deployY },
    alt:         deployAlt,
    ffTime,
    ffHorizM,
  };
}

// ─────────────────────────────────────────────
// MAIN CALCULATION
// ─────────────────────────────────────────────
function calculate(hmap, dropLL, busStartLL, busEndLL, buildingHeightM = 0) {
  const P = C.PHY;

  // World unit positions
  const drop = Coords.toWorld(dropLL.lat, dropLL.lng);
  const busA = Coords.toWorld(busStartLL.lat, busStartLL.lng);
  const busB = Coords.toWorld(busEndLL.lat,   busEndLL.lng);

  // Bus geometry in world units
  const busLenWU = Coords.distWU(busA.x, busA.y, busB.x, busB.y);
  const busUx    = busLenWU > 0 ? (busB.x - busA.x) / busLenWU : 1;
  const busUy    = busLenWU > 0 ? (busB.y - busA.y) / busLenWU : 0;

  // Target elevation in meters
  const terrainElev = hmap.elev(drop.x, drop.y);
  const targetElev  = terrainElev + buildingHeightM;

  // t of closest point on bus to drop (in world units)
  const tClosest = Math.max(0, Math.min(1,
    ((drop.x - busA.x) * busUx + (drop.y - busA.y) * busUy) / busLenWU
  ));

  // ── Iterative solve ──────────────────────────────────────────────────────
  // Initial estimate using terrain at target
  let deployAlt   = targetElev + P.DEPLOY_HEIGHT;
  let glHorizM    = (P.DEPLOY_HEIGHT / P.GL_VERT) * P.GL_HORIZ;
  let ffVertDist  = Math.max(0, P.BUS_ALT - deployAlt);
  let ffHorizM    = (ffVertDist / P.FF_VERT) * P.FF_HORIZ;
  let totalM      = ffHorizM + glHorizM;
  let totalWU     = Coords.mToWU(totalM);   // convert to world units for circle intersection
  let jumpWorld   = null;
  let deployResult = null;

  for (let iter = 0; iter < 8; iter++) {
    // Jump point = circle(center=drop, r=totalWU) ∩ bus segment
    const ts = circleSegmentTs(
      drop.x, drop.y, totalWU,
      busA.x, busA.y, busB.x, busB.y
    );

    let jumpT;
    if (ts.length > 0) {
      const before = ts.filter(t => t <= tClosest);
      const after  = ts.filter(t => t >  tClosest);
      jumpT = before.length > 0 ? Math.max(...before) : Math.min(...after);
    } else {
      jumpT = tClosest;
    }

    jumpWorld = {
      x: busA.x + busUx * busLenWU * jumpT,
      y: busA.y + busUy * busLenWU * jumpT,
    };

    // Find real deploy point along freefall path
    deployResult = findDeployPoint(hmap, jumpWorld, drop, P.BUS_ALT);

    // Update for next iteration
    deployAlt  = deployResult.alt;
    ffHorizM   = deployResult.ffHorizM;

    const glVertM  = Math.max(0, deployAlt - targetElev);
    const glTime   = glVertM / P.GL_VERT;
    glHorizM       = glTime * P.GL_HORIZ;
    totalM         = ffHorizM + glHorizM;
    totalWU        = Coords.mToWU(totalM);
  }

  // ── Final values ─────────────────────────────────────────────────────────
  const deployWorld = deployResult.world;
  const glVertM     = Math.max(0, deployAlt - targetElev);
  const glTime      = glVertM / P.GL_VERT;
  const glHorizMFin = glTime * P.GL_HORIZ;

  // Glide direction (compass bearing, 0=N, 90=E)
  const gdx      = drop.x - deployWorld.x;
  const gdy      = drop.y - deployWorld.y;
  const glideRad = Math.atan2(gdx, -gdy);
  const glideDeg = ((glideRad * 180 / Math.PI) + 360) % 360;

  // Obstacle check
  const obstacles = checkPath(hmap, deployWorld, drop, deployAlt, targetElev);

  // Drawing paths
  const freefallPath = buildPath(jumpWorld,   deployWorld, P.BUS_ALT, deployAlt,   20);
  const glidePath    = buildPath(deployWorld, drop,        deployAlt, targetElev,  20);

  // Leaflet coords for key points
  const jumpLL   = Coords.toLeaflet(jumpWorld.x,   jumpWorld.y);
  const deployLL = Coords.toLeaflet(deployWorld.x, deployWorld.y);

  return {
    jumpPoint:   { lat: jumpLL.lat,   lng: jumpLL.lng   },
    deployPoint: { lat: deployLL.lat, lng: deployLL.lng },
    dropPoint:   dropLL,
    jumpOnRoute: ts_check(drop, Coords.mToWU(deployResult.ffHorizM + glHorizMFin), busA, busB),

    altitudes: {
      bus:     P.BUS_ALT,
      deploy:  Math.round(deployAlt),
      terrain: Math.round(terrainElev),
      target:  Math.round(targetElev),
    },

    timing: {
      freefall: +deployResult.ffTime.toFixed(1),
      glide:    +glTime.toFixed(1),
      total:    +(deployResult.ffTime + glTime).toFixed(1),
    },

    distances: {
      freefallHorizM: Math.round(deployResult.ffHorizM),
      glideHorizM:    Math.round(glHorizMFin),
      totalM:         Math.round(deployResult.ffHorizM + glHorizMFin),
    },

    glideDirection: {
      degrees:  Math.round(glideDeg),
      cardinal: toCardinal(glideDeg),
    },

    hasObstacle: obstacles.hasObstacle,
    obstacles,

    paths: {
      freefall: freefallPath,
      glide:    glidePath,
    },
  };
}

function ts_check(drop, totalWU, busA, busB) {
  return circleSegmentTs(drop.x, drop.y, totalWU, busA.x, busA.y, busB.x, busB.y).length > 0;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function buildPath(from, to, altFrom, altTo, steps) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t  = i / steps;
    const x  = from.x + (to.x - from.x) * t;
    const y  = from.y + (to.y - from.y) * t;
    const ll = Coords.toLeaflet(x, y);
    return { lat: ll.lat, lng: ll.lng, alt: Math.round(altFrom + (altTo - altFrom) * t) };
  });
}

function checkPath(hmap, from, to, altFrom, altTo, steps = 40) {
  let hasObstacle = false, worstClearance = Infinity, firstObstacle = null;
  for (let i = 0; i <= steps; i++) {
    const t          = i / steps;
    const x          = from.x + (to.x - from.x) * t;
    const y          = from.y + (to.y - from.y) * t;
    const playerAlt  = altFrom + (altTo - altFrom) * t;
    const terrainAlt = hmap.elev(x, y);
    const clearance  = playerAlt - terrainAlt;
    if (clearance < worstClearance) worstClearance = clearance;
    if (clearance < 10 && !hasObstacle) {
      hasObstacle = true;
      const ll = Coords.toLeaflet(x, y);
      firstObstacle = { lat: ll.lat, lng: ll.lng, clearance: Math.round(clearance) };
    }
  }
  return { hasObstacle, worstClearance: Math.round(worstClearance), firstObstacle };
}

function toCardinal(deg) {
  return ['N','NE','E','SE','S','SW','W','NW'][Math.round(deg / 45) % 8];
}

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────
class DropCalcEngine {
  constructor() { this.hmap = new Heightmap(); this.ready = false; }

  async init(heightmapUrl) {
    await this.hmap.load(heightmapUrl);
    this.ready = true;
    console.log('DropCalcEngine v4 ready');
  }

  calculate(dropPoint, busStart, busEnd, buildingHeightM = 0) {
    if (!this.ready) throw new Error('Call await engine.init(url) first');
    return calculate(this.hmap, dropPoint, busStart, busEnd, buildingHeightM);
  }

  getElevation(lat, lng) {
    return Math.round(this.hmap.elevLL(lat, lng));
  }

  getConstants()  { return C; }
  getCoordUtils() { return Coords; }
}

window.DropCalcEngine    = DropCalcEngine;
window.DropCalcCoords    = Coords;
window.DropCalcConstants = C;