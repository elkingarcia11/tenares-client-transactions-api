// Clients (admin-only for writes)
exports.addClientDocument = require("./clients/addClientDocument").addClientDocument;
exports.updateClientDocument = require("./clients/updateClientDocument").updateClientDocument;
exports.deleteClientDocument = require("./clients/deleteClientDocument").deleteClientDocument;

// Users / roles
exports.setUserRole = require("./users/setUserRole").setUserRole;
exports.verifyCaller = require("./users/verifyCaller").verifyCaller;

// Client helpers / triggers
exports.checkClientDuplicate = require("./clients/checkClientDuplicate").checkClientDuplicate;
exports.sanitizeClientDocument = require("./clients/sanitizeClients").sanitizeClientDocument;

