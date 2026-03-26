import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

/**
 * ProtectedRoute:
 * - Blocks access without token
 * - Waits for /me to load
 * - Department members can access dashboard (logs + screenshots only; see routes)
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { token, loading } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (loading) {
    return null;
  }

  return children;
}
