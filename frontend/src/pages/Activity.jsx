import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Paper, List, ListItem, ListItemText, ListItemIcon, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import api from '../api';

export default function Activity() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api.get('/activity').then(res => res.data),
    refetchInterval: 10000,
  });

  if (isLoading) return <Typography>Loading...</Typography>;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4 }}>Activity Log</Typography>
      <Paper>
        <List>
          {activities?.map((item, index) => (
            <ListItem key={index} divider>
              <ListItemIcon>
                {item.type === 'verified' ? 
                  <CheckCircleIcon color="success" /> : 
                  <VpnKeyIcon color="warning" />
                }
              </ListItemIcon>
              <ListItemText 
                primary={item.message}
                secondary={new Date(item.timestamp).toLocaleString()}
              />
              <Chip 
                label={item.type.toUpperCase()} 
                size="small" 
                color={item.type === 'verified' ? 'success' : 'default'} 
              />
            </ListItem>
          ))}
          {activities?.length === 0 && (
            <ListItem><ListItemText primary="No recent activity" /></ListItem>
          )}
        </List>
      </Paper>
    </Box>
  );
}