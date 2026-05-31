import { Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { GapStatus } from '../api/types';

const LABEL: Record<GapStatus, string> = { FULL: 'Full', PARTIAL: 'Partial', MISSING: 'Missing' };

/** Coverage verdict chip with the semantic status colours (used in gap analysis). */
export function StatusChip({ status, size = 'small' }: { status: GapStatus; size?: 'small' | 'medium' }) {
  const theme = useTheme();
  const color = theme.palette.status[status === 'FULL' ? 'full' : status === 'PARTIAL' ? 'partial' : 'missing'];
  const bg = theme.palette.statusSoft[status === 'FULL' ? 'full' : status === 'PARTIAL' ? 'partial' : 'missing'];
  return (
    <Chip
      label={LABEL[status]}
      size={size}
      sx={{ color, backgroundColor: bg, fontWeight: 700, letterSpacing: '0.02em' }}
    />
  );
}
