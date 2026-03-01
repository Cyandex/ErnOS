/**
 * Cognitive Loop — Mid-Generation Self-Monitoring
 *
 * Lightweight pattern-based checks that run on streamed text as it's generated.
 * NOT a full LLM audit (that's the Observer post-hoc). This catches obvious
 * hallucination patterns in real-time:
 *
 * 1. Ghost tool claims ("I checked the database" without tool call)
 * 2. Fabricated citations ("According to [source]" without memory_search)
 * 3. Confidence without grounding ("I can confirm that..." without evidence)
 * 4. Image hallucination ("I can see in the image" when no image provided)
 *
 * Ported from ErnOS 3.0's SuperEgo mid-generation awareness.
 * Warnings are fed into the post-hoc Observer audit as additional evidence.
 */

// ─── Pattern Definitions ─────────────────────────────────────────────

const GHOST_TOOL_PATTERNS = [
  /I (?:checked|searched|queried|looked up|looked at|accessed|ran|reviewed|scanned|analyzed) (?:the |my |your |our )?(?:database|files|records|logs|system|server|API|data|codebase|repository|repo)/i,
  /I (?:just |already )?(?:verified|confirmed|validated) (?:this |that |it )?(?:in |with |against |from )?(?:the |my |our )?(?:database|system|records|logs|files)/i,
  /the (?:database|system|records|logs|server) (?:shows|indicates|confirms|reveals|returned)/i,
];

const FABRICATED_CITATION_PATTERNS = [
  /(?:According to|As (?:stated|mentioned|noted|documented|described) in|Based on (?:my |the )?(?:research|analysis|findings|investigation))/i,
  /(?:The documentation (?:states|says|mentions|indicates)|(?:Official|Internal) (?:records|sources|documentation) (?:show|indicate|confirm))/i,
  /\[(?:source|citation|ref)\s*\d*\]/i,
];

const IMAGE_HALLUCINATION_PATTERNS = [
  /I (?:can )?(?:see|observe|notice|detect|identify|spot|make out) .*?(?:in |from )?(?:the |this |your )?(?:image|photo|picture|screenshot|diagram|figure|visual)/i,
  /(?:The |This |Your )?(?:image|photo|picture|screenshot) (?:shows|depicts|displays|contains|reveals|illustrates)/i,
  /(?:Looking at|Examining|Analyzing) (?:the |this |your )?(?:image|photo|picture|screenshot)/i,
];

const CONFIDENCE_WITHOUT_EVIDENCE_PATTERNS = [
  /I (?:can )?(?:definitely|certainly|absolutely|100%) (?:confirm|verify|guarantee|assure you)/i,
  /I(?:'m| am) (?:certain|sure|positive|confident) (?:that |about )?/i,
  /(?:There is no doubt|Without question|It(?:'s| is) (?:definitely|certainly|absolutely) (?:true|correct|the case))/i,
];

// ─── Types ───────────────────────────────────────────────────────────

export interface CognitiveLoopState {
  accumulatedText: string;
  toolsCalled: Set<string>;
  imageCount: number;
  warnings: string[];
  lastCheckLength: number;
}

// ─── API ─────────────────────────────────────────────────────────────

/** Create a new cognitive loop state for one agent turn */
export function createCognitiveLoop(imageCount: number): CognitiveLoopState {
  return {
    accumulatedText: "",
    toolsCalled: new Set(),
    imageCount,
    warnings: [],
    lastCheckLength: 0,
  };
}

/** Feed a streamed text chunk into the loop */
export function feedChunk(state: CognitiveLoopState, chunk: string): void {
  state.accumulatedText += chunk;

  // Only run pattern checks every 200 chars to avoid excessive regex thrashing
  if (state.accumulatedText.length - state.lastCheckLength < 200) return;
  state.lastCheckLength = state.accumulatedText.length;

  const text = state.accumulatedText;

  // 1. Ghost tool claims — agent claims to have accessed something without any tool call
  if (state.toolsCalled.size === 0) {
    for (const pattern of GHOST_TOOL_PATTERNS) {
      if (pattern.test(text) && !state.warnings.some((w) => w.startsWith("GHOST_TOOL"))) {
        state.warnings.push(
          "GHOST_TOOL: Agent claims to have accessed a system/database but no tool calls were made this turn",
        );
        break;
      }
    }
  }

  // 2. Fabricated citations — agent cites sources without memory_search
  if (!state.toolsCalled.has("memory_search") && !state.toolsCalled.has("memory_get")) {
    for (const pattern of FABRICATED_CITATION_PATTERNS) {
      if (pattern.test(text) && !state.warnings.some((w) => w.startsWith("FABRICATED_CITATION"))) {
        state.warnings.push(
          "FABRICATED_CITATION: Agent cites sources/documentation but no memory_search or memory_get was called",
        );
        break;
      }
    }
  }

  // 3. Image hallucination — agent describes visual content when no images were provided
  if (state.imageCount === 0) {
    for (const pattern of IMAGE_HALLUCINATION_PATTERNS) {
      if (pattern.test(text) && !state.warnings.some((w) => w.startsWith("IMAGE_HALLUCINATION"))) {
        state.warnings.push(
          "IMAGE_HALLUCINATION: Agent describes visual content but no images were provided in this turn",
        );
        break;
      }
    }
  }

  // 4. Confidence without evidence — agent asserts certainty without tool-backed evidence
  if (state.toolsCalled.size === 0) {
    for (const pattern of CONFIDENCE_WITHOUT_EVIDENCE_PATTERNS) {
      if (pattern.test(text) && !state.warnings.some((w) => w.startsWith("UNFOUNDED_CONFIDENCE"))) {
        state.warnings.push(
          "UNFOUNDED_CONFIDENCE: Agent expresses strong certainty without tool-backed evidence",
        );
        break;
      }
    }
  }
}

/** Register a tool call during this turn */
export function registerToolCall(state: CognitiveLoopState, toolName: string): void {
  state.toolsCalled.add(toolName);
}

/** Get all warnings collected during this turn */
export function getWarnings(state: CognitiveLoopState): string[] {
  return [...state.warnings];
}
