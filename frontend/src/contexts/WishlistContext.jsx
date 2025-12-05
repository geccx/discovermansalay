import React, { createContext, useReducer, useEffect } from "react";
import { toast } from "react-toastify";

const WishlistContext = createContext();

const wishlistReducer = (state, action) => {
  switch (action.type) {
    case "SET_ITEMS":
      return action.payload;

    case "ADD_ITEM":
      if (state.some((i) => i.item_id === action.payload.item_id)) return state;
      return [...state, action.payload];

    case "REMOVE_ITEM":
      return state.filter((i) => i.item_id !== action.payload);

    default:
      return state;
  }
};

export function WishlistProvider({ children }) {
  const [wishlist, dispatch] = useReducer(wishlistReducer, []);
  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  const user = JSON.parse(localStorage.getItem("user"));
  const username = user?.username;

  /* --------------------------------------------------
     LOAD WISHLIST
  -------------------------------------------------- */
  useEffect(() => {
    if (!username) return;
    fetch(`${API_BASE}/api/user/wishlist/${username}`)
      .then((res) => res.json())
      .then((data) => dispatch({ type: "SET_ITEMS", payload: data }))
      .catch(() => toast.error("Failed to load wishlist"));
  }, [username, API_BASE]);

  /* --------------------------------------------------
     ADD ITEM
  -------------------------------------------------- */
  const addItem = async (item) => {
    if (!username) return toast.info("Please sign in to use wishlist.");

    try {
      const res = await fetch(`${API_BASE}/api/user/wishlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });

      if (res.ok) {
        dispatch({ type: "ADD_ITEM", payload: item });
        toast.success("Added to wishlist!");
      } else {
        const data = await res.json();
        toast.error(data.message);
      }
    } catch {
      toast.error("Failed to add to wishlist");
    }
  };

  /* --------------------------------------------------
     REMOVE ITEM
  -------------------------------------------------- */
  const removeItem = async (itemId) => {
    try {
      await fetch(`${API_BASE}/api/user/wishlist/${username}/${itemId}`, {
        method: "DELETE",
      });

      dispatch({ type: "REMOVE_ITEM", payload: itemId });
      toast.success("Removed from wishlist");
    } catch {
      toast.error("Failed to remove wishlist item");
    }
  };

  return (
    <WishlistContext.Provider
      value={{ wishlist, addItem, removeItem, dispatch }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export default WishlistContext;
