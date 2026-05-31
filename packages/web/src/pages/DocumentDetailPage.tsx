import { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { DocTypeBadge } from '../components/DocTypeBadge';
import { CitationChip } from '../components/CitationChip';
import { QAChat } from '../components/QAChat';
import { FullText } from '../components/FullText';
import { useDocument, useDocumentChunks } from '../hooks/documents';
import { formatBytes } from '../lib/format';
import type { QASource } from '../api/types';

const TABS = ['Summary', 'Key Points', 'Q&A', 'Full Text'] as const;

export function DocumentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useDocument(id);
  const chunks = useDocumentChunks(id);

  const [tab, setTab] = useState(0);
  const [highlightChunkId, setHighlightChunkId] = useState<string | null>(null);

  const onCite = useCallback((source: QASource) => {
    setTab(3);
    setHighlightChunkId(source.chunkId);
  }, []);

  if (isError) {
    return (
      <Box>
        <BackButton onClick={() => navigate('/dashboard')} />
        <EmptyState title="Document not found" description={`No document with id “${id}”.`} />
      </Box>
    );
  }

  return (
    <Box>
      <BackButton onClick={() => navigate('/dashboard')} />

      {/* Header */}
      {isLoading || !data ? (
        <Skeleton variant="text" width="60%" height={48} sx={{ mb: 1 }} />
      ) : (
        <>
          <Typography variant="h2" sx={{ mb: 1.5 }}>
            {data.title}
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3, flexWrap: 'wrap' }}>
            <DocTypeBadge docType={data.docType} />
            <Chip label={`${data.pageCount} pages`} size="small" variant="outlined" />
            <Chip label={formatBytes(data.sizeBytes)} size="small" variant="outlined" />
            {data.subDocuments && data.subDocuments.length > 0 && (
              <Chip label={`${data.subDocuments.length} sub-documents`} size="small" variant="outlined" />
            )}
            <Typography sx={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem', color: 'text.disabled' }}>
              {data.id}
            </Typography>
          </Stack>
        </>
      )}

      <Tabs value={tab} onChange={(_e, v: number) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        {TABS.map((label) => (
          <Tab key={label} label={label} sx={{ textTransform: 'none', fontWeight: 600 }} />
        ))}
      </Tabs>

      <Panel active={tab === 0}>
        <SummaryPanel loading={isLoading} summary={data?.summary} />
      </Panel>
      <Panel active={tab === 1}>
        <KeyPointsPanel loading={isLoading} keyPoints={data?.keyPoints ?? []} />
      </Panel>
      <Panel active={tab === 2}>
        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <QAChat docId={id} onCite={onCite} />
          </CardContent>
        </Card>
      </Panel>
      <Panel active={tab === 3}>
        {chunks.isLoading ? (
          <Stack spacing={1}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={72} />
            ))}
          </Stack>
        ) : (
          <FullText
            chunks={chunks.data ?? []}
            highlightChunkId={highlightChunkId}
            onConsumed={() => setHighlightChunkId(null)}
          />
        )}
      </Panel>
    </Box>
  );
}

/** Keep every panel mounted (display toggle) so chat + scroll state survive tab switches. */
function Panel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <Box sx={{ display: active ? 'block' : 'none' }}>{children}</Box>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button startIcon={<ArrowBackRoundedIcon />} onClick={onClick} sx={{ mb: 2, color: 'text.secondary' }}>
      Documents
    </Button>
  );
}

function SummaryPanel({ loading, summary }: { loading: boolean; summary?: string }) {
  if (loading) {
    return (
      <Card>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="text" width={i % 3 === 2 ? '60%' : '100%'} />
          ))}
        </CardContent>
      </Card>
    );
  }
  if (!summary) {
    return <EmptyState title="No summary available" description="This document has no extractable content." />;
  }
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
        <Typography variant="overline" sx={{ color: 'primary.main', display: 'block', mb: 1.5 }}>
          Plain-English summary
        </Typography>
        <Typography variant="body1" sx={{ maxWidth: 720, fontSize: '1.02rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {summary}
        </Typography>
      </CardContent>
    </Card>
  );
}

function KeyPointsPanel({
  loading,
  keyPoints,
}: {
  loading: boolean;
  keyPoints: { text: string; clauseRef?: string; page?: number }[];
}) {
  const theme = useTheme();
  if (loading) {
    return (
      <Stack spacing={1.5}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={64} />
        ))}
      </Stack>
    );
  }
  if (keyPoints.length === 0) {
    return <EmptyState title="No key points" description="Nothing was extracted for this document." />;
  }
  return (
    <Stack spacing={1.5}>
      {keyPoints.map((kp, i) => (
        <Card key={i}>
          <CardContent sx={{ p: 2, display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
            <Box
              sx={{
                flexShrink: 0,
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
                color: 'primary.main',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '0.72rem',
                fontWeight: 600,
                mt: 0.2,
              }}
            >
              {i + 1}
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body1" sx={{ lineHeight: 1.5 }}>
                {kp.text}
              </Typography>
              {kp.clauseRef && kp.page !== undefined && (
                <Box sx={{ mt: 1 }}>
                  <CitationChip clauseRef={kp.clauseRef} page={kp.page} tone="neutral" />
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
