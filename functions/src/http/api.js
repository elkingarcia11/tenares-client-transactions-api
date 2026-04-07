const functions = require("@google-cloud/functions-framework");
const { HttpsError } = require("firebase-functions/v2/https");

const { db, auth } = require("../shared/firebase");
const { requireFirebaseAuth, assertAdminFromDecoded } = require("./auth");

const clientSvc = require("../services/clients");
const userSvc = require("../services/users");

function json(res, status, body) {
  res.status(status);
  res.set("Content-Type", "application/json");
  res.send(JSON.stringify(body));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body; // already parsed by framework

  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("application/json")) return {};

  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on("data", (c) => chunks.push(c));
    req.on("end", resolve);
    req.on("error", reject);
  });
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function stripPrefix(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

functions.http("api", async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const path = stripPrefix(url.pathname);
    const method = (req.method || "GET").toUpperCase();

    // Health
    if (method === "GET" && path === "/healthz") {
      return json(res, 200, { ok: true });
    }

    // Authenticated caller info
    if (method === "GET" && path === "/users/me") {
      const decoded = await requireFirebaseAuth(req);
      return json(res, 200, userSvc.verifyCaller({ decodedToken: decoded }));
    }

    // Admin: set role
    if (method === "POST" && path === "/users/setRole") {
      const decoded = await requireFirebaseAuth(req);
      assertAdminFromDecoded(decoded);
      const body = await readJsonBody(req);
      const result = await userSvc.setUserRole({
        auth: auth(),
        targetUid: body.targetUid,
        newRole: body.newRole,
      });
      return json(res, 200, result);
    }

    // Duplicate check (no auth enforced here; keep consistent with prior callable)
    if (method === "POST" && path === "/clients/checkDuplicate") {
      const body = await readJsonBody(req);
      const result = await clientSvc.checkClientDuplicate({ db: db(), data: body });
      return json(res, 200, result);
    }

    // Admin: add client
    if (method === "POST" && path === "/clients") {
      const decoded = await requireFirebaseAuth(req);
      assertAdminFromDecoded(decoded);
      const body = await readJsonBody(req);
      const result = await clientSvc.addClientDocument({ db: db(), data: body });
      return json(res, 200, result);
    }

    // Admin: update/delete client by docId in path
    const m = path.match(/^\/clients\/([^/]+)$/);
    if (m) {
      const docId = decodeURIComponent(m[1]);

      if (method === "PATCH") {
        const decoded = await requireFirebaseAuth(req);
        assertAdminFromDecoded(decoded);
        const body = await readJsonBody(req);
        const result = await clientSvc.updateClientDocument({ db: db(), docId, data: body });
        return json(res, 200, result);
      }

      if (method === "DELETE") {
        const decoded = await requireFirebaseAuth(req);
        assertAdminFromDecoded(decoded);
        const result = await clientSvc.deleteClientDocument({ db: db(), docId });
        return json(res, 200, result);
      }
    }

    return json(res, 404, { error: { code: "not-found", message: "Route not found." } });
  } catch (err) {
    if (err instanceof HttpsError) {
      return json(res, err.httpErrorCode?.status || 400, {
        error: { code: err.code, message: err.message },
      });
    }

    console.error("[api] Unhandled error:", err);
    return json(res, 500, { error: { code: "internal", message: "Internal error." } });
  }
});

