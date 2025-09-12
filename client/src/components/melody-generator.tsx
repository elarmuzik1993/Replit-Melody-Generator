import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square, Info } from "lucide-react";

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

export default function MelodyGeneratorComponent() {
  const [state, setState] = useState<MelodyState>({
    tempo: 120,
    scale: "major",
    key: "C",
    noteCount: 8,
    isPlaying: false,
    generatedMelody: [],
    currentNoteIndex: -1
  });

  const [status, setStatus] = useState("Ready to generate melody");
  const [toneLoaded, setToneLoaded] = useState(false);
  const synthRef = useRef<any>(null);
  const sequenceRef = useRef<any>(null);

  // Load Tone.js
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/tone@latest/build/Tone.js';
    script.onload = () => {
      setToneLoaded(true);
      // Initialize synthesizer
      synthRef.current = new window.Tone.Synth().toDestination();
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  // Generate melody based on current settings
  const generateMelody = () => {
    setStatus("Generating melody...");
    
    const scaleNotes = scales[state.scale as keyof typeof scales];
    const baseNote = state.key;
    const octave = 4;
    
    const melody = Array.from({ length: state.noteCount }, () => {
      const scaleIndex = Math.floor(Math.random() * scaleNotes.length);
      const semitone = scaleNotes[scaleIndex];
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

      // Create sequence
      let noteIndex = 0;
      sequenceRef.current = new window.Tone.Sequence(
        (time: number, note: string) => {
          // Update current note index for visual feedback
          setState(prev => ({ ...prev, currentNoteIndex: noteIndex }));
          
          // Play the note
          synthRef.current.triggerAttackRelease(note, "8n", time);
          
          noteIndex++;
          
          // Stop when all notes have been played
          if (noteIndex >= state.generatedMelody.length) {
            setTimeout(() => {
              stopPlayback();
            }, 200);
          }
        },
        state.generatedMelody,
        "8n"
      );

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
    if (sequenceRef.current) {
      sequenceRef.current.stop();
      sequenceRef.current.dispose();
      sequenceRef.current = null;
    }
    
    window.Tone.Transport.stop();
    window.Tone.Transport.cancel();
    
    setState(prev => ({ ...prev, isPlaying: false, currentNoteIndex: -1 }));
    setStatus("Playback complete");
  };

  // Toggle playback
  const togglePlayback = () => {
    if (state.isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
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
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>60</span>
                <span>120</span>
                <span>180</span>
              </div>
            </div>
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
