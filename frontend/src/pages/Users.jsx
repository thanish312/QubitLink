import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Typography, Chip, TextField, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from '../api';

// Custom hook for debouncing a value
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

export default function Users() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users', debouncedSearchTerm],
        queryFn: () =>
            api.get('/users', {
                params: { search: debouncedSearchTerm || undefined },
            }).then((res) => res.data),
    });

    const columns = [
        {
            field: 'user',
            headerName: 'User',
            width: 250,
            renderCell: (params) => {
                const { avatar, discordId, username, discriminator } = params.row;

                const avatarUrl = avatar
                    ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${
                          avatar.startsWith('a_') ? 'gif' : 'png'
                      }?size=64`
                    : null;

                return (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            width: '100%',
                            height: '100%', // This is key for vertical alignment in DataGrid
                        }}
                    >
                        <Avatar
                            src={avatarUrl || undefined}
                            alt={username}
                            sx={{
                                width: 24,
                                height: 24,
                                fontSize: 12,
                                flexShrink: 0,
                            }}
                        >
                            {!avatar && username?.[0]?.toUpperCase()}
                        </Avatar>

                        <Typography
                            variant="body2"
                            sx={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                lineHeight: 1, // Prevents the text from clinging to the top
                            }}
                        >
                            {username}
                            {discriminator && discriminator !== '0'
                                ? `#${discriminator}`
                                : ''}
                        </Typography>
                    </Box>
                );
            },
        },
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
            <TextField
                label="Search by Username"
                variant="outlined"
                fullWidth
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ mb: 2 }}
            />
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
