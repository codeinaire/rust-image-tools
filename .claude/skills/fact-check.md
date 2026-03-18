---
name: fact-check
description: Quick factual lookup for specific technical questions. Use for API details, version compatibility, config syntax, or feature existence — not for broad domain research.
context: fork
agent: fact-checker
user-invocable: false
---

Answer this technical question:

$ARGUMENTS

Return a direct answer with a confidence level (HIGH/MEDIUM/LOW) and source. Do not produce a research document or explore the broader domain.
