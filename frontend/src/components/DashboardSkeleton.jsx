import { Grid, Paper, Box, Skeleton } from '@mui/material';

const DashboardSkeleton = () => (
    <Box sx={{ maxWidth: 1600, mx: 'auto' }}>
        <Box sx={{ mb: 4 }}>
            <Skeleton variant="text" width={400} height={50} />
            <Skeleton variant="text" width={600} height={20} />
        </Box>

        <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, height: '100%' }}>
                    <Skeleton variant="text" width={100} height={20} />
                    <Skeleton variant="text" width={150} height={40} />
                    <Skeleton variant="text" width={100} height={20} />
                </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, height: '100%' }}>
                    <Skeleton variant="text" width={100} height={20} />
                    <Skeleton variant="text" width={150} height={40} />
                    <Skeleton variant="text" width={100} height={20} />
                </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, height: '100%' }}>
                    <Skeleton variant="text" width={100} height={20} />
                    <Skeleton variant="text" width={150} height={40} />
                    <Skeleton variant="text" width={100} height={20} />
                </Paper>
            </Grid>
        </Grid>

        <Box sx={{ mb: 2 }}>
            <Skeleton variant="text" width={200} height={30} />
        </Box>

        <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
                <Skeleton variant="rectangular" height={50} />
            </Grid>
            <Grid item xs={12} md={4}>
                <Skeleton variant="rectangular" height={50} />
            </Grid>
            <Grid item xs={12} md={4}>
                <Skeleton variant="rectangular" height={50} />
            </Grid>
        </Grid>

        <Box sx={{ mb: 2 }}>
            <Skeleton variant="text" width={200} height={30} />
        </Box>

        <Skeleton variant="rectangular" height={200} />
    </Box>
);

export default DashboardSkeleton;
