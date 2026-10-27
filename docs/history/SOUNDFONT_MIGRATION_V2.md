# Soundfont Migration Guide - v2.0

## Overview

Version 2.0 fully migrates from dual audio engines (Tone.js synths + Soundfonts) to **soundfonts-only** architecture, delivering professional audio quality for all users.

## What Changed

### Removed
- ❌ Tone.js synthesizer playback
- ❌ Audio engine toggle UI
- ❌ Dual-mode playback code
- ❌ Synth initialization logic
- ❌ `bassSynthRef`, `melodySynthRef`, `harmonySynthRef` references

### Enhanced
- ✅ Soundfont player with professional effects
- ✅ Automatic initialization on app load
- ✅ Cleaner, simpler architecture
- ✅ Better performance (smaller bundle: 394KB vs 396KB)

## Architecture Changes

### Before (v1.x)
```
User Toggle
    ↓
┌───┴────┐
│        │
Tone.js  Soundfonts
Synths   (smplr)
    │        │
    └───┬────┘
        ↓
  Tone.js Transport
        ↓
   Audio Output
```

### After (v2.0)
```
Auto-initialize
      ↓
  Soundfonts (smplr)
  + Effects Chain
      ↓
  Tone.js Transport
      ↓
   Audio Output
```

## Code Changes

### 1. State Management

**Removed:**
```typescript
const [useSoundfonts, setUseSoundfonts] = useState(true);
const bassSynthRef = useRef<any>(null);
const melodySynthRef = useRef<any>(null);
const harmonySynthRef = useRef<any>(null);
```

**Kept:**
```typescript
const [soundfontsLoaded, setSoundfontsLoaded] = useState(false);
const bassSoundfontRef = useRef<SoundfontPlayer | null>(null);
const melodySoundfontRef = useRef<SoundfontPlayer | null>(null);
const harmonySoundfontRef = useRef<SoundfontPlayer | null>(null);
```

### 2. Initialization

**Removed:**
```typescript
const initializeSynths = () => {
  const bassPreset = synthPresets[state.tracks.bass.synthType];
  bassSynthRef.current = bassPreset.config();
  // ...
};

useEffect(() => {
  initializeSynths();
}, [toneLoaded, /* ... */]);
```

**New:**
```typescript
useEffect(() => {
  if (toneLoaded) {
    initializeSoundfonts(); // Auto-load soundfonts
  }
}, [toneLoaded, state.tracks.melody.synthType, /* ... */]);
```

### 3. Playback

**Removed conditional:**
```typescript
if (usingSoundfonts && bassSoundfontRef.current) {
  bassSoundfontRef.current.triggerAttackRelease(/* ... */);
} else if (bassSynthRef.current) {
  bassSynthRef.current.triggerAttackRelease(/* ... */);
}
```

**New direct call:**
```typescript
if (bassSoundfontRef.current) {
  bassSoundfontRef.current.triggerAttackRelease(/* ... */);
}
```

### 4. Volume Control

**Removed:**
```typescript
useEffect(() => {
  if (useSoundfonts && soundfontsLoaded) {
    // Update soundfont volumes
  } else if (toneLoaded) {
    // Update synth volumes
    bassSynthRef.current.volume.value = window.Tone.gainToDb(/* ... */);
  }
}, [/* ... */]);
```

**New:**
```typescript
useEffect(() => {
  if (soundfontsLoaded) {
    if (bassSoundfontRef.current) {
      bassSoundfontRef.current.volume = state.tracks.bass.volume;
    }
    // ...
  }
}, [state.tracks.bass.volume, soundfontsLoaded]);
```

### 5. UI Changes

**Removed Toggle:**
```tsx
<Button onClick={() => setUseSoundfonts(!useSoundfonts)}>
  {useSoundfonts ? "🎹 Soundfonts" : "🎛️ Synthesizers"}
</Button>
```

**New Status Indicator:**
```tsx
<div className="mt-6 p-4 bg-card/50 rounded-lg border border-border">
  <h3>🎹 Professional Audio Engine</h3>
  <p>High-quality soundfont instruments with reverb & compression</p>
  {soundfontsLoaded && <span>Ready</span>}
</div>
```

## Benefits

### For Users
1. **No Confusion**: One audio engine, consistent experience
2. **Better Sound**: Always get professional-quality instruments
3. **Automatic**: No need to toggle or configure
4. **Faster Load**: Smaller bundle, less code to parse

### For Developers
1. **Simpler Code**: No conditional audio routing
2. **Easier Maintenance**: Single code path
3. **Better Performance**: Removed unused synth code
4. **Clearer Intent**: Soundfont-first architecture

## Performance Impact

| Metric | Before (v1.x) | After (v2.0) | Change |
|--------|---------------|--------------|--------|
| Bundle Size | 396.05 KB | 394.90 KB | -1.15 KB |
| Audio Engines | 2 (dual) | 1 (soundfont) | Simplified |
| Code Complexity | High | Low | Reduced |
| User Choice | Toggle | Automatic | Streamlined |

## Migration for Users

**No action required!** Existing melodies will play automatically with soundfonts.

### If You Preferred Synths
The soundfont instruments are mapped to provide similar timbres:
- **Analog Bass** → Synth Bass 1
- **Lead Synth** → Lead 2 (Sawtooth)
- **Warm Pad** → Pad 2 (Warm)
- And 40+ other instruments available

## Technical Details

### Tone.js Role
Tone.js is still used for:
- **Transport**: Timing and synchronization
- **Scheduling**: Note timing and loops
- **Metronome**: Click track functionality

But NOT for:
- ❌ Sound generation (now smplr)
- ❌ Synthesis (now samples)
- ❌ Effects (now Web Audio API)

### Audio Chain
```
smplr Soundfont
      ↓
  Master Gain
      ↓
  Compressor
      ↓
 Low-Pass Filter (optional)
      ↓
  ┌───┴───┐
Dry    Reverb
  └───┬───┘
      ↓
  AudioContext
   Destination
```

## Troubleshooting

### "Soundfonts not loaded yet"
- Wait 2-5 seconds for instruments to load
- Check network connection
- Check browser console for errors

### No sound when playing
1. Check volume sliders (not at 0)
2. Ensure AudioContext is running (look for console logs)
3. Check browser console for errors
4. Try refreshing the page

### Missing old synth sounds
- All synth presets are mapped to equivalent soundfonts
- Sound character may differ (samples vs synthesis)
- Quality should be higher with soundfonts

## Future Plans

- [ ] Offline soundfont caching
- [ ] Custom soundfont URL support
- [ ] Per-track effect configuration
- [ ] More instrument options (70+ available in General MIDI)
- [ ] Articulation support (staccato, legato)

## Feedback

If you encounter issues or miss the old synth sounds, please open an issue with:
- Browser and version
- Steps to reproduce
- Console error messages
- Which preset/instrument you're using

---

**Version:** 2.0
**Date:** 2025-01-30
**Breaking Changes:** None (backward compatible)
**Bundle Size:** 394.90 KB (-1.15 KB)
