import json
from main import OptimizeRequest, AnimalData, FamilyData, Position
from optimizer import solve_assignment

def print_result(name, res):
    print(f"\n{'='*40}")
    print(f"--- TEST: {name} ---")
    print(f"Message: {res.message}")
    print(f"Time: {res.solveTime}s")
    print(f"Total Assignments: {len(res.assignments)}")
    print(f"Total Fuel Consumed: {res.totalDistance}")
    print(f"Total Score: {res.totalScore}")
    for a in res.assignments:
        print(f"  -> Match: Animal {a.animalId} to Family {a.familyId} | Dist: {a.distance} | Score: {a.score}")
    print(f"{'='*40}\n")


# Base standard entities
base_animals = [
    AnimalData(id="a1", name="Cat1", species="cat", allergyRisk=False, noiseLevel=1, energyLevel=3),
    AnimalData(id="a2", name="Dog1", species="dog", allergyRisk=False, noiseLevel=1, energyLevel=3),
    AnimalData(id="a3", name="Rab1", species="rabbit", allergyRisk=False, noiseLevel=1, energyLevel=3)
]
base_families = [
    FamilyData(id="f1", name="Fam1", gridPosition=Position(x=1,y=1), hasAllergy=False, noiseLimit=5, energyMatch=3),
    FamilyData(id="f2", name="Fam2", gridPosition=Position(x=1,y=2), hasAllergy=False, noiseLimit=5, energyMatch=3),
    FamilyData(id="f3", name="Fam3", gridPosition=Position(x=1,y=3), hasAllergy=False, noiseLimit=5, energyMatch=3)
]

# Test 1: Perfect complete matching scenario
req1 = OptimizeRequest(
    animals=base_animals,
    families=base_families,
    shelterPosition=Position(x=4,y=4),
    maxFuel=50
)
res1 = solve_assignment(req1)
print_result("Standard 3x3 Valid Compatibility", res1)


# Test 2: Incompatible Pair (Allergy strict exclusion logic override)
incompat_families = [
    FamilyData(id="f1", name="Fam1", gridPosition=Position(x=1,y=1), hasAllergy=True, noiseLimit=5, energyMatch=3), # Allergic!
    FamilyData(id="f2", name="Fam2", gridPosition=Position(x=1,y=2), hasAllergy=False, noiseLimit=5, energyMatch=3)
]
incompat_animal = [
    AnimalData(id="a1", name="Cat1", species="cat", allergyRisk=True, noiseLevel=1, energyLevel=3), # Risky!
    AnimalData(id="a2", name="Dog1", species="dog", allergyRisk=False, noiseLevel=1, energyLevel=3)
]
req2 = OptimizeRequest(
    animals=incompat_animal,
    families=incompat_families,
    shelterPosition=Position(x=4,y=4),
    maxFuel=50
)
res2 = solve_assignment(req2)
print_result("Conflict Testing (1 Incompatible Pair)", res2)


# Test 3: Zero fuel stress constraint limit testing
req3 = OptimizeRequest(
    animals=base_animals,
    families=base_families,
    shelterPosition=Position(x=4,y=4),
    maxFuel=0
)
res3 = solve_assignment(req3)
print_result("Starvation / Zero Fuel Budget", res3)
