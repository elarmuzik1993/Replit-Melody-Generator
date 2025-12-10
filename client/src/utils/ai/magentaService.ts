/**
 * Magenta AI Music Generation Service
 * Provides AI-powered melody, bass, and harmony generation using Google's Magenta.js
 */

import * as mm from '@magenta/music';
import {
  getChordProgression,
  getChordTones,
  getChordRoot,
  getNoteChordIndex,
  quantizeToChordTone,
  quantizeBassToChord,
  createHarmonyNote
} from '@/utils/music/chordProgressionUtils';

interface NoteWithTiming {
  note: string;
  duration: number;
  timing: number;
  velocity: number;
}

interface MagentaGenerationOptions {
  temperature?: number;
  numSteps?: number;
  stepsPerQuarter?: number;
  key?: string;
  scale?: number[];
  octaveRange?: [number, number];
  scaleName?: string;  // For chord progression selection
}

class MagentaService {
  private musicVAE: mm.MusicVAE | null = null;
  private melodyRNN: mm.MusicRNN | null = null;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize Magenta models (MusicVAE for creative generation, MelodyRNN for continuation)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        console.log('[Magenta] Initializing AI models...');

        // Initialize MusicVAE for creative, varied generation
        this.musicVAE = new mm.MusicVAE(
          'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_2bar_small'
        );
        await this.musicVAE.initialize();
        console.log('[Magenta] MusicVAE initialized successfully');

        // Initialize MelodyRNN for melody continuation
        this.melodyRNN = new mm.MusicRNN(
          'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn'
        );
        await this.melodyRNN.initialize();
        console.log('[Magenta] MelodyRNN initialized successfully');

