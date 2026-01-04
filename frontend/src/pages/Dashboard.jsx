import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/PeopleRounded';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUserRounded';
import PendingIcon from '@mui/icons-material/PendingActionsRounded';
import BoltIcon from '@mui/icons-material/BoltRounded';
import SyncIcon from '@mui/icons-material/Sync';
import api from '../api';
import DashboardSkeleton from '../components/DashboardSkeleton';

// A styled card component for consistency
const DashboardCard = React.memo(function DashboardCard({
    title,
    value,
    icon,
    color,
    subtext,
}) {
    return (
        <Paper
            sx={{ p: 3, height: '100%', position: 'relative', overflow: 'hidden' }}
        >
            <Box sx={{ position: 'relative', zIndex: 2 }}>
                <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    gutterBottom
                >
                    {title}
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {value}
                </Typography>
                {subtext && (
                    <Typography variant="body2" color="text.secondary">
                        {subtext}
                    </Typography>
                )}
            </Box>
            {/* Decorative Icon in background */}
            <Box
                sx={{
                    position: 'absolute',
                    right: -10,
                    bottom: -10,
                    opacity: 0.1,
                    color: color,
                    transform: 'scale(4)',
                }}
            >
                {icon}
            </Box>
        </Paper>
    );
});

const StatusPill = React.memo(function StatusPill({ label, active }) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 2,
                borderRadius: 2,
                bgcolor: active
                    ? 'rgba(16, 185, 129, 0.1)'
                    : 'rgba(239, 68, 68, 0.1)',
                border: '1px solid',
                borderColor: active
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(239, 68, 68, 0.2)',
            }}
        >
            <Box
                sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: active ? '#10b981' : '#ef4444',
                    boxShadow: active ? '0 0 10px #10b981' : 'none',
                }}
            />
            <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, color: active ? '#10b981' : '#ef4444' }}
            >
                {label}
            </Typography>
        </Box>
    );
});

const ManualRefreshCard = () => {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: () => api.post('/jobs/refresh'),
        onSuccess: (data) => {
            enqueueSnackbar(data.data.message || 'Manual refresh initiated.', { variant: 'info' });
            // Invalidate queries to refetch data after the refresh is complete
            setTimeout(() => {
                queryClient.invalidateQueries(['stats']);
                queryClient.invalidateQueries(['recent_activity']);
            }, 10000); // Give it some time to process
        },
        onError: (error) => {
            enqueueSnackbar(error.response?.data?.error || 'Failed to start refresh job.', { variant: 'error' });
        },
    });

    return (
        <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6">Manual Sync</Typography>
            <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                    Force an immediate portfolio and role synchronization for all users. The next scheduled job will be delayed accordingly.
                </Typography>
            </Box>
            <Button
                variant="contained"
                color="secondary"
                startIcon={<SyncIcon />}
                onClick={() => mutate()}
                disabled={isPending}
            >
                {isPending ? 'Refreshing...' : 'Force Refresh & Role Sync'}
            </Button>
        </Paper>
    );
};

export default function Dashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ['stats'],
        queryFn: () => api.get('/stats').then((res) => res.data),
        refetchInterval: 30000,
    });

    const { data: activity } = useQuery({
        queryKey: ['recent_activity'],
        queryFn: () => api.get('/activity?limit=5').then((res) => res.data),
    });

    if (isLoading) return <DashboardSkeleton />;

    return (
        <Box sx={{ maxWidth: 1600, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
                <Typography variant="h4" sx={{ color: 'white' }}>
                    Dashboard Overview
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Welcome back, Admin. Here&apos;s what&apos;s happening today.
                </Typography>
            </Box>

            <Grid container spacing={3}>
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

            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        System Status
                    </Typography>
                    <Grid container spacing={2}>
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
                </Grid>
                <Grid item xs={12} md={4}>
                     <ManualRefreshCard />
                </Grid>
            </Grid>
            

            <div>
                <Typography variant="h6" sx={{ mb: 2 }}>
                    Recent Events
                </Typography>
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
                            {activity?.length > 0 ? (
                                activity.map((row) => (
                                    <TableRow key={row.id || row.timestamp} hover>
                                        <TableCell>
                                            <Chip
                                                icon={
                                                    row.type === 'verified' ? (
                                                        <VerifiedUserIcon />
                                                    ) : (
                                                        <BoltIcon />
                                                    )
                                                }
                                                label={row.type.toUpperCase()}
                                                size="small"
                                                color={
                                                    row.type === 'verified'
                                                        ? 'secondary'
                                                        : 'warning'
                                                }
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell sx={{ color: 'text.secondary' }}>
                                            {row.message}
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                color: 'text.secondary',
                                                fontFamily: 'monospace',
                                            }}
                                        >
                                            {new Date(
                                                row.timestamp
                                            ).toLocaleTimeString()}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={3}
                                        align="center"
                                        sx={{ py: 3 }}
                                    >
                                        No recent activity found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </div>
        </Box>
    );
}