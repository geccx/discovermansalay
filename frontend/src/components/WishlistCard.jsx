import React from 'react';
import { Trash2 } from 'lucide-react';

const WishlistCard = ({ item, onRemove }) => {
  return (
    <div className="wishlist-card">
      <img
        src={`http://localhost:3003/uploads/top_destinations/${item.image_path}`}

        alt={item.name}
        className="wishlist-card-image"
      />
      <h3 className="wishlist-card-title">{item.name}</h3>
      <p className="wishlist-card-category">{item.category}</p>
      <button className="wishlist-remove-button" onClick={() => onRemove(item.item_id)}>
        <Trash2 size={16} /> Remove
      </button>
    </div>
  );
};

export default WishlistCard;
