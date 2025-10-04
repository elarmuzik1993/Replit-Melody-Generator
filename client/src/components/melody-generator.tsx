import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, Info, RotateCcw, Clock, Download, Volume2, VolumeX, RefreshCw } from "lucide-react";
// @ts-ignore - midi-writer-js doesn't have TypeScript definitions
import MidiWriter from "midi-writer-js";

// Import Tone.js
declare global {
  interface Window {
    Tone: any;
  }
}

// Declare MidiWriter types
declare namespace MidiWriter {
  class Track {
    setTempo(tempo: number): void;
    setTimeSignature(numerator: number, denominator: number, clocks?: number, notes?: number): void;
    addEvent(event: any): void;
  }
  
  class NoteEvent {
    constructor(options: {
      pitch?: number | number[];
      duration?: string;
      velocity?: number;
      channel?: number;
      rest?: boolean;
    });
  }
  
  class ProgramChangeEvent {
    constructor(options: {
      instrument: number;
      channel: number;
    });
  }
  
  class Writer {
    constructor(tracks: Track[]);
    buildFile(): Uint8Array;
    dataUri(): string;
  }
}

interface TrackData {
  generatedSequence: string[];
  isEnabled: boolean;
  volume: number;
  synthType: string;
  currentNoteIndex: number;
  hasGenerated: boolean;
  octaveRange: [number, number];
}

