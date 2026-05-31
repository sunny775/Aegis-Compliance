import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

/** Brand mark: a layered shield (compliance/safety) + Fraunces wordmark. */
export function Logo({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const accent = theme.palette.primary.main;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box
        component="svg"
        viewBox="0 0 32 32"
        sx={{ width: 28, height: 28, flexShrink: 0 }}
        aria-hidden
      >
        <path d="M16 2 L28 7 V16 C28 23 22 28 16 30 C10 28 4 23 4 16 V7 Z" fill={accent} opacity={0.16} />
        <path
          d="M16 2 L28 7 V16 C28 23 22 28 16 30 C10 28 4 23 4 16 V7 Z"
          fill="none"
          stroke={accent}
          strokeWidth={1.6}
        />
        <path d="M11 16 l3.5 3.5 L22 12" fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Box>
      {!compact && (
        <Box sx={{ lineHeight: 1 }}>
          <Typography
            sx={{ fontFamily: theme.typography.h1.fontFamily, fontWeight: 600, fontSize: '1.12rem', letterSpacing: '-0.01em' }}
          >
            Aegis
          </Typography>
          <Typography sx={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.18em', color: 'text.secondary' }}>
            COMPLIANCE
          </Typography>
        </Box>
      )}
    </Box>
  );
}
