// src/pages/Accommodations.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import './styles/NavbarPages.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const ENDPOINT = API_BASE ? `${API_BASE}/api/destinations` : '/api/destinations';

const buildImageSrc = (imagePath) => {
  if (!imagePath) return '/images/fallback.jpg';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  return API_BASE ? `${API_BASE}${imagePath}` : imagePath;
};

const Accommodations = () => {
  const [accommodations, setAccommodations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccommodations = async () => {
      setLoading(true);
      try {
        const res = await axios.get(ENDPOINT);
        const all = Array.isArray(res.data) ? res.data : [];
        const filtered = all.filter((item) => item?.category === 'Accommodations');
        setAccommodations(filtered);
      } catch (err) {
        console.error('Failed to fetch accommodations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAccommodations();
  }, []);

  return (
    <>
      <Navbar />
      <div className="navbar-hero accommodations-hero">
        <div className="navbar-hero-overlay" />
        <div className="navbar-hero-content">
          <h1 className="navbar-hero-title">ACCOMMODATIONS</h1>
          <div className="navbar-hero-underline" />
          <p className="navbar-hero-subtitle">Find a place to stay for every traveler.</p>
        </div>
      </div>

      <div className="navbar-section">
        <h2 className="navbar-section-title">Top Places to Stay</h2>
        <div className="navbar-grid">
          {loading ? (
            <p>Loading accommodations...</p>
          ) : accommodations.length > 0 ? (
            accommodations.map((place) => (
              <div key={place.id} className="navbar-card">
                <img
                  src={buildImageSrc(place.image)}
                  alt={place.name || 'Accommodation'}
                  className="navbar-card-image"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.src = '/images/fallback.jpg'; }}
                />
                <h3 className="navbar-card-title">{place.name}</h3>
                <p className="navbar-card-text">{place.description}</p>
              </div>
            ))
          ) : (
            <p>No accommodations available.</p>
          )}
        </div>
      </div>
    </>
  );
};

export default Accommodations;
