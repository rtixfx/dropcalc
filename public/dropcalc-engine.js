/**
 * Trajectory Solver - Fortnite Battle Royale Drop Physics
 * 
 * Reverse-engineered from DropIQ API response data (May 2026).
 * 
 * Coordinate Systems:
 *   - DropIQ World Units (DM_WU): 0-2560 range
 *   - Leaflet Units (LU): 0-256 range (1 LU = 10 DM_WU)
 *   - The map uses Leaflet CRS.Simple: lat [-256, 0], lng [0, 256]
 *
 * Physics (calibrated from DropIQ data):
 *   Freefall horizontal speed = DIVE_SPEED * cos(theta) in LU/s
 *   Glide: parabolic deceleration, T = 2 * distance / GLIDE_V0
 */

// Physics constants in Leaflet Units per second
// World coordinate system: 3000x3000 WU maps to 256x256 Leaflet (1 LU = 11.72 WU)
// TILE_TO_METERS = 3.84, so 1 LU = 11.72 * 3.84 = 45m
// Freefall: ~15.9 WU/s / 11.72 = 1.36 LU/s total speed
// Glide: ~36.2 WU/s initial / 11.72 = 3.09 LU/s
const DIVE_SPEED_LU = 1.36;    // Freefall total speed (~61 m/s)
const GLIDE_V0_LU = 3.09;      // Glide initial speed (decelerates to 0)
const BUS_SPEED_LU = 1.667;    // Bus speed (75 m/s / 45)
const BUS_ALT_LU = 18.49;      // Bus altitude (832m / 45)
const DEPLOY_AGL_LU = 2.22;    // Deploy height (100m / 45)
const LEAFLET_EXTENT = 256;
const M_PER_LU = 45;
const DIVE_MIN_PITCH = 7;
const DIVE_MAX_PITCH = 89;

function dist2D(lat1, lng1, lat2, lng2) {
    const dy = lat2 - lat1, dx = lng2 - lng1;
    return Math.sqrt(dx * dx + dy * dy);
}

function projectOntoSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-10) return { t: 0, dist: dist2D(px, py, ax, ay) };
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = ax + t * dx, projY = ay + t * dy;
    return { t, dist: dist2D(px, py, projX, projY) };
}

// ============================================================
// TERRAIN
// ============================================================
class TerrainData {
    constructor() {
        this._grid = null;
        this._w = 0;
        this._h = 0;
        this._loaded = false;
    }

    async initialize(url) {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const header = new DataView(buffer);
        this._w = header.getUint32(0, true);
        this._h = header.getUint32(4, true);
        this._grid = new Uint16Array(buffer, 8);
        this._loaded = true;
        console.log('[DropCalc] Heightmap:', this._w, 'x', this._h);
    }

    get isReady() { return this._loaded; }

    sampleLeaflet(lat, lng) {
        if (!this._loaded) return 0;
        const nx = lng / LEAFLET_EXTENT;
        const ny = (-lat) / LEAFLET_EXTENT;
        if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return 0;

        const fx = nx * (this._w - 1);
        const fy = ny * (this._h - 1);
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const x1 = Math.min(x0 + 1, this._w - 1);
        const y1 = Math.min(y0 + 1, this._h - 1);
        const tx = fx - x0, ty = fy - y0;

        const g = this._grid, w = this._w;
        const raw = (1 - tx) * (1 - ty) * g[y0 * w + x0]
            + tx * (1 - ty) * g[y0 * w + x1]
            + (1 - tx) * ty * g[y1 * w + x0]
            + tx * ty * g[y1 * w + x1];

        // Convert to LU.
        // Calibration: sea level ≈ raw 30900, scale 0.0152 m/unit
        // Raw values below 28000 are void/water/padding - treat as 0
        if (raw < 28000) return 0;
        const meters = Math.max(0, (raw - 30900) * 0.0152);
        return meters / M_PER_LU;
    }
}

