import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid } from '@mui/x-data-grid';
import { Button, Box, Typography, Chip } from '@mui/material';
import api from '../api';
import { useSnackbar } from 'notistack';

export default function Wallets() {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    const { data: wallets = [], isLoading: isLoadingWallets } = useQuery({
        queryKey: ['wallets'],
        queryFn: () => api.get('/wallets').then((res) => res.data),
    });

    const deleteMutation = useMutation({
        mutationFn: (address) => api.delete(`/wallets/${address}`),
        onSuccess: () => {
            enqueueSnackbar('Wallet deleted', { variant: 'success' });
            queryClient.invalidateQueries(['wallets']);
        },
        onError: () => {
            enqueueSnackbar('Delete failed', { variant: 'error' });
        },
    });

    const verifyMutation = useMutation({
        mutationFn: (address) => api.post(`/wallets/${address}/verify`),
        onSuccess: () => {
            enqueueSnackbar('Wallet verified manually', { variant: 'success' });
            queryClient.invalidateQueries(['wallets']);
        },
        onError: () => {
            enqueueSnackbar('Verification failed', { variant: 'error' });
        },
    });

    const handleDelete = (address) => {
        if (!confirm('Are you sure?')) return;
        deleteMutation.mutate(address);
    };

    const handleVerify = (address) => {
        verifyMutation.mutate(address);
    };

    const columns = [
        { field: 'address', headerName: 'Wallet Address', width: 450 },
        { field: 'userId', headerName: 'Discord ID', width: 200 },
        {
            field: 'isVerified',
            headerName: 'Status',
            width: 150,
            renderCell: (params) => (
                <Chip
                    label={params.value ? 'Verified' : 'Pending'}
                    color={params.value ? 'success' : 'warning'}
                    size="small"
                />
            ),
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 250,
            renderCell: (params) => (
                <Box>
                    {!params.row.isVerified && (
                        <Button
                            onClick={() => handleVerify(params.row.address)}
                            size="small"
                            disabled={verifyMutation.isLoading}
                        >
                            Verify
                        </Button>
                    )}
                    <Button
                        onClick={() => handleDelete(params.row.address)}
                        color="error"
                        size="small"
                        disabled={deleteMutation.isLoading}
                    >
                        Delete
                    </Button>
                </Box>
            ),
        },
    ];

    return (
        <Box sx={{ height: 600, width: '100%' }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
                Wallet Manager
            </Typography>
            <DataGrid
                rows={wallets}
                columns={columns}
                loading={
                    isLoadingWallets ||
                    deleteMutation.isLoading ||
                    verifyMutation.isLoading
                }
                getRowId={(row) => row.address} // Assuming address is unique ID
                pageSizeOptions={[10, 50, 100]}
                initialState={{
                    pagination: { paginationModel: { pageSize: 10 } },
                }}
            />
        </Box>
    );
}
