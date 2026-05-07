/**
 * Fortnite Drop Calculator Engine v8 (True Physics Simulation)
 * ==========================================================
 * 
 * Simulates actual Fortnite physics to find optimal jump point
 */

const C = {
    MAP: {
        WORLD_W: 3000,
        WORLD_H: 3000,
        M_PER_WU: 3.84,
        WU_PER_M: 0.260416667,
    },
    HM: {
        W: 2033, H: 2033,
        RAW_SEA_LEVEL: 679,
        METERS_PER_UNIT: 0.015198,
    },
    PHY: {
        BUS_SPEED: 75,      // m/s
        FF_TERMINAL_V: 75, // m/s (terminal velocity)
        FF_MAX_HORIZ: 51,  // m/s (max horizontal during freefall)
        GL_HORIZ: 70,      // m/s (glide forward speed)
        GL_VERT: 6.5,      // m/s (glide descent speed)
        DEPLOY_HEIGHT: 100, // m above terrain
    },
};

const Coords = {
    toWorld(lat, lng) {
        return {
            x: (lng / 256) * 3000,
            y: ((lat + 256) / 256) * 3000,
        };
    },
    toLeaflet(x, y) {
        return {
            lat: -256 + (y / 3000) * 256,
            lng: (x / 3000) * 256,
        };
    },
    distWU(ax, ay, bx, by) {
        return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
    },
    mToWU(m) { return m * C.MAP.WU_PER_M; },
    wuToM(w) { return w * C.MAP.M_PER_WU; },
};

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
    }

    raw(px, py) {
        px = Math.max(0, Math.min(this.w - 1, Math.floor(px)));
        py = Math.max(0, Math.min(this.h - 1, Math.floor(py)));
        return this.data[py * this.w + px];
    }

    elev(wx, wy) {
        if (!this.ready) return 0;
        const fx = (wx / 3000) * this.w;
        const fy = (wy / 3000) * this.h;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const x1 = Math.min(x0 + 1, this.w - 1), y1 = Math.min(y0 + 1, this.h - 1);
        const tx = fx - x0, ty = fy - y0;
        const v = (1-tx)*(1-ty)*this.raw(x0,y0)
                + tx*(1-ty)*this.raw(x1,y0)
                + (1-tx)*ty*this.raw(x0,y1)
                + tx*ty*this.raw(x1,y1);
        return Math.max(0, (v - C.HM.RAW_SEA_LEVEL) * C.HM.METERS_PER_UNIT);
    }

    elevLL(lat, lng) {
        const w = Coords.toWorld(lat, lng);
        return this.elev(w.x, w.y);
    }
}

// Simulate drop from a specific jump point
function simulateDrop(hmap, jumpWorld, destWorld) {
    const P = C.PHY;
    const WU_PER_M = C.MAP.WU_PER_M;
    const M_PER_WU = C.MAP.M_PER_WU;

    // Direction from jump to destination
    const dx = destWorld.x - jumpWorld.x;
    const dy = destWorld.y - jumpWorld.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dirX = dist > 0 ? dx / dist : 0;
    const dirY = dist > 0 ? dy / dist : 0;

    // Freefall simulation (time step = 0.1s)
    let x = jumpWorld.x;
    let y = jumpWorld.y;
    let altitude = C.PHY.BUS_SPEED + hmap.elev(jumpWorld.x, jumpWorld.y); // altitude above sea level
    let time = 0;
    let ffDistance = 0;

    while (altitude > 0) {
        const terrainAlt = hmap.elev(x, y);
        const clearance = altitude - terrainAlt;

        // Check if should deploy
        if (clearance <= P.DEPLOY_HEIGHT) {
            break;
        }

        // Terminal velocity fall (0.1 seconds)
        const dt = 0.1;
        altitude -= P.FF_TERMINAL_V * dt;
        x += dirX * P.FF_MAX_HORIZ * WU_PER_M * dt;
        y += dirY * P.FF_MAX_HORIZ * WU_PER_M * dt;
        ffDistance += P.FF_MAX_HORIZ * dt;
        time += dt;
    }

    const deployX = x;
    const deployY = y;
    const deployAlt = altitude;

    // Glide simulation
    let gx = deployX;
    let gy = deployY;
    let gAltitude = deployAlt;
    let glideDistance = 0;
    const targetTerrain = hmap.elev(destWorld.x, destWorld.y);

    while (gAltitude > targetTerrain) {
        const dt = 0.1;
        gAltitude -= P.GL_VERT * dt;
        gx += dirX * P.GL_HORIZ * WU_PER_M * dt;
        gy += dirY * P.GL_HORIZ * WU_PER_M * dt;
        glideDistance += P.GL_HORIZ * dt;
        time += dt;

        // Safety break
        if (time > 300) break;
    }

    // Final position error
    const finalX = gx;
    const finalY = gy;
    const landingError = Math.sqrt((finalX - destWorld.x) ** 2 + (finalY - destWorld.y) ** 2);

    return {
        deployX, deployY, deployAlt,
        finalX, finalY,
        ffDistance, glideDistance, landingError,
        time,
    };
}

