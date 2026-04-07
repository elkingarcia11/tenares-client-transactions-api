const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../shared/firebase");
const { assertCallerIsAdmin } = require("../shared/authz");
const clientSvc = require("../services/clients");

exports.addClientDocument = onCall(async (request) => {
  assertCallerIsAdmin(request);
  return clientSvc.addClientDocument({ db: db(), data: request.data || {} });
});

