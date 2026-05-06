/**
 * Fortnite Drop Calculator Engine v6 (Verified Constants)
 * =======================================================
 * 
 * PHYSICS CONSTANTS (from real Dropmazter API analysis):
 * - GL_HORIZ: ~70 m/s (confirmed from 7 drops)
 * - GL_VERT: ~8.6 m/s (varies with angle)
 * - FF_VERT: ~38.6 m/s (varies with dive angle)
 * - FF_HORIZ: ~40.6 m/s (varies with dive angle)
 * 
 * USAGE:
 *   const engine = new DropCalcEngine();
 *   await engine.init('heightmap.bin');
 *   const result = engine.calculate(dropPoint, busStart, busEnd);
 */

// ─────────────────────────────────────────────
// CONSTANTS (Verified from Dropmazter API)
// ─────────────────────────────────────────────
const C = {
    MAP: {
        MIN_LNG: 0, MAX_LNG: 256,
        MIN_LAT: -256, MAX_LAT: 0,
        WORLD_W: 3000,
        WORLD_H: 3000,
        M_PER_WU: 3.84,      // meters per world unit
        WU_PER_M: 0.260416667,
    },

    HM: {
        W: 2033, H: 2033,
        RAW_SEA_LEVEL: 679,
        METERS_PER_UNIT: 0.015198,
    },

    // PHYSICS CONSTANTS (verified from real data)
    PHY: {
        BUS_ALT: 832,         // Bus altitude above sea level (m)
        FF_TOTAL: 51,        // Total freefall speed (m/s) - player max speed
        FF_VERT_AVG: 38.6,   // Average freefall vertical speed (m/s)
        FF_HORIZ_AVG: 40.6,  // Average freefall horizontal speed (m/s)
        GL_VERT_AVG: 8.6,    // Average glide descent speed (m/s)
        GL_HORIZ: 70,        // Glide forward speed (m/s) - CONFIRMED
        DEPLOY_HEIGHT: 100, // Glider deploy height (m)
    },
};

