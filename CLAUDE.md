# CLAUDE.md

## Attribution (mandatory)

All commits and pull requests in this repository must be attributed to **Boris Miscenco** only.

- Commit author and committer must be `Boris Miscenco <boris.miscenco@gmail.com>`.
  Set it before committing:
  ```sh
  git config user.name "Boris Miscenco"
  git config user.email "boris.miscenco@gmail.com"
  ```
- Never commit or open a PR as an AI agent (e.g. `Claude <noreply@anthropic.com>`).
- Do not add AI attribution anywhere: no `Co-Authored-By: Claude ...` trailers, no
  `Claude-Session:` links, no "Generated with Claude Code" lines in commit messages,
  PR titles, or PR descriptions.

## Branch naming (mandatory)

Every new branch must be named `<type>/<short-description>`, lowercase, words
separated by hyphens (no spaces). Allowed types:

| Type        | Use for                                   | Example                          |
|-------------|-------------------------------------------|----------------------------------|
| `feature/`  | New functionality                         | `feature/new-parameter`          |
| `fix/`      | Bug fixes                                 | `fix/midi-export-timing`         |
| `routine/`  | Housekeeping, cleanup, dependency updates | `routine/general-housekeeping`   |
| `refactor/` | Code restructuring without behavior change| `refactor/split-melody-generator`|
| `docs/`     | Documentation only                        | `docs/update-readme`             |

- Never use a `claude/` prefix or any other name that references an AI agent,
  tool, or session (no `claude`, `ai`, `bot`, session IDs, or random suffixes).
- If a session or tool pre-assigns such a branch name, rename it to follow this
  convention before pushing or opening a PR.
