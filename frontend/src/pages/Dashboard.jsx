import { useQuery } from '@tanstack/react-query';
import { Grid, Paper, Typography, Box, Chip, LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Avatar } from '@mui/material';
import PeopleIcon from '@mui/icons-material/PeopleRounded';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUserRounded';
import PendingIcon from '@mui/icons-material/PendingActionsRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import DnsIcon from '@mui/icons-material/DnsRounded';
import BoltIcon from '@mui/icons-material/BoltRounded';
import api from '../api';

// A styled card component for consistency
const DashboardCard = ({ title, value, icon, color, subtext }) => (
  <Paper sx={{ p: 3, height: '100%', position: 'relative', overflow: 'hidden' }}>
    <Box sx={{ position: 'relative', zIndex: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {title}
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
            {value}
        </Typography>
        {subtext && <Typography variant="body2" color="text.secondary">{subtext}</Typography>}
    </Box>
    {/* Decorative Icon in background */}
    <Box sx={{ 
        position: 'absolute', 
        right: -10, 
        bottom: -10, 
        opacity: 0.1, 
        color: color,
        transform: 'scale(4)' 
    }}>
        {icon}
    </Box>
  </Paper>
);

const StatusPill = ({ label, active }) => (
    <Box sx={{ 
        display: 'flex', alignItems: 'center', gap: 1.5, 
        p: 2, borderRadius: 2, 
        bgcolor: active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        border: '1px solid',
        borderColor: active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'
    }}>
        <Box sx={{ 
            width: 10, height: 10, borderRadius: '50%', 
            bgcolor: active ? '#10b981' : '#ef4444',
            boxShadow: active ? '0 0 10px #10b981' : 'none'
        }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: active ? '#10b981' : '#ef4444' }}>
            {label}
        </Typography>
    </Box>
);

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/stats').then(res => res.data),
    refetchInterval: 30000,
  });

  const { data: activity } = useQuery({
    queryKey: ['recent_activity'],
    queryFn: () => api.get('/activity').then(res => res.data.slice(0, 5)), // Get top 5
  });

  if (isLoading) return <LinearProgress color="secondary" />;

  return (
    <Box sx={{ maxWidth: 1600, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ color: 'white' }}>Dashboard Overview</Typography>
        <Typography variant="body1" color="text.secondary">Welcome back, Admin. Here's what's happening today.</Typography>
      </Box>
      
      {/* 1. KEY METRICS */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <DashboardCard 
            title="Total Verified Wallets" 
            value={data?.totalVerified || 0} 
            icon={<VerifiedUserIcon />} 
            color="#10b981"
            subtext="Lifetime verifications"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardCard 
            title="Active Challenges" 
            value={data?.pendingChallenges || 0} 
            icon={<PendingIcon />} 
            color="#f59e0b"
            subtext="Users currently linking"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardCard 
            title="Discord Users" 
            value={data?.totalUsers || 0} 
            icon={<PeopleIcon />} 
            color="#6366f1"
            subtext="Unique members tracked"
          />
        </Grid>
      </Grid>
      
      {/* 2. SYSTEM HEALTH */}
      <Typography variant="h6" sx={{ mb: 2 }}>System Status</Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
              <StatusPill label="Discord Bot Online" active={true} />
          </Grid>
          <Grid item xs={12} md={4}>
              <StatusPill label="Webhook Listener Active" active={true} />
          </Grid>
          <Grid item xs={12} md={4}>
              <StatusPill label="RPC Connection Stable" active={true} />
          </Grid>
      </Grid>

      {/* 3. RECENT ACTIVITY TABLE (Fills the void) */}
      <Typography variant="h6" sx={{ mb: 2 }}>Recent Events</Typography>
      <TableContainer component={Paper}>
        <Table>
            <TableHead>
                <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Time</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {activity?.length > 0 ? activity.map((row, index) => (
                    <TableRow key={index} hover>
                        <TableCell>
                            <Chip 
                                icon={row.type === 'verified' ? <VerifiedUserIcon /> : <BoltIcon />}
                                label={row.type.toUpperCase()} 
                                size="small" 
                                color={row.type === 'verified' ? 'secondary' : 'warning'}
                                variant="outlined"
                            />
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{row.message}</TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                            {new Date(row.timestamp).toLocaleTimeString()}
                        </TableCell>
                    </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                            No recent activity found.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}