// ─────────────────────────────────────────────
// COORDINATE UTILITIES
// ─────────────────────────────────────────────
const Coords = {
    toWorld(lat, lng) {
        const { MIN_LNG, MAX_LNG, MIN_LAT, MAX_LAT, WORLD_W, WORLD_H } = C.MAP;
        return {
            x: ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * WORLD_W,
            y: ((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * WORLD_H,
        };
    },

    toLeaflet(x, y) {
        const { MIN_LNG, MAX_LNG, MIN_LAT, MAX_LAT, WORLD_W, WORLD_H } = C.MAP;
        return {
            lat: MIN_LAT + (y / WORLD_H) * (MAX_LAT - MIN_LAT),
            lng: MIN_LNG + (x / WORLD_W) * (MAX_LNG - MIN_LNG),
        };
    },

    distWU(ax, ay, bx, by) {
        return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
    },

    mToWU(meters) {
        return meters * C.MAP.WU_PER_M;
    },

    wuToM(wu) {
        return wu * C.MAP.M_PER_WU;
    },
};

// ─────────────────────────────────────────────
// HEIGHTMAP
// ─────────────────────────────────────────────
class Heightmap {
    constructor() {
        this.data = null;
        this.w = 0;
        this.h = 0;
        this.ready = false;
    }

    async load(url) {
        const buf = await (await fetch(url)).arrayBuffer();
        const view = new DataView(buf);
        this.w = view.getUint32(0, true);
        this.h = view.getUint32(4, true);
        this.data = new Uint16Array(buf, 8);
        this.ready = true;
        console.log(`Heightmap: ${this.w}x${this.h}`);
    }

    raw(px, py) {
        px = Math.max(0, Math.min(this.w - 1, Math.floor(px)));
        py = Math.max(0, Math.min(this.h - 1, Math.floor(py)));
        return this.data[py * this.w + px];
    }

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
                + tx*(1-ty)*this.raw(x1,y0)
                + (1-tx)*ty*this.raw(x0,y1)
                + tx*ty*this.raw(x1,y1);
        return Math.max(0, (v - RAW_SEA_LEVEL) * METERS_PER_UNIT);
    }

    elevLL(lat, lng) {
        const w = Coords.toWorld(lat, lng);
        return this.elev(w.x, w.y);
    }
}

// ─────────────────────────────────────────────
// CIRCLE ∩ LINE SEGMENT
// ─────────────────────────────────────────────
function circleSegmentTs(cx, cy, r, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const fx = x1 - cx, fy = y1 - cy;
    const a = dx * dx + dy * dy;
    if (a === 0) return [];
    const b = 2 * (fx * dx + fy * dy);
    const cc = fx * fx + fy * fy - r * r;
    let disc = b * b - 4 * a * cc;
    if (disc < 0) return [];
    disc = Math.sqrt(disc);
    return [(-b - disc) / (2 * a), (-b + disc) / (2 * a)]
        .filter(t => t >= -0.0001 && t <= 1.0001)
        .map(t => Math.max(0, Math.min(1, t)));
}

// ─────────────────────────────────────────────
// FREEFAIL SPEEDS FROM ANGLE
// ─────────────────────────────────────────────
function getFFSpeeds(thetaDegrees) {
    const theta = thetaDegrees * Math.PI / 180;
    const total = C.PHY.FF_TOTAL;
    return {
        horiz: total * Math.cos(theta),
        vert: total * Math.sin(theta),
    };
}

// ─────────────────────────────────────────────
// FIND DEPLOY POINT
// ─────────────────────────────────────────────
function findDeployPoint(hmap, jumpWorld, dropWorld, busAlt) {
    const P = C.PHY;
    const { FF_HORIZ_AVG, FF_VERT_AVG } = P;

    // Direction from jump to drop
    const dx = dropWorld.x - jumpWorld.x;
    const dy = dropWorld.y - jumpWorld.y;
    const distWU = Math.sqrt(dx * dx + dy * dy);
    const dirX = distWU > 0 ? dx / distWU : 0;
    const dirY = distWU > 0 ? dy / distWU : 0;

    // Freefall speed in WU/s
    const ffHorizWUs = FF_HORIZ_AVG * C.MAP.WU_PER_M;

    // Binary search for deploy point
    const altDrop = busAlt - P.DEPLOY_HEIGHT;
    const maxTime = altDrop / FF_VERT_AVG;

    let lo = 0, hi = maxTime;
    for (let i = 0; i < 64; i++) {
        const mid = (lo + hi) / 2;
        const x = jumpWorld.x + dirX * ffHorizWUs * mid;
        const y = jumpWorld.y + dirY * ffHorizWUs * mid;
        const playerAlt = busAlt - FF_VERT_AVG * mid;
        const terrainAlt = hmap.elev(x, y);
        const clearance = playerAlt - terrainAlt;

        if (Math.abs(clearance - P.DEPLOY_HEIGHT) < 0.1) break;
        if (clearance > P.DEPLOY_HEIGHT) lo = mid;
        else hi = mid;
    }

    const ffTime = (lo + hi) / 2;
    const ffHorizM = FF_HORIZ_AVG * ffTime;
    const deployX = jumpWorld.x + dirX * Coords.mToWU(ffHorizM);
    const deployY = jumpWorld.y + dirY * Coords.mToWU(ffHorizM);
    const deployAlt = busAlt - FF_VERT_AVG * ffTime;

    return {
        world: { x: deployX, y: deployY },
        alt: deployAlt,
        ffTime,
        ffHorizM,
        terrainAlt: hmap.elev(deployX, deployY),
    };
}

// ─────────────────────────────────────────────
// BUILD PATH
// ─────────────────────────────────────────────
function buildPath(from, to, altFrom, altTo, steps = 20) {
    const path = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;
        const ll = Coords.toLeaflet(x, y);
        path.push({ lat: ll.lat, lng: ll.lng, alt: Math.round(altFrom + (altTo - altFrom) * t) });
    }
    return path;
}

// ─────────────────────────────────────────────
// DIRECTION UTILITIES
// ─────────────────────────────────────────────
function toCardinal(deg) {
    return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}

function calculateBearing(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const rad = Math.atan2(dx, -dy);
    const deg = (rad * 180 / Math.PI + 360) % 360;
    return { radians: rad, degrees: deg, cardinal: toCardinal(deg) };
}

