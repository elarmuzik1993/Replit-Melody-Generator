/**
 * Soundfont Configuration
 * Maps our synth types to realistic soundfont instruments using smplr library
 */

export interface SoundfontInstrument {
  name: string;           // Display name
  soundfontName: string;  // Instrument name for smplr Soundfont
  category: 'melody' | 'bass' | 'harmony';
}

/**
 * Complete mapping of synth presets to soundfont instruments
 * Replaces Tone.js synthesizers with realistic sample-based sounds
 */
export const soundfontPresets: Record<string, SoundfontInstrument> = {
  // MELODY INSTRUMENTS
  electric_piano: {
    name: "Electric Piano",
    soundfontName: "electric_piano_1",
    category: "melody"
  },
  pluck: {
    name: "Pizzicato Strings",
    soundfontName: "pizzicato_strings",
    category: "melody"
  },
  marimba: {
    name: "Marimba",
    soundfontName: "marimba",
    category: "melody"
  },
  bell: {
    name: "Tubular Bells",
    soundfontName: "tubular_bells",
    category: "melody"
  },
  lead_synth: {
    name: "Lead Synth (Sawtooth)",
    soundfontName: "lead_2_sawtooth",
    category: "melody"
  },
  square_lead: {
    name: "Square Lead",
    soundfontName: "lead_1_square",
    category: "melody"
  },
  ambient_keys: {
    name: "Pad Synth (New Age)",
    soundfontName: "pad_2_warm",
    category: "melody"
  },
  bright_keys: {
    name: "Bright Piano",
    soundfontName: "bright_acoustic_piano",
    category: "melody"
  },

  // BASS INSTRUMENTS
  analog_bass: {
    name: "Synth Bass 1",
    soundfontName: "synth_bass_1",
    category: "bass"
  },
  sub_bass: {
    name: "Synth Bass 2",
    soundfontName: "synth_bass_2",
    category: "bass"
  },
  reese_bass: {
    name: "Synth Bass 2 (Reese)",
    soundfontName: "synth_bass_2",
    category: "bass"
  },
  fat_bass: {
    name: "Bass Lead",
    soundfontName: "lead_8_bass__lead",
    category: "bass"
  },
  acid_bass: {
    name: "Synth Bass 1 (Acid)",
    soundfontName: "synth_bass_1",
    category: "bass"
  },
  bass_synth: {
    name: "Synth Bass",
    soundfontName: "synth_bass_1",
    category: "bass"
  },

  // HARMONY/PAD INSTRUMENTS
  warm_pad: {
    name: "Warm Pad",
    soundfontName: "pad_2_warm",
    category: "harmony"
  },
  string_pad: {
    name: "String Ensemble",
    soundfontName: "string_ensemble_1",
    category: "harmony"
  },
  pad_synth: {
    name: "Synth Pad",
    soundfontName: "pad_3_polysynth",
    category: "harmony"
  },
  choir_pad: {
    name: "Choir Aahs",
    soundfontName: "choir_aahs",
    category: "harmony"
  },
  synth_strings: {
    name: "Synth Strings",
    soundfontName: "synth_strings_1",
    category: "harmony"
  },
  soft_pad: {
    name: "Pad (New Age)",
    soundfontName: "pad_1_new_age",
    category: "harmony"
  }
};

/**
 * Additional high-quality instruments available for future expansion
 */
export const additionalInstruments = {
  // Acoustic
  acoustic_grand_piano: "acoustic_grand_piano",
  acoustic_guitar_nylon: "acoustic_guitar_nylon",
  acoustic_guitar_steel: "acoustic_guitar_steel",
  acoustic_bass: "acoustic_bass",

  // Strings
  violin: "violin",
  viola: "viola",
  cello: "cello",
  contrabass: "contrabass",
  tremolo_strings: "tremolo_strings",

  // Brass
  trumpet: "trumpet",
  trombone: "trombone",
  french_horn: "french_horn",
  brass_section: "brass_section",

  // Woodwinds
  flute: "flute",
  clarinet: "clarinet",
  saxophone: "alto_sax",
  oboe: "oboe",

  // Chromatic Percussion
  vibraphone: "vibraphone",
  xylophone: "xylophone",
  glockenspiel: "glockenspiel",
  celesta: "celesta",

  // Organs
  drawbar_organ: "drawbar_organ",
  church_organ: "church_organ",
  rock_organ: "rock_organ",

  // Guitars
  electric_guitar_clean: "electric_guitar_clean",
  electric_guitar_muted: "electric_guitar_muted",
  overdriven_guitar: "overdriven_guitar",
  distortion_guitar: "distortion_guitar",

  // Synth Leads
  lead_calliope: "lead_3_calliope",
  lead_chiff: "lead_4_chiff",
  lead_charang: "lead_5_charang",

  // Synth Pads
  pad_choir: "pad_4_choir",
  pad_bowed: "pad_5_bowed",
  pad_metallic: "pad_6_metallic",
  pad_halo: "pad_7_halo",

  // Ethnic
  sitar: "sitar",
  koto: "koto",
  shamisen: "shamisen",
  kalimba: "kalimba",

  // Percussion
  steel_drums: "steel_drums",
  taiko_drum: "taiko_drum",
  timpani: "timpani"
};

/**
 * Get soundfont instrument name for a given synth preset ID
 */
export function getSoundfontName(synthId: string): string {
  return soundfontPresets[synthId]?.soundfontName || "acoustic_grand_piano";
}

/**
 * Get display name for a synth preset
 */
export function getSynthDisplayName(synthId: string): string {
  return soundfontPresets[synthId]?.name || synthId;
}

/**
 * Get all synth IDs for a specific category
 */
export function getSynthIdsByCategory(category: 'melody' | 'bass' | 'harmony'): string[] {
  return Object.entries(soundfontPresets)
    .filter(([_, preset]) => preset.category === category)
    .map(([id, _]) => id);
}
