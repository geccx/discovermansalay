import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import './styles/Restaurants.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const ENDPOINT = API_BASE ? `${API_BASE}/api/destinations` : '/api/destinations';

const buildImageSrc = (imagePath) => {
  if (!imagePath) return '/images/fallback.jpg';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  return API_BASE ? `${API_BASE}${imagePath}` : imagePath;
};

const Restaurants = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true);
      try {
        const res = await axios.get(ENDPOINT);
        const all = Array.isArray(res.data) ? res.data : [];
        const filtered = all.filter((dest) => dest?.category === 'Restaurants');
        setRestaurants(filtered);
      } catch (err) {
        console.error('Error fetching restaurants:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurants();
  }, []);

  return (
    <>
      <Navbar />

      <div className="restaurants-hero">
        <div className="restaurants-hero-overlay" />
        <div className="restaurants-hero-content">
          <h1 className="restaurants-title">RESTAURANTS</h1>
          <div className="restaurants-underline" />
          <p className="restaurants-subtitle">
            Discover top dining experiences in our municipalities.
          </p>
        </div>
      </div>

      <div className="restaurants-section">
        <div className="restaurants-grid">
          {loading ? (
            <p>Loading restaurants...</p>
          ) : restaurants.length > 0 ? (
            restaurants.map((restaurant) => (
              <div key={restaurant.id} className="restaurants-card">
                <img
                  src={buildImageSrc(restaurant.image)}
                  alt={restaurant.name || 'Restaurant'}
                  className="restaurants-img"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.src = '/images/fallback.jpg'; }}
                />
                <div className="restaurants-content">
                  <h3 className="restaurants-name">{restaurant.name}</h3>
                </div>
              </div>
            ))
          ) : (
            <p>No restaurant destinations found.</p>
          )}
        </div>
      </div>
    </>
  );
};

export default Restaurants;
