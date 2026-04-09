#!/usr/bin/env node
/**
 * Set Firebase Auth custom claims for a user.
 * Loads `functions/.env` (see `.env.example`). Uses GOOGLE_APPLICATION_CREDENTIALS + GOOGLE_CLOUD_PROJECT.
 *
 * Usage (from functions/):
 *   npm run set-user-role -- <uid> <admin|secretary>
 */

require("../loadEnv");

const path = require("path");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const { resolveFirebaseProjectId } = require("../src/shared/localDev");

const ALLOWED = new Set(["admin", "secretary"]);

function resolveCredentialsPath() {
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!p || typeof p !== "string" || !p.trim()) {
    console.error(
      "Set GOOGLE_APPLICATION_CREDENTIALS in functions/.env to your service account JSON path (e.g. ./local.json)."
    );
    process.exit(1);
  }
  const t = p.trim();
  if (path.isAbsolute(t)) return t;
  return path.join(__dirname, "..", t);
}

async function main() {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolveCredentialsPath();

  const projectId = resolveFirebaseProjectId();
  if (!projectId) {
    console.error(
      "Set GOOGLE_CLOUD_PROJECT (or GCLOUD_PROJECT / FIREBASE_PROJECT_ID) in functions/.env to your Firebase project ID."
    );
    process.exit(1);
  }

  const [, , uid, role] = process.argv;
  if (!uid || !role) {
    console.error("Usage: node scripts/setUserRole.js <uid> <admin|secretary>");
    process.exit(1);
  }
  if (!ALLOWED.has(role)) {
    console.error(`newRole must be one of: ${[...ALLOWED].join(", ")}`);
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ projectId });
  }

  await getAuth().setCustomUserClaims(uid, { role });
  console.log(`OK: set custom claims for ${uid} -> { role: "${role}" } (project ${projectId})`);
  console.log("Tell that user to refresh their ID token (getIdToken(true) or sign out/in).");
}

main().catch((err) => {
  const msg = String(err?.message || err);
  if (msg.includes("quota project") || msg.includes("identitytoolkit")) {
    console.error(
      "\nIf using user credentials (gcloud), run: gcloud auth application-default set-quota-project YOUR_PROJECT_ID\n"
    );
  }
  console.error(err);
  process.exit(1);
});
