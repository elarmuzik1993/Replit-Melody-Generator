/**
 * Harmony Utility Functions
 * Helper functions for generating harmonies and complementary notes
 */

import { keys } from '../../config/scales';
import { scales, intervalQuality } from '../../config/scales';
import { calculateInterval } from './noteUtils';

/**
 * Get complementary interval/harmony note for a melody note
 * @param melodyNote - The melody note to harmonize
 * @param chordTones - Available chord tones to use
 * @param octaveRange - Allowed octave range [min, max]
 * @param key - Root note of the key
 * @param scale - Name of the scale being used
 * @returns Harmony note name with octave
 */
export const getComplementaryInterval = (
  melodyNote: string,
  chordTones: string[],
  octaveRange: [number, number],
  key: string,
  scale: string
): string => {
  const melodyNoteName = melodyNote.replace(/\d/g, '');
  const melodyOctave = parseInt(melodyNote.match(/\d/)?.[0] || '4');

  const keyIndex = keys.indexOf(key);
  const scaleNotes = scales[scale as keyof typeof scales];

  if (!scaleNotes) {
    return chordTones[0] + octaveRange[0];
  }

  // Prefer chord tones that form consonant intervals
  const scoredNotes = chordTones.map(chordTone => {
    const interval = calculateInterval(melodyNoteName, chordTone);
    const quality = intervalQuality[interval] || 0;

    // Avoid unison unless it's the only option
    if (interval === 0) {
      return { note: chordTone, score: -1 };
    }

    // Prefer 3rds, 5ths, and 6ths
    return { note: chordTone, score: quality };
  });

  scoredNotes.sort((a, b) => b.score - a.score);

  // Choose randomly from top-scoring options (weighted by score)
  const topNotes = scoredNotes.filter(n => n.score === scoredNotes[0].score);
  const chosenNote = topNotes[Math.floor(Math.random() * topNotes.length)].note;

  // Determine octave - prefer octave below melody
  let harmonyOctave = melodyOctave - 1;
  if (harmonyOctave < octaveRange[0]) {
    harmonyOctave = octaveRange[0];
  } else if (harmonyOctave > octaveRange[1]) {
    harmonyOctave = octaveRange[1];
  }

  return chosenNote + harmonyOctave;
};

/**
 * Apply voice leading to make chord progressions sound smoother
 * @param previousChord - Previous chord notes
 * @param newChordTones - New chord tones to voice
 * @param octaveRange - Allowed octave range
 * @returns Voiced chord with smooth voice leading
 */
export const applyVoiceLeading = (
  previousChord: string[],
  newChordTones: string[],
  octaveRange: [number, number]
): string[] => {
  if (!previousChord || previousChord.length === 0) {
    // First chord - use default voicing
    return newChordTones.map((note, i) => note + (octaveRange[0] + Math.floor(i / 3)));
  }

  // For each new chord tone, find the closest octave to previous chord
  return newChordTones.map(newNote => {
    const closestPreviousNote = previousChord.reduce((closest, prevNote) => {
      const prevNoteName = prevNote.replace(/\d/g, '');
      const prevOctave = parseInt(prevNote.match(/\d/)?.[0] || '4');

      const interval = Math.abs(calculateInterval(prevNoteName, newNote));
      const closestInterval = Math.abs(calculateInterval(
        closest.replace(/\d/g, ''),
        newNote
      ));

      return interval < closestInterval ? prevNote : closest;
    });

    const closestOctave = parseInt(closestPreviousNote.match(/\d/)?.[0] || '4');

    // Use same octave or adjust by one if needed
    let octave = closestOctave;
    if (octave < octaveRange[0]) octave = octaveRange[0];
    if (octave > octaveRange[1]) octave = octaveRange[1];

    return newNote + octave;
  });
};
