import React from 'react';
import { Animal } from '@/lib/gameData';

interface AnimalCardProps {
  animal: Animal;
  isSelected?: boolean;
  isAssigned?: boolean;
  isHinted?: boolean;
  isCompact?: boolean;
  onClick?: () => void;
}

export default function AnimalCard({
  animal,
  isSelected = false,
  isAssigned = false,
  isHinted = false,
  isCompact = false,
  onClick,
}: AnimalCardProps) {
  const getTraits = () => {
    const traits = [];
    if (animal.energyLevel >= 4) traits.push({ text: 'HIGH ENERGY', alert: false });
    else if (animal.energyLevel <= 2) traits.push({ text: 'LOW ENERGY', alert: false });

    if (animal.noiseLevel >= 4) traits.push({ text: '*LOUD*', alert: true });
    else if (animal.noiseLevel <= 2) traits.push({ text: 'QUIET', alert: false });

    if (animal.allergyRisk) traits.push({ text: 'REQUIRES MEDICATION', alert: true });

    traits.push({ text: animal.quirk.substring(0, 20), alert: false });

    return traits;
  };

  const quirkPreview =
    animal.quirk.length > 20 ? `${animal.quirk.slice(0, 20)}…` : animal.quirk;

  if (isCompact) {
    return (
      <div
        onClick={!isAssigned ? onClick : undefined}
        title={animal.quirk}
        className={`
          relative w-full p-2 rounded-[4px] border transition-all duration-200 select-none flex flex-col font-mono text-[10px] tracking-wider
          ${isHinted ? 'hint-glow' : ''}
          ${isAssigned ? 'opacity-30 grayscale cursor-not-allowed border-slate-800 bg-black' : 'cursor-pointer hover:bg-cyan-900/20 backdrop-blur-sm'}
          ${isSelected && !isAssigned && !isHinted ? 'border-[#00ffff] bg-cyan-950/40 shadow-[inset_0_0_12px_rgba(0,255,255,0.25),_0_0_8px_rgba(0,255,255,0.35)]' : !isHinted ? 'border-[rgba(0,255,255,0.35)] bg-[#0a0f1e]' : ''}
        `}
      >
        {isHinted && (
          <div className="absolute -top-2 left-1 bg-[#0a0f1e] px-1.5 text-[8px] text-[#00ffff] font-bold border border-[#00ffff] z-30">
            ◈ SYS RECOMMENDED
          </div>
        )}
        <div className="flex items-center gap-2 mb-1 border-b border-cyan-900/50 pb-1">
          <span className="text-2xl leading-none shrink-0 drop-shadow-[0_0_6px_#00ffff]">
            {animal.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[#00ffff] font-bold truncate uppercase">{animal.name}</div>
            <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[8px] border border-cyan-800 text-cyan-600 uppercase">
              {animal.species}
            </span>
          </div>
        </div>
        <div className="text-[9px] text-cyan-500/90 uppercase mb-1">
          NOISE: LV{animal.noiseLevel} | NRG: LV{animal.energyLevel}
        </div>
        {animal.allergyRisk && (
          <span className="text-[8px] text-[#ff4444] font-bold border border-[#ff4444]/50 px-1 py-0.5 w-fit uppercase">
            ALLERGY RISK
          </span>
        )}
        <div className="text-[8px] text-cyan-700/80 mt-1 truncate italic">{quirkPreview}</div>
        {isAssigned && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <span className="text-[9px] text-[#00ffff] border border-[#00ffff]/60 px-2 py-0.5 uppercase">
              DISPATCHED
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
        ${isAssigned ? 'opacity-30 grayscale cursor-not-allowed border-slate-800 bg-black' : 'cursor-pointer hover:bg-cyan-900/20 backdrop-blur-sm'}
        ${isSelected && !isAssigned && !isHinted ? 'border-[#00ffff] bg-cyan-950/40 shadow-[inset_0_0_15px_rgba(0,255,255,0.3),_0_0_10px_rgba(0,255,255,0.45)]' : !isHinted ? 'border-[rgba(0,255,255,0.35)] bg-[#0a0f1e]' : ''}
      `}
    >
      {isHinted && (
        <div className="absolute -top-3 left-2 bg-[#0a0f1e] px-2 text-[10px] text-[#00ffff] font-bold border border-[#00ffff] rounded-sm drop-shadow-[0_0_5px_#00ffff] z-30">
          ◈ SYS RECOMMENDED
        </div>
      )}
      <div className="flex items-center gap-3 mb-1.5 border-b border-cyan-900/50 pb-1.5">
        <span className="text-3xl drop-shadow-[0_0_5px_#00ffff]">{animal.emoji}</span>
        <span className="text-[#00ffff] font-bold">{animal.name}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-cyan-600/80 italic text-xs uppercase">{animal.species} unit</span>
        {getTraits().map((t, i) => (
          <span
            key={i}
            className={`text-xs uppercase ${t.alert ? 'text-[#ff4444] italic drop-shadow-[0_0_3px_#ff4444]' : 'text-cyan-600/80'}`}
          >
            {t.text}
          </span>
        ))}
      </div>

      {isAssigned && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
          <span className="bg-black/90 px-3 py-1 border border-cyan-800 text-cyan-600 text-xs shadow-xl uppercase">
            DISPATCHED
          </span>
        </div>
      )}
    </div>
  );
}
