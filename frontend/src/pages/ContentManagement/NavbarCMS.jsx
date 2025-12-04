import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/';
const API_URL = `${API_BASE}/api/cms/navbar`;
const UPLOADS_BASE = `${API_BASE}/uploads/`;

const NavbarCMS = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');

  // ------------------------------------------------------------
  // Fetch current logo from backend (navbar table)
  // ------------------------------------------------------------
  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => {
        if (data.logo) {
          setPreview(`${UPLOADS_BASE}${data.logo}`);
        }
      })
      .catch(err => {
        console.error('Error fetching logo:', err);
        toast.error('Error loading current logo');
      });
  }, []);

  // ------------------------------------------------------------
  // Handle image selection preview
  // ------------------------------------------------------------
  const onFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile)); // Instant preview
    }
  };

  // ------------------------------------------------------------
  // Upload new logo
  // ------------------------------------------------------------
  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.warn("Please select a file.");

    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await fetch(`${API_URL}/logo`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Logo updated successfully!");

        // The backend returns: { logo: "logo/logo.png" }
        setPreview(`${UPLOADS_BASE}${data.logo}`);
        setFile(null);
      } else {
        toast.error(data.error || "Failed to update logo.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Error uploading logo.");
    }
  };

  return (
    <div className="navbar-container">
      <h2 className="navbar-title">Change Logo</h2>

      <form className="navbar-form" onSubmit={onSubmit}>
        
        {/* Logo Preview */}
        <div className="navbar-preview-container">
          <label className="navbar-label">Current Logo Preview:</label>
          {preview ? (
            <img
              src={preview}
              alt="Logo Preview"
              className="navbar-logo-preview"
            />
          ) : (
            <p className="navbar-no-logo">No logo available</p>
          )}
        </div>

        {/* File Input */}
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
