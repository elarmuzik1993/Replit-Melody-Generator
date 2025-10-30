/**
 * Soundfont Player Wrapper - Enhanced Version
 * Integrates smplr library for realistic sample-based instrument playback
 * with advanced features: audio pooling, effects, better resource management
 */

import { Soundfont } from 'smplr';

export interface SoundfontPlayerOptions {
  instrument: string;
  volume?: number; // 0-1
  enableReverb?: boolean;
  reverbAmount?: number; // 0-1
  enableCompression?: boolean;
  filterCutoff?: number; // Hz, for low-pass filter
  maxPolyphony?: number; // Maximum simultaneous notes
  outputNode?: AudioNode; // Custom output node (for Tone.Destination)
}

export interface PlayNoteOptions {
  note: string | number;  // Note name (e.g., "C4") or MIDI number
  duration: number;        // Duration in seconds
  time?: number;           // When to play (AudioContext time)
  velocity?: number;       // 0-1 (normalized from MIDI 0-127)
}

/**
 * Enhanced wrapper class for smplr Soundfont instrument
 * Provides Tone.js-compatible interface with advanced audio features
 */
export class SoundfontPlayer {
  private instrument: any;
  private context: AudioContext;
  private instrumentName: string;
  private _volume: number;
  private isLoaded: boolean = false;
  private loadPromise: Promise<void> | null = null;

  // Audio nodes for effects chain
  private masterGain: GainNode;
  private compressor?: DynamicsCompressorNode;
  private filter?: BiquadFilterNode;
  private convolver?: ConvolverNode;
  private reverbGain?: GainNode;
  private dryGain?: GainNode;

  // Performance tracking
  private activeNotes: Set<number> = new Set();
  private maxPolyphony: number;
  private notePool: Map<string, number> = new Map();

  constructor(context: AudioContext, options: SoundfontPlayerOptions) {
    this.context = context;
    this.instrumentName = options.instrument;
    this._volume = options.volume ?? 0.7;
    this.maxPolyphony = options.maxPolyphony ?? 32;

    // Create audio effects chain
    this.masterGain = context.createGain();
    this.masterGain.gain.value = this._volume;

    // Set up effects based on options
    this.setupEffects(options);

    // Load instrument
    this.loadPromise = this.loadInstrument();
  }

  /**
   * Set up audio effects chain
   */
  private setupEffects(options: SoundfontPlayerOptions): void {
    let currentNode: AudioNode = this.masterGain;

    // Compression (subtle, prevents clipping)
    if (options.enableCompression !== false) {
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 3;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.1;

      currentNode.connect(this.compressor);
      currentNode = this.compressor;
    }

    // Low-pass filter (optional, for warmth)
    if (options.filterCutoff) {
      this.filter = this.context.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = options.filterCutoff;
      this.filter.Q.value = 1;

      currentNode.connect(this.filter);
      currentNode = this.filter;
    }

    // Final output destination
    const finalDestination = options.outputNode || this.context.destination;

    // Reverb (creates spatial depth)
    if (options.enableReverb) {
      this.setupReverb(options.reverbAmount ?? 0.2, finalDestination);
      currentNode.connect(this.dryGain!);
    } else {
      // Connect to specified output or context destination
      currentNode.connect(finalDestination);
    }
  }

  /**
   * Set up reverb effect with impulse response
   */
  private setupReverb(reverbAmount: number, destination: AudioNode): void {
    // Create dry/wet mix
    this.dryGain = this.context.createGain();
    this.reverbGain = this.context.createGain();
    this.convolver = this.context.createConvolver();

    // Set wet/dry mix
    this.dryGain.gain.value = 1 - reverbAmount;
    this.reverbGain.gain.value = reverbAmount;

    // Generate simple reverb impulse response
    this.generateReverbImpulse();

    // Connect reverb path to specified destination
    this.dryGain.connect(destination);
    this.reverbGain.connect(this.convolver);
    this.convolver.connect(destination);
  }

