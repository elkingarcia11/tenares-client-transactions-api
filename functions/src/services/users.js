const { HttpsError } = require("firebase-functions/v2/https");

const ALLOWED_ROLES = new Set(["admin", "secretary"]);

async function setUserRole({ auth, targetUid, newRole }) {
  const uid = typeof targetUid === "string" ? targetUid.trim() : "";
  const role = typeof newRole === "string" ? newRole.trim() : "";

  if (!uid) throw new HttpsError("invalid-argument", "targetUid must be a non-empty string.");
  if (!ALLOWED_ROLES.has(role)) {
    throw new HttpsError(
      "invalid-argument",
      `newRole must be one of: ${Array.from(ALLOWED_ROLES).join(", ")}.`
    );
  }

  try {
    await auth.setCustomUserClaims(uid, { role });
    return { success: true, targetUid: uid, newRole: role };
  } catch (err) {
    console.error("[setUserRole] Failed to set custom claims:", err);
    if (err?.code === "auth/user-not-found") {
      throw new HttpsError("not-found", `No user found for targetUid: ${uid}`);
    }
    throw new HttpsError("internal", "Failed to set user role.");
  }
}

function verifyCaller({ decodedToken }) {
  const role = typeof decodedToken?.role === "string" ? decodedToken.role : null;
  const roles = Array.isArray(decodedToken?.roles) ? decodedToken.roles : [];
  const normalizedRole = role || (roles.includes("admin") ? "admin" : roles.includes("secretary") ? "secretary" : null);

  return {
    uid: decodedToken.uid,
    role: normalizedRole,
    isAdmin: normalizedRole === "admin",
    isSecretary: normalizedRole === "secretary",
  };
}

module.exports = { setUserRole, verifyCaller };

