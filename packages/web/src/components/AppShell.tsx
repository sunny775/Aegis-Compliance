import { Box, Stack, Typography, IconButton, Tooltip, Divider, Avatar } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import type { ReactNode } from 'react';
import { Logo } from './Logo';
import { useColorMode } from '../theme/ThemeModeProvider';
import { useAuth } from '../context/AuthContext';
import { usePageTransition } from '../motion';

const SIDEBAR_WIDTH = 256;

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Documents', icon: <DashboardRoundedIcon fontSize="small" /> },
  { to: '/upload', label: 'Upload', icon: <CloudUploadRoundedIcon fontSize="small" /> },
  { to: '/gap-analysis', label: 'Gap analysis', icon: <RuleRoundedIcon fontSize="small" /> },
];

export function AppShell() {
  const theme = useTheme();
  const { mode, toggle } = useColorMode();
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { variants, transition } = usePageTransition();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Box
        component="nav"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          borderRight: `1px solid ${theme.palette.divider}`,
          backgroundColor: alpha(theme.palette.background.paper, 0.6),
          backdropFilter: 'blur(6px)',
          px: 2.5,
          py: 3,
        }}
      >
        <Box sx={{ px: 1, mb: 4 }}>
          <Logo />
        </Box>

        <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
          {NAV.map((item) => (
            <NavItemLink key={item.to} item={item} />
          ))}
        </Stack>

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 1 }}>
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: alpha(theme.palette.primary.main, 0.15),
              color: 'primary.main',
              fontSize: '0.85rem',
              fontWeight: 700,
            }}
          >
            {(session?.username ?? '?').slice(0, 1).toUpperCase()}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600, lineHeight: 1.2 }} noWrap>
              {session?.username ?? 'Guest'}
            </Typography>
            <Typography variant="caption">Signed in</Typography>
          </Box>
          <Tooltip title={mode === 'light' ? 'Dark mode' : 'Light mode'}>
            <IconButton size="small" onClick={toggle}>
              {mode === 'light' ? <DarkModeRoundedIcon fontSize="small" /> : <LightModeRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Sign out">
            <IconButton
              size="small"
              onClick={() => {
                signOut();
                navigate('/login');
              }}
            >
              <LogoutRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Main */}
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2.5, md: 5 }, py: { xs: 3, md: 5 } }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={variants}
              initial="initial"
              animate="enter"
              exit="exit"
              transition={transition}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>
    </Box>
  );
}

function NavItemLink({ item }: { item: NavItem }) {
  const theme = useTheme();
  if (item.disabled) {
    return (
      <Tooltip title="Coming soon" placement="right">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 1.5,
            py: 1.1,
            borderRadius: 2,
            color: 'text.disabled',
            cursor: 'default',
          }}
        >
          {item.icon}
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {item.label}
          </Typography>
        </Box>
      </Tooltip>
    );
  }
  return (
    <NavLink to={item.to} style={{ textDecoration: 'none' }}>
      {({ isActive }) => (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 1.5,
            py: 1.1,
            borderRadius: 2,
            color: isActive ? 'primary.main' : 'text.secondary',
            backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
            fontWeight: 600,
            transition: 'background-color 140ms ease, color 140ms ease',
            '&:hover': { backgroundColor: alpha(theme.palette.text.primary, 0.04), color: 'text.primary' },
          }}
        >
          {item.icon}
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {item.label}
          </Typography>
        </Box>
      )}
    </NavLink>
  );
}
