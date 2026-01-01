import { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, Paper, Grid, Alert, Divider, InputAdornment } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useSnackbar } from 'notistack';
import api from '../api';

export default function Settings() {
  const [config, setConfig] = useState({
    verifiedRoleId: '',
    whaleRoleId: '',
    whaleThreshold: '',
    signalCodeMin: '',
    signalCodeMax: '',
    challengeExpiryMinutes: '' // Frontend uses Minutes
  });
  const [loading, setLoading] = useState(true);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    // Fetch config and convert ms to minutes for display
    api.get('/config').then(res => {
        const data = res.data;
        setConfig({
            ...data,
            challengeExpiryMinutes: Math.floor(data.challengeExpiryMs / 60000) // Convert ms -> min
        });
        setLoading(false);
    }).catch(() => {
        enqueueSnackbar('Failed to load settings', { variant: 'error' });
        setLoading(false);
    });
  }, [enqueueSnackbar]);

  const handleChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      // Convert Minutes back to Milliseconds for the API
      const payload = {
        ...config,
        challengeExpiryMs: config.challengeExpiryMinutes * 60000
      };

      await api.put('/config', payload);
      enqueueSnackbar('Runtime configuration updated successfully!', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to save configuration', { variant: 'error' });
    }
  };

  if (loading) return <Typography>Loading configuration...</Typography>;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, justifyContent: 'space-between' }}>
          <Typography variant="h4">System Configuration</Typography>
          <Button 
            variant="contained" 
            size="large" 
            startIcon={<SaveIcon />}
            onClick={handleSave}
          >
            Apply Changes
          </Button>
      </Box>

      <Alert icon={<WarningAmberIcon />} severity="info" sx={{ mb: 4, border: '1px solid #2d4d66' }}>
        <strong>Runtime Mode:</strong> These settings are applied instantly to the running bot. 
        However, for security reasons, they are not saved to the <code>.env</code> file. 
        If you restart the bot, settings will revert to the defaults.
      </Alert>
      
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ color: 'primary.main', mb: 2 }}>🤖 Discord Integration</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField 
              fullWidth label="Verified Role ID" name="verifiedRoleId" 
              value={config.verifiedRoleId} onChange={handleChange} 
              placeholder="e.g. 123456789..."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField 
              fullWidth label="Whale Role ID" name="whaleRoleId" 
              value={config.whaleRoleId} onChange={handleChange} 
              placeholder="e.g. 987654321..."
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 4 }} />

        <Typography variant="h6" sx={{ color: 'primary.main', mb: 2 }}>⚙️ Logic & Thresholds</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField 
              fullWidth label="Whale Threshold (QUBIC)" name="whaleThreshold" 
              value={config.whaleThreshold} onChange={handleChange}
              helperText="The balance required to automatically receive the Whale role."
              InputProps={{
                  endAdornment: <InputAdornment position="end">QUs</InputAdornment>
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField 
              fullWidth label="Challenge Expiry" name="challengeExpiryMinutes" 
              type="number"
              value={config.challengeExpiryMinutes} onChange={handleChange} 
              helperText="How long a verification code is valid."
              InputProps={{
                  endAdornment: <InputAdornment position="end">Minutes</InputAdornment>,
                  startAdornment: <InputAdornment position="start"><AccessTimeIcon fontSize="small"/></InputAdornment>
              }}
            />
          </Grid>
          <Grid item xs={6} md={4}>
            <TextField 
              fullWidth label="Min Shares (Signal)" name="signalCodeMin" 
              type="number"
              value={config.signalCodeMin} onChange={handleChange} 
            />
          </Grid>
          <Grid item xs={6} md={4}>
            <TextField 
              fullWidth label="Max Shares (Signal)" name="signalCodeMax" 
              type="number"
              value={config.signalCodeMax} onChange={handleChange} 
            />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}