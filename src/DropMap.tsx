import { useEffect, useState, ReactNode } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Activity, Trash2, Bus, Timer } from 'lucide-react';

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
      setBusStart(latlng);
      setBusEnd(null);
      setResult(null);
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
    
    // Y visual direction
    const visualDy = -(end.lat - start.lat);
    const angle = Math.atan2(visualDy, dx) * 180 / Math.PI;

    const numArrows = Math.floor(totalDist / 6); 
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
    <div className="relative w-full h-screen bg-[#0b1d2e] text-[#e2d5f8] overflow-hidden font-sans">
      <MapContainer
        crs={L.CRS.Simple}
        bounds={[[-256, 0], [0, 256]]}
        maxBounds={[[-256, 0], [0, 256]]}
        maxBoundsViscosity={1.0}
        zoom={2}
        minZoom={2}
        maxZoom={6}
        zoomControl={false}
        className="absolute inset-0 z-0 bg-[#0b1d2e]"
      >
        <TileLayer
  url="https://fortnite.gg/maps/40.30/{z}/{x}/{y}.webp"
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
            <Polyline positions={[busStart, busEnd]} color="#00e5ff" weight={2} opacity={0.3} />
            {getBusArrowMarkers(busStart, busEnd).map((pos, i) => (
              <Marker 
                key={i}
                position={pos} 
                icon={L.divIcon({
                  className: 'bus-chevron-container',
                  html: `<svg class="bus-chevron" style="transform: rotate(${pos.angle}deg); display: block; animation-delay: ${pos.animDelay}s;" viewBox="0 0 24 24" width="24" height="24">
                           <polygon points="4,2 18,12 4,22 8,12" fill="#00e5ff" />
                         </svg>`,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                })} 
              />
            ))}
          </>
        )}

        {result && (
  <>
    {result.paths?.freefall && (
      <Polyline 
        positions={result.paths.freefall.map(p => [p.lat, p.lng])} 
        color="#2dd4bf" 
        weight={2} 
        dashArray="6, 6" 
      />
    )}
    {result.paths?.glide && (
      <Polyline 
        positions={result.paths.glide.map(p => [p.lat, p.lng])} 
        color="#a855f7" 
        weight={3} 
      />
    )}
    {result.jumpPoint && <Marker position={[result.jumpPoint.lat, result.jumpPoint.lng]} icon={jumpIcon} />}
    {result.deployPoint && <Marker position={[result.deployPoint.lat, result.deployPoint.lng]} icon={deployIcon} />}
  </>
)}
      </MapContainer>

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 z-[999] pointer-events-none w-[260px] flex flex-col gap-2 font-sans">
        <div className="bg-[#0b0c10]/80 backdrop-blur-md border border-purple-500/30 rounded-xl p-3 pointer-events-auto flex flex-col gap-3 shadow-2xl">
          
          {/* Header */}
          <div className="flex justify-between items-center pb-2 border-b border-purple-500/20">
            <div className="flex items-center gap-2">
              <h1 className="text-[11px] font-bold text-white tracking-[0.2em] uppercase">Dropmazter</h1>
              {engineError ? (
                <AlertTriangle className="w-3 h-3 text-red-500" />
              ) : !engineReady ? (
                <Activity className="w-3 h-3 animate-spin text-purple-400" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_5px_#a855f7]"></div>
              )}
            </div>
            <div className="text-[9px] uppercase tracking-widest text-purple-300 font-semibold">
              {getStepText()}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button 
              onClick={() => { setDropDest(null); setBusStart(null); setBusEnd(null); setResult(null); }}
              className="flex-1 py-1.5 bg-purple-900/20 hover:bg-purple-900/40 rounded-md border border-purple-500/20 text-purple-100 text-[9px] uppercase tracking-wider transition-colors flex justify-center items-center gap-1.5"
            >
              <Trash2 className="w-3 h-3" /> Reset
            </button>
            <button 
              onClick={() => { setBusStart(null); setBusEnd(null); setResult(null); }}
              className="flex-1 py-1.5 bg-purple-900/20 hover:bg-purple-900/40 rounded-md border border-purple-500/20 text-purple-100 text-[9px] uppercase tracking-wider transition-colors flex justify-center items-center gap-1.5"
            >
              <Bus className="w-3 h-3" /> New Bus
            </button>
          </div>

          {/* Height Slider */}
          <div className="pt-1.5">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[9px] uppercase tracking-wider text-purple-300/80 font-medium">Target Height</span>
              <span className="text-[9px] font-mono text-purple-200">+{buildingHeight}m</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={buildingHeight}
              onChange={(e) => setBuildingHeight(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
            />
          </div>

          {/* Results Display */}
          {result && (
            <div className="flex flex-col gap-2 pt-3 border-t border-purple-500/20">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase tracking-wider text-purple-200 font-bold flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-purple-400" /> Ideal Drop
                </span>
                <span className="text-xl font-mono font-light text-white leading-none">
                  {formatTimeOrVal(result.timing?.total)}
                </span>
              </div>
              
              <div className="flex justify-between text-[9px] font-mono text-purple-200/80 bg-purple-900/20 rounded border border-purple-500/10 px-2 py-1.5 mt-1">
                <span>FF: {formatDist(result.distances?.freefallHorizM || result.distances?.freefallHoriz)}</span>
                <span>GL: {formatDist(result.distances?.glideHorizM || result.distances?.glideHoriz)}</span>
                <span>{formatDirection(result.glideDirection?.degrees)} {result.glideDirection?.cardinal || ''}</span>
              </div>

              {result.hasObstacle && (
                <div className="mt-1 bg-red-500/10 border border-red-500/20 rounded p-1.5 text-[9px] text-red-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" /> Terrain Obstacle
                </div>
              )}
            </div>
          )}
        </div>
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
  if (typeof val === 'number') return val.toFixed(1) + '°';
  return String(val);
}

declare global {
  interface Window {
    DropCalcEngine: any;
    engineInstance: any;
  }
}