// ============================================================
// FREEFALL
// ============================================================
function simulateFreefall(terrain, jumpLat, jumpLng, destLat, destLng, pitchDeg) {
    const pitchRad = pitchDeg * Math.PI / 180;
    const vH = DIVE_SPEED_LU * Math.cos(pitchRad);
    const vV = DIVE_SPEED_LU * Math.sin(pitchRad);

    const dLat = destLat - jumpLat, dLng = destLng - jumpLng;
    const totalDist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (totalDist < 0.01) return null;

    const dirLat = dLat / totalDist, dirLng = dLng / totalDist;
    const dt = 0.3;
    let alt = BUS_ALT_LU, lat = jumpLat, lng = jumpLng, time = 0;

    for (let i = 0; i < 500; i++) {
        lat += dirLat * vH * dt;
        lng += dirLng * vH * dt;
        alt -= vV * dt;
        time += dt;

        const terr = terrain.sampleLeaflet(lat, lng);
        if (alt - terr <= DEPLOY_AGL_LU) {
            return { deployLat: lat, deployLng: lng, deployAlt: alt, terrainAtDeploy: terr, ffTime: time, ffDist: dist2D(jumpLat, jumpLng, lat, lng) };
        }
        if (dist2D(jumpLat, jumpLng, lat, lng) > totalDist * 1.5) {
            return { deployLat: lat, deployLng: lng, deployAlt: alt, terrainAtDeploy: terrain.sampleLeaflet(lat, lng), ffTime: time, ffDist: dist2D(jumpLat, jumpLng, lat, lng) };
        }
        if (alt <= terr) return null;
    }
    return { deployLat: lat, deployLng: lng, deployAlt: alt, terrainAtDeploy: terrain.sampleLeaflet(lat, lng), ffTime: time, ffDist: dist2D(jumpLat, jumpLng, lat, lng) };
}

// ============================================================
// GLIDE
// ============================================================
function calculateGlide(terrain, dLat, dLng, dAlt, destLat, destLng, extraHLU) {
    const gDist = dist2D(dLat, dLng, destLat, destLng);
    if (gDist < 0.01) return { glideTime: 0.5, glideDist: 0, reachable: true, hasObstacle: false, terrainAtDest: terrain.sampleLeaflet(destLat, destLng) };

    const glideTime = (2 * gDist) / GLIDE_V0_LU;
    const terrAtDest = terrain.sampleLeaflet(destLat, destLng);
    const targetAlt = terrAtDest + extraHLU;
    const altAvail = dAlt - targetAlt;

    if (altAvail < 0) return null;
    if ((altAvail * M_PER_LU) / glideTime > 40) return null;

    let hasObstacle = false;
    for (let i = 1; i < 8; i++) {
        const t = i / 8;
        const pf = 2 * t - t * t;
        const la = dLat + (destLat - dLat) * pf;
        const ln = dLng + (destLng - dLng) * pf;
        const th = terrain.sampleLeaflet(la, ln);
        const ah = dAlt - altAvail * t;
        if (ah - th < 0.3) { hasObstacle = true; break; }
    }

    return { glideTime, glideDist: gDist, terrainAtDest: terrAtDest, targetAlt, altAvail, hasObstacle, reachable: true };
}

// ============================================================
// OPTIMAL ANGLE
// ============================================================
function findOptimalDive(terrain, jLat, jLng, dLat, dLng, extraHLU) {
    let best = null, bestTime = Infinity;

    for (let p = DIVE_MIN_PITCH; p <= DIVE_MAX_PITCH; p += 2.5) {
        const ff = simulateFreefall(terrain, jLat, jLng, dLat, dLng, p);
        if (!ff) continue;
        const gl = calculateGlide(terrain, ff.deployLat, ff.deployLng, ff.deployAlt, dLat, dLng, extraHLU);
        if (!gl || !gl.reachable) continue;
        const tot = ff.ffTime + gl.glideTime;
        if (tot < bestTime) { bestTime = tot; best = { ...ff, ...gl, pitchDeg: p, dropTime: tot }; }
    }

    if (best) {
        const cp = best.pitchDeg;
        for (let p = cp - 2.5; p <= cp + 2.5; p += 0.5) {
            if (p < DIVE_MIN_PITCH || p > DIVE_MAX_PITCH) continue;
            const ff = simulateFreefall(terrain, jLat, jLng, dLat, dLng, p);
            if (!ff) continue;
            const gl = calculateGlide(terrain, ff.deployLat, ff.deployLng, ff.deployAlt, dLat, dLng, extraHLU);
            if (!gl || !gl.reachable) continue;
            const tot = ff.ffTime + gl.glideTime;
            if (tot < bestTime) { bestTime = tot; best = { ...ff, ...gl, pitchDeg: p, dropTime: tot }; }
        }
    }
    return best;
}

