'use client';

import React, { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import GameMap, { GameVehicle } from '@/components/GameMap';
import AnimalCard from '@/components/AnimalCard';
import FamilyCard from '@/components/FamilyCard';
import DetailModal from '@/components/DetailModal';
import HintSystem, { CostPayment } from '@/components/HintSystem';
import LevelSelect from '@/components/LevelSelect';
import { gameData, Animal, Family, SHELTER_POSITION, MAX_FUEL, Position } from '@/lib/gameData';
import { level2Config, type LevelConfig } from '@/lib/levels';
import { calculatePath } from '@/lib/pathfinding';
import {
  callOptimize,
  OptimizeResponse,
  checkBackendHealth,
  callJudge,
  JudgeApiResponse,
  callValidateLevel,
  type LevelValidationAnimal,
  type LevelValidationFamily,
} from '@/lib/api';

interface Assignment {
  animal: Animal;
  family: Family;
  status: 'moving' | 'delivered';
}

type CompatibilityWarning = {
  type: 'NOISE' | 'ALLERGY' | 'ENERGY' | 'SPACE';
  message: string;
  penalty: number;
};

function evaluateCompatibility(animal: Animal, family: Family, currentLevel: LevelConfig | null) {
  let penalty = 0;
  const warnings: CompatibilityWarning[] = [];

  if (animal.noiseLevel > family.noiseLimit) {
    const diff = animal.noiseLevel - family.noiseLimit;
    const p = diff * 40;
    penalty += p;
    warnings.push({
      type: 'NOISE',
      message: `NOISE VIOLATION: LV${animal.noiseLevel} EXCEEDS LIMIT LV${family.noiseLimit}`,
      penalty: p,
    });
  }

  if (animal.allergyRisk && family.hasAllergy) {
    penalty += 120;
    warnings.push({
      type: 'ALLERGY',
      message: 'ALLERGY CONFLICT: SENSITIVITY DETECTED',
      penalty: 120,
    });
  }

  const energyDelta = Math.abs(animal.energyLevel - family.energyMatch);
  if (energyDelta >= 3) {
    const p = energyDelta * 15;
    penalty += p;
    warnings.push({
      type: 'ENERGY',
      message: `ENERGY MISMATCH: DELTA ${energyDelta}`,
      penalty: p,
    });
  }

  if (currentLevel?.id === 2 && currentLevel?.hasSpaceConstraint) {
    if (animal.spaceNeed === 'large' && family.spaceType === 'apartment') {
      const p = 100;
      penalty += p;
      warnings.push({
        type: 'SPACE',
        message: `INSUFFICIENT SPACE: ${animal.name} REQUIRES YARD ACCESS`,
        penalty: p,
      });
    }
  }

  const earned = Math.max(-200, 100 - penalty);
  return { warnings, penalty, earned, isClean: warnings.length === 0 };
}

function cloneGameAnimals(): Animal[] {
  return gameData.animals.map((a) => ({ ...a }));
}

function cloneGameFamilies(): Family[] {
  return gameData.families.map((f) => ({ ...f }));
}

function mergeValidatedAnimals(base: Animal[], api: LevelValidationAnimal[]): Animal[] {
  return base.map((b) => {
    const u = api.find((x) => x.id === b.id);
    if (!u) return b;
    return {
      ...b,
      name: u.name,
      species: u.species as Animal['species'],
      allergyRisk: u.allergyRisk,
      noiseLevel: u.noiseLevel,
      energyLevel: u.energyLevel,
    };
  });
}

function mergeValidatedFamilies(base: Family[], api: LevelValidationFamily[]): Family[] {
  return base.map((b) => {
    const u = api.find((x) => x.id === b.id);
    if (!u) return b;
    return {
      ...b,
      name: u.name,
      gridPosition: u.gridPosition,
      hasAllergy: u.hasAllergy,
      noiseLimit: u.noiseLimit,
      energyMatch: u.energyMatch,
    };
  });
}

function TerminalAnimatedScore({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const timer = setInterval(() => {
      setDisplay((prev) => {
        if (prev === value) {
          clearInterval(timer);
          return prev;
        }
        const diff = value - prev;
        const step = Math.max(1, Math.ceil(Math.abs(diff) / 15)) * Math.sign(diff);
        const next = step > 0 ? Math.min(prev + step, value) : Math.max(prev + step, value);
        if (next === value) clearInterval(timer);
        return next;
      });
    }, 30);
    return () => clearInterval(timer);
  }, [value]);

  const text =
    display >= 0 ? display.toString().padStart(5, '0') : `-${Math.abs(display).toString().padStart(4, '0')}`;
  return <span>{text}</span>;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#0a0f1e] flex items-center justify-center text-[#00ffff] font-mono text-2xl tracking-widest animate-pulse">[SYS.BOOT] INITIALIZING NODE NETWORK...</div>}>
      <AdoptopiaApp />
    </Suspense>
  );
}

