import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, Info, RotateCcw, Clock, Download, Volume2, VolumeX, RefreshCw, Loader2 } from "lucide-react";
// @ts-ignore - midi-writer-js doesn't have TypeScript definitions
import MidiWriter from "midi-writer-js";
import { SoundfontPlayer } from "@/utils/soundfont-player";
import { soundfontPresets, getSoundfontName } from "@/utils/soundfont-config";
import { LoadingSpinner, InlineLoading, LoadingDots } from "@/components/ui/loading-spinner";
// Refactored modules
import { scales, keys, scaleWeights, intervalQuality } from "@/config/scales";
import { rhythmPatterns, timeSignatures } from "@/config/rhythms";
import { chordProgressions, getChordTones } from "@/config/chords";
import { genreStyles, type GenreStyle } from "@/config/genres";
import { NoteWithTiming, TrackData, MultiTrackState, type TrackType } from "@/types/music";
import { weightedRandomSelect, calculateInterval, applyStepwiseBias } from "@/utils/music/noteUtils";
import { getComplementaryInterval } from "@/utils/music/harmonyUtils";
import { exportToMidi } from "@/utils/midi/midiExporter";

// Import Tone.js
declare global {
  interface Window {
    Tone: any;
  }
}

interface NoteWithTiming {
  note: string;
  duration: number;  // in beats (0.25 = 16th, 0.5 = 8th, 1.0 = quarter, etc.)
  velocity: number;  // 0-127 MIDI velocity
}

interface TrackData {
  generatedSequence: string[];
  generatedSequenceWithTiming: NoteWithTiming[];  // New: rhythm-aware sequence
  isEnabled: boolean;
  volume: number;
  synthType: string;
  currentNoteIndex: number;
  currentStepIndex: number; // Current step position in sequencer (0-15 or 0-31)
  hasGenerated: boolean;
  octaveRange: [number, number];
  customLoopEndStep: number | null; // Custom loop end point (null = use full length)
  reverbAmount: number; // 0-1
  delayTime: number; // seconds
  delayFeedback: number; // 0-1
  delayMix: number; // 0-1
  timeMultiplier: number; // 0.5 = half-time, 1.0 = normal, 2.0 = double-time
}

interface MultiTrackState {
  // Global settings (shared across tracks)
  tempo: number;
  masterVolume: number;
  key: string;
  scale: string;
  genre: string; // Genre style selector
  timeSignature: string;
  isPlaying: boolean;
  isLooping: boolean;
  metronomeEnabled: boolean;
  loopLength: number; // 4 or 8 bars
  
  // Individual track data
  tracks: {
    bass: TrackData;
    melody: TrackData;
    harmony: TrackData;
  };
  
  // Legacy compatibility fields (temporary - to be removed after migration)
  noteCount: number;
  soundType: string;
  generatedMelody: string[];
  currentNoteIndex: number;
  hasGeneratedMelody: boolean;
}

const scales = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10]
};

const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const timeSignatures = {
  "4/4": { name: "4/4", pattern: ["C6", "C5", "C5", "C5"], noteValue: "4n" },
  "3/4": { name: "3/4", pattern: ["C6", "C5", "C5"], noteValue: "4n" },
  "2/4": { name: "2/4", pattern: ["C6", "C5"], noteValue: "4n" },
  "6/8": { name: "6/8 (Compound)", pattern: ["C6", "C5", "C5", "C5", "C5", "C5"], noteValue: "8n" }
};

// Scale degree weights for different track types
const scaleWeights = {
  // Melody weights - varied and expressive
  melody: {
    major: [4.0, 1.0, 2.5, 1.5, 3.0, 1.5, 1.0],
    minor: [4.0, 1.0, 2.5, 1.5, 3.0, 1.0, 2.0],
    pentatonic: [4.0, 2.0, 2.5, 3.0, 2.0],
    blues: [3.5, 2.5, 2.0, 1.5, 2.5, 2.0],
    dorian: [4.0, 1.0, 2.5, 1.5, 3.0, 2.0, 1.5],
    mixolydian: [4.0, 1.0, 2.5, 1.5, 3.0, 1.5, 2.0]
  },
  // Bass weights - emphasis on roots and fifths
  bass: {
    major: [8.0, 0.5, 1.0, 0.5, 4.0, 0.5, 0.5], // Root and fifth emphasized
    minor: [8.0, 0.5, 1.0, 0.5, 4.0, 0.5, 1.0],
    pentatonic: [8.0, 1.0, 1.5, 4.0, 1.0],
    blues: [6.0, 2.0, 1.0, 0.5, 3.0, 1.5],
    dorian: [8.0, 0.5, 1.0, 0.5, 4.0, 1.0, 0.5],
    mixolydian: [8.0, 0.5, 1.0, 0.5, 4.0, 0.5, 1.5]
  },
  // Harmony weights - emphasis on thirds and chord tones
  harmony: {
    major: [3.0, 1.0, 4.0, 2.0, 2.5, 2.0, 1.5], // Third emphasized
    minor: [3.0, 1.0, 4.0, 2.0, 2.5, 1.5, 2.0],
    pentatonic: [3.0, 2.5, 4.0, 2.5, 2.0],
    blues: [2.5, 3.0, 2.5, 2.0, 2.0, 2.5],
    dorian: [3.0, 1.0, 4.0, 2.0, 2.5, 2.5, 2.0],
    mixolydian: [3.0, 1.0, 4.0, 2.0, 2.5, 2.0, 3.0]
  }
};

// Melodic direction for contour control
enum Direction { UP, DOWN, REPEAT }

// Interval quality weights (how "musical" each interval sounds)
const intervalQuality: { [key: number]: number } = {
  0: 1.0,   // Unison/Repeat - common
  1: 0.4,   // Minor second (semitone) - rare, creates tension
  2: 2.0,   // Major second (whole step) - very common, smooth
  3: 1.5,   // Minor third - common
  4: 1.5,   // Major third - common
  5: 1.0,   // Perfect fourth - moderate
  6: 0.3,   // Tritone - rare, dissonant
  7: 1.2,   // Perfect fifth - moderate, consonant
  8: 0.5,   // Minor sixth - occasional
  9: 0.5,   // Major sixth - occasional
  10: 0.4,  // Minor seventh - rare
  11: 0.4,  // Major seventh - rare
  12: 0.6,  // Octave - occasional accent
};

// Rhythm patterns for humanized melody generation
const rhythmPatterns = {
  simple: [1, 1, 1, 1],                           // All quarter notes (robotic baseline)
  syncopated: [0.5, 0.5, 1, 0.5, 1.5],           // Eighth-quarter-eighth-dotted quarter
  triplet: [0.33, 0.33, 0.34, 1],                 // Triplet eighth + quarter note
  swing: [0.67, 0.33, 0.67, 0.33],               // Swing feel (long-short pattern)
  dotted: [0.75, 0.25, 1, 0.5, 0.5],             // Dotted eighth + sixteenth + quarter + two eighths
  mixed: [1, 0.5, 0.5, 0.75, 0.25, 1],           // Varied rhythms
  steady_bass: [1, 1, 1, 1],                      // Bass: steady quarter notes
  bass_walking: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],  // Bass: eighth note walk
  harmony_sustain: [2, 2, 2, 2],                  // Harmony: long sustained notes (half notes)

  // Genre-specific patterns
  jazz_swing: [0.67, 0.33, 0.67, 0.33, 1, 0.5, 0.5],
  hiphop: [0.5, 0.25, 0.25, 1, 0.5, 0.5],
  edm: [0.25, 0.25, 0.25, 0.25, 0.5, 0.5, 1],
  pop: [1, 0.5, 0.5, 1, 0.5, 1.5],
  classical: [1, 0.5, 0.5, 1, 1, 2],
  trap: [0.25, 0.25, 0.5, 0.5, 0.25, 0.75, 0.5],
  latin: [0.5, 0.5, 0.5, 0.5, 1, 1],
  ballad: [2, 1, 1, 2, 2]
};

// Genre definitions with musical characteristics
interface GenreStyle {
  name: string;
  rhythmPatterns: number[][];
  preferredScales: string[];
  intervalBias: number; // 0-1: 0=stepwise, 1=leaps allowed
  velocityRange: [number, number];
  motifRepetition: number; // 0-1: how often to repeat motifs exactly
  restProbability: number; // 0-1: how often to add rests
  tempoRange: [number, number];
  description: string;
}

const genreStyles: { [key: string]: GenreStyle } = {
  pop: {
    name: "Pop",
    rhythmPatterns: [rhythmPatterns.pop, rhythmPatterns.syncopated, rhythmPatterns.dotted],
    preferredScales: ["major", "minor", "pentatonic"],
    intervalBias: 0.3,
    velocityRange: [75, 95],
    motifRepetition: 0.7,
    restProbability: 0.2,
    tempoRange: [100, 140],
    description: "Catchy, repetitive melodies with strong hooks"
  },
  jazz: {
    name: "Jazz",
    rhythmPatterns: [rhythmPatterns.jazz_swing, rhythmPatterns.swing, rhythmPatterns.triplet],
    preferredScales: ["dorian", "mixolydian", "blues"],
    intervalBias: 0.6,
    velocityRange: [60, 100],
    motifRepetition: 0.4,
    restProbability: 0.3,
    tempoRange: [80, 200],
    description: "Swung rhythms, complex intervals, improvised feel"
  },
  hiphop: {
    name: "Hip Hop",
    rhythmPatterns: [rhythmPatterns.hiphop, rhythmPatterns.syncopated],
    preferredScales: ["minor", "blues", "pentatonic"],
    intervalBias: 0.25,
    velocityRange: [70, 90],
    motifRepetition: 0.8,
    restProbability: 0.4,
    tempoRange: [70, 100],
    description: "Repetitive loops, simple melodies, heavy rests"
  },
  edm: {
    name: "EDM",
    rhythmPatterns: [rhythmPatterns.edm, rhythmPatterns.mixed],
    preferredScales: ["minor", "major", "pentatonic"],
    intervalBias: 0.5,
    velocityRange: [85, 100],
    motifRepetition: 0.75,
    restProbability: 0.15,
    tempoRange: [120, 150],
    description: "Build-ups, drops, energetic and driving"
  },
  classical: {
    name: "Classical",
    rhythmPatterns: [rhythmPatterns.classical, rhythmPatterns.dotted, rhythmPatterns.triplet],
    preferredScales: ["major", "minor"],
    intervalBias: 0.4,
    velocityRange: [50, 100],
    motifRepetition: 0.5,
    restProbability: 0.25,
    tempoRange: [60, 140],
    description: "Elegant phrases, dynamic range, formal structure"
  },
  trap: {
    name: "Trap",
    rhythmPatterns: [rhythmPatterns.trap, rhythmPatterns.hiphop],
    preferredScales: ["minor", "blues"],
    intervalBias: 0.35,
    velocityRange: [75, 95],
    motifRepetition: 0.85,
    restProbability: 0.35,
    tempoRange: [130, 170],
    description: "Hi-hat rolls, sparse melodies, dark atmosphere"
  },
  latin: {
    name: "Latin",
    rhythmPatterns: [rhythmPatterns.latin, rhythmPatterns.syncopated],
    preferredScales: ["major", "dorian", "mixolydian"],
    intervalBias: 0.35,
    velocityRange: [75, 100],
    motifRepetition: 0.6,
    restProbability: 0.2,
    tempoRange: [100, 140],
    description: "Syncopated rhythms, festive, danceable"
  },
  ballad: {
    name: "Ballad",
    rhythmPatterns: [rhythmPatterns.ballad, rhythmPatterns.simple],
    preferredScales: ["major", "minor"],
    intervalBias: 0.3,
    velocityRange: [50, 80],
    motifRepetition: 0.65,
    restProbability: 0.3,
    tempoRange: [60, 90],
    description: "Slow, emotional, sustained notes, expressive"
  },
  automatic: {
    name: "Automatic (Mix)",
    rhythmPatterns: [rhythmPatterns.syncopated, rhythmPatterns.dotted, rhythmPatterns.mixed],
    preferredScales: ["major", "minor", "pentatonic"],
    intervalBias: 0.4,
    velocityRange: [70, 95],
    motifRepetition: 0.6,
    restProbability: 0.25,
    tempoRange: [80, 140],
    description: "Adaptive mix of styles"
  }
};

// Chord progression helpers for harmony generation
const chordProgressions = {
  major: [
    [0, 4, 2, 4], // I-V-iii-V
    [0, 5, 3, 4], // I-vi-IV-V  
    [0, 3, 5, 4], // I-IV-vi-V
    [0, 2, 5, 4]  // I-iii-vi-V
  ],
  minor: [
    [0, 6, 3, 6], // i-VII-iv-VII
    [0, 5, 3, 6], // i-vi-iv-VII
    [0, 2, 5, 6], // i-iii-vi-VII
    [0, 3, 5, 4]  // i-iv-vi-v
  ]
};

const getChordTones = (chordDegree: number, scale: number[], key: string): string[] => {
  const keyIndex = keys.indexOf(key);
  const chordTones = [];
  
  // Build triad: root, third, fifth
  for (let interval of [0, 2, 4]) {
    const scaleIndex = (chordDegree + interval) % scale.length;
    const noteIndex = (keyIndex + scale[scaleIndex]) % 12;
    chordTones.push(keys[noteIndex]);
  }
  
  return chordTones;
};

