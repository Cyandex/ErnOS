/**
 * Classifies tool calls dynamically as MUTATING or READONLY.
 * Executes READONLY tools concurrently to save time, and MUTATING tools sequentially.
 */
export class ParallelToolExecutor {
  private readonly MUTATING_PREFIXES = [
    "create",
    "update",
    "delete",
    "write",
    "insert",
    "modify",
    "add",
    "remove",
    "set",
    "run_command",
    "sudo",
  ];

  public isMutating(toolName: string): boolean {
    const lower = toolName.toLowerCase();
    return this.MUTATING_PREFIXES.some(
      (prefix) => lower.startsWith(prefix) || lower.includes(`_${prefix}`),
    );
  }

  public async execute(
    toolCalls: Array<{ id: string; name: string; args: any }>,
    executeFn: (name: string, args: any) => Promise<any>,
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const mutating: typeof toolCalls = [];
    const readOnly: typeof toolCalls = [];

    // Classify
    for (const call of toolCalls) {
      if (this.isMutating(call.name)) {
        mutating.push(call);
      } else {
        readOnly.push(call);
      }
    }

    console.log(
      `[ParallelToolExecutor] Found ${readOnly.length} READONLY and ${mutating.length} MUTATING tool calls.`,
    );

    // Execute ReadOnly Concurrently
    const readPromises = readOnly.map(async (call) => {
      try {
        const res = await executeFn(call.name, call.args);
        results[call.id] = res;
      } catch (error: any) {
        results[call.id] = { error: error.message };
      }
    });

    await Promise.all(readPromises);

    // Execute Mutating Sequentially
    for (const call of mutating) {
      try {
        const res = await executeFn(call.name, call.args);
        results[call.id] = res;
      } catch (error: any) {
        results[call.id] = { error: error.message };
      }
    }

    return results;
  }
}

export const parallelExecutor = new ParallelToolExecutor();
