import React, { useEffect, useState } from "react";
import axios from "axios";
import "./styles/AccommodationsCMS.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const CMS_ENDPOINT = `${API_BASE}/api/cms/accommodation`;

const AccommodationsCMS = () => {
  const [accommodations, setAccommodations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    city: "",
    email: "",
    contact: "",
    media_path: null,
  });

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      city: "",
      email: "",
      contact: "",
      media_path: null,
    });
    setEditing(null);
  };

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({
        title: item.title,
        description: item.description,
        city: item.city,
        email: item.email,
        contact: item.contact,
        media_path: null,
      });
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const fetchAccommodations = async () => {
    try {
      setLoading(true);
      const res = await axios.get(CMS_ENDPOINT);
      setAccommodations(res.data);
    } catch (err) {
      console.error("Fetch error:", err);
      alert("Failed to load accommodations.");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (e) => {
    setForm({ ...form, media_path: e.target.files[0] });
  };

  const saveItem = async () => {
    if (!form.title || !form.description) {
      alert("Title and Description are required");
      return;
    }

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("description", form.description);
    fd.append("city", form.city);
    fd.append("email", form.email);
    fd.append("contact", form.contact);
    fd.append("category", "Accommodations");

    if (form.media_path) fd.append("media_path", form.media_path);

    try {
      if (editing) {
        await axios.put(`${CMS_ENDPOINT}/${editing.id}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        alert("Accommodation updated.");
      } else {
        await axios.post(CMS_ENDPOINT, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        alert("Accommodation added.");
      }

      closeModal();
      fetchAccommodations();
    } catch (err) {
      console.error(err);
      alert("Saving failed.");
    }
  };

  const deleteItem = async (id) => {
    if (!confirm("Delete this accommodation?")) return;

    try {
      await axios.delete(`${CMS_ENDPOINT}/${id}`);
      fetchAccommodations();
      alert("Deleted successfully.");
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    }
  };

  useEffect(() => {
    fetchAccommodations();
  }, []);

  return (
    <div className="accomcms-container">
      <h1 className="accomcms-title">Accommodations Content Management</h1>

      <button className="accomcms-add-btn" onClick={() => openModal()}>
        + Add Accommodation
      </button>

      {loading ? (
        <p>Loading...</p>
      ) : accommodations.length > 0 ? (
        <table className="accomcms-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Title</th>
              <th>City</th>
              <th>Manager Email</th>
              <th>Manager Contact</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {accommodations.map((item) => (
              <tr key={item.id}>
                <td>
                  <img
                    src={`${API_BASE}${item.media_path}`}
                    className="accomcms-thumb"
                    alt=""
                  />
                </td>
                <td>{item.title}</td>
                <td>{item.city}</td>
                <td>{item.email}</td>
                <td>{item.contact}</td>
                <td>
                  <button
                    className="accomcms-edit"
                    onClick={() => openModal(item)}
                  >
                    Edit
                  </button>
                  <button
                    className="accomcms-delete"
                    onClick={() => deleteItem(item.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No accommodations found.</p>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="accomcms-modal-overlay">
          <div className="accomcms-modal">
            <h2>{editing ? "Edit Accommodation" : "Add Accommodation"}</h2>

            <input
              className="accomcms-input"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />

            <textarea
              className="accomcms-textarea"
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />

            <input
              className="accomcms-input"
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />

            <input
              className="accomcms-input"
              placeholder="Manager Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <input
              className="accomcms-input"
              placeholder="Manager Contact Number"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />

            <label className="accomcms-file-label">Image Upload</label>
            <input
              type="file"
              accept="image/*"
              className="accomcms-file"
              onChange={handleFile}
            />

            <div className="accomcms-modal-actions">
              <button className="cancel-btn" onClick={closeModal}>
                Cancel
              </button>
              <button className="save-btn" onClick={saveItem}>
                {editing ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccommodationsCMS;
