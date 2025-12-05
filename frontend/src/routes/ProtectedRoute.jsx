import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, token } = useContext(AuthContext);

  // Admin values
  const admin = JSON.parse(localStorage.getItem("admin_user"));
  const adminToken = localStorage.getItem("admin_token");

  // ❌ REMOVE THIS → it causes the forced redirect:
  // if (admin && adminToken) {
  //   return <Navigate to="/admin" replace />;
  // }

  // Protect only pages requiring a user login
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
