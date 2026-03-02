/**
 * Post-build patch: fix circular ESM imports in dist/
 *
 * Rolldown generates circular ESM dependencies between entry.js and its
 * chunk files. Multiple chunks import rolldown runtime helpers (__esmMin,
 * __exportAll) from entry.js, but entry.js also imports from those chunks.
 * In Node.js v25+, ESM circular imports cause these helpers to be undefined
 * when chunks call them at module-evaluation time.
 *
 * This script finds ALL chunk files that import __esmMin or __exportAll from
 * entry.js and replaces those specific imports with local inline definitions,
 * breaking the circular dependency while preserving all other imports.
 */

import fs from "node:fs";
import path from "node:path";

const DIST_DIR = path.resolve(import.meta.dirname ?? ".", "../dist");

// Rolldown runtime helpers as defined by rolldown
const HELPERS: Record<string, string> = {
  __esmMin: `var __esmMin = (fn, res) => () => (fn && (res = fn(fn = 0)), res);`,
  __exportAll: `var __exportAll = (target, source) => { for (var key in source) if (Object.getOwnPropertyDescriptor(target, key) === undefined) Object.defineProperty(target, key, { enumerable: true, get: () => source[key] }); return target; };`,
};

function patchChunks(): void {
  if (!fs.existsSync(DIST_DIR)) {
    console.log("[patch-entry-esm-init] dist/ not found, skipping.");
    return;
  }

  const files = fs.readdirSync(DIST_DIR).filter((f) => f.endsWith(".js") && f !== "entry.js");
  let patchedCount = 0;

  for (const file of files) {
    const filePath = path.join(DIST_DIR, file);
    let content = fs.readFileSync(filePath, "utf8");
    let modified = false;

    // Process each line that is an import from entry.js
    const lines = content.split("\n");
    const newLines: string[] = [];

    for (const line of lines) {
      // Check if this line is an import from entry.js
      const importMatch = line.match(/^import \{([^}]+)\} from "\.\/entry\.js";$/);
      if (!importMatch) {
        newLines.push(line);
        continue;
      }

      const bindingsStr = importMatch[1];
      // Split bindings by comma
      const bindings = bindingsStr
        .split(",")
        .map((b) => b.trim())
        .filter((b) => b.length > 0);

      const keptBindings: string[] = [];
      const inlinedHelpers: string[] = [];

      for (const binding of bindings) {
        // Check if this binding is a helper we need to inline
        let isHelper = false;
        for (const helperName of Object.keys(HELPERS)) {
          if (binding.endsWith(`as ${helperName}`)) {
            inlinedHelpers.push(helperName);
            isHelper = true;
            break;
          }
        }
        if (!isHelper) {
          keptBindings.push(binding);
        }
      }

      if (inlinedHelpers.length === 0) {
        // No helpers found in this import line, keep as-is
        newLines.push(line);
        continue;
      }

      modified = true;

      // Re-assemble the import without the helper bindings
      if (keptBindings.length > 0) {
        newLines.push(`import { ${keptBindings.join(", ")} } from "./entry.js";`);
      }
      // Add inline definitions for each helper
      for (const helperName of inlinedHelpers) {
        newLines.push(HELPERS[helperName]);
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, newLines.join("\n"));
      patchedCount++;
      console.log(`[patch-entry-esm-init] Patched ${file}`);
    }
  }

  if (patchedCount === 0) {
    console.log("[patch-entry-esm-init] No circular helper imports found, skipping.");
  } else {
    console.log(`[patch-entry-esm-init] Patched ${patchedCount} files.`);
  }
}

patchChunks();
