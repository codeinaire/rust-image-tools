Create a plan record in the `plans/` folder based on the current conversation.

The plan filename argument (optional): $ARGUMENTS

## Instructions

### 1. Understand the plan scope

Review the conversation to identify:

- What is being built or changed and why
- The approach or strategy discussed
- Any constraints, requirements, or non-negotiables mentioned
- Concrete steps or tasks discussed
- Any open questions or unresolved decisions

### 2. Check for related context

Before writing:

- Scan `plans/` for any existing plans that overlap — note them if relevant and flag any that must be completed before this one
- If a research document was referenced or used in the conversation, note its path in the plan's `Research` field

### 3. Generate a sequence number

Count existing files in `plans/` for today's date and use the next number (zero-padded, starting at `01`). Example: if `20260307-160055-foo.md` exists, use `02`.

### 4. Name the file

Use a short, descriptive kebab-case title that identifies the feature or change — not the method.

- Good: `add-heic-support`, `refactor-conversion-pipeline`
- Bad: `update-convert-module`, `fix-stuff`

File path: `plans/YYYYMMDD-HHMMSS-short-kebab-case-title.md`

### 5. Write the plan using this template

```markdown
# Plan: <Title>

**Date:** <today's date>
**Status:** Draft
**Research:** <relative path to research doc if one informed this plan, otherwise omit this line>
**Depends on:** <comma-separated list of plan filenames that must be completed first, otherwise omit this line>

## Goal

<What this plan aims to achieve — 1–2 sentences. State the outcome specifically, not the method. E.g. "Add HEIC input support so users can convert iPhone photos" not "update the image converter".>

## Approach

<High-level strategy. Explain the architectural or design decisions that shape the implementation — what pattern was chosen and why. If there were competing options, note which was picked and the reason. 3–6 sentences.>

## Critical

<Non-negotiable constraints that must be respected throughout implementation. Real examples: "existing functionality must not change", "no new runtime dependencies", "must stay within WASM binary size budget". Follow the project structure in CLAUDE.md when specifying file paths. Only include real constraints — omit this section entirely if none apply.>

## Steps

<Ordered list of concrete, file-level implementation steps. Each step is one action on one concern. Avoid vague milestones like "update the module" — prefer "Add `heic` feature flag to `Cargo.toml` under `[features]`". Follow the project structure from CLAUDE.md for all file paths. Order steps using this sequence, skipping layers that don't apply: configuration & dependencies → infrastructure → backend / core logic → frontend → analytics & observability → tests.>

- [ ] ...
- [ ] ...

## Security

<Known vulnerabilities in dependencies (with safe versions to pin) and architectural security risks that follow from the chosen approach — required validation points, patterns to follow, anti-patterns to avoid. Omit this section if there are no security concerns.>

## Open Questions

<Any unresolved questions or decisions that block or affect the implementation. For each: what is known, what is unclear, and a recommendation for how to resolve it. Omit this section entirely if there are none.>

## Implementation Discoveries

<Starts empty — populate during implementation with unexpected findings, wrong assumptions, API quirks, edge cases, and fixes applied.>

## Verification

<How to confirm the implementation is correct and complete. For every meaningful requirement or step, specify:

- The test type: unit / integration / e2e / manual
- The exact command to run or action to take
- Whether it runs automatically (AI agent executes it) or manually (human verifies in browser, device, etc.)

Every step in the plan should have at least one verification method.>

- [ ] <What is verified> — <test type> — `<command or description>` — Automatic / Manual
- [ ] ...
```

### 6. Confirm

Report the created file path and a one-line summary of what the plan covers.

---

If the conversation doesn't contain enough context to write a meaningful plan, ask the user:

1. What are you building or changing?
2. Why — what problem does it solve?
3. Are there any constraints or non-negotiables?