const getComplementaryInterval = (melodyNote: string, chordTones: string[], octaveRange: [number, number], key: string, scale: string): string => {
  const noteToPc = (n: string) => ({C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11})[n] ?? 0;
  const name = melodyNote.slice(0, -1);
  const melOct = parseInt(melodyNote.slice(-1), 10);
  const melPc = noteToPc(name);
  const melMidi = melPc + 12 * (melOct + 1); // match existing mapping

  let best: {tone: string, octave: number} | null = null;
  let bestScore = Infinity;
  let bestNote: string | null = null;

  // Search all chord tone + octave combinations
  for (const tone of chordTones) {
    const pc = noteToPc(tone);
    for (let o = octaveRange[0]; o <= octaveRange[1]; o++) {
      const midi = pc + 12 * (o + 1);
      const d = Math.abs(midi - melMidi); // semitone distance

      // primary objective: realize a 3rd (3 or 4 semitones)
      const thirdGap = Math.min(Math.abs(d - 3), Math.abs(d - 4));
      const isThird = d === 3 || d === 4;
      const isSixth = d === 8 || d === 9; // inversion

      // scoring: strong preference for true thirds, mild penalty for sixths, larger otherwise
      const penalty = isThird ? 0 : isSixth ? 10 : 20;
      const sizeBias = d; // tiny tie-breaker: smaller absolute interval
      const score = penalty + thirdGap + 0.001 * sizeBias;

      if (score < bestScore) {
        bestScore = score;
        best = { tone, octave: o };
        bestNote = tone + String(o);
      }
    }
  }

  if (best && (bestScore < 10 || bestScore < 10.5)) { // realized 3rd or very-close
    return bestNote!;
  }

  // Fallback 1: diatonic third from melody within range
  const scaleSemis = scales[scale as keyof typeof scales];
  if (scaleSemis) {
    const keyPc = noteToPc(key);
    const melScaleIdx = scaleSemis.findIndex(s => (keyPc + s) % 12 === melPc);
    if (melScaleIdx !== -1) {
      for (const step of [2, -2]) { // up third, then down third
        const idx = (melScaleIdx + step + scaleSemis.length) % scaleSemis.length;
        const targetPc = (keyPc + scaleSemis[idx]) % 12;
        // search octaves for closest 3/4
        let localBest: {pc: number, o: number} | null = null;
        let localScore = Infinity; 
        let localNote: string | null = null;
        for (let o = octaveRange[0]; o <= octaveRange[1]; o++) {
          const midi = targetPc + 12 * (o + 1);
          const d = Math.abs(midi - melMidi);
          const thirdGap = Math.min(Math.abs(d - 3), Math.abs(d - 4));
          const score = thirdGap + 0.001 * d;
          if (score < localScore) { 
            localScore = score; 
            localBest = { pc: targetPc, o }; 
            localNote = keys[targetPc] + String(o); 
          }
        }
        if (localBest && localScore <= 0.5) return localNote!; // close to perfect third
      }
    }
  }

  // Fallback 2: best chord tone even if it's a sixth or closest
  return bestNote ?? chordTones[0] + String(octaveRange[0]);
};

const synthPresets = {
  // Melody synths - Enhanced
  electric_piano: {
    name: "Electric Piano",
    config: () => {
      const synth = new window.Tone.FMSynth({
        harmonicity: 3.5,
        modulationIndex: 12,
        oscillator: { type: "sine" },
        envelope: {
          attack: 0.008,
          decay: 1.0,
          sustain: 0.4,
          release: 1.5
        },
        modulation: { type: "sine" },
        modulationEnvelope: {
          attack: 0.002,
          decay: 0.4,
          sustain: 0.3,
          release: 0.9
        }
      }).toDestination();
      synth.volume.value = -8;
      return synth;
    }
  },
  pluck: {
    name: "Pluck",
    config: () => {
      const synth = new window.Tone.PluckSynth({
        attackNoise: 1.5,
        dampening: 3000,
        resonance: 0.92
      }).toDestination();
      synth.volume.value = -6;
      return synth;
    }
  },
  marimba: {
    name: "Marimba",
    config: () => {
      const synth = new window.Tone.FMSynth({
        harmonicity: 8,
        modulationIndex: 4,
        oscillator: { type: "sine" },
        envelope: {
          attack: 0.001,
          decay: 2.0,
          sustain: 0.1,
          release: 2.5
        },
        modulation: { type: "sine" },
        modulationEnvelope: {
          attack: 0.001,
          decay: 1.5,
          sustain: 0,
          release: 2.0
        }
      }).toDestination();
      synth.volume.value = -10;
      return synth;
    }
  },
  bell: {
    name: "Bell",
    config: () => {
      const synth = new window.Tone.MetalSynth({
        harmonicity: 12,
        resonance: 800,
        modulationIndex: 20,
        envelope: {
          attack: 0.001,
          decay: 1.4,
          release: 3.0
        },
        volume: -15
      }).toDestination();
      return synth;
    }
  },
  lead_synth: {
    name: "Lead Synth",
    config: () => {
      const synth = new window.Tone.MonoSynth({
        oscillator: {
          type: "sawtooth"
        },
        filter: {
          Q: 6,
          type: "lowpass",
          rolloff: -24,
          frequency: 3000
        },
        envelope: {
          attack: 0.01,
          decay: 0.3,
          sustain: 0.6,
          release: 0.8
        },
        filterEnvelope: {
          attack: 0.02,
          decay: 0.4,
          sustain: 0.5,
          release: 1.0,
          baseFrequency: 800,
          octaves: 3.5
        }
      }).toDestination();
      synth.volume.value = -9;
      return synth;
    }
  },
  square_lead: {
    name: "Square Lead",
    config: () => {
      const synth = new window.Tone.MonoSynth({
        oscillator: {
          type: "square"
        },
        filter: {
          Q: 4,
          type: "lowpass",
          rolloff: -12,
          frequency: 2500
        },
        envelope: {
          attack: 0.005,
          decay: 0.2,
          sustain: 0.7,
          release: 0.6
        },
        filterEnvelope: {
          attack: 0.01,
          decay: 0.3,
          sustain: 0.6,
          release: 0.8,
          baseFrequency: 600,
          octaves: 3
        }
      }).toDestination();
      synth.volume.value = -10;
      return synth;
    }
  },
  ambient_keys: {
    name: "Ambient Keys",
    config: () => {
      const synth = new window.Tone.FMSynth({
        harmonicity: 2.5,
        modulationIndex: 6,
        oscillator: { type: "sine" },
        envelope: {
          attack: 0.5,
          decay: 1.0,
          sustain: 0.6,
          release: 2.5
        },
        modulation: { type: "triangle" },
        modulationEnvelope: {
          attack: 0.3,
          decay: 0.8,
          sustain: 0.5,
          release: 2.0
        }
      }).toDestination();
      synth.volume.value = -12;
      return synth;
    }
  },
  bright_keys: {
    name: "Bright Keys",
    config: () => {
      const synth = new window.Tone.FMSynth({
        harmonicity: 4,
        modulationIndex: 15,
        oscillator: { type: "sine" },
        envelope: {
          attack: 0.005,
          decay: 0.8,
          sustain: 0.4,
          release: 1.2
        },
        modulation: { type: "sine" },
        modulationEnvelope: {
          attack: 0.002,
          decay: 0.5,
          sustain: 0.3,
          release: 0.8
        }
      }).toDestination();
      synth.volume.value = -7;
      return synth;
    }
  },
  // Bass synths - Enhanced
  bass_synth: {
    name: "Analog Bass",
    config: () => {
      const synth = new window.Tone.MonoSynth({
        oscillator: {
          type: "sawtooth"
        },
        filter: {
          Q: 4,
          type: "lowpass",
          rolloff: -24,
          frequency: 800
        },
        envelope: {
          attack: 0.01,
          decay: 0.3,
          sustain: 0.4,
          release: 0.8
        },
        filterEnvelope: {
          attack: 0.01,
          decay: 0.2,
          sustain: 0.3,
          release: 0.5,
          baseFrequency: 200,
          octaves: 4,
          exponent: 2
        }
      }).toDestination();
      synth.volume.value = -8;
      return synth;
    }
  },
  sub_bass: {
    name: "Sub Bass",
    config: () => {
      const synth = new window.Tone.MonoSynth({
        oscillator: {
          type: "sine"
        },
        filter: {
          Q: 2,
          type: "lowpass",
          rolloff: -12,
          frequency: 150
        },
        envelope: {
          attack: 0.02,
          decay: 0.4,
          sustain: 0.9,
          release: 1.2
        },
        filterEnvelope: {
          attack: 0.05,
          decay: 0.3,
          sustain: 0.2,
          release: 1.0,
          baseFrequency: 80,
          octaves: 2
        }
      }).toDestination();
      synth.volume.value = -6;
      return synth;
    }
  },
  reese_bass: {
    name: "Reese Bass",
    config: () => {
      const synth = new window.Tone.MonoSynth({
        oscillator: {
          type: "square",
          modulationType: "sawtooth",
          harmonicity: 1.005
        },
        filter: {
          Q: 3,
          type: "lowpass",
          rolloff: -24,
          frequency: 600
        },
        envelope: {
          attack: 0.01,
          decay: 0.25,
          sustain: 0.6,
          release: 0.9
        },
        filterEnvelope: {
          attack: 0.02,
          decay: 0.3,
          sustain: 0.4,
          release: 0.7,
          baseFrequency: 150,
          octaves: 3.5
        }
      }).toDestination();
      synth.volume.value = -10;
      return synth;
    }
  },
  fat_bass: {
    name: "Fat Bass",
    config: () => {
      const synth = new window.Tone.MonoSynth({
        oscillator: {
          type: "fatsawtooth"
        },
        filter: {
          Q: 5,
          type: "lowpass",
          rolloff: -24,
          frequency: 1000
        },
        envelope: {
          attack: 0.005,
          decay: 0.2,
          sustain: 0.5,
          release: 0.6
        },
        filterEnvelope: {
          attack: 0.01,
          decay: 0.15,
          sustain: 0.3,
          release: 0.4,
          baseFrequency: 300,
          octaves: 4.5
        }
      }).toDestination();
      synth.volume.value = -7;
      return synth;
    }
  },
  acid_bass: {
    name: "Acid Bass",
    config: () => {
      const synth = new window.Tone.MonoSynth({
        oscillator: {
          type: "square"
        },
        filter: {
          Q: 8,
          type: "lowpass",
          rolloff: -24,
          frequency: 400
        },
        envelope: {
          attack: 0.005,
          decay: 0.1,
          sustain: 0.3,
          release: 0.4
        },
        filterEnvelope: {
          attack: 0.005,
          decay: 0.15,
          sustain: 0.2,
          release: 0.3,
          baseFrequency: 100,
          octaves: 5,
          exponent: 3
        }
      }).toDestination();
      synth.volume.value = -9;
      return synth;
    }
  },
  // Harmony/Pad synths
  pad_synth: {
    name: "Warm Pad",
    config: () => new window.Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.8, decay: 0.5, sustain: 0.7, release: 2.0 }
    }).toDestination()
  },
  string_pad: {
    name: "String Pad",
    config: () => new window.Tone.FMSynth({
      harmonicity: 2,
      modulationIndex: 8,
      oscillator: { type: "sine" },
      envelope: { attack: 1.2, decay: 0.8, sustain: 0.6, release: 3.0 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.5, decay: 0.3, sustain: 0.4, release: 1.0 }
    }).toDestination()
  }
};

// Helper functions to filter presets by track type
const getPresetsForTrack = (trackType: 'bass' | 'melody' | 'harmony') => {
  switch (trackType) {
    case 'bass':
      return Object.fromEntries(
        Object.entries(synthPresets).filter(([key]) =>
          ['bass_synth', 'sub_bass', 'reese_bass', 'fat_bass', 'acid_bass'].includes(key)
        )
      );
    case 'harmony':
      return Object.fromEntries(
        Object.entries(synthPresets).filter(([key]) => 
          ['pad_synth', 'string_pad'].includes(key)
        )
      );
    case 'melody':
    default:
      return Object.fromEntries(
        Object.entries(synthPresets).filter(([key]) =>
          ['electric_piano', 'pluck', 'marimba', 'bell', 'lead_synth', 'square_lead', 'ambient_keys', 'bright_keys'].includes(key)
        )
      );
  }
};

