import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  ZoomControl,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

import { useNavigate } from "react-router-dom";
import axios from "axios";

import myLocationIcon from "../assets/icons/location.jpg";
import "../styles/map.css";

/* ----------------------------------------------------------
   FIX DEFAULT MARKERS
---------------------------------------------------------- */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "";

/* ----------------------------------------------------------
   HELPERS
---------------------------------------------------------- */
const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/* ----------------------------------------------------------
   FLY TO USER COMPONENT
---------------------------------------------------------- */
const FlyToUser = ({ location, trigger, setTrigger }) => {
  const map = useMap();
  useEffect(() => {
    if (location && trigger) {
      map.flyTo(location, 15, { duration: 1.0 });
      setTrigger(false);
    }
  }, [location, trigger, map, setTrigger]);
  return null;
};

/* ----------------------------------------------------------
   FOLLOW USER COMPONENT
---------------------------------------------------------- */
const FollowUser = ({ location, follow }) => {
  const map = useMap();
  useEffect(() => {
    if (follow && location) {
      map.flyTo(location, map.getZoom(), { duration: 0.5 });
    }
  }, [location, follow, map]);
  return null;
};

/* ----------------------------------------------------------
   FLY TO SELECTED SPOT
---------------------------------------------------------- */
const FlyToSpot = ({ spot }) => {
  const map = useMap();
  useEffect(() => {
    if (spot) {
      map.flyTo([Number(spot.lat), Number(spot.lng)], 15, {
        duration: 0.7,
      });
    }
  }, [spot, map]);
  return null;
};

/* ----------------------------------------------------------
   ROUTING COMPONENT
---------------------------------------------------------- */
const Routing = ({ origin, destination, onRouteSummaryChange }) => {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    // Clear route if no destination
    if (!destination) {
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
        routingControlRef.current = null;
      }
      onRouteSummaryChange?.(null);
      return;
    }

    const from = L.latLng(origin[0], origin[1]);
    const to = L.latLng(destination[0], destination[1]);

    // Clean up any existing control
    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
      routingControlRef.current = null;
    }

    const control = L.Routing.control({
      waypoints: [from, to],
      fitSelectedRoutes: true,
      show: false,
      addWaypoints: false,
      routeWhileDragging: false,
      draggableWaypoints: false,
      createMarker: () => null,
      lineOptions: {
        styles: [{ color: "#1a73e8", weight: 5, opacity: 0.9 }],
      },
      router: L.Routing.osrmv1({
        serviceUrl: "https://router.project-osrm.org/route/v1",
      }),
    })
      .on("routesfound", (e) => {
        try {
          const route = e.routes[0];
          const distanceKm = route.summary.totalDistance / 1000;
          const durationMin = route.summary.totalTime / 60;
          onRouteSummaryChange?.({
            distanceKm,
            durationMin,
          });
        } catch {
          onRouteSummaryChange?.(null);
        }
      })
      .addTo(map);

    routingControlRef.current = control;

    return () => {
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
        routingControlRef.current = null;
      }
      onRouteSummaryChange?.(null);
    };
  }, [origin, destination, map, onRouteSummaryChange]);

  return null;
};

/* ----------------------------------------------------------
   MARKER IMAGE ICON
---------------------------------------------------------- */
const createImageMarker = (imgUrl, selected = false) =>
  L.icon({
    iconUrl: imgUrl,
    iconSize: selected ? [64, 64] : [50, 50],
    iconAnchor: [25, 50],
    className: "custom-circle-icon",
  });