interface MultiTrackState {
  // Global settings (shared across tracks)
  tempo: number;
  key: string;
  scale: string;
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
  basic: {
    name: "Basic Synth",
    config: () => new window.Tone.Synth().toDestination()
  },
    electric_piano: {
      name: "Electric Piano",
      config: () =>
        new window.Tone.FMSynth({
          harmonicity: 3, // ratio between carrier & modulator
          modulationIndex: 10, // amount of modulation (brightness)
          oscillator: {
            type: "sine"
          },
          envelope: {
            attack: 0.01,
            decay: 1.2,
            sustain: 0.3,
            release: 1.8
          },
          modulation: {
            type: "sine"
          },
          modulationEnvelope: {
            attack: 0.002,
            decay: 0.3,
            sustain: 0.2,
            release: 0.8
          }
        }).toDestination()
  },
  sawtooth: {
    name: "Sawtooth Wave",
    config: () => new window.Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }
    }).toDestination()
  },
  square: {
    name: "Square Wave",
    config: () => new window.Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }
    }).toDestination()
  },
  sine: {
    name: "Sine Wave",
    config: () => new window.Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }
    }).toDestination()
  },
  bell: {
    name: "Bell",
    config: () =>
      new window.Tone.FMSynth({
        harmonicity: 5,          // wide spacing between carrier & modulator
        modulationIndex: 12,     // controls brightness/clang
        oscillator: { type: "sine" },
        envelope: {
          attack: 0.001,
          decay: 3.5,
          sustain: 0.1,
          release: 4
        },
        modulation: { type: "sine" },
        modulationEnvelope: {
          attack: 0.001,
          decay: 2.5,
          sustain: 0,
          release: 3
        }
      }).toDestination()
  },
  // Bass synths
  bass_synth: {
    name: "Bass Synth",
    config: () => new window.Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.8 }
    }).toDestination()
  },
  sub_bass: {
    name: "Sub Bass",
    config: () => new window.Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.8, release: 1.2 }
    }).toDestination()
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
          ['bass_synth', 'sub_bass'].includes(key)
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
          !['bass_synth', 'sub_bass', 'pad_synth', 'string_pad'].includes(key)
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
    scale: "major",
    key: "C",
    timeSignature: "4/4",
    isPlaying: false,
    isLooping: true,
    metronomeEnabled: false,
    loopLength: 4, // 4 bars
    tracks: {
      bass: {
        generatedSequence: [],
        isEnabled: true,
        volume: 0.8,
        synthType: "bass_synth",
        currentNoteIndex: -1,
        hasGenerated: false,
        octaveRange: [2, 3]
      },
      melody: {
        generatedSequence: [],
        isEnabled: true,
        volume: 0.7,
        synthType: "electric_piano",
        currentNoteIndex: -1,
        hasGenerated: false,
        octaveRange: [4, 5]
      },
      harmony: {
        generatedSequence: [],
        isEnabled: true,
        volume: 0.5,
        synthType: "pad_synth",
        currentNoteIndex: -1,
        hasGenerated: false,
        octaveRange: [4, 6]
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
  const [toneLoaded, setToneLoaded] = useState(false);
  
  // Three separate synth instances for each track
  const bassSynthRef = useRef<any>(null);
  const melodySynthRef = useRef<any>(null);
  const harmonySynthRef = useRef<any>(null);
  
  // Three separate sequence instances for synchronized playback
  const bassSequenceRef = useRef<any>(null);
  const melodySequenceRef = useRef<any>(null);
  const harmonySequenceRef = useRef<any>(null);
  
  const metronomeRef = useRef<any>(null);
  const metronomeSequenceRef = useRef<any>(null);

  const initializeSynths = () => {
    if (!toneLoaded) return;
    
    // Dispose existing synths
    if (bassSynthRef.current) bassSynthRef.current.dispose();
    if (melodySynthRef.current) melodySynthRef.current.dispose();
    if (harmonySynthRef.current) harmonySynthRef.current.dispose();
    
    // Create bass synth using track-specific preset
    const bassPreset = synthPresets[state.tracks.bass.synthType as keyof typeof synthPresets];
    bassSynthRef.current = bassPreset.config();
    bassSynthRef.current.volume.value = window.Tone.gainToDb(state.tracks.bass.volume) - 6;
    
    // Create melody synth using track-specific preset
    const melodyPreset = synthPresets[state.tracks.melody.synthType as keyof typeof synthPresets];
    melodySynthRef.current = melodyPreset.config();
    melodySynthRef.current.volume.value = window.Tone.gainToDb(state.tracks.melody.volume);
    
    // Create harmony synth using track-specific preset
    const harmonyPreset = synthPresets[state.tracks.harmony.synthType as keyof typeof synthPresets];
    harmonySynthRef.current = harmonyPreset.config();
    harmonySynthRef.current.volume.value = window.Tone.gainToDb(state.tracks.harmony.volume) - 8;
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

  useEffect(() => {
    initializeSynths();
  }, [toneLoaded, state.tracks.melody.synthType, state.tracks.bass.synthType, state.tracks.harmony.synthType]);

  // Update synth volumes dynamically when state changes
  useEffect(() => {
    if (!toneLoaded) return;
    
    if (bassSynthRef.current) {
      bassSynthRef.current.volume.value = window.Tone.gainToDb(state.tracks.bass.volume) - 6;
    }
    if (melodySynthRef.current) {
      melodySynthRef.current.volume.value = window.Tone.gainToDb(state.tracks.melody.volume);
    }
    if (harmonySynthRef.current) {
      harmonySynthRef.current.volume.value = window.Tone.gainToDb(state.tracks.harmony.volume) - 8;
    }
  }, [state.tracks.bass.volume, state.tracks.melody.volume, state.tracks.harmony.volume, toneLoaded]);

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

  const generateAllTracks = () => {
    setStatus("Generating all tracks...");

    // Generate in order: bass, melody, then harmony (so harmony can reference melody)
    const bassTrack = generateTrack('bass');
    const melodyTrack = generateTrack('melody');
    const harmonyTrack = generateTrack('harmony', melodyTrack); // Pass melody for complementary intervals

    setState(prev => ({
      ...prev,
      tracks: {
        bass: { ...prev.tracks.bass, generatedSequence: bassTrack, hasGenerated: true, currentNoteIndex: -1 },
        melody: { ...prev.tracks.melody, generatedSequence: melodyTrack, hasGenerated: true, currentNoteIndex: -1 },
        harmony: { ...prev.tracks.harmony, generatedSequence: harmonyTrack, hasGenerated: true, currentNoteIndex: -1 }
      },
      // Mirror melody track to legacy fields for backward compatibility
      generatedMelody: melodyTrack,
      currentNoteIndex: -1,
      hasGeneratedMelody: true
    }));

    setStatus("All tracks generated! Ready to play.");
  };

  const startPlayback = async () => {
    if (!toneLoaded || !bassSynthRef.current || !melodySynthRef.current || !harmonySynthRef.current) {
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

      // Create synchronized sequences for each track with proper step counters
      if (state.tracks.bass.generatedSequence.length > 0 && state.tracks.bass.isEnabled) {
        let bassIndex = 0;
        const bassSequenceLength = state.tracks.bass.generatedSequence.length;
        bassSequenceRef.current = new window.Tone.Sequence(
          (time: number, note: string) => {
            // Update bass track visual indicator
            setState(prev => ({
              ...prev,
              tracks: {
                ...prev.tracks,
                bass: {
                  ...prev.tracks.bass,
                  currentNoteIndex: bassIndex
                }
              }
            }));
            if (note && note !== 'rest') {
              bassSynthRef.current.triggerAttackRelease(note, "8n", time);
            }
            bassIndex = (bassIndex + 1) % bassSequenceLength;
          },
          state.tracks.bass.generatedSequence,
          "8n"
        );
        bassSequenceRef.current.loop = state.isLooping;
      }

      if (state.tracks.melody.generatedSequence.length > 0 && state.tracks.melody.isEnabled) {
        let melodyIndex = 0;
        const melodySequenceLength = state.tracks.melody.generatedSequence.length;
        melodySequenceRef.current = new window.Tone.Sequence(
          (time: number, note: string) => {
            // Update melody track visual indicator
            setState(prev => ({
              ...prev,
              tracks: {
                ...prev.tracks,
                melody: {
                  ...prev.tracks.melody,
                  currentNoteIndex: melodyIndex
                }
              }
            }));
            if (note && note !== 'rest') {
              melodySynthRef.current.triggerAttackRelease(note, "8n", time);
            }
            melodyIndex = (melodyIndex + 1) % melodySequenceLength;
          },
          state.tracks.melody.generatedSequence,
          "8n"
        );
        melodySequenceRef.current.loop = state.isLooping;
      }

      if (state.tracks.harmony.generatedSequence.length > 0 && state.tracks.harmony.isEnabled) {
        let harmonyIndex = 0;
        const harmonySequenceLength = state.tracks.harmony.generatedSequence.length;
        harmonySequenceRef.current = new window.Tone.Sequence(
          (time: number, note: string) => {
            // Update harmony track visual indicator
            setState(prev => ({
              ...prev,
              tracks: {
                ...prev.tracks,
                harmony: {
                  ...prev.tracks.harmony,
                  currentNoteIndex: harmonyIndex
                }
              }
            }));
            if (note && note !== 'rest') {
              harmonySynthRef.current.triggerAttackRelease(note, "8n", time);
            }
            harmonyIndex = (harmonyIndex + 1) % harmonySequenceLength;
          },
          state.tracks.harmony.generatedSequence,
          "8n"
        );
        harmonySequenceRef.current.loop = state.isLooping;
      }

      // Set tempo and start all sequences synchronously
      window.Tone.Transport.bpm.value = state.tempo;
      
      // Start all sequences simultaneously for perfect sync
      if (bassSequenceRef.current) bassSequenceRef.current.start();
      if (melodySequenceRef.current) melodySequenceRef.current.start();
      if (harmonySequenceRef.current) harmonySequenceRef.current.start();
      
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

      // Stop and clean up Transport
      if (window.Tone && window.Tone.Transport) {
        window.Tone.Transport.stop();
        window.Tone.Transport.cancel();
      }
    } catch (error) {
      console.error("Error during playback cleanup:", error);
    } finally {
      setState(prev => ({ ...prev, isPlaying: false, currentNoteIndex: -1 }));
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
  }, []);

  useEffect(() => {
    if (state.generatedMelody.length === 0) return;
    if (state.generatedMelody.length !== state.noteCount) {
      state.hasGeneratedMelody ? generateMelody() : generateInitialMelody();
    }
  }, [state.noteCount, state.hasGeneratedMelody]);

  useEffect(() => {
    if (state.metronomeEnabled && metronomeSequenceRef.current && window.Tone) {
      window.Tone.Transport.bpm.value = state.tempo;
    }
  }, [state.tempo, state.metronomeEnabled]);

  useEffect(() => {
    if (state.metronomeEnabled && toneLoaded) {
      stopMetronome();
      startMetronome();
    }
  }, [state.timeSignature]);

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
          variant="secondary"
          onClick={generateAllTracks}
          className="flex-1"
          data-testid="button-generate-all"
        >
          Generate All Tracks
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

      {/* Global Settings */}
      <Card className="shadow-lg border border-border mb-6">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Global Settings</h2>
          
          {/* Tempo and Time Signature */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
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

          {/* Scale, Key, and Note Count */}
          <div className="grid md:grid-cols-3 gap-6">
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
        </CardContent>
      </Card>

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
                  onClick={() => {
                    setStatus(`Generating ${trackType} track...`);
                    const newSequence = generateTrack(trackType, trackType === 'harmony' ? state.tracks.melody.generatedSequence : undefined);
                    setState(prev => ({
                      ...prev,
                      tracks: {
                        ...prev.tracks,
                        [trackType]: {
                          ...prev.tracks[trackType],
                          generatedSequence: newSequence,
                          hasGenerated: true,
                          currentNoteIndex: -1
                        }
                      }
                    }));
                    setStatus(`${trackType} track generated!`);
                  }}
                  className="flex items-center gap-2"
                  data-testid={`button-generate-${trackType}`}
                >
                  <RefreshCw className="w-4 h-4" />
                  Generate
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
                  <div className="text-sm text-muted-foreground">
                    {state.tracks[trackType].octaveRange[0]} - {state.tracks[trackType].octaveRange[1]}
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

              {/* Track Preview */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Track Preview</label>
                <div className="flex flex-wrap gap-2" data-testid={`${trackType}-note-indicators`}>
                  {state.tracks[trackType].hasGenerated ? (
                    Array.from({ length: state.tracks[trackType].generatedSequence.length }, (_, index) => (
                      <div
                        key={index}
                        className={`note-indicator w-8 h-8 bg-muted rounded-full flex items-center justify-center text-xs font-medium text-muted-foreground ${
                          state.tracks[trackType].currentNoteIndex === index ? 'active' : ''
                        }`}
                        data-testid={`${trackType}-note-indicator-${index}`}
                      >
                        {index + 1}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">Generate track to see preview</div>
                  )}
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
