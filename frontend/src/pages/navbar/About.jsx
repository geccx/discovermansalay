import React from "react";
import Navbar from "../../components/Navbar";
import "./styles/About.css";

const About = () => {
  return (
    <>
      <Navbar />

      {/* HERO SECTION */}
      <div className="about-hero">
        <div className="about-hero-overlay" />
        <div className="about-hero-content">
          <h1>ABOUT MANSALAY</h1>
          <p>Culture • Heritage • Tradition</p>
        </div>
      </div>

      {/* ABOUT SECTION */}
      <section className="about-section fade-in">
        <h2 className="section-title">Who We Are</h2>
        <div className="about-grid">
          <div className="about-card">
            <h3>Our Mission</h3>
            <p>
              To preserve, promote, and celebrate the rich Mangyan culture,
              traditions, and heritage of Mansalay while empowering local
              communities through sustainable tourism.
            </p>
          </div>

          <div className="about-card">
            <h3>Our Vision</h3>
            <p>
              A thriving cultural hub where the stories, artistry, and history
              of the Indigenous Mangyan people inspire both locals and visitors.
            </p>
          </div>

          <div className="about-card">
            <h3>Our Commitment</h3>
            <p>
              We uphold cultural integrity, protect local identity, and support
              initiatives that honor the Mangyan people of Mansalay.
            </p>
          </div>
        </div>
      </section>

      {/* GALLERY SECTION */}
      <section className="gallery-section fade-in">
        <h2 className="section-title">CULTURE & HERITAGE GALLERY</h2>

        <div className="gallery-grid">
          <div className="gallery-item">
            <img src="/images/mangyan1.jpg" alt="Mangyan Festival" />
            <p className="gallery-caption">Mangyan Festival Celebration</p>
          </div>

          <div className="gallery-item">
            <img src="/images/mangyan2.jpg" alt="Surat Mangyan" />
            <p className="gallery-caption">Surat Mangyan — Ancient Writing System</p>
          </div>

          <div className="gallery-item">
            <img src="/images/mangyan3.jpg" alt="Mindoro Heritage Center" />
            <p className="gallery-caption">
              Oriental Mindoro Heritage & Cultural Center
            </p>
          </div>
        </div>
      </section>

      {/* MESSAGE SECTION */}
      <section className="about-message fade-in">
        <h2 className="section-title">MESSAGE OF UNITY</h2>
        <p>
          As we continue to embrace the cultural richness of Mansalay, let us
          honor our Mangyan brothers and sisters by preserving their identity,
          customs, and traditions for future generations.
        </p>
      </section>
    </>
  );
};

export default About;
