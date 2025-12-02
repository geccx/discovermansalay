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

  // If it's a string, use it directly (already uploaded path)
  if (typeof form.image === 'string') {
    const url = API_BASE ? `${API_BASE}${form.image}` : form.image;
    setPreview(url);
    return;
  }

  // If it's a File object, safely create a preview URL
  try {
    const objectUrl = URL.createObjectURL(form.image);
    setPreview(objectUrl);

    return () => {
      // Cleanup (revoke preview URL when form.image changes or component unmounts)
      URL.revokeObjectURL(objectUrl);
    };
  } catch (error) {
    console.error('Failed to create image preview:', error);
    setPreview(null);
  }
}, [form.image]);


  const fetchDestinations = async () => {
    try {
      const res = await axios.get(ENDPOINT);
      // Expecting an array; if backend wraps with { data } adapt accordingly
      setDestinations(res.data || []);
    } catch (err) {
      console.error('fetchDestinations error:', err);
      toast.error('Failed to fetch destinations');
    }
  };

  const openModal = (editItem = null) => {
    if (editItem) {
      setForm({
        name: editItem.name || '',
        category: editItem.category || '',
        description: editItem.description || '',
        image: editItem.image || null, // assume backend returns path like '/uploads/..' or full url
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
      if (files && files.length > 0) {
        setForm((prev) => ({ ...prev, image: files[0] }));
      } else {
        setForm((prev) => ({ ...prev, image: null }));
      }
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) setForm((prev) => ({ ...prev, image: f }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.category) {
      toast.warning('Name and category are required');
      return;
    }

    const data = new FormData();
    data.append('name', form.name);
    data.append('category', form.category);
    data.append('description', form.description || '');

    // Only append if it's a File (not a string path)
    if (form.image && typeof form.image !== 'string') {
      data.append('image', form.image);
    }

    try {
      if (editingId) {
        await axios.put(`${ENDPOINT}/${editingId}`, data);
        toast.success('Destination updated successfully!');
      } else {
        await axios.post(ENDPOINT, data);
        toast.success('Destination added successfully!');
      }

      closeModal();
      fetchDestinations();
    } catch (err) {
      console.error('save destination error:', err);
      // try to show a helpful message if backend returned JSON
      const msg = err?.response?.data?.message || err?.response?.data || err.message;
      toast.error(`Failed to save destination: ${msg}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this destination?')) return;
    try {
      await axios.delete(`${ENDPOINT}/${id}`);
      toast.success('Destination deleted');
      fetchDestinations();
    } catch (err) {
      console.error('delete destination error:', err);
      const msg = err?.response?.data?.message || err?.response?.data || err.message;
      toast.error(`Failed to delete destination: ${msg}`);
    }
  };

  const buildImageSrc = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    return API_BASE ? `${API_BASE}${imagePath}` : imagePath;
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
              src={buildImageSrc(dest.image)}
              alt={dest.name}
              className="dm-image"
              onError={(e) => { e.currentTarget.src = '/images/fallback.jpg'; }}
            />
            <div className="dm-content">
              <strong>{dest.name}</strong>
              <small>{dest.category}</small>
              <div className="dm-actions">
                <button className="dm-btn-edit" onClick={() => openModal(dest)}>Edit</button>
                <button className="dm-btn-delete" onClick={() => handleDelete(dest.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="dm-modal-backdrop" onClick={closeModal}>
          <div className="dm-modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit} className="dm-form">
              <h3>{editingId ? 'Edit Destination' : 'Add Destination'}</h3>

              <div className="dm-form-body">
                <div className="dm-form-left">
                  <input
                    type="text"
                    name="name"
                    placeholder="Name"
                    value={form.name}
                    onChange={handleChange}
                    required
                  />
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <textarea
                    name="description"
                    placeholder="Description"
                    value={form.description}
                    onChange={handleChange}
                  />

                  <div
                    className={`dm-dropzone ${isDragging ? 'active' : ''}`}
                    onClick={handleDropZoneClick}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    {form.image ? (typeof form.image === 'string' ? form.image.split('/').pop() : form.image.name) : 'Drag & drop or click to select image'}
                    <input
                      type="file"
                      name="image"
                      accept="image/*"
                      onChange={handleChange}
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                    />
                  </div>
                </div>

                {preview && (
                  <div className="dm-form-preview">
                    <img src={preview} alt="Preview" />
                  </div>
                )}
              </div>

              <div className="dm-form-actions">
                <button type="submit">{editingId ? 'Update' : 'Create'}</button>
                <button type="button" className="dm-btn-cancel" onClick={closeModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DestinationManager;
