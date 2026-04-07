const { auth } = require("../shared/firebase");
const { HttpsError } = require("firebase-functions/v2/https");

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function requireFirebaseAuth(req) {
  const token = getBearerToken(req);
  if (!token) throw new HttpsError("unauthenticated", "Missing Authorization: Bearer <Firebase ID token>.");

  try {
    const decoded = await auth().verifyIdToken(token);
    return decoded;
  } catch (err) {
    console.error("[auth] verifyIdToken failed:", err);
    throw new HttpsError("unauthenticated", "Invalid or expired Firebase ID token.");
  }
}

function assertAdminFromDecoded(decoded) {
  const role = typeof decoded?.role === "string" ? decoded.role : undefined;
  const roles = Array.isArray(decoded?.roles) ? decoded.roles : [];
  const isAdmin = role === "admin" || roles.includes("admin");
  if (!isAdmin) throw new HttpsError("permission-denied", "Admin privileges required.");
}

module.exports = { requireFirebaseAuth, assertAdminFromDecoded };

