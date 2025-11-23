// src/Logo.jsx
import React from "react";
// Import the image you just saved
import logoImg from "./assets/logo.png";

export default function Logo({ small }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        // Adjust gap based on whether it's the small header version or a large one
        gap: small ? 8 : 12,
        // Ensure it doesn't wrap on small screens
        whiteSpace: "nowrap",
      }}
    >
      <img
        src={logoImg}
        alt="Bam Bam Logo"
        style={{
          // Resize image based on the 'small' prop
          height: small ? "36px" : "64px",
          width: "auto",
          // Add a slight drop shadow for pop
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
        }}
      />
      <span
        style={{
          fontWeight: "800",
          // Adjust font size for header vs. full-page
          fontSize: small ? "1.25rem" : "2.5rem",
          color: "var(--accent, #2563eb)", // Use theme color with a fallback
          letterSpacing: "-0.03em",
          fontFamily: "'Inter', sans-serif", // Use a nice bold font if available
        }}
      >
        Bam Bam
      </span>
    </div>
  );
}
