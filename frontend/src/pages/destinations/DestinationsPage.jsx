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
  Accommodations: 'Accommodations'
};

const toSafeClassName = (str) =>
  String(str || '').replace(/ & /g, '-and-').replace(/\s+/g, '-').toLowerCase();

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const ENDPOINT = API_BASE ? `${API_BASE}/api/destinations` : '/api/destinations';

const buildImageSrc = (mediaPath) => {
  if (!mediaPath) return '/images/fallback.jpg';
  if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) return mediaPath;
  return API_BASE ? `${API_BASE}${mediaPath}` : mediaPath;
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

  // Group by category
  const groupedByCategory = destinations.reduce((groups, item) => {
    const category = item?.category || 'Uncategorized';
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
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
                onSwiper={(swiper) => {
                  try {
                    swiper.params.navigation.nextEl = `.custom-swiper-button-next-${safeClass}`;
                    swiper.params.navigation.prevEl = `.custom-swiper-button-prev-${safeClass}`;
                    swiper.navigation.update();
                  } catch (err) {
                    console.warn('Swiper navigation init warning:', err);
                  }
                }}
              >
                {items.map((dest) => (
                  <SwiperSlide key={dest.id}>
                    <div className="destination-card">
                      <img
                        src={buildImageSrc(dest.media_path)}
                        alt={dest.title}
                        className="destination-img"
                        onError={(e) => { e.currentTarget.src = '/images/fallback.jpg'; }}
                      />
                      <div className="destination-name">{dest.title}</div>
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
              <Link to={`/destinations/${safeClass}`} className="view-all-button">
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
