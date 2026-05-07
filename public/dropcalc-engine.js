/**
 * Fortnite Drop Calculator Engine v13 (3000x3000 World)
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
        BUS_ALT: 832,
        FF_ACCEL: 9.8,
        FF_TERMINAL_V: 75,
        FF_MAX_HORIZ: 51,
        GL_HORIZ: 70,
        GL_VERT: 6.5,
        DEPLOY_HEIGHT: 100,
    },
};

const Coords = {
    toWorld(lat, lng) {
        return { x: (lng / 256) * 3000, y: ((lat + 256) / 256) * 3000 };
    },
    toLeaflet(x, y) {
        return { lat: -256 + (y / 3000) * 256, lng: (x / 3000) * 256 };
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
        console.log(`Heightmap: ${this.w}x${this.h}`);
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

function checkReachable(hmap, busStart, busEnd, dest) {
    const P = C.PHY;
    const M_PER_WU = C.MAP.M_PER_WU;

    const terrainAtDest = hmap.elev(dest.x, dest.y);
    const busLen = Coords.distWU(busStart.x, busStart.y, busEnd.x, busEnd.y);
    const distToBus = Math.abs(dest.y - busStart.y);

    const maxAltDrop = P.BUS_ALT - terrainAtDest - P.DEPLOY_HEIGHT;
    const glideTime = Math.max(0, maxAltDrop / P.GL_VERT);
    const maxGlideDist = glideTime * P.GL_HORIZ;
    const maxFFDist = (P.BUS_ALT / P.FF_TERMINAL_V) * P.FF_MAX_HORIZ;
    const maxTotalDist = (maxFFDist + maxGlideDist) / M_PER_WU;

    return { terrainAtDest, distToBus, maxTotalDist, reachable: distToBus < maxTotalDist };
}

function simulateDrop(hmap, jumpWorld, destWorld) {
    const P = C.PHY;
    const WU_PER_M = C.MAP.WU_PER_M;
    const DT = 0.05;

    let x = jumpWorld.x;
    let y = jumpWorld.y;
    let altitude = P.BUS_ALT;
    let vertVel = 0;
    let state = 'FREEFALL';
    let time = 0;
    let ffDistance = 0;
    let glDistance = 0;
    const path = [{ x, y, alt: altitude, state }];
    const targetTerrain = hmap.elev(destWorld.x, destWorld.y);

    while (time < 300) {
        const terrainAlt = hmap.elev(x, y);
        const dx = destWorld.x - x;
        const dy = destWorld.y - y;
        const distToDest = Math.sqrt(dx * dx + dy * dy);

        if (distToDest < 10) break;

        const dirX = dx / distToDest;
        const dirY = dy / distToDest;

        if (state === 'FREEFALL') {
            if (altitude - terrainAlt <= P.DEPLOY_HEIGHT) {
                state = 'GLIDING';
                path.push({ x, y, alt: altitude, state });
                continue;
            }

            vertVel = Math.min(vertVel + P.FF_ACCEL * DT, P.FF_TERMINAL_V);
            altitude -= vertVel * DT;
            x += dirX * P.FF_MAX_HORIZ * WU_PER_M * DT;
            y += dirY * P.FF_MAX_HORIZ * WU_PER_M * DT;
            ffDistance += P.FF_MAX_HORIZ * DT;

        } else {
            altitude -= P.GL_VERT * DT;
            x += dirX * P.GL_HORIZ * WU_PER_M * DT;
            y += dirY * P.GL_HORIZ * WU_PER_M * DT;
            glDistance += P.GL_HORIZ * DT;

            if (altitude <= targetTerrain) {
                altitude = targetTerrain;
                break;
            }
        }

        time += DT;
        path.push({ x, y, alt: altitude, state });
    }

    return {
        deployX: path.find(p => p.state === 'GLIDING')?.x || x,
        deployY: path.find(p => p.state === 'GLIDING')?.y || y,
        deployAlt: path.find(p => p.state === 'GLIDING')?.alt || altitude,
        finalX: x, finalY: y, finalAlt: altitude,
        ffDistance, glDistance,
        landingError: Math.sqrt((x - destWorld.x) ** 2 + (y - destWorld.y) ** 2),
        time, path,
    };
}

function findOptimalJump(hmap, busStart, busEnd, destWorld) {
    const P = C.PHY;
    const busLen = Coords.distWU(busStart.x, busStart.y, busEnd.x, busEnd.y);
    const busDirX = busLen > 0 ? (busEnd.x - busStart.x) / busLen : 1;
    const busDirY = busLen > 0 ? (busEnd.y - busStart.y) / busLen : 0;

    let bestJump = null;
    let bestTime = Infinity;
    const distToBus = Math.abs(destWorld.y - busStart.y);
    const tolerance = Math.max(50, distToBus * 0.3);

    for (let i = 1; i <= 500; i++) {
        const t = i / 500;
        const jumpX = busStart.x + busDirX * busLen * t;
        const jumpY = busStart.y + busDirY * busLen * t;

        const busTime = Coords.wuToM(t * busLen) / 75;
        const sim = simulateDrop(hmap, { x: jumpX, y: jumpY }, destWorld);

        if (sim.landingError < tolerance) {
            const totalTime = busTime + sim.time;
            if (totalTime < bestTime) {
                bestTime = totalTime;
                bestJump = {
                    x: jumpX, y: jumpY, t, busTime,
                    ffTime: sim.time,
                    ffDistance: sim.ffDistance,
                    glDistance: sim.glDistance,
                    deployX: sim.deployX, deployY: sim.deployY,
                    deployAlt: sim.deployAlt,
                    landingError: sim.landingError,
                    path: sim.path,
                };
            }
        }
    }

    return bestJump;
}

function buildPathFromSim(path) {
    return path.map(p => {
        const ll = Coords.toLeaflet(p.x, p.y);
        return { lat: ll.lat, lng: ll.lng, alt: Math.round(p.alt), state: p.state };
    });
}

function calculate(hmap, dropLL, busStartLL, busEndLL, buildingHeightM = 0) {
    const P = C.PHY;

    const drop = Coords.toWorld(dropLL.lat, dropLL.lng);
    const busA = Coords.toWorld(busStartLL.lat, busStartLL.lng);
    const busB = Coords.toWorld(busEndLL.lat, busEndLL.lng);

    const terrainElev = hmap.elev(drop.x, drop.y);
    const targetElev = terrainElev + buildingHeightM;
    const reachability = checkReachable(hmap, busA, busB, drop);

    if (!reachability.reachable) {
        return {
            error: 'DESTINATION TOO FAR',
            details: {
                distanceToBus: Math.round(reachability.distToBus * 3.84) + 'm',
                maxRange: Math.round(reachability.maxTotalDist * 3.84) + 'm',
                terrainAtDrop: Math.round(reachability.terrainAtDest) + 'm',
            }
        };
    }

    const optimal = findOptimalJump(hmap, busA, busB, drop);

    if (!optimal) {
        return { error: 'NO ROUTE FOUND' };
    }

    const jumpWorld = { x: optimal.x, y: optimal.y };
    const deployWorld = { x: optimal.deployX, y: optimal.deployY };
    const freefallPath = buildPathFromSim(optimal.path.filter(p => p.state === 'FREEFALL'));
    const glidePath = buildPathFromSim(optimal.path.filter(p => p.state === 'GLIDING'));

    const dx = drop.x - deployWorld.x;
    const dy = drop.y - deployWorld.y;
    const rad = Math.atan2(dx, -dy);
    const deg = (rad * 180 / Math.PI + 360) % 360;
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

    return {
        jumpPoint: Coords.toLeaflet(jumpWorld.x, jumpWorld.y),
        deployPoint: Coords.toLeaflet(deployWorld.x, deployWorld.y),
        dropPoint: dropLL,

        altitudes: {
            bus: P.BUS_ALT,
            deploy: Math.round(optimal.deployAlt),
            terrainAtDeploy: Math.round(hmap.elev(deployWorld.x, deployWorld.y)),
            terrainAtDrop: Math.round(terrainElev),
            target: Math.round(targetElev),
        },

        timing: {
            bus: +optimal.busTime.toFixed(2),
            freefall: +optimal.ffTime.toFixed(2),
            total: +optimal.ffTime.toFixed(2),
        },

        distances: {
            freefallM: Math.round(optimal.ffDistance),
            glideM: Math.round(optimal.glDistance),
            totalM: Math.round(optimal.ffDistance + optimal.glDistance),
        },

        glideDirection: {
            degrees: Math.round(deg),
            cardinal: cardinals[Math.round(deg / 45) % 8],
        },

        paths: {
            freefall: freefallPath,
            glide: glidePath,
            full: [...freefallPath, ...glidePath],
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
        console.log('DropCalcEngine v13 ready (3000x3000)');
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