// frontend component: UsersPage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

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
    contact_number: "",
    address: "",
    profile_image: null,
    profile_image_preview: "",
  });

  const [formError, setFormError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // NEW: Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    firstname: "",
    lastname: "",
  });
  const [inviteError, setInviteError] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  // NEW: Search & filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Always use correct token for admin actions
  const getAdminToken = () =>
    localStorage.getItem("adminToken") || localStorage.getItem("token") || null;

  // =========================================
  // FETCH USERS (PAGINATED)
  // =========================================
const fetchUsers = async (page = 1) => {
  setLoading(true);
  setError(null);

  const token = getAdminToken();
  if (!token) {
    setError("Admin session expired. Please log in again.");
    setLoading(false);
    return;
  }

  try {
    const res = await axios.get(
      `${API_BASE}/api/admin/users/list`, 
      {
        params: {
          page,
          limit: 10,
          search: searchTerm,
          status: statusFilter,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const normalized = res.data.users.map((u) => ({
      ...u,
      profile_image: u.profile_image?.replace(/\\/g, "/"),
    }));

    setUsers(normalized);
    setCurrentPage(page);
    setTotalPages(Math.ceil(res.data.total / res.data.limit));
  } catch (err) {
    console.error("FETCH USERS ERROR:", err);
    setError("Unable to load users. Please log in again.");
  } finally {
    setLoading(false);
  }
};


// Initial load (page 1)
useEffect(() => {
  fetchUsers();
}, []);

// Re-fetch when search text OR status filter changes
useEffect(() => {
  const delay = setTimeout(() => {
    fetchUsers(1);
  }, 300);

  return () => clearTimeout(delay);
}, [searchTerm, statusFilter]);

  const openUserDetailsView = (user) => {
    setSelectedUser(user);
    setShowUserDetailsView(true);
    setShowUpdateForm(false);
  };

  const openUpdateForm = () => {
    if (selectedUser) {
      setUserDetails({
        id: selectedUser.id,
        username: selectedUser.username,
        firstname: selectedUser.firstname,
        lastname: selectedUser.lastname,
        email: selectedUser.email,
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

  const handleDetailsChange = (e) => {
    const { name, value } = e.target;
    setUserDetails((prev) => ({
      ...prev,
      [name]: value,
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
      setFormError("All required fields must be filled.");
      return false;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setFormError("Invalid email format.");
      return false;
    }

    return true;
  };

  // =========================================
  // SAVE (CREATE or UPDATE) - manual add / edit
  // =========================================
  const handleSaveUser = async () => {
    if (!validateDetails()) return;

    const token = getAdminToken();
    if (!token) {
      setFormError("Admin session expired. Please log in again.");
      return;
    }

    try {
      const formData = new FormData();
      Object.entries(userDetails).forEach(([key, value]) => {
        if (key !== "profile_image_preview") {
          formData.append(key, value ?? "");
        }
      });

      // Keep existing image if no new upload
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
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );
      } else {
        // CREATE (manual add)
        await axios.post(`${API_BASE}/api/admin/users/user`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
      }

      setShowUpdateForm(false);
      setSelectedUser(null);

      await fetchUsers(currentPage);
    } catch (err) {
      console.error("SAVE USER ERROR:", err);
      setFormError(err.response?.data?.message || "Failed to save user.");
    }
  };

  // =========================================
  // DELETE USER
  // =========================================
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    const token = getAdminToken();
    if (!token) {
      alert("Admin session expired. Please log in again.");
      return;
    }

    try {
      await axios.delete(
        `${API_BASE}/api/admin/users/user/${selectedUser.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setShowUserDetailsView(false);
      setSelectedUser(null);
      fetchUsers(currentPage);
    } catch (err) {
      console.error("DELETE USER ERROR:", err);
      alert("Failed to delete user.");
    }
  };

  const closeForms = () => {
    setShowUserDetailsView(false);
    setShowUpdateForm(false);
    setSelectedUser(null);
    setFormError(null);
  };

  // =========================================
  // INVITE USER FLOW
  // =========================================
  const sendInvite = async () => {
    setInviteError(null);

    if (!inviteForm.email.trim()) {
      setInviteError("Email is required.");
      return;
    }

    const token = getAdminToken();
    if (!token) {
      setInviteError("Admin session expired. Please log in again.");
      return;
    }

    setInviteLoading(true);
    try {
await axios.post(
  `${API_BASE}/api/admin/users/invite`,
  { email: inviteForm.email },
  {
    headers: { Authorization: `Bearer ${token}` },
  }
);


      alert("Invitation sent! The user will receive an email with a link and QR code.");
      setShowInviteModal(false);
      setInviteForm({ email: ""});

      // Refresh list to show new pending user
      fetchUsers(currentPage);
    } catch (err) {
      console.error("INVITE USER ERROR:", err);
      setInviteError(err.response?.data?.message || "Failed to send invitation.");
    } finally {
      setInviteLoading(false);
    }
  };

  // =========================================
  // FILTERED USERS (client-side search & filter)
  // =========================================
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase().trim();

    const matchesSearch =
      term === "" ||
      (u.username && u.username.toLowerCase().includes(term)) ||
      (u.firstname && u.firstname.toLowerCase().includes(term)) ||
      (u.lastname && u.lastname.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term));

    const matchesStatus =
      statusFilter === "all" ||
      (u.status && u.status.toLowerCase() === statusFilter.toLowerCase());

    return matchesSearch && matchesStatus;
  });

  // ======================================================
  // RENDER
  // ======================================================
  return (
    <div className="users-page-container">
      <h2 className="users-page-title">Users Management</h2>

      {loading && <p>Loading users...</p>}
      {error && <p className="users-page-error">{error}</p>}

      {/* MAIN LIST VIEW */}
      {!loading && !showUserDetailsView && !showUpdateForm && (
        <>
          <div className="users-page-topbar">
            <button
              className="users-page-add-btn"
              onClick={() => {
                setInviteForm({ email: ""});
                setInviteError(null);
                setShowInviteModal(true);
              }}
            >
              + Invite User
            </button>

            <div className="users-page-filters">
              <input
                type="text"
                className="users-page-search"
                placeholder="Search by username, name, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="users-page-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>

          <table className="users-page-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>First</th>
                <th>Last</th>
                <th>Email</th>
                <th>Contact</th>
                <th>Address</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center" }}>
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="users-page-row"
                    onClick={() => openUserDetailsView(u)}
                  >
                    <td>{u.username}</td>
                    <td>{u.firstname}</td>
                    <td>{u.lastname}</td>
                    <td>{u.email}</td>
                    <td>{u.contact_number || "N/A"}</td>
                    <td>{u.address || "N/A"}</td>
                    <td>
                      <span
                        className={`users-page-status-badge ${
                          (u.status || "").toLowerCase()
                        }`}
                      >
                        {u.status || "N/A"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* PAGINATION (server-side, current page only filtered on client) */}
          <div className="users-page-pagination">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => fetchUsers(num)}
                disabled={num === currentPage}
              >
                {num}
              </button>
            ))}
          </div>
        </>
      )}

      {/* USER DETAILS MODAL */}
      {showUserDetailsView && selectedUser && (
        <div className="users-page-modal-overlay">
          <div className="users-page-modal">
            <h3>User Details</h3>

            <div style={{ display: "flex", gap: 24 }}>
              <div style={{ flex: 1 }}>
                <p><strong>Username:</strong> {selectedUser.username}</p>
                <p><strong>First:</strong> {selectedUser.firstname}</p>
                <p><strong>Last:</strong> {selectedUser.lastname}</p>
                <p><strong>Email:</strong> {selectedUser.email}</p>
                <p><strong>Contact:</strong> {selectedUser.contact_number || "N/A"}</p>
                <p><strong>Address:</strong> {selectedUser.address || "N/A"}</p>
                <p><strong>Status:</strong> {selectedUser.status || "N/A"}</p>

                <div className="users-page-btn-group">
                  <button onClick={openUpdateForm}>Edit</button>
                  <button className="delete" onClick={handleDeleteUser}>Delete</button>
                  <button className="cancel" onClick={closeForms}>Close</button>
                </div>
              </div>

              <div className="users-page-image-box">
                {selectedUser.profile_image ? (
                  <img
                    className="users-page-profile-img"
                    src={`${API_BASE}/${selectedUser.profile_image}`}
                    alt="Profile"
                  />
                ) : (
                  <p>No Image</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT USER MODAL (manual) */}
      {showUpdateForm && (
        <div className="users-page-modal-overlay">
          <div className="users-page-modal">
            <h3>{userDetails.id ? "Edit User" : "Add User"}</h3>

            {formError && <p className="users-page-error">{formError}</p>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveUser();
              }}
              className="users-page-form"
            >
              <div className="users-page-form-left">
                <div className="users-page-form-group">
                  <label>Username:</label>
                  <input
                    type="text"
                    name="username"
                    value={userDetails.username}
                    onChange={handleDetailsChange}
                    required
                  />
                </div>

                <div className="users-page-form-group">
                  <label>First Name:</label>
                  <input
                    type="text"
                    name="firstname"
                    value={userDetails.firstname}
                    onChange={handleDetailsChange}
                    required
                  />
                </div>

                <div className="users-page-form-group">
                  <label>Last Name:</label>
                  <input
                    type="text"
                    name="lastname"
                    value={userDetails.lastname}
                    onChange={handleDetailsChange}
                    required
                  />
                </div>

                <div className="users-page-form-group">
                  <label>Email:</label>
                  <input
                    type="email"
                    name="email"
                    value={userDetails.email}
                    onChange={handleDetailsChange}
                    required
                  />
                </div>

                <div className="users-page-form-group">
                  <label>Contact Number:</label>
                  <input
                    type="text"
                    name="contact_number"
                    value={userDetails.contact_number}
                    onChange={handleDetailsChange}
                  />
                </div>

                <div className="users-page-form-group">
                  <label>Address:</label>
                  <input
                    type="text"
                    name="address"
                    value={userDetails.address}
                    onChange={handleDetailsChange}
                  />
                </div>

                <div className="users-page-form-group">
                  <label>Profile Image:</label>
                  <input type="file" accept="image/*" onChange={handleImageChange} />
                </div>

                <div className="users-page-btn-group">
                  <button type="submit">
                    {userDetails.id ? "Update" : "Add"}
                  </button>
                  <button
                    type="button"
                    className="cancel"
                    onClick={closeForms}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div className="users-page-image-box">
                {userDetails.profile_image_preview ? (
                  <img
                    src={userDetails.profile_image_preview}
                    className="users-page-profile-img"
                    alt="Preview"
                  />
                ) : (
                  <p>No Image</p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVITE USER MODAL */}
      {showInviteModal && (
        <div className="users-page-modal-overlay">
          <div className="users-page-modal">
            <h3>Invite User</h3>

            {inviteError && <p className="users-page-error">{inviteError}</p>}

            <div className="users-page-form">
              <div className="users-page-form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                />
              </div>


              <div className="users-page-btn-group">
                <button onClick={sendInvite} disabled={inviteLoading}>
                  {inviteLoading ? "Sending..." : "Send Invite"}
                </button>
                <button
                  className="cancel"
                  onClick={() => setShowInviteModal(false)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>

            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 12 }}>
              The invited user will receive an email with a verification link and a QR code
              they can scan to open the verification page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
