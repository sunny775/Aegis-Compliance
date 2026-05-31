/**
 * Design tokens for the Compliance Document Analyzer.
 *
 * Aesthetic: refined industrial-editorial. Warm-neutral paper surfaces, a single
 * confident petrol-teal accent, and semantic status colours (green / amber / red)
 * reserved strictly for coverage verdicts. Fraunces (display) + IBM Plex Sans (UI)
 * + IBM Plex Mono (clause refs & citations).
 */

export const fonts = {
  display: '"Fraunces Variable", Fraunces, Georgia, "Times New Roman", serif',
  body: '"IBM Plex Sans", system-ui, -apple-system, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, "SFMono-Regular", monospace',
};

export const radii = { sm: 8, md: 12, lg: 16, pill: 999 };

// Warm-neutral surfaces + petrol accent. Status hues stay out of the accent's lane.
export const light = {
  base: '#F4F1E9', // warm paper
  surface: '#FCFBF7', // cards
  sunken: '#EBE7DC', // wells, track backgrounds
  ink: '#1C1B17', // primary text (warm near-black)
  muted: '#6A665B', // secondary text
  faint: '#928D7F', // tertiary / placeholders
  border: '#E0DBCE',
  borderStrong: '#CFC9B8',
  accent: '#0E6E69',
  accentHover: '#0B5A56',
  accentSoft: 'rgba(14, 110, 105, 0.10)',
  full: '#2F8B59',
  fullSoft: 'rgba(47, 139, 89, 0.12)',
  partial: '#B57A1E',
  partialSoft: 'rgba(181, 122, 30, 0.14)',
  missing: '#C0392B',
  missingSoft: 'rgba(192, 57, 43, 0.12)',
};

export const dark = {
  base: '#15140F', // warm near-black
  surface: '#1E1C16',
  sunken: '#100F0B',
  ink: '#F1EDE2',
  muted: '#A8A395',
  faint: '#7C7768',
  border: '#2D2A22',
  borderStrong: '#3B372D',
  accent: '#2FB9AE',
  accentHover: '#46C7BD',
  accentSoft: 'rgba(47, 185, 174, 0.14)',
  full: '#5CB984',
  fullSoft: 'rgba(92, 185, 132, 0.16)',
  partial: '#E0A94A',
  partialSoft: 'rgba(224, 169, 74, 0.16)',
  missing: '#E26A5C',
  missingSoft: 'rgba(226, 106, 92, 0.16)',
};

export type Palette = typeof light;
export type ColorMode = 'light' | 'dark';
