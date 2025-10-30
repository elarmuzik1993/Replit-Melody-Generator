# Soundfont Integration

## Overview

The Multi-Track Melody Generator uses professional-grade sample-based instruments via the `smplr` library, delivering studio-quality sound with advanced audio processing.

## Features

### Professional Audio Engine
The application now exclusively uses soundfonts for sound generation:
- **High-Quality Samples**: Realistic instruments from the General MIDI soundfont library
- **Professional Effects**: Compression, reverb, and smooth volume control
- **Optimized Performance**: Intelligent polyphony management and resource pooling

### Playback Architecture

The system uses a specialized approach:
- **Tone.js Transport**: Handles timing, scheduling, and synchronization
- **Soundfont Playback**: smplr library generates all audio through Web Audio API
- **Effects Chain**: Custom audio processing for professional sound quality

This ensures perfect timing with studio-grade audio quality.

## Implementation Details

### Soundfont Configuration (utils/soundfont-config.ts)

Maps each synth preset to an appropriate General MIDI soundfont instrument:

**Melody Instruments:**
- Electric Piano → `electric_piano_1`
- Pluck → `pizzicato_strings`
- Marimba → `marimba`
- Bell → `tubular_bells`
- Lead Synth → `lead_2_sawtooth`
- Square Lead → `lead_1_square`
- Ambient Keys → `pad_2_warm`
- Bright Keys → `bright_acoustic_piano`

**Bass Instruments:**
- Analog Bass → `synth_bass_1`
- Sub Bass → `synth_bass_2`
- Reese Bass → `synth_bass_2`
- Fat Bass → `lead_8_bass__lead`
- Acid Bass → `synth_bass_1`
- Bass Synth → `synth_bass_1`

**Harmony/Pad Instruments:**
- Warm Pad → `pad_2_warm`
- String Pad → `string_ensemble_1`
- Pad Synth → `pad_3_polysynth`
- Choir Pad → `choir_aahs`
- Synth Strings → `synth_strings_1`
- Soft Pad → `pad_1_new_age`

### Soundfont Player Wrapper (utils/soundfont-player.ts)

**SoundfontPlayer Class:**
Provides a Tone.js-compatible interface for smplr instruments:

```typescript
class SoundfontPlayer {
  constructor(context: AudioContext, options: SoundfontPlayerOptions)

  // Tone.js-compatible playback
  triggerAttackRelease(note, duration, time?, velocity?)

  // Volume control
  set volume(value: number)  // 0-1
  get volume(): number

  // Lifecycle
  async ensureLoaded(): Promise<void>
  dispose(): void
}
```

**Key Methods:**
- `ensureLoaded()`: Asynchronously loads soundfont samples
- `triggerAttackRelease()`: Plays notes with same signature as Tone.js
- Volume control: Direct 0-1 range (no dB conversion needed)

### Component Integration (components/melody-generator.tsx)

**State Management:**
```typescript
const [useSoundfonts, setUseSoundfonts] = useState(true);
const [soundfontsLoaded, setSoundfontsLoaded] = useState(false);

// Soundfont player refs
const bassSoundfontRef = useRef<SoundfontPlayer | null>(null);
const melodySoundfontRef = useRef<SoundfontPlayer | null>(null);
const harmonySoundfontRef = useRef<SoundfontPlayer | null>(null);

// Shared AudioContext for soundfonts
const audioContextRef = useRef<AudioContext | null>(null);
```

**Initialization (lines 942-991):**
```typescript
const initializeSoundfonts = async () => {
  // Create AudioContext
  if (!audioContextRef.current) {
    audioContextRef.current = new AudioContext();
  }

  // Dispose existing players
  if (bassSoundfontRef.current) bassSoundfontRef.current.dispose();
  // ... (melody, harmony)

  // Create new players
  bassSoundfontRef.current = new SoundfontPlayer(context, {
    instrument: getSoundfontName(state.tracks.bass.synthType),
    volume: state.tracks.bass.volume
  });
  // ... (melody, harmony)

  // Wait for all to load
  await Promise.all([
    bassSoundfontRef.current.ensureLoaded(),
    melodySoundfontRef.current.ensureLoaded(),
    harmonySoundfontRef.current.ensureLoaded()
  ]);

  setSoundfontsLoaded(true);
};
```