const weightedRandomSelect = (items: any[], weights?: number[]): any => {
  const w = (Array.isArray(weights) && weights.length === items.length)
    ? weights
    : Array(items.length).fill(1);
  const totalWeight = w.reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= w[i];
    if (random <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
};

const calculateInterval = (note1: string, note2: string): number => {
  const getNotePitch = (note: string) => {
    const noteName = note.slice(0, -1);
    const octave = parseInt(note.slice(-1));
    const noteIndex = keys.indexOf(noteName);
    return noteIndex + (octave * 12);
  };

  const pitch1 = getNotePitch(note1);
  const pitch2 = getNotePitch(note2);
  return Math.abs(pitch2 - pitch1);
};

const applyStepwiseBias = (baseWeights: number[], previousNote: string, currentScale: number[], keyIndex: number, octave: number): number[] => {
  return baseWeights.map((weight, index) => {
    const semitone = currentScale[index];
    const noteIndex = (keyIndex + semitone) % 12;
    const currentNote = keys[noteIndex] + octave;
    const interval = calculateInterval(previousNote, currentNote);
    let biasFactor = 1.0;
    if (interval <= 2) {
      biasFactor = 3.0;
    } else if (interval <= 4) {
      biasFactor = 2.0;
    } else if (interval <= 7) {
      biasFactor = 1.2;
    } else {
      biasFactor = 0.3;
    }
    return weight * biasFactor;
  });
};

export default function MelodyGeneratorComponent() {
  const [state, setState] = useState<MultiTrackState>({
    tempo: 120,
    masterVolume: 80,
    scale: "major",
    key: "C",
    genre: "automatic",
    timeSignature: "4/4",
    isPlaying: false,
    isLooping: true,
    metronomeEnabled: false,
    loopLength: 4, // 4 bars
    tracks: {
      bass: {
        generatedSequence: [],
        generatedSequenceWithTiming: [],
        isEnabled: true,
        volume: 0.8,
        synthType: "bass_synth",
        currentNoteIndex: -1,
        currentStepIndex: -1,
        hasGenerated: false,
        octaveRange: [2, 3],
        customLoopEndStep: null,
        reverbAmount: 0.2,
        delayTime: 0.375,
        delayFeedback: 0.3,
        delayMix: 0,
        timeMultiplier: 1.0
      },
      melody: {
        generatedSequence: [],
        generatedSequenceWithTiming: [],
        isEnabled: true,
        volume: 0.7,
        synthType: "electric_piano",
        currentNoteIndex: -1,
        currentStepIndex: -1,
        hasGenerated: false,
        octaveRange: [4, 5],
        customLoopEndStep: null,
        reverbAmount: 0.3,
        delayTime: 0.375,
        delayFeedback: 0.4,
        delayMix: 0,
        timeMultiplier: 1.0
      },
      harmony: {
        generatedSequence: [],
        generatedSequenceWithTiming: [],
        isEnabled: true,
        volume: 0.5,
        synthType: "pad_synth",
        currentNoteIndex: -1,
        currentStepIndex: -1,
        hasGenerated: false,
        octaveRange: [4, 6],
        customLoopEndStep: null,
        reverbAmount: 0.4,
        delayTime: 0.5,
        delayFeedback: 0.3,
        delayMix: 0,
        timeMultiplier: 1.0
      }
    },
    // Legacy compatibility fields (mirrored from melody track)
    noteCount: 8,
    soundType: "electric_piano",
    generatedMelody: [],
    currentNoteIndex: -1,
    hasGeneratedMelody: false
  });

  const [status, setStatus] = useState("Loading audio engine...");
  const [toneLoaded, setToneLoaded] = useState(false); // Still needed for Transport timing
  const [soundfontsLoaded, setSoundfontsLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingSoundfonts, setIsLoadingSoundfonts] = useState(false);

  // Preset management state
  const [savedPresets, setSavedPresets] = useState<Array<{name: string, timestamp: number}>>([]);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [currentPresetName, setCurrentPresetName] = useState<string | null>(null);

  // Soundfont player instances (primary audio engine)
  const bassSoundfontRef = useRef<SoundfontPlayer | null>(null);
  const melodySoundfontRef = useRef<SoundfontPlayer | null>(null);
  const harmonySoundfontRef = useRef<SoundfontPlayer | null>(null);

  // Audio context for soundfonts
  const audioContextRef = useRef<AudioContext | null>(null);

  // Three separate sequence instances for synchronized playback
  const bassSequenceRef = useRef<any>(null);
  const melodySequenceRef = useRef<any>(null);
  const harmonySequenceRef = useRef<any>(null);

  const metronomeRef = useRef<any>(null);
  const metronomeSequenceRef = useRef<any>(null);

  // Step sequencer for continuous LED indicator
  const stepSequencerRef = useRef<any>(null);

  // Removed: initializeSynths - now using soundfonts exclusively

  const initializeSoundfonts = async () => {
    try {
      setIsLoadingSoundfonts(true);
      setSoundfontsLoaded(false);

      // Use Tone.js AudioContext so master volume works
      // This ensures soundfonts route through Tone.Destination
      const context = window.Tone.context.rawContext as AudioContext;
      audioContextRef.current = context;

      console.log('Initializing soundfonts with Tone context:', context);
      console.log('Context destination:', context.destination);
      console.log('Tone.Destination:', window.Tone.Destination);
      console.log('Tone.Destination type:', typeof window.Tone.Destination);

      // Dispose existing soundfont players
      if (bassSoundfontRef.current) bassSoundfontRef.current.dispose();
      if (melodySoundfontRef.current) melodySoundfontRef.current.dispose();
      if (harmonySoundfontRef.current) harmonySoundfontRef.current.dispose();

      setStatus("Loading soundfont instruments...");

      // Create soundfont players for each track with enhanced audio features
      // Route through Tone.Destination for master volume control
      let toneDestination: AudioNode;

      try {
        // Try to get Tone.Destination as AudioNode
        toneDestination = window.Tone.Destination as unknown as AudioNode;
        console.log('✓ Got Tone.Destination:', toneDestination);
      } catch (err) {
        console.error('✗ Failed to get Tone.Destination, using context.destination:', err);
        toneDestination = context.destination;
      }

      const bassInstrument = getSoundfontName(state.tracks.bass.synthType);
      console.log(`[Init] Bass synth type: ${state.tracks.bass.synthType}, mapped to: ${bassInstrument}`);
      console.log(`[Init] Creating bass SoundfontPlayer...`);

      bassSoundfontRef.current = new SoundfontPlayer(context, {
        instrument: bassInstrument,
        volume: state.tracks.bass.volume,
        enableReverb: true,
        reverbAmount: state.tracks.bass.reverbAmount,
        enableDelay: state.tracks.bass.delayMix > 0,
        delayTime: state.tracks.bass.delayTime,
        delayFeedback: state.tracks.bass.delayFeedback,
        delayMix: state.tracks.bass.delayMix,
        enableCompression: true,
        maxPolyphony: 8 // Bass typically plays single notes
        // Note: Not using outputNode - connecting to context.destination directly
      });
      console.log(`[Init] Bass SoundfontPlayer created successfully`);

      const melodyInstrument = getSoundfontName(state.tracks.melody.synthType);
      console.log(`Melody synth type: ${state.tracks.melody.synthType}, mapped to: ${melodyInstrument}`);

      melodySoundfontRef.current = new SoundfontPlayer(context, {
        instrument: melodyInstrument,
        volume: state.tracks.melody.volume,
        enableReverb: true,
        reverbAmount: state.tracks.melody.reverbAmount,
        enableDelay: state.tracks.melody.delayMix > 0,
        delayTime: state.tracks.melody.delayTime,
        delayFeedback: state.tracks.melody.delayFeedback,
        delayMix: state.tracks.melody.delayMix,
        enableCompression: true,
        maxPolyphony: 16 // Melody can have overlapping notes
      });

      const harmonyInstrument = getSoundfontName(state.tracks.harmony.synthType);
      console.log(`Harmony synth type: ${state.tracks.harmony.synthType}, mapped to: ${harmonyInstrument}`);

      harmonySoundfontRef.current = new SoundfontPlayer(context, {
        instrument: harmonyInstrument,
        volume: state.tracks.harmony.volume,
        enableReverb: true,
        reverbAmount: state.tracks.harmony.reverbAmount,
        enableDelay: state.tracks.harmony.delayMix > 0,
        delayTime: state.tracks.harmony.delayTime,
        delayFeedback: state.tracks.harmony.delayFeedback,
        delayMix: state.tracks.harmony.delayMix,
        enableCompression: true,
        maxPolyphony: 24 // Harmony can have chords
      });

      // Ensure all instruments are loaded
      console.log('[Init] Starting to load all instruments...');
      await Promise.all([
        bassSoundfontRef.current.ensureLoaded(),
        melodySoundfontRef.current.ensureLoaded(),
        harmonySoundfontRef.current.ensureLoaded()
      ]);
      console.log('[Init] All instruments loaded successfully!');

      setSoundfontsLoaded(true);
      setIsLoadingSoundfonts(false);
      setStatus("Soundfonts loaded successfully!");
    } catch (error) {
      console.error("Error loading soundfonts:", error);
      setStatus("Error loading soundfonts: " + (error as Error).message);
      setIsLoadingSoundfonts(false);
      setSoundfontsLoaded(false);
    }
  };

  const noteToMidi = (noteName: string): number => {
    const noteMap: { [key: string]: number } = {
      'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
      'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
    };
    const note = noteName.slice(0, -1);
    const octave = parseInt(noteName.slice(-1));
    return noteMap[note] + (octave + 1) * 12;
  };

  const exportMIDI = () => {
    // Check if any tracks have been generated
    const hasAnyTracks = state.tracks.bass.hasGenerated || 
                        state.tracks.melody.hasGenerated || 
                        state.tracks.harmony.hasGenerated;
    
    if (!hasAnyTracks) {
      setStatus("Please generate at least one track first!");
      return;
    }

    try {
      const tracks: MidiWriter.Track[] = [];
      
      // Create Bass track (if generated and enabled)
      if (state.tracks.bass.hasGenerated && state.tracks.bass.isEnabled && state.tracks.bass.generatedSequence.length > 0) {
        const bassTrack = new MidiWriter.Track();
        bassTrack.setTempo(state.tempo);
        const [numerator, denominator] = state.timeSignature.split('/').map(Number);
        bassTrack.setTimeSignature(numerator, denominator, 24, 8);
        
        // Set MIDI channel 1 for bass
        bassTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 33, channel: 1 })); // Electric bass
        
        state.tracks.bass.generatedSequence.forEach((noteName) => {
          if (noteName !== 'rest') {
            const midiNote = noteToMidi(noteName);
            const noteEvent = new MidiWriter.NoteEvent({
              pitch: midiNote,
              duration: '8',
              velocity: 80, // Stronger velocity for bass
              channel: 1
            });
            bassTrack.addEvent(noteEvent);
          } else {
            // Add proper rest
            bassTrack.addEvent(new MidiWriter.NoteEvent({
              duration: '8',
              rest: true,
              channel: 1
            }));
          }
        });
        tracks.push(bassTrack);
      }

      // Create Melody track (if generated and enabled)
      if (state.tracks.melody.hasGenerated && state.tracks.melody.isEnabled && state.tracks.melody.generatedSequence.length > 0) {
        const melodyTrack = new MidiWriter.Track();
        melodyTrack.setTempo(state.tempo);
        const [numerator, denominator] = state.timeSignature.split('/').map(Number);
        melodyTrack.setTimeSignature(numerator, denominator, 24, 8);
        
        // Set MIDI channel 2 for melody  
        melodyTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 1, channel: 2 })); // Acoustic Grand Piano
        
        state.tracks.melody.generatedSequence.forEach((noteName) => {
          if (noteName !== 'rest') {
            const midiNote = noteToMidi(noteName);
            const noteEvent = new MidiWriter.NoteEvent({
              pitch: midiNote,
              duration: '8',
              velocity: 70, // Medium velocity for melody
              channel: 2
            });
            melodyTrack.addEvent(noteEvent);
          } else {
            // Add proper rest
            melodyTrack.addEvent(new MidiWriter.NoteEvent({
              duration: '8',
              rest: true,
              channel: 2
            }));
          }
        });
        tracks.push(melodyTrack);
      }

      // Create Harmony track (if generated and enabled)
      if (state.tracks.harmony.hasGenerated && state.tracks.harmony.isEnabled && state.tracks.harmony.generatedSequence.length > 0) {
        const harmonyTrack = new MidiWriter.Track();
        harmonyTrack.setTempo(state.tempo);
        const [numerator, denominator] = state.timeSignature.split('/').map(Number);
        harmonyTrack.setTimeSignature(numerator, denominator, 24, 8);
        
        // Set MIDI channel 3 for harmony
        harmonyTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 89, channel: 3 })); // Pad 2 (warm)
        
        state.tracks.harmony.generatedSequence.forEach((noteName) => {
          if (noteName !== 'rest') {
            const midiNote = noteToMidi(noteName);
            const noteEvent = new MidiWriter.NoteEvent({
              pitch: midiNote,
              duration: '8',
              velocity: 50, // Softer velocity for harmony
              channel: 3
            });
            harmonyTrack.addEvent(noteEvent);
          } else {
            // Add proper rest
            harmonyTrack.addEvent(new MidiWriter.NoteEvent({
              duration: '8',
              rest: true,
              channel: 3
            }));
          }
        });
        tracks.push(harmonyTrack);
      }

      if (tracks.length === 0) {
        setStatus("No tracks available for export!");
        return;
      }

      const write = new MidiWriter.Writer(tracks);
      const midiData = write.dataUri();
      const link = document.createElement('a');
      link.href = midiData;
      
      // Create descriptive filename based on actually exported tracks
      const trackNames = [];
      if (state.tracks.bass.hasGenerated && state.tracks.bass.isEnabled && state.tracks.bass.generatedSequence.length > 0) trackNames.push('bass');
      if (state.tracks.melody.hasGenerated && state.tracks.melody.isEnabled && state.tracks.melody.generatedSequence.length > 0) trackNames.push('melody');
      if (state.tracks.harmony.hasGenerated && state.tracks.harmony.isEnabled && state.tracks.harmony.generatedSequence.length > 0) trackNames.push('harmony');
      
      link.download = `composition_${trackNames.join('-')}_${state.key}_${state.scale}_${state.tempo}bpm.mid`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      const trackCount = tracks.length;
      setStatus(`MIDI file with ${trackCount} track${trackCount > 1 ? 's' : ''} downloaded successfully!`);
    } catch (error) {
      console.error('MIDI export error:', error);
      setStatus("Error exporting MIDI file. Please try again.");
    }
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/tone@latest/build/Tone.js';
    script.onload = () => {
      setToneLoaded(true);
      setStatus("Ready to generate melody");
      metronomeRef.current = new window.Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
      }).toDestination();
    };
    script.onerror = () => {
      setStatus("Failed to load audio engine. Check your connection and refresh the page.");
      setToneLoaded(false);
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Initialize soundfonts automatically when Tone.js loads (for Transport timing)
  useEffect(() => {
    if (toneLoaded) {
      console.log('Tone loaded, initializing soundfonts...');
      initializeSoundfonts().catch(err => {
        console.error('Failed to initialize soundfonts:', err);
        setStatus('Error loading soundfonts: ' + err.message);
      });
    }
  }, [toneLoaded, state.tracks.melody.synthType, state.tracks.bass.synthType, state.tracks.harmony.synthType]);

  // Update soundfont volumes dynamically when state changes
  // Apply master volume as a multiplier to each track's volume
  useEffect(() => {
    if (soundfontsLoaded) {
      const masterGain = state.masterVolume / 100;

      if (bassSoundfontRef.current) {
        bassSoundfontRef.current.volume = state.tracks.bass.volume * masterGain;
      }
      if (melodySoundfontRef.current) {
        melodySoundfontRef.current.volume = state.tracks.melody.volume * masterGain;
      }
      if (harmonySoundfontRef.current) {
        harmonySoundfontRef.current.volume = state.tracks.harmony.volume * masterGain;
      }
    }
  }, [state.tracks.bass.volume, state.tracks.melody.volume, state.tracks.harmony.volume, state.masterVolume, soundfontsLoaded]);

  // Preset management functions
  const loadPresetList = () => {
    try {
      const presetList = localStorage.getItem('melodyGeneratorPresets');
      if (presetList) {
        setSavedPresets(JSON.parse(presetList));
      }
    } catch (error) {
      console.error('Error loading preset list:', error);
    }
  };

  const savePreset = (name: string) => {
    try {
      if (!name.trim()) {
        setStatus('Please enter a preset name');
        return;
      }

      // Save the current state
      const presetData = {
        state: {
          tempo: state.tempo,
          masterVolume: state.masterVolume,
          scale: state.scale,
          key: state.key,
          genre: state.genre,
          timeSignature: state.timeSignature,
          isLooping: state.isLooping,
          loopLength: state.loopLength,
          tracks: state.tracks
        },
        timestamp: Date.now()
      };

      localStorage.setItem(`preset_${name}`, JSON.stringify(presetData));

      // Update preset list
      const presetList = [...savedPresets];
      const existingIndex = presetList.findIndex(p => p.name === name);
      if (existingIndex >= 0) {
        presetList[existingIndex] = { name, timestamp: Date.now() };
      } else {
        presetList.push({ name, timestamp: Date.now() });
      }

      localStorage.setItem('melodyGeneratorPresets', JSON.stringify(presetList));
      setSavedPresets(presetList);

      setStatus(`Preset "${name}" saved successfully!`);
      setShowPresetDialog(false);
      setPresetName('');
      setCurrentPresetName(name); // Set as current preset
    } catch (error) {
      console.error('Error saving preset:', error);
      setStatus('Error saving preset');
    }
  };

  const loadPreset = (name: string) => {
    try {
      const presetData = localStorage.getItem(`preset_${name}`);
      if (!presetData) {
        setStatus('Preset not found');
        return;
      }

      const parsed = JSON.parse(presetData);
      setState(prev => ({
        ...prev,
        ...parsed.state,
        isPlaying: false, // Don't auto-play when loading
        currentNoteIndex: -1
      }));

      setStatus(`Preset "${name}" loaded successfully!`);
      setShowLoadDialog(false);
      setCurrentPresetName(name); // Set as current preset
    } catch (error) {
      console.error('Error loading preset:', error);
      setStatus('Error loading preset');
    }
  };

  const deletePreset = (name: string) => {
    try {
      localStorage.removeItem(`preset_${name}`);

      const presetList = savedPresets.filter(p => p.name !== name);
      localStorage.setItem('melodyGeneratorPresets', JSON.stringify(presetList));
      setSavedPresets(presetList);

      setStatus(`Preset "${name}" deleted`);
    } catch (error) {
      console.error('Error deleting preset:', error);
      setStatus('Error deleting preset');
    }
  };

  const generateMelody = () => {
    setStatus("Generating melody...");

    const scaleNotes = scales[state.scale as keyof typeof scales];
    const baseNote = state.key;
    const octave = 4;
    const baseWeights = scaleWeights.melody[state.scale as keyof typeof scaleWeights.melody] ?? Array(scaleNotes.length).fill(1);
    const keyIndex = keys.indexOf(baseNote);
    const melody: string[] = [];

    for (let i = 0; i < state.noteCount; i++) {
      let currentWeights = baseWeights;
      if (i > 0 && melody[i - 1]) {
        currentWeights = applyStepwiseBias(
          baseWeights, 
          melody[i - 1], 
          scaleNotes, 
          keyIndex, 
          octave
        );
      }
      const selectedScaleIndex = weightedRandomSelect(
        scaleNotes.map((_, index) => index),
        currentWeights
      );
      const semitone = scaleNotes[selectedScaleIndex];
      const noteIndex = (keyIndex + semitone) % 12;
      const newNote = keys[noteIndex] + octave;
      melody.push(newNote);
    }

    setState(prev => ({ ...prev, generatedMelody: melody, currentNoteIndex: -1, hasGeneratedMelody: true }));
    setStatus("New melody generated! Click Play to hear it.");
  };

  const generateInitialMelody = () => {
    const scaleNotes = scales[state.scale as keyof typeof scales];
    const baseNote = state.key;
    const octave = 4;
    const baseWeights = scaleWeights.melody[state.scale as keyof typeof scaleWeights.melody] ?? Array(scaleNotes.length).fill(1);
    const keyIndex = keys.indexOf(baseNote);
    const melody: string[] = [];

    for (let i = 0; i < state.noteCount; i++) {
      let currentWeights = baseWeights;
      if (i > 0 && melody[i - 1]) {
        currentWeights = applyStepwiseBias(
          baseWeights, 
          melody[i - 1], 
          scaleNotes, 
          keyIndex, 
          octave
        );
      }
      const selectedScaleIndex = weightedRandomSelect(
        scaleNotes.map((_, index) => index),
        currentWeights
      );
      const semitone = scaleNotes[selectedScaleIndex];
      const noteIndex = (keyIndex + semitone) % 12;
      const newNote = keys[noteIndex] + octave;
      melody.push(newNote);
    }

    setState(prev => ({ ...prev, generatedMelody: melody, currentNoteIndex: -1 }));
    setStatus("Ready to generate melody");
  };

  // New track-specific generation functions
  const generateTrack = (trackType: 'bass' | 'melody' | 'harmony', melodySequence?: string[]): string[] => {
    const scaleNotes = scales[state.scale as keyof typeof scales];
    const baseNote = state.key;
    const trackData = state.tracks[trackType];
    const [minOctave, maxOctave] = trackData.octaveRange;
    const keyIndex = keys.indexOf(baseNote);
    const sequence: string[] = [];

    // Calculate notes to generate based on loop length and time signature (8th note grid)
    const [beats, denominator] = state.timeSignature.split('/').map(Number);
    const notesPerBar = beats * (8 / denominator); // 8th note subdivisions per bar
    const notesToGenerate = Math.round(state.loopLength * notesPerBar);

    // Special handling for harmony with chord progressions
    if (trackType === 'harmony') {
      const scaleType = state.scale === 'major' || state.scale === 'pentatonic' ? 'major' : 'minor';
      const progressions = chordProgressions[scaleType] || chordProgressions.major;
      const selectedProgression = progressions[Math.floor(Math.random() * progressions.length)];
      
      // Calculate notes per chord (distribute notes across progression)
      const notesPerChord = Math.ceil(notesToGenerate / selectedProgression.length);
      
      for (let i = 0; i < notesToGenerate; i++) {
        const chordIndex = Math.floor(i / notesPerChord) % selectedProgression.length;
        const currentChord = selectedProgression[chordIndex];
        const chordTones = getChordTones(currentChord, scaleNotes, baseNote);
        
        
        let harmonyNote: string;
        
        // If we have melody, try to create complementary intervals
        if (melodySequence && i < melodySequence.length) {
          const melodyNote = melodySequence[i];
          harmonyNote = getComplementaryInterval(melodyNote, chordTones, [minOctave, maxOctave], baseNote, state.scale);
        } else {
          // Otherwise, use chord tones with sustain logic
          if (i > 0 && Math.random() < 0.4) {
            // 40% chance to sustain previous note for pad effect (reuse exact note)
            harmonyNote = sequence[i - 1];
          } else {
            const chordTone = chordTones[Math.floor(Math.random() * chordTones.length)];
            const octave = Math.floor(Math.random() * (maxOctave - minOctave + 1)) + minOctave;
            harmonyNote = chordTone + octave;
          }
        }
        
        sequence.push(harmonyNote);
      }
      
      return sequence;
    }

    // For melody and bass, use the existing logic
    const baseWeights = scaleWeights[trackType][state.scale as keyof typeof scaleWeights[typeof trackType]] ?? Array(scaleNotes.length).fill(1);
    
    for (let i = 0; i < notesToGenerate; i++) {
      let currentWeights = baseWeights;
      
      // Apply track-specific musical logic
      if (i > 0 && sequence[i - 1]) {
        if (trackType === 'melody') {
          // Apply stepwise bias for more musical progressions
          currentWeights = applyStepwiseBias(
            baseWeights, 
            sequence[i - 1], 
            scaleNotes, 
            keyIndex, 
            minOctave
          );
        }
        // Bass uses its weights as-is for strong root/fifth emphasis
      }
      
      const selectedScaleIndex = weightedRandomSelect(
        scaleNotes.map((_, index) => index),
        currentWeights
      );
      const semitone = scaleNotes[selectedScaleIndex];
      const noteIndex = (keyIndex + semitone) % 12;
      
      // Choose octave within the track's range
      const octave = trackType === 'bass' 
        ? minOctave // Bass stays low
        : Math.floor(Math.random() * (maxOctave - minOctave + 1)) + minOctave;
      
      const newNote = keys[noteIndex] + octave;
      sequence.push(newNote);
    }

    return sequence;
  };

  // New rhythm-aware track generation with timing and velocity
  const generateTrackWithTiming = (trackType: 'bass' | 'melody' | 'harmony', melodySequence?: NoteWithTiming[]): NoteWithTiming[] => {
    const scaleNotes = scales[state.scale as keyof typeof scales];
    const baseNote = state.key;
    const trackData = state.tracks[trackType];
    const [minOctave, maxOctave] = trackData.octaveRange;
    const keyIndex = keys.indexOf(baseNote);
    const sequenceWithTiming: NoteWithTiming[] = [];

    // Calculate total beats to fill based on loop length
    const [beats, denominator] = state.timeSignature.split('/').map(Number);
    const beatsPerBar = beats * (4 / denominator); // Convert to quarter note beats
    const totalBeats = state.loopLength * beatsPerBar;

    // Select rhythm pattern based on track type
    let rhythmPattern: number[];
    if (trackType === 'bass') {
      rhythmPattern = rhythmPatterns.steady_bass;
    } else if (trackType === 'harmony') {
      rhythmPattern = rhythmPatterns.harmony_sustain;
    } else {
      // Melody: randomly choose between syncopated, dotted, or mixed patterns
      const melodyPatterns = [rhythmPatterns.syncopated, rhythmPatterns.dotted, rhythmPatterns.mixed];
      rhythmPattern = melodyPatterns[Math.floor(Math.random() * melodyPatterns.length)];
    }

    // Generate notes with rhythm pattern
    let currentBeat = 0;
    let patternIndex = 0;
    const baseWeights = scaleWeights[trackType][state.scale as keyof typeof scaleWeights[typeof trackType]] ?? Array(scaleNotes.length).fill(1);

    while (currentBeat < totalBeats) {
      const duration = rhythmPattern[patternIndex % rhythmPattern.length];

      // Don't exceed total beats
      const actualDuration = Math.min(duration, totalBeats - currentBeat);
      if (actualDuration <= 0) break;

      // Generate note
      let currentWeights = baseWeights;

      // Apply melodic logic for melody track
      if (sequenceWithTiming.length > 0 && trackType === 'melody') {
        const lastNote = sequenceWithTiming[sequenceWithTiming.length - 1].note;
        currentWeights = applyStepwiseBias(
          baseWeights,
          lastNote,
          scaleNotes,
          keyIndex,
          minOctave
        );
      }

      const selectedScaleIndex = weightedRandomSelect(
        scaleNotes.map((_, index) => index),
        currentWeights
      );
      const semitone = scaleNotes[selectedScaleIndex];
      const noteIndex = (keyIndex + semitone) % 12;

      // Choose octave
      const octave = trackType === 'bass'
        ? minOctave
        : Math.floor(Math.random() * (maxOctave - minOctave + 1)) + minOctave;

      const newNote = keys[noteIndex] + octave;

      // Velocity variation for humanization
      let velocity = 80;
      if (trackType === 'melody') {
        // Melody: 70-100 with some accents
        velocity = 70 + Math.floor(Math.random() * 30);
        // Accent on longer notes
        if (duration >= 1) velocity = Math.min(100, velocity + 10);
      } else if (trackType === 'bass') {
        // Bass: consistent 75-90
        velocity = 75 + Math.floor(Math.random() * 15);
      } else {
        // Harmony: softer 60-80
        velocity = 60 + Math.floor(Math.random() * 20);
      }

      sequenceWithTiming.push({
        note: newNote,
        duration: actualDuration,
        velocity: velocity
      });

      currentBeat += actualDuration;
      patternIndex++;
    }

    return sequenceWithTiming;
  };

  // Enhanced melody generation with motif repetition, contour, and phrase structure
  const generateMelodyWithStructure = (): NoteWithTiming[] => {
    // Get genre style settings
    const genreStyle = genreStyles[state.genre] || genreStyles.automatic;

    const scaleNotes = scales[state.scale as keyof typeof scales];
    const baseNote = state.key;
    const [minOctave, maxOctave] = state.tracks.melody.octaveRange;
    const keyIndex = keys.indexOf(baseNote);
    const sequenceWithTiming: NoteWithTiming[] = [];

    // Calculate total beats
    const [beats, denominator] = state.timeSignature.split('/').map(Number);
    const beatsPerBar = beats * (4 / denominator);
    const totalBeats = state.loopLength * beatsPerBar;

    // Select rhythm pattern based on genre
    const rhythmPattern = genreStyle.rhythmPatterns[Math.floor(Math.random() * genreStyle.rhythmPatterns.length)];

    // Helper: Generate a single note with contour bias and smart intervals
    const generateNote = (direction: Direction, lastNote: string | null, scaleWeights: number[]): { note: string, scaleIndex: number } => {
      let currentWeights = [...scaleWeights];

      if (lastNote) {
        // Parse last note
        const lastNoteName = lastNote.slice(0, -1);
        const lastOctave = parseInt(lastNote.slice(-1));
        const lastNoteIndex = keys.indexOf(lastNoteName);
        const lastSemitone = (lastNoteIndex - keyIndex + 12) % 12;
        const lastScaleIndex = scaleNotes.indexOf(lastSemitone);

        if (lastScaleIndex !== -1) {
          // Apply directional bias
          currentWeights = currentWeights.map((weight, idx) => {
            let newWeight = weight;

            // Directional bias
            if (direction === Direction.UP) {
              newWeight = idx > lastScaleIndex ? weight * 3 : weight * 0.3;
            } else if (direction === Direction.DOWN) {
              newWeight = idx < lastScaleIndex ? weight * 3 : weight * 0.3;
            } else {
              // REPEAT: favor staying close
              const distance = Math.abs(idx - lastScaleIndex);
              newWeight = distance === 0 ? weight * 4 : distance === 1 ? weight * 2 : weight * 0.5;
            }

            // Apply interval quality weighting (Phase 3: Smart Intervals)
            const intervalInSemitones = Math.abs(scaleNotes[idx] - scaleNotes[lastScaleIndex]);
            const intervalQualityWeight = intervalQuality[intervalInSemitones] ?? 0.3;
            newWeight *= intervalQualityWeight;

            // Genre-specific interval bias (allow more leaps in jazz, fewer in pop/ballad)
            const leapThreshold = 7 - (genreStyle.intervalBias * 3); // 4-7 semitones
            const leapProbability = 0.15 + (genreStyle.intervalBias * 0.35); // 15%-50% chance
            if (intervalInSemitones > leapThreshold && Math.random() > leapProbability) {
              newWeight *= 0.1;
            }

            return newWeight;
          });
        }
      }

      const selectedScaleIndex = weightedRandomSelect(
        scaleNotes.map((_, index) => index),
        currentWeights
      );
      const semitone = scaleNotes[selectedScaleIndex];
      const noteIndex = (keyIndex + semitone) % 12;
      const octave = Math.floor(Math.random() * (maxOctave - minOctave + 1)) + minOctave;
      return { note: keys[noteIndex] + octave, scaleIndex: selectedScaleIndex };
    };

    // Helper: Generate a motif (2-4 notes)
    const generateMotif = (numNotes: number, direction: Direction): NoteWithTiming[] => {
      const motif: NoteWithTiming[] = [];
      let lastNote: string | null = null;
      const baseWeights = scaleWeights.melody[state.scale as keyof typeof scaleWeights.melody] ?? Array(scaleNotes.length).fill(1);

      for (let i = 0; i < numNotes; i++) {
        const { note } = generateNote(direction, lastNote, baseWeights);
        const duration = rhythmPattern[i % rhythmPattern.length];
        // Genre-specific velocity range
        const [minVel, maxVel] = genreStyle.velocityRange;
        const velocity = minVel + Math.floor(Math.random() * (maxVel - minVel));

        motif.push({ note, duration, velocity });
        lastNote = note;
      }

      return motif;
    };

    // Helper: Transpose motif by scale degrees
    const transposeMotif = (motif: NoteWithTiming[], semitones: number): NoteWithTiming[] => {
      return motif.map(noteData => {
        const noteName = noteData.note.slice(0, -1);
        const octave = parseInt(noteData.note.slice(-1));
        const noteIndex = keys.indexOf(noteName);
        const newNoteIndex = (noteIndex + semitones) % 12;
        const octaveAdjust = Math.floor((noteIndex + semitones) / 12);
        const newNote = keys[newNoteIndex] + Math.max(minOctave, Math.min(maxOctave, octave + octaveAdjust));

        return { ...noteData, note: newNote };
      });
    };

    // Generate phrases with motifs
    let currentBeat = 0;
    const beatsPerPhrase = totalBeats / 2; // Two phrases: question + answer

    // PHRASE 1: Question (rising, tension-building)
    const motifLength = 3 + Math.floor(Math.random() * 2); // 3-4 notes
    const questionMotif = generateMotif(motifLength, Direction.UP);

    let motifBeat = questionMotif.reduce((sum, n) => sum + n.duration, 0);

    // Repeat motif in question phrase (genre-specific repetition rate)
    while (currentBeat + motifBeat <= beatsPerPhrase) {
      if (Math.random() < genreStyle.motifRepetition) {
        // Genre-based exact repetition (70% pop, 40% jazz, 85% trap)
        sequenceWithTiming.push(...questionMotif);
      } else {
        // Transposed variation
        const transpose = (Math.floor(Math.random() * 3) + 2) * (Math.random() < 0.5 ? 1 : -1);
        sequenceWithTiming.push(...transposeMotif(questionMotif, transpose));
      }
      currentBeat += motifBeat;
    }

    // Fill remaining beats in question phrase (genre-specific rest probability)
    const shouldAddRest = Math.random() < genreStyle.restProbability;
    const questionEndTarget = shouldAddRest ? beatsPerPhrase - 0.5 : beatsPerPhrase;

    while (currentBeat < questionEndTarget) {
      const duration = Math.min(rhythmPattern[sequenceWithTiming.length % rhythmPattern.length], questionEndTarget - currentBeat);
      if (duration < 0.25) break;

      const lastNote = sequenceWithTiming[sequenceWithTiming.length - 1]?.note || null;
      const baseWeights = scaleWeights.melody[state.scale as keyof typeof scaleWeights.melody] ?? Array(scaleNotes.length).fill(1);
      const { note } = generateNote(Direction.UP, lastNote, baseWeights);
      // Genre-specific velocity
      const [minVel, maxVel] = genreStyle.velocityRange;
      const velocity = minVel + Math.floor(Math.random() * (maxVel - minVel));

      sequenceWithTiming.push({ note, duration, velocity });
      currentBeat += duration;
    }

    // Add rest between phrases if genre prefers it
    if (shouldAddRest && currentBeat < beatsPerPhrase) {
      const restDuration = beatsPerPhrase - currentBeat;
      sequenceWithTiming.push({ note: 'REST', duration: restDuration, velocity: 0 });
      currentBeat = beatsPerPhrase;
    }

    // PHRASE 2: Answer (falling, resolving)
    const answerMotif = generateMotif(motifLength, Direction.DOWN);
    motifBeat = answerMotif.reduce((sum, n) => sum + n.duration, 0);

    // Repeat motif in answer phrase (genre-specific repetition rate)
    while (currentBeat + motifBeat <= totalBeats) {
      if (Math.random() < genreStyle.motifRepetition) {
        sequenceWithTiming.push(...answerMotif);
      } else {
        const transpose = (Math.floor(Math.random() * 3) + 2) * (Math.random() < 0.5 ? 1 : -1);
        sequenceWithTiming.push(...transposeMotif(answerMotif, transpose));
      }
      currentBeat += motifBeat;
    }

    // Fill remaining beats in answer phrase
    while (currentBeat < totalBeats) {
      const duration = Math.min(rhythmPattern[sequenceWithTiming.length % rhythmPattern.length], totalBeats - currentBeat);
      const lastNote = sequenceWithTiming[sequenceWithTiming.length - 1]?.note || null;
      const baseWeights = scaleWeights.melody[state.scale as keyof typeof scaleWeights.melody] ?? Array(scaleNotes.length).fill(1);
      const { note } = generateNote(Direction.DOWN, lastNote, baseWeights);
      // Genre-specific velocity
      const [minVel, maxVel] = genreStyle.velocityRange;
      const velocity = minVel + Math.floor(Math.random() * (maxVel - minVel));

      sequenceWithTiming.push({ note, duration, velocity });
      currentBeat += duration;
    }

    // End on tonic (root note) for resolution
    const tonicNote = state.key + minOctave;
    if (sequenceWithTiming.length > 0) {
      sequenceWithTiming[sequenceWithTiming.length - 1].note = tonicNote;
      sequenceWithTiming[sequenceWithTiming.length - 1].velocity = 90; // Strong ending
    }

    return sequenceWithTiming;
  };

  const generateAllTracks = () => {
    setIsGenerating(true);
    setStatus("Generating all tracks...");

    // Small delay to show loading state
    setTimeout(() => {
      // Generate rhythm-aware tracks
      const bassTrackWithTiming = generateTrackWithTiming('bass');
      const melodyTrackWithTiming = generateMelodyWithStructure(); // Use enhanced melody generator
      const harmonyTrackWithTiming = generateTrackWithTiming('harmony', melodyTrackWithTiming);

    // Also create simple note arrays for backward compatibility
    const bassTrack = bassTrackWithTiming.map(n => n.note);
    const melodyTrack = melodyTrackWithTiming.map(n => n.note);
    const harmonyTrack = harmonyTrackWithTiming.map(n => n.note);

    setState(prev => ({
      ...prev,
      tracks: {
        bass: {
          ...prev.tracks.bass,
          generatedSequence: bassTrack,
          generatedSequenceWithTiming: bassTrackWithTiming,
          hasGenerated: true,
          currentNoteIndex: -1
        },
        melody: {
          ...prev.tracks.melody,
          generatedSequence: melodyTrack,
          generatedSequenceWithTiming: melodyTrackWithTiming,
          hasGenerated: true,
          currentNoteIndex: -1
        },
        harmony: {
          ...prev.tracks.harmony,
          generatedSequence: harmonyTrack,
          generatedSequenceWithTiming: harmonyTrackWithTiming,
          hasGenerated: true,
          currentNoteIndex: -1
        }
      },
      // Mirror melody track to legacy fields for backward compatibility
      generatedMelody: melodyTrack,
      currentNoteIndex: -1,
      hasGeneratedMelody: true
    }));

      setStatus("All tracks generated! Ready to play.");
      setIsGenerating(false);
      setCurrentPresetName(null); // Clear preset name on generation
    }, 50); // Small delay to show loading animation
  };

  // Regenerate a single track without affecting others
  const regenerateSingleTrack = (trackType: TrackType) => {
    setIsGenerating(true);
    setStatus(`Regenerating ${trackType} track...`);

    // Small delay to show loading state
    setTimeout(() => {
      let newTrackWithTiming: NoteWithTiming[];

      // Generate based on track type
      if (trackType === 'melody') {
        newTrackWithTiming = generateMelodyWithStructure();
      } else if (trackType === 'harmony') {
        // Harmony needs melody reference for chord generation
        const melodyReference = state.tracks.melody.generatedSequenceWithTiming;
        newTrackWithTiming = generateTrackWithTiming('harmony', melodyReference);
      } else {
        // Bass
        newTrackWithTiming = generateTrackWithTiming('bass');
      }

      // Create simple note array for backward compatibility
      const newTrack = newTrackWithTiming.map(n => n.note);

      setState(prev => ({
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackType]: {
            ...prev.tracks[trackType],
            generatedSequence: newTrack,
            generatedSequenceWithTiming: newTrackWithTiming,
            hasGenerated: true,
            currentNoteIndex: -1
          }
        },
        // If melody was regenerated, update legacy fields
        ...(trackType === 'melody' ? {
          generatedMelody: newTrack,
          hasGeneratedMelody: true
        } : {})
      }));

      setCurrentPresetName(null); // Clear preset name on regeneration
      setStatus(`${trackType.charAt(0).toUpperCase() + trackType.slice(1)} track regenerated!`);
      setIsGenerating(false);
    }, 50);
  };

  // Toggle time multiplier for a track (cycle through 0.5x, 1x, 2x)
  const toggleTimeMultiplier = (trackType: TrackType) => {
    setState(prev => {
      const currentMultiplier = prev.tracks[trackType].timeMultiplier;
      let newMultiplier: number;

      if (currentMultiplier === 0.5) {
        newMultiplier = 1.0; // Half-time -> Normal
      } else if (currentMultiplier === 1.0) {
        newMultiplier = 2.0; // Normal -> Double-time
      } else {
        newMultiplier = 0.5; // Double-time -> Half-time
      }

      return {
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackType]: {
            ...prev.tracks[trackType],
            timeMultiplier: newMultiplier
          }
        }
      };
    });
  };

  // Toggle step on/off for manual step editing
  const toggleStep = (trackType: TrackType, stepIndex: number) => {
    const stepsPerBeat = 4; // 16th note grid
    const track = state.tracks[trackType];
    const sequence = [...track.generatedSequenceWithTiming];

    // Find which note corresponds to this step
    let currentBeat = 0;
    let noteIndexAtStep = -1;
    let isNoteStart = false;

    for (let i = 0; i < sequence.length; i++) {
      const noteData = sequence[i];
      const noteStartStep = Math.floor(currentBeat * stepsPerBeat);
      const noteEndStep = Math.floor((currentBeat + noteData.duration) * stepsPerBeat);

      if (noteStartStep === stepIndex) {
        noteIndexAtStep = i;
        isNoteStart = true;
        break;
      } else if (noteStartStep < stepIndex && stepIndex < noteEndStep) {
        noteIndexAtStep = i;
        break;
      }

      currentBeat += noteData.duration;
    }

    // If note exists at this step, toggle it
    if (noteIndexAtStep >= 0 && isNoteStart) {
      // Toggle: if it's a note, make it REST; if it's REST, restore to a default note
      const currentNote = sequence[noteIndexAtStep];
      if (currentNote.note !== 'REST') {
        // Turn off: make it REST
        sequence[noteIndexAtStep] = {
          ...currentNote,
          note: 'REST'
        };
      } else {
        // Turn on: generate a note based on the track type and scale
        const scaleNotes = scales[state.scale as keyof typeof scales];
        const baseNote = state.key;
        const keyIndex = keys.indexOf(baseNote);
        const [minOctave, maxOctave] = track.octaveRange;

        // Use middle of octave range
        const octave = Math.floor((minOctave + maxOctave) / 2);

        // Pick a scale degree (tonic for simplicity)
        const semitone = scaleNotes[0];
        const noteIndex = (keyIndex + semitone) % 12;
        const newNote = keys[noteIndex] + octave;

        sequence[noteIndexAtStep] = {
          ...currentNote,
          note: newNote
        };
      }

      // Update state
      setState(prev => ({
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackType]: {
            ...prev.tracks[trackType],
            generatedSequenceWithTiming: sequence
          }
        }
      }));
    } else if (noteIndexAtStep < 0) {
      // No note at this step - create a new note at this position
      // Calculate the beat position for this step
      const beatPosition = stepIndex / stepsPerBeat;
      const defaultDuration = 0.25; // 16th note

      // Find where to insert this note in the sequence
      currentBeat = 0;
      let insertIndex = 0;
      for (let i = 0; i < sequence.length; i++) {
        if (currentBeat >= beatPosition) {
          insertIndex = i;
          break;
        }
        currentBeat += sequence[i].duration;
        insertIndex = i + 1;
      }

      // Generate a note
      const scaleNotes = scales[state.scale as keyof typeof scales];
      const baseNote = state.key;
      const keyIndex = keys.indexOf(baseNote);
      const [minOctave, maxOctave] = track.octaveRange;
      const octave = Math.floor((minOctave + maxOctave) / 2);
      const semitone = scaleNotes[0];
      const noteIndex = (keyIndex + semitone) % 12;
      const newNote = keys[noteIndex] + octave;

      // Insert new note
      const newNoteData: NoteWithTiming = {
        note: newNote,
        duration: defaultDuration,
        velocity: 80
      };

      // If we're inserting in the middle, we may need to split existing notes
      // For simplicity, just insert at the position
      sequence.splice(insertIndex, 0, newNoteData);

      setState(prev => ({
        ...prev,
        tracks: {
          ...prev.tracks,
          [trackType]: {
            ...prev.tracks[trackType],
            generatedSequenceWithTiming: sequence
          }
        }
      }));
    }
  };

  const startPlayback = async () => {
    // Ensure soundfonts are loaded
    if (!bassSoundfontRef.current || !melodySoundfontRef.current || !harmonySoundfontRef.current) {
      setStatus("Soundfonts not loaded yet. Please wait...");
      return;
    }
    // Also need Tone.js for Transport timing
    if (!toneLoaded) {
      setStatus("Audio engine not loaded yet. Please wait...");
      return;
    }

    // Check if we have generated tracks to play
    const hasAnyTrack = state.tracks.bass.generatedSequence.length > 0 ||
                        state.tracks.melody.generatedSequence.length > 0 ||
                        state.tracks.harmony.generatedSequence.length > 0;

    if (!hasAnyTrack) {
      setStatus("Please generate at least one track first!");
      return;
    }

    try {
      if (window.Tone.context.state !== 'running') {
        await window.Tone.start();
      }

      setState(prev => ({ ...prev, isPlaying: true, currentNoteIndex: -1 }));
      setStatus("Playing tracks...");

      // Stop and dispose any existing sequences
      if (bassSequenceRef.current) {
        bassSequenceRef.current.stop();
        bassSequenceRef.current.dispose();
      }
      if (melodySequenceRef.current) {
        melodySequenceRef.current.stop();
        melodySequenceRef.current.dispose();
      }
      if (harmonySequenceRef.current) {
        harmonySequenceRef.current.stop();
        harmonySequenceRef.current.dispose();
      }
      if (stepSequencerRef.current) {
        stepSequencerRef.current.stop();
        stepSequencerRef.current.dispose();
      }

      // Create step sequencer for continuous LED indicator (Roland TR-8S style)
      const totalSteps = state.loopLength === 4 ? 16 : 32;
      const customLoopEndStep = state.tracks.bass.customLoopEndStep;
      const effectiveSteps = customLoopEndStep !== null ? customLoopEndStep + 1 : totalSteps;

      // Create array of step indices to iterate through
      const stepArray = Array.from({ length: effectiveSteps }, (_, i) => i);

      stepSequencerRef.current = new window.Tone.Sequence(
        (time, step) => {
          // Update the current step index in state
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

      stepSequencerRef.current.loop = state.isLooping;
      stepSequencerRef.current.start(0);

      // Create synchronized sequences for each track with rhythm-aware timing
      if (state.tracks.bass.generatedSequenceWithTiming.length > 0 && state.tracks.bass.isEnabled) {
        let bassIndex = 0;
        const bassSequenceWithTiming = state.tracks.bass.generatedSequenceWithTiming;
        const bassTimeMultiplier = state.tracks.bass.timeMultiplier;

        // Calculate loop end based on custom step or full length
        const stepsPerBeat = 4; // 16th note grid
        const customLoopEndStep = state.tracks.bass.customLoopEndStep;
        let loopEndTime = 0;

        // Build time-note pairs for Tone.Part
        let currentTime = 0;
        let allBassEvents = bassSequenceWithTiming.map((noteData, index) => {
          const event = {
            time: currentTime,
            note: noteData.note,
            duration: noteData.duration / bassTimeMultiplier, // Apply time multiplier to duration
            velocity: noteData.velocity / 127, // Normalize to 0-1 for Tone.js
            index: index,
            stepPosition: currentTime * stepsPerBeat
          };
          currentTime += (noteData.duration / bassTimeMultiplier) * (60 / state.tempo) * 4; // Apply time multiplier
          return event;
        });

        // Filter events based on custom loop end
        let bassEvents = allBassEvents;
        if (customLoopEndStep !== null) {
          const loopEndBeat = (customLoopEndStep + 1) / stepsPerBeat;
          bassEvents = allBassEvents.filter(event => event.stepPosition < (customLoopEndStep + 1));
          loopEndTime = (customLoopEndStep + 1) * (60 / state.tempo); // Convert steps to seconds
        } else {
          loopEndTime = currentTime;
        }

        bassSequenceRef.current = new window.Tone.Part((time: number, value: any) => {
          // Update bass track note index
          setState(prev => ({
            ...prev,
            tracks: {
              ...prev.tracks,
              bass: {
                ...prev.tracks.bass,
                currentNoteIndex: value.index
              }
            }
          }));

          if (value.note && value.note !== 'rest' && value.note !== 'REST') {
            const durationInSeconds = value.duration * (60 / state.tempo) * 4;

            // Play using soundfont
            if (bassSoundfontRef.current) {
              bassSoundfontRef.current.triggerAttackRelease(
                value.note,
                durationInSeconds * 0.9,
                time,
                value.velocity
              );
            }
          }
        }, bassEvents);

        bassSequenceRef.current.loop = state.isLooping;
        bassSequenceRef.current.loopEnd = loopEndTime;
      }

      if (state.tracks.melody.generatedSequenceWithTiming.length > 0 && state.tracks.melody.isEnabled) {
        let melodyIndex = 0;
        const melodySequenceWithTiming = state.tracks.melody.generatedSequenceWithTiming;
        const melodyTimeMultiplier = state.tracks.melody.timeMultiplier;

        // Build time-note pairs for Tone.Part with micro-timing humanization (Phase 3)
        let currentTime = 0;
        const melodyEvents = melodySequenceWithTiming.map((noteData, index) => {
          // Micro-timing: Add slight random timing offset (±15ms max)
          const microTiming = (Math.random() - 0.5) * 0.03; // ±1.5% of beat at 120 BPM

          const event = {
            time: currentTime + microTiming,
            note: noteData.note,
            duration: noteData.duration / melodyTimeMultiplier, // Apply time multiplier
            velocity: noteData.velocity / 127,
            index: index
          };
          currentTime += (noteData.duration / melodyTimeMultiplier) * (60 / state.tempo) * 4; // Apply time multiplier
          return event;
        });

        melodySequenceRef.current = new window.Tone.Part((time: number, value: any) => {
          setState(prev => ({
            ...prev,
            tracks: {
              ...prev.tracks,
              melody: {
                ...prev.tracks.melody,
                currentNoteIndex: value.index
              }
            }
          }));

          if (value.note && value.note !== 'rest' && value.note !== 'REST') {
            const durationInSeconds = value.duration * (60 / state.tempo) * 4;
            // Slight duration variation for humanization
            const durationVariation = 0.95 + Math.random() * 0.1; // 95%-105% of duration

            // Play using soundfont
            if (melodySoundfontRef.current) {
              melodySoundfontRef.current.triggerAttackRelease(
                value.note,
                durationInSeconds * 0.9 * durationVariation,
                time,
                value.velocity
              );
            }
          }
        }, melodyEvents);

        melodySequenceRef.current.loop = state.isLooping;
        melodySequenceRef.current.loopEnd = currentTime;
      }

      if (state.tracks.harmony.generatedSequenceWithTiming.length > 0 && state.tracks.harmony.isEnabled) {
        let harmonyIndex = 0;
        const harmonySequenceWithTiming = state.tracks.harmony.generatedSequenceWithTiming;
        const harmonyTimeMultiplier = state.tracks.harmony.timeMultiplier;

        // Build time-note pairs for Tone.Part
        let currentTime = 0;
        const harmonyEvents = harmonySequenceWithTiming.map((noteData, index) => {
          const event = {
            time: currentTime,
            note: noteData.note,
            duration: noteData.duration / harmonyTimeMultiplier, // Apply time multiplier
            velocity: noteData.velocity / 127,
            index: index
          };
          currentTime += (noteData.duration / harmonyTimeMultiplier) * (60 / state.tempo) * 4; // Apply time multiplier
          return event;
        });

        harmonySequenceRef.current = new window.Tone.Part((time: number, value: any) => {
          setState(prev => ({
            ...prev,
            tracks: {
              ...prev.tracks,
              harmony: {
                ...prev.tracks.harmony,
                currentNoteIndex: value.index
              }
            }
          }));

          if (value.note && value.note !== 'rest' && value.note !== 'REST') {
            const durationInSeconds = value.duration * (60 / state.tempo) * 4;

            // Play using soundfont
            if (harmonySoundfontRef.current) {
              harmonySoundfontRef.current.triggerAttackRelease(
                value.note,
                durationInSeconds * 0.95,
                time,
                value.velocity
              );
            }
          }
        }, harmonyEvents);

        harmonySequenceRef.current.loop = state.isLooping;
        harmonySequenceRef.current.loopEnd = currentTime;
      }

      // Set tempo and start all sequences synchronously
      window.Tone.Transport.bpm.value = state.tempo;
      
      // Start all sequences simultaneously for perfect sync
      if (bassSequenceRef.current) bassSequenceRef.current.start();
      if (melodySequenceRef.current) melodySequenceRef.current.start();
      if (harmonySequenceRef.current) harmonySequenceRef.current.start();

      // Start metronome if enabled
      if (state.metronomeEnabled) {
        startMetronome();
      }

      // Set Transport time signature and loop boundaries
      const [beats, denominator] = state.timeSignature.split('/').map(Number);
      window.Tone.Transport.timeSignature = [beats, denominator];
      window.Tone.Transport.loopStart = 0;
      window.Tone.Transport.loopEnd = `${state.loopLength}m`; // e.g., "4m" for 4 measures
      window.Tone.Transport.loop = state.isLooping;

      // Start transport once to sync all sequences
      window.Tone.Transport.start();

      // Handle non-looping playback completion
      if (!state.isLooping) {
        // Calculate duration based on meter-aware math
        const barSeconds = (60 / state.tempo) * beats * (4 / denominator);
        const totalSeconds = barSeconds * state.loopLength;
        setTimeout(() => {
          stopPlayback();
        }, totalSeconds * 1000 + 500);
      }

    } catch (error) {
      console.error("Playback error:", error);
      setStatus("Error playing tracks. Please try again.");
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  };

  const stopPlayback = () => {
    try {
      // Stop and dispose all three sequences
      if (bassSequenceRef.current) {
        bassSequenceRef.current.stop();
        bassSequenceRef.current.dispose();
        bassSequenceRef.current = null;
      }
      if (melodySequenceRef.current) {
        melodySequenceRef.current.stop();
        melodySequenceRef.current.dispose();
        melodySequenceRef.current = null;
      }
      if (harmonySequenceRef.current) {
        harmonySequenceRef.current.stop();
        harmonySequenceRef.current.dispose();
        harmonySequenceRef.current = null;
      }
      if (stepSequencerRef.current) {
        stepSequencerRef.current.stop();
        stepSequencerRef.current.dispose();
        stepSequencerRef.current = null;
      }

      // Stop metronome if enabled
      if (state.metronomeEnabled && metronomeSequenceRef.current) {
        stopMetronome();
      }

      // Stop and clean up Transport
      if (window.Tone && window.Tone.Transport) {
        window.Tone.Transport.stop();
        window.Tone.Transport.cancel();
      }
    } catch (error) {
      console.error("Error during playback cleanup:", error);
    } finally {
      setState(prev => ({
        ...prev,
        isPlaying: false,
        currentNoteIndex: -1,
        tracks: {
          ...prev.tracks,
          bass: { ...prev.tracks.bass, currentStepIndex: -1, currentNoteIndex: -1 },
          melody: { ...prev.tracks.melody, currentNoteIndex: -1 },
          harmony: { ...prev.tracks.harmony, currentNoteIndex: -1 }
        }
      }));
      setStatus("Playback complete");
    }
  };

  const togglePlayback = () => {
    if (state.isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const startMetronome = () => {
    if (!toneLoaded || !metronomeRef.current) return;

    try {
      if (metronomeSequenceRef.current) {
        metronomeSequenceRef.current.stop();
        metronomeSequenceRef.current.dispose();
      }

      const timeSignature = timeSignatures[state.timeSignature as keyof typeof timeSignatures];
      metronomeSequenceRef.current = new window.Tone.Sequence(
        (time: number, note: string) => {
          metronomeRef.current.triggerAttackRelease(note, "32n", time);
        },
        timeSignature.pattern,
        timeSignature.noteValue
      );

      window.Tone.Transport.bpm.value = state.tempo;
      metronomeSequenceRef.current.loop = true;
      metronomeSequenceRef.current.start();

      // Only start Transport if not already started (e.g., during playback)
      if (window.Tone.Transport.state !== "started") {
        window.Tone.Transport.start();
      }

    } catch (error) {
      console.error("Metronome error:", error);
    }
  };

  const stopMetronome = () => {
    try {
      if (metronomeSequenceRef.current) {
        metronomeSequenceRef.current.stop();
        metronomeSequenceRef.current.dispose();
        metronomeSequenceRef.current = null;
      }
    } catch (error) {
      console.error("Error stopping metronome:", error);
    }
  };

  const toggleMetronome = () => {
    const newEnabled = !state.metronomeEnabled;
    setState(prev => ({ ...prev, metronomeEnabled: newEnabled }));

    if (newEnabled) {
      startMetronome();
    } else {
      stopMetronome();
    }
  };

  useEffect(() => {
    generateInitialMelody();
    loadPresetList(); // Load saved presets on mount
  }, []);

  useEffect(() => {
    if (state.generatedMelody.length === 0) return;
    if (state.generatedMelody.length !== state.noteCount) {
      state.hasGeneratedMelody ? generateMelody() : generateInitialMelody();
    }
  }, [state.noteCount, state.hasGeneratedMelody]);

  // Real-time tempo changes during playback
  useEffect(() => {
    if (toneLoaded && window.Tone) {
      // Update Transport BPM in real-time (works even during playback)
      window.Tone.Transport.bpm.value = state.tempo;

      // Restart metronome with new tempo if it's enabled and playing standalone
      if (state.metronomeEnabled && !state.isPlaying && metronomeSequenceRef.current) {
        stopMetronome();
        startMetronome();
      }
    }
  }, [state.tempo, toneLoaded]);

  // Handle track mute/unmute during playback
  useEffect(() => {
    if (!state.isPlaying || !toneLoaded) return;

    // Stop and dispose sequences for disabled tracks
    if (!state.tracks.bass.isEnabled && bassSequenceRef.current) {
      bassSequenceRef.current.stop();
      bassSequenceRef.current.dispose();
      bassSequenceRef.current = null;
    }

    if (!state.tracks.melody.isEnabled && melodySequenceRef.current) {
      melodySequenceRef.current.stop();
      melodySequenceRef.current.dispose();
      melodySequenceRef.current = null;
    }

    if (!state.tracks.harmony.isEnabled && harmonySequenceRef.current) {
      harmonySequenceRef.current.stop();
      harmonySequenceRef.current.dispose();
      harmonySequenceRef.current = null;
    }

    // Restart sequences for newly enabled tracks
    if (state.tracks.bass.isEnabled && !bassSequenceRef.current && state.tracks.bass.generatedSequenceWithTiming.length > 0) {
      const bassSequenceWithTiming = state.tracks.bass.generatedSequenceWithTiming;
      const stepsPerBeat = 4;
      const customLoopEndStep = state.tracks.bass.customLoopEndStep;

      let currentTime = 0;
      let allBassEvents = bassSequenceWithTiming.map((noteData, index) => {
        const event = {
          time: currentTime,
          note: noteData.note,
          duration: noteData.duration,
          velocity: noteData.velocity / 127,
          index: index,
          stepPosition: currentTime * stepsPerBeat
        };
        currentTime += noteData.duration * (60 / state.tempo) * 4;
        return event;
      });

      let bassEvents = allBassEvents;
      let loopEndTime = 0;
      if (customLoopEndStep !== null) {
        bassEvents = allBassEvents.filter(event => event.stepPosition < (customLoopEndStep + 1));
        loopEndTime = (customLoopEndStep + 1) * (60 / state.tempo);
      } else {
        loopEndTime = currentTime;
      }

      bassSequenceRef.current = new window.Tone.Part((time: number, value: any) => {
        setState(prev => ({
          ...prev,
          tracks: {
            ...prev.tracks,
            bass: {
              ...prev.tracks.bass,
              currentNoteIndex: value.index
            }
          }
        }));

        if (value.note && value.note !== 'rest' && value.note !== 'REST') {
          const durationInSeconds = value.duration * (60 / state.tempo) * 4;
          if (bassSoundfontRef.current) {
            bassSoundfontRef.current.triggerAttackRelease(
              value.note,
              durationInSeconds * 0.9,
              time,
              value.velocity
            );
          }
        }
      }, bassEvents);

      bassSequenceRef.current.loop = state.isLooping;
      bassSequenceRef.current.loopEnd = loopEndTime;
      bassSequenceRef.current.start();
    }

    if (state.tracks.melody.isEnabled && !melodySequenceRef.current && state.tracks.melody.generatedSequenceWithTiming.length > 0) {
      const melodySequenceWithTiming = state.tracks.melody.generatedSequenceWithTiming;

      let currentTime = 0;
      const melodyEvents = melodySequenceWithTiming.map((noteData, index) => {
        const microTiming = (Math.random() - 0.5) * 0.03;
        const event = {
          time: currentTime + microTiming,
          note: noteData.note,
          duration: noteData.duration,
          velocity: noteData.velocity / 127,
          index: index
        };
        currentTime += noteData.duration * (60 / state.tempo) * 4;
        return event;
      });

      melodySequenceRef.current = new window.Tone.Part((time: number, value: any) => {
        setState(prev => ({
          ...prev,
          tracks: {
            ...prev.tracks,
            melody: {
              ...prev.tracks.melody,
              currentNoteIndex: value.index
            }
          }
        }));

        if (value.note && value.note !== 'rest' && value.note !== 'REST') {
          const durationInSeconds = value.duration * (60 / state.tempo) * 4;
          const durationVariation = 0.95 + Math.random() * 0.1;
          if (melodySoundfontRef.current) {
            melodySoundfontRef.current.triggerAttackRelease(
              value.note,
              durationInSeconds * 0.9 * durationVariation,
              time,
              value.velocity
            );
          }
        }
      }, melodyEvents);

      melodySequenceRef.current.loop = state.isLooping;
      melodySequenceRef.current.loopEnd = currentTime;
      melodySequenceRef.current.start();
    }

    if (state.tracks.harmony.isEnabled && !harmonySequenceRef.current && state.tracks.harmony.generatedSequenceWithTiming.length > 0) {
      const harmonySequenceWithTiming = state.tracks.harmony.generatedSequenceWithTiming;

      let currentTime = 0;
      const harmonyEvents = harmonySequenceWithTiming.map((noteData, index) => {
        const event = {
          time: currentTime,
          note: noteData.note,
          duration: noteData.duration,
          velocity: noteData.velocity / 127,
          index: index
        };
        currentTime += noteData.duration * (60 / state.tempo) * 4;
        return event;
      });

      harmonySequenceRef.current = new window.Tone.Part((time: number, value: any) => {
        setState(prev => ({
          ...prev,
          tracks: {
            ...prev.tracks,
            harmony: {
              ...prev.tracks.harmony,
              currentNoteIndex: value.index
            }
          }
        }));

        if (value.note && value.note !== 'rest' && value.note !== 'REST') {
          const durationInSeconds = value.duration * (60 / state.tempo) * 4;
          if (harmonySoundfontRef.current) {
            harmonySoundfontRef.current.triggerAttackRelease(
              value.note,
              durationInSeconds * 0.95,
              time,
              value.velocity
            );
          }
        }
      }, harmonyEvents);

      harmonySequenceRef.current.loop = state.isLooping;
      harmonySequenceRef.current.loopEnd = currentTime;
      harmonySequenceRef.current.start();
    }
  }, [state.tracks.bass.isEnabled, state.tracks.melody.isEnabled, state.tracks.harmony.isEnabled, state.isPlaying, toneLoaded]);

  useEffect(() => {
    // Restart metronome when time signature changes if enabled and playing standalone
    if (state.metronomeEnabled && toneLoaded && !state.isPlaying) {
      stopMetronome();
      startMetronome();
    }
  }, [state.timeSignature]);

  // Show initial loading screen
  if (!toneLoaded) {
    return (
      <div className="w-full max-w-2xl flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="xl" text="Loading audio engine..." />
        <p className="text-sm text-muted-foreground mt-4">Initializing Tone.js...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      {/* Header Section */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-semibold text-foreground mb-2">MULTI-TRACK GENERATOR</h1>
        <p className="text-muted-foreground">Create layered music with Bass, Melody, and Harmony</p>
      </div>

      {/* Global Control Buttons */}
      <div className="flex gap-4 mb-6">
        <Button
          onClick={generateAllTracks}
          className="flex-1 flex items-center justify-center gap-2"
          disabled={isGenerating}
          data-testid="button-generate-all"
        >
          {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
          {isGenerating ? "Generating..." : "Generate All Tracks"}
        </Button>

        <Button
          onClick={togglePlayback}
          className={`flex-1 flex items-center justify-center gap-2 ${state.isPlaying ? 'play-button-loading' : ''}`}
          disabled={!toneLoaded}
          data-testid="button-play"
        >
          {state.isPlaying ? (
            <>
              <Square className="w-5 h-5" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              <span>Play</span>
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={exportMIDI}
          className="flex items-center justify-center gap-2"
          disabled={!toneLoaded || !state.hasGeneratedMelody}
          data-testid="button-midi-export"
        >
          <Download className="w-4 h-4" />
          <span>Download MIDI</span>
        </Button>
      </div>

      {/* Preset Management */}
      <div className="mb-6">
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => setShowPresetDialog(true)}
            className="flex-1 flex items-center justify-center gap-2"
            disabled={!state.tracks.bass.hasGenerated && !state.tracks.melody.hasGenerated && !state.tracks.harmony.hasGenerated}
          >
            <span>Save Preset</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowLoadDialog(true)}
            className="flex-1 flex items-center justify-center gap-2"
            disabled={savedPresets.length === 0}
          >
            <span>Load Preset ({savedPresets.length})</span>
          </Button>
        </div>

        {currentPresetName && (
          <div className="mt-2 text-center text-sm text-muted-foreground">
            Current Preset: <span className="font-semibold text-foreground">{currentPresetName}</span>
          </div>
        )}
      </div>

      {/* Save Preset Dialog */}
      {showPresetDialog && (
        <Card className="shadow-lg border border-border mb-6 bg-card/95">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Save Preset</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Preset Name</label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      savePreset(presetName);
                    }
                  }}
                  placeholder="My Amazing Track"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => savePreset(presetName)}
                  className="flex-1"
                  disabled={!presetName.trim()}
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPresetDialog(false);
                    setPresetName('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Load Preset Dialog */}
      {showLoadDialog && (
        <Card className="shadow-lg border border-border mb-6 bg-card/95">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Load Preset</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {savedPresets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No presets saved yet</p>
              ) : (
                savedPresets.map((preset) => (
                  <div
                    key={preset.name}
                    className="flex items-center justify-between p-3 border border-border rounded-md bg-background hover:bg-accent/10 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{preset.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(preset.timestamp).toLocaleDateString()} {new Date(preset.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => loadPreset(preset.name)}
                      >
                        Load
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm(`Delete preset "${preset.name}"?`)) {
                            deletePreset(preset.name);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => setShowLoadDialog(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Global Settings */}
      <Card className="shadow-lg border border-border mb-6">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Global Settings</h2>
          
          {/* Tempo, Master Volume and Time Signature */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground flex items-center justify-between">
                <span>Tempo (BPM)</span>
                <span className="text-primary font-semibold" data-testid="text-tempo-value">
                  {state.tempo}
                </span>
              </label>
              <Slider
                data-testid="slider-tempo"
                value={[state.tempo]}
                onValueChange={(value) => setState(prev => ({ ...prev, tempo: value[0] }))}
                min={60}
                max={180}
                step={1}
                className="slider-thumb"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground flex items-center justify-between">
                <span>Master Volume</span>
                <span className="text-primary font-semibold">
                  {state.masterVolume}%
                </span>
              </label>
              <Slider
                value={[state.masterVolume]}
                onValueChange={(value) => {
                  setState(prev => ({ ...prev, masterVolume: value[0] }));
                  // Volume is applied via useEffect
                }}
                min={0}
                max={100}
                step={1}
                className="slider-thumb"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Time Signature</label>
              <Select 
                value={state.timeSignature} 
                onValueChange={(value) => {
                  setState(prev => ({ ...prev, timeSignature: value }));
                  setStatus(`Time signature changed to ${value}`);
                }}
              >
                <SelectTrigger data-testid="select-time-signature">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(timeSignatures).map(([key, sig]) => (
                    <SelectItem key={key} value={key}>{sig.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Genre, Scale, and Key */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Genre Style</label>
              <Select
                value={state.genre}
                onValueChange={(value) => {
                  setState(prev => ({ ...prev, genre: value }));
                  const genre = genreStyles[value];
                  setStatus(`Genre: ${genre.name} - ${genre.description}`);
                }}
              >
                <SelectTrigger data-testid="select-genre">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatic">Automatic (Mix)</SelectItem>
                  <SelectItem value="pop">Pop</SelectItem>
                  <SelectItem value="jazz">Jazz</SelectItem>
                  <SelectItem value="hiphop">Hip Hop</SelectItem>
                  <SelectItem value="edm">EDM</SelectItem>
                  <SelectItem value="classical">Classical</SelectItem>
                  <SelectItem value="trap">Trap</SelectItem>
                  <SelectItem value="latin">Latin</SelectItem>
                  <SelectItem value="ballad">Ballad</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Musical Scale</label>
              <Select
                value={state.scale}
                onValueChange={(value) => {
                  setState(prev => ({ ...prev, scale: value }));
                  setStatus(`Scale changed to ${value}`);
                }}
              >
                <SelectTrigger data-testid="select-scale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="minor">Natural Minor</SelectItem>
                  <SelectItem value="pentatonic">Pentatonic</SelectItem>
                  <SelectItem value="blues">Blues</SelectItem>
                  <SelectItem value="dorian">Dorian</SelectItem>
                  <SelectItem value="mixolydian">Mixolydian</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Key</label>
              <Select
                value={state.key}
                onValueChange={(value) => {
                  setState(prev => ({ ...prev, key: value }));
                  setStatus(`Key changed to ${value}`);
                }}
              >
                <SelectTrigger data-testid="select-key">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {keys.map(key => (
                    <SelectItem key={key} value={key}>{key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes per Track */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground flex items-center justify-between">
              <span>Notes per Track</span>
              <span className="text-primary font-semibold" data-testid="text-note-count">
                {state.noteCount}
              </span>
            </label>
            <Slider
              data-testid="slider-note-count"
              value={[state.noteCount]}
              onValueChange={(value) => setState(prev => ({ ...prev, noteCount: value[0] }))}
              min={4}
              max={16}
              step={1}
              className="slider-thumb"
            />
          </div>

          {/* Loop Length */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Loop Length</label>
            <Select 
              value={state.loopLength.toString()} 
              onValueChange={(value) => {
                setState(prev => ({ ...prev, loopLength: parseInt(value) }));
                setStatus(`Loop length set to ${value} bars`);
              }}
            >
              <SelectTrigger data-testid="select-loop-length">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 Bars</SelectItem>
                <SelectItem value="8">8 Bars</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Audio Engine Status */}
          <div className="mt-6 p-4 bg-card/50 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">🎹 Professional Audio Engine</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  High-quality soundfont instruments with reverb & compression
                </p>
              </div>
              {soundfontsLoaded && (
                <div className="flex items-center gap-2 text-green-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium">Ready</span>
                </div>
              )}
            </div>
            {isLoadingSoundfonts && (
              <div className="mt-3 flex items-center gap-2 text-amber-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <p className="text-xs">Loading instruments...</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Multi-Track Step Sequencer */}
      {(state.tracks.bass.hasGenerated || state.tracks.melody.hasGenerated || state.tracks.harmony.hasGenerated) && (
        <Card className="shadow-lg border border-border mb-6">
          <CardContent className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-semibold text-foreground">Step Sequencer (All Tracks)</h4>
                <span className="text-xs text-muted-foreground">
                  {state.loopLength === 4 ? '16 steps (4 bars)' : '32 steps (8 bars)'}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Click any step to toggle note on/off. Right-click loop end marker to reset.
            </p>

            {/* Multi-Track Sequencer Grids */}
            {(['bass', 'melody', 'harmony'] as const).map((seqTrackType) => {
              if (!state.tracks[seqTrackType].hasGenerated) return null;

              const trackColors = {
                bass: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500', label: 'Bass' },
                melody: { bg: 'bg-cyan-500', border: 'border-cyan-500', text: 'text-cyan-500', label: 'Melody' },
                harmony: { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500', label: 'Harmony' }
              };

              const colors = trackColors[seqTrackType];

              return (
                <div key={seqTrackType} className="mb-6">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`text-xs font-semibold ${colors.text}`}>{colors.label}</span>
                    {seqTrackType === 'bass' && state.tracks.bass.customLoopEndStep !== null && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setState(prev => ({
                          ...prev,
                          tracks: {
                            ...prev.tracks,
                            bass: {
                              ...prev.tracks.bass,
                              customLoopEndStep: null
                            }
                          }
                        }))}
                        className="text-xs h-5 px-2"
                      >
                        Reset Loop
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-1" style={{
                    gridTemplateColumns: `repeat(${state.loopLength === 4 ? 16 : 32}, minmax(0, 1fr))`
                  }}>
                    {Array.from({ length: state.loopLength === 4 ? 16 : 32 }).map((_, index) => {
                      // Calculate which note is playing at this step
                      const stepsPerBeat = 4; // 16th note grid
                      const totalSteps = state.loopLength === 4 ? 16 : 32;
                      const sequence = state.tracks[seqTrackType].generatedSequenceWithTiming;

                      // Find if a note starts at this step
                      let currentBeat = 0;
                      let noteAtStep: NoteWithTiming | null = null;
                      let isNoteStart = false;

                      for (let i = 0; i < sequence.length; i++) {
                        const noteData = sequence[i];
                        const noteStartStep = Math.floor(currentBeat * stepsPerBeat);
                        const noteEndStep = Math.floor((currentBeat + noteData.duration) * stepsPerBeat);

                        if (noteStartStep === index) {
                          noteAtStep = noteData;
                          isNoteStart = true;
                          break;
                        } else if (noteStartStep < index && index < noteEndStep) {
                          noteAtStep = noteData;
                          break;
                        }

                        currentBeat += noteData.duration;
                      }

                      // Check if this is the currently playing step (bass only has step indicator)
                      const isCurrentlyPlaying = state.isPlaying && seqTrackType === 'bass' && index === state.tracks.bass.currentStepIndex;

                      // Beat markers (every 4 steps)
                      const isBeatMarker = index % 4 === 0;
                      const isBarMarker = index % 16 === 0;

                      // Loop end marker (bass only)
                      const loopEndStep = seqTrackType === 'bass' ? (state.tracks.bass.customLoopEndStep ?? (totalSteps - 1)) : (totalSteps - 1);
                      const isLoopEnd = seqTrackType === 'bass' && index === loopEndStep;
                      const isOutsideLoop = seqTrackType === 'bass' && index > loopEndStep;

                      return (
                        <div
                          key={index}
                          onClick={() => toggleStep(seqTrackType, index)}
                          className={`
                            h-7 transition-all duration-75 cursor-pointer relative overflow-visible
                            ${noteAtStep && noteAtStep.note !== 'REST'
                              ? isNoteStart
                                ? `${colors.bg} ${colors.border} border-2`
                                : `${colors.bg}/50 ${colors.border}/30 border`
                              : 'bg-card border border-border/30'
                            }
                            ${isBarMarker ? 'border-l-2 border-l-foreground/40' : ''}
                            ${isBeatMarker && !isBarMarker ? 'border-l border-l-foreground/20' : ''}
                            ${isOutsideLoop ? 'opacity-30' : ''}
                            ${isLoopEnd ? 'border-r-4 border-r-accent' : ''}
                            hover:opacity-80 hover:scale-105
                          `}
                          title={`${noteAtStep ? `${noteAtStep.note} (${noteAtStep.duration} beats)` : 'Empty'} - Click to toggle`}
                        >
                          {/* Roland TR-8S style LED position indicator (bass only) */}
                          {isCurrentlyPlaying && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-full flex justify-center pointer-events-none">
                              <div className="relative">
                                {/* Outer glow */}
                                <div className={`absolute inset-0 w-3 h-3 ${colors.bg} rounded-full blur-md animate-pulse`} />
                                {/* LED dot */}
                                <div className={`relative w-3 h-3 ${colors.bg} rounded-full border-2 border-orange-300 shadow-lg shadow-orange-500/80`} />
                              </div>
                            </div>
                          )}
                          {isLoopEnd && (
                            <div className="absolute -top-2 -right-1 w-3 h-3 bg-accent rounded-full border-2 border-background" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Step Numbers */}
            <div className="grid gap-1 mt-1" style={{
              gridTemplateColumns: `repeat(${state.loopLength === 4 ? 16 : 32}, minmax(0, 1fr))`
            }}>
              {Array.from({ length: state.loopLength === 4 ? 16 : 32 }).map((_, index) => (
                <div key={index} className="text-center">
                  {index % 4 === 0 && (
                    <span className="text-[10px] text-muted-foreground">{index / 4 + 1}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Track Sections */}
      <div className="space-y-4 mb-6">
        {(['bass', 'melody', 'harmony'] as const).map((trackType) => (
          <Card key={trackType} className="shadow-lg border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-foreground capitalize">
                    {trackType} Track
                  </h3>
                  <Button
                    variant={state.tracks[trackType].isEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => setState(prev => ({
                      ...prev,
                      tracks: {
                        ...prev.tracks,
                        [trackType]: {
                          ...prev.tracks[trackType],
                          isEnabled: !prev.tracks[trackType].isEnabled
                        }
                      }
                    }))}
                    className="flex items-center gap-2"
                    data-testid={`button-${trackType}-toggle`}
                  >
                    {state.tracks[trackType].isEnabled ? (
                      <><Volume2 className="w-4 h-4" />On</>
                    ) : (
                      <><VolumeX className="w-4 h-4" />Off</>
                    )}
                  </Button>
                </div>
                
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => regenerateSingleTrack(trackType)}
                  disabled={isGenerating}
                  className="flex items-center gap-2"
                  data-testid={`button-generate-${trackType}`}
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Regenerate
                </Button>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center justify-between">
                    <span>Volume</span>
                    <span className="text-primary font-semibold">
                      {Math.round(state.tracks[trackType].volume * 100)}%
                    </span>
                  </label>
                  <Slider
                    value={[state.tracks[trackType].volume]}
                    onValueChange={(value) => setState(prev => ({
                      ...prev,
                      tracks: {
                        ...prev.tracks,
                        [trackType]: {
                          ...prev.tracks[trackType],
                          volume: value[0]
                        }
                      }
                    }))}
                    min={0}
                    max={1}
                    step={0.1}
                    className="slider-thumb"
                    data-testid={`slider-${trackType}-volume`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Octave Range</label>
                  <div className="flex gap-1 items-center text-xs">
                    <Select
                      value={state.tracks[trackType].octaveRange[0].toString()}
                      onValueChange={(value) => {
                        const newMin = parseInt(value);
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
                      }}
                    >
                      <SelectTrigger className="w-12 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(octave => (
                          <SelectItem key={octave} value={octave.toString()}>{octave}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground text-xs">to</span>
                    <Select
                      value={state.tracks[trackType].octaveRange[1].toString()}
                      onValueChange={(value) => {
                        const newMax = parseInt(value);
                        setState(prev => ({
                          ...prev,
                          tracks: {
                            ...prev.tracks,
                            [trackType]: {
                              ...prev.tracks[trackType],
                              octaveRange: [Math.min(prev.tracks[trackType].octaveRange[0], newMax), newMax]
                            }
                          }
                        }));
                      }}
                    >
                      <SelectTrigger className="w-12 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(octave => (
                          <SelectItem key={octave} value={octave.toString()}>{octave}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Sound</label>
                  <Select 
                    value={state.tracks[trackType].synthType} 
                    onValueChange={(value) => {
                      setState(prev => ({
                        ...prev,
                        tracks: {
                          ...prev.tracks,
                          [trackType]: {
                            ...prev.tracks[trackType],
                            synthType: value
                          }
                        }
                      }));
                      setStatus(`${trackType.charAt(0).toUpperCase() + trackType.slice(1)} sound changed to ${synthPresets[value as keyof typeof synthPresets].name}`);
                    }}
                  >
                    <SelectTrigger data-testid={`select-${trackType}-sound`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(getPresetsForTrack(trackType)).map(([key, preset]) => (
                        <SelectItem key={key} value={key}>{preset.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

            </CardContent>
          </Card>
        ))}
      </div>

      {/* Global Playback Options */}
      <Card className="shadow-lg border border-border">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Playback Options</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <Button
                variant={state.isLooping ? "default" : "outline"}
                size="sm"
                onClick={() => setState(prev => ({ ...prev, isLooping: !prev.isLooping }))}
                className="flex items-center gap-2"
                data-testid="button-loop-toggle"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{state.isLooping ? "Loop On" : "Loop Off"}</span>
              </Button>
              <span className="text-xs text-muted-foreground">
                {state.isLooping ? "Tracks will repeat continuously" : "Tracks will play once"}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant={state.metronomeEnabled ? "default" : "outline"}
                size="sm"
                onClick={toggleMetronome}
                className="flex items-center gap-2"
                disabled={!toneLoaded}
                data-testid="button-metronome-toggle"
              >
                <Clock className="w-4 h-4" />
                <span>{state.metronomeEnabled ? "Metronome On" : "Metronome Off"}</span>
              </Button>
              <span className="text-xs text-muted-foreground">
                {state.metronomeEnabled ? "Click track is playing" : "Click track is off"}
              </span>
            </div>
          </div>
          
          {/* Status Display */}
          <div className="text-center text-sm text-muted-foreground mt-6" data-testid="text-status">
            {status}
          </div>
        </CardContent>
      </Card>

      {/* Info Section */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-xs text-muted-foreground">
          <Info className="w-4 h-4" />
          Powered by ELAR MUSIC DEVELOPMENTS • Click Generate to create a new melody
        </div>
      </div>
    </div>
  );
}
