import React, { useContext } from "react";
import Navbar from "../components/Navbar";
import WishlistCard from "../components/WishlistCard";
import WishlistContext from "../contexts/WishlistContext";
import "../styles/Wishlist.css";

const Wishlist = () => {
  const { wishlist, removeItem } = useContext(WishlistContext);
  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  return (
    <>
      <Navbar />

      <div className="wishlist-hero">
        <div className="wishlist-hero-overlay"></div>
        <div className="wishlist-hero-content">
          <h1 className="wishlist-hero-title">YOUR WISHLIST</h1>
          <p className="wishlist-hero-subtitle">
            Places and experiences waiting for your next adventure.
          </p>
        </div>
      </div>

      <div className="wishlist-container">
        {wishlist.length === 0 ? (
          <p className="wishlist-empty">Your wishlist is empty.</p>
        ) : (
          <div className="wishlist-grid">
            {wishlist.map((item) => (
              <WishlistCard
                key={item.item_id}
                item={item}
                onRemove={removeItem}
                API_BASE={API_BASE}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Wishlist;
