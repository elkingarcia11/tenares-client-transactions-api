const { HttpsError } = require("firebase-functions/v2/https");

const ALLOWED_ROLES = new Set(["admin", "secretary"]);

/** Firebase Admin Auth errors often set `code` to values like `auth/user-not-found`. */
function authErrorCode(err) {
  if (!err) return "";
  const c = err.code;
  if (typeof c === "string" && c.startsWith("auth/")) return c;
  if (typeof err.errorInfo?.code === "string") return err.errorInfo.code;
  return "";
}

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
    const code = authErrorCode(err);
    console.error("[setUserRole] Failed to set custom claims:", code || err?.message, err);
    if (code === "auth/user-not-found") {
      throw new HttpsError("not-found", `No user found for targetUid: ${uid}`);
    }
    if (code === "auth/invalid-uid") {
      throw new HttpsError("invalid-argument", "targetUid is not a valid Firebase Auth UID.");
    }
    if (code === "auth/insufficient-permission" || code === "auth/forbidden") {
      throw new HttpsError(
        "permission-denied",
        "Service account cannot set custom claims. Grant this account a role that includes Firebase Authentication Admin (or use credentials for the correct Firebase project)."
      );
    }
    const suffix = code ? ` ${code}` : "";
    throw new HttpsError("internal", `Failed to set user role.${suffix}`);
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

