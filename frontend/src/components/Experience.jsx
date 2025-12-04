import React, { useEffect, useState } from 'react';
import '../styles/components.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const API_ROOT = `${API_BASE}/api/cms/experience`;

export default function Experience() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const MIN_CARDS = 6;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(API_ROOT);
        const data = await res.json();
        setCards(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch experience cards:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p>Loading experience...</p>;
  if (cards.length < MIN_CARDS) {
    return <p>Not enough cards. Need at least 6.</p>;
  }

  const img = (c) =>
    c.media_path ? `${API_BASE}/${c.media_path}` : '';

  return (
    <section className="experience-container">
      <h2 className="experience-title">Experience Mansalay</h2>

      <div className="experience-grid">
        {/* LEFT */}
        <div className="left-side">
          <a href={cards[0].link} target="_blank" className="large-card">
            <img src={img(cards[0])} alt={cards[0].title} />
            <div className="card-label">{cards[0].title}</div>
          </a>

          <div className="small-cards-row">
            {[1, 2].map((i) => (
              <a key={i} href={cards[i].link} target="_blank" className="small-card">
                <img src={img(cards[i])} alt={cards[i].title} />
                <div className="card-label">{cards[i].title}</div>
              </a>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="right-side">
          <div className="small-cards-row">
            {[3, 5].map((i) => (
              <a key={i} href={cards[i].link} target="_blank" className="small-card">
                <img src={img(cards[i])} alt={cards[i].title} />
                <div className="card-label">{cards[i].title}</div>
              </a>
            ))}
          </div>

          <a href={cards[4].link} target="_blank" className="large-card">
            <img src={img(cards[4])} alt={cards[4].title} />
            <div className="card-label">{cards[4].title}</div>
          </a>
        </div>
      </div>
    </section>
  );
}
