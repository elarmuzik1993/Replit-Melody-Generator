# State Management

## State Architecture

### MultiTrackState Interface (Line ~27)

```typescript
interface MultiTrackState {
  // Global settings (shared across tracks)
  tempo: number;                    // 60-180 BPM
  masterVolume: number;             // 0-100%
  key: string;                      // C, D, E, F, G, A, B (with sharps)
  scale: string;                    // major, minor, etc.
  timeSignature: string;            // 4/4, 3/4, 6/8, etc.
  isPlaying: boolean;               // Playback state
  isLooping: boolean;               // Loop toggle
  metronomeEnabled: boolean;        // Metronome toggle
  loopLength: number;               // 4 or 8 bars

  // Individual track data
  tracks: {
    bass: TrackData;
    melody: TrackData;
    harmony: TrackData;
  };

  // Legacy compatibility fields
  noteCount: number;                // 4-16 notes
  soundType: string;                // Legacy field
  generatedMelody: string[];        // Legacy field
  currentNoteIndex: number;         // Legacy field
  hasGeneratedMelody: boolean;      // Legacy field
}
```

### TrackData Interface (Line ~17)

```typescript
interface TrackData {
  generatedSequence: string[];      // Array of note names (e.g., ["C4", "E4", "G4"])
  isEnabled: boolean;               // Track on/off
  volume: number;                   // 0-1 (0-100%)
  synthType: string;                // Synth type ID
  currentNoteIndex: number;         // Current playing note (-1 = not playing)
  hasGenerated: boolean;            // Whether track has been generated
  octaveRange: [number, number];    // [min, max] octave range (0-8)
}
```

## Initial State (Line ~391)

```typescript
const [state, setState] = useState<MultiTrackState>({
  tempo: 120,
  masterVolume: 80,
  scale: "major",
  key: "C",
  timeSignature: "4/4",
  isPlaying: false,
  isLooping: true,
  metronomeEnabled: false,
  loopLength: 4,
  tracks: {
    bass: {
      generatedSequence: [],
      isEnabled: true,
      volume: 0.8,
      synthType: "bass_synth",
      currentNoteIndex: -1,
      hasGenerated: false,
      octaveRange: [2, 3]           // Low range for bass
    },
    melody: {
      generatedSequence: [],
      isEnabled: true,
      volume: 0.7,
      synthType: "electric_piano",
      currentNoteIndex: -1,
      hasGenerated: false,
      octaveRange: [4, 5]           // Mid-high range for melody
    },
    harmony: {
      generatedSequence: [],
      isEnabled: true,
      volume: 0.5,
      synthType: "pad_synth",
      currentNoteIndex: -1,
      hasGenerated: false,
      octaveRange: [4, 6]           // Mid-high range for harmony
    }
  },
  noteCount: 8,
  soundType: "melody",
  generatedMelody: [],
  currentNoteIndex: -1,
  hasGeneratedMelody: false
});
```

## State Updates

### Pattern: Immutable Updates
All state updates use spread operators to maintain immutability:

```typescript
setState(prev => ({
  ...prev,
  tempo: newValue
}));
```

### Updating Global Settings
```typescript
// Simple value
setState(prev => ({ ...prev, tempo: 140 }));

// Multiple values
setState(prev => ({
  ...prev,
  isPlaying: true,
  isLooping: false
}));
```

### Updating Track Properties
```typescript
// Update single track
setState(prev => ({
  ...prev,
  tracks: {
    ...prev.tracks,
    [trackType]: {
      ...prev.tracks[trackType],
      volume: 0.8
    }
  }
}));

// Update track sequence
setState(prev => ({
  ...prev,
  tracks: {
    ...prev.tracks,
    bass: {
      ...prev.tracks.bass,
      generatedSequence: newSequence,
      hasGenerated: true
    }
  }
}));
```

### Updating Octave Range
```typescript
// Update minimum octave
setState(prev => ({
  ...prev,
  tracks: {
    ...prev.tracks,
    [trackType]: {
      ...prev.tracks[trackType],
      octaveRange: [newMin, Math.max(newMin, prev.tracks[trackType].octaveRange[1])]
    }
  }
}));
```

## State Synchronization

### Master Volume Effect
When master volume changes, it updates Tone.js Destination volume:
```typescript
if (window.Tone?.Destination) {
  window.Tone.Destination.volume.value = (value[0] / 100) * 20 - 20;
}
```

### Tempo Effect
When tempo changes, it updates Tone.js Transport BPM:
```typescript
if (window.Tone) {
  window.Tone.Transport.bpm.value = state.tempo;
}
```

## State-Dependent Computed Values

### Available Notes (Line ~620)
```typescript
const availableNotes = useMemo(() => {
  const scaleNotes = musicalScales[state.scale];
  const keyIndex = keys.indexOf(state.key);
  return scaleNotes.map(interval =>
    keys[(keyIndex + interval) % 12]
  );
}, [state.scale, state.key]);
```

### Status Messages (Line ~465)
```typescript
const [status, setStatus] = useState<string>('Ready');
```

## Critical State Rules

1. **Never mutate state directly** - Always use setState
2. **Preserve unmodified properties** - Use spread operators
3. **Track independence** - Each track has isolated state
4. **Sync audio engine** - Update Tone.js when state changes
5. **Validate ranges** - Ensure octave min <= max

## State Flow Diagram

```
User Interaction
      ↓
UI Component (Button/Slider/Select)
      ↓
setState() call
      ↓
React re-render
      ↓
Updated UI + Side Effects (Tone.js sync)
```

## Common State Operations

### Generate All Tracks
```typescript
const generateAllTracks = () => {
  ['bass', 'melody', 'harmony'].forEach(trackType => {
    const sequence = generateSequence(trackType);
    setState(prev => ({
      ...prev,
      tracks: {
        ...prev.tracks,
        [trackType]: {
          ...prev.tracks[trackType],
          generatedSequence: sequence,
          hasGenerated: true
        }
      }
    }));
  });
};
```

### Toggle Track Enable
```typescript
setState(prev => ({
  ...prev,
  tracks: {
    ...prev.tracks,
    [trackType]: {
      ...prev.tracks[trackType],
      isEnabled: !prev.tracks[trackType].isEnabled
    }
  }
}));
```

### Update Current Note Index (During Playback)
```typescript
setState(prev => ({
  ...prev,
  tracks: {
    ...prev.tracks,
    [trackType]: {
      ...prev.tracks[trackType],
      currentNoteIndex: index
    }
  }
}));
```

## State Persistence
Currently, state is **not persisted** between sessions. All state resets on page reload.

Potential improvements:
- localStorage for user preferences
- URL parameters for sharing configurations
- Database storage for saved compositions

## State Access Patterns

### Reading State
```typescript
// Global setting
const currentTempo = state.tempo;

// Track property
const bassVolume = state.tracks.bass.volume;

// Track iteration
['bass', 'melody', 'harmony'].forEach(trackType => {
  const track = state.tracks[trackType];
  console.log(track.generatedSequence);
});
```

### Conditional Rendering
```typescript
{state.tracks[trackType].hasGenerated ? (
  <div>Show generated content</div>
) : (
  <div>Generate track to see preview</div>
)}
```

## Performance Considerations

1. **useMemo for computed values** - Avoid recalculating on every render
2. **Spread only what changes** - Minimize object creation
3. **Batch updates when possible** - Single setState call vs multiple
4. **useCallback for handlers** - Prevent unnecessary re-renders
