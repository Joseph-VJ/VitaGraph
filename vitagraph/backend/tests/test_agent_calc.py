"""The calculator behind the `calculate` tool: exact arithmetic, and nothing else can run."""

from __future__ import annotations

import pytest

from app.agent.calc import MAX_EXPRESSION_CHARS, CalcError, evaluate


@pytest.mark.parametrize(
    ("expression", "expected"),
    [
        ("1 + 2 * 3", 7),
        ("(14.1 - 13.2) / 13.2 * 100", 6.8181818182),
        ("10 / 4", 2.5),
        ("2 ** 10", 1024),
        ("2 ^ 10", 1024),
        ("7 // 2", 3),
        ("7 % 4", 3),
        ("-5 + +3", -2),
        ("round(3.14159, 2)", 3.14),
        ("min(4, 2, 9)", 2),
        ("max(4, 2, 9)", 9),
        ("abs(-3.5)", 3.5),
        ("mean(12.5, 13.5, 14)", 13.3333333333),
        ("avg(2, 4)", 3),
        ("pct_change(13.2, 14.1)", 6.8181818182),
        ("pct_change(200, 150)", -25),
        ("sqrt(144)", 12),
        ("log10(1000)", 3),
        ("round(70 / (1.75 ** 2), 1)", 22.9),  # a BMI
        ("98.6 * 1", 98.6),
        ("pi * 2", 6.2831853072),
        ("5 × 3 ÷ 5", 3),
    ],
)
def test_arithmetic_is_exact(expression, expected):
    assert evaluate(expression)["result"] == pytest.approx(expected, rel=1e-9)


def test_the_result_carries_a_readable_line():
    out = evaluate("pct_change(13.2, 14.1)")
    assert out["expression"] == "pct_change(13.2, 14.1)"
    assert out["text"].startswith("pct_change(13.2, 14.1) = 6.818181818")
    assert evaluate("2 + 2")["text"] == "2 + 2 = 4"


@pytest.mark.parametrize(
    "expression",
    [
        "__import__('os').system('echo hi')",
        "open('x.txt')",
        "().__class__.__bases__",
        "[1, 2, 3][0]",
        "(lambda: 1)()",
        "x + 1",
        "abs.__name__",
        "exec('1')",
        "eval('1')",
        "'a' * 3",
        "True + 1",
        "None",
        "1 if 1 else 2",
        "[x for x in range(3)]",
        "max(*[1, 2])",
        "round(1.5, ndigits=0)",
        "print(1)",
        "1; import os",
        "f'{1}'",
        "a := 3",
    ],
)
def test_anything_that_is_not_plain_arithmetic_is_refused(expression):
    with pytest.raises(CalcError):
        evaluate(expression)


@pytest.mark.parametrize(
    "expression",
    ["1 / 0", "5 % 0", "9 ** 9 ** 9", "10 ** 400", "2 ** 101", "sqrt(-1)", "log(0)", "log10(-5)", "pct_change(0, 5)", "exp(1000)", "1e308 * 10"],
)
def test_impossible_or_oversized_numbers_give_a_clear_error_not_a_crash(expression):
    with pytest.raises(CalcError):
        evaluate(expression)


def test_input_size_is_limited():
    with pytest.raises(CalcError, match="longer than"):
        evaluate("1+" * (MAX_EXPRESSION_CHARS) + "1")
    with pytest.raises(CalcError, match="too complicated"):
        evaluate("+".join(["1"] * 70))
    with pytest.raises(CalcError):
        evaluate("")
    with pytest.raises(CalcError):
        evaluate("   ")


def test_errors_never_echo_internals():
    try:
        evaluate("__import__('os')")
    except CalcError as exc:
        assert "Traceback" not in str(exc) and "os" not in str(exc).split("allowed")[0].lower()


# ---- through the real tool server (stdio), as the harness would call it

def test_the_calculate_tool_answers_over_the_protocol_and_refuses_code():
    from tests.conftest import make_user
    from tests.test_agent_mcp_server import call_mcp_tool

    user = make_user("Calc persona")
    ok = call_mcp_tool(user["id"], "calculate", {"expression": "pct_change(13.2, 14.1)"})
    assert ok["result"] == pytest.approx(6.8181818182) and "=" in ok["text"]
    bad = call_mcp_tool(user["id"], "calculate", {"expression": "__import__('os').getcwd()"})
    assert set(bad) == {"error"} and "result" not in bad
    zero = call_mcp_tool(user["id"], "calculate", {"expression": "1/0"})
    assert zero == {"error": "Division by zero."}
