const { onCall } = require("firebase-functions/v2/https");

const { assertAuthenticated, getCallerRole } = require("../shared/authz");
const userSvc = require("../services/users");

exports.verifyCaller = onCall(async (request) => {
  assertAuthenticated(request);

  const role = getCallerRole(request) || null;
  return userSvc.verifyCaller({ decodedToken: { uid: request.auth.uid, role } });
});

