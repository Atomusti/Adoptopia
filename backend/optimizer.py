import math
import time
import pandas as pd


def _viable_assignment_pairs(req):
    """Animals × families that pass allergy, noise, and remaining-fuel checks."""
    from main import manhattan_distance

    pairs = []
    for a in req.animals:
        for f in req.families:
            if a.allergyRisk and f.hasAllergy:
                continue
            if a.noiseLevel > f.noiseLimit:
                continue
            dist = manhattan_distance(req.shelterPosition, f.gridPosition, req.families)
            if dist > req.remainingFuel:
                continue
            energy_score = max(0, 10 - abs(a.energyLevel - f.energyMatch))
            pairs.append(
                {
                    "a": a,
                    "f": f,
                    "dist": dist,
                    "energy_score": energy_score,
                    "pts": energy_score * 10,
                }
            )
    return pairs


def solve_single_hint(req):
    from main import HintResponse, manhattan_distance, generate_reason
    
    try:
        from gamspy import Container, Set, Parameter, Variable, Equation, Model, Sum, Sense
        m = Container()
        
        animal_ids = [a.id for a in req.animals]
        family_ids = [f.id for f in req.families]
        
        if len(animal_ids) == 0 or len(family_ids) == 0:
            raise ValueError("No arrays")

        A = Set(m, name="A", records=animal_ids)
        F = Set(m, name="F", records=family_ids)
        
        comp_dict = {}
        dist_dict = {}
        fuel_dict = {}
        energy_dict = {}
        
        for a in req.animals:
            for f in req.families:
                comp = 1
                if a.allergyRisk and f.hasAllergy: comp = 0
                if a.noiseLevel > f.noiseLimit: comp = 0
                comp_dict[(a.id, f.id)] = comp
                
                dist = manhattan_distance(req.shelterPosition, f.gridPosition, req.families)
                dist_dict[(a.id, f.id)] = dist
                
                fuel_ok = 1 if dist <= req.remainingFuel else 0
                fuel_dict[(a.id, f.id)] = fuel_ok
                
                energy_score = max(0, 10 - abs(a.energyLevel - f.energyMatch))
                energy_dict[(a.id, f.id)] = energy_score

        comp_df = pd.Series(comp_dict).reset_index()
        comp_df.columns = ["A", "F", "value"]
        dist_df = pd.Series(dist_dict).reset_index()
        dist_df.columns = ["A", "F", "value"]
        fuel_df = pd.Series(fuel_dict).reset_index()
        fuel_df.columns = ["A", "F", "value"]
        energy_df = pd.Series(energy_dict).reset_index()
        energy_df.columns = ["A", "F", "value"]

        compatibility = Parameter(m, name="comp", domain=[A, F], records=comp_df)
        distance = Parameter(m, name="dist", domain=[A, F], records=dist_df)
        fuel_ok = Parameter(m, name="fuel_ok", domain=[A, F], records=fuel_df)
        energy = Parameter(m, name="energy", domain=[A, F], records=energy_df)
        
        x = Variable(m, name="x", domain=[A, F], type="Binary")
        
        c1 = Equation(m, name="c1", domain=[A])
        c1[A] = Sum(F, x[A, F]) <= 1
        
        c2 = Equation(m, name="c2", domain=[F])
        c2[F] = Sum(A, x[A, F]) <= 1
        
        c3 = Equation(m, name="c3", domain=[A, F])
        c3[A, F] = x[A, F] <= compatibility[A, F]
        
        c4 = Equation(m, name="c4", domain=[A, F])
        c4[A, F] = x[A, F] <= fuel_ok[A, F]
        
        c5 = Equation(m, name="c5")
        c5[...] = Sum([A, F], x[A, F]) == 1
        
        obj = Sum([A, F], energy[A, F] * x[A, F])
        
        adoptopia_model = Model(
            m,
            name="adoptopia_hint",
            equations=[c1, c2, c3, c4, c5],
            problem="MIP",
            sense=Sense.MAX,
            objective=obj
        )
        
        adoptopia_model.solve()
        
        status = adoptopia_model.status.name if hasattr(adoptopia_model, 'status') and hasattr(adoptopia_model.status, 'name') else None
        
        if status in ["Infeasible", "InfeasibleNoSolution", "Error"]:
            raise Exception(f"GAMSPy Unsolvable {status}")
            
        if x.records is not None and not x.records.empty:
            assigned = x.records[x.records['level'] > 0.5]
            if not assigned.empty:
                row = assigned.iloc[0]
                a_id = row['A']
                f_id = row['F']
                
                a_obj = next(a for a in req.animals if a.id == a_id)
                f_obj = next(f for f in req.families if f.id == f_id)
                
                dist = manhattan_distance(req.shelterPosition, f_obj.gridPosition, req.families)
                energy_score = max(0, 10 - abs(a_obj.energyLevel - f_obj.energyMatch))

                viable = _viable_assignment_pairs(req)
                is_only_option = len(viable) == 1
                min_dist = min((p["dist"] for p in viable), default=dist)
                is_closest = bool(viable) and dist == min_dist

                reason = generate_reason(a_obj, f_obj, energy_score, dist, is_closest, is_only_option)
                
                return HintResponse(
                    animalId=a_id,
                    familyId=f_id,
                    animalName=a_obj.name,
                    familyName=f_obj.name,
                    familyGrid=f_obj.gridPosition,
                    reason=reason,
                    score=energy_score * 10,
                    distance=dist,
                    solverUsed="gamspy"
                )
        raise Exception("No assignment found")
                
    except Exception as e:
        print(f"GAMSPy Hint Failed: {e} | Fallback Greedy.")

        valid_pairs = _viable_assignment_pairs(req)

        if not valid_pairs:
            return HintResponse(
                animalId="",
                familyId="",
                animalName="",
                familyName="",
                familyGrid=req.shelterPosition,
                reason="NO VIABLE ASSIGNMENTS — ALL UNITS INCOMPATIBLE",
                score=0,
                distance=0,
                solverUsed="greedy",
            )

        valid_pairs.sort(key=lambda x: (-x["energy_score"], x["dist"]))
        best = valid_pairs[0]

        is_only_option = len(valid_pairs) == 1
        min_dist = min(p["dist"] for p in valid_pairs)
        is_closest = best["dist"] == min_dist

        reason = generate_reason(
            best["a"],
            best["f"],
            best["energy_score"],
            best["dist"],
            is_closest,
            is_only_option,
        )

        return HintResponse(
            animalId=best["a"].id,
            familyId=best["f"].id,
            animalName=best["a"].name,
            familyName=best["f"].name,
            familyGrid=best["f"].gridPosition,
            reason=reason,
            score=best["pts"],
            distance=best["dist"],
            solverUsed="greedy",
        )


