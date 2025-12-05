// src/pages/DiscoverMap.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../utils/api";
import "../styles/map.css";

const DEFAULT_CENTER = [12.5206, 121.4403];

/* -------------------------------------------------------
    LEAFLET FIX (removes default broken marker icons)
--------------------------------------------------------*/
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL(
    "leaflet/dist/images/marker-icon-2x.png",
    import.meta.url
  ).toString(),
  iconUrl: new URL(
    "leaflet/dist/images/marker-icon.png",
    import.meta.url
  ).toString(),
  shadowUrl: new URL(
    "leaflet/dist/images/marker-shadow.png",
    import.meta.url
  ).toString(),
});

/* -------------------------------------------------------
   USER LOCATION MARKER
--------------------------------------------------------*/
const userIcon = L.icon({
  iconUrl: "/images/user-marker.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

/* -------------------------------------------------------
   CIRCLE IMAGE MARKER (Tourist spots)
--------------------------------------------------------*/
const createImgMarker = (imageUrl) =>
  new L.DivIcon({
    html: `
      <div class="dm-circle-marker">
        <img src="${imageUrl}" />
      </div>
    `,
    className: "",
    iconSize: [52, 52],
    iconAnchor: [26, 52],
  });

/* -------------------------------------------------------
   CATEGORY FILTER OPTIONS
--------------------------------------------------------*/
const categoryOptions = [
  { value: "all", label: "All" },
  { value: "hotel", label: "Hotels" },
  { value: "restaurant", label: "Restaurants" },
  { value: "beach", label: "Beaches" },
  { value: "park", label: "Parks" },
  { value: "cultural", label: "Cultural" },
  { value: "mountain", label: "Mountains" },
  { value: "waterfall", label: "Waterfalls" },
];

/* -------------------------------------------------------
   FLY TO MARKER WHEN SELECTED
--------------------------------------------------------*/
function MapFlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 14, { duration: 1.1 });
    }
  }, [position, map]);
  return null;
}

