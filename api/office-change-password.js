import { getAdmin } from "./_firebaseAdmin.js";
import {
  ensureAuthUser,
  hashOfficePassword,
  isValidPassword,
  verifyOfficePassword,
} from "./_officeCredentials.js";

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

const findOfficeByUid = async (db, uid) => {
  const byIdRef = db.collection("offices").doc(uid);
  const byIdSnap = await byIdRef.get();
  if (byIdSnap.exists) {
    return { ref: byIdRef, id: byIdSnap.id, data: byIdSnap.data() || {} };
  }

  const byUidSnap = await db
    .collection("offices")
    .where("uid", "==", uid)
    .limit(1)
    .get();

  if (byUidSnap.empty) return null;
  const doc = byUidSnap.docs[0];
  return { ref: doc.ref, id: doc.id, data: doc.data() || {} };
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
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Missing bearer token.",
      });
    }

    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!isValidPassword(currentPassword) || !isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Current and new password must be at least 8 characters.",
      });
    }

    const admin = await getAdmin();
    const db = admin.firestore();
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = String(decoded.uid || "").trim();
    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }

    const officeRecord = await findOfficeByUid(db, uid);
    if (!officeRecord) {
      return res.status(404).json({
        success: false,
        message: "Office account not found.",
      });
    }

    const officeData = officeRecord.data;
    if ((officeData.role || "office") !== "office") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is only for office accounts.",
      });
    }

    let passwordVerified = verifyOfficePassword(currentPassword, officeData);
    if (!passwordVerified) {
      const legacyPassword = String(officeData.password || "");
      if (legacyPassword && legacyPassword === currentPassword) {
        passwordVerified = true;
      }
    }

    if (!passwordVerified) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    const credentialFields = hashOfficePassword(newPassword.trim());
    await officeRecord.ref.set(
      {
        uid,
        ...credentialFields,
        credentialUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        passwordChanged: true,
        passwordChangedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        password: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );

    await ensureAuthUser({
      admin,
      uid,
      role: "office",
      displayName: officeData.name || officeData.officialName || "Office User",
      disabled: officeData.status === "inactive",
    });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("office-change-password error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update password.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
