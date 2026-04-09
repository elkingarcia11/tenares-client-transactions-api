/**
 * Local only: load `functions/.env` into `process.env` (missing file is a no-op).
 *
 * On Cloud Run, configure env vars on the service (no `.env` in the image).
 *
 * Credentials: store the service account JSON in **Secret Manager**, mount it as a
 * **file** on the revision, and set `GOOGLE_APPLICATION_CREDENTIALS` to that path
 * inside the container. The Firebase / Google SDKs read the key from that file.
 *
 * This module does not call Secret Manager; it only loads optional local `.env`.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