// ============================================================
// OPTIMAL JUMP POINT
// ============================================================
function solveOptimalJump(terrain, busStart, busEnd, dest, extraHLU) {
    const busLen = dist2D(busStart.lat, busStart.lng, busEnd.lat, busEnd.lng);
    if (busLen < 0.01) return null;

    let best = null, bestTotal = Infinity, bestT = 0;
    const N = 50;

    for (let i = 0; i <= N; i++) {
        const t = i / N;
        const jLat = busStart.lat + (busEnd.lat - busStart.lat) * t;
        const jLng = busStart.lng + (busEnd.lng - busStart.lng) * t;
        const dive = findOptimalDive(terrain, jLat, jLng, dest.lat, dest.lng, extraHLU);
        if (!dive) continue;
        const busTime = (t * busLen) / BUS_SPEED_LU;
        const total = busTime + dive.dropTime;
        if (total < bestTotal) { bestTotal = total; best = dive; bestT = t; }
    }

    if (best) {
        const step = 1.5 / N;
        for (let i = -10; i <= 10; i++) {
            const t = Math.max(0, Math.min(1, bestT + i * step / 10));
            const jLat = busStart.lat + (busEnd.lat - busStart.lat) * t;
            const jLng = busStart.lng + (busEnd.lng - busStart.lng) * t;
            const dive = findOptimalDive(terrain, jLat, jLng, dest.lat, dest.lng, extraHLU);
            if (!dive) continue;
            const busTime = (t * busLen) / BUS_SPEED_LU;
            const total = busTime + dive.dropTime;
            if (total < bestTotal) { bestTotal = total; best = dive; bestT = t; }
        }
    }

    if (!best) return null;
    const jumpLat = busStart.lat + (busEnd.lat - busStart.lat) * bestT;
    const jumpLng = busStart.lng + (busEnd.lng - busStart.lng) * bestT;
    const busTime = (bestT * busLen) / BUS_SPEED_LU;
    return { jumpLat, jumpLng, busT: bestT, busTime, ...best, grandTotal: busTime + best.dropTime };
}

// ============================================================
// PATH VISUALIZATION
// ============================================================
function buildPaths(jLat, jLng, dLat, dLng, dAlt, destLat, destLng, terrAtDest, extraHLU) {
    const S = 15;
    const freefall = [], glide = [];
    for (let i = 0; i <= S; i++) {
        const t = i / S;
        freefall.push({ lat: jLat + (dLat - jLat) * t, lng: jLng + (dLng - jLng) * t, alt: Math.round((BUS_ALT_LU - (BUS_ALT_LU - dAlt) * t) * M_PER_LU) });
    }
    const tgtAlt = terrAtDest + extraHLU;
    for (let i = 0; i <= S; i++) {
        const t = i / S;
        const pf = 2 * t - t * t;
        glide.push({ lat: dLat + (destLat - dLat) * pf, lng: dLng + (destLng - dLng) * pf, alt: Math.round((dAlt - (dAlt - tgtAlt) * t) * M_PER_LU) });
    }
    return { freefall, glide, full: freefall.concat(glide) };
}

