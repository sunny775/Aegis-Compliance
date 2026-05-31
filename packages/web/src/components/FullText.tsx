import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { Chunk } from '../api/types';

interface FullTextProps {
  chunks: Chunk[];
  /** Chunk id to scroll to and flash (set when a citation chip is clicked). */
  highlightChunkId: string | null;
  onConsumed: () => void;
}

/** Renders the document's chunks with clause/page anchors; flashes a cited passage. */
export function FullText({ chunks, highlightChunkId, onConsumed }: FullTextProps) {
  const theme = useTheme();
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightChunkId) return;
    const el = refs.current[highlightChunkId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashId(highlightChunkId);
      const t = setTimeout(() => {
        setFlashId(null);
        onConsumed();
      }, 1800);
      return () => clearTimeout(t);
    }
    onConsumed();
    return undefined;
  }, [highlightChunkId, onConsumed]);

  if (chunks.length === 0) {
    return (
      <Typography variant="body2" sx={{ py: 4, textAlign: 'center' }}>
        No extracted text available for this document.
      </Typography>
    );
  }

  return (
    <Stack spacing={2.5}>
      {chunks.map((chunk) => {
        const flashing = flashId === chunk.id;
        return (
          <Box
            key={chunk.id}
            ref={(el: HTMLDivElement | null) => {
              refs.current[chunk.id] = el;
            }}
            sx={{
              p: 2,
              borderRadius: 2,
              border: `1px solid ${flashing ? theme.palette.primary.main : 'transparent'}`,
              backgroundColor: flashing
                ? alpha(theme.palette.primary.main, 0.08)
                : 'transparent',
              transition: 'background-color 600ms ease, border-color 600ms ease',
              scrollMarginTop: 24,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 0.75, flexWrap: 'wrap' }}>
              {chunk.metadata.clauseRef && (
                <Typography
                  component="span"
                  sx={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.78rem', color: 'primary.main', fontWeight: 600 }}
                >
                  §{chunk.metadata.clauseRef}
                </Typography>
              )}
              {chunk.metadata.headingTrail && (
                <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                  {chunk.metadata.headingTrail}
                </Typography>
              )}
              <Box sx={{ flexGrow: 1 }} />
              <Typography component="span" sx={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', color: 'text.disabled' }}>
                p.{chunk.metadata.page}
                {chunk.metadata.subDocId ? ` · ${chunk.metadata.subDocId}` : ''}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {chunk.text}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}