// Find optimal jump point on bus route
function findOptimalJump(hmap, busStart, busEnd, destWorld) {
    const P = C.PHY;

    const busLen = Coords.distWU(busStart.x, busStart.y, busEnd.x, busEnd.y);
    const busDirX = busLen > 0 ? (busEnd.x - busStart.x) / busLen : 1;
    const busDirY = busLen > 0 ? (busEnd.y - busStart.y) / busLen : 0;

    let bestJump = null;
    let bestTime = Infinity;

    // Test jump points along bus (100 samples)
    const samples = 100;
    for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        const jumpX = busStart.x + busDirX * busLen * t;
        const jumpY = busStart.y + busDirY * busLen * t;

        // Time on bus to reach this point
        const busDist = t * busLen;
        const busTime = Coords.wuToM(busDist) / P.BUS_SPEED;

        // Simulate drop from this point
        const sim = simulateDrop(hmap, { x: jumpX, y: jumpY }, destWorld);

        // Check if landing is accurate enough (within 100m)
        if (sim.landingError < Coords.mToWU(100)) {
            const totalTime = busTime + sim.time;
            if (totalTime < bestTime) {
                bestTime = totalTime;
                bestJump = {
                    x: jumpX, y: jumpY,
                    busTime, ffTime: sim.time,
                    deployX: sim.deployX, deployY: sim.deployY,
                    deployAlt: sim.deployAlt,
                };
            }
        }
    }

    return bestJump;
}

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

function calculate(hmap, dropLL, busStartLL, busEndLL, buildingHeightM = 0) {
    const P = C.PHY;

    const drop = Coords.toWorld(dropLL.lat, dropLL.lng);
    const busA = Coords.toWorld(busStartLL.lat, busStartLL.lng);
    const busB = Coords.toWorld(busEndLL.lat, busEndLL.lng);

    const terrainElev = hmap.elev(drop.x, drop.y);
    const targetElev = terrainElev + buildingHeightM;

    // Find optimal jump point
    const optimal = findOptimalJump(hmap, busA, busB, drop);

    if (!optimal) {
        return { error: 'No valid jump point found' };
    }

    // Build paths
    const jumpWorld = { x: optimal.x, y: optimal.y };
    const deployWorld = { x: optimal.deployX, y: optimal.deployY };
    const deployAlt = optimal.deployAlt;

    const freefallPath = buildPath(jumpWorld, deployWorld, P.BUS_SPEED + hmap.elev(jumpWorld.x, jumpWorld.y), deployAlt, 20);
    const glidePath = buildPath(deployWorld, drop, deployAlt, targetElev, 20);

    return {
        jumpPoint: Coords.toLeaflet(jumpWorld.x, jumpWorld.y),
        deployPoint: Coords.toLeaflet(deployWorld.x, deployWorld.y),
        dropPoint: dropLL,

        altitudes: {
            bus: P.BUS_SPEED,
            deploy: Math.round(deployAlt),
            terrainAtDeploy: Math.round(hmap.elev(deployWorld.x, deployWorld.y)),
            terrainAtDrop: Math.round(terrainElev),
            target: Math.round(targetElev),
        },

        timing: {
            freefall: +(optimal.ffTime - optimal.busTime).toFixed(2), // actual ff time
            bus: +optimal.busTime.toFixed(2),
            total: +optimal.time.toFixed(2),
        },

        distances: {
            freefallM: Math.round(optimal.ffTime * P.FF_MAX_HORIZ),
            glideM: Math.round((optimal.time - optimal.ffTime) * P.GL_HORIZ),
            totalM: Math.round(optimal.time * P.GL_HORIZ),
        },

        paths: {
            freefall: freefallPath,
            glide: glidePath,
            full: [...freefallPath, ...glidePath.slice(1)],
        },

        worldCoords: {
            jump: { x: Math.round(jumpWorld.x), y: Math.round(jumpWorld.y) },
            deploy: { x: Math.round(deployWorld.x), y: Math.round(deployWorld.y) },
            drop: { x: Math.round(drop.x), y: Math.round(drop.y) },
        },
    };
}

class DropCalcEngine {
    constructor() {
        this.hmap = new Heightmap();
        this.ready = false;
    }

    async init(url) {
        await this.hmap.load(url);
        this.ready = true;
        console.log('DropCalcEngine v8 ready (physics simulation)');
    }

    calculate(dropPoint, busStart, busEnd, buildingHeightM = 0) {
        if (!this.ready) throw new Error('Call await engine.init(url) first');
        return calculate(this.hmap, dropPoint, busStart, busEnd, buildingHeightM);
    }

    getElevation(lat, lng) {
        return Math.round(this.hmap.elevLL(lat, lng));
    }

    isReady() {
        return this.ready;
    }
}

window.DropCalcEngine = DropCalcEngine;