import React from "react";
import Navbar from "../../components/Navbar";
import "./styles/About.css";

// IMPORT IMAGES FROM YOUR PATH
import mayorImg from "../../images/mayor.jpg";
import mangyan1 from "../../images/mangyan1.jpg";
import mangyan2 from "../../images/mangyan2.jpg";
import mangyan3 from "../../images/mangyan3.jpg";

const About = () => {
  return (
    <>
      <Navbar />

      {/* ================= HERO PARALLAX ================= */}
      <section
        className="about-hero parallax-section"
        style={{ backgroundImage: `url(${mangyan1})` }}
      >
        <div className="about-hero-overlay" />
        <div className="about-hero-content">
          <h1>MUNICIPALITY OF MANSALAY</h1>
          <p>Celebrating Mangyan culture, heritage, and faith.</p>
        </div>
      </section>

      {/* ================= MESSAGE ================= */}
      <section className="about-section fade-in" id="mayor-message">
        <h2 className="section-title">MESSAGE</h2>

        <div className="message-card">
          <img
            src={mayorImg}
            alt="Hon. Ferdinand M. Maliwanag"
            className="mayor-img"
          />

          <div>
            <p className="about-text">
              As we continue to embrace the beauty and heritage of Mansalay,
              Oriental Mindoro, we take great pride in our rich culture and 
              vibrant destinations. Our town thrives through the diversity 
              of the Mangyan people who preserve and showcase their rich 
              history and way of life.
            </p>

            <p className="about-text">
              Through our commitment to culture and the arts, we ensure that 
              the identity of Mansalay remains strong and cherished by future 
              generations. Let us work together in preserving and promoting 
              our treasures, making Mansalay a beacon of cultural pride and 
              tourism excellence.
            </p>

            <p className="mayor-name">
              — Hon. Ferdinand M. Maliwanag, Municipal Mayor
            </p>
          </div>
        </div>
      </section>

      {/* ================= BRIEF HISTORY ================= */}
      <section className="about-section fade-in" id="history">
        <h2 className="section-title">BRIEF HISTORY</h2>

        <p className="about-text">
          The name of the town is derived from the Mangyan expression 
          <strong> “UN MAN MAY MALAY”</strong>, meaning “I don’t know” 
          or “ewan ko” in Tagalog. During Spanish times, Mansalay was under 
          the jurisdiction of Mangarin. Later, it became a barrio under 
          Bulalacao. After the American period, the government consolidated 
          Bulalacao and Mansalay into one administrative unit.
        </p>

        <p className="about-text">
          Migrants from Quezon, Pangasinan, Romblon, Marinduque, and Nueva 
          Ecija began settling in the area alongside the native Mangyan 
          population. Through the efforts of Representative Don Mariano 
          E. Leuterio, a law was passed to create the <strong>Municipality 
          of Mansalay</strong>. In 1931, <strong>Ildefonso Maliwanag</strong> 
          was elected the first Municipal President, marking the formal 
          establishment of Mansalay as a self-governing town.
        </p>

        {/* ================= TIMELINE ================= */}
        <div className="history-timeline">
          <div className="timeline-item">
            <div className="timeline-dot" />
            <h3 className="timeline-year">Pre-Colonial</h3>
            <p className="timeline-text">
              Indigenous Mangyan tribes settle and thrive in the region, 
              preserving their script, poetry, and customs.
            </p>
          </div>
          <div className="timeline-item">
            <div className="timeline-dot" />
            <h3 className="timeline-year">Spanish Period</h3>
            <p className="timeline-text">
              Mansalay is governed under Mangarin, later assigned under 
              the larger Bulalacao territory.
            </p>
          </div>
          <div className="timeline-item">
            <div className="timeline-dot" />
            <h3 className="timeline-year">American Era</h3>
            <p className="timeline-text">
              Bulalacao and Mansalay consolidated; settlers move inland 
              to establish the present-day poblacion.
            </p>
          </div>
          <div className="timeline-item">
            <div className="timeline-dot" />
            <h3 className="timeline-year">Municipality Created</h3>
            <p className="timeline-text">
              Legislative approval leads to the official formation of 
              the Municipality of Mansalay.
            </p>
          </div>
          <div className="timeline-item">
            <div className="timeline-dot" />
            <h3 className="timeline-year">1931</h3>
            <p className="timeline-text">
              Ildefonso Maliwanag becomes the first Municipal President.
            </p>
          </div>
        </div>
      </section>

      {/* ================= MANGYAN FESTIVAL PARALLAX ================= */}
      <section
        className="parallax-section festival-section fade-in"
        style={{ backgroundImage: `url(${mangyan1})` }}
      >
        <div className="parallax-overlay" />
        <div className="parallax-content">
          <h2 className="section-title section-title-light">MANGYAN FESTIVAL</h2>
          <p className="parallax-text">
            The Mangyan Festival is the official celebration of Mansalay. 
            It honors the Hanunuo and Buhid Mangyan tribes and highlights 
            unity, culture, and identity. The festival showcases dances, 
            rituals, and traditions that embody the spirit of Mansalay.
          </p>
        </div>
      </section>

      {/* ================= SURAT MANGYAN ================= */}
      <section className="about-section fade-in" id="surat-mangyan">
        <h2 className="section-title">SURAT MANGYAN</h2>

        <div className="info-with-image">
          <img src={mangyan2} alt="Surat Mangyan" />

          <div>
            <p className="about-text">
              Surat Mangyan is the ancient writing system of the Mangyan 
              people—particularly the Hanunuo and Buhid tribes. It is a 
              syllabic script similar to Baybayin and is widely used in 
              writing <strong>Ambahan</strong>, a poetic, metaphorical 
              seven-syllable-line verse.
            </p>

            <ul className="about-list">
              <li>Each character represents a complete syllable.</li>
              <li>Vowels are modified by dots above or below the symbol.</li>
              <li>Used primarily for Ambahan poetry.</li>
            </ul>

            <p className="about-text">
              <strong>Ginaw Bilog</strong> was awarded 
              <em> Manlilikha ng Bayan </em> (National Living Treasure) 
              in 1993 for preserving Ambahan and Surat Mangyan. His 
              manuscripts were later recognized by UNESCO.
            </p>
          </div>
        </div>

        {/* ================= MANGYAN SYMBOLS ================= */}
        <div className="symbols-grid">
          <div className="symbol-card">
            <h3>Surat Characters</h3>
            <p>
              Unique Mangyan syllabic symbols carved on bamboo or written 
              on manuscripts.
            </p>
          </div>

          <div className="symbol-card">
            <h3>Ambahan</h3>
            <p>
              Seven-syllable poetry expressing values, wisdom, and emotion.
            </p>
          </div>

          <div className="symbol-card">
            <h3>Hanunuo &amp; Buhid Culture</h3>
            <p>
              Rich traditions preserved through dance, weaving, artistry, 
              and rituals.
            </p>
          </div>

          <div className="symbol-card">
            <h3>Tribal Patterns</h3>
            <p>
              Intricate woven and beaded designs symbolizing identity and belief.
            </p>
          </div>
        </div>
      </section>

      {/* ================= HERITAGE CENTER PARALLAX ================= */}
      <section
        className="parallax-section heritage-section fade-in"
        style={{ backgroundImage: `url(${mangyan3})` }}
      >
        <div className="parallax-overlay" />
        <div className="parallax-content">
          <h2 className="section-title section-title-light">
            ORIENTAL MINDORO HERITAGE CULTURAL CENTER
          </h2>
          <p className="parallax-text">
            Located in Barangay B. Del Mundo, the OMHCC is dedicated to 
            preserving the cultural heritage of the Mangyan and indigenous 
            communities of Mindoro. It exhibits artifacts, photographs, 
            crafts, and artworks that immerse visitors in Mangyan life.
          </p>
        </div>
      </section>

      {/* ================= GALLERY GRID ================= */}
      <section className="about-section fade-in" id="gallery">
        <h2 className="section-title">CULTURE & HERITAGE GALLERY</h2>

        <div className="gallery-grid">
          <div className="gallery-item">
            <img src={mangyan1} alt="Mangyan Festival" />
            <p className="gallery-caption">Mangyan Festival & Mayor’s Message</p>
          </div>

          <div className="gallery-item">
            <img src={mangyan2} alt="Surat Mangyan" />
            <p className="gallery-caption">Surat Mangyan & Ginaw Bilog</p>
          </div>

          <div className="gallery-item">
            <img src={mangyan3} alt="Heritage Cultural Center" />
            <p className="gallery-caption">
              Heritage Cultural Center, Moriones & Semana Santa
            </p>
          </div>
        </div>
      </section>

      {/* ================= MORIONES ================= */}
      <section className="about-section fade-in" id="moriones">
        <h2 className="section-title">MORIONES FESTIVAL</h2>
        <p className="about-text">
          The Moriones Festival of Mansalay reenacts the story of Longinus 
          during Holy Week. Local participants wear colorful masks and 
          costumes resembling Roman soldiers. The festival blends artistry, 
          devotion, history, and theatrical performance.
        </p>
      </section>

      {/* ================= SEMANA SANTA ================= */}
      <section className="about-section fade-in" id="semana-santa">
        <h2 className="section-title">SEMANA SANTA</h2>
        <p className="about-text">
          Semana Santa in Mansalay is marked by deep religious devotion—from 
          Senakulo performances, visita iglesia, processions, reenactments of 
          the Last Supper and Passion, and the celebration of Christ’s 
          Resurrection. It is a time of faith, unity, and cultural expression.
        </p>
      </section>
    </>
  );
};

export default About;