// ─────────────────────────────────────────────
// GENERATE THETA ARRAY
// ─────────────────────────────────────────────
function generateThetaArray(numPoints = 11) {
    const theta = [];
    const baseAngle = -45; // Average from Dropmazter data
    for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        let angle;
        if (t < 0.3) {
            angle = baseAngle + 15 * (1 - t / 0.3); // Shallow start
        } else if (t < 0.7) {
            const mt = (t - 0.3) / 0.4;
            angle = baseAngle - 5 + 10 * mt; // Steepen
        } else {
            const mt = (t - 0.7) / 0.3;
            angle = baseAngle + 5 + 20 * mt; // Very steep end
        }
        theta.push(parseFloat(angle.toFixed(1)));
    }
    return theta;
}

// ─────────────────────────────────────────────
// MAIN CALCULATE FUNCTION
// ─────────────────────────────────────────────
function calculate(hmap, dropLL, busStartLL, busEndLL, buildingHeightM = 0) {
    const P = C.PHY;

    // Convert to world units
    const drop = Coords.toWorld(dropLL.lat, dropLL.lng);
    const busA = Coords.toWorld(busStartLL.lat, busStartLL.lng);
    const busB = Coords.toWorld(busEndLL.lat, busEndLL.lng);

    // Bus geometry
    const busLenWU = Coords.distWU(busA.x, busA.y, busB.x, busB.y);
    const busUx = busLenWU > 0 ? (busB.x - busA.x) / busLenWU : 1;
    const busUy = busLenWU > 0 ? (busB.y - busA.y) / busLenWU : 0;

    // Target elevation
    const terrainElev = hmap.elev(drop.x, drop.y);
    const targetElev = terrainElev + buildingHeightM;

    // Closest point on bus to drop
    const tClosest = Math.max(0, Math.min(1,
        ((drop.x - busA.x) * busUx + (drop.y - busA.y) * busUy) / busLenWU
    ));

    // Iterative solve
    let deployAlt = targetElev + P.DEPLOY_HEIGHT;
    let glHorizM = (P.DEPLOY_HEIGHT / P.GL_VERT_AVG) * P.GL_HORIZ;
    let ffVertDist = Math.max(0, P.BUS_ALT - deployAlt);
    let ffHorizM = (ffVertDist / P.FF_VERT_AVG) * P.FF_HORIZ_AVG;
    let totalM = ffHorizM + glHorizM;
    let totalWU = Coords.mToWU(totalM);
    let jumpWorld = null;
    let deployResult = null;

    for (let iter = 0; iter < 8; iter++) {
        const ts = circleSegmentTs(drop.x, drop.y, totalWU, busA.x, busA.y, busB.x, busB.y);
        let jumpT;

        if (ts.length > 0) {
            const before = ts.filter(t => t <= tClosest);
            const after = ts.filter(t => t > tClosest);
            jumpT = before.length > 0 ? Math.max(...before) : Math.min(...after);
        } else {
            jumpT = tClosest;
        }

        jumpWorld = {
            x: busA.x + busUx * busLenWU * jumpT,
            y: busA.y + busUy * busLenWU * jumpT,
        };

        deployResult = findDeployPoint(hmap, jumpWorld, drop, P.BUS_ALT);
        deployAlt = deployResult.alt;
        ffHorizM = deployResult.ffHorizM;

        const glVertM = Math.max(0, deployAlt - targetElev);
        const glTime = glVertM / P.GL_VERT_AVG;
        glHorizM = glTime * P.GL_HORIZ;
        totalM = ffHorizM + glHorizM;
        totalWU = Coords.mToWU(totalM);
    }

    // Final calculations
    const deployWorld = deployResult.world;
    const glVertM = Math.max(0, deployAlt - targetElev);
    const glTime = glVertM / P.GL_VERT_AVG;
    const glHorizMFin = glTime * P.GL_HORIZ;
    const glideBearing = calculateBearing(deployWorld, drop);

    // Build paths
    const freefallPath = buildPath(jumpWorld, deployWorld, P.BUS_ALT, deployAlt, 20);
    const glidePath = buildPath(deployWorld, drop, deployAlt, targetElev, 20);
    const fullPath = [...freefallPath, ...glidePath.slice(1)];

    // Leaflet coords
    const jumpLL = Coords.toLeaflet(jumpWorld.x, jumpWorld.y);
    const deployLL = Coords.toLeaflet(deployWorld.x, deployWorld.y);

    // Generate angle arrays
    const thetaArray = generateThetaArray();
    const psiArray = [parseFloat(glideBearing.radians.toFixed(3))];

    return {
        jumpPoint: { lat: jumpLL.lat, lng: jumpLL.lng },
        deployPoint: { lat: deployLL.lat, lng: deployLL.lng },
        dropPoint: dropLL,

        altitudes: {
            bus: P.BUS_ALT,
            deploy: Math.round(deployAlt),
            terrainAtDeploy: Math.round(deployResult.terrainAlt),
            terrainAtDrop: Math.round(terrainElev),
            target: Math.round(targetElev),
        },

        timing: {
            freefall: +deployResult.ffTime.toFixed(2),
            glide: +glTime.toFixed(2),
            total: +(deployResult.ffTime + glTime).toFixed(2),
        },

        distances: {
            freefallM: Math.round(deployResult.ffHorizM),
            glideM: Math.round(glHorizMFin),
            totalM: Math.round(deployResult.ffHorizM + glHorizMFin),
        },

        glideDirection: {
            degrees: Math.round(glideBearing.degrees),
            cardinal: glideBearing.cardinal,
        },

        paths: {
            freefall: freefallPath,
            glide: glidePath,
            full: fullPath,
        },

        angles: {
            theta: thetaArray,
            psi: psiArray,
        },

               worldCoords: {
            jump: { x: Math.round(jumpWorld.x), y: Math.round(jumpWorld.y) },
            deploy: { x: Math.round(deployWorld.x), y: Math.round(deployWorld.y) },
            drop: { x: Math.round(drop.x), y: Math.round(drop.y) },
        },
    };
}

