import React from 'react';
import { Navigate } from 'react-router-dom';
import useStore from '../store/useStore';

function ProtectedRoute({ element, allowedRoles }) {
  const user = useStore((state) => state.user);
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  if (!user) {
    return null; // or loading state
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect based on role
    switch (user.role) {
      case 'admin':
        return <Navigate to="/admin/dashboard" replace />;
      case 'member':
        return <Navigate to="/member/dashboard" replace />;
      case 'user':
        return <Navigate to="/dashboard" replace />;
      default:
        return <Navigate to="/auth" replace />;
    }
  }

  return element;
}

export default ProtectedRoute;
