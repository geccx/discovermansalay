import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { DateRange } from 'react-date-range';
import { format } from 'date-fns';
import Cropper from 'react-easy-crop';
import getCroppedImg from './cropImageUtil';
import { toast } from 'react-toastify';

import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_ROOT = `${API_BASE_URL}/api/cms/highlight`;
const EVENTS_ENDPOINT = `${API_ROOT}/highlight-events`;

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

  // Image cropper
  const [imageSrc, setImageSrc] = useState(null);
  const [croppedImageFile, setCroppedImageFile] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  /* ------------------------------------------
     Fetch Events
  ------------------------------------------ */
  const fetchEvents = async () => {
    try {
      const res = await axios.get(EVENTS_ENDPOINT);
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load events');
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  /* ------------------------------------------
     Handle Date Range
  ------------------------------------------ */
  const parseDateRangeString = (str) => {
    if (!str) return { startDate: new Date(), endDate: new Date(), key: 'selection' };

    const parts = str.split(' - ');
    const nowYear = new Date().getFullYear();

    const parse = (s) => {
      let d = new Date(s);
      if (!isNaN(d)) return d;
      d = new Date(`${s} ${nowYear}`);
      return !isNaN(d) ? d : new Date();
    };

    return {
      startDate: parse(parts[0]),
      endDate: parse(parts[1] || parts[0]),
      key: 'selection',
    };
  };

  /* ------------------------------------------
     Open Modal (Edit or Add)
  ------------------------------------------ */
  const openModal = (event = null) => {
    if (event) {
      setEditId(event.id);
      setForm({
        title: event.title,
        description: event.description,
        date_range: parseDateRangeString(event.category),
        link: event.link || '',
        image: null,
      });

      setImageSrc(event.media_path ? `${API_BASE_URL}/${event.media_path}` : null);
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
    setImageSrc(null);
    setCroppedImageFile(null);
    setForm({
      title: '',
      description: '',
      date_range: { startDate: new Date(), endDate: new Date(), key: 'selection' },
      link: '',
      image: null,
    });
  };

  /* ------------------------------------------
     Handle Form Inputs
  ------------------------------------------ */
  const readFile = (file) =>
    new Promise((resolve, reject) => {
      if (!file) resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

  const handleChange = async (e) => {
    const { name, value, files } = e.target;

    if (name === 'image') {
      const file = files?.[0] || null;
      setForm((prev) => ({ ...prev, image: file }));

      if (file) {
        try {
          const dataURL = await readFile(file);
          setImageSrc(dataURL);
          setCroppedImageFile(null);
        } catch {
          toast.error('Failed to read image');
        }
      }
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const onCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const showCroppedImage = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return toast.warn('No crop selected');

    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);

      const file = new File(
        [blob],
        form.image?.name || `cropped_${Date.now()}.jpg`,
        { type: blob.type }
      );

      setCroppedImageFile(file);
      toast.success('Image cropped successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to crop image');
    }
  }, [croppedAreaPixels, imageSrc, form.image]);

  /* ------------------------------------------
     Submit Form (POST or PUT)
  ------------------------------------------ */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const img = croppedImageFile || form.image;

    if (!form.title || !form.description || !form.link)
      return toast.warn('Fill all required fields');

    const formattedRange = `${format(form.date_range.startDate, 'MMM d')} - ${format(
      form.date_range.endDate,
      'MMM d'
    )}`;

    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('description', form.description);
    fd.append('date_range', formattedRange);
    fd.append('link', form.link);
    if (img) fd.append('image', img);

    try {
      if (editId) {
        await axios.put(`${EVENTS_ENDPOINT}/${editId}`, fd);
        toast.success('Event updated');
      } else {
        await axios.post(EVENTS_ENDPOINT, fd);
        toast.success('Event added');
      }

      closeModal();
      fetchEvents();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || 'Save failed');
    }
  };

  /* ------------------------------------------
     Delete Event
  ------------------------------------------ */
  const handleDelete = async (id) => {
    if (!confirm('Delete this event?')) return;

    try {
      await axios.delete(`${EVENTS_ENDPOINT}/${id}`);
      toast.success('Event deleted');
      fetchEvents();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete');
    }
  };

  /* ------------------------------------------
     Render Component
  ------------------------------------------ */
  return (
    <div className="highlightcms-container">
      <h2 className="highlightcms-title">Manage Highlight Events</h2>

      <button className="highlightcms-add-btn" onClick={() => openModal()}>
        + Add Highlight Event
      </button>

      <div className="highlightcms-event-list">
        {events.map((ev) => (
          <div key={ev.id} className="highlightcms-event-card">
            <img
              src={ev.media_path ? `${API_BASE_URL}/${ev.media_path}` : ''}
              alt={ev.title}
              className="highlightcms-event-image"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />

            <h3>{ev.title}</h3>
            <p>{ev.description}</p>
            <p className="highlight-date">{ev.category}</p>

            <div className="highlightcms-event-actions">
              <button onClick={() => openModal(ev)} className="highlightcms-edit-btn">
                Edit
              </button>
              <button onClick={() => handleDelete(ev.id)} className="highlightcms-delete-btn">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ------------------- MODAL ------------------- */}
      {showModal && (
        <div className="highlightcms-modal-backdrop" onClick={closeModal}>
          <div className="highlightcms-modal-content" onClick={(e) => e.stopPropagation()}>
            <form className="highlightcms-form" onSubmit={handleSubmit}>
              <h3>{editId ? 'Edit Event' : 'Add Event'}</h3>

              <label>Title</label>
              <input type="text" name="title" value={form.title} onChange={handleChange} required />

              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                required
              />

              <label>Date Range</label>
              <DateRange
                editableDateInputs={true}
                moveRangeOnFirstSelection={false}
                onChange={(ranges) =>
                  setForm((prev) => ({ ...prev, date_range: ranges.selection }))
                }
                ranges={[form.date_range]}
              />

              <label>Link</label>
              <input type="url" name="link" value={form.link} onChange={handleChange} required />

              <button type="submit" className="highlightcms-submit-btn">
                {editId ? 'Update' : 'Add'}
              </button>
              <button type="button" className="highlightcms-cancel-btn" onClick={closeModal}>
                Cancel
              </button>
            </form>

            {/* IMAGE CROP AREA */}
            <div className="highlightcms-crop-section">
              <div className="highlightcms-image-preview">
                {imageSrc ? (
                  !croppedImageFile ? (
                    <Cropper
                      image={imageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={4 / 3}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                  ) : (
                    <img
                      src={URL.createObjectURL(croppedImageFile)}
                      alt="Preview"
                      className="highlightcms-preview-image"
                    />
                  )
                ) : (
                  <div className="highlightcms-preview-placeholder">No Image Selected</div>
                )}
              </div>

              <label className="highlightcms-file-label">
                <div>
                  {form.image ? form.image.name : 'Choose Image'}
                  <input
                    type="file"
                    name="image"
                    accept="image/*"
                    onChange={handleChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </label>

              <button
                type="button"
                onClick={showCroppedImage}
                className="highlightcms-crop-btn"
                disabled={!imageSrc}
              >
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
