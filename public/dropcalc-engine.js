/**
 * Fortnite Drop Calculator Engine v9 (Fixed Coordinates)
 */

const C = {
    MAP: {
        WORLD_W: 30000,
        WORLD_H: 30000,
        M_PER_WU: 3.84,
        WU_PER_M: 0.260416667,
    },
    HM: {
        W: 2033, H: 2033,
        RAW_SEA_LEVEL: 679,
        METERS_PER_UNIT: 0.015198,
    },
    PHY: {
        BUS_SPEED: 75,
        FF_TERMINAL_V: 75,
        FF_MAX_HORIZ: 51,
        GL_HORIZ: 70,
        GL_VERT: 6.5,
        DEPLOY_HEIGHT: 100,
    },
};

const Coords = {
    toWorld(lat, lng) {
        return {
            x: (lng / 256) * 30000,
            y: ((lat + 256) / 256) * 30000,
        };
    },
    toLeaflet(x, y) {
        return {
            lat: -256 + (y / 30000) * 256,
            lng: (x / 30000) * 256,
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
        const fx = (wx / 30000) * this.w;
        const fy = (wy / 30000) * this.h;
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

function simulateDrop(hmap, jumpWorld, destWorld) {
    const P = C.PHY;
    const WU_PER_M = C.MAP.WU_PER_M;

    const dx = destWorld.x - jumpWorld.x;
    const dy = destWorld.y - jumpWorld.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dirX = dist > 0 ? dx / dist : 0;
    const dirY = dist > 0 ? dy / dist : 0;

    let x = jumpWorld.x;
    let y = jumpWorld.y;
    let altitude = C.PHY.BUS_SPEED + hmap.elev(jumpWorld.x, jumpWorld.y);
    let time = 0;
    let ffDistance = 0;

    while (altitude > 0) {
        const terrainAlt = hmap.elev(x, y);
        const clearance = altitude - terrainAlt;

        if (clearance <= P.DEPLOY_HEIGHT) break;

        const dt = 0.1;
        altitude -= P.FF_TERMINAL_V * dt;
        x += dirX * P.FF_MAX_HORIZ * WU_PER_M * dt;
        y += dirY * P.FF_MAX_HORIZ * WU_PER_M * dt;
        ffDistance += P.FF_MAX_HORIZ * dt;
        time += dt;

        if (time > 300) break;
    }

    const deployX = x, deployY = y, deployAlt = altitude;

    let gx = deployX, gy = deployY;
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

        if (time > 300) break;
    }

    const landingError = Math.sqrt((gx - destWorld.x) ** 2 + (gy - destWorld.y) ** 2);

    return {
        deployX, deployY, deployAlt,
        finalX: gx, finalY: gy,
        ffDistance, glideDistance, landingError,
        time,
    };
}

function findOptimalJump(hmap, busStart, busEnd, destWorld) {
    const P = C.PHY;
    const busLen = Coords.distWU(busStart.x, busStart.y, busEnd.x, busEnd.y);
    const busDirX = busLen > 0 ? (busEnd.x - busStart.x) / busLen : 1;
    const busDirY = busLen > 0 ? (busEnd.y - busStart.y) / busLen : 0;

    let bestJump = null;
    let bestTime = Infinity;

    for (let i = 1; i <= 100; i++) {
        const t = i / 100;
        const jumpX = busStart.x + busDirX * busLen * t;
        const jumpY = busStart.y + busDirY * busLen * t;

        const busDist = t * busLen;
        const busTime = Coords.wuToM(busDist) / P.BUS_SPEED;

        const sim = simulateDrop(hmap, { x: jumpX, y: jumpY }, destWorld);

        if (sim.landingError < Coords.mToWU(500)) {
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

    const optimal = findOptimalJump(hmap, busA, busB, drop);

    if (!optimal) {
        return { error: 'No valid jump point found' };
    }

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
            freefall: +(optimal.ffTime).toFixed(2),
            bus: +optimal.busTime.toFixed(2),
            total: +(optimal.busTime + optimal.ffTime).toFixed(2),
        },
        distances: {
            freefallM: Math.round(optimal.ffTime * P.FF_MAX_HORIZ),
            glideM: Math.round((optimal.busTime + optimal.ffTime) * P.GL_HORIZ * 0.1),
            totalM: Math.round((optimal.busTime + optimal.ffTime) * P.GL_HORIZ),
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
        console.log('DropCalcEngine v9 ready');
    }

    calculate(dropPoint, busStart, busEnd, buildingHeightM = 0) {
        if (!this.ready) throw new Error('Call await engine.init(url) first');
        return calculate(this.hmap, dropPoint, busStart, busEnd, buildingHeightM);
    }

    getElevation(lat, lng) {
        return Math.round(this.hmap.elevLL(lat, lng));
    }

    isReady() { return this.ready; }
}

window.DropCalcEngine = DropCalcEngine;