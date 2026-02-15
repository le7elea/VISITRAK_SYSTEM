import { getAdmin } from "./_firebaseAdmin.js";

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const generateTempPassword = async () => {
  const { randomBytes } = await import("crypto");
  // Strong temporary value; user will reset using email link.
  return `Tmp!${randomBytes(12).toString("hex")}A1`;
};

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  try {
    const email = normalizeEmail(req.body?.email || "");
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const admin = await getAdmin();
    const db = admin.firestore();

    // If already present in Firebase Auth, nothing to do.
    try {
      const existing = await admin.auth().getUserByEmail(email);
      return res.status(200).json({
        success: true,
        provisioned: false,
        uid: existing.uid,
      });
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    // Bridge legacy Firestore-only office accounts into Firebase Auth.
    const officeSnapshot = await db
      .collection("offices")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (officeSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: "Email not found in offices collection.",
      });
    }

    const officeDoc = officeSnapshot.docs[0];
    const officeData = officeDoc.data() || {};
    const role = officeData.role === "super" ? "super" : "office";
    const tempPassword = await generateTempPassword();

    const userRecord = await admin.auth().createUser({
      email,
      password: tempPassword,
      displayName: officeData.name || officeData.officialName || "Office User",
      disabled: officeData.status === "inactive",
    });

    await admin.auth().setCustomUserClaims(userRecord.uid, { role });

    await officeDoc.ref.set(
      {
        uid: userRecord.uid,
        email,
        role,
        // Account was bridged from legacy flow; treat as non-default state.
        passwordChanged:
          typeof officeData.passwordChanged === "boolean"
            ? officeData.passwordChanged
            : true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({
      success: true,
      provisioned: true,
      uid: userRecord.uid,
    });
  } catch (error) {
    console.error("provision-auth-user error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to provision auth user.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
