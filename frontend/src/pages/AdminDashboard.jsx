import React, { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import refreshIcon from '../assets/images/refresh-icon.png';
import profileIcon from '../assets/images/profile-icon.png';
import logoutIcon from '../assets/images/logout-icon.png';
import DashboardOverview from '../components/DashboardOverview';
import '../styles/dashboard.css';

const UserManagement = lazy(() => import('./UserManagement'));
const ContentManagement = lazy(() => import('./ContentManagement'));
const MapCMS = lazy(() => import('./MapManagement')); // Lazy-load the Map CMS page
const DestinationManager = lazy(() => import('./DestinationManager'));

const MENU_ITEMS = ['Admin Dashboard', 'User Management', 'Content Management', 'Map Management','Destination Management' ];

const AdminDashboard = () => {
  const [activeMenu, setActiveMenu] = useState('Admin Dashboard');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [activeMapSubMenu, setActiveMapSubMenu] = useState('Tourist Spots'); // default

  // Track submenu for both UserManagement and ContentManagement separately
  const [activeUserSubMenu, setActiveUserSubMenu] = useState('Admins');
  const [activeContentSubMenu, setActiveContentSubMenu] = useState('Logo');

  const navigate = useNavigate();
const handleLogout = () => {
  // Clear user session
  localStorage.removeItem('token');
  localStorage.removeItem('user');

  // Redirect to home page as guest
  navigate('/');
  window.location.reload(); // Ensures context/UI reflects logged-out state
};


  const goToProfile = () => {
    navigate('/adminprofile');
  };

  return (
    <div className="app-container">
      {sidebarVisible && (
        <nav className="sidebar">
          <h2>Discover Mansalay</h2>
          {MENU_ITEMS.map((item) => (
            <div key={item}>
              <div
                className={`menu-item ${activeMenu === item ? 'active' : ''}`}
                onClick={() => {
                  setActiveMenu(item);
                  // Reset submenus
                  if (item === 'User Management') setActiveUserSubMenu('Admins');
                  if (item === 'Content Management') setActiveContentSubMenu('Logo');
                  if (item === 'Map Management') setActiveMapSubMenu('Tourist Spots');
                }}
              >
                {item}
              </div>

              {/* Submenus */}
              {item === 'Content Management' && activeMenu === 'Content Management' && (
                <div className="submenu-items">
                  {['Logo', 'Background', 'Top Destinations', 'Highlight Events', 'Experience Mansalay'].map((subItem) => (
                    <div
                      key={subItem}
                      className={`submenu-item ${activeContentSubMenu === subItem ? 'active' : ''}`}
                      onClick={() => setActiveContentSubMenu(subItem)}
                    >
                      {subItem}
                    </div>
                  ))}
                </div>
              )}

              {item === 'User Management' && activeMenu === 'User Management' && (
                <div className="submenu-items">
                  {['Admins', 'Users'].map((subItem) => (
                    <div
                      key={subItem}
                      className={`submenu-item ${activeUserSubMenu === subItem ? 'active' : ''}`}
                      onClick={() => setActiveUserSubMenu(subItem)}
                    >
                      {subItem}
                    </div>
                  ))}
                </div>
              )}

              {item === 'Map Management' && activeMenu === 'Map Management' && (
                <div className="submenu-items">
                  {['Tourist Spots', 'Routing Settings'].map((subItem) => (
                    <div
                      key={subItem}
                      className={`submenu-item ${activeMapSubMenu === subItem ? 'active' : ''}`}
                      onClick={() => setActiveMapSubMenu(subItem)}
                    >
                      {subItem}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      )}

      {/* Main Content */}
      <main className="content">
        {/* Navbar */}
        <div className="adminnavbar">
          <button onClick={() => setSidebarVisible((prev) => !prev)} className="toggle-btn">
            ☰
          </button>
          <h1>{activeMenu}</h1>
          <div className="navbar-actions">
            <button onClick={() => window.location.reload()} className="refresh-btn">
              <img src={refreshIcon} alt="Refresh" className="icon" />
            </button>
            <div className="profile-section">
              <img
                src={profileIcon}
                alt="Profile"
                className="icon"
                onClick={goToProfile}
                style={{ cursor: 'pointer' }}
              />
              <button onClick={handleLogout} className="logout-btn icon-btn">
                <img src={logoutIcon} alt="Logout" className="icon" />
              </button>
            </div>
          </div>
        </div>

        {/* Render main content depending on active menu */}
        {activeMenu === 'Admin Dashboard' && <DashboardOverview />}

        {activeMenu === 'User Management' && (
          <Suspense fallback={<p>Loading User Management...</p>}>
            <UserManagement activeSubMenu={activeUserSubMenu} />
          </Suspense>
        )}

        {activeMenu === 'Content Management' && (
          <Suspense fallback={<p>Loading Content Management...</p>}>
            <ContentManagement activeSubMenu={activeContentSubMenu} />
          </Suspense>
        )}
     
       {activeMenu === 'Map Management' && (
          <Suspense fallback={<p>Loading Map Management...</p>}>
            <MapCMS activeSubMenu={activeMapSubMenu} />
          </Suspense>
        )}

        {activeMenu === 'Destination Management' && (
  <Suspense fallback={<p>Loading Destination Management...</p>}>
    <DestinationManager />
  </Suspense>
)}

      </main>
    </div>
  );
};

export default AdminDashboard;
