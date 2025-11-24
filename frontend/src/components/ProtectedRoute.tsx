// src/components/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useEffect } from "react";
import { authService } from "../services/authService";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, accessToken, user } = useAuthStore();

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

  // Check role-based access if allowedRoles is specified
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
