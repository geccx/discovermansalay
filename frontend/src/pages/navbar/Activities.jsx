import React from 'react';
import Navbar from '../../components/Navbar';
import './styles/NavbarPages.css';

const Activities = () => {
  return (
    <>
      <Navbar />
      <div className="navbar-hero activities-hero">
        <div className="navbar-hero-overlay" />
        <div className="navbar-hero-content">
          <h1 className="navbar-hero-title">ACTIVITIES</h1>
          <div className="navbar-hero-underline" />
          <p className="navbar-hero-subtitle">Exciting things to do in every destination.</p>
        </div>
      </div>

      <div className="navbar-section">
        <h2 className="navbar-section-title">Explore Things To Do</h2>
        <div className="navbar-grid">
          <div className="navbar-card">
            <h3 className="navbar-card-title">Snorkeling</h3>
            <p className="navbar-card-text">Discover vibrant marine life.</p>
          </div>
          <div className="navbar-card">
            <h3 className="navbar-card-title">Cultural Dance</h3>
            <p className="navbar-card-text">Watch or join traditional performances.</p>
          </div>
          <div className="navbar-card">
            <h3 className="navbar-card-title">Hiking Trails</h3>
            <p className="navbar-card-text">Scenic routes for all levels.</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Activities;
