// ExperienceCMS.jsx
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const API_ROOT = `${API_BASE_URL}/api/cms/experience`;
const UPLOADS_BASE = `${API_BASE_URL}/uploads`;

const ExperienceCMS = () => {
  const [cards, setCards] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', image: null, link: '' });
  const [showForm, setShowForm] = useState(false);
  const MAX_SLOTS = 6;

  const fetchData = async () => {
    try {
      const res = await fetch(API_ROOT);
      const data = await res.json();
      setCards(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch experience cards:', error);
      toast.error('Failed to load experience cards');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'image' ? (files && files[0] ? files[0] : null) : value,
    }));
  };

  const handleEdit = (card) => {
    setEditingId(card.id);
    setForm({ title: card.title || '', image: null, link: card.link || '' });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this card?');
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_ROOT}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Card deleted successfully');
        fetchData();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || 'Failed to delete the card');
      }
    } catch (error) {
      toast.error('Error deleting card');
      console.error(error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) {
      toast.warn('Title is required');
      return;
    }
    if (!form.link.trim()) {
      toast.warn('Link is required');
      return;
    }
    // When adding, image required; when editing, optional
    if (!editingId && !form.image) {
      toast.warn('Image is required when adding a card');
      return;
    }

    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('link', form.link);
    if (form.image) formData.append('image', form.image);

    const method = editingId ? 'PUT' : 'POST';
    const endpoint = editingId ? `${API_ROOT}/${editingId}` : API_ROOT;

    try {
      const res = await fetch(endpoint, {
        method,
        body: formData,
      });

      if (res.ok) {
        toast.success(editingId ? 'Card updated successfully' : 'Card added successfully');
        fetchData();
        setEditingId(null);
        setForm({ title: '', image: null, link: '' });
        setShowForm(false);
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || 'Failed to save the card');
      }
    } catch (error) {
      toast.error('Error saving card');
      console.error(error);
    }
  };

  const handleAddNew = () => {
    setEditingId(null);
    setForm({ title: '', link: '', image: null });
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({ title: '', link: '', image: null });
    setShowForm(false);
  };

  const imgSrc = (card) => {
    if (!card || !card.image_path) return '';
    return card.image_path.startsWith('http') ? card.image_path : `${UPLOADS_BASE}/${card.image_path}`;
  };

  return (
    <div className="experiencecms-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="experiencecms-title">Manage Experience Cards</h2>
        {!showForm && cards.length < MAX_SLOTS && (
          <button className="experiencecms-add-btn" onClick={handleAddNew}>
            Add New Card
          </button>
        )}
      </div>

      <div className="experiencecms-card-list">
        {[...Array(MAX_SLOTS)].map((_, i) => {
          const card = cards[i];
          return card ? (
            <div key={card.id} className="experiencecms-card">
              <img
                src={imgSrc(card)}
                alt={card.title}
                className="experiencecms-image"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="experiencecms-card-title">{card.title}</span>
              {card.link && (
                <a href={card.link} target="_blank" rel="noreferrer" className="experiencecms-link">
                  Visit Link
                </a>
              )}
              <div className="experiencecms-card-actions">
                <button className="experiencecms-edit-btn" onClick={() => handleEdit(card)}>
                  Edit
                </button>
                <button className="experiencecms-delete-btn" onClick={() => handleDelete(card.id)}>
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div key={i} className="experiencecms-card empty">
              Empty slot {i + 1}
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="experiencecms-modal-overlay">
          <div className="experiencecms-modal">
            <form onSubmit={handleSubmit} className="experiencecms-form">
              <h3 className="experiencecms-form-title">{editingId ? 'Edit Card' : 'Add New Card'}</h3>

              <input
                type="text"
                name="title"
                className="experiencecms-input"
                value={form.title}
                onChange={handleChange}
                placeholder="Card Title"
                required
              />

              <input
                type="text"
                name="link"
                className="experiencecms-input"
                value={form.link}
                onChange={handleChange}
                placeholder="Card Link (https://example.com)"
                required
              />

              <input
                type="file"
                name="image"
                className="experiencecms-input"
                accept="image/*"
                onChange={handleChange}
                // required when adding; optional when editing
                required={!editingId}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="submit" className="experiencecms-submit-btn">
                  {editingId ? 'Update' : 'Add'}
                </button>
                <button type="button" onClick={handleCancel} className="experiencecms-cancel-btn">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExperienceCMS;
