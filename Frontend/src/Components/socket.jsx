import io from 'socket.io-client';
import { useState, useEffect } from 'react';

let socket = null;
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

const initSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('token');
    if (!token) return null;

    socket = io('http://localhost:5000', {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      auth: {
        token
      },
      query: {
        token
      },
      reconnection: true,
      reconnectionAttempts: MAX_RETRIES,
      reconnectionDelay: RETRY_DELAY,
      timeout: 10000,
      autoConnect: false
    });

    socket.on('connect', () => {
      console.log('Socket connecting...');
      retryCount = 0;
    });

    socket.on('connect_success', (data) => {
      console.log('Socket connected successfully:', data);
      retryCount = 0;
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      retryCount++;
      
      if (retryCount >= MAX_RETRIES) {
        console.error('Max retries reached, stopping reconnection');
        socket.disconnect();
        socket = null;
        return;
      }

      if (error.message === 'Invalid token') {
        socket.disconnect();
        socket = null;
        localStorage.removeItem('token'); // Clear invalid token
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected the client, don't reconnect automatically
        socket = null;
      }
    });

    socket.on('reconnecting', (attemptNumber) => {
      console.log(`Socket reconnecting... Attempt ${attemptNumber}`);
    });

    socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      socket = null;
    });

    // Connect only after setting up all event handlers
    setTimeout(() => {
      socket.connect();
    }, 0);
  }

  return socket;
};

const getSocket = () => {
  if (socket?.connected) {
    return socket;
  }
  return initSocket();
};

const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    retryCount = 0;
  }
};

// Custom hook for socket state
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      setError('No token available');
      return;
    }

    const handleConnect = () => {
      setIsConnected(true);
      setError(null);
    };

    const handleConnectSuccess = () => {
      setIsConnected(true);
      setError(null);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleError = (err) => {
      setError(err.message);
      setIsConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('connect_success', handleConnectSuccess);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_success', handleConnectSuccess);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
    };
  }, []);

  return { isConnected, error };
};

export { getSocket, disconnectSocket };
