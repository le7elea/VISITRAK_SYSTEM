import { getAdmin } from "../server/firebaseAdmin.js";
import {
  ensureAuthUser,
  hashOfficePassword,
} from "../server/officeCredentials.js";

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizeUsername = (username = "") => username.trim().toLowerCase();

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

  const usernameNormalized = normalizeUsername(
    tokenData?.usernameNormalized || tokenData?.username || ""
  );
  if (usernameNormalized) {
    const byUsername = await db
      .collection("offices")
      .where("usernameNormalized", "==", usernameNormalized)
      .limit(1)
      .get();
    if (!byUsername.empty) return byUsername.docs[0].ref;
  }

  if (uid) {
    const byUidRef = db.collection("offices").doc(uid);
    const byUidDoc = await byUidRef.get();
    if (byUidDoc.exists) return byUidRef;

    const byUidQuery = await db
      .collection("offices")
      .where("uid", "==", uid)
      .limit(1)
      .get();
    if (!byUidQuery.empty) return byUidQuery.docs[0].ref;
  }

  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return null;

  const byEmail = await db
    .collection("offices")
    .where("email", "==", cleanEmail)
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

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token and newPassword are required.",
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

    if (email && tokenEmail && tokenEmail !== email) {
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

    const officeRef = await getOfficeDocRef(
      db,
      tokenData,
      email || tokenEmail,
      tokenData?.uid || ""
    );
    const officeSnap = officeRef ? await officeRef.get() : null;
    const officeData = officeSnap?.data() || null;
    const officeRole = officeData?.role === "super" ? "super" : "office";

    let usedByUid = null;

    if (officeRef && officeData && officeRole === "office") {
      const uid = String(officeData.uid || officeSnap.id);

      await ensureAuthUser({
        admin,
        uid,
        role: "office",
        displayName: officeData.name || officeData.officialName || "Office User",
        disabled: officeData.status === "inactive",
        email: null,
      });

      await officeRef.set(
        {
          uid,
          ...hashOfficePassword(newPassword),
          credentialAlgo: admin.firestore.FieldValue.delete(),
          credentialIterations: admin.firestore.FieldValue.delete(),
          credentialKeyLength: admin.firestore.FieldValue.delete(),
          credentialUpdatedAt: admin.firestore.FieldValue.delete(),
          passwordChanged: true,
          passwordChangedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          password: admin.firestore.FieldValue.delete(),
        },
        { merge: true }
      );

      usedByUid = uid;
    } else {
      const fallbackEmail = normalizeEmail(email || tokenEmail || "");
      if (!fallbackEmail) {
        return res.status(400).json({
          success: false,
          message: "Token is missing account context.",
          error: "TOKEN_CONTEXT_MISSING",
        });
      }

      let userRecord = null;
      try {
        userRecord = await admin.auth().getUserByEmail(fallbackEmail);
      } catch (lookupError) {
        if (lookupError.code === "auth/user-not-found") {
          return res.status(404).json({
            success: false,
            message: "Account not found for this reset link.",
            error: "ACCOUNT_NOT_FOUND",
          });
        }
        throw lookupError;
      }

      await admin.auth().updateUser(userRecord.uid, { password: newPassword });
      usedByUid = userRecord.uid;

      const legacyOfficeRef =
        officeRef || (await getOfficeDocRef(db, tokenData, fallbackEmail, userRecord.uid));
      if (legacyOfficeRef) {
        await legacyOfficeRef.set(
          {
            uid: userRecord.uid,
            email: fallbackEmail,
            credentialAlgo: admin.firestore.FieldValue.delete(),
            credentialIterations: admin.firestore.FieldValue.delete(),
            credentialKeyLength: admin.firestore.FieldValue.delete(),
            credentialUpdatedAt: admin.firestore.FieldValue.delete(),
            passwordChanged: true,
            passwordChangedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            password: admin.firestore.FieldValue.delete(),
          },
          { merge: true }
        );
      }
    }

    await tokenDoc.ref.set(
      {
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
        usedByUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

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
