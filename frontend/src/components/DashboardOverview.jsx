import React, { useEffect, useState } from 'react';
import axios from 'axios';

const USER_API = 'http://localhost:3002/api';
//sdfsdf

const DashboardOverview = () => {
  const [userCount, setUserCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);

useEffect(() => {
  const fetchCounts = async () => {
    try {
      const [userRes, adminRes] = await Promise.all([
        axios.get(`${USER_API}/users/count`),
        axios.get(`${USER_API}/admins/count`)
      ]);

      console.log('User count:', userRes.data.count);
      console.log('Admin count:', adminRes.data.count);

      setUserCount(userRes.data.count);
      setAdminCount(adminRes.data.count);
    } catch (error) {
      console.error('Error fetching counts:', error);
    }
  };

  fetchCounts();
}, []);

console.log('Rendering DashboardOverview:', { userCount, adminCount });

  return (
    <div className="dashboard-overview">
      <h2>Dashboard Overview</h2>
      <div className="overview-card-list">
        <div className="overview-card">
          <h3>Total Users</h3>
          <p>{userCount}</p>
        </div>
        <div className="overview-card">
          <h3>Total Admins</h3>
          <p>{adminCount}</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
