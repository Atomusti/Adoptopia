import time
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI(title="Adoptopia API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Global Exception Caught: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"message": f"Server encountered a critical error: {str(exc)}"}
    )

@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"Incoming Request: {request.method} {request.url.path}")
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    print(f"Completed in {process_time:.4f}s with status {response.status_code}")
    return response

class Position(BaseModel):
    x: int
    y: int

class AnimalData(BaseModel):
    id: str
    name: str
    species: str
    allergyRisk: bool
    noiseLevel: int
    energyLevel: int
    spaceNeed: str = "small"

class FamilyData(BaseModel):
    id: str
    name: str
    gridPosition: Position
    hasAllergy: bool
    noiseLimit: int
    energyMatch: int
    spaceType: str = "apartment"

class OptimizeRequest(BaseModel):
    animals: List[AnimalData]
    families: List[FamilyData]
    shelterPosition: Position
    maxFuel: int

class Assignment(BaseModel):
    animalId: str
    familyId: str
    path: List[Position]
    score: int
    distance: int

class OptimizeResponse(BaseModel):
    assignments: List[Assignment]
    totalScore: int
    totalDistance: int
    solveTime: float
    message: str
    solverUsed: str

class HintRequest(BaseModel):
    animals: List[AnimalData]
    families: List[FamilyData]
    shelterPosition: Position
    remainingFuel: int

class HintResponse(BaseModel):
    animalId: str
    familyId: str
    animalName: str
    familyName: str
    familyGrid: Position
    reason: str
    score: int
    distance: int
    solverUsed: str


class PlayerAssignment(BaseModel):
    animalId: str
    familyId: str


class AssignmentFeedback(BaseModel):
    animalId: str
    familyId: str
    animalName: str
    familyName: str
    isInOptimal: bool
    energyDelta: int
    isCompatible: bool
    fuelCost: int
    pointsEarned: int
    verdict: str
    verdictReason: str


class JudgeResult(BaseModel):
    playerScore: int
    optimalScore: int
    starRating: int
    efficiency: float
    feedback: List[AssignmentFeedback]
    overallVerdict: str
    perfectPairs: int
    totalPairs: int


class JudgeRequest(BaseModel):
    playerAssignments: List[PlayerAssignment]
    animals: List[AnimalData]
    families: List[FamilyData]
    shelterPosition: Position
    maxFuel: int


class JudgeApiResponse(BaseModel):
    judgeResult: JudgeResult
    optimalAssignments: List[Assignment]


class LevelValidationResult(BaseModel):
    isFeasible: bool
    fixesApplied: List[str]
    animals: List[AnimalData]
    families: List[FamilyData]
    guaranteedSolutions: int
    maxFuel: int

def generate_reason(animal, family, energy_score, distance, is_closest, is_only_option):
    if is_only_option:
        return "SOLE VIABLE UNIT: ALLERGY+NOISE MATRIX CLEARED"
    if energy_score >= 8:
        return f"ENERGY SYNC: {energy_score * 10}% BEHAVIORAL MATCH DETECTED"
    if is_closest:
        return f"RANGE OPTIMIZED: {distance} NODE DISTANCE — FUEL EFFICIENT"
    return "OPTIMAL PAIRING: SCORE MATRIX MAXIMIZED"

def calculate_manhattan_path(start: Position, end: Position, families=None) -> List[Position]:
    if not families: families = []
    obstacles = set((f.gridPosition.x, f.gridPosition.y) for f in families)
    if (start.x, start.y) in obstacles: obstacles.remove((start.x, start.y))
    if (end.x, end.y) in obstacles: obstacles.remove((end.x, end.y))

    queue = [(start, [start])]
    visited = set([(start.x, start.y)])
    dirs = [(0, 1), (1, 0), (0, -1), (-1, 0)]
    
    while queue:
        pos, path = queue.pop(0)
        if pos.x == end.x and pos.y == end.y:
            return path
            
        for dx, dy in dirs:
            nx, ny = pos.x + dx, pos.y + dy
            if 0 <= nx < 10 and 0 <= ny < 10:
                if (nx, ny) not in visited and (nx, ny) not in obstacles:
                    visited.add((nx, ny))
                    nxt = Position(x=nx, y=ny)
                    queue.append((nxt, path + [nxt]))
                    
    return [start, end]

def manhattan_distance(p1: Position, p2: Position, families=None) -> int:
    path = calculate_manhattan_path(p1, p2, families)
    return len(path) - 1

@app.get("/health")
def health_check():
    return {"status": "ok", "solver": "gamspy"}

@app.post("/optimize", response_model=OptimizeResponse)
def optimize_dispatch(request: OptimizeRequest):
    if not request.animals:
        raise HTTPException(status_code=400, detail="Animals list cannot be empty for optimization.")
        
    from optimizer import solve_assignment
    return solve_assignment(request)

@app.post("/validate-level", response_model=LevelValidationResult)
def validate_level(request: OptimizeRequest):
    if not request.animals or not request.families:
        raise HTTPException(
            status_code=400,
            detail="animals and families must be non-empty for validation.",
        )
    from optimizer import validate_and_fix_level

    return validate_and_fix_level(
        request.animals,
        request.families,
        request.shelterPosition,
        request.maxFuel,
    )


@app.post("/judge", response_model=JudgeApiResponse)
def judge_player(request: JudgeRequest):
    if not request.playerAssignments:
        raise HTTPException(status_code=400, detail="playerAssignments cannot be empty.")
    if not request.animals or not request.families:
        raise HTTPException(status_code=400, detail="animals and families must be non-empty.")

    from optimizer import judge_player_solution, solve_full_optimal

    opt_req = OptimizeRequest(
        animals=request.animals,
        families=request.families,
        shelterPosition=request.shelterPosition,
        maxFuel=request.maxFuel,
    )
    optimal_response = solve_full_optimal(opt_req)
    judgment = judge_player_solution(
        request.playerAssignments,
        optimal_response.assignments,
        request.animals,
        request.families,
        request.shelterPosition,
    )
    return JudgeApiResponse(
        judgeResult=judgment,
        optimalAssignments=optimal_response.assignments,
    )


@app.post("/hint", response_model=HintResponse)
def get_system_advisory(request: HintRequest):
    if not request.animals or not request.families:
        return HintResponse(
            animalId="",
            familyId="",
            animalName="",
            familyName="",
            familyGrid=Position(x=0, y=0),
            reason="NO VIABLE ASSIGNMENTS — ALL UNITS INCOMPATIBLE",
            score=0,
            distance=0,
            solverUsed="none",
        )
    try:
        from optimizer import solve_single_hint

        return solve_single_hint(request)
    except Exception as e:
        print(f"/hint safeguard: {e}")
        return HintResponse(
            animalId="",
            familyId="",
            animalName="",
            familyName="",
            familyGrid=Position(x=0, y=0),
            reason="NO VIABLE ASSIGNMENTS — ALL UNITS INCOMPATIBLE",
            score=0,
            distance=0,
            solverUsed="none",
        )
