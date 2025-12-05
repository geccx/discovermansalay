import React, { createContext, useReducer, useEffect, useMemo } from "react";

const WishlistContext = createContext();

// ------------------------------
// SAFE PARSE FUNCTION
// ------------------------------
const safeParse = (value) => {
  try {
    if (!value || value === "undefined" || value === "null") return null;
    return JSON.parse(value);
  } catch (err) {
    console.error("Invalid JSON in localStorage:", value);
    return null;
  }
};

// ------------------------------
// REDUCER
// ------------------------------
const wishlistReducer = (state, action) => {
  switch (action.type) {
    case "SET_ITEMS":
      return Array.isArray(action.payload) ? action.payload : [];

    case "ADD_ITEM":
      if (state.find((item) => item.item_id === action.payload.item_id))
        return state;
      return [...state, action.payload];

    case "REMOVE_ITEM":
      return state.filter((item) => item.item_id !== action.payload);

    default:
      return state;
  }
};

// ------------------------------
// PROVIDER
// ------------------------------
export function WishlistProvider({ children }) {
  const [wishlist, dispatch] = useReducer(wishlistReducer, []);

  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  // Safe load user
  const user = useMemo(() => safeParse(localStorage.getItem("user")), []);
  const username = user?.username || null;

  // ------------------------------
  // LOAD WISHLIST FROM BACKEND
  // ------------------------------
  useEffect(() => {
    if (!username) return;

    const loadWishlist = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/wishlist/${username}`);
        const data = await res.json();

        dispatch({ type: "SET_ITEMS", payload: data || [] });
      } catch (err) {
        console.error("Failed to load wishlist from DB:", err);
      }
    };

    loadWishlist();
  }, [username, API_BASE]);

  // ------------------------------
  // SAVE TO LOCAL STORAGE
  // ------------------------------
  useEffect(() => {
    try {
      localStorage.setItem("wishlist", JSON.stringify(wishlist));
    } catch (err) {
      console.error("Error saving wishlist to localStorage", err);
    }
  }, [wishlist]);

  // ------------------------------
  // ADD ITEM
  // ------------------------------
  const addItem = async (item) => {
    if (!username) return;

    try {
      await fetch(`${API_BASE}/api/wishlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, username }),
      });

      dispatch({ type: "ADD_ITEM", payload: item });
    } catch (err) {
      console.error("Failed to add item to DB:", err);
    }
  };

  // ------------------------------
  // REMOVE ITEM
  // ------------------------------
  const removeItem = async (item_id) => {
    if (!username) return;

    try {
      await fetch(`${API_BASE}/api/wishlist/${username}/${item_id}`, {
        method: "DELETE",
      });

      dispatch({ type: "REMOVE_ITEM", payload: item_id });
    } catch (err) {
      console.error("Failed to remove item from DB:", err);
    }
  };

  return (
    <WishlistContext.Provider value={{ wishlist, addItem, removeItem }}>
      {children}
    </WishlistContext.Provider>
  );
}

export default WishlistContext;
