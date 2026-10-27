# Component Structure

## Main Components

### 1. App (`client/src/App.tsx`)
- Root application component
- Sets up routing with Wouter
- Hash-based routing for GitHub Pages compatibility
- Wraps everything in QueryClientProvider and TooltipProvider

**Routes:**
- `/` - Melody Generator page
- `/Replit-Melody-Generator` - Melody Generator (GitHub Pages path)
- `*` - 404 Not Found page

### 2. MelodyGenerator Page (`client/src/pages/melody-generator.tsx`)
- Simple wrapper for the main component
- Applies background styling

### 3. MelodyGeneratorComponent (`client/src/components/melody-generator.tsx`)
**Main application logic - 1500+ lines**

#### Component Sections:

##### Header
- Title: "MULTI-TRACK GENERATOR"
- Subtitle: "Create layered music with Bass, Melody, and Harmony"

##### Global Control Buttons (Line ~1135)
- **Generate All Tracks** - Generates all three tracks at once
- **Play/Stop** - Toggles playback
- **Download MIDI** - Exports to MIDI file

##### Global Settings Card (Line ~1176)
**Row 1: Tempo, Master Volume, Time Signature**
- Tempo (BPM): Slider 60-180
- Master Volume: Slider 0-100%
- Time Signature: Dropdown (4/4, 3/4, 6/8, etc.)

**Row 2: Scale, Key, Notes per Track**
- Musical Scale: Dropdown (Major, Minor, etc.)
- Key: Dropdown (C-B with sharps)
- Notes per Track: Slider 4-16

##### Track Cards (Line ~1330) - Loop over ['bass', 'melody', 'harmony']
Each track card contains:

1. **Header**
   - Track name (Bass/Melody/Harmony)
   - Enable/Disable toggle
   - Generate button

2. **Volume Slider**
   - Range: 0-100%
   - Shows percentage value

3. **Octave Range Selector**
   - Two dropdowns: Min (0-8) to Max (0-8)
   - Validates min doesn't exceed max

4. **Sound Selector**
   - Dropdown with synth types:
     - Bass: Bass Synth, Sub Bass, etc.
     - Melody: Electric Piano, Pluck, etc.
     - Harmony: Pad Synth, Strings, etc.

##### Playback Options Card (Line ~1462)
- Loop On/Off toggle
- Metronome toggle (visual only)
- Loop Length: 4 or 8 bars

## UI Components (`client/src/components/ui/`)

### Radix UI Primitives (Customized)
- `button.tsx` - Button variants (default, outline, secondary, etc.)
- `slider.tsx` - Custom slider with track and thumb
- `select.tsx` - Dropdown select component
- `card.tsx` - Card container with header/content
- `switch.tsx` - Toggle switch

### Component Props
All UI components accept standard HTML props plus Radix-specific props.

## Component Hierarchy
```
App
└── Router
    ├── MelodyGenerator (Page)
    │   └── MelodyGeneratorComponent
    │       ├── Header
    │       ├── Global Controls
    │       │   ├── Button (Generate All)
    │       │   ├── Button (Play/Stop)
    │       │   └── Button (Download MIDI)
    │       ├── Global Settings Card
    │       │   ├── Slider (Tempo)
    │       │   ├── Slider (Master Volume)
    │       │   ├── Select (Time Signature)
    │       │   ├── Select (Musical Scale)
    │       │   ├── Select (Key)
    │       │   └── Slider (Notes per Track)
    │       ├── Track Cards (x3)
    │       │   ├── Card Header
    │       │   │   ├── Track Title
    │       │   │   ├── Switch (Enable/Disable)
    │       │   │   └── Button (Generate)
    │       │   ├── Slider (Volume)
    │       │   ├── Select (Octave Min)
    │       │   ├── Select (Octave Max)
    │       │   └── Select (Sound Type)
    │       └── Playback Options Card
    │           ├── Button (Loop Toggle)
    │           ├── Button (Metronome)
    │           └── Select (Loop Length)
    └── NotFound (404)
```

## Component File Locations

### Pages
- `client/src/pages/melody-generator.tsx` - Main page
- `client/src/pages/not-found.tsx` - 404 page

### Main Components
- `client/src/components/melody-generator.tsx` - Core app logic

### UI Components (Radix-based)
- `client/src/components/ui/button.tsx`
- `client/src/components/ui/slider.tsx`
- `client/src/components/ui/select.tsx`
- `client/src/components/ui/card.tsx`
- `client/src/components/ui/switch.tsx`
- Plus 40+ other UI primitives

## Key Features by Section

### Track Generation (Lines ~670-750)
- Random note selection from scale
- Respects octave ranges
- Uses algorithmic composition

### Playback (Lines ~840-1080)
- Tone.js synth initialization
- Scheduled note playback
- Loop handling
- Track synchronization

### MIDI Export (Lines ~1015-1070)
- Converts generated tracks to MIDI format
- Uses midi-writer-js library
- Downloads as .mid file

## Component Best Practices
1. Track state is managed in single `MultiTrackState` object
2. All track operations iterate over `['bass', 'melody', 'harmony']`
3. UI updates trigger state changes via `setState`
4. Tone.js audio is managed in useEffect hooks
5. All components use Tailwind for styling
