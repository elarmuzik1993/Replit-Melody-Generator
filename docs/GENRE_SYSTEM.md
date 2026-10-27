# Genre-Specific Melody Generation System

## Overview

The genre system applies music style characteristics to generated melodies, making them sound authentic to specific musical genres.

## Available Genres

### 1. **Pop**
- **Rhythm:** Catchy syncopations, dotted rhythms
- **Intervals:** Mostly stepwise (30% leap tolerance)
- **Velocity:** 75-95 (energetic, consistent)
- **Motif Repetition:** 70% (very catchy hooks)
- **Rests:** 20% (some breathing, but keeps momentum)
- **Tempo Range:** 100-140 BPM
- **Best Scales:** Major, Minor, Pentatonic
- **Character:** Catchy, repetitive melodies with strong hooks

### 2. **Jazz**
- **Rhythm:** Swing patterns, triplets, complex syncopation
- **Intervals:** Wide leaps allowed (60% leap tolerance)
- **Velocity:** 60-100 (wide dynamic range)
- **Motif Repetition:** 40% (improvised, varied)
- **Rests:** 30% (frequent breathing for phrasing)
- **Tempo Range:** 80-200 BPM
- **Best Scales:** Dorian, Mixolydian, Blues
- **Character:** Swung rhythms, complex intervals, improvised feel

### 3. **Hip Hop**
- **Rhythm:** Syncopated, laid-back grooves
- **Intervals:** Simple, stepwise (25% leap tolerance)
- **Velocity:** 70-90 (moderate, consistent)
- **Motif Repetition:** 80% (highly repetitive loops)
- **Rests:** 40% (sparse, lots of space)
- **Tempo Range:** 70-100 BPM
- **Best Scales:** Minor, Blues, Pentatonic
- **Character:** Repetitive loops, simple melodies, heavy rests

### 4. **EDM**
- **Rhythm:** Fast subdivisions, driving energy
- **Intervals:** Moderate leaps (50% leap tolerance)
- **Velocity:** 85-100 (high energy, loud)
- **Motif Repetition:** 75% (build-up repetition)
- **Rests:** 15% (minimal, constant drive)
- **Tempo Range:** 120-150 BPM
- **Best Scales:** Minor, Major, Pentatonic
- **Character:** Build-ups, drops, energetic and driving

### 5. **Classical**
- **Rhythm:** Elegant dotted rhythms, triplets
- **Intervals:** Balanced (40% leap tolerance)
- **Velocity:** 50-100 (full dynamic range)
- **Motif Repetition:** 50% (balanced development)
- **Rests:** 25% (formal phrasing)
- **Tempo Range:** 60-140 BPM
- **Best Scales:** Major, Minor
- **Character:** Elegant phrases, dynamic range, formal structure

### 6. **Trap**
- **Rhythm:** Hi-hat rolls, rapid subdivisions
- **Intervals:** Moderate (35% leap tolerance)
- **Velocity:** 75-95 (punchy, consistent)
- **Motif Repetition:** 85% (extremely repetitive)
- **Rests:** 35% (sparse, moody)
- **Tempo Range:** 130-170 BPM
- **Best Scales:** Minor, Blues
- **Character:** Hi-hat rolls, sparse melodies, dark atmosphere

### 7. **Latin**
- **Rhythm:** Syncopated, dance grooves
- **Intervals:** Moderate (35% leap tolerance)
- **Velocity:** 75-100 (lively, energetic)
- **Motif Repetition:** 60% (balanced)
- **Rests:** 20% (keeps dancing energy)
- **Tempo Range:** 100-140 BPM
- **Best Scales:** Major, Dorian, Mixolydian
- **Character:** Syncopated rhythms, festive, danceable

### 8. **Ballad**
- **Rhythm:** Slow, sustained notes
- **Intervals:** Mostly stepwise (30% leap tolerance)
- **Velocity:** 50-80 (soft, emotional)
- **Motif Repetition:** 65% (emotional repetition)
- **Rests:** 30% (breathing, expressive)
- **Tempo Range:** 60-90 BPM
- **Best Scales:** Major, Minor
- **Character:** Slow, emotional, sustained notes, expressive

### 9. **Automatic (Mix)**
- **Default setting** - adaptive mix of styles
- Balanced characteristics for general use
- Tempo Range: 80-140 BPM

## Implementation Details

### GenreStyle Interface
```typescript
interface GenreStyle {
  name: string;
  rhythmPatterns: number[][];       // Available rhythm patterns
  preferredScales: string[];         // Recommended scales
  intervalBias: number;              // 0-1: stepwise vs leaps
  velocityRange: [number, number];   // Min-max velocity
  motifRepetition: number;           // 0-1: exact repetition rate
  restProbability: number;           // 0-1: rest frequency
  tempoRange: [number, number];      // Min-max BPM
  description: string;               // Genre description
}
```

### How Genres Affect Generation

1. **Rhythm Selection** (melody-generator.tsx:1384)
   - Each genre has specific rhythm patterns
   - Pattern chosen randomly from genre's rhythmPatterns array

2. **Interval Bias** (melody-generator.tsx:1420-1424)
   - Controls melodic leap threshold: `7 - (intervalBias * 3)`
   - Controls leap probability: `0.15 + (intervalBias * 0.35)`
   - Jazz (0.6): Wide leaps common
   - Hip Hop (0.25): Mostly steps

3. **Velocity Range** (melody-generator.tsx:1451-1452)
   - All notes use genre-specific min/max velocity
   - Classical: 50-100 (wide dynamics)
   - EDM: 85-100 (loud and energetic)

4. **Motif Repetition** (melody-generator.tsx:1487, 1526)
   - Controls exact vs varied repetition
   - Trap (85%): Highly repetitive
   - Jazz (40%): Mostly variations

5. **Rest Probability** (melody-generator.tsx:1499)
   - Controls phrase breathing space
   - Hip Hop (40%): Lots of space
   - EDM (15%): Minimal gaps

## Usage

### In UI
1. Select genre from "Genre Style" dropdown in Global Settings
2. Generate tracks - melodies will follow genre characteristics
3. Experiment with different genres on same scale/key

### Programmatic
```typescript
setState(prev => ({ ...prev, genre: 'jazz' }));
generateAllTracks(); // Will use jazz characteristics
```

## Genre + Scale Combinations

### Recommended Pairings
- **Pop:** Major, Pentatonic
- **Jazz:** Dorian, Blues, Mixolydian
- **Hip Hop:** Minor, Blues
- **EDM:** Minor (for dark), Major (for uplifting)
- **Classical:** Major, Minor
- **Trap:** Minor, Blues
- **Latin:** Major, Dorian
- **Ballad:** Major, Minor

### Experimenting
Feel free to mix any genre with any scale! Unexpected combinations can create unique sounds.

## Technical Notes

- Genre settings override Phase 1-3 humanization defaults
- All genre characteristics work together holistically
- Micro-timing (Phase 3) still applies regardless of genre
- Bass and harmony tracks not yet genre-aware (future enhancement)

## Future Enhancements

Potential additions:
- Genre-specific bass patterns
- Genre-specific harmony voicings
- More genres (Reggae, Country, Rock, Metal, Ambient)
- Sub-genre variations (Deep House, Bebop Jazz, Mumble Rap)
- User-created custom genre presets
