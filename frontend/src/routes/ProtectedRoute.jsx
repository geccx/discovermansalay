import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, token } = useContext(AuthContext);

  // If admin is logged in, block user routes
  const admin = JSON.parse(localStorage.getItem("admin_user"));
  const adminToken = localStorage.getItem("admin_token");

  if (admin && adminToken) {
    return <Navigate to="/admin" replace />;
  }

  // Normal user must be logged in
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  // Allowed (normal user)
  return children;
}
