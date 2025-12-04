import React, { useEffect, useRef, useState } from 'react';
import '../styles/components.css';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import { format } from 'date-fns';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_ROOT = `${API_BASE_URL}/api/cms/highlight`;
const EVENTS_ENDPOINT = `${API_ROOT}/highlight-events`;

const HighlightEvents = () => {
  const swiperRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  /* -----------------------------------------------------
   * Fetch Highlight Events
   * ----------------------------------------------------- */
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(EVENTS_ENDPOINT);
      const data = Array.isArray(res.data) ? res.data : [];
      setEvents(data);
      setActiveIndex(0);

      // Reset Swiper to first slide
      if (swiperRef.current?.slideTo) {
        swiperRef.current.slideTo(0);
      }
    } catch (err) {
      console.error('Failed to fetch highlight events', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  /* -----------------------------------------------------
   * Handle Swiper index change
   * ----------------------------------------------------- */
  const handleSlideChange = (swiper) => {
    const idx = swiper.realIndex ?? swiper.activeIndex ?? 0;
    setActiveIndex(idx);
  };

  /* -----------------------------------------------------
   * Parse date range stored in `category`
   * Example: "Jan 5 - Feb 10"
   * ----------------------------------------------------- */
  const parseDateRange = (rangeStr) => {
    if (!rangeStr || typeof rangeStr !== 'string') return null;

    const parts = rangeStr.split(' - ').map((p) => p.trim());
    const year = new Date().getFullYear();

    const parse = (s) => {
      let d = new Date(s);
      if (!isNaN(d)) return d;

      d = new Date(`${s} ${year}`);
      return !isNaN(d) ? d : null;
    };

    const start = parse(parts[0]);
    const end = parse(parts[1] || parts[0]);
    if (!start || !end) return null;

    return { start, end };
  };

  /* -----------------------------------------------------
   * UI
   * ----------------------------------------------------- */
  if (loading) return <p>Loading highlight events...</p>;
  if (!events.length) return <p>No highlight events available.</p>;

  const current = events[Math.min(activeIndex, events.length - 1)];

  // Parse date range
  let formattedDate = '';
  if (current?.category) {
    const p = parseDateRange(current.category);
    if (p) {
      formattedDate = `${format(p.start, 'MMM dd')} - ${format(p.end, 'MMM dd')}`;
    }
  }

  return (
    <section className="highlight-container">
      {/* LEFT SIDE TEXT */}
      <div className="highlight-text">
        <h2>Highlight Events</h2>
        <p className="highlight-title">{current?.title}</p>
        <p className="highlight-description">{current?.description}</p>

        {formattedDate && (
          <p className="date-range">{formattedDate}</p>
        )}

        {current?.link && (
          <a
            href={current.link}
            className="view-more"
            target="_blank"
            rel="noopener noreferrer"
          >
            View More
          </a>
        )}
      </div>

      {/* RIGHT SIDE CAROUSEL */}
      <div className="highlight-carousel">
        <Swiper
          modules={[EffectCoverflow]}
          effect="coverflow"
          grabCursor
          centeredSlides
          loop={events.length > 1}
          slidesPerView={2.5}
          onSwiper={(swiper) => (swiperRef.current = swiper)}
          onSlideChange={handleSlideChange}
          slideToClickedSlide
          speed={700}
          coverflowEffect={{
            rotate: 0,
            stretch: 0,
            depth: 50,
            modifier: 2,
            slideShadows: false,
          }}
          breakpoints={{
            0: { slidesPerView: 1.2 },
            640: { slidesPerView: 2 },
            1024: { slidesPerView: 3 },
          }}
          className="highlight-swiper"
        >
          {events.map((event, index) => {
            const key = event.id ?? event._id ?? index;
            const src = event.media_path
              ? `${API_BASE_URL}/${event.media_path}?t=${Date.now()}`
              : '';

            return (
              <SwiperSlide key={key}>
                {src ? (
                  <img
                    src={src}
                    alt={event.title}
                    className="highlight-event-image"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                    loading="lazy"
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: 220,
                      background: '#f0f0f0',
                      borderRadius: '10px',
                    }}
                  />
                )}
              </SwiperSlide>
            );
          })}
        </Swiper>

        {/* NEXT BUTTON */}
        <div
          className="arrow"
          role="button"
          tabIndex={0}
          aria-label="Next"
          onClick={() => swiperRef.current?.slideNext()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') swiperRef.current?.slideNext();
          }}
        >
          &gt;
        </div>
      </div>
    </section>
  );
};

export default HighlightEvents;
