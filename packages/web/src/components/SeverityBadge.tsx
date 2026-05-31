import { Box } from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import type { Severity } from '../api/types';

/** Severity colours: a deliberate ramp distinct from the status hues. */
export function severityColors(theme: Theme, severity: Severity): { color: string; bg: string } {
  const dark = theme.palette.mode === 'dark';
  switch (severity) {
    case 'Critical':
      return { color: theme.palette.status.missing, bg: theme.palette.statusSoft.missing };
    case 'High': {
      const c = dark ? '#E08A4A' : '#C2410C';
      return { color: c, bg: alpha(c, 0.14) };
    }
    case 'Medium':
      return { color: theme.palette.status.partial, bg: theme.palette.statusSoft.partial };
    case 'Low':
    default:
      return { color: theme.palette.text.secondary, bg: alpha(theme.palette.text.primary, 0.06) };
  }
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const theme = useTheme();
  const { color, bg } = severityColors(theme, severity);
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.6,
        px: 1,
        py: 0.3,
        borderRadius: 999,
        backgroundColor: bg,
        color,
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
      {severity}
    </Box>
  );
}