// ============================================================
// MAIN
// ============================================================
function computeDrop(terrain, dropPoint, busStart, busEnd, buildingHeightM) {
    buildingHeightM = buildingHeightM || 0;
    const extraHLU = buildingHeightM / M_PER_LU;
    const terrAtDrop = terrain.sampleLeaflet(dropPoint.lat, dropPoint.lng);
    const terrAtDropM = terrAtDrop * M_PER_LU;

    const perp = projectOntoSegment(dropPoint.lat, dropPoint.lng, busStart.lat, busStart.lng, busEnd.lat, busEnd.lng);
    const perpDistM = perp.dist * M_PER_LU;
    const availAlt = BUS_ALT_LU - terrAtDrop - DEPLOY_AGL_LU;

    if (availAlt <= 0 || perpDistM > availAlt * M_PER_LU * 12) {
        return { error: 'DESTINATION TOO FAR', details: { distanceToBus: Math.round(perpDistM) + 'm', terrainAtDrop: Math.round(terrAtDropM) + 'm' } };
    }

    const solution = solveOptimalJump(terrain, busStart, busEnd, dropPoint, extraHLU);
    if (!solution) {
        return { error: 'NO ROUTE FOUND', details: { hint: 'Try a destination closer to the bus path', distanceToBus: Math.round(perpDistM) + 'm' } };
    }

    const paths = buildPaths(solution.jumpLat, solution.jumpLng, solution.deployLat, solution.deployLng, solution.deployAlt, dropPoint.lat, dropPoint.lng, terrAtDrop, extraHLU);

    const dxLng = dropPoint.lng - solution.deployLng;
    const dyLat = dropPoint.lat - solution.deployLat;
    const bearingRad = Math.atan2(dxLng, -dyLat);
    const bearingDeg = (bearingRad * 180 / Math.PI + 360) % 360;
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

    const ffDistM = solution.ffDist * M_PER_LU;
    const glDistM = (solution.glideDist || 0) * M_PER_LU;
    const deployAGLm = (solution.deployAlt - solution.terrainAtDeploy) * M_PER_LU;
    const isEarly = deployAGLm > 130;

    return {
        jumpPoint: { lat: solution.jumpLat, lng: solution.jumpLng },
        deployPoint: { lat: solution.deployLat, lng: solution.deployLng },
        dropPoint: dropPoint,
        altitudes: {
            bus: Math.round(BUS_ALT_LU * M_PER_LU),
            deploy: Math.round(solution.deployAlt * M_PER_LU),
            deployHeight: Math.round(deployAGLm),
            terrainAtDeploy: Math.round(solution.terrainAtDeploy * M_PER_LU),
            terrainAtDrop: Math.round(terrAtDropM),
            target: Math.round(terrAtDropM + buildingHeightM),
        },
        timing: {
            bus: +solution.busTime.toFixed(2),
            freefall: +solution.ffTime.toFixed(2),
            glide: +(solution.glideTime || 0).toFixed(2),
            total: +solution.grandTotal.toFixed(2),
        },
        distances: {
            freefallM: Math.round(ffDistM),
            glideM: Math.round(glDistM),
            totalM: Math.round(ffDistM + glDistM),
        },
        dive: {
            angle: +solution.pitchDeg.toFixed(1),
            horizSpeed: +(DIVE_SPEED_LU * Math.cos(solution.pitchDeg * Math.PI / 180) * M_PER_LU).toFixed(1),
            vertSpeed: +(DIVE_SPEED_LU * Math.sin(solution.pitchDeg * Math.PI / 180) * M_PER_LU).toFixed(1),
        },
        glideDirection: {
            degrees: Math.round(bearingDeg),
            cardinal: cardinals[Math.round(bearingDeg / 45) % 8],
        },
        deploy: {
            isEarly: isEarly,
            height: Math.round(deployAGLm),
            recommendation: isEarly ? 'Pop at ' + Math.round(deployAGLm) + 'm' : 'Auto-deploy',
        },
        paths: paths,
        hasObstacle: solution.hasObstacle || false,
        worldCoords: {
            jump: { x: Math.round(solution.jumpLng * M_PER_LU), y: Math.round(-solution.jumpLat * M_PER_LU) },
            deploy: { x: Math.round(solution.deployLng * M_PER_LU), y: Math.round(-solution.deployLat * M_PER_LU) },
            drop: { x: Math.round(dropPoint.lng * M_PER_LU), y: Math.round(-dropPoint.lat * M_PER_LU) },
        },
    };
}

// ============================================================
// PUBLIC API
// ============================================================
class DropCalcEngine {
    constructor() { this._terrain = new TerrainData(); this._ready = false; }

    async init(heightmapUrl) {
        await this._terrain.initialize(heightmapUrl);
        this._ready = true;
        console.log('[DropCalc] Engine ready');
    }

    calculate(dropPoint, busStart, busEnd, buildingHeightM) {
        if (!this._ready) throw new Error('Engine not initialized');
        return computeDrop(this._terrain, dropPoint, busStart, busEnd, buildingHeightM || 0);
    }

    getElevation(lat, lng) { return Math.round(this._terrain.sampleLeaflet(lat, lng) * M_PER_LU); }
    isReady() { return this._ready; }
    getConstants() { return { BUS_ALT_LU, DEPLOY_AGL_LU, DIVE_SPEED_LU, GLIDE_V0_LU, BUS_SPEED_LU, M_PER_LU }; }
}

window.DropCalcEngine = DropCalcEngine;
