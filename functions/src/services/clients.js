const { HttpsError } = require("firebase-functions/v2/https");
const { Timestamp } = require("firebase-admin/firestore");

function parseMmDdYyyyToTimestampUtcMinus4(dateAdded, hours = 11, minutes = 28, seconds = 19) {
  const DATE_REGEX = /^(\d{2})-(\d{2})-(\d{4})$/;
  if (typeof dateAdded !== "string" || !DATE_REGEX.test(dateAdded.trim())) {
    throw new HttpsError("invalid-argument", "date_added must be a string in mm-dd-yyyy format.");
  }
  const [, mm, dd, yyyy] = dateAdded.trim().match(DATE_REGEX);
  const month = parseInt(mm, 10);
  const day = parseInt(dd, 10);
  const year = parseInt(yyyy, 10);

  const UTC_OFFSET_MS = 4 * 60 * 60 * 1000; // UTC-4
  const localEpochMs = Date.UTC(year, month - 1, day, hours, minutes, seconds) + UTC_OFFSET_MS;

  const dateCheck = new Date(localEpochMs - UTC_OFFSET_MS);
  if (
    dateCheck.getUTCFullYear() !== year ||
    dateCheck.getUTCMonth() !== month - 1 ||
    dateCheck.getUTCDate() !== day
  ) {
    throw new HttpsError("invalid-argument", `date_added "${dateAdded}" is not a real calendar date.`);
  }

  return Timestamp.fromMillis(localEpochMs);
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
  const REQUIRED = ["name", "amount", "date_added", "date_processed", "invoice", "receipt"];
  const missing = REQUIRED.filter((f) => data[f] === undefined || data[f] === null);
  if (missing.length) {
    throw new HttpsError("invalid-argument", `Missing required fields: ${missing.join(", ")}.`);
  }

  const name = requireNonEmptyString(data.name, "name").toLowerCase();
  const amount = coercePositiveAmount(data.amount);

  const hours = Number.isInteger(data.hours) ? data.hours : 11;
  const minutes = Number.isInteger(data.minutes) ? data.minutes : 28;
  const seconds = Number.isInteger(data.seconds) ? data.seconds : 19;

  const date_added = parseMmDdYyyyToTimestampUtcMinus4(data.date_added, hours, minutes, seconds);
  const date_processed = parseYyyyMmDd(data.date_processed);

  const invoice = requireNonEmptyString(data.invoice, "invoice");
  const receipt = requireNonEmptyString(data.receipt, "receipt");

  const newDoc = { name, amount, date_added, date_processed, invoice, receipt, _sanitized: true };

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

  const UPDATABLE_FIELDS = ["name", "amount", "date_added", "date_processed", "invoice", "receipt"];
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

  if (data.date_added !== undefined) {
    const hours = Number.isInteger(data.hours) ? data.hours : 11;
    const minutes = Number.isInteger(data.minutes) ? data.minutes : 28;
    const seconds = Number.isInteger(data.seconds) ? data.seconds : 19;
    updates.date_added = parseMmDdYyyyToTimestampUtcMinus4(data.date_added, hours, minutes, seconds);
  }

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
      .where("date_added", "==", date_added)
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

