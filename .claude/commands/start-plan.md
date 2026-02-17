Implement all features described in a plan file and update its status and todos when done.

The plan filename is: $ARGUMENTS

Instructions:

1. **Find the plan file.** Look in the `plans/` directory for a file matching the argument. Try exact match first, then partial/fuzzy match on the filename. If no match is found, list available plans and ask the user which one they meant.

2. **Read and understand the plan.** Read the full plan file. Identify:
   - The goal and approach
   - The implementation steps
   - The todo checklist items (lines starting with `- [ ]`)
   - Any dependencies on other plans — verify those are marked as Done/Completed before proceeding

3. **Review the codebase.** Before writing any code, read all files that will be modified or are relevant to the plan. Understand the existing patterns, conventions, and state of the code.

4. **Implement the features.** Work through the steps and todo items systematically:
   - Follow all coding conventions in CLAUDE.md
   - Create task tracking items for major steps
   - Run builds and tests to verify each significant change
   - If a step is blocked or ambiguous, ask the user before proceeding

5. **Update the plan file when done:**
   - Change `**Status:**` from `Draft` or `In Progress` to `Done`
   - Check off all completed todo items: `- [ ]` → `- [x]`
   - Leave any items unchecked that require manual verification by the user (e.g., "verify in browser", "check dashboard") and note why they were left unchecked

6. **Final verification.** Run the project build to confirm nothing is broken:
   ```
   cd web && npx parcel build src/index.html
   ```
   If there are Rust changes, also run:
   ```
   cargo test --manifest-path crates/image-converter/Cargo.toml
   ```

7. **Summary.** Report what was implemented, what files were changed, and any items left for manual verification.
