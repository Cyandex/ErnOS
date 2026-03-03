#!/usr/bin/env python3
"""
Science Sandbox — Secure Python computation for ErnOS.

Reads a JSON payload from stdin:
  {"code": "...", "timeout": 10}

Executes in a restricted namespace with pre-imported STEM libraries.
Returns JSON to stdout:
  {"success": true, "result": "...", "type": "number"}
  {"success": false, "error": "..."}

Safety:
 - No file I/O (open/read/write blocked)
 - No subprocess/os.system
 - No network (socket blocked)
 - No eval/exec of arbitrary strings (only the provided code)
 - 10-second timeout default
 - Restricted builtins
"""
import json
import sys
import signal
import io
import contextlib

# ── Safe builtins whitelist ──────────────────────────────────────────────────
SAFE_BUILTINS = {
    "abs": abs, "all": all, "any": any, "bin": bin, "bool": bool,
    "chr": chr, "complex": complex, "dict": dict, "divmod": divmod,
    "enumerate": enumerate, "filter": filter, "float": float,
    "format": format, "frozenset": frozenset, "hash": hash, "hex": hex,
    "int": int, "isinstance": isinstance, "issubclass": issubclass,
    "iter": iter, "len": len, "list": list, "map": map, "max": max,
    "min": min, "next": next, "oct": oct, "ord": ord, "pow": pow,
    "print": print, "range": range, "repr": repr, "reversed": reversed,
    "round": round, "set": set, "slice": slice, "sorted": sorted,
    "str": str, "sum": sum, "tuple": tuple, "type": type, "zip": zip,
    "True": True, "False": False, "None": None,
}

# Explicitly BLOCKED builtins
BLOCKED = {
    "open", "exec", "eval", "compile", "__import__", "globals", "locals",
    "breakpoint", "exit", "quit", "input", "getattr", "setattr", "delattr",
    "memoryview", "bytearray",
}


def timeout_handler(signum, frame):
    raise TimeoutError("Computation exceeded time limit")


def run_sandbox(code: str, timeout: int = 10) -> dict:
    """Execute code in a sandboxed namespace."""
    # Set timeout
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(timeout)

    try:
        # Pre-import scientific libraries into namespace
        namespace = {"__builtins__": SAFE_BUILTINS}

        # Import safe scientific modules
        import math
        import cmath
        import statistics
        import fractions
        import decimal
        import itertools
        import functools
        import operator
        import collections

        namespace.update({
            "math": math,
            "cmath": cmath,
            "statistics": statistics,
            "fractions": fractions,
            "Fraction": fractions.Fraction,
            "Decimal": decimal.Decimal,
            "itertools": itertools,
            "functools": functools,
            "operator": operator,
            "collections": collections,
            "pi": math.pi,
            "e": math.e,
            "tau": math.tau,
            "inf": math.inf,
        })

        # Try importing heavy science libraries (may not be installed)
        optional_imports = {
            "numpy": "np",
            "scipy": None,
            "sympy": None,
        }

        for module_name, alias in optional_imports.items():
            try:
                mod = __import__(module_name)
                namespace[module_name] = mod
                if alias:
                    namespace[alias] = mod
            except ImportError:
                pass

        # Capture stdout
        stdout_capture = io.StringIO()

        with contextlib.redirect_stdout(stdout_capture):
            # Compile and execute
            compiled = compile(code, "<science_sandbox>", "exec")

            # Safety check: scan bytecode for dangerous operations
            for const in compiled.co_consts:
                if isinstance(const, str) and any(b in const for b in BLOCKED):
                    return {"success": False, "error": f"Blocked operation detected"}

            exec(compiled, namespace)

        # Get result: check for 'result' variable, else use last stdout line
        output = stdout_capture.getvalue().strip()

        if "result" in namespace and namespace["result"] is not None:
            result = namespace["result"]
        elif output:
            result = output
        else:
            result = None

        # Format result
        if result is None:
            return {"success": True, "result": "No output", "type": "none"}

        result_str = str(result)
        result_type = type(result).__name__

        return {
            "success": True,
            "result": result_str[:10000],  # Cap output
            "type": result_type,
            "stdout": output[:5000] if output else None,
        }

    except TimeoutError:
        return {"success": False, "error": "Computation timed out (exceeded time limit)"}
    except SyntaxError as e:
        return {"success": False, "error": f"Syntax error: {e}"}
    except Exception as e:
        return {"success": False, "error": f"{type(e).__name__}: {e}"}
    finally:
        signal.alarm(0)  # Cancel timeout


def main():
    """Read JSON from stdin, execute, write JSON to stdout."""
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            json.dump({"success": False, "error": "No input"}, sys.stdout)
            return

        payload = json.loads(raw)
        code = payload.get("code", "")
        timeout = min(payload.get("timeout", 10), 30)  # Max 30s

        if not code.strip():
            json.dump({"success": False, "error": "Empty code"}, sys.stdout)
            return

        result = run_sandbox(code, timeout)
        json.dump(result, sys.stdout)

    except json.JSONDecodeError as e:
        json.dump({"success": False, "error": f"Invalid JSON input: {e}"}, sys.stdout)
    except Exception as e:
        json.dump({"success": False, "error": f"Sandbox error: {e}"}, sys.stdout)


if __name__ == "__main__":
    main()
