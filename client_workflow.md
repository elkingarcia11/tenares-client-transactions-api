# Client workflows (clients collection)

This file documents client workflows for the `clients` collection **via the HTTP API** on your **Cloud Run** service URL (not Firebase callable functions).

## API base + auth

- **Base URL**: your Cloud Run service URL (e.g. `https://<service>-<hash>-<region>.a.run.app`)
- **Primary entrypoint**: `api` routes by path:
  - Example: `POST <BASE_URL>/clients`

- **Auth header (required for admin operations)**:
  - `Authorization: Bearer <Firebase ID token>`
  - Obtain from client: `await auth.currentUser.getIdToken()`

## Common prerequisites (all workflows)

- **Auth**: user must be signed in to add/update/delete (server enforces admin-only).
- **Role refresh (after role changes)**: if you recently called `setUserRole`, the affected user should refresh their ID token before you expect new permissions to apply (e.g. `getIdToken(true)` or sign out/in).
- **Optional role pre-check**: call `GET /users/me` to drive UI gating (disable/hide actions). The server will still enforce authorization.

## Add a new client document

- **1) (Optional) verify role**
  - Call `GET /users/me` (with `Authorization` header).
  - If `isAdmin` is false, block the action in the UI (server also blocks).

- **2) (Optional, recommended) duplicate check**
  - Call `POST /clients/checkDuplicate` with JSON `{ name, date_added, amount }`.
  - Use `date_added` as the **mm-dd-yyyy (UTC-4)** date you consider “today” for your business rules.
  - If it returns `"duplicate exists"`, show a warning / require confirmation before continuing.

- **3) call create**
  - Call `POST /clients` (with `Authorization` header) using JSON:
    - `{ name, amount, date_processed, invoice, receipt }`
  - On success: `{ success: true, docId }`.

- **4) error handling**
  - `unauthenticated`: user not signed in
  - `permission-denied`: user signed in but not admin
  - `invalid-argument`: show validation message
  - `internal`: show retry message

## Update an existing client document

- **1) (Optional) verify role**
  - Call `GET /users/me` (with `Authorization` header).
  - If `isAdmin` is false, block the action in the UI (server also blocks).

- **2) gather current document values**
  - Ensure you have the current document values loaded (from UI state or a Firestore read). This is needed to do a correct duplicate check when only some fields change.

- **3) build update payload**
  - Payload must include:
    - `docId`
    - at least one of: `name`, `amount`, `date_processed`, `invoice`, `receipt`

- **4) (Recommended) duplicate prevention before update**
  - Duplicates are defined by the triple: **`name` + `date_added (mm-dd-yyyy UTC-4)` + `amount`**.
  - If **none** of these three fields are changing, skip this step.
  - If **any** are changing:
    - Compute the “prospective” triple using:
      - the new values from your update payload (when present), otherwise
      - the current values from the existing document
    - Call `POST /clients/checkDuplicate` with JSON `{ name, date_added, amount }`.
    - If `"duplicate exists"`: stop and warn / require confirmation.
    - If `"duplicate does not exist"`: proceed.

- **5) call update**
  - Call `PATCH /clients/{docId}` (with `Authorization` header) and JSON payload (partial update).
  - On success: `{ success: true, docId }`.

- **6) error handling**
  - `unauthenticated`: user not signed in
  - `permission-denied`: user signed in but not admin
  - `invalid-argument`: missing `docId`, no fields provided, or bad field formats
  - `not-found`: `docId` doesn’t exist
  - `internal`: show retry message

## Delete an existing client document

- **1) (Optional) verify role**
  - Call `GET /users/me` (with `Authorization` header).
  - If `isAdmin` is false, block the action in the UI (server also blocks).

- **2) confirm with the user**
  - Show a confirmation dialog in the UI before deleting.

- **3) call delete**
  - Call `DELETE /clients/{docId}` (with `Authorization` header).
  - On success: `{ success: true, docId }`.

- **4) error handling**
  - `unauthenticated`: user not signed in
  - `permission-denied`: user signed in but not admin
  - `invalid-argument`: missing/invalid `docId`
  - `not-found`: doc already deleted / doesn’t exist
  - `internal`: show retry message

## Notes about `sanitizeClientDocument`

- The client does **not** call `sanitizeClientDocument`.
- It is only relevant if you deploy/run the Firestore trigger in a Firebase Functions environment.
- In the current Cloud Run HTTP API, input validation happens in the HTTP handlers before writing to Firestore.

