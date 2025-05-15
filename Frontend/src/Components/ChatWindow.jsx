import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  TextField, 
  IconButton, 
  Paper, 
  Typography, 
  CircularProgress, 
  Alert,
  LinearProgress
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import useStore from '../store/useStore';
import { getSocket, useSocket } from './socket';

function ChatWindow({ ticketId, readOnly = false, initialMessages = [] }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(Boolean(ticketId && !initialMessages.length));
  const [error, setError] = useState(null);
  const [ticketStatus, setTicketStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const user = useStore((state) => state.user);
  const { isConnected, error: socketError } = useSocket();

  // Fetch ticket status
  useEffect(() => {
    const fetchTicketStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('Failed to fetch ticket status');
        const data = await response.json();
        setTicketStatus(data.status);
      } catch (error) {
        console.error('Error fetching ticket status:', error);
      }
    };

    if (!readOnly && ticketId && ticketId !== 'null') {
      fetchTicketStatus();
    }
  }, [ticketId, readOnly]);

  // Socket connection and message handling
  useEffect(() => {
    if (!readOnly && ticketId && ticketId !== 'null') {
      const initializeChat = async () => {
        try {
          // Initialize socket connection
          socketRef.current = getSocket();
          if (!socketRef.current) {
            throw new Error('Failed to initialize socket connection');
          }

          // Join chat room
          socketRef.current.emit('join', { ticket_id: ticketId });

          // Load existing messages if not provided
          if (!initialMessages.length) {
            await fetchMessages();
          }

          // Listen for new messages
          socketRef.current.on('message', (newMessage) => {
            setMessages(prev => [...prev, newMessage]);
          });

          // Listen for room join confirmation
          socketRef.current.on('joined', (data) => {
            console.log('Joined chat room:', data.room);
          });

          // Listen for ticket status changes
          socketRef.current.on('ticket_closed', () => {
            setTicketStatus('closed');
          });

        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };

      initializeChat();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('message');
        socketRef.current.off('joined');
      }
    };
  }, [ticketId]);

  // Fetch message history
  const fetchMessages = async () => {
    if (!ticketId) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/chats/${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      throw new Error('Error loading messages: ' + error.message);
    }
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle message sending
  const handleSend = () => {
    if (!message.trim() || !socketRef.current || !isConnected || ticketStatus === 'closed') return;

    socketRef.current.emit('message', {
      ticket_id: ticketId,
      sender_id: user.id,
      message: message.trim()
    });

    setMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isMessageInputDisabled = readOnly || ticketStatus === 'closed' || !isConnected;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || socketError) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">
          {error || socketError || 'Failed to connect to chat'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Connection Status */}
      {!isConnected && (
        <Box sx={{ width: '100%' }}>
          <LinearProgress />
          <Typography 
            variant="caption" 
            sx={{ 
              textAlign: 'center', 
              display: 'block',
              py: 0.5,
              bgcolor: 'warning.light'
            }}
          >
            Connecting to chat...
          </Typography>
        </Box>
      )}

      {/* Messages Area */}
      <Box sx={{ 
        flex: 1, 
        p: 2, 
        overflowY: 'auto',
        bgcolor: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}>
        {messages.map((msg, index) => (
          <Paper
            key={index}
            elevation={1}
            sx={{
              p: 1.5,
              maxWidth: '70%',
              alignSelf: msg.sender_id === user.id ? 'flex-end' : 'flex-start',
              bgcolor: msg.sender_id === user.id ? '#e3f2fd' : 'white',
              borderRadius: 2,
              position: 'relative'
            }}
          >
            <Typography>{msg.message}</Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                display: 'block', 
                textAlign: 'right', 
                mt: 0.5,
                opacity: 0.7
              }}
            >
              {new Date(msg.timestamp).toLocaleTimeString()}
            </Typography>
          </Paper>
        ))}
        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input - Only show if not readOnly */}
      {!readOnly && (
        <Box sx={{ 
          p: 2, 
          bgcolor: 'white', 
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column',
          gap: 1
        }}>
          {ticketStatus === 'closed' && (
            <Alert severity="info" sx={{ mb: 1 }}>
              This ticket has been closed. No new messages can be sent.
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder={
                ticketStatus === 'closed' ? "Ticket is closed" :
                isConnected ? "Type a message..." : "Connecting..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isMessageInputDisabled}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
            <IconButton 
              onClick={handleSend}
              disabled={!message.trim() || isMessageInputDisabled}
              sx={{ 
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': {
                  bgcolor: 'primary.dark'
                },
                '&.Mui-disabled': {
                  bgcolor: 'grey.300'
                }
              }}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default ChatWindow;
