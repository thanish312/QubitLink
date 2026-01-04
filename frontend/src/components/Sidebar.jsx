import { useNavigate, useLocation } from 'react-router-dom';
import {
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    Divider,
    Avatar,
    Box,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/DashboardRounded';
import WalletIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import SettingsIcon from '@mui/icons-material/SettingsRounded';
import HistoryIcon from '@mui/icons-material/HistoryRounded';
import LogoutIcon from '@mui/icons-material/LogoutRounded';
import ShieldIcon from '@mui/icons-material/Shield';
import PeopleIcon from '@mui/icons-material/PeopleRounded';
import { useAuth } from '../hooks/useAuth';

const drawerWidth = 260;

const SidebarContent = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const menuItems = [
        { text: 'Overview', icon: <DashboardIcon />, path: '/dashboard' },
        { text: 'Users', icon: <PeopleIcon />, path: '/users' },
        { text: 'Wallets', icon: <WalletIcon />, path: '/wallets' },
        { text: 'Activity Log', icon: <HistoryIcon />, path: '/activity' },
        { text: 'Configuration', icon: <SettingsIcon />, path: '/settings' },
    ];

    return (
        <>
            <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', variant: 'rounded' }}>
                    <ShieldIcon />
                </Avatar>
                <Box>
                    <Typography variant="h6" sx={{ lineHeight: 1 }}>
                        QubicLink
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Admin Console
                    </Typography>
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
                                    color: isSelected
                                        ? 'primary.main'
                                        : 'text.secondary',
                                    bgcolor: isSelected
                                        ? 'rgba(99, 102, 241, 0.08) !important'
                                        : 'transparent',
                                    '&:hover': {
                                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                                        color: 'text.primary',
                                    },
                                }}
                            >
                                <ListItemIcon
                                    sx={{ color: 'inherit', minWidth: 40 }}
                                >
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                        fontWeight: isSelected ? 600 : 400,
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>

            <Box sx={{ mt: 'auto', p: 2 }}>
                <ListItemButton
                    onClick={handleLogout}
                    sx={{ borderRadius: 2, color: 'error.main' }}
                >
                    <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                        <LogoutIcon />
                    </ListItemIcon>
                    <ListItemText primary="Logout" />
                </ListItemButton>
            </Box>
        </>
    );
};

const Sidebar = ({ mobileOpen, handleDrawerToggle }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    return (
        <Box
            component="nav"
            sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        >
            {isMobile ? (
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{
                        keepMounted: true, // Better open performance on mobile.
                    }}
                    sx={{
                        '& .MuiDrawer-paper': {
                            boxSizing: 'border-box',
                            width: drawerWidth,
                            bgcolor: 'background.paper',
                            borderRight: '1px solid #27272a',
                        },
                    }}
                >
                    <SidebarContent />
                </Drawer>
            ) : (
                <Drawer
                    variant="permanent"
                    sx={{
                        '& .MuiDrawer-paper': {
                            boxSizing: 'border-box',
                            width: drawerWidth,
                            bgcolor: 'background.paper',
                            borderRight: '1px solid #27272a',
                        },
                    }}
                    open
                >
                    <SidebarContent />
                </Drawer>
            )}
        </Box>
    );
};

export default Sidebar;
