import React, { createContext, useReducer, useEffect } from 'react';

const WishlistContext = createContext();

const wishlistReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ITEM':
      if (state.find(item => item.item_id === action.payload.item_id)) return state;
      return [...state, action.payload];
    case 'REMOVE_ITEM':
      return state.filter(item => item.item_id !== action.payload);
    case 'SET_ITEMS':
      return action.payload;
    default:
      return state;
  }
};

export function WishlistProvider({ children }) {
  const [wishlist, dispatch] = useReducer(wishlistReducer, []);

  const user = JSON.parse(localStorage.getItem('user'));
  const username = user?.username;

  // ✅ Fetch wishlist from backend when user logs in
  useEffect(() => {
    const fetchWishlist = async () => {
      if (!username) return;
      try {
        const res = await fetch(`http://localhost:3001/api/wishlist/${username}`);
        const data = await res.json();
        dispatch({ type: 'SET_ITEMS', payload: data });
      } catch (err) {
        console.error('Failed to load wishlist from DB:', err);
      }
    };

    fetchWishlist();
  }, [username]); // only username as dependency

  // ✅ Save to localStorage on change (optional)
  useEffect(() => {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // ✅ Add to wishlist with backend sync
  const addItem = async (item) => {
    if (!username) return;

    try {
      await fetch('http://localhost:3001/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, username }),
      });

      dispatch({ type: 'ADD_ITEM', payload: item });
    } catch (err) {
      console.error('Failed to add item to DB:', err);
    }
  };

  // ✅ Remove from wishlist with backend sync
  const removeItem = async (item_id) => {
    if (!username) return;

    try {
      await fetch(`http://localhost:3001/api/wishlist/${username}/${item_id}`, {
        method: 'DELETE',
      });

      dispatch({ type: 'REMOVE_ITEM', payload: item_id });
    } catch (err) {
      console.error('Failed to remove item from DB:', err);
    }
  };

  return (
    <WishlistContext.Provider value={{ wishlist, addItem, removeItem, dispatch }}>
      {children}
    </WishlistContext.Provider>
  );
}

export default WishlistContext;