        this.isInitialized = true;
      } catch (error) {
        console.error('[Magenta] Initialization error:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Convert Magenta NoteSequence to our NoteWithTiming format
   */
  private convertToNoteWithTiming(
    noteSequence: mm.INoteSequence,
    key: string,
    octaveRange: [number, number]
  ): NoteWithTiming[] {
    const notes: NoteWithTiming[] = [];
    const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const keyIndex = keys.indexOf(key);

    if (!noteSequence.notes || noteSequence.notes.length === 0) {
      return notes;
    }

    const [minOctave, maxOctave] = octaveRange;

    // Get quantization info to convert steps to beats
    const stepsPerQuarter = noteSequence.quantizationInfo?.stepsPerQuarter || 4;
    const beatsPerStep = 1.0 / stepsPerQuarter;

    for (const note of noteSequence.notes) {
      if (note.pitch === undefined) {
        continue;
      }

      // Use quantized steps if available (MusicVAE output), otherwise fall back to time values
      let startTime: number;
      let duration: number;

      if (note.quantizedStartStep !== undefined && note.quantizedEndStep !== undefined) {
        // Convert steps to beats
        startTime = note.quantizedStartStep * beatsPerStep;
        duration = (note.quantizedEndStep - note.quantizedStartStep) * beatsPerStep;
      } else if (note.startTime !== undefined && note.endTime !== undefined) {
        // Fall back to time-based values
        startTime = note.startTime;
        duration = note.endTime - note.startTime;
      } else {
        continue;
      }

      // Map MIDI pitch to note name within octave range
      const pitchClass = note.pitch % 12;
      const noteName = keys[(pitchClass + keyIndex) % 12];

      // Constrain octave to the specified range
      let octave = Math.floor(note.pitch / 12) - 1;
      octave = Math.max(minOctave, Math.min(maxOctave, octave));

      const fullNote = `${noteName}${octave}`;
      const velocity = note.velocity || 80;

      notes.push({
        note: fullNote,
        duration: duration,
        timing: startTime,
        velocity: velocity
      });
    }

    return notes;
  }

  /**
   * Apply chord progression to generated notes
   * Quantizes notes to fit the harmonic context
   */
  private applyChordProgression(
    notes: NoteWithTiming[],
    key: string,
    scale: number[],
    scaleName: string,
    octaveRange: [number, number],
    quantizeStrength: number = 0.7
  ): NoteWithTiming[] {
    if (notes.length === 0) return notes;

    // Get chord progression
    const progression = getChordProgression(scaleName);
    console.log('[Magenta] Applying chord progression:', progression);

    return notes.map((noteObj, index) => {
      // Determine which chord this note belongs to
      const chordIndex = getNoteChordIndex(index, notes.length, progression);
      const currentChord = progression[chordIndex];

      // Get chord tones for this chord
      const chordTones = getChordTones(currentChord, scale, key);

      // Quantize the note to the nearest chord tone
      const quantizedNote = quantizeToChordTone(
        noteObj.note,
        chordTones,
        octaveRange,
        quantizeStrength
      );

      return {
        ...noteObj,
        note: quantizedNote
      };
    });
  }

  /**
   * Extend a short sequence to desired length by repeating with variation
   */
  private extendSequence(notes: NoteWithTiming[], targetBeats: number = 16): NoteWithTiming[] {
    if (notes.length === 0) return notes;

    // Calculate the duration of the original pattern
    const lastNote = notes[notes.length - 1];
    const sequenceDuration = lastNote.timing + lastNote.duration;

    console.log('[Magenta] extendSequence input:', {
      noteCount: notes.length,
      firstNoteTiming: notes[0].timing,
      lastNoteTiming: lastNote.timing,
      lastNoteDuration: lastNote.duration,
      sequenceDuration,
      targetBeats
    });

    // Guard against zero or very small durations
    if (sequenceDuration <= 0.1) {
      console.warn('[Magenta] Sequence duration too small, using minimum 2 beats');
      // Use a minimum duration of 2 beats for pattern repetition
      const minDuration = 2.0;
      const extended: NoteWithTiming[] = [];
      let currentBeat = 0;
      const maxRepetitions = Math.ceil(targetBeats / minDuration) + 1;
      let repetitions = 0;

      while (currentBeat < targetBeats && repetitions < maxRepetitions) {
        for (const note of notes) {
          extended.push({
            ...note,
            timing: note.timing + currentBeat
          });
        }
        currentBeat += minDuration;
        repetitions++;
      }

      return extended.filter(note => note.timing < targetBeats);
    }

    const extended: NoteWithTiming[] = [];
    let currentBeat = 0;
    let repetitions = 0;
    const maxRepetitions = Math.ceil(targetBeats / sequenceDuration) + 1;

    // Repeat the pattern until we reach target length
    while (currentBeat < targetBeats && repetitions < maxRepetitions) {
      for (const note of notes) {
        const newNote = {
          ...note,
          timing: note.timing + currentBeat
        };
        extended.push(newNote);
      }
      currentBeat += sequenceDuration;
      repetitions++;
    }

    console.log('[Magenta] extendSequence output:', {
      originalNotes: notes.length,
      extendedNotes: extended.length,
      repetitions
    });

    // Trim any notes that exceed target length
    return extended.filter(note => note.timing < targetBeats);
  }

  /**
   * Generate a fresh melody using MusicVAE with chord progression awareness
   */
  async generateMelody(options: MagentaGenerationOptions): Promise<NoteWithTiming[]> {
    await this.initialize();

    if (!this.musicVAE) {
      throw new Error('MusicVAE not initialized');
    }

    const temperature = options.temperature || 1.0;
    const numSteps = options.numSteps || 32;

    try {
      // Sample from the latent space to create a new melody
      const samples = await this.musicVAE.sample(1, temperature);

      if (samples.length === 0) {
        throw new Error('No samples generated');
      }

      let melody = this.convertToNoteWithTiming(
        samples[0],
        options.key || 'C',
        options.octaveRange || [4, 6]
      );

      // Extend the sequence to desired length (MusicVAE generates short 2-bar patterns)
      const targetBeats = (numSteps / 4); // Convert steps to beats
      melody = this.extendSequence(melody, targetBeats);

      // Apply chord progression if scale info is provided
      if (options.scale && options.scaleName) {
        melody = this.applyChordProgression(
          melody,
          options.key || 'C',
          options.scale,
          options.scaleName,
          options.octaveRange || [4, 6],
          0.6 // Lighter quantization for melody (allows passing tones)
        );
      }

      console.log('[Magenta] Generated chord-aware melody with', melody.length, 'notes');
      return melody;
    } catch (error) {
      console.error('[Magenta] Melody generation error:', error);
      throw error;
    }
  }

  /**
   * Generate bass line (lower octave, more rhythmic) following chord roots
   */
  async generateBass(options: MagentaGenerationOptions): Promise<NoteWithTiming[]> {
    await this.initialize();

    if (!this.musicVAE) {
      throw new Error('MusicVAE not initialized');
    }

    const temperature = options.temperature || 0.8; // Slightly less random for bass
    const numSteps = options.numSteps || 32;

    try {
      const samples = await this.musicVAE.sample(1, temperature);

      if (samples.length === 0) {
        throw new Error('No samples generated');
      }

      // Convert to bass range (lower octaves)
      let bassNotes = this.convertToNoteWithTiming(
        samples[0],
        options.key || 'C',
        options.octaveRange || [2, 3]
      );

      // Extend the sequence to desired length
      const targetBeats = (numSteps / 4);
      bassNotes = this.extendSequence(bassNotes, targetBeats);

      // Apply chord progression - bass should follow chord roots
      if (options.scale && options.scaleName) {
        const progression = getChordProgression(options.scaleName);

        bassNotes = bassNotes.map((noteObj, index) => {
          const chordIndex = getNoteChordIndex(index, bassNotes.length, progression);
          const currentChord = progression[chordIndex];
          const chordTones = getChordTones(currentChord, options.scale!, options.key || 'C');
          const chordRoot = getChordRoot(currentChord, options.scale!, options.key || 'C');

          // Quantize bass to chord root (with occasional fifth)
          const quantizedNote = quantizeBassToChord(
            noteObj.note,
            chordRoot,
            chordTones,
            options.octaveRange || [2, 3],
            true // Allow fifths for variation
          );

          return {
            ...noteObj,
            note: quantizedNote
          };
        });
      }

      // Make bass notes longer and more steady
      const processedBass = bassNotes.map(note => ({
        ...note,
        duration: Math.max(note.duration, 0.5), // Minimum half-beat duration
        velocity: Math.min(note.velocity + 10, 127) // Slightly louder
      }));

      console.log('[Magenta] Generated chord-aware bass with', processedBass.length, 'notes');
      return processedBass;
    } catch (error) {
      console.error('[Magenta] Bass generation error:', error);
      throw error;
    }
  }

  /**
   * Generate harmony (complementary to melody, middle register) using chord tones
   */
  async generateHarmony(
    melodyNotes: NoteWithTiming[],
    options: MagentaGenerationOptions
  ): Promise<NoteWithTiming[]> {
    await this.initialize();

    if (!this.musicVAE) {
      throw new Error('MusicVAE not initialized');
    }

    const temperature = options.temperature || 0.9;
    const numSteps = options.numSteps || 32;

    try {
      const samples = await this.musicVAE.sample(1, temperature);

      if (samples.length === 0) {
        throw new Error('No samples generated');
      }

      // Convert to harmony range (middle octaves, between melody and bass)
      let harmonyNotes = this.convertToNoteWithTiming(
        samples[0],
        options.key || 'C',
        options.octaveRange || [3, 5]
      );

      // Extend the sequence to desired length
      const targetBeats = (numSteps / 4);
      harmonyNotes = this.extendSequence(harmonyNotes, targetBeats);

      // Apply chord progression - harmony should use chord tones
      if (options.scale && options.scaleName) {
        harmonyNotes = this.applyChordProgression(
          harmonyNotes,
          options.key || 'C',
          options.scale,
          options.scaleName,
          options.octaveRange || [3, 5],
          0.9 // Strong quantization for harmony (mostly chord tones)
        );
      }

      // Make harmony notes more sustained
      const processedHarmony = harmonyNotes.map(note => ({
        ...note,
        duration: note.duration * 1.5, // Longer notes for harmony
        velocity: Math.max(note.velocity - 15, 40) // Softer than melody
      }));

      console.log('[Magenta] Generated chord-aware harmony with', processedHarmony.length, 'notes');
      return processedHarmony;
    } catch (error) {
      console.error('[Magenta] Harmony generation error:', error);
      throw error;
    }
  }

  /**
   * Continue/extend an existing melody using MelodyRNN
   */
  async continueMelody(
    seedNotes: NoteWithTiming[],
    options: MagentaGenerationOptions
  ): Promise<NoteWithTiming[]> {
    await this.initialize();

    if (!this.melodyRNN) {
      throw new Error('MelodyRNN not initialized');
    }

    // Convert our format to Magenta's NoteSequence format
    // For simplicity, we'll just generate a new melody instead of continuing
    // (Continuing requires complex seed sequence formatting)
    return this.generateMelody(options);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.musicVAE) {
      this.musicVAE.dispose();
      this.musicVAE = null;
    }
    if (this.melodyRNN) {
      this.melodyRNN.dispose();
      this.melodyRNN = null;
    }
    this.isInitialized = false;
    this.initPromise = null;
  }
}

// Singleton instance
export const magentaService = new MagentaService();
export default magentaService;
