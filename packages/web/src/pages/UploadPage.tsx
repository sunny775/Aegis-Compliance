import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Button,
  Stack,
  Typography,
  LinearProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { AnimatePresence, motion } from 'framer-motion';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { DropZone } from '../components/DropZone';
import { useUploadDocument } from '../hooks/documents';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../api/client';
import type { DocType } from '../api/types';

type Phase = 'idle' | 'uploading' | 'processing' | 'done';

const STEPS = [
  { key: 'uploading', label: 'Uploading' },
  { key: 'processing', label: 'Parsing & embedding' },
  { key: 'done', label: 'Indexed' },
] as const;

export function UploadPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const toast = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocType>('standard');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);

  const upload = useUploadDocument((fraction) => {
    setProgress(fraction);
    if (fraction >= 1) setPhase('processing');
  });

  const onSelectFile = (f: File) => {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ''));
  };

  const onSubmit = () => {
    if (!file) return;
    setPhase('uploading');
    setProgress(0);
    upload.mutate(
      { file, title: title.trim() || file.name, docType },
      {
        onSuccess: (record) => {
          setPhase('done');
          toast.success(`“${record.title}” indexed`);
          setTimeout(() => navigate(`/documents/${record.id}`), 700);
        },
        onError: (err) => {
          setPhase('idle');
          setProgress(0);
          toast.error(err instanceof ApiError ? err.message : 'Upload failed');
        },
      },
    );
  };

  const busy = phase === 'uploading' || phase === 'processing' || phase === 'done';

  return (
    <Box>
      <PageHeader
        eyebrow="Ingest"
        title="Upload a document"
        description="Add a Recognised Standard or a site procedure. It’s parsed, chunked with clause-level provenance, and embedded for retrieval."
      />

      <Card sx={{ maxWidth: 680 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <DropZone onFile={onSelectFile} disabled={busy} selectedName={file?.name} />

          <Stack spacing={2.5} sx={{ mt: 3 }}>
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              disabled={busy}
              placeholder="e.g. Recognised Standard 13 — Tyre, Wheel and Rim Management"
            />
            <TextField
              label="Document type"
              select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              fullWidth
              disabled={busy}
            >
              <MenuItem value="standard">Recognised Standard</MenuItem>
              <MenuItem value="procedure">Site procedure</MenuItem>
            </TextField>

            <AnimatePresence>
              {phase !== 'idle' && (
                <Box
                  component={motion.div}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  sx={{ overflow: 'hidden' }}
                >
                  <ProgressChoreography phase={phase} progress={progress} />
                </Box>
              )}
            </AnimatePresence>

            <Button
              variant="contained"
              size="large"
              onClick={onSubmit}
              disabled={!file || busy}
              startIcon={phase === 'done' ? <CheckCircleRoundedIcon /> : undefined}
              sx={{ alignSelf: 'flex-start' }}
            >
              {phase === 'done' ? 'Indexed' : busy ? 'Working…' : 'Ingest document'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mt: 2,
          ml: 0.5,
          fontFamily: 'IBM Plex Mono, monospace',
          color: alpha(theme.palette.text.primary, 0.45),
        }}
      >
        PDF · digital text · up to 30 MB
      </Typography>
    </Box>
  );
}

function ProgressChoreography({ phase, progress }: { phase: Phase; progress: number }) {
  const theme = useTheme();
  const activeIndex = phase === 'uploading' ? 0 : phase === 'processing' ? 1 : 2;

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 1.25 }}>
        {STEPS.map((step, i) => {
          const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
          const color =
            state === 'pending' ? theme.palette.text.disabled : theme.palette.primary.main;
          return (
            <Stack key={step.key} direction="row" alignItems="center" spacing={0.75} sx={{ color }}>
              <Box
                component={motion.div}
                animate={{ scale: state === 'active' ? [1, 1.35, 1] : 1 }}
                transition={{ repeat: state === 'active' ? Infinity : 0, duration: 1.1 }}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: state === 'pending' ? theme.palette.divider : color,
                }}
              />
              <Typography variant="caption" sx={{ color, fontWeight: state === 'active' ? 700 : 500 }}>
                {step.label}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
      <LinearProgress
        variant={phase === 'uploading' ? 'determinate' : phase === 'done' ? 'determinate' : 'indeterminate'}
        value={phase === 'uploading' ? Math.round(progress * 100) : 100}
      />
    </Box>
  );
}
