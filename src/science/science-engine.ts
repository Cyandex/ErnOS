/**
 * Science Engine — Orchestrates fast math.js and heavy Python layers.
 *
 * Routes computation requests to the appropriate layer:
 * - Fast path (math.js): expressions, algebra, matrices, units, stats
 * - Heavy path (Python): SymPy symbolic, NumPy arrays, SciPy, custom code
 * - Chemistry: periodic table lookups
 */
const logger = {
  info: (msg: string) => console.log(`[science.engine] ${msg}`),
};
import * as mathLayer from "./mathjs-layer.js";
import { executePython } from "./python-layer.js";
import { lookupElement, formatElement, getElementsByCategory } from "./periodic-table.js";

export type ScienceMode =
  | "evaluate"   // Math expression (math.js fast path)
  | "solve"      // Symbolic solve (Python/SymPy)
  | "matrix"     // Matrix operations
  | "stats"      // Statistics
  | "physics"    // Physical constants + unit conversions
  | "chemistry"  // Periodic table + chemical queries
  | "code"       // Raw Python code execution (sandboxed)
  | "auto";      // Auto-detect best mode

export interface ScienceRequest {
  mode: ScienceMode;
  expression: string;
  timeout?: number;
}

export interface ScienceResult {
  success: boolean;
  result?: string;
  mode: ScienceMode;
  layer: "mathjs" | "python" | "builtin";
  error?: string;
}

/**
 * Execute a science computation.
 */
export async function compute(request: ScienceRequest): Promise<ScienceResult> {
  const { mode, expression, timeout } = request;
  const actualMode = mode === "auto" ? detectMode(expression) : mode;

  logger.info(`Science compute: mode=${actualMode}, expr=${expression.slice(0, 80)}`);

  switch (actualMode) {
    case "evaluate":
      return evaluateMath(expression);

    case "solve":
      return solveSym(expression, timeout);

    case "matrix":
      return matrixOp(expression);

    case "stats":
      return statsOp(expression);

    case "physics":
      return physicsOp(expression);

    case "chemistry":
      return chemistryOp(expression);

    case "code":
      return codeExec(expression, timeout);

    default:
      return { success: false, mode: actualMode, layer: "mathjs", error: `Unknown mode: ${actualMode}` };
  }
}

// ── Mode implementations ────────────────────────────────────────────────────

function evaluateMath(expression: string): ScienceResult {
  const result = mathLayer.evaluate(expression);
  return {
    success: result.success,
    result: result.result,
    mode: "evaluate",
    layer: "mathjs",
    error: result.error,
  };
}

async function solveSym(expression: string, timeout?: number): Promise<ScienceResult> {
  // Wrap in SymPy solve
  const code = `
import sympy
from sympy import symbols, solve, simplify, expand, factor, Eq, sqrt, pi, oo
from sympy.abc import x, y, z, a, b, c, n, t

expr = ${JSON.stringify(expression)}

# Try to solve as equation
try:
    result = str(solve(expr))
except:
    try:
        result = str(sympy.sympify(expr))
    except:
        result = str(eval(expr))
`;

  const pyResult = await executePython(code, timeout);
  return {
    success: pyResult.success,
    result: pyResult.result,
    mode: "solve",
    layer: "python",
    error: pyResult.error,
  };
}

function matrixOp(expression: string): ScienceResult {
  // Try math.js first (handles most matrix ops)
  const result = mathLayer.evaluate(expression);
  return {
    success: result.success,
    result: result.result,
    mode: "matrix",
    layer: "mathjs",
    error: result.error,
  };
}

function statsOp(expression: string): ScienceResult {
  // Try to parse as array of numbers
  try {
    const cleaned = expression.replace(/[[\]]/g, "").trim();
    const numbers = cleaned.split(/[,\s]+/).map(Number).filter((n) => !isNaN(n));

    if (numbers.length > 0) {
      return {
        ...mathLayer.computeStats(numbers),
        mode: "stats",
        layer: "mathjs",
      };
    }
  } catch {
    // Fall through to expression eval
  }

  // Try as math.js expression
  const result = mathLayer.evaluate(expression);
  return {
    success: result.success,
    result: result.result,
    mode: "stats",
    layer: "mathjs",
    error: result.error,
  };
}

