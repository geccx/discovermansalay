import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import SearchResultCard from "../components/SearchResultCard";
import "../styles/SearchPage.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const PAGE_CHUNK = 12; // how many items per "page"

const SearchPage = () => {
  const [input, setInput] = useState("");
  const [results, setResults] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_CHUNK);

  const [suggestions, setSuggestions] = useState([]);
  const [history, setHistory] = useState([]);
  const [topSearches, setTopSearches] = useState([]);

  const [view, setView] = useState("grid"); // "grid" | "list"
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("relevance");
  const [loading, setLoading] = useState(false);

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("searchDarkMode") === "true"
  );

  const navigate = useNavigate();
  const location = useLocation();

  /* ---------------------------------------
     Helpers: History & Analytics
  ---------------------------------------- */
  const loadHistory = () => {
    const stored = JSON.parse(localStorage.getItem("searchHistory")) || [];
    setHistory(stored);
  };

  const updateHistory = (term) => {
    const stored = JSON.parse(localStorage.getItem("searchHistory")) || [];
    const updated = [term, ...stored.filter((t) => t !== term)].slice(0, 8);
    localStorage.setItem("searchHistory", JSON.stringify(updated));
    setHistory(updated);
  };

  const refreshAnalytics = () => {
    const data =
      JSON.parse(localStorage.getItem("searchAnalytics") || "{}") || {};
    const arr = Object.entries(data).map(([term, info]) => ({
      term,
      ...info,
    }));
    arr.sort((a, b) => b.count - a.count);
    setTopSearches(arr.slice(0, 5));
  };

  const updateAnalytics = (term, resultCount) => {
    const raw = localStorage.getItem("searchAnalytics");
    const obj = raw ? JSON.parse(raw) : {};
    const existing = obj[term] || { count: 0, lastSearched: null };

    obj[term] = {
      count: existing.count + 1,
      lastSearched: new Date().toISOString(),
      lastResultCount: resultCount,
    };

    localStorage.setItem("searchAnalytics", JSON.stringify(obj));
    refreshAnalytics();
  };

  /* ---------------------------------------
     Filters & Sorting
  ---------------------------------------- */
  const applyFilters = (data, category, sortType) => {
    let temp = [...data];

    if (category !== "all") {
      temp = temp.filter((item) =>
        (item.category || "")
          .toLowerCase()
          .includes(category.toLowerCase())
      );
    }

    if (sortType === "az") {
      temp.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortType === "new") {
      temp.sort(
        (a, b) =>
          new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );
    }
    // "relevance" → backend already ranked

    setFiltered(temp);
    setVisibleCount(PAGE_CHUNK);
  };

  /* ---------------------------------------
     Fetch search results
  ---------------------------------------- */
  const fetchResults = async (query) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setFiltered([]);
      setVisibleCount(PAGE_CHUNK);
      return;
    }

    setLoading(true);
    setSuggestions([]);

    try {
      const res = await axios.get(`${API_BASE}/api/search`, {
        params: { q: trimmed },
      });

      const formatted = res.data.results.map((item) => ({
        ...item,
        safe_image: item.image_url
          ? `${API_BASE}${
              item.image_url.startsWith("/uploads")
                ? item.image_url
                : `/uploads/${item.image_url}`
            }`
          : "/placeholder.jpg",
      }));

      setResults(formatted);
      applyFilters(formatted, selectedCategory, sortBy);

      updateHistory(trimmed);
      updateAnalytics(trimmed, formatted.length);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------
     Suggestions
  ---------------------------------------- */
  const fetchSuggestions = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await axios.get(`${API_BASE}/api/search/suggestions`, {
        params: { q: trimmed },
      });
      setSuggestions(res.data.suggestions || []);
    } catch (err) {
      console.error("Suggestion fetch failed:", err);
    }
  };

  /* ---------------------------------------
     URL query watcher
  ---------------------------------------- */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q") || "";
    setInput(q);
    if (q.trim()) {
      fetchResults(q);
    } else {
      setResults([]);
      setFiltered([]);
      setVisibleCount(PAGE_CHUNK);
    }
  }, [location.search]);

  /* ---------------------------------------
     Load history & analytics once
  ---------------------------------------- */
  useEffect(() => {
    loadHistory();
    refreshAnalytics();
  }, []);

  /* ---------------------------------------
     Debounce suggestions
  ---------------------------------------- */
  useEffect(() => {
    const id = setTimeout(() => {
      if (input.trim()) fetchSuggestions(input);
      else setSuggestions([]);
    }, 250);
    return () => clearTimeout(id);
  }, [input]);

  /* ---------------------------------------
     Voice search
  ---------------------------------------- */
  const startVoiceSearch = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice search is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();

    recognition.onresult = (event) => {
      const spoken = event.results[0][0].transcript;
      setInput(spoken);
      navigate(`/search?q=${encodeURIComponent(spoken)}`);
    };
  };

  /* ---------------------------------------
     Dark mode toggle
  ---------------------------------------- */
  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("searchDarkMode", next ? "true" : "false");
  };

  /* ---------------------------------------
     Handlers
  ---------------------------------------- */
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      navigate(`/search?q=${encodeURIComponent(input.trim())}`);
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    applyFilters(results, category, sortBy);
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    applyFilters(results, selectedCategory, value);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + PAGE_CHUNK);
  };

  const visibleItems = filtered.slice(0, visibleCount);

  const categories = [
    { key: "all", label: "All" },
    { key: "explore", label: "Explore" },
    { key: "experience", label: "Experiences" },
    { key: "accommodation", label: "Accommodations" },
    { key: "highlight", label: "Highlights" },
    { key: "spot", label: "Tourist Spots" },
  ];

  return (
    <div className={`search-page ${darkMode ? "dark" : "light"}`}>
      <div className="search-container">
        {/* Header */}
        <header className="search-header">
          <button className="back-btn" onClick={() => navigate("/")}>
            ← Home
          </button>
          <h1>Search Discover Mansalay</h1>
          <div className="header-right">
            <button className="dark-toggle" onClick={toggleDarkMode}>
              {darkMode ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>
        </header>

        {/* Search Bar */}
        <div className="search-bar-wrapper">
          <form className="search-form" onSubmit={handleSearchSubmit}>
            <div className="input-wrapper">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search destinations, experiences, accommodations, and spots..."
              />
              {suggestions.length > 0 && (
                <ul className="suggestion-box">
                  {suggestions.map((s, index) => (
                    <li
                      key={`${s.name}-${index}`}
                      onClick={() => {
                        setInput(s.name);
                        setSuggestions([]);
                        navigate(
                          `/search?q=${encodeURIComponent(s.name)}`
                        );
                      }}
                    >
                      <span>{s.name}</span>
                      <span className="suggestion-tag">
                        {s.source === "tourist_spots"
                          ? "Spot"
                          : "Content"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              className="voice-btn"
              onClick={startVoiceSearch}
              title="Voice search"
            >
              🎤
            </button>

            <button type="submit" className="submit-btn">
              Search
            </button>
          </form>
        </div>

        {/* History + Analytics */}
        <section className="history-analytics">
          {history.length > 0 && (
            <div className="history-section">
              <div className="section-header">
                <h3>Recent Searches</h3>
                <button
                  className="clear-btn"
                  onClick={() => {
                    localStorage.removeItem("searchHistory");
                    setHistory([]);
                  }}
                >
                  Clear
                </button>
              </div>
              <div className="pill-row">
                {history.map((term, idx) => (
                  <button
                    key={idx}
                    className="pill"
                    onClick={() =>
                      navigate(`/search?q=${encodeURIComponent(term)}`)
                    }
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {topSearches.length > 0 && (
            <div className="analytics-section">
              <h3>Top Searches</h3>
              <ul>
                {topSearches.map((entry) => (
                  <li key={entry.term}>
                    <span>{entry.term}</span>
                    <span className="count">
                      {entry.count}× · {entry.lastResultCount} results
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Filters + Sort + View */}
        <div className="controls-row">
          <div className="category-tabs">
            {categories.map((c) => (
              <button
                key={c.key}
                className={
                  selectedCategory === c.key ? "active" : ""
                }
                onClick={() => handleCategoryChange(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="sort-view">
            <label htmlFor="sort">Sort:</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
            >
              <option value="relevance">Most Relevant</option>
              <option value="az">A → Z</option>
              <option value="new">Newest</option>
            </select>

            <button
              type="button"
              className={`view-toggle ${
                view === "grid" ? "active" : ""
              }`}
              onClick={() => setView("grid")}
              title="Grid view"
            >
              🔳
            </button>
            <button
              type="button"
              className={`view-toggle ${
                view === "list" ? "active" : ""
              }`}
              onClick={() => setView("list")}
              title="List view"
            >
              📄
            </button>
          </div>
        </div>

        {/* Results */}
        <section className="results-section">
          {input.trim() && (
            <h2 className="results-heading">
              Search results for: <span>"{input}"</span>
            </h2>
          )}

          {loading ? (
            <div
              className={
                view === "grid" ? "grid-results" : "list-results"
              }
            >
              {Array.from({ length: PAGE_CHUNK }).map((_, idx) => (
                <div
                  key={idx}
                  className={`result-card skeleton ${
                    view === "list" ? "list" : ""
                  }`}
                >
                  <div className="skeleton-img" />
                  <div className="skeleton-body">
                    <div className="skeleton-line short" />
                    <div className="skeleton-line" />
                    <div className="skeleton-line" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <>
              <div
                className={
                  view === "grid" ? "grid-results" : "list-results"
                }
              >
                {visibleItems.map((item) => (
                  <SearchResultCard
                    key={`${item.source}-${item.id}`}
                    item={item}
                    view={view}
                    query={input}
                  />
                ))}
              </div>

              {visibleCount < filtered.length && (
                <div className="load-more-wrapper">
                  <button
                    className="load-more-btn"
                    onClick={handleLoadMore}
                  >
                    Load more ({filtered.length - visibleCount} more)
                  </button>
                </div>
              )}
            </>
          ) : (
            input.trim() &&
            !loading && (
              <p className="no-results">
                No results found. Try another keyword or category.
              </p>
            )
          )}
        </section>
      </div>
    </div>
  );
};

export default SearchPage;
