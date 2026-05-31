import { useState, type FormEvent } from 'react';
import { Box, Card, CardContent, TextField, Button, Typography, Stack, InputAdornment, IconButton } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { Navigate, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLogin } from '../hooks/auth';
import { ApiError } from '../api/client';

export function LoginPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAuthenticated, signIn } = useAuth();
  const toast = useToast();
  const login = useLogin();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('compliance-demo');
  const [show, setShow] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { username, password },
      {
        onSuccess: (session) => {
          signIn(session);
          toast.success(`Welcome back, ${session.username}`);
          navigate('/dashboard');
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : 'Sign-in failed');
        },
      },
    );
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 3,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Atmospheric accent glow */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          width: 520,
          height: 520,
          borderRadius: '50%',
          top: -160,
          right: -120,
          background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.18)}, transparent 70%)`,
          filter: 'blur(8px)',
        }}
      />
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        sx={{ width: '100%', maxWidth: 420, zIndex: 1 }}
      >
        <Stack alignItems="center" sx={{ mb: 3 }}>
          <Logo />
        </Stack>
        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h3" sx={{ mb: 0.5 }}>
              Sign in
            </Typography>
            <Typography variant="body2" sx={{ mb: 3 }}>
              Compliance document analysis for Queensland coal-mining operations.
            </Typography>

            <Box component="form" onSubmit={onSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  fullWidth
                  autoComplete="username"
                />
                <TextField
                  label="Password"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  autoComplete="current-password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShow((s) => !s)} edge="end" size="small">
                          {show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button type="submit" variant="contained" size="large" disabled={login.isPending} fullWidth>
                  {login.isPending ? 'Signing in…' : 'Sign in'}
                </Button>
              </Stack>
            </Box>

            <Box
              sx={{
                mt: 3,
                p: 1.5,
                borderRadius: 2,
                backgroundColor: alpha(theme.palette.text.primary, 0.03),
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '0.72rem',
                color: 'text.secondary',
                textAlign: 'center',
              }}
            >
              demo · admin / compliance-demo
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
