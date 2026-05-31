import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Button,
  Stack,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Skeleton,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import EastRoundedIcon from '@mui/icons-material/EastRounded';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { CoverageDonut } from '../components/CoverageDonut';
import { GapMatrixRow } from '../components/GapMatrixRow';
import { useDocuments } from '../hooks/documents';
import { useGapAnalysis } from '../hooks/gap';
import { useStagger } from '../motion';
import type { GapStatus, Severity } from '../api/types';

const DEFAULT_STANDARD = 'rs13';
const DEFAULT_PROCEDURE = 'acme-tyre';

const SEVERITY_RANK: Record<Severity, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const STATUS_RANK: Record<GapStatus, number> = { MISSING: 3, PARTIAL: 2, FULL: 1 };

type StatusFilter = 'ALL' | GapStatus;
type SortKey = 'severity' | 'status';

export function GapAnalysisPage() {
  const theme = useTheme();
  const { data: documents } = useDocuments();
  const gap = useGapAnalysis();
  const { container, item } = useStagger();

  const standards = useMemo(() => (documents ?? []).filter((d) => d.docType === 'standard'), [documents]);
  const procedures = useMemo(() => (documents ?? []).filter((d) => d.docType === 'procedure'), [documents]);

  const [standardId, setStandardId] = useState('');
  const [procedureId, setProcedureId] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sort, setSort] = useState<SortKey>('severity');
  const autoRan = useRef(false);

  // Default to the matched pair so the screen opens on the pre-run report.
  useEffect(() => {
    if (!documents) return;
    if (!standardId && standards.length > 0) {
      setStandardId(standards.find((d) => d.id === DEFAULT_STANDARD)?.id ?? standards[0]!.id);
    }
    if (!procedureId && procedures.length > 0) {
      setProcedureId(procedures.find((d) => d.id === DEFAULT_PROCEDURE)?.id ?? procedures[0]!.id);
    }
  }, [documents, standards, procedures, standardId, procedureId]);

  // Auto-run once on the defaults (the cached pre-run is instant).
  useEffect(() => {
    if (!autoRan.current && standardId && procedureId) {
      autoRan.current = true;
      gap.mutate({ standardDocId: standardId, procedureDocId: procedureId });
    }
  }, [standardId, procedureId, gap]);

  const report = gap.data;
  const rows = useMemo(() => {
    if (!report) return [];
    const filtered = report.matrix.filter((v) => statusFilter === 'ALL' || v.status === statusFilter);
    return [...filtered].sort((a, b) =>
      sort === 'severity'
        ? SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
        : STATUS_RANK[b.status] - STATUS_RANK[a.status],
    );
  }, [report, statusFilter, sort]);

  const run = () => {
    if (standardId && procedureId) gap.mutate({ standardDocId: standardId, procedureDocId: procedureId });
  };

  return (
    <Box>
      <PageHeader
        eyebrow="Coverage matrix"
        title="Gap analysis"
        description="Coverage of a Recognised Standard's requirements by a site procedure — every verdict cited to a clause and page, with risk-weighted severity."
      />

      {/* Selector */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <TextField
              select
              label="Standard"
              value={standardId}
              onChange={(e) => setStandardId(e.target.value)}
              sx={{ flex: 1 }}
              size="small"
            >
              {standards.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.title}
                </MenuItem>
              ))}
            </TextField>
            <EastRoundedIcon sx={{ color: 'text.disabled', display: { xs: 'none', md: 'block' } }} />
            <TextField
              select
              label="Procedure"
              value={procedureId}
              onChange={(e) => setProcedureId(e.target.value)}
              sx={{ flex: 1 }}
              size="small"
            >
              {procedures.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.title}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              startIcon={<PlayArrowRoundedIcon />}
              onClick={run}
              disabled={gap.isPending || !standardId || !procedureId}
            >
              {gap.isPending ? 'Analysing…' : report ? 'Re-run' : 'Run analysis'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {gap.isPending ? (
        <LoadingState />
      ) : gap.isError ? (
        <EmptyState
          title="Analysis failed"
          description={gap.error instanceof Error ? gap.error.message : 'Something went wrong.'}
          action={
            <Button variant="contained" onClick={run}>
              Try again
            </Button>
          }
        />
      ) : !report ? (
        <EmptyState
          icon={<RuleRoundedIcon />}
          title="Run a coverage analysis"
          description="Pick a standard and a procedure, then run the analysis to see the requirements-coverage matrix."
        />
      ) : report.matrix.length === 0 ? (
        <EmptyState title="No requirements extracted" description="The standard produced no requirements to assess." />
      ) : (
        <>
          {/* Score header */}
          <Card
            component={motion.div}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            sx={{ mb: 3, overflow: 'hidden', position: 'relative' }}
          >
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(560px circle at 88% -10%, ${alpha(theme.palette.primary.main, 0.07)}, transparent 60%)`,
              }}
            />
            <CardContent sx={{ p: { xs: 2.5, sm: 4 }, position: 'relative' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} alignItems="center">
                <CoverageDonut counts={report.counts} coverageScore={report.coverageScore} />
                <Box sx={{ flexGrow: 1, width: '100%' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {report.matrix.length} requirements assessed
                  </Typography>
                  <Stack spacing={1.25}>
                    <CountBar label="Full" value={report.counts.FULL} total={report.matrix.length} color={theme.palette.status.full} />
                    <CountBar label="Partial" value={report.counts.PARTIAL} total={report.matrix.length} color={theme.palette.status.partial} />
                    <CountBar label="Missing" value={report.counts.MISSING} total={report.matrix.length} color={theme.palette.status.missing} />
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Controls */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2.5 }} justifyContent="space-between">
            <ToggleButtonGroup
              size="small"
              exclusive
              value={statusFilter}
              onChange={(_e, v: StatusFilter | null) => v && setStatusFilter(v)}
            >
              <ToggleButton value="ALL">All</ToggleButton>
              <ToggleButton value="FULL">Full</ToggleButton>
              <ToggleButton value="PARTIAL">Partial</ToggleButton>
              <ToggleButton value="MISSING">Missing</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={sort}
              onChange={(_e, v: SortKey | null) => v && setSort(v)}
            >
              <ToggleButton value="severity">Sort: Severity</ToggleButton>
              <ToggleButton value="status">Sort: Status</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {/* Matrix */}
          {rows.length === 0 ? (
            <EmptyState title="Nothing matches this filter" description="Adjust the status filter to see more requirements." />
          ) : (
            <Stack component={motion.div} spacing={1.25} variants={container} initial="hidden" animate="show">
              {rows.map((verdict) => (
                <Box component={motion.div} key={verdict.requirement.id} variants={item}>
                  <GapMatrixRow verdict={verdict} />
                </Box>
              ))}
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}

function CountBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const theme = useTheme();
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Typography variant="body2" sx={{ width: 56, color: 'text.primary', fontWeight: 600 }}>
        {label}
      </Typography>
      <Box sx={{ flexGrow: 1, height: 8, borderRadius: 99, backgroundColor: theme.palette.surfaceSunken, overflow: 'hidden' }}>
        <Box
          component={motion.div}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          sx={{ height: '100%', backgroundColor: color, borderRadius: 99 }}
        />
      </Box>
      <Typography sx={{ width: 36, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.8rem', color: 'text.secondary' }}>
        {value}
      </Typography>
    </Stack>
  );
}

function LoadingState() {
  return (
    <Box>
      <Skeleton variant="rounded" height={180} sx={{ mb: 3, borderRadius: 4 }} />
      <Stack spacing={1.25}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={56} sx={{ borderRadius: 2.5 }} />
        ))}
      </Stack>
    </Box>
  );
}
