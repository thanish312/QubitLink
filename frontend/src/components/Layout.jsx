import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Divider, Avatar } from '@mui/material';
import DashboardIcon from '@mui/icons-material/DashboardRounded';
import WalletIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import SettingsIcon from '@mui/icons-material/SettingsRounded';
import HistoryIcon from '@mui/icons-material/HistoryRounded';
import LogoutIcon from '@mui/icons-material/LogoutRounded';
import ShieldIcon from '@mui/icons-material/Shield';

const drawerWidth = 260; // Wider, more comfortable sidebar

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/login');
  };

  const menuItems = [
    { text: 'Overview', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Wallets', icon: <WalletIcon />, path: '/wallets' },
    { text: 'Activity Log', icon: <HistoryIcon />, path: '/activity' },
    { text: 'Configuration', icon: <SettingsIcon />, path: '/settings' },
  ];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      
      {/* Sidebar Navigation */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { 
            width: drawerWidth, 
            boxSizing: 'border-box',
            bgcolor: 'background.paper', // Slightly lighter than main bg
            borderRight: '1px solid #27272a'
          },
        }}
      >
        <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main', variant: 'rounded' }}>
                <ShieldIcon />
            </Avatar>
            <Box>
                <Typography variant="h6" sx={{ lineHeight: 1 }}>QubicLink</Typography>
                <Typography variant="caption" color="text.secondary">Admin Console</Typography>
            </Box>
        </Box>
        
        <Divider sx={{ mb: 2 }} />

        <List sx={{ px: 2 }}>
          {menuItems.map((item) => {
            const isSelected = location.pathname === item.path;
            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
                <ListItemButton 
                  selected={isSelected}
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: 2,
                    color: isSelected ? 'primary.main' : 'text.secondary',
                    bgcolor: isSelected ? 'rgba(99, 102, 241, 0.08) !important' : 'transparent',
                    '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                        color: 'text.primary'
                    }
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: isSelected ? 600 : 400 }} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        <Box sx={{ mt: 'auto', p: 2 }}>
            <ListItemButton onClick={handleLogout} sx={{ borderRadius: 2, color: 'error.main' }}>
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}><LogoutIcon /></ListItemIcon>
                <ListItemText primary="Logout" />
            </ListItemButton>
        </Box>
      </Drawer>

      {/* Main Content Area */}
      <Box component="main" sx={{ flexGrow: 1, p: 4, width: `calc(100% - ${drawerWidth}px)` }}>
        {/* We removed the top AppBar to give it a modern dashboard feel */}
        <Outlet />
      </Box>
    </Box>
  );
}