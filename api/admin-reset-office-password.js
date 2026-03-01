import { getAdmin } from "../server/firebaseAdmin.js";
import {
  ensureAuthUser,
  hashOfficePassword,
  isValidPassword,
} from "../server/officeCredentials.js";

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

const ensureSuperRequester = async (admin, db, req) => {
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing bearer token");

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
  if (officeDoc.exists && officeDoc.data()?.role === "super") return decoded;

  if (decoded.email) {
    const byEmail = await db
      .collection("offices")
      .where("email", "==", normalizeEmail(decoded.email))
      .limit(5)
      .get();
    const hasSuperEmailMatch = byEmail.docs.some(
      (doc) => (doc.data()?.role || "office") === "super"
    );
    if (hasSuperEmailMatch) return decoded;
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
    const requester = await ensureSuperRequester(admin, db, req);

    const { id, newPassword } = req.body || {};
    if (!id || !isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Office id and a password with at least 8 characters are required.",
      });
    }

    const officeRef = db.collection("offices").doc(id);
    const officeSnap = await officeRef.get();
    if (!officeSnap.exists) {
      return res.status(404).json({ success: false, message: "Office not found." });
    }

    const officeData = officeSnap.data() || {};
    if ((officeData.role || "office") === "super") {
      return res.status(403).json({
        success: false,
        message: "Super admin password must be reset by the super admin account owner.",
      });
    }

    const uid = officeData.uid || id;
    const credentialFields = hashOfficePassword(newPassword.trim());

    await ensureAuthUser({
      admin,
      uid,
      role: "office",
      displayName: officeData.name || officeData.officialName || "Office User",
      disabled: false,
      email: null,
    });

    await officeRef.update({
      uid,
      ...credentialFields,
      credentialUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      passwordChanged: false,
      passwordChangedAt: null,
      lastAdminPasswordResetAt: admin.firestore.FieldValue.serverTimestamp(),
      lastAdminPasswordResetBy: requester.uid || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      password: admin.firestore.FieldValue.delete(),
    });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
      data: {
        id,
        uid,
        email: null,
        username: officeData.username || null,
        name: officeData.name || null,
      },
    });
  } catch (error) {
    console.error("admin-reset-office-password error:", error);
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
          ? "Session token is invalid for the server Firebase project. Sign out and sign in again."
          : status === 403
            ? "Not authorized."
            : isConfigError
              ? "Server Firebase Admin configuration is invalid. Please check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY on Vercel."
              : "Failed to reset office password.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