/* -------------------------------------------------------
    MAIN COMPONENT
--------------------------------------------------------*/
const DiscoverMap = () => {
  const [spots, setSpots] = useState([]);
  const [filteredSpots, setFilteredSpots] = useState([]);

  const [selectedSpot, setSelectedSpot] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);

  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [postingReview, setPostingReview] = useState(false);

  /* -------------------------------------------------------
     FETCH TOURIST SPOTS
  --------------------------------------------------------*/
  const fetchSpots = async () => {
    try {
      const res = await api.get("/map/touristspots");
      setSpots(res.data || []);
      setFilteredSpots(res.data || []);
    } catch (err) {
      console.error("Failed to fetch tourist spots", err);
    }
  };

  useEffect(() => {
    fetchSpots();
  }, []);

  /* -------------------------------------------------------
     FILTERING
  --------------------------------------------------------*/
  useEffect(() => {
    let list = spots;

    if (activeCategory !== "all") {
      list = list.filter((s) => s.category === activeCategory);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.category.toLowerCase().includes(term)
      );
    }

    setFilteredSpots(list);
  }, [spots, searchTerm, activeCategory]);

  /* -------------------------------------------------------
     SELECT SPOT + LOAD REVIEWS
  --------------------------------------------------------*/
  const selectSpot = async (spot) => {
    setSelectedSpot(spot);
    setRouteCoords([]);
    setRouteInfo(null);
    loadReviews(spot.id);
  };

  const loadReviews = async (id) => {
    setLoadingReviews(true);
    try {
      const res = await api.get(`/map/touristspots/${id}/reviews`);
      setReviews(res.data || []);
    } catch (err) {
      console.error("Failed to load reviews", err);
    } finally {
      setLoadingReviews(false);
    }
  };

  /* -------------------------------------------------------
     GET USER LOCATION
  --------------------------------------------------------*/
  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      alert("Your device does not support GPS");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        alert("Unable to get location");
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  /* -------------------------------------------------------
     GET DIRECTIONS ROUTE
  --------------------------------------------------------*/
  const getDirections = async () => {
    if (!userLocation) {
      requestUserLocation();
      return;
    }

    try {
      const res = await api.get("/map/directions", {
        params: {
          fromLat: userLocation[0],
          fromLng: userLocation[1],
          toLat: selectedSpot.lat,
          toLng: selectedSpot.lng,
        },
      });

      const coords =
        res.data.geometry.coordinates.map(([lng, lat]) => [lat, lng]) || [];

      setRouteCoords(coords);
      setRouteInfo({
        distance: res.data.distance,
        duration: res.data.duration,
      });
    } catch (err) {
      console.error("Failed to get directions", err);
      alert("Unable to get directions");
    }
  };

  /* -------------------------------------------------------
     SUBMIT REVIEW
  --------------------------------------------------------*/
  const submitReview = async (e) => {
    e.preventDefault();
    if (!reviewName.trim()) {
      alert("Name required");
      return;
    }

    try {
      setPostingReview(true);
      await api.post(`/map/touristspots/${selectedSpot.id}/reviews`, {
        user_name: reviewName.trim(),
        rating: reviewRating,
        comment: reviewComment.trim(),
      });

      setReviewName("");
      setReviewComment("");
      setReviewRating(5);

      loadReviews(selectedSpot.id);
    } catch (err) {
      alert("Failed to submit review");
    } finally {
      setPostingReview(false);
    }
  };

  /* -------------------------------------------------------
     PAGE RENDER
  --------------------------------------------------------*/
  return (
    <div className="dm-container">
      {/* ---------------- LEFT SIDEBAR ---------------- */}
      <div className="dm-sidebar">
        <h2 className="dm-title">Discover Mansalay</h2>

        {/* Search */}
        <input
          type="text"
          className="dm-search"
          placeholder="Search tourist spots..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Category Filter */}
        <div className="dm-filter-pills">
          {categoryOptions.map((cat) => (
            <button
              key={cat.value}
              className={
                activeCategory === cat.value
                  ? "dm-pill active"
                  : "dm-pill"
              }
              onClick={() => setActiveCategory(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* My Location */}
        <button
          className="dm-location-btn"
          onClick={requestUserLocation}
          disabled={isLocating}
        >
          {isLocating ? "Locating..." : "📍 My Location"}
        </button>

        {/* Spot List */}
        <div className="dm-list">
          {filteredSpots.map((spot) => (
            <div
              key={spot.id}
              className={
                selectedSpot?.id === spot.id
                  ? "dm-list-item selected"
                  : "dm-list-item"
              }
              onClick={() => selectSpot(spot)}
            >
              <img src={spot.image_url} className="dm-list-thumb" />
              <div>
                <h4>{spot.name}</h4>
                <p>{spot.category}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- MAP AREA ---------------- */}
      <div className="dm-map-wrapper">
        <MapContainer center={DEFAULT_CENTER} zoom={12} className="dm-map">
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {selectedSpot && (
            <MapFlyTo position={[selectedSpot.lat, selectedSpot.lng]} />
          )}

          {/* User Location */}
          {userLocation && (
            <Marker position={userLocation} icon={userIcon}>
              <Popup>You are here</Popup>
            </Marker>
          )}

          {/* Tourist Spot Markers */}
          {filteredSpots.map((spot) => (
            <Marker
              key={spot.id}
              position={[spot.lat, spot.lng]}
              icon={createImgMarker(spot.image_url)}
              eventHandlers={{
                click: () => selectSpot(spot),
              }}
            ></Marker>
          ))}

          {/* Route */}
          {routeCoords.length > 0 && (
            <Polyline positions={routeCoords} color="#1e90ff" weight={5} />
          )}
        </MapContainer>
      </div>

      {/* ---------------- RIGHT INFO PANEL ---------------- */}
      {selectedSpot && (
        <div className="dm-info-panel">
          <button
            className="dm-close"
            onClick={() => {
              setSelectedSpot(null);
              setReviews([]);
              setRouteCoords([]);
            }}
          >
            ✕
          </button>

          {/* Image */}
          <img
            src={selectedSpot.image_url}
            className="dm-info-img"
            alt={selectedSpot.name}
          />

          <h2 className="dm-info-title">{selectedSpot.name}</h2>
          <p className="dm-info-category">{selectedSpot.category}</p>

          {/* Description (if any) */}
          {selectedSpot.description && (
            <p className="dm-info-desc">{selectedSpot.description}</p>
          )}

          {/* Directions button */}
          <button className="dm-direction-btn" onClick={getDirections}>
            🚗 Get Directions
          </button>

          {/* Route Info */}
          {routeInfo && (
            <p className="dm-route-info">
              Distance: {(routeInfo.distance / 1000).toFixed(1)} km ·
              ETA: {(routeInfo.duration / 60).toFixed(0)} min
            </p>
          )}

          <hr className="dm-divider" />

          {/* Reviews */}
          <h3>Reviews</h3>

          {loadingReviews ? (
            <p>Loading...</p>
          ) : reviews.length === 0 ? (
            <p>No reviews yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="dm-review-item">
                <div className="dm-review-head">
                  <strong>{r.user_name}</strong>
                  <span>{"⭐".repeat(r.rating)}</span>
                </div>
                {r.comment && (
                  <p className="dm-review-comment">{r.comment}</p>
                )}
                <span className="dm-review-date">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
            ))
          )}

          {/* Submit Review */}
          <form className="dm-review-form" onSubmit={submitReview}>
            <input
              className="dm-review-input"
              placeholder="Your name"
              value={reviewName}
              onChange={(e) => setReviewName(e.target.value)}
            />

            <div className="dm-stars-picker">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={reviewRating >= n ? "active" : ""}
                  onClick={() => setReviewRating(n)}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              className="dm-review-textarea"
              placeholder="Write a review..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
            />

            <button className="dm-review-submit">
              {postingReview ? "Submitting..." : "Submit Review"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default DiscoverMap;
