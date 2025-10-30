/**
 * Chord Progressions Configuration
 * Defines common chord progressions for different musical styles
 */

export const chordProgressions = {
  classic: [1, 4, 5, 1],
  jazz: [2, 5, 1, 6],
  pop: [1, 5, 6, 4],
  blues: [1, 1, 4, 4, 1, 1, 5, 4],
  ambient: [1, 6, 4, 5],
  modern: [6, 4, 1, 5],
};

/**
 * Get the notes that make up a chord based on the scale degree
 * @param chordDegree - Scale degree (1-7)
 * @param scale - Array of scale intervals
 * @param key - Root note (e.g., "C", "D#")
 * @returns Array of note names that form the chord
 */
export const getChordTones = (chordDegree: number, scale: number[], key: string): string[] => {
  const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const keyIndex = keys.indexOf(key);
  const rootIndex = (chordDegree - 1) % scale.length;
  const thirdIndex = (rootIndex + 2) % scale.length;
  const fifthIndex = (rootIndex + 4) % scale.length;

  const root = keys[(keyIndex + scale[rootIndex]) % 12];
  const third = keys[(keyIndex + scale[thirdIndex]) % 12];
  const fifth = keys[(keyIndex + scale[fifthIndex]) % 12];

  return [root, third, fifth];
};
