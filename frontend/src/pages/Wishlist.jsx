import React, { useContext } from 'react';
import Navbar from '../components/Navbar';
import WishlistCard from '../components/WishlistCard';
import WishlistContext from '../contexts/WishlistContext';
import '../styles/Wishlist.css';

const Wishlist = () => {
  const { wishlist, removeItem } = useContext(WishlistContext);

  
  return (
    <>
      <Navbar />
      <div className="wishlist-hero">
        <div className="wishlist-hero-overlay" />
        <div className="wishlist-hero-content">
          <h1 className="wishlist-hero-title">YOUR WISHLIST</h1>
          <p className="wishlist-hero-subtitle">Places and experiences you want to explore.</p>
        </div>
      </div>

      <div className="wishlist-container">
        {wishlist.length === 0 ? (
          <p className="wishlist-empty">Your wishlist is empty.</p>
        ) : (
          <div className="wishlist-grid">
            {wishlist.map(item => (
              <WishlistCard key={item.id} item={item} onRemove={removeItem} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Wishlist;
