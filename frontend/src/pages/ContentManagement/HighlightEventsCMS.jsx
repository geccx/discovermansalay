// HighlightEventsCMS.jsx
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { DateRange } from 'react-date-range';
import { format } from 'date-fns';
import Cropper from 'react-easy-crop';
import getCroppedImg from './cropImageUtil'; // must return a Blob
import { toast } from 'react-toastify';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
// NOTE: router mount is /api/cms/highlight, actual resource path is /highlight-events
const API_ROOT = `${API_BASE_URL}/api/cms/highlight`;
const EVENTS_ENDPOINT = `${API_ROOT}/highlight-events`;
const UPLOADS_BASE = `${API_BASE_URL}/uploads/highlightevents/`;

const HighlightEventsCMS = () => {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date_range: { startDate: new Date(), endDate: new Date(), key: 'selection' },
    link: '',
    image: null,
  });
  const [editId, setEditId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedImageFile, setCroppedImageFile] = useState(null);

  const fetchEvents = async () => {
    try {
      const res = await axios.get(EVENTS_ENDPOINT);
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Failed to fetch events', e);
      toast.error('Failed to fetch events');
      setEvents([]);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const parseDateRangeString = (rangeStr) => {
    if (!rangeStr || typeof rangeStr !== 'string') {
      const now = new Date();
      return { startDate: now, endDate: now, key: 'selection' };
    }
    const parts = rangeStr.split(' - ').map((s) => s.trim());
    const nowYear = new Date().getFullYear();

    const parseCandidate = (s) => {
      const d = new Date(s);
      if (!isNaN(d)) return d;
      try {
        const d2 = new Date(`${s} ${nowYear}`);
        if (!isNaN(d2)) return d2;
      } catch {
        // ignored
      }
      return new Date();
    };

    const start = parseCandidate(parts[0]);
    const end = parts[1] ? parseCandidate(parts[1]) : start;
    return { startDate: start, endDate: end, key: 'selection' };
  };

  const openModal = (event = null) => {
    if (event) {
      setEditId(event.id ?? event._id ?? null);
      const dateRangeObj = parseDateRangeString(event.date_range);
      setForm({
        title: event.title ?? '',
        description: event.description ?? '',
        date_range: dateRangeObj,
        link: event.link ?? '',
        image: null,
      });

      if (event.image_url) {
        const remote = event.image_url.startsWith('http')
          ? event.image_url
          : `${UPLOADS_BASE}${event.image_url}`;
        setImageSrc(remote);
      } else {
        setImageSrc(null);
      }
      setCroppedImageFile(null);
    } else {
      setEditId(null);
      setForm({
        title: '',
        description: '',
        date_range: { startDate: new Date(), endDate: new Date(), key: 'selection' },
        link: '',
        image: null,
      });
      setImageSrc(null);
      setCroppedImageFile(null);
    }
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
    setForm({
      title: '',
      description: '',
      date_range: { startDate: new Date(), endDate: new Date(), key: 'selection' },
      link: '',
      image: null,
    });
    setImageSrc(null);
    setCroppedImageFile(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const readFile = (file) =>
    new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

  const handleChange = async (e) => {
    const { name, value, files } = e.target;
    if (name === 'image') {
      const file = files && files[0] ? files[0] : null;
      setForm((f) => ({ ...f, image: file }));
      if (file) {
        try {
          const imageDataUrl = await readFile(file);
          setImageSrc(imageDataUrl);
          setCroppedImageFile(null);
          setCrop({ x: 0, y: 0 });
          setZoom(1);
        } catch (err) {
          console.error('Error reading file', err);
          toast.error('Failed to read image file');
        }
      } else {
        setImageSrc(null);
        setCroppedImageFile(null);
      }
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const handleDateRangeChange = (ranges) => {
    const selection = ranges.selection;
    setForm((f) => ({ ...f, date_range: selection }));
  };

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const showCroppedImage = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) {
      toast.warn('No image or crop area selected');
      return;
    }
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!croppedBlob) throw new Error('crop util returned nothing');
      const filename = form.image ? form.image.name : `cropped_${Date.now()}.jpeg`;
      const croppedFile = new File([croppedBlob], filename, { type: croppedBlob.type || 'image/jpeg' });
      setCroppedImageFile(croppedFile);
      toast.success('Image cropped successfully');
    } catch (e) {
      console.error('Crop failed:', e);
      toast.error('Failed to crop image');
    }
  }, [croppedAreaPixels, imageSrc, form.image]);

  // revoke object URL created for preview of croppedImageFile
  useEffect(() => {
    let objectUrl;
    if (croppedImageFile) {
      objectUrl = URL.createObjectURL(croppedImageFile);
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [croppedImageFile]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim() || !form.description.trim() || !form.link.trim()) {
      toast.warn('Please fill in all required fields');
      return;
    }

    const imageToUpload = croppedImageFile || form.image;
    const formattedDateRange = `${format(form.date_range.startDate, 'MMM d')} - ${format(form.date_range.endDate, 'MMM d')}`;

    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('description', form.description);
    formData.append('date_range', formattedDateRange);
    formData.append('link', form.link);
    if (imageToUpload) formData.append('image', imageToUpload);

    try {
      if (editId) {
        // PUT to /highlight-events/:id
        await axios.put(`${EVENTS_ENDPOINT}/${editId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Event updated successfully');
      } else {
        // POST to /highlight-events
        await axios.post(EVENTS_ENDPOINT, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Event added successfully');
      }
      closeModal();
      fetchEvents();
    } catch (err) {
      console.error('Error saving event', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Error saving event';
      toast.error(msg);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Are you sure you want to delete this event?');
    if (!confirmed) return;

    try {
      // DELETE to /highlight-events/:id
      await axios.delete(`${EVENTS_ENDPOINT}/${id}`);
      toast.success('Event deleted successfully');
      fetchEvents();
    } catch (err) {
      console.error('Failed to delete event', err);
      toast.error('Failed to delete event');
    }
  };

  return (
    <div className="highlightcms-container">
      <h2 className="highlightcms-title">Manage Highlight Events</h2>
      <button className="highlightcms-add-btn" onClick={() => openModal()}>
        + Add New Event
      </button>

      <div className="highlightcms-event-list">
        {events.map((event) => (
          <div key={event.id ?? event._id} className="highlightcms-event-card">
            <img
              src={event.image_url ? (event.image_url.startsWith('http') ? event.image_url : `${UPLOADS_BASE}${event.image_url}`) : ''}
              alt={event.title}
              className="highlightcms-event-image"
              onError={(e) => {
                e.currentTarget.src = '';
              }}
            />
            <h3 className="highlightcms-event-title">{event.title}</h3>
            <p className="highlightcms-event-desc">{event.description}</p>
            <p className="highlightcms-event-date">{event.date_range}</p>
            <div className="highlightcms-event-actions">
              <button className="highlightcms-edit-btn" onClick={() => openModal(event)}>
                Edit
              </button>
              <button className="highlightcms-delete-btn" onClick={() => handleDelete(event.id ?? event._id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="highlightcms-modal-backdrop" onClick={closeModal}>
          <div
            className="highlightcms-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}
          >
            <form className="highlightcms-form" onSubmit={handleSubmit} encType="multipart/form-data" style={{ flex: 1 }}>
              <h3 className="highlightcms-form-title">{editId ? 'Edit Event' : 'Add New Event'}</h3>

              <label htmlFor="title" className="highlightcms-label">
                Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={form.title}
                onChange={handleChange}
                className="highlightcms-input"
                required
                placeholder="Enter event title"
              />

              <label htmlFor="description" className="highlightcms-label">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                className="highlightcms-textarea"
                required
                placeholder="Enter event description"
              />

              <label className="highlightcms-label">Date Range</label>
              <DateRange
                editableDateInputs={true}
                onChange={handleDateRangeChange}
                moveRangeOnFirstSelection={false}
                ranges={[form.date_range]}
                className="highlightcms-daterange-picker"
              />

              <label htmlFor="link" className="highlightcms-label">
                Link
              </label>
              <input
                type="url"
                id="link"
                name="link"
                value={form.link}
                onChange={handleChange}
                className="highlightcms-input"
                placeholder="Enter link URL"
                required
              />

              <div className="highlightcms-modal-footer" style={{ marginTop: '1rem' }}>
                <button type="submit" className="highlightcms-submit-btn">
                  {editId ? 'Update' : 'Add'} Event
                </button>
                <button type="button" onClick={closeModal} className="highlightcms-cancel-btn">
                  Cancel
                </button>
              </div>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 360 }}>
              <div className="highlightcms-image-preview" style={{ width: '100%', height: 240, position: 'relative', background: '#f6f6f6' }}>
                {imageSrc ? (
                  !croppedImageFile ? (
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                      <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={4 / 3}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                      />
                    </div>
                  ) : (
                    <img src={URL.createObjectURL(croppedImageFile)} alt="Cropped" className="highlightcms-preview-image" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                  )
                ) : (
                  <div className="highlightcms-preview-placeholder" style={{ padding: 12 }}>
                    No image selected
                  </div>
                )}
              </div>

              <label htmlFor="image" className="highlightcms-label custom-file-label" style={{ marginTop: '0.75rem', width: '100%', textAlign: 'center' }}>
                <div style={{ cursor: 'pointer' }}>
                  {form.image ? form.image.name : 'Choose Image'}
                  <input type="file" id="image" name="image" accept="image/*" onChange={handleChange} className="highlightcms-file-input" style={{ display: 'none' }} />
                </div>
              </label>

              <button type="button" onClick={showCroppedImage} className="highlightcms-crop-btn" disabled={!imageSrc} style={{ marginTop: '0.75rem', width: '100%' }}>
                Crop Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HighlightEventsCMS;
