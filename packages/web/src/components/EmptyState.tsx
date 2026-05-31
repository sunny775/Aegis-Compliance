import { Box, Typography, type SxProps, type Theme } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  sx?: SxProps<Theme>;
}

export function EmptyState({ icon, title, description, action, sx }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 9,
        px: 3,
        border: `1px dashed ${theme.palette.divider}`,
        borderRadius: 4,
        backgroundColor: alpha(theme.palette.text.primary, 0.012),
        ...sx,
      }}
    >
      {icon && (
        <Box sx={{ color: 'text.disabled', mb: 1.5, '& svg': { fontSize: 40 } }}>{icon}</Box>
      )}
      <Typography variant="h5" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ maxWidth: 380, mx: 'auto' }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
    </Box>
  );
}
