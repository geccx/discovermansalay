import React from "react";
import { Trash2, MapPin, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const WishlistCard = ({ item, onRemove, API_BASE }) => {
  // Normalize image path (remove double or leading slashes)
  const cleanPath = item.image_path?.replace(/^\/+/, "");

  const imageUrl = cleanPath
    ? `${API_BASE}/${cleanPath}`
    : "https://via.placeholder.com/300x200?text=No+Image";

  return (
    <div className="wishlist-card">
      <div className="wishlist-card-image-wrapper">
        <img
          src={imageUrl}
          alt={item.name}
          className="wishlist-card-image"
        />

        <div className="wishlist-card-city">
          <MapPin size={14} /> {item.category}
        </div>
      </div>

      <h3 className="wishlist-card-title">{item.name}</h3>

      <div className="wishlist-card-actions">
        <Link
          to={`/destination/${item.item_id}`}
          className="wishlist-view-btn"
        >
          View <ArrowUpRight size={16} />
        </Link>

        <button
          className="wishlist-remove-button"
          onClick={() => onRemove(item.item_id)}
        >
          <Trash2 size={16} /> Remove
        </button>
      </div>
    </div>
  );
};

export default WishlistCard;
