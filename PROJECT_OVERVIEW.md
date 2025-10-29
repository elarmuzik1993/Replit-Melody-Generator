# Replit Melody Generator - Project Overview

## Description
A multi-track melody generator web application that creates layered music with Bass, Melody, and Harmony tracks. Built with React, TypeScript, Vite, and Tone.js for audio synthesis.

## Live Site
https://elarmuzik1993.github.io/Replit-Melody-Generator/

## Tech Stack
- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5.4
- **Audio Engine**: Tone.js 15
- **UI Components**: Radix UI primitives
- **Styling**: Tailwind CSS with custom Monolit Beatz theme
- **Routing**: Wouter
- **Backend**: Express (for development server)
- **Database**: Drizzle ORM with PostgreSQL (Neon)
- **Deployment**: GitHub Pages

## Project Structure
```
Replit-Melody-Generator/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── melody-generator.tsx   # Main app component
│   │   │   └── ui/                    # Radix UI components
│   │   ├── pages/
│   │   │   ├── melody-generator.tsx   # Page wrapper
│   │   │   └── not-found.tsx
│   │   ├── App.tsx            # Router setup
│   │   └── main.tsx           # Entry point
│   ├── index.html
│   └── index.css              # Monolit Beatz custom theme
├── server/                    # Backend Express server
├── dist/                      # Build output
│   └── public/               # GitHub Pages deployment folder
├── shared/                    # Shared types/utilities
└── node_modules/
```

## Key Features
1. **Multi-Track Generation**
   - Bass Track (low frequency)
   - Melody Track (mid-high frequency)
   - Harmony Track (chord accompaniment)

2. **Global Settings**
   - Tempo (BPM): 60-180
   - Master Volume: 0-100%
   - Musical Scale: Major, Minor, etc.
   - Key: C, D, E, F, G, A, B
   - Time Signature: 4/4, 3/4, 6/8, etc.
   - Notes per Track: 4-16

3. **Per-Track Controls**
   - Enable/Disable toggle
   - Volume slider (0-100%)
   - Octave Range selector (0-8)
   - Sound/Synth type selector
   - Generate button

4. **Playback Controls**
   - Play/Stop button
   - Loop toggle
   - Download MIDI

## Build & Deployment

### Development
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
# Output: dist/public/
```

### Deploy to GitHub Pages
```bash
npm run deploy
```

## Configuration
- **Base Path**: `/Replit-Melody-Generator/` (for GitHub Pages)
- **Vite Config**: `vite.config.ts`
- **Tailwind Config**: `tailwind.config.ts`
- **TypeScript Config**: `tsconfig.json`

## Important Notes
- Cannot use Live View with source files - must build first
- GitHub Pages serves from `dist/public/` via `gh-pages` branch
- Uses hash routing for SPA support on GitHub Pages