def solve_greedy(req, is_fallback=False):
    from main import OptimizeResponse, Assignment, calculate_manhattan_path, manhattan_distance
    
    start_time = time.time()
    assignments = []
    used_animals = set()
    used_families = set()
    total_fuel = 0
    total_score = 0
    
    def manhattan(f):
        return manhattan_distance(req.shelterPosition, f.gridPosition, req.families)
    
    sorted_families = sorted(req.families, key=manhattan)
    
    for family in sorted_families:
        dist = manhattan(family)
        if total_fuel + dist > req.maxFuel:
            continue
            
        best_animal = None
        best_score = -1
        
        for animal in req.animals:
            if animal.id in used_animals:
                continue
            if animal.allergyRisk and family.hasAllergy:
                continue
            if animal.noiseLevel > family.noiseLimit:
                continue
                
            score = 10 - abs(animal.energyLevel - family.energyMatch)
            if score > best_score:
                best_score = score
                best_animal = animal
                
        if best_animal:
            path = calculate_manhattan_path(req.shelterPosition, family.gridPosition, req.families)
            match_score = best_score * 10
            
            assignments.append(Assignment(
                animalId=best_animal.id,
                familyId=family.id,
                path=path,
                score=match_score,
                distance=dist
            ))
            used_animals.add(best_animal.id)
            used_families.add(family.id)
            total_fuel += dist
            total_score += match_score

    solve_time = time.time() - start_time
    msg = "GAMSPy Missing or Failed: Falling back to greedy." if is_fallback else "Greedy optimization complete."
        
    return OptimizeResponse(
        assignments=assignments,
        totalScore=total_score,
        totalDistance=total_fuel,
        solveTime=round(solve_time, 4),
        message=msg,
        solverUsed="greedy"
    )

