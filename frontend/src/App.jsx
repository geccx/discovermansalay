import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect } from "react";
import axios from "axios";

import { AuthProvider } from "./context/AuthContext";
import { WishlistProvider } from "./contexts/WishlistContext";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyOtp from "./pages/VerifyOtp";
import AdminDashboard from "./pages/AdminDashboard";
import CMSDashboard from "./pages/ContentManagement";
import DiscoverMap from "./pages/DiscoverMap";

import DestinationsPage from "./pages/destinations/DestinationsPage";
import Beaches from "./pages/destinations/Beaches";
import Restaurants from "./pages/destinations/Restaurants";
import Adventures from "./pages/destinations/Adventures";
import HotelsResort from "./pages/destinations/HotelsResort";

import Accommodations from "./pages/navbar/Accommodations";
import Activities from "./pages/navbar/Activities";
import Events from "./pages/navbar/Events";
import About from "./pages/navbar/About";

import Wishlist from "./pages/Wishlist";
import MapPage from "./pages/MapPage";
import Search from "./pages/SearchPage";
import Terms from "./pages/Terms";

import ProtectedRoute from "./routes/ProtectedRoute";
import AdminRoute from "./routes/AdminRoute";

import AdminInviteRegister from "./pages/AdminInviteRegister";
import UserInviteRegister from "./pages/UserInviteRegister";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// ------------------------------------------------------------
// 🔍 AUTO VISITOR TRACKING (fires on every route change)
// ------------------------------------------------------------
function VisitorTracker() {
  const location = useLocation();

  useEffect(() => {
    async function trackVisit() {
      try {
        await axios.post(`${API_BASE}/api/visitors/track`, {
          browser: navigator.userAgent,
          device: navigator.platform,
          page: location.pathname,
        });
      } catch (err) {
        console.error("Visitor track failed:", err?.response?.data || err);
      }
    }

    trackVisit();
  }, [location.pathname]);

  return null;
}

// ------------------------------------------------------------
// 🔒 USER-ONLY ROUTE (ADMIN cannot access user pages)
// ------------------------------------------------------------
function UserOnlyRoute({ children }) {
  const rawUser = localStorage.getItem("user");
  let user = null;

  try {
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch {
    user = null;
  }

  if (user?.role === "admin" || user?.role === "superadmin") {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WishlistProvider>

          <VisitorTracker />

          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />
            <Route path="/terms" element={<Terms />} />

            {/* User Only */}
            <Route
              path="/wishlist"
              element={
                <UserOnlyRoute>
                  <ProtectedRoute>
                    <Wishlist />
                  </ProtectedRoute>
                </UserOnlyRoute>
              }
            />

            {/* ADMIN ONLY */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />

            {/* INVITE ROUTES */}
            <Route path="/admin/register" element={<AdminInviteRegister />} />
            <Route path="/invite/register" element={<UserInviteRegister />} />

            {/* CMS */}
            <Route
              path="/cms"
              element={
                <AdminRoute>
                  <CMSDashboard />
                </AdminRoute>
              }
            />

            {/* Public Pages */}
            <Route path="/destinations" element={<DestinationsPage />} />
            <Route path="/destinations/beaches" element={<Beaches />} />
            <Route path="/destinations/restaurants" element={<Restaurants />} />
            <Route path="/destinations/adventures" element={<Adventures />} />
            <Route path="/destinations/hotels-resort" element={<HotelsResort />} />

            <Route path="/accommodations" element={<Accommodations />} />
            <Route path="/activities" element={<Activities />} />
            <Route path="/events" element={<Events />} />
            <Route path="/about" element={<About />} />
            <Route path="/map" element={<MapPage />} />

            <Route path="/search" element={<Search />} />
          </Routes>

          <ToastContainer position="top-right" autoClose={3000} />
        </WishlistProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
