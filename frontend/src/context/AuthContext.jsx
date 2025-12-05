import { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const safeParse = (value) => {
    try {
      if (!value || value === "undefined" || value === "null") return null;
      return JSON.parse(value);
    } catch (e) {
      console.error("❌ Invalid JSON in localStorage:", value);
      return null;
    }
  };

  // Initialize State
  const [user, setUser] = useState(() => safeParse(localStorage.getItem("user")));
  const [token, setToken] = useState(() => {
    const t = localStorage.getItem("token");
    return t && t !== "undefined" && t !== "null" ? t : null;
  });

  // ----------------------------------------------------------------
  // LOGIN — store user + token and sync React state immediately
  // ----------------------------------------------------------------
  const login = (userData, jwtToken) => {
    try {
      localStorage.setItem("user", JSON.stringify(userData));
      localStorage.setItem("token", jwtToken);

      setUser(userData);
      setToken(jwtToken);
    } catch (err) {
      console.error("❌ Failed to save auth data:", err);
    }
  };

  // ----------------------------------------------------------------
  // LOGOUT — full cleanup for both admin and user
  // ----------------------------------------------------------------
  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    setUser(null);
    setToken(null);
  };

  // ----------------------------------------------------------------
  // Auto-sync AuthContext on page refresh
  // Runs only once at startup
  // ----------------------------------------------------------------
  useEffect(() => {
    try {
      const storedUser = safeParse(localStorage.getItem("user"));
      const storedToken = localStorage.getItem("token");

      // If both exist and valid → restore session
      if (storedUser && storedToken && storedToken !== "undefined") {
        setUser(storedUser);
        setToken(storedToken);
        return;
      }

      // Otherwise → clear broken session
      if (!storedUser || !storedToken) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        setUser(null);
        setToken(null);
      }

    } catch (error) {
      console.error("❌ AuthContext init error:", error);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      setUser(null);
      setToken(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