def solve_assignment(request):
    from main import OptimizeResponse, Assignment, calculate_manhattan_path, manhattan_distance
    start_time = time.time()

    if not request.animals or not request.families:
        return solve_greedy(request)

    try:
        from gamspy import Container, Set, Parameter, Variable, Equation, Model, Sum, Sense
    except ImportError as e:
        print(f"GAMSPy Error: {e} | Falling back to greedy.")
        return solve_greedy(request, True)

    try:
        m = Container()
        
        animal_ids = [a.id for a in request.animals]
        family_ids = [f.id for f in request.families]
        
        A = Set(m, name="A", records=animal_ids)
        F = Set(m, name="F", records=family_ids)
        
        comp_dict = {}
        dist_dict = {}
        energy_dict = {}
        
        for a in request.animals:
            for f in request.families:
                comp = 1
                if a.allergyRisk and f.hasAllergy: comp = 0
                if a.noiseLevel > f.noiseLimit: comp = 0
                comp_dict[(a.id, f.id)] = comp
                
                dist = manhattan_distance(request.shelterPosition, f.gridPosition, request.families)
                dist_dict[(a.id, f.id)] = dist
                
                energy_score = max(0, 10 - abs(a.energyLevel - f.energyMatch))
                energy_dict[(a.id, f.id)] = energy_score
        
        comp_df = pd.Series(comp_dict).reset_index(); comp_df.columns = ["A", "F", "value"]
        dist_df = pd.Series(dist_dict).reset_index(); dist_df.columns = ["A", "F", "value"]
        energy_df = pd.Series(energy_dict).reset_index(); energy_df.columns = ["A", "F", "value"]
        
        compatibility = Parameter(m, name="comp", domain=[A, F], records=comp_df)
        distance = Parameter(m, name="dist", domain=[A, F], records=dist_df)
        energy = Parameter(m, name="energy", domain=[A, F], records=energy_df)
        
        x = Variable(m, name="x", domain=[A, F], type="Binary")
        
        c1 = Equation(m, name="c1", domain=[A])
        c1[A] = Sum(F, x[A, F]) <= 1
        
        c2 = Equation(m, name="c2", domain=[F])
        c2[F] = Sum(A, x[A, F]) <= 1
        
        c3 = Equation(m, name="c3", domain=[A, F])
        c3[A, F] = x[A, F] <= compatibility[A, F]
        
        c4 = Equation(m, name="c4")
        c4[...] = Sum([A, F], distance[A, F] * x[A, F]) <= request.maxFuel
        
        obj = Sum([A, F], energy[A, F] * x[A, F])
        
        adoptopia_model = Model(
            m,
            name="adoptopia",
            equations=[c1, c2, c3, c4],
            problem="MIP",
            sense=Sense.MAX,
            objective=obj
        )
        
        adoptopia_model.solve()
        
        status = adoptopia_model.status.name if hasattr(adoptopia_model, 'status') and hasattr(adoptopia_model.status, 'name') else None
        
        if status in ["Infeasible", "InfeasibleNoSolution", "Error"]:
            print("GAMSPy Status:", status, "- using greedy fallback!")
            return solve_greedy(request, True)
            
        assignments = []
        total_score = 0
        total_distance = 0
        
        if x.records is not None and not x.records.empty:
            assigned = x.records[x.records['level'] > 0.5]
            for _, row in assigned.iterrows():
                a_id = row['A']
                f_id = row['F']
                
                a_obj = next((a for a in request.animals if a.id == a_id), None)
                f_obj = next((f for f in request.families if f.id == f_id), None)
                
                if a_obj and f_obj:
                    path = calculate_manhattan_path(request.shelterPosition, f_obj.gridPosition, request.families)
                    dist = manhattan_distance(request.shelterPosition, f_obj.gridPosition, request.families)
                    
                    energy_bonus = max(0, 10 - abs(a_obj.energyLevel - f_obj.energyMatch))
                    match_score = energy_bonus * 10
                    
                    assignments.append(Assignment(
                        animalId=a_id,
                        familyId=f_id,
                        path=path,
                        score=match_score,
                        distance=dist
                    ))
                    
                    total_score += match_score
                    total_distance += dist

        solve_time = time.time() - start_time
        return OptimizeResponse(
            assignments=assignments,
            totalScore=total_score,
            totalDistance=total_distance,
            solveTime=round(solve_time, 4),
            message=f"GAMSPy assigned {len(assignments)} matches.",
            solverUsed="gamspy"
        )

    except Exception as e:
        print(f"GAMSPy Crash Handle: {e}")
        return solve_greedy(request, True)


