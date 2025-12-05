// src/utils/adminLogger.js
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

/**
 * Retrieves the currently logged-in admin from localStorage.
 * Tries all known keys used by your system.
 */
function getLoggedAdmin() {
  const keys = ["adminUser", "admin", "user", "loggedAdmin", "currentAdmin"];

  for (let key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const obj = JSON.parse(raw);
      if (obj && obj.id) return obj;
    } catch {}
  }

  return null;
}

/**
 * Send admin logs to backend.
 */
export async function logAdminAction(action, details = {}) {
  try {
    const admin = getLoggedAdmin();

    if (!admin || !admin.id) {
      console.warn("⚠ logAdminAction() – No admin ID found. Log skipped.");
      return;
    }

    await axios.post(`${API_BASE}/api/adminlogs/add`, {
      admin_id: admin.id,
      action,
      details,
    });

    console.log(`📝 Admin Log Saved: ${action}`);
  } catch (err) {
    console.error("❌ Failed to send admin log:", err);
  }
}
