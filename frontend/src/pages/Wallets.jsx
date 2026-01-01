import { useEffect, useState, useCallback } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Button, Box, Typography, Chip } from '@mui/material';
import api from '../api';
import { useSnackbar } from 'notistack';

export default function Wallets() {
    const [wallets, setWallets] = useState([]);
    const [loading, setLoading] = useState(true);
    const { enqueueSnackbar } = useSnackbar();

    const fetchWallets = useCallback(async () => {
        try {
            const res = await api.get('/wallets'); // You might want to add pagination to your backend API later
            setWallets(res.data);
        } catch {
            enqueueSnackbar('Failed to load wallets', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar]);

    const handleDelete = async (id) => {
        if(!confirm('Are you sure?')) return;
        try {
            await api.delete(`/wallets/${id}`);
            enqueueSnackbar('Wallet deleted', { variant: 'success' });
            fetchWallets();
        } catch {
            enqueueSnackbar('Delete failed', { variant: 'error' });
        }
    };

    const handleVerify = async (id) => {
        try {
            await api.post(`/wallets/${id}/verify`);
            enqueueSnackbar('Wallet verified manually', { variant: 'success' });
            fetchWallets();
        } catch {
            enqueueSnackbar('Verification failed', { variant: 'error' });
        }
    };

    useEffect(() => { fetchWallets(); }, [fetchWallets]);

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
            )
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 250,
            renderCell: (params) => (
                <Box>
                    {!params.row.isVerified && (
                        <Button onClick={() => handleVerify(params.row.id)} size="small">Verify</Button>
                    )}
                    <Button onClick={() => handleDelete(params.row.id)} color="error" size="small">Delete</Button>
                </Box>
            )
        }
    ];

    return (
        <Box sx={{ height: 600, width: '100%' }}>
            <Typography variant="h4" sx={{ mb: 2 }}>Wallet Manager</Typography>
            <DataGrid
                rows={wallets}
                columns={columns}
                loading={loading}
                getRowId={(row) => row.address} // Assuming address is unique ID
                pageSizeOptions={[10, 50, 100]}
                initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            />
        </Box>
    );
}