import { createTheme, type Theme, alpha } from '@mui/material/styles';
import { fonts, radii, light, dark, type ColorMode, type Palette } from './tokens';

/**
 * Build the MUI theme from design tokens. Components are de-defaulted: flat
 * borders over heavy shadows, no SHOUTING button text, comfortable density, and
 * a real type scale anchored by the Fraunces display face.
 */

declare module '@mui/material/styles' {
  interface Palette {
    status: { full: string; partial: string; missing: string };
    statusSoft: { full: string; partial: string; missing: string };
    surfaceSunken: string;
  }
  interface PaletteOptions {
    status?: { full: string; partial: string; missing: string };
    statusSoft?: { full: string; partial: string; missing: string };
    surfaceSunken?: string;
  }
}

function build(mode: ColorMode, c: Palette): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { main: c.accent, dark: c.accentHover, contrastText: '#FFFFFF' },
      success: { main: c.full },
      warning: { main: c.partial },
      error: { main: c.missing },
      background: { default: c.base, paper: c.surface },
      text: { primary: c.ink, secondary: c.muted, disabled: c.faint },
      divider: c.border,
      status: { full: c.full, partial: c.partial, missing: c.missing },
      statusSoft: { full: c.fullSoft, partial: c.partialSoft, missing: c.missingSoft },
      surfaceSunken: c.sunken,
    },
    shape: { borderRadius: radii.md },
    typography: {
      fontFamily: fonts.body,
      h1: { fontFamily: fonts.display, fontWeight: 600, fontSize: '2.6rem', letterSpacing: '-0.02em', lineHeight: 1.08 },
      h2: { fontFamily: fonts.display, fontWeight: 600, fontSize: '2rem', letterSpacing: '-0.015em', lineHeight: 1.12 },
      h3: { fontFamily: fonts.display, fontWeight: 600, fontSize: '1.5rem', letterSpacing: '-0.01em', lineHeight: 1.18 },
      h4: { fontWeight: 600, fontSize: '1.2rem', letterSpacing: '-0.005em' },
      h5: { fontWeight: 600, fontSize: '1.05rem' },
      h6: { fontWeight: 600, fontSize: '0.95rem', letterSpacing: '0.01em' },
      subtitle1: { fontWeight: 500 },
      subtitle2: { fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: c.muted },
      body1: { fontSize: '0.95rem', lineHeight: 1.6 },
      body2: { fontSize: '0.875rem', lineHeight: 1.55, color: c.muted },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
      overline: { fontFamily: fonts.mono, fontWeight: 500, fontSize: '0.7rem', letterSpacing: '0.12em' },
      caption: { fontSize: '0.78rem', color: c.muted },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: c.base,
            color: c.ink,
            // Faint warm grain for atmosphere (no external asset).
            backgroundImage: `radial-gradient(${alpha(c.borderStrong, 0.35)} 0.5px, transparent 0.5px)`,
            backgroundSize: '22px 22px',
          },
          '::selection': { background: c.accentSoft },
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': { background: c.borderStrong, borderRadius: 8, border: `2px solid ${c.base}` },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: c.border },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: radii.lg,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: radii.sm, paddingInline: 18, paddingBlock: 9 },
          containedPrimary: { '&:hover': { backgroundColor: c.accentHover } },
          outlined: { borderColor: c.borderStrong },
          sizeLarge: { paddingBlock: 12, fontSize: '1rem' },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: radii.pill, fontWeight: 600, fontSize: '0.74rem' },
          label: { paddingInline: 10 },
        },
      },
      MuiTextField: { defaultProps: { variant: 'outlined', size: 'medium' } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: radii.sm, backgroundColor: c.surface },
          notchedOutline: { borderColor: c.border },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { backgroundColor: c.ink, fontSize: '0.75rem', borderRadius: radii.sm, paddingInline: 10 },
        },
      },
      MuiDivider: { styleOverrides: { root: { borderColor: c.border } } },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: radii.pill, backgroundColor: c.sunken, height: 6 },
        },
      },
    },
  });
}

export function createAppTheme(mode: ColorMode): Theme {
  return build(mode, mode === 'light' ? light : dark);
}
