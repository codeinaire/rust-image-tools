# Decision: Researcher Agent Setup

**Date:** 2026-03-05
**Status:** Accepted

## Context

A research agent was needed to investigate technical domains before planning implementation work. The starting point was an agent definition from the GSD framework, which needed to be adapted for standalone use in this project.

## Options Considered

### Option 1: Use the GSD framework as-is

- **Pros:** Full workflow (discuss → research → plan → implement) already built out
- **Cons:** Heavy dependency on `gsd-tools.cjs`, phase directory conventions, orchestrator process, and GSD-specific config files — none of which exist in this project

### Option 2: Strip GSD references and create a standalone agent

- **Pros:** Portable, no external tooling dependency, can be invoked directly in any conversation
- **Cons:** Loses the orchestration layer (no automatic handoff to a planner agent)

## Decision

Option 2 — standalone agent at `.claude/agents/researcher.md`.

The GSD orchestration layer was not needed for this project's workflow. The core value of the agent is in the research methodology itself (source hierarchy, verification protocol, research_principles around training staleness), not the framework around it.

**Key design choices made during adaptation:**

- **XML semantic tags retained** (`<role>`, `<research_principles>`, `<tool_strategy>`, etc.) — these help Claude parse and weight long prompt sections more reliably than markdown headers alone
- **Validation Architecture section kept** — the GSD-specific conditional (`nyquist_validation` config) was removed but the substance (detecting test infrastructure, mapping requirements to tests, identifying gaps) was preserved
- **Three MCP servers integrated:** Context7 (library docs), GitHub MCP (releases, changelogs, issues, health), Sequential Thinking (structured research planning for complex multi-domain tasks)
- **Library assessment checklist added:** maintenance health, license, compatibility, security/CVE checks — not present in the original
- **Architecture Options section added** to RESEARCH.md template — distinct from Architecture Patterns; covers fundamentally different approaches with pros/cons before committing to one
- **Performance research and "what experienced users regret" searches added** — covers both measurable characteristics and unknown unknowns
- **Stopping criteria added** — prevents over-researching a single domain at the cost of breadth

## Resources

- Original GSD researcher agent definition (provided by user in conversation)
- `.claude/agents/researcher.md` — the resulting agent file
- `resources/20260305-research-agent-template.md` — reference copy of the template with explanatory notes
