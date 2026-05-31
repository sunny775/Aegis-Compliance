import { Card, CardContent, Skeleton, Stack } from '@mui/material';

/** Skeleton placeholder matching the DocumentCard layout (not a spinner). */
export function DocumentCardSkeleton() {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Skeleton variant="rounded" width={84} height={24} />
          <Skeleton variant="text" width={48} />
        </Stack>
        <Skeleton variant="text" width="80%" height={28} />
        <Skeleton variant="text" width="55%" height={28} sx={{ mb: 1.5 }} />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="40%" />
      </CardContent>
    </Card>
  );
}
