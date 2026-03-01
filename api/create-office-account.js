import { getAdmin } from "../server/firebaseAdmin.js";
import { hashOfficePassword } from "../server/officeCredentials.js";

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

const getBearerToken = (req) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
};

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizeUsername = (username = "") => username.trim().toLowerCase();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$/;

const normalizeList = (value) => (Array.isArray(value) ? value : []);

const isValidUsername = (value) =>
  typeof value === "string" && USERNAME_REGEX.test(normalizeUsername(value));

const ensureUsernameAvailable = async (db, usernameNormalized) => {
  const existingUsername = await db
    .collection("offices")
    .where("usernameNormalized", "==", usernameNormalized)
    .limit(1)
    .get();

  return existingUsername.empty;
};

const ensureSuperRequester = async (admin, db, req) => {
  const token = getBearerToken(req);
  if (!token) {
    throw new Error("Missing bearer token");
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch (error) {
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    const isTokenError =
      code.startsWith("auth/") ||
      message.includes("ID token") ||
      message.includes("argument") ||
      message.includes("token");

    if (isTokenError) {
      throw new Error("Invalid bearer token");
    }
    throw error;
  }

  if (decoded.role === "super") return decoded;

  const officeDoc = await db.collection("offices").doc(decoded.uid).get();
  if (officeDoc.exists && officeDoc.data()?.role === "super") {
    return decoded;
  }

  if (decoded.email) {
    const byEmail = await db
      .collection("offices")
      .where("email", "==", normalizeEmail(decoded.email))
      .where("role", "==", "super")
      .limit(1)
      .get();
    if (!byEmail.empty) {
      return decoded;
    }
  }

  throw new Error("Not authorized");
};

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  try {
    const admin = await getAdmin();
    const db = admin.firestore();
    await ensureSuperRequester(admin, db, req);

    const {
      name,
      officialName = "",
      email,
      username = "",
      role = "office",
      purposes = [],
      staffToVisit = [],
    } = req.body || {};

    const cleanName = String(name || "").trim();
    const allowedRole = role === "super" ? "super" : "office";
    const normalizedUsername = normalizeUsername(username);
    let cleanEmail = normalizeEmail(email);

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: "Name is required.",
      });
    }

    if (allowedRole === "office") {
      if (!isValidUsername(normalizedUsername)) {
        return res.status(400).json({
          success: false,
          message:
            "Username is required for office admins (4-32 chars, lowercase letters, numbers, dot, underscore, hyphen).",
        });
      }

      const usernameAvailable = await ensureUsernameAvailable(
        db,
        normalizedUsername
      );
      if (!usernameAvailable) {
        return res.status(409).json({
          success: false,
          message: "Username is already in use.",
        });
      }

      cleanEmail = "";
    } else if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Valid email is required for super admin accounts.",
      });
    }

    const initialPassword =
      allowedRole === "super" ? "superadmin2025" : "officeadmin2025";

    if (allowedRole === "super") {
      try {
        const existing = await admin.auth().getUserByEmail(cleanEmail);
        return res.status(409).json({
          success: false,
          message: "An authentication account already exists for this email.",
          uid: existing.uid,
        });
      } catch (error) {
        if (error.code !== "auth/user-not-found") {
          throw error;
        }
      }
    }

    const userRecord =
      allowedRole === "super"
        ? await admin.auth().createUser({
            email: cleanEmail,
            password: initialPassword,
            displayName: cleanName,
            emailVerified: false,
            disabled: false,
          })
        : await admin.auth().createUser({
            displayName: cleanName,
            disabled: false,
          });

    await admin.auth().setCustomUserClaims(userRecord.uid, { role: allowedRole });

    const officeCredentialFields =
      allowedRole === "office"
        ? {
            ...hashOfficePassword(initialPassword),
            credentialUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }
        : {};

    const officeDoc = {
      uid: userRecord.uid,
      name: cleanName,
      officialName,
      email: allowedRole === "super" ? cleanEmail : "",
      username: allowedRole === "office" ? normalizedUsername : "",
      usernameNormalized: allowedRole === "office" ? normalizedUsername : "",
      role: allowedRole,
      purposes: normalizeList(purposes),
      staffToVisit: normalizeList(staffToVisit),
      status: "active",
      passwordChanged: false,
      passwordChangedAt: null,
      ...officeCredentialFields,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("offices").doc(userRecord.uid).set(officeDoc);

    return res.status(200).json({
      success: true,
      message: "Office account created successfully.",
      data: {
        id: userRecord.uid,
        ...officeDoc,
        createdAt: new Date().toISOString(),
      },
      credentials:
        allowedRole === "office"
          ? {
              username: normalizedUsername,
              initialPassword,
            }
          : {
              email: cleanEmail,
              initialPassword,
            },
    });
  } catch (error) {
    console.error("create-office-account error:", error);
    const errorMessage = String(error?.message || "");
    const isConfigError =
      errorMessage.includes("Firebase Admin credentials") ||
      errorMessage.includes("Firebase Admin environment variables") ||
      errorMessage.includes("Invalid PEM formatted message");
    const isAuthTokenError =
      errorMessage === "Missing bearer token" ||
      errorMessage === "Invalid bearer token";
    const status =
      error.message === "Not authorized" ? 403 : isAuthTokenError ? 401 : 500;
    return res.status(status).json({
      success: false,
      message:
        status === 401
          ? "Session token is invalid for the server Firebase project. Sign out and sign in again. If it persists, client Firebase config and server Admin credentials may be pointing to different projects."
          : status === 403
          ? "Not authorized."
          : isConfigError
            ? "Server Firebase Admin configuration is invalid. Please check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY on Vercel."
            : "Failed to create office account.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
