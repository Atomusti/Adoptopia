import React from 'react';
import { Family, SHELTER_POSITION, GRID_SIZE, Position } from '@/lib/gameData';
import { useVehicleAnimation } from '@/lib/useVehicleAnimation';

export interface GameVehicle {
  id: string;
  path: Position[];
  animalEmoji: string;
  familyId: string;
}

export interface GameMapProps {
  families?: Family[];
  vehicles?: GameVehicle[];
  assignedFamilyIds?: string[];
  celebrations?: Position[];
  hintedFamilyId?: string | null;
  onVehicleComplete?: (vehicle: GameVehicle) => void;
}

const AnimatedVehicle = ({ vehicle, onComplete }: { vehicle: GameVehicle, onComplete: () => void }) => {
  const { currentPosition } = useVehicleAnimation(vehicle.path, onComplete);
  const pixelX = currentPosition.x * 52 + 26;
  const pixelY = currentPosition.y * 52 + 26;

  return (
    <div 
      className="absolute z-[100] flex items-center justify-center bg-[#0a0f1e] border border-[#ff00ff] shadow-[0_0_15px_rgba(255,0,255,0.55)] rounded-[4px] px-1.5 py-0.5 text-xs font-mono text-[#ff00ff]"
      style={{ 
        left: `${pixelX}px`, 
        top: `${pixelY}px`,
        transform: 'translate(-50%, -50%)',
        transition: 'all 0.4s linear',
        width: 'max-content'
      }}
    >
      [PLD]
    </div>
  );
};

export default function GameMap({ 
  families = [], 
  vehicles = [], 
  assignedFamilyIds = [],
  celebrations = [],
  hintedFamilyId = null,
  onVehicleComplete = () => {}
}: GameMapProps) {
  const cells = [];

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const isShelter = x === SHELTER_POSITION.x && y === SHELTER_POSITION.y;
      const family = families.find(f => f.gridPosition.x === x && f.gridPosition.y === y);
      const isAssigned = family ? assignedFamilyIds.includes(family.id) : false;
      const isCelebrating = celebrations.some(c => c.x === x && c.y === y);

      let cellStyle = 'bg-[#0b0f19] border-cyan-900/50';

      const isHintTargetCell = Boolean(
        family && hintedFamilyId && family.id === hintedFamilyId
      );

      cells.push(
        <div
          key={`${x}-${y}`}
          className={`relative w-[52px] h-[52px] border ${cellStyle} overflow-hidden ${isHintTargetCell ? 'hint-cell-overlay border-cyan-400/80 z-[15]' : ''}`}
        >
          {/* Faint circuit-like background lines within empty cells */}
          {!isShelter && !family && (
             <div className="absolute inset-0 opacity-[0.05] flex items-center justify-center">
                <div className="w-[1px] h-full bg-cyan-500"></div>
                <div className="h-[1px] w-full bg-cyan-500 absolute"></div>
             </div>
          )}

          {isShelter && (
             <div className="absolute inset-0 flex items-center justify-center text-amber-400 drop-shadow-[0_0_10px_#f59e0b] text-xl z-20">
               🏠
             </div>
          )}

          {family && !isShelter && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-1">
              {hintedFamilyId === family.id && (
                <div className="pointer-events-none absolute inset-0 z-[25] rounded-sm ring-2 ring-cyan-400/90 shadow-[0_0_18px_rgba(0,255,255,0.45)] animate-[hintPulse_1s_ease-in-out_infinite]" />
              )}
              {hintedFamilyId === family.id && (
                 <div className="absolute top-0.5 right-0.5 z-50 text-[11px] leading-none text-cyan-300 font-bold drop-shadow-[0_0_6px_#00ffff]">◈</div>
              )}
              <div className={`
                relative flex items-center justify-center w-8 h-8 rounded border border-fuchsia-500/50 bg-[#0b0f19] shadow-[0_0_10px_#d946ef]
                ${isCelebrating ? 'scale-125 bg-amber-900 border-amber-400 shadow-[0_0_20px_gold] transition-all' : ''}
                ${isAssigned && !isCelebrating ? 'opacity-20' : ''}
                ${hintedFamilyId === family.id ? 'hint-glow scale-110 !border-cyan-400 bg-cyan-950/40' : ''}
              `}>
                <span className="text-xl drop-shadow-[0_0_8px_#d946ef]">{family.emoji}</span>
              </div>
            </div>
          )}
        </div>
      );
    }
  }

  const calculatePoints = (path: Position[]) => {
    return path.map(p => `${p.x * 52 + 26},${p.y * 52 + 26}`).join(' ');
  };

  return (
    <div className="flex flex-col gap-2 relative">
      <div className="text-cyan-600 font-mono text-sm tracking-widest pl-1 mb-2">CITY MAP - NODE GRID 10x10</div>
      
      <div 
        className="relative grid grid-cols-10 grid-rows-10 outline outline-2 outline-cyan-800 shadow-[0_0_30px_rgba(6,182,212,0.1)] bg-[#0b0f19] p-[2px]"
        style={{ width: 'max-content' }}
      >
        {/* Background Grid Pattern Underneath */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.15] bg-[linear-gradient(rgba(6,182,212,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.3)_1px,transparent_1px)] bg-[size:26px_26px]" />
        
        {cells}

        {/* Polylines for glowing routes */}
        {vehicles.map(v => (
          <svg key={`route-${v.id}`} className="absolute inset-0 z-[80] pointer-events-none" width="520" height="520">
             <polyline 
               points={calculatePoints(v.path)}
               fill="none" 
               stroke="#a855f7" 
               strokeWidth="4"
               strokeLinejoin="round"
               strokeLinecap="round"
               className="drop-shadow-[0_0_10px_#a855f7]"
             />
             <circle cx={calculatePoints([v.path[v.path.length-1]]).split(',')[0]} cy={calculatePoints([v.path[v.path.length-1]]).split(',')[1]} r="4" fill="#a855f7" className="drop-shadow-[0_0_10px_#a855f7]" />
          </svg>
        ))}

        {vehicles.map(v => (
          <AnimatedVehicle key={v.id} vehicle={v} onComplete={() => onVehicleComplete(v)} />
        ))}
      </div>
    </div>
  );
}
