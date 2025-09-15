import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, Info, RotateCcw, Clock, Download } from "lucide-react";
// @ts-ignore - midi-writer-js doesn't have TypeScript definitions
import MidiWriter from "midi-writer-js";

// Import Tone.js
declare global {
  interface Window {
    Tone: any;
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
  const synthRef = useRef<any>(null);
  const sequenceRef = useRef<any>(null);
  const metronomeRef = useRef<any>(null);
  const metronomeSequenceRef = useRef<any>(null);

  const initializeSynth = () => {
    if (!toneLoaded) return;
    if (synthRef.current) {
      synthRef.current.dispose();
    }
    const preset = synthPresets[state.soundType as keyof typeof synthPresets];
    synthRef.current = preset.config();
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
    if (state.generatedMelody.length === 0) {
      setStatus("Please generate a melody first!");
      return;
    }

    try {
      const track = new MidiWriter.Track();
      track.setTempo(state.tempo);
      const [numerator, denominator] = state.timeSignature.split('/').map(Number);
      track.setTimeSignature(numerator, denominator, 24, 8);

      state.generatedMelody.forEach((noteName) => {
        const midiNote = noteToMidi(noteName);
        const noteEvent = new MidiWriter.NoteEvent({
          pitch: midiNote,
          duration: '8',
          velocity: 64
        });
        track.addEvent(noteEvent);
      });

      const write = new MidiWriter.Writer(track);
      const midiData = write.dataUri();
      const link = document.createElement('a');
      link.href = midiData;
      link.download = `melody_${state.key}_${state.scale}_${state.tempo}bpm.mid`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatus("MIDI file downloaded successfully!");
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
    initializeSynth();
  }, [toneLoaded, state.soundType]);

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
  const generateTrack = (trackType: 'bass' | 'melody' | 'harmony'): string[] => {
    const scaleNotes = scales[state.scale as keyof typeof scales];
    const baseNote = state.key;
    const trackData = state.tracks[trackType];
    const [minOctave, maxOctave] = trackData.octaveRange;
    const baseWeights = scaleWeights[trackType][state.scale as keyof typeof scaleWeights[typeof trackType]] ?? Array(scaleNotes.length).fill(1);
    const keyIndex = keys.indexOf(baseNote);
    const sequence: string[] = [];

    for (let i = 0; i < state.noteCount; i++) {
      let currentWeights = baseWeights;
      
      // Apply stepwise bias for more musical progressions (especially for melody)
      if (i > 0 && sequence[i - 1] && trackType === 'melody') {
        currentWeights = applyStepwiseBias(
          baseWeights, 
          sequence[i - 1], 
          scaleNotes, 
          keyIndex, 
          minOctave // Use the track's octave range
        );
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

    const newTracks = {
      bass: generateTrack('bass'),
      melody: generateTrack('melody'),
      harmony: generateTrack('harmony')
    };

    setState(prev => ({
      ...prev,
      tracks: {
        bass: { ...prev.tracks.bass, generatedSequence: newTracks.bass, hasGenerated: true, currentNoteIndex: -1 },
        melody: { ...prev.tracks.melody, generatedSequence: newTracks.melody, hasGenerated: true, currentNoteIndex: -1 },
        harmony: { ...prev.tracks.harmony, generatedSequence: newTracks.harmony, hasGenerated: true, currentNoteIndex: -1 }
      },
      // Mirror melody track to legacy fields for backward compatibility
      generatedMelody: newTracks.melody,
      currentNoteIndex: -1,
      hasGeneratedMelody: true
    }));

    setStatus("All tracks generated! Ready to play.");
  };

  const startPlayback = async () => {
    if (!toneLoaded || !synthRef.current) {
      setStatus("Audio engine not loaded yet. Please wait...");
      return;
    }

    if (state.generatedMelody.length === 0) {
      setStatus("Please generate a melody first!");
      return;
    }

    try {
      if (window.Tone.context.state !== 'running') {
        await window.Tone.start();
      }

      setState(prev => ({ ...prev, isPlaying: true, currentNoteIndex: -1 }));
      setStatus("Playing melody...");

      if (sequenceRef.current) {
        sequenceRef.current.stop();
        sequenceRef.current.dispose();
      }

      let currentNoteIndex = 0;
      sequenceRef.current = new window.Tone.Sequence(
        (time: number, note: string) => {
          setState(prev => ({ ...prev, currentNoteIndex: currentNoteIndex }));
          synthRef.current.triggerAttackRelease(note, "8n", time);
          currentNoteIndex++;
          if (!state.isLooping && currentNoteIndex >= state.generatedMelody.length) {
            setTimeout(() => {
              stopPlayback();
            }, 500);
          } else if (state.isLooping && currentNoteIndex >= state.generatedMelody.length) {
            currentNoteIndex = 0;
          }
        },
        state.generatedMelody,
        "8n"
      );

      sequenceRef.current.loop = state.isLooping;
      window.Tone.Transport.bpm.value = state.tempo;
      sequenceRef.current.start();
      window.Tone.Transport.start();

    } catch (error) {
      console.error("Playback error:", error);
      setStatus("Error playing melody. Please try again.");
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  };

  const stopPlayback = () => {
    try {
      if (sequenceRef.current) {
        sequenceRef.current.stop();
        sequenceRef.current.dispose();
        sequenceRef.current = null;
      }

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
        <h1 className="text-3xl font-semibold text-foreground mb-2">MELODY GENERATOR</h1>
        <p className="text-muted-foreground">Create beautiful melodies with simple controls</p>
      </div>

      {/* ===== MOVED: Control Buttons (now under the header) ===== */}
      <div className="flex gap-4 mb-6">
        <Button
          variant="secondary"
          onClick={generateMelody}
          className="flex-1"
          data-testid="button-generate"
        >
          Generate
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

      {/* Main Control Panel */}
      <Card className="shadow-lg border border-border">
        <CardContent className="p-8 space-y-8">

          {/* Tempo Control Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground flex items-center justify-between">
              <span>Tempo (BPM)</span>
              <span className="text-primary font-semibold" data-testid="text-tempo-value">
                {state.tempo}
              </span>
            </label>
            <div className="relative">
              <Slider
                data-testid="slider-tempo"
                value={[state.tempo]}
                onValueChange={(value) => setState(prev => ({ ...prev, tempo: value[0] }))}
                min={60}
                max={180}
                step={1}
                className="slider-thumb"
                thumbProps={{ 
                  'data-testid': 'thumb-tempo', 
                  'aria-label': 'Tempo (BPM)'
                } as any}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>60</span>
                <span>120</span>
                <span>180</span>
              </div>
            </div>
          </div>

          {/* Time Signature and Tempo Grid */}
          <div className="grid md:grid-cols-2 gap-6">
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
            <div></div>
          </div>

          {/* Scale and Key Selection */}
          <div className="grid md:grid-cols-2 gap-6">
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
              <label className="text-sm font-medium text-foreground">Sound</label>
              <Select 
                value={state.soundType} 
                onValueChange={(value) => {
                  setState(prev => ({ ...prev, soundType: value }));
                  setStatus(`Sound changed to ${synthPresets[value as keyof typeof synthPresets].name}`);
                }}
              >
                <SelectTrigger data-testid="select-sound">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(synthPresets).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>{preset.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Number of Notes Control */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground flex items-center justify-between">
              <span>Number of Notes</span>
              <span className="text-primary font-semibold" data-testid="text-note-count">
                {state.noteCount}
              </span>
            </label>
            <div className="relative">
              <Slider
                data-testid="slider-note-count"
                value={[state.noteCount]}
                onValueChange={(value) => setState(prev => ({ ...prev, noteCount: value[0] }))}
                min={4}
                max={16}
                step={1}
                className="slider-thumb"
                thumbProps={{ 
                  'data-testid': 'thumb-note-count', 
                  'aria-label': 'Number of Notes'
                } as any}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>4</span>
                <span>8</span>
                <span>12</span>
                <span>16</span>
              </div>
            </div>
          </div>

          {/* Visual Note Indicators */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Melody Preview</label>
            <div className="flex flex-wrap gap-2" data-testid="note-indicators">
              {Array.from({ length: state.noteCount }, (_, index) => (
                <div
                  key={index}
                  className={`note-indicator w-8 h-8 bg-muted rounded-full flex items-center justify-center text-xs font-medium text-muted-foreground ${
                    state.currentNoteIndex === index ? 'active' : ''
                  }`}
                  data-testid={`note-indicator-${index}`}
                >
                  {index + 1}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Notes will highlight as they play</p>
          </div>

          {/* Loop Control */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Playback Options</label>
            <div className="flex flex-col gap-3">
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
                  {state.isLooping ? "Melody will repeat continuously" : "Melody will play once"}
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
          </div>

          {/* Status Display */}
          <div className="text-center text-sm text-muted-foreground" data-testid="text-status">
            {status}
          </div>

        </CardContent>
      </Card>

      {/* Info Section */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-xs text-muted-foreground">
          <Info className="w-4 h-4" />
          Powered by ELAR MUSIC • Click Generate to create a new melody
        </div>
      </div>
    </div>
  );
}
