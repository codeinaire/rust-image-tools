Store a code review record in the `pr-reviews/` folder.

Instructions:

1. Look at the recent conversation to identify the PR being reviewed — its number or URL, title, what it changes, and the findings from the review.
2. Create a new markdown file at `pr-reviews/<YYYYMMDD>-<short-kebab-case-title>.md` (using today's date) with this template:

```markdown
# Code Review: <PR Title>

**Date:** <today's date>
**PR:** <PR URL or number>
**Author:** <PR author>
**Reviewer:** <who performed the review>
**Status:** Approved | Approved with suggestions | Changes requested | Informational

## Overview

<1-3 sentences describing what the PR does.>

## Findings

### Bugs

<List any bugs found. Remove section if none.>

### Issues & Risks

<List concerns around correctness, regressions, security, or maintainability. Remove section if none.>

### Suggestions

<List non-blocking improvements — naming, style, patterns. Remove section if none.>

### Positives

<Highlight good design decisions or well-executed parts. Remove section if none.>

## Test Coverage

<Assessment of test coverage — what is tested, what is missing, and whether it matters.>

## Summary

<One-paragraph verdict and recommended next steps before merge.>
```

3. The document should be self-contained — include enough context that someone reading it later (without the original conversation) understands what was reviewed and why.
4. Confirm the file was created and show the path.

If the conversation doesn't contain a clear code review, ask the user what review they'd like to record.
