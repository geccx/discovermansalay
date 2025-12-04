import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { AuthProvider } from "./context/AuthContext";
import { WishlistProvider } from "./contexts/WishlistContext";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyOtp from "./pages/VerifyOtp";
import AdminDashboard from "./pages/AdminDashboard";
import CMSDashboard from "./pages/ContentManagement";
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WishlistProvider>

          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />
            <Route path="/terms" element={<Terms />} />

            {/* User Only */}
            <Route
              path="/wishlist"
              element={
                <ProtectedRoute>
                  <Wishlist />
                </ProtectedRoute>
              }
            />

            {/* Admin Only */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />

            {/* Other pages */}
            <Route path="/cms" element={<CMSDashboard />} />
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
