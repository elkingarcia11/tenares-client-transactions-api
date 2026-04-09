const { HttpsError } = require("firebase-functions/v2/https");
const { Timestamp } = require("firebase-admin/firestore");

function formatMmDdYyyyUtcMinus4(timestamp) {
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);

  // Convert "now" into the wall-clock date in UTC-4.
  // We only need the calendar date for duplicate checking and UI grouping.
  const UTC_MINUS_4_MS = -4 * 60 * 60 * 1000;
  const utcMs = date.getTime();
  const shifted = new Date(utcMs + UTC_MINUS_4_MS);

  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  const yyyy = String(shifted.getUTCFullYear());
  return `${mm}-${dd}-${yyyy}`;
}

function parseYyyyMmDd(dateProcessed) {
  const DATE_PROC_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
  if (typeof dateProcessed !== "string" || !DATE_PROC_REGEX.test(dateProcessed.trim())) {
    throw new HttpsError("invalid-argument", "date_processed must be a string in yyyy-mm-dd format.");
  }
  const [, py, pm, pd] = dateProcessed.trim().match(DATE_PROC_REGEX);
  const procCheck = new Date(Date.UTC(parseInt(py, 10), parseInt(pm, 10) - 1, parseInt(pd, 10)));
  if (
    procCheck.getUTCFullYear() !== parseInt(py, 10) ||
    procCheck.getUTCMonth() !== parseInt(pm, 10) - 1 ||
    procCheck.getUTCDate() !== parseInt(pd, 10)
  ) {
    throw new HttpsError("invalid-argument", `date_processed "${dateProcessed}" is not a real calendar date.`);
  }
  return dateProcessed.trim();
}

function coercePositiveAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpsError("invalid-argument", "amount must be a valid number greater than 0.");
  }
  return amount;
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

async function addClientDocument({ db, data }) {
  const REQUIRED = ["name", "amount", "date_processed", "invoice", "receipt"];
  const missing = REQUIRED.filter((f) => data[f] === undefined || data[f] === null);
  if (missing.length) {
    throw new HttpsError("invalid-argument", `Missing required fields: ${missing.join(", ")}.`);
  }

  const name = requireNonEmptyString(data.name, "name").toLowerCase();
  const amount = coercePositiveAmount(data.amount);

  // Server-generated Timestamp (shows like "March 30, 2024 at 11:28:19 AM UTC-4" in Firestore console
  // depending on your viewer timezone).
  const date_added = Timestamp.now();
  // Store a stable mm-dd-yyyy key (UTC-4) for duplicate checks.
  const date_added_key = formatMmDdYyyyUtcMinus4(date_added);
  const date_processed = parseYyyyMmDd(data.date_processed);

  const invoice = requireNonEmptyString(data.invoice, "invoice");
  const receipt = requireNonEmptyString(data.receipt, "receipt");

  const newDoc = {
    name,
    amount,
    date_added,
    date_added_key,
    date_processed,
    invoice,
    receipt,
    _sanitized: true,
  };

  try {
    const docRef = await db.collection("clients").add(newDoc);
    return { success: true, docId: docRef.id };
  } catch (err) {
    console.error("[addClientDocument] Firestore write failed:", err);
    throw new HttpsError("internal", "Failed to insert document into Firestore.");
  }
}

async function updateClientDocument({ db, docId, data }) {
  if (!docId || typeof docId !== "string" || !docId.trim()) {
    throw new HttpsError("invalid-argument", "docId must be a non-empty string.");
  }
  const id = docId.trim();

  const docRef = db.collection("clients").doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new HttpsError("not-found", `No client document found with ID: ${id}`);

  const UPDATABLE_FIELDS = ["name", "amount", "date_processed", "invoice", "receipt"];
  const provided = UPDATABLE_FIELDS.filter((f) => data[f] !== undefined && data[f] !== null);
  if (provided.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      `At least one field must be provided to update: ${UPDATABLE_FIELDS.join(", ")}.`
    );
  }

  const updates = {};

  if (data.name !== undefined) updates.name = requireNonEmptyString(data.name, "name").toLowerCase();
  if (data.amount !== undefined) updates.amount = coercePositiveAmount(data.amount);

  if (data.date_processed !== undefined) updates.date_processed = parseYyyyMmDd(data.date_processed);
  if (data.invoice !== undefined) updates.invoice = requireNonEmptyString(data.invoice, "invoice");
  if (data.receipt !== undefined) updates.receipt = requireNonEmptyString(data.receipt, "receipt");

  updates._sanitized = true;

  try {
    await docRef.update(updates);
    return { success: true, docId: id };
  } catch (err) {
    console.error("[updateClientDocument] Firestore update failed:", err);
    throw new HttpsError("internal", "Failed to update document in Firestore.");
  }
}

async function deleteClientDocument({ db, docId }) {
  if (!docId || typeof docId !== "string" || !docId.trim()) {
    throw new HttpsError("invalid-argument", "docId must be a non-empty string.");
  }
  const id = docId.trim();

  const docRef = db.collection("clients").doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new HttpsError("not-found", `No client document found with ID: ${id}`);

  try {
    await docRef.delete();
    return { success: true, docId: id };
  } catch (err) {
    console.error("[deleteClientDocument] Firestore delete failed:", err);
    throw new HttpsError("internal", "Failed to delete document from Firestore.");
  }
}

async function checkClientDuplicate({ db, data }) {
  const missing = ["name", "date_added", "amount"].filter((f) => data[f] === undefined || data[f] === null);
  if (missing.length) {
    throw new HttpsError("invalid-argument", `Missing required fields: ${missing.join(", ")}.`);
  }

  const name = requireNonEmptyString(data.name, "name").toLowerCase();

  const DATE_REGEX = /^(\d{2})-(\d{2})-(\d{4})$/;
  if (typeof data.date_added !== "string" || !DATE_REGEX.test(data.date_added.trim())) {
    throw new HttpsError("invalid-argument", "date_added must be a string in mm-dd-yyyy format.");
  }
  const date_added = data.date_added.trim();

  const amount = coercePositiveAmount(data.amount);

  try {
    const snapshot = await db
      .collection("clients")
      .where("name", "==", name)
      .where("date_added_key", "==", date_added)
      .where("amount", "==", amount)
      .limit(1)
      .get();

    if (!snapshot.empty) return { status: "duplicate exists" };
    return { status: "duplicate does not exist" };
  } catch (err) {
    console.error("[checkClientDuplicate] Firestore query failed:", err);
    throw new HttpsError("internal", "Failed to query the database.");
  }
}

module.exports = {
  addClientDocument,
  updateClientDocument,
  deleteClientDocument,
  checkClientDuplicate,
};

