import React, { useEffect, useState } from "react";
import axios from "axios";
import "./styles/BookingCMS.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const ENDPOINT = `${API_BASE}/api/booking`;

const BookingCMS = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ----------------------------------------
      FORMAT TIME → h:mm AM/PM
  ----------------------------------------- */
  const formatTime = (time) => {
    if (!time) return "—";
    const [hour, minute] = time.split(":");
    let h = parseInt(hour);
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${minute} ${suffix}`;
  };

  /* ----------------------------------------
      FORMAT DATE → YYYY-MM-DD (clean)
  ----------------------------------------- */
  const formatDate = (dateString) => {
    if (!dateString) return "—";

    // Remove timezone Z if present
    const clean = dateString.replace("Z", "");

    const date = new Date(clean);
    if (isNaN(date)) return dateString;

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
  };

  /* ----------------------------------------
      FETCH BOOKINGS
  ----------------------------------------- */
  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await axios.get(ENDPOINT);
      setBookings(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------------------------
      ADMIN CONFIRM BOOKING → awaiting_management
  ----------------------------------------- */
  const adminConfirm = async (id) => {
    if (!confirm("Forward this booking to accommodation management?")) return;
    try {
      const res = await axios.put(`${ENDPOINT}/confirm/${id}`);
      alert(res.data.message);
      fetchBookings();
    } catch (err) {
      console.error(err);
      alert("Failed to confirm booking.");
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  return (
    <div className="bookingcms-container">
      <h1 className="bookingcms-title">Booking Management</h1>

      {loading ? (
        <p>Loading...</p>
      ) : bookings.length > 0 ? (
        <table className="bookingcms-table">
          <thead>
            <tr>
              <th>Accommodation</th>
              <th>Guest</th>
              <th>Email</th>
              <th>Contact</th>

              <th>Check-in Date</th>
              <th>Check-in Time</th>

              <th>Check-out Date</th>
              <th>Check-out Time</th>

              <th>Guests</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>{b.accommodation_name}</td>
                <td>{b.user_name}</td>
                <td>{b.user_email}</td>
                <td>{b.user_contact}</td>

                <td>{formatDate(b.check_in)}</td>
                <td>{formatTime(b.check_in_time)}</td>

                <td>{formatDate(b.check_out)}</td>
                <td>{formatTime(b.check_out_time)}</td>

                <td>{b.guests}</td>

                {/* STATUS BADGES */}
                <td>
                  {b.status === "pending" && (
                    <span className="status-badge badge-pending">Pending</span>
                  )}

                  {b.status === "awaiting_management" && (
                    <span className="status-badge badge-awaiting">
                      Awaiting Management
                    </span>
                  )}

                  {b.status === "confirmed" && (
                    <span className="status-badge badge-confirmed">
                      Confirmed
                    </span>
                  )}

                  {b.status === "cancelled" && (
                    <span className="status-badge badge-cancelled">
                      Cancelled
                    </span>
                  )}
                </td>

                {/* ACTION BUTTONS */}
                <td className="action-buttons">
                  {b.status === "pending" && (
                    <button
                      className="action-btn btn-forward"
                      onClick={() => adminConfirm(b.id)}
                    >
                      Forward to Management
                    </button>
                  )}

                  {b.status === "awaiting_management" && (
                    <span className="status-badge badge-awaiting">
                      Awaiting Response
                    </span>
                  )}

                  {b.status === "confirmed" && (
                    <span className="status-final">✔ Confirmed</span>
                  )}

                  {b.status === "cancelled" && (
                    <span className="status-final red">✖ Cancelled</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No bookings found.</p>
      )}
    </div>
  );
};

export default BookingCMS;
