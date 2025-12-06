// frontend/pages/MapManagement/TouristSpots.jsx
import React, { useEffect, useState } from "react";
import api from "../../utils/api";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";

import "../../styles/TouristSpots.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

/* ---------------------------------------------
   DEFAULT MARKER (fallback)
--------------------------------------------- */
const defaultMarkerIcon = new L.Icon({
  iconUrl: "/marker.png",
  iconSize: [40, 40],
});

/* ---------------------------------------------
   MAP SELECTOR COMPONENT
--------------------------------------------- */
const LocationSelectorMap = ({ lat, lng, setLat, setLng, previewUrl }) => {
  const defaultPosition = [lat || 12.5213, lng || 121.313];

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        setLat(e.latlng.lat);
        setLng(e.latlng.lng);
      },
    });
    return null;
  };

  // Dynamic marker image
 const dynamicMarker = previewUrl
  ? new L.DivIcon({
      html: `
        <div class="spot-circle-marker">
          <img src="${previewUrl}" />
        </div>
      `,
      className: "",
      iconSize: [60, 60],
      iconAnchor: [30, 60],
    })
  : defaultMarkerIcon;


  return (
    <MapContainer
      center={defaultPosition}
      zoom={13}
      className="touristspot-map-container"
    >
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <MapEvents />

      {lat && lng && (
        <Marker
          position={[lat, lng]}
          draggable
          icon={dynamicMarker}
          eventHandlers={{
            dragend: (e) => {
              const pos = e.target.getLatLng();
              setLat(pos.lat);
              setLng(pos.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
};

/* ---------------------------------------------
   ADD / EDIT FORM (MODAL)
--------------------------------------------- */
const TouristSpotForm = ({ onSubmit, onCancel, initialData = {}, saving }) => {

const buildPreviewUrl = (url) => {
  if (!url) return null;

  const cleanBase = API_BASE.replace(/\/$/, "");
  const cleanPath = url.replace(/^\//, "");

  return `${cleanBase}/${cleanPath}`;
};


  const [name, setName] = useState(initialData.name || "");
  const [lat, setLat] = useState(initialData.lat ?? "");
  const [lng, setLng] = useState(initialData.lng ?? "");
  const [category, setCategory] = useState(initialData.category || "");

  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(buildPreviewUrl(initialData.image_url));

  const handleImage = (e) => {
    const file = e.target.files[0];
    setImage(file);
    if (file) setPreviewUrl(URL.createObjectURL(file));
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!name || !category || !lat || !lng) {
      toast.error("Please fill in all fields.");
      return;
    }

    const fd = new FormData();
    fd.append("name", name);
    fd.append("lat", lat);
    fd.append("lng", lng);
    fd.append("category", category);
    if (image) fd.append("image", image);

    await onSubmit(fd);
  };

  return (
    <div className="touristspot-modal-overlay">
      <div className="touristspot-modal large-modal">
        <h2 className="modal-title">
          {initialData.id ? "Edit Tourist Spot" : "Add Tourist Spot"}
        </h2>

        {/* MAP + IMAGE PREVIEW */}
        <div className="touristspot-form-top">
          <div className="map-wrapper">
            <LocationSelectorMap
              lat={lat}
              lng={lng}
              setLat={setLat}
              setLng={setLng}
              previewUrl={previewUrl}  // <-- FIXED
            />
          </div>

          <div className="image-panel">
            <div className="image-preview-box">
              {previewUrl ? (
                <img src={previewUrl} className="image-preview-large" alt="preview" />
              ) : (
                <div className="image-preview-placeholder">
                  <span>No image selected</span>
                </div>
              )}
            </div>

            <label className="image-upload-btn">
              Choose Image
              <input type="file" accept="image/*" onChange={handleImage} hidden />
            </label>
          </div>
        </div>

        {/* FORM FIELDS */}
        <form onSubmit={submit}>
          <input
            className="touristspot-input"
            placeholder="Spot Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <select
            className="touristspot-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value="">Select Category</option>
            <option value="restaurant">Restaurant</option>
            <option value="hotel">Hotel</option>
            <option value="beach">Beach</option>
            <option value="park">Park</option>
            <option value="cultural">Cultural Site</option>
            <option value="mountain">Mountain</option>
            <option value="falls">Falls</option>
          </select>

          <div className="coords-row">
            <input
              className="touristspot-input"
              placeholder="Latitude"
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
            />
            <input
              className="touristspot-input"
              placeholder="Longitude"
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              required
            />
          </div>

          <div className="touristspot-form-actions">
            <button type="submit" className="touristspot-submit-btn" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>

            <button type="button" className="touristspot-cancel-btn" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------------------------------------------
   MAIN PAGE COMPONENT
--------------------------------------------- */
const TouristSpots = () => {
  const [spots, setSpots] = useState([]);
  const [editingSpot, setEditingSpot] = useState(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSpots = async () => {
    setLoading(true);
    try {
      const res = await api.get("/map/touristspots");
      setSpots(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load tourist spots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpots();
  }, []);

const getSpotImageUrl = (spot) => {
  if (!spot.image_url) return "/images/fallback.jpg";

  const cleanBase = API_BASE.replace(/\/$/, "");
  const cleanPath = spot.image_url.replace(/^\//, "");

  return `${cleanBase}/${cleanPath}?t=${Date.now()}`;
};


  const handleAdd = async (formData) => {
    setSaving(true);
    try {
      await api.post("/map/touristspots", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Spot added successfully!");
      setAdding(false);
      fetchSpots();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add spot.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (formData) => {
    if (!editingSpot) return;
    setSaving(true);
    try {
      await api.put(`/map/touristspots/${editingSpot.id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Spot updated!");
      setEditingSpot(null);
      fetchSpots();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update spot.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this tourist spot?")) return;
    try {
      await api.delete(`/map/touristspots/${id}`);
      toast.success("Spot deleted.");
      fetchSpots();
    } catch (err) {
      toast.error("Failed to delete spot.");
    }
  };

  return (
    <div className="experiencecms-container">
      <button className="touristspot-add-btn" onClick={() => setAdding(true)}>
        + Add New Spot
      </button>

      {adding && (
        <TouristSpotForm
          onSubmit={handleAdd}
          onCancel={() => setAdding(false)}
          saving={saving}
        />
      )}

      {editingSpot && (
        <TouristSpotForm
          initialData={editingSpot}
          onSubmit={handleEdit}
          onCancel={() => setEditingSpot(null)}
          saving={saving}
        />
      )}

      {loading ? (
        <div>Loading tourist spots...</div>
      ) : (
        <div className="touristspot-card-grid">
          {spots.map((spot) => (
            <div key={spot.id} className="touristspot-card">
              <img
                src={getSpotImageUrl(spot)}
                alt={spot.name}
                className="touristspot-card-image"
              />

              <h3>{spot.name}</h3>
              <p><strong>Category:</strong> {spot.category}</p>
              <p><strong>Lat:</strong> {spot.lat}</p>
              <p><strong>Lng:</strong> {spot.lng}</p>

              <button onClick={() => setEditingSpot(spot)}>Edit</button>
              <button onClick={() => handleDelete(spot.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TouristSpots;
