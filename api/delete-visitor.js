import { getAdmin } from "../server/firebaseAdmin.js";

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "DELETE, OPTIONS");
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
  if (req.method !== "DELETE") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  try {
    const admin = await getAdmin();
    const db = admin.firestore();
    await ensureSuperRequester(admin, db, req);

    const id = String(req.body?.id || "").trim();
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Visitor id is required." });
    }

    const visitRef = db.collection("visits").doc(id);
    const visitSnap = await visitRef.get();
    if (!visitSnap.exists) {
      return res
        .status(404)
        .json({ success: false, message: "Visitor record not found." });
    }

    await visitRef.delete();

    return res.status(200).json({
      success: true,
      message: "Visitor record deleted successfully.",
      data: { id },
    });
  } catch (error) {
    console.error("delete-visitor error:", error);
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
              : "Failed to delete visitor record.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

