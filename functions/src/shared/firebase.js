const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const { resolveFirebaseProjectId } = require("./localDev");

function ensureFirebaseInitialized() {
  if (getApps().length) return;
  const projectId = resolveFirebaseProjectId();
  if (projectId) initializeApp({ projectId });
  else initializeApp();
}

function db() {
  ensureFirebaseInitialized();
  return getFirestore();
}

function auth() {
  ensureFirebaseInitialized();
  return getAuth();
}

module.exports = { ensureFirebaseInitialized, db, auth };

