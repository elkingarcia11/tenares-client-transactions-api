const { onCall } = require("firebase-functions/v2/https");

const { auth } = require("../shared/firebase");
const { assertCallerIsAdmin } = require("../shared/authz");
const userSvc = require("../services/users");

exports.setUserRole = onCall(async (request) => {
  assertCallerIsAdmin(request);

  const data = request.data || {};
  return userSvc.setUserRole({
    auth: auth(),
    targetUid: data.targetUid,
    newRole: data.newRole,
  });
});
