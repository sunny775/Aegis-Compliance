import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline, Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { theme } from './theme';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Box sx={{ p: 4 }}>
            <Typography variant="h4" gutterBottom>
              Compliance Document Analyzer
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Scaffold ready — UI is built in a later phase.
            </Typography>
          </Box>
        </motion.div>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
