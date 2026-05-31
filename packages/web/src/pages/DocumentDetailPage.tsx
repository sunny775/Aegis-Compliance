import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { DocTypeBadge } from '../components/DocTypeBadge';
import { useDocument } from '../hooks/documents';

/**
 * Detail view placeholder. The full summary / key points / Q&A chat and gap
 * analysis are built in the next frontend phase; this keeps card links valid
 * and confirms the document is reachable.
 */
export function DocumentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useDocument(id);

  return (
    <Box>
      <Button
        startIcon={<ArrowBackRoundedIcon />}
        onClick={() => navigate('/dashboard')}
        sx={{ mb: 2, color: 'text.secondary' }}
      >
        Documents
      </Button>

      {isError ? (
        <EmptyState title="Document not found" description={`No document with id “${id}”.`} />
      ) : (
        <>
          <PageHeader
            eyebrow={data ? undefined : 'Loading'}
            title={data?.title ?? (isLoading ? 'Loading…' : id)}
            description="Summary, key points, grounded Q&A, and gap analysis arrive in the next phase."
          />
          {data && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <DocTypeBadge docType={data.docType} />
              <Chip label={`${data.pageCount} pages`} size="small" variant="outlined" />
              <Typography sx={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem', color: 'text.disabled' }}>
                {data.id}
              </Typography>
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}
