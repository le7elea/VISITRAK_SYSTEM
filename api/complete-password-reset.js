import { getAdmin } from "./_firebaseAdmin.js";

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const isStrongPassword = (password = "") =>
  password.length >= 10 &&
  /[A-Z]/.test(password) &&
  /[0-9!@#$%^&*]/.test(password);

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  return null;
};

const getOfficeDocRef = async (db, tokenData, email, uid) => {
  if (tokenData?.officeId) {
    const directRef = db.collection("offices").doc(String(tokenData.officeId));
    const directDoc = await directRef.get();
    if (directDoc.exists) return directRef;
  }

  if (uid) {
    const byUidRef = db.collection("offices").doc(uid);
    const byUidDoc = await byUidRef.get();
    if (byUidDoc.exists) return byUidRef;
  }

  const byEmail = await db
    .collection("offices")
    .where("email", "==", normalizeEmail(email))
    .limit(1)
    .get();

  if (!byEmail.empty) {
    return byEmail.docs[0].ref;
  }

  return null;
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
    const token = String(req.body?.token || "").trim();
    const email = normalizeEmail(req.body?.email || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!token || !email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token, email, and newPassword are required.",
        error: "INVALID_INPUT",
      });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 10 characters with one uppercase and one number or special character.",
        error: "WEAK_PASSWORD",
      });
    }

    const admin = await getAdmin();
    const db = admin.firestore();

    const tokenQuery = await db
      .collection("passwordResetTokens")
      .where("token", "==", token)
      .limit(1)
      .get();

    if (tokenQuery.empty) {
      return res.status(404).json({
        success: false,
        message: "Invalid reset token.",
        error: "INVALID_TOKEN",
      });
    }

    const tokenDoc = tokenQuery.docs[0];
    const tokenData = tokenDoc.data() || {};
    const tokenEmail = normalizeEmail(tokenData.email || "");

    if (!tokenEmail || tokenEmail !== email) {
      return res.status(400).json({
        success: false,
        message: "Reset token does not match this email.",
        error: "TOKEN_EMAIL_MISMATCH",
      });
    }

    if (tokenData.used === true) {
      return res.status(400).json({
        success: false,
        message: "This reset link has already been used.",
        error: "TOKEN_USED",
      });
    }

    const expiresAt = toDate(tokenData.expiresAt);
    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        message: "This reset link has expired.",
        error: "TOKEN_EXPIRED",
      });
    }

    let userRecord = null;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(userRecord.uid, { password: newPassword });
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }

      const officeRef = await getOfficeDocRef(db, tokenData, email, null);
      const officeDoc = officeRef ? await officeRef.get() : null;
      const officeData = officeDoc?.data() || {};
      const role = officeData.role === "super" ? "super" : "office";

      userRecord = await admin.auth().createUser({
        email,
        password: newPassword,
        displayName: officeData.name || officeData.officialName || "Office User",
        disabled: officeData.status === "inactive",
      });
      await admin.auth().setCustomUserClaims(userRecord.uid, { role });

      if (officeRef) {
        await officeRef.set(
          {
            uid: userRecord.uid,
            email,
            role,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    const officeRef = await getOfficeDocRef(db, tokenData, email, userRecord.uid);

    const writes = [
      tokenDoc.ref.set(
        {
          used: true,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
          usedByUid: userRecord.uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      ),
    ];

    if (officeRef) {
      writes.push(
        officeRef.set(
          {
            uid: userRecord.uid,
            email,
            passwordChanged: true,
            passwordChangedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
      );
    }

    await Promise.all(writes);

    return res.status(200).json({
      success: true,
      message: "Password reset successfully.",
    });
  } catch (error) {
    console.error("complete-password-reset error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

