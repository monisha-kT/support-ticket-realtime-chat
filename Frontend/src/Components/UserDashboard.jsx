import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Paper,
  Snackbar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChatIcon from '@mui/icons-material/Chat';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from './Navbar';
import { getSocket } from './socket';

function UserDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [newTicket, setNewTicket] = useState({
    category: '',
    urgency: '',
    description: ''
  });
  const user = useStore((state) => state.user);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/auth');
      return;
    }

    if (user?.role !== 'user') {
      navigate('/member/dashboard');
      return;
    }

    fetchTickets();
  }, [user?.role, navigate]);

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!res.ok) throw new Error('Failed to fetch tickets');
      
      const data = await res.json();
      setTickets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: newTicket.category,
          urgency: newTicket.urgency,
          description: newTicket.description,
          user_id: user.id
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create ticket');
      }

      const data = await res.json();
      setDialogOpen(false);
      setNewTicket({ category: '', urgency: '', description: '' });
      setNotification({
        type: 'success',
        message: 'Ticket created successfully'
      });

      // Get socket instance and emit ticket creation event
      const socket = getSocket();
      if (socket) {
        socket.emit('ticket_created', {
          ticket_id: data.ticket_id,
          user_id: user.id,
          category: newTicket.category,
          urgency: newTicket.urgency,
          description: newTicket.description
        });
      }

      fetchTickets();

    } catch (err) {
      setNotification({
        type: 'error',
        message: err.message
      });
    }
  };

  const handleChatClick = (ticket) => {
    navigate(`/user/chat?selectedTicketId=${ticket.id}`);
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <Box sx={{ p: 2, mt: 8 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <Box sx={{ 
        p: 4, 
        mt: '64px',
        bgcolor: '#f0f2f5',
        minHeight: 'calc(100vh - 64px)'
      }}>
        <Box sx={{ 
          maxWidth: 1200, 
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 3
        }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              My Support Tickets
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{ 
                bgcolor: '#128C7E',
                '&:hover': {
                  bgcolor: '#075E54'
                }
              }}
            >
              New Ticket
            </Button>
          </Box>

          {/* Tickets Grid */}
        
          <Grid container spacing={2}>
            {tickets.map((ticket) => (
              <Grid item xs={12} sm={6} md={4} key={ticket.id}>
                <Paper 
                  elevation={3}
                  sx={{ 
                    p: 2,
                    
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    
                    position: 'relative',
                    '&:hover': {
                      boxShadow: 6
                    }
                  }}
                >
                  <Typography variant="h6">
                    Ticket #{ticket.id}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Category: {ticket.category}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Urgency: {ticket.urgency}
                  </Typography>
                  <Typography
                    sx={{
                      px: 1,
                   
                      py: 0.5,
                      borderRadius: 1,
                      display: 'inline-block',
                      width: 'fit-content',
                      color: 'white',
                      bgcolor:
                        ticket.status === 'open'
                          ? '#ff9800'
                          : ticket.status === 'assigned'
                          ? '#4caf50'
                          : ticket.status === 'rejected'
                          ? '#f44336'
                          : ticket.status === 'closed'
                          ? '#2196f3'
                          : 'inherit',
                    }}
                  >
                    {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                  </Typography>
                  {ticket.status === 'assigned' && (
                    <Button
                      startIcon={<ChatIcon />}
                      onClick={() => handleChatClick(ticket)}
                      sx={{ 
                        mt: 'auto',
                        color: '#128C7E',
                        '&:hover': {
                          bgcolor: 'rgba(18, 140, 126, 0.08)'
                        }
                      }}
                    >
                      Chat with Support
                    </Button>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      {/* Create Ticket Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Support Ticket</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={newTicket.category}
                label="Category"
                onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
              >
                <MenuItem value="Technical">Technical</MenuItem>
                <MenuItem value="Billing">Billing</MenuItem>
                <MenuItem value="General">General</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Urgency</InputLabel>
              <Select
                value={newTicket.urgency}
                label="Urgency"
                onChange={(e) => setNewTicket({ ...newTicket, urgency: e.target.value })}
              >
                <MenuItem value="Low">Low</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="High">High</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Description"
              value={newTicket.description}
              onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateTicket}
            variant="contained"
            disabled={!newTicket.category || !newTicket.urgency || !newTicket.description}
            sx={{ 
              bgcolor: '#128C7E',
              '&:hover': {
                bgcolor: '#075E54'
              }
            }}
          >
            Create Ticket
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {notification && (
          <Alert
            onClose={() => setNotification(null)}
            severity={notification.type}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        )}
      </Snackbar>
    </>
  );
}

export default UserDashboard;
