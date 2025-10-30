# Multi-Track Melody Generator

A sophisticated web-based music generation tool that creates layered compositions with bass, melody, and harmony tracks. Features genre-specific generation, humanized rhythms, and an interactive Roland TR-8S style step sequencer.

🎵 **[Live Demo](https://your-username.github.io/Replit-Melody-Generator/)**

## Features

### 🎹 Multi-Track Generation
- **Three synchronized tracks**: Bass, Melody, and Harmony
- Independent control over each track (volume, octave range, sound)
- Generate all tracks at once or individually
- Real-time playback with Tone.js audio engine

### 🎨 Genre-Specific Styles
8+ music genres with authentic characteristics:
- **Pop**: Catchy hooks, repetitive melodies
- **Jazz**: Swing rhythms, complex intervals
- **Hip Hop**: Sparse loops, laid-back grooves
- **EDM**: Driving energy, build-ups
- **Classical**: Elegant phrases, dynamic range
- **Trap**: Hi-hat rolls, dark atmosphere
- **Latin**: Syncopated dance rhythms
- **Ballad**: Slow, emotional, sustained notes

Each genre controls:
- Rhythm patterns
- Interval preferences (stepwise vs leaps)
- Velocity ranges
- Motif repetition rates
- Rest probability

### 🎵 Intelligent Melody Generation
**Phase 1 - Rhythm Variation:**
- 8+ rhythm patterns (swing, syncopated, triplet, dotted, etc.)
- Varied note durations (16th notes to whole notes)
- Dynamic velocity (MIDI 0-127)

**Phase 2 - Melodic Structure:**
- Motif generation and repetition
- Directional contour (rising/falling phrases)
- Question-answer phrase structure
- Transposition and variation

**Phase 3 - Advanced Polish:**
- Interval quality weights (perfect 5ths, thirds, etc.)
- Micro-timing humanization (±15ms jitter)
- Smart rest placement between phrases
- Articulation and phrasing

### 🎹 Professional Audio Engine (Enhanced v2.0)
Studio-grade soundfont playback with professional audio processing:

- **Realistic Instruments** - High-quality sample-based sounds (piano, bass, strings, pads, leads)
- **Dynamic Compression** - Prevents clipping, consistent levels
- **Convolution Reverb** - Spatial depth with per-track configuration (bass 15%, melody 25%, harmony 30%)
- **Intelligent Polyphony** - Voice management prevents CPU spikes (8-24 notes per track)
- **Velocity Curves** - Expressive, natural dynamics with power curve
- **Smooth Volume Control** - 50ms ramping eliminates clicks/pops
- **40+ Instruments** - Complete General MIDI soundfont library
- **Web Audio Effects** - Real-time processing with zero latency

### 🥁 Roland TR-8S Style Step Sequencer
Interactive visual sequencer for bass track:
- **16/32 steps** based on loop length (4 or 8 bars)
- **LED position indicator** - Bright orange LED moves through pattern
- **Continuous movement** - Shows every 16th note, not just active notes
- **Custom loop points** - Click any step to set loop end
- **Visual feedback** - See rhythm patterns at a glance

### 🎚️ Comprehensive Controls

**Global Settings:**
- Tempo: 60-180 BPM
- Master Volume: 0-100%
- Time Signature: 4/4, 3/4, 6/8, 5/4, 7/8
- Musical Scale: Major, Minor, Dorian, Phrygian, Mixolydian, Pentatonic, Blues, Whole Tone, Chromatic
- Key: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
- Notes per Track: 4-16

**Per-Track Controls:**
- Enable/Disable toggle
- Volume slider (0-100%)
- Octave range selector (0-8)
- Sound type selector (12+ synth types per track)

**Playback Options:**
- Loop on/off
- Visual metronome
- Loop length: 4 or 8 bars

### 🎼 MIDI Export
Download generated compositions as standard MIDI files (.mid) compatible with all DAWs.

### 🎨 Professional UI
- Modern dark theme with cyan/purple accents
- Responsive layout
- Smooth animations
- Accessible controls
- Real-time visual feedback

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **Wouter** for routing

### Audio Engine
- **Tone.js** - Web Audio API wrapper
  - Multiple synthesizer types
  - Precise timing and scheduling
  - Effects and signal processing
- **smplr** - Soundfont player for realistic instruments
  - Sample-based playback
  - General MIDI soundfont library
  - Online sample hosting

### Libraries
- **midi-writer-js** - MIDI file export
- **Lucide React** - Icon components

## Project Structure

```
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── melody-generator.tsx  # Main component (1500+ lines)
│   │   │   └── ui/                   # Radix UI components
│   │   ├── pages/
│   │   │   ├── melody-generator.tsx
│   │   │   └── not-found.tsx
│   │   ├── App.tsx                   # Router setup
│   │   └── main.tsx
│   └── index.html
├── server/
│   └── index.ts
├── docs/
│   ├── COMPONENT_STRUCTURE.md        # Component hierarchy
│   ├── STATE_MANAGEMENT.md           # State architecture
│   ├── GENRE_SYSTEM.md               # Genre specifications
│   ├── MELODY_GENERATION_IMPROVEMENTS.md  # Algorithm details
│   ├── STEP_SEQUENCER.md             # Sequencer documentation
│   ├── SOUNDFONT_INTEGRATION.md      # Soundfont system documentation
│   ├── STYLING_GUIDE.md              # UI design system
│   └── PROJECT_OVERVIEW.md           # High-level overview
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/Replit-Melody-Generator.git
cd Replit-Melody-Generator

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building for Production

```bash
# Build the project
npm run build

# Deploy to GitHub Pages
npm run deploy
```

## Usage Guide

### Quick Start
1. Open the application
2. Adjust global settings (tempo, key, scale)
3. Click "Generate All Tracks" to create a composition
4. Press "Play" to hear your music
5. Fine-tune individual tracks (volume, octave, sound)
6. Download as MIDI to use in your DAW

### Genre Selection
1. Choose a genre from the "Genre Style" dropdown
2. Optionally select a recommended scale for that genre
3. Generate tracks - melodies will follow genre characteristics
4. Experiment with unexpected genre + scale combinations

### Step Sequencer
1. Generate a bass track
2. View the step sequencer below the bass controls
3. Click "Play" to see the LED indicator move
4. Click any step to set a custom loop end point
5. Click "Reset Loop" to restore full pattern

### Advanced Tips
- **Layering**: Enable/disable tracks to find interesting combinations
- **Variation**: Regenerate individual tracks while keeping others
- **Octave spacing**: Keep bass low (2-3), melody mid (4-5), harmony high (4-6)
- **Volume balance**: Bass 80%, Melody 70%, Harmony 50% works well
- **Genre mixing**: Try Jazz scale with Hip Hop genre for unique results

## Documentation

Comprehensive documentation available in the `/docs` folder:

- **[COMPONENT_STRUCTURE.md](./COMPONENT_STRUCTURE.md)** - UI component hierarchy and file structure
- **[STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)** - State architecture and patterns
- **[GENRE_SYSTEM.md](./GENRE_SYSTEM.md)** - Genre characteristics and implementation
- **[MELODY_GENERATION_IMPROVEMENTS.md](./MELODY_GENERATION_IMPROVEMENTS.md)** - Algorithm details and humanization phases
- **[STEP_SEQUENCER.md](./STEP_SEQUENCER.md)** - Step sequencer system documentation
- **[SOUNDFONT_INTEGRATION.md](./SOUNDFONT_INTEGRATION.md)** - Dual audio engine system with soundfonts
- **[STYLING_GUIDE.md](./STYLING_GUIDE.md)** - UI design system and color palette
- **[PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)** - High-level project overview

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines
1. Follow TypeScript best practices
2. Maintain existing code style
3. Update documentation for new features
4. Test playback and MIDI export
5. Ensure responsive design

## Future Roadmap

Potential enhancements:
- [ ] Sequencer for melody and harmony tracks
- [ ] Editable steps (click to toggle, edit velocity/note)
- [ ] More genres (Reggae, Country, Rock, Metal, Ambient)
- [ ] Genre-specific bass patterns
- [ ] Pattern save/load functionality
- [ ] More synth types and effects
- [ ] User-created custom genre presets
- [ ] Euclidean rhythm generation
- [ ] MIDI input for live jamming
- [ ] Audio recording/export (WAV/MP3)

## License

MIT License - feel free to use this project for any purpose.

## Acknowledgments

- **Tone.js** - Powerful Web Audio framework
- **Radix UI** - Accessible component primitives
- **Roland TR-8S** - Inspiration for step sequencer design
- Music theory resources and algorithmic composition research

## Links

- **Live Demo**: https://your-username.github.io/Replit-Melody-Generator/
- **Repository**: https://github.com/your-username/Replit-Melody-Generator
- **Issues**: https://github.com/your-username/Replit-Melody-Generator/issues

---

Made with 🎵 and code
