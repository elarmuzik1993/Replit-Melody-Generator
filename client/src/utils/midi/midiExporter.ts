/**
 * MIDI Export Utility
 * Handles exporting generated melodies to MIDI files
 */

import MidiWriter from 'midi-writer-js';
import { MultiTrackState } from '../../types/music';
import { noteToMidi } from '../music/noteUtils';

export interface MidiExportOptions {
  includeBass?: boolean;
  includeMelody?: boolean;
  includeHarmony?: boolean;
}

/**
 * Export the current composition to a MIDI file
 * @param state - The current multi-track state
 * @param options - Optional configuration for which tracks to include
 * @returns Object containing success status and message
 */
export const exportToMidi = (
  state: MultiTrackState,
  options: MidiExportOptions = {}
): { success: boolean; message: string } => {
  const {
    includeBass = true,
    includeMelody = true,
    includeHarmony = true
  } = options;

  // Check if any tracks have been generated
  const hasAnyTracks = state.tracks.bass.hasGenerated ||
                      state.tracks.melody.hasGenerated ||
                      state.tracks.harmony.hasGenerated;

  if (!hasAnyTracks) {
    return {
      success: false,
      message: "Please generate at least one track first!"
    };
  }

  try {
    const tracks: MidiWriter.Track[] = [];
    const trackNames: string[] = [];

    // Create Bass track (if generated and enabled)
    if (
      includeBass &&
      state.tracks.bass.hasGenerated &&
      state.tracks.bass.isEnabled &&
      state.tracks.bass.notes.length > 0
    ) {
      const bassTrack = createMidiTrack(
        state.tracks.bass.notes.map(n => n.note),
        state.tempo,
        state.timeSignature,
        33, // Electric bass
        1,  // MIDI channel 1
        80  // Velocity
      );
      tracks.push(bassTrack);
      trackNames.push('bass');
    }

    // Create Melody track (if generated and enabled)
    if (
      includeMelody &&
      state.tracks.melody.hasGenerated &&
      state.tracks.melody.isEnabled &&
      state.tracks.melody.notes.length > 0
    ) {
      const melodyTrack = createMidiTrack(
        state.tracks.melody.notes.map(n => n.note),
        state.tempo,
        state.timeSignature,
        1,  // Acoustic Grand Piano
        2,  // MIDI channel 2
        70  // Velocity
      );
      tracks.push(melodyTrack);
      trackNames.push('melody');
    }

    // Create Harmony track (if generated and enabled)
    if (
      includeHarmony &&
      state.tracks.harmony.hasGenerated &&
      state.tracks.harmony.isEnabled &&
      state.tracks.harmony.notes.length > 0
    ) {
      const harmonyTrack = createMidiTrack(
        state.tracks.harmony.notes.map(n => n.note),
        state.tempo,
        state.timeSignature,
        89, // Pad 2 (warm)
        3,  // MIDI channel 3
        50  // Velocity
      );
      tracks.push(harmonyTrack);
      trackNames.push('harmony');
    }

    if (tracks.length === 0) {
      return {
        success: false,
        message: "No tracks available for export!"
      };
    }

    // Generate MIDI file and trigger download
    const write = new MidiWriter.Writer(tracks);
    const midiData = write.dataUri();
    const link = document.createElement('a');
    link.href = midiData;

    // Create descriptive filename
    const filename = generateFilename(trackNames, state);
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return {
      success: true,
      message: `MIDI file with ${tracks.length} track${tracks.length > 1 ? 's' : ''} downloaded successfully!`
    };
  } catch (error) {
    console.error('MIDI export error:', error);
    return {
      success: false,
      message: "Error exporting MIDI file. Please try again."
    };
  }
};

/**
 * Create a MIDI track from a sequence of notes
 * @param notes - Array of note names or 'rest'
 * @param tempo - BPM
 * @param timeSignature - Time signature (e.g., "4/4")
 * @param instrument - MIDI instrument number (0-127)
 * @param channel - MIDI channel (1-16)
 * @param velocity - Note velocity (0-127)
 * @returns MIDI track
 */
function createMidiTrack(
  notes: string[],
  tempo: number,
  timeSignature: string,
  instrument: number,
  channel: number,
  velocity: number
): MidiWriter.Track {
  const track = new MidiWriter.Track();
  track.setTempo(tempo);

  const [numerator, denominator] = timeSignature.split('/').map(Number);
  track.setTimeSignature(numerator, denominator, 24, 8);

  // Set MIDI instrument
  track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument, channel }));

  // Add notes to track
  notes.forEach((noteName) => {
    if (noteName !== 'rest' && noteName !== 'REST') {
      const midiNote = noteToMidi(noteName);
      const noteEvent = new MidiWriter.NoteEvent({
        pitch: midiNote,
        duration: '8', // Eighth note
        velocity,
        channel
      });
      track.addEvent(noteEvent);
    } else {
      // Add rest
      track.addEvent(new MidiWriter.NoteEvent({
        duration: '8',
        rest: true,
        channel
      }));
    }
  });

  return track;
}

/**
 * Generate a descriptive filename for the MIDI export
 * @param trackNames - Array of included track names
 * @param state - Multi-track state
 * @returns Filename string
 */
function generateFilename(trackNames: string[], state: MultiTrackState): string {
  return `composition_${trackNames.join('-')}_${state.key}_${state.scale}_${state.tempo}bpm.mid`;
}
