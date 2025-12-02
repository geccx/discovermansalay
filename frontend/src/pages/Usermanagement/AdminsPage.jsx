import React, { useEffect, useState } from 'react';
import axios from 'axios';

const AdminsPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserDetailsView, setShowUserDetailsView] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [userDetails, setUserDetails] = useState({
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

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`http://localhost:3002/api/admins/list?page=${page}&limit=10`);
      if (!res.data || !Array.isArray(res.data.users)) throw new Error('Invalid response from server');

      const normalizedUsers = res.data.users.map(user => ({
        ...user,
        profile_image: user.profile_image?.replace(/\\/g, '/'),
      }));

      setUsers(normalizedUsers);
      setTotalPages(Math.ceil(res.data.total / res.data.limit));
      setCurrentPage(page);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openUserDetailsView = (user) => {
    setSelectedUser(user);
    setShowUserDetailsView(true);
    setShowUpdateForm(false);
    setFormError(null);
  };

  const openUpdateForm = () => {
    if (selectedUser) {
      setUserDetails({
        id: selectedUser.id,
        username: selectedUser.username,
        firstname: selectedUser.firstname,
        lastname: selectedUser.lastname,
        email: selectedUser.email,
        password: '',
        role: 'admin',
        contact_number: selectedUser.contact_number || '',
        address: selectedUser.address || '',
        profile_image: null,
        profile_image_preview: selectedUser.profile_image ? `http://localhost:3002/${selectedUser.profile_image}` : '',
      });
    } else {
      setUserDetails({
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
    setShowUserDetailsView(false);
    setFormError(null);
  };

  const openPasswordModal = () => {
    setPasswords({
      new_password: '',
      confirm_password: '',
    });
    setPasswordError(null);
    setShowPasswordModal(true);
  };

  const handleDetailsChange = (e) => {
    const { name, value } = e.target;
    setUserDetails(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUserDetails(prev => ({
        ...prev,
        profile_image: file,
        profile_image_preview: URL.createObjectURL(file),
      }));
    }
  };

  const validateDetails = () => {
    const { username, firstname, lastname, email, password, id } = userDetails;
    if (!username || !firstname || !lastname || !email) {
      setFormError('All fields except contact, address, and image are required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setFormError('Invalid email format');
      return false;
    }
    if (!id && !password) {
      setFormError('Password is required for new admin');
      return false;
    }
    return true;
  };

  const validatePassword = () => {
    const { new_password, confirm_password } = passwords;
    if (!new_password || !confirm_password) {
      setPasswordError('Both password fields are required');
      return false;
    }
    if (new_password !== confirm_password) {
      setPasswordError('Passwords do not match');
      return false;
    }
    if (new_password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleUpdateDetails = async () => {
    if (!validateDetails()) return;

    try {
      const formData = new FormData();
      Object.entries(userDetails).forEach(([key, value]) => {
        if (key === 'profile_image_preview') return;
        if (key === 'password' && !value && userDetails.id) return;
        formData.append(key, value || '');
      });

      if (!userDetails.profile_image && userDetails.profile_image_preview) {
        const existingPath = userDetails.profile_image_preview.replace('http://localhost:3002/', '');
        formData.append('existing_image', existingPath);
      }

      const method = userDetails.id ? axios.put : axios.post;
      const url = userDetails.id
        ? `http://localhost:3002/api/admins/admin/${userDetails.id}`
        : `http://localhost:3002/api/admins/admin`;

      await method(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await fetchUsers(currentPage);
      setShowUpdateForm(false);
      setSelectedUser(null);
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save user');
    }
  };

  const handleChangePassword = async () => {
    if (!validatePassword()) return;

    try {
      await axios.put(`http://localhost:3002/api/admins/admin/${selectedUser.id}/password`, {
        password: passwords.new_password,
      });

      setShowPasswordModal(false);
      alert('Password updated successfully');
    } catch (err) {
      setPasswordError(err.response?.data?.message || err.message || 'Failed to update password');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await axios.delete(`http://localhost:3002/api/admins/admin/${selectedUser.id}`);
      await fetchUsers(currentPage);
      setShowUserDetailsView(false);
      setSelectedUser(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete user');
    }
  };

  const closeForms = () => {
    setShowUserDetailsView(false);
    setShowUpdateForm(false);
    setShowPasswordModal(false);
    setSelectedUser(null);
    setFormError(null);
    setPasswordError(null);
  };

  return (
    <div>
      <h2>Admin Users Management</h2>

      {loading && <p>Loading users...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !showUserDetailsView && !showUpdateForm && (
        <>
          <button className="add-user-btn" onClick={() => { setSelectedUser(null); openUpdateForm(); }}>
            Add New Admin
          </button>

          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Email</th>
                <th>Contact Number</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center' }}>No admin users found.</td>
                </tr>
              )}
              {users.map((user) => (
                <tr key={user.id} onClick={() => openUserDetailsView(user)}>
                  <td>{user.username}</td>
                  <td>{user.firstname}</td>
                  <td>{user.lastname}</td>
                  <td>{user.email}</td>
                  <td>{user.contact_number || 'N/A'}</td>
                  <td>{user.address || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
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

      {showUserDetailsView && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-form">
            <h3>Admin User Details</h3>
            <div>
              <div style={{ flex: 1 }}>
                <p><strong>Username:</strong> {selectedUser.username}</p>
                <p><strong>First Name:</strong> {selectedUser.firstname}</p>
                <p><strong>Last Name:</strong> {selectedUser.lastname}</p>
                <p><strong>Email:</strong> {selectedUser.email}</p>
                <p><strong>Contact Number:</strong> {selectedUser.contact_number || 'N/A'}</p>
                <p><strong>Address:</strong> {selectedUser.address || 'N/A'}</p>
              </div>
              <div>
                {selectedUser.profile_image ? (
                  <img
                    src={`http://localhost:3002/${selectedUser.profile_image}`}
                    alt="Profile"
                    className="profile-large"
                  />
                ) : (
                  <p>No profile image</p>
                )}
              </div>
            </div>

            <div className="button-group">
              <button onClick={openUpdateForm}>Update Admin</button>
              <button className="delete-btn" onClick={handleDeleteUser}>Delete Admin</button>
              <button onClick={openPasswordModal}>Change Password</button>
              <button className="cancel-btn" onClick={closeForms}>Close</button>
            </div>
          </div>
        </div>
      )}

{showUpdateForm && (
  <div className="modal-overlay">
    <div className="modal-form">
      <h3>{userDetails.id ? 'Update Admin' : 'Add New Admin'}</h3>
      {formError && <p className="error">{formError}</p>}

      <div>
        <div style={{ flex: 1 }}>
          {['username', 'firstname', 'lastname', 'email', 'contact_number'].map((field) => (
            <div className="form-group" key={field}>
              <label>{field.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}:
                <input
                  type={field === 'email' ? 'email' : 'text'}
                  name={field}
                  value={userDetails[field]}
                  onChange={handleDetailsChange}
                />
              </label>
            </div>
          ))}

          {/* ✅ Password Field shown only for new admin */}
          {!userDetails.id && (
            <div className="form-group">
              <label>Password:
                <input
                  type="password"
                  name="password"
                  value={userDetails.password}
                  onChange={handleDetailsChange}
                />
              </label>
            </div>
          )}

          <div className="form-group">
            <label>Address:
              <input
                name="address"
                value={userDetails.address}
                onChange={handleDetailsChange}
              />
            </label>
          </div>
          <div className="form-group">
            <label>Profile Image:
              <input type="file" accept="image/*" onChange={handleImageChange} />
            </label>
          </div>
        </div>

        <div>
          {userDetails.profile_image_preview ? (
            <img src={userDetails.profile_image_preview} alt="Preview" className="profile-large" />
          ) : <p>No image selected</p>}
        </div>
      </div>

      <div className="button-group">
        <button onClick={handleUpdateDetails}>
          {userDetails.id ? 'Update Admin' : 'Add Admin'}
        </button>
        <button className="cancel-btn" onClick={closeForms}>Cancel</button>
      </div>
    </div>
  </div>
)}


      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-form">
            <h3>Change Admin Password</h3>
            {passwordError && <p className="error">{passwordError}</p>}
            <div className="form-group">
              <label>New Password:
                <input
                  type="password"
                  name="new_password"
                  value={passwords.new_password}
                  onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                />
              </label>
            </div>
            <div className="form-group">
              <label>Confirm Password:
                <input
                  type="password"
                  name="confirm_password"
                  value={passwords.confirm_password}
                  onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
                />
              </label>
            </div>
            <div className="button-group">
              <button onClick={handleChangePassword}>Update Password</button>
              <button className="cancel-btn" onClick={closeForms}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminsPage;
