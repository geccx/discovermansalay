import { Navigate } from "react-router-dom";

export default function AdminRoute({ children }) {
  const admin = JSON.parse(localStorage.getItem("admin_user"));
  const adminToken = localStorage.getItem("admin_token");

  // Admin not logged in → go to login
  if (!admin || !adminToken) {
    return <Navigate to="/login" replace />;
  }

  // Logged in admin but wrong role → return home
  if (admin.role !== "admin" && admin.role !== "superadmin") {
    return <Navigate to="/" replace />;
  }

  return children;
}
