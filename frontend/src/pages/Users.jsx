import { useQuery } from '@tanstack/react-query';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Typography, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Users() {
    const navigate = useNavigate();

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: () => api.get('/users').then((res) => res.data),
    });

    const columns = [
        { field: 'discordId', headerName: 'Discord ID', width: 200 },
        {
            field: 'verifiedCount',
            headerName: 'Verified Wallets',
            width: 150,
            renderCell: (params) => (
                <Chip
                    label={params.value}
                    color={params.value > 0 ? 'success' : 'default'}
                    size="small"
                />
            ),
        },
        { field: 'totalCount', headerName: 'Total Wallets', width: 150 },
        {
            field: 'createdAt',
            headerName: 'First Seen',
            width: 200,
            renderCell: (params) => new Date(params.value).toLocaleString(),
        },
    ];

    const handleRowClick = (params) => {
        navigate(`/users/${params.row.discordId}`);
    };

    return (
        <Box sx={{ height: 600, width: '100%' }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
                User Manager
            </Typography>
            <DataGrid
                rows={users}
                columns={columns}
                loading={isLoading}
                getRowId={(row) => row.discordId}
                onRowClick={handleRowClick}
                pageSizeOptions={[10, 50, 100]}
                initialState={{
                    pagination: { paginationModel: { pageSize: 10 } },
                }}
                sx={{
                    '& .MuiDataGrid-row:hover': {
                        cursor: 'pointer',
                    },
                }}
            />
        </Box>
    );
}
