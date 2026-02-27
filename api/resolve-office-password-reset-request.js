import { randomBytes } from "crypto";
import { getAdmin } from "../server/firebaseAdmin.js";

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
const normalizeUsername = (username = "") => username.trim().toLowerCase();
const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$/;
const REQUEST_EXPIRATION_MS = 15 * 60 * 1000;
const REQUEST_EXPIRY_REASON =
  "Request expired after 15 minutes without super admin action.";

const resolveAppUrl = (req) => {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL.startsWith("http")
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`;
  }

  const host = req.headers["x-forwarded-host"];
  if (host) return `https://${host}`;
  return "https://visitrak-system.vercel.app";
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  return null;
};

const toIso = (value) => {
  const d = toDate(value);
  return d ? d.toISOString() : null;
};

const isPendingRequestExpired = (requestData) => {
  const status = requestData?.status || "pending";
  if (status !== "pending") return false;

  const requestedAt = toDate(requestData?.requestedAt);
  if (!requestedAt) return false;

  return Date.now() - requestedAt.getTime() >= REQUEST_EXPIRATION_MS;
};

const archivePendingResetNotifications = async (db, admin, requestId, status) => {
  if (!requestId) return;

  const notificationsSnapshot = await db
    .collection("adminNotifications")
    .where("requestId", "==", requestId)
    .where("type", "==", "password_reset_request")
    .limit(30)
    .get();

  if (notificationsSnapshot.empty) return;

  const batch = db.batch();
  notificationsSnapshot.docs.forEach((doc) => {
    batch.set(
      doc.ref,
      {
        status,
        archived: true,
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
  await batch.commit();
};

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

const buildRequestResponse = (requestId, requestData) => ({
  id: requestId,
  officeId: requestData.officeId || null,
  officeName: requestData.officeName || null,
  officialName: requestData.officialName || null,
  username: requestData.username || null,
  usernameNormalized: requestData.usernameNormalized || null,
  officeEmail: requestData.officeEmail || null,
  status: requestData.status || "pending",
  reason: requestData.reason || "",
  requestedAt: toIso(requestData.requestedAt),
  resolvedAt: toIso(requestData.resolvedAt),
  resolvedByUid: requestData.resolvedByUid || null,
  resolvedByEmail: requestData.resolvedByEmail || null,
  resetTokenId: requestData.resetTokenId || null,
  resetLink: requestData.resetLink || null,
  resetTokenExpiresAt: toIso(requestData.resetTokenExpiresAt),
  lastUpdatedAt: toIso(requestData.lastUpdatedAt),
});

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
    const admin = await getAdmin();
    const db = admin.firestore();
    const requester = await ensureSuperRequester(admin, db, req);

    const requestId = String(req.body?.requestId || "").trim();
    const action = String(req.body?.action || "")
      .trim()
      .toLowerCase();
    const reason = String(req.body?.reason || "").trim().slice(0, 500);

    if (!requestId || !["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "requestId and action (approve|reject) are required.",
      });
    }

    const requestRef = db.collection("passwordResetRequests").doc(requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      return res.status(404).json({
        success: false,
        message: "Reset request not found.",
      });
    }

    const requestData = requestSnap.data() || {};
    if (requestData.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Reset request has already been resolved.",
      });
    }

    if (isPendingRequestExpired(requestData)) {
      await requestRef.set(
        {
          status: "expired",
          reason: requestData.reason || REQUEST_EXPIRY_REASON,
          resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
          resolvedByUid: null,
          resolvedByEmail: "",
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await archivePendingResetNotifications(db, admin, requestId, "expired");

      return res.status(409).json({
        success: false,
        message:
          "Reset request expired after 15 minutes without action. Ask the office admin to resend.",
      });
    }

    if (action === "reject") {
      const rejectedPayload = {
        status: "rejected",
        reason,
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedByUid: requester.uid || null,
        resolvedByEmail: normalizeEmail(requester.email || ""),
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await requestRef.set(rejectedPayload, { merge: true });
      await archivePendingResetNotifications(db, admin, requestId, "resolved");
      await db.collection("adminNotifications").add({
        type: "password_reset_request_rejected",
        status: "unread",
        requestId,
        officeId: requestData.officeId || null,
        officeName: requestData.officeName || "Office",
        username: requestData.username || requestData.usernameNormalized || "",
        title: "Password reset request rejected",
        message: `Request for "${requestData.officeName || "Office"}" was rejected.`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        readAt: null,
      });

      const updatedSnap = await requestRef.get();
      return res.status(200).json({
        success: true,
        message: "Reset request rejected.",
        request: buildRequestResponse(updatedSnap.id, updatedSnap.data() || {}),
      });
    }

    const officeId = String(requestData.officeId || "").trim();
    if (!officeId) {
      return res.status(400).json({
        success: false,
        message: "Reset request is missing office information.",
      });
    }

    const officeRef = db.collection("offices").doc(officeId);
    const officeSnap = await officeRef.get();
    if (!officeSnap.exists) {
      return res.status(404).json({
        success: false,
        message: "Office account not found.",
      });
    }

    const officeData = officeSnap.data() || {};
    if ((officeData.role || "office") !== "office") {
      return res.status(403).json({
        success: false,
        message: "Only office admin accounts can use this reset flow.",
      });
    }

    const usernameNormalized = normalizeUsername(
      officeData.usernameNormalized || requestData.usernameNormalized || ""
    );
    if (!USERNAME_REGEX.test(usernameNormalized)) {
      return res.status(400).json({
        success: false,
        message: "Office account is missing a valid username.",
      });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const tokenRef = await db.collection("passwordResetTokens").add({
      token,
      officeId,
      officeName: officeData.name || requestData.officeName || "Office",
      officialName: officeData.officialName || requestData.officialName || "",
      username: officeData.username || requestData.username || usernameNormalized,
      usernameNormalized,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      requestTime: new Date().toISOString(),
      source: "super_admin_request_approval",
      approvedRequestId: requestId,
    });

    const appUrl = resolveAppUrl(req);
    const resetLink = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

    await requestRef.set(
      {
        status: "approved",
        reason,
        officeEmail: "",
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedByUid: requester.uid || null,
        resolvedByEmail: normalizeEmail(requester.email || ""),
        resetTokenId: tokenRef.id,
        resetLink,
        resetTokenExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await archivePendingResetNotifications(db, admin, requestId, "resolved");

    await db.collection("adminNotifications").add({
      type: "password_reset_request_approved",
      status: "unread",
      requestId,
      officeId,
      officeName: officeData.name || requestData.officeName || "Office",
      username:
        officeData.username ||
        requestData.username ||
        requestData.usernameNormalized ||
        "",
      title: "Password reset request approved",
      message: `Request for "${officeData.name || "Office"}" was approved.`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      readAt: null,
    });

    const updatedSnap = await requestRef.get();
    return res.status(200).json({
      success: true,
      message: "Reset request approved.",
      request: buildRequestResponse(updatedSnap.id, updatedSnap.data() || {}),
      resetLink,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("resolve-office-password-reset-request error:", error);
    const status = error.message === "Not authorized" ? 403 : 500;
    return res.status(status).json({
      success: false,
      message:
        status === 403 ? "Not authorized." : "Failed to resolve reset request.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
