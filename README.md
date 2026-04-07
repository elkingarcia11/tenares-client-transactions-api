# Cloud Run API (Functions Framework) — Clients + Roles

Node.js HTTP API designed to run on **Cloud Run** using **`@google-cloud/functions-framework`**. It uses **Firebase Admin** to access **Firestore** and to verify **Firebase Auth ID tokens** (RBAC via custom claims).

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
npm start
```

By default this runs:
- `functions-framework --source=index.js --target=api`

## Auth / RBAC

For endpoints that require auth, send:

- `Authorization: Bearer <Firebase ID token>`

Admin-only endpoints require a custom claim on the token:
- `role: "admin"` (or `roles` array containing `"admin"`)

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

When deploying, ensure the Cloud Run runtime has credentials with access to:
- **Firestore** (read/write `clients` collection)
- **Firebase Auth** (verify ID tokens, set custom claims for roles)

## Notes

- Firestore trigger code exists in `functions/src/clients/sanitizeClients.js` for parity, but Cloud Run only executes **HTTP** handlers registered in Functions Framework.

