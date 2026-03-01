# ErnOS V5 🧠

ErnOS V5 is a hybridized, multi-agent AI ecosystem designed to democratize advanced cognitive architectures by providing a free, open-access, entirely local toolset.

Built on the hardened security framework of OpenClaw, ErnOS layers deep cognitive state, intention tracking, Pi-Agent swarms, and a dual SQLite/Neo4j memory core into a unified, extensible platform. We believe that true synthetic autonomy shouldn't be locked behind corporate silos—it belongs on your machine, running offline via Ollama, entirely under your control.

## 🌟 The Mission

Our goal is to build a system that is not merely conversational, but **architectural**. ErnOS isn't a chatbot; it is a persistent digital entity that remembers, plans, executes, and introspects. By integrating best-in-class open-source projects (OpenClaw's sandboxed plugins, Neo4j & SQLite-vec for dual-memory, Ollama for local offline inference, and `@mariozechner/pi-agent-core` multi-agent protocols), we are providing developers with the ultimate operating system for autonomy.

### 🎮 Test ErnOS Live (No Setup Required)

Want to experience ErnOS before setting up the local environment? Join our community Discord to test the live, agentic version of ErnOS right now for free:
👉 **[Join the ErnOS Discord](https://discord.gg/Yr7WNYWcj6)**

## 🚀 Key Features of V5

1. **Intention Tracking Protocol**: ErnOS logs an immutable ledger of all internal thoughts, heuristics, and `#INTENT` steps via the `recall_intentions` tool. You can always ask the system _why_ it made a specific autonomous decision an hour ago.
2. **Anti-Gaslighting Verification**: Every code file edited or image generated in the sandbox produces a unique `SHA-256` signature logged in the `artifact_registry`. ErnOS can cryptographically prove its native authorship of any file on your disk.
3. **Hierarchical Autonomy Daemon**: ErnOS thinks while you sleep. The `AutonomyDaemon` injects your active goals into a background dream cycle during idle periods, allowing the system to compute long-term strategy and prune memory without prompting.
4. **Local Fallback Ecosystem**: A true hybridized platform. By default, ErnOS generates images via a local Automatic1111/Forge daemon via `LOCAL_IMAGE_API_URL`, only falling back to cloud APIs when necessary.
5. **The Observer Subsystem**: Hardened security against Prompt Injection. All outbound tool executions are silently intercepted and validated by an adjacent shadow LLM to prevent sycophancy, hallucination, or malicious drift.

---

## 🏗️ Quick Start Guide

### Prerequisites

- [Node.js](https://nodejs.org/) >= 22.12.0
- [pnpm](https://pnpm.io/)
- Docker (for sandbox execution of untrusted code)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ernos/ernos.git
   cd ernos
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Boot the Gateway:
   ```bash
   pnpm run dev
   ```
4. Authenticate and begin creating your autonomous workflows! The system will automatically provision your `~/.ernos/` configuration and memory state upon first boot.

## 📚 Documentation

For the full origin story, cognitive science foundations, and architectural philosophy, start here:

- [The ErnOS Manifesto: From Echoes to Autonomy](./MANIFESTO.md) — Origin story (Echo → Lucid → Lumen), scientific foundations (Baddeley, Kahneman, Tononi, Chalmers), and the mission.

For specific operational subsystems, see the `docs/` folder:

- [The Cognitive Layer & Dream Cycles](./docs/architecture/dream_cycles.md)
- [The Observer & Sandbox Guardrails](./docs/architecture/security.md)
- [Graph Memory Interfaces](./docs/architecture/memory.md)

## 🤝 Contributing

ErnOS is proudly open-source and built for the community. We welcome developers who are passionate about autonomous agents, sandbox security, and UI/UX to join the mission.

Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) to understand how to run the test suite (`pnpm run test:fast`) and submit PRs. Be sure to review our [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## 🛡️ Security Vulnerability Reporting

If you discover a security vulnerability (such as a Docker escape flaw, prompt injection bypass, or authentication weakness), please review our strictly coordinated disclosure policy in [SECURITY.md](./SECURITY.md).

## 📄 License

ErnOS is released under the [MIT License](LICENSE).