// ─────────────────────────────────────────────
// CHECK IF DROP IS ON BUS ROUTE
// ─────────────────────────────────────────────
function isOnRoute(drop, totalWU, busA, busB) {
    return circleSegmentTs(drop.x, drop.y, totalWU, busA.x, busA.y, busB.x, busB.y).length > 0;
}

// ─────────────────────────────────────────────
// CHECK PATH FOR OBSTACLES
// ─────────────────────────────────────────────
function checkPath(hmap, from, to, altFrom, altTo, steps = 40) {
    let hasObstacle = false;
    let worstClearance = Infinity;
    let firstObstacle = null;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;
        const playerAlt = altFrom + (altTo - altFrom) * t;
        const terrainAlt = hmap.elev(x, y);
        const clearance = playerAlt - terrainAlt;

        if (clearance < worstClearance) worstClearance = clearance;
        if (clearance < 10 && !hasObstacle) {
            hasObstacle = true;
            const ll = Coords.toLeaflet(x, y);
            firstObstacle = { lat: ll.lat, lng: ll.lng, clearance: Math.round(clearance) };
        }
    }

    return { hasObstacle, worstClearance: Math.round(worstClearance), firstObstacle };
}

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────
class DropCalcEngine {
    constructor() {
        this.hmap = new Heightmap();
        this.ready = false;
    }

    async init(heightmapUrl) {
        await this.hmap.load(heightmapUrl);
        this.ready = true;
        console.log('DropCalcEngine v6 ready');
        console.log('Constants:', {
            GL_HORIZ: C.PHY.GL_HORIZ,
            FF_HORIZ_AVG: C.PHY.FF_HORIZ_AVG,
            FF_VERT_AVG: C.PHY.FF_VERT_AVG,
        });
    }

    calculate(dropPoint, busStart, busEnd, buildingHeightM = 0) {
        if (!this.ready) {
            throw new Error('Call await engine.init(url) first');
        }
        return calculate(this.hmap, dropPoint, busStart, busEnd, buildingHeightM);
    }

    getElevation(lat, lng) {
        return Math.round(this.hmap.elevLL(lat, lng));
    }

    toWorld(lat, lng) {
        return Coords.toWorld(lat, lng);
    }

    toLeaflet(x, y) {
        return Coords.toLeaflet(x, y);
    }

    isReady() {
        return this.ready;
    }

    getConstants() {
        return C;
    }
}

// Export to global scope
window.DropCalcEngine = DropCalcEngine;
window.Coords = Coords;