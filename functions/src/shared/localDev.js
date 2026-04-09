/**
 * Runtime config from `process.env` only.
 *
 * - Local: `functions/.env` (via `loadEnv.js`) or your shell.
 * - Cloud Run: set env on the revision. For Firebase Admin with a **key file**, mount the
 *   JSON from Secret Manager as a volume and set `GOOGLE_APPLICATION_CREDENTIALS` to the
 *   mount path inside the container (see `functions/.env.example`).
 */

function isPlaceholderProjectId(value) {
  const t = String(value || "").trim().toLowerCase();
  if (!t) return true;
  if (t === "your-firebase-project-id" || t === "your-actual-project-id") return true;
  return false;
}

function resolveFirebaseProjectId() {
  for (const key of ["GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT", "FIREBASE_PROJECT_ID"]) {
    const v = process.env[key];
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (isPlaceholderProjectId(t)) continue;
    return t;
  }
  return undefined;
}

/** Comma-separated list in CORS_ORIGINS (no spaces required). */
function parseCorsOrigins() {
  const raw = process.env.CORS_ORIGINS;
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  resolveFirebaseProjectId,
  parseCorsOrigins,
};
