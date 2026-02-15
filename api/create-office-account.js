import { getAdmin } from "./_firebaseAdmin.js";

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

const normalizeList = (value) => (Array.isArray(value) ? value : []);

const ensureSuperRequester = async (admin, db, req) => {
  const token = getBearerToken(req);
  if (!token) {
    throw new Error("Missing bearer token");
  }

  const decoded = await admin.auth().verifyIdToken(token);
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
      role = "office",
      purposes = [],
      staffToVisit = [],
    } = req.body || {};

    const cleanEmail = normalizeEmail(email);
    if (!name || !cleanEmail) {
      return res
        .status(400)
        .json({ success: false, message: "Name and email are required." });
    }

    const allowedRole = role === "super" ? "super" : "office";
    const initialPassword =
      allowedRole === "super" ? "superadmin2025" : "officeadmin2025";

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

    const userRecord = await admin.auth().createUser({
      email: cleanEmail,
      password: initialPassword,
      displayName: name,
      emailVerified: false,
      disabled: false,
    });

    await admin.auth().setCustomUserClaims(userRecord.uid, { role: allowedRole });

    const officeDoc = {
      uid: userRecord.uid,
      name,
      officialName,
      email: cleanEmail,
      role: allowedRole,
      purposes: normalizeList(purposes),
      staffToVisit: normalizeList(staffToVisit),
      status: "active",
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
      credentials: {
        email: cleanEmail,
        initialPassword,
      },
    });
  } catch (error) {
    console.error("create-office-account error:", error);
    const status = error.message === "Not authorized" ? 403 : 500;
    return res.status(status).json({
      success: false,
      message: status === 403 ? "Not authorized." : "Failed to create office account.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
