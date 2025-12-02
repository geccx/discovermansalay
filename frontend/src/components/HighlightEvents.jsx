// HighlightEvents.jsx
import React, { useEffect, useRef, useState } from 'react';
import '../styles/components.css';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import { format } from 'date-fns';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
// Router mount is /api/cms/highlight, actual events resource is /highlight-events
const API_ROOT = `${API_BASE_URL}/api/cms/highlight`;
const EVENTS_ENDPOINT = `${API_ROOT}/highlight-events`;
const UPLOADS_BASE = `${API_BASE_URL}/uploads/highlightevents/`;

const HighlightEvents = () => {
  const swiperRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(EVENTS_ENDPOINT);
      const data = Array.isArray(res.data) ? res.data : [];
      setEvents(data);
      setActiveIndex(0);
      // ensure swiper (if present) snaps to first slide
      if (swiperRef.current && typeof swiperRef.current.slideTo === 'function') {
        swiperRef.current.slideTo(0);
      }
    } catch (err) {
      console.error('Failed to fetch events', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // handle slide change: prefer realIndex (for looped swipers) then activeIndex fallback
  const handleSlideChange = (swiper) => {
    const idx = typeof swiper.realIndex === 'number' ? swiper.realIndex : swiper.activeIndex;
    setActiveIndex(idx);
  };

  // robust date range parser that tolerates different common formats:
  const parseDateRange = (rangeStr) => {
    if (!rangeStr || typeof rangeStr !== 'string') return null;

    const parts = rangeStr.split(' - ').map((p) => p.trim());
    const nowYear = new Date().getFullYear();

    const parseToken = (token) => {
      // new Date(...) doesn't throw; it returns Invalid Date if unparsable
      let d = new Date(token);
      if (!isNaN(d)) return d;
      // try appending current year for "Aug 12" like tokens
      d = new Date(`${token} ${nowYear}`);
      if (!isNaN(d)) return d;
      // lastly try ISO-like fallback
      d = new Date(token.replace(/\./g, '-'));
      if (!isNaN(d)) return d;
      return null;
    };

    const start = parseToken(parts[0]);
    const end = parts[1] ? parseToken(parts[1]) : start;
    if (!start || !end) return null;
    return { start, end };
  };

  if (loading) return <p>Loading highlight events...</p>;
  if (!loading && events.length === 0) return <p>No highlight events yet.</p>;

  // clamp activeIndex just in case
  const clampedIndex = Math.min(Math.max(activeIndex, 0), events.length - 1);
  const currentEvent = events[clampedIndex] ?? events[0];

  let formattedDateRange = '';
  if (currentEvent?.date_range) {
    const parsed = parseDateRange(currentEvent.date_range);
    if (parsed) {
      formattedDateRange = `${format(parsed.start, 'MMM dd')} - ${format(parsed.end, 'MMM dd')}`;
    }
  }

  return (
    <section className="highlight-container">
      <div className="highlight-text">
        <h2>Highlight Events</h2>
        <p className="highlight-title">{currentEvent?.title}</p>
        <p>{currentEvent?.description}</p>
        <p className="date-range">{formattedDateRange}</p>
        {currentEvent?.link ? (
          <a href={currentEvent.link} className="view-more" target="_blank" rel="noopener noreferrer">
            View More
          </a>
        ) : null}
      </div>

      <div className="highlight-carousel">
        <Swiper
          modules={[EffectCoverflow]}
          effect="coverflow"
          grabCursor={true}
          centeredSlides={true}
          loop={events.length > 1} // only loop when multiple slides exist
          slidesPerView={2.7}
          speed={700}
          slideToClickedSlide={true}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
          }}
          onSlideChange={handleSlideChange}
          coverflowEffect={{
            rotate: 0,
            stretch: 0,
            depth: 50,
            modifier: 2,
            slideShadows: false,
          }}
          breakpoints={{
            0: { slidesPerView: 1 },
            640: { slidesPerView: 2 },
            1024: { slidesPerView: 3 },
          }}
          className="highlight-swiper"
        >
          {events.map((event, index) => {
            const key = event.id ?? event._id ?? index;
            const src =
              event.image_url && event.image_url.startsWith('http')
                ? event.image_url
                : event.image_url
                ? `${UPLOADS_BASE}${event.image_url}`
                : '';

            return (
              <SwiperSlide key={key}>
                {src ? (
                  <img
                    src={src}
                    alt={event.title ?? `event-${index}`}
                    onError={(e) => {
                      // graceful fallback: hide broken image
                      e.currentTarget.style.display = 'none';
                    }}
                    loading="lazy"
                  />
                ) : (
                  <div style={{ width: '100%', height: 200, background: '#eee' }} />
                )}
              </SwiperSlide>
            );
          })}
        </Swiper>

        <div
          className="arrow"
          onClick={() => {
            if (swiperRef.current && typeof swiperRef.current.slideNext === 'function') swiperRef.current.slideNext();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') swiperRef.current?.slideNext();
          }}
          aria-label="Next highlight"
        >
          &gt;
        </div>
      </div>
    </section>
  );
};

export default HighlightEvents;