function AdoptopiaApp() {
  const searchParams = useSearchParams();
  const isDemoMode = searchParams?.get('demo') === 'true';
  const [currentLevel, setCurrentLevel] = useState<LevelConfig | null>(null);
  const [gridSize, setGridSize] = useState<number>(10);
  const [shelterPosition, setShelterPosition] = useState<Position>({ x: 4, y: 4 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [fuelBudget, setFuelBudget] = useState<number>(0);
  const [levelBanner, setLevelBanner] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  
  const [hintedAnimalId, setHintedAnimalId] = useState<string | null>(null);
  const [hintedFamilyId, setHintedFamilyId] = useState<string | null>(null);
  
  const [modalItem, setModalItem] = useState<Animal | Family | null>(null);
  const [modalType, setModalType] = useState<'animal' | 'family'>('animal');
  
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [vehicles, setVehicles] = useState<GameVehicle[]>([]);
  const [celebrations, setCelebrations] = useState<Position[]>([]);
  
  const [score, setScore] = useState<number>(0);
  const [humanStats, setHumanStats] = useState({ score: 0, distance: 0, assignments: 0 });
  const [gamspyScore, setGamspyScore] = useState<number>(0);

  const [fuel, setFuel] = useState<number>(0);
  const [gamePhase, setGamePhase] = useState<"MANUAL" | "CHAOS" | "GAMSPY" | "COMPLETE">("MANUAL");
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(true);
  const [gamspyData, setGamspyData] = useState<OptimizeResponse | null>(null);
  const [judgeReport, setJudgeReport] = useState<JudgeApiResponse | null>(null);
  const [judgeLoading, setJudgeLoading] = useState(false);
  const autoJudgeTriggeredRef = useRef(false);
  const [logs, setLogs] = useState<string[]>(['[SYS] ADOPTOPIA NETWORK INSTANTIATED']);
  const [dispatchToast, setDispatchToast] = useState<
    | null
    | { kind: 'clean'; earned: number }
    | { kind: 'warning' | 'critical'; earned: number; penalty: number; warnings: CompatibilityWarning[] }
  >(null);
  const [criticalFlash, setCriticalFlash] = useState(false);
  const [scoreMotion, setScoreMotion] = useState<'up' | 'down' | null>(null);
  const prevScoreRef = useRef<number | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreMotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => {
      const newLogs = [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`];
      return newLogs.length > 5 ? newLogs.slice(1) : newLogs;
    });
  }, []);

  const handleLevelSelect = useCallback((level: LevelConfig) => {
    setCurrentLevel(level);
    setAnimals(level.animals.map((a) => ({ ...a })));
    setFamilies(level.families.map((f) => ({ ...f, gridPosition: { ...f.gridPosition } })));
    setFuelBudget(level.maxFuel);
    setFuel(level.maxFuel);
    setGridSize(level.gridSize);
    setShelterPosition({ ...level.shelterPosition });
    setAssignments([]);
    setVehicles([]);
    setScore(0);
    setErrorMessage(null);
    setJudgeReport(null);
    setLogs(['[SYS] ADOPTOPIA NETWORK INSTANTIATED']);
  }, []);

  const addDispatchLog = useCallback((msg: string) => {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    setLogs((prev) => {
      const newLogs = [...prev, `[${hh}:${mm}] ${msg}`];
      return newLogs.length > 5 ? newLogs.slice(1) : newLogs;
    });
  }, []);

  useEffect(() => {
    if (prevScoreRef.current === null) {
      prevScoreRef.current = score;
      return;
    }
    const prev = prevScoreRef.current;
    if (score === prev) return;
    prevScoreRef.current = score;
    if (scoreMotionTimerRef.current) clearTimeout(scoreMotionTimerRef.current);
    setScoreMotion(score > prev ? 'up' : 'down');
    scoreMotionTimerRef.current = setTimeout(() => setScoreMotion(null), 400);
  }, [score]);

  useEffect(() => {
    async function initCheck() {
      const isOnline = await checkBackendHealth();
      setIsBackendOnline(isOnline);
      if (!isOnline) addLog('ERR: GAMSPY COMPUTE CORE OFFLINE');
      else addLog('SYS: GAMSPY COMPUTE CORE CONNECTED');
    }
    initCheck();
  }, []);

  useEffect(() => {
    if (!currentLevel) return;
    let cancelled = false;
    let bannerTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const online = await checkBackendHealth();
      if (!online || cancelled) return;
      try {
        const res = await callValidateLevel(
          currentLevel.animals.map((a) => ({ ...a })),
          currentLevel.families.map((f) => ({ ...f, gridPosition: { ...f.gridPosition } })),
          currentLevel.shelterPosition,
          currentLevel.maxFuel
        );
        if (cancelled) return;

        if (res.fixesApplied.length > 0) {
          setAnimals((prev) => mergeValidatedAnimals(prev, res.animals));
          setFamilies((prev) => mergeValidatedFamilies(prev, res.families));
          res.fixesApplied.forEach((fix) => {
            addLog(`SYS: LEVEL MATRIX RECALIBRATED — ${fix}`);
          });
        }

        setFuelBudget(res.maxFuel);
        setFuel(res.maxFuel);

        setLevelBanner({
          text: `◈ LEVEL VALIDATED — [${res.guaranteedSolutions}] SOLUTIONS EXIST`,
          ok: res.isFeasible,
        });
        bannerTimer = setTimeout(() => {
          if (!cancelled) setLevelBanner(null);
        }, 3050);
      } catch {
        if (!cancelled) addLog('ERR: LEVEL VALIDATION UNAVAILABLE — USING MANIFEST AS-IS');
      }
    })();

    return () => {
      cancelled = true;
      if (bannerTimer) clearTimeout(bannerTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot calibration on mount
  }, [currentLevel, addLog]);

  const handleDispatch = () => {
    if (!selectedAnimal || !selectedFamily || gamePhase !== "MANUAL") return;

    const path = calculatePath(shelterPosition, selectedFamily.gridPosition);
    const distance = path.length - 1; 

    if (distance > fuel) { addLog(`ERR: REQUIRED FUEL ${distance} EXCEEDS MAX ${fuel}`); return; }
    const result = evaluateCompatibility(selectedAnimal, selectedFamily, currentLevel);

    setAssignments(prev => [...prev, { animal: selectedAnimal, family: selectedFamily, status: 'moving' }]);
    setFuel(prev => prev - distance);
    setScore(prev => prev + result.earned);
    setHumanStats(prev => ({ score: prev.score + result.earned, distance: prev.distance + distance, assignments: prev.assignments + 1 }));

    const { x, y } = selectedFamily.gridPosition;
    if (result.isClean) {
      addDispatchLog(`OPR: ${selectedAnimal.name} → NODE[${x},${y}] — +100 PTS`);
    } else if (result.earned > 0) {
      addDispatchLog(`WRN: ${selectedAnimal.name} → NODE[${x},${y}] — PENALTY -${result.penalty} PTS`);
    } else {
      addDispatchLog(`CRIT: ${selectedAnimal.name} → NODE[${x},${y}] — SCORE ${result.earned} PTS`);
    }

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (result.isClean) {
      setDispatchToast({ kind: 'clean', earned: result.earned });
      toastTimerRef.current = setTimeout(() => setDispatchToast(null), 2000);
    } else if (result.earned > 0) {
      setDispatchToast({ kind: 'warning', earned: result.earned, penalty: result.penalty, warnings: result.warnings });
      toastTimerRef.current = setTimeout(() => setDispatchToast(null), 4000);
    } else {
      setDispatchToast({ kind: 'critical', earned: result.earned, penalty: result.penalty, warnings: result.warnings });
      toastTimerRef.current = setTimeout(() => setDispatchToast(null), 5000);
      setCriticalFlash(true);
      setTimeout(() => setCriticalFlash(false), 300);
    }

    const vehicleId = `v-${Date.now()}-${selectedAnimal.id}`;
    setVehicles(prev => [...prev, { id: vehicleId, path: path, animalEmoji: selectedAnimal.emoji, familyId: selectedFamily.id }]);
    
    setSelectedAnimal(null);
    setSelectedFamily(null);
    setHintedAnimalId(null);
    setHintedFamilyId(null);
  };

  const handleAutopilot = async () => {
    setGamePhase("GAMSPY");
    setSelectedAnimal(null);
    setSelectedFamily(null);
    addLog('SYS: GAMSPY AUTOPILOT PROTOCOL ENGAGED. CALCULATING ROUTES...');
    
    const remainingAnimals = animals.filter(a => !assignments.some(asn => asn.animal.id === a.id));
    const remainingFamilies = families.filter(f => !assignments.some(asn => asn.family.id === f.id));
    
    try {
      const response = await callOptimize(remainingAnimals, remainingFamilies, fuel);
      
      setGamspyData(response);
      setGamspyScore(response.totalScore);
      setScore(prev => prev + response.totalScore);
      setFuel(prev => prev - response.totalDistance);

      const newVehicles = response.assignments.map(a => ({
        id: `g-${a.animalId}`,
        path: a.path,
        animalEmoji: animals.find(an => an.id === a.animalId)?.emoji || "🐾",
        familyId: a.familyId
      }));
      setVehicles(prev => [...prev, ...newVehicles]);
      
      const newAssignments = response.assignments.map(a => ({
        animal: animals.find(an => an.id === a.animalId)!,
        family: families.find(fam => fam.id === a.familyId)!,
        status: 'moving' as const
      }));
      setAssignments(prev => [...prev, ...newAssignments]);
      
      addLog(`SYS: COMPUTE FINISHED. SOLVER USED: ${response.solverUsed.toUpperCase()}`);
      setGamePhase("COMPLETE");
      
    } catch (err: any) {
      addLog(`ERR: GAMSPY FAILED - ${err.message}`);
      setGamePhase("MANUAL");
    }
  };

  const resetGame = () => {
    setAssignments([]);
    setVehicles([]);
    setCelebrations([]);
    setScore(0);
    setHumanStats({ score: 0, distance: 0, assignments: 0 });
    setGamspyScore(0);
    setFuel(fuelBudget);
    setSelectedAnimal(null);
    setSelectedFamily(null);
    setHintedAnimalId(null);
    setHintedFamilyId(null);
    setGamspyData(null);
    setJudgeReport(null);
    autoJudgeTriggeredRef.current = false;
    setGamePhase("MANUAL");
    addLog('SYS: NETWORK RESET. ENGINES PRIMED.');
  };

  const changeLevel = () => {
    setCurrentLevel(null);
    setAssignments([]);
    setVehicles([]);
    setCelebrations([]);
    setSelectedAnimal(null);
    setSelectedFamily(null);
    setHintedAnimalId(null);
    setHintedFamilyId(null);
    setGamspyData(null);
    setJudgeReport(null);
    setDispatchToast(null);
    setCriticalFlash(false);
    setScore(0);
    setHumanStats({ score: 0, distance: 0, assignments: 0 });
    setGamspyScore(0);
    setFuel(0);
    setFuelBudget(0);
    setAnimals([]);
    setFamilies([]);
    setGamePhase('MANUAL');
    autoJudgeTriggeredRef.current = false;
    setLogs(['[SYS] ADOPTOPIA NETWORK INSTANTIATED']);
  };

  const runJudgeReview = useCallback(async () => {
    if (assignments.length === 0 || !isBackendOnline) return;
    const playerAssignments = assignments.map((a) => ({
      animalId: a.animal.id,
      familyId: a.family.id,
    }));
    setJudgeLoading(true);
    try {
      const data = await callJudge(
        playerAssignments,
        animals,
        families,
        shelterPosition,
        fuelBudget
      );
      setJudgeReport(data);
      addLog(`SYS: GAMSPY REFEREE — ${data.judgeResult.overallVerdict}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`ERR: JUDGE FAILED — ${msg}`);
      autoJudgeTriggeredRef.current = false;
    } finally {
      setJudgeLoading(false);
    }
  }, [assignments, animals, families, fuelBudget, isBackendOnline, addLog, shelterPosition]);

  const onVehicleComplete = (vehicle: GameVehicle) => {
    setAssignments(prev => prev.map(a => 
      (a.family.id === vehicle.familyId && a.animal.emoji === vehicle.animalEmoji) 
        ? { ...a, status: 'delivered' } 
        : a
    ));
    setVehicles(prev => prev.filter(v => v.id !== vehicle.id));
    const targetCellPosition = vehicle.path[vehicle.path.length - 1];
    setCelebrations(prev => [...prev, targetCellPosition]);
    setTimeout(() => {
      setCelebrations(prev => prev.filter(p => p !== targetCellPosition));
    }, 2000); 
  };

  const onHintReceived = useCallback((aId: string, fId: string) => {
    setHintedAnimalId(aId);
    setHintedFamilyId(fId);
    setTimeout(() => {
      document.getElementById(`animal-card-${aId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById(`family-card-${fId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  const onCostPaid = useCallback((type: CostPayment) => {
    if (type === 'score') setScore((p) => Math.max(0, p - 25));
    else if (type === 'fuel') setFuel((p) => Math.max(0, p - 3));
    else if (type === 'refund_score') setScore((p) => p + 25);
    else if (type === 'refund_fuel') setFuel((p) => p + 3);
  }, []);

  const onHintAccepted = useCallback((aId: string, fId: string) => {
    const a = animals.find((x) => x.id === aId);
    const f = families.find((x) => x.id === fId);
    if (a) setSelectedAnimal(a);
    if (f) setSelectedFamily(f);
    setHintedAnimalId(null);
    setHintedFamilyId(null);
  }, [animals, families]);

  const onHintDismissed = useCallback(() => {
    setHintedAnimalId(null);
    setHintedFamilyId(null);
  }, []);

  const isShowGamspy = assignments.length >= 2 || fuel <= 10;
  const numUnassignedAnimals = animals.filter(a => !assignments.some(x => x.animal.id === a.id)).length;

  useEffect(() => {
    if (gamePhase !== 'MANUAL') {
      autoJudgeTriggeredRef.current = false;
      return;
    }
    if (numUnassignedAnimals !== 0) {
      autoJudgeTriggeredRef.current = false;
      return;
    }
    if (
      assignments.length > 0 &&
      assignments.length === animals.length &&
      !autoJudgeTriggeredRef.current
    ) {
      autoJudgeTriggeredRef.current = true;
      void runJudgeReview();
    }
  }, [
    gamePhase,
    numUnassignedAnimals,
    assignments.length,
    animals.length,
    runJudgeReview,
  ]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalItem) setModalItem(null);
      if (e.key === 'Escape' && judgeReport) setJudgeReport(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [modalItem, judgeReport]);

  if (!currentLevel) {
    return <LevelSelect onSelect={handleLevelSelect} />;
  }

  return (
    <div className="h-screen w-screen bg-[#0a0f1e] text-[#00ffff] flex flex-col font-mono overflow-hidden min-w-[1280px] select-none">
      {criticalFlash && (
        <div className="pointer-events-none fixed inset-0 z-[500] bg-[rgba(255,0,0,0.08)]" aria-hidden />
      )}

      {dispatchToast && (
        <div
          className={`pointer-events-none fixed top-20 right-6 z-[480] w-[22rem] max-w-[calc(100vw-3rem)] border px-3 py-2 text-[10px] leading-snug tracking-widest shadow-lg ${
            dispatchToast.kind === 'clean'
              ? 'border-emerald-500/70 bg-black/90 text-emerald-400'
              : dispatchToast.kind === 'warning'
                ? 'border-amber-500/80 bg-black/90 text-amber-300'
                : 'border-red-500/80 bg-black/90 text-red-400'
          }`}
          style={{ animation: 'floatUp 0.4s ease-out' }}
          role="status"
        >
          {dispatchToast.kind === 'clean' && <div>✓ DISPATCH CONFIRMED +100 PTS</div>}
          {dispatchToast.kind === 'warning' && (
            <div className="space-y-1">
              <div className="font-bold">⚠ DISPATCH WARNING</div>
              {dispatchToast.warnings.map((w, i) => (
                <div key={`${w.type}-${i}-${w.message}`}>
                  {w.type === 'SPACE'
                    ? '[ERR: INSUFFICIENT SPACE] — LARGE UNIT CANNOT BE ASSIGNED TO APARTMENT NODE'
                    : w.message}{' '}
                  <span className="text-[#94a3b8]">(-{w.penalty} PTS)</span>
                </div>
              ))}
              <div className="pt-1 text-amber-200">NET: +{dispatchToast.earned} PTS</div>
            </div>
          )}
          {dispatchToast.kind === 'critical' && (
            <div className="space-y-1">
              <div className="font-bold">✖ CRITICAL MISMATCH</div>
              {dispatchToast.warnings.map((w, i) => (
                <div key={`${w.type}-${i}-${w.message}`}>
                  {w.type === 'SPACE'
                    ? '[ERR: INSUFFICIENT SPACE] — LARGE UNIT CANNOT BE ASSIGNED TO APARTMENT NODE'
                    : w.message}{' '}
                  <span className="text-[#94a3b8]">(-{w.penalty} PTS)</span>
                </div>
              ))}
              <div className="pt-1 text-red-300">NET: {dispatchToast.earned} PTS</div>
            </div>
          )}
        </div>
      )}

      <DetailModal 
        item={modalItem}
        type={modalType}
        isAssigned={modalItem ? (modalType === 'animal' ? assignments.some(a => a.animal.id === modalItem.id) : assignments.some(a => a.family.id === modalItem.id)) : false}
        showSpaceInfo={currentLevel?.id === 2}
        onClose={() => setModalItem(null)}
        onSelect={() => {
           if (modalType === 'animal') setSelectedAnimal(modalItem as Animal);
           else setSelectedFamily(modalItem as Family);
        }}
      />

      <header className="flex-none h-16 border-b border-cyan-900/40 flex items-center justify-between px-6 z-20 shrink-0 bg-[#0a0f1e]">
        <div className="flex items-center gap-6">
          <div className="text-3xl tracking-widest">
            <span className="text-cyan-400 font-bold">ADOPTOPIA::</span><span className="text-fuchsia-500 font-bold">DISPATCH</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-emerald-400 tracking-widest mt-1">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"></span>
            SYSTEM ONLINE // CONNECTED TO CITY GRID
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-xs uppercase tracking-widest text-[#94a3b8]">
            <span className="opacity-60">FUEL_LMT:</span>{' '}
            <span className={`${fuel < 10 ? 'text-[#ff4444]' : 'text-[#00ffff]'}`}>
              [{fuel.toString().padStart(2, '0')} / {fuelBudget}]
            </span>
          </div>
          <div className="text-xs uppercase tracking-widest text-[#94a3b8]">
            <span className="opacity-60">SCORE:</span>{' '}
            <span
              className={[
                score >= 0 ? 'text-[#00ffff]' : 'text-[#ff4444]',
                scoreMotion === 'down' ? 'animate-score-shake animate-score-flash-red' : '',
                scoreMotion === 'up' ? 'animate-score-flash-green' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              [ <TerminalAnimatedScore value={score} /> ]
            </span>
          </div>
          <button onClick={resetGame} className="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded tracking-widest transition-colors mb-1 shadow-[0_0_10px_rgba(37,99,235,0.4)]">
            [ RESET ]
          </button>
          <button
            onClick={changeLevel}
            className="px-5 py-1.5 bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-bold text-xs rounded tracking-widest transition-colors mb-1 shadow-[0_0_10px_rgba(192,38,211,0.4)]"
          >
            [ CHANGE LEVEL ]
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-6 gap-8 relative">
        <div className="w-[55%] flex flex-col h-full border border-[rgba(0,255,255,0.35)] rounded-[4px] p-6 bg-[#0a0f1e] shadow-[inset_0_0_30px_rgba(0,255,255,0.06)]">
          <div className="relative flex-1 min-h-0 shrink">
            {levelBanner && (
              <div
                className={`absolute top-2 left-2 z-30 max-w-[min(100%,22rem)] font-mono text-[10px] tracking-widest pointer-events-none animate-level-validated px-2 py-1 border bg-black/60 uppercase ${
                  levelBanner.ok
                    ? 'text-[#00ff88] border-[#00ff88]/50'
                    : 'text-[#ff4444] border-[#ff4444]/50'
                }`}
              >
                {levelBanner.text}
              </div>
            )}
            <GameMap
              families={families}
              vehicles={vehicles}
              assignedFamilyIds={assignments.map((a) => a.family.id)}
              celebrations={celebrations}
              hintedFamilyId={hintedFamilyId}
              onVehicleComplete={onVehicleComplete}
            />
          </div>
           
           <div className="mt-auto h-32 border border-cyan-900/40 p-2 flex flex-col gap-0.5 text-[10px] overflow-hidden text-[#06b6d4]/60 bg-black/40 font-mono tracking-widest">
              {logs.map((log, idx) => (
                <div key={idx} className={`${idx === logs.length - 1 ? 'text-cyan-300' : ''}`}>{log}</div>
              ))}
           </div>
        </div>

        <div className="w-[45%] flex flex-col h-full rounded-[4px] relative border border-[rgba(0,255,255,0.35)] p-6 bg-[#0a0f1e] overflow-hidden">
          <div className="text-[#00ffff] font-mono text-sm tracking-widest mb-2 flex-none shrink-0 uppercase">
            DATA FEEDS
          </div>

          <div className="flex flex-1 flex-col min-h-0 gap-0 overflow-hidden relative pb-40">
            <div className="grid grid-cols-2 flex-1 min-h-0 gap-0 border-y border-[rgba(0,255,255,0.2)]">
              <div className="flex min-h-0 min-w-0 flex-col border-r border-[rgba(0,255,255,0.2)] pr-2">
                <div className="sticky top-0 z-10 mb-1 shrink-0 border-b border-[rgba(0,255,255,0.2)] bg-[#0a0f1e] pb-1 text-[10px] font-bold tracking-widest text-[#00ffff] uppercase">
                  AVAILABLE PETS{' '}
                  <span className="opacity-50">[{numUnassignedAnimals} UNITS]</span>
                </div>
                <div className="custom-scroll max-h-[55vh] min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="flex flex-col gap-2 pb-2">
                    {animals.map((animal) => (
                      <div key={animal.id} id={`animal-card-${animal.id}`}>
                        <AnimalCard
                          animal={animal}
                          isCompact
                          showSpaceInfo={currentLevel?.id === 2}
                          isSelected={selectedAnimal?.id === animal.id}
                          isAssigned={assignments.some((a) => a.animal.id === animal.id)}
                          isHinted={hintedAnimalId === animal.id}
                          onClick={() => {
                            setModalType('animal');
                            setModalItem(animal);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 min-w-0 flex-col pl-2">
                <div className="sticky top-0 z-10 mb-1 shrink-0 border-b border-[rgba(255,0,255,0.35)] bg-[#0a0f1e] pb-1 text-[10px] font-bold tracking-widest text-[#ff00ff] uppercase">
                  WAITING ADOPTERS{' '}
                  <span className="opacity-50">
                    [
                    {families.filter((f) => !assignments.some((x) => x.family.id === f.id)).length}{' '}
                    NODES]
                  </span>
                </div>
                <div className="custom-scroll max-h-[55vh] min-h-0 flex-1 overflow-y-auto pl-0 pr-1">
                  <div className="flex flex-col gap-2 pb-2">
                    {families.map((family) => (
                      <div key={family.id} id={`family-card-${family.id}`}>
                        <FamilyCard
                          family={family}
                          isCompact
                          showSpaceInfo={currentLevel?.id === 2}
                          isSelected={selectedFamily?.id === family.id}
                          isAssigned={assignments.some((a) => a.family.id === family.id)}
                          isHinted={hintedFamilyId === family.id}
                          onClick={() => {
                            setModalType('family');
                            setModalItem(family);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-[rgba(0,255,255,0.2)] pt-2">
              <HintSystem
                animals={animals.filter((a) => !assignments.some((x) => x.animal.id === a.id))}
                families={families.filter((f) => !assignments.some((x) => x.family.id === f.id))}
                score={score}
                fuel={fuel}
                disabled={numUnassignedAnimals < 2}
                onHintReceived={onHintReceived}
                onCostPaid={onCostPaid}
                onHintAccepted={onHintAccepted}
                onHintDismissed={onHintDismissed}
                addLog={addLog}
              />
            </div>
          </div>

          <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-2 z-30 pointer-events-none">
            {gamePhase === 'MANUAL' && assignments.length > 0 && (
              <button
                type="button"
                onClick={() => void runJudgeReview()}
                disabled={!isBackendOnline || judgeLoading}
                className="pointer-events-auto p-3 border border-cyan-500/80 bg-black/85 text-cyan-300 text-xs font-black tracking-widest shadow-[0_0_24px_rgba(6,182,212,0.25)] hover:bg-cyan-950/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span className="block text-[10px] text-[#94a3b8] font-normal mb-1">
                  SILENT MIP BENCHMARK
                </span>
                {judgeLoading ? '[ GAMSPY REFEREE … ]' : '[ GAMSPY REVIEW ]'}
              </button>
            )}

            {isShowGamspy && gamePhase === "MANUAL" && (
               <button 
                  id="autopilot-btn"
                  onClick={handleAutopilot}
                  disabled={!isBackendOnline}
                  className="pointer-events-auto p-4 border border-fuchsia-500 bg-black/80 shadow-[0_0_30px_rgba(217,70,239,0.3)] animate-pulse hover:scale-105 active:scale-95 transition-all text-fuchsia-400 text-sm font-black tracking-widest"
                >
                  <span className="block text-[10px] text-[#94a3b8] font-normal mb-1">OPT-IN ROUTING DIRECTIVE</span>
                  [ OVERRIDE::GAMSPY_CORE ]
               </button>
            )}

            <div className={`p-4 border backdrop-blur-md pointer-events-auto flex flex-col gap-2 transition-all ${selectedAnimal && selectedFamily ? 'border-amber-500/50 bg-amber-950/90 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-cyan-900/50 bg-[#0a0f1e]/90'}`}>
               <div className="flex items-center gap-4">
                  <div className={`text-[10px] font-bold p-1 border uppercase tracking-widest ${selectedAnimal ? 'border-cyan-400 text-cyan-300' : 'border-dashed border-cyan-900 text-cyan-900'}`}>
                    SRC: {selectedAnimal ? selectedAnimal.name : 'AWAIT_SELECTION'}
                  </div>
                  <div className="text-[#94a3b8]">➔</div>
                  <div className={`text-[10px] font-bold p-1 border uppercase tracking-widest ${selectedFamily ? 'border-fuchsia-400 text-fuchsia-300' : 'border-dashed border-fuchsia-900 text-fuchsia-900'}`}>
                    TGT: {selectedFamily ? `NODE_${selectedFamily.gridPosition.x}${selectedFamily.gridPosition.y}` : 'AWAIT_SELECTION'}
                  </div>
                  
                  <button 
                    onClick={handleDispatch}
                    disabled={!selectedAnimal || !selectedFamily || gamePhase !== "MANUAL"}
                    className={`ml-auto py-1.5 px-6 text-[10px] font-bold tracking-widest border transition-all ${(!selectedAnimal || !selectedFamily) ? 'border-cyan-900 text-cyan-900 cursor-not-allowed' : 'border-amber-400 bg-amber-500 text-amber-950 hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]'}`}
                  >
                    [ DISPATCH_UNIT ]
                  </button>
               </div>
            </div>

          </div>

          {judgeReport && gamePhase === 'MANUAL' && (
            <div className="term-modal-overlay absolute inset-0 z-[90] flex flex-col overflow-y-auto p-4 backdrop-blur-sm pointer-events-auto">
              <div className="term-modal-card mx-auto my-2 flex w-full max-w-4xl flex-col gap-4 border border-[#00ffff] p-6 shadow-[0_0_36px_rgba(0,255,255,0.15)]">
              <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
                <div>
                  <div className="text-xl text-[#00ffff] tracking-widest uppercase border-b border-[#ff00ff]/60 pb-2">
                    GAMSPY // REFEREE REPORT
                  </div>
                  <p className="text-[10px] text-[#94a3b8] mt-2 tracking-widest max-w-xl">
                    {judgeReport.judgeResult.overallVerdict}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setJudgeReport(null)}
                  className="shrink-0 px-3 py-1.5 text-[10px] border border-cyan-700 text-cyan-400 hover:bg-cyan-950/80 tracking-widest"
                >
                  [ DISMISS ]
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-[11px]">
                <div className="border border-cyan-900/60 p-3 bg-black/40">
                  <div className="text-[#94a3b8] tracking-widest mb-1">PLAYER SCORE</div>
                  <div className="text-cyan-300 font-bold text-lg">
                    {judgeReport.judgeResult.playerScore}
                  </div>
                </div>
                <div className="border border-fuchsia-900/60 p-3 bg-fuchsia-950/10">
                  <div className="text-[#94a3b8] tracking-widest mb-1">OPTIMAL BENCH</div>
                  <div className="text-fuchsia-300 font-bold text-lg">
                    {judgeReport.judgeResult.optimalScore}
                  </div>
                </div>
                <div className="border border-amber-900/50 p-3 bg-amber-950/10">
                  <div className="text-[#94a3b8] tracking-widest mb-1">EFFICIENCY</div>
                  <div className="animate-efficiency-count text-amber-300 font-bold text-lg">
                    {judgeReport.judgeResult.efficiency}%
                  </div>
                </div>
                <div className="border border-emerald-900/50 p-3 bg-emerald-950/10">
                  <div className="text-[#94a3b8] tracking-widest mb-1">STARS</div>
                  <div className="animate-star-appear text-[#00ff88] font-bold text-lg tracking-widest">
                    {'★'.repeat(judgeReport.judgeResult.starRating)}
                    <span className="text-emerald-900">
                      {'☆'.repeat(3 - judgeReport.judgeResult.starRating)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-cyan-600 tracking-widest mb-2">
                PAIRWISE VERDICT — {judgeReport.judgeResult.perfectPairs} /{' '}
                {judgeReport.judgeResult.totalPairs} EXACT GAMSPY MATCHES
              </div>
              <div className="flex-1 min-h-0 border border-cyan-900/40 overflow-auto mb-4 text-[10px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#0d1b2a] text-[#00ffff] uppercase tracking-wider">
                    <tr>
                      <th className="p-2 border-b border-cyan-900/50">Animal</th>
                      <th className="p-2 border-b border-cyan-900/50">Family</th>
                      <th className="p-2 border-b border-cyan-900/50">Verdict</th>
                      <th className="p-2 border-b border-cyan-900/50">ΔE</th>
                      <th className="p-2 border-b border-cyan-900/50">Fuel</th>
                      <th className="p-2 border-b border-cyan-900/50">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#94a3b8]">
                    {judgeReport.judgeResult.feedback.map((row) => (
                      <tr key={`${row.animalId}-${row.familyId}`} className="border-b border-cyan-900/20">
                        <td className="p-2 text-cyan-200">{row.animalName}</td>
                        <td className="p-2 text-fuchsia-200/90">{row.familyName}</td>
                        <td
                          className={`p-2 font-bold ${
                            row.verdict === 'OPTIMAL'
                              ? 'text-[#00ff88]'
                              : row.verdict === 'ACCEPTABLE'
                                ? 'text-[#00ffff]'
                                : row.verdict === 'SUBOPTIMAL'
                                  ? 'text-amber-400'
                                  : 'text-[#ff4444]'
                          }`}
                        >
                          {row.verdict}
                        </td>
                        <td className="p-2">{row.energyDelta}</td>
                        <td className="p-2">{row.fuelCost}</td>
                        <td className="p-2">{row.pointsEarned}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-2 text-[9px] text-[#64748b] border-t border-cyan-900/30">
                  {judgeReport.judgeResult.feedback.map((f) => (
                    <div key={`r-${f.animalId}-${f.familyId}`} className="mb-1">
                      <span className="text-cyan-700">::</span> {f.verdictReason}
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[10px] text-fuchsia-500 tracking-widest mb-2 shrink-0">
                GAMSPY GLOBAL ASSIGNMENT ({judgeReport.optimalAssignments.length} routes)
              </div>
              <ul className="text-[10px] text-[#94a3b8] space-y-1 shrink-0 max-h-32 overflow-y-auto border border-fuchsia-900/30 p-3 bg-black/30">
                {judgeReport.optimalAssignments.map((oa) => {
                  const an = animals.find((x) => x.id === oa.animalId);
                  const fam = families.find((x) => x.id === oa.familyId);
                  return (
                    <li key={oa.animalId}>
                      <span className="text-cyan-400">{an?.name ?? oa.animalId}</span>
                      <span className="text-[#64748b]"> → </span>
                      <span className="text-fuchsia-300">{fam?.name ?? oa.familyId}</span>
                      <span className="text-emerald-600/80 ml-2">[{oa.score} pts]</span>
                    </li>
                  );
                })}
              </ul>
              {currentLevel?.id === 1 && judgeReport !== null && (
                <button
                  type="button"
                  className="proceed-btn mt-4 w-full py-4 font-mono text-[1.1rem] font-bold text-white tracking-widest"
                  style={{ background: 'linear-gradient(90deg, #7700ff, #ff00ff)' }}
                  onClick={() => {
                    setJudgeReport(null);
                    setScore(0);
                    setAssignments([]);
                    setVehicles([]);
                    setErrorMessage(null);
                    setCurrentLevel(level2Config);
                    setAnimals(level2Config.animals.map((a) => ({ ...a })));
                    setFamilies(level2Config.families.map((f) => ({ ...f, gridPosition: { ...f.gridPosition } })));
                    setFuel(level2Config.maxFuel);
                    setFuelBudget(level2Config.maxFuel);
                    setGridSize(level2Config.gridSize);
                    setShelterPosition({ ...level2Config.shelterPosition });
                    setLogs(['[SYS] LOADING LEVEL 02 — SPACE CONSTRAINTS ACTIVE']);
                  }}
                >
                  ▶▶ PROCEED TO LEVEL 2
                </button>
              )}
              </div>
            </div>
          )}

          {gamePhase === "COMPLETE" && gamspyData && (
              <div className="absolute inset-0 bg-[#0a0f1e]/95 z-[100] backdrop-blur-md border border-cyan-500/50 flex flex-col p-8 items-center overflow-y-auto">
                <div className="text-3xl text-cyan-400 tracking-widest uppercase mb-8 border-b-2 border-fuchsia-500 pb-2">SIMULATION // FINAL REPORT</div>
                
                {gamspyData.solverUsed === "greedy" && (
                   <div className="mb-4 text-amber-500 border border-amber-500/50 bg-amber-950/20 px-4 py-2 font-bold flex gap-2">
                     <span>⚠️</span> GREEDY FALLBACK UTILIZED
                   </div>
                )}
                {gamspyData.solverUsed === "gamspy" && (
                   <div className="mb-4 text-emerald-500 border border-emerald-500/50 bg-emerald-950/20 px-4 py-2 font-bold flex gap-2">
                     <span>✅</span> GAMSPy OPTIMAL SOLUTION ROUTED
                   </div>
                )}
                
                <div className="w-full flex justify-between px-8 gap-8">
                  <div className="flex-1 border border-cyan-800 p-6 bg-[#0a0f1e]">
                    <div className="text-cyan-500 font-bold mb-4 tracking-widest text-xl">MANUAL OVERRIDE</div>
                    <div className="text-xs space-y-3 text-[#94a3b8]">
                      <div className="flex justify-between"><span>OPERATOR:</span> <span>Human</span></div>
                      <div className="flex justify-between"><span>SCORE:</span> <span className="text-cyan-300 font-bold">{humanStats.score}</span></div>
                      <div className="flex justify-between"><span>DISPATCHES:</span> <span>{humanStats.assignments}</span></div>
                      <div className="flex justify-between"><span>FUEL_BURN:</span> <span>{humanStats.distance}</span></div>
                    </div>
                  </div>

                  <div className="flex-1 border border-fuchsia-800 p-6 bg-fuchsia-950/20 shadow-[0_0_30px_rgba(217,70,239,0.1)] relative">
                    <div className="absolute top-2 right-2 text-[10px] bg-fuchsia-600 text-white px-2 py-0.5">ALGORITHM ACTIVE</div>
                    <div className="text-fuchsia-400 font-bold mb-4 tracking-widest text-xl">{gamspyData.solverUsed === "gamspy" ? "GAMSPy CORE" : "HEURISTIC GREEDY"}</div>
                    <div className="text-xs space-y-3 text-[#94a3b8]">
                       <div className="flex justify-between"><span>OPERATOR:</span> <span>Adoptopia Compute</span></div>
                       <div className="flex justify-between"><span>SCORE:</span> <span className="text-fuchsia-300 font-bold"><TerminalAnimatedScore value={gamspyData.totalScore} /></span></div>
                       <div className="flex justify-between"><span>DISPATCHES:</span> <span>{gamspyData.assignments.length}</span></div>
                       <div className="flex justify-between"><span>FUEL_BURN:</span> <span>{gamspyData.totalDistance}</span></div>
                       <div className="flex justify-between text-emerald-400 pt-2 border-t border-fuchsia-900/50"><span>LATENCY:</span> <span>{gamspyData.solveTime}s</span></div>
                    </div>
                  </div>
                </div>

                <button onClick={resetGame} className="mt-12 px-8 py-3 border-2 border-emerald-500 text-emerald-500 font-bold hover:bg-emerald-500 hover:text-black tracking-widest transition-colors shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                  [ REBOOT SYSTEM ]
                </button>
              </div>
          )}
          
        </div>

      </main>

    </div>
  );
}
