# Cloud Run API — Clients + Roles

Node.js HTTP API designed to run on **Google Cloud Run** (container), **not** on the Firebase Cloud Functions runtime. The container uses **`@google-cloud/functions-framework`** as the HTTP server (`--target=api`). **Firebase Admin** talks to **Firestore** and **Firebase Auth** (ID tokens + custom claims for RBAC).

## Project structure

- `functions/`: Cloud Run service source (Node.js)
  - `functions/index.js`: registers HTTP functions
  - `functions/src/http/api.js`: main JSON API router (deployed entrypoint)
  - `functions/src/http/helloHttp.js`: demo endpoint
- `API.md`: HTTP API contract (routes, auth, request/response)
- `client_workflow.md`: recommended client workflows (HTTP calls)

## Local development

From `functions/`:

```bash
npm i
cp .env.example .env
# Edit .env: GOOGLE_CLOUD_PROJECT, GOOGLE_APPLICATION_CREDENTIALS, CORS_ORIGINS, etc.
npm start
```

`loadEnv.js` loads `functions/.env` when the file exists. On **Cloud Run**, do not ship `.env`; set the same variable names on the service revision, often sourcing values from **Secret Manager** mapped to environment variables. The app only reads `process.env`.

By default local `npm start` runs:

- `functions-framework --source=index.js --target=api`

## Auth / RBAC

For endpoints that require auth, send:

- `Authorization: Bearer <Firebase ID token>`

Admin-only endpoints require a custom claim on the token:
- `role: "admin"` (or `roles` array containing `"admin"`)

### First admin (no existing admin yet)

`POST /users/setRole` always requires an **admin** Firebase ID token, so the very first admin must be granted with the Admin SDK outside the HTTP API:

From `functions/`, with `GOOGLE_CLOUD_PROJECT` and `GOOGLE_APPLICATION_CREDENTIALS` set in `.env` (or your shell), or Application Default Credentials.

```bash
npm run set-user-role -- <uid> admin
```

**If you use `gcloud auth application-default login`**, Firebase Auth (Identity Toolkit) also needs a **quota project** on those credentials:

```bash
gcloud auth application-default set-quota-project your-actual-project-id
```

If `gcloud` warns that it cannot set the quota project (missing `serviceusage.services.use`), either grant that permission on the project or use a **service account key** instead:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
export GOOGLE_CLOUD_PROJECT=your-actual-project-id
npm run set-user-role -- <uid> admin
```

(Download the key from Firebase Console → Project settings → Service accounts → Generate new private key. Keep it secret; add the file to `.gitignore`.)

The affected user must refresh their ID token (`getIdToken(true)` or sign out/in).

**Shell tip:** Do not paste lines that start with `#` into zsh as commands; they are comments only.

## Main endpoints

See `API.md` for full details.

- `GET /healthz`
- `GET /users/me` (auth)
- `POST /users/setRole` (admin)
- `POST /clients/checkDuplicate`
- `POST /clients` (admin)
- `PATCH /clients/{docId}` (admin)
- `DELETE /clients/{docId}` (admin)

## Deploy (Cloud Run)

This repo is intended to be built and deployed as a Cloud Run service. Typical options:

- Deploy from source (gcloud builds container automatically), or
- Build a container image (Docker) and deploy it.

When deploying, configure **environment variables** on the Cloud Run service to match `functions/.env.example` (at minimum `GOOGLE_CLOUD_PROJECT`, `CORS_ORIGINS`).

**Service account JSON (assumed model):** put the full key JSON in **Secret Manager**, **mount it as a file** on the Cloud Run revision (volume from secret), and set **`GOOGLE_APPLICATION_CREDENTIALS`** to the **in-container path** of that file. Do not bake the key into the container image. Plain env vars are enough for non-secret values (`GOOGLE_CLOUD_PROJECT`, `CORS_ORIGINS`).

Ensure the credentials used (mounted key or Cloud Run service account) have IAM access to:
- **Firestore** (read/write `clients` collection)
- **Firebase Auth** (verify ID tokens, set custom claims for roles)

## Notes

- `functions/src/` still exports Firebase **callable/trigger** code for optional use; **Cloud Run only runs the HTTP `api` handler** (plus `helloHttp`). Do not point clients at callables if you deploy Cloud Run only.

