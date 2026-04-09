require("./loadEnv");

// Cloud Run: Functions Framework registers HTTP targets (side effects on require).
require("./src/http/helloHttp");
require("./src/http/api");

// Optional: Firebase callable/trigger exports — not used when you deploy this image to Cloud Run only.
module.exports = require("./src");

