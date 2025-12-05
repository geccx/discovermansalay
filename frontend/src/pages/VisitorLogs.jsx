// src/pages/VisitorLogs.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import "../styles/logs.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#3b82f6", "#a855f7", "#ef4444"];

const VisitorLogs = () => {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Summary
  const [totalVisits, setTotalVisits] = useState(0);
  const [uniqueVisitors, setUniqueVisitors] = useState(0);
  const [todayVisits, setTodayVisits] = useState(0);

  // Analytics data
  const [chartData, setChartData] = useState([]);
  const [browserData, setBrowserData] = useState([]);
  const [deviceData, setDeviceData] = useState([]);
  const [pageData, setPageData] = useState([]);
  const [hourData, setHourData] = useState([]);
  const [peakHour, setPeakHour] = useState(null);
  const [topPage, setTopPage] = useState(null);

  // Filters
  const [dateFilter, setDateFilter] = useState("7d"); // "today" | "7d" | "30d" | "all"
  const [search, setSearch] = useState("");

  const fetchVisitors = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/visitors`);
      const data = res.data || [];
      setVisitors(data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching visitors:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  // Apply date filter
  const filteredByDate = useMemo(() => {
    if (!visitors.length) return [];

    const now = new Date();
    return visitors.filter((v) => {
      if (!v.visit_time) return false;
      const d = new Date(v.visit_time);
      if (Number.isNaN(d.getTime())) return false;

      if (dateFilter === "all") return true;

      if (dateFilter === "today") {
        const todayStr = now.toISOString().slice(0, 10);
        return v.visit_time.startsWith(todayStr);
      }

      const diffMs = now - d;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (dateFilter === "7d") return diffDays <= 7;
      if (dateFilter === "30d") return diffDays <= 30;

      return true;
    });
  }, [visitors, dateFilter]);

  // Apply search filter across page, browser, device, ip
  const filteredVisitors = useMemo(() => {
    if (!search.trim()) return filteredByDate;

    const s = search.toLowerCase();
    return filteredByDate.filter((v) => {
      return (
        (v.page || "").toLowerCase().includes(s) ||
        (v.browser || "").toLowerCase().includes(s) ||
        (v.device || "").toLowerCase().includes(s) ||
        (v.ip_address || "").toLowerCase().includes(s) ||
        (v.country || "").toLowerCase().includes(s) ||
        (v.city || "").toLowerCase().includes(s)
      );
    });
  }, [filteredByDate, search]);

  // Compute statistics whenever visitors or filter changes
  useEffect(() => {
    const data = filteredByDate;

    setTotalVisits(data.length);

    const uniqueSet = new Set(data.map((v) => v.ip_address || "unknown"));
    setUniqueVisitors(uniqueSet.size);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = data.filter((v) =>
      (v.visit_time || "").startsWith(todayStr)
    ).length;
    setTodayVisits(todayCount);

    // ---- Line chart: last 7 days (based on all visitors, not only filtered) ----
    (() => {
      const byDate = {};
      visitors.forEach((v) => {
        if (!v.visit_time) return;
        const d = v.visit_time.slice(0, 10);
        if (!d) return;
        byDate[d] = (byDate[d] || 0) + 1;
      });
      const sortedDates = Object.keys(byDate).sort();
      const last7 = sortedDates.slice(-7);
      setChartData(last7.map((d) => ({ date: d, visits: byDate[d] })));
    })();

    // ---- Browser pie ----
    const browserMap = {};
    data.forEach((v) => {
      const b = v.browser || "Unknown";
      browserMap[b] = (browserMap[b] || 0) + 1;
    });
    setBrowserData(
      Object.entries(browserMap).map(([name, value]) => ({ name, value }))
    );

    // ---- Device pie ----
    const deviceMap = {};
    data.forEach((v) => {
      const d = v.device || "Unknown";
      deviceMap[d] = (deviceMap[d] || 0) + 1;
    });
    setDeviceData(
      Object.entries(deviceMap).map(([name, value]) => ({ name, value }))
    );

    // ---- Top pages bar chart ----
    const pageMap = {};
    data.forEach((v) => {
      const p = v.page || "/";
      pageMap[p] = (pageMap[p] || 0) + 1;
    });
    const pageArr = Object.entries(pageMap)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count);

    setPageData(pageArr.slice(0, 7));
    setTopPage(pageArr[0] || null);

    // ---- Visits by hour chart (0–23) ----
    const hourMap = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    data.forEach((v) => {
      if (!v.visit_time) return;
      const d = new Date(v.visit_time);
      if (Number.isNaN(d.getTime())) return;
      const h = d.getHours();
      if (h >= 0 && h < 24) {
        hourMap[h].count += 1;
      }
    });
    setHourData(hourMap);

    const peak = hourMap.reduce(
      (max, cur) => (cur.count > max.count ? cur : max),
      { hour: null, count: 0 }
    );
    setPeakHour(peak.count > 0 ? peak : null);
  }, [visitors, filteredByDate]);

  const handleExportCSV = () => {
    if (!filteredVisitors.length) return;

    const headers = [
      "ID",
      "Visit Time",
      "IP Address",
      "Page",
      "Browser",
      "Device",
      "Country",
      "City",
    ];

    const rows = filteredVisitors.map((v) => [
      v.id,
      v.visit_time,
      v.ip_address,
      v.page,
      v.browser,
      v.device,
      v.country || "",
      v.city || "",
    ]);

    const csvContent =
      [headers, ...rows]
        .map((r) =>
          r
            .map((x) =>
              `"${String(x ?? "").replace(/"/g, '""')}"`
            )
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visitor_logs_${dateFilter}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="logs-page-container">
      <div className="logs-header-row">
        <div>
          <h2>Visitor Analytics</h2>
          <p className="logs-subtitle">
            Traffic, sources, and behavior of visitors in real time.
          </p>
        </div>
        <div className="logs-header-actions">
          <div className="logs-filter-group">
            <button
              className={dateFilter === "today" ? "active" : ""}
              onClick={() => setDateFilter("today")}
            >
              Today
            </button>
            <button
              className={dateFilter === "7d" ? "active" : ""}
              onClick={() => setDateFilter("7d")}
            >
              Last 7 Days
            </button>
            <button
              className={dateFilter === "30d" ? "active" : ""}
              onClick={() => setDateFilter("30d")}
            >
              Last 30 Days
            </button>
            <button
              className={dateFilter === "all" ? "active" : ""}
              onClick={() => setDateFilter("all")}
            >
              All Time
            </button>
          </div>

          <button className="logs-export-btn" onClick={handleExportCSV}>
            Export CSV
          </button>

          <button className="logs-refresh-btn" onClick={fetchVisitors}>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="logs-cards-row">
        <div className="logs-card">
          <p className="logs-card-label">Total Visits</p>
          <p className="logs-card-value">{totalVisits}</p>
        </div>
        <div className="logs-card">
          <p className="logs-card-label">Unique Visitors (IPs)</p>
          <p className="logs-card-value">{uniqueVisitors}</p>
        </div>
        <div className="logs-card">
          <p className="logs-card-label">Visits Today</p>
          <p className="logs-card-value">{todayVisits}</p>
        </div>
        <div className="logs-card">
          <p className="logs-card-label">Peak Hour</p>
          <p className="logs-card-value">
            {peakHour && peakHour.hour !== null
              ? `${peakHour.hour.toString().padStart(2, "0")}:00`
              : "N/A"}
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="logs-charts-grid">
        {/* Main line chart */}
        <div className="logs-chart-card wide">
          <h3>Visits - Last 7 Days</h3>
          {chartData.length === 0 ? (
            <p className="logs-empty-state">Not enough data for chart yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="visits"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Browser pie */}
        <div className="logs-chart-card">
          <h3>Browsers</h3>
          {browserData.length === 0 ? (
            <p className="logs-empty-state">No browser data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={browserData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label
                >
                  {browserData.map((entry, idx) => (
                    <Cell
                      key={`b-${idx}`}
                      fill={COLORS[idx % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Device pie */}
        <div className="logs-chart-card">
          <h3>Devices</h3>
          {deviceData.length === 0 ? (
            <p className="logs-empty-state">No device data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={deviceData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label
                >
                  {deviceData.map((entry, idx) => (
                    <Cell
                      key={`d-${idx}`}
                      fill={COLORS[idx % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top pages */}
        <div className="logs-chart-card">
          <h3>Top Pages</h3>
          {pageData.length === 0 ? (
            <p className="logs-empty-state">No page data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pageData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="page" width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          )}
          {topPage && (
            <p className="logs-note">
              Most visited page: <strong>{topPage.page}</strong> (
              {topPage.count} visits)
            </p>
          )}
        </div>

        {/* Visits by hour */}
        <div className="logs-chart-card">
          <h3>Visits by Hour (Selected Range)</h3>
          {hourData.every((h) => h.count === 0) ? (
            <p className="logs-empty-state">No hourly data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h) => h.toString().padStart(2, "0")}
                />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(h) =>
                    `${h.toString().padStart(2, "0")}:00`
                  }
                />
                <Bar dataKey="count" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Search + Table */}
      <div className="logs-table-card">
        <div className="logs-table-header">
          <h3>Recent Visits</h3>
          <input
            type="text"
            placeholder="Search by IP, page, browser, device, country, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="logs-search-input"
          />
        </div>

        {loading ? (
          <p>Loading visitor logs...</p>
        ) : filteredVisitors.length === 0 ? (
          <p className="logs-empty-state">
            No visitors found for the selected filter.
          </p>
        ) : (
          <div className="logs-table-wrapper">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>IP</th>
                  <th>Page</th>
                  <th>Browser</th>
                  <th>Device</th>
                  <th>Country</th>
                  <th>City</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisitors.slice(0, 150).map((v) => (
                  <tr key={v.id}>
                    <td>
                      {v.visit_time &&
                        new Date(v.visit_time).toLocaleString()}
                    </td>
                    <td>{v.ip_address}</td>
                    <td>{v.page}</td>
                    <td>{v.browser}</td>
                    <td>{v.device}</td>
                    <td>{v.country || "-"}</td>
                    <td>{v.city || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredVisitors.length > 150 && (
              <p className="logs-note">
                Showing latest 150 visits. Use CSV export for full data.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitorLogs;
