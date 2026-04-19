"""Minimal GAMSPy smoke test — run: python smoke_gamspy.py"""

from gamspy import Container, Equation, Model, Parameter, Sense, Set, Sum, Variable


def main() -> None:
    print("Import OK; building tiny MIP…")
    m = Container()
    i = Set(m, name="I", records=["i1"])
    coeff = Parameter(m, name="c", domain=[i], records=[["i1", 1]])
    x = Variable(m, name="x", domain=[i], type="Binary")
    cap = Equation(m, name="cap", domain=[i])
    cap[i] = x[i] <= 1
    objective = Sum(i, coeff[i] * x[i])
    model = Model(
        m,
        name="tiny_smoke",
        equations=[cap],
        problem="MIP",
        sense=Sense.MAX,
        objective=objective,
    )
    model.solve()
    print("status:", model.status)
    print("x:", x.records)
    print("GAMSPy + solver OK.")


if __name__ == "__main__":
    main()
