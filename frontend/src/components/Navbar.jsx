import React, { useContext, useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaHeart, FaUserCircle } from 'react-icons/fa';
import WishlistContext from '../contexts/WishlistContext';
import '../styles/components.css'; // ✅ Use alias for Vite

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const Navbar = () => {
  const { wishlist, dispatch } = useContext(WishlistContext);
  const [logoUrl, setLogoUrl] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const profileRef = useRef(null);

  // Load logo
  useEffect(() => {
    fetch(`${API_BASE}/api/cms/navbar`)
      .then(res => res.json())
      .then(data => {
        if (data.logo) setLogoUrl(`${API_BASE}/uploads/${data.logo}`);
      })
      .catch(() => console.error('Failed to load logo'));
  }, []);

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top on route change
  useEffect(() => window.scrollTo(0, 0), [location.pathname]);

  // Load user
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  // Close profile dropdown outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const wishlistCount = wishlist?.length || 0;

  const handleWishlistClick = (e) => {
    if (!user) {
      e.preventDefault();
      navigate('/login');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    setUser(null);
    setProfileOpen(false);
    dispatch({ type: 'SET_ITEMS', payload: [] });
    navigate('/');
  };

  return (
    <nav className={`navbar ${scrolled ? 'navbar-solid' : ''}`}>
      <div className="navbar-left">
        <Link to="/">
          {logoUrl ? <img src={logoUrl} alt="Logo" className="logo" /> : <span>Loading logo...</span>}
        </Link>
      </div>

      <div className="navbar-center">
        <ul className="nav-links">
          <li
            className="dropdown"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <Link to="/destinations" className="dropdown-toggle">
              Destinations ▾
            </Link>
            {dropdownOpen && (
              <ul className="dropdown-menu">
                <li><Link to="/destinations/beaches">Beaches</Link></li>
                <li><Link to="/destinations/restaurants">Restaurants</Link></li>
                <li><Link to="/destinations/adventures">Adventures</Link></li>
                <li><Link to="/destinations/hotels-resort">Hotels & Resort</Link></li>
              </ul>
            )}
          </li>
          <li><Link to="/accommodations">Accommodations</Link></li>
          <li><Link to="/events">Events</Link></li>
          <li><Link to="/about">About</Link></li>
        </ul>
      </div>

      <div className="navbar-wishlist" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '1rem', paddingRight: '4rem' }}>
        <Link to="/wishlist" className="wishlist-icon" style={{ position: 'relative' }} onClick={handleWishlistClick}>
          <FaHeart size={25} title="Wishlist" />
          {wishlistCount > 0 && <span className="wishlist-count">{wishlistCount}</span>}
        </Link>

        {user && <span style={{ color: scrolled ? '#033859' : '#fff', fontWeight: '600' }}>Hi! {user.firstname}</span>}

        {user && (
          <div ref={profileRef} style={{ position: 'relative' }}>
            <FaUserCircle
              size={28}
              className="profile-icon"
              title="Profile"
              onClick={() => setProfileOpen(!profileOpen)}
              style={{ cursor: 'pointer', color: scrolled ? '#033859' : '#fff' }}
            />
            {profileOpen && (
              <div className="profile-dropdown">
                <Link to="/profile" onClick={() => setProfileOpen(false)} className="dropdown-item">
                  My Profile
                </Link>
                <button onClick={handleLogout} className="dropdown-item">Logout</button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
