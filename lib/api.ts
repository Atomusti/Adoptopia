import { Animal, Family, SHELTER_POSITION } from './gameData';

const API_BASE =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
    : 'http://localhost:8000';

/** Backend HintRequest / OptimizeRequest animal shape (no emoji/quirk). */
function animalPayload(a: Animal) {
  return {
    id: a.id,
    name: a.name,
    species: a.species,
    allergyRisk: a.allergyRisk,
    noiseLevel: a.noiseLevel,
    energyLevel: a.energyLevel,
  };
}

function familyPayload(f: Family) {
  return {
    id: f.id,
    name: f.name,
    gridPosition: f.gridPosition,
    hasAllergy: f.hasAllergy,
    noiseLimit: f.noiseLimit,
    energyMatch: f.energyMatch,
  };
}

export interface OptimizeResponse {
  assignments: {
    animalId: string;
    familyId: string;
    path: { x: number; y: number }[];
    score: number;
    distance: number;
  }[];
  totalScore: number;
  totalDistance: number;
  solveTime: number;
  message: string;
  solverUsed: "gamspy" | "greedy";
}

export type AssignmentVerdict =
  | 'OPTIMAL'
  | 'ACCEPTABLE'
  | 'SUBOPTIMAL'
  | 'INVALID';

export interface AssignmentFeedback {
  animalId: string;
  familyId: string;
  animalName: string;
  familyName: string;
  isInOptimal: boolean;
  energyDelta: number;
  isCompatible: boolean;
  fuelCost: number;
  pointsEarned: number;
  verdict: AssignmentVerdict;
  verdictReason: string;
}

export interface JudgeResult {
  playerScore: number;
  optimalScore: number;
  starRating: number;
  efficiency: number;
  feedback: AssignmentFeedback[];
  overallVerdict: string;
  perfectPairs: number;
  totalPairs: number;
}

export interface JudgeApiResponse {
  judgeResult: JudgeResult;
  optimalAssignments: OptimizeResponse['assignments'];
}

export interface LevelValidationAnimal {
  id: string;
  name: string;
  species: string;
  allergyRisk: boolean;
  noiseLevel: number;
  energyLevel: number;
}

export interface LevelValidationFamily {
  id: string;
  name: string;
  gridPosition: { x: number; y: number };
  hasAllergy: boolean;
  noiseLimit: number;
  energyMatch: number;
}

export interface LevelValidationResult {
  isFeasible: boolean;
  fixesApplied: string[];
  animals: LevelValidationAnimal[];
  families: LevelValidationFamily[];
  guaranteedSolutions: number;
  maxFuel: number;
}

export async function callValidateLevel(
  animals: Animal[],
  families: Family[],
  shelterPosition: { x: number; y: number },
  maxFuel: number
): Promise<LevelValidationResult> {
  const res = await fetch(`${API_BASE}/validate-level`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      animals: animals.map(animalPayload),
      families: families.map(familyPayload),
      shelterPosition,
      maxFuel,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`validate-level: ${res.status} ${text}`);
  }
  return (await res.json()) as LevelValidationResult;
}

export interface HintResponse {
  animalId: string;
  familyId: string;
  animalName: string;
  familyName: string;
  familyGrid: {x: number; y: number};
  reason: string;
  score: number;
  distance: number;
  solverUsed: string;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function callOptimize(
  animals: Animal[],
  families: Family[],
  fuel: number
): Promise<OptimizeResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const requestPayload = {
    animals: animals.map(animalPayload),
    families: families.map(familyPayload),
    shelterPosition: SHELTER_POSITION,
    maxFuel: fuel,
  };

  console.log("🚀 [Adoptopia DEV] Firing OptimizeRequest: ", requestPayload);

  try {
    const response = await fetch(`${API_BASE}/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as OptimizeResponse;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("Optimization timed out after 30 seconds. It's an overwhelmingly complex problem!");
    }
    throw new Error(error.message || "Failed to reach the FastApi optimization engine.");
  }
}

export async function callJudge(
  playerAssignments: { animalId: string; familyId: string }[],
  animals: Animal[],
  families: Family[],
  shelterPosition: { x: number; y: number },
  maxFuel: number
): Promise<JudgeApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const requestPayload = {
    playerAssignments,
    animals: animals.map(animalPayload),
    families: families.map(familyPayload),
    shelterPosition,
    maxFuel,
  };

  try {
    const response = await fetch(`${API_BASE}/judge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Judge API error: ${response.status} ${text}`);
    }
    return (await response.json()) as JudgeApiResponse;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('GAMSPy referee timed out after 30 seconds.');
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function callHint(
  animals: Animal[],
  families: Family[],
  shelterPosition: {x: number; y: number},
  remainingFuel: number
): Promise<HintResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const requestPayload = {
    animals: animals.map(animalPayload),
    families: families.map(familyPayload),
    shelterPosition,
    remainingFuel,
  };

  try {
    const response = await fetch(`${API_BASE}/hint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`;
      try {
        const err = await response.json();
        if (Array.isArray(err.detail)) {
          detail = err.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ');
        } else if (typeof err.detail === 'string') {
          detail = err.detail;
        } else if (err.message) {
          detail = err.message;
        }
      } catch {
        /* ignore */
      }
      return {
        animalId: "",
        familyId: "",
        animalName: "",
        familyName: "",
        familyGrid: { x: 0, y: 0 },
        reason: `API ERROR (${response.status}): ${detail}`,
        score: 0,
        distance: 0,
        solverUsed: "none",
      };
    }
    return await response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const name = error instanceof Error ? error.name : '';
    const message = error instanceof Error ? error.message : String(error);
    const isAbort = name === 'AbortError';
    return {
      animalId: "",
      familyId: "",
      animalName: "",
      familyName: "",
      familyGrid: { x: 0, y: 0 },
      reason: isAbort
        ? 'REQUEST TIMEOUT — ADVISORY UNAVAILABLE'
        : 'BACKEND OFFLINE — ADVISORY UNAVAILABLE',
      score: 0,
      distance: 0,
      solverUsed: 'none',
    };
  }
}
