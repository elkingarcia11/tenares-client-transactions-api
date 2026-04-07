const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

function ensureFirebaseInitialized() {
  if (!getApps().length) initializeApp();
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

