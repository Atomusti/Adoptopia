'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Animal, Family, SHELTER_POSITION } from '@/lib/gameData';
import { callHint, HintResponse } from '@/lib/api';

export type CostPayment =
  | 'score'
  | 'fuel'
  | 'refund_score'
  | 'refund_fuel';

interface HintSystemProps {
  animals: Animal[];
  families: Family[];
  score: number;
  fuel: number;
  disabled: boolean;
  onHintReceived: (animalId: string, familyId: string) => void;
  onCostPaid: (type: CostPayment) => void;
  onHintDismissed: () => void;
  onHintAccepted: (animalId: string, familyId: string) => void;
  addLog: (msg: string) => void;
}

function AnalyzingDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : `${d}.`));
    }, 400);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{`ANALYZING ${dots.padEnd(3, ' ')}`}</span>;
}

export default function HintSystem({
  animals,
  families,
  score,
  fuel,
  disabled,
  onHintReceived,
  onCostPaid,
  onHintDismissed,
  onHintAccepted,
  addLog,
}: HintSystemProps) {
  const [state, setState] = useState<'IDLE' | 'COST_SELECT' | 'LOADING' | 'HINT_READY'>('IDLE');
  const [hintData, setHintData] = useState<HintResponse | null>(null);
  const paidRef = useRef<'score' | 'fuel' | null>(null);

  const refundIfNeeded = useCallback(
    (type: 'score' | 'fuel' | null) => {
      if (type === 'score') onCostPaid('refund_score');
      if (type === 'fuel') onCostPaid('refund_fuel');
    },
    [onCostPaid]
  );

  const dismissHint = useCallback(
    (logRefund: boolean) => {
      const cost = paidRef.current;
      if (logRefund) {
        addLog('OPR: ADVISORY DISMISSED — COST REFUNDED');
        refundIfNeeded(cost);
      }
      onHintDismissed();
      setState('IDLE');
      setHintData(null);
      paidRef.current = null;
    },
    [addLog, onHintDismissed, refundIfNeeded]
  );

  useEffect(() => {
    if (state !== 'HINT_READY') return;
    const t = window.setTimeout(() => dismissHint(true), 15000);
    return () => clearTimeout(t);
  }, [state, dismissHint]);

  const handleRequestHint = () => {
    if (disabled) return;
    setState('COST_SELECT');
  };

  const handlePayCost = async (type: 'score' | 'fuel') => {
    setState('LOADING');
    paidRef.current = type;

    onCostPaid(type);
    addLog('SYS: ADVISORY REQUESTED — QUERYING GAMSPY_CORE...');

    const remainingAfterDeduct = fuel - (type === 'fuel' ? 3 : 0);
    const res = await callHint(animals, families, SHELTER_POSITION, remainingAfterDeduct);

    if (!res.animalId) {
      const r = res.reason ?? '';
      if (r.includes('BACKEND OFFLINE')) {
        addLog('ERR: ADVISORY UNAVAILABLE — COMPUTE LINK DOWN');
      } else if (r.includes('REQUEST TIMEOUT')) {
        addLog('ERR: ADVISORY TIMEOUT — NO RESPONSE FROM COMPUTE CORE');
      } else if (r.includes('API ERROR')) {
        addLog(`ERR: ADVISORY REQUEST FAILED — ${r}`);
      } else {
        addLog('ERR: NO VIABLE ASSIGNMENTS DETECTED BY GAMSPY_CORE');
      }
      refundIfNeeded(type);
      setState('IDLE');
      paidRef.current = null;
      return;
    }

    addLog(
      `SYS: ADVISORY READY — ${res.animalName} → NODE [${res.familyGrid.x},${res.familyGrid.y}]`
    );
    setHintData(res);
    setState('HINT_READY');
    onHintReceived(res.animalId, res.familyId);
  };

  const handleAccept = () => {
    if (!hintData) return;
    addLog('OPR: ADVISORY ACCEPTED — UNIT SELECTION CONFIRMED');
    onHintAccepted(hintData.animalId, hintData.familyId);
    paidRef.current = null;
    setHintData(null);
    setState('IDLE');
  };

  const handleIgnore = () => dismissHint(true);

  const cancelCost = () => setState('IDLE');

  const canPayScore = score >= 25;
  const canPayFuel = fuel > 3;
  const insufficientResources = !canPayScore && !canPayFuel;

  if (state === 'IDLE') {
    return (
      <div className="mb-3 shrink-0">
        <button
          type="button"
          onClick={handleRequestHint}
          disabled={disabled}
          className={`
            group w-full py-3 px-2 border font-mono tracking-widest text-[11px] text-center flex flex-col justify-center items-center transition-all
            ${
              disabled
                ? 'border-slate-800 text-slate-600 bg-[#0b0f19] cursor-not-allowed'
                : 'border-cyan-500/90 text-cyan-300 bg-black/50 hover:shadow-[0_0_22px_rgba(0,255,255,0.35)] hover:border-cyan-300'
            }
          `}
        >
          <span className="flex items-center gap-2 font-bold">
            <span className="text-cyan-400 group-hover:animate-pulse">◈</span>
            REQUEST SYS ADVISORY
          </span>
          <span className="mt-1.5 text-[9px] text-cyan-600/90">COST: -25 PTS / -3 FUEL</span>
        </button>
      </div>
    );
  }

  if (state === 'COST_SELECT') {
    if (insufficientResources) {
      return (
        <div className="mb-3 shrink-0 border border-rose-900/60 bg-black/70 p-4 font-mono text-center shadow-[inset_0_0_20px_rgba(244,63,94,0.08)]">
          <div className="text-rose-400 text-[10px] font-bold tracking-widest mb-2">
            INSUFFICIENT RESOURCES
          </div>
          <p className="text-[9px] text-slate-500 mb-4 leading-relaxed">
            NEED ≥25 SCORE OR &gt;3 FUEL TO REQUEST ADVISORY
          </p>
          <button
            type="button"
            onClick={cancelCost}
            className="py-2 px-6 border border-cyan-800 text-cyan-500 text-[10px] tracking-widest hover:bg-cyan-950/50"
          >
            [ CANCEL ]
          </button>
        </div>
      );
    }

    return (
      <div className="mb-3 shrink-0 border border-cyan-700/40 bg-black/80 p-4 font-mono text-center shadow-[0_0_18px_rgba(6,182,212,0.12)]">
        <div className="text-cyan-400 text-[10px] font-bold tracking-widest mb-4 border-b border-cyan-900/50 pb-2">
          SELECT PAYMENT METHOD
        </div>
        <div className="flex flex-col gap-3">
          {canPayScore ? (
            <button
              type="button"
              onClick={() => handlePayCost('score')}
              className="w-full py-2.5 border border-cyan-600/60 text-cyan-300 hover:bg-cyan-950/40 text-[10px] tracking-widest font-bold transition-colors"
            >
              [ -25 SCORE POINTS ]
            </button>
          ) : (
            <div className="py-2.5 border border-slate-800 text-slate-600 text-[10px] tracking-widest cursor-not-allowed">
              [ LOCKED: SCORE &lt; 25 ]
            </div>
          )}

          {canPayFuel ? (
            <button
              type="button"
              onClick={() => handlePayCost('fuel')}
              className="w-full py-2.5 border border-fuchsia-700/50 text-fuchsia-300 hover:bg-fuchsia-950/30 text-[10px] tracking-widest font-bold transition-colors"
            >
              [ -3 FUEL UNITS ]
            </button>
          ) : (
            <div className="py-2.5 border border-slate-800 text-slate-600 text-[10px] tracking-widest cursor-not-allowed">
              [ LOCKED: FUEL ≤ 3 ]
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={cancelCost}
          className="mt-4 text-[10px] tracking-widest text-slate-500 hover:text-rose-400 border-b border-transparent hover:border-rose-500/50 pb-0.5 transition-colors"
        >
          [ CANCEL ]
        </button>
      </div>
    );
  }

  if (state === 'LOADING') {
    return (
      <div className="mb-3 shrink-0 border border-cyan-500/30 bg-[#0b0f19] p-5 font-mono flex flex-col items-center justify-center gap-3">
        <div
          className="h-8 w-8 border-2 border-cyan-900 border-t-cyan-400 rounded-full animate-spin"
          aria-hidden
        />
        <div className="text-cyan-500 text-[10px] tracking-widest font-bold animate-pulse">
          QUERYING GAMSPY CORE...
        </div>
        <div className="text-cyan-700 text-[9px] tracking-[0.2em]">
          <AnalyzingDots />
        </div>
      </div>
    );
  }

  if (state === 'HINT_READY' && hintData) {
    return (
      <div className="mb-3 shrink-0 border border-cyan-400/70 bg-cyan-950/15 p-4 font-mono shadow-[0_0_22px_rgba(0,255,255,0.12)]">
        <div className="text-cyan-300 text-[10px] font-bold tracking-widest mb-2 flex items-center gap-2">
          <span className="text-cyan-400">◈</span> SYSTEM ADVISORY
        </div>
        <div className="border-t border-cyan-900/50 mb-3" />

        <div className="text-[10px] space-y-2 mb-3 bg-black/50 p-3 border border-cyan-900/40">
          <div className="flex gap-2">
            <span className="w-20 shrink-0 text-cyan-600 font-bold">DISPATCH:</span>
            <span className="text-cyan-100 uppercase truncate">{hintData.animalName}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-20 shrink-0 text-cyan-600 font-bold">TARGET:</span>
            <span className="text-fuchsia-300">
              NODE [{hintData.familyGrid.x},{hintData.familyGrid.y}]
            </span>
          </div>
        </div>

        <div className="text-[9px] text-cyan-200/90 mb-4 bg-black/40 p-3 border-l-2 border-cyan-500/60 leading-snug">
          ANALYSIS: {hintData.reason}
        </div>

        <div className="text-[10px] grid grid-cols-2 gap-3 mb-4">
          <div className="flex flex-col items-center p-2 border border-emerald-900/60 bg-emerald-950/20">
            <span className="text-cyan-600 text-[8px] mb-1">SCORE POTENTIAL</span>
            <span className="text-emerald-400 font-bold">+{hintData.score}</span>
          </div>
          <div className="flex flex-col items-center p-2 border border-cyan-900/60 bg-black/40">
            <span className="text-cyan-600 text-[8px] mb-1">FUEL COST</span>
            <span className="text-cyan-300 font-bold">{hintData.distance} UNITS</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 py-2.5 border border-emerald-500/80 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-500/20 text-[10px] font-bold tracking-widest transition-all"
          >
            [ ACCEPT ]
          </button>
          <button
            type="button"
            onClick={handleIgnore}
            className="flex-1 py-2.5 border border-rose-900/60 text-rose-400 hover:bg-rose-950/40 text-[10px] tracking-widest transition-all"
          >
            [ IGNORE ]
          </button>
        </div>
      </div>
    );
  }

  return null;
}
