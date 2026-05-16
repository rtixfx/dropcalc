import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Activity, Trash2, Bus, Timer, XCircle, ChevronUp, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Icons
const createIcon = (color: string) => L.divIcon({
  className: 'custom-icon',
  html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 0 10px ${color};"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const dropIcon = createIcon('#ef4444'); // red
const busIcon = createIcon('#3b82f6'); // blue
const jumpIcon = createIcon('#60a5fa'); // light blue
const deployIcon = createIcon('#60a5fa');

// Map Click Handler Component
function MapEvents({ onMapClick }: { onMapClick: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    }
  });
  return null;
}

export default function DropMap() {
  const [dropDest, setDropDest] = useState<L.LatLng | null>(null);
  const [busStart, setBusStart] = useState<L.LatLng | null>(null);
  const [busEnd, setBusEnd] = useState<L.LatLng | null>(null);
  const [buildingHeight, setBuildingHeight] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  useEffect(() => {
    async function initEngine() {
      try {
        let retries = 0;
        while (!window.DropCalcEngine && retries < 20) {
          await new Promise(r => setTimeout(r, 150));
          retries++;
        }

        if (window.DropCalcEngine) {
          window.engineInstance = new window.DropCalcEngine();
          await window.engineInstance.init('/heightmap.bin');
          setEngineReady(true);
        } else {
          setEngineError('Engine script not loaded.');
        }
      } catch (err: any) {
        setEngineError('Init failed: ' + (err.message || err));
      }
    }
    initEngine();
  }, []);

  useEffect(() => {
    if (dropDest && busStart && busEnd && engineReady && window.engineInstance) {
      try {
        const res = window.engineInstance.calculate(dropDest, busStart, busEnd, buildingHeight);
        if (res.error) {
          setCalcError(res.error + (res.details?.hint ? ' — ' + res.details.hint : ''));
          setResult(null);
        } else {
          setCalcError(null);
          setResult(res);
        }
      } catch (err: any) {
        console.error("Calculation error:", err);
        setCalcError('Calculation failed: ' + (err.message || 'unknown error'));
        setResult(null);
      }
    } else {
      setResult(null);
      setCalcError(null);
    }
  }, [dropDest, busStart, busEnd, buildingHeight, engineReady]);

  const handleMapClick = (latlng: L.LatLng) => {
    if (dropDest && busStart && busEnd) {
      // Reset bus for new route, keep drop
      setBusStart(latlng);
      setBusEnd(null);
      setResult(null);
      setCalcError(null);
      return;
    }
    if (!dropDest) setDropDest(latlng);
    else if (!busStart) setBusStart(latlng);
    else if (!busEnd) setBusEnd(latlng);
  };

  const getStepText = () => {
    if (!dropDest) return "Select Drop";
    if (!busStart) return "Bus Start";
    if (!busEnd) return "Bus End";
    return "Route Ready";
  };

  const getBusArrowMarkers = (start: L.LatLng, end: L.LatLng) => {
    const points = [];
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;
    const totalDist = Math.sqrt(dx * dx + dy * dy);
    
    const visualDy = -(end.lat - start.lat);
    const angle = Math.atan2(visualDy, dx) * 180 / Math.PI;

    const numArrows = Math.max(1, Math.floor(totalDist / 6));
    for (let i = 1; i <= numArrows; i++) {
      const t = i / (numArrows + 1);
      points.push({
        lat: start.lat + dy * t,
        lng: start.lng + dx * t,
        angle,
        animDelay: i * 0.05
      });
    }
    return points;
  };

  return (
    <div className="relative w-full h-screen bg-[#0A0A0A] text-zinc-100 overflow-hidden font-sans">
      <MapContainer
        crs={L.CRS.Simple}
        bounds={[[-256, 0], [0, 256]]}
        maxBounds={[[-256, 0], [0, 256]]}
        maxBoundsViscosity={1.0}
        zoom={2}
        minZoom={2}
        maxZoom={6}
        zoomControl={false}
        className="absolute inset-0 z-0 bg-[#0A0A0A]"
      >
        <TileLayer
          url="https://fortnite.gg/maps/40.40/{z}/{x}/{y}.webp"
          tileSize={256}
          noWrap={true}
          maxNativeZoom={5}
          maxZoom={6}
          bounds={[[-256, 0], [0, 256]]}
          className="map-tiles"
        />
        <MapEvents onMapClick={handleMapClick} />

        {dropDest && <Marker position={dropDest} icon={dropIcon} />}
        {busStart && <Marker position={busStart} icon={busIcon} />}
        {busEnd && <Marker position={busEnd} icon={busIcon} />}

        {busStart && busEnd && (
          <>
            <Polyline positions={[busStart, busEnd]} color="#60A5FA" weight={2} opacity={0.4} />
            {getBusArrowMarkers(busStart, busEnd).map((pos, i) => (
              <Marker 
                key={i}
                position={pos} 
                icon={L.divIcon({
                  className: 'bus-chevron-container',
                  html: `<div style="transform: rotate(${pos.angle}deg); width: 100%; height: 100%;">
                           <svg class="bus-chevron" style="display: block; animation-delay: ${pos.animDelay}s;" viewBox="0 0 24 24" width="24" height="24">
                             <polygon points="4,2 18,12 4,22 8,12" fill="#93C5FD" />
                           </svg>
                         </div>`,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                })} 
              />
            ))}
          </>
        )}

        {result && (
          <>
            {result.paths?.freefall && result.paths.freefall.length > 1 && (
              <Polyline 
                positions={result.paths.freefall.map((p: any) => [p.lat, p.lng])} 
                color="#60A5FA" 
                weight={2.5} 
                dashArray="8, 8" 
              />
            )}
            {result.paths?.glide && result.paths.glide.length > 1 && (
              <Polyline 
                positions={result.paths.glide.map((p: any) => [p.lat, p.lng])} 
                color="#3b82f6" 
                weight={3} 
              />
            )}
            {result.jumpPoint && <Marker position={[result.jumpPoint.lat, result.jumpPoint.lng]} icon={jumpIcon} />}
            {result.deployPoint && <Marker position={[result.deployPoint.lat, result.deployPoint.lng]} icon={deployIcon} />}
          </>
        )}
      </MapContainer>

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-[999] pointer-events-auto">
        <Link to="/" className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#0A0A0A]/80 backdrop-blur-md border border-white/10 hover:bg-zinc-800 transition-colors shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
            <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
          </svg>
        </Link>
      </div>

      <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-[999] pointer-events-none w-[340px] flex flex-col gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0A0A0A]/95 backdrop-blur-3xl border border-blue-500/10 rounded-3xl p-6 pointer-events-auto flex flex-col gap-5 shadow-[0_16px_40px_rgba(0,0,0,0.8),inset_0__1px_1px_rgba(255,255,255,0.05)]"
        >
          
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500/20 to-blue-400/10 rounded-xl border border-blue-500/20 shadow-[0_0_15px_rgba(96,165,250,0.15)] flex items-center justify-center">
                <Navigation className="w-4 h-4 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-[13px] font-black text-white tracking-[0.2em] uppercase origin-left">
                  GlideCalc
                </h1>
                <span className="text-[9px] uppercase tracking-widest text-blue-500/80 font-bold mt-0.5">
                  {getStepText()}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end justify-center">
              <div className="flex items-center gap-2">
                {engineError ? (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                ) : !engineReady ? (
                  <Activity className="w-4 h-4 animate-spin text-blue-400" />
                ) : (
                  <div className="flex items-center justify-center relative w-3 h-3">
                     <div className="absolute w-full h-full rounded-full bg-blue-400/30 animate-ping"></div>
                     <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,1)]"></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setDropDest(null); setBusStart(null); setBusEnd(null); setResult(null); setCalcError(null); }}
              className="flex-1 py-3 bg-zinc-900/50 hover:bg-zinc-800/80 rounded-2xl border border-white/5 text-zinc-300 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all shadow-inner flex justify-center items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5 text-zinc-500 group-hover:text-red-400 transition-colors" /> Reset
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setBusStart(null); setBusEnd(null); setResult(null); setCalcError(null); }}
              className="flex-1 py-3 bg-gradient-to-r from-blue-500/10 to-blue-400/10 hover:from-blue-500/20 hover:to-blue-400/20 rounded-2xl border border-blue-500/20 hover:border-blue-400/40 text-blue-50 text-[10px] font-bold uppercase tracking-widest transition-all flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(96,165,250,0.05)]"
            >
              <Bus className="w-3.5 h-3.5 text-blue-400" /> New Bus
            </motion.button>
          </div>

          {/* Height Slider */}
          <div className="pt-2 px-1">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-bold flex items-center gap-2">
                Drop Target <span className="w-1 h-1 rounded-full bg-zinc-700"></span> Height
              </span>
              <span className="text-xs font-mono text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">+{buildingHeight}m</span>
            </div>
            <div className="relative w-full h-8 flex items-center">
              <div className="absolute inset-x-0 h-1.5 bg-zinc-800/80 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full" style={{ width: `${(buildingHeight / 50) * 100}%` }}></div>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={buildingHeight}
                onChange={(e) => setBuildingHeight(parseInt(e.target.value, 10))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div 
                className="absolute h-4 w-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5),0_2px_4px_rgba(0,0,0,0.5)] pointer-events-none transition-transform" 
                style={{ left: `calc(${(buildingHeight / 50) * 100}% - 8px)` }}
              ></div>
            </div>
          </div>

          {/* Error Display */}
          <AnimatePresence>
            {calcError && (
              <motion.div 
                initial={{ opacity: 0, height: 0, y: -10 }} 
                animate={{ opacity: 1, height: 'auto', y: 0 }} 
                exit={{ opacity: 0, height: 0, y: -10 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-2.5 bg-red-500/15 border border-red-500/30 rounded-xl p-3 mt-1">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[10px] text-red-200 uppercase tracking-widest font-semibold leading-relaxed">{calcError}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Display */}
          <AnimatePresence>
            {result && !result.error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-4 mt-1 border-t border-white/10 pt-4 overflow-hidden"
              >
                {/* Total Time & Breakdown */}
                <div className="flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-1.5 flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-blue-400" /> Ideal Drop
                    </span>
                    <span className="text-3xl font-mono font-light text-white leading-none">
                      {formatTimeOrVal(result.timing?.total)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[10px] font-mono text-zinc-500">
                    <span>Bus: <span className="text-zinc-200">{formatTimeOrVal(result.timing?.bus)}</span></span>
                    <span>Dive: <span className="text-zinc-200">{formatTimeOrVal(result.timing?.freefall)}</span></span>
                    <span>Glide: <span className="text-zinc-200">{formatTimeOrVal(result.timing?.glide)}</span></span>
                  </div>
                </div>

                {/* Distances & Direction grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center bg-zinc-900/40 rounded-xl py-3 border border-white/5 shadow-inner">
                    <span className="text-[8px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-1">Freefall</span>
                    <span className="text-xs font-mono text-zinc-200 font-medium">{formatDist(result.distances?.freefallM)}</span>
                  </div>
                  <div className="flex flex-col items-center bg-zinc-900/40 rounded-xl py-3 border border-white/5 shadow-inner">
                    <span className="text-[8px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-1">Glide</span>
                    <span className="text-xs font-mono text-zinc-200 font-medium">{formatDist(result.distances?.glideM)}</span>
                  </div>
                  <div className="flex flex-col items-center bg-gradient-to-br from-blue-500/10 to-blue-400/5 rounded-xl py-3 border border-blue-500/20 shadow-inner">
                    <span className="text-[8px] uppercase tracking-[0.2em] text-blue-500 font-bold mb-1">Heading</span>
                    <span className="text-xs font-mono text-blue-400 font-bold">{formatDirection(result.glideDirection?.degrees)} {result.glideDirection?.cardinal || ''}</span>
                  </div>
                </div>

                {/* Dive Angle Info */}
                {result.dive && (
                  <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 bg-zinc-900/40 rounded-xl border border-white/5 px-4 py-3 shadow-inner">
                    <span>Angle <strong className="text-zinc-200 font-normal">{result.dive.angle?.toFixed(1)}°</strong></span>
                    <span>Vx <strong className="text-zinc-200 font-normal">{result.dive.horizSpeed?.toFixed(0)}m/s</strong></span>
                    <span>Vz <strong className="text-zinc-200 font-normal">{result.dive.vertSpeed?.toFixed(0)}m/s</strong></span>
                  </div>
                )}

                {/* Deploy Recommendation */}
                {result.deploy && (
                  <div className={`rounded-xl p-3 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 font-bold transition-all ${
                    result.deploy.isEarly 
                      ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400' 
                      : 'bg-blue-500/15 border border-blue-500/40 text-blue-400'
                  }`}>
                    <ChevronUp className={`w-4 h-4 ${result.deploy.isEarly ? 'text-amber-400' : 'text-blue-400'}`} />
                    {result.deploy.isEarly 
                      ? `Early Pop: ${result.deploy.height}m` 
                      : `Auto Deploy (${result.deploy.height}m)`
                    }
                  </div>
                )}

                {/* Terrain Obstacle */}
                {result.hasObstacle && (
                  <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-2.5 text-[10px] text-red-400 uppercase tracking-widest flex items-center justify-center gap-2 font-bold shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                    <AlertTriangle className="w-4 h-4" /> Terrain Obstacle
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </div>
    </div>
  );
}

// Helpers
function formatTimeOrVal(val: any): string {
  if (val === undefined || val === null) return "--";
  if (typeof val === 'number') return val.toFixed(1) + 's';
  return String(val);
}
function formatDist(val: any): string {
  if (val === undefined || val === null) return "--";
  if (typeof val === 'number') return val.toFixed(0) + 'm';
  return String(val);
}
function formatDirection(val: any): string {
  if (val === undefined || val === null) return "--";
  if (typeof val === 'number') return val.toFixed(0) + '°';
  return String(val);
}

declare global {
  interface Window {
    DropCalcEngine: any;
    engineInstance: any;
  }
}
