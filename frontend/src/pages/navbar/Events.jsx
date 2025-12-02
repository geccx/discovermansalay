// src/pages/Events.jsx
import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import './styles/NavbarPages.css';
import axios from 'axios';
import { format } from 'date-fns';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
// The highlight routes are mounted under the CMS highlight path in the gateway:
const ENDPOINT = API_BASE ? `${API_BASE}/api/cms/highlight/highlight-events` : '/api/cms/highlight/highlight-events';

const buildEventImageSrc = (imageNameOrUrl) => {
  if (!imageNameOrUrl) return '/images/fallback.jpg';
  if (imageNameOrUrl.startsWith('http://') || imageNameOrUrl.startsWith('https://')) return imageNameOrUrl;
  // if backend stores filename only, serve from /uploads/highlightevents/<filename>
  return API_BASE ? `${API_BASE}/uploads/highlightevents/${encodeURIComponent(imageNameOrUrl)}` : `/uploads/highlightevents/${encodeURIComponent(imageNameOrUrl)}`;
};

const formatDateRange = (rangeStr) => {
  if (!rangeStr) return '';
  const parts = String(rangeStr).split(' - ').map(s => s.trim());
  if (parts.length !== 2) return rangeStr;
  const [startStr, endStr] = parts;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start) || isNaN(end)) return rangeStr;
  return `${format(start, 'MMM dd')} - ${format(end, 'MMM dd')}`;
};

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const res = await axios.get(ENDPOINT);
        const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setEvents(data);
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  return (
    <>
      <Navbar />
      <div className="navbar-hero events-hero">
        <div className="navbar-hero-overlay" />
        <div className="navbar-hero-content">
          <h1 className="navbar-hero-title">EVENTS</h1>
          <div className="navbar-hero-underline" />
          <p className="navbar-hero-subtitle">Stay up to date on local happenings and festivals.</p>
        </div>
      </div>

      <div className="navbar-section">
        <h2 className="navbar-section-title">Upcoming Highlights</h2>
        <div className="navbar-grid">
          {loading ? (
            <p>Loading events...</p>
          ) : events.length === 0 ? (
            <p>No upcoming events found.</p>
          ) : (
            events.map((event, index) => (
              <div className="navbar-card" key={event.id ?? index}>
                <img
                  className="navbar-card-image"
                  src={buildEventImageSrc(event.image_url || event.image || event.imageUrl)}
                  alt={event.title || 'Event'}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.src = '/images/fallback.jpg'; }}
                />
                <h3 className="navbar-card-title">{event.title}</h3>
                <p className="navbar-card-text">{event.description}</p>
                <p className="navbar-card-date">{formatDateRange(event.date_range || event.dateRange)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default Events;
