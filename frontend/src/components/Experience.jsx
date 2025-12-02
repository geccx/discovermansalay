// Experience.jsx
import React, { useEffect, useState } from 'react';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const API_ROOT = `${API_BASE_URL}/api/cms/experience`;
const UPLOADS_BASE = `${API_BASE_URL}/uploads`; // image files: `${UPLOADS_BASE}/${image_path}`

const Experience = () => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const MIN_CARDS = 6;

  useEffect(() => {
    let mounted = true;
    const fetchCards = async () => {
      try {
        const res = await fetch(API_ROOT);
        const data = await res.json();
        if (mounted) {
          setCards(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Error loading experience cards:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchCards();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <p>Loading experience cards...</p>;
  if (!loading && cards.length < MIN_CARDS) {
    return <p>Not enough experience cards to display. Currently have {cards.length}.</p>;
  }

  // safe accessor helper
  const getImgSrc = (card) => {
    if (!card) return '';
    if (!card.image_path) return '';
    // avoid double slashes
    return card.image_path.startsWith('http') ? card.image_path : `${UPLOADS_BASE}/${card.image_path}`;
  };

  return (
    <section className="experience-container">
      <h2 className="experience-title">Experience Mansalay</h2>
      <div className="experience-grid">
        {/* Left side */}
        <div className="left-side">
          {/* Large card */}
          <a
            href={cards[0]?.link || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="large-card"
          >
            <img
              src={getImgSrc(cards[0])}
              alt={cards[0]?.title || 'Experience'}
              loading="lazy"
            />
            <div className="card-label">{cards[0]?.title}</div>
          </a>

          {/* Two small cards */}
          <div className="small-cards-row">
            {[1, 2].map(i => {
              const card = cards[i];
              if (!card) return null;
              return (
                <a
                  key={card.id}
                  href={card.link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="small-card"
                >
                  <img src={getImgSrc(card)} alt={card.title} loading="lazy" />
                  <div className="card-label">{card.title}</div>
                </a>
              );
            })}
          </div>
        </div>

        {/* Right side */}
        <div className="right-side">
          {/* Two small cards */}
          <div className="small-cards-row">
            {[3, 5].map(i => {
              const card = cards[i];
              if (!card) return null;
              return (
                <a
                  key={card.id}
                  href={card.link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="small-card"
                >
                  <img src={getImgSrc(card)} alt={card.title} loading="lazy" />
                  <div className="card-label">{card.title}</div>
                </a>
              );
            })}
          </div>

          {/* Large card */}
          {cards[4] && (
            <a
              href={cards[4].link || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="large-card"
            >
              <img src={getImgSrc(cards[4])} alt={cards[4].title} loading="lazy" />
              <div className="card-label">{cards[4].title}</div>
            </a>
          )}
        </div>
      </div>
    </section>
  );
};

export default Experience;
