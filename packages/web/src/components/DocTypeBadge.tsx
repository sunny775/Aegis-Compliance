import { Chip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { DocType } from '../api/types';

/** Standard vs procedure, as a quiet pill. Standard = accent, procedure = neutral. */
export function DocTypeBadge({ docType }: { docType: DocType }) {
  const theme = useTheme();
  const isStandard = docType === 'standard';
  const color = isStandard ? theme.palette.primary.main : theme.palette.text.secondary;
  return (
    <Chip
      label={isStandard ? 'Standard' : 'Procedure'}
      size="small"
      variant="outlined"
      sx={{
        color,
        borderColor: alpha(color, 0.35),
        backgroundColor: alpha(color, 0.06),
        letterSpacing: '0.03em',
      }}
    />
  );
}
