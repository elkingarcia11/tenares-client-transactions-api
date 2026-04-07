// Register Functions Framework HTTP functions (side-effect registration).
require("./src/http/helloHttp");
require("./src/http/api");

// Export Firebase Functions (callable + triggers) for `firebase deploy`.
module.exports = require("./src");

