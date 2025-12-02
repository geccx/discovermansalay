import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import './styles/Adventures.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const ENDPOINT = API_BASE ? `${API_BASE}/api/destinations` : '/api/destinations';

const buildImageSrc = (imagePath) => {
  if (!imagePath) return '/images/fallback.jpg';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  return API_BASE ? `${API_BASE}${imagePath}` : imagePath;
};

const Adventures = () => {
  const [adventures, setAdventures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdventures = async () => {
      setLoading(true);
      try {
        const res = await axios.get(ENDPOINT);
        const all = Array.isArray(res.data) ? res.data : [];
        const filtered = all.filter((dest) => dest?.category === 'Adventures');
        setAdventures(filtered);
      } catch (err) {
        console.error('Error fetching adventures:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAdventures();
  }, []);

  return (
    <>
      <Navbar />

      <div className="adventures-hero">
        <div className="adventures-hero-overlay" />
        <div className="adventures-hero-content">
          <h1 className="adventures-title">ADVENTURES</h1>
          <div className="adventures-underline" />
          <p className="adventures-subtitle">
            Thrilling adventures for every adrenaline seeker.
          </p>
        </div>
      </div>

      <div className="adventures-section">
        <div className="adventures-grid">
          {loading ? (
            <p>Loading adventures...</p>
          ) : adventures.length > 0 ? (
            adventures.map((adventure) => (
              <div key={adventure.id} className="adventures-card">
                <img
                  src={buildImageSrc(adventure.image)}
                  alt={adventure.name || 'Adventure'}
                  className="adventures-img"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.src = '/images/fallback.jpg'; }}
                />
                <div className="adventures-content">
                  <h3 className="adventures-name">{adventure.name}</h3>
                </div>
              </div>
            ))
          ) : (
            <p>No adventure destinations found.</p>
          )}
        </div>
      </div>
    </>
  );
};

export default Adventures;
