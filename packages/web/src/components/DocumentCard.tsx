import { Card, CardActionArea, CardContent, Box, Typography, Stack } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { DocumentRecord } from '../api/types';
import { DocTypeBadge } from './DocTypeBadge';
import { formatBytes, snippet } from '../lib/format';

const MotionCard = motion.create(Card);

/** Dashboard card: type badge, title, mono id, page/size, summary snippet. */
export function DocumentCard({ doc, variant }: { doc: DocumentRecord; variant?: Variants }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const summary = snippet(doc.summary, 150);

  return (
    <MotionCard
      variants={variant}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      sx={{
        height: '100%',
        transition: 'border-color 160ms ease, box-shadow 160ms ease',
        '&:hover': {
          borderColor: alpha(theme.palette.primary.main, 0.5),
          boxShadow: `0 12px 32px ${alpha(theme.palette.text.primary, 0.08)}`,
        },
      }}
    >
      <CardActionArea onClick={() => navigate(`/documents/${doc.id}`)} sx={{ height: '100%' }}>
        <CardContent sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <DocTypeBadge docType={doc.docType} />
            <Typography sx={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', color: 'text.disabled' }}>
              {doc.id}
            </Typography>
          </Stack>

          <Typography variant="h5" sx={{ mb: 1, lineHeight: 1.25 }}>
            {doc.title}
          </Typography>

          <Typography variant="body2" sx={{ flexGrow: 1, mb: 2, minHeight: 40 }}>
            {summary || (
              <Box component="span" sx={{ fontStyle: 'italic', color: 'text.disabled' }}>
                Open to generate a plain-English summary.
              </Box>
            )}
          </Typography>

          <Stack
            direction="row"
            spacing={2}
            sx={{
              pt: 1.5,
              borderTop: `1px solid ${theme.palette.divider}`,
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '0.72rem',
              color: 'text.secondary',
            }}
          >
            <span>{doc.pageCount} pp</span>
            <span>·</span>
            <span>{formatBytes(doc.sizeBytes)}</span>
            {doc.subDocuments && doc.subDocuments.length > 0 && (
              <>
                <span>·</span>
                <span>{doc.subDocuments.length} sub-docs</span>
              </>
            )}
          </Stack>
        </CardContent>
      </CardActionArea>
    </MotionCard>
  );
}
