// src/pages/Beaches.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import './styles/Beaches.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const ENDPOINT = API_BASE ? `${API_BASE}/api/destinations` : '/api/destinations';

const buildImageSrc = (mediaPath) => {
  if (!mediaPath) return '/images/fallback.jpg';
  if (mediaPath.startsWith('http')) return mediaPath;
  return API_BASE ? `${API_BASE}${mediaPath}` : mediaPath;
};

const Beaches = () => {
  const [beaches, setBeaches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBeaches = async () => {
      setLoading(true);
      try {
        const res = await axios.get(ENDPOINT);
        const all = Array.isArray(res.data) ? res.data : [];
        const filtered = all.filter((item) => item?.category === 'Beaches');
        setBeaches(filtered);
      } catch (err) {
        console.error('Error fetching beaches:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBeaches();
  }, []);

  return (
    <>
      <Navbar />

      <div className="beaches-hero">
        <div className="beaches-hero-overlay" />
        <div className="beaches-hero-content">
          <h1 className="beaches-title">BEACHES</h1>
          <div className="beaches-underline" />
          <p className="beaches-subtitle">Explore the most beautiful beaches in our municipalities.</p>
        </div>
      </div>

      <div className="beaches-section">
        <div className="beaches-grid">
          {loading ? (
            <p>Loading beaches...</p>
          ) : beaches.length > 0 ? (
            beaches.map((item) => (
              <div key={item.id} className="beaches-card">
                <img
                  src={buildImageSrc(item.media_path)}
                  alt={item.title}
                  className="beaches-img"
                  loading="lazy"
                  onError={(e) => (e.currentTarget.src = '/images/fallback.jpg')}
                />
                <div className="beaches-content">
                  <h3 className="beaches-name">{item.title}</h3>
                </div>
              </div>
            ))
          ) : (
            <p>No beach destinations found.</p>
          )}
        </div>
      </div>
    </>
  );
};

export default Beaches;
