import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserDetailsView, setShowUserDetailsView] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  const [userDetails, setUserDetails] = useState({
    id: null,
    username: "",
    firstname: "",
    lastname: "",
    email: "",
    role: "user",
    contact_number: "",
    address: "",
    profile_image: null,         // File object
    profile_image_preview: "",   // URL preview
  });

  const [formError, setFormError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // -------------------------------------------------------
  // FETCH USERS
  // -------------------------------------------------------
  const fetchUsers = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `${API_BASE}/api/admin/users/list?page=${page}&limit=10`
      );

      const normalized = res.data.users.map(u => ({
        ...u,
        profile_image: u.profile_image?.replace(/\\/g, "/")
      }));

      setUsers(normalized);
      setTotalPages(Math.ceil(res.data.total / res.data.limit));
      setCurrentPage(page);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // -------------------------------------------------------
  // OPEN USER DETAILS
  // -------------------------------------------------------
  const openUserDetailsView = (user) => {
    setSelectedUser(user);
    setShowUserDetailsView(true);
    setShowUpdateForm(false);
  };

  // -------------------------------------------------------
  // OPEN UPDATE FORM (OR ADD USER FORM)
  // -------------------------------------------------------
  const openUpdateForm = () => {
    if (selectedUser) {
      setUserDetails({
        id: selectedUser.id,
        username: selectedUser.username,
        firstname: selectedUser.firstname,
        lastname: selectedUser.lastname,
        email: selectedUser.email,
        role: selectedUser.role || "user",
        contact_number: selectedUser.contact_number || "",
        address: selectedUser.address || "",
        profile_image: null,
        profile_image_preview: selectedUser.profile_image
          ? `${API_BASE}/${selectedUser.profile_image}`
          : "",
      });
    } else {
      setUserDetails({
        id: null,
        username: "",
        firstname: "",
        lastname: "",
        email: "",
        role: "user",
        contact_number: "",
        address: "",
        profile_image: null,
        profile_image_preview: "",
      });
    }

    setShowUpdateForm(true);
    setShowUserDetailsView(false);
    setFormError(null);
  };

  // -------------------------------------------------------
  // FORM CHANGE HANDLERS
  // -------------------------------------------------------
  const handleDetailsChange = (e) => {
    setUserDetails((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUserDetails((prev) => ({
      ...prev,
      profile_image: file,
      profile_image_preview: URL.createObjectURL(file),
    }));
  };

  const validateDetails = () => {
    const { username, firstname, lastname, email } = userDetails;

    if (!username.trim() || !firstname.trim() || !lastname.trim() || !email.trim()) {
      setFormError("All fields except contact/address/image are required.");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setFormError("Invalid email format.");
      return false;
    }

    return true;
  };

  // -------------------------------------------------------
  // SUBMIT USER (CREATE / UPDATE)
  // -------------------------------------------------------
  const handleUpdateDetails = async () => {
    if (!validateDetails()) return;

    try {
      const formData = new FormData();

      Object.entries(userDetails).forEach(([key, value]) => {
        if (key === "profile_image_preview") return;
        formData.append(key, value || "");
      });

      if (!userDetails.profile_image && userDetails.profile_image_preview) {
        formData.append(
          "existing_image",
          userDetails.profile_image_preview.replace(`${API_BASE}/`, "")
        );
      }

      if (userDetails.id) {
        // UPDATE
        await axios.put(
          `${API_BASE}/api/admin/users/user/${userDetails.id}`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
      } else {
        // CREATE
        await axios.post(
          `${API_BASE}/api/admin/users/user`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
      }

      await fetchUsers(currentPage);
      setShowUpdateForm(false);
      setSelectedUser(null);
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save user");
    }
  };

  // -------------------------------------------------------
  // DELETE USER
  // -------------------------------------------------------
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await axios.delete(`${API_BASE}/api/admin/users/user/${selectedUser.id}`);
      await fetchUsers(currentPage);
      setShowUserDetailsView(false);
      setSelectedUser(null);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete user");
    }
  };

  // -------------------------------------------------------
  // CLOSE FORMS
  // -------------------------------------------------------
  const closeForms = () => {
    setShowUserDetailsView(false);
    setShowUpdateForm(false);
    setSelectedUser(null);
    setFormError(null);
  };

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------
  return (
    <div>
      <h2>Users Management</h2>

      {loading && <p>Loading users...</p>}
      {error && <p className="error">{error}</p>}

      {/* LIST VIEW */}
      {!loading && !showUserDetailsView && !showUpdateForm && (
        <>
          <button
            className="add-user-btn"
            onClick={() => {
              setSelectedUser(null);
              openUpdateForm();
            }}
          >
            Add New User
          </button>

          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>First</th>
                <th>Last</th>
                <th>Email</th>
                <th>Contact</th>
                <th>Address</th>
              </tr>
            </thead>

            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center" }}>
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} onClick={() => openUserDetailsView(u)} style={{ cursor: "pointer" }}>
                    <td>{u.username}</td>
                    <td>{u.firstname}</td>
                    <td>{u.lastname}</td>
                    <td>{u.email}</td>
                    <td>{u.contact_number || "N/A"}</td>
                    <td>{u.address || "N/A"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="pagination">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => fetchUsers(pageNum)}
                disabled={currentPage === pageNum}
              >
                {pageNum}
              </button>
            ))}
          </div>
        </>
      )}

      {/* DETAILS VIEW */}
      {showUserDetailsView && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-form">
            <h3>User Details</h3>

            <div style={{ display: "flex", gap: "20px" }}>
              <div style={{ flex: 1 }}>
                <p><strong>Username:</strong> {selectedUser.username}</p>
                <p><strong>First:</strong> {selectedUser.firstname}</p>
                <p><strong>Last:</strong> {selectedUser.lastname}</p>
                <p><strong>Email:</strong> {selectedUser.email}</p>
                <p><strong>Contact:</strong> {selectedUser.contact_number || "N/A"}</p>
                <p><strong>Address:</strong> {selectedUser.address || "N/A"}</p>

                <div className="button-group" style={{ marginTop: 20 }}>
                  <button onClick={openUpdateForm}>Edit</button>
                  <button className="delete-btn" onClick={handleDeleteUser}>Delete</button>
                  <button className="cancel-btn" onClick={closeForms}>Close</button>
                </div>
              </div>

              <div style={{ flexBasis: "160px" }}>
                {selectedUser.profile_image ? (
                  <img
                    src={`${API_BASE}/${selectedUser.profile_image}`}
                    className="profile-large"
                    alt="Profile"
                  />
                ) : (
                  <p style={{ color: "#888" }}>No image</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE FORM */}
      {showUpdateForm && (
        <div className="modal-overlay">
          <div className="modal-form">
            <h3>{userDetails.id ? "Edit User" : "Add New User"}</h3>

            {formError && <p className="error">{formError}</p>}

            <form onSubmit={(e) => { e.preventDefault(); handleUpdateDetails(); }} style={{ display: "flex", gap: "20px" }}>
              <div style={{ flex: 1 }}>
                <div className="form-group">
                  <label>Username:</label>
                  <input type="text" required name="username" value={userDetails.username} onChange={handleDetailsChange} />
                </div>

                <div className="form-group">
                  <label>First Name:</label>
                  <input type="text" required name="firstname" value={userDetails.firstname} onChange={handleDetailsChange} />
                </div>

                <div className="form-group">
                  <label>Last Name:</label>
                  <input type="text" required name="lastname" value={userDetails.lastname} onChange={handleDetailsChange} />
                </div>

                <div className="form-group">
                  <label>Email:</label>
                  <input type="email" required name="email" value={userDetails.email} onChange={handleDetailsChange} />
                </div>

                <div className="form-group">
                  <label>Contact Number:</label>
                  <input type="text" name="contact_number" value={userDetails.contact_number} onChange={handleDetailsChange} />
                </div>

                <div className="form-group">
                  <label>Address:</label>
                  <input type="text" name="address" value={userDetails.address} onChange={handleDetailsChange} />
                </div>

                <div className="form-group">
                  <label>Profile Image:</label>
                  <input type="file" accept="image/*" onChange={handleImageChange} />
                </div>

                <div className="button-group">
                  <button type="submit">{userDetails.id ? "Update" : "Add"}</button>
                  <button type="button" className="cancel-btn" onClick={closeForms}>
                    Cancel
                  </button>
                </div>
              </div>

              <div style={{ width: "170px" }}>
                {userDetails.profile_image_preview ? (
                  <img src={userDetails.profile_image_preview} className="profile-large" alt="Preview" />
                ) : (
                  <p>No image</p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
