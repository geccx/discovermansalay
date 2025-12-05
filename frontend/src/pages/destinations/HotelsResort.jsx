// src/pages/HotelsResort.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import './styles/HotelsResort.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const ENDPOINT = API_BASE ? `${API_BASE}/api/destinations` : '/api/destinations';

const buildImageSrc = (mediaPath) => {
  if (!mediaPath) return '/images/fallback.jpg';
  if (mediaPath.startsWith('http')) return mediaPath;
  return API_BASE ? `${API_BASE}${mediaPath}` : mediaPath;
};

const HotelsResort = () => {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHotels = async () => {
      setLoading(true);
      try {
        const res = await axios.get(ENDPOINT);
        const all = Array.isArray(res.data) ? res.data : [];
        const filtered = all.filter((item) => item?.category === 'Hotels & Resort');
        setHotels(filtered);
      } catch (err) {
        console.error('Error loading hotels:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHotels();
  }, []);

  return (
    <>
      <Navbar />

      <div className="hotels-hero">
        <div className="hotels-hero-overlay" />
        <div className="hotels-hero-content">
          <h1 className="hotels-title">HOTELS & RESORT</h1>
          <div className="hotels-underline" />
          <p className="hotels-subtitle">Comfort and luxury await at our top-rated stays.</p>
        </div>
      </div>

      <div className="hotels-section">
        <div className="hotels-grid">
          {loading ? (
            <p>Loading hotels & resorts...</p>
          ) : hotels.length > 0 ? (
            hotels.map((item) => (
              <div key={item.id} className="hotels-card">
                <img
                  src={buildImageSrc(item.media_path)}
                  alt={item.title}
                  className="hotels-img"
                  loading="lazy"
                  onError={(e) => (e.currentTarget.src = '/images/fallback.jpg')}
                />
                <div className="hotels-content">
                  <h3 className="hotels-name">{item.title}</h3>
                </div>
              </div>
            ))
          ) : (
            <p>No hotel or resort listings available.</p>
          )}
        </div>
      </div>
    </>
  );
};

export default HotelsResort;
