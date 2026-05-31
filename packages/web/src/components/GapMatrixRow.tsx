import { useState } from 'react';
import { Box, Typography, Stack, Collapse, IconButton } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import type { GapVerdict } from '../api/types';
import { StatusChip } from './StatusChip';
import { SeverityBadge } from './SeverityBadge';
import { CitationChip } from './CitationChip';

/** One requirement row; expands to standard ⇄ procedure evidence + action. */
export function GapMatrixRow({ verdict }: { verdict: GapVerdict }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Box
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2.5,
        backgroundColor: 'background.paper',
        overflow: 'hidden',
        transition: 'border-color 160ms ease',
        '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.4) },
      }}
    >
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 2,
          py: 1.5,
          cursor: 'pointer',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, width: 152 }}>
          <StatusChip status={verdict.status} />
          <SeverityBadge severity={verdict.severity} />
        </Box>
        <Typography
          sx={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.74rem', color: 'primary.main', flexShrink: 0, width: 56 }}
        >
          §{verdict.standardCitation.clauseRef}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: 'text.primary', flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {verdict.requirement.text}
        </Typography>
        <IconButton size="small" component={motion.button} animate={{ rotate: open ? 180 : 0 }} sx={{ flexShrink: 0 }}>
          <ExpandMoreRoundedIcon fontSize="small" />
        </IconButton>
      </Box>

      <Collapse in={open} timeout={240} unmountOnExit>
        <Box sx={{ px: 2, pb: 2, pt: 0.5, borderTop: `1px dashed ${theme.palette.divider}` }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 2 }}>
            <EvidenceColumn
              label="Standard requirement"
              tone="neutral"
              citation={{ clauseRef: verdict.standardCitation.clauseRef, page: verdict.standardCitation.page }}
              category={verdict.requirement.category}
              body={verdict.requirement.text}
            />
            <EvidenceColumn
              label="Procedure evidence"
              tone="accent"
              citation={verdict.procedureCitation}
              body={
                verdict.procedureCitation
                  ? verdict.evidenceQuote || '(matching provision found)'
                  : 'No matching provision was found in the procedure.'
              }
              muted={!verdict.procedureCitation}
            />
          </Box>

          <DetailBlock title="Rationale" text={verdict.rationale} />
          <DetailBlock title="Recommended action" text={verdict.recommendedAction} accent />
        </Box>
      </Collapse>
    </Box>
  );
}

function EvidenceColumn({
  label,
  tone,
  citation,
  body,
  category,
  muted,
}: {
  label: string;
  tone: 'accent' | 'neutral';
  citation: { clauseRef: string; page: number } | null;
  body: string;
  category?: string;
  muted?: boolean;
}) {
  const theme = useTheme();
  return (
    <Box sx={{ p: 1.75, borderRadius: 2, backgroundColor: alpha(theme.palette.text.primary, 0.025) }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary', fontWeight: 600 }}>
          {label}
        </Typography>
        {citation && <CitationChip clauseRef={citation.clauseRef} page={citation.page} tone={tone} />}
      </Stack>
      {category && (
        <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'primary.main' }}>
          {category}
        </Typography>
      )}
      <Typography variant="body2" sx={{ color: muted ? 'text.disabled' : 'text.primary', fontStyle: muted ? 'italic' : 'normal', lineHeight: 1.6 }}>
        {body}
      </Typography>
    </Box>
  );
}

function DetailBlock({ title, text, accent }: { title: string; text: string; accent?: boolean }) {
  const theme = useTheme();
  if (!text) return null;
  return (
    <Box sx={{ mt: 1.75 }}>
      <Typography
        variant="caption"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, color: accent ? 'primary.main' : 'text.secondary' }}
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          mt: 0.5,
          color: 'text.primary',
          lineHeight: 1.6,
          ...(accent && {
            pl: 1.5,
            borderLeft: `2px solid ${alpha(theme.palette.primary.main, 0.4)}`,
          }),
        }}
      >
        {text}
      </Typography>
    </Box>
  );
}
