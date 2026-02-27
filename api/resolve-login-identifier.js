import { getAdmin } from "./_firebaseAdmin.js";

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizeUsername = (username = "") => username.trim().toLowerCase();
const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REQUEST_COOLDOWN_MS = 300;
const requesterLastSeen = new Map();

const getRequesterKey = (req) => {
  const ip =
    req.headers["x-forwarded-for"] ||
    req.connection?.remoteAddress ||
    "unknown";
  return String(ip).split(",")[0].trim();
};

const canProceed = (key) => {
  const now = Date.now();
  const previous = requesterLastSeen.get(key) || 0;
  if (now - previous < REQUEST_COOLDOWN_MS) return false;
  requesterLastSeen.set(key, now);
  return true;
};

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed.",
    });
  }

  try {
    const requesterKey = getRequesterKey(req);
    if (!canProceed(requesterKey)) {
      return res.status(429).json({
        success: false,
        message: "Too many attempts. Please try again shortly.",
      });
    }

    const rawIdentifier = String(req.body?.identifier || "").trim();
    if (!rawIdentifier) {
      return res.status(400).json({
        success: false,
        message: "Identifier is required.",
      });
    }

    if (rawIdentifier.includes("@")) {
      const cleanEmail = normalizeEmail(rawIdentifier);
      if (!EMAIL_REGEX.test(cleanEmail)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format.",
        });
      }

      return res.status(200).json({
        success: true,
        loginEmail: cleanEmail,
        identifierType: "email",
      });
    }

    const usernameNormalized = normalizeUsername(rawIdentifier);
    if (!USERNAME_REGEX.test(usernameNormalized)) {
      return res.status(404).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const admin = await getAdmin();
    const db = admin.firestore();

    const officeSnapshot = await db
      .collection("offices")
      .where("usernameNormalized", "==", usernameNormalized)
      .where("role", "==", "office")
      .limit(1)
      .get();

    if (officeSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const officeDoc = officeSnapshot.docs[0];
    const officeData = officeDoc.data() || {};

    if (officeData.status === "inactive") {
      return res.status(403).json({
        success: false,
        message: "Account is inactive.",
      });
    }

    return res.status(200).json({
      success: true,
      identifierType: "username",
      username: usernameNormalized,
    });
  } catch (error) {
    console.error("resolve-login-identifier error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resolve login identifier.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
