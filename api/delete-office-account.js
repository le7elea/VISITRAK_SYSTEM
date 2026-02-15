import { getAdmin } from "./_firebaseAdmin.js";

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

    const { id } = req.body || {};
    if (!id) {
      return res.status(400).json({ success: false, message: "Office id is required." });
    }

    const officeRef = db.collection("offices").doc(id);
    const officeSnap = await officeRef.get();

    if (!officeSnap.exists) {
      return res.status(404).json({ success: false, message: "Office not found." });
    }

    const officeData = officeSnap.data() || {};
    if (officeData.role === "super") {
      return res.status(403).json({
        success: false,
        message: "Super admin account cannot be deleted.",
      });
    }

    const uid = officeData.uid || id;

    await officeRef.delete();

    try {
      await admin.auth().deleteUser(uid);
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Office account deleted successfully.",
      data: { id, uid },
    });
  } catch (error) {
    console.error("delete-office-account error:", error);
    const status = error.message === "Not authorized" ? 403 : 500;
    return res.status(status).json({
      success: false,
      message: status === 403 ? "Not authorized." : "Failed to delete office account.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
