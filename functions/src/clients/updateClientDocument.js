const { onCall } = require("firebase-functions/v2/https");

const { db } = require("../shared/firebase");
const { assertCallerIsAdmin } = require("../shared/authz");
const clientSvc = require("../services/clients");

exports.updateClientDocument = onCall(async (request) => {
  assertCallerIsAdmin(request);
  const data = request.data || {};
  return clientSvc.updateClientDocument({ db: db(), docId: data.docId, data });
});