def solve_full_optimal(request):
    """
    Globally optimal assignment: maximize sum of per-pair energy scores under
    compatibility, one-to-one, and total fuel constraints (MIP via GAMSPy).
    Falls back to greedy only if the solver is unavailable or fails.
    """
    return solve_assignment(request)


def validate_and_fix_level(animals, families, shelter, max_fuel):
    from main import OptimizeRequest, LevelValidationResult

    fixes = []
    animals_adj = [a.model_copy(deep=True) for a in animals]
    families_adj = [f.model_copy(deep=True) for f in families]
    max_fuel_adj = max_fuel

    def run_solve(a_list, f_list, fuel):
        req = OptimizeRequest(
            animals=a_list,
            families=f_list,
            shelterPosition=shelter,
            maxFuel=fuel,
        )
        return solve_full_optimal(req)

    n_match = min(len(animals_adj), len(families_adj))
    if n_match == 0:
        return LevelValidationResult(
            isFeasible=False,
            fixesApplied=fixes,
            animals=animals_adj,
            families=families_adj,
            guaranteedSolutions=0,
            maxFuel=max_fuel_adj,
        )

    threshold = max(1, math.ceil(n_match * 0.5))
    result = run_solve(animals_adj, families_adj, max_fuel_adj)

    if len(result.assignments) >= threshold:
        return LevelValidationResult(
            isFeasible=True,
            fixesApplied=[],
            animals=animals_adj,
            families=families_adj,
            guaranteedSolutions=len(result.assignments),
            maxFuel=max_fuel_adj,
        )

    for i, f in enumerate(families_adj):
        noisy_animals = [
            a
            for a in animals_adj
            if a.noiseLevel > f.noiseLimit and not (a.allergyRisk and f.hasAllergy)
        ]
        if len(noisy_animals) > 2:
            old = f.noiseLimit
            new_lim = min(5, f.noiseLimit + 1)
            if new_lim > old:
                families_adj[i] = f.model_copy(update={"noiseLimit": new_lim})
                fixes.append(
                    f"NOISE LIMIT RELAXED: {f.name} LV{old}→LV{new_lim}"
                )

    allergic_families = sum(1 for x in families_adj if x.hasAllergy)
    risky_animals = [a for a in animals_adj if a.allergyRisk]
    if allergic_families > len(families_adj) * 0.6 and len(risky_animals) > 1:
        target = risky_animals[0]
        try:
            idx = animals_adj.index(target)
        except ValueError:
            idx = 0
        animals_adj[idx] = target.model_copy(update={"allergyRisk": False})
        fixes.append(
            f"ALLERGY RISK CLEARED: {target.name} — LEVEL BALANCE RESTORED"
        )

    if max_fuel_adj < 15:
        max_fuel_adj += 10
        fixes.append("FUEL LIMIT INCREASED: +10 UNITS — ROUTE FEASIBILITY RESTORED")

    result2 = run_solve(animals_adj, families_adj, max_fuel_adj)
    return LevelValidationResult(
        isFeasible=len(result2.assignments) > 0,
        fixesApplied=fixes,
        animals=animals_adj,
        families=families_adj,
        guaranteedSolutions=len(result2.assignments),
        maxFuel=max_fuel_adj,
    )


