import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import CMSDashboard from './pages/ContentManagement';
import DestinationsPage from './pages/destinations/DestinationsPage';
import Beaches from './pages/destinations/Beaches';
import Restaurants from './pages/destinations/Restaurants';
import Adventures from './pages/destinations/Adventures';
import HotelsResort from './pages/destinations/HotelsResort';
import Accommodations from './pages/navbar/Accommodations';
import Activities from './pages/navbar/Activities';
import Events from './pages/navbar/Events';
import About from './pages/navbar/About';
import Wishlist from './pages/Wishlist';
import WishlistContext, { WishlistProvider } from './contexts/WishlistContext';
import MapPage from './pages/MapPage';

import Search from './pages/SearchPage'; // 👈 new import

function App() {
  return (
    <WishlistProvider>
      <BrowserRouter>
        <>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin" element={<AdminDashboard />} />
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
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/search" element={<Search />} />

          </Routes>

          {/* 🔔 Add toast container globally */}
          <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
        </>
      </BrowserRouter>
    </WishlistProvider>
  );
}

export default App;
