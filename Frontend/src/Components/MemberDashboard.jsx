import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Container,
  Paper,
  Modal,
  Grid,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { getSocket } from './socket';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from './Navbar';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import ChatWindow from './ChatWindow';

function MemberDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [members, setMembers] = useState([]);
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const socketRef = useRef(null);
   const gridRef = useRef();

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = getSocket();

    if (socketRef.current) {
      socketRef.current.on('ticket_created', (ticket) => {
        setNotifications(prev => [...prev, {
          id: ticket.ticket_id,
          type: 'new',
          message: `New ticket #${ticket.ticket_id} created`,
          ticket
        }]);
        fetchTickets();
      });

      socketRef.current.on('chat_inactive', ({ ticket_id, reason, reassigned_to }) => {
        setTickets(prev => prev.map(t => 
          t.id === ticket_id ? { ...t, status: 'closed', closure_reason: reason, reassigned_to } : t
        ));
        if (selectedTicket?.id === ticket_id) {
          setSelectedTicket(prev => ({ ...prev, status: 'closed', closure_reason: reason, reassigned_to }));
        }
      });

      socketRef.current.on('ticket_reopened', ({ ticket_id }) => {
        fetchTickets();
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('ticket_created');
        socketRef.current.off('chat_inactive');
        socketRef.current.off('ticket_reopened');
      }
    };
  }, []);

  // Fetch tickets and members
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/auth');
      return;
    }

    if (user?.role !== 'member') {
      navigate('/dashboard');
      return;
    }

    fetchTickets();
    fetchMembers();
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
      const userIds = [...new Set(data.map(ticket => ticket.user_id))];
      const usersRes = await fetch('http://localhost:5000/api/users/bulk', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_ids: userIds }),
      });
      if (!usersRes.ok) throw new Error('Failed to fetch user details');
      const usersData = await usersRes.json();

      const ticketsWithUserDetails = data
        .filter(ticket => 
          (ticket.status === 'assigned' && ticket.assigned_to === user.id) ||
          ticket.status === 'open' ||
          (ticket.status === 'closed' && ticket.assigned_to === user.id)
        )
        .map(ticket => ({
          ...ticket,
          userName: usersData[ticket.user_id]
            ? `${usersData[ticket.user_id].first_name} ${usersData[ticket.user_id].last_name}`
            : 'Unknown',
          userEmail: usersData[ticket.user_id]?.email || 'N/A',
        }));

      setTickets(ticketsWithUserDetails);

      if (selectedTicket) {
        const updatedSelectedTicket = ticketsWithUserDetails.find(t => t.id === selectedTicket.id);
        setSelectedTicket(updatedSelectedTicket || null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/users/members', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      const data = await res.json();
      setMembers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAcceptTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/accept/${ticketId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to accept ticket');

      setNotifications(prev => prev.filter(n => n.id !== ticketId));
      fetchTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRejectTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/reject/${ticketId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to reject ticket');

      setNotifications(prev => prev.filter(n => n.id !== ticketId));
      fetchTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTicketSelect = async (ticketId) => {
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) {
        throw new Error('Could not find ticket details');
      }
      if (ticket.status !== 'assigned') {
        throw new Error('Can only chat with assigned tickets');
      }

      if (!socketRef.current || !socketRef.current.connected) {
        socketRef.current = getSocket();
        if (!socketRef.current) {
          throw new Error('Failed to initialize chat connection');
        }
      }

      socketRef.current.emit('join', { ticket_id: ticketId });

      socketRef.current.on('joined', (data) => {
        console.log('Joined chat room:', data.room);
      });

      const token = localStorage.getItem('token');
      const userRes = await fetch(`http://localhost:5000/api/users/${ticket.user_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!userRes.ok) throw new Error('Failed to fetch user details');
      const userData = await userRes.json();

      const chatRes = 
        await fetch(`http://localhost:5000/api/chats/${ticketId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

      if (!chatRes.ok) throw new Error('Failed to load chat history');

      const chatHistory = await chatRes.json();

      setSelectedTicket({
        ...ticket,
        userName: `${userData.first_name} ${userData.last_name}`,
        userEmail: userData.email,
        chatHistory,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCloseTicket = async () => {
    if (!closeReason.trim()) {
      setError('Closure reason is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${selectedTicket.id}/close`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: closeReason,
          reassign_to: reassignTo || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to close ticket');

      setCloseDialogOpen(false);
      setCloseReason('');
      setReassignTo('');
      fetchTickets();
      setSelectedTicket(null);

      if (socketRef.current) {
        socketRef.current.emit('ticket_closed', {
          ticket_id: selectedTicket.id,
          reason: closeReason,
          reassigned_to: reassignTo || null,
        });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReopenTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reopen`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to reopen ticket');

      fetchTickets();
      if (socketRef.current) {
        socketRef.current.emit('ticket_reopened', { ticket_id: ticketId });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const columnDefs = useMemo(() => [
    { field: 'id', headerName: 'Ticket ID', sort: 'desc', width: 100 },
    { field: 'userName', headerName: 'Created By', width: 150 },
    { field: 'category', headerName: 'Category', width: 120 },
    { field: 'urgency', headerName: 'Urgency', width: 100 },
    { field: 'description', headerName: 'Description', flex: 1 ,width:150},
    { field: 'status', headerName: 'Status', width: 120 },
    { 
      field: 'created_at', 
      headerName: 'Created', 
      width: 200,
      valueFormatter: params => new Date(params.value).toLocaleString(),
    },
    { 
      headerName: 'Actions',
      width: 300,
      cellRenderer: params => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {params.data.status === 'open' && (
            <>
              <Button
                variant="contained"
                size="small"
                color="success"
                onClick={() => handleAcceptTicket(params.data.id)}
              >
                Accept
              </Button>
              <Button
                variant="contained"
                size="small"
                color="error"
                onClick={() => handleRejectTicket(params.data.id)}
              >
                Reject
              </Button>
            </>
          )}
          {params.data.status === 'assigned' && (
            <>
              <Button
                variant="contained"
                size="small"
                onClick={() => handleTicketSelect(params.data.id)}
              >
                Chat
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={() => {
                  setSelectedTicket(params.data);
                  setCloseDialogOpen(true);
                }}
              >
                Close
              </Button>
            </>
          )}
          {params.data.status === 'closed' && (
            <Button
              variant="contained"
              size="small"
              color="primary"
              onClick={() => handleReopenTicket(params.data.id)}
            >
              Reopen
            </Button>
          )}
        </Box>
      ),
    },
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true,
  }), []);

  if (loading) {
    return (
      <>
        <Navbar />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#f0f2f5' }}>
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
      <Container maxWidth="xl" sx={{ mt: 8, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography
            variant="h5"
            component="h1"
            sx={{ fontWeight: 'bold', fontFamily: 'times new roman', color: 'black', mt: 1 }}
          >
            Member Support Dashboard
          </Typography>
        </Box>

        {/* <Paper elevation={3} sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
          <div className="ag-theme-material" style={{ height: '370px', width: '100%', overflow: 'auto' }}>
            <AgGridReact
              ref={gridRef}
              rowData={tickets}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              animateRows={true}
              rowSelection="single"
              pagination={true}
              paginationAutoPageSize={true}
               paginationPageSize={10}
            />
          </div>
        </Paper> */}

        <Box sx={{ flex: 1, p: 2, position: 'relative' }}>
  <Box
    className="ag-theme-alpine"
    sx={{
      height: '370px',
      width: '100%',
      '& .ag-header-cell': {
        backgroundColor: '#f5f5f5',
        fontWeight: 'bold',
      },
      '& .ag-cell': {
        display: 'flex',
        alignItems: 'center',
      },
    }}
  >
    <AgGridReact
      ref={gridRef}
      rowData={tickets}
      columnDefs={columnDefs}
      defaultColDef={defaultColDef}
      pagination={true}
      paginationPageSize={10}
      animateRows={true}
    />
  </Box>
</Box>

        <Modal
          open={Boolean(selectedTicket)}
          onClose={() => {
            if (socketRef.current) {
              socketRef.current.off('joined');
              socketRef.current.emit('leave', { ticket_id: selectedTicket?.id });
            }
            setSelectedTicket(null);
            setError(null);
          }}
          aria-labelledby="chat-modal"
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Paper sx={{ width: '90%', height: '90vh', maxWidth: 1200, p: 3, position: 'relative', overflow: 'hidden' }}>
            {selectedTicket && (
              <Grid container spacing={2} sx={{ height: '100%' }}>
                <Grid item xs={4}>
                  <Paper elevation={2} sx={{ p: 2, height: '100%', overflow: 'auto' }}>
                    <Typography variant="h6" gutterBottom>
                      Ticket Details
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography><strong>Ticket ID:</strong> #{selectedTicket.id}</Typography>
                      <Typography><strong>Created By:</strong> {selectedTicket.userName}</Typography>
                      <Typography><strong>User Email:</strong> {selectedTicket.userEmail}</Typography>
                      <Typography><strong>Category:</strong> {selectedTicket.category}</Typography>
                      <Typography><strong>Urgency:</strong> {selectedTicket.urgency}</Typography>
                      <Typography><strong>Status:</strong> {selectedTicket.status}</Typography>
                      <Typography><strong>Created:</strong> {new Date(selectedTicket.created_at).toLocaleString()}</Typography>
                      <Typography><strong>Description:</strong></Typography>
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                        {selectedTicket.description}
                      </Paper>
                      {selectedTicket.status === 'closed' && selectedTicket.closure_reason && (
                        <>
                          <Typography><strong>Closure Reason:</strong></Typography>
                          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                            {selectedTicket.closure_reason}
                          </Paper>
                          {selectedTicket.reassigned_to && (
                            <Typography><strong>Reassigned To:</strong> {members.find(m => m.id === selectedTicket.reassigned_to)?.name || 'Unknown'}</Typography>
                          )}
                        </>
                      )}
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={8}>
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6">Chat Window</Typography>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          if (socketRef.current) {
                            socketRef.current.off('joined');
                            socketRef.current.emit('leave', { ticket_id: selectedTicket.id });
                          }
                          setSelectedTicket(null);
                        }}
                      >
                        Close Chat
                      </Button>
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <ChatWindow
                        ticketId={selectedTicket.id}
                        initialMessages={selectedTicket.chatHistory || []}
                        inactivityTimeout={120000} // 2 minutes in milliseconds
                      />
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            )}
          </Paper>
        </Modal>

        <Dialog open={closeDialogOpen} onClose={() => setCloseDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Close Ticket</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Reason for Closing"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                required
              />
              <FormControl fullWidth>
                <InputLabel>Reassign To (Optional)</InputLabel>
                <Select
                  value={reassignTo}
                  label="Reassign To (Optional)"
                  onChange={(e) => setReassignTo(e.target.value)}
                >
                  <MenuItem value="">None</MenuItem>
                  {members.map(member => (
                    <MenuItem key={member.id} value={member.id}>
                      {member.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleCloseTicket}
              disabled={!closeReason.trim()}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>

        <Box sx={{ position: 'fixed', top: 80, right: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {notifications.map((notification) => (
            <Alert
              key={notification.id}
              severity="info"
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" onClick={() => handleAcceptTicket(notification.id)}>
                    Accept
                  </Button>
                  <Button size="small" onClick={() => handleRejectTicket(notification.id)}>
                    Reject
                  </Button>
                </Box>
              }
            >
              {notification.message}
            </Alert>
          ))}
        </Box>
      </Container>
    </>
  );
}

export default MemberDashboard;