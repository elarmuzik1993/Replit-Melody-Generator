/**
 * Note Utility Functions
 * Helper functions for working with musical notes
 */

import { keys } from '../../config/scales';

/**
 * Convert note name to MIDI number
 * @param noteName - Note name (e.g., "C4", "D#5")
 * @returns MIDI note number
 */
export const noteToMidi = (noteName: string): number => {
  const noteMap: { [key: string]: number } = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
  };
  const note = noteName.slice(0, -1);
  const octave = parseInt(noteName.slice(-1));
  return noteMap[note] + (octave + 1) * 12;
};

/**
 * Weighted random selection from an array
 * @param items - Array of items to select from
 * @param weights - Optional array of weights (higher = more likely)
 * @returns Randomly selected item
 */
export const weightedRandomSelect = <T>(items: T[], weights?: number[]): T => {
  if (!weights || weights.length !== items.length) {
    return items[Math.floor(Math.random() * items.length)];
  }

  const totalWeight = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= Math.max(0, weights[i]);
    if (random <= 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
};

/**
 * Calculate the interval (in semitones) between two notes
 * @param note1 - First note name (e.g., "C", "D#")
 * @param note2 - Second note name
 * @returns Interval in semitones (0-11)
 */
export const calculateInterval = (note1: string, note2: string): number => {
  const index1 = keys.indexOf(note1);
  const index2 = keys.indexOf(note2);
  return (index2 - index1 + 12) % 12;
};

/**
 * Apply stepwise motion bias to scale weights
 * Encourages smoother melodic motion by favoring nearby notes
 * @param baseWeights - Base probability weights for each scale degree
 * @param previousNote - The previously played note
 * @param currentScale - Array of scale intervals
 * @param keyIndex - Index of the key in the chromatic scale
 * @param octave - Current octave
 * @returns Modified weights array
 */
export const applyStepwiseBias = (
  baseWeights: number[],
  previousNote: string,
  currentScale: number[],
  keyIndex: number,
  octave: number
): number[] => {
  const prevIndex = keys.indexOf(previousNote.replace(/\d/g, ''));
  const prevOctave = parseInt(previousNote.match(/\d/)?.[0] || String(octave));

  return baseWeights.map((weight, i) => {
    const noteIndex = (keyIndex + currentScale[i]) % 12;
    const octaveDiff = Math.abs(octave - prevOctave);
    const semitoneDiff = Math.abs(noteIndex - prevIndex + (octaveDiff * 12));

    // Boost nearby notes (stepwise motion)
    if (semitoneDiff <= 2) {
      return weight * 2;
    } else if (semitoneDiff <= 4) {
      return weight * 1.5;
    }
    return weight;
  });
};
