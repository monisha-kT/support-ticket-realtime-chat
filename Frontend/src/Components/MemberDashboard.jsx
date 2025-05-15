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
  Divider
} from '@mui/material';
import { getSocket } from './socket';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from './Navbar';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-material.css';
import ChatWindow from './ChatWindow';

function MemberDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const user = useStore((state) => state.user);
  const navigate = useNavigate();
  const socketRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = getSocket();
    
    if (socketRef.current) {
      // Listen for new tickets
      socketRef.current.on('ticket_created', (ticket) => {
        setNotifications(prev => [...prev, {
          id: ticket.ticket_id,
          type: 'new',
          message: `New ticket #${ticket.ticket_id} created`,
          ticket: ticket
        }]);
        // Refresh tickets list
        fetchTickets();
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('ticket_created');
      }
    };
  }, []);

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
      // Filter tickets that are either assigned to this member or open
      const relevantTickets = data.filter(ticket => 
        (ticket.status === 'assigned' && ticket.assigned_to === user.id) ||
        ticket.status === 'open'
      );
      setTickets(relevantTickets);

      // If there's a selected ticket, update its data
      if (selectedTicket) {
        const updatedSelectedTicket = relevantTickets.find(t => t.id === selectedTicket.id);
        setSelectedTicket(updatedSelectedTicket || null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/accept/${ticketId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) throw new Error('Failed to accept ticket');
      
      // Remove from notifications if present
      setNotifications(prev => prev.filter(n => n.id !== ticketId));
      // Refresh tickets
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
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) throw new Error('Failed to reject ticket');
      
      // Remove from notifications if present
      setNotifications(prev => prev.filter(n => n.id !== ticketId));
      // Refresh tickets
      fetchTickets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTicketSelect = (ticketId) => {
    const ticket = tickets.find(t => t.id === ticketId);
    setSelectedTicket(ticket);
  };

  const handleCloseTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/close`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) throw new Error('Failed to close ticket');
      
      // Refresh tickets after closing
      fetchTickets();
      setSelectedTicket(null); // Close chat window
    } catch (err) {
      setError(err.message);
    }
  };

  const columnDefs = useMemo(() => [
    { field: 'id', headerName: 'Ticket ID', sort: 'desc', width: 100 },
    { field: 'category', headerName: 'Category', width: 120 },
    { field: 'urgency', headerName: 'Urgency', width: 100 },
    { field: 'description', headerName: 'Description', flex: 1 },
    { field: 'status', headerName: 'Status', width: 120 },
    { field: 'created_at', headerName: 'Created', width: 160,
      valueFormatter: (params) => new Date(params.value).toLocaleString() },
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
                onClick={() => handleCloseTicket(params.data.id)}
              >
                Close
              </Button>
            </>
          )}
        </Box>
      )
    }
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true, 
  }), []);

  // Chat modal
  const [isChatOpen, setIsChatOpen] = useState(false);

  if (loading) {
    return (
      <>
        <Navbar />
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: '100vh',
          bgcolor: '#f0f2f5'
        }}>
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
            sx={{ 
              fontWeight: 'bold',
              fontFamily: 'times new roman',
              color: 'black',
              mt:1
            }}
          >
            Member Support Dashboard
          </Typography>
        
        </Box>

        <Paper 
          elevation={3}
          sx={{ 
            p: 3,
            borderRadius: 2,
            bgcolor: 'background.paper'
          }}
        >
          
          <div 
            className="ag-theme-material"
            style={{ 
              height: '370px',
              width: '100%',
              overflow: 'auto' 
            }}
          >
            <AgGridReact
              rowData={tickets}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              animateRows={true}
              rowSelection="single"
              pagination={true}
              paginationAutoPageSize={true}
            />
          </div>
        </Paper>

        {/* Chat Modal */}
        {/* Chat Modal with Split View */}
        <Modal
          open={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          aria-labelledby="chat-modal"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Paper
            sx={{
              width: '90%',
              height: '90vh',
              maxWidth: 1200,
              p: 3,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {selectedTicket && (
              <Grid container spacing={2} sx={{ height: '100%' }}>
                {/* Left side - Ticket Details */}
                <Grid item xs={4}>
                  <Paper
                    elevation={2}
                    sx={{
                      p: 2,
                      height: '100%',
                      overflow: 'auto'
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      Ticket Details
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography><strong>Ticket ID:</strong> #{selectedTicket.id}</Typography>
                      <Typography><strong>Category:</strong> {selectedTicket.category}</Typography>
                      <Typography><strong>Urgency:</strong> {selectedTicket.urgency}</Typography>
                      <Typography><strong>Status:</strong> {selectedTicket.status}</Typography>
                      <Typography><strong>Created:</strong> {new Date(selectedTicket.created_at).toLocaleString()}</Typography>
                      <Typography><strong>Description:</strong></Typography>
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                        {selectedTicket.description}
                      </Paper>
                    </Box>
                  </Paper>
                </Grid>

                {/* Right side - Chat */}
                <Grid item xs={8}>
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6">
                        Chat Window
                      </Typography>
                      <Button 
                        variant="outlined"
                        onClick={() => setSelectedTicket(null)}
                      >
                        Close Chat
                      </Button>
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <ChatWindow ticketId={selectedTicket.id} />
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            )}
          </Paper>
        </Modal>

        {/* Notifications */}
        <Box
          sx={{
            position: 'fixed',
            top: 80,
            right: 20,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: 1
          }}
        >
          {notifications.map((notification) => (
            <Alert
              key={notification.id}
              severity="info"
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    onClick={() => handleAcceptTicket(notification.id)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="small"
                    onClick={() => handleRejectTicket(notification.id)}
                  >
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
