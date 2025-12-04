import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/usermanagement.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const AdminsPage = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [showAdminDetails, setShowAdminDetails] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false); // ✅ APPROVAL MODAL

  const [adminDetails, setAdminDetails] = useState({
    id: null,
    username: '',
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    role: 'admin',
    contact_number: '',
    address: '',
    profile_image: null,
    profile_image_preview: '',
  });

  const [passwords, setPasswords] = useState({
    new_password: '',
    confirm_password: '',
  });

  const [formError, setFormError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ---------------------------------------------
  // Auth headers helper (JWT from localStorage)
  // ---------------------------------------------
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {};
  };

  // ---------------------------------------------
  // FETCH ADMINS
  // ---------------------------------------------
  const fetchAdmins = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `${API_BASE}/api/admin/list?page=${page}&limit=10`,
        { headers: getAuthHeaders() }
      );

      const normalized = res.data.users.map((admin) => ({
        ...admin,
        profile_image: admin.profile_image?.replace(/\\/g, '/'),
      }));

      setAdmins(normalized);
      setTotalPages(Math.ceil(res.data.total / res.data.limit));
      setCurrentPage(page);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------
  // OPEN DETAILS VIEW
  // ---------------------------------------------
  const openAdminDetailsView = (admin) => {
    setSelectedAdmin(admin);
    setShowAdminDetails(true);
    setShowUpdateForm(false);
  };

  // ---------------------------------------------
  // OPEN UPDATE FORM
  // ---------------------------------------------
  const openUpdateForm = () => {
    if (selectedAdmin) {
      setAdminDetails({
        id: selectedAdmin.id,
        username: selectedAdmin.username,
        firstname: selectedAdmin.firstname,
        lastname: selectedAdmin.lastname,
        email: selectedAdmin.email,
        password: '',
        role: 'admin',
        contact_number: selectedAdmin.contact_number || '',
        address: selectedAdmin.address || '',
        profile_image: null,
        profile_image_preview: selectedAdmin.profile_image
          ? `${API_BASE}/${selectedAdmin.profile_image}`
          : '',
      });
    } else {
      setAdminDetails({
        id: null,
        username: '',
        firstname: '',
        lastname: '',
        email: '',
        password: '',
        role: 'admin',
        contact_number: '',
        address: '',
        profile_image: null,
        profile_image_preview: '',
      });
    }

    setShowUpdateForm(true);
    setShowAdminDetails(false);
    setFormError(null);
  };

  // ---------------------------------------------
  // OPEN PASSWORD MODAL
  // ---------------------------------------------
  const openPasswordModal = () => {
    setPasswords({
      new_password: '',
      confirm_password: '',
    });
    setPasswordError(null);
    setShowPasswordModal(true);
  };

  // ---------------------------------------------
  // FORM HANDLERS
  // ---------------------------------------------
  const handleDetailsChange = (e) => {
    const { name, value } = e.target;
    setAdminDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAdminDetails((prev) => ({
        ...prev,
        profile_image: file,
        profile_image_preview: URL.createObjectURL(file),
      }));
    }
  };

  const validateDetails = () => {
    const { username, firstname, lastname, email, password, id } = adminDetails;

    if (!username || !firstname || !lastname || !email) {
      setFormError('All fields except contact/address/image are required.');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setFormError('Invalid email format.');
      return false;
    }
    if (!id && !password) {
      setFormError('Password is required for new admin.');
      return false;
    }
    return true;
  };

  // ---------------------------------------------
  // ACTUAL SAVE (Create or Update)
  // ---------------------------------------------
  const handleUpdateDetails = async () => {
    if (!validateDetails()) return;

    try {
      const formData = new FormData();
      Object.entries(adminDetails).forEach(([key, value]) => {
        if (key === 'profile_image_preview') return;
        if (key === 'password' && !value && adminDetails.id) return; // skip empty password on update (not used here actually)
        if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });

      // Append existing image path if no new image
      if (
        !adminDetails.profile_image &&
        adminDetails.profile_image_preview
      ) {
        formData.append(
          'existing_image',
          adminDetails.profile_image_preview.replace(`${API_BASE}/`, '')
        );
      }

      const url = adminDetails.id
        ? `${API_BASE}/api/admin/admin/${adminDetails.id}`
        : `${API_BASE}/api/admin/admin`;

      const method = adminDetails.id ? axios.put : axios.post;

      await method(url, formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      });

      await fetchAdmins(currentPage);
      setShowUpdateForm(false);
      setSelectedAdmin(null);
      setShowApprovalModal(false);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save admin');
    }
  };

  // ---------------------------------------------
  // WRAPPER to trigger APPROVAL MODAL on create
  // ---------------------------------------------
  const handleSubmitAdminClick = () => {
    // If updating existing admin => no approval page, just save
    if (adminDetails.id) {
      handleUpdateDetails();
      return;
    }

    // New admin => show approval modal first
    setShowApprovalModal(true);
  };

  // ---------------------------------------------
  // CHANGE PASSWORD
  // ---------------------------------------------
  const handleChangePassword = async () => {
    const { new_password, confirm_password } = passwords;

    if (!new_password || !confirm_password) {
      setPasswordError('Both password fields are required.');
      return;
    }
    if (new_password !== confirm_password) {
      setPasswordError('Passwords do not match.');
      return;
    }
    if (new_password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    try {
      await axios.put(
        `${API_BASE}/api/admin/admin/${selectedAdmin.id}/password`,
        { password: new_password },
        { headers: getAuthHeaders() }
      );

      setShowPasswordModal(false);
      alert('Password updated successfully.');
    } catch (err) {
      setPasswordError(
        err.response?.data?.message || 'Failed to update password'
      );
    }
  };

  // ---------------------------------------------
  // DELETE ADMIN
  // ---------------------------------------------
  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;
    if (!window.confirm('Are you sure you want to delete this admin?')) return;

    try {
      await axios.delete(
        `${API_BASE}/api/admin/admin/${selectedAdmin.id}`,
        { headers: getAuthHeaders() }
      );
      await fetchAdmins(currentPage);
      setShowAdminDetails(false);
      setSelectedAdmin(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete admin');
    }
  };

  // ---------------------------------------------
  // CLOSE FORMS
  // ---------------------------------------------
  const closeForms = () => {
    setShowAdminDetails(false);
    setShowUpdateForm(false);
    setShowPasswordModal(false);
    setShowApprovalModal(false);
    setSelectedAdmin(null);
    setFormError(null);
    setPasswordError(null);
  };

  // ---------------------------------------------
  // UI
  // ---------------------------------------------
  return (
    <div className="admins-page-container">
      <h2 className="admins-page-title">Admin Users Management</h2>

      {loading && <p>Loading admins...</p>}
      {error && <p className="admins-page-error">{error}</p>}

      {!loading && !showAdminDetails && !showUpdateForm && (
        <>
          <button
            className="admins-page-add-btn"
            onClick={() => {
              setSelectedAdmin(null);
              openUpdateForm();
            }}
          >
            Add New Admin
          </button>

          <table className="admins-page-table">
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
              {admins.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center' }}>
                    No admin users found.
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr
                    key={admin.id}
                    onClick={() => openAdminDetailsView(admin)}
                    className="admins-page-row"
                  >
                    <td>{admin.username}</td>
                    <td>{admin.firstname}</td>
                    <td>{admin.lastname}</td>
                    <td>{admin.email}</td>
                    <td>{admin.contact_number || 'N/A'}</td>
                    <td>{admin.address || 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="admins-page-pagination">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => fetchAdmins(pageNum)}
                  disabled={currentPage === pageNum}
                  className={
                    currentPage === pageNum
                      ? 'admins-page-page-btn admins-page-page-btn-active'
                      : 'admins-page-page-btn'
                  }
                >
                  {pageNum}
                </button>
              )
            )}
          </div>
        </>
      )}

      {/* ------------------- DETAILS VIEW ------------------- */}
      {showAdminDetails && selectedAdmin && (
        <div className="admins-page-modal-overlay">
          <div className="admins-page-modal-form">
            <h3>Admin Details</h3>

            <div style={{ display: 'flex', gap: '20px' }}>
              <div>
                <p>
                  <strong>Username:</strong> {selectedAdmin.username}
                </p>
                <p>
                  <strong>First:</strong> {selectedAdmin.firstname}
                </p>
                <p>
                  <strong>Last:</strong> {selectedAdmin.lastname}
                </p>
                <p>
                  <strong>Email:</strong> {selectedAdmin.email}
                </p>
                <p>
                  <strong>Contact:</strong> {selectedAdmin.contact_number}</p>
                <p>
                  <strong>Address:</strong> {selectedAdmin.address}</p>
              </div>

              <div>
                {selectedAdmin.profile_image ? (
                  <img
                    src={`${API_BASE}/${selectedAdmin.profile_image}`}
                    alt="Profile"
                    className="admins-page-profile-large"
                  />
                ) : (
                  <p>No image</p>
                )}
              </div>
            </div>

            <div className="admins-page-button-group">
              <button onClick={openUpdateForm}>Update</button>
              <button
                className="admins-page-delete-btn"
                onClick={handleDeleteAdmin}
              >
                Delete
              </button>
              <button onClick={openPasswordModal}>Change Password</button>
              <button className="admins-page-cancel-btn" onClick={closeForms}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------- UPDATE / ADD FORM ------------------- */}
      {showUpdateForm && (
        <div className="admins-page-modal-overlay">
          <div className="admins-page-modal-form">
            <h3>{adminDetails.id ? 'Update Admin' : 'Add New Admin'}</h3>

            {formError && <p className="admins-page-error">{formError}</p>}

            <p className="admins-page-note">
              Note: Except for the <strong>first admin</strong>, all new admins
              will need to verify their email using an OTP code before they can
              log in.
            </p>

            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                {['username', 'firstname', 'lastname', 'email', 'contact_number'].map(
                  (field) => (
                    <div key={field} className="admins-page-form-group">
                      <label>
                        {field.replace('_', ' ').toUpperCase()}:
                        <input
                          type={field === 'email' ? 'email' : 'text'}
                          name={field}
                          value={adminDetails[field]}
                          onChange={handleDetailsChange}
                        />
                      </label>
                    </div>
                  )
                )}

                {!adminDetails.id && (
                  <div className="admins-page-form-group">
                    <label>
                      Password:
                      <input
                        type="password"
                        name="password"
                        value={adminDetails.password}
                        onChange={handleDetailsChange}
                      />
                    </label>
                  </div>
                )}

                <div className="admins-page-form-group">
                  <label>
                    Address:
                    <input
                      name="address"
                      value={adminDetails.address}
                      onChange={handleDetailsChange}
                    />
                  </label>
                </div>

                <div className="admins-page-form-group">
                  <label>
                    Profile Image:
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
              </div>

              <div>
                {adminDetails.profile_image_preview ? (
                  <img
                    src={adminDetails.profile_image_preview}
                    alt="Preview"
                    className="admins-page-profile-large"
                  />
                ) : (
                  <p>No image selected</p>
                )}
              </div>
            </div>

            <div className="admins-page-button-group">
              <button onClick={handleSubmitAdminClick}>
                {adminDetails.id ? 'Update Admin' : 'Add Admin'}
              </button>
              <button
                className="admins-page-cancel-btn"
                onClick={closeForms}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------- PASSWORD MODAL ------------------- */}
      {showPasswordModal && (
        <div className="admins-page-modal-overlay">
          <div className="admins-page-modal-form">
            <h3>Change Password</h3>

            {passwordError && (
              <p className="admins-page-error">{passwordError}</p>
            )}

            <div className="admins-page-form-group">
              <label>
                New Password:
                <input
                  type="password"
                  value={passwords.new_password}
                  onChange={(e) =>
                    setPasswords({
                      ...passwords,
                      new_password: e.target.value,
                    })
                  }
                />
              </label>
            </div>

            <div className="admins-page-form-group">
              <label>
                Confirm Password:
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
              </label>
            </div>

            <div className="admins-page-button-group">
              <button onClick={handleChangePassword}>Update Password</button>
              <button
                className="admins-page-cancel-btn"
                onClick={closeForms}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------- APPROVAL MODAL (UNIQUE CLASSES) ------------------- */}
      {showApprovalModal && !adminDetails.id && (
        <div className="admin-approval-overlay">
          <div className="admin-approval-modal">
            <h3>Confirm New Admin Creation</h3>
            <p className="admin-approval-text">
              You are about to create a <strong>new admin account</strong>.
              Please review the details below before proceeding.
            </p>

            <div className="admin-approval-details">
              <p>
                <strong>Username:</strong> {adminDetails.username}
              </p>
              <p>
                <strong>Name:</strong> {adminDetails.firstname}{' '}
                {adminDetails.lastname}
              </p>
              <p>
                <strong>Email:</strong> {adminDetails.email}
              </p>
              <p>
                <strong>Contact:</strong>{' '}
                {adminDetails.contact_number || 'N/A'}
              </p>
              <p>
                <strong>Address:</strong> {adminDetails.address || 'N/A'}
              </p>
            </div>

            <p className="admin-approval-note">
              After creating:
              <br />
              • If this is the <strong>first admin</strong>, the account will be
              active immediately.
              <br />
              • Otherwise, the admin must verify their email with an OTP code
              before logging in.
            </p>

            <div className="admin-approval-buttons">
              <button
                className="admin-approval-confirm-btn"
                onClick={handleUpdateDetails}
              >
                Confirm &amp; Create Admin
              </button>
              <button
                className="admin-approval-cancel-btn"
                onClick={() => setShowApprovalModal(false)}
              >
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
