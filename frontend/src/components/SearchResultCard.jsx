// src/components/SearchResultCard.jsx
import React from "react";

const escapeHtml = (unsafe) =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const highlightText = (text, keyword) => {
  if (!text || !keyword) return escapeHtml(text || "");

  const safe = escapeHtml(text);
  const regex = new RegExp(`(${keyword})`, "gi");
  return safe.replace(regex, "<mark>$1</mark>");
};

const SearchResultCard = ({ item, view = "grid", query = "" }) => {
  const { safe_image, name, category, description, source } = item;

  const descSnippet = description
    ? description.length > 140
      ? description.slice(0, 140) + "..."
      : description
    : "";

  return (
    <div className={`result-card ${view === "list" ? "list" : ""}`}>
      <div className="image-wrapper">
        <img src={safe_image} alt={name} loading="lazy" />
        <span className="source-badge">
          {source === "tourist_spots" ? "Tourist Spot" : "CMS"}
        </span>
      </div>

      <div className="result-content">
        <h3
          className="result-title"
          dangerouslySetInnerHTML={{
            __html: highlightText(name, query),
          }}
        />
        {category && <p className="result-category">{category}</p>}

        {descSnippet && (
          <p
            className="result-description"
            dangerouslySetInnerHTML={{
              __html: highlightText(descSnippet, query),
            }}
          />
        )}
      </div>
    </div>
  );
};

export default SearchResultCard;
