"""A small, safe calculator for the AI Agent's `calculate` tool.

Exact arithmetic is done here instead of by the model. The expression is parsed with `ast` and only a
whitelist of nodes is evaluated: numbers, `+ - * / // % **`, brackets and a few named functions. There is no
name lookup beyond `pi` and `e`, no attribute access, no subscripts and no calls except the listed ones,
and the size of every step is bounded. Nothing here reads files, the network or the database.
"""

from __future__ import annotations

import ast
import math
import operator
from typing import Any, Callable

MAX_EXPRESSION_CHARS = 200
MAX_NODES = 120
MAX_ABS = 1e100
MAX_EXPONENT = 100
MAX_ARGS = 50


class CalcError(ValueError):
    """The expression is not allowed or cannot be computed. The message is safe to show."""


def _pct_change(old: float, new: float) -> float:
    if old == 0:
        raise CalcError("A percent change from 0 is undefined.")
    return (new - old) / abs(old) * 100.0


def _mean(*values: float) -> float:
    if not values:
        raise CalcError("mean needs at least one number.")
    return math.fsum(values) / len(values)


def _sqrt(x: float) -> float:
    if x < 0:
        raise CalcError("The square root of a negative number is not defined here.")
    return math.sqrt(x)


def _log(x: float, base: float | None = None) -> float:
    if x <= 0 or (base is not None and (base <= 0 or base == 1)):
        raise CalcError("The logarithm is not defined for these numbers.")
    return math.log(x) if base is None else math.log(x, base)


def _log10(x: float) -> float:
    if x <= 0:
        raise CalcError("The logarithm is not defined for these numbers.")
    return math.log10(x)


FUNCTIONS: dict[str, Callable[..., float]] = {
    "abs": abs,
    "round": round,
    "min": min,
    "max": max,
    "sum": lambda *v: math.fsum(v),
    "sqrt": _sqrt,
    "log": _log,
    "ln": _log,
    "log10": _log10,
    "exp": lambda x: math.exp(x) if x < 700 else _too_big(),
    "mean": _mean,
    "avg": _mean,
    "pct_change": _pct_change,
}
CONSTANTS = {"pi": math.pi, "e": math.e}

_BINARY: dict[type, Callable[[float, float], float]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}


def _too_big() -> float:
    raise CalcError("The number is too large.")


def _check(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise CalcError("Only numbers are allowed.")
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        raise CalcError("The result is not a finite number.")
    if abs(value) > MAX_ABS:
        raise CalcError("The number is too large.")
    return value


def _eval(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _eval(node.body)
    if isinstance(node, ast.Constant):
        return _check(node.value)
    if isinstance(node, ast.Name):
        if node.id in CONSTANTS:
            return CONSTANTS[node.id]
        raise CalcError(f"'{node.id}' is not a known name. Use numbers, pi, e and the listed functions.")
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        value = _eval(node.operand)
        return value if isinstance(node.op, ast.UAdd) else -value
    if isinstance(node, ast.BinOp) and type(node.op) in _BINARY:
        left, right = _eval(node.left), _eval(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > MAX_EXPONENT:
            raise CalcError("The exponent is too large.")
        try:
            return _check(_BINARY[type(node.op)](left, right))
        except ZeroDivisionError as exc:
            raise CalcError("Division by zero.") from exc
        except OverflowError as exc:
            raise CalcError("The number is too large.") from exc
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in FUNCTIONS or node.keywords:
            raise CalcError("Only these functions are allowed: " + ", ".join(sorted(FUNCTIONS)) + ".")
        if len(node.args) > MAX_ARGS or any(isinstance(a, ast.Starred) for a in node.args):
            raise CalcError("Too many arguments.")
        args = [_eval(a) for a in node.args]
        try:
            return _check(FUNCTIONS[node.func.id](*args))
        except CalcError:
            raise
        except (TypeError, ValueError, OverflowError) as exc:
            raise CalcError(f"{node.func.id} could not be computed with these numbers.") from exc
    raise CalcError("That is not a plain arithmetic expression.")


def evaluate(expression: str) -> dict[str, Any]:
    """Compute `expression`. Returns {"expression", "result", "text"}; raises CalcError when not allowed."""
    expr = (expression or "").strip().replace("^", "**").replace("×", "*").replace("÷", "/")
    if not expr:
        raise CalcError("An expression is required.")
    if len(expr) > MAX_EXPRESSION_CHARS:
        raise CalcError(f"The expression is longer than {MAX_EXPRESSION_CHARS} characters.")
    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError as exc:
        raise CalcError("That is not a valid arithmetic expression.") from exc
    if sum(1 for _ in ast.walk(tree)) > MAX_NODES:
        raise CalcError("The expression is too complicated.")
    value = _eval(tree)
    result: float | int = int(value) if isinstance(value, float) and value.is_integer() and abs(value) < 1e15 else round(value, 10)
    return {"expression": expression.strip(), "result": result, "text": f"{expression.strip()} = {format(result, '.10g') if isinstance(result, float) else result}"}
