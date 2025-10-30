/**
 * Genre Styles Configuration
 * Defines musical characteristics for different genres
 */

import { rhythmPatterns } from './rhythms';

export interface GenreStyle {
  name: string;
  rhythmPatterns: number[][];
  preferredScales: string[];
  intervalBias: number; // 0-1: 0=stepwise, 1=leaps allowed
  velocityRange: [number, number];
  motifRepetition: number; // 0-1: how often to repeat motifs exactly
  restProbability: number; // 0-1: how often to add rests
  tempoRange: [number, number];
  description: string;
}

export const genreStyles: { [key: string]: GenreStyle } = {
  pop: {
    name: "Pop",
    rhythmPatterns: [rhythmPatterns.pop, rhythmPatterns.syncopated, rhythmPatterns.dotted],
    preferredScales: ["major", "minor", "pentatonic"],
    intervalBias: 0.3,
    velocityRange: [75, 95],
    motifRepetition: 0.7,
    restProbability: 0.2,
    tempoRange: [100, 140],
    description: "Catchy, repetitive melodies with strong hooks"
  },
  jazz: {
    name: "Jazz",
    rhythmPatterns: [rhythmPatterns.jazz_swing, rhythmPatterns.swing, rhythmPatterns.triplet],
    preferredScales: ["dorian", "mixolydian", "blues"],
    intervalBias: 0.6,
    velocityRange: [60, 100],
    motifRepetition: 0.4,
    restProbability: 0.3,
    tempoRange: [80, 200],
    description: "Swung rhythms, complex intervals, improvised feel"
  },
  hiphop: {
    name: "Hip Hop",
    rhythmPatterns: [rhythmPatterns.hiphop, rhythmPatterns.syncopated],
    preferredScales: ["minor", "blues", "pentatonic"],
    intervalBias: 0.25,
    velocityRange: [70, 90],
    motifRepetition: 0.8,
    restProbability: 0.4,
    tempoRange: [70, 100],
    description: "Repetitive loops, simple melodies, heavy rests"
  },
  edm: {
    name: "EDM",
    rhythmPatterns: [rhythmPatterns.edm, rhythmPatterns.mixed],
    preferredScales: ["minor", "major", "pentatonic"],
    intervalBias: 0.5,
    velocityRange: [85, 100],
    motifRepetition: 0.75,
    restProbability: 0.15,
    tempoRange: [120, 150],
    description: "Build-ups, drops, energetic and driving"
  },
  classical: {
    name: "Classical",
    rhythmPatterns: [rhythmPatterns.classical, rhythmPatterns.dotted, rhythmPatterns.triplet],
    preferredScales: ["major", "minor"],
    intervalBias: 0.4,
    velocityRange: [50, 100],
    motifRepetition: 0.5,
    restProbability: 0.25,
    tempoRange: [60, 140],
    description: "Elegant phrases, dynamic range, formal structure"
  },
  trap: {
    name: "Trap",
    rhythmPatterns: [rhythmPatterns.trap, rhythmPatterns.hiphop],
    preferredScales: ["minor", "blues"],
    intervalBias: 0.35,
    velocityRange: [75, 95],
    motifRepetition: 0.85,
    restProbability: 0.35,
    tempoRange: [130, 170],
    description: "Hi-hat rolls, sparse melodies, dark atmosphere"
  },
  latin: {
    name: "Latin",
    rhythmPatterns: [rhythmPatterns.latin, rhythmPatterns.syncopated],
    preferredScales: ["major", "dorian", "mixolydian"],
    intervalBias: 0.35,
    velocityRange: [75, 100],
    motifRepetition: 0.6,
    restProbability: 0.2,
    tempoRange: [100, 140],
    description: "Syncopated rhythms, festive, danceable"
  },
  ballad: {
    name: "Ballad",
    rhythmPatterns: [rhythmPatterns.ballad, rhythmPatterns.simple],
    preferredScales: ["major", "minor"],
    intervalBias: 0.3,
    velocityRange: [50, 80],
    motifRepetition: 0.65,
    restProbability: 0.3,
    tempoRange: [60, 90],
    description: "Slow, emotional, sustained notes, expressive"
  },
  automatic: {
    name: "Automatic (Mix)",
    rhythmPatterns: [rhythmPatterns.syncopated, rhythmPatterns.dotted, rhythmPatterns.mixed],
    preferredScales: ["major", "minor", "pentatonic"],
    intervalBias: 0.4,
    velocityRange: [70, 95],
    motifRepetition: 0.6,
    restProbability: 0.25,
    tempoRange: [80, 140],
    description: "Adaptive mix of styles"
  }
};
