// frontend/pages/MapPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.js';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import myLocationIcon from '../assets/icons/location.jpg';
import '../styles/map.css';

// Fix default marker icons (fallback)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  : '';

/* ---------------------------------------------
   HELPERS
--------------------------------------------- */

// Build correct image URL from backend's /uploads/touristspotsmap/filename
const buildSpotImageUrl = (spot) => {
  if (!spot.image_url) return null;

  const cleanBase = API_BASE || '';
  const cleanPath = spot.image_url.replace(/^\//, '');

  return `${cleanBase}/${cleanPath}?t=${Date.now()}`;
};

// Circular image marker (Style 1)
const createImageIcon = (imgUrl) => {
  if (!imgUrl) return null;

  return L.divIcon({
    html: `
      <div class="spot-circle-wrapper">
        <div class="spot-circle-shadow"></div>
        <div class="spot-circle">
          <img src="${imgUrl}" alt="spot" />
        </div>
      </div>
    `,
    className: 'spot-circle-icon',
    iconSize: [60, 60],
    iconAnchor: [30, 60],
    popupAnchor: [0, -56],
  });
};

// Pulsing user location dot
const userLocationIcon = L.divIcon({
  className: 'user-location-icon',
  html: `
    <div class="user-location-dot"></div>
    <div class="user-location-pulse"></div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

/* ---------------------------------------------
   MAP EFFECTS COMPONENT
--------------------------------------------- */

const MapEffects = ({ userLocation, followUser, setBounds }) => {
  const map = useMapEvents({
    moveend: () => {
      setBounds(map.getBounds());
    },
    zoomend: () => {
      setBounds(map.getBounds());
    },
  });

  useEffect(() => {
    setBounds(map.getBounds());
  }, [map, setBounds]);

  useEffect(() => {
    if (followUser && userLocation) {
      map.flyTo(userLocation, Math.max(map.getZoom(), 15), {
        animate: true,
        duration: 0.8,
      });
    }
  }, [userLocation, followUser, map]);

  return null;
};

/* ---------------------------------------------
   ROUTING COMPONENT
--------------------------------------------- */

const Routing = ({ origin, destination, onRouteInfo }) => {
  const map = useMap();

  useEffect(() => {
    if (!destination) return;

    const to = [Number(destination[0]), Number(destination[1])];
    const from = origin ? [Number(origin[0]), Number(origin[1])] : null;

    // Fallback if Routing Machine is not available
    if (!L || !L.Routing || !L.Routing.control) {
      console.warn(
        'Leaflet Routing Machine missing – drawing simple fallback polyline.'
      );

      const start = from || [map.getCenter().lat, map.getCenter().lng];
      const line = L.polyline([start, to], {
        weight: 5,
        opacity: 0.9,
      }).addTo(map);

      try {
        map.fitBounds(line.getBounds(), { padding: [60, 60] });
      } catch (err) {
        console.warn('fitBounds error:', err);
      }

      if (onRouteInfo) {
        const dist = map.distance(start, to); // meters
        onRouteInfo({
          distance: dist,
          duration: null,
          mode: 'fallback',
        });
      }

      return () => {
        try {
          if (line && map.removeLayer) map.removeLayer(line);
        } catch (err) {
          console.warn('Cleanup error:', err);
        }
      };
    }

    let control;

    try {
      const router = L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
      });

      control = L.Routing.control({
        router,
        waypoints: [
          L.latLng(
            from ? from[0] : map.getCenter().lat,
            from ? from[1] : map.getCenter().lng
          ),
          L.latLng(to[0], to[1]),
        ],
        show: false,
        addWaypoints: false,
        draggableWaypoints: false,
        routeWhileDragging: false,
        createMarker: () => null,
      }).addTo(map);

      control.on('routesfound', (e) => {
        const route = e?.routes?.[0];
        if (!route) return;

        try {
          map.fitBounds(route.bounds, { padding: [60, 60] });
        } catch (err) {
          console.warn('fitBounds error:', err);
        }

        if (onRouteInfo && route.summary) {
          onRouteInfo({
            distance: route.summary.totalDistance, // meters
            duration: route.summary.totalTime, // seconds
            mode: 'routing',
          });
        }
      });
    } catch (err) {
      console.error('Routing control creation failed:', err);
    }

    return () => {
      try {
        if (control && map.removeControl) map.removeControl(control);
      } catch (err) {
        console.warn('Routing cleanup failed:', err);
      }
    };
  }, [origin, destination, map, onRouteInfo]);

  return null;
};

/* ---------------------------------------------
   MAIN MAP PAGE
--------------------------------------------- */

const MapPage = () => {
  const navigate = useNavigate();

  const [mapStyle, setMapStyle] = useState('satellite'); // satellite | street | terrain
  const [userLocation, setUserLocation] = useState(null);
  const [followUser, setFollowUser] = useState(false);

  const [routeTo, setRouteTo] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [navigationActive, setNavigationActive] = useState(false);

  const [touristSpots, setTouristSpots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [viewMode, setViewMode] = useState('normal'); // normal | heat
  const [bounds, setBounds] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

  const mapCenter = [12.5269, 121.438];

  /* ---------------------------------------------
     USER LOCATION (LIVE)
  --------------------------------------------- */
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coords);
      },
      (err) => {
        console.warn('Geolocation error:', err);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  /* ---------------------------------------------
     FETCH TOURIST SPOTS
  --------------------------------------------- */
  useEffect(() => {
    const fetchSpots = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const url = API_BASE
          ? `${API_BASE}/map/touristspots`
          : '/map/touristspots';

        const res = await axios.get(url);
        setTouristSpots(res.data || []);
      } catch (error) {
        console.error('Failed to fetch tourist spots:', error);
        setFetchError('Failed to load tourist spots. Showing last known data.');
      } finally {
        setLoading(false);
      }
    };

    fetchSpots();
  }, []);

  /* ---------------------------------------------
     CATEGORY LIST & FILTERING
  --------------------------------------------- */
  const allCategories = useMemo(
    () =>
      Array.from(
        new Set(touristSpots.map((s) => s.category).filter(Boolean))
      ).sort(),
    [touristSpots]
  );

  const toggleCategory = (cat) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const filteredSpots = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return touristSpots.filter((spot) => {
      const matchesSearch =
        !term ||
        spot.name.toLowerCase().includes(term) ||
        (spot.category || '').toLowerCase().includes(term);

      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.includes(spot.category);

      let withinBounds = true;
      if (bounds && spot.lat != null && spot.lng != null) {
        const lat = Number(spot.lat);
        const lng = Number(spot.lng);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          const ll = L.latLng(lat, lng);
          withinBounds = bounds.contains(ll);
        }
      }

      return matchesSearch && matchesCategory && withinBounds;
    });
  }, [touristSpots, searchTerm, selectedCategories, bounds]);

  /* ---------------------------------------------
     ROUTE INFO FORMATTERS
  --------------------------------------------- */
  const formatDistance = (meters) => {
    if (meters == null) return '';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds) => {
    if (seconds == null) return '';
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  /* ---------------------------------------------
     ROUTING BUTTON HANDLERS
  --------------------------------------------- */
  const handleGetDirections = (lat, lng) => {
    setRouteTo([lat, lng]);
    setNavigationActive(true);
  };

  const handleCancelNavigation = () => {
    setRouteTo(null);
    setRouteInfo(null);
    setNavigationActive(false);
  };

  /* ---------------------------------------------
     FULLSCREEN TOGGLE
  --------------------------------------------- */
  const toggleFullscreen = () => {
    setFullscreen((prev) => !prev);
  };

  return (
    <div className={`map-page-container ${fullscreen ? 'fullscreen' : ''}`}>
      {/* TOP BAR CONTROLS */}
      <div className="map-controls">
        <button
          className="back-button-floating"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>

        <div className="map-controls-group">
          {/* Map style selector */}
          <div className="layer-toggle">
            <label className="layer-label">Map:</label>
            <select
              onChange={(e) => setMapStyle(e.target.value)}
              value={mapStyle}
            >
              <option value="satellite">Satellite</option>
              <option value="street">Street</option>
              <option value="terrain">Terrain</option>
            </select>
          </div>

          {/* View mode (normal / heat) */}
          <div className="view-toggle">
            <button
              className={viewMode === 'normal' ? 'active' : ''}
              onClick={() => setViewMode('normal')}
            >
              Spots
            </button>
            <button
              className={viewMode === 'heat' ? 'active' : ''}
              onClick={() => setViewMode('heat')}
            >
              Heat
            </button>
          </div>

          {/* Follow user toggle */}
          <button
            className={`follow-user-btn ${
              followUser ? 'active' : ''
            }`}
            onClick={() => setFollowUser((prev) => !prev)}
            disabled={!userLocation}
            title={
              userLocation
                ? 'Toggle follow my location'
                : 'Waiting for location...'
            }
          >
            {followUser ? 'Following You' : 'Follow Me'}
          </button>

          {/* Fullscreen toggle */}
          <button
            className="fullscreen-btn"
            onClick={toggleFullscreen}
          >
            {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>

        {/* Search bar */}
        <div className="map-search-container">
          <input
            type="text"
            className="map-search-input"
            placeholder="Search spots by name or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Category filter chips */}
      {allCategories.length > 0 && (
        <div className="category-chips">
          {allCategories.map((cat) => (
            <button
              key={cat}
              className={`category-chip ${
                selectedCategories.includes(cat) ? 'selected' : ''
              }`}
              onClick={() => toggleCategory(cat)}
            >
              {cat}
            </button>
          ))}
          {selectedCategories.length > 0 && (
            <button
              className="category-chip clear-chip"
              onClick={() => setSelectedCategories([])}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Warning / status messages */}
      {!userLocation && (
        <div className="map-warning-banner">
          ⚠️ Geolocation not available — using default map center.
        </div>
      )}

      {fetchError && (
        <div className="map-warning-banner error">
          {fetchError}
        </div>
      )}

      {/* ROUTE INFO STRIP */}
      {navigationActive && routeInfo && (
        <div className="route-info-banner">
          <span>
            Route: {formatDistance(routeInfo.distance)}{' '}
            {routeInfo.duration != null &&
              `• ${formatDuration(routeInfo.duration)}`}
          </span>
          <button
            className="cancel-route-btn"
            onClick={handleCancelNavigation}
          >
            Cancel Navigation
          </button>
        </div>
      )}

      {/* MAP */}
      <div className="map-container">
        <MapContainer
          center={mapCenter}
          zoom={11}
          zoomControl={false}
          className="leaflet-map"
        >
          <ZoomControl position="bottomright" />

          {/* Keep track of bounds & follow user */}
          <MapEffects
            userLocation={userLocation}
            followUser={followUser}
            setBounds={setBounds}
          />

          {/* Routing layer */}
          {routeTo && (
            <Routing
              origin={userLocation || mapCenter}
              destination={routeTo}
              onRouteInfo={setRouteInfo}
            />
          )}

          {/* Base map tiles */}
          {mapStyle === 'satellite' && (
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles © Esri — Sources: Esri, USGS, NOAA"
            />
          )}
          {mapStyle === 'street' && (
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />
          )}
          {mapStyle === 'terrain' && (
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors, SRTM | © OpenTopoMap"
            />
          )}

          {/* SPOTS */}
          {!loading &&
            filteredSpots.map((spot) => {
              const lat = Number(spot.lat);
              const lng = Number(spot.lng);
              if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

              const imgUrl = buildSpotImageUrl(spot);
              let markerIcon = null;
              try {
                markerIcon = createImageIcon(imgUrl);
              } catch (err) {
                console.warn('Failed to create marker icon:', err);
              }

              // faux-heat circle (size by rating_count) when in heat mode
              const heatStrength =
                viewMode === 'heat'
                  ? Math.min(spot.rating_count || 1, 10)
                  : 0;

              return (
                <React.Fragment key={spot.id}>
                  {/* Heat circle layer */}
                  {viewMode === 'heat' && heatStrength > 0 && (
                    <Marker
                      position={[lat, lng]}
                      icon={L.divIcon({
                        className: 'heat-circle-icon',
                        html: `<div class="heat-circle heat-${heatStrength}"></div>`,
                        iconSize: [0, 0],
                        iconAnchor: [0, 0],
                      })}
                    />
                  )}

                  {/* Main spot marker */}
                  <Marker
                    position={[lat, lng]}
                    icon={markerIcon || new L.Icon.Default()}
                  >
                    <Popup>
                      <div className="spot-popup">
                        {imgUrl && (
                          <div className="spot-popup-image-wrapper">
                            <img
                              src={imgUrl}
                              alt={spot.name}
                              className="spot-popup-image"
                            />
                          </div>
                        )}
                        <h3>{spot.name}</h3>
                        <p className="spot-popup-category">
                          <strong>Category:</strong> {spot.category}
                        </p>
                        {spot.avg_rating != null && (
                          <p className="spot-popup-rating">
                            ⭐ {spot.avg_rating.toFixed(1)} (
                            {spot.rating_count || 0} reviews)
                          </p>
                        )}
                        <p className="spot-popup-coords">
                          <small>
                            Lat: {lat.toFixed(5)} | Lng:{' '}
                            {lng.toFixed(5)}
                          </small>
                        </p>

                        <button
                          className="spot-popup-btn primary"
                          onClick={() => handleGetDirections(lat, lng)}
                        >
                          Get Directions
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}

          {/* USER LOCATION DOT */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={userLocationIcon}
            >
              <Popup>You are here!</Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Floating my-location button */}
        {userLocation && (
          <button
            className="my-location-icon-button"
            onClick={() => setFollowUser(true)}
          >
            <img src={myLocationIcon} alt="My Location" />
          </button>
        )}
      </div>
    </div>
  );
};

export default MapPage;