def judge_player_solution(
    player_assignments,
    optimal_assignments,
    animals,
    families,
    shelter_position,
):
    from main import AssignmentFeedback, JudgeResult, manhattan_distance

    optimal_pairs = {a.animalId: a.familyId for a in optimal_assignments}

    player_score = 0
    feedback_list = []

    for pa in player_assignments:
        animal = next((x for x in animals if x.id == pa.animalId), None)
        family = next((x for x in families if x.id == pa.familyId), None)

        if animal is None or family is None:
            player_score -= 50
            feedback_list.append(
                AssignmentFeedback(
                    animalId=pa.animalId,
                    familyId=pa.familyId,
                    animalName=(animal.name if animal is not None else "???"),
                    familyName=(family.name if family is not None else "???"),
                    isInOptimal=False,
                    energyDelta=99,
                    isCompatible=False,
                    fuelCost=0,
                    pointsEarned=-50,
                    verdict="INVALID",
                    verdictReason="MANIFEST MISMATCH — ID NOT IN PAYLOAD",
                )
            )
            continue

        is_compatible = True
        reason = ""
        if animal.allergyRisk and family.hasAllergy:
            is_compatible = False
            reason = "ALLERGY CONFLICT DETECTED"
        elif animal.noiseLevel > family.noiseLimit:
            is_compatible = False
            reason = (
                f"NOISE LV{animal.noiseLevel} EXCEEDS LIMIT LV{family.noiseLimit}"
            )

        fuel_cost = manhattan_distance(
            shelter_position, family.gridPosition, families
        )

        if not is_compatible:
            verdict = "INVALID"
            points = -50
            feedback_list.append(
                AssignmentFeedback(
                    animalId=pa.animalId,
                    familyId=pa.familyId,
                    animalName=animal.name,
                    familyName=family.name,
                    isInOptimal=False,
                    energyDelta=99,
                    isCompatible=is_compatible,
                    fuelCost=fuel_cost,
                    pointsEarned=points,
                    verdict=verdict,
                    verdictReason=reason,
                )
            )
            player_score += points
            continue

        energy_delta = abs(animal.energyLevel - family.energyMatch)
        is_in_optimal = optimal_pairs.get(pa.animalId) == pa.familyId

        if is_in_optimal:
            verdict = "OPTIMAL"
            points = 150
            reason = "PERFECT MATCH — GAMSPY AGREES"
        elif energy_delta <= 1:
            verdict = "ACCEPTABLE"
            points = 80
            reason = f"NEAR-OPTIMAL — ENERGY DELTA: {energy_delta}"
        else:
            verdict = "SUBOPTIMAL"
            points = 30
            reason = f"SUBOPTIMAL — ENERGY DELTA: {energy_delta}"

        player_score += points
        feedback_list.append(
            AssignmentFeedback(
                animalId=pa.animalId,
                familyId=pa.familyId,
                animalName=animal.name,
                familyName=family.name,
                isInOptimal=is_in_optimal,
                energyDelta=energy_delta,
                isCompatible=is_compatible,
                fuelCost=fuel_cost,
                pointsEarned=points,
                verdict=verdict,
                verdictReason=reason,
            )
        )

    optimal_score = len(optimal_assignments) * 150
    efficiency = (
        (player_score / optimal_score * 100) if optimal_score > 0 else 0.0
    )
    perfect_pairs = sum(1 for f in feedback_list if f.verdict == "OPTIMAL")

    if efficiency >= 90:
        stars = 3
        overall = "OUTSTANDING — HUMAN LOGIC APPROACHES OPTIMAL"
    elif efficiency >= 60:
        stars = 2
        overall = "ACCEPTABLE — GAMSPY DETECTED IMPROVEMENTS"
    else:
        stars = 1
        overall = "SUBOPTIMAL — GAMSPY RECOMMENDS RECALIBRATION"

    return JudgeResult(
        playerScore=player_score,
        optimalScore=optimal_score,
        starRating=stars,
        efficiency=round(efficiency, 1),
        feedback=feedback_list,
        overallVerdict=overall,
        perfectPairs=perfect_pairs,
        totalPairs=len(player_assignments),
    )
