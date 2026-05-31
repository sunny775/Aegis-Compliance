import { useMemo, useState } from 'react';
import { Box, Button, ToggleButtonGroup, ToggleButton, Stack } from '@mui/material';
import { motion } from 'framer-motion';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { DocumentCard } from '../components/DocumentCard';
import { DocumentCardSkeleton } from '../components/DocumentCardSkeleton';
import { EmptyState } from '../components/EmptyState';
import { useDocuments } from '../hooks/documents';
import { useStagger } from '../motion';
import type { DocType } from '../api/types';

type Filter = 'all' | DocType;

const GRID_SX = {
  display: 'grid',
  gap: 2.5,
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
} as const;

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useDocuments();
  const { container, item } = useStagger();
  const [filter, setFilter] = useState<Filter>('all');

  const docs = useMemo(() => {
    const list = data ?? [];
    return filter === 'all' ? list : list.filter((d) => d.docType === filter);
  }, [data, filter]);

  return (
    <Box>
      <PageHeader
        eyebrow="Library"
        title="Documents"
        description="Standards and site procedures available for analysis. Open one for its summary, key points, and Q&A."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/upload')}>
            Upload document
          </Button>
        }
      />

      {!isLoading && (data?.length ?? 0) > 0 && (
        <Stack direction="row" sx={{ mb: 3 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={filter}
            onChange={(_e, v: Filter | null) => v && setFilter(v)}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="standard">Standards</ToggleButton>
            <ToggleButton value="procedure">Procedures</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      )}

      {isLoading ? (
        <Box sx={GRID_SX}>
          {Array.from({ length: 6 }).map((_, i) => (
            <DocumentCardSkeleton key={i} />
          ))}
        </Box>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={<DescriptionRoundedIcon />}
          title={data && data.length > 0 ? 'No documents in this view' : 'No documents yet'}
          description={
            data && data.length > 0
              ? 'Try a different filter, or upload a new document.'
              : 'Upload a Recognised Standard or a site procedure to get started.'
          }
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/upload')}>
              Upload document
            </Button>
          }
        />
      ) : (
        <Box component={motion.div} sx={GRID_SX} variants={container} initial="hidden" animate="show">
          {docs.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} variant={item} />
          ))}
        </Box>
      )}
    </Box>
  );
}
