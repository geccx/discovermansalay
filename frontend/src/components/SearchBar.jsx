import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/components.css';
import { FaSearch, FaMapMarkedAlt } from 'react-icons/fa';

const SearchBar = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = () => {
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    }
  };
  const goToMap = () => {
    navigate('/map');
  };

  return (
    <div className="search-bar-container">
      <input
        type="text"
        placeholder="Search for places..."
        className="search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <button className="search-button" onClick={handleSearch}>
        <FaSearch />
      </button>
      <button className="map-button" onClick={goToMap}>
        <FaMapMarkedAlt />
      </button>
    </div>
  );
};

export default SearchBar;
