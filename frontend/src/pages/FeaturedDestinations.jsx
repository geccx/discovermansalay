// src/pages/FeaturedDestinations.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import './styles/FeaturedDestinations.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const ENDPOINT = API_BASE ? `${API_BASE}/api/destinations` : '/api/destinations';

const buildImageSrc = (mediaPath) => {
  if (!mediaPath) return '/images/fallback.jpg';
  if (mediaPath.startsWith('http')) return mediaPath;
  return API_BASE ? `${API_BASE}${mediaPath}` : mediaPath;
};

const FeaturedDestinations = () => {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      setLoading(true);
      try {
        const res = await axios.get(ENDPOINT);
        const all = Array.isArray(res.data) ? res.data : [];
        const filtered = all.filter(
          (item) => item?.category === 'Featured Destinations'
        );
        setFeatured(filtered);
      } catch (err) {
        console.error('Error fetching featured destinations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatured();
  }, []);

  return (
    <>
      <Navbar />

      <div className="featured-hero">
        <div className="featured-hero-overlay" />
        <div className="featured-hero-content">
          <h1 className="featured-title">FEATURED DESTINATIONS</h1>
          <div className="featured-underline" />
          <p className="featured-subtitle">Top destinations you should not miss.</p>
        </div>
      </div>

      <div className="featured-section">
        <div className="featured-grid">
          {loading ? (
            <p>Loading featured destinations...</p>
          ) : featured.length > 0 ? (
            featured.map((item) => (
              <div key={item.id} className="featured-card">
                <img
                  src={buildImageSrc(item.media_path)}
                  alt={item.title}
                  className="featured-img"
                  loading="lazy"
                  onError={(e) => (e.currentTarget.src = '/images/fallback.jpg')}
                />
                <div className="featured-content">
                  <h3 className="featured-name">{item.title}</h3>
                </div>
              </div>
            ))
          ) : (
            <p>No featured destinations available.</p>
          )}
        </div>
      </div>
    </>
  );
};

export default FeaturedDestinations;
