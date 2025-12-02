import React, { useEffect, useState } from 'react';
import axios from 'axios';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserDetailsView, setShowUserDetailsView] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
const [userDetails, setUserDetails] = useState({
  id: null,
  username: '',
  firstname: '',
  lastname: '',
  email: '',
  role: 'user',
  contact_number: '',
  address: '',
  profile_image: null,         // holds File object if selected
  profile_image_preview: '',   // holds preview URL string
});


  const [formError, setFormError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`http://localhost:3002/api/users/list?page=${page}&limit=10`);
      setUsers(res.data.users);
      const totalUsers = res.data.total || res.data.totalUsers || 0;
      const limit = res.data.limit || 5;
      setTotalPages(Math.ceil(totalUsers / limit));
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
      role: selectedUser.role || 'user',
      contact_number: selectedUser.contact_number || '',
      address: selectedUser.address || '',
      profile_image: null, // clear file input on edit load
      profile_image_preview: selectedUser.profile_image ? `http://localhost:3002/${selectedUser.profile_image}` : '',
    });
  } else {
    setUserDetails({
      id: null,
      username: '',
      firstname: '',
      lastname: '',
      email: '',
      role: 'user',
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

  const handleDetailsChange = (e) => {
    setUserDetails((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const validateDetails = () => {
    const { username, firstname, lastname, email } = userDetails;
    if (!username.trim() || !firstname.trim() || !lastname.trim() || !email.trim()) {
      setFormError('All fields are required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setFormError('Invalid email format');
      return false;
    }
    return true;
  };

const handleUpdateDetails = async () => {
  if (!validateDetails()) return;

  try {
    const formData = new FormData();
    formData.append('username', userDetails.username);
    formData.append('firstname', userDetails.firstname);
    formData.append('lastname', userDetails.lastname);
    formData.append('email', userDetails.email);
    formData.append('role', userDetails.role);
    formData.append('contact_number', userDetails.contact_number);
    formData.append('address', userDetails.address);

    if (userDetails.profile_image) {
      formData.append('profile_image', userDetails.profile_image);
    } else {
      formData.append(
        'existing_image',
        userDetails.profile_image_preview
          ? userDetails.profile_image_preview.replace('http://localhost:3002/', '')
          : ''
      );
    }

    if (userDetails.id) {
      // Updating user
      await axios.put(`http://localhost:3002/api/users/user/${userDetails.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else {
      // Creating user - do NOT include password
      await axios.post(`http://localhost:3002/api/users/user`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }

    await fetchUsers(currentPage);
    setShowUpdateForm(false);
    setSelectedUser(null);
  } catch (err) {
    setFormError(err.response?.data?.message || err.message || 'Failed to save user');
  }
};


  const handleImageChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    setUserDetails((prev) => ({
      ...prev,
      profile_image: file,
      profile_image_preview: URL.createObjectURL(file),
    }));
  }
};


  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await axios.delete(`http://localhost:3002/api/users/user/${selectedUser.id}`);
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
    setSelectedUser(null);
    setFormError(null);
  };

  return (
    <div>
      <h2>Users Management</h2>

      {loading && <p>Loading users...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !showUserDetailsView && !showUpdateForm && (
        <>
          <button className="add-user-btn" onClick={() => { setSelectedUser(null); openUpdateForm(); }}>
            Add New User
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
                  <td colSpan="6" style={{ textAlign: 'center' }}>No users found.</td>
                </tr>
              )}
              {users.map((user) => (
                <tr key={user.id} onClick={() => openUserDetailsView(user)} style={{ cursor: 'pointer' }}>
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
                className={currentPage === pageNum ? 'disabled' : ''}
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
      <h3>User Details</h3>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <p><strong>Username:</strong> {selectedUser.username}</p>
          <p><strong>First Name:</strong> {selectedUser.firstname}</p>
          <p><strong>Last Name:</strong> {selectedUser.lastname}</p>
          <p><strong>Email:</strong> {selectedUser.email}</p>
          <p><strong>Contact Number:</strong> {selectedUser.contact_number || 'N/A'}</p>
          <p><strong>Address:</strong> {selectedUser.address || 'N/A'}</p>

          <div className="button-group" style={{ marginTop: 20 }}>
            <button onClick={openUpdateForm}>Edit</button>
            <button className="delete-btn" onClick={handleDeleteUser}>Delete</button>
            <button className="cancel-btn" onClick={closeForms}>Close</button>
          </div>
        </div>

        <div style={{ flexBasis: '180px', flexShrink: 0 }}>
          {selectedUser.profile_image ? (
            <img
              src={`http://localhost:3002/${selectedUser.profile_image}`}
              alt="Profile"
              className="profile-large"
            />
          ) : (
            <p style={{ fontSize: 14, color: '#888' }}>No image available</p>
          )}
        </div>
      </div>
    </div>
  </div>
)}



      {showUpdateForm && (
        <div className="modal-overlay">
          <div className="modal-form">
            <h3>{userDetails.id ? 'Edit User' : 'Add New User'}</h3>

            {formError && <p className="error">{formError}</p>}

            <form onSubmit={(e) => { e.preventDefault(); handleUpdateDetails(); }} style={{ display: 'flex', gap: 20 }}>
  <div style={{ flex: 1 }}>
    {[
      ['Username', 'username'],
      ['First Name', 'firstname'],
      ['Last Name', 'lastname'],
      ['Email', 'email'],
      ['Contact Number', 'contact_number'],
      ['Address', 'address'],
    ].map(([label, name]) => (
      <div className="form-group" key={name}>
        <label>{label}:</label>
        <input
          type={name === 'email' ? 'email' : 'text'}
          name={name}
          value={userDetails[name]}
          onChange={handleDetailsChange}
          required={['username', 'firstname', 'lastname', 'email'].includes(name)}
        />
      </div>
    ))}

    <div className="form-group">
      <label>Profile Image:</label>
      <input
        type="file"
        name="profile_image"
        accept="image/*"
        onChange={handleImageChange}
      />
    </div>

    <div className="button-group" style={{ marginTop: 20 }}>
      <button type="submit">{userDetails.id ? 'Update' : 'Add'}</button>
      <button type="button" className="cancel-btn" onClick={closeForms}>Cancel</button>
    </div>
  </div>

  <div style={{ flexBasis: '180px', flexShrink: 0 }}>
    {userDetails.profile_image_preview ? (
      <img
        src={userDetails.profile_image_preview}
        alt="Profile Preview"
        className="profile-large"
        style={{ width: '180px', borderRadius: '12px', objectFit: 'cover' }}
      />
    ) : (
      <p style={{ fontSize: 14, color: '#888' }}>No image selected</p>
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
