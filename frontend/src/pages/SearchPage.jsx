import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/SearchPage.css';

const SearchPage = () => {
  const [results, setResults] = useState([]);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [history, setHistory] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Load search history from localStorage
  useEffect(() => {
    const storedHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];
    setHistory(storedHistory);
  }, []);

  // Update history and persist to localStorage
  const updateHistory = useCallback((term) => {
    const prev = JSON.parse(localStorage.getItem('searchHistory')) || [];
    const updated = [term, ...prev.filter((t) => t !== term)].slice(0, 5);
    localStorage.setItem('searchHistory', JSON.stringify(updated));
    setHistory(updated);
  }, []);

  // Fetch search results
  const fetchResults = useCallback(async (query) => {
    const cleaned = query.trim().toLowerCase();
    if (!cleaned) {
      setResults([]);
      return;
    }

    try {
      const response = await axios.get('http://localhost:3006/api/search', {
        params: { q: cleaned },
      });

      const formatted = response.data.results.map((item) => ({
        ...item,
        image_url: item.image_url || item.image,
      }));

      setResults(formatted);
      updateHistory(query);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    }
  }, [updateHistory]);

  // Fetch suggestions for live search
  const fetchSuggestions = async (text) => {
    try {
      const response = await axios.get('http://localhost:3006/api/search/suggestions', {
        params: { q: text },
      });
      setSuggestions(response.data.suggestions);
    } catch (err) {
      console.error('Suggestion fetch failed:', err);
    }
  };

  // Handle URL query (e.g. /search?q=paris)
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const qFromURL = queryParams.get('q') || '';
    setInput(qFromURL);

    if (qFromURL.trim()) {
      fetchResults(qFromURL);
    } else {
      setResults([]);
    }
  }, [location.search, fetchResults]);

  // Live search on input change
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (input.trim()) {
        fetchResults(input);
        fetchSuggestions(input);
      } else {
        setResults([]);
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [input, fetchResults]);

  const handleSearch = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      setResults([]);
    }
  };

  const clearHistory = () => {
    localStorage.removeItem('searchHistory');
    setHistory([]);
  };

  return (
    <div className="container">
      <button className="back-button" onClick={() => navigate('/')}>← Home</button>

      <form onSubmit={handleSearch} className="search-form">
        <div className="input-wrapper">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search destinations..."
          />
          {suggestions.length > 0 && (
            <ul className="suggestions">
              {suggestions.map((sug, index) => (
                <li key={index} onClick={() => {
                  setInput(sug);
                  setSuggestions([]);
                  fetchResults(sug);
                }}>
                  {sug}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit">Search</button>
      </form>

      {history.length > 0 && (
        <div className="history">
          <h4>Recent Searches</h4>
          <div className="history-buttons">
            {history.map((item, index) => (
              <button key={index} onClick={() => {
                setInput(item);
                fetchResults(item);
              }}>{item}</button>
            ))}
          </div>
          <button onClick={clearHistory} className="clear-history">Clear History</button>
        </div>
      )}

      {input.trim() && <h2 className="results-heading">Search Results for: "{input}"</h2>}

      {input.trim() && (
        results.length > 0 ? (
          <ul className="results-grid">
            {results.map((item) => (
              <li key={item.id} className="result-card">
                <img src={item.image_url} alt={item.name} />
                <h3>{item.name}</h3>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-results">No results found.</p>
        )
      )}
    </div>
  );
};

export default SearchPage;
