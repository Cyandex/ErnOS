/**
 * Math.js Layer — Fast, in-process scientific computation.
 *
 * Provides instant math via math.js: expression evaluation, algebra,
 * matrix operations, statistics, unit conversions, complex numbers.
 *
 * Safety: No code execution — only math.js expression parser.
 */
import { create, all, type MathJsInstance } from "mathjs";
const logger = {
  info: (msg: string) => console.log(`[science.mathjs] ${msg}`),
  warn: (msg: string) => console.warn(`[science.mathjs] ${msg}`),
};

// Create a sandboxed math.js instance — no access to Node internals
const math: MathJsInstance = create(all, {
  matrix: "Array", // Use plain arrays for JSON-safe output
});

export interface MathResult {
  success: boolean;
  result?: string;
  type?: string;
  error?: string;
}

/**
 * Evaluate a mathematical expression using math.js.
 *
 * Supports: arithmetic, algebra, matrices, trig, calculus (derivative),
 * statistics, units, complex numbers.
 *
 * @example evaluate("det([[1,2],[3,4]])")    → "-2"
 * @example evaluate("sqrt(144) + 3^2")      → "21"
 * @example evaluate("5.4 kg to lb")          → "11.905 lb"
 */
export function evaluate(expression: string): MathResult {
  try {
    // Sanitize: remove markdown code fences if present
    const cleaned = expression
      .replace(/^```[\s\S]*?\n/, "")
      .replace(/\n```$/, "")
      .trim();

    if (!cleaned) {
      return { success: false, error: "Empty expression" };
    }

    const result = math.evaluate(cleaned);
    const formatted = formatResult(result);

    logger.info(`Evaluated: ${cleaned} → ${formatted.slice(0, 100)}`);

    return {
      success: true,
      result: formatted,
      type: typeof result === "object" ? "matrix" : typeof result,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`math.js eval failed: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Compute basic statistics on a dataset.
 */
export function computeStats(data: number[]): MathResult {
  try {
    if (!data.length) {
      return { success: false, error: "Empty dataset" };
    }

    const stats = {
      count: data.length,
      mean: math.mean(data),
      median: math.median(data),
      std: math.std(data),
      min: math.min(data),
      max: math.max(data),
      variance: math.variance(data),
    };

    return {
      success: true,
      result: Object.entries(stats)
        .map(([k, v]) => `${k}: ${typeof v === "number" ? Number(v.toFixed(6)) : String(v)}`)
        .join("\n"),
      type: "statistics",
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Unit conversion using math.js built-in unit system.
 */
export function convertUnit(expression: string): MathResult {
  return evaluate(expression); // math.js handles "5 km to miles" natively
}

function formatResult(value: unknown): string {
  if (value === undefined || value === null) {return "undefined";}
  if (typeof value === "number") {return Number(value.toPrecision(15)).toString();}
  if (typeof value === "string") {return value;}
  if (typeof value === "boolean") {return String(value);}

  // Matrix / array
  if (Array.isArray(value)) {
    // Check if it's a 2D matrix
    if (value.length > 0 && Array.isArray(value[0])) {
      return `[${value.map((row) => `[${(row as number[]).map((v) => formatResult(v)).join(", ")}]`).join(",\n ")}]`;
    }
    return `[${value.map((v) => formatResult(v)).join(", ")}]`;
  }

  // math.js object types (Unit, Complex, etc.)
  if (typeof value === "object" && value !== null && "toString" in value) {
    return (value as { toString(): string }).toString();
  }

  return JSON.stringify(value);
}
