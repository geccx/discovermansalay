import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../../styles/usermanagement.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

/* ------------------------------
   AXIOS INSTANCE WITH AUTO-REFRESH
------------------------------ */
const api = axios.create({
  baseURL: API_BASE,
});

// Attach Authorization header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // refresh failed → logout
    if (original._retryRefresh) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("user");
      window.location.href = "/admin/login";
      return Promise.reject(err);
    }

    // attempt refresh once
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        const refreshRes = await axios.post(`${API_BASE}/api/admin/refresh`, {
          token: localStorage.getItem("admin_token"),
        });

        const newToken = refreshRes.data.token;
        localStorage.setItem("admin_token", newToken);

        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError) {
        original._retryRefresh = true;
        return api(original);
      }
    }

    return Promise.reject(err);
  }
);

/* ------------------------------
   COMPONENT
------------------------------ */
const AdminsPage = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [showAdminDetails, setShowAdminDetails] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [adminDetails, setAdminDetails] = useState({
    id: null,
    username: "",
    firstname: "",
    lastname: "",
    email: "",
    role: "",
    contact_number: "",
    address: "",
    profile_image: null,
    profile_image_preview: "",
  });

  const [passwords, setPasswords] = useState({
    new_password: "",
    confirm_password: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  /* ------------------------------
     FETCH ADMINS
  ------------------------------ */
  const fetchAdmins = async (page = 1, searchText = search, status = statusFilter) => {
    setLoading(true);

    try {
      const res = await api.get(
        `/api/admin/list?page=${page}&limit=10&search=${searchText}&status=${status}`
      );

      const list = res.data.users || [];

      const normalized = list.map((admin) => ({
        ...admin,
        profile_image: admin.profile_image?.replace(/\\/g, "/") || "",
      }));

      setAdmins(normalized);
      setTotalPages(Math.ceil(res.data.total / res.data.limit));
      setCurrentPage(page);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to fetch admins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins(1);
  }, []);

  /* ------------------------------
     DETAILS VIEW
  ------------------------------ */
  const openAdminDetailsView = (admin) => {
    setSelectedAdmin(admin);
    setShowAdminDetails(true);
    setShowUpdateForm(false);
  };

  /* ------------------------------
     OPEN UPDATE FORM
  ------------------------------ */
  const openUpdateForm = () => {
    setAdminDetails({
      id: selectedAdmin.id,
      username: selectedAdmin.username,
      firstname: selectedAdmin.firstname,
      lastname: selectedAdmin.lastname,
      email: selectedAdmin.email,
      role: selectedAdmin.role,
      contact_number: selectedAdmin.contact_number,
      address: selectedAdmin.address,
      profile_image: null,
      profile_image_preview: selectedAdmin.profile_image
        ? `${API_BASE}/${selectedAdmin.profile_image}`
        : "",
    });

    setShowUpdateForm(true);
    setShowAdminDetails(false);
  };

  /* ------------------------------
     UPDATE ADMIN
  ------------------------------ */
  const handleUpdateAdmin = async () => {
    try {
      const formData = new FormData();

      Object.entries(adminDetails).forEach(([key, value]) => {
        if (key !== "profile_image_preview" && value !== null)
          formData.append(key, value);
      });

      await api.put(`/api/admin/admin/${adminDetails.id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Admin updated successfully!");
      fetchAdmins(currentPage);
      setShowUpdateForm(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  /* ------------------------------
     CHANGE PASSWORD
  ------------------------------ */
  const handleChangePassword = async () => {
    const { new_password, confirm_password } = passwords;

    if (!new_password || !confirm_password)
      return toast.error("All fields required.");
    if (new_password !== confirm_password)
      return toast.error("Passwords do not match.");

    try {
      await api.put(`/api/admin/admin/${selectedAdmin.id}/password`, {
        password: new_password,
      });

      toast.success("Password updated successfully!");
      setShowPasswordModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Password update failed");
    }
  };

  /* ------------------------------
     DELETE ADMIN — now allowed for all admins
  ------------------------------ */
  const handleDeleteAdmin = async () => {
    if (!window.confirm("Are you sure you want to delete this admin?")) return;

    try {
      await api.delete(`/api/admin/admin/${selectedAdmin.id}`);
      toast.success("Admin deleted");
      fetchAdmins(currentPage);
      setShowAdminDetails(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  };

  /* ------------------------------
     INVITE ADMIN — now allowed for all admins
  ------------------------------ */
  const handleInviteAdmin = async () => {
    try {
      await api.post(`/api/admin/invite`, { email: inviteEmail });
      toast.success("Invitation sent!");
      setInviteEmail("");
      setShowInviteModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Invite failed");
    }
  };

  /* ------------------------------
     CLOSE MODALS
  ------------------------------ */
  const closeForms = () => {
    setShowAdminDetails(false);
    setShowUpdateForm(false);
    setShowPasswordModal(false);
    setShowInviteModal(false);
  };

  /* ------------------------------
     RENDER
  ------------------------------ */
  return (
    <div className="admins-page-container">
      <h2 className="admins-page-title">Admin Users Management</h2>

      {/* SEARCH + FILTER */}
      <div className="admins-page-topbar">
        <input
          type="text"
          placeholder="Search admins..."
          className="admins-page-search"
          onChange={(e) => {
            setSearch(e.target.value);
            fetchAdmins(1, e.target.value, statusFilter);
          }}
        />

        <select
          className="admins-page-filter"
          onChange={(e) => {
            setStatusFilter(e.target.value);
            fetchAdmins(1, search, e.target.value);
          }}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="disabled">Disabled</option>
          <option value="invited">Invited</option>
        </select>
      </div>

      {/* INVITE BUTTON (always visible) */}
      {!showAdminDetails && !showUpdateForm && (
        <button
          className="admins-page-add-btn"
          onClick={() => setShowInviteModal(true)}
        >
          Invite Admin
        </button>
      )}

      {/* MAIN TABLE */}
      {!loading && !showAdminDetails && !showUpdateForm && (
        <>
          <table className="admins-page-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>First</th>
                <th>Last</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Contact</th>
                <th>Address</th>
              </tr>
            </thead>

            <tbody>
              {admins.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center" }}>
                    No admins found.
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr
                    key={admin.id}
                    className="admins-page-row"
                    onClick={() => openAdminDetailsView(admin)}
                  >
                    <td>{admin.username}</td>
                    <td>{admin.firstname}</td>
                    <td>{admin.lastname}</td>
                    <td>{admin.email}</td>

                    <td>
                      <span className={`role-badge role-${admin.role}`}>
                        {admin.role}
                      </span>
                    </td>

                    <td>
                      <span className={`status-badge status-${admin.status}`}>
                        {admin.status}
                      </span>
                    </td>

                    <td>{admin.contact_number || "N/A"}</td>
                    <td>{admin.address || "N/A"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="admins-page-pagination">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => fetchAdmins(pageNum)}
                  disabled={currentPage === pageNum}
                  className={
                    currentPage === pageNum
                      ? "admins-page-page-btn admins-page-page-btn-active"
                      : "admins-page-page-btn"
                  }
                >
                  {pageNum}
                </button>
              )
            )}
          </div>
        </>
      )}

      {/* DETAILS MODAL */}
      {showAdminDetails && selectedAdmin && (
        <div className="admins-page-modal-overlay">
          <div className="admins-page-modal-form">
            <h3>Admin Details</h3>

            <p>
              <strong>Username:</strong> {selectedAdmin.username}
            </p>
            <p>
              <strong>Name:</strong> {selectedAdmin.firstname}{" "}
              {selectedAdmin.lastname}
            </p>
            <p>
              <strong>Email:</strong> {selectedAdmin.email}
            </p>

            <p>
              <strong>Role:</strong>{" "}
              <span className={`role-badge role-${selectedAdmin.role}`}>
                {selectedAdmin.role}
              </span>
            </p>

            <p>
              <strong>Status:</strong>{" "}
              <span className={`status-badge status-${selectedAdmin.status}`}>
                {selectedAdmin.status}
              </span>
            </p>

            <p>
              <strong>Contact:</strong> {selectedAdmin.contact_number || "N/A"}
            </p>

            {selectedAdmin.profile_image && (
              <img
                className="admins-page-profile-large"
                src={`${API_BASE}/${selectedAdmin.profile_image}`}
                alt="Profile"
              />
            )}

            <div className="admins-page-button-group">
              <button onClick={openUpdateForm}>Update</button>

              {/* DELETE BUTTON (now always visible) */}
              <button
                className="admins-page-delete-btn"
                onClick={handleDeleteAdmin}
              >
                Delete
              </button>

              <button onClick={() => setShowPasswordModal(true)}>
                Change Password
              </button>
              <button className="admins-page-cancel-btn" onClick={closeForms}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="admins-page-modal-overlay">
          <div className="admins-page-modal-form">
            <h3>Change Password</h3>

            <div className="admins-page-form-group">
              <label>New Password</label>
              <input
                type="password"
                value={passwords.new_password}
                onChange={(e) =>
                  setPasswords({ ...passwords, new_password: e.target.value })
                }
              />
            </div>

            <div className="admins-page-form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={passwords.confirm_password}
                onChange={(e) =>
                  setPasswords({
                    ...passwords,
                    confirm_password: e.target.value,
                  })
                }
              />
            </div>

            <div className="admins-page-button-group">
              <button onClick={handleChangePassword}>Update Password</button>
              <button className="admins-page-cancel-btn" onClick={closeForms}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE FORM */}
      {showUpdateForm && (
        <div className="admins-page-modal-overlay">
          <div className="admins-page-modal-form">
            <h3>Update Admin</h3>

            <div className="admins-page-form-group">
              <label>Username</label>
              <input
                type="text"
                name="username"
                value={adminDetails.username}
                onChange={(e) =>
                  setAdminDetails({ ...adminDetails, username: e.target.value })
                }
              />
            </div>

            <div className="admins-page-form-group">
              <label>First Name</label>
              <input
                type="text"
                name="firstname"
                value={adminDetails.firstname}
                onChange={(e) =>
                  setAdminDetails({
                    ...adminDetails,
                    firstname: e.target.value,
                  })
                }
              />
            </div>

            <div className="admins-page-form-group">
              <label>Last Name</label>
              <input
                type="text"
                name="lastname"
                value={adminDetails.lastname}
                onChange={(e) =>
                  setAdminDetails({
                    ...adminDetails,
                    lastname: e.target.value,
                  })
                }
              />
            </div>

            <div className="admins-page-form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={adminDetails.email}
                onChange={(e) =>
                  setAdminDetails({ ...adminDetails, email: e.target.value })
                }
              />
            </div>

            {/* ROLE — always visible now */}
            <div className="admins-page-form-group">
              <label>Role</label>
              <select
                name="role"
                value={adminDetails.role}
                onChange={(e) =>
                  setAdminDetails({ ...adminDetails, role: e.target.value })
                }
              >
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>

            <div className="admins-page-form-group">
              <label>Contact Number</label>
              <input
                type="text"
                name="contact_number"
                value={adminDetails.contact_number}
                onChange={(e) =>
                  setAdminDetails({
                    ...adminDetails,
                    contact_number: e.target.value,
                  })
                }
              />
            </div>

            <div className="admins-page-form-group">
              <label>Address</label>
              <input
                type="text"
                name="address"
                value={adminDetails.address}
                onChange={(e) =>
                  setAdminDetails({
                    ...adminDetails,
                    address: e.target.value,
                  })
                }
              />
            </div>

            {/* IMAGE UPLOAD */}
            <div className="admins-page-form-group">
              <label>Profile Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setAdminDetails({
                    ...adminDetails,
                    profile_image: e.target.files[0],
                    profile_image_preview: URL.createObjectURL(
                      e.target.files[0]
                    ),
                  })
                }
              />
            </div>

            {adminDetails.profile_image_preview && (
              <img
                className="admins-page-profile-large"
                src={adminDetails.profile_image_preview}
                alt="Preview"
              />
            )}

            <div className="admins-page-button-group">
              <button onClick={handleUpdateAdmin}>Save Changes</button>
              <button className="admins-page-cancel-btn" onClick={closeForms}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVITE MODAL */}
      {showInviteModal && (
        <div className="admins-page-modal-overlay">
          <div className="admins-page-modal-form">
            <h3>Invite New Admin</h3>

            <div className="admins-page-form-group">
              <label>Email Address:</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="admins-page-button-group">
              <button onClick={handleInviteAdmin}>Send Invitation</button>
              <button className="admins-page-cancel-btn" onClick={closeForms}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminsPage;
