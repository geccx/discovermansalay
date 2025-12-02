import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const HERO_API = `${API_BASE}/api/cms/hero`;
const UPLOADS_BASE = `${API_BASE}/uploads`;

const HeroCMS = () => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch hero data
  const fetchHero = async () => {
    try {
      const res = await fetch(HERO_API);
      if (!res.ok) throw new Error('Failed to fetch hero data');
      const data = await res.json();
      setTitle(data.title || '');
      setSubtitle(data.subtitle || '');
      if (data.media_path) {
        setPreview(`${UPLOADS_BASE}${data.media_path}?t=${Date.now()}`);
        setMediaType(data.media_type);
      } else {
        setPreview('');
        setMediaType('');
      }
    } catch (err) {
      toast.error('Failed to load hero data.');
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHero();
  }, []);

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (mediaFile) URL.revokeObjectURL(preview);
    };
  }, [mediaFile, preview]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) setMediaType('image');
    else if (file.type.startsWith('video/')) setMediaType('video');
    else {
      toast.warn('Only image or video files are allowed.');
      return;
    }

    if (preview && mediaFile) URL.revokeObjectURL(preview);

    setMediaFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !subtitle.trim()) {
      toast.warn('Please provide both title and subtitle.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('subtitle', subtitle.trim());
    if (mediaFile) formData.append('media', mediaFile);

    setLoading(true);
    try {
      const res = await fetch(HERO_API, {
        method: 'PATCH',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        toast.success('Hero content updated successfully!');
        setMediaFile(null);
        fetchHero(); // ✅ Refresh CMS preview immediately
      } else {
        toast.error(data.message || 'Failed to update hero content.');
      }
    } catch (err) {
      toast.error('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="herocms-container">
      <h2>Background Management</h2>
      <form onSubmit={handleSubmit} className="herocms-form" encType="multipart/form-data">
        <label htmlFor="title">Title</label>
        <textarea
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={3}
          required
        />
        <label htmlFor="subtitle">Subtitle</label>
        <textarea
          id="subtitle"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          rows={3}
          required
        />
        {preview && (
          <div className="herocms-media-preview">
            <p>Current Background Preview:</p>
            {mediaType === 'video' ? (
              <video src={preview} controls style={{ maxWidth: '100%', borderRadius: '8px' }} />
            ) : (
              <img src={preview} alt="Background preview" style={{ maxWidth: '100%', borderRadius: '8px' }} />
            )}
          </div>
        )}
        <input
          type="file"
          id="media"
          accept="image/*,video/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <label htmlFor="media" className="custom-file-button" tabIndex={0} role="button">
          Choose Background Image or Video
        </label>
        {mediaFile && <p className="selected-file">Selected file: {mediaFile.name}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

export default HeroCMS;
