import React from 'react';
import Navbar from '../../components/Navbar';
import './styles/NavbarPages.css';

const About = () => {
  return (
    <>
      <Navbar />
      <div className="navbar-hero about-hero">
        <div className="navbar-hero-overlay" />
        <div className="navbar-hero-content">
          <h1 className="navbar-hero-title">ABOUT US</h1>
          <div className="navbar-hero-underline" />
          <p className="navbar-hero-subtitle">Learn more about our mission and vision.</p>
        </div>
      </div>

      <div className="navbar-section">
        <h2 className="navbar-section-title">Who We Are</h2>
        <div className="navbar-grid">
          <div className="navbar-card">
            <h3 className="navbar-card-title">Our Mission</h3>
            <p className="navbar-card-text">To promote local tourism responsibly and sustainably.</p>
          </div>
          <div className="navbar-card">
            <h3 className="navbar-card-title">Our Vision</h3>
            <p className="navbar-card-text">Connecting people to nature and culture.</p>
          </div>
          <div className="navbar-card">
            <h3 className="navbar-card-title">Meet the Team</h3>
            <p className="navbar-card-text">Passionate locals behind the scenes.</p>
          </div>
        </div>
      </div>
    </>
  );
};


export default About;
