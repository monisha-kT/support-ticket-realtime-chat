import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import UserDashboard from './Components/UserDashboard';
import MemberDashboard from './Components/MemberDashboard';
import AdminDashboard from './Components/AdminDashboard';
import AuthPage from './Components/AuthForm';
import ChatWindow from './Components/ChatWindow';
import Navbar from './Components/Navbar';
import ProtectedRoute from './Components/ProtectedRoute';
import UserChat from './Components/UserChat';

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<AuthPage />} />

        {/* Protected Dashboard Routes */}
        <Route 
          path="/dashboard" 
          element={<ProtectedRoute element={<UserDashboard />} allowedRoles={['user']} />} 
        />
        <Route 
          path="/member/dashboard" 
          element={<ProtectedRoute element={<MemberDashboard />} allowedRoles={['member']} />} 
        />
        <Route 
          path="/admin/dashboard" 
          element={<ProtectedRoute element={<AdminDashboard />} allowedRoles={['admin']} />} 
        />

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/auth" replace />} />

        {/* Protected Chat Routes */}
        {/* <Route path="/user/chat" element={
          <ProtectedRoute 
            element={
              <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Navbar />
                <Box sx={{ flex: 1, mt: '64px' }}>
                  <ChatWindow ticketId={new URLSearchParams(window.location.search).get('selectedTicketId')} />
                </Box>
              </Box>
            } 
            allowedRoles={['user']} 
          />
        } /> */}
        <Route path="/user/chat" element={<UserChat />} />
      </Routes>
    </Router>
  );
}

export default App;