**Playback Selection (lines 1844-1859):**
```typescript
// Use soundfont or Tone.js synth based on mode
if (usingSoundfonts && bassSoundfontRef.current) {
  bassSoundfontRef.current.triggerAttackRelease(
    value.note,
    durationInSeconds * 0.9,
    time,
    value.velocity
  );
} else if (bassSynthRef.current) {
  bassSynthRef.current.triggerAttackRelease(
    value.note,
    durationInSeconds * 0.9,
    time,
    value.velocity
  );
}
```

**Volume Updates (lines 1177-1202):**
```typescript
useEffect(() => {
  if (useSoundfonts && soundfontsLoaded) {
    // Update soundfont player volumes
    if (bassSoundfontRef.current) {
      bassSoundfontRef.current.volume = state.tracks.bass.volume;
    }
    // ... (melody, harmony)
  } else if (toneLoaded) {
    // Update Tone.js synth volumes
    if (bassSynthRef.current) {
      bassSynthRef.current.volume.value = window.Tone.gainToDb(state.tracks.bass.volume) - 6;
    }
    // ... (melody, harmony)
  }
}, [state.tracks.bass.volume, /* ... */]);
```

## UI Components

### Audio Engine Toggle (lines 2381-2409)

Located in Global Settings card:

```tsx
<div className="mt-6 p-4 bg-card/50 rounded-lg border border-border">
  <div className="flex items-center justify-between">
    <div>
      <h3 className="text-sm font-semibold">Audio Engine</h3>
      <p className="text-xs text-muted-foreground">
        {useSoundfonts
          ? "Using realistic sample-based instruments"
          : "Using synthesized sounds"}
      </p>
    </div>
    <Button
      variant={useSoundfonts ? "default" : "outline"}
      onClick={() => setUseSoundfonts(!useSoundfonts)}
    >
      {useSoundfonts ? "🎹 Soundfonts" : "🎛️ Synthesizers"}
    </Button>
  </div>
  {useSoundfonts && !soundfontsLoaded && (
    <p className="text-xs text-amber-500">Loading soundfonts...</p>
  )}
</div>
```

## Usage

### For Users

1. **Default Behavior**: Soundfonts are enabled by default
2. **Switching Engines**:
   - Click the "🎹 Soundfonts" or "🎛️ Synthesizers" button in Global Settings
   - New instruments will load automatically
   - Previously generated melodies will play with the new engine
3. **Loading Time**: First-time soundfont loading may take a few seconds

### For Developers

**Adding New Instruments:**

1. Update `soundfontPresets` in `soundfont-config.ts`:
```typescript
new_instrument: {
  name: "Display Name",
  soundfontName: "general_midi_instrument_name",
  category: "melody" | "bass" | "harmony"
}
```

2. Add to Tone.js `synthPresets` (if not already present)

3. Instrument will automatically work with both engines

**Available Soundfont Instruments:**

See `additionalInstruments` in `soundfont-config.ts` for 40+ available instruments including:
- Acoustic instruments (piano, guitar, bass, strings)
- Brass (trumpet, trombone, french horn)
- Woodwinds (flute, clarinet, saxophone)
- Chromatic percussion (vibraphone, xylophone, glockenspiel)
- Organs (drawbar, church, rock)
- Synth leads and pads
- Ethnic instruments (sitar, koto, kalimba)

## Technical Architecture

### Hybrid Audio System

