// frontend component: AdminLogs.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "../styles/logs.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const AdminLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [totalLogs, setTotalLogs] = useState(0);
  const [todayLogs, setTodayLogs] = useState(0);
  const [activeAdmins, setActiveAdmins] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [error, setError] = useState(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await axios.get(`${API_BASE}/api/adminlogs`);
      const data = Array.isArray(res.data) ? res.data : [];

      setLogs(data);
      computeStats(data);
    } catch (err) {
      console.error("Error fetching admin logs:", err);
      setError("Failed to load admin logs.");
    } finally {
      setLoading(false);
    }
  };

  const computeStats = (data) => {
    setTotalLogs(data.length);

    const today = new Date().toISOString().slice(0, 10);
    const todayCount = data.filter((l) =>
      (l.timestamp || "").startsWith(today)
    ).length;
    setTodayLogs(todayCount);

    const activeIds = new Set(data.map((l) => l.admin_id));
    setActiveAdmins(activeIds.size);

    // Chart: count by action type
    const grouped = {};
    data.forEach((log) => {
      const key = log.action || "Other";
      grouped[key] = (grouped[key] || 0) + 1;
    });

    setChartData(
      Object.keys(grouped).map((k) => ({
        action: k,
        count: grouped[k],
      }))
    );
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="logs-page-container">
      <div className="logs-header-row">
        <h2>Admin Activity Logs</h2>
        <button className="logs-refresh-btn" onClick={fetchLogs}>
          Refresh
        </button>
      </div>

      {error && <p className="logs-error">{error}</p>}

      {/* Summary Cards */}
      <div className="logs-cards-row">
        <div className="logs-card">
          <p className="logs-card-label">Total Logged Actions</p>
          <p className="logs-card-value">{totalLogs}</p>
        </div>
        <div className="logs-card">
          <p className="logs-card-label">Actions Today</p>
          <p className="logs-card-value">{todayLogs}</p>
        </div>
        <div className="logs-card">
          <p className="logs-card-label">Active Admins</p>
          <p className="logs-card-value">{activeAdmins}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="logs-chart-card">
        <h3>Actions by Type</h3>
        {chartData.length === 0 ? (
          <p className="logs-empty-state">No logs available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="action" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Table */}
      <div className="logs-table-card">
        <h3>Recent Admin Actions</h3>

        {loading ? (
          <p>Loading...</p>
        ) : logs.length === 0 ? (
          <p className="logs-empty-state">No logs recorded yet.</p>
        ) : (
          <div className="logs-table-wrapper">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {logs.slice(0, 100).map((log) => (
                  <tr key={log.id}>
                    <td>
                      {log.timestamp
                        ? new Date(log.timestamp).toLocaleString()
                        : "N/A"}
                    </td>
                    <td>
                      {log.firstname || log.lastname
                        ? `${log.firstname || ""} ${log.lastname || ""}`
                        : `Admin #${log.admin_id}`}
                    </td>
                    <td>{log.action}</td>
                    <td>
                      <code className="logs-details-code">
                        {log.details}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {logs.length > 100 && (
              <p className="logs-note">
                Showing latest 100 logs. Older entries are hidden.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLogs;
