import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import type { GapReport } from '../api/types';

export function useGapAnalysis() {
  return useMutation<GapReport, Error, { standardDocId: string; procedureDocId: string }>({
    mutationFn: ({ standardDocId, procedureDocId }) => api.gapAnalysis(standardDocId, procedureDocId),
  });
}
