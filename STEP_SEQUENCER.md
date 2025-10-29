# Step Sequencer System

## Overview

The bass track features a visual step sequencer with a Roland TR-8S style LED position indicator that shows real-time playback progress through the pattern.

## Visual Components

### Step Grid
- **16 steps** for 4-bar loops
- **32 steps** for 8-bar loops
- Each step represents a 16th note subdivision
- Visual feedback shows which notes are active

### Roland TR-8S Style LED Indicator
- Bright orange LED dot that moves above each step
- Continuous sequential movement through all steps (not just note positions)
- Pulsing glow effect for visibility
- Classic drum machine aesthetic

## Features

### 1. Visual Step Display (melody-generator.tsx:2355-2519)

The sequencer shows:
- **Active notes**: Bright primary color for note starts
- **Note sustains**: Dimmed primary color for held notes
- **Empty steps**: Neutral background
- **Beat markers**: Vertical lines every 4 steps
- **Bar markers**: Thicker vertical lines every 16 steps

### 2. Interactive Loop Points

**Click any step to set custom loop end:**
- Click a step to make it the loop end point
- Pattern loops from step 1 to your selected step
- "Reset Loop" button restores full-length playback
- Visual indicators:
  - Red border on loop end step
  - Red dot marker above loop end
  - Dimmed appearance for steps outside loop range

### 3. Continuous LED Position Indicator

**Implementation (melody-generator.tsx:1663-1692):**

```typescript
// Dedicated step sequencer for LED indicator
const totalSteps = state.loopLength === 4 ? 16 : 32;
const effectiveSteps = customLoopEndStep !== null ? customLoopEndStep + 1 : totalSteps;
const stepArray = Array.from({ length: effectiveSteps }, (_, i) => i);

stepSequencerRef.current = new window.Tone.Sequence(
  (time, step) => {
    // Update current step index for LED display
    window.Tone.Draw.schedule(() => {
      setState(prev => ({
        ...prev,
        tracks: {
          ...prev.tracks,
          bass: {
            ...prev.tracks.bass,
            currentStepIndex: step
          }
        }
      }));
    }, time);
  },
  stepArray,
  "16n" // 16th note subdivision
);
```

**Key Features:**
- Runs independently from note playback
- Updates every 16th note (4 steps per beat)
- Syncs with Transport tempo automatically
- Respects custom loop end points
- Uses `Tone.Draw.schedule` for smooth UI updates

### 4. LED Visual Design (melody-generator.tsx:2497-2507)

```typescript
{isCurrentlyPlaying && (
  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-full flex justify-center pointer-events-none">
    <div className="relative">
      {/* Outer glow */}
      <div className="absolute inset-0 w-3 h-3 bg-orange-500 rounded-full blur-md animate-pulse" />
      {/* LED dot */}
      <div className="relative w-3 h-3 bg-orange-500 rounded-full border-2 border-orange-300 shadow-lg shadow-orange-500/80" />
    </div>
  </div>
)}
```

**Styling:**
- Orange color (Roland signature)
- 3x3 pixel LED dot
- Blurred outer glow with pulse animation
- Light border for depth
- Strong shadow for visibility
- Positioned above step grid
- Non-interactive (pointer-events-none)

## State Management

### TrackData Interface Extension

```typescript
interface TrackData {
  // ... existing fields
  currentStepIndex: number;        // Current step position (0-15 or 0-31)
  customLoopEndStep: number | null; // Custom loop end point
}
```

### State Updates

**During Playback:**
- `currentStepIndex` updates every 16th note
- Value ranges from 0 to 15 (4-bar) or 0 to 31 (8-bar)
- Resets to -1 when playback stops

**Custom Loop End:**
- Click handler updates `customLoopEndStep`
- Affects both LED range and audio playback
- Null value means full-length loop

## Technical Implementation

### Sequencer Lifecycle

1. **Start Playback** (melody-generator.tsx:1663-1692)
   - Create step sequencer with Tone.Sequence
   - Set subdivision to "16n" (16th notes)
   - Calculate effective steps based on loop length and custom end point
   - Start sequencer synchronized with Transport

2. **During Playback**
   - Step sequencer callback fires every 16th note
   - Uses `Tone.Draw.schedule` for UI thread synchronization
   - Updates `currentStepIndex` in state
   - React re-renders LED position

3. **Stop Playback** (melody-generator.tsx:1905-1909)
   - Stop and dispose step sequencer
   - Reset `currentStepIndex` to -1
   - Clean up Transport

### Synchronization

**Multiple Sequences:**
- `stepSequencerRef`: LED position (16th note grid)
- `bassSequenceRef`: Bass note playback (varied rhythms)
- `melodySequenceRef`: Melody note playback
- `harmonySequenceRef`: Harmony note playback

All sequences:
- Start together with `Transport.start()`
- Share same tempo and loop settings
- Stop together with `Transport.stop()`

### Custom Loop Implementation

**Setting Loop End:**
```typescript
onClick={() => {
  setState(prev => ({
    ...prev,
    tracks: {
      ...prev.tracks,
      bass: {
        ...prev.tracks.bass,
        customLoopEndStep: index
      }
    }
  }));
}}
```

**Filtering Playback:**
```typescript
const effectiveSteps = customLoopEndStep !== null ? customLoopEndStep + 1 : totalSteps;
const stepArray = Array.from({ length: effectiveSteps }, (_, i) => i);
```

Bass notes are also filtered to only play within the custom loop range.

## Usage

### Viewing the Sequencer
1. Generate a bass track
2. Sequencer automatically appears below bass track controls
3. Shows rhythm pattern visually

### Interactive Features
1. **Play** - Watch LED move through pattern
2. **Click Step** - Set custom loop end point
3. **Reset Loop** - Return to full-length pattern

### Visual Feedback
- Active step glows with orange LED
- Loop end marked with red border
- Out-of-loop steps dimmed
- Beat/bar markers for orientation

## Future Enhancements

Potential additions:
- Step sequencer for melody and harmony tracks
- Click to toggle individual steps on/off
- Velocity editing per step
- Note editing per step
- Multiple pattern banks
- Pattern copy/paste
- Swing amount control
- Step probability/randomization
- Euclidean rhythm generation
- MIDI drag-and-drop export of individual patterns
