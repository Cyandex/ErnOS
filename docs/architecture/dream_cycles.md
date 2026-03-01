# The Cognitive Layer & Dream Cycles 🧠

Unlike traditional reactive chatbots, ErnOS V5 is built as a **persistent digital entity**. It operates asynchronously and autonomously, performing background cognition even when you aren't interacting with it. 

This behavioral paradigm is driven by two core systems: the **AutonomyDaemon** and the **Dream Cycles**.

---

## The AutonomyDaemon

The `AutonomyDaemon` is a background cron-like process that constantly monitors the system's idle state. When the gateway detects that no active user prompts or programmatic inputs are being processed, it relinquishes control to the daemon.

### Objectives of the Daemon
1. **Introspection & Strategy**: It analyzes the current `activeGoals` loaded from the Hierarchical Goal System, breaking them into theoretical sub-steps.
2. **Execution**: If authorized by the operator's sandbox constraints, it can execute tools in the background to advance these goals (e.g., searching the web for a research task).
3. **Ledgering**: It forces the active LLM agent to explicitly define an `#INTENT` string before taking any action.

## Dream Cycles (Memory Consolidation)

To prevent the active conversational context window from ballooning endlessly, ErnOS must "sleep." 

When the `AutonomyDaemon` detects extensive downtime or memory pressure, it triggers a **Dream Cycle**.
- **Vector Pruning**: Stale or less-relevant conversational turns are analyzed via embeddings and pruned from the immediate `tape`.
- **Knowledge Graph Offloading**: Core facts, user preferences, and actionable heuristics are generalized and written to the Neo4j `long_term_memory` module.
- **Narrative Summarization**: The agent generates a dense, overarching summary of the day's events to be loaded into the `hud` on the next boot, preserving continuity without wasting tokens.

### How to Monitor Dreams
You can observe the active background loops by inspecting the intention ledger. ErnOS ships with a native introspection tool `recall_intentions` which reads from `~/.ernos/memory/core/intentions.jsonl`. This allows human operators to ask: *"What were you thinking about while I was away?"*
