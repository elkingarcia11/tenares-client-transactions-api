const { onCall } = require("firebase-functions/v2/https");

const { db } = require("../shared/firebase");
const clientSvc = require("../services/clients");

exports.checkClientDuplicate = onCall(async (request) => {
  const data = request.data || {};
  return clientSvc.checkClientDuplicate({ db: db(), data });
});

