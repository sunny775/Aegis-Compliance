import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import type { GapStatus } from '../api/types';

const SIZE = 156;
const R = 64;
const STROKE = 15;
const CENTER = SIZE / 2;

/** Animated donut of FULL / PARTIAL / MISSING coverage with the score at centre. */
export function CoverageDonut({
  counts,
  coverageScore,
}: {
  counts: Record<GapStatus, number>;
  coverageScore: number;
}) {
  const theme = useTheme();
  const total = counts.FULL + counts.PARTIAL + counts.MISSING;
  const segments = [
    { value: counts.FULL, color: theme.palette.status.full },
    { value: counts.PARTIAL, color: theme.palette.status.partial },
    { value: counts.MISSING, color: theme.palette.status.missing },
  ];

  let acc = 0;
  return (
    <Box sx={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
      <Box component="svg" viewBox={`0 0 ${SIZE} ${SIZE}`} sx={{ width: SIZE, height: SIZE, transform: 'rotate(-90deg)' }}>
        <circle cx={CENTER} cy={CENTER} r={R} fill="none" stroke={theme.palette.surfaceSunken} strokeWidth={STROKE} />
        {segments.map((seg, i) => {
          const fraction = total > 0 ? seg.value / total : 0;
          const rotation = acc * 360;
          acc += fraction;
          if (fraction === 0) return null;
          return (
            <motion.circle
              key={i}
              cx={CENTER}
              cy={CENTER}
              r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
              style={{ rotate: `${rotation}deg`, transformOrigin: '50% 50%' }}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: fraction }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 + i * 0.12 }}
            />
          );
        })}
      </Box>
      <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <Box>
          <Typography sx={{ fontFamily: theme.typography.h1.fontFamily, fontWeight: 600, fontSize: '2.1rem', lineHeight: 1 }}>
            {coverageScore}%
          </Typography>
          <Typography variant="caption" sx={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.62rem' }}>
            Full coverage
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
