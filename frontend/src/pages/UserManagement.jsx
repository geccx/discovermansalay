import React from 'react';
import AdminsPage from './Usermanagement/AdminsPage';
import UsersPage from './Usermanagement/UsersPage';

const UserManagement = ({ activeSubMenu }) => {
  return (
    <div className="user-management-wrapper">
      <div className="submenu-content">
        {activeSubMenu === 'Admins' && <AdminsPage />}
        {activeSubMenu === 'Users' && <UsersPage />}
      </div>
    </div>
  );
};

export default UserManagement;
