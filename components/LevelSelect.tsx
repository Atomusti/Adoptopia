'use client';

import type { LevelConfig } from '@/lib/levels';
import { level1Config, level2Config } from '@/lib/levels';

function difficultyStars(level: 1 | 2 | 3) {
  return '★'.repeat(level) + '☆'.repeat(3 - level);
}

function LevelCard({
  level,
  onSelect,
}: {
  level: LevelConfig;
  onSelect: (level: LevelConfig) => void;
}) {
  return (
    <div
      style={{ width: 280, flexShrink: 0 }}
      className="border border-cyan-700/60 bg-[#0b0f19] p-5 shadow-[inset_0_0_24px_rgba(0,255,255,0.06)] transition-all duration-200 hover:border-cyan-400 hover:shadow-[0_0_28px_rgba(0,255,255,0.25)]"
    >
      <div className="mb-3 border-b border-cyan-800/50 pb-2 text-sm font-bold text-cyan-200">{level.label}</div>
      <ul className="space-y-1.5 text-[10px] text-[#94a3b8]">
        <li>
          <span className="text-cyan-600">GRID:</span> {level.gridSize}×{level.gridSize}
        </li>
        <li>
          <span className="text-cyan-600">UNITS:</span> {level.animals.length}
        </li>
        <li>
          <span className="text-cyan-600">NODES:</span> {level.families.length}
        </li>
        <li>
          <span className="text-cyan-600">FUEL:</span> {level.maxFuel}
        </li>
      </ul>
      <div className="mt-4 text-[10px] text-cyan-500/90">DIFFICULTY:</div>
      <div className="mt-1 text-amber-400">{difficultyStars(level.difficulty)}</div>
      <button
        type="button"
        onClick={() => {
          if (level.id === 2) console.log('LEVEL 2 SELECTED');
          onSelect(level);
        }}
        className="mt-5 w-full border border-cyan-500/80 bg-black/60 py-2.5 text-[10px] font-bold text-cyan-300 transition-colors hover:bg-cyan-950/40 hover:text-cyan-100"
      >
        [ START LEVEL {level.id} ]
      </button>
    </div>
  );
}

export default function LevelSelect({ onSelect }: { onSelect: (level: LevelConfig) => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0f1e] px-6 py-10 font-mono text-[#00ffff] uppercase tracking-widest">
      <div className="mb-10 text-center">
        <div className="text-2xl font-bold text-cyan-300 md:text-3xl">🐾 ADOPTOPIA :: DISPATCH SYSTEM</div>
        <div className="mt-3 text-xs text-[#94a3b8]">SELECT OPERATION LEVEL</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', gap: '32px', justifyContent: 'center' }}>
        <LevelCard level={level1Config} onSelect={onSelect} />
        <LevelCard level={level2Config} onSelect={onSelect} />
      </div>
    </div>
  );
}
