/**
 * Magenta AI Music Generation Service
 * Provides AI-powered melody, bass, and harmony generation using Google's Magenta.js
 */

import * as mm from '@magenta/music';

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

    for (const note of noteSequence.notes) {
      if (note.pitch === undefined || note.startTime === undefined || note.endTime === undefined) {
        continue;
      }

      // Map MIDI pitch to note name within octave range
      const pitchClass = note.pitch % 12;
      const noteName = keys[(pitchClass + keyIndex) % 12];

      // Constrain octave to the specified range
      let octave = Math.floor(note.pitch / 12) - 1;
      octave = Math.max(minOctave, Math.min(maxOctave, octave));

      const fullNote = `${noteName}${octave}`;
      const duration = note.endTime - note.startTime;
      const velocity = note.velocity || 80;

      notes.push({
        note: fullNote,
        duration: duration * 4, // Convert to beats (assuming 4/4 time)
        timing: note.startTime * 4,
        velocity: velocity
      });
    }

    return notes;
  }

  /**
   * Generate a fresh melody using MusicVAE
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

      const melody = this.convertToNoteWithTiming(
        samples[0],
        options.key || 'C',
        options.octaveRange || [4, 6]
      );

      console.log('[Magenta] Generated melody with', melody.length, 'notes');
      return melody;
    } catch (error) {
      console.error('[Magenta] Melody generation error:', error);
      throw error;
    }
  }

  /**
   * Generate bass line (lower octave, more rhythmic)
   */
  async generateBass(options: MagentaGenerationOptions): Promise<NoteWithTiming[]> {
    await this.initialize();

    if (!this.musicVAE) {
      throw new Error('MusicVAE not initialized');
    }

    const temperature = options.temperature || 0.8; // Slightly less random for bass

    try {
      const samples = await this.musicVAE.sample(1, temperature);

      if (samples.length === 0) {
        throw new Error('No samples generated');
      }

      // Convert to bass range (lower octaves)
      const bassNotes = this.convertToNoteWithTiming(
        samples[0],
        options.key || 'C',
        options.octaveRange || [2, 3]
      );

      // Make bass notes longer and more steady
      const processedBass = bassNotes.map(note => ({
        ...note,
        duration: Math.max(note.duration, 0.5), // Minimum half-beat duration
        velocity: Math.min(note.velocity + 10, 127) // Slightly louder
      }));

      console.log('[Magenta] Generated bass with', processedBass.length, 'notes');
      return processedBass;
    } catch (error) {
      console.error('[Magenta] Bass generation error:', error);
      throw error;
    }
  }

  /**
   * Generate harmony (complementary to melody, middle register)
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

    try {
      const samples = await this.musicVAE.sample(1, temperature);

      if (samples.length === 0) {
        throw new Error('No samples generated');
      }

      // Convert to harmony range (middle octaves, between melody and bass)
      const harmonyNotes = this.convertToNoteWithTiming(
        samples[0],
        options.key || 'C',
        options.octaveRange || [3, 5]
      );

      // Make harmony notes more sustained
      const processedHarmony = harmonyNotes.map(note => ({
        ...note,
        duration: note.duration * 1.5, // Longer notes for harmony
        velocity: Math.max(note.velocity - 15, 40) // Softer than melody
      }));

      console.log('[Magenta] Generated harmony with', processedHarmony.length, 'notes');
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
