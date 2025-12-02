import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import './styles/HotelsResort.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const ENDPOINT = API_BASE ? `${API_BASE}/api/destinations` : '/api/destinations';

const buildImageSrc = (imagePath) => {
  if (!imagePath) return '/images/fallback.jpg';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  return API_BASE ? `${API_BASE}${imagePath}` : imagePath;
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
        // match exact category string 'Hotels & Resort'
        const filtered = all.filter((dest) => dest?.category === 'Hotels & Resort');
        setHotels(filtered);
      } catch (err) {
        console.error('Error fetching hotels & resorts:', err);
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
          <h1 className="hotels-title">HOTELS & RESORTS</h1>
          <div className="hotels-underline" />
          <p className="hotels-subtitle">Comfort and luxury await at our top-rated stays.</p>
        </div>
      </div>

      <div className="hotels-section">
        <div className="hotels-grid">
          {loading ? (
            <p>Loading hotels & resorts...</p>
          ) : hotels.length > 0 ? (
            hotels.map((hotel) => (
              <div key={hotel.id} className="hotels-card">
                <img
                  src={buildImageSrc(hotel.image)}
                  alt={hotel.name || 'Hotel/Resort'}
                  className="hotels-img"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.src = '/images/fallback.jpg'; }}
                />
                <div className="hotels-content">
                  <h3 className="hotels-name">{hotel.name}</h3>
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
