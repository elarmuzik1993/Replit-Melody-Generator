/**
 * Chord Progression Utilities
 * Provides functions to make melodies harmonically coherent with chord progressions
 */

import { scales, keys } from "@/config/scales";
import { chordProgressions as importedChordProgressions } from "@/config/chords";

// Chord progressions mapped to scale degrees
const chordProgressions = {
  major: [
    [1, 5, 6, 4], // I-V-vi-IV (very popular pop progression)
    [1, 4, 5, 1], // I-IV-V-I (classic progression)
    [1, 6, 4, 5], // I-vi-IV-V (50s progression)
    [6, 4, 1, 5]  // vi-IV-I-V (sad to happy)
  ],
  minor: [
    [1, 6, 3, 7], // i-VI-III-VII (epic minor)
    [1, 4, 5, 1], // i-iv-v-i (natural minor)
    [1, 3, 6, 7], // i-III-VI-VII (ascending)
    [1, 7, 6, 5]  // i-VII-VI-v (descending)
  ]
};

export interface ChordProgression {
  chords: number[];  // Scale degrees [1, 4, 5, 1]
  currentChordIndex: number;
}

/**
 * Get a chord progression based on scale type
 */
export function getChordProgression(scale: string): number[] {
  const scaleType = scale === 'major' || scale === 'pentatonic' || scale === 'lydian' || scale === 'mixolydian'
    ? 'major'
    : 'minor';

  const progressions = chordProgressions[scaleType];
  return progressions[Math.floor(Math.random() * progressions.length)];
}

/**
 * Get the chord tones (root, third, fifth) for a scale degree
 */
export function getChordTones(scaleDegree: number, scale: number[], key: string): string[] {
  const keyIndex = keys.indexOf(key);
  const chordTones: string[] = [];

  // Build triad: root (1), third (3), fifth (5)
  const intervals = [0, 2, 4]; // Scale degree intervals for triad

  for (const interval of intervals) {
    const scaleIndex = (scaleDegree - 1 + interval) % scale.length;
    const noteIndex = (keyIndex + scale[scaleIndex]) % 12;
    chordTones.push(keys[noteIndex]);
  }

  return chordTones;
}

/**
 * Get the root note for a scale degree
 */
export function getChordRoot(scaleDegree: number, scale: number[], key: string): string {
  const keyIndex = keys.indexOf(key);
  const scaleIndex = (scaleDegree - 1) % scale.length;
  const noteIndex = (keyIndex + scale[scaleIndex]) % 12;
  return keys[noteIndex];
}

/**
 * Determine which chord a note position maps to based on progression
 */
export function getNoteChordIndex(noteIndex: number, totalNotes: number, progression: number[]): number {
  const notesPerChord = totalNotes / progression.length;
  const chordIndex = Math.floor(noteIndex / notesPerChord) % progression.length;
  return chordIndex;
}

/**
 * Check if a note (without octave) is a chord tone
 */
export function isChordTone(noteName: string, chordTones: string[]): boolean {
  return chordTones.includes(noteName);
}

/**
 * Find the nearest chord tone to a given note
 */
export function findNearestChordTone(
  noteName: string,
  octave: number,
  chordTones: string[],
  octaveRange: [number, number]
): { note: string; octave: number } {
  const noteToSemitone = (n: string) => keys.indexOf(n);
  const currentSemitone = noteToSemitone(noteName);

  let minDistance = Infinity;
  let bestNote = chordTones[0];
  let bestOctave = octave;

  // Try each chord tone in nearby octaves
  for (const chordTone of chordTones) {
    const chordSemitone = noteToSemitone(chordTone);

    // Try current octave and adjacent octaves
    for (let testOctave = Math.max(octaveRange[0], octave - 1);
         testOctave <= Math.min(octaveRange[1], octave + 1);
         testOctave++) {

      const currentMidi = currentSemitone + (octave * 12);
      const chordMidi = chordSemitone + (testOctave * 12);
      const distance = Math.abs(currentMidi - chordMidi);

      if (distance < minDistance) {
        minDistance = distance;
        bestNote = chordTone;
        bestOctave = testOctave;
      }
    }
  }

  return { note: bestNote, octave: bestOctave };
}

/**
 * Quantize a note to the nearest chord tone
 * @param fullNote - Note with octave (e.g., "C4")
 * @param chordTones - Available chord tones (e.g., ["C", "E", "G"])
 * @param octaveRange - Allowed octave range
 * @param strength - 0 to 1, how strongly to quantize (1 = always quantize, 0.5 = 50% chance)
 */
export function quantizeToChordTone(
  fullNote: string,
  chordTones: string[],
  octaveRange: [number, number],
  strength: number = 0.7
): string {
  // Extract note name and octave
  const noteName = fullNote.slice(0, -1);
  const octave = parseInt(fullNote.slice(-1), 10);

  // If already a chord tone, keep it
  if (isChordTone(noteName, chordTones)) {
    return fullNote;
  }

  // Apply quantization based on strength
  if (Math.random() < strength) {
    const nearest = findNearestChordTone(noteName, octave, chordTones, octaveRange);
    return nearest.note + nearest.octave;
  }

  return fullNote;
}

/**
 * Adjust a bass note to be the chord root (or fifth for variation)
 */
export function quantizeBassToChord(
  fullNote: string,
  chordRoot: string,
  chordTones: string[],
  octaveRange: [number, number],
  allowFifth: boolean = true
): string {
  const octave = parseInt(fullNote.slice(-1), 10);

  // 80% root, 20% fifth (if allowed)
  const useFifth = allowFifth && Math.random() < 0.2;
  const targetNote = useFifth ? chordTones[2] : chordRoot; // Fifth is index 2

  // Keep octave constrained
  const constrainedOctave = Math.max(octaveRange[0], Math.min(octaveRange[1], octave));

  return targetNote + constrainedOctave;
}

/**
 * Create a harmony note that complements the melody within the current chord
 */
export function createHarmonyNote(
  melodyNote: string,
  chordTones: string[],
  octaveRange: [number, number]
): string {
  const melodyNoteName = melodyNote.slice(0, -1);
  const melodyOctave = parseInt(melodyNote.slice(-1), 10);

  // If melody is a chord tone, harmonize with another chord tone
  if (isChordTone(melodyNoteName, chordTones)) {
    // Use a different chord tone (third or fifth interval)
    const otherChordTones = chordTones.filter(t => t !== melodyNoteName);
    const harmonyNoteName = otherChordTones[Math.floor(Math.random() * otherChordTones.length)];

    // Use an octave below or same as melody
    const harmonyOctave = Math.max(
      octaveRange[0],
      Math.min(octaveRange[1], melodyOctave - (Math.random() < 0.5 ? 1 : 0))
    );

    return harmonyNoteName + harmonyOctave;
  }

  // If melody is a passing tone, use the chord root
  const rootNote = chordTones[0];
  const harmonyOctave = Math.max(octaveRange[0], Math.min(octaveRange[1], melodyOctave - 1));
  return rootNote + harmonyOctave;
}
