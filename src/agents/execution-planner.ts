export interface ExecutionStep {
  id: string;
  name: string;
  agentRole: string;
  task: string;
  dependencies: string[];
}

export interface ExecutionStage {
  stageNum: number;
  parallelSteps: ExecutionStep[];
}

export interface ExecutionPlan {
  objective: string;
  stages: ExecutionStage[];
}

export class PlannerSystem {
  /**
   * Generates a DAG execution plan for a complex objective.
   */
  public async generatePlan(objective: string): Promise<ExecutionPlan> {
    const prompt = `Create a step-by-step Execution Plan for this objective: "${objective}"
Return valid JSON representing the DAG (stages Array containing parallelSteps Array of {id, name, agentRole, task, dependencies}).`;

    console.log(`[ExecutionPlanner] Generating DAG plan for: ${objective}`);
    // const planJson = await llmClient.generateJson(prompt);

    // Mock valid plan
    return {
      objective,
      stages: [
        {
          stageNum: 1,
          parallelSteps: [
            {
              id: "1a",
              name: "Information Gathering",
              agentRole: "Researcher",
              task: "Search for docs.",
              dependencies: [],
            },
            {
              id: "1b",
              name: "API Discovery",
              agentRole: "Researcher",
              task: "Search codebase for APIs.",
              dependencies: [],
            },
          ],
        },
        {
          stageNum: 2,
          parallelSteps: [
            {
              id: "2a",
              name: "Synthesis",
              agentRole: "Writer",
              task: "Combine findings.",
              dependencies: ["1a", "1b"],
            },
          ],
        },
      ],
    };
  }

  /**
   * Executes the DAG plan using the AgentBus for subagent spawning and coordination.
   */
  public async executePlan(plan: ExecutionPlan, bus: any): Promise<Record<string, string>> {
    console.log(`[ExecutionPlanner] Starting execution of ${plan.stages.length}-stage plan.`);
    const results: Record<string, string> = {};

    for (const stage of plan.stages) {
      console.log(`[ExecutionPlanner] Running Stage ${stage.stageNum}...`);

      const promises = stage.parallelSteps.map(async (step) => {
        // Provide context from dependencies
        const depContext = step.dependencies
          .map((d) => `Dependency [${d}]: ${results[d]}`)
          .join("\\n");
        const taskWithContext = `${step.task}\\n\\nPrior Context:\\n${depContext}`;

        // Dispatch to bus
        const result = await bus.request(step.agentRole, taskWithContext);
        results[step.id] = result;
      });

      await Promise.all(promises);
    }

    return results;
  }
}
