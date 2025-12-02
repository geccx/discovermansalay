import React, { useEffect, useState, useContext } from 'react';
import { Heart, MapPin, ArrowUpRight } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import { Link } from 'react-router-dom';
import WishlistContext from '../contexts/WishlistContext';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'swiper/css';
import 'swiper/css/pagination';
import '../styles/components.css';

export default function Explore() {
  const API_BASE = import.meta.env.VITE_API_BASE_URL;
  const [destinations, setDestinations] = useState([]);
  const { wishlist, dispatch } = useContext(WishlistContext);

  const user = JSON.parse(localStorage.getItem('user'));
  const username = user?.username;

  useEffect(() => {
    fetch(`${API_BASE}/api/cms/explore`)
      .then(res => res.json())
      .then(setDestinations)
      .catch(err => {
        console.error('Explore Fetch Error:', err);
        toast.error('Failed to load destinations.');
      });
  }, [API_BASE]);

  useEffect(() => {
    if (!username) return;
    fetch(`${API_BASE}/api/user/wishlist/${username}`)
      .then(res => res.json())
      .then(data => dispatch({ type: 'SET_ITEMS', payload: data }))
      .catch(err => {
        console.error('Wishlist Fetch Error:', err);
        toast.error('Failed to load wishlist.');
      });
  }, [API_BASE, username, dispatch]);

  const isInWishlist = (itemId) => wishlist.some(item => item.item_id === itemId);

  const toggleWishlist = async (place) => {
    if (!username) return toast.info('Please log in to use wishlist.');
    const item = {
      username,
      item_id: place.id,
      name: place.title,
      category: place.city,
      image_path: place.image_path,
    };

    try {
      if (isInWishlist(place.id)) {
        await fetch(`${API_BASE}/api/user/wishlist/${username}/${place.id}`, { method: 'DELETE' });
        dispatch({ type: 'REMOVE_ITEM', payload: place.id });
        toast.success('Removed from wishlist!');
      } else {
        const res = await fetch(`${API_BASE}/api/user/wishlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
        if (res.ok) {
          dispatch({ type: 'ADD_ITEM', payload: item });
          toast.success('Added to wishlist!');
        } else {
          const data = await res.json();
          toast.error(data.message || 'Failed to add to wishlist.');
        }
      }
    } catch (err) {
      console.error('Wishlist error:', err);
      toast.error('Wishlist action failed.');
    }
  };

  return (
    <section className="carousel-section">
      <h2 className="title">Explore</h2>
      <p className="subtitle">Discover the diverse destinations across the Municipality of Mansalay.</p>

      <Swiper
        modules={[Autoplay]}
        spaceBetween={20}
        centeredSlides
        loop
        autoplay={{ delay: 3000 }}
        slidesPerView={1.2}
        breakpoints={{
          640: { slidesPerView: 2.3 },
          768: { slidesPerView: 3.2 },
          1024: { slidesPerView: 4 },
        }}
        className="destination-swiper"
      >
        {destinations.map((place) => {
          const imageUrl = place.image_path
            ? `${API_BASE}/uploads/top_destinations/${place.image_path}?t=${Date.now()}`
            : 'https://via.placeholder.com/200x150?text=No+Image';
          return (
            <SwiperSlide key={place.id}>
              <div className="card">
                <div
                  className={`explore-wishlist-icon ${isInWishlist(place.id) ? 'active' : ''}`}
                  onClick={() => toggleWishlist(place)}
                  title={isInWishlist(place.id) ? 'Remove from Wishlist' : 'Add to Wishlist'}
                >
                  <Heart size={20} />
                </div>

                <div className="card-image-wrapper">
                  <img src={imageUrl} alt={place.title} className="card-image" />
                  <div className="city-badge">
                    <MapPin size={11} /> {place.city}
                  </div>
                </div>

                <div className="card-info">
                  <h3>{place.title}</h3>
                  {place.email && <p>Email: {place.email}</p>}
                  {place.contact && <p>Contact: {place.contact}</p>}
                </div>

                <div className="view-button-wrapper">
                  <button className="view-button">
                    View details <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>

      <div className="view-all-wrapper">
        <Link to="/destinations">
          <button className="view-all-button">View all Destinations</button>
        </Link>
      </div>
    </section>
  );
}
