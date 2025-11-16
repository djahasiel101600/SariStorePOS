// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useEffect } from 'react';
import { authService } from '../services/authService';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, accessToken } = useAuthStore();

  useEffect(() => {
    // If we have a token but user data is missing, try to fetch user info
    if (accessToken && !useAuthStore.getState().user) {
      authService.getCurrentUser().catch(() => {
        useAuthStore.getState().clearAuth();
      });
    }
  }, [accessToken]);

  if (!isAuthenticated || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