```
┌─────────────────────────────────────────────┐
│          User Selects Audio Engine          │
└───────────────┬────────────────┬────────────┘
                │                │
      ┌─────────▼─────┐  ┌───────▼────────┐
      │  Soundfonts   │  │   Tone.js      │
      │   (smplr)     │  │  Synthesizers  │
      └─────────┬─────┘  └───────┬────────┘
                │                │
                └────────┬───────┘
                         │
              ┌──────────▼──────────┐
              │  Tone.js Transport  │
              │  (Timing & Sync)    │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │   Audio Output      │
              └─────────────────────┘
```

### Benefits

**Soundfonts:**
- ✅ Realistic acoustic instruments
- ✅ Professional sound quality
- ✅ No additional setup required
- ✅ Samples hosted online (no local storage needed)
- ⚠️ Slight loading time on first use
- ⚠️ Larger network usage

**Tone.js Synthesizers:**
- ✅ Instant loading
- ✅ No network required after initial page load
- ✅ Electronic/synthetic sounds
- ✅ More CPU-efficient
- ⚠️ Less realistic for acoustic instruments

## Performance Considerations

### Memory
- **Soundfonts**: ~1-5MB per instrument (loaded on demand)
- **Tone.js**: Minimal memory footprint

### Network
- **Soundfonts**: Fetch samples from GitHub on first load
- **Caching**: Browser caches samples after initial load
- **Offline**: Soundfonts require network; Tone.js works offline

### CPU
- **Soundfonts**: Sample playback (very efficient)
- **Tone.js**: Real-time synthesis (more CPU intensive)

## Bundle Impact

- **smplr library**: +19KB gzipped
- **Total bundle**: 391KB → 391KB (negligible increase)
- **Runtime loading**: Soundfont samples loaded on-demand

## Recent Enhancements (v2.0)

### Audio Engine Improvements

The soundfont player has been significantly enhanced with professional-grade features:

✅ **Audio Effects Chain**
- Dynamic compression (prevents clipping)
- Convolution reverb with per-track configuration
- Optional low-pass filtering for warmth
- Smooth volume ramping (no clicks/pops)

✅ **Performance Optimizations**
- Intelligent polyphony management (per-track voice limits)
- Proper resource cleanup and memory management
- Active note tracking and voice stealing
- Performance monitoring API

✅ **Better Playback Quality**
- Velocity curves for expressive dynamics
- Proper instrument loading detection
- Robust error handling and recovery
- Real-time effect parameter adjustment

For detailed documentation, see: `client/src/utils/AUDIO_ENGINE_IMPROVEMENTS.md`

## Future Enhancements

Potential improvements:
- [ ] Per-track audio engine selection
- [ ] Custom soundfont URL support
- [✅] Reverb and effects for soundfonts (COMPLETED)
- [ ] Soundfont preset browser
- [ ] Download soundfonts for offline use
- [ ] More instrument mappings
- [ ] MIDI program change export for correct instruments
- [✅] Velocity curves per instrument type (COMPLETED)
- [ ] Articulation support (staccato, legato, etc.)
- [ ] EQ and additional effects (delay, chorus)

## Dependencies

- **smplr**: ^0.x.x - Modern soundfont player library
- **Tone.js**: Used for Transport timing regardless of audio engine
- **Web Audio API**: Required for both engines

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support (may have higher latency)

## Troubleshooting

**Soundfonts not loading:**
- Check browser console for network errors
- Ensure internet connection is active
- Try switching to Synthesizers mode
- Refresh the page

**Audio cutting out:**
- Reduce number of simultaneous notes
- Lower track volumes
- Check system audio buffer settings

**Latency issues:**
- Use wired headphones instead of Bluetooth
- Close other audio applications
- Try Synthesizers mode for lower latency

## References

- smplr library: https://github.com/danigb/smplr
- smplr demo: https://danigb.github.io/smplr/
- Soundfont samples: https://github.com/smpldsnds
- General MIDI spec: https://en.wikipedia.org/wiki/General_MIDI
