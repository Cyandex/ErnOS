import { systemMemory } from "../../memory/orchestrator.js";

// Note: To be wired to V4 LLM APIs
export type MediatorVerdict = "ACCEPT" | "ANNOTATE" | "REJECT" | "DEFER";

export interface ArbitrationResult {
  verdict: MediatorVerdict;
  reasoning: string;
  actionTaken: string;
}

export class MediatorSys {
  /**
   * Arbitrates disputes between user claims and established CORE KG knowledge.
   */
  public async arbitrate(
    userClaim: { subject: string; predicate: string; object: string },
    coreFact: { subject: string; predicate: string; object: string },
    userEvidence: string = "",
    userId?: string,
  ): Promise<ArbitrationResult> {
    const prompt = `You are the Mediator (Observer).
Arbitrate a knowledge dispute between a User Claim and Established Core Knowledge.

CORE KNOWLEDGE (Fact from System Foundation):
${coreFact.subject} -> ${coreFact.predicate} -> ${coreFact.object}

USER CLAIM (Attempting to overwrite or contradict):
${userClaim.subject} -> ${userClaim.predicate} -> ${userClaim.object}

USER EVIDENCE PROVIDED:
"${userEvidence}"

ARBITRATION FRAMEWORK (evaluate all 5 criteria):
1. **Temporal Recency** — Is the user's claim more recent than the core fact? Recent information may supersede older knowledge in fast-changing domains.
2. **Empirical Evidence** — Did the user provide verifiable evidence? Citations, data, screenshots, or reproducible claims outweigh unsupported assertions.
3. **Logical Consistency** — Is the user's claim internally consistent? Does it contradict other established facts?
4. **Factual Domain** — Is this a HARD fact (math, physics, verified history) or a SOFT fact (opinion, preference, cultural)? Hard facts require stronger evidence to overturn.
5. **Source Authority** — Does the user have domain expertise? Is the core fact from a primary or secondary source?

OUTPUT:
First line must be exactly one verdict:
ACCEPT - User claim is factually superior. Update CORE knowledge.
REJECT - User claim is false, hallucinated, or insufficiently evidenced. Maintain core fact.
ANNOTATE - User claim adds valid nuance or perspective. Keep original, add annotation.
DEFER - Insufficient evidence from both sides. Quarantine for later review.

Second line onwards: brief reasoning explaining your evaluation of each relevant criterion.`;

    // const response = await llmClient.generate(prompt);
    // Mock response parsing
    const response = "REJECT\\nInsufficient evidence provided by user.";

    const lines = response.split("\\n");
    const verdictStr = lines[0].trim().toUpperCase() as MediatorVerdict;
    const reasoning = lines.slice(1).join("\\n").trim();

    return this.executeVerdict(verdictStr, reasoning, userClaim, coreFact, userId);
  }

  private async executeVerdict(
    verdict: MediatorVerdict,
    reasoning: string,
    userClaim: any,
    coreFact: any,
    userId?: string,
  ): Promise<ArbitrationResult> {
    let actionTaken = "";

    switch (verdict) {
      case "ACCEPT":
        // Overwrite in KG
        await systemMemory.knowledgeGraph.addRelationship(
          userClaim.subject,
          userClaim.predicate,
          userClaim.object,
          undefined,
          -1,
        );
        systemMemory.reconciler.invalidateStaleVectors(
          coreFact.subject,
          coreFact.object,
          "Mediator ACCEPT",
        );
        actionTaken = "Overwrote core fact with user claim.";
        break;

      case "ANNOTATE":
        // Add nuance
        await systemMemory.knowledgeGraph.addRelationship(
          userClaim.subject,
          `${userClaim.predicate}_NUANCE`,
          userClaim.object,
          undefined,
          -1,
        );
        actionTaken = "Added nuanced edge alongside core fact.";
        break;

      case "DEFER":
        // Add to quarantine
        // systemMemory.knowledgeGraph.quarantine.addFact(...)
        actionTaken = "Quarantined claim for future review.";
        break;

      case "REJECT":
      default:
        actionTaken = "Rejected user claim. Maintained core fact.";
        break;
    }

    console.log(`[Mediator] Dispute arbitrated. Verdict: ${verdict}. Action: ${actionTaken}`);

    return { verdict, reasoning, actionTaken };
  }
}

export const mediator = new MediatorSys();
