# AGENTS.md: Replit Melody Generator

<!-- Shared by every coding agent. Keep it to facts every session needs.
     Scaffolded by /workflow:kit. Keep the state import below.
     Repo rules on attribution and branch names live in CLAUDE.md. -->

## Current state

@.agents/STATE.md

## Session workflow
- **Start**: read the current state above (`.agents/STATE.md`). If `git log` shows commits after
  its last update, that work is unrecorded; check it before trusting the note.
- **Work**: nothing is done until `bash scripts/verify.sh` passes. Add tests for fixes and features.
- **End**: hand off. Verify, rewrite `.agents/STATE.md` (Now, Next, Decisions, Known issues)
  as the repo will be once the branch merges, and commit it with the work, so its PR carries it.
  In a cloud session push the branch.

## Project
Browser-based multi-track melody generator (bass, melody, harmony) with genre styles, a
TR-8S-style step sequencer, soundfont playback (smplr / Tone.js) and MIDI export. React 18 +
TypeScript + Vite front end, small Express server. Published to GitHub Pages
(https://elarmuzik1993.github.io/Replit-Melody-Generator/, Vite `base` is
`/Replit-Melody-Generator/`) and runnable on Replit (`.replit`, port 5000). "Working" means
it type-checks, builds, and generates and plays tracks in the browser.

## Layout
| Path | What |
|---|---|
| `client/src/components/melody-generator.tsx` | Main component (~4000 lines); most app logic |
| `client/src/components/ui/` | shadcn/Radix UI primitives |
| `client/src/config/` | Scales, rhythms, chords, genres |
| `client/src/utils/` | `music/` theory helpers, `midi/` export, `ai/` Magenta, soundfont player |
| `client/src/types/music.ts` | Shared music types |
| `server/` | Express server; `routes.ts` has no API routes yet |
| `shared/schema.ts` | Drizzle schema (user table) |
| `docs/` | Feature and architecture docs; `docs/history/` holds past plans and changelogs |
| `replit.md` | Replit agent notes (kept at root for Replit) |

## Commands
| Task | Command |
|---|---|
| Verify (definition of done) | `bash scripts/verify.sh` (doc links, `tsc`, `npm run build`) |
| Quick check (session start) | `bash scripts/verify.sh --quick` (doc links, `tsc`) |
| Install | `npm ci` (`.agents/bootstrap.sh` does it on a fresh clone) |
| Dev server | `npm run dev` |
| Type check | `npm run check` |
| Build | `npm run build` (output in `dist/`) |
| Deploy to GitHub Pages | `npm run deploy` (builds, then pushes `dist/public` with gh-pages) |

## Conventions
- TypeScript everywhere; path alias `@/` maps to `client/src/`.
- Put music config in `client/src/config/` and pure helpers in `client/src/utils/`, not in
  `melody-generator.tsx` (see `docs/history/REFACTORING_PLAN.md`).
- New docs go in `docs/`; finished plans and migration notes in `docs/history/`.
