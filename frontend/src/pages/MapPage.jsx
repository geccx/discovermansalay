import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

import { useNavigate } from "react-router-dom";
import axios from "axios";

import myLocationIcon from "../assets/icons/location.jpg";
import "../styles/pages.css";

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
   FLY TO USER COMPONENT
---------------------------------------------------------- */
const FlyToUser = ({ location, trigger, setTrigger }) => {
  const map = useMap();
  useEffect(() => {
    if (location && trigger) {
      map.flyTo(location, 15, { duration: 1.0 });
      setTrigger(false);
    }
  }, [location, trigger]);
  return null;
};

/* ----------------------------------------------------------
   ROUTING COMPONENT
---------------------------------------------------------- */
const Routing = ({ origin, destination }) => {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    if (!destination) {
      // remove route
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
        routingControlRef.current = null;
      }
      return;
    }

    const from = L.latLng(origin[0], origin[1]);
    const to = L.latLng(destination[0], destination[1]);

    const control = L.Routing.control({
      waypoints: [from, to],
      fitSelectedRoutes: true,
      show: false,
      addWaypoints: false,
      routeWhileDragging: false,
      draggableWaypoints: false,
      createMarker: () => null,
      lineOptions: {
        styles: [{ color: "#1a73e8", weight: 5 }],
      },
      router: L.Routing.osrmv1({
        serviceUrl: "https://router.project-osrm.org/route/v1",
      }),
    }).addTo(map);

    routingControlRef.current = control;

    return () => map.removeControl(control);
  }, [origin, destination]);

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
  const [flyToUser, setFlyToUser] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [category, setCategory] = useState("all");

  const mapCenter = [12.5269, 121.438];

// ----------------------------------------------------------
//  GELOCATION
// ----------------------------------------------------------
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => console.warn("GPS ERROR:", err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

// ----------------------------------------------------------
//   FETCH TOURIST SPOTS
// ----------------------------------------------------------
  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API_BASE}/map/touristspots`);
        setTouristSpots(res.data);
        setFilteredSpots(res.data);
      } catch (err) {
        console.error("Failed to load tourist spots", err);
      }
    };
    load();
  }, []);

// ----------------------------------------------------------
//   BUILD IMAGE URL
// ----------------------------------------------------------
  const getSpotImageUrl = (spot) => {
    if (!spot.image_url) return null;
    const path = spot.image_url.replace(/^\//, "");
    return `${API_BASE}/${path}`;
  };

// ----------------------------------------------------------
//   HANDLE SEARCH / FILTER
// ----------------------------------------------------------
  useEffect(() => {
    let spots = [...touristSpots];

    if (category !== "all") {
      spots = spots.filter((s) => s.category === category);
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      spots = spots.filter((s) => s.name.toLowerCase().includes(q));
    }

    setFilteredSpots(spots);
  }, [searchText, category, touristSpots]);

// ----------------------------------------------------------
//   RENDER
// ----------------------------------------------------------
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

        <select
          onChange={() => setIsSatellite(!isSatellite)}
          value={isSatellite ? "satellite" : "street"}
        >
          <option value="satellite">Satellite</option>
          <option value="street">Street</option>
        </select>
      </div>

      {/* LEFT INFO PANEL */}
      {selectedSpot && (
        <div className="info-panel">
          <button className="info-close" onClick={() => setSelectedSpot(null)}>
            ✕
          </button>

          <img
            className="info-image"
            src={getSpotImageUrl(selectedSpot)}
            alt={selectedSpot.name}
          />

          <h2 className="info-title">{selectedSpot.name}</h2>
          <p className="info-category">{selectedSpot.category}</p>

          <button
            className="info-directions-btn"
            onClick={() => {
              setRouteTo([selectedSpot.lat, selectedSpot.lng]);
            }}
          >
            Get Directions
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

          {/* Fly to User Button */}
          {flyToUser && userLocation && (
            <FlyToUser
              location={userLocation}
              trigger={flyToUser}
              setTrigger={setFlyToUser}
            />
          )}

          {/* Routing */}
          {routeTo && userLocation && (
            <Routing origin={userLocation} destination={routeTo} />
          )}

          {/* MAP LAYERS */}
          <TileLayer
            url={
              isSatellite
                ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
          />

          {/* TOURIST SPOTS */}
          {filteredSpots.map((spot) => {
            const img = getSpotImageUrl(spot);
            return (
              <Marker
                key={spot.id}
                position={[spot.lat, spot.lng]}
                icon={createImageMarker(img, selectedSpot?.id === spot.id)}
                eventHandlers={{
                  click: () => {
                    setSelectedSpot(spot);
                  },
                }}
              />
            );
          })}

          {/* USER LOCATION */}
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

        {/* USER LOCATION BUTTON */}
        <button
          className="my-location-icon-button"
          onClick={() => setFlyToUser(true)}
        >
          <img src={myLocationIcon} alt="loc" />
        </button>
      </div>
    </div>
  );
};

export default MapPage;
