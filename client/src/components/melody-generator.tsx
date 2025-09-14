import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, Info, RotateCcw, Clock } from "lucide-react";

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
  "4/4": { name: "4/4 (Common)", pattern: ["C6", "C5", "C5", "C5"], noteValue: "4n" },
  "3/4": { name: "3/4 (Waltz)", pattern: ["C6", "C5", "C5"], noteValue: "4n" },
  "2/4": { name: "2/4 (March)", pattern: ["C6", "C5"], noteValue: "4n" },
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
    timeSignature: "4/4"
  });

  const [status, setStatus] = useState("Loading audio engine...");
  const [toneLoaded, setToneLoaded] = useState(false);
  const synthRef = useRef<any>(null);
  const sequenceRef = useRef<any>(null);
  const metronomeRef = useRef<any>(null);
  const metronomeSequenceRef = useRef<any>(null);

  // Load Tone.js
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/tone@latest/build/Tone.js';
    script.onload = () => {
      setToneLoaded(true);
      setStatus("Ready to generate melody");
      // Initialize synthesizer
      synthRef.current = new window.Tone.Synth().toDestination();
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

  // Generate melody based on current settings
  const generateMelody = () => {
    setStatus("Generating melody...");
    
    const scaleNotes = scales[state.scale as keyof typeof scales];
    const baseNote = state.key;
    const octave = 4;
    
    // Get scale weights for more musical generation
    const weights = scaleWeights[state.scale as keyof typeof scaleWeights];
    
    const melody = Array.from({ length: state.noteCount }, () => {
      // Use weighted selection instead of pure random
      const selectedScaleIndex = weightedRandomSelect(
        scaleNotes.map((_, index) => index),
        weights
      );
      const semitone = scaleNotes[selectedScaleIndex];
      const keyIndex = keys.indexOf(baseNote);
      const noteIndex = (keyIndex + semitone) % 12;
      return keys[noteIndex] + octave;
    });

    setState(prev => ({ ...prev, generatedMelody: melody, currentNoteIndex: -1 }));
    setStatus("New melody generated! Click Play to hear it.");
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
          console.log(`Playing note ${currentNoteIndex}: ${note}`, time);
          
          // Update current note index for visual feedback
          setState(prev => {
            console.log(`Setting currentNoteIndex to ${currentNoteIndex}`);
            return { ...prev, currentNoteIndex: currentNoteIndex };
          });
          
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
    generateMelody();
  }, []);

  // Update note indicators when noteCount changes
  useEffect(() => {
    if (state.generatedMelody.length !== state.noteCount) {
      generateMelody();
    }
  }, [state.noteCount]);

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
        <h1 className="text-3xl font-semibold text-foreground mb-2">Melody Generator</h1>
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
                  <span>Play Melody</span>
                </>
              )}
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
          Powered by Tone.js • Click Generate to create a new melody
        </div>
      </div>
    </div>
  );
}
