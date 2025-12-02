import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const API_URL = `${API_BASE}/api/cms/navbar`;
const UPLOADS_BASE = `${API_BASE}/uploads/`;

const NavbarCMS = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => {
        if (data.logo) setPreview(`${UPLOADS_BASE}${data.logo}`);
      })
      .catch(err => {
        console.error('Error fetching logo:', err);
        toast.error('Error loading current logo');
      });
  }, []);

  const onFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.warn('Please select a file before uploading');

    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await fetch(`${API_URL}/logo`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Logo updated successfully!');
        setPreview(`${UPLOADS_BASE}${data.logo}`);
        setFile(null);
      } else {
        toast.error(data.error || 'Failed to update logo');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Error uploading logo');
    }
  };

  return (
    <div className="navbar-container">
      <h2 className="navbar-title">Change Logo</h2>
      <form className="navbar-form" onSubmit={onSubmit}>
        <div className="navbar-preview-container">
          <label className="navbar-label">Current Logo Preview:</label>
          {preview ? (
            <img src={preview} alt="Logo Preview" className="navbar-logo-preview" />
          ) : (
            <p className="navbar-no-logo">No logo available</p>
          )}
        </div>

        <div className="navbar-input-group">
          <input
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="navbar-file-input"
          />
        </div>

        <button type="submit" className="navbar-submit-btn">
          Upload New Logo
        </button>
      </form>
    </div>
  );
};

export default NavbarCMS;
