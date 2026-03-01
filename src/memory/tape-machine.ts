import * as fs from "fs";
import { randomUUID } from "node:crypto";
import * as path from "path";

export interface TapeSymbol {
  id: string;
  type: "DATA" | "PROGRAM" | "GOAL" | "MEMORY" | "EMPTY";
  content: string;
  metadata: Record<string, any>;
}

export interface TapeCell {
  x: number;
  y: number;
  z: number;
  symbol: TapeSymbol;
}

export class TapeMachine {
  private userId: string;
  private scope: string;
  private persistPath: string;
  private tape: Map<string, TapeCell>;
  private head: { x: number; y: number; z: number };

  constructor(userId: string, scope: string = "PUBLIC") {
    this.userId = userId;
    this.scope = scope;
    this.persistPath = path.join(process.cwd(), "memory", "tape", `${userId}_${scope}.json`);
    this.tape = new Map();
    this.head = { x: 0, y: 0, z: 0 };
    this.loadFromDisk();
  }

  private getKey(x: number, y: number, z: number) {
    return `${x},${y},${z}`;
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = fs.readFileSync(this.persistPath, "utf-8");
        const parsed = JSON.parse(data);
        this.head = parsed.head || { x: 0, y: 0, z: 0 };
        const cells = parsed.cells || [];
        for (const cell of cells) {
          this.tape.set(this.getKey(cell.x, cell.y, cell.z), cell);
        }
      }
    } catch (e) {
      console.warn(`Failed to load tape for ${this.userId} (${this.scope}): ${e}`);
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = {
        head: this.head,
        cells: Array.from(this.tape.values()),
      };
      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error(`Failed to persist tape: ${e}`);
    }
  }

  // --- Core Operations --- //

  public seek(x: number, y: number, z: number) {
    this.head = { x, y, z };
    this.saveToDisk();
  }

  public read(): TapeSymbol | null {
    const cell = this.tape.get(this.getKey(this.head.x, this.head.y, this.head.z));
    return cell ? cell.symbol : null;
  }

  public write(type: TapeSymbol["type"], content: string, metadata: Record<string, any> = {}) {
    const symbol: TapeSymbol = {
      id: `sym_${randomUUID()}`,
      type,
      content,
      metadata,
    };
    this.tape.set(this.getKey(this.head.x, this.head.y, this.head.z), {
      x: this.head.x,
      y: this.head.y,
      z: this.head.z,
      symbol,
    });
    this.saveToDisk();
    return symbol.id;
  }

  public getRawView(radius: number = 2): string {
    let view = `Tape Machine View (Scope: ${this.scope}, Position: X=${this.head.x} Y=${this.head.y} Z=${this.head.z})\n`;
    view += `---------------------------------------------------------\n`;

    // Simplistic rendering just for Z axis at current Y layer
    for (let x = this.head.x - radius; x <= this.head.x + radius; x++) {
      const cell = this.tape.get(this.getKey(x, this.head.y, this.head.z));
      const marker = x === this.head.x ? ">>" : "  ";
      if (cell) {
        view += `${marker} [X:${x}] [${cell.symbol.type}] ${cell.symbol.content}\n`;
      } else {
        view += `${marker} [X:${x}] [EMPTY]\n`;
      }
    }
    return view;
  }

  /**
   * Compact the tape — remove EMPTY cells and defragment.
   * Called by the Dream Consolidation daemon during nightly optimization.
   * Returns the number of cells removed.
   */
  public compact(): number {
    let removed = 0;
    for (const [key, cell] of this.tape.entries()) {
      if (cell.symbol.type === "EMPTY") {
        this.tape.delete(key);
        removed++;
      }
    }
    if (removed > 0) this.saveToDisk();
    return removed;
  }

  /** Get the total number of cells on this tape */
  public getCellCount(): number {
    return this.tape.size;
  }

  /** Get compact HUD summary for system prompt injection. */
  public getFormattedHud(): string {
    const cellCount = this.tape.size;
    const { x, y, z } = this.head;

    if (cellCount === 0) {
      return `Execution Head: [${x},${y},${z}] | Tape: empty`;
    }

    // Get cell at focus
    const focusCell = this.tape.get(this.getKey(x, y, z));
    const focusInfo = focusCell
      ? `${focusCell.symbol.type}: ${focusCell.symbol.content.slice(0, 80)}${focusCell.symbol.content.length > 80 ? "..." : ""}`
      : "--- BLANK ---";

    // Layer summary
    const layerMap = new Map<string, number>();
    for (const cell of this.tape.values()) {
      const layerKey = `Y=${cell.y},Z=${cell.z}`;
      layerMap.set(layerKey, (layerMap.get(layerKey) ?? 0) + 1);
    }

    const layers = Array.from(layerMap.entries())
      .map(([k, v]) => `${k}: ${v} cells`)
      .join(" | ");

    return [
      `Execution Head: [${x},${y},${z}] | Total cells: ${cellCount}`,
      `Focus: ${focusInfo}`,
      `Layers: ${layers}`,
    ].join("\n");
  }
}
