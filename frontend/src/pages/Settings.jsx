import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid } from '@mui/x-data-grid';
import {
    Box,
    Typography,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Tooltip,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSnackbar } from 'notistack';
import api from '../api';

// This dialog handles both creating and editing a role.
const RoleDialog = ({ open, onClose, role, onSave }) => {
    const [formData, setFormData] = useState({
        roleName: role?.roleName || '',
        roleId: role?.roleId || '',
        // The threshold is treated as a string to handle BigInts.
        // It directly reflects the database value.
        threshold: role?.threshold ? role.threshold.toString() : '0',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = () => {
        // Send the form data directly. The backend expects the threshold as a string.
        onSave(formData);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>
                {role ? 'Edit Role Threshold' : 'Add New Role Threshold'}
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
                <TextField
                    autoFocus
                    margin="dense"
                    name="roleName"
                    label="Role Name"
                    fullWidth
                    variant="outlined"
                    value={formData.roleName}
                    onChange={handleChange}
                    helperText="A friendly name for the role (e.g., Whale, Shark)."
                    sx={{ mb: 2 }}
                />
                <TextField
                    margin="dense"
                    name="roleId"
                    label="Discord Role ID"
                    fullWidth
                    variant="outlined"
                    value={formData.roleId}
                    onChange={handleChange}
                    helperText="The actual ID of the role from your Discord server."
                    sx={{ mb: 2 }}
                />
                <TextField
                    margin="dense"
                    name="threshold"
                    label="Threshold"
                    type="text" // Use text to handle large numbers as strings without corruption
                    inputProps={{ pattern: '[0-9]*' }} // Allow only digits
                    fullWidth
                    variant="outlined"
                    value={formData.threshold}
                    onChange={handleChange}
                    helperText="The exact balance a user must have to get this role (e.g., 1000000)."
                />
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSubmit} variant="contained">
                    Save Role
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default function Settings() {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);

    const { data: roles = [], isLoading } = useQuery({
        queryKey: ['roles'],
        queryFn: () => api.get('/roles').then((res) => res.data),
    });

    const mutationOptions = {
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        },
        onError: (error) => {
            enqueueSnackbar(
                error.response?.data?.error || 'An error occurred',
                { variant: 'error' }
            );
        },
    };

    const createMutation = useMutation({
        mutationFn: (newRole) => api.post('/roles', newRole),
        ...mutationOptions,
        onSuccess: () => {
            enqueueSnackbar('Role created successfully', {
                variant: 'success',
            });
            mutationOptions.onSuccess();
        },
    });

    const updateMutation = useMutation({
        mutationFn: (updatedRole) =>
            api.put(`/roles/${updatedRole.id}`, updatedRole),
        ...mutationOptions,
        onSuccess: () => {
            enqueueSnackbar('Role updated successfully', {
                variant: 'success',
            });
            mutationOptions.onSuccess();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/roles/${id}`),
        ...mutationOptions,
        onSuccess: () => {
            enqueueSnackbar('Role deleted successfully', {
                variant: 'success',
            });
            mutationOptions.onSuccess();
        },
    });

    const handleOpenDialog = (role = null) => {
        setSelectedRole(role);
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setSelectedRole(null);
    };

    const handleSave = (roleData) => {
        if (selectedRole) {
            updateMutation.mutate({ ...roleData, id: selectedRole.id });
        } else {
            createMutation.mutate(roleData);
        }
    };

    const columns = [
        { field: 'roleName', headerName: 'Role Name', width: 250 },
        { field: 'roleId', headerName: 'Discord Role ID', width: 250 },
        {
            field: 'threshold',
            headerName: 'Threshold',
            width: 250,
            renderCell: (params) => {
                try {
                    // Format the number with commas for readability
                    return (
                        <Typography>{BigInt(params.value).toLocaleString()}</Typography>
                    );
                } catch (e) {
                    return <Typography>N/A</Typography>;
                }
            },
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 150,
            sortable: false,
            renderCell: (params) => (
                <Box>
                    <Tooltip title="Edit Role">
                        <IconButton
                            onClick={() => handleOpenDialog(params.row)}
                        >
                            <EditIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Role">
                        <IconButton
                            color="error"
                            onClick={() => deleteMutation.mutate(params.row.id)}
                        >
                            <DeleteIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            ),
        },
    ];

    return (
        <Box sx={{ height: 600, width: '100%' }}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                }}
            >
                <Typography variant="h4">Role Thresholds</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddCircleIcon />}
                    onClick={() => handleOpenDialog()}
                >
                    Add New Role
                </Button>
            </Box>
            <DataGrid
                rows={roles}
                columns={columns}
                loading={
                    isLoading ||
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    deleteMutation.isPending
                }
                getRowId={(row) => row.id}
                autoHeight
            />
            {dialogOpen && (
                <RoleDialog
                    open={dialogOpen}
                    onClose={handleCloseDialog}
                    role={selectedRole}
                    onSave={handleSave}
                />
            )}
        </Box>
    );
}