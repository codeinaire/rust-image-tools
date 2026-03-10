Implement the findings from a code review stored in the `pr-reviews/` folder.

The review filename or title is: $ARGUMENTS

Instructions:

1. **Find the review file.**
   - If `$ARGUMENTS` is empty, find the most recently dated file in `pr-reviews/` (highest `YYYYMMDD` prefix).
   - If `$ARGUMENTS` is provided, search `pr-reviews/` for an exact filename match first, then a partial/fuzzy match on filename or the `# Code Review:` title line. If multiple files match, list them and ask the user which one they meant.

2. **Read and understand the review.** Read the full review file. Identify:
   - The PR URL/number and what it changed (Overview)
   - **Bugs** — must fix; these are correctness issues
   - **Issues & Risks** — should fix before merge; these are risks, regressions, or maintenance hazards
   - **Suggestions** — non-blocking improvements (naming, style, patterns)
   - The **Summary** — recommended next steps

3. **Confirm scope with the user.** Before touching any code, present the findings grouped by category with a brief summary of each item, then ask:
   - "Implement bugs + issues only (recommended), or also suggestions?"
   - If the user selects suggestions, confirm which ones since some may be subjective.

4. **Review the codebase.** Before writing any code, read every file that will be touched. Understand existing patterns, naming conventions, and component relationships.

5. **Implement the approved changes** systematically, one finding at a time:
   - Follow all coding conventions in CLAUDE.md
   - Create task tracking items for each finding being implemented
   - After each non-trivial change, run a build or test to confirm nothing is broken
   - If a finding is ambiguous or requires a design decision, ask the user before proceeding
   - Skip any finding that says "human verification" or "verify in browser" — note it for the summary

6. **Final verification.** Run the project build:

   ```
   cd web && npx astro build
   ```

   If Rust files were changed, also run:

   ```
   cargo test --manifest-path crates/image-converter/Cargo.toml
   ```

7. **Update the review file when done:**
   - Append an `## Implementation Notes` section at the bottom of the review file listing:
     - Which findings were implemented
     - Which were skipped and why (e.g., "requires manual browser verification", "out of scope", "user declined")
     - Date implemented

8. **Summary.** Report what was changed, which files were modified, and what remains for manual verification.
