import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Chip,
    LinearProgress,
    Avatar,
} from '@mui/material';
import api from '../api';

const DetailCard = ({ title, children }) => (
    <Paper sx={{ p: 2, height: '100%' }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {title}
        </Typography>
        {children}
    </Paper>
);

export default function User() {
    const { discordId } = useParams();

    const { data: user, isLoading } = useQuery({
        queryKey: ['user', discordId],
        queryFn: () => api.get(`/users/${discordId}`).then((res) => res.data),
    });

    if (isLoading) return <LinearProgress />;

    return (
        <Box>
            <Paper
                sx={{
                    p: 3,
                    mb: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                }}
            >
                <Avatar
                    src={user.discordUser.avatarURL}
                    sx={{ width: 80, height: 80 }}
                />
                <Box>
                    <Typography variant="h4">
                        {user.discordUser.username}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                        {user.discordUser.tag}
                    </Typography>
                </Box>
            </Paper>

            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <DetailCard title="User ID">
                        <Typography variant="h6">{user.discordId}</Typography>
                    </DetailCard>
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailCard title="First Seen">
                        <Typography variant="h6">
                            {new Date(user.createdAt).toLocaleString()}
                        </Typography>
                    </DetailCard>
                </Grid>
                <Grid item xs={12}>
                    <DetailCard title="Wallets">
                        {user.wallets.map((wallet) => (
                            <Box key={wallet.address} sx={{ mb: 1 }}>
                                <Typography>{wallet.address}</Typography>
                                <Chip
                                    label={
                                        wallet.isVerified
                                            ? 'Verified'
                                            : 'Pending'
                                    }
                                    color={
                                        wallet.isVerified
                                            ? 'success'
                                            : 'warning'
                                    }
                                    size="small"
                                />
                            </Box>
                        ))}
                    </DetailCard>
                </Grid>
                <Grid item xs={12}>
                    <DetailCard title="Challenges">
                        {user.challenges.map((challenge) => (
                            <Box key={challenge.id} sx={{ mb: 1 }}>
                                <Typography>
                                    {challenge.walletAddress} -{' '}
                                    {challenge.signalCode}
                                </Typography>
                                <Chip
                                    label={
                                        new Date(challenge.expiresAt) >
                                        new Date()
                                            ? 'Active'
                                            : 'Expired'
                                    }
                                    color={
                                        new Date(challenge.expiresAt) >
                                        new Date()
                                            ? 'success'
                                            : 'default'
                                    }
                                    size="small"
                                />
                            </Box>
                        ))}
                    </DetailCard>
                </Grid>
            </Grid>
        </Box>
    );
}
