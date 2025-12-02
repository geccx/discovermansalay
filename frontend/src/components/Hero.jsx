import React, { useEffect, useState } from 'react';
import '../styles/components.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const HERO_API = `${API_BASE}/api/cms/hero`;

const Hero = () => {
  const [heroData, setHeroData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHero = async () => {
    try {
      const res = await fetch(HERO_API);
      if (!res.ok) throw new Error('Failed to fetch hero content');
      const data = await res.json();
      setHeroData(data);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHero();

    // ✅ Optional: poll every 10s to automatically update frontend after CMS edits
    const interval = setInterval(fetchHero, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!heroData) return <div>Failed to load hero content.</div>;

  const mediaUrl = heroData.media_path
    ? `${API_BASE}/${heroData.media_path}?t=${Date.now()}`
    : 'https://via.placeholder.com/1920x1080?text=No+Media';

  return (
    <div className="hero-container">
      {heroData.media_type === 'video' ? (
        <video
          className="hero-background"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          key={mediaUrl}
        >
          <source src={mediaUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      ) : (
        <div
          className="hero-background-image"
          style={{ backgroundImage: `url(${mediaUrl})` }}
        />
      )}

      <div className="hero-overlay">
        <h1 className="hero-title">{heroData.title}</h1>
        <p className="hero-subtitle">{heroData.subtitle}</p>
      </div>
    </div>
  );
};

export default Hero;