/* ----------------------------------------------------------
   MAIN MAP PAGE
---------------------------------------------------------- */
const MapPage = () => {
  const navigate = useNavigate();

  const [isSatellite, setIsSatellite] = useState(true);
  const [userLocation, setUserLocation] = useState(null);

  const [touristSpots, setTouristSpots] = useState([]);
  const [filteredSpots, setFilteredSpots] = useState([]);

  const [selectedSpot, setSelectedSpot] = useState(null);
  const [routeTo, setRouteTo] = useState(null);
  const [routeSummary, setRouteSummary] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [category, setCategory] = useState("all");
  const [showNearbyOnly, setShowNearbyOnly] = useState(false);
  const [followUser, setFollowUser] = useState(false);
  const [flyToUser, setFlyToUser] = useState(false);

  const NEARBY_RADIUS_KM = 2.0;
  const mapCenter = [12.5269, 121.438];

  /* ---------------------------------------------
     GELOCATION
  --------------------------------------------- */
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => console.warn("Geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  /* ---------------------------------------------
     FETCH TOURIST SPOTS
  --------------------------------------------- */
  useEffect(() => {
    const fetchSpots = async () => {
      try {
        const res = await axios.get(`${API_BASE}/map/touristspots`);
        setTouristSpots(res.data || []);
      } catch (err) {
        console.error("Failed to fetch tourist spots:", err);
      }
    };
    fetchSpots();
  }, []);

  /* ---------------------------------------------
     IMAGE URL BUILDER
  --------------------------------------------- */
  const getSpotImageUrl = (spot) => {
    if (!spot.image_url) return null;
    const cleanPath = spot.image_url.replace(/^\//, "");
    return `${API_BASE}/${cleanPath}`;
  };

  /* ---------------------------------------------
     FILTER, SEARCH, NEARBY, SORT
  --------------------------------------------- */
  useEffect(() => {
    let spots = touristSpots.map((s) => {
      const lat = Number(s.lat);
      const lng = Number(s.lng);
      let distanceKm = null;

      if (userLocation) {
        distanceKm = haversineDistanceKm(
          userLocation[0],
          userLocation[1],
          lat,
          lng
        );
      }

      return { ...s, lat, lng, distanceKm };
    });

    if (category !== "all") {
      spots = spots.filter((s) => s.category === category);
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      spots = spots.filter((s) => s.name.toLowerCase().includes(q));
    }

    if (showNearbyOnly && userLocation) {
      spots = spots.filter(
        (s) => s.distanceKm != null && s.distanceKm <= NEARBY_RADIUS_KM
      );
    }

    // Sort by distance if nearby, else by rating then name
    spots.sort((a, b) => {
      if (showNearbyOnly && userLocation) {
        return (a.distanceKm || Infinity) - (b.distanceKm || Infinity);
      }
      if ((b.avg_rating || 0) !== (a.avg_rating || 0)) {
        return (b.avg_rating || 0) - (a.avg_rating || 0);
      }
      return a.name.localeCompare(b.name);
    });

    setFilteredSpots(spots);
  }, [touristSpots, searchText, category, showNearbyOnly, userLocation]);

  /* ---------------------------------------------
     HANDLERS
  --------------------------------------------- */
  const handleSelectSpot = (spot) => {
    setSelectedSpot(spot);
    // Don't immediately start route; just open panel;
    // user will click "Get Directions".
  };

  const handleStartRoute = () => {
    if (!selectedSpot || !userLocation) return;
    setRouteTo([selectedSpot.lat, selectedSpot.lng]);
  };

  const handleClearRoute = () => {
    setRouteTo(null);
    setRouteSummary(null);
  };

  /* ---------------------------------------------
     RENDER
  --------------------------------------------- */
  return (
    <div className="map-page-container">
      {/* TOP BAR */}
      <div className="map-controls">
        <button onClick={() => navigate(-1)} className="back-button-floating">
          ← Back
        </button>

        <input
          className="search-box"
          placeholder="Search tourist spot..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />

        <select
          className="filter-box"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All</option>
          <option value="beach">Beach</option>
          <option value="hotel">Hotel</option>
          <option value="restaurant">Restaurant</option>
          <option value="park">Park</option>
          <option value="cultural">Cultural</option>
          <option value="mountain">Mountain</option>
          <option value="falls">Falls</option>
        </select>

        <div className="toggle-group">
          <button
            className={`toggle-pill ${showNearbyOnly ? "active" : ""}`}
            onClick={() => setShowNearbyOnly((v) => !v)}
          >
            Nearby
          </button>
          <button
            className={`toggle-pill ${followUser ? "active" : ""}`}
            onClick={() => setFollowUser((v) => !v)}
          >
            Follow Me
          </button>
        </div>

        <select
          className="filter-box"
          onChange={() => setIsSatellite(!isSatellite)}
          value={isSatellite ? "satellite" : "street"}
        >
          <option value="satellite">Satellite</option>
          <option value="street">Street</option>
        </select>
      </div>

      {/* INFO PANEL LEFT */}
      {selectedSpot && (
        <div className="info-panel">
          <button
            className="info-close"
            onClick={() => {
              setSelectedSpot(null);
              handleClearRoute();
            }}
          >
            ✕
          </button>

          <img
            className="info-image"
            src={getSpotImageUrl(selectedSpot) || "/images/fallback.jpg"}
            alt={selectedSpot.name}
          />

          <h2 className="info-title">{selectedSpot.name}</h2>
          <p className="info-category">{selectedSpot.category}</p>

          <div className="info-meta">
            {selectedSpot.avg_rating != null && (
              <div className="info-rating">
                ⭐ {Number(selectedSpot.avg_rating).toFixed(1)}{" "}
                <span className="muted">
                  ({selectedSpot.rating_count || 0} reviews)
                </span>
              </div>
            )}

            {userLocation && selectedSpot.distanceKm != null && (
              <div className="info-distance">
                📍{" "}
                {selectedSpot.distanceKm < 1
                  ? `${(selectedSpot.distanceKm * 1000).toFixed(0)} m away`
                  : `${selectedSpot.distanceKm.toFixed(1)} km away`}
              </div>
            )}
          </div>

          <button
            className="info-directions-btn"
            onClick={routeTo ? handleClearRoute : handleStartRoute}
            disabled={!userLocation}
          >
            {routeTo ? "Clear Directions" : "Get Directions"}
          </button>

          <div className="info-extra">
            <p className="muted">
              Lat: {selectedSpot.lat} | Lng: {selectedSpot.lng}
            </p>
            {showNearbyOnly && selectedSpot.distanceKm != null && (
              <span className="badge badge-nearby">Nearby</span>
            )}
          </div>
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

          {/* fly once when user taps my-location button */}
          {flyToUser && userLocation && (
            <FlyToUser
              location={userLocation}
              trigger={flyToUser}
              setTrigger={setFlyToUser}
            />
          )}

          {/* live follow mode */}
          {userLocation && (
            <FollowUser location={userLocation} follow={followUser} />
          )}

          {/* fly to selected spot */}
          {selectedSpot && <FlyToSpot spot={selectedSpot} />}

          {/* Routing line */}
          {routeTo && userLocation && (
            <Routing
              origin={userLocation}
              destination={routeTo}
              onRouteSummaryChange={setRouteSummary}
            />
          )}

          {/* Base layer */}
          <TileLayer
            url={
              isSatellite
                ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
            attribution={
              isSatellite
                ? "Tiles © Esri — Sources: Esri, USGS, NOAA"
                : "&copy; OpenStreetMap contributors"
            }
          />

          {/* Tourist spots markers */}
          {filteredSpots.map((spot) => {
            const imgUrl = getSpotImageUrl(spot) || "/images/fallback.jpg";
            const isSelected = selectedSpot?.id === spot.id;
            return (
              <Marker
                key={spot.id}
                position={[spot.lat, spot.lng]}
                icon={createImageMarker(imgUrl, isSelected)}
                eventHandlers={{
                  click: () => handleSelectSpot(spot),
                }}
              />
            );
          })}

          {/* User location marker */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={L.divIcon({
                html: `<div class="user-location-dot"></div>`,
                className: "",
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              })}
            />
          )}
        </MapContainer>

        {/* My location floating button */}
        {userLocation && (
          <button
            className="my-location-icon-button"
            onClick={() => setFlyToUser(true)}
          >
            <img src={myLocationIcon} alt="My Location" />
          </button>
        )}

        {/* Route summary pill */}
        {routeSummary && (
          <div className="route-summary-pill">
            <span>
              🚗 Distance: {routeSummary.distanceKm.toFixed(1)} km
            </span>
            <span>
              ⏱ ETA: {Math.round(routeSummary.durationMin)} min
            </span>
          </div>
        )}

        {/* Bottom card strip */}
        {filteredSpots.length > 0 && (
          <div className="bottom-card-strip">
            {filteredSpots.map((spot) => (
              <div
                key={spot.id}
                className={`bottom-card ${
                  selectedSpot?.id === spot.id ? "selected" : ""
                }`}
                onClick={() => handleSelectSpot(spot)}
              >
                <div className="bottom-card-image-wrap">
                  <img
                    src={getSpotImageUrl(spot) || "/images/fallback.jpg"}
                    alt={spot.name}
                    className="bottom-card-image"
                  />
                </div>
                <div className="bottom-card-body">
                  <div className="bottom-card-title">{spot.name}</div>
                  <div className="bottom-card-category">{spot.category}</div>
                  {spot.distanceKm != null && (
                    <div className="bottom-card-distance">
                      {spot.distanceKm < 1
                        ? `${(spot.distanceKm * 1000).toFixed(0)} m`
                        : `${spot.distanceKm.toFixed(1)} km`}
                      {spot.distanceKm <= NEARBY_RADIUS_KM && (
                        <span className="badge badge-nearby">Nearby</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!userLocation && (
        <div className="geo-warning">
          ⚠️ Geolocation not available — using default map center.
        </div>
      )}
    </div>
  );
};

export default MapPage;
