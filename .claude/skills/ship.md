Create a GitButler branch, commit changes, push to GitHub, and open a PR for code review.

The branch name or PR title hint is: $ARGUMENTS

Instructions:

1. **Understand the changes.** Run these commands to gather context:
   - `bts` — GitButler status to see current state
   - `git diff` — see unstaged changes
   - `git log --oneline -5` — recent commit history for context

2. **Determine branch name.**
   - If `$ARGUMENTS` is provided, use it as the branch name (kebab-case, no spaces)
   - If not provided, derive a short descriptive branch name from the changes (e.g., `add-heic-support`, `fix-quality-slider`) or from the plan file name
   - Ask the user to confirm the branch name before proceeding

3. **Create the GitButler branch.**

   ```bash
   btbn <branch-name>
   ```

4. **Stage and commit changes.** Identify the changed files using `bts`, then use `btfc` to assign them to the branch and commit:

   ```bash
   btfc "<file1,file2,...>" <branch-name> "<commit message>"
   ```

   - Below is a sample output for the `bts` command. Typically you can use the `zz` reference in place of adding all the files, or you can choose individual files by using the two character reference such as `xy` will select the `.claude/agents/implementer.md` file.

```
╭┄zz [unstaged changes]
┊   xy M .claude/agents/implementer.md
┊   ql A .claude/agents/orchestrator.md
┊   ss A .claude/skills/ship.md
┊   mw M plans/20260313-052638-jpeg-quality-slider-format-quality-controls.md 🔒 60cf046
┊   ll M web/src/components/DropZone/QualitySlider.tsx 🔒 60cf046
┊   lk M web/src/styles.css
┊
┊╭┄fi [fixes-to-agents]
┊●   d73a60f fix saved file title
├╯
┊
┊╭┄qu [quality-slide-for-subset-of-formats]
┊●   60cf046 quality slide for subset of formats
├╯
┊
┴ f8aab33 [origin/main] 2026-03-11 plan 19 add clipboard paste support (#29)
   - The commit message should be concise and descriptive (1-2 sentences)
   - End the commit message with: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
```

5. **Push the branch.**

   ```bash
   btp <branch-name>
   ```

   If the push fails due to hooks, investigate and fix the issue — do not bypass hooks.

6. **Create the PR.** Use `gh` to open a pull request:

   ```bash
   gh pr create --title "<short title>" --body "$(cat <<'EOF'
   ## Summary
   <1-3 bullet points describing what changed and why>

   ## Test plan
   <bulleted checklist of how to verify the changes>

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

   - Keep the PR title under 70 characters
   - The summary should explain the "why", not just the "what"
   - If a plan file exists for this work, reference it in the summary

7. **Report to the user.** Provide:
   - The PR URL
   - Branch name
   - Files included
   - A note that the code-reviewer agent can now review the PR: `@code-reviewer <PR URL>`
