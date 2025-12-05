// src/components/DestinationManager.jsx
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const ENDPOINT = API_BASE ? `${API_BASE}/api/destinations` : '/api/destinations';

const categories = [
  'Featured Destinations',
  'Beaches',
  'Restaurants',
  'Adventures',
  'Hotels & Resort',
  'Accommodations',
];

const DestinationManager = () => {
  const [destinations, setDestinations] = useState([]);
  const [form, setForm] = useState({ name: '', category: '', description: '', image: null });
  const [preview, setPreview] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchDestinations();
  }, []);

  useEffect(() => {
    if (!form.image) {
      setPreview(null);
      return;
    }

    if (typeof form.image === 'string') {
      const url = API_BASE ? `${API_BASE}${form.image}` : form.image;
      setPreview(url);
      return;
    }

    try {
      const objectUrl = URL.createObjectURL(form.image);
      setPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } catch {
      setPreview(null);
    }
  }, [form.image]);

  const fetchDestinations = async () => {
    try {
      const res = await axios.get(ENDPOINT);
      setDestinations(res.data || []);
    } catch (err) {
      toast.error('Failed to fetch destinations');
    }
  };

  const openModal = (editItem = null) => {
    if (editItem) {
      setForm({
        name: editItem.title || '',
        category: editItem.category || '',
        description: editItem.description || '',
        image: editItem.media_path || null,
      });
      setEditingId(editItem.id);
    } else {
      setForm({ name: '', category: '', description: '', image: null });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm({ name: '', category: '', description: '', image: null });
    setEditingId(null);
    setPreview(null);
    setIsDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'image') {
      if (files?.[0]) {
        setForm((prev) => ({ ...prev, image: files[0] }));
      } else {
        setForm((prev) => ({ ...prev, image: null }));
      }
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.category) {
      return toast.warning('Name and category are required');
    }

    const data = new FormData();
    data.append('title', form.name);
    data.append('name', form.name);
    data.append('category', form.category);
    data.append('description', form.description || '');

    if (form.image && typeof form.image !== 'string') {
      data.append('image', form.image);
    }

    try {
      if (editingId) {
        await axios.put(`${ENDPOINT}/${editingId}`, data);
        toast.success('Destination updated!');
      } else {
        await axios.post(ENDPOINT, data);
        toast.success('Destination added!');
      }
      closeModal();
      fetchDestinations();
    } catch (err) {
      toast.error('Saving failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this destination?')) return;
    try {
      await axios.delete(`${ENDPOINT}/${id}`);
      toast.success('Destination deleted');
      fetchDestinations();
    } catch (err) {
      toast.error('Delete failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const buildImageSrc = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return API_BASE ? `${API_BASE}${path}` : path;
  };

  return (
    <div className="dm-container">
      <ToastContainer />

      <div className="dm-header">
        <h2>Destination Manager</h2>
        <button className="dm-btn-add" onClick={() => openModal()}>Add Destination</button>
      </div>

      <div className="dm-grid">
        {destinations.length === 0 && <p>No destinations yet.</p>}
        {destinations.map((dest) => (
          <div key={dest.id} className="dm-card">
            <img
              src={buildImageSrc(dest.media_path)}
              alt={dest.title}
              className="dm-image"
            />
            <div className="dm-content">
              <strong>{dest.title}</strong>
              <small>{dest.category}</small>
              <div className="dm-actions">
                <button onClick={() => openModal(dest)}>Edit</button>
                <button onClick={() => handleDelete(dest.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="dm-modal-backdrop" onClick={closeModal}>
          <div className="dm-modal" onClick={(e) => e.stopPropagation()}>
            <form className="dm-form" onSubmit={handleSubmit}>
              <h3>{editingId ? 'Edit Destination' : 'Add Destination'}</h3>

              <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Name" />
              
              <select name="category" value={form.category} onChange={handleChange}>
                <option value="">Select Category</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>

              <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" />

              <input type="file" name="image" ref={fileInputRef} onChange={handleChange} accept="image/*" />

              {preview && <img src={preview} className="dm-preview-img" />}

              <div className="dm-form-actions">
                <button type="submit">Save</button>
                <button type="button" onClick={closeModal}>Cancel</button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default DestinationManager;
