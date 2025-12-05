import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import "../styles/dashboardOverview.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#3b82f6", "#a855f7", "#ef4444"];

export default function DashboardOverview() {
  // User/Admin counts
  const [userCount, setUserCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);

  // Visitor data
  const [visitors, setVisitors] = useState([]);

  // Visitor analytics
  const [totalVisits, setTotalVisits] = useState(0);
  const [uniqueVisitors, setUniqueVisitors] = useState(0);
  const [todayVisits, setTodayVisits] = useState(0);
  const [peakHour, setPeakHour] = useState(null);
  const [topPage, setTopPage] = useState(null);

  const [chartData, setChartData] = useState([]);
  const [browserData, setBrowserData] = useState([]);
  const [deviceData, setDeviceData] = useState([]);
  const [pageData, setPageData] = useState([]);
  const [hourData, setHourData] = useState([]);

  useEffect(() => {
    fetchCounts();
    fetchVisitors();
  }, []);

  // Fetch user/admin counts
 const fetchCounts = async () => {
  try {
    const res = await axios.get(`${API_BASE}/api/admin/stats`);

    setUserCount(res.data.userCount || 0);
    setAdminCount(res.data.adminCount || 0);

  } catch (err) {
    console.error("Error fetching user/admin stats:", err);
  }
};


  // Fetch visitors
  const fetchVisitors = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/visitors`);
      const data = res.data || [];
      setVisitors(data);
      computeVisitorStats(data);
    } catch (err) {
      console.error("Visitor fetch error:", err);
    }
  };

  // Compute analytics
  const computeVisitorStats = (data) => {
    setTotalVisits(data.length);

    // Unique IPs
    const uniqueSet = new Set(data.map((v) => v.ip_address || "unknown"));
    setUniqueVisitors(uniqueSet.size);

    // Today's visits
    const today = new Date().toISOString().slice(0, 10);
    setTodayVisits(data.filter((v) => v.visit_time?.startsWith(today)).length);

    // Line chart: last 7 days
    const byDate = {};
    data.forEach((v) => {
      const d = v.visit_time?.slice(0, 10);
      if (!d) return;
      byDate[d] = (byDate[d] || 0) + 1;
    });

    const sortedDates = Object.keys(byDate).sort().slice(-7);
    setChartData(sortedDates.map((d) => ({ date: d, visits: byDate[d] })));

    // Device pie
    const deviceMap = {};
    data.forEach((v) => {
      const d = v.device || "Unknown";
      deviceMap[d] = (deviceMap[d] || 0) + 1;
    });
    setDeviceData(Object.entries(deviceMap).map(([name, value]) => ({ name, value })));

    // Top pages
    const pageMap = {};
    data.forEach((v) => {
      const p = v.page || "/";
      pageMap[p] = (pageMap[p] || 0) + 1;
    });

    const sortedPages = Object.entries(pageMap)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count);

    setPageData(sortedPages.slice(0, 5));
    setTopPage(sortedPages[0] || null);

    // Visits by hour
    const hourArr = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    data.forEach((v) => {
      const ts = v.visit_time;
      if (!ts) return;
      const d = new Date(ts);
      if (isNaN(d)) return;
      hourArr[d.getHours()].count++;
    });

    setHourData(hourArr);

    const peak = hourArr.reduce(
      (max, cur) => (cur.count > max.count ? cur : max),
      { hour: null, count: 0 }
    );
    setPeakHour(peak.count > 0 ? peak : null);
  };

  // ❗ FIX: Safe UI for Peak Hour display
  const peakHourDisplay =
    peakHour && peakHour.hour != null
      ? `${String(peakHour.hour).padStart(2, "0")}:00`
      : "N/A";

  return (
    <div className="dashboard-overview">
      <h2>Dashboard Overview</h2>

      {/* SUMMARY CARDS */}
      <div className="overview-grid">
        <div className="overview-card blue">
          <h3>Total Users</h3>
          <p>{userCount}</p>
        </div>

        <div className="overview-card green">
          <h3>Total Admins</h3>
          <p>{adminCount}</p>
        </div>

        <div className="overview-card purple">
          <h3>Total Visits</h3>
          <p>{totalVisits}</p>
        </div>

        <div className="overview-card orange">
          <h3>Unique Visitors</h3>
          <p>{uniqueVisitors}</p>
        </div>

        <div className="overview-card pink">
          <h3>Visits Today</h3>
          <p>{todayVisits}</p>
        </div>

        <div className="overview-card yellow">
          <h3>Peak Hour</h3>
          <p>{peakHourDisplay}</p>
        </div>

        <div className="overview-card teal">
          <h3>Top Page</h3>
          <p>{topPage?.page || "N/A"}</p>
        </div>
      </div>

      {/* LINE CHART */}
      <div className="overview-chart-card wide">
        <h3>Visitors — Last 7 Days</h3>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="visits" stroke="#4f46e5" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ANALYTICS CHART GRID */}
      <div className="overview-charts-grid">

        {/* Browser Pie */}
        <div className="overview-chart-card">
          <h3>Browser Usage</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={browserData} dataKey="value" nameKey="name" outerRadius={80} label>
                {browserData.map((entry, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Device Pie */}
        <div className="overview-chart-card">
          <h3>Devices</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={deviceData} dataKey="value" nameKey="name" outerRadius={80} label>
                {deviceData.map((entry, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Pages */}
        <div className="overview-chart-card">
          <h3>Top Pages</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pageData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="page" width={120} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Traffic */}
        <div className="overview-chart-card">
          <h3>Visits by Hour</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hourData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}
