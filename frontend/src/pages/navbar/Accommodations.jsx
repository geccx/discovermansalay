import React, { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "../../components/Navbar";
import "./styles/booking.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const ENDPOINT = `${API_BASE}/api/cms/accommodation`;
const BOOKING_ENDPOINT = `${API_BASE}/api/booking`;

const buildImageSrc = (path) => {
  if (!path) return "/images/fallback.jpg";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
};

const Accommodations = () => {
  const [accommodations, setAccommodations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    contact: "",
    check_in: "",
    check_in_time: "",
    check_out: "",
    check_out_time: "",
    guests: 1,
  });

  /* ---------------------------------------------------
      REQUIRE LOGIN BEFORE BOOKING
  --------------------------------------------------- */
  const openBooking = (place) => {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("Please log in first before making a booking.");
      window.location.href = "/login";
      return;
    }

    setSelected(place);
  };

  const closeBooking = () => setSelected(null);

  /* ---------------------------------------------------
      SUBMIT BOOKING
  --------------------------------------------------- */
  const submitBooking = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("You must be logged in to submit a booking.");
      window.location.href = "/login";
      return;
    }

    try {
      const payload = {
        accommodation_id: selected.id,
        user_name: form.name,
        user_email: form.email,
        user_contact: form.contact,
        check_in: form.check_in,
        check_out: form.check_out,
        check_in_time: form.check_in_time,
        check_out_time: form.check_out_time,
        guests: form.guests,
      };

      const res = await axios.post(BOOKING_ENDPOINT, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      alert(res.data.message);
      closeBooking();

      setForm({
        name: "",
        email: "",
        contact: "",
        check_in: "",
        check_in_time: "",
        check_out: "",
        check_out_time: "",
        guests: 1,
      });
    } catch (err) {
      console.error(err);
      alert("Booking failed. Please try again later.");
    }
  };

  /* ---------------------------------------------------
      FETCH ACCOMMODATIONS
  --------------------------------------------------- */
  useEffect(() => {
    const fetchAccommodations = async () => {
      setLoading(true);
      try {
        const res = await axios.get(ENDPOINT);
        const list = Array.isArray(res.data) ? res.data : [];
        setAccommodations(list);
      } catch (err) {
        console.error("Failed to fetch accommodations:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAccommodations();
  }, []);

  return (
    <>
      <Navbar />

      {/* HERO SECTION */}
      <div className="navbar-hero accommodations-hero">
        <div className="navbar-hero-overlay" />
        <div className="navbar-hero-content">
          <h1 className="navbar-hero-title">ACCOMMODATIONS</h1>
          <div className="navbar-hero-underline" />
          <p className="navbar-hero-subtitle">
            Find a place to stay for every traveler.
          </p>
        </div>
      </div>

      {/* ACCOMMODATION LIST */}
      <div className="navbar-section">
        <h2 className="navbar-section-title">Top Places to Stay</h2>

        <div className="navbar-grid">
          {loading ? (
            <p>Loading accommodations...</p>
          ) : accommodations.length > 0 ? (
            accommodations.map((place) => (
              <div key={place.id} className="navbar-card">
                <img
                  src={buildImageSrc(place.media_path)}
                  alt={place.title}
                  className="navbar-card-image"
                  loading="lazy"
                  onError={(e) => (e.currentTarget.src = "/images/fallback.jpg")}
                />

                <h3 className="navbar-card-title">{place.title}</h3>
                <p className="navbar-card-text">{place.description}</p>

                <button
                  className="navbar-book-btn"
                  onClick={() => openBooking(place)}
                >
                  Book Now
                </button>
              </div>
            ))
          ) : (
            <p>No accommodations available.</p>
          )}
        </div>
      </div>

      {/* BOOKING MODAL */}
      {selected && (
        <div className="booking-modal-overlay">
          <div className="booking-modal enhanced">
            <button className="modal-close-btn" onClick={closeBooking}>
              ✕
            </button>

            <h2 className="modal-title">
              Book <span>{selected.title}</span>
            </h2>

            <div className="modal-grid">
              <input
                className="modal-input"
                placeholder="Full Name"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />

              <input
                className="modal-input"
                placeholder="Email Address"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
              />

              <input
                className="modal-input"
                placeholder="Contact Number"
                value={form.contact}
                onChange={(e) =>
                  setForm({ ...form, contact: e.target.value })
                }
              />

              {/* CHECK-IN */}
              <label className="modal-label">Check-in Date</label>
              <input
                type="date"
                className="modal-input"
                value={form.check_in}
                onChange={(e) =>
                  setForm({ ...form, check_in: e.target.value })
                }
              />

              <label className="modal-label">Check-in Time</label>
              <input
                type="time"
                className="modal-input"
                value={form.check_in_time}
                onChange={(e) =>
                  setForm({ ...form, check_in_time: e.target.value })
                }
              />

              {/* CHECK-OUT */}
              <label className="modal-label">Check-out Date</label>
              <input
                type="date"
                className="modal-input"
                value={form.check_out}
                onChange={(e) =>
                  setForm({ ...form, check_out: e.target.value })
                }
              />

              <label className="modal-label">Check-out Time</label>
              <input
                type="time"
                className="modal-input"
                value={form.check_out_time}
                onChange={(e) =>
                  setForm({ ...form, check_out_time: e.target.value })
                }
              />

              {/* GUESTS */}
              <label className="modal-label">Guests</label>
              <input
                type="number"
                className="modal-input"
                min="1"
                value={form.guests}
                onChange={(e) =>
                  setForm({ ...form, guests: e.target.value })
                }
              />
            </div>

            {/* ACTION BUTTONS */}
            <div className="modal-actions">
              <button className="cancel-btn enhanced-cancel" onClick={closeBooking}>
                Cancel
              </button>
              <button
                className="submit-btn enhanced-submit"
                onClick={submitBooking}
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Accommodations;
