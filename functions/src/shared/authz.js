const { HttpsError } = require("firebase-functions/v2/https");

function getCallerRole(request) {
  const token = request?.auth?.token || {};
  const role = typeof token.role === "string" ? token.role : undefined;
  const roles = Array.isArray(token.roles) ? token.roles : [];

  if (role) return role;
  if (roles.includes("admin")) return "admin";
  if (roles.includes("secretary")) return "secretary";
  return undefined;
}

function assertAuthenticated(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
}

function assertCallerIsAdmin(request) {
  assertAuthenticated(request);
  const role = getCallerRole(request);
  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Admin privileges required.");
  }
}

module.exports = { getCallerRole, assertAuthenticated, assertCallerIsAdmin };

