Store a plan record in the `plans/` folder.

Instructions:

1. Look at the recent conversation to identify the plan being discussed — its goals, approach, steps, and any trade-offs or open questions.
2. Create a new markdown file at `plans/<YYYYMMDD>-<short-kebab-case-title>.md` (using today's date) with this template:

```markdown
# Plan: <Title>

**Date:** <today's date>
**Status:** Draft | In Progress | Completed | Abandoned

## Goal

<What this plan aims to achieve — 1-2 sentences.>

## Approach

<High-level strategy or architecture decisions.>

## Critical

<Add anything critical here that must be followed such as if refactoring the functionality needs to stay the same>

## Steps

<Ordered list of implementation steps.>

## TODOs

<Create a list of to-dos that will be checked off as work is completed>

## Open Questions

<Any unresolved questions or decisions that still need to be made. Remove this section if none.>

## Implementation Discoveries

<Anything unexpected found during implementation — bugs, wrong assumptions, API quirks, fixes applied. Populated after implementation, not during planning. Remove this section if none.>

## Verification

<Create a list of ways to verify the changes such as unit tests, integration tests, end-to-end tests, human verification, or any other methods and if possible implement the tests. The list must explicitly state what
verification will be used. Add whether it will be done automatically or by the ai agent.>
```

3. Confirm the file was created and show the path.

If the conversation doesn't contain a clear plan, ask the user what plan they'd like to record.
