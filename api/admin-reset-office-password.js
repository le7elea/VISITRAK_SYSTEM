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

const ensureSuperRequester = async (admin, db, req) => {
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing bearer token");

  const decoded = await admin.auth().verifyIdToken(token);
  if (decoded.role === "super") return decoded;

  const officeDoc = await db.collection("offices").doc(decoded.uid).get();
  if (officeDoc.exists && officeDoc.data()?.role === "super") return decoded;

  if (decoded.email) {
    const byEmail = await db
      .collection("offices")
      .where("email", "==", normalizeEmail(decoded.email))
      .where("role", "==", "super")
      .limit(1)
      .get();
    if (!byEmail.empty) return decoded;
  }

  throw new Error("Not authorized");
};

const isValidPassword = (value) => typeof value === "string" && value.trim().length >= 8;

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

    try {
      await admin.auth().updateUser(uid, {
        password: newPassword.trim(),
        disabled: false,
      });
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        return res.status(404).json({
          success: false,
          message: "Authentication account not found for this office.",
        });
      }
      throw error;
    }

    await officeRef.update({
      passwordChanged: false,
      passwordChangedAt: null,
      lastAdminPasswordResetAt: admin.firestore.FieldValue.serverTimestamp(),
      lastAdminPasswordResetBy: requester.uid || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
      data: {
        id,
        uid,
        email: officeData.email || null,
        name: officeData.name || null,
      },
    });
  } catch (error) {
    console.error("admin-reset-office-password error:", error);
    const status = error.message === "Not authorized" ? 403 : 500;
    return res.status(status).json({
      success: false,
      message: status === 403 ? "Not authorized." : "Failed to reset office password.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
