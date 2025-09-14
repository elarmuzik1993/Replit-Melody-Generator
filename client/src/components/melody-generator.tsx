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

interface MelodyState {
  tempo: number;
  scale: string;
  key: string;
  noteCount: number;
  isPlaying: boolean;
  generatedMelody: string[];
  currentNoteIndex: number;
  isLooping: boolean;
  metronomeEnabled: boolean;
  timeSignature: string;
  soundType: string;
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

// Scale degree weights for more musical melodies
// Higher weights = more likely to be chosen
const scaleWeights = {
  major: [4.0, 1.0, 2.5, 1.5, 3.0, 1.5, 1.0], // 1=Tonic, 3=Mediant, 5=Dominant get higher weights
  minor: [4.0, 1.0, 2.5, 1.5, 3.0, 1.0, 2.0], // Similar but 7th (leading tone) more likely
  pentatonic: [4.0, 2.0, 2.5, 3.0, 2.0],       // More balanced for pentatonic
  blues: [3.5, 2.5, 2.0, 1.5, 2.5, 2.0],       // Blues scale has different emphasis
  dorian: [4.0, 1.0, 2.5, 1.5, 3.0, 2.0, 1.5], // Similar to minor but 6th emphasized
  mixolydian: [4.0, 1.0, 2.5, 1.5, 3.0, 1.5, 2.0] // Similar to major but 7th emphasized
};

// Synthesizer sound presets
const synthPresets = {
  basic: {
    name: "Basic Synth",
    config: () => new window.Tone.Synth().toDestination()
  },
  electric_piano: {
    name: "Electric Piano",
    config: () => new window.Tone.FMSynth({
      harmonicity: 2,
      modulationIndex: 20,
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 2, sustain: 0.1, release: 2 },
      modulation: { type: "square" },
      modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 }
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
  pluck: {
    name: "Plucked String",
    config: () => new window.Tone.PluckSynth({
      attackNoise: 1,
      dampening: 4000,
      resonance: 0.7
    }).toDestination()
  }
};

// Weighted random selection function
const weightedRandomSelect = (items: any[], weights: number[]): any => {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  
  // Fallback to last item if something goes wrong
  return items[items.length - 1];
};

// Calculate semitone distance between two notes
const calculateInterval = (note1: string, note2: string): number => {
  // Extract note name and octave
  const getNotePitch = (note: string) => {
    const noteName = note.slice(0, -1); // Remove octave
    const octave = parseInt(note.slice(-1)); // Get octave
    const noteIndex = keys.indexOf(noteName);
    return noteIndex + (octave * 12);
  };
  
  const pitch1 = getNotePitch(note1);
  const pitch2 = getNotePitch(note2);
  return Math.abs(pitch2 - pitch1);
};

// Apply stepwise motion bias to weights
const applyStepwiseBias = (baseWeights: number[], previousNote: string, currentScale: number[], keyIndex: number, octave: number): number[] => {
  return baseWeights.map((weight, index) => {
    // Calculate what the current note would be
    const semitone = currentScale[index];
    const noteIndex = (keyIndex + semitone) % 12;
    const currentNote = keys[noteIndex] + octave;
    
    // Calculate interval from previous note
    const interval = calculateInterval(previousNote, currentNote);
    
    // Apply bias based on interval size
    let biasFactor = 1.0;
    if (interval <= 2) {
      // Small intervals (1-2 semitones): strong preference
      biasFactor = 3.0;
    } else if (interval <= 4) {
      // Medium intervals (3-4 semitones): moderate preference  
      biasFactor = 2.0;
    } else if (interval <= 7) {
      // Large intervals (5-7 semitones): slight preference
      biasFactor = 1.2;
    } else {
      // Very large intervals (8+ semitones): discourage
      biasFactor = 0.3;
    }
    
    return weight * biasFactor;
  });
};

export default function MelodyGeneratorComponent() {
  const [state, setState] = useState<MelodyState>({
    tempo: 120,
    scale: "major",
    key: "C",
    noteCount: 8,
    isPlaying: false,
    generatedMelody: [],
    currentNoteIndex: -1,
    isLooping: false,
    metronomeEnabled: false,
    timeSignature: "4/4",
    soundType: "basic",
    hasGeneratedMelody: false
  });

  const [status, setStatus] = useState("Loading audio engine...");
  const [toneLoaded, setToneLoaded] = useState(false);
  const synthRef = useRef<any>(null);
  const sequenceRef = useRef<any>(null);
  const metronomeRef = useRef<any>(null);
  const metronomeSequenceRef = useRef<any>(null);

  // Initialize synthesizer based on selected sound type
  const initializeSynth = () => {
    if (!toneLoaded) return;
    
    // Dispose of existing synth
    if (synthRef.current) {
      synthRef.current.dispose();
    }
    
    // Create new synth based on selected sound type
    const preset = synthPresets[state.soundType as keyof typeof synthPresets];
    synthRef.current = preset.config();
  };

  // Convert note name to MIDI note number
  const noteToMidi = (noteName: string): number => {
    const noteMap: { [key: string]: number } = {
      'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
      'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
    };
    
    const note = noteName.slice(0, -1); // Remove octave
    const octave = parseInt(noteName.slice(-1)); // Get octave
    
    return noteMap[note] + (octave + 1) * 12; // MIDI octave offset
  };

  // Export melody as MIDI file
  const exportMIDI = () => {
    if (state.generatedMelody.length === 0) {
      setStatus("Please generate a melody first!");
      return;
    }

    try {
      // Create MIDI track
      const track = new MidiWriter.Track();
      
      // Set tempo (convert BPM to microseconds per quarter note)
      track.setTempo(state.tempo);
      
      // Add time signature
      const [numerator, denominator] = state.timeSignature.split('/').map(Number);
      track.setTimeSignature(numerator, denominator, 24, 8);
      
      // Convert melody notes to MIDI events
      state.generatedMelody.forEach((noteName) => {
        const midiNote = noteToMidi(noteName);
        const noteEvent = new MidiWriter.NoteEvent({
          pitch: midiNote,
          duration: '8', // Eighth note duration (matches our playback)
          velocity: 64   // Medium velocity
        });
        track.addEvent(noteEvent);
      });

      // Create MIDI file
      const write = new MidiWriter.Writer(track);
      const midiData = write.dataUri();
      
      // Create download link
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

  // Load Tone.js
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/tone@latest/build/Tone.js';
    script.onload = () => {
      setToneLoaded(true);
      setStatus("Ready to generate melody");
      // Initialize metronome with a simple click sound
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

  // Initialize synthesizer when Tone.js loads or sound type changes
  useEffect(() => {
    initializeSynth();
  }, [toneLoaded, state.soundType]);

  // Generate melody based on current settings (for user-initiated generation)
  const generateMelody = () => {
    setStatus("Generating melody...");
    
    const scaleNotes = scales[state.scale as keyof typeof scales];
    const baseNote = state.key;
    const octave = 4;
    
    // Get base scale weights for more musical generation
    const baseWeights = scaleWeights[state.scale as keyof typeof scaleWeights];
    const keyIndex = keys.indexOf(baseNote);
    
    const melody: string[] = [];
    
    for (let i = 0; i < state.noteCount; i++) {
      let currentWeights = baseWeights;
      
      // Apply stepwise motion bias for all notes after the first
      if (i > 0 && melody[i - 1]) {
        currentWeights = applyStepwiseBias(
          baseWeights, 
          melody[i - 1], 
          scaleNotes, 
          keyIndex, 
          octave
        );
      }
      
      // Use weighted selection with stepwise bias
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

  // Generate initial melody on mount (doesn't set hasGeneratedMelody flag)
  const generateInitialMelody = () => {
    const scaleNotes = scales[state.scale as keyof typeof scales];
    const baseNote = state.key;
    const octave = 4;
    
    // Get base scale weights for more musical generation
    const baseWeights = scaleWeights[state.scale as keyof typeof scaleWeights];
    const keyIndex = keys.indexOf(baseNote);
    
    const melody: string[] = [];
    
    for (let i = 0; i < state.noteCount; i++) {
      let currentWeights = baseWeights;
      
      // Apply stepwise motion bias for all notes after the first
      if (i > 0 && melody[i - 1]) {
        currentWeights = applyStepwiseBias(
          baseWeights, 
          melody[i - 1], 
          scaleNotes, 
          keyIndex, 
          octave
        );
      }
      
      // Use weighted selection with stepwise bias
      const selectedScaleIndex = weightedRandomSelect(
        scaleNotes.map((_, index) => index),
        currentWeights
      );
      
      const semitone = scaleNotes[selectedScaleIndex];
      const noteIndex = (keyIndex + semitone) % 12;
      const newNote = keys[noteIndex] + octave;
      melody.push(newNote);
    }

    // Don't set hasGeneratedMelody flag for initial melody
    setState(prev => ({ ...prev, generatedMelody: melody, currentNoteIndex: -1 }));
    setStatus("Ready to generate melody");
  };

  // Start audio context and play melody
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
      // Start audio context
      if (window.Tone.context.state !== 'running') {
        await window.Tone.start();
      }

      setState(prev => ({ ...prev, isPlaying: true, currentNoteIndex: -1 }));
      setStatus("Playing melody...");

      // Stop any existing sequence
      if (sequenceRef.current) {
        sequenceRef.current.stop();
        sequenceRef.current.dispose();
      }

      // Create sequence with manual index tracking
      let currentNoteIndex = 0;
      sequenceRef.current = new window.Tone.Sequence(
        (time: number, note: string) => {
          // Update current note index for visual feedback
          setState(prev => ({ ...prev, currentNoteIndex: currentNoteIndex }));
          
          // Play the note
          synthRef.current.triggerAttackRelease(note, "8n", time);
          
          // Increment index for next note
          currentNoteIndex++;
          
          // Handle end of sequence for non-looping mode
          if (!state.isLooping && currentNoteIndex >= state.generatedMelody.length) {
            setTimeout(() => {
              stopPlayback();
            }, 500); // Give time for the last note to play
          } else if (state.isLooping && currentNoteIndex >= state.generatedMelody.length) {
            // Reset index for looping
            currentNoteIndex = 0;
          }
        },
        state.generatedMelody,
        "8n"
      );

      // Set looping based on state
      sequenceRef.current.loop = state.isLooping;

      // Set tempo
      window.Tone.Transport.bpm.value = state.tempo;
      
      // Start sequence
      sequenceRef.current.start();
      window.Tone.Transport.start();

    } catch (error) {
      console.error("Playback error:", error);
      setStatus("Error playing melody. Please try again.");
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  };

  // Stop playback
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
      // Ensure state is reset regardless of errors
      setState(prev => ({ ...prev, isPlaying: false, currentNoteIndex: -1 }));
      setStatus("Playback complete");
    }
  };

  // Toggle playback
  const togglePlayback = () => {
    if (state.isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  // Start metronome
  const startMetronome = () => {
    if (!toneLoaded || !metronomeRef.current) return;

    try {
      // Stop any existing metronome sequence
      if (metronomeSequenceRef.current) {
        metronomeSequenceRef.current.stop();
        metronomeSequenceRef.current.dispose();
      }

      // Get time signature pattern
      const timeSignature = timeSignatures[state.timeSignature as keyof typeof timeSignatures];
      
      // Create metronome sequence with dynamic pattern
      metronomeSequenceRef.current = new window.Tone.Sequence(
        (time: number, note: string) => {
          // Play metronome click with dynamic pitches
          metronomeRef.current.triggerAttackRelease(note, "32n", time);
        },
        timeSignature.pattern,
        timeSignature.noteValue
      );

      // Set tempo
      window.Tone.Transport.bpm.value = state.tempo;
      
      // Start metronome
      metronomeSequenceRef.current.loop = true;
      metronomeSequenceRef.current.start();
      
      // Only start transport if it's not already running
      if (window.Tone.Transport.state !== "started") {
        window.Tone.Transport.start();
      }

    } catch (error) {
      console.error("Metronome error:", error);
    }
  };

  // Stop metronome
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

  // Toggle metronome
  const toggleMetronome = () => {
    const newEnabled = !state.metronomeEnabled;
    setState(prev => ({ ...prev, metronomeEnabled: newEnabled }));
    
    if (newEnabled) {
      startMetronome();
    } else {
      stopMetronome();
    }
  };

  // Generate initial melody on mount
  useEffect(() => {
    generateInitialMelody();
  }, []);

  // Update note indicators when noteCount changes
  useEffect(() => {
    // Skip initial mount - let generateInitialMelody handle first render
    if (state.generatedMelody.length === 0) return;
    
    if (state.generatedMelody.length !== state.noteCount) {
      // Use appropriate generator based on whether user has explicitly generated
      state.hasGeneratedMelody ? generateMelody() : generateInitialMelody();
    }
  }, [state.noteCount, state.hasGeneratedMelody]);

  // Update metronome tempo when tempo changes
  useEffect(() => {
    if (state.metronomeEnabled && metronomeSequenceRef.current && window.Tone) {
      window.Tone.Transport.bpm.value = state.tempo;
    }
  }, [state.tempo, state.metronomeEnabled]);

  // Restart metronome when time signature changes
  useEffect(() => {
    if (state.metronomeEnabled && toneLoaded) {
      stopMetronome();
      startMetronome();
    }
  }, [state.timeSignature]);

  return (
    <div className="w-full max-w-2xl">
      {/* Header Section */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-2">MELODY GENERATOR</h1>
        <p className="text-muted-foreground">Create beautiful melodies with simple controls</p>
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
            
            {/* Time Signature Selection */}
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

            {/* Placeholder for future controls */}
            <div></div>

          </div>

          {/* Scale and Key Selection */}
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Scale Selection */}
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

            {/* Key Selection */}
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

            {/* Sound Selection */}
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

          {/* Control Buttons */}
          <div className="flex gap-4 pt-4">
            <Button
              variant="secondary"
              onClick={generateMelody}
              className="flex-1"
              data-testid="button-generate"
            >
              Generate New Melody
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
