const sanitizeMultilineSecret = (value = "") => {
  if (!value) return "";
  const trimmed = String(value).trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed;
};

const parseServiceAccountFromEnv = () => {
  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    process.env.GCP_SERVICE_ACCOUNT_JSON,
  ].filter(Boolean);

  for (const rawValue of candidates) {
    const raw = String(rawValue).trim();

    try {
      return JSON.parse(raw);
    } catch {
      // Try base64-encoded JSON payloads.
    }

    try {
      const decoded = Buffer.from(raw, "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch {
      // Ignore and continue to next candidate.
    }
  }

  return null;
};

const resolveAdminCredentials = () => {
  const serviceAccount = parseServiceAccountFromEnv();

  const projectId =
    serviceAccount?.project_id ||
    serviceAccount?.projectId ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "";

  const clientEmail =
    serviceAccount?.client_email ||
    serviceAccount?.clientEmail ||
    process.env.FIREBASE_CLIENT_EMAIL ||
    "";

  const privateKey = sanitizeMultilineSecret(
    serviceAccount?.private_key ||
      serviceAccount?.privateKey ||
      process.env.FIREBASE_PRIVATE_KEY
  );

  return {
    projectId: String(projectId).trim(),
    clientEmail: String(clientEmail).trim(),
    privateKey,
  };
};

export const getAdmin = async () => {
  const { default: admin } = await import("firebase-admin");

  if (!admin.apps.length) {
    const credentials = resolveAdminCredentials();

    if (!credentials.projectId || !credentials.clientEmail || !credentials.privateKey) {
      throw new Error(
        "Firebase Admin credentials are missing or invalid. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (or FIREBASE_SERVICE_ACCOUNT_JSON)."
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: credentials.projectId,
        clientEmail: credentials.clientEmail,
        privateKey: credentials.privateKey,
      }),
    });
  }

  return admin;
};
