// src/pages/DestinationsPage.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import axios from 'axios';
import './styles/DestinationsPage.css';

import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/navigation';
import { Navigation } from 'swiper/modules';

const CATEGORY_LABELS = {
  'Featured Destinations': 'Featured Destinations',
  Beaches: 'Beaches',
  Restaurants: 'Restaurants',
  Adventures: 'Adventures',
  'Hotels & Resort': 'Hotels & Resort',
};

// Utility to sanitize class names for Swiper buttons
const toSafeClassName = (str) =>
  String(str || '').replace(/ & /g, '-and-').replace(/\s+/g, '-').toLowerCase();

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const ENDPOINT = API_BASE ? `${API_BASE}/api/destinations` : '/api/destinations';

// Builds an image src from a backend-provided path or absolute URL
const buildImageSrc = (imagePath) => {
  if (!imagePath) return '/images/fallback.jpg';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  // imagePath may already include a leading slash like '/uploads/...'
  return API_BASE ? `${API_BASE}${imagePath}` : imagePath;
};

const DestinationsPage = () => {
  const [destinations, setDestinations] = useState([]);

  useEffect(() => {
    const fetchDestinations = async () => {
      try {
        const res = await axios.get(ENDPOINT);
        setDestinations(res.data || []);
      } catch (err) {
        console.error('Failed to load destinations:', err);
      }
    };

    fetchDestinations();
  }, []);

  const groupedByCategory = destinations.reduce((groups, dest) => {
    const category = dest?.category || 'Uncategorized';
    if (!groups[category]) groups[category] = [];
    groups[category].push(dest);
    return groups;
  }, {});

  return (
    <>
      <Navbar />

      <div className="destinations-hero">
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1 className="hero-title">DESTINATIONS</h1>
          <div className="hero-underline" />
          <p className="hero-subtitle">Check out destinations from our municipalities.</p>
        </div>
      </div>

      {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
        const items = groupedByCategory[key] || [];
        if (items.length === 0) return null;

        const safeClass = toSafeClassName(key);

        return (
          <div className="destinations-section" key={key}>
            <h2 className="section-title">{label}</h2>

            <div className="swiper-wrapper">
              <button
                className={`custom-swiper-button-prev-${safeClass}`}
                aria-label="Previous Slide"
                type="button"
              >
                &#10094;
              </button>

              <Swiper
                spaceBetween={20}
                slidesPerView={1}
                breakpoints={{
                  640: { slidesPerView: 1.5 },
                  768: { slidesPerView: 2 },
                  1024: { slidesPerView: 3 },
                }}
                navigation={{
                  nextEl: `.custom-swiper-button-next-${safeClass}`,
                  prevEl: `.custom-swiper-button-prev-${safeClass}`,
                }}
                modules={[Navigation]}
                className="destinations-swiper"
                // prevent swiper from crashing if nav elements are not immediately available:
                onSwiper={(swiper) => {
                  // try to update navigation if available
                  try {
                    swiper.params.navigation.nextEl = `.custom-swiper-button-next-${safeClass}`;
                    swiper.params.navigation.prevEl = `.custom-swiper-button-prev-${safeClass}`;
                    if (swiper.navigation && typeof swiper.navigation.update === 'function') {
                      swiper.navigation.update();
                    }
                  } catch (err) {
                    // log but don't throw
                    /// eslint-disable-next-line no-console
                    console.warn('Swiper navigation init warning:', err);
                  }
                }}
              >
                {items.map((dest) => (
                  <SwiperSlide key={dest.id ?? `${key}-${Math.random()}`}>
                    <div className="destination-card">
                      <img
                        src={buildImageSrc(dest.image)}
                        alt={dest.name || 'Destination'}
                        className="destination-img"
                        onError={(e) => { e.currentTarget.src = '/images/fallback.jpg'; }}
                      />
                      <div className="destination-name">{dest.name}</div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>

              <button
                className={`custom-swiper-button-next-${safeClass}`}
                aria-label="Next Slide"
                type="button"
              >
                &#10095;
              </button>
            </div>

            <div className="view-all-wrapper">
              <Link
                to={`/destinations/${safeClass}`}
                className="view-all-button"
              >
                View all {label}
              </Link>
            </div>
          </div>
        );
      })}
    </>
  );
};

export default DestinationsPage;
