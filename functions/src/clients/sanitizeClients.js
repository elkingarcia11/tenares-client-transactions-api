const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { FieldValue } = require("firebase-admin/firestore");

const { db } = require("../shared/firebase");

function sanitizeName(value) {
  if (typeof value !== "string") throw new Error("name must be a string.");
  const sanitized = value.trim().toLowerCase();
  if (!sanitized) throw new Error("name must not be empty.");
  return sanitized;
}

function sanitizeAmount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) throw new Error("amount must be a valid number.");
  if (num <= 0) throw new Error("amount must be greater than 0.");
  return parseFloat(num.toFixed(10));
}

function sanitizeNonEmptyString(value, fieldName) {
  if (typeof value !== "string") throw new Error(`${fieldName} must be a string.`);
  const sanitized = value.trim();
  if (!sanitized) throw new Error(`${fieldName} must not be empty.`);
  return sanitized;
}

function sanitizeDate(value) {
  if (typeof value !== "string") throw new Error("date must be a string in mm-dd-yyyy format.");

  const DATE_REGEX = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = value.trim().match(DATE_REGEX);
  if (!match) throw new Error("date must be in mm-dd-yyyy format (e.g. 04-07-2026).");

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  const dateObj = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    dateObj.getUTCFullYear() === year &&
    dateObj.getUTCMonth() === month - 1 &&
    dateObj.getUTCDate() === day;

  if (!isValid) throw new Error(`date "${value}" is not a real calendar date.`);
  return value.trim();
}

function sanitizePayload(data, isCreate) {
  const sanitized = {};
  const errors = [];

  const REQUIRED_FIELDS = ["name", "amount", "receipt", "invoice", "date"];

  if (isCreate) {
    for (const field of REQUIRED_FIELDS) {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`${field} is required.`);
      }
    }
    if (errors.length) return { sanitized: null, errors };
  }

  if (data.name !== undefined) {
    try {
      sanitized.name = sanitizeName(data.name);
    } catch (e) {
      errors.push(e.message);
    }
  }

  if (data.amount !== undefined) {
    try {
      sanitized.amount = sanitizeAmount(data.amount);
    } catch (e) {
      errors.push(e.message);
    }
  }

  if (data.receipt !== undefined) {
    try {
      sanitized.receipt = sanitizeNonEmptyString(data.receipt, "receipt");
    } catch (e) {
      errors.push(e.message);
    }
  }

  if (data.invoice !== undefined) {
    try {
      sanitized.invoice = sanitizeNonEmptyString(data.invoice, "invoice");
    } catch (e) {
      errors.push(e.message);
    }
  }

  if (data.date !== undefined) {
    try {
      sanitized.date = sanitizeDate(data.date);
    } catch (e) {
      errors.push(e.message);
    }
  }

  return { sanitized, errors };
}

exports.sanitizeClientDocument = onDocumentWritten("clients/{docId}", async (event) => {
  const { docId } = event.params;
  const change = event.data;

  if (!change.after.exists) return null;

  const afterData = change.after.data();
  const beforeData = change.before.exists ? change.before.data() : null;
  const isCreate = !change.before.exists;

  if (afterData._sanitized === true) return null;

  const { sanitized, errors } = sanitizePayload(afterData, isCreate);
  const docRef = db().collection("clients").doc(docId);

  if (errors.length > 0) {
    console.error(`[sanitizeClients] Validation failed for doc ${docId}:`, errors);

    if (isCreate) {
      await docRef.delete();
      console.warn(`[sanitizeClients] Deleted invalid new document: ${docId}`);
    } else {
      await docRef.set({ ...beforeData, _sanitized: true });
      console.warn(`[sanitizeClients] Restored previous data for document: ${docId}`);
    }

    await db().collection("clients_sanitization_errors").add({
      docId,
      operation: isCreate ? "create" : "update",
      errors,
      rejectedData: afterData,
      timestamp: FieldValue.serverTimestamp(),
    });

    return null;
  }

  await docRef.set({ ...afterData, ...sanitized, _sanitized: true }, { merge: true });

  console.log(`[sanitizeClients] Sanitized document ${docId} successfully.`);
  return null;
});