function physicsOp(expression: string): ScienceResult {
  // Try unit conversion via math.js
  const result = mathLayer.convertUnit(expression);
  if (result.success) {
    return { ...result, mode: "physics", layer: "mathjs" };
  }

  // Common physics constants
  const constants: Record<string, string> = {
    "speed of light": "c = 299,792,458 m/s",
    "planck constant": "h = 6.626 × 10⁻³⁴ J·s",
    "boltzmann constant": "k_B = 1.381 × 10⁻²³ J/K",
    "avogadro": "N_A = 6.022 × 10²³ mol⁻¹",
    "gravitational constant": "G = 6.674 × 10⁻¹¹ N·m²/kg²",
    "electron mass": "m_e = 9.109 × 10⁻³¹ kg",
    "proton mass": "m_p = 1.673 × 10⁻²⁷ kg",
    "elementary charge": "e = 1.602 × 10⁻¹⁹ C",
    "vacuum permittivity": "ε₀ = 8.854 × 10⁻¹² F/m",
    "vacuum permeability": "μ₀ = 1.257 × 10⁻⁶ H/m",
    "gas constant": "R = 8.314 J/(mol·K)",
    "stefan-boltzmann": "σ = 5.670 × 10⁻⁸ W/(m²·K⁴)",
    "fine structure": "α = 1/137.036",
  };

  const query = expression.toLowerCase();
  for (const [key, value] of Object.entries(constants)) {
    if (query.includes(key)) {
      return { success: true, result: value, mode: "physics", layer: "builtin" };
    }
  }

  return {
    success: false,
    mode: "physics",
    layer: "mathjs",
    error: `Could not parse physics query: ${expression}`,
  };
}

function chemistryOp(expression: string): ScienceResult {
  // Try element lookup
  const el = lookupElement(expression);
  if (el) {
    return {
      success: true,
      result: formatElement(el),
      mode: "chemistry",
      layer: "builtin",
    };
  }

  // Try category search
  const categoryTerms = ["metal", "noble", "halogen", "lanthanide", "actinide", "alkali", "alkaline"];
  const query = expression.toLowerCase();
  for (const term of categoryTerms) {
    if (query.includes(term)) {
      const elements = getElementsByCategory(term);
      if (elements.length > 0) {
        return {
          success: true,
          result: elements.map((e) => `${e.symbol} — ${e.name} (${e.mass} u)`).join("\n"),
          mode: "chemistry",
          layer: "builtin",
        };
      }
    }
  }

  return {
    success: false,
    mode: "chemistry",
    layer: "builtin",
    error: `Element not found: ${expression}`,
  };
}

async function codeExec(code: string, timeout?: number): Promise<ScienceResult> {
  const result = await executePython(code, timeout);
  return {
    success: result.success,
    result: result.result,
    mode: "code",
    layer: "python",
    error: result.error,
  };
}

// ── Auto-detect ─────────────────────────────────────────────────────────────

function detectMode(expression: string): ScienceMode {
  const lower = expression.toLowerCase();

  // Chemistry keywords
  if (/\b(element|atom|periodic|molecule|compound)\b/i.test(lower)) {return "chemistry";}
  // Check if it's a known element symbol/name
  if (lookupElement(expression.trim())) {return "chemistry";}

  // Physics keywords
  if (/\b(speed of light|planck|boltzmann|avogadro|gravitational|electron mass|proton mass)\b/i.test(lower)) {return "physics";}
  if (/\b(to|in)\b.*\b(kg|lb|km|mi|m\/s|mph|kelvin|celsius|fahrenheit)\b/i.test(lower)) {return "physics";}

  // Symbolic solve
  if (/\b(solve|factor|expand|simplify|integrate|differentiate|limit)\b/i.test(lower)) {return "solve";}

  // Statistics
  if (/\b(mean|median|std|variance|statistics|dataset)\b/i.test(lower)) {return "stats";}

  // Matrix
  if (/\b(det|matrix|eigenvalue|transpose|inverse)\b/i.test(lower)) {return "matrix";}

  // Multi-line or import → Python
  if (expression.includes("\n") || /\b(import|numpy|scipy|sympy|np\.)\b/i.test(lower)) {return "code";}

  // Default: math expression
  return "evaluate";
}
