<!-- Hand-off between sessions on any machine, local or cloud. AGENTS.md imports it, so every
     session starts with it. The hand-off rewrites it; it is not a log, and history belongs in git.
     Keep it under ~40 lines; the SessionStart hook warns past 60. -->
# State

_Updated 2026-10-27_

## Now
- Branch `chore/repo-kit` awaits review: repo kit (AGENTS.md, STATE.md, scripts/verify.sh,
  .agents/bootstrap.sh) plus docs moved from the root into `docs/` and `docs/history/`.

## Next
1. Review and merge `chore/repo-kit`.
2. Owner: reconcile branch types. CLAUDE.md allows `feature/ fix/ routine/ refactor/ docs/`;
   the workflow plugin's hook only accepts `feat fix refactor perf docs test build ci chore`
   (so this branch is `chore/`, not `routine/`). Pick one list and update CLAUDE.md or the hook.
3. Owner: name the Obsidian vault project for AGENTS.md, or confirm there is none.
4. Owner: keep or delete `melody_generator_heading.png` (root; referenced nowhere).
5. Owner: rename the package from `rest-express` in package.json?

## Decisions
- `replit.md` stays at the root: Replit reads it from there.
- verify.sh = doc-link check + `tsc` + `npm run build`; the repo has no test suite yet.

## Known issues
- No automated tests and no CI workflow; verify.sh is the only gate.
- Build warns the main JS chunk is ~2.6 MB (over Vite's 500 kB limit); not an error.
