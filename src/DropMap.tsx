import { useEffect, useState, ReactNode } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Activity, Trash2, Bus, Timer } from 'lucide-react';

const TILE_URL = 'https://dropmazter.com/wp-content/themes/astra/in_house_maps/40.20/{z}/{x}/{y}.webp';

// Icons
const createIcon = (color: string) => L.divIcon({
  className: 'custom-icon',
  html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px ${color};"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const dropIcon = createIcon('#a855f7'); // purple
const busIcon = createIcon('#fbbf24'); // yellow
const jumpIcon = createIcon('#2dd4bf'); // teal
const deployIcon = createIcon('#f472b6'); // pink

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
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  useEffect(() => {
    async function initEngine() {
      try {
        let retries = 0;
        while (!window.DropCalcEngine && retries < 10) {
          await new Promise(r => setTimeout(r, 100));
          retries++;
        }

        if (window.DropCalcEngine) {
          window.engineInstance = new window.DropCalcEngine();
          await window.engineInstance.init('/heightmap.bin');
          setEngineReady(true);
        } else {
          setEngineError('Engine missing.');
        }
      } catch (err: any) {
        setEngineError('Init failed.');
      }
    }
    initEngine();
  }, []);

  useEffect(() => {
    if (dropDest && busStart && busEnd && engineReady && window.engineInstance) {
      try {
        const res = window.engineInstance.calculate(dropDest, busStart, busEnd, buildingHeight);
        setResult(res);
      } catch (err) {
        console.error("Calculation error:", err);
      }
    } else {
      setResult(null);
    }
  }, [dropDest, busStart, busEnd, buildingHeight, engineReady]);

  const handleMapClick = (latlng: L.LatLng) => {
    if (dropDest && busStart && busEnd) {
      return;
    }
    if (!dropDest) setDropDest(latlng);
    else if (!busStart) setBusStart(latlng);
    else if (!busEnd) setBusEnd(latlng);
  };

  const getStepText = () => {
    if (!dropDest) return "Place Drop Destination (Purple)";
    if (!busStart) return "Place Bus Start (Yellow)";
    if (!busEnd) return "Place Bus End (Yellow)";
    return "Route Calculated (Clear to restart)";
  };

  const getBusArrowMarkers = (start: L.LatLng, end: L.LatLng) => {
    const points = [];
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;
    const totalDist = Math.sqrt(dx * dx + dy * dy);
    
    // Angle: dx>0 is right, dy>0 is physically "up" on screen (since y=-lat). 
    // Wait, Leaflet CRS.Simple: lat decreases as you go down. Wait...
    // The tile bounds are [-256, 0] to [0, 256]. 
    // Top-left is [0,0], bottom-right is [-256, 256].
    // So visual Y goes down as lat goes negative.
    // If end.lat < start.lat, it means we are moving DOWN the screen.
    // Visual Y = -lat.
    const visualDy = -(end.lat - start.lat);
    const angle = Math.atan2(visualDy, dx) * 180 / Math.PI;

    const numArrows = Math.floor(totalDist / 12); 
    for (let i = 1; i <= numArrows; i++) {
        const t = i / (numArrows + 1);
        points.push({
            lat: start.lat + dy * t,
            lng: start.lng + dx * t,
            angle
        });
    }
    return points;
  };

  return (
    <div className="relative w-full h-screen bg-[#101c26] text-[#e2d5f8] overflow-hidden font-sans">
      <MapContainer
        crs={L.CRS.Simple}
        bounds={[[-256, 0], [0, 256]]}
        maxBounds={[[-256, 0], [0, 256]]}
        maxBoundsViscosity={1.0}
        zoom={2}
        minZoom={1}
        maxZoom={8}
        zoomControl={false}
        className="absolute inset-0 z-0 bg-[#101c26]"
      >
        <TileLayer
          url={TILE_URL}
          tileSize={256}
          noWrap={true}
          maxNativeZoom={5}
          maxZoom={8}
          bounds={[[-256, 0], [0, 256]]}
        />
        <MapEvents onMapClick={handleMapClick} />

        {dropDest && <Marker position={dropDest} icon={dropIcon} />}
        {busStart && <Marker position={busStart} icon={busIcon} />}
        {busEnd && <Marker position={busEnd} icon={busIcon} />}

        {busStart && busEnd && (
          <>
            <Polyline positions={[busStart, busEnd]} color="#06b6d4" weight={4} opacity={0.8} />
            {getBusArrowMarkers(busStart, busEnd).map((pos, i) => (
              <Marker 
                key={i}
                position={pos} 
                icon={L.divIcon({
                  className: 'bus-arrow-icon',
                  html: `<svg style="transform: rotate(${pos.angle}deg); display: block;" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
                })} 
              />
            ))}
          </>
        )}

        {result && (
          <>
            {result.paths?.freefall && (
              <Polyline positions={result.paths.freefall} color="#2dd4bf" weight={2} dashArray="6, 6" />
            )}
            {result.paths?.glide && (
              <Polyline positions={result.paths.glide} color="#a855f7" weight={3} />
            )}
            {result.jumpPoint && <Marker position={result.jumpPoint} icon={jumpIcon} />}
            {result.deployPoint && <Marker position={result.deployPoint} icon={deployIcon} />}
          </>
        )}
      </MapContainer>

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none z-[999] p-4 md:p-6 flex flex-col justify-between">
        
        {/* Top Area: Controls Container */}
        <div className="flex justify-between items-start">
          
          {/* Left Buttons */}
          <div className="flex flex-col gap-2 pointer-events-auto">
            <button 
              onClick={() => { setDropDest(null); setBusStart(null); setBusEnd(null); setResult(null); }}
              className="bg-[#150a21]/90 hover:bg-[#25123b] backdrop-blur-md border border-purple-500/20 text-purple-200 px-3 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all shadow-[0_0_10px_rgba(168,85,247,0.05)] flex items-center gap-2 w-28"
            >
              <Trash2 className="w-3.5 h-3.5 text-purple-400" /> Clear All
            </button>
            <button 
              onClick={() => { setBusStart(null); setBusEnd(null); setResult(null); }}
              className="bg-[#150a21]/90 hover:bg-[#25123b] backdrop-blur-md border border-purple-500/20 text-purple-200 px-3 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all shadow-[0_0_10px_rgba(168,85,247,0.05)] flex items-center gap-2 w-28"
            >
              <Bus className="w-3.5 h-3.5 text-purple-400" /> Clear Bus
            </button>
          </div>

          {/* Engine Status Indicators */}
          <div className="flex flex-col items-end gap-2 text-right">
             {!engineReady && !engineError && (
              <div className="bg-[#150a21]/80 border border-purple-500/20 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-2">
                 <Activity className="w-3 h-3 animate-spin text-purple-400" />
                 <span className="text-[9px] font-bold text-purple-300 tracking-wider uppercase">Engine Init</span>
              </div>
            )}
            {engineError && (
               <div className="bg-[#240b12]/80 border border-red-500/20 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-2 text-red-400">
                 <AlertTriangle className="w-3 h-3" />
                 <span className="text-[9px] font-bold tracking-wider uppercase">{engineError}</span>
               </div>
            )}
          </div>
        </div>

        {/* Bottom Area */}
        <div className="flex flex-col flex-wrap md:flex-row justify-between items-end gap-4 mt-auto">
          
          {/* Bottom Left: Results / Stats */}
          {result ? (
            <div className="bg-[#150a21]/95 backdrop-blur-xl border border-purple-500/20 rounded-xl shadow-2xl p-4 pointer-events-auto w-full md:w-56 mb-4 md:mb-0">
              <div className="flex justify-between items-start mb-3 pb-3 border-b border-purple-500/10">
                <div className="flex items-center gap-2">
                  <div className="bg-purple-500/20 text-purple-300 p-2 rounded-lg border border-purple-500/20">
                    <Timer className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[9px] text-purple-400 font-bold uppercase tracking-widest leading-tight">Ideal Drop</div>
                    <div className="text-white font-mono text-lg leading-none">{formatTimeOrVal(result.timing?.total)}</div>
                  </div>
                </div>
                {result.hasObstacle && (
                  <div className="bg-red-500/20 text-red-400 p-1 rounded border border-red-500/20">
                    <AlertTriangle className="w-3 h-3" />
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <StatRow label="Jump Time" value={formatTimeOrVal(result.timing?.jump)} highlight />
                <StatRow label="Freefall" value={formatDist(result.distances?.freefallHorizM)} />
                <StatRow label="Glide Dist" value={formatDist(result.distances?.glideHorizM)} />
                <StatRow label="Direction" value={`${formatDirection(result.glideDirection?.degrees)} ${result.glideDirection?.cardinal || ''}`} />
              </div>
            </div>
          ) : (
            <div className="hidden md:block w-56"></div>
          )}

          {/* Bottom Center: Prompt */}
          <div className="pointer-events-auto static md:absolute md:left-1/2 md:-translate-x-1/2 md:bottom-6 w-full md:w-auto mb-4 md:mb-0">
            <div className="bg-[#150a21]/90 backdrop-blur-xl border border-purple-500/20 px-4 py-2 rounded-full shadow-lg flex justify-center items-center">
              <p className="text-[10px] uppercase tracking-widest text-purple-200 font-bold opacity-80">{getStepText()}</p>
            </div>
          </div>

          {/* Bottom Right: Height Slider */}
          <div className="bg-[#150a21]/95 backdrop-blur-xl border border-purple-500/20 p-4 rounded-xl shadow-2xl pointer-events-auto w-full md:w-56">
            <label className="flex justify-between items-center mb-3">
              <span className="text-[9px] text-purple-400 font-bold uppercase tracking-widest">Bldg Ht</span>
              <span className="text-purple-100 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded text-xs font-mono shadow-sm">
                {buildingHeight}m
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="50"
              value={buildingHeight}
              onChange={(e) => setBuildingHeight(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-black/50 rounded-lg appearance-none cursor-pointer border border-purple-500/20 accent-[#a855f7]"
            />
          </div>
          
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, highlight = false }: { label: string, value: string, highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg border border-white/5">
      <span className="text-[11px] text-purple-300/80 font-bold tracking-wider uppercase">{label}</span>
      <span className={`text-sm font-mono ${highlight ? 'text-purple-200 font-bold' : 'text-purple-100/80'}`}>{value}</span>
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
  if (typeof val === 'number') return val.toFixed(1) + '°';
  return String(val);
}

declare global {
  interface Window {
    DropCalcEngine: any;
    engineInstance: any;
  }
}

