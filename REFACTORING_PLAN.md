# Refactoring Plan for Melody Generator

## Current State
- **Main file**: `client/src/components/melody-generator.tsx` (2,790 lines)
- **Issues**: Monolithic component, mixed concerns, hard to maintain

## Completed (Partial)
✅ Created type definitions (`client/src/types/music.ts`)
✅ Extracted scales configuration (`client/src/config/scales.ts`)
✅ Extracted rhythms configuration (`client/src/config/rhythms.ts`)
✅ Extracted chords configuration (`client/src/config/chords.ts`)
✅ Created note utilities (`client/src/utils/music/noteUtils.ts`)
✅ Created harmony utilities (`client/src/utils/music/harmonyUtils.ts`)

## Proposed Full Structure

```
client/src/
├── components/
│   ├── MelodyGenerator/
│   │   ├── index.tsx                    # Main component (< 300 lines)
│   │   ├── TrackControls.tsx            # Per-track volume/mute/instrument controls
│   │   ├── GlobalControls.tsx           # Tempo, key, scale, genre controls
│   │   ├── StepSequencer.tsx            # Visual step sequencer display
│   │   └── PlaybackControls.tsx         # Play, stop, generate buttons
│   └── ui/                              # Existing UI components
├── config/
│   ├── scales.ts                        # ✅ Musical scales and weights
│   ├── rhythms.ts                       # ✅ Rhythm patterns
│   ├── chords.ts                        # ✅ Chord progressions
│   ├── genres.ts                        # Genre style definitions
│   └── presets.ts                       # Synth presets configuration
├── features/
│   └── melody-generation/
│       ├── algorithms/
│       │   ├── melodyGenerator.ts       # Melody generation logic
│       │   ├── bassGenerator.ts         # Bass line generation
│       │   └── harmonyGenerator.ts      # Harmony generation
│       └── services/
│           ├── audioEngine.ts           # Soundfont player management
│           ├── playbackService.ts       # Playback scheduling
│           └── midiExporter.ts          # MIDI file export
├── hooks/
│   ├── useMelodyGenerator.ts            # Main state management hook
│   ├── useAudioEngine.ts                # Audio engine initialization
│   └── usePlayback.ts                   # Playback control hook
├── types/
│   └── music.ts                         # ✅ Type definitions
└── utils/
    ├── audio/
    │   ├── soundfont-player.ts          # ✅ Existing soundfont player
    │   └── soundfont-config.ts          # ✅ Existing soundfont config
    └── music/
        ├── noteUtils.ts                 # ✅ Note manipulation functions
        └── harmonyUtils.ts              # ✅ Harmony generation utilities
```

## Benefits of Full Refactoring

### Maintainability
- **Single Responsibility**: Each file has one clear purpose
- **Easier Navigation**: Find code quickly by logical organization
- **Better Testing**: Isolated functions are easier to test

### Performance
- **Code Splitting**: Smaller bundle chunks, faster initial load
- **Tree Shaking**: Unused code can be eliminated
- **Lazy Loading**: Load features on demand

### Developer Experience
- **Faster Editing**: Smaller files load and parse faster in IDE
- **Better Intellisense**: Type hints work better with smaller files
- **Easier Collaboration**: Multiple developers can work on different files

### Scalability
- **Add Features Easily**: New generators, instruments, effects
- **Reusability**: Extract music utils for other projects
- **Documentation**: Each module can have focused documentation

## Phased Approach

### Phase 1: Extract Pure Functions (Low Risk)
1. ✅ Move constants to `config/`
2. ✅ Move utility functions to `utils/music/`
3. Extract synth presets to `config/presets.ts`
4. Extract MIDI export to `utils/midi/midiExporter.ts`
5. Update imports in main component

**Impact**: Reduces main file by ~500 lines, no behavior changes

### Phase 2: Create Service Layer (Medium Risk)
1. Create `services/audioEngine.ts` - Soundfont initialization
2. Create `services/playbackService.ts` - Note scheduling
3. Create custom hooks for state management
4. Update main component to use services

**Impact**: Reduces main file by ~800 lines, cleaner architecture

### Phase 3: Split UI Components (Medium Risk)
1. Extract `GlobalControls.tsx`
2. Extract `TrackControls.tsx`
3. Extract `StepSequencer.tsx`
4. Extract `PlaybackControls.tsx`
5. Main component becomes composition of smaller components

**Impact**: Reduces main file by ~1,000 lines, better UX iteration

### Phase 4: Extract Generation Algorithms (Higher Risk)
1. Move melody generation logic to `algorithms/melodyGenerator.ts`
2. Move bass generation to `algorithms/bassGenerator.ts`
3. Move harmony generation to `algorithms/harmonyGenerator.ts`
4. Create hooks to use these generators

**Impact**: Reduces main file by ~500 lines, most complex refactoring

## Estimated Timeline
- **Phase 1**: 2-3 hours (safest, recommended to start)
- **Phase 2**: 4-5 hours (moderate complexity)
- **Phase 3**: 3-4 hours (UI-focused)
- **Phase 4**: 5-6 hours (highest complexity)

**Total**: ~15-18 hours for complete refactoring

## Recommendation

Start with **Phase 1** only - it provides immediate benefits with minimal risk:
- Cleaner, more organized code
- Easier to find and modify constants
- Better for version control (smaller diffs)
- No changes to component logic
- Easy to revert if issues arise

After Phase 1 is stable and tested, evaluate whether to continue to Phase 2.

## Next Steps

1. Review this plan
2. Decide which phases to implement
3. Create feature branch for refactoring
4. Implement phase by phase
5. Test thoroughly between phases
6. Merge when stable
