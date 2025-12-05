import React, { createContext, useReducer, useEffect } from "react";
import { toast } from "react-toastify";

const WishlistContext = createContext();

const wishlistReducer = (state, action) => {
  switch (action.type) {
    case "SET_ITEMS":
      // Make sure state is ALWAYS an array
      return Array.isArray(action.payload) ? action.payload : [];

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

  // SAFELY parse user from localStorage
  let username = null;
  try {
    const raw = localStorage.getItem("user");
    if (raw && raw !== "undefined" && raw !== "null") {
      const parsed = JSON.parse(raw);
      username = parsed?.username || null;
    }
  } catch (err) {
    console.error("❌ Invalid user JSON in localStorage:", err);
    username = null;
    localStorage.removeItem("user");
  }

  /* --------------------------------------------------
     LOAD WISHLIST
  -------------------------------------------------- */
  useEffect(() => {
    if (!username || !API_BASE) return;

    fetch(`${API_BASE}/api/user/wishlist/${encodeURIComponent(username)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          console.error("Wishlist API did not return array:", data);
          dispatch({ type: "SET_ITEMS", payload: [] });
          return;
        }
        dispatch({ type: "SET_ITEMS", payload: data });
      })
      .catch((err) => {
        console.error("Wishlist Fetch Error:", err);
        toast.error("Failed to load wishlist.");
      });
  }, [username, API_BASE]);

  /* --------------------------------------------------
     ADD ITEM
  -------------------------------------------------- */
  const addItem = async (item) => {
    if (!username) {
      toast.info("Please sign in to use wishlist.");
      return;
    }

    const payload = {
      username,
      item_id: item.item_id,
      name: item.name,
      category: item.category,
      image_path: item.image_path,
    };

    try {
      const res = await fetch(`${API_BASE}/api/user/wishlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Failed to add to wishlist");
        return;
      }

      dispatch({ type: "ADD_ITEM", payload: item });
      toast.success("Added to wishlist!");
    } catch (err) {
      console.error("Wishlist Add Error:", err);
      toast.error("Failed to add to wishlist");
    }
  };

  /* --------------------------------------------------
     REMOVE ITEM
  -------------------------------------------------- */
  const removeItem = async (itemId) => {
    if (!username) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/user/wishlist/${encodeURIComponent(username)}/${itemId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message || "Failed to remove");
        return;
      }

      dispatch({ type: "REMOVE_ITEM", payload: itemId });
      toast.success("Removed from wishlist");
    } catch (err) {
      console.error("Wishlist Delete Error:", err);
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
