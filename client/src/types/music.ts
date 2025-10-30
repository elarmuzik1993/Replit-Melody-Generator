/**
 * Music Theory Types
 * Core type definitions for the melody generator
 */

export interface NoteWithTiming {
  note: string;
  duration: number;
  timing: number;
  velocity: number;
}

export interface TrackData {
  notes: NoteWithTiming[];
  hasGenerated: boolean;
  isEnabled: boolean;
  isMuted: boolean;
  volume: number;
  synthType: string;
  currentNoteIndex: number;
  currentStepIndex: number;
}

export interface MultiTrackState {
  key: string;
  scale: string;
  tempo: number;
  timeSignature: string;
  genre: string;
  melodyLength: number;
  masterVolume: number;
  tracks: {
    melody: TrackData;
    bass: TrackData;
    harmony: TrackData;
  };
  metronomeEnabled: boolean;
}

export interface GenreStyle {
  melodyComplexity: number;
  rhythmVariety: number;
  harmonicDensity: number;
  melodyRange: [number, number];
  bassRange: [number, number];
  harmonyRange: [number, number];
  preferredScales: string[];
  rhythmBias: { [key: string]: number };
  chordProgressionStyle: string;
}

export type TrackType = 'bass' | 'melody' | 'harmony';
export type ScaleType = 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian';
export type TimeSignature = '4/4' | '3/4' | '6/8' | '5/4' | '7/8';