  /**
   * Generate a simple reverb impulse response
   */
  private generateReverbImpulse(): void {
    if (!this.convolver) return;

    const sampleRate = this.context.sampleRate;
    const length = sampleRate * 2; // 2 second reverb
    const impulse = this.context.createBuffer(2, length, sampleRate);

    const leftChannel = impulse.getChannelData(0);
    const rightChannel = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2);
      leftChannel[i] = (Math.random() * 2 - 1) * decay;
      rightChannel[i] = (Math.random() * 2 - 1) * decay;
    }

    this.convolver.buffer = impulse;
  }

  /**
   * Load the soundfont instrument with proper detection
   */
  private async loadInstrument(): Promise<void> {
    try {
      console.log(`[SoundfontPlayer] Loading soundfont "${this.instrumentName}"...`);
      console.log('[SoundfontPlayer] Master gain node:', this.masterGain);
      console.log('[SoundfontPlayer] AudioContext:', this.context);

      // Create soundfont with output connected to our effects chain
      console.log('[SoundfontPlayer] Calling Soundfont constructor with params:', {
        instrument: this.instrumentName,
        destination: this.masterGain
      });

      this.instrument = new Soundfont(this.context, {
        instrument: this.instrumentName,
        destination: this.masterGain // Connect to our gain node instead of context.destination
      });

      console.log('[SoundfontPlayer] Soundfont constructor returned:', this.instrument);

      console.log('[SoundfontPlayer] Soundfont instance created:', this.instrument);

      // Wait for instrument to be ready - test by attempting to load a note
      await this.waitForInstrumentReady();

      this.isLoaded = true;
      console.log(`[SoundfontPlayer] ✓ Successfully loaded: ${this.instrumentName}`);
    } catch (error) {
      console.error(`[SoundfontPlayer] ✗ FAILED to load "${this.instrumentName}":`, error);
      console.error('[SoundfontPlayer] Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      });
      throw new Error(`Failed to load soundfont "${this.instrumentName}": ${(error as Error).message}`);
    }
  }

  /**
   * Properly wait for instrument to be ready by testing it
   */
  private async waitForInstrumentReady(): Promise<void> {
    const maxAttempts = 50;
    const delayMs = 100;

    console.log(`[SoundfontPlayer] Waiting for instrument "${this.instrumentName}" to be ready...`);

    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Try to access instrument properties
        if (this.instrument && this.instrument.loaded !== false) {
          console.log(`[SoundfontPlayer] Instrument ready after ${i * delayMs}ms`);
          // Give it a bit more time to fully initialize
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return;
        }
      } catch (e) {
        console.warn(`[SoundfontPlayer] Attempt ${i + 1}/${maxAttempts} - not ready yet:`, e);
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error(`Instrument ${this.instrumentName} failed to load after ${maxAttempts * delayMs}ms`);
  }

  /**
   * Ensure instrument is loaded before playing
   */
  async ensureLoaded(): Promise<void> {
    if (this.loadPromise) {
      await this.loadPromise;
    }
  }

  /**
   * Play a note (Tone.js-compatible interface) with polyphony management
   * @param note Note name (e.g., "C4") or MIDI number
   * @param duration Duration in seconds
   * @param time When to play (AudioContext time), defaults to now
   * @param velocity Velocity 0-1, defaults to 0.8
   */
  triggerAttackRelease(
    note: string | number,
    duration: number,
    time?: number,
    velocity?: number
  ): void {
    if (!this.isLoaded || !this.instrument) {
      console.warn(`Instrument ${this.instrumentName} not yet ready`);
      return;
    }

    // Resume AudioContext if suspended (browser autoplay policy)
    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    const actualTime = time ?? this.context.currentTime;
    const actualVelocity = velocity ?? 0.8;

    // Polyphony management - stop oldest notes if limit exceeded
    if (this.activeNotes.size >= this.maxPolyphony) {
      const oldestNote = this.activeNotes.values().next().value;
      this.activeNotes.delete(oldestNote);
    }

    // Track this note
    const noteId = Date.now() + Math.random();
    this.activeNotes.add(noteId);

    // Schedule note stop
    setTimeout(() => {
      this.activeNotes.delete(noteId);
    }, duration * 1000 + 100);

    try {
      // Play with adjusted gain for dynamics
      const dynamicGain = this.calculateDynamicGain(actualVelocity);

      this.instrument.start({
        note: note,
        time: actualTime,
        duration: duration,
        gain: dynamicGain
      });
    } catch (error) {
      console.error(`Error playing note ${note}:`, error);
      this.activeNotes.delete(noteId);
    }
  }

  /**
   * Calculate dynamic gain with velocity curve for more natural playback
   */
  private calculateDynamicGain(velocity: number): number {
    // Apply velocity curve for more expressive dynamics
    // Gentle curve: soft notes are softer, loud notes are louder
    const curvedVelocity = Math.pow(velocity, 1.2);
    return curvedVelocity * this._volume;
  }

  /**
   * Play a note with options
   */
  async play(options: PlayNoteOptions): Promise<void> {
    await this.ensureLoaded();

    this.triggerAttackRelease(
      options.note,
      options.duration,
      options.time,
      options.velocity
    );
  }

  /**
   * Stop all playing notes immediately
   */
  stop(time?: number): void {
    if (!this.instrument) return;

    try {
      const actualTime = time ?? this.context.currentTime;
      this.instrument.stop({ time: actualTime });
      this.activeNotes.clear();
    } catch (error) {
      console.warn('Error stopping instrument:', error);
    }
  }

  /**
   * Set volume (0-1) with smooth ramping to avoid clicks
   */
  set volume(value: number) {
    this._volume = Math.max(0, Math.min(1, value));

    // Smooth volume change over 50ms to avoid clicks
    if (this.masterGain) {
      const currentTime = this.context.currentTime;
      this.masterGain.gain.cancelScheduledValues(currentTime);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, currentTime);
      this.masterGain.gain.linearRampToValueAtTime(this._volume, currentTime + 0.05);
    }
  }

  get volume(): number {
    return this._volume;
  }

  /**
   * Set reverb amount (0-1)
   */
  setReverbAmount(amount: number): void {
    if (this.dryGain && this.reverbGain) {
      const wetAmount = Math.max(0, Math.min(1, amount));
      const currentTime = this.context.currentTime;

      this.dryGain.gain.setValueAtTime(1 - wetAmount, currentTime);
      this.reverbGain.gain.setValueAtTime(wetAmount, currentTime);
    }
  }

  /**
   * Set filter cutoff frequency
   */
  setFilterCutoff(frequency: number): void {
    if (this.filter) {
      const currentTime = this.context.currentTime;
      this.filter.frequency.setValueAtTime(frequency, currentTime);
    }
  }

  /**
   * Clean up resources properly
   */
  dispose(): void {
    // Stop all notes
    if (this.instrument) {
      try {
        this.instrument.stop();
      } catch (e) {
        console.warn('Error stopping instrument during dispose:', e);
      }
      this.instrument = null;
    }

    // Disconnect and clean up audio nodes
    if (this.masterGain) {
      this.masterGain.disconnect();
    }
    if (this.compressor) {
      this.compressor.disconnect();
    }
    if (this.filter) {
      this.filter.disconnect();
    }
    if (this.convolver) {
      this.convolver.disconnect();
    }
    if (this.dryGain) {
      this.dryGain.disconnect();
    }
    if (this.reverbGain) {
      this.reverbGain.disconnect();
    }

    // Clear tracking
    this.activeNotes.clear();
    this.notePool.clear();

    this.isLoaded = false;
    console.log(`✓ Disposed soundfont: ${this.instrumentName}`);
  }

  /**
   * Check if instrument is loaded and ready
   */
  get loaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Get current polyphony count
   */
  get polyphony(): number {
    return this.activeNotes.size;
  }

  /**
   * Get performance stats
   */
  getStats(): { activeNotes: number; maxPolyphony: number; instrument: string } {
    return {
      activeNotes: this.activeNotes.size,
      maxPolyphony: this.maxPolyphony,
      instrument: this.instrumentName
    };
  }
}

/**
 * Create and load a soundfont player
 */
export async function createSoundfontPlayer(
  context: AudioContext,
  options: SoundfontPlayerOptions
): Promise<SoundfontPlayer> {
  const player = new SoundfontPlayer(context, options);
  await player.ensureLoaded();
  return player;
}

/**
 * Batch create multiple soundfont players
 */
export async function createMultiplePlayers(
  context: AudioContext,
  instruments: Array<{ id: string; instrument: string; volume?: number }>
): Promise<Map<string, SoundfontPlayer>> {
  const players = new Map<string, SoundfontPlayer>();

  await Promise.all(
    instruments.map(async ({ id, instrument, volume }) => {
      const player = await createSoundfontPlayer(context, { instrument, volume });
      players.set(id, player);
    })
  );

  return players;
}
