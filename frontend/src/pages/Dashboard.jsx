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
    Divider,
    Container,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/PeopleRounded';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUserRounded';
import PendingIcon from '@mui/icons-material/PendingActionsRounded';
import BoltIcon from '@mui/icons-material/BoltRounded';
import SyncIcon from '@mui/icons-material/Sync';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import HowToRegIcon from '@mui/icons-material/HowToReg';
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
            sx={{
                p: 4,
                height: '100%',
                minHeight: 180,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
            }}
        >
            <Box sx={{ position: 'relative', zIndex: 2 }}>
                <Typography
                    variant="subtitle1"
                    color="text.secondary"
                    gutterBottom
                    sx={{ fontSize: '1rem' }}
                >
                    {title}
                </Typography>
                <Typography variant="h2" sx={{ fontWeight: 'bold', mb: 1 }}>
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
                    right: -20,
                    bottom: -20,
                    opacity: 0.15,
                    color: color,
                    transform: 'scale(6)',
                }}
            >
                {icon}
            </Box>
        </Paper>
    );
});

const ControlCenter = () => {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: () => api.post('/jobs/refresh'),
        onSuccess: (data) => {
            enqueueSnackbar(data.data.message || 'Manual refresh initiated.', {
                variant: 'info',
            });
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['stats'] });
                queryClient.invalidateQueries({ queryKey: ['recent_activity'] });
            }, 10000);
        },
        onError: (error) => {
            enqueueSnackbar(
                error.response?.data?.error || 'Failed to start refresh job.',
                { variant: 'error' }
            );
        },
    });

    const StatusPill = React.memo(function StatusPill({ label, active }) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                }}
            >
                <Typography variant="subtitle2" sx={{ fontWeight: 500, color: 'text.primary', fontSize: '1rem' }}>
                    {label}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                     <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, color: active ? '#10b981' : '#ef4444' }}
                    >
                        {active ? 'Online' : 'Offline'}
                    </Typography>
                    <Box
                        sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: active ? '#10b981' : '#ef4444',
                            boxShadow: active ? '0 0 8px #10b981' : 'none',
                        }}
                    />
                </Box>
            </Box>
        );
    });

    return (
        <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, height: '100%', minHeight: 500 }}>
            <Typography variant="h5" sx={{ px: 1, pt: 1, fontWeight: 600 }}>Control Center</Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 1 }}>
                <StatusPill label="Discord Bot" active={true} />
                <StatusPill label="Webhook Listener" active={true} />
                <StatusPill label="RPC Connection" active={true} />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2, p: 2, flexGrow: 1 }}>
                 <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Manual Sync</Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                    Force an immediate portfolio and role synchronization for all users.
                </Typography>
                 <Button
                    variant="contained"
                    color="secondary"
                    size="large"
                    startIcon={<SyncIcon />}
                    onClick={() => mutate()}
                    disabled={isPending}
                    sx={{ py: 1.5, fontSize: '1rem' }}
                >
                    {isPending ? 'Refreshing...' : 'Force Refresh'}
                </Button>
            </Box>
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

    // Robustly format Qubic balance using BigInt arithmetic
    const formatQubic = (balance) => {
        try {
            const balanceInQubic = BigInt(balance || 0);

            const qubicUnits = balanceInQubic;

            const ONE_TRILLION_UNITS = 1000000000000n;
            const ONE_BILLION_UNITS = 1000000000n;
            const ONE_MILLION_UNITS = 1000000n;
            const ONE_THOUSAND_UNITS = 1000n;

            if (qubicUnits >= ONE_TRILLION_UNITS) {
                const trillions = Number(qubicUnits * 100n / ONE_TRILLION_UNITS) / 100;
                return `${trillions.toFixed(2)}T`;
            }
            if (qubicUnits >= ONE_BILLION_UNITS) {
                const billions = Number(qubicUnits * 100n / ONE_BILLION_UNITS) / 100;
                return `${billions.toFixed(2)}B`;
            }
            if (qubicUnits >= ONE_MILLION_UNITS) {
                const millions = Number(qubicUnits * 100n / ONE_MILLION_UNITS) / 100;
                return `${millions.toFixed(2)}M`;
            }
            if (qubicUnits >= ONE_THOUSAND_UNITS) {
                const thousands = Number(qubicUnits * 100n / ONE_THOUSAND_UNITS) / 100;
                return `${thousands.toFixed(1)}K`;
            }
            return Number(qubicUnits).toLocaleString();
        } catch (error) {
            console.error("Error formatting Qubic balance:", error);
            return '0';
        }
    };

    return (
        <Container maxWidth={false} sx={{ py: 5, px: 5 }}>
            <Box sx={{ mb: 5 }}>
                <Typography variant="h3" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
                    Dashboard Overview
                </Typography>
                <Typography variant="h6" color="text.secondary">
                    Welcome back, Admin. Here&apos;s what&apos;s happening today.
                </Typography>
            </Box>

            <Grid container spacing={4} sx={{ mb: 5 }}>
                <Grid item xs={12} sm={6} lg={3}>
                    <DashboardCard
                        title="Total QUBIC Managed"
                        value={formatQubic(data?.totalBalance)}
                        icon={<AccountBalanceWalletIcon />}
                        color="#10b981"
                        subtext="Across all verified wallets"
                    />
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                    <DashboardCard
                        title="Discord Users"
                        value={(data?.totalUsers || 0).toLocaleString()}
                        icon={<PeopleIcon />}
                        color="#6366f1"
                        subtext="Unique members tracked"
                    />
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                    <DashboardCard
                        title="Total Verified Wallets"
                        value={(data?.totalVerified || 0).toLocaleString()}
                        icon={<VerifiedUserIcon />}
                        color="#3b82f6"
                        subtext="Lifetime verifications"
                    />
                </Grid>
                <Grid item xs={12} sm={6} lg={3}>
                    <DashboardCard
                        title="24h Verifications"
                        value={data?.recentVerifications || 0}
                        icon={<HowToRegIcon />}
                        color="#f59e0b"
                        subtext="New wallets in last 24 hours"
                    />
                </Grid>
            </Grid>

            <Grid container spacing={4}>
                <Grid item xs={12} lg={8}>
                    <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
                        Recent Events
                    </Typography>
                    <TableContainer component={Paper} sx={{ minHeight: 500 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ py: 3, fontSize: '1rem', fontWeight: 600 }}>Type</TableCell>
                                    <TableCell sx={{ py: 3, fontSize: '1rem', fontWeight: 600 }}>Description</TableCell>
                                    <TableCell align="right" sx={{ py: 3, fontSize: '1rem', fontWeight: 600 }}>Time</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {activity?.length > 0 ? (
                                    activity.map((row, index) => (
                                        <TableRow key={row.timestamp + index} hover>
                                            <TableCell sx={{ py: 3 }}>
                                                <Chip
                                                    icon={
                                                        row.type === 'verified' ? (
                                                            <VerifiedUserIcon />
                                                        ) : (
                                                            <BoltIcon />
                                                        )
                                                    }
                                                    label={row.type.toUpperCase()}
                                                    size="medium"
                                                    color={
                                                        row.type === 'verified'
                                                            ? 'secondary'
                                                            : 'warning'
                                                    }
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell sx={{ color: 'text.secondary', py: 3, fontSize: '1rem' }}>
                                                {row.message}
                                            </TableCell>
                                            <TableCell
                                                align="right"
                                                sx={{
                                                    color: 'text.secondary',
                                                    fontFamily: 'monospace',
                                                    py: 3,
                                                    fontSize: '1rem'
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
                                            sx={{ py: 8 }}
                                        >
                                            <Typography variant="body1" color="text.secondary">
                                                No recent activity found.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Grid>
                <Grid item xs={12} lg={4}>
                    <ControlCenter />
                </Grid>
            </Grid>
        </Container>
    );
}