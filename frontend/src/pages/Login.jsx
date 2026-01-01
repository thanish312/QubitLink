import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, Container, InputAdornment } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import KeyIcon from '@mui/icons-material/Key';
import api from '../api';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await api.post('/auth', { password });
      localStorage.setItem('admin_token', res.data.token);
      // Give a small delay for smoother UX
      setTimeout(() => navigate('/dashboard'), 500);
    } catch {
      setError('Access Denied: Invalid Password');
      setLoading(false);
    }
  };

  return (
    <Box sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1b1e 0%, #0f1012 100%)'
    }}>
      <Container maxWidth="xs">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{ 
                width: 60, height: 60, borderRadius: '50%', 
                bgcolor: 'primary.main', display: 'flex', 
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px auto', boxShadow: '0 0 20px rgba(88, 101, 242, 0.5)'
            }}>
                <LockIcon sx={{ fontSize: 30, color: 'white' }} />
            </Box>
            <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                QubicLink
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Secure Admin Portal
            </Typography>
        </Box>

        <Card sx={{ 
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)', 
            border: '1px solid rgba(255,255,255,0.05)' 
        }}>
          <CardContent sx={{ p: 4 }}>
            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                type="password"
                label="Admin Password"
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <KeyIcon color="action" />
                        </InputAdornment>
                    ),
                }}
                sx={{ mb: 3 }}
              />
              
              {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                    {error}
                </Alert>
              )}
              
              <Button 
                fullWidth 
                variant="contained" 
                size="large" 
                type="submit"
                disabled={loading}
                sx={{ 
                    height: 48,
                    fontSize: '1rem',
                    background: 'linear-gradient(45deg, #5865F2 30%, #4752C4 90%)'
                }}
              >
                {loading ? 'Authenticating...' : 'Login to Dashboard'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}