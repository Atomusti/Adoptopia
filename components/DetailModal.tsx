import React from 'react';
import { Animal, Family } from '@/lib/gameData';

interface DetailModalProps {
  item: Animal | Family | null;
  type: 'animal' | 'family';
  isAssigned: boolean;
  onClose: () => void;
  onSelect: () => void;
}

export default function DetailModal({ item, type, isAssigned, onClose, onSelect }: DetailModalProps) {
  if (!item) return null;

  const renderMeter = (level: number, max: number = 5) => {
    return "█".repeat(level) + "░".repeat(max - level);
  };

  return (
    <div
      className="term-modal-overlay fixed inset-0 flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`term-modal-card w-[420px] font-mono p-6 relative flex flex-col gap-4 drop-shadow-[0_0_30px_rgba(0,255,255,0.15)]
          ${type === 'animal' ? 'border-[#00ffff]' : 'border-[#ff00ff]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white hover:bg-red-500 px-2 py-0.5 border border-gray-600 transition-colors"
        >
          [X]
        </button>

        {type === 'animal' && (
          <div className="flex flex-col text-cyan-400 gap-6">
            <div className="flex flex-col gap-2">
              <div className="text-[80px] leading-none mb-2 drop-shadow-[0_0_15px_#06b6d4]">{(item as Animal).emoji}</div>
              <div className="text-xl font-bold uppercase">{(item as Animal).name}</div>
              <div className="text-sm opacity-80 uppercase tracking-widest border-t border-b border-cyan-800 py-1 inline-block w-fit">
                ── {(item as Animal).species} UNIT ──
              </div>
            </div>

            <div className="flex flex-col gap-1 text-sm">
              <span className="text-cyan-600 font-bold tracking-widest">BEHAVIORAL PROFILE:</span>
              <span className="text-cyan-200 italic">"{(item as Animal).quirk}"</span>
            </div>

            <div className="flex flex-col gap-2 text-sm mt-2">
              <div className="flex justify-between">
                <span>NOISE LEVEL:</span>
                <span className="text-cyan-200">{renderMeter((item as Animal).noiseLevel)} LV{(item as Animal).noiseLevel}</span>
              </div>
              <div className="flex justify-between">
                <span>ENERGY LEVEL:</span>
                <span className="text-cyan-200">{renderMeter((item as Animal).energyLevel)} LV{(item as Animal).energyLevel}</span>
              </div>
            </div>

            <div className="mt-2">
              <span className="text-cyan-600 tracking-widest">ALLERGY RISK: </span>
              {(item as Animal).allergyRisk ? (
                <span className="text-rose-500 font-bold">⚠️ POSITIVE</span>
              ) : (
                <span className="text-emerald-500 font-bold">✅ NEGATIVE</span>
              )}
            </div>

            <div className="mt-2 p-2 border border-cyan-900 bg-black/40">
              <span className="text-gray-500">STATUS: </span>
              <span className={isAssigned ? 'text-amber-500' : 'text-emerald-400'}>
                {isAssigned ? 'DISPATCHED' : 'AVAILABLE'}
              </span>
            </div>

            <button 
              onClick={() => { onSelect(); onClose(); }}
              disabled={isAssigned}
              className={`mt-4 py-3 font-bold tracking-widest transition-colors border
                ${isAssigned ? 'border-gray-800 text-gray-600 bg-gray-900 cursor-not-allowed' : 'border-cyan-400 bg-cyan-900/30 hover:bg-cyan-400 hover:text-black shadow-[0_0_15px_rgba(6,182,212,0.3)]'}`}
            >
              {isAssigned ? 'UNIT DISPATCHED' : '[ SELECT THIS UNIT ]'}
            </button>
          </div>
        )}

        {type === 'family' && (
          <div className="flex flex-col text-fuchsia-400 gap-6">
            <div className="flex flex-col gap-2">
              <div className="text-[80px] leading-none mb-2 drop-shadow-[0_0_15px_#d946ef]">{(item as Family).emoji}</div>
              <div className="text-xl font-bold uppercase">{(item as Family).name}</div>
              <div className="text-sm opacity-80 uppercase tracking-widest border-t border-b border-fuchsia-800 py-1 inline-block w-fit">
                ── NODE ID: {(item as Family).id.toUpperCase()} ──
              </div>
            </div>

            <div className="text-sm font-bold mt-2">
              TARGET GRID: <span className="text-fuchsia-200">[{strPad((item as Family).gridPosition.x)}, {strPad((item as Family).gridPosition.y)}]</span>
            </div>

            <div className="flex flex-col gap-2 text-sm mt-2">
              <span className="text-fuchsia-600 font-bold tracking-widest">REQUIREMENTS:</span>
              <div className="flex justify-between">
                <span>MAX NOISE:</span>
                <span className="text-fuchsia-200">{renderMeter((item as Family).noiseLimit)} LV{(item as Family).noiseLimit}</span>
              </div>
              <div className="flex justify-between">
                <span>NRG MATCH:</span>
                <span className="text-fuchsia-200">{renderMeter((item as Family).energyMatch)} LV{(item as Family).energyMatch}</span>
              </div>
            </div>

            <div className="mt-2">
              <span className="text-fuchsia-600 tracking-widest">SENSITIVITY: </span>
              {(item as Family).hasAllergy ? (
                <span className="text-rose-500 font-bold drop-shadow-[0_0_5px_#f43f5e]">⚠️ ALLERGY DETECTED</span>
              ) : (
                <span className="text-emerald-500 font-bold drop-shadow-[0_0_5px_#10b981]">✅ NO SENSITIVITIES</span>
              )}
            </div>

            <div className="mt-2 p-2 border border-fuchsia-900 bg-black/40">
              <span className="text-gray-500">STATUS: </span>
              <span className={isAssigned ? 'text-amber-500' : 'text-emerald-400'}>
                {isAssigned ? 'ASSIGNED' : 'WAITING'}
              </span>
            </div>

            <button 
              onClick={() => { onSelect(); onClose(); }}
              disabled={isAssigned}
              className={`mt-4 py-3 font-bold tracking-widest transition-colors border
                ${isAssigned ? 'border-gray-800 text-gray-600 bg-gray-900 cursor-not-allowed' : 'border-fuchsia-400 bg-fuchsia-900/30 hover:bg-fuchsia-400 hover:text-black shadow-[0_0_15px_rgba(217,70,239,0.3)]'}`}
            >
              {isAssigned ? 'UNIT DISPATCHED' : '[ SELECT THIS ADOPTER ]'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function strPad(val: number) {
  return val.toString().padStart(2, '0');
}
