import { ButtonBase } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

interface CitationChipProps {
  clauseRef: string;
  page: number;
  onClick?: () => void;
  tone?: 'accent' | 'neutral';
}

/** A monospace clause+page citation, clickable to jump to the source passage. */
export function CitationChip({ clauseRef, page, onClick, tone = 'accent' }: CitationChipProps) {
  const theme = useTheme();
  const base = tone === 'accent' ? theme.palette.primary.main : theme.palette.text.secondary;
  const label = clauseRef ? `§${clauseRef} · p.${page}` : `p.${page}`;
  return (
    <ButtonBase
      onClick={onClick}
      disabled={!onClick}
      sx={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: '0.7rem',
        fontWeight: 500,
        px: 0.9,
        py: 0.3,
        borderRadius: 1,
        color: base,
        backgroundColor: alpha(base, 0.1),
        border: `1px solid ${alpha(base, 0.22)}`,
        transition: 'background-color 140ms ease, transform 140ms ease',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { backgroundColor: alpha(base, 0.2) } : undefined,
        '&:active': onClick ? { transform: 'scale(0.96)' } : undefined,
      }}
    >
      {label}
    </ButtonBase>
  );
}
