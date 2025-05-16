import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  Button,
  Modal,
  Divider,
} from '@mui/material';
import ChatWindow from './ChatWindow';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import useStore from '../store/useStore';
import Navbar from './Navbar';
import { getSocket } from './socket';

function AdminDashboard() {
  const gridRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedTicketDetails, setSelectedTicketDetails] = useState(null);
  const user = useStore((state) => state.user);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/auth');
      return;
    }

    if (!user) {
      return;
    }

    if (user.role === 'user') {
      navigate('/dashboard');
      return;
    }
    if (user.role === 'member') {
      navigate('/member/dashboard');
      return;
    }
    if (user.role !== 'admin') {
      navigate('/auth');
      return;
    }

    const socket = getSocket();
    socket.on('new_ticket', (data) => {
      fetchTickets();
    });

    socket.on('ticket_closed', ({ ticket_id, reason, reassigned_to }) => {
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticket_id
            ? { ...ticket, status: 'closed', closure_reason: reason, reassigned_to }
            : ticket
        )
      );
    });

    socket.on('ticket_reopened', ({ ticket_id }) => {
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticket_id
            ? { ...ticket, status: 'assigned', closure_reason: null, reassigned_to: null }
            : ticket
        )
      );
    });

    socket.on('chat_inactive', ({ ticket_id, reason }) => {
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticket_id
            ? { ...ticket, status: 'closed', closure_reason: reason }
            : ticket
        )
      );
    });

    fetchTickets();

    return () => {
      socket.off('new_ticket');
      socket.off('ticket_closed');
      socket.off('ticket_reopened');
      socket.off('chat_inactive');
    };
  }, [user, navigate]);

  const fetchChats = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/chats/${ticketId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch chats');

      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Error fetching chats:', err);
      return [];
    }
  };

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch tickets');

      const data = await res.json();

      const userIds = [
        ...new Set(
          data
            .map((ticket) => ticket.user_id)
            .concat(data.map((ticket) => ticket.assigned_to).filter((id) => id))
        ),
      ];

      const usersRes = await fetch('http://localhost:5000/api/users/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_ids: userIds }),
      });
      if (!usersRes.ok) throw new Error('Failed to fetch user details');
      const usersData = await usersRes.json();

      const ticketsWithDetails = data.map((ticket) => ({
        ...ticket,
        userName: usersData[ticket.user_id]
          ? `${usersData[ticket.user_id].first_name} ${usersData[ticket.user_id].last_name}`
          : 'Unknown',
        memberName: ticket.assigned_to && usersData[ticket.assigned_to]
          ? `${usersData[ticket.assigned_to].first_name} ${usersData[ticket.assigned_to].last_name}`
          : 'Unassigned',
        activeStatus:
          ticket.status === 'assigned' && ticket.last_message_at
            ? new Date(ticket.last_message_at) > new Date(Date.now() - 2 * 60 * 1000)
              ? 'Active'
              : 'Inactive'
            : 'N/A',
      }));

      setTickets(ticketsWithDetails);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (ticket) => {
    try {
      const token = localStorage.getItem('token');
      const userRes = await fetch(`http://localhost:5000/api/users/${ticket.user_id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!userRes.ok) throw new Error('Failed to fetch user details');
      const userData = await userRes.json();

      const chatHistory = await fetchChats(ticket.id);

      setSelectedTicketDetails({
        ...ticket,
        userName: `${userData.first_name} ${userData.last_name}`,
        userEmail: userData.email,
      });
      setSelectedTicket({
        ...ticket,
        chats: chatHistory,
      });
    } catch (err) {
      setError('Failed to fetch ticket details');
    }
  };

  const columnDefs = [
    {
      field: 'id',
      headerName: 'Ticket ID',
      flex: 1,
      minWidth: 100,
      floatingFilter: true,
      fontFamily: '"Times New Roman", serif',
    },
    {
      field: 'category',
      headerName: 'Category',
      flex: 1,
      minWidth: 120,
      floatingFilter: true,
      fontFamily: '"Times New Roman", serif',
    },
    {
      field: 'urgency',
      headerName: 'Urgency',
      flex: 1,
      minWidth: 100,
      floatingFilter: true,
      fontFamily: '"Times New Roman", serif',
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1,
      minWidth: 100,
      floatingFilter: true,
      cellRenderer: (params) => (
        <Typography
          sx={{
            bgcolor:
              params.value === 'open'
                ? 'warning.main'
                : params.value === 'assigned'
                ? 'info.main'
                : params.value === 'rejected'
                ? 'error.main'
                : params.value === 'closed'
                ? 'success.main'
                : 'inherit',
            color: 'white',
            px: 2,
            py: 0.5,
            borderRadius: 1,
            fontFamily: '"Times New Roman", serif',
            display: 'inline-block',
          }}
        >
          {params.value.charAt(0).toUpperCase() + params.value.slice(1)}
        </Typography>
      ),
    },
    {
      field: 'activeStatus',
      headerName: 'Active Status',
      flex: 1,
      minWidth: 120,
      floatingFilter: true,
      fontFamily: '"Times New Roman", serif',
    },
    {
      field: 'closure_reason',
      headerName: 'Closure Reason',
      flex: 1,
      minWidth: 150,
      floatingFilter: true,
      fontFamily: '"Times New Roman", serif',
      cellRenderer: (params) => params.value || 'N/A',
    },
    {
      field: 'userName',
      headerName: 'Created By',
      flex: 1,
      minWidth: 150,
      floatingFilter: true,
      fontFamily: '"Times New Roman", serif',
    },
    {
      field: 'memberName',
      headerName: 'Assigned To',
      flex: 1,
      minWidth: 150,
      floatingFilter: true,
      fontFamily: '"Times New Roman", serif',
    },
    {
      headerName: 'Actions',
      minWidth: 120,
      fontFamily: '"Times New Roman", serif',
      cellRenderer: (params) => (
        <Button
          variant="contained"
          size="small"
          onClick={() => handleViewDetails(params.data)}
        >
          View Details
        </Button>
      ),
    },
  ];

  const defaultColDef = {
    sortable: true,
    filter: true,
  };

  return (
    <>
      <Navbar />
      <Box
        sx={{
          mt: '64px',
          height: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#f5f5f5',
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography
            variant="h5"
            sx={{
              fontFamily: '"Times New Roman", serif',
              fontWeight: 'bold',
            }}
          >
            Admin Dashboard
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        ) : (
          <Box sx={{ flex: 1, p: 2, position: 'relative' }}>
            <Box
              className="ag-theme-alpine"
              sx={{
                height: '100%',
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
        )}

        <Modal
          open={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          aria-labelledby="ticket-details-modal"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Paper
            sx={{
              width: '90%',
              height: '90vh',
              maxWidth: 1200,
              p: 3,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {selectedTicket && (
              <Grid container spacing={2} sx={{ height: '100%' }}>
                <Grid item xs={4}>
                  <Paper
                    elevation={2}
                    sx={{
                      p: 2,
                      height: '100%',
                      overflow: 'auto',
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      Ticket Details
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography>
                        <strong>Ticket ID:</strong> #{selectedTicket.id}
                      </Typography>
                      <Typography>
                        <strong>Created By:</strong> {selectedTicketDetails?.userName || 'Loading...'}
                      </Typography>
                      <Typography>
                        <strong>User Email:</strong> {selectedTicketDetails?.userEmail || 'Loading...'}
                      </Typography>
                      <Typography>
                        <strong>Category:</strong> {selectedTicket.category}
                      </Typography>
                      <Typography>
                        <strong>Urgency:</strong> {selectedTicket.urgency}
                      </Typography>
                      <Typography>
                        <strong>Status:</strong> {selectedTicket.status.charAt(0).toUpperCase() + selectedTicket.status.slice(1)}
                      </Typography>
                      <Typography>
                        <strong>Active Status:</strong> {selectedTicket.activeStatus}
                      </Typography>
                      {selectedTicket.closure_reason && (
                        <Typography>
                          <strong>Closure Reason:</strong> {selectedTicket.closure_reason}
                        </Typography>
                      )}
                      {selectedTicket.reassigned_to && (
                        <Typography>
                          <strong>Reassigned To:</strong> Member ID {selectedTicket.reassigned_to}
                        </Typography>
                      )}
                      <Typography>
                        <strong>Created:</strong> {new Date(selectedTicket.created_at).toLocaleString()}
                      </Typography>
                      <Typography>
                        <strong>Description:</strong>
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                        {selectedTicket.description}
                      </Paper>
                      {selectedTicket.assigned_to && (
                        <>
                          <Typography>
                            <strong>Current Status:</strong>
                          </Typography>
                          <Alert
                            severity={
                              selectedTicket.status === 'open'
                                ? 'warning'
                                : selectedTicket.status === 'assigned'
                                ? 'info'
                                : selectedTicket.status === 'rejected'
                                ? 'error'
                                : 'success'
                            }
                          >
                            {selectedTicket.status.charAt(0).toUpperCase() + selectedTicket.status.slice(1)}
                          </Alert>
                        </>
                      )}
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={8}>
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6">Chat History</Typography>
                      <Button variant="outlined" onClick={() => setSelectedTicket(null)}>
                        Close
                      </Button>
                    </Box>
                    <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                      <ChatWindow
                        ticketId={selectedTicket.id}
                        readOnly={true}
                        initialMessages={selectedTicket.chats}
                      />
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            )}
          </Paper>
        </Modal>
      </Box>
    </>
  );
}

export default AdminDashboard;