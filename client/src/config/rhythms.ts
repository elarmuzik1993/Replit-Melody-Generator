/**
 * Rhythm Patterns Configuration
 * Defines note durations for different musical styles
 */

export const timeSignatures = {
  "4/4": { beats: 4, noteValue: 4 },
  "3/4": { beats: 3, noteValue: 4 },
  "6/8": { beats: 6, noteValue: 8 },
  "5/4": { beats: 5, noteValue: 4 },
  "7/8": { beats: 7, noteValue: 8 },
};

/**
 * Rhythm patterns for different musical contexts
 * Values represent note durations (1 = quarter note, 0.5 = eighth note, etc.)
 */
export const rhythmPatterns = {
  // Basic patterns
  simple: [1, 1, 1, 1],                           // All quarter notes (robotic baseline)
  syncopated: [0.5, 0.5, 1, 0.5, 1.5],           // Eighth-quarter-eighth-dotted quarter
  triplet: [0.33, 0.33, 0.34, 1],                 // Triplet eighth + quarter note
  swing: [0.67, 0.33, 0.67, 0.33],               // Swing feel (long-short pattern)
  dotted: [0.75, 0.25, 1, 0.5, 0.5],             // Dotted eighth + sixteenth + quarter + two eighths
  mixed: [1, 0.5, 0.5, 0.75, 0.25, 1],           // Varied rhythms

  // Track-specific patterns
  steady_bass: [1, 1, 1, 1],                      // Bass: steady quarter notes
  bass_walking: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],  // Bass: eighth note walk
  harmony_sustain: [2, 2, 2, 2],                  // Harmony: long sustained notes (half notes)

  // Genre-specific patterns
  jazz_swing: [0.67, 0.33, 0.67, 0.33, 1, 0.5, 0.5],
  hiphop: [0.5, 0.25, 0.25, 1, 0.5, 0.5],
  edm: [0.25, 0.25, 0.25, 0.25, 0.5, 0.5, 1],
  pop: [1, 0.5, 0.5, 1, 0.5, 1.5],
  classical: [1, 0.5, 0.5, 1, 1, 2],
  trap: [0.25, 0.25, 0.5, 0.5, 0.25, 0.75, 0.5],
  latin: [0.5, 0.5, 0.5, 0.5, 1, 1],
  ballad: [2, 1, 1, 2, 2]
};
