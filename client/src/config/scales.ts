/**
 * Musical Scales Configuration
 * Defines intervals for all supported scales
 */

export const scales = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

export const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * Scale weights for different track types
 * Higher weights mean notes are more likely to be selected
 */
export const scaleWeights = {
  melody: {
    major: [3, 1.5, 2, 1, 2.5, 2, 1.5], // Emphasis on 1, 3, 5
    minor: [3, 1, 2, 1.5, 2.5, 1, 2],   // Emphasis on 1, 3, 5, 7
    dorian: [2.5, 1.5, 2, 1, 2, 2, 1.5],
    phrygian: [2.5, 2, 1.5, 1, 2, 1.5, 2],
    lydian: [2.5, 1.5, 2, 2, 2, 1.5, 1],
    mixolydian: [2.5, 1.5, 2, 1, 2.5, 2, 2],
    aeolian: [2.5, 1, 2, 1.5, 2.5, 1, 2],
    locrian: [2.5, 2, 1.5, 1, 1.5, 2, 2],
  },
  bass: {
    major: [5, 1, 1, 3, 4, 1, 1],       // Strong emphasis on root and fifth
    minor: [5, 1, 1, 2, 4, 1, 2],
    dorian: [4, 1, 1, 2, 3, 2, 1],
    phrygian: [4, 2, 1, 2, 3, 1, 2],
    lydian: [4, 1, 1, 2, 3, 2, 1],
    mixolydian: [4, 1, 1, 2, 4, 2, 2],
    aeolian: [4, 1, 1, 2, 3, 1, 2],
    locrian: [4, 2, 1, 2, 2, 2, 1],
  },
};

/**
 * Interval quality ratings for harmonic consonance
 * Higher values = more consonant/pleasant
 */
export const intervalQuality: { [key: number]: number } = {
  0: 3,   // Unison (perfect)
  1: -2,  // Minor 2nd (dissonant)
  2: -1,  // Major 2nd (slightly dissonant)
  3: 1,   // Minor 3rd (consonant)
  4: 2,   // Major 3rd (consonant)
  5: 2,   // Perfect 4th (consonant)
  6: -3,  // Tritone (very dissonant)
  7: 3,   // Perfect 5th (very consonant)
  8: 1,   // Minor 6th (consonant)
  9: 2,   // Major 6th (consonant)
  10: 1,  // Minor 7th (slightly consonant)
  11: 0,  // Major 7th (neutral)
  12: 3,  // Octave (perfect)
};
