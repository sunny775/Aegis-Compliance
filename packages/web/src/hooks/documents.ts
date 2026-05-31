import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { DocType } from '../api/types';

export const documentKeys = {
  all: ['documents'] as const,
  detail: (id: string) => ['documents', id] as const,
};

export function useDocuments() {
  return useQuery({ queryKey: documentKeys.all, queryFn: () => api.listDocuments() });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => api.getDocument(id),
    enabled: id.length > 0,
  });
}

export function useUploadDocument(onProgress?: (fraction: number) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; title: string; docType: DocType }) =>
      api.uploadDocument(input, onProgress),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}
