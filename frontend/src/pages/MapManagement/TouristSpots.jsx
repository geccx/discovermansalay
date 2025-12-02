import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''; // set this in your Railway/frontend env

const TouristSpots = () => {
  const [spots, setSpots] = useState([]);
  const [editingSpot, setEditingSpot] = useState(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSpots = async () => {
    setLoading(true);
    try {
      const res = await api.get('/map/touristspots');
      setSpots(res.data || []);
    } catch (err) {
      console.error('Failed to fetch spots', err);
      toast.error('Failed to fetch tourist spots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpots();
  }, []);

  const handleAdd = async (formData) => {
    setSaving(true);
    try {
      await api.post('/map/touristspots', formData);
      toast.success('Spot added successfully!');
      setAdding(false);
      await fetchSpots();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add spot. Check console.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (formData) => {
    if (!editingSpot) return;
    setSaving(true);
    try {
      await api.put(`/map/touristspots/${editingSpot.id}`, formData);
      toast.success('Spot updated successfully!');
      setEditingSpot(null);
      await fetchSpots();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update spot. Check console.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this spot?');
    if (!confirmDelete) return;
    try {
      await api.delete(`/map/touristspots/${id}`);
      toast.success('Spot deleted');
      await fetchSpots();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete spot');
    }
  };

  const getSpotImageUrl = (spot) => {
    // Prefer explicit image_url from backend if present
    if (spot.image_url) return spot.image_url + `?t=${Date.now()}`;

    // otherwise build from API base + uploads path (encode filename)
    if (spot.image) {
      const filename = encodeURIComponent(spot.image);
      // ensure API_BASE has protocol+host (e.g. https://backend...); if not, api util may proxy
      if (API_BASE) return `${API_BASE.replace(/\/$/, '')}/uploads/touristspotsmap/${filename}?t=${Date.now()}`;
      // fallback to relative path (useful for local dev when frontend proxies)
      return `/uploads/touristspotsmap/${filename}?t=${Date.now()}`;
    }

    return '/images/fallback.jpg';
  };

  const TouristSpotForm = ({ onSubmit, initialData = {}, onCancel }) => {
    const [name, setName] = useState(initialData.name || '');
    const [lat, setLat] = useState(initialData.lat ?? '');
    const [lng, setLng] = useState(initialData.lng ?? '');
    const [category, setCategory] = useState(initialData.category || '');
    const [image, setImage] = useState(null);

    const handleSubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData();
      formData.append('name', name);
      formData.append('lat', parseFloat(lat));
      formData.append('lng', parseFloat(lng));
      formData.append('category', category);
      if (image) formData.append('image', image);
      await onSubmit(formData);
    };

    return (
      <div className="touristspot-modal-overlay">
        <div className="touristspot-modal">
          <h3 className="touristspot-form-title">{initialData.id ? 'Edit' : 'Add'} Tourist Spot</h3>
          <form onSubmit={handleSubmit} className="touristspot-form">
            <input
              type="text"
              className="touristspot-input"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="number"
              className="touristspot-input"
              placeholder="Latitude"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
            />
            <input
              type="number"
              className="touristspot-input"
              placeholder="Longitude"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
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
            </select>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files[0])}
            />
            <div className="touristspot-form-actions">
              <button type="submit" className="touristspot-submit-btn" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={onCancel} className="touristspot-cancel-btn" disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
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
        />
      )}

      {editingSpot && (
        <TouristSpotForm
          onSubmit={handleEdit}
          initialData={editingSpot}
          onCancel={() => setEditingSpot(null)}
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
                onError={(e) => { e.currentTarget.src = '/images/fallback.jpg'; }}
              />
              <h4>{spot.name}</h4>
              <p><strong>Lat:</strong> {spot.lat}</p>
              <p><strong>Lng:</strong> {spot.lng}</p>
              <p><strong>Category:</strong> {spot.category}</p>
              <div className="touristspot-card-actions">
                <button className="experiencecms-edit-btn" onClick={() => setEditingSpot(spot)}>Edit</button>
                <button className="experiencecms-delete-btn" onClick={() => handleDelete(spot.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TouristSpots;
