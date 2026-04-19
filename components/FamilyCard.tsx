import React from 'react';
import { Family } from '@/lib/gameData';

interface FamilyCardProps {
  family: Family;
  isSelected?: boolean;
  isAssigned?: boolean;
  isHinted?: boolean;
  isCompact?: boolean;
  showSpaceInfo?: boolean;
  onClick?: () => void;
}

export default function FamilyCard({
  family,
  isSelected = false,
  isAssigned = false,
  isHinted = false,
  isCompact = false,
  showSpaceInfo = false,
  onClick,
}: FamilyCardProps) {
  const getTraits = () => {
    const traits = [];
    traits.push({
      text: `TARGET GRID [${family.gridPosition.x.toString().padStart(2, '0')}, ${family.gridPosition.y.toString().padStart(2, '0')}]`,
      alert: false,
    });

    if (family.hasAllergy) {
      traits.push({ text: 'CAUTION: SENSITIVITIES', alert: true });
    }

    traits.push({ text: `MAX NOISE: LV${family.noiseLimit}`, alert: false });
    traits.push({ text: `NRG MATCH: LV${family.energyMatch}`, alert: false });

    return traits;
  };

  if (isCompact) {
    return (
      <div
        onClick={!isAssigned ? onClick : undefined}
        className={`
          relative w-full p-2 rounded-[4px] border transition-all duration-200 select-none flex flex-col font-mono text-[10px] tracking-wider
          ${isHinted ? 'hint-glow' : ''}
          ${isAssigned ? 'opacity-30 grayscale cursor-not-allowed border-slate-800 bg-black' : 'cursor-pointer hover:bg-fuchsia-900/20 backdrop-blur-sm'}
          ${isSelected && !isAssigned && !isHinted ? 'border-[#ff00ff] bg-fuchsia-950/40 shadow-[inset_0_0_12px_rgba(255,0,255,0.2),_0_0_8px_rgba(255,0,255,0.35)]' : !isHinted ? 'border-[rgba(0,255,255,0.2)] bg-[#0a0f1e]' : ''}
        `}
      >
        {isHinted && (
          <div className="absolute -top-2 left-1 bg-[#0a0f1e] px-1.5 text-[8px] text-[#00ffff] font-bold border border-[#00ffff] z-30">
            ◈ SYS RECOMMENDED
          </div>
        )}
        <div className="flex items-center gap-2 mb-1 border-b border-fuchsia-900/50 pb-1">
          <span className="text-2xl leading-none shrink-0 drop-shadow-[0_0_6px_#ff00ff]">
            {family.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[#ff00ff] font-bold truncate uppercase">{family.name}</div>
            <div className="text-[8px] text-fuchsia-600/70 uppercase mt-0.5">
              NODE [{family.gridPosition.x.toString().padStart(2, '0')},{family.gridPosition.y.toString().padStart(2, '0')}]
            </div>
          </div>
        </div>
        <div className="text-[9px] text-fuchsia-500/90 uppercase">
          MX NOISE LV{family.noiseLimit} | NRG LV{family.energyMatch}
          {family.hasAllergy ? ' | SENS+' : ''}
        </div>
        {showSpaceInfo && (
          <div className={`text-[8px] font-bold uppercase ${family.spaceType === 'house' ? 'text-[#00ff88]' : 'text-[#ffff00]'}`}>
            {family.spaceType === 'house' ? 'TYPE: HOUSE' : 'TYPE: APT'}
          </div>
        )}
        {isAssigned && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <span className="text-[9px] text-[#ff00ff] border border-[#ff00ff]/60 px-2 py-0.5 uppercase">
              RESOLVED
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={!isAssigned ? onClick : undefined}
      className={`
        relative w-full p-3 rounded-[4px] border transition-all duration-200 select-none flex flex-col font-mono text-sm tracking-wider
        ${isHinted ? 'hint-glow' : ''}
        ${isAssigned ? 'opacity-30 grayscale cursor-not-allowed border-slate-800 bg-black' : 'cursor-pointer hover:bg-fuchsia-900/20 backdrop-blur-sm'}
        ${isSelected && !isAssigned && !isHinted ? 'border-[#ff00ff] bg-fuchsia-950/40 shadow-[inset_0_0_15px_rgba(255,0,255,0.25),_0_0_10px_rgba(255,0,255,0.45)]' : !isHinted ? 'border-[rgba(255,0,255,0.35)] bg-[#0a0f1e]' : ''}
      `}
    >
      {isHinted && (
        <div className="absolute -top-3 left-2 bg-[#0a0f1e] px-2 text-[10px] text-[#00ffff] font-bold border border-[#00ffff] rounded-sm drop-shadow-[0_0_5px_#00ffff] z-30">
          ◈ SYS RECOMMENDED
        </div>
      )}
      <div className="flex items-center gap-3 mb-1.5 border-b border-fuchsia-900/50 pb-1.5">
        <span className="text-3xl drop-shadow-[0_0_5px_#ff00ff]">{family.emoji}</span>
        <span className="text-[#ff00ff] font-bold">{family.name}</span>
        <span className="text-xs text-fuchsia-500/50 uppercase">NODE_ID:{family.id}</span>
      </div>

      <div className="flex flex-col gap-1">
        {showSpaceInfo && (
          <span className={`text-xs font-bold uppercase ${family.spaceType === 'house' ? 'text-[#00ff88]' : 'text-[#ffff00]'}`}>
            {family.spaceType === 'house' ? '🏡 YARD ACCESS: YES' : '🏢 YARD ACCESS: NO'}
          </span>
        )}
        {getTraits().map((t, i) => (
          <span
            key={i}
            className={`text-xs uppercase ${t.alert ? 'text-[#ff4444] italic drop-shadow-[0_0_3px_#ff4444]' : 'text-fuchsia-600/80'}`}
          >
            {t.text}
          </span>
        ))}
      </div>

      {isAssigned && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
          <span className="bg-black/90 px-3 py-1 border border-fuchsia-800 text-fuchsia-600 text-xs shadow-xl uppercase">
            RESOLVED
          </span>
        </div>
      )}
    </div>
  );
}
