// frontend/pages/MapPage.jsx
import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-routing-machine/dist/leaflet-routing-machine.js";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

import { useNavigate } from "react-router-dom";
import axios from "axios";

import myLocationIcon from "../assets/icons/location.jpg";
import "../styles/pages.css";

// Fix marker icons (Leaflet default)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")
  : "";

/* ---------------------------------------------
   Fly to user helper
--------------------------------------------- */
const FlyToUser = ({ location, trigger, setTrigger }) => {
  const map = useMap();

  useEffect(() => {
    if (location && trigger) {
      map.flyTo(location, 15, { animate: true, duration: 1 });
      setTrigger(false);
    }
  }, [location, trigger, map, setTrigger]);

  return null;
};

/* ---------------------------------------------
   Routing component
--------------------------------------------- */
const Routing = ({ origin, destination }) => {
  const map = useMap();

  useEffect(() => {
    if (!destination) return;

    const to = [Number(destination[0]), Number(destination[1])];
    const from = origin ? [Number(origin[0]), Number(origin[1])] : null;

    if (!L || !L.Routing || !L.Routing.control) {
      console.warn(
        "⚠️ Leaflet Routing Machine missing — drawing fallback polyline."
      );
      const start = from || [map.getCenter().lat, map.getCenter().lng];
      const pl = L.polyline([start, to], {
        color: "blue",
        weight: 4,
        opacity: 0.8,
      }).addTo(map);
      try {
        map.fitBounds(pl.getBounds(), { padding: [60, 60] });
      } catch (err) {
        console.warn("fitBounds error:", err);
      }
      return () => {
        try {
          if (pl && map.removeLayer) map.removeLayer(pl);
        } catch (err) {
          console.warn("Cleanup error:", err);
        }
      };
    }

    let control;

    try {
      const router = L.Routing.osrmv1({
        serviceUrl: "https://router.project-osrm.org/route/v1",
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
    } catch (err) {
      console.error("Routing control creation failed:", err);
      const start = from || [map.getCenter().lat, map.getCenter().lng];
      const pl = L.polyline([start, to], {
        color: "blue",
        weight: 4,
        opacity: 0.8,
      }).addTo(map);
      try {
        map.fitBounds(pl.getBounds(), { padding: [60, 60] });
      } catch (fitErr) {
        console.warn("fitBounds error:", fitErr);
      }
      return () => {
        try {
          if (pl && map.removeLayer) map.removeLayer(pl);
        } catch (cleanErr) {
          console.warn("Cleanup error:", cleanErr);
        }
      };
    }

    const onRoutesFound = (e) => {
      try {
        const routes = e?.routes || control?.getRoutes?.();
        if (routes && routes.length) {
          const bounds = routes[0].bounds;
          if (bounds) map.fitBounds(bounds, { padding: [60, 60] });
        }
      } catch (err) {
        console.warn("onRoutesFound error:", err);
      }
    };

    try {
      control.on?.("routesfound", onRoutesFound);
    } catch (err) {
      console.warn("Control event binding failed:", err);
    }

    return () => {
      try {
        if (control && map.removeControl) map.removeControl(control);
      } catch (err) {
        console.warn("Routing cleanup failed:", err);
      }
    };
  }, [origin, destination, map]);

  return null;
};

/* ---------------------------------------------
   MAIN MAP PAGE
--------------------------------------------- */
const MapPage = () => {
  const navigate = useNavigate();
  const [isSatellite, setIsSatellite] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [routeTo, setRouteTo] = useState(null);
  const [flyToUser, setFlyToUser] = useState(false);
  const [touristSpots, setTouristSpots] = useState([]);
  const [loading, setLoading] = useState(false);

  // Mansalay default center
  const mapCenter = [12.5269, 121.438];

  /* ---------------------------------------------
     Geolocation watcher
  --------------------------------------------- */
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) =>
        setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.warn("Geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  /* ---------------------------------------------
     Fetch tourist spots (from /map/touristspots)
  --------------------------------------------- */
  useEffect(() => {
    const fetchSpots = async () => {
      setLoading(true);
      try {
        const url = API_BASE
          ? `${API_BASE}/map/touristspots`
          : "/map/touristspots";
        const res = await axios.get(url);
        setTouristSpots(res.data || []);
      } catch (error) {
        console.error("Failed to fetch tourist spots:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSpots();
  }, []);

  /* ---------------------------------------------
     Image URL builder for markers
  --------------------------------------------- */
  const getSpotImageUrl = (spot) => {
    if (spot.image_url) {
      return `${spot.image_url}?t=${Date.now()}`;
    }
    if (spot.media_path) {
      const filename = encodeURIComponent(spot.media_path);
      return API_BASE
        ? `${API_BASE}/uploads/touristspotsmap/${filename}?t=${Date.now()}`
        : `/uploads/touristspotsmap/${filename}?t=${Date.now()}`;
    }
    return null;
  };

  const createImageIcon = (imgUrl) => {
    if (!imgUrl) return null;
    return L.icon({
      iconUrl: imgUrl,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36],
      className: "custom-circle-icon",
    });
  };

  /* ---------------------------------------------
     RENDER
  --------------------------------------------- */
  return (
    <div className="map-page-container">
      <div className="map-controls">
        <button
          className="back-button-floating"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>

        <div className="layer-toggle">
          <label className="layer-label">Map View:</label>
          <select
            onChange={() => setIsSatellite((prev) => !prev)}
            value={isSatellite ? "satellite" : "street"}
          >
            <option value="satellite">Satellite</option>
            <option value="street">Street</option>
          </select>
        </div>

        {routeTo && (
          <button
            className="cancel-button"
            onClick={() => setRouteTo(null)}
          >
            Cancel Directions
          </button>
        )}
      </div>

      {!userLocation && (
        <div
          style={{
            padding: "6px 12px",
            background: "#fff7cc",
            color: "#794c00",
            margin: "8px 12px",
            borderRadius: 6,
          }}
        >
          ⚠️ Geolocation not available — using default map center.
        </div>
      )}

      <div className="map-container">
        <MapContainer
          center={mapCenter}
          zoom={11}
          zoomControl={false}
          className="leaflet-map"
        >
          <ZoomControl position="bottomright" />

          {flyToUser && userLocation && (
            <FlyToUser
              location={userLocation}
              trigger={flyToUser}
              setTrigger={setFlyToUser}
            />
          )}

          {routeTo && (
            <Routing
              origin={userLocation || mapCenter}
              destination={routeTo}
            />
          )}

          <TileLayer
            url={
              isSatellite
                ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
            attribution={
              isSatellite
                ? "Tiles © Esri — Sources: Esri, USGS, NOAA"
                : "&copy; OpenStreetMap contributors"
            }
          />

          {!loading &&
            touristSpots.map((spot, i) => {
              const lat = Number(spot.lat);
              const lng = Number(spot.lng);

              // guard invalid coords
              if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

              const imgUrl = getSpotImageUrl(spot);
              let markerIcon = null;

              try {
                markerIcon = createImageIcon(imgUrl);
              } catch (err) {
                console.warn("Failed to create marker icon:", err);
              }

              return (
                <Marker
                  key={spot.id ?? i}
                  position={[lat, lng]}
                  icon={markerIcon || new L.Icon.Default()}
                >
                  <Popup>
                    <strong>{spot.name}</strong>
                    <br />
                    <small>
                      <strong>Category:</strong> {spot.category}
                    </small>
                    <br />
                    <button
                      onClick={() => setRouteTo([lat, lng])}
                      style={{ marginTop: 6 }}
                    >
                      Get Directions
                    </button>
                  </Popup>
                </Marker>
              );
            })}

          {userLocation && (
            <Marker
              position={userLocation}
              icon={L.divIcon({
                className: "custom-location-icon",
                html:
                  '<div class="marker-pin"></div><i class="fa fa-map-marker"></i>',
                iconSize: [30, 42],
                iconAnchor: [15, 42],
              })}
            >
              <Popup>You are here!</Popup>
            </Marker>
          )}
        </MapContainer>

        {userLocation && (
          <button
            className="my-location-icon-button"
            onClick={() => setFlyToUser(true)}
          >
            <img src={myLocationIcon} alt="My Location" />
          </button>
        )}
      </div>
    </div>
  );
};

export default MapPage;
